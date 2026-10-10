# V41 Life-Based Ending, Choice Copy, and Route Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MAIN20 endings compare the player's recorded actions with five verified Russian historical life directions, make all choice copy self-contained without hover, and prevent legacy navigation from stealing the MAIN20 route.

**Architecture:** Keep `narrative/MAIN_20MIN_DIALOGUE.json` as the sole MAIN20 manuscript and preserve the existing five-scene state machine. Add structured ending biography/provenance data and choice display fields to the manuscript, render those fields in `main20-runtime.js`, and establish explicit `body.main20-mode`/`runtimeOwner` guards around the legacy walk handlers. Add focused audits before changing production code, then a Playwright route/dead-end/ending audit at desktop and mobile widths.

**Tech Stack:** Plain JavaScript, JSON, CSS, Node.js, Playwright, existing npm audit scripts.

**Spec:** `C:\Users\owner\.codex\attachments\e4942607-202c-47b1-8ca5-4b504f5284f6\pasted-text-1.txt` (V41 requirement text); project `AGENTS.md`.

## Global Constraints

- Do not add a new game architecture, scene, character, or 3D system.
- `narrative/MAIN_20MIN_DIALOGUE.json` remains the only MAIN20 manuscript.
- Historical outcomes and source quotations remain immutable; only the fictional clerk's route varies.
- Main ending copy must not include meta-disclaimer prose; provenance belongs in a selectable supporting section.
- Desktop and mobile must expose the same choice meaning without hover or title-only information.
- Legacy handlers must immediately return while `body.main20-mode`/`runtimeOwner=main20` is active.

## Review Focus

- A saved legacy phase or first-click walk action must not open legacy E02 while MAIN20 owns the route; test fresh C03 and direct `#walkBtn` activation.
- Every rendered phase must expose a usable next action, including reading scroll gates and reduced-motion/header states; test an automated dead-end scan.
- Ending biography must be present for all five endings and must not insert future knowledge into 1837–1849 scene dialogue; test scene text and ending text separately.
- Choice meaning must be visible in the button and hint at 1440×900 and 390×844; test rendered text, not only JSON fields.
- Ending selection must preserve convergence/tie resolution and history evidence; test all five reachable route patterns and action explanations.

---

### Task 1: V41 RED audits and current-route reproduction

**Files:**
- Create: `scripts/v41-life-ending-choice-route-audit.mjs`
- Create: `docs/v41/CHOICE_COPY_AUDIT.tsv`
- Modify: `scripts/v40-browser-flow-audit.mjs` only if shared helpers are needed

**Interfaces:**
- Consumes: current `narrative/MAIN_20MIN_DIALOGUE.json`, `main20-runtime.js`, `app.js`, `gold-runtime.js`, and `index.html`.
- Produces: a failing audit that names missing life-ending fields, missing choice display fields, legacy ownership leaks, and dead-end phases.

- [ ] **Step 1: Write the failing audit**

  Assert five endings have `historicalPerson`, `lifeSummary`, `lifeSources`, `futureLife`, and a non-disclaimer main title; all 16 visible choices have `displayText`, `hint`, and `spokenText`; MAIN20 owns `#walkBtn`; and a browser route has no dead-end phase.

- [ ] **Step 2: Run the audit to verify RED**

  Run: `node scripts/v41-life-ending-choice-route-audit.mjs`

  Expected: FAIL against the current V40 schema/legacy handler, with failures printed before production edits.

- [ ] **Step 3: Record the existing choice copy**

  Generate `docs/v41/CHOICE_COPY_AUDIT.tsv` with the exact columns `sceneId`, `choiceId`, `oldVisible`, `oldHover`, `newDisplayText`, `newHint`, `spokenText`, `changedWhy`; old values must come from current `uiLabel`, `uiHint`, and `choice.text`.

- [ ] **Step 4: Commit the RED audit and copy inventory**

  Commit: `test: add V41 ending choice and route audit`.

---

### Task 2: Life-based ending data and provenance

**Files:**
- Modify: `narrative/MAIN_20MIN_DIALOGUE.json`
- Modify: source records under `data/` only if an existing checked-in source record is required by the five biographies

**Interfaces:**
- Consumes: Task 1 ending schema assertions and existing ending affinity/tie resolver data.
- Produces: five ending records with `historicalPerson`, `historicalTitle`, `historicalLifeSummary`, `historicalLifeSources`, `whyThisResult`, `futureLife`, and one-line `boundaryNote` for the optional supporting panel.

- [ ] **Step 1: Add verified life records first**

  Add source-grounded records for Sergei Uvarov, Vissarion Belinsky, Alexander Herzen, Alexei Khomyakov, and the young Dostoevsky/Petrashevsky circle. Include source URL, exact locator/edition or publication, and a concise claim-to-source purpose. Do not put future biography into scene intro, source discussion, or source excerpts.

- [ ] **Step 2: Add player-facing ending fields**

  For every ending, author 2–4 natural sentences connecting 2–4 selected actions, a 2–4 sentence verified historical-life summary, and a short fictional-clerk future-life paragraph. Main title must begin with the real person's name; `boundaryNote` is the only optional limitation note.

- [ ] **Step 3: Run the audit to verify GREEN for data**

  Run: `node scripts/v41-life-ending-choice-route-audit.mjs`

  Expected: data/provenance checks pass while choice/runtime/legacy checks remain the only failures.

- [ ] **Step 4: Commit the ending data**

  Commit: `feat: ground main20 endings in historical lives`.

---

### Task 3: Unified choice display copy

**Files:**
- Modify: `narrative/MAIN_20MIN_DIALOGUE.json`
- Modify: `main20-runtime.js`

**Interfaces:**
- Consumes: Task 1 TSV and Task 2 manuscript schema.
- Produces: `choice.displayText`, `choice.hint`, and `choice.spokenText`; the rendered card shows displayText + hint, while reaction dialogue uses spokenText. `title` is removed or equal to displayText.

- [ ] **Step 1: Extend the RED audit for rendered choice semantics**

  Assert every visible card's displayText is non-empty, understandable without hover, and its required audience/record/movement/risk direction is represented by visible text or hint.

- [ ] **Step 2: Run the focused audit to verify RED**

  Run: `node scripts/v41-life-ending-choice-route-audit.mjs`

  Expected: FAIL because current runtime still renders `uiLabel` and uses full `choice.text` as title/hover.

- [ ] **Step 3: Author all 16 choices**

  Replace generic labels with natural action sentences such as the specified C03 wording. Preserve old `text`, `uiLabel`, direction metadata, action, affinity, provenance, and reaction data for history/QA compatibility.

- [ ] **Step 4: Render unified fields**

  Update `choiceButton()` to use displayText and hint only, with no hidden required meaning in `title`; update `renderReaction()` to speak `spokenText || text` after selection.

- [ ] **Step 5: Run focused and existing checks**

  Run: `node scripts/v41-life-ending-choice-route-audit.mjs`, `npm run build`, `npm run lint`, `npm run test`, `npm run check`.

  Expected: choice checks and existing suite pass; route guard and ending renderer checks may remain RED until Task 4.

- [ ] **Step 6: Commit choice copy**

  Commit: `feat: unify visible main20 choice copy`.

---

### Task 4: MAIN20 runtime ownership and life-ending renderer

**Files:**
- Modify: `main20-runtime.js`
- Modify: `app.js`
- Modify: `gold-runtime.js`
- Modify: `index.html` only if the legacy walk control needs an explicit owner hook
- Modify: `styles.css` only for the ending biography/support panel

**Interfaces:**
- Consumes: Task 2 ending fields and Task 3 choice fields.
- Produces: `body.dataset.runtimeOwner = 'main20'` during MAIN20; legacy handlers return when owned; `#walkBtn` is hidden or delegated to the MAIN20 next-scene action; `renderEnding()` shows A/B/C/D sections with real-person-first title and optional support note.

- [ ] **Step 1: Add failing route-owner/dead-end tests**

  Extend the audit to click `#walkBtn` after C03 and assert no `#walkOverlay`, no legacy E02 content, unchanged MAIN20 state, and an actionable MAIN20 control in every phase.

- [ ] **Step 2: Run RED**

  Run: `node scripts/v41-life-ending-choice-route-audit.mjs`

  Expected: current MAIN20/legacy split demonstrates the early legacy route or missing owner guard.

- [ ] **Step 3: Implement owner guard and safe walk behavior**

  Set explicit ownership in MAIN20 bootstrap; hide or disable the legacy `#walkBtn` while owned; add early returns to legacy navigation/walk handlers; preserve legacy behavior outside MAIN20. MAIN20's own next-scene control remains the sole scene transition.

- [ ] **Step 4: Implement life-based ending renderer**

  Render title, connected selected-action explanation, verified historical life, and fictional clerk future-life. Put only `boundaryNote` in a small optional “이 결말의 근거” panel. Remove abstract-type titles and disclaimer sentences from the main body without altering history or ending resolver math.

- [ ] **Step 5: Run GREEN checks**

  Run: `node scripts/v41-life-ending-choice-route-audit.mjs`, `npm run build`, `npm run lint`, `npm run test`, `npm run check`.

  Expected: V41 audit and project checks pass with `MAIN20_DEAD_END_STATES = 0`.

- [ ] **Step 6: Commit runtime changes**

  Commit: `fix: isolate main20 navigation and render life endings`.

---

### Task 5: Full browser route and five-ending verification

**Files:**
- Create: `scripts/v41-browser-acceptance.mjs`
- Create: `artifacts/v41-browser/` outputs (untracked evidence only)

**Interfaces:**
- Consumes: Tasks 2–4 runtime/data contracts.
- Produces: screenshots and JSON report for 1440×900 and 390×844, five reachable endings, route order, no legacy overlay, no dead-end phase, and visible choice semantics.

- [ ] **Step 1: Write browser acceptance assertions**

  Assert fresh route order `C03 → C06 → C07 → E02 → E07 → ending`, every phase has a visible action or readable source, #walkBtn cannot open legacy overlay, every choice's visible text is self-contained, and each ending begins with one of the five real historical names and has life/future copy.

- [ ] **Step 2: Run RED before final integration**

  Run: `node scripts/v41-browser-acceptance.mjs`

  Expected: fail until Tasks 2–4 are complete.

- [ ] **Step 3: Run full acceptance at both viewports**

  Run: `node scripts/v41-browser-acceptance.mjs`

  Expected: PASS with screenshots for all five scenes, all choice cards, both desktop/mobile widths, route transition, and five endings.

- [ ] **Step 4: Run final verification**

  Run: `node scripts/v41-life-ending-choice-route-audit.mjs; npm run build; npm run lint; npm run test; npm run check; node scripts/v41-browser-acceptance.mjs`.

  Expected: all exit 0, `MAIN20_DEAD_END_STATES = 0`, P0/P1 = 0.

- [ ] **Step 5: Commit acceptance harness/evidence manifest**

  Commit: `test: add V41 browser acceptance coverage`.

- [ ] **Step 6: Final review and publish**

  Review the complete diff against this plan and the V41 spec. Push only after fresh verification and explicit user-authorized publish; report `V41_LIFE_ENDING_CHOICE_ROUTE_FIX_COMPLETE: YES` only when every gate passes.
