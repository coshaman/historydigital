import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest, mealQuest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/inn-guest-1847.json'),
  read('../rpg/quests/late-meal-1847.json'),
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

const lodgingChain = play(arrived, 'E17_RENT_ROOM', 'courier_pavel').state;
lodgingChain.world.clockMinutes = 1140;
lodgingChain.hosts.landlady_polina.money.amount = 20;
const tiredGuest = lodgingChain.hosts.courier_pavel;
tiredGuest.needs.hunger = 92;
tiredGuest.activeGoal = { type: 'PURCHASE_MEAL', targetHostId: 'innkeeper_irina', taskId: 'E17_GUEST_SEEKS_SUPPER' };
lodgingChain.hosts.innkeeper_irina.marketStock['저녁 수프'] = 3;
const supperRequest = game.advanceNpcWorld(lodgingChain, 1, maps);
assert.equal(supperRequest.world.livingEventStates.E17.stage, 'ROOM_RENTED');
assert.equal(supperRequest.world.livingEventStates.E18?.stage, 'MEAL_REQUESTED', 'the hungry overnight guest can order supper');
assert.equal(supperRequest.world.livingEventStates.E18.sourceEventId, 'E17', 'the supper carries its lodging cause');
assert.deepEqual(questChoices(mealQuest, 'courier_pavel', [], supperRequest).map(row => row.action.id),
  ['E18_BUY_FULL_MEAL', 'E18_BUY_SMALL_MEAL', 'E18_DECLINE_MEAL']);
const nextMorning = game.advanceNpcWorld(supperRequest, 30, maps);
const linkedSupperRow = nextMorning.ledger.flatMap(row => row.livingEvents ?? [])
  .find(row => row.catalogEventId === 'E18' && row.stage === 'AUTO_SERVED');
assert.equal(linkedSupperRow?.sourceEventId, 'E17', 'the autonomous payment preserves the event chain in the ledger');
assert.equal(nextMorning.hosts.courier_pavel.money.amount, 4, 'the supper deducts two more kopeks from the room guest');
assert.equal(nextMorning.hosts.innkeeper_irina.money.amount, lodgingChain.hosts.innkeeper_irina.money.amount + 2,
  'the supper credits two kopeks to the innkeeper');
const supperReloaded = game.loadGame(game.saveGame(nextMorning), { maps, hostCards: cards, quests: [quest] });
const changedKeys = Object.keys(nextMorning).filter(key => JSON.stringify(nextMorning[key]) !== JSON.stringify(supperReloaded[key]));
const changedWorldKeys = Object.keys(nextMorning.world).filter(key => JSON.stringify(nextMorning.world[key]) !== JSON.stringify(supperReloaded.world[key]));
assert.equal(game.stateHash(supperReloaded), game.stateHash(nextMorning),
  `the complete lodging-to-supper chain survives save/load: ${JSON.stringify({ changedKeys, changedWorldKeys })}`);

console.log('V37 E17→E18: lodging, hungry guest supper, paid unattended meal, source linkage, and save/load passed.');
