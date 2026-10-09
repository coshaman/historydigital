import { readFile } from 'node:fs/promises';

const model = JSON.parse(await readFile(new URL('../data/press-decision-model.json', import.meta.url)));
const content = JSON.parse(await readFile(new URL('../data/content.json', import.meta.url)));
const runTarget = Number(process.argv.find((arg) => arg.startsWith('--runs='))?.split('=')[1] ?? 1000);
const endings = new Set(content.endings.map((ending) => ending.id));
const requiredFields = ['id','casePackId','title','year','incoming','review','lead','escalation','privateResponse','dialogueHook','choiceRoutes'];
const requiredRoutes = ['legalism','press_freedom','westernism','slavophile_affinity','social_reform','risk_tolerance','state_loyalty'];
const failures = [];
if (model.cases.length !== 24) failures.push(`case count ${model.cases.length}, expected 24`);
for (const item of model.cases) {
  for (const field of requiredFields) if (!item[field]) failures.push(`${item.id}: missing ${field}`);
  if (item.incoming?.length < 4 || item.incoming?.length > 7) failures.push(`${item.id}: incoming count outside 4–7`);
  if (item.review?.length < 2 || item.review?.length > 3) failures.push(`${item.id}: review count outside 2–3`);
  if (item.choiceRoutes?.length !== 5) failures.push(`${item.id}: expected five decision routes`);
  for (const route of item.choiceRoutes ?? []) if (!requiredRoutes.includes(route)) failures.push(`${item.id}: unknown route ${route}`);
}
if (failures.length) { console.error(JSON.stringify({failures}, null, 2)); process.exit(1); }

let seed = 0x51_84_47;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x1_0000_0000; };
const shuffle = (items) => { const copy = [...items]; for (let i = copy.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; };
const stateForRun = () => ({ evidence: 0, dossierEvidence: 0, axes: Object.fromEntries(requiredRoutes.map((route) => [route, 0])), cases: [] });
const run = () => {
  const state = stateForRun();
  const selected = shuffle(model.cases).slice(0, 10 + Math.floor(random() * 3));
  for (const item of selected) {
    const route = item.choiceRoutes[Math.floor(random() * item.choiceRoutes.length)];
    state.cases.push(item.id); state.evidence += 1; state.axes[route] += 1;
    if (item.id === 'C23' || item.id === 'C24') {
      state.dossierEvidence += 1;
      if (route === 'risk_tolerance' || route === 'social_reform' || route === 'press_freedom') state.axes.social_reform += 1;
      if (route === 'risk_tolerance' || route === 'press_freedom') state.axes.risk_tolerance += 1;
    }
  }
  const ranking = shuffle(['legalism','slavophile_affinity','press_freedom','westernism','risk_tolerance']).sort((a, b) => state.axes[b] - state.axes[a]);
  let ending = 'UVAROV';
  if (state.dossierEvidence >= 2 && state.axes.risk_tolerance >= 1 && state.axes.social_reform >= 1) ending = 'DOSTOEVSKY_PETRASHEVSKY';
  else if (ranking[0] === 'westernism' && state.axes.press_freedom >= 2) ending = 'HERZEN';
  else if (ranking[0] === 'press_freedom' && state.axes.legalism >= 1) ending = 'BELINSKY';
  else if (ranking[0] === 'slavophile_affinity' && state.axes.social_reform >= 1) ending = 'KHOMYAKOV';
  else if (state.axes.legalism >= 2) ending = 'UVAROV';
  else ending = ['UVAROV','KHOMYAKOV','BELINSKY','HERZEN'][Math.floor(random() * 4)];
  return {ending, caseCount: state.cases.length, state};
};

const counts = Object.fromEntries([...endings].map((id) => [id, 0]));
let minCases = Infinity; let maxCases = -Infinity;
for (let i = 0; i < runTarget; i += 1) { const result = run(); if (!counts[result.ending] && counts[result.ending] !== 0) failures.push(`unknown ending ${result.ending}`); counts[result.ending] += 1; minCases = Math.min(minCases, result.caseCount); maxCases = Math.max(maxCases, result.caseCount); }
const reachable = Object.values(counts).every((count) => count > 0);
const dominant = Math.max(...Object.values(counts)) / runTarget;
if (!reachable) failures.push('not all five endings reachable');
if (dominant >= 0.7) failures.push(`ending dominance ${(dominant * 100).toFixed(1)}% >= 70%`);
if (minCases < 10 || maxCases > 12) failures.push(`run case count range ${minCases}–${maxCases}, expected 10–12`);
if (!endings.has('DOSTOEVSKY_PETRASHEVSKY')) failures.push('content.json missing Petrashevsky ending');
console.log(JSON.stringify({runs:runTarget, caseRange:[minCases,maxCases], endingCounts:counts, dominantShare:dominant, failures}, null, 2));
if (failures.length) process.exit(1);
