V2.6.72 — MANUAL HTTP 404 RECOVERY

直接原因：
V2.6.71 candidate-ops-v2671-patch.mjs 的 verifyABWorkspaceSource() 寫死檢查 data-save-trade，
但目前 advisory-buckets-v26271-patch.mjs 實際 A/B 建倉按鈕是 data-build。

因此 CandidateOps V2671 preflight FAIL → prepare-ui 被 start-safe rollback →
後面的 advisory UI 還是跑 → 前台建議頁存在，但 /api/manual-opportunities 已被 rollback →
畫面出現「手動標的暫時不可用 · HTTP 404」。

V2.6.72：
- 接受 data-build
- 同時兼容舊 data-save-trade
- 不改 A/B、候選、Shadow、通知門檻
- CandidateOps 完成後硬驗證：
  /api/manual-opportunities
  /api/manual-candidate-history
  /api/manual-candidate-dismiss
  /api/actual-trades
  候選歷史 UI
  候選實際建倉 UI
- server.js / candidate runtime 再跑 node --check
- 少任何一層直接 FAIL，不准半套啟動

部署：
1. 新增 candidate-ops-v2672-fix.mjs
2. 用 ZIP 內 prepare-ui.mjs 覆蓋 repo 根目錄同名檔
其他檔案不要動。
