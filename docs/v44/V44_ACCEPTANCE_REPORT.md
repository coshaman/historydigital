# V44 philosophy-first final route acceptance report

Date: 2026-10-11

## Required route

`PROLOGUE → ACT1_UVAROV → ACT2_CHAADAEV → ACT3_SLAVOPHILE_WESTERNIZER → ACT4_GOGOL_BELINSKY → ACT5_PETRASHEVSKY_CENSORSHIP → ENDING`

The required runtime route contains C07 and E07 only after the prologue; C03, C06 and E02 are preserved as archive/optional records.

## Implemented gates

- Table of Ranks, Uvarov, Chaadaev, Khomyakov/Westernizer, Gogol/Belinsky and Petrashevsky source records remain RU/KO aligned with dates, locators, classification and context references.
- Opinion, interpretation, dialogue response, evidence request and action are distinct. Opinion does not automatically publish or move a document.
- Beliefs and actions are separate migrated state arrays.
- E07 directly asks about censorship, national security, speech and the difference between thought and prepared action.
- Ending presentation has desk fade, belief reveal, portrait reveal, historical life, player future and action/source controls, with reduced-motion fallback.
- V44 choice audit covers all current route choices and archive decisions.

## Evidence commands

| command | result |
|---|---|
| `node scripts/v44-philosophy-first-audit.mjs` | PASS |
| `npm run check` | PASS after route normalization |
| `npm run build` | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS |
| `npm run v43-ideology-first-story-audit` | PASS |
| `npm run v42-runtime-contract-audit` | PASS |
| `npm run v42-ending-counterfactual-audit` | PASS |
| `node scripts/v41-life-ending-choice-route-audit.mjs` | PASS |
| `npm run v42-five-ending-browser-acceptance` | PASS: all five endings resolve with 3 beliefs, 4 actions and callbacks |
| `npm run v44-browser-acceptance` | blocked in this sandbox by Playwright `ERR_NETWORK_ACCESS_DENIED` for `127.0.0.1:4173`; static route/runtime audits pass |

P0/P1: 0 open. Further work after this patch is human playtesting and final sentence polish only.

