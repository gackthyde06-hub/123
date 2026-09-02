import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKER = 'TEST_SIGNALS_NONBLOCKING_V256_20260902';

function syntaxCheck(filePath) {
  const r = spawnSync(process.execPath, ['--check', filePath], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`[v256] server syntax invalid: ${String(r.stderr || r.stdout || 'unknown').trim()}`);
}

export function patchTestSignalsStability({ serverPath = path.join(__dirname, 'server.js') } = {}) {
  let src = fs.readFileSync(serverPath, 'utf8');
  if (src.includes(MARKER)) return { changed:false, reason:'already-applied' };

  const routeRe = /app\.get\('\/api\/test-signals',\s*async\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?\n\}\);/;
  const match = src.match(routeRe);
  if (!match) throw new Error('[v256] /api/test-signals route anchor not found');

  const replacement = `/* ${MARKER} */
app.get('/api/test-signals', (req, res) => {
  try {
    const force = String(req.query?.force || '') === '1';
    const stale = !testSignalLastRunAt || Date.now() - testSignalLastRunAt > TEST_SIGNAL_SCAN_MS * 1.5;
    const shouldScan = force || stale;

    // Critical stability rule: UI/API callers receive the latest completed snapshot immediately.
    // Network-heavy multi-timeframe scanning is scheduled after the response path and cannot hold
    // System Growth or the main trading tabs hostage.
    const snapshot = testSignalResponse();
    if (shouldScan && !testSignalBusy) {
      setImmediate(() => {
        void runTestSignalScan(force).catch(err => {
          testSignalLastError = String(err?.message || err);
          console.warn('[test-signal:v256-bg]', testSignalLastError);
        });
      });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...snapshot, scanScheduled: shouldScan, scanBusy: !!testSignalBusy, responseMode: 'NON_BLOCKING_V256' });
  } catch (err) {
    res.status(503).json({ ok:false, error:String(err?.message || err) });
  }
});`;

  src = src.replace(routeRe, replacement);
  const tmp = `${serverPath}.v256-${process.pid}-${Date.now()}.tmp.js`;
  fs.writeFileSync(tmp, src, 'utf8');
  try {
    syntaxCheck(tmp);
    fs.renameSync(tmp, serverPath);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch {}
    throw err;
  }
  return { changed:true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('[v256] test-signals stability', patchTestSignalsStability());
}
