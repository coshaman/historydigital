import assert from 'node:assert/strict';
import test from 'node:test';
import { formatMissionActionKo } from '../rpg/engine/quest-guidance.mjs';
import { formatDiscussionQuestTaskKo } from '../rpg/engine/discussion-quests.mjs';

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

test('conversation quest guidance names who to ask, what to say, and how to finish', () => {
  const text = formatDiscussionQuestTaskKo({
    phase: 'ASK', hostNameKo: '예카테리나 벨로바',
    promptKo: '교정자는 문장을 그대로 옮기는 일만 책임지면 될까요?',
    quest: { requiredPerspectiveCount: 2, perspectiveHostIds: [] },
  }, { placeKo: '인쇄소', travelHowKo: '표시된 출구를 지나 인쇄소로 이동하세요.' });
  assert.match(text, /예카테리나 벨로바에게 말 걸기 · 인쇄소/);
  assert.match(text, /이동 · 표시된 출구를 지나 인쇄소로 이동하세요/);
  assert.match(text, /물어볼 말 · “교정자는 문장을 그대로 옮기는 일만 책임지면 될까요\?”/);
  assert.match(text, /대화창에서 이 질문을 선택해 답변/);
  assert.match(text, /일반 대화만으로는 진행되지 않습니다/);
  assert.match(text, /서로 다른 2명의 답을 듣고 수첩에서 내 입장 하나를 기록/);
  assert.equal(formatDiscussionQuestTaskKo({ phase: 'RECORD_POSITION' }),
    '지금 할 일 · 수첩에서 이 쟁점에 대한 입장 하나를 기록하세요. 기록하면 퀘스트가 끝납니다.');
});
