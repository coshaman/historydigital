import fs from 'node:fs';
import path from 'node:path';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'narrative', 'MAIN_20MIN_DIALOGUE.json'), 'utf8'));
const failures = [];
const endings = data.endings || [];
if (endings.length !== 5) failures.push(`expected five endings, got ${endings.length}`);
for (const ending of endings) {
  const profile = data.endingIdeologyProfiles?.[ending.id] || ending.rule;
  if (!profile?.ideologyGate || !Object.keys(profile.ideologyGate).length) failures.push(`${ending.id}: missing ideologyGate`);
  if (!profile?.actionGate || !Object.keys(profile.actionGate).length) failures.push(`${ending.id}: missing actionGate`);
  if ((profile?.beliefLedgerLabels || ending.beliefLedgerLabels || []).length < 3) failures.push(`${ending.id}: needs at least three belief ledger labels`);
}
if (failures.length) {
  console.error(`V42 ending counterfactual audit: FAIL (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else console.log('V42 ending counterfactual audit: PASS');
