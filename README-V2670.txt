V2.6.70 — Candidate Real Recall Fix

這張畫面不是正常市場結果，而是兩個邏輯問題：

1. V2667 把「候選勝率 <52%」當 HARD blocker。
   候選本來應該是相對研究清單，不是正式 A/B。
   結果 28 筆直接被「勝率低於安全底線」全部殺掉。

2. trackerStatus = DROPPED/EXPIRED/WIN/LOSS/TIMEOUT 被當 HARD blocker。
   這會讓「上一輪已結束」的標的永遠無法進入新一輪候選。

3. V2669 backend pipeline 欄位改成 deepAnalyzed/candidateUniverse，
   但 UI pipelineLine 還讀舊 analyzed/ranked，所以畫面會錯顯示「排名 0」。

V2670：
- 候選勝率 <52% 改成 SOFT 等待，不再當安全硬淘汰。
- 正式 A/B 勝率門檻完全不改。
- 上一輪 tracker 結束改 SOFT，允許新市場週期重新進候選。
- 真硬風險仍保留：低量、ADL、Funding/擁擠、價差、跨所逆向、BTC/ETH逆向、結構DESTROYED、RR<1、Shadow明顯負期望。
- PRIME/WATCH 仍嚴格。
- RELATIVE：>=50% 且分數/排名達標。
- RESEARCH：相對前排、無硬風險、約47~48%以上即可觀察；永不自動通知。
- 修正 UI pipeline：
  深析 -> 候選池 -> 安全 -> A/B -> 候選
  不再用錯欄位顯示排名0。
- V2666 中文判讀、V2667 30分鐘歸檔、V2668 Shadow/Push完整性、V2669大市場雷達全部保留。

部署：
1. 新增 candidate-recall-fix-v2670-patch.mjs
2. 覆蓋 prepare-ui.mjs
其他檔案不要動。
