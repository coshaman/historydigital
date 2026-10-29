# The Borrowed Lives — V33 Playable Design

## Player-facing loop

Walk the 1847 Petersburg street → approach a person or object → inspect what this body can know and do → possess a nearby host → pursue that host's local objective with their own money, access, inventory, relationships and private knowledge → read a source available to that host → make a physical quest choice → release the host or move to another reachable body → compare the same event across witnesses → close the archive with one of the five existing endings.

## Runtime boundaries

- `WorldState`: chapter/date/map, immutable historical events, unlocked doors, shared discovered sources, witnessed facts, ending eligibility and the possession/action ledger.
- `PlayerState`: observer position, current embodiment, cross-perspective notes, current goal and save version.
- `HostState[id]`: body position, job/rank/legal access, designed-estimate livelihood values, money, belongings, private/witnessed facts, relations, schedule, strain and quest flags.
- `reduceWorldAction(state, action)` is the sole gameplay mutation path. AI may phrase an NPC response and pick among whitelisted response intents; it cannot complete a quest or edit any state.
- AI session history is keyed and stored server-side. Only that host's witnessed knowledge is composed into its prompt. Player-discovered evidence is not silently copied to every host.

## Presentation and controls

- Browser-native Canvas2D with authored PNG tile/sprite atlases and Tiled JSON maps; 16×16 tiles, 16×24 or 24×32 character frames, orthogonal top-down view.
- Desktop: WASD/arrows move, E/Space interact, Shift short walk, M map, J journal, H evidence, Esc pause. Mobile: on-screen directional pad and one contextual action control, with dialogue/source controls kept reachable at 360×800.
- The pixel language uses damp stone, painted shop fronts, paper, iron railings, ink and winter light. Real St Petersburg and literary spaces use distinct map palettes and explicit in-world archive markers. No CSS-drawn map, generic medieval tiles or fabricated historical portraits.
- The historical source viewer distinguishes contemporary primary source, later interpretation, and literary text. Every map asset/source excerpt has provenance metadata.

## First playable slice

Phase 1 ships the Nevsky-edge street and a printshop connected by real doors; the observer and four varied fictional residents; one complete possession→objective→dialogue→physical action→release loop; source inspection; save/load; collision and mobile controls. The player must have at least two minutes of meaningful movement and interaction before later systems are widened.

Subsequent phases add Chancery and courtyard, cross-host replay, an explicitly reconstructed historical host, a separate literary realm, authored RPG action gates, V32 AI/fallback adapter, the three historical arcs, and evidence-weighted five-ending resolution.

## Design rulings

- A small in-house Canvas2D runtime is selected over Phaser because the committed app has no bundler or game framework; Tiled JSON, collision, camera, sprites and touch can be supported directly without another runtime-sized dependency. Revisit only if the implemented prototype demonstrates a capability gap.
- Historical and literary hosts are labeled reconstructions and can only appear at date/source-valid locations. Literature never becomes a real witness.
- UI and logs may show approximate money/risk only as character-specific in-world context; they never present invented values as measured historical facts. Such values are `designedEstimate` in character data.
