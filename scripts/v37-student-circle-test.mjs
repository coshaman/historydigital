import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const readJson = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
const [mapNames, hostNames, quest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  readJson('../rpg/quests/student-circle-risk-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapNames.filter(name => name.endsWith('.json')).map(name => readJson(`../rpg/maps/${name}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(hostNames.filter(name => name.endsWith('.json')).map(name => readJson(`../rpg/characters/${name}`))),
]);
const object = maps.courtyard.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === 1174);
const daryaNpc = maps.courtyard.layers.find(layer => layer.name === 'NPCs').objects.find(item => item.properties?.some(property => property.name === 'hostId' && property.value === 'reader_darya'));
assert.ok(object && daryaNpc, 'the physical attendance book and organizer sprite are present in the courtyard');
assert.equal(quest.requiresLivingEventId, 'E24');

let state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'courtyard' });
state.world.chapterId = 'V33_1847_PRINT';
state.world.date = '1847-06-01';
state.world.clockMinutes = 639;
state.world.currentMapId = 'courtyard';
state.player.embodiment = null;
state.hosts.student_vasily.mapId = 'nevsky';
state.hosts.student_vasily.position = { x: 15, y: 12 };
state.hosts.reader_darya.mapId = 'nevsky';
state.hosts.reader_darya.position = { x: 15, y: 13 };

state = game.advanceNpcWorld(state, 1, maps);
let event = state.world.livingEventStates.E24;
assert.equal(event?.stage, 'INVITATION_POSTED', 'the event begins at the scheduled reading hour');
assert.equal(event.validationStatus, 'DESIGN_SEED_NOT_VERIFIED');
assert.equal(objectIsPresent(object, state, [quest]), true, 'the physical interaction appears after the event begins');
assert.equal(state.hosts.reader_darya.activeGoal?.taskId, 'V37:E24:ATTEND_CIRCLE');

for (let minute = 0; minute < 100 && state.world.livingEventStates.E24.stage === 'INVITATION_POSTED'; minute += 1)
  state = game.advanceNpcWorld(state, 1, maps);
event = state.world.livingEventStates.E24;
assert.equal(event.stage, 'CIRCLE_READY', `the student and organizer must arrive together: ${JSON.stringify({ stage: event.stage, student: state.hosts.student_vasily, organizer: state.hosts.reader_darya })}`);
assert.equal(state.hosts.student_vasily.mapId, 'courtyard');
assert.equal(state.hosts.reader_darya.mapId, 'courtyard');
assert.equal(game.stateHash(game.loadGame(game.saveGame(state), { maps, hostCards: cards })), game.stateHash(state), 'active gathering and NPC goal survive save/load');

const availableForStudent = questChoices(quest, 'student_vasily', [], state);
const availableForOrganizer = questChoices(quest, 'reader_darya', [], state);
assert.deepEqual(availableForStudent.map(row => row.action.id), ['STUDENT_VASILY_CHOICE_1', 'STUDENT_VASILY_CHOICE_2']);
assert.deepEqual(availableForOrganizer.map(row => row.action.id), ['STUDENT_VASILY_CHOICE_3']);
assert.deepEqual(questChoices(quest, 'courier_pavel', [], state), [], 'unrelated residents cannot choose the gathering record');

function atGathering(hostId) {
  const branch = structuredClone(state);
  branch.world.currentMapId = 'courtyard';
  branch.player.embodiment = hostId;
  branch.hosts.student_vasily.mapId = 'courtyard';
  branch.hosts.student_vasily.position = { x: 15, y: 13 };
  branch.hosts.reader_darya.mapId = 'courtyard';
  branch.hosts.reader_darya.position = { x: 16, y: 12 };
  branch.player.position = { ...branch.hosts[hostId].position };
  return branch;
}

for (const [actionId, hostId, stage, record] of [
  ['STUDENT_VASILY_CHOICE_1', 'student_vasily', 'SPOKE_WITH_NAME', 'PUBLIC_NAMED_ATTENDANCE'],
  ['STUDENT_VASILY_CHOICE_2', 'student_vasily', 'LISTENED_UNLISTED', 'PRIVATE_UNNAMED'],
  ['STUDENT_VASILY_CHOICE_3', 'reader_darya', 'ROSTER_KEPT_PRIVATE', 'NO_PUBLIC_ROSTER'],
]) {
  const branch = atGathering(hostId);
  const result = game.performQuestAction(branch, { questId: quest.id, hostId, actionId, objectId: object.id }, { quests: [quest], maps });
  assert.equal(result.ok, true, `${actionId} is available to its assigned role (${result.reason ?? ''})`);
  assert.equal(result.state.world.livingEventStates.E24.stage, stage);
  assert.equal(result.state.world.livingEventStates.E24.attendanceRecord, record);
  assert.equal(game.stateHash(game.loadGame(game.saveGame(result.state), { maps, hostCards: cards })), game.stateHash(result.state), `${actionId} survives save/load`);
}

const unattended = game.advanceNpcWorld(state, 91, maps);
assert.equal(unattended.world.livingEventStates.E24.status, 'RESOLVED');
assert.equal(unattended.world.livingEventStates.E24.stage, 'UNATTENDED_DISCUSSION');
assert.equal(unattended.world.livingEventStates.E24.attendanceRecord, 'PRIVATE_UNNAMED');
assert.ok(unattended.hosts.student_vasily.relations.reader_darya);
assert.equal(game.stateHash(game.loadGame(game.saveGame(unattended), { maps, hostCards: cards })), game.stateHash(unattended));
console.log('V37 E24 reading circle: scheduled trigger, physical NPC travel, role-gated roster choices, unattended outcome, and save/load passed.');
