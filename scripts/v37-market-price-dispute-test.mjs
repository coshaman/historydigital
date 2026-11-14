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
  json('../rpg/quests/market-price-dispute-1847.json'), json('../data/event_catalog_45.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/maps/${file}`)))
    .then(records => Object.fromEntries(records.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/characters/${file}`))),
]);
const map = maps['market-quay'];
const object = map.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
assert.ok(object, 'the price dispute has a physical market transaction ledger');
assert.equal(catalog.find(row => row.event_id === 'E13').validation_status, 'DESIGN_SEED_NOT_VERIFIED');

const start = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
start.world.chapterId = 'V33_1847_PRINT';
start.world.date = '1847-06-01';
start.world.clockMinutes = 601;
start.player.embodiment = null;
const seller = start.hosts.market_nadezhda, buyer = start.hosts.porter_gavrila;
const sellerTile = { x: object.x / 16, y: object.y / 16 };
seller.mapId = 'market-quay'; seller.position = { ...sellerTile };
buyer.mapId = 'market-quay'; buyer.position = { x: sellerTile.x + 1, y: sellerTile.y };
buyer.needs.hunger = 94; buyer.needs.lastMealAtMinute = null; buyer.money.amount = 10;
buyer.activeGoal = { type: 'PURCHASE_MEAL', targetHostId: seller.id, taskId: 'TEST_ADJUSTED_PRICE_PURCHASE' };
seller.marketStock['빵 한 묶음'] = 1;
start.world.marketPriceModifiers['market_nadezhda:빵 한 묶음'] = 1;
start.world.livingEventStates.E02 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E02',
  status: 'ACTIVE', stage: 'RESTOCKED', startedAtMinute: 540, restockedAtMinute: 600,
  buyerHostId: 'baker_fyodor', sellerHostId: 'market_nadezhda', supplierHostId: 'baker_fyodor',
  itemKo: '빵 한 묶음', basePrice: 1, currentPrice: 2, valueStatus: 'fictional_gameplay_balance',
  validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
assert.equal(objectIsPresent(object, start, [quest]), false, 'no dispute appears before an adjusted-price sale');
const purchase = game.advanceNpcWorld(start, 1, maps);
const event = purchase.world.livingEventStates.E13;
assert.ok(purchase.ledger.some(entry => entry.meals?.some(row => row.hostId === buyer.id && row.price === 2)),
  'the buyer completes the adjusted purchase through the regular economic simulation');
assert.equal(purchase.world.livingEventStates.E02.stage, 'RESOLVED');
assert.equal(event?.status, 'ACTIVE', 'the post-sale event needs an actual E02 price-adjusted purchase');
assert.equal(event.stage, 'PRICE_CHALLENGE');
assert.equal(event.triggerMechanism, 'adjusted_price_paid_after_documented_game_stockout');
assert.equal(event.sourceCatalogEventId, 'E02');
assert.equal(event.buyerHostId, buyer.id);
assert.equal(event.surcharge, 1);
assert.equal(event.validationStatus, 'DESIGN_SEED_NOT_VERIFIED');
assert.equal(objectIsPresent(object, purchase, [quest]), true, 'the physical response ledger appears after the actual sale');
assert.deepEqual(questChoices(quest, buyer.id, [], purchase).map(row => row.action.id), ['E13_ACCEPT_TRANSACTION', 'E13_FILE_PRICE_COMPLAINT']);
assert.deepEqual(questChoices(quest, seller.id, [], purchase).map(row => row.action.id), ['E13_REFUND_SURCHARGE']);
assert.deepEqual(questChoices(quest, 'clerk_alexei', [], purchase), [], 'unrelated residents cannot select either party role');
const buyerAway = structuredClone(purchase);
buyerAway.hosts[buyer.id].mapId = 'printshop';
assert.deepEqual(questChoices(quest, seller.id, [], buyerAway), [], 'seller cannot see the refund option while the buyer is absent');

const atObject = (source, hostId) => {
  const branch = structuredClone(source), targetPosition = { x: object.x / 16, y: object.y / 16 };
  branch.world.currentMapId = 'market-quay';
  branch.hosts[hostId].mapId = 'market-quay'; branch.hosts[hostId].position = { ...targetPosition };
  const counterpartId = hostId === seller.id ? buyer.id : seller.id;
  branch.hosts[counterpartId].mapId = 'market-quay';
  branch.hosts[counterpartId].position = { x: targetPosition.x + 1, y: targetPosition.y };
  branch.player.embodiment = hostId; branch.player.position = { ...targetPosition };
  return branch;
};
for (const [actionId, hostId, expectedStage] of [
  ['E13_ACCEPT_TRANSACTION', buyer.id, 'TRANSACTION_ACCEPTED'],
  ['E13_FILE_PRICE_COMPLAINT', buyer.id, 'REPORT_FILED'],
  ['E13_REFUND_SURCHARGE', seller.id, 'REFUND_ISSUED'],
]) {
  const branch = atObject(purchase, hostId);
  const beforeSeller = branch.hosts[seller.id].money.amount, beforeBuyer = branch.hosts[buyer.id].money.amount;
  const action = game.performQuestAction(branch, { questId: quest.id, hostId, actionId, objectId: quest.entry.objectId }, { quests: [quest], maps });
  assert.equal(action.ok, true, `${actionId} is completed by the relevant party at the physical market object (${action.reason ?? 'unknown'})`);
  assert.equal(action.state.world.livingEventStates.E13.stage, expectedStage);
  if (actionId === 'E13_REFUND_SURCHARGE') {
    assert.equal(action.state.hosts[seller.id].money.amount, beforeSeller - 1);
    assert.equal(action.state.hosts[buyer.id].money.amount, beforeBuyer + 1);
    assert.equal(action.state.world.livingEventStates.E13.refundedAmount, 1);
  }
  if (actionId === 'E13_FILE_PRICE_COMPLAINT') {
    assert.equal(action.state.world.marketPriceComplaintRecords[0].reviewStatus, 'AWAITING_WATCHMAN');
    const onePartyPresent = structuredClone(action.state);
    const filedEvent = onePartyPresent.world.livingEventStates.E13;
    const scene = filedEvent.scenePosition;
    onePartyPresent.hosts[buyer.id].mapId = 'printshop';
    onePartyPresent.hosts[filedEvent.watchmanHostId].mapId = 'market-quay';
    onePartyPresent.hosts[filedEvent.watchmanHostId].position = { ...scene };
    onePartyPresent.hosts[seller.id].mapId = 'market-quay';
    onePartyPresent.hosts[seller.id].position = { ...scene };
    const partialVisit = game.advanceNpcWorld(onePartyPresent, 1, maps);
    assert.equal(partialVisit.world.livingEventStates.E13.stage, 'REPORT_FILED',
      'the watchman cannot close the report after hearing only the seller');
    assert.equal(partialVisit.world.marketPriceComplaintRecords[0].reviewStatus, 'AWAITING_WATCHMAN');
    partialVisit.hosts[buyer.id].mapId = 'market-quay';
    partialVisit.hosts[buyer.id].position = { x: scene.x + 1, y: scene.y };
    const bothPartiesPresent = game.advanceNpcWorld(partialVisit, 1, maps);
    assert.equal(bothPartiesPresent.world.livingEventStates.E13.stage, 'WATCHMAN_REVIEWED',
      'the record closes once the watchman and both parties meet at the stall');
    assert.equal(bothPartiesPresent.world.marketPriceComplaintRecords[0].reviewStatus, 'WATCHMAN_HEARD_PARTIES');
    const restored = game.loadGame(game.saveGame(bothPartiesPresent), { maps, hostCards: cards });
    assert.equal(game.stateHash(restored), game.stateHash(bothPartiesPresent), 'the official review and record survive save/load');
    const routedResponse = game.advanceNpcWorld(action.state, 300, maps);
    assert.equal(routedResponse.world.livingEventStates.E13.stage, 'WATCHMAN_REVIEWED',
      'the seller remains available and the watchman completes the visit before the response deadline');
    assert.equal(routedResponse.world.marketPriceComplaintRecords[0].reviewStatus, 'WATCHMAN_HEARD_PARTIES');
    const routedReload = game.loadGame(game.saveGame(routedResponse), { maps, hostCards: cards });
    assert.equal(game.stateHash(routedReload), game.stateHash(routedResponse), 'the routed watchman visit survives save/load');
  } else {
    const restored = game.loadGame(game.saveGame(action.state), { maps, hostCards: cards });
    assert.equal(game.stateHash(restored), game.stateHash(action.state), `${actionId} survives save/load`);
  }
}

const nearDeadline = atObject(purchase, buyer.id);
nearDeadline.world.livingEventStates.E13.resolvesAtMinute = nearDeadline.world.clockMinutes + 2;
const protectedChoice = game.performQuestAction(nearDeadline, { questId: quest.id, hostId: buyer.id,
  actionId: 'E13_ACCEPT_TRANSACTION', objectId: quest.entry.objectId }, { quests: [quest], maps });
assert.equal(protectedChoice.ok, true, 'the choice remains atomic when its duration crosses the event deadline');
assert.equal(protectedChoice.state.world.livingEventStates.E13.stage, 'TRANSACTION_ACCEPTED');
const unattended = game.advanceNpcWorld(purchase, 181, maps);
assert.equal(unattended.world.livingEventStates.E13.stage, 'PRICE_STANDS');
assert.equal(unattended.world.livingEventStates.E13.status, 'RESOLVED');
console.log('V37 E13 market price dispute: adjusted purchase trigger, role-gated choices, refund, official watchman visit, timeout, and save/load passed.');
