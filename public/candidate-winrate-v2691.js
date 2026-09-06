(()=>{
'use strict';
if(document.getElementById('candidateWinRateCssV2691'))return;
const css=document.createElement('style');
css.id='candidateWinRateCssV2691';
css.textContent=`
.candidate-title-v2667{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:6px!important}
.winBadgeV2691{display:inline-flex!important;align-items:center!important;border:1px solid #6a5428!important;background:#1a150c!important;color:#e4c477!important;border-radius:999px!important;padding:2px 8px!important;font-size:11px!important;font-weight:800!important;letter-spacing:.2px!important;font-style:normal!important}
.winBadgeV2691.low{border-color:#3a3a3a!important;color:#8d8880!important;background:#141414!important}
.winBadgeV2691.mid{border-color:#5c4a22!important}
.candidate-v2671 summary .candidate-score{display:flex!important;flex-direction:column!important;align-items:flex-end!important;min-width:58px!important;margin-right:4px!important}
.candidate-v2671 summary .candidate-score b{display:block!important;color:#e4c477!important;font-size:16px!important;line-height:1.1!important}
.candidate-v2671 summary .candidate-score span{display:block!important;color:#8d7a4c!important;font-size:9px!important}
@media (max-width:430px){
  .candidate-v2671 summary .candidate-score{position:absolute!important;right:42px!important;top:14px!important}
  .candidate-v2671 summary{position:relative!important;padding-right:92px!important}
}
`;
document.documentElement.appendChild(css);
function winNum(card){
  const raw=card.querySelector('.candidate-score b')?.textContent||'';
  const n=parseFloat(String(raw).replace('%','').replace('—',''));
  return Number.isFinite(n)?n:null;
}
function decorate(){
  document.querySelectorAll('article.candidate-v2671').forEach(card=>{
    const title=card.querySelector('.candidate-title-v2667');
    if(!title) return;
    let badge=title.querySelector('.winBadgeV2691');
    if(!badge){badge=document.createElement('em');badge.className='winBadgeV2691';title.appendChild(badge)}
    const w=winNum(card);
    badge.textContent=w==null?'勝率 —':'勝率 '+w.toFixed(1)+'%';
    badge.classList.toggle('low',w!=null&&w<50);
    badge.classList.toggle('mid',w!=null&&w>=50&&w<55);
    const meta=card.querySelector('.candidate-meta-v2667');
    if(meta&&w!=null&&!/\d+(\.\d+)?%/.test(meta.textContent||'')){
      const s=document.createElement('span');
      s.textContent='校準勝率 '+w.toFixed(1)+'%';
      meta.appendChild(s);
    }
  });
}
const obs=new MutationObserver(()=>decorate());
if(document.body)obs.observe(document.body,{childList:true,subtree:true});
decorate();
setInterval(decorate,3000);
})();
