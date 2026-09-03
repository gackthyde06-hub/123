V2.6.22 — SHADOW MENTOR EDGE / UI CLEANUP

目的
- 不改你的通知開關、交易員設定、Railway Variables、Volume 或既有實際建倉資料。
- 保留既有架構，只把 Shadow 從「會學」提升成「先證明有 Edge 才敢升級」。
- 手動頁增加「高勝率 · 高 Edge 觀察」，讓最值得研究的候選獨立浮出，不混入 A/B 的執行分級。
- 小鎖移到 LV / SAMPLE 同一排最右側；仍是建議 / 監控 / 觀察三頁各自獨立鎖定。

Shadow Mentor V2.6.22
1. 淨成本優先
   - 所有歷史 Edge 用 netReturn / net R，不用毛績效騙自己。
   - 成本 / 停損比仍是執行閘門；方向判斷和「現在能不能上車」分開。

2. Frozen Train → Forward OOS
   - 首次部署會在 Railway Volume 建立 shadow-mentor-v2622-state.json。
   - V2.6.22 部署前的有效去相關樣本形成 Frozen Train。
   - 部署後的新樣本先進 Forward 驗證，不立即回灌權重。
   - Forward 目標 40 筆；策略方向至少 20 筆才開始有明確懲罰/驗證。
   - 重新部署不會把 Forward 起點歸零（Volume 不刪即可）。

3. 時間穩定度
   - 歷史樣本做 chronological 3-fold 檢查。
   - 只在某一段行情漂亮的策略會被折價；穩定窗不足時限制 A。

4. 集中度 / Leave-Top-2
   - 檢查績效是否只是被少數標的撐起來。
   - Top2 集中過高，且拿掉 Top2 後 Edge 崩掉，會限制 A / 扣 Edge。

5. Multiple-testing haircut
   - 同時研究越多策略，對看起來最漂亮的結果越保守，避免挑到運氣最好的一個。

6. Selective abstention
   - 沒有足夠 Edge / Confidence / 成本效率時，允許「不交易」。
   - C / 被阻擋資料仍可作研究與稽核，但不因方向最後走對就解除追價/執行禁令。

7. Canonical asset fix
   - 修正舊 CSV 中 EQUITY_TOKEN / STOCK / ETF 與目前 TRADFI 分類不一致的問題。
   - 美股永續歷史樣本不再錯誤混到 CRYPTO 同資產層。

目前這批 Shadow 校準（2026-09-03）
- 原始 1140 筆
- 已結算且可學習 328 筆
- 45 分鐘去相關後有效訓練 306 筆
- 整體 Net PF 0.64 / Net Expectancy -0.233R：代表整體還不是可無腦交易的 Alpha。
- 流動性掃盤反轉：107 筆，Net PF 1.16，但跨時間窗不穩、且 META/TSLA 集中度偏高，因此 V2.6.22 不會直接把整類永久加權。
- 強勢動能續攻與突破回測：目前 net-of-cost 為負，會由 Mentor 自動降權 / 限制 A；未來若 Forward 真的翻正才恢復。

手動頁 UI
- A / B 保持執行分級。
- 新增「高勝率 · 高 Edge 觀察」：從目前候選中先過硬阻擋、成本與 Edge/Confidence，再以校準勝率排序，最多顯示 5 筆。
- 這區只是額外研究，不會自動下單，也不改你現有通知設定。
- 每筆保留 TV 與既有「建倉」快速流程。
- 移除重複的舊 ABC Shadow 大區塊；每張手動卡把「原 Shadow + ABC Shadow」合併成一格 Mentor Edge。

影子訓練可視化
- 「系統養成」內新增 Mentor 訓練體檢：成熟度 /100、有效樣本、Net PF / Net Expectancy、時間穩定窗、Forward 進度、目前最強策略。
- 手動頁只保留「高勝率 · 高 Edge 觀察」與簡短 Train/Forward 狀態，不再重複塞一整套 Shadow 統計。
- 舊 ABC Shadow 重複區塊隱藏；每張卡只留一格 Mentor Edge。

鎖定
- 鎖圖只保留一顆，小尺寸，放到 APP 最上方「系統養成 / Lv.xx」同一排最右側。
- 建議 / 監控 / 觀察仍是三個獨立 lock state。
- 鎖住只凍結可見 DOM / 排序 / 展開 / 輸入中的建倉畫面；後端市場抓取、Shadow、績效與學習繼續跑。
- 解鎖後才套用最新畫面。

公開研究設計原則
- transaction-cost aware execution
- walk-forward / strict out-of-sample
- backtest-overfitting / multiple-testing correction
- selective deployment / abstention
- funding/order-flow 只作條件化特徵，不把單一公開因子硬寫成必勝訊號

重要
- V2.6.22 的目標是提高「可驗證 Edge 的純度」，不是宣稱保證勝率。
- 不要刪 Railway Volume，否則 Forward OOS 起點與歷史持久資料會受影響。
