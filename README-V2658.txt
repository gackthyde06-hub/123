V2.6.58 — ICON CENTER + STRUCTURE FIX

只 Replace：
- growth-status-v2626-patch.mjs

本版：
1. 完整刪除 Tactical Rank / Ability Points / Ascension Sync 那整條欄位。
2. 系統養成圖示改成 SVG 直接置中：
   - 容器不旋轉
   - 只有 ::before 畫菱形框
   - SVG 永遠 50% / 50% + translate(-50%,-50%)
3. 進階研究圖示直接寫進 markup，不再靠補圖。
4. 結構記憶是外部 runtime 區塊：
   - exact label 找「結構記憶」
   - 向上最多 9 層找左側真正空菱形
   - 依位置評分挑正確菱形
   - 正規化舊 rotate
   - 補 Structure icon
   - 0 / 0.3 / 1 / 2.5 秒重試
   - 再每 2.5 秒最多重試 60 秒
   - pageshow / 回到 App 再重跑
5. 字體統一：
   - 中文標題、英文小標、數字字體重新整理
   - Regime 適應等中英混排避免亂斷字
   - 系統養成 / 交易監控 / 進階研究對齊與行高修正
6. V2.6.52 起的 staged refresh / cache / exact-scroll 防跳架構保留。
