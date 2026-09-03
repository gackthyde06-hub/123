V2.6.38 FINAL FRONTEND AUTHORITY

只 Replace：
- advisory-buckets-v26271-patch.mjs
- growth-status-v2626-patch.mjs

不要動 package.json / start-safe.mjs / server.js / Railway 設定。

這版不是修改舊 renderer，而是最終直接移除舊前端引用：

MANUAL
- 移除 manual-mode-ui.js
- 移除 mentor-ui-v2622.js 的前端載入
- 最終只載 manual-workspace-v2638.js
- 建議排名執行時搬到觀察頁
- 建議頁只留 A級 / B級手動標的
- A/B 區可收合；卡片可展開
- 每張卡 X 可多筆移除
- X 只隱藏手動清單，不刪後台機會、ABC、Structure 或績效資料
- 被 X 的標的在觀察頁「手動略過」可恢復
- 展開直接填 成本 / TP1 / TP2 / SP1 / SP2 / 保證金 / 槓桿 / 數量
- 直接建立建倉追蹤
- 不再出現「影子 A/B 判斷」或 MANUAL OPS · SHADOW LEARNING
- 手動輸入中不背景重畫
- A/B 標的固定既有順序
- 攔截水平滑動切頁，避免誤切

GROWTH
- 移除 system-growth.js
- 移除 growth-abc-v264.js
- 移除 mentor-ui-v2622.js 的第二套養成
- 移除舊 growth-status / growth-rpg 前端
- 最終只載 growth-unified-v2638.js
- 單一 UI：系統養成 / 角色狀態 / 成長進度 / 下一階條件 / 主線任務 / 每日訓練 / 最近成長紀錄
- 深海軍藍 + 石墨 + 金色，非淡灰、非整片黑
