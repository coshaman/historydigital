# V43 ideology-first story audit — acceptance report

Date: 2026-10-11  
Route: MAIN20 / V43 final historical-ideological editing pass

## Story and data gates

- `docs/v43/IDEOLOGY_STORY_AUDIT.tsv` covers 64 story rows: six route classifications, eight source records and all 50 current choices.
- `docs/v43/CHOICE_TYPE_AUDIT.tsv` covers all 50 choices and distinguishes OPINION, INTERPRETATION, DIALOGUE_RESPONSE, EVIDENCE_REQUEST and ACTION.
- The route contains more than five pure opinion/dialogue choices; no all-ACTION choice model remains.
- C07's 1842 → 1847 Gogol → 1847 Belinsky order is retained. Each 1847 beat has multiple meaningful opinion/interpretation responses and locally reconverges.
- The 1847 Gogol/Belinsky route distinguishes moral reform, institutional/social reform, public literary criticism and evidential deferral without forcing a modern correct answer.
- `docs/v43/PRUNED_FROM_MAIN_ROUTE.md` records supporting/context-only decisions without deleting verified source data.

## Verification commands

| command | result |
|---|---|
| `npm run v43-generate-story-audits` | PASS — 50 choices / 64 story rows |
| `npm run v43-ideology-first-story-audit` | PASS |
| `npm run v43-provenance-false-equivalence-audit` | PASS |
| `npm run check` | PASS |
| `npm run build` | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS |
| `node scripts/v41-life-ending-choice-route-audit.mjs` | PASS |
| `npm run v42-runtime-contract-audit` | PASS |
| `npm run v42-ending-counterfactual-audit` | PASS |

## Browser and ending evidence

The existing MAIN20 browser harness, invoked by `npm run v43-browser-acceptance`, verifies the V43 route at 1440×900 and 390×844. The current evidence file reports ending state and exact body/viewport equality at both sizes:

- `artifacts/v42-browser/report.json`: PASS, desktop 1440/1440 and mobile 390/390, no horizontal drift.
- `artifacts/v42-browser/five-endings.json`: PASS for UVAROV, BELINSKY, HERZEN, KHOMYAKOV and DOSTOEVSKY_PETRASHEVSKY; each has three beliefs, six actions and three callbacks in the contract fixture.

## Final gates

- False-equivalence audit: PASS.
- Provenance/context audit: PASS.
- V41 regression gates: PASS.
- P0/P1: 0 open.
- No new historical structure is planned after this pass; next work is human playtesting and sentence polish only.

