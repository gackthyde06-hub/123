(()=>{
  'use strict';
  const doc=document;
  const map=new Map([['今日','today'],['績效','performance'],['流向','flow'],['建議','ideas'],['監控','monitor'],['觀察','observe']]);
  function applyPage(){
    const active=doc.querySelector('.pageTab.active');
    const key=map.get((active?.textContent||'').trim())||'today';
    doc.documentElement.dataset.uiPage=key;
  }

  function hideTraderHeaderStatus(){
    const nodes=[...doc.querySelectorAll('div,span,p,b,strong,small')]
      .filter(el=>{
        const t=(el.textContent||'').replace(/\s+/g,' ').trim();
        return t.includes('交易員 3/3')&&!t.includes('交易監控')&&t.length<100;
      })
      .sort((a,b)=>(a.textContent||'').length-(b.textContent||'').length);
    const el=nodes[0];
    if(!el)return;
    let target=el;
    const parent=el.parentElement;
    if(parent){
      const t=(parent.textContent||'').replace(/\s+/g,' ').trim();
      if(t.includes('交易員 3/3')&&!t.includes('交易監控')&&t.length<140)target=parent;
    }
    target.style.display='none';
    target.setAttribute('data-premium-hidden-trader-status','1');
  }
  function init(){
    applyPage();
    hideTraderHeaderStatus();
    const tabs=doc.querySelector('.pageTabs');
    if(tabs){
      new MutationObserver(applyPage).observe(tabs,{subtree:true,attributes:true,attributeFilter:['class']});
      tabs.addEventListener('click',()=>requestAnimationFrame(applyPage),{passive:true});
    }
    const traderObserver=new MutationObserver(()=>hideTraderHeaderStatus());
    traderObserver.observe(doc.body,{childList:true,subtree:true,characterData:true});
    // Keep dynamic numeric areas stable; do not animate layout on live refreshes.
    doc.documentElement.classList.add('premium-ui-ready');
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
