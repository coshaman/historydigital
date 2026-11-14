# Historical Scenario Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Historical Locations selection clearly begin/continue a story and expose MAIN01's actual interactive content and immediate objective.

**Architecture:** Extend the existing story-entry metadata and resolver-backed menu labels. Update `rpg/main.js` selection feedback to show the current task/readiness and offer existing roster/journal navigation. Add focused assertions for entry state and MAIN01 content metadata.

**Tech Stack:** Vanilla JavaScript ES modules, Node test runner, existing browser game UI.

**Spec:** `docs/superpowers/specs/2026-11-14-history-scenario-entry-design.md`

## Global Constraints
- Preserve historical chronology and source date gating.
- Do not change historical outcomes, save schema, or ending mechanics.
- Stage only intended source/test/docs files; worktree contains unrelated generated artifacts.

## Review Focus
- A story waiting for earlier campaign tasks must name that exact task.
- A story waiting for its historical date must not be represented as immediately playable.
- Ready and complete stories must have clear menu labels.
- MAIN01 purchase description must match an actual available purchase interaction.

---

### Task 1: Scenario menu readiness and MAIN01 activity metadata

**Files:**
- Modify: `rpg/engine/v47-story-entry.mjs`
- Test: `scripts/v47-story-entry.test.mjs`

- [ ] Add data for the verified MAIN01 interaction categories and test the categories plus status-aware menu metadata.
- [ ] Implement a menu-entry resolver using current state, story quest, campaign, and date without changing chronology gates.
- [ ] Run `node --test scripts/v47-story-entry.test.mjs` and confirm readiness cases pass.

### Task 2: Actionable selection feedback

**Files:**
- Modify: `rpg/main.js`

- [ ] Show readiness/next task and MAIN01 activity summary when opening Historical Locations.
- [ ] After selection, provide roster and journal actions while preserving the active story focus.
- [ ] Keep first objective text synchronized with mission guidance.

### Task 3: Verification

- [ ] Run focused story-entry, pursuit, timeline, and printwork tests.
- [ ] Run `npm run build:v33` and `npm run lint`.
- [ ] Browser-check menu selection at desktop and mobile widths; verify MAIN01 progress starts with an actionable task and the purchase option opens at the city stall.
