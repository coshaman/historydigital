# Act III Branching Scene Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the fixed active route order with four persistent three-way decisions and 81 fully traversable, materially choice-shaped story combinations.

**Architecture:** Store graph/content in `narrative/ACT_III_BRANCH_ROUTE.json`; add a pure graph helper to validate schema, evaluate predicates, resolve edges, and enumerate vectors; integrate into MAIN20 state/render/save migration while leaving archive graphs isolated.

**Tech Stack:** Browser JavaScript, JSON, Node.js, existing Playwright dependency.

**Spec:** `docs/superpowers/specs/2026-10-12-main-route-branching-and-unified-reading-design.md`

## Global Constraints

- Four pivotal hubs each expose exactly three consequential options; all 81 vectors reach a valid ending.
- Historical outcomes/dates are immutable; only fictional clerk action, exposure, record, relationship, and private route vary.
- New source claims use `narrative/ACT_III_BRANCHING_SOURCES.json`; invented bridge history is forbidden.
- Preserve five ending IDs, source drawer, H-key overlay, typed-response, restart, save/load, courier, reduced-motion, and legacy isolation.

## Review Focus

- Lost prior choice at shared anchor; replay checks all four choices through transitions/reload.
- Stuck gates; exhaustive vectors require legal fallbacks.
- Old save migration retains history/evidence.
- Historical anchors are invariant across vectors.
- Each option has a distinct immediate event and later reaction/callback.

### Task 1: Define route schema and failing graph tests

**Files:** Create `narrative/ACT_III_BRANCH_ROUTE.json`, `scripts/main20-branch-graph-test.mjs`; modify `package.json`.

Schema: `schemaVersion`, `hubs[]`, `branches[]`, `events[]`, `anchors[]`, `transitions[]`, `eventPredicates`, `endingRoutes`. Branch: `choiceId`, `hubId`, `immediateEventId`, `nextHubReactionId`, `callbackKey`, `sourceIds[]`, `immediateDirection`, `stateWrites`.

- [ ] Test four hubs, exactly three options/hub, duplicate IDs, missing edge target/source, direction, and immediate event.
- [ ] Add smallest schema-valid fixture; run tests to confirm expected failures.
- [ ] Commit tests and package script before content.

### Task 2: Implement pure graph validation, routing, vector enumeration

**Files:** Create `main20-branch-graph.js`; modify graph tests.

- [ ] Export `validateBranchGraph(graph, sources)`, `enumerateRouteVectors(graph)`, `resolveBranchEvent(graph, hubId, choiceId, routeState)`, and `resolveNextHub(graph, hubId, nextState)`.
- [ ] Test deterministic transitions, predicate precedence/fallback, immutable history, and 81 distinct vectors.
- [ ] Implement DOM/storage-independent helper and pass tests; commit.

### Task 3: Author hubs, branches, callbacks, event-only scenes

**Files:** Modify route JSON; create `narrative/ACT_III_BRANCH_DIALOGUE_REVIEW.md`; modify graph tests.

- [ ] Test all event families, citations, speech-register fields, and no false historical membership claims.
- [ ] Author context-rich Korean for reading circle, rank/history exam, Russian novel discussion, ordinary life, and plausible 1848 news response.
- [ ] Apply speech-register matrix; log literary borrowing provenance separately.
- [ ] Run static checks/enumeration; revise equivalent or unnatural content; commit.

### Task 4: Integrate graph with MAIN20 runtime and save migration

**Files:** Modify `index.html`, `main20-runtime.js`, `narrative/MAIN_20MIN_DIALOGUE.json`, graph tests.

- [ ] Test old-save migration, branch event rendering, read prerequisite, callback, restart, save/load.
- [ ] Load graph/source data and integrate conditional event rendering without losing continuation.
- [ ] Preserve old save key/history and isolate legacy ending routes.
- [ ] Run graph/browser tests; commit.

### Task 5: Exhaustive narrative and ending route acceptance

**Files:** Create `scripts/main20-81-route-acceptance.mjs`; modify package and graph tests.

- [ ] Assert each vector has four acknowledged choices, valid source gates, branch events, and one of five endings.
- [ ] Replay 81 vectors, five endings, pairwise cross-hub interactions and all branch-specific event families.
- [ ] Run `npm run main20-81-routes`, `npm run test`, `npm run check`, and five-ending audits; commit evidence.
