# V44 Philosophy-First Final Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the required MAIN20 route as a philosophy-first historical experience while preserving the stable runtime, reader, window, save/load, provenance and five-ending resolver.

**Architecture:** Keep `main20-runtime.js` as the route owner and retain removed Pushkin/Lermontov/E02 material in an archive collection. Extend the existing authoring JSON with route-order metadata, explicit choice kinds, separate belief/action state, source-backed ideology beats, and a staged ending model. Add V44 static and browser audits instead of introducing a new engine.

**Tech Stack:** Vanilla JavaScript, JSON narrative data, existing HTML/CSS, Node audit scripts, Playwright browser acceptance.

**Spec:** `CODEX_V44_PHILOSOPHY_FIRST_FINAL_ROUTE.md` as supplied in the task.

## Global Constraints

- Required route order is PROLOGUE → Uvarov → Chaadaev → Slavophile/Westernizer → Gogol/Belinsky → Petrashevsky/censorship → ending.
- Pushkin obituary and Lermontov duel investigation are archive/optional material, not required MAIN20 scenes.
- Opinion choices never automatically send, publish or file a document.
- Belief and action state remain separate; numeric affinity is never rendered.
- Every core source has original Russian, readable Korean, contiguous context, author, date, edition/archive, locator, classification and player-availability date.
- Five historical-person endings remain reachable and require beliefs from three Acts plus action and consequence evidence.
- Desktop 1440×900 and mobile 390×844 must pass without horizontal drift or legacy early entry.

## Tasks

### Task 1: V44 RED audits

- [ ] Add route, source, choice-kind, ending-stage and archive assertions.
- [ ] Run them against V43 and confirm expected failures for C03/C06 route removal, staged ending and belief/action state.

### Task 2: Route authoring and archive separation

- [ ] Move C03, C06 and E02 out of `scenes` into `archiveScenes` while preserving their verified records.
- [ ] Add the ACT 3 Slavophile/Westernizer beat and direct censorship questions for E07.
- [ ] Add V44 route order, source metadata and comprehension prompts.

### Task 3: Choice semantics and belief/action state

- [ ] Add explicit choice-kind lookup to runtime history.
- [ ] Store `beliefs` separately from concrete `actions` and migrate old saves safely.
- [ ] Make headers and choice prompts reflect OPINION, INTERPRETATION, EVIDENCE_REQUEST or ACTION.
- [ ] Add visible callbacks for censorship stance, evidence-seeking and official-order stance.

### Task 4: Dynamic ending sequence

- [ ] Replace the static ending presentation with staged desk fade, belief reveal, portrait reveal, historical life, player future and actions.
- [ ] Add reduced-motion immediate mode and controls for replay, sources and selected beliefs.

### Task 5: V44 evidence and full verification

- [ ] Generate `docs/v44/PHILOSOPHICAL_CHOICE_AUDIT.tsv` and `docs/v44/PRUNED_FROM_MAIN_ROUTE.md`.
- [ ] Run V44, V43, V42, V41, static, route, source and browser audits.
- [ ] Commit only V44-related files.
