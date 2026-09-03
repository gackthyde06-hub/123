V2.6.54 — REFERENCE VISUAL + GAMEPLAY LOGIC INTEGRATED

只 Replace：
- growth-status-v2626-patch.mjs

不要動 advisory / package.json / start-safe / server / Railway。

這版不是二選一，整合：
A. 使用者認可的 V2.6.53 / 舊版視覺
B. 後面版本的遊戲化養成邏輯

【主畫面保留】
- 深海軍藍 + 暖金
- SYSTEM GROWTH
- 4 個主狀態
- 3×2 角色狀態
- 5 階成長流程
- 主線任務
- 每日訓練
- 最近成長紀錄
- 進階研究預設收起

【遊戲化整合】
主畫面只加一條低干擾資訊：
- Tactical Rank
- Ability Points / AP
- Ascension 晉階同步率

進階研究內整合：
- Buff / Debuff 狀態效果
- 5 個晉階試煉
- ABC
- Pattern
- 真正通知績效
- 候選統計

【可展開】
角色狀態 6 項：
- 點擊原地展開
- 顯示真正學習依據

主線任務每一條：
- 點擊原地展開
- 顯示目前數值
- 顯示晉階規則
- 顯示是否達標

每日訓練每一條：
- 點擊原地展開
- 顯示這條後台現在實際在驗證什麼

【字體 / 背景】
- 全部文字放大一級
- Panel 背景比內容卡更深
- 卡片與最下面進階研究再拉開層次
- 不再全部像同一塊「結構記憶」

【穩定】
完全保留 V2.6.53 / V2.6.52 防跳架構：
- 自動更新不重畫正在看的 DOM
- staged data
- cache first paint
- exact scroll restore
- nested 展開狀態在手動 SYNC 後會恢復
- MutationObserver 不使用

【後台】
5 個真實來源全部保留：
shadow-mentor / performance / manual-opportunities / test-signals / symbol-analysis
