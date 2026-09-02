V2.5.3 養成頁卡住 Hotfix

根因：system-growth.js 同時等待 /api/performance 與 /api/test-signals。
當 /api/test-signals 掃描較慢時，整個養成頁會一直停在「讀取養成資料中」。

修正：
1. 新增 system-growth-fetch-hotfix.js。
2. /api/test-signals 最多等 4 秒；超時會 abort，原有 .catch(()=>null) 會接手。
3. /api/performance 已正常時，養成頁可直接渲染，不再被候選訊號 API 拖死。
4. 不修改 Structure V2、通知門檻、Shadow、Research、Volume 或交易判斷。
5. cache tag 升到 sg253，避免手機/電腦吃舊 JS。

上傳：兩個 .js/.mjs 檔案放 GitHub repo 根目錄，同名 prepare-ui.mjs 覆蓋。
README 可不傳。
