V2.6.43 — FULL SHADOW GROWTH / JRPG REDESIGN

只 Replace：
- growth-status-v2626-patch.mjs

不要換 advisory-buckets-v26271-patch.mjs。
不要動 package.json / start-safe.mjs / server.js / Railway。

這版不是縮水版。重新把舊影子養成重要內容全部整合回同一套 UI：

【角色 / 成長】
- 影子養成角色
- Research EXP / Lv / 總 XP
- 成長階段 / 下一階 / 階段說明
- 7 日研究到訪
- 近七日 XP 成長曲線

【六維 / 技能】
- 六維能力核心圖
- 結構判讀 / 趨勢掌握 / 資金嗅覺 / 深度感知 / 風險控管 / 耐心紀律
- 每一維可展開看學習依據
- 技能熟練 Lv / 初階 / 進階 / 熟練 / 專精 / 大師
- 下一技能等級 EXP

【Shadow ABC】
- A / B / C 戰術養成
- 每級樣本 / 命中 / PF / adjustment
- 每級 EXP
- 即時「正在發生」市場回合
- 影子已追蹤 / 已結算 / 有效 / 去相關週期

【研究證據】
- 影子樣本
- 去相關有效
- 可學習樣本
- 影子命中 / PF / Expectancy
- 真正通知
- 實際建倉
- 風險阻擋 / 阻擋命中 / 排除率

【Mentor / OOS / 泛化】
- Train Net PF / Expectancy
- Forward OOS sample / PF / Expectancy
- 時間穩定窗口
- 集中度 Top2
- 去 Top2 PF
- 最強模式
- 最佳學習模式
- 需降權模式
- Mentor maturity / stage

【研究路線】
- 解析
- 候選
- 日誌
- 三章完成度會保留

【候選 / 情報】
- 影子候選標的
- Grade / Execution / Win rate / Observation / Structure / Notification tier
- 可展開
- 可直接「查最新情報」
- 利多 / 利空 / 接下來看 / 今日消息

【任務 / 記錄】
- 主線任務
- 每日訓練
- 成長紀錄
- 研究日誌 / 警告

視覺：
- 深靛藍 / 皇家藍 / 金色
- 比 V2.6.42 更深、更飽和
- 經典日式 RPG 選單 / 狀態窗氣氛
- 不用灰霧大卡
- 不做近黑色 badge / pill
- 所有字 mobile-safe，360px 仍可重排

舊 renderer 只停止前端重複顯示；server / performance / shadow-learning / mentor / ABC 學習資料完全不刪。
