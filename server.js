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
const IDEA_CACHE_MS = Math.max(30_000, Number(process.env.IDEA_CACHE_MS || 60_000));
const IDEA_STALE_MS = Math.max(5 * 60_000, Number(process.env.IDEA_STALE_MS || 20 * 60 * 1000));
const IDEA_SYMBOLS = Math.max(12, Math.min(32, Number(process.env.IDEA_SYMBOLS || 24)));
const RADAR_MAX_SYMBOLS = Math.max(50, Math.min(180, Number(process.env.RADAR_MAX_SYMBOLS || 100)));
const REALTIME_MAX_SYMBOLS = Math.max(12, Math.min(32, Number(process.env.REALTIME_MAX_SYMBOLS || 24)));
const REALTIME_DEPTH_SYMBOLS = Math.max(8, Math.min(16, Number(process.env.REALTIME_DEPTH_SYMBOLS || 12)));
const ENABLE_REALTIME_WS = String(process.env.ENABLE_REALTIME_WS || '1') !== '0';
const REALTIME_RESTART_MS = Math.max(15_000, Number(process.env.REALTIME_RESTART_MS || 30_000));
const REALTIME_STALE_MS = Math.max(5_000, Number(process.env.REALTIME_STALE_MS || 12_000));
const IDEA_CONCURRENCY = Math.max(2, Math.min(6, Number(process.env.IDEA_CONCURRENCY || 4)));
const TEST_SIGNAL_SCAN_MS = Math.max(20_000, Number(process.env.TEST_SIGNAL_SCAN_MS || 30_000));
const TEST_MONITOR_DELAY_MS = Math.max(TEST_SIGNAL_SCAN_MS, Number(process.env.TEST_MONITOR_DELAY_MS || 60_000));
const TEST_MONITOR_STALE_MS = Math.max(TEST_MONITOR_DELAY_MS + 30_000, Number(process.env.TEST_MONITOR_STALE_MS || 120_000));
const TEST_ENTRY_DEBOUNCE_MS = Math.max(0, Math.min(8_000, Number(process.env.TEST_ENTRY_DEBOUNCE_MS || 3_500)));
const PERF_MAX_HORIZON_MS = Math.max(90*60*1000, Math.min(12*60*60*1000, Number(process.env.PERF_MAX_HORIZON_MS || 4*60*60*1000)));
const PERF_ROUND_TRIP_COST_BPS = Math.max(0, Math.min(100, Number(process.env.PERF_ROUND_TRIP_COST_BPS || 12)));
const REGIME_LIQUIDATION_5M_USD = Math.max(1_000_000, Number(process.env.REGIME_LIQUIDATION_5M_USD || 15_000_000));
const TEST_SIGNAL_MAX = Math.max(4, Math.min(12, Number(process.env.TEST_SIGNAL_MAX || 12)));
const TEST_SIGNAL_IDEA_TTL_MS = Math.max(10 * 60 * 1000, Number(process.env.TEST_SIGNAL_IDEA_TTL_MS || 25 * 60 * 1000));
const TEST_SIGNAL_OUTCOME_MS = Math.max(60 * 60 * 1000, Number(process.env.TEST_SIGNAL_OUTCOME_MS || 90 * 60 * 1000));
const TEST_SIGNAL_CONFIRM_SCORE = Math.max(60, Math.min(92, Number(process.env.TEST_SIGNAL_CONFIRM_SCORE || 76)));
const TEST_SIGNAL_HIGH_RATE = Math.max(60, Math.min(85, Number(process.env.TEST_SIGNAL_HIGH_RATE || 68)));
const TEST_SIGNAL_NORMAL_RATE = Math.max(54, Math.min(TEST_SIGNAL_HIGH_RATE - 1, Number(process.env.TEST_SIGNAL_NORMAL_RATE || 60)));
const TEST_SIGNAL_HIGH_SCORE = Math.max(82, Math.min(96, Number(process.env.TEST_SIGNAL_HIGH_SCORE || 87)));
const TEST_SIGNAL_NORMAL_SCORE = Math.max(74, Math.min(TEST_SIGNAL_HIGH_SCORE - 1, Number(process.env.TEST_SIGNAL_NORMAL_SCORE || 80)));
const TEST_SIGNAL_FIRST_MAX_CHASE_ATR = Math.max(.15, Math.min(.7, Number(process.env.TEST_SIGNAL_FIRST_MAX_CHASE_ATR || .30)));
const TEST_SIGNAL_HIGH_MAX_CHASE_ATR = Math.max(.10, Math.min(TEST_SIGNAL_FIRST_MAX_CHASE_ATR, Number(process.env.TEST_SIGNAL_HIGH_MAX_CHASE_ATR || .18)));
const TEST_SIGNAL_MAX_SPREAD_BPS = Math.max(3, Math.min(30, Number(process.env.TEST_SIGNAL_MAX_SPREAD_BPS || 12)));
const TEST_MONITOR_WEAK_FLAGS = Math.max(2, Math.min(6, Number(process.env.TEST_MONITOR_WEAK_FLAGS || 4)));
const TEST_MONITOR_STATE_BARS = Math.max(2, Math.min(3, Number(process.env.TEST_MONITOR_STATE_BARS || 2)));
const TEST_MONITOR_BAD_SCORE = Math.max(45, Math.min(70, Number(process.env.TEST_MONITOR_BAD_SCORE || 58)));
const TEST_MONITOR_BAD_BARS = Math.max(2, Math.min(6, Number(process.env.TEST_MONITOR_BAD_BARS || 3))); // 3 x 5m = 15m sustained weakness
const TEST_MONITOR_WEAK_MAX_MS = Math.max(15 * 60 * 1000, Number(process.env.TEST_MONITOR_WEAK_MAX_MS || 30 * 60 * 1000));
const TEST_MONITOR_REACTIVATE_MS = Math.max(20 * 60 * 1000, Math.min(60 * 60 * 1000, Number(process.env.TEST_MONITOR_REACTIVATE_MS || 30 * 60 * 1000)));
const TEST_REARM_COOLDOWN_MS = Math.max(20 * 60 * 1000, Number(process.env.TEST_REARM_COOLDOWN_MS || 30 * 60 * 1000));
const TEST_REARM_SCORE = Math.max(74, Math.min(92, Number(process.env.TEST_REARM_SCORE || 80)));
const TEST_REENTRY_MIN_BARS = Math.max(1, Math.min(4, Number(process.env.TEST_REENTRY_MIN_BARS || 2))); // 達標後至少等 2 根已收 5m K
const TEST_REENTRY_CONFIRM_BARS = Math.max(1, Math.min(3, Number(process.env.TEST_REENTRY_CONFIRM_BARS || 2))); // 二次回踩收復後連續確認
const TEST_REENTRY_SCORE = Math.max(74, Math.min(92, Number(process.env.TEST_REENTRY_SCORE || 80)));
const TEST_REENTRY_MAX_RANK = Math.max(3, Math.min(12, Number(process.env.TEST_REENTRY_MAX_RANK || 6)));
const TEST_REENTRY_MAX_CHASE_ATR = Math.max(.2, Math.min(.8, Number(process.env.TEST_REENTRY_MAX_CHASE_ATR || .45)));
const FUTURES_DATA = 'https://fapi.binance.com/futures/data';
const BINANCE_FAPI = 'https://fapi.binance.com';
const BYBIT_API = 'https://api.bybit.com';
const OKX_API = 'https://www.okx.com';
const ENABLE_CROSS_EXCHANGE = String(process.env.ENABLE_CROSS_EXCHANGE || '1') !== '0';
const DAILY_BRIEF_SCHEDULE_MINUTE = 8 * 60 + 5; // 08:05 Asia/Taipei
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || '').trim();
const RUNTIME_PROJECT = String(process.env.RAILWAY_PROJECT_NAME || '').trim();
const RUNTIME_SERVICE = String(process.env.RAILWAY_SERVICE_NAME || '').trim();
const BUILD_VERSION = 'V10.1.0';
const DAILY_BRIEF_PUSH_WINDOW_MIN = 25;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const SYMBOL_ANALYSIS_CACHE_MS = Math.max(30 * 60 * 1000, Number(process.env.SYMBOL_ANALYSIS_CACHE_MS || 2 * 60 * 60 * 1000));
const symbolAnalysisCache = new Map();

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
const DAILY_BRIEF_FILE = path.join(DATA_DIR, 'daily-brief-v73.json');
const TEST_SIGNAL_FILE = path.join(DATA_DIR, 'test-signals-v78.json'); // keep filename so upgrades retain accumulated live history
const TEST_SIGNAL_HISTORY_FILE = path.join(DATA_DIR, 'test-signal-history-v78.json');
const SIGNAL_PERFORMANCE_FILE = path.join(DATA_DIR, 'signal-performance-v10.json');

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
  let tmp = '';
  try {
    fs.mkdirSync(path.dirname(file), { recursive:true });
    tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  } catch (e) {
    if (tmp) { try { fs.unlinkSync(tmp); } catch {} }
    console.warn(`[persist] ${path.basename(file)}: ${String(e?.message || e)}`);
  }
}
const persistedDailyBrief = loadJson(DAILY_BRIEF_FILE, null);
if (persistedDailyBrief?.data) {
  dailyBriefCache = { at:Number(persistedDailyBrief.at||0), dayKey:String(persistedDailyBrief.dayKey||''), data:persistedDailyBrief.data, error:null, inflight:null };
}
const persistedTestSignals = loadJson(TEST_SIGNAL_FILE, {});
const testSignalTrackers = new Map(Object.entries(persistedTestSignals && typeof persistedTestSignals === 'object' ? persistedTestSignals : {}));
let testSignalHistory = Array.isArray(loadJson(TEST_SIGNAL_HISTORY_FILE, [])) ? loadJson(TEST_SIGNAL_HISTORY_FILE, []) : [];
let signalPerformance = Array.isArray(loadJson(SIGNAL_PERFORMANCE_FILE, [])) ? loadJson(SIGNAL_PERFORMANCE_FILE, []) : [];
let performanceSaveTimer = null;
let performanceTimer = null;
let testBarTimer = null;
let testSignalTimer = null;
let testSignalBusy = false;
let testSignalLastRunAt = 0;
let testSignalLastError = null;
const testCandleCache = new Map();
const testBacktestCandleCache = new Map();
const testMicroCache = new Map();
const testRiskCache = new Map();
const testDerivCache = new Map();
const testCrossExchangeCache = new Map();
const testCandleSourceCache = new Map();
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

// V10 SOLO MAX — realtime market bus. REST remains the fallback; WebSocket only improves freshness/first-touch ordering.
const realtimeBook = new Map();
const realtimeFlow = new Map();
const realtimeFunding = new Map();
const realtimeMarketTickers = new Map();
let realtimeLiquidations = [];
let realtimePublicWs = null, realtimeMarketWs = null;
let realtimeGeneration = 0, realtimeSymbolSignature = '';
let realtimeRefreshTimer = null;
const realtimeLatencySamples={public:[],market:[]};
const realtimeHealth = {
  public:{connected:false,connectedAt:null,lastMessageAt:null,lastError:null,reconnects:0,urlPath:'/public'},
  market:{connected:false,connectedAt:null,lastMessageAt:null,lastError:null,reconnects:0,urlPath:'/market'},
};
function realtimeTrackedSymbols() {
  const out=new Set(['BTCUSDT','ETHUSDT']);
  try { for(const t of [...testSignalTrackers.values()].sort((a,b)=>(a.rank||99)-(b.rank||99))) { if(out.size>=REALTIME_MAX_SYMBOLS)break; if(!terminalTestStatus(t.status))out.add(cleanFuturesSymbol(t.symbol)); } } catch {}
  try { for(const x of rankedIdeasCache?.data?.rows||[]) { if(out.size>=REALTIME_MAX_SYMBOLS)break; out.add(cleanFuturesSymbol(x.symbol)); } } catch {}
  try { for(const st of states?.values?.()||[]) for(const pos of st.positions?.values?.()||[]) { if(out.size>=REALTIME_MAX_SYMBOLS)break; out.add(cleanFuturesSymbol(pos.symbol)); } } catch {}
  return [...out].filter(x=>/^[A-Z0-9]{5,24}$/.test(x)).slice(0,REALTIME_MAX_SYMBOLS);
}
function realtimePruneTrades(symbol, now=Date.now()) {
  const x=realtimeFlow.get(symbol); if(!x)return;
  x.trades=(x.trades||[]).filter(t=>now-t.ts<=65_000).slice(-5000);
}
function realtimeTakerSnapshot(symbol) {
  const key=cleanFuturesSymbol(symbol),now=Date.now(),x=realtimeFlow.get(key);if(!x)return {ratio:null,buyUsd:0,sellUsd:0,tradeUsd:0,ageMs:null};
  realtimePruneTrades(key,now);let buy=0,sell=0;for(const t of x.trades||[]){if(t.buy)buy+=t.usd;else sell+=t.usd}
  return {ratio:sell>0?buy/sell:(buy>0?9:null),buyUsd:buy,sellUsd:sell,tradeUsd:buy+sell,ageMs:x.lastAt?now-x.lastAt:null,lastAt:x.lastAt||null};
}
function realtimeSnapshot(symbol) {
  const key=cleanFuturesSymbol(symbol),now=Date.now(),b=realtimeBook.get(key)||{},f=realtimeFunding.get(key)||{},flow=realtimeTakerSnapshot(key);
  const mark=Number(markPrices.get(key));
  return {symbol:key,markPrice:Number.isFinite(mark)&&mark>0?mark:null,lastTradePrice:finiteMetric(realtimeFlow.get(key)?.lastPrice),bid:finiteMetric(b.bid),ask:finiteMetric(b.ask),spreadBps:finiteMetric(b.spreadBps),depthImbalance:finiteMetric(b.depthImbalance),bidNotional:finiteMetric(b.bidNotional),askNotional:finiteMetric(b.askNotional),bookAgeMs:b.at?now-b.at:null,takerRatio60s:flow.ratio,takerBuyUsd60s:flow.buyUsd,takerSellUsd60s:flow.sellUsd,takerTradeUsd60s:flow.tradeUsd,takerAgeMs:flow.ageMs,fundingPct:finiteMetric(f.fundingPct),indexPrice:finiteMetric(f.indexPrice),markAgeMs:f.at?now-f.at:(markPriceUpdatedAt?now-new Date(markPriceUpdatedAt).getTime():null),source:f.at?'Binance WS':'REST fallback'};
}
function realtimeBestPrice(symbol) { const r=realtimeSnapshot(symbol);if(r.lastTradePrice&&r.takerAgeMs!=null&&r.takerAgeMs<=REALTIME_STALE_MS)return r.lastTradePrice;if(r.markPrice&&r.markAgeMs!=null&&r.markAgeMs<=Math.max(REALTIME_STALE_MS,15_000))return r.markPrice;const fallback=Number(markPrices.get(cleanFuturesSymbol(symbol)));return Number.isFinite(fallback)&&fallback>0?fallback:null; }
function realtimeLiquidationSnapshot(now=Date.now()) {
  realtimeLiquidations=realtimeLiquidations.filter(x=>now-x.ts<=10*60_000).slice(-2500);
  const rows=realtimeLiquidations.filter(x=>now-x.ts<=5*60_000);let longUsd=0,shortUsd=0;
  for(const x of rows){ if(x.side==='SELL')longUsd+=x.usd; else if(x.side==='BUY')shortUsd+=x.usd; }
  return {totalUsd:longUsd+shortUsd,longLiquidationUsd:longUsd,shortLiquidationUsd:shortUsd,count:rows.length,updatedAt:rows.at(-1)?.ts||null};
}
function realtimeRadarCandidates(limit=RADAR_MAX_SYMBOLS) {
  const rows=[];
  for(const [symbol,x] of realtimeMarketTickers){
    if(!symbol.endsWith('USDT'))continue;const quoteVolume=Number(x.quoteVolume||0),price=Number(x.price||0),changePct=Number(x.changePct||0);if(!(quoteVolume>0&&price>0))continue;
    const activity=Math.log10(Math.max(1,quoteVolume))*10+Math.min(30,Math.abs(changePct)*2.2);
    rows.push({symbol,price,changePct,quoteVolume,fundingPct:finiteMetric(realtimeFunding.get(symbol)?.fundingPct)||0,activityScore:Number(activity.toFixed(2)),source:'Binance WS radar'});
  }
  return rows.sort((a,b)=>b.activityScore-a.activityScore||b.quoteVolume-a.quoteVolume).slice(0,limit);
}
function realtimeRadarSummary(){const rows=realtimeRadarCandidates(RADAR_MAX_SYMBOLS),up=rows.filter(x=>x.changePct>0).length,down=rows.filter(x=>x.changePct<0).length;return {scanned:realtimeMarketTickers.size,eligible:rows.length,deepCandidates:Math.min(IDEA_SYMBOLS,rows.length),advancers:up,decliners:down,updatedAt:realtimeHealth.market.lastMessageAt};}
function realtimeUnwrap(payload){return payload&&typeof payload==='object'&&'data'in payload?payload.data:payload}
function realtimeHandlePublic(payload){
  const d=realtimeUnwrap(payload);if(!d||typeof d!=='object'||Array.isArray(d))return;const symbol=cleanFuturesSymbol(d.s);if(!symbol)return;const now=Date.now();
  if(d.e==='bookTicker'||(d.b!=null&&d.a!=null&&!Array.isArray(d.b))){const bid=Number(d.b),ask=Number(d.a);if(bid>0&&ask>0){const old=realtimeBook.get(symbol)||{};realtimeBook.set(symbol,{...old,bid,ask,spreadBps:(ask-bid)/((ask+bid)/2)*10000,at:now});}}
  if(d.e==='depthUpdate'&&Array.isArray(d.b)&&Array.isArray(d.a)){const sm=summarizeDepth(d.b,d.a),old=realtimeBook.get(symbol)||{};realtimeBook.set(symbol,{...old,...sm,at:now});}
}
function realtimeHandleMarketOne(d){
  if(!d||typeof d!=='object')return;const now=Date.now(),eventTs=Number(d.E||d.T||now)||now;
  if(d.e==='aggTrade'){
    const symbol=cleanFuturesSymbol(d.s),px=Number(d.p),qty=Number(d.q);if(symbol&&px>0&&qty>=0){let x=realtimeFlow.get(symbol)||{trades:[]};x.lastPrice=px;x.lastAt=eventTs;x.trades.push({ts:eventTs,usd:px*qty,buy:d.m===false});if(x.trades.length>5200)x.trades=x.trades.slice(-5000);realtimeFlow.set(symbol,x);performanceOnPrice(symbol,px,eventTs,'Binance WS aggTrade');}
  } else if(d.e==='markPriceUpdate'){
    const symbol=cleanFuturesSymbol(d.s),px=Number(d.p);if(symbol&&px>0){markPrices.set(symbol,px);markPriceUpdatedAt=new Date(eventTs).toISOString();realtimeFunding.set(symbol,{markPrice:px,indexPrice:finiteMetric(d.i),fundingPct:finiteMetric(d.r)!=null?Number(d.r)*100:null,nextFundingTime:finiteMetric(d.T),at:eventTs});performanceOnPrice(symbol,px,eventTs,'Binance WS markPrice');}
  } else if(d.e==='24hrTicker'){
    const symbol=cleanFuturesSymbol(d.s),price=Number(d.c),quoteVolume=Number(d.q),changePct=Number(d.P);if(symbol&&price>0)realtimeMarketTickers.set(symbol,{price,quoteVolume:Number.isFinite(quoteVolume)?quoteVolume:0,changePct:Number.isFinite(changePct)?changePct:0,at:eventTs});
  } else if(d.e==='forceOrder'){
    const o=d.o||{},symbol=cleanFuturesSymbol(o.s),px=Number(o.ap||o.p),qty=Number(o.z||o.q);if(symbol&&px>0&&qty>0)realtimeLiquidations.push({symbol,side:String(o.S||''),usd:px*qty,ts:Number(o.T||eventTs)});
  }
}
function realtimeHandleMarket(payload){const d=realtimeUnwrap(payload);if(Array.isArray(d)){for(const x of d)realtimeHandleMarketOne(x)}else realtimeHandleMarketOne(d)}
function realtimeDecodeMessage(ev){try{const raw=typeof ev.data==='string'?ev.data:String(ev.data);return JSON.parse(raw)}catch{return null}}
function realtimeSocketUrl(kind,symbols){
  const lower=symbols.map(x=>x.toLowerCase());
  if(kind==='public'){const streams=[...lower.map(x=>`${x}@bookTicker`),...lower.slice(0,REALTIME_DEPTH_SYMBOLS).map(x=>`${x}@depth20@100ms`)];return `wss://fstream.binance.com/public/stream?streams=${streams.join('/')}`;}
  const streams=['!markPrice@arr@1s','!ticker@arr','!forceOrder@arr',...lower.map(x=>`${x}@aggTrade`)];return `wss://fstream.binance.com/market/stream?streams=${streams.join('/')}`;
}
function realtimeEventTime(payload){const d=realtimeUnwrap(payload),x=Array.isArray(d)?d[0]:d;const ts=Number(x?.E||x?.T||0);return ts>0?ts:null}
function recordRealtimeLatency(kind,payload){const ts=realtimeEventTime(payload);if(!ts)return;const v=Math.max(0,Math.min(60_000,Date.now()-ts)),a=realtimeLatencySamples[kind];a.push(v);if(a.length>300)a.splice(0,a.length-300)}
function realtimeLatencyStats(kind){const a=[...(realtimeLatencySamples[kind]||[])].sort((x,y)=>x-y);if(!a.length)return {p50Ms:null,p95Ms:null,samples:0};const q=p=>a[Math.min(a.length-1,Math.max(0,Math.floor((a.length-1)*p)))];return {p50Ms:Math.round(q(.5)),p95Ms:Math.round(q(.95)),samples:a.length}}
function connectRealtimeSocket(kind,generation,symbols){
  if(!ENABLE_REALTIME_WS||typeof WebSocket!=='function'||generation!==realtimeGeneration)return;const health=realtimeHealth[kind],url=realtimeSocketUrl(kind,symbols);let ws;
  try{ws=new WebSocket(url)}catch(e){health.lastError=String(e?.message||e);return scheduleRealtimeReconnect(kind,generation,symbols)}
  if(kind==='public')realtimePublicWs=ws;else realtimeMarketWs=ws;
  ws.addEventListener('open',()=>{if(generation!==realtimeGeneration)return;health.connected=true;health.connectedAt=new Date().toISOString();health.lastError=null;});
  ws.addEventListener('message',ev=>{if(generation!==realtimeGeneration)return;health.lastMessageAt=new Date().toISOString();const d=realtimeDecodeMessage(ev);if(!d)return;recordRealtimeLatency(kind,d);if(kind==='public')realtimeHandlePublic(d);else realtimeHandleMarket(d);});
  ws.addEventListener('error',()=>{health.lastError='WebSocket error'});
  ws.addEventListener('close',()=>{health.connected=false;if(generation===realtimeGeneration)scheduleRealtimeReconnect(kind,generation,symbols)});
}
function scheduleRealtimeReconnect(kind,generation,symbols){if(generation!==realtimeGeneration)return;const health=realtimeHealth[kind];health.reconnects++;const delay=Math.min(15_000,1000+health.reconnects*650);setTimeout(()=>{if(generation===realtimeGeneration)connectRealtimeSocket(kind,generation,symbols)},delay).unref?.()}
function restartRealtime(force=false){
  if(!ENABLE_REALTIME_WS)return;const symbols=realtimeTrackedSymbols(),sig=symbols.join(','),now=Date.now(),stale=x=>!x.connected||!x.lastMessageAt||now-new Date(x.lastMessageAt).getTime()>30_000;if(!force&&sig===realtimeSymbolSignature&&!stale(realtimeHealth.public)&&!stale(realtimeHealth.market))return;realtimeSymbolSignature=sig;realtimeGeneration++;const gen=realtimeGeneration;
  try{realtimePublicWs?.close()}catch{}try{realtimeMarketWs?.close()}catch{}realtimeHealth.public.connected=false;realtimeHealth.market.connected=false;realtimeHealth.public.reconnects=0;realtimeHealth.market.reconnects=0;
  setTimeout(()=>{connectRealtimeSocket('public',gen,symbols);connectRealtimeSocket('market',gen,symbols)},150).unref?.();
}
function startRealtime(){if(!ENABLE_REALTIME_WS)return;restartRealtime(true);realtimeRefreshTimer=setInterval(()=>restartRealtime(false),REALTIME_RESTART_MS);realtimeRefreshTimer.unref?.()}
function stopRealtime(){realtimeGeneration++;if(realtimeRefreshTimer)clearInterval(realtimeRefreshTimer);try{realtimePublicWs?.close()}catch{}try{realtimeMarketWs?.close()}catch{}}
function realtimeHealthSnapshot(){const now=Date.now(),age=x=>x.lastMessageAt?Math.max(0,now-new Date(x.lastMessageAt).getTime()):null;return {enabled:ENABLE_REALTIME_WS,trackedSymbols:realtimeSymbolSignature?realtimeSymbolSignature.split(','):[],depthSymbols:Math.min(REALTIME_DEPTH_SYMBOLS,realtimeSymbolSignature?realtimeSymbolSignature.split(',').length:0),public:{...realtimeHealth.public,messageAgeMs:age(realtimeHealth.public),latency:realtimeLatencyStats('public')},market:{...realtimeHealth.market,messageAgeMs:age(realtimeHealth.market),latency:realtimeLatencyStats('market')},radar:realtimeRadarSummary(),liquidations:realtimeLiquidationSnapshot()};}

function applyRealtimeOverlay(symbol,deriv,micro,riskCtx){
  const rt=realtimeSnapshot(symbol),freshBook=rt.bookAgeMs!=null&&rt.bookAgeMs<=REALTIME_STALE_MS,freshTaker=rt.takerAgeMs!=null&&rt.takerAgeMs<=REALTIME_STALE_MS&&rt.takerTradeUsd60s>=1000,freshMark=rt.markAgeMs!=null&&rt.markAgeMs<=REALTIME_STALE_MS;
  if(freshBook&&finiteMetric(rt.depthImbalance)!=null){micro.depthImbalance=rt.depthImbalance;micro.spreadBps=rt.spreadBps;micro.bidNotional=rt.bidNotional;micro.askNotional=rt.askNotional;micro._health={...(micro._health||{}),depth:true};micro._source={...(micro._source||{}),depth:'Binance WS depth20@100ms'};}
  if(freshTaker&&finiteMetric(rt.takerRatio60s)!=null){deriv.takerRatio=rt.takerRatio60s;deriv._health={...(deriv._health||{}),taker:true};deriv._source={...(deriv._source||{}),taker:'Binance WS aggTrade 60s'};deriv.takerBuyUsd60s=rt.takerBuyUsd60s;deriv.takerSellUsd60s=rt.takerSellUsd60s;}
  if(freshMark&&finiteMetric(rt.markPrice)!=null){riskCtx.markPrice=rt.markPrice;riskCtx._health={...(riskCtx._health||{}),mark:true};riskCtx._source={...(riskCtx._source||{}),mark:'Binance WS markPrice@1s'};if(finiteMetric(rt.fundingPct)!=null){riskCtx.fundingPct=rt.fundingPct;riskCtx._health.funding=true;riskCtx._source.funding='Binance WS markPrice@1s';}if(finiteMetric(rt.indexPrice)!=null)riskCtx.indexPrice=rt.indexPrice;}
  return rt;
}

const PERF_HORIZONS_MIN=[5,15,30,60,90,240];
const performanceActiveSymbols=new Set(signalPerformance.filter(x=>x?.version==='V10.0'&&x.status==='ACTIVE').map(x=>cleanFuturesSymbol(x.symbol)));
const notificationAckPending={received:new Map(),clicked:new Map()};
function schedulePerformanceSave(){if(performanceSaveTimer)return;performanceSaveTimer=setTimeout(()=>{performanceSaveTimer=null;signalPerformance=signalPerformance.slice(0,1200);saveJson(SIGNAL_PERFORMANCE_FILE,signalPerformance)},1500);performanceSaveTimer.unref?.()}
function performanceAckTime(payloadTs, fallback=Date.now()){
  const n=Number(payloadTs);if(Number.isFinite(n)&&Math.abs(n-fallback)<10*60_000)return n;return fallback;
}
function performanceApplyNotificationAck(kind,id,clientTs){
  const key=String(id||'').slice(0,180);if(!key)return false;const now=Date.now(),ts=performanceAckTime(clientTs,now),rec=signalPerformance.find(x=>x?.version==='V10.0'&&x.id===key);
  if(!rec){notificationAckPending[kind]?.set(key,{ts,serverAt:now});return false;}
  const start=new Date(rec.notificationAt||0).getTime();
  if(kind==='received'&&!rec.receivedAt){rec.receivedAt=new Date(ts).toISOString();rec.receivedAckAt=new Date(now).toISOString();rec.deliveryLatencyMs=start>0?Math.max(0,ts-start):null;}
  if(kind==='clicked'&&!rec.clickedAt){rec.clickedAt=new Date(ts).toISOString();rec.clickedAckAt=new Date(now).toISOString();rec.clickLatencyMs=start>0?Math.max(0,ts-start):null;}
  schedulePerformanceSave();return true;
}
function performanceMergePendingAcks(rec){
  for(const kind of ['received','clicked']){const x=notificationAckPending[kind].get(rec.id);if(!x)continue;notificationAckPending[kind].delete(rec.id);performanceApplyNotificationAck(kind,rec.id,x.ts);}
}
function performanceRecordForNotification(t,code,tier,delivery,options={}){
  if(!(delivery?.sent>0))return null;const phase=options.reentry?'REENTRY':'FIRST_ENTRY';const isEntry=code==='CONFIRMED'||(phase==='REENTRY'&&String(options.statusLabel||'').includes('二次確認'));if(!isEntry)return null;
  const dir=testSignalDirection(t.direction),rt=options.noticeSnapshot||realtimeSnapshot(t.symbol),entry=finiteMetric(options.noticeEntryPrice)??finiteMetric(realtimeBestPrice(t.symbol))??finiteMetric(options.reentry?t.reentryEntryPrice:t.confirmationPrice),stop=finiteMetric(options.reentry?t.reentryStop:t.stop),target=finiteMetric(options.reentry?t.reentryTarget1R:t.target1R);if(!(entry>0&&stop>0&&target>0))return null;
  const sentMs=performanceAckTime(new Date(options.noticeSentAt||Date.now()).getTime()),now=new Date(sentMs).toISOString(),risk=Math.abs(entry-stop);if(!(risk>0))return null;const cal=testCalibratedWinRate(t,{dynamic:true}),zone=testCurrentEntryZone(t),id=String(options.noticeId||`${t.key}:${phase}:${now}`),confirmedAt=options.reentry?t.reentryConfirmAt:t.confirmedAt,confirmedMs=new Date(confirmedAt||0).getTime();
  const rec={id,version:'V10.0',signalKey:t.key,symbol:t.symbol,direction:t.direction,phase,tier:String(tier||'VALID'),notificationAt:now,pushAcceptedAt:options.pushAcceptedAt||new Date().toISOString(),pushServiceMs:finiteMetric(options.pushServiceMs),confirmedAt,signalToPushMs:Number.isFinite(confirmedMs)&&confirmedMs>0?Math.max(0,sentMs-confirmedMs):null,entryPrice:entry,signalConfirmationPrice:finiteMetric(options.reentry?t.reentryEntryPrice:t.confirmationPrice),stop,target,riskDistance:risk,targetR:Number((dir*(target-entry)/risk).toFixed(3)),zoneLow:finiteMetric(zone?.low),zoneHigh:finiteMetric(zone?.high),rank:Number(t.rank||0)||null,observationProgress:finiteMetric(t.observationProgress),strategyId:options.reentry?'REENTRY':((t.strategyAtConfirm||t.strategyProfile)?.id||null),strategyLabel:options.reentry?'二次回踩':((t.strategyAtConfirm||t.strategyProfile)?.label||null),qualityScore:finiteMetric(options.reentry?t.reentryScore:(t.monitorScore||t.qualityScore)),calibratedWinRate:finiteMetric(cal.rate),marketRegime:t.marketRegime||t.lastCheck?.marketRegime||'UNKNOWN',dataCoverage:finiteMetric(t.dataHealth?.coveragePct),dataConfidence:finiteMetric(t.dataHealth?.confidencePct),notificationPriceSource:rt.lastTradePrice?'Binance WS aggTrade':rt.markPrice?'Binance mark':'tracker',sourceSnapshot:{spreadBps:rt.spreadBps,depthImbalance:rt.depthImbalance,takerRatio60s:rt.takerRatio60s,fundingPct:rt.fundingPct},status:'ACTIVE',result:null,resultAt:null,exitPrice:null,grossReturnPct:null,netReturnPct:null,realizedR:null,mfePct:0,maePct:0,maxR:0,minR:0,snapshots:{},lastPrice:entry,lastPriceAt:now,lastSource:'notification',costBps:PERF_ROUND_TRIP_COST_BPS,deliveryCount:Number(delivery.sent||0),receivedAt:null,deliveryLatencyMs:null,clickedAt:null,clickLatencyMs:null};
  signalPerformance.unshift(rec);performanceActiveSymbols.add(cleanFuturesSymbol(t.symbol));performanceMergePendingAcks(rec);schedulePerformanceSave();performanceOnPrice(t.symbol,entry,sentMs,'notification');return rec;
}
function performanceFinalize(rec,result,price,ts,source){if(rec.status!=='ACTIVE')return;const dir=testSignalDirection(rec.direction),gross=dir*(price-rec.entryPrice)/rec.entryPrice*100,r=dir*(price-rec.entryPrice)/rec.riskDistance;rec.status='RESOLVED';rec.result=result;rec.resultAt=new Date(ts).toISOString();rec.exitPrice=price;rec.grossReturnPct=Number(gross.toFixed(4));rec.netReturnPct=Number((gross-PERF_ROUND_TRIP_COST_BPS/100).toFixed(4));rec.realizedR=Number(r.toFixed(3));rec.resultSource=source;if(!signalPerformance.some(x=>x!==rec&&x.status==='ACTIVE'&&x.symbol===rec.symbol))performanceActiveSymbols.delete(cleanFuturesSymbol(rec.symbol));schedulePerformanceSave()}
function performanceOnPrice(symbol,price,ts=Date.now(),source='price'){
  const px=Number(price);if(!(px>0))return;const key=cleanFuturesSymbol(symbol);if(!performanceActiveSymbols.has(key))return;const now=Number(ts)||Date.now();let dirty=false;
  for(const rec of signalPerformance){if(rec.status!=='ACTIVE'||rec.symbol!==key)continue;const start=new Date(rec.notificationAt).getTime();if(!(now>=start))continue;const dir=testSignalDirection(rec.direction),signed=dir*(px-rec.entryPrice)/rec.entryPrice*100,r=dir*(px-rec.entryPrice)/rec.riskDistance;rec.lastPrice=px;rec.lastPriceAt=new Date(now).toISOString();rec.lastSource=source;rec.mfePct=Number(Math.max(Number(rec.mfePct||0),signed).toFixed(4));rec.maePct=Number(Math.max(Number(rec.maePct||0),-signed).toFixed(4));rec.maxR=Number(Math.max(Number(rec.maxR||0),r).toFixed(3));rec.minR=Number(Math.min(Number(rec.minR||0),r).toFixed(3));const elapsed=now-start;
    for(const min of PERF_HORIZONS_MIN){if(elapsed>=min*60_000&&!rec.snapshots?.[min]){rec.snapshots=rec.snapshots||{};rec.snapshots[min]={at:new Date(now).toISOString(),price:px,returnPct:Number(signed.toFixed(4)),r:Number(r.toFixed(3)),source};}}
    const hitStop=dir>0?px<=rec.stop:px>=rec.stop,hitTarget=dir>0?px>=rec.target:px<=rec.target;if(hitStop)performanceFinalize(rec,'LOSS',rec.stop,now,source);else if(hitTarget)performanceFinalize(rec,'WIN',rec.target,now,source);else if(elapsed>=PERF_MAX_HORIZON_MS)performanceFinalize(rec,'TIMEOUT',px,now,source);dirty=true;
  }
  if(dirty)schedulePerformanceSave();
}
function performanceTrackerFallback(){
  const now=Date.now();for(const rec of signalPerformance){if(rec.status!=='ACTIVE')continue;const t=testSignalTrackers.get(rec.signalKey);if(t){if(rec.phase==='FIRST_ENTRY'&&t.outcomeFirstTouch&&new Date(t.outcomeFirstTouchAt||0).getTime()>=new Date(rec.notificationAt).getTime()){performanceFinalize(rec,t.outcomeFirstTouch==='WIN'?'WIN':'LOSS',t.outcomeFirstTouch==='WIN'?rec.target:rec.stop,new Date(t.outcomeFirstTouchAt).getTime()||now,'5m candle fallback');continue}if(rec.phase==='REENTRY'&&['WIN','LOSS'].includes(t.reentryResult)&&new Date(t.reentryResultAt||0).getTime()>=new Date(rec.notificationAt).getTime()){performanceFinalize(rec,t.reentryResult,t.reentryResult==='WIN'?rec.target:rec.stop,new Date(t.reentryResultAt).getTime()||now,'tracker fallback');continue}}
    const px=realtimeBestPrice(rec.symbol)||markPrices.get(rec.symbol);if(px)performanceOnPrice(rec.symbol,px,now,'heartbeat fallback');
  }
}
function performancePercentile(values,p=.95){const a=values.map(Number).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;return a[Math.min(a.length-1,Math.max(0,Math.floor((a.length-1)*p)))]}
function performanceCalibration(input){
  const rows=input.filter(x=>x?.version==='V10.0'&&x.status==='RESOLVED'&&Number.isFinite(Number(x.calibratedWinRate)));if(!rows.length)return {sample:0,brierScore:null,meanPredicted:null,actualHitRate:null,gapPct:null,calibrationMaePct:null,bins:[]};
  const bins=[{key:'<55%',lo:0,hi:55},{key:'55–59%',lo:55,hi:60},{key:'60–64%',lo:60,hi:65},{key:'65–69%',lo:65,hi:70},{key:'70%+',lo:70,hi:101}],bucket=[];let brier=0,predSum=0;
  for(const x of rows){const p=Math.max(0,Math.min(1,Number(x.calibratedWinRate)/100)),y=x.result==='WIN'?1:0;brier+=(p-y)**2;predSum+=p;}
  for(const b of bins){const a=rows.filter(x=>Number(x.calibratedWinRate)>=b.lo&&Number(x.calibratedWinRate)<b.hi);if(!a.length)continue;const predicted=a.reduce((z,x)=>z+Number(x.calibratedWinRate),0)/a.length,actual=a.filter(x=>x.result==='WIN').length/a.length*100;bucket.push({key:b.key,sample:a.length,predicted:Number(predicted.toFixed(1)),actual:Number(actual.toFixed(1)),gapPct:Number((actual-predicted).toFixed(1))});}
  const meanPred=predSum/rows.length*100,actual=rows.filter(x=>x.result==='WIN').length/rows.length*100,mae=bucket.reduce((a,x)=>a+Math.abs(x.actual-x.predicted)*x.sample,0)/rows.length;
  return {sample:rows.length,brierScore:Number((brier/rows.length).toFixed(4)),meanPredicted:Number(meanPred.toFixed(1)),actualHitRate:Number(actual.toFixed(1)),gapPct:Number((actual-meanPred).toFixed(1)),calibrationMaePct:Number(mae.toFixed(1)),bins:bucket};
}
function performanceGroup(rows,keyFn){const m=new Map();for(const x of rows){const k=String(keyFn(x)||'UNKNOWN');if(!m.has(k))m.set(k,[]);m.get(k).push(x)}return [...m.entries()].map(([key,a])=>({key,...performanceAggregate(a,false)})).sort((a,b)=>b.sample-a.sample)}
function performanceAggregate(input=signalPerformance,includeBreakdowns=true){
  const all=input.filter(x=>x?.version==='V10.0'),resolved=all.filter(x=>x.status==='RESOLVED'),binary=resolved.filter(x=>['WIN','LOSS'].includes(x.result)),wins=resolved.filter(x=>x.result==='WIN').length,losses=resolved.filter(x=>x.result==='LOSS').length;
  const avg=(arr,fn)=>arr.length?arr.reduce((a,x)=>a+Number(fn(x)||0),0)/arr.length:null,profits=resolved.map(x=>Number(x.realizedR||0)).filter(x=>x>0).reduce((a,b)=>a+b,0),lossSum=Math.abs(resolved.map(x=>Number(x.realizedR||0)).filter(x=>x<0).reduce((a,b)=>a+b,0));
  const recv=all.filter(x=>Number.isFinite(Number(x.deliveryLatencyMs))),clicks=all.filter(x=>Number.isFinite(Number(x.clickLatencyMs))),signalLag=all.map(x=>Number(x.signalToPushMs)).filter(Number.isFinite),pushMs=all.map(x=>Number(x.pushServiceMs)).filter(Number.isFinite);
  const base={sample:all.length,active:all.length-resolved.length,resolved:resolved.length,wins,losses,timeouts:resolved.filter(x=>x.result==='TIMEOUT').length,hitRate:resolved.length?Number((wins/resolved.length*100).toFixed(1)):null,decisiveHitRate:binary.length?Number((binary.filter(x=>x.result==='WIN').length/binary.length*100).toFixed(1)):null,profitFactor:lossSum>0?Number((profits/lossSum).toFixed(2)):(profits>0?99:null),expectancyR:resolved.length?Number(avg(resolved,x=>x.realizedR).toFixed(3)):null,avgGrossReturnPct:resolved.length?Number(avg(resolved,x=>x.grossReturnPct).toFixed(3)):null,avgNetReturnPct:resolved.length?Number(avg(resolved,x=>x.netReturnPct).toFixed(3)):null,avgMfePct:all.length?Number(avg(all,x=>x.mfePct).toFixed(3)):null,avgMaePct:all.length?Number(avg(all,x=>x.maePct).toFixed(3)):null,cumulativeGrossReturnPct:resolved.length?Number(resolved.reduce((a,x)=>a+Number(x.grossReturnPct||0),0).toFixed(4)):0,cumulativePer1000Notional:resolved.length?Number(resolved.reduce((a,x)=>a+1000*Number(x.netReturnPct||0)/100,0).toFixed(2)):0,receivedAcks:recv.length,deliveryAckRate:all.length?Number((recv.length/all.length*100).toFixed(1)):null,avgDeliveryLatencyMs:recv.length?Math.round(avg(recv,x=>x.deliveryLatencyMs)):null,p95DeliveryLatencyMs:recv.length?Math.round(performancePercentile(recv.map(x=>x.deliveryLatencyMs),.95)):null,clicked:clicks.length,clickRate:recv.length?Number((clicks.length/recv.length*100).toFixed(1)):null,avgClickLatencyMs:clicks.length?Math.round(avg(clicks,x=>x.clickLatencyMs)):null,avgSignalToPushMs:signalLag.length?Math.round(signalLag.reduce((a,b)=>a+b,0)/signalLag.length):null,p95SignalToPushMs:signalLag.length?Math.round(performancePercentile(signalLag,.95)):null,avgPushServiceMs:pushMs.length?Math.round(pushMs.reduce((a,b)=>a+b,0)/pushMs.length):null,p95PushServiceMs:pushMs.length?Math.round(performancePercentile(pushMs,.95)):null,calibration:performanceCalibration(all)};
  if(!includeBreakdowns)return base;return {...base,byTier:performanceGroup(all,x=>x.tier),byDirection:performanceGroup(all,x=>x.direction),byRegime:performanceGroup(all,x=>x.marketRegime),byStrategy:performanceGroup(all,x=>x.strategyLabel||x.strategyId||'未分類'),bySymbol:performanceGroup(all,x=>x.symbol).slice(0,20)};
}
function performanceResponse(){return {ok:true,generatedAt:new Date().toISOString(),version:'V10.0',preciseSampleStarts:'V10.0 deployment',defaultCostBps:PERF_ROUND_TRIP_COST_BPS,maxHorizonMinutes:Math.round(PERF_MAX_HORIZON_MS/60000),summary:performanceAggregate(),records:signalPerformance.filter(x=>x.version==='V10.0').slice(0,500),recent:signalPerformance.filter(x=>x.version==='V10.0').slice(0,100),methodology:'只統計真正成功送出的進場型通知；以通知當下即時成交/Mark作可執行參考進場，WebSocket逐筆追蹤目標/停損首觸、MFE/MAE與5～240分鐘報酬。Service Worker 會回報手機收到推播與點擊時間；WS失聯則以 Mark/5分K保守備援。統計是通知策略的實測表現，不冒充使用者帳戶真實成交損益。'};}

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
function cleanBriefInterval(_value) { return 24; }
function cleanTestSignalNotifyMode(value) {
  const v=String(value||'HIGH_NORMAL').toUpperCase();
  return ['HIGH','HIGH_NORMAL','ALL'].includes(v)?v:'HIGH_NORMAL';
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
      testSignalEnabled: x.testSignalEnabled === true,
      testSignalNotifyMode: cleanTestSignalNotifyMode(x.testSignalNotifyMode),
      dailyBriefIntervalHours: cleanBriefInterval(x.dailyBriefIntervalHours),
      lastDailyBriefPushAt: x.lastDailyBriefPushAt || null,
      lastDailyBriefPushDay: x.lastDailyBriefPushDay || null,
      preferenceVersion:100,
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
      testSignalEnabled: false,
      testSignalNotifyMode: 'HIGH_NORMAL',
      dailyBriefIntervalHours: 24,
      lastDailyBriefPushAt: null,
      lastDailyBriefPushDay: null,
      preferenceVersion:100,
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
  if (target.testSignal === true) {
    if(rec?.testSignalEnabled !== true) return false;
    const mode=cleanTestSignalNotifyMode(rec?.testSignalNotifyMode);
    const tier=String(target.testSignalTier||'VALID').toUpperCase();
    if(mode==='HIGH') return tier==='HIGH';
    if(mode==='HIGH_NORMAL') return tier==='HIGH'||tier==='NORMAL';
    return tier!=='BLOCKED';
  }

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
  let eligible=0,sent=0,failed=0,filtered=0;

  for (const rec of records) {
    if (!subscriptionAllows(rec, target)) {
      filtered++;
      keep.push(rec);
      continue;
    }
    eligible++;
    try {
      await webpush.sendNotification(
        rec.subscription,
        JSON.stringify(payload),
        { TTL: 90, urgency: 'high' }
      );
      sent++;
      keep.push(rec);
    } catch (e) {
      failed++;
      if (![404, 410].includes(e.statusCode)) keep.push(rec);
    }
  }

  if (keep.length !== records.length) saveSubRecords(keep);
  return {records:records.length,eligible,sent,failed,filtered};
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
    let biasLabel = '偏多觀察';
    if (flowScore >= 0 && momentumScore >= 0) {
      bias = 'LONG';
      biasLabel = '偏多';
    } else if (flowScore >= 0 && momentumScore < 0) {
      bias = 'LONG_WATCH';
      biasLabel = '偏多觀察';
    } else if (flowScore < 0 && momentumScore >= 0) {
      bias = 'SHORT_WATCH';
      biasLabel = '偏空觀察';
    } else {
      bias = 'SHORT';
      biasLabel = '偏空';
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
    LONG: { key: 'LONG', label: '偏多', sub: '資金流入 + 價格上漲', className: 'long' },
    LONG_WATCH: { key: 'LONG_WATCH', label: '偏多觀察', sub: '資金流入 + 價格下跌', className: 'longWatch' },
    SHORT_WATCH: { key: 'SHORT_WATCH', label: '偏空觀察', sub: '資金流出 + 價格上漲', className: 'shortWatch' },
    SHORT: { key: 'SHORT', label: '偏空', sub: '資金流出 + 價格下跌', className: 'short' },
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

function ideaAdxSeries(candles, period = 14) {
  const n = candles.length, plusDM = Array(n).fill(0), minusDM = Array(n).fill(0), tr = Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const up = candles[i].high - candles[i-1].high, down = candles[i-1].low - candles[i].low;
    plusDM[i] = up > down && up > 0 ? up : 0;
    minusDM[i] = down > up && down > 0 ? down : 0;
    tr[i] = Math.max(candles[i].high-candles[i].low, Math.abs(candles[i].high-candles[i-1].close), Math.abs(candles[i].low-candles[i-1].close));
  }
  const adx=Array(n).fill(null), plusDI=Array(n).fill(null), minusDI=Array(n).fill(null), dx=Array(n).fill(null);
  if (n <= period * 2) return { adx, plusDI, minusDI, dx };
  let trS=0,pS=0,mS=0;
  for(let i=1;i<=period;i++){trS+=tr[i];pS+=plusDM[i];mS+=minusDM[i]}
  for(let i=period;i<n;i++){
    if(i>period){trS=trS-trS/period+tr[i];pS=pS-pS/period+plusDM[i];mS=mS-mS/period+minusDM[i]}
    if(trS>0){plusDI[i]=100*pS/trS;minusDI[i]=100*mS/trS;const den=plusDI[i]+minusDI[i];dx[i]=den>0?100*Math.abs(plusDI[i]-minusDI[i])/den:0}
  }
  let dxSum=0,dxN=0;
  for(let i=period;i<period*2&&i<n;i++){if(Number.isFinite(dx[i])){dxSum+=dx[i];dxN++}}
  if(dxN){adx[period*2-1]=dxSum/dxN;for(let i=period*2;i<n;i++){adx[i]=((adx[i-1]??dx[i])* (period-1) + (dx[i]??0))/period}}
  return { adx, plusDI, minusDI, dx };
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

async function ideaFetchJson(url, timeoutMs = 8000, attempts = 2) {
  let lastError = null;
  for (let attempt = 0; attempt < Math.max(1, attempts); attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await fetch(url, {
        headers:{accept:'application/json','cache-control':'no-cache','user-agent':'Mozilla/5.0 PositionAlert/10.0'},
        signal:controller.signal
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      if (json && typeof json === 'object' && ('retCode' in json) && Number(json.retCode) !== 0) throw new Error(`BYBIT ${json.retCode}: ${json.retMsg||'error'}`);
      if (json && typeof json === 'object' && ('code' in json) && String(json.code) !== '0' && !Array.isArray(json)) throw new Error(`API ${json.code}: ${json.msg||json.message||'error'}`);
      return json;
    } catch (e) {
      lastError = e;
      if (attempt + 1 < Math.max(1, attempts)) await new Promise(r=>setTimeout(r, 180 + attempt * 220));
    } finally { clearTimeout(timeout); }
  }
  throw lastError || new Error('FETCH_FAILED');
}

function intervalMs(interval) {
  const map={ '1m':60000,'3m':180000,'5m':300000,'15m':900000,'30m':1800000,'1h':3600000,'2h':7200000,'4h':14400000,'1d':86400000 };
  return map[String(interval||'').toLowerCase()] || 0;
}
function bybitInterval(interval){ return ({'1m':'1','3m':'3','5m':'5','15m':'15','30m':'30','1h':'60','2h':'120','4h':'240','1d':'D'})[String(interval||'').toLowerCase()] || null; }
function okxBar(interval){ return ({'1m':'1m','3m':'3m','5m':'5m','15m':'15m','30m':'30m','1h':'1H','2h':'2H','4h':'4H','1d':'1D'})[String(interval||'').toLowerCase()] || null; }
function okxSwapSymbol(symbol){ const s=cleanFuturesSymbol(symbol); return s.endsWith('USDT') ? `${s.slice(0,-4)}-USDT-SWAP` : ''; }
function externalSymbolCandidates(symbol){
  const key=cleanFuturesSymbol(symbol),base=key.endsWith('USDT')?key.slice(0,-4):key,out=[{symbol:key,scale:1}];
  const m=base.match(/^(1000000|100000|10000|1000)([A-Z].+)$/);if(m)out.push({symbol:`${m[2]}USDT`,scale:Number(m[1])});return out;
}
function okxCandidates(symbol){return externalSymbolCandidates(symbol).map(x=>({instId:okxSwapSymbol(x.symbol),scale:x.scale,symbol:x.symbol})).filter(x=>x.instId)}
function scaleCandles(rows,scale){if(!(scale>0)||scale===1)return rows;return rows.map(x=>({...x,open:x.open*scale,high:x.high*scale,low:x.low*scale,close:x.close*scale}))}
function parseExternalKlineRow(row, interval) {
  if (!Array.isArray(row) || row.length < 6) return null;
  const openTime=Number(row[0]),open=Number(row[1]),high=Number(row[2]),low=Number(row[3]),close=Number(row[4]),volume=Number(row[5]||0);
  if (![openTime,open,high,low,close].every(Number.isFinite) || !(high>0&&low>0&&close>0) || high<low) return null;
  const ms=intervalMs(interval),closeTime=ms>0?openTime+ms-1:0;
  return {openTime,open,high,low,close,volume:Number.isFinite(volume)?volume:0,closeTime};
}
async function fetchBybitCandles(symbol, interval, limit=240) {
  const iv=bybitInterval(interval); if(!iv) throw new Error('BYBIT_INTERVAL_UNSUPPORTED');
  const lim=Math.max(80,Math.min(1000,Number(limit)||240));let lastError=null;
  for(const cand of externalSymbolCandidates(symbol))try{
    const json=await ideaFetchJson(`${BYBIT_API}/v5/market/kline?category=linear&symbol=${encodeURIComponent(cand.symbol)}&interval=${encodeURIComponent(iv)}&limit=${lim}`,8500,2);
    const rows=Array.isArray(json?.result?.list)?json.result.list.map(r=>parseExternalKlineRow(r,interval)).filter(Boolean).sort((a,b)=>a.openTime-b.openTime):[];
    if(rows.length<80)throw new Error(`${cand.symbol} ${interval} Bybit candles too short`);return scaleCandles(rows,cand.scale);
  }catch(e){lastError=e}
  throw lastError||new Error(`${symbol} Bybit candles unavailable`);
}
async function fetchOkxCandles(symbol, interval, limit=240) {
  const bar=okxBar(interval);if(!bar)throw new Error('OKX_INTERVAL_UNSUPPORTED');const lim=Math.max(80,Math.min(300,Number(limit)||240));let lastError=null;
  for(const cand of okxCandidates(symbol))try{
    const json=await ideaFetchJson(`${OKX_API}/api/v5/market/candles?instId=${encodeURIComponent(cand.instId)}&bar=${encodeURIComponent(bar)}&limit=${lim}`,8500,2);
    const rows=Array.isArray(json?.data)?json.data.map(r=>parseExternalKlineRow(r,interval)).filter(Boolean).sort((a,b)=>a.openTime-b.openTime):[];
    if(rows.length<80)throw new Error(`${cand.instId} ${interval} OKX candles too short`);return scaleCandles(rows,cand.scale);
  }catch(e){lastError=e}
  throw lastError||new Error('OKX_SYMBOL_UNSUPPORTED');
}
async function fetchIdeaCandles(symbol, interval, limit = 240) {
  const key=`${cleanFuturesSymbol(symbol)}:${interval}:${limit}`;
  try {
    const json = await ideaFetchJson(`${KLINE_URL}?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`,8000,2);
    const candles = Array.isArray(json) ? json.map(parseKlineRow).filter(Boolean) : [];
    if (candles.length < 80) throw new Error(`${symbol} ${interval} Binance candles too short`);
    testCandleSourceCache.set(key,{source:'Binance',fallback:false,at:Date.now()});
    return candles;
  } catch (binanceError) {
    if (!ENABLE_CROSS_EXCHANGE) throw binanceError;
    try {
      const rows=await fetchBybitCandles(symbol,interval,limit);testCandleSourceCache.set(key,{source:'Bybit',fallback:true,at:Date.now(),binanceError:String(binanceError?.message||binanceError)});return rows;
    } catch (bybitError) {
      try {
        const rows=await fetchOkxCandles(symbol,interval,limit);testCandleSourceCache.set(key,{source:'OKX',fallback:true,at:Date.now(),binanceError:String(binanceError?.message||binanceError),bybitError:String(bybitError?.message||bybitError)});return rows;
      } catch (okxError) {
        testCandleSourceCache.set(key,{source:null,fallback:false,failed:true,at:Date.now(),error:`Binance ${String(binanceError?.message||binanceError)}; Bybit ${String(bybitError?.message||bybitError)}; OKX ${String(okxError?.message||okxError)}`});
        throw okxError;
      }
    }
  }
}

function ratioLast(rows, key = 'longShortRatio') {
  if (!Array.isArray(rows) || !rows.length) return null;
  const ordered=rows.some(x=>x?.timestamp!=null)?[...rows].sort((a,b)=>Number(a?.timestamp||0)-Number(b?.timestamp||0)):rows;
  return finiteMetric(ordered.at(-1)?.[key]);
}

function ratioChangePct(rows, key) {
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const ordered=rows.some(x=>x?.timestamp!=null)?[...rows].sort((a,b)=>Number(a?.timestamp||0)-Number(b?.timestamp||0)):rows;
  const a=finiteMetric(ordered[0]?.[key]),b=finiteMetric(ordered.at(-1)?.[key]);
  if (a==null || !(a > 0) || b==null) return null;
  return (b / a - 1) * 100;
}
function ratioRecentChangePct(rows,key,barsAgo=1){
  if(!Array.isArray(rows)||rows.length<2)return null;const ordered=rows.some(x=>x?.timestamp!=null)?[...rows].sort((a,b)=>Number(a?.timestamp||0)-Number(b?.timestamp||0)):rows,idx=Math.max(0,ordered.length-1-Math.max(1,Number(barsAgo)||1)),a=finiteMetric(ordered[idx]?.[key]),b=finiteMetric(ordered.at(-1)?.[key]);if(a==null||!(a>0)||b==null)return null;return (b/a-1)*100;
}

function technicalSnapshot(candles) {
  const closes = candles.map(x => x.close), vols = candles.map(x => Number(x.volume || 0));
  const ema20s = ideaEmaSeries(closes, 20), ema50s = ideaEmaSeries(closes, 50), rsi = ideaRsiSeries(closes, 14), macd = ideaMacdSeries(closes), atr = ideaAtrSeries(candles, 14), adx = ideaAdxSeries(candles, 14);
  const i = closes.length - 1, close = closes[i], ema20 = ema20s[i], ema50 = ema50s[i], rsi14 = latestFinite(rsi), macdHist = latestFinite(macd.hist), atr14 = latestFinite(atr), adx14 = latestFinite(adx.adx), plusDI = latestFinite(adx.plusDI), minusDI = latestFinite(adx.minusDI);
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
  return { close, ema20, ema50, rsi14, macdHist, atr14, adx14, plusDI, minusDI, diBias:(plusDI??0)>(minusDI??0)?1:(minusDI??0)>(plusDI??0)?-1:0, atrPct:atr14&&close?atr14/close*100:null, volumeRatio, breakout, trend, momentum, poc, pocSignal };
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
  const oiCh=finiteMetric(deriv.oiChangePct),taker=finiteMetric(deriv.takerRatio),top=finiteMetric(deriv.topRatio),global=finiteMetric(deriv.globalRatio);
  const oiDir = oiCh==null?0:oiCh > 1.2 ? Math.sign(row.changePct||0) : oiCh < -1.2 ? -Math.sign(row.changePct||0) : 0;
  if(oiCh!=null)add('OI', oiDir, 9, `${oiCh>0?'+':''}${oiCh.toFixed(1)}%`);else signals.push({name:'OI',value:0,weight:0,detail:'缺資料'});
  if(taker!=null)add('主動買賣', taker>1.04?1:taker<0.96?-1:0, 10, `${taker.toFixed(2)}`);else signals.push({name:'主動買賣',value:0,weight:0,detail:'缺資料'});
  if(top!=null)add('大戶部位', top>1.08?1:top<0.92?-1:0, 8, `${top.toFixed(2)}`);else signals.push({name:'大戶部位',value:0,weight:0,detail:'缺資料'});
  if(global!=null)add('全市場多空', global>1.08?1:global<0.92?-1:0, 5, `${global.toFixed(2)}`);else signals.push({name:'全市場多空',value:0,weight:0,detail:'缺資料'});
  const funding=finiteMetric(row.fundingPct);
  const crowd = funding!=null&&Math.abs(funding)>=0.08 ? (funding>0?-1:1) : 0;
  if(funding!=null)add('資金費擁擠', crowd, 6, `${funding>0?'+':''}${funding.toFixed(4)}%`);else signals.push({name:'資金費擁擠',value:0,weight:0,detail:'缺資料'});
  const volumeSignal=t15.volumeRatio>=1.35 ? Math.sign(row.changePct||0) : 0;
  add('量能', volumeSignal, 7, `${t15.volumeRatio.toFixed(2)}x`);
  const direction = signed >= 12 ? 'LONG' : signed <= -12 ? 'SHORT' : 'WAIT';
  const directionalStrength = Math.min(100, Math.round(50 + Math.abs(signed)*0.65));
  const coverage = Math.min(100, Math.round(quality));
  return { direction, signed:Number(signed.toFixed(1)), modelScore:Math.round(directionalStrength*0.8+coverage*0.2), signals };
}


const SYMBOL_PROJECT_PROFILES = {
  BTC:{sector:'比特幣 / 儲值資產',purpose:'去中心化價值儲存與鏈上結算'},
  ETH:{sector:'L1 / 智能合約',purpose:'承載 DeFi、NFT、Rollup 與鏈上應用'},
  BNB:{sector:'L1 / 交易所生態',purpose:'BNB Chain Gas、鏈上應用與 Binance 生態用途'},
  SOL:{sector:'L1 / 高效能公鏈',purpose:'高吞吐智能合約、DeFi、支付與消費型應用'},
  XRP:{sector:'支付 / 跨境結算',purpose:'跨境價值轉移與金融機構結算'},
  ADA:{sector:'L1 / 智能合約',purpose:'PoS 公鏈與去中心化應用基礎設施'},
  AVAX:{sector:'L1 / 子網',purpose:'智能合約、公鏈與可客製化鏈網路'},
  SUI:{sector:'L1 / Move 生態',purpose:'高效能鏈上應用、遊戲與資產交易'},
  APT:{sector:'L1 / Move 生態',purpose:'高吞吐智能合約與鏈上應用'},
  TON:{sector:'L1 / 社交生態',purpose:'Telegram 生態支付、應用與鏈上資產'},
  TRX:{sector:'L1 / 支付',purpose:'穩定幣轉帳與低成本鏈上支付'},
  LINK:{sector:'Oracle / 基礎設施',purpose:'把鏈外資料與跨鏈訊息提供給智能合約'},
  UNI:{sector:'DeFi / DEX',purpose:'Uniswap 去中心化交易與流動性協議治理'},
  AAVE:{sector:'DeFi / 借貸',purpose:'去中心化借貸、抵押與流動性市場'},
  HYPE:{sector:'DeFi / 永續合約',purpose:'Hyperliquid 鏈上交易與永續合約生態'},
  ZEC:{sector:'隱私 / 支付',purpose:'使用零知識證明提供可選擇的隱私轉帳'},
  LTC:{sector:'支付 / PoW',purpose:'低成本點對點轉帳與支付'},
  BCH:{sector:'支付 / PoW',purpose:'以較大區塊支援點對點現金型支付'},
  XLM:{sector:'支付 / 跨境結算',purpose:'跨境支付、資產發行與金融接軌'},
  PENDLE:{sector:'DeFi / 收益交易',purpose:'拆分並交易固定收益與收益權'},
  ENA:{sector:'DeFi / 合成美元',purpose:'Ethena 合成美元與收益型穩定資產生態'},
  ONDO:{sector:'RWA / DeFi',purpose:'把美債等現實世界資產代幣化上鏈'},
  TAO:{sector:'AI / 去中心化運算',purpose:'Bittensor 去中心化機器學習與模型激勵網路'},
  WLD:{sector:'身份 / AI',purpose:'人類身份驗證與 World 生態支付/應用'},
  SEI:{sector:'L1 / 交易型公鏈',purpose:'針對交易與高頻鏈上應用最佳化'},
  HBAR:{sector:'企業 DLT',purpose:'Hashgraph 共識、企業級代幣化與應用'},
  ETC:{sector:'L1 / PoW',purpose:'Ethereum Classic 智能合約與不可逆鏈歷史'},
  NEAR:{sector:'L1 / 智能合約',purpose:'易用型智能合約、鏈抽象與應用基礎設施'},
  DOT:{sector:'跨鏈 / 基礎設施',purpose:'Polkadot 多鏈互通與共享安全'},
  ATOM:{sector:'跨鏈 / Cosmos',purpose:'Cosmos 生態跨鏈互通與應用鏈'},
  ARB:{sector:'L2 / Ethereum',purpose:'Arbitrum Rollup 擴容與 DeFi 生態'},
  OP:{sector:'L2 / Ethereum',purpose:'Optimism Rollup 與 Superchain 生態'},
  POL:{sector:'L2 / Polygon',purpose:'Polygon 生態擴容、質押與鏈間協作'},
  CRV:{sector:'DeFi / 穩定幣 DEX',purpose:'Curve 穩定資產交易與流動性'},
  LDO:{sector:'DeFi / 流動質押',purpose:'Lido 流動質押與 stETH 生態治理'},
  RUNE:{sector:'DeFi / 跨鏈 DEX',purpose:'THORChain 原生資產跨鏈交換'},
  FIL:{sector:'DePIN / 儲存',purpose:'去中心化檔案儲存與資料市場'},
  ICP:{sector:'去中心化運算',purpose:'鏈上運算、網站與後端服務'},
  FET:{sector:'AI / Agent',purpose:'AI Agent、自動化與去中心化 AI 生態'},
  RENDER:{sector:'AI / GPU / DePIN',purpose:'分散式 GPU 算力與渲染工作'},
  INJ:{sector:'DeFi / L1',purpose:'交易、衍生品與金融型鏈上應用'},
  KAS:{sector:'PoW / DAG',purpose:'高吞吐 PoW 支付與區塊 DAG 網路'},
  DOGE:{sector:'迷因 / 支付',purpose:'社群型 PoW 代幣與小額支付'},
  PEPE:{sector:'迷因',purpose:'以社群與敘事驅動的高波動迷因代幣'},
  WIF:{sector:'迷因 / Solana',purpose:'Solana 生態社群型迷因代幣'},
  BONK:{sector:'迷因 / Solana',purpose:'Solana 社群型迷因與生態代幣'},
  TRUMP:{sector:'迷因 / 政治敘事',purpose:'以名人與政治敘事驅動的高波動代幣'},
  SHIB:{sector:'迷因 / 生態',purpose:'社群型迷因代幣與 Shibarium 生態'},
  FLOKI:{sector:'迷因 / 生態',purpose:'社群型迷因代幣與遊戲/應用生態'},
  W:{sector:'跨鏈 / 基礎設施',purpose:'Wormhole 跨鏈訊息與資產傳遞'},
  JUP:{sector:'DeFi / Solana DEX',purpose:'Solana 聚合交易、永續與流動性產品'},
  PYTH:{sector:'Oracle',purpose:'為鏈上應用提供低延遲市場價格資料'},
  TIA:{sector:'模組化區塊鏈',purpose:'資料可用性層，支援 Rollup 與模組化鏈'},
  EIGEN:{sector:'再質押 / 基礎設施',purpose:'EigenLayer 再質押與共享安全服務'},
  S:{sector:'L1 / Sonic',purpose:'Sonic 高效能 EVM 公鏈與 DeFi 生態'},
};
function symbolBaseAsset(symbol){
  const raw=String(symbol||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/USDT$/,'');
  if(raw.startsWith('1000')&&SYMBOL_PROJECT_PROFILES[raw.slice(4)])return raw.slice(4);
  return raw;
}
function symbolProjectProfile(symbol){
  const base=symbolBaseAsset(symbol), known=SYMBOL_PROJECT_PROFILES[base];
  if(known)return {base,sector:known.sector,purpose:known.purpose,known:true};
  return {base,sector:'其他 / 新興加密資產',purpose:'題材與用途變動較快；展開詳細可用即時網搜確認專案定位與今日催化',known:false};
}

async function analyzeIdeaSymbol(row) {
  const symbol=row.symbol;
  const [c15,c1h,rawDeriv] = await Promise.all([
    fetchIdeaCandles(symbol,'15m',240), fetchIdeaCandles(symbol,'1h',240),
    testFetchDerivatives(symbol).catch(()=>null),
  ]);
  const t15=technicalSnapshot(c15), t1h=technicalSnapshot(c1h);
  const deriv={
    oiChangePct:finiteMetric(rawDeriv?.oiChangePct),
    globalRatio:finiteMetric(rawDeriv?.globalLongShortRatio),
    topRatio:finiteMetric(rawDeriv?.topPositionRatio),
    takerRatio:finiteMetric(rawDeriv?.takerRatio),
    source:rawDeriv?._source||null,
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
    profile:symbolProjectProfile(symbol),
    metrics:{ rsi15:finiteMetric(t15.rsi14)!=null?Number(t15.rsi14.toFixed(1)):null, rsi1h:finiteMetric(t1h.rsi14)!=null?Number(t1h.rsi14.toFixed(1)):null, volumeRatio:finiteMetric(t15.volumeRatio)!=null?Number(t15.volumeRatio.toFixed(2)):null, oiChangePct:finiteMetric(deriv.oiChangePct)!=null?Number(deriv.oiChangePct.toFixed(2)):null, globalRatio:deriv.globalRatio, topRatio:deriv.topRatio, takerRatio:deriv.takerRatio, sources:deriv.source },
  };
}

async function mapPool(items, concurrency, fn) {
  const out=Array(items.length); let cursor=0;
  const worker=async()=>{ while(true){ const i=cursor++; if(i>=items.length) return; try{out[i]=await fn(items[i],i)}catch(e){out[i]={error:String(e?.message||e),symbol:items[i]?.symbol}} } };
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},()=>worker()));
  return out;
}

async function fetchRankedIdeasFresh() {
  const flow=await getMarketFlow(),radar=realtimeRadarCandidates(RADAR_MAX_SYMBOLS),merged=new Map();
  for(const x of [...radar,...(flow.leaders||[])])if(x?.symbol&&!merged.has(x.symbol))merged.set(x.symbol,x);
  const candidates=[...merged.values()].sort((a,b)=>Number(b.activityScore||0)-Number(a.activityScore||0)||Number(b.quoteVolume||0)-Number(a.quoteVolume||0)).slice(0,IDEA_SYMBOLS);
  const analyzed=await mapPool(candidates,IDEA_CONCURRENCY,analyzeIdeaSymbol);
  const rows=analyzed.filter(x=>x && !x.error && x.direction!=='WAIT').sort((a,b)=>b.rankScore-a.rankScore || b.estimatedWinRate-a.estimatedWinRate || b.quoteVolume-a.quoteVolume);
  return { ok:true, generatedAt:new Date().toISOString(), methodology:'V10：全市場WS雷達先掃描，僅對前段候選做 15m+1h EMA/RSI/MACD/ATR/volume + OI + taker + top/global L/S + funding + backtest 深度分析', radar:realtimeRadarSummary(), analyzed:candidates.length, rows:rows.slice(0,12), errors:analyzed.filter(x=>x?.error).length };
}

async function getRankedIdeas() {
  const now=Date.now();
  if(rankedIdeasCache.data && now-rankedIdeasCache.at<IDEA_CACHE_MS)return {...rankedIdeasCache.data,stale:false,cacheAgeMs:now-rankedIdeasCache.at};
  if(!rankedIdeasCache.inflight){
    rankedIdeasCache.inflight=fetchRankedIdeasFresh().then(data=>{rankedIdeasCache={at:Date.now(),lastGoodAt:Date.now(),data,error:null,inflight:null};return data}).catch(e=>{rankedIdeasCache.error=String(e?.message||e);rankedIdeasCache.inflight=null;throw e});
  }
  try{return {...await rankedIdeasCache.inflight,stale:false,cacheAgeMs:0}}catch(e){if(rankedIdeasCache.data&&now-rankedIdeasCache.lastGoodAt<IDEA_STALE_MS)return {...rankedIdeasCache.data,stale:true,error:rankedIdeasCache.error,cacheAgeMs:now-rankedIdeasCache.lastGoodAt};throw e}
}


function testSignalKey(symbol, direction) {
  return `${cleanFuturesSymbol(symbol)}:${direction === 'SHORT' ? 'SHORT' : 'LONG'}`;
}
function testSignalDirection(direction) { return direction === 'SHORT' ? -1 : 1; }
function testSignalStatusLabel(status) {
  return ({
    WAIT_PULLBACK:'觀察中', TOUCHING:'接近完成', CONFIRMED:'進場確認',
    WIN:'1R達成', LOSS:'失效', TIMEOUT:'90分逾時', INVALID:'失效', DROPPED:'移出監控', EXPIRED:'排名移出',
  })[status] || '等待';
}
function testTrackerStatusLabel(t) {
  if(t?.status==='CONFIRMED'){
    if(t.reentryStage==='WIN')return '二次1R達成';
    if(t.reentryStage==='FAILED')return '二次進場失效';
    if(t.reentryStage==='READY')return '二次進場確認';
    if(t.reentryStage==='TOUCHING')return '二次回踩中';
    if(t.reentryStage==='WAIT_PULLBACK')return '等待二次回踩';
  }
  return testSignalStatusLabel(t?.status);
}
function testMonitorStateLabel(state, status='CONFIRMED') {
  if(status==='WIN') return '達標';
  if(status==='LOSS'||status==='INVALID') return '失效';
  if(status==='DROPPED') return '移出';
  if(status==='TIMEOUT') return '逾時';
  return ({STRONG:'強勢',CONTINUING:'續強',WEAKENING:'轉弱',RECOVERING:'轉強',CONFIRMED:'成立',WATCHING:'等待',TARGET:'達標',REENTRY_WAIT:'等二進',REENTRY_TOUCH:'二次回踩',REENTRY_READY:'二次確認',REENTRY_WIN:'二進達標',REENTRY_FAILED:'二進失效',CONSOLIDATING:'盤整'})[state] || '成立';
}
function testMonitorStateClass(state, status='CONFIRMED') {
  if(status==='WIN') return 'win';
  if(status==='LOSS'||status==='INVALID'||status==='DROPPED') return 'invalid';
  return ({STRONG:'strong',CONTINUING:'continuing',WEAKENING:'weakening',RECOVERING:'recovering',CONFIRMED:'confirmed',TARGET:'win',REENTRY_WAIT:'watching',REENTRY_TOUCH:'touching',REENTRY_READY:'recovering',REENTRY_WIN:'win',REENTRY_FAILED:'invalid',CONSOLIDATING:'watching'})[state] || 'watching';
}
function persistTestSignals() {
  saveJson(TEST_SIGNAL_FILE, Object.fromEntries(testSignalTrackers));
  saveJson(TEST_SIGNAL_HISTORY_FILE, testSignalHistory.slice(0, 300));
}
function testMedian(values) {
  const a=(values||[]).map(Number).filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function testPercentile(values, q=.5) {
  const a=(values||[]).map(Number).filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return null;const pos=(a.length-1)*clamp(Number(q)||0,0,1),lo=Math.floor(pos),hi=Math.ceil(pos);
  if(lo===hi)return a[lo];return a[lo]+(a[hi]-a[lo])*(pos-lo);
}
function testWilsonInterval(wins, losses, z=1.96) {
  const n=Math.max(0,Number(wins||0)+Number(losses||0));if(!(n>0))return {low:null,high:null};
  const p=Number(wins||0)/n,z2=z*z,den=1+z2/n,center=(p+z2/(2*n))/den,margin=z*Math.sqrt((p*(1-p)+z2/(4*n))/n)/den;
  return {low:clamp((center-margin)*100,0,100),high:clamp((center+margin)*100,0,100)};
}
function testVwap(candles, lookback=48) {
  const rows=(candles||[]).slice(-lookback);let pv=0,v=0;
  for(const c of rows){const vol=Number(c.volume||0),typ=(c.high+c.low+c.close)/3;pv+=typ*vol;v+=vol}
  return v>0?pv/v:null;
}
function closedTestCandles(candles) {
  const now=Date.now();const rows=(candles||[]).filter(c=>!c.closeTime||c.closeTime<=now);
  return rows.length>=60?rows:(candles||[]).slice(0,-1);
}
async function testFetchCandles(symbol, interval, limit=500) {
  const key=`${symbol}:${interval}:${limit}`,now=Date.now(),cached=testCandleCache.get(key);
  if(cached&&now-cached.at<25000)return cached.rows;
  const rows=await fetchIdeaCandles(symbol,interval,limit);
  testCandleCache.set(key,{at:now,rows});
  return rows;
}
function findTestImpulse(candles, direction) {
  const rows=(candles||[]).slice(-56);if(rows.length<20)return null;
  let best=null;
  if(direction==='LONG'){
    let low=rows[0].low,lowI=0;
    for(let i=1;i<rows.length;i++){
      if(rows[i].low<low){low=rows[i].low;lowI=i}
      const range=rows[i].high-low;
      if(i-lowI>=3&&(!best||range>best.range))best={low,high:rows[i].high,lowI,highI:i,range};
    }
  }else{
    let high=rows[0].high,highI=0;
    for(let i=1;i<rows.length;i++){
      if(rows[i].high>high){high=rows[i].high;highI=i}
      const range=high-rows[i].low;
      if(i-highI>=3&&(!best||range>best.range))best={high,low:rows[i].low,highI,lowI:i,range};
    }
  }
  return best;
}
async function testFetchBacktestCandles(symbol, interval='5m', pages=2) {
  const safePages=Math.max(1,Math.min(3,Number(pages)||2));
  const key=`${symbol}:${interval}:${safePages}`,now=Date.now(),cached=testBacktestCandleCache.get(key);
  if(cached&&now-cached.at<15*60*1000)return cached.rows;
  const chunks=[];let endTime=null;
  for(let i=0;i<safePages;i++){
    const qs=new URLSearchParams({symbol:cleanFuturesSymbol(symbol),interval,limit:'1500'});
    if(Number.isFinite(endTime))qs.set('endTime',String(Math.floor(endTime)));
    const json=await ideaFetchJson(`${KLINE_URL}?${qs.toString()}`,10000);
    const part=Array.isArray(json)?json.map(parseKlineRow).filter(Boolean):[];
    if(!part.length)break;
    chunks.unshift(part);
    const first=Number(part[0]?.openTime);
    if(!Number.isFinite(first))break;
    endTime=first-1;
    if(part.length<1500)break;
  }
  const dedup=new Map();for(const c of chunks.flat())dedup.set(Number(c.openTime),c);
  const rows=[...dedup.values()].sort((a,b)=>Number(a.openTime)-Number(b.openTime));
  testBacktestCandleCache.set(key,{at:now,rows});
  return rows;
}
function testPullbackBacktest(candles, direction) {
  const rows=closedTestCandles(candles),closes=rows.map(x=>x.close),ema20=ideaEmaSeries(closes,20),ema50=ideaEmaSeries(closes,50),rsi=ideaRsiSeries(closes,14),macd=ideaMacdSeries(closes),atr=ideaAtrSeries(rows,14),adx=ideaAdxSeries(rows,14);
  const dir=testSignalDirection(direction),atrPcts=atr.map((a,i)=>Number.isFinite(a)&&closes[i]>0?a/closes[i]*100:null).filter(Number.isFinite),q33=testPercentile(atrPcts,.33),q67=testPercentile(atrPcts,.67);
  let wins=0,losses=0,timeouts=0,retSum=0,retN=0,posR=0,negR=0,avgRSum=0;
  const regimes={LOW:{wins:0,losses:0},NORMAL:{wins:0,losses:0},HIGH:{wins:0,losses:0}};
  const regimeOf=v=>!Number.isFinite(v)||!Number.isFinite(q33)||!Number.isFinite(q67)?'NORMAL':v<=q33?'LOW':v>=q67?'HIGH':'NORMAL';
  for(let i=80;i<rows.length-19;i++){
    const a=Number(atr[i]),atrPct=a/closes[i]*100,adxNow=Number(adx.adx[i]),diBias=Number(adx.plusDI[i]||0)>Number(adx.minusDI[i]||0)?1:Number(adx.minusDI[i]||0)>Number(adx.plusDI[i]||0)?-1:0;
    if(!(a>0)||!Number.isFinite(rsi[i])||!Number.isFinite(rsi[i-1]))continue;
    const trend=dir>0?(ema20[i]>ema50[i]&&closes[i]>ema50[i]):(ema20[i]<ema50[i]&&closes[i]<ema50[i]);
    if(!trend)continue;
    if(Number.isFinite(adxNow)&&adxNow>=24&&diBias===-dir)continue;
    const touched=dir>0?rows[i].low<=ema20[i]+0.20*a:rows[i].high>=ema20[i]-0.20*a;
    const reclaimed=dir>0?rows[i].close>ema20[i]:rows[i].close<ema20[i];
    const candleOk=dir>0?rows[i].close>rows[i].open:rows[i].close<rows[i].open;
    const momentum=dir>0?(rsi[i]>=44&&rsi[i]<=70&&rsi[i]>rsi[i-1]&&macd.hist[i]>macd.hist[i-1]):(rsi[i]<=56&&rsi[i]>=30&&rsi[i]<rsi[i-1]&&macd.hist[i]<macd.hist[i-1]);
    if(!(touched&&reclaimed&&candleOk&&momentum))continue;
    const entry=rows[i].close,risk=0.85*a,target=entry+dir*risk,stop=entry-dir*risk;
    let result=0;
    for(let j=i+1;j<=i+18;j++){
      const c=rows[j],hitStop=dir>0?c.low<=stop:c.high>=stop,hitTarget=dir>0?c.high>=target:c.low<=target;
      if(hitStop){result=-1;break}
      if(hitTarget){result=1;break}
    }
    const end=rows[Math.min(rows.length-1,i+18)].close,ret=dir*(end-entry)/entry*100,rMove=dir*(end-entry)/risk,reg=regimeOf(atrPct);
    retSum+=ret;retN++;avgRSum+=rMove;if(rMove>0)posR+=rMove;else negR+=Math.abs(rMove);
    if(result>0){wins++;regimes[reg].wins++}else if(result<0){losses++;regimes[reg].losses++}else timeouts++;
    i+=5;
  }
  const sample=wins+losses,hitRate=sample?wins/sample*100:null,avgReturnPct=retN?retSum/retN:null,avgR=retN?avgRSum/retN:null,pf=negR>0?posR/negR:(posR>0?9.9:null),smoothedHitRate=sample?((wins+8)/(sample+16))*100:null,ci=testWilsonInterval(wins,losses);
  const regimeStats={};for(const [k,v] of Object.entries(regimes)){const n=v.wins+v.losses,shrunk=n?((v.wins+5)/(n+10))*100:null;regimeStats[k]={...v,sample:n,hitRate:n?Number((v.wins/n*100).toFixed(1)):null,smoothedHitRate:Number.isFinite(shrunk)?Number(shrunk.toFixed(1)):null}}
  return {hitRate:Number.isFinite(hitRate)?Number(hitRate.toFixed(1)):null,smoothedHitRate:Number.isFinite(smoothedHitRate)?Number(smoothedHitRate.toFixed(1)):null,conservativeLow:Number.isFinite(ci.low)?Number(ci.low.toFixed(1)):null,confidenceHigh:Number.isFinite(ci.high)?Number(ci.high.toFixed(1)):null,sample,wins,losses,timeouts,avgReturnPct:Number.isFinite(avgReturnPct)?Number(avgReturnPct.toFixed(2)):null,avgR:Number.isFinite(avgR)?Number(avgR.toFixed(2)):null,profitFactor:Number.isFinite(pf)?Number(Math.min(9.9,pf).toFixed(2)):null,bars:rows.length,volatilityThresholds:{lowMax:q33,highMin:q67},regimes:regimeStats};
}
function buildTestSetup(idea, c5, c15, backtestCandles=c5) {
  const rows5=closedTestCandles(c5),rows15=closedTestCandles(c15),t5=technicalSnapshot(rows5),t15=technicalSnapshot(rows15),direction=idea.direction==='SHORT'?'SHORT':'LONG',dir=testSignalDirection(direction);
  const impulse=findTestImpulse(rows15,direction);if(!impulse||!(impulse.range>0))throw new Error('impulse unavailable');
  const atr15=Number(t15.atr14||0),atr5=Number(t5.atr14||0);if(!(atr15>0&&atr5>0))throw new Error('ATR unavailable');
  const fib38=direction==='LONG'?impulse.high-impulse.range*.382:impulse.low+impulse.range*.382;
  const fib61=direction==='LONG'?impulse.high-impulse.range*.618:impulse.low+impulse.range*.618;
  const fib786=direction==='LONG'?impulse.high-impulse.range*.786:impulse.low+impulse.range*.786;
  const zoneLow=Math.min(fib38,fib61),zoneHigh=Math.max(fib38,fib61),zoneMid=(zoneLow+zoneHigh)/2;
  const invalidation=direction==='LONG'?fib786-atr15*.10:fib786+atr15*.10;
  const vwap15=testVwap(rows15,64),levels=[t15.ema20,t15.poc,vwap15].filter(Number.isFinite),near=levels.filter(x=>x>=zoneLow-atr15*.22&&x<=zoneHigh+atr15*.22);
  const confluenceCount=near.length;
  const hist=testPullbackBacktest(backtestCandles,direction);
  const atrPct=Number(t5.atrPct),lowMax=Number(hist.volatilityThresholds?.lowMax),highMin=Number(hist.volatilityThresholds?.highMin);
  const volatilityRegime=Number.isFinite(atrPct)&&Number.isFinite(lowMax)&&atrPct<=lowMax?'LOW':Number.isFinite(atrPct)&&Number.isFinite(highMin)&&atrPct>=highMin?'HIGH':'NORMAL';
  const adxBoost=Number.isFinite(Number(t15.adx14))?(Number(t15.adx14)>=24&&Number(t15.diBias)===dir?5:Number(t15.adx14)>=24&&Number(t15.diBias)===-dir?-7:0):0;
  const setupScore=clamp(Math.round(Number(idea.modelScore||50)*.28+Number(idea.rankScore||50)*.18+Number(idea.estimatedWinRate||50)*.18+(confluenceCount/3)*20+(impulse.range/atr15>=2?10:5)+adxBoost),0,100);
  return {direction,createdAt:new Date().toISOString(),impulseLow:impulse.low,impulseHigh:impulse.high,zoneLow,zoneHigh,zoneMid,invalidation,fib38,fib61,fib786,ema20_15:t15.ema20,poc15:t15.poc,vwap15,atr5,atr15,atrPct,volatilityRegime,adx15:t15.adx14,diBias15:t15.diBias,confluenceCount,setupScore,backtest:hist};
}
function finiteMetric(v){if(v===null||v===undefined||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null}
function rowsByTimestamp(rows){return [...(Array.isArray(rows)?rows:[])].sort((a,b)=>Number(a?.timestamp||0)-Number(b?.timestamp||0))}
function percentChangeSeries(rows,key){const a=rowsByTimestamp(rows).map(x=>Number(x?.[key])).filter(Number.isFinite);return a.length>=2&&a[0]!==0?(a.at(-1)/a[0]-1)*100:null}
async function fetchBybitOiFallback(symbol){
  let lastError=null;for(const cand of externalSymbolCandidates(symbol))try{const json=await ideaFetchJson(`${BYBIT_API}/v5/market/open-interest?category=linear&symbol=${encodeURIComponent(cand.symbol)}&intervalTime=5min&limit=12`,7500,2);const rows=rowsByTimestamp(json?.result?.list);const vals=rows.map(x=>Number(x?.openInterest)).filter(Number.isFinite);if(vals.length>=2&&vals[0]>0){const ch=n=>{const i=Math.max(0,vals.length-1-n),a=vals[i],b=vals.at(-1);return a>0?(b/a-1)*100:null};return {changePct:(vals.at(-1)/vals[0]-1)*100,change5mPct:ch(1),change15mPct:ch(3),change1hPct:ch(11),rows,symbol:cand.symbol};}throw new Error('Bybit OI short')}catch(e){lastError=e}throw lastError||new Error('BYBIT_OI_UNAVAILABLE');
}
async function fetchBybitAccountRatioFallback(symbol){
  let lastError=null;for(const cand of externalSymbolCandidates(symbol))try{const json=await ideaFetchJson(`${BYBIT_API}/v5/market/account-ratio?category=linear&symbol=${encodeURIComponent(cand.symbol)}&period=5min&limit=12`,7500,2);const rows=rowsByTimestamp(json?.result?.list),x=rows.at(-1),buy=Number(x?.buyRatio),sell=Number(x?.sellRatio);if(buy>=0&&sell>0)return {ratio:buy/sell,rows,symbol:cand.symbol};throw new Error('Bybit L/S empty')}catch(e){lastError=e}throw lastError||new Error('BYBIT_LS_UNAVAILABLE');
}
async function fetchBinanceAggTakerFallback(symbol){
  const json=await ideaFetchJson(`${BINANCE_FAPI}/fapi/v1/aggTrades?symbol=${encodeURIComponent(cleanFuturesSymbol(symbol))}&limit=1000`,7500,2);
  if(!Array.isArray(json)||!json.length)return null;let buy=0,sell=0;for(const x of json){const q=Number(x?.q),p=Number(x?.p),notional=Number.isFinite(q)&&Number.isFinite(p)?q*p:0;if(!(notional>0))continue;if(x?.m===true)sell+=notional;else buy+=notional}return buy>0&&sell>0?{ratio:buy/sell,buyNotional:buy,sellNotional:sell,sample:json.length}:null;
}
async function fetchBybitRecentTakerFallback(symbol){
  let lastError=null;for(const cand of externalSymbolCandidates(symbol))try{const json=await ideaFetchJson(`${BYBIT_API}/v5/market/recent-trade?category=linear&symbol=${encodeURIComponent(cand.symbol)}&limit=1000`,7500,2);const rows=Array.isArray(json?.result?.list)?json.result.list:[];let buy=0,sell=0;for(const x of rows){const q=Number(x?.size),p=Number(x?.price),notional=Number.isFinite(q)&&Number.isFinite(p)?q*p:0;if(!(notional>0))continue;if(String(x?.side||'').toLowerCase()==='buy')buy+=notional;else if(String(x?.side||'').toLowerCase()==='sell')sell+=notional}if(buy>0&&sell>0)return {ratio:buy/sell,buyNotional:buy,sellNotional:sell,sample:rows.length,symbol:cand.symbol};throw new Error('Bybit trades empty')}catch(e){lastError=e}throw lastError||new Error('BYBIT_TRADES_UNAVAILABLE');
}
async function fetchOkxRecentTakerFallback(symbol){
  let lastError=null;
  for(const cand of okxCandidates(symbol))try{
    const json=await ideaFetchJson(`${OKX_API}/api/v5/market/trades?instId=${encodeURIComponent(cand.instId)}&limit=500`,7500,2),rows=Array.isArray(json?.data)?json.data:[];
    let buy=0,sell=0;
    for(const x of rows){const q=Number(x?.sz),p=Number(x?.px),notional=Number.isFinite(q)&&Number.isFinite(p)?q*p:0;if(!(notional>0))continue;if(String(x?.side||'').toLowerCase()==='buy')buy+=notional;else if(String(x?.side||'').toLowerCase()==='sell')sell+=notional}
    if(buy>0&&sell>0)return {ratio:buy/sell,buyNotional:buy,sellNotional:sell,sample:rows.length,instId:cand.instId};
    throw new Error('OKX trades empty');
  }catch(e){lastError=e}
  throw lastError||new Error('OKX_TRADES_UNAVAILABLE');
}
async function testFetchDerivatives(symbol) {
  const key=cleanFuturesSymbol(symbol),now=Date.now(),cached=testDerivCache.get(key);
  if(cached&&now-cached.at<25000)return cached.data;
  const urls={
    oi:`${FUTURES_DATA}/openInterestHist?symbol=${encodeURIComponent(key)}&period=5m&limit=12`,
    taker:`${FUTURES_DATA}/takerlongshortRatio?symbol=${encodeURIComponent(key)}&period=5m&limit=12`,
    global:`${FUTURES_DATA}/globalLongShortAccountRatio?symbol=${encodeURIComponent(key)}&period=5m&limit=12`,
    top:`${FUTURES_DATA}/topLongShortPositionRatio?symbol=${encodeURIComponent(key)}&period=5m&limit=12`,
    topAccount:`${FUTURES_DATA}/topLongShortAccountRatio?symbol=${encodeURIComponent(key)}&period=5m&limit=12`
  };
  const raw=await Promise.all(Object.entries(urls).map(async([name,url])=>{try{return [name,await ideaFetchJson(url,7000,2),null]}catch(e){return [name,null,String(e?.message||e)]}}));
  const got=Object.fromEntries(raw.map(([n,v])=>[n,v])),errors=Object.fromEntries(raw.filter(([,v,e])=>!v&&e).map(([n,,e])=>[n,e]));
  const oiRows=Array.isArray(got.oi)?got.oi:[],takerRows=Array.isArray(got.taker)?got.taker:[],globalRows=Array.isArray(got.global)?got.global:[],topRows=Array.isArray(got.top)?got.top:[],topAccountRows=Array.isArray(got.topAccount)?got.topAccount:[];
  let oi1hChangePct=ratioChangePct(oiRows,'sumOpenInterestValue') ?? ratioChangePct(oiRows,'sumOpenInterest'),oi5mChangePct=ratioRecentChangePct(oiRows,'sumOpenInterestValue',1) ?? ratioRecentChangePct(oiRows,'sumOpenInterest',1),oi15mChangePct=ratioRecentChangePct(oiRows,'sumOpenInterestValue',3) ?? ratioRecentChangePct(oiRows,'sumOpenInterest',3),oiChangePct=oi1hChangePct,oiSource=oiChangePct!=null?'Binance':null;
  let takerRatio=ratioLast(takerRows,'buySellRatio'),takerSource=takerRatio!=null?'Binance':null;
  let globalLongShortRatio=ratioLast(globalRows,'longShortRatio'),globalSource=globalLongShortRatio!=null?'Binance':null;
  let topPositionRatio=ratioLast(topRows,'longShortRatio'),topSource=topPositionRatio!=null?'Binance':null;
  const topAccountRatio=ratioLast(topAccountRows,'longShortRatio');
  if(ENABLE_CROSS_EXCHANGE&&oiChangePct==null){try{const r=await fetchBybitOiFallback(key);if(r){oiChangePct=r.changePct;oi1hChangePct=r.change1hPct??r.changePct;oi15mChangePct=r.change15mPct??null;oi5mChangePct=r.change5mPct??null;oiSource='Bybit備援'}}catch(e){errors.oiFallback=String(e?.message||e)}}
  if(takerRatio==null){try{const r=await fetchBinanceAggTakerFallback(key);if(r){takerRatio=r.ratio;takerSource='Binance成交備援'}}catch(e){errors.takerFallback=String(e?.message||e)}}
  if(ENABLE_CROSS_EXCHANGE&&takerRatio==null){try{const r=await fetchBybitRecentTakerFallback(key);if(r){takerRatio=r.ratio;takerSource='Bybit成交備援'}}catch(e){errors.takerBybitFallback=String(e?.message||e)}}
  if(ENABLE_CROSS_EXCHANGE&&takerRatio==null){try{const r=await fetchOkxRecentTakerFallback(key);if(r){takerRatio=r.ratio;takerSource='OKX成交備援'}}catch(e){errors.takerOkxFallback=String(e?.message||e)}}
  if(ENABLE_CROSS_EXCHANGE&&globalLongShortRatio==null){try{const r=await fetchBybitAccountRatioFallback(key);if(r){globalLongShortRatio=r.ratio;globalSource='Bybit備援'}}catch(e){errors.globalFallback=String(e?.message||e)}}
  const health={oi:Number.isFinite(oiChangePct),taker:Number.isFinite(takerRatio),globalLs:Number.isFinite(globalLongShortRatio),topPos:Number.isFinite(topPositionRatio),topAccount:Number.isFinite(topAccountRatio),fetchedAt:new Date().toISOString()};
  const data={
    oiChangePct:Number.isFinite(oiChangePct)?oiChangePct:null,
    oi5mChangePct:Number.isFinite(oi5mChangePct)?oi5mChangePct:null,
    oi15mChangePct:Number.isFinite(oi15mChangePct)?oi15mChangePct:null,
    oi1hChangePct:Number.isFinite(oi1hChangePct)?oi1hChangePct:null,
    takerRatio:Number.isFinite(takerRatio)?takerRatio:null,
    globalLongShortRatio:Number.isFinite(globalLongShortRatio)?globalLongShortRatio:null,
    globalLongShortChangePct:ratioChangePct(globalRows,'longShortRatio'),
    topPositionRatio:Number.isFinite(topPositionRatio)?topPositionRatio:null,
    topPositionChangePct:ratioChangePct(topRows,'longShortRatio'),
    topAccountRatio:Number.isFinite(topAccountRatio)?topAccountRatio:null,
    _health:health,_source:{oi:oiSource,taker:takerSource,globalLs:globalSource,topPos:topSource,topAccount:Number.isFinite(topAccountRatio)?'Binance':null},_errors:errors
  };
  testDerivCache.set(key,{at:now,data});return data;
}
async function fetchBybitDepth(symbol){
  let lastError=null;for(const cand of externalSymbolCandidates(symbol))try{const json=await ideaFetchJson(`${BYBIT_API}/v5/market/orderbook?category=linear&symbol=${encodeURIComponent(cand.symbol)}&limit=25`,6500,2),book=json?.result||{},scale=cand.scale;const cv=row=>[String(Number(row?.[0])*scale),row?.[1]];const bids=Array.isArray(book.b)?book.b.map(cv):[],asks=Array.isArray(book.a)?book.a.map(cv):[];if(bids.length&&asks.length)return {bids,asks,ts:Number(book.ts||json?.time||0),symbol:cand.symbol,scale};throw new Error('Bybit depth empty')}catch(e){lastError=e}throw lastError||new Error('BYBIT_DEPTH_UNAVAILABLE');
}
async function fetchOkxDepth(symbol){
  let lastError=null;for(const cand of okxCandidates(symbol))try{const json=await ideaFetchJson(`${OKX_API}/api/v5/market/books?instId=${encodeURIComponent(cand.instId)}&sz=20`,6500,2),book=Array.isArray(json?.data)?json.data[0]:null,scale=cand.scale,cv=row=>[String(Number(row?.[0])*scale),row?.[1]];const bids=Array.isArray(book?.bids)?book.bids.map(cv):[],asks=Array.isArray(book?.asks)?book.asks.map(cv):[];if(bids.length&&asks.length)return {bids,asks,ts:Number(book?.ts||0),instId:cand.instId,scale};throw new Error('OKX depth empty')}catch(e){lastError=e}throw lastError||new Error('OKX_SYMBOL_UNSUPPORTED');
}
function summarizeDepth(bids,asks){
  const b=Array.isArray(bids)?bids:[],a=Array.isArray(asks)?asks:[];const bidNotional=b.reduce((z,row)=>z+Number(row?.[0]||0)*Number(row?.[1]||0),0),askNotional=a.reduce((z,row)=>z+Number(row?.[0]||0)*Number(row?.[1]||0),0),total=bidNotional+askNotional;const imbalance=total>0?(bidNotional-askNotional)/total:null;const bid=Number(b?.[0]?.[0]||0),ask=Number(a?.[0]?.[0]||0),mid=bid>0&&ask>0?(bid+ask)/2:0,spreadBps=mid>0?(ask-bid)/mid*10000:null;return {depthImbalance:Number.isFinite(imbalance)?Number(imbalance.toFixed(4)):null,spreadBps:Number.isFinite(spreadBps)?Number(spreadBps.toFixed(2)):null,bidNotional:Number.isFinite(bidNotional)?Number(bidNotional.toFixed(2)):null,askNotional:Number.isFinite(askNotional)?Number(askNotional.toFixed(2)):null,ok:b.length>0&&a.length>0};
}
async function testFetchMicrostructure(symbol) {
  const key=cleanFuturesSymbol(symbol),now=Date.now(),cached=testMicroCache.get(key);if(cached&&now-cached.at<25000)return cached.data;
  let book=null,source=null,error=null;
  try{const depth=await ideaFetchJson(`${BINANCE_FAPI}/fapi/v1/depth?symbol=${encodeURIComponent(key)}&limit=20`,6500,2);book={bids:depth?.bids,asks:depth?.asks};source='Binance'}catch(e){error=String(e?.message||e)}
  if((!book||!Array.isArray(book.bids)||!book.bids.length)&&ENABLE_CROSS_EXCHANGE){try{book=await fetchBybitDepth(key);source='Bybit備援'}catch(e){error=`${error||''}; Bybit ${String(e?.message||e)}`}}
  if((!book||!Array.isArray(book.bids)||!book.bids.length)&&ENABLE_CROSS_EXCHANGE){try{book=await fetchOkxDepth(key);source='OKX備援'}catch(e){error=`${error||''}; OKX ${String(e?.message||e)}`}}
  const sm=summarizeDepth(book?.bids,book?.asks);const data={...sm,_health:{depth:sm.ok,fetchedAt:new Date().toISOString()},_source:{depth:sm.ok?source:null},_errors:error?{depth:error}:null};testMicroCache.set(key,{at:now,data});return data;
}
async function fetchBybitTicker(symbol){let lastError=null;for(const cand of externalSymbolCandidates(symbol))try{const json=await ideaFetchJson(`${BYBIT_API}/v5/market/tickers?category=linear&symbol=${encodeURIComponent(cand.symbol)}`,6500,2),row=Array.isArray(json?.result?.list)?json.result.list[0]:null;if(!row)throw new Error('Bybit ticker empty');if(cand.scale!==1){row.markPrice=finiteMetric(row.markPrice)!=null?String(Number(row.markPrice)*cand.scale):row.markPrice;row.indexPrice=finiteMetric(row.indexPrice)!=null?String(Number(row.indexPrice)*cand.scale):row.indexPrice;row.lastPrice=finiteMetric(row.lastPrice)!=null?String(Number(row.lastPrice)*cand.scale):row.lastPrice}return row}catch(e){lastError=e}throw lastError||new Error('BYBIT_TICKER_UNAVAILABLE')}
async function fetchOkxRiskFallback(symbol){
  let lastError=null;
  for(const cand of okxCandidates(symbol))try{
    const [markR,fundingR]=await Promise.all([
      ideaFetchJson(`${OKX_API}/api/v5/public/mark-price?instType=SWAP&instId=${encodeURIComponent(cand.instId)}`,6500,2).then(v=>({v})).catch(e=>({e})),
      ideaFetchJson(`${OKX_API}/api/v5/public/funding-rate?instId=${encodeURIComponent(cand.instId)}`,6500,1).then(v=>({v,source:'current'})).catch(async()=>{try{return {v:await ideaFetchJson(`${OKX_API}/api/v5/public/funding-rate-history?instId=${encodeURIComponent(cand.instId)}&limit=1`,6500,2),source:'history'}}catch(e2){return {e:e2}}})
    ]);
    const markRow=Array.isArray(markR.v?.data)?markR.v.data[0]:null,fundRow=Array.isArray(fundingR.v?.data)?fundingR.v.data[0]:null;
    const mark=finiteMetric(markRow?.markPx),funding=finiteMetric(fundRow?.fundingRate??fundRow?.realizedRate),nextFundingTime=finiteMetric(fundRow?.nextFundingTime??fundRow?.fundingTime);
    if(mark==null&&funding==null)throw markR.e||fundingR.e||new Error('OKX risk empty');
    return {markPrice:mark!=null?mark*cand.scale:null,fundingRate:funding,nextFundingTime,instId:cand.instId,fundingSource:fundingR.source||null};
  }catch(e){lastError=e}
  throw lastError||new Error('OKX_RISK_UNAVAILABLE');
}
async function testFetchRiskContext(symbol) {
  const key=cleanFuturesSymbol(symbol),now=Date.now(),cached=testRiskCache.get(key);if(cached&&now-cached.at<60*1000)return cached.data;
  const [adlR,premiumR,basisR]=await Promise.all([
    ideaFetchJson(`${BINANCE_FAPI}/fapi/v1/symbolAdlRisk?symbol=${encodeURIComponent(key)}`,6500,2).then(v=>({v})).catch(e=>({e})),
    ideaFetchJson(`${BINANCE_FAPI}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(key)}`,6500,2).then(v=>({v})).catch(e=>({e})),
    ideaFetchJson(`${FUTURES_DATA}/basis?pair=${encodeURIComponent(key)}&contractType=PERPETUAL&period=5m&limit=2`,6500,2).then(v=>({v})).catch(e=>({e}))
  ]);
  const errors={};if(adlR.e)errors.adl=String(adlR.e?.message||adlR.e);if(premiumR.e)errors.premium=String(premiumR.e?.message||premiumR.e);if(basisR.e)errors.basis=String(basisR.e?.message||basisR.e);
  const adl=adlR.v,premium=premiumR.v,basisRows=basisR.v;
  let adlRisk=String((Array.isArray(adl)?adl[0]?.adlRisk:adl?.adlRisk)||'unknown').toLowerCase();
  let fundingRate=finiteMetric(premium?.lastFundingRate),markPrice=finiteMetric(premium?.markPrice),indexPrice=finiteMetric(premium?.indexPrice),nextFundingTime=finiteMetric(premium?.nextFundingTime),fundSource=fundingRate!=null?'Binance':null,markSource=markPrice!=null?'Binance':null;
  if(ENABLE_CROSS_EXCHANGE&&(fundingRate==null||markPrice==null||indexPrice==null)){try{const t=await fetchBybitTicker(key);if(fundingRate==null&&finiteMetric(t?.fundingRate)!=null){fundingRate=Number(t.fundingRate);fundSource='Bybit備援'}if(markPrice==null&&finiteMetric(t?.markPrice)!=null){markPrice=Number(t.markPrice);markSource='Bybit備援'}if(indexPrice==null&&finiteMetric(t?.indexPrice)!=null)indexPrice=Number(t.indexPrice);if(nextFundingTime==null&&finiteMetric(t?.nextFundingTime)!=null)nextFundingTime=Number(t.nextFundingTime)}catch(e){errors.bybitTicker=String(e?.message||e)}}
  if(ENABLE_CROSS_EXCHANGE&&(fundingRate==null||markPrice==null)){try{const t=await fetchOkxRiskFallback(key);if(fundingRate==null&&finiteMetric(t?.fundingRate)!=null){fundingRate=Number(t.fundingRate);fundSource=t.fundingSource==='history'?'OKX歷史備援':'OKX備援'}if(markPrice==null&&finiteMetric(t?.markPrice)!=null){markPrice=Number(t.markPrice);markSource='OKX備援'}if(nextFundingTime==null&&finiteMetric(t?.nextFundingTime)!=null)nextFundingTime=Number(t.nextFundingTime)}catch(e){errors.okxRisk=String(e?.message||e)}}
  const basisLast=Array.isArray(basisRows)?basisRows.at(-1):null,basisRate=finiteMetric(basisLast?.basisRate);let basisPct=basisRate!=null?basisRate*100:(markPrice!=null&&indexPrice!=null&&indexPrice>0?(markPrice-indexPrice)/indexPrice*100:null);let basisSource=basisRate!=null?'Binance':basisPct!=null?(markSource==='Binance'?'Binance推導':`${markSource||'跨所'}推導`):null;
  const annualizedBasisRate=finiteMetric(basisLast?.annualizedBasisRate);
  const data={adlRisk,fundingPct:fundingRate!=null?Number((fundingRate*100).toFixed(4)):null,markPrice,indexPrice,basisPct:basisPct!=null?Number(basisPct.toFixed(4)):null,annualizedBasisPct:annualizedBasisRate!=null?Number((annualizedBasisRate*100).toFixed(2)):null,nextFundingTime,_health:{funding:fundingRate!=null,basis:basisPct!=null,adl:adlRisk!=='unknown',mark:markPrice!=null,fetchedAt:new Date().toISOString()},_source:{funding:fundSource,basis:basisSource,adl:adlRisk!=='unknown'?'Binance':null,mark:markSource},_errors:errors};
  testRiskCache.set(key,{at:now,data});return data;
}
async function testFetchCrossExchange(symbol){
  const key=cleanFuturesSymbol(symbol),now=Date.now(),cached=testCrossExchangeCache.get(key);if(cached&&now-cached.at<45000)return cached.data;if(!ENABLE_CROSS_EXCHANGE)return {enabled:false};
  const bybit=await (async()=>{try{const [c,oi,ls,depth,ticker]=await Promise.all([fetchBybitCandles(key,'15m',140),fetchBybitOiFallback(key).catch(()=>null),fetchBybitAccountRatioFallback(key).catch(()=>null),fetchBybitDepth(key).catch(()=>null),fetchBybitTicker(key).catch(()=>null)]);const tech=technicalSnapshot(closedTestCandles(c)),sm=depth?summarizeDepth(depth.bids,depth.asks):{};return {ok:true,trend:tech.trend,momentum:tech.momentum,rsi15:tech.rsi14,oiChangePct:oi?.changePct??null,oi5mChangePct:oi?.change5mPct??null,oi15mChangePct:oi?.change15mPct??null,oi1hChangePct:oi?.change1hPct??oi?.changePct??null,longShortRatio:ls?.ratio??null,depthImbalance:sm.depthImbalance??null,spreadBps:sm.spreadBps??null,fundingPct:finiteMetric(ticker?.fundingRate)!=null?Number(ticker.fundingRate)*100:null,markPrice:finiteMetric(ticker?.markPrice)} }catch(e){return {ok:false,error:String(e?.message||e)}}})();
  const okx=await (async()=>{try{const [c,depth]=await Promise.all([fetchOkxCandles(key,'15m',140),fetchOkxDepth(key).catch(()=>null)]);const tech=technicalSnapshot(closedTestCandles(c)),sm=depth?summarizeDepth(depth.bids,depth.asks):{};return {ok:true,trend:tech.trend,momentum:tech.momentum,rsi15:tech.rsi14,depthImbalance:sm.depthImbalance??null,spreadBps:sm.spreadBps??null} }catch(e){return {ok:false,error:String(e?.message||e)}}})();
  const dirs=[bybit.ok?bybit.trend:0,okx.ok?okx.trend:0].filter(x=>x!==0),consensus=dirs.length?(dirs.every(x=>x>0)?1:dirs.every(x=>x<0)?-1:0):0;const data={enabled:true,checkedAt:new Date().toISOString(),bybit,okx,consensus,available:[bybit.ok,okx.ok].filter(Boolean).length,total:2};testCrossExchangeCache.set(key,{at:now,data});return data;
}
async function testMarketContext() {
  const [b5,b15,b1,e5,e15,e1]=await Promise.all([
    testFetchCandles('BTCUSDT','5m',160).catch(()=>null),testFetchCandles('BTCUSDT','15m',160).catch(()=>null),testFetchCandles('BTCUSDT','1h',120).catch(()=>null),
    testFetchCandles('ETHUSDT','5m',160).catch(()=>null),testFetchCandles('ETHUSDT','15m',160).catch(()=>null),testFetchCandles('ETHUSDT','1h',120).catch(()=>null),
  ]);
  const snaps=[];const scoreOne=(a,b,c)=>{if(!a||!b)return 0;const x=technicalSnapshot(closedTestCandles(a)),y=technicalSnapshot(closedTestCandles(b)),z=c?technicalSnapshot(closedTestCandles(c)):null;snaps.push(x,y);if(z)snaps.push(z);return x.trend+y.trend+x.momentum*.5+y.momentum*.5+(z?.trend||0)*.8+(z?.momentum||0)*.35};
  const raw=scoreOne(b5,b15,b1)+scoreOne(e5,e15,e1),valid=[b5,b15,b1,e5,e15,e1].filter(Boolean).length,dir=raw>=2.8?1:raw<=-2.8?-1:0;
  const adxVals=snaps.map(x=>Number(x?.adx14)).filter(Number.isFinite),atrVals=snaps.map(x=>Number(x?.atrPct)).filter(Number.isFinite),avgAdx=adxVals.length?adxVals.reduce((a,b)=>a+b,0)/adxVals.length:null,maxAtrPct=atrVals.length?Math.max(...atrVals):null,liq=realtimeLiquidationSnapshot(),radar=realtimeRadarSummary(),breadth=(radar.advancers+radar.decliners)>0?(radar.advancers-radar.decliners)/(radar.advancers+radar.decliners):null;
  let regime='NORMAL';if(liq.totalUsd>=REGIME_LIQUIDATION_5M_USD)regime='LIQUIDATION';else if((maxAtrPct||0)>=1.0)regime='HIGH_VOL';else if(dir>0&&(avgAdx||0)>=20)regime='TREND_UP';else if(dir<0&&(avgAdx||0)>=20)regime='TREND_DOWN';else if(dir===0||(avgAdx||0)<17)regime='CHOP';
  return {raw,dir,ok:valid>=4,valid,total:6,regime,avgAdx:Number.isFinite(avgAdx)?Number(avgAdx.toFixed(1)):null,maxAtrPct:Number.isFinite(maxAtrPct)?Number(maxAtrPct.toFixed(3)):null,liquidation5mUsd:Number(liq.totalUsd.toFixed(0)),longLiquidation5mUsd:Number(liq.longLiquidationUsd.toFixed(0)),shortLiquidation5mUsd:Number(liq.shortLiquidationUsd.toFixed(0)),breadth:Number.isFinite(breadth)?Number(breadth.toFixed(3)):null,radar};
}
function testLiveAggregate() {
  const calc=(rows)=>{const wins=rows.filter(x=>x.result==='WIN').length,losses=rows.length-wins,avg=rows.length?rows.reduce((a,x)=>a+Number(x.returnPct||0),0)/rows.length:null;return {sample:rows.length,wins,losses,hitRate:rows.length?Number((wins/rows.length*100).toFixed(1)):null,avgReturnPct:Number.isFinite(avg)?Number(avg.toFixed(2)):null}};
  const first=testSignalHistory.filter(x=>x.phase!=='REENTRY'&&['WIN','LOSS','DROPPED'].includes(x.result));
  const reentry=testSignalHistory.filter(x=>x.phase==='REENTRY'&&['WIN','LOSS'].includes(x.result));
  return {...calc(first),reentry:calc(reentry)};
}
function testRankHeat(rank) {
  const r=Number(rank);if(!Number.isFinite(r)||r<1)return 45;
  // 建議前段代表當日熱度/一致性較高；Top 1~3 保留明顯優勢，但不讓排名單獨決定勝率。
  return clamp(100-(r-1)*6.5,28,100);
}
function testRankBucket(rank){const r=Number(rank);return !Number.isFinite(r)?'NA':r<=3?'TOP3':r<=6?'TOP6':r<=9?'TOP9':'TOP12'}
function testWeightedLiveCalibration(t) {
  const now=Date.now(),targetQ=Number(t.qualityScore||t.setup?.setupScore||75),targetRank=Number(t.rankAtConfirm||t.rank||99),targetBucket=testRankBucket(targetRank);let wins=0,losses=0,raw=0;
  for(const x of testSignalHistory.filter(r=>r.phase!=='REENTRY'&&['WIN','LOSS','DROPPED'].includes(r.result)).slice(0,180)){
    const ts=new Date(x.finishedAt||x.confirmedAt||0).getTime();
    const ageDays=Number.isFinite(ts)?Math.max(0,(now-ts)/86400000):30;
    let w=Math.pow(.5,ageDays/21); // recent realised outcomes matter more
    if(x.direction===t.direction)w*=1.2;
    if(x.symbol===t.symbol)w*=1.7;
    const q=Number(x.qualityScore);if(Number.isFinite(q)&&Math.abs(q-targetQ)<=8)w*=1.2;
    if(x.volatilityRegime&&t.setup?.volatilityRegime&&x.volatilityRegime===t.setup.volatilityRegime)w*=1.2;
    const sid=(t.strategyAtConfirm||t.strategyProfile)?.id;if(sid&&x.strategyId===sid)w*=1.35;
    const xr=Number(x.rankAtConfirm||x.rank);if(Number.isFinite(xr)&&testRankBucket(xr)===targetBucket)w*=1.28;
    if(Number.isFinite(xr)&&Number.isFinite(targetRank)&&Math.abs(xr-targetRank)<=2)w*=1.12;
    if(!(w>0))continue;raw++;
    if(x.result==='WIN')wins+=w;else losses+=w;
  }
  return {wins,losses,raw,effectiveSample:wins+losses};
}
function testCalibratedWinRate(t,{dynamic=true}={}) {
  const bt=t.setup?.backtest||{},model=clamp(Number(t.idea?.estimatedWinRate||50),45,76),quality=clamp(Number(t.qualityScore||t.setup?.setupScore||74),50,100);
  // 更保守的 Bayesian/樣本校準：低樣本不讓模型或單日熱度把勝率拉得過高。
  const priorP=clamp(50+(model-50)*.18+(quality-74)*.05,47,58.5)/100,priorN=34;
  let winW=priorP*priorN,lossW=(1-priorP)*priorN;
  const histWins=Number(bt.wins||0),histLosses=Number(bt.losses||0),histN=histWins+histLosses;
  const histWeight=histN?Math.min(.50,.24+Math.min(histN,220)/850):0;
  winW+=histWins*histWeight;lossW+=histLosses*histWeight;
  const reg=bt.regimes?.[t.setup?.volatilityRegime||'NORMAL'];
  const regN=Number(reg?.sample||0);
  if(regN>=8){
    const rw=Math.min(.18,.06+regN/300);
    winW+=Number(reg.wins||0)*rw;lossW+=Number(reg.losses||0)*rw;
  }
  const live=testWeightedLiveCalibration(t);winW+=live.wins;lossW+=live.losses;
  let meanRate=100*winW/Math.max(1e-9,winW+lossW);
  const rankRef=Number(t.rankAtConfirm||t.rank),rankHeat=testRankHeat(rankRef);
  // 當日排名只做有限度校準：Top3 有明顯加分，後段排名扣分，但不讓熱度單獨製造高勝率。
  meanRate+=clamp((rankHeat-62)*.08,-3.4,3.8);
  if(Number.isFinite(rankRef)){if(rankRef<=3)meanRate+=1.4;else if(rankRef>=10)meanRate-=1.8;else if(rankRef>=7)meanRate-=.7}
  if(dynamic&&['CONFIRMED','INVALID'].includes(t.status)){
    if(Number.isFinite(Number(t.monitorScore)))meanRate+=clamp((Number(t.monitorScore)-76)*.11,-5.2,4.0);
    meanRate+=({STRONG:2.0,CONTINUING:2.8,WEAKENING:-9.0,RECOVERING:.8,CONFIRMED:0,INVALIDATED:-12,REARMED:.4}[t.monitorState]||0);
    const ev=t.monitorEvidence||t.lastCheck||{};
    if(ev.adverse30)meanRate-=2.0;if(ev.adverse1h)meanRate-=2.8;if(ev.adverseMarket)meanRate-=2.0;if(ev.adverseDepth)meanRate-=1.4;if(ev.wideSpread)meanRate-=1.2;
    if(ev.fundingCrowded)meanRate-=1.8;if(String(ev.adlRisk||'').toLowerCase()==='high')meanRate-=2.8;
    if(ev.breakoutHeld)meanRate+=.8;
  }
  const effectiveSample=Math.max(1,Math.round((histN*histWeight)+(regN?regN*Math.min(.18,.06+regN/300):0)+live.effectiveSample+priorN));
  const coverage=Number(t.dataHealth?.coveragePct),dataConfidence=Number(t.dataHealth?.confidencePct),effectiveCoverage=Math.min(Number.isFinite(coverage)?coverage:100,Number.isFinite(dataConfidence)?dataConfidence:100);
  if(Number.isFinite(effectiveCoverage)&&effectiveCoverage<95)meanRate-=clamp((95-effectiveCoverage)*.12,0,5.5); // 缺資料只降可信度/勝率，不把缺值當成中性利多
  meanRate=clamp(meanRate,40,84);
  const meanWins=meanRate/100*effectiveSample,meanLosses=effectiveSample-meanWins,rawCi=testWilsonInterval(meanWins,meanLosses);
  // 顯示值往保守下界收斂；樣本愈少，收斂愈強。
  const lowWeight=effectiveSample<38?.44:effectiveSample<65?.34:effectiveSample<100?.26:.21;
  let rate=meanRate*(1-lowWeight)+Number(rawCi.low??meanRate)*lowWeight;
  const maxRate=effectiveSample>=120?78:effectiveSample>=80?75:effectiveSample>=50?71:67;
  rate=clamp(rate,40,maxRate);
  const pseudoWins=rate/100*effectiveSample,pseudoLosses=effectiveSample-pseudoWins,ci=testWilsonInterval(pseudoWins,pseudoLosses);
  let confidence=effectiveSample>=80?'高':effectiveSample>=45?'中':'低';if(Number.isFinite(effectiveCoverage)&&effectiveCoverage<85)confidence='低';else if(Number.isFinite(effectiveCoverage)&&effectiveCoverage<92&&confidence==='高')confidence='中';
  return {
    rate:Number(rate.toFixed(1)),posteriorMean:Number(meanRate.toFixed(1)),confidence,effectiveSample,liveSample:live.raw,historicalSample:histN,regime:t.setup?.volatilityRegime||'NORMAL',regimeSample:regN,
    rankAtConfirm:Number.isFinite(rankRef)?rankRef:null,rankHeat:Number(rankHeat.toFixed(0)),
    conservativeLow:Number.isFinite(ci.low)?Number(ci.low.toFixed(1)):null,confidenceHigh:Number.isFinite(ci.high)?Number(ci.high.toFixed(1)):null,
    method:'嚴格校準勝率：模型先驗降權＋擴大5分K回測＋波動分層＋APP實測＋當日排名熱度＋即時高週期/委託簿/擁擠風險＋資料完整度懲罰；缺資料不以0/中性冒充有效訊號，低樣本向Wilson下界收斂並限制最高值'
  };
}
function terminalTestStatus(status){return ['WIN','LOSS','TIMEOUT','DROPPED','EXPIRED'].includes(status)}
function newTestTracker(idea, rank) {
  const now=new Date().toISOString();return {
    key:testSignalKey(idea.symbol,idea.direction),symbol:idea.symbol,direction:idea.direction,rank,idea:{...idea},
    status:'WAIT_PULLBACK',statusLabel:'觀察中',firstSeenAt:now,lastSeenIdeaAt:now,updatedAt:now,touchedAt:null,confirmedAt:null,
    notificationSentAt:null,resultNotificationSentAt:null,resultSaved:false,setup:null,lastCheck:null,monitorState:'WATCHING',monitorLabel:'觀察',
    monitorScore:null,monitorCycle:0,breakoutLevel:null,breakoutAt:null,structureProtection:null,weakStreak:0,recoverStreak:0,badScoreStreak:0,
    lastMonitorBarTime:null,lifecycleNotifications:{},confirmedWinRate:null,winRateMetaAtConfirm:null,rankAtConfirm:null,stateChangedAt:now,weakSince:null,
    lastEvaluatedAt:null,lastEvaluatedBarAt:null,lastEvaluationError:null,lastEvaluationErrorAt:null,
    invalidatedAt:null,invalidReason:null,reactivateUntil:null,reactivatedAt:null,droppedAt:null,outcomeFirstTouch:null,outcomeFirstTouchAt:null,
    targetReachedAt:null,reentryStage:null,reentryStageAt:null,reentryExtreme:null,reentryZoneLow:null,reentryZoneHigh:null,reentryZoneMid:null,reentryInvalidation:null,
    reentryTouchAt:null,reentryConfirmAt:null,reentryConfirmStreak:0,reentryEntryPrice:null,reentryStop:null,reentryTarget1R:null,reentryScore:null,reentryReasons:[],reentryResultSaved:false,reentryResult:null,reentryResultAt:null,confirmNotificationTier:null,reentryNotificationTier:null
  };
}
function archiveTestTargetWin(t, at) {
  if(t.resultSaved)return;
  testSignalHistory.unshift({
    id:`${t.key}:${t.confirmedAt||t.updatedAt}`,symbol:t.symbol,direction:t.direction,result:'WIN',phase:'FIRST_ENTRY',confirmedAt:t.confirmedAt,
    finishedAt:at||new Date().toISOString(),entryPrice:t.confirmationPrice||null,target:t.target1R||null,stop:t.stop||null,
    returnPct:Number(t.resultReturnPct||0),qualityScore:Number(t.qualityScore||0),historicalHitRate:t.setup?.backtest?.hitRate??null,
    rank:Number(t.rank||0)||null,rankAtConfirm:Number(t.rankAtConfirm||0)||null,backtestSample:t.setup?.backtest?.sample??0,
    volatilityRegime:t.setup?.volatilityRegime||null,monitorScore:t.monitorScore??null,strategyId:(t.strategyAtConfirm||t.strategyProfile)?.id||null,strategyLabel:(t.strategyAtConfirm||t.strategyProfile)?.label||null
  });
  testSignalHistory=testSignalHistory.slice(0,300);t.resultSaved=true;
}
function archiveTestReentryResult(t,result,at,returnPct) {
  if(t.reentryResultSaved||!['WIN','LOSS'].includes(result))return;
  testSignalHistory.unshift({
    id:`${t.key}:${t.reentryConfirmAt||at}:REENTRY`,symbol:t.symbol,direction:t.direction,result,phase:'REENTRY',
    confirmedAt:t.reentryConfirmAt||at,finishedAt:at||new Date().toISOString(),entryPrice:t.reentryEntryPrice||null,target:t.reentryTarget1R||null,stop:t.reentryStop||null,
    returnPct:Number(returnPct||0),qualityScore:Number(t.reentryScore||t.monitorScore||0),historicalHitRate:null,rank:Number(t.rank||0)||null,rankAtConfirm:Number(t.rank||0)||null,
    backtestSample:0,volatilityRegime:t.setup?.volatilityRegime||null,monitorScore:t.monitorScore??null,strategyId:'REENTRY',strategyLabel:'二次回踩'
  });
  testSignalHistory=testSignalHistory.slice(0,300);t.reentryResultSaved=true;t.reentryResult=result;t.reentryResultAt=at||new Date().toISOString();
}
function archiveTestResult(t) {
  if(t.resultSaved||!['WIN','LOSS','TIMEOUT','DROPPED'].includes(t.status))return;
  testSignalHistory.unshift({
    id:`${t.key}:${t.confirmedAt||t.updatedAt}`,symbol:t.symbol,direction:t.direction,result:t.status,confirmedAt:t.confirmedAt,
    finishedAt:t.finishedAt||t.updatedAt,entryPrice:t.confirmationPrice||null,target:t.target1R||null,stop:t.stop||null,
    returnPct:Number(t.resultReturnPct||0),qualityScore:Number(t.qualityScore||0),historicalHitRate:t.setup?.backtest?.hitRate??null,rank:Number(t.rank||0)||null,rankAtConfirm:Number(t.rankAtConfirm||0)||null,
    backtestSample:t.setup?.backtest?.sample??0,volatilityRegime:t.setup?.volatilityRegime||null,monitorScore:t.monitorScore??null,strategyId:(t.strategyAtConfirm||t.strategyProfile)?.id||null,strategyLabel:(t.strategyAtConfirm||t.strategyProfile)?.label||null
  });
  testSignalHistory=testSignalHistory.slice(0,300);t.resultSaved=true;
}
function archiveTestFirstTouchLoss(t, at, returnPct) {
  if(t.resultSaved)return;
  testSignalHistory.unshift({
    id:`${t.key}:${t.confirmedAt||t.updatedAt}`,symbol:t.symbol,direction:t.direction,result:'LOSS',confirmedAt:t.confirmedAt,
    finishedAt:at||new Date().toISOString(),entryPrice:t.confirmationPrice||null,target:t.target1R||null,stop:t.stop||null,
    returnPct:Number(returnPct||0),qualityScore:Number(t.qualityScore||0),historicalHitRate:t.setup?.backtest?.hitRate??null,
    backtestSample:t.setup?.backtest?.sample??0,volatilityRegime:t.setup?.volatilityRegime||null,monitorScore:t.monitorScore??null,strategyId:(t.strategyAtConfirm||t.strategyProfile)?.id||null,strategyLabel:(t.strategyAtConfirm||t.strategyProfile)?.label||null
  });
  testSignalHistory=testSignalHistory.slice(0,300);t.resultSaved=true;
}
function testSetState(t,state,label,at=new Date().toISOString()){
  if(t.monitorState!==state||t.monitorLabel!==label)t.stateChangedAt=at;
  t.monitorState=state;t.monitorLabel=label;return t;
}
function syncTestIdeas(ideas) {
  const now=Date.now(),seen=new Set();
  (ideas?.rows||[]).slice(0,TEST_SIGNAL_MAX).forEach((idea,i)=>{
    if(!['LONG','SHORT'].includes(idea.direction))return;const key=testSignalKey(idea.symbol,idea.direction);seen.add(key);
    const opposite=testSignalTrackers.get(testSignalKey(idea.symbol,idea.direction==='LONG'?'SHORT':'LONG'));
    if(opposite&&!terminalTestStatus(opposite.status)&&opposite.status!=='CONFIRMED'){opposite.status='EXPIRED';opposite.statusLabel='方向翻轉';opposite.updatedAt=new Date().toISOString();opposite.finishedAt=opposite.updatedAt;testSignalTrackers.set(opposite.key,opposite)}
    const old=testSignalTrackers.get(key);
    if(!old||terminalTestStatus(old.status)&&now-new Date(old.updatedAt||0).getTime()>TEST_REARM_COOLDOWN_MS){testSignalTrackers.set(key,newTestTracker(idea,i+1));return}
    old.rank=i+1;old.idea={...idea};old.lastSeenIdeaAt=new Date().toISOString();old.updatedAt=new Date().toISOString();testSignalTrackers.set(key,old);
  });
  for(const [key,t] of testSignalTrackers){
    if(terminalTestStatus(t.status)||t.status==='CONFIRMED'||t.status==='INVALID')continue;
    const age=now-new Date(t.lastSeenIdeaAt||t.firstSeenAt||0).getTime();if(!seen.has(key)&&age>TEST_SIGNAL_IDEA_TTL_MS){t.status='EXPIRED';t.statusLabel='排名移出';t.updatedAt=new Date().toISOString();t.finishedAt=t.updatedAt;testSignalTrackers.set(key,t)}
  }
}
function testReasonList({setup,reclaim,wicker,sweep,momentum,macdImprove,volumeRatio,deriv,marketAlign,direction}) {
  const out=[];if(setup?.confluenceCount>=2)out.push('回踩區有 EMA／POC／VWAP 重疊');else if(setup?.confluenceCount===1)out.push('回踩區有一項關鍵價重疊');
  if(reclaim)out.push('5分收回回踩區');if(sweep)out.push('出現流動性掃低/掃高');else if(wicker)out.push('5分拒絕影線成立');if(momentum&&macdImprove)out.push('RSI＋MACD 動能回復');if(volumeRatio>=1.05)out.push('量能回升');
  if(finiteMetric(deriv?.takerRatio)!=null&&(direction==='LONG'&&Number(deriv.takerRatio)>=1.02||direction==='SHORT'&&Number(deriv.takerRatio)<=.98))out.push('主動買賣同向');if(marketAlign>0)out.push('BTC/ETH 同向');if(marketAlign<0)out.push('BTC/ETH 逆向扣分');return out.slice(0,6);
}
function testMonitorRoute(t){return `/?page=monitor&testSignal=${encodeURIComponent(t.symbol)}&dir=${t.direction}`}
function testCurrentEntryZone(t) {
  if(t?.targetReachedAt&&!['TOUCHING','READY'].includes(t?.reentryStage))return null;
  const useReentry=!!t?.targetReachedAt&&['TOUCHING','READY'].includes(t?.reentryStage)&&Number.isFinite(Number(t?.reentryZoneLow))&&Number.isFinite(Number(t?.reentryZoneHigh));
  const strategyZone=(t?.status==='CONFIRMED'?t?.strategyAtConfirm?.entryZone:null)||t?.strategyProfile?.entryZone||null;
  const low=useReentry?Number(t.reentryZoneLow):Number(strategyZone?.low??t?.setup?.zoneLow),high=useReentry?Number(t.reentryZoneHigh):Number(strategyZone?.high??t?.setup?.zoneHigh);
  return Number.isFinite(low)&&Number.isFinite(high)?{low:Math.min(low,high),high:Math.max(low,high),reentry:useReentry,strategyId:useReentry?'REENTRY':(t?.strategyAtConfirm?.id||t?.strategyProfile?.id||'TREND_PULLBACK')}:null;
}
function testPreferredEntryZone(t) {
  const z=testCurrentEntryZone(t);if(!z)return null;
  const width=Math.max(0,z.high-z.low);if(!(width>0))return {...z};
  const dir=testSignalDirection(t.direction),mid=z.reentry&&Number.isFinite(Number(t.reentryZoneMid))?Number(t.reentryZoneMid):(z.low+z.high)/2;
  const biased=mid-dir*width*.05,half=width*.27;
  return {low:Math.max(z.low,biased-half),high:Math.min(z.high,biased+half),reentry:z.reentry};
}
function testEntryStrategy(t, statusLabel='') {
  const state=String(t?.monitorState||''),status=String(t?.status||''),label=String(statusLabel||testTrackerStatusLabel(t));
  if(status==='INVALID'||status==='DROPPED'||state==='WEAKENING')return '暫停進場，等資料重新同向後再判讀';
  if(t?.targetReachedAt&&!['TOUCHING','READY'].includes(t?.reentryStage))return '已達標，不追價；只等二次回踩';
  if(t?.reentryStage==='TOUCHING')return '二次回踩中，等5分K收回確認';
  if(t?.reentryStage==='READY')return '二次確認完成，只在建議區間內分批';
  const s=t?.strategyAtConfirm||t?.strategyProfile||{},id=String(s.id||'TREND_PULLBACK');
  if(id==='BREAKOUT_RETEST')return s.ready?'突破回測已確認，只在回測區內分批':'突破後等待回測守住，不追突破K';
  if(id==='LIQUIDITY_SWEEP')return s.ready?'掃流動性收回已確認，依保護位分批':'等掃高/掃低後收回＋動能翻向';
  if(id==='MOMENTUM_CONTINUATION')return s.ready?'動能續攻條件完整，僅限小平台/近突破位進場':'強趨勢續攻觀察中，量/OI/Taker未滿不追';
  if(id==='RANGE_EXTREME')return s.ready?'區間極值反轉確認，只做邊界不做中間':'震盪只等區間邊界掃盤/拒絕';
  if(label.includes('續強')||state==='CONTINUING')return '續強但不追突破K，只等可執行區';
  if(state==='CONSOLIDATING')return '盤整中，等策略條件完成；中間區不進';
  return s.ready?'順勢回踩確認完成，只在建議區間內分批':'順勢回踩觀察中，等守住＋短週期重新同向';
}
function testSignalTier(t,{reentry=false}={}) {
  const cal=testCalibratedWinRate(t,{dynamic:true}),rate=Number(cal.rate||0),low=Number(cal.conservativeLow||0);
  const score=Number(reentry?t.reentryScore:(t.monitorScore||t.qualityScore||0)),rank=Number(t.rank||99),ev=t.monitorEvidence||t.lastCheck||{};
  const spread=finiteMetric(ev.spreadBps),chaseAtr=finiteMetric(ev.chaseAtr),adlRisk=String(ev.adlRisk||'unknown').toLowerCase(),fundingCrowded=ev.fundingCrowded===true;
  const adverse=!!(ev.adverse15||ev.adverse30||ev.adverse1h||ev.adverseMarket);
  const noSpreadRisk=!Number.isFinite(spread)||spread<=TEST_SIGNAL_MAX_SPREAD_BPS;
  const noChase=!Number.isFinite(chaseAtr)||chaseAtr<=TEST_SIGNAL_FIRST_MAX_CHASE_ATR;
  const blockers=[];
  if(ev.adverse15)blockers.push('15分逆向');
  if(ev.adverse30)blockers.push('30分逆向');
  if(ev.adverse1h)blockers.push('1小時逆向');
  if(ev.adverseMarket)blockers.push('BTC/ETH大盤逆向');
  if(!noSpreadRisk)blockers.push(`價差>${TEST_SIGNAL_MAX_SPREAD_BPS}bps`);
  if(!noChase)blockers.push(`距離回踩區>${TEST_SIGNAL_FIRST_MAX_CHASE_ATR.toFixed(2)}ATR`);
  if(adlRisk==='high')blockers.push('ADL高風險');
  if(fundingCrowded)blockers.push('Funding擁擠');
  if(t.status==='INVALID'||t.status==='DROPPED')blockers.push('結構失效');
  if(t.monitorState==='WEAKENING')blockers.push('目前轉弱');
  const coverage=Number(t.dataHealth?.coveragePct),dataConfidence=Number(t.dataHealth?.confidencePct),sources=t.dataHealth?.sources||{},cross=t.dataHealth?.crossExchange||{},dir=testSignalDirection(t.direction);
  if(Number.isFinite(coverage)&&coverage<72)blockers.push('資料完整度<72%');
  if(Number.isFinite(dataConfidence)&&dataConfidence<65)blockers.push('資料可信度<65%');
  if(Number(cross?.available||0)>0&&Number(cross?.consensus||0)===-dir)blockers.push('跨交易所趨勢逆向');
  const regime=String(t.marketRegime||ev.marketRegime||'NORMAL');
  if(regime==='LIQUIDATION'&&!['BTCUSDT','ETHUSDT'].includes(t.symbol)&&score<90)blockers.push('清算行情山寨品質<90');
  if(['LIQUIDATION','HIGH_VOL'].includes(regime)&&Number.isFinite(spread)&&spread>8)blockers.push('高波動價差>8bps');
  const hardSafe=blockers.length===0;
  const highMissing=[];
  if(Number.isFinite(coverage)&&coverage<90)highMissing.push('資料完整度<90%');
  if(Number.isFinite(dataConfidence)&&dataConfidence<86)highMissing.push('資料可信度<86%');
  for(const k of ['k5','k15','k30','h1','oi15','oi1h','taker','depth','funding','mark','market','backtest'])if(sources[k]!==true)highMissing.push(`關鍵資料缺:${k}`);
  if(!(sources.topPos===true||sources.topAccount===true))highMissing.push('關鍵資料缺:大戶');
  if(rate<TEST_SIGNAL_HIGH_RATE)highMissing.push(`校準勝率<${TEST_SIGNAL_HIGH_RATE}%`);
  if(low<50)highMissing.push('保守下界<50%');
  if(score<TEST_SIGNAL_HIGH_SCORE)highMissing.push(`品質<${TEST_SIGNAL_HIGH_SCORE}`);
  if(rank>6)highMissing.push('市場熱度排名>6');
  if(Number.isFinite(chaseAtr)&&chaseAtr>TEST_SIGNAL_HIGH_MAX_CHASE_ATR)highMissing.push(`追價>${TEST_SIGNAL_HIGH_MAX_CHASE_ATR.toFixed(2)}ATR`);
  if(regime==='CHOP'&&score<90)highMissing.push('震盪行情品質<90');
  if(['LIQUIDATION','HIGH_VOL'].includes(regime)&&(coverage<95||dataConfidence<90))highMissing.push('高波動需完整度95/可信度90');
  const normalMissing=[];
  if(Number.isFinite(coverage)&&coverage<80)normalMissing.push('資料完整度<80%');
  if(Number.isFinite(dataConfidence)&&dataConfidence<76)normalMissing.push('資料可信度<76%');
  for(const k of ['k5','k15','k30','h1','depth','mark','market','backtest'])if(sources[k]!==true)normalMissing.push(`關鍵資料缺:${k}`);
  if(!(sources.oi===true||sources.taker===true))normalMissing.push('OI/主動資金皆缺');
  if(rate<TEST_SIGNAL_NORMAL_RATE)normalMissing.push(`校準勝率<${TEST_SIGNAL_NORMAL_RATE}%`);
  if(low<43)normalMissing.push('保守下界<43%');
  if(score<TEST_SIGNAL_NORMAL_SCORE)normalMissing.push(`品質<${TEST_SIGNAL_NORMAL_SCORE}`);
  if(rank>9)normalMissing.push('市場熱度排名>9');
  if(regime==='CHOP'&&score<84)normalMissing.push('震盪行情品質<84');
  if(regime==='LIQUIDATION'&&!['BTCUSDT','ETHUSDT'].includes(t.symbol))normalMissing.push('清算行情山寨只允許最高級確認');
  if(!hardSafe)return {tier:'BLOCKED',rate,low,score,rank,blockers,highMissing,normalMissing};
  if(highMissing.length===0)return {tier:'HIGH',rate,low,score,rank,blockers,highMissing,normalMissing};
  if(normalMissing.length===0)return {tier:'NORMAL',rate,low,score,rank,blockers,highMissing,normalMissing};
  return {tier:'VALID',rate,low,score,rank,blockers,highMissing,normalMissing};
}
function testPushCopy(t,statusLabel='') {
  const cal=testCalibratedWinRate(t,{dynamic:true}),rate=Number(cal.rate||t.confirmedWinRate||0),zone=testCurrentEntryZone(t);
  const entry=zone?`${fmtPrice(zone.low)}～${fmtPrice(zone.high)}`:'暫停';
  const label=statusLabel||testTrackerStatusLabel(t)||testMonitorStateLabel(t.monitorState,t.status);
  return {
    title:`${t.symbol}｜${(t.strategyAtConfirm||t.strategyProfile)?.label||'多策略'}｜${label}｜${Number.isFinite(rate)?rate.toFixed(1):'—'}%`,
    body:`進場 ${entry}｜${testEntryStrategy(t,label)}`
  };
}
function testLifecycleMessage(t,explicitTitle='',explicitBody='',statusLabel=''){
  const fallback=testPushCopy(t,statusLabel||'');
  return {title:String(explicitTitle||'').trim()||fallback.title,body:String(explicitBody||'').trim()||fallback.body};
}
async function sendTestLifecyclePush(t, code, explicitTitle, explicitBody, options={}) {
  t.lifecycleNotifications=t.lifecycleNotifications&&typeof t.lifecycleNotifications==='object'?t.lifecycleNotifications:{};
  if(t.lifecycleNotifications[code])return {processed:true,duplicate:true,sent:0};
  const tier=String(options.tier||(options.reentry?t.reentryNotificationTier:t.confirmNotificationTier)||t.confirmNotificationTier||testSignalTier(t,{reentry:!!options.reentry}).tier);
  if(tier==='BLOCKED')return {processed:false,blocked:true,sent:0};
  const entryType=code==='CONFIRMED'||(options.reentry&&String(options.statusLabel||'').includes('二次確認'));
  if(entryType&&TEST_ENTRY_DEBOUNCE_MS>0){await new Promise(r=>setTimeout(r,TEST_ENTRY_DEBOUNCE_MS));const px=finiteMetric(realtimeBestPrice(t.symbol)),stop=finiteMetric(options.reentry?t.reentryStop:t.stop),zone=testCurrentEntryZone(t),atr=finiteMetric(t.setup?.atr5);if(px!=null&&stop!=null){const dir=testSignalDirection(t.direction),target=finiteMetric(options.reentry?t.reentryTarget1R:t.target1R),invalid=dir>0?px<=stop:px>=stop;if(invalid)return {processed:false,blocked:true,sent:0,tier,reason:'debounce-invalidated'};if(target!=null){const passed=dir>0?px>=target:px<=target,rr=dir*(target-px)/Math.max(1e-12,Math.abs(px-stop));if(passed||rr<.85)return {processed:false,blocked:true,sent:0,tier,reason:passed?'debounce-target-passed':'debounce-rr-degraded'};}}if(px!=null&&zone&&atr>0){const dist=t.direction==='LONG'?Math.max(0,px-Number(zone.high)):Math.max(0,Number(zone.low)-px);if(dist/atr>TEST_SIGNAL_FIRST_MAX_CHASE_ATR)return {processed:false,blocked:true,sent:0,tier,reason:'debounce-chased'};}}
  const {title,body}=testLifecycleMessage(t,explicitTitle,explicitBody,options.statusLabel||'');
  const noticeId=`notice-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,noticeSentAt=new Date().toISOString(),noticeSnapshot=realtimeSnapshot(t.symbol),noticeEntryPrice=finiteMetric(realtimeBestPrice(t.symbol))??finiteMetric(options.reentry?t.reentryEntryPrice:t.confirmationPrice),route=testMonitorRoute(t),sep=route.includes('?')?'&':'?';
  const pushStarted=Date.now();
  const delivery=await sendPush({title,body,tag:`test-life-${code}-${t.symbol}-${t.direction}-${Date.now()}`,renotify:true,data:{url:`${route}${sep}notice=${encodeURIComponent(noticeId)}`,noticeId,serverSentAt:noticeSentAt}},{testSignal:true,testSignalTier:tier});
  const pushAcceptedAt=new Date().toISOString(),pushServiceMs=Date.now()-pushStarted;
  // 被使用者通知模式過濾＝事件已處理；若本來符合推播但傳送失敗，保留下一輪重試機會。
  if(delivery.sent>0||delivery.eligible===0)t.lifecycleNotifications[code]=new Date().toISOString();
  t.lastPushAttemptAt=new Date().toISOString();t.lastPushTier=tier;t.lastPushDelivery={...delivery,pushServiceMs};
  if(delivery.sent>0)performanceRecordForNotification(t,code,tier,delivery,{...options,noticeId,noticeSentAt,noticeSnapshot,noticeEntryPrice,pushAcceptedAt,pushServiceMs});
  return {processed:delivery.sent>0||delivery.eligible===0,tier,pushServiceMs,...delivery};
}
function testMonitorEvidence({dir,last,prev,t5,t15,t30,t1h,rsiNow,rsiPrev,macdNow,macdPrev,deriv,market,breakoutLevel,micro}) {
  const belowBreakout2=Number.isFinite(breakoutLevel)&&(dir>0?(last.close<breakoutLevel&&prev.close<breakoutLevel):(last.close>breakoutLevel&&prev.close>breakoutLevel));
  const aboveBreakout2=Number.isFinite(breakoutLevel)&&(dir>0?(last.close>breakoutLevel&&prev.close>breakoutLevel):(last.close<breakoutLevel&&prev.close<breakoutLevel));
  const adverseRsi=dir>0?rsiNow<rsiPrev:rsiNow>rsiPrev;
  const adverseMacd=dir>0?macdNow<macdPrev:macdNow>macdPrev;
  const hasTaker=finiteMetric(deriv?.takerRatio)!=null,hasTop=finiteMetric(deriv?.topPositionRatio)!=null;
  const adverseTaker=hasTaker?(dir>0?Number(deriv.takerRatio)<.96:Number(deriv.takerRatio)>1.04):false;
  const adverseTop=hasTop?(dir>0?Number(deriv.topPositionRatio)<.96:Number(deriv.topPositionRatio)>1.04):false;
  const adverse15=dir>0?(t15.trend<0||(Number(t15.adx14)>=24&&Number(t15.diBias)<0)):(t15.trend>0||(Number(t15.adx14)>=24&&Number(t15.diBias)>0));
  const adverse30=t30? (dir>0?(t30.trend<0&&t30.momentum<=0):(t30.trend>0&&t30.momentum>=0)) : false;
  const adverse1h=t1h? (dir>0?(t1h.trend<0&&t1h.momentum<=0):(t1h.trend>0&&t1h.momentum>=0)) : false;
  const adverseMarket=market.dir!==0&&market.dir!==dir;
  const depth=finiteMetric(micro?.depthImbalance),spread=finiteMetric(micro?.spreadBps),hasDepth=depth!=null;
  const adverseDepth=hasDepth?(dir>0?depth<=-.12:depth>=.12):false;
  const wideSpread=Number.isFinite(spread)&&spread>=9;
  const weakFlags=[belowBreakout2,adverseRsi,adverseMacd,adverseTaker,adverseTop,adverse15,adverse30,adverse1h,adverseMarket,adverseDepth].filter(Boolean).length;
  const supportiveTaker=hasTaker?(dir>0?Number(deriv.takerRatio)>=.99:Number(deriv.takerRatio)<=1.01):false;
  const supportiveTop=hasTop?(dir>0?Number(deriv.topPositionRatio)>=.99:Number(deriv.topPositionRatio)<=1.01):false;
  const supportiveMomentum=dir>0?(rsiNow>=rsiPrev&&macdNow>=macdPrev):(rsiNow<=rsiPrev&&macdNow<=macdPrev);
  const supportiveDepth=hasDepth?(dir>0?depth>=.04:depth<=-.04):false;
  const supportive15=dir>0?t15.trend>=0:t15.trend<=0;
  const supportive30=!t30||(dir>0?t30.trend>=0:t30.trend<=0);
  const supportive1h=!t1h||(dir>0?t1h.trend>=0:t1h.trend<=0);
  return {
    belowBreakout2,aboveBreakout2,weakFlags,adverseRsi,adverseMacd,adverseTaker,adverseTop,adverse15,adverse30,adverse1h,adverseMarket,adverseDepth,wideSpread,
    supportiveTaker,supportiveTop,supportiveMomentum,supportiveDepth,supportive15,supportive30,supportive1h,hasTaker,hasTop,hasDepth,depthImbalance:depth,spreadBps:spread
  };
}
function testDynamicMonitorScore(t,{dir,t5,t15,t30,t1h,deriv,market,evidence}) {
  let score=Number(t.qualityScore||t.setup?.setupScore||70);
  score+=t5.trend===dir?5:t5.trend===-dir?-6:0;
  score+=t5.momentum===dir?5:t5.momentum===-dir?-5:0;
  score+=t15.trend===dir?5:t15.trend===-dir?-7:0;
  if(t30)score+=t30.trend===dir?4:t30.trend===-dir?-6:0;
  if(t1h)score+=t1h.trend===dir?4:t1h.trend===-dir?-5:0;
  score+=market.dir===dir?4:market.dir===-dir?-5:0;
  score+=evidence.supportiveTaker?3:evidence.adverseTaker?-4:0;
  score+=evidence.supportiveTop?2:evidence.adverseTop?-3:0;
  score+=evidence.supportiveDepth?3:evidence.adverseDepth?-4:0;
  if(evidence.wideSpread)score-=3;
  if(t.breakoutAt)score+=4;
  if(t.monitorState==='WEAKENING')score-=8;
  if(t.status==='INVALID')score-=10;
  return clamp(Math.round(score),0,100);
}
function testMonitorEvidenceView(t,evidence,deriv,score) {
  return {
    at:new Date().toISOString(),weakFlags:evidence.weakFlags,breakoutHeld:evidence.aboveBreakout2,adverseMarket:evidence.adverseMarket,
    adverse15:evidence.adverse15,adverse30:evidence.adverse30,adverse1h:evidence.adverse1h,depthImbalance:finiteMetric(evidence.depthImbalance)!=null?Number(Number(evidence.depthImbalance).toFixed(3)):null,
    spreadBps:Number.isFinite(evidence.spreadBps)?Number(evidence.spreadBps.toFixed(2)):null,
    topPositionRatio:finiteMetric(deriv?.topPositionRatio)!=null?Number(Number(deriv.topPositionRatio).toFixed(2)):null,globalLongShortRatio:finiteMetric(deriv?.globalLongShortRatio)!=null?Number(Number(deriv.globalLongShortRatio).toFixed(2)):null,
    takerRatio:finiteMetric(deriv?.takerRatio)!=null?Number(Number(deriv.takerRatio).toFixed(2)):null,oiChangePct:finiteMetric(deriv?.oiChangePct)!=null?Number(Number(deriv.oiChangePct).toFixed(2)):null,
    chaseAtr:finiteMetric(t?.lastCheck?.chaseAtr)!=null?Number(Number(t.lastCheck.chaseAtr).toFixed(2)):null,adlRisk:t?.lastCheck?.adlRisk||'unknown',fundingPct:t?.lastCheck?.fundingPct??null,fundingCrowded:t?.lastCheck?.fundingCrowded===true,score
  };
}
async function testEnterInvalidation(t,{reason,last,protection,entry,dir}) {
  const now=new Date().toISOString();
  if(t.status!=='INVALID'){
    t.status='INVALID';t.statusLabel='失效';t.invalidatedAt=now;t.invalidReason=reason||'STRUCTURE';
    t.reactivateUntil=new Date(Date.now()+TEST_MONITOR_REACTIVATE_MS).toISOString();t.currentPrice=last.close;t.updatedAt=now;
    t.resultReturnPct=Number((dir*(last.close-entry)/entry*100).toFixed(2));testSetState(t,'INVALIDATED','失效',now);
    await sendTestLifecyclePush(
      t,`INVALID-${Number(t.monitorCycle||0)}`,`❌ ${t.symbol} 訊號失效`,
      `${t.direction==='LONG'?'做多':'做空'}｜${reason==='MODEL_RISK'?'模型風險位觸及':'結構保護位失守'} ${fmtPrice(protection)}｜不是平倉指令，30分內監看能否收復｜點開監控判讀`
    );
  }
  return t;
}
async function testDropTracker(t,{reason,last,dir,entry}) {
  const now=new Date().toISOString();t.status='DROPPED';t.statusLabel='移出監控';t.droppedAt=now;t.finishedAt=now;t.updatedAt=now;
  t.currentPrice=last?.close??t.currentPrice;t.resultReturnPct=Number.isFinite(Number(entry))&&Number(entry)>0&&last?Number((dir*(last.close-entry)/entry*100).toFixed(2)):Number(t.resultReturnPct||0);
  testSetState(t,'INVALIDATED','移出',now);
  await sendTestLifecyclePush(t,`DROPPED-${Number(t.monitorCycle||0)}`,`⛔ ${t.symbol} 已移出監控`,`${reason}｜之後若重新進入建議排名，需重新完成回踩確認才會再加入`);
  archiveTestResult(t);return t;
}
async function updateInvalidMonitorState(t,{rows5,rows15,t5,t15,t30,t1h,deriv,market,rsi,macd,micro}) {
  const dir=testSignalDirection(t.direction),last=rows5.at(-1),prev=rows5.at(-2),entry=Number(t.confirmationPrice),protection=Number(t.structureProtection||t.stop);
  const ri=rows5.length-1,rsiNow=Number(rsi[ri]),rsiPrev=Number(rsi[ri-1]),macdNow=Number(macd.hist[ri]),macdPrev=Number(macd.hist[ri-1]);
  const evidence=testMonitorEvidence({dir,last,prev,t5,t15,t30,t1h,rsiNow,rsiPrev,macdNow,macdPrev,deriv,market,breakoutLevel:Number(t.breakoutLevel),micro});
  const newBar=Number(t.lastMonitorBarTime)!==Number(last.openTime);if(newBar)t.lastMonitorBarTime=last.openTime;
  const score=testDynamicMonitorScore(t,{dir,t5,t15,t30,t1h,deriv,market,evidence});t.monitorScore=score;t.monitorEvidence=testMonitorEvidenceView(t,evidence,deriv,score);
  const protectionRecovered=Number.isFinite(protection)&&(dir>0?(last.close>protection&&prev.close>protection):(last.close<protection&&prev.close<protection));
  const supportCount=[evidence.supportiveMomentum,evidence.supportiveTaker,evidence.supportiveDepth,evidence.supportive15,evidence.supportive30,evidence.supportive1h,!evidence.adverseMarket].filter(Boolean).length;
  if(newBar){
    if(score<TEST_MONITOR_BAD_SCORE&&evidence.weakFlags>=TEST_MONITOR_WEAK_FLAGS)t.badScoreStreak=Number(t.badScoreStreak||0)+1;else t.badScoreStreak=0;
    if(protectionRecovered&&supportCount>=5&&score>=TEST_REARM_SCORE)t.recoverStreak=Number(t.recoverStreak||0)+1;else t.recoverStreak=0;
  }
  const last15=rows15.at(-1),prev15=rows15.at(-2),orig=Number(t.setup?.invalidation);
  const hard15=Number.isFinite(orig)&&last15&&prev15?(dir>0?(last15.close<orig&&prev15.close<orig):(last15.close>orig&&prev15.close>orig)):false;
  const atr15=Number(t.setup?.atr15||t15.atr14||0),deepBreak=Number.isFinite(orig)&&atr15>0?(dir>0?last.close<orig-atr15*.65:last.close>orig+atr15*.65):false;
  if(hard15||(deepBreak&&evidence.weakFlags>=Math.max(TEST_MONITOR_WEAK_FLAGS,4))){
    return testDropTracker(t,{reason:'原始結構已明確破壞',last,dir,entry});
  }
  if(Number(t.badScoreStreak||0)>=TEST_MONITOR_BAD_BARS&&evidence.adverse15&&(evidence.adverse30||evidence.adverse1h||evidence.adverseMarket)){
    return testDropTracker(t,{reason:`連續 ${TEST_MONITOR_BAD_BARS} 根5分K低於強度 ${TEST_MONITOR_BAD_SCORE}，且15分/大盤同步轉弱`,last,dir,entry});
  }
  if(Number(t.recoverStreak||0)>=TEST_MONITOR_STATE_BARS){
    const now=new Date().toISOString();t.status='CONFIRMED';t.statusLabel='未破確認';t.reactivatedAt=now;t.updatedAt=now;t.reactivateUntil=null;
    t.weakStreak=0;t.badScoreStreak=0;t.recoverStreak=0;
    const backAboveBreakout=evidence.aboveBreakout2;
    testSetState(t,backAboveBreakout?'CONTINUING':'RECOVERING',backAboveBreakout?'續強':'轉強',now);
    await sendTestLifecyclePush(t,`REARM-${Number(t.monitorCycle||0)}`,`🔄 ${t.symbol} 失效後重新轉強`,`${t.direction==='LONG'?'做多':'做空'}｜連續收復保護結構＋動能/資金重新同向｜點開監控判讀`);
    t.monitorCycle=Number(t.monitorCycle||0)+1;return t;
  }
  if(t.reactivateUntil&&Date.now()>=new Date(t.reactivateUntil).getTime()){
    return testDropTracker(t,{reason:'失效後 30 分鐘仍未重新收復保護結構',last,dir,entry});
  }
  t.updatedAt=new Date().toISOString();return t;
}
async function updateConfirmedMonitorState(t,{rows5,rows15,t5,t15,t30,t1h,deriv,market,rsi,macd,micro}) {
  const dir=testSignalDirection(t.direction),last=rows5.at(-1),prev=rows5.at(-2),entry=Number(t.confirmationPrice),risk=Math.abs(Number(t.target1R)-entry)||Math.abs(entry-Number(t.stop));
  if(!Number.isFinite(t.breakoutLevel)){
    const prior=rows5.slice(-22,-2);t.breakoutLevel=dir>0?Math.max(...prior.map(x=>x.high)):Math.min(...prior.map(x=>x.low));
  }
  const ri=rows5.length-1,rsiNow=Number(rsi[ri]),rsiPrev=Number(rsi[ri-1]),macdNow=Number(macd.hist[ri]),macdPrev=Number(macd.hist[ri-1]);
  const evidence=testMonitorEvidence({dir,last,prev,t5,t15,t30,t1h,rsiNow,rsiPrev,macdNow,macdPrev,deriv,market,breakoutLevel:Number(t.breakoutLevel),micro});
  const newBar=Number(t.lastMonitorBarTime)!==Number(last.openTime);if(newBar)t.lastMonitorBarTime=last.openTime;
  const breakout2=evidence.aboveBreakout2;
  if(!t.breakoutAt&&breakout2){
    const at=new Date(last.closeTime||Date.now()).toISOString();t.breakoutAt=at;
    const cushion=Number(t.setup?.atr5||t5.atr14||0)*.55;
    t.structureProtection=dir>0?Math.max(Number(t.stop),Number(t.breakoutLevel)-cushion):Math.min(Number(t.stop),Number(t.breakoutLevel)+cushion);
    testSetState(t,'CONTINUING','續強',at);
    await sendTestLifecyclePush(t,'CONTINUING',`🚀 ${t.symbol} 突破續強`,`${t.direction==='LONG'?'做多':'做空'}｜突破 ${fmtPrice(t.breakoutLevel)}｜保護 ${fmtPrice(t.structureProtection)}｜點開監控判讀`);
  }
  const score=testDynamicMonitorScore(t,{dir,t5,t15,t30,t1h,deriv,market,evidence});t.monitorScore=score;t.monitorEvidence=testMonitorEvidenceView(t,evidence,deriv,score);
  const protection=Number(t.structureProtection||t.stop),last15=rows15.at(-1),prev15=rows15.at(-2);
  const closeBreak2=dir>0?(last.close<protection&&prev.close<protection):(last.close>protection&&prev.close>protection);
  const close15Break=last15&&prev15?(dir>0?(last15.close<protection&&prev15.close<protection):(last15.close>protection&&prev15.close>protection)):false;
  if(t.breakoutAt&&(close15Break||(closeBreak2&&evidence.weakFlags>=TEST_MONITOR_WEAK_FLAGS))){
    return testEnterInvalidation(t,{reason:'STRUCTURE',last,protection,entry,dir});
  }
  if(newBar){
    if(evidence.weakFlags>=TEST_MONITOR_WEAK_FLAGS)t.weakStreak=Number(t.weakStreak||0)+1;else t.weakStreak=0;
    const recovered=(t.breakoutAt?evidence.aboveBreakout2:true)&&evidence.supportiveMomentum&&evidence.supportiveTaker&&!evidence.adverseMarket&&!evidence.adverse15;
    if(recovered)t.recoverStreak=Number(t.recoverStreak||0)+1;else t.recoverStreak=0;
    if(score<TEST_MONITOR_BAD_SCORE&&evidence.weakFlags>=TEST_MONITOR_WEAK_FLAGS)t.badScoreStreak=Number(t.badScoreStreak||0)+1;else t.badScoreStreak=0;
  }
  if(t.monitorState!=='WEAKENING'&&Number(t.weakStreak||0)>=TEST_MONITOR_STATE_BARS){
    const now=new Date().toISOString();t.weakSince=now;testSetState(t,'WEAKENING','轉弱',now);
    await sendTestLifecyclePush(t,`WEAKENING-${Number(t.monitorCycle||0)}`,`⚠️ ${t.symbol} 轉弱警戒`,`${t.direction==='LONG'?'做多':'做空'}｜${t.breakoutAt?'突破後':'成立後'}動能轉弱，先不要追｜點開監控判讀`);
  }else if(t.monitorState==='WEAKENING'&&Number(t.recoverStreak||0)>=TEST_MONITOR_STATE_BARS){
    const now=new Date().toISOString();testSetState(t,'RECOVERING','轉強',now);t.weakStreak=0;t.badScoreStreak=0;t.weakSince=null;
    await sendTestLifecyclePush(t,`RECOVERING-${Number(t.monitorCycle||0)}`,`🔄 ${t.symbol} 重新轉強`,`${t.direction==='LONG'?'做多':'做空'}｜警戒解除，動能重新同向｜點開監控判讀`);t.monitorCycle=Number(t.monitorCycle||0)+1;
  }else if(t.monitorState==='RECOVERING'&&newBar&&evidence.supportiveMomentum){
    testSetState(t,t.breakoutAt?'CONTINUING':'STRONG',t.breakoutAt?'續強':'強勢',new Date().toISOString());
  }else if(!['WEAKENING','RECOVERING','CONTINUING'].includes(t.monitorState)){
    const favorable=Number.isFinite(risk)&&risk>0?dir*(last.close-entry)/risk:0;
    const strong=(t5.trend===dir||t5.momentum===dir)&&(t15.trend===dir||t15.momentum===dir)&&(!t1h||t1h.trend!==-dir)&&!evidence.adverseMarket&&favorable>=.15;
    const recent6=rows5.slice(-6),atr5=Math.max(Number(t5?.atr14||t.setup?.atr5||0),Math.abs(last.close)*.0004);
    const range6=recent6.length?Math.max(...recent6.map(c=>Number(c.high)))-Math.min(...recent6.map(c=>Number(c.low))):Infinity;
    const quietRange=Number.isFinite(range6)&&atr5>0&&range6<=atr5*1.9;
    const quietVolume=Number(t5?.volumeRatio||1)<=1.05;
    const consolidating=!strong&&quietRange&&quietVolume&&evidence.weakFlags<=1&&!evidence.adverse15&&!evidence.adverse30&&!evidence.adverse1h&&!evidence.adverseMarket&&favorable>-0.20&&favorable<0.35;
    testSetState(t,strong?'STRONG':consolidating?'CONSOLIDATING':'CONFIRMED',strong?'強勢':consolidating?'盤整':'成立',new Date().toISOString());
  }
  if(t.monitorState==='WEAKENING'){
    const weakAge=t.weakSince?Date.now()-new Date(t.weakSince).getTime():0;
    if(Number(t.badScoreStreak||0)>=TEST_MONITOR_BAD_BARS&&evidence.adverse15&&(evidence.adverse30||evidence.adverse1h||evidence.adverseMarket)){
      return testDropTracker(t,{reason:`連續 ${TEST_MONITOR_BAD_BARS} 根5分K低於強度 ${TEST_MONITOR_BAD_SCORE}，且高週期同步轉弱`,last,dir,entry});
    }
    if(weakAge>=TEST_MONITOR_WEAK_MAX_MS){
      return testDropTracker(t,{reason:'轉弱狀態持續 30 分鐘仍未完成重新轉強確認',last,dir,entry});
    }
  }
  return t;
}

function testReentryLevels(t, rows5, t5) {
  const dir=testSignalDirection(t.direction),at=t.targetReachedAt?new Date(t.targetReachedAt).getTime():0;
  const after=(rows5||[]).filter(c=>Number(c.closeTime||c.openTime)>=at);
  if(after.length<TEST_REENTRY_MIN_BARS)return null;
  const target=Number(t.target1R),atr=Math.max(Number(t.setup?.atr5||t5?.atr14||0),Math.abs(target)*.0005);
  if(!(target>0&&atr>0))return null;
  const extreme=dir>0?Math.max(...after.map(c=>Number(c.high))):Math.min(...after.map(c=>Number(c.low)));
  const extension=Math.abs(extreme-target);
  if(extension<atr*.65)return null; // 達標後沒有再拉出一段，不建立二進區，避免原地追價
  const low=dir>0?extreme-extension*.618:extreme+extension*.382;
  const high=dir>0?extreme-extension*.382:extreme+extension*.618;
  const zoneLow=Math.min(low,high),zoneHigh=Math.max(low,high),zoneMid=(zoneLow+zoneHigh)/2;
  const invalidation=dir>0?zoneLow-atr*.35:zoneHigh+atr*.35;
  return {extreme,zoneLow,zoneHigh,zoneMid,invalidation,atr,extension};
}
async function updateTargetReentryState(t,{rows5,rows15,t5,t15,t30,t1h,deriv,market,rsi,macd,micro}) {
  if(!t.targetReachedAt)return t;
  const dir=testSignalDirection(t.direction),last=rows5.at(-1),prev=rows5.at(-2);
  if(['WIN','FAILED'].includes(t.reentryStage))return t;
  if(t.reentryStage==='READY'&&t.reentryConfirmAt&&Number.isFinite(Number(t.reentryEntryPrice))&&Number.isFinite(Number(t.reentryStop))&&Number.isFinite(Number(t.reentryTarget1R))){
    const entry=Number(t.reentryEntryPrice),stop=Number(t.reentryStop),target=Number(t.reentryTarget1R),base=new Date(t.reentryConfirmAt).getTime()-5*60*1000;
    const bars=rows5.filter(c=>Number(c.openTime)>=base);
    for(const c of bars){
      const hitStop=dir>0?c.low<=stop:c.high>=stop,hitTarget=dir>0?c.high>=target:c.low<=target;
      if(hitStop){
        const at=new Date(c.closeTime||Date.now()).toISOString(),ret=Number((dir*(stop-entry)/entry*100).toFixed(2));
        t.reentryStage='FAILED';t.reentryStageAt=at;testSetState(t,'REENTRY_FAILED','二進失效',at);archiveTestReentryResult(t,'LOSS',at,ret);
        await sendTestLifecyclePush(t,`REENTRY-LOSS-${Number(t.monitorCycle||0)}`,`❌ ${t.symbol} 二次進場失效`,`${t.direction==='LONG'?'做多':'做空'}｜二進 ${fmtPrice(entry)} → 失效 ${fmtPrice(stop)}｜點開監控判讀`);
        return t;
      }
      if(hitTarget){
        const at=new Date(c.closeTime||Date.now()).toISOString(),ret=Number((dir*(target-entry)/entry*100).toFixed(2));
        t.reentryStage='WIN';t.reentryStageAt=at;testSetState(t,'REENTRY_WIN','二進達標',at);archiveTestReentryResult(t,'WIN',at,ret);
        await sendTestLifecyclePush(t,`REENTRY-WIN-${Number(t.monitorCycle||0)}`,`🎯 ${t.symbol} 二次進場 1R 達成`,`${t.direction==='LONG'?'做多':'做空'}｜二進 ${fmtPrice(entry)} → 1R ${fmtPrice(target)}｜點開監控判讀`);
        return t;
      }
    }
  }
  const levels=testReentryLevels(t,rows5,t5);
  if(!levels){
    t.reentryStage='WAIT_PULLBACK';t.reentryStageAt=t.reentryStageAt||t.targetReachedAt;
    if(!['WEAKENING','RECOVERING'].includes(t.monitorState))testSetState(t,'REENTRY_WAIT','等二進',t.reentryStageAt);
    return t;
  }
  Object.assign(t,{reentryExtreme:levels.extreme,reentryZoneLow:levels.zoneLow,reentryZoneHigh:levels.zoneHigh,reentryZoneMid:levels.zoneMid,reentryInvalidation:levels.invalidation});
  const inZone=rows5.slice(-3).some(c=>Number(c.low)<=levels.zoneHigh&&Number(c.high)>=levels.zoneLow);
  const ri=rows5.length-1,rsiNow=Number(rsi[ri]),rsiPrev=Number(rsi[ri-1]),macdNow=Number(macd.hist[ri]),macdPrev=Number(macd.hist[ri-1]);
  const momentum=dir>0?(rsiNow>=44&&rsiNow<=72&&rsiNow>=rsiPrev&&macdNow>=macdPrev):(rsiNow<=56&&rsiNow>=28&&rsiNow<=rsiPrev&&macdNow<=macdPrev);
  const reclaim=dir>0?last.close>levels.zoneMid:last.close<levels.zoneMid;
  const candleOk=dir>0?last.close>last.open:last.close<last.open;
  const t5Ok=t5.trend!==-dir&&t5.momentum!==-dir;
  const t15Ok=t15.trend===dir||t15.momentum===dir;
  const h1Ok=!t1h||t1h.trend!==-dir;
  const marketOk=market.dir!==-dir;
  const takerVal=finiteMetric(deriv?.takerRatio),topVal=finiteMetric(deriv?.topPositionRatio),depth=finiteMetric(micro?.depthImbalance);
  const takerOk=takerVal!=null?(dir>0?takerVal>=.99:takerVal<=1.01):false;
  const topOk=topVal!=null?(dir>0?topVal>=.98:topVal<=1.02):false;
  const depthOk=depth!=null?(dir>0?depth>=-.04:depth<=.04):false;
  const vwap5=testVwap(rows5,48),nearRef=[t5.ema20,t15.ema20,t15.poc,vwap5].filter(Number.isFinite).some(x=>Math.abs(last.close-x)<=levels.atr*.55);
  const chaseAtr=Math.abs(last.close-levels.zoneMid)/Math.max(levels.atr,1e-9),notChasing=chaseAtr<=TEST_REENTRY_MAX_CHASE_ATR||inZone;
  const rankOk=Number(t.rank||99)<=TEST_REENTRY_MAX_RANK||testMonitorPriority(t)>=76;
  let score=50;
  score+=inZone?10:0;score+=reclaim?8:0;score+=candleOk?5:0;score+=momentum?8:0;score+=t5Ok?5:-5;score+=t15Ok?7:-7;score+=h1Ok?4:-5;
  score+=marketOk?5:-7;score+=takerOk?4:-4;score+=topOk?3:-3;score+=depthOk?3:-3;score+=nearRef?6:0;score+=notChasing?6:-12;score+=rankOk?6:-8;
  score=clamp(Math.round(score),0,100);t.reentryScore=score;
  t.reentryReasons=[
    inZone?'回到二次回踩區':null,reclaim?'重新收回區間中線':null,momentum?'5分動能回升':null,t15Ok?'15分同向':null,h1Ok?'1小時未反向':null,
    takerOk?'主動買賣支持':null,topOk?'大戶持倉未逆向':null,depthOk?'委託簿未逆向':null,nearRef?'EMA/POC/VWAP共振':null,notChasing?'非追價距離':null,rankOk?'排名/優先分合格':null
  ].filter(Boolean).slice(0,8);
  const newBar=Number(t.reentryLastBarTime)!==Number(last.openTime);if(newBar)t.reentryLastBarTime=last.openTime;
  if(inZone&&!t.reentryTouchAt){
    t.reentryTouchAt=new Date().toISOString();t.reentryStage='TOUCHING';t.reentryStageAt=t.reentryTouchAt;
    t.reentryNotificationTier=testSignalTier(t,{reentry:true}).tier;
    if(t.reentryNotificationTier!=='BLOCKED')await sendTestLifecyclePush(t,`REENTRY-TOUCH-${Number(t.monitorCycle||0)}`,'','',{reentry:true,tier:t.reentryNotificationTier,statusLabel:'二次回踩中'});
  }
  const confirmNow=inZone&&reclaim&&candleOk&&momentum&&t5Ok&&t15Ok&&h1Ok&&marketOk&&takerOk&&topOk&&depthOk&&nearRef&&notChasing&&rankOk&&score>=TEST_REENTRY_SCORE;
  if(newBar){t.reentryConfirmStreak=confirmNow?Number(t.reentryConfirmStreak||0)+1:0}
  if(t.reentryStage==='READY'){
    if(!['WEAKENING','RECOVERING'].includes(t.monitorState))testSetState(t,'REENTRY_READY','二次確認',t.reentryConfirmAt||t.updatedAt);
    return t;
  }
  if(Number(t.reentryConfirmStreak||0)>=TEST_REENTRY_CONFIRM_BARS){
    const now=new Date().toISOString(),entry=Number(last.close),risk=Math.max(levels.atr*.55,Math.abs(entry-levels.invalidation));
    t.reentryStage='READY';t.reentryStageAt=now;t.reentryConfirmAt=now;t.reentryEntryPrice=entry;t.reentryStop=entry-dir*risk;t.reentryTarget1R=entry+dir*risk;
    testSetState(t,'REENTRY_READY','二次確認',now);
    t.reentryNotificationTier=testSignalTier(t,{reentry:true}).tier;
    await sendTestLifecyclePush(t,`REENTRY-${Number(t.monitorCycle||0)}`,'','',{reentry:true,tier:t.reentryNotificationTier,statusLabel:'二次確認'});
    return t;
  }
  if(inZone){
    t.reentryStage='TOUCHING';if(!['WEAKENING','RECOVERING'].includes(t.monitorState))testSetState(t,'REENTRY_TOUCH','二次回踩',t.reentryTouchAt||new Date().toISOString());
  }else{
    t.reentryStage='WAIT_PULLBACK';if(!['WEAKENING','RECOVERING'].includes(t.monitorState))testSetState(t,'REENTRY_WAIT','等二進',t.reentryStageAt||t.targetReachedAt);
  }
  return t;
}
function testBuildLiveSnapshot(t,{rows5,rows15,t5,t15,t30,t1h,deriv,micro,riskCtx,market,crossCtx}){
  const dir=testSignalDirection(t.direction),last=rows5.at(-1),prev=rows5.at(-2),rsi=ideaRsiSeries(rows5.map(x=>x.close),14),macd=ideaMacdSeries(rows5.map(x=>x.close)),ri=rows5.length-1;
  const rsiNow=finiteMetric(rsi[ri]),rsiPrev=finiteMetric(rsi[ri-1]),macdNow=finiteMetric(macd.hist[ri]),macdPrev=finiteMetric(macd.hist[ri-1]);
  const zone=testPreferredEntryZone(t)||testCurrentEntryZone(t),zoneMid=zone?(Number(zone.low)+Number(zone.high))/2:finiteMetric(t.setup?.zoneMid),atr=finiteMetric(t5?.atr14||t.setup?.atr5),px=finiteMetric(t.livePrice)||finiteMetric(riskCtx?.markPrice)||finiteMetric(last?.close);
  const chaseAtr=px!=null&&zoneMid!=null&&atr>0?Math.abs(px-zoneMid)/atr:null,marketAlign=market?.dir===0?0:(market?.dir===dir?1:-1),crossAlign=crossCtx?.consensus===0?0:(crossCtx?.consensus===dir?1:-1);
  const zlow=zone?Number(zone.low):finiteMetric(t.setup?.zoneLow),zhigh=zone?Number(zone.high):finiteMetric(t.setup?.zoneHigh),inZone=Number.isFinite(zlow)&&Number.isFinite(zhigh)&&last?Number(last.low)<=Math.max(zlow,zhigh)&&Number(last.high)>=Math.min(zlow,zhigh):false;
  const reclaim=zoneMid!=null&&last?(dir>0?Number(last.close)>zoneMid:Number(last.close)<zoneMid):null,candleOk=last?(dir>0?Number(last.close)>Number(last.open):Number(last.close)<Number(last.open)):null;
  const range=last?Math.max(1e-12,Number(last.high)-Number(last.low)):0,body=last?Math.abs(Number(last.close)-Number(last.open)):0,wickReject=last?(dir>0?(Math.min(Number(last.open),Number(last.close))-Number(last.low))>Math.max(body*.65,range*.18):(Number(last.high)-Math.max(Number(last.open),Number(last.close)))>Math.max(body*.65,range*.18)):null;
  const momentum=rsiNow!=null&&rsiPrev!=null&&macdNow!=null&&macdPrev!=null?(dir>0?(rsiNow>=rsiPrev&&macdNow>=macdPrev):(rsiNow<=rsiPrev&&macdNow<=macdPrev)):null;
  const macdImprove=macdNow!=null&&macdPrev!=null?(dir>0?macdNow>=macdPrev:macdNow<=macdPrev):null;
  return {...(t.lastCheck||{}),at:new Date().toISOString(),inZone,reclaim,candleOk,wicker:wickReject,momentum,macdImprove,
    volumeRatio:finiteMetric(t5?.volumeRatio),volumeRatio15:finiteMetric(t15?.volumeRatio),rsi5:rsiNow,rsi15:finiteMetric(t15?.rsi14),macd5:macdNow,macd15:finiteMetric(t15?.macdHist),adx5:finiteMetric(t5?.adx14),adx15:finiteMetric(t15?.adx14),atrPct5:finiteMetric(t5?.atrPct),
    oiChangePct:finiteMetric(deriv?.oiChangePct),oi5mChangePct:finiteMetric(deriv?.oi5mChangePct),oi15mChangePct:finiteMetric(deriv?.oi15mChangePct),oi1hChangePct:finiteMetric(deriv?.oi1hChangePct),takerRatio:finiteMetric(deriv?.takerRatio),topPositionRatio:finiteMetric(deriv?.topPositionRatio),topAccountRatio:finiteMetric(deriv?.topAccountRatio),globalLongShortRatio:finiteMetric(deriv?.globalLongShortRatio),
    depthImbalance:finiteMetric(micro?.depthImbalance),spreadBps:finiteMetric(micro?.spreadBps),bidNotional:finiteMetric(micro?.bidNotional),askNotional:finiteMetric(micro?.askNotional),chaseAtr:finiteMetric(chaseAtr),
    adlRisk:String(riskCtx?.adlRisk||'unknown').toLowerCase(),fundingPct:finiteMetric(riskCtx?.fundingPct),basisPct:finiteMetric(riskCtx?.basisPct),annualizedBasisPct:finiteMetric(riskCtx?.annualizedBasisPct),markPrice:finiteMetric(riskCtx?.markPrice),indexPrice:finiteMetric(riskCtx?.indexPrice),nextFundingTime:finiteMetric(riskCtx?.nextFundingTime),
    fundingCrowded:finiteMetric(riskCtx?.fundingPct)!=null&&(dir>0?Number(riskCtx.fundingPct)>=.08:Number(riskCtx.fundingPct)<=-.08),t30Trend:t30?.trend??null,h1Trend:t1h?.trend??null,marketAlign,crossAlign,crossExchange:crossCtx||null,marketRegime:market?.regime||'UNKNOWN',liquidation5mUsd:finiteMetric(market?.liquidation5mUsd),realtime:realtimeSnapshot(t.symbol),
    metricSources:{...(t.lastCheck?.metricSources||{}),...(deriv?._source||{}),...(micro?._source||{}),...(riskCtx?._source||{})}
  };
}

async function analyzeTestTracker(t, market) {
  if(terminalTestStatus(t.status))return t;
  const needSetup=!t.setup;
  const [c5,c15,c30,c1h,deriv,micro,riskCtx,crossCtx,backtest5]=await Promise.all([
    testFetchCandles(t.symbol,'5m',500),
    testFetchCandles(t.symbol,'15m',260),
    testFetchCandles(t.symbol,'30m',220).catch(()=>null),
    testFetchCandles(t.symbol,'1h',180).catch(()=>null),
    testFetchDerivatives(t.symbol),
    testFetchMicrostructure(t.symbol).catch(()=>({depthImbalance:null,spreadBps:null,_health:{depth:false},_source:{depth:null},_errors:{fatal:'fetch failed'}})),
    testFetchRiskContext(t.symbol).catch(()=>({adlRisk:'unknown',fundingPct:null,_health:{funding:false,basis:false,adl:false,mark:false},_source:{}})),
    testFetchCrossExchange(t.symbol).catch(()=>({enabled:true,available:0,total:2,consensus:0,bybit:{ok:false},okx:{ok:false}})),
    needSetup?testFetchBacktestCandles(t.symbol,'5m',2).catch(()=>null):Promise.resolve(null)
  ]);
  const rows5=closedTestCandles(c5),rows15=closedTestCandles(c15),rows30=c30?closedTestCandles(c30):[],rows1h=c1h?closedTestCandles(c1h):[];
  const realtime=applyRealtimeOverlay(t.symbol,deriv,micro,riskCtx);t.marketRegime=market?.regime||'UNKNOWN';
  if(rows5.length<80||rows15.length<80)throw new Error('candles short');
  if(!t.setup)t.setup=buildTestSetup(t.idea,c5,c15,backtest5?.length?backtest5:c5);
  const setup=t.setup,dir=testSignalDirection(t.direction),last=rows5.at(-1),prev=rows5.at(-2),t5=technicalSnapshot(rows5),t15=technicalSnapshot(rows15),t30=rows30.length>=60?technicalSnapshot(rows30):null,t1h=rows1h.length>=60?technicalSnapshot(rows1h):null,rsi=ideaRsiSeries(rows5.map(x=>x.close),14),macd=ideaMacdSeries(rows5.map(x=>x.close));
  // V9.0：時間顯示簡化；盤整/等待與資料延遲分離。指標以已收 K 判讀，現價用最新 mark price。
  const evaluatedAt=new Date().toISOString();
  const realtimePx=Number(realtimeBestPrice(t.symbol));
  const liveMark=Number.isFinite(realtimePx)&&realtimePx>0?realtimePx:Number(markPrices.get(cleanFuturesSymbol(t.symbol)));
  t.lastEvaluatedAt=evaluatedAt;
  t.lastEvaluatedBarAt=last?.closeTime?new Date(last.closeTime).toISOString():null;
  t.lastEvaluationError=null;
  t.lastEvaluationErrorAt=null;
  if(Number.isFinite(liveMark)&&liveMark>0)t.livePrice=liveMark;
  t.lastCheck=testBuildLiveSnapshot(t,{rows5,rows15,t5,t15,t30,t1h,deriv,micro,riskCtx,market,crossCtx});
  const ksrc=(interval,limit)=>testCandleSourceCache.get(`${cleanFuturesSymbol(t.symbol)}:${interval}:${limit}`)||null;
  const btSample=Number(t.setup?.backtest?.sample||0);
  const oi15Ok=deriv?._health?.oi===true&&finiteMetric(deriv?.oi15mChangePct)!=null;
  const oi1hOk=deriv?._health?.oi===true&&finiteMetric(deriv?.oi1hChangePct)!=null;
  const sourceFlags={
    k5:rows5.length>=80,k15:rows15.length>=80,k30:rows30.length>=60,h1:rows1h.length>=60,
    oi:oi15Ok||oi1hOk,oi15:oi15Ok,oi1h:oi1hOk,taker:deriv?._health?.taker===true,globalLs:deriv?._health?.globalLs===true,topPos:deriv?._health?.topPos===true,topAccount:deriv?._health?.topAccount===true,
    depth:micro?._health?.depth===true,funding:riskCtx?._health?.funding===true,basis:riskCtx?._health?.basis===true,adl:riskCtx?._health?.adl===true,mark:(riskCtx?._health?.mark===true)||(Number.isFinite(liveMark)&&liveMark>0),
    market:market?.ok===true,backtest:btSample>0
  };
  const sourceDetails={
    k5:{source:ksrc('5m',500)?.source||null,fallback:ksrc('5m',500)?.fallback===true,error:ksrc('5m',500)?.error||null},k15:{source:ksrc('15m',260)?.source||null,fallback:ksrc('15m',260)?.fallback===true,error:ksrc('15m',260)?.error||null},k30:{source:ksrc('30m',220)?.source||null,fallback:ksrc('30m',220)?.fallback===true,error:ksrc('30m',220)?.error||null},h1:{source:ksrc('1h',180)?.source||null,fallback:ksrc('1h',180)?.fallback===true,error:ksrc('1h',180)?.error||null},
    oi:{source:deriv?._source?.oi||null,error:deriv?._errors?.oi||deriv?._errors?.oiFallback||null},oi15:{source:deriv?._source?.oi||null,error:oi15Ok?null:(deriv?._errors?.oi||deriv?._errors?.oiFallback||'15分鐘 OI 變化缺值')},oi1h:{source:deriv?._source?.oi||null,error:oi1hOk?null:(deriv?._errors?.oi||deriv?._errors?.oiFallback||'1小時 OI 變化缺值')},taker:{source:deriv?._source?.taker||null,error:deriv?._errors?.taker||deriv?._errors?.takerFallback||deriv?._errors?.takerBybitFallback||null},globalLs:{source:deriv?._source?.globalLs||null,error:deriv?._errors?.global||deriv?._errors?.globalFallback||null},topPos:{source:deriv?._source?.topPos||null,error:deriv?._errors?.top||null},topAccount:{source:deriv?._source?.topAccount||null,error:deriv?._errors?.topAccount||null},depth:{source:micro?._source?.depth||null,error:micro?._errors?.depth||null},funding:{source:riskCtx?._source?.funding||null,error:riskCtx?._errors?.premium||riskCtx?._errors?.bybitTicker||null},basis:{source:riskCtx?._source?.basis||null,error:riskCtx?._errors?.basis||null},adl:{source:riskCtx?._source?.adl||null,error:riskCtx?._errors?.adl||null},mark:{source:riskCtx?._source?.mark||(Number.isFinite(liveMark)&&liveMark>0?'Binance':null),error:riskCtx?._errors?.premium||null},market:{source:'Binance BTC/ETH'},backtest:{source:'Binance K線自算',sample:btSample}
  };
  for(const [k,d] of Object.entries(sourceDetails)){d.status=sourceFlags[k]===true?'OK':d?.error?'FETCH_ERROR':'MISSING';}
  sourceDetails.realtime={source:realtime?.source||null,status:(realtime?.markAgeMs!=null&&realtime.markAgeMs<=REALTIME_STALE_MS)?'OK':'STALE_OR_FALLBACK',markAgeMs:realtime?.markAgeMs??null,bookAgeMs:realtime?.bookAgeMs??null,takerAgeMs:realtime?.takerAgeMs??null};
  // OI 是一個資料類別，但 15分 / 1小時各佔半格；缺其中一個不再誤顯示 100%。
  const qualityWeights={k5:1,k15:1,k30:1,h1:1,oi15:.5,oi1h:.5,taker:1,globalLs:1,topPos:1,topAccount:1,depth:1,funding:1,basis:1,adl:1,mark:1,market:1,backtest:1};
  const qualityKeys=Object.keys(qualityWeights),totalWeight=Object.values(qualityWeights).reduce((a,b)=>a+b,0),validWeight=qualityKeys.reduce((sum,k)=>sum+(sourceFlags[k]?qualityWeights[k]:0),0);
  const validCount=qualityKeys.filter(k=>sourceFlags[k]).length,coveragePct=Math.round(validWeight/totalWeight*100);
  const fallbackCount=Object.values(sourceDetails).filter(x=>x?.fallback||String(x?.source||'').includes('備援')).length;
  let confidencePct=coveragePct;
  if(btSample>0&&btSample<20)confidencePct-=8;else if(btSample>=20&&btSample<50)confidencePct-=3;
  confidencePct-=Math.min(8,fallbackCount*2);confidencePct=Math.max(0,Math.min(100,Math.round(confidencePct)));
  t.dataHealth={coveragePct,confidencePct,validCount,total:qualityKeys.length,validWeight,totalWeight,fallbackCount,sources:sourceFlags,details:sourceDetails,checkedAt:evaluatedAt,backtestSample:btSample,backtestLevel:btSample>=50?'充足':btSample>=20?'可用':'樣本偏少',crossExchange:crossCtx,adlNote:'ADL Risk 使用 Binance 公開端點（約30分鐘更新）；主資料抓取失敗時，允許 Bybit / OKX 或 Binance 成交資料作明確標示的備援，不再用 0 或中性值假裝有效'};

  if(t.status==='INVALID'){
    t=await updateInvalidMonitorState(t,{rows5,rows15,t5,t15,t30,t1h,deriv,market,rsi,macd,micro});
    t.statusLabel=testSignalStatusLabel(t.status);t.updatedAt=t.updatedAt||new Date().toISOString();return t;
  }

  if(t.status==='CONFIRMED'){
    const entry=Number(t.confirmationPrice),stop=Number(t.stop),target=Number(t.target1R),baseAt=new Date(t.confirmedAt).getTime()-5*60*1000;
    const bars=rows5.filter(c=>c.openTime>=baseAt);let mfe=0,mae=0;
    for(const c of bars){const fav=dir>0?(c.high-entry)/entry*100:(entry-c.low)/entry*100,adv=dir>0?(entry-c.low)/entry*100:(c.high-entry)/entry*100;mfe=Math.max(mfe,fav);mae=Math.max(mae,adv)}
    t.mfePct=Number(mfe.toFixed(2));t.maePct=Number(mae.toFixed(2));t.currentPrice=last.close;

    if(!t.outcomeFirstTouch){
      for(const c of bars){
        const hitStop=dir>0?c.low<=stop:c.high>=stop,hitTarget=dir>0?c.high>=target:c.low<=target;
        if(hitStop){
          const at=new Date(c.closeTime||Date.now()).toISOString();t.outcomeFirstTouch='LOSS';t.outcomeFirstTouchAt=at;
          const lossRet=Number((dir*(stop-entry)/entry*100).toFixed(2));archiveTestFirstTouchLoss(t,at,lossRet);
          t=await testEnterInvalidation(t,{reason:'MODEL_RISK',last:c,protection:stop,entry,dir});
          break;
        }
        if(hitTarget){
          const at=new Date(c.closeTime||Date.now()).toISOString();t.outcomeFirstTouch='WIN';t.outcomeFirstTouchAt=at;t.targetReachedAt=at;
          t.resultReturnPct=Number((dir*(target-entry)/entry*100).toFixed(2));archiveTestTargetWin(t,at);
          t.reentryStage='WAIT_PULLBACK';t.reentryStageAt=at;testSetState(t,'TARGET','達標',at);
          await sendTestLifecyclePush(t,'WIN',`🎯 ${t.symbol} 1R 達成`,`${t.direction==='LONG'?'做多':'做空'}｜確認 ${fmtPrice(entry)} → 1R ${fmtPrice(target)}｜先等二次回踩，不追價｜點開監控判讀`);
          break;
        }
      }
    }else if(t.outcomeFirstTouch==='LOSS'&&t.reactivatedAt){
      const rearmAt=new Date(t.reactivatedAt).getTime()-5*60*1000;
      const after=rows5.filter(c=>c.openTime>=rearmAt);
      if(after.some(c=>dir>0?c.high>=target:c.low<=target)&&!t.targetReachedAt){
        const hit=after.find(c=>dir>0?c.high>=target:c.low<=target),at=new Date(hit?.closeTime||Date.now()).toISOString();
        t.targetReachedAt=at;t.resultReturnPct=Number((dir*(target-entry)/entry*100).toFixed(2));t.reentryStage='WAIT_PULLBACK';t.reentryStageAt=at;
        testSetState(t,'TARGET','達標',at);
        await sendTestLifecyclePush(t,`WIN-RECOVERED-${Number(t.monitorCycle||0)}`,`🎯 ${t.symbol} 收復後達成 1R`,`${t.direction==='LONG'?'做多':'做空'}｜先等二次回踩，不追價｜點開監控判讀`);
      }
    }

    if(t.status==='CONFIRMED')t=await updateConfirmedMonitorState(t,{rows5,rows15,t5,t15,t30,t1h,deriv,market,rsi,macd,micro});
    if(t.status==='INVALID')return t;
    if(t.status==='CONFIRMED'&&t.targetReachedAt){
      t=await updateTargetReentryState(t,{rows5,rows15,t5,t15,t30,t1h,deriv,market,rsi,macd,micro});
    }else if(t.status==='CONFIRMED'&&Date.now()-new Date(t.confirmedAt).getTime()>=TEST_SIGNAL_OUTCOME_MS){
      t.status='TIMEOUT';
    }

    if(t.status==='TIMEOUT')t.resultReturnPct=Number((dir*(last.close-entry)/entry*100).toFixed(2));
    if(t.status!=='CONFIRMED'){
      t.statusLabel=testSignalStatusLabel(t.status);t.finishedAt=t.finishedAt||new Date().toISOString();t.updatedAt=t.finishedAt;archiveTestResult(t);
    }else{
      t.statusLabel=testTrackerStatusLabel(t);t.monitorLabel=testMonitorStateLabel(t.monitorState,t.status);t.updatedAt=new Date().toISOString();
    }
    return t;
  }

  const zoneTouch=rows5.slice(-4).some(c=>c.low<=setup.zoneHigh&&c.high>=setup.zoneLow);if(zoneTouch&&!t.touchedAt)t.touchedAt=new Date().toISOString();
  // V10.1 多策略觀察：舊的回踩失效位不能直接淘汰整個標的。
  // 只有價格明顯穿越保護區，且 15m + (30m/1h) 也同步反向，才視為「全策略結構失效」。
  // 這讓突破回測、掃流動性反轉、動能續攻、區間極值等策略仍有機會接管。
  const beyond=dir>0?last.close<setup.invalidation:last.close>setup.invalidation,deep=dir>0?last.close<setup.invalidation-setup.atr5*.15:last.close>setup.invalidation+setup.atr5*.15,prevBeyond=dir>0?prev.close<setup.invalidation:prev.close>setup.invalidation;
  const broadStructuralInvalid=deep&&t15?.trend===-dir&&((t30?.trend===-dir)||(t1h?.trend===-dir));
  if(broadStructuralInvalid){
    const now=new Date().toISOString();t.status='DROPPED';t.statusLabel='全策略結構失效';t.droppedAt=now;t.finishedAt=now;t.updatedAt=now;testSetState(t,'INVALIDATED','全策略失效',now);return t;
  }
  const reclaim=dir>0?last.close>setup.zoneMid:last.close<setup.zoneMid,candleOk=dir>0?last.close>last.open:last.close<last.open;
  const body=Math.max(Math.abs(last.close-last.open),setup.atr5*.04),lower=Math.max(0,Math.min(last.open,last.close)-last.low),upper=Math.max(0,last.high-Math.max(last.open,last.close)),wicker=dir>0?lower/body>=.65:upper/body>=.65;
  const prior=rows5.slice(-7,-1),priorEdge=dir>0?Math.min(...prior.map(x=>x.low)):Math.max(...prior.map(x=>x.high)),sweep=dir>0?(last.low<priorEdge&&last.close>priorEdge):(last.high>priorEdge&&last.close<priorEdge);
  const ri=rows5.length-1,rsiNow=Number(rsi[ri]),rsiPrev=Number(rsi[ri-1]),momentum=dir>0?(rsiNow>=44&&rsiNow<=72&&rsiNow>rsiPrev):(rsiNow<=56&&rsiNow>=28&&rsiNow<rsiPrev),macdImprove=dir>0?macd.hist[ri]>macd.hist[ri-1]:macd.hist[ri]<macd.hist[ri-1];
  const marketAlign=market.dir===0?0:(market.dir===dir?1:-1),takerVal=finiteMetric(deriv?.takerRatio),topVal=finiteMetric(deriv?.topPositionRatio),oiVal=finiteMetric(deriv?.oi15mChangePct)??finiteMetric(deriv?.oiChangePct),derivDir=takerVal==null?0:(dir>0?(takerVal>=1.02?1:takerVal<.94?-1:0):(takerVal<=.98?1:takerVal>1.06?-1:0)),topDir=topVal==null?0:(dir>0?(topVal>=1.02?1:topVal<.96?-1:0):(topVal<=.98?1:topVal>1.04?-1:0)),oiOk=oiVal==null?false:oiVal>-2;
  const depth=finiteMetric(micro?.depthImbalance),depthDir=depth==null?0:(dir>0?(depth>=.06?1:depth<=-.14?-1:0):(depth<=-.06?1:depth>=.14?-1:0));
  const h1Opposed=t1h&&t1h.trend===-dir&&Number(t1h.adx14||0)>=24,t30Opposed=t30&&t30.trend===-dir&&Number(t30.adx14||0)>=22;
  const chaseDistance=dir>0?Math.max(0,last.close-setup.zoneHigh):Math.max(0,setup.zoneLow-last.close),chaseAtr=setup.atr5>0?chaseDistance/setup.atr5:0;
  const spreadVal=finiteMetric(micro?.spreadBps),spreadOk=spreadVal==null||spreadVal<=TEST_SIGNAL_MAX_SPREAD_BPS;
  const adlRisk=String(riskCtx?.adlRisk||'unknown').toLowerCase(),fundingPct=finiteMetric(riskCtx?.fundingPct),fundingCrowded=fundingPct!=null&&(dir>0?fundingPct>=.08:fundingPct<=-.08);
  let baseScore=0;baseScore+=clamp((Number(t.idea.rankScore||50)-45)*.45,0,22);baseScore+=Math.min(16,(setup.confluenceCount||0)*5.5);baseScore+=zoneTouch?8:0;baseScore+=reclaim?12:0;baseScore+=candleOk?6:0;baseScore+=sweep?10:wicker?6:0;baseScore+=momentum?8:0;baseScore+=macdImprove?6:0;baseScore+=t5.volumeRatio>=1.05?6:t5.volumeRatio<.70?-4:2;baseScore+=derivDir*5;baseScore+=topDir*3;baseScore+=depthDir*3;baseScore+=oiOk?3:-5;baseScore+=marketAlign*7;baseScore+=h1Opposed?-7:(t1h?.trend===dir?3:0);baseScore+=t30Opposed?-6:(t30?.trend===dir?2:0);baseScore+=spreadOk?1:-7;baseScore+=chaseAtr<=.15?3:chaseAtr<=TEST_SIGNAL_FIRST_MAX_CHASE_ATR?0:-9;baseScore+=adlRisk==='high'?-9:adlRisk==='low'?1:0;baseScore+=fundingCrowded?-5:0;baseScore=clamp(Math.round(baseScore),0,100);
  const playbook=testStrategyPlaybooks(t,{rows5,last,prev,setup,dir,t5,t15,t30,t1h,market,derivDir,topDir,depthDir,oiVal,zoneTouch,reclaim,candleOk,wicker,sweep,momentum,macdImprove,spreadOk,chaseAtr,h1Opposed,t30Opposed,adlRisk,fundingCrowded,baseScore});
  let score=Number(playbook.qualityScore||baseScore);t.strategyProfile=playbook;t.observationProgress=Number(playbook.progress||0);
  const reasons=[...(playbook.reasons||[])];if(t1h?.trend===dir)reasons.push('1小時趨勢同向');if(topDir>0)reasons.push('大戶持倉同向');if(depthDir>0)reasons.push('委託簿同向');
  const activeZone=playbook.entryZone||{low:setup.zoneLow,high:setup.zoneHigh},activeZoneLow=Number(activeZone?.low),activeZoneHigh=Number(activeZone?.high),activeMid=Number.isFinite(activeZoneLow)&&Number.isFinite(activeZoneHigh)?(activeZoneLow+activeZoneHigh)/2:setup.zoneMid;
  const strategyChase=Number.isFinite(Number(playbook.chaseAtr))?Number(playbook.chaseAtr):(setup.atr5>0?(dir>0?Math.max(0,last.close-Math.max(activeZoneLow,activeZoneHigh)):Math.max(0,Math.min(activeZoneLow,activeZoneHigh)-last.close))/setup.atr5:0);
  t.currentPrice=last.close;t.qualityScore=score;t.status=t.observationProgress>=58?'TOUCHING':'WAIT_PULLBACK';t.statusLabel=testSignalStatusLabel(t.status);testSetState(t,'WATCHING','觀察中',new Date().toISOString());t.updatedAt=new Date().toISOString();
  t.lastCheck={at:t.updatedAt,strategyId:playbook.id,strategyLabel:playbook.label,observationProgress:t.observationProgress,strategyCandidates:playbook.candidates,reclaim,candleOk,wicker,sweep,momentum,macdImprove,volumeRatio:Number(t5.volumeRatio.toFixed(2)),volumeRatio15:Number(t15.volumeRatio.toFixed(2)),rsi5:Number(rsiNow.toFixed(1)),rsi15:Number.isFinite(Number(t15.rsi14))?Number(Number(t15.rsi14).toFixed(1)):null,macd5:Number.isFinite(Number(t5.macdHist))?Number(Number(t5.macdHist).toFixed(6)):null,macd15:Number.isFinite(Number(t15.macdHist))?Number(Number(t15.macdHist).toFixed(6)):null,adx5:Number.isFinite(Number(t5.adx14))?Number(Number(t5.adx14).toFixed(1)):null,adx15:Number.isFinite(Number(t15.adx14))?Number(Number(t15.adx14).toFixed(1)):null,atrPct5:Number.isFinite(Number(t5.atrPct))?Number(Number(t5.atrPct).toFixed(3)):null,oiChangePct:oiVal!=null?Number(oiVal.toFixed(2)):null,oi5mChangePct:finiteMetric(deriv?.oi5mChangePct),oi15mChangePct:finiteMetric(deriv?.oi15mChangePct),oi1hChangePct:finiteMetric(deriv?.oi1hChangePct),takerRatio:takerVal!=null?Number(takerVal.toFixed(2)):null,topPositionRatio:topVal!=null?Number(topVal.toFixed(2)):null,topAccountRatio:finiteMetric(deriv?.topAccountRatio)!=null?Number(Number(deriv.topAccountRatio).toFixed(2)):null,globalLongShortRatio:finiteMetric(deriv?.globalLongShortRatio)!=null?Number(Number(deriv.globalLongShortRatio).toFixed(2)):null,depthImbalance:depth!=null?Number(depth.toFixed(3)):null,spreadBps:spreadVal!=null?Number(spreadVal.toFixed(2)):null,bidNotional:finiteMetric(micro?.bidNotional),askNotional:finiteMetric(micro?.askNotional),chaseAtr:Number(strategyChase.toFixed(2)),adlRisk,fundingPct:fundingPct!=null?Number(fundingPct.toFixed(4)):null,basisPct:finiteMetric(riskCtx?.basisPct),annualizedBasisPct:finiteMetric(riskCtx?.annualizedBasisPct),nextFundingTime:finiteMetric(riskCtx?.nextFundingTime),fundingCrowded,t30Trend:t30?.trend??0,h1Trend:t1h?.trend??0,marketAlign,reasons:reasons.slice(0,8)};
  const globalSafety=spreadOk&&adlRisk!=='high'&&!fundingCrowded&&Number(t.dataHealth?.coveragePct||0)>=72&&Number(t.dataHealth?.confidencePct||0)>=65;
  const confirm=playbook.ready===true&&globalSafety&&score>=TEST_SIGNAL_CONFIRM_SCORE;
  if(confirm){
    const entry=last.close,strategyInvalid=finiteMetric(playbook.invalidation)??finiteMetric(setup.invalidation),rawRisk=Math.abs(entry-strategyInvalid),minRisk=setup.atr5*.55,maxRisk=setup.atr5*1.85,risk=clamp(rawRisk,minRisk,maxRisk),stop=entry-dir*risk;
    const before=rows5.slice(-22,-2),breakoutLevel=dir>0?Math.max(...before.map(x=>x.high)):Math.min(...before.map(x=>x.low)),now=new Date().toISOString();
    t.status='CONFIRMED';t.statusLabel='進場確認';t.observationProgress=100;t.strategyAtConfirm={...playbook,progress:100,ready:true};t.confirmedAt=now;t.rankAtConfirm=Number(t.rank||0)||null;t.confirmationPrice=entry;t.stop=stop;t.target1R=entry+dir*risk;t.target15R=entry+dir*risk*1.5;t.riskPct=Number((risk/entry*100).toFixed(2));t.breakoutLevel=finiteMetric(playbook.breakoutLevel)??breakoutLevel;t.structureProtection=stop;
    testSetState(t,score>=84?'STRONG':'CONFIRMED',score>=84?'強勢':'成立',now);t.monitorScore=score;t.lastMonitorBarTime=last.openTime;t.updatedAt=now;
    const calibrated=testCalibratedWinRate(t,{dynamic:false});t.confirmedWinRate=calibrated.rate;t.winRateMetaAtConfirm=calibrated;
    const tier=testSignalTier(t,{reentry:false});t.confirmNotificationTier=tier.tier;
    if(!t.notificationSentAt){const delivery=await sendTestLifecyclePush(t,'CONFIRMED','', '',{tier:t.confirmNotificationTier,statusLabel:score>=84?'強勢':'成立'});if(delivery?.processed)t.notificationSentAt=new Date().toISOString()}
  }
  return t;
}

function testWeightedProgress(items){
  let got=0,total=0;for(const x of items||[]){const w=Math.max(0,Number(x?.weight||0));total+=w;if(x?.ok===true)got+=w}
  return total>0?clamp(Math.round(got/total*100),0,100):0;
}
function testPlaybookZone(center,atr,half=.18){const c=Number(center),a=Math.abs(Number(atr));if(!(Number.isFinite(c)&&a>0))return null;return {low:c-a*half,high:c+a*half}}
function testStrategyPlaybooks(t,ctx){
  const {rows5,last,prev,setup,dir,t5,t15,t30,t1h,market,derivDir,topDir,depthDir,oiVal,zoneTouch,reclaim,candleOk,wicker,sweep,momentum,macdImprove,spreadOk,chaseAtr,h1Opposed,t30Opposed,adlRisk,fundingCrowded,baseScore}=ctx;
  const atr=Math.max(1e-12,Number(setup?.atr5||t5?.atr14||0)),regime=String(market?.regime||'NORMAL');
  const trend15=t15?.trend===dir,trend30=!t30||t30.trend===dir,trend1h=!t1h||t1h.trend===dir,marketOk=market?.dir===0||market?.dir===dir;
  const flowOk=derivDir>=0&&topDir>=0&&(oiVal==null||Number(oiVal)>-1.5),depthOk=depthDir>=0;
  const safe=spreadOk&&adlRisk!=='high'&&!fundingCrowded;
  const priorBreak=rows5.slice(-26,-6),recentBreak=rows5.slice(-6,-1),breakoutLevel=priorBreak.length?(dir>0?Math.max(...priorBreak.map(x=>x.high)):Math.min(...priorBreak.map(x=>x.low))):null;
  const broke=Number.isFinite(breakoutLevel)&&recentBreak.some(c=>dir>0?Number(c.close)>breakoutLevel+atr*.04:Number(c.close)<breakoutLevel-atr*.04);
  const retest=Number.isFinite(breakoutLevel)&&(dir>0?(Number(last.low)<=breakoutLevel+atr*.20&&Number(last.close)>=breakoutLevel):(Number(last.high)>=breakoutLevel-atr*.20&&Number(last.close)<=breakoutLevel));
  const breakoutChase=Number.isFinite(breakoutLevel)?Math.abs(Number(last.close)-breakoutLevel)/atr:99;
  const priorExtreme=rows5.slice(-9,-1),sweepLevel=priorExtreme.length?(dir>0?Math.min(...priorExtreme.map(x=>x.low)):Math.max(...priorExtreme.map(x=>x.high))):null;
  const sweepHold=Number.isFinite(sweepLevel)&&(dir>0?Number(last.close)>sweepLevel:Number(last.close)<sweepLevel);
  const momentumExtremeRows=rows5.slice(-22,-2),momentumLevel=momentumExtremeRows.length?(dir>0?Math.max(...momentumExtremeRows.map(x=>x.high)):Math.min(...momentumExtremeRows.map(x=>x.low))):null;
  const nearMomentumBreak=Number.isFinite(momentumLevel)?Math.abs(Number(last.close)-momentumLevel)/atr<=.48:false;
  const adxStrong=Number(t15?.adx14||0)>=24&&Number(t15?.diBias||0)===dir,volumeStrong=Number(t5?.volumeRatio||0)>=1.05||Number(t15?.volumeRatio||0)>=1.05,oiPositive=oiVal==null?false:Number(oiVal)>=0;
  const rangeRows=rows5.slice(-42,-3),rangeLow=rangeRows.length?Math.min(...rangeRows.map(x=>x.low)):null,rangeHigh=rangeRows.length?Math.max(...rangeRows.map(x=>x.high)):null,rangeWidth=Number.isFinite(rangeLow)&&Number.isFinite(rangeHigh)?rangeHigh-rangeLow:0;
  const edgeDist=rangeWidth>0?(dir>0?(Number(last.close)-rangeLow)/rangeWidth:(rangeHigh-Number(last.close))/rangeWidth):99,nearRangeEdge=edgeDist>=-.08&&edgeDist<=.22;
  const mk=(id,label,fit,items,ready,entryZone,invalidation,nextStep,extra={})=>{const progress=testWeightedProgress(items),quality=clamp(Math.round(Number(baseScore||70)*.48+progress*.40+fit*.12),0,100);return {id,label,fit,progress,qualityScore:quality,ready:!!ready,entryZone,invalidation:Number.isFinite(Number(invalidation))?Number(invalidation):null,nextStep,reasons:items.filter(x=>x.ok).map(x=>x.label).slice(0,6),missing:items.filter(x=>!x.ok).map(x=>x.label).slice(0,5),...extra}};
  const pullItems=[{label:'進入回踩區',ok:zoneTouch,weight:12},{label:'收回關鍵區',ok:reclaim,weight:13},{label:'確認K同向',ok:candleOk,weight:7},{label:'拒絕影線/掃盤',ok:wicker||sweep,weight:9},{label:'RSI動能回復',ok:momentum,weight:9},{label:'MACD改善',ok:macdImprove,weight:8},{label:'15分趨勢同向',ok:trend15,weight:8},{label:'30分/1H無逆向',ok:!t30Opposed&&!h1Opposed,weight:8},{label:'資金流無逆向',ok:flowOk,weight:7},{label:'委託簿無逆向',ok:depthOk,weight:5},{label:'大盤無逆向',ok:marketOk,weight:5},{label:'價差/ADL/Funding安全',ok:safe,weight:5},{label:'未追價',ok:Number(chaseAtr)<=TEST_SIGNAL_FIRST_MAX_CHASE_ATR,weight:4}];
  const pullFit=['TREND_UP','TREND_DOWN','NORMAL'].includes(regime)?92:regime==='CHOP'?64:72;
  const pullReady=zoneTouch&&reclaim&&candleOk&&(wicker||sweep)&&momentum&&macdImprove&&marketOk&&!h1Opposed&&!t30Opposed&&depthOk&&safe&&Number(chaseAtr)<=TEST_SIGNAL_FIRST_MAX_CHASE_ATR;
  const pull=mk('TREND_PULLBACK','順勢回踩',pullFit,pullItems,pullReady,{low:setup.zoneLow,high:setup.zoneHigh},setup.invalidation,'等回踩守住＋5/15分重新同向');

  const brItems=[{label:'已突破關鍵位',ok:broke,weight:17},{label:'第一次回測',ok:retest,weight:17},{label:'回測收住',ok:retest&&candleOk,weight:10},{label:'15分趨勢同向',ok:trend15,weight:10},{label:'30分趨勢同向',ok:trend30,weight:7},{label:'1H趨勢同向',ok:trend1h,weight:7},{label:'動能續回',ok:momentum&&macdImprove,weight:10},{label:'量能有效',ok:Number(t5.volumeRatio||0)>=.90,weight:6},{label:'OI/Taker/大戶無逆向',ok:flowOk,weight:6},{label:'委託簿無逆向',ok:depthOk,weight:4},{label:'大盤無逆向',ok:marketOk,weight:3},{label:'未離突破位太遠',ok:breakoutChase<=.45,weight:3}];
  const brFit=['TREND_UP','TREND_DOWN'].includes(regime)?98:regime==='NORMAL'?86:58;
  const brReady=broke&&retest&&candleOk&&trend15&&trend30&&trend1h&&momentum&&macdImprove&&flowOk&&depthOk&&marketOk&&safe&&breakoutChase<=.45;
  const brZone=testPlaybookZone(breakoutLevel,atr,.20);const brInvalid=Number.isFinite(breakoutLevel)?breakoutLevel-dir*atr*.62:null;
  const br=mk('BREAKOUT_RETEST','突破回測',brFit,brItems,brReady,brZone,brInvalid,'等突破後第一次回測守住', {breakoutLevel, chaseAtr:Number.isFinite(breakoutChase)?Number(breakoutChase.toFixed(2)):null});

  const swItems=[{label:'掃過短線流動性',ok:sweep,weight:20},{label:'收回掃盤位',ok:sweepHold,weight:14},{label:'拒絕影線成立',ok:wicker,weight:10},{label:'確認K翻向',ok:candleOk,weight:8},{label:'RSI翻向',ok:momentum,weight:10},{label:'MACD改善',ok:macdImprove,weight:10},{label:'委託簿不反對',ok:depthOk,weight:7},{label:'主動資金不反對',ok:derivDir>=0,weight:7},{label:'量能不是死量',ok:Number(t5.volumeRatio||0)>=.80,weight:5},{label:'市場型態適合',ok:['CHOP','HIGH_VOL','LIQUIDATION'].includes(regime)||marketOk,weight:5},{label:'價差/ADL/Funding安全',ok:safe,weight:4}];
  const swFit=['HIGH_VOL','LIQUIDATION'].includes(regime)?100:regime==='CHOP'?96:76;
  const swReady=sweep&&sweepHold&&wicker&&candleOk&&momentum&&macdImprove&&depthOk&&derivDir>=0&&safe&&(['CHOP','HIGH_VOL','LIQUIDATION'].includes(regime)||marketOk);
  const swZone=testPlaybookZone(sweepLevel,atr,.22),swInvalid=Number.isFinite(sweepLevel)?sweepLevel-dir*atr*.72:null;
  const sw=mk('LIQUIDITY_SWEEP','流動性掃盤反轉',swFit,swItems,swReady,swZone,swInvalid,'等掃高/掃低後收回＋短週期翻向',{sweepLevel});

  const moItems=[{label:'15分強趨勢',ok:trend15&&adxStrong,weight:14},{label:'30分同向',ok:trend30,weight:9},{label:'1H同向',ok:trend1h,weight:9},{label:'價格貼近突破區',ok:nearMomentumBreak,weight:12},{label:'5分量能放大',ok:volumeStrong,weight:10},{label:'OI增加',ok:oiPositive,weight:10},{label:'Taker同向',ok:derivDir>0,weight:10},{label:'大戶不反向',ok:topDir>=0,weight:6},{label:'委託簿不反向',ok:depthOk,weight:6},{label:'BTC/ETH同向',ok:marketOk,weight:6},{label:'MACD續強',ok:macdImprove,weight:5},{label:'價差/擁擠安全',ok:safe,weight:3}];
  const moFit=['TREND_UP','TREND_DOWN'].includes(regime)?100:regime==='NORMAL'?78:48;
  const moReady=trend15&&adxStrong&&trend30&&trend1h&&nearMomentumBreak&&volumeStrong&&oiPositive&&derivDir>0&&topDir>=0&&depthOk&&marketOk&&macdImprove&&safe;
  const moZone=testPlaybookZone(momentumLevel,atr,.24),moInvalid=Number.isFinite(momentumLevel)?momentumLevel-dir*atr*.82:null;
  const mo=mk('MOMENTUM_CONTINUATION','強勢動能續攻',moFit,moItems,moReady,moZone,moInvalid,'等強趨勢＋量/OI/Taker同步，僅做近突破區',{breakoutLevel:momentumLevel});

  const rgItems=[{label:'市場為震盪',ok:regime==='CHOP',weight:18},{label:'到達區間極值',ok:nearRangeEdge,weight:18},{label:'掃盤/拒絕影線',ok:sweep||wicker,weight:13},{label:'確認K翻向',ok:candleOk,weight:9},{label:'RSI翻向',ok:momentum,weight:10},{label:'MACD改善',ok:macdImprove,weight:9},{label:'委託簿不反向',ok:depthOk,weight:7},{label:'資金流不反向',ok:derivDir>=0,weight:6},{label:'價差/ADL/Funding安全',ok:safe,weight:5},{label:'不是區間中間',ok:nearRangeEdge,weight:5}];
  const rgFit=regime==='CHOP'?100:regime==='NORMAL'?55:35;
  const rangeEdge=dir>0?rangeLow:rangeHigh,rgZone=testPlaybookZone(rangeEdge,atr,.22),rgInvalid=Number.isFinite(rangeEdge)?rangeEdge-dir*atr*.68:null;
  const rgReady=regime==='CHOP'&&nearRangeEdge&&(sweep||wicker)&&candleOk&&momentum&&macdImprove&&depthOk&&derivDir>=0&&safe;
  const rg=mk('RANGE_EXTREME','區間極值反轉',rgFit,rgItems,rgReady,rgZone,rgInvalid,'只等區間上/下緣反轉，中間區完全不做',{rangeLow,rangeHigh});

  const candidates=[pull,br,sw,mo,rg].map(x=>({...x,selectionScore:Number(((x.ready?18:0)+x.progress*.57+x.qualityScore*.28+x.fit*.15).toFixed(1))})).sort((a,b)=>b.selectionScore-a.selectionScore||b.progress-a.progress||b.qualityScore-a.qualityScore);
  const best=candidates[0];
  return {...best,candidates:candidates.map(x=>({id:x.id,label:x.label,progress:x.progress,qualityScore:x.qualityScore,fit:x.fit,ready:x.ready,nextStep:x.nextStep,missing:x.missing.slice(0,3)}))};
}

function testMonitorPriority(t, calibratedRate=null) {
  const win=Number.isFinite(Number(calibratedRate))?Number(calibratedRate):Number(testCalibratedWinRate(t,{dynamic:true}).rate||50);
  const completion=t.status==='CONFIRMED'?100:t.status==='INVALID'?Math.min(20,Number(t.observationProgress||0)):Number(t.observationProgress||0);
  const dynamic=Number(t.monitorScore||t.qualityScore||70);
  // 觀察榜像經驗條：完成度主導，勝率第二，動態品質第三。條件越接近可通知越往前。
  return clamp(completion*.50+win*.40+dynamic*.10,0,100);
}
function testTrackerFreshness(t) {
  const at=t.lastEvaluatedAt||null,ms=at?Date.now()-new Date(at).getTime():Infinity;
  const state=ms<=TEST_MONITOR_DELAY_MS?'LIVE':ms<=TEST_MONITOR_STALE_MS?'DELAYED':'STALE';
  return {state,ageMs:Number.isFinite(ms)?Math.max(0,ms):null,delayedMs:TEST_MONITOR_DELAY_MS,staleMs:TEST_MONITOR_STALE_MS};
}
function publicTestTracker(t) {
  const dynamic=['CONFIRMED','INVALID'].includes(t.status),calibrated=testCalibratedWinRate(t,{dynamic});
  const eventAt=t.stateChangedAt||t.invalidatedAt||t.droppedAt||t.finishedAt||t.confirmedAt||t.touchedAt||t.updatedAt;
  const rankHeat=testRankHeat(t.rank),priorityScore=testMonitorPriority(t,calibrated.rate),tier=testSignalTier(t,{reentry:t.reentryStage==='READY'||t.reentryStage==='TOUCHING'}),entryZone=testCurrentEntryZone(t),preferredEntryZone=testPreferredEntryZone(t);
  const freshness=testTrackerFreshness(t);
  const mark=Number(markPrices.get(cleanFuturesSymbol(t.symbol))),cachedLive=Number(t.livePrice),fallback=Number(t.currentPrice);
  const livePrice=Number.isFinite(mark)&&mark>0?mark:Number.isFinite(cachedLive)&&cachedLive>0?cachedLive:Number.isFinite(fallback)&&fallback>0?fallback:null;
  const confirmedRate=Number.isFinite(Number(t.confirmedWinRate))?Number(t.confirmedWinRate):null;
  const currentRate=Number.isFinite(Number(calibrated.rate))?Number(calibrated.rate):confirmedRate;
  return {
    key:t.key,symbol:t.symbol,direction:t.direction,label:t.direction==='LONG'?'做多':'做空',rank:t.rank,rankAtConfirm:t.rankAtConfirm??null,rankHeat:Number(rankHeat.toFixed(0)),priorityScore:Number(priorityScore.toFixed(1)),status:t.status,statusLabel:testTrackerStatusLabel(t),
    monitorState:t.monitorState||'WATCHING',monitorLabel:testMonitorStateLabel(t.monitorState,t.status),monitorClass:testMonitorStateClass(t.monitorState,t.status),monitorScore:t.monitorScore??null,
    notificationTier:tier.tier,notificationGate:{blockers:tier.blockers||[],highMissing:tier.highMissing||[],normalMissing:tier.normalMissing||[],rate:tier.rate,conservativeLow:tier.low,score:tier.score,rank:tier.rank},confirmNotificationTier:t.confirmNotificationTier??null,reentryNotificationTier:t.reentryNotificationTier??null,lastPushAttemptAt:t.lastPushAttemptAt??null,lastPushTier:t.lastPushTier??null,lastPushDelivery:t.lastPushDelivery??null,entryStrategy:testEntryStrategy(t),entryZone,preferredEntryZone,observationProgress:Number(t.observationProgress||0),strategyProfile:t.strategyProfile||null,strategyAtConfirm:t.strategyAtConfirm||null,
    calibratedWinRate:currentRate,confirmedWinRate:confirmedRate,currentWinRate:currentRate,winRateDelta:confirmedRate!=null&&currentRate!=null?Number((currentRate-confirmedRate).toFixed(1)):null,winRateMeta:dynamic?calibrated:(t.winRateMetaAtConfirm||calibrated),
    freshness,marketRegime:t.marketRegime||t.lastCheck?.marketRegime||null,realtime:realtimeSnapshot(t.symbol),lastEvaluatedAt:t.lastEvaluatedAt??null,lastEvaluatedBarAt:t.lastEvaluatedBarAt??null,lastEvaluationError:t.lastEvaluationError??null,lastEvaluationErrorAt:t.lastEvaluationErrorAt??null,priceUpdatedAt:markPriceUpdatedAt??null,
    eventAt,stateChangedAt:t.stateChangedAt??null,finishedAt:t.finishedAt??null,invalidatedAt:t.invalidatedAt??null,invalidReason:t.invalidReason??null,reactivateUntil:t.reactivateUntil??null,reactivatedAt:t.reactivatedAt??null,droppedAt:t.droppedAt??null,targetReachedAt:t.targetReachedAt??null,reentryStage:t.reentryStage??null,reentryStageAt:t.reentryStageAt??null,reentryZoneLow:t.reentryZoneLow??null,reentryZoneHigh:t.reentryZoneHigh??null,reentryZoneMid:t.reentryZoneMid??null,reentryInvalidation:t.reentryInvalidation??null,reentryConfirmAt:t.reentryConfirmAt??null,reentryEntryPrice:t.reentryEntryPrice??null,reentryStop:t.reentryStop??null,reentryTarget1R:t.reentryTarget1R??null,reentryScore:t.reentryScore??null,reentryReasons:t.reentryReasons||[],reentryResult:t.reentryResult??null,reentryResultAt:t.reentryResultAt??null,
    firstSeenAt:t.firstSeenAt,lastSeenIdeaAt:t.lastSeenIdeaAt,updatedAt:t.updatedAt,touchedAt:t.touchedAt,confirmedAt:t.confirmedAt,notificationSentAt:t.notificationSentAt??null,
    currentPrice:livePrice,barClosePrice:t.currentPrice??null,confirmationPrice:t.confirmationPrice??null,qualityScore:t.qualityScore??t.setup?.setupScore??null,
    idea:{modelScore:t.idea?.modelScore??null,rankScore:t.idea?.rankScore??null,estimatedWinRate:t.idea?.estimatedWinRate??null,historicalHitRate:t.idea?.historicalHitRate??null,backtestSample:t.idea?.backtestSample??0,reason:t.idea?.reason||''},
    setup:t.setup?{zoneLow:t.setup.zoneLow,zoneHigh:t.setup.zoneHigh,invalidation:t.setup.invalidation,confluenceCount:t.setup.confluenceCount,setupScore:t.setup.setupScore,volatilityRegime:t.setup.volatilityRegime,adx15:t.setup.adx15,backtest:t.setup.backtest}:null,
    lastCheck:t.lastCheck,dataHealth:t.dataHealth??null,monitorEvidence:t.monitorEvidence??null,breakoutLevel:t.breakoutLevel??null,breakoutAt:t.breakoutAt??null,structureProtection:t.structureProtection??null,
    stop:t.stop??null,target1R:t.target1R??null,target15R:t.target15R??null,riskPct:t.riskPct??null,mfePct:t.mfePct??null,maePct:t.maePct??null,resultReturnPct:t.resultReturnPct??null,
    outcomeFirstTouch:t.outcomeFirstTouch??null,outcomeFirstTouchAt:t.outcomeFirstTouchAt??null
  };
}

async function runTestSignalScan(force=false) {
  if(testSignalBusy)return;const now=Date.now();if(!force&&now-testSignalLastRunAt<TEST_SIGNAL_SCAN_MS*.75)return;testSignalBusy=true;
  try{
    const [ideas,market]=await Promise.all([getRankedIdeas(),testMarketContext().catch(()=>({raw:0,dir:0,ok:false,valid:0,total:6}))]);syncTestIdeas(ideas);
    const active=[...testSignalTrackers.values()].filter(t=>!terminalTestStatus(t.status)).sort((a,b)=>(a.rank||99)-(b.rank||99)).slice(0,TEST_SIGNAL_MAX);
    await mapPool(active,3,async t=>{try{const next=await analyzeTestTracker(t,market);testSignalTrackers.set(t.key,next)}catch(e){t.lastError=String(e?.message||e);t.lastEvaluationError=t.lastError;t.lastEvaluationErrorAt=new Date().toISOString();testSignalTrackers.set(t.key,t)}});
    testSignalLastRunAt=Date.now();testSignalLastError=null;persistTestSignals();
  }catch(e){testSignalLastError=String(e?.message||e);console.warn(`[test-signal] ${testSignalLastError}`)}finally{testSignalBusy=false}
}
function testSignalLoop(){void runTestSignalScan(false).finally(()=>{testSignalTimer=setTimeout(testSignalLoop,TEST_SIGNAL_SCAN_MS)})}
function scheduleNextFiveMinuteScan(){if(testBarTimer)clearTimeout(testBarTimer);const now=Date.now(),step=5*60_000,next=(Math.floor(now/step)+1)*step+2500;testBarTimer=setTimeout(()=>{testCandleCache.clear();testMicroCache.clear();testDerivCache.clear();void runTestSignalScan(true).finally(scheduleNextFiveMinuteScan)},Math.max(1000,next-now));testBarTimer.unref?.()}
function testSignalResponse() {
  const visible=[...testSignalTrackers.values()].filter(t=>Date.now()-new Date(t.updatedAt||t.firstSeenAt||0).getTime()<8*60*60*1000);visible.sort((a,b)=>{const ta=terminalTestStatus(a.status),tb=terminalTestStatus(b.status);if(ta!==tb)return ta?1:-1;const p=testMonitorPriority(b)-testMonitorPriority(a);if(Math.abs(p)>.01)return p;const wa=Number(testCalibratedWinRate(a,{dynamic:['CONFIRMED','INVALID'].includes(a.status)}).rate||0),wb=Number(testCalibratedWinRate(b,{dynamic:['CONFIRMED','INVALID'].includes(b.status)}).rate||0);return wb-wa||(a.rank||99)-(b.rank||99)});const rows=visible.slice(0,24).map((t,i)=>({...publicTestTracker(t),observationRank:i+1}));
  const notifyStats={high:0,normal:0,valid:0,blocked:0,highNormalEligible:0};
  for(const row of rows){const k=String(row.notificationTier||'VALID').toLowerCase();if(k in notifyStats)notifyStats[k]++;if(row.notificationTier==='HIGH'||row.notificationTier==='NORMAL')notifyStats.highNormalEligible++}
  const now=Date.now(),scanAgeMs=testSignalLastRunAt?Math.max(0,now-testSignalLastRunAt):null,priceAgeMs=markPriceUpdatedAt?Math.max(0,now-new Date(markPriceUpdatedAt).getTime()):null;
  const staleCount=rows.filter(r=>r.freshness?.state==='STALE').length,delayedCount=rows.filter(r=>r.freshness?.state==='DELAYED').length;
  const health={scanAgeMs,priceAgeMs,delayedCount,staleCount,tracked:rows.length,derivativeCacheEntries:testDerivCache.size,candleCacheEntries:testCandleCache.size,microCacheEntries:testMicroCache.size,lastError:testSignalLastError,realtime:realtimeHealthSnapshot(),radar:realtimeRadarSummary()};
  return {ok:true,generatedAt:new Date(testSignalLastRunAt||Date.now()).toISOString(),scanMs:TEST_SIGNAL_SCAN_MS,freshness:{delayMs:TEST_MONITOR_DELAY_MS,staleMs:TEST_MONITOR_STALE_MS,priceUpdatedAt:markPriceUpdatedAt},confirmScore:TEST_SIGNAL_CONFIRM_SCORE,badScore:TEST_MONITOR_BAD_SCORE,badBars:TEST_MONITOR_BAD_BARS,reactivateMinutes:Math.round(TEST_MONITOR_REACTIVATE_MS/60000),rearmScore:TEST_REARM_SCORE,notifyThresholds:{highRate:TEST_SIGNAL_HIGH_RATE,normalRate:TEST_SIGNAL_NORMAL_RATE,highScore:TEST_SIGNAL_HIGH_SCORE,normalScore:TEST_SIGNAL_NORMAL_SCORE,maxChaseAtr:TEST_SIGNAL_FIRST_MAX_CHASE_ATR,highMaxChaseAtr:TEST_SIGNAL_HIGH_MAX_CHASE_ATR,maxSpreadBps:TEST_SIGNAL_MAX_SPREAD_BPS,highCoverage:90,normalCoverage:80,blockCoverage:72,highConfidence:86,normalConfidence:76,blockConfidence:65},notifyStats,health,rows,liveStats:testLiveAggregate(),recent:testSignalHistory.slice(0,12),methodology:'V10.1 SOLO MAX MULTI-PLAYBOOK：五策略自動交叉比對（順勢回踩／突破回測／流動性掃盤反轉／強勢動能續攻／區間極值反轉），依市場 Regime 自動選主策略；觀察完成度像經驗條，越接近可通知越往前，排序再疊加校準勝率與動態品質。Binance REST + WebSocket 雙路；depth20 100ms、aggTrade、Mark 1s、全市場 ticker、清算流即時接入，REST/Bybit/OKX 自動備援。深度判讀約30秒＋每根5分K收盤後強制刷新；進場通知先短暫去抖再檢查失效/追價。市場先分 TREND/CHOP/HIGH_VOL/LIQUIDATION 再決定通知門檻。所有成功送達的進場型通知另建精準績效帳本，逐筆追蹤 MFE/MAE、1R首觸、5/15/30/60/90/240分鐘報酬。缺值不以0或中性值冒充有效訊號。',error:testSignalLastError};
}


function fallbackDailyBrief(flow, ideas, meta={}) {
  const sm=flow.summary||{}, top=(ideas?.rows||[]).slice(0,3);
  const bias=sm.direction==='LONG'?'偏多':sm.direction==='SHORT'?'偏空':'中性';
  return { ok:true, mode:'MARKET_ONLY', generatedAt:new Date().toISOString(), bias, score:Number(sm.confidence||50), title:`市場${bias}`, bullets:[`成交額加權 ${Number(sm.weightedChangePct||0).toFixed(2)}%`,`上漲 ${sm.advancers||0} / 下跌 ${sm.decliners||0}`,top.length?`排名：${top.map(x=>`${x.symbol} ${x.label}`).join('、')}`:'暫無高一致性排名'], action:sm.direction==='LONG'?'多單等回踩，空單只打弱勢標的':sm.direction==='SHORT'?'空單等反彈，多單只打強勢標的':'只做排名最前面的強弱分化', sources:[], aiReady:false, aiConfigured:meta.aiConfigured===true, aiError:meta.error||null };
}

function extractOpenAIText(json) {
  if(typeof json?.output_text==='string')return json.output_text;
  for(const item of json?.output||[])for(const c of item?.content||[])if(c?.type==='output_text'&&typeof c.text==='string')return c.text;
  return '';
}


function cleanJsonText(text){return String(text||'').trim().replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```$/,'').trim()}
function quantOnlySymbolAnalysis(symbol, idea, profile, error=null){
  const dir=idea?.direction==='LONG'?'偏多':idea?.direction==='SHORT'?'偏空':'中性';
  const strength=Number(idea?.modelScore||0)>=75?'偏強':Number(idea?.modelScore||0)<=55?'偏弱':'中性';
  return {ok:true,mode:'QUANT_ONLY',symbol,generatedAt:new Date().toISOString(),profile,bias:dir,strength,agreement:'量化資料',summary:idea?`量化排名 ${Number(idea.rankScore||0).toFixed(0)} 分；${idea.reason||'訊號分歧'}。`:'目前只有市場資料。',bullish:[],bearish:[],conflicts:[],watch:['等待多策略條件確認','觀察高週期與主動資金是否同向'],news:[],entryTiming:idea?.direction==='LONG'?'等最適策略完成再評估，不追價':idea?.direction==='SHORT'?'等反彈轉弱再評估，不追殺':'等待方向一致',action:idea?.direction==='LONG'?'等策略確認，不追價':idea?.direction==='SHORT'?'等反彈/回踩轉弱，不追殺':'觀望等方向一致',aiReady:false,aiError:error};
}
async function getSymbolWebAnalysis(symbol, direction=''){
  const clean=cleanFuturesSymbol(symbol), key=`${clean}:${String(direction||'').toUpperCase()}`, now=Date.now(), cached=symbolAnalysisCache.get(key);
  if(cached&&now-cached.at<SYMBOL_ANALYSIS_CACHE_MS)return {...cached.data,cached:true,cacheAgeMs:now-cached.at,cacheExpiresInMs:Math.max(0,SYMBOL_ANALYSIS_CACHE_MS-(now-cached.at)),cacheMs:SYMBOL_ANALYSIS_CACHE_MS};
  const [ideas,flow]=await Promise.all([getRankedIdeas().catch(()=>null),getMarketFlow().catch(()=>null)]);
  const idea=(ideas?.rows||[]).find(x=>x.symbol===clean&&(!direction||x.direction===direction))||(ideas?.rows||[]).find(x=>x.symbol===clean)||null;
  const profile=idea?.profile||symbolProjectProfile(clean);
  if(!OPENAI_API_KEY){const data={...quantOnlySymbolAnalysis(clean,idea,profile,'AI未連線'),cached:false,cacheAgeMs:0,cacheExpiresInMs:SYMBOL_ANALYSIS_CACHE_MS,cacheMs:SYMBOL_ANALYSIS_CACHE_MS};symbolAnalysisCache.set(key,{at:now,data});return data}
  const tracker=[...testSignalTrackers.values()].find(t=>t.symbol===clean&&(!direction||t.direction===direction))||null;
  const trackerView=tracker?publicTestTracker(tracker):null;
  const payload={
    symbol:clean,profile,market:flow?.summary||null,
    idea:idea?{direction:idea.direction,modelScore:idea.modelScore,rankScore:idea.rankScore,estimatedWinRate:idea.estimatedWinRate,historicalHitRate:idea.historicalHitRate,backtestSample:idea.backtestSample,changePct:idea.changePct,fundingPct:idea.fundingPct,metrics:idea.metrics,reason:idea.reason}:null,
    monitor:trackerView?{rank:trackerView.rank,rankHeat:trackerView.rankHeat,priorityScore:trackerView.priorityScore,observationProgress:trackerView.observationProgress,strategyProfile:trackerView.strategyProfile,calibratedWinRate:trackerView.calibratedWinRate,confirmedWinRate:trackerView.confirmedWinRate,winRateDelta:trackerView.winRateDelta,monitorLabel:trackerView.monitorLabel,monitorScore:trackerView.monitorScore,notificationTier:trackerView.notificationTier,freshness:trackerView.freshness,currentPrice:trackerView.currentPrice,entryZone:trackerView.preferredEntryZone,entryStrategy:trackerView.entryStrategy,confirmationPrice:trackerView.confirmationPrice,structureProtection:trackerView.structureProtection,stop:trackerView.stop,target1R:trackerView.target1R,mfePct:trackerView.mfePct,maePct:trackerView.maePct,setup:trackerView.setup,lastCheck:trackerView.lastCheck,monitorEvidence:trackerView.monitorEvidence}:null
  };
  const prompt=`你是加密貨幣日內研究與風險交叉驗證助手。請用網路搜尋 ${clean} 對應專案最新資料，優先官方、主流可靠媒體與最近24小時消息；再把網路消息與我提供的 Binance Futures 多維量化資料交叉比對。量化包含5/15/30/60分結構與動能、OI、主動買賣、大戶/全市場多空、Funding、20檔委託簿/價差、ADL風險、BTC/ETH大盤對齊、當日排名，以及順勢回踩、突破回測、流動性掃盤反轉、強勢動能續攻、區間極值反轉五套自動策略。請主動指出「互相支持」與「互相矛盾」的地方，不要因單一利多/利空改變結論。只輸出繁體中文嚴格 JSON，不要 markdown，不要保證獲利，不要把模型估算勝率當真實機率。若沒有可靠重大消息要明確寫「未見重大催化」。
JSON schema={"profile":{"sector":"<=18字","purpose":"<=42字"},"bias":"偏多|偏空|中性","strength":"強|偏強|中性|偏弱|弱","agreement":"高度一致|偏一致|分歧|高風險","summary":"<=100字","bullish":["最多3條，每條<=42字"],"bearish":["最多3條，每條<=42字"],"conflicts":["最多4條，每條<=42字"],"watch":["最多4條，每條<=42字"],"news":[{"tone":"利多|利空|中性","text":"<=48字"}],"entryTiming":"現在適合|等回踩|等反彈|等轉強|不適合 + <=45字理由","action":"<=75字"}. 今日策略必須避免追高/追殺；若價格已離較佳進場區太遠，entryTiming 必須要求等待。量化資料=${JSON.stringify(payload)}`;
  try{
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${OPENAI_API_KEY}`},body:JSON.stringify({model:OPENAI_MODEL,tools:[{type:'web_search',search_context_size:'medium',user_location:{type:'approximate',country:'TW',timezone:'Asia/Taipei'}}],input:prompt,max_output_tokens:1400})});
    if(!r.ok)throw new Error(`OpenAI ${r.status}`);
    const json=await r.json(), parsed=JSON.parse(cleanJsonText(extractOpenAIText(json)));
    const data={ok:true,mode:'AI_WEB',symbol:clean,generatedAt:new Date().toISOString(),profile:{sector:String(parsed?.profile?.sector||profile.sector).slice(0,50),purpose:String(parsed?.profile?.purpose||profile.purpose).slice(0,120)},bias:['偏多','偏空','中性'].includes(parsed?.bias)?parsed.bias:'中性',strength:['強','偏強','中性','偏弱','弱'].includes(parsed?.strength)?parsed.strength:'中性',agreement:['高度一致','偏一致','分歧','高風險'].includes(parsed?.agreement)?parsed.agreement:'分歧',summary:String(parsed?.summary||'').slice(0,240),bullish:Array.isArray(parsed?.bullish)?parsed.bullish.slice(0,3).map(x=>String(x).slice(0,100)):[],bearish:Array.isArray(parsed?.bearish)?parsed.bearish.slice(0,3).map(x=>String(x).slice(0,100)):[],conflicts:Array.isArray(parsed?.conflicts)?parsed.conflicts.slice(0,4).map(x=>String(x).slice(0,100)):[],watch:Array.isArray(parsed?.watch)?parsed.watch.slice(0,4).map(x=>String(x).slice(0,100)):[],news:Array.isArray(parsed?.news)?parsed.news.slice(0,4).map(x=>({tone:['利多','利空','中性'].includes(x?.tone)?x.tone:'中性',text:String(x?.text||'').slice(0,110)})).filter(x=>x.text):[],entryTiming:String(parsed?.entryTiming||'').slice(0,150),action:String(parsed?.action||'').slice(0,190),aiReady:true,aiError:null};
    const stamped={...data,cached:false,cacheAgeMs:0,cacheExpiresInMs:SYMBOL_ANALYSIS_CACHE_MS,cacheMs:SYMBOL_ANALYSIS_CACHE_MS};symbolAnalysisCache.set(key,{at:Date.now(),data:stamped});return stamped;
  }catch(e){const data={...quantOnlySymbolAnalysis(clean,idea,profile,shortOpenAIError(e)),cached:false,cacheAgeMs:0,cacheExpiresInMs:SYMBOL_ANALYSIS_CACHE_MS,cacheMs:SYMBOL_ANALYSIS_CACHE_MS};symbolAnalysisCache.set(key,{at:Date.now(),data});return data}
}

async function fetchAIDailyBrief(flow, ideas) {
  if(!OPENAI_API_KEY)return fallbackDailyBrief(flow,ideas,{aiConfigured:false});
  const marketPayload={summary:flow.summary,leaders:(flow.leaders||[]).slice(0,8).map(x=>({symbol:x.symbol,changePct:x.changePct,fundingPct:x.fundingPct,quoteVolume:x.quoteVolume})),ranked:(ideas?.rows||[]).slice(0,8).map(x=>({symbol:x.symbol,direction:x.direction,estimatedWinRate:x.estimatedWinRate,rankScore:x.rankScore,reason:x.reason}))};
  const prompt=`你是加密貨幣日內市場研究助手。現在是台灣時間。請先使用網路搜尋，整理「當下」全球總經、Fed/利率/美元/美債、美股風險偏好、ETF/監管、BTC/ETH與重大加密新聞，再結合我提供的 Binance 即時摘要與量化排名。不要寫長文，只輸出嚴格 JSON，不要 markdown。JSON schema: {"bias":"偏多|偏空|中性","score":0-100,"title":"<=26個中文字","bullets":["最多6條，每條<=38中文字"],"action":"<=45中文字","sources":[{"title":"短標題","url":"https://..."}]}. 不要保證獲利，不要把模型估算勝率當成真實機率。市場資料=${JSON.stringify(marketPayload)}`;
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${OPENAI_API_KEY}`},body:JSON.stringify({model:OPENAI_MODEL,tools:[{type:'web_search',search_context_size:'medium',user_location:{type:'approximate',country:'TW',timezone:'Asia/Taipei'}}],input:prompt,max_output_tokens:1200})});
  if(!r.ok)throw new Error(`OpenAI ${r.status}`);
  const json=await r.json(), text=extractOpenAIText(json).trim();
  const cleaned=text.replace(/^```json\s*/i,'').replace(/```$/,'').trim();
  const parsed=JSON.parse(cleaned);
  return {ok:true,mode:'AI_WEB',generatedAt:new Date().toISOString(),bias:String(parsed.bias||'中性'),score:clamp(Number(parsed.score||50),0,100),title:String(parsed.title||'今日市場整理').slice(0,80),bullets:Array.isArray(parsed.bullets)?parsed.bullets.slice(0,6).map(x=>String(x).slice(0,100)):[],action:String(parsed.action||'').slice(0,120),sources:Array.isArray(parsed.sources)?parsed.sources.slice(0,5).map(x=>({title:String(x?.title||'來源').slice(0,80),url:String(x?.url||'')})).filter(x=>/^https?:\/\//.test(x.url)):[],aiReady:true,aiConfigured:true,aiError:null};
}

function taipeiClock(date=new Date()) {
  const shifted = new Date(date.getTime() + 8*60*60*1000);
  return { y:shifted.getUTCFullYear(), m:shifted.getUTCMonth()+1, d:shifted.getUTCDate(), hour:shifted.getUTCHours(), minute:shifted.getUTCMinutes(), shifted };
}
function ymdFromUtcDate(d){return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`}
function dailyBriefDayKey(date=new Date()) {
  const p=taipeiClock(date), d=new Date(Date.UTC(p.y,p.m-1,p.d));
  if(p.hour*60+p.minute<DAILY_BRIEF_SCHEDULE_MINUTE)d.setUTCDate(d.getUTCDate()-1);
  return ymdFromUtcDate(d);
}
function inDailyBriefWindow(date=new Date()) {
  const p=taipeiClock(date), min=p.hour*60+p.minute;
  return min>=DAILY_BRIEF_SCHEDULE_MINUTE && min<DAILY_BRIEF_SCHEDULE_MINUTE+DAILY_BRIEF_PUSH_WINDOW_MIN;
}
function shortOpenAIError(err) {
  const s=String(err?.message||err||'');
  if(/OpenAI 401/.test(s))return 'KEY 無效';
  if(/OpenAI 429/.test(s))return '額度或速率限制';
  if(/OpenAI 4\d\d/.test(s))return 'API 請求失敗';
  if(/OpenAI 5\d\d/.test(s))return 'OpenAI 暫時異常';
  return '網搜暫時失敗';
}
async function getDailyBrief(force=false) {
  const dayKey=dailyBriefDayKey();
  if(!force&&dailyBriefCache.data&&dailyBriefCache.dayKey===dayKey)return dailyBriefCache.data;
  if(!dailyBriefCache.inflight){
    dailyBriefCache.inflight=(async()=>{const [flow,ideas]=await Promise.all([getMarketFlow(),getRankedIdeas().catch(()=>null)]);try{return await fetchAIDailyBrief(flow,ideas)}catch(e){return fallbackDailyBrief(flow,ideas,{aiConfigured:Boolean(OPENAI_API_KEY),error:shortOpenAIError(e)})}})().then(data=>{dailyBriefCache={at:Date.now(),dayKey,data,error:null,inflight:null};saveJson(DAILY_BRIEF_FILE,{at:dailyBriefCache.at,dayKey,data});return data}).catch(e=>{dailyBriefCache.error=String(e?.message||e);dailyBriefCache.inflight=null;throw e});
  }
  return dailyBriefCache.inflight;
}

async function dailyBriefLoop() {
  try {
    if(inDailyBriefWindow()){
      const brief=await getDailyBrief(false); // 每日 08:05 先整理一次，不依賴是否開通知
      const dayKey=dailyBriefDayKey(), records=loadSubRecords(), keep=[];
      for(const rec of records){
        if(rec.dailyBriefEnabled!==true){keep.push(rec);continue}
        if(rec.lastDailyBriefPushDay===dayKey){keep.push(rec);continue}
        try{
          await webpush.sendNotification(rec.subscription,JSON.stringify({
            title:`市場整理｜${brief.bias||'中性'} ${Math.round(Number(brief.score||50))}`,
            body:`${brief.title||'今日市場整理'}${brief.action?`｜${brief.action}`:''}`.slice(0,180),
            tag:`daily-brief-${dayKey}`,
            renotify:false,
            data:{url:'/'},
          }),{TTL:300,urgency:'normal'});
          rec.lastDailyBriefPushAt=new Date().toISOString();
          rec.lastDailyBriefPushDay=dayKey;
          keep.push(rec);
        }catch(e){if(![404,410].includes(e.statusCode))keep.push(rec)}
      }
      saveSubRecords(keep);
    }
  }catch(e){console.warn(`[daily-brief] ${String(e?.message||e)}`)}
  dailyBriefTimer=setTimeout(dailyBriefLoop,5*60*1000);
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

app.get('/api/symbol-analysis', async (req, res) => {
  try {
    const symbol=cleanFuturesSymbol(req.query?.symbol||'');
    const direction=String(req.query?.direction||'').toUpperCase();
    if(!symbol||!symbol.endsWith('USDT'))return res.status(400).json({ok:false,error:'INVALID_SYMBOL'});
    const data=await getSymbolWebAnalysis(symbol,['LONG','SHORT'].includes(direction)?direction:'');
    res.json(data);
  } catch (err) { res.status(503).json({ok:false,error:String(err?.message||err)}); }
});

app.get('/api/performance', (_req,res)=>res.json(performanceResponse()));
app.get('/api/performance.csv', (_req,res)=>{
  const cols=['notificationAt','receivedAt','clickedAt','symbol','direction','phase','tier','strategyLabel','strategyId','observationProgress','marketRegime','entryPrice','stop','target','targetR','calibratedWinRate','dataCoverage','dataConfidence','status','result','resultAt','exitPrice','mfePct','maePct','realizedR','grossReturnPct','netReturnPct','signalToPushMs','pushServiceMs','deliveryLatencyMs','clickLatencyMs','notificationPriceSource'];
  const escCsv=v=>{if(v==null)return'';const x=String(v);return /[\",\n\r]/.test(x)?`\"${x.replace(/\"/g,'\"\"')}\"`:x};
  const rows=signalPerformance.filter(x=>x?.version==='V10.0'),csv=[cols.join(','),...rows.map(x=>cols.map(k=>escCsv(x[k])).join(','))].join('\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename=signal-performance-v10-${new Date().toISOString().slice(0,10)}.csv`);res.send('\uFEFF'+csv);
});
app.post('/api/notification-received',(req,res)=>{const id=String(req.body?.id||'');if(!id)return res.status(400).json({ok:false});const found=performanceApplyNotificationAck('received',id,req.body?.at);res.json({ok:true,found});});
app.post('/api/notification-click',(req,res)=>{const id=String(req.body?.id||'');if(!id)return res.status(400).json({ok:false});const found=performanceApplyNotificationAck('clicked',id,req.body?.at);res.json({ok:true,found});});
app.get('/api/realtime', (_req,res)=>res.json({ok:true,generatedAt:new Date().toISOString(),...realtimeHealthSnapshot()}));

app.get('/api/self-test', async (req,res)=>{
  const live=String(req.query?.live||'0')==='1',checks=[];
  try{const sm=summarizeDepth([['100','2'],['99','3']],[['101','1'],['102','2']]);checks.push({name:'depth-calculation',ok:sm.ok&&sm.bidNotional>0&&sm.askNotional>0&&Number.isFinite(sm.spreadBps)})}catch(e){checks.push({name:'depth-calculation',ok:false,error:String(e?.message||e)})}
  try{const tech=technicalSnapshot(Array.from({length:90},(_,i)=>({open:100+i*.08,high:100.3+i*.08,low:99.7+i*.08,close:100.1+i*.08,volume:1000+i,openTime:i*300000,closeTime:(i+1)*300000-1})));checks.push({name:'technical-indicators',ok:Number.isFinite(tech.rsi14)&&Number.isFinite(tech.atr14)&&Number.isFinite(tech.adx14)})}catch(e){checks.push({name:'technical-indicators',ok:false,error:String(e?.message||e)})}
  try{const u1=realtimeSocketUrl('public',['BTCUSDT']),u2=realtimeSocketUrl('market',['BTCUSDT']);checks.push({name:'websocket-url',ok:u1.includes('/public/stream?streams=')&&u1.includes('btcusdt@depth20@100ms')&&u2.includes('/market/stream?streams=')&&u2.includes('btcusdt@aggTrade')})}catch(e){checks.push({name:'websocket-url',ok:false,error:String(e?.message||e)})}
  try{const perf=performanceAggregate([{version:'V10.0',status:'RESOLVED',result:'WIN',realizedR:1,grossReturnPct:1,netReturnPct:.88,mfePct:1.2,maePct:.2,tier:'HIGH',direction:'LONG',marketRegime:'TREND_UP',symbol:'BTCUSDT',calibratedWinRate:65,signalToPushMs:2800,pushServiceMs:120,deliveryLatencyMs:430}],false);checks.push({name:'performance-ledger',ok:perf.sample===1&&perf.wins===1&&perf.hitRate===100})}catch(e){checks.push({name:'performance-ledger',ok:false,error:String(e?.message||e)})}
  const liveRows=[];
  if(live){for(const symbol of ['BTCUSDT','ETHUSDT']){const started=Date.now();try{const [c,m,d,r,x]=await Promise.all([testFetchCandles(symbol,'5m',120),testFetchMicrostructure(symbol),testFetchDerivatives(symbol),testFetchRiskContext(symbol),testFetchCrossExchange(symbol).catch(()=>null)]);const source=testCandleSourceCache.get(`${symbol}:5m:120`);const ok=Array.isArray(c)&&c.length>=60&&m?._health?.depth===true&&(d?._health?.oi===true||d?._health?.taker===true)&&r?._health?.mark===true;const row={name:`live-${symbol}`,ok,elapsedMs:Date.now()-started,sources:{candles:source?.source||source||null,depth:m?._source?.depth||null,oi:d?._source?.oi||null,taker:d?._source?.taker||null,mark:r?._source?.mark||null,funding:r?._source?.funding||null,crossAvailable:x?.available??null}};checks.push(row);liveRows.push(row)}catch(e){const row={name:`live-${symbol}`,ok:false,elapsedMs:Date.now()-started,error:String(e?.message||e)};checks.push(row);liveRows.push(row)}}}
  const realtime=realtimeHealthSnapshot();
  res.json({ok:checks.every(x=>x.ok),version:BUILD_VERSION,live,generatedAt:new Date().toISOString(),checks,liveRows,realtime,performance:{records:signalPerformance.filter(x=>x.version==='V10.0').length}});
});

app.get('/api/test-signals', async (req, res) => {
  try {
    const force = String(req.query?.force || '') === '1';
    if (force || !testSignalLastRunAt || Date.now() - testSignalLastRunAt > TEST_SIGNAL_SCAN_MS * 1.5) await runTestSignalScan(force);
    res.json(testSignalResponse());
  } catch (err) {
    res.status(503).json({ ok:false, error:String(err?.message || err) });
  }
});

app.get('/api/data-probe', async (req, res) => {
  const symbol=cleanFuturesSymbol(req.query?.symbol||'BTCUSDT');
  if(!/^[A-Z0-9]{3,24}USDT$/.test(symbol))return res.status(400).json({ok:false,error:'invalid symbol'});
  try{
    const started=Date.now();
    const [c5,c15,c30,c1h,deriv,micro,risk,cross]=await Promise.all([
      testFetchCandles(symbol,'5m',180).catch(e=>({__error:String(e?.message||e)})),
      testFetchCandles(symbol,'15m',180).catch(e=>({__error:String(e?.message||e)})),
      testFetchCandles(symbol,'30m',120).catch(e=>({__error:String(e?.message||e)})),
      testFetchCandles(symbol,'1h',120).catch(e=>({__error:String(e?.message||e)})),
      testFetchDerivatives(symbol).catch(e=>({__error:String(e?.message||e)})),
      testFetchMicrostructure(symbol).catch(e=>({__error:String(e?.message||e)})),
      testFetchRiskContext(symbol).catch(e=>({__error:String(e?.message||e)})),
      testFetchCrossExchange(symbol).catch(e=>({__error:String(e?.message||e)})),
    ]);
    const candleInfo=(rows,interval,limit)=>{const err=rows?.__error;if(err)return {ok:false,error:err};const closed=closedTestCandles(rows),t=closed.length>=60?technicalSnapshot(closed):null,src=testCandleSourceCache.get(`${symbol}:${interval}:${limit}`)||{};return {ok:closed.length>=60,bars:closed.length,source:src.source||null,fallback:src.fallback===true,rsi:t?.rsi14??null,adx:t?.adx14??null,volumeRatio:t?.volumeRatio??null,trend:t?.trend??null,error:src.error||null}};
    res.json({ok:true,symbol,generatedAt:new Date().toISOString(),elapsedMs:Date.now()-started,mode:'V10.0 SOLO MAX',candles:{m5:candleInfo(c5,'5m',180),m15:candleInfo(c15,'15m',180),m30:candleInfo(c30,'30m',120),h1:candleInfo(c1h,'1h',120)},derivatives:deriv,microstructure:micro,risk,crossExchange:cross});
  }catch(e){res.status(502).json({ok:false,symbol,error:String(e?.message||e)})}
});

app.post('/api/test-signal-push', async (_req, res) => {
  try {
    await sendPush({
      title:'測試｜多策略觀察完成 82',
      body:'BTCUSDT 做多｜突破回測 · 校準 68.4%｜點開策略判讀',
      tag:`test-signal-demo-${Date.now()}`,
      renotify:true,
      data:{url:'/?page=monitor&testSignal=BTCUSDT&dir=LONG'},
    }, { testSignal:true });
    res.json({ok:true});
  } catch (e) { res.status(500).json({error:String(e?.message||e)}); }
});

app.get('/api/daily-brief', async (req, res) => {
  try {
    const force = String(req.query?.force || '') === '1';
    const data = await getDailyBrief(force);
    res.json({...data, schedule:'08:05 Asia/Taipei', dayKey:dailyBriefDayKey(), runtime:{project:RUNTIME_PROJECT||null,service:RUNTIME_SERVICE||null,version:BUILD_VERSION,aiConfigured:Boolean(OPENAI_API_KEY)}});
  } catch (err) {
    res.status(503).json({ ok:false, error:String(err?.message || err) });
  }
});

app.get('/api/config', (_req, res) => {
  res.json({
    mode: 'V10_0_SOLO_MAX_REALTIME_PERFORMANCE',
    pollMs: POLL_MS,
    coreOrderPollMs: CORE_ORDER_POLL_MS,
    secondaryOrderPollMs: SECONDARY_ORDER_POLL_MS,
    positionRefreshMs: POSITION_REFRESH_MS,
    copyBapiBudgetPerMin: COPY_BAPI_BUDGET_PER_MIN,
    statsRefreshMs: STATS_REFRESH_MS,
    statsMaxPages: STATS_MAX_PAGES,
    vapidPublicKey: vapid.publicKey,
    dailyBrief: { aiReady: Boolean(OPENAI_API_KEY), model: OPENAI_API_KEY ? OPENAI_MODEL : null, schedule:'08:05 Asia/Taipei', manualRefresh:true, runtime:{project:RUNTIME_PROJECT||null,service:RUNTIME_SERVICE||null,version:BUILD_VERSION} },
    rankedIdeas: { symbols: IDEA_SYMBOLS, cacheMs: IDEA_CACHE_MS, webAnalysisOnDemand:true, webAnalysisCacheMs:SYMBOL_ANALYSIS_CACHE_MS },
    dataMax: { primary:'Binance', fallbacks:ENABLE_CROSS_EXCHANGE?['Binance成交資料','Bybit','OKX']:['Binance成交資料'], crossExchange:ENABLE_CROSS_EXCHANGE, probe:'/api/data-probe?symbol=BTCUSDT' },
    testSignals: { scanMs: TEST_SIGNAL_SCAN_MS, max: TEST_SIGNAL_MAX, confirmScore: TEST_SIGNAL_CONFIRM_SCORE, weakFlags: TEST_MONITOR_WEAK_FLAGS, stateBars: TEST_MONITOR_STATE_BARS, routeToMonitor: true, lifecycle: true, reentry:true, reentryScore:TEST_REENTRY_SCORE, reentryConfirmBars:TEST_REENTRY_CONFIRM_BARS },
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
    mode: BUILD_VERSION,
    dataDir: DATA_DIR,
    statsRunning,
    statsCursor,
    markPriceUpdatedAt,
    markPriceError,
    markPriceSymbols: markPrices.size,
    realtime: realtimeHealthSnapshot(),
    performance: { records:signalPerformance.filter(x=>x.version==='V10.0').length, active:signalPerformance.filter(x=>x.version==='V10.0'&&x.status==='ACTIVE').length, summary:performanceAggregate() },
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
  const testSignalEnabled = body.testSignalEnabled === true;
  const testSignalNotifyMode = cleanTestSignalNotifyMode(body.testSignalNotifyMode);
  const dailyBriefIntervalHours = 24;

  const records = loadSubRecords();
  const idx = records.findIndex(r => r.endpoint === subscription.endpoint);

  const next = {
    endpoint: subscription.endpoint,
    subscription,
    enabledTraders,
    enabledTypes,
    consensusEnabled,
    dailyBriefEnabled,
    testSignalEnabled,
    testSignalNotifyMode,
    dailyBriefIntervalHours,
    lastDailyBriefPushAt: idx >= 0 ? records[idx]?.lastDailyBriefPushAt || null : null,
    lastDailyBriefPushDay: idx >= 0 ? records[idx]?.lastDailyBriefPushDay || null : null,
    preferenceVersion:100,
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
    testSignalEnabled,
    testSignalNotifyMode,
    dailyBriefIntervalHours,
    preferenceVersion:100,
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
  if (typeof req.body?.testSignalEnabled === 'boolean') rec.testSignalEnabled = req.body.testSignalEnabled;
  if (req.body?.testSignalNotifyMode !== undefined) rec.testSignalNotifyMode = cleanTestSignalNotifyMode(req.body.testSignalNotifyMode);
  if (req.body?.dailyBriefIntervalHours !== undefined) rec.dailyBriefIntervalHours = 24;
  rec.preferenceVersion = 100;

  saveSubRecords(records);

  res.json({
    ok: true,
    enabledTraders: rec.enabledTraders,
    enabledTypes: rec.enabledTypes,
    consensusEnabled: rec.consensusEnabled !== false,
    dailyBriefEnabled: rec.dailyBriefEnabled === true,
    testSignalEnabled: rec.testSignalEnabled === true,
    testSignalNotifyMode: cleanTestSignalNotifyMode(rec.testSignalNotifyMode),
    dailyBriefIntervalHours: 24,
    preferenceVersion:100,
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
    mode: BUILD_VERSION,
    realtime: realtimeHealthSnapshot(),
    performanceRecords: signalPerformance.filter(x=>x.version==='V10.0').length,
  });
});

if (process.env.UNIT_TEST !== '1') {
  app.listen(PORT, () => {
    console.log(`Position Alert V10.1 SOLO MAX MULTI-PLAYBOOK started on ${PORT}`);
    console.log(`Tracking: ${TRADERS.map(t => `${t.name}(${t.id})`).join(', ')}`);
    loop();
    statsTimer = setTimeout(statsLoop, 8000);
    referenceTimer = setTimeout(referenceLoop, 12000);
    screenTimer = setTimeout(screenLoop, 16000);
    dailyBriefTimer = setTimeout(dailyBriefLoop, 25000);
    testSignalTimer = setTimeout(testSignalLoop, 8000);
    performanceTimer=setInterval(performanceTrackerFallback,1000);performanceTimer.unref?.();
    scheduleNextFiveMinuteScan();
    startRealtime();
  });
}

process.on('SIGTERM', () => {
  if (timer) clearTimeout(timer);
  if (statsTimer) clearTimeout(statsTimer);
  if (referenceTimer) clearTimeout(referenceTimer);
  if (screenTimer) clearTimeout(screenTimer);
  if (dailyBriefTimer) clearTimeout(dailyBriefTimer);
  if (testSignalTimer) clearTimeout(testSignalTimer);
  if (testBarTimer) clearTimeout(testBarTimer);
  if (performanceTimer) clearInterval(performanceTimer);
  if (performanceSaveTimer) clearTimeout(performanceSaveTimer);
  saveJson(SIGNAL_PERFORMANCE_FILE,signalPerformance.slice(0,1200));
  stopRealtime();
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
  testMonitorStateLabel,
  testMonitorEvidence,
  performanceAggregate,
  performanceCalibration,
  realtimeSocketUrl,
  realtimeSnapshot,
  realtimeHealthSnapshot,
  summarizeDepth,
  testSignalTier,
  testWeightedProgress,
  testStrategyPlaybooks,
  testMonitorPriority,
  testPushCopy,
  testLifecycleMessage,
  sendTestLifecyclePush,
  analyzeTestTracker,
};
