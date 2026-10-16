# Circle Learning, Rank Examination, and Later-Life Simulation

**Status:** Approved; implemented
**Date:** 2026-10-16
**Scope:** Russian Lives: Act III, from the reading-circle hub through the ending epilogue.

## Objective

Turn the existing reading-circle and rank-exam choices into a coherent playable learning arc, then make the ending's fictional future feel like a legible life shaped by the player's actions. Preserve the existing source-first historical framing, route choices, five ending identities, and immutable historical outcomes.

## Player experience

1. At the circle hub, the player chooses to attend, decline, or attend while recording only book titles. Attending opens a short, atmospheric warehouse reading-room scene. The player learns concrete Russian context and concepts through sourced excerpts, concise explanations, and character discussion—not a philosophy quiz or ideological loyalty test.
2. At the exam hub, all players may sit the same factual exam. A player who attended the circle gets a brief recall/review transition. A player who did not attend may study the same examinable material in a public preparation sheet before taking the exam. This is fair access, not an easier or harder alternate test.
3. Answers are graded transparently against a checked-in answer key. The proposed threshold is at least 3 correct out of 5 to pass this fictional clerk's exam attempt. Passing makes the character eligible for promotion in this cycle; failing records an unsuccessful attempt. Deferring or spending the occasion helping Pavel remains a distinct route and does not fabricate a score.
4. The existing historical-person comparison remains first in the ending. It is followed by a vivid, readable, choice-shaped timeline of the fictional clerk's later life. It uses the exam result, circle participation, institutional actions, exposure, work record, and relationships already represented by route state. No new ending-affinity choices are added.

## Learning scene and content

- The warehouse scene is a fictional scene, explicitly framed as the protagonist's experience; it must not imply that the documented historical circle met at that invented place or that the protagonist was a real member.
- Teaching units cover only concepts the project can source: the historical setting and official educational/administrative context, the circle's documented intellectual subject matter, and a small set of concrete terms/claims later tested.
- Each unit points to checked-in source records. Historical claims, translations, and contextual explanations must have source IDs and precise provenance. Scene connective tissue is labeled fictional.
- Content is presented as a short sequence of readable paper/document beats with character reactions, not a generic list of cards. Include a clear continue/close action and allow reading to be revisited from the public preparation sheet.
- The exam has five questions with unambiguous factual answers grounded in the learning units and source record. No question grades political agreement, moral virtue, or literary interpretation. The answer key and scoring are deterministic and covered by tests.
- Public preparation sheet presents the same examinable material to circle non-attendees. It may summarize/reorder taught facts but may not add a new fact that the test assumes without teaching it.

## Exam rules and state

Proposed persistent state fields:

- `circleLearning`: `attended | declined | attended-notes` (existing route state remains canonical).
- `examOutcome`: `passed | failed | deferred | helped-peer | unset`.
- `examCorrectCount`: integer 0–5 only after an exam is submitted.
- `examAnswers`: five stable answer identifiers, persisted for save/load and restart behavior.
- `promotionStatus`: `promoted | not-promoted | pending`, derived from exam outcome; do not independently mutate it.

Rules:

- `EXAM-SIT` opens preparation/review, quiz, and result. Circle attendance changes only the review presentation, never question set, answer key, threshold, or availability.
- A passing result records promotion in this fictional character's administrative path. A failing result records no promotion in this cycle. Neither result changes real historical events or dates.
- `EXAM-DEFER` remains an explicit deferral with no score and pending promotion status; `EXAM-HELP-PEER` remains a distinct action with no score and pending promotion status. The existing branch graph must not force those actions to masquerade as a pass/fail.
- Result copy explains the immediate fictional consequence and distinguishes it from immutable historical context. No hidden affinity score is exposed.
- Save/load round-trips exam progress safely; restart clears it. Existing saves migrate without losing already recorded route choices/evidence. Legacy endings remain isolated.

## Later-life simulation

- Keep the existing historical-person comparison and factual biography presentation. Add the simulation after those historical facts, with a visible transition from documented history to imagined biography.
- Generate a deterministic timeline of approximately 6–8 dated or age-marked episodes spanning several years, drawn from a checked-in template/data model rather than free-form model generation. Each episode reflects established state (promotion, exam result, official/private records, circle action, subsequent work choices, and relationships) without pretending that invented events are historical facts.
- The timeline should show changes over time, not repeat the ending summary in prose. Use restrained motion and a clear pause/continue or next-period control; optional speed controls are secondary. The user can replay it without losing the ending.
- Every historical assertion shown alongside it is source-backed. Every imagined episode is labeled as the fictional clerk's possible life. Real historical people retain their documented outcomes and are not assigned invented interactions as fact.
- Reduced-motion mode renders the same timeline as a static, navigable sequence. Keyboard and touch controls remain available.

## Narrative, UI, and accessibility

- Preserve the established paper, ink, wood, and brass visual language; the document remains the focal object. The warehouse can shift lighting/material atmosphere but should not become an unrelated dashboard or reduce legibility.
- Fit the learning scene, exam, and ending at desktop and mobile-like viewport sizes. Scroll remains available where needed; no choice, answer, or continue control may be clipped behind fixed bars or overlays.
- Provide visible progress, answer selection state, submit/continue affordances, and a recoverable path if a player reloads mid-exam.
- Korean instructional copy should be concise, conversational, and direct. Avoid unsolicited caveats and generic explanatory filler.
- Dialogue must preserve character-specific speech register and rhythm. Learning scenes should sound like people discussing a text, not lecturers delivering a lore dump.

## Historical integrity and provenance

- Historical dates, events, and real-person outcomes remain invariant across all route vectors.
- No invented dialogue, circle attendance, exam result, promotion, or later-life episode is represented as a documented historical fact.
- New teaching claims and question answers require checked-in source records, stable source IDs, and exact source ranges. RU/KO quotations remain aligned with verified provenance. No fabricated bridge text is allowed.
- Any literary borrowing remains separately tagged as `LITERARY_BORROWING` with author, work, original Russian, edition/source URL, and this project's Korean translation; it is never presented as historical testimony.
- The public study sheet, teaching units, questions, answer key, result copy, and ending timeline all participate in the source/provenance audit.

## Acceptance criteria

1. Circle attendance enters the warehouse learning sequence; decline and notes choices remain valid and continue through the same graph.
2. All circle choices can reach the exam. Non-attendees can access the public preparation sheet and sit the identical five-question exam.
3. Each question maps to a taught fact and verified source record; the answer key is deterministic; score and pass threshold are tested at boundary values (2/3 correct).
4. Pass, fail, defer, and help-peer produce distinct, accurate state and result language. No deferral/helper route is accidentally scored.
5. Save/load, restart, route callbacks, the five exact ending IDs, source drawer, H-key evidence overlay, typed-response classification, courier traversal, and legacy isolation continue to work.
6. Each ending retains the historical-person comparison, then displays a state-shaped, multi-period fictional-life timeline. Historical and imagined material are visually and textually distinct.
7. Every route vector remains traversable; historical anchors are byte-for-byte invariant across vectors.
8. The ending contains no active dialogue panel beneath or over the simulation.
9. Desktop and mobile-like layouts have no clipped controls or accidental nested-scroll traps. Reduced-motion provides the complete static equivalent.
10. `npm run check` and relevant focused tests pass; the app is run and visually checked at desktop and mobile-like widths.
11. Final dialogue review fails if speakers are distinguishable only by content while sharing effectively identical endings, rhythm, and vocabulary.

## Out of scope

- Changing or adding the five ending IDs or real historical outcomes.
- Adding new affinity/ideology choices or revealing hidden ending mechanics.
- Changing the game's overall visual identity, unrelated scene content, or expanding the historical cast.
- Treating the fictional clerk's exam/promotion/timeline as biography of a real person.

## Open implementation detail

The specific five questions and their source passages must be authored only after inspecting the checked-in source corpus and verifying whether it supports teachable, unambiguous facts. If a fact cannot be supported, replace it with a supported fact; do not infer or fabricate. The timeline's episode templates likewise must be aligned to existing route-state fields and source-backed contextual boundaries during implementation planning.
