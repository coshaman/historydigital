# V33 possession RPG delivery status

Updated 2026-10-30 after browser verification of the circle, exam, campaign, ending, and later-life timeline flows.

## Verified locally

- `npm run acceptance:v33` passed on the current implementation after the possessed-character dialogue context change, including core and learning/exam tests, historical and asset audits, static build, repository checks, four-viewport browser smoke, five ending UIs, and five full campaign routes. The captured run is `artifacts/v33/V33_ACCEPTANCE_ROLE_CONTEXT_2026-10-30.log`.
- A fresh full Uvarov campaign browser run passed from the player's in-game route. It physically completed the 1847, 1848, and 1849 quests, made a reading-circle choice, completed the learning units, sat the exam, and reached the ending. The report is `artifacts/v33/CAMPAIGN_BROWSER_SMOKE_UVAROV.json`.
- The ending browser smoke passed all five ending screens. It checked the later-life timeline next/replay controls at desktop size, and the 360×800 mobile layout, reduced-motion behavior, scroll access to restart, and restart action. See `artifacts/v33/ENDING_BROWSER_SMOKE.json`.
- The existing campaign browser acceptance also runs circle/exam interactions in each route: attendance, notes-only attendance, declining, passing/failing, deferring, and helping Pavel. Route matrix logic checks retain the same questions and pass threshold regardless of attendance.
- The earlier full acceptance run and fresh extracted ZIP acceptance are recorded in `artifacts/v33/V33_ACCEPTANCE_2026-10-30.log` and `artifacts/v33/V33_ARCHIVE_EXTRACTED_ACCEPTANCE_2026-10-30.log`.
- The later role-context patch was tested through `npm run acceptance:v33` from both the source tree and a clean extraction of the current ZIP. Logs are `artifacts/v33/V33_ACCEPTANCE_ROLE_CONTEXT_2026-10-30.log` and `artifacts/v33/V33_ARCHIVE_EXTRACTED_ROLE_CONTEXT_2026-10-30.log`.
- The dynamic relationship-context patch also passed the full source-tree acceptance, including all four browser sizes, five endings, and five full campaign routes. Its log is `artifacts/v33/V33_ACCEPTANCE_RELATION_CONTEXT_2026-10-30.log`.
- After adding HTTP-handler/Durable Object coverage for allowlisted and invented relationship hints, the full `npm run acceptance:v33` suite passed again (exit code 0), including all five ending screens and complete campaign routes. Log: `artifacts/v33/V33_ACCEPTANCE_WORKER_RELATION_2026-10-30.log`.
- After adding server-derived, character-specific literacy and known facts to the AI role context, the full `npm run acceptance:v33` suite passed again (exit code 0): four viewports, five ending UIs, and five full campaigns. Log: `artifacts/v33/V33_ACCEPTANCE_EMBODIED_KNOWLEDGE_2026-10-30.log`.
- The AI dialogue context now includes up to 12 authored action IDs from the embodied character's saved ledger. Worker validation checks each quest/action pair is valid for that body and derives situation wording from repository data; invented and cross-character actions are rejected. Full acceptance passed with all five routes and four browser sizes. Log: `artifacts/v33/V33_ACCEPTANCE_ACTION_CONTEXT_2026-10-30.log`.
- The same full acceptance passed after extracting the 614-entry package into a fresh directory. The extracted run log is `artifacts/v33/V33_ARCHIVE_EXTRACTED_RELATION_CONTEXT_2026-10-30.log`.
- Dialogue and map browser checks passed at 1440×900, 1366×768, 390×844, and 360×800. The dialogue portrait is hidden until conversation begins, then its portrait loads; no page errors or horizontal overflow were reported.
- The game is deployed through GitHub Pages workflow publishing. Pages mode is `workflow`; workflow run `40971793027` succeeded for commit `a593ea0`. Public smoke verified the site, generated config, and build manifest return HTTP 200.
- The public build has no configured Worker URL. It correctly stays in authored offline mode; no live provider call is made.
- The Worker supplies each AI turn with the possessed character's authored occupation, social estate/rank, legal mobility, literacy, estimated wealth bracket and status, speech cues, motives, risks, taboos, and up to six static facts from that same character's checked-in private-knowledge list. It also accepts up to 12 unverified quest/action IDs, but only where the checked-in quest authorizes that action for the embodied character; outcome wording is derived on the server. Both static knowledge and action history are player-side context only and cannot be treated as facts known by the NPC. The Worker never accepts client-authored fact text or situation text. Exact money, current inventory, and quest state stay out of the prompt. Player motives remain private and cannot authorize game-state changes. Current group-level relationship statuses are unverified allowlisted tone hints only.
- The original initial-screen failures were caused by an incorrect JavaScript MIME type for `.mjs` and no redraw after asynchronous tilesheet load. Both are fixed and have focused regression coverage.
- The blank speaker portrait frame was caused by the flex display rule overriding the browser's native `[hidden]` behavior. The CSS now explicitly hides `.dialogue-speaker[hidden]`, with a browser regression assertion.
- `git diff --check` passed during the prior delivery verification.

## Scope and release limits

- Live AI remains `BLOCKED_NO_KEY / UNVERIFIED`: no production Worker URL, provider API secret, GitHub Actions variable, or Wrangler authentication is available in this environment. Offline dialogue is verified; live provider behavior is not.
- A human playtest on the deployed site remains pending. Automated browser coverage is not a substitute for that playtest.
- The current circle/exam screens and later-life timeline have now been exercised in browser flows at desktop and mobile-like sizes; the previous statement that this verification was still outstanding was stale.

## Evidence files

- `artifacts/v33/CAMPAIGN_BROWSER_SMOKE_UVAROV.json`
- `artifacts/v33/ENDING_BROWSER_SMOKE.json`
- `artifacts/v33/V33_ACCEPTANCE_2026-10-30.log`
- `artifacts/v33/V33_ACCEPTANCE_ROLE_CONTEXT_2026-10-30.log`
- `artifacts/v33/V33_ARCHIVE_EXTRACTED_ROLE_CONTEXT_2026-10-30.log`
- `artifacts/v33/V33_ACCEPTANCE_RELATION_CONTEXT_2026-10-30.log`
- `artifacts/v33/V33_ACCEPTANCE_WORKER_RELATION_2026-10-30.log`
- `artifacts/v33/V33_ACCEPTANCE_EMBODIED_KNOWLEDGE_2026-10-30.log`
- `artifacts/v33/V33_ACCEPTANCE_ACTION_CONTEXT_2026-10-30.log`
- `artifacts/v33/V33_ARCHIVE_EXTRACTED_RELATION_CONTEXT_2026-10-30.log`
- `artifacts/v33/V33_ARCHIVE_EXTRACTED_ACCEPTANCE_2026-10-30.log`
- `artifacts/v33/V33_RPG_PHASE1_QUICK/`
- `artifacts/v33/INTERPERSONAL_DIALOGUE/`
- `docs/v33/VERIFICATION_2026-10-30.md`
- `docs/v33/DEPLOYMENT.md`
