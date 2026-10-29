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

- Dialogue sessions now optionally bind an allowlisted speaking NPC and a distinct embodied player character. The model receives only the embodied character's public identity, occupation, social estate, rank, and speech cues. It does not receive that character's private knowledge, money, or player state as facts known to the NPC.
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
