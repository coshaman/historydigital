import test from 'node:test';
import assert from 'node:assert/strict';
import { v47StoryMenuEntries, resolveV47StoryEntry } from '../rpg/engine/v47-story-entry.mjs';
import { toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';
import { v47StoryQuests } from '../rpg/data/v47-main-stories.mjs';
import { readFile } from 'node:fs/promises';

const quests = [...v47StoryQuests, ...toV47StoryQuests()];
const campaign = JSON.parse(await readFile(new URL('../rpg/quests/campaign.json', import.meta.url), 'utf8'));

test('history menu exposes all three V47 main stories with player-facing names', () => {
  const entries = v47StoryMenuEntries();
  assert.deepEqual(entries.map(entry => entry.id), ['MAIN01', 'MAIN03', 'MAIN05']);
  assert.match(entries[0].titleKo, /금지된 삽화 연감/);
  assert.match(entries[0].firstTaskKo, /구독 장부/);
});

test('MAIN01 selection identifies the current campaign task that unlocks its first scene', () => {
  const state = { world: { chapterId: 'V33_1847_PRINT', date: '1847-06-01' }, quests: {} };
  const guide = resolveV47StoryEntry(state, 'MAIN01', quests, campaign);
  assert.equal(guide.status, 'WAITING_FOR_CAMPAIGN');
  assert.equal(guide.storyQuestId, 'V47_MAIN01_A01');
  assert.equal(guide.currentQuestId, 'PRINTSHOP_PROOF_1847');
  assert.ok(guide.currentTaskKo);
});

test('MAIN01 selection becomes directly actionable once its dated campaign gates are resolved', () => {
  const state = { world: { chapterId: 'V33_1848_PUBLIC', date: '1848-02-12' }, quests: {} };
  for (const questId of campaign.arcs[0].questIds) state.quests[questId] = { status: 'resolved' };
  for (const questId of campaign.arcs[1].questIds) state.quests[questId] = { status: 'resolved' };
  state.quests.V47_MAIN01_A01 = { status: 'open' };
  const guide = resolveV47StoryEntry(state, 'MAIN01', quests, campaign);
  assert.equal(guide.status, 'READY');
  assert.equal(guide.storyQuestId, 'V47_MAIN01_A01');
  assert.equal(guide.currentQuestId, 'V47_MAIN01_A01');
});
