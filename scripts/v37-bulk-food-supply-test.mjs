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
assert.equal(authoredBatch?.inventoryQuantity, 18, 'the baker produces enough tracked bread portions for a citywide morning and evening service');
assert.equal(authoredRestock?.quantity, 18, 'the daily market contract carries the whole batch');
assert.equal(authoredRestock?.moneyAmount, 18, 'the wholesaler pays the agreed batch amount');
assert.ok(cards.find(card => card.id === 'market_nadezhda').marketOffers[0].openWindows.some(window => window.startMinute === 1020 && window.endMinute >= 1320),
  'the evening bread stall remains available after its wholesale restock');
assert.ok(cards.find(card => card.id === 'market_nadezhda').residence.sleepMinute >= 1380,
  'the bread seller remains at work until the advertised closing time');
const breadSellerCard = cards.find(card => card.id === 'market_nadezhda');
assert.ok(breadSellerCard.residence.sleepMinute >= 1320,
  'the bread seller leaves enough time to return to her authored sleep location');
assert.deepEqual(breadSellerCard.marketServiceShifts.map(shift => [shift.startMinute, shift.endMinute]),
  [[500, 660], [660, 780], [900, 960], [1040, 1080], [1100, 1320]],
  'the bread seller covers the quay, a daytime Nevsky counter, and her evening stall');
assert.ok(breadSellerCard.marketOffers.some(offer => offer.mapId === 'nevsky'
  && offer.openWindows.some(window => window.startMinute === 660 && window.endMinute === 780)),
  'the Nevsky sale window matches the seller\'s authored daytime location');
const fishSellerCard = cards.find(card => card.id === 'fishseller_klavdiya');
assert.deepEqual(fishSellerCard.marketServiceShifts.map(shift => [shift.startMinute, shift.endMinute]),
  [[480, 900], [901, 960], [960, 1380]], 'the fish seller serves at the quay, takes her break, then sells remaining stock in the courtyard until her rest window');
const serviceShiftState = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
serviceShiftState.world.date = '1847-06-01'; serviceShiftState.world.clockMinutes = 600;
for (const host of Object.values(serviceShiftState.hosts)) host.historicalAliveAndPresent = false;
const serviceSeller = serviceShiftState.hosts.market_nadezhda;
serviceSeller.historicalAliveAndPresent = true; serviceSeller.mapId = 'market-quay';
serviceSeller.position = { x: 8, y: 8 }; serviceSeller.marketStock['빵 한 묶음'] = 3;
serviceSeller.schedule = [{ atMinute: 480, mapId: 'market-quay', position: { x: 14, y: 12 }, activityKo: '좌판을 연다' }];
const sellerOnShift = game.advanceNpcWorld(serviceShiftState, 1, maps).hosts.market_nadezhda;
assert.equal(sellerOnShift.activeGoal.type, 'MARKET_SERVICE', 'the seller uses the deterministic food service routine during published hours');
assert.deepEqual(sellerOnShift.routineState.targetPosition, { x: 14, y: 12 }, 'the seller travels toward and stays at the authored fixed stall');
const streetServiceState = game.createInitialState({ maps, hostCards: cards, startMapId: 'nevsky' });
streetServiceState.world.date = '1847-06-01'; streetServiceState.world.clockMinutes = 700;
for (const host of Object.values(streetServiceState.hosts)) host.historicalAliveAndPresent = false;
const streetSeller = streetServiceState.hosts.market_nadezhda;
streetSeller.historicalAliveAndPresent = true; streetSeller.mapId = 'nevsky'; streetSeller.position = { x: 8, y: 8 };
streetSeller.marketStock['빵 한 묶음'] = 2;
streetSeller.schedule = [{ atMinute: 660, mapId: 'nevsky', position: { x: 14, y: 12 }, activityKo: '거리 좌판을 지킨다' }];
const streetSellerOnShift = game.advanceNpcWorld(streetServiceState, 1, maps).hosts.market_nadezhda;
assert.equal(streetSellerOnShift.activeGoal.type, 'MARKET_SERVICE');
assert.deepEqual(streetSellerOnShift.routineState.targetPosition, { x: 14, y: 12 }, 'the second public counter is a real mapped seller route');
const bakerCanEat = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
for (const host of Object.values(bakerCanEat.hosts)) host.historicalAliveAndPresent = ['baker_fyodor', 'market_nadezhda'].includes(host.id);
const breadBaker = bakerCanEat.hosts.baker_fyodor, breadSellerHost = bakerCanEat.hosts.market_nadezhda;
breadBaker.mapId = breadSellerHost.mapId = 'market-quay'; breadBaker.position = { x: 13, y: 12 }; breadSellerHost.position = { x: 14, y: 12 };
breadBaker.schedule = [{ atMinute: 600, mapId: 'market-quay', position: { ...breadBaker.position }, activityKo: '장터 일을 살핀다' }];
breadBaker.activeGoal = null; breadBaker.needs.hunger = 90; breadBaker.needs.lastMealAtMinute = 0; breadBaker.money.amount = 20;
breadSellerHost.marketStock['빵 한 묶음'] = 5;
const bakerFed = game.advanceNpcWorld(bakerCanEat, 10, maps);
assert.ok(bakerFed.hosts.baker_fyodor.needs.hunger < 90,
  'bread reserved for sale must not prevent a baker without a personal meal schedule from buying and eating');
const remoteMealTrip = game.createInitialState({ maps, hostCards: cards, startMapId: 'printshop' });
remoteMealTrip.world.clockMinutes = 480;
for (const host of Object.values(remoteMealTrip.hosts)) host.historicalAliveAndPresent = ['typesetter_nikita', 'market_nadezhda'].includes(host.id);
const remoteWorker = remoteMealTrip.hosts.typesetter_nikita, remoteSeller = remoteMealTrip.hosts.market_nadezhda;
remoteWorker.mapId = 'printshop'; remoteWorker.position = { x: 15, y: 10 }; remoteWorker.inventory = [];
remoteWorker.schedule = [{ atMinute: 720, mapId: 'printshop', position: { ...remoteWorker.position }, activityKo: '인쇄소 일을 정리한다' }];
remoteWorker.activeGoal = null; remoteWorker.needs.hunger = 55; remoteWorker.needs.lastMealAtMinute = 0;
remoteWorker.needs.incomePressure = 0; remoteWorker.money.amount = 20;
remoteSeller.mapId = 'market-quay'; remoteSeller.position = { x: 14, y: 12 }; remoteSeller.marketStock['빵 한 묶음'] = 5;
const earlyMealTrip = game.advanceNpcWorld(remoteMealTrip, 1, maps);
assert.equal(earlyMealTrip.hosts.typesetter_nikita.activeGoal.type, 'PURCHASE_MEAL',
  'a distant resident starts the trip before hunger becomes severe');
assert.equal(earlyMealTrip.hosts.typesetter_nikita.activeGoal.targetHostId, 'market_nadezhda');
assert.ok(earlyMealTrip.hosts.typesetter_nikita.needs.hunger > 50 && earlyMealTrip.hosts.typesetter_nikita.needs.hunger < 60,
  'starting a meal trip does not create or consume food before the resident reaches the seller');
const continuedMealTrip = game.advanceNpcWorld(earlyMealTrip, 20, maps);
assert.equal(continuedMealTrip.hosts.typesetter_nikita.activeGoal.type, 'PURCHASE_MEAL',
  'once a resident starts a meal trip, a lower-priority personal goal must not send them away before they reach food');
assert.equal(continuedMealTrip.hosts.typesetter_nikita.activeGoal.targetHostId, 'market_nadezhda');
const committedMeal = game.createInitialState({ maps, hostCards: cards, startMapId: 'printshop' });
for (const host of Object.values(committedMeal.hosts)) host.historicalAliveAndPresent = ['seamstress_anna', 'fishseller_klavdiya'].includes(host.id);
const anna = committedMeal.hosts.seamstress_anna, annaFishSeller = committedMeal.hosts.fishseller_klavdiya;
committedMeal.world.clockMinutes = 600;
anna.mapId = 'printshop'; anna.position = { x: 13, y: 15 }; anna.needs.hunger = 58; anna.needs.lastMealAtMinute = 540;
anna.needs.incomePressure = 0; anna.money.amount = 18; anna.plannerPolicy.personalPriority = 1;
anna.schedule = [{ atMinute: 600, mapId: 'printshop', position: { x: 13, y: 15 }, activityKo: '재봉 도구를 정리한다',
  workAction: { id: 'TEST_DUE_SHIFT', kind: 'WORK', loadClass: 'LIGHT', durationMinutes: 45, wage: 1 } }];
anna.activeGoal = { type: 'PURCHASE_MEAL', targetHostId: annaFishSeller.id, taskId: `FOOD:${annaFishSeller.id}:생선 한 점`,
  reason: 'plan_a_market_meal_before_hunger_becomes_severe', selectionBasis: { utilityScore: 101.62 } };
annaFishSeller.mapId = 'market-quay'; annaFishSeller.position = { x: 26, y: 15 }; annaFishSeller.marketStock['생선 한 점'] = 8;
const retainedMealGoal = game.advanceNpcWorld(committedMeal, 15, maps);
assert.equal(retainedMealGoal.hosts.seamstress_anna.activeGoal.type, 'PURCHASE_MEAL',
  'an ongoing meal trip must remain selected over a personal-life stage and due shift');
assert.equal(retainedMealGoal.hosts.seamstress_anna.activeGoal.targetHostId, 'fishseller_klavdiya');
const authoredFishSeller = cards.find(card => card.id === 'fishseller_klavdiya');
assert.equal(authoredFishSeller.marketOffers[0].itemKo, '생선 한 점');
assert.ok(authoredFishSeller.marketOffers[0].openWindows.some(window => window.startMinute === 480 && window.endMinute === 960),
  'the fish seller advertises food only while she is scheduled at the quay');
assert.ok(authoredFishSeller.marketOffers.some(offer => offer.mapId === 'courtyard'
  && offer.openWindows.some(window => window.startMinute === 960 && window.endMinute === 1380)),
  'remaining fish can be sold at the courtyard where the seller works after leaving the quay');
const authoredFishWork = authoredFishSeller.schedule.find(slot => slot.workAction?.id === 'V36_FISHSELLER_RECEIVE_CATCH')?.workAction;
assert.equal(authoredFishWork?.restockOfferFromWork, true);
assert.equal(authoredFishWork?.inventoryQuantity, 14, 'the daily fish delivery must carry enough game-balanced portions for the routed afternoon stall');
assert.equal(authoredFishWork?.valueStatus, 'fictional_gameplay_balance');
assert.equal(authoredFishSeller.schedule.find(slot => slot.task?.id === 'KLAVIYA_MARKET_BREAK_MEAL_1847')?.task?.itemKo, '생선 한 점',
  'the fish seller has an authored meal break supplied from her own counter stock');
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
assert.equal(fishProduced.hosts.fishseller_klavdiya.marketStock['생선 한 점'], 14,
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
assert.equal(fishServed.hosts.fishseller_klavdiya.marketStock['생선 한 점'], 11);
const fishRestored = game.loadGame(game.saveGame(fishServed), { maps, hostCards: cards });
assert.equal(fishRestored.hosts.fishseller_klavdiya.marketStock['생선 한 점'], 11);
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

const vendorMealState = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
vendorMealState.world.date = '1847-06-01'; vendorMealState.world.clockMinutes = 1080; vendorMealState.world.currentMapId = 'market-quay';
for (const host of Object.values(vendorMealState.hosts)) host.historicalAliveAndPresent = false;
const eatingVendor = vendorMealState.hosts.market_nadezhda;
eatingVendor.historicalAliveAndPresent = true; eatingVendor.mapId = 'market-quay'; eatingVendor.position = { x: 14, y: 12 };
eatingVendor.needs.hunger = 82; eatingVendor.needs.lastMealAtMinute = 500;
eatingVendor.marketStock['빵 한 묶음'] = 2;
eatingVendor.schedule = [{ atMinute: 1080, mapId: 'market-quay', position: { ...eatingVendor.position }, activityKo: '잠시 쉬며 빵을 먹는다', task: { type: 'CONSUME', id: 'TEST_VENDOR_MEAL', itemKo: '빵 한 묶음', minimumHunger: 45, hungerRelief: 32 } }];
const vendorAte = game.advanceNpcWorld(vendorMealState, 1, maps);
assert.equal(vendorAte.hosts.market_nadezhda.marketStock['빵 한 묶음'], 1,
  'a vendor meal consumes one portion from the stall stock when no personal portion is carried');
assert.ok(vendorAte.hosts.market_nadezhda.needs.hunger < 82, 'the vendor meal reduces hunger');
assert.ok(vendorAte.ledger.flatMap(row => row.meals ?? []).some(meal => meal.hostId === eatingVendor.id),
  'vendor food consumption is recorded in the meal ledger');
const vendorAteReloaded = game.loadGame(game.saveGame(vendorAte), { maps, hostCards: cards });
assert.equal(vendorAteReloaded.hosts.market_nadezhda.marketStock['빵 한 묶음'], 1,
  'seller meal stock and hunger outcomes persist through save/load');
const vendorServiceState = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
vendorServiceState.world.date = '1847-06-01'; vendorServiceState.world.clockMinutes = 1080; vendorServiceState.world.currentMapId = 'market-quay';
for (const host of Object.values(vendorServiceState.hosts)) host.historicalAliveAndPresent = false;
const activeVendor = vendorServiceState.hosts.market_nadezhda;
activeVendor.historicalAliveAndPresent = true; activeVendor.mapId = 'market-quay'; activeVendor.position = { x: 14, y: 12 };
activeVendor.needs.hunger = 92; activeVendor.needs.lastMealAtMinute = 540; activeVendor.activeGoal = null;
activeVendor.marketStock['빵 한 묶음'] = 2;
activeVendor.schedule = [{ atMinute: 1020, mapId: 'market-quay', position: { ...activeVendor.position }, activityKo: '저녁 빵을 판다' }];
const vendorStayed = game.advanceNpcWorld(vendorServiceState, 1, maps);
assert.notEqual(vendorStayed.hosts.market_nadezhda.activeGoal?.type, 'PURCHASE_MEAL',
  'a vendor with an open, stocked food offer keeps serving instead of leaving to buy from another stall');
assert.equal(vendorStayed.hosts.market_nadezhda.mapId, 'market-quay');
assert.deepEqual(vendorStayed.hosts.market_nadezhda.position, { x: 14, y: 12 });
const lateMealState = game.createInitialState({ maps, hostCards: cards, startMapId: 'printshop' });
lateMealState.world.date = '1847-06-01'; lateMealState.world.clockMinutes = 1086; lateMealState.world.currentMapId = 'printshop';
for (const host of Object.values(lateMealState.hosts)) host.historicalAliveAndPresent = false;
const lateBuyer = lateMealState.hosts.print_apprentice_stepan, lateSeller = lateMealState.hosts.market_nadezhda;
lateBuyer.historicalAliveAndPresent = lateSeller.historicalAliveAndPresent = true;
lateBuyer.mapId = 'printshop'; lateBuyer.position = { x: 11, y: 14 }; lateBuyer.money.amount = 8;
lateBuyer.needs.hunger = 65; lateBuyer.needs.lastMealAtMinute = 540; lateBuyer.activeGoal = null;
lateBuyer.schedule = [
  { atMinute: 1020, mapId: 'printshop', position: { ...lateBuyer.position }, activityKo: '인쇄소 일을 마친다' },
  { atMinute: 1110, mapId: 'courtyard', position: { x: 10, y: 10 }, activityKo: '잠든다', routineKind: 'FICTIONAL_HOME_SLEEP' },
];
lateSeller.mapId = 'market-quay'; lateSeller.position = { x: 26, y: 12 }; lateSeller.marketStock['빵 한 묶음'] = 2;
lateSeller.schedule = [{ atMinute: 1020, mapId: 'market-quay', position: { ...lateSeller.position }, activityKo: '저녁 빵을 판다' }];
const hungryBeforeSleep = game.advanceNpcWorld(lateMealState, 30, maps);
assert.equal(hungryBeforeSleep.hosts.print_apprentice_stepan.activeGoal?.type, 'PURCHASE_MEAL',
  'urgent meal travel continues through a nearby sleep window instead of being cancelled before reaching the stall');
const lateMealServed = game.advanceNpcWorld(hungryBeforeSleep, 180, maps);
assert.ok(lateMealServed.ledger.flatMap(row => row.meals ?? []).some(meal => meal.hostId === 'print_apprentice_stepan'),
  'the late-shift resident completes the paid meal after the longer route');

const stallQueueState = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
stallQueueState.world.date = '1847-06-01'; stallQueueState.world.clockMinutes = 1080; stallQueueState.world.currentMapId = 'market-quay';
for (const host of Object.values(stallQueueState.hosts)) host.historicalAliveAndPresent = false;
const queueBuyer = stallQueueState.hosts.coachman_timofey, queueSeller = stallQueueState.hosts.market_nadezhda;
queueBuyer.historicalAliveAndPresent = queueSeller.historicalAliveAndPresent = true;
queueBuyer.mapId = queueSeller.mapId = 'market-quay'; queueBuyer.position = { x: 11, y: 12 }; queueSeller.position = { x: 14, y: 12 };
queueBuyer.needs.hunger = 80; queueBuyer.needs.lastMealAtMinute = 540; queueBuyer.money.amount = 8;
queueBuyer.activeGoal = { type: 'PURCHASE_MEAL', targetHostId: queueSeller.id, taskId: 'TEST_MARKET_QUEUE' };
queueBuyer.schedule = [{ atMinute: 1020, mapId: 'market-quay', position: { ...queueBuyer.position }, activityKo: '장터에서 먹을 것을 산다' }];
queueSeller.schedule = [{ atMinute: 1020, mapId: 'market-quay', position: { ...queueSeller.position }, activityKo: '좌판을 지킨다' }];
queueSeller.marketStock['빵 한 묶음'] = 1;
const queueServed = game.advanceNpcWorld(stallQueueState, 1, maps);
assert.ok(queueServed.ledger.flatMap(row => row.meals ?? []).some(meal => meal.hostId === queueBuyer.id),
  `a resident at the stall-side queue can pay and eat without occupying the single adjacent tile: ${JSON.stringify({buyer:{position:queueServed.hosts[queueBuyer.id].position,goal:queueServed.hosts[queueBuyer.id].activeGoal},seller:{position:queueServed.hosts[queueSeller.id].position,stock:queueServed.hosts[queueSeller.id].marketStock}})}`);
console.log('V37 food supply: bakery wholesale, fish-stall and inn-kitchen production, paid meals, and save/load passed');
