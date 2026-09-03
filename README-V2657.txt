V2.6.57 — DIAMOND CENTER + TYPO POLISH

只 Replace：
- growth-status-v2626-patch.mjs

這版修三件事：
1. 菱形圖示空掉 / 缺圖
2. 圖示歪、沒有真正在菱形正中央
3. 字體與小區塊排版不夠穩

【圖示】
- System Growth 主卡：保留圖騰，但改成真正置中
- 角色狀態等段落菱形：統一改成「菱形框 + 正中央圖示」
- 進階研究資料：自動補上 research icon
- 結構記憶：自動補上 structure icon
- 如果外部模組比養成晚 render，boot 後還會延遲重跑幾次補圖，所以不會只出現空菱形

【置中方式】
- 以前是整個容器旋轉，圖再反轉，所以視覺上容易歪
- 現在改成：容器不旋轉，只讓邊框 pseudo-element 旋轉成菱形
- 圖示本體用 absolute 50% / 50% + translate(-50%, -50%) 真正置中

【排版】
- 上方交易監控 / 系統養成字距與對齊修正
- Tactical Rank / AP / Ascension 上方資訊條固定 3 欄，不再像壞掉的格線
- 角色狀態卡文字行高與數字位置修正
- 英文小標與說明字級 / 行高 / 間距一起調整
- 進階研究標題區排版更穩

【不變】
- 配色與 Structure Memory 統一風格保留
- Rank / AP / Ascension 保留
- 可展開功能保留
- 防跳動架構保留
