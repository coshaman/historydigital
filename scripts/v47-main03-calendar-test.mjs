import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { v47StoryBeats, toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';
import { v47StoryQuests } from '../rpg/data/v47-main-stories.mjs';
import { sourceAvailableOn } from '../rpg/engine/source-availability.mjs';
import { resolveV47StoryEntry, storyIdForQuest } from '../rpg/engine/v47-story-entry.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const sourceIndex = JSON.parse(await readFile(new URL('../rpg/data/source-reader-index.json', import.meta.url), 'utf8'));
const chancery = JSON.parse(await readFile(new URL('../rpg/maps/chancery.json', import.meta.url), 'utf8'));
const campaign = JSON.parse(await readFile(new URL('../rpg/quests/campaign.json', import.meta.url), 'utf8'));
const europeNewsQuest = JSON.parse(await readFile(new URL('../rpg/quests/europe-news-1848.json', import.meta.url), 'utf8'));
const sourceById = new Map(sourceIndex.records.map(record => [record.sourceId, record]));
const stories = [...v47StoryQuests, ...toV47StoryQuests()];
const beatById = new Map(stories.map(quest => [quest.id, quest]));

test('MAIN03 uses one Gregorian world clock for Russian Julian scene dates and source arrival gates', () => {
  const publicArc = campaign.arcs.find(arc => arc.id === 'V33_1848_PUBLIC');
  const newsQuestIndex = publicArc.questIds.indexOf('V37_EUROPE_NEWS_1848');
  assert.equal(europeNewsQuest.storyId, 'MAIN03', 'the existing physical E42 event is the MAIN03 opening, not a parallel duplicate');
  assert.equal(storyIdForQuest(europeNewsQuest), 'MAIN03', 'the campaign replay seed keeps E42 inside MAIN03 instead of resolving it as prior context');
  assert.equal(europeNewsQuest.date, '1848-03-27', 'the March 15 Julian newspaper issue reaches the Gregorian game clock on March 27');
  assert.equal(publicArc.questIds.includes('V47_MAIN03_REVOLUTION_NEWS'), false, 'the repeated read/register/note scene is removed');
  assert.ok(newsQuestIndex >= 0 && newsQuestIndex < publicArc.questIds.indexOf('V47_MAIN03_P01'));
  const main03State = { world: { chapterId: 'V33_1848_PUBLIC', date: '1848-03-27' }, quests: {} };
  for (const id of publicArc.questIds.slice(0, newsQuestIndex)) main03State.quests[id] = { status: 'resolved' };
  const menuGuide = resolveV47StoryEntry(main03State, 'MAIN03', [...stories, europeNewsQuest], campaign);
  assert.equal(menuGuide.storyQuestId, 'V37_EUROPE_NEWS_1848', 'selecting MAIN03 leads to the existing live newspaper scene');

  const dateExpectations = [
    ['V47_MAIN03_P05', '1849-04-27'],
    ['V47_MAIN03_P06', '1849-04-27'],
    ['V47_MAIN03_P07', '1849-05-04'],
    ['V47_MAIN03_ARRESTS', '1849-05-05'],
    ['V47_MAIN03_P09', '1849-05-07'],
    ['V47_MAIN03_P11', '1850-01-03'],
  ];
  for (const [questId, expectedDate] of dateExpectations) {
    assert.equal(beatById.get(questId)?.date, expectedDate, `${questId} must use its Gregorian game-clock date`);
  }
  const prelude = campaign.arcs.find(arc => arc.id === 'V33_1849_PRELUDE');
  const arrestChapter = campaign.arcs.find(arc => arc.id === 'V33_1849_CIRCLE');
  assert.equal(arrestChapter.date, '1849-05-05', 'the arrest chapter begins on the converted fixed-event date');
  assert.ok(prelude.questIds.includes('V47_MAIN03_P07'), 'the May 4 arrest-order reading remains in the pre-arrest chapter');
  assert.ok(arrestChapter.questIds.includes('V47_MAIN03_ARRESTS'), 'the fixed arrest starts its own chapter on May 5');

  for (const [questId, sourceId] of [
    ['V47_MAIN03_P05', 'OBJ-BELINSKY-LETTER-GOGOL-1847'],
    ['V47_MAIN03_P07', 'OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849'],
    ['V47_MAIN03_P11', 'OBJ-WS-DOSTOEVSKY-LETTER-1849-DEC22'],
  ]) {
    const quest = beatById.get(questId), source = sourceById.get(sourceId);
    assert.ok(quest.sourceIds.includes(sourceId), `${questId} links the document it presents`);
    assert.equal(sourceAvailableOn(source, null, null, quest.date), true,
      `${questId} cannot expose ${sourceId} before it is readable (${quest.date})`);
  }

  assert.equal(sourceAvailableOn(sourceById.get('OBJ-NICHOLAS-MANIFESTO-1848'), null, null, '1848-03-26'), false);
  assert.equal(sourceAvailableOn(sourceById.get('OBJ-NICHOLAS-MANIFESTO-1848'), null, null, '1848-03-27'), true);
  assert.equal(sourceAvailableOn(sourceById.get('OBJ-NICHOLAS-MANIFESTO-1848'), null, null, europeNewsQuest.date), true);

  for (const quest of stories.filter(row => row.storyId === 'MAIN03')) {
    for (const sourceId of quest.sourceIds) {
      assert.equal(sourceAvailableOn(sourceById.get(sourceId), null, null, quest.date), true,
        `${quest.id} does not expose ${sourceId} before source access`);
    }
  }

  assert.equal(v47StoryBeats.find(beat => beat.id === 'V47_MAIN03_P05')?.originalJulianDate, '1849-04-15');
  assert.equal(v47StoryBeats.find(beat => beat.id === 'V47_MAIN03_P07')?.originalJulianDate, '1849-04-22');
  assert.equal(v47StoryBeats.find(beat => beat.id === 'V47_MAIN03_P09')?.originalJulianDate, '1849-04-25');
  assert.equal(sourceById.get('OBJ-WS-DOSTOEVSKY-LETTER-1849-DEC22')?.accessibleToPlayerAt, '1850-01-03');
});

test('MAIN03 requires reading the Belinsky letter and arrest order before their related choices', () => {
  for (const [questId, sourceId] of [
    ['V47_MAIN03_P05', 'OBJ-BELINSKY-LETTER-GOGOL-1847'],
    ['V47_MAIN03_P07', 'OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849'],
  ]) {
    const quest = beatById.get(questId);
    assert.ok(quest.actions.length > 0, `${questId} has consequential choices`);
    assert.ok(quest.actions.every(action => action.requiredKnowledgeId === sourceId),
      `${questId} requires the player to read ${sourceId} before choosing`);
    const hostId = quest.actions[0].hostIds[0];
    assert.ok(questChoices(quest, hostId, [], null).every(action => action.missingSourceId === sourceId),
      `${questId} keeps its choices locked for a character who has not read ${sourceId}`);
    assert.ok(questChoices(quest, hostId, [sourceId], null).every(action => action.missingSourceId === null),
      `${questId} unlocks its choices for a character who has read ${sourceId}`);
  }
  const arrestObject = chancery.layers.flatMap(layer => layer.objects ?? [])
    .find(object => object.properties?.some(property => property.name === 'sourceId'
      && property.value === 'OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849'));
  const properties = Object.fromEntries((arrestObject?.properties ?? []).map(property => [property.name, property.value]));
  assert.equal(properties.availableDate, sourceById.get('OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849').accessibleToPlayerAt,
    'the physical arrest order appears on its documented player-access date');
  assert.equal(properties.availableChapterId, 'V33_1849_PRELUDE',
    'the physical arrest order appears before the fixed arrest chapter begins');
});

test('MAIN03 follow-up report choices remain possible after the register correction costs money', () => {
  const followUp = beatById.get('V47_MAIN03_P10');
  assert.ok(followUp.actions.every(action => !action.effects.v47WorldChange.money
    .some(transfer => transfer.fromHostId === 'clerk_alexei')),
  'P10 cannot charge Alexei again after P09 correction has spent the clerk’s available coin');
});
