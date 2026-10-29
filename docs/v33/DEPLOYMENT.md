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

## Latest pushed build — 2026-10-30

- Commit `abb14bde7b32bc45849d470ff91afaecb986fe45` was pushed to both `master` and `codex/v33-possession-rpg`. GitHub Actions V33 Pages run [40957947798](https://github.com/coshaman/historydigital/actions/runs/40957947798) built and deployed successfully.
- After deployment, the public site was opened in Chrome at `https://coshaman.github.io/historydigital/`. The browser smoke passed at 1440×900, 1366×768, 390×844 and 360×800; it checked map rendering, touch controls, clue inspection, persistence, evidence hotkey, source reading, possession, map traversal, source-gated printshop choice, and Chancery/courtyard access. Raw report and screenshots are in `artifacts/v33/V33_RPG_PHASE1_QUICK/`.
- This public-site smoke does not verify the optional AI Worker. `LIVE_AI` remains `BLOCKED_NO_KEY / UNVERIFIED`, and a human playtest is still pending.

## Historical source audit follow-up — 2026-10-30

- Added an auditable ledger linking 13 unique aligned Russian/Korean source paragraphs to visible in-game source objects and campaign arcs. Where a claim is cited by a quest, the verifier checks that quest's source dependency too. It resolves each paragraph against its registered source packet, edition, and contiguous range and rejects duplicate or unsupported references.
- The focused claim-ledger test passed 7/7, and full `npm run acceptance:v33` passed, including all browser viewport and ending/campaign route checks. The verifier checks that each cited object is a visible source object available in the referenced campaign chapter. This follow-up has not yet been deployed in the published site.
- Live AI remains `BLOCKED_NO_KEY / UNVERIFIED`; human playtesting is pending.
