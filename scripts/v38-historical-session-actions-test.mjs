import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { canConcludeHistoricalSession, performHistoricalAction } from '../rpg/engine/historical-session.mjs';

const play = JSON.parse(await fs.readFile(new URL('../rpg/data/historical-scene-play.json', import.meta.url), 'utf8'));
const catalog = JSON.parse(await fs.readFile(new URL('../rpg/data/v38-historical-events.json', import.meta.url), 'utf8'));
for (const scene of play.events) {
  assert.equal(scene.actors.length, 15, `${scene.eventId} has five movable participants in each zone`);
  assert.equal(new Set(scene.actors.map(actor => actor.id)).size, 15, `${scene.eventId} assigns each participant a distinct body`);
  assert.deepEqual(scene.actors.reduce((counts, _actor, index) => { counts[index % scene.maps.length]++; return counts; }, [0, 0, 0]), [5, 5, 5],
    `${scene.eventId} places five actors on each playable map`);
  const event = catalog.events.find(item => item.id === scene.eventId);
  assert.equal(event.playableParticipantCount, 15, `${scene.eventId} reports its full on-map cast`);
  assert.deepEqual(event.cast, scene.actors.map(actor => actor.nameKo), `${scene.eventId} cast matches the moving characters`);
  const roleActions = scene.fieldActions.filter(item => item.requiredActorId);
  assert.equal(roleActions.length, 3, `${scene.eventId} requires three event roles`);
  assert.equal(new Set(roleActions.map(item => item.mapId)).size, 3, `${scene.eventId} makes the player change roles across all three zones`);
  for (const action of roleActions) {
    const actorIndex = scene.actors.findIndex(actor => actor.id === action.requiredActorId);
    assert.equal(actorIndex % scene.maps.length, scene.maps.indexOf(action.mapId), `${action.id} can be done by a person physically in its zone`);
  }
  const action = scene.fieldActions[0];
  const option = action.options[0];
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
] };
const nearEnd = { historicalSession: { eventId: 'test-event', spokenActorIds: Array.from({ length: 7 }, (_, i) => String(i)),
  completedObjectives: ['a', 'b', 'c', 'd', 'e'], visitedMapIds: ['one', 'two', 'three'], actionOutcomes: { 'role-a': 'x', 'role-b': 'y' } } };
assert.equal(canConcludeHistoricalSession(nearEnd, conclusionScene), false, 'all assigned role missions must be completed');
nearEnd.historicalSession.actionOutcomes['role-c'] = 'z';
assert.equal(canConcludeHistoricalSession(nearEnd, conclusionScene), false, 'the gathering needs eight distinct conversations');
nearEnd.historicalSession.spokenActorIds.push('seven');
assert.equal(canConcludeHistoricalSession(nearEnd, conclusionScene), true, 'the full on-foot and role-switch route unlocks the final event decision');
console.log('Historical field actions persist consequences, complete real objectives once, and reject invalid/repeated choices.');
