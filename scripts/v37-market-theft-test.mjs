import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async url => JSON.parse(await readFile(url, 'utf8'));
const [mapFiles, cardFiles, quest, packet, catalog, sourceRegister] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read(new URL('../rpg/quests/market-theft-1847.json', import.meta.url)),
  read(new URL('../rpg/data/historical-source-packets.json', import.meta.url)),
  read(new URL('../data/event_catalog_45.json', import.meta.url)), read(new URL('../rpg/data/source-register.json', import.meta.url)),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/maps/${file}`, import.meta.url))))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/characters/${file}`, import.meta.url)))),
]);
const eventId = 'E36', questId = 'V37_MARKET_THEFT_1847';
const sourceIds = ['CAT-RSL-BAZAAR-WARDENS-1842', 'OBJ-PRLIB-STPETE-THEFT-CASES-1843-44'];
assert.equal(catalog.find(row => row.event_id === eventId)?.title, '장터 도난');
assert.deepEqual(quest.sourceIds, sourceIds);
assert.ok(sourceIds.every(id => sourceRegister.sources.some(row => row.sourceId === id)));
assert.ok(sourceIds.every(id => packet.records.some(row => row.sourceId === id)));

function setup() {
  const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 599;
  state.world.currentMapId = 'market-quay'; state.player.embodiment = 'market_nadezhda';
  state.player.position = { x: 15, y: 12 };
  for (const host of Object.values(state.hosts)) host.historicalAliveAndPresent = false;
  for (const [id, x] of [['market_nadezhda', 15], ['porter_gavrila', 16], ['police_sergeant_ivan', 17], ['tenant_mikhail', 18]]) {
    const host = state.hosts[id]; host.historicalAliveAndPresent = true; host.mapId = 'market-quay';
    host.position = { x, y: 12 }; host.schedule = [{ atMinute: 0, mapId: 'market-quay', position: { ...host.position }, activityKo: '잠시 멈춰 있다' }];
    host.activeGoal = null;
  }
  state.hosts.market_nadezhda.money.amount = 10; state.hosts.tenant_mikhail.money.amount = 20;
  state.hosts.tenant_mikhail.needs.incomePressure = 0;
  return state;
}
function open(state = setup()) {
  const active = game.advanceNpcWorld(state, 1, maps, { pausedHostIds: ['market_nadezhda', 'porter_gavrila', 'police_sergeant_ivan'] });
  assert.equal(active.world.livingEventStates.E36?.status, 'ACTIVE', JSON.stringify({ date: active.world.date, chapter: active.world.chapterId, clock: active.world.clockMinutes,
    E32: active.world.livingEventStates.E32, hosts: ['market_nadezhda','porter_gavrila','police_sergeant_ivan','tenant_mikhail'].map(id => [id, active.hosts[id].mapId, active.hosts[id].historicalAliveAndPresent, active.hosts[id].allowedMaps.includes('market-quay')]) }));
  assert.equal(active.world.livingEventStates.E36.stage, 'WITNESS_READY');
  assert.equal(active.world.livingEventStates.E36.unidentifiedLoss.amount, 2);
  assert.equal(active.hosts.market_nadezhda.money.amount, state.hosts.market_nadezhda.money.amount - 2);
  const target = maps['market-quay'].layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
  assert.ok(target); assert.equal(objectIsPresent(target, active, [quest]), true);
  assert.deepEqual(active.world.livingEventStates.E36.sourceIds, sourceIds);
  assert.deepEqual(questChoices(quest, 'market_nadezhda', [], active).map(row => row.action.id), ['E36_FILE_REPORT', 'E36_LEAVE_UNREPORTED']);
  assert.deepEqual(questChoices(quest, 'police_sergeant_ivan', [], active).map(row => row.action.id), ['E36_REGISTER_LOSS']);
  return { active, target };
}
for (const [actionId, hostId, stage, expectedReport, transfer] of [
  ['E36_FILE_REPORT', 'market_nadezhda', 'FORMAL_REPORT_FILED', true, 0],
  ['E36_REGISTER_LOSS', 'police_sergeant_ivan', 'FORMAL_REPORT_FILED', true, 0],
  ['E36_PRIVATE_WITNESS_NOTE', 'porter_gavrila', 'PRIVATE_WITNESS_NOTE', false, 0],
  ['E36_REPAY_MISSING_CASH', 'tenant_mikhail', 'LOSS_REPAID_BY_NEIGHBOR', false, 2],
  ['E36_LEAVE_UNREPORTED', 'market_nadezhda', 'LOSS_UNREPORTED', false, 0],
]) {
  const { active, target } = open(); active.player.embodiment = hostId;
  if (hostId === 'tenant_mikhail') active.hosts.tenant_mikhail.position = { x: 17, y: 12 };
  active.player.position = { ...active.hosts[hostId].position };
  const before = active.hosts.tenant_mikhail.money.amount;
  const result = game.performQuestAction(active, { questId, hostId, actionId, objectId: target.id }, { quests: [quest], maps });
  assert.equal(result.ok, true, `${actionId}: ${result.reason ?? ''}`);
  const event = result.state.world.livingEventStates.E36;
  assert.equal(event.stage, stage); assert.equal(Boolean(result.state.world.marketTheftRecords?.some(row => row.eventId === 'E36')), expectedReport);
  assert.equal(result.state.hosts.tenant_mikhail.money.amount, before - transfer);
  if (['E36_FILE_REPORT', 'E36_REGISTER_LOSS'].includes(actionId)) {
    assert.equal(result.state.world.marketTheftRecords.at(-1).suspectHostId, null, 'no resident is accused without identifying evidence');
    assert.equal(result.state.hosts.police_sergeant_ivan.mapId, 'market-quay');
  }
  const restored = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [quest] });
  assert.deepEqual(restored.world.livingEventStates.E36, result.state.world.livingEventStates.E36);
  assert.deepEqual(restored.world.marketTheftRecords ?? [], result.state.world.marketTheftRecords ?? []);
  assert.equal(restored.hosts.market_nadezhda.money.amount, result.state.hosts.market_nadezhda.money.amount);
  assert.equal(restored.hosts.tenant_mikhail.money.amount, result.state.hosts.tenant_mikhail.money.amount);
}
const { active } = open();
const unattended = game.advanceNpcWorld(active, 181, maps, { pausedHostIds: ['market_nadezhda', 'porter_gavrila', 'police_sergeant_ivan'] });
assert.equal(unattended.world.livingEventStates.E36.stage, 'LOSS_UNREPORTED');
assert.equal(unattended.world.marketTheftRecords?.length ?? 0, 0);
console.log('V37 E36 market loss, witness and police response, cash transfer, no false accusation, unattended outcome and save/load passed');
