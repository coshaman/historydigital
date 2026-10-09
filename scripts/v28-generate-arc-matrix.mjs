import fs from 'node:fs';
const graph=JSON.parse(fs.readFileSync('narrative/VN_DIALOGUE_GRAPH.json','utf8'));
const rows=['caseId,dateRange,dramaticPurpose,startingKnowledge,choice1,choice2,choice3,memoryCallback,afterCase,endingLinks'];
for(const c of graph.cases){const choices=c.choices.map(x=>x.spokenKo.replaceAll(',','、'));rows.push([c.caseId,c.dateRange.join(' to '),c.dramaticPurpose.replaceAll(',','、'),`NPC knowledge differs at arrival`,...choices,c.memoryCallback.replaceAll(',','、'),c.afterScene,'all'].join(','))}
fs.writeFileSync('narrative/NARRATIVE_ARC_MATRIX.csv',rows.join('\n')+'\n');console.log(`v28-generate-arc-matrix: ${graph.cases.length} rows`);
