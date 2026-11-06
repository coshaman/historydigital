# Preliminary independent economy review

**Scope:** Market purchase path and leading PHASE 1/2 gaps. This is an early review of one economy slice, not the final PHASE 7 review. The reviewer made no code changes.

## Reviewer findings

The reviewer confirmed `npm run v37-economy-pilot` passed, while noting its first version prepared bread directly in the seller's inventory and therefore did not prove that the bakery-to-market supply exchange worked.

1. **Supply path not covered.** The test manually inserted bread in the seller inventory (`scripts/v37-economy-pilot-test.mjs`). The authored supply exchange is in `rpg/characters/baker_fyodor.json`. The test now starts without market stock and asserts the bakery exchange adds separate market stock before the purchase.
2. **Seller availability was too broad.** The offer could be bought wherever the seller happened to be, including her Nevsky and bakery stops. Offers now require the authored market map and one of the seller's opening windows (`rpg/characters/market_nadezhda.json`, `rpg/engine/game-state.js`). The pilot now verifies a closed location and a player-controlled seller block sales.
3. **Witnessing initially ignored line-of-sight.** The review identified that `playerCanObserveWorldEvent` checked map identity and Manhattan distance only. It now traces through the map's collision layer; a nearby event behind a collision wall is tested as unseen.
4. **Possession pause and deterministic save continuation were not covered by the first market test.** Tests now verify the possessed seller retains stock and resuming from a pre-sale save produces the same state hash.

## Three highest-priority PHASE 1/2 gaps

1. **Households and housing:** 33 fictional residents still have no explicit home record, and bundle family relations are not yet integrated into runtime relationship edges or care transfers.
2. **Survival and economic breadth:** current runtime coverage is a small set of wage contracts, one rent contract, and one bread purchase loop. Health decline, illness, food insecurity consequences, wider goods trade, and the required living-scenario UI coverage remain incomplete.
3. **Event graph and occupational autonomy:** the 45 seed events are not yet runtime event chains, the seed-to-runtime resident crosswalk is unresolved, and the required per-occupation action breadth and event-to-rumor-to-newspaper causality are not implemented.

## Current verification after reviewer feedback

- `npm run v37-economy-pilot`: PASS for bakery supply, paid purchase/eating, opening location/time, possession pause, and deterministic save/resume.
- `npm run v37-economy-pilot`: PASS now includes the E02 stockout, conditional daily bread production/restock, later adjusted-price purchase, and save/resume between stages. The event remains labeled as unverified reconstruction.
- `npm run v36-full-day-36`: PASS for three identical 24-hour replays; each replay hash is `8d2331e0`; one market purchase completed with adjacent seller position, a matching seller-directed goal, and district movement. The hash includes the authored fictional household-care rule, era profiles, and current E01/E04/E07 state integration.
- `npm run v37-economy-pilot`: PASS includes a collision-occlusion assertion for a nearby observer.
- Remaining review scope is broad: no final PHASE 7 audit has been run, and citywide homes/families, survival consequences, the 45-event runtime graph, historical source verification, browser acceptance, and final delivery ZIP remain incomplete.
