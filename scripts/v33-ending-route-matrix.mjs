import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { advanceStudy, beginExam, chooseCirclePath, completeLearning, submitExam } from '../rpg/engine/learning-life.mjs';

const require = createRequire(import.meta.url);
const engine = require('../rpg/engine/game-state.js');
const root = process.cwd();
const read = relative => fs.readFile(path.join(root, relative), 'utf8').then(JSON.parse);
const maps = Object.fromEntries(await Promise.all((await fs.readdir(path.join(root, 'rpg/maps'))).filter(file => file.endsWith('.json')).map(async file => [path.basename(file, '.json'), await read(`rpg/maps/${file}`)])));
const cards = await Promise.all((await fs.readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => read(`rpg/characters/${file}`)));
const quests = await Promise.all(['printshop-article', 'public-discourse-1848', 'circle-investigation-1849', 'circle-letter-1849-may', 'literary-dead-souls'].map(name => read(`rpg/quests/${name}.json`)));
const campaign = await read('rpg/quests/campaign.json');
const learningExam = await read('rpg/data/learning-exam.json');

function finishLearning(state, endingId, variant) {
  const circleChoice = endingId === 'HERZEN' ? 'declined' : endingId === 'KHOMYAKOV' ? 'attended' : variant ? 'attended-notes' : 'attended';
  let progress = chooseCirclePath(state.learning, circleChoice);
  for (let index = 0; index < learningExam.learningUnits.length; index++) progress = advanceStudy(progress, learningExam);
  const action = endingId === 'HERZEN' ? 'defer' : endingId === 'KHOMYAKOV' ? 'help-peer' : 'sit';
  progress = beginExam(progress, action);
  if (action === 'sit') {
    const answers = Object.fromEntries(learningExam.questions.map((question, index) => {
      const correctOptionId = learningExam.answerKey[question.id];
      const deliberatelyWrong = endingId === 'BELINSKY' && index >= 2;
      const selectedOptionId = deliberatelyWrong
        ? question.options.find(option => option.id !== correctOptionId)?.id
        : correctOptionId;
      assert.ok(selectedOptionId && question.options.some(option => option.id === selectedOptionId), `${question.id} must use an authored option`);
      return [question.id, selectedOptionId];
    }));
    progress = submitExam(progress, answers, learningExam);
  }
  progress = completeLearning(progress);
  assert.equal(progress.phase, 'complete');
  state.learning = progress;
  state.ledger.push({ eventId: `LEARNING_${state.ledger.length + 1}`, eventType: 'LEARNING_ARC_COMPLETED', date: state.world.date, circleLearning: circleChoice, examOutcome: progress.examOutcome, promotionStatus: progress.promotionStatus, sourceIds: learningExam.learningUnits.flatMap(unit => unit.sourceIds) });
  return state;
}

function parkNear(state, hostId, mapId) {
  const map = maps[mapId], host = state.hosts[hostId];
  const object = map.layers.find(layer => layer.name === 'NPCs').objects.find(item => Object.fromEntries((item.properties ?? []).map(p => [p.name, p.value])).hostId === hostId);
  assert.ok(object, `${hostId} must have an on-map person object in ${mapId}`);
  const position = { x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) };
  state.world.currentMapId = mapId; host.mapId = mapId; host.position = { ...position }; state.player.position = { ...position }; state.player.embodiment = null;
  const possessed = engine.possessHost(state, hostId, map);
  assert.equal(possessed.ok, true, `${hostId} can be possessed at its authored map object`);
  return possessed.state;
}

function readForHost(state, sourceId, archiveSourceIds) {
  const result = engine.recordSourceRead(state, sourceId, maps, archiveSourceIds);
  assert.equal(result.ok, true, `source ${sourceId} available in chapter ${state.world.chapterId}`);
  return result.state;
}

function takeAction(state, questId, actionId) {
  const quest = quests.find(item => item.id === questId), action = quest.actions.find(item => item.id === actionId), hostId = state.player.embodiment;
  assert.ok(action && action.hostIds.includes(hostId), `${hostId} is authorized for ${actionId}`);
  const map = maps[quest.entry.mapId], target = map.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
  assert.ok(target, `quest target ${quest.entry.objectId} exists`);
  const position = { x: Math.floor(target.x / 16), y: Math.floor(target.y / 16) };
  state.player.position = position; state.hosts[hostId].position = { ...position };
  const result = engine.performQuestAction(state, { questId, hostId, actionId, objectId: target.id }, { quests, maps });
  assert.equal(result.ok, true, `perform ${questId}/${actionId}`);
  assert.equal(result.state.quests[questId].status, 'resolved');
  return result.state;
}

export function buildRoute(endingId, variant) {
  let state = engine.createInitialState({ maps, hostCards: cards, quests });
  const historicalArcs = campaign.arcs;
  state = parkNear(state, 'nekrasov_reconstruction', 'printshop');
  state = engine.releaseHost(state, maps.printshop).state;
  state = parkNear(state, 'printer_ekaterina', 'printshop');
  const arc1 = historicalArcs[0];
  state = readForHost(state, arc1.sources[0], arc1.sources);
  state = readForHost(state, arc1.sources[1], arc1.sources);
  const action1 = endingId === 'BELINSKY' || variant % 2 ? 'ASK_FOR_SOURCE' : 'HOLD_FOR_CORRECTION';
  if (action1 === 'ASK_FOR_SOURCE' && !engine.knowledgeForHost(state, 'printer_ekaterina').includes('LIT-TURGENEV-KHOR-KALYNYCH-1847')) state = readForHost(state, 'LIT-TURGENEV-KHOR-KALYNYCH-1847', arc1.sources);
  state = takeAction(state, 'PRINTSHOP_PROOF_1847', action1);
  state = engine.advanceChapter(state, historicalArcs[1].id, campaign, maps).state;

  const arc2 = historicalArcs[1];
  state = parkNear(state, 'courier_pavel', 'printshop');
  state = readForHost(state, arc2.sources[0], arc2.sources);
  state = readForHost(state, arc2.sources[1], arc2.sources);
  let action2;
  if (endingId === 'HERZEN') action2 = 'CARRY_NOTICE_ABROAD';
  else if (endingId === 'KHOMYAKOV') action2 = 'KEEP_LOCAL_READING';
  else action2 = variant % 2 ? 'KEEP_LOCAL_READING' : 'HOLD_NOTICE';
  if (action2 === 'CARRY_NOTICE_ABROAD') {
    if (!engine.knowledgeForHost(state, 'courier_pavel').includes(arc2.sources[0])) state = readForHost(state, arc2.sources[0], arc2.sources);
  } else if (action2 === 'KEEP_LOCAL_READING' && !['printer_ekaterina', 'bookseller_lev', 'nekrasov_reconstruction'].includes(state.player.embodiment)) {
    state = engine.releaseHost(state, maps.printshop).state;
    state = parkNear(state, variant % 2 ? 'bookseller_lev' : 'nekrasov_reconstruction', 'printshop');
  } else if (action2 === 'HOLD_NOTICE' && !['printer_ekaterina', 'bookseller_lev', 'nekrasov_reconstruction'].includes(state.player.embodiment)) {
    state = engine.releaseHost(state, maps.printshop).state;
    state = parkNear(state, 'printer_ekaterina', 'printshop');
  }
  state = takeAction(state, 'PUBLIC_DISCOURSE_1848', action2);
  state = engine.advanceChapter(state, historicalArcs[2].id, campaign, maps).state;

  const arc3 = historicalArcs[2];
  state = parkNear(state, 'clerk_alexei', 'chancery');
  state = readForHost(state, arc3.sources[0], [arc3.sources[0]]);
  const action3 = endingId === 'UVAROV' ? 'FILE_OFFICIAL_REPORT' : 'REFUSE_NAMING';
  state = takeAction(state, 'CIRCLE_INVESTIGATION_1849', action3);
  state = engine.advanceCampaignDate(state, '1849-05-05', campaign, quests).state;
  state = readForHost(state, arc3.sources[1], [arc3.sources[1]]);
  const action4 = endingId === 'DOSTOEVSKY_PETRASHEVSKY' ? 'REFUSE_NAMING' : 'PRESERVE_LETTER';
  state = takeAction(state, 'CIRCLE_LETTER_1849_MAY', action4);
  state = finishLearning(state, endingId, variant);
  const stateBeforeEnding = state;
  assert.doesNotThrow(() => engine.loadGame(engine.saveGame(stateBeforeEnding), { maps, hostCards: cards, quests, learningExam }), `${endingId} route must survive a browser save/reload`);
  const ending = engine.resolveEnding(state, endingId, campaign);
  assert.equal(ending.ok, true, `resolve ${endingId}, variant ${variant}: ${ending.reason ?? ''}`);
  assert.equal(ending.state.endingId, endingId);
  assert.equal(ending.state.world.immutableOutcomes.SOVREMENNIK_1847_ISSUE_PUBLICATION, 'the attested 1847 issue remains historically published');
  assert.equal(ending.state.world.immutableOutcomes.PETRASHEVSKY_ARRESTS_1849, 'the documented arrests and sentences remain fixed historical outcomes');
  assert.equal(new Set(ending.state.world.possessionHistory.map(item => item.hostId).filter(id => ending.state.hosts[id].kind !== 'LITERARY')).size >= 4, true);
  assert.equal(new Set(ending.state.ledger.flatMap(item => item.sourceIds ?? (item.sourceId ? [item.sourceId] : []))).size >= 3, true);
  return {
    stateBeforeEnding,
    endingState: ending.state,
    summary: { endingId, variant, circleLearning: ending.state.learning.circleLearning, examOutcome: ending.state.learning.examOutcome, examCorrectCount: ending.state.learning.examCorrectCount, promotionStatus: ending.state.learning.promotionStatus, actions: ending.state.ledger.filter(item => item.actionId).map(item => item.actionId), sourcesRead: ending.state.ledger.filter(item => item.sourceId).map(item => item.sourceId), hosts: [...new Set(ending.state.world.possessionHistory.map(item => item.hostId))], date: ending.state.world.date },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const routes = [];
  for (const ending of campaign.endings) for (let variant = 0; variant < 2; variant++) routes.push(buildRoute(ending.id, variant).summary);
  assert.equal(routes.length, 10);
  assert.deepEqual(new Set(routes.map(route => route.endingId)), new Set(campaign.endings.map(ending => ending.id)));
  const report = { schemaVersion: 'V33_ENDING_ROUTE_MATRIX_V1', status: 'PASS', distinctEndingIds: [...new Set(routes.map(route => route.endingId))], routeCount: routes.length, routes };
  await fs.mkdir(path.join(root, 'artifacts/v33'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts/v33/ENDING_ROUTE_MATRIX.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, routeCount: report.routeCount, endings: report.distinctEndingIds }, null, 2));
}
