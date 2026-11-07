import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async url => JSON.parse(await readFile(url, 'utf8'));
const [mapFiles, cardFiles, quest, literarySource, sourceReaderIndex] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read(new URL('../rpg/quests/v37-physiology-reading-1847.json', import.meta.url)),
  read(new URL('../rpg/data/khor-kalynych-source.json', import.meta.url)),
  read(new URL('../rpg/data/source-reader-index.json', import.meta.url)),
]);
const sourceIndex = sourceReaderIndex.records.find(row => row.sourceId === literarySource.sourceId);
const literaryExcerptRu = literarySource.paragraphs.map(row => row.ru).join('\n');
assert.ok(literaryExcerptRu.includes('Хорь понималъ дѣйствительность')
  && literaryExcerptRu.includes('Калинычъ ходилъ въ лаптяхъ')
  && literaryExcerptRu.includes('благоговѣлъ передъ своимъ господиномъ'),
'the readable source must include Turgenev’s consecutive comparison of living conditions and each man’s relation to the landowner');
assert.ok(sourceIndex?.contextKo.includes('살림') && sourceIndex.contextKo.includes('지주'),
  'the source drawer should frame the immediately relevant comparison in concise Korean');
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/maps/${file}`, import.meta.url))))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/characters/${file}`, import.meta.url)))),
]);
let state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'bookshop-interior' });
state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 840;
state.world.currentMapId = 'bookshop-interior';
for (const id of ['reader_darya', 'student_vasily', 'bookseller_lev']) {
  state.hosts[id].mapId = 'bookshop-interior'; state.hosts[id].position = { x: 12, y: 12 };
}
state.player.embodiment = 'reader_darya'; state.player.position = { ...state.hosts.reader_darya.position };
const readResult = game.recordSourceRead(state, 'LIT-TURGENEV-KHOR-KALYNYCH-1847', maps);
assert.equal(readResult.ok, true, readResult.reason);
state = readResult.state;
state.world.clockMinutes = 840;
state.world.currentMapId = 'bookshop-interior';
let active = game.advanceNpcWorld(state, 1, maps, { pausedHostIds: ['reader_darya', 'student_vasily', 'bookseller_lev'] });
assert.equal(active.world.livingEventStates.E39?.status, 'ACTIVE', 'reading a verified 1847 text triggers the public reading scene');
assert.equal(active.world.livingEventStates.E39.stage, 'DISCUSSION_READY', 'readers and bookseller are gathered at the scene');
assert.ok(active.world.livingEventStates.E39.actorHostIds.every(id => active.hosts[id].mapId === 'bookshop-interior'
  && game.nearTile(active.hosts[id].position, active.world.livingEventStates.E39.scenePosition, 5)));
assert.ok(active.ledger.some(row => row.livingEvents?.some(event => event.catalogEventId === 'E39' && event.stage === 'DISCUSSION_READY')));
const choices = questChoices(quest, 'reader_darya', ['LIT-TURGENEV-KHOR-KALYNYCH-1847'], active);
assert.ok(choices.some(choice => choice.action.id === 'E39_COMPARE_KHORY_KALYNYCH'));
const unattended = game.advanceNpcWorld(active, 121, maps, { pausedHostIds: ['reader_darya', 'student_vasily', 'bookseller_lev'] });
assert.equal(unattended.world.livingEventStates.E39.status, 'RESOLVED');
assert.equal(unattended.world.livingEventStates.E39.stage, 'COPY_SOLD', 'the reader buys the book when no player intervenes');
assert.equal(unattended.world.livingEventStates.E39.copy.location, 'student_inventory');
assert.equal(unattended.world.livingEventStates.E39.copy.paidAmount, 2);
const buyerState = game.loadGame(game.saveGame(active), { maps, hostCards: cards, quests: [quest] });
buyerState.player.embodiment = 'student_vasily'; buyerState.player.position = { ...buyerState.hosts.student_vasily.position };
const purchaseChoices = questChoices(quest, 'student_vasily', [], buyerState);
assert.ok(purchaseChoices.some(choice => choice.action.id === 'E39_BUY_COPY'), 'the student can afford the posted two-kopeck price');
const purchased = game.performQuestAction(buyerState, { questId: quest.id, hostId: 'student_vasily',
  actionId: 'E39_BUY_COPY', objectId: quest.entry.objectId }, { quests: [quest], maps });
assert.equal(purchased.ok, true, purchased.reason);
assert.equal(purchased.state.hosts.student_vasily.money.amount, buyerState.hosts.student_vasily.money.amount - 2);
assert.equal(purchased.state.hosts.bookseller_lev.money.amount, buyerState.hosts.bookseller_lev.money.amount + 2);
assert.ok(purchased.state.hosts.student_vasily.inventory.includes(purchased.state.world.livingEventStates.E39.copy.itemKo));
const result = game.performQuestAction(active, { questId: quest.id, hostId: 'reader_darya', actionId: 'E39_COMPARE_KHORY_KALYNYCH', objectId: quest.entry.objectId }, { quests: [quest], maps });
assert.equal(result.ok, true, result.reason);
assert.equal(result.state.world.livingEventStates.E39.stage, 'LIVES_COMPARED');
assert.ok(result.state.hosts.reader_darya.personalEventNotes.some(row => row.eventId === 'E39'));
assert.match(result.state.hosts.student_vasily.relations.reader_darya, /함께 읽은 독자/);
const restored = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [quest] });
assert.deepEqual(restored.world.livingEventStates.E39, result.state.world.livingEventStates.E39);
assert.deepEqual(restored.hosts.reader_darya.knownRumors, result.state.hosts.reader_darya.knownRumors);
console.log('V37 E39 public reading: verified source trigger, physical gathering, player interpretation, private knowledge, relationship, and save/load passed');
