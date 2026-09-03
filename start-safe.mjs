import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = 'V2.6.28';
const WATCH = [
  'server.js',
  'public/app.js',
  'public/index.html',
  'public/manual-mode-ui.js',
  'public/manual-mode-ui.css',
  'public/mentor-ui-v2622.js',
  'public/growth-status-v2625.js',
];
const JS_CHECK = [
  'server.js',
  'public/app.js',
  'public/manual-mode-ui.js',
  'public/mentor-ui-v2622.js',
  'public/growth-status-v2625.js',
];

function abs(rel){ return path.join(ROOT, rel); }
function log(msg){ console.log(`[boot:${VERSION}] ${msg}`); }
function warn(msg){ console.warn(`[boot:${VERSION}] ${msg}`); }

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
  const p=abs(rel); if(!fs.existsSync(p)) return true;
  const r=spawnSync(process.execPath,['--check',p],{cwd:ROOT,encoding:'utf8',timeout:12_000});
  if(r.status!==0){ warn(`syntax FAIL ${rel}: ${String(r.stderr||r.stdout||'').trim().split('\n').slice(0,2).join(' | ')}`); return false; }
  return true;
}
function validateRuntime(){ return JS_CHECK.every(syntaxOk); }

function safeRun(file,label,timeout=30_000){
  const p=abs(file);
  if(!fs.existsSync(p)){ log(`SKIP ${label} (${file} missing)`); return {ok:true,skipped:true}; }
  const snap=snapshot();
  log(`RUN ${label}`);
  const r=spawnSync(process.execPath,[p],{cwd:ROOT,stdio:'inherit',timeout,env:process.env});
  if(r.status!==0 || r.error){
    restore(snap);
    warn(`ROLLBACK ${label} (${r.error?.code||r.status||'unknown'})`);
    return {ok:false,rolledBack:true};
  }
  if(!validateRuntime()){
    restore(snap);
    warn(`ROLLBACK ${label} (post-patch syntax guard)`);
    return {ok:false,rolledBack:true};
  }
  log(`OK ${label}`);
  return {ok:true};
}

export async function boot(){
  log(`stable launcher · node ${process.version} · cwd ${ROOT}`);
  const results=[];
  // Base generator and every UI/learning enhancement are isolated. A stale regex anchor can no longer take production offline.
  results.push(['prepare-ui', safeRun('prepare-ui.mjs','base prepare',65_000)]);
  for(const [file,label,timeout] of [
    ['workspace-v2619-patch.mjs','actual-trade workspace',22_000],
    ['lock-icon-v2620-patch.mjs','workspace lock icon',14_000],
    ['institutional-shadow-v2621-patch.mjs','institutional shadow',24_000],
    ['workspace-lock-v2621-patch.mjs','independent page lock',18_000],
    ['mentor-edge-v2622-patch.mjs','mentor edge / OOS',24_000],
    ['mentor-ui-v2622-patch.mjs','mentor UI',16_000],
    ['growth-status-v2626-patch.mjs','system growth UI',16_000],
    ['advisory-buckets-v26271-patch.mjs','A/B auto + suggestion buckets',18_000],
  ]) results.push([label,safeRun(file,label,timeout)]);

  const server=abs('server.js');
  if(!fs.existsSync(server)) throw new Error('FATAL server.js missing after rollback-safe boot');
  if(!syntaxOk('server.js')) throw new Error('FATAL server.js syntax invalid');
  const summary=results.map(([n,r])=>`${n}:${r.skipped?'skip':r.ok?'ok':'rollback'}`).join(' · ');
  log(`SUMMARY ${summary}`);
  if(process.env.V2628_PREFLIGHT_ONLY==='1'){ log('PREFLIGHT PASS'); return {preflight:true,summary}; }

  const child=spawn(process.execPath,[server],{cwd:ROOT,stdio:'inherit',env:process.env});
  for(const sig of ['SIGTERM','SIGINT']) process.on(sig,()=>{try{child.kill(sig)}catch{}});
  child.on('error',e=>{console.error(`[boot:${VERSION}] server spawn failed`,e);process.exit(1)});
  child.on('exit',(code,signal)=>{ if(signal) warn(`server exited by ${signal}`); process.exit(Number.isInteger(code)?code:1); });
  return {child,summary};
}

if(import.meta.url===`file://${process.argv[1]}`){
  try { await boot(); } catch(e){ console.error(`[boot:${VERSION}] ${e?.stack||e}`); process.exit(1); }
}
