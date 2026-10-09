import fs from 'node:fs';

const graph = JSON.parse(fs.readFileSync('narrative/VN_DIALOGUE_GRAPH.json', 'utf8'));
const failures = [];
const forbidden = [
  ['predicate-before-particle', /(?:묶지|졌다|놓였다|섞였다|발견됐다|도착했다|번졌다|어긋난다|들어왔다|놓였다) ?(?:을|를|이|가)$/],
  ['narration-fragment', /(?:선택|암시된다|시험한다|달라진다|가른다)라는 말/],
  ['duplicate-speaker-label', /^(?:알렉세이|예카테리나|파벨):.*(?:알렉세이|예카테리나|파벨):/]
];

for (const item of graph.cases) {
  for (const node of item.nodes) {
    for (const [kind, pattern] of forbidden) {
      if (pattern.test(node.utteranceKo)) failures.push({caseId:item.caseId,nodeId:node.id,kind,text:node.utteranceKo});
    }
  }
}

const report = {
  schemaVersion: 'V28-KOREAN-NATURALNESS-1',
  status: failures.length ? 'FAIL' : 'PASS',
  caseCount: graph.cases.length,
  utteranceCount: graph.cases.reduce((sum, item) => sum + item.nodes.length, 0),
  failures
};
fs.mkdirSync('docs/v28', {recursive:true});
fs.writeFileSync('docs/v28/KOREAN_NATURALNESS_AUDIT.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
