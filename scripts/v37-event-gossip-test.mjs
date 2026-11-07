import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { dialogueSceneContext } from '../rpg/engine/dialogue-context.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);

const state = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 599;
state.world.currentMapId = 'market-quay';
for (const host of Object.values(state.hosts)) host.historicalAliveAndPresent = false;
for (const [id, x] of [['market_nadezhda', 15], ['porter_gavrila', 16], ['police_sergeant_ivan', 17], ['tenant_mikhail', 18]]) {
  const host = state.hosts[id]; host.historicalAliveAndPresent = true; host.mapId = 'market-quay';
  host.position = { x, y: 12 }; host.schedule = [{ atMinute: 0, mapId: 'market-quay', position: { ...host.position }, activityKo: '잠시 멈춰 있다' }];
}
state.hosts.market_nadezhda.money.amount = 10;
state.hosts.tenant_mikhail.needs.incomePressure = 0;
const witnessed = game.advanceNpcWorld(state, 122, maps, { pausedHostIds: ['market_nadezhda', 'porter_gavrila', 'police_sergeant_ivan'] });
const seller = witnessed.hosts.market_nadezhda, witness = witnessed.hosts.porter_gavrila;
const report = witness.heardEventReports?.find(item => item.catalogEventId === 'E36' && item.stage === 'LOSS_NOTICED');
assert.ok(report, `a person at the scene remembers what they actually witnessed: ${JSON.stringify({ clock: witnessed.world.clockMinutes, E32: witnessed.world.livingEventStates.E32, event: witnessed.world.livingEventStates.E36, rows: witnessed.ledger.flatMap(row => row.livingEvents ?? []).filter(row => row.catalogEventId === 'E36'), actors: ['market_nadezhda','porter_gavrila','police_sergeant_ivan','tenant_mikhail'].map(id => ({id,map:witnessed.hosts[id].mapId,present:witnessed.hosts[id].historicalAliveAndPresent,allowed:witnessed.hosts[id].allowedMaps.includes('market-quay')})) })}`);
assert.deepEqual(report.sourceIds, ['CAT-RSL-BAZAAR-WARDENS-1842', 'OBJ-PRLIB-STPETE-THEFT-CASES-1843-44']);
assert.deepEqual(dialogueSceneContext(cards.find(card => card.id === witness.id), witness,
  witnessed.world.date, witness.mapId).heardEvents?.find(item => item.catalogEventId === 'E36')?.sourceIds, report.sourceIds,
  'dialogue context receives only the embodied resident’s source-linked knowledge');
assert.equal(dialogueSceneContext(cards.find(card => card.id === witness.id), witness,
  witnessed.world.date, witness.mapId).heardEvents?.find(item => item.catalogEventId === 'E36')?.occurrenceType,
  'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', 'dialogue receives the event’s actual provenance class');

const gossip = structuredClone(witnessed);
gossip.world.livingEventStates.E36.status = 'RESOLVED';
gossip.world.livingEventStates.E36.stage = 'LOSS_UNREPORTED';
for (const host of Object.values(gossip.hosts)) host.historicalAliveAndPresent = false;
const speaker = gossip.hosts.porter_gavrila, listener = gossip.hosts.seamstress_anna;
speaker.heardEventReports = speaker.heardEventReports.filter(item => item.catalogEventId === 'E36');
for (const host of [speaker, listener]) {
  host.historicalAliveAndPresent = true; host.mapId = 'courtyard';
  host.position = host.id === speaker.id ? { x: 12, y: 12 } : { x: 13, y: 12 };
  host.schedule = [{ atMinute: 0, mapId: 'courtyard', position: { ...host.position }, activityKo: '안뜰에서 이웃을 만난다' }];
  host.needs.socialNeed = 100;
}
speaker.personalGoals = [{ id: 'TEST_SHARE_WITNESSED_REPORT', kind: 'RELATIONSHIP',
  successCondition: { targetHostId: listener.id, autonomyNeedThreshold: 20 } }];
speaker.personalGoalProgress = {};
const met = game.advanceNpcWorld(gossip, 1, maps);
const shared = met.hosts.seamstress_anna.heardEventReports?.find(item => item.catalogEventId === 'E36');
assert.ok(shared, `an in-person conversation can carry a witnessed event to a relationship: ${JSON.stringify({ contacts: met.ledger.flatMap(row => row.personalContacts ?? []).slice(-5), goal: met.hosts.porter_gavrila.activeGoal, reports: met.hosts.porter_gavrila.heardEventReports })}`);
assert.equal(shared.knowledgeKind, 'HEARD_FROM_PERSON');
assert.equal(shared.fromHostId, speaker.id);
assert.equal(met.hosts.clerk_alexei.heardEventReports?.some(item => item.catalogEventId === 'E36') ?? false, false,
  'people who neither witnessed the incident nor spoke with its witness do not learn it');
assert.ok(met.ledger.flatMap(row => row.personalContacts ?? []).some(item => item.sharedReport?.catalogEventId === 'E36'),
  'the transfer is auditable on the real NPC contact record');
const restored = game.loadGame(game.saveGame(met), { maps, hostCards: cards });
assert.deepEqual(restored.hosts.seamstress_anna.heardEventReports, met.hosts.seamstress_anna.heardEventReports);
assert.ok(restored.world.eventKnowledgeLog.some(item => item.hostId === 'seamstress_anna' && item.reportId === shared.reportId),
  'the audited conversation transfer survives save/load');
console.log('V37 event gossip: scene witnesses retain source-linked knowledge; in-person NPC contact shares only that knowledge and saves exactly');
