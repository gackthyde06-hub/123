Worth Watch (V2.6.82)

啟動
- 本機 / Railway：npm start  →  node server.js
- 開發：npm run dev
- 健康檢查：GET /healthz
- 設定：根目錄 railway.json（startCommand = npm start）

結構
- server.js：唯一後端入口（補丁已合併進此檔）
- worth-watch-v2682-core.mjs：B 級「值得看」評分核心
- public/：靜態前端（index.html、app.js、sw.js）
- start-safe.mjs：相容舊啟動指令，轉呼叫 server.js

測試
- npm test
- node test-worth-watch-v2682.mjs
