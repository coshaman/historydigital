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
state.world.clockMinutes = 840;
for (const host of Object.values(state.hosts)) host.historicalAliveAndPresent = false;
const porter = state.hosts.porter_gavrila, marketSeller = state.hosts.market_nadezhda;
porter.historicalAliveAndPresent = marketSeller.historicalAliveAndPresent = true;
marketSeller.money.amount = 32;
const result = game.advanceNpcWorld(state, 180, maps);
const rows = result.ledger.filter(row => row.eventType === 'NPC_SIMULATION');
const work = rows.flatMap(row => row.workOutputs ?? []).find(row => row.hostId === porter.id
  && row.actionId === 'V36_PORTER_TRANSFER_FLOUR_SACKS');
const payment = rows.flatMap(row => row.payments ?? []).find(row => row.hostId === porter.id
  && row.payerHostId === marketSeller.id && row.actionId === 'V36_PORTER_TRANSFER_FLOUR_SACKS');

assert.ok(work, 'Gavrila completes his scheduled flour transfer at the bakery');
assert.ok(payment, 'Nadezhda pays the porter for the delivered flour under their authored work contract');
assert.equal(payment.amount, 1);
assert.equal(result.hosts.porter_gavrila.money.amount, 17);
assert.equal(result.hosts.market_nadezhda.money.amount, 31);
assert.equal(payment.valueStatus, 'fictional_gameplay_balance');
assert.equal(payment.mapId, 'bakery-interior');
assert.equal(payment.counterpartyMapId, payment.mapId);
assert.ok(Math.abs(payment.position.x - payment.counterpartyPosition.x)
  + Math.abs(payment.position.y - payment.counterpartyPosition.y) <= 1, 'the transfer requires physical adjacency');
assert.equal(game.stateHash(game.loadGame(game.saveGame(result), { maps, hostCards })), game.stateHash(result));
console.log('V37 porter wage: scheduled flour delivery creates a due claim and transfers the seller’s money at close range.');
