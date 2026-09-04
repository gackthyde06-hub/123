V2.6.69 — MARKET-WIDE CANDIDATE RECALL

根因：
現在不是把全部永續合約都做完整深析。
repo 原始設定是：
- Radar 預設 100
- 深析 IDEA_SYMBOLS 預設 24
- 深析 cap 32
- Ranked rows 只留 18
- Manual A/B / Candidate 再吃更小前段池
所以候選=0，不等於全部永續合約都沒有機會。

更新：
- Radar 預設 300，上限 500
- 深析預設 40，上限 48
- Ranked rows 18 -> 30
- Formal A/B 基礎池 12 -> 20
- Candidate pool = 前30個深析結果
- Tracker/Shadow 即時學習槽預設 20
- 新增「研究候選」：
  無硬風險、候選勝率 >=52%、相對排名前30
- 研究候選只顯示，不自動通知
- 正式 A/B 門檻不放寬
- 正式通知不放寬
- V2667 30分鐘生命週期/歸檔保留
- V2666 中文目前狀況/預計/建議保留
- ShadowLearning / PushRecovery 不動

候選只有在前30個深析標的全部有硬風險，或安全標的候選勝率全部 <52% 時才允許 0。

部署：
1. 新增 candidate-marketwide-v2669-patch.mjs
2. 覆蓋 prepare-ui.mjs
其他檔案不要動。
