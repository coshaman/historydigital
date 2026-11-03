# Russian Lives V36 Open-World Evidence

This package contains the V36 playable source, 36 resident records and art, connected maps, personal quests, source and asset provenance, and the automated verification evidence. `RUSSIAN_LIVES_V36_OPEN_WORLD_EVIDENCE.zip` is regenerated from the same workspace contents and excludes environment files and credentials.

## Included evidence

- Six resident batch audits and real-browser choice screenshots.
- Three deterministic 24-hour city replays with collision, travel, delivery, trade, and independent-objective counts.
- Dedicated three-choice personal quests for all 36 fictional residents, 170 three-choice personal quests, 47 complete multi-stage life chains, and 16 additional three-stage relationship/life arcs (48 quest records).
- Desktop and mobile neighborhood captures, 36-sprite visual audit, voice audit, and historical-source regression.
- A fresh 1440×900 release-runtime screenshot captured from the static build.
- Five ending screenshots, three representative route screens, and a complete 28-route campaign browser report.
- Actual local Responses API generation evidence, missing-key/no-offline browser verification, and the API health-versus-generation diagnostic.
- Twenty-eight end-to-end browser routes across desktop and mobile, covering all five endings after reading each source excerpt, completing the exam/event branch, and making both scene decisions; all routes finished without page errors.
- Rendered memory callbacks were observed from Alexei, Ekaterina, and Pavel; curated screenshots show all five endings and core reading screens.
- Sixteen additional three-stage personal quest chains, including newspaper distribution, witness accounts, reading access, household warnings, care costs, fair entry procedures, and individual resident goals.

## Reproduce the main checks

```powershell
npm run acceptance:v36
npm run check
npm run perf
npm run mobile
npm run v36-browser-acceptance
npm run acceptance:v33
npm run v36-personal-quest-coverage
npm run v36-full-day-36
npm run v36-six-batch-browser
npm run v36-opinion-board-browser
npm run v36-api-generation-probe-browser
npm run v36-visual-kit
npm run real-build-browser
npm run v36-live-ai-browser
```

`acceptance:v36` is the required integrated gate from `CODEX_V36_OPEN_WORLD_PETERSBURG_GOAL.md`. It rebuilds `dist-v33`, runs V35 regression and V36 roster/map/simulation/content/AI-safety/ending/browser checks, writes `docs/v36/ACCEPTANCE.json`, then regenerates the evidence ZIP. It temporarily serves the local app on `127.0.0.1:4173` for browser suites and clears `OPENAI_API_KEY` for the checks, so the gate never makes a billable provider request. A live AI generation check remains a separate, explicit command.

The live AI check performs one real model generation using the ignored local `.env.local` file and records only status, length, and metadata. It never saves the reply or credential. The archive excludes `.env*` files (except `.env.example`), `node_modules`, build output, and Git data. For Vercel, add `OPENAI_API_KEY` as a Sensitive Production variable (and Preview if needed), then redeploy. The health endpoint verifies key configuration only; a successful dialogue request and the `AI 생성 답변` label confirm actual generation. On provider failure, the game shows an actionable error and retry; it does not substitute offline dialogue.
