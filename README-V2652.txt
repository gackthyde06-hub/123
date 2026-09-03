V2.6.52 — STABLE FF GROWTH + HEADER REDESIGN

只 Replace：
- growth-status-v2626-patch.mjs

不要動 advisory / package.json / start-safe / server / Railway。

【畫面跳動：架構改掉】
1. 自動抓到新資料時，如果養成目前正在顯示：
   - 只更新記憶體資料
   - 不 render
   - 不改 DOM
   - 不改高度
   - 不動目前 scroll
2. 新資料會 staged，直到：
   - 養成關閉後在隱藏狀態套用，或
   - 使用者手動按 SYNC
3. Manual SYNC 會記住精確 window.scrollY，重畫後恢復同一位置。
4. 移除舊 MutationObserver。
5. LocalStorage 保存精簡後台快照：
   - 下次重新進網頁先用上次資料立即畫出
   - 不再先空白，等 API 回來後整頁突然長高。
6. Auto Sync：
   - 15 分鐘
   - 12 分鐘內不重抓
   - 最近 3 分鐘操作時不重抓
   - 顯示中的養成永遠不因自動同步重畫。

【交易監控 / 系統養成 Lv.14】
重新設計成一個品牌 Lockup：
- 左：TRADING MONITOR / 交易監控
- 金色主標
- 中間細金分隔線
- 右：SHADOW PROTOCOL / 系統養成 / Lv.14 / 箭頭
- 完全透明底
- 沒有大黑 pill
- 沒有 browser default button 樣式
- 手機尺寸另做 560 / 370 breakpoint。

【顏色】
比 V2.6.51 再深：
- 主底 #182a36
- 深海軍藍 #1d303c
- 深鋼藍 #223642 / #283d49
- 暖金 / 米白
- 不用淺藍大面積
- 不用純黑大面積

【資料與遊戲邏輯】
V2.6.51 的 Rank / AP / Trials / Ability Board / Battle Record /
Tactical Codex / Hunt Board / Quest Log / Archive 全部保留。
Shadow / Performance / Mentor / Manual / Test Signals / Symbol Analysis 全保留。
