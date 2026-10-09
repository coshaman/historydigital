# Russian Lives: Act III — V28 verification bundle

## Run locally

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:4173/#v28`.

## Verification

```powershell
npm run v28-author-narrative
npm run v28-schema-audit
npm run v28-arc-matrix
npm run v28-copy-inventory
npm run v28-acceptance
npm run build
npm run check
npm run lint
npm run test
npm run mobile
npm run v28-browser-evidence
npm run v28-save-reload
node scripts/v28-memory-browser-evidence.mjs
node scripts/v28-ending-browser-evidence.mjs
node scripts/v28-all-cases-browser-evidence.mjs
node scripts/v28-provenance-audit.mjs
node scripts/v28-performance-browser-evidence.mjs
```

The browser evidence runner writes raw PNGs and `artifacts/v28-browser/V28_BROWSER_EVIDENCE.json` for 1440×900, 1366×768, 390×844, and 360×800. It captures arrival, spoken choice reaction, RU/KO evidence, and aftermath. `docs/v28/ALL_CASES_BROWSER_EVIDENCE.json` records individual browser entry into all 24 cases with title/date/choice assertions and month-level chronology. `docs/v28/PROVENANCE_AUDIT.json` checks all 24 cases and 96 historical claims against V27 source/excerpt IDs. `docs/v28/PERFORMANCE_ACTUAL_INTERACTIONS.json` records six actual browser interaction samples; it can report a performance warning when the current headless host is slow. `docs/v28/RELATIONSHIP_MEMORY_BROWSER_EVIDENCE.json` proves three different spoken choices produce different aftermath/callback text and witness state. `docs/v28/ENDING_BROWSER_EVIDENCE.json` records five fresh 12-case UI replays. Human playtesting is separate and remains pending until a person completes the journey.
