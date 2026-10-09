import { spawnSync } from 'node:child_process';
const commands = [
  ['data', 'scripts/v25-data-acceptance.mjs'],
  ['semantics', 'scripts/v25-semantics-acceptance.mjs'],
  ['replay', 'scripts/v25-independent-replay.mjs'],
  ['package', 'scripts/v25-package-acceptance.mjs'],
];
const results = [];
for (const [name, script] of commands) {
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  results.push({ name, status: run.status === 0 ? 'PASS' : 'FAIL', output: `${run.stdout}${run.stderr}`.slice(-4000) });
}
const result = { version: 'v25', status: results.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL', results };
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'PASS') process.exitCode = 1;
