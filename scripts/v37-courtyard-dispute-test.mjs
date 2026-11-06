import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { resolveQuestGuidance } from '../rpg/engine/quest-guidance.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest, catalog] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  json('../rpg/quests/courtyard-dispute-1847.json'), json('../data/event_catalog_45.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/maps/${file}`)))
    .then(records => Object.fromEntries(records.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/characters/${file}`))),
]);
const map = maps.courtyard;
const object = map.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
assert.ok(object, 'the courtyard incident has an in-world ledger object');
assert.equal(catalog.find(row => row.event_id === 'E09').validation_status, 'DESIGN_SEED_NOT_VERIFIED');

const start = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'courtyard' });
start.world.chapterId = 'V33_1847_PRINT';
start.world.date = '1847-06-01';
start.hosts.tenant_mikhail.money.amount = 0;
start.hosts.carter_roman.money.amount = 0;
assert.equal(objectIsPresent(object, start, [quest]), false, 'no report object before overdue rent and a real courtyard co-location');
assert.notEqual(resolveQuestGuidance({ state: start, quests: [quest], maps, hostCards: cards }).questId, quest.id,
  'the dormant report does not appear in guidance before its trigger');
const triggered = game.advanceNpcWorld(start, 840, maps);
const event = triggered.world.livingEventStates.E09;
assert.equal(triggered.world.livingEventStates.E01?.stage, 'OVERDUE', 'the dispute is causally linked to recorded rent arrears');
assert.equal(event?.status, 'ACTIVE', 'the scheduled rent event and physical courtyard gathering trigger E09');
assert.equal(event.stage, 'RAISED_VOICES');
assert.equal(event.triggerMechanism, 'rent_arrears_dispute_audible_in_shared_courtyard');
assert.equal(event.validationStatus, 'DESIGN_SEED_NOT_VERIFIED');
assert.equal(objectIsPresent(object, triggered, [quest]), true, 'physical response ledger appears only during the event');
assert.equal(resolveQuestGuidance({ state: triggered, quests: [quest], maps, hostCards: cards }).questId, quest.id);
assert.ok(triggered.ledger.some(row => row.livingEvents?.some(item => item.catalogEventId === 'E09' && item.stage === 'RAISED_VOICES')));

const placeAtLedger = (source, hostId) => {
  const branch = structuredClone(source);
  const position = { x: object.x / 16, y: object.y / 16 };
  branch.world.currentMapId = 'courtyard';
  branch.hosts[hostId].mapId = 'courtyard';
  branch.hosts[hostId].position = position;
  branch.player.position = { ...position };
  branch.player.embodiment = hostId;
  branch.hosts.tenant_mikhail.position = { x: 13, y: 4 };
  branch.hosts.landlady_polina.position = { x: 14, y: 4 };
  return branch;
};
for (const [actionId, hostId, finalStage] of [
  ['E09_MEDIATE_DISPUTE', 'yardkeeper_semyon', 'NEIGHBORS_SETTLED'],
  ['E09_DECLINE_REPORT', 'yardkeeper_semyon', 'NEIGHBORS_SETTLED'],
]) {
  const branch = placeAtLedger(triggered, hostId);
  const result = game.performQuestAction(branch, { questId: quest.id, hostId, actionId, objectId: quest.entry.objectId }, { quests: [quest], maps });
  assert.equal(result.ok, true, `${actionId} resolves from the physical ledger (${result.reason ?? 'unknown'})`);
  assert.equal(result.state.world.livingEventStates.E09.stage, finalStage);
  assert.equal(result.state.world.courtyardIncidentRecords?.length ?? 0, 0, 'private choices create no official report');
  const restored = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards });
  assert.equal(game.stateHash(restored), game.stateHash(result.state), `${actionId} persists through save/load`);
}

const lastMinute = placeAtLedger(triggered, 'yardkeeper_semyon');
lastMinute.world.livingEventStates.E09.resolvesAtMinute = lastMinute.world.clockMinutes + 4;
const lastMinuteMediation = game.performQuestAction(lastMinute, { questId: quest.id, hostId: 'yardkeeper_semyon',
  actionId: 'E09_MEDIATE_DISPUTE', objectId: quest.entry.objectId }, { quests: [quest], maps });
assert.equal(lastMinuteMediation.ok, true, 'a choice that begins before expiry is allowed to finish atomically');
assert.equal(lastMinuteMediation.state.world.livingEventStates.E09.stage, 'NEIGHBORS_SETTLED');

const reportStart = placeAtLedger(triggered, 'yardkeeper_semyon');
const report = game.performQuestAction(reportStart, { questId: quest.id, hostId: 'yardkeeper_semyon', actionId: 'E09_FILE_REPORT', objectId: quest.entry.objectId }, { quests: [quest], maps });
assert.equal(report.ok, true, `report is filed from the physical ledger (${report.reason ?? 'unknown'})`);
assert.equal(report.state.world.livingEventStates.E09.stage, 'REPORT_FILED');
assert.equal(report.state.world.livingEventStates.E09.status, 'ACTIVE', 'the filing remains unresolved until physical follow-up');
assert.equal(report.state.world.courtyardIncidentRecords[0].statementStatus, 'AWAITING_WATCHMAN');
assert.ok(report.state.ledger.at(-1).livingEvents.some(row => row.catalogEventId === 'E09' && row.stage === 'REPORT_FILED'));
const response = game.advanceNpcWorld(report.state, 180, maps);
assert.equal(response.world.livingEventStates.E09.stage, 'WATCHMAN_HEARD_STATEMENT',
  'the duty watchman must physically reach the courtyard and hear a party before closure');
assert.equal(response.world.courtyardIncidentRecords[0].statementStatus, 'STATEMENT_HEARD');
const savedResponse = game.loadGame(game.saveGame(response), { maps, hostCards: cards });
assert.equal(game.stateHash(savedResponse), game.stateHash(response), 'the official report and physical response survive save/load');

const unattended = game.advanceNpcWorld(triggered, 121, maps);
assert.equal(unattended.world.livingEventStates.E09.stage, 'NEIGHBORS_SETTLED');
assert.equal(unattended.world.livingEventStates.E09.status, 'RESOLVED');
assert.equal(unattended.world.livingEventStates.E01.stage, 'OVERDUE', 'settling the argument does not erase the rent ledger');
console.log('V37 E09 courtyard dispute: deterministic arrears trigger, physical choices, watchman response, unattended resolution, and save/load passed.');
