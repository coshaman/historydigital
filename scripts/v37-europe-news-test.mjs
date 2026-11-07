import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async url => JSON.parse(await readFile(url, 'utf8'));
const [mapFiles, cardFiles, quest, packet, sourceIndex, catalog] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read(new URL('../rpg/quests/europe-news-1848.json', import.meta.url)),
  read(new URL('../rpg/data/historical-source-packets.json', import.meta.url)),
  read(new URL('../rpg/data/source-reader-index.json', import.meta.url)),
  read(new URL('../data/event_catalog_45.json', import.meta.url)),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/maps/${file}`, import.meta.url))))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/characters/${file}`, import.meta.url)))),
]);
const sourceId = 'OBJ-NICHOLAS-MANIFESTO-1848', eventId = 'E42', questId = 'V37_EUROPE_NEWS_1848';
const excerpt = packet.records.find(row => row.sourceId === sourceId);
assert.ok(excerpt); assert.equal(excerpt.paragraphs.length, 4, 'manifesto context stays contiguous through the claim and response');
assert.match(excerpt.paragraphs[0].ru, /Объявляем всенародно/);
assert.match(excerpt.paragraphs.at(-1).ru, /Но да не будет так/);
assert.equal(sourceIndex.records.find(row => row.sourceId === sourceId)?.excerptId, 'EX-NICHOLAS-MANIFESTO-1848-NB59-ANNOUNCEMENT-001');
assert.equal(catalog.find(row => row.event_id === eventId)?.validation_status, 'ARCHIVAL_METADATA_AND_ACADEMIC_TRANSCRIPTION_VERIFIED');

const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'printshop' });
state.world.chapterId = 'V33_1848_PUBLIC'; state.world.date = '1848-03-15'; state.world.clockMinutes = 539;
state.world.currentMapId = 'printshop'; state.player.embodiment = 'clerk_alexei';
for (const person of Object.values(state.hosts)) person.historicalAliveAndPresent = false;
for (const [id, x] of [['clerk_alexei', 11], ['printer_ekaterina', 12], ['reader_darya', 13], ['student_vasily', 14]]) {
  const host = state.hosts[id]; host.historicalAliveAndPresent = true; host.mapId = 'printshop';
  host.position = { x, y: 11 }; host.schedule = [{ atMinute: 0, mapId: 'printshop', position: { ...host.position }, activityKo: '일을 기다린다' }];
  host.activeGoal = null;
}
state.player.position = { ...state.hosts.clerk_alexei.position };
const object = maps.printshop.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
assert.ok(object); assert.equal(objectIsPresent(object, state, [quest]), false);
let active = game.advanceNpcWorld(state, 1, maps, { pausedHostIds: ['clerk_alexei', 'printer_ekaterina', 'reader_darya', 'student_vasily'] });
const event = active.world.livingEventStates.E42;
assert.equal(event?.status, 'ACTIVE', 'the fixed notice appears on the recorded date');
assert.equal(event.historicalOutcomeFixed, true);
assert.equal(objectIsPresent(object, active, [quest]), true);
assert.ok(active.ledger.some(row => row.livingEvents?.some(item => item.catalogEventId === eventId && item.stage === 'NOTICE_ARRIVED')));
const readResult = game.recordSourceRead(active, sourceId, maps);
assert.equal(readResult.ok, true, readResult.reason); active = readResult.state;
assert.deepEqual(questChoices(quest, 'clerk_alexei', [sourceId], active).map(row => row.action.id), ['E42_COPY_TO_REGISTER', 'E42_KEEP_PRIVATE_NOTE']);
assert.deepEqual(questChoices(quest, 'printer_ekaterina', [sourceId], active).map(row => row.action.id), ['E42_READ_TO_SHOP']);

for (const [hostId, actionId, disposition] of [
  ['clerk_alexei', 'E42_COPY_TO_REGISTER', 'OFFICIAL_REGISTER'],
  ['clerk_alexei', 'E42_KEEP_PRIVATE_NOTE', 'PRIVATE_NOTE'],
  ['printer_ekaterina', 'E42_READ_TO_SHOP', 'SHOP_READING'],
]) {
  let branch = structuredClone(active); branch.player.embodiment = hostId;
  branch.hosts[hostId].position = { x: 14, y: 9 }; branch.player.position = { x: 14, y: 9 };
  branch.world.livingEventStates.E42.stage = 'READING_READY';
  for (const id of ['reader_darya', 'student_vasily']) branch.hosts[id].position = { x: 13, y: 9 };
  if (!branch.hosts[hostId].knownEvidenceIds.includes(sourceId)) {
    const localRead = game.recordSourceRead(branch, sourceId, maps);
    assert.equal(localRead.ok, true, localRead.reason); branch = localRead.state;
  }
  const result = game.performQuestAction(branch, { questId, hostId, actionId, objectId: object.id }, { quests: [quest], maps });
  assert.equal(result.ok, true, `${actionId}: ${result.reason ?? ''}`);
  const resolved = result.state.world.livingEventStates.E42;
  assert.equal(resolved.status, 'RESOLVED'); assert.equal(resolved.disposition, disposition);
  assert.equal(resolved.historicalOutcomeFixed, true);
  assert.equal(result.state.world.immutableOutcomes.EUROPE_REVOLUTIONS_1848, 'the documented events and dates remain unchanged');
  assert.ok(result.state.ledger.at(-1)?.livingEvents?.some(item => item.catalogEventId === eventId && item.disposition === disposition));
  const restored = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [quest] });
  assert.deepEqual(restored.world.europeNewsRecord, result.state.world.europeNewsRecord, `${actionId} record persists through save/load`);
  assert.deepEqual(restored.world.livingEventStates.E42, result.state.world.livingEventStates.E42);
  assert.equal(restored.world.immutableOutcomes.EUROPE_REVOLUTIONS_1848, 'the documented events and dates remain unchanged');
}

const unattended = game.advanceNpcWorld(active, 181, maps, { pausedHostIds: ['clerk_alexei', 'printer_ekaterina', 'reader_darya', 'student_vasily'] });
assert.equal(unattended.world.livingEventStates.E42.stage, 'UNRECORDED_NOTICE');
assert.equal(unattended.world.immutableOutcomes.EUROPE_REVOLUTIONS_1848, 'the documented events and dates remain unchanged');
console.log('V37 E42 manifesto notice, source context, physical choices, immutable history, unattended resolution, and save/load passed');
