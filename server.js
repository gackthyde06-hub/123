import 'dotenv/config';
import express from 'express';
import webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = Number(process.env.PORT || 3000);
const PORTFOLIO_ID =
  process.env.PORTFOLIO_ID || '5075281354358777856';

const TRADER_NAME =
  process.env.TRADER_NAME || '熬鷹資本';

const POLL_MS =
  Math.max(2000, Number(process.env.POLL_MS || 3000));

const DATA_DIR =
  process.env.DATA_DIR ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  __dirname;

fs.mkdirSync(DATA_DIR, { recursive: true });

const SUB_FILE = path.join(DATA_DIR, 'subscriptions.json');
const STATE_FILE = path.join(DATA_DIR, 'position-state-v4.json');
const EVENT_FILE = path.join(DATA_DIR, 'events-v4.json');
const SEEN_FILE = path.join(DATA_DIR, 'seen-orders-v4.json');
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');

const BASE =
  'https://www.binance.com/bapi/futures/v1';

const POSITION_URL =
  `${BASE}/friendly/future/copy-trade/lead-data/positions?portfolioId=${encodeURIComponent(PORTFOLIO_ID)}`;

const ORDER_URL =
  `${BASE}/friendly/future/copy-trade/lead-portfolio/order-history`;

let baselineReady = false;
let lastFetch = null;
let lastError = null;
let timer = null;

let positions = new Map();

let recentEvents =
  loadJson(EVENT_FILE, []).slice(0, 30);

let seenOrders =
  new Set(loadJson(SEEN_FILE, []));

app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJson(file, data) {
  try {
    fs.writeFileSync(
      file,
      JSON.stringify(data, null, 2)
    );
  } catch {}
}

function loadSubs() {
  return loadJson(SUB_FILE, []);
}

function saveSubs(subs) {
  saveJson(SUB_FILE, subs);
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function fmt(v) {
  const x = n(v);

  if (!x) return '-';

  if (x >= 1000) {
    return x.toLocaleString('en-US', {
      maximumFractionDigits: 2
    });
  }

  if (x >= 1) {
    return x.toLocaleString('en-US', {
      maximumFractionDigits: 6
    });
  }

  return x.toLocaleString('en-US', {
    maximumFractionDigits: 8
  });
}

function sideZh(side) {
  return side === 'LONG' ? '做多' : '做空';
}

function emoji(side) {
  return side === 'LONG' ? '🔴' : '🟢';
}

function pkey(symbol, side) {
  return `${symbol}:${side}`;
}

function getList(json) {
  if (Array.isArray(json?.data)) {
    return json.data;
  }

  const possible = [
    json?.data?.list,
    json?.data?.rows,
    json?.list,
    json?.rows
  ];

  for (const x of possible) {
    if (Array.isArray(x)) return x;
  }

  return [];
}

function headers() {
  const h = {
    accept: 'application/json, text/plain, */*',
    'content-type': 'application/json',
    clienttype: 'web',
    lang: 'zh-TW',
    'user-agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    referer:
      `https://www.binance.com/zh-TW/copy-trading/lead-details/${PORTFOLIO_ID}`
  };

  if (process.env.BINANCE_COOKIE) {
    h.cookie = process.env.BINANCE_COOKIE;
  }

  return h;
}

/* ===============================
   Binance 最新交易紀錄
   =============================== */

function normalizeOrder(raw) {
  const symbol =
    String(raw?.symbol || '').toUpperCase();

  const side =
    String(raw?.side || '').toUpperCase();

  const positionSide =
    String(raw?.positionSide || '').toUpperCase();

  if (!symbol) return null;

  if (!['BUY', 'SELL'].includes(side)) {
    return null;
  }

  if (!['LONG', 'SHORT'].includes(positionSide)) {
    return null;
  }

  const qty =
    Math.abs(
      n(raw?.executedQty ?? raw?.origQty)
    );

  const price =
    n(raw?.avgPrice);

  const time =
    n(
      raw?.orderUpdateTime ??
      raw?.orderTime ??
      raw?.updateTime
    );

  if (!qty || !price || !time) {
    return null;
  }

  const key = [
    symbol,
    side,
    positionSide,
    qty,
    price,
    time
  ].join('|');

  return {
    key,
    symbol,
    side,
    positionSide,
    qty,
    price,
    time
  };
}

async function fetchOrders() {
  const r = await fetch(ORDER_URL, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      portfolioId: PORTFOLIO_ID,
      pageNumber: 1,
      pageSize: 100
    })
  });

  const text = await r.text();

  if (!r.ok) {
    throw new Error(
      `Order history HTTP ${r.status}: ${text.slice(0, 160)}`
    );
  }

  let json;

  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      'Binance order-history returned non-JSON'
    );
  }

  if (json?.success === false) {
    throw new Error(
      json?.message ||
      'Binance order-history success=false'
    );
  }

  return getList(json)
    .map(normalizeOrder)
    .filter(Boolean);
}

/* ===============================
   Binance 目前持倉（輔助）
   =============================== */

function normalizeOfficialPosition(raw) {
  const symbol =
    String(
      raw?.symbol ||
      raw?.pair ||
      ''
    ).toUpperCase();

  const signed =
    n(
      raw?.positionAmount ??
      raw?.positionAmt ??
      raw?.amount
    );

  if (!symbol || Math.abs(signed) < 1e-15) {
    return null;
  }

  let side =
    String(
      raw?.positionSide || ''
    ).toUpperCase();

  if (!['LONG', 'SHORT'].includes(side)) {
    side = signed >= 0 ? 'LONG' : 'SHORT';
  }

  return {
    symbol,
    side,
    amount: Math.abs(signed),
    entryPrice:
      n(raw?.entryPrice ?? raw?.avgPrice),
    source: 'positions'
  };
}

async function fetchOfficialPositions() {
  try {
    const r = await fetch(POSITION_URL, {
      headers: headers()
    });

    if (!r.ok) return [];

    const json = await r.json();

    if (json?.success === false) {
      return [];
    }

    return getList(json)
      .map(normalizeOfficialPosition)
      .filter(Boolean);

  } catch {
    return [];
  }
}

/* ===============================
   從交易紀錄重建倉位
   =============================== */

function isIncrease(o) {
  return (
    (o.positionSide === 'LONG' &&
      o.side === 'BUY') ||

    (o.positionSide === 'SHORT' &&
      o.side === 'SELL')
  );
}

function isDecrease(o) {
  return (
    (o.positionSide === 'LONG' &&
      o.side === 'SELL') ||

    (o.positionSide === 'SHORT' &&
      o.side === 'BUY')
  );
}

function applyOrder(map, o) {
  const key =
    pkey(o.symbol, o.positionSide);

  const old =
    map.get(key) || {
      symbol: o.symbol,
      side: o.positionSide,
      amount: 0,
      entryPrice: 0,
      source: 'orders'
    };

  /* 開倉 / 加倉 */

  if (isIncrease(o)) {
    const oldQty = old.amount;

    const newQty =
      oldQty + o.qty;

    const newEntry =
      oldQty > 0
        ? (
            oldQty * old.entryPrice +
            o.qty * o.price
          ) / newQty
        : o.price;

    const next = {
      symbol: o.symbol,
      side: o.positionSide,
      amount: newQty,
      entryPrice: newEntry,
      source: 'orders'
    };

    map.set(key, next);

    return {
      type:
        oldQty > 0
          ? 'ADD'
          : 'OPEN',

      previous: old,
      current: next
    };
  }

  /* 減倉 / 平倉 */

  if (isDecrease(o)) {
    const oldQty =
      old.amount;

    if (oldQty <= 0) {
      return null;
    }

    const newQty =
      Math.max(
        0,
        oldQty - o.qty
      );

    if (newQty <= 1e-12) {
      map.delete(key);

      return {
        type: 'CLOSE',
        previous: old,
        current: null
      };
    }

    const next = {
      ...old,
      amount: newQty,
      source: 'orders'
    };

    map.set(key, next);

    return {
      type: 'REDUCE',
      previous: old,
      current: next
    };
  }

  return null;
}

function reconstruct(orders) {
  const map = new Map();

  [...orders]
    .sort((a, b) => a.time - b.time)
    .forEach(o => {
      applyOrder(map, o);
    });

  return map;
}

function mergeOfficial(map, official) {
  if (!official.length) {
    return map;
  }

  const merged =
    new Map(map);

  for (const p of official) {
    const key =
      pkey(p.symbol, p.side);

    const old =
      merged.get(key);

    if (!old) {
      merged.set(key, p);
      continue;
    }

    merged.set(key, {
      ...old,

      amount:
        p.amount ||
        old.amount,

      entryPrice:
        p.entryPrice ||
        old.entryPrice,

      source: 'both'
    });
  }

  return merged;
}

/* ===============================
   推播
   =============================== */

function getVapid() {
  if (
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY
  ) {
    return {
      publicKey:
        process.env.VAPID_PUBLIC_KEY,

      privateKey:
        process.env.VAPID_PRIVATE_KEY
    };
  }

  const saved =
    loadJson(VAPID_FILE, null);

  if (
    saved?.publicKey &&
    saved?.privateKey
  ) {
    return saved;
  }

  const generated =
    webpush.generateVAPIDKeys();

  saveJson(
    VAPID_FILE,
    generated
  );

  return generated;
}

const vapid =
  getVapid();

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT ||
    'mailto:aoying-alert@example.com',

  vapid.publicKey,
  vapid.privateKey
);

async function sendPush(payload) {
  const subs =
    loadSubs();

  const keep = [];

  for (const sub of subs) {
    try {

      await webpush.sendNotification(
        sub,
        JSON.stringify(payload),
        {
          TTL: 90,
          urgency: 'high'
        }
      );

      keep.push(sub);

    } catch (e) {

      if (
        ![404, 410].includes(
          e.statusCode
        )
      ) {
        keep.push(sub);
      }
    }
  }

  if (keep.length !== subs.length) {
    saveSubs(keep);
  }
}

/* ===============================
   通知文字
   =============================== */

function makeEvent(type, o, result) {
  const direction =
    sideZh(o.positionSide);

  const base = {
    id:
      `${Date.now()}-${o.key}`,

    ts:
      new Date(o.time)
        .toISOString(),

    type,
    symbol: o.symbol,
    side: o.positionSide,
    direction,

    entryPrice:
      result?.current?.entryPrice ||
      o.price
  };

  if (type === 'OPEN') {
    return {
      ...base,
      label: direction,

      title:
        `${emoji(o.positionSide)} ${TRADER_NAME}｜${o.symbol} ${direction}`,

      body:
        `進場位 ${fmt(o.price)}`
    };
  }

  if (type === 'ADD') {
    return {
      ...base,
      label: '加倉',

      title:
        `➕ ${TRADER_NAME}｜${o.symbol} 加倉`,

      body:
        `${direction}｜成交位 ${fmt(o.price)}`
    };
  }

  if (type === 'REDUCE') {
    return {
      ...base,
      label: '減倉',

      title:
        `➖ ${TRADER_NAME}｜${o.symbol} 減倉`,

      body:
        `${direction}｜成交位 ${fmt(o.price)}`
    };
  }

  return {
    ...base,
    label: '平倉',

    title:
      `✅ ${TRADER_NAME}｜${o.symbol} 平倉`,

    body:
      `${direction}結束｜成交位 ${fmt(o.price)}`
  };
}

async function emitEvent(event) {
  recentEvents.unshift(event);

  recentEvents =
    recentEvents.slice(0, 30);

  saveJson(
    EVENT_FILE,
    recentEvents
  );

  console.log(
    `[ALERT] ${event.title} | ${event.body}`
  );

  await sendPush({
    title: event.title,
    body: event.body,

    tag:
      `${event.symbol}-${event.side}-${event.type}-${Date.now()}`,

    renotify: true,

    data: {
      url: '/'
    }
  });
}

/* ===============================
   初始化
   =============================== */

async function establishBaseline(orders) {
  positions =
    reconstruct(orders);

  const official =
    await fetchOfficialPositions();

  positions =
    mergeOfficial(
      positions,
      official
    );

  seenOrders =
    new Set(
      orders.map(o => o.key)
    );

  saveJson(
    SEEN_FILE,
    [...seenOrders].slice(-500)
  );

  saveJson(
    STATE_FILE,
    [...positions.values()]
  );

  baselineReady = true;

  console.log(
    `[V4 baseline] ${positions.size} positions / ${orders.length} orders`
  );
}

/* ===============================
   新交易
   =============================== */

async function processNewOrders(orders) {
  const fresh =
    orders
      .filter(
        o => !seenOrders.has(o.key)
      )
      .sort(
        (a, b) => a.time - b.time
      );

  for (const o of fresh) {
    const result =
      applyOrder(
        positions,
        o
      );

    seenOrders.add(o.key);

    if (!result) {
      continue;
    }

    await emitEvent(
      makeEvent(
        result.type,
        o,
        result
      )
    );
  }

  const official =
    await fetchOfficialPositions();

  positions =
    mergeOfficial(
      positions,
      official
    );

  saveJson(
    SEEN_FILE,
    [...seenOrders].slice(-500)
  );

  saveJson(
    STATE_FILE,
    [...positions.values()]
  );
}

/* ===============================
   每 3 秒監控
   =============================== */

async function poll() {
  try {

    const orders =
      await fetchOrders();

    if (!baselineReady) {
      await establishBaseline(
        orders
      );
    } else {
      await processNewOrders(
        orders
      );
    }

    lastFetch =
      new Date().toISOString();

    lastError = null;

  } catch (e) {

    lastError =
      String(
        e?.message || e
      );

    console.error(
      '[V4]',
      lastError
    );
  }
}

async function loop() {
  await poll();

  timer =
    setTimeout(
      loop,
      POLL_MS
    );
}

/* ===============================
   API
   =============================== */

app.get(
  '/api/config',
  (_req, res) => {

    res.json({
      traderName:
        TRADER_NAME,

      portfolioId:
        PORTFOLIO_ID,

      pollMs:
        POLL_MS,

      vapidPublicKey:
        vapid.publicKey,

      pushReady:
        true,

      baselineReady,
      lastFetch,
      lastError,

      mode:
        'V4_ORDER_HISTORY_PRIMARY'
    });
  }
);

app.get(
  '/api/status',
  (_req, res) => {

    res.json({
      positions:
        [...positions.values()]
          .map(p => ({
            symbol:
              p.symbol,

            side:
              p.side,

            direction:
              sideZh(p.side),

            entryPrice:
              p.entryPrice
          })),

      events:
        recentEvents.slice(0, 15),

      baselineReady,
      lastFetch,
      lastError
    });
  }
);

app.post(
  '/api/subscribe',
  (req, res) => {

    const sub =
      req.body;

    if (!sub?.endpoint) {
      return res
        .status(400)
        .json({
          error:
            'INVALID_SUBSCRIPTION'
        });
    }

    const subs =
      loadSubs();

    if (
      !subs.some(
        x =>
          x.endpoint ===
          sub.endpoint
      )
    ) {
      subs.push(sub);
      saveSubs(subs);
    }

    res.json({
      ok: true
    });
  }
);

app.post(
  '/api/test-push',
  async (_req, res) => {

    try {

      await sendPush({
        title:
          `🔴 ${TRADER_NAME}｜BTCUSDT 做多`,

        body:
          '進場位 77,452.8（測試通知）',

        tag:
          `test-${Date.now()}`,

        renotify: true,

        data: {
          url: '/'
        }
      });

      res.json({
        ok: true
      });

    } catch (e) {

      res
        .status(500)
        .json({
          error:
            String(
              e?.message || e
            )
        });
    }
  }
);

app.get(
  '/healthz',
  (_req, res) => {

    res.json({
      ok:
        !lastError,

      baselineReady,
      lastFetch,
      lastError,

      mode:
        'V4'
    });
  }
);

/* ===============================
   啟動
   =============================== */

app.listen(
  PORT,
  () => {

    console.log(
      `熬鷹倉位通知 V4 started on ${PORT}`
    );

    console.log(
      `Portfolio ID: ${PORTFOLIO_ID}`
    );

    loop();
  }
);

process.on(
  'SIGTERM',
  () => {

    if (timer) {
      clearTimeout(timer);
    }

    process.exit(0);
  }
);
