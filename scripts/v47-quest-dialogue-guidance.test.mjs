import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { historicalParticipantGuide } from '../rpg/engine/historical-session.mjs';
import { shouldShowQuestTracker } from '../rpg/engine/discussion-quests.mjs';

const scenes = JSON.parse(await readFile(new URL('../rpg/data/historical-scene-play.json', import.meta.url), 'utf8')).events;

test('historical quest guide advances from the named conversation to its exact field action', () => {
  const scene = scenes.find(item => Object.keys(item.actorQuestGuides ?? {}).length > 0);
  const actorId = Object.keys(scene.actorQuestGuides)[0];
  const actor = scene.actors.find(item => item.id === actorId);
  const targetId = scene.actorQuestGuides[actorId].talkToActorIds[0];
  const target = scene.actors.find(item => item.id === targetId);

  const before = historicalParticipantGuide(scene, actorId, { spokenActorIds: [] }, actorId);
  assert.equal(before.requiredDialogueActorId, targetId);
  assert.equal(before.conversationComplete, false);
  assert.match(before.currentStepKo, new RegExp(target.nameKo));
  assert.ok(before.currentStepKo.includes(before.conversationPromptKo.slice(1, -1)));
  assert.ok(before.completionKo.includes(before.propKo));
  for (const label of before.actionChoiceLabelsKo) assert.ok(before.completionKo.includes(label));

  const after = historicalParticipantGuide(scene, actorId, { spokenActorIds: [targetId] }, actorId);
  assert.equal(after.conversationComplete, true);
  assert.match(after.currentStepKo, new RegExp(after.propKo));
  assert.doesNotMatch(after.currentStepKo, /말 걸기/u);

  const action = scene.fieldActions.find(item => item.id === before.actionId);
  const finished = historicalParticipantGuide(scene, actorId, {
    spokenActorIds: [targetId], actionOutcomes: { [action.id]: action.options[0].id },
  }, actorId);
  assert.equal(finished.completed, true);
  assert.match(finished.currentStepKo, /퀘스트를 마쳤습니다/u);
});

test('quest instructions stay visible while the player is choosing an action', () => {
  assert.equal(shouldShowQuestTracker({ hasActions: true, keepVisible: true }), true);
  assert.equal(shouldShowQuestTracker({ hasActions: true, keepVisible: false }), false);
});
