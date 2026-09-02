V2.6.11 — QUIET NOTIFICATIONS + STABLE TV RETURN + COIN PROFILE
Date: 2026-09-02

這版延續 V2.6.10，不改交易核心門檻、Shadow/影子學習、實際建倉追蹤或 Railway Volume。

1) 頁面鎖定精簡
- 今日 / 績效 / 流向：完全不顯示鎖定控制。
- 建議 / 監控 / 觀察：保留小鎖圖示，沒有「鎖定/取消鎖定」文字。
- 鎖定仍會記住頁面並阻止左右滑誤切；通知深連結仍可強制進正確頁。

2) TradingView 返回位置 V3
- 開 TV 前記住：目前頁、symbol、卡片位置、viewport offset、scrollY。
- 回 APP 後以 symbol/卡片重新定位，不再只靠舊的 href index。
- 回來後約 10 秒暫停 8 秒頁面重繪，避免建議榜刷新把畫面推走。
- 多階段重定位；只要使用者自己開始滑動，就立即停止自動定位。
- 沒有強迫 tradingview:// iOS scheme；目前 iOS App 並沒有可靠、官方可依賴的指定 ticker deep-link 行為，維持 TradingView 網頁連結最可控。

3) PF 99.00 顯示修正
- 影子 PF 內部統計仍保持原邏輯。
- 當 Profit Factor 因「目前沒有已結算虧損」而回傳 99 上限時，UI 顯示「無虧損」，不再顯示誤導性的 PF 99.00。

4) 建議排名：移除 AI 網搜詳細
- 原「展開（詳細） / AI網搜」改成「幣種介紹 / 公開資料・中文整理」。
- 不再因展開建議排名而呼叫 /api/symbol-analysis 或 OpenAI。
- 顯示：類型、主要作用、歷史/背景、交易時要知道。
- 內建常見主流幣、L1/L2、DeFi、RWA、AI、迷因、隱私等中文資料卡；未知標的會使用市場 profile 作安全 fallback。
- 不影響原本的即時量化排名、OI、Funding、WS 或回測。

5) 通知白名單
手機只保留：
- 高勝率單（HIGH entry）
- 普通單（NORMAL entry）
- ABC單（手動 A/B/C 機會）：保留；通知標題會直接寫「ABC單｜A/B/C級｜標的」，點擊進建議頁的手動作戰清單
- 交易員單：建倉 OPEN、加碼 ADD、減碼 REDUCE、平倉 CLOSE
- 今日市場整理

已停止手機通知：
- 轉弱 / 轉強 / 續強 / 收復
- 達標 / 失效 / 移出監控等純狀態提醒
- 二次回踩 TOUCH、二進結果；只有真正「二次確認進場」且 HIGH/NORMAL 才保留
- 回踩 / 深回踩 / 回踩過深 / 結構失效
- 共識 CONSENSUS
- VALID / ALL 類泛用提示與測試噪音

6) 通知點擊路由
- 高/普通單 -> 監控的該標的
- 交易員單 -> 今日
- 今日市場整理 -> 今日
- ABC單 -> 建議頁「手動作戰清單」；高/普通單 -> 監控該標的
- Service Worker 另外有第二層白名單，舊/排隊中的多餘通知也不顯示。

7) 通知設定 UI 同步
- 交易員通知類型只顯示 OPEN / ADD / REDUCE / CLOSE。
- 系統訊號不再顯示「全部有效 ALL」模式，只保留高勝率或高＋普通。
- 共識通知設定隱藏；共識資料本身仍可留在 APP 內查看，不會推手機。

部署：
- ZIP 內檔案上傳 GitHub repo 根目錄。
- 同名檔案 Replace，新檔直接新增。
- Railway Variables / Volume 不要刪、不要重建。
- Railway 重新部署後，iPhone/PWA 的 Service Worker 可能需要重新開 APP 一次讓新版 SW 接管。
