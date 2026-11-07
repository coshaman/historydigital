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
  read(new URL('../rpg/quests/v37-belinsky-letter-1848.json', import.meta.url)),
  read(new URL('../rpg/data/historical-source-packets.json', import.meta.url)),
  read(new URL('../rpg/data/source-reader-index.json', import.meta.url)),
  read(new URL('../data/event_catalog_45.json', import.meta.url)),
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
]);
const maps = await Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/maps/${file}`, import.meta.url))))
  .then(rows => Object.fromEntries(rows.map(row => [row.mapId, row])));
const map = maps['bookshop-interior'];
const cards = await Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/characters/${file}`, import.meta.url))));
const sourceId = 'OBJ-BELINSKY-LETTER-GOGOL-1847';
const source = packet.records.find(row => row.sourceId === sourceId);
assert.ok(source);
assert.equal(source.paragraphs.length, 7, 'the argument stays in one contiguous letter range');
assert.match(source.paragraphs[0].ru, /Вы только отчасти правы/);
assert.match(source.paragraphs.at(-1).ru, /отменение телесного наказания/);
assert.equal(index.records.find(row => row.sourceId === sourceId)?.excerptId, 'EX-BELINSKY-LETTER-GOGOL-1847-FEB-500-502');
assert.equal(catalog.find(row => row.event_id === 'E44')?.validation_status, 'PRIMARY_LETTER_AND_CIRCULATION_HISTORY_VERIFIED');
const object = map.layers.find(layer => layer.name === 'Interactions').objects.find(row => row.id === quest.entry.objectId);
assert.ok(object);

const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'bookshop-interior' });
state.world.chapterId = 'V33_1848_PUBLIC'; state.world.date = '1848-01-02'; state.world.clockMinutes = 600;
state.world.currentMapId = 'bookshop-interior'; state.player.embodiment = 'bookseller_lev';
for (const [id, x] of [['bookseller_lev', 14], ['reader_darya', 15], ['student_vasily', 16]]) {
  state.hosts[id].mapId = 'bookshop-interior'; state.hosts[id].position = { x, y: 13 };
  state.hosts[id].historicalAliveAndPresent = true;
}
state.player.position = { x: 14, y: 13 };
assert.equal(objectIsPresent(object, state, [quest]), false);
let active = game.advanceNpcWorld(state, 1, maps, { pausedHostIds: ['bookseller_lev', 'reader_darya', 'student_vasily'] });
assert.equal(active.world.livingEventStates.E44?.status, 'ACTIVE');
assert.equal(active.world.livingEventStates.E44.stage, 'READING_READY');
assert.ok(objectIsPresent(object, active, [quest]));
const readResult = game.recordSourceRead(active, sourceId, maps);
assert.equal(readResult.ok, true, readResult.reason);
const choices = questChoices(quest, 'bookseller_lev', [sourceId], readResult.state);
assert.deepEqual(choices.map(row => row.action.id), ['E44_KEEP_COPY_PRIVATE', 'E44_COPY_ARGUMENTS', 'E44_READ_TO_CIRCLE']);
assert.ok(choices.every(row => row.action.subcopyKo?.length > 8));
for (const actionId of choices.map(row => row.action.id)) {
  const branch = structuredClone(readResult.state);
  const result = game.performQuestAction(branch, { questId: quest.id, hostId: 'bookseller_lev', actionId, objectId: quest.entry.objectId }, { quests: [quest], maps });
  assert.equal(result.ok, true, `${actionId}: ${result.reason ?? ''}`);
  assert.equal(result.state.world.livingEventStates.E44.status, 'RESOLVED');
  assert.ok(result.state.world.belinskyLetterRecords.at(-1));
  const restored = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [quest] });
  assert.deepEqual(restored.world.belinskyLetterRecords, result.state.world.belinskyLetterRecords);
}
console.log('E44 Belinsky letter circulation, period-accurate manuscript access, contiguous source, physical choices and persistence passed');
