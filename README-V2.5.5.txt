V2.5.5 CORE-FIRST RECOVERY

Purpose
- Fix long/infinite "同步研究資料…"
- Restore Today / Performance / Flow / Ideas / Monitor / Observe navigation
- Prevent System Growth from pushing or trapping the main app
- Remove the global system-growth-rescue.js fetch monkey patch from the live page
- Keep Structure Engine V2, Shadow, Research, notifications, thresholds and Railway Volume untouched

What changes
1) /api/performance is the only critical Growth request.
2) /api/test-signals becomes optional/background for Growth UI.
3) 6.5s watchdog forcibly exits a stuck Growth load; if no cached performance exists it closes Growth automatically.
4) System Growth is CLOSED by default after deploy.
5) Growth is mounted AFTER .pageTabs instead of before it.
6) Clicking any main page tab automatically closes Growth first.
7) Page tabs get a high z-index/pointer-events guarantee.
8) Growth open height is capped (desktop 72vh / mobile 68vh) and scrolls internally.
9) A sticky "返回交易監控" emergency button is always present while Growth is open.
10) Old system-growth-rescue.js is explicitly removed from index injection and is not loaded.

Upload to repository ROOT (not public/)
- prepare-ui.mjs (replace)
- ui-recovery-v255-patch.mjs (new)
- ui-recovery-v255.css (new)

No need to delete old files. system-growth-rescue.js may remain in the repository; prepare-ui will remove its script tag so it will not run.

Validation performed
- Node syntax: prepare-ui.mjs PASS
- Node syntax: ui-recovery-v255-patch.mjs PASS
- Exact System Growth 2.3.1 fixture + V2.5.4 runtime patch + V2.5.5 recovery: PASS
- Patched system-growth.js node --check: PASS
- Patch idempotency: PASS
- Verified old Promise.all critical loader removed
- Verified tabs moved ahead of Growth and auto-close hook added
- Verified old scroll position restore removed
