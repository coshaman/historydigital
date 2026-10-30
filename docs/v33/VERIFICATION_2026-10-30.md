# V33 verification run — 2026-10-30

## Result

`npm run acceptance:v33` previously exited 0 on branch `codex/v33-possession-rpg` after the save-description and ending-route fixture fixes. The verified commit `c6ac18708fdb0f05403fd916d91885bef489a655` was then pushed to `master`; GitHub Actions and Pages both completed successfully. The public deployment was checked with HTTP resource fetches and a Playwright gameplay smoke. A follow-up 2026-10-30 verification added interpersonal dialogue and per-host portrait checks and reran the browser acceptance suite successfully; see the current result below.

## Follow-up verification — 2026-10-30

- Full browser acceptance: PASS. All five complete campaign routes reached their intended endings from a clean browser state, with the four 1847–1849 quests resolved and required sources recorded. Reports and 1440×900 screenshots are in `artifacts/v33/CAMPAIGN_BROWSER_SMOKE*.json` and `artifacts/v33/campaign-full-run-*.png`.
- Interpersonal conversation: PASS at 1440×900, 1366×768, 390×844, and 360×800. Anna speaks as the embodied player to adjacent Ekaterina; the reply is attributed to Ekaterina; ledger speaker/interlocutor IDs are distinct; conversation does not mutate quests; portrait loads at 64×64; input remains visible and does not overlap movement controls.
- Source access: campaign script now reads a previously opened 1848 source through the in-game source drawer when another host needs to learn it. This records the reading for that host while preserving per-host knowledge boundaries.
- Character assets: 8 character cards now link to their own 64×64 face portraits with provenance records. `npm run v33-image-audit` checks dimensions and provenance.
- The separate offline fallback remains the verified AI state. Live Responses API remains blocked/unverified without a configured production key and Worker endpoint; human playtest on deployed Pages remains pending.
- The learning reducer rejects answer objects with unknown question IDs; this prevents a fully correct set plus a forged extra field from being treated as a pass. The regression was observed failing before the reducer change and passes in the current focused/full suite.
- Ending browser checks now assert historical comparison precedes the fictional timeline, all five endings begin at episode 1/7, next/replay works without changing route state, and reduced-motion mode keeps navigation and the no-dialogue ending layout available.
- Invalid option IDs are omitted from saved answers and count as unanswered; unknown question IDs invalidate the submission and are not persisted, so a malformed result still round-trips through save validation.
- Mid-lesson progress round-trips through the actual V33 save/load reducer. The seven fictional episodes are asserted chronological; mobile restart clears the saved exam and timeline.
- Dialogue audits: speech-register audit PASS; 24 case conversations / 120 authored unique lines PASS; runtime audit PASS (802 lines, 216 choices); plan audit PASS; 100-line Korean dialogue review PASS.

## Checks recorded by the run

| Gate | Result |
|---|---|
| RPG core | 27/27 tests passed |
| Learning and life simulation | 9/9 tests passed |
| Local HTTP MIME handling | passed |
| Canvas renderer startup | passed |
| AI/Worker security, memory, limits and fallback | 18/18 test groups passed (21 including nested provider-error cases) |
| Historical flow audit | PASS; 3 dated arcs, 7 sources, 4 historical packets, 5 quests, 5 ending IDs |
| Pixel asset audit | PASS; 17 PNGs with dimensions and provenance checked, including eight 64×64 portraits |
| Ending reducer matrix | PASS; 10 variants across 5 endings |
| Static RPG build | PASS; 57 files, relative paths, legacy Chancery entry preserved |
| Static integrity, lint, historical check and route tests | PASS |
| Browser viewport smoke | PASS at 1440×900, 1366×768, 390×844 and 360×800 |
| Browser two-map route | PASS; 128,624 ms goal-directed route, source reader scroll, clue, host changes and quest decision |
| Browser Chancery/courtyard route | PASS; access restriction, observer entry, clue inspection and return |
| Ending UI | PASS; all five endings, no gameplay/dialogue panel under the ending, mobile scroll and restart |
| Full campaign browser routes | PASS; all five endings reached from the 1847–1849 campaign. Repeated per-host source reading uses the source drawer and retains speaker-specific knowledge. |

The detailed machine-readable evidence is in `artifacts/v33/V33_RPG_PHASE1/BROWSER_SMOKE.json`, `artifacts/v33/ENDING_BROWSER_SMOKE.json`, `artifacts/v33/CAMPAIGN_BROWSER_SMOKE.json`, the five per-ending campaign reports, `artifacts/v33/ENDING_ROUTE_MATRIX.json`, `docs/v33/HISTORICAL_FLOW_AUDIT.json`, and `docs/v33/IMAGE_AUDIT.json`. Screenshots for the viewport, ending, and full-campaign routes are stored alongside those reports under `artifacts/v33/`.

## Deployed Pages verification

- GitHub Actions: [V33 GitHub Pages run 40928153096](https://github.com/coshaman/historydigital/actions/runs/40928153096) — success.
- GitHub Pages deployment: [run 40928152549](https://github.com/coshaman/historydigital/actions/runs/40928152549) — success.
- Public entry point and core RPG assets returned HTTP 200. The post-deployment Playwright smoke passed at 1440×900, 1366×768, 390×844, and 360×800, with map transitions, host possession, source reading, save/reload, quest choice, and Chancery/courtyard interactions. Machine-readable evidence and screenshots are in `artifacts/v33/DEPLOYED_PAGES_SMOKE_2026-10-30.json` and `artifacts/v33/V33_RPG_PHASE1_QUICK/`.

## Fixes found during verification

- Possessing a host whose source record has `money.amount: null` previously rendered `null코페이카`. The UI now describes funds as unconfirmed by the selected sources; the RPG core regression test also checks a known `kopeks` balance.
- The BELINSKY browser fixture used the nonexistent answer ID `INTENTIONALLY_WRONG`. The save validator correctly rejected that impossible answer. The fixture now selects an authored distractor, and every ending route is required to survive an engine save/load round trip before it enters the browser matrix.

## External verification still pending

- Live OpenAI Responses API remains `BLOCKED_NO_KEY / UNVERIFIED`; no production Worker URL or secret was present for this run. Local tests cover server-side boundaries and offline fallback only.
- A human playtest on the final deployed Pages build remains pending.

## Follow-up — caller-level Worker budgets

- Added independent Durable Object buckets derived from HMAC(CF-Connecting-IP, `RPG_SESSION_SIGNING_KEY`); raw client addresses are not stored. Per-caller limits are 8 session starts/minute and 40/day, plus 30 dialogue turns/minute and 200/day. Buckets are deleted after two days.
- Regression tests drive the Cloudflare Worker route: one caller hits the start cap and dialogue cap, a second caller remains independent, and Durable Object identifiers contain no raw IP text. The V33 full acceptance rerun passed after this change, including the four-viewport browser smoke, all five ending interfaces, and five complete campaign routes.
- These limits slow single-address abuse but do not authenticate users and can be bypassed by IP rotation. Global request caps and provider-side spend controls remain necessary. No live Worker/key was configured, so this is local Worker behavior verification, not production deployment verification.

## Follow-up — embodied dialogue pair context

- Dialogue sessions bind an allowlisted speaking NPC and an optional distinct embodied player character. At the time of that check, the model received only the embodied character's public identity, occupation, social estate, rank, and speech cues. A follow-up audit below expands the checked-in role context while preserving the no-secret/no-state boundary.
- Session tokens and browser transcripts are keyed by the ordered actor/NPC pair. The AI runtime regression proves Anna→Ekaterina turns remain in that pair while Alexei→Ekaterina starts with an empty separate memory. The interpersonal browser harness uses a mocked Worker response (not a live provider) and checks both pair payloads and distinct stored tokens; all four viewport layouts pass and the conversation leaves quest state unchanged.
- The worker and browser-context tests passed alongside the RPG core, learning/life, renderer, historical, asset, route, build, lint, `npm run check`, and `npm test` gates. The full four-viewport RPG smoke and five ending/campaign route browser checks also passed.

## Follow-up — pending dialogue request isolation

- Per-session turns now serialize in both the local memory store and Cloudflare Durable Object. A second unfinished request receives `409 request_in_progress`; abandoned claims are released after a 60-second lease.
- While a reply is pending, the input, submit, and reply choices are disabled. Closing mid-request invalidates the client session token; reopening starts a fresh session for that actor/NPC pair, and late responses are ignored.
- The browser regression uses a deliberately held response and verifies duplicate submission is locked and a response arriving after close/reopen never appears in the new transcript. Four desktop/mobile viewport cases passed. AI runtime tests passed 21/21.
- Actor identity is a client-declared role-play context, not authenticated against local save data. It only frames dialogue; it does not establish game authority or enable state mutation. This is an intentional constraint of the static offline-first game architecture.
- The current `RUSSIAN_LIVES_V33_POSSESSION_RPG_VERIFICATION.zip` contains 606 entries and was extracted to a clean directory. `npm run acceptance:v33` exited 0 there: AI runtime 21/21, the four viewport checks, all five ending screens, and all five full campaign routes passed, along with the build, lint, historical checks and core route tests.

## Post-push public Pages smoke — 2026-10-30

- V33 Pages workflow `40957947798` completed successfully for commit `abb14bde7b32bc45849d470ff91afaecb986fe45`.
- Chrome smoke against `https://coshaman.github.io/historydigital/` passed at 1440×900, 1366×768, 390×844 and 360×800. It verified the rendered map, viewport bounds, touch controls, host possession, source and clue interactions, save/reload, evidence overlay, map traversal, source-gated choice, and access behavior. Machine report and captures: `artifacts/v33/V33_RPG_PHASE1_QUICK/`.
- The public Pages frontend has no live AI endpoint configured for this run. No OpenAI request was made; `V33_LIVE_AI` remains `BLOCKED_NO_KEY / UNVERIFIED`. Human playtesting remains pending.

## Final approved V33 learning/life follow-up

- The updated verification ZIP was extracted to a clean directory and `npm run acceptance:v33` passed from that extracted copy. This included the V33 learning/save boundary cases, build, lint, `npm run check`, 81 route vectors, four browser viewport sizes, all five ending UIs, and five complete campaign routes.
- The standalone legacy `npm run main20-learning-exam-acceptance` timed out waiting for `window.__main20` on the old `?main20=1` entry. The approved learning/life experience is integrated in V33; its browser coverage is the V33 acceptance above. Do not treat that obsolete MAIN20 harness as a V33 regression.
- Live production AI credentials/Worker and human playtest of deployed Pages remain external pending gates, as described above.

## Historical claim ledger follow-up — 2026-10-30

- Added `rpg/data/historical-claim-ledger.json` with 13 distinct Russian/Korean paragraph references across the 1848 publication notices, the 1849 investigation report, and Dubelt's May 5 letter. Each claim is labeled as an assertion made by its source and linked to a visible in-game source object and campaign arc; quest links are checked when the claim is used by a quest.
- `npm run v33-historical-claim-ledger-test` passed 7/7 cases, including invalid paragraph/provenance, wrong-arc and wrong-quest sources, duplicate excerpt, placeholder claim, and hidden/non-source/wrong-chapter map object rejection. `npm run v33-historical-audit` passed and reported 13 unique excerpts against the minimum of 12.
- Full `npm run acceptance:v33` passed with exit code 0. This run included all four desktop/mobile browser widths, all five ending UIs, and all five complete campaign routes. The initial sandboxed browser run could not reach its local server because the environment denied socket access; rerunning with local browser socket permission succeeded.
- Live AI remains `BLOCKED_NO_KEY / UNVERIFIED`, and human playtesting remains pending.

## Public verification of final pushed commit — 2026-10-30

- Commit `a0fa6e1d88a63b040b298b09dc6cd2d65bde8766` is on both `master` and `codex/v33-possession-rpg`. Pages build `40964982387` and deployment `40964981998` completed successfully.
- A fresh public smoke on `https://coshaman.github.io/historydigital/` passed at 1440×900, 1366×768, 390×844 and 360×800. Each document width matched its viewport, controls stayed visible, and the saved clue restored. Captures and machine report: `artifacts/v33/V33_RPG_PHASE1_QUICK/`.
- Live AI remains `BLOCKED_NO_KEY / UNVERIFIED`; human playtesting remains pending.

## Worker URL build-path verification — 2026-10-30

- Root-cause check found the Worker URL setup instructions did not reach the running game: `rpg/ai/config.js` reads `window.V33_RPG_AI_API_BASE_URL`, while the Pages build copied a fixed blank source file and never consumed `RPG_AI_API_BASE_URL`.
- Fixed the path end to end. The Pages workflow passes only the public Actions variable `RPG_AI_API_BASE_URL`; `build:v33` validates an HTTPS origin (localhost HTTP allowed for local development), rejects credentials/path/query/fragment/unsafe protocols, and injects it into the generated config. The API key is never accepted by this build setting. An absent URL retains authored offline mode.
- Added `v33-static-build-config-test` to acceptance. It passed 2/2 cases covering URL normalization/injection, provider-key exclusion, unsafe URL rejection without destroying the previous build, offline blank configuration, and Pages workflow variable wiring.
- No Actions variables are currently configured (`gh variable list` returned none), and the published config returns HTTP 200 with an empty Worker URL. No Wrangler CLI/auth or Worker credentials are present in this environment. `V33_LIVE_AI` remains `BLOCKED_NO_KEY`; this change enables configuration but does not claim a live provider test.
- After the change, `npm run acceptance:v33` completed successfully through its browser acceptance stage (exit code 0). This re-ran the V33 core, learning/life, HTTP server, renderer, AI fallback, historical claim, historical/image audit, ending-route, static-config, build, lint, check, route, and browser suites; all five campaign ending routes passed. The acceptance run rewrote a few timestamped browser evidence files, which were excluded from this patch.
- The rebuilt verification ZIP was extracted into a clean folder and the full `npm run acceptance:v33` suite passed there as well (exit code 0), including all four viewport sizes, all five ending screens, and all five complete campaign routes.

## Pages publishing mode correction — 2026-10-30

- The first deployment after the Worker URL build fix revealed the repository Pages site still used `legacy` branch-root publishing, so the successful Actions deployment did not replace the public files. The Pages site was changed to `workflow` publishing and the V33 workflow was dispatched again.
- GitHub Actions deployment `40968090498` succeeded. A cache-busted public check confirmed the game entry, generated Worker config, and `build-manifest.json` all return HTTP 200; the manifest lists 58 files and marks `publicAiWorkerConfigured: false`.
- The generated config is active, but the GitHub Actions variable `RPG_AI_API_BASE_URL` remains unset. Live AI is therefore still `BLOCKED_NO_KEY / UNVERIFIED`; the game uses authored offline responses.

## Dialogue portrait visibility regression — 2026-10-30

- Visual inspection of the newly published mobile/desktop playthrough found an empty speaker portrait frame before any conversation. Root cause: `.dialogue-speaker { display:flex }` overrode the HTML `hidden` attribute in the browser's cascade.
- Added a browser regression assertion that the speaker block is not visible before dialogue begins; observed the expected failing result (`true !== false`) before the CSS fix. `.dialogue-speaker[hidden] { display:none }` now preserves the authored visibility state. Existing dialogue acceptance also verifies the active speaker's 64×64 portrait file loads.
- Full `npm run acceptance:v33` passed after the fix (exit code 0): static/data/AI checks, lint, `npm run check`, route tests, four viewport playthroughs, five ending UIs, and all five complete campaign routes. The main browser report recorded a 128,447 ms goal-directed route and no page errors.
- After commit `fda2883` deployed, the public Pages build passed `v33-rpg-browser-smoke.mjs --quick` at 1440×900, 1366×768, 390×844 and 360×800, including map travel, possession, source inspection, save/reload and no horizontal overflow. The public multi-turn dialogue browser test also passed all four sizes: the speaker block stays hidden before a conversation, Ekaterina's 64×64 portrait loads during it, no page errors occur, and dialogue alone does not mutate the quest. That test substitutes the generated config and mocks the Worker endpoints; it is not a live OpenAI smoke. Reports and screenshots are in `artifacts/v33/V33_RPG_PHASE1_QUICK/` and `artifacts/v33/INTERPERSONAL_DIALOGUE/`.
- The final verification ZIP was extracted to a clean folder; its own `npm run acceptance:v33` passed with exit code 0, including all five complete campaign routes. The captured source-run and extracted-archive logs are included under `artifacts/v33/`.

## Circle/exam/timeline browser recheck — 2026-10-30

- Ran `scripts/v33-campaign-browser-acceptance.mjs` against a fresh local server after the earlier status note was found stale. All five full player routes passed: UVAROV, BELINSKY, HERZEN, KHOMYAKOV, and DOSTOEVSKY_PETRASHEVSKY. Each route traversed the 1847–1849 chapters, exercised its configured circle/study/exam path, and reached its ending. The aggregate and per-route reports are `artifacts/v33/CAMPAIGN_BROWSER_SMOKE.json` and `artifacts/v33/CAMPAIGN_BROWSER_SMOKE_*.json`.
- Ran `scripts/v33-ending-browser-smoke.mjs` against a fresh local server. All five ending UIs passed; the later-life timeline next/replay controls worked, and the 360×800 run confirmed no horizontal overflow, reduced-motion navigation, scroll access to restart, and successful restart. See `artifacts/v33/ENDING_BROWSER_SMOKE.json`.
- `npm run check` passed, including 12/12 branch graph and chronology tests; `git diff --check` passed.
- Refreshed `docs/v33/STATUS.md` to remove the obsolete claim that circle/exam and timeline browser acceptance was outstanding. The verification ZIP was refreshed to include the updated status, full-route reports, and this addendum; the ZIP had 611 entries at that recheck. No game runtime code changed in that recheck.
- This does not change the external gates: the production Worker URL/keys are not configured, live OpenAI remains `BLOCKED_NO_KEY / UNVERIFIED`, and deployed human playtesting remains pending.

## Possessed-character dialogue context audit — 2026-10-30

- Inspection found a roleplay gap in `safeEmbodiedProfile`: AI received occupation and speech cues but omitted the possessed character's legal mobility, economic bracket, authored objective, and risk. A regression assertion reproduced this as an undefined legal-mobility field before the implementation change.
- The Worker now supplies those checked-in role facts, plus desires, fears, and taboos. The system prompt treats motives/fears as private role guidance and forbids the NPC from exposing or presuming knowledge of them unless the player says them.
- Exact money, dynamic witnessed facts, current inventory, and quest state remain excluded. Up to six static private facts are derived server-side from the embodied character's own checked-in card; they are isolated from NPC knowledge and cannot be client-authored. Actor IDs remain client-declared, non-authenticated dialogue framing; they confer no authority, and the deterministic game engine still owns every state change.
- The AI runtime test confirms Anna and Alexei receive different constraints, objectives, literacy, and own-character knowledge; it asserts that Anna does not receive Alexei's private fact, while Ekaterina's separate NPC-side facts remain distinct. Exact money, inventory, and dynamic relations are absent from the embodied-player profile. Focused suite: `node --test scripts/v33-ai-runtime.test.mjs` — 21/21 passed after the change.
- Full `npm run acceptance:v33` then passed with exit code 0, including all four browser viewports, five ending UIs, and five full campaign routes. Captured output: `artifacts/v33/V33_ACCEPTANCE_ROLE_CONTEXT_2026-10-30.log`.
- Extracted the updated review ZIP into a fresh directory and ran `npm run acceptance:v33` there; it passed with exit code 0, including the browser routes. Captured output: `artifacts/v33/V33_ARCHIVE_EXTRACTED_ROLE_CONTEXT_2026-10-30.log`.
- The external-review ZIP now includes this role-context fix, its regression test, both acceptance logs, and browser evidence. It contains 613 unique entries, excludes `.git`, `node_modules`, and `dist-v33`, and its changed files were byte-compared with the worktree.
- Live Responses API remains unverified; all results here use the injected provider mock and offline Worker/runtime tests.

## Dynamic relationship dialogue context — 2026-10-30

- The possessed-character audit revealed another context gap: deterministic quest actions update group-level relationship statuses in the saved game, but dialogue requests did not carry those changes. The game now sends the current relationship statuses on each AI turn so later quest choices are reflected without stale session snapshots.
- Both browser and Worker constrain this field to exact authored relationship statuses from the quest and learning data. Unknown groups, free text, and invented statuses are rejected; the normalized relation map is included in the idempotency hash.
- The Worker labels the relationship snapshot as unverified client-local context. It may guide conversational distance only; the model must not claim the NPC witnessed the action, reveal the relationship as a fact unless the player mentions it, or alter deterministic state. The relationship snapshot itself contains no private facts, exact money, inventory, or quest state.
- Tests distinguish Anna's workshop relation from Alexei's supervisor relation, cover changed relation context on repeated request IDs and reject a prompt-injection string. Browser acceptance verifies both possessed characters' different saved relationship values are sent at 1440×900, 1366×768, 390×844, and 360×800 with no quest mutation or layout errors.
- `npm run v33-ai-test` passed 21/21, and the complete `npm run acceptance:v33` run passed with exit code 0, including five endings and five full campaigns. Captured output: `artifacts/v33/V33_ACCEPTANCE_RELATION_CONTEXT_2026-10-30.log`.
- The 614-entry source ZIP was extracted to a fresh directory and the same full acceptance passed there with exit code 0. Its captured output is `artifacts/v33/V33_ARCHIVE_EXTRACTED_RELATION_CONTEXT_2026-10-30.log`. The final 615-entry ZIP adds that extracted-run log and the refreshed status/evidence documentation; no runtime files changed after the successful extracted test.
- A final integration regression now exercises the actual Worker HTTP handler and Durable Object path with an allowlisted relationship hint, then submits an invented value and verifies the Worker rejects it without consuming a session turn. `npm run v33-ai-test` remains 21/21 after this added assertion.

## Embodied-player knowledge context — 2026-10-30

- Audit found that the Worker passed the embodied player's role and motives but omitted their literacy and static character-specific knowledge, so AI-generated conversation could not consistently reflect what Anna, Alexei, or another body could know.
- The Worker now derives `playerKnownFacts` from the selected checked-in character card, intersected with its own `privateKnowledgeIds`; client fact text, dynamic witnessed facts, and another host's facts are never accepted. Literacy is also passed from the card.
- Prompt rules reserve these facts for player-side role context and suggested replies. The speaking NPC must not act as if they know or witnessed them unless the player explicitly reveals them. They do not change deterministic game state.
- Regression tests first failed on the absent literacy field, then passed with Anna/Alexei-specific known facts and checks that another host's private fact is absent and NPC speech is instructed not to leak player knowledge. `node --test scripts/v33-ai-runtime.test.mjs`: 21/21 pass. The full `npm run acceptance:v33` suite passed afterward: four viewport playthroughs, five ending screens, all five full campaign routes, static/history/asset checks, build, lint, and repository checks. Captured log: `artifacts/v33/V33_ACCEPTANCE_EMBODIED_KNOWLEDGE_2026-10-30.log`.
- The final review ZIP is refreshed with the Worker runtime, regression test, updated Worker/privacy documentation, latest campaign/browser evidence, and the complete acceptance log. Its archive integrity and byte parity for every refreshed file were checked.

## Character-authorized action context — 2026-10-30

- Audit found that AI dialogue knew static character facts and relationship tone, but not deterministic quest actions that had changed the embodied player's immediate situation.
- The game now sends only the latest 12 `(questId, actionId)` pairs from that character's local action ledger. The Worker validates each pair against checked-in quest data and the action's `hostIds`, then derives the situation text itself. It rejects unknown, injected, duplicate, and cross-character action claims; accepted context is still marked unverified because the static browser save is not an authenticated source.
- The AI may use this as player-side context for suggested replies only. It must not infer that the speaking NPC witnessed the action or treat it as a game-state command. The ordered history is part of the request idempotency hash.
- Tests cover Anna's authorized source-comparison action, Alexei's different office action, cross-character rejection, malformed IDs, and replay conflicts when action context changes. The browser test completes Anna's physical source-gated action, then confirms the authored situation hint is sent at all four viewport sizes; a subsequent Alexei conversation starts with an empty action history.
- The cross-character rejection regression exposed that invalid-but-well-formed action context consumed a global limiter slot before authorization. Validation now rejects it and releases the session claim before touching the global request budget; a focused assertion confirms the budget count is unchanged.
- `npm run v33-ai-test`: 21/21 passed. `npm run v33-browser-acceptance`: all four browser sizes, five ending screens, and five complete campaign routes passed. The latest full `npm run acceptance:v33` run passed with exit code 0; see `artifacts/v33/V33_ACCEPTANCE_ACTION_CONTEXT_2026-10-30.log`.


## Derived player resource dialogue context — 2026-10-30

- The Worker now derives a possessed character's estimated money and inventory from the checked-in actor card and the validated, authored action IDs in the local history hint. Resource effects come from quest definitions; invalid balances or attempts to remove absent inventory entries are rejected. Neither resource values nor action descriptions are accepted from the client.
- Resource context is explicitly unverified player-side information. NPC dialogue must not reveal it unless the player discloses it; it is only there to shape player-side reply suggestions and does not change browser-owned deterministic state. Balances carry `designedEstimate` status.
- Regression coverage confirms Pavel's 4-kopeck courier expense (11 to 7) and Ekaterina returning the proof copy, as well as rejection of injected `actorResources` and prompt rules preventing NPC leakage. `npm run v33-ai-test` passed 22/22 after adding coverage for all eight embodied character cards, including two unknown balances preserved as null. The full `npm run acceptance:v33` suite passed with exit code 0; see `artifacts/v33/V33_ACCEPTANCE_RESOURCE_CARD_CONTEXT_2026-10-30.log`.


## AI dialogue private-context output guard — 2026-10-30

- A mocked provider reproduced a privacy leak: it repeated the embodied character's private fact, held item, and exact starting balance in NPC speech, which the prior schema and prompt-only checks accepted.
- The Worker now falls back to authored dialogue if NPC speech repeats an undisclosed private knowledge sentence, inventory label, action situation, relationship status, or exact balance. Matching is normalized for Korean spacing and punctuation; content previously disclosed by the player and facts available to the NPC from the authorized source packet are allowed. Player-side suggested replies are not scanned.
- Regression tests prove both rejection of the hidden information and acceptance after the player states it. `npm run v33-ai-test` passes 23/23. Full acceptance is captured in `artifacts/v33/V33_ACCEPTANCE_AI_PRIVACY_GUARD_2026-10-30.log`.


## Worker HTTP resource-injection regression — 2026-10-30

- The actual Worker route now explicitly rejects client-provided `actorResources` with `400 invalid_request` and confirms the rejected request does not consume a Durable Object turn. `npm run v33-ai-test` passes 23/23.
- Full acceptance log: `artifacts/v33/V33_ACCEPTANCE_WORKER_RESOURCE_INJECTION_2026-10-30.log`.


## Normalized balance-leak check — 2026-10-30

- A provider response containing `1·8 코페이카` bypassed the prior strict digit-plus-currency pattern even though the player had not disclosed the amount.
- The checker now removes spacing and punctuation before matching the exact balance and recognizes the project's Korean, English, and Russian kopek forms. It still allows the value after the player states it. Regression test and full acceptance log: `artifacts/v33/V33_ACCEPTANCE_BALANCE_NORMALIZATION_2026-10-30.log`.
