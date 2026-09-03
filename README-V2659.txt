V2.6.59 — ICON CENTER + STRUCTURE + NO LOCK

只 Replace：
- growth-status-v2626-patch.mjs

這次直接處理你最後一輪截圖裡最明顯的問題：

1. 系統養成圖示沒置中
- 不再使用 v55 / v58 的舊旋轉結構
- 改成全新 v59-diamond
- 菱形框用 ::before 畫
- 圖示用 ::after 畫
- 本體永遠真正置中
- 不會再被舊 svg / transform 樣式拖偏到右下角

2. 進階研究資料圖示
- 同樣改成 v59 新圖示系統
- 跟系統養成同一種定位方式

3. 結構記憶只有空菱形、沒有圖
- 不再嘗試硬改原本那顆空菱形
- 直接在「結構記憶」標題前插入一顆新的、完整的、同風格的菱形圖示
- 並把附近舊空菱形隱藏
- 會在 boot / render 後 / pageshow / 回到前景 / 後續定時重跑，所以外部 runtime 晚 render 也能補到

4. 鎖功能全部拿掉
- JS 會掃掉 lock 按鈕 / 浮動 lock
- CSS 也會把帶 lock id/class/aria/title 的元素直接隱藏
- 右下角浮動鎖與頁首小鎖都會被清掉

5. 其他
- 保留防跳動 staged refresh / cache / exact-scroll
- 保留你現在這套配色與版型，不重做醜東西
