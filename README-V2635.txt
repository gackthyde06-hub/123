V2.6.35 UI RESTRUCTURE

只 Replace 兩個檔案：
- advisory-buckets-v26271-patch.mjs
- growth-status-v2626-patch.mjs

不要動：
package.json
start-safe.mjs
server.js
Railway Variables
Railway Volume
Railway Start Command

改動：
1. 建議排名完整移到「觀察」頁，位於觀察清單下方。
2. 「建議」頁只保留 A級 / B級適合手動的標的。
3. 每個手動標的可展開；展開後直接顯示建倉表單，不用再按第二次。
4. 保留成本、TP1、TP2、SP1、SP2、保證金、槓桿、數量與實際建倉追蹤。
5. 刪掉影子 A/B 判斷、ABC Shadow、原 Shadow 等前台無用名稱。
6. 手動標的與排名固定既有順序，新標的才加入。
7. 同一批排名不重建 DOM。
8. 關閉左右滑動切頁，只能點分頁，避免滑動畫面時誤切頁。
9. 背景更新不再做 viewport scroll correction。
10. 系統養成改乾淨 UI，移除近黑色標籤/色塊；保留角色狀態、成長進度、主線任務、每日訓練。
11. 系統養成前台文字簡化，不再一直寫 Shadow / 影子。
