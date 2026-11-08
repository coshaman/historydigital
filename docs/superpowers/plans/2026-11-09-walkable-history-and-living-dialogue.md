# Walkable History and Living Dialogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three text-only history events with walkable, sourced, multi-stage game scenes, and let dialogue turn accepted incident hooks into persistent playable quests.

**Architecture:** Run historical scenes in a disposable scenario state using existing map movement, NPC proximity, possession, renderer, and interaction code. Keep generated local incident hooks in campaign save data only after strict validation, with source-backed historical context and clear fictional status kept internal.

**Tech Stack:** Existing Vite/vanilla JS app, `rpg/engine/game-state.js`, JSON event/map data, Vercel Functions in `ai/v33/session-runtime.cjs`, Playwright browser scripts.

**Spec:** `docs/superpowers/specs/2026-11-09-walkable-history-and-living-dialogue.md`

## Global Constraints

- Preserve fixed historical outcomes and source-verified claims.
- Keep the campaign snapshot intact while a historical scene runs.
- Do not present fictional composite dialogue or generated incidents as historical testimony.
- Keep game copy free of internal prompt, reconstruction, and validation explanations.
- No new runtime dependency unless the existing stack cannot implement the requirement.

## Review Focus

- Scene entry/exit, browser reload, and save load preserve campaign state byte-for-byte; cover in isolated-session tests.
- 1825/1836/1861 Julian and Gregorian dates remain correct; cover in catalog validation.
- NPCs cannot be conversed with across walls, zones, or outside their active stage; cover in world interaction tests.
- AI hooks cannot invent historical claims, unauthorized people, maps, or actions; cover malformed and injection responses in API tests.
- Mobile layouts remain playable and event objectives remain visible; cover 390×844 browser acceptance.

---

### Task 1: Scene session and navigation foundation

**Files:**
- Create: `rpg/engine/historical-session.mjs`
- Modify: `rpg/main.js`, `rpg/engine/game-state.js`
- Test: `scripts/v38-historical-session-test.mjs`

**Interfaces:**
- `beginHistoricalSession(state, event, maps, cards)` returns `{ ok, session, returnState }` with an isolated scene state and an untouched return snapshot.
- `exitHistoricalSession(session)` returns the saved campaign state.

- [ ] Write tests for isolated entry, movement, map transition, possession, and byte-equivalent return.
- [ ] Run `node scripts/v38-historical-session-test.mjs`; confirm the new interface fails before implementation.
- [ ] Add session state, scene entry/exit controls, and renderer-facing scene metadata while keeping regular save untouched.
- [ ] Re-run session tests and verify main campaign load/save parity.

### Task 2: Three sourced walkable scene maps and event stages

**Files:**
- Create: `rpg/maps/senate-square-1825.json`, `rpg/maps/alexandrinsky-1836.json`, `rpg/maps/emancipation-square-1861.json`
- Create: `rpg/data/historical-scene-play.json`
- Modify: `rpg/data/v38-historical-events.json`, `rpg/data/historical-source-packets.json`, `rpg/data/source-reader-index.json`, `rpg/main.js`
- Test: `scripts/v38-historical-scenes-test.mjs`

**Interfaces:**
- Event stage schema: `areas[]`, `actors[]`, `interactions[]`, `objectives[]`, `branches[]`, `sourceIds[]`, `fixedOutcome`.
- Each actor has era, role, presence zone, path, interaction options, possession permission, and voice profile.

- [ ] Add catalog tests for correct calendar dates, 3+ areas, 8+ actors, reachable interaction points, 3+ side objectives, multi-person joins, 2+ possessable composites, and source IDs.
- [ ] Add event-specific source records and contiguous source ranges from the identified primary catalogs.
- [ ] Build three map layouts from existing tile assets and ensure every objective has a traversable route.
- [ ] Correct emancipation machine date to `1861-03-03` while retaining Julian display date.
- [ ] Implement stage progression and physical interactions; keep fixed event outcomes immutable.
- [ ] Run historical scene tests and lint.

### Task 3: Character voice and date-aware events for Ivan

**Files:**
- Modify: `rpg/characters/police_sergeant_ivan.json`, `ai/v33/session-runtime.cjs`, `rpg/engine/dialogue-context.mjs`
- Test: `scripts/v38-living-dialogue-test.mjs`, `scripts/v33-ai-runtime.test.mjs`

**Interfaces:**
- Safe dialogue context gains date-eligible `publicEventLeads[]` with `claimId`, speaker access, and source IDs.
- System rules treat `caseContext` as optional support and answer the latest player turn before current quest prompts.

- [ ] Add a failing regression test using the reported open question and assert no default to report/witness boilerplate.
- [ ] Replace Ivan's single-topic motive/voice cues with several concrete interests and varied natural sample lines.
- [ ] Add source/date/character-scoped event leads and a grounded clarification fallback.
- [ ] Prove unauthorized dates, facts, and player-private event records never enter the profile or output.

### Task 4: Validated event-hook generation and persistence

**Files:**
- Modify: `ai/v33/session-runtime.cjs`, `rpg/engine/game-state.js`, `rpg/main.js`, save migration code
- Test: `scripts/v38-living-event-hook-test.mjs`, API tests in `scripts/v33-ai-runtime.test.mjs`

**Interfaces:**
- Optional response `eventHook`: `{ titleKo, situationKo, locationId, participantIds[], objectiveKo, actions[], sourceIds[], provenance }`.
- `validateLivingEventHook(input, { date, mapIds, hostIds, allowedSources })` accepts only bounded schema, known IDs, reachable locations, and permitted provenance.
- Accepted hooks enter `state.world.livingEventHooks`; rejected hooks produce no save mutation.

- [ ] Test accepted fictional hooks, authorized source-backed hooks, malformed output, prompt injection, stale dates, unknown NPC/map/action/source, and save/load.
- [ ] Add strict server validation and a bounded prompt rule that the model proposes only one hook when the player asks for news or an actionable lead emerges.
- [ ] Add player-facing accept/ignore choices; only accepted hooks become physical in-world objectives.
- [ ] Persist outcomes and include at most three unresolved/recent hooks in future scene context.

### Task 5: Multi-minute browser playthrough and production verification

**Files:**
- Create: `scripts/v38-historical-events-browser.mjs`
- Modify: `package.json`, `docs/v37/BASELINE.md`, QA reports.

- [ ] Browser-test each event at 1440×900 and 390×844 by walking through at least three areas, talking to four characters, possessing two composite actors, completing two optional leads, making a closing choice, and exiting.
- [ ] Confirm source access, saved event memory, immutable history, campaign state return, no page errors, and no horizontal overflow.
- [ ] Run `npm run check` and the production build.
- [ ] Review and commit only the implementation and evidence paths.
