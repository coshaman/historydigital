# Main Route Branching and Unified Reading Experience — Design Specification

## Status and relationship to prior design

This specification expands the route scope in `docs/superpowers/specs/2026-10-10-v42-ideological-history-layer-design.md`. It preserves that design's history-of-ideas themes, source provenance rules, speech-register audit, immediate-choice disclosure, and five-ending contract. It supersedes the V42 constraint that the existing MAIN20 phase machine remain the sole route owner: the active journey will be represented as a source-linked scene graph so substantial choice branches can be authored and verified as first-class routes. Existing runtime presentation and save/load behavior should be retained where compatible; no legacy/archive graph becomes active by itself.

## Goal

Make the active Russian Lives: Act III route feel like a lived, choice-shaped 1840s Russian life rather than a fixed sequence of document checks. Unify newspaper reading and choice presentation; add at least 30 genuinely new, contextually verified primary-source records; create four consequential three-way decisions whose consequences change immediate events and dialogue as well as later scenes and endings; and improve the 3D-room/window composition without displacing the document as the focal object.

## User intent and constraints

- Players should encounter ideas and philosophical disagreement through people, documents, institutions, and daily decisions, not an abstract ideology quiz.
- The player should be able to inhabit multiple distinct narrative combinations. Four three-way pivotal choices produce 81 possible choice vectors; the route must preserve and express those distinctions in the story, not merely in ending scores.
- Branch-exclusive events may include a reading circle, a civil-service/history examination, literary reading and character-choice discussion, everyday obligations, and historically plausible responses to revolutionary news. A character in imperial Russia must not be falsely depicted as participating in an event they could not physically or historically reach.
- Real historical outcomes are immutable. Only the fictional clerk's actions, exposure, work record, relationships, and private route may vary.
- Project `AGENTS.md` requirements remain binding: source-first authoring, E02/E04/E07 playability, paper/ink/wood/brass visual materials, source drawer, H-key evidence overlay, typed-response classification, five exact endings, mobile/reduced-motion support, courier traversal, `npm run check`, and desktop/mobile runtime review.
- Existing unrelated untracked audit, screenshot, and archive artifacts are user-owned and must not be staged, rewritten, or removed.

## Design

### 1. Active narrative graph

Replace the fixed active-route sequence as the authority for scene transitions with one versioned, validated scene graph. The graph is the single active route source; archived/legacy graphs remain isolated and are not merged wholesale.

The normal route contains four pivotal choice hubs. Each hub presents exactly three consequential options. A choice is stored as an explicit branch key (not inferred only from affinity), and the route state preserves all four keys. Each option has:

- an immediate, authored branch-only scene or event before the next common historical anchor;
- at least one changed reaction, prop/document handling consequence, or relationship beat in the next hub;
- a later callback that recognizes the concrete choice without revealing hidden mechanics;
- an evidence/source prerequisite when the choice depends on reading a source;
- immediate non-spoiler action disclosure: likely audience, private/official record, whether a document leaves the office, and broad accepted risk, as applicable.

The four choice keys form 3^4 = 81 possible route vectors. This is not a promise to hand-write 81 independent novels: each vector is a distinct assembled story made from its four path-specific event branches, state-conditioned transitions, and cross-choice callbacks. No two choices may silently collapse into the same immediate scene merely because they share an ending affinity. Branch state persists through common anchor scenes. A historical anchor may be shared only when it is documented as an invariant and the surrounding player experience still acknowledges prior choices.

All 81 vectors must be enumerated by an automated route test. The test proves every vector reaches a valid ending, visits the expected branch-only content at each hub, keeps source prerequisites valid, and has no dead end or silently overwritten state. Add pairwise interaction coverage so earlier choices can alter later branch dialogue/event variants, not only append isolated branches.

### 2. Branch event families

Author at least one playable event family for each of these, distributed among choice branches rather than offered to every player as a checklist:

1. **Reading circle and dangerous conversation:** invitation, attendance/refusal, handling of notes, and trust/exposure consequences. Do not claim that the fictional clerk is a documented historical member of a real circle.
2. **Rank/history examination:** prepare, sit, postpone, or protect another candidate; the exam's institutional stakes and rules must come from contemporaneous records. A player's result may vary; actual law and named historical outcomes do not.
3. **Literature in company:** a character naturally recounts a public-domain Russian work and asks what the player thinks a character should do or what the player would do in that situation. Quote/adapt only verified Russian originals; tag every such excerpt as `LITERARY_BORROWING` with author, work, exact original wording, edition/source URL, and this project's Korean translation. Never attribute borrowed text as historical speech and never copy modern Korean translations.
4. **Ordinary life and obligation:** plausible work, household, money, friendship, travel, and reputational pressures with source-backed context where a factual claim is made.
5. **Revolutionary news and response:** allow a fictional character to assist, conceal, report, or refuse a credible indirect action in relation to 1848 European events only when supported by geography, chronology, and the character's position. Do not relocate the Russian clerk into a foreign revolution without a separately source-verified, historically plausible route. Keep the European events themselves fixed.

The event set should feel larger than censorship and document comparison, while remaining in the existing Act III's chronology and playable scope. No invented historical bridge text.

### 3. Source corpus growth and verification

Add at least 30 distinct primary-source records not already present in the checked-in corpus. Before counting, build a canonical baseline from the active source register and all checked-in source manifests/bundles, normalize identifiers and URLs, and deduplicate exact editions/records. A different URL or translation of an already represented witness does not count as a new source.

Each admitted record must include a stable `sourceId`, source class, author/issuing body, work/document title, original date, edition/holding institution, stable URL or shelfmark, exact page/folio/article/paragraph locator, witness-language text or a verifiable route to its image/text, contextual range sufficient to understand the speaker/claim/dispute, Korean translation or clearly marked contextual summary, translation status, and first in-game availability date. Record whether direct witness text, later documentary edition, or later secondary context is used. Do not present secondary scholarship or finding-aid metadata as a contemporary primary statement.

The 30+ set must support the game's current history-of-ideas direction and playable life, with deliberate coverage across: civil service/rank/examination; education and access/control; press/censorship and institutional responsibility; philosophical and literary disputes; circles and associational life; ordinary social/material conditions; and 1848-49 European events as known/handled in Russia. At least one verified source must support each new event family. The count is achieved only after each candidate's original text or archival image/range has been checked and its relevance, date, and provenance reviewed; search results and catalog titles alone do not count.

No fact, dialogue proposition, scene outcome, asset caption, or choice consequence may lack a checked-in source record or be explicitly labeled fictional interpretation. Do not alter the project's existing core source history unless the new witness review proves an error and the correction is separately documented.

### 4. Unified newspaper and choice language

Use one shared paper-and-ink component language for source reading and decision presentation: matching paper stock, margins, border treatment, typography scale, ink/brass accents, annotations, and responsive width rules. Keep newspaper text the visual and narrative focal point; keep choices visibly connected to the article or immediate conversation rather than presenting a generic dashboard card. Reuse a shared layout/token layer; do not duplicate parallel newspaper-vs-choice CSS treatments.

The article's original/translation layout must remain legible at desktop and narrow widths, with a scrollable document viewport and obvious reading completion/continue behavior. Choice cards/buttons must remain keyboard-operable and touch-sized; labels and practical-direction subcopy must not clip or compete with the newspaper. The information disclosure must not leak affinity, hidden scores, or guaranteed endings.

### 5. Room, 3D desk, and window composition

Keep the restored 3D desk and all established desk objects visible on the active route. Reposition the window higher and attach it visually to the wall architecture; controlled viewport cropping is acceptable only if the window still reads as wall-mounted and does not occlude playable objects, reading text, or controls. The room should keep the document centered as focal object, preserve legibility of side props, and avoid fixed overlays crossing the article/dialogue/choice surfaces. Respect desktop, laptop, tablet, and mobile aspect ratios; do not solve clipping with a global page-level overflow lock.

## Data and state invariants

- `routeChoices` (or the final schema-equivalent field) stores four stable branch IDs in order and is serialized/restored by save/load.
- Branch-only scenes declare their entry predicate and the exact state dimensions they read/write.
- History facts and dates are immutable. Branch state can affect only the protagonist's choices/exposure, official and private traces, relationships, and fictional outcomes.
- Source records are referentially valid; every cited scene/dialogue/choice consequence points to a resolvable source or is marked fictional interpretation.
- Existing five ending identities and historical analogue facts remain exact. Endings may reflect the new state, but all five remain reachable through multiple coherent choices and no single affinity guarantees an ending.
- Legacy cases and old route bundles remain inaccessible to the active route unless explicitly migrated, provenance-audited, and tested.

## Dialogue and literary quality

Carry forward the V42 speech-register matrix for Alexei, Ekaterina, Pavel, and the protagonist across first meeting, ordinary work, privacy, conflict, increasing intimacy, and formal institution. Distinguish voices by address, sentence length/rhythm, vocabulary, interruptions, and register, not topic alone. Review every new and touched line in its scene context. Fail the dialogue audit if two characters use effectively identical sentence endings and rhythm in the same relationship/situation. Korean should be contemporary-readable but should not erase period/social register. Avoid ornate exposition disguised as dialogue.

## Failure handling and compatibility

- Invalid/corrupt saved route choices fall back to the nearest valid prior scene without erasing unrelated save data; report a recoverable notice.
- Missing optional source artwork falls back to the source's paper rendering without blocking progression.
- If a source item is not available in full text, it cannot substantiate a direct quotation. Either locate an accessible verified witness or use a clearly labeled paraphrase from an inspected authoritative edition.
- If a branch prerequisite was not met, offer a historically and narratively valid alternate action; never leave a blank scene or a disabled-only screen.
- Preserve restart, save/load, evidence overlay, source drawer, typed-response flow, courier traversal, reduced motion, and existing ending rules through migration tests.

## Acceptance and verification

1. `npm run check` passes, including validators for graph edges/state, source IDs/provenance, no history mutation, and citation resolution.
2. Route enumeration exercises all 81 four-choice vectors. Each vector yields four branch-recognizing event/reaction beats, valid transitions, and a reachable ending; no all-vectors convergence before ending resolution.
3. Each required event family is reachable only on appropriate branches at least once, with source-backed premise and no false historical membership/participation claim.
4. An evidence audit confirms at least 30 net-new unique primary records beyond the canonical checked-in baseline, with inspected original ranges, exact locators, aligned translation, and source-to-scene usage.
5. The choice and newspaper surfaces visibly share the same design tokens/component language and can be completed with mouse, keyboard, and touch.
6. Browser visual/interaction review at 1440x900, 1024x768, and 390x844 verifies no clipped article, choices, dialogue, desk, window obstruction, or inaccessible continuation; internal article scroll remains available.
7. Reduced-motion, restart, save/load, source drawer, H overlay, typed-response classification, courier traversal, all five endings, and legacy isolation pass regression checks.
8. A dialogue review checks every authored branch line in context, including character registers and literary-borrowing provenance; no source text is falsely represented as character's historical speech.

## Open items for implementation planning

- The exact implementation file boundaries and final graph schema must be confirmed against the runtime during planning, without changing the data invariants above.
- The 30+ source ledger and its coverage-by-event matrix are required deliverables; no minimum per category is invented here, but every listed coverage family and every event family must have at least one verified supporting record.
- Whether the title/layout retains current MAIN20 branding is a presentation detail; route content, save migration, five ending identities, chronology, and source provenance are not negotiable implementation details.
