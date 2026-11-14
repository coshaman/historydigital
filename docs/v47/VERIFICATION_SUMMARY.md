# V47 verification snapshot — 2026-11-13

## 2026-11-14 follow-up

- Grounding pass: added a soft cast shadow and tight contact shadow under world props and characters, and ordered map actors/props by their ground baseline so foreground overlaps read consistently. `scripts/v47-depth-rendering-test.mjs` is part of `npm run check`.
- Fixed Sofiya's salon personal-goal action ID to match the physical host-reading action, including the campaign replay's preferred route.
- Fresh verification: `npm run check` passed the full configured project suite (exit 0); `npm run build:v33` passed and emitted 549 files; `git diff --check` passed.
- Browser limitation: a new visual capture was not produced in this pass. The preview server was started, but the in-app browser remained on its `ERR_CONNECTION_REFUSED` page and Browser Use rejected navigation from that `data:` error page. The previously recorded MAIN01 desktop/mobile captures remain available, but do not visually verify this new shadow pass.
- Status remains **PARTIAL**: MAIN01 has prior complete route evidence but still has the archival image-collation gaps recorded below; MAIN03 and MAIN05 have not reached the supplied story depth, with MAIN05 deferred.

Overall acceptance remains **PARTIAL**. This revision passes the full project regression suite, current normal/alternate 36-beat browser routes, all 23 seeded choice cases with actual viewport-intersection assertions, a continuous 36-beat reducer replay, the 121-route ending matrix, causal V47-choice propagation through all five ending records, and the date-aligned four-day no-player MAIN05 survival check. A 14-day disease/survival outcome, historical page-image collation, and independent human playtest remain open.

**Latest MAIN01 focused delta — 2026-11-13:** normal and alternate desktop replays each completed MAIN01 12/12; both also passed the final source-reader layout and aftermath route. The printshop now includes an authored compositor's shelf, and winter snow / spring drizzle surfaces were reviewed at desktop and mobile-like widths. The current full `npm run check` and `npm run build:v33` pass. MAIN01 gameplay is substantially implemented, but archive-image collation for the cited RGIA folios and subscriber letter, a final independent route review, and MAIN01 acceptance packaging remain open. MAIN03 and MAIN05 are not yet implemented to their supplied story depth; MAIN05 is deliberately last.

**Focused update — 2026-11-13:** MAIN01 normal and alternate browser replays each completed 12/12 beats with 9 distinct embodied residents and zero page errors. The A03 book-to-choice handoff works at adjacent physical objects. The 13-paragraph bilingual source was text-collated against the searchable OCR of the 1928 Academia reprint (printed pp. 108–111), and the original 1848 Talnikov scan leaves 9–11 have now been visually inspected and collated. The cited RGIA Panaev/Krylov folios, unsigned margin note, and subscriber-letter scans remain text-checked against scholarly transcription but are not visually inspected; historical-source acceptance therefore remains partial. Nevsky winter and spring visuals, weather surfaces, and the printshop shelf were reviewed at desktop/mobile-like widths without overflow or browser errors. Details: `docs/v47/IMPLEMENTATION_AND_QA.md`, `rpg/data/source-register.json`, and `artifacts/v47/MAIN01_ONLY_REPLAY/`.

| Check | Result | Evidence |
|---|---|---|
| V47 story wiring, dates, material effects, cholera, save/load | PASS | `npm run check`; `scripts/v47-main-stories-test.mjs` |
| Full project regression suite | PASS | `npm run check` completed through `v37-skill-profiles` |
| Vercel static build | PASS | Latest `npm run build:v33`; 548 files in `dist-v33/`; unused research imagery stays outside deploy assets |
| Source/language lint | PASS; source verification partial | `scripts/historical-lint.mjs`; image collation qualifications remain in source register |
| Five ending routes | PASS, representative only | `scripts/v47-five-ending-regression.mjs`; one route for each of five distinct endings |
| V47 choice → saved ending aftermath | PASS | `scripts/v47-ending-consequence-test.mjs`; two physical MAIN01 choices produce different saved aftermath in each of five endings |
| Exhaustive 121-vector ending matrix | PASS | `node scripts/v33-ending-route-matrix.mjs`; 121 route vectors, 23 legally finishable action vectors, five distinct endings; report `artifacts/v33/ENDING_ROUTE_MATRIX.json` |
| AI source chronology | PASS | `npm run check`; dated source allowlist and access-time assertions |
| Seeded desktop/mobile browser acceptance | PASS | 23/23 cases at 390×844 and 1440×900; each selected button was inside the viewport before click, zero overflow/errors |
| MAIN01 Nevsky street visual smoke | PASS | Final build at 1440×900 and 390×844; spring rain, moving carriage, no horizontal overflow or browser errors; screenshots in `artifacts/v47/MAIN01_STREET_VISUAL_REVIEW/` |
| Date continuations | PASS | 1849-03-20 → 1849-04-01 and 1849-12-22 → 1850-01-03 |
| Normal full V47 browser route | PASS | 36/36 story beats, 83 transitions, 6 screenshots, 0 page errors; 9/11/8 distinct embodied characters in MAIN01/03/05 |
| Alternate full V47 browser route | PASS | 36/36 story beats, 84 transitions, 6 screenshots, 0 page errors; 9/11/8 distinct embodied characters |
| Alternate route navigation diagnosis | RESOLVED | Replay pathfinder now honors the game’s resident-yield movement at MAIN01/A05; `V47_ALTERNATE_BROWSER_NAVIGATION_DIAGNOSIS.json` |
| Continuous chronological reducer replay | PASS | normal and alternate each resolve 36 beats; three unattended events each move NPCs, apply authored outcomes, and persist |
| No-player MAIN05 survival | PASS for the four-day acceptance window; 14-day outcome pending | The deterministic date-aligned replay advances through 1848-06-15 to 1848-06-18, records 79 meal events and 27 cholera exposures, and ends with zero food-deprivation deaths. The innkeeper retains her private supper service for guests and also walks to a public Nevsky street service later in the evening. The cholera exposure/death curve beyond this four-day window is not verified. See `artifacts/v47/14_DAY_SIMULATION/V47_4_DAY_NO_PLAYER_REPLAY.json` and the one-day access trace `artifacts/v47/FOOD_TRACE_1D_AFTER_PUBLIC_SOUP.json`. |
| Current normal/alternate browser campaign | PASS | each route resolves 36/36 beats, uses 9/11/8 embodied residents by story, and has zero page errors |
| Julian source availability | PASS | `scripts/v47-main-stories-test.mjs`; manifesto, Panaev letter, Pushkin obituary, and Dostoevsky letter remain behind Gregorian publication/access dates |
| Completed-story objective | PASS in reducer test | `getV47CompletionGuidance` returns V47 aftermath instead of retaining an unrelated legacy objective |
| Live browser autonomous event | PASS for recorded arrest dispatch; MAIN05 autonomy PARTIAL | campaign log records unattended arrest-team dispatch on 1849-05-05; four-day unattended cholera/food replay is deterministic, while the longer disease curve remains pending |
| Human playtest / new independent visual review | PENDING | No such review is claimed |

## Source and chronology notes

The *Economist* passage is registered as a contemporary newspaper dispatch published on 1848-07-08; in-game access begins on that date. Its correspondent’s weather explanation and reported numbers remain attributed claims. The complete Panaev/Nekrasov subscriber letter is a contiguous five-paragraph Russian/Korean packet with access beginning 1848-11-29 Gregorian. Original Russian-calendar dates and their Gregorian conversions are retained. The almanac permission/ban dates rely on a modern scholarly editorial note, not an 1848 document available to the player; that note stays outside the in-world reader. The Talnikov 1848 scan leaves 9–11 have been visually collated. RGIA folios and subscriber-letter authorized copies still need image collation; their text and folio bounds are checked against scholarly apparatus, not represented as scan-verified. `historical-lint` checks project linkage and consistency, not archive images themselves.

## Browser evidence files

- Normal complete route: `artifacts/v47/BROWSER_CAMPAIGN_REPLAY/V47_NORMAL_BROWSER_CAMPAIGN.json` and `V47_NORMAL_BROWSER_PROGRESS.json`.
- Alternate complete route: `artifacts/v47/BROWSER_CAMPAIGN_REPLAY/V47_ALTERNATE_BROWSER_CAMPAIGN.json` and `V47_ALTERNATE_BROWSER_PROGRESS.json`.
- Resolved navigation diagnosis: `artifacts/v47/BROWSER_CAMPAIGN_REPLAY/V47_ALTERNATE_BROWSER_NAVIGATION_DIAGNOSIS.json`.
- Route index and screenshots: `artifacts/v47/BROWSER_CAMPAIGN_REPLAY/V47_BROWSER_CAMPAIGN_INDEX.json` and sibling PNGs.
- Seeded responsive UI evidence: `artifacts/v47/BROWSER_ACCEPTANCE/`.
- NPC simulation evidence: `artifacts/v47/CONTINUOUS_STORY_REPLAY/V47_CONTINUOUS_REPLAY.json`.
- No-player simulation: `artifacts/v47/14_DAY_SIMULATION/V47_4_DAY_NO_PLAYER_REPLAY.json`; rerun with `node scripts/v47-14-day-simulation.mjs --days=4`. The replay now advances the world date at day boundaries and asserts no food-deprivation fatality within the four-day acceptance window.
- Five representative endings: `artifacts/v47/ENDING_REGRESSION/V47_FIVE_ENDING_REGRESSION.json`.
- Causal choice-to-ending regression: `scripts/v47-ending-consequence-test.mjs`.
- New browser choice-viewport check: `scripts/v47-browser-acceptance.mjs`; run against system Chrome via `PLAYWRIGHT_EXECUTABLE_PATH`.
- Latest current-build browser result: `artifacts/v47/BROWSER_ACCEPTANCE/V47_BROWSER_FINAL_ATTEMPT_2026-11-12.json`.

## 2026-11-13 MAIN01 follow-up

The implementation adds individual Russian movable-type placement and proofing to MAIN01; the desktop/mobile browser replay clicks each tile and completes the print task. Normal and alternate MAIN01 browser routes resolve 12/12 beats across 9 possessed residents, with zero page errors; normal and alternate desktop routes and normal mobile were replayed. Type-board screenshots and route logs are in `artifacts/v47/MAIN01_ONLY_REPLAY/`. The RSL catalog marks its 1990 facsimile as open access, but its viewer was not inspectable in the available browser. The 1928 Academia text was checked against the game excerpt, and original 1848 scan leaves 9–11 were visually inspected. The archival records listed above remain open for image collation.

**Fresh MAIN01 source-label replay — 2026-11-13:** after correcting the 1928 reprint link and reader witness label, normal and alternate Chrome browser campaigns completed MAIN01 12/12 with 9 possessed residents each and zero page errors. Both read the almanac contents notice and all 13 RU/KO Talnikov paragraphs. Reports: `artifacts/v47/MAIN01_ONLY_REPLAY/V47_NORMAL_MAIN01_BROWSER_CAMPAIGN.json` and `V47_ALTERNATE_MAIN01_BROWSER_CAMPAIGN.json`. The original Talnikov leaf images have since been visually collated; RGIA and subscriber-letter images remain open as noted above.
