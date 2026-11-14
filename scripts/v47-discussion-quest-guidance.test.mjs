import test from 'node:test';
import assert from 'node:assert/strict';
import { discussionBoardView, shouldOpenDiscussionBoard, shouldShowQuestTracker } from '../rpg/engine/discussion-quests.mjs';

const names = { reader_darya: '다리야', seamstress_anna: '안나' };
const quest = ({ perspectiveHostIds = [], positionPending = false } = {}) => ({
  id: 'INQUIRY_TEST', titleKo: '책의 원칙과 생활', requiredPerspectiveCount: 2,
  perspectiveHostIds, positionPending, playerPositionChoices: [{ id: 'KEEP_VOICE', labelKo: '당사자의 말을 남긴다', consequenceKo: '수첩에 내 판단을 기록합니다.' }],
  hosts: {
    reader_darya: { promptKo: '책의 원칙이 생활과 어긋나면 무엇을 바꿔야 할까요?' },
    seamstress_anna: { promptKo: '그 원칙이 품삯을 바꾸지 못한다면 무슨 쓸모가 있을까요?' },
  },
});

test('conversation quest names first person, exact question, and the action that completes it', () => {
  const view = discussionBoardView([quest()], null, names);
  assert.match(view.guidanceKo, /다리야/);
  assert.match(view.guidanceKo, /책의 원칙이 생활과 어긋나면 무엇을 바꿔야 할까요/);
  assert.match(view.steps.map(step => step.textKo).join(' '), /안나/);
  assert.match(view.steps.map(step => step.textKo).join(' '), /수첩/);
});

test('after first perspective, guidance advances to a different named person and their question', () => {
  const view = discussionBoardView([quest({ perspectiveHostIds: ['reader_darya'] })], null, names);
  assert.match(view.guidanceKo, /안나/);
  assert.match(view.guidanceKo, /그 원칙이 품삯을 바꾸지 못한다면 무슨 쓸모가 있을까요/);
  assert.match(view.guidanceKo, /1\/2/);
});

test('after two conversations, guidance says to record a position to finish the quest', () => {
  const view = discussionBoardView([quest({ perspectiveHostIds: ['reader_darya', 'seamstress_anna'], positionPending: true })], null, names);
  assert.match(view.guidanceKo, /두 사람의 관점/);
  assert.match(view.guidanceKo, /입장을 골라 수첩에 남기면/);
  assert.equal(view.positionPrompts.length, 1);
});

test('quest tracker and conversation questions stay visible while dialogue choices are open', () => {
  assert.equal(shouldShowQuestTracker({ hasActions: true, activeDialogue: true }), true);
  assert.equal(shouldShowQuestTracker({ hasActions: true }), false);
  assert.equal(shouldShowQuestTracker({ hasActions: true, storyOverview: true }), true);
  assert.equal(shouldShowQuestTracker({ hasActions: true, activeDialogue: true, ending: true }), false);
  assert.equal(shouldShowQuestTracker({ activeDialogue: true, literaryScene: true }), false);
  assert.equal(shouldOpenDiscussionBoard({ activeDialogue: true }), true);
  assert.equal(shouldOpenDiscussionBoard({}), false);
});
