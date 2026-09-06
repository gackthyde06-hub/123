(()=>{
'use strict';
const ID='5075281354358777856';
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]))}
function tv(sym){return 'https://www.tradingview.com/chart/?symbol='+encodeURIComponent('BINANCE:'+String(sym||'').toUpperCase()+'.P')}
function sideZh(s){const x=String(s||'').toUpperCase();return x.includes('SHORT')||String(s).includes('空')?'空':'多'}
function host(){
  const page=document.getElementById('page-monitor'); if(!page) return null;
  let box=document.getElementById('aoyingMonitorV2695');
  if(!box){
    box=document.createElement('section');
    box.id='aoyingMonitorV2695';
    box.className='traderCard';
    box.style.margin='0 0 14px';
    page.prepend(box);
  }
  return box;
}
function guess(pos, ev){
  const hold=new Set((pos||[]).map(p=>String(p.symbol||'').toUpperCase()));
  const recent=[];
  for(const e of ev||[]){
    const sym=String(e.symbol||'').toUpperCase(); if(!sym) continue;
    if(['OPEN','ADD','REDUCE','CLOSE'].includes(String(e.type||''))) recent.push({sym,type:e.type,side:e.side||e.direction,ts:e.ts});
  }
  const closed=recent.filter(x=>x.type==='CLOSE').slice(0,3);
  const lines=[];
  if(hold.size) lines.push('他現在只打手上這 ' +hold.size+ ' 檔，不要用候選去推他下一筆。');
  const flips=closed.filter(c=>hold.has(c.sym));
  if(flips.length) lines.push('同檔才平過又開著，他會翻向。');
  if(closed.length && ![...hold].some(s=>closed.some(c=>c.sym===s))) lines.push('剝平的標的不要再當成他的單：'+closed.map(c=>c.sym).join('、')+' 。');
  lines.push('系統沒辨法預測他要買的下一檔新幣。能判的只有：手上有倉、剝才平、或同檔翻向。');
  return lines;
}
function render(box,t,events){
  const pos=t?.positions||[];
  const st=t?.recentStats||t?.displayStats||{};
  const last=t?.lastAction||{};
  const wr=Number(st.winRate);
  const aeEv=(events||[]).filter(e=>String(e.traderId||'')===ID||String(e.traderName||'').includes('鷹'));
  const lines=guess(pos,aeEv);
  box.innerHTML='<div class="traderTop"><div class="traderMain"><div class="traderName">熬鷹監控中心</div><div class="stateInfo">他的倉·動作·近期勝率。不猜新幣。</div></div><div class="radarCount">'+(pos.length||0)+'</div></div>'+
    '<div class="sourceNote">公開追蹤 勝率 '+(Number.isFinite(wr)?wr.toFixed(0)+'%':'—')+' · 平均持倉 '+(st.avgDurationMin?Math.round(Number(st.avgDurationMin)/60)+'小時':'—')+' · X @thankUcrypto 看觀點</div>'+
    (pos.length?pos.map(p=>'<div class="consensusRow"><div class="consensusMain"><div class="consensusLine"><b class="consensusSymbol">'+esc(p.symbol)+'</b><span class="dirBadge '+(sideZh(p.side)==='空'?'short':'long')+'">'+sideZh(p.side)+'</span></div><div class="consensusMeta">成本 '+(p.entryPrice??'—')+' · '+(p.pnlPct==null?'—':(Number(p.pnlPct)>=0?'+':'')+Number(p.pnlPct).toFixed(2)+'%')+'</div></div><a href="'+tv(p.symbol)+'" target="_blank" rel="noopener" style="color:#e0bb68;text-decoration:none;font-size:11px">開圖</a></div>').join(''):'<div class="sourceNote">目前沒有持倉</div>')+
    (last.type?'<div class="sourceNote">最後一動 '+esc(last.type)+' '+esc(last.symbol||'')+' '+esc(last.direction||last.side||'')+'</div>':'')+
    '<div class="sourceNote">'+lines.map(esc).join('<br>')+'</div>';
}
let last=0;
async function refresh(){
  if(document.hidden) return;
  if(document.querySelector('.pageTab.active')?.dataset?.page!=='monitor') return;
  const now=Date.now(); if(now-last<15000) return; last=now;
  const box=host(); if(!box) return;
  try{
    const s=await fetch('/api/status',{cache:'no-store'}).then(r=>r.json());
    const t=(s.traders||[]).find(x=>x.id===ID||String(x.name||'').includes('鷹'));
    render(box,t,s.events||[]);
  }catch{}
}
function boot(){void refresh(); setInterval(refresh,30000); document.addEventListener('visibilitychange',()=>{if(!document.hidden){last=0;void refresh()}})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
