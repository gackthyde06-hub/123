V2.6.71 — Candidate Ops / History / Actual Trade

這版處理 4 件事：

1. 「預計」不再固定套話
每一顆候選會吃自己的：
- 量比
- 主動買賣盤
- 大戶多空比
- Funding（有資料才顯示）
- Structure state / health
- Shadow sample / hit / PF
- 候選分數 / 勝率
- 當下 soft wait / A-B 缺口
再生成兩行中文：
目前狀況 / 預計 / 建議
不同幣、不同方向、不同資金流會得到不同內容。

2. 更新機制
- 候選頁每 90 秒自動刷新一次
- 每 5 分鐘最多強制完整刷新一次
- 使用者正在輸入建倉資料時不刷新，避免把欄位打掉
- 候選標題新增 ↻，可手動強制更新
- V2667 的 30 分鐘候選生命週期保留

3. 候選歷史
- 候選區下方新增「候選歷史」可展開
- 前台顯示最近 24 小時
- Railway Volume 後台保留 7 天，最多 300 筆
- TTL 到期 / 升 A-B / 已建倉 / 硬失效 / 手動略過都會進歷史
- 候選右側新增小 ×
- 主動 × = 立刻移到候選歷史，並 60 分鐘不再重複塞回候選
- 歷史中的「手動略過」可按「恢復判斷」；恢復只是解除略過，仍要 Shadow 重新判定才會回來

4. 建倉資料
A / B 原本既有建倉表單保持不變，部署時強制驗證：
成本 / TP1 / TP2 / SP1 / SP2 / 保證金 / 槓桿 / 數量 / actual-trades API 都存在。

候選新增同一套實際建倉：
成本 / TP1 / TP2 / SP1 / SP2 / 保證金 / 槓桿 / 數量
- 候選不再預填奇怪建議進場價
- 可以按「成本用現價」
- 候選建倉一律以 C / candidate snapshot 記錄，避免污染正式 A/B 勝率
- 建倉後走現有 /api/actual-trades，後台繼續追 TP/SP 與實際結果

未修改：
- 正式 A/B 門檻
- 正式通知門檻
- Candidate 永不自動通知
- Shadow learning
- Push recovery
- Growth

部署：
1. 新增 candidate-ops-v2671-patch.mjs
2. 覆蓋 prepare-ui.mjs
其他檔案不要動。
