# V33 Possession RPG Implementation Plan

> **For agentic workers:** execute this plan in order; keep the goal active through all seven phases. Do not widen content until the two-map movement/interaction gate passes.

**Goal:** Turn Russian Lives into a source-grounded 1847–1849 Petersburg pixel RPG where possession changes the playable person's actual knowledge, constraints and quest actions.

**Architecture:** Keep the existing archive/Chancery intact at `chancery.html` and make the RPG the default only after Phase 1 passes. Use a browser-native Canvas2D/Tiled JSON runtime with PNG atlases; deterministic reducers own map, host, quest, save and ending state. Adapt V32's strict Responses API, memory, Worker and fallback behind server-owned RPG sessions.

**Tech Stack:** Existing vanilla JavaScript/Node server, Canvas2D, Tiled JSON, generated/custom PNG atlases, Cloudflare Worker + Durable Objects, existing Node test/Playwright setup.

**Spec:** `C:/Users/owner/Downloads/CODEX_V33_POSSESSION_RPG_AI_HISTORY_GOAL.md`; design: `docs/v33/DESIGN.md`.

## Global Constraints

- Active history is 1847–1849; fixed historical outcomes do not change.
- First slice: Nevsky street + printshop, four distinct fictional playable hosts; then four maps, at least four social strata, one historical reconstruction and one literary host.
- No generic CSS maps or medieval fantasy tiles; tilemaps and people must render from actual PNG files.
- WorldState, PlayerState and every HostState remain separate; secrets and facts never jump hosts without a witnessed event.
- Only deterministic verified player actions mutate money, access, quests, relations, history or endings.
- Strict Responses schema, Worker secrets, offline completion; no claim of live AI without a live request.
- Existing source records, V32 modules and the five exact ending IDs are preserved.
- The V33 Quality Contract is binding; test desktop 1440×900 and mobile 390×844 at minimum, then all four required viewports.
- One independent critic by default and no more than two subagents total.

## Review Focus

1. A host cannot learn private information from a different body — cross-host save/reload and AI-context isolation tests.
2. A client cannot forge money, host identity, quest completion or source knowledge — request validation and reducer replay tests.
3. A blocked door/collision cannot be bypassed by map transition — runtime collision and transition boundary tests.
4. Real historical people and literary characters cannot appear in impossible chronology or be treated as witnesses — character/source chronology audit.
5. A route with mixed choices still ends in exactly one authored ending — ending matrix and browser replays.

---

### Phase 0: Baseline, design and toolchain

**Files:** `docs/v33/BASELINE.md`, `docs/v33/DESIGN.md`, this plan.

- [x] Read root AGENTS, complete Web Game Quality Contract, V33 goal and current master/V32 inventories.
- [x] Run baseline `npm run check`, `npm run lint`, `npm test`, `npm run build`.
- [x] Keep the pre-existing Chancery entry reachable at `chancery.html`; preserve unmodified legacy assets.

### Phase 1: Two-map playable pixel MVP

**Files:** `rpg/engine/*`, `rpg/maps/*.json`, `rpg/characters/*.json`, `rpg/assets/*.png`, `rpg/main.js`, `rpg/rpg.css`, `scripts/v33-rpg-*`.

- [x] Write tests for Tiled map schema, collisions/doors/object interaction, possession separation, reducer action gates, save/load and PNG atlas dimensions; run and observe the expected failure.
- [x] Implement Nevsky street + printshop map data with walkable/collision/object layers and at least three meaningful objects per map.
- [x] Implement a 16px Canvas2D renderer, fit-to-map camera, movement and collision, scene transitions, keyboard and mobile touch controls, and actual rendered PNG tiles/characters.
- [x] Implement observer movement, nearby possession/release, host notebook (goal/knows/cannot/access/possessions), and one complete action-gated quest.
- [x] Run the route at 1440×900 and 390×844, capture and inspect screenshots, fix P0/P1, and prove ≥2 minutes of goal-directed exploration before proceeding. (128,659 ms; touch, scroll, persistence and full two-map quest route pass at both target sizes.)

### Phase 2: Host diversity and four maps

- [x] Add Chancery and courtyard, connected only by plausible doors/access rules.
- [x] Activate six fictional hosts from different circumstances with distinct positions, money/access, items, private facts and objectives.
- [x] Add source-based same-event perspective replay and ensure source access/witnessed facts stay per-host.
- [x] Test possession/release position, local reachability, schedules, save/load and host memory isolation. (16 core tests pass; schedule movement is ledgered, respects local maps, and never overrides an embodied host; save migration restores clock/schedules.)

### Phase 3: V32 AI adapter and security

- [x] Port the strict schema/provider/context/memory/fallback adapter and Worker/DO without replacing the preserved Chancery route.
- [x] Add signed opaque session start and Worker-owned host/knowledge/turn context; expose bounded scene and player input. Follow-up: sessions also bind the embodied speaker/NPC pair and safely pass public embodied-role context; pair-scoped browser storage is covered by `2026-10-30-v33-ai-dialogue-pair-context.md`.
- [x] Add atomic per-session/global budget limits, idempotent replay, fixed session retention, and personal identifier redaction.
- [x] Test prompt injection, forged state, 429/500/timeout/schema errors, host isolation and offline fallback. Live provider remains `BLOCKED_NO_KEY / UNVERIFIED`.

### Phase 4: Three historical issues and two reconstruction realms

- [x] Implement the 1847 print/censorship, 1848 public discourse/news, and dated 1849 investigation stages with aligned source packets.
- [x] Add source-bound historical reconstruction and separate literary realm; enforce date, location, knowledge and canonical outcome rules.
- [x] Add event ledger, cross-host perspective replay, evidence drawer, provenance and localized dialogue.
- [x] Verify at least 12 unique aligned historical excerpts through a source-range and campaign-use claim ledger; 13 unique excerpts pass.

### Phase 5: Five evidence-weighted endings

- [x] Preserve all five exact IDs: `UVAROV`, `BELINSKY`, `HERZEN`, `KHOMYAKOV`, `DOSTOEVSKY_PETRASHEVSKY`.
- [x] Resolve through accumulated possession/action/evidence/relationship history with an authored final decision for mixed states.
- [x] Exercise two reducer-backed variants per ending (10 routes); all resolve at the final May 5 stage. Browser DOM replay of all five ending screens passed, including mobile scrolling and restart (`artifacts/v33/ENDING_BROWSER_SMOKE.json`).

### Phase 6: Publishable build and browser validation

- [x] Root `/` runs the RPG; Chancery remains at `chancery.html`; static build uses relative paths for the Pages project base.
- [x] Add the Pages workflow and Cloudflare configuration/security documentation. Push of `abb14bde7b32bc45849d470ff91afaecb986fe45` deployed successfully via GitHub Actions run `40957947798`.
- [x] Browser smoke covers four viewport sizes, persistence, evidence hotkey, source viewer, fallback dialogue and the source-gated printshop action. Five clean-save browser runs physically traverse all three arcs, four host perspectives, source readings, dialogue and quest decisions to their respective endings; mobile 360×800 separately checks ending scroll and restart.

### Phase 7: Critical review and verification archive

- [x] Use one independent critic for visual/history/AI-separation review (one reviewer; no second agent needed).
- [x] Fix the chronology, timeout and literary-save issues found during review and rerun browser/screenshot checks.
- [x] Refresh `RUSSIAN_LIVES_V33_POSSESSION_RPG_VERIFICATION.zip` with the full-campaign browser script, five route reports/screenshots, latest source and deployment docs. Extract to a fresh folder and run `npm run acceptance:v33`; all tests, four viewport checks, five ending UIs and five full-campaign routes passed against the extracted app.
- [x] Report live API and human playtest state honestly; neither live AI nor a human playtest is claimed as verified. The goal remains incomplete until externally blocked gates are resolved or explicitly accepted.
- [x] Add historical claim-ledger regression coverage; full `npm run acceptance:v33` passes, including the four viewport cases, five ending screens and five complete campaign routes.
