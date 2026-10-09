# Russian Lives: Act III — V28 final gate report

`V28_COMPLETE:NO`

`PUBLIC_RELEASE_READY:NO`

`HUMAN_PLAYTEST:PENDING`

`INDEPENDENT_REVIEW:PASS (visual/UX, narrative/character, historical/state; P0/P1=0)`

The character-driven VN implementation and automated evidence are present. The V28 contract is not yet fully closed because the required human playtest has not happened; a separate 200% text-zoom capture remains a P2 evidence gap.

Automated evidence records 24 authored cases, 596 graph nodes, 72 spoken choices, five ending screens, chronological browser entry into all 24 cases, four viewport states, gold-slice captures for C01/C07/C17/C24, save/reload, live/replay state parity, five ending routes, provenance, copy inventory, Korean naturalness, and legacy-route browser evidence. The active-contract audit checks all 72 choices for immediate audience/record/risk direction, all 120 source excerpts for aligned context fields, and the 4×6 speech-register matrix. Three independent reviewer reports directly inspected the current source and raw screenshots and found no P0/P1 issue. See `docs/v28/ACTIVE_CONTRACT_AUDIT.json`, `docs/v28/V28_ACCEPTANCE.json`, `docs/v28/SCHEMA_AUDIT.json`, `docs/v28/CANONICAL_TIMELINE_AUDIT.json`, `docs/v28/REPLAY_AUDIT.json`, `docs/v28/ENDING_BROWSER_EVIDENCE.json`, `artifacts/v28-browser/V28_BROWSER_EVIDENCE.json`, and `docs/v28/subagent_reviews/`.

The final ZIP is an evidence package; it does not claim the release gate passed while `HUMAN_PLAYTEST` remains pending.

## Latest regression repair

The existing browser QA reproduced a mobile legacy-route overflow after entering V28 and then opening the periodical review: the stale `v28-runtime` class made the 390×844 app shell 848px tall. `renderGold()` now removes that V28-only class before mounting a legacy scene. Fresh `docs/v21/BROWSER_QA_V21.json` evidence is PASS for desktop and mobile with no page errors, and the three independent reviewers re-checked the current runtime and screenshots with P0/P1=0.
