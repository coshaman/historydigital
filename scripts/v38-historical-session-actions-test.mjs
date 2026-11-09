import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import '../rpg/engine/game-state.js';
import { canConcludeHistoricalSession, performHistoricalAction } from '../rpg/engine/historical-session.mjs';
import { beginHistoricalSession } from '../rpg/engine/historical-session.mjs';

const play = JSON.parse(await fs.readFile(new URL('../rpg/data/historical-scene-play.json', import.meta.url), 'utf8'));
const catalog = JSON.parse(await fs.readFile(new URL('../rpg/data/v38-historical-events.json', import.meta.url), 'utf8'));
for (const scene of play.events) {
  assert.equal(scene.actors.length, 18, `${scene.eventId} has six movable participants in each zone`);
  assert.equal(new Set(scene.actors.map(actor => actor.id)).size, 18, `${scene.eventId} assigns each participant a distinct body`);
  assert.deepEqual(scene.actors.reduce((counts, _actor, index) => { counts[index % scene.maps.length]++; return counts; }, [0, 0, 0]), [6, 6, 6],
    `${scene.eventId} places six actors on each playable map`);
  const event = catalog.events.find(item => item.id === scene.eventId);
  assert.equal(event.playableParticipantCount, 18, `${scene.eventId} reports its full on-map cast`);
  assert.deepEqual(event.cast, scene.actors.map(actor => actor.nameKo), `${scene.eventId} cast matches the moving characters`);
  const roleActions = scene.fieldActions.filter(item => item.requiredActorId);
  assert.ok(roleActions.length >= 6, `${scene.eventId} requires at least six event roles`);
  assert.equal(new Set(roleActions.map(item => item.mapId)).size, 3, `${scene.eventId} makes the player change roles across all three zones`);
  for (const action of roleActions) {
    const actorIndex = scene.actors.findIndex(actor => actor.id === action.requiredActorId);
    assert.equal(actorIndex % scene.maps.length, scene.maps.indexOf(action.mapId), `${action.id} can be done by a person physically in its zone`);
  }
  const action = scene.fieldActions[0];
  const option = action.options.find(item => !item.sceneMoves?.length) ?? action.options[0];
  const session = { historicalSession: { eventId: scene.eventId, choices: [], completedObjectives: [], actionOutcomes: {} },
    player: { embodiment: action.requiredActorId ? `historical:${scene.eventId}:${action.requiredActorId}` : null },
    world: { currentMapId: action.mapId, historicalEventEffects: {} } };
  const result = performHistoricalAction(session, scene, action.id, option.id);
  assert.equal(result.ok, true, `${scene.eventId} accepts its authored field action`);
  assert.deepEqual(result.state.historicalSession.completedObjectives, [action.objectiveId]);
  assert.equal(result.state.historicalSession.actionOutcomes[action.id], option.id);
  assert.equal(result.state.world.historicalEventEffects[scene.eventId][Object.keys(option.effects)[0]], Object.values(option.effects)[0]);
  assert.equal(result.state.historicalSession.choices.at(-1).id, `${action.id}:${option.id}`);
  const repeated = performHistoricalAction(result.state, scene, action.id, option.id);
  assert.equal(repeated.reason, 'action_already_resolved');
  assert.equal(repeated.state.historicalSession.choices.length, result.state.historicalSession.choices.length);
  assert.equal(performHistoricalAction(session, scene, action.id, 'not-an-option').reason, 'invalid_historical_action');
  session.world.currentMapId = scene.maps.at(-1);
  assert.equal(performHistoricalAction(session, scene, action.id, option.id).reason, 'wrong_historical_area');
}
for (const scene of play.events) {
  const action = scene.fieldActions.find(item => item.requiredActorId);
  const session = { historicalSession: { eventId: scene.eventId, choices: [], completedObjectives: [], actionOutcomes: {} },
    player: { embodiment: `historical:${scene.eventId}:wrong-person` }, world: { currentMapId: action.mapId } };
  const rejected = performHistoricalAction(session, scene, action.id, action.options[0].id);
  assert.equal(rejected.reason, 'wrong_historical_actor', `${scene.eventId}/${action.id} requires its assigned person's body`);
  assert.equal(rejected.state.historicalSession.choices.length, 0);
  session.player.embodiment = `historical:${scene.eventId}:${action.requiredActorId}`;
  const accepted = performHistoricalAction(session, scene, action.id, action.options[0].id);
  assert.equal(accepted.ok, true, 'the assigned person can make the local decision');
  assert.equal(accepted.state.historicalSession.actionOutcomes[action.id], action.options[0].id);
}
const conclusionScene = { eventId: 'test-event', maps: ['one', 'two', 'three'], fieldActions: [
  { id: 'role-a', requiredActorId: 'a' }, { id: 'role-b', requiredActorId: 'b' }, { id: 'role-c', requiredActorId: 'c' },
] , conclusionRequirements: { spokenActors: 12, completedObjectives: 7, requiredRoleActions: 2 } };
const nearEnd = { historicalSession: { eventId: 'test-event', spokenActorIds: Array.from({ length: 7 }, (_, i) => String(i)),
  completedObjectives: ['a', 'b', 'c', 'd', 'e', 'f'], visitedMapIds: ['one', 'two', 'three'], actionOutcomes: { 'role-a': 'x' } } };
assert.equal(canConcludeHistoricalSession(nearEnd, conclusionScene), false, 'multiple subquests and roles remain before the finale');
nearEnd.historicalSession.actionOutcomes['role-b'] = 'y';
nearEnd.historicalSession.spokenActorIds = Array.from({ length: 11 }, (_, i) => String(i));
nearEnd.historicalSession.completedObjectives.push('g');
assert.equal(canConcludeHistoricalSession(nearEnd, conclusionScene), false, 'the expanded gathering requires twelve distinct conversations');
nearEnd.historicalSession.spokenActorIds.push('eleven');
assert.equal(canConcludeHistoricalSession(nearEnd, conclusionScene), true, 'the extended walk, subquests and role-switch route unlock the final event decision');

for (const scene of play.events) {
  const conditionalAction = scene.fieldActions.find(item => item.options.some(option => option.requiresEffects));
  assert.ok(conditionalAction, `${scene.eventId} carries an earlier decision into a later group encounter`);
  const conditionalOption = conditionalAction.options.find(option => option.requiresEffects);
  const blocked = { historicalSession: { eventId: scene.eventId, choices: [], completedObjectives: [], actionOutcomes: {} },
    player: { embodiment: `historical:${scene.eventId}:${conditionalAction.requiredActorId}` },
    world: { currentMapId: conditionalAction.mapId, historicalEventEffects: { [scene.eventId]: {} } } };
  assert.equal(performHistoricalAction(blocked, scene, conditionalAction.id, conditionalOption.id).reason, 'historical_choice_locked');
  for (const [key, value] of Object.entries(conditionalOption.requiresEffects)) blocked.world.historicalEventEffects[scene.eventId][key] = value;
  assert.equal(performHistoricalAction(blocked, scene, conditionalAction.id, conditionalOption.id).ok, true,
    `${scene.eventId} unlocks its later group decision after the required earlier action`);
}
const senateScene = structuredClone(play.events.find(scene => scene.eventId === 'SENATE_SQUARE_1825'));
const horseRoute = senateScene.fieldActions.find(action => action.id === 'senate-route-horse');
const riverAction = senateScene.fieldActions.find(action => action.id === 'senate-river-lane');
riverAction.position = { x: 12, y: 9 };
const turnCart = horseRoute.options.find(option => option.id === 'turn-cart');
assert.deepEqual(turnCart.sceneMoves, [{ actorId: 'coachman', targetActionId: riverAction.id,
  activityKo: '수레를 강변 쪽으로 돌려 피난길을 열고 있다' }], 'the route decision authors a physical resident move');
const movingSession = { historicalSession: { eventId: senateScene.eventId, choices: [], completedObjectives: [], actionOutcomes: {} },
  player: { embodiment: null, position: { x: 4, y: 14 } },
  world: { currentMapId: horseRoute.mapId, clockMinutes: 600, historicalEventEffects: {} },
  hosts: { [`historical:${senateScene.eventId}:coachman`]: { id: `historical:${senateScene.eventId}:coachman`,
    mapId: horseRoute.mapId, position: { x: 8, y: 8 }, schedule: [], allowedMaps: senateScene.maps } } };
const routed = performHistoricalAction(movingSession, senateScene, horseRoute.id, turnCart.id);
assert.equal(routed.ok, true);
assert.equal(routed.state.hosts[`historical:${senateScene.eventId}:coachman`].mapId, horseRoute.mapId,
  'a scene choice starts a journey without teleporting its participant');
assert.deepEqual(routed.state.hosts[`historical:${senateScene.eventId}:coachman`].position, { x: 8, y: 8 },
  'the participant remains on the tile where the decision was made');
assert.match(routed.state.hosts[`historical:${senateScene.eventId}:coachman`].currentActivityKo, /강변/);
assert.equal(routed.state.hosts[`historical:${senateScene.eventId}:coachman`].schedule[0].mapId, riverAction.mapId,
  'the NPC schedule sends them toward the next playable scene');
assert.deepEqual(routed.state.hosts[`historical:${senateScene.eventId}:coachman`].schedule[0].position, riverAction.position);
assert.equal(routed.state.hosts[`historical:${senateScene.eventId}:coachman`].schedule[0].atMinute, 601,
  'the journey begins on the next world tick');
assert.equal(routed.state.historicalSession.physicalMoves.at(-1).status, 'EN_ROUTE');
const senateGroupAction = senateScene.fieldActions.find(item => item.gatherActorIds?.length);
senateGroupAction.position = { x: 11, y: 8 };
const groupActors = senateGroupAction.gatherActorIds.filter(id => id !== senateGroupAction.requiredActorId);
const groupSession = { historicalSession: { eventId: senateScene.eventId, choices: [], completedObjectives: [], actionOutcomes: {} },
  player: { embodiment: `historical:${senateScene.eventId}:${senateGroupAction.requiredActorId}`, position: { x: 4, y: 14 } },
  world: { currentMapId: senateGroupAction.mapId, clockMinutes: 620, historicalEventEffects: {} },
  hosts: Object.fromEntries(groupActors.map((actorId, index) => [`historical:${senateScene.eventId}:${actorId}`,
    { id: `historical:${senateScene.eventId}:${actorId}`, mapId: senateScene.maps[index % senateScene.maps.length],
      position: { x: 3 + index, y: 4 }, schedule: [], allowedMaps: senateScene.maps }])) };
groupSession.hosts[`historical:${senateScene.eventId}:${senateGroupAction.requiredActorId}`] = {
  id: `historical:${senateScene.eventId}:${senateGroupAction.requiredActorId}`, mapId: senateGroupAction.mapId,
  position: { x: 5, y: 5 }, schedule: [], allowedMaps: senateScene.maps };
const groupChoice = senateGroupAction.options.find(option => !option.sceneMoves?.length);
const gathered = performHistoricalAction(groupSession, senateScene, senateGroupAction.id, groupChoice.id);
assert.equal(gathered.ok, true);
for (const actorId of groupActors) {
  const resident = gathered.state.hosts[`historical:${senateScene.eventId}:${actorId}`];
  assert.equal(resident.schedule[0].mapId, senateGroupAction.mapId, `${actorId} walks toward the group decision`);
  assert.deepEqual(resident.schedule[0].position, senateGroupAction.position, `${actorId} gathers at the physical event prop`);
  assert.equal(resident.mapId, groupSession.hosts[resident.id].mapId, `${actorId} remains at their starting map until they walk there`);
}

for (const [eventId, actionId, optionId, actorId, targetId, expectedMap] of [
  ['GOGOL_INSPECTOR_1836', 'inspector-lobby-company-vote', 'company-decides', 'actor', 'inspector-street-open-forum', 'theatre-street'],
  ['EMANCIPATION_1861', 'emancipation-square-wage-meeting', 'collective-terms', 'porter', 'emancipation-lane-petition', 'manifesto-lane'],
]) {
  const scene = structuredClone(play.events.find(item => item.eventId === eventId));
  const action = scene.fieldActions.find(item => item.id === actionId);
  const target = scene.fieldActions.find(item => item.id === targetId);
  target.position = { x: 12, y: 9 };
  const option = action.options.find(item => item.id === optionId);
  assert.ok(option.sceneMoves?.some(move => move.actorId === actorId && move.targetActionId === targetId),
    `${eventId}/${optionId} physically sends a participant to the next playable group scene`);
  const playerHostId = `historical:${eventId}:${action.requiredActorId}`;
  const hostId = `historical:${eventId}:${actorId}`;
  const session = { historicalSession: { eventId, choices: [], completedObjectives: [], actionOutcomes: {} },
    player: { embodiment: playerHostId, position: { x: 4, y: 12 } },
    world: { currentMapId: action.mapId, clockMinutes: 720, historicalEventEffects: {} },
    hosts: Object.fromEntries([...new Set([...option.sceneMoves.map(move => move.actorId), action.requiredActorId])].map(id => {
      const idKey = `historical:${eventId}:${id}`;
      return [idKey, { id: idKey, mapId: action.mapId, position: { x: 4, y: 12 }, schedule: [], allowedMaps: scene.maps }];
    })) };
  const result = performHistoricalAction(session, scene, actionId, optionId);
  assert.equal(result.ok, true, `${eventId}/${optionId} resolves for the assigned person: ${result.reason}`);
  assert.equal(result.state.hosts[hostId].mapId, action.mapId, `${eventId}/${optionId} keeps the participant at the point of departure`);
  assert.equal(result.state.hosts[hostId].schedule[0].mapId, expectedMap, `${eventId}/${optionId} schedules a real journey to the next group scene`);
  assert.deepEqual(result.state.player.position, { x: 4, y: 12 }, `${eventId}/${optionId} does not teleport an embodied player`);
  assert.equal(result.state.historicalSession.physicalMoves.at(-1).choiceId, optionId, `${eventId}/${optionId} is retained in the event history`);
}

const movementMap = (mapId, exits = []) => ({ mapId, width: 12, height: 12,
  metadata: { date: '1825-12-14', observerStart: { x: 10, y: 10 }, mapClass: 'REAL_WORLD_RECONSTRUCTION' },
  layers: [
    { name: 'Collision', data: Array(144).fill(0) },
    { name: 'Interactions', objects: exits.map(({ x, targetMapId, arrivalX, exitId }) => ({
      type: 'map-exit', x: x * 16, y: 5 * 16, width: 16, height: 16,
      properties: [
        { name: 'exitId', value: exitId }, { name: 'targetMapId', value: targetMapId },
        { name: 'arrivalX', value: arrivalX }, { name: 'arrivalY', value: 5 },
      ],
    })) },
  ] });
const travelMaps = {
  'travel-a': movementMap('travel-a', [{ x: 9, targetMapId: 'travel-b', arrivalX: 2, exitId: 'a-to-b' }]),
  'travel-b': movementMap('travel-b', [{ x: 1, targetMapId: 'travel-a', arrivalX: 8, exitId: 'b-to-a' }]),
};
const templateCard = { id: 'clerk_alexei', kind: 'FICTIONAL', start: { mapId: 'travel-a', x: 2, y: 5 },
  allowedMaps: ['travel-a', 'travel-b'], money: { amount: 10 }, schedule: [], relations: {}, skills: {},
  marketOffers: [], marketStock: {}, inventory: [], personalGoal: null, privateKnowledgeIds: [], knownEvidenceIds: [] };
const baseState = globalThis.V33GameState.createInitialState({ maps: travelMaps, hostCards: [templateCard], startMapId: 'travel-a' });
const travelEvent = { id: 'TRAVEL_TEST', date: '1825-12-14', startMinute: 600, entryMapId: 'travel-a',
  entryPosition: { x: 10, y: 10 }, mapIds: ['travel-a', 'travel-b'], actors: [{ id: 'walker', templateId: 'clerk_alexei',
    nameKo: '시험 인물', mapId: 'travel-a', position: { x: 2, y: 5 }, lines: ['길을 나선다.'] }] };
const travelAction = { id: 'start-walk', mapId: 'travel-a', objectiveId: 'walk', requiredActorId: 'walker',
  position: { x: 8, y: 8 }, options: [{ id: 'go', textKo: '길을 나섰다.', sceneMoves: [{ actorId: 'walker',
    targetActionId: 'next-place', activityKo: '강 건너편으로 향한다' }] }] };
const travelScene = { eventId: 'TRAVEL_TEST', maps: travelEvent.mapIds, fieldActions: [travelAction,
  { id: 'next-place', mapId: 'travel-b', position: { x: 8, y: 8 } }], actors: travelEvent.actors };
const startedTravel = beginHistoricalSession(baseState, travelEvent, travelMaps, [templateCard]);
assert.equal(startedTravel.ok, true);
startedTravel.session.player.embodiment = 'historical:TRAVEL_TEST:walker';
const travelChoice = performHistoricalAction(startedTravel.session, travelScene, 'start-walk', 'go');
const walkerId = 'historical:TRAVEL_TEST:walker';
assert.equal(travelChoice.ok, true, `the test event accepts its travel decision: ${travelChoice.reason}`);
const departurePosition = { ...travelChoice.state.hosts[walkerId].position };
assert.deepEqual(departurePosition, { x: 2, y: 5 }, 'the actor starts from their current tile');
travelChoice.state.player.embodiment = null;
const movedState = globalThis.V33GameState.advanceWorldTime(travelChoice.state, 60, travelMaps);
const walkerAfterTravel = movedState.hosts[walkerId];
assert.equal(walkerAfterTravel.mapId, 'travel-b', 'world ticks carry the character through the connected exit');
assert.notDeepEqual(walkerAfterTravel.position, departurePosition, 'the traveler continues moving after entering the next map');
console.log('Historical field actions persist consequences, complete real objectives once, and reject invalid/repeated choices.');
