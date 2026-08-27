# 熬鷹資本 → iPhone 倉位通知

監控對象：**熬鷹資本**  
Binance Portfolio ID：`5075281354358777856`

## 通知只保留 5 種

- 做多：顯示進場位
- 做空：顯示進場位
- 加倉：顯示方向 + 目前進場均價
- 減倉：顯示方向
- 平倉：顯示原方向已結束

不會因為浮盈浮虧、標記價格變動而通知。

## 資料來源

使用 Binance Copy Trading 公開倉位資料：

`/bapi/futures/v1/friendly/future/copy-trade/lead-data/positions?portfolioId=...`

後端預設每 3 秒比對一次「上一份倉位」與「最新倉位」，只在倉位大小或存在狀態改變時推播。

## iPhone 14 Plus 通知

需要 iOS 16.4 以上，部署網址必須是 HTTPS。

1. Safari 開啟部署後的網站。
2. 分享 → 加入主畫面。
3. 從主畫面開啟「熬鷹倉位通知」。
4. 按「開啟 iPhone 通知」。
5. 按「測試通知」。

成功後，即使網站沒有停留在前景，iPhone 也可以收到 Web Push。

## 啟動

```bash
cp .env.example .env
npm install
npm run vapid
```

把 VAPID keys 填進 `.env`：

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:你的信箱
```

再啟動：

```bash
npm start
```

## 部署重點

要 24 小時每 2–3 秒監控，後端必須是「不會睡眠」的常駐 Node.js 主機。免費會休眠的服務不適合這用途。

Binance 這個是網頁使用的公開資料介面，不是正式保證 SLA 的交易 API；若 Binance 改介面、地區限制或反爬規則，需要跟著調整。
