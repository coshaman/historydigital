import fs from 'node:fs';

const graph = JSON.parse(fs.readFileSync('narrative/VN_DIALOGUE_GRAPH.json', 'utf8'));
const ids = ['C01','C02','C03','C04','C05','C06','C07','C14','C17','C21','C19','C24'];
const rows = [];
const allChoiceText = [];
const failures = [];
for (const caseId of ids) {
  const data = graph.cases.find((item) => item.caseId === caseId);
  const scene = data?.v31Scene;
  const choices = data?.choices || [];
  const intro = scene?.intro || [];
  const hasThree = choices.length === 3;
  const earlyChoice = intro.length >= 4 && intro.length <= 7;
  const noForcedAction = intro.every((line) => line.speakerId !== 'PLAYER_ACTION');
  const distinct = new Set(choices.map((choice) => choice.spokenKo)).size === 3;
  const reactions = choices.every((choice) => {
    const reaction = data.nodes.find((node) => node.id === choice.edgeTo);
    return reaction && reaction.utteranceKo === choice.reactionKo && !/^(알렉세이|예카테리나|파벨):/.test(reaction.utteranceKo);
  });
  if (!hasThree || !earlyChoice || !noForcedAction || !distinct || !reactions) failures.push(caseId);
  choices.forEach((choice, index) => {
    allChoiceText.push(choice.spokenKo);
    rows.push({ caseId, choice: index + 1, choiceId: choice.id, choiceText: choice.spokenKo, reaction: choice.reactionKo, introLines: intro.length, earlyChoice, noForcedAction, relationTarget: choice.revealsTo?.join('|') || '', channel: Object.keys(choice.effects?.access || {})[0] || '' });
  });
}
const report = { schemaVersion: 'V31-CORE-DIALOGUE-AUDIT-1', status: failures.length ? 'FAIL' : 'PASS', coreCases: ids, choiceCount: allChoiceText.length, distinctChoiceCount: new Set(allChoiceText).size, failures, checkedAt: new Date().toISOString() };
fs.mkdirSync('docs/v31', { recursive: true });
fs.writeFileSync('docs/v31/CORE_12_DIALOGUE_EDITOR_CHECK.csv', ['caseId,choice,choiceId,choiceText,reaction,introLines,earlyChoice,noForcedAction,relationTarget,channel', ...rows.map((row) => Object.values(row).map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))].join('\n') + '\n');
fs.writeFileSync('docs/v31/CORE_12_DIALOGUE_AUDIT.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exit(1);
