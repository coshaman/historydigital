# MAIN01 street art and play direction

## Intent

Finish MAIN01 first, then return to MAIN03. MAIN05 cholera simulation and balancing is deferred. Improve MAIN01's Petersburg street and printshop so the scene feels inhabited and the almanac work has useful physical objects to handle.

## Chosen approach

Keep the existing 16px tile maps and canvas renderer. Add authored scene details and restrained motion that follow the existing camera and reduced-motion behavior. The public-domain 1850s Nevsky/Gostiny Dvor image is research reference only: it postdates MAIN01 and will not appear as an 1848 in-world image. Avoid replacing navigable maps with a static full-screen image or depending on a remote image host.

## Visual and gameplay changes

- Give the printshop less repetitive walls and a clearer press/workbench area, with paper, ink, type, cords, order slips, and bound/unbound almanac stacks that relate to MAIN01 actions.
- Add restrained cart motion and turning wheels to Nevsky, then extend the same visual grammar to other streets only after map-specific placement review. Keep collisions and interaction targets intact.
- Extend the current seasonal weather across March–December dates with visibly different rain, fog, wind, snow, wet paving, and cold light. Respect reduced motion and keep every effect inside the map canvas.
- Add functional MAIN01 handoffs using physical props such as proof sheets, type, ink, paper bundles, binding cord, subscriber receipts, and sealed return parcels. Inventory changes must follow an actual choice or interaction.
- Record asset URLs, rights, dates, hashes, and intended use in the checked-in asset provenance record. Clearly label the 1850s image as offline visual reference, not scene evidence.

## Constraints

- Preserve source-first historical provenance, fixed real outcomes, existing save compatibility, interaction geometry, and the game's paper/ink/wood/brass palette.
- Keep in-game copy limited to useful character speech and immediate play guidance.
- Do not use remote asset URLs at runtime. The local source image must remain optimized for deployment.

## Verification

- Verify the MAIN01 source asset and its rights record; test map/canvas effects and reduced-motion output.
- Replay MAIN01's normal route and one alternate route in the browser; inspect printshop, bookshop, street, document view, and mobile framing.
- Run `npm run check` and `npm run build:v33`; capture current screenshots and update the V47 status without claiming MAIN05 acceptance.
