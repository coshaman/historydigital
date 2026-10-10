# Russian Lives: Act III — V42 acceptance report

Date: 2026-10-10  
Route: MAIN20 / V42 ideological history layer  
Scope: approved V42 specification plus V41 regression gates

## Required verification

| command | result |
|---|---|
| `npm run check` | PASS |
| `npm run build` | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS |
| `node scripts/v41-life-ending-choice-route-audit.mjs` | PASS |
| `npm run v42-ideological-history-audit` | PASS |
| `npm run v42-source-context-audit` | PASS |
| `npm run v42-ending-counterfactual-audit` | PASS |
| `npm run v42-runtime-contract-audit` | PASS |
| `npm run v42-speech-register-audit` | PASS |

## Browser acceptance

`npm run v42-browser-acceptance` passed at both required viewports. The measured body width matched the viewport and no horizontal drift was detected.

| viewport | final route | body / viewport | result |
|---|---|---:|---|
| 1440×900 | ending | 1440 / 1440 | PASS |
| 390×844 | ending | 390 / 390 | PASS |

Evidence: `artifacts/v42-browser/report.json`.

## Five-ending acceptance

`npm run v42-five-ending-browser-acceptance` passed. Every ending resolved only with its ideological and concrete-action gate, and every ledger contained three belief statements, at least two actions, and callbacks.

| ending | resolved | beliefs | actions | callbacks | strong gate |
|---|---|---:|---:|---:|---|
| UVAROV | UVAROV | 3 | 6 | 3 | PASS |
| BELINSKY | BELINSKY | 3 | 6 | 3 | PASS |
| HERZEN | HERZEN | 3 | 6 | 3 | PASS |
| KHOMYAKOV | KHOMYAKOV | 3 | 6 | 3 | PASS |
| DOSTOEVSKY_PETRASHEVSKY | DOSTOEVSKY_PETRASHEVSKY | 3 | 6 | 3 | PASS |

Evidence: `artifacts/v42-browser/five-endings.json`.

## Content gates

- The prologue precedes C03 and covers Europeanization, the Table of Ranks, the protagonist's 10th-rank incentives, Uvarov's triad, Chaadaev, and differentiated Westernizer/Slavophile positions.
- C07 keeps 1842 *Dead Souls* before the 1847 Gogol material and the 1847 Belinsky letter.
- No Chekhov material is present in the 1836–1849 route.
- Consequential choices expose audience, record mode, office exit and broad immediate risk before selection.
- Historical quotations and literary borrowing are separate; V42 has no literary-borrowing record.
- Dialogue register is audited across first meeting, ordinary colleague, private, conflict, intimacy and formal institutional settings.
- Numeric ideology/affinity scores are not rendered to players; endings show belief/action/callback evidence instead.

## P0/P1 status

Required P0 and P1 gates: none open. Known limitation: some source records are intentionally marked `PARAPHRASE` and are never presented as verbatim historical speech; their source locator and Korean explanation remain visible in the source drawer.

