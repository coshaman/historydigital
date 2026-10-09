import fs from 'node:fs';
import crypto from 'node:crypto';

const graph=JSON.parse(fs.readFileSync('narrative/VN_DIALOGUE_GRAPH.json','utf8'));
const failures=[]; const utterances=graph.cases.flatMap(c=>c.nodes.filter(n=>n.utteranceKo).map(n=>n.utteranceKo));
const ids=graph.cases.flatMap(c=>c.nodes.map(n=>n.id));
const choices=graph.cases.flatMap(c=>c.choices);
if(graph.cases.length!==24) failures.push(`caseCount=${graph.cases.length}`);
if(new Set(ids).size!==ids.length) failures.push('duplicate node id');
if(new Set(utterances).size<500) failures.push(`uniqueUtterances=${new Set(utterances).size}`);
if(choices.length<72) failures.push(`choiceCount=${choices.length}`);
for(const c of graph.cases){for(const ch of c.choices){if(!c.nodes.some(n=>n.id===ch.edgeTo)) failures.push(`${c.caseId}:${ch.id}:missing edge`);if(!ch.spokenKo||ch.actionChannel!=='SPOKEN') failures.push(`${c.caseId}:${ch.id}:not spoken`)}for(const n of c.nodes){for(const claim of n.historicalClaims||[]){if(!claim.sourceId||!claim.excerptId) failures.push(`${n.id}:missing source claim`)}}}
const forbidden=['시범 케이스','내 판단','케이스 후속 기록','자료 처리의 순서를 선택하십시오','후속 자료가 열렸습니다'];
for(const text of utterances) for(const word of forbidden) if(text.includes(word)) failures.push(`forbidden:${word}`);
if(graph.endings.length!==5||new Set(graph.endings.map(e=>e.id)).size!==5) failures.push('ending count/uniqueness');
const normal=graph.cases.filter(c=>['C01','C02','C03','C04','C05','C06','C07','C14','C17','C19','C21','C24'].includes(c.caseId)).sort((a,b)=>a.dateRange[0].localeCompare(b.dateRange[0]));
for(let i=1;i<normal.length;i++) if(normal[i].dateRange[0]<normal[i-1].dateRange[0]) failures.push(`date regression ${normal[i-1].caseId}->${normal[i].caseId}`);
const report={schemaVersion:'V28-ACCEPTANCE-1',status:failures.length?'FAIL':'PASS',caseCount:graph.cases.length,nodeCount:ids.length,uniqueUtteranceCount:new Set(utterances).size,choiceCount:choices.length,endingCount:graph.endings.length,normalRunCaseIds:normal.map(c=>c.caseId),forbiddenRuntimeCopyFindings:[...new Set(failures.filter(x=>x.startsWith('forbidden:')))],failures,graphSha256:crypto.createHash('sha256').update(fs.readFileSync('narrative/VN_DIALOGUE_GRAPH.json')).digest('hex')};
fs.mkdirSync('docs/v28',{recursive:true});
const serialized=JSON.stringify(report,null,2)+'\n';
fs.writeFileSync('docs/v28/V28_ACCEPTANCE.json',serialized);
fs.writeFileSync('docs/v28/ACCEPTANCE.json',serialized);
console.log(JSON.stringify(report,null,2));if(failures.length)process.exit(1);
