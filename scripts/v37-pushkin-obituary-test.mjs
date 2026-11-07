import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async url => JSON.parse(await readFile(url, 'utf8'));
const [quest, packet, index, catalog, mapFiles, cardFiles] = await Promise.all([
  read(new URL('../rpg/quests/v37-pushkin-obituary-1847.json', import.meta.url)),
  read(new URL('../rpg/data/historical-source-packets.json', import.meta.url)),
  read(new URL('../rpg/data/source-reader-index.json', import.meta.url)),
  read(new URL('../data/event_catalog_45.json', import.meta.url)),
  readdir(new URL('../rpg/maps/', import.meta.url)),
  readdir(new URL('../rpg/characters/', import.meta.url)),
]);
const maps = await Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/maps/${file}`, import.meta.url))))
  .then(rows => Object.fromEntries(rows.map(row => [row.mapId, row])));
const map = maps['bookshop-interior'];
const cards = await Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/characters/${file}`, import.meta.url))));
const sourceId = 'OBJ-PUSHKIN-OBITUARY-1837';
const source = packet.records.find(row => row.sourceId === sourceId);
assert.ok(source, 'the contemporary obituary is available as a readable source');
assert.equal(source.paragraphs.length, 1, 'the complete obituary paragraph remains contiguous');
assert.match(source.paragraphs[0].ru, /^Солнце нашей Поэзии закатилось!/);
assert.match(source.paragraphs[0].ru, /К этой мысли нельзя привыкнуть!/);
assert.equal(index.records.find(row => row.sourceId === sourceId)?.excerptId, 'EX-PUSHKIN-OBITUARY-1837-LP-NO5-001');
assert.equal(catalog.find(row => row.event_id === 'E43')?.validation_status, 'PRIMARY_PERIODICAL_TEXT_AND_ACADEMIC_TRANSCRIPTION_VERIFIED');
assert.equal(catalog.find(row => row.event_id === 'E43')?.occurrence_type, 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
  'the verified obituary text is historical evidence; the 1847 local reading is a game event');
assert.equal(map.layers.find(layer => layer.name === 'Interactions').objects.find(row => row.id === 4018)?.name, '1837년 부고를 펼쳐 읽다');

const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'bookshop-interior' });
state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 600; state.world.currentMapId = 'bookshop-interior';
state.player.embodiment = 'bookseller_lev';
for (const [id, x] of [['bookseller_lev', 13], ['reader_darya', 14], ['student_vasily', 15]]) {
  state.hosts[id].mapId = 'bookshop-interior'; state.hosts[id].position = { x, y: 13 };
  state.hosts[id].historicalAliveAndPresent = true;
}
state.player.position = { x: 13, y: 13 };
const eventObject = map.layers.find(layer => layer.name === 'Interactions').objects.find(row => row.id === quest.entry.objectId);
assert.equal(objectIsPresent(eventObject, state, [quest]), false, 'the reading event is not available before it begins');
let active = game.advanceNpcWorld(state, 1, maps, { pausedHostIds: ['bookseller_lev', 'reader_darya', 'student_vasily'] });
const event = active.world.livingEventStates.E43;
assert.equal(event?.status, 'ACTIVE', 'the dated reading gathers its residents');
assert.equal(active.ledger.flatMap(row => row.livingEvents ?? []).find(item => item.catalogEventId === 'E43')?.occurrenceType,
  'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION');
assert.equal(event.stage, 'READING_READY');
assert.ok(objectIsPresent(eventObject, active, [quest]));
assert.ok(active.ledger.some(row => row.livingEvents?.some(item => item.catalogEventId === 'E43')));
const readResult = game.recordSourceRead(active, sourceId, maps);
assert.equal(readResult.ok, true, readResult.reason);
const choices = questChoices(quest, 'bookseller_lev', [sourceId], readResult.state);
assert.deepEqual(choices.map(row => row.action.id), ['E43_KEEP_FULL_TEXT', 'E43_COPY_TO_REGISTER', 'E43_READ_TO_SHOP']);
assert.ok(choices.every(row => row.action.subcopyKo?.length > 8), 'each choice says who sees it and where it is kept');
for (const actionId of choices.map(row => row.action.id)) {
  const branch = structuredClone(readResult.state);
  const result = game.performQuestAction(branch, { questId: quest.id, hostId: 'bookseller_lev', actionId, objectId: quest.entry.objectId }, { quests: [quest], maps });
  assert.equal(result.ok, true, `${actionId}: ${result.reason ?? ''}`);
  assert.equal(result.state.world.livingEventStates.E43.status, 'RESOLVED');
  assert.equal(result.state.world.pushkinObituaryRecord.disposition, {
    E43_KEEP_FULL_TEXT: 'LEFT_OPEN_FOR_READERS', E43_COPY_TO_REGISTER: 'COPIED_TO_READING_LEDGER',
    E43_READ_TO_SHOP: 'READ_TO_SHOP',
  }[actionId]);
  if (actionId === 'E43_COPY_TO_REGISTER') assert.equal(result.state.hosts.bookseller_lev.readingLedger.at(-1).eventId, 'E43');
  if (actionId === 'E43_READ_TO_SHOP') assert.ok(result.state.hosts.reader_darya.knownEvidenceIds.includes(sourceId));
  assert.ok(result.state.quests[quest.id]?.completedActionIds?.includes(actionId) || result.state.ledger.length > branch.ledger.length,
    `${actionId} records a player action`);
  const restored = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [quest] });
  assert.deepEqual(restored.world.pushkinObituaryRecord, result.state.world.pushkinObituaryRecord);
  assert.equal(restored.world.livingEventStates.E43.stage, result.state.world.livingEventStates.E43.stage);
}
const unattended = game.advanceNpcWorld(active, 181, maps, { pausedHostIds: ['bookseller_lev', 'reader_darya', 'student_vasily'] });
assert.equal(unattended.world.livingEventStates.E43.stage, 'UNREAD_ISSUE');
assert.equal(unattended.world.pushkinObituaryRecord.disposition, 'NO_LOCAL_READING');
assert.ok(!objectIsPresent(eventObject, unattended, [quest]), 'the choice surface closes after the residents disperse');
console.log('E43 Pushkin obituary source, contiguous context, catalog provenance, readable bookshop entry, and three practical choices passed');
