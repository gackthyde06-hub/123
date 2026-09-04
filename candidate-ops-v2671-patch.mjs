import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='CANDIDATE_OPS_HISTORY_TRADE_V2671_20260904';
const BASE='CANDIDATE_REAL_RECALL_FIX_V2670_20260904';

function check(file,label){
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(r.status!==0||r.error)throw new Error(`[candidate-v2671] ${label} syntax invalid: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`);
}
function writeChecked(file,src,label){
  const tmp=`${file}.v2671-${process.pid}-${Date.now()}.tmp.js`;
  fs.writeFileSync(tmp,src,'utf8');
  try{check(tmp,label);fs.renameSync(tmp,file)}
  catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}
}
function functionRange(src,name){
  const starts=[src.indexOf(`async function ${name}(`),src.indexOf(`function ${name}(`)].filter(x=>x>=0);
  if(!starts.length)return null;
  const start=Math.min(...starts),brace=src.indexOf('{',start);
  if(brace<0)return null;
  let depth=0,quote=null,escape=false,lineComment=false,blockComment=false,templateExpr=0;
  for(let i=brace;i<src.length;i++){
    const ch=src[i],next=src[i+1];
    if(lineComment){if(ch==='\n')lineComment=false;continue}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++;}continue}
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
  if(!r)throw new Error(`[candidate-v2671] function missing: ${name}`);
  return src.slice(0,r.start)+code.trim()+src.slice(r.end);
}
function insertBeforeLastClosure(src,code){
  const i=src.lastIndexOf('})();');
  if(i<0)throw new Error('[candidate-v2671] candidate runtime closure missing');
  return src.slice(0,i)+code.trim()+'\n'+src.slice(i);
}

const SERVER_HELPERS=String.raw`
const MANUAL_CANDIDATE_SKIP_FILE_V2671=path.join(DATA_DIR,'manual-candidate-skip-v2671.json');
const MANUAL_CANDIDATE_SKIP_MS_V2671=60*60*1000;
const MANUAL_CANDIDATE_BACKEND_RETENTION_MS_V2671=7*24*60*60*1000;
const MANUAL_CANDIDATE_VISIBLE_HISTORY_MS_V2671=24*60*60*1000;

function manualCandidateSkipRowsV2671(){
  const raw=loadJson(MANUAL_CANDIDATE_SKIP_FILE_V2671,{});
  const now=Date.now(),out={};
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
    for(const [k,v] of Object.entries(raw)){
      const until=Number(v?.until||v||0);
      if(until>now)out[k]={until,at:Number(v?.at||0),reason:String(v?.reason||'MANUAL_DISMISS')};
    }
  }
  return out;
}
function manualCandidateSaveSkipsV2671(rows){saveJson(MANUAL_CANDIDATE_SKIP_FILE_V2671,rows)}
function manualCandidateSkipKeyV2671(key,reason='MANUAL_DISMISS',ms=MANUAL_CANDIDATE_SKIP_MS_V2671){
  const rows=manualCandidateSkipRowsV2671(),now=Date.now();
  rows[String(key)]={at:now,until:now+Math.max(60_000,Number(ms)||MANUAL_CANDIDATE_SKIP_MS_V2671),reason};
  manualCandidateSaveSkipsV2671(rows);
}
function manualCandidateUnskipV2671(key){
  const rows=manualCandidateSkipRowsV2671();delete rows[String(key)];manualCandidateSaveSkipsV2671(rows);
}
function manualCandidateIsSkippedV2671(x){
  const key=typeof x==='string'?x:manualCandidateKeyV2664(x);
  return Boolean(manualCandidateSkipRowsV2671()[String(key)]);
}
function manualCandidateHistoryRowsV2671(){
  const now=Date.now();
  return manualCandidateArchiveRowsV2667()
    .filter(r=>{const t=new Date(r?.archivedAt||0).getTime();return Number.isFinite(t)&&now-t<=MANUAL_CANDIDATE_VISIBLE_HISTORY_MS_V2671})
    .slice(0,80)
    .map(r=>({...r,candidateKey:manualCandidateKeyV2664(r)}));
}
function manualCandidateFallbackArchiveV2671(body,now=Date.now()){
  const s=body?.snapshot&&typeof body.snapshot==='object'?body.snapshot:{};
  const x={
    symbol:String(body?.symbol||s.symbol||'').toUpperCase(),
    direction:String(body?.direction||s.direction||'LONG').toUpperCase(),
    grade:String(s.originalGrade||s.grade||'C').toUpperCase(),
    originalGrade:String(s.originalGrade||s.grade||'C').toUpperCase(),
    candidateBand:String(s.candidateBand||'WATCH'),
    rank:Number(s.rank||0),rankScore:Number(s.rankScore||0),
    candidateScore:Number(s.candidateScore||0),candidateWinRate:Number(s.candidateWinRate||0),
    shadow:s.shadow||{},structure:s.structure||null,
    blockers:[],candidateSoftWait:Array.isArray(s.softWait)?s.softWait:[],
    trackerStatus:'NO_TRACKER',notificationTier:'BLOCKED',
    quoteVolume:Number(s.quoteVolume||0)||null
  };
  if(!x.symbol)return false;
  const m={score:Number(s.candidateScore||0),win:Number(s.candidateWinRate||0)};
  const st={selectedAt:now,firstSeen:now,lastSeen:now,band:x.candidateBand};
  manualCandidateArchiveV2667(st,x,m,'MANUAL_DISMISS','使用者主動移出候選',now);
  return true;
}
`;

const ARCHIVE_ROWS_FN=String.raw`
function manualCandidateArchiveRowsV2667(){
  const rows=loadJson(MANUAL_CANDIDATE_ARCHIVE_FILE_V2667,[]);
  if(!Array.isArray(rows))return [];
  const now=Date.now(),ttl=typeof MANUAL_CANDIDATE_BACKEND_RETENTION_MS_V2671==='number'?MANUAL_CANDIDATE_BACKEND_RETENTION_MS_V2671:7*24*60*60*1000;
  return rows
    .filter(r=>{const t=new Date(r?.archivedAt||0).getTime();return Number.isFinite(t)&&now-t<=ttl})
    .sort((a,b)=>new Date(b?.archivedAt||0).getTime()-new Date(a?.archivedAt||0).getTime())
    .slice(0,300);
}
`;

const BAND_FN=String.raw`
function manualCandidateBandV2665(x,m){
  if(!x||manualCandidateBlockClassV2665(x,m).hard.length)return 'DROP';
  if(manualCandidateFormalVisibleV2665(x,m))return 'FORMAL';
  if(typeof manualCandidateIsSkippedV2671==='function'&&manualCandidateIsSkippedV2671(x))return 'DROP';

  const cal=manualFinite(x?.calibratedWinRate)??manualFinite(x?.estimatedWinRate)??0;
  const rank=Number(x?.rank||99),rankScore=Number(x?.rankScore||0),sample=Math.max(0,Number(x?.shadow?.sample||0));

  if(m.score>=66&&m.win>=57&&(sample>=6||cal>=60))return 'PRIME';
  if(m.score>=59&&m.win>=53&&(rank<=18||rankScore>=60||cal>=56||sample>=6))return 'WATCH';
  if(m.score>=54&&m.win>=50&&(rank<=24||rankScore>=52))return 'RELATIVE';
  if(rank<=15&&m.score>=50&&m.win>=48)return 'RESEARCH';
  if(rank<=8&&m.score>=48&&m.win>=47)return 'RESEARCH';
  return 'DROP';
}
`;

const UI_HELPERS=String.raw`
const CANDIDATE_DRAFT_KEY_V2671='candidate-trade-draft-v2671';
const CANDIDATE_REFRESH_MS_V2671=90*1000;
const CANDIDATE_FORCE_REFRESH_MS_V2671=5*60*1000;
let candidateHistoryV2671=[],candidateHistoryBusyV2671=false,candidateLastForceV2671=0,candidateAutoTimerV2671=null;

function candObjV2671(k,f={}){try{const x=JSON.parse(localStorage.getItem(k)||'null');return x&&typeof x==='object'&&!Array.isArray(x)?x:f}catch{return f}}
function candWriteV2671(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
function candDraftV2671(id){return candObjV2671(CANDIDATE_DRAFT_KEY_V2671,{})[String(id)]||{}}
function candDraftValV2671(id,k,f=''){const d=candDraftV2671(id);return Object.prototype.hasOwnProperty.call(d,k)?d[k]:(f??'')}
function candSaveDraftV2671(id,k,v){const all=candObjV2671(CANDIDATE_DRAFT_KEY_V2671,{});all[String(id)]={...(all[String(id)]||{}),[k]:v};const entries=Object.entries(all).slice(-40);candWriteV2671(CANDIDATE_DRAFT_KEY_V2671,Object.fromEntries(entries))}
function candClearDraftV2671(id){const all=candObjV2671(CANDIDATE_DRAFT_KEY_V2671,{});delete all[String(id)];candWriteV2671(CANDIDATE_DRAFT_KEY_V2671,all)}
async function candJsonV2671(url,opt={}){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);
  try{const r=await fetch(url,{cache:'no-store',signal:c.signal,...opt}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||('HTTP '+r.status));return d}finally{clearTimeout(t)}
}
function candMetricV2671(x){
  const mm=x?.marketMetrics||{},dir=String(x?.direction||'LONG')==='SHORT'?-1:1;
  const vr=n(mm.volumeRatio),taker=n(mm.takerRatio),top=n(mm.topRatio),fund=n(x?.fundingPct),health=n(x?.structure?.health);
  const align=v=>v==null?null:(v-1)*dir;
  return {vr,taker,top,fund,health,takerA:align(taker),topA:align(top)};
}
function candMetricTextV2671(x){
  const m=candMetricV2671(x),parts=[];
  if(m.vr!=null)parts.push('量比 '+m.vr.toFixed(2)+'×');
  if(m.taker!=null)parts.push('主動買賣 '+m.taker.toFixed(2));
  if(m.top!=null)parts.push('大戶比 '+m.top.toFixed(2));
  if(m.fund!=null)parts.push('資金費 '+m.fund.toFixed(4)+'%');
  return parts.length?parts.join(' · '):'即時資金細項仍在補資料';
}
function currentTextV2671(x){
  const s=x?.structure||{},st=String(s.state||'UNKNOWN'),dir=zhDirV2666(x),score=Math.round(Number(x.candidateScore||0)),win=pct(x.candidateWinRate),ev=x?.candidateEvidence||{};
  const health=n(s.health),sample=Number(ev.shadowSample||0),hit=n(ev.shadowHitRate),pf=n(ev.shadowProfitFactor);
  let state='目前屬於'+dir+'候選。';
  if(st==='INTACT')state='結構完整，'+dir+'目前仍佔優。';
  else if(st==='RECLAIMING')state='結構正在收復，'+dir+'有改善，但還沒正式確認。';
  else if(st==='DAMAGED')state='結構受損，現在是觀察型，不適合急著追。';
  else if(st==='OPPORTUNITY')state='目前在機會區附近，方向有條件但仍要等確認。';
  const stat='Shadow '+score+'分 / 候選勝率 '+win+(health!=null?' / 結構 '+Math.round(health):'')+'。';
  const hist=sample>0?'同類 '+sample+'筆'+(hit!=null?'，命中 '+hit.toFixed(1)+'%':'')+(pf!=null?'，PF '+pf.toFixed(2):'')+'。':'同類 Shadow 樣本還少。';
  return state+'\n'+stat+' '+hist;
}
function forecastTextV2666(x){
  const m=candMetricV2671(x),soft=Array.isArray(x?.candidateSoftWait)?x.candidateSoftWait:[],band=String(x?.candidateBand||'WATCH'),dir=zhDirV2666(x);
  let aligned=0,against=0;
  if(m.vr!=null){if(m.vr>=1.15)aligned++;else if(m.vr<.75)against++}
  if(m.takerA!=null){if(m.takerA>=.03)aligned++;else if(m.takerA<=-.05)against++}
  if(m.topA!=null){if(m.topA>=.03)aligned++;else if(m.topA<=-.06)against++}
  if(m.health!=null){if(m.health>=68)aligned++;else if(m.health<48)against++}

  let next='';
  if(aligned>=3&&against===0)next='下一步偏向延續 '+dir+' 優勢；真正值得看的不是追價，而是量能與主動盤能不能繼續同向。';
  else if(against>=2)next='下一步比較像先震盪或回踩，現在的優勢不夠乾淨；如果逆向資金再增加，候選順位應該會往下掉。';
  else if(band==='RESEARCH')next='目前只是研究候選，下一步先等一個明確加分：結構轉強、量能放大、主動盤同向，至少出現其中一項。';
  else next='目前多空證據還在拉扯，下一步最可能先整理；要升 B/A，需要即時資金與結構同時補強。';

  const wait=soft.find(v=>/15分|30分|1小時|tracker|Structure|資料|回踩|轉弱/.test(String(v)))||soft[0]||'等待即時結構與資金再確認';
  return next+'\n'+candMetricTextV2671(x)+'；目前最重要等「'+String(wait)+'」。';
}
function adviceTextV2666(x){
  const m=candMetricV2671(x),band=String(x?.candidateBand||'WATCH'),soft=Array.isArray(x?.candidateSoftWait)?x.candidateSoftWait:[],g=x?.formalGap||{},toB=Array.isArray(g.toB)?g.toB:[];
  let action='';
  if(band==='PRIME')action='優先開圖看；如果 5分/15分結構保持同向，而且主動盤沒有翻向，可以列入你自己的建倉選擇。';
  else if(band==='WATCH')action='值得看，但先等盤面自己證明；不要因為進候選就追。';
  else if(band==='RELATIVE')action='先觀察，不急著打；它是相對前排，不代表已經有正式進場優勢。';
  else action='只當研究名單。除非後續多拿到一到兩個明確加分，否則先略過。';

  const risk=[];
  if(m.vr!=null&&m.vr<.75)risk.push('量能偏弱');
  if(m.takerA!=null&&m.takerA<=-.05)risk.push('主動盤逆向');
  if(m.topA!=null&&m.topA<=-.06)risk.push('大戶方向逆向');
  if(m.health!=null&&m.health<55)risk.push('結構健康度偏低');
  const need=(toB[0]||soft[0]||'結構＋資金同步確認');
  return action+'\n'+(risk.length?'現在先防：'+risk.slice(0,2).join('、')+'。':'目前沒有明顯硬風險。')+' 要升正式 B，優先補「'+String(need)+'」。';
}
function candHistoryReasonV2671(r){
  return ({MANUAL_DISMISS:'手動略過',TTL_EXPIRED:'30分鐘到期',BUILT:'已建倉',PROMOTED:'升級 A/B',HARD_INVALID:'硬失效'})[String(r?.reason||'')]||String(r?.reason||'已歸檔');
}
function candHistoryAgeV2671(raw){
  const t=new Date(raw||0).getTime();if(!Number.isFinite(t))return'—';const ms=Math.max(0,Date.now()-t),m=Math.floor(ms/60000);return m<60?m+'分前':Math.floor(m/60)+'小時前';
}
function candHistoryHostV2671(){
  const h=ensureHost();if(!h)return null;
  let box=document.getElementById('candidateHistoryV2671');
  if(!box){box=document.createElement('details');box.id='candidateHistoryV2671';box.className='candidate-history-v2671';h.insertAdjacentElement('afterend',box)}
  return box;
}
function renderHistoryV2671(){
  const box=candHistoryHostV2671();if(!box)return;
  const rows=candidateHistoryV2671.slice(0,40);
  box.innerHTML='<summary><div><b>候選歷史</b><span>'+rows.length+'</span></div><small>前台保留 24 小時 · 後台保留 7 天</small><i>⌄</i></summary>'+
    '<div class="candidate-history-list-v2671">'+
      (rows.length?rows.map(r=>{
        const dir=String(r.direction||'LONG')==='SHORT'?'做空':'做多',cls=String(r.direction||'LONG')==='SHORT'?'short':'long',restore=String(r.reason||'')==='MANUAL_DISMISS';
        return '<article class="candidate-history-row-v2671"><div class="ch-main"><div><b>'+esc(r.symbol||'—')+'</b><em class="'+cls+'">'+dir+'</em></div><small>'+candHistoryAgeV2671(r.archivedAt)+' · '+esc(candHistoryReasonV2671(r))+'</small></div>'+
          '<div><span>當時勝率</span><b>'+pct(r.candidateWinRate)+'</b></div><div><span>Shadow</span><b>'+Math.round(Number(r.candidateScore||0))+' 分</b></div>'+
          (restore?'<button type="button" data-candidate-restore="'+esc(r.candidateKey||'')+'">恢復判斷</button>':'')+'</article>'
      }).join(''):'<div class="candidate-history-empty-v2671">目前沒有 24 小時內的候選歷史</div>')+
    '</div>';
}
async function loadHistoryV2671(force=false){
  if(candidateHistoryBusyV2671&&!force)return;candidateHistoryBusyV2671=true;
  try{const d=await candJsonV2671('/api/manual-candidate-history');candidateHistoryV2671=Array.isArray(d.rows)?d.rows:[];renderHistoryV2671()}catch{}finally{candidateHistoryBusyV2671=false}
}
function candidateFindV2671(key){return (data?.rows||[]).find(x=>String(x?.candidateKey||keyOf(x))===String(key))}
function candidateSnapshotV2671(x){
  return {symbol:x?.symbol,direction:x?.direction,originalGrade:x?.originalGrade||x?.grade,candidateBand:x?.candidateBand,candidateScore:x?.candidateScore,candidateWinRate:x?.candidateWinRate,rank:x?.rank,rankScore:x?.rankScore,quoteVolume:x?.quoteVolume,shadow:x?.shadow||{},structure:x?.structure||null,softWait:x?.candidateSoftWait||[]}
}
async function dismissCandidateV2671(key,btn){
  const x=candidateFindV2671(key);if(!x)return;
  if(btn){btn.disabled=true;btn.textContent='…'}
  try{
    await candJsonV2671('/api/manual-candidate-dismiss',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({candidateKey:key,symbol:x.symbol,direction:x.direction,action:'dismiss',snapshot:candidateSnapshotV2671(x)})});
    if(data?.rows)data.rows=data.rows.filter(r=>String(r?.candidateKey||keyOf(r))!==String(key));
    render();await loadHistoryV2671(true);
  }catch(e){if(btn){btn.disabled=false;btn.textContent='×';btn.title=e.message}}
}
async function restoreCandidateV2671(key,btn){
  if(btn){btn.disabled=true;btn.textContent='…'}
  try{
    await candJsonV2671('/api/manual-candidate-dismiss',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({candidateKey:key,action:'restore'})});
    await refreshCandidateDataV2671(true);await loadHistoryV2671(true);
  }catch(e){if(btn){btn.disabled=false;btn.textContent='恢復判斷';btn.title=e.message}}
}
function candInputV2671(card,k){const el=card?.querySelector('[data-cand-f="'+k+'"]');const v=el?.value;return v===''||v==null?null:Number(v)}
async function saveCandidateTradeV2671(key,btn){
  const x=candidateFindV2671(key),card=btn?.closest('.candidate-v2671'),msg=card?.querySelector('[data-cand-msg]');if(!x||!card||!msg)return;
  const entry=candInputV2671(card,'entry'),tp1=candInputV2671(card,'tp1'),tp2=candInputV2671(card,'tp2'),sp1=candInputV2671(card,'sp1'),sp2=candInputV2671(card,'sp2'),margin=candInputV2671(card,'margin'),leverage=candInputV2671(card,'leverage'),quantity=candInputV2671(card,'quantity');
  if(entry==null||tp1==null||sp1==null){msg.textContent='至少填：成本、TP1、SP1';return}
  const body={
    manualMode:true,manualGrade:'C',manualGradeScore:x.candidateScore,manualGradeAt:data?.generatedAt,manualOpportunityId:x.id||x.candidateKey,
    manualReasons:[...(x.candidateReasons||[]),...(x.candidateSoftWait||[])].slice(0,8),
    signalKey:x.signalKey,notificationId:null,symbol:x.symbol,direction:x.direction,strategyId:x.strategyId,strategyLabel:x.strategyLabel,
    marketRegime:x.marketRegime,notificationTier:x.notificationTier,entryPrice:entry,tp1,tp2,sp1,sp2,margin,quantity,leverage,
    manualSnapshot:{candidate:true,candidateBand:x.candidateBand,candidateScore:x.candidateScore,candidateWinRate:x.candidateWinRate,rank:x.rank,rankScore:x.rankScore,calibratedWinRate:x.calibratedWinRate,notificationTier:x.notificationTier,observationProgress:x.observationProgress,dataCoverage:x.dataHealth?.coverage,dataConfidence:x.dataHealth?.confidence,structureState:x.structure?.state,structureHealth:x.structure?.health,structureLearningAdjustment:x.structure?.learningAdjustment,shadowSample:x.shadow?.sample,shadowHitRate:x.shadow?.hitRate,shadowProfitFactor:x.shadow?.profitFactor,freshnessAgeMs:x.freshnessAgeMs}
  };
  msg.textContent='建立中…';btn.disabled=true;
  try{
    await candJsonV2671('/api/actual-trades',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    candClearDraftV2671(key);msg.textContent='✓ 已建立實際建倉，後台開始追蹤';setTimeout(()=>refreshCandidateDataV2671(true),700);
  }catch(e){msg.textContent='✕ '+e.message;btn.disabled=false}
}
async function refreshCandidateDataV2671(force=false){
  if(document.hidden)return;
  const h=ensureHost();if(!h||!h.isConnected)return;
  if(document.querySelector('.candidate-trade-form-v2671 input:focus'))return;
  const now=Date.now(),doForce=Boolean(force)||(now-candidateLastForceV2671>=CANDIDATE_FORCE_REFRESH_MS_V2671);
  const y=window.scrollY;
  try{
    const d=await candJsonV2671('/api/manual-opportunities'+(doForce?'?force=1':''));
    data=d;if(doForce)candidateLastForceV2671=now;lastSig='';render();requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'auto'}));
  }catch{}
}
function bindCandidateOpsV2671(){
  if(document.documentElement.dataset.candidateOpsV2671==='1')return;
  document.documentElement.dataset.candidateOpsV2671='1';
  document.addEventListener('click',e=>{
    const dismiss=e.target.closest?.('[data-candidate-dismiss]');
    if(dismiss){e.preventDefault();e.stopPropagation();dismissCandidateV2671(dismiss.dataset.candidateDismiss,dismiss);return}
    const restore=e.target.closest?.('[data-candidate-restore]');
    if(restore){e.preventDefault();restoreCandidateV2671(restore.dataset.candidateRestore,restore);return}
    const refresh=e.target.closest?.('[data-candidate-refresh]');
    if(refresh){e.preventDefault();refreshCandidateDataV2671(true);return}
    const fill=e.target.closest?.('[data-cand-fill-current]');
    if(fill){e.preventDefault();const card=fill.closest('.candidate-v2671'),key=card?.dataset?.candidateKey,x=candidateFindV2671(key),el=card?.querySelector('[data-cand-f="entry"]');if(el&&x){el.value=n(x?.entry?.currentPrice)==null?'':x.entry.currentPrice;candSaveDraftV2671(key,'entry',el.value)}return}
    const save=e.target.closest?.('[data-cand-save-trade]');
    if(save){e.preventDefault();const card=save.closest('.candidate-v2671');saveCandidateTradeV2671(card?.dataset?.candidateKey,save);return}
  },true);
  document.addEventListener('input',e=>{
    const inp=e.target.closest?.('[data-cand-f]');if(!inp)return;const card=inp.closest('.candidate-v2671');if(!card)return;candSaveDraftV2671(card.dataset.candidateKey,inp.dataset.candF,inp.value);
  });
  candidateAutoTimerV2671=setInterval(()=>{refreshCandidateDataV2671(false);loadHistoryV2671(false)},CANDIDATE_REFRESH_MS_V2671);
  setTimeout(()=>loadHistoryV2671(true),400);
}
`;

const CARD_FN=String.raw`
function card(x){
  const id=keyOf(x),ck=String(x?.candidateKey||id),s=x.structure||{},ev=x.candidateEvidence||{},g=x.formalGap||{},open=opens()[id]===true;
  const soft=Array.isArray(x.candidateSoftWait)?x.candidateSoftWait:[],hard=Array.isArray(x.candidateHardBlockers)?x.candidateHardBlockers:[];
  const sh=shadowQualityV2666(x),current=currentTextV2671(x),forecast=forecastTextV2666(x),advice=adviceTextV2666(x),currentPx=n(x?.entry?.currentPrice);
  const d=candDraftV2671(ck);
  const fv=(k,f='')=>esc(Object.prototype.hasOwnProperty.call(d,k)?d[k]:(f??''));
  return '<article class="mw-card mw-candidate-card-v2664 candidate-narrative-v2666 candidate-v2667 candidate-v2671" data-candidate-id="'+esc(id)+'" data-candidate-key="'+esc(ck)+'">'+
    '<details '+(open?'open':'')+'>'+
      '<summary>'+
        '<span class="mw-grade candidate">候</span>'+
        '<div class="mw-main candidate-main-v2667"><div class="candidate-title-v2667"><a href="'+tvUrl(x.symbol)+'" target="_blank" rel="noopener">'+esc(x.symbol)+'</a><em class="'+(x.direction==='SHORT'?'short':'long')+'">'+(x.direction==='SHORT'?'做空':'做多')+'</em></div>'+
          candidateMetaV2667(x)+'</div>'+
        '<div class="mw-score candidate-score"><b>'+pct(x.candidateWinRate)+'</b><span>候選勝率</span></div>'+
        '<button type="button" class="candidate-delete-v2671" data-candidate-dismiss="'+esc(ck)+'" aria-label="移到候選歷史">×</button>'+
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
        '<div class="candidate-why-v2666"><div><b>還沒變正式 B 的原因</b>'+list((g.toB||[]).slice(0,4),'主要只差即時條件再確認','gap')+'</div><div><b>還沒變正式 A 的原因</b>'+list((g.toA||[]).slice(0,5),'A 級條件已接近完整','gap')+'</div></div>'+
        (soft.length?'<div class="candidate-wait-v2666"><b>目前等待</b><p>'+esc(soft.slice(0,3).join('、'))+'</p></div>':'')+
        (hard.length?'<div class="candidate-hard-v2666"><b>硬阻擋</b><p>'+esc(hard.slice(0,3).join('、'))+'</p></div>':'')+
        '<details class="candidate-trade-form-v2671"><summary><div><b>實際建倉資料</b><small>候選也可以直接記錄你的實際單</small></div><i>⌄</i></summary>'+
          '<div class="candidate-trade-grid-v2671">'+
            '<label><span>成本</span><input data-cand-f="entry" inputmode="decimal" value="'+fv('entry','')+'"></label>'+
            '<label><span>TP1</span><input data-cand-f="tp1" inputmode="decimal" value="'+fv('tp1','')+'"></label>'+
            '<label><span>TP2</span><input data-cand-f="tp2" inputmode="decimal" value="'+fv('tp2','')+'"></label>'+
            '<label><span>SP1</span><input data-cand-f="sp1" inputmode="decimal" value="'+fv('sp1','')+'"></label>'+
            '<label><span>SP2</span><input data-cand-f="sp2" inputmode="decimal" value="'+fv('sp2','')+'"></label>'+
            '<label><span>保證金 U</span><input data-cand-f="margin" inputmode="decimal" value="'+fv('margin','300')+'"></label>'+
            '<label><span>槓桿</span><input data-cand-f="leverage" inputmode="numeric" value="'+fv('leverage','20')+'"></label>'+
            '<label><span>數量（可空）</span><input data-cand-f="quantity" inputmode="decimal" value="'+fv('quantity','')+'"></label>'+
          '</div>'+
          '<div class="candidate-trade-actions-v2671"><button type="button" data-cand-fill-current>成本用現價 '+(currentPx==null?'—':px(currentPx))+'</button><button type="button" class="save" data-cand-save-trade>儲存並開始追蹤</button></div>'+
          '<div class="candidate-trade-msg-v2671" data-cand-msg></div>'+
        '</details>'+
      '</div>'+
    '</details>'+
  '</article>';
}
`;

const RENDER_FN=String.raw`
function render(){
  const h=ensureHost();if(!h||!data)return;
  const rows=(data.rows||[]).filter(x=>x?.candidate===true&&x?.trade?.status!=='ACTIVE').slice(0,5);
  const p=data.pipeline||{},line=pipelineLine(p,rows),rejects=Array.isArray(p.topRejects)?p.topRejects.slice(0,3):[];
  const rejectText=rejects.map(x=>esc(x.reason)+' '+Number(x.count||0)).join(' · ');
  const sig=JSON.stringify([rows.map(x=>[
    keyOf(x),Math.round(Number(x.candidateScore||0)),Number(x.candidateWinRate||0).toFixed(1),
    x.candidateBand,Math.ceil(Number(x.candidateRemainingMs||0)/60000),x.structure?.state,x.trackerStatus,
    n(x?.marketMetrics?.volumeRatio),n(x?.marketMetrics?.takerRatio),n(x?.marketMetrics?.topRatio)
  ]),line,rejectText]);
  if(sig===lastSig&&h.querySelector('.candidate-list-v2664')){renderHistoryV2671();return}
  lastSig=sig;

  h.innerHTML=
    '<summary class="candidate-group-summary-v2667 candidate-group-summary-v2671">'+
      '<div class="candidate-group-title-v2667"><b>候選</b><span>'+rows.length+'</span></div>'+
      '<div class="candidate-group-copy-v2667"><strong>Shadow 學習後的手動候選</strong><small>'+esc(line)+'</small></div>'+
      '<button type="button" class="candidate-refresh-v2671" data-candidate-refresh aria-label="更新候選">↻</button>'+
      '<i>⌄</i>'+
    '</summary>'+
    '<div class="mw-list candidate-list-v2664">'+
      (rows.length?rows.map(card).join(''):'<div class="mw-empty">本輪沒有正在有效期內的候選。'+esc(line)+(rejectText?' · 主要淘汰：'+rejectText:'')+'</div>')+
    '</div>';
  renderHistoryV2671();
}
`;

const CSS=String.raw`
/* CANDIDATE_OPS_HISTORY_TRADE_V2671_20260904 */
.candidate-analysis-grid-v2666 section p{white-space:pre-line!important}
.candidate-v2671>details>summary{
  grid-template-columns:38px minmax(0,1fr) 82px 34px 14px!important;
}
.candidate-delete-v2671,.candidate-refresh-v2671{
  appearance:none;border:1px solid #46545d;background:#141c21;color:#aeb8bd;border-radius:9px;
  min-width:30px;height:30px;font-size:20px;line-height:1;display:grid;place-items:center;padding:0;cursor:pointer;
}
.candidate-delete-v2671:hover{border-color:#7d5550;color:#e8aaa1;background:#221918}
.candidate-refresh-v2671{font-size:18px;color:#e0c27d;border-color:#5c5038}
.candidate-group-summary-v2671{
  grid-template-columns:auto minmax(0,1fr) 34px 16px!important;
}
.candidate-trade-form-v2671{
  margin-top:12px;border:1px solid #42515a;border-radius:13px;background:#11191e;overflow:hidden;
}
.candidate-trade-form-v2671>summary{
  display:grid!important;grid-template-columns:minmax(0,1fr) 16px!important;gap:10px!important;
  min-height:0!important;padding:13px 14px!important;background:#172127;cursor:pointer;
}
.candidate-trade-form-v2671>summary b{display:block;color:#e6d19a;font-size:15px}
.candidate-trade-form-v2671>summary small{display:block;margin-top:4px;color:#8f9ba2;font-size:12.5px;line-height:1.4}
.candidate-trade-grid-v2671{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;padding:13px}
.candidate-trade-grid-v2671 label{min-width:0}
.candidate-trade-grid-v2671 label span{display:block;margin:0 0 5px;color:#96a1a7;font-size:12px}
.candidate-trade-grid-v2671 input{
  width:100%;box-sizing:border-box;border:1px solid #34434c;background:#0d1418;color:#edf0ee;border-radius:9px;
  padding:10px 9px;font-size:15px;outline:none;
}
.candidate-trade-grid-v2671 input:focus{border-color:#9b7c40}
.candidate-trade-actions-v2671{display:flex;gap:8px;justify-content:flex-end;padding:0 13px 12px}
.candidate-trade-actions-v2671 button{
  border:1px solid #46545d;background:#151e23;color:#bcc5c9;border-radius:9px;padding:9px 11px;font-size:13px
}
.candidate-trade-actions-v2671 button.save{border-color:#765f30;background:#2a2112;color:#e5c775;font-weight:800}
.candidate-trade-msg-v2671{min-height:18px;padding:0 13px 12px;color:#aeb8bd;font-size:12.5px}
.candidate-history-v2671{
  margin:14px 0 8px;border:1px solid #34424b;border-radius:15px;background:#11191e;overflow:hidden;
}
.candidate-history-v2671>summary{
  display:grid;grid-template-columns:auto minmax(0,1fr) 16px;gap:12px;align-items:center;padding:14px 15px;cursor:pointer;
}
.candidate-history-v2671>summary>div{display:flex;align-items:center;gap:8px}
.candidate-history-v2671>summary b{color:#c5d5df;font-size:16px}
.candidate-history-v2671>summary span{min-width:24px;height:24px;display:grid;place-items:center;border-radius:8px;background:#293c47;color:#d8e6ed;font-size:12px;font-weight:800}
.candidate-history-v2671>summary small{color:#87949b;font-size:12.5px;line-height:1.45;white-space:normal}
.candidate-history-list-v2671{border-top:1px solid #2f3b43}
.candidate-history-row-v2671{
  display:grid;grid-template-columns:minmax(0,1.4fr) .8fr .8fr auto;gap:10px;align-items:center;
  padding:12px 14px;border-bottom:1px solid #27343b;
}
.candidate-history-row-v2671:last-child{border-bottom:0}
.candidate-history-row-v2671 .ch-main>div{display:flex;align-items:center;gap:7px}
.candidate-history-row-v2671 .ch-main b{color:#eef0ef;font-size:15px}
.candidate-history-row-v2671 em{font-style:normal;font-size:11px;padding:3px 6px;border-radius:7px}
.candidate-history-row-v2671 em.long{background:#542326;color:#ffbbb7}.candidate-history-row-v2671 em.short{background:#17463c;color:#9fe1c9}
.candidate-history-row-v2671 small,.candidate-history-row-v2671 span{display:block;color:#87939a;font-size:11.5px;line-height:1.45}
.candidate-history-row-v2671 b{color:#d6dadd;font-size:14px}
.candidate-history-row-v2671 button{
  border:1px solid #4a5b65;background:#162129;color:#b9cad4;border-radius:8px;padding:7px 9px;font-size:12px
}
.candidate-history-empty-v2671{padding:18px;text-align:center;color:#7f8b92;font-size:13px}
@media(max-width:640px){
  .candidate-v2671>details>summary{grid-template-columns:36px minmax(0,1fr) 68px 30px 12px!important;gap:8px!important}
  .candidate-delete-v2671{min-width:28px;height:28px;font-size:18px}
  .candidate-group-summary-v2671{grid-template-columns:auto minmax(0,1fr) 30px 12px!important}
  .candidate-trade-grid-v2671{grid-template-columns:repeat(2,minmax(0,1fr))}
  .candidate-history-row-v2671{grid-template-columns:minmax(0,1fr) auto;gap:7px 10px}
  .candidate-history-row-v2671>div:nth-child(2),.candidate-history-row-v2671>div:nth-child(3){display:inline-block}
  .candidate-history-row-v2671 button{grid-column:2;grid-row:1/3}
}
`;

function patchServer(){
  const file=path.join(__dirname,'server.js');
  if(!fs.existsSync(file))throw new Error('[candidate-v2671] server.js missing');
  let src=fs.readFileSync(file,'utf8');
  if(src.includes(MARKER))return false;
  if(!src.includes(BASE))throw new Error('[candidate-v2671] V2670 candidate recall fix missing');

  const blockPos=src.indexOf('function manualCandidateBlockClassV2665(');
  if(blockPos<0)throw new Error('[candidate-v2671] blocker anchor missing');
  src=src.slice(0,blockPos)+SERVER_HELPERS.trim()+'\n'+src.slice(blockPos);

  src=replaceFunction(src,'manualCandidateArchiveRowsV2667',ARCHIVE_ROWS_FN);
  src=replaceFunction(src,'manualCandidateBandV2665',BAND_FN);

  const routeAnchor="app.get('/api/manual-candidate-archive'";
  const routePos=src.indexOf(routeAnchor);
  if(routePos<0)throw new Error('[candidate-v2671] archive route missing');
  const routeEnd=src.indexOf('\n',routePos);
  const routes=String.raw`
app.get('/api/manual-candidate-history',(_req,res)=>{
  res.json({ok:true,version:'V2.6.71',visibleHours:24,backendDays:7,rows:manualCandidateHistoryRowsV2671()});
});
app.post('/api/manual-candidate-dismiss',(req,res)=>{
  try{
    const body=req.body||{},action=String(body.action||'dismiss').toLowerCase(),key=String(body.candidateKey||'').trim();
    if(!key)return res.status(400).json({error:'candidateKey required'});
    if(action==='restore'){
      manualCandidateUnskipV2671(key);
      return res.json({ok:true,action:'restore',candidateKey:key});
    }
    const now=Date.now(),st=manualCandidateStateV2664.get(key);
    if(st?.snapshot){
      const m=st.metric||manualCandidateScoreV2664(st.snapshot);
      manualCandidateArchiveV2667(st,st.snapshot,m,'MANUAL_DISMISS','使用者主動移出候選',now);
      manualCandidateStateV2664.delete(key);manualCandidateSaveStateV2664();
    }else{
      manualCandidateFallbackArchiveV2671(body,now);
    }
    manualCandidateSkipKeyV2671(key,'MANUAL_DISMISS');
    res.json({ok:true,action:'dismiss',candidateKey:key,skipMinutes:60});
  }catch(e){res.status(500).json({error:String(e?.message||e)})}
});
`;
  src=src.slice(0,routeEnd+1)+routes+src.slice(routeEnd+1);

  src='// '+MARKER+'\n'+src;
  writeChecked(file,src,'server.js');
  return true;
}
function verifyABWorkspaceSource(){
  const f=path.join(__dirname,'advisory-buckets-v26271-patch.mjs');
  if(!fs.existsSync(f))throw new Error('[candidate-v2671] A/B workspace source missing');
  const s=fs.readFileSync(f,'utf8');
  for(const needle of ['/api/actual-trades','data-save-trade','TP1','TP2','SP1','SP2','保證金','槓桿']){
    if(!s.includes(needle))throw new Error('[candidate-v2671] A/B 建倉欄 integrity missing: '+needle);
  }
  return true;
}
function patchUi(){
  const jsPath=path.join(__dirname,'public','manual-candidate-v2664.js'),cssPath=path.join(__dirname,'public','manual-candidate-v2664.css'),htmlPath=path.join(__dirname,'public','index.html');
  if(!fs.existsSync(jsPath))throw new Error('[candidate-v2671] candidate runtime missing');
  let js=fs.readFileSync(jsPath,'utf8');
  if(!js.includes(MARKER)){
    const helperPos=js.indexOf('function zhDirV2666(');
    if(helperPos<0)throw new Error('[candidate-v2671] narrative helper anchor missing');
    js=js.slice(0,helperPos)+UI_HELPERS.trim()+'\n'+js.slice(helperPos);
    js=replaceFunction(js,'card',CARD_FN);
    js=replaceFunction(js,'render',RENDER_FN);
    js=js.replace("const VERSION='2.6.70';","const VERSION='2.6.71';");
    js=insertBeforeLastClosure(js,'bindCandidateOpsV2671();');
    js='/* '+MARKER+' */\n'+js;
    writeChecked(jsPath,js,'candidate runtime');
  }

  let css=fs.existsSync(cssPath)?fs.readFileSync(cssPath,'utf8'):'';
  if(!css.includes(MARKER)){css+='\n'+CSS+'\n';fs.writeFileSync(cssPath,css,'utf8')}

  if(fs.existsSync(htmlPath)){
    let h=fs.readFileSync(htmlPath,'utf8');
    h=h.replace(/\/manual-candidate-v2664\.js\?v=[^"'<>]+/g,'/manual-candidate-v2664.js?v=2671-0904');
    h=h.replace(/\/manual-candidate-v2664\.css\?v=[^"'<>]+/g,'/manual-candidate-v2664.css?v=2671-0904');
    fs.writeFileSync(htmlPath,h,'utf8');
  }
  return true;
}
export function patchCandidateOpsV2671(){
  verifyABWorkspaceSource();
  const server=patchServer(),ui=patchUi();
  return {changed:Boolean(server||ui),version:'V2.6.71',autoRefreshSeconds:90,forceRefreshMinutes:5,visibleHistoryHours:24,backendHistoryDays:7,manualDismiss:true,candidateTrade:true,abTradeVerified:true};
}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchCandidateOpsV2671());
