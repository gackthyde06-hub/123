V2.6.64 — RECOVERY / MANUAL / NOTIFY / LEARNING / NO LOCK

這包是修復包，不動 System Growth、不動 advisory UI 主體、不動 package/start-safe/Railway。

Replace 3 files:
1. manual-mode-backend-patch.mjs
2. lock-icon-v2620-patch.mjs
3. workspace-lock-v2621-patch.mjs

【這次 404 的真正原因】
V2.6.63 manual-mode-backend-patch.mjs 假設 server.js 已經有 MANUAL_MODE_V263_20260902。
但 repo 的 server.js 是乾淨基底；prepare-ui 在 ManualAB 階段執行這個 patch 時會直接丟錯並被 prepare-ui 略過，
所以 /api/manual-opportunities 根本沒被裝上，建議頁才會顯示 HTTP 404。

V2.6.64 修法：
- manual-mode-backend-patch 自己先安裝完整 V263 backend（沿用原本 include files）
- 再套穩定候選層
- patch 結束前硬檢查 /api/manual-opportunities route
- 硬檢查 manualOpportunityLoop timer
- 硬檢查 actual-trade learning metadata
缺任何一項就直接 fail/rollback，不允許半套啟動。

【候選】
- 正式 A/B 原本算法不改。
- 候選是獨立層，只從正式 C 中挑 Shadow 認為目前最有機會的標的。
- Shadow 共識分 >=68
- 候選勝率 >=60%
- Shadow sample >=8 或 calibrated >=63%
- 最多 3 個
- 連續 2 次確認才入選
- 入選至少 20 分鐘
- 暫時掉榜 8 分鐘內保留
- 20 分鐘後替換需新候選至少高 6 分
- 候選狀態寫入 Railway Volume 的 manual-candidate-state-v2664.json，重啟後不會完全失憶
- DESTROYED / terminal tracker / RR<1 / BLOCKED / ACTIVE 實倉直接剔除

【展開說明】
- 為什麼現在選它
- 離正式 B 還差什麼
- 離正式 A 還差什麼
- 如果現在要打，要注意什麼
- Shadow sample / hit / PF / calibrated / consensus / structure / RR
- 可建立候選實倉追蹤

【通知】
- 正式 A/B 通知 loop 原樣保留。
- 候選仍維持 grade C，且 manualOpportunityLoop 額外 `if(row.candidate===true)continue;`
- 即使偏好 mode=ALL，候選也不會被當正式進場通知送出。
- notification-control-v2616 / notification-policy-v2611 不修改。

【學習】
- 原 V263 actual-trade metadata / CSV / aggregate 全部先恢復。
- 候選手動建倉仍 POST /api/actual-trades。
- manualGrade=C、notificationTier=CANDIDATE，實際結果會照原 actual-trades 管線回寫。
- prepare-ui 原順序 ManualAB -> ShadowLearning 保留，shadow-learning-v264-patch 沒有被改動。

【鎖】
之前只處理了 workspaceFreeze，漏掉 ui-polish-v269 的 pageLockTagV269，所以鎖才一直存在。
V2.6.64 同時移除兩套：
- pageLockTagV269 / pageLockRowV269
- workspaceFreezeV2619
並清掉兩個 localStorage key。
功能本身也 disabled，不只是 CSS 藏起來。

【滑頁】
鎖刪掉，但水平左右滑切頁仍保持禁用；只能點 tab 換頁。
