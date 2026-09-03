V2.6.28 — DEPLOYMENT CLEAN REBASE

這版不是再疊一個 UI patch，而是整理部署入口。

核心修正：
1. 永久固定啟動入口：start-safe.mjs。以後版本不再更換 Railway Start Command。
2. 舊 start-safe-v2616 / v2617 / v2619 / v2620 / v2621 / v2622 / v2625 / v2626 / v2627 / v26271 全部變成相容別名，避免 Railway Dashboard 還指向舊檔。
3. prepare-ui 與所有後續 UI/Shadow patch 都做 snapshot -> patch -> syntax guard。任何 patch 失敗會自動 rollback 該次檔案，不再 process.exit(1) 拖垮整個服務。
4. 只有 server.js 缺失或 server.js 本身語法錯誤才會阻止啟動。
5. A/B 自動通知 / 建議標的 patch 保留；若它與當前 UI anchor 不相容，只 rollback 該 UI patch，主服務仍可上線。
6. 不動 Railway Volume、Variables、交易資料。

GitHub -> Railway 連線判斷：
GitHub 每次 commit 都收到 Railway 的 deployment status，因此連線/ webhook 是通的。現在的問題在 Railway build/start/health 階段，而不是 GitHub 沒有連到 Railway。
