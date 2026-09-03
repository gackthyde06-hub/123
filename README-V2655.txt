V2.6.55 — STRUCTURE MEMORY UNIFIED GROWTH

只 Replace：
- growth-status-v2626-patch.mjs

不要動 advisory / package.json / start-safe / server / Railway。

本版明確以使用者截圖下面的「結構記憶 / STRUCTURE MASTERY」做唯一 UI 基準。
不是相似色，是整個養成頁的視覺與排版語言統一。

【顏色統一】
- 頁面底：#080d12
- 主模組：#0d1218 / #0f151c
- 數據格：#0e141b / #111821
- 框線：#252e3a
- 金色：#c7a25f / #dfbc76
- 白灰文字 / 低彩度藍灰輔助
- 移除 V2.6.54 上面那種明顯偏藍的卡片背景

【排版統一】
跟 Structure Mastery 一樣：
- 左側金色菱形
- 中文主標
- 英文小標
- 右側數值 / Level / AVG
- 2×2 大型數據格
- 金棕色警告 / 規則框
- 深色內層資料格
- 大圓角外框
- 細描邊
- 垂直閱讀節奏

【養成內容】
- SYSTEM GROWTH 主頁改為 2×2 指標
- 角色狀態改為 2 欄數據格，6 項仍可展開
- 成長進度保持 5 階，但全面套用相同深色 UI
- 主線任務每條仍可展開
- 每日訓練每條仍可展開
- 最近成長紀錄同色系
- 進階研究也改成 Structure Mastery 同一套外框 / 數據格 / 研究資訊排版
- Tactical Rank / AP / Ascension 保留，但不再使用不同色系卡片

【穩定】
沿用 V2.6.52–54 的防跳架構：
- 自動更新不重畫正在看的 DOM
- staged data
- cache first paint
- exact scroll restore
- 展開狀態保留
- MutationObserver 不使用

【後台】
shadow-mentor / performance / manual-opportunities / test-signals / symbol-analysis 全部保留。
