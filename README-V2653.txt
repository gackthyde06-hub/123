V2.6.53 — REFERENCE STYLE GROWTH POLISH

只 Replace：
- growth-status-v2626-patch.mjs

不要動：
- advisory-buckets-v26271-patch.mjs
- package.json
- start-safe.mjs
- server.js
- Railway

本版以使用者指定「比較好看」的舊 System Growth 截圖作為視覺基準，不再換另一套風格。

【畫面】
- 整體寬度鎖在 820px，桌機不會被拉成超寬儀表板。
- 深海軍藍卡片 + 暖金 + 少量鋼藍。
- 大圓角、細金框、資訊層級回到舊版。
- SYSTEM GROWTH 頂部保留：
  Lv / 成熟度 / Train Net PF / Forward OOS / Warning。
- 角色狀態回到 3×2 六能力卡。
- 成長進度回到 5 階橫向流程。
- 主線任務使用單列任務 + 進度條。
- 每日訓練 / 最近成長紀錄做雙欄，手機自動單欄。
- ABC / 通知績效 / Pattern / 候選仍保留在「進階研究資料」，預設收起，不破壞主畫面。

【交易監控 / 系統養成】
- 交易監控：暖金大字。
- / 系統養成 Lv.X：透明底，沒有大黑 pill。
- 比 V2.6.52 更接近使用者提供的參考截圖。

【畫面跳動】
沿用 V2.6.52 穩定架構：
- 自動抓到新資料時，正在看的養成 DOM 不重畫。
- 新資料先 staged。
- 關掉養成後才在看不到的狀態套用。
- Manual SYNC 保留 exact scroll。
- 使用 localStorage cache 做首屏，避免空白 → API 回來突然長高。
- 新裝置即使沒有 cache，第一次成功抓資料仍會正常 render。
- MutationObserver 已移除。

【資料】
仍讀：
- /api/shadow-mentor
- /api/performance
- /api/manual-opportunities
- /api/test-signals
- /api/symbol-analysis

Shadow / ABC / Mentor / OOS / Actual Trade / Patterns / Candidates 全部保留。
