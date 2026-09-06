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
function num(v){const x=Number(v);return Number.isFinite(x)?x:null}
function winOf(x){return num(x?.candidateWinRate)??num(x?.calibratedWinRate)??num(x?.estimatedWinRate)}
function wipeStale(){
  document.getElementById('ideasRescueV2686')?.remove();
  const ideas=document.getElementById('page-ideas');
  if(!ideas) return;
  ideas.querySelector('#alignShadowV2687')?.remove();
  [...ideas.querySelectorAll('.sectionTitle,.traderName,b')].forEach(el=>{
    const t=String(el.textContent||'');
    if(t.includes('今日可看')||t.includes('先看圖不追')||t.includes('參考標的')){
      el.closest('section,.traderCard,#ideasRescueV2686')?.remove();
    }
  });
}
function emptyGroup(g,sub){
  return '<details class="mw-group grade-'+g.toLowerCase()+'" open><summary><div><b>'+g+'級</b><span>0</span></div><small>'+sub+'</small><i>⌄</i></summary><div class="mw-list"><div class="mw-empty">目前沒有 '+g+' 級</div></div></details>';
}
function ensureAB(){
  const ideas=document.getElementById('page-ideas'); if(!ideas) return;
  let mount=document.getElementById('manualWorkspaceV2638');
  if(!mount){
    mount=document.createElement('section');
    mount.id='manualWorkspaceV2638';
    mount.className='manual-workspace-v2638';
    const rec=document.getElementById('recGrid');
    if(rec&&rec.parentNode===ideas) ideas.insertBefore(mount, rec);
    else ideas.appendChild(mount);
  }
  if(!mount.querySelector('.mw-shell')){
    mount.innerHTML='<div class="mw-title"><b>手動建議</b><span>A 高完成度 · B 值得看圖</span></div>'+
      '<div class="mw-shell">'+emptyGroup('A','優先 · 手動')+emptyGroup('B','次優先 · 手動')+'</div>'+
      '<div id="manualNoticeLedgerV2639" class="manual-notice-ledger-v2639">'+
      '<details class="mn-section auto" open><summary><div><b>自動通知</b><span>0</span></div><small>系統選的 A/B 推到手機</small><i>⌄</i></summary><div class="mn-list"><div class="mn-empty">目前沒有追蹤中的自動通知</div></div></details></div>';
  }
}
function placeCand(){
  const ideas=document.getElementById('page-ideas'); if(!ideas) return null;
  let host=document.getElementById('ideasCandidateRefV2690');
  if(!host){host=document.createElement('section');host.id='ideasCandidateRefV2690';host.className='traderCard';host.style.margin='12px 0'}
  const ws=document.getElementById('manualWorkspaceV2638');
  if(ws&&ws.parentNode) ws.parentNode.insertBefore(host, ws.nextSibling);
  else ideas.appendChild(host);
  return host;
}
function passCandidate(x){
  if(!x||x.candidate!==true) return false;
  if(x.grade==='A'||x.grade==='B') return false;
  const band=String(x.candidateBand||'').toUpperCase();
  if(['RESEARCH','COOLING'].includes(band)) return false;
  const w=winOf(x);
  if(!(w>=52)) return false;
  const prog=num(x.observationProgress);
  if(prog!=null && prog<70) return false;
  const chase=num(x.chaseAtr);
  if(chase!=null && chase>0.45) return false;
  return true;
}
function renderCand(host, rows){
  const ref=(rows||[]).filter(passCandidate)
    .sort((a,b)=>(winOf(b)||0)-(winOf(a)||0) || Number(b.candidateScore||0)-Number(a.candidateScore||0))
    .slice(0,5);
  if(!ref.length){
    host.innerHTML='<div class="traderTop"><div class="traderMain"><div class="traderName">候選</div><div class="stateInfo">只留勝率≥52%、非研究/降溫的候選。目前沒有。</div></div><div class="radarCount">0</div></div>';
    return;
  }
  host.innerHTML='<div class="traderTop"><div class="traderMain"><div class="traderName">候選</div><div class="stateInfo">不推播。勝率是估算，要回進場區再打</div></div><div class="radarCount">'+ref.length+'檔</div></div>'+
    ref.map(x=>'<div class="consensusRow"><div class="consensusMain"><div class="consensusLine"><b class="consensusSymbol">'+esc(x.symbol)+'</b><span class="dirBadge '+(String(x.direction).toLowerCase()==='short'?'short':'long')+'">'+(x.direction==='SHORT'?'做空':'做多')+'</span><span class="levelBadge medium">'+esc(x.candidateBand||'候選')+'</span></div><div class="consensusMeta">校準勝率 <b style="color:#e0bb68">'+(winOf(x)==null?'—':winOf(x).toFixed(1)+'%')+'</b> · 候選分 '+(x.candidateScore!=null?Number(x.candidateScore).toFixed(0):'—')+'</div></div><div class="consensusScore"><a href="'+tv(x.symbol)+'" target="_blank" rel="noopener" style="color:#e0bb68;text-decoration:none;font-size:11px">開圖</a><small>勝率 '+(winOf(x)==null?'—':winOf(x).toFixed(0)+'%')+'</small></div></div>').join('');
}
async function refresh(){
  if(document.hidden) return;
  wipeStale(); reorderTabs(); ensureAB();
  const host=placeCand(); if(!host) return;
  try{
    const r=await fetch('/api/manual-opportunities',{cache:'no-store'});
    const d=await r.json();
    if(d?.ok) renderCand(host, d.rows||[]);
  }catch{}
}
function boot(){void refresh(); setInterval(refresh,15000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
