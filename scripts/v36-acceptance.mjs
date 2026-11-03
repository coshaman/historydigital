import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const steps = [
  ['static-build', 'build:v33'],
  ['legacy-contract-regression', 'acceptance:v33'],
  ['36-resident-goals-and-roster', 'v36-roster-goals'],
  ['six-districts-interiors-and-paths', 'v36-city-map-acceptance'],
  ['asset-pixels-and-usage', 'v36-visual-kit'],
  ['asset-provenance-and-reference-integrity', 'v36-asset-usage-ledger'],
  ['historical-provenance-regression', 'v36-historical-regression'],
  ['all-resident-possession-and-personal-quests', 'v36-resident-batch'],
  ['personal-quest-coverage-and-stage-links', 'v36-personal-quest-coverage'],
  ['three-deterministic-24-hour-city-replays', 'v36-full-day-36'],
  ['social-chain-and-presence-gates', 'v36-social-chain-test'],
  ['expanded-personal-life-chains', 'v36-expanded-personal-chain-test'],
  ['physical-social-exchange', 'v36-social-exchange-test'],
  ['opinion-routing', 'v36-opinion-routing'],
  ['ending-quest-scope', 'v36-ending-quest-scoped-test'],
  ['five-ending-route-semantics', 'v36-ending-semantic-exhaustive'],
  ['36-character-voice-differentiation', 'v36-voice-audit'],
  ['vercel-api-contract-and-fallback-safety', 'v33-vercel-api-test'],
  ['provider-failure-diagnostics-persist-safely', 'api-diagnostics-test'],
  ['vercel-ai-state-safety', 'v33-ai-test'],
  ['missing-key-is-not-misreported-as-generation', 'v36-api-generation-probe-browser'],
  ['real-build-and-deployed-static-smoke', 'real-build-browser'],
  ['desktop-mobile-and-reduced-motion-performance', 'perf'],
  ['mobile-layout-regression', 'mobile'],
  ['real-browser-personal-quest-completion', 'v36-personal-quest-browser'],
  ['six-resident-class-quest-browser-routes', 'v36-six-batch-browser'],
  ['historical-opinion-board-and-save-load', 'v36-opinion-board-browser'],
  ['all-14-maps-at-four-viewport-sizes', 'v36-world-map-browser-capture'],
  ['five-endings-and-campaign-browser-routes', 'v36-browser-acceptance'],
  ['all-36-residents-complete-three-stage-life-arcs', 'v36-personal-life-chain-test'],
  ['resident-quest-bundle-and-target-priority-browser', 'v36-quest-target-priority-browser'],
  ['36-resident-income-pressure-selects-real-livelihood-route', 'v36-income-goal-test'],
  ['world-journal-only-reveals-observed-events', 'v36-observed-world-events-test'],
  ['first-six-personal-life-goals-drive-physical-daily-visits', 'v36-personal-goal-autonomy-test'],
];

const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', resolve);
});
const port = probe.address().port;
await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
const runtime = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, OPENAI_API_KEY: '', CHANCERY_PORT: String(port) },
  stdio: 'ignore',
  windowsHide: true,
});
const baseUrl = `http://127.0.0.1:${port}`;
const results = [];
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run this gate with npm run acceptance:v36 so npm_execpath is available.');
let startIndex = 0;
if (process.argv.includes('--resume') || process.env.V36_RESUME === '1') {
  const previous = JSON.parse(await readFile(path.join(root, 'docs/v36/ACCEPTANCE.json'), 'utf8'));
  assert.equal(previous.schemaVersion, 'V36_ACCEPTANCE_1', 'resume requires a V36 acceptance report');
  if (previous.status === 'PASS') {
    assert.equal(previous.completedSteps, previous.results.length, 'append-only resume requires a complete prior PASS report');
    assert.ok(previous.results.length <= steps.length, 'prior report cannot contain gates newer than this runner');
    assert.ok(previous.results.every((row, index) => row.status === 'PASS' && row.id === steps[index][0] && row.script === steps[index][1]), 'prior PASS rows must be an exact ordered prefix of this runner');
    results.push(...previous.results);
    startIndex = previous.results.length;
  } else {
    const failedIndex = steps.findIndex(([id]) => id === previous.failedStep);
    assert.ok(failedIndex >= 0, 'resume report must name a current V36 gate');
    assert.equal(previous.results.length, failedIndex + 1, 'resume requires a sequential run with exactly one failed last gate');
    assert.ok(previous.results.slice(0, failedIndex).every(row => row.status === 'PASS'), 'all gates before the failed gate must have passed');
    assert.equal(previous.results[failedIndex].status, 'FAIL', 'resume starts by rerunning the failed gate');
    assert.equal(previous.results[failedIndex].script, steps[failedIndex][1], 'resume gate definition must match the failed report');
    results.push(...previous.results.slice(0, failedIndex));
    startIndex = failedIndex;
  }
  console.log(`[V36 ACCEPTANCE] RESUME from ${steps[startIndex]?.[0] ?? 'evidence-packaging'} after ${results.length} recorded passing gates`);
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(baseUrl)).ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 125));
  }
  assert.ok(ready, 'Vercel-compatible local runtime must become ready before browser gates run.');

  for (const [id, script] of steps.slice(startIndex)) {
    const startedAt = Date.now();
    console.log(`\n[V36 ACCEPTANCE] START ${id} (npm run ${script})`);
    const result = spawnSync(process.execPath, [npmCli, 'run', script], {
      cwd: root,
      env: { ...process.env, OPENAI_API_KEY: '', CHANCERY_BASE_URL: baseUrl },
      stdio: 'inherit',
      windowsHide: true,
    });
    const row = { id, script, status: result.status === 0 ? 'PASS' : 'FAIL', exitCode: result.status, signal: result.signal ?? null, durationMs: Date.now() - startedAt };
    results.push(row);
    console.log(`[V36 ACCEPTANCE] ${row.status} ${id} (${row.durationMs}ms)`);
    if (result.error) throw result.error;
    if (result.status !== 0) {
      const report = { schemaVersion: 'V36_ACCEPTANCE_1', status: 'FAIL', generatedAt: new Date().toISOString(), completedSteps: results.length, failedStep: id, results };
      await mkdir(path.join(root, 'docs/v36'), { recursive: true });
      await writeFile(path.join(root, 'docs/v36/ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      process.exitCode = result.status ?? 1;
      break;
    }
  }

  if (results.length === steps.length && results.every(row => row.status === 'PASS')) {
    const report = { schemaVersion: 'V36_ACCEPTANCE_1', status: 'PASS', generatedAt: new Date().toISOString(), completedSteps: results.length, results };
    await mkdir(path.join(root, 'docs/v36'), { recursive: true });
    await writeFile(path.join(root, 'docs/v36/ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`\n[V36 ACCEPTANCE] PASS ${results.length}/${steps.length} gates`);
    const packaged = spawnSync(process.execPath, [npmCli, 'run', 'v36-package-evidence'], { cwd: root, env: { ...process.env }, stdio: 'inherit', windowsHide: true });
    assert.equal(packaged.status, 0, 'V36 evidence archive must build after all acceptance reports are written.');
  }
} finally {
  runtime.kill();
}
