V2.6.85 Shadow 觀察清單

目的
- 修正 TradFi / 過納停損距離把 netR 弄爆的問題。
- 學習用 netR 限制在 [-3, +3]R。
- 停損距離 < 0.15% 不再用 netReturnPct/風險%换算，改用 realizedR。
- CSV 補 costRatioAtEntry。
- 新 API GET /api/shadow-watchlist
- 監控頁出現「影子觀察清單」，只列值得開 TradingView 的標的。

門檻（故意厲害）
- 同標的結算 WIN+LOSS >= 12
- Wilson 95% 下界 >= 45%
- 修剪後期望 R >= 0
- 修剪後 Net PF >= 1.15
- TIMEOUT 不超過 40%

這不是
- 不是自動下單
- 不放寬正式 A/B 推播
- 不把表面勝率當成穩賺

獲利使用法
1. 清單有標的 → 開圖看 15m/1h 結構
2. 結構不成立就放過
3. 只用你看得懂的停損定 1R
4. 一天少做，不追清單上每一檔
