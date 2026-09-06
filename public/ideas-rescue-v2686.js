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
function gradeLabel(g){return g==='A'?'A 可看可打':g==='B'?'B 值得看圖':'C 先看圖不追'}
function renderList(host, payload){
  const rows=Array.isArray(payload?.rows)?payload.rows:[];
  const ab=rows.filter(x=>x.grade==='A'||x.grade==='B');
  const c=rows.filter(x=>x.grade==='C');
  const cand=rows.filter(x=>x.grade!=='A'&&x.grade!=='B'&&x.grade!=='C');
  const show=[...ab,...c.slice(0,8),...cand.slice(0,4)];
  if(!show.length){
    host.innerHTML='<div class="mw-empty">現在沒有 A/B。影子沒有放行正式訊號時，這裡會空；請先看監控倉位，不要亂打。</div>';
    return;
  }
  host.innerHTML='<div class="sectionBar"><div class="sectionTitle">今日可看標的</div><div class="radarCount">'+show.length+'檔</div></div>'+
    show.map(x=>'<div class="consensusRow"><div class="consensusMain"><div class="consensusLine"><b class="consensusSymbol">'+esc(x.symbol)+'</b><span class="dirBadge '+(String(x.direction).toLowerCase()==='short'?'short':'long')+'">'+(x.direction==='SHORT'?'做空':'做多')+'</span><span class="levelBadge '+(x.grade==='A'?'high':x.grade==='B'?'medium':'low')+'">'+esc(gradeLabel(x.grade))+'</span></div><div class="consensusMeta">'+(esc(x.strategyLabel||x.strategyId||'待定'))+' · 校準 '+(x.calibratedWinRate!=null?Number(x.calibratedWinRate).toFixed(0)+'%':'—')+' · 完成度 '+(x.observationProgress!=null?Number(x.observationProgress).toFixed(0):'—')+'</div></div><div class="consensusScore"><a href="'+tv(x.symbol)+'" target="_blank" rel="noopener" style="color:#e0bb68;text-decoration:none;font-size:11px">開圖</a><small>'+esc(x.grade||'')+'</small></div></div>').join('')+
    '<div class="sourceNote">A/B 才會推播。C 只是你可以開圖的候補，不是下單指令。</div>';
}
async function rescue(){
  const page=document.getElementById('page-ideas'); if(!page) return;
  let host=document.getElementById('ideasRescueV2686');
  if(!host){host=document.createElement('div');host.id='ideasRescueV2686';host.style.margin='8px 0 12px';page.prepend(host)}
  const broken=document.querySelector('#manualWorkspaceV2638 .mw-empty');
  try{
    const r=await fetch('/api/manual-opportunities',{cache:'no-store'});
    const d=await r.json();
    if(d?.ok && Array.isArray(d.rows) && (d.rows.length||broken)) renderList(host,d);
    else if(broken) host.innerHTML='<div class="mw-empty">建議暫時讀不到，10 秒後會重試。</div>';
  }catch{
    if(broken) host.innerHTML='<div class="mw-empty">建議連線中，系統會自動重試。</div>';
  }
}
function boot(){
  reorderTabs();
  void rescue();
  setInterval(()=>{reorderTabs();void rescue();},12000);
  document.querySelector('.pageTabs')?.addEventListener('click',()=>setTimeout(rescue,80));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
