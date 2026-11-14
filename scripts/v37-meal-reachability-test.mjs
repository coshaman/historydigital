import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const [mapFiles, cardFiles] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);

const state = game.createInitialState({ maps, hostCards: cards, startMapId: 'courtyard' });
state.world.clockMinutes = 1163;
state.world.currentMapId = 'courtyard';
const buyer = state.hosts.lodging_tatyana;
buyer.mapId = 'nevsky'; buyer.position = { x: 11, y: 10 };
buyer.schedule = [{ atMinute: 0, mapId: 'nevsky', position: { x: 11, y: 10 }, activityKo: '일을 마치고 집으로 돌아갈 채비를 한다' }];
buyer.needs.hunger = 60.01; buyer.needs.lastMealAtMinute = 540; buyer.money.amount = 18;
buyer.activeGoal = null; buyer.plannedPath = null; buyer.mapRoutePlan = null;
const seller = state.hosts.market_nadezhda;
seller.mapId = 'market-quay'; seller.position = { x: 14, y: 12 };
seller.marketStock['빵 한 묶음'] = 16;
seller.schedule = [{ atMinute: 0, mapId: 'market-quay', position: { x: 14, y: 12 }, activityKo: '빵을 판다' }];
for (const id of ['innkeeper_irina', 'fishseller_klavdiya', 'baker_fyodor']) {
  state.hosts[id].historicalAliveAndPresent = false;
}
for (const host of Object.values(state.hosts)) {
  if (![buyer.id, seller.id].includes(host.id)) host.mapId = 'courtyard';
}

const advanced = game.advanceNpcWorld(state, 1, maps);
const goal = advanced.hosts.lodging_tatyana.activeGoal;
assert.notEqual(goal?.type === 'PURCHASE_MEAL' && goal.targetHostId === seller.id, true,
  `a worker must not start the 135-minute open-grid estimate with only 157 minutes left; the 30-minute arrival margin covers observed path variance: ${JSON.stringify(goal)}`);

const committedTripAfterClose = game.createInitialState({ maps, hostCards: cards, startMapId: 'nevsky' });
committedTripAfterClose.world.clockMinutes = 960;
for (const host of Object.values(committedTripAfterClose.hosts)) host.historicalAliveAndPresent = false;
const committedBuyer = committedTripAfterClose.hosts.typesetter_nikita;
const committedSeller = committedTripAfterClose.hosts.fishseller_klavdiya;
committedBuyer.historicalAliveAndPresent = true;
committedBuyer.mapId = 'nevsky'; committedBuyer.position = { x: 20, y: 9 };
committedBuyer.needs.hunger = 100; committedBuyer.needs.foodDeprivationMinutes = 1200;
committedBuyer.money.amount = 20;
committedBuyer.schedule = [{ atMinute: 960, mapId: 'nevsky', position: { ...committedBuyer.position }, activityKo: '일을 마치고 돌아간다' }];
committedBuyer.activeGoal = { type: 'PURCHASE_MEAL', taskId: `FOOD:${committedSeller.id}:생선 한 점`,
  targetHostId: committedSeller.id, targetMapId: 'market-quay', reason: 'committed_food_trip', selectedAtMinute: 840 };
committedSeller.historicalAliveAndPresent = true; committedSeller.mapId = 'market-quay';
committedSeller.position = { x: 26, y: 14 }; committedSeller.marketStock['생선 한 점'] = 4;
committedSeller.schedule = [{ atMinute: 960, mapId: 'market-quay', position: { ...committedSeller.position }, activityKo: '좌판을 닫는다' }];
const waitedForNextService = game.advanceNpcWorld(committedTripAfterClose, 1, maps);
assert.equal(waitedForNextService.hosts[committedBuyer.id].activeGoal?.type, 'PURCHASE_MEAL',
  'a resident already travelling to a food seller keeps the reserved trip when the counter closes for the day');
assert.equal(waitedForNextService.hosts[committedBuyer.id].activeGoal?.targetHostId, committedSeller.id,
  'the closed service window must not strand or redirect the committed buyer');
console.log('V37 meal reachability: avoids a meal route that cannot reach the open stall before closing.');
