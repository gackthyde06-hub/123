V2.6.19｜獨立頁面鎖定＋實際建倉收合

重點
1. 「我的實際建倉」新增整區收合/展開：
   - 預設沿用目前狀態（第一次為展開）
   - 點「縮小」即可收合，只留標題與 ACTIVE 數
   - 狀態記在本機，下次開 APP 保留
   - 結案、修改、歷史、後台績效與 Volume 不受影響

2. 建議 / 監控 / 觀察 三頁獨立鎖定：
   - 每一頁都有自己的鎖定狀態，互不影響
   - 鎖定時，後台仍照常抓資料、Shadow/績效照常學習
   - 只凍結目前畫面的排序與 DOM，避免操作到一半排行跳掉
   - 有新資料時會顯示「有新資料 · 解鎖更新」
   - 解鎖時一次套用最新資料

3. 舊的單一頁面鎖圖示隱藏，改由 V2.6.19 的獨立鎖定控制。
4. 延續 V2.6.17 的畫面防抖與 TradingView 返回定位，不新增 MutationObserver / 重複刷新迴圈。
5. app cache bust 更新為 102619 / sg2619。

部署
- 解壓後全部上傳 GitHub repo 根目錄。
- package.json Replace。
- start-safe-v2619.mjs / workspace-v2619-patch.mjs Add。
- Railway Variables / Volume 不要改。
- 若 Railway Start Command 有手填，改成：node start-safe-v2619.mjs
- Deploy Success 後 iPhone PWA 完全關閉再重開一次。
