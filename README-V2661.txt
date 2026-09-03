V2.6.61 — STRUCTURE HEADER RESTORE

只 Replace：
- growth-status-v2626-patch.mjs

這版專門修 V2.6.60 把 Structure Memory Header 拆壞的問題。

【核心改法】
不再：
- prepend 新 icon
- 重設 Structure Memory grid
- 改 SAMPLE 位置
- 改 title group
- 整張卡加強制 padding

改成：
1. 清掉 V59/V60 自己注入的舊 icon / class。
2. 找真正原本的「結構記憶 + SAMPLE」Header。
3. 找 Header 原本左側那顆空菱形。
4. 只在原本菱形內畫 Structure icon。
5. 完全不改 Header DOM 順序與 layout。

因此預期回到：
[菱形圖示] [結構記憶 / STRUCTURE MASTERY] [608 SAMPLE]

主線任務 V2.6.60 的 5 種不同 icon 保留。
鎖 UI 清除、防跳 staged refresh/cache/exact-scroll 保留。
