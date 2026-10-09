import fs from 'node:fs';

const bundle = JSON.parse(fs.readFileSync('data/v27-case-bundle.json', 'utf8'));
const rules = JSON.parse(fs.readFileSync('data/v27-ending-rules.json', 'utf8'));
const graph = JSON.parse(fs.readFileSync('data/v27-route-graph.json', 'utf8'));
const cases = bundle.cases.filter((c) => c.availableInNormalRun);
const caseById = new Map(cases.map((c) => [c.caseId, c]));
const ids = bundle.normalRunCaseIds;
const cap = (n, min = 0, max = 4) => Math.max(min, Math.min(max, n));
const matches = (state, requires = {}) => Object.entries(requires).every(([key, value]) => (state.issue[key] ?? 0) >= value);
const routeNext = (state) => {
  if (state.currentCaseId === 'C24') return null;
  const done = new Set(state.path.map(step => step.caseId));
  const transitions = graph.transitions[state.currentCaseId] ?? [];
  const preferred = transitions.find(item => ids.includes(item.to) && !done.has(item.to) && matches(state, item.requires) && (item.to !== 'C24' || done.size >= 9))?.to;
  return preferred || ids.find(id => !done.has(id)) || null;
};
const score = (state, rule) => {
  const deficit = (group, values) => Object.entries(values ?? {}).reduce((n, [key, value]) => n + Math.max(0, value - (state[group][key] ?? 0)), 0);
  return deficit('issue', rule.requires.issue) + deficit('access', rule.requires.access) + deficit('relation', rule.requires.relation) + Math.max(0, (rule.requires.evidenceCount ?? 0) - state.evidenceCount);
};
const meets = (state, rule) => score(state, rule) === 0;
const resolvedAs = (state) => rules.resolutionOrder.find(id => meets(state, rules.rules.find(rule => rule.id === id))) || 'UVAROV';
const stateKey = state => JSON.stringify({ currentCaseId: state.currentCaseId, done: [...new Set(state.path.map(step => step.caseId))].sort(), issue: state.issue, access: state.access, relation: state.relation });

function applyStep(state, current, judgment, procedure) {
  const next = structuredClone(state);
  for (const [key, value] of Object.entries(judgment.effect?.issue ?? {})) next.issue[key] = cap((next.issue[key] ?? 0) + value);
  if (procedure === 1) next.access.officialRecord = Math.min(4, (next.access.officialRecord ?? 0) + 1);
  if (procedure === 2) next.access.dossierEvidence = Math.min(4, (next.access.dossierEvidence ?? 0) + 1);
  if (procedure === 3) next.access.crossBorder = Math.min(4, (next.access.crossBorder ?? 0) + 1);
  if (['C01', 'C17', 'C21', 'C24'].includes(current.caseId) && procedure <= 2) next.relation.officialPressure = Math.min(4, (next.relation.officialPressure ?? 0) + 1);
  if (['C14', 'C19'].includes(current.caseId) && procedure === 1) next.relation.editorContact = Math.min(4, (next.relation.editorContact ?? 0) + 1);
  if (['C14', 'C19'].includes(current.caseId) && procedure === 3) next.access.crossBorder = Math.min(4, (next.access.crossBorder ?? 0) + 1);
  next.evidenceCount += 5;
  next.path.push({ caseId: current.caseId, procedure, judgmentId: judgment.id });
  return next;
}

function findWitness(rule) {
  let states = [{ currentCaseId: ids[0], issue: {}, access: {}, relation: {}, evidenceCount: 0, path: [] }];
  for (let depth = 0; depth < ids.length; depth++) {
    const nextStates = new Map();
    for (const state of states) {
      const current = caseById.get(state.currentCaseId);
      if (!current) continue;
      for (const judgment of current.judgments) for (let procedure = 1; procedure <= 3; procedure += 1) {
        const candidate = applyStep(state, current, judgment, procedure);
        if (current.caseId === 'C24') {
          if (candidate.path.length >= 10 && candidate.path.length <= 12 && meets(candidate, rule) && resolvedAs(candidate) === rule.id) return candidate;
          continue;
        }
        candidate.currentCaseId = routeNext(candidate);
        if (!candidate.currentCaseId || candidate.path.length >= 12) continue;
        const key = stateKey(candidate);
        const previous = nextStates.get(key);
        if (!previous || score(candidate, rule) < score(previous, rule)) nextStates.set(key, candidate);
      }
    }
    states = [...nextStates.values()].sort((a, b) => score(a, rule) - score(b, rule) || a.path.length - b.path.length).slice(0, 300);
  }
  return null;
}

const reachable = rules.rules.map(rule => {
  const witness = findWitness(rule);
  return { id: rule.id, reachable: Boolean(witness), witness: witness ? { path: witness.path, issue: witness.issue, access: witness.access, relation: witness.relation, evidenceCount: witness.evidenceCount } : null };
});
const out = { schemaVersion: 'V27-ENDING-REACHABILITY-1', routeAware: true, normalRunCaseCount: ids.length, reachable, status: reachable.every(item => item.reachable) ? 'PASS' : 'FAIL' };
fs.mkdirSync('docs/v27', { recursive: true });
fs.writeFileSync('docs/v27/ENDING_REACHABILITY.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
if (out.status === 'FAIL') process.exitCode = 1;
