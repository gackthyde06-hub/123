import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='NO_PAGE_LOCK_V2664_20260904';

function check(f){
  const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
  if(r.status!==0)throw new Error(`[no-lock-v2664] syntax invalid ${path.basename(f)}: ${String(r.stderr||r.stdout||'').trim()}`);
}
function save(f,b,a){
  if(a===b)return false;
  const tmp=`${f}.v2664-${process.pid}-${Date.now()}.tmp.js`;
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
  const before=fs.readFileSync(f,'utf8');let s=before;

  // V2.6.9 page lock: feature fully removed.
  s=replaceRegularFunction(s,'pageLockReadV269',"function pageLockReadV269(){return{enabled:false,page:''}}");
  s=replaceRegularFunction(s,'pageLockWriteV269',"function pageLockWriteV269(_enabled,_page=''){try{localStorage.removeItem('position-alert-page-lock-v269')}catch{};document.getElementById('pageLockTagV269')?.remove();document.querySelector('.pageLockRowV269')?.remove()}");
  s=replaceRegularFunction(s,'pageLockSyncV269',"function pageLockSyncV269(){document.getElementById('pageLockTagV269')?.remove();document.querySelector('.pageLockRowV269')?.remove()}");
  s=replaceRegularFunction(s,'mountPageLockV269',"function mountPageLockV269(){document.getElementById('pageLockTagV269')?.remove();document.querySelector('.pageLockRowV269')?.remove()}");

  // V2.6.19 visible-page freeze: feature fully removed.
  s=replaceRegularFunction(s,'pageFreezeReadV2619',"function pageFreezeReadV2619(){return{ideas:false,monitor:false,test:false}}");
  s=replaceRegularFunction(s,'pageFreezeIsV2619',"function pageFreezeIsV2619(_page){return false}");
  s=replaceRegularFunction(s,'pageFreezeWriteV2619',"function pageFreezeWriteV2619(_page,_locked){try{localStorage.removeItem('position-alert-independent-page-freeze-v2619')}catch{}}");
  s=replaceRegularFunction(s,'pageFreezeSyncV2619',"function pageFreezeSyncV2619(){document.getElementById('workspaceFreezeV2619')?.remove();document.getElementById('pageLockTagV269')?.remove();document.querySelector('.pageLockRowV269')?.remove()}");

  // User requirement remains: pages are tab-tap only, no horizontal page swipe.
  s=replaceRegularFunction(s,'pageSwipeGo',"function pageSwipeGo(_delta){return false}");

  if(!s.includes('NO_PAGE_LOCK_RUNTIME_V2664')){
    s+=`
/* NO_PAGE_LOCK_RUNTIME_V2664 */
function removeAllPageLocksV2664(){
  document.getElementById('pageLockTagV269')?.remove();
  document.querySelectorAll('.pageLockRowV269,#workspaceFreezeV2619,.workspaceFreezeV2619').forEach(x=>x.remove());
  document.documentElement.classList.remove('workspacePageLockedV2621');
  try{
    localStorage.removeItem('position-alert-page-lock-v269');
    localStorage.removeItem('position-alert-independent-page-freeze-v2619');
  }catch{}
}
document.addEventListener('DOMContentLoaded',removeAllPageLocksV2664);
window.addEventListener('pageshow',removeAllPageLocksV2664);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')removeAllPageLocksV2664()});
setTimeout(removeAllPageLocksV2664,40);
setTimeout(removeAllPageLocksV2664,350);
setTimeout(removeAllPageLocksV2664,1200);
`;
  }
  if(!s.includes(MARKER))s=`// ${MARKER}\n${s}`;
  return {changed:save(f,before,s)};
}
function patchIndex(){
  const f=path.join(__dirname,'public','index.html');
  if(!fs.existsSync(f))return {changed:false,reason:'index-missing'};
  const before=fs.readFileSync(f,'utf8');let s=before;
  if(!s.includes('NO_PAGE_LOCK_CSS_V2664')){
    const css=`<style id="no-page-lock-v2664">
/* NO_PAGE_LOCK_CSS_V2664 */
#pageLockTagV269,.pageLockTagV269,.pageLockRowV269,#workspaceFreezeV2619,.workspaceFreezeV2619{display:none!important;visibility:hidden!important;pointer-events:none!important}
</style>`;
    if(s.includes('</head>'))s=s.replace('</head>',css+'\n</head>');
  }
  s=s.replace(/\/app\.js\?v=[^"']+/g,'/app.js?v=102664');
  if(s!==before)fs.writeFileSync(f,s,'utf8');
  return {changed:s!==before};
}
function cleanGuards(){
  const files=['manual-mode-ui.js','actual-trade-hub-v2613.js'];
  const result={};
  for(const name of files){
    const f=path.join(__dirname,'public',name);
    if(!fs.existsSync(f)){result[name]=false;continue}
    const before=fs.readFileSync(f,'utf8');let s=before;
    s=s.replace(/if\(window\.pageFreezeIsV2619\?\.\('ideas'\)[^;]*\)return;/g,'');
    s=s.replace(/if\(window\.pageFreezeIsV2619\?\.\('test'\)[^;]*\)return;/g,'');
    result[name]=save(f,before,s);
  }
  return result;
}
function applyNoLock(){
  const app=patchApp(),index=patchIndex(),guards=cleanGuards();
  return {changed:Boolean(app.changed||index.changed||Object.values(guards).some(Boolean)),removed:true,swipeDisabled:true,app,index,guards};
}

export function patchWorkspaceLockV2621(){return applyNoLock()}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchWorkspaceLockV2621());
