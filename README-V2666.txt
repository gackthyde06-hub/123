V2.6.66 — 候選中文判讀 UI

部署：
1. 新增 candidate-narrative-v2666-patch.mjs
2. 用本包 prepare-ui.mjs 覆蓋 repo 根目錄同名檔

改動：
- 取消候選的建議進場點、進場區、TP、SP 顯示。
- 保留目前價格，但只是現價，不是建議買點。
- 每張候選改成中文：
  目前狀況 / 預計 / 建議
- 判讀直接使用 Shadow 樣本、命中率、PF、候選勝率、共識分、Structure、等待條件、A/B 缺口。
- 字體放大、自動換行，允許兩行以上。
- 保留「還沒變正式 A / B 的原因」。

未修改：
A/B、V2665 候選篩選、通知、Shadow learning、actual-trades、Growth。
