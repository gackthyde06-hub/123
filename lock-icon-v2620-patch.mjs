import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='LOCK_ICON_ONLY_V2620';
function must(...p){const f=path.join(__dirname,...p);if(!fs.existsSync(f))throw new Error(`[v2620] missing ${p.join('/')}`);return f}
function check(f){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v2620] syntax invalid ${path.basename(f)}: ${String(r.stderr||r.stdout||'').trim()}`)}
function save(f,b,a){if(a===b)return false;const ext=path.extname(f)||'.tmp',tmp=`${f}.v2620-${process.pid}-${Date.now()}${ext}`;fs.writeFileSync(tmp,a,'utf8');try{if(ext==='.js'||ext==='.mjs')check(tmp);fs.renameSync(tmp,f)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}return true}
function replaceRange(s,startNeedle,endNeedle,replacement,label){const a=s.indexOf(startNeedle),b=a>=0?s.indexOf(endNeedle,a+startNeedle.length):-1;if(a<0||b<0)throw new Error(`[v2620] ${label} anchor missing`);return s.slice(0,a)+replacement+s.slice(b)}

function patchApp(){
  const f=must('public','app.js'),before=fs.readFileSync(f,'utf8');let s=before;
  if(s.includes(MARKER))return {changed:false,reason:'already'};
  if(!s.includes('WORKSPACE_STABILITY_V2619'))throw new Error('[v2620] V2619 workspace layer missing');

  const sync=`function pageFreezeSyncV2619(){
  const old=document.getElementById('pageLockTagV269');if(old)old.hidden=true;
  const row=old?.closest?.('.pageLockRowV269')||document.querySelector('.pageLockRowV269');
  const page=pageFreezeCurrentV2619(),allowed=PAGE_FREEZE_ALLOWED_V2619.has(page);
  let b=document.getElementById('workspaceFreezeV2619');
  if(!b){
    b=document.createElement('button');b.id='workspaceFreezeV2619';b.type='button';b.className='workspaceFreezeV2619';
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const p=pageFreezeCurrentV2619();if(!PAGE_FREEZE_ALLOWED_V2619.has(p))return;const next=!pageFreezeIsV2619(p);pageFreezeWriteV2619(p,next);pageFreezeSyncV2619();if(!next)pageFreezeApplyPendingV2619(p)},true);
    if(row)row.appendChild(b);else{const tabs=document.querySelector('.pageTabs');if(tabs)tabs.insertAdjacentElement('afterend',b)}
  }
  if(!b)return;b.hidden=!allowed;if(!allowed)return;
  const locked=pageFreezeIsV2619(page);b.classList.toggle('locked',locked);b.setAttribute('aria-pressed',locked?'true':'false');
  b.setAttribute('aria-label',locked?'解除鎖定':'鎖定目前頁面');b.title=locked?'解除鎖定':'鎖定目前頁面';
  b.innerHTML=locked?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3"/><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M12 14v3"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10V7a4 4 0 0 1 7.6-1.7"/><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M12 14v3"/></svg>';
}
`;
  s=replaceRange(s,'function pageFreezeSyncV2619(){','\nfunction installWorkspaceStyleV2619(){',sync,'page freeze sync');

  const styleStart=s.indexOf('function installWorkspaceStyleV2619(){');
  const styleEnd=styleStart>=0?s.indexOf("\ndocument.addEventListener('click',e=>",styleStart):-1;
  if(styleStart<0||styleEnd<0)throw new Error('[v2620] workspace style boundary missing');
  const style=`function installWorkspaceStyleV2619(){
  if(document.getElementById('workspaceStyleV2619'))document.getElementById('workspaceStyleV2619').remove();
  if(document.getElementById('workspaceStyleV2620'))return;
  const st=document.createElement('style');st.id='workspaceStyleV2620';st.textContent=\`
.pageLockRowV269{display:flex!important;align-items:center!important;justify-content:flex-end!important;min-height:44px!important;padding:4px 8px 6px!important;gap:0!important}
#pageLockTagV269{display:none!important}
.workspaceFreezeV2619{width:38px!important;height:38px!important;min-width:38px!important;min-height:38px!important;padding:0!important;margin:0!important;display:grid!important;place-items:center!important;border:1px solid #34393c!important;border-radius:50%!important;background:#0b0e0f!important;color:#827d75!important;box-shadow:none!important;-webkit-tap-highlight-color:transparent!important;line-height:0!important}
.workspaceFreezeV2619[hidden]{display:none!important}.workspaceFreezeV2619 svg{width:18px!important;height:18px!important;display:block!important;fill:none!important;stroke:currentColor!important;stroke-width:1.9!important;stroke-linecap:round!important;stroke-linejoin:round!important}.workspaceFreezeV2619.locked{border-color:#8b6b2c!important;background:#171207!important;color:#efc967!important;box-shadow:0 0 0 1px rgba(225,181,75,.07) inset!important}.workspaceFreezeV2619:active{transform:scale(.96)!important}
.actualMonitorFoldV2619{border:0;padding:0;margin:0}.actualMonitorFoldV2619>summary{list-style:none;cursor:pointer;-webkit-tap-highlight-color:transparent}.actualMonitorFoldV2619>summary::-webkit-details-marker{display:none}.actualMonitorFoldV2619 .actualMonitorHeadV2610{margin:0!important}.actualMonitorFoldTitleV2619{display:flex;align-items:center;gap:9px}.actualMonitorFoldActionV2619{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;min-width:54px;height:31px;padding:0 10px;border:1px solid #4b4028;border-radius:11px;color:#d6bd79;background:#11100c;font-size:9px;font-weight:900}.actualMonitorFoldV2619:not([open]) .actualMonitorFoldActionV2619{border-color:#313638;color:#aaa;background:#0d1011}.actualMonitorFoldBodyV2619{padding-top:8px}
@media(max-width:640px){.pageLockRowV269{min-height:40px!important;padding:3px 8px 5px!important}.workspaceFreezeV2619{width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important}.workspaceFreezeV2619 svg{width:17px!important;height:17px!important}.actualMonitorFoldActionV2619{min-width:48px;height:29px;font-size:8px}}
\`;document.head.appendChild(st);
}
`;
  s=s.slice(0,styleStart)+style+s.slice(styleEnd);
  s=`// ${MARKER}\n${s}`;
  return {changed:save(f,before,s)};
}

function patchIndex(){
  const f=must('public','index.html'),before=fs.readFileSync(f,'utf8');let s=before;
  s=s.replace(/\/app\.js\?v=[^"']+/g,'/app.js?v=102620');
  s=s.replace(/\?v=sg2619/g,'?v=sg2620').replace(/\?v=sg2617/g,'?v=sg2620');
  return {changed:save(f,before,s)};
}

export function patchLockIconV2620(){const app=patchApp(),index=patchIndex();return {changed:Boolean(app.changed||index.changed),app,index}}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchLockIconV2620());
