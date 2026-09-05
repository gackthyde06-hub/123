import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = 'V2.6.83';
const PREFLIGHT_ONLY = process.argv.includes('--preflight');

const REQUIRED_FILES = [
  'server.js',
  'package.json',
  'railway.json',
  'worth-watch-v2682-core.mjs',
  'public/index.html',
  'public/app.js',
  'public/sw.js',
  'public/manual-mode-ui.js',
  'public/manual-workspace-v2638.js',
  'public/manual-candidate-v2664.js',
];
const JS_CHECK = [
  'server.js',
  'worth-watch-v2682-core.mjs',
  'public/app.js',
  'public/sw.js',
  'public/manual-mode-ui.js',
  'public/manual-workspace-v2638.js',
  'public/manual-candidate-v2664.js',
];
const SERVER_MARKERS = [
  'WORTH_WATCH_V2682_20260905',
  'WORTH_WATCH_STICKY_V2683_20260905',
  'SHADOW_BOOTCAMP_V2681_20260905',
  '/api/worth-watch-v2682',
  '/api/manual-opportunities',
  '/api/structure-learning',
  '/api/actual-trades',
  '/api/push-health',
];
const PUBLIC_FORBIDDEN = [
  'vapid.json',
  'subscriptions.json',
  'events.json',
  'events-v5.json',
];

function abs(rel){ return path.join(ROOT, rel); }
function log(msg){ console.log(`[boot:${VERSION}] ${msg}`); }
function fail(msg){ throw new Error(`[boot:${VERSION}] ${msg}`); }

function nodeMajor(){ return Number(String(process.versions.node || '0').split('.')[0] || 0); }
function requireFile(rel){ if (!fs.existsSync(abs(rel))) fail(`required file missing: ${rel}`); }
function syntaxCheck(rel){
  const r = spawnSync(process.execPath, ['--check', abs(rel)], { cwd: ROOT, encoding:'utf8', timeout:15_000 });
  if (r.status !== 0 || r.error) fail(`syntax invalid: ${rel} · ${String(r.stderr || r.stdout || r.error?.message || '').trim()}`);
}
function verifyServerMarkers(){
  const src = fs.readFileSync(abs('server.js'), 'utf8');
  for (const marker of SERVER_MARKERS) if (!src.includes(marker)) fail(`server marker/route missing: ${marker}`);
  const manual = fs.readFileSync(abs('public/manual-workspace-v2638.js'), 'utf8');
  if (!manual.includes('15000') || !manual.includes('載入逾時，系統會自動重試')) fail('manual-opportunities timeout recovery marker missing');
  const sw = fs.readFileSync(abs('public/sw.js'), 'utf8');
  if (!/shadow-/i.test(sw) || !sw.includes('[AB]級')) fail('service worker A/B notification whitelist marker missing');
}
function verifyPublicSecrets(){
  for (const name of PUBLIC_FORBIDDEN) if (fs.existsSync(abs(path.join('public', name)))) fail(`sensitive/runtime file must not be public: public/${name}`);
}
function verifyIndexAssets(){
  const html = fs.readFileSync(abs('public/index.html'), 'utf8');
  const refs = new Set();
  for (const m of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
    const raw = String(m[1] || '');
    if (!raw.startsWith('/') || raw.startsWith('//')) continue;
    const clean = raw.split(/[?#]/)[0].replace(/^\/+/, '');
    if (!clean || clean.startsWith('api/')) continue;
    refs.add(clean);
  }
  const missing = [...refs].filter(rel => !fs.existsSync(abs(path.join('public', rel))));
  if (missing.length) fail(`public/index.html missing local assets: ${missing.join(', ')}`);
}

export function runPreflight(){
  if (nodeMajor() < 22) fail(`Node >=22 required, found ${process.version}`);
  for (const rel of REQUIRED_FILES) requireFile(rel);
  for (const rel of JS_CHECK) syntaxCheck(rel);
  verifyServerMarkers();
  verifyPublicSecrets();
  verifyIndexAssets();
  log('PREFLIGHT PASS · syntax/routes/assets/secrets');
  return { ok:true, version:VERSION };
}

export async function boot(){
  runPreflight();
  if (PREFLIGHT_ONLY) return { preflight:true };
  const server = abs('server.js');
  log(`production launcher · node ${process.version} · cwd ${ROOT}`);
  const child = spawn(process.execPath, [server], { cwd: ROOT, stdio:'inherit', env:process.env });
  for (const sig of ['SIGTERM','SIGINT']) process.on(sig, () => { try { child.kill(sig); } catch {} });
  child.on('error', e => { console.error(`[boot:${VERSION}] server spawn failed`, e); process.exit(1); });
  child.on('exit', (code, signal) => {
    if (signal) console.warn(`[boot:${VERSION}] server exited by ${signal}`);
    process.exit(Number.isInteger(code) ? code : 1);
  });
  return { child, summary:'preflight:ok · server:started' };
}

const isMain = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isMain) {
  try { await boot(); } catch (e) { console.error(e?.stack || e); process.exit(1); }
}
