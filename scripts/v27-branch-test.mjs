import fs from 'node:fs';
const bundle = JSON.parse(fs.readFileSync('data/v27-case-bundle.json', 'utf8'));
const graph = JSON.parse(fs.readFileSync('data/v27-route-graph.json', 'utf8'));
const ids = bundle.normalRunCaseIds;
const matches = (issue, requires = {}) => Object.entries(requires).every(([key, value]) => (issue[key] ?? 0) >= value);
const simulate = (initialIssue) => {
  const issue = { ...initialIssue };
  const path = [];
  while (path.length < ids.length && path.at(-1) !== 'C24') {
    const current = path.at(-1);
    const done = new Set(path);
    const transitions = graph.transitions[current] ?? [];
    const preferred = transitions.find((item) => ids.includes(item.to) && !done.has(item.to) && matches(issue, item.requires) && (item.to !== 'C24' || done.size >= 9))?.to;
    const next = preferred ?? ids.find((id) => !done.has(id));
    if (!next) break;
    path.push(next);
  }
  return path;
};
const witnesses = [
  { id: 'neutral', issue: {} },
  { id: 'state-record', issue: { stateAuthority: 1 } },
  { id: 'press-network', issue: { pressFreedom: 1 } },
].map((seed) => ({ ...seed, path: simulate(seed.issue) }));
const failures = [];
if (witnesses.some((w) => w.path.length < 10 || w.path.length > 12)) failures.push('a normal branch is not 10–12 cases');
if (new Set(witnesses.map((w) => w.path.join('>'))).size < 3) failures.push('fewer than three distinct branch paths');
if (witnesses.some((w) => new Set(w.path).size !== w.path.length)) failures.push('a branch repeats a case');
if (witnesses.some((w) => !w.path.includes('C24'))) failures.push('a branch lacks the historical terminal case C24');
const report = { schemaVersion: 'V27-BRANCH-TEST-1', status: failures.length ? 'FAIL' : 'PASS', normalRunCaseCount: ids.length, witnesses, failures };
fs.mkdirSync('docs/v27', { recursive: true });
fs.writeFileSync('docs/v27/BRANCH_TEST.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
