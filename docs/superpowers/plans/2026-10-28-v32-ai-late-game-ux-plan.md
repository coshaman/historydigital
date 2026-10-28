# V32 AI Late-Game UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Complete the V32 AI-assisted, historically grounded late-game route while preserving the existing desk, branch behavior, saves, and five endings.

**Architecture:** Keep the vanilla JS app. Build a strict-schema Responses API proxy for local Node and Cloudflare Worker, a deterministic signal/memory engine, authored source-backed scene cards, and a related visual-novel scene shell. AI generates bounded dialogue and approved labels only; authored code owns chronology, state, score, and endings.

**Tech Stack:** Browser JavaScript, Node.js built-in test runner, existing Playwright, JSON Schema, Node HTTP server, Cloudflare Worker.

**Spec:** `docs/superpowers/specs/2026-10-28-v32-ai-late-game-ux-design.md`; full acceptance: user-provided `CODEX_V32_AI_LATE_GAME_UX_EXPANSION_GOAL.md`.

## Global Constraints

- Work from remote `master` SHA `756f9033765329db8eec2cbdbfc175febf5d874e` in the isolated V32 worktree.
- Never use the previously exposed API key; server environment only; never put secrets in frontend, local storage, logs, screenshots, or evidence.
- Exactly five established ending families remain; the deterministic authored engine owns score, state, chronology, and endings.
- Keep all documented facts tied to checked-in source records and enforce source/item availability dates.
- No framework migration, no arbitrary AI branches or stat mutations, and no API outage softlock.
- Use red/green TDD for production behavior; verify each test fails for the expected reason before implementation.
- At most two subagents total; one UX review and one narrative/history/AI review.

## Review Focus

- Malformed, oversized, or injection-shaped AI input cannot reveal secrets, add endings, or mutate arbitrary state; test the proxy and validator.
- Retry, timeout, 429, 500, and malformed structured output all retain the current scene and reach deterministic fallback; test with an injected provider.
- Save/load during conversation preserves bounded recent context and durable memories without accepting model-invented memory ownership; test serialize/restore.
- Source claim IDs and publication/circulation dates are validated for each scene/item; test future/private source rejection.
- Activity selection, missed optional activities, long Korean content, narrow viewports, reduced motion, and refresh never strand the route; browser-test all four required sizes.

---

### Task 1: Complete source/runtime inventory and establish the V32 artifacts

**Files:**
- Read: all V32 read-first files and the source/test scripts named by the goal.
- Create: this design and plan; `artifacts/v32/baseline/` reports.

**Interfaces:** Record exact route phase names, ending IDs, state schema/storage key, current event transitions, source IDs/date fields, browser hooks, and package scripts for later tasks.

- [x] Finish full read of all required runtime, narrative, HTML/CSS, and relevant audit/browser files; write a compact inventory under `artifacts/v32/implementation-inventory.md`.
- [x] Record clean worktree SHA and baseline outputs for `npm run check`, `npm run lint`, `npm run test`, `npm run build`.
- [x] Inspect deployed Pages UI and current desktop/mobile route entry if browser is available; preserve screenshots as baseline.
- [x] Identify and document existing historical dates, source-catalog format, and byte-stable ending IDs before touching them.

### Task 2: Specify and test strict AI turn and security contracts

**Files:**
- Create: `schemas/ai-scene-turn.schema.json`, `ai/validate-turn.js`, `scripts/ai-schema-test.mjs`, `scripts/secret-scan.mjs`, `.env.example`.
- Modify: `package.json`.

**Interfaces:** `validateTurn(value, sceneCard) -> {ok, value|errors}`; `createResponseFormat(schema) -> Responses API text.format`; stable enums for scene, speaker, beat, emotion, semantic signal, memory candidate, and UI cue.

- [x] Write tests for unknown fields/IDs, invalid signal for active scene, absent fields, excess beats/replies, oversized text, invented historical claims, and malformed memory.
- [x] Run tests and observe expected failures before creating schema/validator.
- [x] Add strict JSON Schema (`additionalProperties:false`, bounded arrays/strings) and safe validation; run tests green.
- [x] Add placeholder-only `.env.example`, secret source/bundle scans, and `test:ai-schema`/`test:secrets`; prove scans do not print detected material.

### Task 3: Add scene cards, source lore, chronology validation, and verified exam bank

**Files:**
- Create: `narrative/AI_LORE_CARDS.json`, `narrative/LATE_GAME_SCENARIOS.json`, `narrative/LATE_GAME_CHARACTER_CARDS.json`, `scripts/late-game-content-test.mjs`.
- Modify: `narrative/ACT_III_LEARNING_EXAM.json`, relevant source catalog only when verified metadata is missing.

**Interfaces:** Every injected claim resolves through `sourceId` and exact range; lore cards include `validFrom`, `validTo`, source class and forbidden inference; scenario card includes date, location, cast, objective, allowed claims/signals, activities and fallback beats.

- [x] Add failing tests for unknown sources, missing exact provenance, future/private material, invalid shop availability, unsupported claim, duplicate card IDs, and question coverage.
- [x] Verify historical availability against checked-in records and primary/authoritative sources; do not guess candidate publication dates.
- [x] Author concise source cards, scene cards for circle/shop/supper/reading/exam, distinct character cards, and a 10–15-question bank with stable key and the existing pass rule.
- [x] Make all tests pass; ensure every exam item is source-backed and traceable to taught/prep content.

### Task 4: Implement deterministic late-game state, memory, and context assembly

**Files:**
- Create: `main20-ai-state-engine.js`, `ai/context-composer.js`, `ai/memory-store.js`, `scripts/ai-state-test.mjs`.
- Modify: save normalization in `main20-runtime.js` only after isolated pure-module tests pass.

**Interfaces:** `applySceneTurn(state, turn, scene) -> {state, auditEvent}`; `validateMemory(candidate, scene, turnIndex)`; `serializeMemories`/`restoreMemories`; `composeContext({scene,state,lore,memory,summary,recent,input})` with strict bounded sections.

- [x] Test deterministic replay, whitelist-only effects, per-scene caps, relationship clamps, non-farmable repeated stances, effect explanation, and no ending mutation.
- [x] Test one player stance summarized/remembered across Circle→Bookshop/Meal and save/reload; reject model-authored canonical hidden facts.
- [x] Test context bounds (8–12 recent turns, compact summary, 3–6 source cards) and exclusion of irrelevant/future lore.
- [x] Implement only state mappings reconciled with existing ideology/ending code; run new and existing branch/ending tests.

### Task 5: Build Responses API endpoint, local adapter, and Worker proxy

**Files:**
- Create: `ai/prompts/core-rules.js`, `ai/prompts/character-context.js`, `ai/prompts/scene-context.js`, `ai/prompts/history-context.js`, `ai/prompts/memory-context.js`, `ai/provider/openai-responses.js`, `ai/http/turn-handler.js`, `ai-worker/src/index.js`, `ai-worker/wrangler.toml.example`, `ai-worker/README.md`, `scripts/ai-endpoint-test.mjs`.
- Modify: `server.mjs`, `package.json`, `.env.example`.

**Interfaces:** `handleTurn(request, {provider, limiter, config})`; `provider.generate({input,format,model,maxOutputTokens,signal})`; local `POST /api/ai/turn`; worker `fetch(request, env, ctx)`.

- [x] Test exact CORS allowlist, request-size cap, per-session turn cap, supported origins, rate limiting, missing key, unsupported scene, no arbitrary system prompt, no secret in response/log, and status semantics.
- [x] Test Responses API strict-format request construction with injected fetch; configure dialogue/memory model defaults via env overrides and output ceiling.
- [x] Test 429/500/timeout/malformed output retries once and then returns schema-valid fallback without dropping route progress.
- [x] Implement local and Worker adapters with shared handler; add local endpoint only when key is configured, but keep deterministic fallback available.
- [x] Run schema, endpoint, secret, and existing server/build tests.

### Task 6: Integrate authored schedule, scene shell, free dialogue, and memory

**Files:**
- Modify: `index.html`, `styles.css`, `main20-runtime.js`, `main20-exam.js`, `main20-life-simulation.js` only where needed.
- Create: focused scene shell module if runtime coupling requires it, `scripts/late-game-browser.mjs`.

**Interfaces:** Explicit resumable phases for Circle, activity choice, Bookshop, Supper, Reading, Examination; browser submits player text or selected reply and consumes validated turn; activity schedule shows opportunity cost, never raw engine metadata.

- [x] Add failing browser tests for typed send, suggested reply, loading duplicate lockout, retry/fallback, notebook/history/source access, save/load, restart, no dead ends, and ending dialogue removal.
- [x] Integrate required circle and two activity choices from three optional activities, preserve source-first desk transition and exact five ending families.
- [x] Add in-world loading/error/fallback states and protect input state on failure.
- [x] Build shared visual grammar: location art, portraits, bottom dialogue panel, speaker identity, concise Korean choices, scrollable narrow layouts, keyboard/touch and reduced-motion behavior.
- [x] Run browser tests at each meaningful route before content expansion.

### Task 7: Generate and integrate late-game atmosphere assets

**Files:**
- Create: `assets/late-game/` six distinct location backgrounds and at least four event stills; `assets/late-game/ASSET_PROVENANCE.json`.
- Modify: scene cards/UI only to reference manifest IDs.

- [x] Read the imagegen skill and produce scene-consistent assets for Petersburg street, circle room, bookshop, supper room, reading room, examination chamber, and four event beats.
- [x] Validate dimensions, file formats, visual identity, scene mapping, historical notes, prompts, and provenance manifest.
- [x] Check browser rendering at desktop and mobile-like ratios; keep images decorative and never as evidence.

### Task 8: Complete route/exam/ending behavior and exhaustive automated verification

**Files:**
- Create: `scripts/late-game-acceptance.mjs`, `scripts/ai-injection-test.mjs`, `scripts/ai-outage-test.mjs`, `scripts/ai-history-guard-test.mjs`.
- Modify: `package.json`, relevant tests only.

- [x] Expand exam to 10–15 verified items with a deterministic bounded subset per run; test score never delegated to AI and no golden-path requirement.
- [x] Replay desk→circle→bookshop→reading→exam→ending; desk→circle→supper→bookshop→exam→different ending; and provider-failure route through ending.
- [x] Test prompt injection attempts for secret, system prompt, arbitrary +999 state, and new ending; assert no canonical mutation and safe in-character/fallback response.
- [x] Verify all five exact ending IDs, late-game influence, historical anchor invariance, mixed paths, save migration, restart, and memory persistence.
- [x] Add npm scripts `test:ai-schema`, `test:ai-state`, `test:late-game`, `test:secrets`, `browser:late-game`; ensure `npm run check`, `lint`, `test`, `build` still pass.

### Task 9: Browser inspection, two-reviewer gate, refinement, and evidence ZIP

**Files:**
- Create: `artifacts/v32/report.md`, `artifacts/v32/transcripts/`, `artifacts/v32/screenshots/`, `artifacts/v32/logs/`, final `artifacts/v32-verification.zip`.

- [x] Capture and visually inspect 1440x900, 1366x768, 390x844, 360x800; include desk, ideology, Circle, Bookshop, Supper, Reading, Examination, and Ending captures.
- [x] Run one UX critic on screenshots and one narrative/history/AI critic on scene cards, source IDs, accepted signals and transcripts; total agents must not exceed two.
- [x] Make one targeted P0/P1 refinement pass; rerun affected checks and capture final evidence once.
- [x] Run full fresh gates: `npm run check`, `npm run lint`, `npm run test`, `npm run build`, all V32 scripts, and browser route replays. Run live API smoke only if a new key exists in environment, never print it; otherwise mark `LIVE_OPENAI_SMOKE: UNVERIFIED`.
- [x] Create ZIP with reports, source/schema/cards/mapping, transcripts, route/replay logs, screenshots, secret and chronology scans, reviewer reports if used, and provenance manifest. Exclude secrets and raw request headers.
- [x] Report the final status block required by the V32 goal; do not claim release candidate if any required gate is NO or unverified in a required area.

## Self-review

- Every V32 requirement section 4–26 maps to Tasks 2–9; read-first/baseline maps to Task 1.
- Shared data contracts are explicit before the endpoint/runtime integration tasks consume them.
- Image generation is gated on reading its required skill and produces checked-in assets with provenance.
- User-approved execution method is inline; no extra approval pause is needed. At most two review subagents are planned.
