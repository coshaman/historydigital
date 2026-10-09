import fs from 'node:fs';

const rules = JSON.parse(fs.readFileSync('data/v27-ending-rules.json', 'utf8'));
const ruleById = new Map(rules.rules.map(rule => [rule.id, rule]));
const meets = (state, rule) => Object.entries(rule.requires.issue ?? {}).every(([key, value]) => (state.issue[key] ?? 0) >= value)
  && Object.entries(rule.requires.access ?? {}).every(([key, value]) => (state.access[key] ?? 0) >= value)
  && Object.entries(rule.requires.relation ?? {}).every(([key, value]) => (state.relation[key] ?? 0) >= value)
  && state.evidenceCount >= (rule.requires.evidenceCount ?? 0);
const resolve = state => rules.resolutionOrder.find(id => meets(state, ruleById.get(id))) || null;
const failures = [];
for (const rule of rules.rules) {
  const issueOnly = { issue: { ...rule.requires.issue }, access: {}, relation: {}, evidenceCount: 0 };
  if (resolve(issueOnly) === rule.id) failures.push(`${rule.id}: issue-only state resolved to target`);
  const noRelation = { issue: { ...rule.requires.issue }, access: { ...rule.requires.access }, relation: {}, evidenceCount: rule.requires.evidenceCount };
  if (Object.keys(rule.requires.relation ?? {}).length && resolve(noRelation) === rule.id) failures.push(`${rule.id}: missing relation gate ignored`);
  const noAccess = { issue: { ...rule.requires.issue }, access: {}, relation: { ...rule.requires.relation }, evidenceCount: rule.requires.evidenceCount };
  if (Object.keys(rule.requires.access ?? {}).length && resolve(noAccess) === rule.id) failures.push(`${rule.id}: missing access gate ignored`);
}
const report = { schemaVersion: 'V27-ENDING-COUNTEREXAMPLE-1', status: failures.length ? 'FAIL' : 'PASS', assertions: rules.rules.length * 3, failures };
fs.mkdirSync('docs/v27', { recursive: true });
fs.writeFileSync('docs/v27/ENDING_COUNTEREXAMPLE.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
