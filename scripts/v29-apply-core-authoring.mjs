import fs from 'node:fs/promises';

const graphPath = 'narrative/VN_DIALOGUE_GRAPH.json';
const authoring = JSON.parse(await fs.readFile('narrative/V29_CORE_AUTHORING.json', 'utf8'));
const graph = JSON.parse(await fs.readFile(graphPath, 'utf8'));
const makeChoice = (caseId, index, [spokenKo, reactionKo, effects, revealsTo]) => ({ id: `V28-${caseId}-CHOICE-${index}`, spokenKo, actionChannel: 'SPOKEN', edgeTo: `V28-${caseId}-REACTION-${index}`, effects, revealsTo, reactionKo, historicalClaims: [] });
for (const [caseId, custom] of Object.entries(authoring)) {
  const base = graph.cases.find(item => item.caseId === caseId);
  if (!base) throw new Error(`missing graph case ${caseId}`);
  const dateRange = base.dateRange;
  const lines = custom.lines.map(([speakerId, utteranceKo], index) => ({ id: `V29-${caseId}-LINE-${index + 1}`, caseId, dateRange, speakerId, utteranceKo, historicalClaims: [] }));
  const choices = custom.choices.map((choice, index) => makeChoice(caseId, index + 1, choice));
  const choiceNodes = choices.map(choice => ({ id: choice.edgeTo.replace('REACTION', 'CHOICE'), caseId, dateRange, speakerId: 'PLAYER_ACTION', utteranceKo: choice.spokenKo, choices: [choice], historicalClaims: [] }));
  const reactions = choices.map(choice => ({ id: choice.edgeTo, caseId, dateRange, speakerId: choice.revealsTo[0], utteranceKo: choice.reactionKo, historicalClaims: [] }));
  const sourceIds = base.sourceIds || [];
  const excerptIds = base.historicalExcerptIds || [];
  const inspect = { id: `V29-${caseId}-INSPECT`, caseId, dateRange, speakerId: 'NARRATION_MINIMAL', utteranceKo: `${base.titleKo}의 원문과 한국어 번역을 나란히 펼쳐, 서로 다른 문서의 목소리를 확인한다.`, historicalClaims: excerptIds.slice(0, 3).map(excerptId => ({ sourceId: sourceIds[0], excerptId, classification: 'PARAPHRASE' })) };
  base.nodes = [...lines, ...choiceNodes, ...reactions, inspect];
  base.choices = choices;
  base.entryNodeId = lines[0].id;
  base.dramaticPurpose = `${base.dramaticPurpose} (V29 authored core scene)`;
}
await fs.writeFile(graphPath, JSON.stringify(graph, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', authoredCases: Object.keys(authoring), lines: Object.fromEntries(Object.entries(authoring).map(([id, item]) => [id, item.lines.length])) }, null, 2));
