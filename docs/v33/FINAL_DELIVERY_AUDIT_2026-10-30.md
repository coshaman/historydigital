# V33 final delivery audit — 2026-10-31

## Source revision

- Base source commit: `a1362201ef975dae9c4d3b7cd55a0a44c9db6004` (`chore: retry GitHub Pages deployment`), followed by the route-matrix coverage update in this delivery.
- Fresh full run after the route-matrix update: `npm run acceptance:v33`, exit code 0. The generated route matrix covers all 24 four-choice vectors in 121 complete fixtures.
- The run covers reducer/save and host isolation, source and asset audits, offline AI/Worker validation, all five authored endings, all five full campaign routes, and browser checks at 1440×900, 1366×768, 1111×720, 390×844, and 360×800.
- The browser checks report viewport-matching document widths, visible controls, save restoration, no page errors, all five ending screens, and a playable full route for each ending.
- A previously omitted mixed vector (`HOLD_FOR_CORRECTION`, `HOLD_NOTICE`, `REFUSE_NAMING`, `PRESERVE_LETTER`) was exercised as a complete route and resolved through the authored `DOSTOEVSKY_PETRASHEVSKY` judgment. The matrix now reports all 24 combinations and no unsupported-vector claim.
- The static build contains 67 files and the preserved Chancery entry. Lint, historical checks, route tests and static integrity checks pass.

## Fixes included in this audit

- Removed the external Google Fonts `@import` from the RPG stylesheet so first paint and browser screenshot capture do not wait on a third-party font host. The existing local/system serif and monospace fallback stacks remain in place.
- Added a regression test that rejects remote stylesheet imports in the RPG stylesheets.
- Added the 1111×720 viewport to browser acceptance, made the five-viewport count explicit, and made a failed browser report return a failing process exit code.
- Captured font-face readiness in campaign ending reports for diagnosis.

## Release limits

- Live OpenAI dialogue is **not verified**. This environment has no Worker URL, OpenAI key, Cloudflare token, or Pages Actions variable. The game remains completable with authored offline dialogue. Follow `docs/v33/AI_WORKER_SETUP.md` to deploy and configure the optional Worker; keep provider and signing keys in Cloudflare Worker secrets.
- GitHub Pages workflow run `41072288431` completed successfully after retry. The deployed site was freshly opened in the browser and rendered the Petersburg map, date/time, map controls, and touch controls.
- The public AI Worker remains unconfigured. The browser still uses authored offline dialogue unless a public Worker origin is added to the repository's Pages Actions variable and the Pages build is rerun.
- Automated browser routes are not a human playtest. No human playtest is claimed in this audit.

## External review package

`RUSSIAN_LIVES_V33_POSSESSION_RPG_VERIFICATION.zip` is the review package. It contains source, setup and deployment instructions, checked-in historical sources, asset provenance, test logs, browser reports, and screenshots. It excludes `.git`, `node_modules`, and generated local build output.

- Archive integrity: `7z t` passed, 656 files. The archive excludes `.git`, `node_modules`, generated build output, and its own ZIP file.
- Clean extraction: the extracted archive passed `npm run acceptance:v33`, including browser routes for all five endings. The local npm cache did not contain `three@0.180.0`, so the acceptance used the already-installed locked dependencies copied into the extraction; no source files were copied from outside the archive.
- Source-tree and extracted-copy runs both passed `npm run acceptance:v33` after adding the 24th mixed action vector.
- Browser captures and machine-readable acceptance reports are included under `artifacts/v33/`.
