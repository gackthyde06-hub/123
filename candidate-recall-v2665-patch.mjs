import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='MANUAL_CANDIDATE_RECALL_V2665_20260904';
const BASE_MARKER='MANUAL_RECOVERY_STABLE_V2664_20260904';

function check(file,label){
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(r.status!==0||r.error)throw new Error(`[candidate-v2665] ${label} syntax invalid: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`);
}
function writeChecked(file,src,label){
  const tmp=`${file}.v2665-${process.pid}-${Date.now()}.tmp.js`;
  fs.writeFileSync(tmp,src,'utf8');
  try{check(tmp,label);fs.renameSync(tmp,file)}
  catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}
}
function functionRange(src,name){
  const needles=[`async function ${name}(`,`function ${name}(`];
  let start=-1;
  for(const n of needles){const i=src.indexOf(n);if(i>=0&&(start<0||i<start))start=i}
  if(start<0)return null;
  const brace=src.indexOf('{',start);if(brace<0)return null;
  let depth=0,quote=null,escape=false,lineComment=false,blockComment=false,templateExpr=0;
  for(let i=brace;i<src.length;i++){
    const ch=src[i],next=src[i+1];
    if(lineComment){if(ch==='\n')lineComment=false;continue}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++}continue}
    if(quote){
      if(escape){escape=false;continue}
      if(ch==='\\'){escape=true;continue}
      if(quote==='`'&&ch==='$'&&next==='{'){templateExpr++;i++;continue}
      if(quote==='`'&&templateExpr>0){
        if(ch==='{')templateExpr++;
        else if(ch==='}')templateExpr--;
        continue;
      }
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue}
    if(ch==='{')depth++;
    else if(ch==='}'){depth--;if(depth===0)return {start,end:i+1}}
  }
  return null;
}
function replaceFunction(src,name,code){
  const r=functionRange(src,name);
  if(!r)throw new Error(`[candidate-v2665] function missing: ${name}`);
  return src.slice(0,r.start)+code.trim()+src.slice(r.end);
}
function replaceOnce(src,oldText,newText,label){
  if(src.includes(newText))return src;
  if(!src.includes(oldText))throw new Error(`[candidate-v2665] anchor missing: ${label}`);
  return src.replace(oldText,newText);
}

const SCORE_FN=String.raw`
function manualCandidateScoreV2664(x){
  const cal=manualFinite(x?.calibratedWinRate)??manualFinite(x?.estimatedWinRate)??50;
  const sh=manualFinite(x?.shadow?.hitRate)??50;
  const exec=manualFinite(x?.executionScore)??0;
  const rank=manualFinite(x?.rankScore)??0;
  const structure=manualFinite(x?.structure?.health)??45;
  const coverage=manualFinite(x?.dataHealth?.coverage)??40;
  const confidence=manualFinite(x?.dataHealth?.confidence)??40;
  const pf=manualFinite(x?.shadow?.profitFactor);
  const sample=Math.max(0,Number(x?.shadow?.sample||0));
  const rel=Math.min(1,sample/30);
  const learn=manualFinite(x?.structure?.learningAdjustment)??0;
  const qv=manualFinite(x?.quoteVolume);
  const vr=manualFinite(x?.marketMetrics?.volumeRatio);
  const taker=manualFinite(x?.marketMetrics?.takerRatio);
  const top=manualFinite(x?.marketMetrics?.topRatio);
  const dir=String(x?.direction||'LONG')==='SHORT'?-1:1;
  let marketAdj=0;
  if(qv!=null){if(qv<5_000_000)marketAdj-=12;else if(qv<20_000_000)marketAdj-=4;else if(qv>=500_000_000)marketAdj+=4;else if(qv>=100_000_000)marketAdj+=3;else if(qv>=30_000_000)marketAdj+=1.5}
  if(vr!=null){if(vr>=1.5)marketAdj+=3;else if(vr>=1.15)marketAdj+=1.5;else if(vr<.65)marketAdj-=4}
  if(taker!=null){const z=(taker-1)*dir;if(z>=.04)marketAdj+=2;else if(z<=-.06)marketAdj-=2}
  if(top!=null){const z=(top-1)*dir;if(z>=.04)marketAdj+=1.5;else if(z<=-.08)marketAdj-=1.5}
  const pfAdj=pf==null?0:Math.max(-7,Math.min(8,(pf-1)*8));
  const blockerPenalty=Math.min(8,(Array.isArray(x?.blockers)?x.blockers.length:0)*1.25);
  const score=cal*.30+sh*.18*rel+50*.18*(1-rel)+exec*.13+rank*.13+structure*.09+coverage*.045+confidence*.045+pfAdj+learn*.85+marketAdj-blockerPenalty;
  const win=sample>=8?(cal*.62+sh*.38):sample>=4?(cal*.78+sh*.22):cal;
  return {
    score:Number(Math.max(0,Math.min(100,score)).toFixed(1)),
    win:Number(Math.max(0,Math.min(100,win)).toFixed(1)),
    sample,
    liquidity:qv,
    marketAdj:Number(marketAdj.toFixed(1))
  };
}

function manualCandidateBlockClassV2665(x,m){
  const hard=[],soft=[],push=(a,v)=>{v=String(v||'').trim();if(v&&!a.includes(v))a.push(v)};
  if(!x){push(hard,'資料不存在');return {hard,soft}}
  if(x?.trade?.status==='ACTIVE')push(hard,'已有實際建倉追蹤');
  const status=String(x?.trackerStatus||'NO_TRACKER').toUpperCase();
  const st=String(x?.structure?.state||'UNKNOWN').toUpperCase();
  if(['DROPPED','EXPIRED','LOSS','WIN','TIMEOUT'].includes(status))push(hard,'追蹤狀態已結束');
  if(st==='DESTROYED')push(hard,'結構徹底破壞');
  const rr=manualFinite(x?.entry?.rr);
  if(rr!=null&&rr<1)push(hard,'TP2 RR < 1');
  const qv=manualFinite(x?.quoteVolume);
  if(qv!=null&&qv<5_000_000)push(hard,'24h成交額過低');
  else if(qv!=null&&qv<20_000_000)push(soft,'流動性普通，需更嚴格等進場');
  const shN=Math.max(0,Number(x?.shadow?.sample||0)),shHit=manualFinite(x?.shadow?.hitRate),shPf=manualFinite(x?.shadow?.profitFactor);
  if(shN>=12&&((shPf!=null&&shPf<.75)||(shHit!=null&&shHit<40)))push(hard,'Shadow 同類樣本明顯負期望');
  else if(shN>=8&&shPf!=null&&shPf<.90)push(soft,'Shadow 同類 PF 偏弱');
  if(m?.win!=null&&Number(m.win)<52)push(hard,'候選校準勝率低於安全底線');
  const coverage=manualFinite(x?.dataHealth?.coverage),confidence=manualFinite(x?.dataHealth?.confidence);
  if(status==='NO_TRACKER'){
    push(soft,'等待完整 tracker 建立');
  }else{
    const age=Math.max(0,Number(x?.freshnessAgeMs||0));
    if(age>15*60_000)push(hard,'即時判讀超過15分鐘');
    else if(age>5*60_000)push(soft,'即時判讀超過5分鐘，等待刷新');
    if(coverage!=null&&coverage<55)push(hard,'資料完整度過低');
    else if(coverage!=null&&coverage<72)push(soft,'資料完整度尚未達通知門檻');
    if(confidence!=null&&confidence<50)push(hard,'資料可信度過低');
    else if(confidence!=null&&confidence<65)push(soft,'資料可信度尚未達通知門檻');
  }
  if(!x?.structure)push(soft,'Structure V2 尚未完成');
  if(x?.institutionalEdge?.hardBlock===true){
    const rs=Array.isArray(x?.institutionalEdge?.hardBlockReasons)?x.institutionalEdge.hardBlockReasons:[];
    if(rs.length)for(const r of rs)push(hard,'機構風險：'+r);else push(hard,'機構風險硬阻擋');
  }
  const blockers=(Array.isArray(x?.blockers)?x.blockers:[]).map(v=>String(v));
  const has30=blockers.some(v=>/30分逆向/.test(v)),has1h=blockers.some(v=>/1小時逆向/.test(v));
  if(has30&&has1h)push(hard,'30分＋1小時同步逆向');
  for(const b of blockers){
    if(/距離回踩區|目前轉弱|15分逆向/.test(b)){push(soft,b);continue}
    if(/30分逆向|1小時逆向/.test(b)){if(!(has30&&has1h))push(soft,b);continue}
    if(/資料完整度|資料可信度/.test(b)){push(soft,b);continue}
    if(/價差|spread|ADL|Funding|擁擠|BTC\/ETH大盤逆向|跨交易所趨勢逆向|清算行情山寨|高波動價差|結構失效/i.test(b)){push(hard,b);continue}
    push(hard,b);
  }
  if(String(x?.notificationTier||'').toUpperCase()==='BLOCKED'&&!blockers.length)push(hard,'通知閘門存在未知硬阻擋');
  return {hard,soft};
}
function manualCandidateFormalVisibleV2665(x,m){
  if(!['A','B'].includes(String(x?.grade||'').toUpperCase()))return false;
  if(x?.trade?.status==='ACTIVE')return false;
  if(String(x?.notificationTier||'').toUpperCase()==='BLOCKED')return false;
  if(x?.institutionalEdge?.hardBlock===true)return false;
  return manualCandidateBlockClassV2665(x,m).hard.length===0;
}
function manualCandidateBandV2665(x,m){
  if(!x||manualCandidateBlockClassV2665(x,m).hard.length)return 'DROP';
  if(manualCandidateFormalVisibleV2665(x,m))return 'FORMAL';
  const cal=manualFinite(x?.calibratedWinRate)??manualFinite(x?.estimatedWinRate)??0;
  const rank=Number(x?.rank||99),rankScore=Number(x?.rankScore||0),sample=Math.max(0,Number(x?.shadow?.sample||0));
  if(m.score>=66&&m.win>=57&&(sample>=6||cal>=60))return 'PRIME';
  if(m.score>=59&&m.win>=53&&(rank<=10||rankScore>=60||cal>=56||sample>=6))return 'WATCH';
  if(m.score>=55&&m.win>=51&&rank<=8&&rankScore>=54)return 'RELATIVE';
  return 'DROP';
}
function manualCandidateRejectSummaryV2665(rows){
  const h=new Map(),s=new Map();
  for(const x of rows||[]){
    const m=manualCandidateScoreV2664(x),c=manualCandidateBlockClassV2665(x,m);
    for(const r of c.hard)h.set(r,(h.get(r)||0)+1);
    for(const r of c.soft)s.set(r,(s.get(r)||0)+1);
  }
  const top=map=>[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([reason,count])=>({reason,count}));
  return {hard:top(h),soft:top(s)};
}
function manualNotificationEligibleV2665(pref,row){
  if(!row||row.candidate===true)return false;
  if(!manualPrefAllows(pref,row.grade))return false;
  if(!['A','B'].includes(String(row.grade||'').toUpperCase()))return false;
  if(String(row.notificationTier||'').toUpperCase()==='BLOCKED')return false;
  if(row?.institutionalEdge?.hardBlock===true)return false;
  if(row.freshness==='STALE'||row.trade?.status==='ACTIVE')return false;
  const m=manualCandidateScoreV2664(row);
  return manualCandidateBlockClassV2665(row,m).hard.length===0;
}
`;

const HARD_FN=String.raw`
function manualCandidateHardInvalidV2664(x,m){
  return manualCandidateBlockClassV2665(x,m||manualCandidateScoreV2664(x)).hard.length>0;
}
`;

const QUALIFIED_FN=String.raw`
function manualCandidateQualifiedV2664(x,m){
  return !['DROP','FORMAL'].includes(manualCandidateBandV2665(x,m));
}
`;

const DECORATE_FN=String.raw`
function manualCandidateDecorateV2664(x,st,m,now){
  const out={...x},cls=manualCandidateBlockClassV2665(x,m),band=manualCandidateBandV2665(x,m);
  out.candidate=true;
  out.candidateKey=manualCandidateKeyV2664(x);
  out.candidateScore=m.score;
  out.candidateWinRate=m.win;
  out.candidateBand=band;
  out.candidateSince=st.selectedAt||st.firstSeen||now;
  out.candidateHoldUntil=(st.selectedAt||now)+MANUAL_CANDIDATE_HOLD_MS_V2664;
  out.candidateStable=true;
  out.originalGrade=String(x.grade||'C');
  out.candidateHardBlockers=cls.hard;
  out.candidateSoftWait=cls.soft;
  out.candidateEvidence={
    calibratedWinRate:manualFinite(x.calibratedWinRate),
    shadowSample:Number(x?.shadow?.sample||0),shadowHitRate:manualFinite(x?.shadow?.hitRate),
    shadowProfitFactor:manualFinite(x?.shadow?.profitFactor),shadowLevel:String(x?.shadow?.level||''),
    score:m.score,liquidity:manualFinite(x?.quoteVolume),marketAdj:m.marketAdj
  };
  out.formalGap=manualCandidateGapV2664(x);
  out.tradeCautions=[
    ...(cls.soft.length?['目前屬於等待型候選：'+cls.soft.slice(0,2).join(' / ')]:[]),
    ...manualCandidateCautionV2664(x)
  ].slice(0,7);
  out.candidateReasons=[
    '候選層級 '+band+' · 相對排名 '+m.score+'分',
    ...manualCandidateReasonsV2664(x,m)
  ].slice(0,6);
  return out;
}
`;

const STABLE_FN=String.raw`
function manualStableCandidatesV2664(rows){
  const now=Date.now(),current=new Map(),formal=new Set();
  for(const x of rows||[]){
    const k=manualCandidateKeyV2664(x),m=manualCandidateScoreV2664(x),band=manualCandidateBandV2665(x,m),hardInvalid=manualCandidateHardInvalidV2664(x,m),formalVisible=manualCandidateFormalVisibleV2665(x,m);
    if(formalVisible)formal.add(k);
    current.set(k,{row:x,metric:m,band,qualified:!['DROP','FORMAL'].includes(band),hardInvalid,formalVisible});
    let st=manualCandidateStateV2664.get(k);
    if(!st)st={firstSeen:now,lastSeen:0,confirm:0,selected:false,selectedAt:0,snapshot:null,metric:null};
    const consecutive=st.lastSeen&&now-st.lastSeen<150000;
    st.confirm=consecutive?st.confirm+1:1;
    st.lastSeen=now;st.snapshot=x;st.metric=m;st.band=band;
    manualCandidateStateV2664.set(k,st);
  }
  for(const [k,st] of [...manualCandidateStateV2664]){
    if(formal.has(k)){manualCandidateStateV2664.delete(k);continue}
    const cur=current.get(k);
    if(cur?.hardInvalid){manualCandidateStateV2664.delete(k);continue}
    if(now-(st.lastSeen||0)>2*60*60*1000)manualCandidateStateV2664.delete(k);
  }

  let selected=[...manualCandidateStateV2664.entries()].filter(([k,st])=>st.selected&&!formal.has(k));
  const bandWeight={PRIME:3,WATCH:2,RELATIVE:1,DROP:0,FORMAL:0};
  const challengers=[...current.entries()]
    .filter(([k,v])=>{
      if(formal.has(k)||!v.qualified||manualCandidateStateV2664.get(k)?.selected)return false;
      const cf=manualCandidateStateV2664.get(k)?.confirm||0;
      return v.band==='RELATIVE'?cf>=1:cf>=MANUAL_CANDIDATE_CONFIRM_SCANS_V2664;
    })
    .sort((a,b)=>(bandWeight[b[1].band]-bandWeight[a[1].band])||b[1].metric.score-a[1].metric.score||b[1].metric.win-a[1].metric.win||Number(a[1].row.rank||99)-Number(b[1].row.rank||99));

  while(selected.length<MANUAL_CANDIDATE_MAX_V2664&&challengers.length){
    const [k]=challengers.shift(),st=manualCandidateStateV2664.get(k);
    st.selected=true;st.selectedAt=now;manualCandidateStateV2664.set(k,st);selected.push([k,st]);
  }

  if(selected.length&&challengers.length){
    const replaceable=selected.filter(([k,st])=>now-(st.selectedAt||0)>=MANUAL_CANDIDATE_HOLD_MS_V2664)
      .sort((a,b)=>(a[1].metric?.score||0)-(b[1].metric?.score||0));
    const best=challengers[0];
    if(replaceable.length&&best){
      const weak=replaceable[0],weakScore=weak[1].metric?.score||0,bestScore=best[1].metric?.score||0;
      if(bestScore>=weakScore+MANUAL_CANDIDATE_REPLACE_EDGE_V2664){
        weak[1].selected=false;manualCandidateStateV2664.set(weak[0],weak[1]);
        const st=manualCandidateStateV2664.get(best[0]);st.selected=true;st.selectedAt=now;manualCandidateStateV2664.set(best[0],st);
      }
    }
  }

  const output=[];
  for(const [k,st] of manualCandidateStateV2664){
    if(!st.selected||formal.has(k))continue;
    const cur=current.get(k);
    if(!cur&&now-(st.lastSeen||0)>MANUAL_CANDIDATE_MISS_MS_V2664)continue;
    const x=cur?.row||st.snapshot,m=cur?.metric||st.metric;
    if(!x||!m||manualCandidateHardInvalidV2664(x,m))continue;
    const band=manualCandidateBandV2665(x,m);
    if(['DROP','FORMAL'].includes(band)){
      if(now-(st.selectedAt||0)>=MANUAL_CANDIDATE_HOLD_MS_V2664)st.selected=false;
      continue;
    }
    output.push(manualCandidateDecorateV2664(x,st,m,now));
  }
  output.sort((a,b)=>{
    const bw={PRIME:3,WATCH:2,RELATIVE:1};
    return (bw[b.candidateBand]||0)-(bw[a.candidateBand]||0)||Number(b.candidateScore||0)-Number(a.candidateScore||0)||Number(a.rank||99)-Number(b.rank||99);
  });
  manualCandidateSaveStateV2664();
  return output.slice(0,MANUAL_CANDIDATE_MAX_V2664);
}
`;

const RESPONSE_FN=String.raw`
async function manualOpportunityResponse(force=false){
  const base=await manualOpportunityResponseBaseV2664(force);
  const baseRows=Array.isArray(base?.rows)?base.rows:[];
  const candidates=manualStableCandidatesV2664(baseRows);
  const byKey=new Map(candidates.map(x=>[x.candidateKey,x]));
  const rows=baseRows.map(x=>byKey.get(manualCandidateKeyV2664(x))||x);
  const ideas=await getRankedIdeas().catch(()=>null);
  const scored=baseRows.map(x=>{const m=manualCandidateScoreV2664(x);return {x,m,cls:manualCandidateBlockClassV2665(x,m),formal:manualCandidateFormalVisibleV2665(x,m),band:manualCandidateBandV2665(x,m)}});
  const rejects=manualCandidateRejectSummaryV2665(baseRows);
  const visibleA=rows.filter(x=>String(x.grade||'')==='A'&&manualCandidateFormalVisibleV2665(x,manualCandidateScoreV2664(x))).length;
  const visibleB=rows.filter(x=>String(x.grade||'')==='B'&&manualCandidateFormalVisibleV2665(x,manualCandidateScoreV2664(x))).length;
  const pipeline={
    analyzed:Number(ideas?.analyzed||0),
    ranked:baseRows.length,
    hardSafe:scored.filter(v=>v.cls.hard.length===0).length,
    hardBlocked:scored.filter(v=>v.cls.hard.length>0).length,
    softWaiting:scored.filter(v=>v.cls.hard.length===0&&v.cls.soft.length>0).length,
    formalA:visibleA,formalB:visibleB,
    candidate:candidates.length,
    prime:scored.filter(v=>v.band==='PRIME').length,
    watch:scored.filter(v=>v.band==='WATCH').length,
    relative:scored.filter(v=>v.band==='RELATIVE').length,
    topRejects:rejects.hard,
    topWaits:rejects.soft,
    radar:ideas?.radar||null
  };
  return {
    ...base,
    version:'V2.6.65',
    methodology:'A/B 絕對門檻不硬放寬；候選改為安全層後的相對排名。BLOCKED 拆硬風險與等待型阻擋；低量、價差/ADL/Funding/跨所逆向、BTC/ETH逆向、清算弱山寨、結構破壞、RR<1、明顯負期望仍硬淘汰。候選最多5個，不自動通知；當阻擋解除並升回正式 A/B 才進通知。',
    counts:{...(base?.counts||{}),A:visibleA,B:visibleB,C:rows.filter(x=>String(x.grade||'')==='C'&&x.candidate!==true).length,candidate:candidates.length},
    pipeline,
    rows
  };
}
`;

const RUNTIME_RENDER=String.raw`
function pipelineLine(p,rows){
  const a=Number(p?.formalA||0),b=Number(p?.formalB||0);
  const parts=[];
  if(Number.isFinite(Number(p?.analyzed))&&Number(p.analyzed)>0)parts.push('深析 '+Number(p.analyzed));
  parts.push('排名 '+Number(p?.ranked||0));
  parts.push('安全 '+Number(p?.hardSafe||0));
  parts.push('A/B '+(a+b));
  parts.push('候選 '+rows.length);
  return parts.join(' → ');
}
function render(){
  const h=ensureHost();if(!h||!data)return;
  const rows=(data.rows||[]).filter(x=>x?.candidate===true&&x?.trade?.status!=='ACTIVE').slice(0,5);
  const p=data.pipeline||{},line=pipelineLine(p,rows),rejects=Array.isArray(p.topRejects)?p.topRejects.slice(0,3):[];
  const rejectText=rejects.map(x=>esc(x.reason)+' '+Number(x.count||0)).join(' · ');
  const sig=JSON.stringify([rows.map(x=>[
    keyOf(x),Math.round(Number(x.candidateScore||0)),Number(x.candidateWinRate||0).toFixed(1),
    x.candidateBand,x.structure?.state,x.trackerStatus,(x.formalGap?.toB||[]).join('|'),(x.formalGap?.toA||[]).join('|')
  ]),line,rejectText]);
  if(sig===lastSig&&h.querySelector('.candidate-list-v2664'))return;
  lastSig=sig;
  h.innerHTML='<summary><div><b>候選</b><span>'+rows.length+'</span></div><small>'+esc(line)+' · Shadow 安全層後相對排名</small><i>⌄</i></summary>'+
    '<div class="mw-list candidate-list-v2664">'+
      (rows.length?rows.map(card).join(''):'<div class="mw-empty">本輪沒有通過「安全層」的候選，不是靜默消失。'+esc(line)+(rejectText?' · 主要淘汰：'+rejectText:'')+'</div>')+
    '</div>';
}
`;

function patchCandidateRuntime(){
  const file=path.join(__dirname,'public','manual-candidate-v2664.js');
  if(!fs.existsSync(file))throw new Error('[candidate-v2665] candidate runtime missing; ManualAB must run first');
  let js=fs.readFileSync(file,'utf8');
  if(!js.includes('CANDIDATE_RECALL_RUNTIME_V2665')){
    js=replaceFunction(js,'render',RUNTIME_RENDER);
    js=js.replace("const VERSION='2.6.64';","const VERSION='2.6.65';");
    js='/* CANDIDATE_RECALL_RUNTIME_V2665 */\n'+js;
    writeChecked(file,js,'candidate runtime');
  }
  const idx=path.join(__dirname,'public','index.html');
  if(fs.existsSync(idx)){
    let h=fs.readFileSync(idx,'utf8');
    h=h.replace(/\/manual-candidate-v2664\.js\?v=[^"'<>]+/g,'/manual-candidate-v2664.js?v=2665-0904');
    fs.writeFileSync(idx,h,'utf8');
  }
}

export function patchCandidateRecallV2665({serverPath=path.join(__dirname,'server.js')}={}){
  if(!fs.existsSync(serverPath))throw new Error('[candidate-v2665] server.js missing');
  let src=fs.readFileSync(serverPath,'utf8');
  if(src.includes(MARKER)){
    patchCandidateRuntime();
    return {changed:false,reason:'already-applied',candidateMax:5,pipeline:true,notificationGate:true};
  }
  if(!src.includes(BASE_MARKER)||!src.includes('manualStableCandidatesV2664'))throw new Error('[candidate-v2665] V2.6.64 ManualAB base missing');

  src=replaceOnce(src,'const MANUAL_CANDIDATE_MAX_V2664=3;','const MANUAL_CANDIDATE_MAX_V2664=5;','candidate max');
  src=replaceOnce(src,'const MANUAL_CANDIDATE_MIN_SCORE_V2664=68;','const MANUAL_CANDIDATE_MIN_SCORE_V2664=59;','candidate score floor');
  src=replaceOnce(src,'const MANUAL_CANDIDATE_MIN_WIN_V2664=60;','const MANUAL_CANDIDATE_MIN_WIN_V2664=53;','candidate win floor');
  src=replaceOnce(src,'const MANUAL_CANDIDATE_HARD_FLOOR_V2664=55;','const MANUAL_CANDIDATE_HARD_FLOOR_V2664=52;','candidate hard floor');
  src=replaceOnce(src,'const MANUAL_CANDIDATE_HOLD_MS_V2664=20*60*1000;','const MANUAL_CANDIDATE_HOLD_MS_V2664=15*60*1000;','candidate hold');
  src=replaceOnce(src,'const MANUAL_CANDIDATE_MISS_MS_V2664=8*60*1000;','const MANUAL_CANDIDATE_MISS_MS_V2664=10*60*1000;','candidate miss');
  src=replaceOnce(src,'const MANUAL_CANDIDATE_REPLACE_EDGE_V2664=6;','const MANUAL_CANDIDATE_REPLACE_EDGE_V2664=4;','candidate replace edge');

  const returnNeedle='id,grade,trackerStatus:status,executionConfirmed,reentryReady,monitorState:monitor,chaseAtr:manualFinite(lc.chaseAtr),blockers:blockers.slice(0,6),executionScore:score,generatedAt:';
  const returnNew='id,grade,quoteVolume:manualFinite(idea.quoteVolume),fundingPct:manualFinite(idea.fundingPct),marketMetrics:idea.metrics||null,trackerStatus:status,executionConfirmed,reentryReady,monitorState:monitor,chaseAtr:manualFinite(lc.chaseAtr),blockers:blockers.slice(0,6),executionScore:score,generatedAt:';
  src=replaceOnce(src,returnNeedle,returnNew,'market evidence exposure');

  src=replaceFunction(src,'manualCandidateScoreV2664',SCORE_FN);
  src=replaceFunction(src,'manualCandidateHardInvalidV2664',HARD_FN);
  src=replaceFunction(src,'manualCandidateQualifiedV2664',QUALIFIED_FN);
  src=replaceFunction(src,'manualCandidateDecorateV2664',DECORATE_FN);
  src=replaceFunction(src,'manualStableCandidatesV2664',STABLE_FN);
  src=replaceFunction(src,'manualOpportunityResponse',RESPONSE_FN);

  src=replaceOnce(src,'for(const row of data.rows.slice(0,8)){','for(const row of data.rows.slice(0,12)){','manual notification scan depth');
  const notifyOld="if(!manualPrefAllows(pref,row.grade)||row.freshness==='STALE'||row.trade?.status==='ACTIVE')continue;";
  const notifyNew='if(!manualNotificationEligibleV2665(pref,row))continue;';
  src=replaceOnce(src,notifyOld,notifyNew,'manual notification safety gate');

  src=`// ${MARKER}\n${src}`;
  writeChecked(serverPath,src,'server.js');
  patchCandidateRuntime();
  return {
    changed:true,
    version:'V2.6.65',
    candidateMax:5,
    relativeRecall:true,
    hardSoftBlockers:true,
    zeroResultDiagnostics:true,
    notificationGate:true,
    shadowWeighted:true
  };
}

if(import.meta.url===`file://${process.argv[1]}`)console.log(patchCandidateRecallV2665());
