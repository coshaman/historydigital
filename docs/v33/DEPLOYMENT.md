# V33 deployment and live AI status

## Static game

The repository root serves the RPG from `index.html`; the former Chancery game remains at `chancery.html`. The RPG uses relative asset paths and is packaged with `npm run build:v33` into `dist-v33/`.

### Vercel

The repository-root `vercel.json` selects the static “Other” preset, runs `npm ci` and `npm run build:v33`, and publishes `dist-v33/`. Import the repository with its root directory set to the repository root and Production Branch set to `master`. Configure the optional public Worker origin as `RPG_AI_API_BASE_URL` in **Project → Settings → Environment Variables**; the value is embedded in the static client at build time, so it is public configuration. Redeploy after changing it. The Vercel setup, production/preview scope, and secret-handling instructions are in the root [README](../../README.md).

GitHub Pages remains a supported alternative: its workflow runs on pushes to `master` and supports manual dispatch. The repository's Pages source must be set to GitHub Actions.

The output works at a domain root or below `/historydigital/` because all game assets are relative. The public game has no provider key. The only public AI setting is the optional Worker base URL in `rpg/ai/config.js`.

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
- The focused claim-ledger test passed 7/7, and full `npm run acceptance:v33` passed, including all browser viewport and ending/campaign route checks. The verifier checks that each cited object is a visible source object available in the referenced campaign chapter. The follow-up was subsequently deployed in commit `a0fa6e1`; see “Latest push and public Pages verification” below.
- Live AI remains `BLOCKED_NO_KEY / UNVERIFIED`; human playtesting is pending.

## Latest push and public Pages verification — 2026-10-30

- Commit `a0fa6e1d88a63b040b298b09dc6cd2d65bde8766` was pushed to both `master` and `codex/v33-possession-rpg`.
- V33 Pages workflow [40964982387](https://github.com/coshaman/historydigital/actions/runs/40964982387) and Pages deployment workflow [40964981998](https://github.com/coshaman/historydigital/actions/runs/40964981998) both completed successfully.
- The published site at `https://coshaman.github.io/historydigital/` passed the fresh Chrome smoke at 1440×900, 1366×768, 390×844 and 360×800. All four document widths matched their viewport widths; controls were visible and the saved clue restored. Report and captures are in `artifacts/v33/V33_RPG_PHASE1_QUICK/`.
- The historical claim ledger is part of the deployed static bundle. This frontend-only smoke does not call a live AI provider. `LIVE_AI` remains `BLOCKED_NO_KEY / UNVERIFIED`, and human playtesting remains pending.

## Worker URL wiring follow-up — 2026-10-30

- Fixed a configuration gap between setup instructions and runtime: the Pages workflow now passes the public `RPG_AI_API_BASE_URL` repository variable to the static build, which injects the validated origin into `window.V33_RPG_AI_API_BASE_URL`.
- The build rejects non-HTTPS URLs except localhost development, embedded credentials, non-root paths, queries and fragments; it excludes provider secrets and keeps offline behavior when the variable is empty. Automated configuration tests pass 2/2.
- The current repository has no Actions variables and the published runtime config is empty. No Wrangler CLI/session or Worker API credentials are available, so live AI remains unverified. Configure only the public URL as an Actions variable; keep `OPENAI_API_KEY` and `RPG_SESSION_SIGNING_KEY` as Cloudflare Worker secrets.

## Latest source-gated realm and campaign deployment — 2026-10-30

- Commit `03f6c9e44a918a55bdb0631b6a1b46397cfc08d6` deployed successfully in V33 Pages workflow [41015842048](https://github.com/coshaman/historydigital/actions/runs/41015842048).
- The public entry page, AI config, build manifest, and current `rpg/engine/game-state.js` all returned HTTP 200. The deployed code contains the literary source gate. Its public AI URL is empty and the manifest correctly reports `publicAiWorkerConfigured: false` and `BLOCKED_NO_KEY_UNVERIFIED`.
- Public Playwright verification passed the novel-first《외투》 entry, in-realm quest, and return to the historical map; all five public campaign routes also passed. The Uvarov full-route video is `artifacts/v33/campaign-full-run-uvarov-1440x900.webm`. Reports: `artifacts/v33/DEPLOYED_PAGES_POST_PUSH_2026-10-30.json`, `artifacts/v33/OVERCOAT_REALM/BROWSER_SMOKE.json`, and the `CAMPAIGN_BROWSER_SMOKE*.json` files.
- The final external-review ZIP was extracted into a clean directory; after installing its locked dependencies from cache, `npm run acceptance:v33` exited 0, including all five local browser campaign routes. The raw log is `artifacts/v33/V33_ARCHIVE_EXTRACTED_POST_PUSH_2026-10-30.log`.
- This is automated public-site verification, not a human playtest. Live AI remains unconfigured and unverified; authored offline fallback remains active.
