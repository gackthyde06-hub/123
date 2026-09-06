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
  const cand=Number(x?.candidateWinRate);
  const cal=Number(x?.calibratedWinRate);
  const sh=Number(x?.shadow?.hitRate);
  const main=Number.isFinite(cand)?cand:Number.isFinite(cal)?cal:null;
  const extra=Number.isFinite(sh)?`影子 ${sh.toFixed(0)}%`:'';
  return (main==null?'—':main.toFixed(0)+'%')+(extra?' · '+extra:'');
}
function placeHost(){
  const ideas=document.getElementById('page-ideas'); if(!ideas) return null;
  const stale=document.getElementById('ideasRescueV2686');
  // remove old "今日可看/參考" block if it was prepended on top
  if(stale && stale.parentElement===ideas && ideas.firstElementChild===stale) stale.remove();
  let host=document.getElementById('ideasCandidateRefV2686');
  if(!host){host=document.createElement('section');host.id='ideasCandidateRefV2686';host.className='traderCard';host.style.margin='12px 0 16px'}
  const ws=document.getElementById('manualWorkspaceV2638');
  const notices=document.getElementById('manualNoticeLedgerV2639');
  if(notices&&notices.parentNode) notices.parentNode.insertBefore(host, notices.nextSibling);
  else if(ws&&ws.parentNode) ws.parentNode.insertBefore(host, ws.nextSibling);
  else ideas.appendChild(host);
  return host;
}
function renderCand(host, rows){
  const ref=(rows||[]).filter(x=>x && x.grade!=='A' && x.grade!=='B' && x.candidate===true)
    .sort((a,b)=>Number(b.candidateScore||b.executionScore||0)-Number(a.candidateScore||a.executionScore||0))
    .slice(0,5);
  if(!ref.length){
    host.innerHTML='<div class="traderTop"><div class="traderMain"><div class="traderName">候選</div><div class="stateInfo">不是 A/B，但觀察後相對最有機會的才會出現。目前沒有。</div></div><div class="radarCount">0</div></div>';
    return;
  }
  host.innerHTML='<div class="traderTop"><div class="traderMain"><div class="traderName">候選</div><div class="stateInfo">不推播。系統觀察後認為相對最有機會，仍要你看圖</div></div><div class="radarCount">'+ref.length+'檔</div></div>'+
    ref.map(x=>'<div class="consensusRow"><div class="consensusMain"><div class="consensusLine"><b class="consensusSymbol">'+esc(x.symbol)+'</b><span class="dirBadge '+(String(x.direction).toLowerCase()==='short'?'short':'long')+'">'+(x.direction==='SHORT'?'做空':'做多')+'</span><span class="levelBadge medium">'+esc(x.candidateBand||'候選')+'</span></div><div class="consensusMeta">'+esc(x.strategyLabel||x.strategyId||'未分類')+' · 勝率 <b>'+esc(winText(x))+'</b> · 候選分 '+(x.candidateScore!=null?Number(x.candidateScore).toFixed(0):'—')+'</div></div><div class="consensusScore"><a href="'+tv(x.symbol)+'" target="_blank" rel="noopener" style="color:#e0bb68;text-decoration:none;font-size:11px">開圖</a><small>非A/B</small></div></div>').join('');
}
async function refresh(){
  const leftover=document.getElementById('ideasRescueV2686'); if(leftover) leftover.remove();
  const host=placeHost(); if(!host) return;
  try{
    const r=await fetch('/api/manual-opportunities',{cache:'no-store'});
    const d=await r.json();
    if(d?.ok) renderCand(host, d.rows||[]);
  }catch{}
}
function boot(){
  reorderTabs();
  void refresh();
  setInterval(()=>{reorderTabs();void refresh();},15000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
