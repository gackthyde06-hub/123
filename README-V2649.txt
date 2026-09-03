V2.6.49 — FF MENU FULL REDESIGN

只 Replace：
- growth-status-v2626-patch.mjs

不要動：
- advisory-buckets-v26271-patch.mjs
- package.json
- start-safe.mjs
- server.js
- Railway

這版不是 V2.6.48 換色，是整套養成 UI 重做。

方向參考：
- FINAL FANTASY VII REMAKE / REBIRTH：大標題、Command Menu、稀疏資訊層級
- FINAL FANTASY XV：角色狀態 + 大型 EXP / Lv 視覺
只參考排版語言，不使用原作素材。

重新設計：
- 頂部變成角色 Status Hero：Class / Stage / Lv / EXP / Shadow / Effective / Hit / PF
- 01～06 變成 FF Command Menu 式大列，預設關閉
- 每列直接顯示一個最重要的即時數字
- 01 STATUS：Learning Route
- 02 ABILITY：六維圖永久刪除，改成 6 顆環形能力核心（Materia-like slots）
- 03 GROWTH：Stage / Next Form / Effective / OOS / Stability / Main Quest
- 04 TACTICS：ABC 大列 + Live Turn + Edge/OOS/Pattern
- 05 TARGETS：候選標的 / 最新情報
- 06 MISSIONS：每日訓練 + Research Path
- 07 ARCHIVE：固定顯示歷史、XP、模式、警告

穩定：
- 自動更新 10 分鐘
- 8 分鐘內不重抓
- 最近 2 分鐘有操作不刷新
- 任一 01～06 展開時，自動刷新暫停
- 手動 UPDATE 可自行更新
- 更新時保留已展開章節與目前位置

顏色：
- 深藍灰 / 深鋼藍 / 深石墨
- 暖金與米白呼應交易監控
- 不使用淺色大底
- 不使用接近黑色 pill / badge
