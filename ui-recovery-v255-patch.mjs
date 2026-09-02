import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKER = 'UI_RECOVERY_V255_20260902';

function syntaxCheck(filePath,label){
  const r=spawnSync(process.execPath,['--check',filePath],{encoding:'utf8'});
  if(r.status!==0)throw new Error(`[ui-recovery] ${label} syntax invalid: ${String(r.stderr||r.stdout||'unknown').trim()}`);
}

function atomicWriteChecked(filePath,content,label){
  const tmp=`${filePath}.v255-${process.pid}-${Date.now()}.tmp.js`;
  fs.writeFileSync(tmp,content,'utf8');
  try{syntaxCheck(tmp,label);fs.renameSync(tmp,filePath)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}
}

export function patchUiRecoveryV255({growthPath=path.join(__dirname,'system-growth.js')}={}){
  let src=fs.readFileSync(growthPath,'utf8');
  if(src.includes(MARKER))return {changed:false,reason:'already-applied'};

  // Replace either the original loader or the V2.5.4 loader. This deliberately makes
  // /api/performance the only critical request. Signals are background-only.
  const loaderRe=/  (?:\/\* RUNTIME_RESILIENCE_V254_20260902_GROWTH \*\/\n  )?(?:const PERF_CACHE_KEY=[\s\S]*?\n  )?async function getJson\(path(?:,timeoutMs=7000)?\)\{[\s\S]*?\n  \}\n  function setStatus/;
  if(!loaderRe.test(src))throw new Error('[ui-recovery] growth loader anchor not found');

  const replacement=`  /* ${MARKER} */
  const PERF_CACHE_KEY='sg-last-perf-v255';
  const SIGNAL_CACHE_KEY='sg-last-signals-v255';
  let loadWatchdog=null;
  async function getJson(path,timeoutMs=5000){
    const ctrl=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=ctrl?setTimeout(()=>ctrl.abort(),Math.max(1200,timeoutMs)):null;
    try{
      const r=await fetch(path,{cache:'no-store',...(ctrl?{signal:ctrl.signal}:{})});
      if(!r.ok)throw new Error(\`${'${path}'} ${'${r.status}'}\`);
      return await r.json();
    }finally{if(timer)clearTimeout(timer)}
  }
  function safeCommitResearchRender(perf,signals){
    if(!perf||typeof perf!=='object')return false;
    state.perf=perf;
    state.signals=(signals&&typeof signals==='object')?signals:{ok:true,rows:[]};
    state.lastLoadedAt=Date.now();
    try{
      const key=renderKeyFor(state.perf,state.signals);
      if(key!==state.renderKey){state.renderKey=key;render()}
      return true;
    }catch(err){
      console.error('[growth:render]',err);
      const panel=rootDoc.getElementById('sgPanel');
      if(panel)panel.innerHTML='<div class="sg-recovery-card"><b>養成面板暫時停用</b><span>交易監控仍正常運作；稍後重新開啟即可重試。</span><button type="button" data-sg-safe-close>返回交易監控</button></div>';
      panel?.querySelector('[data-sg-safe-close]')?.addEventListener('click',()=>setOpen(false),{once:true});
      return false;
    }
  }
  async function loadData(force=false){
    if(state.loading)return;
    if(force&&state.open&&Date.now()<Number(state.interactUntil||0))return;
    if(!force&&state.perf&&Date.now()-state.lastLoadedAt<30_000){safeCommitResearchRender(state.perf,state.signals);return}
    state.loading=true;
    setStatus(state.perf?'更新研究資料…':'同步研究資料…');
    clearTimeout(loadWatchdog);
    loadWatchdog=setTimeout(()=>{
      if(!state.loading)return;
      state.loading=false;
      setStatus('研究同步逾時 · 已退出，不影響交易監控');
      if(!state.perf)setOpen(false);
    },6500);
    try{
      let perf=null,usedCache=false;
      try{
        perf=await getJson('/api/performance',5000);
        storageSet(PERF_CACHE_KEY,perf);
      }catch(err){
        perf=state.perf||storageGet(PERF_CACHE_KEY,null);
        usedCache=!!perf;
        if(!perf)throw err;
      }
      const signals=state.signals||storageGet(SIGNAL_CACHE_KEY,{ok:true,rows:[]})||{ok:true,rows:[]};
      safeCommitResearchRender(perf,signals);
      setStatus(usedCache?'即時研究資料延遲 · 顯示最近資料':'');

      // Optional feed. Never awaited by the critical path.
      void getJson('/api/test-signals',2800).then(next=>{
        if(!next||typeof next!=='object')return;
        storageSet(SIGNAL_CACHE_KEY,next);
        if(state.open)safeCommitResearchRender(state.perf||perf,next);
      }).catch(()=>{});
    }catch(err){
      setStatus('研究資料暫時延遲 · 已退出，不影響交易監控');
      if(!state.perf)setOpen(false);
    }finally{
      clearTimeout(loadWatchdog);loadWatchdog=null;state.loading=false;
    }
  }
  function setStatus`;
  src=src.replace(loaderRe,replacement);

  // Never auto-open the growth panel at page boot. The core trading UI must always win.
  const initialRe=/let initial=false;try\{const v=localStorage\.getItem\(OPEN_KEY\);initial=v===null\?true:v==='1'\}catch\{initial=true\}setOpen\(initial\);/;
  if(initialRe.test(src)){
    src=src.replace(initialRe,"try{localStorage.setItem(OPEN_KEY,'0')}catch{}setOpen(false);");
  }else{
    console.warn('[ui-recovery] initial-open anchor not found; loader protection still applied');
  }

  // Keep the main navigation physically above the growth panel. Previously the panel was inserted
  // immediately after .top, so a tall/loading growth panel pushed the entire page tab bar away.
  const mountRe=/top\.insertAdjacentElement\('afterend',loading\);loading\.insertAdjacentElement\('afterend',panel\);btn\.addEventListener\('click',\(\)=>setOpen\(!state\.open\)\);/;
  if(mountRe.test(src)){
    src=src.replace(mountRe,"const tabs=rootDoc.querySelector('.pageTabs'),mountAnchor=tabs||top;mountAnchor.insertAdjacentElement('afterend',loading);loading.insertAdjacentElement('afterend',panel);btn.addEventListener('click',()=>setOpen(!state.open));tabs?.addEventListener('click',()=>{if(state.open)setOpen(false)},{capture:true});");
  }else{
    console.warn('[ui-recovery] mount anchor not found; CSS containment still active');
  }

  // Make the toggle a guaranteed escape hatch even if rendering fails.
  const setOpenAnchor="if(state.open){markInteraction(INTERACT_HOLD_MS);updateVisits();void loadData(false);startTimer()}else stopTimer();updateScrollRail()";
  if(src.includes(setOpenAnchor)){
    src=src.replace(setOpenAnchor,`if(state.open){\n      markInteraction(INTERACT_HOLD_MS);updateVisits();\n      let close=panel.querySelector('[data-sg-emergency-close]');\n      if(!close){close=rootDoc.createElement('button');close.type='button';close.className='sg-emergency-close';close.dataset.sgEmergencyClose='1';close.textContent='返回交易監控';close.addEventListener('click',()=>setOpen(false));panel.prepend(close)}\n      void loadData(false);startTimer();\n    }else{stopTimer();setStatus('')}updateScrollRail()`);
  }

  atomicWriteChecked(growthPath,src,'system-growth.js');
  return {changed:true};
}

if(import.meta.url===`file://${process.argv[1]}`)patchUiRecoveryV255();
