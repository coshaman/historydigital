# V33 possession RPG delivery status

Updated 2026-10-29 after the acceptance run.

## Verified locally

- `npm run acceptance:v33` passed: 23 RPG core tests, 14 AI/Worker tests, 10 reducer-backed ending routes, static build, repository build/lint/historical checks and legacy route tests.
- Browser smoke passed at 1440×900, 1366×768, 390×844 and 360×800. Document bounds matched each viewport; controls were visible; a saved clue survived reload.
- Browser smoke also exercised offline dialogue, H-key evidence access and the source-gated printshop action. Screenshots and the JSON report are in `artifacts/v33/V33_RPG_PHASE1/`.
- The historical chronology regression is covered: the May 5 letter remains unavailable on April 22 until the dated campaign stage advances. The literary save/reload test verifies the separate literary outcome store.
- The five ending identifiers each resolve in two reducer-backed route variants. These are reducer simulations, not five complete browser playthroughs.
- Static Pages output is in `dist-v33/`; `chancery.html` remains available. The Pages workflow is manual-only.

## Scope and release limits

- All three historical arcs and the literary realm are represented in game data and quest stages. The browser automation does not yet complete every arc or every ending in the DOM.
- The Worker has automated offline/security tests, but no production URL or API secret was supplied. Live model behavior is `BLOCKED_NO_KEY / UNVERIFIED`.
- The Pages workflow has not been run to publish, and a human playtest on the deployed site is pending. This build is not marked release-ready.
- Existing project gates requiring a four-host, three-arc complete browser run remain open; the evidence archive must preserve that limit rather than imply full playthrough verification.

## Evidence files

- `artifacts/v33/V33_RPG_PHASE1/BROWSER_SMOKE.json`
- `artifacts/v33/ENDING_ROUTE_MATRIX.json`
- `artifacts/v33/V33_RPG_PHASE1/*.png`
- `docs/v33/DEPLOYMENT.md`
