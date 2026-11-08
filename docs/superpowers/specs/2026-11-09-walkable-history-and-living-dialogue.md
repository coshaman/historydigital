# Walkable Historical Events and Living Dialogue

## Intent

Turn the three entries in `rpg/data/v38-historical-events.json` from two-round text panels into playable, walkable events in the game's existing tile-world. Improve free-form NPC conversation so a character can surface a concrete, date-appropriate event, ask a natural follow-up, and carry a player-approved incident forward into later conversation and quest play.

## Goals

- Each historical event takes roughly four to five minutes at a normal reading pace and includes movement, discovery, multiple conversations, side objectives, and an event-level decision.
- Each scene uses at least three traversable areas or distinct physical zones and at least eight present, moving game characters. The player can approach and talk to them, and may possess multiple eligible composite characters during the scene.
- Decisions affect the fictional composites' routes, safety, relationships, evidence, and follow-up content. Documented historical facts and outcomes remain fixed.
- Historical claims and dialogue facts point to checked-in source records with exact ranges. Composite side stories cannot be narrated as attested testimony.
- An open player question can lead to a concrete, historically supported matter already available to that character. The AI may also offer a clearly internal, saveable fictional incident hook when no attested incident fits; the player can reject, remember, or pursue it as a multi-step quest.
- The original campaign save, date, possession, resources, and NPC schedules are restored after leaving the historical session.
- Korean dialogue directly answers the player's last turn, varies by character and relationship, and avoids old concept notes or meta talk unless the player actually asks about paperwork or procedure.

## Non-goals

- Changing the outcome of the Decembrist uprising, the 1836 premiere, or the 1861 reform.
- Presenting invented composite characters, speech, or side incidents as historical fact.
- Replacing the current world simulator or requiring a new graphics stack.
- Making AI-generated historical claims authoritative; they remain source-gated.

## Approaches

1. Add more rounds to the current text event catalog. Rejected: it remains a text panel and does not make the map, movement, or NPC simulation playable.
2. Mutate the main campaign state into each historical year. Rejected: this risks corrupting the 1847–49 campaign, save migration, host resources, and schedules.
3. Recommended and selected: create an isolated historical-session snapshot that reuses the current canvas renderer, movement, collision, proximity, NPC, and interaction systems. Add scene maps and event data, then restore the untouched campaign snapshot on exit. This reuses proven gameplay while keeping the different eras and their state isolated.

## Scene shape

Each scene has an approach, a central event area, and a connected aftermath/social area. Players can walk between people and interactables; event objectives point to people or objects in-world. Each scene supports at least three optional leads, a joined multi-person conversation, a role-specific possession decision, and a closing choice. Playtime is created by traversal and discovery, not artificial waits.

- **Senate Square, 1825-12-26 Gregorian / 1825-12-14 Julian:** approach street, square, and evacuation/river edge. The oath and military confrontation remain fixed. Side content concerns getting civilians and a composite household through the crowd, locating a delayed order through its actual route, and deciding how to respond to a wounded composite after the documented clash. At least ten composite and historical-presence actors occupy distinct routes.
- **The Government Inspector premiere, 1836-05-01 Gregorian / 1836-04-19 Julian:** theatre approach, lobby/backstage, and post-performance street. The premiere and Gogol's documented involvement remain fixed. Side content covers a lost ticket/seat, a prop or costume failure, and contrasting responses from audience members and theatre workers. A multi-person post-performance conversation leads to a choice about what the player does with the reactions and the published text.
- **Emancipation Manifesto, 1861-03-03 Gregorian / 1861-02-19 Julian:** publication/approach street, public reading area, and service/market lane. Correct the current catalog's erroneous `1861-03-17` machine date. The signed manifesto and promulgation remain fixed. Side content lets composite urban and rural-origin characters deal with lodging, work, travel, and understanding the separate regulations; the event avoids claiming that all peasants immediately received land or identical terms.

## Living dialogue and event memory

The police-sergeant card currently makes separating report from witness the character's objective, fear, worldview, lexicon, and persistent life arc. Those repeated cues overwhelm general conversation and caused the observed generic line. Replace them with a more complete character voice and allow multiple topics. For a direct question about current affairs, the server provides only date-eligible, source-backed public event leads and character-specific knowledge. If no such lead fits, the character may ask what the player heard or offer a locally plausible but internally tagged fictional matter.

AI event hooks use a strict schema: title, immediate situation, present participants, physical location, playable actions, and source IDs or `FICTIONAL_COMPOSITE`. The game validates character/map/time/length limits, stores only accepted hooks in the save, exposes them as quests, records outcomes, and supplies a small number of unresolved/recent hooks to later dialogue. Historical source IDs are checked against the scene allowlist. Model output cannot edit core history, create source claims, move NPCs, or resolve a quest by itself.

## Persistence and presentation

Historical session state is separate from `v33-rpg-save`; exit returns the exact campaign map, position, clock, embodiment, and UI context. Accepted incident hooks and their resolved outcomes belong to the ordinary local save schema, are migration-safe, and appear in the journal without internal validation terminology. Each scene has a clear event banner, visible destinations and interactable emphasis, concise objectives, and a source/history closeout. Scene copy stays focused on play.

## Validation

- Unit tests assert three playable scene definitions, minimum actor and area counts, traversal/objective connectivity, role gating, branching outcomes, save isolation, date conversion, and immutable historical anchors.
- Dialogue tests reproduce the Ivan open-ended question, prove it no longer defaults to the old record motif, verify grounded event surfacing or a natural clarification, validate accepted/rejected event hooks, and confirm hook continuity after save/load.
- Browser tests click through all three event paths at desktop and mobile-like widths, physically move between multiple zones, converse with at least four people per event, possess at least two eligible characters, complete side objectives, make a choice, exit, and confirm the original campaign save is byte-equivalent.
- `npm run check`, a production build, and browser checks pass with zero page errors or horizontal overflow.

## Historical/source basis

- 1825: GARF Decembrist documents and eyewitness evidence, beginning with the Senate Manifesto and the investigation record, including the record of the uprising and subsequent fixed historical sequence.
- 1836: Alexandrinsky Theatre premiere record; Gogol's April 29 letter to M. S. Shchepkin; public-domain 1836 play text where relevant.
- 1861: Presidential Library scan/record of the February 19 Manifesto, RGIA fond 1329, inventory 1, file 730, folios 27–41 verso; GARF promulgation and implementation documents. The source distinguishes the February 19 Julian date from March 3 Gregorian.

## Decisions left to implementation

Reuse the existing 16×16 tile scale and renderer. Use composite event-era characters with reusable game sprite style; named historical people are non-possessable and only appear where checked sources support their presence. Store any unverified local incident strictly as a fictional gameplay hook. Keep every historical event's source notes in the checked-in historical source ledger.
