(()=>{
'use strict';
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]))}
function dirOf(x){return String(x||'').toUpperCase().includes('SHORT')?'SHORT':'LONG'}
function host(){
  const page=document.getElementById('page-monitor')||document.getElementById('page-ideas');
  if(!page) return null;
  let box=document.getElementById('alignShadowV2687');
  if(!box){
    box=document.createElement('section');
    box.id='alignShadowV2687';
    box.className='traderCard';
    box.style.margin='8px 0 14px';
    const ideas=document.getElementById('page-ideas');
    if(ideas) ideas.prepend(box);
    else page.prepend(box);
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
      out.push({trader:t.name||t.screenName||t.id, core:!!t.core, symbol:sym, direction:side, size:p.positionAmt||p.qty||p.amount});
    }
  }
  return out;
}
function render(box, aligns, positions){
  box.innerHTML='<div class="traderTop"><div class="traderMain"><div class="traderName">交易員 × 影子 同向</div><div class="stateInfo">三位交易員有倉，影子也同方向才列。A/B 才值得认真，候選只看圖</div></div><div class="radarCount">'+aligns.length+'</div></div>'+
    (aligns.length?aligns.map(x=>'<div class="consensusRow"><div class="consensusMain"><div class="consensusLine"><b class="consensusSymbol">'+esc(x.symbol)+'</b><span class="dirBadge '+(x.direction==='SHORT'?'short':'long')+'">'+(x.direction==='SHORT'?'做空':'做多')+'</span><span class="levelBadge '+(x.grade==='A'?'high':x.grade==='B'?'medium':'low')+'">'+esc(x.grade==='A'||x.grade==='B'?x.grade:'候選')+'</span></div><div class="consensusMeta">交易員：'+esc(x.traders.join('、'))+(x.core?' · 含主訊號':'')+' · 影子 '+(x.win==null?'—':x.win+'%')+'</div></div></div>').join(''):'<div class="sourceNote">現在沒有同向。這是正常的，不要為了有通知去打。</div>')+
    '<div class="sourceNote">開倉交易員 '+positions.length+' 檔。手機推播仍只有正式 A/B；同向是簽章不是自動下單。</div>';
}
async function refresh(){
  const box=host(); if(!box) return;
  try{
    const [s,o]=await Promise.all([
      fetch('/api/status',{cache:'no-store'}).then(r=>r.json()),
      fetch('/api/manual-opportunities',{cache:'no-store'}).then(r=>r.json()).catch(()=>({rows:[]}))
    ]);
    const positions=collectPositions(s);
    const by=new Map();
    for(const p of positions){
      const k=p.symbol+'|'+p.direction;
      if(!by.has(k)) by.set(k,{symbol:p.symbol,direction:p.direction,traders:[],core:false});
      const g=by.get(k);
      if(!g.traders.includes(p.trader)) g.traders.push(p.trader);
      if(p.core) g.core=true;
    }
    const rows=o?.rows||[];
    const aligns=[];
    for(const g of by.values()){
      const hit=rows.filter(x=>String(x.symbol||'').toUpperCase()===g.symbol && dirOf(x.direction)===g.direction);
      const ab=hit.find(x=>x.grade==='A'||x.grade==='B');
      const cand=hit.find(x=>x.candidate===true);
      const pick=ab||cand;
      if(!pick) continue;
      const win=pick.candidateWinRate??pick.calibratedWinRate;
      aligns.push({...g, grade:ab?ab.grade:'CAND', win:Number.isFinite(Number(win))?Number(win).toFixed(0):null});
    }
    aligns.sort((a,b)=>(a.grade==='A'?0:a.grade==='B'?1:2)-(b.grade==='A'?0:b.grade==='B'?1:2));
    render(box, aligns, positions);
  }catch{
    box.innerHTML='<div class="sourceNote">同向比對暫時讀不到</div>';
  }
}
function boot(){void refresh(); setInterval(refresh,20000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
