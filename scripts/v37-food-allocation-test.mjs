import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async url => JSON.parse(await readFile(url, 'utf8'));
const mapsDir = new URL('../rpg/maps/', import.meta.url);
const cardsDir = new URL('../rpg/characters/', import.meta.url);
const [maps, cards] = await Promise.all([
  readdir(mapsDir).then(files => Promise.all(files.filter(name => name.endsWith('.json'))
    .map(name => read(new URL(name, mapsDir)))).then(rows => Object.fromEntries(rows.map(row => [row.mapId, row])))),
  readdir(cardsDir).then(files => Promise.all(files.filter(name => name.endsWith('.json'))
    .map(name => read(new URL(name, cardsDir))))),
]);

const state = game.createInitialState({ maps, hostCards: cards, startMapId: 'nevsky' });
state.world.clockMinutes = 600;
state.world.currentMapId = 'nevsky';
for (const host of Object.values(state.hosts)) host.historicalAliveAndPresent = false;

const sellers = [
  { id: 'market_nadezhda', item: '빵 한 묶음', stock: 1 },
  { id: 'fishseller_klavdiya', item: '생선 한 점', stock: 1 },
];
for (const { id, item, stock } of sellers) {
  const seller = state.hosts[id];
  seller.historicalAliveAndPresent = true;
  seller.mapId = 'market-quay';
  seller.position = { x: id === 'market_nadezhda' ? 14 : 26, y: 12 };
  seller.marketStock[item] = stock;
  seller.schedule = [{ atMinute: 600, mapId: seller.mapId, position: { ...seller.position }, activityKo: '좌판을 지킨다' }];
}

const buyers = ['student_vasily', 'courier_pavel', 'street_vendor_matryona'];
for (const id of buyers) {
  const buyer = state.hosts[id];
  buyer.historicalAliveAndPresent = true;
  buyer.mapId = 'nevsky';
  buyer.position = { x: 20, y: 9 };
  buyer.money.amount = 8;
  buyer.needs.hunger = 82;
  buyer.needs.lastMealAtMinute = 0;
  buyer.activeGoal = null;
  buyer.schedule = [{ atMinute: 600, mapId: 'nevsky', position: { ...buyer.position }, activityKo: '먹을 곳을 찾는다' }];
}

const planned = game.advanceNpcWorld(state, 1, maps);
const assignments = buyers.map(id => ({ id, seller: planned.hosts[id].activeGoal?.targetHostId,
  goal: planned.hosts[id].activeGoal?.type }));
const bySeller = Object.fromEntries(sellers.map(({ id }) => [id, assignments.filter(row => row.seller === id).length]));
assert.ok(Object.values(bySeller).every((count, index) => count <= sellers[index].stock),
  `autonomous meal routes must reserve available portions instead of sending a crowd to the same scarce stock: ${JSON.stringify({ bySeller, assignments })}`);
assert.ok(assignments.filter(row => row.goal === 'PURCHASE_MEAL').length <= 2,
  `only two of three buyers can claim the two available portions: ${JSON.stringify(assignments)}`);

const restored = game.loadGame(game.saveGame(planned), { maps, hostCards: cards });
assert.deepEqual(buyers.map(id => restored.hosts[id].activeGoal?.targetHostId),
  buyers.map(id => planned.hosts[id].activeGoal?.targetHostId), 'seller allocations and active meal routes survive save/load');
for (const { id, item } of sellers) assert.equal(restored.hosts[id].marketStock[item], planned.hosts[id].marketStock[item]);

const sleepWindow = game.createInitialState({ maps, hostCards: cards, startMapId: 'nevsky' });
sleepWindow.world.clockMinutes = 1106;
sleepWindow.world.currentMapId = 'nevsky';
for (const host of Object.values(sleepWindow.hosts)) host.historicalAliveAndPresent = false;
const lateBuyer = sleepWindow.hosts.street_vendor_matryona;
lateBuyer.historicalAliveAndPresent = true;
lateBuyer.mapId = 'nevsky';
lateBuyer.position = { x: 20, y: 9 };
lateBuyer.money.amount = 8;
lateBuyer.needs.hunger = 60;
lateBuyer.activeGoal = null;
lateBuyer.schedule = [
  { atMinute: 1106, mapId: 'nevsky', position: { ...lateBuyer.position }, activityKo: '저녁 손님을 기다린다' },
  { atMinute: 1250, mapId: 'courtyard', position: { x: 15, y: 12 }, activityKo: '거처에서 잠을 잔다', routineKind: 'FICTIONAL_HOME_SLEEP' },
];
const lateSeller = sleepWindow.hosts.market_nadezhda;
lateSeller.historicalAliveAndPresent = true;
lateSeller.mapId = 'market-quay';
lateSeller.position = { x: 14, y: 12 };
lateSeller.marketStock['빵 한 묶음'] = 5;
lateSeller.schedule = [{ atMinute: 1106, mapId: 'market-quay', position: { ...lateSeller.position }, activityKo: '저녁 장사를 이어 간다' }];
const lateRoute = game.advanceNpcWorld(sleepWindow, 1, maps);
assert.notEqual(lateRoute.hosts[lateBuyer.id].activeGoal?.type, 'PURCHASE_MEAL',
  'a non-critical resident must not start a cross-district meal trip that cannot be completed with the return home before the authored sleep time');

console.log('V37 food allocation: scarce market stock is reserved once per autonomous buyer and survives save/load.');
