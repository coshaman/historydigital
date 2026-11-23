import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { campaignForV47StoryProgress, v47StoryMenuEntries, resolveV47StoryEntry, resolveV47StoryMenuEntries, startV47StoryEntry } from '../rpg/engine/v47-story-entry.mjs';
import { toV47StoryQuests, attachV47StoryBeatObjects } from '../rpg/data/v47-story-beats.mjs';
import { v47StoryQuests, attachV47StoryObjects } from '../rpg/data/v47-main-stories.mjs';
import { resolveQuestGuidance } from '../rpg/engine/quest-guidance.mjs';
import { readFile, readdir } from 'node:fs/promises';
import { CITY_PRODUCTS, purchaseCityProduct } from '../rpg/engine/civic-life.mjs';
import { createMain01PrintworkState, main01PrintworkStage } from '../rpg/engine/v47-printwork.mjs';

const quests = [...v47StoryQuests, ...toV47StoryQuests()];
const europeNewsQuest = JSON.parse(await readFile(new URL('../rpg/quests/europe-news-1848.json', import.meta.url), 'utf8'));
const semenovskyQuest = JSON.parse(await readFile(new URL('../rpg/quests/dostoevsky-execution-1849.json', import.meta.url), 'utf8'));
quests.push(europeNewsQuest, semenovskyQuest);
const campaign = JSON.parse(await readFile(new URL('../rpg/quests/campaign.json', import.meta.url), 'utf8'));
const printshopQuest = JSON.parse(await readFile(new URL('../rpg/quests/printshop-article.json', import.meta.url), 'utf8'));
const mapFiles = (await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'));
const maps = Object.fromEntries(await Promise.all(mapFiles.map(async file => {
  const map = JSON.parse(await readFile(new URL(`../rpg/maps/${file}`, import.meta.url), 'utf8'));
  return [map.mapId, map];
})));
const characterFiles = (await readdir(new URL('../rpg/characters/', import.meta.url))).filter(file => file.endsWith('.json'));
const hostCards = await Promise.all(characterFiles.map(file => readFile(new URL(`../rpg/characters/${file}`, import.meta.url), 'utf8').then(JSON.parse)));
attachV47StoryObjects(maps);
attachV47StoryBeatObjects(maps, quests.filter(quest => quest.storyId));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;

test('MAIN01 completion shows the chosen aftermath even when the latest ledger row is bookkeeping', () => {
  const quest = quests.find(item => item.id === 'V47_MAIN01_A11');
  const questStates = { [quest.id]: { status: 'resolved' } };
  for (const choice of quest.actions) {
    const state = {
      world: { v47: { focusStoryId: 'MAIN01', stories: { MAIN01: { consequences: [
        { questId: quest.id, actionId: choice.id, resultKo: choice.resultKo },
      ] } } } },
      ledger: [{ questId: quest.id, actionId: choice.id }, { questId: quest.id, eventType: 'V47_WORLD_CHANGE' }],
    };
    assert.equal(globalThis.V47MainStories.getV47CompletionGuidance(state, [quest], questStates).reasonKo, choice.resultKo);
  }
});

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
    world: { chapterId: 'V33_1847_PRINT', date: '1847-06-01', currentMapId: 'nevsky', clockMinutes: 15 * 60,
      v47: { stories: { MAIN03: { currentEventId: 'V47_MAIN03_P01' } } } },
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

test('MAIN03 progression retains the historical E41 prerequisite required to open its Semenovsky finale', () => {
  const chapter = campaign.arcs.find(arc => arc.id === 'V33_1849_CIRCLE');
  const focused = campaignForV47StoryProgress(campaign, 'MAIN03', chapter.id, quests);
  const focusedChapter = focused.arcs.find(arc => arc.id === chapter.id);
  assert.ok(focusedChapter.questIds.includes('V47_MAIN03_P10'));
  assert.ok(focusedChapter.questIds.includes('E41_SEMENOVSKY_1849'), 'the P11 prerequisite must remain reachable after P10');
  assert.ok(focusedChapter.optionalQuestIds.includes('V47_MAIN03_P11'));
  assert.equal(semenovskyQuest.date, '1850-01-03', 'the game clock uses the Gregorian date for the event');
  assert.equal(semenovskyQuest.originalJulianDate, '1849-12-22', 'the source keeps the date written in the letter');
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

test('MAIN01 story menu replaces the opening hint with the current task after the first beat is resolved', () => {
  const state = { world: { chapterId: 'V33_1848_PUBLIC', date: '1848-03-09' }, quests: {} };
  state.quests.V47_MAIN01_A01 = { status: 'resolved' };
  state.quests.V47_MAIN01_PERMISSION = { status: 'open' };
  const entry = resolveV47StoryMenuEntries(state, quests, campaign).find(item => item.id === 'MAIN01');
  assert.equal(entry.status, 'READY');
  assert.equal(entry.currentTitleKo, '허가 도장과 아직 나가지 못한 책');
  assert.match(entry.introKo, /활자/u);
  assert.match(entry.introKo, /교정쇄/u);
  assert.doesNotMatch(entry.introKo, /구독 장부부터 확인/u);
});

test('MAIN03 can start directly at its first dated scene without completing earlier campaign arcs', () => {
  const state = {
    world: { chapterId: 'V33_1847_PRINT', date: '1847-06-01', currentMapId: 'nevsky', clockMinutes: 540, v47: {} },
    player: { embodiment: null, position: { x: 2, y: 2 } },
    hosts: Object.fromEntries(hostCards.map(card => [card.id, {
      id: card.id, mapId: 'nevsky', position: { x: 4, y: 4 }, historicalAliveAndPresent: true,
      ...(card.presenceWindow ? { presenceWindow: card.presenceWindow } : {}),
    }])),
    quests: {}, ledger: [],
  };
  const entry = resolveV47StoryMenuEntries(state, quests, campaign).find(item => item.id === 'MAIN03');
  assert.equal(entry.statusLabelKo, '지금 시작');
  assert.equal(entry.currentQuestId, 'V37_EUROPE_NEWS_1848');
  const firstQuest = quests.find(quest => quest.id === 'V37_EUROPE_NEWS_1848');
  const result = startV47StoryEntry(state, 'MAIN03', quests, campaign, maps);
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.state.world.chapterId, firstQuest.chapterId);
  assert.equal(result.state.world.date, firstQuest.date);
  assert.equal(result.state.world.clockMinutes, 540, 'a directly started dated story opens at a playable morning time');
  assert.equal(result.state.world.v47.stories.MAIN03.currentEventId, firstQuest.id,
    'direct start replaces a stale future beat pointer with the earliest unresolved historical scene');
  assert.equal(result.state.world.currentMapId, firstQuest.entry.mapId);
  assert.equal(result.state.player.embodiment, 'clerk_alexei', 'the opening role follows the dated scene action');
  assert.equal(state.world.date, '1847-06-01', 'starting MAIN03 leaves the previous save unchanged');
});

test('MAIN01 guidance still finds the exit when a temporary crowd surrounds the selected editor', () => {
  const map = maps.nevsky;
  const state = game.createInitialState({ maps, hostCards, quests, startMapId: 'nevsky' });
  state.world.chapterId = 'V33_1848_PUBLIC';
  state.world.date = '1848-03-09';
  state.world.clockMinutes = 751;
  state.world.currentMapId = 'nevsky';
  state.world.v47.focusStoryId = 'MAIN01';
  state.quests.V47_MAIN01_A01 = { status: 'resolved' };
  state.quests.V47_MAIN01_PERMISSION = { status: 'open' };
  state.player.embodiment = 'editor_sofia';
  state.player.position = { x: 20, y: 13 };
  state.hosts.editor_sofia.mapId = 'nevsky';
  state.hosts.editor_sofia.position = { ...state.player.position };
  const collision = map.layers.find(layer => layer.name === 'Collision').data;
  const occupied = [
    ['bookseller_lev', -1, 0], ['printer_ekaterina', 1, 0],
    ['print_apprentice_stepan', 0, -1], ['nekrasov_reconstruction', 0, 1],
  ];
  for (const [hostId, dx, dy] of occupied) {
    const x = state.player.position.x + dx, y = state.player.position.y + dy;
    if (collision[y * map.width + x] !== 0) continue;
    state.hosts[hostId].historicalAliveAndPresent = true;
    state.hosts[hostId].mapId = 'nevsky';
    state.hosts[hostId].position = { x, y };
  }
  const guide = resolveQuestGuidance({ state, quests, maps, hostCards });
  assert.equal(guide.blocked, false);
  assert.equal(guide.target?.kind, 'exit');
  assert.equal(guide.target?.finalMapId, 'printshop');
  assert.match(guide.howKo, /칸 이동한 뒤 E를 누르세요/);
});

test('MAIN01 role-switch guidance names the action the selected character can actually complete', () => {
  const state = game.createInitialState({ maps, hostCards, quests, startMapId: 'nevsky' });
  state.world.chapterId = 'V33_1848_PUBLIC';
  state.world.date = '1848-03-09';
  state.world.currentMapId = 'nevsky';
  state.world.v47.focusStoryId = 'MAIN01';
  state.quests.V47_MAIN01_A01 = { status: 'resolved' };
  state.quests.V47_MAIN01_PERMISSION = { status: 'open' };
  state.player.embodiment = 'bookseller_lev';
  state.hosts.bookseller_lev.mapId = 'nevsky';
  state.hosts.bookseller_lev.position = { x: 10, y: 10 };
  state.player.position = { ...state.hosts.bookseller_lev.position };

  const guide = resolveQuestGuidance({ state, quests, maps, hostCards });
  const targetId = hostCards.find(card => guide.actionKo.includes(card.displayNameKo))?.id;
  const targetCard = hostCards.find(card => card.id === targetId);
  const targetTask = quests.find(quest => quest.id === guide.questId)?.actions
    .find(action => action.hostIds.includes(targetId))?.labelKo;
  assert.ok(targetCard, 'the guide should point to an eligible character');
  assert.ok(targetTask, 'the target character should have a concrete MAIN01 task');
  assert.ok(guide.reasonKo.includes(targetTask), `the journal should name the task: ${guide.reasonKo}`);
  assert.ok(guide.howKo.includes(targetTask), 'the route guidance should repeat the task to do after arrival');
  assert.match(guide.howKo, /완료/u, 'the journal should explain how to record completion');
});

test('MAIN01 printwork guidance explains the seven physical stages and when the quest step is recorded', () => {
  const state = game.createInitialState({ maps, hostCards, quests, startMapId: 'printshop' });
  state.world.chapterId = 'V33_1848_PUBLIC';
  state.world.date = '1848-03-09';
  state.world.currentMapId = 'printshop';
  state.world.v47.focusStoryId = 'MAIN01';
  state.quests.V47_MAIN01_A01 = { status: 'resolved' };
  state.quests.V47_MAIN01_PERMISSION = { status: 'open' };
  state.player.embodiment = 'printer_ekaterina';
  state.hosts.printer_ekaterina.mapId = 'printshop';
  const printTarget = maps.printshop.layers.find(layer => layer.name === 'Interactions').objects
    .find(object => object.id === quests.find(quest => quest.id === 'V47_MAIN01_PERMISSION').entry.objectId);
  state.hosts.printer_ekaterina.position = { x: Math.floor(printTarget.x / 16), y: Math.floor(printTarget.y / 16) };
  state.player.position = { ...state.hosts.printer_ekaterina.position };

  const guide = resolveQuestGuidance({ state, quests, maps, hostCards });
  assert.equal(guide.blocked, false);
  assert.deepEqual(guide.progress, { completedSteps: 0, totalSteps: 1 }, 'the three role actions are alternative ways to resolve one objective');
  assert.match(guide.actionKo, /인쇄 작업 1\/7/u);
  assert.match(guide.howKo, /7단계를 모두 끝낸 뒤.*교정쇄와 활자 수/u);

  state.world.v47.printwork = { ...createMain01PrintworkState(), step: 4 };
  const midway = resolveQuestGuidance({ state, quests, maps, hostCards });
  assert.match(midway.actionKo, /인쇄 작업 5\/7.*서점에 출고 보류 알리기/u);

  state.world.v47.printwork = { ...createMain01PrintworkState(), step: 7, status: 'COMPLETE' };
  const finished = resolveQuestGuidance({ state, quests, maps, hostCards });
  assert.match(finished.actionKo, /교정쇄와 활자 수를 맞춘다 · 인쇄 작업 완료/u);
  assert.match(finished.howKo, /선택하면 이 목표가 완료/u);

  state.player.embodiment = 'clerk_alexei';
  state.hosts.clerk_alexei.mapId = 'printshop';
  state.hosts.clerk_alexei.position = { ...state.player.position };
  const alternateRole = resolveQuestGuidance({ state, quests, maps, hostCards });
  assert.match(alternateRole.actionKo, /허가 도장을 장부에 옮긴다/u);
  assert.match(alternateRole.howKo, /「허가 도장을 장부에 옮긴다」를 선택/u);
});

test('MAIN01 courier can enter the bookstore for the reservation quest assigned to Pavel', () => {
  const state = game.createInitialState({ maps, hostCards, quests, startMapId: 'bookshop-lane' });
  state.world.chapterId = 'V33_1848_PUBLIC';
  state.world.date = '1848-04-28';
  state.world.clockMinutes = 12 * 60;
  state.world.currentMapId = 'bookshop-lane';
  state.player.embodiment = 'courier_pavel';
  state.player.position = { x: 11, y: 11 };
  state.hosts.courier_pavel.mapId = 'bookshop-lane';
  state.hosts.courier_pavel.position = { ...state.player.position };

  const result = game.transitionMap(state, 'bookshop-lane-bookshop', maps);
  assert.equal(result.ok, true, `Pavel should be allowed into the bookstore for MAIN01: ${result.reason}`);
  assert.equal(result.state.world.currentMapId, 'bookshop-interior');
});

test('quest guidance stays playable when an allowed action points to a source missing from every map', () => {
  const missingSourceQuest = {
    id: 'V47_TEST_MISSING_SOURCE', chapterId: 'V33_1848_PUBLIC', date: '1848-01-31',
    titleKo: '연결되지 않은 자료', entry: { mapId: 'bookshop-interior', objectId: 9060 },
    actions: [{ id: 'READ_MISSING_SOURCE', hostIds: ['bookseller_lev'], requiredKnowledgeId: 'SOURCE_NOT_ON_ANY_MAP' }],
  };
  const state = game.createInitialState({ maps, hostCards, quests: [missingSourceQuest], startMapId: 'bookshop-interior' });
  state.world.chapterId = 'V33_1848_PUBLIC';
  state.world.date = '1848-02-01';
  state.world.currentMapId = 'bookshop-interior';
  state.player.embodiment = 'bookseller_lev';
  state.hosts.bookseller_lev.mapId = 'bookshop-interior';
  state.hosts.bookseller_lev.position = { x: 5, y: 5 };
  state.player.position = { ...state.hosts.bookseller_lev.position };

  const guide = resolveQuestGuidance({ state, quests: [missingSourceQuest], maps, hostCards });
  assert.equal(guide.blocked, true);
  assert.equal(guide.target, null);
  assert.match(guide.blockedReasonKo, /자료/u);
  assert.doesNotMatch(guide.howKo, /undefined|null/u);
});

test('quest guidance switches to a role that can reach the required source', () => {
  const sourceId = 'OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849';
  const roleSwitchQuest = {
    id: 'V47_TEST_SOURCE_ACCESS', chapterId: 'V33_1849_CIRCLE', date: '1849-05-05',
    titleKo: '접근 권한이 다른 기록', entry: { mapId: 'inn-interior', objectId: 9069 },
    actions: [{ id: 'READ_ARREST_ORDER', hostIds: ['bookseller_lev', 'clerk_alexei'], requiredKnowledgeId: sourceId }],
  };
  const state = game.createInitialState({ maps, hostCards, quests: [roleSwitchQuest], startMapId: 'inn-interior' });
  state.world.chapterId = 'V33_1849_CIRCLE';
  state.world.date = '1849-05-05';
  state.world.currentMapId = 'inn-interior';
  state.player.embodiment = 'bookseller_lev';
  state.hosts.bookseller_lev.mapId = 'inn-interior';
  state.hosts.bookseller_lev.position = { x: 5, y: 5 };
  state.hosts.clerk_alexei.historicalAliveAndPresent = true;
  state.hosts.clerk_alexei.mapId = 'chancery';
  state.hosts.clerk_alexei.position = { x: 5, y: 5 };
  state.player.position = { ...state.hosts.bookseller_lev.position };

  const guide = resolveQuestGuidance({ state, quests: [roleSwitchQuest], maps, hostCards });
  assert.equal(guide.blocked, false);
  assert.equal(guide.taskType, 'SWITCH');
  assert.match(guide.actionKo, /알렉세이/u);
  assert.match(guide.howKo, /체포 명령|명령서/u);
});

test('MAIN01 completion advances with its story-scoped chapter requirements', async () => {
  const state = game.createInitialState({ maps, hostCards, quests, startMapId: 'printshop' });
  state.world.chapterId = 'V33_1848_PUBLIC';
  state.world.date = '1848-12-12';
  state.world.currentMapId = 'printshop';
  state.world.v47.focusStoryId = 'MAIN01';
  const scopedCampaign = campaignForV47StoryProgress(campaign, 'MAIN01', 'V33_1848_PUBLIC', quests);
  const scopedCurrentArc = scopedCampaign.arcs.find(arc => arc.id === 'V33_1848_PUBLIC');
  for (const questId of scopedCurrentArc.questIds) state.quests[questId] = { status: 'resolved' };

  const unscopedAttempt = game.advanceChapter(state, 'V33_1849_PRELUDE', campaign, maps);
  assert.equal(unscopedAttempt.reason, 'prior_chapter_incomplete', 'unrelated MAIN03/MAIN05 quests must not block MAIN01 continuation');
  const scopedAttempt = game.advanceChapter(state, 'V33_1849_PRELUDE', scopedCampaign, maps);
  assert.equal(scopedAttempt.ok, true);
  assert.equal(scopedAttempt.state.world.date, '1849-03-20');

  const mainSource = await readFile(new URL('../rpg/main.js', import.meta.url), 'utf8');
  assert.match(mainSource, /advanceChapter\(state, nextArc\.id, progressionCampaign, maps\)/,
    'the visible year-advance action must use the same story-scoped requirements it displays');
});

test('MAIN01 roster possession recovers a host spawned on a blocked tile before routing to the source', () => {
  const storyQuest = {
    id: 'V47_MAIN01_A03', chapterId: 'V33_1848_PUBLIC', date: '1848-05-06',
    titleKo: '작품의 가족을 두고 말하다', entry: { mapId: 'printshop', objectId: 9062 },
    actions: [{ id: 'READ_TALNIKOV', hostIds: ['editor_sofia'], requiredKnowledgeId: 'V47-PANAEVA-TALNIKOV-CH1-1848' }],
  };
  const state = game.createInitialState({ maps, hostCards, quests: [storyQuest], startMapId: 'nevsky' });
  state.world.chapterId = 'V33_1848_PUBLIC';
  state.world.date = '1848-05-18';
  state.world.clockMinutes = 12 * 60;
  state.world.currentMapId = 'nevsky';
  state.hosts.editor_sofia.historicalAliveAndPresent = true;
  state.hosts.editor_sofia.mapId = 'nevsky';
  state.hosts.editor_sofia.position = { x: 14, y: 1 };

  const possessed = game.possessHostFromRoster(state, 'editor_sofia', maps);
  assert.equal(possessed.ok, true, possessed.reason);
  const guide = resolveQuestGuidance({ state: possessed.state, quests: [storyQuest], maps, hostCards });
  assert.equal(guide.blocked, false, guide.blockedReasonKo);
  assert.equal(guide.target?.kind, 'exit');
  assert.equal(possessed.state.hosts.editor_sofia.position.y > 1, true);
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
