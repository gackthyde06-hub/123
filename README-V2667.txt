V2.6.67 — Candidate Lifecycle / Archive / Header Layout

部署：
1. 新增 candidate-lifecycle-v2667-patch.mjs
2. 用本包 prepare-ui.mjs 覆蓋 repo 根目錄同名檔

這版修正「剛剛有候選，下一輪突然變 0」：
- V2665 原本把即時判讀 >15 分鐘當硬失效，候選會直接被刪。
- V2667 改成：資料變舊是軟等待，不會把已入選候選瞬間刪掉。
- 已入選候選固定 30 分鐘生命週期。
- 30 分鐘內不因分數小變動、暫時掉榜、資料短暫 stale 而消失。
- 只有 4 種情況提前離開：
  1. 你已建立實際建倉
  2. 升級正式 A/B
  3. 真正硬失效（低量/結構破壞/RR<1/明顯負期望/硬風險）
  4. 30 分鐘到期

未建倉到期：
- 自動從前台候選消失
- 寫入 Railway Volume：manual-candidate-archive-v2667.json
- 不算 Win / Loss，不污染 Shadow 勝率
- 可由 GET /api/manual-candidate-archive 讀取

UI：
- 候選大標旁的小字重排成兩行。
- 第一行：候選層級 · 結構
- 第二行：已觀察幾分鐘 · 幾分鐘後自動歸檔
- 候選群組標題也改成兩層，不再一長串硬塞。
- 候選卡中文內文字體再放大。

沒有改：
- 正式 A/B 分級
- 正式通知政策
- 候選不自動通知
- Shadow learning
- actual-trades 結果學習
- Growth
