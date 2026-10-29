# V33 deployment and live AI status

## Static game

The repository root serves the RPG from `index.html`; the former Chancery game remains at `chancery.html`. The RPG uses relative asset paths and is packaged with `npm run build:v33` into `dist-v33/`. The GitHub Pages workflow runs on pushes to `master` and supports manual dispatch. The repository's Pages source must be set to GitHub Actions.

The output is a project site and works below `/historydigital/` because all game assets are relative. The public game has no provider key. The only public AI setting is the optional Worker base URL in `rpg/ai/config.js`.

## Worker

Follow `ai/v33/worker/README.md`. Configure the actual Pages **origin** in `RPG_ALLOWED_ORIGINS`; the repository path is not part of the browser `Origin`. Store `OPENAI_API_KEY` and `RPG_SESSION_SIGNING_KEY` as Worker secrets only. Set an account/project spending cap as well as the Worker's request budget. CORS is not user authentication; anonymous callers can still make custom HTTP requests.

## Current verification

- `fed554d66a258e58b22e88664355c343f213ba8b` is published from `master`; GitHub Actions run [40824442371](https://github.com/coshaman/historydigital/actions/runs/40824442371) completed its build and deploy jobs successfully.
- The deployed game was opened with a cache-busting build query. Browser QA confirmed a fresh save enables **불러오기**, then loading it restored the saved scene and showed `저장한 현장으로 돌아왔다.`
- Locally, `npm run build:v33`, `npm run lint`, `npm run check`, and `npm test` passed after the save/load fix. The full Playwright smoke runner did not finish within the available run window; the targeted save/load behavior was verified in the deployed browser.
- Worker security, limits, invalid model output, offline fallback, and the historical and literary host sessions have automated local tests.
- No production Worker URL or secret was available. `LIVE_AI` remains `BLOCKED_NO_KEY / UNVERIFIED`; this is not a live provider test. A human playtest on the final deployed site remains pending.
