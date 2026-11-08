import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = path => fs.readFile(new URL(path, import.meta.url), 'utf8');
const catalog = JSON.parse(await read('../rpg/data/v38-historical-events.json'));
const play = JSON.parse(await read('../rpg/data/historical-scene-play.json'));
assert.equal(catalog.events.length, 3);
assert.equal(play.events.length, 3);
const expectedIds = ['EMANCIPATION_1861', 'GOGOL_INSPECTOR_1836', 'SENATE_SQUARE_1825'];
assert.deepEqual(catalog.events.map(event => event.id).sort(), expectedIds);
for (const event of catalog.events) {
  assert.match(event.sourceUrl, /^https:\/\//);
  assert.ok(event.sourceLabelKo && event.sourceRangeKo && event.historyKo);
}
const emancipation = catalog.events.find(event => event.id === 'EMANCIPATION_1861');
assert.equal(emancipation.date, '1861-03-03', 'February 19 Julian is March 3 Gregorian');
assert.equal(emancipation.dateLabelKo, '1861년 2월 19일(당시 러시아 역법)');
for (const scene of play.events) {
  const catalogEvent = catalog.events.find(event => event.id === scene.eventId);
  assert.ok(catalogEvent);
  assert.equal(scene.maps.length, 3, `${scene.eventId} has three physically connected areas`);
  assert.equal(scene.backgrounds.length, scene.maps.length);
  assert.equal(scene.zoneTitlesKo.length, scene.maps.length);
  assert.ok(scene.actors.length >= 8, `${scene.eventId} has a living crowd beyond four speaking roles`);
  assert.ok(new Set(scene.actors.map(person => person.id)).size === scene.actors.length);
  assert.ok(scene.objectives.length >= 5, `${scene.eventId} has several side objectives`);
  assert.ok(scene.choices.length >= 3, `${scene.eventId} offers consequential closeout decisions`);
  for (const actor of scene.actors) {
    assert.ok(actor.nameKo && actor.templateId && actor.lines.length >= 2);
    assert.ok(scene.objectives.some(objective => objective.id === actor.objectiveId));
    assert.ok(actor.lines.every(line => line.length > 18));
  }
  for (const choice of scene.choices) assert.ok(choice.directionKo && choice.textKo);
  for (const background of scene.backgrounds) {
    const map = JSON.parse(await read(`../rpg/maps/${background}.json`));
    assert.ok(map.layers.some(layer => layer.name === 'Collision' && Array.isArray(layer.data)));
  }
}
console.log('V38 walkable historical event catalog passed: three connected, multi-area scenes, 10 speaking composites each, side objectives, sourced fixed outcomes, and corrected 1861 date.');
