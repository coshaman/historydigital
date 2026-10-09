import {readFile} from 'node:fs/promises';
const csv = await readFile(new URL('../docs/v11/GOLD_DECISION_EFFECT_MATRIX.csv', import.meta.url), 'utf8');
const rows = csv.trim().split(/\r?\n/).slice(1).map(line => line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(value => value.replace(/^\"|\"$/g, '')));
const failures = [];
for (const id of ['E02','E05-A','E05-B','E07']) {
  const group = rows.filter(row => row[0] === id); const procedures = group.filter(row => row[2] === 'procedural'); const judgments = group.filter(row => row[2] === 'judgment');
  if (procedures.length !== 3 || judgments.length !== 3) failures.push(`${id}: expected 3 procedural + 3 judgment choices`);
  if (group.some(row => !row[3] || !row[4] || !row[5] || !row[8] || !row[9])) failures.push(`${id}: incomplete matrix row`);
  if (group.some(row => /ending/i.test(row.join('|')))) failures.push(`${id}: direct ending assignment leaked into matrix`);
}
if (new Set(rows.filter(row => row[2] === 'judgment').map(row => row[6])).size < 4) failures.push('hidden stance effects are not varied');
if (new Set(rows.filter(row => row[2] === 'judgment').map(row => row[7])).size < 4) failures.push('relationship effects are not separate');
console.log(JSON.stringify({rows: rows.length, stages: [...new Set(rows.map(row => row[0]))], failures}, null, 2));
if (failures.length) process.exit(1);
console.log('v11-gold-decision-test: dual-layer choices, separated hidden effects, and no direct ending assignment — PASS');
