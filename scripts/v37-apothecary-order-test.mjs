import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest, catalog, sourceRegister] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  json('../rpg/quests/apothecary-order-1847.json'), json('../data/event_catalog_45.json'), json('../rpg/data/source-register.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/maps/${file}`)))
    .then(records => Object.fromEntries(records.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/characters/${file}`))),
]);
const catalogEvent = catalog.find(event => event.event_id === 'E16');
assert.equal(catalogEvent.validation_status, 'DESIGN_SEED_NOT_VERIFIED');
assert.deepEqual(catalogEvent.source_ids, ['CAT-NLR-SENATSKIE-1841-APTEKARSKAYA-TAXA']);
assert.match(sourceRegister.sources.find(source => source.sourceId === catalogEvent.source_ids[0]).range, /metadata.*not the supplement's text/i);
const map = maps['market-quay'];
const object = map.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
const start = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
const found = game.advanceNpcWorld(start, 25, maps);
const event = found.world.livingEventStates.E16;
assert.equal(event.status, 'ACTIVE');
assert.equal(event.stage, 'SHORTAGE_FOUND');
assert.equal(event.startedAtMinute, 560, 'the shortage follows Yakov completing his scheduled stock check');
assert.equal(found.hosts.apothecary_yakov.workRecords.find(row => row.actionId === 'V36_APOTHECARY_CHECK_STOCK')?.effectiveDurationMinutes, 20);
assert.equal(event.validationStatus, 'DESIGN_SEED_NOT_VERIFIED');
assert.equal(event.itemStatus, 'generic_gameplay_supply_no_medical_effect_claim');
assert.equal(objectIsPresent(object, found, [quest]), true, 'the physical order desk appears after the witnessed stock check');
assert.deepEqual(questChoices(quest, 'apothecary_yakov', [], found).map(row => row.action.id), ['E16_PLACE_ORDER', 'E16_DECLINE_ORDER']);
assert.deepEqual(questChoices(quest, 'warehouse_pyotr', [], found), [], 'the supplier cannot dispatch before an order exists');

const objectTile = { x: object.x / 16, y: object.y / 16 };
const atDesk = (source, actorId) => {
  const branch = structuredClone(source);
  branch.world.currentMapId = 'market-quay';
  branch.player.position = { ...objectTile };
  branch.player.embodiment = actorId;
  branch.hosts[actorId].mapId = 'market-quay';
  branch.hosts[actorId].position = { ...objectTile };
  return branch;
};

const buyerOrder = atDesk(found, 'apothecary_yakov');
const buyerMoney = buyerOrder.hosts.apothecary_yakov.money.amount;
const supplierMoney = buyerOrder.hosts.warehouse_pyotr.money.amount;
const ordered = game.performQuestAction(buyerOrder, { questId: quest.id, hostId: 'apothecary_yakov', actionId: 'E16_PLACE_ORDER', objectId: object.id }, { quests: [quest], maps });
assert.equal(ordered.ok, true, `buyer can place a private order at the desk (${ordered.reason ?? 'unknown'})`);
assert.equal(ordered.state.world.livingEventStates.E16.stage, 'ORDER_PLACED');
assert.equal(ordered.state.hosts.apothecary_yakov.money.amount, buyerMoney, 'the buyer pays only when the parcel arrives');
assert.equal(ordered.state.hosts.warehouse_pyotr.money.amount, supplierMoney);
assert.equal(ordered.state.hosts.apothecary_yakov.inventory.includes(event.itemKo), false);
assert.deepEqual(ordered.state.world.livingEventStates.E16.orderMethod, 'PRIVATE_ORDER_NOTE');
assert.ok(ordered.state.ledger.at(-1).livingEvents.some(row => row.catalogEventId === 'E16' && row.stage === 'ORDER_PLACED'));

const continued = structuredClone(ordered.state);
continued.player.embodiment = null;
const delivered = game.advanceNpcWorld(continued, 240, maps);
assert.equal(delivered.world.livingEventStates.E16.stage, 'DELIVERED', 'Pyotr travels to the desk and the unattended order is fulfilled');
assert.equal(delivered.hosts.apothecary_yakov.money.amount, buyerMoney - 3);
assert.equal(delivered.hosts.warehouse_pyotr.money.amount, supplierMoney + 3);
assert.ok(delivered.hosts.apothecary_yakov.inventory.includes(event.itemKo));
assert.equal(delivered.hosts.warehouse_pyotr.inventory.includes(event.itemKo), false);
assert.deepEqual(delivered.hosts.apothecary_yakov.healthState, continued.hosts.apothecary_yakov.healthState, 'a supply packet does not assert a medical or health effect');
assert.ok(delivered.ledger.flatMap(row => row.livingEvents ?? []).some(row => row.catalogEventId === 'E16' && row.stage === 'DELIVERED'));
assert.equal(delivered.quests[quest.id].status, 'open', 'an autonomous NPC event cannot resolve the player-owned quest choice');
const reloaded = game.loadGame(game.saveGame(delivered), { maps, hostCards: cards, quests: [quest] });
assert.equal(game.stateHash(reloaded), game.stateHash(delivered), 'order, delivery, inventory, money, and event status survive save/load');

const supplierChoice = structuredClone(found);
supplierChoice.player.embodiment = 'warehouse_pyotr';
supplierChoice.world.clockMinutes = event.orderWindowEndsAtMinute;
supplierChoice.world.livingEventStates.E16.stage = 'ORDER_PLACED';
supplierChoice.world.livingEventStates.E16.orderRecorded = true;
supplierChoice.world.livingEventStates.E16.orderMethod = 'PRIVATE_ORDER_NOTE';
supplierChoice.world.livingEventStates.E16.orderPlacedAtMinute = supplierChoice.world.clockMinutes;
supplierChoice.world.livingEventStates.E16.deliveryDeadlineMinute = supplierChoice.world.clockMinutes + 180;
supplierChoice.world.currentMapId = 'market-quay';
supplierChoice.hosts.apothecary_yakov.mapId = 'market-quay';
supplierChoice.hosts.apothecary_yakov.position = { ...objectTile };
supplierChoice.hosts.warehouse_pyotr.mapId = 'market-quay';
supplierChoice.hosts.warehouse_pyotr.position = { x: objectTile.x + 1, y: objectTile.y };
supplierChoice.player.position = { x: objectTile.x + 1, y: objectTile.y };
assert.deepEqual(questChoices(quest, 'warehouse_pyotr', [], supplierChoice).map(row => row.action.id), ['E16_DISPATCH_SUPPLY', 'E16_WITHHOLD_SUPPLY']);
const withheld = game.performQuestAction(supplierChoice, { questId: quest.id, hostId: 'warehouse_pyotr', actionId: 'E16_WITHHOLD_SUPPLY', objectId: object.id }, { quests: [quest], maps });
assert.equal(withheld.ok, true, `supplier can withhold the parcel in person (${withheld.reason ?? 'unknown'})`);
assert.equal(withheld.state.world.livingEventStates.E16.stage, 'SUPPLY_WITHHELD');
assert.deepEqual(withheld.state.hosts.warehouse_pyotr.inventory, supplierChoice.hosts.warehouse_pyotr.inventory);
assert.equal(withheld.state.hosts.apothecary_yakov.money.amount, supplierChoice.hosts.apothecary_yakov.money.amount);

const dispatch = structuredClone(supplierChoice);
const dispatched = game.performQuestAction(dispatch, { questId: quest.id, hostId: 'warehouse_pyotr', actionId: 'E16_DISPATCH_SUPPLY', objectId: object.id }, { quests: [quest], maps });
assert.equal(dispatched.ok, true, `supplier can complete the physical payment and transfer (${dispatched.reason ?? 'unknown'})`);
assert.equal(dispatched.state.world.livingEventStates.E16.stage, 'DELIVERED');
assert.equal(dispatched.state.hosts.apothecary_yakov.money.amount, supplierChoice.hosts.apothecary_yakov.money.amount - 3);
assert.ok(dispatched.state.hosts.apothecary_yakov.inventory.includes(event.itemKo));

const declined = atDesk(found, 'apothecary_yakov');
const declinedMoney = declined.hosts.apothecary_yakov.money.amount;
const noOrder = game.performQuestAction(declined, { questId: quest.id, hostId: 'apothecary_yakov', actionId: 'E16_DECLINE_ORDER', objectId: object.id }, { quests: [quest], maps });
assert.equal(noOrder.ok, true, `buyer can decline without a transaction (${noOrder.reason ?? 'unknown'})`);
assert.equal(noOrder.state.world.livingEventStates.E16.stage, 'ORDER_DECLINED');
assert.equal(noOrder.state.hosts.apothecary_yakov.money.amount, declinedMoney);
assert.equal(noOrder.state.hosts.apothecary_yakov.inventory.includes(event.itemKo), false);

console.log('V37 apothecary supply event: PASS (stock trigger, private order, deterministic travel, money/inventory transfer, decline/withhold, save/load, no health claim)');
