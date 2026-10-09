# V28 baseline reproduction — 2026-10-03

This is a reproduction of the V27 working tree before V28 narrative changes. It is not a completion claim.

| V28 finding | Result | Evidence and reproduction |
|---|---|---|
| 24 cases have no authored character/dialogue graph | PASS (reproduced) | `gold-runtime.js:211-226` renders the V27 case as excerpt cards, then generic procedural/judgment/follow-up phases. `data/v27-case-bundle.json` has three judgments per case and repeated follow-up strings; C01/C07/C17/C19/C24 inspected directly. |
| Runtime exposes meta/operator copy | PASS (reproduced) | `gold-runtime.js:211-226` contains `시범 케이스 자료 담당`, `내 판단`, `케이스 후속 기록`, `자료 처리의 순서를 선택하십시오`, and `후속 자료가 열렸습니다.`. `index.html:41,69` exposes `현재 할 일`, `상신 쪽지`, and `검토할 문장을 표시하십시오`. |
| Access/relation can rise from procedural index | PASS (reproduced) | `gold-runtime.js:226` maps P1/P2/P3 directly to `officialRecord`, `dossierEvidence`, `crossBorder`, `officialPressure`, and `editorContact`; no NPC conversation or transfer witness is required. |
| Case fallback can break chronology | PASS (reproduced in code) | `gold-runtime.js:219` falls back to the first unfinished normal case when no transition matches. The old V27 branch report contains a C19→C02 path; C19 is dated 1849 while C02 is dated 1836. |
| Five-ending fallback | PASS (not reproduced in current code) | Current `resolveV26Ending()` returns `null` when no rule matches; direct hard-gate counterexample evidence is retained in V27. |
| Mobile visual overlap / weak conversation focus | PASS (visual reproduction) | Opened raw `artifacts/v27-browser/mobile-initial.png` (390×844) and `desktop-c03.png` (1440×900). The paper, window, prop labels, and dialogue area compete for the same focus; mobile labels overlap the paper/window composition and no portrait/dialogue staging exists. |
| V27 data and historical excerpts available | PASS | `data/v27-case-bundle.json`, `data/v27-route-graph.json`, `data/v27-ending-rules.json`; V27 source and browser evidence remain untouched. |

## Baseline commands

- `npm run check`, `npm run build`, `npm run lint`, `npm run test`, and `npm run mobile` pass in the pre-V28 tree.
- Raw visual evidence opened: `artifacts/v27-browser/mobile-initial.png`, `artifacts/v27-browser/desktop-c03.png`.
- V27 normal run: 12 cases; V27 alternate packets: 12; this is retained as a regression baseline, not a V28 acceptance result.

## Preservation note

V28 adds a separate `narrative/` graph and a versioned runtime state. Existing V27 source files and audits remain available for regression comparison. V28 human playtest remains independent from automated and reviewer evidence.
