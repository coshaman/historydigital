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

## Final audit supplement — 2026-10-28

Fresh final rerun after the player-facing choice/source-label fixes and source-context audit:

- `npm run check`: PASS (12/12)
- `npm run lint`: PASS
- `npm run test`: PASS (five endings and E02/E04/E07 route anchors)
- `npm run build`: PASS
- `npm run test:ai-schema`: PASS (8/8)
- `npm run test:ai-state`: PASS (22/22)
- `npm run test:late-game`: PASS (21/21)
- `npm run test:secrets`: PASS (3/3; no credential patterns)
- `npm run audit:late-game-assets`: PASS (6 backgrounds, 4 stills)
- V42 source, chronology, ending counterfactual, runtime contract, and speech-register audits: PASS
- V44 philosophy-first audit, updated to preserve the required E02/E04/E07 slice: PASS
- `npm run v42-five-ending-browser-acceptance`: PASS (all five exact endings)
- `npm run browser:late-game`: PASS (1440x900, 1366x768, 390x844, 360x800)
- `npm run v42-browser-acceptance`: PASS (1996x1248, 1440x900, 390x844, 360x640; 6 full route replays, no horizontal overflow)

The desktop route completed seven typed Circle turns, saved and restored the conversation, recalled the stance in later scenes, and reached `UVAROV`. The Supper/Bookshop route restored memory and reached the distinct `BELINSKY` ending. The API-failure route used authored fallback dialogue at every late-game scene and still reached `UVAROV`. All three are labeled as deterministic offline mocks/fallback in `transcripts/routes/`; this does not represent a live OpenAI smoke test. The browser request audit recorded 31 attempts and no client-supplied hidden context fields.

The Petrashevsky evidence now identifies the 2021 Russian Historical Society article as secondary historical synthesis and presents its contiguous paragraphs 118–120 in Russian with aligned Korean translation. This range gives the circle's broader context, the Friday reading topic, the radical minority, and the article's description of nonviolent gradual reform. The source-page locator and Korean learning excerpt point to the same range.

Final review: author self-review of the complete worktree diff plus fresh automated gates. No third reviewer was dispatched because the approved plan caps subagents at two and both reviewer seats are already represented by `reviews/ux-review.md` and `reviews/historical-ai-review.md`.

LIVE_OPENAI_SMOKE: UNVERIFIED (no key in environment; no live request made)
V32_RELEASE_CANDIDATE: NO (live-provider dialogue remains unverified)

## Fresh rerun at 814fcabce6e0c0a20eb1f5334752a92d8e7cc02e — 2026-10-28

- `npm run check`: PASS (12/12 graph tests and historical lint)
- `npm run lint`: PASS
- `npm run test`: PASS
- `npm run build`: PASS
- `npm run test:ai-schema`: PASS (8/8)
- `npm run test:ai-state`: PASS (22/22)
- `npm run test:late-game`: PASS (21/21)
- `npm run test:secrets`: PASS (3/3 and source/frontend scan)
- `npm run audit:late-game-assets`: PASS (6 backgrounds, 4 event stills)
- `npm run browser:late-game`: PASS (1440×900, 1366×768, 390×844, 360×800)
- `npm run v42-browser-acceptance`: PASS (6 routes; 1996×1248, 1440×900, 390×844, 360×640; no failures or horizontal overflow)
- `npm run v42-five-ending-browser-acceptance`: PASS (UVAROV, BELINSKY, HERZEN, KHOMYAKOV, DOSTOEVSKY_PETRASHEVSKY)

The desktop Circle → Bookshop → Reading route completed seven typed turns and restored its memory after reload. The Supper → Bookshop route reached a distinct ending and restored memory. The API-outage route continued on authored fallback through the ending. The report records 31 browser requests and no unexpected client context fields. All provider responses were offline mocks; `OPENAI_API_KEY` was absent, so live API status remains `UNVERIFIED` and release-candidate status remains `NO`.
