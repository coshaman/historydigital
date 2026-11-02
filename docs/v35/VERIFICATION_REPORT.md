# V35 release verification

Date: 2026-11-02

## Results

- `npm run acceptance:v35` — PASS. This runs V35 matrices/content/NPC/AI audits, all V33 unit and static checks, then browser acceptance against `dist-v33/`.
- V35 content audit — 8 source-reader records, 6 character profiles, 4 case flows, 10 playable role rows, exactly 5 endings.
- 30-minute NPC replay — all 6 residents moved, 18 movement events, one courier delivery, deterministic replay and save/reload parity.
- AI mock audit — 3 contextual turns for each of 6 fictional voices; passed.
- Browser acceptance — all 5 endings completed. Each route resolved the four 1847–1849 core quests and read the expected source set.
- Browser viewports — 1440×900, 1366×768, 1111×720, 390×844, and 360×800; visible controls, save/load restoration, and no document-width overflow.
- Reduced motion — ambient motion changes the exterior canvas, stops under the reduced-motion preference, and resumes when disabled.
- Source reader — Russian and Korean text, exact excerpt provenance, and source links remain visible at desktop and phone widths; no horizontal overflow.
- Ending UI — all five choices resolve in browser; mobile ending panel scrolls and exposes the restart control.
- Local live API — one actual generation passed with a validated AI response. Only safe status/model/count metadata is recorded.
- Conflict audit — `git ls-files -u` returned no unmerged paths; `git diff --check` passed.

## Repairs found during release testing

1. Campaign replay found a printshop doorway whose configured arrival tile could be occupied by Anna. The game rejected the crossing but displayed the generic “door is still distant” message. Map transitions now choose the nearest deterministic walkable unoccupied tile when the configured arrival tile is blocked. A regression test covers this state; the Anna-led campaign and all five endings now pass.
2. The atmosphere browser test spawned a second server and failed readiness in the current test environment. It now attaches to the same already-running release-artifact server as the other browser acceptance checks, so it exercises the shipped build.

## Evidence files

- `content-audit.json`
- `npc-30-minute-replay.json`
- `WORLDVIEW_BIBLE.md`
- `CHARACTER_KNOWLEDGE_AND_SOURCE_LEDGER.csv`
- `QUEST_SOURCE_DIALOGUE_MATRIX.csv`
- `screenshots/source-reader-overcoat-*`
- `../artifacts/v33/CAMPAIGN_BROWSER_SMOKE_*.json`
- `../artifacts/v33/campaign-full-run-*-1440x900.png`
- `../artifacts/v33/ENDING_BROWSER_SMOKE.json`

The evidence ZIP excludes `.env.local`, credentials, `.git`, and generated failure captures.
