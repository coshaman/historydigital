import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const write = (relative, content) => {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};
const characterIds = ['seamstress_anna','printer_ekaterina','clerk_alexei','courier_pavel','tenant_mikhail','bookseller_lev','senior_clerk_konstantin','reader_darya'];
const characters = characterIds.map(id => read(`rpg/characters/${id}.json`));
const cases = read('rpg/data/case-contexts.json').cases;
const readerRecords = new Map(read('rpg/data/source-reader-index.json').records.map(item => [item.sourceId, item]));
const quoteCsv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const topicRows = [['characterId','nameKo','socialEstate','occupation','worldviewKo','topicId','knowledgeKind','fictionalPositionKo','speechRhythm','relationshipRegister','voiceSamplesKo']];
for (const card of characters) for (const [topicId, stance] of Object.entries(card.topicStances)) {
  topicRows.push([card.id,card.displayNameKo,card.socialEstate,card.occupation,card.worldview.stanceKo,topicId,stance.knowledgeKind,stance.positionKo,card.speechRhythm,Object.entries(card.speechRegister).map(([key,value]) => `${key}: ${value}`).join(' | '),card.voiceSamples.join(' | ')]);
}
write('docs/v35/CHARACTER_KNOWLEDGE_AND_SOURCE_LEDGER.csv', `${topicRows.map(row => row.map(quoteCsv).join(',')).join('\n')}\n`);

const caseRows = [['questId','eraDate','roleId','sceneTitleKo','premiseKo','personalStakesKo','decisionQuestionKo','sourceIds','excerptIds','authorizedActionIds','historicalBoundaryKo']];
for (const item of cases) for (const [roleId, role] of Object.entries(item.roles)) {
  const excerptIds = item.sourceIds.map(id => readerRecords.get(id)?.excerptId ?? 'INDEX_MISSING').join('; ');
  caseRows.push([item.questId,item.eraDate,roleId,item.playerFacing.sceneTitleKo,item.playerFacing.premiseKo,role.personalStakesKo,item.playerFacing.decisionQuestionKo,item.sourceIds.join('; '),excerptIds,role.authorizedActionIds.join('; '),item.historicalBoundaryKo]);
}
write('docs/v35/QUEST_SOURCE_DIALOGUE_MATRIX.csv', `${caseRows.map(row => row.map(quoteCsv).join(',')).join('\n')}\n`);

const sections = ['# V35 character worldview and speech bible','', 'These six urban residents are fictional characters. Their views below are authored design, not testimony by historical people. The canonical data lives in `rpg/characters/*.json`; the API sends the same fields as character context. Historical facts stay in source packets and claim records.', ''];
for (const card of characters) {
  sections.push(`## ${card.displayNameKo} · ${card.occupation}`, '', `**Situation:** ${card.socialEstate}; ${card.wealthBracket} means ${card.risk}.`, '', `**Worldview:** ${card.worldview.stanceKo}`, '', `**Tension and blind spot:** ${card.worldview.tensionKo} ${card.worldview.blindSpotKo}`, '', `**Speech:** ${card.speechRhythm}`, '', `**Original voice samples:** ${card.voiceSamples.map(sample => `“${sample}”`).join(' ')}`, '');
  sections.push('| Topic | Knowledge boundary | Character position |','| --- | --- | --- |');
  for (const [topicId, stance] of Object.entries(card.topicStances)) sections.push(`| ${topicId} | ${stance.knowledgeKind} | ${stance.positionKo} |`);
  sections.push('', '| Situation | Register |','| --- | --- |');
  for (const [situation, register] of Object.entries(card.speechRegister)) sections.push(`| ${situation} | ${register} |`);
  sections.push('');
}
write('docs/v35/WORLDVIEW_BIBLE.md', `${sections.join('\n').trimEnd()}\n`);
console.log(JSON.stringify({ status: 'PASS', fictionalCharacters: characters.length, characterTopicRows: topicRows.length - 1, caseRoleRows: caseRows.length - 1, outputs: ['docs/v35/WORLDVIEW_BIBLE.md','docs/v35/CHARACTER_KNOWLEDGE_AND_SOURCE_LEDGER.csv','docs/v35/QUEST_SOURCE_DIALOGUE_MATRIX.csv'] }, null, 2));
