import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
process.chdir(ROOT);
const T0=Date.now();
const elapsed=()=>`${((Date.now()-T0)/1000).toFixed(2)}s`;
const log=s=>console.log(`[build:V2.6.32 +${elapsed()}] ${s}`);
function must(rel){const p=path.join(ROOT,rel);if(!fs.existsSync(p))throw new Error(`missing required file: ${rel}`);return p}
function run(rel,label,timeout=180000){const p=must(rel),t=Date.now();log(`RUN ${label}`);const r=spawnSync(process.execPath,[p],{cwd:ROOT,stdio:'inherit',env:process.env,timeout});if(r.error)throw new Error(`${label} spawn error: ${r.error.message}`);if(r.status!==0)throw new Error(`${label} exited ${r.status}`);log(`OK ${label} (${((Date.now()-t)/1000).toFixed(2)}s)`)}
function check(rel){const p=must(rel),r=spawnSync(process.execPath,['--check',p],{cwd:ROOT,encoding:'utf8',timeout:30000});if(r.status!==0||r.error)throw new Error(`syntax invalid ${rel}: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`)}
function requireToken(rel,token){const s=fs.readFileSync(must(rel),'utf8');if(!s.includes(token))throw new Error(`invariant missing ${rel}: ${token}`)}

// Build the historical/current base first. Each of these files already owns its own syntax guard.
run('prepare-ui.mjs','base prepare',240000);
for(const [f,l] of [
  ['workspace-v2619-patch.mjs','actual-trade workspace'],
  ['lock-icon-v2620-patch.mjs','workspace lock icon'],
  ['institutional-shadow-v2621-patch.mjs','institutional shadow'],
  ['workspace-lock-v2621-patch.mjs','independent page lock'],
  ['mentor-edge-v2622-patch.mjs','mentor edge / OOS'],
  ['mentor-ui-v2622-patch.mjs','mentor UI'],
])run(f,l,120000);

// IMPORTANT: V2.6.27.1 is incompatible with the V2.6.16 manual renderer.
// Do not call advisory-buckets-v26271-patch.mjs here. V2.6.32 patches the real post-V2616 shape directly.
run('advisory-buckets-v2632-patch.mjs','A/B manual observation',120000);
run('growth-final-v2632-patch.mjs','single growth UI + stability finalizer',120000);

for(const rel of ['server.js','public/app.js','public/manual-mode-ui.js','public/system-growth.js','public/growth-status-v2625.js'])check(rel);
requireToken('public/app.js','UI_STABILITY_V2617');
requireToken('public/app.js','WORKSPACE_STABILITY_V2619');
requireToken('public/manual-mode-ui.js','UI_CONTROL_V2616');
requireToken('public/manual-mode-ui.js','ADVISORY_BUCKETS_V2632');
requireToken('public/manual-mode-ui.js','A · 手動觀察');
requireToken('public/manual-mode-ui.js','B · 手動觀察');
requireToken('public/manual-mode-ui.js','stableBucketRowsV2632');
requireToken('public/system-growth.js','GROWTH_FINAL_V2632_LEGACY_GUARD');
requireToken('public/growth-status-v2625.js','GROWTH_FINAL_V2632_STATUS');
requireToken('server.js','/api/manual-opportunities');
requireToken('server.js','/api/shadow-mentor');
requireToken('public/index.html','/growth-status-v2625.js?v=2632');
requireToken('public/index.html','/advisory-buckets-v26271.css?v=2632');
log('BUILD CONTRACT PASS');
