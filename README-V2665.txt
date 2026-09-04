V2.6.65 — PUSH RECOVERY / REAL END-TO-END TEST

只 Replace：
- notification-control-v2616-patch.mjs

不要動：
- manual-mode-backend-patch.mjs
- growth-status-v2626-patch.mjs
- advisory
- shadow-learning
- notification-policy-v2611-patch.mjs
- package.json
- start-safe.mjs
- Railway 設定

【找到的兩個 bug】
1. 舊 /api/test-push 使用 test-* tag，但 V2616 Service Worker 最後白名單只允許 trader-* 與 shadow-* A/B。
   結果：server 送了，手機 Service Worker 自己丟掉。
2. App 同步 iPhone 通知時會 existing || subscribe，完全不檢查既有 PushSubscription 的 applicationServerKey。
   如果 Railway VAPID key 曾變過，舊 subscription 已經不能用；重新按同步也不會修。
   而舊 /api/test-push 不看 sendPush 結果，sent=0 也回 ok:true。

【V2.6.65】
- 測試 push 使用 notify-test-* / shadow-test-*，Service Worker 明確允許。
- 測試只 bypass「通知內容政策」，不會寫績效、不會寫 Shadow 樣本、不會當正式 A/B。
- /api/test-push / test-pullback / test-signal-push 會檢查真正 sent 數。
- sent=0 直接 HTTP 503，不再假裝成功。
- App 測試前先確認：
  Service Worker / Permission / VAPID applicationServerKey / Subscription / server subscribe record。
- 如果 VAPID 不同，自動 unsubscribe 舊 subscription，再用目前 cfg.vapidPublicKey 重訂。
- 第一次測試失敗會強制重訂一次，再測第二次。
- 已允許通知且已有 subscription 的裝置，開頁面時會背景檢查 VAPID mismatch 並自動修。
- Service Worker 加 skipWaiting + clients.claim，更新後不必一直卡舊白名單。
- 新增 GET /api/push-health，只回數量與狀態，不洩漏 endpoint/private key。

【正式通知完全保留】
- 熬鷹 OPEN / ADD / REDUCE / CLOSE
- 正式 Shadow A / B
- 手動 Shadow A / B
- 45 分鐘同標的去重
- 候選 C 不自動通知
- 使用者原本 Shadow 通知開關仍有效

【學習】
完全沒修改：
- shadow-learning
- signal performance
- actual-trades
- candidate learning
- performance ledger
