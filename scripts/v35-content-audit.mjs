import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const sourceIndex = read('rpg/data/source-reader-index.json');
const contexts = read('rpg/data/case-contexts.json').cases;
const characterIds = ['seamstress_anna','printer_ekaterina','clerk_alexei','courier_pavel','tenant_mikhail','bookseller_lev','senior_clerk_konstantin','reader_darya'];
for (const id of characterIds) {
  const card = read(`rpg/characters/${id}.json`);
  assert.equal(card.worldview.status, 'fictional_character_design', `${id} opinions remain labeled fictional`);
  assert.equal(Object.keys(card.speechRegister).length, 6, `${id} has six relationship/situation registers`);
  assert.equal(Object.keys(card.topicStances).length, 5, `${id} has stance and knowledge boundaries`);
  assert.equal(card.voiceSamples.length, 3, `${id} has three authored voice examples`);
}
const campaign = read('rpg/quests/campaign.json');
const historicalClaims = new Map(read('rpg/data/historical-claim-ledger.json').claims.map(item => [item.claimId, item]));
const questFiles = ['printshop-article','public-discourse-1848','circle-investigation-1849','circle-letter-1849-may','literary-dead-souls','literary-overcoat'];
const quests = new Map(questFiles.map(file => { const item = read(`rpg/quests/${file}.json`); return [item.id, item]; }));
const sources = new Map([
  read('rpg/data/sovremennik-1847-issue.json'),read('rpg/data/khor-kalynych-source.json'),
  ...read('rpg/data/historical-source-packets.json').records,
  read('rpg/data/dead-souls-source.json'),read('rpg/data/overcoat-source.json'),
].map(item => [item.sourceId, item]));
const indexById = new Map(sourceIndex.records.map(item => [item.sourceId, item]));
assert.equal(indexById.size, sourceIndex.records.length, 'source index IDs must be unique');
for (const item of sourceIndex.records) {
  assert.ok(sources.has(item.sourceId), `source reader record exists: ${item.sourceId}`);
  assert.ok(item.excerptId && item.pageLocator && item.contextKo && item.rightsNoteKo, `source reader provenance/context complete: ${item.sourceId}`);
  assert.equal(item.textStatus, 'DIRECT', `${item.sourceId} direct-text status`);
  assert.equal(item.renderingStatus, 'RECONSTRUCTED', `${item.sourceId} rendering status`);
  const source = sources.get(item.sourceId);
  for (const [index, paragraph] of (source.paragraphs ?? []).entries()) {
    assert.ok(paragraph.ru?.trim() && paragraph.ko?.trim(), `${item.sourceId} paragraph ${index + 1} has aligned RU and KO`);
  }
}
const caseRows = [];
for (const item of contexts) {
  const quest = quests.get(item.questId);
  assert.ok(quest, `case quest exists: ${item.questId}`);
  assert.equal(item.eraDate, quest.date, `${item.questId} context date matches quest`);
  assert.ok(item.sourceIds.length, `${item.questId} has evidence sources`);
  for (const sourceId of item.sourceIds) assert.ok(indexById.has(sourceId), `${item.questId} source has exact reader index: ${sourceId}`);
  for (const claimId of item.claimIds ?? []) assert.ok(item.sourceIds.includes(historicalClaims.get(claimId)?.sourceId), `${item.questId} claim is backed by one of its listed sources: ${claimId}`);
  for (const [roleId, role] of Object.entries(item.roles)) {
    assert.ok(role.entrySituationKo && role.personalStakesKo && role.discussionQuestions.length >= 2, `${item.questId}/${roleId} has playable role context`);
    for (const actionId of role.authorizedActionIds) assert.ok(quest.actions.some(action => action.id === actionId && action.hostIds.includes(roleId)), `${item.questId}/${roleId} action permission matches quest`);
    caseRows.push({ questId: item.questId, eraDate: item.eraDate, roleId, sourceIds: item.sourceIds, excerptIds: item.sourceIds.map(sourceId => indexById.get(sourceId).excerptId), authorizedActionIds: role.authorizedActionIds });
  }
}
assert.equal(campaign.endings.length, 5, 'exactly five endings remain authored');
const output = { schemaVersion: 'V35_CONTENT_AUDIT_V1', status: 'PASS', sourceReaderRecords: sourceIndex.records.length, fictionalCharacterProfiles: characterIds.length, caseFlows: contexts.length, playableRoles: caseRows.length, caseRoleMatrix: caseRows, immutableEndingCount: campaign.endings.length, inspectedSourceMetadataOnly: true };
const target = path.join(root, 'docs', 'v35', 'content-audit.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ status: output.status, sourceReaderRecords: output.sourceReaderRecords, fictionalCharacterProfiles: output.fictionalCharacterProfiles, caseFlows: output.caseFlows, playableRoles: output.playableRoles, endings: output.immutableEndingCount, output: 'docs/v35/content-audit.json' }, null, 2));
