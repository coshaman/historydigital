import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { historicalParticipantGuide } from '../rpg/engine/historical-session.mjs';

const scenes = JSON.parse(await fs.readFile(new URL('../rpg/data/historical-scene-play.json', import.meta.url), 'utf8')).events;
for (const scene of scenes) {
  for (const actor of scene.actors) {
    const guide = historicalParticipantGuide(scene, actor.id, { actionOutcomes: {}, completedObjectives: [] });
    assert.ok(guide, `${scene.eventId}/${actor.id} has a playable task`);
    assert.ok(guide.objectiveTitleKo?.length >= 8, `${scene.eventId}/${actor.id} names the task plainly`);
    assert.ok(guide.actionKo?.length >= 12, `${scene.eventId}/${actor.id} says what to do`);
    assert.ok(guide.placeKo?.length >= 2, `${scene.eventId}/${actor.id} names the scene location`);
    assert.ok(guide.talkToNamesKo.length >= 1, `${scene.eventId}/${actor.id} says whom to approach`);
    assert.ok(guide.propKo?.length >= 3, `${scene.eventId}/${actor.id} names a physical action object`);
    if (guide.requiredActorNameKo) assert.ok(scene.actors.some(person => person.nameKo === guide.requiredActorNameKo));
    assert.deepEqual(guide.questStepsKo?.length, 3, `${scene.eventId}/${actor.id} gives a visible three-step route`);
    assert.ok(guide.questStepsKo?.[0].startsWith('이동 · ') && guide.questStepsKo[0].includes(guide.placeKo));
    assert.ok(guide.questStepsKo?.[1].startsWith('대화 · ') && guide.questStepsKo[1].includes(guide.talkToNamesKo[0]), `${scene.eventId}/${actor.id} names the first person to approach`);
    assert.ok(guide.questStepsKo?.[2].startsWith('행동 · ') && guide.questStepsKo[2].includes(guide.propKo), `${scene.eventId}/${actor.id} names the object/action to complete`);
    const action = scene.fieldActions.find(item => item.id === guide.actionId);
    assert.equal(action?.objectiveId, actor.objectiveId, `${scene.eventId}/${actor.id} is not sent to an unrelated task`);
  }
  for (const choice of scene.choices) {
    assert.ok(choice.label.length >= 6 && choice.label.length <= 32,
      `${scene.eventId}/${choice.id} is a short, direct visual-novel choice`);
    assert.equal(choice.subcopy, undefined, `${scene.eventId}/${choice.id} has no small-print explanation`);
    assert.equal(choice.directionKo, undefined, `${scene.eventId}/${choice.id} has no small-print explanation`);
    assert.ok(choice.textKo.includes(choice.label.slice(0, 5)) || scene.eventId !== 'EMANCIPATION_1861',
      `${scene.eventId}/${choice.id} records the selected action clearly`);
  }
  for (const actor of scene.actors) {
    assert.ok(actor.lines.length >= 2, `${scene.eventId}/${actor.id} has authored scene dialogue`);
    assert.ok(actor.lines.every(line => line.length <= 118), `${scene.eventId}/${actor.id} speaks in short, natural turns`);
  }
}
console.log('Historical event roster guidance gives a clear route; choices stay short and dialogue is concise.');
