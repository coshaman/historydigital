import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { performHistoricalAction } from '../rpg/engine/historical-session.mjs';

const play = JSON.parse(await fs.readFile(new URL('../rpg/data/historical-scene-play.json', import.meta.url), 'utf8'));
for (const scene of play.events) {
  const action = scene.fieldActions[0];
  const option = action.options[0];
  const session = { historicalSession: { eventId: scene.eventId, choices: [], completedObjectives: [], actionOutcomes: {} },
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
console.log('Historical field actions persist consequences, complete real objectives once, and reject invalid/repeated choices.');
