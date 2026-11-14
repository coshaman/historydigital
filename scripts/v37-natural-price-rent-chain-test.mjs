import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, priceQuest, rentQuest, rumorQuest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/market-price-dispute-1847.json'), read('../rpg/quests/rent-notice-1847.json'),
  read('../rpg/quests/market-rumor-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);

const state = game.createInitialState({ maps, hostCards: cards, quests: [priceQuest, rentQuest, rumorQuest],
  startMapId: 'market-quay', simulationSeed: 1847 });
state.world.chapterId = 'V33_1847_PRINT';
state.world.date = '1847-06-01';
state.world.clockMinutes = 540;
state.world.currentMapId = 'market-quay';
state.player.embodiment = null;

const activeIds = ['baker_fyodor', 'market_nadezhda', 'porter_gavrila', 'street_vendor_matryona',
  'tenant_mikhail', 'landlady_polina', 'clerk_alexei'];
for (const host of Object.values(state.hosts)) host.historicalAliveAndPresent = activeIds.includes(host.id);

const priceObject = maps['market-quay'].layers.find(layer => layer.name === 'Interactions').objects
  .find(row => row.id === priceQuest.entry.objectId);
const rentObject = maps.courtyard.layers.find(layer => layer.name === 'Interactions').objects
  .find(row => row.id === rentQuest.entry.objectId);
assert.ok(priceObject && rentObject, 'both events must have physical interaction points');

const seller = state.hosts.market_nadezhda;
const firstBuyer = state.hosts.porter_gavrila;
const secondBuyer = state.hosts.street_vendor_matryona;
const baker = state.hosts.baker_fyodor;
const stall = { x: priceObject.x / 16, y: priceObject.y / 16 };
seller.mapId = 'market-quay'; seller.position = { ...stall };
seller.marketStock['빵 한 묶음'] = 1;
state.world.marketPriceModifiers = {};
state.world.livingEventStates.E02 = undefined;
state.world.livingEventStates.E13 = undefined;
state.world.livingEventStates.E26 = undefined;
for (const buyer of [firstBuyer, secondBuyer]) {
  buyer.mapId = 'market-quay'; buyer.position = { x: stall.x + (buyer.id === firstBuyer.id ? 1 : -1), y: stall.y };
  buyer.needs.hunger = buyer.id === firstBuyer.id ? 94 : 20;
  buyer.needs.lastMealAtMinute = null; buyer.money.amount = 10;
  buyer.activeGoal = buyer.id === firstBuyer.id
    ? { type: 'PURCHASE_MEAL', targetHostId: seller.id, taskId: `FOOD:${seller.id}:빵 한 묶음` } : null;
}
baker.mapId = 'market-quay'; baker.position = { x: stall.x + 2, y: stall.y };
for (const hostId of ['tenant_mikhail', 'landlady_polina']) {
  const host = state.hosts[hostId];
  host.mapId = 'courtyard'; host.position = hostId === 'tenant_mikhail' ? { x: 11, y: 7 } : { x: 13, y: 7 };
}

const stockout = game.advanceNpcWorld(state, 5, maps);
assert.equal(stockout.world.livingEventStates.E02?.stage, 'PRICE_NOTICE',
  'the ordinary meal sale of the final bread bundle must naturally start the E02 price notice');
assert.equal(stockout.world.livingEventStates.E02?.buyerHostId, firstBuyer.id,
  'the natural E02 price notice must name the resident whose final-stock meal sale triggered it');

const untilRestock = game.advanceNpcWorld(stockout, 60, maps);
assert.equal(untilRestock.world.livingEventStates.E02?.stage, 'RESTOCKED',
  'the baker’s authored morning exchange must restock the depleted seller and advance E02');
const restockBuyer = untilRestock.hosts.street_vendor_matryona;
restockBuyer.mapId = 'market-quay';
restockBuyer.position = { x: stall.x - 1, y: stall.y };
restockBuyer.needs.hunger = 94;
restockBuyer.needs.lastMealAtMinute = null;
restockBuyer.activeGoal = { type: 'PURCHASE_MEAL', targetHostId: seller.id, taskId: `FOOD:${seller.id}:빵 한 묶음` };
const adjustedSale = game.advanceNpcWorld(untilRestock, 5, maps);
assert.equal(adjustedSale.world.livingEventStates.E02?.stage, 'RESOLVED',
  'a second resident’s adjusted-price purchase must resolve E02');
assert.ok(adjustedSale.ledger.some(entry => entry.meals?.some(row => row.sellerHostId === seller.id
  && row.hostId === secondBuyer.id && row.price > 1)), 'the follow-up sale must actually charge the adjusted price');
assert.equal(adjustedSale.world.livingEventStates.E26?.sourceEventId, 'E02',
  'the resolved bread-price pressure must naturally create the rent-notice follow-up');
assert.equal(adjustedSale.world.livingEventStates.E26?.status, 'ACTIVE');
assert.equal(adjustedSale.world.livingEventStates.E13?.stage, 'PRICE_CHALLENGE',
  'the same adjusted-price sale must open the price challenge alongside the rent consequence');
assert.ok(adjustedSale.ledger.some(entry => entry.livingEvents?.some(row => row.catalogEventId === 'E26'
  && row.sourceEventId === 'E02')), 'the causal E02→E26 link must be visible in the event ledger');
assert.ok(adjustedSale.ledger.some(entry => entry.livingEvents?.some(row => row.catalogEventId === 'E13'
  && row.sourceEventId === 'E02')), 'the causal E02→E13 link must be visible in the event ledger');

const complaintState = structuredClone(adjustedSale);
const complaintBuyerId = complaintState.world.livingEventStates.E13.buyerHostId;
complaintState.player.embodiment = complaintBuyerId;
complaintState.player.position = { ...complaintState.hosts[complaintBuyerId].position };
const complaint = game.performQuestAction(complaintState, { questId: priceQuest.id, hostId: complaintBuyerId,
  actionId: 'E13_FILE_PRICE_COMPLAINT', objectId: priceObject.id }, { quests: [priceQuest, rentQuest, rumorQuest], maps });
assert.equal(complaint.ok, true, `the market buyer can file the response (${complaint.reason ?? ''})`);
assert.equal(complaint.state.world.livingEventStates.E23?.sourceCatalogEventId, 'E13');
assert.equal(complaint.state.world.livingEventStates.E23?.stage, 'RUMOR_ACTIVE',
  'the actual complaint must trigger the rumor event');
const rumorObject = maps['market-quay'].layers.find(layer => layer.name === 'Interactions').objects
  .find(row => row.id === rumorQuest.entry.objectId);
assert.equal(objectIsPresent(rumorObject, complaint.state, [rumorQuest]), true,
  'the causal rumor must expose its physical market interaction point');
assert.ok(complaint.state.world.rumorPropagationLog.some(row => row.recipientHostId === 'street_vendor_matryona'
  && row.eventId === 'E23' && row.status === 'UNVERIFIED'), 'the rumor must become host-scoped knowledge');
const rumorArrival = game.advanceNpcWorld(complaint.state, 30, maps);
assert.equal(rumorArrival.world.livingEventStates.E23?.status, 'ACTIVE', 'the rumor remains playable during its arrival window');
assert.equal(rumorArrival.hosts.street_vendor_matryona.mapId, 'market-quay');
assert.ok(Math.abs(rumorArrival.hosts.street_vendor_matryona.position.x - rumorArrival.world.livingEventStates.E23.scenePosition.x)
  + Math.abs(rumorArrival.hosts.street_vendor_matryona.position.y - rumorArrival.world.livingEventStates.E23.scenePosition.y) <= 3,
  'the rumor carrier physically approaches the market event point');
assert.ok(rumorArrival.ledger.some(row => row.livingEvents?.some(event => event.catalogEventId === 'E23'
  && event.sourceEventId === 'E13')), 'the rumor trigger remains linked to the complaint in the ledger');
assert.equal(game.stateHash(game.loadGame(game.saveGame(rumorArrival), { maps, hostCards: cards,
  quests: [priceQuest, rentQuest, rumorQuest] })), game.stateHash(rumorArrival),
  'the active, physically traveled rumor chain survives save/reload');

const arrived = game.advanceNpcWorld(adjustedSale, 45, maps);
const rentEvent = arrived.world.livingEventStates.E26;
assert.equal(rentEvent.stage, 'NOTICE_POSTED');
assert.equal(objectIsPresent(rentObject, arrived, [rentQuest]), true, 'the rent notice must appear at its courtyard object');
for (const id of [rentEvent.tenantHostId, rentEvent.landlordHostId]) {
  const host = arrived.hosts[id];
  assert.equal(host.mapId, 'courtyard', `${id} must travel to the notice scene`);
  assert.ok(Math.abs(host.position.x - rentEvent.scenePosition.x) + Math.abs(host.position.y - rentEvent.scenePosition.y) <= 5,
    `${id} should approach the notice scene before the choice is shown`);
}
assert.deepEqual(questChoices(rentQuest, 'tenant_mikhail', [], arrived).map(row => row.action.id),
  ['E26_KEEP_OLD_RENT', 'E26_ACCEPT_NEW_RENT', 'E26_SHARE_ROOM_COST']);

const tenantAtNotice = structuredClone(arrived);
tenantAtNotice.player.embodiment = 'tenant_mikhail';
tenantAtNotice.player.position = { ...tenantAtNotice.hosts.tenant_mikhail.position };
tenantAtNotice.world.currentMapId = 'courtyard';
const choice = game.performQuestAction(tenantAtNotice, { questId: rentQuest.id, hostId: 'tenant_mikhail',
  actionId: 'E26_ACCEPT_NEW_RENT', objectId: rentObject.id }, { quests: [rentQuest], maps });
assert.equal(choice.ok, true, `the tenant can resolve the naturally triggered follow-up (${choice.reason ?? ''})`);
assert.equal(choice.state.hosts.tenant_mikhail.housing.amount, rentEvent.proposedRent);
assert.equal(choice.state.world.livingEventStates.E26.status, 'RESOLVED');
const restored = game.loadGame(game.saveGame(choice.state), { maps, hostCards: cards, quests: [priceQuest, rentQuest, rumorQuest] });
const differences = [];
function collectDifferences(left, right, path = '$') {
  if (differences.length >= 40) return;
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) collectDifferences(left[key], right[key], `${path}.${key}`);
    return;
  }
  if (JSON.stringify(left) !== JSON.stringify(right)) differences.push({ path, before: left, after: right });
}
collectDifferences(choice.state, restored);
assert.equal(game.stateHash(restored), game.stateHash(choice.state),
  `both causal event outcomes survive save/load; diffs=${JSON.stringify(differences)}`);
console.log('V37 natural event chains E02→E13→E23 and E02→E26: stockout, restock, adjusted sale, complaint, rumor arrival, rent choice, and save/load passed.');
