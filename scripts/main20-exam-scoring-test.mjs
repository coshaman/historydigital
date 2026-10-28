import assert from 'node:assert/strict';
import test from 'node:test';
import '../main20-exam.js';
import examData from '../narrative/ACT_III_LEARNING_EXAM.json' with { type: 'json' };

const { scoreExam, derivePromotionStatus, selectExamQuestions } = globalThis.Main20Exam || {};
const attempt = { ...examData, questions: selectExamQuestions(examData, 'scoring-test') };
const answersForCount = (count) => Object.fromEntries(attempt.questions.map((question, index) => [
  question.id,
  index < count ? examData.answerKey[question.id] : question.options.find((option) => option.id !== examData.answerKey[question.id]).id
]));

test('scores exact answer IDs and applies the 3-of-5 boundary', () => {
  assert.equal(attempt.questions.length, 5);
  assert.equal(scoreExam(answersForCount(2), attempt).outcome, 'failed');
  assert.equal(scoreExam(answersForCount(2), attempt).correctCount, 2);
  assert.equal(scoreExam(answersForCount(3), attempt).outcome, 'passed');
  assert.equal(scoreExam(answersForCount(3), attempt).correctCount, 3);
  assert.equal(scoreExam(answersForCount(5), attempt).correctCount, 5);
});

test('missing, unknown, and malformed answers are never counted as correct', () => {
  assert.equal(scoreExam(null, attempt).correctCount, 0);
  assert.equal(scoreExam({ [attempt.questions[0].id]: 'not-a-real-option' }, attempt).correctCount, 0);
  assert.equal(scoreExam(answersForCount(5), attempt).correctCount, 5, 'extra keys do not change the fixed five-question result');
  assert.equal(scoreExam([], attempt).correctCount, 0);
});

test('exam subset is deterministic for a saved seed and varies across playthroughs', () => {
  const first = selectExamQuestions(examData, 'run-alpha');
  assert.deepEqual(selectExamQuestions(examData, 'run-alpha').map(question => question.id), first.map(question => question.id));
  assert.equal(first.length, 5);
  assert.equal(new Set(first.map(question => question.id)).size, 5);
  assert.ok(first.every(question => examData.questions.some(item => item.id === question.id)));
  assert.notDeepEqual(selectExamQuestions(examData, 'run-beta').map(question => question.id), first.map(question => question.id));
});

test('promotion is derived from exam outcome; deferred and helped-peer remain pending', () => {
  assert.equal(derivePromotionStatus('passed'), 'promoted');
  assert.equal(derivePromotionStatus('failed'), 'not-promoted');
  for (const outcome of ['deferred', 'helped-peer', 'unset', null, 'invalid']) {
    assert.equal(derivePromotionStatus(outcome), 'pending');
  }
});
