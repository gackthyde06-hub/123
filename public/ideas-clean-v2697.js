(()=>{
'use strict';
if(window.__ideasCleanV2697)return;window.__ideasCleanV2697=1;
const TAB_ORDER=['monitor','ideas','today','flow','performance','test'];
const TAB_LABEL={monitor:'監控',ideas:'建議',today:'今日',flow:'流向',performance:'績效',test:'觀察'};
function $(id){return document.getElementById(id)}
function reorderTabs(){
  const bar=document.querySelector('.pageTabs'); if(!bar) return;
  const map=new Map([...bar.querySelectorAll('.pageTab')].map(b=>[b.dataset.page,b]));
  TAB_ORDER.forEach(k=>{const b=map.get(k); if(b) bar.appendChild(b);});
  [...bar.querySelectorAll('.pageTab')].forEach(b=>{const t=TAB_LABEL[b.dataset.page]; if(t) b.textContent=t;});
}
function wipeExtras(){
  ['ideasRescueV2686','ideasCandidateRefV2690','alignShadowV2687','aoyingStyleV2694','aoyingMonitorV2695'].forEach(id=>$(id)?.remove());
  const ideas=$('page-ideas');
  if(!ideas) return;
  [...ideas.querySelectorAll('.sectionTitle,.traderName')].forEach(el=>{
    const t=el.textContent||'';
    if(t.includes('今日可看')||t.includes('交易員開倉')||t.includes('熬鷹風格')||t.includes('熬鷹監控')) el.closest('section,.traderCard')?.remove();
  });
}
function group(g,sub){
  return '<details class="mw-group grade-'+g.toLowerCase()+'" open><summary><div><b>'+g+'級</b><span>0</span></div><small>'+sub+'</small><i>⌄</i></summary><div class="mw-list"><div class="mw-empty">目前沒有 '+g+' 級</div></div></details>';
}
function ensureIdeasShell(){
  const ideas=$('page-ideas'); if(!ideas) return;
  let mount=$('manualWorkspaceV2638');
  if(!mount){
    mount=document.createElement('section');
    mount.id='manualWorkspaceV2638';
    mount.className='manual-workspace-v2638';
    ideas.appendChild(mount);
  }
  if(!mount.querySelector('.mw-shell')){
    mount.innerHTML='<div class="mw-title"><b>手動建議</b><span>A 可執行 · B 看圖等區 · 空白不亂打</span></div><div class="mw-shell">'+group('A','優先')+group('B','次優')+'</div><div id="manualNoticeLedgerV2639" class="manual-notice-ledger-v2639"><details class="mn-section auto" open><summary><div><b>自動通知</b><span>0</span></div><small>系統 A/B</small><i>⌄</i></summary><div class="mn-list"><div class="mn-empty">目前沒有自動通知</div></div></details></div>';
  }
}
function paintWin(){
  if(document.hidden) return;
  if(document.querySelector('.pageTab.active')?.dataset?.page!=='ideas') return;
  document.querySelectorAll('article.candidate-v2671').forEach(card=>{
    const title=card.querySelector('.candidate-title-v2667'); if(!title) return;
    let badge=title.querySelector('.winBadgeV2691');
    if(!badge){badge=document.createElement('em');badge.className='winBadgeV2691';badge.style.cssText='display:inline-flex;border:1px solid #6a5428;background:#1a150c;color:#e4c477;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:800;font-style:normal';title.appendChild(badge)}
    const raw=card.querySelector('.candidate-score b')?.textContent||'';
    const n=parseFloat(String(raw).replace('%',''));
    const next=Number.isFinite(n)?'勝率 '+n.toFixed(1)+'%':'勝率 —';
    if(badge.textContent!==next) badge.textContent=next;
  });
}
function tick(){reorderTabs();wipeExtras();ensureIdeasShell();paintWin()}
function boot(){
  tick();
  setTimeout(tick,1200);
  setTimeout(tick,4000);
  const ideas=$('page-ideas');
  if(ideas) new MutationObserver(()=>{if(!document.hidden)paintWin()}).observe(ideas,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
