import assert from 'node:assert/strict';
import fs from 'node:fs';
import { toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';

const discussions = JSON.parse(fs.readFileSync('rpg/data/discussion-quests.json', 'utf8'));
const cases = JSON.parse(fs.readFileSync('rpg/data/case-contexts.json', 'utf8')).cases;
const sources = JSON.parse(fs.readFileSync('rpg/data/source-reader-index.json', 'utf8')).records;
const caseById = new Map(cases.map(item => [item.questId, item]));
const storyById = new Map(toV47StoryQuests().map(quest => [quest.id, quest]));
const sourceById = new Map(sources.map(item => [item.sourceId, item]));
const ids = new Set();
for (const discussion of discussions.quests) {
  assert.ok(!ids.has(discussion.id), `duplicate discussion: ${discussion.id}`);
  ids.add(discussion.id);
  for (const id of discussion.sourceIds) assert.ok(sourceById.has(id), `${discussion.id}: unknown source ${id}`);
  if (!discussion.contextQuestId) continue;
  if (discussion.storyId) {
    const scene = storyById.get(discussion.contextQuestId);
    assert.equal(scene?.storyId, discussion.storyId, `${discussion.id}: linked story scene`);
    assert.equal(discussion.date, scene.date, `${discussion.id}: starts on the authored scene date`);
    assert.ok(discussion.situationKo && discussion.playerPositionChoices.length >= 2);
    for (const id of discussion.sourceIds) assert.ok(scene.sourceIds.includes(id), `${discussion.id}: ${id} must belong to the scene`);
    for (const [hostId, role] of Object.entries(discussion.hosts)) {
      assert.ok(scene.actions.some(action => action.hostIds.includes(hostId)) && role.viewKo, `${discussion.id}: missing viewpoint for ${hostId}`);
    }
    continue;
  }
  const context = caseById.get(discussion.contextQuestId);
  assert.ok(context, `${discussion.id}: missing linked case ${discussion.contextQuestId}`);
  assert.ok(context.eraDate <= discussion.date, `${discussion.id}: discussion predates its source event`);
  for (const id of discussion.sourceIds) assert.ok(context.sourceIds.includes(id), `${discussion.id}: ${id} is not used by its linked scene`);
  for (const hostId of Object.keys(discussion.hosts)) assert.ok(context.roles[hostId], `${discussion.id}: ${hostId} has no role in its scene`);
}
for (const id of ['INQUIRY_OFFICIAL_DUTY_AND_MORALITY', 'INQUIRY_CENSORSHIP_AND_LABOR', 'INQUIRY_CENSORSHIP_AND_PUBLIC_ORDER']) {
  assert.ok(discussions.quests.find(item => item.id === id)?.contextQuestId, `${id}: inquiry lacks a linked scene`);
}
console.log(`PASS: ${discussions.quests.length} discussion topics; source, era, case, and character links agree.`);
