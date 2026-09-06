(()=>{
'use strict';
let t=0;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]))}
function dirOf(x){return String(x||'').toUpperCase().includes('SHORT')?'SHORT':'LONG'}
function host(){
  const page=document.getElementById('page-monitor'); if(!page) return null;
  document.querySelector('#page-ideas #alignShadowV2687')?.remove();
  let box=document.getElementById('alignShadowV2687');
  if(!box){box=document.createElement('section');box.id='alignShadowV2687';box.className='traderCard';box.style.margin='8px 0 14px';page.prepend(box)}
  return box;
}
async function refresh(){
  if(document.hidden) return;
  if(document.querySelector('.pageTab.active')?.dataset?.page!=='monitor') return;
  const now=Date.now(); if(now-t<25000) return; t=now;
  const box=host(); if(!box) return;
  try{
    const s=await fetch('/api/status',{cache:'no-store'}).then(r=>r.json());
    const positions=[];
    for(const tr of s?.traders||[]){
      for(const p of tr.positions||[]){
        const sym=String(p.symbol||'').toUpperCase(); if(!sym) continue;
        positions.push({trader:tr.name||tr.screenName||tr.id,symbol:sym,direction:dirOf(p.positionSide||p.direction||p.side)});
      }
    }
    box.innerHTML='<div class="traderTop"><div class="traderMain"><div class="traderName">交易員開倉</div><div class="stateInfo">監控頁輕量顯示，不再連打建議 API</div></div><div class="radarCount">'+positions.length+'</div></div>'+
      (positions.length?positions.slice(0,8).map(x=>'<div class="consensusRow"><div class="consensusMain"><div class="consensusLine"><b class="consensusSymbol">'+esc(x.symbol)+'</b><span class="dirBadge '+(x.direction==='SHORT'?'short':'long')+'">'+(x.direction==='SHORT'?'空':'多')+'</span></div><div class="consensusMeta">'+esc(x.trader)+'</div></div></div>').join(''):'<div class="sourceNote">交易員目前沒有倉</div>');
  }catch{}
}
function boot(){void refresh(); setInterval(refresh,30000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
