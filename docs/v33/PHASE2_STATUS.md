# V33 Phase 2 status

## Implemented

- Added four connected Tiled maps: Nevsky street, printshop, Chancery intake room, and a rented courtyard. Each connection is a walkable physical door with a reciprocal exit.
- Added six fictional residents across four social-estate categories. Every character has a separate map position, legal-mobility list, money estimate, inventory, private knowledge, and objective.
- Added office and household props as clearly labeled fictional clues. Their wording varies by host and does not claim to reproduce archival records.
- Host bodies now move with their saved map/position. NPC placeholders outside the host's current map are neither visible nor collidable; released hosts can be found and possessed again only where they actually remain.
- Host access is enforced by the transition reducer and explained in the journal. Unpossessed observation can use public entrances. The same literary source can be read by Pavel and Ekaterina as separate knowledge events.
- Save/load retains a moved host's map and position. The save validator checks each host remains within an allowed map and that host knowledge has a matching ledger event.
- Added a visible 24-hour game clock. Walking, reading, inspecting, map changes, and completed quest actions advance in-world time.
- Six local schedules move unembodied residents only within their current map; an embodied host stays under direct player control. Schedule movement is ledgered and avoids the player's reserved arrival tile.
- Version-one saves without clock/schedule fields migrate on load while retaining player, host, quest, and knowledge state.

## Verification

- `node --test scripts/v33-rpg-core.test.mjs`: 16/16 pass, including reciprocal map doors, access restrictions, save migration, world-clock scheduling, host control, and same-source cross-perspective isolation.
- `node scripts/v33-rpg-browser-smoke.mjs`: PASS at 1440×900 and 390×844, including a 128,701 ms directed route. No horizontal overflow; touch controls fit; clock advances visibly; source panel scrolls; fictional clues and save restoration work; source-gated action resolves; Chancery → Nevsky → courtyard is playable; Alexei is denied courtyard access; Mikhail reads his own fictional rent note and returns to the street. No page errors.
- Visual evidence and run report: `artifacts/v33/V33_RPG_PHASE1/`.

## Remaining in this phase

- None. Phase 2 is complete; the next plan gate is the server-owned V32 AI adapter and its abuse/fallback tests.
