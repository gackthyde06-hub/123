import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKER = 'RUNTIME_RESILIENCE_V254_20260902';

function syntaxCheck(filePath, label) {
  const r = spawnSync(process.execPath, ['--check', filePath], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`[resilience] ${label} syntax invalid: ${String(r.stderr || r.stdout || 'unknown').trim()}`);
}

function atomicWriteChecked(filePath, content, label) {
  const tmp = `${filePath}.resilience-${process.pid}-${Date.now()}.tmp${path.extname(filePath) || '.js'}`;
  fs.writeFileSync(tmp, content, 'utf8');
  try {
    syntaxCheck(tmp, label);
    fs.renameSync(tmp, filePath);
  } catch (e) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
    throw e;
  }
}

function patchServer(serverPath) {
  let src = fs.readFileSync(serverPath, 'utf8');
  if (src.includes(`${MARKER}_SERVER`)) return { changed: false, reason: 'already-applied' };

  const re = /app\.get\('\/api\/test-signals', async \(req, res\) => \{\n  try \{\n    const force = String\(req\.query\?\.force \|\| ''\) === '1';\n    if \(force \|\| !testSignalLastRunAt \|\| Date\.now\(\) - testSignalLastRunAt > TEST_SIGNAL_SCAN_MS \* 1\.5\) await runTestSignalScan\(force\);\n    res\.json\(testSignalResponse\(\)\);\n  \} catch \(err\) \{\n    res\.status\(503\)\.json\(\{ ok:false, error:String\(err\?\.message \|\| err\) \}\);\n  \}\n\}\);/;

  if (!re.test(src)) {
    console.warn('[resilience] server test-signals route anchor not found; frontend rescue remains active');
    return { changed: false, reason: 'anchor-missing' };
  }

  const replacement = `/* ${MARKER}_SERVER */\napp.get('/api/test-signals', (req, res) => {\n  try {\n    const force = String(req.query?.force || '') === '1';\n    const stale = !testSignalLastRunAt || Date.now() - testSignalLastRunAt > TEST_SIGNAL_SCAN_MS * 1.5;\n    const shouldScan = force || stale;\n    // UI must never wait for a network-heavy scan. Return the latest tracker snapshot immediately,\n    // then refresh in the background. The normal scan loop remains unchanged.\n    if (shouldScan && !testSignalBusy) {\n      void runTestSignalScan(force).catch(err => {\n        testSignalLastError = String(err?.message || err);\n        console.warn('[test-signal:bg]', testSignalLastError);\n      });\n    }\n    res.json({ ...testSignalResponse(), scanScheduled: shouldScan, scanBusy: !!testSignalBusy, responseMode: 'NON_BLOCKING_V254' });\n  } catch (err) {\n    res.status(503).json({ ok:false, error:String(err?.message || err) });\n  }\n});`;

  src = src.replace(re, replacement);
  atomicWriteChecked(serverPath, src, 'server.js');
  return { changed: true };
}

function patchGrowth(growthPath) {
  let src = fs.readFileSync(growthPath, 'utf8');
  if (src.includes(`${MARKER}_GROWTH`)) return { changed: false, reason: 'already-applied' };

  const re = /  async function getJson\(path\)\{[\s\S]*?\n  \}\n  function setStatus/;
  if (!re.test(src)) {
    console.warn('[resilience] system-growth loadData anchor not found; fetch rescue remains active');
    return { changed: false, reason: 'anchor-missing' };
  }

  const replacement = `  /* ${MARKER}_GROWTH */\n  const PERF_CACHE_KEY='sg-last-perf-v254';\n  const SIGNAL_CACHE_KEY='sg-last-signals-v254';\n  async function getJson(path,timeoutMs=7000){\n    const ctrl=typeof AbortController!=='undefined'?new AbortController():null;\n    const timer=ctrl?setTimeout(()=>ctrl.abort(),Math.max(1000,timeoutMs)):null;\n    try{\n      const r=await fetch(path,{cache:'no-store',...(ctrl?{signal:ctrl.signal}:{})});\n      if(!r.ok)throw new Error(\`${'${path}'} ${'${r.status}'}\`);\n      return await r.json();\n    }finally{if(timer)clearTimeout(timer)}\n  }\n  function commitResearchRender(perf,signals){\n    const key=renderKeyFor(perf,signals),y=window.scrollY||0;\n    state.perf=perf;state.signals=signals||{ok:true,rows:[]};state.lastLoadedAt=Date.now();\n    if(key!==state.renderKey){state.renderKey=key;render();requestAnimationFrame(()=>{if(Math.abs((window.scrollY||0)-y)>2)window.scrollTo({top:y,behavior:'auto'})})}\n  }\n  async function loadData(force=false){\n    if(state.loading)return;\n    if(force&&state.open&&Date.now()<Number(state.interactUntil||0))return;\n    if(!force&&state.perf&&Date.now()-state.lastLoadedAt<30_000){render();return}\n    state.loading=true;setStatus(state.perf?'更新研究資料…':'同步研究資料…');\n    let usedCachedPerf=false;\n    try{\n      let perf=null;\n      try{\n        perf=await getJson('/api/performance',7000);\n        storageSet(PERF_CACHE_KEY,perf);\n      }catch(perfErr){\n        perf=state.perf||storageGet(PERF_CACHE_KEY,null);\n        if(!perf)throw perfErr;\n        usedCachedPerf=true;\n      }\n      const cachedSignals=state.signals||storageGet(SIGNAL_CACHE_KEY,{ok:true,rows:[]})||{ok:true,rows:[]};\n      // Critical path: performance is enough to render the entire growth system.\n      // Candidate signals are optional and must never hold the page hostage.\n      commitResearchRender(perf,cachedSignals);\n      setStatus(usedCachedPerf?'即時研究資料延遲 · 顯示最近資料':'');\n\n      void getJson('/api/test-signals',4500).then(signals=>{\n        if(!signals||typeof signals!=='object')return;\n        storageSet(SIGNAL_CACHE_KEY,signals);\n        commitResearchRender(state.perf||perf,signals);\n        if(!usedCachedPerf)setStatus('');\n      }).catch(()=>{\n        // Optional feed: keep the already-rendered research page and retry next cycle.\n      });\n    }catch(e){\n      const panel=rootDoc.getElementById('sgPanel');\n      setStatus(\`養成資料暫時不可用 · ${'${e?.name===\'AbortError\'?\'連線逾時\':(e?.message||\'未知錯誤\')}'}\`);\n      if(panel&&!state.perf)panel.innerHTML='<div class="sg-skeleton">研究資料暫時延遲，系統會自動重試；交易監控本身仍在運作。</div>';\n    }finally{state.loading=false}\n  }\n  function setStatus`;

  src = src.replace(re, replacement);
  atomicWriteChecked(growthPath, src, 'system-growth.js');
  return { changed: true };
}

export function patchRuntimeResilience({
  serverPath = path.join(__dirname, 'server.js'),
  growthPath = path.join(__dirname, 'system-growth.js'),
} = {}) {
  const result = { server: null, growth: null };
  try { result.server = patchServer(serverPath); }
  catch (e) { console.error('[resilience] server patch skipped:', String(e?.message || e)); result.server = { changed:false, error:String(e?.message||e) }; }
  try { result.growth = patchGrowth(growthPath); }
  catch (e) { console.error('[resilience] growth patch skipped:', String(e?.message || e)); result.growth = { changed:false, error:String(e?.message||e) }; }
  console.log('[resilience] V2.5.4', JSON.stringify(result));
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) patchRuntimeResilience();
