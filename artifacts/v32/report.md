# V32 AI late-game — implementation and verification report

Date: 2026-10-28  
Branch: `codex/v32-ai-late-game`  
Base: `756f9033765329db8eec2cbdbfc175febf5d874e`

## Result

The approved late-game expansion is implemented in the isolated feature worktree. The route preserves the existing 3D desk and five ending families, adds source-grounded Circle, Bookshop, Supper, Reading, and Examination play, deterministic memory and exam mechanics, and a strict server-side AI dialogue path with authored fallback.

## Verification

See `logs/final-verification.md` for commands and results. UI browser replay completed at desktop 1996x1248 and 1440x900 and mobile 390x844, 360x800; the primary route acceptance also covered compact mobile 360x640. Every route run reached the ending, maintained viewport width without horizontal overflow, and the ending UI hid the dialogue panel. Five authored ending resolver contracts passed individually.

Late-game browser runs cover circle response, save/restore, activity selection, scene transitions, five-question examination, results, and endings. Screenshots cover desk, ideology, Circle, each late-game scene, exam question/result/reaction, and ending at all four configured viewports. Reviewer reports and the offline mock transcript are included.

## Historical and safety notes

Modern Russian Historical Society context dated 2021 is now assigned its own `V42-PETRASHEVSKY-SYNTHESIS-2021` source ID, separated from period-source identifiers. Narrator-only modern synthesis is excluded from NPC context. Browser requests cannot supply memory, summary, recent turns, game state, prompt, or character identity. The server enforces scene cast, turn limits, bounded schema, origin allowlist, retries, and authored fallback. Worker sessions use a SQLite-backed Durable Object.

## Live-provider status

`LIVE_OPENAI_SMOKE: UNVERIFIED`. Automated tests use injected provider fixtures and the browser test uses a schema-valid offline mock. No live OpenAI request was made.

## Evidence

- `screenshots/`: final browser captures
- `transcripts/offline-fallback-session.json`: offline-mock interaction record
- `reviews/`: UX and historical/AI reviewer reports
- `logs/final-verification.md`, `logs/asset-audit.json`: gate results and asset audit
- `../v42-browser/`: route and five-ending contract reports
- `../v53-desk/`, `../v46-ending/`: preserved desk and ending visual QA artifacts

LIVE_OPENAI_SMOKE: UNVERIFIED (no key in environment)

## Final audit supplement

The final audit corrected player-facing branch disclosures and removed internal source identifiers from paper, drawer, learning, and ending UI. Historical provenance is readable by title/date/class, and each consequential choice explains its immediate action, audience, record, document travel, and broad risk.

The Russian Historical Society's 2021 Petrashevsky synthesis is now correctly classified as a later secondary source. Its source excerpt uses three contiguous verified paragraphs, aligned in Russian and Korean, to show the circle's general setting, its Friday reading topics, and differences between the broader group and a radical minority. The outdated V42/V44 checks were aligned to this source and the required playable E02/E04/E07 route.

Final browser replay reached `UVAROV` on the seven-turn Circle → Bookshop → Reading route, saved/restored memory across reload, and confirmed later-scene recall. Circle → Supper → Bookshop reached the different `BELINSKY` ending. Forced API request failures used authored fallback dialogue through Examination and still reached `UVAROV`. The real-click browser suite passed at 1996×1248, 1440×900, 390×844, and 360×640. The separate late-game suite passed at 1440×900, 1366×768, 390×844, and 360×800. The five-ending acceptance and all listed unit, security, source, chronology, and asset audits passed.

The browser AI responses are deterministic schema-valid offline mocks; the outage route is an intentional network-failure test. No live OpenAI request was made because no key is configured.

The original Russian paragraphs and publication record were rechecked against the [Russian Historical Society article](https://historyrussia.org/?id=5349&layout=edit&view=article). Final review was an author self-review of the complete diff with fresh automated gates; a third subagent was not used because the approved plan caps subagents at two and both reviewer seats were used for the UX and history/AI reviews in the package.

```text
V32_UI_UX_UNIFIED: YES
V32_AI_DIALOGUE_LIVE: UNVERIFIED
V32_DETERMINISTIC_STATE_ENGINE: YES
V32_CIRCLE_EXPANDED: YES
V32_BOOKSHOP_PLAYABLE: YES
V32_MEAL_PLAYABLE: YES
V32_READING_PLAYABLE: YES
V32_EXAM_EXPANDED: YES
V32_FIVE_ENDINGS_PRESERVED: YES
V32_HISTORICAL_GROUNDING: YES
V32_SECRET_SAFE: YES
V32_DESKTOP_MOBILE_QA: YES
V32_RELEASE_CANDIDATE: NO
```

`V32_RELEASE_CANDIDATE` remains `NO` until the live-provider dialogue path is smoke-tested with a configured server-side key.
