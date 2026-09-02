V2.6.13.2 — UI freeze hotfix

修正：V2.6.13 的 Actual Trade Hub MutationObserver 會在已存在「建倉」按鈕時，反覆重寫 textContent，造成 DOM childList mutation 再觸發 observer，形成無限微任務迴圈。結果是瀏覽器主執行緒被餓死：頁籤/按鈕都像不能按，畫面停在「同步中」「系統檢查中」。

本版：
1. 只有按鈕文字真的改變時才寫 textContent，切斷 mutation loop。
2. hub JS 本身永久加入 V26132_MUTATION_LOOP_FIX。
3. start-safe 在啟動時再做一次保險修補，並 node --check；若 hub 語法異常，會停用 hub layer，核心 APP 仍可操作。
4. hub / app cache bust 更新，避免手機/PWA 繼續吃到舊的凍結 JS。
5. 不改 Shadow、ABC、通知門檻、實倉 API、Railway Variables、Volume。
