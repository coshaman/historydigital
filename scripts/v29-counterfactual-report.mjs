import fs from 'node:fs/promises';

const report = JSON.parse(await fs.readFile('docs/v28/ENDING_BROWSER_EVIDENCE.json', 'utf8'));
const byId = new Map(report.results.map(item => [item.expectedEnding, item]));
const pairs = [
  ['HERZEN', 'KHOMYAKOV', 'same final spoken choice index 1, different prior positions'],
  ['BELINSKY', 'UVAROV', 'same final spoken choice index 2, different prior positions'],
  ['DOSTOEVSKY_PETRASHEVSKY', 'KHOMYAKOV', 'same first spoken position, later second position changes route'],
  ['HERZEN', 'UVAROV', 'dossier-only route versus three-channel route'],
  ['BELINSKY', 'KHOMYAKOV', 'cross-border-only route versus official+dossier route']
].map(([left, right, contrast]) => {
  const a = byId.get(left); const b = byId.get(right);
  const differentEnding = Boolean(a && b && a.actualEnding !== b.actualEnding);
  const differentState = Boolean(a && b && JSON.stringify(a.endingState) !== JSON.stringify(b.endingState));
  return { left, right, contrast, differentEnding, differentState, leftState: a?.endingState, rightState: b?.endingState, status: differentEnding && differentState ? 'PASS' : 'FAIL' };
});
const output = { schemaVersion: 'V29-COUNTERFACTUAL-UI-1', generatedAt: new Date().toISOString(), source: 'docs/v28/ENDING_BROWSER_EVIDENCE.json', status: pairs.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL', pairCount: pairs.length, pairs };
await fs.writeFile('docs/v29/COUNTERFACTUAL_AUDIT.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
if (output.status !== 'PASS') process.exitCode = 1;
