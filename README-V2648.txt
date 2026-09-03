V2.6.48 — MONITOR MATCH + COLLAPSIBLE GROWTH

只 Replace：
- growth-status-v2626-patch.mjs

不要動：
- advisory-buckets-v26271-patch.mjs
- package.json
- start-safe.mjs
- server.js
- Railway

本版整合兩個最新需求：

1. 顏色跟交易監控搭配
- 沿用交易監控暖金 #d4a54b / #edc46e
- 沿用暖米白 #f2eee6
- 但養成不直接用交易監控近黑 #070809 / #131414 當大面積標籤
- 改成深石墨 / 深暖灰 / 深棕灰 + 金線

2. 01～06 做成小型展開章節
- 01 STATUS
- 02 ABILITY
- 03 GROWTH
- 04 TACTICS
- 05 TARGETS
- 06 MISSIONS
- 預設全部關閉
- 點擊原地展開
- 不換頁
- 不切換 DOM
- 研究路線跳轉時會自動打開對應章節

3. 防畫面跳動
- 只要 01～06 任何一章正在展開，自動背景 refresh 直接暫停
- 使用者原本的 idle refresh / minimum refresh 邏輯保留
- 關閉章節後才允許下一輪背景更新
- 07 ARCHIVE 保持直接顯示

4. Shadow / ABC / Mentor / OOS / Candidate / Performance / Actual Trade
全部資料來源與學習邏輯保留。
