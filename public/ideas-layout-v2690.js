(()=>{
'use strict';
const TAB_ORDER=['monitor','ideas','today','flow','performance','test'];
const TAB_LABEL={monitor:'監控',ideas:'建議',today:'今日',flow:'流向',performance:'績效',test:'觀察'};
function reorderTabs(){
  const bar=document.querySelector('.pageTabs'); if(!bar) return;
  if(bar.dataset.tabOrderV2692==='1') return;
  const map=new Map([...bar.querySelectorAll('.pageTab')].map(b=>[b.dataset.page,b]));
  TAB_ORDER.forEach(k=>{const b=map.get(k); if(b) bar.appendChild(b);});
  [...bar.querySelectorAll('.pageTab')].forEach(b=>{const t=TAB_LABEL[b.dataset.page]; if(t) b.textContent=t;});
  bar.dataset.tabOrderV2692='1';
}
function wipeStale(){
  document.getElementById('ideasRescueV2686')?.remove();
  document.getElementById('ideasCandidateRefV2690')?.remove();
  const ideas=document.getElementById('page-ideas');
  if(!ideas) return;
  ideas.querySelector('#alignShadowV2687')?.remove();
}
function boot(){
  reorderTabs();
  wipeStale();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
