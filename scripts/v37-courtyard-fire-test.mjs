import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, fireQuest, coldQuest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/courtyard-fire-1847.json'), read('../rpg/quests/cold-wave-firewood-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);
const quests = [fireQuest, coldQuest];
const fireObject = maps.courtyard.layers.find(layer => layer.name === 'Interactions').objects.find(row => row.id === fireQuest.entry.objectId);
assert.ok(fireObject, 'fire scene uses a physical courtyard interaction');

function setup({ weather = 'wind', hasFirewood = true } = {}) {
  const state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'courtyard' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-01-01'; state.world.clockMinutes = 1110;
  state.player.embodiment = 'tenant_mikhail'; state.player.position = { x: 15, y: 11 };
  const tenant = state.hosts.tenant_mikhail;
  tenant.mapId = 'courtyard'; tenant.position = { x: 15, y: 11 };
  state.hosts.junior_guard_sergey.mapId = 'courtyard'; state.hosts.junior_guard_sergey.position = { x: 16, y: 11 };
  if (hasFirewood) tenant.inventory.push('장작 한 단');
  state.world.livingEventStates.E03 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E03',
    status: 'RESOLVED', stage: 'FIREWOOD_BOUGHT', resolutionActionId: 'E03_BUY_FIREWOOD', resolvedAtMinute: 1005,
    resolvedByHostId: 'tenant_mikhail', weather, actorHostIds: ['tenant_mikhail', 'landlady_polina', 'porter_gavrila'],
    tenantHostId: 'tenant_mikhail', landlordHostId: 'landlady_polina', startedAtMinute: 1000, resolvesAtMinute: 2440,
    trigger: 'winter_snow_or_wind', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED', valueStatus: 'fictional_gameplay_balance' };
  return state;
}

const wrongWeather = game.advanceNpcWorld(setup({ weather: 'snow' }), 1, maps);
assert.equal(wrongWeather.world.livingEventStates.E27, undefined, 'snow alone does not cause a fire');
const noFuel = game.advanceNpcWorld(setup({ hasFirewood: false }), 1, maps);
assert.equal(noFuel.world.livingEventStates.E27, undefined, 'no fire without the purchased fuel being carried home');

const active = game.advanceNpcWorld(setup(), 1, maps);
const event = active.world.livingEventStates.E27;
assert.equal(event.status, 'ACTIVE'); assert.equal(event.sourceEventId, 'E03');
assert.equal(event.sourceActionId, 'E03_BUY_FIREWOOD');
assert.equal(active.hosts.tenant_mikhail.inventory.includes('장작 한 단'), false, 'the firewood is consumed by its actual use');
assert.equal(objectIsPresent(fireObject, active, quests), true, 'the physical fire scene appears after its trigger');
assert.deepEqual(questChoices(fireQuest, 'tenant_mikhail', [], active).map(row => row.action.id),
  ['E27_EVACUATE_RESIDENTS', 'E27_RAISE_NEIGHBOR_ALARM', 'E27_REPORT_TO_WATCH']);

for (const [actionId, stage] of [['E27_EVACUATE_RESIDENTS', 'RESIDENTS_EVACUATED'],
  ['E27_RAISE_NEIGHBOR_ALARM', 'ALARM_RAISED'], ['E27_REPORT_TO_WATCH', 'FIRE_REPORTED_TO_WATCH']]) {
  const result = game.performQuestAction(active, { questId: fireQuest.id, hostId: 'tenant_mikhail', actionId,
    objectId: fireObject.id }, { quests, maps });
  assert.equal(result.ok, true, `${actionId} can be carried out (${result.reason ?? ''})`);
  assert.equal(result.state.world.livingEventStates.E27.stage, stage);
  assert.equal(result.state.world.livingEventStates.E27.propertyDamage, 0);
  const saved = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests });
  assert.equal(saved.world.livingEventStates.E27.stage, stage, `${actionId} persists across save/load`);
}

const ignored = game.advanceNpcWorld(active, 61, maps);
assert.equal(ignored.world.livingEventStates.E27.stage, 'DAMAGE_SPREAD');
assert.equal(ignored.world.livingEventStates.E27.propertyDamage, 1);
assert.ok(ignored.hosts.tenant_mikhail.needs.safetyConcern > active.hosts.tenant_mikhail.needs.safetyConcern);
assert.ok(ignored.ledger.flatMap(row => row.livingEvents ?? []).some(row => row.catalogEventId === 'E27' && row.stage === 'DAMAGE_SPREAD'));
console.log('V37 E27: conditional fire trigger, physical choices, saved outcomes, and unattended damage passed');
