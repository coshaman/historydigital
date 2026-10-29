# Circle Learning, Rank Exam, and Later-Life Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a source-grounded reading-circle lesson, an identical fair exam for all routes, and an interactive state-shaped fictional-life timeline while preserving the existing Act III graph and five endings.

**Architecture:** Keep content and provenance in checked-in narrative JSON, put grading and timeline selection in pure browser modules, and integrate those modules into MAIN20 runtime/UI with versioned state migration. Add deterministic unit/static audits and Playwright acceptance that replays circle/exam outcomes through all five endings at desktop and mobile-like sizes.

**Tech Stack:** Browser JavaScript, JSON, Node.js built-in test runner, existing Playwright setup, HTML/CSS.

**Spec:** `docs/superpowers/specs/2026-10-16-circle-exam-life-simulation-design.md`

## Global Constraints

- Only fictional clerk actions, exposure, work record, relationships, and private route vary; dated historical outcomes never branch.
- Existing five ending IDs, source drawer, H-key evidence overlay, typed-response classification, courier traversal, reduced-motion behavior, and legacy isolation remain intact.
- All historical claims, dialogue, scene outcomes, and historical assets point to checked-in source records; fictional connective events are explicitly marked fictional.
- The document remains the focal object and uses the established paper, ink, wood, and brass visual language.
- All circle choices reach the same exam; circle attendance does not alter exam questions, answer key, threshold, or availability.
- The factual exam has exactly five questions; 3/5 is the pass threshold; deferral and helping Pavel do not produce a score.
- Preserve save/load and restart behavior; migrate old saves without losing route choices or evidence.
- Desktop and mobile-like layouts, reduced motion, keyboard access, and touch controls are required.
- `npm run check` passes and the app is run at desktop and mobile-like widths.
- Do not stage or alter the repository's pre-existing untracked user artifacts. Base synchronization and all commits must be explicit-path and recoverable.

## Review Focus

- A non-attendee can study before taking exactly the same exam; assert same IDs, order, key, and threshold for all circle states.
- Deferral/helper paths do not receive stale answers, scores, or promotion; cover fresh and migrated save states.
- Reload during learning/exam/result restores a usable phase and answer selection; restart clears new state without erasing existing evidence before restart.
- All five endings show the historical comparison first, then the correct fictional timeline; no dialogue panel remains visible underneath.
- Narrow viewport, long Korean copy, keyboard input, and reduced-motion never clip the controls or make progression depend on animation.

---

### Task 1: Establish an isolated implementation base and audit source facts

**Files:**
- Read: `AGENTS.md`, approved spec, `narrative/ACT_III_BRANCH_ROUTE.json`, `narrative/MAIN_20MIN_DIALOGUE.json`, source catalog/records referenced by the learning and exam routes.
- Create: none until the implementation worktree is ready.

**Interfaces:**
- Produces an implementation inventory listing verified source IDs/ranges, current runtime phase/state names, ending IDs, and available Playwright/browser scripts for Tasks 2–6.

- [ ] Inspect `origin/master` and current branch status; preserve all existing untracked files and logs.
- [ ] At implementation start, create/reuse an isolated worktree from the latest approved `origin/master` state; do not blindly merge or overwrite the dirty primary checkout.
- [ ] Run existing `npm run check` and focused branch-graph test before editing; save baseline outputs.
- [ ] Inspect each candidate source record and quote enough context to verify five objective teachable facts; reject unsupported or ambiguous claims.
- [ ] Map current save schema/migration, branch event phases, ending render entry point, and route replay API. Do not start feature edits until the inventory identifies these exact integration points.

### Task 2: Define source-backed lesson and exam data with failing content tests

**Files:**
- Create: `narrative/ACT_III_LEARNING_EXAM.json`
- Create: `scripts/main20-learning-exam-test.mjs`
- Modify: `package.json`
- Test: `scripts/main20-learning-exam-test.mjs`

**Interfaces:**
- Data schema: `schemaVersion`, `learningUnits[]`, `publicPrepUnitIds[]`, `questions[]`, `answerKey`, `passThreshold: 3`, `questionCount: 5`.
- Each learning unit: stable `id`, Korean title/body, `sourceIds[]`, exact provenance/range metadata, plus `fictionalElements[]` when it includes scene connective text.
- Each question: stable `id`, prompt, answer options with stable IDs, `learningUnitIds[]`, `sourceIds[]`.
- Answer key maps each question ID to exactly one answer option ID.

- [ ] Write tests that fail for question count other than five, duplicate IDs, missing learning prerequisite, missing/unknown source IDs, answer key with zero/multiple valid answers, unsupported public-prep coverage, and threshold other than 3.
- [ ] Run `node --test scripts/main20-learning-exam-test.mjs`; verify the intended schema assertions fail before implementation.
- [ ] Author five fact questions only from Task 1-verified sources; every tested fact appears in both circle teaching and public preparation content.
- [ ] Add test assertions that every question maps to at least one taught unit and source record and that public prep covers all five questions.
- [ ] Add `main20-learning-exam-test` package script and run it to PASS.

### Task 3: Implement pure exam scoring and outcome transitions

**Files:**
- Create: `main20-exam.js`
- Modify: `scripts/main20-learning-exam-test.mjs`
- Test: `scripts/main20-learning-exam-test.mjs`

**Interfaces:**
- `scoreExam(answers, examData) -> { correctCount, total, passed, outcome }`; only exact stable option IDs count.
- `derivePromotionStatus(examOutcome) -> 'promoted' | 'not-promoted' | 'pending'`.
- Missing/invalid answers are incorrect; malformed answer payloads cannot throw or yield a pass.

- [ ] Add failing tests for 0/5, 2/5, 3/5, 5/5, omitted answers, invalid option IDs, duplicate/extra answer keys, and defer/help outcome handling.
- [ ] Run the focused test and verify it fails on the missing pure functions.
- [ ] Implement scoring with no DOM, localStorage, hidden affinity, or history mutation.
- [ ] Run the focused test and verify boundary and malformed-input cases pass.

### Task 4: Build the warehouse learning and exam UI

**Files:**
- Modify: `index.html`
- Modify: `main20-runtime.js`
- Modify: `main20.css`
- Modify: `scripts/main20-learning-exam-test.mjs`

**Interfaces:**
- Runtime phases: `circle_learning`, `exam_prep`, `exam_questions`, `exam_result` (names may be adapted only if existing state conventions require; keep equivalent explicit resumable phases).
- Runtime state: `examOutcome`, `examCorrectCount`, `examAnswers`, `promotionStatus`; preserve existing `circleContact` as the canonical circle route field.
- UI IDs/data hooks: stable hooks for learning progress/continue, prep start, question/options, submit, result/continue, and browser tests.

- [ ] Add integration tests for all three circle choices, warehouse lesson entry only for attended routes, public preparation for every non-attendee, identical exam payload, and no philosophy/opinion prompt.
- [ ] Run the focused browser/test harness and verify it fails before runtime/UI integration.
- [ ] Render lesson beats as readable document-focused content with character reactions; use checked-in source records for claims and visibly distinguish fictional connective scene text.
- [ ] Let non-attendees open the public preparation sheet; ensure attendees get a recall/review route but can revisit the same material.
- [ ] Implement five-question selection, progress and selected states, keyboard/touch-accessible controls, submit validation, result copy, and continuation into the existing branch graph.
- [ ] Add versioned save/load migration for interrupted learning/exam phases; verify old saves retain route choices/evidence and restart clears exam state.
- [ ] Style desktop/mobile and reduced-motion layouts; retain scrolling without nested-scroll traps or controls under fixed bars.
- [ ] Run focused content, scoring, and browser tests; confirm pass/fail/defer/help paths each continue without dead ends.

### Task 5: Add deterministic fictional-life timeline model and content

**Files:**
- Create: `narrative/ACT_III_LIFE_SIMULATION.json`
- Create: `main20-life-simulation.js`
- Create: `scripts/main20-life-simulation-test.mjs`
- Modify: `package.json`

**Interfaces:**
- Template schema: `schemaVersion`, `periods[]`, each period containing stable episode IDs and predicates over known route state; every text payload is marked `fictional: true` unless linked as a separately sourced historical context note.
- `buildLifeTimeline(state, templates) -> Episode[]`; deterministic ordering and output for identical state.
- Each episode includes period label, title, concise narrative, state basis keys, fictional label, and optional `sourceIds[]` only for historical context.

- [ ] Add failing tests for 6–8 episodes per supported route state, deterministic output, varied exam/circle/promotion/work/relationship conditions, valid state predicates, and invariant historical outcomes.
- [ ] Run focused tests to confirm they fail before builder/data exist.
- [ ] Author the smallest coherent set of template branches that yields 6–8 distinct period beats over multiple years, including passed, failed, deferred, and helped-peer paths.
- [ ] Ensure no episode invents a real-person interaction or claims fictional clerk events as sourced history; historical context text must resolve to checked-in sources.
- [ ] Implement pure timeline construction and run tests for every outcome combination.

### Task 6: Integrate ending timeline, accessible playback, and save/replay

**Files:**
- Modify: `index.html`
- Modify: `main20-runtime.js`
- Modify: `main20.css`
- Modify: `scripts/main20-life-simulation-test.mjs`
- Create: `scripts/main20-learning-exam-browser.mjs`

**Interfaces:**
- Ending retains existing historical person comparison/biography, then adds a clearly separated fictional-life simulation.
- Playback state tracks visible episode index only; next/pause/replay are deterministic and do not alter route affinity.
- Browser hook exposes current rendered episode IDs/index and simulation completion to tests without exposing hidden ending mechanics to players.

- [ ] Add failing browser assertions that timeline follows historical comparison, each of the five ending IDs renders a timeline, no dialogue panel is active/visible, and replay does not change route state.
- [ ] Run browser test to establish failures before ending integration.
- [ ] Render timeline periods with restrained motion, explicit pause/next/replay, and a complete static sequence when reduced-motion is enabled.
- [ ] Ensure keyboard, touch, focus management, and mobile scrolling reach every episode/control; test long Korean content and fixed footer overlap.
- [ ] Verify pass/fail/defer/help timelines and all five ending IDs at desktop and mobile-like viewport sizes.

### Task 7: Exhaustive route, provenance, dialogue, and release verification

**Files:**
- Modify: `scripts/main20-learning-exam-test.mjs`
- Modify: `scripts/main20-life-simulation-test.mjs`
- Create: `scripts/main20-learning-exam-acceptance.mjs`
- Modify: `package.json`

**Interfaces:**
- Acceptance report includes route vector, circle route, exam outcome/score where applicable, promotion state, ending ID, timeline episode IDs, console/page errors, viewport, and source IDs used.
- Preserve existing `scripts/main20-branch-graph-test.mjs` guarantees and `npm run check` integration.

- [ ] Add exhaustive replay coverage for all 81 route vectors plus exam answer boundary cases and all four exam action/outcome families.
- [ ] Assert the five exact ending IDs remain unchanged and historical anchor payloads match byte-for-byte across route replays.
- [ ] Audit all new teaching/question/result/timeline claims against checked-in source IDs and exact provenance; audit character speech register and ensure dialogue rhythm/endings remain distinguishable.
- [ ] Run `npm run main20-learning-exam-test`, `npm run main20-life-simulation-test`, `npm run main20-learning-exam-acceptance`, existing branch graph tests, and `npm run check`.
- [ ] Run the app at desktop and mobile-like sizes; inspect screenshots and interaction progression, reduced-motion, save/load, restart, source drawer, H overlay, courier, typed response, and no-clipped-controls behavior.
- [ ] Fix all failures and rerun the full verification set; only then commit the explicitly changed implementation files and push to the user-approved destination after confirming its branch mapping and remote state.

## Self-review against the approved spec

- Source-grounded teaching, public prep parity, factual 5-question exam, 3/5 threshold, and answer-key provenance are covered by Tasks 1–4 and 7.
- Save/load/restart migration, route continuation, non-scoring deferral/helper paths, and five endings are covered by Tasks 4, 6, and 7.
- Historical comparison-first ending, multi-period deterministic fictional future, no-dialogue ending UI, replay, reduced motion, keyboard/touch, and mobile layout are covered by Tasks 5–7.
- Existing route graph, historical invariants, source drawer, H overlay, typed-response, courier, and legacy isolation are explicit in Global Constraints and Task 7 acceptance.
- Speech quality and provenance rules are audited in Task 7; dialogue changes remain limited to new learning-scene lines unless testing exposes a required correction.
- Potentially unsupported historical facts are blocked at Task 1; implementation must substitute verified facts rather than inventing them.
- The existing primary checkout contains extensive untracked user artifacts and is behind `origin/master` by two commits. Plan requires an isolated current-base worktree and explicit-path staging; no untracked artifacts are to be swept into commits.

## Execution record — active V33 integration (2026-10-29)

The approved design was integrated into the active `rpg/main.js` V33 campaign rather than the superseded MAIN20 runtime named in the original implementation outline. The data and state contracts above remain the same.

- Implemented the circle choice, public study path, four source-backed lessons, identical five-question exam, pass/fail/defer/help outcomes, version-1 save migration, and a deterministic seven-period fictional timeline after the historical ending comparison.
- Added V33-specific learning tests and connected them to `acceptance:v33`; all 9 focused tests pass.
- The reducer-backed route matrix passes all five ending IDs across 10 variants and records each learning outcome. `npm run v33-rpg-core-test`, `npm run v33-ai-test`, `npm run build:v33`, `npm run build`, `npm run lint`, `npm run check`, and `npm test` pass.
- Browser UI acceptance remains open: the available browser automation environment denied local app navigation (`ERR_NETWORK_ACCESS_DENIED`), so the new learning modal and timeline have not yet been visually checked at desktop/mobile sizes. Earlier V33 screenshots predate this addition.
