import fs from 'node:fs';
const rules = JSON.parse(fs.readFileSync('data/v27-ending-rules.json', 'utf8'));
const required = ['DOSTOEVSKY_PETRASHEVSKY','HERZEN','BELINSKY','KHOMYAKOV','UVAROV'];
const failures = [];
if (rules.rules.length !== 5) failures.push(`expected 5 ending rules, got ${rules.rules.length}`);
for (const id of required) {
  const rule = rules.rules.find((r) => r.id === id);
  if (!rule) failures.push(`missing rule ${id}`);
  else {
    if (!Object.keys(rule.requires.issue ?? {}).length) failures.push(`${id}: no issue hard gate`);
    if (!Object.keys(rule.requires.access ?? {}).length) failures.push(`${id}: no access hard gate`);
    if (!Object.keys(rule.requires.relation ?? {}).length) failures.push(`${id}: no relation hard gate`);
    if (!rule.requires.evidenceCount) failures.push(`${id}: no evidence hard gate`);
  }
}
const out = { schemaVersion: 'V27-ENDING-LOGIC-1', status: failures.length ? 'FAIL' : 'PASS', rules: rules.rules.map((r) => r.id), failures };
fs.mkdirSync('docs/v27', { recursive: true });
fs.writeFileSync('docs/v27/ENDING_LOGIC.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
if (failures.length) process.exitCode = 1;
