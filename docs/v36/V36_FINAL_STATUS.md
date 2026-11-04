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

- 82 of 85 environment tiles remain `UNVERIFIED_RECONSTRUCTION`. GID 63–65 have bounded scene-level references, not evidence for each tile's exact appearance. Fictional resident clothing has not had a source-by-source visual review. Pixel uniqueness does not establish human-perceived sprite identity.
- Browser performance was measured with SwiftShader software rendering at about 0.9–2.5 FPS. Hardware GPU timing and a 10-minute live device session remain unverified.
- Human playtesting is pending.
- Vercel production key configuration and actual deployed AI generation are unverified. The browser smoke gate runs against the locally built app only.

These gaps intentionally keep `V36_COMPLETE: NO`.
