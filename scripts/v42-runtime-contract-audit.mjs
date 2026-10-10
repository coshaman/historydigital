import fs from 'node:fs';
import path from 'node:path';

const runtime = fs.readFileSync(path.join(process.cwd(), 'main20-runtime.js'), 'utf8');
const failures = [];
for (const token of ['ideology', 'ideologyEvidence', 'visibleCallbacks', 'ideology_prologue', 'beliefLedger', 'ideologicalEvidence', 'actionEvidence']) {
  if (!runtime.includes(token)) failures.push(`runtime missing ${token}`);
}
if (!runtime.includes('c07IdeologicalFollowUp')) failures.push('runtime missing dated C07 follow-up data path');
if (failures.length) {
  console.error(`V42 runtime contract audit: FAIL (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else console.log('V42 runtime contract audit: PASS');
