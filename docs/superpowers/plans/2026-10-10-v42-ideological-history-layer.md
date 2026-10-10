# V42 Ideological History Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a historically sourced ideological prologue and Gogol–Belinsky debate to the existing MAIN20 route while preserving V41 playability and making five endings depend on beliefs plus concrete actions.

**Architecture:** Keep `main20-runtime.js` as the route owner and extend the existing JSON authoring model rather than creating a second game flow. Add ideology state/evidence and dated source-backed beats to the narrative data, then make the existing ending resolver consume both ideology gates and action/relationship evidence. Add static and browser acceptance audits that prove historical context, choice clarity, chronology, responsive layout, and regressions.

**Tech Stack:** Vanilla JavaScript, JSON narrative data, Node.js audit scripts, Playwright browser acceptance, existing HTML/CSS source-reader UI.

**Spec:** `docs/superpowers/specs/2026-10-10-v42-ideological-history-layer-design.md`

## Global Constraints

- Preserve the existing MAIN20 runtime, source reader, RU/KO alignment, chronology, save/load, window, five endings, and legacy-runtime isolation.
- Do not add Chekhov to the 1836–1849 route.
- Do not display numeric ideology or affinity scores to players.
- Every new core source record includes sourceId, date, edition, locator, original Russian, Korean translation, DIRECT/PARAPHRASE, and player-availability date.
- Every consequential choice exposes audience/visibility, record mode, office exit, and broad immediate risk before selection.
- Official Nationality is not Slavophilism; Westernizer, Slavophile, Gogol, Belinsky, Petrashevsky, and Table of Ranks must not be reduced to the forbidden equivalences.
- Use contiguous verified source ranges for arguments requiring context; literary borrowing is separate from historical quotation.

## Review Focus

- A migrated V41 save must remain loadable without gaining fabricated ideology evidence; test normalization and legacy recovery.
- A player must not reach an opposite ending from ideology-only or routing-only choices; test controlled counterfactual candidates.
- A source-reader excerpt must show enough contiguous context and aligned RU/KO text; test every new source range.
- Character voices must differ in register and rhythm, not only ideology labels; test the speech matrix and dialogue audit.
- The prologue and C07 follow-up must remain legible at mobile width without horizontal drift; test 1440×900 and 390×844 browser snapshots/measurements.

### Task 1: Add failing V42 authoring and regression audits

**Files:**
- Create: `scripts/v42-ideological-history-audit.mjs`
- Create: `scripts/v42-source-context-audit.mjs`
- Create: `scripts/v42-ending-counterfactual-audit.mjs`
- Modify: `package.json`
- Test data: `narrative/MAIN_20MIN_DIALOGUE.json`

**Interfaces:**
- Audits load the JSON narrative and report non-zero exit status with actionable source/choice IDs.
- `v42-ideological-history-audit.mjs` validates required beats, state dimensions, speech-register matrix, forbidden equivalence warnings, no Chekhov, and choice immediate-direction fields.
- `v42-source-context-audit.mjs` validates source metadata, contiguous range references, RU/KO alignment, classification, and availability dates.
- `v42-ending-counterfactual-audit.mjs` imports the browser-exposed resolver contract or a shared pure resolver fixture and verifies belief/action conjunctions.

- [ ] **Step 1: Write failing audit assertions** for the required source IDs, beat IDs, ideology dimensions, choice fields, warning strings, and five ending gates.
- [ ] **Step 2: Run the new audits** with `node scripts/v42-*.mjs` and confirm they fail against the V41 baseline for missing V42 data.
- [ ] **Step 3: Register npm scripts** named `v42-ideological-history-audit`, `v42-source-context-audit`, and `v42-ending-counterfactual-audit`.
- [ ] **Step 4: Commit the audit scaffolding** with message `test: define v42 ideological history gates`.

### Task 2: Author verified ideological source records and the prologue

**Files:**
- Modify: `narrative/MAIN_20MIN_DIALOGUE.json` source registry, context ranges, scene order, and dialogue data
- Create: `docs/v42/IDEOLOGICAL_SOURCE_REGISTER.md`
- Create: `docs/v42/IDEOLOGICAL_FALSE_EQUIVALENCE_WARNINGS.md`

**Interfaces:**
- Each source record follows the existing source schema and is addressable by stable `sourceId`.
- New scene groups expose source excerpts through the existing `readExcerptIdsByScene` and source drawer paths.
- Choice effects use a stable `ideologyEffects` object and `callbackKey` consumed by Task 3.

- [ ] **Step 1: Add source records** for Uvarov 1833, Table of Ranks, Chaadaev 1836, one Westernizer primary text, one Slavophile primary text, Gogol 1847, Belinsky 1847, and Petrashevsky/Fourierist context, with original Russian, project Korean translation, locator, classification, and date availability.
- [ ] **Step 2: Add contiguous context ranges** and paired RU/KO excerpt blocks; keep historical quotations separate from any `LITERARY_BORROWING` records.
- [ ] **Step 3: Add a 3–4 minute prologue** before C03 covering Europeanization, the protagonist’s 10th rank and practical incentives, Uvarov’s triad, Chaadaev, and the actual institutional/social differences between Westernizer and Slavophile arguments.
- [ ] **Step 4: Add prologue choices** that are natural first-person statements, all historically arguable, include a defer option where justified, and carry immediate audience/record/office/risk copy plus ideology and callback effects.
- [ ] **Step 5: Add the forbidden-equivalence warning registry** and ensure no authored prose uses those equivalences as factual claims.
- [ ] **Step 6: Run source and ideological audits** and confirm they pass before runtime work.
- [ ] **Step 7: Commit** with message `feat: author v42 ideological prologue sources`.

### Task 3: Extend MAIN20 state, migration, choice effects, and visible callbacks

**Files:**
- Modify: `main20-runtime.js`
- Modify: `narrative/MAIN_20MIN_DIALOGUE.json` choice effect fields as needed
- Test: `scripts/v42-ending-counterfactual-audit.mjs`

**Interfaces:**
- `fresh()` returns `ideology`, `ideologyEvidence`, and `visibleCallbacks` with stable empty defaults.
- `normalize(raw)` migrates V34/V35/V41 saves without inventing evidence and preserves existing route state.
- `addChoiceEffects(choice, phase)` applies ideology deltas, records belief statements, and activates callback keys.
- `resolveEndingDetailed(source)` returns `ideologicalEvidence`, `actionEvidence`, `beliefLedger`, and `callbackEvidence` in addition to the existing fields.

- [ ] **Step 1: Add failing migration and effect tests** covering fresh state, old save normalization, prologue choice effects, callback activation, and no numeric-score rendering.
- [ ] **Step 2: Implement state normalization and choice effect application** without changing legacy runtime ownership or existing phase names.
- [ ] **Step 3: Implement dated prologue traversal** using the existing intro/reading/discussion/decision/reaction phases and ensure C03 remains the first historical case after it.
- [ ] **Step 4: Add resolver gates** requiring relevant ideological evidence and concrete action/relationship evidence for each ending; preserve all five IDs and avoid array-order fallback for insufficient evidence.
- [ ] **Step 5: Run targeted audits and route tests**; confirm old V41 saves recover safely and canonical V41 routes still resolve.
- [ ] **Step 6: Commit** with message `feat: connect ideology state to main20 runtime`.

### Task 4: Add the chronological Gogol–Belinsky 1847 playable debate

**Files:**
- Modify: `narrative/MAIN_20MIN_DIALOGUE.json` C07 sequence, sources, choices, callbacks
- Modify: `main20-runtime.js` only if a dated follow-up transition requires a named phase/data helper
- Test: `scripts/v42-ideological-history-audit.mjs`

**Interfaces:**
- C07 presents 1842 `Dead Souls` before the 1847 `Selected Passages` and Belinsky letter.
- The post-1847 choice IDs expose moral/institutional/mixed/defer positions and produce visible later callbacks.

- [ ] **Step 1: Write failing chronology and choice assertions** proving the 1842 → 1847 order and the four plausible responses.
- [ ] **Step 2: Author the 1847 Gogol and Belinsky context** as separate verified witnesses, explicitly distinguishing satire from later conservative moral/Orthodox/hierarchical arguments and Belinsky’s institutional/social-reform objection.
- [ ] **Step 3: Add the playable decision and immediate direction copy** with no modern “correct” answer.
- [ ] **Step 4: Add callback dialogue** in E02/E07 or later reaction lines that makes the selected position visible.
- [ ] **Step 5: Run chronology, source, and browser route checks** through the full C07 route.
- [ ] **Step 6: Commit** with message `feat: make gogol belinsky debate playable`.

### Task 5: Enforce speech-register and Korean dialogue quality

**Files:**
- Modify: `narrative/MAIN_20MIN_DIALOGUE.json` speech matrix and new/affected dialogue
- Create: `scripts/v42-speech-register-audit.mjs`
- Modify: `package.json`

**Interfaces:**
- The speech matrix has rows for Alexei, Ekaterina, Pavel, and protagonist and columns for first meeting, ordinary colleague, private, conflict, intimacy, and formal institution.
- The audit rejects identical endings/rhythm patterns across characters in the same situation and checks that dialogue remains natural Korean.

- [ ] **Step 1: Write failing speech-register tests** for matrix completeness, distinctive sentence endings, vocabulary markers, and conflict/intimacy shifts.
- [ ] **Step 2: Rewrite affected lines** so register varies by relationship and situation while preserving historical content and source labels.
- [ ] **Step 3: Run `v42-speech-register-audit.mjs` and `npm run korean-copy-lint`** until both pass.
- [ ] **Step 4: Commit** with message `fix: differentiate v42 character speech registers`.

### Task 6: Render the belief/action ending ledger without exposing hidden scores

**Files:**
- Modify: `main20-runtime.js` ending rendering and resolver evidence formatting
- Modify: `index.html` ending overlay markup
- Modify: `styles.css` ending ledger responsive styles
- Test: `scripts/v42-ending-counterfactual-audit.mjs`

**Interfaces:**
- `renderEnding()` renders 3–4 actual belief statements, at least two concrete actions, one callback, biography, future life, and source references.
- No rendered node contains numeric affinity or internal ideology dimension names.

- [ ] **Step 1: Write failing DOM assertions** for the ledger sections, minimum evidence counts, callback, and hidden-score absence.
- [ ] **Step 2: Implement ledger data selection** from the resolver’s recorded evidence, deduplicating beliefs while preserving chronological order.
- [ ] **Step 3: Add markup and paper/ink styling** within the existing ending overlay; keep mobile layout within viewport width.
- [ ] **Step 4: Run all five ending render routes** and the counterfactual audit.
- [ ] **Step 5: Commit** with message `feat: show belief and action ending ledger`.

### Task 7: Browser acceptance, full regression, and delivery evidence

**Files:**
- Create: `scripts/v42-browser-acceptance.mjs`
- Create: `docs/v42/V42_ACCEPTANCE_REPORT.md`
- Modify: `package.json`

**Interfaces:**
- Browser acceptance runs the canonical route at 1440×900 and 390×844 and records screenshots/report evidence under `artifacts/v42-browser/`.
- It answers the six prologue comprehension checks and three Gogol/Belinsky checks through visible text and route state.

- [ ] **Step 1: Write failing browser assertions** for route order, source opening, visible choice directions, no horizontal drift, save/load, window behavior, and the nine comprehension prompts.
- [ ] **Step 2: Implement the browser harness** using the existing Playwright conventions and per-run artifact directory.
- [ ] **Step 3: Run targeted V42 browser acceptance** at both viewports; fix only V42 regressions found by evidence.
- [ ] **Step 4: Run the full verification suite:** `npm run check`, `npm run build`, `npm run lint`, `npm run test`, V41 audits, V42 audits, and browser acceptance.
- [ ] **Step 5: Produce the acceptance report** with commands, results, screenshots, five-ending evidence, P0/P1 status, and known limitations (none for required gates).
- [ ] **Step 6: Commit** with message `test: verify v42 ideological history layer`.

## Final completion gate

Only after every checkbox is complete and the authoritative reports pass, report:

`V42_IDEOLOGICAL_HISTORY_LAYER_COMPLETE: YES`
