V2.6.28 STABLE UI HOTFIX

只 Replace：
- advisory-buckets-v26271-patch.mjs
- growth-status-v2626-patch.mjs

不要動 package.json / start-safe.mjs / server.js / Railway 設定。

修正：
- 禁止舊 TradingView 返回狀態自動亂切頁。
- 背景更新不再用 scrollBy 強制拉動畫面。
- A 自動通知 / A 手動觀察 / B 自動通知 / B 手動觀察。
- 預設 A 手動觀察。
- 既有 A/B 標的固定順序；新標的才加入。
- 相同資料不重畫 A/B DOM。
- 保留原本實際建倉、TP/SP、保證金、槓桿、績效追蹤。
- 養成固定新版：角色狀態 / 成長進度 / 主線任務 / 每日訓練。
- 舊養成 renderer 不再覆蓋新版。
- 無 build stage、無 overlay、無啟動入口變更。
