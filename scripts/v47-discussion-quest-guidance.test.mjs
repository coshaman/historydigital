import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { availableDiscussionQuests, discussionBoardView, discussionQuestInstruction, shouldOpenDiscussionBoard, shouldShowQuestTracker } from '../rpg/engine/discussion-quests.mjs';

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
  assert.match(view.guidanceKo, /대상 · 다리야/);
  assert.match(view.guidanceKo, /물어볼 말 · “책의 원칙이 생활과 어긋나면 무엇을 바꿔야 할까요/);
  assert.match(view.guidanceKo, /완료 조건 · 서로 다른 두 사람의 답을 기록하고 수첩에서 내 입장을 선택/);
  assert.match(view.steps.map(step => step.textKo).join(' '), /안나/);
  assert.match(view.steps.map(step => step.textKo).join(' '), /수첩/);
});

test('after first perspective, guidance advances to a different named person and their question', () => {
  const view = discussionBoardView([quest({ perspectiveHostIds: ['reader_darya'] })], null, names);
  assert.match(view.guidanceKo, /대상 · 안나/);
  assert.match(view.guidanceKo, /물어볼 말 · “그 원칙이 품삯을 바꾸지 못한다면 무슨 쓸모가 있을까요/);
  assert.match(view.guidanceKo, /1\/2/);
});

test('after two conversations, guidance says to record a position to finish the quest', () => {
  const view = discussionBoardView([quest({ perspectiveHostIds: ['reader_darya', 'seamstress_anna'], positionPending: true })], null, names);
  assert.match(view.guidanceKo, /완료 조건 · 수첩에서 내 입장을 골라 기록/);
  assert.equal(view.positionPrompts.length, 1);
});

test('a normal conversation does not count; only selecting the exact prompt records a perspective', () => {
  const instruction = discussionQuestInstruction(quest(), names);
  assert.equal(instruction.promptKo, quest().hosts.reader_darya.promptKo);
  assert.match(instruction.howKo, /대화 선택지에서 이 질문을 골라 답을 들으세요/);
  assert.match(instruction.howKo, /일반 대화만으로는 진행되지 않습니다/);
});

test('two answers leave the quest active until the player records a position', () => {
  const definitions = { quests: [{ ...quest(), date: '1848-01-01' }], playerPositionChoices: [{ id: 'KEEP_VOICE', labelKo: '당사자의 말을 남긴다' }] };
  const state = {
    world: { date: '1848-01-01' },
    ledger: [
      { eventType: 'DIALOGUE_TURN', discussionId: 'INQUIRY_TEST', hostId: 'reader_darya' },
      { eventType: 'DIALOGUE_TURN', discussionId: 'INQUIRY_TEST', hostId: 'seamstress_anna' },
    ],
    player: { dialogueGrowth: { comparisonNotes: [{ discussionId: 'INQUIRY_TEST' }], playerPositions: [] } },
  };
  const pending = availableDiscussionQuests(state, definitions)[0];
  assert.equal(pending.completed, false);
  assert.equal(pending.positionPending, true);
  state.player.dialogueGrowth.playerPositions.push({ discussionId: 'INQUIRY_TEST', positionId: 'KEEP_VOICE' });
  const done = availableDiscussionQuests(state, definitions)[0];
  assert.equal(done.completed, true);
  assert.equal(done.positionPending, false);
});

test('quest tracker and conversation questions stay visible while dialogue choices are open', () => {
  assert.equal(shouldShowQuestTracker({ hasActions: true, activeDialogue: true }), true);
  assert.equal(shouldShowQuestTracker({ hasActions: true, keepVisible: true }), true);
  assert.equal(shouldShowQuestTracker({ hasActions: true }), false);
  assert.equal(shouldShowQuestTracker({ hasActions: true, storyOverview: true }), true);
  assert.equal(shouldShowQuestTracker({ hasActions: true, activeDialogue: true, ending: true }), false);
  assert.equal(shouldShowQuestTracker({ activeDialogue: true, literaryScene: true }), false);
  assert.equal(shouldOpenDiscussionBoard({ activeDialogue: true }), true);
  assert.equal(shouldOpenDiscussionBoard({}), false);
});

test('mobile date continuations retain the story tabs and journal navigation alongside follow-up actions', async () => {
  const css = await readFile(new URL('../rpg/choices.css', import.meta.url), 'utf8');
  assert.match(css, /\.lower\.has-actions\.show-mission-context\s+\.journal-tools\s*\{\s*display:\s*flex/);
});
