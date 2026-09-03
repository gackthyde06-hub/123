import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='WORKSPACE_STABILITY_V2619';

function must(...p){
  const f=path.join(__dirname,...p);
  if(!fs.existsSync(f))throw new Error(`[v2619] missing ${p.join('/')}`);
  return f;
}
function check(f){
  const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
  if(r.status!==0)throw new Error(`[v2619] syntax invalid ${path.basename(f)}: ${String(r.stderr||r.stdout||'').trim()}`);
}
function save(f,b,a){
  if(a===b)return false;
  const ext=path.extname(f)||'.tmp',tmp=`${f}.v2619-${process.pid}-${Date.now()}${ext}`;
  fs.writeFileSync(tmp,a,'utf8');
  try{
    if(ext==='.js'||ext==='.mjs')check(tmp);
    fs.renameSync(tmp,f);
  }catch(e){
    try{fs.unlinkSync(tmp)}catch{}
    throw e;
  }
  return true;
}
function replaceRange(s,startNeedle,endNeedle,replacement,label){
  const a=s.indexOf(startNeedle),b=a>=0?s.indexOf(endNeedle,a+startNeedle.length):-1;
  if(a<0||b<0)throw new Error(`[v2619] ${label} anchor missing`);
  return s.slice(0,a)+replacement+s.slice(b);
}

function patchApp(){
  const f=must('public','app.js');
  const before=fs.readFileSync(f,'utf8');
  let s=before;
  if(s.includes(MARKER))return {changed:false,reason:'already'};

  const anchor="const $=id=>document.getElementById(id);";
  if(!s.includes(anchor))throw new Error('[v2619] app root anchor missing');

  const helper=`${anchor}

/* ${MARKER}
 * Independent visible-page locks.
 * Backend fetch / Shadow learning continue normally; only the visible DOM order is frozen.
 */
const PAGE_FREEZE_PREF_V2619='position-alert-independent-page-freeze-v2619';
const PAGE_FREEZE_ALLOWED_V2619=new Set(['ideas','monitor','test']);
let pageFreezePendingV2619={ideas:null,test:null};
function pageFreezeReadV2619(){
  try{
    const raw=JSON.parse(localStorage.getItem(PAGE_FREEZE_PREF_V2619)||'{}');
    return {ideas:raw?.ideas===true,monitor:raw?.monitor===true,test:raw?.test===true};
  }catch{return{ideas:false,monitor:false,test:false}}
}
function pageFreezeIsV2619(page){return PAGE_FREEZE_ALLOWED_V2619.has(String(page||''))&&pageFreezeReadV2619()[page]===true}
function pageFreezeCurrentV2619(){return document.querySelector('.pageTab.active')?.dataset?.page||''}
function pageFreezeNameV2619(page){return({ideas:'建議',monitor:'監控',test:'觀察'})[page]||page}
function pageFreezeWriteV2619(page,locked){
  if(!PAGE_FREEZE_ALLOWED_V2619.has(page))return;
  const x=pageFreezeReadV2619();x[page]=locked===true;
  try{localStorage.setItem(PAGE_FREEZE_PREF_V2619,JSON.stringify(x))}catch{}
}
function pageFreezeApplyPendingV2619(page){
  if(page==='ideas'){
    const d=pageFreezePendingV2619.ideas||rankedIdeasState;
    pageFreezePendingV2619.ideas=null;
    if(d)try{renderRankedIdeas(d)}catch(e){console.warn('[v2619] apply ideas pending',e)}
  }else if(page==='monitor'||page==='test'){
    const d=pageFreezePendingV2619.test||testSignalsState;
    pageFreezePendingV2619.test=null;
    if(d)try{renderTestSignals(d)}catch(e){console.warn('[v2619] apply test pending',e)}
  }
}
function pageFreezeSyncV2619(){
  const old=document.getElementById('pageLockTagV269');if(old)old.hidden=true;
  const row=old?.closest?.('.pageLockRowV269')||document.querySelector('.pageLockRowV269');
  const page=pageFreezeCurrentV2619(),allowed=PAGE_FREEZE_ALLOWED_V2619.has(page);
  let b=document.getElementById('workspaceFreezeV2619');
  if(!b){
    b=document.createElement('button');b.id='workspaceFreezeV2619';b.type='button';b.className='workspaceFreezeV2619';
    b.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      const p=pageFreezeCurrentV2619();if(!PAGE_FREEZE_ALLOWED_V2619.has(p))return;
      const next=!pageFreezeIsV2619(p);pageFreezeWriteV2619(p,next);
      pageFreezeSyncV2619();
      if(!next)pageFreezeApplyPendingV2619(p);
    },true);
    if(row)row.appendChild(b);
    else{
      const tabs=document.querySelector('.pageTabs');
      if(tabs)tabs.insertAdjacentElement('afterend',b);
    }
  }
  if(!b)return;
  b.hidden=!allowed;
  if(!allowed)return;
  const locked=pageFreezeIsV2619(page);
  const pending=(page==='ideas'&&pageFreezePendingV2619.ideas)||(page!=='ideas'&&pageFreezePendingV2619.test);
  b.classList.toggle('locked',locked);b.setAttribute('aria-pressed',locked?'true':'false');
  b.innerHTML=locked?'<span class="freezeIconV2619">▣</span><b>已鎖定 '+pageFreezeNameV2619(page)+'</b><small>'+(pending?'有新資料 · 解鎖更新':'排行固定')+'</small>':'<span class="freezeIconV2619">▢</span><b>鎖定 '+pageFreezeNameV2619(page)+'</b><small>防止排行跳動</small>';
}
function installWorkspaceStyleV2619(){
  if(document.getElementById('workspaceStyleV2619'))return;
  const st=document.createElement('style');st.id='workspaceStyleV2619';st.textContent=\`
.workspaceFreezeV2619{margin-left:auto;min-height:42px;padding:7px 12px;display:inline-grid;grid-template-columns:auto auto;grid-template-rows:auto auto;align-items:center;column-gap:7px;border:1px solid #343a3d;border-radius:14px;background:#0b0e0f;color:#aaa49a;font:inherit;box-shadow:none}
.workspaceFreezeV2619[hidden]{display:none!important}.workspaceFreezeV2619 .freezeIconV2619{grid-row:1/3;font-size:15px;color:#777}.workspaceFreezeV2619 b{font-size:10px;line-height:1.15;color:#d7d0c5}.workspaceFreezeV2619 small{font-size:7px;line-height:1.1;color:#777}
.workspaceFreezeV2619.locked{border-color:#7d612b;background:linear-gradient(180deg,#181309,#0c0d0d)}.workspaceFreezeV2619.locked .freezeIconV2619,.workspaceFreezeV2619.locked b{color:#e7c66f}.workspaceFreezeV2619.locked small{color:#a38d58}
.pageLockRowV269{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important}
.actualMonitorFoldV2619{border:0;padding:0;margin:0}.actualMonitorFoldV2619>summary{list-style:none;cursor:pointer;-webkit-tap-highlight-color:transparent}.actualMonitorFoldV2619>summary::-webkit-details-marker{display:none}.actualMonitorFoldV2619 .actualMonitorHeadV2610{margin:0!important}
.actualMonitorFoldTitleV2619{display:flex;align-items:center;gap:9px}.actualMonitorFoldActionV2619{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;min-width:54px;height:31px;padding:0 10px;border:1px solid #4b4028;border-radius:11px;color:#d6bd79;background:#11100c;font-size:9px;font-weight:900}.actualMonitorFoldV2619:not([open]) .actualMonitorFoldActionV2619{border-color:#313638;color:#aaa;background:#0d1011}
.actualMonitorFoldBodyV2619{padding-top:8px}
@media(max-width:640px){.workspaceFreezeV2619{min-height:38px;padding:6px 9px;border-radius:12px}.workspaceFreezeV2619 b{font-size:9px}.workspaceFreezeV2619 small{font-size:6.5px}.actualMonitorFoldActionV2619{min-width:48px;height:29px;font-size:8px}}
\`;document.head.appendChild(st);
}
document.addEventListener('click',e=>{if(e.target?.closest?.('.pageTab'))setTimeout(()=>{pageFreezeSyncV2619();const p=pageFreezeCurrentV2619();if(!pageFreezeIsV2619(p))pageFreezeApplyPendingV2619(p)},30)},true);
document.addEventListener('DOMContentLoaded',()=>{installWorkspaceStyleV2619();setTimeout(pageFreezeSyncV2619,60)});
window.addEventListener('pageshow',()=>setTimeout(pageFreezeSyncV2619,80));
`;
  s=s.replace(anchor,helper);

  // Replace V2.6.17 ranked wrapper: a lock freezes only visible ranking/order.
  if(!s.includes('function renderRankedIdeasBaseV2617('))throw new Error('[v2619] V2617 ranked wrapper missing');
  const rankStart=s.indexOf('function renderRankedIdeas(d){');
  const rankEnd=rankStart>=0?s.indexOf('\nasync function refreshRankedIdeas(',rankStart):-1;
  if(rankStart<0||rankEnd<0)throw new Error('[v2619] ranked render boundary missing');
  const rankWrapper=`function renderRankedIdeas(d){
  const sig=rankSignatureV2617(d),grid=$('recGrid'),root=document.querySelector('.pageTab.active')?.dataset?.page==='ideas'?(document.querySelector('.page.active')||grid):grid;
  rankedIdeasState=d;
  if(pageFreezeCurrentV2619()==='ideas'&&pageFreezeIsV2619('ideas')&&grid?.children?.length){pageFreezePendingV2619.ideas=d;pageFreezeSyncV2619();return}
  if(sig===lastRankSigV2617&&grid?.children?.length){pageFreezePendingV2619.ideas=null;pageFreezeSyncV2619();return}
  const a=captureViewportAnchorV2617(root);lastRankSigV2617=sig;pageFreezePendingV2619.ideas=null;renderRankedIdeasBaseV2617(d);restoreViewportAnchorV2617(root,a);pageFreezeSyncV2619()
}
`;
  s=s.slice(0,rankStart)+rankWrapper+s.slice(rankEnd);

  // Replace V2.6.17 observation/monitor wrapper. Monitor and Observation locks are independent.
  if(!s.includes('function renderTestSignalsBaseV2617('))throw new Error('[v2619] V2617 test wrapper missing');
  const testStart=s.indexOf('function renderTestSignals(d){');
  const testEnd=testStart>=0?s.indexOf('\nasync function refreshTestSignals(',testStart):-1;
  if(testStart<0||testEnd<0)throw new Error('[v2619] test render boundary missing');
  const testWrapper=`function renderTestSignals(d){
  const sig=testSignatureV2617(d),grid=$('testGrid'),root=document.querySelector('.page.active')||grid,active=pageFreezeCurrentV2619();
  testSignalsState=d;testSignalsFetchedAt=Date.now();
  if((active==='monitor'||active==='test')&&pageFreezeIsV2619(active)&&((active==='test'&&grid?.children?.length)||(active==='monitor'&&document.getElementById('testFocusPanel')?.children?.length))){pageFreezePendingV2619.test=d;pageFreezeSyncV2619();return}
  if(sig===lastTestSigV2617&&grid?.children?.length){pageFreezePendingV2619.test=null;pageFreezeSyncV2619();return}
  const a=captureViewportAnchorV2617(root);lastTestSigV2617=sig;pageFreezePendingV2619.test=null;renderTestSignalsBaseV2617(d);restoreViewportAnchorV2617(root,a);pageFreezeSyncV2619()
}
`;
  s=s.slice(0,testStart)+testWrapper+s.slice(testEnd);

  // Make "我的實際建倉" independently collapsible and remember the user's state.
  const actualStart=s.indexOf('function renderActualMonitorV2610(panel){');
  const actualEnd=actualStart>=0?s.indexOf("\nwindow.addEventListener('actual-trade:saved'",actualStart):-1;
  if(actualStart<0||actualEnd<0)throw new Error('[v2619] actual monitor render boundary missing');
  const actual=`const ACTUAL_MONITOR_FOLD_PREF_V2619='position-alert-actual-monitor-fold-v2619';
function actualMonitorFoldOpenV2619(){try{const v=localStorage.getItem(ACTUAL_MONITOR_FOLD_PREF_V2619);return v===null?true:v==='1'}catch{return true}}
function actualMonitorFoldSaveV2619(v){try{localStorage.setItem(ACTUAL_MONITOR_FOLD_PREF_V2619,v?'1':'0')}catch{}}
function renderActualMonitorV2610(panel){
  if(!panel)return;panel.querySelector('.actualMonitorV2610')?.remove();
  const active=actualMonitorRowsV2610('active'),hidden=actualMonitorHiddenV2610(),recent=actualMonitorRowsV2610('recent').filter(x=>!hidden[x.id]);
  if(!active.length&&!recent.length)return;
  const shell=document.createElement('section');shell.className='actualMonitorV2610';
  const historyHours=Number(testSignalsState?.actualMonitor?.historyHours||24),open=actualMonitorFoldOpenV2619();
  shell.innerHTML=\`<details class="actualMonitorFoldV2619" \${open?'open':''}><summary><div class="actualMonitorHeadV2610"><div><span>MY ACTUAL TRADES</span><div class="actualMonitorFoldTitleV2619"><b>我的實際建倉</b><span class="actualMonitorFoldActionV2619">\${open?'縮小':'展開'}</span></div><small>實倉固定保留在監控 · 可獨立縮小 · 不受排行與觀察更新影響</small></div><em>\${active.length} ACTIVE</em></div></summary><div class="actualMonitorFoldBodyV2619">\${active.length?\`<div class="actualMonitorListV2610">\${active.map(actualMonitorActiveCardV2610).join('')}</div>\`:'<div class="actualMonitorEmptyV2610">目前沒有追蹤中的實際建倉。</div>'}<details class="actualMonitorHistoryV2610" data-persist-detail="actualMonitorHistoryV2610" \${detailOpenAttr('actualMonitorHistoryV2610')}><summary><span>歷史</span><b>\${recent.length}</b><small>結束後保留 \${historyHours} 小時 · × 可立即隱藏</small><i>⌄</i></summary><div class="actualMonitorHistoryListV2610">\${recent.length?recent.map(actualMonitorHistoryRowV2610).join(''):\`<div class="actualMonitorHistoryEmptyV2610">近 \${historyHours} 小時沒有已結束的實際建倉。</div>\`}<small class="actualMonitorHistoryNoteV2610">× 或到期只會從「監控」畫面消失；績效、CSV、Railway Volume 原始紀錄仍完整保留。</small></div></details></div></details>\`;
  const header=panel.querySelector('.testMonitorHeader');if(header)header.insertAdjacentElement('afterend',shell);else panel.prepend(shell);
  const fold=shell.querySelector('.actualMonitorFoldV2619');fold?.addEventListener('toggle',()=>{actualMonitorFoldSaveV2619(fold.open);const x=fold.querySelector('.actualMonitorFoldActionV2619');if(x)x.textContent=fold.open?'縮小':'展開'});
  bindPersistentDetails(shell);
}
`;
  s=s.slice(0,actualStart)+actual+s.slice(actualEnd);

  s=`// ${MARKER}\n${s}`;
  return {changed:save(f,before,s)};
}

function patchIndex(){
  const f=must('public','index.html'),before=fs.readFileSync(f,'utf8');
  let s=before;
  s=s.replace(/\/app\.js\?v=[^"']+/g,'/app.js?v=102619');
  s=s.replace(/\?v=sg2617/g,'?v=sg2619');
  return {changed:save(f,before,s)};
}

export function patchWorkspaceV2619(){
  const app=patchApp(),index=patchIndex();
  return {changed:Boolean(app.changed||index.changed),app,index};
}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchWorkspaceV2619());
