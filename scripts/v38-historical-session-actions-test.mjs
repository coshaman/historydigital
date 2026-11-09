import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { canConcludeHistoricalSession, performHistoricalAction } from '../rpg/engine/historical-session.mjs';

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
assert.equal(routed.state.hosts[`historical:${senateScene.eventId}:coachman`].mapId, riverAction.mapId);
assert.deepEqual(routed.state.hosts[`historical:${senateScene.eventId}:coachman`].position, riverAction.position);
assert.match(routed.state.hosts[`historical:${senateScene.eventId}:coachman`].currentActivityKo, /강변/);
assert.equal(routed.state.hosts[`historical:${senateScene.eventId}:coachman`].schedule[0].mapId, riverAction.mapId,
  'the route change survives subsequent deterministic schedule ticks');
console.log('Historical field actions persist consequences, complete real objectives once, and reject invalid/repeated choices.');
