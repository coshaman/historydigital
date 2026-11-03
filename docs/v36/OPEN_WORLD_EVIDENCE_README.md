# Russian Lives V36 Open-World Evidence

This package contains the V36 playable source, 36 resident records and art, connected maps, personal quests, source and asset provenance, and the automated verification evidence.

## Included evidence

- Six resident batch audits and real-browser choice screenshots.
- Three deterministic 24-hour city replays with collision, travel, delivery, trade, and independent-objective counts.
- Dedicated three-choice personal quests for all 36 fictional residents, 62 three-choice resident quests, and 11 complete multi-stage life chains.
- Desktop and mobile neighborhood captures, 36-sprite visual audit, voice audit, and historical-source regression.
- A fresh 1440×900 release-runtime screenshot captured from the static build.
- Five ending screenshots and campaign browser reports.
- Actual local Responses API generation evidence, missing-key/no-offline browser verification, and the API health-versus-generation diagnostic.
- Twenty-eight end-to-end browser routes across desktop and mobile, covering all five endings after reading each source excerpt, completing the exam/event branch, and making both scene decisions; all routes finished without page errors.
- Rendered memory callbacks were observed from Alexei, Ekaterina, and Pavel; curated screenshots show all five endings and core reading screens.
- Six additional three-stage personal quest chains: newspaper distribution, witness accounts, reading access, household warnings, care costs, and fair entry procedures.

## Reproduce the main checks

```powershell
npm run check
npm run v36-browser-acceptance
npm run acceptance:v33
npm run v36-personal-quest-coverage
npm run v36-full-day-36
npm run v36-six-batch-browser
npm run v36-opinion-board-browser
npm run v36-api-generation-probe-browser
npm run v36-visual-kit
npm run real-build-browser
```

The archive excludes local environment files and API credentials. Configure `OPENAI_API_KEY` through the Vercel project environment settings for deployed AI dialogue; local browser fixtures use mocked API responses.
