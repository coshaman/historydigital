import { spawnSync } from 'node:child_process';
const runs = [['viewport', 'scripts/v25-viewport-qa3.mjs'], ['physical-ui', 'scripts/v25-physical-ui-acceptance.mjs'], ['pilot', 'scripts/v25-pilot-smoke.mjs']].map(([name, script]) => { const run = spawnSync(process.execPath, [script], { encoding: 'utf8' }); return { name, status: run.status === 0 ? 'PASS' : 'FAIL', output: `${run.stdout}${run.stderr}`.slice(-3000) }; });
const result = { status: runs.every((run) => run.status === 'PASS') ? 'PASS' : 'FAIL', runs };
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'PASS') process.exitCode = 1;
