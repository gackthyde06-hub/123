V2.6.73 — Candidate UI + Notification Custom

候選 UI：
- 刷新按鈕固定收進候選卡右側，不再跑出框。
- 候選標題小字固定兩行：
  深析 → 候選池 → 安全
  A/B → 候選
- 每張候選刪除 X 移到右上角。
- 展開箭頭移到右下角，和 X 分開，避免誤按。
- 候選卡文字保留兩行 / 自動換行。

通知設定放在「自動通知 / 歷史通知」後面最底下：
1. 熬鷹資本：固定通知，只允許核心熬鷹的 OPEN / ADD / REDUCE / CLOSE。
2. 正式 Shadow：可選「只 A」或「A + B」，預設 A+B。
3. 候選通知：可選
   - 關閉（預設）
   - 只優先
   - 優先＋觀察
   - 全部候選
   並可設定最低候選勝率 45%～80%。

候選通知有獨立 30 分鐘去重，不會拿候選提醒去擋後續正式 A/B。
本版不改 Shadow 學習、不改候選排序、不改 A/B 分級、不改 Actual Trade learning。

部署：
1. 新增 candidate-ui-notify-v2673-patch.mjs
2. 用 ZIP 內 prepare-ui.mjs 覆蓋 repo 根目錄同名檔
其他檔案不要動。
