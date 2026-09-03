V2.6.45 — FF GROWTH UX POLISH

只 Replace：
- growth-status-v2626-patch.mjs

不要動：
- advisory-buckets-v26271-patch.mjs
- package.json
- start-safe.mjs
- server.js
- Railway

這版沿用 V2.6.44 的 FF 方向，不重新推翻。

【排版】
- 5 頁拆成 7 頁：
  STATUS / ABILITY / GROWTH / TACTICS / TARGETS / MISSIONS / ARCHIVE
- 手機選單不再橫向滑動。
- 700px 以下：固定 4 欄網格。
- 480px 以下：固定 2 欄網格。
- 360px 以下仍不產生頁面水平捲動。
- 成長階段手機也改成 3×2，不再左右滑。

【字體 / 間距】
- 主標題、選單、數值、說明文字整體放大。
- Desktop main padding、區塊上下距離、能力區、任務區全部重新計算。
- 重要數字與次要說明層級重新拉開。

【遊戲化視覺】
- STATUS 新增 Learning Loop：
  觀察 → 去相關 → 通知 → 實戰 → 學習
- GROWTH 新增 3 個解鎖里程碑：
  Effective / Forward OOS / Stability
- MISSIONS 新增 Training Loop：
  觀察市場 → 結構篩選 → 去相關 → 實戰驗證 → 回寫學習
- Crystal Matrix 保留，移到獨立 ABILITY 頁，不再跟 STATUS 擠在一起。
- 技能熟練也移到 ABILITY。
- 主線進度移到 GROWTH。
- 每日訓練 / 研究路線集中在 MISSIONS。

【穩定 / 不跳】
- 自動刷新：45 秒 → 180 秒。
- 120 秒內不重抓。
- 使用者最近 60 秒有點擊 / 觸控 / 鍵盤操作時，自動刷新直接延後。
- 回到頁面時不再 force refresh。
- 原本相同資料 signature 不重畫機制保留。

【資料】
完整保留：
Shadow / ABC / Mentor / XP / Lv / Crystal Matrix /
候選 / 最新情報 / 真正通知 / 實際建倉 /
Train / Forward OOS / Stability / Concentration /
Best-Worst patterns / Daily / History / Warnings。
