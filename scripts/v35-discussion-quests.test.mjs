import test from 'node:test';
import assert from 'node:assert/strict';
import { availableDiscussionQuests, discussionPromptsForHost, discussionReflectionPromptsForHost } from '../rpg/engine/discussion-quests.mjs';
import definitions from '../rpg/data/discussion-quests.json' with { type: 'json' };

test('discussion quests unlock by campaign date and preserve fictional viewpoint boundaries', () => {
  const state = { world: { date: '1847-06-01' }, ledger: [] };
  const quests = availableDiscussionQuests(state, definitions);
  assert.equal(quests.length, 5, 'five viewpoint missions are available from the opening date');
  assert.deepEqual(quests.map(quest => quest.id), [
    'INQUIRY_OFFICIAL_DUTY_AND_MORALITY',
    'INQUIRY_IDEAS_AND_LIVED_LIFE',
    'INQUIRY_LITERATURE_AND_SERFDOM',
    'INQUIRY_CENSORSHIP_AND_LABOR',
    'INQUIRY_CENSORSHIP_AND_PUBLIC_ORDER',
  ]);
  assert.equal(definitions.historicalBoundaryKo.includes('실제 발언'), true);
  assert.equal(quests.every(quest => quest.sourceIds.every(sourceId => typeof sourceId === 'string')), true);
});

test('opinion quests collect two distinct character perspectives before comparison and unlock a follow-up', () => {
  const state = { world: { date: '1849-04-22' }, ledger: [] };
  const alexei = availableDiscussionQuests(state, definitions);
  const prompt = discussionPromptsForHost('clerk_alexei', alexei).find(item => item.discussionId === 'INQUIRY_RECORD_AND_RUMOR');
  assert.match(prompt.promptKo, /서기|상급자/);
  const firstView = { ...state, ledger: [{ eventType: 'DIALOGUE_TURN', hostId: 'clerk_alexei', discussionId: prompt.discussionId }] };
  const inProgress = availableDiscussionQuests(firstView, definitions).find(item => item.id === prompt.discussionId);
  assert.equal(inProgress.completed, false);
  assert.equal(inProgress.perspectiveHostIds.length, 1);
  assert.equal(discussionPromptsForHost('clerk_alexei', [inProgress]).length, 0, 'the same character cannot be counted twice');
  assert.equal(discussionPromptsForHost('courier_pavel', [inProgress]).length, 1, 'the second perspective remains available');
  const completed = availableDiscussionQuests({ ...firstView, ledger: [...firstView.ledger, { eventType: 'DIALOGUE_TURN', hostId: 'senior_clerk_konstantin', discussionId: prompt.discussionId }] }, definitions).find(item => item.id === prompt.discussionId);
  assert.equal(completed.completed, true);
  const stateWithNote = { ...state, player: { dialogueGrowth: { comparisonNotes: [{ discussionId: prompt.discussionId }], reflectionIds: [] } } };
  assert.equal(discussionReflectionPromptsForHost('clerk_alexei', stateWithNote, [completed]).length, 1);
  stateWithNote.player.dialogueGrowth.reflectionIds.push(`${prompt.discussionId}::clerk_alexei`);
  assert.equal(discussionReflectionPromptsForHost('clerk_alexei', stateWithNote, [completed]).length, 0, 'follow-up prompts are one-time per character');
  assert.equal(availableDiscussionQuests({ ...state, ledger: [{ eventType: 'DIALOGUE_TURN' }] }, definitions).find(item => item.id === prompt.discussionId).completed, false);
});
