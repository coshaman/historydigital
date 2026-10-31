# Play experience audit — 2026-10-31

This is an ongoing audit, not a claim that the game is finished or fun for every player.

## Evidence and changes

- Current source intercepted WASD and arrow keys at document level even when typing dialogue. Native inputs, composition, modified shortcuts, and focused controls now retain their keys; Escape still closes dialogue. Ending screens no longer forward keyboard movement to the world.
- Possession rendered `speechRhythm`, an authoring instruction, directly into the player's journal. It now shows the character's existing personal objective instead.
- Conversations exposed intent classifications, reply identifiers, session terminology, and raw fallback mode names. The journal now shows a short connection notice or the close-dialogue shortcut. Classification remains in the game ledger.
- Object descriptions were rendered twice when no host-specific thought existed, with an additional repeated disclaimer. Observation text now appears once, followed by the current character's thought when present. The record still labels observations as fictional props; historical quotation text and provenance are unchanged.
- Fourteen observation thoughts were revised to emphasize each character's immediate work and concerns rather than repeated evidentiary disclaimers.

## Verification

- Two focused presentation/input tests pass; they cover editable-input ownership and nonduplicated observation text. These are unit checks, not proof of browser key behavior.
- RPG core tests (31), historical-flow audit, `npm run check`, and static build passed after the runtime changes.
- The existing `clue-1440x900.png` capture corroborates the previous repetitive copy and visibly sparse street scene. It predates these changes and is not an after screenshot.
- Direct browser inspection was attempted, but the computer-use tool reported `Local browser use is disabled in Work settings`. No new click-through or screenshot is claimed.

## Still to inspect and improve

- Verify real typing, Korean composition, button activation, and Escape after enabling browser control.
- Authored offline conversation now has three distinct exchanges for each of nine speakable NPCs (27 total), with consumed topics removed and an explicit closing line. Runtime rendering still needs a browser pass.
- Review the street's repeated paving, building silhouettes, object readability, motion and ambience against the actual rendered game.
- Play the opening without prior knowledge and check whether the next useful destination is understandable.
- Recheck the complete campaign, evening learning, and endings for pacing, character voice and layout after the remaining improvements.

The current release ZIP predates this in-progress patch. Refresh it after the next rendered acceptance pass.

## Authored conversation follow-up

- Added `rpg/ai/authored-dialogue.mjs`. Fictional speech is project-authored and linked to the character cards; literary/historical reconstruction speech carries the existing source IDs and is explicitly not quotation or literary borrowing.
- Exact selected topics receive their authored answers; unsupported free text during connection failure gets a narrator prompt to choose a topic, rather than a fabricated understanding of the input.
- Conversation progress is keyed by embodied-player/NPC pair for the current browser session. It does not alter inventory, world events or ending outcomes. Reloading the page resets this transient conversation progress.
- The free-input form is shown only when a live session is available. A failed provider response switches the pair to authored topics; the UI explains the switch.
- Refined keyboard ownership: buttons retain native Enter/Space activation, but do not trap movement keys after a click. Editable fields and composition retain all input.
- Six presentation/dialogue unit tests and 26 AI runtime tests pass. The tests exercise distinct responses, finite topic exhaustion, unknown input, immutable progress, pair separation and key ownership; they do not establish rendered UX or live provider connectivity.
