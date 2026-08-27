import 'dotenv/config';
import express from 'express';
import webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const PORTFOLIO_ID = process.env.PORTFOLIO_ID || '5075281354358777856';
const TRADER_NAME = process.env.TRADER_NAME || '熬鷹資本';
const POLL_MS = Math.max(2000, Number(process.env.POLL_MS || 3000));
const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
fs.mkdirSync(DATA_DIR, { recursive: true });
const SUB_FILE = path.join(DATA_DIR, 'subscriptions.json');
const STATE_FILE = path.join(DATA_DIR, 'position-state.json');
const EVENT_FILE = path.join(DATA_DIR, 'events.json');
const POSITIONS_URL = `https://www.binance.com/bapi/futures/v1/friendly/future/copy-trade/lead-data/positions?portfolioId=${encodeURIComponent(PORTFOLIO_ID)}`;

let baselineReady = false;
let lastFetch = null;
let lastError = null;
let timer = null;
let previousPositions = new Map();
let recentEvents = loadJson(EVENT_FILE, []).slice(0, 30);

app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function saveJson(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch {}
}
function loadSubs() { return loadJson(SUB_FILE, []); }
function saveSubs(subs) { saveJson(SUB_FILE, subs); }

const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
function getVapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const saved = loadJson(VAPID_FILE, null);
  if (saved?.publicKey && saved?.privateKey) return saved;
  const generated = webpush.generateVAPIDKeys();
  saveJson(VAPID_FILE, generated);
  return generated;
}
const vapid = getVapidKeys();
const vapidReady = Boolean(vapid.publicKey && vapid.privateKey);
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:aoying-alert@example.com',
  vapid.publicKey,
  vapid.privateKey
);

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function fmtPrice(v) {
  const x = n(v);
  if (!x) return '-';
  if (x >= 1000) return x.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (x >= 1) return x.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return x.toLocaleString('en-US', { maximumFractionDigits: 8 });
}
function getArray(json) {
  if (Array.isArray(json?.data)) return json.data;
  for (const x of [json?.data?.list, json?.data?.rows, json?.list, json?.rows]) {
    if (Array.isArray(x)) return x;
  }
  return [];
}
function normalizePosition(raw) {
  const symbol = String(raw?.symbol || raw?.pair || '').toUpperCase();
  const amount = n(raw?.positionAmount ?? raw?.amount ?? raw?.positionAmt);
  if (!symbol || Math.abs(amount) < 1e-15) return null;

  let side = String(raw?.positionSide || '').toUpperCase();
  if (side !== 'LONG' && side !== 'SHORT') side = amount >= 0 ? 'LONG' : 'SHORT';

  return {
    symbol,
    side,
    amount: Math.abs(amount),
    signedAmount: amount,
    entryPrice: n(raw?.entryPrice ?? raw?.avgPrice),
    leverage: n(raw?.leverage),
    updateTime: raw?.updateTime ?? raw?.updateTimeStamp ?? null,
  };
}
function keyOf(p) { return `${p.symbol}:${p.side}`; }
function sideZh(side) { return side === 'LONG' ? '做多' : '做空'; }
function sideEmoji(side) { return side === 'LONG' ? '🔴' : '🟢'; }
function changed(a, b) {
  const eps = Math.max(1e-12, Math.abs(a) * 1e-8);
  return Math.abs(a - b) > eps;
}

function loadPersistedState() {
  const arr = loadJson(STATE_FILE, []);
  if (!Array.isArray(arr) || !arr.length) return false;
  previousPositions = new Map(arr.map(p => [keyOf(p), p]));
  baselineReady = true;
  return true;
}
function saveState(map) { saveJson(STATE_FILE, [...map.values()]); }

async function fetchPositions() {
  const headers = {
    accept: 'application/json, text/plain, */*',
    clienttype: 'web',
    lang: 'zh-TW',
    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    referer: `https://www.binance.com/zh-TW/copy-trading/lead-details/${PORTFOLIO_ID}`
  };
  if (process.env.BINANCE_COOKIE) headers.cookie = process.env.BINANCE_COOKIE;

  const r = await fetch(POSITIONS_URL, { headers });
  const text = await r.text();
  if (!r.ok) throw new Error(`Binance HTTP ${r.status}: ${text.slice(0, 160)}`);

  let json;
  try { json = JSON.parse(text); } catch { throw new Error('Binance returned non-JSON'); }
  if (json?.success === false) throw new Error(json?.message || 'Binance success=false');

  const list = getArray(json).map(normalizePosition).filter(Boolean);
  lastFetch = new Date().toISOString();
  lastError = null;
  return new Map(list.map(p => [keyOf(p), p]));
}

function makeEvent(type, current, previous) {
  const p = current || previous;
  const direction = sideZh(p.side);
  const base = {
    id: `${Date.now()}-${p.symbol}-${p.side}-${type}`,
    ts: new Date().toISOString(),
    type,
    symbol: p.symbol,
    side: p.side,
    direction,
    entryPrice: current?.entryPrice || previous?.entryPrice || 0,
  };

  if (type === 'OPEN') {
    return {
      ...base,
      label: direction,
      title: `${sideEmoji(p.side)} ${TRADER_NAME}｜${p.symbol} ${direction}`,
      body: `進場位 ${fmtPrice(current.entryPrice)}`,
    };
  }
  if (type === 'ADD') {
    return {
      ...base,
      label: '加倉',
      title: `➕ ${TRADER_NAME}｜${p.symbol} 加倉`,
      body: `${direction}｜目前進場位 ${fmtPrice(current.entryPrice)}`,
    };
  }
  if (type === 'REDUCE') {
    return {
      ...base,
      label: '減倉',
      title: `➖ ${TRADER_NAME}｜${p.symbol} 減倉`,
      body: direction,
    };
  }
  return {
    ...base,
    label: '平倉',
    title: `✅ ${TRADER_NAME}｜${p.symbol} 平倉`,
    body: `${direction}結束`,
  };
}

async function sendPush(payload) {
  if (!vapidReady) return;
  const subs = loadSubs();
  const keep = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload), {
        TTL: 90,
        urgency: 'high',
      });
      keep.push(sub);
    } catch (e) {
      if (![404, 410].includes(e.statusCode)) keep.push(sub);
    }
  }
  if (keep.length !== subs.length) saveSubs(keep);
}

async function emitEvent(event) {
  recentEvents.unshift(event);
  recentEvents = recentEvents.slice(0, 30);
  saveJson(EVENT_FILE, recentEvents);
  console.log(`[ALERT] ${event.title} | ${event.body}`);
  await sendPush({
    title: event.title,
    body: event.body,
    tag: `${event.symbol}-${event.side}-${event.type}-${Date.now()}`,
    renotify: true,
    data: { url: '/' },
  });
}

async function compareAndNotify(current) {
  const keys = new Set([...previousPositions.keys(), ...current.keys()]);

  for (const key of keys) {
    const prev = previousPositions.get(key);
    const curr = current.get(key);

    if (!prev && curr) {
      await emitEvent(makeEvent('OPEN', curr, null));
      continue;
    }
    if (prev && !curr) {
      await emitEvent(makeEvent('CLOSE', null, prev));
      continue;
    }
    if (!prev || !curr || !changed(prev.amount, curr.amount)) continue;

    if (curr.amount > prev.amount) await emitEvent(makeEvent('ADD', curr, prev));
    else await emitEvent(makeEvent('REDUCE', curr, prev));
  }
}

async function poll() {
  try {
    const current = await fetchPositions();

    if (!baselineReady) {
      previousPositions = current;
      baselineReady = true;
      saveState(current);
      console.log(`[baseline] ${current.size} active positions for ${TRADER_NAME}`);
      return;
    }

    await compareAndNotify(current);
    previousPositions = current;
    saveState(current);
  } catch (e) {
    lastError = String(e.message || e);
    console.error('[poll]', lastError);
  }
}

async function loop() {
  await poll();
  timer = setTimeout(loop, POLL_MS);
}

app.get('/api/config', (_req, res) => {
  res.json({
    traderName: TRADER_NAME,
    portfolioId: PORTFOLIO_ID,
    pollMs: POLL_MS,
    vapidPublicKey: vapid.publicKey || '',
    pushReady: vapidReady,
    baselineReady,
    lastFetch,
    lastError,
  });
});

app.get('/api/status', (_req, res) => {
  res.json({
    positions: [...previousPositions.values()].map(p => ({
      symbol: p.symbol,
      side: p.side,
      direction: sideZh(p.side),
      entryPrice: p.entryPrice,
    })),
    events: recentEvents.slice(0, 15),
    baselineReady,
    lastFetch,
    lastError,
  });
});

app.post('/api/subscribe', (req, res) => {
  if (!vapidReady) return res.status(503).json({ error: 'VAPID_NOT_CONFIGURED' });
  const sub = req.body;
  if (!sub?.endpoint) return res.status(400).json({ error: 'INVALID_SUBSCRIPTION' });
  const subs = loadSubs();
  if (!subs.some(x => x.endpoint === sub.endpoint)) {
    subs.push(sub);
    saveSubs(subs);
  }
  res.json({ ok: true });
});

app.post('/api/test-push', async (_req, res) => {
  try {
    await sendPush({
      title: `🔴 ${TRADER_NAME}｜BTCUSDT 做多`,
      body: '進場位 77,452.8（測試通知）',
      tag: `test-${Date.now()}`,
      renotify: true,
      data: { url: '/' },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/healthz', (_req, res) => res.json({ ok: !lastError, baselineReady, lastFetch, lastError }));

loadPersistedState();
app.listen(PORT, () => {
  console.log(`Aoying alert server: http://localhost:${PORT}`);
  console.log(`Portfolio ID: ${PORTFOLIO_ID}`);
  loop();
});

process.on('SIGTERM', () => {
  if (timer) clearTimeout(timer);
  process.exit(0);
});
