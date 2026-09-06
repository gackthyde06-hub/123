(()=>{
'use strict';
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]))}
function dirOf(x){return String(x||'').toUpperCase().includes('SHORT')?'SHORT':'LONG'}
function host(){
  const page=document.getElementById('page-monitor'); if(!page) return null;
  document.querySelector('#page-ideas #alignShadowV2687')?.remove();
  let box=document.getElementById('alignShadowV2687');
  if(!box){
    box=document.createElement('section');
    box.id='alignShadowV2687';
    box.className='traderCard';
    box.style.margin='8px 0 14px';
    page.prepend(box);
  }
  return box;
}
function collectPositions(status){
  const out=[];
  for(const t of status?.traders||[]){
    for(const p of t.positions||[]){
      const sym=String(p.symbol||p.symbolName||'').toUpperCase();
      if(!sym) continue;
      const side=dirOf(p.positionSide||p.direction||p.side||(Number(p.positionAmt||p.qty||0)<0?'SHORT':'LONG'));
      out.push({trader:t.name||t.screenName||t.id, core:!!t.core, symbol:sym, direction:side});
    }
  }
  return out;
}
function render(box, aligns){
  box.innerHTML='<div class="traderTop"><div class="traderMain"><div class="traderName">交易員 × 影子 同向</div><div class="stateInfo">只顯示在監控頁。建議頁不動這塊</div></div><div class="radarCount">'+aligns.length+'</div></div>'+
    (aligns.length?aligns.map(x=>'<div class="consensusRow"><div class="consensusMain"><div class="consensusLine"><b class="consensusSymbol">'+esc(x.symbol)+'</b><span class="dirBadge '+(x.direction==='SHORT'?'short':'long')+'">'+(x.direction==='SHORT'?'做空':'做多')+'</span><span class="levelBadge '+(x.grade==='A'?'high':x.grade==='B'?'medium':'low')+'">'+esc(x.grade)+'</span></div><div class="consensusMeta">'+esc(x.traders.join('、'))+'</div></div></div>').join(''):'<div class="sourceNote">目前沒有同向</div>');
}
async function refresh(){
  if(document.hidden) return;
  const box=host(); if(!box) return;
  try{
    const [s,o]=await Promise.all([
      fetch('/api/status',{cache:'no-store'}).then(r=>r.json()),
      fetch('/api/manual-opportunities',{cache:'no-store'}).then(r=>r.json()).catch(()=>({rows:[]}))
    ]);
    const by=new Map();
    for(const p of collectPositions(s)){
      const k=p.symbol+'|'+p.direction;
      if(!by.has(k)) by.set(k,{symbol:p.symbol,direction:p.direction,traders:[],core:false});
      const g=by.get(k);
      if(!g.traders.includes(p.trader)) g.traders.push(p.trader);
      if(p.core) g.core=true;
    }
    const rows=o?.rows||[], aligns=[];
    for(const g of by.values()){
      const hit=rows.filter(x=>String(x.symbol||'').toUpperCase()===g.symbol && dirOf(x.direction)===g.direction);
      const ab=hit.find(x=>x.grade==='A'||x.grade==='B');
      const cand=hit.find(x=>x.candidate===true);
      const pick=ab||cand; if(!pick) continue;
      aligns.push({...g, grade:ab?ab.grade:'候選'});
    }
    render(box, aligns);
  }catch{}
}
function boot(){void refresh(); setInterval(()=>{ if(!document.hidden) void refresh(); }, 20000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
