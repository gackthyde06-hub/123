import 'dotenv/config';
import express from 'express';
import webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = Number(process.env.PORT || 3000);
const POLL_MS = Math.max(1000, Number(process.env.POLL_MS || 1500));
const CORE_ORDER_POLL_MS = Math.max(2500, Number(process.env.CORE_ORDER_POLL_MS || 3000));
const SECONDARY_ORDER_POLL_MS = Math.max(6000, Number(process.env.SECONDARY_ORDER_POLL_MS || 9000));
const POSITION_REFRESH_MS = Math.max(30000, Number(process.env.POSITION_REFRESH_MS || 60000));
const MARK_PRICE_REFRESH_MS = Math.max(3000, Number(process.env.MARK_PRICE_REFRESH_MS || 5000));
const STATS_REFRESH_MS = Math.max(300000, Number(process.env.STATS_REFRESH_MS || 900000));
const STATS_MAX_PAGES = Math.min(8, Math.max(2, Number(process.env.STATS_MAX_PAGES || 5)));
const STATS_PAGE_SIZE = 100;
const REFERENCE_REFRESH_MS = Math.max(15 * 60 * 1000, Number(process.env.REFERENCE_REFRESH_MS || 60 * 60 * 1000));
const SCREEN_REFRESH_MS = Math.max(30 * 60 * 1000, Number(process.env.SCREEN_REFRESH_MS || 60 * 60 * 1000));
const COPY_BAPI_BUDGET_PER_MIN = Math.max(60, Math.min(110, Number(process.env.COPY_BAPI_BUDGET_PER_MIN || 100)));
const COPY_BAPI_MIN_GAP_MS = Math.max(400, Number(process.env.COPY_BAPI_MIN_GAP_MS || 560));
const CONSENSUS_REARM_MS = Math.max(10 * 60 * 1000, Number(process.env.CONSENSUS_REARM_MS || 30 * 60 * 1000));
const PULLBACK_ACTIVATION_MIN_PCT = Math.max(0.4, Number(process.env.PULLBACK_ACTIVATION_MIN_PCT || 0.8));
const PULLBACK_ACTIVATION_ATR_MULT = Math.max(0.25, Number(process.env.PULLBACK_ACTIVATION_ATR_MULT || 0.75));
const PULLBACK_ACTIVATION_MAX_PCT = Math.max(PULLBACK_ACTIVATION_MIN_PCT, Number(process.env.PULLBACK_ACTIVATION_MAX_PCT || 3));
const PULLBACK_NORMAL_RATIO = 0.382;
const PULLBACK_DEEP_RATIO = 0.618;
const PULLBACK_FIB_INVALID_RATIO = 0.786;
const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || (fs.existsSync('/data') ? '/data' : __dirname);

fs.mkdirSync(DATA_DIR, { recursive: true });

const CORE_TRADER_ID = '5075281354358777856';
const TRADERS = [
  {
    id: CORE_TRADER_ID,
    name: '熬鷹資本',
    screenName: '熬鹰资本',
    defaultTag: '主訊號',
    priority: 1,
    core: true,
    apiConfirmed: true,
    referenceUrl: 'https://copyradar.ljeay772.com/en/trader/5075281354358777856/',
    referenceSeed: {
      source: 'CopyRadar', asOf: '2026-08-28', qualityScore: 70,
      winRate: 65.5, sample: 110, profitFactor: 2.19,
      medianDurationMin: 9.3 * 60, reportedRoi: 5572, followers: 1000,
      maxLeverage: 50, reportedMdd: 68.3, profitConcentration: 16.2,
      copierPnl: 5982385, riskFlags: ['高槓桿', '深回撤'],
    },
  },
  {
    id: '5010080316338276609',
    name: '佛系撈金大隊長',
    screenName: '佛系捞金大队长',
    defaultTag: '強勢確認',
    priority: 2,
    apiConfirmed: true,
    referenceUrl: 'https://copyradar.ljeay772.com/en/trader/5010080316338276609/',
    referenceSeed: {
      source:'CopyRadar/Binance', asOf:'2026-08-29', qualityScore:96,
      winRate:94.3, sample:544, profitFactor:4.95, medianDurationMin:1.4*60,
      reportedRoi:186, followers:40, maxLeverage:20, reportedMdd:37.3,
      profitConcentration:12.9, copierPnl:2386, riskFlags:[],
    },
  },
  {
    id: '5085948606825292289',
    name: '知危',
    screenName: '知危',
    defaultTag: '強勢確認',
    priority: 3,
    apiConfirmed: true,
    referenceUrl: 'https://copyradar.ljeay772.com/en/trader/5085948606825292289/',
    referenceSeed: {
      source:'CopyRadar/Binance', asOf:'2026-08-29', qualityScore:90,
      winRate:92.0, sample:338, profitFactor:2.66, medianDurationMin:2.8*60,
      reportedRoi:171, followers:82, maxLeverage:30, reportedMdd:39.5,
      profitConcentration:18.3, copierPnl:13234, riskFlags:[],
    },
  },
];

const TRADER_IDS = new Set(TRADERS.map(t => t.id));
const TRADER_BY_ID = new Map(TRADERS.map(t => [t.id, t]));
const PULLBACK_EVENT_TYPES = ['PULLBACK', 'DEEP_PULLBACK', 'INVALIDATION'];
const EVENT_TYPES = ['OPEN', 'ADD', 'REDUCE', 'CLOSE', ...PULLBACK_EVENT_TYPES, 'CONSENSUS'];
const EVENT_TYPE_SET = new Set(EVENT_TYPES);

const BASE = 'https://www.binance.com/bapi/futures/v1';
const ORDER_URL = `${BASE}/friendly/future/copy-trade/lead-portfolio/order-history`;
const LEADERBOARD_URL = `${BASE}/friendly/future/copy-trade/home-page/query-list`;
const MARK_PRICE_URL = 'https://fapi.binance.com/fapi/v1/premiumIndex';
const KLINE_URL = 'https://fapi.binance.com/fapi/v1/klines';
const LEVEL_INTERVAL = '15m';
const LEVEL_LIMIT = 140;
const LEVEL_CACHE_MS = 30 * 1000;
const MARKET_24H_URL = 'https://fapi.binance.com/fapi/v1/ticker/24hr';
const MARKET_FLOW_CACHE_MS = Math.max(5000, Number(process.env.MARKET_FLOW_CACHE_MS || 15000));
const MARKET_FLOW_TIMEOUT_MS = Math.max(12000, Number(process.env.MARKET_FLOW_TIMEOUT_MS || 18000));
const MARKET_FLOW_STALE_MS = Math.max(60_000, Number(process.env.MARKET_FLOW_STALE_MS || 10 * 60 * 1000));
const IDEA_CACHE_MS = Math.max(60_000, Number(process.env.IDEA_CACHE_MS || 3 * 60 * 1000));
const IDEA_STALE_MS = Math.max(5 * 60_000, Number(process.env.IDEA_STALE_MS || 20 * 60 * 1000));
const IDEA_SYMBOLS = Math.max(8, Math.min(24, Number(process.env.IDEA_SYMBOLS || 16)));
const IDEA_CONCURRENCY = Math.max(2, Math.min(6, Number(process.env.IDEA_CONCURRENCY || 4)));
const FUTURES_DATA = 'https://fapi.binance.com/futures/data';
const DAILY_BRIEF_MIN_MS = Math.max(60 * 60 * 1000, Number(process.env.DAILY_BRIEF_MIN_MS || 2 * 60 * 60 * 1000));
const DAILY_BRIEF_DEFAULT_MS = Math.max(DAILY_BRIEF_MIN_MS, Number(process.env.DAILY_BRIEF_DEFAULT_MS || 3 * 60 * 60 * 1000));
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';

let marketFlowCache = { at:0, data:null, lastGoodAt:0, error:null, inflight:null };
let rankedIdeasCache = { at:0, data:null, lastGoodAt:0, error:null, inflight:null };
let dailyBriefCache = { at:0, data:null, error:null, inflight:null };
let dailyBriefTimer = null;

const SUB_FILE = path.join(DATA_DIR, 'subscriptions.json');
const STATE_FILE = path.join(DATA_DIR, 'state-v5.json');
const SEEN_FILE = path.join(DATA_DIR, 'seen-v5.json');
const EVENT_FILE = path.join(DATA_DIR, 'events-v5.json');
const CONSENSUS_FILE = path.join(DATA_DIR, 'consensus-v5.json');
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
const STATS_FILE = path.join(DATA_DIR, 'stats-v57.json');
const REFERENCE_FILE = path.join(DATA_DIR, 'reference-v59.json');
const SCREEN_FILE = path.join(DATA_DIR, 'screen-v65.json');
const CONSENSUS_EPISODE_FILE = path.join(DATA_DIR, 'consensus-episodes-v65.json');
const PULLBACK_FILE = path.join(DATA_DIR, 'pullback-trackers-v65.json');

app.use(express.json({ limit: '128kb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
}));

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
function positionKey(symbol, side) { return `${symbol}:${side}`; }
function positionOpenMs(position) {
  const value = position?.openTime ? new Date(position.openTime).getTime() : 0;
  return Number.isFinite(value) ? value : 0;
}
function newestPositions(values) {
  return [...values].sort((a, b) =>
    positionOpenMs(b) - positionOpenMs(a) ||
    String(a?.symbol || '').localeCompare(String(b?.symbol || ''))
  );
}

function collectArrays(value, path = 'root', depth = 0, out = []) {
  if (depth > 5 || value == null) return out;

  if (Array.isArray(value)) {
    out.push({ path, rows: value });
    for (let i = 0; i < Math.min(value.length, 3); i++) {
      if (value[i] && typeof value[i] === 'object') {
        collectArrays(value[i], `${path}[${i}]`, depth + 1, out);
      }
    }
    return out;
  }

  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collectArrays(child, `${path}.${key}`, depth + 1, out);
    }
  }

  return out;
}

function rowScore(row, kind) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return 0;

  const keys = new Set(Object.keys(row));
  const has = (...names) => names.some(x => keys.has(x));

  if (kind === 'order') {
    let score = 0;
    if (has('symbol', 'pair')) score += 4;
    if (has('side', 'orderSide')) score += 3;
    if (has('positionSide', 'posSide')) score += 3;
    if (has('executedQty', 'origQty', 'qty', 'quantity', 'executedQuantity')) score += 2;
    if (has('avgPrice', 'price', 'executedPrice', 'averagePrice')) score += 2;
    if (has('orderUpdateTime', 'orderTime', 'updateTime', 'time', 'createdTime')) score += 2;
    return score;
  }

  let score = 0;
  if (has('symbol', 'pair')) score += 5;
  if (has('positionAmount', 'positionAmt', 'amount', 'qty', 'quantity', 'positionQuantity', 'positionQty')) score += 5;
  if (has('positionSide', 'posSide')) score += 2;
  if (has('entryPrice', 'avgPrice', 'averagePrice')) score += 2;
  return score;
}

function extractBestRows(json, kind) {
  const arrays = collectArrays(json);

  if (!arrays.length) {
    return { rows: [], path: null, rawCount: 0, score: 0 };
  }

  const ranked = arrays.map(candidate => {
    const sample = candidate.rows.slice(0, 8);
    const score = sample.reduce((sum, row) => sum + rowScore(row, kind), 0);
    return { ...candidate, score };
  }).sort((a, b) => b.score - a.score || b.rows.length - a.rows.length);

  const best = ranked[0];

  return {
    rows: best?.rows || [],
    path: best?.path || null,
    rawCount: best?.rows?.length || 0,
    score: best?.score || 0,
  };
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


const copyRate = {
  queue: [], running: false, requestTimes: [], lastRequestAt: 0,
  pauseUntil: 0, total: 0, status429: 0, status403: 0, status418: 0,
  lastStatus: null, lastError: null, lastRateEventAt: null,
};

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, Math.max(0, ms))); }
function pruneCopyRequestTimes(now = Date.now()) {
  copyRate.requestTimes = copyRate.requestTimes.filter(t => now - t < 60000);
}
function retryAfterMs(response, fallbackMs) {
  const raw = response?.headers?.get?.('retry-after');
  const sec = Number(raw);
  return Number.isFinite(sec) && sec >= 0 ? Math.max(1000, sec * 1000) : fallbackMs;
}
async function pumpCopyQueue() {
  if (copyRate.running) return;
  copyRate.running = true;
  try {
    while (copyRate.queue.length) {
      copyRate.queue.sort((a,b) => a.priority - b.priority || a.seq - b.seq);
      const job = copyRate.queue.shift();
      let now = Date.now();
      if (copyRate.pauseUntil > now) await sleep(copyRate.pauseUntil - now);
      now = Date.now();
      pruneCopyRequestTimes(now);
      if (copyRate.requestTimes.length >= COPY_BAPI_BUDGET_PER_MIN) {
        const wait = Math.max(50, copyRate.requestTimes[0] + 60000 - now);
        await sleep(wait);
      }
      now = Date.now();
      const gap = COPY_BAPI_MIN_GAP_MS - (now - copyRate.lastRequestAt);
      if (gap > 0) await sleep(gap);
      try {
        const response = await fetch(job.url, job.options);
        const sentAt = Date.now();
        copyRate.lastRequestAt = sentAt;
        copyRate.requestTimes.push(sentAt);
        copyRate.total += 1;
        copyRate.lastStatus = response.status;
        pruneCopyRequestTimes(sentAt);
        if (response.status === 429) {
          copyRate.status429 += 1;
          copyRate.lastRateEventAt = new Date().toISOString();
          copyRate.pauseUntil = Math.max(copyRate.pauseUntil, sentAt + retryAfterMs(response, 60000));
        } else if (response.status === 418) {
          copyRate.status418 += 1;
          copyRate.lastRateEventAt = new Date().toISOString();
          copyRate.pauseUntil = Math.max(copyRate.pauseUntil, sentAt + retryAfterMs(response, 30 * 60 * 1000));
        } else if (response.status === 403) {
          copyRate.status403 += 1;
          copyRate.lastRateEventAt = new Date().toISOString();
          copyRate.pauseUntil = Math.max(copyRate.pauseUntil, sentAt + 15 * 60 * 1000);
        }
        job.resolve(response);
      } catch (e) {
        copyRate.lastError = String(e?.message || e);
        job.reject(e);
      }
    }
  } finally {
    copyRate.running = false;
    if (copyRate.queue.length) void pumpCopyQueue();
  }
}
let copyQueueSeq = 0;
function copyFetch(url, options = {}, { priority = 3, label = 'copy-bapi' } = {}) {
  return new Promise((resolve, reject) => {
    copyRate.queue.push({ url, options, priority, label, seq: ++copyQueueSeq, resolve, reject });
    void pumpCopyQueue();
  });
}
function copyRateSnapshot() {
  pruneCopyRequestTimes();
  return {
    budgetPerMin: COPY_BAPI_BUDGET_PER_MIN,
    usedLast60s: copyRate.requestTimes.length,
    queued: copyRate.queue.length,
    minGapMs: COPY_BAPI_MIN_GAP_MS,
    pausedUntil: copyRate.pauseUntil > Date.now() ? new Date(copyRate.pauseUntil).toISOString() : null,
    total: copyRate.total, status429: copyRate.status429, status403: copyRate.status403, status418: copyRate.status418,
    lastStatus: copyRate.lastStatus, lastError: copyRate.lastError, lastRateEventAt: copyRate.lastRateEventAt,
  };
}

function normalizeOrder(raw) {
  const symbol = String(raw?.symbol ?? raw?.pair ?? '').toUpperCase();
  const side = String(raw?.side ?? raw?.orderSide ?? '').toUpperCase();
  const positionSide = String(raw?.positionSide ?? raw?.posSide ?? '').toUpperCase();

  if (!symbol || !['BUY', 'SELL'].includes(side) || !['LONG', 'SHORT'].includes(positionSide)) {
    return null;
  }

  const qty = Math.abs(n(
    raw?.executedQty ??
    raw?.origQty ??
    raw?.qty ??
    raw?.quantity ??
    raw?.executedQuantity
  ));

  const price = n(
    raw?.avgPrice ??
    raw?.executedPrice ??
    raw?.averagePrice ??
    raw?.price
  );

  const time = n(
    raw?.orderUpdateTime ??
    raw?.orderTime ??
    raw?.updateTime ??
    raw?.createdTime ??
    raw?.time
  );

  if (!qty || !price || !time) return null;

  return {
    key: [symbol, side, positionSide, qty, price, time].join('|'),
    symbol,
    side,
    positionSide,
    qty,
    price,
    time,
  };
}

function normalizePosition(raw) {
  const symbol = String(raw?.symbol ?? raw?.pair ?? '').toUpperCase();
  let amountRaw =
    raw?.positionAmount ??
    raw?.positionAmt ??
    raw?.amount ??
    raw?.positionQuantity ??
    raw?.positionQty ??
    raw?.quantity ??
    raw?.qty;

  const amountNumber = n(amountRaw);
  let side = String(raw?.positionSide ?? raw?.posSide ?? '').toUpperCase();

  if (!symbol || Math.abs(amountNumber) < 1e-15) return null;
  if (!['LONG', 'SHORT'].includes(side)) side = amountNumber >= 0 ? 'LONG' : 'SHORT';

  return {
    symbol,
    side,
    amount: Math.abs(amountNumber),
    entryPrice: n(raw?.entryPrice ?? raw?.avgPrice ?? raw?.averagePrice ?? raw?.price),
    markPrice: (() => {
      const v = raw?.markPrice ?? raw?.currentPrice ?? raw?.lastPrice;
      const x = Number(v);
      return Number.isFinite(x) && x > 0 ? x : null;
    })(),
    unrealizedProfit: (() => {
      const v = raw?.unrealizedProfit ?? raw?.unRealizedProfit ?? raw?.unrealizedPnl ?? raw?.unRealizedPnl;
      if (v === null || v === undefined || v === '') return null;
      const x = Number(v);
      return Number.isFinite(x) ? x : null;
    })(),
    openTime: (() => {
      const t = n(raw?.openTime ?? raw?.updateTime ?? raw?.time);
      return t > 0 ? new Date(t).toISOString() : null;
    })(),
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
    openTime: null,
    source: 'orders',
  };

  if (isIncrease(o)) {
    const oldQty = old.amount;
    const newQty = oldQty + o.qty;
    const newEntry = oldQty > 0
      ? ((oldQty * old.entryPrice) + (o.qty * o.price)) / newQty
      : o.price;

    const next = {
      ...old,
      amount: newQty,
      entryPrice: newEntry,
      openTime: oldQty > 0 ? old.openTime : new Date(o.time).toISOString(),
      source: 'orders',
    };

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


function median(values) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function calculateRecentStats(orders) {
  // Conservative methodology:
  // - One complete flat -> position -> flat cycle = one trade.
  // - Partial reductions are merged into that same trade.
  // - The FIRST reconstructed cycle for every symbol+side is deliberately
  //   excluded because its true opening may pre-date our history window.
  // - Unmatched reductions are ignored.
  // This sacrifices sample size to reduce false precision.
  const states = new Map();
  const firstCycleConsumed = new Set();
  const completed = [];

  let skippedBoundary = 0;
  let unmatchedReductions = 0;

  const sorted = [...orders]
    .filter(o => o && o.symbol && o.positionSide && Number(o.qty) > 0 && Number(o.price) > 0)
    .sort((a, b) => Number(a.time || 0) - Number(b.time || 0));

  for (const o of sorted) {
    const key = positionKey(o.symbol, o.positionSide);
    let s = states.get(key);

    if (isIncrease(o)) {
      if (!s) {
        s = {
          amount: 0,
          entryPrice: 0,
          grossEntryNotional: 0,
          realizedPnl: 0,
          startTime: Number(o.time || 0),
          endTime: null,
        };
      }

      const oldQty = s.amount;
      const newQty = oldQty + o.qty;

      s.entryPrice = oldQty > 0
        ? ((oldQty * s.entryPrice) + (o.qty * o.price)) / newQty
        : o.price;

      s.amount = newQty;
      s.grossEntryNotional += o.qty * o.price;
      states.set(key, s);
      continue;
    }

    if (isDecrease(o)) {
      if (!s || s.amount <= 1e-12) {
        unmatchedReductions += 1;
        continue;
      }

      const closeQty = Math.min(s.amount, o.qty);
      const pnl = o.positionSide === 'LONG'
        ? (o.price - s.entryPrice) * closeQty
        : (s.entryPrice - o.price) * closeQty;

      if (Number.isFinite(pnl)) s.realizedPnl += pnl;

      s.amount = Math.max(0, s.amount - closeQty);
      s.endTime = Number(o.time || 0);

      if (s.amount <= 1e-12) {
        const roi = s.grossEntryNotional > 0
          ? (s.realizedPnl / s.grossEntryNotional) * 100
          : null;

        if (!firstCycleConsumed.has(key)) {
          // Deliberately throw away the boundary cycle.
          firstCycleConsumed.add(key);
          skippedBoundary += 1;
        } else {
          completed.push({
            pnl: s.realizedPnl,
            roi,
            durationMs: Math.max(0, (s.endTime || 0) - (s.startTime || 0)),
          });
        }

        states.delete(key);
      } else {
        states.set(key, s);
      }
    }
  }

  const sample = completed.length;
  const orderCount = sorted.length;
  const grossProfit = completed.filter(x => x.pnl > 0).reduce((a, x) => a + x.pnl, 0);
  const grossLoss = Math.abs(completed.filter(x => x.pnl < 0).reduce((a, x) => a + x.pnl, 0));
  const roiValues = completed.map(x => x.roi).filter(Number.isFinite);

  if (!sample) {
    return {
      sample: 0,
      wins: 0,
      winRate: null,
      avgProfit: null,
      avgRoi: null,
      medianRoi: null,
      profitFactor: null,
      pfNoLosses: false,
      avgDurationMin: null,
      confidence: 'LOW',
      confidenceScore: 15,
      orderCount,
      skippedBoundary,
      unmatchedReductions,
      method: 'deep_completed_round_trip',
    };
  }

  const wins = completed.filter(x => x.pnl > 0).length;
  const avgProfit = completed.reduce((a, x) => a + x.pnl, 0) / sample;
  const avgRoi = roiValues.length ? roiValues.reduce((a, x) => a + x, 0) / roiValues.length : null;
  const medianRoi = median(roiValues);
  const avgDurationMin = completed.reduce((a, x) => a + x.durationMs, 0) / sample / 60000;

  const pfNoLosses = grossProfit > 0 && grossLoss <= 1e-12;
  const profitFactor = grossLoss > 1e-12 ? grossProfit / grossLoss : (pfNoLosses ? 9.99 : null);

  // Confidence is about data quality/sample size, NOT probability of profit.
  let confidenceScore = 20;
  confidenceScore += Math.min(45, sample * 2.25);
  confidenceScore += orderCount >= 400 ? 20 : orderCount >= 250 ? 14 : orderCount >= 150 ? 8 : 3;
  confidenceScore += skippedBoundary <= Math.max(2, sample * 0.4) ? 10 : 4;
  confidenceScore = Math.max(0, Math.min(100, Math.round(confidenceScore)));

  const confidence =
    sample >= 20 && confidenceScore >= 75 ? 'HIGH' :
    sample >= 8 && confidenceScore >= 50 ? 'MEDIUM' :
    'LOW';

  return {
    sample,
    wins,
    winRate: (wins / sample) * 100,
    avgProfit,
    avgRoi,
    medianRoi,
    profitFactor,
    pfNoLosses,
    avgDurationMin,
    confidence,
    confidenceScore,
    orderCount,
    skippedBoundary,
    unmatchedReductions,
    method: 'deep_completed_round_trip',
  };
}

function reconstruct(orders) {
  const map = new Map();
  [...orders].sort((a, b) => a.time - b.time).forEach(o => applyOrder(map, o));
  return map;
}

function recoverPositionsFromRecent(s, orders) {
  // One-time migration recovery only. Once a valid official-position baseline exists,
  // never let an incomplete recent order window resurrect a position that Binance has
  // already confirmed closed/flat. Fresh orders are still handled by processNewOrders().
  if (s.officialBaselineReady) return 0;

  const rebuilt = reconstruct(orders);
  let recovered = 0;

  for (const [key, p] of rebuilt) {
    if (!s.positions.has(key)) {
      s.positions.set(key, p);
      recovered += 1;
    }
  }

  if (recovered > 0) {
    console.log(`[recover-v5.8] ${s.trader.name}: restored ${recovered} positions`);
    persistStates();
  }

  return recovered;
}

async function fetchOrderPage(traderId, pageNumber = 1, pageSize = 100) {
  const r = await copyFetch(ORDER_URL, {
    method: 'POST',
    headers: commonHeaders(traderId),
    body: JSON.stringify({
      portfolioId: traderId,
      pageNumber,
      pageSize,
    }),
  }, { priority: pageNumber === 1 ? (traderId === CORE_TRADER_ID ? 0 : 2) : 5, label: `orders:${traderId}:p${pageNumber}` });

  const text = await r.text();
  if (!r.ok) throw new Error(`order-history HTTP ${r.status}: ${text.slice(0, 120)}`);

  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error('order-history non-JSON'); }

  if (json?.success === false) {
    throw new Error(json?.message || 'order-history success=false');
  }

  const extracted = extractBestRows(json, 'order');
  const orders = extracted.rows.map(normalizeOrder).filter(Boolean);

  return {
    orders,
    rawCount: extracted.rawCount,
    parsedCount: orders.length,
    path: extracted.path,
    score: extracted.score,
  };
}

async function fetchOrders(traderId) {
  return fetchOrderPage(traderId, 1, 100);
}

async function fetchStatsOrders(traderId, firstPage = []) {
  const all = [];
  const seen = new Set();

  const addRows = rows => {
    const before = all.length;
    for (const row of rows || []) {
      if (!seen.has(row.key)) {
        seen.add(row.key);
        all.push(row);
      }
    }
    return all.length - before;
  };

  addRows(firstPage);

  if (!all.length) {
    const first = await fetchOrderPage(traderId, 1, STATS_PAGE_SIZE);
    addRows(first.orders);
  }

  for (let page = 2; page <= STATS_MAX_PAGES; page++) {
    let detail;

    try {
      detail = await fetchOrderPage(traderId, page, STATS_PAGE_SIZE);
    } catch (e) {
      console.warn(`[stats-page-v6.5] ${traderId} page ${page}: ${String(e?.message || e)}`);
      break;
    }

    const added = addRows(detail.orders);

    if (!added || detail.rawCount < STATS_PAGE_SIZE) break;
    await new Promise(resolve => setTimeout(resolve, 180));
  }

  return all;
}

async function fetchOfficialPositions(traderId) {
  const url = `${BASE}/friendly/future/copy-trade/lead-data/positions?portfolioId=${encodeURIComponent(traderId)}`;

  try {
    const r = await copyFetch(url, { headers: commonHeaders(traderId) }, { priority: 3, label: `positions:${traderId}` });
    const text = await r.text();

    if (!r.ok) {
      return {
        ok: false,
        positions: [],
        rawCount: 0,
        parsedCount: 0,
        path: null,
        error: `positions HTTP ${r.status}: ${text.slice(0, 120)}`,
      };
    }

    let json;
    try { json = JSON.parse(text); }
    catch {
      return {
        ok: false,
        positions: [],
        rawCount: 0,
        parsedCount: 0,
        path: null,
        error: 'positions non-JSON',
      };
    }

    if (json?.success === false) {
      return {
        ok: false,
        positions: [],
        rawCount: 0,
        parsedCount: 0,
        path: null,
        error: json?.message || 'positions success=false',
      };
    }

    const extracted = extractBestRows(json, 'position');
    const positions = extracted.rows.map(normalizePosition).filter(Boolean);

    return {
      ok: true,
      positions,
      rawCount: extracted.rawCount,
      parsedCount: positions.length,
      path: extracted.path,
      score: extracted.score,
      error: null,
    };
  } catch (e) {
    return {
      ok: false,
      positions: [],
      rawCount: 0,
      parsedCount: 0,
      path: null,
      error: String(e?.message || e),
    };
  }
}

function mergeOfficial(reconstructed, officialResult) {
  // Binance Copy-Trading BAPI is internal and its response shape can change.
  // A parsed empty list is not strong enough evidence to erase reconstructed positions.
  if (!officialResult?.ok) return reconstructed;

  const official = Array.isArray(officialResult.positions)
    ? officialResult.positions
    : [];

  if (!official.length) return reconstructed;

  const merged = new Map(reconstructed);

  for (const p of official) {
    const key = positionKey(p.symbol, p.side);
    const old = reconstructed.get(key);

    merged.set(key, {
      ...old,
      ...p,
      openTime: old?.openTime || p.openTime || null,
      source: old ? 'both' : 'positions',
    });
  }

  return merged;
}


function stripHtml(html) {
  return String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&minus;|&#8722;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '—')
    .replace(/\s+/g, ' ')
    .trim();
}

function numericMatch(text, regex) {
  const m = String(text || '').match(regex);
  if (!m) return null;
  const x = Number(String(m[1]).replace(/,/g, ''));
  return Number.isFinite(x) ? x : null;
}

function parseCompactNumber(value, suffix) {
  let x = Number(String(value || '').replace(/,/g, ''));
  if (!Number.isFinite(x)) return null;

  const s = String(suffix || '').toUpperCase();
  if (s === 'K') x *= 1e3;
  if (s === 'M') x *= 1e6;
  if (s === 'B') x *= 1e9;
  return x;
}

function parseCopyRadarHtml(html) {
  const text = stripHtml(html);

  const qualityScore = numericMatch(text, /(\d{1,3})\s+Quality score\s*\/\s*100/i);
  const winRate = numericMatch(text, /Actual win rate\s+(-?\d+(?:\.\d+)?)%/i);
  const sample = numericMatch(text, /Closed trades \(sample\)\s+([\d,]+)\s+trades/i);
  const profitFactor = numericMatch(text, /Profit factor\s+(-?\d+(?:\.\d+)?)/i);

  const hold = text.match(/Median holding time\s+(-?\d+(?:\.\d+)?)\s*([mhd])/i);
  let medianDurationMin = null;
  if (hold) {
    const x = Number(hold[1]);
    const unit = hold[2].toLowerCase();
    if (Number.isFinite(x)) {
      medianDurationMin = unit === 'd' ? x * 1440 : unit === 'h' ? x * 60 : x;
    }
  }

  const reportedRoi = numericMatch(text, /Reported ROI[\s\S]{0,40}?(-?\d+(?:\.\d+)?)%/i);
  const reportedMdd = numericMatch(text, /Reported MDD[\s\S]{0,40}?(-?\d+(?:\.\d+)?)%/i);
  const maxLeverage = numericMatch(text, /Max leverage\s+(\d+(?:\.\d+)?)x/i);

  const followersMatch = text.match(/Current followers[\s\S]{0,35}?([\d,]+)(?![\d])/i);
  const followers = followersMatch
    ? Number(String(followersMatch[1]).replace(/,/g, ''))
    : null;

  const copier = text.match(/Copier realized P&L[\s\S]{0,35}?\$?\s*([+-]?[\d,.]+)\s*([KMB]?)/i);
  const copierPnl = copier ? parseCompactNumber(copier[1], copier[2]) : null;

  const out = {
    source: 'CopyRadar',
    fetchedAt: new Date().toISOString(),
    qualityScore,
    winRate,
    sample,
    profitFactor,
    medianDurationMin,
    reportedRoi,
    reportedMdd,
    maxLeverage,
    followers,
    copierPnl,
  };

  return Object.fromEntries(
    Object.entries(out).filter(([, v]) => v !== null && v !== undefined)
  );
}

function seedReference(trader) {
  const seed = trader?.referenceSeed || {};
  return {
    source: seed.source || 'CopyRadar',
    sourceType: 'SEED',
    fetchedAt: null,
    ...seed,
  };
}

function mergeReference(base, incoming) {
  return {
    ...(base || {}),
    ...(incoming || {}),
    source: incoming?.source || base?.source || 'CopyRadar',
  };
}

function referenceConfidence(ref) {
  const sample = Number(ref?.sample || 0);
  const quality = Number(ref?.qualityScore || 0);

  if (sample >= 100 && quality >= 90) return { confidence: 'HIGH', confidenceScore: 90 };
  if (sample >= 50 || quality >= 85) return { confidence: 'MEDIUM', confidenceScore: 72 };
  if (quality > 0) return { confidence: 'LOW', confidenceScore: 50 };
  return { confidence: 'LOW', confidenceScore: 20 };
}

function displayStatsFor(s) {
  const live = s.recentStats || {};
  const liveSample = Number(live.sample || 0);
  const liveOrders = Number(s.statsOrderCount || 0);
  const ref = s.referenceStats || seedReference(s.trader);
  const hasMetric = v =>
    v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

  const liveUsable =
    liveOrders > 0 &&
    (
      liveSample >= 3 ||
      hasMetric(live.winRate) ||
      hasMetric(live.profitFactor) ||
      hasMetric(live.medianRoi) ||
      hasMetric(live.avgRoi)
    );

  if (liveUsable) {
    return {
      available: true,
      sourceType: 'LIVE',
      sourceLabel: '近期重建',
      updatedAt: s.statsUpdatedAt,
      orderCount: liveOrders,
      ...live,
    };
  }

  const refHasMetrics = [
    ref?.winRate,
    ref?.profitFactor,
    ref?.qualityScore,
    ref?.reportedRoi,
    ref?.sample,
  ].some(v => v !== null && v !== undefined && v !== '');

  if (refHasMetrics) {
    const c = referenceConfidence(ref);
    return {
      available: true,
      sourceType: 'PUBLIC',
      sourceLabel: ref?.fetchedAt ? '公開基準' : '公開基準快照',
      updatedAt: ref?.fetchedAt || ref?.asOf || null,
      orderCount: 0,
      avgProfit: null,
      avgRoi: null,
      medianRoi: null,
      avgDurationMin: ref?.medianDurationMin ?? null,
      profitFactor: ref?.profitFactor ?? null,
      winRate: ref?.winRate ?? null,
      sample: Number(ref?.sample || 0),
      qualityScore: ref?.qualityScore ?? null,
      reportedRoi: ref?.reportedRoi ?? null,
      followers: ref?.followers ?? null,
      reportedMdd: ref?.reportedMdd ?? null,
      maxLeverage: ref?.maxLeverage ?? null,
      copierPnl: ref?.copierPnl ?? null,
      riskFlags: ref?.riskFlags || [],
      confidence: c.confidence,
      confidenceScore: c.confidenceScore,
    };
  }

  return {
    available: false,
    sourceType: 'NONE',
    sourceLabel: '等待資料',
    updatedAt: null,
    sample: 0,
    confidence: 'LOW',
    confidenceScore: 0,
  };
}

async function fetchReferenceStats(trader) {
  if (!trader?.referenceUrl) throw new Error('NO_REFERENCE_URL');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const r = await fetch(trader.referenceUrl, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'Mozilla/5.0 PositionAlert/6.5',
      },
      signal: controller.signal,
    });

    if (!r.ok) throw new Error(`reference HTTP ${r.status}`);

    const html = await r.text();
    const parsed = parseCopyRadarHtml(html);

    if (
      parsed.qualityScore == null &&
      parsed.winRate == null &&
      parsed.sample == null &&
      parsed.profitFactor == null
    ) {
      throw new Error('REFERENCE_PARSE_EMPTY');
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}



const levelCandleCache = new Map();

function cleanFuturesSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z0-9]{5,24}$/.test(symbol)) return '';
  return symbol;
}

function parseKlineRow(row) {
  if (!Array.isArray(row) || row.length < 6) return null;
  const openTime = Number(row[0]);
  const open = Number(row[1]);
  const high = Number(row[2]);
  const low = Number(row[3]);
  const close = Number(row[4]);
  const volume = Number(row[5] || 0);
  const closeTime = Number(row[6] || 0);
  if (![openTime, open, high, low, close].every(Number.isFinite)) return null;
  if (!(high > 0) || !(low > 0) || !(close > 0) || high < low) return null;
  return { openTime, open, high, low, close, volume:Number.isFinite(volume)?volume:0, closeTime };
}

async function fetchLevelCandles(symbol) {
  const now = Date.now();
  const cached = levelCandleCache.get(symbol);
  if (cached && now - cached.at < LEVEL_CACHE_MS) return cached.candles;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const url = `${KLINE_URL}?symbol=${encodeURIComponent(symbol)}&interval=${LEVEL_INTERVAL}&limit=${LEVEL_LIMIT}`;
    const r = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 PositionAlert/6.5' },
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(`kline HTTP ${r.status}`);
    const json = await r.json();
    if (!Array.isArray(json)) throw new Error('kline invalid');
    const candles = json.map(parseKlineRow).filter(Boolean);
    if (candles.length < 40) throw new Error('kline too short');
    levelCandleCache.set(symbol, { at: now, candles });
    return candles;
  } finally {
    clearTimeout(timeout);
  }
}

function atrValue(candles, period = 14) {
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    trs.push(Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close)
    ));
  }
  const tail = trs.slice(-period);
  if (!tail.length) return null;
  const atr = tail.reduce((a, b) => a + b, 0) / tail.length;
  return Number.isFinite(atr) && atr > 0 ? atr : null;
}

function swingLevels(candles, span = 2) {
  const highs = [];
  const lows = [];
  for (let i = span; i < candles.length - span; i++) {
    const c = candles[i];
    let isHigh = true, isLow = true;
    for (let j = i - span; j <= i + span; j++) {
      if (j === i) continue;
      if (candles[j].high >= c.high) isHigh = false;
      if (candles[j].low <= c.low) isLow = false;
    }
    if (isHigh) highs.push({ price: c.high, time: c.openTime });
    if (isLow) lows.push({ price: c.low, time: c.openTime });
  }
  return { highs, lows };
}

function nearestPriceLevel(points, entry, direction) {
  const valid = points
    .filter(p => direction === 'BELOW' ? p.price < entry : p.price > entry)
    .slice(-12)
    .sort((a, b) => Math.abs(a.price - entry) - Math.abs(b.price - entry));
  return valid[0]?.price ?? null;
}

function favorableMovePct(side, entry, target) {
  if (!(entry > 0) || !(target > 0)) return null;
  return side === 'SHORT'
    ? ((entry - target) / entry) * 100
    : ((target - entry) / entry) * 100;
}

function adverseMovePct(side, entry, stop) {
  if (!(entry > 0) || !(stop > 0)) return null;
  return side === 'SHORT'
    ? ((stop - entry) / entry) * 100
    : ((entry - stop) / entry) * 100;
}

function buildReferenceLevels(candles, side, entry) {
  // Ignore the still-forming last candle for structure detection when possible.
  const closed = candles.length > 50 ? candles.slice(0, -1) : candles;
  const recent = closed.slice(-96);
  const atr = atrValue(recent, 14);
  if (!(atr > 0)) throw new Error('ATR unavailable');

  const swings = swingLevels(recent, 2);
  const last20 = recent.slice(-20);
  const last48 = recent.slice(-48);
  const fallbackLow = Math.min(...last20.map(c => c.low));
  const fallbackHigh = Math.max(...last20.map(c => c.high));
  const broaderLow = Math.min(...last48.map(c => c.low));
  const broaderHigh = Math.max(...last48.map(c => c.high));

  let support = nearestPriceLevel(swings.lows, entry, 'BELOW');
  let resistance = nearestPriceLevel(swings.highs, entry, 'ABOVE');
  if (!(support > 0 && support < entry)) support = fallbackLow < entry ? fallbackLow : broaderLow;
  if (!(resistance > entry)) resistance = fallbackHigh > entry ? fallbackHigh : broaderHigh;

  if (side === 'LONG') {
    if (!(support > 0 && support < entry)) support = entry - 1.15 * atr;
    if (!(resistance > entry)) resistance = entry + 1.8 * atr;

    const slNear = Math.min(support - 0.15 * atr, entry - 0.75 * atr);
    const slFar = Math.min(support - 0.48 * atr, entry - 1.05 * atr);
    const slSuggested = Math.min(support - 0.30 * atr, entry - 0.90 * atr);
    const risk = entry - slSuggested;

    const rrNear = entry + 1.5 * risk;
    const rrFar = entry + 2.2 * risk;
    const structR = (resistance - entry) / risk;
    const structTarget = Math.max(entry + 0.6 * atr, resistance - 0.08 * atr);
    const tpSuggested = structR >= 1.25 && structR <= 2.6
      ? structTarget
      : entry + 1.8 * risk;

    return {
      interval: LEVEL_INTERVAL,
      atr,
      support,
      resistance,
      sl: {
        low: Math.min(slFar, slNear), high: Math.max(slFar, slNear), suggested: slSuggested,
        near: slNear, far: slFar,
      },
      tp: {
        low: Math.min(rrNear, rrFar), high: Math.max(rrNear, rrFar), suggested: tpSuggested,
        near: rrNear, far: rrFar,
      },
      tpPct: favorableMovePct(side, entry, tpSuggested),
      slPct: adverseMovePct(side, entry, slSuggested),
      structureTarget: resistance,
      structureTargetR: structR,
      note: structR < 1.25 ? '上方結構壓力偏近，參考 TP 可能需要保守。' : null,
    };
  }

  if (!(resistance > entry)) resistance = entry + 1.15 * atr;
  if (!(support > 0 && support < entry)) support = entry - 1.8 * atr;

  const slNear = Math.max(resistance + 0.15 * atr, entry + 0.75 * atr);
  const slFar = Math.max(resistance + 0.48 * atr, entry + 1.05 * atr);
  const slSuggested = Math.max(resistance + 0.30 * atr, entry + 0.90 * atr);
  const risk = slSuggested - entry;

  const rrNear = entry - 1.5 * risk;
  const rrFar = entry - 2.2 * risk;
  const structR = (entry - support) / risk;
  const structTarget = Math.min(entry - 0.6 * atr, support + 0.08 * atr);
  const tpSuggested = structR >= 1.25 && structR <= 2.6
    ? structTarget
    : entry - 1.8 * risk;

  return {
    interval: LEVEL_INTERVAL,
    atr,
    support,
    resistance,
    sl: {
      low: Math.min(slNear, slFar), high: Math.max(slNear, slFar), suggested: slSuggested,
      near: slNear, far: slFar,
    },
    tp: {
      low: Math.min(rrFar, rrNear), high: Math.max(rrFar, rrNear), suggested: tpSuggested,
      near: rrNear, far: rrFar,
    },
    tpPct: favorableMovePct(side, entry, tpSuggested),
    slPct: adverseMovePct(side, entry, slSuggested),
    structureTarget: support,
    structureTargetR: structR,
    note: structR < 1.25 ? '下方結構支撐偏近，參考 TP 可能需要保守。' : null,
  };
}

function pullbackKey(traderId, symbol, side) {
  return `${traderId}|${String(symbol || '').toUpperCase()}|${String(side || '').toUpperCase()}`;
}

function pullbackActivationMove(tracker) {
  const entry = Number(tracker?.entryPrice);
  if (!(entry > 0)) return null;
  const atr = Number(tracker?.atr);
  const minMove = entry * (PULLBACK_ACTIVATION_MIN_PCT / 100);
  const atrMove = Number.isFinite(atr) && atr > 0 ? atr * PULLBACK_ACTIVATION_ATR_MULT : minMove;
  return Math.min(entry * (PULLBACK_ACTIVATION_MAX_PCT / 100), Math.max(minMove, atrMove));
}

function priceAtPullbackRatio(side, extreme, excursion, ratio) {
  return side === 'SHORT'
    ? extreme + excursion * ratio
    : extreme - excursion * ratio;
}

function pullbackSnapshot(tracker, marketPrice) {
  const entry = Number(tracker?.entryPrice);
  const side = String(tracker?.side || '').toUpperCase();
  const price = Number(marketPrice);
  if (!(entry > 0) || !(price > 0) || !['LONG', 'SHORT'].includes(side)) return null;

  const storedExtreme = Number(tracker?.extremePrice);
  const extreme = side === 'SHORT'
    ? Math.min(entry, Number.isFinite(storedExtreme) && storedExtreme > 0 ? storedExtreme : entry, price)
    : Math.max(entry, Number.isFinite(storedExtreme) && storedExtreme > 0 ? storedExtreme : entry, price);
  const excursion = side === 'SHORT' ? entry - extreme : extreme - entry;
  const retraced = side === 'SHORT' ? price - extreme : extreme - price;
  const ratio = excursion > 0 ? Math.max(0, retraced / excursion) : 0;
  const activationMove = pullbackActivationMove(tracker);
  const activated = Number.isFinite(activationMove) && excursion >= activationMove;
  const normalA = priceAtPullbackRatio(side, extreme, excursion, PULLBACK_NORMAL_RATIO);
  const normalB = priceAtPullbackRatio(side, extreme, excursion, 0.5);
  const deepA = priceAtPullbackRatio(side, extreme, excursion, PULLBACK_DEEP_RATIO);
  const deepB = priceAtPullbackRatio(side, extreme, excursion, PULLBACK_FIB_INVALID_RATIO);
  const fibInvalidPrice = priceAtPullbackRatio(side, extreme, excursion, PULLBACK_FIB_INVALID_RATIO);
  const activationPct = activationMove / entry * 100;
  const excursionPct = excursion / entry * 100;

  let status = 'WAIT_MOVE';
  if (tracker?.invalidSentAt) status = 'INVALID';
  else if (tracker?.deepSentAt) status = 'DEEP_SENT';
  else if (tracker?.normalSentAt) status = 'NORMAL_SENT';
  else if (activated) status = 'TRACKING';
  if (tracker?.hydrationStatus && tracker.hydrationStatus !== 'READY') status = 'SYNCING';

  return {
    marketPrice: price,
    extremePrice: extreme,
    excursion,
    excursionPct,
    retracementRatio: ratio,
    retracementPct: ratio * 100,
    activationMove,
    activationPct,
    activated,
    normal: { low: Math.min(normalA, normalB), high: Math.max(normalA, normalB) },
    deep: { low: Math.min(deepA, deepB), high: Math.max(deepA, deepB) },
    fibInvalidPrice,
    structuralInvalidPrice: Number(tracker?.invalidPrice) > 0 ? Number(tracker.invalidPrice) : null,
    status,
  };
}

function pullbackTransition(tracker, marketPrice, now = Date.now()) {
  const snapshot = pullbackSnapshot(tracker, marketPrice);
  if (!snapshot) return { tracker, snapshot: null, eventType: null, reason: null };

  const next = {
    ...tracker,
    extremePrice: snapshot.extremePrice,
    lastPrice: snapshot.marketPrice,
    lastObservedAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
  const side = String(next.side || '').toUpperCase();
  const invalidPrice = Number(next.invalidPrice);
  const structuralInvalid = invalidPrice > 0 && (
    side === 'SHORT' ? snapshot.marketPrice >= invalidPrice : snapshot.marketPrice <= invalidPrice
  );

  let eventType = null;
  let reason = null;
  if (!next.invalidSentAt && structuralInvalid) {
    eventType = 'INVALIDATION';
    reason = 'STRUCTURE';
    next.invalidSentAt = new Date(now).toISOString();
  } else if (snapshot.activated && !next.invalidSentAt && snapshot.retracementRatio >= PULLBACK_FIB_INVALID_RATIO) {
    eventType = 'INVALIDATION';
    reason = 'FIB_TOO_DEEP';
    next.invalidSentAt = new Date(now).toISOString();
    next.normalSentAt ||= next.invalidSentAt;
    next.deepSentAt ||= next.invalidSentAt;
  } else if (snapshot.activated && !next.deepSentAt && snapshot.retracementRatio >= PULLBACK_DEEP_RATIO) {
    eventType = 'DEEP_PULLBACK';
    reason = 'FIB_0618';
    next.deepSentAt = new Date(now).toISOString();
    next.normalSentAt ||= next.deepSentAt;
  } else if (snapshot.activated && !next.normalSentAt && snapshot.retracementRatio >= PULLBACK_NORMAL_RATIO) {
    eventType = 'PULLBACK';
    reason = 'FIB_0382';
    next.normalSentAt = new Date(now).toISOString();
  }

  next.lastRetracementRatio = snapshot.retracementRatio;
  return {
    tracker: next,
    snapshot: pullbackSnapshot(next, snapshot.marketPrice),
    eventType,
    reason,
  };
}

const entryReferenceCache = new Map();

async function fetchEntryReferenceCandles(symbol, openTime) {
  const ts = new Date(openTime).getTime();
  if (!Number.isFinite(ts)) throw new Error('invalid pullback open time');
  const bucket = Math.floor(ts / (15 * 60 * 1000));
  const key = `${symbol}|${bucket}`;
  const cached = entryReferenceCache.get(key);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const url = `${KLINE_URL}?symbol=${encodeURIComponent(symbol)}&interval=${LEVEL_INTERVAL}&limit=${LEVEL_LIMIT}&endTime=${encodeURIComponent(ts)}`;
    const r = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 PositionAlert/6.5' },
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(`entry kline HTTP ${r.status}`);
    const json = await r.json();
    const candles = Array.isArray(json) ? json.map(parseKlineRow).filter(Boolean) : [];
    if (candles.length < 40) throw new Error('entry kline too short');
    entryReferenceCache.set(key, candles);
    return candles;
  } finally {
    clearTimeout(timeout);
  }
}

function historicalKlinePlan(startTime, endTime) {
  const age = Math.max(0, endTime - startTime);
  if (age <= 20 * 60 * 60 * 1000) return { interval: '1m', stepMs: 60 * 1000 };
  if (age <= 5 * 24 * 60 * 60 * 1000) return { interval: '5m', stepMs: 5 * 60 * 1000 };
  return { interval: '15m', stepMs: 15 * 60 * 1000 };
}

async function fetchHistoricalExtremes(symbol, startTime, endTime) {
  const plan = historicalKlinePlan(startTime, endTime);
  let cursor = Math.floor(startTime / plan.stepMs) * plan.stepMs + plan.stepMs;
  let high = null;
  let low = null;
  let pages = 0;
  let sawCandles = false;

  while (cursor < endTime && pages < 3) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const url = `${KLINE_URL}?symbol=${encodeURIComponent(symbol)}&interval=${plan.interval}&limit=1000&startTime=${encodeURIComponent(cursor)}&endTime=${encodeURIComponent(endTime)}`;
      const r = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 PositionAlert/6.5' },
        signal: controller.signal,
      });
      if (!r.ok) throw new Error(`history kline HTTP ${r.status}`);
      const json = await r.json();
      const candles = Array.isArray(json) ? json.map(parseKlineRow).filter(Boolean) : [];
      if (!candles.length) break;
      sawCandles = true;
      for (const c of candles) {
        high = high == null ? c.high : Math.max(high, c.high);
        low = low == null ? c.low : Math.min(low, c.low);
      }
      const last = candles[candles.length - 1];
      const nextCursor = last.openTime + plan.stepMs;
      if (!(nextCursor > cursor)) break;
      cursor = nextCursor;
      pages += 1;
      if (candles.length < 1000) break;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!sawCandles && endTime - startTime > 2 * plan.stepMs) {
    throw new Error('history kline empty');
  }
  return { high, low, interval: plan.interval, complete: cursor >= endTime || (sawCandles && pages < 3) };
}

const markPrices = new Map();
let markPriceUpdatedAt = null;
let markPriceLastAttempt = 0;
let markPriceError = null;
let markPriceBusy = false;

async function refreshMarkPrices(force = false) {
  if (markPriceBusy) return false;
  if (!force && markPriceLastAttempt && Date.now() - markPriceLastAttempt < MARK_PRICE_REFRESH_MS) {
    return true;
  }

  markPriceBusy = true;
  markPriceLastAttempt = Date.now();

  try {
    const r = await fetch(MARK_PRICE_URL, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 PositionAlert/6.5',
      },
    });

    if (!r.ok) throw new Error(`mark-price HTTP ${r.status}`);

    const json = await r.json();
    const rows = Array.isArray(json) ? json : [json];
    let parsed = 0;

    for (const row of rows) {
      const symbol = String(row?.symbol || '').toUpperCase();
      const px = Number(row?.markPrice ?? row?.price);
      if (!symbol || !Number.isFinite(px) || px <= 0) continue;
      markPrices.set(symbol, px);
      parsed += 1;
    }

    if (!parsed) throw new Error('mark-price empty');

    markPriceUpdatedAt = new Date().toISOString();
    markPriceError = null;
    return true;
  } catch (e) {
    markPriceError = String(e?.message || e);
    console.warn(`[mark-price-v6.5] ${markPriceError}`);
    return false;
  } finally {
    markPriceBusy = false;
  }
}

function positionPnlView(p) {
  const entryPrice = Number(p?.entryPrice);
  const amount = Math.abs(Number(p?.amount));
  const cachedMark = Number(markPrices.get(String(p?.symbol || '').toUpperCase()));
  const snapshotMark = Number(p?.markPrice);
  const markPrice = Number.isFinite(cachedMark) && cachedMark > 0
    ? cachedMark
    : Number.isFinite(snapshotMark) && snapshotMark > 0
      ? snapshotMark
      : null;

  if (
    !Number.isFinite(entryPrice) || entryPrice <= 0 ||
    !Number.isFinite(amount) || amount <= 0 ||
    !Number.isFinite(markPrice) || markPrice <= 0
  ) {
    return {
      markPrice: markPrice || null,
      pnlPct: null,
      unrealizedPnl: null,
      pnlSource: null,
      pnlEstimated: p?.source === 'orders',
    };
  }

  const move = p?.side === 'SHORT'
    ? entryPrice - markPrice
    : markPrice - entryPrice;

  return {
    markPrice,
    // Price-return percentage, intentionally NOT leveraged ROI.
    pnlPct: (move / entryPrice) * 100,
    unrealizedPnl: move * amount,
    pnlSource: Number.isFinite(cachedMark) && cachedMark > 0 ? 'mark_price' : 'position_snapshot',
    // Order-reconstructed quantity can be approximate if history starts mid-position.
    pnlEstimated: p?.source === 'orders',
  };
}


function pctNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  if (!Number.isFinite(x)) return null;
  // Binance leaderboard fields are already percentage points. For example,
  // 0.72 means 0.72%, not 72%; multiplying sub-1 values creates false screens.
  return x;
}
function findLeaderboardProfile(json, trader) {
  const arrays = collectArrays(json).map(x => x.rows).filter(Array.isArray);
  const rows = arrays.flat().filter(x => x && typeof x === 'object');
  return rows.find(x => String(x.leadPortfolioId ?? x.portfolioId ?? '') === trader.id)
    || rows.find(x => String(x.nickname ?? x.nickName ?? '').trim() === trader.name)
    || null;
}
async function fetchScreenRange(trader, timeRange) {
  const r = await copyFetch(LEADERBOARD_URL, {
    method: 'POST', headers: commonHeaders(trader.id),
    body: JSON.stringify({
      pageNumber: 1, pageSize: 18, timeRange, dataType: 'ROI',
      favoriteOnly: false, hideFull: false, nickname: trader.screenName || trader.name,
      order: 'DESC', apiKeyOnly: false,
    }),
  }, { priority: 6, label: `screen:${trader.id}:${timeRange}` });
  const text = await r.text();
  if (!r.ok) throw new Error(`screen ${timeRange} HTTP ${r.status}: ${text.slice(0,120)}`);
  let json; try { json = JSON.parse(text); } catch { throw new Error(`screen ${timeRange} non-JSON`); }
  if (json?.success === false) throw new Error(json?.message || `screen ${timeRange} success=false`);
  const row = findLeaderboardProfile(json, trader);
  if (!row) throw new Error(`screen ${timeRange} profile not found`);
  return {
    roi: pctNumber(row.roi ?? row.roiRate ?? row.returnRate ?? row.return),
    pnl: Number.isFinite(Number(row.pnl)) ? Number(row.pnl) : null,
    mdd: pctNumber(row.mdd ?? row.maxDrawdown ?? row.maxDrawDown),
    winRate: pctNumber(row.winRate ?? row.winningRate),
    copierPnl: Number.isFinite(Number(row.copierPnl)) ? Number(row.copierPnl) : null,
    followers: Number.isFinite(Number(row.currentCopyCount)) ? Number(row.currentCopyCount) : null,
    aum: Number.isFinite(Number(row.aum)) ? Number(row.aum) : null,
    startTime: Number.isFinite(Number(row.startTime)) ? Number(row.startTime) : null,
    sharpRatio: Number.isFinite(Number(row.sharpRatio)) ? Number(row.sharpRatio) : null,
    apiKeyOnly: row.apiKeyOnly ?? row.isApiKey ?? true,
  };
}
function strictQualification(s) {
  if (s.trader.core) return { qualified: true, status: 'CORE', reasons: ['核心固定監控'] };
  const screen = s.screening || {};
  const st = displayStatsFor(s) || {};
  const ref = s.referenceStats || {};
  const reasons = [];
  const roi7 = Number(screen.roi7d), roi30 = Number(screen.roi30d);
  if (!(roi7 >= 5)) reasons.push('7D ROI<5%');
  if (!(roi30 >= 20)) reasons.push('30D ROI<20%');
  if (!(Number(screen.pnl30d) > 0)) reasons.push('30D實際損益未正');
  if (!(Number(screen.copierPnl30d) > 0)) reasons.push('30D跟單者未正獲利');
  if (!(Number(screen.aum30d) >= 100000)) reasons.push('AUM<10萬U');
  if (!(Number(screen.followers30d) >= 30)) reasons.push('跟隨者<30');
  if (!(Number(screen.ageDays) >= 60)) reasons.push('帶單歷史<60天');
  const recentWinRate = Number(screen.winRate30d);
  if (!(recentWinRate >= 35 && recentWinRate <= 95)) reasons.push('30D勝率結構異常');
  if (s.historyStatus !== 'OK') reasons.push('訂單API不可讀');
  const activePositions = Number(s.positions?.size || 0);
  if (activePositions > 8) reasons.push('同時持倉>8，訊號過度分散');

  const sample = Math.max(Number(st.sample || 0), Number(ref.sample || 0));
  if (!(sample >= 100)) reasons.push('樣本<100');
  const pf = Number(ref.profitFactor ?? st.profitFactor);
  if (!(pf >= 2)) reasons.push('PF<2/未知');
  const hold = Number(ref.medianDurationMin ?? st.avgDurationMin);
  if (!(hold >= 60 && hold <= 24 * 60)) reasons.push('持倉不在1–24h');
  const mdd = Number.isFinite(Number(screen.mdd30d)) ? Number(screen.mdd30d) : Number(ref.reportedMdd);
  if (!(Number.isFinite(mdd) && mdd <= 35)) reasons.push('MDD>35%/未知');
  const maxLev = Number(ref.maxLeverage);
  if (!(Number.isFinite(maxLev) && maxLev <= 30)) reasons.push('槓桿>30x/未知');
  const concentration = Number(ref.profitConcentration);
  if (!(Number.isFinite(concentration) && concentration <= 25)) reasons.push('盈利集中>25%/未知');
  return { qualified: reasons.length === 0, status: reasons.length ? 'WATCH' : 'QUALIFIED', reasons };
}

const persistedState = loadJson(STATE_FILE, {});
const persistedSeen = loadJson(SEEN_FILE, {});
const persistedStats = loadJson(STATS_FILE, {});
const persistedReference = loadJson(REFERENCE_FILE, {});
const persistedScreen = loadJson(SCREEN_FILE, {});
const states = new Map();

for (const trader of TRADERS) {
  const persistedPositions = Array.isArray(persistedState[trader.id]) ? persistedState[trader.id] : [];
  const persistedSeenKeys = Array.isArray(persistedSeen[trader.id]) ? persistedSeen[trader.id] : [];

  states.set(trader.id, {
    trader,
    positions: new Map(persistedPositions.map(p => [positionKey(p.symbol, p.side), p])),
    seen: new Set(persistedSeenKeys),
    baselineReady: persistedSeenKeys.length > 0,
    officialBaselineReady: false,
    emptyOfficialStreak: 0,
    missingOfficialCounts: new Map(),
    lastOrderChangeAt: 0,
    lastFetch: null,
    lastError: null,
    historyStatus: 'WAITING',
    historyError: null,
    orderRawCount: 0,
    orderParseCount: 0,
    orderPath: null,
    positionStatus: 'WAITING',
    positionError: null,
    positionRawCount: 0,
    positionParseCount: 0,
    positionPath: null,
    lastPositionRefresh: 0,
    lastDeepStatsRefresh: 0,
    lastStatsAttempt: 0,
    statsUpdatedAt: persistedStats[trader.id]?.statsUpdatedAt || null,
    statsOrderCount: Number(persistedStats[trader.id]?.statsOrderCount || 0),
    statsSource: persistedStats[trader.id]?.statsSource || null,
    statsError: persistedStats[trader.id]?.statsError || null,
    referenceStats: mergeReference(
      seedReference(trader),
      persistedReference[trader.id]?.referenceStats || null
    ),
    referenceUpdatedAt: persistedReference[trader.id]?.referenceUpdatedAt || null,
    referenceError: persistedReference[trader.id]?.referenceError || null,
    lastReferenceAttempt: 0,
    lastOrderPollAt: 0,
    screening: persistedScreen[trader.id]?.screening || { roi7d:null, roi30d:null, mdd30d:null, updatedAt:null, status:'WAITING', error:null },
    lastScreenAttempt: 0,
    latestOrders: [],
    recentStats: persistedStats[trader.id]?.recentStats || {
      sample: 0, wins: 0, winRate: null, avgProfit: null,
      avgRoi: null, medianRoi: null, profitFactor: null,
      confidence: 'LOW', confidenceScore: 15, orderCount: 0
    },
  });
}

let recentEvents = loadJson(EVENT_FILE, [])
  .filter(e => e?.kind === 'CONSENSUS'
    ? Array.isArray(e.traderIds) && e.traderIds.some(id => TRADER_IDS.has(id))
    : TRADER_IDS.has(e?.traderId))
  // V5.9 could infer CLOSE from an empty public position snapshot. Lead traders may
  // hide positions, so those legacy snapshot-CLOSE events are not trustworthy.
  .filter(e => !(e?.source === 'official_snapshot' && e?.type === 'CLOSE'))
  .slice(0, 80);
saveJson(EVENT_FILE, recentEvents);
let consensusSent = loadJson(CONSENSUS_FILE, {}); // legacy, kept for migration compatibility
let consensusEpisodes = loadJson(CONSENSUS_EPISODE_FILE, {});
const storedPullbackTrackers = loadJson(PULLBACK_FILE, {});
const pullbackTrackers = new Map(
  Object.entries(storedPullbackTrackers)
    .filter(([, x]) => x?.traderId === CORE_TRADER_ID && x?.symbol && ['LONG', 'SHORT'].includes(x?.side))
    .map(([key, x]) => [key, {
      ...x,
      key,
      hydrationStatus: 'PENDING',
      hydrateFrom: x.lastObservedAt || x.openTime,
    }])
);
const pullbackSetupBusy = new Set();
let pullbackLastPersistAt = 0;
let timer = null;

function persistPullbackTrackers(force = false) {
  const now = Date.now();
  if (!force && now - pullbackLastPersistAt < 12000) return;
  pullbackLastPersistAt = now;
  saveJson(PULLBACK_FILE, Object.fromEntries(pullbackTrackers));
}

function latestExactOpenEvent(symbol, side, positionOpenTime = null) {
  const positionMs = positionOpenTime ? new Date(positionOpenTime).getTime() : null;
  return recentEvents.find(e => {
    const eventMs = new Date(e?.ts).getTime();
    const sameCycle = Number.isFinite(positionMs)
      ? Number.isFinite(eventMs) && Math.abs(eventMs - positionMs) <= 2 * 60 * 1000
      : false;
    return (
    e?.kind === 'TRADER' &&
    e?.traderId === CORE_TRADER_ID &&
    e?.type === 'OPEN' &&
    e?.source === 'order_history' &&
    e?.symbol === symbol &&
    e?.side === side &&
    Number(e?.tradePrice || e?.entryPrice) > 0 &&
    sameCycle
    );
  }) || null;
}

function createPullbackTracker(openEvent, live = false) {
  const entryPrice = Number(openEvent?.tradePrice || openEvent?.entryPrice);
  const openMs = new Date(openEvent?.ts).getTime();
  if (!(entryPrice > 0) || !Number.isFinite(openMs)) return null;
  const symbol = String(openEvent.symbol || '').toUpperCase();
  const side = String(openEvent.side || '').toUpperCase();
  if (!symbol || !['LONG', 'SHORT'].includes(side)) return null;
  const now = new Date().toISOString();
  const observed = Number(markPrices.get(symbol));
  const livePrice = Number.isFinite(observed) && observed > 0 ? observed : entryPrice;
  const extremePrice = side === 'SHORT'
    ? Math.min(entryPrice, livePrice)
    : Math.max(entryPrice, livePrice);
  return {
    key: pullbackKey(CORE_TRADER_ID, symbol, side),
    traderId: CORE_TRADER_ID,
    traderName: TRADER_BY_ID.get(CORE_TRADER_ID)?.name || '熬鷹資本',
    symbol,
    side,
    direction: sideZh(side),
    entryPrice,
    openTime: new Date(openMs).toISOString(),
    anchorEventId: openEvent.id,
    anchorSource: 'order_history_open',
    anchorExact: true,
    extremePrice,
    lastPrice: livePrice,
    lastObservedAt: now,
    lastRetracementRatio: 0,
    atr: null,
    support: null,
    resistance: null,
    invalidPrice: null,
    referenceStatus: 'PENDING',
    referenceError: null,
    hydrationStatus: live ? 'READY' : 'PENDING',
    hydrationError: null,
    hydrateFrom: new Date(openMs).toISOString(),
    normalSentAt: null,
    deepSentAt: null,
    invalidSentAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function syncCorePullbackTrackers() {
  const s = states.get(CORE_TRADER_ID);
  if (!s) return;
  const active = new Set([...s.positions.values()].map(p => pullbackKey(CORE_TRADER_ID, p.symbol, p.side)));
  let changed = false;

  for (const key of [...pullbackTrackers.keys()]) {
    if (!active.has(key)) {
      pullbackTrackers.delete(key);
      changed = true;
    }
  }

  if (s.historyStatus === 'OK') {
    for (const p of s.positions.values()) {
      const key = pullbackKey(CORE_TRADER_ID, p.symbol, p.side);
      const openEvent = latestExactOpenEvent(p.symbol, p.side, p.openTime);
      if (!openEvent) continue;
      const existing = pullbackTrackers.get(key);
      if (existing?.anchorEventId === openEvent.id) continue;
      const tracker = createPullbackTracker(openEvent, Date.now() - new Date(openEvent.ts).getTime() < 2 * MARK_PRICE_REFRESH_MS);
      if (!tracker) continue;
      pullbackTrackers.set(key, tracker);
      changed = true;
    }
  }

  if (changed) persistPullbackTrackers(true);
}

async function preparePullbackTracker(key) {
  if (pullbackSetupBusy.has(key)) return;
  const original = pullbackTrackers.get(key);
  if (!original) return;
  const retryAt = Number(original.setupRetryAt || 0);
  if (retryAt > Date.now()) return;
  if (original.referenceStatus === 'READY' && original.hydrationStatus === 'READY') return;

  pullbackSetupBusy.add(key);
  try {
    let patch = {};

    if (original.referenceStatus !== 'READY') {
      try {
        const candles = await fetchEntryReferenceCandles(original.symbol, original.openTime);
        const levels = buildReferenceLevels(candles, original.side, Number(original.entryPrice));
        patch = {
          ...patch,
          atr: levels.atr,
          support: levels.support,
          resistance: levels.resistance,
          invalidPrice: levels.sl?.suggested || null,
          referenceStatus: 'READY',
          referenceError: null,
          referenceCapturedAt: new Date().toISOString(),
        };
      } catch (e) {
        patch = {
          ...patch,
          referenceStatus: 'ERROR',
          referenceError: String(e?.message || e),
          setupRetryAt: Date.now() + 60_000,
        };
      }
    }

    if (original.hydrationStatus !== 'READY') {
      try {
        const startMs = new Date(original.hydrateFrom || original.openTime).getTime();
        const endMs = Date.now();
        const ext = Number.isFinite(startMs) && endMs - startMs > 60_000
          ? await fetchHistoricalExtremes(original.symbol, startMs, endMs)
          : { high: null, low: null, interval: 'live', complete: true };
        const prior = Number(original.extremePrice) > 0 ? Number(original.extremePrice) : Number(original.entryPrice);
        const extremePrice = original.side === 'SHORT'
          ? Math.min(prior, Number(ext.low) > 0 ? Number(ext.low) : prior)
          : Math.max(prior, Number(ext.high) > 0 ? Number(ext.high) : prior);
        patch = {
          ...patch,
          extremePrice,
          hydrationStatus: ext.complete ? 'READY' : 'ERROR',
          hydrationError: ext.complete ? null : 'history range incomplete',
          hydrationInterval: ext.interval,
          hydratedAt: new Date().toISOString(),
          ...(ext.complete ? {} : { setupRetryAt: Date.now() + 60_000 }),
        };
      } catch (e) {
        patch = {
          ...patch,
          hydrationStatus: 'ERROR',
          hydrationError: String(e?.message || e),
          setupRetryAt: Date.now() + 60_000,
        };
      }
    }

    const current = pullbackTrackers.get(key);
    if (current?.anchorEventId === original.anchorEventId) {
      pullbackTrackers.set(key, { ...current, ...patch, updatedAt: new Date().toISOString() });
      persistPullbackTrackers(true);
    }
  } finally {
    pullbackSetupBusy.delete(key);
  }
}

function pullbackViewForPosition(s, p) {
  if (s?.trader?.id !== CORE_TRADER_ID) return null;
  const key = pullbackKey(CORE_TRADER_ID, p.symbol, p.side);
  const tracker = pullbackTrackers.get(key);
  if (!tracker) {
    return {
      status: s.historyStatus === 'OK' ? 'WAIT_EXACT_OPEN' : 'PAUSED_API',
      label: s.historyStatus === 'OK' ? '等待下一次精確建倉' : '訂單 API 暫停',
      exactAnchor: false,
    };
  }
  const price = Number(markPrices.get(String(p.symbol || '').toUpperCase())) || Number(tracker.lastPrice);
  const snapshot = price > 0 ? pullbackSnapshot(tracker, price) : null;
  const paused = s.historyStatus !== 'OK';
  return {
    ...(snapshot || {}),
    status: paused ? 'PAUSED_API' : (snapshot?.status || 'SYNCING'),
    label: paused ? '訂單 API 暫停' : null,
    exactAnchor: tracker.anchorExact === true,
    firstEntryPrice: tracker.entryPrice,
    firstOpenTime: tracker.openTime,
    referenceStatus: tracker.referenceStatus,
    hydrationStatus: tracker.hydrationStatus,
  };
}

function makePullbackEvent(tracker, eventType, snapshot, reason) {
  const retracementPct = Number(snapshot?.retracementPct);
  const structural = eventType === 'INVALIDATION' && reason === 'STRUCTURE';
  const label = eventType === 'PULLBACK'
    ? '一般回踩'
    : eventType === 'DEEP_PULLBACK'
      ? '深度回踩'
      : structural ? '結構失效' : '回踩過深';
  return {
    id: `${Date.now()}-${tracker.key}-${eventType}`,
    ts: new Date().toISOString(),
    kind: 'PULLBACK',
    source: 'binance_mark_price',
    traderId: tracker.traderId,
    traderName: tracker.traderName,
    type: eventType,
    label,
    symbol: tracker.symbol,
    side: tracker.side,
    direction: tracker.direction,
    entryPrice: tracker.entryPrice,
    openTime: tracker.openTime,
    tradePrice: snapshot?.marketPrice || null,
    retracementPct: Number.isFinite(retracementPct) ? retracementPct : null,
    extremePrice: snapshot?.extremePrice || null,
    normalZone: snapshot?.normal || null,
    deepZone: snapshot?.deep || null,
    invalidPrice: snapshot?.structuralInvalidPrice || snapshot?.fibInvalidPrice || null,
    reason,
  };
}

async function evaluateCorePullbacks() {
  syncCorePullbackTrackers();
  const s = states.get(CORE_TRADER_ID);
  if (!s) return;

  for (const [key, tracker] of pullbackTrackers) {
    if (tracker.referenceStatus !== 'READY' || tracker.hydrationStatus !== 'READY') {
      void preparePullbackTracker(key);
      continue;
    }
    if (s.historyStatus !== 'OK') continue;
    if (!s.positions.has(positionKey(tracker.symbol, tracker.side))) continue;
    const marketPrice = Number(markPrices.get(tracker.symbol));
    if (!(marketPrice > 0)) continue;

    const result = pullbackTransition(tracker, marketPrice);
    if (!result.snapshot) continue;
    pullbackTrackers.set(key, result.tracker);
    persistPullbackTrackers(Boolean(result.eventType));
    if (result.eventType) {
      await emitEvent(makePullbackEvent(result.tracker, result.eventType, result.snapshot, result.reason));
    }
  }
}

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

function persistStats() {
  const out = {};

  for (const [id, s] of states) {
    if (!s.statsUpdatedAt) continue;

    out[id] = {
      statsUpdatedAt: s.statsUpdatedAt,
      statsOrderCount: s.statsOrderCount,
      statsSource: s.statsSource,
      statsError: s.statsError,
      recentStats: s.recentStats,
    };
  }

  saveJson(STATS_FILE, out);
}

function persistReference() {
  const out = {};

  for (const [id, s] of states) {
    out[id] = {
      referenceStats: s.referenceStats,
      referenceUpdatedAt: s.referenceUpdatedAt,
      referenceError: s.referenceError,
    };
  }

  saveJson(REFERENCE_FILE, out);
}

function persistScreen() {
  const out = {};
  for (const [id, s] of states) out[id] = { screening: s.screening };
  saveJson(SCREEN_FILE, out);
}


function applyQuickStats(s, orders) {
  // Fast fallback using the already successful live 100-order page.
  // It gives the UI useful reference data within one poll without extra Binance calls.
  if (!Array.isArray(orders) || !orders.length) return;

  const quick = calculateRecentStats(orders);

  // Do not downgrade a valid deep result every 3 seconds.
  const hasDeep = String(s.statsSource || '').startsWith('deep_');
  if (hasDeep && s.statsUpdatedAt) return;

  // Even when there are 0 completed cycles, "100 orders examined" is still
  // better and more truthful than showing "0 orders / preparing forever".
  s.recentStats = quick;
  s.statsOrderCount = orders.length;
  s.statsUpdatedAt = new Date().toISOString();
  s.statsSource = `quick_${orders.length}`;
  s.statsError = null;
  persistStats();
}

function getVapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  }

  const saved = loadJson(VAPID_FILE, null);
  if (saved?.publicKey && saved?.privateKey) return saved;

  const generated = webpush.generateVAPIDKeys();
  saveJson(VAPID_FILE, generated);
  return generated;
}

const vapid = getVapidKeys();

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:position-alert@example.com',
  vapid.publicKey,
  vapid.privateKey
);

function cleanTraderIds(value, fallbackAll = true) {
  if (!Array.isArray(value)) return fallbackAll ? TRADERS.map(t => t.id) : [];
  return value.filter(id => TRADER_IDS.has(id));
}

function cleanEventTypes(value, fallbackAll = true) {
  if (!Array.isArray(value)) return fallbackAll ? [...EVENT_TYPES] : [];
  return value.filter(type => EVENT_TYPE_SET.has(type));
}
function cleanBriefInterval(value) {
  const n = Number(value);
  return [2,3,6,12].includes(n) ? n : 3;
}

function migratedEventTypes(record) {
  const types = cleanEventTypes(record?.enabledTypes, true);
  if (Number(record?.preferenceVersion || 0) >= 65) return types;
  return [...new Set([...types, ...PULLBACK_EVENT_TYPES])];
}

function normalizeSubRecord(x) {
  if (x?.subscription?.endpoint) {
    return {
      endpoint: x.subscription.endpoint,
      subscription: x.subscription,
      enabledTraders: cleanTraderIds(x.enabledTraders, true),
      enabledTypes: migratedEventTypes(x),
      consensusEnabled: x.consensusEnabled !== false,
      dailyBriefEnabled: x.dailyBriefEnabled === true,
      dailyBriefIntervalHours: cleanBriefInterval(x.dailyBriefIntervalHours),
      lastDailyBriefPushAt: x.lastDailyBriefPushAt || null,
      preferenceVersion: 72,
    };
  }

  if (x?.endpoint) {
    return {
      endpoint: x.endpoint,
      subscription: x,
      enabledTraders: TRADERS.map(t => t.id),
      enabledTypes: [...EVENT_TYPES],
      consensusEnabled: true,
      dailyBriefEnabled: false,
      dailyBriefIntervalHours: 3,
      lastDailyBriefPushAt: null,
      preferenceVersion: 72,
    };
  }

  return null;
}

function loadSubRecords() {
  return loadJson(SUB_FILE, []).map(normalizeSubRecord).filter(Boolean);
}
function saveSubRecords(records) {
  saveJson(SUB_FILE, records);
}

function subscriptionAllows(rec, target = {}) {
  const enabledTraders = new Set(rec?.enabledTraders || []);
  const enabledTypes = new Set(rec?.enabledTypes || EVENT_TYPES);
  const isConsensus = target.eventType === 'CONSENSUS';

  // Core-aligned confirmation is independent from individual trader toggles.
  // The user can keep only core alerts while still receiving one confirmation when
  // at least one qualified secondary trader matches the same symbol and direction.
  if (isConsensus) return rec?.consensusEnabled !== false;

  const traderAllowed = target.traderId
    ? enabledTraders.has(target.traderId)
    : Array.isArray(target.traderIds)
      ? target.traderIds.some(id => enabledTraders.has(id))
      : true;
  const typeAllowed = target.eventType
    ? enabledTypes.has(target.eventType)
    : true;
  return traderAllowed && typeAllowed;
}

async function sendPush(payload, target = {}) {
  const records = loadSubRecords();
  const keep = [];

  for (const rec of records) {
    if (!subscriptionAllows(rec, target)) {
      keep.push(rec);
      continue;
    }

    try {
      await webpush.sendNotification(
        rec.subscription,
        JSON.stringify(payload),
        { TTL: 90, urgency: 'high' }
      );
      keep.push(rec);
    } catch (e) {
      if (![404, 410].includes(e.statusCode)) keep.push(rec);
    }
  }

  if (keep.length !== records.length) saveSubRecords(keep);
}

function makeTraderEvent(type, trader, o, result) {
  const direction = sideZh(o.positionSide);
  const previous = result?.previous || null;
  let realizedPnl = null;
  let realizedPricePct = null;
  let realizedQty = null;

  if ((type === 'REDUCE' || type === 'CLOSE') && previous?.entryPrice > 0 && previous?.amount > 0) {
    realizedQty = Math.min(Math.abs(Number(o.qty || 0)), Math.abs(Number(previous.amount || 0)));
    if (realizedQty > 0) {
      realizedPnl = o.positionSide === 'LONG'
        ? (o.price - previous.entryPrice) * realizedQty
        : (previous.entryPrice - o.price) * realizedQty;
      const base = previous.entryPrice * realizedQty;
      realizedPricePct = base > 0 ? (realizedPnl / base) * 100 : null;
    }
  }

  return {
    id: `${Date.now()}-${trader.id}-${o.key}`,
    ts: new Date(o.time).toISOString(),
    kind: 'TRADER',
    source: 'order_history',
    traderId: trader.id,
    traderName: trader.name,
    type,
    symbol: o.symbol,
    side: o.positionSide,
    direction,
    entryPrice: result?.current?.entryPrice || previous?.entryPrice || o.price,
    tradePrice: o.price,
    realizedPnl,
    realizedPricePct,
    realizedQty,
    // Order-reconstructed PnL excludes fees/funding and can be approximate at a history boundary.
    realizedPnlEstimated: Boolean(previous?.source === 'orders'),
  };
}

function eventAction(event) {
  if (event.type === 'OPEN') return event.direction;
  if (event.type === 'ADD') return '加碼';
  if (event.type === 'REDUCE') return '減碼';
  if (event.type === 'CLOSE') return '平倉';
  if (event.type === 'PULLBACK') return '一般回踩';
  if (event.type === 'DEEP_PULLBACK') return '深度回踩';
  if (event.type === 'INVALIDATION') return event.reason === 'STRUCTURE' ? '結構失效' : '回踩過深';
  if (event.type === 'CONSENSUS') return `${event.direction}共識`;
  return event.type;
}

function tradingViewLaunchUrl(symbol) {
  const clean = cleanFuturesSymbol(symbol);
  return clean ? `/?tv=${encodeURIComponent(clean)}` : '/';
}

function eventPushText(event) {
  if (event.kind === 'CONSENSUS') {
    return {
      title: `熬鷹同向確認｜${event.direction}`,
      body: `${event.symbol}｜${event.traderNames.join('、')}`,
    };
  }

  if (event.kind === 'PULLBACK') {
    const ratio = Number(event.retracementPct);
    const ratioText = Number.isFinite(ratio) ? `｜回撤 ${ratio.toFixed(1)}%` : '';
    return {
      title: `${event.traderName}｜${eventAction(event)}`,
      body: `${event.symbol} ${event.direction}｜${fmtPrice(event.tradePrice)}${ratioText}｜點開TV確認`,
    };
  }

  const bodyValue = event.priceLabel
    ? event.priceLabel
    : fmtPrice(event.tradePrice || event.entryPrice);

  return {
    title: `${event.traderName}｜${eventAction(event)}`,
    body: `${event.symbol}｜${bodyValue}`,
  };
}

async function emitEvent(event) {
  recentEvents.unshift(event);
  recentEvents = recentEvents.slice(0, 80);
  saveJson(EVENT_FILE, recentEvents);

  const text = eventPushText(event);
  console.log(`[ALERT] ${text.title} | ${text.body}`);

  await sendPush({
    title: text.title,
    body: text.body,
    tag: `${event.kind}-${event.symbol || 'market'}-${event.type}-${Date.now()}`,
    renotify: true,
    data: { url: event.kind === 'PULLBACK' ? tradingViewLaunchUrl(event.symbol) : '/' },
  }, event.kind === 'TRADER' || event.kind === 'PULLBACK'
    ? { traderId: event.traderId, eventType: event.type }
    : { traderIds: event.traderIds, eventType: 'CONSENSUS' }
  );
}

function quantityChanged(a, b) {
  const x = Math.abs(Number(a || 0));
  const y = Math.abs(Number(b || 0));
  const base = Math.max(x, y, 1e-12);
  return Math.abs(x - y) / base > 0.001;
}

function makeSnapshotEvent(type, s, current, previous = null) {
  const p = current || previous || {};
  const hasReliablePrice = type === 'OPEN' || type === 'ADD';

  return {
    id: `${Date.now()}-${s.trader.id}-snapshot-${type}-${p.symbol || 'NA'}-${p.side || 'NA'}`,
    ts: new Date().toISOString(),
    kind: 'TRADER',
    source: 'official_snapshot',
    traderId: s.trader.id,
    traderName: s.trader.name,
    type,
    symbol: p.symbol,
    side: p.side,
    direction: sideZh(p.side),
    entryPrice: current?.entryPrice || previous?.entryPrice || null,
    tradePrice: hasReliablePrice ? (current?.entryPrice || null) : null,
    priceLabel: hasReliablePrice ? null : '官方倉位變化',
  };
}

async function syncOfficialSnapshot(s, result, { emitChanges = true } = {}) {
  s.positionRawCount = Number(result?.rawCount || 0);
  s.positionParseCount = Number(result?.parsedCount || 0);
  s.positionPath = result?.path || null;
  s.positionError = result?.error || null;

  if (!result?.ok) {
    s.positionStatus = 'ERROR';
    return false;
  }

  // If Binance returned rows but none matched our position schema, this is a parser
  // warning, never evidence that the trader is flat.
  if (result.rawCount > 0 && result.positions.length === 0) {
    s.positionStatus = 'PARSE_ERROR';
    return false;
  }

  const official = result.positions || [];

  // IMPORTANT V5.9.1 SAFETY RULE:
  // The public copy-trading position endpoint may legitimately return an empty/partial
  // list when a lead trader hides positions. Therefore absence from this endpoint is
  // NEVER allowed to clear a position or emit CLOSE. Only explicit order-history
  // reductions/closures are authoritative for trade events.
  if (!s.officialBaselineReady) s.officialBaselineReady = true;

  if (!official.length) {
    s.emptyOfficialStreak += 1;
    s.positionStatus = 'HIDDEN_OR_EMPTY';
    s.missingOfficialCounts.clear();
    return true;
  }

  s.emptyOfficialStreak = 0;

  // Official positive rows are useful as a health/visibility signal, but they are not
  // allowed to mutate the canonical order-derived position state. This prevents a
  // delayed snapshot from double-applying an ADD/REDUCE when the order record arrives.
  const officialKeys = new Set(
    official.map(p => positionKey(p.symbol, p.side))
  );

  let missingKnown = 0;
  for (const key of s.positions.keys()) {
    if (!officialKeys.has(key)) missingKnown += 1;
  }

  s.positionStatus = missingKnown > 0 ? 'PARTIAL_OR_HIDDEN' : 'OK';
  s.missingOfficialCounts.clear();

  // emitChanges is intentionally ignored for official snapshots in V5.9.1.
  // Trade notifications are emitted only by processNewOrders().
  return true;
}

function consensusEligibleState(s) {
  const q = strictQualification(s);
  if (!q.qualified) return false;
  if (s.historyStatus !== 'OK') return false;
  if (!s.lastFetch) return false;
  const age = Date.now() - new Date(s.lastFetch).getTime();
  return Number.isFinite(age) && age < 5 * 60 * 1000;
}
function currentConsensus(symbol, side) {
  const core = states.get(CORE_TRADER_ID);
  if (!core || !consensusEligibleState(core)) return [];
  if (!core.positions.has(positionKey(symbol, side))) return [];

  const ids = [CORE_TRADER_ID];
  for (const [id, s] of states) {
    if (id === CORE_TRADER_ID) continue;
    if (!consensusEligibleState(s)) continue;
    if (s.positions.has(positionKey(symbol, side))) ids.push(id);
  }
  return ids;
}
function consensusEpisodeTransition(input, count, now = Date.now()) {
  const ep = { active:false, belowSince:0, lastSentAt:0, lastCount:0, ...(input || {}) };
  let shouldNotify = false;
  if (count < 2) {
    if (ep.active && !ep.belowSince) ep.belowSince = now;
    ep.lastCount = count;
    return { episode: ep, shouldNotify };
  }
  const rearmed = ep.active && ep.belowSince && now - ep.belowSince >= CONSENSUS_REARM_MS;
  if (rearmed) ep.active = false;
  ep.belowSince = 0;
  ep.lastCount = count;
  if (!ep.active) {
    ep.active = true;
    ep.lastSentAt = now;
    shouldNotify = true;
  }
  return { episode: ep, shouldNotify };
}
async function maybeEmitConsensus(symbol, side) {
  const ids = currentConsensus(symbol, side);
  const key = `${symbol}|${side}`;
  const now = Date.now();
  const transitioned = consensusEpisodeTransition(consensusEpisodes[key], ids.length, now);
  consensusEpisodes[key] = transitioned.episode;
  saveJson(CONSENSUS_EPISODE_FILE, consensusEpisodes);
  if (!transitioned.shouldNotify) return; // 2 -> 3 -> 4 remains one alert.

  const names = ids.map(id => TRADER_BY_ID.get(id)?.name || id);
  const meta = buildConsensusRows().find(x => x.symbol === symbol && x.side === side);
  await emitEvent({
    id: `${Date.now()}-consensus-${key}`,
    ts: new Date().toISOString(), kind: 'CONSENSUS', type: 'CONSENSUS',
    symbol, side, direction: sideZh(side), traderIds: ids, traderNames: names,
    consensusScore: meta?.score ?? null, consensusLevel: meta?.level ?? null,
  });
}


async function establishBaseline(s, orders) {
  s.positions = reconstruct(orders);
  s.seen = new Set(orders.map(o => o.key));
  s.baselineReady = true;
  persistStates();

  console.log(
    `[baseline-v6.5] ${s.trader.name}: ${s.positions.size} reconstructed positions / ${orders.length} orders`
  );
}

async function processNewOrders(s, orders) {
  const fresh = orders
    .filter(o => !s.seen.has(o.key))
    .sort((a, b) => a.time - b.time);

  for (const o of fresh) {
    const result = applyOrder(s.positions, o);
    s.seen.add(o.key);

    if (!result) continue;

    s.lastOrderChangeAt = Date.now();

    await emitEvent(makeTraderEvent(result.type, s.trader, o, result));
    await maybeEmitConsensus(o.symbol, o.positionSide);
  }

  persistStates();
}

async function pollTrader(s) {
  let orderSuccess = false;
  let positionSuccess = false;
  const errors = [];
  const now = Date.now();
  const orderEvery = s.trader.core ? CORE_ORDER_POLL_MS : SECONDARY_ORDER_POLL_MS;
  const orderDue = !s.lastOrderPollAt || now - s.lastOrderPollAt >= orderEvery;
  const positionDue = !s.lastPositionRefresh || now - s.lastPositionRefresh >= POSITION_REFRESH_MS;
  if (!orderDue && !positionDue) return;

  if (orderDue) {
    s.lastOrderPollAt = Date.now();
    try {
      const detail = await fetchOrders(s.trader.id);
      const orders = detail.orders;
      s.latestOrders = orders; s.orderRawCount = detail.rawCount; s.orderParseCount = detail.parsedCount; s.orderPath = detail.path; s.historyError = null;
      if (detail.rawCount > 0 && detail.parsedCount === 0) s.historyStatus = 'PARSE_ERROR';
      else if (orders.length > 0) s.historyStatus = 'OK';
      else s.historyStatus = 'NO_HISTORY';
      if (!s.baselineReady) await establishBaseline(s, orders);
      else { recoverPositionsFromRecent(s, orders); await processNewOrders(s, orders); }
      if (!s.statsUpdatedAt || !s.statsOrderCount) applyQuickStats(s, orders);
      orderSuccess = true;
    } catch (e) {
      s.historyStatus = 'ERROR'; s.historyError = String(e?.message || e); errors.push(`orders: ${s.historyError}`);
      console.error(`[poll-orders-v6.5] ${s.trader.name}: ${s.historyError}`);
    }
  } else orderSuccess = s.historyStatus === 'OK';

  if (positionDue) {
    s.lastPositionRefresh = Date.now();
    const result = await fetchOfficialPositions(s.trader.id);
    if (result.ok) { await syncOfficialSnapshot(s, result, { emitChanges: true }); positionSuccess = true; }
    else { s.positionStatus='ERROR'; s.positionError=result.error||'positions unavailable'; errors.push(`positions: ${s.positionError}`); }
  } else positionSuccess = s.positionStatus !== 'ERROR';

  if (orderSuccess || positionSuccess) { s.lastFetch = new Date().toISOString(); s.lastError = null; }
  else s.lastError = errors.join(' | ') || 'ALL_SOURCES_FAILED';
}


async function loop() {
  await refreshMarkPrices();
  await Promise.allSettled([...states.values()].map(s => pollTrader(s)));
  await evaluateCorePullbacks();
  timer = setTimeout(loop, POLL_MS);
}

let statsTimer = null;
let statsCursor = 0;
let statsRunning = false;

async function runNextDeepStats() {
  if (statsRunning) return;

  const list = [...states.values()];
  if (!list.length) return;

  const s = list[statsCursor % list.length];
  statsCursor = (statsCursor + 1) % list.length;

  const due = !s.lastDeepStatsRefresh ||
    Date.now() - s.lastDeepStatsRefresh >= STATS_REFRESH_MS;

  if (!due) return;

  // Back off attempts for the same trader even when Binance rejects a page.
  if (s.lastStatsAttempt && Date.now() - s.lastStatsAttempt < 30000) return;

  statsRunning = true;
  s.lastStatsAttempt = Date.now();

  try {
    const firstPage = Array.isArray(s.latestOrders) ? s.latestOrders : [];
    const rows = await fetchStatsOrders(s.trader.id, firstPage);

    if (!rows.length) {
      s.statsError = 'EMPTY_ORDER_HISTORY';
      s.lastDeepStatsRefresh = Date.now();
      return;
    }

    const result = calculateRecentStats(rows);

    s.recentStats = result;
    s.statsOrderCount = rows.length;
    s.statsUpdatedAt = new Date().toISOString();
    s.statsSource = `deep_${rows.length}`;
    s.statsError = null;
    s.lastDeepStatsRefresh = Date.now();
    persistStats();

    console.log(
      `[stats-v6.5] ${s.trader.name}: ${rows.length} orders / ${result.sample || 0} completed trades`
    );
  } catch (e) {
    // Preserve the last valid quick/deep stats. Never blank the card on an error.
    s.statsError = String(e?.message || e);
    console.error(`[stats-v6.5] ${s.trader.name}: ${s.statsError}`);
  } finally {
    statsRunning = false;
  }
}

function statsLoop() {
  void runNextDeepStats();
  statsTimer = setTimeout(statsLoop, 20000);
}

let referenceTimer = null;
let referenceCursor = 0;
let referenceRunning = false;

async function runNextReferenceRefresh() {
  if (referenceRunning) return;

  const list = [...states.values()];
  if (!list.length) return;

  const s = list[referenceCursor % list.length];
  referenceCursor = (referenceCursor + 1) % list.length;

  const lastGood = s.referenceUpdatedAt
    ? new Date(s.referenceUpdatedAt).getTime()
    : 0;

  if (lastGood && Date.now() - lastGood < REFERENCE_REFRESH_MS) return;
  if (s.lastReferenceAttempt && Date.now() - s.lastReferenceAttempt < 5 * 60 * 1000) return;

  referenceRunning = true;
  s.lastReferenceAttempt = Date.now();

  try {
    const remote = await fetchReferenceStats(s.trader);
    s.referenceStats = mergeReference(s.referenceStats, {
      ...remote,
      sourceType: 'REMOTE',
    });
    s.referenceUpdatedAt = remote.fetchedAt || new Date().toISOString();
    s.referenceError = null;
    persistReference();

    console.log(
      `[reference-v6.5] ${s.trader.name}: quality=${s.referenceStats.qualityScore ?? '-'} sample=${s.referenceStats.sample ?? '-'}`
    );
  } catch (e) {
    s.referenceError = String(e?.message || e);
    console.warn(`[reference-v6.5] ${s.trader.name}: ${s.referenceError}`);
  } finally {
    referenceRunning = false;
  }
}

function referenceLoop() {
  void runNextReferenceRefresh();
  referenceTimer = setTimeout(referenceLoop, 15000);
}




let screenTimer = null;
let screenCursor = 0;
let screenRunning = false;
async function runNextScreen() {
  if (screenRunning) return;
  const list = [...states.values()].filter(s => !s.trader.core);
  if (!list.length) return;
  const s = list[screenCursor % list.length];
  screenCursor = (screenCursor + 1) % list.length;
  const updated = s.screening?.updatedAt ? new Date(s.screening.updatedAt).getTime() : 0;
  if (updated && Date.now() - updated < SCREEN_REFRESH_MS) return;
  if (s.lastScreenAttempt && Date.now() - s.lastScreenAttempt < 5 * 60 * 1000) return;
  screenRunning = true; s.lastScreenAttempt = Date.now();
  try {
    const seven = await fetchScreenRange(s.trader, '7D');
    const thirty = await fetchScreenRange(s.trader, '30D');
    const ageDays = Number.isFinite(Number(thirty.startTime))
      ? Math.max(0, (Date.now() - Number(thirty.startTime)) / 86400000)
      : null;
    s.screening = {
      roi7d: seven.roi, roi30d: thirty.roi,
      pnl7d: seven.pnl, pnl30d: thirty.pnl,
      mdd30d: Number.isFinite(Number(thirty.mdd)) ? Number(thirty.mdd) : null,
      winRate30d: Number.isFinite(Number(thirty.winRate)) ? Number(thirty.winRate) : null,
      copierPnl7d: seven.copierPnl, copierPnl30d: thirty.copierPnl,
      followers30d: thirty.followers, aum30d: thirty.aum,
      startTime: thirty.startTime, ageDays,
      sharpRatio30d: thirty.sharpRatio,
      apiKeyOnly: seven.apiKeyOnly !== false && thirty.apiKeyOnly !== false,
      updatedAt: new Date().toISOString(), status: 'OK', error: null,
    };
    persistScreen();
  } catch (e) {
    s.screening = { ...(s.screening||{}), status:'ERROR', error:String(e?.message||e), updatedAt:s.screening?.updatedAt||null };
    persistScreen();
    console.warn(`[screen-v6.5] ${s.trader.name}: ${s.screening.error}`);
  } finally { screenRunning = false; }
}
function screenLoop() {
  void runNextScreen();
  screenTimer = setTimeout(screenLoop, 45000);
}

function latestTraderEvent(traderId) {
  return recentEvents.find(e => e?.kind === 'TRADER' && e?.traderId === traderId) || null;
}

function traderActivity(s) {
  const e = latestTraderEvent(s.trader.id);
  const ageMs = e?.ts ? Math.max(0, Date.now() - new Date(e.ts).getTime()) : null;

  if (ageMs != null && ageMs <= 10 * 60 * 1000) {
    if (e.type === 'OPEN') return { code: 'JUST_OPENED', label: '剛建倉', ts: e.ts };
    if (e.type === 'ADD') return { code: 'ADDING', label: '正在加碼', ts: e.ts };
    if (e.type === 'REDUCE') return { code: 'REDUCING', label: '正在減碼', ts: e.ts };
    if (e.type === 'CLOSE') return { code: 'JUST_CLOSED', label: '剛平倉', ts: e.ts };
  }

  if (s.positions.size > 0) return { code: 'HOLDING', label: '持倉中', ts: e?.ts || null };
  if (['HIDDEN_OR_EMPTY', 'PARTIAL_OR_HIDDEN'].includes(s.positionStatus)) {
    return { code: 'UNKNOWN', label: '倉位隱藏', ts: e?.ts || null };
  }
  if (ageMs != null && ageMs >= 12 * 60 * 60 * 1000) return { code: 'QUIET', label: '低活躍', ts: e.ts };
  return { code: 'FLAT', label: '空倉', ts: e?.ts || null };
}

function signalValue(s) {
  const positions = s.positions.size;
  const st = displayStatsFor(s);
  const sample = Number(st.sample || 0);
  const pf = st.profitFactor == null ? null : Number(st.profitFactor);
  const medianRoi = st.medianRoi == null ? null : Number(st.medianRoi);
  const winRate = st.winRate == null ? null : Number(st.winRate);
  const quality = st.qualityScore == null ? null : Number(st.qualityScore);

  if (positions <= 0) {
    const hiddenOrUnknown = ['HIDDEN_OR_EMPTY', 'PARTIAL_OR_HIDDEN'].includes(s.positionStatus);
    return {
      score: null,
      level: 'WAIT',
      label: hiddenOrUnknown ? '未知' : '空倉',
      reason: hiddenOrUnknown
        ? '倉位隱藏 · 等待訂單確認'
        : (st.available ? `等待建倉 · ${st.sourceLabel}` : '等待建倉'),
    };
  }

  let score = 32;

  if (positions <= 2) score += 36;
  else if (positions <= 4) score += 30;
  else if (positions <= 6) score += 23;
  else if (positions <= 8) score += 15;
  else if (positions <= 12) score += 7;
  else if (positions <= 20) score -= 5;
  else score -= 25;

  if (sample >= 100) score += 10;
  else if (sample >= 20) score += 8;
  else if (sample >= 8) score += 6;
  else if (sample >= 3) score += 3;

  if (Number.isFinite(pf)) {
    if (pf >= 2.5) score += 8;
    else if (pf >= 1.5) score += 5;
    else if (pf < 1) score -= 7;
  }

  if (Number.isFinite(medianRoi)) {
    if (medianRoi > 0.5) score += 7;
    else if (medianRoi > 0) score += 4;
    else if (medianRoi < 0) score -= 5;
  }

  if (Number.isFinite(winRate)) {
    if (winRate >= 60) score += 5;
    else if (winRate < 40) score -= 4;
  }

  if (Number.isFinite(quality)) {
    if (quality >= 95) score += 6;
    else if (quality >= 85) score += 4;
    else if (quality < 65) score -= 5;
  }

  if (st.confidence === 'HIGH') score += 5;
  else if (st.confidence === 'MEDIUM') score += 2;

  if (positions > 20) score = Math.min(score, 32);
  else if (positions > 12) score = Math.min(score, 55);

  score = Math.max(0, Math.min(100, Math.round(score)));

  const level = score >= 80 ? 'HIGH' : score >= 60 ? 'MEDIUM' : 'LOW';
  const label = score >= 80 ? '高價值' : score >= 60 ? '可參考' : '低訊號';
  const reason = positions <= 4
    ? `集中持倉 ${positions}`
    : positions <= 8
      ? `持倉 ${positions}`
      : `持倉偏多 ${positions}`;

  return { score, level, label, reason };
}

function buildConsensusRows() {
  const buckets = new Map();

  for (const [traderId, s] of states) {
    if (!consensusEligibleState(s)) continue;
    for (const p of s.positions.values()) {
      const key = `${p.symbol}|${p.side}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({
        traderId,
        traderName: s.trader.name,
        entryPrice: Number(p.entryPrice || 0),
        openTime: p.openTime || null,
      });
    }
  }

  const rows = [];

  for (const [key, members] of buckets) {
    if (members.length < 2 || !hasCoreMember(members)) continue;

    const [symbol, side] = key.split('|');
    const prices = members.map(x => x.entryPrice).filter(x => Number.isFinite(x) && x > 0);
    const times = members.map(x => x.openTime ? new Date(x.openTime).getTime() : null).filter(Number.isFinite);

    let entrySpreadPct = null;
    if (prices.length >= 2) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const mid = prices.reduce((a, b) => a + b, 0) / prices.length;
      entrySpreadPct = mid > 0 ? ((max - min) / mid) * 100 : null;
    }

    let timeSpreadMin = null;
    if (times.length >= 2) {
      timeSpreadMin = (Math.max(...times) - Math.min(...times)) / 60000;
    }

    const eligibleTotal = Math.max(2, [...states.values()].filter(consensusEligibleState).length);
    let score = (members.length / eligibleTotal) * 50;
    if (entrySpreadPct == null) score += 8;
    else if (entrySpreadPct <= 0.35) score += 25;
    else if (entrySpreadPct <= 0.8) score += 20;
    else if (entrySpreadPct <= 1.5) score += 12;
    else score += 4;

    if (timeSpreadMin == null) score += 7;
    else if (timeSpreadMin <= 15) score += 25;
    else if (timeSpreadMin <= 60) score += 18;
    else if (timeSpreadMin <= 240) score += 9;
    else score += 3;

    score = Math.max(0, Math.min(100, Math.round(score)));

    const level =
      members.length >= 3 && score >= 70 ? 'HIGH' :
      score >= 50 ? 'MEDIUM' :
      'LOW';

    rows.push({
      symbol, side, direction: sideZh(side),
      count: members.length, total: Math.max(2, [...states.values()].filter(consensusEligibleState).length),
      score, level, entrySpreadPct, timeSpreadMin,
      traderIds: members.map(x => x.traderId),
      traderNames: members.map(x => x.traderName),
    });
  }

  return rows.sort((a, b) => b.score - a.score || b.count - a.count);
}

function hasCoreMember(members) {
  return Array.isArray(members) && members.some(x => x?.traderId === CORE_TRADER_ID);
}

function percentileRank(sortedAsc, value) {
  if (!Array.isArray(sortedAsc) || !sortedAsc.length || !Number.isFinite(value)) return 0;
  let lo = 0, hi = sortedAsc.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedAsc[mid] <= value) lo = mid + 1; else hi = mid;
  }
  return Math.max(0, Math.min(1, lo / sortedAsc.length));
}

function marketRecommendation(row, volumeRank) {
  const ch = Number(row.changePct || 0);
  const fundingPct = Number(row.fundingPct || 0);
  const absCh = Math.abs(ch);
  const liquidity = Math.max(0, Math.min(1, Number(volumeRank || 0)));
  const trend = Math.max(-1, Math.min(1, ch / 6));
  // Funding is used only as a crowding penalty; it never flips direction by itself.
  const fundingPenalty = Math.min(0.35, Math.abs(fundingPct) / 0.08 * 0.18);
  const quality = Math.max(0, Math.min(100,
    48 + absCh * 4.2 + liquidity * 18 - fundingPenalty * 100
  ));
  const direction = trend > 0.10 ? 'LONG' : trend < -0.10 ? 'SHORT' : 'WAIT';
  return {
    direction,
    label: direction === 'LONG' ? '建議做多' : direction === 'SHORT' ? '建議做空' : '等待',
    score: Math.round(quality),
    reason: direction === 'WAIT'
      ? '24h 動能不足'
      : `${ch >= 0 ? '24h上漲' : '24h下跌'} ${Math.abs(ch).toFixed(2)}% · 成交額排名 ${Math.max(1, Math.round((1-liquidity)*100))}%`,
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function buildTodayView(rows, byVolume, recommendations, summary) {
  const scoredAll = [...rows].map(x => {
    const funding = Number(x.fundingPct || 0);
    const change = Number(x.changePct || 0);
    const volumeRank = Number(x.volumeRank || 0.5);
    const volumeFactor = 0.35 + volumeRank * 0.65;

    // V7.0 核心：X 軸 = 資金流向代理、Y 軸 = 漲跌動能。
    // flowScore > 0 代表偏資金流入（圖左），< 0 代表偏資金流出（圖右）。
    // momentumScore > 0 代表價格上漲（圖上），< 0 代表價格下跌（圖下）。
    const flowRaw = (change * 0.8 - funding * 18) * volumeFactor;
    const momentumRaw = change - funding * 4;
    const flowScore = clamp(Number(flowRaw.toFixed(2)), -12, 12);
    const momentumScore = clamp(Number(momentumRaw.toFixed(2)), -12, 12);
    const bubbleSize = clamp(20 + volumeRank * 26 + Math.min(10, Math.abs(change) * 1.2), 18, 56);

    let bias = 'LONG_WATCH';
    let biasLabel = '多頭觀察';
    if (flowScore >= 0 && momentumScore >= 0) {
      bias = 'LONG';
      biasLabel = '做多優先';
    } else if (flowScore >= 0 && momentumScore < 0) {
      bias = 'LONG_WATCH';
      biasLabel = '多頭觀察';
    } else if (flowScore < 0 && momentumScore >= 0) {
      bias = 'SHORT_WATCH';
      biasLabel = '空頭觀察';
    } else {
      bias = 'SHORT';
      biasLabel = '做空優先';
    }

    const biasScore = bias === 'LONG'
      ? flowScore + momentumScore + volumeRank * 4
      : bias === 'LONG_WATCH'
        ? flowScore - Math.abs(momentumScore) * 0.35 + volumeRank * 3
        : bias === 'SHORT_WATCH'
          ? Math.abs(flowScore) + momentumScore * 0.55 + volumeRank * 3
          : Math.abs(flowScore) + Math.abs(momentumScore) + volumeRank * 4;

    return {
      symbol: x.symbol,
      price: x.price,
      changePct: change,
      fundingPct: funding,
      quoteVolume: Number(x.quoteVolume || 0),
      volumeRank,
      flowScore,
      momentumScore,
      bubbleSize: Number(bubbleSize.toFixed(1)),
      quadrant: bias,
      bias,
      biasLabel,
      biasScore: Number(biasScore.toFixed(2)),
      score: Number(x?.recommendation?.score || 0),
    };
  });

  const biasMeta = {
    LONG: { key: 'LONG', label: '做多', sub: '資金流入 + 價格上漲', className: 'long' },
    LONG_WATCH: { key: 'LONG_WATCH', label: '多頭觀察', sub: '資金流入 + 價格下跌', className: 'longWatch' },
    SHORT_WATCH: { key: 'SHORT_WATCH', label: '空頭觀察', sub: '資金流出 + 價格上漲', className: 'shortWatch' },
    SHORT: { key: 'SHORT', label: '做空', sub: '資金流出 + 價格下跌', className: 'short' },
  };

  const biasBuckets = Object.fromEntries(Object.keys(biasMeta).map(k => [k, []]));
  for (const row of scoredAll) biasBuckets[row.bias].push(row);
  for (const k of Object.keys(biasBuckets)) {
    biasBuckets[k].sort((a, b) => b.biasScore - a.biasScore || b.quoteVolume - a.quoteVolume);
  }

  const topLongs = biasBuckets.LONG.slice(0, 3).map(x => ({ symbol: x.symbol, score: x.score, changePct: x.changePct, fundingPct: x.fundingPct, quoteVolume: x.quoteVolume }));
  const topShorts = biasBuckets.SHORT.slice(0, 3).map(x => ({ symbol: x.symbol, score: x.score, changePct: x.changePct, fundingPct: x.fundingPct, quoteVolume: x.quoteVolume }));

  const sentimentScore = clamp(Math.round(50 + Number(summary.weightedChangePct || 0) * 6 + Number(summary.breadth || 0) * 32), 5, 95);
  const sentimentLabel = sentimentScore >= 62 ? '偏多' : sentimentScore <= 38 ? '偏空' : '中性';

  const biases = Object.keys(biasMeta).map(key => ({
    ...biasMeta[key],
    count: biasBuckets[key].length,
    items: biasBuckets[key].slice(0, 12),
  }));

  const candidates = [...byVolume]
    .map(x => scoredAll.find(y => y.symbol === x.symbol) || null)
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.flowScore) + Math.abs(b.momentumScore) - Math.abs(a.flowScore) - Math.abs(a.momentumScore) || b.quoteVolume - a.quoteVolume)
    .slice(0, 10);

  return {
    generatedAt: new Date().toISOString(),
    openTimeUtc: '00:00 UTC',
    openTimeTaiwan: '08:00 台灣',
    sentimentScore,
    sentimentLabel,
    topLongs,
    topShorts,
    biases,
    defaultBias: [...biases].sort((a,b)=>b.count-a.count)[0]?.key || 'LONG',
    bubbleMap: {
      xAxisLeft: '資金流入',
      xAxisRight: '資金流出',
      yAxisTop: '上漲',
      yAxisBottom: '下跌',
      items: candidates,
    },
  };
}

function buildMarketFlow(tickers, premiums) {
  const premiumMap = new Map((Array.isArray(premiums) ? premiums : []).map(x => [String(x?.symbol || ''), x]));
  const rows = (Array.isArray(tickers) ? tickers : [])
    .filter(x => /USDT$/.test(String(x?.symbol || '')) && !String(x?.symbol || '').includes('_'))
    .map(x => {
      const symbol = String(x.symbol || '');
      const p = premiumMap.get(symbol) || {};
      return {
        symbol,
        price: Number(x.lastPrice || p.markPrice || 0),
        changePct: Number(x.priceChangePercent || 0),
        quoteVolume: Number(x.quoteVolume || 0),
        fundingPct: Number(p.lastFundingRate || 0) * 100,
        nextFundingTime: Number(p.nextFundingTime || 0) || null,
      };
    })
    .filter(x => x.price > 0 && x.quoteVolume > 0);

  const volumes = rows.map(x => x.quoteVolume).filter(Number.isFinite).sort((a,b)=>a-b);
  for (const row of rows) {
    row.volumeRank = percentileRank(volumes, row.quoteVolume);
    row.recommendation = marketRecommendation(row, row.volumeRank);
  }
  const byVolume = [...rows].sort((a,b)=>b.quoteVolume-a.quoteVolume).slice(0, 24);
  const advancers = rows.filter(x => x.changePct > 0).length;
  const decliners = rows.filter(x => x.changePct < 0).length;
  const total = Math.max(1, advancers + decliners);
  const breadth = (advancers - decliners) / total;
  const weighted = byVolume.reduce((sum,x)=>sum + x.changePct * Math.sqrt(Math.max(1,x.quoteVolume)),0) /
    Math.max(1, byVolume.reduce((sum,x)=>sum + Math.sqrt(Math.max(1,x.quoteVolume)),0));
  const direction = weighted > 0.35 && breadth > -0.05 ? 'LONG' : weighted < -0.35 && breadth < 0.05 ? 'SHORT' : 'NEUTRAL';
  const label = direction === 'LONG' ? '多方流入' : direction === 'SHORT' ? '空方流入' : '多空拉鋸';
  const confidence = Math.round(Math.max(0, Math.min(100, 50 + Math.abs(weighted)*7 + Math.abs(breadth)*25)));
  const recommendations = byVolume
    .filter(x => x.recommendation.direction !== 'WAIT')
    .sort((a,b)=>b.recommendation.score-a.recommendation.score || b.quoteVolume-a.quoteVolume)
    .slice(0,12);
  const summary = { direction, label, confidence, weightedChangePct:Number(weighted.toFixed(3)), breadth:Number(breadth.toFixed(3)), advancers, decliners };
  const today = buildTodayView(rows, byVolume, recommendations, summary);

  return {
    ok:true,
    source:'Binance Futures public API',
    generatedAt:new Date().toISOString(),
    summary,
    today,
    leaders:byVolume,
    recommendations,
  };
}

async function fetchMarketFlowFresh() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MARKET_FLOW_TIMEOUT_MS);
  try {
    const [tr, pr] = await Promise.all([
      fetch(MARKET_24H_URL, { headers:{accept:'application/json','user-agent':'Mozilla/5.0 PositionAlert/6.6'}, signal:controller.signal }),
      fetch(MARK_PRICE_URL, { headers:{accept:'application/json','user-agent':'Mozilla/5.0 PositionAlert/6.6'}, signal:controller.signal }),
    ]);
    if (!tr.ok) throw new Error(`ticker HTTP ${tr.status}`);
    if (!pr.ok) throw new Error(`premium HTTP ${pr.status}`);
    const [tickers, premiums] = await Promise.all([tr.json(), pr.json()]);
    if (!Array.isArray(tickers) || !Array.isArray(premiums)) throw new Error('market payload invalid');
    return buildMarketFlow(tickers, premiums);
  } finally { clearTimeout(timeout); }
}

async function getMarketFlow() {
  const now = Date.now();
  if (marketFlowCache.data && now - marketFlowCache.at < MARKET_FLOW_CACHE_MS) return { ...marketFlowCache.data, stale:false, cacheAgeMs:now-marketFlowCache.at };
  if (!marketFlowCache.inflight) {
    marketFlowCache.inflight = fetchMarketFlowFresh().then(data => {
      marketFlowCache = { at:Date.now(), lastGoodAt:Date.now(), data, error:null, inflight:null };
      return data;
    }).catch(err => {
      marketFlowCache.error = String(err?.name === 'AbortError' ? 'Binance market timeout' : (err?.message || err));
      marketFlowCache.inflight = null;
      throw err;
    });
  }
  try {
    const data = await marketFlowCache.inflight;
    return { ...data, stale:false, cacheAgeMs:0 };
  } catch (err) {
    if (marketFlowCache.data && now - marketFlowCache.lastGoodAt <= MARKET_FLOW_STALE_MS) {
      return { ...marketFlowCache.data, stale:true, error:marketFlowCache.error, cacheAgeMs:now-marketFlowCache.lastGoodAt };
    }
    throw err;
  }
}

function ideaEmaSeries(values, period) {
  if (!Array.isArray(values) || !values.length) return [];
  const k = 2 / (period + 1);
  const out = [];
  let prev = Number(values[0] || 0);
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    const v = Number(values[i] || 0);
    prev = v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function ideaRsiSeries(values, period = 14) {
  const out = Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    gain += Math.max(0, d);
    loss += Math.max(0, -d);
  }
  let avgGain = gain / period, avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0, d)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -d)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return out;
}

function ideaAtrSeries(candles, period = 14) {
  const tr = candles.map((c, i) => i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close)));
  const out = Array(candles.length).fill(null);
  if (tr.length < period) return out;
  let sum = 0;
  for (let i = 0; i < tr.length; i++) {
    sum += tr[i];
    if (i >= period) sum -= tr[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function ideaMacdSeries(values) {
  const fast = ideaEmaSeries(values, 12), slow = ideaEmaSeries(values, 26);
  const line = values.map((_, i) => fast[i] - slow[i]);
  const signal = ideaEmaSeries(line, 9);
  return { line, signal, hist: line.map((x, i) => x - signal[i]) };
}

function latestFinite(arr) {
  for (let i = arr.length - 1; i >= 0; i--) if (Number.isFinite(Number(arr[i]))) return Number(arr[i]);
  return null;
}

async function ideaFetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers:{accept:'application/json','user-agent':'Mozilla/5.0 PositionAlert/7.2'}, signal:controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timeout); }
}

async function fetchIdeaCandles(symbol, interval, limit = 240) {
  const json = await ideaFetchJson(`${KLINE_URL}?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`);
  const candles = Array.isArray(json) ? json.map(parseKlineRow).filter(Boolean) : [];
  if (candles.length < 80) throw new Error(`${symbol} ${interval} candles too short`);
  return candles;
}

function ratioLast(rows, key = 'longShortRatio') {
  if (!Array.isArray(rows) || !rows.length) return null;
  const x = Number(rows[rows.length - 1]?.[key]);
  return Number.isFinite(x) ? x : null;
}

function ratioChangePct(rows, key) {
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const a = Number(rows[0]?.[key]), b = Number(rows[rows.length - 1]?.[key]);
  if (!(a > 0) || !Number.isFinite(b)) return null;
  return (b / a - 1) * 100;
}

function technicalSnapshot(candles) {
  const closes = candles.map(x => x.close), vols = candles.map(x => Number(x.volume || 0));
  const ema20s = ideaEmaSeries(closes, 20), ema50s = ideaEmaSeries(closes, 50), rsi = ideaRsiSeries(closes, 14), macd = ideaMacdSeries(closes), atr = ideaAtrSeries(candles, 14);
  const i = closes.length - 1, close = closes[i], ema20 = ema20s[i], ema50 = ema50s[i], rsi14 = latestFinite(rsi), macdHist = latestFinite(macd.hist), atr14 = latestFinite(atr);
  const recentVol = vols.slice(-5).reduce((a,b)=>a+b,0) / Math.max(1, vols.slice(-5).length);
  const baseVol = vols.slice(-25,-5).reduce((a,b)=>a+b,0) / Math.max(1, vols.slice(-25,-5).length);
  const volumeRatio = baseVol > 0 ? recentVol / baseVol : 1;
  const prior = candles.slice(-21,-1), high20 = Math.max(...prior.map(x=>x.high)), low20 = Math.min(...prior.map(x=>x.low));
  const breakout = close > high20 ? 1 : close < low20 ? -1 : 0;
  const trend = close > ema20 && ema20 > ema50 ? 1 : close < ema20 && ema20 < ema50 ? -1 : 0;
  const momentum = (rsi14 ?? 50) >= 56 && (macdHist ?? 0) > 0 ? 1 : (rsi14 ?? 50) <= 44 && (macdHist ?? 0) < 0 ? -1 : 0;
  const vp=candles.slice(-96), minP=Math.min(...vp.map(x=>x.low)), maxP=Math.max(...vp.map(x=>x.high)), bins=24, span=Math.max(1e-12,maxP-minP), bucket=Array(bins).fill(0);
  for(const c of vp){const typical=(c.high+c.low+c.close)/3, idx=Math.max(0,Math.min(bins-1,Math.floor((typical-minP)/span*bins)));bucket[idx]+=Number(c.volume||0)}
  let pocIdx=0;for(let j=1;j<bucket.length;j++)if(bucket[j]>bucket[pocIdx])pocIdx=j;
  const poc=minP+(pocIdx+0.5)/bins*span, pocSignal=close>poc*1.001?1:close<poc*0.999?-1:0;
  return { close, ema20, ema50, rsi14, macdHist, atr14, volumeRatio, breakout, trend, momentum, poc, pocSignal };
}

function backtestIdea(candles) {
  const closes = candles.map(x=>x.close), ema20 = ideaEmaSeries(closes,20), ema50 = ideaEmaSeries(closes,50), rsi = ideaRsiSeries(closes,14), macd = ideaMacdSeries(closes), atr = ideaAtrSeries(candles,14);
  let wins=0, losses=0, skipped=0;
  for (let i = 60; i < candles.length - 7; i++) {
    const a = atr[i]; if (!(a > 0) || !Number.isFinite(rsi[i])) { skipped++; continue; }
    let s=0;
    s += closes[i] > ema20[i] && ema20[i] > ema50[i] ? 1 : closes[i] < ema20[i] && ema20[i] < ema50[i] ? -1 : 0;
    s += rsi[i] >= 56 ? 1 : rsi[i] <= 44 ? -1 : 0;
    s += macd.hist[i] > 0 ? 1 : macd.hist[i] < 0 ? -1 : 0;
    if (Math.abs(s) < 2) { skipped++; continue; }
    const dir = s > 0 ? 1 : -1, entry = closes[i], target = entry + dir * a * 1.15, stop = entry - dir * a * 0.85;
    let result = 0;
    for (let j=i+1;j<=i+6;j++) {
      const c=candles[j];
      if (dir > 0) {
        if (c.low <= stop) { result=-1; break; }
        if (c.high >= target) { result=1; break; }
      } else {
        if (c.high >= stop) { result=-1; break; }
        if (c.low <= target) { result=1; break; }
      }
    }
    if (!result) result = dir * (closes[i+6] - entry) > 0 ? 1 : -1;
    result > 0 ? wins++ : losses++;
  }
  const sample=wins+losses, hitRate=sample ? wins/sample*100 : null;
  return { hitRate:Number.isFinite(hitRate)?Number(hitRate.toFixed(1)):null, sample, wins, losses, skipped };
}

function ideaScoreParts(row, t15, t1h, deriv) {
  const signals=[]; let signed=0, quality=0;
  const add=(name,value,weight,detail)=>{signed += value*weight; quality += Math.abs(value)*weight; signals.push({name,value,weight,detail});};
  add('1H趨勢', t1h.trend, 20, `EMA20/50`);
  add('15m趨勢', t15.trend, 12, `EMA20/50`);
  add('1H動能', t1h.momentum, 14, `RSI ${Number(t1h.rsi14||0).toFixed(0)}`);
  add('15m動能', t15.momentum, 9, `RSI ${Number(t15.rsi14||0).toFixed(0)}`);
  add('結構突破', t1h.breakout, 10, t1h.breakout>0?'上破20根':t1h.breakout<0?'下破20根':'區間內');
  add('量價POC', t1h.pocSignal, 7, `${Number(t1h.poc||0).toPrecision(5)}`);
  const oiCh=Number(deriv.oiChangePct||0), taker=Number(deriv.takerRatio||1), top=Number(deriv.topRatio||1), global=Number(deriv.globalRatio||1);
  const oiDir = oiCh > 1.2 ? Math.sign(row.changePct||0) : oiCh < -1.2 ? -Math.sign(row.changePct||0) : 0;
  add('OI', oiDir, 9, `${oiCh>0?'+':''}${oiCh.toFixed(1)}%`);
  add('主動買賣', taker>1.04?1:taker<0.96?-1:0, 10, `${taker.toFixed(2)}`);
  add('大戶部位', top>1.08?1:top<0.92?-1:0, 8, `${top.toFixed(2)}`);
  add('全市場多空', global>1.08?1:global<0.92?-1:0, 5, `${global.toFixed(2)}`);
  const funding=Number(row.fundingPct||0);
  const crowd = Math.abs(funding)>=0.08 ? (funding>0?-1:1) : 0;
  add('資金費擁擠', crowd, 6, `${funding>0?'+':''}${funding.toFixed(4)}%`);
  const volumeSignal=t15.volumeRatio>=1.35 ? Math.sign(row.changePct||0) : 0;
  add('量能', volumeSignal, 7, `${t15.volumeRatio.toFixed(2)}x`);
  const direction = signed >= 12 ? 'LONG' : signed <= -12 ? 'SHORT' : 'WAIT';
  const directionalStrength = Math.min(100, Math.round(50 + Math.abs(signed)*0.65));
  const coverage = Math.min(100, Math.round(quality));
  return { direction, signed:Number(signed.toFixed(1)), modelScore:Math.round(directionalStrength*0.8+coverage*0.2), signals };
}

async function analyzeIdeaSymbol(row) {
  const symbol=row.symbol;
  const urls={
    oi:`${FUTURES_DATA}/openInterestHist?symbol=${encodeURIComponent(symbol)}&period=15m&limit=30`,
    global:`${FUTURES_DATA}/globalLongShortAccountRatio?symbol=${encodeURIComponent(symbol)}&period=15m&limit=30`,
    top:`${FUTURES_DATA}/topLongShortPositionRatio?symbol=${encodeURIComponent(symbol)}&period=15m&limit=30`,
    taker:`${FUTURES_DATA}/takerlongshortRatio?symbol=${encodeURIComponent(symbol)}&period=15m&limit=30`,
  };
  const [c15,c1h,oi,global,top,taker] = await Promise.all([
    fetchIdeaCandles(symbol,'15m',240), fetchIdeaCandles(symbol,'1h',240),
    ideaFetchJson(urls.oi).catch(()=>[]), ideaFetchJson(urls.global).catch(()=>[]), ideaFetchJson(urls.top).catch(()=>[]), ideaFetchJson(urls.taker).catch(()=>[]),
  ]);
  const t15=technicalSnapshot(c15), t1h=technicalSnapshot(c1h);
  const deriv={
    oiChangePct:ratioChangePct(oi,'sumOpenInterestValue') ?? ratioChangePct(oi,'sumOpenInterest'),
    globalRatio:ratioLast(global), topRatio:ratioLast(top), takerRatio:ratioLast(taker,'buySellRatio'),
  };
  const model=ideaScoreParts(row,t15,t1h,deriv), bt=backtestIdea(c1h);
  const hist=Number.isFinite(bt.hitRate)?bt.hitRate:50;
  const sampleWeight=Math.min(1, bt.sample/45);
  const estimate=clamp(50 + (model.modelScore-50)*0.42 + (hist-50)*0.48*sampleWeight, 48, 82);
  const rankScore=clamp(model.modelScore*0.62 + hist*0.38,0,100);
  const reason=model.signals.filter(x=>x.value!==0).sort((a,b)=>b.weight-a.weight).slice(0,4).map(x=>`${x.name}${x.value>0?'↑':'↓'}`).join(' · ') || '訊號分歧';
  return {
    symbol, price:row.price, changePct:row.changePct, quoteVolume:row.quoteVolume, fundingPct:row.fundingPct,
    direction:model.direction, label:model.direction==='LONG'?'做多':model.direction==='SHORT'?'做空':'等待',
    modelScore:model.modelScore, rankScore:Number(rankScore.toFixed(1)), estimatedWinRate:Number(estimate.toFixed(1)),
    historicalHitRate:bt.hitRate, backtestSample:bt.sample, reason,
    metrics:{ rsi15:Number(t15.rsi14?.toFixed(1)), rsi1h:Number(t1h.rsi14?.toFixed(1)), volumeRatio:Number(t15.volumeRatio.toFixed(2)), oiChangePct:Number((deriv.oiChangePct||0).toFixed(2)), globalRatio:deriv.globalRatio, topRatio:deriv.topRatio, takerRatio:deriv.takerRatio },
  };
}

async function mapPool(items, concurrency, fn) {
  const out=Array(items.length); let cursor=0;
  const worker=async()=>{ while(true){ const i=cursor++; if(i>=items.length) return; try{out[i]=await fn(items[i],i)}catch(e){out[i]={error:String(e?.message||e),symbol:items[i]?.symbol}} } };
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},()=>worker()));
  return out;
}

async function fetchRankedIdeasFresh() {
  const flow=await getMarketFlow();
  const candidates=(flow.leaders||[]).slice(0,IDEA_SYMBOLS);
  const analyzed=await mapPool(candidates,IDEA_CONCURRENCY,analyzeIdeaSymbol);
  const rows=analyzed.filter(x=>x && !x.error && x.direction!=='WAIT').sort((a,b)=>b.rankScore-a.rankScore || b.estimatedWinRate-a.estimatedWinRate || b.quoteVolume-a.quoteVolume);
  return { ok:true, generatedAt:new Date().toISOString(), methodology:'15m+1h EMA/RSI/MACD/ATR/volume + OI + taker + top/global L/S + funding + rolling 1h condition backtest', analyzed:candidates.length, rows:rows.slice(0,12), errors:analyzed.filter(x=>x?.error).length };
}

async function getRankedIdeas() {
  const now=Date.now();
  if(rankedIdeasCache.data && now-rankedIdeasCache.at<IDEA_CACHE_MS)return {...rankedIdeasCache.data,stale:false,cacheAgeMs:now-rankedIdeasCache.at};
  if(!rankedIdeasCache.inflight){
    rankedIdeasCache.inflight=fetchRankedIdeasFresh().then(data=>{rankedIdeasCache={at:Date.now(),lastGoodAt:Date.now(),data,error:null,inflight:null};return data}).catch(e=>{rankedIdeasCache.error=String(e?.message||e);rankedIdeasCache.inflight=null;throw e});
  }
  try{return {...await rankedIdeasCache.inflight,stale:false,cacheAgeMs:0}}catch(e){if(rankedIdeasCache.data&&now-rankedIdeasCache.lastGoodAt<IDEA_STALE_MS)return {...rankedIdeasCache.data,stale:true,error:rankedIdeasCache.error,cacheAgeMs:now-rankedIdeasCache.lastGoodAt};throw e}
}

function fallbackDailyBrief(flow, ideas) {
  const sm=flow.summary||{}, top=(ideas?.rows||[]).slice(0,3);
  const bias=sm.direction==='LONG'?'偏多':sm.direction==='SHORT'?'偏空':'中性';
  return { ok:true, mode:'MARKET_ONLY', generatedAt:new Date().toISOString(), bias, score:Number(sm.confidence||50), title:`市場${bias}｜AI網搜未啟用`, bullets:[`成交額加權 ${Number(sm.weightedChangePct||0).toFixed(2)}%`,`上漲 ${sm.advancers||0} / 下跌 ${sm.decliners||0}`,top.length?`排名：${top.map(x=>`${x.symbol} ${x.label}`).join('、')}`:'暫無高一致性排名'], action:sm.direction==='LONG'?'多單等回踩，空單只打弱勢標的':sm.direction==='SHORT'?'空單等反彈，多單只打強勢標的':'只做排名最前面的強弱分化', sources:[], aiReady:false };
}

function extractOpenAIText(json) {
  if(typeof json?.output_text==='string')return json.output_text;
  for(const item of json?.output||[])for(const c of item?.content||[])if(c?.type==='output_text'&&typeof c.text==='string')return c.text;
  return '';
}

async function fetchAIDailyBrief(flow, ideas) {
  if(!process.env.OPENAI_API_KEY)return fallbackDailyBrief(flow,ideas);
  const marketPayload={summary:flow.summary,leaders:(flow.leaders||[]).slice(0,8).map(x=>({symbol:x.symbol,changePct:x.changePct,fundingPct:x.fundingPct,quoteVolume:x.quoteVolume})),ranked:(ideas?.rows||[]).slice(0,8).map(x=>({symbol:x.symbol,direction:x.direction,estimatedWinRate:x.estimatedWinRate,rankScore:x.rankScore,reason:x.reason}))};
  const prompt=`你是加密貨幣日內市場研究助手。現在是台灣時間。請先使用網路搜尋，整理「當下」全球總經、Fed/利率/美元/美債、美股風險偏好、ETF/監管、BTC/ETH與重大加密新聞，再結合我提供的 Binance 即時摘要與量化排名。不要寫長文，只輸出嚴格 JSON，不要 markdown。JSON schema: {"bias":"偏多|偏空|中性","score":0-100,"title":"<=26個中文字","bullets":["最多6條，每條<=38中文字"],"action":"<=45中文字","sources":[{"title":"短標題","url":"https://..."}]}. 不要保證獲利，不要把模型估算勝率當成真實機率。市場資料=${JSON.stringify(marketPayload)}`;
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:OPENAI_MODEL,tools:[{type:'web_search_preview',search_context_size:'medium',user_location:{type:'approximate',country:'TW',timezone:'Asia/Taipei'}}],input:prompt,max_output_tokens:1200})});
  if(!r.ok)throw new Error(`OpenAI ${r.status}`);
  const json=await r.json(), text=extractOpenAIText(json).trim();
  const cleaned=text.replace(/^```json\s*/i,'').replace(/```$/,'').trim();
  const parsed=JSON.parse(cleaned);
  return {ok:true,mode:'AI_WEB',generatedAt:new Date().toISOString(),bias:String(parsed.bias||'中性'),score:clamp(Number(parsed.score||50),0,100),title:String(parsed.title||'今日市場整理').slice(0,80),bullets:Array.isArray(parsed.bullets)?parsed.bullets.slice(0,6).map(x=>String(x).slice(0,100)):[],action:String(parsed.action||'').slice(0,120),sources:Array.isArray(parsed.sources)?parsed.sources.slice(0,5).map(x=>({title:String(x?.title||'來源').slice(0,80),url:String(x?.url||'')})).filter(x=>/^https?:\/\//.test(x.url)):[],aiReady:true};
}

async function getDailyBrief(force=false,maxAgeMs=DAILY_BRIEF_DEFAULT_MS) {
  const now=Date.now(), ageLimit=Math.max(DAILY_BRIEF_MIN_MS,Number(maxAgeMs||DAILY_BRIEF_DEFAULT_MS));
  if(!force&&dailyBriefCache.data&&now-dailyBriefCache.at<ageLimit)return dailyBriefCache.data;
  if(!dailyBriefCache.inflight){
    dailyBriefCache.inflight=(async()=>{const [flow,ideas]=await Promise.all([getMarketFlow(),getRankedIdeas().catch(()=>null)]);try{return await fetchAIDailyBrief(flow,ideas)}catch(e){const fb=fallbackDailyBrief(flow,ideas);return {...fb,error:String(e?.message||e)}}})().then(data=>{dailyBriefCache={at:Date.now(),data,error:null,inflight:null};return data}).catch(e=>{dailyBriefCache.error=String(e?.message||e);dailyBriefCache.inflight=null;throw e});
  }
  return dailyBriefCache.inflight;
}


async function dailyBriefLoop() {
  try {
    const records=loadSubRecords(), enabled=records.filter(x=>x.dailyBriefEnabled===true);
    if(enabled.length){
      const minHours=Math.min(...enabled.map(x=>cleanBriefInterval(x.dailyBriefIntervalHours)));
      const force=!dailyBriefCache.data || Date.now()-dailyBriefCache.at >= minHours*60*60*1000;
      const brief=await getDailyBrief(force);
      const now=Date.now(), keep=[];
      for(const rec of records){
        if(rec.dailyBriefEnabled!==true){keep.push(rec);continue}
        const intervalMs=cleanBriefInterval(rec.dailyBriefIntervalHours)*60*60*1000;
        const last=rec.lastDailyBriefPushAt?new Date(rec.lastDailyBriefPushAt).getTime():0;
        if(last && now-last<intervalMs){keep.push(rec);continue}
        try{
          await webpush.sendNotification(rec.subscription,JSON.stringify({
            title:`市場整理｜${brief.bias||'中性'} ${Math.round(Number(brief.score||50))}`,
            body:`${brief.title||'今日市場整理'}${brief.action?`｜${brief.action}`:''}`.slice(0,180),
            tag:`daily-brief-${Math.floor(now/intervalMs)}`,
            renotify:false,
            data:{url:'/'},
          }),{TTL:300,urgency:'normal'});
          rec.lastDailyBriefPushAt=new Date(now).toISOString();
          keep.push(rec);
        }catch(e){if(![404,410].includes(e.statusCode))keep.push(rec)}
      }
      saveSubRecords(keep);
    }
  }catch(e){console.warn(`[daily-brief] ${String(e?.message||e)}`)}
  dailyBriefTimer=setTimeout(dailyBriefLoop,10*60*1000);
}

app.get('/api/market-flow', async (_req, res) => {
  try {
    const data = await getMarketFlow();
    res.json(data);
  } catch (err) {
    res.status(503).json({ ok:false, error:String(err?.message || err), stale:false });
  }
});


app.get('/api/ranked-ideas', async (_req, res) => {
  try {
    const data = await getRankedIdeas();
    res.json(data);
  } catch (err) {
    res.status(503).json({ ok:false, error:String(err?.message || err), stale:false });
  }
});

app.get('/api/daily-brief', async (req, res) => {
  try {
    const force = String(req.query?.force || '') === '1';
    const hours = cleanBriefInterval(req.query?.hours);
    const data = await getDailyBrief(force, hours * 60 * 60 * 1000);
    res.json({...data, refreshHours:hours});
  } catch (err) {
    res.status(503).json({ ok:false, error:String(err?.message || err) });
  }
});

app.get('/api/config', (_req, res) => {
  res.json({
    mode: 'V7_2_AI_RANKING',
    pollMs: POLL_MS,
    coreOrderPollMs: CORE_ORDER_POLL_MS,
    secondaryOrderPollMs: SECONDARY_ORDER_POLL_MS,
    positionRefreshMs: POSITION_REFRESH_MS,
    copyBapiBudgetPerMin: COPY_BAPI_BUDGET_PER_MIN,
    statsRefreshMs: STATS_REFRESH_MS,
    statsMaxPages: STATS_MAX_PAGES,
    vapidPublicKey: vapid.publicKey,
    dailyBrief: { aiReady: Boolean(process.env.OPENAI_API_KEY), model: process.env.OPENAI_API_KEY ? OPENAI_MODEL : null, intervals:[2,3,6,12], defaultHours:3 },
    rankedIdeas: { symbols: IDEA_SYMBOLS, cacheMs: IDEA_CACHE_MS },
    pushReady: true,
    traders: TRADERS,
    eventTypes: EVENT_TYPES,
    pullback: {
      coreTraderId: CORE_TRADER_ID,
      normalRatio: PULLBACK_NORMAL_RATIO,
      deepRatio: PULLBACK_DEEP_RATIO,
      fibInvalidRatio: PULLBACK_FIB_INVALID_RATIO,
      activationMinPct: PULLBACK_ACTIVATION_MIN_PCT,
      activationAtrMultiplier: PULLBACK_ACTIVATION_ATR_MULT,
      activationMaxPct: PULLBACK_ACTIVATION_MAX_PCT,
      exactOpenRequired: true,
    },
  });
});

app.get('/api/status', (_req, res) => {
  const traderRows = TRADERS.map(t => {
    const s = states.get(t.id);
    const lastAction = latestTraderEvent(t.id);

    return {
      ...t,
      baselineReady: s.baselineReady,
      lastFetch: s.lastFetch,
      lastError: s.lastError,
      statsUpdatedAt: s.statsUpdatedAt,
      statsOrderCount: s.statsOrderCount,
      statsSource: s.statsSource,
      statsError: s.statsError,
      recentStats: s.recentStats,
      referenceStats: s.referenceStats,
      referenceUpdatedAt: s.referenceUpdatedAt,
      referenceError: s.referenceError,
      displayStats: displayStatsFor(s),
      screening: s.screening,
      qualification: strictQualification(s),
      historyStatus: s.historyStatus,
      historyError: s.historyError,
      orderRawCount: s.orderRawCount,
      orderParseCount: s.orderParseCount,
      positionStatus: s.positionStatus,
      positionError: s.positionError,
      positionRawCount: s.positionRawCount,
      positionParseCount: s.positionParseCount,
      activity: traderActivity(s),
      signalValue: signalValue(s),
      lastAction: lastAction ? {
        ts: lastAction.ts,
        type: lastAction.type,
        symbol: lastAction.symbol,
        side: lastAction.side,
        direction: lastAction.direction,
        tradePrice: lastAction.tradePrice,
      } : null,
      positions: newestPositions(s.positions.values()).map(p => {
        const pv = positionPnlView(p);
        return {
          symbol: p.symbol,
          side: p.side,
          direction: sideZh(p.side),
          entryPrice: p.entryPrice,
          openTime: p.openTime || null,
          markPrice: pv.markPrice,
          pnlPct: pv.pnlPct,
          unrealizedPnl: pv.unrealizedPnl,
          pnlSource: pv.pnlSource,
          pnlEstimated: pv.pnlEstimated,
          pullback: pullbackViewForPosition(s, p),
        };
      }),
    };
  });

  res.json({
    serverNow: new Date().toISOString(),
    traders: traderRows,
    consensus: buildConsensusRows(),
    events: recentEvents.slice(0, 40),
    market: {
      updatedAt: markPriceUpdatedAt,
      error: markPriceError,
      symbols: markPrices.size,
      refreshMs: MARK_PRICE_REFRESH_MS,
    },
    healthy: traderRows.filter(t => Boolean(t.lastFetch)).length,
    total: traderRows.length,
    qualified: traderRows.filter(t => t.qualification?.qualified).length,
    copyRate: copyRateSnapshot(),
  });
});


app.get('/api/reference-levels', async (req, res) => {
  const symbol = cleanFuturesSymbol(req.query?.symbol);
  const side = String(req.query?.side || '').toUpperCase();
  const entry = Number(req.query?.entry);

  if (!symbol || !['LONG', 'SHORT'].includes(side) || !(entry > 0)) {
    return res.status(400).json({ ok: false, error: 'INVALID_REFERENCE_REQUEST' });
  }

  try {
    const candles = await fetchLevelCandles(symbol);
    const levels = buildReferenceLevels(candles, side, entry);
    return res.json({
      ok: true,
      symbol,
      side,
      entry,
      generatedAt: new Date().toISOString(),
      methodology: '15m structure + ATR14 + 1.5R~2.2R',
      ...levels,
    });
  } catch (e) {
    console.warn(`[reference-levels-v6.5] ${symbol}: ${String(e?.message || e)}`);
    return res.status(502).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get('/api/diagnostics', (_req, res) => {
  res.json({
    mode: 'V7.2',
    dataDir: DATA_DIR,
    statsRunning,
    statsCursor,
    markPriceUpdatedAt,
    markPriceError,
    markPriceSymbols: markPrices.size,
    copyRate: copyRateSnapshot(),
    screenRunning,
    screenCursor,
    pullbackTrackers: [...pullbackTrackers.values()].map(t => ({
      key: t.key,
      symbol: t.symbol,
      side: t.side,
      entryPrice: t.entryPrice,
      openTime: t.openTime,
      extremePrice: t.extremePrice,
      referenceStatus: t.referenceStatus,
      hydrationStatus: t.hydrationStatus,
      normalSentAt: t.normalSentAt,
      deepSentAt: t.deepSentAt,
      invalidSentAt: t.invalidSentAt,
    })),
    traders: [...states.values()].map(s => ({
      id: s.trader.id,
      name: s.trader.name,
      positions: s.positions.size,
      baselineReady: s.baselineReady,
      lastFetch: s.lastFetch,
      lastError: s.lastError,
      liveOrders: Array.isArray(s.latestOrders) ? s.latestOrders.length : 0,
      historyStatus: s.historyStatus,
      historyError: s.historyError,
      orderRawCount: s.orderRawCount,
      orderParseCount: s.orderParseCount,
      orderPath: s.orderPath,
      positionStatus: s.positionStatus,
      positionError: s.positionError,
      positionRawCount: s.positionRawCount,
      positionParseCount: s.positionParseCount,
      positionPath: s.positionPath,
      statsOrderCount: s.statsOrderCount,
      statsSource: s.statsSource,
      statsUpdatedAt: s.statsUpdatedAt,
      statsError: s.statsError,
      statsSample: Number(s.recentStats?.sample || 0),
      confidence: displayStatsFor(s)?.confidence || 'LOW',
      displayStats: displayStatsFor(s),
      referenceStats: s.referenceStats,
      referenceUpdatedAt: s.referenceUpdatedAt,
      referenceError: s.referenceError,
      signalValue: signalValue(s),
      screening: s.screening,
      qualification: strictQualification(s),
    })),
  });
});

app.post('/api/subscribe', (req, res) => {
  const body = req.body || {};
  const subscription = body.subscription?.endpoint ? body.subscription : body;

  if (!subscription?.endpoint) {
    return res.status(400).json({ error: 'INVALID_SUBSCRIPTION' });
  }

  const enabledTraders = cleanTraderIds(body.enabledTraders, true);
  const enabledTypes = cleanEventTypes(body.enabledTypes, true);
  const consensusEnabled = body.consensusEnabled !== false;
  const dailyBriefEnabled = body.dailyBriefEnabled === true;
  const dailyBriefIntervalHours = cleanBriefInterval(body.dailyBriefIntervalHours);

  const records = loadSubRecords();
  const idx = records.findIndex(r => r.endpoint === subscription.endpoint);

  const next = {
    endpoint: subscription.endpoint,
    subscription,
    enabledTraders,
    enabledTypes,
    consensusEnabled,
    dailyBriefEnabled,
    dailyBriefIntervalHours,
    lastDailyBriefPushAt: idx >= 0 ? records[idx]?.lastDailyBriefPushAt || null : null,
    preferenceVersion: 72,
  };

  if (idx >= 0) records[idx] = next;
  else records.push(next);

  saveSubRecords(records);

  res.json({
    ok: true,
    enabledTraders,
    enabledTypes,
    consensusEnabled,
    dailyBriefEnabled,
    dailyBriefIntervalHours,
    preferenceVersion: 72,
  });
});

app.post('/api/preferences', (req, res) => {
  const endpoint = String(req.body?.endpoint || '');

  if (!endpoint) {
    return res.status(400).json({ error: 'MISSING_ENDPOINT' });
  }

  const records = loadSubRecords();
  const rec = records.find(r => r.endpoint === endpoint);

  if (!rec) {
    return res.status(404).json({ error: 'SUBSCRIPTION_NOT_FOUND' });
  }

  if (Array.isArray(req.body?.enabledTraders)) {
    rec.enabledTraders = cleanTraderIds(req.body.enabledTraders, false);
  }

  if (Array.isArray(req.body?.enabledTypes)) {
    rec.enabledTypes = cleanEventTypes(req.body.enabledTypes, false);
  }
  if (typeof req.body?.consensusEnabled === 'boolean') rec.consensusEnabled = req.body.consensusEnabled;
  if (typeof req.body?.dailyBriefEnabled === 'boolean') rec.dailyBriefEnabled = req.body.dailyBriefEnabled;
  if (req.body?.dailyBriefIntervalHours !== undefined) rec.dailyBriefIntervalHours = cleanBriefInterval(req.body.dailyBriefIntervalHours);
  rec.preferenceVersion = 72;

  saveSubRecords(records);

  res.json({
    ok: true,
    enabledTraders: rec.enabledTraders,
    enabledTypes: rec.enabledTypes,
    consensusEnabled: rec.consensusEnabled !== false,
    dailyBriefEnabled: rec.dailyBriefEnabled === true,
    dailyBriefIntervalHours: cleanBriefInterval(rec.dailyBriefIntervalHours),
    preferenceVersion: 72,
  });
});

app.post('/api/test-push', async (req, res) => {
  const traderId = TRADER_IDS.has(req.body?.traderId)
    ? req.body.traderId
    : TRADERS[0].id;

  const trader = TRADER_BY_ID.get(traderId);

  try {
    await sendPush({
      title: `${trader.name}｜做多`,
      body: 'BTCUSDT｜77,452.8',
      tag: `test-${Date.now()}`,
      renotify: true,
      data: { url: '/' },
    }, {
      traderId,
      eventType: 'OPEN',
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post('/api/test-pullback-push', async (_req, res) => {
  try {
    await sendPush({
      title: '熬鷹資本｜一般回踩',
      body: 'BTCUSDT 做多｜77,452.8｜回撤 38.2%｜點開TV確認',
      tag: `test-pullback-${Date.now()}`,
      renotify: true,
      data: { url: tradingViewLaunchUrl('BTCUSDT') },
    }, {
      traderId: CORE_TRADER_ID,
      eventType: 'PULLBACK',
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/healthz', (_req, res) => {
  const rows = [...states.values()];

  res.json({
    ok: rows.some(s => Boolean(s.lastFetch)),
    healthy: rows.filter(s => Boolean(s.lastFetch)).length,
    total: rows.length,
    mode: 'V7.2',
  });
});

if (process.env.UNIT_TEST !== '1') {
  app.listen(PORT, () => {
    console.log(`Position Alert V7.2 AI RANKING started on ${PORT}`);
    console.log(`Tracking: ${TRADERS.map(t => `${t.name}(${t.id})`).join(', ')}`);
    loop();
    statsTimer = setTimeout(statsLoop, 8000);
    referenceTimer = setTimeout(referenceLoop, 12000);
    screenTimer = setTimeout(screenLoop, 16000);
    dailyBriefTimer = setTimeout(dailyBriefLoop, 25000);
  });
}

process.on('SIGTERM', () => {
  if (timer) clearTimeout(timer);
  if (statsTimer) clearTimeout(statsTimer);
  if (referenceTimer) clearTimeout(referenceTimer);
  if (screenTimer) clearTimeout(screenTimer);
  if (dailyBriefTimer) clearTimeout(dailyBriefTimer);
  process.exit(0);
});

export {
  app,
  TRADERS,
  extractBestRows,
  normalizeOrder,
  normalizePosition,
  calculateRecentStats,
  parseCopyRadarHtml,
  displayStatsFor,
  signalValue,
  syncOfficialSnapshot,
  positionKey,
  newestPositions,
  hasCoreMember,
  strictQualification,
  consensusEpisodeTransition,
  pctNumber,
  subscriptionAllows,
  pullbackActivationMove,
  pullbackSnapshot,
  pullbackTransition,
  technicalSnapshot,
  backtestIdea,
  buildTodayView,
};
