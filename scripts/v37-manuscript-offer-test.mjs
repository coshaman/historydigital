import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/v37-manuscript-offer-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);
const object = maps['bookshop-interior'].layers.find(layer => layer.name === 'Interactions').objects.find(row => row.id === 4010);
assert.ok(object, 'the folded manuscript has a physical quest surface in the bookshop');
assert.ok(maps['bookshop-interior'].metadata.access.allowedCharacterIds.includes('editor_sofia'));
assert.ok(cards.find(card => card.id === 'editor_sofia').allowedMaps.includes('bookshop-interior'));

function afterReadingCircle() {
  const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'bookshop-interior' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 900;
  state.world.currentMapId = 'bookshop-interior'; state.player.embodiment = null;
  state.world.livingEventStates.E24 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E24',
    status: 'RESOLVED', stage: 'UNATTENDED_DISCUSSION', studentHostId: 'student_vasily', organizerHostId: 'reader_darya',
    actorHostIds: ['student_vasily', 'reader_darya'], witnessHostIds: [], venueMapId: 'courtyard', scenePosition: { x: 15, y: 13 } };
  return state;
}

let state = game.advanceNpcWorld(afterReadingCircle(), 1, maps);
let event = state.world.livingEventStates.E30;
assert.equal(event?.stage, 'OFFER_POSTED');
assert.ok(state.hosts.student_vasily.inventory.includes(event.manuscriptItemKo));
for (let minute = 0; minute < 180 && event.stage === 'OFFER_POSTED'; minute += 1) {
  state = game.advanceNpcWorld(state, 1, maps); event = state.world.livingEventStates.E30;
}
assert.equal(event.stage, 'REVIEW_READY', `the three participants reach the bookshop: ${JSON.stringify(['student_vasily','bookseller_lev','editor_sofia'].map(id => ({ id, map: state.hosts[id].mapId, goal: state.hosts[id].activeGoal?.taskId })))}`);
assert.ok(['student_vasily', 'bookseller_lev', 'editor_sofia'].every(id => state.hosts[id].mapId === 'bookshop-interior'));
assert.equal(objectIsPresent(object, state, [quest]), true);
assert.deepEqual(questChoices(quest, 'editor_sofia', [], state).map(row => row.action.id), ['E30_EDITOR_BUYS_COPY', 'E30_EDITOR_RETURNS_COPY']);
assert.deepEqual(questChoices(quest, 'bookseller_lev', [], state).map(row => row.action.id), ['E30_BOOKSELLER_HOLDS_COPY']);
const activeOfferSave = game.loadGame(game.saveGame(state), { maps, hostCards: cards, quests: [quest] });
assert.equal(game.stateHash(activeOfferSave), game.stateHash(state), 'active participants and manuscript survive save/load');
state = activeOfferSave; event = state.world.livingEventStates.E30;

state.player.embodiment = 'editor_sofia'; state.world.currentMapId = 'bookshop-interior';
state.hosts.editor_sofia.position = { ...event.scenePosition }; state.player.position = { ...event.scenePosition };
const studentMoney = state.hosts.student_vasily.money.amount, editorMoney = state.hosts.editor_sofia.money.amount;
const resolved = game.performQuestAction(state, { questId: quest.id, hostId: 'editor_sofia',
  actionId: 'E30_EDITOR_BUYS_COPY', objectId: object.id }, { quests: [quest], maps });
assert.equal(resolved.ok, true, resolved.reason);
assert.equal(resolved.state.world.livingEventStates.E30.status, 'RESOLVED');
assert.equal(resolved.state.hosts.student_vasily.money.amount, studentMoney + 2);
assert.equal(resolved.state.hosts.editor_sofia.money.amount, editorMoney - 2);
assert.ok(!resolved.state.hosts.student_vasily.inventory.includes(event.manuscriptItemKo));
assert.ok(resolved.state.hosts.editor_sofia.inventory.includes(event.manuscriptItemKo));
assert.ok(resolved.state.ledger.flatMap(row => row.livingEvents ?? []).some(row => row.catalogEventId === 'E30' && row.paidAmount === 2));
assert.equal(game.stateHash(game.loadGame(game.saveGame(resolved.state), { maps, hostCards: cards, quests: [quest] })), game.stateHash(resolved.state));

let unattended = game.advanceNpcWorld(afterReadingCircle(), 300, maps);
assert.equal(unattended.world.livingEventStates.E30.status, 'RESOLVED');
assert.equal(unattended.world.livingEventStates.E30.stage, 'OFFER_WITHDRAWN_UNATTENDED');
assert.ok(unattended.hosts.student_vasily.inventory.includes('바실리의 접힌 원고'));
console.log('V37 E30: circle-to-manuscript trigger, physical gathering, purchase/payment, holder transfer, unattended withdrawal, and save/load passed');
