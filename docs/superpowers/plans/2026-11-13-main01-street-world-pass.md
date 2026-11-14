# MAIN01 street and world pass implementation plan

## Scope

Complete the already playable MAIN01 slice with a focused material-art pass: Russian Petersburg street-life cues, seasonal weather readability, printshop props, and useful MAIN01 inventory items. Keep the existing tile maps, canvas renderer, reduced-motion behavior, map collisions, source-first provenance, and deployment bundle. MAIN03 remains next; MAIN05 remains last.

## Files and responsibilities

- `rpg/engine/petersburg-street-life.mjs`: map-specific moving street traffic and weather interaction.
- `rpg/engine/atmosphere.mjs`, `rpg/engine/renderer.js`: deterministic seasonal visual weather and surface response, clipped to playable map.
- `rpg/maps/nevsky.json`, `rpg/maps/printshop.json`, selected MAIN01 map files: authored placement and usable physical props without changing collision geometry.
- `rpg/data/v47-story-beats.mjs`: only inventory handoffs tied to existing authored beats and actions.
- `rpg/assets/ASSET_PROVENANCE.json`, `rpg/assets/ASSET_USAGE_V36.csv`: checked rights, date relevance, and transformation for every outside visual reference and new authored pixels.
- `scripts/v47-street-life-test.mjs`, `scripts/v37-weather-test.mjs`, `scripts/v47-main01-assets-test.mjs`: deterministic effect, map safety, reduced-motion, item, and provenance assertions.
- `docs/v47/IMPLEMENTATION_AND_QA.md`: current evidence and explicitly partial acceptance gates.

## Sequence

1. Verify suitable public-domain museum references and record their exact date/right boundaries before using them.
2. Add bounded street motion and wet/cold surface cues; preserve map geometry and reduced-motion output.
3. Refine the printshop's work zones and add only inventory items that existing story beats actually transfer or consume.
4. Extend focused automated checks, build, inspect browser captures at desktop and mobile, and update the QA record.

## Acceptance

- Traffic/effects stay inside their intended outdoor map, remain deterministic for test inputs, and stop moving under reduced motion.
- No interaction/collision geometry changes as a side effect of visual additions.
- Historical visual reference metadata distinguishes source date from the 1848 scene; no later image is embedded as a contemporaneous scene asset.
- Physical items change inventory only through a played interaction or story choice.
- MAIN01 normal and alternate browser routes still complete; no viewport overflow or page errors at 1440×900 and 390×844.
- `npm run check` and `npm run build:v33` pass before claiming the pass is done.
