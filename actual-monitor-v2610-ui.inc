// UI_POLISH_V2610: pin user-entered Actual Trades above system monitor signals.
// Resolved records stay visible here for 24h (server-side window) or until the local X is pressed.
// Hiding from this monitor history never deletes the audited Actual Trade / performance record.
const ACTUAL_MONITOR_HISTORY_HIDE_PREF_V2610='position-alert-actual-monitor-history-hidden-v2610';
function actualMonitorRowsV2610(kind='active'){const a=testSignalsState?.actualMonitor;return Array.isArray(a?.[kind])?a[kind]:[]}
function actualMonitorRecordV2610(id){return [...actualMonitorRowsV2610('active'),...actualMonitorRowsV2610('recent')].find(x=>x?.id===id)||null}
function actualMonitorHiddenV2610(){try{const d=JSON.parse(localStorage.getItem(ACTUAL_MONITOR_HISTORY_HIDE_PREF_V2610)||'{}');return d&&typeof d==='object'?d:{}}catch{return{}}}
function actualMonitorHideHistoryV2610(id){if(!id)return;try{const d=actualMonitorHiddenV2610();d[id]=Date.now();const rows=Object.entries(d).sort((a,b)=>Number(b[1]||0)-Number(a[1]||0)).slice(0,120);localStorage.setItem(ACTUAL_MONITOR_HISTORY_HIDE_PREF_V2610,JSON.stringify(Object.fromEntries(rows)))}catch{}renderTestFocus()}
function actualMonitorPnlTextV2610(v){if(!hasNum(v))return'—';const n=Number(v);return`${n>0?'+':''}${n.toFixed(Math.abs(n)>=100?0:Math.abs(n)>=10?1:2)} U`}
function actualMonitorPnlClassV2610(v){const n=Number(v);return!Number.isFinite(n)||Math.abs(n)<1e-9?'flat':n>0?'profit':'loss'}
function actualMonitorResultTextV2610(x){if(x?.status==='ACTIVE')return'追蹤中';if(x?.result==='WIN')return'TP 完成';if(x?.result==='LOSS')return'SP 失效';if(x?.result==='MANUAL')return'手動結束';return x?.firstOutcome==='WIN'?'曾先碰 TP':x?.firstOutcome==='LOSS'?'曾先碰 SP':'已結束'}
function actualMonitorTimeTextV2610(x){const iso=x?.resultAt||x?.updatedAt||x?.createdAt;return iso?`${perfDateTime(iso)} · ${ageText(iso)}`:'—'}
function actualMonitorLevelsV2610(x){const tps=[x?.tp1,x?.tp2].filter(hasNum).map(price).join(' / ')||'—',sps=[x?.sp1,x?.sp2].filter(hasNum).map(price).join(' / ')||'—';return {tps,sps}}
function actualMonitorActiveCardV2610(x){
  const long=x?.direction!=='SHORT',lv=actualMonitorLevelsV2610(x),pnlv=hasNum(x?.livePnl)?Number(x.livePnl):null,pnlText=actualMonitorPnlTextV2610(pnlv),hit=x?.tp1Hit&&!x?.tp2Hit?'TP1 已到':x?.tp2Hit?'TP2 已到':x?.sp1Hit||x?.sp2Hit?'SP 已到':'即時追蹤';
  return `<article class="actualMonitorCardV2610 ${long?'long':'short'}"><div class="actualMonitorTopV2610"><div><span class="actualMonitorLiveTagV2610">實倉</span>${tvAnchor(x.symbol,'tvNameLink actualMonitorSymbolV2610')}<span class="actualMonitorDirV2610 ${long?'long':'short'}">${long?'做多':'做空'}</span></div><b class="actualMonitorPnlV2610 ${actualMonitorPnlClassV2610(pnlv)}">${pnlText}</b></div><div class="actualMonitorMetaV2610"><span>建倉 ${perfDateTime(x.createdAt)}</span><span>${esc(hit)}</span></div><div class="actualMonitorPriceGridV2610"><div><span>成本</span><b>${price(x.entryPrice)}</b></div><div><span>當下</span><b>${hasNum(x.lastPrice)?price(x.lastPrice):'—'}</b></div><div><span>TP1 / TP2</span><b>${lv.tps}</b></div><div><span>SP1 / SP2</span><b>${lv.sps}</b></div></div><div class="actualMonitorActionsV2610"><button type="button" data-actual-monitor-edit="${esc(x.id)}">修改</button><button type="button" class="end" data-actual-monitor-close="${esc(x.id)}">結束追蹤</button></div></article>`;
}
function actualMonitorHistoryRowV2610(x){const long=x?.direction!=='SHORT',pnlv=hasNum(x?.estimatedPnl)?Number(x.estimatedPnl):null;return `<div class="actualMonitorHistoryRowV2610"><div class="actualMonitorHistoryMainV2610"><div>${tvAnchor(x.symbol,'tvNameLink actualMonitorHistorySymbolV2610')}<span class="actualMonitorDirV2610 ${long?'long':'short'}">${long?'多':'空'}</span><b class="actualMonitorHistoryResultV2610 ${String(x?.result||'').toLowerCase()}">${esc(actualMonitorResultTextV2610(x))}</b></div><span>${actualMonitorTimeTextV2610(x)} · 成本 ${price(x.entryPrice)}</span></div><div class="actualMonitorHistoryRightV2610"><b class="${actualMonitorPnlClassV2610(pnlv)}">${actualMonitorPnlTextV2610(pnlv)}</b><button type="button" data-actual-history-hide="${esc(x.id)}" aria-label="從監控歷史隱藏 ${esc(x.symbol)}" title="只從監控歷史隱藏，不刪除績效紀錄">×</button></div></div>`}
function renderActualMonitorV2610(panel){
  if(!panel)return;panel.querySelector('.actualMonitorV2610')?.remove();
  const active=actualMonitorRowsV2610('active'),hidden=actualMonitorHiddenV2610(),recent=actualMonitorRowsV2610('recent').filter(x=>!hidden[x.id]);
  if(!active.length&&!recent.length)return;
  const shell=document.createElement('section');shell.className='actualMonitorV2610';
  const historyHours=Number(testSignalsState?.actualMonitor?.historyHours||24);
  shell.innerHTML=`<div class="actualMonitorHeadV2610"><div><span>MY ACTUAL TRADES</span><b>我的實際建倉</b><small>已建立的實倉獨立固定在監控，不會因離開 B 級／觀察榜而消失</small></div><em>${active.length} ACTIVE</em></div>${active.length?`<div class="actualMonitorListV2610">${active.map(actualMonitorActiveCardV2610).join('')}</div>`:'<div class="actualMonitorEmptyV2610">目前沒有追蹤中的實際建倉。</div>'}<details class="actualMonitorHistoryV2610" data-persist-detail="actualMonitorHistoryV2610" ${detailOpenAttr('actualMonitorHistoryV2610')}><summary><span>歷史</span><b>${recent.length}</b><small>結束後保留 ${historyHours} 小時 · × 可立即隱藏</small><i>⌄</i></summary><div class="actualMonitorHistoryListV2610">${recent.length?recent.map(actualMonitorHistoryRowV2610).join(''):`<div class="actualMonitorHistoryEmptyV2610">近 ${historyHours} 小時沒有已結束的實際建倉。</div>`}<small class="actualMonitorHistoryNoteV2610">× 或到期只會從「監控」畫面消失；績效、CSV、Railway Volume 原始紀錄仍完整保留。</small></div></details>`;
  const header=panel.querySelector('.testMonitorHeader');if(header)header.insertAdjacentElement('afterend',shell);else panel.prepend(shell);bindPersistentDetails(shell);
}
window.addEventListener('actual-trade:saved',()=>{setTimeout(()=>void refreshTestSignals(true),80)});
document.addEventListener('click',e=>{
  const edit=e.target?.closest?.('[data-actual-monitor-edit]');if(edit){e.preventDefault();e.stopPropagation();const rec=actualMonitorRecordV2610(edit.dataset.actualMonitorEdit);if(rec)openActualTradeRecordModal(rec);return}
  const close=e.target?.closest?.('[data-actual-monitor-close]');if(close){e.preventDefault();e.stopPropagation();void (async()=>{await closeActualTrackedTrade(close.dataset.actualMonitorClose);setTimeout(()=>void refreshTestSignals(true),180)})();return}
  const hide=e.target?.closest?.('[data-actual-history-hide]');if(hide){e.preventDefault();e.stopPropagation();actualMonitorHideHistoryV2610(hide.dataset.actualHistoryHide)}
},true);
