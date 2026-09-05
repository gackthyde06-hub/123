V2.6.81 — Shadow Devil Camp / Institutional Survival

Purpose
- Champion: preserve current execution / risk protections.
- Challenger: train from resolved Shadow outcomes with recency-weighted, no-lookahead, net-of-cost statistics.
- Profit-first means positive expected value after costs; it does NOT mean increasing risk or forcing trades.

Training data reviewed
- shadow-performance-v1022-research-2026-09-04.csv
- 1,794 Shadow rows / 1,749 resolved / 626 resolved learning-eligible rows.
- Existing formal grade output: A=0, B=1; therefore the old A/B pipeline was effectively not producing formal signals.
- costRatioAtEntry was empty historically; V2.6.81 computes cost / 1R from entry-stop distance and round-trip cost at decision time.
- Existing score / legacy mentor alpha gates were not treated as sacred because the exported results did not show reliable net-profit calibration.

V2.6.81 behavior
1. Learns hierarchy by asset class / session / strategy / regime / direction plus OI / Taker / Depth when available.
2. Uses only RESOLVED past rows whose result time is before the current decision time.
3. Uses recency weighting and net R after costs; clips extreme historical R for model stability.
4. Separates true safety blockers from alpha disagreement. Higher-timeframe disagreement becomes a penalty; execution/data/invalidity protections remain blocking.
5. Adds strong-to-weak failure risk (weak flags, failed breakout, adverse 15m/30m/1h/market, depth/taker/top, chase).
6. A requires stronger net edge / PF / support / cost quality than B. No positive net edge = no formal A/B.
7. Manual A/B workspace is aligned to the same formal tier. A legacy C cannot be promoted simply because Challenger likes it.
8. Formal A/B push no longer depends on the obsolete testSignalEnabled toggle. A mode = A only; AB mode = A + B.
9. No-subscription case is retryable instead of being marked permanently processed.
10. Audit endpoint: GET /api/shadow-bootcamp-v2681. It records formal Shadow and core-trader push attempts plus decision diagnostics.

Promotion gates
A: posterior >=55%, net expectancy >= +0.18R, net PF >=1.25, cost/1R <=3%, effective support >=10, plus data/strong-to-weak checks.
B: posterior >=50%, net expectancy >= +0.10R, net PF >=1.15, cost/1R <=5%, effective support >=8, plus data/strong-to-weak checks.

Validation actually run before packaging
PASS - patch syntax.
PASS - complete prepare-ui generation order through V2.6.80 + required V2.6.81 patch.
PASS - generated server syntax.
PASS - formal notification policy: AB permits A/B even with legacy toggle false; A mode blocks B.
PASS - core trader OPEN/ADD/REDUCE/CLOSE whitelist remains fixed to core trader.
PASS - high-cost case stays non-formal.
PASS - hard execution/risk blocker stays BLOCKED.
PASS - strong-to-weak case is prevented from formal A/B.
PASS - manual A/B/C alignment.
PASS - zero-subscription push remains retryable.
PASS - HTTP smoke fixture: health, manual opportunities, notification settings, push health, actual trades, bootcamp endpoint, UI route all returned 200.
PASS - negative/fail-safe: missing prerequisite exits nonzero and leaves server byte-identical.

Not claimed as tested
- Physical iPhone receipt.
- Live Railway production behavior after the user deploys this archive.
Those require the deployed environment/device and are intentionally not claimed here.
