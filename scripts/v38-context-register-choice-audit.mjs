import fs from 'node:fs';

const path = 'narrative/MAIN_20MIN_DIALOGUE.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const failures = [];
const requiredScenes = ['C03', 'C06', 'C07', 'E02', 'E07'];
const requiredCharacters = ['alexei', 'ekaterina', 'pavel', 'protagonist'];
const requiredSituations = ['firstMeeting', 'ordinaryColleague', 'private', 'conflict', 'increasedIntimacy', 'formalInstitutional'];
const requiredDirectionKeys = ['audience', 'recordMode', 'leavesOffice', 'risk'];

if (!Array.isArray(data.literaryBorrowings)) failures.push('literaryBorrowings must be an array');
for (const borrowing of data.literaryBorrowings || []) {
  for (const key of ['id', 'type', 'author', 'work', 'originalRussian', 'sourceUrl', 'koreanTranslation']) {
    if (!borrowing[key]) failures.push(`literary borrowing ${borrowing.id || '<unknown>'} missing ${key}`);
  }
  if (borrowing.type !== 'LITERARY_BORROWING') failures.push(`literary borrowing ${borrowing.id || '<unknown>'} must be tagged LITERARY_BORROWING`);
  if (borrowing.historicalStatement === true) failures.push(`literary borrowing ${borrowing.id || '<unknown>'} is marked as historical statement`);
}

const matrix = data.speechRegisterMatrix;
for (const character of requiredCharacters) {
  if (!matrix?.[character]) failures.push(`speech matrix missing character ${character}`);
  for (const situation of requiredSituations) {
    const item = matrix?.[character]?.[situation];
    if (!item) failures.push(`speech matrix missing ${character}.${situation}`);
    else for (const key of ['sentenceEndings', 'rhythm', 'vocabulary']) if (!Array.isArray(item[key]) || item[key].length < 2) failures.push(`${character}.${situation}.${key} needs two or more markers`);
  }
}
const signatures = requiredCharacters.map((character) => requiredSituations.map((situation) => {
  const item = matrix?.[character]?.[situation];
  return item ? `${item.sentenceEndings.join('|')}::${item.rhythm.join('|')}::${item.vocabulary.join('|')}` : '';
}).join('||'));
if (signatures.filter(Boolean).length === requiredCharacters.length && new Set(signatures).size < requiredCharacters.length) failures.push('speech audit: character register signatures are effectively identical');

const actualLines = Object.fromEntries(requiredCharacters.map((character) => [character, []]));
const addActual = (speaker, text) => { if (requiredCharacters.includes(speaker) && typeof text === 'string' && text.trim()) actualLines[speaker].push(text.trim()); };
for (const scene of data.scenes || []) {
  for (const [speaker, text] of scene.intro || []) addActual(speaker, text);
  addActual(scene.character, scene.question);
  for (const callback of scene.memoryCallbacks || []) addActual(callback.character, callback.line);
  for (const choice of [...(scene.choices || []), ...(scene.postChoices || [])]) {
    addActual(choice.actor === 'PLAYER' ? 'protagonist' : choice.actor, choice.text);
    addActual(choice.reactionActor, choice.reaction);
    for (const [speaker, text] of choice.reactionSequence || []) addActual(speaker, text);
    if (choice.reactionSequence?.length && choice.reactionActor === 'NARRATION') failures.push(`${choice.id} reactionActor must match the first reactionSequence speaker`);
    if (/^(알렉세이|예카테리나|파벨):/.test(choice.reaction || '')) failures.push(`${choice.id} reaction repeats a speaker label already rendered by reactionActor`);
  }
}
const endingTokens = ['습니다', '합니다', '바랍니다', '어요', '군요', '죠', '겠어', '겠지요', '군', '어', '지', '해요', '해', '말아요', '않겠습니다', '할게요', '다', '요'];
const actualSignature = (character) => {
  const lines = actualLines[character];
  const endings = [...new Set(lines.flatMap((line) => { const normalized = line.replace(/[.!?…]+$/g, ''); return endingTokens.filter((token) => normalized.endsWith(token)); }))].sort();
  const rhythm = [...new Set(lines.map((line) => `${(line.match(/[.!?]/g) || []).length || 1}:${line.length < 35 ? 'short' : line.length < 75 ? 'mid' : 'long'}`))].sort();
  return `${endings.join('|')}::${rhythm.join('|')}`;
};
const actualSignatures = requiredCharacters.map(actualSignature);
for (const character of requiredCharacters) if (actualLines[character].length < 2) failures.push(`speech audit: insufficient canonical lines for ${character}`);
if (actualSignatures.every(Boolean) && new Set(actualSignatures).size < requiredCharacters.length) failures.push('speech audit: canonical dialogue endings and rhythm are effectively identical');

for (const sceneId of requiredScenes) {
  const scene = data.scenes.find((item) => item.id === sceneId);
  if (!scene) { failures.push(`missing core scene ${sceneId}`); continue; }
  for (const excerpt of scene.excerpts || []) {
    const range = excerpt.contextRange || data.sourceContextRanges?.[excerpt.excerptId];
    if (!range || range.type !== 'CONTIGUOUS_WITNESS_RANGE' || range.sourceId !== excerpt.sourceId) failures.push(`${excerpt.excerptId} missing contiguous witness context range`);
    if (!range?.startLocator || !range?.endLocator || ((!range?.ru || !range?.ko) && (!range?.ruRef || !range?.koRef))) failures.push(`${excerpt.excerptId} context range must include exact locators and aligned RU/KO`);
    if ((range?.ru && range.ru !== excerpt.ru) || (range?.ko && range.ko !== excerpt.ko) || (range?.ruRef && range.ruRef !== excerpt.excerptId) || (range?.koRef && range.koRef !== excerpt.excerptId)) failures.push(`${excerpt.excerptId} context range is not aligned to the displayed RU/KO passage`);
    if (range?.paragraphCount < 1) failures.push(`${excerpt.excerptId} context range has no paragraph`);
  }
  for (const choice of [...(scene.choices || []), ...(scene.postChoices || [])]) {
    const direction = choice.immediateDirection || data.choiceImmediateDirections?.[choice.id];
    if (!direction) failures.push(`${choice.id} missing immediateDirection`);
    else for (const key of requiredDirectionKeys) if (typeof direction[key] !== 'string' || !direction[key].trim()) failures.push(`${choice.id} immediateDirection.${key} missing`);
    if (direction?.revealsHiddenOutcome === true) failures.push(`${choice.id} immediate direction reveals hidden outcome`);
  }
}

const forbiddenUniformEndings = ['합니다', '해요', '군요', '죠'];
for (const character of requiredCharacters) {
  const endingSet = new Set(Object.values(matrix?.[character] || {}).flatMap((item) => item?.sentenceEndings || []));
  if (endingSet.size < 2 || forbiddenUniformEndings.every((ending) => endingSet.has(ending) && endingSet.size === 1)) failures.push(`${character} has insufficiently varied speech endings`);
}

if (failures.length) {
  console.error(`V38_CONTEXT_REGISTER_CHOICE_AUDIT: FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('V38_CONTEXT_REGISTER_CHOICE_AUDIT: PASS');
console.log(JSON.stringify({ scenes: requiredScenes.length, characters: requiredCharacters.length, situations: requiredSituations.length, literaryBorrowings: data.literaryBorrowings.length }, null, 2));
