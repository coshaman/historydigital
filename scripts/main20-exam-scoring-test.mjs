import assert from 'node:assert/strict';
import test from 'node:test';
import '../main20-exam.js';
import examData from '../narrative/ACT_III_LEARNING_EXAM.json' with { type: 'json' };

const { scoreExam, derivePromotionStatus } = globalThis.Main20Exam || {};
const answersForCount = (count) => Object.fromEntries(examData.questions.map((question, index) => [
  question.id,
  index < count ? examData.answerKey[question.id] : question.options.find((option) => option.id !== examData.answerKey[question.id]).id
]));

test('scores exact answer IDs and applies the 3-of-5 boundary', () => {
  assert.equal(scoreExam(answersForCount(2), examData).outcome, 'failed');
  assert.equal(scoreExam(answersForCount(2), examData).correctCount, 2);
  assert.equal(scoreExam(answersForCount(3), examData).outcome, 'passed');
  assert.equal(scoreExam(answersForCount(3), examData).correctCount, 3);
  assert.equal(scoreExam(answersForCount(5), examData).correctCount, 5);
});

test('missing, unknown, and malformed answers are never counted as correct', () => {
  assert.equal(scoreExam(null, examData).correctCount, 0);
  assert.equal(scoreExam({ [examData.questions[0].id]: 'not-a-real-option' }, examData).correctCount, 0);
  assert.equal(scoreExam(answersForCount(5), examData).correctCount, 5, 'extra keys do not change the fixed five-question result');
  assert.equal(scoreExam([], examData).correctCount, 0);
});

test('promotion is derived from exam outcome; deferred and helped-peer remain pending', () => {
  assert.equal(derivePromotionStatus('passed'), 'promoted');
  assert.equal(derivePromotionStatus('failed'), 'not-promoted');
  for (const outcome of ['deferred', 'helped-peer', 'unset', null, 'invalid']) {
    assert.equal(derivePromotionStatus(outcome), 'pending');
  }
});
