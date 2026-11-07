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
const [maps, hostCards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(row => [row.mapId, row]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);

const state = game.createInitialState({ maps, hostCards, startMapId: 'market-quay' });
state.world.date = '1847-06-01';
state.world.clockMinutes = 720;
for (const host of Object.values(state.hosts)) host.historicalAliveAndPresent = false;
const worker = state.hosts.carter_roman, payer = state.hosts.warehouse_pyotr;
worker.historicalAliveAndPresent = payer.historicalAliveAndPresent = true;
worker.money.amount = 12;
payer.money.amount = 20;

const result = game.advanceNpcWorld(state, 360, maps);
const rows = result.ledger.filter(row => row.eventType === 'NPC_SIMULATION');
const taskId = 'V36_CARTER_QUAY_FREIGHT_TALLY';
const work = rows.flatMap(row => row.workOutputs ?? []).find(row => row.hostId === worker.id && row.actionId === taskId);
const payment = rows.flatMap(row => row.payments ?? []).find(row => row.hostId === worker.id
  && row.payerHostId === payer.id && row.actionId === taskId);

assert.ok(work, 'Roman completes the scheduled quay freight tally');
assert.ok(payment, 'the warehouse clerk settles the authored freight wage in the city simulation');
assert.equal(payment.amount, 2);
assert.equal(payment.valueStatus, 'fictional_gameplay_balance');
assert.equal(result.hosts.carter_roman.money.amount, 14);
assert.equal(result.hosts.warehouse_pyotr.money.amount, 18);
assert.equal(payment.mapId, 'market-quay');
assert.equal(payment.counterpartyMapId, 'market-quay');
assert.ok(Math.abs(payment.position.x - payment.counterpartyPosition.x)
  + Math.abs(payment.position.y - payment.counterpartyPosition.y) <= 1, 'wages require a face-to-face handoff');
assert.equal(game.stateHash(game.loadGame(game.saveGame(result), { maps, hostCards })), game.stateHash(result));

const householdWork = game.createInitialState({ maps, hostCards, startMapId: 'courtyard' });
householdWork.world.date = '1847-06-01';
householdWork.world.clockMinutes = 360;
for (const host of Object.values(householdWork.hosts)) host.historicalAliveAndPresent = false;
const maid = householdWork.hosts.housemaid_olga, employer = householdWork.hosts.landlady_polina;
maid.historicalAliveAndPresent = employer.historicalAliveAndPresent = true;
maid.money.amount = 14;
employer.money.amount = 9;
const paidHouseholdWork = game.advanceNpcWorld(householdWork, 360, maps);
const householdRows = paidHouseholdWork.ledger.filter(row => row.eventType === 'NPC_SIMULATION');
const householdTaskId = 'V36_HOUSEMAID_PREPARE_WATER';
const householdPayment = householdRows.flatMap(row => row.payments ?? []).find(row => row.hostId === maid.id
  && row.payerHostId === employer.id && row.actionId === householdTaskId);
assert.ok(householdRows.flatMap(row => row.workOutputs ?? []).some(row => row.hostId === maid.id && row.actionId === householdTaskId),
  'Olga completes her scheduled household shift');
assert.ok(householdPayment, 'the landlady settles the maid’s in-world household wage');
assert.equal(householdPayment.valueStatus, 'fictional_gameplay_balance');
assert.equal(householdPayment.mapId, 'courtyard');
assert.equal(game.stateHash(game.loadGame(game.saveGame(paidHouseholdWork), { maps, hostCards })), game.stateHash(paidHouseholdWork));
console.log('V37 routed wages: freight and household work create due claims, route workers to named payers, and persist face-to-face settlements.');
