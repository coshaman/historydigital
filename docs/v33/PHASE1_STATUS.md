# V33 Phase 1 status

## Implemented

- Added a browser-native Tiled JSON Canvas2D slice at `rpg.html`; the existing `index.html` and Chancery implementation remain untouched.
- Generated two connected 1847 Petersburg maps, an original 256×160 pixel tileset, and four distinct 48×96 sprite sheets.
- Added four fictional residents with different occupations, livelihood estimates, private facts, access and objectives.
- Added deterministic movement/collision, nearby possession and release, physical door transitions, host notebook, per-host source knowledge, a gated printshop action, and local save/load with source-knowledge validation.
- Added a checked-in RU/KO aligned contiguous literary excerpt with precise edition/range provenance. It is labeled fiction, and its 4th collected-edition witness is not misrepresented as a facsimile of the 1847 first printing.
- Added immediate choice subcopy for audience, record type, document movement, and practical risk.
- Added four interactable fictional scene clues. The clue text has host-specific readings, is visibly distinguished from historical quotation, and only enters the observing host's notebook after a nearby physical inspection.
- Cached map tile layers after discovering the static server did not serve PNG with an image MIME type. Added PNG/JPEG MIME types to the development server.
- Fixed an undeclared `frame`/`movement` runtime error found only in the real browser: the animation loop now continues without throwing on every frame or movement.
- Save/load now restores the latest source, fictional clue, or printshop decision to the journal in ledger order.

## Verification so far

- `node --test scripts/v33-rpg-core.test.mjs`: 11/11 pass, including map/asset contract, collision, possession, transitions, quest authorization, per-host source/clue knowledge, tamper-resistant save validation, and save/load.
- `npm run build`: pass.
- `npm run lint`: pass.
- `npm run check`: pass; existing corpus and five ending identifiers remain intact.
- `scripts/v33-rpg-browser-smoke.mjs` ran in Chrome at 1440×900 and 390×844: no horizontal page overflow, all touch controls inside the viewport, mobile touch movement works, a clue can be inspected as Pavel, the host-specific text and notebook survive save/reload, source text scrolls inside the journal, the player physically crosses to the printshop, possesses Ekaterina, reads the source, and resolves the gated proof choice. Both routes completed without page errors.
- Screenshots and the machine-readable report are in `artifacts/v33/V33_RPG_PHASE1/`.
- Screenshot review confirms the full world map, current body, journal and mobile touch pad remain visible at both target sizes. The wood-and-brass printshop has readable foreground objects. Street tile density still needs review before widening the game.

## Still required for the Phase 1 gate

## Phase 1 gate

- Goal-directed observer → source → Pavel/clue → physical street door → Ekaterina/source → gated proof decision took 128,659 ms in one browser session.
- Captured and inspected 1440×900 and 390×844 screenshots. The full map and journal fit; all mobile touch controls remain in the viewport; source text scrolls within the journal.
- Street surface is intentionally a continuous Petersburg cobblestone ground; the printshop adds distinct timber, counter and paper surfaces. The first slice is visually readable at both checked sizes. Revisit density if later map scale or additional objects make targets indistinct.
- The long route initially exposed an animation-loop CPU issue: an always-on 60 Hz canvas loop delayed the final screenshot. Rendering is now event-driven while idle and runs briefly during movement. The same 128-second path and final capture then passed with no browser exceptions.

**Phase 1: PASS. Phase 2 may proceed.**
