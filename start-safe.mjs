import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = 'V2.6.82';

function log(msg){ console.log(`[boot:${VERSION}] ${msg}`); }
function warn(msg){ console.warn(`[boot:${VERSION}] ${msg}`); }

export async function boot(){
  const server = path.join(ROOT, 'server.js');
  log(`clean launcher · node ${process.version} · cwd ${ROOT}`);
  const child = spawn(process.execPath, [server], { cwd: ROOT, stdio: 'inherit', env: process.env });
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { try { child.kill(sig); } catch {} });
  child.on('error', e => { console.error(`[boot:${VERSION}] server spawn failed`, e); process.exit(1); });
  child.on('exit', (code, signal) => {
    if (signal) warn(`server exited by ${signal}`);
    process.exit(Number.isInteger(code) ? code : 1);
  });
  return { child, summary: 'server:ok' };
}

const isMain = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isMain) {
  try { await boot(); } catch (e) { console.error(`[boot:${VERSION}] ${e?.stack || e}`); process.exit(1); }
}
