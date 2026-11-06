import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest, packet, sourceIndex] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/v37-serfdom-reading-1847.json'), read('../rpg/data/historical-source-packets.json'),
  read('../rpg/data/source-reader-index.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);
const sourceId = 'LIT-GOGOL-RUSSIAN-LANDLORD-1847';
const source = packet.records.find(item => item.sourceId === sourceId);
const sourceReader = sourceIndex.records.find(item => item.sourceId === sourceId);
assert.equal(source.paragraphs.length, 6, 'the first-time reader gets six consecutive paragraphs');
assert.equal(source.range, 'Wikisource lines 99–104, six consecutive paragraphs of chapter XXII, «Русской помещик».');
assert.equal(sourceReader.pageLocator, 'Wikisource lines 99–104 · 연속된 여섯 문단');
assert.match(source.paragraphs[2].ru, /должны покоряться той самой власти/);
assert.match(source.paragraphs[2].ko, /복종해야/);

const bookshop = maps['bookshop-interior'];
const sourceObject = bookshop.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.type === 'source' && item.properties.some(property => property.value === sourceId));
const questObject = bookshop.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === 4011);
assert.ok(sourceObject, 'the printed book can be read from a physical copy');
assert.equal(questObject.properties.find(property => property.name === 'questId').value, quest.id);
assert.ok(bookshop.metadata.access.allowedCharacterIds.includes('reader_darya'));

const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'bookshop-interior' });
state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 900;
state.world.currentMapId = 'bookshop-interior'; state.player.embodiment = 'reader_darya';
state.world.livingEventStates.E31 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E31',
  status: 'ACTIVE', stage: 'DISCUSSION_READY', readerHostId: 'reader_darya', studentHostId: 'student_vasily',
  editorHostId: 'editor_sofia', actorHostIds: ['reader_darya', 'student_vasily', 'editor_sofia'], witnessHostIds: [],
  venueMapId: 'bookshop-interior', scenePosition: { x: 12, y: 12 }, sourceId,
  closesAtMinute: 1020 };
for (const [id, position] of [['reader_darya', { x: 11, y: 10 }], ['student_vasily', { x: 12, y: 11 }], ['editor_sofia', { x: 13, y: 12 }]]) {
  state.hosts[id].mapId = 'bookshop-interior'; state.hosts[id].position = position;
}
state.player.position = { ...state.hosts.reader_darya.position };
const readResult = game.recordSourceRead(state, sourceId, maps);
assert.equal(readResult.ok, true, readResult.reason);
assert.ok(readResult.state.hosts.reader_darya.knownEvidenceIds.includes(sourceId));
readResult.state.hosts.reader_darya.position = { x: 12, y: 12 };
readResult.state.player.position = { x: 12, y: 12 };
const visible = questChoices(quest, 'reader_darya', readResult.state.hosts.reader_darya.knownEvidenceIds, readResult.state);
assert.deepEqual(visible.map(item => item.action.id), ['E31_DEFEND_PATERNAL_DUTY']);
const resolved = game.performQuestAction(readResult.state, { questId: quest.id, hostId: 'reader_darya',
  actionId: 'E31_DEFEND_PATERNAL_DUTY', objectId: 4011 }, { quests: [quest], maps });
assert.equal(resolved.ok, true, resolved.reason);
assert.equal(resolved.state.world.livingEventStates.E31.stage, 'LANDLORD_DUTY_DISCUSSION');
assert.ok(resolved.state.ledger.at(-1).sourceIds.includes(sourceId));
assert.equal(game.stateHash(game.loadGame(game.saveGame(resolved.state), { maps, hostCards: cards, quests: [quest] })), game.stateHash(resolved.state));
console.log('V37 E31: verified contiguous source, physical reading, source-gated choice, social outcome, and save/load passed');
