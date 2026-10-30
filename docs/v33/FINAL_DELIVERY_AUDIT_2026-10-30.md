# V33 final delivery audit — 2026-10-30

## Source revision

- Verified source commit: `9e019a76969216a8d3edc98c2b346a0f83d37383` (`fix: harden V33 startup and viewport acceptance`).
- Fresh full run: `npm run acceptance:v33`, exit code 0. Raw output: `artifacts/v33/V33_ACCEPTANCE_FINAL_2026-10-30.log`.
- The run covers reducer/save and host isolation, source and asset audits, offline AI/Worker validation, all five authored endings, all five full campaign routes, and browser checks at 1440×900, 1366×768, 1111×720, 390×844, and 360×800.
- The browser checks report viewport-matching document widths, visible controls, save restoration, no page errors, all five ending screens, and a playable full route for each ending.
- The static build contains 67 files and the preserved Chancery entry. Lint, historical checks, route tests and static integrity checks pass.

## Fixes included in this audit

- Removed the external Google Fonts `@import` from the RPG stylesheet so first paint and browser screenshot capture do not wait on a third-party font host. The existing local/system serif and monospace fallback stacks remain in place.
- Added a regression test that rejects remote stylesheet imports in the RPG stylesheets.
- Added the 1111×720 viewport to browser acceptance, made the five-viewport count explicit, and made a failed browser report return a failing process exit code.
- Captured font-face readiness in campaign ending reports for diagnosis.

## Release limits

- Live OpenAI dialogue is **not verified**. This environment has no Worker URL, OpenAI key, Cloudflare token, or Pages Actions variable. The game remains completable with authored offline dialogue. Follow `docs/v33/AI_WORKER_SETUP.md` to deploy and configure the optional Worker; keep provider and signing keys in Cloudflare Worker secrets.
- GitHub Pages workflow run `41071005946` completed successfully for commit `841c16f5c98d30c4e5de2345717348edb34ae155`; the deployed site was freshly opened in the browser and rendered the Petersburg map, date/time, map controls, and touch controls.
- The public AI Worker remains unconfigured. The browser still uses authored offline dialogue unless a public Worker origin is added to the repository's Pages Actions variable and the Pages build is rerun.
- Automated browser routes are not a human playtest. No human playtest is claimed in this audit.

## External review package

`RUSSIAN_LIVES_V33_POSSESSION_RPG_VERIFICATION.zip` is the review package. It contains source, setup and deployment instructions, checked-in historical sources, asset provenance, test logs, browser reports, and screenshots. It excludes `.git`, `node_modules`, and generated local build output.

- Archive integrity: `7z t` passed, 653 files, 36,856,942 uncompressed bytes.
- Clean extraction: `npm ci --offline` succeeded; `npm run acceptance:v33` exited 0 from the extracted copy.
- Source-tree run: `artifacts/v33/V33_ACCEPTANCE_FINAL_2026-10-30.log`.
- Extracted-copy run: `artifacts/v33/V33_ARCHIVE_REVALIDATION_FINAL_2026-10-30.log`.
- Offline dependency install: `artifacts/v33/V33_ARCHIVE_NPM_CI_OFFLINE_FINAL_2026-10-30.log`.
