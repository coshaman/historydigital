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
  assert.equal(scene.actors.length, 18, `${scene.eventId} has eighteen movable scene participants`);
  assert.deepEqual(scene.actors.reduce((counts, _actor, index) => { counts[index % scene.maps.length]++; return counts; }, [0, 0, 0]), [6, 6, 6],
    `${scene.eventId} places six participants in each zone`);
  assert.equal(catalogEvent.playableParticipantCount, 18);
  assert.deepEqual(catalogEvent.cast, scene.actors.map(actor => actor.nameKo));
  assert.ok(new Set(scene.actors.map(person => person.id)).size === scene.actors.length);
  const endingOf = line => line.match(/(습니다|십시오|군요|겠지요|겠소|어요|아요|네요|까요|게요|소|오|네|지|다|요)(?:[.!?…]+)?$/)?.[1] ?? 'unmatched';
  const voiceSignatures = scene.actors.map(actor => `${actor.lines.map(endingOf).join('/')}:${Math.round(actor.lines.reduce((sum, line) => sum + line.length, 0) / actor.lines.length / 10) * 10}`);
  assert.ok(new Set(scene.actors.flatMap(actor => actor.lines.map(endingOf))).size >= 6, `${scene.eventId} dialogue must vary sentence endings`);
  assert.ok(new Set(voiceSignatures).size >= 8, `${scene.eventId} speakers need distinguishable rhythm and endings`);
  assert.ok(scene.objectives.length >= 9, `${scene.eventId} has three extra, event-specific side objectives`);
  assert.ok(scene.fieldActions?.length >= 9, `${scene.eventId} needs three additional walkable group encounters`);
  const roleActions = scene.fieldActions.filter(action => action.requiredActorId);
  assert.ok(roleActions.length >= 6, `${scene.eventId} has at least six body-specific missions`);
  assert.ok(roleActions.reduce((counts, action) => { counts[scene.maps.indexOf(action.mapId)]++; return counts; }, [0, 0, 0]).every(count => count >= 2),
    `${scene.eventId} provides multiple role missions in every zone`);
  for (const action of roleActions) {
    const actorIndex = scene.actors.findIndex(actor => actor.id === action.requiredActorId);
    assert.ok(actorIndex >= 0, `${scene.eventId}/${action.id} uses a person in the scene cast`);
  }
  assert.deepEqual(scene.choices.map(({ id, label, textKo }) => ({ id, label, textKo })),
    catalogEvent.choices.map(({ id, label, textKo }) => ({ id, label, textKo })),
    `${scene.eventId} final choices are the authored, visible consequential decisions`);
  assert.ok([...catalogEvent.rounds.flatMap(round => round.choices), ...scene.choices].every(choice =>
    !/목격과 전언|목격한 일과 전해 들은 말|신고와 목격이 섞인 종이/.test(`${choice.label} ${choice.directionKo ?? ''} ${choice.reactionKo ?? ''}`)),
    `${scene.eventId} does not fall back to the obsolete report/witness meta motif`);
  assert.ok(scene.choices.length >= 3, `${scene.eventId} offers consequential closeout decisions`);
  assert.equal(new Set(scene.fieldActions.map(action => action.id)).size, scene.fieldActions.length);
  for (const action of scene.fieldActions) {
    assert.ok(scene.maps.includes(action.mapId), `${scene.eventId}/${action.id} is in an episode area`);
    assert.ok(action.propKo && action.promptKo && action.objectiveId);
    assert.ok(scene.objectives.some(objective => objective.id === action.objectiveId));
    assert.ok(Array.isArray(action.options) && action.options.length >= 2, `${action.id} has real alternatives`);
    for (const option of action.options) {
      assert.ok(option.id && option.labelKo && option.directionKo && option.textKo);
      if (action.groupEncounter) assert.ok(option.groupReactionKo?.length >= 40, `${action.id}/${option.id} needs a spoken group reaction`);
    }
    if (action.groupEncounter) {
      assert.ok(action.gatherActorIds?.length >= 3, `${action.id} gathers several movable participants`);
      assert.ok(action.gatherActorIds.every(id => scene.actors.some(actor => actor.id === id)));
    }
  }
  assert.deepEqual(scene.conclusionRequirements, {
    spokenActors: scene.eventId === 'EMANCIPATION_1861' ? 10 : 12,
    completedObjectives: 7, requiredRoleActions: 6, minimumElapsedMinutes: 24,
  });
  for (const actor of scene.actors) {
    assert.ok(actor.nameKo && actor.templateId && actor.lines.length >= 2);
    assert.ok(scene.objectives.some(objective => objective.id === actor.objectiveId));
    assert.ok(actor.lines.every(line => line.length > 18));
  }
  if (scene.eventId === 'EMANCIPATION_1861') {
    assert.ok(scene.actors.every(actor => actor.voiceProfileKo?.length >= 24), 'each emancipation participant gives AI a distinct voice direction');
    assert.ok(new Set(scene.actors.map(actor => actor.voiceProfileKo)).size >= 16, 'the cast has individually authored speech styles');
  }
  for (const choice of scene.choices) {
    assert.ok(choice.label && choice.textKo);
    assert.equal(choice.directionKo, undefined, `${scene.eventId}/${choice.id} has no small-print choice subcopy`);
  }
  for (const background of scene.backgrounds) {
    const map = JSON.parse(await read(`../rpg/maps/${background}.json`));
    assert.ok(map.layers.some(layer => layer.name === 'Collision' && Array.isArray(layer.data)));
  }
}
const emancipationChoices = catalog.events.find(event => event.id === 'EMANCIPATION_1861').choices;
assert.ok(emancipationChoices.every(choice => choice.aftermathKo?.length >= 30), 'each pivotal choice changes the fictional community’s immediate future');
assert.ok(emancipationChoices.every(choice => !choice.directionKo && !choice.subcopy), 'pivotal choices have no small-print explanation');
console.log('V38 walkable historical event catalog passed: three connected scenes, 18 movable participants per scene, extended body-specific missions, group encounters, and sourced fixed outcomes.');
