(()=>{
'use strict';
const TAB_ORDER=['monitor','ideas','today','flow','performance','test'];
const TAB_LABEL={monitor:'監控',ideas:'建議',today:'今日',flow:'流向',performance:'績效',test:'觀察'};
function reorderTabs(){
  const bar=document.querySelector('.pageTabs'); if(!bar) return;
  const map=new Map([...bar.querySelectorAll('.pageTab')].map(b=>[b.dataset.page,b]));
  TAB_ORDER.forEach(k=>{const b=map.get(k); if(b) bar.appendChild(b);});
  [...bar.querySelectorAll('.pageTab')].forEach(b=>{const t=TAB_LABEL[b.dataset.page]; if(t) b.textContent=t;});
}
function group(g,sub){
  return '<details class="mw-group grade-'+g.toLowerCase()+'" open><summary><div><b>'+g+'級</b><span>0</span></div><small>'+sub+'</small><i>⌄</i></summary><div class="mw-list"><div class="mw-empty">目前沒有 '+g+' 級。不要因為空白就亂打。</div></div></details>';
}
function paintSkeleton(){
  const ideas=document.getElementById('page-ideas'); if(!ideas) return;
  document.getElementById('ideasRescueV2686')?.remove();
  ideas.querySelector('#alignShadowV2687')?.remove();
  let mount=document.getElementById('manualWorkspaceV2638');
  if(!mount){
    mount=document.createElement('section');
    mount.id='manualWorkspaceV2638';
    mount.className='manual-workspace-v2638';
    ideas.appendChild(mount);
  }
  if(!mount.querySelector('.mw-shell')){
    mount.innerHTML='<div class="mw-title"><b>手動建議</b><span>A 高完成度 · B 值得看圖 · 空白就看熬鷹通知</span></div>'+
      '<div class="mw-shell">'+group('A','優先 · 手動')+group('B','次優先 · 手動')+'</div>'+
      '<div id="manualNoticeLedgerV2639" class="manual-notice-ledger-v2639"><details class="mn-section auto" open><summary><div><b>自動通知</b><span>0</span></div><small>系統 A/B 推到手機</small><i>⌄</i></summary><div class="mn-list"><div class="mn-empty">目前沒有自動通知</div></div></details></div>';
  }
  if(!document.getElementById('manualCandidateV2664') && !document.getElementById('ideasCandidateHoldV2693')){
    const hold=document.createElement('section');
    hold.id='ideasCandidateHoldV2693';
    hold.className='traderCard';
    hold.style.margin='12px 0';
    hold.innerHTML='<div class="traderTop"><div class="traderMain"><div class="traderName">候選</div><div class="stateInfo">伺服器還在載入時先空著。不要自己找單打。</div></div><div class="radarCount">—</div></div>';
    mount.parentNode.insertBefore(hold, mount.nextSibling);
  } else {
    document.getElementById('ideasCandidateHoldV2693')?.remove();
  }
}
function boot(){
  reorderTabs();
  paintSkeleton();
  setTimeout(paintSkeleton,1200);
  setTimeout(paintSkeleton,4000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
