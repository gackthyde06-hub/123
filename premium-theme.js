(()=>{
  'use strict';
  const doc=document;
  const map=new Map([['今日','today'],['績效','performance'],['流向','flow'],['建議','ideas'],['監控','monitor'],['觀察','observe']]);
  function applyPage(){
    const active=doc.querySelector('.pageTab.active');
    const key=map.get((active?.textContent||'').trim())||'today';
    doc.documentElement.dataset.uiPage=key;
  }
  function init(){
    applyPage();
    const tabs=doc.querySelector('.pageTabs');
    if(tabs){
      new MutationObserver(applyPage).observe(tabs,{subtree:true,attributes:true,attributeFilter:['class']});
      tabs.addEventListener('click',()=>requestAnimationFrame(applyPage),{passive:true});
    }
    // Keep dynamic numeric areas stable; do not animate layout on live refreshes.
    doc.documentElement.classList.add('premium-ui-ready');
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
