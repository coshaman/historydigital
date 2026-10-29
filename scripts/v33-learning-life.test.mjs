import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  advanceStudy,
  beginExam,
  buildLifeTimeline,
  chooseCirclePath,
  completeLearning,
  createLearningProgress,
  getExamQuestions,
  scoreExam,
  selectExamAnswer,
  submitExam,
} from '../rpg/engine/learning-life.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const gameState = require('../rpg/engine/game-state.js');

const exam = JSON.parse(await readFile(new URL('../narrative/ACT_III_LEARNING_EXAM.json', import.meta.url)));
const timeline = JSON.parse(await readFile(new URL('../rpg/data/life-simulation.json', import.meta.url)));

function reachExam(circleChoice) {
  let progress = chooseCirclePath(createLearningProgress(), circleChoice);
  for (let index = 0; index < exam.learningUnits.length; index++) progress = advanceStudy(progress, exam);
  return beginExam(progress, 'sit');
}

test('attendees, notes-only attendees, and non-attendees reach the same sourced five-question exam', () => {
  const attended = reachExam('attended');
  const notes = reachExam('attended-notes');
  const publicPrep = reachExam('declined');
  assert.deepEqual(getExamQuestions(attended, exam), exam.questions);
  assert.deepEqual(getExamQuestions(notes, exam), exam.questions);
  assert.deepEqual(getExamQuestions(publicPrep, exam), exam.questions);
  assert.deepEqual(getExamQuestions(attended, exam).map(question => question.id), getExamQuestions(publicPrep, exam).map(question => question.id));
});

test('learning progress advances through all units and can be saved and resumed', () => {
  let progress = chooseCirclePath(createLearningProgress(), 'attended');
  assert.equal(progress.phase, 'learning');
  progress = advanceStudy(progress, exam);
  const restored = structuredClone(JSON.parse(JSON.stringify(progress)));
  assert.equal(restored.lessonIndex, 1);
  assert.equal(advanceStudy(restored, exam).lessonIndex, 2);
});

test('five factual answers grade transparently at the 2/5 and 3/5 promotion boundary', () => {
  const ready = reachExam('attended');
  const correct = Object.fromEntries(exam.questions.map(question => [question.id, exam.answerKey[question.id]]));
  const wrongOption = question => question.options.find(option => option.id !== exam.answerKey[question.id]).id;
  const two = { ...correct, [exam.questions[2].id]: wrongOption(exam.questions[2]), [exam.questions[3].id]: wrongOption(exam.questions[3]), [exam.questions[4].id]: wrongOption(exam.questions[4]) };
  const three = { ...two, [exam.questions[2].id]: exam.answerKey[exam.questions[2].id] };
  assert.deepEqual(submitExam(ready, two, exam), { ...ready, phase: 'result', examAnswers: two, examCorrectCount: 2, examOutcome: 'failed', promotionStatus: 'not-promoted' });
  assert.deepEqual(submitExam(ready, three, exam), { ...ready, phase: 'result', examAnswers: three, examCorrectCount: 3, examOutcome: 'passed', promotionStatus: 'promoted' });
  assert.deepEqual(scoreExam({}, exam), { correctCount: 0, total: 5, passed: false, outcome: 'failed' });
  assert.equal(scoreExam(correct, exam).correctCount, 5);
  assert.deepEqual(scoreExam({ ...correct, extra: 'Q1-A' }, exam), { correctCount: 0, total: 5, passed: false, outcome: 'failed' });
  const malformedSubmission = submitExam(ready, { ...correct, extra: 'Q1-A' }, exam);
  assert.equal(malformedSubmission.examOutcome, 'failed');
  assert.equal(malformedSubmission.examCorrectCount, 0);
  assert.deepEqual(malformedSubmission.examAnswers, {}, 'unknown answer keys must not poison the persisted exam save');
  const invalidOption = submitExam(ready, { ...correct, [exam.questions[4].id]: 'UNKNOWN-OPTION' }, exam);
  assert.equal(invalidOption.examCorrectCount, 4);
  assert.equal(invalidOption.examOutcome, 'passed');
  assert.equal(Object.hasOwn(invalidOption.examAnswers, exam.questions[4].id), false, 'invalid options count as unanswered and are not persisted');
});

test('answer selection rejects unknown questions and options without changing progress', () => {
  const ready = reachExam('declined');
  assert.equal(selectExamAnswer(ready, 'UNKNOWN', 'Q1-A', exam), ready);
  assert.equal(selectExamAnswer(ready, exam.questions[0].id, 'UNKNOWN', exam), ready);
});

test('deferring and helping Pavel produce distinct unscored outcomes', () => {
  let progress = chooseCirclePath(createLearningProgress(), 'declined');
  for (let index = 0; index < exam.learningUnits.length; index++) progress = advanceStudy(progress, exam);
  const deferred = beginExam(progress, 'defer');
  const helped = beginExam(progress, 'help-peer');
  assert.equal(deferred.examOutcome, 'deferred');
  assert.equal(helped.examOutcome, 'helped-peer');
  for (const result of [deferred, helped]) {
    assert.equal(result.phase, 'result');
    assert.equal(result.examCorrectCount, null);
    assert.deepEqual(result.examAnswers, {});
    assert.equal(result.promotionStatus, 'pending');
    assert.equal(completeLearning(result).phase, 'complete');
  }
});

test('fictional life timeline is seven dated episodes and changes with exam, circle, and recorded work', () => {
  const base = {
    learning: { circleLearning: 'attended', examOutcome: 'passed', examCorrectCount: 4, promotionStatus: 'promoted' },
    ledger: [{ actionId: 'ASK_FOR_SOURCE' }, { actionId: 'KEEP_LOCAL_READING' }],
    hosts: { printer_ekaterina: { relations: { workshop: '신뢰가 쌓였다' } } },
    world: { possessionHistory: [{ hostId: 'clerk_alexei' }, { hostId: 'printer_ekaterina' }] },
  };
  const first = buildLifeTimeline(base, timeline);
  const repeated = buildLifeTimeline(base, timeline);
  const other = buildLifeTimeline({ ...base, learning: { ...base.learning, circleLearning: 'declined', examOutcome: 'failed', examCorrectCount: 2, promotionStatus: 'not-promoted' }, ledger: [{ actionId: 'CARRY_NOTICE_ABROAD' }] }, timeline);
  assert.equal(first.length, 7);
  assert.deepEqual(first, repeated);
  assert.deepEqual(first.map(episode => episode.year), [...first.map(episode => episode.year)].sort((a, b) => a - b), 'timeline periods remain in chronological order');
  assert.ok(first.every(episode => episode.fictional === true && episode.id && episode.year));
  assert.notDeepEqual(first.map(episode => episode.id), other.map(episode => episode.id));
});

test('course facts cite checked-in source records and every timeline episode is labeled fictional', async () => {
  const dialogue = JSON.parse(await readFile(new URL('../narrative/MAIN_20MIN_DIALOGUE.json', import.meta.url)));
  const learningSources = JSON.parse(await readFile(new URL('../rpg/data/learning-sources.json', import.meta.url)));
  const knownSources = new Map([...dialogue.sourceRegister, ...learningSources.sources].map(source => [source.sourceId, source]));
  for (const unit of exam.learningUnits) {
    assert.ok(unit.provenance?.startLocator && unit.provenance?.endLocator, `${unit.id} has a precise range`);
    assert.ok(unit.sourceIds.every(sourceId => knownSources.has(sourceId)), `${unit.id} resolves to a checked source`);
  }
  assert.ok(timeline.periods.length >= 6 && timeline.periods.length <= 8);
  for (const period of timeline.periods) {
    assert.equal(period.default.fictional, true);
    for (const episode of Object.values(period.variants ?? {})) assert.equal(episode.fictional, true);
  }
  const comparisons = JSON.parse(await readFile(new URL('../rpg/data/historical-comparisons.json', import.meta.url)));
  const campaign = JSON.parse(await readFile(new URL('../rpg/quests/campaign.json', import.meta.url)));
  assert.deepEqual(comparisons.comparisons.map(item => item.endingId).sort(), campaign.endings.map(item => item.id).sort());
  for (const comparison of comparisons.comparisons) {
    assert.ok(comparison.documentedLifeKo && comparison.routeContextKo);
    assert.ok(comparison.sources.length > 0);
    assert.ok(comparison.sources.every(source => knownSources.has(source.sourceId) && /^https:\/\//.test(source.url) && source.locator));
  }
});

test('new game state carries a resumable learning arc; legacy version-one saves migrate without losing records', async () => {
  const maps = Object.fromEntries(await Promise.all(['nevsky', 'printshop', 'chancery', 'courtyard', 'dead-souls'].map(async id => [id, JSON.parse(await readFile(new URL(`../rpg/maps/${id}.json`, import.meta.url)))])));
  const cards = await Promise.all(['clerk_alexei','printer_ekaterina','courier_pavel','seamstress_anna','tenant_mikhail','bookseller_lev','nekrasov_reconstruction','literary_chichikov'].map(id => readFile(new URL(`../rpg/characters/${id}.json`, import.meta.url)).then(JSON.parse)));
  const quests = await Promise.all(['printshop-article','public-discourse-1848','circle-investigation-1849','circle-letter-1849-may','literary-dead-souls'].map(id => readFile(new URL(`../rpg/quests/${id}.json`, import.meta.url)).then(JSON.parse)));
  const fresh = gameState.createInitialState({ maps, hostCards: cards, quests });
  assert.equal(fresh.learning.phase, 'circle-choice');
  let studying = chooseCirclePath(createLearningProgress(), 'attended');
  studying = advanceStudy(studying, exam);
  fresh.learning = studying;
  const progressSave = gameState.saveGame(fresh);
  assert.deepEqual(gameState.loadGame(progressSave, { maps, hostCards: cards, quests, learningExam: exam }).learning, studying, 'an interrupted lesson resumes at the saved unit');
  fresh.ledger.push({ eventId: 'OLD_RECORD', eventType: 'DIALOGUE_TURN', hostId: 'clerk_alexei' });
  delete fresh.learning;
  fresh.version = 1;
  const oldEnvelope = { saveVersion: 1, checksum: gameState.stateHash(fresh), state: fresh };
  const restored = gameState.loadGame(oldEnvelope, { maps, hostCards: cards, quests });
  assert.equal(restored.learning.phase, 'circle-choice');
  assert.equal(restored.ledger[0].eventId, 'OLD_RECORD');
  assert.equal(JSON.parse(gameState.saveGame(restored)).saveVersion, 2);
});

test('the reducer rejects ending resolution until exam, deferral, or helping a peer is explicitly recorded', async () => {
  const maps = Object.fromEntries(await Promise.all(['nevsky', 'printshop', 'chancery', 'courtyard', 'dead-souls'].map(async id => [id, JSON.parse(await readFile(new URL(`../rpg/maps/${id}.json`, import.meta.url)))])));
  const cards = await Promise.all(['clerk_alexei','printer_ekaterina','courier_pavel','seamstress_anna','tenant_mikhail','bookseller_lev','nekrasov_reconstruction','literary_chichikov'].map(id => readFile(new URL(`../rpg/characters/${id}.json`, import.meta.url)).then(JSON.parse)));
  const quests = await Promise.all(['printshop-article','public-discourse-1848','circle-investigation-1849','circle-letter-1849-may','literary-dead-souls'].map(id => readFile(new URL(`../rpg/quests/${id}.json`, import.meta.url)).then(JSON.parse)));
  const campaign = JSON.parse(await readFile(new URL('../rpg/quests/campaign.json', import.meta.url)));
  const state = gameState.createInitialState({ maps, hostCards: cards, quests });
  for (const quest of campaign.arcs.flatMap(arc => arc.questIds)) state.quests[quest].status = 'resolved';
  state.world.possessionHistory = cards.filter(card => card.kind !== 'LITERARY').slice(0, 4).map(card => ({ hostId: card.id }));
  state.ledger.push({ eventId: 'ROUTE', actionId: 'FILE_OFFICIAL_REPORT', sourceIds: ['source-a', 'source-b', 'source-c'] });
  assert.equal(gameState.resolveEnding(state, 'UVAROV', campaign).reason, 'learning_arc_incomplete');
  state.learning.phase = 'result';
  assert.equal(gameState.resolveEnding(state, 'UVAROV', campaign).reason, 'learning_arc_incomplete');
  state.learning.phase = 'complete';
  state.learning.examOutcome = 'deferred';
  const resolved = gameState.resolveEnding(state, 'UVAROV', campaign);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.state.endingId, 'UVAROV');
});
