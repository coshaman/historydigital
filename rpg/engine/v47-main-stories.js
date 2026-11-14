'use strict';

const WORLD_EVENT_ANCHORS = Object.freeze([
  { id: 'MAIN01_PERMISSION', gameDate: '1848-03-09', story: 'MAIN01', sourceIds: ['V47-NEKRASOV-ALMANAC-CONTENTS-1848', 'V47-ALMANAC-CENSORSHIP-EDITORIAL'], sourceRefs: ['ALM-001', 'ALM-002'], sourceStatus: 'MODERN_EDITORIAL_DATE_PROVENANCE_ONLY_NOT_PLAYER_EVIDENCE', calendarSystem: 'JULIAN', originalDateText: '26 февраля 1848', convertedGregorianDate: '1848-03-09', stage: 'PERMISSION_RECORDED' },
  { id: 'MAIN03_REVOLUTION_NEWS', gameDate: '1848-04-02', story: 'MAIN03', sourceIds: ['OBJ-NICHOLAS-MANIFESTO-1848'], sourceRefs: ['POL-005'], sourceStatus: 'PERIOD_PRIMARY_RESPONSE; CITY_SCENE_FICTIONAL', calendarSystem: 'GREGORIAN_SCENE_DATE', originalDateText: '1848년 봄의 장면 날짜는 창작', convertedGregorianDate: '1848-04-02', sceneDateIsFictional: true, stage: 'NEWS_REACHES_CITY' },
  { id: 'MAIN05_CHOLERA_SCENE_OPEN', gameDate: '1848-06-14', story: 'MAIN05', sourceIds: ['V47-ECONOMIST-PETERSBURG-1848-06-24'], sourceRefs: ['CHO-002'], sourceStatus: 'CONTEMPORARY_REPORT_PUBLISHED_LATER; OPENING_SCENE_FICTIONAL', calendarSystem: 'GREGORIAN_SCENE_DATE', originalDateText: '1848년 6월 2일은 허구 장면 날짜(율리우스력)', convertedGregorianDate: '1848-06-14', sceneDateIsFictional: true, stage: 'WATER_NOTICE' },
  { id: 'MAIN01_DISTRIBUTION_BAN', gameDate: '1848-11-01', story: 'MAIN01', sourceIds: ['V47-ALMANAC-CENSORSHIP-EDITORIAL'], sourceRefs: ['ALM-002', 'ALM-005'], sourceStatus: 'MODERN_EDITORIAL_DATE_PROVENANCE_ONLY_NOT_PLAYER_EVIDENCE', calendarSystem: 'JULIAN', originalDateText: '20 октября 1848', convertedGregorianDate: '1848-11-01', stage: 'DISTRIBUTION_BANNED' },
  { id: 'MAIN01_SUBSCRIBER_REPLY', gameDate: '1848-11-29', story: 'MAIN01', sourceIds: ['V47-NEKRASOV-SUBSCRIBER-LETTER-1848'], sourceRefs: ['ALM-003'], sourceStatus: 'LETTER_AVAILABLE_FROM_DATE_ONLY', calendarSystem: 'JULIAN', originalDateText: '17 ноября 1848', convertedGregorianDate: '1848-11-29', stage: 'SUBSCRIBER_REPLY_AVAILABLE' },
  { id: 'MAIN03_BELINSKY_LETTER_READING', gameDate: '1849-04-27', story: 'MAIN03', sourceIds: ['OBJ-BELINSKY-LETTER-GOGOL-1847'], sourceRefs: ['POL-006'], sourceStatus: 'VERIFIED_LETTER; 1849_READING_SCENE_FICTIONAL', calendarSystem: 'JULIAN', originalDateText: '15 апреля 1849', convertedGregorianDate: '1849-04-27', sceneDateIsFictional: true, stage: 'LETTER_IN_CIRCULATION' },
  { id: 'MAIN03_PETRASHEVSKY_ARREST', gameDate: '1849-05-05', story: 'MAIN03',
    sourceIds: ['OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849'],
    provenanceSourceIds: ['OBJ-WS-PETRASHEVSKY-REPORT-1849', 'OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849'],
    sourceRefs: ['POL-001', 'POL-008'], sourceStatus: 'ARREST_ORDER_READABLE; LATER_REPORT_PROVENANCE_ONLY',
    mapId: 'morskaya-intersection', objectId: 9051,
    calendarSystem: 'JULIAN', originalDateText: '23 апреля 1849', convertedGregorianDate: '1849-05-05', stage: 'ARREST_OPERATION' },
  { id: 'MAIN03_SEMENOVSKY_CONCLUSION', gameDate: '1850-01-03', story: 'MAIN03', sourceIds: ['OBJ-WS-DOSTOEVSKY-LETTER-1849-DEC22'], sourceRefs: ['POL-008'], sourceStatus: 'EXISTING_CONTIGUOUS_LETTER', calendarSystem: 'JULIAN', originalDateText: '22 декабря 1849', convertedGregorianDate: '1850-01-03', stage: 'SENTENCE_COMMUTED' },
]);

const STORY_GUIDANCE = Object.freeze({
  MAIN01: { title: '인쇄되었으나 존재하지 않는 책', questId: 'MAIN01-PRINTED-NOT-PUBLISHED', sourceIds: [], sourceRefs: ['ALM-001', 'ALM-002', 'ALM-003', 'ALM-008'], roles: ['nekrasov_reconstruction', 'printer_ekaterina', 'print_apprentice_stepan', 'clerk_alexei', 'bookseller_lev', 'courier_pavel', 'seamstress_anna', 'editor_sofia'] },
  MAIN03: { title: '금요일의 문이 닫히는 날', questId: 'MAIN03-FRIDAY-ARRESTS', sourceIds: ['OBJ-WS-PETRASHEVSKY-REPORT-1849', 'OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849', 'OBJ-WS-DOSTOEVSKY-LETTER-1849-DEC22'], sourceRefs: ['POL-001', 'POL-003', 'POL-006', 'POL-008'], roles: ['dostoevsky_1849', 'student_vasily', 'clerk_alexei', 'courier_pavel', 'police_sergeant_ivan', 'printer_ekaterina', 'editor_sofia', 'teacher_lyubov', 'bookseller_lev', 'bookbinder_elizaveta'] },
  MAIN05: { title: '물을 마시는 도시', questId: 'MAIN05-CHOLERA-CITY', sourceIds: [], sourceRefs: ['CHO-001', 'CHO-002', 'CHO-005'], roles: ['apothecary_yakov', 'midwife_avdotya', 'seamstress_anna', 'watercarrier_luka', 'baker_fyodor', 'landlady_polina', 'police_sergeant_ivan', 'tenant_mikhail', 'innkeeper_irina'] },
});

const CHOLERA_AREAS = Object.freeze([
  ['NEVSKY_COMMERCIAL', ['nevsky', 'printshop', 'chancery', 'bookshop-interior']],
  ['MARKET_QUAY', ['market-quay', 'bakery-interior']],
  ['BOOKS_AND_READING', ['bookshop-lane']],
  ['CANAL_TRANSPORT', ['canal-road']],
  ['HOUSEHOLD_WORKYARD', ['workyard', 'communal-room', 'sewing-room']],
  ['COURTYARD_HOUSEHOLD', ['courtyard', 'inn-interior']],
  ['SEMENOVSKY_PARADE_GROUND', ['semenovsky-square']],
]);
const CHOLERA_WATER_IDS = Object.freeze(['COMMUNAL_WELL', 'CANAL_PUMP', 'MARKET_CISTERN', 'INN_WELL']);
const CHOLERA_FOOD_IDS = Object.freeze(['NEVSKY_BAKERY', 'MARKET_BAKERY', 'FISH_STALL', 'INN_KITCHEN', 'LOWER_MARKET', 'CANAL_VENDOR', 'COURTYARD_OVEN', 'BOOKSHOP_TEA']);
const stableIndex = (value, length) => [...String(value)].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7) % length;
const homeMapOf = host => host?.residence?.sleepLocation?.mapId ?? host?.residence?.homeLocation?.mapId ?? host?.homeLocation?.mapId ?? host?.mapId;
function choleraZoneFor(host) {
  const homeMapId = homeMapOf(host);
  return CHOLERA_AREAS.find(([, mapIds]) => mapIds.includes(homeMapId))?.[0] ?? CHOLERA_AREAS[stableIndex(homeMapId ?? host?.id, CHOLERA_AREAS.length)][0];
}
function averageSourceRisk(sources, fallback) {
  const risks = Object.values(sources ?? {}).map(source => Number(source.risk)).filter(Number.isFinite);
  return risks.length ? risks.reduce((sum, risk) => sum + risk, 0) / risks.length : fallback;
}
function syncCholeraRisk(cholera) {
  cholera.waterRisk = averageSourceRisk(cholera.waterSources, cholera.waterRisk);
  cholera.foodRisk = averageSourceRisk(cholera.foodSources, cholera.foodRisk);
}

let REGISTERED_STORY_BEATS = [];
function julianDateToGregorian(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return value;
  const year = Number(value.slice(0, 4));
  const offset = year >= 1800 && year < 1900 ? 12 : year >= 1700 && year < 1800 ? 11 : year >= 1900 && year < 2100 ? 13 : null;
  if (offset === null) throw new RangeError(`Unsupported Julian calendar year: ${year}`);
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) throw new RangeError(`Invalid Julian calendar date: ${value}`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function getV47MissionQuest(state, quests = []) {
  const v47 = state?.world?.v47;
  if (!v47) return null;
  const storyFromQuest = quest => quest?.storyId ?? (quest?.id?.includes('MAIN01') ? 'MAIN01'
    : quest?.id?.includes('MAIN03') ? 'MAIN03' : quest?.id?.includes('MAIN05') ? 'MAIN05' : null);
  const lastStoryAction = [...(state.ledger ?? [])].reverse().find(row => row.questId?.startsWith('V47_MAIN0'));
  const focusedStoryId = v47.focusStoryId ?? (lastStoryAction ? storyFromQuest({ id: lastStoryAction.questId }) : null);
  for (const storyId of focusedStoryId ? [focusedStoryId] : ['MAIN01', 'MAIN03', 'MAIN05']) {
    const hasEnteredBeatGraph = Boolean(lastStoryAction && /_A[0-9]{2}$|_P[0-9]{2}$|_C[0-9]{2}$/.test(lastStoryAction.questId));
    const storyQuests = quests.filter(quest => storyFromQuest(quest) === storyId
      && (!hasEnteredBeatGraph || /_A[0-9]{2}$|_P[0-9]{2}$|_C[0-9]{2}$/.test(quest.id))
      && state.quests?.[quest.id]?.status !== 'resolved').sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    if (!storyQuests.length) continue;
    const current = storyQuests.find(quest => quest.id === v47.stories?.[storyId]?.currentEventId);
    const inChapter = quest => quest.chapterId === state.world.chapterId;
    if (current && inChapter(current)) return current;
    const chapterQuest = storyQuests.find(inChapter);
    if (chapterQuest) return chapterQuest;
    const futureQuest = storyQuests.find(quest => (quest.date ?? '') >= (state.world.date ?? ''));
    if (futureQuest) return futureQuest;
  }
  return null;
}

function getV47CompletionGuidance(state, quests = [], questStates = state?.quests ?? {}) {
  const storyId = state?.world?.v47?.focusStoryId;
  if (!storyId || !['MAIN01', 'MAIN03', 'MAIN05'].includes(storyId)) return null;
  const storyQuests = quests.filter(quest => quest.storyId === storyId);
  const lastAction = [...(state.ledger ?? [])].reverse().find(row => row.questId?.startsWith(`V47_${storyId}`));
  if (!storyQuests.length || !lastAction || storyQuests.some(quest => questStates[quest.id]?.status !== 'resolved')) return null;
  return {
    questTitleKo: storyId === 'MAIN01' ? '인쇄 연감의 뒷이야기' : storyId === 'MAIN03' ? '모임 뒤의 사람들' : '콜레라가 지나간 자리',
    actionKo: '다른 사건을 고르거나, 이곳에 남은 사람들을 만나보자.',
    reasonKo: lastAction.outcomeKo ?? '이 사건에서 내린 선택이 사람들의 삶에 남았다.',
    howKo: '사건 목록에서 다음 이야기를 고른다.',
    target: null,
  };
}

function registerStoryBeats(quests = []) {
  if (!Array.isArray(quests) || quests.some(quest => !/^V47_MAIN0[135]_[A-Z0-9_]+$/.test(quest.id)
    || !['MAIN01', 'MAIN03', 'MAIN05'].includes(quest.storyId) || !/^\d{4}-\d{2}-\d{2}$/.test(quest.date)
    || !quest.entry?.mapId || !Number.isInteger(quest.entry?.objectId))) throw new Error('Invalid V47 story beat registration');
  REGISTERED_STORY_BEATS = quests.map(quest => ({
    id: quest.id, story: quest.storyId,
    gameDate: quest.date,
    sourceIds: [...(quest.sourceIds ?? [])], sourceRefs: [],
    sourceStatus: quest.sourceIds?.length ? 'VERIFIED_SOURCE_READER_ENTRY' : 'SCENE_WITHOUT_READABLE_SOURCE',
    calendarSystem: 'GREGORIAN_GAME_CLOCK', sceneDateIsFictional: !['V47_MAIN01_A00', 'V47_MAIN01_A06', 'V47_MAIN03_P11'].includes(quest.id),
    originalDateText: quest.date, convertedGregorianDate: quest.date,
    historicalOutcomeFixed: ['V47_MAIN01_A06', 'V47_MAIN03_P11'].includes(quest.id),
    stage: quest.titleKo, titleKo: quest.titleKo, objectiveKo: quest.objectiveKo,
    mapId: quest.entry.mapId, objectId: quest.entry.objectId, hostIds: [...new Set(quest.actions.flatMap(action => action.hostIds))],
    autonomousOutcome: quest.actions.find(action => action.effects?.v47WorldChange)?.effects?.v47WorldChange
      ? { actionId: quest.actions.find(action => action.effects?.v47WorldChange).id,
        worldChange: quest.actions.find(action => action.effects?.v47WorldChange).effects.v47WorldChange }
      : null,
  }));
  return REGISTERED_STORY_BEATS.length;
}

function gameDayIndex(date, clockMinutes) {
  const day = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(day) ? Math.floor(day / 86400000) + Math.floor(clockMinutes / 1440) : Math.floor(clockMinutes / 1440);
}

function createV47State() {
  return {
    schemaVersion: 'V47_RUNTIME_1',
    events: {},
    observations: [],
    relationships: {},
    stories: Object.fromEntries(Object.entries(STORY_GUIDANCE).map(([id, story]) => [id, {
      status: 'AVAILABLE', titleKo: story.title, questId: story.questId, focusHostId: null,
      completedBeatIds: [], consequences: [], sourceIds: [...story.sourceIds], sourceRefs: [...story.sourceRefs],
    }])),
    cholera: {
      status: 'DORMANT', simulationBasis: 'GAMEPLAY_MODEL', waterRisk: 0.72, foodRisk: 0.38,
      areas: Object.fromEntries(CHOLERA_AREAS.map(([id]) => [id, { waterPressure: 0.72, foodPressure: 0.38, trust: 0, activeCases: 0 }])),
      waterSources: Object.fromEntries(CHOLERA_WATER_IDS.map(id => [id, { risk: 0.72, cleaned: false, deliveries: 0 }])),
      foodSources: Object.fromEntries(CHOLERA_FOOD_IDS.map(id => [id, { risk: 0.38, closed: false, deliveries: 0 }])),
      beds: 2, medicineStock: 3, dayIndex: null, hosts: {}, counters: { exposures: 0, recoveries: 0, deaths: 0 },
      interventions: [],
    },
    lastProcessedDate: null,
  };
}

function ensureV47State(state) {
  state.world.v47 ??= createV47State();
  const v47 = state.world.v47;
  v47.events ??= {};
  v47.observations ??= [];
  v47.relationships ??= {};
  v47.stories ??= createV47State().stories;
  for (const [id, story] of Object.entries(createV47State().stories)) {
    v47.stories[id] ??= story;
    v47.stories[id].completedBeatIds ??= [];
    v47.stories[id].consequences ??= [];
    v47.stories[id].sourceIds ??= [...story.sourceIds];
    v47.stories[id].sourceRefs ??= [...story.sourceRefs];
  }
  v47.cholera ??= createV47State().cholera;
  v47.cholera.areas ??= Object.fromEntries(CHOLERA_AREAS.map(([id]) => [id, { waterPressure: v47.cholera.waterRisk, foodPressure: v47.cholera.foodRisk, trust: 0, activeCases: 0 }]));
  v47.cholera.waterSources ??= Object.fromEntries(CHOLERA_WATER_IDS.map(id => [id, { risk: v47.cholera.waterRisk, cleaned: false, deliveries: 0 }]));
  v47.cholera.foodSources ??= Object.fromEntries(CHOLERA_FOOD_IDS.map(id => [id, { risk: v47.cholera.foodRisk, closed: false, deliveries: 0 }]));
  v47.cholera.hosts ??= {};
  v47.cholera.counters ??= { exposures: 0, recoveries: 0, deaths: 0 };
  return v47;
}

function ensureHostHealth(v47, hosts) {
  for (const host of Object.values(hosts ?? {})) {
    if (host.kind !== 'FICTIONAL' || host.historicalAliveAndPresent === false) continue;
    const health = v47.cholera.hosts[host.id] ??= {
      state: 'S', exposedDays: 0, infectiousDays: 0, careDays: 0,
      lastExposure: null, source: null, severity: 'UNASSESSED', dailyWaterUse: true, dailyFoodUse: true,
      areaId: choleraZoneFor(host),
      waterSourceId: CHOLERA_WATER_IDS[stableIndex(choleraZoneFor(host), CHOLERA_WATER_IDS.length)],
      foodSourceId: CHOLERA_FOOD_IDS[stableIndex(host.id, CHOLERA_FOOD_IDS.length)],
    };
    health.areaId ??= choleraZoneFor(host);
    health.waterSourceId ??= CHOLERA_WATER_IDS[stableIndex(health.areaId, CHOLERA_WATER_IDS.length)];
    health.foodSourceId ??= CHOLERA_FOOD_IDS[stableIndex(host.id, CHOLERA_FOOD_IDS.length)];
    health.exposedDays = Number(health.exposedDays) || 0;
    health.infectiousDays = Number(health.infectiousDays) || 0;
    health.careDays = Number(health.careDays) || 0;
    health.dailyWaterUse = health.dailyWaterUse !== false;
    health.dailyFoodUse = health.dailyFoodUse !== false;
  }
}

function shareDwelling(first, second) {
  const location = host => host?.residence?.sleepLocation ?? host?.residence?.homeLocation ?? null;
  const a = location(first), b = location(second);
  return Boolean(a && b && a.mapId === b.mapId && a.position?.x === b.position?.x && a.position?.y === b.position?.y);
}

function setCholeraHealth(host, { severity, care, condition = 'UNWELL', recoveryUntilMinute = null, onsetMinute = 0 }) {
  host.healthState = {
    condition, injury: null,
    illness: { id: 'V47_CHOLERA', severity, onsetMinute, care, valueStatus: 'FICTIONAL_CHARACTER_DESIGN' },
    recoveryUntilMinute, valueStatus: 'FICTIONAL_CHARACTER_DESIGN',
  };
}

function advanceDiseaseDay(v47, hosts, dayIndex) {
  const cholera = v47.cholera;
  if (cholera.status !== 'ACTIVE' || (cholera.dayIndex !== null && dayIndex <= cholera.dayIndex)) return;
  const days = cholera.dayIndex === null ? 1 : Math.min(14, dayIndex - cholera.dayIndex);
  for (let day = 0; day < days; day += 1) {
    const infectious = Object.entries(cholera.hosts).filter(([, patient]) => patient.state === 'I');
    if (infectious.length) {
      for (const [hostId, host] of Object.entries(hosts ?? {})) {
        if (host.kind !== 'FICTIONAL' || host.historicalAliveAndPresent === false || cholera.hosts[hostId]?.state !== 'S') continue;
        const patient = cholera.hosts[hostId];
        const householdContact = infectious.some(([caseId]) => shareDwelling(hosts[caseId], host));
        const waterSource = cholera.waterSources?.[patient.waterSourceId];
        const foodSource = cholera.foodSources?.[patient.foodSourceId];
        const waterRisk = Number.isFinite(waterSource?.risk) ? waterSource.risk : cholera.waterRisk;
        const foodRisk = Number.isFinite(foodSource?.risk) ? foodSource.risk : cholera.foodRisk;
        const waterPressure = patient.dailyWaterUse ? waterRisk * 0.18 : 0;
        const foodPressure = patient.dailyFoodUse ? foodRisk * 0.12 : 0;
        const exposurePressure = waterPressure + foodPressure + (householdContact ? 0.28 : 0);
        const roll = Math.abs([...`${hostId}:${dayIndex}:${cholera.counters.exposures}`].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) | 0, 11)) % 1000;
        if (roll < Math.floor(exposurePressure * 1000)) {
          patient.state = 'E'; patient.exposedDays = 0; patient.lastExposure = cholera.lastSimulatedDate ?? null;
          patient.source = householdContact ? 'HOUSEHOLD_CONTACT' : waterPressure >= foodPressure
            ? `WATER_SOURCE:${patient.waterSourceId}` : `FOOD_SOURCE:${patient.foodSourceId}`;
          patient.severity = 'EXPOSED'; cholera.counters.exposures += 1;
        }
      }
    }
    for (const [hostId, patient] of Object.entries(cholera.hosts)) {
      const host = hosts?.[hostId];
      if (!host || host.historicalAliveAndPresent === false) continue;
      if (patient.state === 'E') {
        patient.exposedDays += 1;
        if (patient.exposedDays >= 2) {
          patient.state = 'I';
          const needBurden = Number(host.needs?.hunger ?? 0) + Number(host.needs?.fatigue ?? 0);
          patient.severity = needBurden >= 150 ? 'SEVERE' : 'MILD';
          setCholeraHealth(host, { severity: patient.severity, care: 'AWAITING_CARE',
            onsetMinute: host.healthState?.illness?.onsetMinute ?? 0 });
        }
      } else if (patient.state === 'I') {
        patient.infectiousDays += 1;
        if (patient.careDays > 0) patient.careDays -= 1;
        const bedAvailable = cholera.beds > 0 && patient.careDays > 0;
        const mortalityRoll = Math.abs([...`${hostId}:${patient.infectiousDays}`].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) | 0, 7)) % 100;
        if (patient.severity === 'SEVERE' && !bedAvailable && patient.infectiousDays >= 5 && mortalityRoll < 18) {
          patient.state = 'D'; patient.severity = 'DIED';
          host.historicalAliveAndPresent = false;
          host.lifeStatus = 'DECEASED';
          host.deathRecord = { causeId: 'V47_CHOLERA', minute: 0, date: cholera.lastSimulatedDate ?? null,
            mapId: host.mapId, valueStatus: 'fictional_gameplay_outcome' };
          setCholeraHealth(host, { severity: 'FATAL', care: 'CARE_UNAVAILABLE',
            onsetMinute: host.healthState?.illness?.onsetMinute ?? 0 });
          cholera.counters.deaths += 1;
          cholera.deathRecords ??= [];
          cholera.deathRecords.push({ hostId, ...host.deathRecord });
          continue;
        }
        if (patient.infectiousDays >= 7 || (patient.careDays > 0 && patient.infectiousDays >= 4)) {
          patient.state = 'R';
          patient.severity = 'RECOVERED';
          cholera.counters.recoveries += 1;
          setCholeraHealth(host, { condition: 'RECOVERING', severity: 'RECOVERED',
            care: patient.careDays > 0 ? 'CARE_RECEIVED' : 'RESTED', recoveryUntilMinute: 1,
            onsetMinute: host.healthState?.illness?.onsetMinute ?? 0 });
        }
      }
    }
  }
  for (const [areaId, area] of Object.entries(cholera.areas ?? {})) {
    const areaHosts = Object.values(cholera.hosts).filter(patient => patient.areaId === areaId);
    area.activeCases = areaHosts.filter(patient => patient.state === 'E' || patient.state === 'I').length;
    const waters = areaHosts.map(patient => cholera.waterSources?.[patient.waterSourceId]?.risk).filter(Number.isFinite);
    const foods = areaHosts.map(patient => cholera.foodSources?.[patient.foodSourceId]?.risk).filter(Number.isFinite);
    if (waters.length) area.waterPressure = waters.reduce((sum, risk) => sum + risk, 0) / waters.length;
    if (foods.length) area.foodPressure = foods.reduce((sum, risk) => sum + risk, 0) / foods.length;
  }
  syncCholeraRisk(cholera);
  cholera.dayIndex = dayIndex;
}

function fireAnchors(v47, date, clockMinutes, hosts) {
  for (const anchor of [...WORLD_EVENT_ANCHORS, ...REGISTERED_STORY_BEATS]) {
    if (date < anchor.gameDate || v47.events[anchor.id]) continue;
    const provenanceSourceIds = [...(anchor.provenanceSourceIds ?? anchor.sourceIds)];
    const playerEvidenceSourceIds = anchor.sourceStatus === 'MODERN_EDITORIAL_DATE_PROVENANCE_ONLY_NOT_PLAYER_EVIDENCE'
      ? [] : [...(anchor.playerSourceIds ?? anchor.sourceIds)];
    const event = {
      id: anchor.id, story: anchor.story, status: date === anchor.gameDate ? 'ACTIVE' : 'RESOLVED',
      stage: date === anchor.gameDate ? anchor.stage : `OFFSCREEN_${anchor.stage}`,
      scheduledGameDate: anchor.gameDate, observedDate: date, minute: clockMinutes,
      sourceIds: playerEvidenceSourceIds, provenanceSourceIds, sourceRefs: [...anchor.sourceRefs], sourceStatus: anchor.sourceStatus,
      calendarSystem: anchor.calendarSystem, originalDateText: anchor.originalDateText,
      convertedGregorianDate: anchor.convertedGregorianDate, sceneDateIsFictional: anchor.sceneDateIsFictional ?? false,
      titleKo: anchor.titleKo ?? null, objectiveKo: anchor.objectiveKo ?? null, mapId: anchor.mapId ?? null,
      objectId: anchor.objectId ?? null, hostIds: anchor.hostIds ?? [],
      historicalOutcomeFixed: anchor.historicalOutcomeFixed ?? ['MAIN01_DISTRIBUTION_BAN', 'MAIN03_PETRASHEVSKY_ARREST', 'MAIN03_SEMENOVSKY_CONCLUSION'].includes(anchor.id),
      playerIntervened: false,
      ...(anchor.autonomousOutcome ? { autonomousOutcome: structuredClone(anchor.autonomousOutcome),
        npcAutonomy: date === anchor.gameDate ? { status: 'ASSEMBLING', assignedHostIds: (anchor.hostIds ?? []).filter(id => hosts?.[id]?.kind === 'FICTIONAL'),
          // Give a player one in-world day to reach the scene; unattended scenes then resolve.
          arrivedHostIds: [], opensAtMinute: clockMinutes, deadlineMinute: clockMinutes + 1440 } :
          { status: 'SKIPPED_OFFSCREEN', assignedHostIds: [], arrivedHostIds: [] } } : {}),
    };
    v47.events[anchor.id] = event;
    const story = v47.stories[anchor.story];
    if (story) {
      story.status = date === anchor.gameDate ? 'ACTIVE' : story.status;
      story.currentEventId = date === anchor.gameDate ? anchor.id : story.currentEventId ?? anchor.id;
      story.lastEventId = anchor.id;
      story.lastEventStatus = event.status;
    }
    if (anchor.id === 'MAIN05_CHOLERA_SCENE_OPEN' && date === anchor.gameDate) {
      v47.cholera.status = 'ACTIVE';
      v47.cholera.dayIndex = gameDayIndex(date, clockMinutes);
      v47.cholera.lastSimulatedDate = date;
      const seedId = ['tenant_mikhail', 'innkeeper_irina', 'landlady_polina'].find(id => v47.cholera.hosts[id] && hosts?.[id]?.historicalAliveAndPresent !== false);
      if (seedId) {
        const patient = v47.cholera.hosts[seedId];
        patient.state = 'E'; patient.exposedDays = 0; patient.lastExposure = date; patient.source = 'SHARED_WATER'; patient.severity = 'EXPOSED';
        v47.cholera.counters.exposures += 1;
      }
    }
    if (anchor.id === 'MAIN01_DISTRIBUTION_BAN') {
      v47.stories.MAIN01.consequences.push({ id: 'BAN_FIXED', date, sourceIds: [...anchor.sourceIds] });
    }
    if (anchor.id === 'MAIN03_PETRASHEVSKY_ARREST' && date === anchor.gameDate) {
      const police = hosts?.police_sergeant_ivan, student = hosts?.student_vasily;
      const historicalDetainees = ['petrashevsky_1849', 'dostoevsky_1849']
        .map(id => hosts?.[id]).filter(host => host?.kind === 'HISTORICAL_RECONSTRUCTION'
          && host.historicalAliveAndPresent !== false);
      const previouslyWarned = v47.stories.MAIN03.consequences.some(row => row.actionId === 'V47_P07_WARN_FICTIONAL');
      event.mapId = 'morskaya-intersection';
      event.objectId = 9051;
      const destinationMapByHost = {};
      if (police && police.kind === 'FICTIONAL') {
        police.v47Assignment = { eventId: anchor.id, status: 'EN_ROUTE_TO_SEARCH', date };
        police.v47TravelGoal = { status: 'EN_ROUTE', targetMapId: 'morskaya-intersection',
          targetPosition: { x: 18, y: 12 }, arrivalRadius: 2, storyId: 'MAIN03', questId: anchor.id,
          actionId: previouslyWarned ? 'SEARCH_LAST_KNOWN_PUBLIC_LOCATION' : 'JOIN_ARREST_OPERATION',
          taskId: `V47:ARREST_SEARCH:${police.id}`,
          activityKo: previouslyWarned ? '마지막으로 목격된 교차로를 수색한다' : '체포 작전을 위해 교차로로 이동한다',
          startedDate: date };
        destinationMapByHost[police.id] = 'morskaya-intersection';
        delete police.plannedPath;
        delete police.mapRoutePlan;
      }
      const supportGuard = hosts?.junior_guard_sergey;
      if (supportGuard?.kind === 'FICTIONAL' && supportGuard.historicalAliveAndPresent !== false) {
        supportGuard.v47Assignment = { eventId: anchor.id, status: 'EN_ROUTE_TO_SEARCH', date };
        supportGuard.v47TravelGoal = { status: 'EN_ROUTE', targetMapId: 'morskaya-intersection',
          targetPosition: { x: 19, y: 12 }, arrivalRadius: 2, storyId: 'MAIN03', questId: anchor.id,
          actionId: 'JOIN_ARREST_OPERATION', taskId: `V47:ARREST_SUPPORT:${supportGuard.id}`,
          activityKo: '말라야 모르스카야 교차로로 이동해 체포 작전을 돕는다', startedDate: date };
        destinationMapByHost[supportGuard.id] = 'morskaya-intersection';
        delete supportGuard.plannedPath;
        delete supportGuard.mapRoutePlan;
      }
      for (const detainee of historicalDetainees) {
        const atDocumentedAddress = detainee.id === 'dostoevsky_1849';
        detainee.v47Assignment = { eventId: anchor.id,
          status: atDocumentedAddress ? 'EN_ROUTE_TO_ARREST_ADDRESS' : 'TRANSFERRED_AFTER_FIXED_ARREST', date,
          historicalOutcomeFixed: true };
        detainee.v47TravelGoal = { status: 'EN_ROUTE',
          targetMapId: atDocumentedAddress ? 'morskaya-intersection' : 'police-station',
          targetPosition: atDocumentedAddress ? { x: 17, y: 12 } : { x: 3, y: 4 },
          arrivalRadius: 2, storyId: 'MAIN03', questId: anchor.id,
          actionId: atDocumentedAddress ? 'FIXED_HISTORICAL_ARREST_AT_DOCUMENTED_ADDRESS' : 'FIXED_HISTORICAL_ARREST_TRANSFER',
          taskId: `V47:ARREST_TRANSFER:${detainee.id}:${atDocumentedAddress ? 'MORSKAYA' : 'POLICE_STATION'}`,
          activityKo: atDocumentedAddress ? '명령서에 적힌 주소로 향한다' : '체포 뒤 관서로 호송된다', startedDate: date };
        destinationMapByHost[detainee.id] = detainee.v47TravelGoal.targetMapId;
        delete detainee.plannedPath;
        delete detainee.mapRoutePlan;
      }
      if (!previouslyWarned && student && student.kind === 'FICTIONAL' && student.historicalAliveAndPresent !== false) {
        student.v47Questioning = { status: 'MOVING_WITH_SEARCH_TEAM', openedDate: date, canVary: true };
        student.v47TravelGoal = { status: 'EN_ROUTE', targetMapId: 'police-station', targetPosition: { x: 3, y: 4 },
          arrivalRadius: 2, storyId: 'MAIN03', questId: anchor.id, actionId: 'FICTIONAL_WITNESS_QUESTIONING',
          taskId: `V47:ARREST_QUESTIONING:${student.id}`, activityKo: '조사를 받으러 관서로 이동한다', startedDate: date };
        destinationMapByHost[student.id] = 'police-station';
        delete student.plannedPath;
        delete student.mapRoutePlan;
      } else if (previouslyWarned && student) {
        student.v47Questioning = { status: 'ESCAPED_BEFORE_QUESTIONING', openedDate: date, canVary: true,
          hideMapId: 'communal-room' };
        student.v47TravelGoal = { status: 'EN_ROUTE', targetMapId: 'communal-room', targetPosition: { x: 12, y: 8 },
          arrivalRadius: 2, storyId: 'MAIN03', questId: anchor.id, actionId: 'HIDE_FROM_QUESTIONING',
          taskId: `V47:ARREST_HIDE:${student.id}`, activityKo: '관청의 수색을 피해 안뜰에 숨는다', startedDate: date };
        destinationMapByHost[student.id] = 'communal-room';
        delete student.plannedPath;
        delete student.mapRoutePlan;
      }
      event.actorHostIds = [police?.id, supportGuard?.id, ...historicalDetainees.map(host => host.id), student?.id].filter(Boolean);
      event.playerIntervened = false;
      event.npcAutonomy = { status: 'ASSEMBLING', assignedHostIds: [police?.id, supportGuard?.id, ...historicalDetainees.map(host => host.id),
        student?.id].filter(id => hosts?.[id]
          && hosts[id].historicalAliveAndPresent !== false), arrivedHostIds: [],
        dispatchedHostIds: [police?.id].filter(Boolean), questionedHostIds: [],
        historicalDetaineeHostIds: historicalDetainees.map(host => host.id), opensAtMinute: clockMinutes,
        destinationMapByHost,
        deadlineMinute: clockMinutes + 1440, branch: previouslyWarned ? 'WARNED_FICTIONAL_WITNESS; HISTORICAL_ARRESTS_FIXED' : 'BASE_OPERATION' };
      v47.worldChanges ??= [];
      v47.worldChanges.push({ questId: anchor.id, actionId: 'NPC_SEARCH_TEAM_DISPATCHED', date,
        moves: [], assignedHostIds: [...event.npcAutonomy.assignedHostIds], mapId: event.mapId,
        resources: null, rumorId: null, unattended: true });
    }
  }
}

function resolveAutonomousArrestRoute(v47, hosts, date) {
  const event = v47.events.MAIN03_PETRASHEVSKY_ARREST, student = hosts?.student_vasily;
  if (!event) return;
  const dostoevsky = hosts?.dostoevsky_1849;
  const police = hosts?.police_sergeant_ivan;
  const supportGuard = hosts?.junior_guard_sergey;
  if (dostoevsky?.v47Assignment?.status === 'EN_ROUTE_TO_ARREST_ADDRESS'
    && dostoevsky.mapId === 'morskaya-intersection' && dostoevsky.v47TravelGoal?.status === 'ARRIVED'
    && police?.mapId === 'morskaya-intersection' && police.v47TravelGoal?.status === 'ARRIVED') {
    dostoevsky.v47Assignment = { ...dostoevsky.v47Assignment, status: 'ARRESTED_AT_DOCUMENTED_ADDRESS', arrestedDate: date,
      historicalOutcomeFixed: true };
    police.inventory ??= [];
    if (!police.inventory.includes('봉인된 책과 서류 꾸러미')) police.inventory.push('봉인된 책과 서류 꾸러미');
    v47.worldChanges ??= [];
    if (!v47.worldChanges.some(row => row.questId === event.id && row.actionId === 'NPC_ARREST_AT_DOCUMENTED_ADDRESS')) {
      v47.worldChanges.push({ questId: event.id, actionId: 'NPC_ARREST_AT_DOCUMENTED_ADDRESS', date,
        assignedHostIds: [dostoevsky.id, police.id, ...(supportGuard ? [supportGuard.id] : [])],
        destination: { mapId: 'morskaya-intersection' }, moves: [],
        resources: { police_sergeant_ivan: { inventoryAdded: ['봉인된 책과 서류 꾸러미'] } },
        rumorId: null, unattended: true, historicalOutcomeFixed: true,
        provenanceSourceIds: ['OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849'] });
    }
    dostoevsky.v47Assignment = { ...dostoevsky.v47Assignment, status: 'TRANSFERRED_AFTER_FIXED_ARREST' };
    for (const host of [dostoevsky, police]) {
      if (host === police && police.v47TravelGoal?.actionId === 'SEARCH_LAST_KNOWN_PUBLIC_LOCATION') continue;
      host.v47TravelGoal = { status: 'EN_ROUTE', targetMapId: 'police-station', targetPosition: { x: 3, y: 4 },
        arrivalRadius: 2, storyId: 'MAIN03', questId: event.id, actionId: 'FIXED_HISTORICAL_ARREST_TRANSFER',
        taskId: `V47:ARREST_ESCORT:${host.id}:POLICE_STATION`, activityKo: '압수물을 가지고 관서로 이동한다', startedDate: date };
      delete host.plannedPath;
      delete host.mapRoutePlan;
    }
    event.npcAutonomy.arrestAddressResolved = true;
  }
  if (event.npcAutonomy?.arrestAddressResolved && supportGuard?.mapId === 'morskaya-intersection'
    && supportGuard.v47TravelGoal?.actionId === 'JOIN_ARREST_OPERATION'
    && supportGuard.v47TravelGoal.status === 'ARRIVED') {
    supportGuard.v47TravelGoal = { status: 'EN_ROUTE', targetMapId: 'police-station', targetPosition: { x: 3, y: 4 },
      arrivalRadius: 2, storyId: 'MAIN03', questId: event.id, actionId: 'FIXED_HISTORICAL_ARREST_TRANSFER',
      taskId: `V47:ARREST_ESCORT:${supportGuard.id}:POLICE_STATION`, activityKo: '압수물을 가지고 관서로 이동한다', startedDate: date };
    delete supportGuard.plannedPath;
    delete supportGuard.mapRoutePlan;
  }
  for (const hostId of event.npcAutonomy?.historicalDetaineeHostIds ?? []) {
    const detainee = hosts?.[hostId];
    if (detainee?.v47Assignment?.status === 'TRANSFERRED_AFTER_FIXED_ARREST'
      && detainee.mapId === 'police-station' && detainee.v47TravelGoal?.status === 'ARRIVED') {
      detainee.v47Assignment = { ...detainee.v47Assignment, status: 'ARRIVED_AFTER_FIXED_ARREST', arrivedDate: date };
    }
  }
  if (date > '1849-05-05' && dostoevsky?.v47Assignment?.status === 'ARRIVED_AFTER_FIXED_ARREST'
    && dostoevsky.allowedMaps?.includes('fortress-cell')) {
    dostoevsky.v47Assignment = { ...dostoevsky.v47Assignment, status: 'EN_ROUTE_TO_FORTRESS_AFTER_FIXED_ARREST', transferDate: date,
      historicalOutcomeFixed: true };
    dostoevsky.v47TravelGoal = { status: 'EN_ROUTE', targetMapId: 'fortress-cell', targetPosition: { x: 7, y: 6 },
      arrivalRadius: 2,
      storyId: 'MAIN03', questId: event.id, actionId: 'FIXED_HISTORICAL_TRANSFER_TO_FORTRESS',
      taskId: `V47:ARREST_TRANSFER:${dostoevsky.id}:FORTRESS`, activityKo: '요새의 감방으로 호송된다', startedDate: date };
    delete dostoevsky.plannedPath;
    delete dostoevsky.mapRoutePlan;
    v47.worldChanges ??= [];
    v47.worldChanges.push({ questId: event.id, actionId: 'NPC_FIXED_HISTORICAL_TRANSFER_TO_FORTRESS', date,
      assignedHostIds: [dostoevsky.id], destination: { mapId: 'fortress-cell', position: { x: 7, y: 6 } },
      moves: [], resources: null, rumorId: null, unattended: true, historicalOutcomeFixed: true });
  }
  if (dostoevsky?.v47Assignment?.status === 'EN_ROUTE_TO_FORTRESS_AFTER_FIXED_ARREST'
    && dostoevsky.mapId === 'fortress-cell' && dostoevsky.v47TravelGoal?.status === 'ARRIVED') {
    dostoevsky.v47Assignment = { ...dostoevsky.v47Assignment, status: 'IN_FORTRESS_AFTER_FIXED_ARREST', arrivedAtFortressDate: date };
    event.status = 'RESOLVED';
    event.stage = 'FIXED_ARREST_AND_FORTRESS_TRANSFER_COMPLETE';
    event.npcAutonomy = { ...event.npcAutonomy, status: 'RESOLVED', closedDate: date,
      historicalDetaineeTransferComplete: true };
  }
  if (police?.v47Assignment?.eventId === event.id && police.v47TravelGoal?.actionId === 'SEARCH_LAST_KNOWN_PUBLIC_LOCATION'
    && police.mapId === 'morskaya-intersection' && police.v47TravelGoal.status === 'ARRIVED'
    && event.npcAutonomy.searchOutcome !== 'EMPTY_PUBLIC_LOCATION') {
    const hidden = ['HIDDEN_BEFORE_QUESTIONING', 'ESCAPED_BEFORE_QUESTIONING'].includes(student?.v47Questioning?.status)
      && student?.mapId === student.v47Questioning.hideMapId
      && student?.v47TravelGoal?.status === 'ARRIVED';
    if (hidden) {
      event.npcAutonomy.searchOutcome = 'EMPTY_PUBLIC_LOCATION';
      event.npcAutonomy.searchCompletedDate = date;
      event.npcAutonomy.branch = 'FICTIONAL_WITNESS_WARNED; SEARCH_FINDS_NO_WITNESS; HISTORICAL_ARRESTS_FIXED';
      police.v47Assignment = { ...police.v47Assignment, status: 'SEARCH_COMPLETE_NO_WITNESS', completedDate: date };
      if (!v47.worldChanges?.some(row => row.actionId === 'NPC_SEARCH_FINDS_NO_WITNESS')) {
        v47.worldChanges ??= [];
        v47.worldChanges.push({ questId: event.id, actionId: 'NPC_SEARCH_FINDS_NO_WITNESS', date,
          assignedHostIds: [police.id], destination: { mapId: 'morskaya-intersection' }, moves: [],
          resources: null, rumorId: null, unattended: true, searchOutcome: event.npcAutonomy.searchOutcome });
      }
    } else {
      event.npcAutonomy.searchOutcome = 'SEARCHING_LAST_KNOWN_LOCATION';
      police.v47Assignment = { ...police.v47Assignment, status: 'SEARCHING_LAST_KNOWN_LOCATION' };
    }
  }
  if (student?.v47Questioning?.status === 'ESCAPED_BEFORE_QUESTIONING'
    && student.mapId === student.v47Questioning.hideMapId && student.v47TravelGoal?.status === 'ARRIVED') {
    student.v47Questioning = { ...student.v47Questioning, status: 'HIDDEN_BEFORE_QUESTIONING', hiddenDate: date };
    event.npcAutonomy.hiddenHostIds = [student.id];
  }
  if (!student || event.playerIntervened) return;
  if (student.v47Questioning?.status === 'MOVING_WITH_SEARCH_TEAM'
    && student.mapId === 'police-station' && student.v47TravelGoal?.status === 'ARRIVED') {
    student.v47Questioning = { ...student.v47Questioning, status: 'HELD_FOR_QUESTIONING' };
    event.npcAutonomy.questionedHostIds = [student.id];
    event.npcAutonomy.branch = 'BASE_OPERATION';
  }
  if (student.v47Questioning?.status === 'HELD_FOR_QUESTIONING' && date > '1849-05-05') {
    student.v47Questioning = { ...student.v47Questioning, status: 'RELEASED_TO_FAMILY', closedDate: date,
      returnMapId: 'communal-room', returnPosition: { x: 12, y: 8 } };
    event.npcAutonomy = { ...event.npcAutonomy, branch: 'QUESTIONED_AND_RELEASED', releasedDate: date };
    v47.worldChanges ??= [];
    v47.worldChanges.push({ questId: event.id, actionId: 'NPC_QUESTIONING_CLOSED', date,
      assignedHostIds: [student.id], destination: { mapId: 'communal-room', position: { x: 12, y: 8 } },
      moves: [], resources: null, rumorId: null, unattended: true });
  }
  if (student.v47Questioning?.status === 'RELEASED_TO_FAMILY' && student.mapId === 'communal-room'
    && Math.abs(student.position.x - student.v47Questioning.returnPosition.x)
      + Math.abs(student.position.y - student.v47Questioning.returnPosition.y) <= 1) {
    student.v47Questioning = { ...student.v47Questioning, status: 'RETURNED_TO_FAMILY' };
  }
}

function advanceV47World(state, { date = state?.world?.date, clockMinutes = state?.world?.clockMinutes ?? 0 } = {}) {
  if (!state?.world || typeof date !== 'string') return state;
  const next = structuredClone(state);
  const v47 = ensureV47State(next);
  ensureHostHealth(v47, next.hosts);
  fireAnchors(v47, date, clockMinutes, next.hosts);
  for (const event of Object.values(v47.events)) {
    if (!event.autonomousOutcome || event.status !== 'ACTIVE' || event.playerIntervened) continue;
    const assigned = event.npcAutonomy?.assignedHostIds ?? [];
    event.npcAutonomy.arrivedHostIds = assigned.filter(id => next.hosts[id]?.mapId
      === (event.npcAutonomy.destinationMapByHost?.[id] ?? event.mapId));
    if (assigned.length && event.npcAutonomy.arrivedHostIds.length === assigned.length) {
      event.npcAutonomy.status = 'ASSEMBLED'; event.npcAutonomy.assembledAtMinute ??= clockMinutes;
    }
    if (date > event.scheduledGameDate || clockMinutes >= (event.npcAutonomy.deadlineMinute ?? Infinity)) {
      event.status = 'RESOLVED'; event.stage = `UNATTENDED_${event.stage}`;
      event.npcAutonomy.status = 'UNATTENDED_PENDING'; event.npcAutonomy.closedDate = date;
    }
  }
  resolveAutonomousArrestRoute(v47, next.hosts, date);
  advanceDiseaseDay(v47, next.hosts, gameDayIndex(date, clockMinutes));
  v47.cholera.lastSimulatedDate = date;
  v47.lastProcessedDate = date;
  return next;
}

function applyCholeraIntervention(state, { actionId, hostId = null, targetHostId = null, amount = 1 } = {}) {
  if (!state?.world || !['CLEAN_WATER', 'CLOSE_CONTAMINATED_FOOD', 'ADD_BEDS', 'RESTOCK_MEDICINE', 'CARE_PATIENT', 'DRINK_CONTAMINATED_WATER', 'EAT_CONTAMINATED_FOOD'].includes(actionId)) {
    return { ok: false, reason: 'unknown_cholera_action', state };
  }
  const next = structuredClone(state), v47 = ensureV47State(next), cholera = v47.cholera;
  if (cholera.status !== 'ACTIVE') return { ok: false, reason: 'cholera_event_not_active', state };
  const patientId = targetHostId ?? hostId;
  const patient = patientId ? cholera.hosts[patientId] : null;
  if (patientId && !patient) return { ok: false, reason: 'unknown_patient', state };
  const count = Math.max(1, Math.min(5, Math.floor(Number(amount) || 1)));
  const actorSource = patientId ? cholera.hosts[patientId] : null;
  let affectedSourceId = null;
  if (actionId === 'CLEAN_WATER') {
    affectedSourceId = actorSource?.waterSourceId ?? CHOLERA_WATER_IDS[0];
    const source = cholera.waterSources?.[affectedSourceId];
    if (source) { source.risk = Math.max(0.05, source.risk - 0.42); source.cleaned = true; }
    syncCholeraRisk(cholera);
  }
  if (actionId === 'CLOSE_CONTAMINATED_FOOD') {
    affectedSourceId = actorSource?.foodSourceId ?? CHOLERA_FOOD_IDS[0];
    const source = cholera.foodSources?.[affectedSourceId];
    if (source) { source.risk = Math.max(0.05, source.risk - 0.45); source.closed = true; }
    syncCholeraRisk(cholera);
  }
  if (actionId === 'ADD_BEDS') cholera.beds = Math.min(12, cholera.beds + count);
  if (actionId === 'RESTOCK_MEDICINE') cholera.medicineStock = Math.min(30, cholera.medicineStock + count);
  if (actionId === 'CARE_PATIENT') {
    if (!['E', 'I'].includes(patient.state) || cholera.medicineStock < 1) return { ok: false, reason: 'care_unavailable', state };
    cholera.medicineStock -= 1;
    patient.careDays = Math.max(patient.careDays, 4);
    patient.severity = 'UNDER_CARE';
    setCholeraHealth(next.hosts[patientId], { severity: 'UNDER_CARE', care: 'CARE_RECEIVED',
      onsetMinute: next.hosts[patientId].healthState?.illness?.onsetMinute ?? 0 });
  }
  if (actionId === 'DRINK_CONTAMINATED_WATER' || actionId === 'EAT_CONTAMINATED_FOOD') {
    affectedSourceId = actionId === 'DRINK_CONTAMINATED_WATER' ? patient.waterSourceId : patient.foodSourceId;
    const risk = actionId === 'DRINK_CONTAMINATED_WATER'
      ? cholera.waterSources?.[affectedSourceId]?.risk ?? cholera.waterRisk
      : cholera.foodSources?.[affectedSourceId]?.risk ?? cholera.foodRisk;
    if (patient.state !== 'S' || risk < 0.25) return { ok: false, reason: 'exposure_not_available', state };
    patient.state = 'E'; patient.exposedDays = 0; patient.lastExposure = state.world.date;
    patient.source = actionId === 'DRINK_CONTAMINATED_WATER' ? `WATER_SOURCE:${affectedSourceId}` : `FOOD_SOURCE:${affectedSourceId}`;
    patient.severity = 'EXPOSED';
    setCholeraHealth(next.hosts[patientId], { severity: 'EXPOSED', care: 'AWAITING_CARE' });
    cholera.counters.exposures += 1;
  }
  cholera.interventions.push({ actionId, hostId, targetHostId: patientId, sourceId: affectedSourceId, areaId: actorSource?.areaId ?? null, date: state.world.date, amount: count });
  next.world.worldFlags ??= {};
  next.world.worldFlags[`V47_${actionId}`] = true;
  if (['CLEAN_WATER', 'CLOSE_CONTAMINATED_FOOD', 'ADD_BEDS', 'RESTOCK_MEDICINE', 'CARE_PATIENT'].includes(actionId)) {
    v47.stories.MAIN05.consequences.push({ actionId, hostId, date: state.world.date });
  }
  return { ok: true, state: next };
}

const V47MainStories = { WORLD_EVENT_ANCHORS, STORY_GUIDANCE, createV47State, registerStoryBeats, advanceV47World, applyCholeraIntervention, getV47MissionQuest, getV47CompletionGuidance, julianDateToGregorian };
if (typeof module !== 'undefined' && module.exports) module.exports = V47MainStories;
globalThis.V47MainStories = V47MainStories;
