V2.6.85 Shadow watchlist

Fixes
- researchNetR no longer explodes when stop is a few ticks from entry (QQQ -171R class bugs).
- Prefer realizedR, require stop distance >= 0.15%, clip learning R to [-3, +3].
- Fill costRatioAtEntry on CSV export when missing.

Watchlist
- GET /api/shadow-watchlist
- Monitor page card: 影子觀察清單 with TradingView links
- Gates: decisive >=12, Wilson low >=45%, clipped net exp >=0, PF >=1.15, timeout <=40%
- A_WATCH only if Wilson >=55% and PF >=1.4 and decisive >=20
- Does NOT push, does NOT loosen A/B

Use
Redeploy Railway. Open 監控. Review charts only. Still require structure confirmation before any order.
