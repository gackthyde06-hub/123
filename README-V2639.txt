V2.6.39 FIX

只 Replace：
- advisory-buckets-v26271-patch.mjs
- growth-status-v2626-patch.mjs

不要動 package.json / start-safe.mjs / server.js / Railway 設定。

修正：
- 保留 V2.6.38 已成功顯示的 A/B 手動頁。
- A/B 底下新增「自動通知」：讀 /api/performance 真正送出且仍 ACTIVE 的進場通知。
- 再下方新增「歷史通知」：讀 /api/performance 已結束通知。
- 每筆通知都有 × 可刪除顯示；刪除只存在本機 UI，不刪後端 performance / shadow / learning 帳本。
- 有「恢復已刪除顯示」。
- 新版養成自己建立 #sgPanel，不再依賴 system-growth.js。
- 標題恢復「交易監控 / 系統養成 Lv.X」切換；沿用原 sg-open-v256 開關狀態，首次預設展開。
- 系統養成仍只有一套：角色狀態 / 成長進度 / 下一階條件 / 主線任務 / 每日訓練 / 最近成長紀錄。
