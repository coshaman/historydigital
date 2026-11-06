import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest, parcelQuest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/police-document-check-1847.json'), read('../rpg/quests/pavel-missing-parcel-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);
const interaction = maps['police-station'].layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === 1174);
assert.equal(quest.requiresLivingEventId, 'E25');
assert.ok(interaction);

function reportLostParcel() {
  let state = game.createInitialState({ maps, hostCards: cards, quests: [quest, parcelQuest], startMapId: 'printshop' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 700;
  state.world.currentMapId = 'printshop'; state.player.embodiment = 'courier_pavel';
  state.hosts.courier_pavel.mapId = 'printshop'; state.hosts.courier_pavel.position = { x: 10, y: 13 };
  state.hosts.police_sergeant_ivan.mapId = 'police-station'; state.hosts.police_sergeant_ivan.position = { x: 7, y: 3 };
  state.world.livingEventStates.E05 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E05', status: 'ACTIVE',
    stage: 'PARCEL_MISSING', startedAtMinute: 660, senderHostId: 'courier_pavel', recipientHostId: 'printer_ekaterina',
    taskId: 'PAVEL_DELIVER_SEALED_ENVELOPE_01', itemKo: '밀봉 봉투', mapId: 'printshop', position: { x: 10, y: 13 },
    itemLocation: 'LOST_ON_DELIVERY_ROUTE', deadlineMinute: 660, valueStatus: 'fictional_gameplay_balance',
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
  const result = game.performQuestAction(state, { questId: parcelQuest.id, hostId: 'courier_pavel',
    actionId: 'PAVEL_REPORT_MISSING_PARCEL', objectId: parcelQuest.entry.objectId }, { quests: [quest, parcelQuest], maps });
  assert.equal(result.ok, true, `the courier can file the loss report: ${result.reason ?? ''}`);
  return result.state;
}

let reported = reportLostParcel();
assert.equal(reported.world.livingEventStates.E05.stage, 'LOSS_REPORTED');
assert.equal(reported.world.livingEventStates.E25, undefined);
assert.equal(objectIsPresent(interaction, reported, [quest, parcelQuest]), false, 'the station interaction stays hidden until the report follow-up begins');
reported.player.embodiment = null;
let gathering = reported, event;
for (let elapsed = 0; elapsed < 360 && gathering.world.livingEventStates.E25?.stage !== 'INTERVIEW_READY'; elapsed += 30)
  gathering = game.advanceNpcWorld(gathering, 30, maps);
event = gathering.world.livingEventStates.E25;
assert.equal(event?.stage, 'INTERVIEW_READY', `the report should bring both people to the station: ${JSON.stringify({
  stage: event?.stage, courier: gathering.hosts.courier_pavel.mapId, officer: gathering.hosts.police_sergeant_ivan.mapId,
  courierPosition: gathering.hosts.courier_pavel.position, courierGoal: gathering.hosts.courier_pavel.activeGoal,
})}`);
assert.equal(event.sourceEventId, 'E05');
assert.equal(event.recordScope, 'NONE');
assert.equal(gathering.hosts.courier_pavel.mapId, 'police-station');
assert.equal(gathering.hosts.police_sergeant_ivan.mapId, 'police-station');
assert.equal(objectIsPresent(interaction, gathering, [quest, parcelQuest]), true);
assert.deepEqual(questChoices(quest, 'courier_pavel', [], gathering).map(row => row.action.id), [
  'E25_ADD_ROUTE_TO_REGISTER', 'E25_ASK_SCOPE_FIRST', 'E25_LEAVE_WITHOUT_ANSWER',
]);
assert.deepEqual(questChoices(quest, 'police_sergeant_ivan', [], gathering), []);
assert.equal(game.stateHash(game.loadGame(game.saveGame(gathering), { maps, hostCards: cards, quests: [quest, parcelQuest] })), game.stateHash(gathering), JSON.stringify(event));

for (const [actionId, stage, recordScope] of [
  ['E25_ADD_ROUTE_TO_REGISTER', 'ROUTE_ENTERED', 'POLICE_INTAKE_REGISTER'],
  ['E25_ASK_SCOPE_FIRST', 'SCOPE_ASKED', 'PRIVATE_CONVERSATION'],
  ['E25_LEAVE_WITHOUT_ANSWER', 'LEFT_UNANSWERED', 'NONE'],
]) {
  const branch = structuredClone(gathering); branch.world.currentMapId = 'police-station';
  branch.player.embodiment = 'courier_pavel';
  branch.hosts.courier_pavel.position = { x: 5, y: 3 };
  branch.player.position = { ...branch.hosts.courier_pavel.position };
  const result = game.performQuestAction(branch, { questId: quest.id, hostId: 'courier_pavel', actionId, objectId: interaction.id },
    { quests: [quest, parcelQuest], maps });
  assert.equal(result.ok, true, `${actionId} is available: ${result.reason ?? ''} ${JSON.stringify({ p: branch.hosts.courier_pavel.position, map: branch.hosts.courier_pavel.mapId, current: branch.world.currentMapId, object: interaction })}`);
  event = result.state.world.livingEventStates.E25;
  assert.equal(event.stage, stage); assert.equal(event.recordScope, recordScope);
  assert.equal(Number.isInteger(event.officialRecordNumber), recordScope === 'POLICE_INTAKE_REGISTER');
  assert.ok(result.state.ledger.at(-1).livingEvents.some(row => row.catalogEventId === 'E25' && row.stage === stage));
  assert.equal(game.stateHash(game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [quest, parcelQuest] })), game.stateHash(result.state));
}

const unattended = game.advanceNpcWorld(gathering, 91, maps);
assert.equal(unattended.world.livingEventStates.E25.status, 'RESOLVED');
assert.equal(unattended.world.livingEventStates.E25.stage, 'CHECK_CLOSED_UNATTENDED');
assert.equal(unattended.world.livingEventStates.E25.recordScope, 'NONE');
assert.equal(game.stateHash(game.loadGame(game.saveGame(unattended), { maps, hostCards: cards, quests: [quest, parcelQuest] })), game.stateHash(unattended));
console.log('V37 E25 police document check: causal trigger from E05, autonomous travel, three record outcomes, unattended closure, and save/load passed.');
