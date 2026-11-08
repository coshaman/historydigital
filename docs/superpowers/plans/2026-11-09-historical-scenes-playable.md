# Historical Scenes Playable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Senate Square, Gogol premiere, and Emancipation scenes into 4–5 minute walkable event episodes with multi-person objectives, possession, branching actions, persistent player records, and context-aware everyday dialogue.

**Architecture:** Keep fixed historical outcomes and source provenance in the catalog. Add a reusable event-action layer to historical sessions: physical props start authored multi-step tasks, choices mutate session state, and actor conversations unlock or advance tasks. Feed relevant current-world incidents and character knowledge into AI scene context so ordinary questions produce concrete, character-appropriate replies instead of repeating obsolete meta motifs.

**Tech Stack:** Existing Vite/browser game, JavaScript ES modules, JSON event authoring, Node assertion scripts, Playwright browser acceptance.

**Spec:** `CODEX_V37_HISTORICAL_LIVING_WORLD_GOAL.md`, Sections 1, 3, 4, and 7; user request 2026-11-09.

## Global Constraints

- Verified historical outcomes remain fixed; only fictional residents' actions, knowledge, and personal consequences vary.
- Source-backed claims retain exact provenance; fictional scene dialogue is not presented as a historical quotation.
- No new narration about reconstruction or game design; only playable dialogue and concise necessary guidance.
- No generated scene may turn Ivan Semyonov or another character into a mouthpiece for obsolete mechanics such as mixed witness reports unless that is the actual current scene.
- Existing game loop, maps, saving, and Vercel-only API remain in use.

## Review Focus

- A task cannot complete from an empty help button; it needs an authored scene action and resulting world-state change.
- Event-specific physical actions must be reachable by walking and interacting, with keyboard and touch layouts remaining usable.
- The player must be able to possess event residents while preserving the return state and the fixed historical outcome.
- An unsourced invented incident must remain an in-world fictional lead and must not be presented as attested history.
- AI dialogue must incorporate the player question, current local context, actor knowledge/voice, and follow-up records without prompt/meta leakage.

---

### Task 1: Historical action session model

**Files:**
- Modify: `rpg/engine/historical-session.mjs`
- Modify: `rpg/data/historical-scene-play.json`
- Test: `scripts/v38-history-events-test.mjs`

**Interfaces:**
- Produce `performHistoricalAction(session, scene, actionId, choiceId) -> { ok, reason?, state, action? }`.
- Scene `fieldActions` define an id, map, prop name/position, linked objective, prompt, and two or more authored options with choice text, effects, and next-step/complete state.

- [x] Add tests requiring every scene to have six reachable physical actions across its three maps, branching options with explicit consequences, variable dialogue registers, and fixed historical-outcome metadata.
- [x] Run the catalog test and confirm the missing-action baseline is covered.
- [x] Implement action validation, choice recording, objective progress, local flags/effects, and replay-safe duplicate handling.
- [x] Run the catalog test and action-state test; verify unknown actions/choices do not mutate session state.

### Task 2: Put event actions into the walkable scene

**Files:**
- Modify: `rpg/main.js`
- Modify: `rpg/engine/historical-session.mjs`
- Test: `scripts/v38-history-events-test.mjs`
- Test: new `scripts/v38-historical-actions-browser.mjs`

**Interfaces:**
- Generate visible, interactable objects from `fieldActions` in the existing map `Interactions` layer.
- Player inspects a prop and gets its authored action choices; choosing one updates the active session, event journal, and visible NPC/prop state.
- Objective progress comes only from completing actions or authored actor-specific task steps; generic `help` no longer auto-completes an objective.

- [x] Add assertions for real prop objects, stable map positions, walkable tiles, and specific NPC/prop changes after each choice.
- [x] Run tests and confirm the old generic conversation path cannot complete a task.
- [x] Render and dispatch prop interaction choices; add event-specific NPC movement/reactions and journal progress.
- [x] Make character-list possession preserve the scene return state and unlock event-only cast members on each map.
- [x] Run desktop and mobile browser scenario: enter, walk all three areas, speak with eight residents, complete five tasks, branch, exit, and verify a player record.

### Task 3: Expand historical episodes and choices

**Files:**
- Modify: `rpg/data/historical-scene-play.json`
- Modify: `rpg/data/v38-historical-events.json` only when source metadata needs correction
- Test: `scripts/v38-history-events-test.mjs`
- Test: `scripts/v38-historical-actions-browser.mjs`

- [x] Author event-specific action chains for crowd safety and order-confusion at Senate Square; backstage, audience, and street coordination at the Inspector premiere; and work/housing, land, and distribution after emancipation.
- [x] Give each episode six action beats, ten cast residents, a three-area route, multiple executable objectives, and three consequential closing strategies.
- [x] Ensure decisions affect only local movement, access, relationships, information spread, and fictional residents' aftermath; fixed historic outcomes remain unchanged.
- [x] Verify each event's start, action chain, close, and aftermath against its source-linked fixed outcome.

### Task 4: Ground open-ended character conversation in current incidents

**Files:**
- Modify: `rpg/engine/dialogue-context.mjs`
- Modify: AI dialogue route/schema as identified in repository
- Modify: Ivan Semyonov story/quest data and event ledger integration
- Test: targeted dialogue-context and API tests
- Test: AI dialogue browser smoke

- [x] Add tests that an open question such as “요즘 흥미로운 사건이 있소?” receives current, actor-known E36 context.
- [x] Re-author Ivan's active street-patrol and market-loss quest text with the existing event's source IDs while keeping quest IDs and save links stable.
- [x] Update dialogue instructions to answer the question first, use only actor-known incidents, and avoid the obsolete report-and-witness motif.
- [x] Run targeted engine/API tests and assert the stale premise no longer appears in Ivan's playable quest.

### Task 5: Full verification and delivery evidence

**Files:**
- Modify: `docs/v37/BASELINE.md`
- Create/update: `artifacts/v38/...`

- [x] Run `npm run check`, event-specific tests, and event browser tests at desktop and mobile-like widths.
- [x] Inspect screenshots for event prop visibility, readable choices, NPC presence, no viewport overflow, and usable touch controls.
- [x] Package verified event evidence and report remaining unrelated V37 goal gates honestly in `artifacts/v38/HISTORICAL_LIVING_SCENES/ACCEPTANCE.json`.
