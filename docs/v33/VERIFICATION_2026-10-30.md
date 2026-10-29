# V33 verification run — 2026-10-30

## Result

`npm run acceptance:v33` exited 0 on branch `codex/v33-possession-rpg` after the save-description and ending-route fixture fixes. The verified commit `c6ac18708fdb0f05403fd916d91885bef489a655` was then pushed to `master`; GitHub Actions and Pages both completed successfully. The public deployment was checked with HTTP resource fetches and a Playwright gameplay smoke.

## Checks recorded by the run

| Gate | Result |
|---|---|
| RPG core | 25/25 tests passed |
| Learning and life simulation | 9/9 tests passed |
| Local HTTP MIME handling | passed |
| Canvas renderer startup | passed |
| AI/Worker security, memory, limits and fallback | 14/14 tests passed |
| Historical flow audit | PASS; 3 dated arcs, 7 sources, 4 historical packets, 5 quests, 5 ending IDs |
| Pixel asset audit | PASS; 9 PNGs with dimensions and provenance checked |
| Ending reducer matrix | PASS; 10 variants across 5 endings |
| Static RPG build | PASS; 49 files, relative paths, legacy Chancery entry preserved |
| Static integrity, lint, historical check and route tests | PASS |
| Browser viewport smoke | PASS at 1440×900, 1366×768, 390×844 and 360×800 |
| Browser two-map route | PASS; 128,624 ms goal-directed route, source reader scroll, clue, host changes and quest decision |
| Browser Chancery/courtyard route | PASS; access restriction, observer entry, clue inspection and return |
| Ending UI | PASS; all five endings, no gameplay/dialogue panel under the ending, mobile scroll and restart |
| Full campaign browser routes | PASS; all five endings reached from the 1847–1849 campaign |

The detailed machine-readable evidence is in `artifacts/v33/V33_RPG_PHASE1/BROWSER_SMOKE.json`, `artifacts/v33/ENDING_BROWSER_SMOKE.json`, `artifacts/v33/CAMPAIGN_BROWSER_SMOKE.json`, the five per-ending campaign reports, `artifacts/v33/ENDING_ROUTE_MATRIX.json`, `docs/v33/HISTORICAL_FLOW_AUDIT.json`, and `docs/v33/IMAGE_AUDIT.json`. Screenshots for the viewport, ending, and full-campaign routes are stored alongside those reports under `artifacts/v33/`.

## Deployed Pages verification

- GitHub Actions: [V33 GitHub Pages run 40928153096](https://github.com/coshaman/historydigital/actions/runs/40928153096) — success.
- GitHub Pages deployment: [run 40928152549](https://github.com/coshaman/historydigital/actions/runs/40928152549) — success.
- Public entry point and core RPG assets returned HTTP 200. The post-deployment Playwright smoke passed at 1440×900, 1366×768, 390×844, and 360×800, with map transitions, host possession, source reading, save/reload, quest choice, and Chancery/courtyard interactions. Machine-readable evidence and screenshots are in `artifacts/v33/DEPLOYED_PAGES_SMOKE_2026-10-30.json` and `artifacts/v33/V33_RPG_PHASE1_QUICK/`.

## Fixes found during verification

- Possessing a host whose source record has `money.amount: null` previously rendered `null코페이카`. The UI now describes funds as unconfirmed by the selected sources; the RPG core regression test also checks a known `kopeks` balance.
- The BELINSKY browser fixture used the nonexistent answer ID `INTENTIONALLY_WRONG`. The save validator correctly rejected that impossible answer. The fixture now selects an authored distractor, and every ending route is required to survive an engine save/load round trip before it enters the browser matrix.

## External verification still pending

- Live OpenAI Responses API remains `BLOCKED_NO_KEY / UNVERIFIED`; no production Worker URL or secret was present for this run. Local tests cover server-side boundaries and offline fallback only.
- A human playtest on the final deployed Pages build remains pending.
