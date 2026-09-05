// INSTITUTIONAL_MENTOR_EDGE_V2622
// INSTITUTIONAL_SHADOW_EDGE_V2621
// V2682_PRODUCTION_FINALIZE_20260905
// WORTH_WATCH_V2682_20260905
// SHADOW_BOOTCAMP_V2681_20260905
// CANDIDATE_UI_NOTIFY_CUSTOM_V2673_20260904
// RUNTIME_STABILITY_V2616
// PUSH_RECOVERY_V2665_20260904
// NOTIFICATION_CONTROL_V2616
// NOTIFICATION_POLICY_V2611: high/normal entry + ABC + trader orders + daily brief only.
// CANDIDATE_OPS_HISTORY_TRADE_V2671_20260904
// CANDIDATE_REAL_RECALL_FIX_V2670_20260904
// MARKETWIDE_CANDIDATE_RECALL_V2669_20260904
// CANDIDATE_LIFECYCLE_V2667_20260904
// MANUAL_CANDIDATE_RECALL_V2665_20260904
// TRADFI_LEARNING_V2612_20260902
// MANUAL_RECOVERY_STABLE_V2664_20260904
import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { evaluateWorthWatchV2682, selectWorthWatchV2682, WORTH_WATCH_DEFAULTS_V2682 } from './worth-watch-v2682-core.mjs';

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
const IDEA_SYMBOLS = Math.max(24, Math.min(48, Number(process.env.IDEA_SYMBOLS || 40)));
const RADAR_MAX_SYMBOLS = Math.max(120, Math.min(500, Number(process.env.RADAR_MAX_SYMBOLS || 300)));
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
const SHADOW_MIN_SCORE = Math.max(55, Math.min(85, Number(process.env.SHADOW_MIN_SCORE || 65)));
const SHADOW_MIN_PROGRESS = Math.max(70, Math.min(95, Number(process.env.SHADOW_MIN_PROGRESS || 80)));
const SHADOW_MIN_COVERAGE = Math.max(55, Math.min(90, Number(process.env.SHADOW_MIN_COVERAGE || 65)));
const SHADOW_MIN_CONFIDENCE = Math.max(50, Math.min(90, Number(process.env.SHADOW_MIN_CONFIDENCE || 58)));
const SHADOW_MAX_RECORDS = Math.max(1200, Math.min(12000, Number(process.env.SHADOW_MAX_RECORDS || 12000)));
const PERF_HISTORY_MAX_RECORDS = Math.max(1200, Math.min(6000, Number(process.env.PERF_HISTORY_MAX_RECORDS || 3000)));
const BACKTEST_CACHE_MS = Math.max(15*60*1000, Math.min(4*60*60*1000, Number(process.env.BACKTEST_CACHE_MS || 60*60*1000)));
const HOBBY_BACKUP_INTERVAL_MS = Math.max(60*60*1000, Number(process.env.HOBBY_BACKUP_INTERVAL_MS || 6*60*60*1000));
const HOBBY_BACKUP_KEEP_DAYS = Math.max(3, Math.min(30, Number(process.env.HOBBY_BACKUP_KEEP_DAYS || 14)));
const SHADOW_REARM_MS = Math.max(10*60*1000, Math.min(90*60*1000, Number(process.env.SHADOW_REARM_MS || 30*60*1000)));
const STATE_LEARNING_DEDUP_MS = Math.max(15*60*1000, Math.min(4*60*60*1000, Number(process.env.STATE_LEARNING_DEDUP_MS || 45*60*1000)));
const SYSTEM_MONITOR_TTL_MS = Math.max(60*60*1000, Math.min(12*60*60*1000, Number(process.env.SYSTEM_MONITOR_TTL_MS || PERF_MAX_HORIZON_MS)));
const STATE_LEARNING_MIN_SAMPLE = Math.max(10, Math.min(50, Number(process.env.STATE_LEARNING_MIN_SAMPLE || 20)));
const STATE_LEARNING_MAX_BONUS = Math.max(2, Math.min(8, Number(process.env.STATE_LEARNING_MAX_BONUS || 6)));
const REGIME_LIQUIDATION_5M_USD = Math.max(1_000_000, Number(process.env.REGIME_LIQUIDATION_5M_USD || 15_000_000));
const TEST_SIGNAL_MAX = Math.max(12, Math.min(24, Number(process.env.TEST_SIGNAL_MAX || 20)));
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
const BUILD_VERSION = 'V10.2.7';
const DAILY_BRIEF_PUSH_WINDOW_MIN = 25;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const SYMBOL_ANALYSIS_CACHE_MS = Math.max(2 * 60 * 60 * 1000, Number(process.env.SYMBOL_ANALYSIS_CACHE_MS || 6 * 60 * 60 * 1000));
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
const SHADOW_PERFORMANCE_FILE = path.join(DATA_DIR, 'shadow-performance-v1022.json');
const ACTUAL_TRADE_FILE = path.join(DATA_DIR, 'actual-trades-v1026.json');

// RAILWAY_HOBBY_V267: tiny daily gzip snapshots of learning ledgers on the existing Railway Volume.
// No subscriptions, VAPID keys or cookies are copied. This protects Shadow growth from accidental overwrite.
const HOBBY_BACKUP_DIR = path.join(DATA_DIR, 'backups-v267');
let hobbyBackupTimerV267 = null;
function hobbyDayKeyV267(ts=Date.now()){const d=new Date(ts);return d.toISOString().slice(0,10)}
function runHobbyBackupV267(){
  try{
    fs.mkdirSync(HOBBY_BACKUP_DIR,{recursive:true});
    const day=hobbyDayKeyV267();
    const files=[SHADOW_PERFORMANCE_FILE,SIGNAL_PERFORMANCE_FILE,TEST_SIGNAL_FILE,TEST_SIGNAL_HISTORY_FILE,ACTUAL_TRADE_FILE];
    for(const source of files){
      if(!fs.existsSync(source))continue;
      const base=path.basename(source).replace(/\.json$/i,'');
      const target=path.join(HOBBY_BACKUP_DIR,`${base}-${day}.json.gz`);
      if(fs.existsSync(target))continue;
      const raw=fs.readFileSync(source);
      if(!raw.length)continue;
      fs.writeFileSync(target,gzipSync(raw,{level:6}));
    }
    const cutoff=Date.now()-HOBBY_BACKUP_KEEP_DAYS*24*60*60*1000;
    for(const name of fs.readdirSync(HOBBY_BACKUP_DIR)){
      if(!/\.json\.gz$/i.test(name))continue;
      const p=path.join(HOBBY_BACKUP_DIR,name);
      try{if(fs.statSync(p).mtimeMs<cutoff)fs.unlinkSync(p)}catch{}
    }
  }catch(err){console.warn('[v267-hobby-backup]',String(err?.message||err))}
}
setTimeout(()=>{runHobbyBackupV267();hobbyBackupTimerV267=setInterval(runHobbyBackupV267,HOBBY_BACKUP_INTERVAL_MS);hobbyBackupTimerV267.unref?.()},60_000).unref?.();
const STRUCTURE_LEARNING_FILE = path.join(DATA_DIR, 'structure-learning-v2.json');
const STRUCTURE_ENGINE_VERSION = 'S2.1.0';
const STRUCTURE_ENGINE_MARKER = 'STRUCTURE_ENGINE_V21_20260902';
const STRUCTURE_V2_MIN_SAMPLE = Math.max(12, Math.min(80, Number(process.env.STRUCTURE_V2_MIN_SAMPLE || 20)));
const STRUCTURE_V2_MAX_ADJUST = Math.max(2, Math.min(10, Number(process.env.STRUCTURE_V2_MAX_ADJUST || 8)));
const STRUCTURE_V2_EPISODE_MS = Math.max(15*60*1000, Math.min(2*60*60*1000, Number(process.env.STRUCTURE_V2_EPISODE_MS || 30*60*1000)));
const STRUCTURE_V2_HORIZON_MS = Math.max(90*60*1000, Math.min(8*60*60*1000, Number(process.env.STRUCTURE_V2_HORIZON_MS || 4*60*60*1000)));
const STRUCTURE_V2_NOTIFY_COOLDOWN_MS = Math.max(20*60*1000, Math.min(2*60*60*1000, Number(process.env.STRUCTURE_V2_NOTIFY_COOLDOWN_MS || 45*60*1000)));
const STRUCTURE_V2_NOTIFY_MIN_HEALTH = Math.max(55, Math.min(85, Number(process.env.STRUCTURE_V2_NOTIFY_MIN_HEALTH || 64)));
const STRUCTURE_V2_NOTIFY_MIN_CONFIDENCE = Math.max(55, Math.min(90, Number(process.env.STRUCTURE_V2_NOTIFY_MIN_CONFIDENCE || 65)));
const RESEARCH_AUDIT_FILE = path.join(DATA_DIR, 'research-audit-v1031.json');
const RESEARCH_LAYER_REVISION = 'V10.2.7-R1';
const RESEARCH_LAYER_RELEASE_DATE = '2026-09-01';
const RESEARCH_LAYER_SCORE_MEANING = 'STRUCTURE_COMPLETION';
const RESEARCH_LAYER_MARKER = 'SHADOW_RESEARCH_LAYER_V1_20260901';

// RAILWAY_EGRESS_V266: lower Railway egress without slowing server-side notification polling.
// Dynamic JSON + static text assets are compressed; browser assets may be reused safely.
app.use(compression({ threshold: 1024, level: 4 }));
app.use(express.json({ limit: '128kb' }));

// V2.6.82 production hardening: runtime state/secrets must never be reachable through /public.
// DATA_DIR may contain these files legitimately; only static exposure is blocked.
const PUBLIC_RUNTIME_DENY_V2682 = new Set(['/vapid.json','/subscriptions.json','/events.json','/events-v5.json']);
app.use((req,res,next)=>{
  if(req.method==='GET' && PUBLIC_RUNTIME_DENY_V2682.has(String(req.path||'').toLowerCase())) return res.status(404).end();
  next();
});

// API data must stay fresh, but "no-cache" permits conditional revalidation instead of forcing
// the entire payload to be transferred again when it has not changed.
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'deny',
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    const name = path.basename(filePath).toLowerCase();
    if (name === 'index.html' || name === 'sw.js' || name === 'manifest.webmanifest') {
      // Shell / service worker always revalidate so updates are not trapped by a stale cache.
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else if (/\.(?:png|jpe?g|webp|gif|ico|svg)$/.test(name)) {
      // Versioned artwork and app icons are large and rarely change.
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    } else if (/\.(?:css|js)$/.test(name)) {
      // JS/CSS already use version query strings; one-hour reuse is safe.
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    }
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
let shadowPerformance = Array.isArray(loadJson(SHADOW_PERFORMANCE_FILE, [])) ? loadJson(SHADOW_PERFORMANCE_FILE, []) : [];
let actualTrades = Array.isArray(loadJson(ACTUAL_TRADE_FILE, [])) ? loadJson(ACTUAL_TRADE_FILE, []) : [];
let structureLearning = Array.isArray(loadJson(STRUCTURE_LEARNING_FILE, [])) ? loadJson(STRUCTURE_LEARNING_FILE, []) : [];
let structureLearningSaveTimer = null;
let structureLearningRevision = 1;
let performanceSaveTimer = null;
let actualTradeSaveTimer = null;
let shadowPerformanceSaveTimer = null;
let shadowLearningRevision = 1;
let shadowLearningIndexCache = { revision:-1, maps:null };
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

// RAILWAY_HOBBY_V267: use paid-plan RAM as a bounded cache, never as an unbounded leak.
function pruneRuntimeCachesV267(map,maxAgeMs,maxEntries){
  const now=Date.now();
  for(const [key,val] of map){const at=Number(val?.at||0);if(at>0&&now-at>maxAgeMs)map.delete(key)}
  if(map.size<=maxEntries)return;
  const oldest=[...map.entries()].sort((a,b)=>Number(a[1]?.at||0)-Number(b[1]?.at||0));
  for(let i=0;i<oldest.length-maxEntries;i++)map.delete(oldest[i][0]);
}
const hobbyCachePruneTimerV267=setInterval(()=>{
  pruneRuntimeCachesV267(testCandleCache,45*60*1000,500);
  pruneRuntimeCachesV267(testBacktestCandleCache,4*60*60*1000,300);
  pruneRuntimeCachesV267(testMicroCache,30*60*1000,300);
  pruneRuntimeCachesV267(testRiskCache,60*60*1000,300);
  pruneRuntimeCachesV267(testDerivCache,60*60*1000,300);
  pruneRuntimeCachesV267(testCrossExchangeCache,60*60*1000,300);
},10*60*1000);
hobbyCachePruneTimerV267.unref?.();
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
  const structuralBreach = invalidPrice > 0 && (
    side === 'SHORT' ? snapshot.marketPrice >= invalidPrice : snapshot.marketPrice <= invalidPrice
  );
  if (structuralBreach) next.structuralBreachSince ||= new Date(now).toISOString();
  else { next.structuralBreachSince = null; next.structuralBreachPrice = null; }
  if (structuralBreach) next.structuralBreachPrice = snapshot.marketPrice;

  // Structure Engine V2 rule: a wick/touch, a price-only breach, or Fib 0.786 alone is NOT invalidation.
  // The multi-timeframe structure engine below decides whether the market is merely damaged/reclaiming/opportunity or truly destroyed.
  let eventType = null;
  let reason = null;
  if (snapshot.activated && !next.deepSentAt && snapshot.retracementRatio >= PULLBACK_FIB_INVALID_RATIO) {
    eventType = 'DEEP_PULLBACK';
    reason = 'FIB_0786_STRUCTURE_REVIEW';
    next.deepSentAt = new Date(now).toISOString();
    next.normalSentAt ||= next.deepSentAt;
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
function schedulePerformanceSave(){if(performanceSaveTimer)return;performanceSaveTimer=setTimeout(()=>{performanceSaveTimer=null;signalPerformance=signalPerformance.slice(0,PERF_HISTORY_MAX_RECORDS);saveJson(SIGNAL_PERFORMANCE_FILE,signalPerformance)},1500);performanceSaveTimer.unref?.()}
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

const actualTradeActiveSymbols=new Set(actualTrades.filter(x=>x?.version==='V10.2.6'&&x.status==='ACTIVE').map(x=>cleanFuturesSymbol(x.symbol)));
function scheduleActualTradeSave(){
  if(actualTradeSaveTimer)return;
  actualTradeSaveTimer=setTimeout(()=>{actualTradeSaveTimer=null;actualTrades=actualTrades.slice(0,1500);saveJson(ACTUAL_TRADE_FILE,actualTrades)},900);
  actualTradeSaveTimer.unref?.();
}
function actualTradeDirection(v){return String(v||'').toUpperCase()==='SHORT'?'SHORT':'LONG'}
function actualTradeDirSign(v){return actualTradeDirection(v)==='SHORT'?-1:1}
function actualPriceIsTarget(rec,px,level){const v=finiteMetric(level);if(v==null)return false;return actualTradeDirSign(rec.direction)>0?px>=v:px<=v}
function actualPriceIsStop(rec,px,level){const v=finiteMetric(level);if(v==null)return false;return actualTradeDirSign(rec.direction)>0?px<=v:px>=v}
function actualTradeNotional(rec){const q=finiteMetric(rec.quantity),e=finiteMetric(rec.entryPrice),m=finiteMetric(rec.margin),lev=finiteMetric(rec.leverage);if(q!=null&&q>0&&e!=null&&e>0)return q*e;if(m!=null&&m>0&&lev!=null&&lev>0)return m*lev;return null}
function actualTradePnlAt(rec,exitPrice){const e=finiteMetric(rec.entryPrice),x=finiteMetric(exitPrice),n=actualTradeNotional(rec);if(!(e>0&&x>0&&n>0))return null;const pct=actualTradeDirSign(rec.direction)*(x-e)/e;return Number((n*pct).toFixed(4))}
function actualTradeReturnPct(rec,px){const e=finiteMetric(rec.entryPrice);if(!(e>0&&px>0))return null;return actualTradeDirSign(rec.direction)*(px-e)/e*100}
function actualTradeRecord(body={}){
  const symbol=cleanFuturesSymbol(body.symbol),direction=actualTradeDirection(body.direction),entry=finiteMetric(body.entryPrice),tp1=finiteMetric(body.tp1),tp2=finiteMetric(body.tp2),sp1=finiteMetric(body.sp1),sp2=finiteMetric(body.sp2),margin=finiteMetric(body.margin),quantity=finiteMetric(body.quantity),leverage=finiteMetric(body.leverage);
  if(!symbol||!(entry>0))return {error:'symbol / entryPrice invalid'};
  const signalKey=String(body.signalKey||'').slice(0,100)||null,manualOpportunityId=String(body.manualOpportunityId||'').slice(0,160)||null;if(signalKey){const existing=actualTrades.find(x=>x?.version==='V10.2.6'&&x.status==='ACTIVE'&&x.signalKey===signalKey);if(existing)return {error:'這筆訊號已有追蹤中的實際建倉',existingId:existing.id}}if(manualOpportunityId){const existing=actualTrades.find(x=>x?.version==='V10.2.6'&&x.status==='ACTIVE'&&x.manualOpportunityId===manualOpportunityId);if(existing)return {error:'這個手動機會已有追蹤中的實際建倉',existingId:existing.id}}
  if(!(tp1>0||tp2>0||sp1>0||sp2>0))return {error:'至少填一個 TP / SP'};
  if(!(quantity>0)&&!(margin>0&&leverage>0))return {error:'請填數量，或保證金＋槓桿'};
  const dir=actualTradeDirSign(direction),badTarget=[tp1,tp2].filter(x=>x!=null).some(x=>dir*(x-entry)<=0),badStop=[sp1,sp2].filter(x=>x!=null).some(x=>dir*(x-entry)>=0);
  if(badTarget)return {error:'TP 必須在獲利方向'};if(badStop)return {error:'SP 必須在風險方向'};
  const now=new Date().toISOString(),id=`actual-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  const rec={id,version:'V10.2.6',createdAt:now,updatedAt:now,signalKey,notificationId:String(body.notificationId||'').slice(0,180)||null,symbol,direction,assetClass:assetClassForSymbolV2612(symbol),assetSession:assetSessionV2612(symbol),source:'MANUAL_ACTUAL',manualMode:body.manualMode===true,manualGrade:['A','B','C'].includes(String(body.manualGrade||'').toUpperCase())?String(body.manualGrade).toUpperCase():null,manualGradeScore:finiteMetric(body.manualGradeScore),manualGradeAt:String(body.manualGradeAt||'').slice(0,40)||null,manualOpportunityId,manualReasons:Array.isArray(body.manualReasons)?body.manualReasons.slice(0,8).map(x=>String(x).slice(0,100)):[],manualSnapshot:manualCleanSnapshot(body.manualSnapshot),manualRank:finiteMetric(body.manualSnapshot?.rank),manualStructureState:String(body.manualSnapshot?.structureState||'').slice(0,30)||null,manualStructureHealth:finiteMetric(body.manualSnapshot?.structureHealth),manualShadowHitRate:finiteMetric(body.manualSnapshot?.shadowHitRate),manualShadowProfitFactor:finiteMetric(body.manualSnapshot?.shadowProfitFactor),manualRr:finiteMetric(body.manualSnapshot?.rr),strategyId:String(body.strategyId||'').slice(0,50)||null,strategyLabel:String(body.strategyLabel||'').slice(0,80)||null,marketRegime:String(body.marketRegime||'').slice(0,40)||null,notificationTier:String(body.notificationTier||'').slice(0,20)||null,signalSnapshot:(body.signalSnapshot&&typeof body.signalSnapshot==='object')?{calibratedWinRate:finiteMetric(body.signalSnapshot.calibratedWinRate),monitorScore:finiteMetric(body.signalSnapshot.monitorScore),notificationScore:finiteMetric(body.signalSnapshot.notificationScore),observationProgress:finiteMetric(body.signalSnapshot.observationProgress),rank:finiteMetric(body.signalSnapshot.rank),oi15mChangePct:finiteMetric(body.signalSnapshot.oi15mChangePct),takerRatio:finiteMetric(body.signalSnapshot.takerRatio),depthImbalance:finiteMetric(body.signalSnapshot.depthImbalance),topPositionRatio:finiteMetric(body.signalSnapshot.topPositionRatio),marketAlign:finiteMetric(body.signalSnapshot.marketAlign)}:null,entryPrice:entry,tp1:tp1??null,tp2:tp2??null,sp1:sp1??null,sp2:sp2??null,margin:margin??null,quantity:quantity??null,leverage:leverage??null,notional:null,status:'ACTIVE',result:null,resultAt:null,firstOutcome:null,firstOutcomeAt:null,lastPrice:entry,lastPriceAt:now,lastSource:'manual-entry',mfePct:0,maePct:0,tp1Hit:false,tp1HitAt:null,tp2Hit:false,tp2HitAt:null,sp1Hit:false,sp1HitAt:null,sp2Hit:false,sp2HitAt:null,estimatedPnl:null,estimatedLossSp1:null,estimatedLossSp2:null,estimatedProfitTp1:null,estimatedProfitTp2:null};
  rec.notional=actualTradeNotional(rec);rec.estimatedLossSp1=sp1?actualTradePnlAt(rec,sp1):null;rec.estimatedLossSp2=sp2?actualTradePnlAt(rec,sp2):null;rec.estimatedProfitTp1=tp1?actualTradePnlAt(rec,tp1):null;rec.estimatedProfitTp2=tp2?actualTradePnlAt(rec,tp2):null;
  actualTrades.unshift(rec);actualTradeActiveSymbols.add(symbol);scheduleActualTradeSave();const px=realtimeBestPrice(symbol)||markPrices.get(symbol);if(px)actualTradeOnPrice(symbol,px,Date.now(),'entry-check');return {rec};
}
function actualTradeUpdateRecord(rec,body={}){
  if(!rec||rec.status!=='ACTIVE')return {error:'這筆實際建倉已結案，不能修改'};
  if(rec.firstOutcome)return {error:'這筆已先碰到 TP / SP；為保留績效稽核，點位不能再修改'};
  const entry=finiteMetric(body.entryPrice),tp1=finiteMetric(body.tp1),tp2=finiteMetric(body.tp2),sp1=finiteMetric(body.sp1),sp2=finiteMetric(body.sp2),margin=finiteMetric(body.margin),quantity=finiteMetric(body.quantity),leverage=finiteMetric(body.leverage);
  if(!(entry>0))return {error:'entryPrice invalid'};if(!(tp1>0||tp2>0||sp1>0||sp2>0))return {error:'至少填一個 TP / SP'};if(!(quantity>0)&&!(margin>0&&leverage>0))return {error:'請填數量，或保證金＋槓桿'};
  const dir=actualTradeDirSign(rec.direction),badTarget=[tp1,tp2].filter(x=>x!=null).some(x=>dir*(x-entry)<=0),badStop=[sp1,sp2].filter(x=>x!=null).some(x=>dir*(x-entry)>=0);if(badTarget)return {error:'TP 必須在獲利方向'};if(badStop)return {error:'SP 必須在風險方向'};
  rec.revisions=Array.isArray(rec.revisions)?rec.revisions:[];rec.revisions.unshift({at:new Date().toISOString(),entryPrice:rec.entryPrice,tp1:rec.tp1,tp2:rec.tp2,sp1:rec.sp1,sp2:rec.sp2,margin:rec.margin,quantity:rec.quantity,leverage:rec.leverage});rec.revisions=rec.revisions.slice(0,20);rec.revisionCount=Number(rec.revisionCount||0)+1;
  rec.entryPrice=entry;rec.tp1=tp1??null;rec.tp2=tp2??null;rec.sp1=sp1??null;rec.sp2=sp2??null;rec.margin=margin??null;rec.quantity=quantity??null;rec.leverage=leverage??null;rec.notional=actualTradeNotional(rec);rec.estimatedLossSp1=sp1?actualTradePnlAt(rec,sp1):null;rec.estimatedLossSp2=sp2?actualTradePnlAt(rec,sp2):null;rec.estimatedProfitTp1=tp1?actualTradePnlAt(rec,tp1):null;rec.estimatedProfitTp2=tp2?actualTradePnlAt(rec,tp2):null;rec.updatedAt=new Date().toISOString();rec.lastSource='manual-edit';scheduleActualTradeSave();const px=realtimeBestPrice(rec.symbol)||markPrices.get(rec.symbol);if(px)actualTradeOnPrice(rec.symbol,px,Date.now(),'edit-check');return {rec};
}
function actualTradeResolveIfTerminal(rec,px,ts,source){
  if(rec.status!=='ACTIVE')return;
  if(!rec.firstOutcome){if(rec.sp1Hit||(!rec.sp1&&rec.sp2Hit)){rec.firstOutcome='LOSS';rec.firstOutcomeAt=new Date(ts).toISOString()}else if(rec.tp1Hit||(!rec.tp1&&rec.tp2Hit)){rec.firstOutcome='WIN';rec.firstOutcomeAt=new Date(ts).toISOString()}}
  const terminalLoss=rec.sp1Hit||(!rec.sp1&&rec.sp2Hit),terminalWin=rec.tp2?rec.tp2Hit:(rec.tp1?rec.tp1Hit:false);
  if(terminalLoss||terminalWin){rec.status='RESOLVED';rec.result=terminalLoss?'LOSS':'WIN';rec.resultAt=new Date(ts).toISOString();const exit=terminalLoss?(rec.sp1Hit?rec.sp1:rec.sp2):(rec.tp2Hit?rec.tp2:rec.tp1);rec.exitPrice=exit;rec.estimatedPnl=actualTradePnlAt(rec,exit);rec.resultSource=source;if(!actualTrades.some(x=>x!==rec&&x.status==='ACTIVE'&&x.symbol===rec.symbol))actualTradeActiveSymbols.delete(rec.symbol)}
}
function actualTradeOnPrice(symbol,price,ts=Date.now(),source='price'){
  const key=cleanFuturesSymbol(symbol),px=Number(price);if(!(px>0)||!actualTradeActiveSymbols.has(key))return;let dirty=false;
  for(const rec of actualTrades){if(rec?.version!=='V10.2.6'||rec.status!=='ACTIVE'||rec.symbol!==key)continue;const pct=actualTradeReturnPct(rec,px);rec.lastPrice=px;rec.lastPriceAt=new Date(ts).toISOString();rec.lastSource=source;if(Number.isFinite(pct)){rec.mfePct=Number(Math.max(Number(rec.mfePct||0),pct).toFixed(4));rec.maePct=Number(Math.max(Number(rec.maePct||0),-pct).toFixed(4))}
    if(!rec.tp1Hit&&actualPriceIsTarget(rec,px,rec.tp1)){rec.tp1Hit=true;rec.tp1HitAt=new Date(ts).toISOString()}
    if(!rec.tp2Hit&&actualPriceIsTarget(rec,px,rec.tp2)){rec.tp2Hit=true;rec.tp2HitAt=new Date(ts).toISOString()}
    if(!rec.sp1Hit&&actualPriceIsStop(rec,px,rec.sp1)){rec.sp1Hit=true;rec.sp1HitAt=new Date(ts).toISOString()}
    if(!rec.sp2Hit&&actualPriceIsStop(rec,px,rec.sp2)){rec.sp2Hit=true;rec.sp2HitAt=new Date(ts).toISOString()}
    actualTradeResolveIfTerminal(rec,px,ts,source);rec.updatedAt=new Date(ts).toISOString();dirty=true;
  }
  if(dirty)scheduleActualTradeSave();
}
function actualTradeAggregate(){
  const all=actualTrades.filter(x=>x?.version==='V10.2.6'),resolved=all.filter(x=>x.status==='RESOLVED'),decisive=all.filter(x=>['WIN','LOSS'].includes(x.firstOutcome)),wins=decisive.filter(x=>x.firstOutcome==='WIN').length,losses=decisive.filter(x=>x.firstOutcome==='LOSS').length,pnl=resolved.map(x=>Number(x.estimatedPnl)).filter(Number.isFinite),linked=[];
  for(const x of decisive){const p=signalPerformance.find(r=>r?.version==='V10.0'&&((x.notificationId&&r.id===x.notificationId)||(x.signalKey&&r.signalKey===x.signalKey)));if(!p)continue;const dev=x.entryPrice>0&&p.entryPrice>0?Math.abs(x.entryPrice-p.entryPrice)/p.entryPrice*100:null;linked.push({agree:['WIN','LOSS'].includes(p.result)?p.result===x.firstOutcome:null,entryDeviationPct:dev})}
  const comparable=linked.filter(x=>x.agree!==null),devs=linked.map(x=>x.entryDeviationPct).filter(Number.isFinite),manual=manualActualBreakdown();
  return {sample:all.length,active:all.filter(x=>x.status==='ACTIVE').length,resolved:resolved.length,decisive:decisive.length,wins,losses,tp1FirstRate:decisive.length?Number((wins/decisive.length*100).toFixed(1)):null,sp1FirstRate:decisive.length?Number((losses/decisive.length*100).toFixed(1)):null,estimatedPnl:pnl.length?Number(pnl.reduce((a,b)=>a+b,0).toFixed(2)):0,linkedSample:linked.length,comparableSample:comparable.length,modelActualAgreementRate:comparable.length?Number((comparable.filter(x=>x.agree).length/comparable.length*100).toFixed(1)):null,avgEntryDeviationPct:devs.length?Number((devs.reduce((a,b)=>a+b,0)/devs.length).toFixed(3)):null,manual};
}

const shadowActiveSymbols=new Set(shadowPerformance.filter(x=>x?.version==='V10.2.2'&&x.status==='ACTIVE').map(x=>cleanFuturesSymbol(x.symbol)));
function scheduleShadowPerformanceSave(){
  if(shadowPerformanceSaveTimer)return;
  shadowPerformanceSaveTimer=setTimeout(()=>{shadowPerformanceSaveTimer=null;const before=shadowPerformance.length;shadowPerformance=shadowPerformance.slice(0,SHADOW_MAX_RECORDS);if(shadowPerformance.length!==before)shadowLearningRevision++;saveJson(SHADOW_PERFORMANCE_FILE,shadowPerformance)},1500);
  shadowPerformanceSaveTimer.unref?.();
}
function stateLearningFeatures(t){
  const dir=testSignalDirection(t?.direction),lc=t?.lastCheck||{},strategy=t?.strategyAtConfirm||t?.strategyProfile||{},oi=finiteMetric(lc.oi15mChangePct)??finiteMetric(lc.oiChangePct),taker=finiteMetric(lc.takerRatio),depth=finiteMetric(lc.depthImbalance),top=finiteMetric(lc.topPositionRatio),marketAlign=Number(lc.marketAlign||0),regime=String(t?.marketRegime||lc.marketRegime||'NORMAL'),assetClass=assetClassForSymbolV2612(t?.symbol),assetSession=assetSessionV2612(t?.symbol),assetFamily=assetProfileV2612(t?.symbol)?.subtype||'CRYPTO';
  const bucket=(v,kind)=>{if(v==null)return 'NA';if(kind==='oi')return v>=.35?'RISING':v<=-.35?'FALLING':'FLAT';if(kind==='taker')return dir>0?(v>=1.02?'ALIGNED':v<=.96?'OPPOSED':'NEUTRAL'):(v<=.98?'ALIGNED':v>=1.04?'OPPOSED':'NEUTRAL');if(kind==='depth')return dir>0?(v>=.06?'ALIGNED':v<=-.10?'OPPOSED':'NEUTRAL'):(v<=-.06?'ALIGNED':v>=.10?'OPPOSED':'NEUTRAL');if(kind==='top')return dir>0?(v>=1.02?'ALIGNED':v<=.96?'OPPOSED':'NEUTRAL'):(v<=.98?'ALIGNED':v>=1.04?'OPPOSED':'NEUTRAL');return 'NA'};
  return {assetClass,assetSession,assetFamily,strategyId:String(strategy.id||'UNKNOWN'),strategyLabel:String(strategy.label||'未分類'),regime,direction:t?.direction||'LONG',oi:bucket(oi,'oi'),taker:bucket(taker,'taker'),depth:bucket(depth,'depth'),top:bucket(top,'top'),market:marketAlign>0?'ALIGNED':marketAlign<0?'OPPOSED':'NEUTRAL'};
}
function stateLearningKeys(features){const f=features||{},a=f.assetClass||'CRYPTO',s=f.assetSession||'UNKNOWN';return {detail:[a,s,f.strategyId,f.regime,f.direction,f.oi,f.taker,f.depth,f.top,f.market].join('|'),core:[a,s,f.strategyId,f.regime,f.direction].join('|'),broad:[a,f.strategyId,f.regime,f.direction].join('|'),global:[f.strategyId,f.regime,f.direction].join('|')}}
function shadowStats(rows){
  const resolved=(rows||[]).filter(x=>x?.status==='RESOLVED'),wins=resolved.filter(x=>x.result==='WIN').length,losses=resolved.filter(x=>x.result==='LOSS').length,timeouts=resolved.filter(x=>x.result==='TIMEOUT').length,rr=resolved.map(x=>Number(x.realizedR)).filter(Number.isFinite),profits=rr.filter(x=>x>0).reduce((a,b)=>a+b,0),lossSum=Math.abs(rr.filter(x=>x<0).reduce((a,b)=>a+b,0));
  const hitRate=resolved.length?wins/resolved.length*100:null,expectancyR=rr.length?rr.reduce((a,b)=>a+b,0)/rr.length:null,profitFactor=lossSum>0?profits/lossSum:(profits>0?99:null);
  return {sample:resolved.length,wins,losses,timeouts,hitRate:hitRate==null?null:Number(hitRate.toFixed(1)),expectancyR:expectancyR==null?null:Number(expectancyR.toFixed(3)),profitFactor:profitFactor==null?null:Number(profitFactor.toFixed(2))};
}
function shadowLearningKeysV2612(rec){const f={...(rec?.stateFeatures||{}),assetClass:rec?.assetClass||rec?.stateFeatures?.assetClass||assetClassForSymbolV2612(rec?.symbol),assetSession:rec?.assetSession||rec?.stateFeatures?.assetSession||assetSessionV2612(rec?.symbol,new Date(rec?.shadowAt||Date.now()).getTime()),assetFamily:rec?.assetFamily||rec?.stateFeatures?.assetFamily||assetProfileV2612(rec?.symbol)?.subtype||'CRYPTO',strategyId:rec?.strategyId||rec?.stateFeatures?.strategyId||'UNKNOWN',regime:rec?.marketRegime||rec?.stateFeatures?.regime||'NORMAL',direction:rec?.direction||rec?.stateFeatures?.direction||'LONG',oi:rec?.stateFeatures?.oi||'NA',taker:rec?.stateFeatures?.taker||'NA',depth:rec?.stateFeatures?.depth||'NA',top:rec?.stateFeatures?.top||'NA',market:rec?.stateFeatures?.market||'NEUTRAL'};return stateLearningKeys(f)}
function shadowLearningEffectiveRows(){
  const rows=shadowPerformance.filter(x=>x?.version==='V10.2.2'&&x.status==='RESOLVED'&&x.learningEligible!==false).sort((a,b)=>new Date(b.shadowAt||0)-new Date(a.shadowAt||0)),seen=new Map(),out=[];
  for(const rec of rows){const core=shadowLearningKeysV2612(rec).core,k=`${core}|${cleanFuturesSymbol(rec.symbol)}`,ts=new Date(rec.shadowAt||0).getTime(),prev=seen.get(k);if(Number.isFinite(prev)&&Math.abs(prev-ts)<STATE_LEARNING_DEDUP_MS)continue;seen.set(k,ts);out.push(rec)}return out;
}
function stateLearningAdjustmentFromStats(stats){
  const sample=Number(stats?.sample||0);if(sample<STATE_LEARNING_MIN_SAMPLE)return 0;const cap=Math.min(STATE_LEARNING_MAX_BONUS,sample>=100?6:sample>=50?4:2),hit=Number(stats?.hitRate??50),exp=Number(stats?.expectancyR??0),pf=Number(stats?.profitFactor??1);
  let raw=((hit-55)*.14)+(exp*3.2)+(clamp(pf-1,-1.2,1.6)*1.35);if(hit<48&&exp<=0)raw-=1.2;if(hit>=65&&exp>.15)raw+=.8;const confidence=Math.min(1,Math.sqrt(sample/100));return clamp(Math.round(raw*confidence),-cap,cap);
}
function stateLearningIndex(){
  if(shadowLearningIndexCache.revision===shadowLearningRevision&&shadowLearningIndexCache.maps)return shadowLearningIndexCache.maps;
  const resolved=shadowPerformance.filter(x=>x?.version==='V10.2.2'&&x.status==='RESOLVED'&&x.learningEligible!==false).sort((a,b)=>new Date(b.shadowAt||0)-new Date(a.shadowAt||0)),maps={detail:new Map(),core:new Map(),broad:new Map(),global:new Map()},seen={detail:new Map(),core:new Map(),broad:new Map(),global:new Map()};
  for(const rec of resolved){const ts=new Date(rec.shadowAt||0).getTime(),symbol=cleanFuturesSymbol(rec.symbol),keys=shadowLearningKeysV2612(rec);for(const level of ['detail','core','broad','global']){const key=keys[level];if(!key)continue;const correlationKey=`${key}|${symbol}`,prev=seen[level].get(correlationKey);if(Number.isFinite(prev)&&Math.abs(prev-ts)<STATE_LEARNING_DEDUP_MS)continue;seen[level].set(correlationKey,ts);if(!maps[level].has(key))maps[level].set(key,[]);maps[level].get(key).push(rec)}}shadowLearningIndexCache={revision:shadowLearningRevision,maps};return maps;
}
function actualStateEvidence(features){const assetClass=String(features?.assetClass||'CRYPTO'),rows=actualTrades.filter(x=>x?.version==='V10.2.6'&&['WIN','LOSS'].includes(x.firstOutcome)&&assetClassForSymbolV2612(x.symbol)===assetClass&&String(x.strategyId||'')===String(features.strategyId||'')&&String(x.marketRegime||'')===String(features.regime||'')&&String(x.direction||'')===String(features.direction||''));const sample=rows.length,wins=rows.filter(x=>x.firstOutcome==='WIN').length,hitRate=sample?wins/sample*100:null;let adjustment=0;if(sample>=12){if(hitRate>=65)adjustment=1;else if(hitRate<=40)adjustment=-1}return {sample,hitRate:hitRate==null?null:Number(hitRate.toFixed(1)),adjustment,assetClass}}
/* INSTITUTIONAL_SHADOW_EDGE_V2621
 * Institutional mentor layer.
 * Separates alpha (directional edge) from readiness/execution and risk.
 * Uses net-of-cost Shadow outcomes with de-correlation and conservative sample gates.
 */
const SHADOW_EDGE_VERSION_V2621='V2.6.21';
const SHADOW_EDGE_MIN_SAMPLE_V2621=Math.max(16,Math.min(60,Number(process.env.SHADOW_EDGE_MIN_SAMPLE||20)));
const SHADOW_EDGE_STRATEGY_SAMPLE_V2621=Math.max(24,Math.min(100,Number(process.env.SHADOW_EDGE_STRATEGY_SAMPLE||30)));
const SHADOW_EDGE_A_MIN_V2621=Math.max(56,Math.min(78,Number(process.env.SHADOW_EDGE_A_MIN||60)));
const SHADOW_EDGE_B_MIN_V2621=Math.max(44,Math.min(SHADOW_EDGE_A_MIN_V2621-2,Number(process.env.SHADOW_EDGE_B_MIN||48)));
const SHADOW_EDGE_A_COST_RATIO_V2621=Math.max(.20,Math.min(.50,Number(process.env.SHADOW_EDGE_A_COST_RATIO||.35)));
const SHADOW_EDGE_B_COST_RATIO_V2621=Math.max(SHADOW_EDGE_A_COST_RATIO_V2621,Math.min(.80,Number(process.env.SHADOW_EDGE_B_COST_RATIO||.60)));

function edgeNumV2621(v){const n=Number(v);return Number.isFinite(n)?n:null}
function edgeAssetV2621(x){try{return String(x?.assetClass||assetClassForSymbolV2612(x?.symbol)||'CRYPTO').toUpperCase()}catch{return String(x?.assetClass||'CRYPTO').toUpperCase()}}
function edgeRiskPctV2621(x){const e=edgeNumV2621(x?.entryPrice),st=edgeNumV2621(x?.stop);return e>0&&st>0?Math.abs(st-e)/e*100:null}
function edgeNetRV2621(x){
  const nr=edgeNumV2621(x?.netR);if(nr!=null)return nr;
  const riskPct=edgeRiskPctV2621(x),netPct=edgeNumV2621(x?.netReturnPct);if(riskPct>0&&netPct!=null)return netPct/riskPct;
  const r=edgeNumV2621(x?.realizedR);if(r==null)return null;
  const bps=edgeNumV2621(x?.costBps)??PERF_ROUND_TRIP_COST_BPS;if(!(riskPct>0))return r;
  return r-((bps/100)/riskPct);
}
function edgeWilsonLowV2621(wins,n){if(!(n>0))return null;const z=1.281551565545,ph=wins/n,z2=z*z,den=1+z2/n,mid=ph+z2/(2*n),rad=z*Math.sqrt((ph*(1-ph)+z2/(4*n))/n);return Math.max(0,(mid-rad)/den)*100}
function edgeStatsV2621(rows){
  const a=(rows||[]).filter(x=>x?.status==='RESOLVED'&&x?.learningEligible!==false&&['WIN','LOSS','TIMEOUT'].includes(String(x?.result||''))),dec=a.filter(x=>['WIN','LOSS'].includes(x.result)),wins=dec.filter(x=>x.result==='WIN').length,losses=dec.length-wins,nr=a.map(edgeNetRV2621).filter(Number.isFinite),profit=nr.filter(v=>v>0).reduce((p,v)=>p+v,0),loss=Math.abs(nr.filter(v=>v<0).reduce((p,v)=>p+v,0)),hit=dec.length?wins/dec.length*100:null,pf=loss>0?profit/loss:(profit>0?99:null),exp=nr.length?nr.reduce((p,v)=>p+v,0)/nr.length:null;
  return {sample:a.length,decisive:dec.length,wins,losses,timeouts:a.length-dec.length,hitRate:hit==null?null:Number(hit.toFixed(1)),wilsonLow:hit==null?null:Number(edgeWilsonLowV2621(wins,dec.length).toFixed(1)),netProfitFactor:pf==null?null:Number(pf.toFixed(2)),netExpectancyR:exp==null?null:Number(exp.toFixed(3))};
}
function edgeDedupV2621(rows,keyFn){const sorted=[...(rows||[])].sort((a,b)=>new Date(b.shadowAt||0)-new Date(a.shadowAt||0)),seen=new Map(),out=[];for(const r of sorted){const k=String(keyFn?.(r)||cleanFuturesSymbol(r?.symbol)||'NA'),ts=new Date(r?.shadowAt||0).getTime(),prev=seen.get(k);if(Number.isFinite(prev)&&Number.isFinite(ts)&&Math.abs(prev-ts)<STATE_LEARNING_DEDUP_MS)continue;seen.set(k,ts);out.push(r)}return out}
function edgeAdjFromStatsV2621(st,cap=8){const n=Number(st?.sample||0);if(n<SHADOW_EDGE_MIN_SAMPLE_V2621)return 0;let raw=0,low=Number(st?.wilsonLow??50),pf=Number(st?.netProfitFactor??1),exp=Number(st?.netExpectancyR??0);if(low>=56)raw+=3;else if(low>=51)raw+=1;else if(low<42)raw-=3;if(pf>=1.25)raw+=3;else if(pf>=1.05)raw+=1;else if(pf<.55)raw-=6;else if(pf<.80)raw-=4;if(exp>=.10)raw+=3;else if(exp>=.02)raw+=1;else if(exp<=-.25)raw-=5;else if(exp<=-.10)raw-=3;const conf=Math.min(1,Math.sqrt(n/100));return clamp(Math.round(raw*conf),-cap,cap)}
function edgeCostV2621(t){const entry=edgeNumV2621(t?.reentryEntryPrice)??edgeNumV2621(t?.confirmationPrice)??edgeNumV2621(t?.currentPrice)??edgeNumV2621(realtimeBestPrice(t?.symbol)),stop=edgeNumV2621(t?.reentryStop)??edgeNumV2621(t?.structureProtection)??edgeNumV2621(t?.stop)??edgeNumV2621(t?.setup?.invalidation);if(!(entry>0&&stop>0))return {riskPct:null,costPct:PERF_ROUND_TRIP_COST_BPS/100,ratio:null,adjustment:-2,aGate:false,bGate:false};const riskPct=Math.abs(entry-stop)/entry*100,costPct=PERF_ROUND_TRIP_COST_BPS/100,ratio=riskPct>0?costPct/riskPct:99;let adjustment=0;if(ratio<=.12)adjustment=4;else if(ratio<=.20)adjustment=2;else if(ratio<=.35)adjustment=0;else if(ratio<=.50)adjustment=-4;else if(ratio<=.65)adjustment=-8;else adjustment=-16;return {riskPct:Number(riskPct.toFixed(4)),costPct:Number(costPct.toFixed(4)),ratio:Number(ratio.toFixed(3)),adjustment,aGate:ratio<=SHADOW_EDGE_A_COST_RATIO_V2621,bGate:ratio<=SHADOW_EDGE_B_COST_RATIO_V2621}}
function edgeRowsV2621(){return shadowPerformance.filter(x=>x?.version==='V10.2.2'&&x.status==='RESOLVED'&&x.learningEligible!==false&&['WIN','LOSS','TIMEOUT'].includes(String(x.result||'')))}
function edgeStrategyMatchV2621(x,features){const a=String(x?.strategyId||''),b=String(features?.strategyId||''),la=String(x?.strategyLabel||''),lb=String(features?.strategyLabel||'');if(a&&b&&a!=='UNKNOWN'&&b!=='UNKNOWN')return a===b;return la&&lb?la===lb:a===b}
function institutionalEdgeV2621(t){
  const features=stateLearningFeatures(t),asset=String(features.assetClass||edgeAssetV2621(t)),all=edgeRowsV2621(),sameAsset=all.filter(x=>edgeAssetV2621(x)===asset),strategyId=String(features.strategyId||''),direction=String(features.direction||t?.direction||'LONG'),regime=String(features.regime||'UNKNOWN');
  const exact=edgeDedupV2621(sameAsset.filter(x=>edgeStrategyMatchV2621(x,features)&&String(x.direction||'')===direction&&String(x.marketRegime||'')===regime),x=>cleanFuturesSymbol(x.symbol));
  const strategyDir=edgeDedupV2621(sameAsset.filter(x=>edgeStrategyMatchV2621(x,features)&&String(x.direction||'')===direction),x=>cleanFuturesSymbol(x.symbol));
  const strategyAll=edgeDedupV2621(sameAsset.filter(x=>edgeStrategyMatchV2621(x,features)),x=>`${cleanFuturesSymbol(x.symbol)}|${x.direction}`);
  const directionRows=edgeDedupV2621(sameAsset.filter(x=>String(x.direction||'')===direction),x=>`${cleanFuturesSymbol(x.symbol)}|${x.strategyId}`);
  let chosen=exact,level='同資產·策略×狀態×方向';if(chosen.length<SHADOW_EDGE_MIN_SAMPLE_V2621){chosen=strategyDir;level='同資產·策略×方向'}if(chosen.length<SHADOW_EDGE_STRATEGY_SAMPLE_V2621){chosen=strategyAll;level='同資產·策略'}if(chosen.length<SHADOW_EDGE_STRATEGY_SAMPLE_V2621){chosen=directionRows;level='同資產·方向'}
  const stats=edgeStatsV2621(chosen),strategyStats=edgeStatsV2621(strategyAll),stateAdj=edgeAdjFromStatsV2621(stats,6),strategyAdj=edgeAdjFromStatsV2621(strategyStats,8),cost=edgeCostV2621(t),ev=t?.monitorEvidence||t?.lastCheck||{};
  let score=55+stateAdj*2+strategyAdj*1.4+cost.adjustment;
  if(regime==='UNKNOWN')score-=5;
  if(ev.adverseMarket)score-=18;if(ev.adverse1h)score-=7;if(ev.adverse30)score-=4;if(String(ev.adlRisk||'').toLowerCase()==='high')score-=12;if(ev.fundingCrowded===true)score-=8;
  score=clamp(Math.round(score),0,100);
  const poorStrategy=Number(strategyStats.sample||0)>=SHADOW_EDGE_STRATEGY_SAMPLE_V2621&&(Number(strategyStats.netProfitFactor??1)<.80||Number(strategyStats.netExpectancyR??0)<-.10);
  const severeStrategy=Number(strategyStats.sample||0)>=SHADOW_EDGE_STRATEGY_SAMPLE_V2621&&(Number(strategyStats.netProfitFactor??1)<.55||Number(strategyStats.netExpectancyR??0)<-.25);
  const label=String(features.strategyLabel||'');const breakoutPoor=label.includes('突破回測')&&poorStrategy,momentumPoor=label.includes('動能')&&poorStrategy;
  const hardBlockReasons=[];if(cost.ratio!=null&&cost.ratio>.65)hardBlockReasons.push('成本/停損比過高');if(ev.adverseMarket)hardBlockReasons.push(asset==='TRADFI'?'美股大盤逆向':'BTC/ETH大盤逆向');if(severeStrategy&&breakoutPoor)hardBlockReasons.push('突破回測淨期望顯著為負');
  const capA=regime==='UNKNOWN'||poorStrategy||breakoutPoor||momentumPoor||!cost.aGate||stateAdj<=-4;
  const learningAdjustment=clamp(Math.round(stateAdj+strategyAdj*.55),-STATE_LEARNING_MAX_BONUS,STATE_LEARNING_MAX_BONUS);
  return {version:SHADOW_EDGE_VERSION_V2621,edgeScore:score,level,sample:Number(stats.sample||0),stats,strategyStats,stateAdjustment:stateAdj,strategyAdjustment:strategyAdj,learningAdjustment,cost,costGateA:cost.aGate,costGateB:cost.bGate,capA,hardBlock:hardBlockReasons.length>0,hardBlockReasons,poorStrategy,severeStrategy,assetClass:asset,regime,strategyId,strategyLabel:features.strategyLabel,direction};
}

/* INSTITUTIONAL_MENTOR_EDGE_V2622
 * Frozen-train + forward-verification mentor layer.
 * Goals:
 * - do not confuse readiness with alpha;
 * - use net-of-cost outcomes only;
 * - penalize instability / symbol concentration / multiple testing;
 * - keep post-deploy samples as a forward verification cohort instead of feeding them back immediately;
 * - prefer abstention when edge cannot clear costs with robust evidence.
 */
const SHADOW_MENTOR_VERSION_V2622='V2.6.22';
const SHADOW_MENTOR_STATE_FILE_V2622=path.join(DATA_DIR,'shadow-mentor-v2622-state.json');
const SHADOW_MENTOR_FORWARD_TARGET_V2622=40;
const SHADOW_MENTOR_STRATEGY_FORWARD_MIN_V2622=20;

function mentorNumV2622(v){const n=Number(v);return Number.isFinite(n)?n:null}
function mentorClampV2622(v,a=0,b=100){return Math.max(a,Math.min(b,Number(v)||0))}
function mentorPersistentStateV2622(){
  let d=null;try{d=JSON.parse(fs.readFileSync(SHADOW_MENTOR_STATE_FILE_V2622,'utf8'))}catch{}
  if(!d||!Number.isFinite(Date.parse(d.startAt||''))){d={version:SHADOW_MENTOR_VERSION_V2622,startAt:new Date().toISOString(),createdAt:new Date().toISOString()};if(process.env.UNIT_TEST!=='1'){try{fs.writeFileSync(SHADOW_MENTOR_STATE_FILE_V2622,JSON.stringify(d,null,2))}catch(e){console.warn('[v2622-mentor] forward state save failed:',String(e?.message||e))}}}
  return d
}
const SHADOW_MENTOR_STATE_V2622=mentorPersistentStateV2622();
const SHADOW_MENTOR_FORWARD_START_MS_V2622=Date.parse(SHADOW_MENTOR_STATE_V2622.startAt)||Date.now();

function mentorAssetV2622(x){
  const raw=String(x?.assetClass||'').toUpperCase(),symbol=x?.symbol||'';let classified='';
  try{classified=String(assetClassForSymbolV2612(symbol)||'').toUpperCase()}catch{}
  if(classified==='TRADFI'||['TRADFI','EQUITY_TOKEN','EQUITY','STOCK','ETF'].includes(raw))return'TRADFI';
  if(raw==='COMMODITY')return'COMMODITY';
  return classified||raw||'CRYPTO'
}
function mentorAssetForTrackerV2622(t){return mentorAssetV2622({symbol:t?.symbol,assetClass:t?.assetClass})}
function mentorResolvedRowsV2622(){return edgeRowsV2621()}
function mentorTrainRowsV2622(){return mentorResolvedRowsV2622().filter(x=>{const ms=Date.parse(x?.shadowAt||'');return Number.isFinite(ms)&&ms<SHADOW_MENTOR_FORWARD_START_MS_V2622})}
function mentorForwardRowsV2622(){return mentorResolvedRowsV2622().filter(x=>{const ms=Date.parse(x?.shadowAt||'');return Number.isFinite(ms)&&ms>=SHADOW_MENTOR_FORWARD_START_MS_V2622})}
function mentorDedupeV2622(rows,keyFn){return edgeDedupV2621(rows,keyFn)}
function mentorStatsV2622(rows){return edgeStatsV2621(rows)}
function mentorPositiveNetRV2622(x){const n=edgeNetRV2621(x);return Number.isFinite(n)?Math.max(0,n):0}

function mentorChronoStabilityV2622(rows){
  const a=[...(rows||[])].filter(x=>Number.isFinite(Date.parse(x?.shadowAt||''))).sort((x,y)=>Date.parse(x.shadowAt)-Date.parse(y.shadowAt)),n=a.length;
  if(n<18)return{sample:n,available:false,positiveFolds:0,totalFolds:0,score:50,adjustment:0,gateA:true,folds:[]};
  const folds=[];for(let i=0;i<3;i++){const lo=Math.floor(n*i/3),hi=Math.floor(n*(i+1)/3),r=a.slice(lo,hi),st=mentorStatsV2622(r),positive=Number(st.netProfitFactor??0)>=1&&Number(st.netExpectancyR??-9)>=0,severe=Number(st.netProfitFactor??1)<.55||Number(st.netExpectancyR??0)<-.25;folds.push({sample:st.sample,hitRate:st.hitRate,netProfitFactor:st.netProfitFactor,netExpectancyR:st.netExpectancyR,positive,severe})}
  const positiveFolds=folds.filter(x=>x.positive).length,severeFolds=folds.filter(x=>x.severe).length;let adjustment=positiveFolds===3?4:positiveFolds===2?1:positiveFolds===1?-4:-7;if(severeFolds>=2)adjustment-=3;const score=mentorClampV2622(28+positiveFolds*22-severeFolds*12);return{sample:n,available:true,positiveFolds,totalFolds:3,severeFolds,score,adjustment,gateA:n<30||positiveFolds>=2,folds}
}
function mentorConcentrationV2622(rows){
  const a=[...(rows||[])],n=a.length;if(!n)return{sample:0,topSymbols:[],top1Share:0,top2Share:0,profitTop2Share:0,leaveTop2:{sample:0},score:50,adjustment:0,gateA:true};
  const m=new Map();for(const r of a){const s=cleanFuturesSymbol(r?.symbol)||'NA',q=m.get(s)||{symbol:s,sample:0,positiveR:0};q.sample++;q.positiveR+=mentorPositiveNetRV2622(r);m.set(s,q)}const top=[...m.values()].sort((x,y)=>y.sample-x.sample||y.positiveR-x.positiveR),top2=top.slice(0,2),ban=new Set(top2.map(x=>x.symbol)),leave=a.filter(x=>!ban.has(cleanFuturesSymbol(x?.symbol))),leaveStats=mentorStatsV2622(leave),positiveAll=a.reduce((p,r)=>p+mentorPositiveNetRV2622(r),0),positiveTop=top2.reduce((p,r)=>p+r.positiveR,0),top1Share=(top[0]?.sample||0)/n,top2Share=top2.reduce((p,r)=>p+r.sample,0)/n,profitTop2Share=positiveAll>0?positiveTop/positiveAll:0;
  let adjustment=0;if(n>=40&&top2Share>.55&&Number(leaveStats.netProfitFactor??1)<.80)adjustment=-8;else if(n>=40&&top2Share>.45&&Number(leaveStats.netProfitFactor??1)<.90)adjustment=-5;else if(top2Share<.32)adjustment=2;const gateA=n<40||top2Share<=.45||(Number(leaveStats.sample||0)>=20&&Number(leaveStats.netProfitFactor??0)>=.85&&Number(leaveStats.netExpectancyR??-9)>=-.05),score=mentorClampV2622(100-top2Share*70-Math.max(0,profitTop2Share-.55)*55+(Number(leaveStats.netProfitFactor??0)>=1?8:0));return{sample:n,topSymbols:top2.map(x=>({symbol:x.symbol,sample:x.sample,share:Number((x.sample/n).toFixed(3))})),top1Share:Number(top1Share.toFixed(3)),top2Share:Number(top2Share.toFixed(3)),profitTop2Share:Number(profitTop2Share.toFixed(3)),leaveTop2:leaveStats,score,adjustment,gateA}
}
function mentorTrialPenaltyV2622(rows){const n=new Set((rows||[]).map(x=>String(x?.strategyId||x?.strategyLabel||'UNKNOWN'))).size;return{trials:n,penalty:n<=3?0:n<=5?1:n<=8?2:3}}
function mentorForwardEvidenceV2622(features){
  const asset=String(features?.assetClass||'CRYPTO'),strategyId=String(features?.strategyId||''),direction=String(features?.direction||''),rows=mentorDedupeV2622(mentorForwardRowsV2622().filter(x=>mentorAssetV2622(x)===asset&&edgeStrategyMatchV2621(x,features)&&String(x?.direction||'')===direction),x=>cleanFuturesSymbol(x?.symbol)),st=mentorStatsV2622(rows),n=Number(st.sample||0);let status='COLLECTING',adjustment=0,capA=false,hardFail=false;if(n>=SHADOW_MENTOR_STRATEGY_FORWARD_MIN_V2622){if(Number(st.netProfitFactor??1)<.75||Number(st.netExpectancyR??0)<-.10){status='WEAK';adjustment=-4;capA=true}else status='CHECKING'}if(n>=SHADOW_MENTOR_FORWARD_TARGET_V2622){if(Number(st.netProfitFactor??0)>=1.05&&Number(st.netExpectancyR??-9)>0){status='PASS';adjustment=2;capA=false}else{status='FAIL';adjustment=-7;capA=true;hardFail=Number(st.netProfitFactor??1)<.55||Number(st.netExpectancyR??0)<-.25}}return{startAt:SHADOW_MENTOR_STATE_V2622.startAt,target:SHADOW_MENTOR_FORWARD_TARGET_V2622,sample:n,status,adjustment,capA,hardFail,stats:st}
}
function mentorConfidenceV2622({stats,stability,concentration,forward,cost}){const sample=mentorClampV2622(Number(stats?.sample||0)/80*100),quality=mentorClampV2622(45+(Number(stats?.netProfitFactor??1)-1)*42+Number(stats?.netExpectancyR??0)*65+(Number(stats?.wilsonLow??48)-48)*1.2),stable=mentorClampV2622(stability?.score??50),div=mentorClampV2622(concentration?.score??50),fwd=forward?.status==='PASS'?90:forward?.status==='FAIL'?15:forward?.status==='WEAK'?30:mentorClampV2622(35+Number(forward?.sample||0)/SHADOW_MENTOR_FORWARD_TARGET_V2622*40),costScore=cost?.ratio==null?35:mentorClampV2622(100-Number(cost.ratio)*125);return Math.round(sample*.18+quality*.27+stable*.20+div*.15+fwd*.12+costScore*.08)}

function institutionalMentorEdgeV2622(t){
  const features=stateLearningFeatures(t),asset=mentorAssetForTrackerV2622(t),direction=String(features.direction||t?.direction||'LONG'),regime=String(features.regime||'UNKNOWN'),train=mentorTrainRowsV2622(),sameAsset=train.filter(x=>mentorAssetV2622(x)===asset),exact=mentorDedupeV2622(sameAsset.filter(x=>edgeStrategyMatchV2621(x,features)&&String(x.direction||'')===direction&&String(x.marketRegime||'')===regime),x=>cleanFuturesSymbol(x.symbol)),strategyDir=mentorDedupeV2622(sameAsset.filter(x=>edgeStrategyMatchV2621(x,features)&&String(x.direction||'')===direction),x=>cleanFuturesSymbol(x.symbol)),strategyAll=mentorDedupeV2622(sameAsset.filter(x=>edgeStrategyMatchV2621(x,features)),x=>`${cleanFuturesSymbol(x.symbol)}|${x.direction}`),directionRows=mentorDedupeV2622(sameAsset.filter(x=>String(x.direction||'')===direction),x=>`${cleanFuturesSymbol(x.symbol)}|${x.strategyId}`);
  let chosen=exact,level='同資產·策略×狀態×方向';if(chosen.length<SHADOW_EDGE_MIN_SAMPLE_V2621){chosen=strategyDir;level='同資產·策略×方向'}if(chosen.length<SHADOW_EDGE_STRATEGY_SAMPLE_V2621){chosen=strategyAll;level='同資產·策略'}if(chosen.length<SHADOW_EDGE_STRATEGY_SAMPLE_V2621){chosen=directionRows;level='同資產·方向'}
  const stats=mentorStatsV2622(chosen),strategyStats=mentorStatsV2622(strategyAll),stateAdj=edgeAdjFromStatsV2621(stats,6),strategyAdj=edgeAdjFromStatsV2621(strategyStats,8),cost=edgeCostV2621(t),stability=mentorChronoStabilityV2622(chosen),concentration=mentorConcentrationV2622(strategyAll),forward=mentorForwardEvidenceV2622({...features,assetClass:asset}),trials=mentorTrialPenaltyV2622(sameAsset),ev=t?.monitorEvidence||t?.lastCheck||{};
  let score=52+stateAdj*2+strategyAdj*1.35+cost.adjustment+stability.adjustment+concentration.adjustment+forward.adjustment-trials.penalty;if(regime==='UNKNOWN')score-=5;if(ev.adverseMarket)score-=18;if(ev.adverse1h)score-=7;if(ev.adverse30)score-=4;if(String(ev.adlRisk||'').toLowerCase()==='high')score-=12;if(ev.fundingCrowded===true)score-=8;score=mentorClampV2622(Math.round(score));
  const poorStrategy=Number(strategyStats.sample||0)>=SHADOW_EDGE_STRATEGY_SAMPLE_V2621&&(Number(strategyStats.netProfitFactor??1)<.80||Number(strategyStats.netExpectancyR??0)<-.10),severeStrategy=Number(strategyStats.sample||0)>=SHADOW_EDGE_STRATEGY_SAMPLE_V2621&&(Number(strategyStats.netProfitFactor??1)<.55||Number(strategyStats.netExpectancyR??0)<-.25),label=String(features.strategyLabel||''),breakoutPoor=label.includes('突破回測')&&poorStrategy,momentumPoor=label.includes('動能')&&poorStrategy,hardBlockReasons=[];
  if(cost.ratio!=null&&cost.ratio>.65)hardBlockReasons.push('成本/停損比過高');if(ev.adverseMarket)hardBlockReasons.push(asset==='TRADFI'?'美股大盤逆向':'BTC/ETH大盤逆向');if(severeStrategy&&breakoutPoor)hardBlockReasons.push('突破回測淨期望顯著為負');if(forward.hardFail)hardBlockReasons.push('Forward 驗證顯著失敗');
  const confidenceScore=mentorConfidenceV2622({stats,stability,concentration,forward,cost}),capA=regime==='UNKNOWN'||poorStrategy||breakoutPoor||momentumPoor||!cost.aGate||stateAdj<=-4||!stability.gateA||!concentration.gateA||forward.capA||confidenceScore<48,learningAdjustment=clamp(Math.round(stateAdj+strategyAdj*.50+stability.adjustment*.25+concentration.adjustment*.20+forward.adjustment*.25),-STATE_LEARNING_MAX_BONUS,STATE_LEARNING_MAX_BONUS),watchEligible=hardBlockReasons.length===0&&cost.bGate&&score>=SHADOW_EDGE_B_MIN_V2621&&confidenceScore>=42;
  return{version:SHADOW_MENTOR_VERSION_V2622,edgeScore:score,confidenceScore,level,sample:Number(stats.sample||0),stats,strategyStats,stateAdjustment:stateAdj,strategyAdjustment:strategyAdj,learningAdjustment,cost,costGateA:cost.aGate,costGateB:cost.bGate,stability,concentration,forward,trials,capA,hardBlock:hardBlockReasons.length>0,hardBlockReasons,poorStrategy,severeStrategy,assetClass:asset,regime,strategyId:String(features.strategyId||''),strategyLabel:features.strategyLabel,direction,watchEligible,frozenTrain:true,forwardStartAt:SHADOW_MENTOR_STATE_V2622.startAt}
}

function mentorTrainingSummaryV2622(){
  const train=mentorDedupeV2622(mentorTrainRowsV2622(),x=>`${mentorAssetV2622(x)}|${cleanFuturesSymbol(x.symbol)}|${x.strategyId}|${x.direction}`),forward=mentorDedupeV2622(mentorForwardRowsV2622(),x=>`${mentorAssetV2622(x)}|${cleanFuturesSymbol(x.symbol)}|${x.strategyId}|${x.direction}`),trainStats=mentorStatsV2622(train),forwardStats=mentorStatsV2622(forward),stability=mentorChronoStabilityV2622(train),concentration=mentorConcentrationV2622(train),groups=new Map();for(const r of train){const k=`${mentorAssetV2622(r)}|${String(r.strategyLabel||r.strategyId||'未分類')}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}const strategies=[...groups.entries()].map(([key,rows])=>{const [assetClass,...rest]=key.split('|'),label=rest.join('|'),stats=mentorStatsV2622(mentorDedupeV2622(rows,x=>`${cleanFuturesSymbol(x.symbol)}|${x.direction}`)),stable=mentorChronoStabilityV2622(rows),conc=mentorConcentrationV2622(rows);return{assetClass,label,...stats,stabilityScore:stable.score,positiveFolds:stable.positiveFolds,totalFolds:stable.totalFolds,top2Share:conc.top2Share,robustScore:Math.round(mentorClampV2622(45+(Number(stats.netProfitFactor??1)-1)*35+Number(stats.netExpectancyR??0)*55+(Number(stats.wilsonLow??48)-48)+stable.adjustment*2+conc.adjustment*1.5))}}).sort((a,b)=>b.robustScore-a.robustScore||b.sample-a.sample);
  const sampleScore=mentorClampV2622(Number(trainStats.sample||0)/300*100),netScore=mentorClampV2622(40+(Number(trainStats.netProfitFactor??1)-1)*45+Number(trainStats.netExpectancyR??0)*70),stableScore=stability.score,divScore=concentration.score,forwardScore=Number(forwardStats.sample||0)>=SHADOW_MENTOR_FORWARD_TARGET_V2622?mentorClampV2622(45+(Number(forwardStats.netProfitFactor??1)-1)*45+Number(forwardStats.netExpectancyR??0)*70):mentorClampV2622(Number(forwardStats.sample||0)/SHADOW_MENTOR_FORWARD_TARGET_V2622*60),maturity=Math.round(sampleScore*.22+netScore*.28+stableScore*.20+divScore*.15+forwardScore*.15);let stage='研究中';if(maturity>=78)stage='穩定驗證';else if(maturity>=62)stage='成形';else if(maturity>=46)stage='局部 Edge';else if(maturity>=32)stage='校準中';const warnings=[];if(Number(trainStats.netProfitFactor??0)<1)warnings.push('整體 Net PF 尚未站上 1，只允許局部 Edge 升級');if(stability.available&&stability.positiveFolds<2)warnings.push('跨時間窗穩定度不足');if(concentration.top2Share>.45)warnings.push('績效集中於少數標的，已套用集中度折扣');if(Number(forwardStats.sample||0)<SHADOW_MENTOR_FORWARD_TARGET_V2622)warnings.push(`Forward ${Number(forwardStats.sample||0)}/${SHADOW_MENTOR_FORWARD_TARGET_V2622}，新資料不回灌調參`);return{ok:true,version:SHADOW_MENTOR_VERSION_V2622,generatedAt:new Date().toISOString(),forwardStartAt:SHADOW_MENTOR_STATE_V2622.startAt,maturity:{score:maturity,stage},training:{...trainStats,sampleDepthScore:Math.round(sampleScore)},forward:{...forwardStats,target:SHADOW_MENTOR_FORWARD_TARGET_V2622,progressPct:Math.round(mentorClampV2622(Number(forwardStats.sample||0)/SHADOW_MENTOR_FORWARD_TARGET_V2622*100))},stability,concentration,strategies:strategies.slice(0,12),strongest:strategies[0]||null,warnings,principles:['net-of-cost','frozen-train','forward-oos','chronological-stability','symbol-concentration-haircut','selective-abstention','multiple-testing-haircut']}
}

function stateLearningAdjustment(t){
  const features=stateLearningFeatures(t),actualEvidence=actualStateEvidence(features),institutionalEdge=institutionalMentorEdgeV2622(t),shadowAdjustment=Number(institutionalEdge.learningAdjustment||0),adjustment=clamp(shadowAdjustment+Number(actualEvidence.adjustment||0),-STATE_LEARNING_MAX_BONUS,STATE_LEARNING_MAX_BONUS);
  return {adjustment,shadowAdjustment,actualAdjustment:Number(actualEvidence.adjustment||0),actualEvidence,level:institutionalEdge.level,key:null,features,stats:{sample:institutionalEdge.sample,hitRate:institutionalEdge.stats?.hitRate??null,profitFactor:institutionalEdge.stats?.netProfitFactor??null,expectancyR:institutionalEdge.stats?.netExpectancyR??null},active:institutionalEdge.sample>=SHADOW_EDGE_MIN_SAMPLE_V2621,crossAsset:false,institutionalEdge};
}
function stateLearningTable(limit=24){
  const idx=stateLearningIndex(),rows=[];for(const [key,a] of idx.detail.entries()){const stats=shadowStats(a),rec=a[0];if(stats.sample<5)continue;rows.push({key,label:rec?.stateLabel||key,features:rec?.stateFeatures||null,adjustment:stateLearningAdjustmentFromStats(stats),...stats})}
  return rows.sort((a,b)=>Math.abs(b.adjustment)-Math.abs(a.adjustment)||b.sample-a.sample||Number(b.expectancyR||0)-Number(a.expectancyR||0)).slice(0,limit);
}
function shadowRecordCandidate(t,{entry,stop,target,tier='VALID',rawScore=null,adjustedScore=null,learningEligible=true,shadowProgress=null,blockReasons=[]}={}){
  const e=finiteMetric(entry),s=finiteMetric(stop),tg=finiteMetric(target);if(!(e>0&&s>0&&tg>0))return null;const risk=Math.abs(e-s);if(!(risk>0))return null;const features=stateLearningFeatures(t),keys=stateLearningKeys(features),learning=stateLearningAdjustment(t),mentor=institutionalMentorEdgeV2622(t),now=new Date().toISOString(),id=`shadow-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,label=`${features.strategyLabel}｜${features.regime}｜${features.direction}｜OI ${features.oi}｜Taker ${features.taker}｜Depth ${features.depth}`;
  const rec={id,version:'V10.2.2',signalKey:t.key,symbol:t.symbol,assetClass:features.assetClass,assetSession:features.assetSession,assetFamily:features.assetFamily,direction:t.direction,phase:'FIRST_ENTRY',shadowAt:now,entryPrice:e,stop:s,target:tg,riskDistance:risk,targetR:Number((testSignalDirection(t.direction)*(tg-e)/risk).toFixed(3)),strategyId:features.strategyId,strategyLabel:features.strategyLabel,marketRegime:features.regime,stateFeatures:features,stateKeys:keys,stateLabel:label,rawScore:finiteMetric(rawScore),adjustedScore:finiteMetric(adjustedScore),learningAdjustmentAtEntry:Number(learning.adjustment||0),mentorModelVersion:SHADOW_MENTOR_VERSION_V2622,institutionalEdgeAtEntry:Number(mentor.edgeScore||0),mentorConfidenceAtEntry:Number(mentor.confidenceScore||0),mentorForwardStatusAtEntry:String(mentor.forward?.status||'COLLECTING'),costRatioAtEntry:mentor.cost?.ratio??null,strategyNetPfAtEntry:mentor.strategyStats?.netProfitFactor??null,strategyNetExpRAtEntry:mentor.strategyStats?.netExpectancyR??null,tierAtEntry:String(tier||'VALID'),learningEligible:learningEligible!==false,shadowProgress:finiteMetric(shadowProgress),blockReasons:Array.isArray(blockReasons)?blockReasons.slice(0,8):[],notified:false,notificationId:null,status:'ACTIVE',result:null,resultAt:null,exitPrice:null,grossReturnPct:null,netReturnPct:null,realizedR:null,mfePct:0,maePct:0,maxR:0,minR:0,snapshots:{},lastPrice:e,lastPriceAt:now,lastSource:'shadow-entry',costBps:PERF_ROUND_TRIP_COST_BPS,researchRevisionAtEntry:RESEARCH_LAYER_REVISION,coreBuildAtEntry:BUILD_VERSION,assetClassAtEntry:researchAssetClass(t.symbol),primaryBlockClassAtEntry:researchPrimaryBlockClass(tier,blockReasons),blockClassFlagsAtEntry:researchBlockClasses(tier,blockReasons),scoreMeaning:RESEARCH_LAYER_SCORE_MEANING};
  shadowPerformance.unshift(rec);shadowActiveSymbols.add(cleanFuturesSymbol(t.symbol));scheduleShadowPerformanceSave();t.shadowRecordId=id;t.shadowReadyLatch=features.strategyId;shadowOnPrice(t.symbol,e,Date.now(),'shadow-entry');return rec;
}
function shadowMarkNotified(t,noticeId,tier){const id=t?.shadowRecordId;if(!id)return false;const rec=shadowPerformance.find(x=>x.id===id);if(!rec)return false;rec.notified=true;rec.notificationId=noticeId||null;rec.notifiedAt=new Date().toISOString();rec.finalTier=String(tier||rec.tierAtEntry||'VALID');scheduleShadowPerformanceSave();return true}
function shadowFinalize(rec,result,price,ts,source){if(rec.status!=='ACTIVE')return;const dir=testSignalDirection(rec.direction),gross=dir*(price-rec.entryPrice)/rec.entryPrice*100,r=dir*(price-rec.entryPrice)/rec.riskDistance;rec.status='RESOLVED';rec.result=result;rec.resultAt=new Date(ts).toISOString();rec.exitPrice=price;rec.grossReturnPct=Number(gross.toFixed(4));rec.netReturnPct=Number((gross-PERF_ROUND_TRIP_COST_BPS/100).toFixed(4));rec.realizedR=Number(r.toFixed(3));rec.resultSource=source;shadowLearningRevision++;if(!shadowPerformance.some(x=>x!==rec&&x.status==='ACTIVE'&&x.symbol===rec.symbol))shadowActiveSymbols.delete(cleanFuturesSymbol(rec.symbol));scheduleShadowPerformanceSave()}
function shadowOnPrice(symbol,price,ts=Date.now(),source='price'){
  const px=Number(price);if(!(px>0))return;const key=cleanFuturesSymbol(symbol);if(!shadowActiveSymbols.has(key))return;const now=Number(ts)||Date.now();let dirty=false;
  for(const rec of shadowPerformance){if(rec.status!=='ACTIVE'||rec.symbol!==key)continue;const start=new Date(rec.shadowAt).getTime();if(!(now>=start))continue;const dir=testSignalDirection(rec.direction),signed=dir*(px-rec.entryPrice)/rec.entryPrice*100,r=dir*(px-rec.entryPrice)/rec.riskDistance;rec.lastPrice=px;rec.lastPriceAt=new Date(now).toISOString();rec.lastSource=source;rec.mfePct=Number(Math.max(Number(rec.mfePct||0),signed).toFixed(4));rec.maePct=Number(Math.max(Number(rec.maePct||0),-signed).toFixed(4));rec.maxR=Number(Math.max(Number(rec.maxR||0),r).toFixed(3));rec.minR=Number(Math.min(Number(rec.minR||0),r).toFixed(3));const elapsed=now-start;for(const min of PERF_HORIZONS_MIN){if(elapsed>=min*60_000&&!rec.snapshots?.[min]){rec.snapshots=rec.snapshots||{};rec.snapshots[min]={at:new Date(now).toISOString(),price:px,returnPct:Number(signed.toFixed(4)),r:Number(r.toFixed(3)),source}}}const hitStop=dir>0?px<=rec.stop:px>=rec.stop,hitTarget=dir>0?px>=rec.target:px<=rec.target;if(hitStop)shadowFinalize(rec,'LOSS',rec.stop,now,source);else if(hitTarget)shadowFinalize(rec,'WIN',rec.target,now,source);else if(elapsed>=PERF_MAX_HORIZON_MS)shadowFinalize(rec,'TIMEOUT',px,now,source);dirty=true}
  if(dirty)scheduleShadowPerformanceSave();
}
function shadowPerformanceAggregate(){
  const all=shadowPerformance.filter(x=>x?.version==='V10.2.2'),resolved=all.filter(x=>x.status==='RESOLVED'),base=shadowStats(resolved);
  const blocked=resolved.filter(x=>String(x.tierAtEntry||'').toUpperCase()==='BLOCKED'),blockedStats=shadowStats(blocked);
  const valid=resolved.filter(x=>String(x.tierAtEntry||'').toUpperCase()==='VALID'),validStats=shadowStats(valid);
  const unnotified=resolved.filter(x=>!x.notified),unnotifiedStats=shadowStats(unnotified);
  const notified=resolved.filter(x=>x.notified),notifiedStats=shadowStats(notified),learningEligible=resolved.filter(x=>x.learningEligible!==false),learningEffective=shadowLearningEffectiveRows();
  const group=(keyFn)=>{const m=new Map();for(const x of resolved){const k=String(keyFn(x)||'UNKNOWN');if(!m.has(k))m.set(k,[]);m.get(k).push(x)}return [...m.entries()].map(([key,a])=>({key,...shadowStats(a)})).sort((a,b)=>b.sample-a.sample)};
  return {sample:all.length,active:all.filter(x=>x.status==='ACTIVE').length,resolved:resolved.length,...base,learningEligibleResolved:learningEligible.length,learningEffectiveResolved:learningEffective.length,learningDedupMinutes:Math.round(STATE_LEARNING_DEDUP_MS/60000),blockedSample:blocked.length,blockedHitRate:blockedStats.hitRate,blockedProfitFactor:blockedStats.profitFactor,blockedExpectancyR:blockedStats.expectancyR,validSample:valid.length,validHitRate:validStats.hitRate,validProfitFactor:validStats.profitFactor,validExpectancyR:validStats.expectancyR,unnotifiedSample:unnotified.length,unnotifiedHitRate:unnotifiedStats.hitRate,unnotifiedProfitFactor:unnotifiedStats.profitFactor,notifiedSample:notified.length,notifiedHitRate:notifiedStats.hitRate,byAssetClass:group(x=>x.assetClass||assetClassForSymbolV2612(x.symbol)),bySession:group(x=>x.assetSession||assetSessionV2612(x.symbol,new Date(x.shadowAt||Date.now()).getTime())),byTier:group(x=>x.finalTier||x.tierAtEntry||'VALID'),byRegime:group(x=>x.marketRegime),byStrategy:group(x=>x.strategyLabel||x.strategyId||'未分類')};
}

/* SHADOW_RESEARCH_LAYER_V1_20260901 — research-only layer. Core signal thresholds / hard blockers are intentionally untouched. */
function researchBaseSymbol(symbol){const s=cleanFuturesSymbol(symbol);return s.endsWith('USDT')?s.slice(0,-4):s}
function researchAssetClass(symbol){
  try{return bootcampAssetClassV2681(symbol)}catch{}
  const b=researchBaseSymbol(symbol);return new Set(['XAU','XAG']).has(b)?'COMMODITY':'CRYPTO';
}
function researchReasonText(reasons){return (Array.isArray(reasons)?reasons:[reasons]).filter(Boolean).join('｜')}
function researchBlockClasses(tierOrRec,reasonsMaybe){
  const rec=tierOrRec&&typeof tierOrRec==='object'?tierOrRec:null,tier=String(rec?.tierAtEntry??tierOrRec??'').toUpperCase(),txt=researchReasonText(rec?.blockReasons??reasonsMaybe);
  if(tier!=='BLOCKED')return ['NONE'];const out=[];
  if(/ADL|Funding|擁擠|安全閘門|風險|清算|spread|價差|流動性|深度|stale|過期|延遲|資料|coverage|confidence|追價|滑價|slippage/i.test(txt))out.push('RISK');
  if(/勝率|分數|結構|趨勢|方向|大盤|逆向|動能|回踩|突破|未確認|regime/i.test(txt))out.push('ALPHA');
  if(/ready|樣本|尚未/i.test(txt))out.push('READINESS');
  return out.length?out:['OTHER'];
}
function researchPrimaryBlockClass(tierOrRec,reasonsMaybe){return researchBlockClasses(tierOrRec,reasonsMaybe)[0]||'OTHER'}
function researchScoreBucket(v){if(v==null||v==='')return 'NA';const x=Number(v);if(!Number.isFinite(x))return 'NA';if(x>=100)return '100';if(x>=95)return '95-99';if(x>=90)return '90-94';if(x>=80)return '80-89';if(x>=70)return '70-79';return '<70'}
function researchNetR(rec){
  const net=rec?.netReturnPct==null?null:Number(rec.netReturnPct),entry=Number(rec?.entryPrice),risk=Number(rec?.riskDistance)||Math.abs(Number(rec?.entryPrice)-Number(rec?.stop));
  const riskPct=entry>0&&risk>0?risk/entry*100:null;return net!=null&&Number.isFinite(net)&&Number.isFinite(riskPct)&&riskPct>0?Number((net/riskPct).toFixed(4)):null;
}
function researchStats(rows){
  const resolved=(rows||[]).filter(x=>x?.status==='RESOLVED'),gross=shadowStats(resolved),netRs=resolved.map(researchNetR).filter(Number.isFinite),netProfit=netRs.filter(x=>x>0).reduce((a,b)=>a+b,0),netLoss=Math.abs(netRs.filter(x=>x<0).reduce((a,b)=>a+b,0)),netExp=netRs.length?netRs.reduce((a,b)=>a+b,0)/netRs.length:null;
  const grossPct=resolved.map(x=>x.grossReturnPct==null?null:Number(x.grossReturnPct)).filter(Number.isFinite),netPct=resolved.map(x=>x.netReturnPct==null?null:Number(x.netReturnPct)).filter(Number.isFinite),avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  return {...gross,netSample:netRs.length,netProfitFactor:netLoss>0?Number((netProfit/netLoss).toFixed(2)):(netProfit>0?99:null),netExpectancyR:netExp==null?null:Number(netExp.toFixed(3)),avgGrossReturnPct:grossPct.length?Number(avg(grossPct).toFixed(4)):null,avgNetReturnPct:netPct.length?Number(avg(netPct).toFixed(4)):null,costDragPct:grossPct.length&&netPct.length?Number((avg(grossPct)-avg(netPct)).toFixed(4)):null};
}
function researchGroup(rows,keyFn,minSample=1){
  const m=new Map();for(const r of rows||[]){const k=String(keyFn(r)||'UNKNOWN');if(!m.has(k))m.set(k,[]);m.get(k).push(r)}
  return [...m.entries()].map(([key,a])=>({key,...researchStats(a)})).filter(x=>x.sample>=minSample).sort((a,b)=>b.sample-a.sample||Number(b.netProfitFactor||0)-Number(a.netProfitFactor||0));
}
function researchPointBiserial(rows){
  const a=(rows||[]).filter(x=>['WIN','LOSS'].includes(x?.result)&&x?.rawScore!=null&&Number.isFinite(Number(x.rawScore))).map(x=>[Number(x.rawScore),x.result==='WIN'?1:0]);if(a.length<8)return null;
  const mx=a.reduce((s,x)=>s+x[0],0)/a.length,my=a.reduce((s,x)=>s+x[1],0)/a.length;let num=0,dx=0,dy=0;for(const [x,y] of a){num+=(x-mx)*(y-my);dx+=(x-mx)**2;dy+=(y-my)**2}const d=Math.sqrt(dx*dy);return d>0?Number((num/d).toFixed(3)):null;
}
function researchCoreConfigSnapshot(){return {buildVersion:BUILD_VERSION,highRate:TEST_SIGNAL_HIGH_RATE,normalRate:TEST_SIGNAL_NORMAL_RATE,highScore:TEST_SIGNAL_HIGH_SCORE,normalScore:TEST_SIGNAL_NORMAL_SCORE,maxSpreadBps:TEST_SIGNAL_MAX_SPREAD_BPS,shadowMinScore:SHADOW_MIN_SCORE,shadowMinProgress:SHADOW_MIN_PROGRESS,shadowMinCoverage:SHADOW_MIN_COVERAGE,shadowMinConfidence:SHADOW_MIN_CONFIDENCE,dedupMinutes:Math.round(STATE_LEARNING_DEDUP_MS/60000),stateMinSample:STATE_LEARNING_MIN_SAMPLE,stateMaxBonus:STATE_LEARNING_MAX_BONUS,costBps:PERF_ROUND_TRIP_COST_BPS}}
function researchAuditRead(){const x=loadJson(RESEARCH_AUDIT_FILE,null);return x&&typeof x==='object'?x:{schemaVersion:1,createdAt:new Date().toISOString(),revisions:[],configEvents:[],checkpoints:[]}}
function researchEnsureAudit({checkpoint=true}={}){
  const audit=researchAuditRead(),now=new Date().toISOString(),config=researchCoreConfigSnapshot(),fp=JSON.stringify(config);let dirty=false;
  if(!Array.isArray(audit.revisions))audit.revisions=[];if(!Array.isArray(audit.configEvents))audit.configEvents=[];if(!Array.isArray(audit.checkpoints))audit.checkpoints=[];
  if(!audit.revisions.some(x=>x?.revision===RESEARCH_LAYER_REVISION)){audit.revisions.push({revision:RESEARCH_LAYER_REVISION,releaseDate:RESEARCH_LAYER_RELEASE_DATE,installedAt:now,coreBuild:BUILD_VERSION,coreRulesChanged:false,baseline:{shadowRaw:shadowPerformance.filter(x=>x?.version==='V10.2.2').length,shadowResolved:shadowPerformance.filter(x=>x?.version==='V10.2.2'&&x.status==='RESOLVED').length,effective:shadowLearningEffectiveRows().length},changes:['BLOCKED 改以 tierAtEntry 判定，和未通知樣本分離','新增研究版號與變更日期稽核','新增 Asset Class / Block Class 衍生分類','新增 Net PF / Net Expectancy / 成本拖累','新增 Score bucket 與分數-結果相關性診斷','新增 Strategy × Regime × Direction 階層統計；只研究，不改核心門檻'],knownIssues:['Score 100 目前只代表條件完成度，勝負辨識力待 OOS 驗證','VALID 扣成本後是否形成正期望仍未證明','BLOCKED 需長期區分 Alpha / Risk / Readiness 原因','CRYPTO / EQUITY_TOKEN / COMMODITY 不應直接混成同一研究結論','核心狀態桶樣本仍可能稀疏','真正通知與實際建倉樣本仍不足以做可靠校準'],nextGates:[{gate:'R1_OOS_30',condition:'R1 去相關新樣本 >= 30',action:'比較 PRE_R1 / R1；只評估，不放寬門檻'},{gate:'EFFECTIVE_150',condition:'總去相關有效樣本 >= 150',action:'重估 VALID/BLOCKED、Strategy×Regime×Direction 與 Net PF'},{gate:'CORE_BUCKET_20',condition:'至少一個核心狀態桶 >= 20',action:'檢查該桶是否有穩定正期望，再決定是否允許保守學習'},{gate:'NOTIFIED_20',condition:'真正通知 decisive >= 20',action:'開始看 live calibration / Brier / notification PF'},{gate:'ACTUAL_12_STATE',condition:'同策略×Regime×方向實際建倉 decisive >= 12',action:'只允許既有 ±1 人類實盤交叉驗證，不覆蓋硬風控'}],researchPrinciples:['forward/shadow first','out-of-sample by revision','net-of-cost evaluation','no threshold loosening from small samples']});dirty=true}
  if(audit.currentConfigFingerprint&&audit.currentConfigFingerprint!==fp){audit.configEvents.push({at:now,type:'CONFIG_DRIFT',from:audit.currentConfig||null,to:config});audit.configEvents=audit.configEvents.slice(-50);dirty=true}
  if(audit.currentConfigFingerprint!==fp){audit.currentConfigFingerprint=fp;audit.currentConfig=config;dirty=true}
  if(checkpoint){const day=now.slice(0,10),last=audit.checkpoints.at(-1);if(!last||String(last.at||'').slice(0,10)!==day){audit.checkpoints.push({at:now,revision:RESEARCH_LAYER_REVISION,shadowRaw:shadowPerformance.filter(x=>x?.version==='V10.2.2').length,shadowResolved:shadowPerformance.filter(x=>x?.version==='V10.2.2'&&x.status==='RESOLVED').length,effective:shadowLearningEffectiveRows().length,actualTrades:actualTrades.filter(x=>x?.version==='V10.2.6').length});audit.checkpoints=audit.checkpoints.slice(-120);dirty=true}}
  if(dirty)saveJson(RESEARCH_AUDIT_FILE,audit);return audit;
}
function researchDiagnostics(persistAudit=true){
  const effective=shadowLearningEffectiveRows(),allResolved=shadowPerformance.filter(x=>x?.version==='V10.2.2'&&x.status==='RESOLVED'),valid=effective.filter(x=>String(x.tierAtEntry||'').toUpperCase()==='VALID'),blocked=effective.filter(x=>String(x.tierAtEntry||'').toUpperCase()==='BLOCKED');
  const audit=persistAudit?researchEnsureAudit({checkpoint:true}):researchAuditRead(),scoreCorr=researchPointBiserial(effective),scoreBuckets=researchGroup(effective,x=>researchScoreBucket(x.rawScore),1),score100=scoreBuckets.find(x=>x.key==='100')||null;
  const core=researchGroup(effective,x=>[x.strategyId,x.marketRegime,x.direction].join('|'),1),broad=researchGroup(effective,x=>[x.strategyId,x.marketRegime].join('|'),1),strategy=researchGroup(effective,x=>x.strategyId||x.strategyLabel||'UNKNOWN',1);
  const asset=researchGroup(effective,x=>researchAssetClass(x.symbol),1),blockClass=researchGroup(blocked,x=>researchPrimaryBlockClass(x),1),blockFlag=['RISK','ALPHA','READINESS','OTHER'].map(key=>({key,...researchStats(blocked.filter(x=>researchBlockClasses(x).includes(key)))})).filter(x=>x.sample>0),revision=researchGroup(effective,x=>x.researchRevisionAtEntry||'PRE_R1',1);
  const currentRev=audit.revisions?.find(x=>x.revision===RESEARCH_LAYER_REVISION)||null,currentRevRows=effective.filter(x=>x.researchRevisionAtEntry===RESEARCH_LAYER_REVISION),currentRevStats=researchStats(currentRevRows),maxCore=Math.max(0,...core.map(x=>x.sample)),maxBroad=Math.max(0,...broad.map(x=>x.sample));
  const warnings=[];if(scoreCorr!=null&&scoreCorr<.08)warnings.push({code:'SCORE_LOW_DISCRIMINATION',severity:'HIGH',text:'結構分數與勝負的線性辨識力偏低；100 分不得視為勝率。'});if(valid.length>=20&&researchStats(valid).netProfitFactor!=null&&researchStats(valid).netProfitFactor<1)warnings.push({code:'VALID_NET_PF_LT_1',severity:'HIGH',text:'VALID 去相關樣本扣成本後仍未形成正期望。'});if(asset.length>1)warnings.push({code:'MIXED_ASSET_CLASSES',severity:'MEDIUM',text:'研究池包含不同資產類別；先分層觀察，不直接共用結論。'});if(maxCore<STATE_LEARNING_MIN_SAMPLE)warnings.push({code:'CORE_BUCKET_SPARSE',severity:'MEDIUM',text:'Strategy × Regime × Direction 尚未有足量核心桶；避免提早加權。'});if(currentRevStats.sample<30)warnings.push({code:'OOS_REVISION_SAMPLE_LOW',severity:'INFO',text:'R1 上線後的新樣本尚未滿 30；先累積 revision cohort，再比較 PRE_R1 / R1。'});if((audit.configEvents||[]).length)warnings.push({code:'CONFIG_DRIFT_RECORDED',severity:'INFO',text:'核心設定曾變動，已記錄時間與前後值；跨版本績效需分開看。'});if((audit.revisions||[]).length+(audit.configEvents||[]).length>=4)warnings.push({code:'MULTIPLE_TESTING_RISK',severity:'MEDIUM',text:'研究版本/設定嘗試次數增加；避免只挑最好看的結果，後續以新 revision 的 OOS 樣本驗證。'});
  return {revision:RESEARCH_LAYER_REVISION,releaseDate:RESEARCH_LAYER_RELEASE_DATE,coreBuild:BUILD_VERSION,coreRulesChanged:false,scoreMeaning:RESEARCH_LAYER_SCORE_MEANING,generatedAt:new Date().toISOString(),sample:{rawResolved:allResolved.length,effective:effective.length,dedupMinutes:Math.round(STATE_LEARNING_DEDUP_MS/60000)},overall:researchStats(effective),valid:researchStats(valid),blocked:researchStats(blocked),score:{outcomeCorrelation:scoreCorr,buckets:scoreBuckets,score100},hierarchy:{coreReady:core.filter(x=>x.sample>=STATE_LEARNING_MIN_SAMPLE).length,maxCoreSample:maxCore,broadReady:broad.filter(x=>x.sample>=STATE_LEARNING_MIN_SAMPLE).length,maxBroadSample:maxBroad,core:core.slice(0,40),broad:broad.slice(0,30),strategy:strategy.slice(0,20)},byAssetClass:asset,byBlockClass:blockClass,byBlockFlag:blockFlag,byRevision:revision,oos:{currentRevisionSample:Number(currentRevStats.sample||0),minimumReviewSample:30,ready:Number(currentRevStats.sample||0)>=30},warnings,roadmap:currentRev?.nextGates||[],audit:{release:currentRev,configEvents:(audit.configEvents||[]).slice(-8),checkpoints:(audit.checkpoints||[]).slice(-12)},methodology:'研究層只做診斷、版本稽核與成本後統計；不降低 HIGH/NORMAL 門檻、不改硬性風控、不因 100 分直接提高勝率。'};
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
  const px=Number(price);if(!(px>0))return;const key=cleanFuturesSymbol(symbol),hasNotify=performanceActiveSymbols.has(key),hasShadow=shadowActiveSymbols.has(key),hasActual=actualTradeActiveSymbols.has(key);if(!hasNotify&&!hasShadow&&!hasActual)return;const now=Number(ts)||Date.now();if(hasActual)actualTradeOnPrice(key,px,now,source);let dirty=false;
  for(const rec of signalPerformance){if(rec.status!=='ACTIVE'||rec.symbol!==key)continue;const start=new Date(rec.notificationAt).getTime();if(!(now>=start))continue;const dir=testSignalDirection(rec.direction),signed=dir*(px-rec.entryPrice)/rec.entryPrice*100,r=dir*(px-rec.entryPrice)/rec.riskDistance;rec.lastPrice=px;rec.lastPriceAt=new Date(now).toISOString();rec.lastSource=source;rec.mfePct=Number(Math.max(Number(rec.mfePct||0),signed).toFixed(4));rec.maePct=Number(Math.max(Number(rec.maePct||0),-signed).toFixed(4));rec.maxR=Number(Math.max(Number(rec.maxR||0),r).toFixed(3));rec.minR=Number(Math.min(Number(rec.minR||0),r).toFixed(3));const elapsed=now-start;
    for(const min of PERF_HORIZONS_MIN){if(elapsed>=min*60_000&&!rec.snapshots?.[min]){rec.snapshots=rec.snapshots||{};rec.snapshots[min]={at:new Date(now).toISOString(),price:px,returnPct:Number(signed.toFixed(4)),r:Number(r.toFixed(3)),source};}}
    const hitStop=dir>0?px<=rec.stop:px>=rec.stop,hitTarget=dir>0?px>=rec.target:px<=rec.target;if(hitStop)performanceFinalize(rec,'LOSS',rec.stop,now,source);else if(hitTarget)performanceFinalize(rec,'WIN',rec.target,now,source);else if(elapsed>=PERF_MAX_HORIZON_MS)performanceFinalize(rec,'TIMEOUT',px,now,source);dirty=true;
  }
  if(dirty)schedulePerformanceSave();
  if(hasShadow)shadowOnPrice(key,px,now,source);
}
function performanceTrackerFallback(){
  const now=Date.now();for(const rec of signalPerformance){if(rec.status!=='ACTIVE')continue;const t=testSignalTrackers.get(rec.signalKey);if(t){if(rec.phase==='FIRST_ENTRY'&&t.outcomeFirstTouch&&new Date(t.outcomeFirstTouchAt||0).getTime()>=new Date(rec.notificationAt).getTime()){performanceFinalize(rec,t.outcomeFirstTouch==='WIN'?'WIN':'LOSS',t.outcomeFirstTouch==='WIN'?rec.target:rec.stop,new Date(t.outcomeFirstTouchAt).getTime()||now,'5m candle fallback');continue}if(rec.phase==='REENTRY'&&['WIN','LOSS'].includes(t.reentryResult)&&new Date(t.reentryResultAt||0).getTime()>=new Date(rec.notificationAt).getTime()){performanceFinalize(rec,t.reentryResult,t.reentryResult==='WIN'?rec.target:rec.stop,new Date(t.reentryResultAt).getTime()||now,'tracker fallback');continue}}
    const px=realtimeBestPrice(rec.symbol)||markPrices.get(rec.symbol);if(px)performanceOnPrice(rec.symbol,px,now,'heartbeat fallback');
  }
  for(const rec of shadowPerformance){if(rec.status!=='ACTIVE')continue;const px=realtimeBestPrice(rec.symbol)||markPrices.get(rec.symbol);if(px)shadowOnPrice(rec.symbol,px,now,'shadow heartbeat fallback');}
  for(const rec of actualTrades){if(rec?.version!=='V10.2.6'||rec.status!=='ACTIVE')continue;const px=realtimeBestPrice(rec.symbol)||markPrices.get(rec.symbol);if(px)actualTradeOnPrice(rec.symbol,px,now,'actual heartbeat fallback');}
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
function performanceResponse(){return {ok:true,generatedAt:new Date().toISOString(),version:'V10.2.6',preciseSampleStarts:'V10.0 deployment',defaultCostBps:PERF_ROUND_TRIP_COST_BPS,maxHorizonMinutes:Math.round(PERF_MAX_HORIZON_MS/60000),summary:performanceAggregate(),shadowSummary:shadowPerformanceAggregate(),actualSummary:actualTradeAggregate(),research:researchDiagnostics(false),actualTrades:actualTrades.filter(x=>x?.version==='V10.2.6').slice(0,200),stateLearning:{minSample:STATE_LEARNING_MIN_SAMPLE,maxBonus:STATE_LEARNING_MAX_BONUS,shadowMinScore:SHADOW_MIN_SCORE,patterns:stateLearningTable(30)},records:signalPerformance.filter(x=>x.version==='V10.0').slice(0,500),recent:signalPerformance.filter(x=>x.version==='V10.0').slice(0,100),shadowRecent:shadowPerformance.filter(x=>x.version==='V10.2.2').slice(0,100),methodology:'通知帳本統計真正成功送出的進場型通知；影子績效追蹤未通知候選；實際建倉帳本則由你手動填成本、TP/SP、保證金/數量與槓桿，後端用 Binance 即時價格追蹤 TP/SP first-touch 與估算損益，作為獨立的人類實盤佐證。Shadow 狀態學習仍採去相關化且保守加權，實際建倉先作交叉驗證，不直接覆蓋硬性風險門檻。'};}

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

function isValidVapidPair(keys) {
  if (!keys?.publicKey || !keys?.privateKey) return false;
  const pub = String(keys.publicKey).trim();
  const pri = String(keys.privateKey).trim();
  if (!pub || !pri) return false;
  if (/^TEST_/i.test(pub) || /^TEST_/i.test(pri)) return false;
  // web-push VAPID keys are URL-safe base64; public key is normally 87 chars, private ~43.
  return /^[A-Za-z0-9_-]{80,100}$/.test(pub) && /^[A-Za-z0-9_-]{40,60}$/.test(pri);
}

function getVapidKeys() {
  const envKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
  };
  if (isValidVapidPair(envKeys)) return envKeys;

  const saved = loadJson(VAPID_FILE, null);
  if (isValidVapidPair(saved)) return saved;

  const generated = webpush.generateVAPIDKeys();
  saveJson(VAPID_FILE, generated);
  console.warn('[vapid] No valid persisted VAPID pair found; generated a new valid pair. Existing push subscriptions may need to re-subscribe.');
  return generated;
}

const vapid = getVapidKeys();

try {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:position-alert@example.com',
    vapid.publicKey,
    vapid.privateKey
  );
} catch (e) {
  // Push configuration must never take the entire market-monitoring backend down.
  console.error(`[vapid] Push initialization disabled: ${String(e?.message || e)}`);
}

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

/* NOTIFICATION_CONTROL_V2616: phone whitelist = 熬鷹 order events + A/B shadow judgement only. */
const NOTICE_DEDUP_FILE_V2616=path.join(DATA_DIR,'notification-dedup-v2616.json');
const NOTICE_DEDUP_MS_V2616=Math.max(15*60_000,Math.min(120*60_000,Number(process.env.NOTICE_DEDUP_MS_V2616||45*60_000)));
function noticeDedupKeyV2616(endpoint,symbol,direction){return [String(endpoint||'').slice(-96),cleanFuturesSymbol(symbol),String(direction||'LONG').toUpperCase()==='SHORT'?'SHORT':'LONG'].join('|')}
function noticeDedupMapV2616(){const x=loadJson(NOTICE_DEDUP_FILE_V2616,{});return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}
function noticeDedupCanSendV2616(endpoint,symbol,direction,now=Date.now()){const m=noticeDedupMapV2616(),at=Number(m[noticeDedupKeyV2616(endpoint,symbol,direction)]||0);return !(at>0&&now-at<NOTICE_DEDUP_MS_V2616)}
function noticeDedupMarkV2616(endpoint,symbol,direction,now=Date.now()){const m=noticeDedupMapV2616(),cut=now-24*60*60_000;for(const [k,v] of Object.entries(m))if(Number(v)<cut)delete m[k];m[noticeDedupKeyV2616(endpoint,symbol,direction)]=now;saveJson(NOTICE_DEDUP_FILE_V2616,m)}
function shadowGradeV2616(tier){return String(tier||'').toUpperCase()==='HIGH'?'A':String(tier||'').toUpperCase()==='NORMAL'?'B':null}


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

function subscriptionAllows(rec,target={}){
  const enabledTraders=new Set(rec?.enabledTraders||[]),enabledTypes=new Set(rec?.enabledTypes||EVENT_TYPES);
  if(target.forceTest===true)return !target.endpoint||String(rec?.endpoint||'')===String(target.endpoint);
  if(target.candidateNotice===true){
    const pref=typeof notificationCustomPrefsV2673==='function'?notificationCustomPrefsV2673():{candidateMode:'OFF'};
    if(pref.candidateMode==='OFF')return false;
    return true;
  }
  if(target.testSignal===true){
    const pref=typeof notificationCustomPrefsV2673==='function'?notificationCustomPrefsV2673():{formalMode:'AB'};
    const grade=typeof shadowGradeV2616==='function'?shadowGradeV2616(target.testSignalTier):(String(target.testSignalTier||'').toUpperCase()==='HIGH'?'A':String(target.testSignalTier||'').toUpperCase()==='NORMAL'?'B':null);
    if(!grade)return false;
    return pref.formalMode==='A'?grade==='A':['A','B'].includes(grade);
  }
  const eventType=String(target.eventType||'').toUpperCase();
  if(['OPEN','ADD','REDUCE','CLOSE'].includes(eventType))return String(target.traderId||'')===CORE_TRADER_ID;
  return false;
}

async function sendPushCoreV2681(payload, target = {}) {
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
    if(target.shadowDedup===true&&!noticeDedupCanSendV2616(rec.endpoint,target.symbol,target.direction)){filtered++;eligible--;keep.push(rec);continue;}
    try {
      await webpush.sendNotification(
        rec.subscription,
        JSON.stringify(payload),
        { TTL: 90, urgency: 'high' }
      );
      sent++;if(target.shadowDedup===true)noticeDedupMarkV2616(rec.endpoint,target.symbol,target.direction);
      keep.push(rec);
    } catch (e) {
      failed++;
      if (![404, 410].includes(e.statusCode)) keep.push(rec);
    }
  }

  if (keep.length !== records.length) saveSubRecords(keep);
  return {records:records.length,eligible,sent,failed,filtered};
}

async function sendPush(payload,target={}){
  const out=await sendPushCoreV2681(payload,target);
  try{bootcampPushAuditV2681(payload,target,out)}catch{}
  return out;
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
    data: { url: event.kind === 'TRADER' ? '/?page=today' : event.kind === 'PULLBACK' ? tradingViewLaunchUrl(event.symbol) : '/?page=today' },
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

function buildMarketFlowCoreV2612(tickers, premiums) {
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

function buildMarketFlow(tickers,premiums){
  const allTick=Array.isArray(tickers)?tickers:[],allPrem=Array.isArray(premiums)?premiums:[];
  const cryptoTick=allTick.filter(x=>assetClassForSymbolV2612(x?.symbol)==='CRYPTO'),tradfiTick=allTick.filter(x=>assetClassForSymbolV2612(x?.symbol)==='TRADFI');
  const cryptoSet=new Set(cryptoTick.map(x=>String(x?.symbol||''))),tradfiSet=new Set(tradfiTick.map(x=>String(x?.symbol||'')));
  const combined=buildMarketFlowCoreV2612(allTick,allPrem),crypto=buildMarketFlowCoreV2612(cryptoTick,allPrem.filter(x=>cryptoSet.has(String(x?.symbol||'')))),tradfi=buildMarketFlowCoreV2612(tradfiTick,allPrem.filter(x=>tradfiSet.has(String(x?.symbol||''))));
  const decorate=(v,assetClass,label)=>({...v,assetClass,assetLabel:label,leaders:(v.leaders||[]).map(x=>({...x,assetClass})),recommendations:(v.recommendations||[]).map(x=>({...x,assetClass}))});
  return {...combined,assetViews:{crypto:decorate(crypto,'CRYPTO','幣圈'),tradfi:decorate(tradfi,'TRADFI','美股')},assetCounts:{crypto:cryptoTick.length,tradfi:tradfiTick.length},assetLearning:'V2.6.12 ASSET-AWARE'};
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

const ASYNC_DEADLINE_MS_V2616=Math.max(3500,Math.min(15000,Number(process.env.ASYNC_DEADLINE_MS_V2616||8000)));
function deadlineV2616(p,ms=ASYNC_DEADLINE_MS_V2616,label='async'){let t;return Promise.race([Promise.resolve(p),new Promise((_,rej)=>{t=setTimeout(()=>rej(new Error(label+' timeout '+ms+'ms')),ms)})]).finally(()=>clearTimeout(t))}

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
    const data = await deadlineV2616(marketFlowCache.inflight,ASYNC_DEADLINE_MS_V2616,'market-flow');
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
/* TRADFI_LEARNING_V2612_20260902 */
const ASSET_PROFILE_PATH_V2612=path.join(__dirname,'asset-profiles-v2612.json');
let ASSET_PROFILES_V2612={};try{ASSET_PROFILES_V2612=JSON.parse(fs.readFileSync(ASSET_PROFILE_PATH_V2612,'utf8'))||{}}catch(e){console.warn('[v2612-tradfi] asset profiles unavailable:',String(e?.message||e))}
const TRADFI_BASES_V2612=new Set(Object.entries(ASSET_PROFILES_V2612).filter(([,v])=>String(v?.assetClass||'').toUpperCase()==='TRADFI').map(([k])=>String(k).toUpperCase()));
function assetBaseV2612(symbol){return String(symbol||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/USDT$/,'').replace(/^1000(?=[A-Z])/,'')}
function assetClassForSymbolV2612(symbol){return TRADFI_BASES_V2612.has(assetBaseV2612(symbol))?'TRADFI':'CRYPTO'}
function assetProfileV2612(symbol){const base=assetBaseV2612(symbol),p=ASSET_PROFILES_V2612[base]||null;return p?{base,...p}:{base,assetClass:'CRYPTO',subtype:'CRYPTO'}}
function assetSessionV2612(symbol,at=Date.now()){
  if(assetClassForSymbolV2612(symbol)!=='TRADFI')return 'CRYPTO_24H';
  const d=new Date(at);let parts={};try{parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]))}catch{return'US_OTHER'}
  const wd=String(parts.weekday||''),h=Number(parts.hour||0),m=Number(parts.minute||0),min=h*60+m;if(['Sat','Sun'].includes(wd))return'US_WEEKEND';if(min>=570&&min<960)return'US_REGULAR';if(min>=240&&min<570)return'US_PRE';if(min>=960&&min<1200)return'US_AFTER';return'US_OVERNIGHT';
}
function assetSessionLabelV2612(v){return ({CRYPTO_24H:'幣圈24H',US_PRE:'美股盤前',US_REGULAR:'美股正規盤',US_AFTER:'美股盤後',US_OVERNIGHT:'美股隔夜',US_WEEKEND:'美股週末',US_OTHER:'美股其他'})[String(v||'')]||String(v||'—')}
function assetViewRowsV2612(rows,assetClass){return (rows||[]).filter(x=>assetClassForSymbolV2612(x?.symbol)===assetClass)}

function symbolBaseAsset(symbol){
  const raw=String(symbol||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/USDT$/,'');
  if(raw.startsWith('1000')&&SYMBOL_PROJECT_PROFILES[raw.slice(4)])return raw.slice(4);
  return raw;
}
function symbolProjectProfile(symbol){
  const ap=assetProfileV2612(symbol);if(ap.assetClass==='TRADFI')return {base:ap.base,name:ap.name,assetClass:'TRADFI',subtype:ap.subtype,sector:ap.sector,purpose:ap.purpose,history:ap.history,risk:ap.risk,benchmark:ap.benchmark,known:true};
  const base=symbolBaseAsset(symbol),known=SYMBOL_PROJECT_PROFILES[base];
  if(known)return {base,assetClass:'CRYPTO',subtype:'CRYPTO',sector:known.sector,purpose:known.purpose,known:true};
  return {base,assetClass:'CRYPTO',subtype:'CRYPTO',sector:'其他 / 新興加密資產',purpose:'題材與用途變動較快；展開後可用公開資訊快取補充。',known:false};
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
    symbol, assetClass:assetClassForSymbolV2612(symbol), assetSession:assetSessionV2612(symbol), assetSessionLabel:assetSessionLabelV2612(assetSessionV2612(symbol)), assetFamily:assetProfileV2612(symbol)?.subtype||'CRYPTO', price:row.price, changePct:row.changePct, quoteVolume:row.quoteVolume, fundingPct:row.fundingPct,
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
  for(const x of [...radar,...(flow.leaders||[]),...(flow.assetViews?.tradfi?.leaders||[])])if(x?.symbol&&!merged.has(x.symbol))merged.set(x.symbol,x);
  const sorted=[...merged.values()].sort((a,b)=>Number(b.activityScore||0)-Number(a.activityScore||0)||Number(b.quoteVolume||0)-Number(a.quoteVolume||0));
  const crypto=sorted.filter(x=>assetClassForSymbolV2612(x.symbol)==='CRYPTO'),tradfi=sorted.filter(x=>assetClassForSymbolV2612(x.symbol)==='TRADFI');
  const picked=new Map();for(const x of sorted.slice(0,Math.max(12,IDEA_SYMBOLS-6)))picked.set(x.symbol,x);for(const x of crypto.slice(0,10))picked.set(x.symbol,x);for(const x of tradfi.slice(0,10))picked.set(x.symbol,x);
  const candidates=[...picked.values()].sort((a,b)=>Number(b.activityScore||0)-Number(a.activityScore||0)||Number(b.quoteVolume||0)-Number(a.quoteVolume||0)).slice(0,Math.min(48,IDEA_SYMBOLS+8));
  const analyzed=await mapPool(candidates,IDEA_CONCURRENCY,analyzeIdeaSymbol);
  const rows=analyzed.filter(x=>x&&!x.error&&x.direction!=='WAIT').sort((a,b)=>b.rankScore-a.rankScore||b.estimatedWinRate-a.estimatedWinRate||b.quoteVolume-a.quoteVolume);
  let cr=0,us=0;const enriched=rows.map((x,i)=>({...x,globalRank:i+1,assetRank:x.assetClass==='TRADFI'?++us:++cr}));
  return {ok:true,generatedAt:new Date().toISOString(),methodology:'V2.6.12：幣圈＋美股永續雙池雷達；15m+1h 趨勢/動能/量能 + OI/Taker/大戶/Funding + 回測；Shadow 採資產/時段分層學習，再用低權重跨市場經驗補樣本。',radar:realtimeRadarSummary(),analyzed:candidates.length,assetAnalyzed:{crypto:candidates.filter(x=>assetClassForSymbolV2612(x.symbol)==='CRYPTO').length,tradfi:candidates.filter(x=>assetClassForSymbolV2612(x.symbol)==='TRADFI').length},rows:enriched.slice(0,30),errors:analyzed.filter(x=>x?.error).length};
}

async function getRankedIdeas() {
  const now=Date.now();
  if(rankedIdeasCache.data && now-rankedIdeasCache.at<IDEA_CACHE_MS)return {...rankedIdeasCache.data,stale:false,cacheAgeMs:now-rankedIdeasCache.at};
  if(!rankedIdeasCache.inflight){
    rankedIdeasCache.inflight=fetchRankedIdeasFresh().then(data=>{rankedIdeasCache={at:Date.now(),lastGoodAt:Date.now(),data,error:null,inflight:null};return data}).catch(e=>{rankedIdeasCache.error=String(e?.message||e);rankedIdeasCache.inflight=null;throw e});
  }
  try{return {...await deadlineV2616(rankedIdeasCache.inflight,ASYNC_DEADLINE_MS_V2616,'ranked-ideas'),stale:false,cacheAgeMs:0}}catch(e){if(/timeout/i.test(String(e?.message||e)))rankedIdeasCache.inflight=null;if(rankedIdeasCache.data&&now-rankedIdeasCache.lastGoodAt<IDEA_STALE_MS)return {...rankedIdeasCache.data,stale:true,error:String(e?.message||e),cacheAgeMs:now-rankedIdeasCache.lastGoodAt};return {ok:true,generatedAt:new Date().toISOString(),stale:true,error:String(e?.message||e),radar:realtimeRadarSummary(),analyzed:0,rows:[],errors:1}}
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
  if(cached&&now-cached.at<BACKTEST_CACHE_MS)return cached.rows;
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
  if(assetClassForSymbolV2612(key)==='CRYPTO'&&ENABLE_CROSS_EXCHANGE&&oiChangePct==null){try{const r=await fetchBybitOiFallback(key);if(r){oiChangePct=r.changePct;oi1hChangePct=r.change1hPct??r.changePct;oi15mChangePct=r.change15mPct??null;oi5mChangePct=r.change5mPct??null;oiSource='Bybit備援'}}catch(e){errors.oiFallback=String(e?.message||e)}}
  if(takerRatio==null){try{const r=await fetchBinanceAggTakerFallback(key);if(r){takerRatio=r.ratio;takerSource='Binance成交備援'}}catch(e){errors.takerFallback=String(e?.message||e)}}
  if(assetClassForSymbolV2612(key)==='CRYPTO'&&ENABLE_CROSS_EXCHANGE&&takerRatio==null){try{const r=await fetchBybitRecentTakerFallback(key);if(r){takerRatio=r.ratio;takerSource='Bybit成交備援'}}catch(e){errors.takerBybitFallback=String(e?.message||e)}}
  if(assetClassForSymbolV2612(key)==='CRYPTO'&&ENABLE_CROSS_EXCHANGE&&takerRatio==null){try{const r=await fetchOkxRecentTakerFallback(key);if(r){takerRatio=r.ratio;takerSource='OKX成交備援'}}catch(e){errors.takerOkxFallback=String(e?.message||e)}}
  if(assetClassForSymbolV2612(key)==='CRYPTO'&&ENABLE_CROSS_EXCHANGE&&globalLongShortRatio==null){try{const r=await fetchBybitAccountRatioFallback(key);if(r){globalLongShortRatio=r.ratio;globalSource='Bybit備援'}}catch(e){errors.globalFallback=String(e?.message||e)}}
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
  if(assetClassForSymbolV2612(symbol)==='TRADFI')return {available:0,consensus:0,source:'TRADFI_BINANCE_ONLY',skipped:true};
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
    reentryTouchAt:null,reentryConfirmAt:null,reentryConfirmStreak:0,reentryEntryPrice:null,reentryStop:null,reentryTarget1R:null,reentryScore:null,reentryReasons:[],reentryResultSaved:false,reentryResult:null,reentryResultAt:null,confirmNotificationTier:null,reentryNotificationTier:null,lastEntryNotificationAt:null,lastEntryNotificationId:null,lastEntryNotificationTier:null,lastEntryNotificationPhase:null,lastEntryNotificationPrice:null,lastEntryNotificationZoneLow:null,lastEntryNotificationZoneHigh:null,lastEntryNotificationPreferredLow:null,lastEntryNotificationPreferredHigh:null,lastEntryNotificationStop:null,lastEntryNotificationTarget:null
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
function selectLearningIdeasV2612(ideas){
  const rows=Array.isArray(ideas?.rows)?ideas.rows:[],picked=new Map();for(const x of rows.slice(0,Math.min(12,TEST_SIGNAL_MAX)))picked.set(testSignalKey(x.symbol,x.direction),x);for(const cls of ['CRYPTO','TRADFI'])for(const x of rows.filter(y=>assetClassForSymbolV2612(y.symbol)===cls).slice(0,4))picked.set(testSignalKey(x.symbol,x.direction),x);return [...picked.values()].sort((a,b)=>Number(a.globalRank||99)-Number(b.globalRank||99)).slice(0,TEST_SIGNAL_MAX)
}
function syncTestIdeas(ideas) {
  const now=Date.now(),seen=new Set();
  selectLearningIdeasV2612(ideas).forEach((idea,i)=>{
    if(!['LONG','SHORT'].includes(idea.direction))return;const key=testSignalKey(idea.symbol,idea.direction);seen.add(key);
    const opposite=testSignalTrackers.get(testSignalKey(idea.symbol,idea.direction==='LONG'?'SHORT':'LONG'));
    if(opposite&&!terminalTestStatus(opposite.status)&&opposite.status!=='CONFIRMED'){opposite.status='EXPIRED';opposite.statusLabel='方向翻轉';opposite.updatedAt=new Date().toISOString();opposite.finishedAt=opposite.updatedAt;testSignalTrackers.set(opposite.key,opposite)}
    const old=testSignalTrackers.get(key);
    if(!old||terminalTestStatus(old.status)&&now-new Date(old.updatedAt||0).getTime()>TEST_REARM_COOLDOWN_MS){testSignalTrackers.set(key,newTestTracker(idea,Number(idea.assetRank||idea.globalRank||i+1)));return}
    old.rank=Number(idea.assetRank||idea.globalRank||i+1);old.idea={...idea};old.lastSeenIdeaAt=new Date().toISOString();old.updatedAt=new Date().toISOString();testSignalTrackers.set(key,old);
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

/* STRUCTURE_ENGINE_V21_20260902
   Structure Engine V2.1 — structure judgement is independent from notification strictness.
   Primary online sources stay Binance Copy BAPI + Binance Kline/WS; external mirrors are cross-checks, not truth.
   Deep pullback != invalidation. Wick != close. 5m damage != 15m/30m destruction. */
function scheduleStructureLearningSave(){
  if(structureLearningSaveTimer)return;
  structureLearningSaveTimer=setTimeout(()=>{structureLearningSaveTimer=null;structureLearning=structureLearning.slice(0,7000);saveJson(STRUCTURE_LEARNING_FILE,structureLearning)},1200);
  structureLearningSaveTimer.unref?.();
}
function structureV2Dir(t){return testSignalDirection(t?.direction)}
function structureV2Beyond(dir,price,level){return Number.isFinite(Number(price))&&Number.isFinite(Number(level))&&(dir>0?Number(price)<Number(level):Number(price)>Number(level))}
function structureV2Inside(dir,price,level){return Number.isFinite(Number(price))&&Number.isFinite(Number(level))&&(dir>0?Number(price)>=Number(level):Number(price)<=Number(level))}
function structureV2AssetClass(symbol){
  const b=String(symbol||'').toUpperCase().replace(/USDT$/,'');
  if(['XAU','XAG','WTI','BRENT','USOIL','UKOIL'].includes(b))return 'COMMODITY';
  if(/^(SOXL|SOXS|SKHYNIX|NVDA|TSLA|AAPL|MSFT|GOOGL|META|AMZN|AMD|MSTR|COIN|QQQ|SPY|VOO|NDX)/.test(b))return 'EQUITY_TOKEN';
  return 'CRYPTO';
}
function structureV2ProtectedSwing(rows,dir){
  const a=(rows||[]).slice(-80);if(a.length<12)return null;
  const sw=swingLevels(a,2),pts=dir>0?sw.lows:sw.highs,p=pts.at(-1)?.price;
  return Number.isFinite(Number(p))?Number(p):null;
}
function structureV2Retracement(t,price){
  const s=t?.setup||{},dir=structureV2Dir(t),lo=finiteMetric(s.impulseLow),hi=finiteMetric(s.impulseHigh),px=finiteMetric(price),range=(hi!=null&&lo!=null)?hi-lo:null;
  if(!(px>0&&range>0))return null;
  return clamp(dir>0?(hi-px)/range:(px-lo)/range,0,2.5);
}
function structureV2RetrBucket(r){if(!Number.isFinite(Number(r)))return 'NA';const x=Number(r);if(x<.382)return 'SHALLOW';if(x<.618)return 'NORMAL';if(x<.786)return 'DEEP';if(x<1)return 'VERY_DEEP';return 'BEYOND_IMPULSE'}
function structureV2TraderContext(t,now=Date.now()){
  const symbol=cleanFuturesSymbol(t?.symbol),side=String(t?.direction||'LONG').toUpperCase()==='SHORT'?'SHORT':'LONG',rows=recentEvents.filter(e=>e?.kind==='TRADER'&&e?.traderId===CORE_TRADER_ID&&e?.symbol===symbol&&e?.side===side).slice(0,30);
  const recent=rows.map(e=>({...e,_ms:new Date(e.ts||0).getTime()})).filter(e=>Number.isFinite(e._ms)&&now-e._ms<=6*60*60*1000);
  const last=recent[0]||null,lastAdd=recent.find(e=>e.type==='ADD')||null,lastReduce=recent.find(e=>e.type==='REDUCE')||null,lastClose=recent.find(e=>e.type==='CLOSE')||null;
  const age=x=>x?Math.max(0,(now-x._ms)/60000):null;
  const heldNow=!!states.get(CORE_TRADER_ID)?.positions?.has(positionKey(symbol,side));
  return {source:'Binance Copy BAPI/order_history + reconstructed live position',heldNow,lastAction:last?.type||null,lastActionAt:last?.ts||null,lastActionAgeMin:age(last),lastAddAt:lastAdd?.ts||null,lastAddAgeMin:age(lastAdd),lastReduceAt:lastReduce?.ts||null,lastReduceAgeMin:age(lastReduce),lastCloseAt:lastClose?.ts||null,lastCloseAgeMin:age(lastClose),recentAdds:recent.filter(e=>e.type==='ADD').length,recentReduces:recent.filter(e=>e.type==='REDUCE').length};
}
function structureV2Pattern({deep=false,veryDeep=false,wickSweep=false,reclaim15=false,break15=false,two15=false,break30=false,pocLost=false,pocReclaim=false}={}){
  if((deep||veryDeep)&&(wickSweep||reclaim15))return 'DEEP_RECLAIM';
  if(break15&&reclaim15)return 'FAILED_BREAK_RECLAIM';
  if(wickSweep)return 'LIQUIDITY_SWEEP';
  if(two15||break30)return 'STRUCTURE_BREAK';
  if(pocLost&&pocReclaim)return 'POC_RECLAIM';
  if(deep||veryDeep)return 'DEEP_RETRACE';
  return 'NORMAL_STRUCTURE';
}
function structureV2OutcomeSign(x){
  const o=String(x?.outcome||'');
  if(['STRUCTURE_HELD','RECLAIM_SUCCESS','DEEP_PULLBACK_SUCCESS','FALSE_INVALIDATION'].includes(o))return 1;
  if(['STRUCTURE_FAILED','DEEP_PULLBACK_FAILED','TRUE_INVALIDATION'].includes(o))return -1;
  return 0;
}
function structureV2Keys(t,state,bucket,assetClass=null,pattern=null){
  const strategy=t?.strategyAtConfirm||t?.strategyProfile||{},regime=String(t?.marketRegime||t?.lastCheck?.marketRegime||'UNKNOWN'),direction=String(t?.direction||'LONG'),asset=assetClass||structureV2AssetClass(t?.symbol),pat=pattern||'NA';
  return {detail:[asset,strategy.id||'UNKNOWN',regime,direction,state,bucket,pat].join('|'),core:[asset,strategy.id||'UNKNOWN',regime,direction,state].join('|'),broad:[asset,state,bucket].join('|')};
}
function structureV2EffectiveRows(){
  const rows=structureLearning.filter(x=>x?.version===STRUCTURE_ENGINE_VERSION&&x.status==='RESOLVED'&&x.learningEligible!==false&&structureV2OutcomeSign(x)!==0).sort((a,b)=>new Date(b.at||0)-new Date(a.at||0));
  const seenSymbol=new Map(),episodeCount=new Map(),out=[];
  for(const r of rows){
    const core=r?.keys?.core||r.keyCore||'NA',symbol=cleanFuturesSymbol(r.symbol),ts=new Date(r.at||0).getTime(),symbolKey=core+'|'+symbol,prev=seenSymbol.get(symbolKey);
    if(Number.isFinite(prev)&&Math.abs(prev-ts)<STRUCTURE_V2_EPISODE_MS)continue;
    seenSymbol.set(symbolKey,ts);
    const episode=String(r.marketEpisodeId||'NA'),episodeKey=core+'|'+episode,count=Number(episodeCount.get(episodeKey)||0);
    if(episode!=='NA'&&count>=3)continue; // cross-symbol correlation cap: max 3 samples per same market episode/state.
    episodeCount.set(episodeKey,count+1);out.push(r);
  }
  return out;
}
function structureV2Stats(rows){
  const a=(rows||[]).filter(x=>x?.status==='RESOLVED'&&structureV2OutcomeSign(x)!==0),wins=a.filter(x=>structureV2OutcomeSign(x)>0).length,losses=a.filter(x=>structureV2OutcomeSign(x)<0).length,sample=wins+losses;
  const rate=sample?wins/sample*100:null,smoothed=sample?(wins+8)/(sample+16)*100:null;
  const fav=a.map(x=>finiteMetric(x.maxFavorablePct)).filter(Number.isFinite),adv=a.map(x=>finiteMetric(x.maxAdversePct)).filter(Number.isFinite),avg=v=>v.length?v.reduce((s,x)=>s+x,0)/v.length:null;
  return {sample,wins,losses,hitRate:rate==null?null:Number(rate.toFixed(1)),smoothedHitRate:smoothed==null?null:Number(smoothed.toFixed(1)),avgFavorablePct:fav.length?Number(avg(fav).toFixed(3)):null,avgAdversePct:adv.length?Number(avg(adv).toFixed(3)):null};
}
function structureV2Learn(t,rawState,bucket,assetClass,pattern){
  const keys=structureV2Keys(t,rawState,bucket,assetClass,pattern),rows=structureV2EffectiveRows();
  for(const level of ['detail','core','broad']){
    const a=rows.filter(x=>String(x.keys?.[level]||'')===keys[level]),stats=structureV2Stats(a),n=stats.sample;
    if(n<STRUCTURE_V2_MIN_SAMPLE)continue;
    const cap=Math.min(STRUCTURE_V2_MAX_ADJUST,n>=100?8:n>=50?5:3),smooth=Number(stats.smoothedHitRate??50),raw=(smooth-55)*.16,adjustment=clamp(Math.round(raw),-cap,cap);
    return {active:true,level,key:keys[level],keys,adjustment,stats};
  }
  return {active:false,level:null,key:null,keys,adjustment:0,stats:{sample:0,wins:0,losses:0,hitRate:null,smoothedHitRate:null}};
}
function structureV2Assess(t,{rows5=[],rows15=[],rows30=[],rows1h=[],t5=null,t15=null,t30=null,t1h=null,deriv=null,micro=null,market=null}={}){
  const dir=structureV2Dir(t),last=rows5.at(-1),prev=rows5.at(-2),last15=rows15.at(-1),prev15=rows15.at(-2),last30=rows30.at(-1),px=finiteMetric(t?.livePrice)??finiteMetric(last?.close),orig=finiteMetric(t?.setup?.invalidation),protection=finiteMetric(t?.structureProtection)??finiteMetric(t?.stop)??orig,poc=finiteMetric(t?.setup?.poc15),atr5=Math.max(0,finiteMetric(t?.setup?.atr5)??finiteMetric(t5?.atr14)??0),atr15=Math.max(0,finiteMetric(t?.setup?.atr15)??finiteMetric(t15?.atr14)??0),retracement=structureV2Retracement(t,px),bucket=structureV2RetrBucket(retracement),assetClass=structureV2AssetClass(t?.symbol);
  const protected15=structureV2ProtectedSwing(rows15,dir),protected30=structureV2ProtectedSwing(rows30,dir),primary15=protected15??orig,primary30=protected30??primary15;
  const deep=Number.isFinite(retracement)&&retracement>=.618,veryDeep=Number.isFinite(retracement)&&retracement>=.786;
  const break5=protection!=null&&last?structureV2Beyond(dir,last.close,protection):false,two5=break5&&prev&&structureV2Beyond(dir,prev.close,protection);
  const softOrigBreak=orig!=null&&last15?structureV2Beyond(dir,last15.close,orig):false;
  const break15=primary15!=null&&last15?structureV2Beyond(dir,last15.close,primary15):softOrigBreak,two15=break15&&prev15&&structureV2Beyond(dir,prev15.close,primary15??orig);
  const break30=primary30!=null&&last30?structureV2Beyond(dir,last30.close,primary30):false;
  const wickSweep=primary15!=null&&last?(dir>0?Number(last.low)<primary15&&Number(last.close)>=primary15:Number(last.high)>primary15&&Number(last.close)<=primary15):false;
  const reclaim5=protection!=null&&last&&structureV2Inside(dir,last.close,protection)&&((prev&&structureV2Beyond(dir,prev.close,protection))||(dir>0?Number(last.low)<protection:Number(last.high)>protection));
  const reclaim15=primary15!=null&&last15&&structureV2Inside(dir,last15.close,primary15)&&((prev15&&structureV2Beyond(dir,prev15.close,primary15))||(dir>0?Number(last15.low)<primary15:Number(last15.high)>primary15));
  const pocLost=poc!=null&&last?structureV2Beyond(dir,last.close,poc):false,pocReclaim=poc!=null&&last&&structureV2Inside(dir,last.close,poc)&&prev&&structureV2Beyond(dir,prev.close,poc);
  const adverse30=t30?(dir>0?(t30.trend<0&&t30.momentum<=0):(t30.trend>0&&t30.momentum>=0)):false,adverse1h=t1h?(dir>0?(t1h.trend<0&&t1h.momentum<=0):(t1h.trend>0&&t1h.momentum>=0)):false,adverse15=t15?(dir>0?(t15.trend<0||(Number(t15.adx14)>=24&&Number(t15.diBias)<0)):(t15.trend>0||(Number(t15.adx14)>=24&&Number(t15.diBias)>0))):false;
  const marketOpposed=market?.dir!==0&&market?.dir!==dir,taker=finiteMetric(deriv?.takerRatio),depth=finiteMetric(micro?.depthImbalance),supportTaker=taker!=null?(dir>0?taker>=.99:taker<=1.01):false,supportDepth=depth!=null?(dir>0?depth>=-.02:depth<=.02):false,support15=!adverse15,support30=!adverse30,support1h=!adverse1h,supportMarket=!marketOpposed,trader=structureV2TraderContext(t),traderHeld=trader.heldNow===true,traderAdd=trader.lastAddAgeMin!=null&&trader.lastAddAgeMin<=120,traderReduce=trader.lastReduceAgeMin!=null&&trader.lastReduceAgeMin<=90,traderClose=trader.lastCloseAgeMin!=null&&trader.lastCloseAgeMin<=90;
  const supportCount=[supportTaker,supportDepth,support15,support30,support1h,supportMarket,traderHeld,traderAdd].filter(Boolean).length;
  const severeBreak=primary15!=null&&atr15>0&&last15?structureV2Beyond(dir,last15.close,primary15-dir*atr15*.55):false;
  const nearProtected=primary15!=null&&atr15>0&&px!=null?Math.abs(px-primary15)<=atr15*.55:false;
  const failedReclaim=break15&&!reclaim15&&!reclaim5;
  // DESTROYED needs acceptance, not a touch: protected 15m swing + 30m/1h agreement or a severe accepted break.
  const destroyed=(two15&&!reclaim15&&(break30||adverse1h)&&supportCount<=3)||(severeBreak&&break30&&adverse1h&&!reclaim15);
  const pattern=structureV2Pattern({deep,veryDeep,wickSweep,reclaim15,break15,two15,break30,pocLost,pocReclaim});
  let health=86;
  if(deep)health-=5;if(veryDeep)health-=6;if(pocLost)health-=4;if(two5)health-=5;if(softOrigBreak)health-=5;if(break15)health-=14;if(two15)health-=18;if(break30)health-=12;if(adverse15)health-=6;if(adverse30)health-=8;if(adverse1h)health-=10;if(marketOpposed)health-=4;if(failedReclaim)health-=6;
  if(wickSweep)health+=8;if(reclaim5)health+=7;if(reclaim15)health+=11;if(pocReclaim)health+=4;if(supportCount>=5)health+=5;if(traderHeld)health+=1;if(traderAdd)health+=3;if(traderReduce)health-=2;if(traderClose)health-=4;
  let rawState=destroyed?'DESTROYED':deep&&(wickSweep||reclaim5||reclaim15||nearProtected||traderAdd)&&supportCount>=3&&!break30&&!adverse1h?'OPPORTUNITY':(break15||two5||pocLost||deep||softOrigBreak)&&(reclaim5||reclaim15||pocReclaim)?'RECLAIMING':(break15||two5||pocLost||deep||softOrigBreak||adverse30||adverse1h)?'DAMAGED':'INTACT';
  const learning=structureV2Learn(t,rawState,bucket,assetClass,pattern);health=clamp(Math.round(health+Number(learning.adjustment||0)),0,100);
  let state=rawState;
  // Learning may refine only a borderline non-destroyed state. It can never resurrect confirmed destruction.
  if(rawState==='DAMAGED'&&deep&&learning.active&&learning.adjustment>=4&&(reclaim5||reclaim15||wickSweep||nearProtected)&&supportCount>=3)state='OPPORTUNITY';
  if(rawState==='OPPORTUNITY'&&learning.active&&learning.adjustment<=-4)state='RECLAIMING';
  const labels={INTACT:'完整',DAMAGED:'受損',RECLAIMING:'收復中',OPPORTUNITY:'深回踩機會',DESTROYED:'徹底破壞'},actions={INTACT:'結構正常，依原策略等進場區/確認',DAMAGED:'結構受損但未死，先等收復；不是直接判失效',RECLAIMING:'正在收復關鍵結構，等5分/15分收盤確認',OPPORTUNITY:'深回踩但主結構未確認破壞；確認收復後可視為較便宜的候選進場',DESTROYED:'15/30/60分已接受結構破壞，不進場'};
  const codes=[];if(deep)codes.push('DEEP_PULLBACK');if(veryDeep)codes.push('VERY_DEEP');if(wickSweep)codes.push('WICK_SWEEP');if(reclaim5)codes.push('RECLAIM_5M');if(reclaim15)codes.push('RECLAIM_15M');if(pocLost)codes.push('POC_LOST');if(pocReclaim)codes.push('POC_RECLAIM');if(softOrigBreak)codes.push('SOFT_INVALIDATION_BREACH');if(break15)codes.push('PROTECTED_SWING_15M_BREAK');if(two15)codes.push('BREAK_15M_X2');if(break30)codes.push('PROTECTED_SWING_30M_BREAK');if(adverse1h)codes.push('ADVERSE_1H');if(marketOpposed)codes.push('MARKET_OPPOSED');if(traderHeld)codes.push('CORE_TRADER_STILL_HOLDING');if(traderAdd)codes.push('CORE_TRADER_ADD_RECENT');if(traderReduce)codes.push('CORE_TRADER_REDUCE_RECENT');if(destroyed)codes.push('CONFIRMED_DESTROY');
  const reasons=[];if(wickSweep)reasons.push('掃過保護位但收盤收回');if(reclaim15)reasons.push('15分重新收復受保護 swing');else if(reclaim5)reasons.push('5分正在收復保護結構');if(deep)reasons.push(veryDeep?'回踩超過 0.786，但深回踩本身不等於失效':'回踩進入 0.618 深區');if(pocLost&&!pocReclaim)reasons.push('POC 暫時失守，只列弱化證據');if(two15)reasons.push('連續兩根15分收盤破受保護 swing');if(break30)reasons.push('30分也接受在破壞側');if(adverse1h)reasons.push('1H 高週期同步逆向');if(traderHeld&&!destroyed)reasons.push('核心交易員目前仍持有同方向，僅作弱佐證');if(traderAdd&&!destroyed)reasons.push('核心交易員近期仍加碼，僅作弱佐證');if(traderReduce&&!destroyed)reasons.push('核心交易員近期減碼，風險升高但不直接判死');if(supportCount>=4&&!destroyed)reasons.push('高週期/資金/深度多數仍支持原方向');
  const dataPct=Number(t?.dataHealth?.confidencePct),confidence=Number.isFinite(dataPct)?clamp(Math.round(dataPct*(learning.active?1:.92)),0,100):null;
  const episodeBucket=Math.floor(Date.now()/(15*60*1000)),marketEpisodeId=[assetClass,String(market?.regime||t?.marketRegime||'UNKNOWN'),String(t?.direction||'LONG'),episodeBucket].join('|');
  return {version:STRUCTURE_ENGINE_VERSION,at:new Date().toISOString(),state,rawState,label:labels[state],health,confidence,action:actions[state],hardInvalid:state==='DESTROYED',assetClass,pattern,marketEpisodeId,retracementRatio:Number.isFinite(retracement)?Number(retracement.toFixed(3)):null,retracementPct:Number.isFinite(retracement)?Number((retracement*100).toFixed(1)):null,retracementBucket:bucket,reasonCodes:codes,reasons:reasons.slice(0,7),learning,trader,levels:{originalInvalidation:orig,protection,poc15:poc,protectedSwing15:protected15,protectedSwing30:protected30,primary15,primary30},evidence:{deep,veryDeep,wickSweep,reclaim5,reclaim15,pocLost,pocReclaim,softOrigBreak,break5,two5,break15,two15,break30,adverse15,adverse30,adverse1h,marketOpposed,nearProtected,severeBreak,supportCount}};
}
function structureV2Finalize(rec,outcome,at=Date.now(),extra={}){
  if(!rec||rec.status!=='ACTIVE')return;rec.status='RESOLVED';rec.outcome=outcome;rec.outcomeAt=new Date(at).toISOString();rec.learningEligible=!['AMBIGUOUS','TIMEOUT','STATE_TRANSITION'].includes(outcome);Object.assign(rec,extra);structureLearningRevision++;scheduleStructureLearningSave();
}
function structureV2OutcomeLevels(t,a,price){
  const dir=structureV2Dir(t),atr5=Math.max(0,finiteMetric(t?.setup?.atr5)??0),atr15=Math.max(0,finiteMetric(t?.setup?.atr15)??0),anchor=Number(price),primary=finiteMetric(a?.levels?.primary15)??finiteMetric(a?.levels?.originalInvalidation)??anchor;
  const successMove=Math.max(atr5*.90,atr15*.28,anchor*.0012),failureMove=Math.max(atr15*.55,atr5*1.35,anchor*.0018);
  const successPrice=anchor+dir*successMove,failurePrice=primary-dir*failureMove;
  return {atr5AtEntry:atr5,atr15AtEntry:atr15,successMove,successPrice,failureMove,failurePrice,primaryLevel:primary};
}
function structureV2NewRecord(t,a,price){
  const now=new Date().toISOString(),strategy=t?.strategyAtConfirm||t?.strategyProfile||{},keys=structureV2Keys(t,a.rawState,a.retracementBucket,a.assetClass,a.pattern),id='structure-'+Date.now()+'-'+Math.random().toString(36).slice(2,9),levels=structureV2OutcomeLevels(t,a,price);
  const rec={id,version:STRUCTURE_ENGINE_VERSION,at:now,signalKey:t.key,symbol:t.symbol,direction:t.direction,assetClass:a.assetClass,pattern:a.pattern,marketEpisodeId:a.marketEpisodeId,strategyId:strategy.id||null,strategyLabel:strategy.label||null,marketRegime:t.marketRegime||null,state:a.state,rawState:a.rawState,label:a.label,rawHealth:Number(a.health)-Number(a.learning?.adjustment||0),learningAdjustment:Number(a.learning?.adjustment||0),health:a.health,confidence:a.confidence,retracementRatio:a.retracementRatio,retracementBucket:a.retracementBucket,reasonCodes:a.reasonCodes,reasons:a.reasons,keys,price,entryPrice:finiteMetric(t.confirmationPrice),originalTradeTarget:finiteMetric(t.target1R),originalTradeStop:finiteMetric(t.stop),originalInvalidation:a.levels?.originalInvalidation??null,protection:a.levels?.protection??null,poc15:a.levels?.poc15??null,protectedSwing15:a.levels?.protectedSwing15??null,protectedSwing30:a.levels?.protectedSwing30??null,...levels,traderAtEntry:a.trader||null,traderLastAction:null,traderAddsDuringEpisode:0,traderReducesDuringEpisode:0,status:'ACTIVE',outcome:null,outcomeAt:null,learningEligible:true,lastPrice:price,lastAt:now,lastState:a.state,transitions:[],maxFavorablePct:0,maxAdversePct:0};
  structureLearning.unshift(rec);t.structureV2RecordId=id;t.structureV2RecordState=a.state;t.structureV2RecordAt=now;structureLearningRevision++;scheduleStructureLearningSave();return rec;
}
function structureV2Observe(t,a,{rows5=[]}={}){
  const last=rows5.at(-1),px=finiteMetric(t?.livePrice)??finiteMetric(last?.close);if(!(px>0)||!a)return;
  let rec=structureLearning.find(x=>x.id===t.structureV2RecordId&&x.status==='ACTIVE')||null;
  if(rec){
    const dir=structureV2Dir(t),anchor=finiteMetric(rec.price),fav=anchor>0?dir*(px-anchor)/anchor*100:0;rec.lastPrice=px;rec.lastAt=new Date().toISOString();rec.maxFavorablePct=Number(Math.max(Number(rec.maxFavorablePct||0),fav).toFixed(4));rec.maxAdversePct=Number(Math.max(Number(rec.maxAdversePct||0),-fav).toFixed(4));
    const trader=structureV2TraderContext(t),prevTraderAction=String(rec.traderLastAction||''),nowTraderAction=String(trader.lastAction||'');if(nowTraderAction&&nowTraderAction!==prevTraderAction){if(nowTraderAction==='ADD')rec.traderAddsDuringEpisode=Number(rec.traderAddsDuringEpisode||0)+1;if(nowTraderAction==='REDUCE')rec.traderReducesDuringEpisode=Number(rec.traderReducesDuringEpisode||0)+1;rec.traderLastAction=nowTraderAction;rec.traderLastActionAt=trader.lastActionAt||null;}
    const successPrice=finiteMetric(rec.successPrice),failurePrice=finiteMetric(rec.failurePrice),hitSuccess=successPrice!=null?(dir>0?px>=successPrice:px<=successPrice):false,hitFailure=failurePrice!=null?(dir>0?px<=failurePrice:px>=failurePrice):false,reclaimed=finiteMetric(rec.primaryLevel)!=null?structureV2Inside(dir,px,rec.primaryLevel):false;
    if(rec.state==='DESTROYED'){
      if(a.state!=='DESTROYED'&&reclaimed&&hitSuccess){structureV2Finalize(rec,'FALSE_INVALIDATION',Date.now(),{resolvedState:a.state});rec=null}
      else if(hitFailure||a.state==='DESTROYED'&&Number(rec.maxAdversePct||0)>=Math.max(.10,Math.abs(Number(rec.failureMove||0))/Math.max(1e-9,anchor)*100*.8)){structureV2Finalize(rec,'TRUE_INVALIDATION',Date.now(),{resolvedState:a.state});rec=null}
    }else{
      if(a.state==='DESTROYED'){structureV2Finalize(rec,rec.state==='OPPORTUNITY'?'DEEP_PULLBACK_FAILED':'STRUCTURE_FAILED',Date.now(),{resolvedState:a.state});rec=null}
      else if(hitFailure&&a.state==='DAMAGED'){structureV2Finalize(rec,rec.state==='OPPORTUNITY'?'DEEP_PULLBACK_FAILED':'STRUCTURE_FAILED',Date.now(),{resolvedState:a.state});rec=null}
      else if(hitSuccess){const o=rec.state==='OPPORTUNITY'?'DEEP_PULLBACK_SUCCESS':rec.state==='RECLAIMING'||rec.state==='DAMAGED'?'RECLAIM_SUCCESS':'STRUCTURE_HELD';structureV2Finalize(rec,o,Date.now(),{resolvedState:a.state});rec=null}
    }
    if(rec&&rec.lastState!==a.state){rec.transitions=Array.isArray(rec.transitions)?rec.transitions:[];rec.transitions.push({at:new Date().toISOString(),from:rec.lastState,to:a.state,health:a.health});rec.transitions=rec.transitions.slice(-20);rec.lastState=a.state;}
    if(rec&&Date.now()-new Date(rec.at||0).getTime()>=STRUCTURE_V2_HORIZON_MS){structureV2Finalize(rec,'TIMEOUT');rec=null}
  }
  if(!rec){
    const lastAt=t.structureV2RecordAt?new Date(t.structureV2RecordAt).getTime():0,same=String(t.structureV2RecordState||'')===String(a.state);
    if(!(same&&Number.isFinite(lastAt)&&Date.now()-lastAt<STRUCTURE_V2_EPISODE_MS))structureV2NewRecord(t,a,px);
  } else scheduleStructureLearningSave();
}
async function structureV2MaybeNotify(t,a){
  if(!a||!['OPPORTUNITY','RECLAIMING'].includes(a.state))return {sent:0,skipped:true};
  if(a.state==='RECLAIMING'&&!a.evidence?.deep&&!a.evidence?.veryDeep)return {sent:0,skipped:true};
  const health=Number(a.health||0),confidence=Number(a.confidence||0),spread=finiteMetric(t?.lastCheck?.spreadBps),adl=String(t?.lastCheck?.adlRisk||'unknown').toLowerCase(),crowded=t?.lastCheck?.fundingCrowded===true;
  if(health<STRUCTURE_V2_NOTIFY_MIN_HEALTH||confidence<STRUCTURE_V2_NOTIFY_MIN_CONFIDENCE||adl==='high'||crowded||(spread!=null&&spread>TEST_SIGNAL_MAX_SPREAD_BPS))return {sent:0,skipped:true};
  t.structureV2Alerts=t.structureV2Alerts&&typeof t.structureV2Alerts==='object'?t.structureV2Alerts:{};
  const k=a.state+':'+a.retracementBucket,last=new Date(t.structureV2Alerts[k]||0).getTime();if(Number.isFinite(last)&&last>0&&Date.now()-last<STRUCTURE_V2_NOTIFY_COOLDOWN_MS)return {sent:0,duplicate:true};
  const tier=health>=80&&confidence>=82&&a.evidence?.reclaim15?'HIGH':'NORMAL',title=(a.state==='OPPORTUNITY'?'🟡 ':'🔄 ')+t.symbol+'｜'+a.label+'｜非進場確認',body='結構 '+Math.round(health)+'｜'+(a.reasons||[]).slice(0,2).join(' · ')+'｜等5/15分收復/策略確認';
  const delivery=await sendPush({title,body,tag:'structure-v21-'+t.symbol+'-'+t.direction+'-'+a.state+'-'+Date.now(),renotify:true,data:{url:testMonitorRoute(t)}},{testSignal:true,testSignalTier:tier,shadowDedup:true,symbol:t.symbol,direction:t.direction});
  if(delivery.sent>0)t.structureV2Alerts[k]=new Date().toISOString();
  return {tier,...delivery};
}
function structureV2Summary(){
  const all=structureLearning.filter(x=>x?.version===STRUCTURE_ENGINE_VERSION),resolved=all.filter(x=>x.status==='RESOLVED'),effective=structureV2EffectiveRows(),states={},patterns={},assets={};for(const x of all){states[x.state]=(states[x.state]||0)+1;patterns[x.pattern||'NA']=(patterns[x.pattern||'NA']||0)+1;assets[x.assetClass||'NA']=(assets[x.assetClass||'NA']||0)+1}
  const deep=effective.filter(x=>['DEEP_PULLBACK_SUCCESS','DEEP_PULLBACK_FAILED'].includes(x.outcome)),falseInv=effective.filter(x=>['TRUE_INVALIDATION','FALSE_INVALIDATION'].includes(x.outcome));
  return {version:STRUCTURE_ENGINE_VERSION,records:all.length,active:all.filter(x=>x.status==='ACTIVE').length,resolved:resolved.length,effective:effective.length,minLearningSample:STRUCTURE_V2_MIN_SAMPLE,maxAdjustment:STRUCTURE_V2_MAX_ADJUST,states,patterns,assets,overall:structureV2Stats(effective),deepPullback:{sample:deep.length,success:deep.filter(x=>x.outcome==='DEEP_PULLBACK_SUCCESS').length,successRate:deep.length?Number((deep.filter(x=>x.outcome==='DEEP_PULLBACK_SUCCESS').length/deep.length*100).toFixed(1)):null},invalidation:{sample:falseInv.length,trueInvalid:falseInv.filter(x=>x.outcome==='TRUE_INVALIDATION').length,falseInvalid:falseInv.filter(x=>x.outcome==='FALSE_INVALIDATION').length,falseInvalidRate:falseInv.length?Number((falseInv.filter(x=>x.outcome==='FALSE_INVALIDATION').length/falseInv.length*100).toFixed(1)):null},sourcePolicy:{trader:'Binance Copy BAPI/order_history primary; public mirrors cross-check only',market:'Binance Kline/WS primary; Bybit/OKX explicit fallback'}};
}
function structureV2CsvEscape(v){if(v==null)return'';const x=Array.isArray(v)?v.join('｜'):typeof v==='object'?JSON.stringify(v):String(v);return /[",\n\r]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x}

function testEntryStrategy(t, statusLabel='') {
  const state=String(t?.monitorState||''),status=String(t?.status||''),label=String(statusLabel||testTrackerStatusLabel(t)),structure=t?.structureV2||null;
  if(structure?.state==='DESTROYED'||status==='DROPPED')return '結構徹底破壞，不進場；等新的完整結構重新建立';
  if(structure?.state==='OPPORTUNITY')return '深回踩但主結構未確認破壞；只在收復確認＋建議區間內分批';
  if(structure?.state==='RECLAIMING')return '結構收復中，等5分/15分收盤確認後再進';
  if(structure?.state==='DAMAGED')return '結構受損但未死，先等收復；不要把深回踩直接當失效';
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
/* SHADOW_BOOTCAMP_V2681_20260905
 * "Profit-first" here means positive NET expectancy after costs, not maximum risk.
 * Champion = legacy execution/risk blockers. Challenger = adaptive, walk-forward, recency-weighted Shadow model.
 * Soft alpha/readiness misses may be re-ranked, but formal A/B still requires hard risk safety plus positive net edge.
 */
const SHADOW_BOOTCAMP_VERSION_V2681='V2.6.81';
const SHADOW_BOOTCAMP_AUDIT_FILE_V2681=path.join(DATA_DIR,'shadow-bootcamp-audit-v2681.json');
const SHADOW_BOOTCAMP_HALF_LIFE_H_V2681=48;
const SHADOW_BOOTCAMP_MIN_HISTORY_V2681=120;
const SHADOW_BOOTCAMP_B_P_V2681=.50;
const SHADOW_BOOTCAMP_B_EXP_V2681=.10;
const SHADOW_BOOTCAMP_B_COST_V2681=.05;
const SHADOW_BOOTCAMP_A_P_V2681=.55;
const SHADOW_BOOTCAMP_A_EXP_V2681=.18;
const SHADOW_BOOTCAMP_A_COST_V2681=.03;
const SHADOW_BOOTCAMP_A_PF_V2681=1.25;
const SHADOW_BOOTCAMP_B_PF_V2681=1.15;
const SHADOW_BOOTCAMP_TRAINING_V2681={source:'shadow-performance-v1022-research-2026-09-04.csv',rows:1794,resolved:1749,eligibleResolved:626,window:'2026-08-31..2026-09-04',validation:'walk-forward/no-lookahead',objective:'net expectancy after costs',findings:['舊正式A/B幾乎未生成','舊高分與淨結果未呈正向校準','成本/1R是第一級執行門檻','舊Mentor alpha分數不作新模型硬閘門'],promotionPolicy:'no positive net edge = no formal A/B'};
const SHADOW_BOOTCAMP_CACHE_MS_V2681=20_000;
const shadowBootcampCacheV2681=new Map();
const shadowBootcampAuditMemoV2681=new Map();

function bootcampFiniteV2681(v){const n=Number(v);return Number.isFinite(n)?n:null}
function bootcampClampV2681(v,a,b){return Math.max(a,Math.min(b,Number(v)||0))}
function bootcampBaseV2681(symbol){return String(symbol||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/USDT$/,'').replace(/^1000(?=[A-Z])/,'')}
function bootcampAssetClassV2681(symbol){
  const b=bootcampBaseV2681(symbol),tradfi=new Set(['MSTR','COIN','CRCL','PLTR','NVDA','AAPL','MSFT','AMZN','META','TSLA','GOOGL','GOOG','AVGO','AMD','TSM','NFLX','MU','INTC','SPY','QQQ','IWM','DIA','BITO','SOXL','SOXS','SKHYNIX','SNDK','MVLL','MUU','AXTI','KORU','ZHIPU','DELL','CRDO','HOOD','SMCI','ARM','ALAB','MRVL','LRCX','AMAT','ORCL']);
  if(new Set(['XAU','XAG']).has(b))return 'COMMODITY';
  if(tradfi.has(b))return 'TRADFI';
  try{if(typeof assetClassForSymbolV2612==='function'&&assetClassForSymbolV2612(symbol)==='TRADFI')return 'TRADFI'}catch{}
  return 'CRYPTO';
}
function bootcampSessionV2681(symbol,at=Date.now()){
  const cls=bootcampAssetClassV2681(symbol);
  if(cls==='CRYPTO')return 'CRYPTO_24H';
  if(cls==='COMMODITY')return 'COMMODITY_24H';
  try{if(typeof assetSessionV2612==='function'){const v=String(assetSessionV2612(symbol,at)||'');if(v.startsWith('US_'))return v}}catch{}
  try{
    const d=new Date(at);let parts={};parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
    const wd=String(parts.weekday||''),h=Number(parts.hour||0),m=Number(parts.minute||0),min=h*60+m;if(['Sat','Sun'].includes(wd))return'US_WEEKEND';if(min>=570&&min<960)return'US_REGULAR';if(min>=240&&min<570)return'US_PRE';if(min>=960&&min<1200)return'US_AFTER';return'US_OVERNIGHT';
  }catch{return'US_OTHER'}
}
function bootcampStateTokenV2681(label,key){
  const m=String(label||'').match(new RegExp(key+'\\s+([A-Z]+)','i'));
  return m?String(m[1]).toUpperCase():'NA';
}
function bootcampRowFeaturesV2681(r){
  const sf=r?.stateFeatures&&typeof r.stateFeatures==='object'?r.stateFeatures:{},at=new Date(r?.shadowAt||r?.resultAt||Date.now()).getTime(),assetClass=bootcampAssetClassV2681(r?.symbol),assetSession=bootcampSessionV2681(r?.symbol,at);
  return {
    assetClass,
    assetSession:String(assetSession||'UNKNOWN'),
    strategyLabel:String(r?.strategyLabel||sf.strategyLabel||r?.strategyId||sf.strategyId||'UNKNOWN'),
    regime:String(r?.marketRegime||sf.regime||'UNKNOWN'),
    direction:String(r?.direction||sf.direction||'LONG').toUpperCase()==='SHORT'?'SHORT':'LONG',
    oi:String(sf.oi||bootcampStateTokenV2681(r?.stateLabel,'OI')||'NA').toUpperCase(),
    taker:String(sf.taker||bootcampStateTokenV2681(r?.stateLabel,'Taker')||'NA').toUpperCase(),
    depth:String(sf.depth||bootcampStateTokenV2681(r?.stateLabel,'Depth')||'NA').toUpperCase(),
  };
}
function bootcampTrackerFeaturesV2681(t){
  let sf={};try{sf=typeof stateLearningFeatures==='function'?stateLearningFeatures(t):{}}catch{}
  const strategy=t?.strategyAtConfirm||t?.strategyProfile||{},lc=t?.lastCheck||{},ev=t?.monitorEvidence||lc;
  return {
    assetClass:bootcampAssetClassV2681(t?.symbol),
    assetSession:bootcampSessionV2681(t?.symbol,Date.now()),
    strategyLabel:String(sf.strategyLabel||strategy.label||strategy.id||'UNKNOWN'),
    regime:String(sf.regime||t?.marketRegime||lc.marketRegime||'UNKNOWN'),
    direction:String(t?.direction||sf.direction||'LONG').toUpperCase()==='SHORT'?'SHORT':'LONG',
    oi:String(sf.oi||'NA').toUpperCase(),
    taker:String(sf.taker||'NA').toUpperCase(),
    depth:String(sf.depth||'NA').toUpperCase(),
    weakFlags:Number(ev?.weakFlags||0),
  };
}
function bootcampNetRV2681(r){
  const direct=bootcampFiniteV2681(r?.netR);if(direct!=null)return direct;
  const entry=bootcampFiniteV2681(r?.entryPrice),stop=bootcampFiniteV2681(r?.stop),net=bootcampFiniteV2681(r?.netReturnPct);
  if(entry>0&&stop>0&&net!=null){const riskPct=Math.abs(entry-stop)/entry*100;if(riskPct>0)return net/riskPct}
  const rr=bootcampFiniteV2681(r?.realizedR);if(rr==null)return null;
  const cost=bootcampCostRatioFromLevelsV2681(entry,stop);return rr-(cost==null?0:cost);
}
function bootcampCostRatioFromLevelsV2681(entry,stop){
  entry=bootcampFiniteV2681(entry);stop=bootcampFiniteV2681(stop);if(!(entry>0&&stop>0))return null;
  const riskPct=Math.abs(entry-stop)/entry*100;if(!(riskPct>0))return null;
  const roundTripPct=Number(PERF_ROUND_TRIP_COST_BPS||12)/100;
  return roundTripPct/riskPct;
}
function bootcampCurrentLevelsV2681(t,{reentry=false}={}){
  let zone=null;try{zone=typeof testCurrentEntryZone==='function'?testCurrentEntryZone(t):null}catch{}
  let entry=null;try{entry=bootcampFiniteV2681(typeof realtimeBestPrice==='function'?realtimeBestPrice(t?.symbol):null)}catch{}
  entry=entry??bootcampFiniteV2681(reentry?t?.reentryEntryPrice:t?.confirmationPrice)??(zone?((Number(zone.low)+Number(zone.high))/2):null)??bootcampFiniteV2681(t?.entryPrice);
  const stop=bootcampFiniteV2681(reentry?t?.reentryStop:t?.stop);
  return {entry,stop,costRatio:bootcampCostRatioFromLevelsV2681(entry,stop)};
}
function bootcampHistoryV2681(now=Date.now()){
  let rows=[];try{rows=typeof shadowLearningEffectiveRows==='function'?shadowLearningEffectiveRows():shadowPerformance}catch{rows=shadowPerformance||[]}
  return (Array.isArray(rows)?rows:[]).filter(r=>{
    if(r?.status!=='RESOLVED'||r?.learningEligible===false)return false;
    const resultAt=new Date(r?.resultAt||0).getTime(),net=bootcampNetRV2681(r);
    return Number.isFinite(resultAt)&&resultAt>0&&resultAt<now&&Number.isFinite(net);
  }).slice(0,1800);
}
function bootcampWeightedStatsV2681(rows,predicate,now){
  let sw=0,sw2=0,wins=0,sum=0,profit=0,loss=0,n=0;
  for(const r of rows){
    if(predicate&&!predicate(r))continue;
    const net0=bootcampNetRV2681(r);if(!Number.isFinite(net0))continue;
    const resultAt=new Date(r?.resultAt||0).getTime();if(!(resultAt>0&&resultAt<now))continue;
    const ageH=Math.max(0,(now-resultAt)/3_600_000),revWeight=String(r?.researchRevisionAtEntry||'')==='V10.2.7-R1'?1:.65,w=Math.pow(.5,ageH/SHADOW_BOOTCAMP_HALF_LIFE_H_V2681)*revWeight,net=bootcampClampV2681(net0,-1.5,1.5);
    if(!(w>0))continue;n++;sw+=w;sw2+=w*w;sum+=w*net;if(net>0){wins+=w;profit+=w*net}else if(net<0)loss+=w*(-net);
  }
  if(!(sw>0))return null;
  return {n,neff:sw*sw/Math.max(1e-9,sw2),p:wins/sw,exp:sum/sw,pf:loss>1e-9?profit/loss:(profit>0?99:0)};
}
function bootcampMatchesV2681(rowFeatures,target,cols){
  for(const c of cols)if(String(rowFeatures?.[c]??'UNKNOWN')!==String(target?.[c]??'UNKNOWN'))return false;
  return true;
}
function bootcampWilsonLowV2681(p,n){
  p=bootcampClampV2681(p,.01,.99);n=Math.max(1,Number(n)||1);
  return bootcampClampV2681(p-1.28*Math.sqrt(p*(1-p)/(n+16)),0,1);
}
function bootcampStrengthFailureRiskV2681(t){
  const ev=t?.monitorEvidence||t?.lastCheck||{};let risk=0;
  const weak=Number(ev?.weakFlags||0);if(weak>=2)risk+=.16;if(weak>=4)risk+=.18;
  if(ev?.adverse15===true)risk+=.08;if(ev?.adverse30===true)risk+=.06;if(ev?.adverse1h===true)risk+=.07;if(ev?.adverseMarket===true)risk+=.07;
  if(ev?.belowBreakout2===true)risk+=.24;
  if(ev?.adverseDepth===true)risk+=.08;
  if(ev?.adverseTaker===true)risk+=.08;
  if(ev?.adverseTop===true)risk+=.05;
  if(t?.breakoutAt&&ev?.aboveBreakout2===false)risk+=.12;
  const chase=bootcampFiniteV2681(ev?.chaseAtr??t?.lastCheck?.chaseAtr);if(chase!=null&&chase>.18)risk+=.07;if(chase!=null&&chase>.30)risk+=.10;
  if(String(t?.monitorState||'')==='WEAKENING')risk+=.35;if(String(t?.monitorState||'')==='CONTINUING')risk-=.06;
  return bootcampClampV2681(risk,0,1);
}
function bootcampModelV2681(t,{reentry=false}={}){
  const now=Date.now(),f=bootcampTrackerFeaturesV2681(t),levels=bootcampCurrentLevelsV2681(t,{reentry}),cacheKey=[t?.key||t?.symbol,f.assetClass,f.assetSession,f.strategyLabel,f.regime,f.direction,f.oi,f.taker,f.depth,Math.round(Number(levels.costRatio||9)*100),String(t?.monitorState||''),Number((t?.monitorEvidence||t?.lastCheck||{})?.weakFlags||0)].join('|');
  const cached=shadowBootcampCacheV2681.get(cacheKey);if(cached&&now-cached.at<SHADOW_BOOTCAMP_CACHE_MS_V2681)return cached.value;
  const history=bootcampHistoryV2681(now),global=bootcampWeightedStatsV2681(history,null,now),prior=bootcampWeightedStatsV2681(history,r=>{const x=bootcampRowFeaturesV2681(r);return x.assetClass===f.assetClass&&x.direction===f.direction},now)||global;
  if(!global||!prior){const out={ready:false,history:history.length,p:.5,low:.3,exp:-1,pf:0,support:0,costRatio:levels.costRatio,features:f,strengthFailureRisk:bootcampStrengthFailureRiskV2681(t)};shadowBootcampCacheV2681.set(cacheKey,{at:now,value:out});return out}
  const specs=[
    [['assetClass','assetSession','strategyLabel','regime','direction'],4.0],
    [['assetClass','strategyLabel','regime','direction'],3.4],
    [['assetClass','strategyLabel','direction'],2.8],
    [['strategyLabel','regime','direction'],2.4],
    [['assetClass','regime','direction'],2.0],
    [['assetClass','direction'],1.4],
    [['regime','direction'],1.0],
  ];
  let eNum=0,pNum=0,pfNum=0,wSum=0,support=0;
  for(let i=0;i<specs.length;i++){
    const [cols,factor]=specs[i],st=bootcampWeightedStatsV2681(history,r=>bootcampMatchesV2681(bootcampRowFeaturesV2681(r),f,cols),now);
    if(!st||st.neff<3.5)continue;
    if(i<4)support=Math.max(support,st.neff);
    const shrink=st.neff/(st.neff+5),e=shrink*st.exp+(1-shrink)*prior.exp,p=shrink*st.p+(1-shrink)*prior.p,pf=shrink*Math.min(3,Number(st.pf||0))+(1-shrink)*Math.min(3,Number(prior.pf||0)),w=factor*Math.min(1,st.neff/12);
    eNum+=w*e;pNum+=w*p;pfNum+=w*pf;wSum+=w;
  }
  let exp=wSum>0?eNum/wSum:prior.exp,p=wSum>0?pNum/wSum:prior.p,pf=wSum>0?pfNum/wSum:Number(prior.pf||0);
  for(const c of ['oi','taker','depth']){
    const v=String(f[c]||'NA');if(v==='NA')continue;
    const st=bootcampWeightedStatsV2681(history,r=>String(bootcampRowFeaturesV2681(r)[c]||'NA')===v,now);
    if(st&&st.neff>=8){const sh=st.neff/(st.neff+25);exp+=.30*sh*(st.exp-global.exp);p+=.30*sh*(st.p-global.p)}
  }
  const cost=Number.isFinite(Number(levels.costRatio))?Number(levels.costRatio):9;
  if(cost>.08){exp-=Math.min(1.4,(cost-.08)*1.35);p-=Math.min(.20,(cost-.08)*.16)}
  else if(cost<.03)exp+=Math.min(.035,(.03-cost)*1.2);
    if(f.regime==='UNKNOWN'){exp-=.05;p-=.01}
  const recentPulse=(hours)=>bootcampWeightedStatsV2681(history,r=>{const rt=new Date(r?.resultAt||0).getTime(),rf=bootcampRowFeaturesV2681(r);return rt>now-hours*3_600_000&&rt<now&&rf.assetClass===f.assetClass&&rf.direction===f.direction},now);
  for(const [hours,factor,minN] of [[6,.55,6],[12,.30,10]]){const st=recentPulse(hours);if(st&&st.n>=minN){if(st.exp<-.10){exp+=factor*Math.max(-.45,st.exp);p+=factor*Math.max(-.10,st.p-.5)}else if(st.exp>.10){exp+=factor*.12*Math.min(.35,st.exp);p+=factor*.08*Math.min(.08,st.p-.5)}}}
  const strategyPulse=bootcampWeightedStatsV2681(history,r=>{const rt=new Date(r?.resultAt||0).getTime(),rf=bootcampRowFeaturesV2681(r);return rt>now-12*3_600_000&&rt<now&&rf.assetClass===f.assetClass&&rf.strategyLabel===f.strategyLabel&&rf.direction===f.direction},now);
  if(strategyPulse&&strategyPulse.n>=8&&strategyPulse.exp<-.10){exp+=.30*Math.max(-.35,strategyPulse.exp);p-=.02}
  const failureRisk=bootcampStrengthFailureRiskV2681(t);exp-=failureRisk*.34;p-=failureRisk*.10;
  p=bootcampClampV2681(p,.05,.95);const low=bootcampWilsonLowV2681(p,support||prior.neff||global.neff);
  const out={ready:history.length>=SHADOW_BOOTCAMP_MIN_HISTORY_V2681,history:history.length,p,low,exp,pf,support,costRatio:cost,features:f,strengthFailureRisk:failureRisk,global:{p:global.p,exp:global.exp,pf:global.pf,neff:global.neff},prior:{p:prior.p,exp:prior.exp,pf:prior.pf,neff:prior.neff}};
  shadowBootcampCacheV2681.set(cacheKey,{at:now,value:out});if(shadowBootcampCacheV2681.size>120){const first=shadowBootcampCacheV2681.keys().next().value;shadowBootcampCacheV2681.delete(first)}
  return out;
}
function bootcampDecisionV2681(t,legacy,{reentry=false}={}){
  const inst=legacy?.institutionalEdge&&typeof legacy.institutionalEdge==='object'?legacy.institutionalEdge:null,m=bootcampModelV2681(t,{reentry}),coverage=Number(t?.dataHealth?.coveragePct),confidence=Number(t?.dataHealth?.confidencePct),aMissing=[],bMissing=[];
  const blockers=Array.isArray(legacy?.blockers)?legacy.blockers:[],hardText=blockers.join('｜'),hardReason=/價差>|高波動價差|ADL高風險|Funding擁擠|結構失效|資料完整度<72|資料可信度<65|跨交易所趨勢逆向|清算行情山寨/i.test(hardText);
  const mentorHard=inst?.hardBlock===true;
  if(hardReason||mentorHard)return {tier:'BLOCKED',grade:null,reason:'Champion execution/risk blocker',model:m,aMissing:['硬風控未通過'],bMissing:['硬風控未通過'],institutional:inst||null};
  if(!m.ready){aMissing.push(`訓練樣本<${SHADOW_BOOTCAMP_MIN_HISTORY_V2681}`);bMissing.push(`訓練樣本<${SHADOW_BOOTCAMP_MIN_HISTORY_V2681}`)}
    if(m.support<10)aMissing.push('同型態有效支持<10');if(m.support<8)bMissing.push('同型態有效支持<8');
  if(m.p<SHADOW_BOOTCAMP_A_P_V2681)aMissing.push(`後驗勝率<${Math.round(SHADOW_BOOTCAMP_A_P_V2681*100)}%`);
  if(m.exp<SHADOW_BOOTCAMP_A_EXP_V2681)aMissing.push(`淨期望<+${SHADOW_BOOTCAMP_A_EXP_V2681.toFixed(2)}R`);
  if(m.pf<SHADOW_BOOTCAMP_A_PF_V2681)aMissing.push(`淨PF<${SHADOW_BOOTCAMP_A_PF_V2681.toFixed(2)}`);
  if(m.costRatio>SHADOW_BOOTCAMP_A_COST_V2681)aMissing.push(`成本/1R>${Math.round(SHADOW_BOOTCAMP_A_COST_V2681*100)}%`);
  if(m.strengthFailureRisk>.16)aMissing.push('強轉弱風險>16%');
  if(m.features.regime==='UNKNOWN')aMissing.push('A級需已知市場狀態');
  if(Number.isFinite(coverage)&&coverage<82)aMissing.push('資料完整度<82%');if(Number.isFinite(confidence)&&confidence<78)aMissing.push('資料可信度<78%');
  if(m.p<SHADOW_BOOTCAMP_B_P_V2681)bMissing.push(`後驗勝率<${Math.round(SHADOW_BOOTCAMP_B_P_V2681*100)}%`);
  if(m.exp<SHADOW_BOOTCAMP_B_EXP_V2681)bMissing.push(`淨期望<+${SHADOW_BOOTCAMP_B_EXP_V2681.toFixed(2)}R`);
  if(m.pf<SHADOW_BOOTCAMP_B_PF_V2681)bMissing.push(`淨PF<${SHADOW_BOOTCAMP_B_PF_V2681.toFixed(2)}`);
  if(m.costRatio>SHADOW_BOOTCAMP_B_COST_V2681)bMissing.push(`成本/1R>${Math.round(SHADOW_BOOTCAMP_B_COST_V2681*100)}%`);
  if(m.strengthFailureRisk>.28)bMissing.push('強轉弱風險>28%');
  if(m.features.regime==='UNKNOWN'&&(m.support<10||m.exp<.12))bMissing.push('UNKNOWN需支持>=10且淨期望>=+0.12R');
  if(Number.isFinite(coverage)&&coverage<76)bMissing.push('資料完整度<76%');if(Number.isFinite(confidence)&&confidence<70)bMissing.push('資料可信度<70%');
  // Legacy Mentor alpha gates are observation-only here; exported data showed they were not net-profit calibrated. Only explicit hardBlock above survives as a safety veto.
  const tier=aMissing.length===0?'HIGH':bMissing.length===0?'NORMAL':'VALID',grade=tier==='HIGH'?'A':tier==='NORMAL'?'B':null;
  return {tier,grade,reason:grade?`Challenger ${grade}：淨期望 ${m.exp>=0?'+':''}${m.exp.toFixed(2)}R｜PF ${m.pf.toFixed(2)}｜後驗 ${(m.p*100).toFixed(1)}%`:'Challenger 未達正式A/B',model:m,aMissing,bMissing,institutional:inst?{version:inst.version||null,capA:inst.capA===true,costGateA:inst.costGateA!==false,costGateB:inst.costGateB!==false,forwardStatus:String(inst?.forward?.status||'')||null}:null};
}
function bootcampFinalizeTierV2681(t,legacy,{reentry=false}={}){
  const decision=bootcampDecisionV2681(t,legacy,{reentry});bootcampAuditDecisionV2681(t,decision,legacy);
  const m=decision.model;
  return {...legacy,tier:decision.tier,rate:m?Number((m.p*100).toFixed(1)):legacy.rate,low:m?Number((m.low*100).toFixed(1)):legacy.low,highMissing:decision.aMissing,normalMissing:decision.bMissing,bootcamp:{version:SHADOW_BOOTCAMP_VERSION_V2681,grade:decision.grade,reason:decision.reason,posteriorWinRate:m?Number((m.p*100).toFixed(1)):null,conservativeLow:m?Number((m.low*100).toFixed(1)):null,netExpectancyR:m?Number(m.exp.toFixed(3)):null,netProfitFactor:m?Number(m.pf.toFixed(2)):null,costRatio:m?Number(m.costRatio.toFixed(3)):null,support:m?Number(m.support.toFixed(1)):null,history:m?.history??0,strengthFailureRisk:m?Number(m.strengthFailureRisk.toFixed(3)):null,assetClass:m?.features?.assetClass||null,assetSession:m?.features?.assetSession||null,institutional:decision.institutional||null}};
}
function bootcampAuditReadV2681(){const x=loadJson(SHADOW_BOOTCAMP_AUDIT_FILE_V2681,{events:[]});return x&&typeof x==='object'?x:{events:[]}}
function bootcampAuditAppendV2681(event){
  try{const x=bootcampAuditReadV2681();x.version=SHADOW_BOOTCAMP_VERSION_V2681;x.updatedAt=new Date().toISOString();x.events=Array.isArray(x.events)?x.events:[];x.events.unshift(event);x.events=x.events.slice(0,500);saveJson(SHADOW_BOOTCAMP_AUDIT_FILE_V2681,x)}catch(e){console.warn('[v2681] audit',String(e?.message||e))}
}
function bootcampAuditDecisionV2681(t,decision,legacy){
  try{
    const now=Date.now(),key=[t?.symbol,t?.direction].join('|'),sig=[decision?.tier,decision?.grade,decision?.model?.p?.toFixed?.(3),decision?.model?.exp?.toFixed?.(3),legacy?.tier].join('|'),old=shadowBootcampAuditMemoV2681.get(key);
    if(old&&old.sig===sig&&now-old.at<10*60_000)return;shadowBootcampAuditMemoV2681.set(key,{sig,at:now});
    bootcampAuditAppendV2681({at:new Date(now).toISOString(),kind:'DECISION',symbol:t?.symbol,direction:t?.direction,tier:decision?.tier,grade:decision?.grade,legacyTier:legacy?.tier,reason:decision?.reason,p:decision?.model?.p??null,low:decision?.model?.low??null,netExpR:decision?.model?.exp??null,netProfitFactor:decision?.model?.pf??null,costRatio:decision?.model?.costRatio??null,support:decision?.model?.support??null,strengthFailureRisk:decision?.model?.strengthFailureRisk??null});
  }catch{}
}
function bootcampPushAuditV2681(payload,target,out){
  const formal=target?.testSignal===true,core=['OPEN','ADD','REDUCE','CLOSE'].includes(String(target?.eventType||'').toUpperCase())&&String(target?.traderId||'')===CORE_TRADER_ID;if(!formal&&!core)return;
  bootcampAuditAppendV2681({at:new Date().toISOString(),kind:formal?'FORMAL_SHADOW_PUSH':'CORE_TRADER_PUSH',symbol:target?.symbol||null,direction:target?.direction||null,eventType:String(target?.eventType||''),tier:String(target?.testSignalTier||''),title:String(payload?.title||''),records:Number(out?.records||0),eligible:Number(out?.eligible||0),sent:Number(out?.sent||0),failed:Number(out?.failed||0),filtered:Number(out?.filtered||0),noSubscription:Number(out?.records||0)===0});
}
function bootcampSummaryV2681(){
  const history=bootcampHistoryV2681(Date.now()),audit=bootcampAuditReadV2681();
  return {ok:true,version:SHADOW_BOOTCAMP_VERSION_V2681,mode:'Profit-first Champion + adaptive Challenger',history:history.length,training:SHADOW_BOOTCAMP_TRAINING_V2681,thresholds:{A:{p:SHADOW_BOOTCAMP_A_P_V2681,netExpR:SHADOW_BOOTCAMP_A_EXP_V2681,minPf:SHADOW_BOOTCAMP_A_PF_V2681,maxCostRatio:SHADOW_BOOTCAMP_A_COST_V2681,minSupport:10},B:{p:SHADOW_BOOTCAMP_B_P_V2681,netExpR:SHADOW_BOOTCAMP_B_EXP_V2681,minPf:SHADOW_BOOTCAMP_B_PF_V2681,maxCostRatio:SHADOW_BOOTCAMP_B_COST_V2681,minSupport:8}},recentAudit:(audit.events||[]).slice(0,100)};
}

function testSignalTier(t,{reentry=false}={}) {
  const assetClass=assetClassForSymbolV2612(t?.symbol),tradfi=assetClass==='TRADFI';
  const cal=testCalibratedWinRate(t,{dynamic:true}),rate=Number(cal.rate||0),low=Number(cal.conservativeLow||0);
  const rawScore=Number(reentry?t.reentryScore:(t.monitorScore??t.qualityScore??0)),learning=reentry?{adjustment:0,active:false,stats:{sample:0}}:stateLearningAdjustment(t),score=clamp(Math.round(rawScore+Number(learning.adjustment||0)),0,100),rank=Number(t.rank||99),ev=t.monitorEvidence||t.lastCheck||{};
  const spread=finiteMetric(ev.spreadBps),chaseAtr=finiteMetric(ev.chaseAtr),adlRisk=String(ev.adlRisk||'unknown').toLowerCase(),fundingCrowded=ev.fundingCrowded===true;
  const adverse=!!(ev.adverse15||ev.adverse30||ev.adverse1h||ev.adverseMarket);
  const noSpreadRisk=!Number.isFinite(spread)||spread<=TEST_SIGNAL_MAX_SPREAD_BPS;
  const noChase=!Number.isFinite(chaseAtr)||chaseAtr<=TEST_SIGNAL_FIRST_MAX_CHASE_ATR;
  const blockers=[];
  if(ev.adverse15)blockers.push('15分逆向');
  if(ev.adverse30)blockers.push('30分逆向');
  if(ev.adverse1h)blockers.push('1小時逆向');
  if(ev.adverseMarket)blockers.push(tradfi?'美股大盤逆向':'BTC/ETH大盤逆向');
  if(!noSpreadRisk)blockers.push(`價差>${TEST_SIGNAL_MAX_SPREAD_BPS}bps`);
  if(!noChase)blockers.push(`距離回踩區>${TEST_SIGNAL_FIRST_MAX_CHASE_ATR.toFixed(2)}ATR`);
  if(adlRisk==='high')blockers.push('ADL高風險');
  if(fundingCrowded)blockers.push('Funding擁擠');
  if(t.status==='DROPPED'||t?.structureV2?.state==='DESTROYED')blockers.push('結構徹底破壞');
  const coverage=Number(t.dataHealth?.coveragePct),dataConfidence=Number(t.dataHealth?.confidencePct),sources=t.dataHealth?.sources||{},cross=t.dataHealth?.crossExchange||{},dir=testSignalDirection(t.direction);
  if(Number.isFinite(coverage)&&coverage<72)blockers.push('資料完整度<72%');
  if(Number.isFinite(dataConfidence)&&dataConfidence<65)blockers.push('資料可信度<65%');
  if(!tradfi&&Number(cross?.available||0)>0&&Number(cross?.consensus||0)===-dir)blockers.push('跨交易所趨勢逆向');
  const regime=String(t.marketRegime||ev.marketRegime||'NORMAL');
  if(!tradfi&&regime==='LIQUIDATION'&&!['BTCUSDT','ETHUSDT'].includes(t.symbol)&&score<90)blockers.push('清算行情山寨品質<90');
  if(['LIQUIDATION','HIGH_VOL'].includes(regime)&&Number.isFinite(spread)&&spread>8)blockers.push('高波動價差>8bps');
  const institutional=institutionalMentorEdgeV2622(t);for(const b of institutional.hardBlockReasons||[])if(!blockers.includes(b))blockers.push(b);
  const hardSafe=blockers.length===0;
  const highMissing=[];
  if(institutional.edgeScore<SHADOW_EDGE_A_MIN_V2621)highMissing.push(`Edge<${SHADOW_EDGE_A_MIN_V2621}`);
  if(!institutional.costGateA)highMissing.push(`成本/停損比>${SHADOW_EDGE_A_COST_RATIO_V2621.toFixed(2)}`);
  if(institutional.capA)highMissing.push('機構Edge封頂B');
  if(t?.structureV2?.state==='DAMAGED')highMissing.push('結構受損待收復');
  if(t?.structureV2?.state==='RECLAIMING')highMissing.push('結構收復中');
  if(Number.isFinite(coverage)&&coverage<90)highMissing.push('資料完整度<90%');
  if(Number.isFinite(dataConfidence)&&dataConfidence<86)highMissing.push('資料可信度<86%');
  for(const k of ['k5','k15','k30','h1','oi15','oi1h','taker','depth','funding','mark','market','backtest'])if(sources[k]!==true)highMissing.push(`關鍵資料缺:${k}`);
  if(!tradfi&&!(sources.topPos===true||sources.topAccount===true))highMissing.push('關鍵資料缺:大戶');
  if(rate<TEST_SIGNAL_HIGH_RATE)highMissing.push(`校準勝率<${TEST_SIGNAL_HIGH_RATE}%`);
  if(low<50)highMissing.push('保守下界<50%');
  if(score<TEST_SIGNAL_HIGH_SCORE)highMissing.push(`品質<${TEST_SIGNAL_HIGH_SCORE}`);
  if(rank>6)highMissing.push('市場熱度排名>6');
  if(Number.isFinite(chaseAtr)&&chaseAtr>TEST_SIGNAL_HIGH_MAX_CHASE_ATR)highMissing.push(`追價>${TEST_SIGNAL_HIGH_MAX_CHASE_ATR.toFixed(2)}ATR`);
  if(regime==='CHOP'&&score<90)highMissing.push('震盪行情品質<90');
  if(['LIQUIDATION','HIGH_VOL'].includes(regime)&&(coverage<95||dataConfidence<90))highMissing.push('高波動需完整度95/可信度90');
  const normalMissing=[];
  if(institutional.edgeScore<SHADOW_EDGE_B_MIN_V2621)normalMissing.push(`Edge<${SHADOW_EDGE_B_MIN_V2621}`);
  if(!institutional.costGateB)normalMissing.push(`成本/停損比>${SHADOW_EDGE_B_COST_RATIO_V2621.toFixed(2)}`);
  if(Number.isFinite(coverage)&&coverage<80)normalMissing.push('資料完整度<80%');
  if(Number.isFinite(dataConfidence)&&dataConfidence<76)normalMissing.push('資料可信度<76%');
  for(const k of ['k5','k15','k30','h1','depth','mark','market','backtest'])if(sources[k]!==true)normalMissing.push(`關鍵資料缺:${k}`);
  if(!(sources.oi===true||sources.taker===true))normalMissing.push('OI/主動資金皆缺');
  if(rate<TEST_SIGNAL_NORMAL_RATE)normalMissing.push(`校準勝率<${TEST_SIGNAL_NORMAL_RATE}%`);
  if(low<43)normalMissing.push('保守下界<43%');
  if(score<TEST_SIGNAL_NORMAL_SCORE)normalMissing.push(`品質<${TEST_SIGNAL_NORMAL_SCORE}`);
  if(rank>9)normalMissing.push('市場熱度排名>9');
  if(regime==='CHOP'&&score<84)normalMissing.push('震盪行情品質<84');
  if(!tradfi&&regime==='LIQUIDATION'&&!['BTCUSDT','ETHUSDT'].includes(t.symbol))normalMissing.push('清算行情山寨只允許最高級確認');
  if(!hardSafe)return bootcampFinalizeTierV2681(t,{tier:'BLOCKED',rate,low,rawScore,score,learningAdjustment:Number(learning.adjustment||0),learning,institutionalEdge:institutional,rank,blockers,highMissing,normalMissing},{reentry});
  if(highMissing.length===0)return bootcampFinalizeTierV2681(t,{tier:'HIGH',rate,low,rawScore,score,learningAdjustment:Number(learning.adjustment||0),learning,institutionalEdge:institutional,rank,blockers,highMissing,normalMissing},{reentry});
  if(normalMissing.length===0)return bootcampFinalizeTierV2681(t,{tier:'NORMAL',rate,low,rawScore,score,learningAdjustment:Number(learning.adjustment||0),learning,institutionalEdge:institutional,rank,blockers,highMissing,normalMissing},{reentry});
  return bootcampFinalizeTierV2681(t,{tier:'VALID',rate,low,rawScore,score,learningAdjustment:Number(learning.adjustment||0),learning,institutionalEdge:institutional,rank,blockers,highMissing,normalMissing},{reentry});
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
  const entryType=code==='CONFIRMED'||(options.reentry&&String(options.statusLabel||'').includes('二次確認'));
  if(!entryType){t.lifecycleNotifications[code]=new Date().toISOString();return {processed:true,filteredPolicy:true,sent:0,tier,reason:'V2611_ENTRY_ONLY'};}
  if(!['HIGH','NORMAL'].includes(tier))return {processed:false,blocked:true,sent:0,tier,reason:'V2611_HIGH_NORMAL_ONLY'};
  if(entryType&&TEST_ENTRY_DEBOUNCE_MS>0){await new Promise(r=>setTimeout(r,TEST_ENTRY_DEBOUNCE_MS));const px=finiteMetric(realtimeBestPrice(t.symbol)),stop=finiteMetric(options.reentry?t.reentryStop:t.stop),zone=testCurrentEntryZone(t),atr=finiteMetric(t.setup?.atr5);if(px!=null&&stop!=null){const dir=testSignalDirection(t.direction),target=finiteMetric(options.reentry?t.reentryTarget1R:t.target1R),invalid=dir>0?px<=stop:px>=stop;if(invalid)return {processed:false,blocked:true,sent:0,tier,reason:'debounce-invalidated'};if(target!=null){const passed=dir>0?px>=target:px<=target,rr=dir*(target-px)/Math.max(1e-12,Math.abs(px-stop));if(passed||rr<.85)return {processed:false,blocked:true,sent:0,tier,reason:passed?'debounce-target-passed':'debounce-rr-degraded'};}}if(px!=null&&zone&&atr>0){const dist=t.direction==='LONG'?Math.max(0,px-Number(zone.high)):Math.max(0,Number(zone.low)-px);if(dist/atr>TEST_SIGNAL_FIRST_MAX_CHASE_ATR)return {processed:false,blocked:true,sent:0,tier,reason:'debounce-chased'};}}
    const {body}=testLifecycleMessage(t,explicitTitle,explicitBody,options.statusLabel||'');const grade=shadowGradeV2616(tier);if(!entryType||!grade){t.lifecycleNotifications[code]=new Date().toISOString();return {processed:true,filteredPolicy:true,sent:0,tier,reason:'V2616_AB_ENTRY_ONLY'}};const title=`自動影子｜${grade}級｜${t.symbol} ${t.direction==='SHORT'?'做空':'做多'}`;
  const noticeId=`notice-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,noticeSentAt=new Date().toISOString(),noticeSnapshot=realtimeSnapshot(t.symbol),noticeEntryPrice=finiteMetric(realtimeBestPrice(t.symbol))??finiteMetric(options.reentry?t.reentryEntryPrice:t.confirmationPrice),noticeZone=testCurrentEntryZone(t),noticePreferredZone=testPreferredEntryZone(t),noticeStop=finiteMetric(options.reentry?t.reentryStop:t.stop),noticeTarget=finiteMetric(options.reentry?t.reentryTarget1R:t.target1R),route=testMonitorRoute(t),sep=route.includes('?')?'&':'?';
  const pushStarted=Date.now();
  const delivery=await sendPush({title,body,tag:`shadow-${t.symbol}-${t.direction}`,renotify:false,data:{url:`${route}${sep}notice=${encodeURIComponent(noticeId)}`,noticeId,serverSentAt:noticeSentAt}},{testSignal:true,testSignalTier:tier});
  const pushAcceptedAt=new Date().toISOString(),pushServiceMs=Date.now()-pushStarted;
  // 被使用者通知模式過濾＝事件已處理；若本來符合推播但傳送失敗，保留下一輪重試機會。
  if(delivery.sent>0||(Number(delivery.records||0)>0&&delivery.eligible===0))t.lifecycleNotifications[code]=new Date().toISOString();
  t.lastPushAttemptAt=new Date().toISOString();t.lastPushTier=tier;t.lastPushDelivery={...delivery,pushServiceMs};
  if(delivery.sent>0){
    if(entryType){t.lastEntryNotificationAt=noticeSentAt;t.lastEntryNotificationId=noticeId;t.lastEntryNotificationTier=tier;t.lastEntryNotificationPhase=options.reentry?'REENTRY':'FIRST_ENTRY';t.lastEntryNotificationPrice=noticeEntryPrice??null;t.lastEntryNotificationZoneLow=finiteMetric(noticeZone?.low);t.lastEntryNotificationZoneHigh=finiteMetric(noticeZone?.high);t.lastEntryNotificationPreferredLow=finiteMetric(noticePreferredZone?.low);t.lastEntryNotificationPreferredHigh=finiteMetric(noticePreferredZone?.high);t.lastEntryNotificationStop=noticeStop??null;t.lastEntryNotificationTarget=noticeTarget??null;}
    shadowMarkNotified(t,noticeId,tier);performanceRecordForNotification(t,code,tier,delivery,{...options,noticeId,noticeSentAt,noticeSnapshot,noticeEntryPrice,pushAcceptedAt,pushServiceMs});
  }
  return {processed:delivery.sent>0||(Number(delivery.records||0)>0&&delivery.eligible===0),tier,pushServiceMs,...delivery};
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
  if(t?.structureV2?.state==='DESTROYED'&&hard15&&(evidence.adverse30||evidence.adverse1h||evidence.adverseMarket)){
    return testDropTracker(t,{reason:'Structure V2：15分連續收破＋高週期確認，原始結構徹底破壞',last,dir,entry});
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
    if(t?.structureV2?.state==='DESTROYED')return testDropTracker(t,{reason:'Structure V2：收復期限後仍為徹底破壞',last,dir,entry});
    // Keep recoverable structure alive; the timer is not evidence of destruction.
    t.reactivateUntil=new Date(Date.now()+TEST_MONITOR_REACTIVATE_MS).toISOString();
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
  if(t?.structureV2?.state==='DESTROYED'){
    return testEnterInvalidation(t,{reason:'STRUCTURE_V2_DESTROYED',last,protection:t.structureV2?.levels?.originalInvalidation??protection,entry,dir});
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
    if(t?.structureV2?.state==='DESTROYED'){
      return testDropTracker(t,{reason:'Structure V2：高週期結構確認徹底破壞',last,dir,entry});
    }
    // DAMAGED / RECLAIMING / OPPORTUNITY are kept alive; elapsed time alone is not structural invalidation.
    if(weakAge>=TEST_MONITOR_WEAK_MAX_MS&&t?.structureV2?.state==='INTACT'){t.weakSince=new Date().toISOString();}
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
    oi:{source:deriv?._source?.oi||null,error:deriv?._errors?.oi||deriv?._errors?.oiFallback||null},oi15:{source:deriv?._source?.oi||null,error:oi15Ok?null:(deriv?._errors?.oi||deriv?._errors?.oiFallback||'15分鐘 OI 變化缺值')},oi1h:{source:deriv?._source?.oi||null,error:oi1hOk?null:(deriv?._errors?.oi||deriv?._errors?.oiFallback||'1小時 OI 變化缺值')},taker:{source:deriv?._source?.taker||null,error:deriv?._errors?.taker||deriv?._errors?.takerFallback||deriv?._errors?.takerBybitFallback||null},globalLs:{source:deriv?._source?.globalLs||null,error:deriv?._errors?.global||deriv?._errors?.globalFallback||null},topPos:{source:deriv?._source?.topPos||null,error:deriv?._errors?.top||null},topAccount:{source:deriv?._source?.topAccount||null,error:deriv?._errors?.topAccount||null},depth:{source:micro?._source?.depth||null,error:micro?._errors?.depth||null},funding:{source:riskCtx?._source?.funding||null,error:riskCtx?._errors?.premium||riskCtx?._errors?.bybitTicker||null},basis:{source:riskCtx?._source?.basis||null,error:riskCtx?._errors?.basis||null},adl:{source:riskCtx?._source?.adl||null,error:riskCtx?._errors?.adl||null},mark:{source:riskCtx?._source?.mark||(Number.isFinite(liveMark)&&liveMark>0?'Binance':null),error:riskCtx?._errors?.premium||null},market:{source:assetClassForSymbolV2612(t.symbol)==='TRADFI'?'Binance 美股永續廣度':'Binance BTC/ETH'},backtest:{source:'Binance K線自算',sample:btSample}
  };
  for(const [k,d] of Object.entries(sourceDetails)){d.status=sourceFlags[k]===true?'OK':d?.error?'FETCH_ERROR':'MISSING';}
  sourceDetails.realtime={source:realtime?.source||null,status:(realtime?.markAgeMs!=null&&realtime.markAgeMs<=REALTIME_STALE_MS)?'OK':'STALE_OR_FALLBACK',markAgeMs:realtime?.markAgeMs??null,bookAgeMs:realtime?.bookAgeMs??null,takerAgeMs:realtime?.takerAgeMs??null};
  // OI 是一個資料類別，但 15分 / 1小時各佔半格；缺其中一個不再誤顯示 100%。
  const tradfiQualityV2612=assetClassForSymbolV2612(t.symbol)==='TRADFI';const qualityWeights=tradfiQualityV2612?{k5:1,k15:1,k30:1,h1:1,oi15:.5,oi1h:.5,taker:1,depth:1,funding:1,mark:1,market:1,backtest:1}:{k5:1,k15:1,k30:1,h1:1,oi15:.5,oi1h:.5,taker:1,globalLs:1,topPos:1,topAccount:1,depth:1,funding:1,basis:1,adl:1,mark:1,market:1,backtest:1};
  const qualityKeys=Object.keys(qualityWeights),totalWeight=Object.values(qualityWeights).reduce((a,b)=>a+b,0),validWeight=qualityKeys.reduce((sum,k)=>sum+(sourceFlags[k]?qualityWeights[k]:0),0);
  const validCount=qualityKeys.filter(k=>sourceFlags[k]).length,coveragePct=Math.round(validWeight/totalWeight*100);
  const fallbackCount=Object.values(sourceDetails).filter(x=>x?.fallback||String(x?.source||'').includes('備援')).length;
  let confidencePct=coveragePct;
  if(btSample>0&&btSample<20)confidencePct-=8;else if(btSample>=20&&btSample<50)confidencePct-=3;
  confidencePct-=Math.min(8,fallbackCount*2);confidencePct=Math.max(0,Math.min(100,Math.round(confidencePct)));
  t.dataHealth={coveragePct,confidencePct,validCount,total:qualityKeys.length,validWeight,totalWeight,fallbackCount,sources:sourceFlags,details:sourceDetails,checkedAt:evaluatedAt,backtestSample:btSample,backtestLevel:btSample>=50?'充足':btSample>=20?'可用':'樣本偏少',crossExchange:crossCtx,adlNote:'ADL Risk 使用 Binance 公開端點（約30分鐘更新）；主資料抓取失敗時，允許 Bybit / OKX 或 Binance 成交資料作明確標示的備援，不再用 0 或中性值假裝有效'};

  t.structureV2=structureV2Assess(t,{rows5,rows15,rows30,rows1h,t5,t15,t30,t1h,deriv,micro,market});
  structureV2Observe(t,t.structureV2,{rows5,rows15,rows30,rows1h});
  // Separate early structure-watch alert: informative only, never counted as an entry notification.
  void structureV2MaybeNotify(t,t.structureV2).catch(()=>{});

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
  // V10.1.4: 動態強度與「策略品質」分離。品質看 setup / playbook 完整度；
  // 動態強度只看此刻趨勢、動能、量能、資金流、深度、大盤與追價風險，避免兩欄永遠顯示同一數字。
  let liveStrength=50;
  liveStrength+=t5.trend===dir?8:t5.trend===-dir?-8:0;
  liveStrength+=t5.momentum===dir?7:t5.momentum===-dir?-7:0;
  liveStrength+=t15.trend===dir?10:t15.trend===-dir?-10:0;
  liveStrength+=t30?.trend===dir?6:t30?.trend===-dir?-6:0;
  liveStrength+=t1h?.trend===dir?7:t1h?.trend===-dir?-7:0;
  liveStrength+=marketAlign*6+derivDir*5+topDir*3+depthDir*4;
  liveStrength+=momentum?5:-2;
  liveStrength+=macdImprove?5:-2;
  liveStrength+=t5.volumeRatio>=1.20?5:t5.volumeRatio>=1.05?3:t5.volumeRatio<.70?-5:0;
  liveStrength+=oiVal==null?0:oiVal>=1?3:oiVal<=-2?-4:0;
  liveStrength+=spreadOk?2:-7;
  liveStrength+=strategyChase<=.15?4:strategyChase<=TEST_SIGNAL_FIRST_MAX_CHASE_ATR?0:-8;
  liveStrength+=adlRisk==='low'?2:adlRisk==='high'?-8:0;
  liveStrength+=fundingCrowded?-5:0;
  t.monitorScore=clamp(Math.round(liveStrength),0,100);
  t.currentPrice=last.close;t.qualityScore=score;t.status=t.observationProgress>=58?'TOUCHING':'WAIT_PULLBACK';t.statusLabel=testSignalStatusLabel(t.status);testSetState(t,'WATCHING','觀察中',new Date().toISOString());t.updatedAt=new Date().toISOString();
  t.lastCheck={at:t.updatedAt,strategyId:playbook.id,strategyLabel:playbook.label,observationProgress:t.observationProgress,dynamicStrength:t.monitorScore,strategyCandidates:playbook.candidates,reclaim,candleOk,wicker,sweep,momentum,macdImprove,volumeRatio:Number(t5.volumeRatio.toFixed(2)),volumeRatio15:Number(t15.volumeRatio.toFixed(2)),rsi5:Number(rsiNow.toFixed(1)),rsi15:Number.isFinite(Number(t15.rsi14))?Number(Number(t15.rsi14).toFixed(1)):null,macd5:Number.isFinite(Number(t5.macdHist))?Number(Number(t5.macdHist).toFixed(6)):null,macd15:Number.isFinite(Number(t15.macdHist))?Number(Number(t15.macdHist).toFixed(6)):null,adx5:Number.isFinite(Number(t5.adx14))?Number(Number(t5.adx14).toFixed(1)):null,adx15:Number.isFinite(Number(t15.adx14))?Number(Number(t15.adx14).toFixed(1)):null,atrPct5:Number.isFinite(Number(t5.atrPct))?Number(Number(t5.atrPct).toFixed(3)):null,oiChangePct:oiVal!=null?Number(oiVal.toFixed(2)):null,oi5mChangePct:finiteMetric(deriv?.oi5mChangePct),oi15mChangePct:finiteMetric(deriv?.oi15mChangePct),oi1hChangePct:finiteMetric(deriv?.oi1hChangePct),takerRatio:takerVal!=null?Number(takerVal.toFixed(2)):null,topPositionRatio:topVal!=null?Number(topVal.toFixed(2)):null,topAccountRatio:finiteMetric(deriv?.topAccountRatio)!=null?Number(Number(deriv.topAccountRatio).toFixed(2)):null,globalLongShortRatio:finiteMetric(deriv?.globalLongShortRatio)!=null?Number(Number(deriv.globalLongShortRatio).toFixed(2)):null,depthImbalance:depth!=null?Number(depth.toFixed(3)):null,spreadBps:spreadVal!=null?Number(spreadVal.toFixed(2)):null,bidNotional:finiteMetric(micro?.bidNotional),askNotional:finiteMetric(micro?.askNotional),chaseAtr:Number(strategyChase.toFixed(2)),adlRisk,fundingPct:fundingPct!=null?Number(fundingPct.toFixed(4)):null,basisPct:finiteMetric(riskCtx?.basisPct),annualizedBasisPct:finiteMetric(riskCtx?.annualizedBasisPct),nextFundingTime:finiteMetric(riskCtx?.nextFundingTime),fundingCrowded,t30Trend:t30?.trend??0,h1Trend:t1h?.trend??0,marketAlign,reasons:reasons.slice(0,8)};
  const globalSafety=spreadOk&&adlRisk!=='high'&&!fundingCrowded&&coveragePct>=72&&confidencePct>=65;
  const learningProbe=stateLearningAdjustment(t),learnedQualityScore=clamp(Math.round(score+Number(learningProbe.adjustment||0)),0,100);
  t.learningAdjustment=Number(learningProbe.adjustment||0);t.learningState=learningProbe;t.learnedQualityScore=learnedQualityScore;
  // Shadow pool deliberately starts earlier than notification readiness so we can measure what the filter blocks.
  // Hard-risk / weak-data cases may be recorded for audit, but are excluded from positive state-learning weights.
  const shadowProgress=Math.max(Number(playbook.progress||0),Number(t.observationProgress||0));
  const shadowDataOk=coveragePct>=SHADOW_MIN_COVERAGE&&confidencePct>=SHADOW_MIN_CONFIDENCE;
  const shadowEligible=shadowProgress>=SHADOW_MIN_PROGRESS&&shadowDataOk&&score>=SHADOW_MIN_SCORE&&spreadOk;
  const shadowLearningEligible=globalSafety&&shadowProgress>=85;
  const shadowBlockReasons=[];
  if(!playbook.ready)shadowBlockReasons.push('策略尚未ready');
  if(adlRisk==='high')shadowBlockReasons.push('ADL高風險');
  if(fundingCrowded)shadowBlockReasons.push('Funding擁擠');
  if(!globalSafety)shadowBlockReasons.push('未通過完整安全閘門');
  t.shadowLastByStrategy=t.shadowLastByStrategy&&typeof t.shadowLastByStrategy==='object'?t.shadowLastByStrategy:{};
  const shadowLastMs=new Date(t.shadowLastByStrategy[playbook.id]||0).getTime(),shadowCooldownPassed=!Number.isFinite(shadowLastMs)||shadowLastMs<=0||Date.now()-shadowLastMs>=SHADOW_REARM_MS;
  const shadowEpisodeActive=shadowPerformance.some(r=>r?.version==='V10.2.2'&&r.status==='ACTIVE'&&r.symbol===t.symbol&&r.direction===t.direction&&r.strategyId===playbook.id);
  if(!playbook.ready){t.shadowReadyLatch=null;t.shadowRecordId=null;}
  if(shadowEligible&&!shadowEpisodeActive&&t.shadowReadyLatch!==playbook.id&&shadowCooldownPassed){
    const shadowEntry=last.close,shadowInvalid=finiteMetric(playbook.invalidation)??finiteMetric(setup.invalidation),shadowRawRisk=Math.abs(shadowEntry-shadowInvalid),shadowMinRisk=setup.atr5*.55,shadowMaxRisk=setup.atr5*1.85,shadowRisk=clamp(shadowRawRisk,shadowMinRisk,shadowMaxRisk),shadowStop=shadowEntry-dir*shadowRisk,shadowTarget=shadowEntry+dir*shadowRisk,preTier=testSignalTier(t,{reentry:false});
    const shadowRec=shadowRecordCandidate(t,{entry:shadowEntry,stop:shadowStop,target:shadowTarget,tier:preTier.tier,rawScore:preTier.rawScore,adjustedScore:preTier.score,learningEligible:shadowLearningEligible,shadowProgress,blockReasons:shadowBlockReasons});if(shadowRec)t.shadowLastByStrategy[playbook.id]=shadowRec.shadowAt;
  }
  const confirm=playbook.ready===true&&globalSafety&&learnedQualityScore>=TEST_SIGNAL_CONFIRM_SCORE;
  if(confirm){
    const entry=last.close,strategyInvalid=finiteMetric(playbook.invalidation)??finiteMetric(setup.invalidation),rawRisk=Math.abs(entry-strategyInvalid),minRisk=setup.atr5*.55,maxRisk=setup.atr5*1.85,risk=clamp(rawRisk,minRisk,maxRisk),stop=entry-dir*risk;
    const before=rows5.slice(-22,-2),breakoutLevel=dir>0?Math.max(...before.map(x=>x.high)):Math.min(...before.map(x=>x.low)),now=new Date().toISOString();
    t.status='CONFIRMED';t.statusLabel='進場確認';t.observationProgress=100;t.strategyAtConfirm={...playbook,progress:100,ready:true};t.confirmedAt=now;t.rankAtConfirm=Number(t.rank||0)||null;t.confirmationPrice=entry;t.stop=stop;t.target1R=entry+dir*risk;t.target15R=entry+dir*risk*1.5;t.riskPct=Number((risk/entry*100).toFixed(2));t.breakoutLevel=finiteMetric(playbook.breakoutLevel)??breakoutLevel;t.structureProtection=stop;
    testSetState(t,learnedQualityScore>=84?'STRONG':'CONFIRMED',learnedQualityScore>=84?'強勢':'成立',now);t.lastMonitorBarTime=last.openTime;t.updatedAt=now;
    const calibrated=testCalibratedWinRate(t,{dynamic:false});t.confirmedWinRate=calibrated.rate;t.winRateMetaAtConfirm=calibrated;
    const tier=testSignalTier(t,{reentry:false});t.confirmNotificationTier=tier.tier;t.learningAdjustment=Number(tier.learningAdjustment||0);t.learningState=tier.learning||null;t.notificationScore=Number(tier.score||0);
    if(!t.notificationSentAt){const delivery=await sendTestLifecyclePush(t,'CONFIRMED','', '',{tier:t.confirmNotificationTier,statusLabel:learnedQualityScore>=84?'強勢':'成立'});if(Number(delivery?.sent||0)>0)t.notificationSentAt=new Date().toISOString()}
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

  const moItems=[{label:'15分強趨勢',ok:trend15&&adxStrong,weight:14},{label:'30分同向',ok:trend30,weight:9},{label:'1H同向',ok:trend1h,weight:9},{label:'價格貼近突破區',ok:nearMomentumBreak,weight:12},{label:'5分量能放大',ok:volumeStrong,weight:10},{label:'OI增加',ok:oiPositive,weight:10},{label:'Taker同向',ok:derivDir>0,weight:10},{label:'大戶不反向',ok:topDir>=0,weight:6},{label:'委託簿不反向',ok:depthOk,weight:6},{label:'大盤同向',ok:marketOk,weight:6},{label:'MACD續強',ok:macdImprove,weight:5},{label:'價差/擁擠安全',ok:safe,weight:3}];
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
  const dynamic=Number(t.monitorScore??t.qualityScore??70);
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
    key:t.key,symbol:t.symbol,assetClass:assetClassForSymbolV2612(t.symbol),assetSession:assetSessionV2612(t.symbol),assetSessionLabel:assetSessionLabelV2612(assetSessionV2612(t.symbol)),direction:t.direction,label:t.direction==='LONG'?'做多':'做空',rank:t.rank,rankAtConfirm:t.rankAtConfirm??null,rankHeat:Number(rankHeat.toFixed(0)),priorityScore:Number(priorityScore.toFixed(1)),status:t.status,statusLabel:testTrackerStatusLabel(t),
    monitorState:t.monitorState||'WATCHING',monitorLabel:testMonitorStateLabel(t.monitorState,t.status),monitorClass:testMonitorStateClass(t.monitorState,t.status),monitorScore:t.monitorScore??null,
    structureV2:t.structureV2||null,structureState:t.structureV2?.state||null,structureLabel:t.structureV2?.label||null,structureHealth:t.structureV2?.health??null,structureAction:t.structureV2?.action||null,
    notificationTier:tier.tier,notificationGate:{blockers:tier.blockers||[],highMissing:tier.highMissing||[],normalMissing:tier.normalMissing||[],rate:tier.rate,conservativeLow:tier.low,rawScore:tier.rawScore,score:tier.score,learningAdjustment:tier.learningAdjustment||0,learning:tier.learning||null,institutionalEdge:tier.institutionalEdge||null,rank:tier.rank},confirmNotificationTier:t.confirmNotificationTier??null,reentryNotificationTier:t.reentryNotificationTier??null,lastPushAttemptAt:t.lastPushAttemptAt??null,lastPushTier:t.lastPushTier??null,lastPushDelivery:t.lastPushDelivery??null,lastEntryNotificationAt:t.lastEntryNotificationAt??t.notificationSentAt??null,lastEntryNotificationId:t.lastEntryNotificationId??null,lastEntryNotificationTier:t.lastEntryNotificationTier??t.confirmNotificationTier??null,lastEntryNotificationPhase:t.lastEntryNotificationPhase??(t.notificationSentAt?'FIRST_ENTRY':null),lastEntryNotificationPrice:t.lastEntryNotificationPrice??null,lastEntryNotificationZoneLow:t.lastEntryNotificationZoneLow??null,lastEntryNotificationZoneHigh:t.lastEntryNotificationZoneHigh??null,lastEntryNotificationPreferredLow:t.lastEntryNotificationPreferredLow??null,lastEntryNotificationPreferredHigh:t.lastEntryNotificationPreferredHigh??null,lastEntryNotificationStop:t.lastEntryNotificationStop??null,lastEntryNotificationTarget:t.lastEntryNotificationTarget??null,monitorExpiresAt:(t.lastEntryNotificationAt||t.notificationSentAt)?new Date(new Date(t.lastEntryNotificationAt||t.notificationSentAt).getTime()+SYSTEM_MONITOR_TTL_MS).toISOString():null,entryStrategy:testEntryStrategy(t),entryZone,preferredEntryZone,observationProgress:Number(t.observationProgress||0),strategyProfile:t.strategyProfile||null,strategyAtConfirm:t.strategyAtConfirm||null,
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

function testTradfiMarketContextV2612(){const sm=marketFlowCache?.data?.assetViews?.tradfi?.summary||{},dir=sm.direction==='LONG'?1:sm.direction==='SHORT'?-1:0,valid=Number(sm.advancers||0)+Number(sm.decliners||0);return {raw:Number(sm.weightedChangePct||0),dir,ok:valid>0,valid,total:Math.max(1,valid),source:'BINANCE_TRADFI_BREADTH'}}
async function runTestSignalScan(force=false) {
  if(testSignalBusy)return;const now=Date.now();if(!force&&now-testSignalLastRunAt<TEST_SIGNAL_SCAN_MS*.75)return;testSignalBusy=true;
  try{
    const [ideas,market]=await Promise.all([getRankedIdeas(),testMarketContext().catch(()=>({raw:0,dir:0,ok:false,valid:0,total:6}))]);syncTestIdeas(ideas);
    const active=[...testSignalTrackers.values()].filter(t=>!terminalTestStatus(t.status)).sort((a,b)=>(a.rank||99)-(b.rank||99)).slice(0,TEST_SIGNAL_MAX);
    await mapPool(active,3,async t=>{try{const next=await analyzeTestTracker(t,assetClassForSymbolV2612(t.symbol)==='TRADFI'?testTradfiMarketContextV2612():market);testSignalTrackers.set(t.key,next)}catch(e){t.lastError=String(e?.message||e);t.lastEvaluationError=t.lastError;t.lastEvaluationErrorAt=new Date().toISOString();testSignalTrackers.set(t.key,t)}});
    testSignalLastRunAt=Date.now();testSignalLastError=null;persistTestSignals();
  }catch(e){testSignalLastError=String(e?.message||e);console.warn(`[test-signal] ${testSignalLastError}`)}finally{testSignalBusy=false}
}
function testSignalLoop(){void runTestSignalScan(false).finally(()=>{testSignalTimer=setTimeout(testSignalLoop,TEST_SIGNAL_SCAN_MS)})}
function scheduleNextFiveMinuteScan(){if(testBarTimer)clearTimeout(testBarTimer);const now=Date.now(),step=5*60_000,next=(Math.floor(now/step)+1)*step+2500;testBarTimer=setTimeout(()=>{testCandleCache.clear();testMicroCache.clear();testDerivCache.clear();void runTestSignalScan(true).finally(scheduleNextFiveMinuteScan)},Math.max(1000,next-now));testBarTimer.unref?.()}
function testMonitorPersistedNotification(t,now=Date.now()) {
  const at=t?.lastEntryNotificationAt||t?.notificationSentAt||null,tier=String(t?.lastEntryNotificationTier||t?.confirmNotificationTier||'').toUpperCase(),ms=at?new Date(at).getTime():0;
  if(!(ms>0&&['HIGH','NORMAL'].includes(tier)&&now-ms<=SYSTEM_MONITOR_TTL_MS))return false;
  const droppedMs=t?.droppedAt?new Date(t.droppedAt).getTime():0;if(t?.status==='DROPPED'&&Number.isFinite(droppedMs)&&droppedMs>=ms)return false;
  return true;
}
function testMonitorHistory(limit=30){
  return signalPerformance.filter(x=>x?.version==='V10.0').slice(0,Math.max(1,limit)).map(x=>{
    const actual=actualTrades.find(a=>a?.version==='V10.2.6'&&((a.notificationId&&a.notificationId===x.id)||(a.signalKey&&x.signalKey&&a.signalKey===x.signalKey)))||null;
    return {id:x.id,signalKey:x.signalKey||null,notificationAt:x.notificationAt,symbol:x.symbol,direction:x.direction,phase:x.phase,tier:x.tier,strategyLabel:x.strategyLabel||x.strategyId||'未分類',marketRegime:x.marketRegime||null,
      entryPrice:x.entryPrice,stop:x.stop,target:x.target,calibratedWinRate:x.calibratedWinRate,status:x.status,result:x.result,resultAt:x.resultAt,receivedAt:x.receivedAt,deliveryLatencyMs:x.deliveryLatencyMs,
      actualTrade:actual?{id:actual.id,status:actual.status,firstOutcome:actual.firstOutcome,signalKey:actual.signalKey,notificationId:actual.notificationId,symbol:actual.symbol,direction:actual.direction,strategyId:actual.strategyId,strategyLabel:actual.strategyLabel,marketRegime:actual.marketRegime,notificationTier:actual.notificationTier,signalSnapshot:actual.signalSnapshot,entryPrice:actual.entryPrice,tp1:actual.tp1,tp2:actual.tp2,sp1:actual.sp1,sp2:actual.sp2,margin:actual.margin,quantity:actual.quantity,leverage:actual.leverage,lastPrice:actual.lastPrice,lastPriceAt:actual.lastPriceAt,revisionCount:Number(actual.revisionCount||0)}:null};
  });
}
/* ACTUAL_MONITOR_V2610
 * Surface user-entered Actual Trades inside /api/test-signals so Monitor can always show them,
 * even after the source opportunity leaves B/observation/history. This is display-only plumbing:
 * trade tracking, TP/SP first-touch and learning rules remain unchanged.
 */
const ACTUAL_MONITOR_HISTORY_MS_V2610=Math.max(60*60*1000,Math.min(72*60*60*1000,Number(process.env.ACTUAL_MONITOR_HISTORY_MS||24*60*60*1000)));
const ACTUAL_MONITOR_ACTIVE_LIMIT_V2610=Math.max(4,Math.min(30,Number(process.env.ACTUAL_MONITOR_ACTIVE_LIMIT||16)));
const ACTUAL_MONITOR_HISTORY_LIMIT_V2610=Math.max(10,Math.min(60,Number(process.env.ACTUAL_MONITOR_HISTORY_LIMIT||30)));
function actualMonitorTimeV2610(x){const v=x?.resultAt||x?.updatedAt||x?.createdAt;const t=v?Date.parse(v):0;return Number.isFinite(t)?t:0}
function actualMonitorViewV2610(x){
  const last=finiteMetric(x?.lastPrice),livePnl=last>0?actualTradePnlAt(x,last):null;
  return {id:x.id,signalKey:x.signalKey||null,notificationId:x.notificationId||null,symbol:x.symbol,direction:x.direction,strategyId:x.strategyId||null,strategyLabel:x.strategyLabel||null,marketRegime:x.marketRegime||null,notificationTier:x.notificationTier||null,createdAt:x.createdAt,updatedAt:x.updatedAt,resultAt:x.resultAt||null,status:x.status,result:x.result||null,firstOutcome:x.firstOutcome||null,firstOutcomeAt:x.firstOutcomeAt||null,entryPrice:x.entryPrice,tp1:x.tp1,tp2:x.tp2,sp1:x.sp1,sp2:x.sp2,margin:x.margin,quantity:x.quantity,leverage:x.leverage,notional:x.notional,lastPrice:x.lastPrice,lastPriceAt:x.lastPriceAt,tp1Hit:x.tp1Hit===true,tp2Hit:x.tp2Hit===true,sp1Hit:x.sp1Hit===true,sp2Hit:x.sp2Hit===true,estimatedPnl:x.estimatedPnl,livePnl:Number.isFinite(Number(livePnl))?Number(livePnl):null,exitPrice:x.exitPrice??null,revisionCount:Number(x.revisionCount||0)};
}
function actualMonitorPayloadV2610(now=Date.now()){
  const all=actualTrades.filter(x=>x?.version==='V10.2.6');
  const active=all.filter(x=>x.status==='ACTIVE').sort((a,b)=>actualMonitorTimeV2610(b)-actualMonitorTimeV2610(a)).slice(0,ACTUAL_MONITOR_ACTIVE_LIMIT_V2610).map(actualMonitorViewV2610);
  const cutoff=now-ACTUAL_MONITOR_HISTORY_MS_V2610;
  const recent=all.filter(x=>x.status!=='ACTIVE'&&actualMonitorTimeV2610(x)>=cutoff).sort((a,b)=>actualMonitorTimeV2610(b)-actualMonitorTimeV2610(a)).slice(0,ACTUAL_MONITOR_HISTORY_LIMIT_V2610).map(actualMonitorViewV2610);
  return {version:'V2.6.10',active,recent,historyMs:ACTUAL_MONITOR_HISTORY_MS_V2610,historyHours:Math.round(ACTUAL_MONITOR_HISTORY_MS_V2610/3600000),activeLimit:ACTUAL_MONITOR_ACTIVE_LIMIT_V2610,historyLimit:ACTUAL_MONITOR_HISTORY_LIMIT_V2610};
}

function testSignalResponse() {
  const now=Date.now(),visible=[...testSignalTrackers.values()].filter(t=>now-new Date(t.updatedAt||t.firstSeenAt||0).getTime()<5*60*1000||testMonitorPersistedNotification(t,now));
  const sorter=(a,b)=>{const ta=terminalTestStatus(a.status),tb=terminalTestStatus(b.status);if(ta!==tb)return ta?1:-1;const p=testMonitorPriority(b)-testMonitorPriority(a);if(Math.abs(p)>.01)return p;const wa=Number(testCalibratedWinRate(a,{dynamic:['CONFIRMED','INVALID'].includes(a.status)}).rate||0),wb=Number(testCalibratedWinRate(b,{dynamic:['CONFIRMED','INVALID'].includes(b.status)}).rate||0);return wb-wa||(a.rank||99)-(b.rank||99)};
  visible.sort(sorter);
  // 一般觀察維持前 24 筆，但任何「真正成功通知」且仍在監控期限內的訊號都強制保留，避免被觀察榜擠掉。
  const selected=new Map();for(const t of visible.slice(0,24))selected.set(t.key,t);for(const t of visible)if(testMonitorPersistedNotification(t,now))selected.set(t.key,t);
  const rowTrackers=[...selected.values()].sort(sorter),rows=rowTrackers.map((t,i)=>({...publicTestTracker(t),observationRank:i+1}));
  const notifyStats={high:0,normal:0,valid:0,blocked:0,highNormalEligible:0};
  for(const row of rows){const k=String(row.notificationTier||'VALID').toLowerCase();if(k in notifyStats)notifyStats[k]++;if(row.notificationTier==='HIGH'||row.notificationTier==='NORMAL')notifyStats.highNormalEligible++}
  const scanAgeMs=testSignalLastRunAt?Math.max(0,now-testSignalLastRunAt):null,priceAgeMs=markPriceUpdatedAt?Math.max(0,now-new Date(markPriceUpdatedAt).getTime()):null;
  const staleCount=rows.filter(r=>r.freshness?.state==='STALE').length,delayedCount=rows.filter(r=>r.freshness?.state==='DELAYED').length;
  const health={scanAgeMs,priceAgeMs,delayedCount,staleCount,tracked:rows.length,derivativeCacheEntries:testDerivCache.size,candleCacheEntries:testCandleCache.size,microCacheEntries:testMicroCache.size,lastError:testSignalLastError,realtime:realtimeHealthSnapshot(),radar:realtimeRadarSummary()};
  return {ok:true,generatedAt:new Date(testSignalLastRunAt||Date.now()).toISOString(),structureEngine:structureV2Summary(),scanMs:TEST_SIGNAL_SCAN_MS,freshness:{delayMs:TEST_MONITOR_DELAY_MS,staleMs:TEST_MONITOR_STALE_MS,priceUpdatedAt:markPriceUpdatedAt},confirmScore:TEST_SIGNAL_CONFIRM_SCORE,badScore:TEST_MONITOR_BAD_SCORE,badBars:TEST_MONITOR_BAD_BARS,reactivateMinutes:Math.round(TEST_MONITOR_REACTIVATE_MS/60000),rearmScore:TEST_REARM_SCORE,monitor:{ttlMs:SYSTEM_MONITOR_TTL_MS,ttlMinutes:Math.round(SYSTEM_MONITOR_TTL_MS/60000),persistUntilManualDismiss:true,independentFromTraderRadar:true,autoClearMode:'C',autoClearBadBars:TEST_MONITOR_BAD_BARS},notifyThresholds:{highRate:TEST_SIGNAL_HIGH_RATE,normalRate:TEST_SIGNAL_NORMAL_RATE,highScore:TEST_SIGNAL_HIGH_SCORE,normalScore:TEST_SIGNAL_NORMAL_SCORE,maxChaseAtr:TEST_SIGNAL_FIRST_MAX_CHASE_ATR,highMaxChaseAtr:TEST_SIGNAL_HIGH_MAX_CHASE_ATR,maxSpreadBps:TEST_SIGNAL_MAX_SPREAD_BPS,highCoverage:90,normalCoverage:80,blockCoverage:72,highConfidence:86,normalConfidence:76,blockConfidence:65},notifyStats,health,rows,monitorHistory:testMonitorHistory(40),actualMonitor:actualMonitorPayloadV2610(now),liveStats:testLiveAggregate(),notificationPerformance:performanceAggregate(signalPerformance,false),recent:testSignalHistory.slice(0,12),methodology:'V10.2.7 SOLO MAX：監控採 C 模式。真正成功送出的 HIGH / NORMAL 獨立佇列以手動 × 為主；誤按可從通知歷史恢復。Structure Engine V2 將深回踩、受損、收復與徹底破壞分開；wick/0.786/單純價格觸碰不再直接判死，只有15/30/60分結構確認破壞才以結構理由阻擋或移出。通知歷史可重新修改仍在追蹤中的實際建倉設定；修改保留 revisions 稽核。',error:testSignalLastError};
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
        if(true){keep.push(rec);continue} // V2616: Today data stays; phone push disabled
        if(rec.lastDailyBriefPushDay===dayKey){keep.push(rec);continue}
        try{
          await webpush.sendNotification(rec.subscription,JSON.stringify({
            title:`市場整理｜${brief.bias||'中性'} ${Math.round(Number(brief.score||50))}`,
            body:`${brief.title||'今日市場整理'}${brief.action?`｜${brief.action}`:''}`.slice(0,180),
            tag:`daily-brief-${dayKey}`,
            renotify:false,
            data:{url:'/?page=today'},
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


/* MANUAL_MODE_V263_20260902 */
const MANUAL_MODE_PREF_FILE=path.join(DATA_DIR,'manual-mode-preferences.json');
const MANUAL_MODE_REFRESH_MS=Math.max(30_000,Number(process.env.MANUAL_MODE_REFRESH_MS||60_000));
const MANUAL_MODE_NOTIFY_COOLDOWN_MS=Math.max(20*60_000,Number(process.env.MANUAL_MODE_NOTIFY_COOLDOWN_MS||90*60_000));
let manualOpportunityTimer=null,manualOpportunityBusy=false,manualOpportunityCache={at:0,data:null};

function manualPrefRows(){const a=loadJson(MANUAL_MODE_PREF_FILE,[]);return Array.isArray(a)?a:[]}
function manualSavePrefs(rows){saveJson(MANUAL_MODE_PREF_FILE,(rows||[]).slice(0,50))}
function manualNotifyMode(_v){return 'AB'}
function manualPrefAllows(pref,grade){
  if(pref?.enabled!==true)return false;
  const mode=notificationCustomPrefsV2673().formalMode;
  const g=String(grade||'').toUpperCase();
  return mode==='A'?g==='A':['A','B'].includes(g);
}
function manualFinite(v){const n=Number(v);return Number.isFinite(n)?n:null}
function manualCleanSnapshot(x){
  if(!x||typeof x!=='object')return null;
  return {
    rank:manualFinite(x.rank),rankScore:manualFinite(x.rankScore),estimatedWinRate:manualFinite(x.estimatedWinRate),calibratedWinRate:manualFinite(x.calibratedWinRate),notificationTier:String(x.notificationTier||'').slice(0,20)||null,
    observationProgress:manualFinite(x.observationProgress),dataCoverage:manualFinite(x.dataCoverage),dataConfidence:manualFinite(x.dataConfidence),structureState:String(x.structureState||'').slice(0,30)||null,
    structureHealth:manualFinite(x.structureHealth),structureLearningAdjustment:manualFinite(x.structureLearningAdjustment),shadowSample:manualFinite(x.shadowSample),shadowHitRate:manualFinite(x.shadowHitRate),shadowProfitFactor:manualFinite(x.shadowProfitFactor),
    rr:manualFinite(x.rr),freshnessAgeMs:manualFinite(x.freshnessAgeMs),entryZoneLow:manualFinite(x.entryZoneLow),entryZoneHigh:manualFinite(x.entryZoneHigh),stop:manualFinite(x.stop),target:manualFinite(x.target),target2:manualFinite(x.target2)
  };
}
function manualGradeStats(rows){
  const all=rows||[],decisive=all.filter(x=>['WIN','LOSS'].includes(x.firstOutcome)),wins=decisive.filter(x=>x.firstOutcome==='WIN').length,losses=decisive.filter(x=>x.firstOutcome==='LOSS').length,resolved=all.filter(x=>x.status==='RESOLVED');
  const pnls=resolved.map(x=>Number(x.estimatedPnl)).filter(Number.isFinite),profits=pnls.filter(x=>x>0).reduce((a,b)=>a+b,0),lossSum=Math.abs(pnls.filter(x=>x<0).reduce((a,b)=>a+b,0));
  return {sample:all.length,active:all.filter(x=>x.status==='ACTIVE').length,resolved:resolved.length,decisive:decisive.length,wins,losses,hitRate:decisive.length?Number((wins/decisive.length*100).toFixed(1)):null,profitFactor:lossSum>0?Number((profits/lossSum).toFixed(2)):(profits>0?99:null),estimatedPnl:pnls.length?Number(pnls.reduce((a,b)=>a+b,0).toFixed(2)):0};
}
function manualActualBreakdown(){
  const rows=actualTrades.filter(x=>x?.version==='V10.2.6'&&(x.manualMode===true||['A','B','C'].includes(String(x.manualGrade||''))));
  const byGrade=['A','B','C'].map(key=>({key,...manualGradeStats(rows.filter(x=>String(x.manualGrade||'')===key))}));
  const bucket=x=>{const r=Number(x.manualRank);return r>0&&r<=3?'排名1–3':r>3&&r<=6?'排名4–6':r>6?'排名7+':'無排名'};
  const byRank=['排名1–3','排名4–6','排名7+','無排名'].map(key=>({key,...manualGradeStats(rows.filter(x=>bucket(x)===key))}));
  return {...manualGradeStats(rows),byGrade,byRank};
}
function manualShadowEvidence(t,direction,regime,strategyId,symbol=''){
  const assetClass=assetClassForSymbolV2612(t?.symbol||symbol),all=shadowPerformance.filter(x=>x?.version==='V10.2.2'&&x.status==='RESOLVED'&&['WIN','LOSS','TIMEOUT'].includes(x.result)&&String(x.direction||'')===direction&&assetClassForSymbolV2612(x.symbol)===assetClass);
  let rows=all.filter(x=>String(x.strategyId||'')===String(strategyId||'')&&String(x.marketRegime||'')===String(regime||'')),level='同資產·策略×狀態';
  if(rows.length<8){rows=all.filter(x=>String(x.marketRegime||'')===String(regime||''));level='同資產·狀態'}if(rows.length<8){rows=all;level='同資產·方向'}
  const stats=shadowStats(rows),hit=manualFinite(stats.hitRate),pf=manualFinite(stats.profitFactor);let adjustment=0;if(stats.sample>=12&&hit!=null&&pf!=null){if(hit>=58&&pf>=1.15)adjustment=4;else if(hit>=53&&pf>=1.03)adjustment=2;else if(hit<=42||pf<.82)adjustment=-4;else if(hit<=47||pf<.93)adjustment=-2}return {sample:Number(stats.sample||0),hitRate:hit,profitFactor:pf,expectancyR:manualFinite(stats.expectancyR),level,adjustment,assetClass};
}
function manualOpportunityId(idea,t){
  const epoch=t?.firstSeenAt||t?.confirmedAt||t?.createdAt||'';
  return ['manual-v263',cleanFuturesSymbol(idea?.symbol),String(idea?.direction||'LONG'),epoch||Math.floor(Date.now()/3600000)].join('|');
}
function manualOpportunityOne(idea,rank,ideasGeneratedAt){
  const direction=idea.direction==='SHORT'?'SHORT':'LONG',key=testSignalKey(idea.symbol,direction),t=testSignalTrackers.get(key)||null,now=Date.now();
  const strategy=t?.strategyAtConfirm||t?.strategyProfile||{},regime=String(t?.marketRegime||t?.lastCheck?.marketRegime||'UNKNOWN'),structure=t?.structureV2||null,st=String(structure?.state||'UNKNOWN');
  const tier=t?testSignalTier(t):null,cal=t?testCalibratedWinRate(t,{dynamic:['CONFIRMED','INVALID'].includes(t.status)}):null,calRate=manualFinite(cal?.rate)??manualFinite(idea.estimatedWinRate),rankScore=Math.max(0,Math.min(100,Number(idea.rankScore||0)));
  const progress=Math.max(0,Math.min(100,Number(t?.observationProgress||0))),coverage=Math.max(0,Math.min(100,Number(t?.dataHealth?.coveragePct||0))),confidence=Math.max(0,Math.min(100,Number(t?.dataHealth?.confidencePct||0))),structureHealth=Math.max(0,Math.min(100,Number(structure?.health||0)));
  const evaluatedAt=t?.lastEvaluatedAt||t?.updatedAt||ideasGeneratedAt,ageMs=evaluatedAt?Math.max(0,now-new Date(evaluatedAt).getTime()):99999999;
  const status=String(t?.status||'NO_TRACKER'),reentryActive=Boolean(t?.targetReachedAt),reentryReady=reentryActive&&String(t?.reentryStage||'')==='READY',executionConfirmed=reentryActive?reentryReady:status==='CONFIRMED';
  const zone=t?(testCurrentEntryZone(t)||t.strategyProfile?.entryZone||t.setup?.entryZone||null):null,zl=manualFinite(zone?.low??t?.setup?.zoneLow),zh=manualFinite(zone?.high??t?.setup?.zoneHigh);
  const normalEntry=zl!=null&&zh!=null?(zl+zh)/2:(manualFinite(t?.confirmationPrice)??manualFinite(t?.currentPrice)??manualFinite(idea.price));
  const entry=reentryReady?(manualFinite(t?.reentryEntryPrice)??normalEntry):normalEntry,stop=reentryReady?(manualFinite(t?.reentryStop)??manualFinite(t?.reentryInvalidation)):(manualFinite(t?.structureProtection)??manualFinite(t?.stop)??manualFinite(t?.setup?.invalidation));
  const sign=direction==='SHORT'?-1:1,risk=entry!=null&&stop!=null?Math.abs(entry-stop):null,target1=reentryReady?manualFinite(t?.reentryTarget1R):manualFinite(t?.target1R),target2=!reentryReady?manualFinite(t?.target15R):null,target2Final=target2??(entry!=null&&risk!=null?entry+sign*risk*1.5:null),rr=entry!=null&&stop!=null&&target2Final!=null&&risk>0?sign*(target2Final-entry)/risk:null;
  const shadow=manualShadowEvidence(t,direction,regime,strategy.id||'',idea.symbol),abcLearning=abcShadowLearningForTracker(t,direction,regime,strategy.id||''),institutional=institutionalMentorEdgeV2622(t),blockers=Array.isArray(tier?.blockers)?tier.blockers:[],lc=t?.lastCheck||{},ev=structure?.evidence||{},monitor=String(t?.monitorState||'WATCHING');
  const reclaimConfirmed=st!=='OPPORTUNITY'||ev.reclaim15===true||ev.reclaim5===true||ev.wickSweep===true;
  const structureForA=st==='INTACT'||(st==='RECLAIMING'&&executionConfirmed)||(st==='OPPORTUNITY'&&executionConfirmed&&reclaimConfirmed);
  let score=rankScore*.24+((manualFinite(tier?.score)??manualFinite(t?.monitorScore)??55))*0.24+structureHealth*.18+coverage*.08+confidence*.08+progress*.08+(calRate??50)*.06+50*.04+shadow.adjustment+Number(abcLearning.adjustment||0);
  if(executionConfirmed)score+=6;else if(status==='TOUCHING'||String(t?.reentryStage||'')==='TOUCHING')score+=1;else score-=4;
  if(st==='INTACT')score+=4;else if(st==='RECLAIMING')score-=2;else if(st==='OPPORTUNITY')score+=reclaimConfirmed?1:-4;else if(st==='DAMAGED')score-=12;else if(st==='DESTROYED')score-=35;else score-=8;
  if(rr!=null){if(rr>=1.8)score+=4;else if(rr>=1.5)score+=2;else if(rr<1)score-=18;else if(rr<1.25)score-=8}
  if(ageMs>120_000)score-=8;if(ageMs>300_000)score-=20;if(monitor==='WEAKENING')score-=12;if(Number(lc.chaseAtr)>.45)score-=8;if(Number(lc.chaseAtr)>.70)score-=10;if(blockers.length)score-=Math.min(18,blockers.length*5);
  score=Math.round(Math.max(0,Math.min(100,score)));
  const hardC=!t||st==='DESTROYED'||ageMs>300_000||(rr!=null&&rr<1)||['DROPPED','EXPIRED','LOSS','WIN','TIMEOUT'].includes(status)||(status==='INVALID'&&st!=='RECLAIMING'&&st!=='OPPORTUNITY');
  const aReady=!hardC&&executionConfirmed&&ageMs<=120_000&&coverage>=78&&confidence>=72&&progress>=72&&structureForA&&(rr==null||rr>=1.5)&&blockers.length===0&&monitor!=='WEAKENING'&&Number(lc.chaseAtr||0)<=.45&&shadow.adjustment>-3&&score>=78;
  const institutionalA=!institutional.hardBlock&&!institutional.capA&&institutional.costGateA&&institutional.edgeScore>=SHADOW_EDGE_A_MIN_V2621;const institutionalB=!institutional.hardBlock&&institutional.costGateB&&institutional.edgeScore>=SHADOW_EDGE_B_MIN_V2621;let grade=(aReady&&institutionalA)?'A':(!hardC&&score>=60&&institutionalB?'B':'C');
  const legacyManualGradeV2681=grade,bootcampManualTierV2681=testSignalTier(t);if(legacyManualGradeV2681==='A'&&bootcampManualTierV2681.tier==='HIGH')grade='A';else if(['A','B'].includes(legacyManualGradeV2681)&&['HIGH','NORMAL'].includes(bootcampManualTierV2681.tier))grade='B';else grade='C';if(st==='DAMAGED'&&grade==='A')grade='B';if(st==='RECLAIMING'&&!executionConfirmed&&grade==='A')grade='B';if(st==='OPPORTUNITY'&&!reclaimConfirmed&&grade==='A')grade='B';
  const reasons=[];const risks=[];reasons.push(`機構 Edge ${institutional.edgeScore} · ${institutional.level}`);if(institutional.cost?.ratio!=null)reasons.push(`成本/停損比 ${institutional.cost.ratio.toFixed(2)}`);if(institutional.capA)risks.push('Edge 模型封頂 B');if(institutional.hardBlockReasons?.length)risks.push(...institutional.hardBlockReasons);
  if(bootcampManualTierV2681?.bootcamp?.reason)reasons.push('魔鬼訓練營｜'+bootcampManualTierV2681.bootcamp.reason);if(bootcampManualTierV2681?.bootcamp?.strengthFailureRisk>=.18)risks.push('強轉弱風險 '+Math.round(bootcampManualTierV2681.bootcamp.strengthFailureRisk*100)+'%');
  reasons.push('建議排名 #'+rank+' · '+rankScore.toFixed(0)+'分');
  if(t)reasons.push('觀察完成度 '+Math.round(progress)+'% · '+(reentryActive?('二次進場 '+String(t.reentryStage||'等待')):status));else risks.push('尚無完整觀察追蹤，不能列 A');
  if(structure)reasons.push('結構 '+(structure.label||st)+' · '+Math.round(structureHealth)+'分'+(Number(structure.learning?.adjustment||0)!==0?' · 學習 '+(Number(structure.learning.adjustment)>0?'+':'')+Number(structure.learning.adjustment):''));else risks.push('Structure V2 尚未完成');
  if(shadow.adjustment<=-3)risks.push('同類 Shadow 實績偏弱，A級封頂');if(shadow.sample)reasons.push('Shadow '+shadow.sample+'筆 · 命中 '+(shadow.hitRate==null?'—':shadow.hitRate.toFixed(1)+'%')+' · PF '+(shadow.profitFactor==null?'—':shadow.profitFactor.toFixed(2)));else risks.push('同類 Shadow 樣本不足');
  if(rr!=null)reasons.push('TP2 RR '+rr.toFixed(2));else risks.push('RR 尚未建立');
  if(ageMs>120_000)risks.push('判讀已超過2分鐘');if(ageMs>300_000)risks.push('判讀超過5分鐘，降 C');if(st==='DAMAGED')risks.push('結構受損，先等收復');if(st==='RECLAIMING'&&!executionConfirmed)risks.push('結構仍在收復，未完成進場確認');if(reentryActive&&!reentryReady)risks.push('第一段已達標；只等二次回踩 READY，不追價');if(st==='OPPORTUNITY'&&!reclaimConfirmed)risks.push('深回踩尚未出現收復證據');if(st==='DESTROYED')risks.push('結構徹底破壞');if(monitor==='WEAKENING')risks.push('目前轉弱');if(blockers.length)risks.push(...blockers.slice(0,3));if(Number(lc.chaseAtr)>.45)risks.push('目前價格離建議區偏遠，不追價');if(coverage<78||confidence<72)risks.push('資料完整/可信度不足 A 級');
  const id=manualOpportunityId(idea,t),recent=actualTrades.find(x=>x?.version==='V10.2.6'&&x.manualOpportunityId===id)||null;
  return {
    id,grade,quoteVolume:manualFinite(idea.quoteVolume),fundingPct:manualFinite(idea.fundingPct),marketMetrics:idea.metrics||null,trackerStatus:status,executionConfirmed,reentryReady,monitorState:monitor,chaseAtr:manualFinite(lc.chaseAtr),blockers:blockers.slice(0,6),executionScore:score,generatedAt:new Date().toISOString(),evaluatedAt:evaluatedAt||null,rank,symbol:idea.symbol,direction,rankScore:Number(rankScore.toFixed(1)),modelScore:manualFinite(idea.modelScore),estimatedWinRate:manualFinite(idea.estimatedWinRate),historicalHitRate:manualFinite(idea.historicalHitRate),backtestSample:Number(idea.backtestSample||0),calibratedWinRate:calRate,notificationTier:String(tier?.tier||'').toUpperCase()||null,observationProgress:progress,
    freshnessAgeMs:ageMs,freshness:ageMs<=90_000?'LIVE':ageMs<=180_000?'DELAYED':'STALE',
    structure:structure?{state:st,label:structure.label,health:manualFinite(structure.health),confidence:manualFinite(structure.confidence),pattern:structure.pattern,learningAdjustment:manualFinite(structure.learning?.adjustment),learningActive:structure.learning?.active===true,reasons:(structure.reasons||[]).slice(0,4)}:null,
    shadow:{sample:shadow.sample,hitRate:shadow.hitRate,profitFactor:shadow.profitFactor,expectancyR:shadow.expectancyR,level:shadow.level,adjustment:shadow.adjustment},abcLearning:{sample:abcLearning.sample,hitRate:abcLearning.hitRate,profitFactor:abcLearning.profitFactor,expectancyR:abcLearning.expectancyR,level:abcLearning.level,adjustment:abcLearning.adjustment,active:abcLearning.active},institutionalEdge:{version:institutional.version,score:institutional.edgeScore,confidence:institutional.confidenceScore,level:institutional.level,sample:institutional.sample,netProfitFactor:institutional.stats?.netProfitFactor??null,netExpectancyR:institutional.stats?.netExpectancyR??null,wilsonLow:institutional.stats?.wilsonLow??null,costRatio:institutional.cost?.ratio??null,costGateA:institutional.costGateA,costGateB:institutional.costGateB,capA:institutional.capA,hardBlock:institutional.hardBlock,watchEligible:institutional.watchEligible,stability:{score:institutional.stability?.score,positiveFolds:institutional.stability?.positiveFolds,totalFolds:institutional.stability?.totalFolds},concentration:{score:institutional.concentration?.score,top2Share:institutional.concentration?.top2Share,topSymbols:institutional.concentration?.topSymbols},forward:{sample:institutional.forward?.sample,status:institutional.forward?.status,target:institutional.forward?.target,netProfitFactor:institutional.forward?.stats?.netProfitFactor,netExpectancyR:institutional.forward?.stats?.netExpectancyR},strategyStats:institutional.strategyStats},dataHealth:{coverage,confidence},
    entry:{price:entry,zoneLow:zl,zoneHigh:zh,stop,target:target1,target2:target2Final,rr:rr==null?null:Number(rr.toFixed(2)),currentPrice:manualFinite(realtimeBestPrice(idea.symbol))??manualFinite(idea.price)},
    signalKey:t?.key||null,strategyId:String(strategy?.id||''),strategyLabel:String(strategy?.label||''),marketRegime:regime,reasons:reasons.slice(0,7),risks:[...new Set(risks)].slice(0,8),
    trade:recent?{id:recent.id,status:recent.status,firstOutcome:recent.firstOutcome,result:recent.result,createdAt:recent.createdAt,estimatedPnl:recent.estimatedPnl}:null
  };
}
async function manualOpportunityResponseBaseV2664(force=false){
  const now=Date.now();if(!force&&manualOpportunityCache.data&&now-manualOpportunityCache.at<20_000)return manualOpportunityCache.data;
  const ideas=await getRankedIdeas(),rows=selectManualIdeasV2612(ideas).map((x,i)=>manualOpportunityOne(x,Number(x.assetRank||x.globalRank||i+1),ideas.generatedAt)).sort((a,b)=>(({A:3,B:2,C:1}[b.grade]||0)-({A:3,B:2,C:1}[a.grade]||0))||Number(b.institutionalEdge?.score||0)-Number(a.institutionalEdge?.score||0)||b.executionScore-a.executionScore||a.rank-b.rank);
  const abcCapture=abcShadowCapture(rows),shadowLearning=abcShadowLearningSummary();const data={ok:true,version:'V2.6.5',generatedAt:new Date().toISOString(),ideasGeneratedAt:ideas.generatedAt,stale:ideas.stale===true,methodology:'建議排名＋觀察/通知閘門＋Structure V2＋全自動 ABC Shadow＋資料新鮮度＋TP2 RR。未確認候選若尚無 TP1，研究影子會用成本到 SP 的等距 1R 作追蹤目標；不改實際建議 TP，也不放寬通知硬門檻。',stats:manualActualBreakdown(),shadowLearning,abcCapture,counts:{A:rows.filter(x=>x.grade==='A').length,B:rows.filter(x=>x.grade==='B').length,C:rows.filter(x=>x.grade==='C').length},rows};
  manualOpportunityCache={at:now,data};return data;
}
const MANUAL_CANDIDATE_MAX_V2664=5;
const MANUAL_CANDIDATE_CONFIRM_SCANS_V2664=2;
const MANUAL_CANDIDATE_MIN_SCORE_V2664=59;
const MANUAL_CANDIDATE_MIN_WIN_V2664=53;
const MANUAL_CANDIDATE_HARD_FLOOR_V2664=52;
const MANUAL_CANDIDATE_HOLD_MS_V2664=15*60*1000;
const MANUAL_CANDIDATE_MISS_MS_V2664=10*60*1000;
const MANUAL_CANDIDATE_REPLACE_EDGE_V2664=4;
const MANUAL_CANDIDATE_STATE_FILE_V2664=path.join(DATA_DIR,'manual-candidate-state-v2664.json');

function manualCandidateKeyV2664(x){return [String(x?.symbol||''),String(x?.direction||'')].join('|')}
function manualCandidateLoadStateV2664(){
  const rows=loadJson(MANUAL_CANDIDATE_STATE_FILE_V2664,[]);
  const map=new Map();
  for(const x of Array.isArray(rows)?rows:[]){
    if(!x?.key)continue;
    map.set(String(x.key),{
      firstSeen:Number(x.firstSeen||0),lastSeen:Number(x.lastSeen||0),confirm:Number(x.confirm||0),
      selected:x.selected===true,selectedAt:Number(x.selectedAt||0),snapshot:x.snapshot||null,metric:x.metric||null
    });
  }
  return map;
}
let manualCandidateStateV2664=manualCandidateLoadStateV2664();
function manualCandidateSaveStateV2664(){
  const rows=[...manualCandidateStateV2664.entries()].map(([key,x])=>({
    key,firstSeen:x.firstSeen,lastSeen:x.lastSeen,confirm:x.confirm,selected:x.selected===true,
    selectedAt:x.selectedAt,snapshot:x.snapshot,metric:x.metric
  })).slice(0,24);
  saveJson(MANUAL_CANDIDATE_STATE_FILE_V2664,rows);
}
function manualCandidateScoreV2664(x){
  const cal=manualFinite(x?.calibratedWinRate)??manualFinite(x?.estimatedWinRate)??50;
  const sh=manualFinite(x?.shadow?.hitRate)??50;
  const exec=manualFinite(x?.executionScore)??0;
  const rank=manualFinite(x?.rankScore)??0;
  const structure=manualFinite(x?.structure?.health)??45;
  const coverage=manualFinite(x?.dataHealth?.coverage)??40;
  const confidence=manualFinite(x?.dataHealth?.confidence)??40;
  const pf=manualFinite(x?.shadow?.profitFactor);
  const sample=Math.max(0,Number(x?.shadow?.sample||0));
  const rel=Math.min(1,sample/30);
  const learn=manualFinite(x?.structure?.learningAdjustment)??0;
  const qv=manualFinite(x?.quoteVolume);
  const vr=manualFinite(x?.marketMetrics?.volumeRatio);
  const taker=manualFinite(x?.marketMetrics?.takerRatio);
  const top=manualFinite(x?.marketMetrics?.topRatio);
  const dir=String(x?.direction||'LONG')==='SHORT'?-1:1;
  let marketAdj=0;
  if(qv!=null){if(qv<5_000_000)marketAdj-=12;else if(qv<20_000_000)marketAdj-=4;else if(qv>=500_000_000)marketAdj+=4;else if(qv>=100_000_000)marketAdj+=3;else if(qv>=30_000_000)marketAdj+=1.5}
  if(vr!=null){if(vr>=1.5)marketAdj+=3;else if(vr>=1.15)marketAdj+=1.5;else if(vr<.65)marketAdj-=4}
  if(taker!=null){const z=(taker-1)*dir;if(z>=.04)marketAdj+=2;else if(z<=-.06)marketAdj-=2}
  if(top!=null){const z=(top-1)*dir;if(z>=.04)marketAdj+=1.5;else if(z<=-.08)marketAdj-=1.5}
  const pfAdj=pf==null?0:Math.max(-7,Math.min(8,(pf-1)*8));
  const blockerPenalty=Math.min(8,(Array.isArray(x?.blockers)?x.blockers.length:0)*1.25);
  const score=cal*.30+sh*.18*rel+50*.18*(1-rel)+exec*.13+rank*.13+structure*.09+coverage*.045+confidence*.045+pfAdj+learn*.85+marketAdj-blockerPenalty;
  const win=sample>=8?(cal*.62+sh*.38):sample>=4?(cal*.78+sh*.22):cal;
  return {
    score:Number(Math.max(0,Math.min(100,score)).toFixed(1)),
    win:Number(Math.max(0,Math.min(100,win)).toFixed(1)),
    sample,
    liquidity:qv,
    marketAdj:Number(marketAdj.toFixed(1))
  };
}

const MANUAL_CANDIDATE_TTL_MS_V2667=30*60*1000;
const MANUAL_CANDIDATE_ARCHIVE_FILE_V2667=path.join(DATA_DIR,'manual-candidate-archive-v2667.json');
function manualCandidateArchiveRowsV2667(){
  const rows=loadJson(MANUAL_CANDIDATE_ARCHIVE_FILE_V2667,[]);
  if(!Array.isArray(rows))return [];
  const now=Date.now(),ttl=typeof MANUAL_CANDIDATE_BACKEND_RETENTION_MS_V2671==='number'?MANUAL_CANDIDATE_BACKEND_RETENTION_MS_V2671:7*24*60*60*1000;
  return rows
    .filter(r=>{const t=new Date(r?.archivedAt||0).getTime();return Number.isFinite(t)&&now-t<=ttl})
    .sort((a,b)=>new Date(b?.archivedAt||0).getTime()-new Date(a?.archivedAt||0).getTime())
    .slice(0,300);
}
function manualCandidateArchiveV2667(st,x,m,reason,details='',now=Date.now()){
  if(!st||!x)return;
  const selectedAt=Number(st.selectedAt||0),key=manualCandidateKeyV2664(x),archiveId=key+'|'+selectedAt;
  const rows=manualCandidateArchiveRowsV2667();
  if(rows.some(r=>r?.archiveId===archiveId))return;
  const cls=manualCandidateBlockClassV2665(x,m||manualCandidateScoreV2664(x));
  rows.unshift({
    archiveId,
    archivedAt:new Date(now).toISOString(),
    reason:String(reason||'EXPIRED'),
    details:String(details||'').slice(0,220),
    selectedAt:selectedAt?new Date(selectedAt).toISOString():null,
    durationMs:selectedAt?Math.max(0,now-selectedAt):null,
    symbol:x.symbol,
    direction:x.direction,
    candidateScore:Number(m?.score??x?.candidateScore??0),
    candidateWinRate:Number(m?.win??x?.candidateWinRate??0),
    candidateBand:String(st.band||x?.candidateBand||'WATCH'),
    originalGrade:String(x?.grade||x?.originalGrade||'C'),
    rank:Number(x?.rank||0),
    rankScore:Number(x?.rankScore||0),
    shadow:{
      sample:Number(x?.shadow?.sample||0),
      hitRate:manualFinite(x?.shadow?.hitRate),
      profitFactor:manualFinite(x?.shadow?.profitFactor),
      level:String(x?.shadow?.level||'')
    },
    structure:x?.structure?{
      state:String(x.structure.state||''),
      label:String(x.structure.label||''),
      health:manualFinite(x.structure.health)
    }:null,
    softWait:cls.soft.slice(0,6),
    hardBlockers:cls.hard.slice(0,6)
  });
  saveJson(MANUAL_CANDIDATE_ARCHIVE_FILE_V2667,rows.slice(0,500));
}
function manualCandidateArchiveReasonV2667(reason){
  return ({TTL_EXPIRED:'超過30分鐘未建倉，自動歸檔',BUILT:'已建立實際建倉追蹤',PROMOTED:'已升級正式 A/B',HARD_INVALID:'結構或風險硬失效'})[reason]||String(reason||'歸檔');
}
const MANUAL_CANDIDATE_SKIP_FILE_V2671=path.join(DATA_DIR,'manual-candidate-skip-v2671.json');
const MANUAL_CANDIDATE_SKIP_MS_V2671=60*60*1000;
const MANUAL_CANDIDATE_BACKEND_RETENTION_MS_V2671=7*24*60*60*1000;
const MANUAL_CANDIDATE_VISIBLE_HISTORY_MS_V2671=24*60*60*1000;

function manualCandidateSkipRowsV2671(){
  const raw=loadJson(MANUAL_CANDIDATE_SKIP_FILE_V2671,{});
  const now=Date.now(),out={};
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
    for(const [k,v] of Object.entries(raw)){
      const until=Number(v?.until||v||0);
      if(until>now)out[k]={until,at:Number(v?.at||0),reason:String(v?.reason||'MANUAL_DISMISS')};
    }
  }
  return out;
}
function manualCandidateSaveSkipsV2671(rows){saveJson(MANUAL_CANDIDATE_SKIP_FILE_V2671,rows)}
function manualCandidateSkipKeyV2671(key,reason='MANUAL_DISMISS',ms=MANUAL_CANDIDATE_SKIP_MS_V2671){
  const rows=manualCandidateSkipRowsV2671(),now=Date.now();
  rows[String(key)]={at:now,until:now+Math.max(60_000,Number(ms)||MANUAL_CANDIDATE_SKIP_MS_V2671),reason};
  manualCandidateSaveSkipsV2671(rows);
}
function manualCandidateUnskipV2671(key){
  const rows=manualCandidateSkipRowsV2671();delete rows[String(key)];manualCandidateSaveSkipsV2671(rows);
}
function manualCandidateIsSkippedV2671(x){
  const key=typeof x==='string'?x:manualCandidateKeyV2664(x);
  return Boolean(manualCandidateSkipRowsV2671()[String(key)]);
}
function manualCandidateHistoryRowsV2671(){
  const now=Date.now();
  return manualCandidateArchiveRowsV2667()
    .filter(r=>{const t=new Date(r?.archivedAt||0).getTime();return Number.isFinite(t)&&now-t<=MANUAL_CANDIDATE_VISIBLE_HISTORY_MS_V2671})
    .slice(0,80)
    .map(r=>({...r,candidateKey:manualCandidateKeyV2664(r)}));
}
function manualCandidateFallbackArchiveV2671(body,now=Date.now()){
  const s=body?.snapshot&&typeof body.snapshot==='object'?body.snapshot:{};
  const x={
    symbol:String(body?.symbol||s.symbol||'').toUpperCase(),
    direction:String(body?.direction||s.direction||'LONG').toUpperCase(),
    grade:String(s.originalGrade||s.grade||'C').toUpperCase(),
    originalGrade:String(s.originalGrade||s.grade||'C').toUpperCase(),
    candidateBand:String(s.candidateBand||'WATCH'),
    rank:Number(s.rank||0),rankScore:Number(s.rankScore||0),
    candidateScore:Number(s.candidateScore||0),candidateWinRate:Number(s.candidateWinRate||0),
    shadow:s.shadow||{},structure:s.structure||null,
    blockers:[],candidateSoftWait:Array.isArray(s.softWait)?s.softWait:[],
    trackerStatus:'NO_TRACKER',notificationTier:'BLOCKED',
    quoteVolume:Number(s.quoteVolume||0)||null
  };
  if(!x.symbol)return false;
  const m={score:Number(s.candidateScore||0),win:Number(s.candidateWinRate||0)};
  const st={selectedAt:now,firstSeen:now,lastSeen:now,band:x.candidateBand};
  manualCandidateArchiveV2667(st,x,m,'MANUAL_DISMISS','使用者主動移出候選',now);
  return true;
}
function manualCandidateBlockClassV2665(x,m){
  const hard=[],soft=[],push=(a,v)=>{v=String(v||'').trim();if(v&&!a.includes(v))a.push(v)};
  if(!x){push(hard,'資料不存在');return {hard,soft}}
  if(x?.trade?.status==='ACTIVE')push(hard,'已有實際建倉追蹤');

  const status=String(x?.trackerStatus||'NO_TRACKER').toUpperCase();
  const st=String(x?.structure?.state||'UNKNOWN').toUpperCase();

  // Candidate is a NEW research cycle. A previous terminal tracker must not permanently erase the symbol.
  if(['DROPPED','EXPIRED','LOSS','WIN','TIMEOUT'].includes(status))push(soft,'上一輪追蹤已結束，等待新一輪確認');

  if(st==='DESTROYED')push(hard,'結構徹底破壞');
  const rr=manualFinite(x?.entry?.rr);
  if(rr!=null&&rr<1)push(hard,'TP2 RR < 1');

  const qv=manualFinite(x?.quoteVolume);
  if(qv!=null&&qv<5_000_000)push(hard,'24h成交額過低');
  else if(qv!=null&&qv<20_000_000)push(soft,'流動性普通，需更嚴格等盤');

  const shN=Math.max(0,Number(x?.shadow?.sample||0)),shHit=manualFinite(x?.shadow?.hitRate),shPf=manualFinite(x?.shadow?.profitFactor);
  if(shN>=12&&((shPf!=null&&shPf<.75)||(shHit!=null&&shHit<40)))push(hard,'Shadow 同類樣本明顯負期望');
  else if(shN>=8&&shPf!=null&&shPf<.90)push(soft,'Shadow 同類 PF 偏弱');

  // IMPORTANT: candidate win rate is a RANKING signal, not a safety hazard.
  // Formal A/B still keeps its own threshold. Candidate never auto-pushes.
  if(m?.win!=null&&Number(m.win)<52)push(soft,'候選勝率尚未達正式門檻');

  const coverage=manualFinite(x?.dataHealth?.coverage),confidence=manualFinite(x?.dataHealth?.confidence);
  if(status==='NO_TRACKER'||['DROPPED','EXPIRED','LOSS','WIN','TIMEOUT'].includes(status)){
    push(soft,'等待最新 tracker / Structure 更新');
  }else{
    const age=Math.max(0,Number(x?.freshnessAgeMs||0));
    if(age>20*60_000)push(soft,'即時判讀已久，保留到候選自動歸檔');
    else if(age>5*60_000)push(soft,'即時判讀超過5分鐘，等待刷新');
    if(coverage!=null&&coverage<45)push(hard,'資料完整度過低');
    else if(coverage!=null&&coverage<72)push(soft,'資料完整度尚未達通知門檻');
    if(confidence!=null&&confidence<45)push(hard,'資料可信度過低');
    else if(confidence!=null&&confidence<65)push(soft,'資料可信度尚未達通知門檻');
  }

  if(!x?.structure)push(soft,'Structure V2 尚未完成');

  if(x?.institutionalEdge?.hardBlock===true){
    const rs=Array.isArray(x?.institutionalEdge?.hardBlockReasons)?x.institutionalEdge.hardBlockReasons:[];
    if(rs.length)for(const r of rs)push(hard,'機構風險：'+r);else push(hard,'機構風險硬阻擋');
  }

  const blockers=(Array.isArray(x?.blockers)?x.blockers:[]).map(v=>String(v));
  const has30=blockers.some(v=>/30分逆向/.test(v)),has1h=blockers.some(v=>/1小時逆向/.test(v));
  if(has30&&has1h)push(hard,'30分＋1小時同步逆向');

  for(const b of blockers){
    if(/距離回踩區|目前轉弱|15分逆向/.test(b)){push(soft,b);continue}
    if(/30分逆向|1小時逆向/.test(b)){if(!(has30&&has1h))push(soft,b);continue}
    if(/資料完整度|資料可信度/.test(b)){push(soft,b);continue}
    if(/價差|spread|ADL|Funding|擁擠|BTC\/ETH大盤逆向|跨交易所趨勢逆向|清算行情山寨|高波動價差|結構失效/i.test(b)){push(hard,b);continue}
    push(soft,b);
  }

  if(String(x?.notificationTier||'').toUpperCase()==='BLOCKED'&&!blockers.length)push(soft,'目前通知閘門未通過，候選層先保留研究');
  return {hard,soft};
}
function manualCandidateFormalVisibleV2665(x,m){
  if(!['A','B'].includes(String(x?.grade||'').toUpperCase()))return false;
  if(x?.trade?.status==='ACTIVE')return false;
  if(String(x?.notificationTier||'').toUpperCase()==='BLOCKED')return false;
  if(x?.institutionalEdge?.hardBlock===true)return false;
  return manualCandidateBlockClassV2665(x,m).hard.length===0;
}
function manualCandidateBandV2665(x,m){
  if(!x||manualCandidateBlockClassV2665(x,m).hard.length)return 'DROP';
  if(manualCandidateFormalVisibleV2665(x,m))return 'FORMAL';
  if(typeof manualCandidateIsSkippedV2671==='function'&&manualCandidateIsSkippedV2671(x))return 'DROP';

  const cal=manualFinite(x?.calibratedWinRate)??manualFinite(x?.estimatedWinRate)??0;
  const rank=Number(x?.rank||99),rankScore=Number(x?.rankScore||0),sample=Math.max(0,Number(x?.shadow?.sample||0));

  if(m.score>=66&&m.win>=57&&(sample>=6||cal>=60))return 'PRIME';
  if(m.score>=59&&m.win>=53&&(rank<=18||rankScore>=60||cal>=56||sample>=6))return 'WATCH';
  if(m.score>=54&&m.win>=50&&(rank<=24||rankScore>=52))return 'RELATIVE';
  if(rank<=15&&m.score>=50&&m.win>=48)return 'RESEARCH';
  if(rank<=8&&m.score>=48&&m.win>=47)return 'RESEARCH';
  return 'DROP';
}
function manualCandidateRejectSummaryV2665(rows){
  const h=new Map(),s=new Map();
  for(const x of rows||[]){
    const m=manualCandidateScoreV2664(x),c=manualCandidateBlockClassV2665(x,m);
    for(const r of c.hard)h.set(r,(h.get(r)||0)+1);
    for(const r of c.soft)s.set(r,(s.get(r)||0)+1);
  }
  const top=map=>[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([reason,count])=>({reason,count}));
  return {hard:top(h),soft:top(s)};
}
function manualNotificationEligibleV2665(pref,row){
  if(!row||row.candidate===true)return false;
  if(!manualPrefAllows(pref,row.grade))return false;
  if(!['A','B'].includes(String(row.grade||'').toUpperCase()))return false;
  if(String(row.notificationTier||'').toUpperCase()==='BLOCKED')return false;
  if(row?.institutionalEdge?.hardBlock===true)return false;
  if(row.freshness==='STALE'||row.trade?.status==='ACTIVE')return false;
  const m=manualCandidateScoreV2664(row);
  return manualCandidateBlockClassV2665(row,m).hard.length===0;
}
function manualCandidateHardInvalidV2664(x,m){
  return manualCandidateBlockClassV2665(x,m||manualCandidateScoreV2664(x)).hard.length>0;
}
function manualCandidateQualifiedV2664(x,m){
  return !['DROP','FORMAL'].includes(manualCandidateBandV2665(x,m));
}
function manualCandidateGapV2664(x){
  const toB=[],toA=[],st=String(x?.structure?.state||'UNKNOWN'),status=String(x?.trackerStatus||'NO_TRACKER');
  const age=Number(x?.freshnessAgeMs||0),coverage=Number(x?.dataHealth?.coverage||0),confidence=Number(x?.dataHealth?.confidence||0);
  const progress=Number(x?.observationProgress||0),score=Number(x?.executionScore||0),rr=manualFinite(x?.entry?.rr),chase=manualFinite(x?.chaseAtr);
  if(status==='NO_TRACKER')toB.push('還沒有完整 tracker；正式 B 需要即時觀察資料');
  if(age>300000)toB.push('要重新取得 5 分鐘內的判讀；目前過期會直接卡 C');
  if(score<60)toB.push('正式 B 執行分需 ≥60；目前 '+Math.round(score));
  if(!x?.structure)toB.push('Structure V2 尚未完成');
  if(st==='DAMAGED')toB.push('結構仍受損，先等收復');
  if(rr!=null&&rr<1.25)toB.push('RR 偏低；最好回到至少 1.25');
  if(!toB.length)toB.push('主要差在正式即時閘門重新確認，不是歷史勝率不足');

  if(x?.executionConfirmed!==true)toA.push('A 級需要正式進場確認');
  if(age>120000)toA.push('A 級要求判讀 ≤2 分鐘');
  if(coverage<78)toA.push('資料完整度需 ≥78；目前 '+Math.round(coverage));
  if(confidence<72)toA.push('資料可信度需 ≥72；目前 '+Math.round(confidence));
  if(progress<72)toA.push('觀察完成度需 ≥72；目前 '+Math.round(progress));
  if(!['INTACT','RECLAIMING','OPPORTUNITY'].includes(st))toA.push('結構還沒回到 A 級可接受狀態');
  if(rr!=null&&rr<1.5)toA.push('A 級 TP2 RR 需 ≥1.50；目前 '+rr.toFixed(2));
  if(String(x?.monitorState||'')==='WEAKENING')toA.push('目前仍在轉弱');
  if(chase!=null&&chase>.45)toA.push('離建議區太遠；A 級不允許追價');
  if(Array.isArray(x?.blockers)&&x.blockers.length)toA.push('通知閘門仍有阻擋：'+x.blockers.slice(0,2).join(' / '));
  if(!toA.length)toA.push('A 級主要只差即時確認維持');
  return {toB:toB.slice(0,5),toA:toA.slice(0,7)};
}
function manualCandidateCautionV2664(x){
  const a=[],e=x?.entry||{},st=String(x?.structure?.state||''),age=Number(x?.freshnessAgeMs||0),rr=manualFinite(e?.rr),chase=manualFinite(x?.chaseAtr);
  a.push('候選不是正式 A/B；最安全仍是等上面缺口補齊');
  if(age>300000)a.push('判讀已過期：進場前重新確認 5m/15m 沒有反向 BOS / CHoCH');
  if(chase!=null&&chase>.45)a.push('離建議區偏遠，不追；等回踩再看');
  if(st==='DAMAGED'||st==='RECLAIMING')a.push('結構未完整；只接受收復後回踩，不直接追');
  if(e?.zoneLow!=null&&e?.zoneHigh!=null)a.push('只在 '+e.zoneLow+'～'+e.zoneHigh+' 附近執行，離區就重評');
  if(e?.stop!=null)a.push('SP '+e.stop+' 為失效參考；失效不要硬扛');
  if(rr!=null&&rr<1.5)a.push('TP2 RR '+rr.toFixed(2)+'，報酬風險比仍不漂亮');
  return a.slice(0,6);
}
function manualCandidateReasonsV2664(x,m){
  const a=[],sh=x?.shadow||{};
  a.push('Shadow '+Number(sh.sample||0)+'筆 · 命中 '+(manualFinite(sh.hitRate)==null?'—':Number(sh.hitRate).toFixed(1)+'%')+' · PF '+(manualFinite(sh.profitFactor)==null?'—':Number(sh.profitFactor).toFixed(2)));
  a.push('校準勝率 '+(manualFinite(x.calibratedWinRate)==null?'—':Number(x.calibratedWinRate).toFixed(1)+'%')+' · Shadow 共識分 '+m.score);
  a.push('目前建議排名 #'+(x.rank??'—')+' · 排名分 '+Math.round(Number(x.rankScore||0)));
  if(x?.structure?.label)a.push('結構 '+x.structure.label+' · '+Math.round(Number(x.structure.health||0))+'分');
  return a.slice(0,5);
}
function manualCandidateDecorateV2664(x,st,m,now){
  const out={...x},cls=manualCandidateBlockClassV2665(x,m);
  let band=manualCandidateBandV2665(x,m);
  if(band==='DROP'&&st?.selected===true)band='COOLING';
  out.candidate=true;
  out.candidateKey=manualCandidateKeyV2664(x);
  out.candidateScore=m.score;
  out.candidateWinRate=m.win;
  out.candidateBand=band;
  out.candidateSince=st.selectedAt||st.firstSeen||now;
  out.candidateExpiresAt=(st.selectedAt||now)+MANUAL_CANDIDATE_TTL_MS_V2667;
  out.candidateRemainingMs=Math.max(0,out.candidateExpiresAt-now);
  out.candidateStable=true;
  out.originalGrade=String(x.grade||'C');
  out.candidateHardBlockers=cls.hard;
  out.candidateSoftWait=cls.soft;
  out.candidateEvidence={
    calibratedWinRate:manualFinite(x.calibratedWinRate),
    shadowSample:Number(x?.shadow?.sample||0),shadowHitRate:manualFinite(x?.shadow?.hitRate),
    shadowProfitFactor:manualFinite(x?.shadow?.profitFactor),shadowLevel:String(x?.shadow?.level||''),
    score:m.score,liquidity:manualFinite(x?.quoteVolume),marketAdj:m.marketAdj
  };
  out.formalGap=manualCandidateGapV2664(x);
  out.tradeCautions=[
    ...(cls.soft.length?['目前屬於等待型候選：'+cls.soft.slice(0,2).join(' / ')]:[]),
    ...manualCandidateCautionV2664(x)
  ].slice(0,7);
  out.candidateReasons=[
    '候選層級 '+band+' · 相對排名 '+m.score+'分',
    ...manualCandidateReasonsV2664(x,m)
  ].slice(0,6);
  return out;
}
function manualStableCandidatesV2664(rows){
  const now=Date.now(),current=new Map(),formal=new Set();
  for(const x of rows||[]){
    const k=manualCandidateKeyV2664(x),m=manualCandidateScoreV2664(x),band=manualCandidateBandV2665(x,m),hardInvalid=manualCandidateHardInvalidV2664(x,m),formalVisible=manualCandidateFormalVisibleV2665(x,m);
    if(formalVisible)formal.add(k);
    current.set(k,{row:x,metric:m,band,qualified:!['DROP','FORMAL'].includes(band),hardInvalid,formalVisible});
    let st=manualCandidateStateV2664.get(k);
    if(!st)st={firstSeen:now,lastSeen:0,confirm:0,selected:false,selectedAt:0,snapshot:null,metric:null,band:null};
    const consecutive=st.lastSeen&&now-st.lastSeen<150000;
    st.confirm=consecutive?st.confirm+1:1;
    st.lastSeen=now;st.snapshot=x;st.metric=m;st.band=band;
    manualCandidateStateV2664.set(k,st);
  }

  for(const [k,st] of [...manualCandidateStateV2664]){
    const cur=current.get(k),x=cur?.row||st.snapshot,m=cur?.metric||st.metric;
    if(!st.selected){
      if(formal.has(k)||cur?.hardInvalid||now-(st.lastSeen||0)>2*60*60*1000)manualCandidateStateV2664.delete(k);
      continue;
    }
    if(!x||!m){manualCandidateStateV2664.delete(k);continue}

    if(x?.trade?.status==='ACTIVE'){
      manualCandidateArchiveV2667(st,x,m,'BUILT','使用者已建立實際建倉追蹤',now);
      manualCandidateStateV2664.delete(k);
      continue;
    }
    if(formal.has(k)){
      manualCandidateArchiveV2667(st,x,m,'PROMOTED','候選升級為正式 '+String(x.grade||'A/B'),now);
      manualCandidateStateV2664.delete(k);
      continue;
    }
    if(cur?.hardInvalid){
      const cls=manualCandidateBlockClassV2665(x,m);
      manualCandidateArchiveV2667(st,x,m,'HARD_INVALID',cls.hard.slice(0,3).join(' / '),now);
      manualCandidateStateV2664.delete(k);
      continue;
    }
    if(now-Number(st.selectedAt||now)>=MANUAL_CANDIDATE_TTL_MS_V2667){
      manualCandidateArchiveV2667(st,x,m,'TTL_EXPIRED','30分鐘內未建倉、也未升級正式 A/B',now);
      manualCandidateStateV2664.delete(k);
      continue;
    }
  }

  let selected=[...manualCandidateStateV2664.entries()].filter(([k,st])=>st.selected&&!formal.has(k));
  const bandWeight={PRIME:4,WATCH:3,RELATIVE:2,RESEARCH:1,DROP:0,FORMAL:0};
  const challengers=[...current.entries()]
    .filter(([k,v])=>{
      if(formal.has(k)||!v.qualified||manualCandidateStateV2664.get(k)?.selected)return false;
      const cf=manualCandidateStateV2664.get(k)?.confirm||0;
      return ['RELATIVE','RESEARCH'].includes(v.band)?cf>=1:cf>=MANUAL_CANDIDATE_CONFIRM_SCANS_V2664;
    })
    .sort((a,b)=>(bandWeight[b[1].band]-bandWeight[a[1].band])||b[1].metric.score-a[1].metric.score||b[1].metric.win-a[1].metric.win||Number(a[1].row.rank||99)-Number(b[1].row.rank||99));

  while(selected.length<MANUAL_CANDIDATE_MAX_V2664&&challengers.length){
    const [k]=challengers.shift(),st=manualCandidateStateV2664.get(k);
    st.selected=true;st.selectedAt=now;manualCandidateStateV2664.set(k,st);
    selected.push([k,st]);
  }

  const output=[];
  for(const [k,st] of manualCandidateStateV2664){
    if(!st.selected||formal.has(k))continue;
    const cur=current.get(k),x=cur?.row||st.snapshot,m=cur?.metric||st.metric;
    if(!x||!m)continue;
    output.push(manualCandidateDecorateV2664(x,st,m,now));
  }
  output.sort((a,b)=>Number(a.candidateSince||0)-Number(b.candidateSince||0)||Number(b.candidateScore||0)-Number(a.candidateScore||0));
  manualCandidateSaveStateV2664();
  return output.slice(0,MANUAL_CANDIDATE_MAX_V2664);
}

function selectManualIdeasV2612(ideas){const rows=Array.isArray(ideas?.rows)?ideas.rows:[],picked=new Map();for(const x of rows.slice(0,10))picked.set(testSignalKey(x.symbol,x.direction),x);for(const cls of ['CRYPTO','TRADFI'])for(const x of rows.filter(y=>assetClassForSymbolV2612(y.symbol)===cls).slice(0,6))picked.set(testSignalKey(x.symbol,x.direction),x);return [...picked.values()].sort((a,b)=>Number(a.globalRank||99)-Number(b.globalRank||99)).slice(0,16)}
async function manualOpportunityResponseV2681Base(force=false){
  const base=await manualOpportunityResponseBaseV2664(force);
  const baseRows=Array.isArray(base?.rows)?base.rows:[];
  const ideas=rankedIdeasCache?.data?{...rankedIdeasCache.data,stale:(Date.now()-Number(rankedIdeasCache.lastGoodAt||rankedIdeasCache.at||0))>IDEA_CACHE_MS,cacheAgeMs:Math.max(0,Date.now()-Number(rankedIdeasCache.lastGoodAt||rankedIdeasCache.at||Date.now()))}:null;

  const candidateUniverse=[...baseRows],seen=new Set(baseRows.map(x=>manualCandidateKeyV2664(x)));
  for(const [i,idea] of (Array.isArray(ideas?.rows)?ideas.rows:[]).slice(0,30).entries()){
    try{
      const row=manualOpportunityOne(idea,i+1,ideas?.generatedAt);
      if(!row)continue;
      const key=manualCandidateKeyV2664(row);
      if(seen.has(key))continue;
      seen.add(key);candidateUniverse.push(row);
    }catch{}
  }

  const candidates=manualStableCandidatesV2664(candidateUniverse);
  const byKey=new Map(candidates.map(x=>[x.candidateKey,x]));
  const rows=baseRows.map(x=>byKey.get(manualCandidateKeyV2664(x))||x);
  for(const c of candidates)if(!rows.some(x=>manualCandidateKeyV2664(x)===c.candidateKey))rows.push(c);

  const scored=candidateUniverse.map(x=>{const m=manualCandidateScoreV2664(x);return {x,m,cls:manualCandidateBlockClassV2665(x,m),formal:manualCandidateFormalVisibleV2665(x,m),band:manualCandidateBandV2665(x,m)}});
  const rejects=manualCandidateRejectSummaryV2665(candidateUniverse);
  const visibleA=baseRows.filter(x=>String(x.grade||'')==='A'&&manualCandidateFormalVisibleV2665(x,manualCandidateScoreV2664(x))).length;
  const visibleB=baseRows.filter(x=>String(x.grade||'')==='B'&&manualCandidateFormalVisibleV2665(x,manualCandidateScoreV2664(x))).length;
  const archive=manualCandidateArchiveRowsV2667();

  const pipeline={
    radarLimit:typeof RADAR_MAX_SYMBOLS==='number'?RADAR_MAX_SYMBOLS:null,
    deepAnalyzed:Number(ideas?.analyzed||0),
    candidateUniverse:candidateUniverse.length,
    formalUniverse:baseRows.length,
    hardSafe:scored.filter(v=>v.cls.hard.length===0).length,
    hardBlocked:scored.filter(v=>v.cls.hard.length>0).length,
    softWaiting:scored.filter(v=>v.cls.hard.length===0&&v.cls.soft.length>0).length,
    formalA:visibleA,formalB:visibleB,candidate:candidates.length,
    prime:scored.filter(v=>v.band==='PRIME').length,
    watch:scored.filter(v=>v.band==='WATCH').length,
    relative:scored.filter(v=>v.band==='RELATIVE').length,
    research:scored.filter(v=>v.band==='RESEARCH').length,
    topRejects:rejects.hard,topWaits:rejects.soft,radar:ideas?.radar||null,
    candidateArchiveCount:archive.length,recentArchived:archive.slice(0,5)
  };

  return {
    ...base,
    version:'V2.6.69',
    methodology:'大範圍市場雷達後，前40名做深度分析；正式A/B維持原門檻，候選從前30個深析結果做安全層後相對排名。只要存在沒有硬風險、候選勝率>=52%的相對前段標的，就能進研究候選；研究候選永不自動通知。',
    counts:{...(base?.counts||{}),A:visibleA,B:visibleB,C:rows.filter(x=>String(x.grade||'')==='C'&&x.candidate!==true).length,candidate:candidates.length},
    pipeline,
    rows
  };
}

/* WORTH_WATCH_V2682_20260905
 * B = 值得打開圖看，由使用者自己扣扳機；不是自動進場確認。
 * A 維持 V2.6.81 嚴格正式確認。Shadow/Bootcamp 對 B 改為負面否決器，不再要求先證明 +0.10R / PF1.15 才准使用者看圖。
 */
/* WORTH_WATCH_STICKY_V2683_20260905
 * B 防抖生命週期：新 B 至少鎖定 20 分鐘；軟性轉弱保留為 B，不因排名/分數單次波動瞬間消失。
 * 鎖定後需 3 次、且至少跨 5 分鐘的非入選確認才降級；硬風險/DESTROYED/嚴重資料過期/實際建倉則立即退出。
 */
const WORTH_WATCH_AUDIT_FILE_V2682=path.join(DATA_DIR,'worth-watch-audit-v2682.json');
const WORTH_WATCH_STICKY_FILE_V2683=path.join(DATA_DIR,'worth-watch-sticky-v2683.json');
const WORTH_WATCH_STICKY_LOCK_MS_V2683=Math.max(5*60_000,Number(process.env.WORTH_WATCH_STICKY_LOCK_MS||20*60_000));
const WORTH_WATCH_STICKY_GRACE_MS_V2683=Math.max(2*60_000,Number(process.env.WORTH_WATCH_STICKY_GRACE_MS||5*60_000));
const WORTH_WATCH_STICKY_MISS_LIMIT_V2683=Math.max(2,Math.min(5,Number(process.env.WORTH_WATCH_STICKY_MISS_LIMIT||3)));
const WORTH_WATCH_STICKY_MISS_SAMPLE_MS_V2683=Math.max(30_000,Number(process.env.WORTH_WATCH_STICKY_MISS_SAMPLE_MS||45_000));
const WORTH_WATCH_STICKY_STALE_HARD_MS_V2683=Math.max(4*60_000,Number(process.env.WORTH_WATCH_STICKY_STALE_HARD_MS||5*60_000));
let worthWatchLastSnapshotV2682={generatedAt:null,eligible:0,selected:0,selectedRows:[],rejected:[]};
let worthWatchAuditSigV2682='';
let worthWatchStickyStateV2683=(()=>{const x=loadJson(WORTH_WATCH_STICKY_FILE_V2683,{version:'V2.6.83',rows:{}});return x&&typeof x==='object'&&!Array.isArray(x)?{version:'V2.6.83',rows:x.rows&&typeof x.rows==='object'&&!Array.isArray(x.rows)?x.rows:{}}:{version:'V2.6.83',rows:{}}})();
function worthWatchKeyV2682(x){return [String(x?.symbol||''),String(x?.direction||'')].join('|')}
function worthWatchStickySaveV2683(){worthWatchStickyStateV2683.version='V2.6.83';worthWatchStickyStateV2683.updatedAt=new Date().toISOString();saveJson(WORTH_WATCH_STICKY_FILE_V2683,worthWatchStickyStateV2683)}
function worthWatchDecisionSnapshotV2683(d){return d?{mode:d.mode,score:Number(d.score||0),band:d.band,blockers:(d.blockers||[]).slice(0,8),notes:(d.notes||[]).slice(0,6),metrics:d.metrics||{}}:null}
function worthWatchBootcampV2682(row){
  try{
    const key=testSignalKey(row?.symbol,row?.direction),t=testSignalTrackers.get(key);if(!t)return null;
    const tier=testSignalTier(t);return tier?.bootcamp&&typeof tier.bootcamp==='object'?tier.bootcamp:null;
  }catch{return null}
}
function worthWatchAuditWriteV2682(snapshot){
  try{
    const sig=JSON.stringify([snapshot?.selectedRows?.map(x=>[x.symbol,x.direction,x.score,x.mode,x.lifecycle]),snapshot?.eligible,snapshot?.selected]);
    if(sig===worthWatchAuditSigV2682)return;worthWatchAuditSigV2682=sig;
    const old=loadJson(WORTH_WATCH_AUDIT_FILE_V2682,{events:[]}),out=old&&typeof old==='object'?old:{events:[]};
    out.version='V2.6.83';out.updatedAt=new Date().toISOString();out.lastSnapshot=snapshot;out.events=Array.isArray(out.events)?out.events:[];
    out.events.unshift({at:out.updatedAt,eligible:snapshot.eligible,selected:snapshot.selected,selectedRows:snapshot.selectedRows});out.events=out.events.slice(0,200);saveJson(WORTH_WATCH_AUDIT_FILE_V2682,out);
  }catch(e){console.warn('[v2683] worth-watch audit',String(e?.message||e))}
}
function worthWatchPromoteRowV2682(row,decision,lifecycle=null){
  const toA=Array.isArray(row?.formalGap?.toA)?row.formalGap.toA:[],lc=lifecycle&&typeof lifecycle==='object'?lifecycle:null;
  const lcReason=lc?.status==='WEAKENING'?'B級鎖定｜轉弱觀察':lc?.status==='GRACE'?'B級鎖定｜降級確認 '+Number(lc.missCount||0)+'/'+WORTH_WATCH_STICKY_MISS_LIMIT_V2683:lc?.status==='LOCKED'?'B級鎖定｜排名/分數防抖':'B級值得看｜'+Number(decision?.score||0).toFixed(1)+'分';
  return {...row,
    grade:'B',candidate:false,originalCandidate:true,originalCandidateBand:row.candidateBand||null,
    notificationTier:'NORMAL',
    worthWatch:{version:'V2.6.83',mode:'WORTH_WATCH',selectionMode:decision?.mode||lc?.selectionMode||'STICKY',score:Number(decision?.score??lc?.score??0),notes:decision?.notes||[],metrics:decision?.metrics||{},lifecycle:lc},
    reasons:[lcReason,...(decision?.notes||[]),...(row.reasons||[])].filter(Boolean).slice(0,8),
    risks:['B級＝值得打開圖，不是進場確認；由你看盤後決定是否扣扳機',...(lc?.status==='WEAKENING'||lc?.status==='GRACE'?['目前為 B 防抖保留，不代表條件仍完全符合新 B 門檻']:[]),...(row.risks||[])].filter(Boolean).slice(0,8),
    formalGap:{...(row.formalGap||{}),toB:['已升 B｜值得看；20 分鐘防抖，軟性轉弱不會瞬間消失'],toA}
  };
}
function worthWatchHardExitV2683(row){
  if(!row)return {hard:false,reasons:['本輪未出現在候選資料']};
  if(row?.trade?.status==='ACTIVE')return {hard:true,reasons:['已有實際建倉追蹤']};
  const grade=String(row?.grade||'').toUpperCase();
  if(row?.candidate!==true&&['A','B'].includes(grade))return {hard:true,reasons:['已轉為正式 '+grade+' 級']};
  const cls=manualCandidateBlockClassV2665(row,manualCandidateScoreV2664(row));
  if(cls.hard.length)return {hard:true,reasons:cls.hard.slice(0,5)};
  if(String(row?.structure?.state||'').toUpperCase()==='DESTROYED')return {hard:true,reasons:['結構徹底破壞']};
  if(Number(row?.freshnessAgeMs||0)>WORTH_WATCH_STICKY_STALE_HARD_MS_V2683)return {hard:true,reasons:['即時判讀超過5分鐘']};
  const cov=manualFinite(row?.dataHealth?.coverage),conf=manualFinite(row?.dataHealth?.confidence);
  if(cov!=null&&cov<45)return {hard:true,reasons:['資料完整度嚴重不足']};
  if(conf!=null&&conf<45)return {hard:true,reasons:['資料可信度嚴重不足']};
  return {hard:false,reasons:[]};
}
function worthWatchStickyLifecycleV2683(rows0,evaluated,selected,now=Date.now()){
  const max=Math.max(1,Number(WORTH_WATCH_DEFAULTS_V2682.maxVisibleB)||3),rowByKey=new Map(rows0.map(r=>[worthWatchKeyV2682(r),r])),evalByKey=new Map(evaluated.map(x=>[worthWatchKeyV2682(x.row),x])),rawSelectedKeys=new Set(selected.map(x=>worthWatchKeyV2682(x.row))),stateRows=worthWatchStickyStateV2683.rows||{},active=[];let dirty=false;
  const prior=Object.values(stateRows).filter(x=>x&&x.active===true).sort((a,b)=>Number(a.startedAt||0)-Number(b.startedAt||0));
  for(const st of prior){
    const key=String(st.key||''),row=rowByKey.get(key),ev=evalByKey.get(key),hard=worthWatchHardExitV2683(row);
    if(hard.hard){delete stateRows[key];dirty=true;continue}
    if(!row||row?.candidate!==true)continue;
    const selectedNow=rawSelectedKeys.has(key),decision=ev?.decision||null;
    if(selectedNow){st.lastEligibleAt=now;st.missCount=0;st.firstMissAt=null;st.lastMissAt=null;st.status='ACTIVE';st.lastDecision=worthWatchDecisionSnapshotV2683(decision);dirty=true;active.push({key,row,decision:decision||st.lastDecision,state:st});continue}
    if(now<Number(st.lockUntil||0)){
      st.status=decision?.eligible===true?'LOCKED':'WEAKENING';if(decision)st.lastDecision=worthWatchDecisionSnapshotV2683(decision);dirty=true;active.push({key,row,decision:decision||st.lastDecision,state:st});continue
    }
    if(!st.firstMissAt)st.firstMissAt=now;
    if(!st.lastMissAt||now-Number(st.lastMissAt)>=WORTH_WATCH_STICKY_MISS_SAMPLE_MS_V2683){st.missCount=Number(st.missCount||0)+1;st.lastMissAt=now;dirty=true}
    const missAge=now-Number(st.firstMissAt||now);
    if(Number(st.missCount||0)>=WORTH_WATCH_STICKY_MISS_LIMIT_V2683&&missAge>=WORTH_WATCH_STICKY_GRACE_MS_V2683){delete stateRows[key];dirty=true;continue}
    st.status='GRACE';if(decision)st.lastDecision=worthWatchDecisionSnapshotV2683(decision);active.push({key,row,decision:decision||st.lastDecision,state:st});
  }
  const activeKeys=new Set(active.map(x=>x.key));
  for(const x of selected){
    if(active.length>=max)break;
    const key=worthWatchKeyV2682(x.row);if(activeKeys.has(key))continue;
    const row=rowByKey.get(key);if(!row||worthWatchHardExitV2683(row).hard)continue;
    const st={key,symbol:row.symbol,direction:row.direction,active:true,status:'ACTIVE',startedAt:now,lastEligibleAt:now,lockUntil:now+WORTH_WATCH_STICKY_LOCK_MS_V2683,missCount:0,firstMissAt:null,lastMissAt:null,selectionMode:x.decision.mode,score:Number(x.decision.score||0),lastDecision:worthWatchDecisionSnapshotV2683(x.decision)};
    stateRows[key]=st;active.push({key,row,decision:x.decision,state:st});activeKeys.add(key);dirty=true;
  }
  active.splice(max);
  const keep=new Set(active.map(x=>x.key));
  for(const [key,st] of Object.entries(stateRows))if(st?.active===true&&!keep.has(key)&&rowByKey.has(key)&&Number(st.startedAt||0)>0&&now-Number(st.startedAt)>24*60*60_000){delete stateRows[key];dirty=true}
  worthWatchStickyStateV2683.rows=stateRows;if(dirty)worthWatchStickySaveV2683();
  return active;
}

async function manualOpportunityResponse(force=false){
  const base=await manualOpportunityResponseV2681Base(force),rows0=Array.isArray(base?.rows)?base.rows:[];
  const evaluated=[];
  for(const row of rows0){
    if(row?.candidate!==true||row?.trade?.status==='ACTIVE')continue;
    const bootcamp=worthWatchBootcampV2682(row),decision=evaluateWorthWatchV2682(row,bootcamp);
    evaluated.push({row,decision,bootcamp});
  }
  const rawSelected=selectWorthWatchV2682(evaluated,{max:WORTH_WATCH_DEFAULTS_V2682.maxVisibleB}),sticky=worthWatchStickyLifecycleV2683(rows0,evaluated,rawSelected),selectedByKey=new Map(sticky.map(x=>[x.key,x]));
  const rows=rows0.map(row=>{const x=selectedByKey.get(worthWatchKeyV2682(row));return x&&row?.candidate===true?worthWatchPromoteRowV2682(row,x.decision,{status:x.state.status,startedAt:x.state.startedAt,lockUntil:x.state.lockUntil,missCount:Number(x.state.missCount||0),selectionMode:x.state.selectionMode,score:Number(x.decision?.score??x.state.score??0)}):row});
  const countA=rows.filter(x=>String(x?.grade||'')==='A'&&x?.candidate!==true).length,countB=rows.filter(x=>String(x?.grade||'')==='B'&&x?.candidate!==true).length,countCandidate=rows.filter(x=>x?.candidate===true).length;
  const selectedRows=sticky.map(x=>({symbol:x.row.symbol,direction:x.row.direction,score:Number(x.decision?.score??x.state.score??0),mode:x.decision?.mode||x.state.selectionMode,band:x.decision?.band||x.row.candidateBand,structure:x.decision?.metrics?.structureState||x.row.structure?.state,health:x.decision?.metrics?.structureHealth??x.row.structure?.health,progress:x.decision?.metrics?.progress??x.row.observationProgress,lifecycle:x.state.status,lockUntil:x.state.lockUntil,missCount:Number(x.state.missCount||0)}));
  const rejected=evaluated.filter(x=>!x.decision.eligible).sort((a,b)=>Number(b.decision.score||0)-Number(a.decision.score||0)).slice(0,8).map(x=>({symbol:x.row.symbol,direction:x.row.direction,band:x.decision.band,score:x.decision.score,blockers:x.decision.blockers.slice(0,4)}));
  worthWatchLastSnapshotV2682={generatedAt:new Date().toISOString(),eligible:evaluated.filter(x=>x.decision.eligible).length,selected:sticky.length,rawSelected:rawSelected.length,selectedRows,rejected,sticky:{version:'V2.6.83',lockMinutes:Math.round(WORTH_WATCH_STICKY_LOCK_MS_V2683/60_000),graceMinutes:Math.round(WORTH_WATCH_STICKY_GRACE_MS_V2683/60_000),missLimit:WORTH_WATCH_STICKY_MISS_LIMIT_V2683}};worthWatchAuditWriteV2682(worthWatchLastSnapshotV2682);
  const pipeline={...(base?.pipeline||{}),formalA:countA,formalB:countB,candidate:countCandidate,worthWatchEligible:worthWatchLastSnapshotV2682.eligible,worthWatchSelected:sticky.length};
  return {...base,version:'V2.6.83',methodology:'V2.6.83：A 維持嚴格正式確認；B 維持 V2.6.82 值得看門檻，新增 20 分鐘 Sticky 防抖。排名、分數、完成度或一般轉弱不會讓已通知 B 瞬間消失；鎖定後需 3 次且至少 5 分鐘持續未入選才降級。結構 DESTROYED、硬風控、嚴重資料過期或已實際建倉仍立即退出。',counts:{...(base?.counts||{}),A:countA,B:countB,candidate:countCandidate},pipeline,worthWatch:{version:'V2.6.83',...worthWatchLastSnapshotV2682},rows};
}


/* ABC_SHADOW_LEARNING_V265_20260902
 * Purpose: every valid A/B/C opportunity is shadow-tracked even when the user never trades it.
 * The records live in the existing V10.2.2 shadow ledger so the already-audited state-learning
 * engine can learn from them after the normal de-correlation gate. Hard blockers are untouched.
 */
const ABC_SHADOW_SOURCE='ABC_AUTO_V264';
const ABC_SHADOW_EPISODE_MS=Math.max(20*60_000,Math.min(2*60*60_000,Number(process.env.ABC_SHADOW_EPISODE_MS||STATE_LEARNING_DEDUP_MS||45*60_000)));
const ABC_SHADOW_MIN_GRADE_SAMPLE=Math.max(12,Math.min(60,Number(process.env.ABC_SHADOW_MIN_GRADE_SAMPLE||20)));
const ABC_SHADOW_MAX_BONUS=Math.max(1,Math.min(5,Number(process.env.ABC_SHADOW_MAX_BONUS||4)));

function abcShadowTagged(x){return x?.version==='V10.2.2'&&x?.shadowSource===ABC_SHADOW_SOURCE}
function abcShadowGrade(v){const g=String(v||'C').toUpperCase();return ['A','B','C'].includes(g)?g:'C'}
function abcShadowStats(rows){return shadowStats((rows||[]).filter(x=>x?.status==='RESOLVED'&&['WIN','LOSS','TIMEOUT'].includes(x.result)))}
function abcShadowAdjustmentFromStats(stats){
  const sample=Number(stats?.sample||0);if(sample<ABC_SHADOW_MIN_GRADE_SAMPLE)return 0;
  const base=stateLearningAdjustmentFromStats(stats),cap=sample>=100?ABC_SHADOW_MAX_BONUS:sample>=50?Math.min(3,ABC_SHADOW_MAX_BONUS):Math.min(2,ABC_SHADOW_MAX_BONUS);
  return clamp(Number(base||0),-cap,cap);
}
function abcShadowLearningForTracker(t,direction,regime,strategyId){
  const assetClass=mentorAssetForTrackerV2622(t),all=edgeRowsV2621().filter(x=>abcShadowTagged(x)&&String(x.direction||'')===String(direction||'')),same=all.filter(x=>mentorAssetV2622(x)===assetClass);
  let rows=edgeDedupV2621(same.filter(x=>String(x.strategyId||'')===String(strategyId||'')&&String(x.marketRegime||'')===String(regime||'')),x=>cleanFuturesSymbol(x.symbol)),level='同資產·策略×狀態';if(rows.length<ABC_SHADOW_MIN_GRADE_SAMPLE){rows=edgeDedupV2621(same.filter(x=>String(x.strategyId||'')===String(strategyId||'')),x=>cleanFuturesSymbol(x.symbol));level='同資產·策略'}if(rows.length<ABC_SHADOW_MIN_GRADE_SAMPLE){rows=edgeDedupV2621(same,x=>String(cleanFuturesSymbol(x.symbol))+'|'+String(x.strategyId||''));level='同資產·方向'}
  let st=edgeStatsV2621(rows),adjustment=edgeAdjFromStatsV2621(st,rows.length>=100?4:rows.length>=50?3:2),crossAsset=false;if(st.sample<ABC_SHADOW_MIN_GRADE_SAMPLE){const g=edgeDedupV2621(all,x=>String(cleanFuturesSymbol(x.symbol))+'|'+String(x.strategyId||'')),gs=edgeStatsV2621(g);if(gs.sample>=Math.max(50,ABC_SHADOW_MIN_GRADE_SAMPLE*2)){st=gs;adjustment=clamp(edgeAdjFromStatsV2621(gs,1),-1,1);level='跨資產弱參考';crossAsset=true}else adjustment=0}
  return {sample:Number(st.sample||0),hitRate:manualFinite(st.hitRate),profitFactor:manualFinite(st.netProfitFactor),expectancyR:manualFinite(st.netExpectancyR),adjustment,level,active:st.sample>=ABC_SHADOW_MIN_GRADE_SAMPLE,assetClass,crossAsset,netOfCost:true};
}
function abcShadowLearningSummary(){
  const all=shadowPerformance.filter(abcShadowTagged),resolved=all.filter(x=>x.status==='RESOLVED'),eligible=resolved.filter(x=>x.learningEligible!==false),byGrade=['A','B','C'].map(key=>{const rows=eligible.filter(x=>abcShadowGrade(x.manualGradeAtEntry)===key),stats=abcShadowStats(rows);return {key,...stats,adjustment:abcShadowAdjustmentFromStats(stats)}});
  const overall=abcShadowStats(eligible),active=all.filter(x=>x.status==='ACTIVE').length;
  return {version:'V2.6.5',source:ABC_SHADOW_SOURCE,sample:all.length,active,resolved:resolved.length,learningEligibleResolved:eligible.length,minSample:ABC_SHADOW_MIN_GRADE_SAMPLE,maxBonus:ABC_SHADOW_MAX_BONUS,episodeMinutes:Math.round(ABC_SHADOW_EPISODE_MS/60000),overall,byGrade};
}
function abcShadowEpisodeRecord(row,now=Date.now()){
  const symbol=cleanFuturesSymbol(row?.symbol),direction=row?.direction==='SHORT'?'SHORT':'LONG';
  if(!symbol)return null;
  return shadowPerformance.find(x=>abcShadowTagged(x)&&x.symbol===symbol&&x.direction===direction&&Math.abs(now-new Date(x.shadowAt||0).getTime())<ABC_SHADOW_EPISODE_MS)||null;
}
function abcShadowLevels(row){
  const referenceEntry=manualFinite(row?.entry?.price),liveEntry=manualFinite(row?.entry?.currentPrice),stop=manualFinite(row?.entry?.stop),suppliedTarget=manualFinite(row?.entry?.target),dir=row?.direction==='SHORT'?-1:1;
  const useLive=liveEntry>0,entry=useLive?liveEntry:referenceEntry;
  if(!(entry>0&&stop>0&&dir*(stop-entry)<0))return null;
  const risk=Math.abs(entry-stop);if(!(risk>0))return null;
  const suppliedValid=suppliedTarget>0&&dir*(suppliedTarget-entry)>0;
  const target=suppliedValid?suppliedTarget:entry+dir*risk;
  return {entry,stop,target,risk,targetDerived:!suppliedValid,referenceEntry,entrySource:useLive?'CURRENT_PRICE':'REFERENCE_ENTRY'};
}
function abcShadowLevelsValid(row){return Boolean(abcShadowLevels(row))}
function abcShadowCapture(rows){
  const now=Date.now(),audit={seen:0,created:0,updated:0,skippedNoTracker:0,skippedNoLevels:0,learningEligible:0,derivedTargets:0,currentPriceEntries:0,referenceEntries:0};
  for(const row of rows||[]){
    audit.seen++;
    const t=row?.signalKey?testSignalTrackers.get(row.signalKey):null;if(!t){audit.skippedNoTracker++;continue}
    const levels=abcShadowLevels(row);if(!levels){audit.skippedNoLevels++;continue}
    const existing=abcShadowEpisodeRecord(row,now);
    if(existing){
      const grade=abcShadowGrade(row.grade),old=abcShadowGrade(existing.manualGradeCurrent||existing.manualGradeAtEntry);
      if(old!==grade){existing.gradeTimeline=Array.isArray(existing.gradeTimeline)?existing.gradeTimeline:[];existing.gradeTimeline.push({at:new Date(now).toISOString(),from:old,to:grade,score:Number(row.executionScore||0)});existing.gradeTimeline=existing.gradeTimeline.slice(-12)}
      existing.manualGradeCurrent=grade;existing.manualExecutionScoreCurrent=Number(row.executionScore||0);existing.manualRankCurrent=Number(row.rank||0)||null;existing.structureStateCurrent=String(row.structure?.state||'UNKNOWN');existing.structureHealthCurrent=manualFinite(row.structure?.health);existing.abcLastSeenAt=new Date(now).toISOString();
      audit.updated++;continue;
    }
    const {entry,stop,target,risk,targetDerived,referenceEntry,entrySource}=levels;if(targetDerived)audit.derivedTargets++;if(entrySource==='CURRENT_PRICE')audit.currentPriceEntries++;else audit.referenceEntries++;
    const features=stateLearningFeatures(t),keys=stateLearningKeys(features),learning=stateLearningAdjustment(t),mentor=institutionalMentorEdgeV2622(t),grade=abcShadowGrade(row.grade),learningEligible=row.freshness!=='STALE'&&Number(row.dataHealth?.coverage||0)>=55&&Number(row.dataHealth?.confidence||0)>=50;
    const id=`abc-shadow-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    const rec={id,version:'V10.2.2',shadowSource:ABC_SHADOW_SOURCE,signalKey:t.key,symbol:t.symbol,assetClass:features.assetClass,assetSession:features.assetSession,assetFamily:features.assetFamily,direction:t.direction,phase:'ABC_GRADE',shadowAt:new Date(now).toISOString(),entryPrice:entry,stop,target,riskDistance:risk,targetR:Number((testSignalDirection(t.direction)*(target-entry)/risk).toFixed(3)),strategyId:features.strategyId,strategyLabel:features.strategyLabel,marketRegime:features.regime,stateFeatures:features,stateKeys:keys,stateLabel:`ABC ${grade}｜${features.strategyLabel}｜${features.regime}｜${features.direction}`,rawScore:Number(row.executionScore||0),adjustedScore:Number(row.executionScore||0),learningAdjustmentAtEntry:Number(learning.adjustment||0),mentorModelVersion:SHADOW_MENTOR_VERSION_V2622,institutionalEdgeAtEntry:Number(mentor?.edgeScore||0),mentorConfidenceAtEntry:Number(mentor?.confidenceScore||0),mentorForwardStatusAtEntry:String(mentor?.forward?.status||'COLLECTING'),tierAtEntry:String(row.notificationTier||'VALID'),learningEligible,shadowProgress:manualFinite(row.observationProgress),blockReasons:Array.isArray(row.risks)?row.risks.slice(0,8):[],notified:Boolean(t.lastEntryNotificationAt||t.notificationSentAt),notificationId:t.lastEntryNotificationId||null,
      manualGradeAtEntry:grade,manualGradeCurrent:grade,manualExecutionScoreAtEntry:Number(row.executionScore||0),manualExecutionScoreCurrent:Number(row.executionScore||0),manualRankAtEntry:Number(row.rank||0)||null,manualRankCurrent:Number(row.rank||0)||null,structureStateAtEntry:String(row.structure?.state||'UNKNOWN'),structureStateCurrent:String(row.structure?.state||'UNKNOWN'),structureHealthAtEntry:manualFinite(row.structure?.health),structureHealthCurrent:manualFinite(row.structure?.health),structureLearningAdjustmentAtEntry:manualFinite(row.structure?.learningAdjustment),abcCreatedWithoutManualTrade:true,abcTargetDerived:targetDerived,abcEntryPriceSource:entrySource,abcReferenceEntryPrice:referenceEntry,abcLastSeenAt:new Date(now).toISOString(),gradeTimeline:[],
      status:'ACTIVE',result:null,resultAt:null,exitPrice:null,grossReturnPct:null,netReturnPct:null,realizedR:null,mfePct:0,maePct:0,maxR:0,minR:0,snapshots:{},lastPrice:entry,lastPriceAt:new Date(now).toISOString(),lastSource:'abc-shadow-entry',costBps:PERF_ROUND_TRIP_COST_BPS};
    shadowPerformance.unshift(rec);shadowActiveSymbols.add(cleanFuturesSymbol(rec.symbol));scheduleShadowPerformanceSave();shadowOnPrice(rec.symbol,entry,now,'abc-shadow-entry');audit.created++;if(learningEligible)audit.learningEligible++;
  }
  return audit;
}

/* ABC_SHADOW_UI_HISTORY_V268
 * UI-only recent history. Learning ledgers are NOT deleted when these rows disappear from the screen.
 * Keeps /api/manual-opportunities small; detail rows are fetched only when the user opens History/SAMPLE.
 */
const ABC_SHADOW_UI_HISTORY_MINUTES_V268=360;
const ABC_SHADOW_UI_HISTORY_LIMIT_V268=30;
const ABC_SHADOW_UI_SAMPLE_LIMIT_V268=12;
function abcShadowUiTimeV268(v){const n=v?Date.parse(v):0;return Number.isFinite(n)?n:0}
function abcShadowUiRecentV268(){
  const now=Date.now(),cutoff=now-ABC_SHADOW_UI_HISTORY_MINUTES_V268*60_000;
  const rows=shadowPerformance.filter(x=>abcShadowTagged(x)&&abcShadowUiTimeV268(x.shadowAt)>=cutoff)
    .sort((a,b)=>abcShadowUiTimeV268(b.shadowAt)-abcShadowUiTimeV268(a.shadowAt))
    .slice(0,ABC_SHADOW_UI_HISTORY_LIMIT_V268)
    .map(x=>({
      id:x.id,symbol:x.symbol,direction:x.direction==='SHORT'?'SHORT':'LONG',
      gradeAtEntry:abcShadowGrade(x.manualGradeAtEntry),gradeCurrent:abcShadowGrade(x.manualGradeCurrent||x.manualGradeAtEntry),
      shadowAt:x.shadowAt,lastSeenAt:x.abcLastSeenAt||x.lastPriceAt||x.shadowAt,status:x.status,result:x.result,resultAt:x.resultAt,
      learningEligible:x.learningEligible!==false,
      sampleEligible:x.status==='RESOLVED'&&x.learningEligible!==false&&['WIN','LOSS','TIMEOUT'].includes(String(x.result||'')),
      entryPrice:Number.isFinite(Number(x.entryPrice))?Number(x.entryPrice):null,
      stop:Number.isFinite(Number(x.stop))?Number(x.stop):null,
      target:Number.isFinite(Number(x.target))?Number(x.target):null
    }));
  return {ok:true,version:'V2.6.8',generatedAt:new Date(now).toISOString(),historyMinutes:ABC_SHADOW_UI_HISTORY_MINUTES_V268,limit:ABC_SHADOW_UI_HISTORY_LIMIT_V268,sampleLimit:ABC_SHADOW_UI_SAMPLE_LIMIT_V268,rows};
}
app.get('/api/manual-shadow-history',(_req,res)=>{res.set('cache-control','private, max-age=30');res.json(abcShadowUiRecentV268())});

async function manualOpportunityLoop(){
  if(manualOpportunityBusy){manualOpportunityTimer=setTimeout(manualOpportunityLoop,MANUAL_MODE_REFRESH_MS);return}
  manualOpportunityBusy=true;
  try{
    const data=await manualOpportunityResponse(true),prefs=manualPrefRows(),subs=loadSubRecords(),byEndpoint=new Map(subs.map(x=>[x.endpoint,x])),now=Date.now();let dirty=false;
    for(const pref of prefs){
      if(pref?.enabled!==true)continue;const rec=byEndpoint.get(pref.endpoint);if(!rec?.subscription)continue;pref.lastSent=pref.lastSent&&typeof pref.lastSent==='object'?pref.lastSent:{};
      const notifyRowsV2682=(Array.isArray(data?.rows)?data.rows:[]).filter(row=>row?.candidate!==true&&['A','B'].includes(String(row?.grade||'').toUpperCase())).sort((a,b)=>{const pa=String(a?.grade||'')==='A'?3:(a?.worthWatch?.mode==='WORTH_WATCH'?2:1),pb=String(b?.grade||'')==='A'?3:(b?.worthWatch?.mode==='WORTH_WATCH'?2:1);return pb-pa||Number(b?.worthWatch?.score||b?.executionScore||0)-Number(a?.worthWatch?.score||a?.executionScore||0)});
      for(const row of notifyRowsV2682.slice(0,20)){
        if(!manualNotificationEligibleV2665(pref,row))continue;
        const tag=[row.symbol,row.direction,row.grade].join(':'),last=Number(pref.lastSent[tag]||0);if(last&&now-last<MANUAL_MODE_NOTIFY_COOLDOWN_MS)continue;
        try{
          const isWorthWatchV2682=row?.worthWatch?.mode==='WORTH_WATCH';
          const body=isWorthWatchV2682?('值得看 '+Number(row?.worthWatch?.score||row.executionScore||0).toFixed(1)+'分｜'+(row.structure?.label||'等待結構')+(row.entry?.rr?'｜TP2 RR '+row.entry.rr:'')+'｜開圖後由你決定是否扣扳機'):('執行 '+row.executionScore+'分｜'+(row.structure?.label||'等待結構')+(row.entry?.rr?'｜TP2 RR '+row.entry.rr:'')+'｜手動篩選，非自動進場');
          const title=isWorthWatchV2682?('影子精選｜B級值得看｜'+row.symbol+' '+(row.direction==='SHORT'?'做空':'做多')):('手動影子｜'+row.grade+'級｜'+row.symbol+' '+(row.direction==='SHORT'?'做空':'做多'));
          await webpush.sendNotification(rec.subscription,JSON.stringify({title,body,tag:'shadow-'+row.symbol+'-'+row.direction,renotify:false,data:{url:'/?page=ideas&manual=1'}}),{TTL:180,urgency:row.grade==='A'?'high':'normal'});
          noticeDedupMarkV2616(rec.endpoint,row.symbol,row.direction,now);pref.lastSent[tag]=now;dirty=true;
        }catch(e){if([404,410].includes(e?.statusCode)){pref.enabled=false;dirty=true}}
      }
    }
    if(dirty)manualSavePrefs(prefs);
  }catch(e){console.warn('[manual-v263]',String(e?.message||e))}
  finally{manualOpportunityBusy=false;manualOpportunityTimer=setTimeout(manualOpportunityLoop,MANUAL_MODE_REFRESH_MS);manualOpportunityTimer.unref?.()}
}

app.get('/api/manual-candidate-archive',(_req,res)=>res.json({ok:true,version:'V2.6.67',rows:manualCandidateArchiveRowsV2667()}));

app.get('/api/manual-candidate-history',(_req,res)=>{
  res.json({ok:true,version:'V2.6.71',visibleHours:24,backendDays:7,rows:manualCandidateHistoryRowsV2671()});
});
app.post('/api/manual-candidate-dismiss',(req,res)=>{
  try{
    const body=req.body||{},action=String(body.action||'dismiss').toLowerCase(),key=String(body.candidateKey||'').trim();
    if(!key)return res.status(400).json({error:'candidateKey required'});
    if(action==='restore'){
      manualCandidateUnskipV2671(key);
      return res.json({ok:true,action:'restore',candidateKey:key});
    }
    const now=Date.now(),st=manualCandidateStateV2664.get(key);
    if(st?.snapshot){
      const m=st.metric||manualCandidateScoreV2664(st.snapshot);
      manualCandidateArchiveV2667(st,st.snapshot,m,'MANUAL_DISMISS','使用者主動移出候選',now);
      manualCandidateStateV2664.delete(key);manualCandidateSaveStateV2664();
    }else{
      manualCandidateFallbackArchiveV2671(body,now);
    }
    manualCandidateSkipKeyV2671(key,'MANUAL_DISMISS');
    res.json({ok:true,action:'dismiss',candidateKey:key,skipMinutes:60});
  }catch(e){res.status(500).json({error:String(e?.message||e)})}
});
app.get('/api/worth-watch-v2682',(_req,res)=>{
  try{
    const audit=loadJson(WORTH_WATCH_AUDIT_FILE_V2682,{events:[]});
    res.json({ok:true,version:'V2.6.83',definition:'B=值得打開圖，由使用者自己扣扳機；新 B 20 分鐘防抖，軟性轉弱不會瞬間消失；A=高完成度正式確認',thresholds:WORTH_WATCH_DEFAULTS_V2682,sticky:{lockMinutes:Math.round(WORTH_WATCH_STICKY_LOCK_MS_V2683/60_000),graceMinutes:Math.round(WORTH_WATCH_STICKY_GRACE_MS_V2683/60_000),missLimit:WORTH_WATCH_STICKY_MISS_LIMIT_V2683},current:worthWatchLastSnapshotV2682,recent:(audit?.events||[]).slice(0,50)});
  }catch(e){res.status(500).json({ok:false,error:String(e?.message||e)})}
});
app.get('/api/manual-opportunities',async(req,res)=>{try{res.json(await manualOpportunityResponse(String(req.query?.force||'')==='1'))}catch(e){res.status(503).json({ok:false,error:String(e?.message||e)})}});
app.get('/api/manual-preferences',(req,res)=>{const endpoint=String(req.query?.endpoint||'');const p=manualPrefRows().find(x=>x.endpoint===endpoint);res.json({ok:true,enabled:p?.enabled===true,mode:manualNotifyMode(p?.mode)})});
app.post('/api/manual-preferences',(req,res)=>{const endpoint=String(req.body?.endpoint||'');if(!endpoint)return res.status(400).json({ok:false,error:'MISSING_ENDPOINT'});const rows=manualPrefRows(),idx=rows.findIndex(x=>x.endpoint===endpoint),old=idx>=0?rows[idx]:{},next={...old,endpoint,enabled:req.body?.enabled===true,mode:manualNotifyMode(req.body?.mode),updatedAt:new Date().toISOString(),lastSent:old.lastSent&&typeof old.lastSent==='object'?old.lastSent:{}};if(idx>=0)rows[idx]=next;else rows.push(next);manualSavePrefs(rows);res.json({ok:true,enabled:next.enabled,mode:next.mode})});

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

app.get('/api/structure-learning',(_req,res)=>res.json({ok:true,generatedAt:new Date().toISOString(),summary:structureV2Summary(),recent:structureLearning.filter(x=>x?.version===STRUCTURE_ENGINE_VERSION).slice(0,300)}));
app.get('/api/structure-learning.csv',(_req,res)=>{const cols=['at','symbol','direction','assetClass','pattern','marketEpisodeId','strategyId','strategyLabel','marketRegime','state','rawState','label','rawHealth','learningAdjustment','health','confidence','retracementRatio','retracementBucket','reasonCodes','reasons','price','entryPrice','originalInvalidation','protection','poc15','protectedSwing15','protectedSwing30','primaryLevel','successPrice','failurePrice','traderLastAction','traderAddsDuringEpisode','traderReducesDuringEpisode','status','outcome','outcomeAt','maxFavorablePct','maxAdversePct'];const rows=structureLearning.filter(x=>x?.version===STRUCTURE_ENGINE_VERSION),csv=[cols.join(','),...rows.map(x=>cols.map(k=>structureV2CsvEscape(x[k])).join(','))].join('\n');res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename=structure-learning-v2-'+new Date().toISOString().slice(0,10)+'.csv');res.send('\uFEFF'+csv)});
app.get('/api/actual-trades',(_req,res)=>res.json({ok:true,generatedAt:new Date().toISOString(),summary:actualTradeAggregate(),records:actualTrades.filter(x=>x?.version==='V10.2.6').slice(0,300)}));
app.post('/api/actual-trades',(req,res)=>{try{const out=actualTradeRecord(req.body||{});if(out.error)return res.status(400).json({ok:false,error:out.error});res.json({ok:true,record:out.rec,summary:actualTradeAggregate()})}catch(e){res.status(500).json({ok:false,error:String(e?.message||e)})}});
app.patch('/api/actual-trades/:id',(req,res)=>{const id=String(req.params?.id||''),rec=actualTrades.find(x=>x?.version==='V10.2.6'&&x.id===id);if(!rec)return res.status(404).json({ok:false,error:'not found'});if(req.body?.action==='update'){const out=actualTradeUpdateRecord(rec,req.body||{});if(out.error)return res.status(400).json({ok:false,error:out.error});return res.json({ok:true,record:out.rec,summary:actualTradeAggregate()})}if(req.body?.action==='close'&&rec.status==='ACTIVE'){const px=finiteMetric(req.body?.price)??finiteMetric(realtimeBestPrice(rec.symbol))??finiteMetric(rec.lastPrice);if(!(px>0))return res.status(400).json({ok:false,error:'no price'});rec.status='RESOLVED';rec.result='MANUAL';rec.resultAt=new Date().toISOString();rec.exitPrice=px;rec.estimatedPnl=actualTradePnlAt(rec,px);rec.updatedAt=rec.resultAt;if(!actualTrades.some(x=>x!==rec&&x.status==='ACTIVE'&&x.symbol===rec.symbol))actualTradeActiveSymbols.delete(rec.symbol);scheduleActualTradeSave();return res.json({ok:true,record:rec})}res.status(400).json({ok:false,error:'unsupported action'})});
app.get('/api/actual-trades.csv',(_req,res)=>{const cols=['createdAt','symbol','assetClass','assetSession','direction','strategyId','strategyLabel','marketRegime','notificationTier','entryPrice','tp1','tp2','sp1','sp2','margin','quantity','leverage','manualMode','manualGrade','manualGradeScore','manualGradeAt','manualOpportunityId','manualRank','manualStructureState','manualStructureHealth','manualShadowHitRate','manualShadowProfitFactor','manualRr','notional','status','firstOutcome','firstOutcomeAt','result','resultAt','exitPrice','mfePct','maePct','estimatedProfitTp1','estimatedProfitTp2','estimatedLossSp1','estimatedLossSp2','estimatedPnl'];const rows=actualTrades.filter(x=>x?.version==='V10.2.6'),csv=[cols.join(','),...rows.map(x=>cols.map(k=>escCsv(x[k])).join(','))].join('\n');res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename=actual-trades-v1026-${new Date().toISOString().slice(0,10)}.csv`);res.send('\uFEFF'+csv)});
app.get('/api/performance', (_req,res)=>res.json(performanceResponse()));
app.get('/api/performance.csv', (_req,res)=>{
  const cols=['notificationAt','receivedAt','clickedAt','symbol','direction','phase','tier','strategyLabel','strategyId','observationProgress','marketRegime','entryPrice','stop','target','targetR','calibratedWinRate','dataCoverage','dataConfidence','status','result','resultAt','exitPrice','mfePct','maePct','realizedR','grossReturnPct','netReturnPct','signalToPushMs','pushServiceMs','deliveryLatencyMs','clickLatencyMs','notificationPriceSource'];
  const escCsv=v=>{if(v==null)return'';const x=String(v);return /[\",\n\r]/.test(x)?`\"${x.replace(/\"/g,'\"\"')}\"`:x};
  const rows=signalPerformance.filter(x=>x?.version==='V10.0'),csv=[cols.join(','),...rows.map(x=>cols.map(k=>escCsv(x[k])).join(','))].join('\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename=signal-performance-v10-${new Date().toISOString().slice(0,10)}.csv`);res.send('\uFEFF'+csv);
});
app.get('/api/shadow-performance.csv', (_req,res)=>{
  const cols=['shadowAt','symbol','assetClass','assetSession','direction','strategyLabel','marketRegime','stateLabel','tierAtEntry','finalTier','notified','learningEligible','shadowProgress','blockReasons','stateKeyCore','stateKeyBroad','rawScore','learningAdjustmentAtEntry','adjustedScore','entryPrice','stop','target','status','result','resultAt','mfePct','maePct','realizedR','grossReturnPct','netReturnPct','researchRevisionAtEntry','coreBuildAtEntry','assetClass','primaryBlockClass','blockClassFlags','scoreMeaning','scoreBucket','netR','mentorModelVersion','institutionalEdgeAtEntry','costRatioAtEntry','strategyNetPfAtEntry','strategyNetExpRAtEntry','mentorConfidenceAtEntry','mentorForwardStatusAtEntry'];
  const escCsv=v=>{if(v==null)return'';const x=String(v);return /[",\n\r]/.test(x)?`"${x.replace(/"/g,'""')}"`:x};
  const rows=shadowPerformance.filter(x=>x?.version==='V10.2.2').map(x=>({...x,blockReasons:Array.isArray(x.blockReasons)?x.blockReasons.join('｜'):x.blockReasons||'',stateKeyCore:x.stateKeys?.core||'',stateKeyBroad:x.stateKeys?.broad||'',assetClass:x.assetClassAtEntry||researchAssetClass(x.symbol),primaryBlockClass:x.primaryBlockClassAtEntry||researchPrimaryBlockClass(x),blockClassFlags:Array.isArray(x.blockClassFlagsAtEntry)?x.blockClassFlagsAtEntry.join('|'):researchBlockClasses(x).join('|'),scoreMeaning:x.scoreMeaning||RESEARCH_LAYER_SCORE_MEANING,scoreBucket:researchScoreBucket(x.rawScore),netR:researchNetR(x)})),csv=[cols.join(','),...rows.map(x=>cols.map(k=>escCsv(x[k])).join(','))].join('\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename=shadow-performance-v1022-research-${new Date().toISOString().slice(0,10)}.csv`);res.send('\uFEFF'+csv);
});
app.post('/api/notification-received',(req,res)=>{const id=String(req.body?.id||'');if(!id)return res.status(400).json({ok:false});const found=performanceApplyNotificationAck('received',id,req.body?.at);res.json({ok:true,found});});
app.post('/api/notification-click',(req,res)=>{const id=String(req.body?.id||'');if(!id)return res.status(400).json({ok:false});const found=performanceApplyNotificationAck('clicked',id,req.body?.at);res.json({ok:true,found});});
app.get('/api/research-diagnostics',(_req,res)=>{try{res.json({ok:true,...researchDiagnostics(true)})}catch(e){res.status(500).json({ok:false,error:String(e?.message||e)})}});
app.get('/api/research-audit',(_req,res)=>{try{const audit=researchEnsureAudit({checkpoint:true});res.json({ok:true,revision:RESEARCH_LAYER_REVISION,releaseDate:RESEARCH_LAYER_RELEASE_DATE,coreBuild:BUILD_VERSION,coreRulesChanged:false,audit})}catch(e){res.status(500).json({ok:false,error:String(e?.message||e)})}});
app.get('/api/realtime', (_req,res)=>res.json({ok:true,generatedAt:new Date().toISOString(),...realtimeHealthSnapshot()}));

app.get('/api/self-test', async (req,res)=>{
  const live=String(req.query?.live||'0')==='1',checks=[];
  try{const sm=summarizeDepth([['100','2'],['99','3']],[['101','1'],['102','2']]);checks.push({name:'depth-calculation',ok:sm.ok&&sm.bidNotional>0&&sm.askNotional>0&&Number.isFinite(sm.spreadBps)})}catch(e){checks.push({name:'depth-calculation',ok:false,error:String(e?.message||e)})}
  try{const tech=technicalSnapshot(Array.from({length:90},(_,i)=>({open:100+i*.08,high:100.3+i*.08,low:99.7+i*.08,close:100.1+i*.08,volume:1000+i,openTime:i*300000,closeTime:(i+1)*300000-1})));checks.push({name:'technical-indicators',ok:Number.isFinite(tech.rsi14)&&Number.isFinite(tech.atr14)&&Number.isFinite(tech.adx14)})}catch(e){checks.push({name:'technical-indicators',ok:false,error:String(e?.message||e)})}
  try{const u1=realtimeSocketUrl('public',['BTCUSDT']),u2=realtimeSocketUrl('market',['BTCUSDT']);checks.push({name:'websocket-url',ok:u1.includes('/public/stream?streams=')&&u1.includes('btcusdt@depth20@100ms')&&u2.includes('/market/stream?streams=')&&u2.includes('btcusdt@aggTrade')})}catch(e){checks.push({name:'websocket-url',ok:false,error:String(e?.message||e)})}
  try{const perf=performanceAggregate([{version:'V10.0',status:'RESOLVED',result:'WIN',realizedR:1,grossReturnPct:1,netReturnPct:.88,mfePct:1.2,maePct:.2,tier:'HIGH',direction:'LONG',marketRegime:'TREND_UP',symbol:'BTCUSDT',calibratedWinRate:65,signalToPushMs:2800,pushServiceMs:120,deliveryLatencyMs:430}],false);checks.push({name:'performance-ledger',ok:perf.sample===1&&perf.wins===1&&perf.hitRate===100})}catch(e){checks.push({name:'performance-ledger',ok:false,error:String(e?.message||e)})}
  try{const adj=stateLearningAdjustmentFromStats({sample:100,hitRate:68,expectancyR:.25,profitFactor:1.8});checks.push({name:'state-learning-bounds',ok:adj>0&&adj<=STATE_LEARNING_MAX_BONUS,value:adj})}catch(e){checks.push({name:'state-learning-bounds',ok:false,error:String(e?.message||e)})}
  const liveRows=[];
  if(live){for(const symbol of ['BTCUSDT','ETHUSDT']){const started=Date.now();try{const [c,m,d,r,x]=await Promise.all([testFetchCandles(symbol,'5m',120),testFetchMicrostructure(symbol),testFetchDerivatives(symbol),testFetchRiskContext(symbol),testFetchCrossExchange(symbol).catch(()=>null)]);const source=testCandleSourceCache.get(`${symbol}:5m:120`);const ok=Array.isArray(c)&&c.length>=60&&m?._health?.depth===true&&(d?._health?.oi===true||d?._health?.taker===true)&&r?._health?.mark===true;const row={name:`live-${symbol}`,ok,elapsedMs:Date.now()-started,sources:{candles:source?.source||source||null,depth:m?._source?.depth||null,oi:d?._source?.oi||null,taker:d?._source?.taker||null,mark:r?._source?.mark||null,funding:r?._source?.funding||null,crossAvailable:x?.available??null}};checks.push(row);liveRows.push(row)}catch(e){const row={name:`live-${symbol}`,ok:false,elapsedMs:Date.now()-started,error:String(e?.message||e)};checks.push(row);liveRows.push(row)}}}
  const realtime=realtimeHealthSnapshot();
  res.json({ok:checks.every(x=>x.ok),version:BUILD_VERSION,live,generatedAt:new Date().toISOString(),checks,liveRows,realtime,performance:{records:signalPerformance.filter(x=>x.version==='V10.0').length,shadowRecords:shadowPerformance.filter(x=>x.version==='V10.2.2').length}});
});

/* TEST_SIGNALS_NONBLOCKING_V256_20260902 */
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

app.post('/api/test-signal-push', async (req, res) => {
  try {
    const endpoint=String(req.body?.endpoint||'');
    const result=await sendPush({
      title:'影子測試｜A級通知通道正常',
      body:'BTCUSDT 做多｜測試用 A 級訊號，不會寫入績效或學習樣本。',
      tag:`shadow-test-${Date.now()}`,
      renotify:true,
      data:{url:'/?page=monitor&testSignal=BTCUSDT&dir=LONG'},
    }, {forceTest:true,endpoint:endpoint||null});
    if(result.sent<1)return res.status(503).json({ok:false,error:'NO_PUSH_SENT',...result,subscriptions:loadSubRecords().length});
    res.json({ok:true,...result,subscriptions:loadSubRecords().length});
  } catch (e) {
    res.status(500).json({ok:false,error:String(e?.message||e)});
  }
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
    testSignals: { scanMs: TEST_SIGNAL_SCAN_MS, max: TEST_SIGNAL_MAX, confirmScore: TEST_SIGNAL_CONFIRM_SCORE, weakFlags: TEST_MONITOR_WEAK_FLAGS, stateBars: TEST_MONITOR_STATE_BARS, routeToMonitor: true, lifecycle: true, reentry:true, reentryScore:TEST_REENTRY_SCORE, reentryConfirmBars:TEST_REENTRY_CONFIRM_BARS, structureEngine:{version:STRUCTURE_ENGINE_VERSION,minLearningSample:STRUCTURE_V2_MIN_SAMPLE,maxAdjustment:STRUCTURE_V2_MAX_ADJUST,notifyMinHealth:STRUCTURE_V2_NOTIFY_MIN_HEALTH,notifyMinConfidence:STRUCTURE_V2_NOTIFY_MIN_CONFIDENCE,notifyCooldownMinutes:Math.round(STRUCTURE_V2_NOTIFY_COOLDOWN_MS/60000)} },
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


app.get('/api/chart-data', async (req, res) => {
  const symbol = cleanFuturesSymbol(req.query?.symbol || 'BTCUSDT');
  const interval = String(req.query?.interval || '15m').toLowerCase();
  const allowed = new Set(['5m','15m','30m','1h']);
  const limit = Math.max(80, Math.min(500, Number(req.query?.limit || 260)));
  if (!/^[A-Z0-9]{3,24}USDT$/.test(symbol)) return res.status(400).json({ok:false,error:'invalid symbol'});
  if (!allowed.has(interval)) return res.status(400).json({ok:false,error:'invalid interval'});
  try {
    const rows = await testFetchCandles(symbol, interval, limit);
    const source = testCandleSourceCache.get(`${symbol}:${interval}:${limit}`) || {};
    const candles = (rows || []).slice(-limit).map(c => ({
      time: Math.floor(Number(c.openTime) / 1000),
      open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close), volume: Number(c.volume || 0)
    })).filter(c => Number.isFinite(c.time) && [c.open,c.high,c.low,c.close].every(Number.isFinite));
    if (candles.length < 40) throw new Error('chart candles too short');
    const currentPrice = finiteMetric(realtimeBestPrice(symbol)) ?? finiteMetric(candles.at(-1)?.close);
    res.json({ok:true,symbol,interval,source:source.source||'Binance',fallback:source.fallback===true,currentPrice,generatedAt:new Date().toISOString(),candles});
  } catch (e) {
    res.status(503).json({ok:false,error:String(e?.message||e)});
  }
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
  try {
    const endpoint=String(req.body?.endpoint||'');
    const result=await sendPush({
      title:'推播測試｜通知通道正常',
      body:'如果你看到這則，Service Worker、VAPID、Subscription、Railway Web Push 都正常。',
      tag:`notify-test-${Date.now()}`,
      renotify:true,
      data:{url:'/?page=monitor'},
    }, {forceTest:true,endpoint:endpoint||null});
    if(result.sent<1)return res.status(503).json({ok:false,error:'NO_PUSH_SENT',...result,subscriptions:loadSubRecords().length});
    res.json({ok:true,...result,subscriptions:loadSubRecords().length});
  } catch (e) {
    res.status(500).json({ok:false,error:String(e?.message||e)});
  }
});

app.post('/api/test-pullback-push', async (req, res) => {
  try {
    const endpoint=String(req.body?.endpoint||'');
    const result=await sendPush({
      title:'策略測試｜影子通知通道正常',
      body:'BTCUSDT 做多｜這是測試，不是進場訊號。',
      tag:`shadow-test-${Date.now()}`,
      renotify:true,
      data:{url:'/?page=monitor&testSignal=BTCUSDT&dir=LONG'},
    }, {forceTest:true,endpoint:endpoint||null});
    if(result.sent<1)return res.status(503).json({ok:false,error:'NO_PUSH_SENT',...result,subscriptions:loadSubRecords().length});
    res.json({ok:true,...result,subscriptions:loadSubRecords().length});
  } catch (e) {
    res.status(500).json({ok:false,error:String(e?.message||e)});
  }
});

// RAILWAY_HOBBY_V267: lightweight capacity telemetry for checking whether Hobby resources are actually useful.
function hobbyDirectoryBytesV267(dir){
  let total=0;try{for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);try{const st=fs.statSync(p);if(st.isFile())total+=st.size;else if(st.isDirectory()&&name==='backups-v267')for(const sub of fs.readdirSync(p)){try{total+=fs.statSync(path.join(p,sub)).size}catch{}}}catch{}}}catch{}return total
}
function hobbyDiskV267(){
  try{const x=fs.statfsSync(DATA_DIR),block=Number(x.bsize||x.frsize||4096);return {totalBytes:Number(x.blocks||0)*block,freeBytes:Number(x.bavail||x.bfree||0)*block}}catch{return {totalBytes:null,freeBytes:null}}
}
app.get('/api/runtime-capacity', (_req,res)=>{
  const mem=process.memoryUsage(),disk=hobbyDiskV267();
  res.json({ok:true,profile:'HOBBY_V267',uptimeSec:Math.round(process.uptime()),memory:{rssBytes:mem.rss,heapUsedBytes:mem.heapUsed,heapTotalBytes:mem.heapTotal},storage:{dataDir:DATA_DIR,dataBytes:hobbyDirectoryBytesV267(DATA_DIR),...disk},learning:{shadowRecords:shadowPerformance.length,shadowMax:SHADOW_MAX_RECORDS,performanceRecords:signalPerformance.length,performanceMax:PERF_HISTORY_MAX_RECORDS,backupKeepDays:HOBBY_BACKUP_KEEP_DAYS},cache:{backtestTtlMs:BACKTEST_CACHE_MS}})
});

app.get('/api/push-health', (_req,res)=>{
  const records=loadSubRecords(),manual=typeof manualPrefRows==='function'?manualPrefRows():[];
  res.json({
    ok:true,
    version:'V2.6.65',
    subscriptions:records.length,
    autoShadowEnabled:records.filter(x=>x?.testSignalEnabled===true).length,
    manualShadowEnabled:manual.filter(x=>x?.enabled===true).length,
    coreTraderEnabled:records.filter(x=>(x?.enabledTraders||[]).includes(CORE_TRADER_ID)).length,
    vapidPublicFingerprint:String(vapid?.publicKey||'').slice(0,8)+'…'+String(vapid?.publicKey||'').slice(-6),
    tests:{general:'/api/test-push',shadow:'/api/test-signal-push'},
    policy:'CORE_TRADER + FORMAL_SHADOW_A_B; USER_TEST_BYPASS_ONLY'
  });
});

app.get('/api/shadow-bootcamp-v2681',(_req,res)=>{try{res.json(bootcampSummaryV2681())}catch(e){res.status(500).json({ok:false,error:String(e?.message||e)})}});

app.get('/api/shadow-mentor',(_req,res)=>{try{res.set('cache-control','private, max-age=10');res.json(mentorTrainingSummaryV2622())}catch(e){res.status(500).json({ok:false,error:String(e?.message||e)})}});

app.get('/healthz', (_req, res) => {
  const rows = [...states.values()];

  res.json({
    ok: rows.some(s => Boolean(s.lastFetch)),
    healthy: rows.filter(s => Boolean(s.lastFetch)).length,
    total: rows.length,
    mode: BUILD_VERSION,
    realtime: realtimeHealthSnapshot(),
    performanceRecords: signalPerformance.filter(x=>x.version==='V10.0').length,
    shadowPerformanceRecords: shadowPerformance.filter(x=>x.version==='V10.2.2').length,
    actualTradeRecords: actualTrades.filter(x=>x.version==='V10.2.6').length,
  });
});

if (process.env.UNIT_TEST !== '1') {
  app.listen(PORT, () => {
    researchEnsureAudit({checkpoint:true});
    console.log(`[research-layer] ${RESEARCH_LAYER_REVISION} · core=${BUILD_VERSION} · research-only`);
    console.log(`Position Alert V10.2.7 SOLO MAX RECOVERABLE MONITOR started on ${PORT}`);
    console.log(`Tracking: ${TRADERS.map(t => `${t.name}(${t.id})`).join(', ')}`);
    loop();
    statsTimer = setTimeout(statsLoop, 8000);
    referenceTimer = setTimeout(referenceLoop, 12000);
    screenTimer = setTimeout(screenLoop, 16000);
    dailyBriefTimer = setTimeout(dailyBriefLoop, 25000);
    testSignalTimer = setTimeout(testSignalLoop, 8000);
    manualOpportunityTimer=setTimeout(manualOpportunityLoop,12000);
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
  if (manualOpportunityTimer) clearTimeout(manualOpportunityTimer);
  if (testBarTimer) clearTimeout(testBarTimer);
  if (performanceTimer) clearInterval(performanceTimer);
  if (performanceSaveTimer) clearTimeout(performanceSaveTimer);
  if (shadowPerformanceSaveTimer) clearTimeout(shadowPerformanceSaveTimer);
  if (actualTradeSaveTimer) clearTimeout(actualTradeSaveTimer);
  researchEnsureAudit({checkpoint:true});
  saveJson(SIGNAL_PERFORMANCE_FILE,signalPerformance.slice(0,PERF_HISTORY_MAX_RECORDS));
  saveJson(SHADOW_PERFORMANCE_FILE,shadowPerformance.slice(0,SHADOW_MAX_RECORDS));
  saveJson(ACTUAL_TRADE_FILE,actualTrades.slice(0,1500));
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
  shadowStats,
  stateLearningAdjustmentFromStats,
  stateLearningAdjustment,
  shadowPerformanceAggregate,
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

// STRUCTURE_ENGINE_V21_20260902


/* CANDIDATE_UI_NOTIFY_CUSTOM_V2673_20260904 */
const NOTIFICATION_CUSTOM_FILE_V2673=path.join(DATA_DIR,'notification-custom-v2673.json');
const CANDIDATE_NOTICE_DEDUP_FILE_V2673=path.join(DATA_DIR,'candidate-notice-dedup-v2673.json');
const CANDIDATE_NOTICE_REARM_MS_V2673=30*60*1000;
const CANDIDATE_NOTICE_SCAN_MS_V2673=90*1000;
let candidateNoticeBusyV2673=false;

function notificationCustomPrefsV2673(){
  const raw=loadJson(NOTIFICATION_CUSTOM_FILE_V2673,{});
  const formal=String(raw?.formalMode||'AB').toUpperCase();
  const candidate=String(raw?.candidateMode||'OFF').toUpperCase();
  const minWin=Math.max(45,Math.min(80,Number(raw?.candidateMinWinRate??55)));
  return {
    formalMode:['A','AB'].includes(formal)?formal:'AB',
    candidateMode:['OFF','PRIME','WATCH','ALL'].includes(candidate)?candidate:'OFF',
    candidateMinWinRate:minWin,
    updatedAt:raw?.updatedAt||null
  };
}
function saveNotificationCustomPrefsV2673(next={}){
  const old=notificationCustomPrefsV2673();
  const formal=String(next?.formalMode??old.formalMode).toUpperCase();
  const candidate=String(next?.candidateMode??old.candidateMode).toUpperCase();
  const minWin=Math.max(45,Math.min(80,Number(next?.candidateMinWinRate??old.candidateMinWinRate)));
  const out={
    formalMode:['A','AB'].includes(formal)?formal:old.formalMode,
    candidateMode:['OFF','PRIME','WATCH','ALL'].includes(candidate)?candidate:old.candidateMode,
    candidateMinWinRate:minWin,
    updatedAt:new Date().toISOString()
  };
  saveJson(NOTIFICATION_CUSTOM_FILE_V2673,out);
  return out;
}
function candidateNoticeModeAllowsV2673(mode,band){
  const b=String(band||'').toUpperCase(),m=String(mode||'OFF').toUpperCase();
  if(m==='PRIME')return b==='PRIME';
  if(m==='WATCH')return ['PRIME','WATCH'].includes(b);
  if(m==='ALL')return ['PRIME','WATCH','RELATIVE','RESEARCH'].includes(b);
  return false;
}
function candidateNoticeDedupV2673(){
  const x=loadJson(CANDIDATE_NOTICE_DEDUP_FILE_V2673,{});
  return x&&typeof x==='object'&&!Array.isArray(x)?x:{};
}
function candidateNoticeCanSendV2673(symbol,direction,now=Date.now()){
  const m=candidateNoticeDedupV2673(),k=[cleanFuturesSymbol(symbol),String(direction||'LONG').toUpperCase()].join('|');
  const at=Number(m[k]||0);
  return !(at>0&&now-at<CANDIDATE_NOTICE_REARM_MS_V2673);
}
function candidateNoticeMarkV2673(symbol,direction,now=Date.now()){
  const m=candidateNoticeDedupV2673(),cut=now-24*60*60*1000;
  for(const [k,v] of Object.entries(m))if(Number(v)<cut)delete m[k];
  m[[cleanFuturesSymbol(symbol),String(direction||'LONG').toUpperCase()].join('|')]=now;
  saveJson(CANDIDATE_NOTICE_DEDUP_FILE_V2673,m);
}
function candidateNoticeLabelV2673(band){
  return ({PRIME:'優先候選',WATCH:'觀察候選',RELATIVE:'相對候選',RESEARCH:'研究候選'})[String(band||'').toUpperCase()]||'候選';
}
async function candidateNoticeTickV2673(){
  if(candidateNoticeBusyV2673)return;
  const pref=notificationCustomPrefsV2673();
  if(pref.candidateMode==='OFF')return;
  candidateNoticeBusyV2673=true;
  try{
    const data=await manualOpportunityResponse(false);
    const rows=(Array.isArray(data?.rows)?data.rows:[])
      .filter(x=>x?.candidate===true&&x?.trade?.status!=='ACTIVE')
      .filter(x=>candidateNoticeModeAllowsV2673(pref.candidateMode,x.candidateBand))
      .filter(x=>Number(x?.candidateWinRate||0)>=pref.candidateMinWinRate)
      .sort((a,b)=>Number(b?.candidateScore||0)-Number(a?.candidateScore||0))
      .slice(0,5);

    for(const x of rows){
      if(!candidateNoticeCanSendV2673(x.symbol,x.direction))continue;
      const label=candidateNoticeLabelV2673(x.candidateBand);
      const title='候選｜'+label+'｜'+x.symbol+' '+(x.direction==='SHORT'?'做空':'做多');
      const body='候選勝率 '+Number(x.candidateWinRate||0).toFixed(1)+'%｜Shadow '+Math.round(Number(x.candidateScore||0))+'分｜開圖後由你決定是否出手';
      const tag='candidate-'+x.symbol+'-'+x.direction;
      const result=await sendPush({
        title,body,tag,renotify:false,data:{url:'/?page=advice'}
      },{
        candidateNotice:true,
        candidateBand:x.candidateBand,
        symbol:x.symbol,
        direction:x.direction
      });
      if(Number(result?.sent||0)>0)candidateNoticeMarkV2673(x.symbol,x.direction);
    }
  }catch(e){
    console.warn('[v2673] candidate notice',String(e?.message||e));
  }finally{candidateNoticeBusyV2673=false}
}

app.get('/api/notification-custom-v2673',(_req,res)=>{
  res.json({ok:true,version:'V2.6.73',coreTrader:'熬鷹資本',coreTraderFixed:true,...notificationCustomPrefsV2673()});
});
app.post('/api/notification-custom-v2673',(req,res)=>{
  try{
    const out=saveNotificationCustomPrefsV2673(req.body||{});
    res.json({ok:true,version:'V2.6.73',coreTrader:'熬鷹資本',coreTraderFixed:true,...out});
  }catch(e){res.status(500).json({ok:false,error:String(e?.message||e)})}
});

setInterval(candidateNoticeTickV2673,CANDIDATE_NOTICE_SCAN_MS_V2673);
setTimeout(candidateNoticeTickV2673,20*1000);

