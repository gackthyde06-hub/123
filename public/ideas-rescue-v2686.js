(()=>{
'use strict';
const TAB_ORDER=['monitor','ideas','today','flow','performance','test'];
const TAB_LABEL={monitor:'監控',ideas:'建議',today:'今日',flow:'流向',performance:'績效',test:'觀察'};
function reorderTabs(){
  const bar=document.querySelector('.pageTabs'); if(!bar) return;
  const map=new Map([...bar.querySelectorAll('.pageTab')].map(b=>[b.dataset.page,b]));
  TAB_ORDER.forEach(k=>{const b=map.get(k); if(b) bar.appendChild(b);});
  [...bar.querySelectorAll('.pageTab')].forEach(b=>{const t=TAB_LABEL[b.dataset.page]; if(t) b.textContent=t;});
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]))}
function tv(sym){return 'https://www.tradingview.com/chart/?symbol='+encodeURIComponent('BINANCE:'+String(sym||'').toUpperCase()+'.P')}
function winText(x){
  const cal=Number(x?.calibratedWinRate);
  const est=Number(x?.estimatedWinRate);
  const sh=Number(x?.shadow?.hitRate);
  const main=Number.isFinite(cal)?cal:Number.isFinite(est)?est:null;
  const extra=Number.isFinite(sh)?`影子 ${sh.toFixed(0)}%`:'';
  return (main==null?'—':main.toFixed(0)+'%')+(extra?' · '+extra:'');
}
function placeHost(){
  const ideas=document.getElementById('page-ideas'); if(!ideas) return null;
  let host=document.getElementById('ideasRescueV2686');
  if(!host){host=document.createElement('section');host.id='ideasRescueV2686';host.className='traderCard';host.style.margin='12px 0 16px'}
  const ws=document.getElementById('manualWorkspaceV2638');
  const notices=document.getElementById('manualNoticeLedgerV2639');
  if(notices&&notices.parentNode) notices.parentNode.insertBefore(host, notices.nextSibling);
  else if(ws&&ws.parentNode) ws.parentNode.insertBefore(host, ws.nextSibling);
  else ideas.appendChild(host);
  return host;
}
function renderRef(host, rows){
  const ref=rows.filter(x=>x && x.grade!=='A' && x.grade!=='B').slice(0,12);
  if(!ref.length){
    host.innerHTML='<div class="traderTop"><div class="traderMain"><div class="traderName">參考標的</div><div class="stateInfo">A/B 仍在上方原位。下面沒有 C 可參考。</div></div></div>';
    return;
  }
  host.innerHTML='<div class="traderTop"><div class="traderMain"><div class="traderName">參考標的</div><div class="stateInfo">不推播。想打再開圖，勝率是估算不是保證</div></div><div class="radarCount">'+ref.length+'檔</div></div>'+
    ref.map(x=>'<div class="consensusRow"><div class="consensusMain"><div class="consensusLine"><b class="consensusSymbol">'+esc(x.symbol)+'</b><span class="dirBadge '+(String(x.direction).toLowerCase()==='short'?'short':'long')+'">'+(x.direction==='SHORT'?'做空':'做多')+'</span><span class="levelBadge low">C 參考</span></div><div class="consensusMeta">'+esc(x.strategyLabel||x.strategyId||'未分類')+' · 校準勝率 <b>'+esc(winText(x))+'</b>'+(x.observationProgress!=null?' · 完成度 '+Number(x.observationProgress).toFixed(0):'')+'</div></div><div class="consensusScore"><a href="'+tv(x.symbol)+'" target="_blank" rel="noopener" style="color:#e0bb68;text-decoration:none;font-size:11px">開圖</a><small>'+esc(x.grade||'C')+'</small></div></div>').join('');
}
async function refresh(){
  const host=placeHost(); if(!host) return;
  try{
    const r=await fetch('/api/manual-opportunities',{cache:'no-store'});
    const d=await r.json();
    if(d?.ok) renderRef(host, d.rows||[]);
  }catch{}
}
function boot(){
  reorderTabs();
  void refresh();
  setInterval(()=>{reorderTabs();void refresh();},15000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
