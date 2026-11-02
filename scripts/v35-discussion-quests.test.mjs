import test from 'node:test';
import assert from 'node:assert/strict';
import { availableDiscussionQuests, discussionPromptsForHost } from '../rpg/engine/discussion-quests.mjs';
import definitions from '../rpg/data/discussion-quests.json' with { type: 'json' };

test('discussion quests unlock by campaign date and preserve fictional viewpoint boundaries', () => {
  const state = { world: { date: '1847-06-01' }, ledger: [] };
  const quests = availableDiscussionQuests(state, definitions);
  assert.equal(quests.length, 2);
  assert.equal(definitions.historicalBoundaryKo.includes('실제 발언'), true);
  assert.equal(quests.every(quest => quest.sourceIds.every(sourceId => typeof sourceId === 'string')), true);
});

test('an opinion quest offers only the current speaker’s question and completes only from an AI dialogue receipt', () => {
  const state = { world: { date: '1849-04-22' }, ledger: [] };
  const alexei = availableDiscussionQuests(state, definitions);
  const prompt = discussionPromptsForHost('clerk_alexei', alexei).find(item => item.discussionId === 'INQUIRY_RECORD_AND_RUMOR');
  assert.match(prompt.promptKo, /서기|상급자/);
  assert.equal(availableDiscussionQuests({ ...state, ledger: [{ eventType: 'DIALOGUE_TURN', discussionId: prompt.discussionId }] }, definitions).find(item => item.id === prompt.discussionId).completed, true);
  assert.equal(availableDiscussionQuests({ ...state, ledger: [{ eventType: 'DIALOGUE_TURN' }] }, definitions).find(item => item.id === prompt.discussionId).completed, false);
});
