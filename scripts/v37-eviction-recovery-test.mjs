import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const readJson = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
const mapFiles = (await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'));
const cardFiles = (await readdir(new URL('../rpg/characters/', import.meta.url))).filter(file => file.endsWith('.json'));
const [maps, hostCards] = await Promise.all([
  Promise.all(mapFiles.map(file => readJson(`../rpg/maps/${file}`))).then(records => Object.fromEntries(records.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.map(file => readJson(`../rpg/characters/${file}`))),
]);

let state = game.createInitialState({ maps, hostCards, startMapId: 'courtyard' });
state.world.clockMinutes = 1375;
let tenant = state.hosts.tenant_mikhail;
const landlord = state.hosts.landlady_polina;
tenant.mapId = landlord.mapId = 'courtyard';
tenant.position = { x: 5, y: 4 };
landlord.position = { x: 20, y: 13 };
state.player.position = { x: 11, y: 13 };
tenant.money.amount = 0;
tenant.housing.nextDueDayIndex = 0;
const pausedHostIds = Object.keys(state.hosts);
state = game.advanceNpcWorld(state, 1445, maps, { pausedHostIds });
tenant = state.hosts.tenant_mikhail;

assert.equal(tenant.housing.evictionStatus, 'EVICTED', 'two missed rent dates remove the fictional tenant from the room');
assert.equal(tenant.places.homeLocation, null, 'an evicted resident no longer retains an active home location');
assert.equal(tenant.places.homeLocationStatus, 'FICTIONAL_EVICTION_DESIGN');
assert.equal(tenant.housing.arrears, 6, 'the unpaid amount remains on the contract');
assert.equal(state.world.livingEventStates.E01.stage, 'EVICTED', 'eviction is recorded as a persistent E01 consequence');
const streetSleep = tenant.schedule.find(slot => slot.routineKind === 'FICTIONAL_HOME_SLEEP');
assert.equal(streetSleep.mapId, 'courtyard', 'the evicted resident receives an authored temporary outdoor sleeping routine');
assert.equal(streetSleep.activityKo, '안뜰 바깥에서 잠을 청한다');

const evictionSave = game.saveGame(state);
const restored = game.loadGame(evictionSave, { maps, hostCards });
assert.equal(game.stateHash(restored), game.stateHash(state), 'eviction and temporary housing survive save/load');

restored.player.position = { ...restored.hosts.tenant_mikhail.position };
const possessed = game.possessHost(restored, tenant.id, maps.courtyard);
assert.equal(possessed.ok, true);
state = possessed.state;
state.hosts.tenant_mikhail.position = { x: 20, y: 12 };
state.hosts.landlady_polina.position = { x: 20, y: 13 };
state.player.position = { x: 20, y: 12 };
state.hosts.tenant_mikhail.money.amount = 20;
const recovery = game.payRent(state, { tenantHostId: 'tenant_mikhail' }, maps);
assert.equal(recovery.ok, true, `the tenant can clear arrears and recover the room (${recovery.reason ?? ''})`);
assert.equal(recovery.paidAmount, 6, 'recovery clears the accumulated arrears');
assert.equal(recovery.state.hosts.tenant_mikhail.housing.evictionStatus, 'HOUSED');
assert.ok(recovery.state.hosts.tenant_mikhail.places.homeLocation, 'full payment restores the former room');
assert.equal(recovery.state.hosts.tenant_mikhail.places.homeLocationStatus, 'AUTHORED_HOUSING_RECORD');
assert.equal(recovery.state.hosts.tenant_mikhail.schedule.find(slot => slot.routineKind === 'FICTIONAL_HOME_SLEEP').position.y,
  hostCards.find(card => card.id === 'tenant_mikhail').housing.position.y);
assert.equal(recovery.state.world.livingEventStates.E01.stage, 'SETTLED');
assert.equal(game.stateHash(game.loadGame(game.saveGame(recovery.state), { maps, hostCards })), game.stateHash(recovery.state),
  'recovered housing survives save/load');

console.log(JSON.stringify({ status: 'PASS', missedRentPeriods: 2, arrearsBeforeRecovery: 6,
  evictionAffectsHomeAndSleep: true, rentAndHousingRecovery: 'PASS', saveLoadParity: true }, null, 2));
