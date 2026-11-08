import assert from 'node:assert/strict';
import { historicalConversationChoices } from '../rpg/data/historical-conversation-choices.mjs';
import { readFile } from 'node:fs/promises';

const scenes = JSON.parse(await readFile(new URL('../rpg/data/historical-scene-play.json', import.meta.url), 'utf8')).events;
const data = JSON.parse(await readFile(new URL('../rpg/data/historical-conversation-choices.json', import.meta.url), 'utf8'));
for (const scene of scenes) {
  for (const objective of scene.objectives) {
    const options = historicalConversationChoices(data, scene.eventId, objective.id);
    assert.ok(options.length >= 3, `${scene.eventId}/${objective.id} needs at least three distinct responses`);
    assert.equal(new Set(options.map(option => option.id)).size, options.length);
    for (const option of options) {
      assert.ok(option.labelKo.length >= 8, `${scene.eventId}/${objective.id}/${option.id} names a real stance`);
      assert.ok(option.directionKo?.length >= 24, `${option.id} discloses who sees it and the immediate cost`);
      assert.ok(option.reactionKo?.length >= 20, `${option.id} gives the group a concrete reaction`);
      assert.ok(!/같이 해결할 방법|다른 사람의 생각도 듣고 정한다|이야기를 듣고 자리를 옮긴다/.test(option.labelKo));
    }
  }
}
console.log('Historical conversations expose distinct event-specific judgments for every field objective.');
