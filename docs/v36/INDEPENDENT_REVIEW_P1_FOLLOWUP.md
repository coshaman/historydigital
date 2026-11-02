# V36 independent review follow-up

Reviewer: one independent subagent, read-only critique, 2026-11-02. This is a scoped follow-up, not the final V36 review.

## P1 findings and follow-up

- **Offline opinion quests could not advance.** Fixed: selecting and receiving an authored response to a listed opinion prompt now records the named perspective and comparison note, while `aiGenerated` and AI reply counters stay false/zero. Browser replay tests two distinct character perspectives, body switch, comparison note, save, and the completed quest counter with `OPENAI_API_KEY` absent.
- **The opinion board did not tell a first-time player how to collect both views.** Fixed: it is visible before possession, names perspective targets, explains that a different body is needed to speak with each target, prioritizes quests already at 1/N, and shows the next person/question after the first perspective.
- **The browser test only checked that the board existed.** Fixed: it now clicks the real offline path through two NPCs at desktop and checks desktop/mobile overflow, page errors, progress, attribution, and AI labeling.
- **District/source IDs did not resolve to the V36 source register, and no actual return traversal was tested.** Fixed for the first two prototype districts: their V36 evidence IDs resolve to registered source types, legacy map source IDs cross-reference those records, the Sadovnikov panorama is cataloged as a period lithograph with its limits, and the test physically walks to the return gate and traverses both ways.

## Remaining P1 scope

- The game still has 10 fictional city residents, 2 prototype districts, and 3 interior maps; V36 requires 36 active residents, 6 districts, and 8 usable interiors.
- `city-districts-v36.json` currently improves display and provides validated prototype metadata. The whole runtime's access, spawning, social graph, and routines are not yet driven by that registry.
- The 24-hour NPC replay remains existing-engine baseline evidence (`PASS_WITH_V36_GAPS`), not proof of goal-driven 36-resident simulation.
- Personal three-stage quests, social chains, 70 meaningful interactions, 60 distinct environment asset types, and 12 visible world changes are not yet at V36 target counts.
- This review does not cover complete endings, GPU performance, all viewport/story routes, or human playtesting. Human playtest remains pending.
