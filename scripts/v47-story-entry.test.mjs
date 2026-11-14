import test from 'node:test';
import assert from 'node:assert/strict';
import { v47StoryMenuEntries, resolveV47StoryEntry, resolveV47StoryMenuEntries } from '../rpg/engine/v47-story-entry.mjs';
import { toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';
import { v47StoryQuests } from '../rpg/data/v47-main-stories.mjs';
import { readFile } from 'node:fs/promises';
import { CITY_PRODUCTS, purchaseCityProduct } from '../rpg/engine/civic-life.mjs';

const quests = [...v47StoryQuests, ...toV47StoryQuests()];
const campaign = JSON.parse(await readFile(new URL('../rpg/quests/campaign.json', import.meta.url), 'utf8'));
const printshopQuest = JSON.parse(await readFile(new URL('../rpg/quests/printshop-article.json', import.meta.url), 'utf8'));

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

test('historical locations menu tells the player whether MAIN01 can start and what to do next', () => {
  const state = { world: { chapterId: 'V33_1847_PRINT', date: '1847-06-01' }, quests: {} };
  const entry = resolveV47StoryMenuEntries(state, [...quests, printshopQuest], campaign).find(item => item.id === 'MAIN01');
  assert.equal(entry.status, 'WAITING_FOR_CAMPAIGN');
  assert.equal(entry.statusLabelKo, '도입 퀘스트');
  assert.equal(entry.currentTitleKo, '교정쇄의 행선지');
  assert.match(entry.menuTaskKo, /교정쇄|인쇄소/);
  assert.match(entry.currentContextKo, /편집부 공고와 교정쇄/);
  assert.match(entry.introKo, /먼저.*교정쇄의 행선지/);
  assert.match(entry.timelineNoteKo, /현재 1847년 6월.*1848년 2월.*첫 장면/,
    'a selected 1848 story explains why the player is currently doing its 1847 opening tasks');
  assert.doesNotMatch(entry.introKo, /구독 장부에서 이름을 찾고/,
    'a gated story must not tell the player to do a later MAIN01 objective before the current campaign gate');
});

test('ready MAIN01 menu gives a direct first objective and lists playable activity types', () => {
  const state = { world: { chapterId: 'V33_1848_PUBLIC', date: '1848-02-12' }, quests: {} };
  for (const questId of [...campaign.arcs[0].questIds, ...campaign.arcs[1].questIds]) state.quests[questId] = { status: 'resolved' };
  state.quests.V47_MAIN01_A01 = { status: 'open' };
  const entry = resolveV47StoryMenuEntries(state, quests, campaign).find(item => item.id === 'MAIN01');
  assert.equal(entry.status, 'READY');
  assert.match(entry.menuTaskKo, /구독 장부/);
  assert.deepEqual(entry.activitiesKo.map(item => item.type), ['quiz', 'chase', 'exploration', 'purchase']);
  assert.deepEqual(entry.activitiesKo.map(item => item.startKo), [
    '1848년 11월 30일 · 인쇄소 날짜 대조판에서 기록 네 장을 순서대로 놓는다',
    '1848년 10월 25일 · 파벨로 빙의해 책방 골목에서 세 흔적을 45분 안에 쫓는다',
    '각 장면 · 종이 모양 자료나 책 가까이에서 살펴보기를 눌러 읽는다',
    '네프스키 거리 · 레프의 가판을 살펴보고 종이와 잉크를 산다',
  ], 'every listed activity tells the player when, where, and how to begin');
  assert.ok(CITY_PRODUCTS.some(product => product.id === 'newsprint_sheet'));
  assert.ok(CITY_PRODUCTS.some(product => product.id === 'printing_ink'));
});

test('MAIN01 purchase activity uses a real city-stall transaction with inventory and money changes', () => {
  const state = {
    world: { currentMapId: 'nevsky', date: '1848-05-01' },
    player: { civic: {} }, ledger: [],
    hosts: {
      reader_darya: { id: 'reader_darya', mapId: 'nevsky', position: { x: 4, y: 4 }, money: { amount: 10 }, inventory: [] },
      bookseller_lev: { id: 'bookseller_lev', mapId: 'nevsky', position: { x: 5, y: 4 }, money: { amount: 0, unit: 'kopeks' }, inventory: [] },
    },
  };
  const result = purchaseCityProduct(state, { hostId: 'reader_darya', productId: 'newsprint_sheet' });
  assert.equal(result.ok, true);
  assert.equal(result.state.hosts.reader_darya.money.amount, 7);
  assert.ok(result.state.hosts.reader_darya.inventory.includes('newsprint_sheet'));
  assert.equal(result.state.ledger.at(-1).eventType, 'CITY_PURCHASE');
});
