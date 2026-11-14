import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { historicalParticipantGuide } from '../rpg/engine/historical-session.mjs';
import { buildHistoricalSceneLayout } from '../rpg/engine/historical-scene-layout.mjs';
const catalog = JSON.parse(await fs.readFile(new URL('../rpg/data/v38-historical-events.json', import.meta.url), 'utf8')).events;

const scenes = JSON.parse(await fs.readFile(new URL('../rpg/data/historical-scene-play.json', import.meta.url), 'utf8')).events;
for (const scene of scenes) {
  for (const actor of scene.actors) {
    assert.ok(scene.actorQuestGuides?.[actor.id]?.titleKo && scene.actorQuestGuides?.[actor.id]?.taskKo,
      `${scene.eventId}/${actor.id} exposes a named personal task instead of only a broad event objective`);
    const guide = historicalParticipantGuide(scene, actor.id, { actionOutcomes: {}, completedObjectives: [] });
    assert.ok(guide, `${scene.eventId}/${actor.id} has a playable task`);
    assert.ok(guide.objectiveTitleKo?.length >= 8, `${scene.eventId}/${actor.id} names the task plainly`);
    assert.ok(guide.actionKo?.length >= 12, `${scene.eventId}/${actor.id} says what to do`);
    assert.ok(guide.placeKo?.length >= 2, `${scene.eventId}/${actor.id} names the scene location`);
    assert.ok(guide.talkToNamesKo.length >= 1, `${scene.eventId}/${actor.id} says whom to approach`);
    assert.ok(guide.propKo?.length >= 3, `${scene.eventId}/${actor.id} names a physical action object`);
    if (guide.requiredActorNameKo) assert.ok(scene.actors.some(person => person.nameKo === guide.requiredActorNameKo));
    assert.ok(guide.questStepsKo?.length >= 3 && guide.questStepsKo.length <= 4, `${scene.eventId}/${actor.id} gives a short, visible route`);
    assert.ok(guide.questStepsKo?.[0].startsWith('갈 곳 · ') && guide.questStepsKo[0].includes(guide.placeKo));
    assert.ok(guide.questStepsKo?.[1].startsWith('말 걸기 · ') && guide.questStepsKo[1].includes(guide.talkToNamesKo[0]), `${scene.eventId}/${actor.id} names the first person to approach`);
    assert.ok(guide.questStepsKo?.at(-1).startsWith('할 일 · ') && guide.questStepsKo.at(-1).includes(guide.propKo), `${scene.eventId}/${actor.id} names the object/action to complete`);
    const action = scene.fieldActions.find(item => item.id === guide.actionId);
    if (scene.actorQuestGuides?.[actor.id]) assert.equal(action?.id, scene.actorQuestGuides[actor.id].actionId, `${scene.eventId}/${actor.id} follows its authored quest`);
    else assert.equal(action?.objectiveId, actor.objectiveId, `${scene.eventId}/${actor.id} is not sent to an unrelated task`);
    if (scene.eventId !== 'EMANCIPATION_1861') {
      const taskKo = scene.actorQuestGuides[actor.id].taskKo;
      assert.ok(taskKo.length <= 100 && /중 하나를 고른다$/u.test(taskKo),
        `${scene.eventId}/${actor.id} has a concise, natural task sentence`);
    }
  }
  for (const choice of scene.choices) {
    assert.ok(choice.label.length >= 6 && choice.label.length <= 30,
      `${scene.eventId}/${choice.id} is a short, direct visual-novel choice`);
    assert.equal(choice.subcopy, undefined, `${scene.eventId}/${choice.id} has no small-print explanation`);
    assert.equal(choice.directionKo, undefined, `${scene.eventId}/${choice.id} has no small-print explanation`);
    assert.ok(choice.textKo?.length >= 8, `${scene.eventId}/${choice.id} records the selected action clearly`);
  }
  for (const actor of scene.actors) {
    assert.ok(actor.lines.length >= 3, `${scene.eventId}/${actor.id} has multiple authored dialogue examples`);
    assert.ok(actor.lines.every(line => line.length <= 118), `${scene.eventId}/${actor.id} speaks in short, natural turns`);
    assert.ok(actor.voiceProfileKo?.length >= 24, `${scene.eventId}/${actor.id} has an identifiable speech pattern`);
    assert.ok(actor.sceneWantKo?.length >= 12, `${scene.eventId}/${actor.id} has an immediate scene want`);
    assert.ok(actor.privateTensionKo?.length >= 12, `${scene.eventId}/${actor.id} has a personal tension beyond a flat trait`);
    assert.ok(actor.sceneTopicsKo?.length >= 2, `${scene.eventId}/${actor.id} has concrete in-scene dialogue hooks`);
  }
  if (scene.eventId === 'EMANCIPATION_1861') {
    const backgrounds = ['nevsky', 'market-quay', 'workyard'];
    const maps = Object.fromEntries(await Promise.all(backgrounds.map(async id => [id,
      JSON.parse(await fs.readFile(new URL(`../rpg/maps/${id}.json`, import.meta.url), 'utf8'))])));
    const laidOut = structuredClone(scene);
    buildHistoricalSceneLayout(laidOut, catalog.find(item => item.id === scene.eventId), maps);
    for (const actor of scene.actors) {
      const authored = scene.actorQuestGuides?.[actor.id];
      assert.ok(authored?.titleKo && authored.taskKo, `${actor.id} has an individual quest title and concrete action`);
      assert.ok(scene.fieldActions.some(action => action.id === authored.actionId), `${actor.id} has a real field action as their task`);
      assert.ok(authored.talkToActorIds?.length, `${actor.id} has a named person to approach`);
      assert.ok(authored.talkToActorIds.every(id => scene.actors.some(person => person.id === id)), `${actor.id} only points to present characters`);
      const guide = historicalParticipantGuide(scene, actor.id, { actionOutcomes: {}, completedObjectives: [] });
      assert.equal(guide.talkToNamesKo.length, 1, `${actor.id} points to one clear first contact`);
      assert.ok(guide.objectiveTitleKo === authored.titleKo && guide.actionKo === authored.taskKo, `${actor.id} roster presents the authored, specific quest`);
      assert.ok(authored.talkToActorIds.every(id => guide.talkToNamesKo.some(name => name.includes(scene.actors.find(person => person.id === id).nameKo))));
      assert.equal(guide.actionId, authored.actionId, `${actor.id} keeps one stable quest instead of changing tasks after a visit`);
      const laidOutAction = laidOut.fieldActions.find(action => action.id === authored.actionId);
      const laidOutActor = laidOut.actors.find(person => person.id === actor.id);
      const laidOutContact = laidOut.actors.find(person => person.id === authored.talkToActorIds[0]);
      assert.equal(laidOutActor.mapId, laidOutAction.mapId, `${actor.id} starts in the zone where their quest object is`);
      assert.equal(laidOutContact.mapId, laidOutAction.mapId, `${actor.id}'s named contact is physically in the quest zone`);
      const finishedGuide = historicalParticipantGuide(scene, actor.id, {
        actionOutcomes: { [authored.actionId]: 'completed' }, completedObjectives: [],
      });
      assert.equal(finishedGuide.completed, true, `${actor.id} quest remains clearly marked complete after its action`);
      assert.equal(finishedGuide.actionId, authored.actionId, `${actor.id} does not switch to an unrelated task after completion`);
      assert.ok(actor.sceneWantKo?.length >= 12, `${actor.id} has a concrete immediate want for character dialogue`);
      assert.ok(actor.privateTensionKo?.length >= 12, `${actor.id} has a human contradiction or pressure, not a flat trait list`);
      assert.ok(actor.sceneTopicsKo?.length >= 2, `${actor.id} has specific conversational hooks from this scene`);
    }
    for (const action of scene.fieldActions.filter(item => item.requiredActorId)) {
      const requiredActor = laidOut.actors.find(person => person.id === action.requiredActorId);
      assert.equal(requiredActor?.mapId, action.mapId,
        `${action.id} places its required role in the zone where the player must perform it`);
    }
    for (const action of scene.fieldActions) for (const option of action.options) {
      assert.ok(option.labelKo.length <= 28, `${action.id}/${option.id} is a short, decisive choice`);
      assert.equal(option.subcopy, undefined, `${action.id}/${option.id} has no small-print subcopy`);
    }
    const event = catalog.find(item => item.id === scene.eventId);
    assert.deepEqual(scene.choices.map(({ id, label, textKo }) => ({ id, label, textKo })),
      event.choices.map(({ id, label, textKo }) => ({ id, label, textKo })), 'the final high-stakes choices match their scenario aftermath');
    assert.ok(scene.choices.some(choice => /공동체/.test(choice.label))
      && scene.choices.some(choice => /농가/.test(choice.label))
      && scene.choices.some(choice => /봉기/.test(choice.label)),
      'the final decision puts communal land, household ownership, and revolt on the table');
    assert.ok(scene.choices.some(choice => /봉기|봉쇄|폐지|무상/.test(choice.label)),
      'the final decision includes a state-scale turning point rather than only a local errand');
    assert.ok(scene.actors.every(actor => typeof actor.voiceProfileKo === 'string' && actor.voiceProfileKo.length >= 24),
      'every participant has a concrete speaking voice for AI scene dialogue');
    assert.ok(scene.actors.every(actor => actor.lines.length >= 3),
      'each character has several dialogue examples for live role-play');
    const sentenceEndings = new Set(scene.actors.map(actor => actor.lines[0].match(/[^\s.!?…]+[.!?…]?$/u)?.[0]));
    assert.ok(sentenceEndings.size >= 8, 'the cast does not collapse into a single Korean speech register');
    assert.ok(scene.choices.every(choice => choice.label.length <= 24), 'the climax choices stay brief like visual-novel dialogue');
    assert.ok(scene.choices.some(choice => /토지|농가/.test(choice.label))
      && scene.choices.some(choice => /봉기|거부/.test(choice.label)),
      'the finale asks for a large political choice, not another local errand');
  }
}
console.log('Historical event roster guidance gives a clear route; choices stay short and dialogue is concise.');
