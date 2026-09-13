V2.6.90 — LIVE SHADOW POLICY

來源：2026-09-14 線上 /api/shadow-performance.csv（6680 筆，8/31–9/13）

決斷勝率（TIMEOUT 不算贏）
- 強勢動能續攻  3015  WR 52.1%  avgR +0.064
- 流動性掃盤反轉  1285  WR 55.0%  avgR +0.097   最優
- 順勢回踩      1161  WR 52.3%  avgR +0.033
- 突破回測      1153  WR 48.0%  avgR -0.024   禁止 A / 高勝率通知
- 區間極值反轉    66  樣本不足

整體決斷 WR 51.8%；TIMEOUT 當輸 40.5%；平均 +0.03R
通知過的只有 1 筆 → 不能用通知帳本當學習主源

政策
1. TIMEOUT 不計 WIN
2. 突破回測：hardBlock + capA，學習分最高 -3
3. 動能續攻：capA（期望太薄）
4. 掃盤反轉：允許 +1 分（仍受成本/集中度閘）
5. 順勢回踩：不加不減，保留候選
6. 結構 82% hitRate 不准當交易勝率

部署：server.js 在 institutionalMentorEdgeV2622 return 前呼用 applyLiveShadowPolicyV2690(edge)
不改通知開關、交易員設定、Railway Volume。
