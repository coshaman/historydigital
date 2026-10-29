# V33 AI Dialogue Pair Context Implementation Plan

> **For agentic workers:** Execute this approved follow-up against the existing V33 plan. Keep NPC dialogue read-only with respect to game state.

**Goal:** Give each AI conversation the embodied player's safe public identity and keep dialogue sessions/transcripts isolated by embodied-player/NPC pair.

**Architecture:** The browser sends the NPC `hostId` plus embodied `actorHostId` at session creation. The Worker accepts only known distinct characters, the Durable Object stores both IDs, and the model receives a narrow public profile for the embodied character while retaining the speaking character's existing private-knowledge context. Browser token/transcript storage keys use the ordered host pair.

**Tech Stack:** Existing vanilla JavaScript client, Cloudflare Worker/Durable Objects, Node test runner, Playwright browser acceptance.

**Spec:** `C:/Users/owner/Downloads/CODEX_V33_POSSESSION_RPG_AI_HISTORY_GOAL.md`, sections 3.2 and 6.2.

## Global Constraints

- Only deterministic game actions mutate game state; AI dialogue cannot grant knowledge, money, quest progress, relationships, or endings.
- Client-supplied character IDs are identifiers only and must pass a checked-in character allowlist.
- The AI may receive the embodied character's public occupation/social context, never that character's private knowledge as if the NPC already knew it.
- Existing host-only sessions remain accepted for compatibility; the game client always supplies both identities.

## Review Focus

1. Session start rejects unknown or same-person speaker/actor pairs.
2. Model context contains public actor role without actor private knowledge.
3. Same NPC spoken to by different embodied characters receives separate opaque sessions and recent-turn memory.
4. Save/load and dialogue UI keep the original quest and deterministic-state boundaries.

---

### Task 1: Server-owned dialogue pair context

**Files:** `ai/v33/session-runtime.cjs`, `ai/v33/worker/index.cjs`, `scripts/v33-ai-runtime.test.mjs`.

- [x] Write regression test proving two embodied identities are represented separately in model context and actor private facts are excluded.
- [x] Run the test and observe session-start rejection before implementation.
- [x] Add optional allowlisted `actorHostId`, persist it in the signed session, and provide a minimal public actor profile to the model.
- [x] Validate the optional field at the Worker edge before consuming budgets.
- [x] Run focused AI runtime regression tests.

### Task 2: Pair-scoped browser sessions and transcripts

**Files:** `rpg/main.js`, `scripts/v33-interpersonal-dialogue-browser.mjs`.

- [x] Browser test captures session start and proves Anna→Ekaterina includes both IDs; after switching to Alexei, it proves a distinct token and transcript/session key.
- [x] Run browser acceptance and observe the missing `actorHostId` fail before UI implementation.
- [x] Scope session storage, in-memory session and transcript keys to the ordered actor/NPC pair; discard stale async results when the active pair changes.
- [x] Serialize one unfinished turn per session in the MemorySessionStore and Durable Object, with an expiring 60-second lease for abandoned claims.
- [x] Lock dialogue controls during pending requests; invalidate and discard the pair token if the player closes mid-request so late replies cannot contaminate a reopened conversation.
- [x] Re-run AI runtime tests (21/21), including concurrent turn ordering and one-in-flight Durable Object claims.
- [x] Re-run interpersonal browser coverage at four viewport sizes, including duplicate-submit lock and close/reopen with a late response.
- [x] Full campaign browser checks and all non-browser acceptance gates pass on the extracted package; repeat full extracted acceptance after rebuilding the final archive.

### Task 3: Record and package

**Files:** `docs/v33/VERIFICATION_2026-10-30.md`, `RUSSIAN_LIVES_V33_POSSESSION_RPG_VERIFICATION.zip`.

- [x] Update verification evidence and rebuild the external review ZIP.
- [x] Rebuild the ZIP, extract it to a clean directory, and run `npm run acceptance:v33` against the final contents (604 files; exit 0, including all five full browser campaign routes).
- [ ] Commit and push to both `master` and `codex/v33-possession-rpg`.
