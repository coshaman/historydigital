# V36 Release Check

This report records evidence from the current workspace. It distinguishes local checks from checks that require the deployed Vercel project.

## Requested fixes

- AI dialogue: `v36-live-ai-browser` made one real `gpt-5.4-mini` generation through the local Vercel-compatible same-origin API. The browser displayed the generated reply; `/api/rpg/session/start` returned 201 and `/api/rpg/dialogue` returned 200. The event was marked AI-generated. No response text or credential was written to the report. The app no longer substitutes offline dialogue after a failed request.
- Distinct character voices: `v36-voice-audit` covers 36 residents and six relationship/situation registers. It found 36 distinct rhythm/ending signatures, 36 distinct blind spots and register matrices, and no indistinct groups. Runtime prompt supplies each character's register and speaking rhythm.
- Clear goals: the city mission panel names the next task and destination. The separate opinion board starts with 16 of 23 inquiries available; each asks the player to question two residents, compare their views, and record a personal position. Browser acceptance confirmed the board and progress survive save/load.
- Personal stories: 36 residents each have an assigned three-choice quest. The current coverage audit reports 170 three-choice personal quests, 47 complete multi-stage life chains, and 16 newly added three-stage arcs (48 quest stages). All 36 residents were exercised in the engine; 82 stages resolved. Social quests require the named partner to be present in the same place.

## Verification evidence

- `npm run acceptance:v36` is the integrated release gate and writes `docs/v36/ACCEPTANCE.json`; it runs with `OPENAI_API_KEY` cleared and does not incur model costs. The local real-generation check below is separate.
- `npm run check`, `npm run build:v33`, `npm test`, and `npm run v33-vercel-api-test` pass.
- `npm run perf` and `npm run mobile` pass, including the reduced-motion static fallback for the courier scene.
- `v36-city-map-acceptance`: six districts, 14 maps, eight enterable interiors, 175 meaningful interactions, reciprocal exits, and source evidence.
- `v36-resident-batch`: all six batches pass; 36 residents, 36 personal quest completions, and 82 quest stages.
- `v36-personal-quest-browser`: a first-time player completed a three-choice resident quest in the browser, saw the next chain stage unlock, and had zero page errors.
- `v36-full-day-36`: three deterministic 24-hour replays; all 36 residents logged at least one non-schedule goal decision, all have distinct authored objectives, 864 collision snapshots, 177 map transitions, four deliveries, two exchanges, 20 distinct residents recorded in physical neighbor meetings, and exact save/reload parity. The current replay also records each resident's selected autonomous goal types in `docs/v36/current-audit/FULL_DAY_36_RESIDENT_REPLAY.json`.
- `v36-autonomy-utility-test`: all 36 authored intention sets and individualized planner profiles are loaded into runtime state; deterministic utility choice is exercised across personal focus, livelihood, rest, meals, and named relationships. Raising the work priority at the same income pressure changes a resident from a personal appointment to livelihood work; meals consume an inventory item and reduce hunger.
- `v36-observed-world-events-test`: verifies nine witnessed autonomous resident-behavior families and three player-visible civic consequence families (purchase, public newspaper circulation, and witness-triggered custody). The civic cases assert changed inventory/money/audience/custody state and matching journal records; the full journal audit reports 12 event families.
- Independent read-only adversarial review completed 2026-11-04: no P0 findings; the P1 event-family gap is covered by the expanded test. The narration speaker label is corrected. Generated AI dialogue still has no runtime character-style quality gate, so naturalness of all live model responses is not proven.
- `v36-save-migration`: 12 legacy save fixtures from versions 1–3 restore authored daily intentions for all residents and preserve user state through V36 round trips.
- `v36-social-chain-test` and `v36-expanded-personal-chain-test`: absent-partner actions are rejected; present-partner actions progress; 16 added arcs and save/reload progression pass.
- `v36-ending-quest-scoped-test`: ending qualification is bound to the actual final quest and action, not a reused action ID from an earlier scene.
- `v36-browser-acceptance`: 28 desktop/mobile routes across all five endings, with source reading, branch choices, and zero page errors. See `BROWSER_ACCEPTANCE.json` and its captured screens.
- `v36-world-map-browser-capture`: 14 city maps at four viewport sizes, 56 screenshots, no horizontal overflow or page errors.
- `v36-package-evidence`: generated archive includes source and audit evidence, plus SHA-256 checksums. `.env*` credentials, Git data, `node_modules`, and build output are excluded.
- Clean extraction: all 1,158 archived files passed SHA-256 verification; `npm ci`, `npm run check`, and `npm run build:v33` passed from the extracted copy.

The voice audit proves that each resident has differentiated authored voice guidance; it is not a human naturalness score. A direct sample review found 16 third examples that read like character-card summaries; these were rewritten as spoken turns. The audit now rejects common narrator-summary endings as well as duplicate rhythms. The live generation smoke checks that a real model answer reaches the UI, not that one answer proves every voice natural. Vercel production output still needs a deployed check.

## Vercel deployment boundary

The local real-generation check proves the code path works with the local ignored `.env.local` key. It does not prove that the user's Vercel Production or Preview environment contains a valid key. Add `OPENAI_API_KEY` as a Sensitive variable in Vercel Project Settings → Environment Variables, choose Production (and Preview if needed), and redeploy. A health response showing `CONFIGURED` proves key presence only; an in-game answer labeled `AI 생성 답변` after a successful `/api/rpg/dialogue` response proves model generation.

## Git state

At the start of this change, the workspace branch pointed at the same commit as `origin/master`; `git ls-files -u` returned no unmerged entries. The working tree changes are intended release edits. Push destination requested by the user: `origin/master`.
