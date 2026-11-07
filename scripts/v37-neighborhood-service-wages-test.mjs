import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
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

const contracts = [
  { workerId: 'laundress_mariya', actionId: 'V36_LAUNDRESS_WASH_LINEN', payerId: 'baker_fyodor', amount: 1 },
  { workerId: 'watercarrier_luka', actionId: 'V36_WATERCARRIER_FILL_PAIL', payerId: 'landlady_polina', amount: 1 },
  { workerId: 'yardkeeper_semyon', actionId: 'V36_YARDKEEPER_OPEN_AND_COUNT_WOOD', payerId: 'landlady_polina', amount: 1 },
];

for (const contract of contracts) {
  const workerCard = cards.find(card => card.id === contract.workerId);
  const action = workerCard.schedule.flatMap(slot => slot.workAction ? [slot.workAction] : []).find(row => row.id === contract.actionId);
  assert.deepEqual(action?.payroll, { payerHostId: contract.payerId, amount: contract.amount,
    unit: 'kopeks', valueStatus: 'fictional_gameplay_balance' }, `${contract.workerId} has an authored recurring service contract`);

  const state = game.createInitialState({ maps, hostCards: cards, startMapId: 'courtyard' });
  state.world.date = '1847-06-01'; state.world.clockMinutes = 0; state.world.currentMapId = 'courtyard';
  for (const host of Object.values(state.hosts)) host.historicalAliveAndPresent = false;
  const worker = state.hosts[contract.workerId], payer = state.hosts[contract.payerId];
  assert.ok(worker.relations[payer.id], `${worker.id} has an authored relationship with the payer`);
  worker.historicalAliveAndPresent = payer.historicalAliveAndPresent = true;
  worker.mapId = payer.mapId = 'courtyard'; worker.position = { x: 10, y: 12 }; payer.position = { x: 11, y: 12 };
  worker.schedule = [{ atMinute: 0, mapId: 'courtyard', position: { ...worker.position }, activityKo: '맡은 일을 한다', workAction: action }];
  payer.schedule = [{ atMinute: 0, mapId: 'courtyard', position: { ...payer.position }, activityKo: '일감을 정산한다' }];
  state.player.position = { x: 2, y: 2 };

  const result = game.advanceNpcWorld(state, 25, maps);
  const rows = result.ledger.filter(row => row.eventType === 'NPC_SIMULATION');
  assert.ok(rows.flatMap(row => row.workOutputs ?? []).some(row => row.hostId === worker.id && row.actionId === contract.actionId),
    `${contract.workerId} completes the scheduled work`);
  const payment = rows.flatMap(row => row.payments ?? []).find(row => row.hostId === worker.id && row.payerHostId === payer.id
    && row.actionId === contract.actionId);
  assert.equal(payment?.amount, contract.amount, `${contract.workerId} receives the agreed service wage`);
  assert.equal(result.hosts[payer.id].money.amount, payer.money.amount - contract.amount);
  assert.equal(result.hosts[worker.id].money.amount, worker.money.amount + contract.amount);
  assert.equal(payment.mapId, 'courtyard');
  assert.ok(Math.abs(payment.position.x - payment.counterpartyPosition.x)
    + Math.abs(payment.position.y - payment.counterpartyPosition.y) <= 1, 'the wage is exchanged face to face');
  const restored = game.loadGame(game.saveGame(result), { maps, hostCards: cards });
  assert.equal(restored.hosts[worker.id].money.amount, result.hosts[worker.id].money.amount, 'the worker balance persists');
  assert.equal(restored.hosts[worker.id].pendingWageClaims.find(row => row.actionId === contract.actionId)?.status, 'PAID');
  assert.ok(restored.ledger.some(row => row.payments?.some(item => item.claimId === payment.claimId)), 'the named payment persists');
}

console.log('V37 neighborhood service wages: laundry, water delivery, and courtyard woodwork move real kopeks between nearby residents and persist through save/load');
