V2.6.42 — JRPG 養成 UI 二次重製

只 Replace：
- growth-status-v2626-patch.mjs

其他全部不要動。

這版處理：
1. 所有字串 mobile-safe：
   - min-width:0
   - overflow-wrap:anywhere
   - word-break:break-word
   - 700/480/360 三段 responsive
   - 長標題與說明不再跑出格子
2. STATUS 角色區重新壓縮比例，手機不再擠爆。
3. 六維圖整個重畫：
   - 六角能力核心
   - 中央星芒徽記
   - 外圈節點
   - 四層刻度
   - 金藍雙層資料面
   - 能力值文字不再塞在圖外
4. 六維文字改成旁邊/下方 RPG 能力列表：
   STR / DEX / INT / SEN / VIT / WIL
5. 手機 700px 以下圖與能力列表自動上下排；
   480px 以下單欄；360px 以下角色狀態也改單欄。
6. 保留 V2.6.41 所有養成資料與邏輯，純粹重做 UI/UX。
