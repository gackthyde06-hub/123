import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='WORKSPACE_LOCK_V2621';
function must(...p){const f=path.join(__dirname,...p);if(!fs.existsSync(f))throw new Error(`[v2621-lock] missing ${p.join('/')}`);return f}
function check(f){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v2621-lock] syntax invalid ${path.basename(f)}: ${String(r.stderr||r.stdout||'').trim()}`)}
function save(f,b,a){if(a===b)return false;const ext=path.extname(f)||'.tmp',tmp=`${f}.v2621-${process.pid}-${Date.now()}${ext}`;fs.writeFileSync(tmp,a,'utf8');try{if(ext==='.js'||ext==='.mjs')check(tmp);fs.renameSync(tmp,f)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}return true}
function replaceRange(s,startNeedle,endNeedle,replacement,label){const a=s.indexOf(startNeedle),b=a>=0?s.indexOf(endNeedle,a+startNeedle.length):-1;if(a<0||b<0)throw new Error(`[v2621-lock] ${label} anchor missing`);return s.slice(0,a)+replacement+s.slice(b)}

function patchApp(){
  const f=must('public','app.js'),before=fs.readFileSync(f,'utf8');let s=before;
  if(s.includes(MARKER))return {changed:false,reason:'already'};
  if(!s.includes('WORKSPACE_STABILITY_V2619')||!s.includes('LOCK_ICON_ONLY_V2620'))throw new Error('[v2621-lock] V2619/V2620 lock base missing');

  // Lock now freezes the visible workspace itself, not a descriptive row under the tabs.
  s=s.replace('function uiAutoRefreshAllowedV2617(){return !document.hidden&&!uiMotionHeldV2617()}',"function uiAutoRefreshAllowedV2617(){const p=typeof pageFreezeCurrentV2619==='function'?pageFreezeCurrentV2619():'';if(p&&typeof pageFreezeIsV2619==='function'&&pageFreezeIsV2619(p))return false;return !document.hidden&&!uiMotionHeldV2617()}");

  const sync=`function pageFreezeSyncV2619(){
  const old=document.getElementById('pageLockTagV269');if(old)old.hidden=true;const legacyRow=old?.closest?.('.pageLockRowV269')||document.querySelector('.pageLockRowV269');if(legacyRow)legacyRow.style.display='none';
  const page=pageFreezeCurrentV2619(),allowed=PAGE_FREEZE_ALLOWED_V2619.has(page);let b=document.getElementById('workspaceFreezeV2619');
  if(!b){b=document.createElement('button');b.id='workspaceFreezeV2619';b.type='button';b.className='workspaceFreezeV2619';b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const p=pageFreezeCurrentV2619();if(!PAGE_FREEZE_ALLOWED_V2619.has(p))return;const next=!pageFreezeIsV2619(p);pageFreezeWriteV2619(p,next);pageFreezeSyncV2619();if(!next){pageFreezeApplyPendingV2619(p);try{window.dispatchEvent(new CustomEvent('workspace-unlocked-v2621',{detail:{page:p}}))}catch{}setTimeout(()=>{try{if(p==='ideas')refreshRankedIdeas(true);else refreshTestSignals(true)}catch{}},80)}},true);document.body.appendChild(b)}
  if(!b)return;b.hidden=!allowed;document.documentElement.classList.toggle('workspacePageLockedV2621',allowed&&pageFreezeIsV2619(page));if(!allowed)return;
  const tabs=document.querySelector('.pageTabs'),rect=tabs?.getBoundingClientRect?.(),top=Math.max(76,Math.min(window.innerHeight-70,Number(rect?.bottom||70)+10));b.style.top=top+'px';
  const locked=pageFreezeIsV2619(page);b.classList.toggle('locked',locked);b.setAttribute('aria-pressed',locked?'true':'false');b.setAttribute('aria-label',locked?'解除鎖定':'鎖定目前畫面');
  b.innerHTML=locked?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M12 14v3"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10V7a4 4 0 0 1 7.6-1.7"/><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M12 14v3"/></svg>';
}
`;
  s=replaceRange(s,'function pageFreezeSyncV2619(){','\nfunction installWorkspaceStyleV2619(){',sync,'lock sync');

  const style=`function installWorkspaceStyleV2619(){
  document.getElementById('workspaceStyleV2619')?.remove();document.getElementById('workspaceStyleV2620')?.remove();if(document.getElementById('workspaceStyleV2621'))return;
  const st=document.createElement('style');st.id='workspaceStyleV2621';st.textContent=\`
.pageLockRowV269{display:none!important}#pageLockTagV269{display:none!important}
.workspaceFreezeV2619{position:fixed!important;right:14px!important;top:88px;z-index:1800!important;width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important;padding:0!important;margin:0!important;display:grid!important;place-items:center!important;border:1px solid rgba(130,135,138,.42)!important;border-radius:50%!important;background:rgba(10,13,14,.94)!important;color:#7f7b74!important;box-shadow:0 5px 18px rgba(0,0,0,.24)!important;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);-webkit-tap-highlight-color:transparent!important;line-height:0!important}
.workspaceFreezeV2619[hidden]{display:none!important}.workspaceFreezeV2619 svg{width:17px!important;height:17px!important;display:block!important;fill:none!important;stroke:currentColor!important;stroke-width:1.9!important;stroke-linecap:round!important;stroke-linejoin:round!important}.workspaceFreezeV2619.locked{border-color:#9b762b!important;background:rgba(25,19,7,.97)!important;color:#f0ca68!important;box-shadow:0 0 0 1px rgba(225,181,75,.08) inset,0 5px 18px rgba(0,0,0,.26)!important}.workspaceFreezeV2619:active{transform:scale(.95)!important}
.actualMonitorFoldV2619{border:0;padding:0;margin:0}.actualMonitorFoldV2619>summary{list-style:none;cursor:pointer;-webkit-tap-highlight-color:transparent}.actualMonitorFoldV2619>summary::-webkit-details-marker{display:none}.actualMonitorFoldV2619 .actualMonitorHeadV2610{margin:0!important}.actualMonitorFoldTitleV2619{display:flex;align-items:center;gap:9px}.actualMonitorFoldActionV2619{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;min-width:54px;height:31px;padding:0 10px;border:1px solid #4b4028;border-radius:11px;color:#d6bd79;background:#11100c;font-size:9px;font-weight:900}.actualMonitorFoldV2619:not([open]) .actualMonitorFoldActionV2619{border-color:#313638;color:#aaa;background:#0d1011}.actualMonitorFoldBodyV2619{padding-top:8px}
@media(max-width:640px){.workspaceFreezeV2619{right:10px!important;width:34px!important;height:34px!important;min-width:34px!important;min-height:34px!important}.workspaceFreezeV2619 svg{width:16px!important;height:16px!important}.actualMonitorFoldActionV2619{min-width:48px;height:29px;font-size:8px}}
\`;document.head.appendChild(st)
}
`;
  const styleStart=s.indexOf('function installWorkspaceStyleV2619(){'),styleEnd=styleStart>=0?s.indexOf("\ndocument.addEventListener('click',e=>",styleStart):-1;
  if(styleStart<0||styleEnd<0)throw new Error('[v2621-lock] style boundary missing');
  s=s.slice(0,styleStart)+style+s.slice(styleEnd);

  // Keep the floating lock aligned under the tabs without owning layout space.
  const listenerAnchor="window.addEventListener('pageshow',()=>setTimeout(pageFreezeSyncV2619,80));";
  if(s.includes(listenerAnchor))s=s.replace(listenerAnchor,listenerAnchor+"\nwindow.addEventListener('resize',()=>setTimeout(pageFreezeSyncV2619,30),{passive:true});window.addEventListener('orientationchange',()=>setTimeout(pageFreezeSyncV2619,80),{passive:true});");

  s=`// ${MARKER}\n${s}`;return {changed:save(f,before,s)};
}

function patchManual(){
  const f=path.join(__dirname,'public','manual-mode-ui.js');if(!fs.existsSync(f))return {changed:false,reason:'missing'};const before=fs.readFileSync(f,'utf8');let s=before;if(s.includes(MARKER))return {changed:false,reason:'already'};
  // No forced/background refresh may rebuild a form while 建議 is locked.
  s=s.replace(/async function refresh\(force=false\)\{/,"async function refresh(force=false){if(window.pageFreezeIsV2619?.('ideas')&&document.querySelector('.pageTab.active')?.dataset?.page==='ideas')return;");
  s+="\nwindow.addEventListener('workspace-unlocked-v2621',e=>{if(e.detail?.page==='ideas')setTimeout(()=>void refresh(true),60)});\n";
  s=`// ${MARKER}\n${s}`;return {changed:save(f,before,s)};
}

function patchActualHub(){
  const f=path.join(__dirname,'public','actual-trade-hub-v2613.js');if(!fs.existsSync(f))return {changed:false,reason:'missing'};const before=fs.readFileSync(f,'utf8');let s=before;if(s.includes(MARKER))return {changed:false,reason:'already'};
  // Observation lock freezes the actual-trade hub DOM too; backend fetch may continue.
  s=s.replace('function renderHub(){const root=ensureHub();if(!root)return;','function renderHub(){const root=ensureHub();if(!root)return;if(window.pageFreezeIsV2619?.(\'test\')&&document.querySelector(\'.pageTab.active\')?.dataset?.page===\'test\'&&root.children.length)return;');
  s=s.replace('function syncEntryChips(){document.querySelectorAll(',"function syncEntryChips(){if(window.pageFreezeIsV2619?.('test')&&document.querySelector('.pageTab.active')?.dataset?.page==='test')return;document.querySelectorAll(");
  s+="\nwindow.addEventListener('workspace-unlocked-v2621',e=>{if(e.detail?.page==='test'){renderHub();syncEntryChips();setTimeout(()=>void refreshTrades(true),60)}});\n";
  s=`// ${MARKER}\n${s}`;return {changed:save(f,before,s)};
}

function patchIndex(){const f=must('public','index.html'),before=fs.readFileSync(f,'utf8');let s=before;s=s.replace(/\/app\.js\?v=[^"']+/g,'/app.js?v=102621');s=s.replace(/\?v=sg2620/g,'?v=sg2621').replace(/\?v=sg2619/g,'?v=sg2621').replace(/\?v=sg2617/g,'?v=sg2621');return {changed:save(f,before,s)}}

export function patchWorkspaceLockV2621(){const app=patchApp(),manual=patchManual(),hub=patchActualHub(),index=patchIndex();return {changed:Boolean(app.changed||manual.changed||hub.changed||index.changed),app,manual,hub,index}}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchWorkspaceLockV2621());
