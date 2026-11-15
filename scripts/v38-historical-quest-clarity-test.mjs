import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { historicalParticipantGuide, historicalSessionProgressLabelKo } from '../rpg/engine/historical-session.mjs';
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
    assert.ok(guide.questStepsKo?.length >= 5 && guide.questStepsKo.length <= 6, `${scene.eventId}/${actor.id} gives a clear, visible route`);
    assert.ok(guide.questStepsKo?.[0].startsWith('갈 곳 · ') && guide.questStepsKo[0].includes(guide.placeKo));
    assert.ok(guide.questStepsKo?.[1].startsWith('말 걸기 · ') && guide.questStepsKo[1].includes(guide.talkToNamesKo[0]), `${scene.eventId}/${actor.id} names the first person to approach`);
    assert.ok(guide.questStepsKo?.[1].includes(guide.conversationPromptKo), `${scene.eventId}/${actor.id} names a concrete conversation question`);
    assert.ok(guide.questStepsKo?.[2].includes('대화 기록') && guide.questStepsKo[2].includes('반응을 선택'), `${scene.eventId}/${actor.id} states what makes a conversation count`);
    assert.ok(guide.questStepsKo?.some(step => step.startsWith('현장 행동 · ') && step.includes(guide.propKo)), `${scene.eventId}/${actor.id} names the object/action to complete`);
    assert.ok(guide.questStepsKo?.at(-1).startsWith('완료 조건 · '), `${scene.eventId}/${actor.id} ends with the exact completion condition`);
    assert.ok(guide.conversationPromptKo?.length >= 15, `${scene.eventId}/${actor.id} gives the player a concrete first question`);
    assert.ok(guide.conversationPromptKo.includes(actor.sceneTopicsKo[0]), `${scene.eventId}/${actor.id} asks about the character's specific scene topic`);
    assert.ok(guide.conversationPromptKo.includes(scene.fieldActions.find(item => item.id === guide.actionId).options[0].labelKo), `${scene.eventId}/${actor.id} anchors the question to a real next action`);
    assert.doesNotMatch(guide.conversationPromptKo, /지금 무슨 일이에요/u, `${scene.eventId}/${actor.id} avoids a context-free stock question`);
    assert.ok(guide.afterConversationKo?.includes(guide.propKo) && guide.afterConversationKo.includes('E'), `${scene.eventId}/${actor.id} sees the exact next action after a recorded reply`);
    assert.ok(guide.completionKo?.includes(guide.propKo) && /퀘스트 완료/u.test(guide.completionKo), `${scene.eventId}/${actor.id} explains that the talk alone is not enough and names the completion condition`);
    assert.ok(guide.actionChoiceLabelsKo?.length >= 2, `${scene.eventId}/${actor.id} shows the exact field choices that complete the quest`);
    assert.ok(guide.questStepsKo.some(step => step.includes(guide.conversationPromptKo)), `${scene.eventId}/${actor.id} includes the ready-to-use question in the quest steps`);
    const action = scene.fieldActions.find(item => item.id === guide.actionId);
    if (action.requiredActorId) {
      const alreadyInRole = historicalParticipantGuide(scene, actor.id, {}, action.requiredActorId);
      assert.doesNotMatch(alreadyInRole.afterConversationKo, /로 바꾸고/u, `${scene.eventId}/${actor.id} does not tell a player already in the required role to switch again`);
      const wrongRole = historicalParticipantGuide(scene, actor.id, {}, 'different-role');
      assert.match(wrongRole.afterConversationKo, new RegExp(`${guide.requiredActorNameKo}로 바꾸고`, 'u'), `${scene.eventId}/${actor.id} names the necessary body switch`);
    }
    if (scene.actorQuestGuides?.[actor.id]) assert.equal(action?.id, scene.actorQuestGuides[actor.id].actionId, `${scene.eventId}/${actor.id} follows its authored quest`);
    else assert.equal(action?.objectiveId, actor.objectiveId, `${scene.eventId}/${actor.id} is not sent to an unrelated task`);
    if (scene.eventId !== 'EMANCIPATION_1861') {
      const taskKo = scene.actorQuestGuides[actor.id].taskKo;
      assert.ok(taskKo.length <= 100 && /중 하나를 고른다$/u.test(taskKo),
        `${scene.eventId}/${actor.id} has a concise, natural task sentence`);
    }
  }
  const progress = historicalSessionProgressLabelKo(scene, { spokenActorIds: [], completedObjectives: [], actionOutcomes: {}, visitedMapIds: [], elapsedMinutes: 0 });
  assert.match(progress, /대화 0\/\d+/u);
  assert.match(progress, /현장 일 0\/\d+/u);
  assert.match(progress, /역할별 결정 0\/\d+/u);
  assert.match(progress, new RegExp(`구역 0/${scene.maps.length}`, 'u'));
  if (scene.conclusionRequirements?.minimumElapsedMinutes) assert.match(progress, new RegExp(`현장 시간 0/${scene.conclusionRequirements.minimumElapsedMinutes}분`, 'u'));
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
