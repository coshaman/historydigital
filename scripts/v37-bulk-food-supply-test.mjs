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
const authoredFishSeller = cards.find(card => card.id === 'fishseller_klavdiya');
assert.equal(authoredFishSeller.marketOffers[0].itemKo, '생선 한 점');
const authoredFishWork = authoredFishSeller.schedule.find(slot => slot.workAction?.id === 'V36_FISHSELLER_RECEIVE_CATCH')?.workAction;
assert.equal(authoredFishWork?.restockOfferFromWork, true);
assert.equal(authoredFishWork?.inventoryQuantity, 4);
const authoredInnkeeper = cards.find(card => card.id === 'innkeeper_irina');
const authoredSupper = authoredInnkeeper.schedule.find(slot => slot.workAction?.id === 'V36_INNKEEPER_EVENING_REGISTER')?.workAction;
assert.equal(authoredSupper?.restockOfferFromWork, true,
  'the evening kitchen prepares its own food stock');
assert.equal(authoredSupper?.inventoryQuantity, 6);

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

const fishState = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
fishState.world.date = '1847-06-01'; fishState.world.clockMinutes = 540; fishState.world.currentMapId = 'market-quay';
for (const host of Object.values(fishState.hosts)) host.historicalAliveAndPresent = false;
const fishSeller = fishState.hosts.fishseller_klavdiya;
fishSeller.historicalAliveAndPresent = true; fishSeller.mapId = 'market-quay'; fishSeller.position = { x: 12, y: 12 };
fishSeller.inventory = []; fishSeller.money.amount = 12;
fishSeller.marketOffers = structuredClone(authoredFishSeller.marketOffers);
fishSeller.marketStock = structuredClone(authoredFishSeller.marketStock);
const fishWorkAction = structuredClone(authoredFishWork);
fishSeller.schedule = [{ atMinute: 540, mapId: 'market-quay', position: { ...fishSeller.position }, activityKo: '오늘 들어온 생선을 손질한다', workAction: fishWorkAction }];
const fishProduced = game.advanceNpcWorld(fishState, 25, maps);
assert.equal(fishProduced.hosts.fishseller_klavdiya.marketStock['생선 한 점'], 4,
  'a merchant can stock her own stall from a completed food-preparation action');
assert.equal(fishProduced.hosts.fishseller_klavdiya.inventory.filter(item => item === '생선 한 점').length, 0,
  'prepared portions enter the stall inventory exactly once');
const fishBuyers = ['student_vasily', 'courier_pavel', 'street_vendor_matryona'];
for (let index = 0; index < fishBuyers.length; index += 1) {
  const buyer = fishProduced.hosts[fishBuyers[index]];
  buyer.historicalAliveAndPresent = true; buyer.mapId = 'market-quay'; buyer.position = positions[index];
  buyer.money.amount = 8; buyer.needs.hunger = 90; buyer.needs.lastMealAtMinute = 0;
  buyer.schedule = [{ atMinute: 570, mapId: 'market-quay', position: { ...buyer.position }, activityKo: '장터에서 먹을 것을 찾는다' }];
  buyer.activeGoal = { type: 'PURCHASE_MEAL', targetHostId: fishSeller.id, taskId: `TEST_FISH_MEAL:${buyer.id}` };
}
fishSeller.position = { x: 12, y: 12 };
fishSeller.schedule = [{ atMinute: 570, mapId: 'market-quay', position: { ...fishSeller.position }, activityKo: '생선 좌판을 지킨다' }];
const fishServed = game.advanceNpcWorld(fishProduced, 10, maps);
const fishMeals = fishServed.ledger.flatMap(row => row.meals ?? []).filter(row => row.kind === 'PURCHASE_AND_EAT'
  && row.sellerHostId === fishSeller.id);
assert.equal(fishMeals.length, 3, 'a second market stall can serve three paid meal customers');
assert.equal(fishServed.hosts.fishseller_klavdiya.money.amount, 18, 'the fish seller receives each customer payment');
assert.equal(fishServed.hosts.fishseller_klavdiya.marketStock['생선 한 점'], 1);
const fishRestored = game.loadGame(game.saveGame(fishServed), { maps, hostCards: cards });
assert.equal(fishRestored.hosts.fishseller_klavdiya.marketStock['생선 한 점'], 1);
assert.equal(fishRestored.hosts.fishseller_klavdiya.money.amount, 18);

const innState = game.createInitialState({ maps, hostCards: cards, startMapId: 'inn-interior' });
innState.world.date = '1847-06-01'; innState.world.clockMinutes = 960; innState.world.currentMapId = 'inn-interior';
for (const host of Object.values(innState.hosts)) host.historicalAliveAndPresent = false;
const innkeeper = innState.hosts.innkeeper_irina;
innkeeper.historicalAliveAndPresent = true; innkeeper.mapId = 'inn-interior'; innkeeper.position = { x: 11, y: 14 };
innkeeper.inventory = [];
const authoredSupperWork = structuredClone(authoredInnkeeper.schedule.find(slot => slot.workAction?.id === 'V36_INNKEEPER_EVENING_REGISTER').workAction);
innkeeper.schedule = [{ atMinute: 960, mapId: 'inn-interior', position: { ...innkeeper.position }, activityKo: '저녁 수프를 끓인다', workAction: authoredSupperWork }];
const supperPrepared = game.advanceNpcWorld(innState, 25, maps);
assert.equal(supperPrepared.hosts.innkeeper_irina.marketStock['저녁 수프'], 9,
  'the evening kitchen adds its cooked portions to the inn meal stock');
assert.equal(supperPrepared.hosts.innkeeper_irina.inventory.filter(item => item === '저녁 수프').length, 0,
  'cooked servings enter the inn counter inventory exactly once');
const supperRestored = game.loadGame(game.saveGame(supperPrepared), { maps, hostCards: cards });
assert.equal(supperRestored.hosts.innkeeper_irina.marketStock['저녁 수프'], 9);
console.log('V37 food supply: bakery wholesale, fish-stall and inn-kitchen production, paid meals, and save/load passed');
