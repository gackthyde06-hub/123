V10.2.1 PUBLIC

修正內建圖表的 TP/入場方向錯置：
- 二次回踩階段優先使用 reentryZone / reentryInvalidation，不再混用第一輪舊目標。
- LONG 強制：SL < 入場 < TP1 < TP2。
- SHORT 強制：TP2 < TP1 < 入場 < SL。
- 若後端舊 target 與目前建議入場方向衝突，前端依目前入場與失效距離重新計算 1R / 1.5R。
- 若二次回踩區尚未建立，不顯示舊第一輪入場/TP，避免誤導。
- app.js cache key 更新為 v1021。

其他 V10.2.0 功能與交易邏輯不變。
