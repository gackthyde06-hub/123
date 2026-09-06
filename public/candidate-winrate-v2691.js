(()=>{
'use strict';
if(window.__winBadgeV2692)return;window.__winBadgeV2692=1;
if(!document.getElementById('candidateWinRateCssV2691')){
  const css=document.createElement('style');
  css.id='candidateWinRateCssV2691';
  css.textContent='.candidate-title-v2667{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:6px!important}.winBadgeV2691{display:inline-flex!important;border:1px solid #6a5428!important;background:#1a150c!important;color:#e4c477!important;border-radius:999px!important;padding:2px 8px!important;font-size:11px!important;font-weight:800!important;font-style:normal!important}.candidate-v2671 summary{position:relative!important}.candidate-v2671 summary .candidate-score{display:flex!important;flex-direction:column!important;align-items:flex-end!important;min-width:52px!important}.candidate-v2671 summary .candidate-score b{color:#e4c477!important;font-size:15px!important}';
  document.documentElement.appendChild(css);
}
let scheduled=0;
function winNum(card){const raw=card.querySelector('.candidate-score b')?.textContent||'';const n=parseFloat(String(raw).replace('%',''));return Number.isFinite(n)?n:null}
function decorate(){
  if(document.hidden) return;
  if(document.querySelector('.pageTab.active')?.dataset?.page!=='ideas') return;
  document.querySelectorAll('article.candidate-v2671').forEach(card=>{
    const title=card.querySelector('.candidate-title-v2667'); if(!title) return;
    let badge=title.querySelector('.winBadgeV2691');
    if(!badge){badge=document.createElement('em');badge.className='winBadgeV2691';title.appendChild(badge)}
    const w=winNum(card);
    const next=w==null?'勝率 —':'勝率 '+w.toFixed(1)+'%';
    if(badge.textContent!==next) badge.textContent=next;
  });
}
function kick(){if(scheduled)return;scheduled=1;requestAnimationFrame(()=>{scheduled=0;decorate()})}
const host=document.getElementById('page-ideas');
if(host) new MutationObserver(kick).observe(host,{childList:true,subtree:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)kick()});
setTimeout(kick,800);
})();
