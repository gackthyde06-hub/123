V2.6.30 上傳方式

把 ZIP 解壓後所有檔案丟到 GitHub repo 根目錄：
- start-safe.mjs -> Replace（必要）
- final-ui-v2629-patch.mjs -> Replace（同版重新附上，避免漏檔）
- ui-final-v2629.css -> Replace（同版重新附上，避免漏檔）
- TEST-REPORT-V2.6.30.txt -> Add

不要改：
- Railway Variables
- Railway Volume
- package.json
- Railway Start Command

Start Command 仍然：node start-safe.mjs

部署 log 應看到：
[boot:V2.6.30 ...] BOOT READY in ...
以及
final UI contract:ok

若 final UI contract 有問題，這版會直接快速失敗，不會等五分鐘後才拿一個假的成功畫面。
