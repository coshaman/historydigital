import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import v47Runtime from '../rpg/engine/v47-main-stories.js';
const { advanceV47World, applyCholeraIntervention, createV47State, getV47MissionQuest, getV47CompletionGuidance, julianDateToGregorian, registerStoryBeats, WORLD_EVENT_ANCHORS } = v47Runtime;
import { attachV47StoryObjects, v47StoryQuests } from '../rpg/data/v47-main-stories.mjs';
import { attachV47StoryBeatObjects, toV47StoryQuests, v47StoryBeatIds, v47StoryBeats } from '../rpg/data/v47-story-beats.mjs';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { continuationQuest, questChoices } from '../rpg/engine/quest-presentation.mjs';
import { sourceAvailableOn } from '../rpg/engine/source-availability.mjs';
import { questOutcomeSummary } from '../rpg/engine/quest-outcome-summary.mjs';
import { v47RoleCards } from '../rpg/data/v47-character-roles.mjs';
import { buildLifeTimeline } from '../rpg/engine/learning-life.mjs';
const storyBeatQuests = toV47StoryQuests();
registerStoryBeats(storyBeatQuests);
const allV47StoryQuests = [...v47StoryQuests, ...storyBeatQuests];
assert.equal(v47StoryQuests.find(quest => quest.id === 'V47_MAIN05_WATER_NOTICE')?.entry?.mapId, 'inn-interior',
  'the first cholera screenplay scene begins in the inn, where its authored opening dialogue takes place');
const almanacOpening = storyBeatQuests.find(quest => quest.id === 'V47_MAIN01_A01');
assert.deepEqual(almanacOpening.actions.map(action => action.id), [
  'V47_A01_OPEN_SUBSCRIBER_LEDGER', 'V47_A01_SEND_PAVEL_TO_PRINTSHOP',
], 'the first almanac scene lets the player confirm the subscriber or send a courier to the printshop');
assert.ok(almanacOpening.actions[0].effects.v47WorldChange.inventory.some(item => item.itemKo === '부록 예약 영수증')
  && almanacOpening.actions[1].effects.v47WorldChange.inventory.some(item => item.itemKo === '인쇄소 확인 쪽지'),
'the opening branches leave a receipt or a physical inquiry note and dispatch the courier');
const visibleAlmanacChanges = questOutcomeSummary(almanacOpening.actions[0], {
  hostNames: new Map([['printer_ekaterina', '예카테리나'], ['print_apprentice_stepan', '스테판'], ['bookseller_lev', '레프']]),
  mapNames: new Map([['printshop', '인쇄소']]),
});
assert.ok(visibleAlmanacChanges.includes('부록 예약 영수증') && visibleAlmanacChanges.includes('신뢰가 쌓임'),
'the subscriber-ledger action visibly shows its concrete receipt and relationship effect');
const almanacStorySource = JSON.parse(await readFile(new URL('../rpg/data/historical-source-packets.json', import.meta.url), 'utf8'))
  .records.find(record => record.sourceId === 'V47-PANAEVA-TALNIKOV-CH1-1848');
const almanacStoryIndex = JSON.parse(await readFile(new URL('../rpg/data/source-reader-index.json', import.meta.url), 'utf8'))
  .records.find(record => record.sourceId === 'V47-PANAEVA-TALNIKOV-CH1-1848');
const almanacA03 = storyBeatQuests.find(quest => quest.id === 'V47_MAIN01_A03');
const printshopMap = JSON.parse(await readFile(new URL('../rpg/maps/printshop.json', import.meta.url), 'utf8'));
const talnikovSourceObject = printshopMap.layers.find(layer => layer.name === 'Interactions').objects
  .find(object => object.type === 'source' && object.properties.some(property => property.value === 'V47-PANAEVA-TALNIKOV-CH1-1848'));
assert.equal(almanacStorySource?.paragraphs?.length, 13, 'the Talnikov scene contains the contiguous opening through the father’s violent assault, with Korean translation');
assert.ok(almanacStorySource.paragraphs.every(paragraph => paragraph.ru && paragraph.ko), 'each original paragraph has an aligned project translation');
assert.ok(almanacStorySource.range.includes('leaves 9–11') && almanacStorySource.range.includes('lines 27–40') && almanacStorySource.range.includes('108–111'), 'the source record identifies its exact original scan leaves and separate 1928 textual witness');
assert.match(almanacStorySource.verificationStatus, /1848_ORIGINAL_SCAN_VISUALLY_COLLATED_ON_LEAVES_9_11.*13_CONTIGUOUS_PARAGRAPHS_CHECKED/, 'the complete excerpt is checked against the original 1848 page images');
assert.ok(almanacStorySource.contextKo.includes('아버지의 폭력') && almanacStorySource.paragraphs.at(-3).ru.includes('правах родителей'),
  'players receive the concrete family-authority conflict before the related choice');
assert.equal(almanacStoryIndex?.accessibleToPlayerAt, '1848-05-06', 'the story text cannot appear before this chapter date');
assert.equal(almanacStoryIndex?.textStatus, 'DIRECT', 'the story excerpt is checked against the original 1848 scan');
assert.ok(almanacA03.sourceIds.includes('V47-PANAEVA-TALNIKOV-CH1-1848'), 'the player must read the story before making the related choice');
assert.ok(talnikovSourceObject?.properties.some(property => property.name === 'availableDate' && property.value === '1848-05-06'), 'the printshop physically exposes the source only on its game date');
assert.ok(talnikovSourceObject?.properties.some(property => property.name === 'questId' && property.value === 'V47_MAIN01_A03'), 'finishing the physical reading can return directly to its waiting quest');
assert.ok(almanacA03.actions.every(action => action.requiredKnowledgeId === 'V47-PANAEVA-TALNIKOV-CH1-1848'), 'both A03 choices require the player to read the story first');
assert.ok(questChoices(almanacA03, 'midwife_avdotya', [], null).every(choice => choice.missingSourceId === 'V47-PANAEVA-TALNIKOV-CH1-1848'), 'A03 choices stay disabled before the source is read');
assert.ok(questChoices(almanacA03, 'midwife_avdotya', ['V47-PANAEVA-TALNIKOV-CH1-1848'], null).every(choice => choice.missingSourceId === null), 'A03 choices unlock for the body that read the source');
for (const questId of [
  'V47_MAIN01_A01', 'V47_MAIN01_A05', 'V47_MAIN01_A11', 'V47_MAIN01_SUBSCRIBER_REPLY',
  'V47_MAIN03_P01', 'V47_MAIN03_P05', 'V47_MAIN03_P06', 'V47_MAIN03_ARRESTS',
  'V47_MAIN03_P03', 'V47_MAIN05_WATER_NOTICE', 'V47_MAIN05_C03', 'V47_MAIN05_C05', 'V47_MAIN05_C06', 'V47_MAIN05_C11',
]) {
  const scene = allV47StoryQuests.find(quest => quest.id === questId);
  assert.ok(scene?.dialogue?.length >= 2, `${questId} exposes the authored scenario scene before choices`);
  assert.equal(scene.dialogueStatus, 'NEWLY_AUTHORED_FROM_V47_SCENARIO', `${questId} dialogue is not mislabeled as historical quotation`);
  assert.ok(scene.dialogue.every(turn => turn.speakerKo && turn.lineKo), `${questId} has readable speaker lines`);
}
const screenplayDialogueCoverage = [
  ['D-A1', 'V47_MAIN01_A01', '부록 주문은 장부에 있는데'],
  ['D-A2', 'V47_MAIN01_A05', '인용과 판단을 한 문장에 섞어 적으면'],
  ['D-A3', 'V47_MAIN01_A11', '그럼 제 임금은 누구 이름으로 줍니까?'],
  ['D-A4', 'V47_MAIN01_SUBSCRIBER_REPLY', '지금 제 손엔 지급할 책이 없고요.'],
  ['D-B1', 'V47_MAIN03_P01', '밖에 나갔을 때도 같은 말을 할지는 각자 생각해 봐야겠지요.'],
  ['D-B2', 'V47_MAIN03_P03', '그럼 오늘은 네 가지를 따로 묻죠.'],
  ['D-B3', 'V47_MAIN03_P05', '무슨 뜻에 박수를 쳤느냐 아닙니까?'],
  ['D-B4', 'V47_MAIN03_P06', '들어간 사람이 무슨 말을 했는지는 적지 마세요.'],
  ['D-B5', 'V47_MAIN03_ARRESTS', '여기 있다고는 아직 확인하지 못했습니다.'],
  ['D-C1', 'V47_MAIN05_WATER_NOTICE', '손님을 거리로 내보내지는 마.'],
  ['D-C2', 'V47_MAIN05_C05', '동생이 마신 물을 가져오시죠.'],
  ['D-C3', 'V47_MAIN05_C06', '제가 알아요.'],
  ['D-C4', 'V47_MAIN05_C03', '그분들이 돈을 못 내시는 건 압니다.'],
  ['D-C5', 'V47_MAIN05_C11', '지금은 그 방에 누가 남아 있죠?'],
];
for (const [sceneId, questId, lineFragment] of screenplayDialogueCoverage) {
  const scene = allV47StoryQuests.find(quest => quest.id === questId);
  assert.ok(scene?.dialogue?.some(turn => turn.lineKo.includes(lineFragment)),
    `${sceneId} screenplay dialogue is wired to ${questId}`);
  assert.equal(scene.dialogueStatus, 'NEWLY_AUTHORED_FROM_V47_SCENARIO',
    `${sceneId} remains attributed as authored scene dialogue rather than historical quotation`);
}
const reviewChoices = storyBeatQuests.find(quest => quest.id === 'V47_MAIN01_A05').actions;
assert.ok(reviewChoices.some(action => action.labelKo === '보고서가 지적한 장면을 그대로 적는다')
  && reviewChoices.some(action => action.labelKo === '단어만 지우면 그 집의 일이 없어집니까?'),
'D-A2 choices follow the screenplay conflict about the scene under review, not generic office procedure');
const salonChoices = storyBeatQuests.find(quest => quest.id === 'V47_MAIN03_P01').actions;
assert.ok(salonChoices.some(action => action.labelKo === '먼저 신문에서 실제로 일어난 일을 읽는다')
  && salonChoices.some(action => action.labelKo === '농노에게 이 소식이 무슨 뜻인지 묻는다')
  && salonChoices.some(action => action.labelKo === '사람들이 왜 목소리를 낮추는지 묻는다'),
'D-B1 first choices match its three concrete conversation directions');
const choleraOpening = allV47StoryQuests.find(quest => quest.id === 'V47_MAIN05_WATER_NOTICE');
assert.ok(choleraOpening.actions.some(action => action.labelKo.startsWith('마신 물과 아픈 시각을 적고'))
  && choleraOpening.actions.some(action => action.labelKo.includes('환자 곁에 있는다'))
  && choleraOpening.actions.some(action => action.labelKo.includes('손님들 동선을 나누고')),
'D-C1 gives the player the screenplay actions of observation, care, and inn operations');
const choleraOpeningWaterChoice = choleraOpening.actions.find(action => action.id === 'V47_C00_CLEAN_WATER');
assert.equal(choleraOpeningWaterChoice.hostIds[0], 'innkeeper_irina',
  'the inn-opening water choice is accessible to the character who can physically enter the inn');
assert.equal(choleraOpeningWaterChoice.effects.v47TargetHostId, 'watercarrier_luka',
  'the innkeeper can ask the water carrier to clean the water source without acting as if she owns his route');
assert.ok(choleraOpening.actions.find(action => action.id === 'V47_C00_TEND_PATIENT').hostIds.includes('innkeeper_irina'),
  'the innkeeper can choose the screenplay branch to stay with the ill guest');
const ideologyScene = allV47StoryQuests.find(quest => quest.id === 'V47_MAIN03_P03');
for (const actionId of ['V47_P03_FOURIER_AND_LIVELIHOOD', 'V47_P03_SERFDOM_AND_LAND', 'V47_P03_FAITH_AND_FREEDOM', 'V47_P03_PRESS_AND_ORDER']) {
  assert.ok(ideologyScene.actions.some(action => action.id === actionId), `MAIN03 includes the consequential discussion branch ${actionId}`);
}
assert.ok(storyBeatQuests.find(quest => quest.id === 'V47_MAIN05_C03').actions.some(action => action.id === 'V47_C03_REQUEST_STOCK'),
  'the cholera medicine scene includes the screenplay branch to request stock from another shop');
assert.deepEqual(storyBeatQuests.find(quest => quest.id === 'V47_MAIN05_C06').actions.map(action => action.id), [
  'V47_C06_PROTECT_CART', 'V47_C06_DISPERSE_CROWD', 'V47_C06_HEAR_WITNESSES', 'V47_C06_REPEAT_RUMOR',
], 'the water-carrier scene implements protecting the cart, dispersing the crowd, hearing witnesses, and repeating the rumor');
for (const [questId, actionId] of [
  ['V47_MAIN03_P01', 'V47_P01_READ_NEWS_FIRST'],
  ['V47_MAIN03_P05', 'V47_P05_DISCUSS_ARGUMENT'],
  ['V47_MAIN03_P06', 'V47_P06_LOG_SOURCED_REPORT'],
  ['V47_MAIN01_A05', 'V47_A05_WITHHOLD_SIGNATURE'],
  ['V47_MAIN01_A11', 'V47_A11_FIND_REPLACEMENT_WORK'],
  ['V47_MAIN01_A11', 'V47_A11_PUBLIC_DISPOSAL_LIST'],
  ['V47_MAIN01_SUBSCRIBER_REPLY', 'V47_A08_PROMISE_UNAVAILABLE_COPY'],
  ['V47_MAIN03_P06', 'V47_P06_ASSERT_UNVERIFIED_SUSPICION'],
  ['V47_MAIN05_C05', 'V47_C05_LISTEN_TO_FAMILY'],
]) assert.ok(allV47StoryQuests.find(quest => quest.id === questId).actions.some(action => action.id === actionId),
  `${questId} implements the matching screenplay choice ${actionId}`);
assert.equal(julianDateToGregorian('1849-04-23'), '1849-05-05', 'Russian historical dates convert into the shared Gregorian world clock');
assert.deepEqual(getV47CompletionGuidance({ world: { v47: { focusStoryId: 'MAIN01' } }, ledger: [
  { questId: 'V47_MAIN01_A11', outcomeKo: '사본은 안나의 손에 남았다.' },
] }, [{ id: 'V47_MAIN01_A11', storyId: 'MAIN01' }], { 'V47_MAIN01_A11': { status: 'resolved' } }), {
  questTitleKo: '인쇄 연감의 뒷이야기', actionKo: '다른 사건을 고르거나, 이곳에 남은 사람들을 만나보자.',
  reasonKo: '사본은 안나의 손에 남았다.', howKo: '사건 목록에서 다음 이야기를 고른다.', target: null,
}, 'after the focused story ends, the journal replaces stale unrelated legacy guidance with its actual aftermath');
const historicalAnchors = WORLD_EVENT_ANCHORS;
assert.ok(historicalAnchors.every(row => row.sourceIds.length > 0), 'fixed historical anchors cite checked-in source records');
assert.ok(historicalAnchors.every(row => row.gameDate === row.convertedGregorianDate), 'fixed events run on the shared Gregorian clock');
assert.ok(historicalAnchors.filter(row => row.id.startsWith('MAIN01_') && ['MAIN01_PERMISSION', 'MAIN01_DISTRIBUTION_BAN'].includes(row.id))
  .every(row => row.sourceStatus === 'MODERN_EDITORIAL_DATE_PROVENANCE_ONLY_NOT_PLAYER_EVIDENCE'),
'MAIN01 dates sourced only from the modern editorial note are not represented as documents a 1848 player read');
assert.equal(v47StoryQuests.find(quest => quest.id === 'V47_MAIN01_PERMISSION').date,
  historicalAnchors.find(row => row.id === 'MAIN01_PERMISSION').gameDate, 'the playable permission scene opens on its converted historical date');
assert.equal(v47StoryQuests.find(quest => quest.id === 'V47_MAIN01_DISTRIBUTION_BAN').date,
  historicalAnchors.find(row => row.id === 'MAIN01_DISTRIBUTION_BAN').gameDate, 'the playable ban scene does not precede its converted historical date');
const aftermathTimeline = buildLifeTimeline({ ledger: [
  { questId: 'V47_MAIN01_DISTRIBUTION_BAN', actionId: 'V47_A06_KEEP_COPY' },
  { questId: 'V47_MAIN03_ARRESTS', actionId: 'V47_P07_WARN_FICTIONAL' },
  { questId: 'V47_MAIN05_WATER_NOTICE', actionId: 'V47_C00_CLEAN_WATER' },
], world: { v47: { cholera: { counters: { recoveries: 2, deaths: 1 }, waterSources: { WELL: { cleaned: true } } } } } }, {
  periods: [{ id: '1850', year: 1850, statePath: 'route.circleLearning', default: { id: 'LIFE-1850', title: '1850', textKo: '일을 잇는다', fictional: true } }],
});
assert.deepEqual(aftermathTimeline.map(episode => episode.id), [
  'LIFE-1850', 'V47-LIFE-ALMANAC-AFTERMATH', 'V47-LIFE-FRIDAY-AFTERMATH', 'V47-LIFE-CHOLERA-AFTERMATH',
], 'the three V47 story outcomes enter the life timeline after the first future-year episode');
assert.ok(aftermathTimeline[2].textKo.includes('바실리는 경고를 받고'));
assert.ok(aftermathTimeline[3].textKo.includes('회복 2명, 사망 1명'));
const focusedMissionState = {
  world: { date: '1848-03-20', chapterId: 'V33_1848_PUBLIC', v47: { focusStoryId: 'MAIN01', stories: { MAIN01: { currentEventId: 'V47_MAIN01_A01' } } } },
  quests: { V47_MAIN01_A01: { status: 'resolved' } }, ledger: [{ questId: 'V47_MAIN01_A01', actionId: 'V47_A01_OPEN_SUBSCRIBER_LEDGER' }],
};
assert.equal(getV47MissionQuest(focusedMissionState, allV47StoryQuests)?.id, 'V47_MAIN01_A02',
  'after a V47 action, mission focus advances to the next unresolved beat in the same story');
const alternateFocusState = structuredClone(focusedMissionState);
alternateFocusState.world.v47.focusStoryId = 'MAIN03';
assert.equal(getV47MissionQuest(alternateFocusState, allV47StoryQuests)?.id, 'V47_MAIN03_P01',
  'the player can focus the 1848 European news story independently of the almanac after entering the beat graph');
const require = createRequire(import.meta.url);
const game = require('../rpg/engine/game-state.js');
const readJson = async url => JSON.parse(await readFile(url, 'utf8'));

const storyActors = Object.fromEntries(['MAIN01', 'MAIN03', 'MAIN05'].map(storyId => [storyId,
  new Set(allV47StoryQuests.filter(quest => quest.id.includes(storyId))
    .flatMap(quest => quest.actions.flatMap(action => action.hostIds)))]));
for (const [storyId, hostIds] of Object.entries(storyActors)) {
  assert.ok(hostIds.size >= 8, `${storyId} exposes at least eight distinct possessable event roles`);
}
for (const [storyId, hostId] of [
  ['MAIN01', 'panaev_1848'], ['MAIN01', 'panaeva_1848'],
  ['MAIN03', 'petrashevsky_1849'], ['MAIN03', 'antonelli_1849'], ['MAIN03', 'liprandi_1849'],
  ['MAIN05', 'doctor_mikhail_1848'],
]) assert.ok(storyActors[storyId].has(hostId), `${storyId} gives ${hostId} a real scene action`);
assert.ok(v47RoleCards.some(card => card.id === 'doctor_mikhail_1848' && card.kind === 'FICTIONAL'), 'cholera physician is a fictional era-bounded role');

const v47Packets = await readJson('./rpg/data/historical-source-packets.json');
const v47Reader = await readJson('./rpg/data/source-reader-index.json');
const choleraContemporary = v47Packets.records.find(record => record.sourceId === 'V47-ECONOMIST-PETERSBURG-1848-06-24');
const choleraContemporaryIndex = v47Reader.records.find(record => record.sourceId === 'V47-ECONOMIST-PETERSBURG-1848-06-24');
assert.ok(choleraContemporary?.paragraphs?.length, 'MAIN05 has a contemporary 1848 source with a readable excerpt');
assert.equal(choleraContemporaryIndex?.accessibleToPlayerAt, '1848-07-08', 'the 1848 newspaper appears only after publication');
assert.equal(sourceAvailableOn(choleraContemporaryIndex, choleraContemporary, null, '1848-07-07'), false);
assert.equal(sourceAvailableOn(choleraContemporaryIndex, choleraContemporary, null, '1848-07-08'), true);
assert.ok(allV47StoryQuests.some(quest => quest.id === 'V47_MAIN05_C08'
  && quest.sourceIds.includes('V47-ECONOMIST-PETERSBURG-1848-06-24')),
'the contemporary cholera report is readable during the story after its issue date');

const state = { world: { date: '1848-06-01', clockMinutes: 540 }, hosts: {
  anna: { id: 'anna', kind: 'FICTIONAL', mapId: 'courtyard', healthState: { condition: 'FIT' }, inventory: [] },
  luka: { id: 'luka', kind: 'FICTIONAL', mapId: 'market-quay', healthState: { condition: 'FIT' }, inventory: [] },
}, quests: {}, ledger: [] };
state.world.v47 = createV47State();

let next = advanceV47World(state, { date: '1848-06-01', clockMinutes: 540 });
assert.equal(next.world.v47.events.MAIN05_CHOLERA_ARRIVAL, undefined, 'disease scene does not fire before its authored date');
next = advanceV47World(next, { date: '1848-06-13', clockMinutes: 540 });
assert.equal(next.world.v47.events.MAIN05_CHOLERA_SCENE_OPEN, undefined, 'scene date is converted before the shared clock opens it');
next = advanceV47World(next, { date: '1848-06-14', clockMinutes: 540 });
assert.equal(next.world.v47.events.MAIN05_CHOLERA_SCENE_OPEN.stage, 'WATER_NOTICE', 'the event opens on its authored scene date');
assert.equal(next.world.v47.cholera.hosts.anna.state, 'S', 'residents begin susceptible');

const mapContactOnly = structuredClone(next);
mapContactOnly.hosts = {
  anna: { id: 'anna', kind: 'FICTIONAL', mapId: 'courtyard', healthState: { condition: 'FIT' } },
  luka: { id: 'luka', kind: 'FICTIONAL', mapId: 'courtyard', healthState: { condition: 'FIT' } },
};
mapContactOnly.world.v47.cholera.status = 'ACTIVE';
mapContactOnly.world.v47.cholera.waterRisk = 0; mapContactOnly.world.v47.cholera.foodRisk = 0;
for (const source of Object.values(mapContactOnly.world.v47.cholera.waterSources)) source.risk = 0;
for (const source of Object.values(mapContactOnly.world.v47.cholera.foodSources)) source.risk = 0;
mapContactOnly.world.v47.cholera.dayIndex = null;
mapContactOnly.world.v47.cholera.hosts = {
  anna: { state: 'I', exposedDays: 0, infectiousDays: 0, careDays: 0, severity: 'MILD' },
  luka: { state: 'S', exposedDays: 0, infectiousDays: 0, careDays: 0, severity: 'UNASSESSED' },
};
const sameMapOnly = advanceV47World(mapContactOnly, { date: '1848-06-02', clockMinutes: 540 });
assert.equal(sameMapOnly.world.v47.cholera.hosts.luka.state, 'S',
  'sharing a broad courtyard map does not count as household transmission or direct contact');
const sharedDwelling = structuredClone(mapContactOnly);
for (const host of Object.values(sharedDwelling.hosts)) host.residence = { sleepLocation: {
  mapId: 'courtyard', position: { x: 14, y: 3 },
} };
const householdSpread = advanceV47World(sharedDwelling, { date: '1848-06-02', clockMinutes: 540 });
assert.equal(householdSpread.world.v47.cholera.hosts.luka.source, 'HOUSEHOLD_CONTACT',
  'household contact is based on a shared dwelling location rather than a shared map');

const cleanWater = applyCholeraIntervention(next, { actionId: 'CLEAN_WATER', hostId: 'anna' });
assert.equal(cleanWater.ok, true);
assert.equal(cleanWater.state.world.v47.cholera.waterSources[cleanWater.state.world.v47.cholera.hosts.anna.waterSourceId].risk, 0.3);
assert.ok(cleanWater.state.world.v47.cholera.waterRisk < next.world.v47.cholera.waterRisk,
  'cleaning the assigned source changes the shared risk while leaving the other three sources in play');
assert.equal(Object.keys(cleanWater.state.world.v47.cholera.waterSources).length, 4);
assert.equal(Object.keys(cleanWater.state.world.v47.cholera.foodSources).length, 8);
assert.equal(Object.keys(cleanWater.state.world.v47.cholera.areas).length, 7);
const invalid = applyCholeraIntervention(cleanWater.state, { actionId: 'AIRBORNE_CURE', hostId: 'anna' });
assert.equal(invalid.ok, false, 'the model has no airborne-transmission action');

const exposed = applyCholeraIntervention(next, { actionId: 'DRINK_CONTAMINATED_WATER', hostId: 'anna' });
assert.equal(exposed.ok, true);
assert.equal(exposed.state.world.v47.cholera.hosts.anna.state, 'E');
assert.equal(exposed.state.world.v47.cholera.hosts.luka.state, 'S', 'proximity alone never transmits disease');

let recovered = exposed.state;
for (let day = 0; day < 12; day += 1) recovered = advanceV47World(recovered, {
  date: '1848-06-14', clockMinutes: 540 + (day + 1) * 1440,
});
assert.equal(recovered.world.v47.cholera.hosts.anna.state, 'R', 'care and time allow recovery without a forced death');
assert.equal(recovered.world.v47.cholera.hosts.anna.state, 'R');
assert.ok(['UNWELL', 'RECOVERING'].includes(recovered.hosts.anna.healthState.condition),
  'cholera health uses the existing save-compatible condition schema');

const skipped = advanceV47World({ world: { date: '1848-11-02', clockMinutes: 540 }, hosts: {}, quests: {}, ledger: [] },
  { date: '1848-11-02', clockMinutes: 540 });
assert.equal(skipped.world.v47.events.MAIN01_DISTRIBUTION_BAN.stage, 'OFFSCREEN_DISTRIBUTION_BANNED',
  'a skipped fixed event is logged as offscreen and is not replayed as a live scene');
assert.equal(skipped.world.v47.events.MAIN01_DISTRIBUTION_BAN.historicalOutcomeFixed, true);
assert.deepEqual(skipped.world.v47.events.MAIN01_DISTRIBUTION_BAN.sourceIds, [],
  'the modern editorial ban-date source is not recorded as evidence read by the player');
assert.deepEqual(skipped.world.v47.events.MAIN01_DISTRIBUTION_BAN.provenanceSourceIds, ['V47-ALMANAC-CENSORSHIP-EDITORIAL'],
  'the fixed historical ban keeps its internal research provenance');
const permissionAftermath = advanceV47World({ world: { date: '1848-03-10', clockMinutes: 540 }, hosts: {}, quests: {}, ledger: [] },
  { date: '1848-03-10', clockMinutes: 540 });
assert.deepEqual(permissionAftermath.world.v47.events.MAIN01_PERMISSION.sourceIds, [],
  'the modern editorial permission date is not recorded as player-read evidence');
assert.deepEqual(permissionAftermath.world.v47.events.MAIN01_PERMISSION.provenanceSourceIds,
  ['V47-NEKRASOV-ALMANAC-CONTENTS-1848', 'V47-ALMANAC-CENSORSHIP-EDITORIAL'],
  'the permission date retains the original almanac and editorial source trail internally');
assert.equal(skipped.world.v47.events.MAIN01_SUBSCRIBER_REPLY, undefined, 'future documents stay unavailable before their date');
assert.equal(skipped.world.v47.cholera.status, 'DORMANT', 'a missed fictional cholera scene does not activate disease months later');
const arrestAnchor = WORLD_EVENT_ANCHORS.find(row => row.id === 'MAIN03_PETRASHEVSKY_ARREST');
assert.equal(arrestAnchor.calendarSystem, 'JULIAN', 'the Russian event date records its historical calendar');
assert.equal(arrestAnchor.convertedGregorianDate, '1849-05-05', 'the date conversion is explicit in provenance');
assert.deepEqual(arrestAnchor.sourceIds, ['OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849'],
  'the arrest scene exposes only the contemporaneous order already available by that date');
assert.deepEqual(arrestAnchor.provenanceSourceIds, ['OBJ-WS-PETRASHEVSKY-REPORT-1849', 'OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849'],
  'the later state report remains attached as internal historical provenance');

const [mapNames, hostNames] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
]);
const [sourcePackets, sourceIndex, sourceRegister] = await Promise.all([
  readJson(new URL('../rpg/data/historical-source-packets.json', import.meta.url)),
  readJson(new URL('../rpg/data/source-reader-index.json', import.meta.url)),
  readJson(new URL('../rpg/data/source-register.json', import.meta.url)),
]);
const choleraDiaryId = 'V47-NIKITENKO-DIARY-1848-08-22';
const choleraDiary = sourcePackets.records.find(row => row.sourceId === choleraDiaryId);
assert.equal(choleraDiary.paragraphs.length, 3, 'the August diary passage retains contiguous surrounding context');
assert.ok(choleraDiary.paragraphs.every(paragraph => paragraph.ru && paragraph.ko), 'the verified Russian passage has aligned new Korean translation');
assert.equal(sourceIndex.records.find(row => row.sourceId === choleraDiaryId).documentDate, '1848-08-22',
  'the cholera diary does not become available before its entry date');
assert.ok(sourceRegister.sources.some(row => row.sourceId === choleraDiaryId && row.verificationStatus === 'CONTIGUOUS_PRIMARY_DIARY_TRANSCRIPTION_CHECKED'));
assert.ok(historicalAnchors.every(anchor => anchor.sourceIds.every(id => sourceRegister.sources.some(source => source.sourceId === id))),
  'every fixed event source ID resolves to a checked-in provenance record');
const panaevSourceId = 'V47-PANAEV-LETTER-1848-08-20';
const panaevIndex = sourceIndex.records.find(row => row.sourceId === panaevSourceId);
assert.equal(panaevIndex.accessibleToPlayerAt, '1848-09-01', 'Julian document date converts to the first Gregorian availability date');
assert.equal(sourceAvailableOn(panaevIndex, null, null, '1848-08-31'), false,
  'a Julian letter is not exposed by its unconverted date in the shared Gregorian world clock');
assert.equal(sourceAvailableOn(panaevIndex, null, null, '1848-09-01'), true,
  'the letter becomes available on its converted arrival date');
const manifestoIndex = sourceIndex.records.find(row => row.sourceId === 'OBJ-NICHOLAS-MANIFESTO-1848');
assert.equal(sourceAvailableOn(manifestoIndex, null, null, '1848-03-26'), false,
  'the manifesto is hidden before issue 59 could be read on the Gregorian world clock');
assert.equal(sourceAvailableOn(manifestoIndex, null, null, '1848-03-27'), true,
  'the manifesto becomes available on the Gregorian publication date of issue 59');
const executionLetterIndex = sourceIndex.records.find(row => row.sourceId === 'OBJ-WS-DOSTOEVSKY-LETTER-1849-DEC22');
assert.equal(sourceAvailableOn(executionLetterIndex, null, null, '1850-01-02'), false,
  'the December Julian letter is hidden until it could reach the player');
assert.equal(sourceAvailableOn(executionLetterIndex, null, null, '1850-01-03'), true,
  'the letter becomes readable at the recorded January Gregorian arrival date');
assert.deepEqual(sourceIndex.records.filter(row => /julian/i.test(row.documentDate ?? '') && !row.accessibleToPlayerAt).map(row => row.sourceId), [],
  'every reader source with a Julian document date has an explicit Gregorian player access date');
assert.equal(sourceAvailableOn({ documentDate: '1849' }, null, null, '1849-04-23'), false,
  'a year-only future dossier stays hidden until its year has passed');
assert.equal(sourceAvailableOn({ documentDate: '1849' }, null, null, '1850-01-01'), true,
  'a year-only document becomes available after its date uncertainty ends');
const almanacContentsId = 'V47-NEKRASOV-ALMANAC-CONTENTS-1848';
assert.equal(sourceIndex.records.some(row => row.sourceId === 'V47-ALMANAC-CENSORSHIP-EDITORIAL'), false,
  'the 1997 editorial chronology note is not leaked into the 1848 in-world source reader');
const almanacContents = sourcePackets.records.find(row => row.sourceId === almanacContentsId);
assert.ok(almanacContents?.paragraphs.length >= 2, 'the almanac itself has a contiguous publication notice and contents excerpt');
assert.ok(almanacContents.paragraphs.every(paragraph => paragraph.ru && paragraph.ko),
  'the contemporary almanac text and new Korean translation remain paragraph aligned');
const almanacReaderIndex = sourceIndex.records.find(row => row.sourceId === almanacContentsId);
assert.equal(almanacReaderIndex.accessibleToPlayerAt, '1848-02-12');
assert.match(almanacReaderIndex.publicationDate, /소브레멘니크.*제7권 제2호.*1월 31일.*잡지 호.*연감 허가일은 아닙니다/,
  '31 January is explicitly identified as the journal issue permission, not the almanac permission');
assert.equal(sourceAvailableOn(sourceIndex.records.find(row => row.sourceId === almanacContentsId), null, null, '1848-02-11'), false);
assert.equal(sourceAvailableOn(sourceIndex.records.find(row => row.sourceId === almanacContentsId), null, null, '1848-02-12'), true);
const subscriberLetter = sourcePackets.records.find(row => row.sourceId === 'V47-NEKRASOV-SUBSCRIBER-LETTER-1848');
assert.equal(subscriberLetter.paragraphs.length, 5, 'the subscriber letter preserves its full contiguous context and signatures');
assert.ok(subscriberLetter.paragraphs.every(paragraph => paragraph.ru && paragraph.ko), 'the complete letter has aligned Russian and new Korean text');
assert.equal(sourceIndex.records.find(row => row.sourceId === 'V47-NEKRASOV-SUBSCRIBER-LETTER-1848').accessibleToPlayerAt, '1848-11-29');
const sourceAccess = id => sourceAvailableOn(sourceIndex.records.find(row => row.sourceId === id), null, null, '1849-04-23');
assert.equal(sourceAccess('OBJ-WS-PETRASHEVSKY-REPORT-1849'), false,
  'the retrospective state report is not available during the arrest scene');
const arrestQuest = v47StoryQuests.find(quest => quest.id === 'V47_MAIN03_ARRESTS');
assert.deepEqual(arrestQuest.sourceIds, ['OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849'],
  'the physical arrest quest does not offer the later report as a readable source');
assert.equal(sourceAvailableOn(sourceIndex.records.find(row => row.sourceId === arrestQuest.sourceIds[0]), null, null, arrestQuest.date), true,
  'the arrest order is available by the date of the arrest scene');
const mayFollowupBeat = v47StoryBeats.find(row => row.id === 'V47_MAIN03_P10');
assert.deepEqual(mayFollowupBeat.sourceIds, [], 'the May fictional follow-up does not present the retrospective state report');
assert.doesNotMatch(mayFollowupBeat.titleKo, /안토넬리|보고서/,
  'the May scene title does not claim the player is reading Antonelli’s later report');
assert.match(mayFollowupBeat.sourceContextKo, /현장 메모와.*보고를 따로/,
  'the May follow-up presents its immediate in-world task without an out-of-scene disclaimer');
assert.doesNotMatch(mayFollowupBeat.sourceContextKo, /허구|창작|실제|열람할 수 없다/,
  'the May scene avoids player-facing meta text about historical-document provenance');
assert.equal(sourceAvailableOn(sourceIndex.records.find(row => row.sourceId === 'OBJ-WS-PETRASHEVSKY-REPORT-1849'), null, null, mayFollowupBeat.date), false,
  'the December retrospective report remains unavailable during the May follow-up');
const main03Beats = storyBeatQuests.filter(quest => quest.storyId === 'MAIN03');
for (const beat of main03Beats) for (const sourceId of beat.sourceIds) {
  const source = sourceIndex.records.find(row => row.sourceId === sourceId);
  assert.ok(source, `${beat.id} resolves its player-facing source ${sourceId}`);
  assert.equal(sourceAvailableOn(source, null, null, beat.date), true,
    `${beat.id} cannot expose ${sourceId} before the document is available`);
}
const main03Coda = main03Beats.find(quest => quest.id === 'V47_MAIN03_P11');
assert.ok(main03Coda.sourceIds.includes('OBJ-WS-DOSTOEVSKY-LETTER-1849-DEC22'),
  'the December letter is linked to the post-execution coda where it can be read');
const datedSourceAccess = (id, date) => sourceAvailableOn(sourceIndex.records.find(row => row.sourceId === id), null, null, date);
for (const beat of v47StoryBeats.filter(row => row.storyId === 'MAIN01')) {
  for (const sourceId of beat.sourceIds) {
    const source = sourceIndex.records.find(row => row.sourceId === sourceId);
    assert.ok(source, `${beat.id} source ${sourceId} resolves in the reader index`);
    assert.equal(sourceAvailableOn(source, null, null, beat.date), true,
      `${beat.id} cannot expose ${sourceId} before it reaches the player (${beat.date})`);
  }
}
const a10 = v47StoryBeats.find(row => row.id === 'V47_MAIN01_A10');
assert.equal(a10.date, '1848-12-06', 'the November 24 Julian book scene is dated correctly on the Gregorian game clock');
assert.deepEqual(a10.sourceIds, [], 'the bookshop scene leaves the subscriber letter for the following printshop scene');
assert.match(a10.sourceContextKo, /이 장면에서 다루지 않고 다음 인쇄소 장면에서 확인한다/);
assert.equal(datedSourceAccess('OBJ-BELINSKY-LETTER-GOGOL-1847', '1849-04-26'), false,
  'the private letter appears only when the documented meeting copy is available');
assert.equal(datedSourceAccess('OBJ-BELINSKY-LETTER-GOGOL-1847', '1849-04-27'), true);
assert.equal(datedSourceAccess('OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849', '1849-05-03'), false);
assert.equal(datedSourceAccess('OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849', '1849-05-04'), true);
const crawfordId = 'V47-CRAWFORD-CHO-OBS-1848';
const crawfordPacket = sourcePackets.records.find(row => row.sourceId === crawfordId);
const crawfordIndex = sourceIndex.records.find(row => row.sourceId === crawfordId);
assert.ok(crawfordPacket?.paragraphs.length >= 2 && crawfordPacket.paragraphs.every(row => row.originalText && row.ko),
  'the 1848 cholera report has aligned original English and project Korean paragraphs');
assert.equal(crawfordIndex.originalLanguage, 'en');
assert.equal(sourceAvailableOn(crawfordIndex, null, null, '1848-12-31'), false,
  'the British report does not appear before its publication and conservative in-game availability boundary');
assert.equal(sourceAvailableOn(crawfordIndex, null, null, '1849-01-01'), true);
assert.ok(sourceRegister.sources.some(row => row.sourceId === crawfordId
  && row.verificationStatus.includes('PAGE_IMAGE_VISUAL_COLLATION_PENDING')));
const nikitenkoId = 'V47-NIKITENKO-DIARY-1848-08-22';
const nikitenkoIndex = sourceIndex.records.find(row => row.sourceId === nikitenkoId);
assert.equal(sourceAvailableOn(nikitenkoIndex, null, null, '1848-08-22'), false,
  'the private diary stays unavailable until its first serial publication');
assert.equal(sourceAvailableOn(nikitenkoIndex, null, null, '1889-01-01'), true);
const [maps, hostCards] = await Promise.all([
  Promise.all(mapNames.filter(name => name.endsWith('.json')).map(name => readJson(new URL(`../rpg/maps/${name}`, import.meta.url))))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(hostNames.filter(name => name.endsWith('.json')).map(name => readJson(new URL(`../rpg/characters/${name}`, import.meta.url)))),
]);
for (const [hostId, actionId] of [['panaev_1848','V47_A03_PANAEV_CATALOGUE_NOTE'],['panaeva_1848','V47_A03_PANAEVA_READING_NOTE']]) {
  const personalGoal = hostCards.find(card => card.id === hostId)?.persistentPersonalGoals?.[0];
  assert.equal(personalGoal?.successCondition?.questId, almanacA03.id, `${hostId} has an individual MAIN01 objective tied to A03`);
  assert.equal(personalGoal?.successCondition?.actionId, actionId, `${hostId} has a character-specific action`);
  assert.ok(almanacA03.actions.some(action => action.id === actionId && action.hostIds.length === 1 && action.hostIds[0] === hostId),
    `${hostId} alone can complete the corresponding personal action`);
}
const sofiyaGoal = hostCards.find(card => card.id === 'sofiya_salon_1848')?.persistentPersonalGoals?.[0];
assert.equal(sofiyaGoal?.successCondition?.questId, 'V47_MAIN01_A10', 'Sofiya has an individual A10 objective');
assert.ok(['V47_A10_HOST_READING','V47_A10_STORE_COPY'].every(actionId => sofiyaGoal.successCondition.actionIds.includes(actionId)),
  'Sofiya can conclude her objective through either documented in-game disposition');
attachV47StoryObjects(maps);
attachV47StoryBeatObjects(maps, storyBeatQuests);
const talnikovPhysicalBook = maps.printshop.layers.find(layer => layer.name === 'Interactions').objects.find(object => object.id === 4010);
const talnikovA03Quest = maps.printshop.layers.find(layer => layer.name === 'Interactions').objects.find(object => object.id === 9062);
assert.ok(Math.abs(talnikovPhysicalBook.x / 16 - talnikovA03Quest.x / 16)
  + Math.abs(talnikovPhysicalBook.y / 16 - talnikovA03Quest.y / 16) <= 1,
'the MAIN01 reading and choice objects are adjacent, so reading can immediately open an in-reach choice');
assert.ok(maps['inn-interior']?.layers?.some(layer => layer.objects?.some(object => object.id === 9052)),
  'the first cholera scene has a physical entry point inside the inn');
const reachableFromArrival = (mapId, target) => {
  const map = maps[mapId], collision = map.layers.find(layer => layer.name === 'Collision')?.data ?? [];
  const walkable = (x, y) => x >= 0 && y >= 0 && x < map.width && y < map.height
    && collision[y * map.width + x] === 0;
  const starts = [];
  if (map.metadata.observerStart && walkable(map.metadata.observerStart.x, map.metadata.observerStart.y)) starts.push(map.metadata.observerStart);
  for (const incoming of Object.values(maps).flatMap(source => source.layers.flatMap(layer => layer.objects ?? []))
    .filter(object => object.type === 'map-exit')) {
    const properties = Object.fromEntries((incoming.properties ?? []).map(property => [property.name, property.value]));
    if (properties.targetMapId !== mapId) continue;
    const x = Number(properties.arrivalX), y = Number(properties.arrivalY);
    for (const [dx, dy] of [[0,0],[0,-1],[1,0],[0,1],[-1,0]]) if (walkable(x + dx, y + dy)) starts.push({ x: x + dx, y: y + dy });
  }
  const seen = new Set(starts.map(point => `${point.x},${point.y}`)), queue = [...starts];
  while (queue.length) {
    const point = queue.shift();
    for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const x = point.x + dx, y = point.y + dy, key = `${x},${y}`;
      if (!walkable(x, y) || seen.has(key)) continue;
      seen.add(key); queue.push({ x, y });
    }
  }
  const tile = { x: Math.floor(target.x / map.tilewidth), y: Math.floor(target.y / map.tileheight) };
  return [...seen].some(key => { const [x, y] = key.split(',').map(Number); return Math.abs(x - tile.x) + Math.abs(y - tile.y) <= 1; });
};
for (const quest of allV47StoryQuests) {
  const physical = maps[quest.entry.mapId].layers.find(layer => layer.name === 'Interactions').objects
    .find(object => object.id === quest.entry.objectId);
  assert.ok(physical, `${quest.id} has a physical interaction`);
  assert.ok(reachableFromArrival(quest.entry.mapId, physical),
    `${quest.id} interaction is reachable on foot from a real map arrival`);
}
let integrated = game.createInitialState({ maps, hostCards, quests: allV47StoryQuests, startMapId: 'nevsky' });
assert.ok(integrated.hosts.clerk_alexei.eraProfile.allowedChapterIds.includes('V33_1849_PRELUDE'),
  'fictional residents can be possessed in the dedicated 1849 buildup chapter');
const preludePossession = game.createInitialState({ maps, hostCards, quests: allV47StoryQuests, startMapId: 'chancery' });
preludePossession.world.chapterId = 'V33_1849_PRELUDE';
preludePossession.player.embodiment = null;
preludePossession.hosts.clerk_alexei.mapId = 'chancery';
const clerkTile = maps.chancery.layers.find(layer => layer.name === 'NPCs').objects.find(object =>
  object.properties?.find(property => property.name === 'hostId')?.value === 'clerk_alexei');
preludePossession.hosts.clerk_alexei.position = { x: Math.floor(clerkTile.x / 16), y: Math.floor(clerkTile.y / 16) };
preludePossession.player.position = { ...preludePossession.hosts.clerk_alexei.position };
assert.equal(game.possessHost(preludePossession, 'clerk_alexei', maps.chancery).ok, true,
  'the chapter-specific possession gate accepts a living 1840s resident during the 1849 buildup');
assert.equal(v47StoryQuests.length + storyBeatQuests.length, 36, 'all 36 scenario beats become runtime quests');
assert.ok(v47StoryBeatIds.MAIN01.length === 12 && v47StoryBeatIds.MAIN03.length === 12 && v47StoryBeatIds.MAIN05.length === 12,
  'the three stories each have twelve dated beats');
assert.ok(allV47StoryQuests.every(quest => quest.actions.every(action => action.hostIds.every(id => integrated.hosts[id]))),
  'all V47 action roles resolve to in-game residents');
for (const [questId, leadId] of [['V47_MAIN03_P05', 'dostoevsky_1849'], ['V47_MAIN05_C05', 'doctor_mikhail_1848']]) {
  const quest = allV47StoryQuests.find(item => item.id === questId);
  assert.ok(quest.metadata.playerHosts.includes(leadId), `${questId} keeps the screenplay's designated lead in the scene roster`);
  assert.ok(quest.actions.every(action => action.hostIds.includes(leadId)), `${questId} lets its designated lead take each authored branch`);
}

for (const actionId of ['V47_P04_CARRY_INVITATION', 'V47_P04_RETURN_INVITATION']) {
  const scene = storyBeatQuests.find(quest => quest.id === 'V47_MAIN03_P04');
  const state = game.createInitialState({ maps, hostCards, quests: allV47StoryQuests, startMapId: scene.entry.mapId });
  const hostId = 'student_vasily', target = maps[scene.entry.mapId].layers.find(layer => layer.name === 'Interactions').objects
    .find(object => object.id === scene.entry.objectId);
  const x = Math.floor(target.x / 16), y = Math.floor(target.y / 16);
  state.world.chapterId = scene.chapterId; state.world.date = scene.date; state.world.currentMapId = scene.entry.mapId;
  state.player.embodiment = hostId; state.player.position = { x: x - 1, y };
  state.hosts[hostId].mapId = scene.entry.mapId; state.hosts[hostId].position = { x: x - 1, y };
  state.quests[scene.id] = { status: 'open', result: null };
  const selected = game.performQuestAction(state, { questId: scene.id, hostId, actionId, objectId: scene.entry.objectId },
    { quests: allV47StoryQuests, maps });
  assert.equal(selected.ok, true, `${actionId} remains actionable without requiring spare character money or pre-seeded invitation inventory`);
}
{
  const scene = storyBeatQuests.find(quest => quest.id === 'V47_MAIN03_P03');
  const target = maps[scene.entry.mapId].layers.find(layer => layer.name === 'Interactions').objects
    .find(object => object.id === scene.entry.objectId);
  for (const action of scene.actions) {
    const state = game.createInitialState({ maps, hostCards, quests: allV47StoryQuests, startMapId: scene.entry.mapId });
    const hostId = action.hostIds[0], x = Math.floor(target.x / 16), y = Math.floor(target.y / 16);
    state.world.chapterId = scene.chapterId; state.world.date = scene.date; state.world.currentMapId = scene.entry.mapId;
    state.player.embodiment = hostId; state.player.position = { x: x - 1, y };
    state.hosts[hostId].mapId = scene.entry.mapId; state.hosts[hostId].position = { x: x - 1, y };
    state.hosts.student_vasily.money.amount = 0;
    state.quests[scene.id] = { status: 'open', result: null };
    const selected = game.performQuestAction(state, { questId: scene.id, hostId, actionId: action.id, objectId: scene.entry.objectId },
      { quests: allV47StoryQuests, maps });
    assert.equal(selected.ok, true, `${action.id} resolves even when the student's purse is empty`);
  }
}
const campaign = await readJson(new URL('../rpg/quests/campaign.json', import.meta.url));
for (const quest of allV47StoryQuests) {
  const arc = campaign.arcs.find(item => item.id === quest.chapterId);
  assert.ok(arc?.questIds.includes(quest.id) || arc?.optionalQuestIds?.includes(quest.id), `${quest.id} must appear on its chapter route`);
}
for (const arc of campaign.arcs.filter(item => item.id.startsWith('V33_1848') || item.id.startsWith('V33_1849'))) {
  const authoredDates = arc.questIds.map(id => allV47StoryQuests.find(quest => quest.id === id)?.date).filter(Boolean);
  assert.deepEqual(authoredDates, [...authoredDates].sort(), `${arc.id} V47 beats follow the shared chronological route`);
}
assert.ok(campaign.arcs.find(arc => arc.id === 'V33_1848_PUBLIC').questIds.includes('V47_MAIN05_MARKET_RESPONSE'));
assert.ok(campaign.arcs.find(arc => arc.id === 'V33_1849_PRELUDE').questIds.includes('V47_MAIN03_P04'));
assert.ok(campaign.arcs.find(arc => arc.id === 'V33_1849_PRELUDE').questIds.includes('V47_MAIN03_P07'));
assert.equal(storyBeatQuests.find(quest => quest.id === 'V47_MAIN03_P04').chapterId, 'V33_1849_PRELUDE',
  'March and April 1849 buildup is playable before the arrest chapter begins');
assert.ok(campaign.arcs.find(arc => arc.id === 'V33_1849_CIRCLE').questIds.includes('V47_MAIN03_ARRESTS'));
const circleArc = { id: 'V33_1849_CIRCLE', questIds: ['E41_SEMENOVSKY_1849'], optionalQuestIds: ['V47_MAIN03_P11'] };
assert.ok(campaign.arcs.find(arc => arc.id === 'V33_1849_CIRCLE').optionalQuestIds?.includes('V47_MAIN03_P11'));
assert.ok(storyBeatQuests.find(quest => quest.id === 'V47_MAIN03_P11').prerequisiteQuestIds.includes('E41_SEMENOVSKY_1849'));
const afterSquare = continuationQuest({ world: { chapterId: circleArc.id, date: '1849-12-22' }, quests: {
  E41_SEMENOVSKY_1849: { status: 'resolved' }, V47_MAIN03_P11: { status: 'open' },
} }, { arcs: [circleArc] }, [
  { id: 'E41_SEMENOVSKY_1849', date: '1849-12-22' },
  { id: 'V47_MAIN03_P11', date: '1849-12-22', prerequisiteQuestIds: ['E41_SEMENOVSKY_1849'] },
]);
assert.equal(afterSquare?.id, 'V47_MAIN03_P11', 'the fictional family coda follows the fixed December 22 event without replacing it');
const codaAdvance = game.advanceCampaignDate({ world: { chapterId: circleArc.id, date: '1849-12-22', activeRealm: null, clockMinutes: 600 },
  quests: { E41_SEMENOVSKY_1849: { status: 'resolved' }, V47_MAIN03_P11: { status: 'open' } }, hosts: {}, ledger: [] },
  '1850-01-03', { arcs: [circleArc] }, [{ id: 'V47_MAIN03_P11', date: '1850-01-03', chapterId: circleArc.id }]);
assert.equal(codaAdvance.ok, true, 'campaign date progression includes an unlocked optional V47 coda after required events');
assert.equal(codaAdvance.state.world.date, '1850-01-03', 'the optional coda opens on its authored date without advancing to another chapter');
const firstPreludeQuest = storyBeatQuests.find(quest => quest.id === 'V47_MAIN03_P04');
const firstPreludeDateAdvance = game.advanceCampaignDate({ world: { chapterId: 'V33_1849_PRELUDE', date: '1849-03-20', activeRealm: null, clockMinutes: 600 },
  quests: { V47_MAIN03_P04: { status: 'open' } }, hosts: {}, ledger: [] }, '1849-04-01',
  { arcs: [{ id: 'V33_1849_PRELUDE', questIds: ['V47_MAIN03_P04'] }] }, [firstPreludeQuest]);
assert.equal(firstPreludeDateAdvance.ok, true, 'the first dated beat of a chapter can advance from its chapter start date');
assert.equal(continuationQuest({ world: { chapterId: 'V33_1849_PRELUDE', date: '1849-03-20' }, quests: {
  V47_MAIN03_P04: { status: 'open' },
} }, { arcs: [{ id: 'V33_1849_PRELUDE', questIds: ['V47_MAIN03_P04'] }] }, [firstPreludeQuest])?.id,
'V47_MAIN03_P04', 'the first future-dated beat appears as the chapter continuation before any earlier record exists');
assert.ok(WORLD_EVENT_ANCHORS.length >= 1);
assert.ok(WORLD_EVENT_ANCHORS.every(anchor => Array.isArray(anchor.sourceIds) && Array.isArray(anchor.sourceRefs)));
const main03Guide = v47Runtime.STORY_GUIDANCE.MAIN03;
assert.ok(main03Guide.roles.length >= 8 && main03Guide.roles.length <= 10,
  'MAIN03 provides at least eight playable character roles');
assert.ok(!campaign.arcs.find(arc => arc.id === 'V33_1848_PUBLIC').sources.includes(choleraDiaryId));
assert.ok(campaign.arcs.find(arc => arc.id === 'V33_1848_PUBLIC').sources.includes(crawfordId));
assert.ok(campaign.arcs.find(arc => arc.id === 'V33_1848_PUBLIC').sources.includes('V47-PANAEV-LETTER-1848-08-20'));
assert.ok(campaign.arcs.find(arc => arc.id === 'V33_1848_PUBLIC').sources.includes(almanacContentsId));
assert.ok(!campaign.arcs.find(arc => arc.id === 'V33_1848_PUBLIC').sources.includes(nikitenkoId),
  'a private diary is not presented as an 1848 in-world document');
assert.deepEqual(storyBeatQuests.find(quest => quest.id === 'V47_MAIN05_C10').sourceIds, [],
  'the August 1848 scene does not expose a source unavailable to its characters');
assert.ok(storyBeatQuests.find(quest => quest.id === 'V47_MAIN01_A01').sourceIds.includes(almanacContentsId),
  'the announced contents source is attached to the actual printing beat');
assert.ok(['printshop', 'bookshop-interior', 'police-station', 'market-quay', 'inn-interior'].every(mapId =>
  maps[mapId].layers.some(layer => layer.objects?.some(object => object.type === 'quest-object'
    && allV47StoryQuests.some(quest => quest.id === object.properties?.find(property => property.name === 'questId')?.value)))),
  'story events exist as physical map interactions');
for (const map of Object.values(maps)) for (const object of map.layers.flatMap(layer => layer.objects ?? [])
  .filter(item => item.type === 'quest-object' && allV47StoryQuests.some(quest => quest.id === item.properties?.find(p => p.name === 'questId')?.value))) {
  assert.ok(object.x >= 0 && object.y >= 0 && object.x + object.width <= map.width * map.tilewidth
    && object.y + object.height <= map.height * map.tileheight, `V47 object ${object.id} is reachable inside ${map.mapId}`);
  assert.ok([[Math.floor(object.x / map.tilewidth) - 1, Math.floor(object.y / map.tileheight)],
    [Math.floor(object.x / map.tilewidth) + 1, Math.floor(object.y / map.tileheight)],
    [Math.floor(object.x / map.tilewidth), Math.floor(object.y / map.tileheight) - 1],
    [Math.floor(object.x / map.tilewidth), Math.floor(object.y / map.tileheight) + 1]]
    .some(([x, y]) => game.canOccupy(map, x, y)), `V47 object ${object.id} has an adjacent walkable tile in ${map.mapId}`);
  const tile = { x: Math.floor(object.x / map.tilewidth), y: Math.floor(object.y / map.tileheight) };
  for (const other of map.layers.flatMap(layer => layer.objects ?? []).filter(item => item.id !== object.id)) {
    const otherTile = { x: Math.floor(other.x / map.tilewidth), y: Math.floor(other.y / map.tileheight) };
    const linkedMain01Source = object.id === 9062 && other.id === 4010;
    assert.ok(linkedMain01Source || Math.abs(tile.x - otherTile.x) + Math.abs(tile.y - otherTile.y) > 2,
      `V47 object ${object.id} is separated from ${other.id} on ${map.mapId}`);
  }
}
const earlyBeatObject = maps['bookshop-interior'].layers.find(layer => layer.name === 'Interactions').objects.find(object => object.id === 9060);
let availabilityState = game.createInitialState({ maps, hostCards, quests: allV47StoryQuests, startMapId: 'bookshop-interior' });
availabilityState.world.date = '1847-06-01'; availabilityState.world.chapterId = 'V33_1848_PUBLIC';
availabilityState.player.embodiment = 'bookseller_lev'; availabilityState.hosts.bookseller_lev.mapId = 'bookshop-interior';
assert.equal(objectIsPresent(earlyBeatObject, availabilityState, allV47StoryQuests, maps['bookshop-interior']), false,
  'future story props remain hidden before their authored date');
availabilityState.world.date = '1848-02-12';
assert.equal(objectIsPresent(earlyBeatObject, availabilityState, allV47StoryQuests, maps['bookshop-interior']), true,
  'the subscriber opening appears when the shared world clock reaches the contemporary notice date');
integrated.world.chapterId = 'V33_1848_PUBLIC'; integrated.world.date = '1848-06-14';
integrated = game.advanceNpcWorld(integrated, 1, maps, { pausedHostIds: Object.keys(integrated.hosts) });
assert.equal(integrated.world.v47.cholera.status, 'ACTIVE', 'the V47 calendar is connected to the game simulation');
assert.equal(integrated.world.v47.cholera.hosts.tenant_mikhail.state, 'E', 'an initial fictional case starts the city model');
const intervention = applyCholeraIntervention(integrated, { actionId: 'DRINK_CONTAMINATED_WATER', hostId: 'watercarrier_luka', targetHostId: 'seamstress_anna' });
assert.equal(intervention.ok, true);
const saved = game.saveGame(intervention.state);
const restored = game.loadGame(saved, { maps, hostCards, quests: [] });
assert.equal(restored.world.v47.cholera.hosts.seamstress_anna.state, 'E', 'exposure survives actual V37 save/load validation');
integrated = advanceV47World(intervention.state, { date: '1848-06-14', clockMinutes: 540 + 2 * 1440 });
integrated.world.clockMinutes = 540 + 2 * 1440;
assert.equal(integrated.world.v47.cholera.hosts.seamstress_anna.state, 'I');
const care = applyCholeraIntervention(integrated, { actionId: 'CARE_PATIENT', hostId: 'midwife_avdotya', targetHostId: 'tenant_mikhail' });
assert.equal(care.ok, true);
const careSave = game.saveGame(care.state);
const careRestored = game.loadGame(careSave, { maps, hostCards, quests: [] });
assert.equal(careRestored.hosts.tenant_mikhail.healthState.condition, 'UNWELL',
  'illness and care persist through the real save loader');
let auditedBeatActions = 0;
const invalidStoryMoves = allV47StoryQuests.flatMap(quest => quest.actions.flatMap(action =>
  (action.effects?.v47WorldChange?.moves ?? []).flatMap(move => {
    const allowed = hostCards.find(card => card.id === move.hostId)?.allowedMaps.includes(move.mapId);
    const walkable = game.canOccupy(maps[move.mapId], move.x, move.y);
    return allowed && walkable ? [] : [{ questId: quest.id, actionId: action.id, hostId: move.hostId,
      mapId: move.mapId, x: move.x, y: move.y, allowed, walkable }];
  })));
assert.deepEqual(invalidStoryMoves, [], 'all authored V47 moves use an allowed map and walkable tile');
for (const quest of storyBeatQuests) for (const action of quest.actions) {
  const hostId = action.hostIds[0], map = maps[quest.entry.mapId];
  const object = map.layers.flatMap(layer => layer.objects ?? []).find(item => item.id === quest.entry.objectId);
  const objectTile = { x: Math.floor(object.x / map.tilewidth), y: Math.floor(object.y / map.tileheight) };
  const adjacent = [[objectTile.x - 1, objectTile.y], [objectTile.x + 1, objectTile.y],
    [objectTile.x, objectTile.y - 1], [objectTile.x, objectTile.y + 1]].find(([x, y]) => game.canOccupy(map, x, y));
  assert.ok(adjacent, `${quest.id} has a reachable action position`);
  let actionState = game.createInitialState({ maps, hostCards, quests: allV47StoryQuests, startMapId: map.mapId });
  for (const prerequisiteId of quest.prerequisiteQuestIds ?? []) {
    actionState.quests[prerequisiteId] ??= { status: 'resolved' };
    actionState.quests[prerequisiteId].status = 'resolved';
  }
  actionState.world.chapterId = quest.chapterId;
  actionState.world.date = quest.date;
  actionState.world.currentMapId = map.mapId;
  for (const card of hostCards) {
    const host = actionState.hosts[card.id];
    if (host?.presenceWindow) host.historicalAliveAndPresent = card.presenceWindow.startDate <= quest.date
      && quest.date <= card.presenceWindow.endDate;
  }
  actionState.player.embodiment = hostId;
  actionState.player.position = { x: adjacent[0], y: adjacent[1] };
  actionState.hosts[hostId].mapId = map.mapId;
  actionState.hosts[hostId].position = { ...actionState.player.position };
  if (action.requiredKnowledgeId) {
    const read = game.recordSourceRead(actionState, action.requiredKnowledgeId, maps);
    assert.equal(read.ok, true, `${quest.id}/${action.id} source prerequisite is physically readable first`);
    actionState = read.state;
  }
  const applied = game.performQuestAction(actionState, { questId: quest.id, hostId,
    actionId: action.id, objectId: object.id }, { quests: allV47StoryQuests, maps });
  assert.equal(applied.ok, true, `${quest.id}/${action.id} must execute through the production reducer: ${applied.reason}`);
  assert.ok(applied.state.ledger.some(row => row.questId === quest.id && row.actionId === action.id
    && row.effectsApplied?.v47WorldChange), `${quest.id}/${action.id} must persist its world effects`);
  const personalGoal = applied.state.hosts[hostId].personalGoals?.find(goal => goal.successCondition?.questId === quest.id
    && (goal.successCondition.actionId === action.id || goal.successCondition.actionIds?.includes(action.id)));
  if (personalGoal) assert.equal(applied.state.hosts[hostId].personalGoalProgress[personalGoal.id]?.status, 'SATISFIED',
    `${hostId}'s personal story objective completes through its real action`);
  assert.equal(applied.state.hosts[hostId].mapId, applied.state.world.currentMapId,
    `${quest.id}/${action.id} keeps the possessed actor in the active map`);
  let restoredAction;
  try { restoredAction = game.loadGame(game.saveGame(applied.state), { maps, hostCards, quests: allV47StoryQuests }); }
  catch (error) {
    const invalidHostMaps = hostCards.filter(card => !card.allowedMaps.includes(applied.state.hosts[card.id].mapId))
      .map(card => `${card.id}:${applied.state.hosts[card.id].mapId}`);
    throw new Error(`${quest.id}/${action.id} save-load failed: ${error.message}; host maps=${invalidHostMaps.join(',')}`, { cause: error });
  }
  assert.ok(restoredAction.world.v47.worldChanges.some(row => row.questId === quest.id && row.actionId === action.id),
    `${quest.id}/${action.id} material changes survive the production save loader`);
  for (const edge of action.effects.v47WorldChange.relationships ?? []) {
    assert.equal(restoredAction.world.v47.relationships[`${edge.fromHostId}::${edge.toHostId}`]?.trust, edge.trustDelta,
      `${quest.id}/${action.id} preserves directed relationship change without fabricating a meeting`);
  }
  auditedBeatActions += 1;
}
assert.equal(auditedBeatActions, storyBeatQuests.reduce((count, quest) => count + quest.actions.length, 0), 'every additional story choice was exercised');
const doctorCareQuest = storyBeatQuests.find(quest => quest.id === 'V47_MAIN05_C05');
const doctorCareAction = doctorCareQuest.actions.find(action => action.id === 'V47_C05_OPEN_BEDS');
const doctorCareMap = maps[doctorCareQuest.entry.mapId];
const doctorCareObject = doctorCareMap.layers.flatMap(layer => layer.objects ?? []).find(item => item.id === doctorCareQuest.entry.objectId);
const doctorCareTile = { x: Math.floor(doctorCareObject.x / 16), y: Math.floor(doctorCareObject.y / 16) };
const doctorCareAdjacent = [[doctorCareTile.x - 1, doctorCareTile.y], [doctorCareTile.x + 1, doctorCareTile.y],
  [doctorCareTile.x, doctorCareTile.y - 1], [doctorCareTile.x, doctorCareTile.y + 1]].find(([x, y]) => game.canOccupy(doctorCareMap, x, y));
const doctorCareState = game.createInitialState({ maps, hostCards, quests: allV47StoryQuests, startMapId: doctorCareMap.mapId });
doctorCareState.world.chapterId = doctorCareQuest.chapterId; doctorCareState.world.date = doctorCareQuest.date;
doctorCareState.world.currentMapId = doctorCareMap.mapId; doctorCareState.player.embodiment = 'doctor_mikhail_1848';
for (const card of hostCards) if (card.presenceWindow) doctorCareState.hosts[card.id].historicalAliveAndPresent =
  card.presenceWindow.startDate <= doctorCareQuest.date && doctorCareQuest.date <= card.presenceWindow.endDate;
doctorCareState.player.position = { x: doctorCareAdjacent[0], y: doctorCareAdjacent[1] };
doctorCareState.hosts.doctor_mikhail_1848.mapId = doctorCareMap.mapId;
doctorCareState.hosts.doctor_mikhail_1848.position = { ...doctorCareState.player.position };
doctorCareState.quests[doctorCareQuest.id] = { status: 'open' };
const doctorCareResult = game.performQuestAction(doctorCareState, { questId: doctorCareQuest.id,
  hostId: 'doctor_mikhail_1848', actionId: doctorCareAction.id, objectId: doctorCareObject.id }, { quests: allV47StoryQuests, maps });
assert.equal(doctorCareResult.ok, true, `the newly designated cholera physician host can perform the authored branch: ${doctorCareResult.reason}`);
let unattendedArrest = game.createInitialState({ maps, hostCards, quests: v47StoryQuests, startMapId: 'police-station' });
unattendedArrest.world.chapterId = 'V33_1849_CIRCLE';
for (const id of ['petrashevsky_1849', 'dostoevsky_1849']) unattendedArrest.hosts[id].historicalAliveAndPresent = true;
unattendedArrest = advanceV47World(unattendedArrest, { date: '1849-05-05', clockMinutes: 420 });
assert.equal(unattendedArrest.hosts.police_sergeant_ivan.v47Assignment.status, 'EN_ROUTE_TO_SEARCH');
assert.equal(unattendedArrest.hosts.student_vasily.v47Questioning.status, 'MOVING_WITH_SEARCH_TEAM');
assert.ok(unattendedArrest.world.v47.events.MAIN03_PETRASHEVSKY_ARREST.npcAutonomy.assignedHostIds.includes('police_sergeant_ivan'));
for (const id of ['petrashevsky_1849', 'dostoevsky_1849']) {
  assert.ok(unattendedArrest.world.v47.events.MAIN03_PETRASHEVSKY_ARREST.actorHostIds.includes(id),
    `${id} is staged as a named historical detainee in the arrest operation`);
  assert.ok(['TRANSFERRED_AFTER_FIXED_ARREST', 'ARRIVED_AFTER_FIXED_ARREST'].includes(unattendedArrest.hosts[id].v47Assignment.status),
    `${id}'s fixed arrest outcome is represented in the on-map operation`);
}
const arrestMovement = structuredClone(unattendedArrest);
arrestMovement.world.clockMinutes = 600;
const arrestActors = new Set(['police_sergeant_ivan', 'student_vasily', 'petrashevsky_1849', 'dostoevsky_1849']);
for (const host of Object.values(arrestMovement.hosts)) host.historicalAliveAndPresent = arrestActors.has(host.id);
arrestMovement.hosts.police_sergeant_ivan.mapId = 'police-station';
arrestMovement.hosts.student_vasily.mapId = 'courtyard';
arrestMovement.hosts.petrashevsky_1849.mapId = 'inn-interior';
arrestMovement.hosts.dostoevsky_1849.mapId = 'inn-interior';
const arrestRouteReplay = game.advanceNpcWorld(arrestMovement, 240, maps);
const arrestMoves = arrestRouteReplay.ledger.filter(row => row.eventType === 'NPC_SIMULATION').flatMap(row => row.moves);
for (const id of ['petrashevsky_1849', 'dostoevsky_1849']) assert.ok(arrestMoves.some(move => move.hostId === id),
  `${id} physically travels into the arrest scene rather than remaining a dialogue-only name`);
unattendedArrest = advanceV47World(unattendedArrest, { date: '1849-05-06', clockMinutes: 420 });
assert.equal(unattendedArrest.hosts.student_vasily.v47Questioning.status, 'MOVING_WITH_SEARCH_TEAM',
  'the date alone cannot release a character who has not physically reached the station');
assert.equal(unattendedArrest.hosts.student_vasily.v47Questioning.returnMapId, undefined);
let escapedArrest = game.createInitialState({ maps, hostCards, quests: v47StoryQuests, startMapId: 'police-station' });
for (const id of ['petrashevsky_1849', 'dostoevsky_1849']) escapedArrest.hosts[id].historicalAliveAndPresent = true;
escapedArrest.world.v47.stories.MAIN03.consequences.push({ actionId: 'V47_P07_WARN_FICTIONAL' });
escapedArrest = advanceV47World(escapedArrest, { date: '1849-05-05', clockMinutes: 420 });
assert.equal(escapedArrest.hosts.student_vasily.v47Questioning.status, 'ESCAPED_BEFORE_QUESTIONING');
assert.equal(escapedArrest.world.v47.events.MAIN03_PETRASHEVSKY_ARREST.npcAutonomy.branch,
  'WARNED_FICTIONAL_WITNESS; HISTORICAL_ARRESTS_FIXED');
assert.deepEqual(escapedArrest.world.v47.events.MAIN03_PETRASHEVSKY_ARREST.npcAutonomy.historicalDetaineeHostIds,
  ['petrashevsky_1849', 'dostoevsky_1849'], 'warning a fictional witness cannot erase the fixed historical arrests');
let wageChoice = game.createInitialState({ maps, hostCards, quests: v47StoryQuests, startMapId: 'printshop' });
wageChoice.world.chapterId = 'V33_1848_PUBLIC'; wageChoice.world.date = '1848-03-09';
wageChoice.world.currentMapId = 'printshop'; wageChoice.player.embodiment = 'editor_sofia';
const wageObject = maps.printshop.layers.flatMap(layer => layer.objects ?? []).find(object => object.id === 9047);
assert.equal(Object.fromEntries((wageObject.properties ?? []).map(property => [property.name, property.value])).v47PuzzleId,
  'MAIN01_PRINTWORK', 'the first MAIN01 station opens the screenplay printwork interaction');
const wageTile = { x: Math.floor(wageObject.x / maps.printshop.tilewidth), y: Math.floor(wageObject.y / maps.printshop.tileheight) };
const wageAdjacent = [[wageTile.x - 1, wageTile.y], [wageTile.x + 1, wageTile.y], [wageTile.x, wageTile.y - 1], [wageTile.x, wageTile.y + 1]]
  .find(([x, y]) => game.canOccupy(maps.printshop, x, y));
wageChoice.hosts.editor_sofia.mapId = 'printshop'; wageChoice.hosts.editor_sofia.position = { x: wageAdjacent[0], y: wageAdjacent[1] };
wageChoice.player.position = { ...wageChoice.hosts.editor_sofia.position };
const bypassedPrintwork = game.performQuestAction(wageChoice, { questId: 'V47_MAIN01_PERMISSION', hostId: 'editor_sofia',
  actionId: 'V47_A01_COLLATE_PROOFS', objectId: 9047 }, { quests: v47StoryQuests, maps });
assert.equal(bypassedPrintwork.ok, false, 'the story action cannot skip the physical printing task');
assert.equal(bypassedPrintwork.reason, 'printwork_incomplete');
const outdatedPrintworkSave = structuredClone(wageChoice);
outdatedPrintworkSave.world.v47.printwork = { step: 7, status: 'COMPLETE', sortedBundles: ['기존 저장의 낡은 체크리스트'] };
const outdatedBypass = game.performQuestAction(outdatedPrintworkSave, { questId: 'V47_MAIN01_PERMISSION', hostId: 'editor_sofia',
  actionId: 'V47_A01_COLLATE_PROOFS', objectId: 9047 }, { quests: v47StoryQuests, maps });
assert.equal(outdatedBypass.reason, 'printwork_incomplete', 'legacy quiz saves cannot bypass the V2 physical printwork flow');
const wagesBefore = wageChoice.hosts.print_apprentice_stepan.money.amount;
const editorCashBefore = wageChoice.hosts.editor_sofia.money.amount;
const paidWage = game.performQuestAction(wageChoice, { questId: 'V47_MAIN01_PERMISSION', hostId: 'editor_sofia',
  actionId: 'V47_A01_SECURE_WAGES', objectId: 9047 }, { quests: v47StoryQuests, maps });
assert.equal(paidWage.ok, true, 'the print deadline choice is executable at the real physical press object');
assert.equal(paidWage.state.hosts.print_apprentice_stepan.money.amount, wagesBefore + 2, 'wages transfer into a resident wallet');
assert.equal(paidWage.state.hosts.editor_sofia.money.amount, editorCashBefore - 2, 'the editor pays the wage from her own funds');
assert.ok(paidWage.state.ledger.some(row => row.questId === 'V47_MAIN01_PERMISSION'
  && row.effectsApplied?.v47WorldChange?.money?.length), 'the economic branch is recorded in the audit ledger');
let questPlay = game.createInitialState({ maps, hostCards, quests: v47StoryQuests, startMapId: 'inn-interior' });
questPlay.world.chapterId = 'V33_1848_PUBLIC'; questPlay.world.date = '1848-06-14';
questPlay = game.advanceNpcWorld(questPlay, 1, maps, { pausedHostIds: Object.keys(questPlay.hosts) });
questPlay.world.currentMapId = 'inn-interior'; questPlay.player.embodiment = 'watercarrier_luka';
const waterObject = maps['inn-interior'].layers.flatMap(layer => layer.objects ?? []).find(object => object.id === 9052);
const waterTile = { x: Math.floor(waterObject.x / maps['inn-interior'].tilewidth), y: Math.floor(waterObject.y / maps['inn-interior'].tileheight) };
const waterAdjacent = [[waterTile.x - 1, waterTile.y], [waterTile.x + 1, waterTile.y], [waterTile.x, waterTile.y - 1], [waterTile.x, waterTile.y + 1]]
  .find(([x, y]) => game.canOccupy(maps['inn-interior'], x, y));
questPlay.hosts.watercarrier_luka.mapId = 'inn-interior'; questPlay.hosts.watercarrier_luka.position = { x: waterAdjacent[0], y: waterAdjacent[1] };
questPlay.player.position = { ...questPlay.hosts.watercarrier_luka.position };
const worldAction = game.performQuestAction(questPlay, { questId: 'V47_MAIN05_WATER_NOTICE', hostId: 'watercarrier_luka',
  actionId: 'V47_C00_CLEAN_WATER', objectId: 9052 }, { quests: v47StoryQuests, maps });
assert.equal(worldAction.ok, true, 'a physical V47 quest action runs through the production reducer');
assert.equal(worldAction.state.world.v47.cholera.waterSources[worldAction.state.world.v47.cholera.hosts.watercarrier_luka.waterSourceId].risk, 0.3);
assert.equal(worldAction.state.world.v47.stories.MAIN05.consequences.at(-1).actionId, 'V47_C00_CLEAN_WATER');
assert.ok(worldAction.state.world.v47.rumors.some(row => row.id === 'V47_WATER_CASK_CLEANED'),
  'the intervention moves witnessed information into the social knowledge network');
assert.ok(worldAction.state.hosts.landlady_polina.v47KnownRumors.includes('V47_WATER_CASK_CLEANED'),
  'only the named witness receives the new rumor in their persisted knowledge');

let unattendedStory = game.createInitialState({ maps, hostCards, quests: allV47StoryQuests, startMapId: 'market-quay' });
unattendedStory.world.chapterId = 'V33_1848_PUBLIC';
unattendedStory.world.date = '1848-06-16';
unattendedStory = advanceV47World(unattendedStory, { date: '1848-06-16', clockMinutes: 540 });
const autoEventBefore = unattendedStory.world.v47.events.V47_MAIN05_C01;
assert.ok(['ASSEMBLING', 'ASSEMBLED'].includes(autoEventBefore.npcAutonomy.status));
const autoStartHostPositions = Object.fromEntries(autoEventBefore.npcAutonomy.assignedHostIds.map(id => [id, unattendedStory.hosts[id].mapId]));
unattendedStory = game.advanceNpcWorld(unattendedStory, 2880, maps, { pausedHostIds: [unattendedStory.player.embodiment] });
const autoEventAfter = unattendedStory.world.v47.events.V47_MAIN05_C01;
assert.equal(autoEventAfter.npcAutonomy.status, 'RESOLVED_UNATTENDED', 'an unattended dated story resolves at its deadline');
assert.equal(autoEventAfter.playerIntervened, false, 'an automatic outcome is never recorded as player intervention');
assert.ok(autoEventAfter.npcAutonomy.outcomeApplied, 'the authored default world change applies once');
assert.ok(unattendedStory.ledger.some(row => row.eventType === 'V47_AUTONOMOUS_STORY_OUTCOME'
  && row.questId === 'V47_MAIN05_C01' && row.unattended), 'the unattended branch records its actual world resolution');
assert.ok(autoEventAfter.npcAutonomy.assignedHostIds.some(id => unattendedStory.hosts[id].mapId === 'market-quay'
  && autoStartHostPositions[id] !== 'market-quay'), 'autonomous participants physically travel to the story map');

const staleBranch = structuredClone(unattendedStory);
staleBranch.world.currentMapId = 'market-quay';
staleBranch.player.embodiment = 'watercarrier_luka';
staleBranch.hosts.watercarrier_luka.mapId = 'market-quay';
const staleBranchObject = maps['market-quay'].layers.flatMap(layer => layer.objects ?? []).find(object => object.id === 9080);
const staleBranchTile = { x: Math.floor(staleBranchObject.x / 16), y: Math.floor(staleBranchObject.y / 16) };
const staleBranchAdjacent = [[staleBranchTile.x - 1, staleBranchTile.y], [staleBranchTile.x + 1, staleBranchTile.y],
  [staleBranchTile.x, staleBranchTile.y - 1], [staleBranchTile.x, staleBranchTile.y + 1]]
  .find(([x, y]) => game.canOccupy(maps['market-quay'], x, y));
staleBranch.player.position = { x: staleBranchAdjacent[0], y: staleBranchAdjacent[1] };
staleBranch.hosts.watercarrier_luka.position = { ...staleBranch.player.position };
const conflictingChoice = game.performQuestAction(staleBranch, { questId: 'V47_MAIN05_C01', hostId: 'watercarrier_luka',
  actionId: 'V47_C01_SUPPLY_BAKERY', objectId: staleBranchObject.id }, { quests: allV47StoryQuests, maps });
assert.equal(conflictingChoice.ok, false, 'a player cannot apply an alternate branch after the NPC resolution is final');
assert.equal(conflictingChoice.reason, 'v47_event_already_resolved');

const deliveryScene = game.createInitialState({ maps, hostCards, quests: allV47StoryQuests, startMapId: 'market-quay' });
deliveryScene.world.chapterId = 'V33_1848_PUBLIC'; deliveryScene.world.date = '1848-06-16';
deliveryScene.world.currentMapId = 'market-quay'; deliveryScene.player.embodiment = 'watercarrier_luka';
deliveryScene.hosts.watercarrier_luka.mapId = 'market-quay';
const deliveryObject = maps['market-quay'].layers.flatMap(layer => layer.objects ?? []).find(object => object.id === 9080);
const deliveryTile = { x: Math.floor(deliveryObject.x / 16), y: Math.floor(deliveryObject.y / 16) };
const deliveryAdjacent = [[deliveryTile.x - 1, deliveryTile.y], [deliveryTile.x + 1, deliveryTile.y],
  [deliveryTile.x, deliveryTile.y - 1], [deliveryTile.x, deliveryTile.y + 1]]
  .find(([x, y]) => game.canOccupy(maps['market-quay'], x, y));
deliveryScene.player.position = { x: deliveryAdjacent[0], y: deliveryAdjacent[1] };
deliveryScene.hosts.watercarrier_luka.position = { ...deliveryScene.player.position };
const deliveryOrigin = { mapId: deliveryScene.hosts.watercarrier_luka.mapId, position: { ...deliveryScene.player.position } };
const deliveryChoice = game.performQuestAction(deliveryScene, { questId: 'V47_MAIN05_C01', hostId: 'watercarrier_luka',
  actionId: 'V47_C01_SUPPLY_LODGING', objectId: deliveryObject.id }, { quests: allV47StoryQuests, maps });
assert.equal(deliveryChoice.ok, true);
assert.deepEqual({ mapId: deliveryChoice.state.hosts.watercarrier_luka.mapId,
  position: deliveryChoice.state.hosts.watercarrier_luka.position }, deliveryOrigin,
'a choice that starts a delivery never teleports the possessed carrier to the customer');
assert.equal(deliveryChoice.state.hosts.watercarrier_luka.v47TravelGoal?.status, 'PLAYER_TRAVEL_REQUIRED',
  'the possessed carrier receives a destination to reach by walking');

let playerStory = game.createInitialState({ maps, hostCards, quests: allV47StoryQuests, startMapId: 'bookshop-interior' });
playerStory.world.chapterId = 'V33_1848_PUBLIC'; playerStory.world.date = '1848-02-12';
playerStory.world.currentMapId = 'bookshop-interior'; playerStory.player.embodiment = 'bookseller_lev';
playerStory = advanceV47World(playerStory, { date: '1848-02-12', clockMinutes: 540 });
const playerObject = maps['bookshop-interior'].layers.flatMap(layer => layer.objects ?? []).find(object => object.id === 9060);
const playerTile = { x: Math.floor(playerObject.x / maps['bookshop-interior'].tilewidth), y: Math.floor(playerObject.y / maps['bookshop-interior'].tileheight) };
const playerAdjacent = [[playerTile.x - 1, playerTile.y], [playerTile.x + 1, playerTile.y],
  [playerTile.x, playerTile.y - 1], [playerTile.x, playerTile.y + 1]].find(([x, y]) => game.canOccupy(maps['bookshop-interior'], x, y));
playerStory.hosts.bookseller_lev.mapId = 'bookshop-interior'; playerStory.hosts.bookseller_lev.position = { x: playerAdjacent[0], y: playerAdjacent[1] };
playerStory.player.position = { ...playerStory.hosts.bookseller_lev.position };
const playerChoice = game.performQuestAction(playerStory, { questId: 'V47_MAIN01_A01', hostId: 'bookseller_lev',
  actionId: 'V47_A01_OPEN_SUBSCRIBER_LEDGER', objectId: playerObject.id }, { quests: allV47StoryQuests, maps });
assert.equal(playerChoice.ok, true);
assert.equal(playerChoice.state.world.v47.events.V47_MAIN01_A01.playerIntervened, true,
  'an authored player choice is kept distinct from unattended default resolution');
const alternatePlayerChoice = game.performQuestAction(playerStory, { questId: 'V47_MAIN01_A01', hostId: 'bookseller_lev',
  actionId: 'V47_A01_SEND_PAVEL_TO_PRINTSHOP', objectId: playerObject.id }, { quests: allV47StoryQuests, maps });
assert.equal(alternatePlayerChoice.ok, true);
assert.notDeepEqual(game.getV47EndingConsequences(playerChoice.state), game.getV47EndingConsequences(alternatePlayerChoice.state),
  'real MAIN01 reducer choices create distinct consequences that can be carried into the ending');
console.log('V47 physical quest wiring, campaign date gates, autonomous cholera, intervention, and save/load passed');
