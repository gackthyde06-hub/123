V2.6.41 — JRPG 養成 UI 重做

只 Replace：
- growth-status-v2626-patch.mjs

不要換 advisory-buckets-v26271-patch.mjs。
不要動 package.json / start-safe.mjs / server.js / Railway。

這版只改養成視覺與排版，資料/學習邏輯不變。

設計方向：
- 日式傳統 RPG / 角色狀態選單氛圍
- 深靛藍、墨藍、古典金框、暖金文字
- 非現代 SaaS dashboard
- 非近黑色 badge / pill / 標籤
- 純文字「交易監控 / 系統養成 Lv.X」入口

整合內容：
- STATUS 角色狀態：職階、Lv、成熟度
- 六維能力 + 雷達
- 學習戰績：影子樣本 / 去相關有效 / 命中 / PF / 真正通知 / 實際建倉 / 風險過濾
- 成長章節 I~VI
- 下一階解鎖條件
- 學習報告
- 主線任務
- 每日訓練
- 成長紀錄

舊 growth renderer 只停止前端重複渲染；後台資料與學習資料不刪。
