import fs from 'node:fs';

const graph = JSON.parse(fs.readFileSync('narrative/VN_DIALOGUE_GRAPH.json', 'utf8'));
const matrix = fs.readFileSync('narrative/NARRATIVE_ARC_MATRIX.csv', 'utf8').trim().split(/\r?\n/).slice(1).map((line) => {
  const [caseId, dateRange] = line.split(',', 2);
  return { caseId, dateRange };
});
const matrixById = new Map(matrix.map((item) => [item.caseId, item]));
const mismatches = [];
for (const scene of graph.cases) {
  const expected = `${scene.dateRange[0]} to ${scene.dateRange[1]}`;
  const actual = matrixById.get(scene.caseId)?.dateRange;
  if (actual !== expected) mismatches.push({ caseId: scene.caseId, graph: expected, matrix: actual || null });
}
const report = { schemaVersion: 'V28-CANONICAL-TIMELINE-1', status: mismatches.length ? 'FAIL' : 'PASS', caseCount: graph.cases.length, mismatches };
fs.mkdirSync('docs/v28', { recursive: true });
fs.writeFileSync('docs/v28/CANONICAL_TIMELINE_AUDIT.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exit(1);
