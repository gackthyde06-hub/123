Worth Watch (V2.6.82 · production-hardened)

啟動
- Railway / production：npm start  →  start-safe.mjs 輕量 preflight → server.js
- 直接啟動（除錯用）：npm run serve
- 開發：npm run dev
- 健康檢查：GET /healthz
- Railway：railway.json（startCommand = npm start）

V2.6.82 核心
- B 級＝「值得打開圖看」，最後由使用者自己扣扳機。
- A 級維持高完成度與嚴格確認。
- Shadow / Structure / Actual Trade / Push / Service Worker 原有流程保留。
- manual-opportunities 前端 timeout recovery 已保留，不再直接顯示 aborted without reason。

這次 production hardening
- 不恢復舊版一長串啟動 patch；所有 V2.6.82 功能仍直接烘焙在 server.js / public/。
- start-safe.mjs 只做快速 fail-fast：Node 版本、必要檔案、JS syntax、核心 API marker、前端資源完整性、Push SW marker。
- 阻止 vapid/subscriptions/events 等 runtime state 被 public 靜態路由曝光。
- .gitignore 防止 VAPID 私鑰、subscriptions 與學習 runtime state 被誤 commit。
- npm test 改為跨 Windows/Linux 的 test-runner，不再使用 POSIX-only 的 UNIT_TEST=1 語法。

測試
- npm run preflight
- npm test
- npm run test:worth-watch
- npm run test:all
