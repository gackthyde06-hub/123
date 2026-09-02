V2.5.4 RESEARCH SYNC RESILIENCE

Root cause fixed at both layers:
1) /api/test-signals no longer waits for runTestSignalScan(). It returns the latest tracker snapshot immediately and schedules refresh in background.
2) Growth UI no longer blocks rendering on test-signals. /api/performance is the critical path and renders first.
3) Hard timeouts: performance 7s, test-signals 4.5s.
4) Last-good local cache fallback for temporary API/network stalls.
5) Independent system-growth-rescue.js is loaded BEFORE system-growth.js. Even if the source patch anchor changes later, test-signals still cannot hang the page forever.
6) No changes to Structure Engine rules, HIGH/NORMAL thresholds, Shadow data, Research data, trader logic, Volume, or notification rules.

Upload ALL 3 functional files to repository ROOT and replace prepare-ui.mjs:
- prepare-ui.mjs
- runtime-resilience-patch.mjs
- system-growth-rescue.js
README is optional.
