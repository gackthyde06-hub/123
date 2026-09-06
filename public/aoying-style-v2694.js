(()=>{
'use strict';
const ID='5075281354358777856';
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]))}
function tv(sym){return 'https://www.tradingview.com/chart/?symbol='+encodeURIComponent('BINANCE:'+String(sym||'').toUpperCase()+'.P')}
function host(){
  const ideas=document.getElementById('page-ideas'); if(!ideas) return null;
  let box=document.getElementById('aoyingStyleV2694');
  if(!box){
    box=document.createElement('section');
    box.id='aoyingStyleV2694';
    box.className='traderCard';
    box.style.margin='8px 0 14px';
    const ws=document.getElementById('manualWorkspaceV2638');
    if(ws&&ws.parentNode) ws.parentNode.insertBefore(box, ws);
    else ideas.prepend(box);
  }
  return box;
}
function sideZh(s){return String(s||'').toUpperCase().includes('SHORT')||String(s).includes('空')?'空':'多'}
function render(box, t, events){
  const pos=t?.positions||[];
  const last=t?.lastAction||{};
  const st=t?.recentStats||t?.displayStats||{};
  const wr=Number(st.winRate);
  const ev=(events||[]).filter(e=>String(e.traderId||'')===ID||String(e.traderName||'').includes('鷹')).slice(-6).reverse();
  box.innerHTML='<div class="traderTop"><div class="traderMain"><div class="traderName">熬鷹風格（他現在怎麼下）</div><div class="stateInfo">這不是猜他下一筆。只對照他已經開出的倉。影子 A/B 仍分開。</div></div><div class="radarCount">'+pos.length+'檔</div></div>'+
    '<div class="sourceNote">近期完成單 勝率 '+(Number.isFinite(wr)?wr.toFixed(0)+'%':'—')+' · 平均持倉 約 '+(st.avgDurationMin?Math.round(Number(st.avgDurationMin)/60)+'小時':'—')+' · 同時很少檔、贏減倉、輸不拖。</div>'+
    (pos.length?pos.map(p=>'<div class="consensusRow"><div class="consensusMain"><div class="consensusLine"><b class="consensusSymbol">'+esc(p.symbol)+'</b><span class="dirBadge '+(sideZh(p.side)==='空'?'short':'long')+'">'+sideZh(p.side)+'</span></div><div class="consensusMeta">成本 '+(p.entryPrice??'—')+' · 浮動 '+(p.pnlPct==null?'—':(Number(p.pnlPct)>0?'+':'')+Number(p.pnlPct).toFixed(2)+'%')+'</div></div><div class="consensusScore"><a href="'+tv(p.symbol)+'" target="_blank" rel="noopener" style="color:#e0bb68;text-decoration:none">開圖</a></div></div>').join(''):'<div class="sourceNote">他目前沒有倉，不要用候選去表演他。</div>')+
    (last.type?'<div class="sourceNote">最後一動：'+esc(last.type)+' '+esc(last.symbol||'')+' '+esc(last.direction||last.side||'')+'</div>':'')+
    (ev.length?'<div class="sourceNote">近況：'+ev.slice(0,4).map(e=>esc((e.type||'')+' '+(e.symbol||''))).join(' · ')+'</div>':'');
}
let last=0;
async function refresh(){
  if(document.hidden) return;
  if(document.querySelector('.pageTab.active')?.dataset?.page!=='ideas') return;
  const now=Date.now(); if(now-last<20000) return; last=now;
  const box=host(); if(!box) return;
  try{
    const s=await fetch('/api/status',{cache:'no-store'}).then(r=>r.json());
    const t=(s.traders||[]).find(x=>x.id===ID||String(x.name||'').includes('鷹'));
    render(box, t||null, s.events||[]);
  }catch{
    const box2=host(); if(box2&&!box2.dataset.ready) box2.innerHTML='<div class="sourceNote">熬鷹倉位暫時讀不到</div>';
  }
}
function boot(){void refresh(); setInterval(refresh,30000); document.addEventListener('visibilitychange',()=>{if(!document.hidden){last=0;void refresh()}})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
