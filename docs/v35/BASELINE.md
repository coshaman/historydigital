# V35 baseline — 2026-11-01

## Repository and release path

- Repository: `coshaman/historydigital`.
- Checked out branch: `main`; local `HEAD` and `origin/main` were both `aee6d0997928a1c86b3cea54df6dc4b52667f814` before V35 continuation edits.
- Root instructions: `AGENTS.md` read in full. V35 goal: `C:\Users\owner\Downloads\CODEX_V35_LIVING_HISTORY_RPG_GOAL.md` read in full.
- Deployment configuration is Vercel (`vercel.json`): `npm run build:v33`, output `dist-v33`, Node Function `api/rpg/[...path].js`. A production deployment URL and Vercel project/log access are not present in this worktree, so live deployment status is unverified.
- Existing local static artifact at baseline: `dist-v33/`, manifest `V33_STATIC_BUILD_V1`, 73 files, entry `index.html`, Vercel same-origin runtime. SHA-256 before continuation edits: `dist-v33/rpg/main.js` = `9D45999F94EF7FB97FCA4114E904DD55A53C66EC545818A470DF9E40A9942B24`; `dist-v33/rpg/data/source-register.json` = `6336D2E7062746A9213D59E1956F6C0C2986C8CA4B305FA907CC7985266BE111`.
- Baseline full browser campaign was run from the source checkout, not from `dist-v33`; this did not satisfy the V35 release-artifact gate. Browser acceptance was changed during this continuation to serve `dist-v33`; fresh release-artifact evidence is still required.

## Existing features preserved at baseline

- V34 quest guidance, possession, tiled maps, NPC dialogue API, literary realms, five endings, life-learning flow, saved state, and character/source records exist.
- `npm run v33-browser-acceptance` had passed on the source checkout at 1440×900, 1366×768, 1111×720, 390×844, and 360×800; it covers interpersonal dialogue, RPG route, literary Overcoat, endings, and five campaign outcomes.
- Relevant existing reports/screenshots: `artifacts/v33/V33_RPG_PHASE1/BROWSER_SMOKE.json`, `artifacts/v33/ENDING_BROWSER_SMOKE.json`, `artifacts/v33/CAMPAIGN_BROWSER_SMOKE*.json`, `artifacts/v33/OVERCOAT_REALM/BROWSER_SMOKE.json`, and `artifacts/v33/INTERPERSONAL_DIALOGUE/BROWSER_SMOKE.json`.

## Reproduced baseline gaps

1. **Source reader:** `openSourceReader()` displays a large scrollable modal with aligned Russian/Korean passages and provenance links. It currently does not render `titleRu`, an excerpt ID, creation/publication/presentation dates separately, or `DIRECT/PARAPHRASE/LATER_CONTEXT/RECONSTRUCTED` labels. Every record uses the same single-column passage structure; no newspaper/book/letter/official-document variants or reading-mode controls exist. Prior browser screenshots captured the post-reading game view, not the open reader itself.
2. **Historical context in play:** the 1847 quest offers consequential physical actions and access to Turgenev’s source, but its premise labels the proof as fictional and does not connect Anna’s rent/work situation to a follow-up event. Alexei’s 1849 report quest is the strongest contextual chain, but no unified case-context data or three gold-flow acceptance exists.
3. **Character knowledge:** only Anna, Ekaterina, and Alexei have brief fictional worldviews. Pavel, Mikhail, and Lev have speech-rhythm and schedule data but no worldview/epistemic/debate stance matrix. Scene `allowedTopics` remain narrow; historical sessions have no allowed source IDs, so broad sourced discussion is not yet demonstrated.
4. **NPC simulation:** deterministic BFS movement and a Pavel delivery task exist within `game-state.js`; no standalone `advanceNpcWorld()` module, unified six-character FSM/waypoint schema, 30-minute replay evidence, or 60-second movement capture was present. Schedules update activity labels even when blocked; off-screen and save/reload parity need dedicated evidence.
5. **Evidence ZIP:** the existing ZIP had a basic test summary and selected V33 screenshots/reports. It does not contain the required V35 source patch, matrices, six-character knowledge ledger, NPC replay, 6×3 AI dialogue evidence, four named viewport folders, issue log, build hashes, or final report.

## Source verification notes

- The checked-in Turgenev witness is a 4th collected-edition transcription of the 1847 fiction, not a facsimile of the first issue. Its opening lines 123–129 show Polutykin taking the narrator to Khor and identifying Khor as his serf; this is literary framing, not a historical witness about Anna.
- The Nekrasov 1848 notice was opened on Wikisource. Lines 117–119 cover the provincial delivery delay, later schedule, deferred article, and Lamartine notice. The 1849 publishing-year announcement is a separate 1848 text and must not be presented as a document written in 1849.
- The Petrashevsky report was opened on Wikisource. Lines 388–394 are seven consecutive paragraphs: April 22 censorship discussion, informant reports, arrest order, commission, and named detainees. This is the investigating authority’s account, not a neutral meeting transcript.
- The Dubelt letter page states a 1974 scholarly edition and archival locator; its lines 127–135 contain the full May 5, 1849 letter in the source record. The cited Wikisource pages identify public-domain status; the project uses its own Korean translations.
- The National Electronic Library catalog returned HTTP 403 to the browsing tool. Treat its checked-in bibliographic citation as not independently re-fetched in this audit; do not claim a scan was visually inspected.

## Current disposition

This is a gap baseline, not a completion claim. The historical outcomes and five existing ending IDs remain the immutable regression baseline. Continue with a source-first, three-gold-flow implementation and rerun all required checks against a freshly built `dist-v33`.
