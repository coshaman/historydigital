# V36 independent review follow-up

Reviewer: one independent subagent, read-only critique, 2026-11-02. This is a scoped follow-up, not the final V36 review.

## P1 findings and follow-up

- **Offline opinion quests could not advance.** Fixed: selecting and receiving an authored response to a listed opinion prompt now records the named perspective and comparison note, while `aiGenerated` and AI reply counters stay false/zero. Browser replay tests two distinct character perspectives, body switch, comparison note, save, and the completed quest counter with `OPENAI_API_KEY` absent.
- **The opinion board did not tell a first-time player how to collect both views.** Fixed: it is visible before possession, names perspective targets, explains that a different body is needed to speak with each target, prioritizes quests already at 1/N, and shows the next person/question after the first perspective.
- **The browser test only checked that the board existed.** Fixed: it now clicks the real offline path through two NPCs at desktop and checks desktop/mobile overflow, page errors, progress, attribution, and AI labeling.
- **District/source IDs did not resolve to the V36 source register, and no actual return traversal was tested.** Fixed for the original prototypes: their V36 evidence IDs resolve to registered source types, legacy map source IDs cross-reference those records, the Sadovnikov panorama is cataloged as a period lithograph with its limits, and the test physically walks to the return gate and traverses both ways. The added market district uses the same bounded-source approach and has a tested, walkable return route.

## Cohort progress (2026-11-02)

- All 36 fictional city residents now have daily schedules, separate authored voices, live AI scene records, and authored work choices.
- Three of six target districts are connected: Nevsky/workplaces, courtyard/household, and the fictional market/quay. Three of eight target interiors are available.
- The inquiry board now defines 23 multi-perspective questions across the campaign; 16 are open at the initial date. Topics include responsibility, class, censorship, care, privacy, authorship, debt, education access, public speech, shared costs, records, labor, and public space.
- A deterministic 24-hour simulation of all 36 residents passed twice: 2,489 movements, no tile collisions or unauthorized map jumps, and save/load parity.
- Twenty-six cohort work quests are playable as one consequential choice with three alternatives each. They are not yet the required 30 three-stage personal quest chains.
- The last eight residents add fish and street sellers, a warehouse clerk, household servant, junior guard, carter, typesetter, and lodging-house reader. Their dialogue and personal stakes focus on scarcity, access, labor, authority, and learning.
- The local live-provider smoke passed one real generation with non-empty AI text and no authored fallback. This verifies local credentials and response handling only; Vercel production configuration must be checked at its deployed `/api/rpg/health` endpoint.

## Remaining P1 scope at the 2026-11-02 review (historical snapshot)

- V36 still requires 3 more districts and 5 more usable interiors.
- `city-districts-v36.json` currently improves display and provides validated prototype metadata. The whole runtime's access, spawning, social graph, and routines are not yet driven by that registry.
- The 36-resident 24-hour replay is deterministic movement coverage, not proof of goal-driven simulation.
- Personal three-stage quests, social chains, 70 meaningful interactions, 60 distinct environment asset types, and 12 visible world changes are not yet at V36 target counts.
- This review does not cover complete endings, GPU performance, all viewport/story routes, or human playtesting. Human playtest remains pending.

## Additional implemented behavior (2026-11-02)

- A scheduled bakery-to-market transaction now transfers one bread bundle for 3 kopeks at its set market hour, only when the baker and seller are physically adjacent on the same map. The transaction updates both inventories, both balances, reciprocal relationship notes, and the NPC simulation ledger.
- The seller's evening meal consumes that purchased bread only after a per-resident hunger threshold is reached; the simulation records the meal and reduces the stored need value. Need values also persist through saves and are migrated into older saves.
- Possessing either participant pauses the exchange; it can occur after the resident resumes their routine. Save/load preserves the resulting goods, funds, and relationship state.
- The current playable opinion board exposes 16 two-perspective inquiries at the opening date. Each row names the first person to ask; after one reply, the board names the second person and the exact follow-up question. Desktop and mobile click-through checks confirm the board remains visible and does not overflow horizontally.
- Validation: `npm run v36-social-exchange-test` passes. The full 36-resident 24-hour deterministic replay records the exchange and one threshold-triggered meal in both runs, with 2,489 one-tile moves, 288 occupancy checks, and save/load parity.
- Schedule review found four residents with fewer than four authored daily stops. Sofia, Ivan, Darya, and Konstantin now have expanded role-specific routines; the roster audit reports no city resident below four stops. The 24-hour replay remains deterministic and preserves save/load parity.
- Phase 2 now has a tested first-six needs-driven slice: Alexei, Ekaterina, Pavel, Anna, Mikhail, and Lev have distinct income/fatigue/safety/belonging profiles; three residents select a fatigue-triggered rest destination and recover through tile movement, while Pavel completes one adjacent sealed-envelope handoff to Ekaterina. Possession pauses the host's route and need drift, release resumes the schedule, autonomous simulation leaves player quests untouched, and save/load plus older need-field migration pass. Evidence: `npm run v36-goal-driven-six` and `docs/v36/current-audit/FIRST_SIX_GOAL_REPLAY.json`.
- The local paid provider smoke returned a non-empty generated response from `gpt-5.4-mini` (one generation). This verifies the configured local key and server generation path; the read-only health endpoint only confirms key presence and cannot prove a dialogue reply was generated.
- Scope limit: this is one authored schedule transaction, not a generalized needs-driven trade economy or ten completed resident social-action chains. The 36-agent routine planner remains schedule-led, and more needs, relationships, business hours, deliveries, and consequences remain to be implemented and verified.

## Player-facing dialogue and inquiry follow-up (2026-11-03)

- The live generation request was reaching the provider but could return an incomplete response and then show only the authored offline line. The output allowance is now 700 tokens, and provider diagnostics distinguish output-token exhaustion and content filtering. A real local request through the same Vercel function handler returned two AI-generated beats with `fallback: false`.
- The production Vercel deployment itself is not verified from this workspace. `/api/rpg/health` confirms environment-variable presence, not a successful model generation.
- The inquiry board now states the four-step task, names the next person and exact question after the first perspective, and shows the target's district and linked source title. The opening view reports 16 available inquiries out of 23 total.
- A desktop/mobile browser replay completed an actual two-resident censorship-and-labor inquiry, confirmed the comparison note and saved progress, found no page errors, and found no horizontal overflow.
- Review found repeated worldview blind-spot text on 26 resident cards and an overly similar carter/warehouse voice signature. Those 26 limitations now describe role-specific errors; the carter samples now differ in endings and rhythm. `npm run v36-voice-audit` enforces six registers, three authored samples, unique resident blind spots, and distinct endings/rhythm signatures across all 36 fictional residents.
- Validation: `npm run check`, `npm run build:v33`, `npm run v36-voice-audit`, `npm run v36-goal-driven-six`, `npm run v36-life-chain-test`, and `npm run v36-opinion-board-browser` passed.

## Updated acceptance and remaining evidence (2026-11-05)

- `npm run acceptance:v36` completed **45/45 gates**. It verified 36 active residents, 30+ possessable residents, six connected districts, 14 city maps, eight enterable interiors, and 175 meaningful interactions.
- All 36 residents completed a playable three-stage life arc (108 physical stages). Quest coverage reports 47 complete multi-stage chains. Ten social chains and 16 currently available philosophy/ideology inquiries were checked.
- Three deterministic 24-hour replays completed for all 36 residents with matching state hashes and no occupancy collision. A browser inquiry compared two AI-generated resident views, recorded the player's own stance, and preserved it through save/load.
- The campaign browser suite completed 28 routes: five canonical endings, five mixed-choice routes, tie-break cases, and randomized routes. The map browser capture produced 56 images over four viewport sizes with zero horizontal overflow or page errors.
- A fresh real-key browser run used the same local Vercel-compatible function path: session creation returned HTTP 201, the dialogue request returned HTTP 200, generated text appeared in the conversation, and its ledger event was marked `aiGenerated`. One paid generation; zero browser errors. Safe evidence is in `docs/v36/current-audit/REAL_AI_IN_GAME_ACCEPTANCE.json`; neither credentials nor answer text are stored.
- The 2026-11-04 independent-review P1 about the world-reaction count is addressed in code: the shared journal formatter exposes nine witnessed resident outcome families, including completed occupational work, plus four reducer-produced civic outcome families. Internal goal selection is excluded. `npm run v36-observed-world-events-test` verifies the shared formatter and reducer results.
- The 2026-11-05 independent review found two further P1s. A choice that checks Timofey's tally now blocks until he is physically nearby, and the quest marker warns about the proximity requirement. Every active resident now has two authored work actions; the engine records completed outcomes in bounded saved state and the NPC event ledger, creates only explicitly authored inventory items, never invents wages, and formats witnessed work in the journal. `npm run v36-social-chain-test` and `npm run v36-occupational-work-test` passed; the latter exercised all 72 outputs, partial progress across a serialized state, offsite/possessed guards, and no-wage behavior.
- **Still unresolved:** visual distinction/semantic uniqueness of every sprite and tile has not been independently judged; historical role, access, and environment-art claims still need source-by-source review; generated AI dialogue has no runtime style-quality gate; GPU frame timing and human playtesting remain unverified. One live Vercel generation passed on 2026-11-05; see `current-audit/VERCEL_PRODUCTION_AI_SMOKE.json`. This does not establish voice quality across the cast or future reliability. Consequently `V36_ASSETS_AND_PERIOD_EVIDENCE` is NO, `V36_GPU_PERFORMANCE` is UNVERIFIED, `HUMAN_PLAYTEST` is PENDING, and `V36_COMPLETE` remains NO.
