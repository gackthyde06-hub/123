V6.0 TV AUTO

核心更新
- TradingView Webhook 真正自動帶入，不再要求你在 App 手動輸入 TV 資料。
- 來源可切換：高手目前倉位 / TradingView 自動訊號。
- 新 TV 訊號抵達後，App 自動切到 TV、展開下單試算並帶入 symbol / side / entry。
- Pine 若送 sl / tp1 / tp2 / tp3，會同步自動帶入。
- 保證金與槓桿保留使用者自己決定，並即時計算總倉位、TP/SL U、保證金報酬%、RR。
- 保留 V5.9.1 隱藏倉位防誤平與 V5.9.2 LIVE PNL。

TradingView 一次性設定
1. 部署 ROOT + PUBLIC。
2. App 打開「下單試算 > TradingView 自動帶入設定」。
3. 把 Webhook URL 貼到 TradingView Alert 的 Webhook URL。
4. Alert message 使用 App 顯示的 JSON。若你的 Pine 有 SL/TP，請另外傳 sl/tp1/tp2/tp3 欄位。
5. 之後 Alert 每次觸發都會自動進 App。

注意：V6.0 仍為試算與訊號接收，不會送出 Binance 真實訂單。
