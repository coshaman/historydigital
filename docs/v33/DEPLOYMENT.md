# V33 deployment and live AI status

## Static game

The repository root now serves the RPG from `index.html`; the former Chancery game remains at `chancery.html`. The RPG uses relative asset paths and is packaged with `npm run build:v33` into `dist-v33/`. The GitHub Pages workflow is manual (`workflow_dispatch`) so a normal source push does not publish the site. Configure the repository's Pages source as GitHub Actions, then run **V33 GitHub Pages** from the Actions tab when publication is authorized.

The output is a project site and works below `/historydigital/` because all game assets are relative. The public game has no provider key. The only public AI setting is the optional Worker base URL in `rpg/ai/config.js`.

## Worker

Follow `ai/v33/worker/README.md`. Configure the actual Pages **origin** in `RPG_ALLOWED_ORIGINS`; the repository path is not part of the browser `Origin`. Store `OPENAI_API_KEY` and `RPG_SESSION_SIGNING_KEY` as Worker secrets only. Set an account/project spending cap as well as the Worker's request budget. CORS is not user authentication; anonymous callers can still make custom HTTP requests.

## Current verification

- Static output is created locally by `npm run build:v33` and has a relative-path entry.
- Worker security, limits, invalid model output, offline fallback, and the historical and literary host sessions have automated local tests.
- No production Worker URL or secret was available during this build. `LIVE_AI` is therefore `BLOCKED_NO_KEY / UNVERIFIED`; this is not a live provider test.
- The workflow is checked in but has not been run to publish Pages. A human playtest on the final deployed site remains pending.
