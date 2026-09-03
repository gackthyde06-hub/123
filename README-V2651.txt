V2.6.51 — FINAL FANTASY GAME SYSTEM REBUILD

只 Replace：
- growth-status-v2626-patch.mjs

不要動 advisory / package.json / start-safe / server / Railway。

這版不是報表換皮，而是把後台績效轉成遊戲養成規則。

【角色系統】
- Tactical Rank：C / B / A / S / EX
- Rank Score 由真實數據合成：
  Shadow Hit / Shadow PF / Forward OOS / Stability / Diversity / Actual Trade proof
- Ability Points (AP)：
  Effective sample / Forward sample / Actual resolved / Notify / Learned patterns
- Lv / Research EXP 沿用真實樣本養成

【01 Ascension Trials】
後台規則直接變成 5 個晉階試煉：
1. 去相關試煉：有效樣本
2. 時空試煉：Forward OOS sample + PF
3. 穩定試煉：positive time folds
4. 泛化試煉：concentration score
5. 實戰試煉：actual resolved trades
全部 CLEAR 才是完整晉階條件。

【02 Ability Board】
- 完全沒有雷達圖
- FF16 式 6 節點能力盤
- Structure / Trend / Money / Depth / Risk / Discipline
- 點節點可切換真實學習依據

【03 Battle Record】
直接讀 /api/performance recent：
- 真正送出通知
- WIN / LOSS / ACTIVE
- symbol / direction
- realized R
- Hit / PF / Expectancy / Actual

【04 Tactical Codex】
- ABC
- Best Pattern
- Downweight Pattern
- Train PF
- Forward OOS
- Diversity
- Stability

【05 Hunt Board】
候選標的改成討伐目標：
- Grade
- Direction
- Structure
- Execution
- Calibrated Win Rate
- Notification Tier
- 最新外部情報

【06 Quest Log】
不完整規則直接變主線任務。
Mentor warnings 變 Debuff。
PF / OOS / Stability / Diversity 達標變 Buff。

【07 Archive】
預設收起，不再用巨大 Archive 佔滿整頁。
需要時才看 XP 曲線、Memory、Warnings。

【穩定】
- Auto sync 10 min
- 8 分鐘內不重抓
- 最近 2 分鐘操作不刷新
- 任一 01–07 展開時背景 refresh 暫停
- 手動 SYNC 可立即抓
- 更新保留展開章節與閱讀位置

【顏色】
- 深海軍藍 #263b48
- 深鋼藍 #324b58
- 深灰藍
- Antique gold
- Ivory
- 無淺色大底
- 無接近黑色大底 / pill / badge
