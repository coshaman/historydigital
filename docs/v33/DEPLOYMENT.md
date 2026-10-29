# V33 deployment and live AI status

## Static game

The repository root serves the RPG from `index.html`; the former Chancery game remains at `chancery.html`. The RPG uses relative asset paths and is packaged with `npm run build:v33` into `dist-v33/`. The GitHub Pages workflow runs on pushes to `master` and supports manual dispatch. The repository's Pages source must be set to GitHub Actions.

The output is a project site and works below `/historydigital/` because all game assets are relative. The public game has no provider key. The only public AI setting is the optional Worker base URL in `rpg/ai/config.js`.

## Worker

Follow `ai/v33/worker/README.md`. Configure the actual Pages **origin** in `RPG_ALLOWED_ORIGINS`; the repository path is not part of the browser `Origin`. Store `OPENAI_API_KEY` and `RPG_SESSION_SIGNING_KEY` as Worker secrets only. Set an account/project spending cap as well as the Worker's request budget. Per-caller HMAC buckets limit ordinary single-IP abuse, but CORS is not authentication and IP rotation can bypass caller limits.

## Current verification

- On 2026-10-30, commit `c6ac18708fdb0f05403fd916d91885bef489a655` was pushed to `master`. GitHub Actions run [40928153096](https://github.com/coshaman/historydigital/actions/runs/40928153096) and Pages deployment run [40928152549](https://github.com/coshaman/historydigital/actions/runs/40928152549) both completed successfully.
- The deployed site at `https://coshaman.github.io/historydigital/` returned HTTP 200. Its entry page, RPG module, AI config, Nevsky map, campaign, quest, character, historical packets, learning exam, Petersburg tilesheet, and game-state module all returned HTTP 200.
- A post-deployment Playwright run against the public Pages URL passed at 1440×900, 1366×768, 390×844, and 360×800. It confirmed the canvas and controls render, touch controls stay within the viewport, save/reload restores the inspected clue, source reading and a quest choice work, map traversal and host changes work, and Chancery/courtyard access behaves correctly. Its report and screenshots are in `artifacts/v33/V33_RPG_PHASE1_QUICK/` and `artifacts/v33/DEPLOYED_PAGES_SMOKE_2026-10-30.json`.
- The full local `npm run acceptance:v33` also completed with exit code 0 against the same source commit. The detailed run summary and machine-readable reports are in `docs/v33/VERIFICATION_2026-10-30.md` and `artifacts/v33/`.
- Playwright headless Chrome ran successfully in this verification. The local browser smoke passed at 1440×900, 1366×768, 390×844, and 360×800, including map movement, clue inspection, save/reload, offline dialogue, source reading, mobile controls, Chancery/courtyard access, and a 128-second goal-directed two-map route.
- All five ending UIs passed in browser, including a mobile ending scroll/restart check. All five full-campaign browser routes passed with four historical host perspectives, the four authored quests, and the required source records.
- The gate also passed 25 RPG core tests, 9 learning/life tests, the HTTP server test, renderer-load test, 14 AI/Worker tests, the historical audit, the 9-image provenance audit, 10 ending route variants, static build, `npm run build`, `npm run lint`, `npm run check`, and `npm test`.
- A possession UI regression was fixed: hosts with `money.amount: null` now say that personal funds are not established by the selected sources instead of showing `null코페이카`. The core regression test covers both unknown funds and a known kopeks amount.
- No production Worker URL or secrets were available. `LIVE_AI` remains `BLOCKED_NO_KEY / UNVERIFIED`; local tests prove server-side boundaries and offline fallback only, not a live model request. A human playtest on the final deployed site remains pending.
