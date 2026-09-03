V2.6.21 — INSTITUTIONAL SHADOW MENTOR + REAL WORKSPACE LOCK

本版依 2026-09-03 匯出的 Shadow 研究資料重構：
- Shadow 1140 筆；1127 已結算；328 筆為已結算且 learningEligible。
- 實際通知績效目前只有 1 筆，所以不以通知結果硬調勝率門檻，避免過度擬合。

【影子養成核心重構】
1. 完成度 / readiness 與真正方向 Edge 分離。
   - 原品質分仍代表條件完成與執行狀態。
   - 新 Institutional Edge 只用去相關後、同資產優先、淨交易成本後的 Shadow 實績。
2. 淨成本學習：使用 netR / netReturnPct；若舊紀錄沒有 netR，依 realizedR、Stop距離與 PERF_ROUND_TRIP_COST_BPS 估算淨R。
3. 去相關：同標的同模式 45 分鐘內不重複灌權重。
4. 分層：同資產 → 策略×狀態×方向 → 策略×方向 → 策略 → 方向。樣本不足不硬學。
5. Wilson 保守下界 + Net PF + Net Expectancy R 共同決定 Edge，不再只看表面勝率。
6. 成本 / Stop 比：
   - A 預設需 <= 0.35
   - B 預設需 <= 0.60
   - > 0.65 直接視為執行成本硬阻擋
7. 策略會依未來累積資料動態升降，不寫死「某策略永遠好/壞」。
   - 足夠樣本且 Net PF / 淨期望偏弱 → A 封頂 B。
   - 突破回測若樣本足且嚴重負期望 → 直接硬阻擋。
8. UNKNOWN regime 不允許靠缺資料升 A。
9. BTC/ETH（或美股）大盤逆向仍是硬風險，不會因 Shadow 高分被洗掉。
10. 「距離回踩區太遠 / 等二次回踩 / 尚未 ready」屬 execution/readiness，仍禁止當下通知，但不再被學成「方向判斷錯」。
11. A/B 通知新增 Institutional Edge Gate：
    - A：Edge + 成本效率 + 原高級門檻 + 無硬風險
    - B：Edge + 成本效率 + 原普通門檻
12. 手動/影子 A/B 排序：級別 → Edge → execution score → 原排名。
13. 新 ABC Shadow 紀錄增加 mentorModelVersion / institutionalEdgeAtEntry / costRatioAtEntry / strategyNetPfAtEntry / strategyNetExpRAtEntry，方便下一輪研究。

【鎖定完全重做】
- 建議 / 監控 / 觀察才顯示鎖。
- 只是一個小鎖圖示，固定在「目前頁面右上」，不佔排版、不放任何說明文字。
- 三頁各自記住鎖定狀態。
- 鎖定後：前端週期刷新、手動影子面板、觀察實際建倉 Hub 都不准重建目前畫面，因此展開、輸入、建倉操作不會被自動關掉或跳位。
- 後端 Railway 的 Shadow、行情、績效與學習仍持續運作。
- 解鎖才一次抓最新資料。
- V2.6.17 TV 返回定位與防抖保留。
- V2.6.19 我的實際建倉可縮小保留。

預設不用新增 Railway Variables；所有新門檻已有保守預設值。
