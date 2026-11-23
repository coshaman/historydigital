import assert from 'node:assert/strict';
import test from 'node:test';
import { formatMissionActionKo, questChoiceProgress } from '../rpg/engine/quest-guidance.mjs';
import { formatDiscussionQuestTaskKo, formatQueuedDiscussionTaskKo, discussionReplyAction } from '../rpg/engine/discussion-quests.mjs';

test('mission guidance shows a destination once and keeps travel instructions concise', () => {
  assert.equal(
    formatMissionActionKo({ actionKo: '표시된 출구로 이동하세요', placeKo: '책방 안쪽' }),
    '표시된 출구로 이동하세요 · 책방 안쪽',
  );
  assert.equal(
    formatMissionActionKo({ actionKo: '표시된 출구로 이동하세요 · 책방 안쪽', placeKo: '책방 안쪽' }),
    '표시된 출구로 이동하세요 · 책방 안쪽',
  );
  assert.equal(formatMissionActionKo({ actionKo: '「예약 장부」 곁에서 살펴보세요' }), '「예약 장부」 곁에서 살펴보세요');
});

test('alternative quest choices count as one required action in the player progress display', () => {
  const quest = { id: 'MAIN01_TEST', actions: [{ id: 'refund' }, { id: 'pay-worker' }] };
  assert.deepEqual(questChoiceProgress(quest, []), { completedSteps: 0, totalSteps: 1 });
  assert.deepEqual(questChoiceProgress(quest, [{ questId: quest.id, eventType: 'HISTORICAL_ACTION' }]), { completedSteps: 1, totalSteps: 1 });
});

test('conversation quest guidance names who to ask, what to say, and how to finish', () => {
  const text = formatDiscussionQuestTaskKo({
    phase: 'ASK', hostNameKo: '예카테리나 벨로바',
    promptKo: '교정자는 문장을 그대로 옮기는 일만 책임지면 될까요?',
    quest: { requiredPerspectiveCount: 2, perspectiveHostIds: [] },
  }, { placeKo: '인쇄소', travelHowKo: '표시된 출구를 지나 인쇄소로 이동하세요.' });
  assert.match(text, /예카테리나 벨로바에게 말 걸기 · 인쇄소/);
  assert.match(text, /이동 · 표시된 출구를 지나 인쇄소로 이동하세요/);
  assert.match(text, /질문 · “교정자는 문장을 그대로 옮기는 일만 책임지면 될까요\?”를 고르거나 같은 내용을 직접 물으세요/);
  assert.match(text, /답변을 받으면 1\/2 관점이 기록됩니다/);
  assert.match(text, /인사만으로는 기록되지 않습니다/);
  assert.match(text, /서로 다른 2명의 답을 들은 뒤 수첩에서 「이 쟁점」의 입장을 선택해 기록/);
  assert.equal(formatDiscussionQuestTaskKo({ phase: 'RECORD_POSITION' }),
    '지금 할 일 · 수첩에서 이 쟁점에 대한 입장 하나를 기록하세요. 기록하면 퀘스트가 끝납니다.');
});

test('queued conversation quest has a distinct question button and a plain completion checklist', () => {
  const promptKo = '검열관은 이 문장을 왜 문제 삼았소?';
  assert.deepEqual(discussionReplyAction(promptKo, promptKo), {
    label: '퀘스트 질문 묻기',
    subcopy: `이 질문을 고르거나 같은 쟁점을 직접 물어보세요 · “${promptKo}”`,
    questQuestion: true,
  });
  assert.deepEqual(discussionReplyAction('오늘은 바쁘세요?', promptKo), {
    label: '오늘은 바쁘세요?', subcopy: '', questQuestion: false,
  });
  const task = formatQueuedDiscussionTaskKo({
    titleKo: '검열 보고서의 서로 다른 목소리',
    requiredPerspectiveCount: 2,
    perspectiveHostIds: [],
    situationKo: '검열관의 보고서와 모임 참석자의 기억이 엇갈린다.',
  }, { hostNameKo: '이반 세묘노프', placeKo: '관청 앞', promptKo });
  assert.match(task, /진행 · 1\/3단계 · 이반 세묘노프에게 말 걸기 · 관청 앞/);
  assert.match(task, /같은 내용을 직접 물으세요/);
  assert.match(task, /다른 인물/);
  assert.match(task, /수첩에서 「검열 보고서의 서로 다른 목소리」의 내 입장을 선택해 기록/);
});
