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
const state = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
state.world.clockMinutes = 1200;
state.world.currentMapId = 'market-quay';
const resident = state.hosts.market_nadezhda;
resident.mapId = 'market-quay'; resident.position = { x: 12, y: 12 };
resident.needs.hunger = 100; resident.needs.foodDeprivationMinutes = 359;
state.player.embodiment = resident.id; state.player.position = { ...resident.position };
const pausedHostIds = Object.keys(state.hosts);

let next = game.advanceNpcWorld(state, 1, maps, { pausedHostIds });
assert.equal(next.hosts[resident.id].healthState.illness?.severity, 'MILD', 'six hours without food starts an illness');
assert.equal(next.hosts[resident.id].needs.foodDeprivationMinutes, 360);

next.hosts[resident.id].needs.foodDeprivationMinutes = 1439;
next.hosts[resident.id].needs.hunger = 100;
next = game.advanceNpcWorld(next, 1, maps, { pausedHostIds });
assert.equal(next.hosts[resident.id].healthState.illness?.severity, 'CRITICAL', 'a full day without food becomes critical');
assert.equal(next.hosts[resident.id].healthState.condition, 'UNWELL');
assert.equal(next.hosts[resident.id].lifeStatus, undefined, 'critical illness still leaves time for intervention');

next.hosts[resident.id].needs.foodDeprivationMinutes = 2879;
next.hosts[resident.id].needs.hunger = 100;
next = game.advanceNpcWorld(next, 1, maps, { pausedHostIds });
assert.equal(next.hosts[resident.id].lifeStatus, 'DECEASED', 'two days without food can kill a fictional resident');
assert.equal(next.hosts[resident.id].historicalAliveAndPresent, false);
assert.equal(next.hosts[resident.id].deathRecord.causeId, 'FOOD_DEPRIVATION');
assert.equal(next.world.deathRecords.filter(row => row.hostId === resident.id).length, 1);
assert.equal(next.player.embodiment, null, 'the player is released when their host dies');
assert.equal(next.world.possessionHistory.at(-1).reason, 'host_died_after_food_deprivation');
const restored = game.loadGame(game.saveGame(next), { maps, hostCards: cards });
assert.equal(game.stateHash(restored), game.stateHash(next), 'food fatality and release persist through save/load');

const protectedHistorical = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
const historical = protectedHistorical.hosts.dostoevsky_1849;
assert.equal(historical.kind, 'HISTORICAL_RECONSTRUCTION');
historical.needs.hunger = 100; historical.needs.foodDeprivationMinutes = 2879;
const historicalNext = game.advanceNpcWorld(protectedHistorical, 1, maps, { pausedHostIds: Object.keys(protectedHistorical.hosts) });
assert.equal(historicalNext.hosts[historical.id].needs.foodDeprivationMinutes, 2879, 'historical reconstructions do not enter fictional survival simulation');
assert.notEqual(historicalNext.hosts[historical.id].lifeStatus, 'DECEASED');

console.log('V37 survival mortality: illness progression, intervention window, fictional fatality, possession release, historical-person immunity, and save/load passed');
