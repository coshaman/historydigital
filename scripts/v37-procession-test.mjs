import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async url => JSON.parse(await readFile(url, 'utf8'));
const [quest, catalog, mapFiles, cardFiles] = await Promise.all([
  read(new URL('../rpg/quests/v37-official-procession-1847.json', import.meta.url)),
  read(new URL('../data/event_catalog_45.json', import.meta.url)),
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
]);
const maps = await Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/maps/${file}`, import.meta.url))))
  .then(rows => Object.fromEntries(rows.map(row => [row.mapId, row])));
const map = maps.nevsky;
const cards = await Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/characters/${file}`, import.meta.url))));
assert.equal(catalog.find(row => row.event_id === 'E45')?.validation_status, 'DESIGN_SEED_NOT_VERIFIED');
const object = map.layers.find(layer => layer.name === 'Interactions').objects.find(row => row.id === quest.entry.objectId);
assert.ok(object);
const naturalStart = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'nevsky' });
naturalStart.world.chapterId = 'V33_1847_PRINT'; naturalStart.world.date = '1847-06-01'; naturalStart.world.clockMinutes = 660;
naturalStart.world.currentMapId = 'nevsky';
naturalStart.player.position = { x: 2, y: 2 };
const approaching = game.advanceNpcWorld(naturalStart, 30, maps);
const approachEvent = approaching.world.livingEventStates.E45;
assert.equal(approachEvent?.stage, 'CARRIAGE_APPROACHING', 'the scheduled carriage must enter a visible travel stage first');
assert.deepEqual(approachEvent.carriagePosition, approaching.hosts[approachEvent.coachmanHostId].position,
  'the cart position follows the actual coachman rather than appearing at the destination');
assert.equal(objectIsPresent(object, approaching, [quest]), false, 'clearance choices stay closed until the carriage and witnesses arrive');
const gathered = game.advanceNpcWorld(approaching, 210, maps);
const gatheredEvent = gathered.world.livingEventStates.E45;
assert.equal(gatheredEvent.stage, 'CLEARANCE_READY', 'the road scene opens only after all three residents reach it');
for (const id of gatheredEvent.actorHostIds) assert.ok(gathered.hosts[id].mapId === 'nevsky'
  && Math.abs(gathered.hosts[id].position.x - gatheredEvent.scenePosition.x) + Math.abs(gathered.hosts[id].position.y - gatheredEvent.scenePosition.y) <= 3,
'each participant must be physically present before an action is offered');
const blockTile = gatheredEvent.carriagePosition;
assert.equal(game.canOccupy(map, blockTile.x, blockTile.y, null, null, gathered.world), false,
  'the carriage physically blocks its occupied road tile');
assert.equal(game.canOccupy(map, blockTile.x, blockTile.y, null, null), true,
  'the same tile is walkable when no live carriage is blocking it');
const savedGathering = game.loadGame(game.saveGame(gathered), { maps, hostCards: cards, quests: [quest] });
assert.deepEqual(savedGathering.world.livingEventStates.E45.carriagePosition, blockTile, 'the live blockage survives save/load');
const legacySave = structuredClone(gathered);
delete legacySave.world.livingEventStates.E45.carriagePosition;
delete legacySave.world.livingEventStates.E45.carriageMapId;
const migratedLegacySave = game.loadGame(game.saveGame(legacySave), { maps, hostCards: cards, quests: [quest] });
assert.deepEqual(migratedLegacySave.world.livingEventStates.E45.carriagePosition,
  gathered.hosts.coachman_timofey.position, 'older active procession saves restore the carriage from the coachman');

const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'nevsky' });
state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 690;
state.world.currentMapId = 'nevsky'; state.player.embodiment = 'street_vendor_matryona';
for (const [id, x] of [['street_vendor_matryona', 23], ['junior_guard_sergey', 24], ['coachman_timofey', 25]]) {
  state.hosts[id].mapId = 'nevsky'; state.hosts[id].position = { x, y: 15 };
  state.hosts[id].historicalAliveAndPresent = true;
}
state.player.position = { x: 23, y: 15 };
assert.equal(objectIsPresent(object, state, [quest]), false);
let active = game.advanceNpcWorld(state, 1, maps);
const event = active.world.livingEventStates.E45;
assert.equal(event?.status, 'ACTIVE');
assert.equal(event.stage, 'CLEARANCE_READY');
assert.ok(objectIsPresent(object, active, [quest]));
assert.ok(['street_vendor_matryona', 'junior_guard_sergey', 'coachman_timofey'].some(id =>
  active.hosts[id].activeGoal?.taskId?.startsWith('V37:E45:')));
const expected = new Map([
  ['street_vendor_matryona', ['E45_MOVE_STALL_TO_EDGE']],
  ['junior_guard_sergey', ['E45_CLEAR_ROUTE_OFFICIALLY']],
  ['coachman_timofey', ['E45_TURN_CARRIAGE_BACK']],
]);
for (const [hostId, actionIds] of expected) {
  const branch = structuredClone(active); branch.player.embodiment = hostId;
  branch.player.position = { ...branch.hosts[hostId].position };
  const choices = questChoices(quest, hostId, [], branch);
  assert.deepEqual(choices.map(row => row.action.id), actionIds);
  assert.ok(choices.every(row => row.action.subcopyKo?.length > 8));
  const result = game.performQuestAction(branch, { questId: quest.id, hostId, actionId: actionIds[0], objectId: quest.entry.objectId }, { quests: [quest], maps });
  assert.equal(result.ok, true, `${hostId}: ${result.reason ?? ''}`);
  assert.equal(result.state.world.livingEventStates.E45.status, 'RESOLVED');
  assert.ok(result.state.world.processionRecords.at(-1));
  const restored = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [quest] });
  assert.deepEqual(restored.world.processionRecords, result.state.world.processionRecords);
}
console.log('E45 conditional carriage obstruction, role-specific route choices, physical changes and persistence passed');
