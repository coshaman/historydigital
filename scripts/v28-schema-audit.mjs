import fs from 'node:fs';
const graph=JSON.parse(fs.readFileSync('narrative/VN_DIALOGUE_GRAPH.json','utf8'));
const bundle=JSON.parse(fs.readFileSync('data/v27-case-bundle.json','utf8'));
const failures=[]; const nodeIds=new Set(); const choiceIds=new Set(); const utterances=new Map();
if(graph.cases.length!==24) failures.push(`caseCount=${graph.cases.length}`);
for(const c of graph.cases){
  if(!c.caseId||!c.entryNodeId||!c.nodes?.length||c.choices?.length<3) failures.push(`${c.caseId}:missing graph fields`);
  for(const n of c.nodes){if(nodeIds.has(n.id))failures.push(`duplicate node ${n.id}`);nodeIds.add(n.id);if(!n.utteranceKo)failures.push(`${n.id}:empty utterance`);const isArchivedV29=/^V29-/.test(n.id)&&Boolean(c.v31Scene?.intro?.length);if(!isArchivedV29){const key=n.utteranceKo.trim();utterances.set(key,(utterances.get(key)||0)+1);}for(const claim of n.historicalClaims||[]){const old=bundle.cases.find(x=>x.caseId===c.caseId);if(!old?.sources?.some(s=>s.sourceId===claim.sourceId))failures.push(`${n.id}:bad source ${claim.sourceId}`);if(claim.excerptId&&!old?.excerpts?.some(x=>x.excerptId===claim.excerptId))failures.push(`${n.id}:bad excerpt ${claim.excerptId}`)}}
  for(const ch of c.choices){if(choiceIds.has(ch.id))failures.push(`duplicate choice ${ch.id}`);choiceIds.add(ch.id);if(!c.nodes.some(n=>n.id===ch.edgeTo))failures.push(`${ch.id}:missing edge`);if(!ch.spokenKo||ch.actionChannel!=='SPOKEN'||!ch.revealsTo?.length)failures.push(`${ch.id}:not witnessed spoken choice`)}
}
const repeated=[...utterances].filter(([,count])=>count>1);
if(repeated.length) failures.push(`repeated utterances=${repeated.length}`);
if(graph.endings.length!==5) failures.push(`endingCount=${graph.endings.length}`);
const report={schemaVersion:'V28-SCHEMA-AUDIT-1',status:failures.length?'FAIL':'PASS',caseCount:graph.cases.length,nodeCount:nodeIds.size,choiceCount:choiceIds.size,uniqueUtteranceCount:utterances.size,repeatedUtterances:repeated,endingCount:graph.endings.length,failures};
fs.mkdirSync('docs/v28',{recursive:true});fs.writeFileSync('docs/v28/SCHEMA_AUDIT.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
