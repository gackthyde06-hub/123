V2.6.68 — SHADOW / PUSH INTEGRITY RECOVERY
2026-09-04

這版不再改候選內容、不改 A/B、不改候選排版。

找到的根因：
V2.6.67 prepare-ui 的順序是：
ManualAB -> CandidateRecall -> CandidateNarrative -> CandidateLifecycle -> ShadowLearning

但 shadow-learning-v264-patch.mjs 需要先修改 ManualAB 裡的 V2.6.3 base response。
Candidate wrapper 先跑後，ShadowLearning 的 exact anchor 可能已被改掉。
舊 prepare-ui 的 run() 又會 catch 錯誤後繼續部署，而且最後 required check 沒有 ShadowLearning / TradFi。
因此 Railway 可以顯示 SUCCESS，但 Shadow 養成可能實際被 skip。

V2.6.68 固定順序：
ManualAB
-> ShadowLearning REQUIRED
-> TradFi REQUIRED
-> CandidateRecall REQUIRED
-> CandidateNarrative REQUIRED
-> CandidateLifecycle REQUIRED
-> PushRecovery REQUIRED
-> Integrity Preflight REQUIRED

Integrity Preflight 會檢查：
- server/app/sw/candidate runtime syntax
- Manual A/B API
- Candidate recall / lifecycle / archive
- ABC Shadow capture / learning adjustment / summary
- TradFi asset-aware learning
- actual-trades 實際結果學習
- 一般測試通知
- Shadow 測試通知
- push-health
- sent=0 必須報失敗
- VAPID subscription repair
- Service Worker 測試通知白名單
- 正式 Shadow 只允許 A/B
- Candidate 不得自動通知
- V2666 中文候選 + V2667 30 分鐘歸檔仍存在
- 後續 institutional / mentor / growth / advisory / lock patch 檔案 syntax

缺任何核心層：prepare-ui 直接 FAIL，start-safe rollback，不再允許半套部署。

只換兩個檔案：
1. prepare-ui.mjs
2. integrity-preflight-v2668.mjs

其他檔案全部不要動。
