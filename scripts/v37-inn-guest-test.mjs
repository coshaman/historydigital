import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/inn-guest-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(records => Object.fromEntries(records.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);
const inn = maps['inn-interior'];
const object = inn.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
assert.ok(object, 'E17 is attached to a physical inn-room interaction');
assert.equal(objectIsPresent(object, { world: { chapterId: 'V33_1847_PRINT', date: '1847-06-01', livingEventStates: { E17: { status: 'ACTIVE' } } } }, [quest]), true);

function prepare() {
  const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'inn-interior' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 900;
  state.world.currentMapId = 'inn-interior'; state.player.embodiment = null;
  const position = { x: object.x / 16, y: object.y / 16 };
  for (const id of ['courier_pavel', 'innkeeper_irina']) {
    const host = state.hosts[id]; host.mapId = 'inn-interior'; host.position = { ...position };
  }
  state.hosts.courier_pavel.needs.fatigue = 80;
  state.hosts.courier_pavel.money.amount = 8;
  return state;
}
function arrive() {
  const started = game.advanceNpcWorld(prepare(), 1, maps);
  assert.equal(started.world.livingEventStates.E17?.stage, 'ROOM_REQUESTED', 'evening fatigue starts an inn event');
  const arrived = game.advanceNpcWorld(started, 1, maps);
  assert.equal(arrived.world.livingEventStates.E17?.stage, 'GUEST_ARRIVED', 'both participants reach the physical room request');
  assert.deepEqual(questChoices(quest, 'courier_pavel', [], arrived).map(row => row.action.id),
    ['E17_RENT_ROOM', 'E17_NEGOTIATE_RATE', 'E17_DECLINE_ROOM']);
  assert.deepEqual(questChoices(quest, 'innkeeper_irina', [], arrived).map(row => row.action.id), ['E17_OFFER_BED']);
  return arrived;
}
function play(source, actionId, hostId) {
  const state = structuredClone(source), pos = { ...state.world.livingEventStates.E17.scenePosition };
  state.world.currentMapId = 'inn-interior'; state.player.embodiment = hostId; state.player.position = { ...pos };
  for (const id of ['courier_pavel', 'innkeeper_irina']) { state.hosts[id].mapId = 'inn-interior'; state.hosts[id].position = { ...pos }; }
  return game.performQuestAction(state, { questId: quest.id, hostId, actionId, objectId: quest.entry.objectId }, { quests: [quest], maps });
}
const arrived = arrive();
for (const [actionId, hostId, stage, amount] of [
  ['E17_RENT_ROOM', 'courier_pavel', 'ROOM_RENTED', 2],
  ['E17_NEGOTIATE_RATE', 'courier_pavel', 'RATE_REDUCED', 1],
  ['E17_OFFER_BED', 'innkeeper_irina', 'BED_OFFERED', 0],
]) {
  const result = play(arrived, actionId, hostId);
  assert.equal(result.ok, true, `${actionId} succeeds (${result.reason ?? ''})`);
  const event = result.state.world.livingEventStates.E17;
  assert.equal(event.stage, stage);
  assert.equal(event.paidAmount, amount);
  assert.equal(result.state.world.temporaryLodgingStays.courier_pavel.paidAmount, amount);
  assert.equal(result.state.world.innGuestRecords.at(-1).paidAmount, amount);
  const saved = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards });
  assert.equal(game.stateHash(saved), game.stateHash(result.state), `${actionId} survives save/load`);
}
const rented = play(arrived, 'E17_RENT_ROOM', 'courier_pavel').state;
assert.equal(rented.hosts.courier_pavel.money.amount, 6);
assert.equal(rented.hosts.innkeeper_irina.money.amount, arrived.hosts.innkeeper_irina.money.amount + 2);
const decline = play(arrived, 'E17_DECLINE_ROOM', 'courier_pavel');
assert.equal(decline.ok, true, `declining a room works (${decline.reason ?? ''})`);
assert.equal(decline.state.world.livingEventStates.E17.stage, 'ROOM_DECLINED');
assert.ok(decline.state.world.homewardTravelGoals.courier_pavel);
assert.equal(decline.state.world.temporaryLodgingStays?.courier_pavel, undefined);
assert.equal(game.stateHash(game.loadGame(game.saveGame(decline.state), { maps, hostCards: cards })), game.stateHash(decline.state));

const broke = arrive(); broke.hosts.courier_pavel.money.amount = 0;
const auto = game.advanceNpcWorld(broke, 46, maps);
assert.equal(auto.world.livingEventStates.E17.stage, 'AUTO_LEFT_UNSERVED', 'unattended broke guest leaves without an impossible charge');
assert.equal(auto.world.livingEventStates.E17.resolutionActionId, 'AUTO_NO_AFFORDABLE_ROOM');
assert.equal(game.stateHash(game.loadGame(game.saveGame(auto), { maps, hostCards: cards })), game.stateHash(auto));

console.log('V37 E17 inn guest: trigger, physical arrival, role-gated choices, payment/negotiation/free room/refusal, unattended fallback, and save/load passed.');
