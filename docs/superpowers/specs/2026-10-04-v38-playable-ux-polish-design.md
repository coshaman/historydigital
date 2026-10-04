# V38 Playable UX and Narrative Polish — Design Specification

**Status:** Conversational design approved; written specification pending user review.  
**Date:** 2026-10-04  
**Project:** Russian Lives: Act III / Chancery of Ink

## Purpose

Finish the current game as an understandable, immersive playable experience without replacing its stabilized historical reader, 20-minute main route, five-ending system, save/load behavior, source provenance, or responsive presentation. The work addresses four user-visible problems: the Petersburg window reads as a desk object instead of part of the room; play-area width shifts with dialogue; the player's role and scene transitions are unclear; and dialogue and choices are too stiff or opaque.

The focal experience remains the paper document on the existing desk. This is a targeted spatial, layout, and authored-copy polish, not a redesign or a new narrative system.

## Design principles and invariants

- Follow the repository `AGENTS.md`: source-first content; checked-in provenance for historical claims, dialogue, scene outcomes, and historical assets; immutable real historical outcomes; only the fictional clerk's exposure and private route may vary.
- Preserve the existing five endings and V37 ending convergence/resolver. Do not change choice effects, ending affinity, tie profiles, historical outcomes, or the ending algorithm to make copy changes fit.
- Preserve reader behavior, source drawer and evidence overlay, save/load and migration, actor/visibility behavior, reduced-motion behavior, and the existing document-on-desk visual language.
- Keep `narrative/MAIN_20MIN_DIALOGUE.json` as the single authored source for the main route's dialogue, scene transitions/captions, choice labels, and non-spoiler choice direction text. Do not synthesize authored lines in runtime code or duplicate them in a second manuscript.
- Keep historical source excerpts distinct from fictional characters' authored speech in both the interface and exports. Any new factual or historical assertion must have an existing checked-in source record; this task does not invent new historical events.
- Do not claim that the real player is a historical person. In-world, the player inhabits the role of a fictional low-ranking Petersburg clerk in the 1830s–40s; out-of-world, the player is experiencing that fictional clerk's records and choices. This wording reconciles V38's role-immersion request with the source-first framing in `AGENTS.md` and the current manuscript's modern-player frame.

## Approved design

### 1. Room-integrated window

Retain the existing Three.js desk, camera, interaction controller, and window-view roundtrip. Correct the scene composition so the window belongs to a continuous rear wall: verify camera framing and depth, then add or adjust the wall/opening/reveal layers and place the exterior view behind them. The wall must read as the room's back boundary, not as another rectangular prop resting on the desk. Remove the visual double-framing that makes the DOM window panel appear like a picture frame layered over a 3D frame, while keeping its visual language consistent with the wood/brass/paper scene.

Keep the existing window interaction and its state semantics: when opened, the document, dialogue, and choices are hidden or made inert as currently intended; when closed, the previous game view and document scroll position return exactly. Do not replace the window controller or introduce a new navigation/state model unless code inspection proves a narrow compatibility repair is unavoidable; any such exception must preserve its public events and roundtrip contract.

### 2. Fixed play geometry and legible phase cues

Use narrowly scoped main-route styling and existing containers. Establish stable width and height constraints for the play viewport, desk frame, scene heading, dialogue, choice panel, and reader at the four acceptance viewports. Dialogue length and number of choices must not change the outer play-area width. Long copy wraps inside its panel; if a bounded height is needed, overflow is handled within the content region without clipping controls or forcing the entire scene to reflow horizontally. Choice rows remain aligned and readable whether there are few or many options. Preserve a usable mobile reading order and touch targets.

Make the current phase explicit in the play area (for example, “대화 듣기”, “선택하기”, or “자료 읽기”) and show a concise scene caption at scene entry using existing authored scene/date/transition context. The caption should remain available through the scene's relevant beats, tell the player where/when they are and why this document or event follows, and yield visual priority to the source document while reading. Derive these cues from existing runtime phase and manuscript data; do not add save fields or new gameplay phases merely for presentation.

### 3. Role, tutorial, scene transitions, and dialogue authoring

The opening establishes, through a short caption and character dialogue rather than a system tutorial, that the in-world protagonist is a fictional junior clerk in 1830s–40s St Petersburg who handles documents and must decide what belongs in the official record, what to preserve privately, and whose account to trust. The wording remains clear that this is the role of the fictional protagonist, not a claim about the actual player or a documented real clerk.

Every main-route scene transition should make the passage of time and the next event legible: show the date (and place/time where the current authored data supports it), identify the next document/event, and explain briefly why it has come to the clerk. Use the existing scene order (C03, C06, C07, E02, E07) and historically valid chronology. Do not alter the underlying chronology or introduce later evidence as if it were available earlier.

Revise the main-route manuscript in `narrative/MAIN_20MIN_DIALOGUE.json` so dialogue is more readily understood and sounds spoken, while retaining a restrained historical-literary register rather than contemporary web-fiction slang. Keep clear voice distinctions: Alexei cautious, practical, and fluent in bureaucratic reasoning; Ekaterina direct, vivid, and capable of pressing an argument; Pavel perceptive about street-level conditions, lightly phrased but attentive to the stakes. Dialogue should establish context and consequence through character interaction rather than expanding into detached exposition.

Before each choice, make the immediate disagreement, stakes, and reason for choosing understandable. Choice labels should say what the player is doing (stance, trust, record method, or immediate action). Attach a concise, spoiler-safe description of the choice's direction (such as prioritizing official record, preserving a private interpretation, attempting a risky delivery, or delaying judgment to read more). After each choice, show an immediate reaction and the near-term tension or change, without promising a fixed ending or changing mechanical outcomes. Keep all these authored lines in the canonical JSON manuscript.

### 4. Verification, review, and delivery evidence

Verify the production build in a real browser at 1440×900, 1366×768, 390×844, and 360×800. At each size capture raw PNG evidence for: starting scene, first dialogue, first choice, first document reading, window open, a scene transition, a mid-route choice, and at least one ending. Also capture before/after desktop and mobile views for the wall-integrated window. Browser evidence must represent the actual production build, not a mock-only or development-only rendering.

For each viewport, compare the play-area outer width across a short and long dialogue and across different choice counts. Record measurements or a deterministic browser assertion alongside visual review. Exercise opening/closing the window while document/game state is present; verify visibility/inertness, focus/interactions as applicable, and exact restoration including reader scroll position.

Run and report the requested core checks: `npm run build`, `npm run real-build`, `npm run real-build-browser`, `npm run check`, `npm run lint`, and `npm run test`. Also run the repository's applicable existing regression gates after confirming their scope against the current scripts: V37 ending semantic exhaustive test, actor/visibility audit, save migration, historical regression, reader/readability regression, window roundtrip, and dialogue Markdown/TSV export parity. Do not treat a passing command as proof of a criterion it does not cover. If a named dedicated gate does not exist or does not cover the required behavior, add a narrowly scoped test or report the limitation rather than silently substituting an unrelated gate.

Generate Markdown and TSV exports from the canonical JSON after copy is final; verify their authored content and ordering against the source file. Create a review report that records build/test commands and outcomes, browser dimensions/states captured, layout measurements, window roundtrip results, export parity, known limitations, and a requirement-by-requirement completion table. Use self-review and label it as such; no independent reviewer is planned.

The external-review ZIP will include the changed code, canonical JSON manuscript, generated Markdown/TSV, before/after and acceptance raw PNG screenshots, browser/test evidence, and the review report. Include only relevant project/test assets needed to inspect the work; do not package `node_modules`, unrelated historical delivery ZIPs, or stale build outputs as if they were new evidence. Verify the final archive contents and open/extract it in a clean temporary verification directory before delivery.

## Scope boundaries

In scope: `three-desk.js` and narrowly relevant 3D composition; scoped rules in `styles.css`; presentation glue in `main20-runtime.js` only where necessary to render existing authored fields and phase cues; `narrative/MAIN_20MIN_DIALOGUE.json`; focused tests/evidence scripts; generated exports, screenshots, report, and review ZIP.

Out of scope: a full room or interface redesign; replacement of the main-route state machine; changes to historical events, source records, chronology, reader semantics, actor/visibility, choice effects, ending scoring/convergence, save schema, or ending prose; new gameplay systems; auto-generated dialogue; claims that automated or AI review is human playtesting.

If inspection shows an invariant cannot be preserved within these boundaries, stop and surface the concrete conflict before broadening scope.

## Acceptance criteria

The implementation is ready for final delivery only when all of the following have direct evidence:

1. The window reads as an opening in the room's rear wall at desktop and mobile sizes; it no longer reads as a framed object sitting on the desk.
2. Window open/close preserves and restores the expected game/document visibility and reader scroll state.
3. At all four required viewports, long/short dialogue and varying choice counts do not change the play area's outer width; copy and controls remain usable without clipping.
4. During the opening/first three minutes, a player can tell they inhabit a fictional junior clerk's role, understand the document work, and understand that choices concern recording, trust, preservation, and action.
5. Each scene transition makes date, event/document, and reason for the next scene understandable without violating chronology.
6. Choice wording states an understandable action/direction; its short subcopy is useful and spoiler-safe; immediate reactions reveal a plausible near-term response without changing outcomes.
7. Character voices are distinguishable and more natural while maintaining the period-appropriate register; historical sources remain clearly separate from fictional speech.
8. `MAIN_20MIN_DIALOGUE.json` remains the sole authored main-route manuscript; Markdown/TSV exports match it.
9. Existing source provenance, reader, history/chronology, actor/visibility, save/load, all five endings, and V37 ending convergence have no regressions.
10. `build`, `real-build`, `real-build-browser`, `check`, `lint`, `test`, and applicable focused regression gates pass, or any failure is explicitly reported and blocks a pass claim.
11. The specified raw browser screenshots, verification report, and independently extractable external-review ZIP are present and verified. Self-review is identified as self-review; human playtesting is not claimed.
12. There are no unresolved P0/P1 defects.

## Self-review

- **Placeholders:** No TBD/TODO placeholders remain in the design. Command-level scope for legacy regression scripts is intentionally to be verified against their current implementations before execution, not assumed from their names.
- **Consistency:** The fictional protagonist/out-of-world player distinction reconciles the role-immersion request with `AGENTS.md` and the current JSON frame. All presentation/copy changes preserve the V37 mechanics and historical invariants.
- **Scope:** This is one coordinated polish effort across room composition, layout, runtime presentation, and a single canonical manuscript; tests and evidence are part of its acceptance, not separate product subsystems.
- **Ambiguity:** “Window roundtrip” means restoration of the prior visible/inert state and reader scroll, not merely that the close button works. “Fixed width” is judged at each fixed viewport: responsive widths may differ between viewport sizes, but within a viewport they must not vary with dialogue or choice content. “Raw PNG” means direct browser captures retained unedited; annotated comparisons, if any, are additional and never replace the originals.
- **Review status:** Self-review complete. User review/approval of this written specification is still required before an implementation plan may be written.
