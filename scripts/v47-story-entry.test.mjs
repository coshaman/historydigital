import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignForV47StoryProgress, v47StoryMenuEntries, resolveV47StoryEntry, resolveV47StoryMenuEntries, startV47StoryEntry } from '../rpg/engine/v47-story-entry.mjs';
import { toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';
import { v47StoryQuests } from '../rpg/data/v47-main-stories.mjs';
import { readFile } from 'node:fs/promises';
import { CITY_PRODUCTS, purchaseCityProduct } from '../rpg/engine/civic-life.mjs';
import { createMain01PrintworkState, main01PrintworkStage } from '../rpg/engine/v47-printwork.mjs';

const quests = [...v47StoryQuests, ...toV47StoryQuests()];
const campaign = JSON.parse(await readFile(new URL('../rpg/quests/campaign.json', import.meta.url), 'utf8'));
const printshopQuest = JSON.parse(await readFile(new URL('../rpg/quests/printshop-article.json', import.meta.url), 'utf8'));

test('history menu exposes all three V47 main stories with player-facing names', () => {
  const entries = v47StoryMenuEntries();
  assert.deepEqual(entries.map(entry => entry.id), ['MAIN01', 'MAIN03', 'MAIN05']);
  assert.match(entries[0].titleKo, /금지된 삽화 연감/);
  assert.match(entries[0].firstTaskKo, /구독 장부/);
});

test('MAIN01 selection starts its dated story instead of gating it behind 1847 campaign quests', () => {
  const state = { world: { chapterId: 'V33_1847_PRINT', date: '1847-06-01' }, quests: {} };
  const guide = resolveV47StoryEntry(state, 'MAIN01', quests, campaign);
  assert.equal(guide.status, 'READY');
  assert.equal(guide.storyQuestId, 'V47_MAIN01_A01');
  assert.equal(guide.currentQuestId, 'V47_MAIN01_A01');
  assert.match(guide.currentTaskKo, /구독 장부/);
});

test('starting MAIN01 moves the player to its first scene and keeps a character in its role cast', () => {
  const state = {
    world: { chapterId: 'V33_1847_PRINT', date: '1847-06-01', currentMapId: 'nevsky', clockMinutes: 540, v47: {} },
    player: { embodiment: 'courier_pavel', position: { x: 22, y: 10 } },
    hosts: {
      courier_pavel: { id: 'courier_pavel', mapId: 'nevsky', position: { x: 22, y: 10 }, historicalAliveAndPresent: true },
      bookseller_lev: { id: 'bookseller_lev', mapId: 'nevsky', position: { x: 25, y: 16 }, historicalAliveAndPresent: true },
    },
    quests: {}, ledger: [],
  };
  const maps = { 'bookshop-interior': { metadata: { observerStart: { x: 11, y: 14 } } } };
  const result = startV47StoryEntry(state, 'MAIN01', quests, campaign, maps);
  assert.equal(result.ok, true);
  assert.equal(result.state.world.chapterId, 'V33_1848_PUBLIC');
  assert.equal(result.state.world.date, '1848-02-12');
  assert.equal(result.state.world.currentMapId, 'bookshop-interior');
  assert.equal(result.state.player.embodiment, 'bookseller_lev');
  assert.deepEqual(result.state.hosts.bookseller_lev.position, { x: 11, y: 14 });
  assert.equal(result.state.quests.PRINTSHOP_PROOF_1847, undefined, 'starting a story does not falsely complete unrelated campaign work');
  assert.equal(state.world.date, '1847-06-01', 'starting a story leaves the prior save object untouched');
});

test('MAIN01 date progression ignores unrelated earlier quests in its shared chapter', () => {
  const chapter = campaign.arcs.find(arc => arc.id === 'V33_1848_PUBLIC');
  const focused = campaignForV47StoryProgress(campaign, 'MAIN01', chapter.id, quests);
  const focusedChapter = focused.arcs.find(arc => arc.id === chapter.id);
  assert.ok(focusedChapter.questIds.includes('V47_MAIN01_PERMISSION'));
  assert.ok(focusedChapter.questIds.includes('V47_MAIN01_A02'));
  assert.ok(!focusedChapter.questIds.includes('PUBLIC_DISCOURSE_1848'));
  assert.ok(!focusedChapter.questIds.includes('V47_MAIN03_P01'));
  assert.deepEqual(campaign.arcs.find(arc => arc.id === chapter.id).questIds, chapter.questIds,
    'scoping one story must not mutate the shared campaign timeline');
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

test('historical locations menu identifies MAIN01 as directly startable from the initial 1847 save', () => {
  const state = { world: { chapterId: 'V33_1847_PRINT', date: '1847-06-01' }, quests: {} };
  const entry = resolveV47StoryMenuEntries(state, [...quests, printshopQuest], campaign).find(item => item.id === 'MAIN01');
  assert.equal(entry.status, 'READY');
  assert.equal(entry.statusLabelKo, '지금 시작');
  assert.equal(entry.currentTitleKo, '부록은 어디 있습니까?');
  assert.match(entry.menuTaskKo, /구독 장부/);
  assert.doesNotMatch(entry.menuTaskKo, /교정쇄의 행선지/);
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

test('MAIN01 typesetting stage shows the exact title the player must compose', () => {
  const stage = main01PrintworkStage(createMain01PrintworkState());
  assert.equal(stage.typeSetter.modelTitle, 'Семейство Тальниковых');
});
