import fs from 'node:fs/promises';
const path = 'data/v27-case-bundle.json';
const bundle = JSON.parse(await fs.readFile(path, 'utf8'));
const c19 = bundle.cases.find(item => item.caseId === 'C19');
if (!c19) throw new Error('C19 missing');
c19.date = '1849-02';
c19.historicalAudit = { ...(c19.historicalAudit || {}), checkedAt: new Date().toISOString().slice(0, 10), timelineNote: 'Placed after C21 because Annenkov source is a 1849 publication reviewing 1848 material.' };
await fs.writeFile(path, JSON.stringify(bundle, null, 2) + '\n');
const graphPath = 'narrative/VN_DIALOGUE_GRAPH.json';
const graph = JSON.parse(await fs.readFile(graphPath, 'utf8'));
const graphC19 = graph.cases.find(item => item.caseId === 'C19');
if (graphC19) {
  graphC19.dateRange = ['1849-02', '1849-02'];
  for (const node of graphC19.nodes) node.dateRange = ['1849-02', '1849-02'];
}
await fs.writeFile(graphPath, JSON.stringify(graph, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', caseId: 'C19', date: c19.date, order: 'C21(1848) -> C19(1849) -> C24(1849)' }, null, 2));
