# Branching Life Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each of the 81 four-choice histories in Act III play as a distinct, source-grounded route with an authored scene after every decision.

**Architecture:** Keep the four existing hubs and the current runtime/save architecture. Add an exhaustive prefix-to-event-node story tree (3+9+27+81 nodes), validate every legal and illegal prefix in the graph module, then render and persist each resolved event through the current runtime. Historical anchors and five existing endings remain invariant.

**Tech Stack:** Existing JavaScript runtime, JSON narrative data, Node.js `node:test` scripts, existing browser acceptance harness.

**Spec:** `docs/superpowers/specs/2026-10-13-branching-life-route-design.md`

## Global Constraints

- Keep exactly four primary hubs, each with exactly three consequential options.
- Resolve one authored event node for each of the 120 valid choice prefixes; complete routes must not share an identical four-node signature.
- Every choice discloses immediate action, audience, record/visibility, document movement, and broad immediate risk.
- Preserve verified chronology, historical outcomes, source provenance, and the five existing endings.
- Reject malformed, duplicated, out-of-order, unknown, unreachable, or source-invalid route data; do not silently fall back to generic dialogue.
- Preserve natural, differentiated Korean character voices; do not misattribute fictional dialogue as historical testimony.
- Add no dependency and do not replace the save architecture.

## Review Focus

- Malformed or stale saves: add resolver/load tests for invalid prefixes and deterministic restart.
- Long Korean dialogue and narrow viewports: add browser assertions that event dialogue and next action remain reachable at desktop/mobile-like sizes.
- Prefix/state drift after save-load: assert identical node sequence and choices before and after serialization.
- Historical anchors/endings accidentally detached: enumerate all 81 routes and prove E07 plus all five endings stay reachable.
- Missing node provenance or generic fallback hiding gaps: validate node sources and assert missing prefix lookup is a hard error.

---

### Task 1: Lock the full-prefix resolver contract

**Files:**
- Modify: `scripts/main20-branch-graph-test.mjs`
- Modify: `main20-branch-graph.js`

**Interfaces:**
- Produce `resolvePrefixEventNode(graph, prefix)` returning the unique event node matching the exact ordered prefix; throw a descriptive error if no unique match exists. Preserve the existing `resolveBranchEvent(graph, hubId, choiceId, routeState)` API used by current runtime callers.
- The node schema is `id`, `hubId`, `requiredPrefix` (ordered choice IDs), `date`, `location`, `dialogue` (speaker-tagged Korean lines), `sourceIds`, `visibleCallbacks`, `immediateNextAction`.

- [ ] Add failing tests for exact-prefix matching, ambiguous mappings, absent prefix errors, and out-of-order choice rejection.
- [ ] Run `node --test scripts/main20-branch-graph-test.mjs` and verify each new assertion fails for the intended missing resolver behavior.
- [ ] Implement the resolver and its validation errors in `main20-branch-graph.js` without fallback behavior.
- [ ] Re-run the graph test file and confirm all new resolver tests pass.
- [ ] Commit as `feat: resolve branch events by full choice prefix`.

### Task 2: Define and validate exhaustive route-node data

**Files:**
- Modify: `narrative/ACT_III_BRANCH_ROUTE.json`
- Modify: `main20-branch-graph.js`
- Test: `scripts/main20-branch-graph-test.mjs`

**Interfaces:**
- Consume `resolveBranchEvent(route, prefix)` from Task 1.
- Produce 120 event nodes across prefix depths 1–4, each carrying its exact prefix and source IDs.

- [ ] Add failing coverage tests requiring prefix counts of 3, 9, 27, and 81; every choice edge must have exactly one branch-only node.
- [ ] Add failing checks for duplicate IDs/prefixes, invalid source IDs, invalid predecessor/hub association, unreachable nodes, and missing choice disclosures.
- [ ] Run graph tests and confirm the incomplete data fails on the expected coverage assertions.
- [ ] Author the event-node tree in the route JSON, grounded only in existing checked-in source records and the immutable chronology.
- [ ] Implement exhaustive coverage, reachability, prefix ordering, source, chronology, and disclosure validation.
- [ ] Run graph tests and confirm all 120 prefixes validate and malformed fixtures fail explicitly.
- [ ] Commit as `feat: author exhaustive act iii route nodes`.

### Task 3: Persist and present route-specific playable events

**Files:**
- Modify: `main20-runtime.js`
- Modify: `scripts/main20-branch-graph-test.mjs`
- Test: `scripts/v42-browser-acceptance.mjs`

**Interfaces:**
- Consume the validated node returned by `resolveBranchEvent`.
- Runtime state stores ordered `routePrefix`, `resolvedEventIds`, and current event index; save/load preserves those values exactly.

- [ ] Add failing runtime tests for recording a selected choice, displaying its event, advancing to the next hub, and resuming the same event after save-load.
- [ ] Add failing restart tests proving route prefix/event history clears without changing invariant historical progress.
- [ ] Run focused runtime tests and verify the expected missing state transitions fail.
- [ ] Implement state transitions and event rendering in `main20-runtime.js`; keep each event’s immediate next action explicit and keyboard/pointer reachable.
- [ ] Re-run focused tests and verify selected choices resolve to their own event before the next hub is available.
- [ ] Commit as `feat: play and persist branch event scenes`.

### Task 4: Prove all 81 routes and five endings

**Files:**
- Modify: `scripts/main20-branch-graph-test.mjs`
- Modify: `scripts/v42-browser-acceptance.mjs`

**Interfaces:**
- Consume validated graph, runtime state transitions, and existing ending resolver.

- [ ] Add an exhaustive test enumerating all 81 choice vectors and assert four distinct prefix-specific node IDs per vector, 81 unique route signatures, source coverage, E07 reachability, and reachability of each of the five endings.
- [ ] Run the exhaustive test and verify it catches a deliberately shared/missing prefix node in a test fixture.
- [ ] Add browser replay coverage for each of the three options at each depth, including visible branch-only content, actionable continuation, save/load, restart, and desktop/mobile-like dimensions.
- [ ] Run `npm run check`, `npm run build`, `npm run lint`, and `node --test scripts/main20-branch-graph-test.mjs`; require clean success.
- [ ] Run the browser acceptance command defined by `package.json` at desktop and mobile-like widths and inspect screenshots for clipped event text or inaccessible controls.
- [ ] Commit as `test: verify all act iii routes and endings`.

### Task 5: Whole-branch review and handoff

**Files:**
- Review all files changed by Tasks 1–4.

- [ ] Run `git diff --check` and inspect the complete diff for unrelated edits and accidental historical-outcome changes.
- [ ] Audit every authored dialogue line for distinct register/rhythm, source boundary, and no false historical attribution.
- [ ] Re-run all commands from Task 4 against the final tree and retain their outputs.
- [ ] Request an independent whole-branch review; resolve any correctness, provenance, route coverage, or UI accessibility findings before completion.

## Coverage Self-Review

- The 120-prefix coverage, unique full-route signatures, per-choice event exclusivity, and five endings are covered by Tasks 2 and 4.
- Runtime persistence, restart, exact prefix resolution, and no fallback behavior are covered by Tasks 1 and 3.
- Historical invariants, node provenance, chronology, and disclosures are covered by Task 2 validators and Task 5 audit.
- Dialogue differentiation and browser reachability/clipping are covered by Tasks 3–5.
- The separate 30+ primary-source expansion and paper/choice/window UI redesign remain follow-on subprojects as stated by the spec; their own specifications/plans must be completed before implementation.
