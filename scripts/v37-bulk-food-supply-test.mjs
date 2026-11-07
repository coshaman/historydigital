import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async url => JSON.parse(await readFile(url, 'utf8'));
const [mapFiles, cardFiles] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/maps/${file}`, import.meta.url))))
    .then(rows => Object.fromEntries(rows.map(row => [row.mapId, row]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/characters/${file}`, import.meta.url)))),
]);
const authoredBaker = cards.find(card => card.id === 'baker_fyodor');
const authoredBatch = authoredBaker.schedule.find(slot => slot.workAction?.id === 'V36_BAKER_PREPARE_DOUGH')?.workAction;
const authoredRestock = authoredBaker.schedule.find(slot => slot.task?.id === 'BAKER_DAILY_MARKET_RESTOCK_1847')?.task;
assert.equal(authoredBatch?.inventoryQuantity, 6, 'the baker produces six tracked bread portions');
assert.equal(authoredRestock?.quantity, 6, 'the daily market contract carries the whole batch');
assert.equal(authoredRestock?.moneyAmount, 6, 'the wholesaler pays the agreed batch amount');
assert.ok(cards.find(card => card.id === 'market_nadezhda').marketOffers[0].openWindows.some(window => window.endMinute === 1200),
  'the evening market remains open after the bakery restock');

const state = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
state.world.date = '1847-06-01'; state.world.clockMinutes = 540; state.world.currentMapId = 'market-quay';
for (const host of Object.values(state.hosts)) host.historicalAliveAndPresent = false;
const baker = state.hosts.baker_fyodor, seller = state.hosts.market_nadezhda;
for (const [host, position] of [[baker, { x: 10, y: 12 }], [seller, { x: 12, y: 12 }]]) {
  host.historicalAliveAndPresent = true; host.mapId = 'market-quay'; host.position = position;
}
baker.inventory = [];
baker.schedule = [{ atMinute: 540, mapId: 'market-quay', position: { ...baker.position }, activityKo: '아침 빵을 굽는다', workAction: {
  id: 'TEST_BAKE_BATCH', outputKind: '제빵 생산', outputKo: '시장에 내놓을 빵 세 묶음을 굽는다', durationMinutes: 20,
  inventoryItemKo: '빵 한 묶음', inventoryQuantity: 3,
} }, { atMinute: 570, mapId: 'market-quay', position: { ...baker.position }, activityKo: '구운 빵을 시장 상인에게 넘긴다', task: {
  type: 'EXCHANGE', id: 'TEST_BULK_BREAD_RESTOCK', recipientHostId: seller.id, itemKo: '빵 한 묶음', quantity: 3,
  moneyAmount: 6, notBeforeMinute: 570,
} }];
seller.marketStock = { '빵 한 묶음': 0 };
const beforeBakerMoney = baker.money.amount, beforeSellerMoney = seller.money.amount;
const produced = game.advanceNpcWorld(state, 25, maps);
assert.equal(produced.hosts.baker_fyodor.inventory.filter(item => item === '빵 한 묶음').length, 3,
  'one completed batch creates its authored number of sellable portions');
const restocked = game.advanceNpcWorld(produced, 10, maps);
assert.equal(restocked.hosts.market_nadezhda.marketStock['빵 한 묶음'], 3,
  'the wholesaler receives each portion, not just one item');
assert.equal(restocked.hosts.baker_fyodor.money.amount, beforeBakerMoney + 6);
assert.equal(restocked.hosts.market_nadezhda.money.amount, beforeSellerMoney - 6);

const buyers = ['student_vasily', 'courier_pavel', 'street_vendor_matryona'];
const positions = [{ x: 13, y: 12 }, { x: 12, y: 11 }, { x: 12, y: 13 }];
seller.position = { x: 12, y: 12 };
seller.schedule = [{ atMinute: 570, mapId: 'market-quay', position: { ...seller.position }, activityKo: '빵 좌판을 지킨다' }];
for (let index = 0; index < buyers.length; index += 1) {
  const buyer = restocked.hosts[buyers[index]];
  buyer.historicalAliveAndPresent = true; buyer.mapId = 'market-quay'; buyer.position = positions[index];
  buyer.money.amount = 8; buyer.needs.hunger = 90;
  buyer.needs.lastMealAtMinute = 0;
  buyer.schedule = [{ atMinute: 580, mapId: 'market-quay', position: { ...buyer.position }, activityKo: '시장 좌판에 들른다' }];
  buyer.activeGoal = { type: 'PURCHASE_MEAL', targetHostId: seller.id, taskId: `TEST_MEAL:${buyer.id}` };
}
const served = game.advanceNpcWorld(restocked, 10, maps);
const meals = served.ledger.flatMap(row => row.meals ?? []).filter(row => row.kind === 'PURCHASE_AND_EAT');
assert.equal(meals.length, 3, `three residents can buy and eat from the three-portion restock: ${JSON.stringify({ stock: served.hosts.market_nadezhda.marketStock, seller: { mapId: served.hosts.market_nadezhda.mapId, position: served.hosts.market_nadezhda.position, alive: served.hosts.market_nadezhda.historicalAliveAndPresent }, buyers: buyers.map(id => ({ id, mapId: served.hosts[id].mapId, position: served.hosts[id].position, goal: served.hosts[id].activeGoal, hunger: served.hosts[id].needs.hunger, money: served.hosts[id].money.amount })), meals })}`);
assert.equal(served.hosts.market_nadezhda.marketStock['빵 한 묶음'], 0);
assert.ok(buyers.every(id => served.hosts[id].needs.hunger < 90));
const restored = game.loadGame(game.saveGame(served), { maps, hostCards: cards });
assert.deepEqual(restored.hosts.baker_fyodor.inventory, served.hosts.baker_fyodor.inventory);
assert.equal(restored.hosts.baker_fyodor.money.amount, served.hosts.baker_fyodor.money.amount);
assert.equal(restored.hosts.market_nadezhda.marketStock['빵 한 묶음'], served.hosts.market_nadezhda.marketStock['빵 한 묶음']);
for (const id of buyers) assert.equal(restored.hosts[id].needs.hunger, served.hosts[id].needs.hunger);
assert.ok(restored.ledger.some(row => row.exchanges?.some(item => item.taskId === 'TEST_BULK_BREAD_RESTOCK')));
assert.ok(restored.ledger.flatMap(row => row.meals ?? []).some(row => row.kind === 'PURCHASE_AND_EAT'));
console.log('V37 bulk food supply: authored batch production, wholesale restock, three paid meals, and save/load passed');
