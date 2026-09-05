(()=>{
  'use strict';
  const VERSION='2.6.0-stable';
  const REFRESH_MS=30_000;
  const FETCH_TIMEOUT_MS=4_500;
  let rows=new Map(),timer=null,busy=false,panelObserver=null,applyQueued=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function key(symbol,direction){return `${String(symbol||'').toUpperCase()}:${String(direction||'').toUpperCase()}`}
  function cardIdentity(card){
    const raw=String(card?.getAttribute?.('data-sg-detail-key')||'');
    const m=raw.match(/^candidate:([^:]+):(LONG|SHORT)$/i);
    if(m)return {symbol:m[1].toUpperCase(),direction:m[2].toUpperCase()};
    const symbol=card?.querySelector?.('.sg-candidate-main b')?.textContent?.trim()?.toUpperCase()||'';
    const direction=card?.classList?.contains('dir-short')?'SHORT':'LONG';
    return {symbol,direction};
  }
  function labelClass(state){return ({INTACT:'intact',DAMAGED:'damaged',RECLAIMING:'reclaiming',OPPORTUNITY:'opportunity',DESTROYED:'destroyed'})[state]||'unknown'}
  function structureSignature(s){
    if(!s)return'';
    return JSON.stringify([s.state,s.label,s.health,s.confidence,s.assetClass,s.pattern,s.action,s.reasons]);
  }
  function observePanel(){
    const panel=document.getElementById('sgPanel');
    if(!panel||!panelObserver)return;
    panelObserver.observe(panel,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
  }
  function scheduleApply(){
    if(applyQueued)return;
    applyQueued=true;
    requestAnimationFrame(()=>{applyQueued=false;applyCards()});
  }
  function applyCards(){
    const panel=document.getElementById('sgPanel');
    if(!panel)return;
    // Prevent our own DOM writes from recursively triggering the observer.
    panelObserver?.disconnect();
    try{
      panel.querySelectorAll('[data-sg-candidate]').forEach(card=>{
        card.removeAttribute('data-featured');
        const id=cardIdentity(card),row=rows.get(key(id.symbol,id.direction)),s=row?.structureV2;
        card.classList.remove('sg-structure-intact','sg-structure-damaged','sg-structure-reclaiming','sg-structure-opportunity','sg-structure-destroyed');
        const old=card.querySelector('.sg-structure-v2-line');
        if(!s){if(old)old.remove();return}
        card.classList.add(`sg-structure-${labelClass(s.state)}`);
        const sig=structureSignature(s);
        if(old?.dataset?.sgStructureSig===sig)return;
        const health=Number.isFinite(Number(s.health))?Math.round(Number(s.health)):'—';
        const confidence=Number.isFinite(Number(s.confidence))?` · 信心 ${Math.round(Number(s.confidence))}`:'';
        const reasons=(s.reasons||[]).slice(0,2).join(' · ');
        const asset=({CRYPTO:'幣圈',EQUITY_TOKEN:'股權代幣',COMMODITY:'商品'})[s.assetClass]||s.assetClass||'';
        const pattern=({NORMAL_STRUCTURE:'正常結構',DEEP_RETRACE:'深回踩',DEEP_RECLAIM:'深回踩收復',FAILED_BREAK_RECLAIM:'假跌破收復',LIQUIDITY_SWEEP:'流動性掃盤',STRUCTURE_BREAK:'結構破壞',POC_RECLAIM:'POC收復'})[s.pattern]||s.pattern||'';
        const watch=['OPPORTUNITY','RECLAIMING'].includes(s.state)?' · 結構觀察，非進場確認':'';
        const structureMeta=[asset,pattern].filter(Boolean).join(' / ');
        const line=document.createElement('small');
        line.className=`sg-structure-v2-line sg-structure-${labelClass(s.state)}`;
        line.dataset.sgStructureSig=sig;
        line.innerHTML=`<b>結構 ${esc(s.label||s.state||'—')} ${health}</b><span>${esc(reasons||s.action||'多週期結構即時判讀')}${confidence}${structureMeta?` · ${esc(structureMeta)}`:''}${watch}</span>`;
        if(old)old.replaceWith(line);else card.querySelector('.sg-candidate-meta')?.appendChild(line);
      });
    } finally {
      observePanel();
    }
  }
  function closeOtherCards(openCard){
    if(!openCard?.open)return;
    document.querySelectorAll('#sgPanel [data-sg-candidate][open]').forEach(x=>{if(x!==openCard)x.open=false});
  }
  async function refresh(){
    if(busy)return;busy=true;
    const ctrl=typeof AbortController!=='undefined'?new AbortController():null;
    const timerId=ctrl?setTimeout(()=>ctrl.abort(),FETCH_TIMEOUT_MS):null;
    try{
      const r=await fetch('/api/test-signals',{cache:'no-store',...(ctrl?{signal:ctrl.signal}:{})});
      if(!r.ok)return;
      const d=await r.json(),next=new Map();
      for(const x of d?.rows||[])next.set(key(x.symbol,x.direction),x);
      rows=next;applyCards();
    }catch{}finally{if(timerId)clearTimeout(timerId);busy=false}
  }
  function installObserver(){
    const panel=document.getElementById('sgPanel');
    if(!panel)return false;
    panelObserver?.disconnect();
    panelObserver=new MutationObserver(muts=>{
      let changed=false;
      for(const m of muts){
        if(m.type==='attributes'&&m.attributeName==='open'&&m.target?.matches?.('[data-sg-candidate]')){if(m.target.open)closeOtherCards(m.target);changed=true}
        else if(m.type==='childList')changed=true;
      }
      if(changed)scheduleApply();
    });
    observePanel();
    return true;
  }
  function waitForPanel(){
    if(installObserver())return;
    const bootObserver=new MutationObserver(()=>{if(installObserver())bootObserver.disconnect()});
    bootObserver.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>bootObserver.disconnect(),10_000);
  }
  function init(){
    waitForPanel();scheduleApply();void refresh();
    timer=setInterval(()=>{
      if(document.visibilityState!=='visible')return;
      const panel=document.getElementById('sgPanel');
      if(panel&&!panel.hidden)void refresh();
    },REFRESH_MS);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refresh()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.StructureEngineV2UI={version:VERSION,refresh};
})();
