V2.6.65 — Candidate Recall / A-B Gate Optimization
日期：2026-09-04

這版處理的核心問題：
1. 正式 A/B 仍維持絕對門檻，不為了湊通知亂放寬。
2. 候選改成「安全硬過濾後的相對排名」，最多 5 筆。
3. 修正 A/B 被 BLOCKED 後既不顯示 A/B、又不能進候選的消失漏洞。
4. BLOCKED 拆成：
   - 硬淘汰：低量、價差、ADL、Funding 擁擠、BTC/ETH 大盤逆向、跨交易所逆向、清算行情弱山寨、結構 DESTROYED、RR<1、極差 Shadow。
   - 軟等待：離回踩區太遠、單一時間框逆向、轉弱、資料等待刷新、tracker 尚未完成。
5. 候選不自動通知；軟阻擋解除、回到正式 A/B 才進通知。
6. 修正手動通知 loop：BLOCKED / hardBlock 不再被錯誤推送；掃描由前8筆擴到完整12筆，避免候選卡住後面的正式 A/B。
7. /api/manual-opportunities 新增 pipeline 診斷；候選為 0 時頁面會顯示「深析 → 排名 → 安全 → A/B → 候選」與主要淘汰原因。
8. 候選分數加入 Shadow PF/命中、Structure learning、24h 流動性、量比、taker、大戶比等證據。

部署：
把 ZIP 內兩個 .mjs 放到 repo 根目錄：
- candidate-recall-v2665-patch.mjs（新增）
- prepare-ui.mjs（覆蓋）

其他檔案不要動：
- manual-mode-backend-patch.mjs 不用換
- server.js 不用手改
- start-safe.mjs 不用改
- advisory-buckets-v26271-patch.mjs 不用改
- growth-status-v2626-patch.mjs 不用改

Railway build 時：
prepare-ui → ManualAB V2.6.64 → CandidateRecall V2.6.65
若 V2.6.65 無法套用，prepare-ui 會拒絕 partial UI，而不是默默跳過。
