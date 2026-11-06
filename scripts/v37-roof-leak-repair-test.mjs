import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const mapNames = await readdir(new URL('../rpg/maps/', import.meta.url));
const cardNames = await readdir(new URL('../rpg/characters/', import.meta.url));
const [maps, cards, rentQuest, repairQuest] = await Promise.all([
  Promise.all(mapNames.filter(name => name.endsWith('.json')).map(name => read(`../rpg/maps/${name}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardNames.filter(name => name.endsWith('.json')).map(name => read(`../rpg/characters/${name}`))),
  read('../rpg/quests/rent-notice-1847.json'), read('../rpg/quests/roof-leak-repair-1847.json'),
]);
const object = maps.courtyard.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === 1185);
assert.ok(object, 'the repair decision is a physical courtyard interaction');

function setup() {
  const state = game.createInitialState({ maps, hostCards: cards, quests: [rentQuest, repairQuest], startMapId: 'courtyard' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 700;
  state.world.livingEventStates.E26 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E26',
    status: 'ACTIVE', stage: 'NOTICE_POSTED', sourceEventId: 'E02', startedAtMinute: 700, closesAtMinute: 880,
    actorHostIds: ['tenant_mikhail', 'landlady_polina'], tenantHostId: 'tenant_mikhail', landlordHostId: 'landlady_polina',
    venueMapId: 'courtyard', scenePosition: { x: 12, y: 7 }, previousRent: 3, proposedRent: 4,
    valueStatus: 'fictional_gameplay_balance', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
  for (const [id, x] of [['tenant_mikhail', 11], ['landlady_polina', 13]]) {
    state.hosts[id].mapId = 'courtyard'; state.hosts[id].position = { x, y: 7 };
    state.hosts[id].schedule = [{ atMinute: 0, mapId: 'courtyard', position: { x, y: 7 }, activityKo: '잠시 대화 중' }];
  }
  state.player.position = { x: 11, y: 7 }; state.player.embodiment = 'tenant_mikhail';
  return state;
}
function openRepair(state) {
  const rent = game.performQuestAction(state, { questId: rentQuest.id, hostId: 'tenant_mikhail',
    actionId: 'E26_KEEP_OLD_RENT', objectId: 1175 }, { quests: [rentQuest, repairQuest], maps });
  assert.equal(rent.ok, true, `rent decision opens the next household problem: ${rent.reason ?? ''}`);
  const opened = rent.state;
  assert.equal(opened.world.livingEventStates.E35.stage, 'REPAIR_OPTIONS_OPEN');
  assert.equal(objectIsPresent(object, opened, [repairQuest]), true);
  assert.deepEqual(questChoices(repairQuest, 'landlady_polina', [], opened).map(row => row.action.id),
    ['E35_OWNER_PAYS_REPAIR', 'E35_SPLIT_REPAIR_COST']);
  return opened;
}
function choose(state, actionId, hostId = 'landlady_polina') {
  const target = object;
  state.player.embodiment = hostId;
  state.player.position = { x: 11, y: 7 };
  for (const [id, x] of [['tenant_mikhail', 10], ['landlady_polina', 11]]) {
    state.hosts[id].mapId = 'courtyard'; state.hosts[id].position = { x, y: 7 };
  }
  const result = game.performQuestAction(state, { questId: repairQuest.id, hostId, actionId, objectId: target.id },
    { quests: [rentQuest, repairQuest], maps });
  assert.equal(result.ok, true, `${actionId} resolves: ${result.reason ?? ''}`);
  return result.state;
}

const ownerPaid = choose(openRepair(setup()), 'E35_OWNER_PAYS_REPAIR');
assert.equal(ownerPaid.hosts.landlady_polina.money.amount, 5);
assert.equal(ownerPaid.hosts.tenant_mikhail.money.amount, 9);
assert.equal(ownerPaid.hosts.tenant_mikhail.housing.repairStatus, 'ROOF_REPAIRED');
assert.equal(ownerPaid.world.livingEventStates.E35.repairStatus, 'REPAIRED');
const split = choose(openRepair(setup()), 'E35_SPLIT_REPAIR_COST');
assert.equal(split.hosts.landlady_polina.money.amount, 7);
assert.equal(split.hosts.tenant_mikhail.money.amount, 7);
assert.equal(split.world.livingEventStates.E35.stage, 'COST_SHARED');
const delayed = choose(openRepair(setup()), 'E35_DELAY_REPAIR', 'tenant_mikhail');
assert.equal(delayed.world.livingEventStates.E35.repairStatus, 'LEAKING');
assert.equal(delayed.hosts.tenant_mikhail.money.amount, 9);
const restored = game.loadGame(game.saveGame(ownerPaid), { maps, hostCards: cards, quests: [rentQuest, repairQuest] });
assert.equal(restored.hosts.landlady_polina.money.amount, 5, 'repair costs persist through save/load');
assert.equal(restored.world.livingEventStates.E35.stage, 'OWNER_PAID');
const unattended = game.advanceNpcWorld(openRepair(setup()), 245, maps);
assert.equal(unattended.world.livingEventStates.E35.stage, 'REPAIR_POSTPONED');
assert.equal(unattended.world.livingEventStates.E35.repairStatus, 'LEAKING');
console.log('V37 E35 roof repair: follows rent decision, reveals physical choices, applies money and housing effects, saves outcomes, and resolves unattended passed');
