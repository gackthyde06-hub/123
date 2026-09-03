V2.6.32 — exact Railway build-error fix

Root cause from Railway log:
- prepare-ui succeeded
- workspace / lock / institutional / mentor succeeded
- final-ui-v2629 tried to run advisory-buckets-v26271-patch.mjs
- V2.6.27.1 expected the pre-V2.6.16 manual renderer
- prepare-ui had already changed gradeText/render/filter/tabs to UI_CONTROL_V2616
- therefore V2.6.27.1 failed at "grade helpers anchor missing"

This version does NOT call advisory-buckets-v26271-patch.mjs.
It patches the actual post-UI_CONTROL_V2616 manual renderer directly.

Upload all 3 code files to GitHub repo root:
1. build-production-v2631.mjs -> Replace
2. advisory-buckets-v2632-patch.mjs -> Add
3. growth-final-v2632-patch.mjs -> Add
README may also be uploaded, but is not required.

Do NOT change:
- package.json
- start-safe.mjs
- Railway Variables
- Railway Volume
- Railway Start Command

Expected build tail:
[v2632-advisory] READY
[v2632-growth] READY
[build:V2.6.32 ...] BUILD CONTRACT PASS

Expected UI:
- A · 自動通知
- A · 手動觀察
- B · 自動通知
- B · 手動觀察
- default first view = A · 手動觀察
- existing manual cards keep stable order across refresh
- only the V2.6.25/V2.6.26 growth UI stays visible; legacy growth renderer is blocked
