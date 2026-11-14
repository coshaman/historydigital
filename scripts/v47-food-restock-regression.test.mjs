import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(row => [row.mapId, row]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);
const bakerCard = cards.find(card => card.id === 'baker_fyodor');
const dailyRestock = bakerCard.schedule.find(slot => slot.task?.id === 'BAKER_DAILY_MARKET_RESTOCK_1847')?.task;
assert.equal(dailyRestock?.requiresMarketStockAtMost, 4,
  'the bakery contract should replenish a nearly empty counter before it reaches zero');

const state = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
state.world.chapterId = 'V33_1848_PUBLIC';
state.world.date = '1848-06-16';
state.world.clockMinutes = 1050;
state.world.currentMapId = 'market-quay';
for (const host of Object.values(state.hosts)) host.historicalAliveAndPresent = false;
const baker = state.hosts.baker_fyodor, seller = state.hosts.market_nadezhda;
for (const [host, position] of [[baker, { x: 13, y: 12 }], [seller, { x: 14, y: 11 }]]) {
  host.historicalAliveAndPresent = true;
  host.mapId = 'market-quay';
  host.position = position;
  host.activeGoal = null;
}
baker.inventory = ['밀가루 자루', ...Array(18).fill('빵 한 묶음')];
baker.needs.hunger = 45;
baker.needs.fatigue = 20;
seller.marketStock = { '빵 한 묶음': 1 };
seller.money.amount = Math.max(100, seller.money.amount);
seller.needs.hunger = 0;
seller.needs.lastMealAtMinute = 1050;

let result = game.advanceNpcWorld(state, 15, maps);
for (let interval = 0; interval < 11; interval += 1) result = game.advanceNpcWorld(result, 15, maps);
const sale = result.ledger.flatMap(row => row.eventType === 'NPC_SIMULATION' ? row.exchanges ?? [] : [])
  .find(row => row.taskId === 'BAKER_DAILY_MARKET_RESTOCK_1847');
if (!sale) console.log(JSON.stringify({ baker: { mapId: result.hosts.baker_fyodor.mapId, position: result.hosts.baker_fyodor.position,
  inventory: result.hosts.baker_fyodor.inventory, goal: result.hosts.baker_fyodor.activeGoal, routine: result.hosts.baker_fyodor.routineState },
seller: { mapId: result.hosts.market_nadezhda.mapId, position: result.hosts.market_nadezhda.position, money: result.hosts.market_nadezhda.money,
  stock: result.hosts.market_nadezhda.marketStock, goal: result.hosts.market_nadezhda.activeGoal } }, null, 2));
assert.ok(sale, 'the evening restock contract must execute while the stockout window is open');
assert.equal(sale.quantity, 18, 'the whole daily baked batch reaches the market counter');
assert.equal(result.hosts.market_nadezhda.marketStock['빵 한 묶음'], 19,
  'residents receive the eighteen-unit delivery on top of the one loaf remaining');
console.log('V47 daily bakery restock regression: PASS');
