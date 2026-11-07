import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest, catalog] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  json('../rpg/quests/late-meal-1847.json'), json('../data/event_catalog_45.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/maps/${file}`)))
    .then(records => Object.fromEntries(records.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/characters/${file}`))),
]);
const map = maps['inn-interior'];
const object = map.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
assert.ok(object, 'the dinner decision is attached to a physical table ledger');
assert.equal(catalog.find(row => row.event_id === 'E18').validation_status, 'DESIGN_SEED_NOT_VERIFIED');

const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'inn-interior' });
state.world.chapterId = 'V33_1847_PRINT';
state.world.date = '1847-06-01';
state.world.clockMinutes = 1140;
state.world.currentMapId = 'inn-interior';
state.player.position = { x: 10, y: 12 };
state.player.embodiment = null;
const seller = state.hosts.innkeeper_irina, buyer = state.hosts.lodging_tatyana;
seller.mapId = 'inn-interior'; seller.position = { x: 11, y: 14 };
buyer.mapId = 'inn-interior'; buyer.position = { x: 11, y: 13 };
buyer.needs.hunger = 92; buyer.money.amount = 8;
buyer.activeGoal = { type: 'PURCHASE_MEAL', targetHostId: seller.id, taskId: 'TEST_EVENING_SOUP' };
seller.marketStock['저녁 수프'] = 3;
const openingMoney = { buyer: buyer.money.amount, seller: seller.money.amount };
const request = game.advanceNpcWorld(state, 1, maps);
const event = request.world.livingEventStates.E18;
assert.equal(event?.stage, 'MEAL_REQUESTED', 'a genuinely hungry resident reaching open evening service starts E18');
assert.equal(event.buyerHostId, buyer.id);
assert.equal(event.sellerHostId, seller.id);
assert.equal(event.valueStatus, 'fictional_gameplay_balance');
assert.equal(request.hosts[buyer.id].money.amount, openingMoney.buyer, 'no payment occurs before the player decision');
assert.equal(request.hosts[seller.id].marketStock['저녁 수프'], 3, 'stock remains until a meal is served');
assert.equal(objectIsPresent(object, request, [quest]), true, 'the physical meal ledger appears after the natural trigger');
assert.deepEqual(questChoices(quest, buyer.id, [], request).map(row => row.action.id), [
  'E18_BUY_FULL_MEAL', 'E18_BUY_SMALL_MEAL', 'E18_DECLINE_MEAL',
]);

function atLedger(source) {
  const branch = structuredClone(source);
  branch.world.currentMapId = 'inn-interior';
  branch.player.embodiment = buyer.id;
  branch.player.position = { x: object.x / 16, y: object.y / 16 };
  branch.hosts[buyer.id].mapId = 'inn-interior'; branch.hosts[buyer.id].position = { ...branch.player.position };
  branch.hosts[seller.id].mapId = 'inn-interior'; branch.hosts[seller.id].position = { x: 11, y: 14 };
  return branch;
}

for (const [actionId, expectedStage, price, hungerRelief] of [
  ['E18_BUY_FULL_MEAL', 'MEAL_PAID', 2, 32],
  ['E18_BUY_SMALL_MEAL', 'SMALL_MEAL_PAID', 1, 16],
  ['E18_DECLINE_MEAL', 'MEAL_DECLINED', 0, 0],
]) {
  const branch = atLedger(request);
  const beforeBuyer = branch.hosts[buyer.id].money.amount;
  const beforeSeller = branch.hosts[seller.id].money.amount;
  const beforeHunger = branch.hosts[buyer.id].needs.hunger;
  const result = game.performQuestAction(branch, { questId: quest.id, hostId: buyer.id, actionId, objectId: object.id }, { quests: [quest], maps });
  assert.equal(result.ok, true, `${actionId} is completed at the physical ledger (${result.reason ?? ''})`);
  const finalEvent = result.state.world.livingEventStates.E18;
  assert.equal(finalEvent.stage, expectedStage);
  assert.equal(finalEvent.status, 'RESOLVED');
  assert.equal(result.state.hosts[buyer.id].money.amount, beforeBuyer - price);
  assert.equal(result.state.hosts[seller.id].money.amount, beforeSeller + price);
  assert.equal(result.state.hosts[seller.id].marketStock['저녁 수프'], 3 - Number(price > 0));
  assert.equal(result.state.hosts[buyer.id].needs.hunger, beforeHunger - hungerRelief);
  const restored = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [quest] });
  assert.equal(game.stateHash(restored), game.stateHash(result.state), `${actionId} is saved without losing its transaction`);
}

const unattended = game.advanceNpcWorld(request, 30, maps);
assert.equal(unattended.world.livingEventStates.E18.stage, 'AUTO_SERVED', 'an affordable NPC meal completes without player intervention');
assert.equal(unattended.hosts[buyer.id].money.amount, openingMoney.buyer - 2);
assert.equal(unattended.hosts[seller.id].marketStock['저녁 수프'], 2);
assert.ok(unattended.hosts[buyer.id].needs.hunger < request.hosts[buyer.id].needs.hunger - 30,
  'the 32-point meal relief outweighs the 30-minute background hunger increase');
const repeat = game.advanceNpcWorld(unattended, 91, maps), repeatBuyer = repeat.hosts[buyer.id];
repeat.world.currentMapId = 'inn-interior'; repeat.player.embodiment = null;
seller.mapId = 'inn-interior'; seller.position = { x: 11, y: 14 };
repeat.hosts[seller.id].mapId = 'inn-interior'; repeat.hosts[seller.id].position = { x: 11, y: 14 };
repeatBuyer.mapId = 'inn-interior'; repeatBuyer.position = { x: 11, y: 13 };
repeatBuyer.needs.hunger = 92; repeatBuyer.money.amount = 8;
repeatBuyer.activeGoal = { type: 'PURCHASE_MEAL', targetHostId: seller.id, taskId: 'TEST_REPEAT_EVENING_SOUP' };
const secondOrder = game.advanceNpcWorld(repeat, 1, maps);
assert.equal(secondOrder.world.livingEventStates.E18?.buyerHostId, buyer.id,
  'a new hungry guest can open E18 after the previous meal transaction resolved');
assert.equal(secondOrder.world.livingEventStates.E18?.stage, 'MEAL_REQUESTED');
console.log(JSON.stringify({ status: 'PASS', event: 'E18', trigger: 'hungry-worker-at-open-inn-service',
  choices: ['full-meal', 'small-portion', 'decline'], unattended: 'automatic-paid-meal', repeatTransaction: 'new guest accepted', saveLoad: true }, null, 2));
