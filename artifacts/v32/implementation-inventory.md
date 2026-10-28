# V32 implementation inventory — 2026-10-28

## Base and baseline

- Worktree: `C:\Users\owner\.codex\worktrees\v32-ai-late-game\history`
- Start revision: `756f9033765329db8eec2cbdbfc175febf5d874e` (`origin/master`)
- Primary checkout is not used.
- `npm run check`: PASS (historical-lint and 12 branch-graph tests)
- `npm run lint`: PASS (`ui-lint: bespoke palette, no dead controls, reduced motion present`)
- `npm run test`: PASS (`route-test: five gated endings, branching relationship/invitation route, and E02/E04/E07 anchors`)
- `npm run build`: PASS (`static-integrity: source readability, JavaScript syntax, and JSON parsing`)

## Current integration points

- Runtime: `main20-runtime.js`; vanilla JS IIFE. Save key `chancery-main20-v35`; accepts V32–V35 legacy schema. Core state has `phase`, `branchHubIndex`, `routeChoices`, `branchState`, `circleLearningIndex`, `examQuestionIndex`, `examAnswers`, `examOutcome`, `promotionStatus`, `endingTimelineIndex`, `history`, `ideology`, `relationships`, and five-ending resolution fields.
- Branch graph: `main20-branch-graph.js`; `narrative/ACT_III_BRANCH_ROUTE.json`; four hubs (`H1-CIRCLE`, `H2-EXAM`, `H3-READING`, `H4-NEWS`), 12 authored choices/events, seven chronological sequence steps, five ending routes. Existing choices and route affinity must remain stable.
- Exam: `main20-exam.js` exports pure `scoreExam` and `derivePromotionStatus`. `narrative/ACT_III_LEARNING_EXAM.json` has four verified study units, five questions, stable answer key, threshold 3/5. This is the scoring foundation to expand, not replace with model grading.
- Life route: `main20-life-simulation.js` selects deterministic variants from `narrative/ACT_III_LIFE_SIMULATION.json`; timeline is rendered after ending selection.
- Character voices: `narrative/CHARACTER_BIBLE.md` and `MAIN_20MIN_DIALOGUE.json` define Alexei (concise/procedural, dry humor), Ekaterina (question-led, exact, subtly sarcastic), Pavel (weather/routes/timing, practical). The player’s interiority and actions are not AI-authored.
- Main DOM: `index.html`; desk with Three.js canvas, paper document, source drawer, physical tools, bottom dialogue strip, and fixed footer. A related late-scene shell can be added without replacing this DOM.
- Styles: `styles.css` accumulates generations of selectors, including the current `.gold-runtime` style. Do not add a second unrelated design system; share nameplate, portrait, paper/brass colors, dialogue controls, and footer affordances.
- Local server: `server.mjs` is a static Node HTTP server bound to `127.0.0.1`, port from `CHANCERY_PORT` or 4173; no API endpoint exists yet. No AI adapter/schema/lore cards are present.
- Source inventory: `narrative/ACT_III_BRANCHING_SOURCES.json` is an array; `MAIN_20MIN_DIALOGUE.json` includes `sourceRegister`, source metadata, chronology/source-context ranges, speech-register matrix, five endings, and branch dialogue. `ACT_III_LEARNING_EXAM.json` links each fact to `sourceIds` and exact provenance locators.
- Existing focused tests: branch graph, exam scoring, learning exam, life simulation, final route/browser evidence; existing scripts include historical lint, source/availability, v42 context and speech-register audits, route-test, mobile-check, real-build-browser-smoke, and v42 browser acceptance.

## Deployed UI inspection

Opened `https://coshaman.github.io/historydigital/` read-only. The initial screen showed the 3D desk, a single static dialogue line, “다음 말을 듣는다”, evidence toggle, save/load, and restart. The deployed page’s header reported `상트페테르부르크 · 1842년 1월 7일`, while the browser title and visible role were generic/1847-era; capture this as an existing release-parity concern for the later screenshot/build audit. No late-game AI interface is deployed.

## Invariants to lock in with tests

- Exactly five existing ending IDs remain: `UVAROV`, `BELINSKY`, `HERZEN`, `KHOMYAKOV`, `DOSTOEVSKY_PETRASHEVSKY`.
- Circle choices, historical anchor facts, chronology, save/restart, source drawer and H-key evidence stay functional.
- The four required public route replays from the V32 goal must reach an ending, including provider failure.
- New late-game state is versioned/migratable and is not derived from model-authored numeric deltas.
