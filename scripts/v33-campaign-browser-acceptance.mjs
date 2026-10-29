import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const endingIds = ['UVAROV', 'BELINSKY', 'HERZEN', 'KHOMYAKOV', 'DOSTOEVSKY_PETRASHEVSKY'];
const selectedEnding = process.argv.find(argument => argument.startsWith('--case='))?.slice('--case='.length);
if (selectedEnding && !endingIds.includes(selectedEnding)) throw new Error(`Unknown campaign smoke case: ${selectedEnding}`);
const endings = selectedEnding ? [selectedEnding] : endingIds;
const results = [];
let failed = false;
for (const endingId of endings) {
  const run = spawnSync(process.execPath, ['scripts/v33-campaign-browser-smoke.mjs', `--case=${endingId}`], { cwd: root, encoding: 'utf8', env: process.env });
  const artifactPath = path.join(root, 'artifacts', 'v33', `CAMPAIGN_BROWSER_SMOKE_${endingId}.json`);
  let report;
  try { report = JSON.parse(await readFile(artifactPath, 'utf8')); }
  catch { report = { schemaVersion: 'V33_CAMPAIGN_BROWSER_SMOKE_V1', endingId, status: 'FAIL', error: run.stderr || run.stdout || 'No browser report was produced' }; }
  results.push(report);
  if (run.status !== 0 || report.status !== 'PASS') failed = true;
  console.log(`${report.status} · ${endingId}${report.error ? ` · ${report.error.split('\n')[0]}` : ''}`);
}
const aggregate = { schemaVersion: 'V33_FULL_CAMPAIGN_BROWSER_ACCEPTANCE_V1', status: failed ? 'FAIL' : 'PASS', endingCount: results.filter(result => result.status === 'PASS').length, selectedCase: selectedEnding ?? null, routes: results.map(result => ({ endingId: result.endingId, status: result.status, resolvedQuests: result.final?.resolvedQuests ?? [], hosts: result.final?.hostIds ?? [], sources: result.final?.sourceIds ?? [], screenshot: result.screenshot ?? null, error: result.error ?? null })) };
await mkdir(path.join(root, 'artifacts', 'v33'), { recursive: true });
await writeFile(path.join(root, 'artifacts', 'v33', 'CAMPAIGN_BROWSER_SMOKE.json'), `${JSON.stringify(aggregate, null, 2)}\n`);
console.log(JSON.stringify(aggregate, null, 2));
if (failed) process.exitCode = 1;
