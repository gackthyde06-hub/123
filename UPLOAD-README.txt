V10.2.7 系統養成 UI — 上傳方式

請在 GitHub repo gackthyde06-hub/123 的根目錄一次上傳這 4 個檔案：
1. package.json（覆蓋原本）
2. prepare-ui.mjs（新增）
3. system-growth.js（新增）
4. system-growth.css（新增）

不要放進 public 資料夾。
Railway 下一次啟動時 prepare-ui.mjs 會自動：
- 把 system-growth.js / system-growth.css 複製到 public/
- 在 public/index.html 注入載入標籤（只注入一次）
- 再啟動原本 server.js

核心 server.js / public/app.js / V10.2.7 判斷邏輯都不會被修改。

上線後：
左上「交易監控」旁會出現「/ 系統養成 Lv.X」。點它即可展開/收起。

AI 情報只有按「查最新情報」才會呼叫既有 /api/symbol-analysis；不會背景自動燒 API。
