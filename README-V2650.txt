V2.6.50 — FF14 / FF15 / FF16 HYBRID REDESIGN

只 Replace：
- growth-status-v2626-patch.mjs

不要動 advisory / package.json / start-safe / server / Railway。

這版重新參考：
- FF14：資訊窗、狀態欄、裝備/數值列表的資訊密度
- FF15：角色狀態、Level / EXP 圓形主視覺
- FF16：Ability / Eikon 的圓形能力節點

設計：
- 頂部 Status Hero：Lv / EXP / Stage / Shadow / Effective / Hit / Actual
- 01～06 預設收起，Command Menu 式大列
- 01 STATUS：FF14 式狀態表 + Learning Flow
- 02 ABILITY：六維雷達永久移除，改成 FF16 式 Eikon Ring 六節點
- 03 GROWTH：FF15 式 Stage / Next / EXP / OOS / Stability
- 04 TACTICS：FF14 式密集戰術列 + ABC / Live / OOS / Pattern
- 05 TARGETS：候選與情報
- 06 MISSIONS：任務清單 / Research Path
- 07 ARCHIVE：固定歷史 / XP / Warning

顏色：
- 深海軍藍 #263745
- 深鋼藍 #354b5a
- 深灰藍
- 暖銅金 / 米白
- 無淺色大面積背景
- 無接近純黑的 pill / badge / 大面積面板

穩定：
- Auto refresh 10 分鐘
- 8 分鐘內不重抓
- 最近 2 分鐘有操作不刷新
- 01～06 任一展開時，背景 refresh 暫停
- 手動 UPDATE 可立即更新
