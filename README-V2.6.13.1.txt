V2.6.13.1 HOTFIX — Railway 啟動健康檢查修正版

問題：
V2.6.13 的 npm start 原本是：node prepare-ui.mjs && node server.js
只要任一 UI patch 因版本錨點、舊檔殘留或執行逾時而失敗，server.js 就完全不會啟動，Railway 會停在系統／健康檢查階段。

修正：
1. 新增 start-safe-v26131.mjs 作為正式啟動器。
2. UI prepare 最長等待 40 秒（可用 UI_PREPARE_TIMEOUT_MS 調整，但不需要新增 Variable）。
3. prepare 成功：照常啟動完整 V2.6.13 UI。
4. prepare 失敗／逾時：Fail-open，保留最後可用 public UI 並直接啟動 server.js，不再讓 UI patch 阻擋 Railway health check。
5. Fail-open 時仍會把 V2.6.13 已建倉中心 JS/CSS 複製到 public 並補上 index.html 引用。
6. 不改通知門檻、Shadow、ABC、TradFi 學習、實際建倉資料、Railway Variables 或 Volume。

部署：
把本包內容全部上傳到 GitHub repo 根目錄，同名 Replace、新檔 Add。
Railway Variables / Volume 不要動。
