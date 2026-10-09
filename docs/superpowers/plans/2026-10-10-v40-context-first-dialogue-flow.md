# V40 Context-First Dialogue Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the five-scene MAIN20 route understandable to a first-time player by enforcing context → source reading → source discussion → concise decision → reaction, while preserving chronology, provenance, save/load, window behavior, and ending resolution.

**Architecture:** Keep `narrative/MAIN_20MIN_DIALOGUE.json` as the sole authored dialogue source and extend each scene with authoring/QA context and post-reading discussion data. Refactor `main20-runtime.js` with the smallest compatible phase-machine change: remove the pre-reading consequential choice, render a source-discussion phase after all required excerpts are read, then render one concise decision whose full protagonist line appears only after selection. Add a transient scene banner/masthead state in the existing DOM and CSS rather than introducing a new route system.

**Tech Stack:** Static HTML, CSS, browser ES modules, JSON narrative data, Playwright browser QA, existing Node audit scripts.

**Spec:** `C:\Users\owner\Downloads\CODEX_V40_CONTEXT_FIRST_DIALOGUE_FLOW_REPAIR.md`

## Global Constraints

- Preserve the chronology `C03 → C06 → C07 → E02 → E07`.
- Preserve verified RU/KO source text, source ranges, provenance, reader behavior, window behavior, save/load migration, actor/visibility/witness semantics, current endings, and 20-minute target.
- Do not add new historical cases, main characters, 3D systems, or route architecture.
- Keep `narrative/MAIN_20MIN_DIALOGUE.json` as the only authored main dialogue source; do not scatter authored lines into JavaScript.
- Consequential historical choices must not render before required excerpts are read and source discussion is shown.
- Visible choice cards contain only `uiLabel` and `uiHint`; existing detailed metadata remains in data for provenance/QA/accessibility.
- Reduced motion collapses the scene header immediately.

## Review Focus

- A fresh scene must not expose a consequential choice during `intro`; test that C03 first reaches `reading` after context dialogue.
- All required excerpts must be read before the discussion can advance to decision; test partial-read and full-read states.
- A selected choice must show the full authored protagonist line and then NPC reaction; test that the card itself does not contain the full line.
- Scene header must reappear for the next historical event and collapse after entry without shifting content unpredictably; test desktop, mobile, and reduced-motion CSS state.
- Legacy saves from V34/V35 must normalize without losing existing history or ending compatibility; run the existing save/reload and ending suites.

### Task 1: Capture the failing V40 flow and add data-shape tests

**Files:**
- Modify: `scripts/main20-final-route-smoke.mjs` or create `scripts/v40-context-flow-audit.mjs`
- Test: `scripts/v40-context-flow-audit.mjs`

**Interfaces:**
- Consumes: `narrative/MAIN_20MIN_DIALOGUE.json`, `window.__main20.getState()`, and rendered `#choiceArea`/`.main20-excerpt` DOM.
- Produces: machine-readable PASS/FAIL evidence for phase order, choice-card shape, C03 comprehension fields, and five-scene coverage.

- [ ] **Step 1: Write the failing audit** asserting that current C03 does not expose a consequential choice before reading, each scene has context/discussion authoring fields, and choice cards use `uiLabel`/`uiHint`.
- [ ] **Step 2: Run `node scripts/v40-context-flow-audit.mjs` and record the expected current failures.**
- [ ] **Step 3: Keep the audit independent of hidden metadata:** inspect visible text and scene data, not internal scores.

### Task 2: Extend the narrative source for context-first authoring

**Files:**
- Modify: `narrative/MAIN_20MIN_DIALOGUE.json`
- Test: `scripts/v40-context-flow-audit.mjs`

**Interfaces:**
- Consumes: existing scene `intro`, `excerpts`, `choices`, `postChoices`, source IDs, and reaction metadata.
- Produces: per-scene `context` fields (`whoIsThisAbout`, `whatJustHappened`, `whatDocumentsAreHere`, `whyTheDocumentsDiffer`, `whatThePlayerShouldNotice`), `sourceDiscussion`, concrete `decisionPrompt`, `transitionCard`, and each visible choice’s `uiLabel`/`uiHint` while preserving `text` as the full spoken line.

- [ ] **Step 1: Rewrite onboarding to one short prologue plus character-driven explanation without exposing mechanics as a lecture.**
- [ ] **Step 2: Rewrite C03 pre-reading dialogue so Pushkin, the two contemporary notices, their differing emphases, and the absence of later cause-investigation material are explicit before reading.
- [ ] **Step 3: Add post-reading C03 discussion and concrete prompt `두 부고를 모두 읽었습니다. 푸시킨의 죽음을 장부에 어떻게 남기시겠습니까?` (or an equally concrete authored variant).
- [ ] **Step 4: Add equivalent context and source-discussion lines for C06, C07, E02, and E07 using only verified source-grounded claims plus clearly fictional character speech.
- [ ] **Step 5: Add short Korean `uiLabel`/`uiHint` pairs for all five scenes and retain existing `text`, `audience`, `recordMode`, `leavesOffice`, and `risk` fields.
- [ ] **Step 6: Run the narrative/schema audits and the V40 audit; expected result is data-shape PASS, with runtime-phase failures still isolated to Task 3.

### Task 3: Refactor MAIN20 runtime phase order and choice rendering

**Files:**
- Modify: `main20-runtime.js`
- Test: `scripts/v40-context-flow-audit.mjs`, existing `scripts/main20-*` and `scripts/v28-*` suites

**Interfaces:**
- Consumes: Task 2 scene `context`, `transitionCard`, `sourceDiscussion`, `decisionPrompt`, and choice `uiLabel`/`uiHint`.
- Produces: compatible state phases `onboarding`, `intro`, `reading`, `source_discussion`, `decision`, `reaction`, `final_reaction`, and `ending`; legacy `choice`/`post_choice` saves normalize safely.

- [ ] **Step 1: Update `fresh()`/`normalize()` so new phase names are persisted while V34/V35 saves remain loadable.
- [ ] **Step 2: Change the final intro action to enter `reading`, never `choice`; keep any pre-reading action limited to navigation/curiosity.
- [ ] **Step 3: Add `renderSourceDiscussion()` that renders authored character discussion after all excerpts are marked read and before the decision prompt.
- [ ] **Step 4: Make `renderReading()` advance only to `source_discussion` when every required excerpt is read.
- [ ] **Step 5: Replace `renderChoice()` with the sole post-reading `renderDecision()` that shows the concrete prompt and only short `uiLabel`/`uiHint` cards.
- [ ] **Step 6: Make the click handler record choice effects only at decision time, then render the full `choice.text` in `renderReaction()` followed by the authored NPC reaction.
- [ ] **Step 7: Remove the old pre-reading reaction/post-choice double-decision path while preserving action history semantics and ending resolver inputs.
- [ ] **Step 8: Run the V40 audit and existing route/save/ending tests; expected result is the phase-order and card-shape PASS.

### Task 4: Implement transient scene header and stable layout

**Files:**
- Modify: `main20-runtime.js`
- Modify: `styles.css`
- Modify: `index.html` only if an accessible scene-banner region is required
- Test: `scripts/v40-context-flow-audit.mjs` and browser screenshots

**Interfaces:**
- Consumes: per-scene `transitionCard` data and scene index changes.
- Produces: a scene-entry banner showing place, date/year, person/event, and one change sentence; it collapses after 1.5–2.5 seconds or first click, reappears only for a new scene, and collapses instantly under reduced motion.

- [ ] **Step 1: Add explicit header state/classes and render the banner only when scene index changes or the route starts.
- [ ] **Step 2: Add CSS for animated translate/fade collapse, layout space reclamation, mobile sizing, and `prefers-reduced-motion: reduce` immediate collapse.
- [ ] **Step 3: Verify masthead visible/collapsed states do not alter reader, window, save/load, or choice layout behavior.

### Task 5: Add first-time-player comprehension and browser evidence

**Files:**
- Create or modify: `scripts/v40-first-time-comprehension.mjs`
- Create or modify: `scripts/v40-browser-evidence.mjs`
- Create: `docs/v40/` evidence and review reports

**Interfaces:**
- Consumes: V40 runtime and narrative source, four required viewports, and visible DOM/screenshot state.
- Produces: C03 comprehension PASS/FAIL, phase-order evidence, screenshots for transition/context/reader/discussion/decision/reaction/next scene/header states, and explicit `INDEPENDENT_REVIEW=UNAVAILABLE` if no reviewer is available.

- [ ] **Step 1: Add a first-time C03 gate that checks visible content can answer the six required questions before decision without reading internal metadata.
- [ ] **Step 2: Add browser evidence at 1440×900, 1366×768, 390×844, and 360×800 for all nine required visual states.
- [ ] **Step 3: Run the existing reader/window/save/history/ending/provenance/actor/visibility regressions plus `npm run check`, `npm run lint`, and `npm run test`.
- [ ] **Step 4: Inspect screenshots for P0/P1 issues, fix any discovered issue, and regenerate the affected evidence.

### Task 6: Final verification and deployment

**Files:**
- Modify: `docs/v40/` final report and manifests
- Modify: `package.json` only if new V40 scripts need npm aliases

- [ ] **Step 1: Run the complete V40 audit and all required regressions from a clean production build.
- [ ] **Step 2: Verify the deployed GitHub Pages URL after the Pages workflow completes, including data responses, 3D initialization, and stable width at all four viewports.
- [ ] **Step 3: Commit with a focused V40 message and push `master` only after fresh verification.
- [ ] **Step 4: Report `V40_CONTEXT_FLOW_COMPLETE: YES` only when every completion criterion is evidenced; otherwise report the exact remaining gap.
