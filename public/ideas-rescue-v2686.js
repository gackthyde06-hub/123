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
  const cand=Number(x?.candidateWinRate), cal=Number(x?.calibratedWinRate);
  const main=Number.isFinite(cand)?cand:Number.isFinite(cal)?cal:null;
  return main==null?'—':main.toFixed(0)+'%';
}
function killStray(){
  ['ideasRescueV2686'].forEach(id=>document.getElementById(id)?.remove());
  const ideas=document.getElementById('page-ideas');
  const align=document.getElementById('alignShadowV2687');
  if(ideas&&align&&ideas.contains(align)) align.remove();
  if(!ideas) return;
  [...ideas.querySelectorAll('.traderName,.sectionTitle')].forEach(el=>{
    const t=el.textContent||'';
    if(t.includes('今日可看')||t.includes('參考標的')) el.closest('section,.traderCard')?.remove();
  });
}
function emptyGroup(g,label){
  return '<details class="mw-group grade-'+g.toLowerCase()+'" open><summary><div><b>'+g+'級</b><span>0</span></div><small>'+label+'</small><i>⌄</i></summary><div class="mw-list"><div class="mw-empty">目前沒有 '+g+' 級標的</div></div></details>';
}
function ensureWorkspace(){
  const ideas=document.getElementById('page-ideas'); if(!ideas) return null;
  let mount=document.getElementById('manualWorkspaceV2638');
  if(!mount){
    mount=document.createElement('section');
    mount.id='manualWorkspaceV2638';
    mount.className='manual-workspace-v2638';
    ideas.appendChild(mount);
  }
  if(!mount.querySelector('.mw-shell')){
    mount.innerHTML='<div class="mw-title"><b>手動建議</b><span>A＝高完成度 · B＝值得看；最後由你看盤扣拓機</span></div>'+
      '<div class="mw-shell">'+emptyGroup('A','優先 · 手動建議')+emptyGroup('B','次優先 · 手動建議')+'</div>'+
      '<div id="manualNoticeLedgerV2639" class="manual-notice-ledger-v2639"><details class="mn-section auto" open><summary><div><b>自動通知</b><span>0</span></div><small>正式 A/B 推到手機的單</small><i>⌄</i></summary><div class="mn-list"><div class="mn-empty">目前沒有追蹤中的自動通知</div></div></details></div>';
  }
  return mount;
}
function placeCandidate(){
  const ideas=document.getElementById('page-ideas'); if(!ideas) return null;
  let host=document.getElementById('ideasCandidateRefV2686');
  if(!host){host=document.createElement('section');host.id='ideasCandidateRefV2686';host.className='traderCard';host.style.margin='12px 0 16px'}
  const ws=document.getElementById('manualWorkspaceV2638');
  if(ws&&ws.parentNode) ws.parentNode.insertBefore(host, ws.nextSibling);
  else ideas.appendChild(host);
  return host;
}
function renderCand(host, rows){
  const ref=(rows||[]).filter(x=>x&&x.grade!=='A'&&x.grade!=='B'&&x.candidate===true)
    .sort((a,b)=>Number(b.candidateScore||0)-Number(a.candidateScore||0))
    .slice(0,5);
  if(!ref.length){
    host.innerHTML='<div class="traderTop"><div class="traderMain"><div class="traderName">候選</div><div class="stateInfo">不是 A/B，但觀察後相對最有機會。不推播。</div></div><div class="radarCount">0</div></div>';
    return;
  }
  host.innerHTML='<div class="traderTop"><div class="traderMain"><div class="traderName">候選</div><div class="stateInfo">不推播。系統觀察後認為相對最有機會</div></div><div class="radarCount">'+ref.length+'檔</div></div>'+
    ref.map(x=>'<div class="consensusRow"><div class="consensusMain"><div class="consensusLine"><b class="consensusSymbol">'+esc(x.symbol)+'</b><span class="dirBadge '+(String(x.direction).toLowerCase()==='short'?'short':'long')+'">'+(x.direction==='SHORT'?'做空':'做多')+'</span><span class="levelBadge medium">'+esc(x.candidateBand||'候選')+'</span></div><div class="consensusMeta">勝率 <b>'+esc(winText(x))+'</b> · 候選分 '+(x.candidateScore!=null?Number(x.candidateScore).toFixed(0):'—')+'</div></div><div class="consensusScore"><a href="'+tv(x.symbol)+'" target="_blank" rel="noopener" style="color:#e0bb68;text-decoration:none;font-size:11px">開圖</a></div></div>').join('');
}
async function refresh(){
  killStray();
  ensureWorkspace();
  const host=placeCandidate(); if(!host) return;
  try{
    const r=await fetch('/api/manual-opportunities',{cache:'no-store'});
    const d=await r.json();
    if(d?.ok) renderCand(host, d.rows||[]);
  }catch{}
}
function boot(){
  reorderTabs();
  void refresh();
  setInterval(()=>{ if(!document.hidden){ reorderTabs(); void refresh(); } }, 20000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
