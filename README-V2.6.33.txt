V2.6.33 — STOP THE BUILD LOOP

這版的原則：不再修改 prepare-ui 產生後的 manual-mode-ui.js / system-growth.js 內容，因此不再因 regex anchor 改版而 Build Failure。

上傳 GitHub 根目錄：
- build-production-v2631.mjs -> Replace
- deploy-ui-v2633.mjs -> Add
- manual-ab-v2633.js -> Add
- manual-ab-v2633.css -> Add
- growth-guard-v2633.js -> Add
- growth-guard-v2633.css -> Add

不用改 package.json / start-safe.mjs / Railway Variables / Volume / Start Command。

預期 Build 尾端：
[ui-final:V2.6.33] overlay assets installed
[build:V2.6.33 ...] BUILD PASS · runtime can start

UI：
- A · 手動觀察 / A · 自動通知
- B · 手動觀察 / B · 自動通知
- 預設 A · 手動觀察
- 舊 manual panel 隱藏，但後台資料與學習照常跑
- 新清單只在資料真的改變時重畫，既有卡片順序固定
- 系統養成使用 growth-status-v2625，新 UI 被舊 renderer 移除時會立即用最後快照補回，舊內容同步隱藏
