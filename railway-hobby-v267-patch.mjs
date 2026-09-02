import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKER = 'RAILWAY_HOBBY_V267';

function writeIfChanged(file, before, after) {
  if (before === after) return false;
  fs.writeFileSync(file, after, 'utf8');
  return true;
}

function replaceOnce(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) throw new Error(`[v267-hobby] ${label} anchor not found`);
  return text.replace(from, to);
}

function patchServer() {
  const file = path.join(__dirname, 'server.js');
  if (!fs.existsSync(file)) throw new Error('[v267-hobby] missing server.js');
  const before = fs.readFileSync(file, 'utf8');
  let s = before;

  // Built-in zlib only; no new paid service or external dependency.
  if (!s.includes("import { gzipSync } from 'node:zlib';")) {
    const anchor = "import path from 'node:path';";
    if (!s.includes(anchor)) throw new Error('[v267-hobby] node:path import anchor not found');
    s = s.replace(anchor, `${anchor}\nimport { gzipSync } from 'node:zlib';`);
  }

  // Hobby has much more persistent capacity than the Limited Trial. Keep more clean Shadow history
  // without relaxing any learning/notification thresholds.
  if (s.includes("Number(process.env.SHADOW_MAX_RECORDS || 6000)")) {
    s = s.replace("Number(process.env.SHADOW_MAX_RECORDS || 6000)", "Number(process.env.SHADOW_MAX_RECORDS || 12000)");
  }

  if (!s.includes('const PERF_HISTORY_MAX_RECORDS =')) {
    const anchor = /const SHADOW_MAX_RECORDS =[^\n]+;\n/;
    const m = s.match(anchor);
    if (!m) throw new Error('[v267-hobby] SHADOW_MAX_RECORDS anchor not found');
    const addition = `${m[0]}const PERF_HISTORY_MAX_RECORDS = Math.max(1200, Math.min(6000, Number(process.env.PERF_HISTORY_MAX_RECORDS || 3000)));\nconst BACKTEST_CACHE_MS = Math.max(15*60*1000, Math.min(4*60*60*1000, Number(process.env.BACKTEST_CACHE_MS || 60*60*1000)));\nconst HOBBY_BACKUP_INTERVAL_MS = Math.max(60*60*1000, Number(process.env.HOBBY_BACKUP_INTERVAL_MS || 6*60*60*1000));\nconst HOBBY_BACKUP_KEEP_DAYS = Math.max(3, Math.min(30, Number(process.env.HOBBY_BACKUP_KEEP_DAYS || 14)));\n`;
    s = s.replace(m[0], addition);
  }

  // Notification-performance history is valuable calibration data. The Trial-era 1,200 cap was
  // unnecessarily small once persistent storage is available.
  s = s.replaceAll('signalPerformance=signalPerformance.slice(0,1200)', 'signalPerformance=signalPerformance.slice(0,PERF_HISTORY_MAX_RECORDS)');
  s = s.replaceAll('signalPerformance.slice(0,1200)', 'signalPerformance.slice(0,PERF_HISTORY_MAX_RECORDS)');

  // Backtest candles are historical context, not the live entry trigger. Use RAM to avoid re-downloading
  // thousands of old candles every 15 minutes; live 5m/15m/30m/1h checks keep their original cadence.
  s = s.replaceAll('if(cached&&now-cached.at<15*60*1000)return cached.rows;', 'if(cached&&now-cached.at<BACKTEST_CACHE_MS)return cached.rows;');

  if (!s.includes('function runHobbyBackupV267()')) {
    const anchor = "const ACTUAL_TRADE_FILE = path.join(DATA_DIR, 'actual-trades-v1026.json');";
    if (!s.includes(anchor)) throw new Error('[v267-hobby] ACTUAL_TRADE_FILE anchor not found');
    const backupCode = `${anchor}\n\n// ${MARKER}: tiny daily gzip snapshots of learning ledgers on the existing Railway Volume.\n// No subscriptions, VAPID keys or cookies are copied. This protects Shadow growth from accidental overwrite.\nconst HOBBY_BACKUP_DIR = path.join(DATA_DIR, 'backups-v267');\nlet hobbyBackupTimerV267 = null;\nfunction hobbyDayKeyV267(ts=Date.now()){const d=new Date(ts);return d.toISOString().slice(0,10)}\nfunction runHobbyBackupV267(){\n  try{\n    fs.mkdirSync(HOBBY_BACKUP_DIR,{recursive:true});\n    const day=hobbyDayKeyV267();\n    const files=[SHADOW_PERFORMANCE_FILE,SIGNAL_PERFORMANCE_FILE,TEST_SIGNAL_FILE,TEST_SIGNAL_HISTORY_FILE,ACTUAL_TRADE_FILE];\n    for(const source of files){\n      if(!fs.existsSync(source))continue;\n      const base=path.basename(source).replace(/\\.json$/i,'');\n      const target=path.join(HOBBY_BACKUP_DIR,\`\${base}-\${day}.json.gz\`);\n      if(fs.existsSync(target))continue;\n      const raw=fs.readFileSync(source);\n      if(!raw.length)continue;\n      fs.writeFileSync(target,gzipSync(raw,{level:6}));\n    }\n    const cutoff=Date.now()-HOBBY_BACKUP_KEEP_DAYS*24*60*60*1000;\n    for(const name of fs.readdirSync(HOBBY_BACKUP_DIR)){\n      if(!/\\.json\\.gz$/i.test(name))continue;\n      const p=path.join(HOBBY_BACKUP_DIR,name);\n      try{if(fs.statSync(p).mtimeMs<cutoff)fs.unlinkSync(p)}catch{}\n    }\n  }catch(err){console.warn('[v267-hobby-backup]',String(err?.message||err))}\n}\nsetTimeout(()=>{runHobbyBackupV267();hobbyBackupTimerV267=setInterval(runHobbyBackupV267,HOBBY_BACKUP_INTERVAL_MS);hobbyBackupTimerV267.unref?.()},60_000).unref?.();`;
    s = s.replace(anchor, backupCode);
  }

  if (!s.includes('function pruneRuntimeCachesV267(')) {
    const anchor = `const testCandleSourceCache = new Map();`;
    if (!s.includes(anchor)) throw new Error('[v267-hobby] test cache anchor not found');
    const cacheCode = `${anchor}\n\n// ${MARKER}: use paid-plan RAM as a bounded cache, never as an unbounded leak.\nfunction pruneRuntimeCachesV267(map,maxAgeMs,maxEntries){\n  const now=Date.now();\n  for(const [key,val] of map){const at=Number(val?.at||0);if(at>0&&now-at>maxAgeMs)map.delete(key)}\n  if(map.size<=maxEntries)return;\n  const oldest=[...map.entries()].sort((a,b)=>Number(a[1]?.at||0)-Number(b[1]?.at||0));\n  for(let i=0;i<oldest.length-maxEntries;i++)map.delete(oldest[i][0]);\n}\nconst hobbyCachePruneTimerV267=setInterval(()=>{\n  pruneRuntimeCachesV267(testCandleCache,45*60*1000,500);\n  pruneRuntimeCachesV267(testBacktestCandleCache,4*60*60*1000,300);\n  pruneRuntimeCachesV267(testMicroCache,30*60*1000,300);\n  pruneRuntimeCachesV267(testRiskCache,60*60*1000,300);\n  pruneRuntimeCachesV267(testDerivCache,60*60*1000,300);\n  pruneRuntimeCachesV267(testCrossExchangeCache,60*60*1000,300);\n},10*60*1000);\nhobbyCachePruneTimerV267.unref?.();`;
    s = s.replace(anchor, cacheCode);
  }

  if (!s.includes("app.get('/api/runtime-capacity'")) {
    const anchor = "app.get('/healthz', (_req, res) => {";
    if (!s.includes(anchor)) throw new Error('[v267-hobby] healthz anchor not found');
    const endpoint = `// ${MARKER}: lightweight capacity telemetry for checking whether Hobby resources are actually useful.\nfunction hobbyDirectoryBytesV267(dir){\n  let total=0;try{for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);try{const st=fs.statSync(p);if(st.isFile())total+=st.size;else if(st.isDirectory()&&name==='backups-v267')for(const sub of fs.readdirSync(p)){try{total+=fs.statSync(path.join(p,sub)).size}catch{}}}catch{}}}catch{}return total\n}\nfunction hobbyDiskV267(){\n  try{const x=fs.statfsSync(DATA_DIR),block=Number(x.bsize||x.frsize||4096);return {totalBytes:Number(x.blocks||0)*block,freeBytes:Number(x.bavail||x.bfree||0)*block}}catch{return {totalBytes:null,freeBytes:null}}\n}\napp.get('/api/runtime-capacity', (_req,res)=>{\n  const mem=process.memoryUsage(),disk=hobbyDiskV267();\n  res.json({ok:true,profile:'HOBBY_V267',uptimeSec:Math.round(process.uptime()),memory:{rssBytes:mem.rss,heapUsedBytes:mem.heapUsed,heapTotalBytes:mem.heapTotal},storage:{dataDir:DATA_DIR,dataBytes:hobbyDirectoryBytesV267(DATA_DIR),...disk},learning:{shadowRecords:shadowPerformance.length,shadowMax:SHADOW_MAX_RECORDS,performanceRecords:signalPerformance.length,performanceMax:PERF_HISTORY_MAX_RECORDS,backupKeepDays:HOBBY_BACKUP_KEEP_DAYS},cache:{backtestTtlMs:BACKTEST_CACHE_MS}})\n});\n\n${anchor}`;
    s = s.replace(anchor, endpoint);
  }

  return writeIfChanged(file, before, s);
}

export function patchRailwayHobbyV267() {
  return { changed: patchServer(), marker: MARKER };
}
