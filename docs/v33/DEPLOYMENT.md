# V33 deployment and live AI status

## Static game

The repository root serves the RPG from `index.html`; the former Chancery game remains at `chancery.html`. The RPG uses relative asset paths and is packaged with `npm run build:v33` into `dist-v33/`. The GitHub Pages workflow runs on pushes to `master` and supports manual dispatch. The repository's Pages source must be set to GitHub Actions.

The output is a project site and works below `/historydigital/` because all game assets are relative. The public game has no provider key. The only public AI setting is the optional Worker base URL in `rpg/ai/config.js`.

## Worker

Follow `ai/v33/worker/README.md`. Configure the actual Pages **origin** in `RPG_ALLOWED_ORIGINS`; the repository path is not part of the browser `Origin`. Store `OPENAI_API_KEY` and `RPG_SESSION_SIGNING_KEY` as Worker secrets only. Set an account/project spending cap as well as the Worker's request budget. CORS is not user authentication; anonymous callers can still make custom HTTP requests.

## Current verification

- On 2026-10-30, `npm run acceptance:v33` completed with exit code 0 on the current V33 branch. The detailed run summary and machine-readable browser reports are in `docs/v33/VERIFICATION_2026-10-30.md` and `artifacts/v33/`.
- Playwright headless Chrome ran successfully in this verification. The local browser smoke passed at 1440×900, 1366×768, 390×844, and 360×800, including map movement, clue inspection, save/reload, offline dialogue, source reading, mobile controls, Chancery/courtyard access, and a 128-second goal-directed two-map route.
- All five ending UIs passed in browser, including a mobile ending scroll/restart check. All five full-campaign browser routes passed with four historical host perspectives, the four authored quests, and the required source records.
- The gate also passed 25 RPG core tests, 9 learning/life tests, the HTTP server test, renderer-load test, 14 AI/Worker tests, the historical audit, the 9-image provenance audit, 10 ending route variants, static build, `npm run build`, `npm run lint`, `npm run check`, and `npm test`.
- A possession UI regression was fixed: hosts with `money.amount: null` now say that personal funds are not established by the selected sources instead of showing `null코페이카`. The core regression test covers both unknown funds and a known kopeks amount.
- The repository's Pages workflow is configured for pushes to `master` and manual dispatch. This local branch verification does not itself publish a new Pages build. The last documented Pages deployment is commit `fed554d66a258e58b22e88664355c343f213ba8b`, Actions run [40824442371](https://github.com/coshaman/historydigital/actions/runs/40824442371).
- No production Worker URL or secret was available. `LIVE_AI` remains `BLOCKED_NO_KEY / UNVERIFIED`; local tests prove security and offline fallback only, not a live model request. A human playtest on the final deployed site remains pending.
