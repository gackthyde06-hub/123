
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='WORKSPACE_LOCK_REMOVED_V2662_20260904';

function check(f){
  const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
  if(r.status!==0)throw new Error(`[no-lock-v2662] syntax invalid ${path.basename(f)}: ${String(r.stderr||r.stdout||'').trim()}`);
}
function save(f,b,a){
  if(a===b)return false;
  const tmp=`${f}.v2662-${process.pid}-${Date.now()}.tmp.js`;
  fs.writeFileSync(tmp,a,'utf8');
  try{check(tmp);fs.renameSync(tmp,f)}
  catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}
  return true;
}
function replaceRegularFunction(src,name,replacement){
  const token=`function ${name}(`,start=src.indexOf(token);
  if(start<0)return src;
  const brace=src.indexOf('{',start);
  if(brace<0)return src;
  let depth=0,quote=null,escape=false,templateExpr=0;
  for(let i=brace;i<src.length;i++){
    const ch=src[i],next=src[i+1];
    if(quote){
      if(escape){escape=false;continue}
      if(ch==='\\'){escape=true;continue}
      if(quote==='`'&&ch==='$'&&next==='{'){templateExpr++;i++;continue}
      if(quote==='`'&&templateExpr>0){
        if(ch==='{')templateExpr++;
        else if(ch==='}')templateExpr--;
        continue;
      }
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue}
    if(ch==='{')depth++;
    else if(ch==='}'){
      depth--;
      if(depth===0)return src.slice(0,start)+replacement+src.slice(i+1);
    }
  }
  return src;
}
function patchApp(){
  const f=path.join(__dirname,'public','app.js');
  if(!fs.existsSync(f))return {changed:false,reason:'app-missing'};
  const before=fs.readFileSync(f,'utf8');
  let s=before;

  // The feature is removed, not merely visually hidden.
  s=replaceRegularFunction(s,'pageFreezeIsV2619',
    "function pageFreezeIsV2619(_page){return false}");
  s=replaceRegularFunction(s,'pageFreezeWriteV2619',
    "function pageFreezeWriteV2619(_page,_locked){try{localStorage.removeItem('position-alert-independent-page-freeze-v2619')}catch{}}");
  s=replaceRegularFunction(s,'pageFreezeSyncV2619',
    "function pageFreezeSyncV2619(){document.getElementById('workspaceFreezeV2619')?.remove();document.getElementById('pageLockTagV269')?.remove();document.documentElement.classList.remove('workspacePageLockedV2621')}");

  if(!s.includes('WORKSPACE_LOCK_REMOVED_RUNTIME_V2662')){
    s+=`
/* WORKSPACE_LOCK_REMOVED_RUNTIME_V2662 */
function removeWorkspaceLockV2662(){
  document.getElementById('workspaceFreezeV2619')?.remove();
  document.getElementById('pageLockTagV269')?.remove();
  document.documentElement.classList.remove('workspacePageLockedV2621');
  try{localStorage.removeItem('position-alert-independent-page-freeze-v2619')}catch{}
}
document.addEventListener('DOMContentLoaded',removeWorkspaceLockV2662);
window.addEventListener('pageshow',removeWorkspaceLockV2662);
setTimeout(removeWorkspaceLockV2662,50);
setTimeout(removeWorkspaceLockV2662,500);
`;
  }
  if(!s.includes(MARKER))s=`// ${MARKER}\n${s}`;
  return {changed:save(f,before,s)};
}
function patchIndex(){
  const f=path.join(__dirname,'public','index.html');
  if(!fs.existsSync(f))return {changed:false,reason:'index-missing'};
  const before=fs.readFileSync(f,'utf8');
  let s=before.replace(/\/app\.js\?v=[^"']+/g,'/app.js?v=102662');
  return {changed:s!==before&&Boolean(fs.writeFileSync(f,s,'utf8')===undefined)};
}

function cleanManualUi(){
  const f=path.join(__dirname,'public','manual-mode-ui.js');
  if(!fs.existsSync(f))return {changed:false,reason:'manual-ui-missing'};
  const before=fs.readFileSync(f,'utf8');let s=before;
  s=s.replace(
    /async function refresh\(force=false\)\{if\(window\.pageFreezeIsV2619\?\.\('ideas'\)&&document\.querySelector\('\.pageTab\.active'\)\?\.dataset\?\.page==='ideas'\)return;/g,
    'async function refresh(force=false){'
  );
  return {changed:save(f,before,s)};
}
function cleanActualHub(){
  const f=path.join(__dirname,'public','actual-trade-hub-v2613.js');
  if(!fs.existsSync(f))return {changed:false,reason:'hub-missing'};
  const before=fs.readFileSync(f,'utf8');let s=before;
  s=s.replace(
    /if\(window\.pageFreezeIsV2619\?\.\('test'\)&&document\.querySelector\('\.pageTab\.active'\)\?\.dataset\?\.page==='test'&&root\.children\.length\)return;/g,
    ''
  );
  s=s.replace(
    /if\(window\.pageFreezeIsV2619\?\.\('test'\)&&document\.querySelector\('\.pageTab\.active'\)\?\.dataset\?\.page==='test'\)return;/g,
    ''
  );
  return {changed:save(f,before,s)};
}
export function patchWorkspaceLockV2621(){
  const app=patchApp(),manual=cleanManualUi(),hub=cleanActualHub(),index=patchIndex();
  return {changed:Boolean(app.changed||manual.changed||hub.changed||index.changed),removed:true,app,manual,hub,index};
}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchWorkspaceLockV2621());
