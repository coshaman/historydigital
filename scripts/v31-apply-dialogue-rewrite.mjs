import fs from 'node:fs';

const graphPath = 'narrative/VN_DIALOGUE_GRAPH.json';
const sourcePath = 'narrative/V31_CORE_DIALOGUE.json';
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const ids = ['C01','C02','C03','C04','C05','C06','C07','C14','C17','C21','C19','C24'];
const caseMap = new Map(graph.cases.map((item) => [item.caseId, item]));

for (const caseId of ids) {
  const data = caseMap.get(caseId);
  const authored = source.cases[caseId];
  if (!data || !authored) throw new Error(`missing V31 source for ${caseId}`);
  const intro = authored.intro.map(([speakerId, utteranceKo], index) => ({
    id: `V31-${caseId}-INTRO-${index + 1}`,
    caseId,
    dateRange: data.dateRange,
    speakerId,
    utteranceKo,
    historicalClaims: [],
  }));
  data.v31Scene = { version: 'V31', intro, choicePrompt: '당신은 어느 쪽에 먼저 손을 댈 것인가?', editedAt: '2026-10-03' };
  data.nodes = data.nodes.filter((node) => !String(node.id).startsWith(`V31-${caseId}-INTRO-`));
  data.nodes.push(...intro);
  data.choices.forEach((choice, index) => {
    const [spokenKo, reactionKo] = authored.choices[index];
    if (!spokenKo || !reactionKo) throw new Error(`incomplete V31 choice ${caseId}/${index}`);
    choice.spokenKo = spokenKo;
    choice.reactionKo = reactionKo;
    choice.speakerId = 'PLAYER_ACTION';
    const reaction = data.nodes.find((node) => node.id === choice.edgeTo);
    if (!reaction) throw new Error(`missing reaction ${caseId}/${choice.edgeTo}`);
    reaction.utteranceKo = reactionKo;
    reaction.speakerId = ['alexei', 'ekaterina', 'pavel'][index];
    const nested = data.nodes.find((node) => node.id === choice.id);
    if (nested?.choices?.[0]) {
      nested.choices[0].spokenKo = spokenKo;
      nested.choices[0].reactionKo = reactionKo;
    }
  });
}

fs.writeFileSync(graphPath, `${JSON.stringify(graph, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', changedCases: ids, changedChoices: ids.length * 3, changedIntroLines: ids.length * 4 }, null, 2));
