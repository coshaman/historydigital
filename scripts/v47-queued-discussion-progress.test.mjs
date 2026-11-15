import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { availableDiscussionQuests, formatQueuedDiscussionTaskKo, resolveQueuedDiscussionPrompt } from '../rpg/engine/discussion-quests.mjs';

const definitions = JSON.parse(await readFile(new URL('../rpg/data/discussion-quests.json', import.meta.url), 'utf8'));

test('a successful free-form exchange with the queued person records the queued discussion', () => {
  const quest = definitions.quests.find(item => item.hosts?.bookseller_lev);
  const queued = { questId: quest.id, hostId: 'bookseller_lev', promptKo: quest.hosts.bookseller_lev.promptKo };
  const discussion = resolveQueuedDiscussionPrompt(queued, definitions.quests, 'bookseller_lev', '책값을 낮추면 인쇄공의 품삯은 누가 책임져야 하오?');

  assert.equal(discussion.discussionId, quest.id);
  assert.equal(discussion.promptKo, quest.hosts.bookseller_lev.promptKo);
  assert.equal(resolveQueuedDiscussionPrompt(queued, definitions.quests, 'bookseller_lev', '안녕하세요.'), null);
  assert.equal(resolveQueuedDiscussionPrompt(queued, definitions.quests, 'bookseller_lev', '오늘은 무슨 일로 바쁘세요?'), null);
  assert.equal(resolveQueuedDiscussionPrompt(queued, definitions.quests, 'reader_darya'), null);
  assert.equal(resolveQueuedDiscussionPrompt({ ...queued, questId: 'missing' }, definitions.quests, 'bookseller_lev'), null);
});

test('quest guidance names the person, exact topic, next step, and the actual completion action', () => {
  const quest = definitions.quests.find(item => item.hosts?.bookseller_lev && item.hosts?.reader_darya);
  const guide = formatQueuedDiscussionTaskKo({ ...quest, perspectiveHostIds: [], requiredPerspectiveCount: 2 }, {
    hostNameKo: '레프', promptKo: quest.hosts.bookseller_lev.promptKo,
    nextHostNameKo: '다리야', nextPromptKo: quest.hosts.reader_darya.promptKo,
  });
  assert.match(guide, /레프에게/);
  assert.match(guide, new RegExp(quest.hosts.bookseller_lev.promptKo));
  assert.match(guide, /다리야에게/);
  assert.match(guide, /수첩에서 「.+」의 내 입장을 선택해 기록하세요/);
  assert.match(guide, /진행 인정 · 답변을 받아야/);
});

test('quest progress treats the player position as a separate final step', () => {
  const quest = definitions.quests.find(item => item.hosts?.bookseller_lev && item.hosts?.reader_darya);
  const state = {
    world: { date: quest.date },
    ledger: [
      { eventType: 'DIALOGUE_TURN', discussionId: quest.id, hostId: 'bookseller_lev' },
      { eventType: 'DIALOGUE_TURN', discussionId: quest.id, hostId: 'reader_darya' },
    ],
    player: { dialogueGrowth: { comparisonNotes: [{ discussionId: quest.id }], playerPositions: [] } },
  };
  const active = availableDiscussionQuests(state, definitions).find(item => item.id === quest.id);
  assert.equal(active.positionPending, true);
  assert.equal(active.completed, false);
  const final = formatQueuedDiscussionTaskKo(active);
  assert.match(final, /수첩을 열고/);
  assert.match(final, /입장을 기록하면 퀘스트가 끝납니다/);
});
