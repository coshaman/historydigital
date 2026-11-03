import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const batches = [];
for (let batch = 1; batch <= 6; batch += 1) {
  const result = spawnSync(process.execPath, ['scripts/v36-resident-batch-acceptance.mjs', `--batch=${batch}`], {
    cwd: process.cwd(), encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024,
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  assert.equal(result.status, 0, `resident acceptance batch ${batch} failed`);
  const parsed = JSON.parse(result.stdout ?? '');
  assert.equal(parsed.status, 'PASS');
  batches.push(parsed);
}

const report = {
  schemaVersion: 'V36_ALL_SIX_RESIDENT_BATCHES_1',
  status: batches.length === 6 && batches.reduce((sum, batch) => sum + batch.possessionChecks, 0) === 36 ? 'PASS' : 'FAIL',
  activeResidents: batches.flatMap(batch => batch.residents),
  residentCount: batches.reduce((sum, batch) => sum + batch.possessionChecks, 0),
  questCompletions: batches.reduce((sum, batch) => sum + batch.questCompletions, 0),
  questStagesResolved: batches.reduce((sum, batch) => sum + batch.questStagesResolved, 0),
  batches,
};
assert.equal(report.residentCount, 36);
assert.equal(new Set(report.activeResidents).size, 36);
const out = 'docs/v36/current-audit';
await mkdir(out, { recursive: true });
await writeFile(`${out}/SIX_RESIDENT_BATCH_ACCEPTANCE.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: report.status, residents: report.residentCount, questCompletions: report.questCompletions,
  questStagesResolved: report.questStagesResolved }, null, 2));
