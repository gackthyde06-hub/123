V2.6.29 上傳方式

把這包內的檔案丟到 GitHub repo 根目錄：
- start-safe.mjs -> Replace
- final-ui-v2629-patch.mjs -> Add
- ui-final-v2629.css -> Add
- TEST-REPORT-V2.6.29.txt -> Add

Railway Variables / Volume 不要動。
Railway Start Command 保持：node start-safe.mjs

這版刻意不允許「核心服務成功但新版 UI silently rollback」。
如果 A/B、UI stability、system growth 最終契約沒有真正套用，部署會直接失敗，不會再拿綠燈騙你。
