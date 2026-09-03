import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
process.chdir(ROOT);
const T0=Date.now();
const elapsed=()=>`${((Date.now()-T0)/1000).toFixed(2)}s`;
const log=s=>console.log(`[build:V2.6.31 +${elapsed()}] ${s}`);

function must(rel){const p=path.join(ROOT,rel);if(!fs.existsSync(p))throw new Error(`missing required file: ${rel}`);return p}
function run(rel,label,timeout=180000){
  const p=must(rel),t=Date.now();
  log(`RUN ${label}`);
  const r=spawnSync(process.execPath,[p],{cwd:ROOT,stdio:'inherit',env:{...process.env,V2628_PREFLIGHT_ONLY:'0',V2629_PREFLIGHT_ONLY:'0',V2630_PREFLIGHT_ONLY:'0'},timeout});
  if(r.error)throw new Error(`${label} spawn error: ${r.error.message}`);
  if(r.status!==0)throw new Error(`${label} exited ${r.status}`);
  log(`OK ${label} (${((Date.now()-t)/1000).toFixed(2)}s)`);
}
function check(rel){
  const p=must(rel),r=spawnSync(process.execPath,['--check',p],{cwd:ROOT,encoding:'utf8',timeout:30000});
  if(r.status!==0||r.error)throw new Error(`syntax invalid ${rel}: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`);
}
function has(rel,token){return fs.readFileSync(must(rel),'utf8').includes(token)}
function requireToken(rel,token){if(!has(rel,token))throw new Error(`invariant missing ${rel}: ${token}`)}

// IMPORTANT: all mutation happens in Railway BUILD phase, never during runtime health startup.
run('prepare-ui.mjs','base prepare',240000);
for(const [f,l] of [
  ['workspace-v2619-patch.mjs','actual-trade workspace'],
  ['lock-icon-v2620-patch.mjs','workspace lock icon'],
  ['institutional-shadow-v2621-patch.mjs','institutional shadow'],
  ['workspace-lock-v2621-patch.mjs','independent page lock'],
  ['mentor-edge-v2622-patch.mjs','mentor edge / OOS'],
  ['mentor-ui-v2622-patch.mjs','mentor UI'],
]) run(f,l,120000);

// Final UI owns Growth + A/B recovery and must be the last writer.
run('final-ui-v2629-patch.mjs','final UI contract',120000);

for(const rel of ['server.js','public/app.js','public/manual-mode-ui.js','public/system-growth.js','public/growth-status-v2625.js']) check(rel);

requireToken('public/app.js','UI_STABILITY_V2617');
requireToken('public/app.js','WORKSPACE_STABILITY_V2619');
requireToken('public/manual-mode-ui.js','ADVISORY_BUCKETS_V26271');
requireToken('public/manual-mode-ui.js','FINAL_UI_V2629_MANUAL');
requireToken('public/manual-mode-ui.js','A · 手動觀察');
requireToken('public/manual-mode-ui.js','B · 手動觀察');
requireToken('public/growth-status-v2625.js','FINAL_UI_V2629_STATUS');
requireToken('public/system-growth.js','FINAL_UI_V2629_LEGACY_GUARD');
requireToken('server.js','/api/manual-opportunities');
requireToken('server.js','/api/shadow-mentor');
requireToken('public/index.html','/growth-status-v2625.js?v=2629');
requireToken('public/index.html','/ui-final-v2629.css?v=2629');

log('BUILD CONTRACT PASS');
