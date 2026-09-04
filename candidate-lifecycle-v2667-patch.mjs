import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='CANDIDATE_LIFECYCLE_V2667_20260904';
const BASE_MARKER='MANUAL_CANDIDATE_RECALL_V2665_20260904';
const UI_MARKER='CANDIDATE_NARRATIVE_UI_V2666_20260904';

function check(file,label){
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(r.status!==0||r.error)throw new Error('[candidate-v2667] '+label+' syntax invalid: '+String(r.stderr||r.stdout||r.error?.message||'').trim());
}
function writeChecked(file,src,label){
  const tmp=file+'.v2667-'+process.pid+'-'+Date.now()+'.tmp.js';
  fs.writeFileSync(tmp,src,'utf8');
  try{check(tmp,label);fs.renameSync(tmp,file)}
  catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}
}
function functionRange(src,name){
  const starts=[src.indexOf('function '+name+'('),src.indexOf('async function '+name+'(')].filter(x=>x>=0);
  if(!starts.length)return null;
  const start=Math.min(...starts),brace=src.indexOf('{',start);
  if(brace<0)return null;
  let depth=0,quote=null,escape=false,lineComment=false,blockComment=false;
  for(let i=brace;i<src.length;i++){
    const ch=src[i],next=src[i+1];
    if(lineComment){if(ch==='\n')lineComment=false;continue}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++}continue}
    if(quote){
      if(escape){escape=false;continue}
      if(ch==='\\'){escape=true;continue}
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue}
    if(ch==="'"||ch==='"'){quote=ch;continue}
    if(ch==='{')depth++;
    else if(ch==='}'){depth--;if(depth===0)return {start,end:i+1}}
  }
  return null;
}
function replaceFunction(src,name,code){
  const r=functionRange(src,name);
  if(!r)throw new Error('[candidate-v2667] function missing: '+name);
  return src.slice(0,r.start)+code.trim()+src.slice(r.end);
}
function replaceOnce(src,oldText,newText,label){
  if(src.includes(newText))return src;
  if(!src.includes(oldText))throw new Error('[candidate-v2667] anchor missing: '+label);
  return src.replace(oldText,newText);
}

const ARCHIVE_HELPERS=String.raw`
const MANUAL_CANDIDATE_TTL_MS_V2667=30*60*1000;
const MANUAL_CANDIDATE_ARCHIVE_FILE_V2667=path.join(DATA_DIR,'manual-candidate-archive-v2667.json');
function manualCandidateArchiveRowsV2667(){
  const rows=loadJson(MANUAL_CANDIDATE_ARCHIVE_FILE_V2667,[]);
  return Array.isArray(rows)?rows:[];
}
function manualCandidateArchiveV2667(st,x,m,reason,details='',now=Date.now()){
  if(!st||!x)return;
  const selectedAt=Number(st.selectedAt||0),key=manualCandidateKeyV2664(x),archiveId=key+'|'+selectedAt;
  const rows=manualCandidateArchiveRowsV2667();
  if(rows.some(r=>r?.archiveId===archiveId))return;
  const cls=manualCandidateBlockClassV2665(x,m||manualCandidateScoreV2664(x));
  rows.unshift({
    archiveId,
    archivedAt:new Date(now).toISOString(),
    reason:String(reason||'EXPIRED'),
    details:String(details||'').slice(0,220),
    selectedAt:selectedAt?new Date(selectedAt).toISOString():null,
    durationMs:selectedAt?Math.max(0,now-selectedAt):null,
    symbol:x.symbol,
    direction:x.direction,
    candidateScore:Number(m?.score??x?.candidateScore??0),
    candidateWinRate:Number(m?.win??x?.candidateWinRate??0),
    candidateBand:String(st.band||x?.candidateBand||'WATCH'),
    originalGrade:String(x?.grade||x?.originalGrade||'C'),
    rank:Number(x?.rank||0),
    rankScore:Number(x?.rankScore||0),
    shadow:{
      sample:Number(x?.shadow?.sample||0),
      hitRate:manualFinite(x?.shadow?.hitRate),
      profitFactor:manualFinite(x?.shadow?.profitFactor),
      level:String(x?.shadow?.level||'')
    },
    structure:x?.structure?{
      state:String(x.structure.state||''),
      label:String(x.structure.label||''),
      health:manualFinite(x.structure.health)
    }:null,
    softWait:cls.soft.slice(0,6),
    hardBlockers:cls.hard.slice(0,6)
  });
  saveJson(MANUAL_CANDIDATE_ARCHIVE_FILE_V2667,rows.slice(0,500));
}
function manualCandidateArchiveReasonV2667(reason){
  return ({TTL_EXPIRED:'超過30分鐘未建倉，自動歸檔',BUILT:'已建立實際建倉追蹤',PROMOTED:'已升級正式 A/B',HARD_INVALID:'結構或風險硬失效'})[reason]||String(reason||'歸檔');
}
`;

const BLOCK_FN=String.raw`
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
  else if(qv!=null&&qv<20_000_000)push(soft,'流動性普通，需更嚴格等盤');
  const shN=Math.max(0,Number(x?.shadow?.sample||0)),shHit=manualFinite(x?.shadow?.hitRate),shPf=manualFinite(x?.shadow?.profitFactor);
  if(shN>=12&&((shPf!=null&&shPf<.75)||(shHit!=null&&shHit<40)))push(hard,'Shadow 同類樣本明顯負期望');
  else if(shN>=8&&shPf!=null&&shPf<.90)push(soft,'Shadow 同類 PF 偏弱');
  if(m?.win!=null&&Number(m.win)<52)push(hard,'候選校準勝率低於安全底線');

  const coverage=manualFinite(x?.dataHealth?.coverage),confidence=manualFinite(x?.dataHealth?.confidence);
  if(status==='NO_TRACKER'){
    push(soft,'等待完整 tracker 建立');
  }else{
    const age=Math.max(0,Number(x?.freshnessAgeMs||0));
    if(age>20*60_000)push(soft,'即時判讀已久，保留到候選自動歸檔');
    else if(age>5*60_000)push(soft,'即時判讀超過5分鐘，等待刷新');
    if(coverage!=null&&coverage<45)push(hard,'資料完整度過低');
    else if(coverage!=null&&coverage<72)push(soft,'資料完整度尚未達通知門檻');
    if(confidence!=null&&confidence<45)push(hard,'資料可信度過低');
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
  if(String(x?.notificationTier||'').toUpperCase()==='BLOCKED'&&!blockers.length)push(soft,'目前通知閘門未通過，先保留候選等待刷新');
  return {hard,soft};
}
`;

const DECORATE_FN=String.raw`
function manualCandidateDecorateV2664(x,st,m,now){
  const out={...x},cls=manualCandidateBlockClassV2665(x,m);
  let band=manualCandidateBandV2665(x,m);
  if(band==='DROP'&&st?.selected===true)band='COOLING';
  out.candidate=true;
  out.candidateKey=manualCandidateKeyV2664(x);
  out.candidateScore=m.score;
  out.candidateWinRate=m.win;
  out.candidateBand=band;
  out.candidateSince=st.selectedAt||st.firstSeen||now;
  out.candidateExpiresAt=(st.selectedAt||now)+MANUAL_CANDIDATE_TTL_MS_V2667;
  out.candidateRemainingMs=Math.max(0,out.candidateExpiresAt-now);
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
    if(!st)st={firstSeen:now,lastSeen:0,confirm:0,selected:false,selectedAt:0,snapshot:null,metric:null,band:null};
    const consecutive=st.lastSeen&&now-st.lastSeen<150000;
    st.confirm=consecutive?st.confirm+1:1;
    st.lastSeen=now;st.snapshot=x;st.metric=m;st.band=band;
    manualCandidateStateV2664.set(k,st);
  }

  for(const [k,st] of [...manualCandidateStateV2664]){
    const cur=current.get(k),x=cur?.row||st.snapshot,m=cur?.metric||st.metric;
    if(!st.selected){
      if(formal.has(k)||cur?.hardInvalid||now-(st.lastSeen||0)>2*60*60*1000)manualCandidateStateV2664.delete(k);
      continue;
    }
    if(!x||!m){manualCandidateStateV2664.delete(k);continue}

    if(x?.trade?.status==='ACTIVE'){
      manualCandidateArchiveV2667(st,x,m,'BUILT','使用者已建立實際建倉追蹤',now);
      manualCandidateStateV2664.delete(k);
      continue;
    }
    if(formal.has(k)){
      manualCandidateArchiveV2667(st,x,m,'PROMOTED','候選升級為正式 '+String(x.grade||'A/B'),now);
      manualCandidateStateV2664.delete(k);
      continue;
    }
    if(cur?.hardInvalid){
      const cls=manualCandidateBlockClassV2665(x,m);
      manualCandidateArchiveV2667(st,x,m,'HARD_INVALID',cls.hard.slice(0,3).join(' / '),now);
      manualCandidateStateV2664.delete(k);
      continue;
    }
    if(now-Number(st.selectedAt||now)>=MANUAL_CANDIDATE_TTL_MS_V2667){
      manualCandidateArchiveV2667(st,x,m,'TTL_EXPIRED','30分鐘內未建倉、也未升級正式 A/B',now);
      manualCandidateStateV2664.delete(k);
      continue;
    }
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
    st.selected=true;st.selectedAt=now;manualCandidateStateV2664.set(k,st);
    selected.push([k,st]);
  }

  const output=[];
  for(const [k,st] of manualCandidateStateV2664){
    if(!st.selected||formal.has(k))continue;
    const cur=current.get(k),x=cur?.row||st.snapshot,m=cur?.metric||st.metric;
    if(!x||!m)continue;
    output.push(manualCandidateDecorateV2664(x,st,m,now));
  }
  output.sort((a,b)=>Number(a.candidateSince||0)-Number(b.candidateSince||0)||Number(b.candidateScore||0)-Number(a.candidateScore||0));
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
  for(const c of candidates)if(!rows.some(x=>manualCandidateKeyV2664(x)===c.candidateKey))rows.push(c);

  const ideas=await getRankedIdeas().catch(()=>null);
  const scored=baseRows.map(x=>{const m=manualCandidateScoreV2664(x);return {x,m,cls:manualCandidateBlockClassV2665(x,m),formal:manualCandidateFormalVisibleV2665(x,m),band:manualCandidateBandV2665(x,m)}});
  const rejects=manualCandidateRejectSummaryV2665(baseRows);
  const visibleA=rows.filter(x=>String(x.grade||'')==='A'&&manualCandidateFormalVisibleV2665(x,manualCandidateScoreV2664(x))).length;
  const visibleB=rows.filter(x=>String(x.grade||'')==='B'&&manualCandidateFormalVisibleV2665(x,manualCandidateScoreV2664(x))).length;
  const archive=manualCandidateArchiveRowsV2667();

  const pipeline={
    analyzed:Number(ideas?.analyzed||0),ranked:baseRows.length,
    hardSafe:scored.filter(v=>v.cls.hard.length===0).length,
    hardBlocked:scored.filter(v=>v.cls.hard.length>0).length,
    softWaiting:scored.filter(v=>v.cls.hard.length===0&&v.cls.soft.length>0).length,
    formalA:visibleA,formalB:visibleB,candidate:candidates.length,
    prime:scored.filter(v=>v.band==='PRIME').length,
    watch:scored.filter(v=>v.band==='WATCH').length,
    relative:scored.filter(v=>v.band==='RELATIVE').length,
    topRejects:rejects.hard,topWaits:rejects.soft,radar:ideas?.radar||null,
    candidateArchiveCount:archive.length,
    recentArchived:archive.slice(0,5)
  };
  return {
    ...base,
    version:'V2.6.67',
    methodology:'候選進入後固定生命週期30分鐘。資料短暫變舊、分數微降、單一軟阻擋不會讓它瞬間消失；只有建倉、升級正式A/B、真正硬失效或30分鐘到期才離開。未建倉到期會寫入後台 candidate archive，不當成勝負樣本。',
    counts:{...(base?.counts||{}),A:visibleA,B:visibleB,C:rows.filter(x=>String(x.grade||'')==='C'&&x.candidate!==true).length,candidate:candidates.length},
    pipeline,
    rows
  };
}
`;

const UI_HELPERS=String.raw`
function minsV2667(ms){return Math.max(0,Math.ceil(Number(ms||0)/60000))}
function observedV2667(x){return Math.max(0,Math.floor((Date.now()-Number(x?.candidateSince||Date.now()))/60000))}
function candidateMetaV2667(x){
  const left=zhBandV2666(x),structure=String(x?.structure?.label||'等待結構'),obs=observedV2667(x),remain=minsV2667(x?.candidateRemainingMs);
  return '<div class="candidate-meta-v2667"><span>'+esc(left)+'</span><span>'+esc(structure)+'</span></div>'+
    '<div class="candidate-meta-v2667 sub"><span>已觀察 '+obs+' 分</span><span>'+remain+' 分後自動歸檔</span></div>';
}
`;

const UI_BAND_FN=String.raw`
function zhBandV2666(x){
  const b=String(x?.candidateBand||'WATCH');
  return b==='PRIME'?'優先候選':b==='RELATIVE'?'相對候選':b==='COOLING'?'降溫候選':'觀察候選';
}
`;

const UI_CARD_FN=String.raw`
function card(x){
  const id=keyOf(x),s=x.structure||{},ev=x.candidateEvidence||{},g=x.formalGap||{},open=opens()[id]===true;
  const soft=Array.isArray(x.candidateSoftWait)?x.candidateSoftWait:[],hard=Array.isArray(x.candidateHardBlockers)?x.candidateHardBlockers:[];
  const sh=shadowQualityV2666(x),current=currentTextV2666(x),forecast=forecastTextV2666(x),advice=adviceTextV2666(x);
  const currentPx=n(x?.entry?.currentPrice);
  return '<article class="mw-card mw-candidate-card-v2664 candidate-narrative-v2666 candidate-v2667" data-candidate-id="'+esc(id)+'">'+
    '<details '+(open?'open':'')+'>'+
      '<summary>'+
        '<span class="mw-grade candidate">候</span>'+
        '<div class="mw-main candidate-main-v2667">'+
          '<div class="candidate-title-v2667"><a href="'+tvUrl(x.symbol)+'" target="_blank" rel="noopener">'+esc(x.symbol)+'</a><em class="'+(x.direction==='SHORT'?'short':'long')+'">'+(x.direction==='SHORT'?'做空':'做多')+'</em></div>'+
          candidateMetaV2667(x)+
        '</div>'+
        '<div class="mw-score candidate-score"><b>'+pct(x.candidateWinRate)+'</b><span>候選勝率</span></div>'+
        '<i class="mw-chevron">⌄</i>'+
      '</summary>'+
      '<div class="mw-body">'+
        '<div class="candidate-topline-v2666">'+
          '<div><span>Shadow 共識</span><b>'+Math.round(Number(x.candidateScore||0))+' 分</b></div>'+
          '<div><span>目前價格</span><b>'+(currentPx==null?'—':px(currentPx))+'</b></div>'+
          '<div><span>同類樣本</span><b>'+Number(ev.shadowSample||0)+' 筆</b></div>'+
          '<div><span>同類 PF</span><b>'+(n(ev.shadowProfitFactor)==null?'—':Number(ev.shadowProfitFactor).toFixed(2))+'</b></div>'+
        '</div>'+
        '<div class="candidate-shadow-read-v2666 '+sh.tone+'"><b>Shadow 怎麼看</b><p>'+esc(sh.text)+'</p></div>'+
        '<div class="candidate-analysis-grid-v2666">'+
          '<section><b>目前狀況</b><p>'+esc(current)+'</p></section>'+
          '<section><b>預計</b><p>'+esc(forecast)+'</p></section>'+
          '<section class="advice"><b>建議</b><p>'+esc(advice)+'</p></section>'+
        '</div>'+
        '<div class="candidate-why-v2666">'+
          '<div><b>還沒變正式 B 的原因</b>'+list((g.toB||[]).slice(0,4),'主要只差即時條件再確認','gap')+'</div>'+
          '<div><b>還沒變正式 A 的原因</b>'+list((g.toA||[]).slice(0,5),'A 級條件已接近完整','gap')+'</div>'+
        '</div>'+
        (soft.length?'<div class="candidate-wait-v2666"><b>目前等待</b><p>'+esc(soft.slice(0,3).join('、'))+'</p></div>':'')+
        (hard.length?'<div class="candidate-hard-v2666"><b>硬阻擋</b><p>'+esc(hard.slice(0,3).join('、'))+'</p></div>':'')+
      '</div>'+
    '</details>'+
  '</article>';
}
`;

const UI_RENDER_FN=String.raw`
function render(){
  const h=ensureHost();if(!h||!data)return;
  const rows=(data.rows||[]).filter(x=>x?.candidate===true&&x?.trade?.status!=='ACTIVE').slice(0,5);
  const p=data.pipeline||{},line=pipelineLine(p,rows),rejects=Array.isArray(p.topRejects)?p.topRejects.slice(0,3):[];
  const rejectText=rejects.map(x=>esc(x.reason)+' '+Number(x.count||0)).join(' · ');
  const sig=JSON.stringify([rows.map(x=>[
    keyOf(x),Math.round(Number(x.candidateScore||0)),Number(x.candidateWinRate||0).toFixed(1),
    x.candidateBand,Math.ceil(Number(x.candidateRemainingMs||0)/60000),x.structure?.state,x.trackerStatus
  ]),line,rejectText]);
  if(sig===lastSig&&h.querySelector('.candidate-list-v2664'))return;
  lastSig=sig;

  h.innerHTML=
    '<summary class="candidate-group-summary-v2667">'+
      '<div class="candidate-group-title-v2667"><b>候選</b><span>'+rows.length+'</span></div>'+
      '<div class="candidate-group-copy-v2667"><strong>Shadow 目前最有機會</strong><small>'+esc(line)+'</small></div>'+
      '<i>⌄</i>'+
    '</summary>'+
    '<div class="mw-list candidate-list-v2664">'+
      (rows.length?rows.map(card).join(''):'<div class="mw-empty">本輪沒有正在有效期內的候選。'+esc(line)+(rejectText?' · 主要淘汰：'+rejectText:'')+'</div>')+
    '</div>';
}
`;

const UI_CSS=String.raw`
/* CANDIDATE_LIFECYCLE_V2667_20260904 */
.mw-candidate-group-v2664>.candidate-group-summary-v2667{
  display:grid!important;
  grid-template-columns:auto minmax(0,1fr) 16px!important;
  gap:12px!important;
  align-items:center!important;
  padding:13px 15px!important;
}
.candidate-group-title-v2667{
  display:flex!important;
  align-items:center!important;
  gap:8px!important;
}
.candidate-group-title-v2667 b{font-size:17px!important;line-height:1.2!important}
.candidate-group-title-v2667 span{
  min-width:24px!important;height:24px!important;
  display:grid!important;place-items:center!important;
  border-radius:8px!important;background:#2c4250!important;
  color:#d8e7f1!important;font-size:13px!important;font-weight:800!important;
}
.candidate-group-copy-v2667{min-width:0!important;display:grid!important;gap:3px!important}
.candidate-group-copy-v2667 strong{
  color:#c8d8e4!important;font-size:13.5px!important;line-height:1.35!important;
  white-space:normal!important;
}
.candidate-group-copy-v2667 small{
  color:#8f9aa1!important;font-size:12.5px!important;line-height:1.45!important;
  white-space:normal!important;overflow:visible!important;text-overflow:clip!important;
}
.candidate-v2667 summary{
  display:grid!important;
  grid-template-columns:38px minmax(0,1fr) 82px 14px!important;
  gap:12px!important;
  align-items:center!important;
  padding:14px 14px!important;
}
.candidate-main-v2667{min-width:0!important}
.candidate-title-v2667{display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:wrap!important}
.candidate-title-v2667 a{font-size:22px!important;line-height:1.1!important}
.candidate-title-v2667 em{font-size:12px!important}
.candidate-meta-v2667{
  display:flex!important;
  flex-wrap:wrap!important;
  gap:6px 10px!important;
  margin-top:7px!important;
  color:#b4bec4!important;
  font-size:13.5px!important;
  line-height:1.45!important;
  white-space:normal!important;
}
.candidate-meta-v2667.sub{
  margin-top:2px!important;
  color:#87949c!important;
  font-size:12.5px!important;
}
.candidate-meta-v2667 span{
  position:relative!important;
  white-space:normal!important;
}
.candidate-meta-v2667 span+span::before{
  content:"·";
  position:absolute;
  left:-7px;
  color:#5f6d76;
}
.candidate-v2667 .candidate-score{
  min-width:0!important;text-align:right!important;
}
.candidate-v2667 .candidate-score b{font-size:20px!important}
.candidate-v2667 .candidate-score span{
  display:block!important;margin-top:3px!important;
  font-size:12px!important;line-height:1.25!important;
}
.candidate-v2667 .candidate-topline-v2666 span{font-size:13px!important}
.candidate-v2667 .candidate-topline-v2666 b{font-size:19px!important}
.candidate-v2667 .candidate-shadow-read-v2666>b{font-size:15px!important}
.candidate-v2667 .candidate-shadow-read-v2666 p{font-size:16px!important;line-height:1.72!important}
.candidate-v2667 .candidate-analysis-grid-v2666 section>b{font-size:17px!important}
.candidate-v2667 .candidate-analysis-grid-v2666 section p{font-size:17px!important;line-height:1.72!important}
.candidate-v2667 .candidate-why-v2666 b{font-size:14.5px!important}
.candidate-v2667 .candidate-why-v2666 span{font-size:14px!important;line-height:1.58!important}
@media(max-width:520px){
  .candidate-v2667 summary{
    grid-template-columns:36px minmax(0,1fr) 70px 12px!important;
    gap:9px!important;padding:13px 11px!important;
  }
  .candidate-title-v2667 a{font-size:20px!important}
  .candidate-meta-v2667{font-size:13px!important;gap:5px 9px!important}
  .candidate-meta-v2667.sub{font-size:12px!important}
  .candidate-v2667 .candidate-score b{font-size:18px!important}
  .candidate-v2667 .candidate-analysis-grid-v2666 section p{font-size:16px!important}
  .mw-candidate-group-v2664>.candidate-group-summary-v2667{
    grid-template-columns:auto minmax(0,1fr) 12px!important;
    gap:10px!important;padding:12px!important;
  }
}
`;

function patchServer(){
  const file=path.join(__dirname,'server.js');
  if(!fs.existsSync(file))throw new Error('[candidate-v2667] server.js missing');
  let src=fs.readFileSync(file,'utf8');
  if(src.includes(MARKER))return false;
  if(!src.includes(BASE_MARKER)||!src.includes('manualCandidateBlockClassV2665'))throw new Error('[candidate-v2667] V2665 candidate recall missing');

  const blockPos=src.indexOf('function manualCandidateBlockClassV2665(');
  if(blockPos<0)throw new Error('[candidate-v2667] blocker function missing');
  src=src.slice(0,blockPos)+ARCHIVE_HELPERS.trim()+'\n'+src.slice(blockPos);

  src=replaceFunction(src,'manualCandidateBlockClassV2665',BLOCK_FN);
  src=replaceFunction(src,'manualCandidateDecorateV2664',DECORATE_FN);
  src=replaceFunction(src,'manualStableCandidatesV2664',STABLE_FN);
  src=replaceFunction(src,'manualOpportunityResponse',RESPONSE_FN);

  if(!src.includes("app.get('/api/manual-candidate-archive'")){
    const anchor="app.get('/api/manual-opportunities'";
    const pos=src.indexOf(anchor);
    if(pos<0)throw new Error('[candidate-v2667] manual opportunities route missing');
    const route=`app.get('/api/manual-candidate-archive',(_req,res)=>res.json({ok:true,version:'V2.6.67',rows:manualCandidateArchiveRowsV2667()}));\n`;
    src=src.slice(0,pos)+route+src.slice(pos);
  }

  src='// '+MARKER+'\n'+src;
  writeChecked(file,src,'server.js');
  return true;
}
function patchRuntime(){
  const jsPath=path.join(__dirname,'public','manual-candidate-v2664.js');
  const cssPath=path.join(__dirname,'public','manual-candidate-v2664.css');
  const htmlPath=path.join(__dirname,'public','index.html');
  if(!fs.existsSync(jsPath))throw new Error('[candidate-v2667] candidate runtime missing');
  let js=fs.readFileSync(jsPath,'utf8');
  if(!js.includes(UI_MARKER))throw new Error('[candidate-v2667] V2666 narrative UI missing');
  if(!js.includes(MARKER)){
    const bandRange=functionRange(js,'zhBandV2666');
    if(!bandRange)throw new Error('[candidate-v2667] zhBandV2666 missing');
    js=js.slice(0,bandRange.start)+UI_BAND_FN.trim()+js.slice(bandRange.end);

    const cardPos=js.indexOf('function card(');
    if(cardPos<0)throw new Error('[candidate-v2667] card renderer missing');
    js=js.slice(0,cardPos)+UI_HELPERS.trim()+'\n'+js.slice(cardPos);

    js=replaceFunction(js,'card',UI_CARD_FN);
    js=replaceFunction(js,'render',UI_RENDER_FN);
    js=js.replace("const VERSION='2.6.66';","const VERSION='2.6.67';");
    js='/* '+MARKER+' */\n'+js;
    writeChecked(jsPath,js,'candidate runtime');
  }

  let css=fs.existsSync(cssPath)?fs.readFileSync(cssPath,'utf8'):'';
  if(!css.includes(MARKER)){css+='\n'+UI_CSS+'\n';fs.writeFileSync(cssPath,css,'utf8')}

  if(fs.existsSync(htmlPath)){
    let h=fs.readFileSync(htmlPath,'utf8');
    h=h.replace(/\/manual-candidate-v2664\.js\?v=[^"'<>]+/g,'/manual-candidate-v2664.js?v=2667-0904');
    h=h.replace(/\/manual-candidate-v2664\.css\?v=[^"'<>]+/g,'/manual-candidate-v2664.css?v=2667-0904');
    fs.writeFileSync(htmlPath,h,'utf8');
  }
  return true;
}
export function patchCandidateLifecycleV2667(){
  const server=patchServer(),runtime=patchRuntime();
  return {changed:Boolean(server||runtime),version:'V2.6.67',ttlMinutes:30,archive:true,stableUntilExpiry:true,uiTwoLine:true};
}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchCandidateLifecycleV2667());
