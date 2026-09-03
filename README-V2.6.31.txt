V2.6.31 — BUILD THEN RUN

這版不再在 Railway runtime 啟動前跑任何 UI patch。

根本修正：
1. Railway BUILD 階段：一次性完成 prepare-ui + workspace + mentor + final UI contract。
2. Railway START 階段：start-safe.mjs 只直接啟動 server.js，不再 patch、不再 node --check、不再等 patch timeout。
3. 若 UI / A-B / Growth / backend endpoint 有缺，BUILD 直接失敗，根本不會進到部署健康檢查。
4. 若 BUILD 通過，runtime 應幾乎立即開始 server.js。

上傳：ZIP 解壓後全部丟 GitHub repo 根目錄。
- package.json -> Replace
- start-safe.mjs -> Replace
- build-production-v2631.mjs -> Add
- 其餘 txt -> Add

Railway Variables / Volume 不動。
Railway Start Command 若目前手填 node start-safe.mjs，保持不動。
Railway Build Command 不用手動改；Node provider 會執行 package.json 的 build script。
