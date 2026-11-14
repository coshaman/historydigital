# V37 verification status

Checked 2026-11-11 in the `history` worktree. This snapshot records evidence boundaries; it is not a completion declaration.

```text
V37_CORE_WORLD_READY: NO
V37_EVENT_SOURCE_VERIFICATION: NO
V37_ALL_45_FULL_PLAYABLE_CHAINS: NO
V37_CITYWIDE_SURVIVAL: NO
V37_FULL_DESKTOP_AND_MOBILE_ACCEPTANCE: NO
V37_EVIDENCE_PACKAGE: CREATED_AND_CHECKSUM_VERIFIED
```

## Confirmed in this checkout

- `npm run check` and `npm run build:v33` passed in the recorded baseline; the 37-resident three-seed simulation preserved save/reload state and all residents reached their first night-rest destination.
- On 2026-11-10, `npm run check` passed all active gates and `npm run build:v33` produced a 504-file static build.
- A committed `PURCHASE_MEAL` route now retains priority over ordinary due shifts, income work, rent, rest, and personal/social goals; urgent living-event and medical responses may still interrupt it. `v37-bulk-food-supply-test.mjs` reproduces the due-shift interruption and passes after the correction. The complete long replay was started but stopped after exceeding three minutes without producing a report, so this does not close the citywide-survival gate.
- Multiple event slices have engine tests and desktop/mobile browser evidence. The exact existing files are listed by event in `45_EVENT_PLAYABILITY_MATRIX.csv`; finding a script or screenshot does not prove the whole event chain.
- A 2026-11-11 live Chrome replay exercised Matryona's three-stage stall quest, source-reader logging for Turgenev's three-paragraph excerpt, and entry/possession in the 1836 Inspector scene. The scene did not reach its later stages. Step-by-step limits are in `artifacts/v37/BROWSER_ACCEPTANCE/MANUAL_BROWSER_TRACE_2026-11-11.md`.
- The historical scene review covers Senate Square 1825, Gogol's Inspector General 1836, and the 1861 Emancipation event. Earlier acceptance evidence records participant quests, role switching, action zones, dialogue and closing choices at desktop and mobile sizes.
- All 45 event catalog entries remain `DESIGN_SEED_NOT_VERIFIED`. Runtime code references and a test file do not establish historical sourcing.

## Open gates

- The latest accepted 37-resident, three-seed 24-hour replay passed movement, night-rest, meal access, and deterministic save/reload gates. Seeds 0, 1848, and 1849 each ended with zero residents at critical hunger and exact save/reload parity. This closes the recorded 24-hour critical-hunger regressions; survival beyond this 24-hour window remains unverified.
- A one-seed replay observed 18 catalog IDs; this is not proof that the other 27 cannot trigger. No verified end-to-end matrix currently proves each event's natural trigger, participant arrival, physical interaction, world consequence, save/load, and causal follow-up.
- Many events have no event-specific browser replay or retained screenshot. `45_EVENT_PLAYABILITY_MATRIX.csv` records file presence only and explicitly marks the full chain as unproven.
- Catalog source claims, everyday-life claims, and historical context still need source-by-source review. Draft historical anchors are not evidence.
- The earlier shell/browser-automation attempt could not reach the local preview (`EACCES`/connection timeout). A live Chrome session later reached it, but detached in the 1836 scene before exit or later stages; no complete campaign, AI response, save/reload, ending, mobile, or console-error acceptance was captured. Screenshots from this manual session were visible in the interaction transcript but not exported to PNG files.
- Hardware-GPU performance and a human playtest remain unverified.

## Relevant evidence

- `BASELINE.md` — repository, data, and baseline checks.
- `ECONOMY_PILOT_STATUS.md` — dated economy/event implementation and remaining gaps.
- `45_EVENT_PLAYABILITY_MATRIX.csv` — conservative per-event file-discovery map.
- `artifacts/v37/BROWSER_ACCEPTANCE/MANUAL_BROWSER_TRACE_2026-11-11.md` — bounded live-browser observations and explicit coverage limits.
- `artifacts/v37/` and `artifacts/v38/HISTORICAL_LIVING_SCENES/` — retained reports and captures.

V37 remains in progress. No historical source, event chain, survival gate, or browser route is promoted to complete by this report.

## 2026-11-11 route-congestion food regression

The seed-1849 full-day trace showed printer Ekaterina ending at hunger 90.84 despite holding money and available food; she began a late trip from the courtyard and did not reach the quay stall before closing. Added a route-map crowd delay to the planner's market-closing estimate, capped at 30 minutes on top of the existing margin. The low-crowd printshop-to-market purchase pilot still passes.

The new three-seed 37-resident replay passed seeds 0, 1848, and 1849 with hashes `5c4c302a`, `538f346e`, and `eb63e0d4`, exact save/reload parity for every seed, 37/37 first-night sleep arrivals, zero critical-hunger residents in each seed, and 864 collision snapshots. Runtime: 418.783 seconds. The scripted V37 food reachability, allocation, and bulk supply checks pass. Evidence: `artifacts/v37/FULL_DAY_37_MEAL_CONGESTION_MULTI_SEED.json`.

The broader V37 acceptance remains **NO**: all 45 full event chains and their historical provenance are not established, current-build browser and complete mobile/desktop campaign acceptance are still unverified, and the local browser attempt to open port 4204 timed out. This food fix does not promote citywide long-duration survival or `V37_CORE_WORLD_READY`.

## 2026-11-11 deterministic food allocation and bedtime routing

A full-day trace showed several residents choosing the same seller while its last portions were already being approached by other buyers. The routine planner now treats an active `PURCHASE_MEAL` route as a one-portion reservation, so later residents select another reachable open offer or do not claim unavailable stock. A second trace found non-critical residents departing so late that their meal errand prevented their scheduled return home. New meal trips now require a feasible round trip to the authored sleeping place before bedtime; existing trips and critical hunger remain eligible, and the inn's fixed evening service remains available. Return-path estimates are memoized by map positions, resident map access, and access-hour state.

Verification: `npm run v37-food-allocation`, `npm run v37-bulk-food-supply`, and `node scripts/v37-food-aid-test.mjs` pass. The 37-resident 24-hour seed-0 replay passes: 37/37 first-night home arrivals, 22 paid market meals to 21 distinct buyers, one paid inn meal, one resident ending at hunger 90+, save/reload hash `b8649f84`; run time 72.988s. The final 3-seed replay after memoization passed (0, 1848, 1849), with hashes `b8649f84`, `731bdab8`, `b109b7bd`, 864 collision snapshots, 37/37 first-night arrivals, exact save/reload parity, and total runtime 450.493s. Seed 0 ended with one resident at hunger 90+ and preserved the one-seed food results above. Memoization preserves deterministic state; the full multi-seed run remains expensive and needs further profiling. This improves food access but does not close broader citywide survival, all 45 staged event chains, historical source verification, full browser campaign, or hardware performance gates.

## 2026-11-11 meal-stall arrival margin

A 24-hour trace showed `lodging_tatyana` setting out for a stall with only 157 minutes before closing. The planner's 135-minute open-grid estimate was shorter than the observed 162-minute trip. Food route planning now reserves 30 minutes only when checking stall closing time; the underlying path estimate and bedtime return estimate remain unchanged. A focused regression case rejects the late trip, while the bulk-food test starts its remote worker at the beginning of the stall window so its expected trip is actually reachable.

Verification: `npm run check` passes, including food reachability, allocation, supply, mortality, all catalog event tests, realm checks, and skill profile checks. The 37-resident seed-0 day replay passes with 37/37 first-night arrivals, zero residents ending at critical hunger, 21 distinct market meal buyers, and identical live/save-reload hashes `acf62049` (runtime 129.483s). A subsequent three-seed replay of the same code passed for seeds 0, 1848, and 1849 with distinct hashes `acf62049`, `0ef8528a`, and `977e66e8`; the first replay again recorded 37/37 arrivals, zero residents at critical hunger, and exact save/reload parity. Total runtime was 402.159s over 864 collision snapshots. The report retains detailed hunger and arrival metrics for the first seed only, so those values are not asserted for seeds 1848/1849. `npm run v37-coach-fare-browser` passes at 1440×900, 768×900, and 390×844, with all three choices, save/reload, zero browser errors, and no horizontal overflow; captures and result are in `artifacts/v37/BROWSER_ACCEPTANCE/COACH_FARE_E10_BROWSER_ACCEPTANCE.json` and adjacent PNGs. Historical source verification, complete playability of all 45 chains, broad campaign browser acceptance, and GPU/human testing remain open.

## 2026-11-11 E03 browser replay

Ran the E03 cold-wave scene against the current static build. Desktop and mobile both presented three available choices; the last option could be reached by scrolling. The purchase branch persisted firewood and event stage through save/load, with no page/server errors or horizontal overflow. Captures and JSON are listed in the E03 row of `45_EVENT_PLAYABILITY_MATRIX.csv`. Engine tests cover the pooled-fuel and defer branches; this browser run covers the purchase branch only, so E03's full natural-trigger-to-follow-up gate remains unproven and its event source remains `DESIGN_SEED_NOT_VERIFIED`.

The matrix's checked-in artifact paths were then checked against disk. Fifteen stale paths with duplicated directory segments were corrected (E05, E20, E22, E25, E31, E38, E41, and E45); the E39 screenshot paths were corrected separately. All paths currently listed in the matrix now resolve. Events with `NONE_FOUND` still have no retained browser artifact, and every full trigger-to-follow-up field remains conservative.

Ran E14's seeded charity-day browser route at 1440×900 and 390×844. Both cases showed the relief ration choice, executed the purchase branch, saved `RATION_PURCHASED`, had no page/server errors, and no horizontal overflow. The JSON and captures are listed in the E14 matrix row. This confirms the seeded choice path; historical event provenance and the natural trigger-to-follow-up chain remain unverified.

## 2026-11-11 E39 publication provenance

Added separate source-register records for the Presidential Library's 1847 `Современник`, vol. 1 [nos. 1/2] catalog entry and the scholarly editorial note for Turgenev's first publication. The modern scholarly note identifies «Хорь и Калиныч» in 1847, no. 1, «Смесь», pp. 55–64, with censorship approval on 30 December 1846; the Presidential Library record identifies the 1847 volume and digital-copy holding. The in-world reading date (1 June 1847) follows publication. The readable Russian passage remains explicitly attributed to a later fourth collected edition, not represented as a transcription of the first printing. Marked the two-kopeck fictional transaction as a `BALANCE_ESTIMATE`; it is not evidence of a historical journal price.

Verification: the new `v37-e39-publication-provenance-test.mjs`, E39 event test, event provenance audit, historical lint, and the full `npm run check` pass. The catalog title still describes an authored fictional reading event; this evidence verifies the literary text's publication context, not that this fictional reading group or purchase occurred historically. The source references are `rpg/data/source-register.json` entries `V37-SOVREMENNIK-1847-T1-1-2` and `MOD-RVB-TURGENEV-KHOR-1847`.

## 2026-11-11 event-chain regression update

The latest `npm run check` passed after correcting overlapping E13-watchman/E45-procession routing. The focused E02→E26 replay begins with an ordinary final-stock market purchase, follows the scheduled restock and adjusted sale, observes both participants travel to the rent notice, resolves a rent choice, and confirms exact save/reload parity. The E13, E26, and E35 focused tests also pass. The natural-chain test is available as `npm run v37-natural-price-rent-chain`. These checks do not change the open gates above.

## 2026-11-11 connected event-chain and browser update

Current regression checks now exercise a natural E02 stockout/restock/adjusted-sale path into both E13 price dispute and E26 rent notice; filing the E13 complaint then triggers E23, gives residents individually scoped rumor knowledge, and sends the carrier toward the physical rumor point. This uncovered and fixed a distance mismatch between the meal trade rule and the post-sale event rule. The standard `npm run check` passes with these regressions included.

The latest E13 browser replay passed at 1440×900 and 390×844: both choices rendered, the selected trade persisted after reload, horizontal overflow was zero, and browser/server errors were absent. Its captures and JSON are in `artifacts/v37/BROWSER_ACCEPTANCE/`. The E02→E13→E23 path has engine integration evidence, not yet a full live-browser replay. This is partial event coverage and does not close the full-world or all-45-event gates.
