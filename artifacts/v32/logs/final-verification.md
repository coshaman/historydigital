# V32 verification ledger

Completed 2026-10-28 in `codex/v32-ai-late-game`.

- `npm run check`: PASS (historical lint; 12 branch graph tests)
- `npm run lint`: PASS
- `npm run test`: PASS (five established endings and route anchors)
- `npm run build`: PASS (static integrity)
- `npm run test:ai-schema`: PASS (8)
- `npm run test:ai-state`: PASS (22)
- `npm run test:late-game`: PASS (21)
- `npm run test:secrets`: PASS (3 and source scan)
- `npm run audit:late-game-assets`: PASS (6 backgrounds, 4 event stills; 1,442,162 bytes)
- `npm run browser:late-game`: PASS at 1440x900, 1366x768, 390x844, 360x800
- `npm run v42-browser-acceptance`: PASS at 1996x1248, 1440x900, 390x844, 360x640; real clicks reached the ending with no horizontal overflow
- `npm run v42-five-ending-browser-acceptance`: PASS; all five authored ending resolver contracts

Provider tests use injected deterministic responses and browser tests use a schema-valid offline mock. `LIVE_OPENAI_SMOKE: UNVERIFIED` (no live provider call made).

Reviewed UX and historical/AI audit notes are in `reviews/`. The final screenshots show the original 3D desk and full late-game route, including endings without the dialogue rail.

LIVE_OPENAI_SMOKE: UNVERIFIED (no key in environment)
