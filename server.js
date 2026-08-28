import 'dotenv/config';
import express from 'express';
import webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = Number(process.env.PORT || 3000);
const POLL_MS = Math.max(2000, Number(process.env.POLL_MS || 3000));
const POSITION_REFRESH_MS = Math.max(15000, Number(process.env.POSITION_REFRESH_MS || 30000));
const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
fs.mkdirSync(DATA_DIR, { recursive: true });

const TRADERS = [
  { id: '5075281354358777856', name: '熬鷹資本', role: '進攻訊號' },
  { id: '4112815248716815105', name: 'SaGoCrypto', role: '穩健方向' },
  { id: '4855144495762648832', name: '小新交易員', role: '中短波段' },
  { id: '4556315195316581632', name: '人生到處知何似', role: '低槓桿高勝率' },
];
const TRADER_IDS = new Set(TRADERS.map(t => t.id));
const TRADER_BY_ID = new Map(TRADERS.map(t => [t.id, t]));

const BASE = 'https://www.binance.com/bapi/futures/v1';
const ORDER_URL = `${BASE}/friendly/future/copy-trade/lead-portfolio/order-history`;
const SUB_FILE = path.join(DATA_DIR, 'subscriptions.json');
const STATE_FILE = path.join(DATA_DIR, 'state-v5.json');
const SEEN_FILE = path.join(DATA_DIR, 'seen-v5.json');
const EVENT_FILE = path.join(DATA_DIR, 'events-v5.json');
const CONSENSUS_FILE = path.join(DATA_DIR, 'consensus-v5.json');
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');

app.use(express.json({ limit: '128kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function saveJson(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch {}
}
function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function fmtPrice(v) {
  const x = n(v);
  if (!x) return '-';
  if (x >= 1000) return x.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (x >= 1) return x.toLocaleString('en-US', { maximumFractionDigits: 6 });
  return x.toLocaleString('en-US', { maximumFractionDigits: 8 });
}
function sideZh(side) { return side === 'LONG' ? '做多' : '做空'; }
function sideEmoji(side) { return side === 'LONG' ? '🔴' : '🟢'; }
function positionKey(symbol, side) { return `${symbol}:${side}`; }
function getList(json) {
  if (Array.isArray(json?.data)) return json.data;
  for (const x of [json?.data?.list, json?.data?.rows, json?.list, json?.rows]) {
    if (Array.isArray(x)) return x;
  }
  return [];
}
function commonHeaders(portfolioId) {
  const h = {
    accept: 'application/json, text/plain, */*',
    'content-type': 'application/json',
    clienttype: 'web',
    lang: 'zh-TW',
    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    referer: `https://www.binance.com/zh-TW/copy-trading/lead-details/${portfolioId}`,
  };
  if (process.env.BINANCE_COOKIE) h.cookie = process.env.BINANCE_COOKIE;
  return h;
}

function normalizeOrder(raw) {
  const symbol = String(raw?.symbol || '').toUpperCase();
  const side = String(raw?.side || '').toUpperCase();
  const positionSide = String(raw?.positionSide || '').toUpperCase();
  if (!symbol || !['BUY', 'SELL'].includes(side) || !['LONG', 'SHORT'].includes(positionSide)) return null;

  const qty = Math.abs(n(raw?.executedQty ?? raw?.origQty));
  const price = n(raw?.avgPrice);
  const time = n(raw?.orderUpdateTime ?? raw?.orderTime ?? raw?.updateTime);
  if (!qty || !price || !time) return null;

  return {
    key: [symbol, side, positionSide, qty, price, time].join('|'),
    symbol, side, positionSide, qty, price, time,
  };
}

function normalizePosition(raw) {
  const symbol = String(raw?.symbol || raw?.pair || '').toUpperCase();
  const signed = n(raw?.positionAmount ?? raw?.positionAmt ?? raw?.amount);
  if (!symbol || Math.abs(signed) < 1e-15) return null;
  let side = String(raw?.positionSide || '').toUpperCase();
  if (!['LONG', 'SHORT'].includes(side)) side = signed >= 0 ? 'LONG' : 'SHORT';
  return {
    symbol,
    side,
    amount: Math.abs(signed),
    entryPrice: n(raw?.entryPrice ?? raw?.avgPrice),
    source: 'positions',
  };
}

function isIncrease(o) {
  return (o.positionSide === 'LONG' && o.side === 'BUY') ||
         (o.positionSide === 'SHORT' && o.side === 'SELL');
}
function isDecrease(o) {
  return (o.positionSide === 'LONG' && o.side === 'SELL') ||
         (o.positionSide === 'SHORT' && o.side === 'BUY');
}

function applyOrder(map, o) {
  const key = positionKey(o.symbol, o.positionSide);
  const old = map.get(key) || {
    symbol: o.symbol,
    side: o.positionSide,
    amount: 0,
    entryPrice: 0,
    source: 'orders',
  };

  if (isIncrease(o)) {
    const oldQty = old.amount;
    const newQty = oldQty + o.qty;
    const newEntry = oldQty > 0
      ? ((oldQty * old.entryPrice) + (o.qty * o.price)) / newQty
      : o.price;
    const next = { ...old, amount: newQty, entryPrice: newEntry, source: 'orders' };
    map.set(key, next);
    return { type: oldQty > 0 ? 'ADD' : 'OPEN', previous: old, current: next };
  }

  if (isDecrease(o)) {
    const oldQty = old.amount;
    if (oldQty <= 0) return null;
    const newQty = Math.max(0, oldQty - o.qty);
    if (newQty <= 1e-12) {
      map.delete(key);
      return { type: 'CLOSE', previous: old, current: null };
    }
    const next = { ...old, amount: newQty, source: 'orders' };
    map.set(key, next);
    return { type: 'REDUCE', previous: old, current: next };
  }

  return null;
}

function reconstruct(orders) {
  const map = new Map();
  [...orders].sort((a, b) => a.time - b.time).forEach(o => applyOrder(map, o));
  return map;
}

async function fetchOrders(traderId) {
  const r = await fetch(ORDER_URL, {
    method: 'POST',
    headers: commonHeaders(traderId),
    body: JSON.stringify({ portfolioId: traderId, pageNumber: 1, pageSize: 100 }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`order-history HTTP ${r.status}: ${text.slice(0, 120)}`);
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('order-history non-JSON'); }
  if (json?.success === false) throw new Error(json?.message || 'order-history success=false');
  return getList(json).map(normalizeOrder).filter(Boolean);
}

async function fetchOfficialPositions(traderId) {
  const url = `${BASE}/friendly/future/copy-trade/lead-data/positions?portfolioId=${encodeURIComponent(traderId)}`;
  try {
    const r = await fetch(url, { headers: commonHeaders(traderId) });
    if (!r.ok) return [];
    const json = await r.json();
    if (json?.success === false) return [];
    return getList(json).map(normalizePosition).filter(Boolean);
  } catch {
    return [];
  }
}

function mergeOfficial(reconstructed, official) {
  if (!official.length) return reconstructed;
  const merged = new Map(reconstructed);
  for (const p of official) {
    const key = positionKey(p.symbol, p.side);
    const old = merged.get(key);
    merged.set(key, old
      ? { ...old, amount: p.amount || old.amount, entryPrice: p.entryPrice || old.entryPrice, source: 'both' }
      : p);
  }
  return merged;
}

const persistedState = loadJson(STATE_FILE, {});
const persistedSeen = loadJson(SEEN_FILE, {});
const states = new Map();
for (const trader of TRADERS) {
  const persistedPositions = Array.isArray(persistedState[trader.id]) ? persistedState[trader.id] : [];
  const persistedSeenKeys = Array.isArray(persistedSeen[trader.id]) ? persistedSeen[trader.id] : [];
  states.set(trader.id, {
    trader,
    positions: new Map(persistedPositions.map(p => [positionKey(p.symbol, p.side), p])),
    seen: new Set(persistedSeenKeys),
    baselineReady: persistedSeenKeys.length > 0,
    lastFetch: null,
    lastError: null,
    lastPositionRefresh: 0,
  });
}

let recentEvents = loadJson(EVENT_FILE, []).slice(0, 80);
let consensusSent = loadJson(CONSENSUS_FILE, {});
let timer = null;

function persistStates() {
  const stateObj = {};
  const seenObj = {};
  for (const [id, s] of states) {
    stateObj[id] = [...s.positions.values()];
    seenObj[id] = [...s.seen].slice(-1000);
  }
  saveJson(STATE_FILE, stateObj);
  saveJson(SEEN_FILE, seenObj);
}

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
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:leader-alert@example.com',
  vapid.publicKey,
  vapid.privateKey
);

function normalizeSubRecord(x) {
  if (x?.subscription?.endpoint) {
    const enabled = Array.isArray(x.enabledTraders)
      ? x.enabledTraders.filter(id => TRADER_IDS.has(id))
      : TRADERS.map(t => t.id);
    return { endpoint: x.subscription.endpoint, subscription: x.subscription, enabledTraders: enabled };
  }
  if (x?.endpoint) {
    return { endpoint: x.endpoint, subscription: x, enabledTraders: TRADERS.map(t => t.id) };
  }
  return null;
}
function loadSubRecords() {
  return loadJson(SUB_FILE, []).map(normalizeSubRecord).filter(Boolean);
}
function saveSubRecords(records) { saveJson(SUB_FILE, records); }

async function sendPush(payload, target = {}) {
  const records = loadSubRecords();
  const keep = [];
  for (const rec of records) {
    const enabled = new Set(rec.enabledTraders || []);
    const shouldSend = target.traderId
      ? enabled.has(target.traderId)
      : Array.isArray(target.traderIds)
        ? target.traderIds.some(id => enabled.has(id))
        : true;
    if (!shouldSend) { keep.push(rec); continue; }

    try {
      await webpush.sendNotification(rec.subscription, JSON.stringify(payload), { TTL: 90, urgency: 'high' });
      keep.push(rec);
    } catch (e) {
      if (![404, 410].includes(e.statusCode)) keep.push(rec);
    }
  }
  if (keep.length !== records.length) saveSubRecords(keep);
}

function makeTraderEvent(type, trader, o, result) {
  const direction = sideZh(o.positionSide);
  const base = {
    id: `${Date.now()}-${trader.id}-${o.key}`,
    ts: new Date(o.time).toISOString(),
    kind: 'TRADER',
    traderId: trader.id,
    traderName: trader.name,
    type,
    symbol: o.symbol,
    side: o.positionSide,
    direction,
    entryPrice: result?.current?.entryPrice || o.price,
    tradePrice: o.price,
  };
  if (type === 'OPEN') return { ...base, label: direction, title: `${sideEmoji(o.positionSide)} ${trader.name}｜${o.symbol} ${direction}`, body: `進場位 ${fmtPrice(o.price)}` };
  if (type === 'ADD') return { ...base, label: '加倉', title: `➕ ${trader.name}｜${o.symbol} 加倉`, body: `${direction}｜成交位 ${fmtPrice(o.price)}` };
  if (type === 'REDUCE') return { ...base, label: '減倉', title: `➖ ${trader.name}｜${o.symbol} 減倉`, body: `${direction}｜成交位 ${fmtPrice(o.price)}` };
  return { ...base, label: '平倉', title: `✅ ${trader.name}｜${o.symbol} 平倉`, body: `${direction}結束｜成交位 ${fmtPrice(o.price)}` };
}

async function emitEvent(event) {
  recentEvents.unshift(event);
  recentEvents = recentEvents.slice(0, 80);
  saveJson(EVENT_FILE, recentEvents);
  console.log(`[ALERT] ${event.title} | ${event.body}`);
  await sendPush({
    title: event.title,
    body: event.body,
    tag: `${event.kind}-${event.symbol || 'market'}-${Date.now()}`,
    renotify: true,
    data: { url: '/' },
  }, event.kind === 'TRADER' ? { traderId: event.traderId } : { traderIds: event.traderIds });
}

function currentConsensus(symbol, side) {
  const ids = [];
  for (const [id, s] of states) {
    if (s.positions.has(positionKey(symbol, side))) ids.push(id);
  }
  return ids.sort();
}

async function maybeEmitConsensus(symbol, side) {
  const ids = currentConsensus(symbol, side);
  if (ids.length < 2) return;
  const key = `${symbol}|${side}|${ids.join(',')}`;
  const last = Number(consensusSent[key] || 0);
  if (Date.now() - last < 6 * 60 * 60 * 1000) return;
  consensusSent[key] = Date.now();
  saveJson(CONSENSUS_FILE, consensusSent);

  const names = ids.map(id => TRADER_BY_ID.get(id)?.name || id);
  await emitEvent({
    id: `${Date.now()}-consensus-${key}`,
    ts: new Date().toISOString(),
    kind: 'CONSENSUS',
    type: 'CONSENSUS',
    symbol,
    side,
    direction: sideZh(side),
    traderIds: ids,
    traderNames: names,
    label: '共識',
    title: `🔥 ${ids.length}/${TRADERS.length} 交易員同向｜${symbol} ${sideZh(side)}`,
    body: names.join('、'),
  });
}

async function establishBaseline(s, orders) {
  s.positions = reconstruct(orders);
  const official = await fetchOfficialPositions(s.trader.id);
  s.positions = mergeOfficial(s.positions, official);
  s.seen = new Set(orders.map(o => o.key));
  s.baselineReady = true;
  s.lastPositionRefresh = Date.now();
  persistStates();
  console.log(`[baseline-v5] ${s.trader.name}: ${s.positions.size} positions / ${orders.length} orders`);
}

async function processNewOrders(s, orders) {
  const fresh = orders.filter(o => !s.seen.has(o.key)).sort((a, b) => a.time - b.time);
  for (const o of fresh) {
    const result = applyOrder(s.positions, o);
    s.seen.add(o.key);
    if (!result) continue;
    const event = makeTraderEvent(result.type, s.trader, o, result);
    await emitEvent(event);
    await maybeEmitConsensus(o.symbol, o.positionSide);
  }

  if (Date.now() - s.lastPositionRefresh >= POSITION_REFRESH_MS) {
    const official = await fetchOfficialPositions(s.trader.id);
    s.positions = mergeOfficial(s.positions, official);
    s.lastPositionRefresh = Date.now();
  }
  persistStates();
}

async function pollTrader(s) {
  try {
    const orders = await fetchOrders(s.trader.id);
    if (!s.baselineReady) await establishBaseline(s, orders);
    else await processNewOrders(s, orders);
    s.lastFetch = new Date().toISOString();
    s.lastError = null;
  } catch (e) {
    s.lastError = String(e?.message || e);
    console.error(`[poll-v5] ${s.trader.name}: ${s.lastError}`);
  }
}

async function loop() {
  await Promise.allSettled([...states.values()].map(s => pollTrader(s)));
  timer = setTimeout(loop, POLL_MS);
}

app.get('/api/config', (_req, res) => {
  res.json({
    mode: 'V5_MULTI_TRADER',
    pollMs: POLL_MS,
    vapidPublicKey: vapid.publicKey,
    pushReady: true,
    traders: TRADERS,
  });
});

app.get('/api/status', (_req, res) => {
  const traderRows = TRADERS.map(t => {
    const s = states.get(t.id);
    return {
      ...t,
      baselineReady: s.baselineReady,
      lastFetch: s.lastFetch,
      lastError: s.lastError,
      positions: [...s.positions.values()].map(p => ({
        symbol: p.symbol,
        side: p.side,
        direction: sideZh(p.side),
        entryPrice: p.entryPrice,
      })),
    };
  });
  res.json({
    traders: traderRows,
    events: recentEvents.slice(0, 30),
    healthy: traderRows.filter(t => !t.lastError).length,
    total: traderRows.length,
  });
});

app.post('/api/subscribe', (req, res) => {
  const body = req.body || {};
  const subscription = body.subscription?.endpoint ? body.subscription : body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'INVALID_SUBSCRIPTION' });
  const enabled = Array.isArray(body.enabledTraders)
    ? body.enabledTraders.filter(id => TRADER_IDS.has(id))
    : TRADERS.map(t => t.id);

  const records = loadSubRecords();
  const idx = records.findIndex(r => r.endpoint === subscription.endpoint);
  const next = { endpoint: subscription.endpoint, subscription, enabledTraders: enabled };
  if (idx >= 0) records[idx] = next;
  else records.push(next);
  saveSubRecords(records);
  res.json({ ok: true, enabledTraders: enabled });
});

app.post('/api/preferences', (req, res) => {
  const endpoint = String(req.body?.endpoint || '');
  if (!endpoint) return res.status(400).json({ error: 'MISSING_ENDPOINT' });
  const enabled = Array.isArray(req.body?.enabledTraders)
    ? req.body.enabledTraders.filter(id => TRADER_IDS.has(id))
    : [];
  const records = loadSubRecords();
  const rec = records.find(r => r.endpoint === endpoint);
  if (!rec) return res.status(404).json({ error: 'SUBSCRIPTION_NOT_FOUND' });
  rec.enabledTraders = enabled;
  saveSubRecords(records);
  res.json({ ok: true, enabledTraders: enabled });
});

app.post('/api/test-push', async (req, res) => {
  const traderId = TRADER_IDS.has(req.body?.traderId) ? req.body.traderId : TRADERS[0].id;
  const trader = TRADER_BY_ID.get(traderId);
  try {
    await sendPush({
      title: `🔴 ${trader.name}｜BTCUSDT 做多`,
      body: '進場位 77,452.8（測試通知）',
      tag: `test-${Date.now()}`,
      renotify: true,
      data: { url: '/' },
    }, { traderId });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/healthz', (_req, res) => {
  const rows = [...states.values()];
  res.json({
    ok: rows.some(s => !s.lastError),
    healthy: rows.filter(s => !s.lastError).length,
    total: rows.length,
    mode: 'V5',
  });
});

app.listen(PORT, () => {
  console.log(`Leader Alert V5 started on ${PORT}`);
  console.log(`Tracking: ${TRADERS.map(t => `${t.name}(${t.id})`).join(', ')}`);
  loop();
});

process.on('SIGTERM', () => {
  if (timer) clearTimeout(timer);
  process.exit(0);
});
