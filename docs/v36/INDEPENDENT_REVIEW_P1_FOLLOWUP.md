# V36 independent review follow-up

Reviewer: one independent subagent, read-only critique, 2026-11-02. This is a scoped follow-up, not the final V36 review.

## P1 findings and follow-up

- **Offline opinion quests could not advance.** Fixed: selecting and receiving an authored response to a listed opinion prompt now records the named perspective and comparison note, while `aiGenerated` and AI reply counters stay false/zero. Browser replay tests two distinct character perspectives, body switch, comparison note, save, and the completed quest counter with `OPENAI_API_KEY` absent.
- **The opinion board did not tell a first-time player how to collect both views.** Fixed: it is visible before possession, names perspective targets, explains that a different body is needed to speak with each target, prioritizes quests already at 1/N, and shows the next person/question after the first perspective.
- **The browser test only checked that the board existed.** Fixed: it now clicks the real offline path through two NPCs at desktop and checks desktop/mobile overflow, page errors, progress, attribution, and AI labeling.
- **District/source IDs did not resolve to the V36 source register, and no actual return traversal was tested.** Fixed for the original prototypes: their V36 evidence IDs resolve to registered source types, legacy map source IDs cross-reference those records, the Sadovnikov panorama is cataloged as a period lithograph with its limits, and the test physically walks to the return gate and traverses both ways. The added market district uses the same bounded-source approach and has a tested, walkable return route.

## Cohort progress (2026-11-02)

- 22 of 36 fictional city residents now have daily schedules, separate authored voices, live AI scene records, and authored work choices.
- Three of six target districts are connected: Nevsky/workplaces, courtyard/household, and the fictional market/quay. Three of eight target interiors are available.
- The inquiry board now presents 12 multi-perspective questions about responsibility, class, censorship, care, privacy, authorship, costs, and consent.
- A deterministic 24-hour simulation of all 22 residents passed twice: 1,031 movements, no tile collisions or unauthorized map jumps, and save/load parity.
- Twelve cohort work quests are playable as one consequential choice with three alternatives each. They are not yet the required 30 three-stage personal quest chains.

## Remaining P1 scope

- V36 still requires 14 more active residents, 3 more districts, and 5 more usable interiors.
- `city-districts-v36.json` currently improves display and provides validated prototype metadata. The whole runtime's access, spawning, social graph, and routines are not yet driven by that registry.
- The 22-resident 24-hour replay is deterministic movement coverage, not proof of goal-driven 36-resident simulation.
- Personal three-stage quests, social chains, 70 meaningful interactions, 60 distinct environment asset types, and 12 visible world changes are not yet at V36 target counts.
- This review does not cover complete endings, GPU performance, all viewport/story routes, or human playtesting. Human playtest remains pending.
