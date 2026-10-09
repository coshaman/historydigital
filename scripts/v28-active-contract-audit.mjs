import fs from 'node:fs';

const graph = JSON.parse(fs.readFileSync('narrative/VN_DIALOGUE_GRAPH.json', 'utf8'));
const bundle = JSON.parse(fs.readFileSync('data/v27-case-bundle.json', 'utf8'));
const main = JSON.parse(fs.readFileSync('narrative/MAIN_20MIN_DIALOGUE.json', 'utf8'));
const failures = [];
const cases = graph.cases || [];
const choices = cases.flatMap((item) => item.choices || []);
if (cases.length !== 24) failures.push(`expected 24 cases, got ${cases.length}`);
if (choices.length !== 72) failures.push(`expected 72 spoken choices, got ${choices.length}`);
for (const choice of choices) {
  if (!choice.edgeTo || !cases.some((item) => (item.nodes || []).some((node) => node.id === choice.edgeTo))) failures.push(`${choice.id} has no real reaction edge`);
  if (!Array.isArray(choice.revealsTo) || choice.revealsTo.length === 0) failures.push(`${choice.id} has no immediate audience`);
  if (!choice.effects?.access || Object.keys(choice.effects.access).length === 0) failures.push(`${choice.id} has no record direction`);
}
for (const item of bundle.cases || []) {
  for (const excerpt of item.excerpts || []) {
    if (!excerpt.ru?.trim() || !excerpt.ko?.trim() || !excerpt.context?.trim() || !excerpt.locator?.trim()) failures.push(`${item.caseId}/${excerpt.excerptId} lacks aligned source context`);
  }
}
const matrix = main.speechRegisterMatrix || {};
for (const character of ['alexei', 'ekaterina', 'pavel', 'protagonist']) {
  for (const situation of ['firstMeeting', 'ordinaryColleague', 'private', 'conflict', 'increasedIntimacy', 'formalInstitutional']) {
    const item = matrix[character]?.[situation];
    if (!item || item.sentenceEndings?.length < 2 || item.rhythm?.length < 2 || item.vocabulary?.length < 2) failures.push(`speech register missing ${character}.${situation}`);
  }
}
if (!Array.isArray(main.literaryBorrowings)) failures.push('literary borrowing registry missing');
for (const borrowing of main.literaryBorrowings || []) if (borrowing.type !== 'LITERARY_BORROWING' || borrowing.historicalStatement === true) failures.push(`invalid literary borrowing ${borrowing.id || '<unknown>'}`);
if (!fs.readFileSync('gold-runtime.js', 'utf8').includes('function v28ChoiceContext')) failures.push('runtime does not render immediate choice context');
if (!fs.readFileSync('gold-runtime.js', 'utf8').includes('v28-source-context')) failures.push('runtime does not render source context note');
const result = {schemaVersion:'V28-ACTIVE-CONTRACT-AUDIT-1', status: failures.length ? 'FAIL' : 'PASS', caseCount:cases.length, choiceCount:choices.length, bundleExcerptCount:(bundle.cases || []).reduce((sum, item) => sum + (item.excerpts || []).length, 0), speechCharacters:4, speechSituations:6, literaryBorrowings:(main.literaryBorrowings || []).length, failures};
fs.mkdirSync('docs/v28', {recursive:true});
fs.writeFileSync('docs/v28/ACTIVE_CONTRACT_AUDIT.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
