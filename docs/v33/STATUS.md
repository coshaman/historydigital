# V33 possession RPG delivery status

Updated 2026-10-30 after browser verification of the circle, exam, campaign, ending, and later-life timeline flows.

## Fresh source-tree acceptance — 2026-10-30

- Re-ran `npm run acceptance:v33` on the source tree after commit `c253988d09b27b8005ea626888f912cd09fb9049`; it exited 0. The complete console output is `artifacts/v33/V33_ACCEPTANCE_REVALIDATION_2026-10-30.log`.
- Core reducer/save: 31/31; learning/exam/life: 9/9; HTTP MIME: 1/1; renderer: 3/3; exploration coverage: 4/4; AI/Worker: 26/26; historical claim ledger: 7/7; ending-route matrix: 120 fixtures; static URL config: 2/2; repository branch graph: 12/12.
- Browser acceptance passed at 1440×900, 1366×768, 390×844, and 360×800; 《외투》 source-first entry/return passed; all five ending panels and all five full campaign routes passed without route errors.
- Rebuilt the 645-entry external-review ZIP, passed `7z t`, extracted it into a new directory, installed locked dependencies from the local npm cache, and ran the same full acceptance successfully from the extracted copy. Log: `artifacts/v33/V33_ARCHIVE_REVALIDATION_2026-10-30.log`.
- The first default-sandbox attempt could not start its localhost browser server; rerunning the identical acceptance with the required local-socket permission passed. This was an execution-environment constraint, not an application test failure.
- One Node warning remains in the renderer unit-test import: Node reparses `rpg/engine/renderer.js` as ESM because the package scope does not declare its module type. This is test-runner overhead; browser acceptance reported no page errors.
- This run validates offline authored dialogue and Worker protections only. It does not establish live OpenAI connectivity or replace a human playtest.

## Literary expansion: Gogol's The Overcoat — 2026-10-30

- Added a separately namespaced 1842 literary realm for Akaky Bashmachkin and the tailor Petrovich. Six contiguous Russian paragraphs from the 1952 scholarly edition transcription are paired with this project's Korean translation and recorded with a source range and URL.
- The physical path is playable: enter through the source drawer, approach and possess Akaky, read the on-map excerpt, walk to the worn coat, record Petrovich's canonical repair verdict, then return to the historical map. Literary action results cannot alter the 1847–1849 historical outcomes.
- `npm run acceptance:v33` passed after the expansion. This includes core/save validation, the source-bound literary AI context, history and asset audits, build/lint/repository checks, four desktop/mobile browser viewports, all five ending screens, and all five full campaign routes.
- The dedicated browser smoke verified the Overcoat sequence at 1440×900 with no horizontal overflow and no browser errors. Report and screenshot: `artifacts/v33/OVERCOAT_REALM/`.
- GitHub Pages deployed commit `7b7adc1` successfully. The public browser smoke passed at 1440×900, 1366×768, 390×844, and 360×800, with matching document/viewport widths and save restoration. The new Overcoat map, source, characters, and quest each returned HTTP 200.
- Live provider credentials and a human playtest of the deployed site remain external release gates; this work verifies the authored offline dialogue path.

## Character contract and atlas follow-up — 2026-10-30

- All 10 active character cards now declare chapter-specific objectives, wealth-status provenance, and a four-direction/three-frame sprite atlas. Literary and historical reconstruction cards explicitly distinguish source-stated information from facts the selected text does not establish.
- The canvas renderer now uses each card's atlas path, frame geometry, and direction-row mapping. It no longer relies on hard-coded sprite cropping for movement frames.
- Added core schema and renderer regressions. The renderer test first failed when the declared atlas was ignored; after the change, renderer tests pass 3/3 and `npm run acceptance:v33` passes, including all four browser sizes, the Overcoat route, five endings and five complete campaign routes.
- Captured full acceptance output: `artifacts/v33/V33_ACCEPTANCE_CHARACTER_ATLAS_2026-10-30.log`.

## Verified locally

- `npm run acceptance:v33` passed on the current implementation after the possessed-character dialogue context change, including core and learning/exam tests, historical and asset audits, static build, repository checks, four-viewport browser smoke, five ending UIs, and five full campaign routes. The captured run is `artifacts/v33/V33_ACCEPTANCE_ROLE_CONTEXT_2026-10-30.log`.
- The Overcoat-expanded ZIP was extracted into a clean temporary directory, dependencies were installed from its lockfile, and `npm run acceptance:v33` passed there too. The exact extracted-copy log is `artifacts/v33/V33_ARCHIVE_EXTRACTED_OVERCOAT_2026-10-30.log`.
- A fresh full Uvarov campaign browser run passed from the player's in-game route. It physically completed the 1847, 1848, and 1849 quests, made a reading-circle choice, completed the learning units, sat the exam, and reached the ending. The report is `artifacts/v33/CAMPAIGN_BROWSER_SMOKE_UVAROV.json`.
- The ending browser smoke passed all five ending screens. It checked the later-life timeline next/replay controls at desktop size, and the 360×800 mobile layout, reduced-motion behavior, scroll access to restart, and restart action. See `artifacts/v33/ENDING_BROWSER_SMOKE.json`.
- The existing campaign browser acceptance also runs circle/exam interactions in each route: attendance, notes-only attendance, declining, passing/failing, deferring, and helping Pavel. Route matrix logic checks retain the same questions and pass threshold regardless of attendance.
- The earlier full acceptance run and fresh extracted ZIP acceptance are recorded in `artifacts/v33/V33_ACCEPTANCE_2026-10-30.log` and `artifacts/v33/V33_ARCHIVE_EXTRACTED_ACCEPTANCE_2026-10-30.log`.
- The later role-context patch was tested through `npm run acceptance:v33` from both the source tree and a clean extraction of the current ZIP. Logs are `artifacts/v33/V33_ACCEPTANCE_ROLE_CONTEXT_2026-10-30.log` and `artifacts/v33/V33_ARCHIVE_EXTRACTED_ROLE_CONTEXT_2026-10-30.log`.
- The dynamic relationship-context patch also passed the full source-tree acceptance, including all four browser sizes, five endings, and five full campaign routes. Its log is `artifacts/v33/V33_ACCEPTANCE_RELATION_CONTEXT_2026-10-30.log`.
- After adding HTTP-handler/Durable Object coverage for allowlisted and invented relationship hints, the full `npm run acceptance:v33` suite passed again (exit code 0), including all five ending screens and complete campaign routes. Log: `artifacts/v33/V33_ACCEPTANCE_WORKER_RELATION_2026-10-30.log`.
- After adding server-derived, character-specific literacy and known facts to the AI role context, the full `npm run acceptance:v33` suite passed again (exit code 0): four viewports, five ending UIs, and five full campaigns. Log: `artifacts/v33/V33_ACCEPTANCE_EMBODIED_KNOWLEDGE_2026-10-30.log`.
- The NPC privacy guard now normalizes digits, spacing, punctuation, and Korean/English/Russian kopek spellings before checking exact balances. A regression using `1·8 코페이카` reproduced and closed a punctuation bypass; player disclosure remains permitted.
- The Cloudflare Worker HTTP/Durable Object path now has an explicit forged-resource payload regression: client-supplied `actorResources` returns `400 invalid_request` and does not consume a session turn.
- A deterministic AI-output privacy guard now switches to authored fallback when NPC speech repeats undisclosed player-only facts, inventory, action/relationship hints, or an exact balance. It permits discussion after the player explicitly says the information. The guard test reproduced the prior leak and then passed after the fix.
- Resource-context regression now opens dialogue sessions as all eight embodied characters and compares each Worker payload against that character card. It confirms that both historically unspecified balances remain null and every inventory stays character-specific. The expanded AI suite passes 22/22; full acceptance passed again with four viewports, five ending UIs, and five complete campaign routes. Log: `artifacts/v33/V33_ACCEPTANCE_RESOURCE_CARD_CONTEXT_2026-10-30.log`
- `artifacts/v33/V33_ACCEPTANCE_AI_PRIVACY_GUARD_2026-10-30.log`
- `artifacts/v33/V33_ACCEPTANCE_WORKER_RESOURCE_INJECTION_2026-10-30.log`
- `artifacts/v33/V33_ACCEPTANCE_BALANCE_NORMALIZATION_2026-10-30.log`.
- The AI dialogue context now includes up to 12 authored action IDs from the embodied character's saved ledger. Worker validation checks each quest/action pair is valid for that body and derives situation wording from repository data; invented and cross-character actions are rejected. Full acceptance passed with all five routes and four browser sizes. Log: `artifacts/v33/V33_ACCEPTANCE_ACTION_CONTEXT_2026-10-30.log`
- `artifacts/v33/V33_ACCEPTANCE_RESOURCE_CONTEXT_2026-10-30.log`
- `artifacts/v33/V33_ACCEPTANCE_RESOURCE_CARD_CONTEXT_2026-10-30.log`.
- The same full acceptance passed after extracting the 614-entry package into a fresh directory. The extracted run log is `artifacts/v33/V33_ARCHIVE_EXTRACTED_RELATION_CONTEXT_2026-10-30.log`.
- Dialogue and map browser checks passed at 1440×900, 1366×768, 390×844, and 360×800. The dialogue portrait is hidden until conversation begins, then its portrait loads; no page errors or horizontal overflow were reported.
- The game is deployed through GitHub Pages workflow publishing. Pages mode is `workflow`; workflow run `40971793027` succeeded for commit `a593ea0`. Public smoke verified the site, generated config, and build manifest return HTTP 200.
- The public build has no configured Worker URL. It correctly stays in authored offline mode; no live provider call is made.
- The Worker supplies each AI turn with the possessed character's authored occupation, social estate/rank, legal mobility, literacy, estimated wealth bracket and status, speech cues, motives, risks, taboos, and up to six static facts from that same character's checked-in private-knowledge list. It also accepts up to 12 unverified quest/action IDs, but only where the checked-in quest authorizes that action for the embodied character; outcome wording is derived on the server. Both static knowledge and action history are player-side context only and cannot be treated as facts known by the NPC. The Worker never accepts client-authored fact text or situation text. The Worker derives a designed-estimate balance and inventory from the character card's checked-in starting resources plus accepted authored action IDs. These are unverified player-side hints only, never NPC knowledge unless disclosed, and the client cannot supply resource values or action descriptions. Deterministic game state remains browser-owned. Player motives remain private and cannot authorize game-state changes. Current group-level relationship statuses are unverified allowlisted tone hints only.
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
- `artifacts/v33/V33_ACCEPTANCE_CHARACTER_ATLAS_2026-10-30.log`
- `artifacts/v33/V33_ARCHIVE_EXTRACTED_CHARACTER_ATLAS_2026-10-30.log` (fresh ZIP extraction acceptance, exit 0)
- `artifacts/v33/V33_RPG_PHASE1_QUICK/`
- `artifacts/v33/INTERPERSONAL_DIALOGUE/`
- `docs/v33/VERIFICATION_2026-10-30.md`
- `docs/v33/DEPLOYMENT.md`
