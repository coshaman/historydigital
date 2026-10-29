# V33 possession RPG delivery status

Updated 2026-10-30 after browser verification of the circle, exam, campaign, ending, and later-life timeline flows.

## Verified locally

- `npm run acceptance:v33` passed on the current implementation before this status refresh, including core and learning/exam tests, historical and asset audits, static build, repository checks, and browser acceptance.
- A fresh full Uvarov campaign browser run passed from the player's in-game route. It physically completed the 1847, 1848, and 1849 quests, made a reading-circle choice, completed the learning units, sat the exam, and reached the ending. The report is `artifacts/v33/CAMPAIGN_BROWSER_SMOKE_UVAROV.json`.
- The ending browser smoke passed all five ending screens. It checked the later-life timeline next/replay controls at desktop size, and the 360×800 mobile layout, reduced-motion behavior, scroll access to restart, and restart action. See `artifacts/v33/ENDING_BROWSER_SMOKE.json`.
- The existing campaign browser acceptance also runs circle/exam interactions in each route: attendance, notes-only attendance, declining, passing/failing, deferring, and helping Pavel. Route matrix logic checks retain the same questions and pass threshold regardless of attendance.
- The earlier full acceptance run and fresh extracted ZIP acceptance are recorded in `artifacts/v33/V33_ACCEPTANCE_2026-10-30.log` and `artifacts/v33/V33_ARCHIVE_EXTRACTED_ACCEPTANCE_2026-10-30.log`.
- Dialogue and map browser checks passed at 1440×900, 1366×768, 390×844, and 360×800. The dialogue portrait is hidden until conversation begins, then its portrait loads; no page errors or horizontal overflow were reported.
- The game is deployed through GitHub Pages workflow publishing. Pages mode is `workflow`; workflow run `40971793027` succeeded for commit `a593ea0`. Public smoke verified the site, generated config, and build manifest return HTTP 200.
- The public build has no configured Worker URL. It correctly stays in authored offline mode; no live provider call is made.
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
- `artifacts/v33/V33_ARCHIVE_EXTRACTED_ACCEPTANCE_2026-10-30.log`
- `artifacts/v33/V33_RPG_PHASE1_QUICK/`
- `artifacts/v33/INTERPERSONAL_DIALOGUE/`
- `docs/v33/VERIFICATION_2026-10-30.md`
- `docs/v33/DEPLOYMENT.md`
