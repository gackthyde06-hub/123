/* CANDIDATE_NARRATIVE_LAYOUT_V2676_20260904 */
/* CANDIDATE_UI_NOTIFY_CUSTOM_V2673_20260904 */
/* CANDIDATE_OPS_HISTORY_TRADE_V2671_20260904 */
/* CANDIDATE_REAL_RECALL_FIX_V2670_20260904 */
/* MARKETWIDE_CANDIDATE_RECALL_V2669_20260904 */
/* CANDIDATE_LIFECYCLE_V2667_20260904 */
/* CANDIDATE_NARRATIVE_UI_V2666_20260904 */
/* CANDIDATE_RECALL_RUNTIME_V2665 */
(()=>{
'use strict';
const VERSION='2.6.73';
const OPEN_KEY='manual-candidate-open-v2664';
const DRAFT_KEY='manual-candidate-draft-v2664';
let data=null,busy=false,lastSig='',timer=null,waitTimer=null;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number.isFinite(Number(v))?Number(v):null;
const pct=v=>n(v)==null?'—':Number(v).toFixed(1)+'%';
const px=v=>{const x=n(v);if(x==null)return'—';if(x>=1000)return x.toLocaleString('en-US',{maximumFractionDigits:2});if(x>=1)return x.toLocaleString('en-US',{maximumFractionDigits:6});return x.toLocaleString('en-US',{maximumFractionDigits:8})};
const age=ms=>{const x=Math.max(0,Number(ms)||0),s=Math.round(x/1000);return s<60?s+'秒前':s<3600?Math.floor(s/60)+'分前':Math.floor(s/3600)+'小時前'};
const tvUrl=s=>'https://www.tradingview.com/chart/?symbol='+encodeURIComponent('BINANCE:'+String(s||'').toUpperCase()+'.P');
function read(k,f={}){try{const x=JSON.parse(localStorage.getItem(k)||'null');return x&&typeof x==='object'&&!Array.isArray(x)?x:f}catch{return f}}
function write(k,x){try{localStorage.setItem(k,JSON.stringify(x))}catch{}}
function currentPage(){return document.querySelector('.pageTab.active')?.dataset?.page||''}
function keyOf(x){return String(x?.candidateKey||[x?.symbol,x?.direction].join('|'))}
function opens(){return read(OPEN_KEY,{})}
function drafts(){return read(DRAFT_KEY,{})}
function draftVal(id,k,f=''){const d=drafts()[id]||{};return Object.prototype.hasOwnProperty.call(d,k)?d[k]:(f??'')}
function saveDraft(id,k,v){const d=drafts();d[id]={...(d[id]||{}),[k]:v};write(DRAFT_KEY,d)}
async function json(url,opt={}){
  const c=new AbortController(),t=setTimeout(()=>c.abort('manual-opportunities-timeout'),15000);
  try{
    const r=await fetch(url,{cache:'no-store',signal:c.signal,...opt});
    const d=await r.json().catch(()=>null);
    if(!r.ok||!d?.ok)throw new Error(d?.error||('HTTP '+r.status));
    return d;
  }finally{clearTimeout(t)}
}
function ensureHost(){
  const shell=document.querySelector('#manualWorkspaceV2638 .mw-shell');
  if(!shell)return null;
  let h=document.getElementById('manualCandidateV2664');
  if(!h){
    h=document.createElement('details');
    h.id='manualCandidateV2664';
    h.className='mw-group mw-candidate-group-v2664';
    h.open=true;
    shell.appendChild(h);
  }else if(h.parentElement!==shell)shell.appendChild(h);
  return h;
}
function waitForHost(){
  if(ensureHost()){if(waitTimer){clearInterval(waitTimer);waitTimer=null}render();return}
  if(waitTimer)return;
  let ntry=0;
  waitTimer=setInterval(()=>{
    ntry++;
    if(ensureHost()){clearInterval(waitTimer);waitTimer=null;render()}
    else if(ntry>=20){clearInterval(waitTimer);waitTimer=null}
  },500);
}
function list(v,empty='—',cls=''){
  const a=Array.isArray(v)?v.filter(Boolean):[];
  return a.length?a.map(x=>'<span class="'+cls+'">'+esc(x)+'</span>').join(''):'<span>'+esc(empty)+'</span>';
}
function formField(id,k,label,value){
  return '<label><span>'+label+'</span><input data-cf="'+k+'" inputmode="decimal" value="'+esc(draftVal(id,k,value??''))+'"></label>';
}
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
  const c=new AbortController(),t=setTimeout(()=>c.abort('manual-opportunities-timeout'),15000);
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
  return {symbol:x?.symbol,direction:x?.direction,originalGrade:x?.originalGrade||x?.grade,candidateBand:x?.candidateBand,candidateScore:x?.candidateScore,candidateWinRate:x?.candidateWinRate,rank:x?.rank,rankScore:x?.rankScore,quoteVolume:x?.quoteVolume,shadow:x?.shadow||{},abcLearning:x?.abcLearning||{},candidateEvidence:x?.candidateEvidence||{},structure:x?.structure||null,softWait:x?.candidateSoftWait||[]}
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
    manualSnapshot:{candidate:true,candidateBand:x.candidateBand,candidateScore:x.candidateScore,candidateWinRate:x.candidateWinRate,rank:x.rank,rankScore:x.rankScore,calibratedWinRate:x.calibratedWinRate,notificationTier:x.notificationTier,observationProgress:x.observationProgress,dataCoverage:x.dataHealth?.coverage,dataConfidence:x.dataHealth?.confidence,structureState:x.structure?.state,structureHealth:x.structure?.health,structureLearningAdjustment:x.structure?.learningAdjustment,shadowSample:x.shadow?.sample,shadowHitRate:x.shadow?.hitRate,shadowProfitFactor:x.shadow?.profitFactor,abcSample:x.abcLearning?.sample,abcHitRate:x.abcLearning?.hitRate,abcProfitFactor:x.abcLearning?.profitFactor,abcExpectancyR:x.abcLearning?.expectancyR,abcAdjustment:x.abcLearning?.adjustment,abcLevel:x.abcLearning?.level,abcActive:x.abcLearning?.active,freshnessAgeMs:x.freshnessAgeMs}
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
let notifyCustomDataV2673=null,notifyCustomBusyV2673=false,notifyCustomSigV2673='';
async function loadNotifyCustomV2673(force=false){
  if(notifyCustomBusyV2673&&!force)return;
  notifyCustomBusyV2673=true;
  try{
    notifyCustomDataV2673=await candJsonV2671('/api/notification-custom-v2673');
    notifyCustomSigV2673='';
    renderNotifyCustomV2673();
  }catch{}finally{notifyCustomBusyV2673=false}
}
function notifyCustomHostV2673(){
  const ledger=document.getElementById('manualNoticeLedgerV2639');
  if(!ledger)return null;
  let host=document.getElementById('notificationCustomV2673');
  if(!host){
    host=document.createElement('section');
    host.id='notificationCustomV2673';
    host.className='notification-custom-v2673';
    ledger.insertAdjacentElement('afterend',host);
  }
  return host;
}
function notifyBtnV2673(kind,value,label,current){
  return '<button type="button" data-notify-kind-v2673="'+kind+'" data-notify-value-v2673="'+value+'" class="'+(String(current)===String(value)?'active':'')+'">'+label+'</button>';
}
function renderNotifyCustomV2673(){
  const host=notifyCustomHostV2673();if(!host||!notifyCustomDataV2673)return;
  const d=notifyCustomDataV2673,formal=String(d.formalMode||'AB'),cand=String(d.candidateMode||'OFF'),minWin=Math.round(Number(d.candidateMinWinRate||55));
  const sig=[formal,cand,minWin].join('|');if(sig===notifyCustomSigV2673&&host.children.length)return;notifyCustomSigV2673=sig;
  host.innerHTML=
    '<div class="nc-head-v2673"><div><b>通知設定</b><small>只控制手機推播，不影響 Shadow 學習與候選排序</small></div><span>自定義</span></div>'+
    '<div class="nc-row-v2673 fixed"><div><b>熬鷹資本</b><small>監控內 OPEN / ADD / REDUCE / CLOSE</small></div><strong>固定通知</strong></div>'+
    '<div class="nc-row-v2673"><div><b>正式 Shadow</b><small>A 級或 A+B 自動通知</small></div><div class="nc-seg-v2673">'+
      notifyBtnV2673('formal','A','只 A',formal)+notifyBtnV2673('formal','AB','A + B',formal)+'</div></div>'+
    '<div class="nc-row-v2673 candidate"><div><b>候選通知</b><small>候選仍由你開圖判斷，不會變正式 A/B</small></div><div class="nc-candidate-controls-v2673">'+
      '<div class="nc-seg-v2673 candidate">'+
        notifyBtnV2673('candidate','OFF','關閉',cand)+
        notifyBtnV2673('candidate','PRIME','只優先',cand)+
        notifyBtnV2673('candidate','WATCH','優先＋觀察',cand)+
        notifyBtnV2673('candidate','ALL','全部候選',cand)+
      '</div>'+
      '<label><span>最低候選勝率</span><input type="number" min="45" max="80" step="1" data-candidate-min-win-v2673 value="'+minWin+'"><em>%</em></label>'+
    '</div></div>'+
    '<div class="nc-msg-v2673" data-notify-msg-v2673></div>';
}
async function saveNotifyCustomV2673(patch){
  const host=notifyCustomHostV2673(),msg=host?.querySelector('[data-notify-msg-v2673]');
  if(msg)msg.textContent='儲存中…';
  try{
    const body={formalMode:notifyCustomDataV2673?.formalMode||'AB',candidateMode:notifyCustomDataV2673?.candidateMode||'OFF',candidateMinWinRate:notifyCustomDataV2673?.candidateMinWinRate||55,...patch};
    notifyCustomDataV2673=await candJsonV2671('/api/notification-custom-v2673',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    notifyCustomSigV2673='';renderNotifyCustomV2673();
    const next=document.querySelector('[data-notify-msg-v2673]');if(next){next.textContent='✓ 已儲存';setTimeout(()=>{if(next.isConnected)next.textContent=''},1600)}
  }catch(e){if(msg)msg.textContent='✕ '+e.message}
}
function bindNotifyCustomV2673(){
  if(document.documentElement.dataset.notifyCustomV2673==='1')return;
  document.documentElement.dataset.notifyCustomV2673='1';
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-notify-kind-v2673]');if(!b)return;
    e.preventDefault();
    const kind=b.dataset.notifyKindV2673,value=b.dataset.notifyValueV2673;
    if(kind==='formal')saveNotifyCustomV2673({formalMode:value});
    else if(kind==='candidate')saveNotifyCustomV2673({candidateMode:value});
  },true);
  document.addEventListener('change',e=>{
    const input=e.target.closest?.('[data-candidate-min-win-v2673]');if(!input)return;
    const v=Math.max(45,Math.min(80,Number(input.value||55)));input.value=v;saveNotifyCustomV2673({candidateMinWinRate:v});
  });
  setTimeout(()=>loadNotifyCustomV2673(true),700);
  setInterval(()=>renderNotifyCustomV2673(),4000);
  setInterval(()=>loadNotifyCustomV2673(false),5*60*1000);
}
function zhDirV2666(x){return String(x?.direction||'LONG')==='SHORT'?'空方':'多方'}
function zhBandV2666(x){
  const b=String(x?.candidateBand||'WATCH');
  return b==='PRIME'?'優先候選':b==='RELATIVE'?'相對候選':b==='RESEARCH'?'研究候選':b==='COOLING'?'降溫候選':'觀察候選';
}
function shadowQualityV2666(x){
  const ev=x?.candidateEvidence||{},sample=Number(ev.shadowSample||0),hit=n(ev.shadowHitRate),pf=n(ev.shadowProfitFactor);
  if(sample<6)return {tone:'neutral',text:'同類 Shadow 樣本還少，現在主要靠即時結構與排名判斷。'};
  if(hit!=null&&pf!=null&&hit>=60&&pf>=1.2)return {tone:'good',text:'同類型 '+sample+' 筆，命中 '+hit.toFixed(1)+'%，PF '+pf.toFixed(2)+'，歷史表現偏強。'};
  if(hit!=null&&pf!=null&&hit>=55&&pf>=1.0)return {tone:'good',text:'同類型 '+sample+' 筆，命中 '+hit.toFixed(1)+'%，PF '+pf.toFixed(2)+'，目前有優勢，但還不是壓倒性。'};
  if(hit!=null&&pf!=null&&hit>=50&&pf>=.9)return {tone:'neutral',text:'同類型 '+sample+' 筆，命中 '+hit.toFixed(1)+'%，PF '+pf.toFixed(2)+'，屬於中性偏可用，還要看即時盤面。'};
  return {tone:'warn',text:'同類型 '+sample+' 筆的優勢不明顯，這顆現在只是相對排名靠前，不代表適合立刻下單。'};
}
function currentTextV2666(x){
  const s=x?.structure||{},st=String(s.state||'UNKNOWN'),dir=zhDirV2666(x),score=Math.round(Number(x.candidateScore||0)),win=pct(x.candidateWinRate),soft=Array.isArray(x.candidateSoftWait)?x.candidateSoftWait:[];
  let lead='';
  if(st==='INTACT')lead='結構目前完整，'+dir+'還有延續條件。';
  else if(st==='RECLAIMING')lead='結構正在收復，'+dir+'有機會，但還沒完成正式確認。';
  else if(st==='OPPORTUNITY')lead='目前在機會區附近，'+dir+'有條件，但需要看到收復或延續證據。';
  else if(st==='DAMAGED')lead='結構有受損，現在先當觀察，不適合急著出手。';
  else lead='Shadow 把它列進前段候選，但即時結構資料還在建立。';
  const wait=soft.length?'目前主要還在等：'+soft.slice(0,2).join('、')+'。':'目前沒有明顯等待型阻擋。';
  return lead+' Shadow 共識 '+score+' 分，候選勝率 '+win+'。'+wait;
}
function forecastTextV2666(x){
  const win=Number(x.candidateWinRate||0),dir=zhDirV2666(x),band=String(x.candidateBand||'WATCH');
  if(win>=64&&band==='PRIME')return '如果接下來結構沒有被破壞，量能與資金沒有明顯轉弱，'+dir+'延伸的機率目前偏高。反過來，如果收復失敗或大盤轉向，優勢會快速下降。';
  if(win>=59)return '目前比較偏向'+dir+'，但還屬於「有優勢、未確認」。如果後續結構與即時資金同向，才有機會升成正式 B / A；如果只是價格急拉急殺，先不追。';
  return '它是本輪安全標的裡相對較好的候選，但優勢還不夠厚。短線可能先震盪，等 Shadow 再拿到更多確認，方向才會更清楚。';
}
function adviceTextV2666(x){
  const band=String(x.candidateBand||'WATCH'),soft=Array.isArray(x.candidateSoftWait)?x.candidateSoftWait:[],g=x?.formalGap||{},toB=Array.isArray(g.toB)?g.toB:[];
  if(band==='PRIME'&&soft.length===0)return '列為優先觀察。先看 5 分 / 15 分是否繼續同向，再用你的盤感決定要不要打；不要因為它在候選就追價。';
  if(band==='PRIME')return '優先觀察，但先把等待條件看完：'+soft.slice(0,2).join('、')+'。條件沒補齊前，不把它當正式進場訊號。';
  if(band==='RELATIVE')return '先看，不急著打。它只是本輪相對前排；等 '+(toB.slice(0,2).join('、')||'正式確認條件')+' 補上，再重新評估。';
  return '放在觀察名單，等它自己變強。你要打的話，先確認即時結構、量能與大盤沒有反向，再由你自己決定進場位置。';
}
function minsV2667(ms){return Math.max(0,Math.ceil(Number(ms||0)/60000))}
function observedV2667(x){return Math.max(0,Math.floor((Date.now()-Number(x?.candidateSince||Date.now()))/60000))}
function candidateMetaV2667(x){
  const left=zhBandV2666(x),structure=String(x?.structure?.label||'等待結構'),obs=observedV2667(x),remain=minsV2667(x?.candidateRemainingMs);
  return '<div class="candidate-meta-v2667"><span>'+esc(left)+'</span><span>'+esc(structure)+'</span></div>'+
    '<div class="candidate-meta-v2667 sub"><span>已觀察 '+obs+' 分</span><span>'+remain+' 分後自動歸檔</span></div>';
}
/* CANDIDATE_NARRATIVE_LAYOUT_V2676_20260904 */
function hashV2676(v){let h=2166136261;for(const c of String(v||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function pickV2676(x,salt,arr){return arr[(hashV2676(String(x?.symbol||'')+'|'+String(x?.direction||'')+'|'+String(x?.candidateBand||'')+'|'+salt)%arr.length)]}
function cleanCondV2676(v){return String(v||'').replace(/^[-•·\s]+/,'').replace(/[。；;]+$/,'').replace(/\s+/g,' ').trim()}
function condKeyV2676(v){return cleanCondV2676(v).toLowerCase().replace(/[\s、，,。；;：:／/|+＋()（）\[\]【】「」『』]/g,'')}
function uniqCondV2676(items,used=[]){
  const seen=used.map(condKeyV2676).filter(Boolean),out=[];
  for(const raw of items||[]){
    const text=cleanCondV2676(raw),key=condKeyV2676(text);if(!key)continue;
    if(seen.some(k=>k===key||(k.length>=7&&key.includes(k))||(key.length>=7&&k.includes(key))))continue;
    seen.push(key);out.push(text);
  }
  return out;
}
function shadowBridgeV2676(x){
  const a=x?.abcLearning||{},s=x?.shadow||{},e=x?.candidateEvidence||{};
  const abcSample=Number(a.sample||0),legacySample=Number(e.shadowSample??s.sample??0);
  const useAbc=abcSample>0;
  const sample=useAbc?abcSample:legacySample;
  const hit=n(useAbc?a.hitRate:(e.shadowHitRate??s.hitRate));
  const pf=n(useAbc?a.profitFactor:(e.shadowProfitFactor??s.profitFactor));
  const exp=n(useAbc?a.expectancyR:s.expectancyR);
  const adj=n(useAbc?a.adjustment:s.adjustment)??0;
  const level=String(useAbc?(a.level||'ABC Shadow'):(e.shadowLevel||s.level||'Shadow'));
  const active=useAbc?a.active===true:sample>=6;
  return {useAbc,sample,hit,pf,exp,adj,level,active};
}
function signedV2676(v){const x=Number(v||0);return (x>0?'+':'')+x.toFixed(1)}
function shadowTextV2676(x){
  const sh=shadowBridgeV2676(x),name=sh.useAbc?'ABC Shadow':'Shadow';
  if(sh.sample<=0)return {tone:'neutral',text:pickV2676(x,'sh0',[
    '影子樣本尚未成形；這輪不把空白歷史當成優勢，先由即時結構與資金決定候選順位。',
    '目前沒有足夠的同型影子樣本可加權；系統只保留候選資格，等後續結果累積再調整。',
    '影子資料不足時不硬湊勝率；本輪分數主要來自盤面條件，Shadow 只持續收樣本。'
  ])};
  const stat=[name+' '+sh.sample+'筆',sh.hit!=null?'命中 '+sh.hit.toFixed(1)+'%':null,sh.pf!=null?'PF '+sh.pf.toFixed(2):null,sh.exp!=null?'期望 '+sh.exp.toFixed(2)+'R':null].filter(Boolean).join(' · ');
  if(sh.useAbc&&!sh.active)return {tone:'neutral',text:stat+'。樣本還沒到啟用門檻，ABC 回饋暫為 0 分；先累積，不提前放大權重。'};
  if(sh.adj>0)return {tone:'good',text:pickV2676(x,'sh+',[
    stat+'；影子回饋 '+signedV2676(sh.adj)+' 分已直接進候選排序。',
    stat+'。這組結果目前給 '+signedV2676(sh.adj)+' 分正向回饋，已納入候選分數。',
    stat+'；歷史回饋為 '+signedV2676(sh.adj)+' 分，排序已同步吃到這個學習結果。'
  ])};
  if(sh.adj<0)return {tone:'warn',text:pickV2676(x,'sh-',[
    stat+'；影子回饋 '+signedV2676(sh.adj)+' 分正在壓低候選排序，不會因短線看起來強就忽略歷史弱點。',
    stat+'。目前學習回饋是 '+signedV2676(sh.adj)+' 分，系統已把這個負項扣回候選分數。',
    stat+'；歷史端給 '+signedV2676(sh.adj)+' 分負回饋，因此即時盤面要更乾淨才可能升級。'
  ])};
  return {tone:'neutral',text:stat+'；目前影子調整 0.0 分，歷史不加分也不扣分，持續等待新結果更新。'};
}
function marketReadV2676(x){
  const s=x?.structure||{},st=String(s.state||'UNKNOWN'),dir=String(x?.direction||'LONG')==='SHORT'?'空方':'多方',m=candMetricV2671(x);
  const state=st==='INTACT'?'結構完整':st==='RECLAIMING'?'結構收復中':st==='DAMAGED'?'結構受損':st==='OPPORTUNITY'?'位於機會區':'結構待確認';
  const clues=[];
  if(m.vr!=null)clues.push({w:Math.abs(m.vr-1),t:m.vr>=1.15?'量比 '+m.vr.toFixed(2)+'×，成交有放大':m.vr<.75?'量比 '+m.vr.toFixed(2)+'×，成交偏冷':'量比 '+m.vr.toFixed(2)+'×，量能普通'});
  if(m.takerA!=null)clues.push({w:Math.abs(m.takerA)*4,t:m.takerA>=.03?'主動盤與'+dir+'同向':m.takerA<=-.05?'主動盤正在逆著'+dir:'主動盤暫時中性'});
  if(m.topA!=null)clues.push({w:Math.abs(m.topA)*4,t:m.topA>=.03?'大戶方向配合'+dir:m.topA<=-.06?'大戶方向與'+dir+'相反':'大戶方向沒有明顯偏移'});
  clues.sort((a,b)=>b.w-a.w);
  const clue=clues[0]?.t||'即時資金細項仍在補資料';
  return pickV2676(x,'market',[
    state+'；'+clue+'。',
    state+'，目前最值得注意的是：'+clue+'。',
    '盤面先看'+state+'；資金端以「'+clue+'」最有辨識度。',
    state+'。此刻不重複看分數，直接看盤面：'+clue+'。'
  ]);
}
function candidatePlanV2676(x){
  const g=x?.formalGap||{},soft=Array.isArray(x?.candidateSoftWait)?x.candidateSoftWait:[],hard=Array.isArray(x?.candidateHardBlockers)?x.candidateHardBlockers:[];
  const bAll=uniqCondV2676([...(g.toB||[]),...soft]);
  const trigger=bAll[0]||'即時結構與資金同步確認';
  const bRest=uniqCondV2676(bAll.slice(1),[trigger]).slice(0,2);
  const aRest=uniqCondV2676(g.toA||[],[trigger,...bRest]).slice(0,2);
  const hardUniq=uniqCondV2676(hard,[trigger,...bRest,...aRest]).slice(0,3);
  const next=pickV2676(x,'next',[
    '下一個只盯「'+trigger+'」；沒補上前，維持候選，不提前當正式訊號。',
    '升級前最關鍵的一件事是「'+trigger+'」；先等它發生，再重算 A/B。',
    '現在不用多看條件，先等「'+trigger+'」；這一項沒過，就不往正式層推。',
    '下一個判斷節點鎖定「'+trigger+'」；完成後才值得重新比較正式等級。'
  ]);
  return {trigger,bRest,aRest,hardUniq,next};
}
function actionTextV2676(x){
  const band=String(x?.candidateBand||'WATCH'),dir=String(x?.direction||'LONG')==='SHORT'?'空':'多';
  if(band==='PRIME')return pickV2676(x,'actP',[
    '優先開圖，但只照你的建倉規則執行；候選順位高不等於可以追價。',
    '放在第一檢查序列。真正下單仍等你的回踩/確認，不因候選標籤提前進場。',
    '可以先看這顆；若你的'+dir+'方進場條件沒有成立，就繼續等，不用硬做。'
  ]);
  if(band==='RELATIVE')return pickV2676(x,'actR',[
    '先保留在雷達，不急著打；它只是安全層裡相對前排，還不是正式優勢。',
    '目前用途是比較，不是執行。等它自己補強後再決定要不要移進正式名單。',
    '先觀察即可；相對排名只能讓它留下，不能替代你的進場確認。'
  ]);
  if(band==='RESEARCH')return pickV2676(x,'actX',[
    '只當研究標的；沒有新增明確證據就略過，不占用正式交易注意力。',
    '研究層先收資料，不下結論；等條件改善再回到可執行候選。',
    '先讓系統繼續追蹤，不需要主動找單；有新加分再看。'
  ]);
  return pickV2676(x,'actW',[
    '值得看，但先讓盤面證明自己；候選只是提醒你開圖，不是叫你進場。',
    '維持觀察，等你的進場規則成立再處理；現在不需要為了怕錯過而追。',
    '先看後等。只要你的確認條件沒到，就把它留在候選，不做額外動作。'
  ]);
}
function upgradeHtmlV2676(plan){
  const b=plan.bRest.length?plan.bRest.join(' · '):'B 條件已接近，只等下一個判斷節點';
  const a=plan.aRest.length?plan.aRest.join(' · '):'在 B 基礎上再需要更高一致性';
  return '<div class="candidate-upgrade-v2676"><b>升級路徑</b><div><span>B</span><p>'+esc(b)+'</p></div><div><span>A</span><p>'+esc(a)+'</p></div></div>';
}
function card(x){
  const id=keyOf(x),ck=String(x?.candidateKey||id),s=x.structure||{},open=opens()[id]===true,currentPx=n(x?.entry?.currentPrice),health=n(s.health),remain=Math.max(0,Math.ceil(Number(x?.candidateRemainingMs||0)/60000));
  const sh=shadowTextV2676(x),market=marketReadV2676(x),plan=candidatePlanV2676(x),action=actionTextV2676(x),d=candDraftV2671(ck);
  const fv=(k,f='')=>esc(Object.prototype.hasOwnProperty.call(d,k)?d[k]:(f??''));
  const hardHtml=plan.hardUniq.length?'<div class="candidate-hard-v2676"><b>硬失效</b><p>'+esc(plan.hardUniq.join(' · '))+'</p></div>':'';
  return '<article class="mw-card mw-candidate-card-v2664 candidate-narrative-v2666 candidate-v2667 candidate-v2671 candidate-v2676" data-candidate-id="'+esc(id)+'" data-candidate-key="'+esc(ck)+'">'+
    '<details '+(open?'open':'')+'>'+
      '<summary>'+
        '<span class="mw-grade candidate">候</span>'+
        '<div class="mw-main candidate-main-v2667"><div class="candidate-title-v2667"><a href="'+tvUrl(x.symbol)+'" target="_blank" rel="noopener">'+esc(x.symbol)+'</a><em class="'+(x.direction==='SHORT'?'short':'long')+'">'+(x.direction==='SHORT'?'做空':'做多')+'</em></div>'+candidateMetaV2667(x)+'</div>'+
        '<div class="mw-score candidate-score"><b>'+pct(x.candidateWinRate)+'</b><span>候選勝率</span></div>'+
        '<button type="button" class="candidate-delete-v2671" data-candidate-dismiss="'+esc(ck)+'" aria-label="移到候選歷史">×</button>'+
        '<i class="mw-chevron">⌄</i>'+
      '</summary>'+
      '<div class="mw-body">'+
        '<div class="candidate-topline-v2676">'+
          '<div><span>候選分</span><b>'+Math.round(Number(x.candidateScore||0))+'</b></div>'+
          '<div><span>現價</span><b>'+(currentPx==null?'—':px(currentPx))+'</b></div>'+
          '<div><span>結構</span><b>'+(health==null?'—':Math.round(health))+'</b></div>'+
          '<div><span>效期</span><b>'+(remain>0?remain+'分':'本輪')+'</b></div>'+
        '</div>'+
        '<div class="candidate-story-grid-v2676">'+
          '<section class="shadow '+sh.tone+'"><b>影子學習</b><p>'+esc(sh.text)+'</p></section>'+
          '<section><b>盤面現在</b><p>'+esc(market)+'</p></section>'+
          '<section><b>下一步</b><p>'+esc(plan.next)+'</p></section>'+
          '<section class="action"><b>執行</b><p>'+esc(action)+'</p></section>'+
        '</div>'+upgradeHtmlV2676(plan)+hardHtml+
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
function pipelineLine(p,rows){
  const a=Number(p?.formalA||0),b=Number(p?.formalB||0);
  const deep=Number(p?.deepAnalyzed??p?.analyzed??0);
  const universe=Number(p?.candidateUniverse??p?.ranked??0);
  const safe=Number(p?.hardSafe||0);
  return '深析 '+deep+' → 候選池 '+universe+' → 安全 '+safe+' → A/B '+(a+b)+' → 候選 '+rows.length;
}
function render(){
  const h=ensureHost();if(!h||!data)return;
  const rows=(data.rows||[]).filter(x=>x?.candidate===true&&x?.trade?.status!=='ACTIVE').slice(0,5);
  const p=data.pipeline||{},rejects=Array.isArray(p.topRejects)?p.topRejects.slice(0,3):[];
  const deep=Number(p.deepAnalyzed??p.analyzed??0),pool=Number(p.candidateUniverse??p.ranked??0),safe=Number(p.hardSafe||0),ab=Number(p.formalA||0)+Number(p.formalB||0);
  const pipe='深析 '+deep+' · 候選池 '+pool+' · 安全 '+safe+' · A/B '+ab;
  const rejectText=rejects.map(x=>esc(x.reason)+' '+Number(x.count||0)).join(' · ');
  const sig=JSON.stringify([rows.map(x=>[
    keyOf(x),Math.round(Number(x.candidateScore||0)),Number(x.candidateWinRate||0).toFixed(1),x.candidateBand,
    Math.ceil(Number(x.candidateRemainingMs||0)/60000),x.structure?.state,x.trackerStatus,n(x?.abcLearning?.adjustment),
    Number(x?.abcLearning?.sample||0),n(x?.marketMetrics?.volumeRatio),n(x?.marketMetrics?.takerRatio),n(x?.marketMetrics?.topRatio)
  ]),pipe,rejectText]);
  if(sig===lastSig&&h.querySelector('.candidate-list-v2664')){renderHistoryV2671();renderNotifyCustomV2673();return}
  lastSig=sig;
  h.innerHTML=
    '<summary class="candidate-group-summary-v2667 candidate-group-summary-v2671 candidate-group-summary-v2673 candidate-compact-v2676">'+
      '<div class="candidate-group-title-v2667"><b>候選</b><span>'+rows.length+'</span></div>'+
      '<small class="candidate-pipeline-v2676">'+esc(pipe)+'</small>'+
      '<button type="button" class="candidate-refresh-v2671 candidate-refresh-v2673" data-candidate-refresh aria-label="更新候選">↻</button>'+
      '<i>⌄</i>'+
    '</summary>'+
    '<div class="mw-list candidate-list-v2664">'+
      (rows.length?rows.map(card).join(''):'<div class="mw-empty">本輪沒有有效候選'+(rejectText?' · 主要淘汰：'+rejectText:'')+'</div>')+
    '</div>';
  renderHistoryV2671();renderNotifyCustomV2673();
}
function row(id){return (data?.rows||[]).find(x=>x?.candidate===true&&keyOf(x)===id)||null}
function inputVal(card,k){const v=card?.querySelector('[data-cf="'+k+'"]')?.value;return v===''?null:Number(v)}
async function build(id){
  const x=row(id),card=document.querySelector('.mw-candidate-card-v2664[data-candidate-id="'+CSS.escape(id)+'"]'),msg=card?.querySelector('[data-candidate-msg="'+CSS.escape(id)+'"]');
  if(!x||!card||!msg)return;
  const body={
    manualMode:true,manualGrade:'C',manualGradeScore:x.candidateScore,manualGradeAt:data.generatedAt,
    manualOpportunityId:x.id,manualReasons:[...(x.candidateReasons||[]),...(x.tradeCautions||[])].slice(0,8),
    signalKey:x.signalKey,notificationId:null,symbol:x.symbol,direction:x.direction,strategyId:x.strategyId,
    strategyLabel:x.strategyLabel,marketRegime:x.marketRegime,notificationTier:'CANDIDATE',
    entryPrice:inputVal(card,'entry'),tp1:inputVal(card,'tp1'),tp2:inputVal(card,'tp2'),
    sp1:inputVal(card,'sp1'),sp2:inputVal(card,'sp2'),margin:inputVal(card,'margin'),
    quantity:inputVal(card,'quantity'),leverage:inputVal(card,'leverage'),
    manualSnapshot:{
      rank:x.rank,rankScore:x.rankScore,estimatedWinRate:x.estimatedWinRate,calibratedWinRate:x.calibratedWinRate,
      notificationTier:'CANDIDATE',observationProgress:x.observationProgress,dataCoverage:x.dataHealth?.coverage,
      dataConfidence:x.dataHealth?.confidence,structureState:x.structure?.state,structureHealth:x.structure?.health,
      structureLearningAdjustment:x.structure?.learningAdjustment,shadowSample:x.shadow?.sample,
      shadowHitRate:x.shadow?.hitRate,shadowProfitFactor:x.shadow?.profitFactor,rr:x.entry?.rr,
      freshnessAgeMs:x.freshnessAgeMs,entryZoneLow:x.entry?.zoneLow,entryZoneHigh:x.entry?.zoneHigh,
      stop:x.entry?.stop,target:x.entry?.target,target2:x.entry?.target2
    }
  };
  msg.textContent='建立中…';
  try{
    await json('/api/actual-trades',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    msg.textContent='✓ 已建立；後台照實際 TP / SP 結果回寫學習';
    setTimeout(()=>refresh(true),800);
  }catch(e){msg.textContent='✕ '+e.message}
}
async function refresh(force=false){
  if(busy)return;
  busy=true;
  try{
    data=await json('/api/manual-opportunities'+(force?'?force=1':''));
    waitForHost();render();
  }catch(e){
    const h=ensureHost();
    if(h&&!data)h.innerHTML='<summary><div><b>候選</b><span>0</span></div><small>候選資料暫時不可用</small><i>⌄</i></summary><div class="mw-empty">'+esc(e.message)+'</div>';
  }finally{busy=false}
}
function bind(){
  document.addEventListener('click',e=>{
    const c=e.target.closest?.('[data-candidate-current]');
    if(c){
      e.preventDefault();
      const x=row(c.dataset.candidateCurrent),card=c.closest('.mw-candidate-card-v2664'),i=card?.querySelector('[data-cf="entry"]');
      if(x&&i&&n(x.entry?.currentPrice)!=null){i.value=String(x.entry.currentPrice);saveDraft(c.dataset.candidateCurrent,'entry',i.value)}
      return;
    }
    const b=e.target.closest?.('[data-candidate-build]');
    if(b){e.preventDefault();void build(b.dataset.candidateBuild);return}
  },true);
  document.addEventListener('input',e=>{
    const i=e.target.closest?.('.mw-candidate-card-v2664 [data-cf]');
    if(!i)return;
    const id=i.closest('.mw-candidate-card-v2664')?.dataset?.candidateId;
    if(id)saveDraft(id,i.dataset.cf,i.value);
  });
  document.addEventListener('toggle',e=>{
    const d=e.target;
    if(!(d instanceof HTMLDetailsElement)||!d.closest?.('.mw-candidate-card-v2664'))return;
    const id=d.closest('.mw-candidate-card-v2664')?.dataset?.candidateId,o=opens();
    if(d.open)o[id]=true;else delete o[id];
    write(OPEN_KEY,o);
  },{capture:true});
}
function boot(){
  bind();waitForHost();void refresh(true);
  timer=setInterval(()=>{
    if(document.visibilityState!=='visible')return;
    const p=currentPage();
    if(p==='ideas'||p==='test')void refresh(false);
  },60000);
  window.addEventListener('pageshow',()=>{waitForHost();void refresh(false)});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){waitForHost();void refresh(false)}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.ManualCandidateV2664={version:VERSION,refresh};
bindCandidateOpsV2671();
bindNotifyCustomV2673();
})();