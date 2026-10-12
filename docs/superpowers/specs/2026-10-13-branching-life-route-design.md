# Branching Life Route Design

## Purpose and scope

Expand Chancery of Ink from four sequential three-option hubs into a lived-in, choice-reactive narrative in which the clerk's immediate social and institutional experience changes with the player's prior decisions. The main route must retain its verified historical chronology and immutable real-world outcomes. Player agency changes only the fictional clerk's exposure, relationships, records, and private route.

This is the first subproject in a larger effort. Separate follow-on designs will cover (1) at least 30 additional verified primary-source records and their narrative use, and (2) a unified newspaper/choice document system plus the Petersburg window and overall room layout. Those deliverables remain part of the overall objective and are not declared complete by this specification.

## Current-state evidence

- `narrative/ACT_III_BRANCH_ROUTE.json` has four ordered hubs (`H1-CIRCLE`, `H2-EXAM`, `H3-READING`, `H4-NEWS`) with three primary choices each.
- The route contains 12 immediate branch events and 54 pairwise dialogue interactions. Those interactions respond to individual earlier choices, but the data does not define a separately authored event beat for every complete four-choice history.
- The current route ordering interleaves E02, the February 1847 Gogol/Belinsky document, E04, the July 1847 follow-up, the four hubs, and E07. That chronology and the five existing endings must remain intact.
- `main20-runtime.js` owns branch presentation and save state; `main20-branch-graph.js` validates and resolves the graph; `scripts/main20-branch-graph-test.mjs` enumerates the 81 choice vectors.

## Chosen approach

Use a prefix-conditioned story tree. Keep four major decision hubs with exactly three options each. After each decision, resolve an authored scene node keyed by the complete choice prefix, not just the latest choice or one prior choice. This preserves a comprehensible four-decision structure while making every full route an actual, testable sequence of distinct narrative beats.

For four three-option decisions, author route-prefix beats at each level:

| Decision depth | Distinct prefixes / scene beats |
| --- | ---: |
| 1 | 3 |
| 2 | 9 |
| 3 | 27 |
| 4 | 81 |
| **Total** | **120** |

The runtime may share presentation components and invariant dialogue, but each prefix must resolve to an explicit event node with authored, prefix-specific consequences and at least one distinguishable immediate story beat. No pair of complete routes may collapse to the same sequence of four event-node IDs. Ending variation remains governed by observable choices, evidence, and relationships rather than by hidden route labels.

Alternatives considered:

1. **81 fully duplicated transcripts:** maximal independence, but duplicates common context and makes historical and dialogue QA unnecessarily difficult.
2. **Current sequential hubs with pairwise callbacks:** economical, but does not ensure combination-specific scenes and does not satisfy the requested depth.
3. **Prefix-conditioned nodes (selected):** each scene responds to the full known history, all 81 routes are distinct, and shared display/runtime logic does not merge their authored events.

## Narrative and historical rules

- The four hubs stay at circle invitation, civil-service examination, literary conversation, and public/news action. Their options may be revised to create meaningful ideological and practical differences, but every choice must disclose its immediate action, audience, record/visibility, document movement, and broad immediate risk before selection.
- Each choice must trigger a branch-only event or encounter that would not appear on the other two choices at that hub. The event should change what the player knows, who is present, what can be recorded, or what next action becomes possible; a renamed copy of shared dialogue is insufficient.
- Later events must use the complete prefix. For example, the same exam decision after attending a circle and after declining it must be a different authored encounter with distinct dialogue and social/institutional context.
- Candidate lived-in events include a private circle meeting and its consequences; a rank examination or a choice to coach a colleague; a literary reading in which the character recounts a public-domain work and asks what the player would do; and a public/private response to political news. Any revolutionary action must be historically plausible for this fictional clerk and date. The story may not imply that the protagonist changed an actual revolution, prosecution, publication, or state decision.
- Every historical assertion and source excerpt remains attached to a checked-in source record. Fictional dialogue is clearly represented as fictional dialogue and linked to the historical material that grounds its setting, not misattributed as a quotation or testimony.
- Character voices must continue to vary by relationship and situation. Borrowed literary lines, if later used, must obey the existing provenance and public-domain policy.
- Each authored node has a stable ID, exact required choice prefix, predecessor/hub association, date/location, speaker-tagged Korean dialogue, source IDs, visible callback behavior, and an immediate next action. Missing or ambiguous resolution is an error, not a silent fallback to generic dialogue.

## State and data flow

1. A hub presents three consequence-disclosed choices.
2. Selecting a choice appends its ID to the saved route prefix and records the visible action, witnesses, record mode, risk disclosure, source IDs, relationship/evidence effects, and callback key.
3. The resolver validates the prefix and returns exactly one matching authored event node. The event runs as a short playable scene; its dialogue and any branch-only sub-event choices are presented before the route advances.
4. Advancing preserves the full prefix and loads the next hub. At depth four, the route enters E07 as it does today, while prior choices remain available to ending resolution and final recap.
5. Restart clears the prefix and route-specific event history. Save/load must preserve a valid prefix exactly; malformed, duplicated, out-of-order, or unknown choice IDs are rejected or migrated without inventing choices.

The graph validator must require exhaustive coverage for every valid prefix, prohibit duplicate prefix/node mappings, verify that each node's sources and predecessor are valid, and fail on unreachable/orphan nodes. The route test must enumerate all 81 vectors, prove each resolves to four unique prefix nodes, and confirm historical anchors and all five endings remain reachable.

## Interfaces and files

- `narrative/ACT_III_BRANCH_ROUTE.json`: define the 120 prefix-conditioned scene nodes and their four-hub choice links; retain source and ending links.
- `main20-branch-graph.js`: validate prefix uniqueness/coverage, node reachability, chronology, and source references; resolve by full prefix.
- `main20-runtime.js`: persist and render the active branch node, event sequence, relationship/evidence writes, and return-to-hub transition; keep save/restart behavior deterministic.
- `scripts/main20-branch-graph-test.mjs`: exhaustively test all 81 routes, invalid prefixes, per-choice branch exclusivity, observable immediate disclosures, source resolution, and historical invariants.
- `scripts/v42-browser-acceptance.mjs` and a focused route replay harness: exercise every option at every depth, verify branch-only content visibility, check no missing next action, and reach E07/endings at desktop and mobile-like sizes.
- Dialogue/source audits: inspect every authored line for natural Korean register, speaker differentiation, source attribution, and no fabricated historical testimony.

## Acceptance criteria

1. Exactly four primary hubs remain, each with three consequentially distinct options.
2. All 120 valid choice-prefixes resolve to one and only one authored event node; there are 81 distinct complete four-choice route signatures.
3. Each choice immediately reveals a branch-only event and does not simply resume identical intervening dialogue.
4. Every route node and historical dialogue excerpt has resolvable provenance; real dates, events, and outcomes remain unchanged.
5. All 81 route vectors retain a valid path to the five existing endings, with no hidden score or route-affinity details exposed to the player.
6. `npm run check`, `npm run build`, and `npm run lint` pass; desktop, mobile, and reduced-motion browser checks show no dead controls, clipping, or route stalls.

## Out of scope for this subproject

- The 30-or-more additional primary-source records are a separate source-research and content-integration subproject. This route design reserves source IDs on nodes and requires each eventual event to use checked-in evidence.
- Visual unification of newspaper and choice presentation, window relocation, and overall room redesign are a separate UI subproject. The event renderer must expose a clean semantic boundary so both phases can use the same future paper component.
- Adding a dependency or replacing the existing runtime/save architecture is not required.

## Review checklist

- The goal keeps the requested four consequential choices and the full 3^4 route space rather than narrowing to samples.
- Historical outcomes are immutable and fictional scenes are not framed as archival testimony.
- Each choice produces a materially different immediate encounter and later beats depend on the complete choice prefix.
- Every source-bearing line/node is traceable, and no resolution failure is hidden by a default scene.
- Source expansion and UI/window work remain explicitly queued follow-on subprojects.
