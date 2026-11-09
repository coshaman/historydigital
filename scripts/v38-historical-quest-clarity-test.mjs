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
  }
  for (const choice of scene.choices) {
    assert.ok(choice.label.length >= 8 && choice.label.length <= 45,
      `${scene.eventId}/${choice.id} is a short, direct visual-novel choice`);
  }
}
console.log('Historical event roster guidance names each resident’s task, people to approach, and physical next step.');
