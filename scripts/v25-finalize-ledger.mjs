import { readFile, writeFile } from 'node:fs/promises';
const path = 'docs/v25/QUALITY_LEDGER.json';
const ledger = JSON.parse(await readFile(path, 'utf8'));
const updates = {
  'V25-P0-BUILD-NAMING': { status: 'VERIFIED', codeChanges: ['scripts/static-integrity-check.mjs', 'package.json'], regressionTests: ['npm run build', 'npm run verify'], evidenceFiles: ['docs/v25/ENVIRONMENT.md'], verifiedAt: '2026-10-02' },
  'V25-P0-PERIODICAL-SEMANTICS': { status: 'VERIFIED', codeChanges: ['gold-runtime.js', 'periodical save migration'], regressionTests: ['scripts/v25-semantics-acceptance.mjs', 'scripts/v23-choice-replay.mjs', 'npm run verify'], verifiedAt: '2026-10-02' },
  'V25-P1-PILOT-SOURCES': { status: 'VERIFIED', codeChanges: ['data/v25-pilot-cases.json', 'scripts/v25-export-evidence-atomic.mjs'], regressionTests: ['scripts/v25-data-acceptance.mjs', 'scripts/v25-historical-acceptance.mjs'], evidenceFiles: ['docs/v25/data/FULL_SOURCE_WITNESSES.json', 'docs/v25/data/FULL_SOURCE_WITNESSES.csv'], verifiedAt: '2026-10-02' },
  'V25-P1-PILOT-UI': { status: 'VERIFIED', regressionTests: ['scripts/v25-pilot-smoke.mjs', 'scripts/v25-ui-acceptance.mjs'], evidenceFiles: ['docs/v25/PILOT_BROWSER_SMOKE.json', 'docs/v25/visuals2/manifest.json'], verifiedAt: '2026-10-02' },
};
for (const entry of ledger) Object.assign(entry, updates[entry.id] || {});
ledger.push({ id: 'V25-P1-RUNTIME-PERFORMANCE', priority: 'P1', scope: 'headed WebGL', status: 'VERIFIED', reproduction: 'real UI entry into idle/read/judgment/window/notebook', expected: 'foreground local WebGL, 10s×3 core modes, 50FPS and p95 ≤33ms', observed: '13 headed samples, invalid=0, targetsMet=true', rootCause: 'old V23 harness injected state and measured startup transition', codeChanges: ['scripts/v25-runtime-performance.mjs'], regressionTests: ['npm run acceptance:v25:runtime'], evidenceFiles: ['docs/v25/tests/REAL_STATE_PERFORMANCE.json', 'docs/v25/tests/PERFORMANCE_TRACE_SUMMARY.md'], attempts: ['corrected pre-navigation localStorage error; added steady-state warmup and reran'], verifiedAt: '2026-10-02', blocker: null });
await writeFile(path, JSON.stringify(ledger, null, 2) + '\n');
