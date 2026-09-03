RESTORE TO LAST KNOWN GOOD b6457d3

Upload ONLY these two files to GitHub repo root and choose Replace:
- package.json
- start-safe.mjs

Do not upload/remove/change anything else.
Do not change Railway Variables / Volume / Start Command.

Purpose:
- remove the later build-production-v2631.mjs build hook
- restore the exact V2.6.28 rollback-safe launcher
- leave all original app/UI/backend files untouched

Expected Railway:
- no `npm run build` application patch stage from V2.6.31+
- runtime starts with `[boot:V2.6.28]`
