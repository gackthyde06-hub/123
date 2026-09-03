import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = 'V2.6.30';
const BOOT_AT = Date.now();
const WATCH = [
  'server.js',
  'public/app.js',
  'public/index.html',
  'public/manual-mode-ui.js',
  'public/manual-mode-ui.css',
  'public/mentor-ui-v2622.js',
  'public/growth-status-v2625.js',
  'public/growth-status-v2626.css',
  'public/system-growth.js',
  'public/ui-final-v2629.css',
];
const JS_CHECK = [
  'server.js',
  'public/app.js',
  'public/manual-mode-ui.js',
  'public/mentor-ui-v2622.js',
  'public/growth-status-v2625.js',
  'public/system-growth.js',
];

const abs = rel => path.join(ROOT, rel);
const elapsed = () => `${((Date.now()-BOOT_AT)/1000).toFixed(2)}s`;
function log(msg){ console.log(`[boot:${VERSION} +${elapsed()}] ${msg}`); }
function warn(msg){ console.warn(`[boot:${VERSION} +${elapsed()}] ${msg}`); }

function snapshot(){
  const map = new Map();
  for (const rel of WATCH) {
    const p = abs(rel);
    map.set(rel, fs.existsSync(p) ? fs.readFileSync(p) : null);
  }
  return map;
}
function restore(snap){
  for (const [rel, data] of snap.entries()) {
    const p = abs(rel);
    if (data === null) { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {} }
    else { fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,data); }
  }
}
function syntaxOk(rel){
  const p = abs(rel);
  if (!fs.existsSync(p)) return true;
  const r = spawnSync(process.execPath,['--check',p],{cwd:ROOT,encoding:'utf8',timeout:10_000});
  if (r.status !== 0 || r.error) {
    warn(`syntax FAIL ${rel}: ${String(r.stderr||r.stdout||r.error?.message||'').trim().split('\n').slice(0,2).join(' | ')}`);
    return false;
  }
  return true;
}
function validateRuntimeOnce(){
  const bad = JS_CHECK.filter(rel => !syntaxOk(rel));
  if (bad.length) throw new Error(`FATAL runtime syntax validation failed: ${bad.join(', ')}`);
}

// V2.6.30: historical layers already do their own file/syntax guards.
// Do NOT run 6 full node --check passes after every layer. That was the V2.6.29 startup stall.
function safeRun(file,label,timeout=20_000){
  const p = abs(file);
  if (!fs.existsSync(p)) { log(`SKIP ${label} (${file} missing)`); return {ok:true,skipped:true}; }
  const snap = snapshot();
  const t0 = Date.now();
  log(`RUN ${label}`);
  const r = spawnSync(process.execPath,[p],{cwd:ROOT,stdio:'inherit',timeout,env:process.env});
  if (r.status !== 0 || r.error) {
    restore(snap);
    warn(`ROLLBACK ${label} after ${((Date.now()-t0)/1000).toFixed(2)}s (${r.error?.code||r.status||'unknown'})`);
    return {ok:false,rolledBack:true};
  }
  log(`OK ${label} (${((Date.now()-t0)/1000).toFixed(2)}s)`);
  return {ok:true};
}

export async function boot(){
  log(`fast stable launcher · node ${process.version} · cwd ${ROOT}`);
  const results=[];

  // Base generator owns the old V2.6.17 control/stability layer.
  results.push(['prepare-ui', safeRun('prepare-ui.mjs','base prepare',45_000)]);

  // Only layers NOT already guaranteed by final-ui-v2629 are run here.
  // growth-status + advisory are intentionally removed from this list because the final contract
  // already installs/verifies them. Running them twice caused needless startup work.
  for (const [file,label,timeout] of [
    ['workspace-v2619-patch.mjs','actual-trade workspace',14_000],
    ['lock-icon-v2620-patch.mjs','workspace lock icon',10_000],
    ['institutional-shadow-v2621-patch.mjs','institutional shadow',14_000],
    ['workspace-lock-v2621-patch.mjs','independent page lock',10_000],
    ['mentor-edge-v2622-patch.mjs','mentor edge / OOS',14_000],
    ['mentor-ui-v2622-patch.mjs','mentor UI',10_000],
  ]) results.push([label,safeRun(file,label,timeout)]);

  // Required final behavior. No silent rollback here.
  const finalUi = safeRun('final-ui-v2629-patch.mjs','final UI contract',20_000);
  results.push(['final UI contract',finalUi]);
  if (finalUi.skipped || !finalUi.ok) throw new Error('FATAL final UI contract did not apply; refusing partial UI');

  const server = abs('server.js');
  if (!fs.existsSync(server)) throw new Error('FATAL server.js missing after prepare');

  // Exactly ONE complete runtime validation, after all mutations are finished.
  validateRuntimeOnce();

  const summary = results.map(([n,r])=>`${n}:${r.skipped?'skip':r.ok?'ok':'rollback'}`).join(' · ');
  log(`SUMMARY ${summary}`);
  log(`BOOT READY in ${elapsed()}`);
  if (process.env.V2628_PREFLIGHT_ONLY==='1' || process.env.V2629_PREFLIGHT_ONLY==='1' || process.env.V2630_PREFLIGHT_ONLY==='1') {
    log('PREFLIGHT PASS');
    return {preflight:true,summary};
  }

  const child = spawn(process.execPath,[server],{cwd:ROOT,stdio:'inherit',env:process.env});
  for (const sig of ['SIGTERM','SIGINT']) process.on(sig,()=>{try{child.kill(sig)}catch{}});
  child.on('error',e=>{console.error(`[boot:${VERSION}] server spawn failed`,e);process.exit(1)});
  child.on('exit',(code,signal)=>{ if(signal) warn(`server exited by ${signal}`); process.exit(Number.isInteger(code)?code:1); });
  return {child,summary};
}

if (import.meta.url===`file://${process.argv[1]}`) {
  try { await boot(); }
  catch(e) { console.error(`[boot:${VERSION}] ${e?.stack||e}`); process.exit(1); }
}
