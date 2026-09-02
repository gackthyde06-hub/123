STRUCTURE ENGINE V2 — S2.1.0 / UI 2.5.0
Date: 2026-09-02
Base backend: V10.2.7

PURPOSE
Fix structure judgement without solving the problem by making the app so strict that it stays silent.
This engine separates market structure from entry readiness and separates a deep pullback from actual structural destruction.

CORE PRINCIPLE
A trade can be:
- structurally healthy but not entry-ready,
- structurally damaged but recoverable,
- a deep pullback / reclaim opportunity,
- or genuinely destroyed.
The app must not collapse all four cases into "結構失效".

STRUCTURE STATES
1. INTACT / 完整
   Protected structure is healthy. Continue normal strategy confirmation.

2. DAMAGED / 受損
   Structure weakened, but higher-timeframe acceptance does not confirm destruction.
   This is a caution state, not an automatic invalidation.

3. RECLAIMING / 收復中
   A key level/swing was damaged or briefly lost and price is reclaiming it.
   Wait for 5m/15m close confirmation instead of killing the setup from a wick/touch.

4. OPPORTUNITY / 深回踩機會
   Pullback is deep but protected 15m/30m structure is not confirmed destroyed, and reclaim/support evidence exists.
   The app may send an EARLY STRUCTURE WATCH notification. It explicitly says "非進場確認".

5. DESTROYED / 徹底破壞
   Protected structure is accepted as broken by multi-timeframe evidence.
   This is the only Structure V2 state that hard-blocks for structure reasons.

MAJOR S2.1 CHANGES
- Fib 0.786 is no longer a death switch.
- Wick/touch through a level != accepted structural break.
- A single 5m break != 15m/30m structural destruction.
- POC loss is evidence, not an on/off invalidation switch.
- Protected 15m/30m swing structure is now primary; the old setup invalidation is soft evidence.
- DESTROYED requires acceptance: normally consecutive 15m closes beyond the protected swing plus 30m/1h agreement, or a severe accepted break with 30m+1h adverse confirmation.
- Time spent in WEAKENING no longer destroys a structure by itself.
- Recoverable structures remain alive and can later become RECLAIMING/OPPORTUNITY.
- Existing execution/risk gates such as spread, ADL, extreme funding and data quality remain separate.

ONLINE DATA POLICY — NO MANUAL KLINE/熬鷹 FEED REQUIRED
Primary trader source inside the app:
- Binance Copy Trading BAPI order_history
- OPEN / ADD / REDUCE / CLOSE events
- reconstructed current position from the app's canonical position state

Primary market source inside the app:
- Binance Futures Kline / WebSocket / mark price / futures-data endpoints
- 5m / 15m / 30m / 1h structure
- OI / taker / depth / funding / basis / long-short / ADL where available

Fallback:
- Bybit / OKX only when explicitly marked as fallback by the existing data-health layer.

Public mirrors / social pages:
- cross-check only
- NEVER training ground truth and NEVER allowed to override direct exchange data.

熬鷹 ACTIONS ARE WEAK CONTEXT, NOT TRUTH
- Still holding: +1 structure-health evidence only.
- Recent ADD: +3 evidence only.
- Recent REDUCE: -2 caution only.
- Recent CLOSE: -4 caution only.
A trader can add to a bad trade; therefore trader behaviour alone can NEVER create OPPORTUNITY or cancel DESTROYED.

STRUCTURE-SPECIFIC SELF LEARNING
Persistent file: structure-learning-v2.json

Important S2.1 correction:
Structure learning is no longer judged by the trade's TP/SL alone.
Each structure episode gets independent ATR/protected-swing success/failure levels, so the model learns whether the STRUCTURE survived rather than merely whether one trade's risk settings won.

Recorded fields include:
- state + rawState
- assetClass: CRYPTO / EQUITY_TOKEN / COMMODITY
- pattern: NORMAL_STRUCTURE / DEEP_RETRACE / DEEP_RECLAIM / FAILED_BREAK_RECLAIM / LIQUIDITY_SWEEP / STRUCTURE_BREAK / POC_RECLAIM
- protectedSwing15 / protectedSwing30
- marketEpisodeId
- retracement bucket
- direct-exchange trader context
- successPrice / failurePrice
- max favorable / adverse excursion
- state transitions
- final structure outcome

Training outcomes:
- STRUCTURE_HELD
- STRUCTURE_FAILED
- RECLAIM_SUCCESS
- DEEP_PULLBACK_SUCCESS
- DEEP_PULLBACK_FAILED
- TRUE_INVALIDATION
- FALSE_INVALIDATION
- TIMEOUT / AMBIGUOUS / STATE_TRANSITION (not used for adjustment)

LEARNING SAFETY
- minimum effective sample before state adjustment: 20 by default
- same-symbol/state de-correlation: 30 minutes by default
- same market episode/state cross-symbol cap: max 3 effective samples
- asset classes are separated before learning
- hierarchy: detailed state -> core state -> broad state bucket
- bounded adjustment: maximum +/-8 health points
- learning can refine borderline non-destroyed states only
- learning can NEVER resurrect a confirmed DESTROYED state

EARLY STRUCTURE WATCH — SOLVES "STRICT UNTIL SILENT"
S2.1 adds a separate push path for:
- OPPORTUNITY
- deep RECLAIMING

This alert is intentionally different from a normal entry-ready alert:
- title says "非進場確認"
- does not mark the Shadow record as a normal notification
- does not contaminate entry-notification performance stats
- still requires reasonable data confidence and rejects high ADL, crowded funding and excessive spread
- default cooldown: 45 minutes per state/retracement bucket

So the app can tell you "this deep pullback is worth watching" BEFORE every strict entry condition is complete, without pretending it is already safe to enter.

API
GET /api/structure-learning
GET /api/structure-learning.csv

/api/test-signals also exposes:
- structureEngine summary
- structureV2
- structureState
- structureLabel
- structureHealth
- structureAction

UI 2.5
Candidate cards show:
- structure state / health
- confidence
- asset class
- pattern
- top structure reasons
- "結構觀察，非進場確認" for OPPORTUNITY/RECLAIMING

The old permanent left gradient on the first candidate remains removed: only the opened candidate is highlighted and only one is open at a time.

FILES TO DEPLOY TO REPO ROOT
- prepare-ui.mjs (replace existing)
- structure-engine-v2-patch.mjs (new)
- structure-engine-v2-ui.js (new)
- structure-engine-v2.css (new)

Existing research-layer-patch.mjs and all existing premium/system-growth files stay in place.

STARTUP ORDER
1. existing Research R1 patch
2. Structure Engine S2.1 patch
3. UI copy/injection
4. server.js starts normally

DATA PRESERVATION
- No Shadow reset.
- No actual-trade reset.
- No performance reset.
- No volume deletion.
- Structure data is stored in a separate structure-learning-v2.json.
- Patch is idempotent.
- If a required source-code anchor is missing or patched server.js fails Node syntax validation, it restores the original server.js and aborts startup instead of leaving a half-patched file.

EXPECTED LOGS
[structure-v2] applied S2.1.0; deep pullback / reclaim / destruction learning enabled
[ui] premium integration v2.5.0 + Research R1 + Structure Engine V2 ready

VALIDATION STATUS
This is a major architecture correction. It is NOT valid to claim the model is already proven more accurate before new out-of-sample episodes accumulate.
The proof metrics should be:
- true invalidation precision
- false invalidation rate
- deep-pullback success rate
- reclaim success rate
- OPPORTUNITY vs DESTROYED discrimination
- results split by asset class / strategy / regime / direction / pattern
- alert usefulness without exploding notification count

Goal: better discrimination, not fewer notifications and not a fake high win-rate number.
