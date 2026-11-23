import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { availableDiscussionQuests, discussionFollowUpAfterTurn, formatQueuedDiscussionTaskKo, resolveQueuedDiscussionPrompt } from '../rpg/engine/discussion-quests.mjs';

const definitions = JSON.parse(await readFile(new URL('../rpg/data/discussion-quests.json', import.meta.url), 'utf8'));

test('a successful free-form exchange with the queued person records the queued discussion', () => {
  const quest = definitions.quests.find(item => item.hosts?.bookseller_lev);
  const queued = { questId: quest.id, hostId: 'bookseller_lev', promptKo: quest.hosts.bookseller_lev.promptKo };
  const discussion = resolveQueuedDiscussionPrompt(queued, definitions.quests, 'bookseller_lev', '책값을 낮추면 인쇄공의 품삯은 누가 책임져야 하오?');

  assert.equal(discussion.discussionId, quest.id);
  assert.equal(discussion.promptKo, quest.hosts.bookseller_lev.promptKo);
  assert.equal(resolveQueuedDiscussionPrompt(queued, definitions.quests, 'bookseller_lev', '오늘은 비가 많이 오네요.'), null,
    'a weather remark must not count as an answer to the queued topic');
  assert.equal(resolveQueuedDiscussionPrompt(queued, definitions.quests, 'bookseller_lev', '요즘 거리는 사람들로 붐비네요.'), null,
    'a generic street observation must not count as an answer to the queued topic');
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

test('a recorded perspective automatically points a first-time player to the next eligible person', () => {
  const quest = definitions.quests.find(item => item.hosts?.seamstress_anna && item.hosts?.reader_darya);
  assert.ok(quest, 'MAIN01 viewpoint inquiry should include Anna and Darya');
  const state = {
    world: { date: quest.date },
    ledger: [{ eventType: 'DIALOGUE_TURN', discussionId: quest.id, hostId: 'seamstress_anna' }],
    player: { dialogueGrowth: { comparisonNotes: [], playerPositions: [] } },
  };
  const current = availableDiscussionQuests(state, definitions).find(item => item.id === quest.id);
  const next = discussionFollowUpAfterTurn(current, { reader_darya: '다리야', bookseller_lev: '레프' });

  assert.equal(next.phase, 'ASK');
  assert.equal(next.queuedInquiry.hostId, 'reader_darya');
  assert.equal(next.queuedInquiry.promptKo, quest.hosts.reader_darya.promptKo);
  assert.match(next.statusKo, /다리야에게/);
  assert.match(next.statusKo, new RegExp(quest.hosts.reader_darya.promptKo));
});

test('after the required replies, follow-up guidance switches to the notebook action', () => {
  const quest = definitions.quests.find(item => item.hosts?.seamstress_anna && item.hosts?.reader_darya);
  const state = {
    world: { date: quest.date },
    ledger: [
      { eventType: 'DIALOGUE_TURN', discussionId: quest.id, hostId: 'seamstress_anna' },
      { eventType: 'DIALOGUE_TURN', discussionId: quest.id, hostId: 'reader_darya' },
    ],
    player: { dialogueGrowth: { comparisonNotes: [], playerPositions: [] } },
  };
  const current = availableDiscussionQuests(state, definitions).find(item => item.id === quest.id);
  const next = discussionFollowUpAfterTurn(current);

  assert.equal(next.phase, 'RECORD_POSITION');
  assert.equal(next.queuedInquiry, null);
  assert.match(next.statusKo, /수첩에서 내 입장을 고르면/);
});
