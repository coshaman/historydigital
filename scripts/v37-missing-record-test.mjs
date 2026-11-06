import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest, catalog] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  json('../rpg/quests/missing-record-1847.json'), json('../data/event_catalog_45.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/maps/${file}`)))
    .then(records => Object.fromEntries(records.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/characters/${file}`))),
]);
const catalogEvent = catalog.find(event => event.event_id === 'E20');
assert.equal(catalogEvent.validation_status, 'DESIGN_SEED_NOT_VERIFIED');
assert.deepEqual(quest.eventCatalogRef, { catalogIdSpace: 'V37_EVENT_CATALOG_45', eventId: 'E20', validationStatus: 'DESIGN_SEED_NOT_VERIFIED' });
const chancery = maps.chancery;
const object = chancery.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
const objectTile = { x: object.x / 16, y: object.y / 16 };
assert.equal(chancery.layers.find(layer => layer.name === 'Collision').data[objectTile.y * chancery.width + objectTile.x], 1, 'the paper is a fixed desk object');
assert.equal(chancery.layers.find(layer => layer.name === 'Collision').data[12 * chancery.width + 14], 0, 'the review position beside the desk is walkable');
const initial = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'nevsky' });
const triggered = game.advanceNpcWorld(initial, 25, maps);
const event = triggered.world.livingEventStates.E20;
assert.equal(event.status, 'ACTIVE');
assert.equal(event.stage, 'RECORD_NOT_FOUND');
assert.equal(event.startedAtMinute, 560, 'Alexei triggers the event only after completing intake work');
assert.equal(triggered.hosts.senior_clerk_konstantin.activeGoal?.reason, 'supervisor_reviews_unmatched_register_slip', 'the supervisor autonomously responds to the incident');
assert.equal(event.document.isHistoricalDocument, false);
assert.equal(objectIsPresent(object, triggered, [quest]), true, 'the physical review paper appears only while the event is active');
assert.deepEqual(questChoices(quest, 'clerk_alexei', [], triggered).map(row => row.action.id), ['E20_SEARCH_RETURNED_STACK', 'E20_CROSS_REFERENCE']);
assert.deepEqual(questChoices(quest, 'senior_clerk_konstantin', [], triggered).map(row => row.action.id), ['E20_FILE_UNMATCHED', 'E20_HOLD_FOR_REVIEW']);
const possessedClerk = structuredClone(initial);
possessedClerk.world.currentMapId = 'chancery'; possessedClerk.player.embodiment = 'clerk_alexei';
possessedClerk.player.position = { x: 11, y: 13 }; possessedClerk.hosts.clerk_alexei.mapId = 'chancery';
possessedClerk.hosts.clerk_alexei.position = { x: 11, y: 13 };
assert.equal(game.advanceNpcWorld(possessedClerk, 21, maps).world.livingEventStates.E20?.status, 'ACTIVE', 'the intake event also occurs while the player inhabits Alexei at his desk');

const atDesk = (source, actorId) => {
  const state = structuredClone(source), playerTile = { x: 14, y: 12 }, partnerTile = { x: 15, y: 12 };
  state.world.currentMapId = 'chancery'; state.player.position = { ...playerTile }; state.player.embodiment = actorId;
  const partnerId = actorId === 'clerk_alexei' ? 'senior_clerk_konstantin' : 'clerk_alexei';
  for (const id of ['clerk_alexei', 'senior_clerk_konstantin']) state.hosts[id].mapId = 'chancery';
  state.hosts[actorId].position = { ...playerTile }; state.hosts[partnerId].position = { ...partnerTile }; return state;
};
for (const [hostId, actionId, expectedStage, expectedLocation] of [
  ['clerk_alexei', 'E20_SEARCH_RETURNED_STACK', 'MATCHING_ENTRY_FOUND', '접수부 반송 서류 더미'],
  ['senior_clerk_konstantin', 'E20_FILE_UNMATCHED', 'UNMATCHED_FILED', '미결 서류함'],
  ['clerk_alexei', 'E20_CROSS_REFERENCE', 'CROSS_REFERENCE_CREATED', '별도 대조표'],
  ['senior_clerk_konstantin', 'E20_HOLD_FOR_REVIEW', 'HELD_FOR_REVIEW', '상급자 검토함'],
]) {
  const chosen = game.performQuestAction(atDesk(triggered, hostId), { questId: quest.id, hostId, actionId, objectId: object.id }, { quests: [quest], maps });
  assert.equal(chosen.ok, true, `${actionId}: ${chosen.reason ?? ''}`);
  assert.equal(chosen.state.world.livingEventStates.E20.stage, expectedStage);
  assert.equal(chosen.state.world.livingEventStates.E20.document.location, expectedLocation);
  assert.ok(chosen.state.ledger.at(-1).livingEvents.some(row => row.catalogEventId === 'E20' && row.stage === expectedStage));
}

const unattended = game.advanceNpcWorld(structuredClone(triggered), 181, maps);
assert.equal(unattended.world.livingEventStates.E20.status, 'RESOLVED', 'the incident continues without player action');
assert.equal(unattended.world.livingEventStates.E20.stage, 'UNMATCHED_FILED_AUTOMATICALLY');
assert.equal(unattended.world.livingEventStates.E20.document.location, '미결 서류함');
const ledgerRows = unattended.ledger;
assert.ok(ledgerRows.flatMap(row => row.livingEvents ?? []).some(row => row.catalogEventId === 'E20' && row.resolutionActionId === 'E20_AUTO_FILE_UNMATCHED'));
assert.ok(ledgerRows.flatMap(row => row.goals ?? []).some(row => row.hostId === 'senior_clerk_konstantin' && row.reason === 'supervisor_reviews_unmatched_register_slip'), 'the supervisor response is persisted in the NPC goal log');
assert.ok(ledgerRows.flatMap(row => row.moves ?? []).some(row => row.hostId === 'senior_clerk_konstantin' && (row.toMapId === 'chancery' || row.fromMapId === 'chancery')), 'the supervisor physically moves in the chancery scene');
const restored = game.loadGame(game.saveGame(unattended), { maps, hostCards: cards, quests: [quest] });
assert.equal(game.stateHash(restored), game.stateHash(unattended), 'document location, event status, NPC state and ledger survive save/load');
console.log('V37 E20 missing-record event: PASS (autonomous trigger, physical object, four interventions, unattended resolution, save/load)');
