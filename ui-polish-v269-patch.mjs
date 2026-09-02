import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='UI_POLISH_V269';

function mustFile(...parts){const file=path.join(__dirname,...parts);if(!fs.existsSync(file))throw new Error(`[v269-ui] missing ${parts.join('/')}`);return file}
function save(file,before,after){if(before===after)return false;fs.writeFileSync(file,after,'utf8');return true}
function check(file){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v269-ui] syntax invalid ${path.basename(file)}: ${String(r.stderr||r.stdout||'').trim()}`)}

function patchApp(){
  const file=mustFile('public','app.js'),before=fs.readFileSync(file,'utf8');
  let s=before;
  if(s.includes(MARKER))return false;

  // 1) Observation cards can always open the existing Actual Trade editor.
  // The modal snapshots the tracker object, so an opportunity can leave the observation/B list
  // while the user is filling the trade without destroying the form.
  const actionNeedle='<div class="testActions">${testIsMonitorQualified(x)?';
  const actionNext='<div class="testActions obsTradeActions"><button type="button" class="observationActualBtn" data-actual-trade="${esc(x.key)}">實際建倉</button>${testIsMonitorQualified(x)?';
  if(!s.includes(actionNeedle))throw new Error('[v269-ui] observation actions anchor not found');
  s=s.replace(actionNeedle,actionNext);

  // Keep the opening snapshot/live price visible even if the tracker leaves the current observation list.
  const liveOld="function actualTradeStartLiveTimer(){if(actualTradeLiveTimer){clearInterval(actualTradeLiveTimer);actualTradeLiveTimer=null}actualTradeLiveTimer=setInterval(()=>{if(!actualTradeContext)return;const live=actualTradeContext.key?testSignalByKey(actualTradeContext.key):null,px=Number(live?.currentPrice||actualTradeContext.record?.lastPrice||0);if(px>0){$('actualTradeLivePrice').textContent=price(px);$('actualTradeLiveAge').textContent=live?`更新 ${localTime(live?.lastPriceAt||live?.updatedAt)||'即時'}`:'實倉追蹤最新價'}},2000)}";
  const liveNew="function actualTradeStartLiveTimer(){if(actualTradeLiveTimer){clearInterval(actualTradeLiveTimer);actualTradeLiveTimer=null}actualTradeLiveTimer=setInterval(()=>{if(!actualTradeContext)return;const live=actualTradeContext.key?testSignalByKey(actualTradeContext.key):null,px=Number(live?.currentPrice||actualTradeContext.x?.currentPrice||actualTradeContext.record?.lastPrice||0);if(px>0){$('actualTradeLivePrice').textContent=price(px);$('actualTradeLiveAge').textContent=live?`更新 ${localTime(live?.lastPriceAt||live?.updatedAt)||'即時'}`:actualTradeContext.x?'已離開目前榜單 · 保留開啟時資料':'實倉追蹤最新價'}},2000)}";
  if(s.includes(liveOld))s=s.replace(liveOld,liveNew);
  else if(!s.includes("actualTradeContext.x?.currentPrice"))throw new Error('[v269-ui] actual trade live anchor not found');

  const msgOld="$('actualTradeMsg').textContent='';$('actualTradeMsg').className='actualTradeMsg';";
  const msgNew="$('actualTradeMsg').textContent='這筆建倉表已固定；即使標的離開觀察／B級，仍可填完並儲存。';$('actualTradeMsg').className='actualTradeMsg';";
  if(s.includes(msgOld))s=s.replace(msgOld,msgNew);

  // 2) Small page lock: persists the chosen tab and blocks accidental horizontal swipe.
  // Manual tab taps are still allowed and move the lock to the newly selected page.
  const setPageOld="function setPage(name){\n  const valid=['today','monitor','flow','ideas','test','performance'];if(!valid.includes(name))name='today';";
  const setPageNew=`const PAGE_LOCK_PREF_V269='position-alert-page-lock-v269';
function pageLockReadV269(){try{const d=JSON.parse(localStorage.getItem(PAGE_LOCK_PREF_V269)||'null');return d&&d.enabled===true?{enabled:true,page:String(d.page||'today')}:{enabled:false,page:''}}catch{return{enabled:false,page:''}}}
function pageLockWriteV269(enabled,page=''){try{if(enabled)localStorage.setItem(PAGE_LOCK_PREF_V269,JSON.stringify({enabled:true,page:String(page||document.querySelector('.pageTab.active')?.dataset?.page||'today')}));else localStorage.removeItem(PAGE_LOCK_PREF_V269)}catch{}pageLockSyncV269()}
function pageLockPageNameV269(page){return({today:'今日',performance:'績效',flow:'流向',ideas:'建議',monitor:'監控',test:'觀察'})[page]||'頁面'}
function pageLockSyncV269(){const btn=document.getElementById('pageLockTagV269');if(!btn)return;const st=pageLockReadV269(),page=st.enabled?st.page:(document.querySelector('.pageTab.active')?.dataset?.page||'today');btn.classList.toggle('active',st.enabled);btn.setAttribute('aria-pressed',st.enabled?'true':'false');btn.title=st.enabled?\`已鎖定「\${pageLockPageNameV269(page)}」；點一下解除\`:'鎖定目前頁面，避免左右滑誤切並記住此頁';const small=btn.querySelector('small');if(small)small.textContent=st.enabled?pageLockPageNameV269(page):''}
function mountPageLockV269(){if(document.getElementById('pageLockTagV269'))return;const tabs=document.querySelector('.pageTabs');if(!tabs)return;const row=document.createElement('div');row.className='pageLockRowV269';row.innerHTML='<button id="pageLockTagV269" class="pageLockTagV269" type="button" aria-pressed="false"><i aria-hidden="true"></i><span>鎖定</span><small></small></button>';tabs.insertAdjacentElement('afterend',row);row.querySelector('button')?.addEventListener('click',()=>{const st=pageLockReadV269();if(st.enabled)pageLockWriteV269(false);else pageLockWriteV269(true,document.querySelector('.pageTab.active')?.dataset?.page||'today')});pageLockSyncV269()}
function setPage(name,opts={}){
  const valid=['today','monitor','flow','ideas','test','performance'];if(!valid.includes(name))name='today';const locked=pageLockReadV269();if(locked.enabled&&!opts.force&&valid.includes(locked.page))name=locked.page;`;
  if(!s.includes(setPageOld))throw new Error('[v269-ui] setPage anchor not found');
  s=s.replace(setPageOld,setPageNew);

  const setPageSave="  try{localStorage.setItem('position-alert-page-v78',name)}catch{}";
  const setPageSaveNext="  try{localStorage.setItem('position-alert-page-v78',name)}catch{}\n  if(opts.user&&pageLockReadV269().enabled)pageLockWriteV269(true,name);else pageLockSyncV269();";
  if(!s.includes(setPageSave))throw new Error('[v269-ui] setPage save anchor not found');
  s=s.replace(setPageSave,setPageSaveNext);

  const routeOld="function handleNotificationRoute(){const q=new URLSearchParams(location.search),tv=q.get('tv'),page=q.get('page'),symbol=q.get('testSignal'),dir=q.get('dir');if(symbol&&/^[A-Z0-9]{5,24}$/.test(symbol)){testFocusSymbol=symbol;testFocusDirection=dir==='SHORT'?'SHORT':'LONG';clearTestJudgementDismiss(`${symbol}:${testFocusDirection}`);setPage(page==='test'?'test':'monitor');void refreshTestSignals(false);return true}if(tv&&/^[A-Z0-9]{5,24}$/.test(tv)){history.replaceState(null,'',location.pathname);setPage('monitor');setTimeout(()=>openTradingViewApp(tv),80);return true}if(page)setPage(page);return false}";
  const routeNew="function handleNotificationRoute(){const q=new URLSearchParams(location.search),tv=q.get('tv'),page=q.get('page'),symbol=q.get('testSignal'),dir=q.get('dir');if(symbol&&/^[A-Z0-9]{5,24}$/.test(symbol)){testFocusSymbol=symbol;testFocusDirection=dir==='SHORT'?'SHORT':'LONG';clearTestJudgementDismiss(`${symbol}:${testFocusDirection}`);setPage(page==='test'?'test':'monitor',{force:true});void refreshTestSignals(false);return true}if(tv&&/^[A-Z0-9]{5,24}$/.test(tv)){history.replaceState(null,'',location.pathname);setPage('monitor',{force:true});setTimeout(()=>openTradingViewApp(tv),80);return true}if(page)setPage(page,{force:true});return false}";
  if(s.includes(routeOld))s=s.replace(routeOld,routeNew);

  const goOld="setPage('monitor');renderTestFocus();window.scrollTo({top:0,behavior:'smooth'})";
  const goNew="setPage('monitor',{force:true,user:true});renderTestFocus();window.scrollTo({top:0,behavior:'smooth'})";
  if(s.includes(goOld))s=s.replace(goOld,goNew);

  const initControlsOld="initPerformanceControls();\ndocument.querySelectorAll('.pageTab').forEach(btn=>btn.addEventListener('click',()=>setPage(btn.dataset.page)));";
  const initControlsNew="initPerformanceControls();\nmountPageLockV269();\ndocument.querySelectorAll('.pageTab').forEach(btn=>btn.addEventListener('click',()=>setPage(btn.dataset.page,{force:true,user:true})));";
  if(!s.includes(initControlsOld))throw new Error('[v269-ui] page tab binding anchor not found');
  s=s.replace(initControlsOld,initControlsNew);

  const swipeOld="function pageSwipeGo(delta){\n  const current=document.querySelector('.pageTab.active')?.dataset?.page||'today';\n  const i=PAGE_SWIPE_ORDER.indexOf(current),next=i+delta;\n  if(i<0||next<0||next>=PAGE_SWIPE_ORDER.length)return false;\n  setPage(PAGE_SWIPE_ORDER[next]);\n  return true;\n}";
  const swipeNew="function pageSwipeGo(delta){\n  if(pageLockReadV269().enabled)return false;\n  const current=document.querySelector('.pageTab.active')?.dataset?.page||'today';\n  const i=PAGE_SWIPE_ORDER.indexOf(current),next=i+delta;\n  if(i<0||next<0||next>=PAGE_SWIPE_ORDER.length)return false;\n  setPage(PAGE_SWIPE_ORDER[next],{force:true,user:true});\n  return true;\n}";
  if(!s.includes(swipeOld))throw new Error('[v269-ui] swipe anchor not found');
  s=s.replace(swipeOld,swipeNew);

  s=`// ${MARKER}: observation manual trade + persistent page lock.\n${s}`;
  const changed=save(file,before,s);if(changed)check(file);return changed;
}

function patchIndex(){
  const file=mustFile('public','index.html'),before=fs.readFileSync(file,'utf8');
  let s=before;
  if(s.includes('UI_POLISH_V269 page lock'))return false;
  const css=`<style id="v269-observation-lock">\n/* UI_POLISH_V269 page lock + observation manual trade */\n.pageLockRowV269{display:flex;justify-content:flex-end;align-items:center;min-height:29px;margin:-2px 3px 8px;pointer-events:none}.pageLockTagV269{pointer-events:auto;display:inline-flex;align-items:center;gap:6px;height:25px;padding:0 8px 0 7px;border:1px solid #282d2f;border-radius:999px;background:rgba(14,17,18,.82);color:#716d67;font-size:9px;font-weight:900;letter-spacing:.02em;box-shadow:none;cursor:pointer;-webkit-tap-highlight-color:transparent}.pageLockTagV269 i{position:relative;width:10px;height:8px;border:1.4px solid currentColor;border-radius:2px;display:block;opacity:.86}.pageLockTagV269 i:before{content:"";position:absolute;left:1.5px;right:1.5px;top:-6px;height:6px;border:1.4px solid currentColor;border-bottom:0;border-radius:6px 6px 0 0}.pageLockTagV269 small{display:none;color:#b99c61;font-size:8px;font-weight:850}.pageLockTagV269.active{border-color:rgba(178,138,63,.38);background:rgba(24,20,13,.76);color:#d4ad5e}.pageLockTagV269.active small{display:inline}.pageLockTagV269:active{transform:translateY(1px)}\n.testActions.obsTradeActions{display:grid!important;grid-template-columns:minmax(112px,.72fr) minmax(0,1.28fr)!important;gap:8px!important}.observationActualBtn{min-height:42px;border:1px solid #4d422d!important;border-radius:12px!important;background:#111416!important;color:#c9ad73!important;font-size:11px!important;font-weight:950!important}.observationActualBtn:active{border-color:#876a34!important;color:#e4c579!important;transform:translateY(1px)}.obsTradeActions .monitorGateNote{min-height:42px;display:flex;align-items:center;justify-content:center;padding:8px 10px!important}.obsTradeActions .monitorBtn{min-height:42px}\n@media(max-width:520px){.pageLockRowV269{margin-top:-1px;margin-right:1px;margin-bottom:9px}.pageLockTagV269{height:27px;font-size:9.5px}.testActions.obsTradeActions{grid-template-columns:1fr 1.35fr!important}.observationActualBtn{font-size:11.5px!important}}\n@media(max-width:360px){.testActions.obsTradeActions{grid-template-columns:1fr!important}.obsTradeActions .monitorGateNote,.obsTradeActions .monitorBtn{grid-column:1}}\n</style>\n<!-- UI_POLISH_V269 page lock -->`;
  if(!s.includes('</head>'))throw new Error('[v269-ui] index head anchor not found');
  s=s.replace('</head>',`${css}\n</head>`);
  return save(file,before,s);
}

export function patchUiPolishV269(){
  const files={app:patchApp(),html:patchIndex()};
  return {changed:Object.values(files).some(Boolean),files,marker:MARKER};
}
