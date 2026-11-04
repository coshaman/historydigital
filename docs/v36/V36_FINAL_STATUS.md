# V36 status — current audited state

This is a progress snapshot, not a completion declaration. The integrated acceptance gate covers the listed checks only; unresolved evidence remains explicit.

```text
V36_36_ACTIVE_CITIZENS: YES
V36_30_POSSESSABLE: YES
V36_NPC_INDEPENDENT_DAILY_GOALS: YES
V36_6_DISTRICTS_8_INTERIORS: YES
V36_ASSETS_AND_PERIOD_EVIDENCE: NO
V36_OPENWORLD_CONTENT: YES
V36_5_ENDINGS: YES
V36_VERIFIABLE_BUILD: YES
V36_BROWSER_QA: YES
V36_GPU_PERFORMANCE: UNVERIFIED
INDEPENDENT_REVIEW: COMPLETE_WITH_P1_FOLLOWUP
HUMAN_PLAYTEST: PENDING
VERCEL_PRODUCTION_GENERATION: UNVERIFIED
V36_COMPLETE: NO
```

## Confirmed follow-up

A direct replay on the deployed game exposed a same-date resident quest whose continuation incorrectly attempted to advance the historical campaign timeline. The continuation now remains in the resident quest flow. The regression browser check resolves the Vasily discussion, confirms the campaign date is unchanged, clicks the follow-up, and asserts that `invalid_campaign_date` does not appear. See `ACCEPTANCE.json` and `current-audit/LIFE_CHAIN_DATE_CONTINUATION_BROWSER_EVIDENCE.json`.

## Evidence still missing

- 82 of 85 environment tiles remain `UNVERIFIED_RECONSTRUCTION`. GID 63–65 have bounded scene-level references, not evidence for each tile's exact appearance. Seven limited source-inspired resident asset reviews are recorded with explicit limits: Nadezhda (egg sellers), Sergey (gatekeeper), Matryona's portable vending rack, and Fyodor's bread-on-tray prop from Labastide's circa-1845 Petersburg studies; Klavdiya (fish sellers), Roman (ice delivery), and Timofey (cab hire) from Collmann watercolors dated to the 1830s and 1842. Matryona's male peddler source informs only the goods rack, not her clothing. Fyodor's kalach-seller source informs only a rounded bread product cue, not bakery workwear, recipe, or oven practice. The other 29 residents remain unreviewed. See `qa/ASSET_REVIEW_MANIFEST.csv` and `current-audit/RESIDENT_COSTUME_BROWSER_EVIDENCE.json`. Pixel uniqueness does not establish human-perceived sprite identity.
- Headless Chrome used SwiftShader, not a hardware GPU. The latest 1440×900 run measured an 88.6 ms initial full-desk draw, zero idle redraws, and one redraw when focusing the window. Browser callback median was about 60 Hz with a 50 ms p95 during window focus; this is not a hardware-GPU frame-time result. Real GPU timing and a 10-minute live device session remain unverified.
- Human playtesting is pending.
- Vercel production key configuration and actual deployed AI generation are unverified. The browser smoke gate runs against the locally built app only.
- The earlier 1,762-file evidence archive passed SHA-256 verification, `npm run check`, `npm run build:v33`, and a browser smoke of extracted `dist-v33/`. The current 1,767-file archive passes SHA-256 verification and its clean extraction passes `npm run check`. Dependency-backed visual-kit and build checks were run in the workspace; `node_modules` is intentionally excluded from the archive. A clean `npm ci` could not complete here: the default npm cache returned `EPERM`, then the isolated cache's registry request returned `EACCES`.

These gaps intentionally keep `V36_COMPLETE: NO`.
