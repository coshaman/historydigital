'use strict';

const SAVE_VERSION = 37;
const DIRECTIONS = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] });
const RENT_LIVING_EVENT = Object.freeze({ catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E01', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED' });
const WEATHER_EXPOSED_MAPS = new Set(['nevsky', 'courtyard', 'market-quay', 'canal-road', 'workyard', 'bookshop-lane']);
const WEATHER_BY_SEASON = Object.freeze({
  winter: ['snow', 'snow', 'fog', 'wind', 'overcast'], spring: ['drizzle', 'fog', 'overcast', 'overcast', 'clear'],
  summer: ['drizzle', 'overcast', 'clear', 'clear', 'fog'], autumn: ['drizzle', 'fog', 'fog', 'overcast', 'wind'],
});
function outdoorWeatherForState(state) {
  const date = state.world.date, month = Number(date?.slice?.(5, 7));
  const season = month === 12 || month <= 2 ? 'winter' : month <= 5 ? 'spring' : month <= 8 ? 'summer' : 'autumn';
  const day = Math.max(0, Math.floor((state.world.clockMinutes ?? 0) / 1440));
  let seed = 17 + day * 31 + month * 13;
  for (const char of String(date ?? '')) seed = (seed * 33 + char.charCodeAt(0)) % 104729;
  return WEATHER_BY_SEASON[season][seed % WEATHER_BY_SEASON[season].length];
}
function outdoorWeatherFatiguePerMinute(state, host) {
  if (!WEATHER_EXPOSED_MAPS.has(host.mapId)) return 0;
  return ({ snow: 0.025, wind: 0.02, drizzle: 0.01, fog: 0.004, overcast: 0.002 })[outdoorWeatherForState(state)] ?? 0;
}

function runtimeEraProfile(card) {
  if (card.eraProfile) return clone(card.eraProfile);
  if (card.kind === 'LITERARY') {
    const realmId = Object.keys(card.objectiveByChapter ?? {})[0] ?? null;
    return { layer: 'LITERARY', allowedChapterIds: realmId ? [realmId] : [], realmId, mapId: card.start?.mapId ?? null, sourceIds: [] };
  }
  if (card.kind === 'HISTORICAL_RECONSTRUCTION') {
    return { layer: 'HISTORICAL_RECONSTRUCTION', allowedChapterIds: Object.keys(card.objectiveByChapter ?? {}).filter(id => id.startsWith('V33_')), realmId: null, mapId: null, sourceIds: [] };
  }
  return { layer: 'FICTIONAL_1840S', allowedChapterIds: ['V33_1847_PRINT', 'V33_1848_PUBLIC', 'V33_1849_CIRCLE'], realmId: null, mapId: null, sourceIds: [] };
}

function layer(map, name) { return map?.layers?.find(item => item.name === name); }
function properties(object) { return Object.fromEntries((object?.properties ?? []).map(item => [item.name, item.value])); }
function tileAt(dataLayer, x, y) {
  if (!dataLayer || x < 0 || y < 0 || x >= dataLayer.width || y >= dataLayer.height) return 1;
  return Number(dataLayer.data[y * dataLayer.width + x] ?? 0);
}
function nearTile(position, tile, maxDistance = 1) {
  return Math.abs(position.x - tile.x) + Math.abs(position.y - tile.y) <= maxDistance;
}
function clearLineOfSight(map, from, to) {
  const collision = layer(map, 'Collision');
  if (!collision) return true;
  let x = from.x, y = from.y;
  const dx = Math.abs(to.x - from.x), sx = from.x < to.x ? 1 : -1;
  const dy = -Math.abs(to.y - from.y), sy = from.y < to.y ? 1 : -1;
  let error = dx + dy;
  while (x !== to.x || y !== to.y) {
    const doubled = 2 * error;
    if (doubled >= dy) { error += dy; x += sx; }
    if (doubled <= dx) { error += dx; y += sy; }
    if ((x !== to.x || y !== to.y) && tileAt(collision, x, y) !== 0) return false;
  }
  return true;
}
function playerCanObserveWorldEvent(state, mapId, position, maxDistance = 6, maps = null) {
  return Boolean(state?.world?.currentMapId === mapId && state?.player?.position
    && position && nearTile(state.player.position, position, maxDistance)
    && (!maps?.[mapId] || clearLineOfSight(maps[mapId], state.player.position, position)));
}
function objectTile(object) { return { x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) }; }
function clone(value) { return structuredClone(value); }
function mapAccessFailure(map, host, absoluteMinute) {
  const access = map?.metadata?.access;
  if (!access) return null;
  if (!host) return 'person_required';
  if (Array.isArray(access.allowedCharacterIds) && !access.allowedCharacterIds.includes(host.id)) return 'host_lacks_access';
  if (Array.isArray(access.allowedEstates) && !access.allowedEstates.includes(host.socialEstate)) return 'host_lacks_access';
  if (Number.isInteger(access.opensMinute) && Number.isInteger(access.closesMinute)) {
    const minute = ((absoluteMinute % 1440) + 1440) % 1440;
    const open = access.opensMinute <= access.closesMinute
      ? minute >= access.opensMinute && minute < access.closesMinute
      : minute >= access.opensMinute || minute < access.closesMinute;
    if (!open) return 'closed_hours';
  }
  return null;
}
function initialLearningState() {
  return { phase: 'circle-choice', circleLearning: null, lessonIndex: 0, examAnswers: {}, examOutcome: 'unset', examCorrectCount: null, promotionStatus: 'pending', timelineIndex: 0 };
}
function initialNpcNeeds(card, clockMinutes = 540) {
  const profile = card.needs ?? {};
  const manualWork = /노동|운반|세탁|마부|제빵|활자|판매|장사|하인|수선|수위|짐|마차|시장/.test(card.occupation ?? '');
  const scarcity = ['poor', 'modest'].includes(card.wealthBracket);
  return { hunger: Number.isFinite(profile.hunger) ? profile.hunger : scarcity ? 38 : 28, fatigue: Number.isFinite(profile.fatigue) ? profile.fatigue : manualWork ? 24 : 14,
    incomePressure: Number.isFinite(profile.income) ? profile.income : (scarcity ? 62 : 28),
    safetyConcern: Number.isFinite(profile.safety) ? profile.safety : 25,
    socialNeed: Number.isFinite(profile.socialBelonging) ? profile.socialBelonging : 30,
    restThreshold: Number.isFinite(profile.restThreshold) ? profile.restThreshold : 72,
    hungerPerMinute: Number.isFinite(profile.hungerPerMinute) ? profile.hungerPerMinute : 0.035,
    workFatiguePerMinute: Number.isFinite(profile.workFatiguePerMinute) ? profile.workFatiguePerMinute : manualWork ? 0.028 : 0.018,
    restFatigueReliefPerMinute: Number.isFinite(profile.restFatigueReliefPerMinute) ? profile.restFatigueReliefPerMinute : 0.06,
    incomeReliefPerMinute: Number.isFinite(profile.incomeReliefPerMinute) ? profile.incomeReliefPerMinute : 0.002,
    foodDeprivationMinutes: 0,
    lastMealAtMinute: clockMinutes };
}

function activeMealSeekingCauseEventId(host, state) {
  const sourceEventId = host.needs?.mealSeekingCauseEventId;
  if (!sourceEventId) return null;
  if (sourceEventId !== 'E14' || !Number.isInteger(host.needs.mealSeekingCauseExpiresAtMinute)
    || state.world.clockMinutes > host.needs.mealSeekingCauseExpiresAtMinute) {
    delete host.needs.mealSeekingCauseEventId;
    delete host.needs.mealSeekingCauseExpiresAtMinute;
    return null;
  }
  return sourceEventId;
}

function noteFoodConsumed(host, state) {
  host.needs.foodDeprivationMinutes = 0;
  delete host.needs.mealSeekingCauseEventId;
  delete host.needs.mealSeekingCauseExpiresAtMinute;
  if (host.healthState?.condition === 'UNWELL' && host.healthState.illness?.id === 'FOOD_DEPRIVATION') {
    host.healthState = { condition: 'RECOVERING', injury: null,
      illness: { ...host.healthState.illness, care: 'FOOD_RESTORED' },
      recoveryUntilMinute: state.world.clockMinutes + 180, valueStatus: 'FICTIONAL_CHARACTER_DESIGN' };
  }
}

function advanceFoodDeprivation(state, minuteOffset, maps, careRows) {
  for (const host of Object.values(state.hosts)) {
    host.needs ??= initialNpcNeeds(host, state.world.clockMinutes);
    if (host.needs.hunger < 100) { host.needs.foodDeprivationMinutes = 0; continue; }
    host.needs.foodDeprivationMinutes = Math.min(360, (host.needs.foodDeprivationMinutes ?? 0) + 1);
    if (host.needs.foodDeprivationMinutes < 360 || host.healthState?.condition !== 'FIT') continue;
    host.healthState = { condition: 'UNWELL', injury: null,
      illness: { id: 'FOOD_DEPRIVATION', severity: 'MILD', onsetMinute: state.world.clockMinutes,
        care: 'NEEDS_FOOD', valueStatus: 'FICTIONAL_CHARACTER_DESIGN' }, recoveryUntilMinute: null,
      valueStatus: 'FICTIONAL_CHARACTER_DESIGN' };
    careRows.push({ kind: 'FOOD_DEPRIVATION', hostId: host.id, hunger: host.needs.hunger,
      deprivationMinutes: host.needs.foodDeprivationMinutes, minute: minuteOffset, mapId: host.mapId,
      position: { ...host.position }, witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps) });
  }
}

function authoredRoutinePlaces(card) {
  const schedule = [...(card.schedule ?? [])].sort((a, b) => a.atMinute - b.atMinute);
  const placeFrom = slot => slot && typeof slot.mapId === 'string' && Number.isInteger(slot.position?.x) && Number.isInteger(slot.position?.y)
    ? { mapId: slot.mapId, position: { ...slot.position }, scheduledMinute: slot.atMinute,
      activityKo: slot.activityKo ?? '', provenance: 'FICTIONAL_CHARACTER_SCHEDULE' }
    : null;
  const workSlots = schedule.filter(slot => slot.workAction || slot.task?.type === 'WORK');
  const homeSlot = schedule.find(slot => /셋방에서|방에서 잠시 쉬|안뜰 방에서|하숙집 안뜰에 머문|집에서 수업|방으로 돌아가/.test(slot.activityKo ?? ''));
  const sleepSlots = schedule.filter(slot => /잠자|잠든|취침|잠시 쉰/.test(slot.activityKo ?? ''));
  const housing = card.housing;
  const householdHome = card.household?.homeLocation;
  const residence = card.residence;
  const homeLocation = householdHome && typeof householdHome.mapId === 'string' && Number.isInteger(householdHome.position?.x) && Number.isInteger(householdHome.position?.y)
    ? { mapId: householdHome.mapId, position: { ...householdHome.position }, kind: 'SHARED_HOUSEHOLD',
      householdId: card.household.id, unitLabelKo: card.household.unitLabelKo, provenance: card.household.status }
    : housing && typeof housing.mapId === 'string' && Number.isInteger(housing.position?.x) && Number.isInteger(housing.position?.y)
    ? { mapId: housing.mapId, position: { ...housing.position }, kind: housing.kind, provenance: housing.valueStatus ?? 'FICTIONAL_CHARACTER_DESIGN' }
    : residence?.homeLocation && typeof residence.homeLocation.mapId === 'string'
    ? { mapId: residence.homeLocation.mapId, position: { ...residence.homeLocation.position }, kind: residence.kind,
      unitLabelKo: residence.unitLabelKo, provenance: residence.status, valueStatus: residence.valueStatus }
    : placeFrom(homeSlot);
  const sleepLocations = [...sleepSlots.map(placeFrom).filter(Boolean)];
  if (residence?.sleepLocation && !sleepLocations.some(place => place.mapId === residence.sleepLocation.mapId
    && place.position?.x === residence.sleepLocation.position?.x && place.position?.y === residence.sleepLocation.position?.y)) {
    sleepLocations.push({ mapId: residence.sleepLocation.mapId, position: { ...residence.sleepLocation.position },
      scheduledMinute: residence.sleepMinute ?? 1320, activityKo: residence.kind === 'STREET_SLEEPER' ? '거리에서 잠을 청한다' : '거처에서 잠을 잔다',
      provenance: residence.status });
  }
  const homeLocationStatus = residence?.kind === 'STREET_SLEEPER' ? 'FICTIONAL_HOMELESSNESS_DESIGN'
    : residence?.homeLocation ? 'AUTHORED_FICTIONAL_RESIDENCE'
      : card.household ? 'AUTHORED_FICTIONAL_HOUSEHOLD' : housing ? 'AUTHORED_HOUSING_RECORD'
        : homeSlot ? 'SCHEDULE_DERIVED_FICTIONAL_CUE' : 'NOT_AUTHORED';
  return {
    homeLocation,
    homeLocationStatus,
    residenceKind: residence?.kind ?? (card.household ? 'SHARED_HOUSEHOLD' : housing?.kind ?? null),
    workLocations: workSlots.map(slot => ({ ...placeFrom(slot), workActionId: slot.workAction?.id ?? slot.task?.id ?? null }))
      .filter(place => place.mapId),
    sleepLocations,
    status: 'FICTIONAL_GAMEPLAY_PROFILE',
  };
}

function authoredDailySchedule(card) {
  const schedule = clone(card.schedule ?? []);
  const sleepLocation = card.residence?.sleepLocation ?? authoredRoutinePlaces(card).homeLocation;
  const sleepMinute = card.residence?.sleepMinute ?? 1320;
  if (sleepLocation && !schedule.some(slot => slot.atMinute === sleepMinute)) {
    schedule.push({ atMinute: sleepMinute, mapId: sleepLocation.mapId, position: { ...sleepLocation.position },
      activityKo: card.residence?.kind === 'STREET_SLEEPER' ? '거처 없이 거리에서 잠을 청한다' : '오늘 일을 마치고 거처에서 잠을 잔다',
      routineKind: 'FICTIONAL_HOME_SLEEP', valueStatus: card.residence?.valueStatus ?? 'FICTIONAL_CHARACTER_DESIGN' });
  }
  return schedule.sort((a, b) => a.atMinute - b.atMinute);
}

function validateAuthoredResidences(hostCards, maps) {
  for (const card of hostCards) {
    const residence = card.residence;
    if (!residence) continue;
    const sleep = residence.sleepLocation, sleepMap = maps[sleep?.mapId];
    const home = residence.homeLocation, homeMap = home ? maps[home.mapId] : null;
    const isStreetSleeper = residence.kind === 'STREET_SLEEPER';
    if (residence.status !== 'FICTIONAL_CHARACTER_DESIGN' || residence.valueStatus !== 'FICTIONAL_GAMEPLAY_DESIGN'
      || typeof residence.unitLabelKo !== 'string' || !residence.unitLabelKo.trim()
      || typeof residence.designBasisKo !== 'string' || !residence.designBasisKo.trim()
      || !Number.isInteger(residence.sleepMinute) || residence.sleepMinute < 1020 || residence.sleepMinute > 1380
      || !sleepMap || !['REAL_WORLD_RECONSTRUCTION', 'FICTIONAL_CIVIC_RECONSTRUCTION'].includes(sleepMap.metadata?.mapClass)
      || !Number.isInteger(sleep?.position?.x) || !Number.isInteger(sleep?.position?.y)
      || tileAt(layer(sleepMap, 'Collision'), sleep.position.x, sleep.position.y) !== 0
      || (isStreetSleeper ? home !== null : (!homeMap || !['REAL_WORLD_RECONSTRUCTION', 'FICTIONAL_CIVIC_RECONSTRUCTION'].includes(homeMap.metadata?.mapClass)
        || home.mapId !== sleep.mapId || home.position?.x !== sleep.position.x || home.position?.y !== sleep.position.y
        || tileAt(layer(homeMap, 'Collision'), home.position.x, home.position.y) !== 0))
      || !Array.isArray(card.allowedMaps) || !card.allowedMaps.includes(sleep.mapId)) {
      throw new Error(`Invalid fictional residence/sleep profile: ${card.id}`);
    }
  }
}

function authoredRelationshipEdges(card, hostCards) {
  const edges = Object.entries(card.relations ?? {}).flatMap(([targetHostId, descriptionKo]) => {
    if (!hostCards.some(target => target.id === targetHostId) || typeof descriptionKo !== 'string' || !descriptionKo.trim()) return [];
    const reciprocal = hostCards.find(target => target.id === targetHostId)?.relations?.[card.id];
    return [{ edgeId: `SOCIAL:${card.id}:${targetHostId}`, fromHostId: card.id, toHostId: targetHostId,
      kind: 'AUTHORED_SOCIAL_TIE', descriptionKo, reciprocalEdgeId: typeof reciprocal === 'string' ? `SOCIAL:${targetHostId}:${card.id}` : null,
      knownByHostIds: [card.id], status: 'FICTIONAL_CHARACTER_DESIGN' }];
  });
  for (const relation of card.kinshipRelations ?? []) {
    const target = hostCards.find(person => person.id === relation.targetHostId);
    if (!target || !['SIBLING', 'PARENT', 'CHILD', 'SPOUSE', 'OTHER_KIN'].includes(relation.kind)
      || typeof relation.relationshipKo !== 'string' || !relation.relationshipKo.trim()
      || relation.status !== 'FICTIONAL_CHARACTER_DESIGN') continue;
    const reciprocal = (target.kinshipRelations ?? []).some(item => item.targetHostId === card.id);
    edges.push({ edgeId: `KINSHIP:${card.id}:${target.id}`, fromHostId: card.id, toHostId: target.id, kind: 'KINSHIP',
      relationshipType: relation.kind, descriptionKo: relation.relationshipKo,
      reciprocalEdgeId: reciprocal ? `KINSHIP:${target.id}:${card.id}` : null,
      knownByHostIds: [card.id], status: 'FICTIONAL_CHARACTER_DESIGN' });
  }
  for (const memberId of card.household?.memberHostIds ?? []) {
    if (memberId === card.id || !hostCards.some(person => person.id === memberId)) continue;
    edges.push({ edgeId: `HOUSEHOLD:${card.household.id}:${card.id}:${memberId}`, fromHostId: card.id, toHostId: memberId,
      kind: 'HOUSEHOLD_MEMBER', descriptionKo: `${card.household.unitLabelKo}를 함께 쓰는 식구`, householdId: card.household.id,
      reciprocalEdgeId: `HOUSEHOLD:${card.household.id}:${memberId}:${card.id}`, knownByHostIds: [card.id],
      status: card.household.status });
  }
  for (const tenant of hostCards) {
    const contract = tenant.housing;
    if (contract?.kind !== 'RENT' || !contract.landlordHostId || ![tenant.id, contract.landlordHostId].includes(card.id)) continue;
    if (!hostCards.some(target => target.id === contract.landlordHostId)) continue;
    edges.push({ edgeId: `HOUSING:${tenant.id}:${contract.landlordHostId}`, fromHostId: tenant.id, toHostId: contract.landlordHostId,
      kind: 'RENTAL_OBLIGATION', descriptionKo: '임대차 계약 당사자', contractOwnerHostId: tenant.id,
      knownByHostIds: [tenant.id, contract.landlordHostId], status: contract.valueStatus ?? 'FICTIONAL_GAMEPLAY_BALANCE' });
  }
  return edges;
}

function validateAuthoredHouseholdProfiles(hostCards, maps) {
  const byId = new Map(hostCards.map(card => [card.id, card]));
  const kinshipKinds = new Set(['SIBLING', 'PARENT', 'CHILD', 'SPOUSE', 'OTHER_KIN']);
  for (const card of hostCards) {
    for (const relation of card.kinshipRelations ?? []) {
      if (!byId.has(relation.targetHostId) || relation.targetHostId === card.id || !kinshipKinds.has(relation.kind)
        || typeof relation.relationshipKo !== 'string' || relation.status !== 'FICTIONAL_CHARACTER_DESIGN') {
        throw new Error(`Invalid fictional kinship profile: ${card.id}`);
      }
    }
    const household = card.household;
    if (!household) continue;
    const home = household.homeLocation, map = maps[home?.mapId], members = household.memberHostIds;
    if (household.status !== 'FICTIONAL_CHARACTER_DESIGN' || typeof household.id !== 'string' || !household.id
      || typeof household.unitLabelKo !== 'string' || !household.unitLabelKo.trim() || !Array.isArray(members)
      || !members.includes(card.id) || new Set(members).size !== members.length || members.some(id => !byId.has(id))
      || !map || map.metadata?.mapClass !== 'REAL_WORLD_RECONSTRUCTION'
      || !Number.isInteger(home.position?.x) || !Number.isInteger(home.position?.y)
      || tileAt(layer(map, 'Collision'), home.position.x, home.position.y) !== 0) {
      throw new Error(`Invalid fictional household profile: ${card.id}`);
    }
    for (const memberId of members) {
      const member = byId.get(memberId), other = member.household, otherHome = other?.homeLocation;
      if (other?.id !== household.id || other.status !== household.status || other.unitLabelKo !== household.unitLabelKo
        || JSON.stringify(other.memberHostIds) !== JSON.stringify(members)
        || otherHome?.mapId !== home.mapId || otherHome?.position?.x !== home.position.x || otherHome?.position?.y !== home.position.y) {
        throw new Error(`Household members do not share one authored home: ${household.id}`);
      }
    }
  }
}

function recordRelationshipMeeting(host, partner, minute, date, mapId) {
  const update = (person, other) => {
    person.relationshipMemory ??= {};
    const previous = person.relationshipMemory[other.id] ?? { meetingCount: 0, firstMetAtMinute: minute };
    const meetingCount = previous.meetingCount + 1;
    const familiarity = meetingCount >= 10 ? '꾸준히 만나는 사이' : meetingCount >= 5 ? '자주 마주치는 사이'
      : meetingCount >= 2 ? '얼굴을 익힌 사이' : '첫 대화를 나눈 사이';
    person.relationshipMemory[other.id] = { meetingCount, firstMetAtMinute: previous.firstMetAtMinute,
      lastMetAtMinute: minute, lastMetDate: date, lastMetMapId: mapId, familiarity };
    return person.relationshipMemory[other.id];
  };
  return { host: update(host, partner), partner: update(partner, host) };
}

function rentBillingIntervalDays(contract) {
  return Number.isInteger(contract?.billingIntervalDays) && contract.billingIntervalDays > 0 ? contract.billingIntervalDays : 1;
}
function nextRentDueDay(contract) {
  if (Number.isInteger(contract?.nextDueDayIndex)) return contract.nextDueDayIndex;
  if (Number.isInteger(contract?.lastSettledDayIndex)) return contract.lastSettledDayIndex + rentBillingIntervalDays(contract);
  return Number.isInteger(contract?.startDayIndex) ? contract.startDayIndex : 0;
}

function migrateRelationshipEdges(state, hostCards) {
  for (const card of hostCards) {
    const host = state.hosts?.[card.id];
    if (!host) continue;
    host.relationshipEdges ??= [];
    if (!Array.isArray(host.relationshipEdges)) throw new Error(`Save contains invalid relationship edges: ${card.id}`);
    const expectedEdges = authoredRelationshipEdges(card, hostCards), expectedById = new Map(expectedEdges.map(edge => [edge.edgeId, edge]));
    const edgeIds = new Set();
    for (const edge of host.relationshipEdges) {
      if (!edge || typeof edge.edgeId !== 'string' || edgeIds.has(edge.edgeId)) throw new Error(`Save contains invalid relationship edge: ${card.id}`);
      edgeIds.add(edge.edgeId);
    }
    for (const edge of expectedEdges) if (!edgeIds.has(edge.edgeId)) {
      host.relationshipEdges.push(clone(edge));
      edgeIds.add(edge.edgeId);
    }
    for (const edge of host.relationshipEdges) {
      const expected = expectedById.get(edge.edgeId);
      if (!expected || edge.fromHostId !== expected.fromHostId || edge.toHostId !== expected.toHostId || edge.kind !== expected.kind
        || edge.descriptionKo !== expected.descriptionKo || edge.reciprocalEdgeId !== expected.reciprocalEdgeId
        || edge.relationshipType !== expected.relationshipType || edge.householdId !== expected.householdId
        || edge.contractOwnerHostId !== expected.contractOwnerHostId || edge.status !== expected.status
        || !Array.isArray(edge.knownByHostIds) || edge.knownByHostIds.length !== expected.knownByHostIds.length
        || edge.knownByHostIds.some((id, index) => id !== expected.knownByHostIds[index])) {
        throw new Error(`Save contains invalid relationship edge: ${card.id}`);
      }
    }
  }
}

function syncPersistentPersonalGoals(state, hostId) {
  const host=state.hosts?.[hostId];
  if(!host)return;
  host.personalGoalProgress??={};
  for(const goal of host.personalGoals??[]){
    const condition=goal.successCondition??{},progress=host.personalGoalProgress[goal.id]??{status:'ACTIVE'};
    let satisfied=progress.status==='SATISFIED';
    if(condition.type==='LIFE_CHAIN_COMPLETED')satisfied ||= (state.world.lifeChains?.[condition.chainId]?.stage??0)>=condition.stageCount;
    if(condition.type==='RELATION_CHANGED')satisfied ||= Boolean(host.relations?.[condition.targetHostId]&&host.relations[condition.targetHostId]!==condition.baseline);
    host.personalGoalProgress[goal.id]=satisfied?{...progress,status:'SATISFIED',satisfiedAt:progress.satisfiedAt??state.world.date}:{...progress,status:'ACTIVE'};
  }
}

function createInitialState({ maps, hostCards, quests = [], startMapId = 'nevsky', simulationSeed = 0 }) {
  if (!maps?.[startMapId] || !Array.isArray(hostCards) || hostCards.length < 1) throw new Error('A known start map and host cards are required');
  const seed = Number.isSafeInteger(simulationSeed) ? simulationSeed : 0;
  validateAuthoredHouseholdProfiles(hostCards, maps);
  validateAuthoredResidences(hostCards, maps);
  const map = maps[startMapId];
  const initialDate = map.metadata?.date ?? '1847-06-01';
  const spawn = map.metadata?.observerStart ?? { x: 2, y: 2 };
  const hosts = Object.fromEntries(hostCards.map(card => [card.id, {
    id: card.id,
    kind: card.kind,
    eraProfile: runtimeEraProfile(card),
    presenceWindow: card.presenceWindow ? clone(card.presenceWindow) : null,
    socialEstate: card.socialEstate,
    mapId: card.start.mapId,
    position: { x: card.start.x, y: card.start.y },
    schedule: authoredDailySchedule(card),
    scheduleId: null,
    plannedPath: { key: null, tiles: [] },
    mapRoutePlan: { key: null, route: null },
    currentActivityKo: '',
    routineState: { state: 'IDLE', activityKo: '', targetMapId: card.start.mapId, targetPosition: { x: card.start.x, y: card.start.y }, changedAtMinute: 540, minutesInState: 0 },
    activeGoal: null,
    needs: (() => {
      const needs = initialNpcNeeds(card);
      if (seed === 0) return needs;
      for (const key of ['hunger', 'fatigue', 'socialNeed']) {
        const offset = Number.parseInt(hashText(`${seed}:${card.id}:${key}`), 16) % 3 - 1;
        needs[key] = Math.max(0, Math.min(100, needs[key] + offset));
      }
      return needs;
    })(),
    situationNotes: [],
    facing: 'down',
    historicalAliveAndPresent: !card.presenceWindow || (card.presenceWindow.startDate <= initialDate && initialDate <= card.presenceWindow.endDate),
    healthState: { condition: 'FIT', injury: null, recoveryUntilMinute: null, valueStatus: 'FICTIONAL_CHARACTER_DESIGN' },
    skills: clone(card.skills ?? {}),
    skillsValueStatus: card.skillsValueStatus ?? 'FICTIONAL_CHARACTER_DESIGN',
    money: { ...card.money },
    marketOffers: clone(card.marketOffers ?? []),
    marketStock: clone(card.marketStock ?? {}),
    housing: card.housing ? clone(card.housing) : null,
    residence: card.residence ? clone(card.residence) : null,
    places: authoredRoutinePlaces(card),
    pendingWageClaims: [],
    inventory: [...card.inventory],
    privateKnowledgeIds: [...card.privateKnowledgeIds],
    witnessedKnowledgeIds: [],
    knownEvidenceIds: [...card.knownEvidenceIds],
    knownRumors: [],
    relations: clone(card.relations ?? {}),
    relationshipEdges: authoredRelationshipEdges(card, hostCards),
    relationshipMemory: {},
    objective: card.personalObjective,
    todayGoals: clone(card.todayGoals ?? []),
    plannerPolicy: clone(card.plannerPolicy ?? {}),
    personalGoals: clone(card.persistentPersonalGoals ?? []),
    personalGoalProgress: Object.fromEntries((card.persistentPersonalGoals ?? []).map(goal => [goal.id, { status: 'ACTIVE' }])),
    questFlags: {},
    timeBudget: card.timeBudget ?? 4,
    allowedMaps: [...card.allowedMaps],
    releaseLocked: false,
  }]));
  for (const host of Object.values(hosts)) {
    const slot = scheduleEntry(host, 540);
    if (slot) { host.scheduleId = `${slot.mapId}:${slot.atMinute}`; host.currentActivityKo = slot.activityKo ?? ''; }
  }
  const isLiteraryQuest = quest => Boolean(quest.realmId) || quest.chapterId?.startsWith('LITERARY_');
  const questsWithOutcome = quests.filter(quest => quest.historicalOutcome?.id);
  const immutableOutcomes = Object.fromEntries(questsWithOutcome.filter(quest => !isLiteraryQuest(quest)).map(quest => [quest.historicalOutcome.id, quest.historicalOutcome.value]));
  const literaryOutcomes = Object.fromEntries(questsWithOutcome.filter(isLiteraryQuest).map(quest => [quest.historicalOutcome.id, quest.historicalOutcome.value]));
  return {
    version: SAVE_VERSION,
    world: {
      chapterId: 'V33_1847_PRINT',
      date: initialDate,
      simulationSeed: seed,
      currentMapId: startMapId,
      clockMinutes: 540,
      discoveredSourceIds: [],
      witnessedFacts: [],
      worldFlags: {},
      lifeChains: {},
      marketPriceModifiers: {},
      livingEventStates: {},
      rumorPropagationLog: [],
      foodAidRecords: [],
      immutableOutcomes,
      literaryOutcomes,
      possessionHistory: [],
      completedChapterIds: [],
    },
    player: { position: { x: spawn.x, y: spawn.y }, facing: 'down', embodiment: null, currentGoals: [], observedEvidenceIds: [], crossPerspectiveNotes: [], civic: { suspicion: 0, custody: null, publishedIssues: [], readIssueIds: [], circulatedIssues: [] }, dialogueGrowth: { insight: 0, aiReplies: 0, perspectiveNotes: [], comparisonNotes: [], reflectionIds: [], playerPositions: [] }, gameSaveVersion: SAVE_VERSION },
    hosts,
    quests: Object.fromEntries(quests.map(quest => [quest.id, { status: 'open', result: null }])),
    learning: initialLearningState(),
    ledger: [],
    ledgerDigest: hashText('V36_LEDGER'),
    ledgerDigestCount: 0,
    activeDialogue: null,
  };
}

function scheduleEntry(host, clockMinutes) {
  const schedule = [...(host.schedule ?? [])].sort((a, b) => a.atMinute - b.atMinute);
  const minute = ((clockMinutes % 1440) + 1440) % 1440;
  return [...schedule].reverse().find(item => item.atMinute <= minute) ?? schedule[0] ?? null;
}
function taskCompletedForDay(host, task, dayIndex) {
  if (task?.repeatDaily === true) return host.completedSocialTaskDayById?.[task.id] === dayIndex;
  return host.routineTaskCompletedId === task?.id || host.completedSocialTaskIds?.includes(task?.id);
}
function pendingTaskSlot(host, taskTypes, localMinute, dayIndex = 0) {
  const types = new Set(Array.isArray(taskTypes) ? taskTypes : [taskTypes]);
  return [...(host.schedule ?? [])]
    .filter(slot => slot.atMinute <= localMinute && types.has(slot.task?.type)
      && !taskCompletedForDay(host, slot.task, dayIndex)
      && (slot.task.type === 'CARE_TRANSFER' || (typeof slot.task.itemKo === 'string' && host.inventory?.includes(slot.task.itemKo))))
    .sort((a, b) => b.atMinute - a.atMinute)[0] ?? null;
}
function canMakeAuthoredCareTransfer(state, giver, task) {
  const recipient = state.hosts[task?.recipientHostId], amount = task?.moneyAmount;
  const kinship = giver?.relationshipEdges?.some(edge => edge.kind === 'KINSHIP' && edge.toHostId === recipient?.id
    && edge.relationshipType === 'SIBLING' && edge.status === 'FICTIONAL_CHARACTER_DESIGN');
  return Boolean(recipient && kinship && giver.places?.homeLocation?.householdId
    && giver.places.homeLocation.householdId === recipient.places?.homeLocation?.householdId
    && Number.isInteger(amount) && amount > 0 && Number.isFinite(giver.money?.amount) && Number.isFinite(recipient.money?.amount)
    && giver.money.unit === recipient.money.unit && giver.money.amount - amount >= (task.donorReserve ?? 0)
    && recipient.money.amount <= (task.recipientMaximum ?? 0));
}
function isMarketOfferOpen(seller, offer, absoluteMinute) {
  if (!seller || !offer || seller.mapId !== offer.mapId || !Array.isArray(offer.openWindows)) return false;
  const minute = ((absoluteMinute % 1440) + 1440) % 1440;
  return offer.openWindows.some(window => Number.isInteger(window.startMinute) && Number.isInteger(window.endMinute)
    && window.startMinute <= minute && minute < window.endMinute);
}
function marketOfferPrice(state, seller, offer) {
  const surcharge = Number(state?.world?.marketPriceModifiers?.[`${seller?.id}:${offer?.itemKo}`] ?? 0);
  return Number.isInteger(offer?.price) && Number.isInteger(surcharge) && surcharge >= 0 ? offer.price + surcharge : Number.NaN;
}
function livingMarketEventRow(state, stage, actorHostIds, mapId, position, minute, maps, details = {}) {
  const seller = state.hosts.market_nadezhda;
  const offer = seller?.marketOffers?.find(item => item.itemKo === '빵 한 묶음');
  const event = state.world.livingEventStates?.E02;
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E02', stage, stageIndex: ({ PRICE_NOTICE: 1, RESTOCKED: 2, FIRST_PURCHASE: 3 })[stage],
    actorHostIds: [...new Set(actorHostIds.filter(Boolean))], date: state.world.date, minute, mapId, position: { ...position },
    itemKo: '빵 한 묶음', basePrice: offer?.price ?? null, currentPrice: marketOfferPrice(state, seller, offer),
    valueStatus: 'fictional_gameplay_balance', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED', state: event ? { ...event } : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, mapId, position, 6, maps), ...details };
}
function livingLaundryEventRow(state, stage, actorHostIds, mapId, position, minute, maps, details = {}) {
  const event = state.world.livingEventStates?.E04;
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E04', stage,
    stageIndex: ({ LINEN_WASHED: 1, LINEN_EXCHANGED: 2, ACCOUNTS_RECONCILED: 3 })[stage],
    actorHostIds: [...new Set(actorHostIds.filter(Boolean))], date: state.world.date, minute, mapId, position: { ...position },
    itemKo: '접은 린넨', valueStatus: 'fictional_gameplay_balance',
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED', state: event ? { ...event } : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, mapId, position, 6, maps), ...details };
}
function rentCatalogEventRow(state, stage, row, minute, maps, details = {}) {
  const event = state.world.livingEventStates?.E01;
  return { ...RENT_LIVING_EVENT, stage, stageIndex: ({ DUE_NOTICE: 1, PARTIAL_PAYMENT: 2, OVERDUE: 2, EVICTED: 3, SETTLED: 4 })[stage],
    actorHostIds: [row.hostId, row.landlordHostId].filter(Boolean), date: state.world.date, minute, mapId: row.mapId,
    position: { ...(row.position ?? { x: 0, y: 0 }) }, state: event ? { ...event } : null,
    witnessedByPlayer: row.witnessedByPlayer === true, ...details };
}
function beginRentCatalogEvent(state, row, minute, maps, livingEventRows) {
  if (row.hostId !== 'tenant_mikhail') return;
  const dayIndex = Math.floor(state.world.clockMinutes / 1440), current = state.world.livingEventStates?.E01;
  if (current?.dueDayIndex === dayIndex) return;
  state.world.livingEventStates ??= {};
  state.world.livingEventStates.E01 = { ...RENT_LIVING_EVENT, status: 'ACTIVE', stage: 'DUE_NOTICE', dueDayIndex: dayIndex,
    startedAtMinute: state.world.clockMinutes, tenantHostId: row.hostId, landlordHostId: row.landlordHostId,
    amountDue: row.amountDueRemaining ?? row.amount ?? row.scheduledAmount ?? null };
  livingEventRows.push(rentCatalogEventRow(state, 'DUE_NOTICE', row, minute, maps,
    { amountDue: state.world.livingEventStates.E01.amountDue, changeKo: '방세 납부일이 되어 세입자와 집주인 사이에 납부 확인이 시작된다' }));
}
function advanceRentCatalogEvent(state, row, minute, maps, livingEventRows) {
  if (row.hostId !== 'tenant_mikhail') return;
  const event = state.world.livingEventStates?.E01;
  if (!event || event.tenantHostId !== row.hostId || event.landlordHostId !== row.landlordHostId) return;
  const stage = row.kind === 'RENT_PAID' ? 'SETTLED' : row.kind === 'RENT_PARTIAL' ? 'PARTIAL_PAYMENT'
    : row.kind === 'RENT_OVERDUE' ? (state.hosts[row.hostId]?.housing?.evictionStatus === 'EVICTED' ? 'EVICTED' : 'OVERDUE') : null;
  if (!stage || event.stage === stage || event.status === 'RESOLVED') return;
  event.stage = stage;
  if (stage === 'SETTLED') { event.status = 'RESOLVED'; event.resolvedAtMinute = state.world.clockMinutes; }
  if (stage === 'OVERDUE') event.overdueAtMinute = state.world.clockMinutes;
  if (stage === 'PARTIAL_PAYMENT') event.lastPartialPaymentAtMinute = state.world.clockMinutes;
  livingEventRows.push(rentCatalogEventRow(state, stage, row, minute, maps,
    { amount: row.amount, amountDueRemaining: row.amountDueRemaining ?? 0,
      changeKo: stage === 'SETTLED' ? '이번 납부액을 치르고 방세 장부를 마감한다'
        : stage === 'PARTIAL_PAYMENT' ? '일부 방세를 받았고 남은 금액은 장부에 남는다'
          : stage === 'EVICTED' ? '밀린 방세가 쌓여 세입자가 방을 비우고 안뜰에서 밤을 보낸다'
            : '납부 기한이 지나 미납액이 장부에 남는다' }));
}
function evictFictionalTenant(state, host, contract, minute, maps) {
  if (host.id !== 'tenant_mikhail' || contract.evictionStatus === 'EVICTED' || (contract.overduePeriods ?? 0) < 2) return;
  const home = host.places?.homeLocation;
  if (!home || !maps.courtyard || !host.allowedMaps.includes('courtyard')) return;
  const sleepSlot = (host.schedule ?? []).find(slot => slot.routineKind === 'FICTIONAL_HOME_SLEEP');
  const courtyard = maps.courtyard;
  let sleepPosition = null;
  for (let y = courtyard.height - 2; y >= 1 && !sleepPosition; y--) {
    for (let x = 1; x < courtyard.width - 1; x++) {
      if (canOccupy(courtyard, x, y, host.id, state.hosts)) { sleepPosition = { x, y }; break; }
    }
  }
  if (!sleepPosition) return;
  contract.evictedHome = clone(home);
  contract.evictedSleepSlot = sleepSlot ? clone(sleepSlot) : null;
  contract.evictionStatus = 'EVICTED';
  contract.evictedAtMinute = state.world.clockMinutes;
  host.places.homeLocation = null;
  host.places.homeLocationStatus = 'FICTIONAL_EVICTION_DESIGN';
  host.places.residenceKind = 'STREET_SLEEPER';
  host.places.sleepLocations = [{ mapId: 'courtyard', position: { ...sleepPosition }, scheduledMinute: sleepSlot?.atMinute ?? 1320,
    activityKo: '안뜰 바깥에서 잠을 청한다', provenance: 'FICTIONAL_EVICTION_DESIGN' }];
  host.schedule = (host.schedule ?? []).filter(slot => slot.routineKind !== 'FICTIONAL_HOME_SLEEP');
  host.schedule.push({ atMinute: sleepSlot?.atMinute ?? 1320, mapId: 'courtyard', position: { ...sleepPosition },
    activityKo: '안뜰 바깥에서 잠을 청한다', routineKind: 'FICTIONAL_HOME_SLEEP', valueStatus: 'fictional_gameplay_balance' });
  host.schedule.sort((a, b) => a.atMinute - b.atMinute);
  host.activeGoal = null;
  host.plannedPath = [];
  host.mapRoutePlan = null;
  host.currentActivityKo = '안뜰 바깥에서 잠을 청한다';
  host.routineState = { state: 'IDLE', activityKo: host.currentActivityKo, targetMapId: 'courtyard', targetPosition: { ...sleepPosition },
    changedAtMinute: minute, minutesInState: 0 };
}
function settleEvictedTenant(host, contract) {
  if (contract.evictionStatus !== 'EVICTED' || !contract.evictedHome) return;
  host.places.homeLocation = clone(contract.evictedHome);
  host.places.homeLocationStatus = 'AUTHORED_HOUSING_RECORD';
  host.places.residenceKind = contract.evictedHome.kind ?? 'RENT';
  const previousSleep = contract.evictedSleepSlot;
  host.schedule = (host.schedule ?? []).filter(slot => slot.routineKind !== 'FICTIONAL_HOME_SLEEP');
  if (previousSleep) host.schedule.push(clone(previousSleep));
  host.schedule.sort((a, b) => a.atMinute - b.atMinute);
  host.places.sleepLocations = previousSleep ? [{ mapId: previousSleep.mapId, position: { ...previousSleep.position },
    scheduledMinute: previousSleep.atMinute, activityKo: previousSleep.activityKo, provenance: previousSleep.valueStatus }] : [];
  contract.evictionStatus = 'HOUSED';
  contract.overduePeriods = 0;
  delete contract.evictedAtMinute;
  delete contract.evictedHome;
  delete contract.evictedSleepSlot;
}
function recordRentOverdue(state, host, contract, row, minute, maps, housingRows, livingEventRows) {
  contract.overduePeriods = (contract.overduePeriods ?? 0) + 1;
  evictFictionalTenant(state, host, contract, minute, maps);
  housingRows.push(row);
  advanceRentCatalogEvent(state, row, minute, maps, livingEventRows);
}
function livingCourtyardDisputeEventRow(state, stage, minute, maps, details = {}) {
  const event = state.world.livingEventStates?.E09;
  const witness = state.hosts[event?.yardkeeperHostId ?? 'yardkeeper_semyon'];
  const position = witness?.position ?? { x: 9, y: 12 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E09', stage,
    stageIndex: ({ RAISED_VOICES: 1, MEDIATED: 2, REPORT_FILED: 2, DECLINED_TO_REPORT: 2,
      NEIGHBORS_SETTLED: 3, WATCHMAN_HEARD_STATEMENT: 3, REPORT_REGISTERED_NO_VISIT: 3 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute, mapId: 'courtyard', position: { ...position },
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    state: event ? clone(event) : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'courtyard', position, 6, maps), ...details };
}
function advanceCourtyardDispute(state, minuteOffset, maps, livingEventRows, options = {}) {
  state.world.livingEventStates ??= {};
  const event = state.world.livingEventStates.E09;
  if (event?.status === 'ACTIVE' && options.deferLivingEventExpiryId === 'E09') return;
  if (event?.status === 'ACTIVE') {
    const watchman = state.hosts[event.watchmanHostId];
    const tenant = state.hosts[event.tenantHostId], landlord = state.hosts[event.landlordHostId];
    if (event.stage === 'REPORT_FILED' && watchman?.mapId === 'courtyard'
      && [tenant, landlord].some(person => person?.mapId === 'courtyard' && nearTile(watchman.position, person.position, 5))) {
      event.status = 'RESOLVED'; event.stage = 'WATCHMAN_HEARD_STATEMENT'; event.resolvedAtMinute = state.world.clockMinutes;
      event.statementHeardAtMinute = state.world.clockMinutes;
      const record = state.world.courtyardIncidentRecords?.find(item => item.recordNumber === event.officialRecordNumber);
      if (record) { record.statementStatus = 'STATEMENT_HEARD'; record.statementHeardAtMinute = state.world.clockMinutes; }
      livingEventRows.push(livingCourtyardDisputeEventRow(state, event.stage, minuteOffset, maps,
        { changeKo: '당직 경비가 안뜰에 와서 신고한 사람과 당사자 한 명의 말을 들었다.', responseHostId: watchman.id }));
      return;
    }
    if (state.world.clockMinutes < event.resolvesAtMinute) return;
    event.status = 'RESOLVED'; event.resolvedAtMinute = state.world.clockMinutes;
    if (event.stage === 'REPORT_FILED') {
      event.stage = 'REPORT_REGISTERED_NO_VISIT';
      event.resolutionActionId = 'E09_FILE_REPORT';
      const record = state.world.courtyardIncidentRecords?.find(item => item.recordNumber === event.officialRecordNumber);
      if (record) record.statementStatus = 'NO_VISIT_WITHIN_RESPONSE_WINDOW';
      livingEventRows.push(livingCourtyardDisputeEventRow(state, event.stage, minuteOffset, maps,
        { changeKo: '신고는 당직 기록에 남았지만, 경비는 아직 안뜰에 오지 않았다.', reportPending: true }));
    } else {
      event.stage = 'NEIGHBORS_SETTLED';
      event.resolutionActionId = 'AUTO_NEIGHBORS_SETTLED';
      const tenant = state.hosts[event.tenantHostId];
      tenant.needs.safetyConcern = Math.min(100, tenant.needs.safetyConcern + 4);
      livingEventRows.push(livingCourtyardDisputeEventRow(state, event.stage, minuteOffset, maps,
        { changeKo: '아무도 중재하거나 알리지 않은 사이 목소리는 잦아들었지만, 미납 문제는 장부에 남았다.',
          safetyConcernDelta: 4, resolutionActionId: 'AUTO_NEIGHBORS_SETTLED' }));
    }
    return;
  }
  if (event || state.world.activeRealm || state.world.chapterId !== 'V33_1847_PRINT'
    || state.world.livingEventStates.E01?.stage !== 'OVERDUE') return;
  const tenant = state.hosts.tenant_mikhail, landlord = state.hosts.landlady_polina, yardkeeper = state.hosts.yardkeeper_semyon;
  if (!tenant || !landlord || !yardkeeper || [tenant, landlord, yardkeeper].some(host => host.historicalAliveAndPresent === false
    || host.mapId !== 'courtyard' || !host.allowedMaps.includes('courtyard'))
    || !nearTile(tenant.position, landlord.position, 2) || !nearTile(yardkeeper.position, tenant.position, 12)) return;
  const watchman = state.hosts.junior_guard_sergey;
  const witnessHostIds = [yardkeeper.id];
  if (watchman?.historicalAliveAndPresent !== false && watchman?.mapId === 'courtyard'
    && nearTile(watchman.position, tenant.position, 6)) witnessHostIds.push(watchman.id);
  const concernBefore = tenant.needs.safetyConcern;
  tenant.needs.safetyConcern = Math.min(100, tenant.needs.safetyConcern + 3);
  state.world.livingEventStates.E09 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E09',
    status: 'ACTIVE', stage: 'RAISED_VOICES', trigger: 'noise_or_theft',
    triggerMechanism: 'rent_arrears_dispute_audible_in_shared_courtyard', sourceCatalogEventId: 'E01',
    startedAtMinute: state.world.clockMinutes, resolvesAtMinute: state.world.clockMinutes + 120,
    actorHostIds: [yardkeeper.id, tenant.id, landlord.id], witnessHostIds,
    yardkeeperHostId: yardkeeper.id, tenantHostId: tenant.id, landlordHostId: landlord.id,
    watchmanHostId: watchman?.id ?? 'junior_guard_sergey', reportFiled: false,
    sceneMapId: 'courtyard', scenePosition: { ...tenant.position },
    concernBefore, concernAfter: tenant.needs.safetyConcern,
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
  livingEventRows.push(livingCourtyardDisputeEventRow(state, 'RAISED_VOICES', minuteOffset, maps,
    { changeKo: '방세 미납을 두고 세입자와 집주인의 언성이 높아졌다. 안뜰 관리인이 계단 쪽에서 이를 들었다.',
      sourceEventId: 'E01', safetyConcernDelta: tenant.needs.safetyConcern - concernBefore }));
}
function beginLaundryEvent(state, work, minuteOffset, maps, livingEventRows) {
  const current = state.world.livingEventStates?.E04;
  if (current || work.hostId !== 'laundress_mariya' || work.actionId !== 'V36_LAUNDRESS_WASH_LINEN') return;
  state.world.livingEventStates ??= {};
  state.world.livingEventStates.E04 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E04', status: 'ACTIVE',
    stage: 'LINEN_WASHED', startedAtMinute: state.world.clockMinutes, dayIndex: work.dayIndex, hostId: work.hostId,
    itemKo: '접은 린넨', validationStatus: 'DESIGN_SEED_NOT_VERIFIED', valueStatus: 'fictional_gameplay_balance' };
  livingEventRows.push(livingLaundryEventRow(state, 'LINEN_WASHED', [work.hostId], work.mapId, work.position, minuteOffset, maps,
    { changeKo: '맡은 린넨을 빨아 접고 거래할 물건으로 챙긴다', workActionId: work.actionId }));
}
function advanceLaundryOnExchange(state, exchange, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E04;
  if (!event || event.status !== 'ACTIVE' || event.stage !== 'LINEN_WASHED' || exchange.hostId !== event.hostId
    || exchange.taskId !== 'MARIYA_LINEN_SALE_TO_NADEZHDA_1847' || exchange.itemKo !== event.itemKo) return;
  event.stage = 'LINEN_EXCHANGED'; event.exchangedAtMinute = state.world.clockMinutes; event.recipientHostId = exchange.recipientHostId;
  livingEventRows.push(livingLaundryEventRow(state, 'LINEN_EXCHANGED', [event.hostId, exchange.recipientHostId], exchange.mapId, exchange.position, minuteOffset, maps,
    { recipientHostId: exchange.recipientHostId, payment: exchange.moneyAmount, changeKo: '린넨을 넘기고 세탁값을 받는다' }));
}
function resolveLaundryOnReconciliation(state, work, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E04;
  if (!event || event.status !== 'ACTIVE' || event.stage !== 'LINEN_EXCHANGED' || work.hostId !== event.hostId
    || work.actionId !== 'V36_LAUNDRESS_RECONCILE_PAYMENTS') return;
  event.stage = 'ACCOUNTS_RECONCILED'; event.status = 'RESOLVED'; event.resolvedAtMinute = state.world.clockMinutes;
  livingEventRows.push(livingLaundryEventRow(state, 'ACCOUNTS_RECONCILED', [event.hostId, event.recipientHostId], work.mapId, work.position, minuteOffset, maps,
    { changeKo: '받은 세탁값과 남은 외상 장부를 정리한다', workActionId: work.actionId }));
}
function livingPrintDeadlineEventRow(state, stage, actorHostIds, mapId, position, minute, maps, details = {}) {
  const event = state.world.livingEventStates?.E07;
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E07', stage,
    stageIndex: ({ PROOF_PREPARED: 1, TYPESET_CHECKED: 2, WAGE_PAID: 3 })[stage],
    actorHostIds: [...new Set(actorHostIds.filter(Boolean))], date: state.world.date, minute, mapId, position: { ...position },
    valueStatus: 'fictional_gameplay_balance', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED', state: event ? { ...event } : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, mapId, position, 6, maps), ...details };
}
function livingCensoredPageEventRow(state, stage, minute, maps, details = {}) {
  const event = state.world.livingEventStates?.E06;
  const actor = state.hosts[event?.editorHostId ?? 'editor_sofia'];
  const position = actor?.position ?? { x: 14, y: 10 };
  const mapId = actor?.mapId ?? 'printshop';
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E06', stage,
    stageIndex: ({ CENSOR_MARK_RETURNED: 1, TYPE_REMOVED: 2, QUERY_FILED: 2, COPY_KEPT: 2, INSTITUTIONAL_CUT: 3 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], date: state.world.date, minute, mapId, position: { ...position },
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    state: event ? { ...event } : null, witnessedByPlayer: playerCanObserveWorldEvent(state, mapId, position, 6, maps), ...details };
}
function beginCensoredPageEvent(state, work, minuteOffset, maps, livingEventRows) {
  if (work.actionId !== 'V36_TYPESETTER_MARK_PROOF_ERRORS' || state.world.livingEventStates?.E06
    || state.world.chapterId !== 'V33_1847_PRINT' || state.world.activeRealm) return;
  state.world.livingEventStates.E06 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E06',
    status: 'ACTIVE', stage: 'CENSOR_MARK_RETURNED', trigger: 'censor_order',
    triggerMechanism: 'scheduled_typesetter_proof_check_after_returned_marked_proof',
    startedAtMinute: state.world.clockMinutes, resolvesAtMinute: state.world.clockMinutes + 1440,
    actorHostIds: ['printer_ekaterina', 'typesetter_nikita', 'editor_sofia'],
    printerHostId: 'printer_ekaterina', typesetterHostId: 'typesetter_nikita', editorHostId: 'editor_sofia',
    proofDisposition: 'MARKED_COPY_ON_WORKTABLE', officeRecord: 'NONE', privateCopyHostId: null,
    printerRisk: 0, validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION' };
  livingEventRows.push(livingCensoredPageEventRow(state, 'CENSOR_MARK_RETURNED', minuteOffset, maps,
    { changeKo: '삭제 표시가 붙은 교정쇄가 인쇄소로 돌아왔다. 예카테리나와 소피아가 표시를 살펴본다.', workActionId: work.actionId }));
}
function advanceCensoredPageEvent(state, minuteOffset, maps, livingEventRows, options = {}) {
  if (options.deferLivingEventExpiryId === 'E06') return;
  const event = state.world.livingEventStates?.E06;
  if (event?.status !== 'ACTIVE' || state.world.clockMinutes < event.resolvesAtMinute) return;
  event.status = 'RESOLVED'; event.stage = 'INSTITUTIONAL_CUT'; event.resolvedAtMinute = state.world.clockMinutes;
  event.resolutionActionId = 'AUTO_INSTITUTIONAL_CUT';
  event.proofDisposition = 'TEXT_REMOVED_WITHOUT_PLAYER_RESPONSE'; event.printerRisk = 2;
  livingEventRows.push(livingCensoredPageEventRow(state, event.stage, minuteOffset, maps,
    { changeKo: '대답을 기다리던 동안 인쇄소는 표시된 문장을 빼고 교정쇄를 넘겼다.', unattended: true }));
}
function smuggledEditionEventRow(state, event, minuteOffset, maps, details = {}) {
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E34', stage: event.stage,
    stageIndex: event.stage === 'COPY_CARRIED' ? 1 : event.stage === 'READING_READY' ? 2 : 3,
    actorHostIds: [...event.actorHostIds], witnessHostIds: [...event.witnessHostIds], date: state.world.date,
    minute: minuteOffset, mapId: event.venueMapId, position: { ...event.scenePosition }, sourceIds: [],
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    historicalOutcomeId: 'FICTIONAL_PRINTSHOP_AND_BOOKSHOP_COPY', historicalOutcomeFixed: false,
    itemLocation: event.itemLocation, state: clone(event),
    witnessedByPlayer: playerCanObserveWorldEvent(state, event.venueMapId, event.scenePosition, 6, maps), ...details };
}
function advanceSmuggledEditionEvent(state, minuteOffset, maps, livingEventRows) {
  state.world.livingEventStates ??= {};
  let event = state.world.livingEventStates.E34;
  const copy = '삭제 표시가 남은 교정쇄 사본';
  if (!event) {
    const object = (layer(maps?.['bookshop-interior'], 'Interactions')?.objects ?? [])
      .find(item => item.id === 4022);
    const actorHostIds = ['typesetter_nikita', 'bookseller_lev', 'student_vasily', 'junior_guard_sergey'];
    const actors = actorHostIds.map(id => state.hosts[id]);
    if (state.world.chapterId !== 'V33_1847_PRINT' || state.world.date < '1847-06-01' || state.world.activeRealm
      || state.world.livingEventStates.E06?.status !== 'RESOLVED'
      || state.world.livingEventStates.E06?.stage !== 'COPY_KEPT'
      || !state.hosts.typesetter_nikita?.inventory?.includes(copy) || !object
      || actors.some(host => !host || host.historicalAliveAndPresent === false
        || !host.allowedMaps.includes('bookshop-interior')
        || npcMapRoute(host.mapId, 'bookshop-interior', host, maps, state.world.clockMinutes) === null)) return;
    event = state.world.livingEventStates.E34 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E34',
      status: 'ACTIVE', stage: 'COPY_CARRIED', trigger: 'E06_PRIVATE_COPY_REACHES_BOOKSHOP',
      startedAtMinute: state.world.clockMinutes, resolvesAtMinute: state.world.clockMinutes + 360,
      actorHostIds, witnessHostIds: ['bookseller_lev', 'student_vasily', 'junior_guard_sergey'],
      venueMapId: 'bookshop-interior', scenePosition: objectTile(object), carrierHostId: 'typesetter_nikita',
      booksellerHostId: 'bookseller_lev', studentHostId: 'student_vasily', watchmanHostId: 'junior_guard_sergey',
      itemName: copy, itemLocation: 'WITH_TYPESETTER', historicalOutcomeId: 'FICTIONAL_PRINTSHOP_AND_BOOKSHOP_COPY',
      historicalOutcomeFixed: false, occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
      validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
    livingEventRows.push(smuggledEditionEventRow(state, event, minuteOffset, maps,
      { changeKo: '니키타가 교정쇄 사본을 품고 책방에 들어왔다. 레프와 바실리, 세르게이가 종이를 보았다.' }));
  }
  if (event.status !== 'ACTIVE') return;
  const gathered = event.actorHostIds.every(id => {
    const host = state.hosts[id];
    return host && host.historicalAliveAndPresent !== false && host.mapId === event.venueMapId
      && nearTile(host.position, event.scenePosition, 5);
  });
  if (gathered && event.stage === 'COPY_CARRIED') {
    const carrier = state.hosts[event.carrierHostId];
    if (!carrier?.inventory?.includes(event.itemName)) return;
    carrier.inventory = carrier.inventory.filter(item => item !== event.itemName);
    event.stage = 'READING_READY'; event.itemLocation = 'UNDER_BOOKSHOP_SHELF';
    event.gatheredAtMinute = state.world.clockMinutes; event.resolvesAtMinute = state.world.clockMinutes + 180;
    livingEventRows.push(smuggledEditionEventRow(state, event, minuteOffset, maps,
      { changeKo: '니키타가 사본을 선반 밑에 놓았다. 레프와 바실리가 글자와 인쇄 흔적을 살폈다.' }));
  }
  if (state.world.clockMinutes < event.resolvesAtMinute) return;
  event.status = 'RESOLVED'; event.stage = event.stage === 'READING_READY' ? 'COPY_RETURNED' : 'NO_GATHERING';
  event.disposition = 'NO_PLAYER_RESPONSE'; event.resolvedAtMinute = state.world.clockMinutes;
  event.resolutionActionId = 'AUTO_COPY_RETURNED';
  event.itemLocation = 'WITH_TYPESETTER';
  const owner = state.hosts[event.carrierHostId];
  if (owner && !owner.inventory.includes(event.itemName)) owner.inventory.push(event.itemName);
  state.world.smuggledEditionRecords ??= [];
  state.world.smuggledEditionRecords.push({ eventId: 'E34', actionId: 'AUTO_COPY_RETURNED',
    date: state.world.date, recordedAtMinute: state.world.clockMinutes, officialRecord: false,
    itemHolderHostId: event.carrierHostId, historicalOutcomeFixed: false });
  for (const id of event.actorHostIds) {
    const host = state.hosts[id]; if (host?.activeGoal?.taskId?.startsWith('V37:E34:')) host.activeGoal = null;
  }
  livingEventRows.push(smuggledEditionEventRow(state, event, minuteOffset, maps,
    { unattended: true, changeKo: '아무도 나서지 않자 니키타가 종이를 거두어 인쇄소로 돌아갔다.' }));
}
function beginPrintDeadlineEvent(state, work, minuteOffset, maps, livingEventRows) {
  if (state.world.livingEventStates?.E07 || work.hostId !== 'printer_ekaterina' || work.actionId !== 'V36_PRINTER_MARK_PROOF') return;
  state.world.livingEventStates ??= {};
  state.world.livingEventStates.E07 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E07', status: 'ACTIVE',
    stage: 'PROOF_PREPARED', startedAtMinute: state.world.clockMinutes, typesetterHostId: 'typesetter_nikita',
    printerHostId: 'printer_ekaterina', payerHostId: 'printer_ekaterina', wageActionId: 'PRINTSHOP_RELATED_WAGE',
    wagePaid: state.ledger.some(entry => entry.eventType === 'NPC_SIMULATION'
      && (entry.payments ?? []).some(payment => payment.kind === 'WAGE' && payment.hostId === 'typesetter_nikita'
        && payment.payerHostId === 'printer_ekaterina' && payment.actionId === 'V36_TYPESETTER_SET_LINES')),
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED', valueStatus: 'fictional_gameplay_balance' };
  const actor = state.hosts[work.hostId];
  livingEventRows.push(livingPrintDeadlineEventRow(state, 'PROOF_PREPARED', ['typesetter_nikita', work.hostId], actor.mapId, actor.position, minuteOffset, maps,
    { changeKo: '교정쇄에 날짜·출처·오자가 표시되어 조판 담당자에게 전달된다', workActionId: work.actionId }));
}
function advancePrintDeadlineOnProof(state, work, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E07;
  if (!event || event.stage !== 'PROOF_PREPARED' || work.hostId !== event.typesetterHostId
    || work.actionId !== 'V36_TYPESETTER_MARK_PROOF_ERRORS') return;
  event.stage = 'TYPESET_CHECKED'; event.proofAtMinute = state.world.clockMinutes;
  const typesetter = state.hosts[event.typesetterHostId];
  livingEventRows.push(livingPrintDeadlineEventRow(state, 'TYPESET_CHECKED', [event.typesetterHostId, event.printerHostId], work.mapId, work.position, minuteOffset, maps,
    { changeKo: '식자공이 교정 표시를 조판 줄과 대조해 오자를 고친다', workActionId: work.actionId }));
  beginCensoredPageEvent(state, work, minuteOffset, maps, livingEventRows);
  if (event.wagePaid || (typesetter.pendingWageClaims ?? []).some(claim => claim.actionId === 'V36_TYPESETTER_SET_LINES' && claim.status === 'PAID')) {
    resolvePrintDeadlineOnWage(state, { kind: 'WAGE', hostId: event.typesetterHostId, payerHostId: event.payerHostId,
      actionId: 'V36_TYPESETTER_SET_LINES', amount: 1, mapId: work.mapId, position: work.position }, minuteOffset, maps, livingEventRows);
  }
}
function resolvePrintDeadlineOnWage(state, payment, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E07;
  if (!event || payment.kind !== 'WAGE' || payment.hostId !== event.typesetterHostId
    || payment.payerHostId !== event.payerHostId || payment.actionId !== 'V36_TYPESETTER_SET_LINES') return;
  if (event.stage === 'PROOF_PREPARED') { event.wagePaid = true; event.wagePaidAtMinute = state.world.clockMinutes; return; }
  if (event.stage !== 'TYPESET_CHECKED') return;
  event.stage = 'RESOLVED'; event.status = 'RESOLVED'; event.resolvedAtMinute = state.world.clockMinutes;
  event.resolution = 'TYPESET_PROOF_AND_WAGE_COMPLETED';
  const printer = state.hosts[event.printerHostId];
  livingEventRows.push(livingPrintDeadlineEventRow(state, 'WAGE_PAID', [event.typesetterHostId, event.printerHostId], payment.mapId ?? printer.mapId, payment.position ?? printer.position, minuteOffset, maps,
    { changeKo: `교정이 끝난 조판 작업의 품삯 ${payment.amount ?? 1}코페이카가 지급되었다`, actionId: payment.actionId }));
}
function livingBookbindingEventRow(state, stage, actorHostIds, mapId, position, minute, maps, details = {}) {
  const event = state.world.livingEventStates?.E08;
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E08', stage,
    stageIndex: ({ ORDER_ACCEPTED: 1, BOOK_BOUND: 2, DELIVERED_PAID: 3 })[stage],
    actorHostIds: [...new Set(actorHostIds.filter(Boolean))], date: state.world.date, minute, mapId, position: { ...position },
    valueStatus: 'fictional_gameplay_balance', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED', state: event ? { ...event } : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, mapId, position, 6, maps), ...details };
}
function beginBookbindingContract(state, host, slot, minuteOffset, maps, livingEventRows) {
  const work = slot?.workAction;
  if (state.world.livingEventStates?.E08 || host.id !== 'bookbinder_elizaveta' || work?.id !== 'V36_BOOKBINDER_SEW_SIGNATURES') return;
  state.world.livingEventStates ??= {};
  state.world.livingEventStates.E08 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E08', status: 'ACTIVE',
    stage: 'ORDER_ACCEPTED', startedAtMinute: state.world.clockMinutes, dayIndex: Math.floor(state.world.clockMinutes / 1440),
    binderHostId: 'bookbinder_elizaveta', booksellerHostId: 'bookseller_lev', itemKo: '제본 중인 책 한 권',
    contractTaskId: 'ELIZAVETA_BOOKBINDER_ORDER_TO_LEV_1847', valueStatus: 'fictional_gameplay_balance', validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
  livingEventRows.push(livingBookbindingEventRow(state, 'ORDER_ACCEPTED', [host.id, 'bookseller_lev'], host.mapId, host.position, minuteOffset, maps,
    { changeKo: '책방에서 맡긴 제본 주문을 작업대에 올린다', workActionId: work.id }));
}
function completeBookbindingOnWork(state, work, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E08;
  if (!event || event.status !== 'ACTIVE' || event.stage !== 'ORDER_ACCEPTED'
    || work.hostId !== event.binderHostId || work.actionId !== 'V36_BOOKBINDER_SEW_SIGNATURES'
    || !work.inventoryItemKo) return;
  event.stage = 'BOOK_BOUND'; event.boundAtMinute = state.world.clockMinutes;
  livingEventRows.push(livingBookbindingEventRow(state, 'BOOK_BOUND', [event.binderHostId, event.booksellerHostId], work.mapId, work.position, minuteOffset, maps,
    { changeKo: '속장을 꿰매 책 한 권의 제본을 마친다', itemKo: event.itemKo, workActionId: work.actionId }));
}
function completeBookbindingOnExchange(state, exchange, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E08;
  if (!event || event.status !== 'ACTIVE' || event.stage !== 'BOOK_BOUND'
    || exchange.hostId !== event.binderHostId || exchange.recipientHostId !== event.booksellerHostId
    || exchange.itemKo !== event.itemKo || exchange.moneyAmount !== 2) return;
  event.stage = 'DELIVERED_PAID'; event.status = 'RESOLVED'; event.resolvedAtMinute = state.world.clockMinutes;
  livingEventRows.push(livingBookbindingEventRow(state, 'DELIVERED_PAID', [event.binderHostId, event.booksellerHostId], exchange.mapId, exchange.position, minuteOffset, maps,
    { changeKo: '책방 주인이 제본한 책을 인수하고 약정한 게임 내 대금을 지급한다', itemKo: exchange.itemKo, payment: exchange.moneyAmount, taskId: exchange.taskId }));
}
function livingMissingParcelEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E05;
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E05', stage,
    stageIndex: ({ PARCEL_MISSING: 1, RECOVERED_BY_COURIER: 2, ACCEPTED_BY_RECIPIENT: 2, LOSS_REPORTED: 2, UNCLAIMED: 2 })[stage],
    actorHostIds: ['courier_pavel', 'printer_ekaterina'], date: state.world.date, minute: minuteOffset,
    mapId: event?.mapId ?? 'printshop', position: { ...(event?.position ?? { x: 10, y: 13 }) },
    itemKo: event?.itemKo ?? '밀봉 봉투', valueStatus: 'fictional_gameplay_balance',
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    witnessedByPlayer: playerCanObserveWorldEvent(state, event?.mapId ?? 'printshop', event?.position ?? { x: 10, y: 13 }, 6, maps),
    state: event ? { ...event } : null, ...details };
}
function beginMissingParcelOnDeadline(state, host, minuteOffset, maps, livingEventRows) {
  const taskSlot = (host.schedule ?? []).find(slot => slot.task?.missedDeadlineEventId === 'E05');
  const task = taskSlot?.task, deadline = task?.deadlineMinute;
  if (!task || !Number.isInteger(deadline) || state.world.livingEventStates?.E05
    || state.world.clockMinutes % 1440 < deadline
    || taskCompletedForDay(host, task, Math.floor(state.world.clockMinutes / 1440))
    || !host.inventory.includes(task.itemKo)) return false;
  host.inventory.splice(host.inventory.indexOf(task.itemKo), 1);
  state.world.livingEventStates ??= {};
  const event = state.world.livingEventStates.E05 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E05',
    status: 'ACTIVE', stage: 'PARCEL_MISSING', startedAtMinute: state.world.clockMinutes,
    senderHostId: host.id, recipientHostId: task.recipientHostId, taskId: task.id, itemKo: task.itemKo,
    mapId: task.missedLocation?.mapId ?? taskSlot.mapId,
    position: { ...(task.missedLocation?.position ?? taskSlot.position) },
    itemLocation: 'LOST_ON_DELIVERY_ROUTE', deadlineMinute: deadline,
    valueStatus: 'fictional_gameplay_balance', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
  livingEventRows.push(livingMissingParcelEventRow(state, 'PARCEL_MISSING', minuteOffset, maps,
    { changeKo: '배달 시각까지 수취인에게 닿지 않은 봉투가 인쇄소 문 앞에서 발견된다', deadlineMinute: deadline,
      itemLocation: event.itemLocation }));
  return true;
}
function advanceMissingParcelIfUnclaimed(state, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E05;
  if (!event || event.status !== 'ACTIVE' || state.world.clockMinutes < event.startedAtMinute + 1440) return;
  event.status = 'RESOLVED';
  event.stage = 'UNCLAIMED';
  event.itemLocation = 'NO_LONGER_AT_DELIVERY_DOOR';
  event.resolvedAtMinute = state.world.clockMinutes;
  event.resolutionActionId = 'AUTO_UNCLAIMED_AFTER_ONE_DAY';
  livingEventRows.push(livingMissingParcelEventRow(state, 'UNCLAIMED', minuteOffset, maps,
    { changeKo: '하루가 지나도 봉투를 찾지 못해 인쇄소 문 앞의 배달물이 사라지고 분실 기록만 남는다' }));
}
function livingCanalTrafficEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E11;
  const actors = (event?.actorHostIds ?? []).map(id => state.hosts[id]).filter(Boolean);
  const position = actors[0]?.position ?? { x: 11, y: 14 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E11', stage,
    stageIndex: stage === 'WAITING_FOR_PARTNER' ? 0 : stage === 'BOAT_TRAFFIC' ? 1 : 2, actorHostIds: actors.map(host => host.id),
    date: state.world.date, minute: minuteOffset, mapId: 'canal-road', position: { ...position },
    valueStatus: 'fictional_gameplay_balance', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    witnessedByPlayer: actors.some(host => playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps)),
    ...details };
}
function coldWaveWeatherForDate(date, dayIndex) {
  const month = Number(date?.slice?.(5, 7));
  if (!(month === 12 || month <= 2)) return null;
  const weather = ['snow', 'snow', 'fog', 'wind', 'overcast'];
  let seed = 17 + dayIndex * 31 + month * 13;
  for (const char of String(date ?? '')) seed = (seed * 33 + char.charCodeAt(0)) % 104729;
  const kind = weather[seed % weather.length];
  return kind === 'snow' || kind === 'wind' ? kind : null;
}
function livingColdWaveEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E03;
  const actor = state.hosts[event?.tenantHostId ?? 'tenant_mikhail'];
  const position = actor?.position ?? { x: 12, y: 11 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E03', stage,
    stageIndex: ({ COLD_WAVE: 1, FIREWOOD_BOUGHT: 2, COURTYARD_FUEL_POOLED: 2, FUEL_DEFERRED: 2, COLD_PASSED: 3 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], date: state.world.date, minute: minuteOffset,
    mapId: event?.mapId ?? 'market-quay', position: { ...position }, valueStatus: 'fictional_gameplay_balance',
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    witnessedByPlayer: playerCanObserveWorldEvent(state, event?.mapId ?? 'market-quay', position, 6, maps), ...details };
}
function advanceColdWaveEvent(state, minuteOffset, maps, livingEventRows) {
  state.world.livingEventStates ??= {};
  const event = state.world.livingEventStates.E03;
  if (event?.status === 'ACTIVE') {
    if (state.world.clockMinutes < event.resolvesAtMinute) return;
    event.status = 'RESOLVED'; event.stage = 'COLD_PASSED'; event.resolvedAtMinute = state.world.clockMinutes;
    const tenant = state.hosts[event.tenantHostId];
    tenant.needs.safetyConcern = Math.min(100, tenant.needs.safetyConcern + 8);
    livingEventRows.push(livingColdWaveEventRow(state, 'COLD_PASSED', minuteOffset, maps,
      { changeKo: '공동 장작을 마련하지 못한 채 한파가 지나갔고 세입자의 추위 걱정이 커졌다', safetyConcernDelta: 8 }));
    return;
  }
  if (event || state.world.activeRealm || state.world.chapterId !== 'V33_1847_PRINT') return;
  const dayIndex = Math.floor(state.world.clockMinutes / 1440), weather = coldWaveWeatherForDate(state.world.date, dayIndex);
  if (!weather || !state.hosts.tenant_mikhail || !state.hosts.landlady_polina || !state.hosts.porter_gavrila) return;
  state.world.livingEventStates.E03 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E03',
    status: 'ACTIVE', stage: 'COLD_WAVE', startedAtMinute: state.world.clockMinutes,
    resolvesAtMinute: state.world.clockMinutes + 1440, actorHostIds: ['tenant_mikhail', 'landlady_polina', 'porter_gavrila'],
    tenantHostId: 'tenant_mikhail', landlordHostId: 'landlady_polina', trigger: 'winter_snow_or_wind',
    weather, mapId: 'market-quay', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED', valueStatus: 'fictional_gameplay_balance' };
  livingEventRows.push(livingColdWaveEventRow(state, 'COLD_WAVE', minuteOffset, maps,
    { changeKo: '눈과 바람이 몰아쳐 강변 장터의 장작값이 올랐다', weather, priceKopeks: 2 }));
}
function courtyardFireEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E27;
  const position = event?.scenePosition ?? { x: 15, y: 11 };
  const actors = (event?.actorHostIds ?? []).map(id => state.hosts[id]).filter(Boolean);
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E27', stage,
    stageIndex: ({ FIRE_REPORTED: 1, RESIDENTS_EVACUATED: 2, ALARM_RAISED: 2, FIRE_REPORTED_TO_WATCH: 2, DAMAGE_SPREAD: 3 })[stage],
    actorHostIds: actors.map(host => host.id), witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute: minuteOffset, mapId: 'courtyard', position: { ...position },
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance', state: event ? clone(event) : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'courtyard', position, 7, maps), ...details };
}
const COURTYARD_FIRE_EVACUATION_TARGETS = Object.freeze({
  tenant_mikhail: { mapId: 'nevsky', position: { x: 16, y: 9 } },
  landlady_polina: { mapId: 'nevsky', position: { x: 15, y: 9 } },
  porter_gavrila: { mapId: 'nevsky', position: { x: 16, y: 10 } },
  junior_guard_sergey: { mapId: 'nevsky', position: { x: 17, y: 9 } },
});
function advanceCourtyardFireEvent(state, minuteOffset, maps, livingEventRows) {
  state.world.livingEventStates ??= {};
  const event = state.world.livingEventStates.E27;
  if (event?.status === 'ACTIVE') {
    if (event.stage === 'EVACUATING') {
      const allEvacuated = event.actorHostIds.every(id => {
        const host = state.hosts[id], target = event.evacuationTargets?.[id];
        return host && target && host.mapId === target.mapId;
      });
      if (allEvacuated) {
        event.status = 'RESOLVED'; event.stage = 'RESIDENTS_EVACUATED'; event.resolvedAtMinute = state.world.clockMinutes;
        event.propertyDamage = 0; event.evacuatedHostIds = [...event.actorHostIds];
        livingEventRows.push(courtyardFireEventRow(state, event.stage, minuteOffset, maps,
          { actionId: event.resolutionActionId, resolvedByHostId: event.resolvedByHostId,
            changeKo: '미하일은 집주인과 짐꾼, 경비를 안뜰 문을 지나 거리까지 이끌었다. 네 사람은 문밖에 모였고 불길은 더 번지지 않았다.',
            evacuatedHostIds: [...event.evacuatedHostIds], propertyDamage: 0, witnessedByPlayer: true }));
        return;
      }
    }
    if (state.world.clockMinutes < event.deadlineMinute) return;
    event.status = 'RESOLVED'; event.stage = 'DAMAGE_SPREAD'; event.resolvedAtMinute = state.world.clockMinutes;
    event.resolutionActionId = 'AUTO_FIRE_SPREAD';
    event.propertyDamage = 1;
    event.evacuatedHostIds = event.actorHostIds.filter(id => state.hosts[id]?.mapId === 'nevsky');
    const tenant = state.hosts[event.tenantHostId];
    if (tenant) tenant.needs.safetyConcern = Math.min(100, tenant.needs.safetyConcern + 18);
    livingEventRows.push(courtyardFireEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '불길이 문간까지 번져 방 한 칸이 그을리고 세입자들의 안전 걱정이 커졌다', propertyDamage: 1 }));
    return;
  }
  if (event || state.world.activeRealm || state.world.chapterId !== 'V33_1847_PRINT') return;
  const cold = state.world.livingEventStates.E03, tenant = state.hosts.tenant_mikhail;
  const localMinute = state.world.clockMinutes % 1440;
  if (cold?.stage !== 'FIREWOOD_BOUGHT' || cold.resolvedByHostId !== 'tenant_mikhail'
    || cold.weather !== 'wind' || !tenant?.inventory?.includes('장작 한 단') || tenant.mapId !== 'courtyard'
    || localMinute < 1080 || localMinute > 1320) return;
  tenant.inventory.splice(tenant.inventory.indexOf('장작 한 단'), 1);
  state.world.livingEventStates.E27 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E27',
    status: 'ACTIVE', stage: 'FIRE_REPORTED', trigger: 'tenant_brought_firewood_to_courtyard_on_windy_winter_evening',
    startedAtMinute: state.world.clockMinutes, deadlineMinute: state.world.clockMinutes + 60,
    actorHostIds: ['tenant_mikhail', 'landlady_polina', 'porter_gavrila', 'junior_guard_sergey'], witnessHostIds: [],
    tenantHostId: 'tenant_mikhail', landlordHostId: 'landlady_polina', guardHostId: 'junior_guard_sergey', scenePosition: { x: 15, y: 11 },
    sourceEventId: 'E03', sourceActionId: cold.resolutionActionId, propertyDamage: 0,
    valueStatus: 'fictional_gameplay_balance', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
  livingEventRows.push(courtyardFireEventRow(state, 'FIRE_REPORTED', minuteOffset, maps,
    { changeKo: '미하일이 장작을 안뜰로 옮긴 저녁, 난로 곁에서 연기가 번져 이웃들이 모였다', sourceEventId: 'E03' }));
}
function advanceCanalTraffic(state, moveRows, minuteOffset, maps, livingEventRows) {
  state.world.livingEventStates ??= {};
  let event = state.world.livingEventStates.E11;
  if (event?.status === 'ACTIVE' && event.stage === 'WAITING_FOR_PARTNER') {
    const coachman = state.hosts.coachman_timofey, watercarrier = state.hosts.watercarrier_luka;
    if (coachman?.mapId === 'canal-road' && watercarrier?.mapId === 'canal-road'
      && nearTile(coachman.position, watercarrier.position, 6)) {
      event.stage = 'BOAT_TRAFFIC';
      event.startedAtMinute = state.world.clockMinutes;
      event.clearsAtMinute = state.world.clockMinutes + 21;
      event.waitMinutesByHost = {};
      livingEventRows.push(livingCanalTrafficEventRow(state, 'BOAT_TRAFFIC', minuteOffset, maps,
        { changeKo: '배가 운하를 지나는 동안 두 운송 노동자의 길이 잠시 막힌다', delayMinutes: 20 }));
    } else if (state.world.clockMinutes >= event.partnerDeadlineMinute) {
      delete state.world.livingEventStates.E11;
      return;
    }
  }
  event = state.world.livingEventStates.E11;
  if (event?.status === 'ACTIVE' && state.world.clockMinutes >= event.clearsAtMinute) {
    event.status = 'RESOLVED'; event.stage = 'CLEARED'; event.resolvedAtMinute = state.world.clockMinutes;
    livingEventRows.push(livingCanalTrafficEventRow(state, 'CLEARED', minuteOffset, maps,
      { changeKo: '배가 지나가고 운하 길의 통행이 다시 열린다', waitMinutesByHost: { ...event.waitMinutesByHost } }));
  }
  if (state.world.livingEventStates.E11) return;
  const arrivals = moveRows.filter(move => move.fromMapId !== 'canal-road' && move.toMapId === 'canal-road'
    && ['coachman_timofey', 'watercarrier_luka'].includes(move.hostId));
  if (!arrivals.length) return;
  const coachman = state.hosts.coachman_timofey, watercarrier = state.hosts.watercarrier_luka;
  if (!coachman || !watercarrier) return;
  state.world.livingEventStates.E11 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E11',
    status: 'ACTIVE', stage: 'WAITING_FOR_PARTNER', startedAtMinute: state.world.clockMinutes,
    partnerWaitStartedAtMinute: state.world.clockMinutes,
    partnerDeadlineMinute: state.world.clockMinutes + 360, clearsAtMinute: state.world.clockMinutes + 360,
    actorHostIds: [coachman.id, watercarrier.id],
    triggerHostId: arrivals.at(-1).hostId, waitMinutesByHost: {}, valueStatus: 'fictional_gameplay_balance',
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
  const other = arrivals.at(-1).hostId === coachman.id ? watercarrier : coachman;
  if (other.mapId === 'canal-road' && nearTile((arrivals.at(-1).hostId === coachman.id ? coachman : watercarrier).position, other.position, 6)) {
    state.world.livingEventStates.E11.stage = 'BOAT_TRAFFIC';
    state.world.livingEventStates.E11.startedAtMinute = state.world.clockMinutes;
    state.world.livingEventStates.E11.clearsAtMinute = state.world.clockMinutes + 21;
    state.world.livingEventStates.E11.waitMinutesByHost = {};
    livingEventRows.push(livingCanalTrafficEventRow(state, 'BOAT_TRAFFIC', minuteOffset, maps,
      { changeKo: '배가 운하를 지나는 동안 두 운송 노동자의 길이 잠시 막힌다', delayMinutes: 20 }));
  }
}
function beginBreadPriceEvent(state, meal, minuteOffset, maps, livingEventRows) {
  if (state.world.livingEventStates?.E02 || meal.sellerHostId !== 'market_nadezhda') return;
  const seller = state.hosts[meal.sellerHostId];
  if ((seller.marketStock?.[meal.itemKo] ?? 0) > 0) return;
  state.world.livingEventStates ??= {};
  state.world.marketPriceModifiers ??= {};
  const offer = seller.marketOffers.find(item => item.itemKo === meal.itemKo);
  state.world.marketPriceModifiers[`${seller.id}:${meal.itemKo}`] = 1;
  state.world.livingEventStates.E02 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E02', status: 'ACTIVE', stage: 'PRICE_NOTICE', startedAtMinute: state.world.clockMinutes,
    trigger: 'market_stock_depleted_after_sale', buyerHostId: meal.hostId, sellerHostId: seller.id, supplierHostId: 'baker_fyodor',
    itemKo: meal.itemKo, basePrice: offer.price, currentPrice: offer.price + 1, valueStatus: 'fictional_gameplay_balance',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
  livingEventRows.push(livingMarketEventRow(state, 'PRICE_NOTICE', ['baker_fyodor', seller.id, meal.hostId], seller.mapId, seller.position, minuteOffset, maps,
    { remainingStock: 0, trigger: 'market_stock_depleted_after_sale', changeKo: '재고가 바닥나 다음 공급분의 게임 가격표가 조정된다' }));
}
function advanceBreadPriceEventOnRestock(state, exchange, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E02;
  if (event?.stage !== 'PRICE_NOTICE' || exchange.recipientHostId !== event.sellerHostId || exchange.itemKo !== event.itemKo || !exchange.marketStockAdded) return;
  event.stage = 'RESTOCKED'; event.restockedAtMinute = state.world.clockMinutes;
  const seller = state.hosts[event.sellerHostId];
  livingEventRows.push(livingMarketEventRow(state, 'RESTOCKED', [event.supplierHostId, seller.id, event.buyerHostId], seller.mapId, seller.position, minuteOffset, maps,
    { stock: seller.marketStock[event.itemKo], changeKo: '빵이 다시 들어왔고 조정된 가격표가 적용된다' }));
}
function completeBreadPriceEventOnSale(state, meal, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E02;
  if (event?.stage !== 'RESTOCKED' || meal.sellerHostId !== event.sellerHostId || meal.itemKo !== event.itemKo || meal.price <= event.basePrice) return;
  event.status = 'RESOLVED'; event.stage = 'RESOLVED'; event.resolvedAtMinute = state.world.clockMinutes; event.resolution = 'PURCHASE_AT_ADJUSTED_GAMEPLAY_PRICE';
  const seller = state.hosts[event.sellerHostId];
  livingEventRows.push(livingMarketEventRow(state, 'FIRST_PURCHASE', [event.supplierHostId, seller.id, meal.hostId], seller.mapId, seller.position, minuteOffset, maps,
    { pricePaid: meal.price, buyerHostId: meal.hostId, stock: seller.marketStock[event.itemKo], changeKo: '구매자가 조정된 가격을 내고 빵을 가져가며 돈·재고·허기가 함께 바뀐다' }));
  if (!state.world.livingEventStates.E26 && state.hosts.tenant_mikhail?.housing?.kind === 'RENT') {
    const tenant = state.hosts.tenant_mikhail, landlord = state.hosts.landlady_polina;
    const scenePosition = { x: 12, y: 7 };
    state.world.livingEventStates.E26 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E26',
      status: 'ACTIVE', stage: 'NOTICE_POSTED', sourceEventId: 'E02', startedAtMinute: state.world.clockMinutes,
      closesAtMinute: state.world.clockMinutes + 180, actorHostIds: [tenant.id, landlord.id], tenantHostId: tenant.id,
      landlordHostId: landlord.id, venueMapId: 'courtyard', scenePosition, previousRent: tenant.housing.amount,
      proposedRent: tenant.housing.amount + 1, valueStatus: 'fictional_gameplay_balance',
      occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
    tenant.activeGoal = { type: 'LIVING_EVENT_RESPONSE', taskId: 'V37:E26:NOTICE_POSTED:tenant_mikhail',
      reason: 'rent_notice_follows_household_cost_pressure', selectionBasis: { utilityScore: 180, eventId: 'E26' } };
    landlord.activeGoal = { type: 'LIVING_EVENT_RESPONSE', taskId: 'V37:E26:NOTICE_POSTED:landlady_polina',
      reason: 'landlord_posts_updated_rent_notice', selectionBasis: { utilityScore: 180, eventId: 'E26' } };
    livingEventRows.push({ catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E26', stage: 'NOTICE_POSTED',
      stageIndex: 1, actorHostIds: [tenant.id, landlord.id], witnessHostIds: [], date: state.world.date,
      minute: minuteOffset, mapId: 'courtyard', position: scenePosition,
      sourceEventId: 'E02',
      occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
      valueStatus: 'fictional_gameplay_balance', state: clone(state.world.livingEventStates.E26),
      witnessedByPlayer: playerCanObserveWorldEvent(state, 'courtyard', scenePosition, 6, maps),
      changeKo: '안뜰 벽에 새 방세 공지가 붙었다. 미하일과 폴리나는 금액을 두고 이야기하려 한다.' });
  }
}
function apothecarySupplyEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E16;
  const position = event?.scenePosition ?? { x: 13, y: 14 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E16', stage,
    stageIndex: ({ SHORTAGE_FOUND: 1, ORDER_PLACED: 2, DELIVERED: 3, ORDER_DECLINED: 3, SUPPLY_UNAVAILABLE: 3, SUPPLY_WITHHELD: 3 })[stage],
    actorHostIds: [event?.buyerHostId, event?.supplierHostId].filter(Boolean), witnessHostIds: [],
    date: state.world.date, minute: minuteOffset, mapId: 'market-quay', position: { ...position },
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance', state: event ? clone(event) : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'market-quay', position, 6, maps), ...details };
}
function beginApothecarySupplyEvent(state, work, minuteOffset, maps, livingEventRows) {
  const itemKo = '밀봉된 약방 물품 꾸러미', buyer = state.hosts.apothecary_yakov;
  if (work.hostId !== 'apothecary_yakov' || work.actionId !== 'V36_APOTHECARY_CHECK_STOCK'
    || state.world.livingEventStates?.E16 || buyer.inventory.includes(itemKo)) return;
  state.world.livingEventStates ??= {};
  state.world.livingEventStates.E16 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E16',
    status: 'ACTIVE', stage: 'SHORTAGE_FOUND', trigger: 'stock_check_found_no_sealed_supply_packet',
    startedAtMinute: state.world.clockMinutes, orderWindowEndsAtMinute: state.world.clockMinutes + 60,
    buyerHostId: buyer.id, supplierHostId: 'warehouse_pyotr', itemKo, price: 3, unit: 'kopeks',
    scenePosition: { mapId: 'market-quay', ...work.position }, orderRecorded: false,
    valueStatus: 'fictional_gameplay_balance', itemStatus: 'generic_gameplay_supply_no_medical_effect_claim',
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
  livingEventRows.push(apothecarySupplyEventRow(state, 'SHORTAGE_FOUND', minuteOffset, maps,
    { changeKo: '야코프가 재고표에서 요청 물품이 없음을 확인했다. 아직 주문도 결제도 하지 않았다.', itemKo }));
}
function advanceApothecarySupplyEvent(state, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E16;
  if (event?.status !== 'ACTIVE') return;
  if (event.stage === 'SHORTAGE_FOUND' && state.world.clockMinutes >= event.orderWindowEndsAtMinute) {
    event.stage = 'ORDER_PLACED'; event.orderRecorded = true; event.orderMethod = 'PRIVATE_ORDER_NOTE';
    event.orderPlacedAtMinute = state.world.clockMinutes;
    event.deliveryDeadlineMinute = state.world.clockMinutes + 180;
    livingEventRows.push(apothecarySupplyEventRow(state, 'ORDER_PLACED', minuteOffset, maps,
      { changeKo: '주문 응답 시간이 지나 야코프가 사적인 주문 메모를 남겼다. 아직 물건과 대금은 움직이지 않았다.' }));
  }
  if (event.stage !== 'ORDER_PLACED') return;
  const buyer = state.hosts[event.buyerHostId], supplier = state.hosts[event.supplierHostId];
  if (state.world.clockMinutes >= event.deliveryDeadlineMinute
    && ![event.buyerHostId, event.supplierHostId].includes(state.player.embodiment)) {
    event.status = 'RESOLVED'; event.stage = 'SUPPLY_UNAVAILABLE'; event.resolvedAtMinute = state.world.clockMinutes;
    event.resolutionActionId = 'AUTO_DELIVERY_DEADLINE';
    livingEventRows.push(apothecarySupplyEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '주문한 꾸러미가 약방에 도착하지 않아 주문을 닫았다. 대금과 소지품은 바뀌지 않았다.' }));
    return;
  }
  if ([event.buyerHostId, event.supplierHostId].includes(state.player.embodiment)) return;
  if (!buyer || !supplier || buyer.historicalAliveAndPresent === false || supplier.historicalAliveAndPresent === false
    || buyer.mapId !== event.scenePosition.mapId || supplier.mapId !== event.scenePosition.mapId
    || !nearTile(buyer.position, supplier.position, 1)) return;
  if (!supplier.inventory.includes(event.itemKo) || buyer.money?.unit !== event.unit || supplier.money?.unit !== event.unit
    || !Number.isFinite(buyer.money?.amount) || buyer.money.amount < event.price) {
    event.status = 'RESOLVED'; event.stage = 'SUPPLY_UNAVAILABLE'; event.resolvedAtMinute = state.world.clockMinutes;
    event.resolutionActionId = 'AUTO_ORDER_UNFILLED';
    livingEventRows.push(apothecarySupplyEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '꾸러미가 없거나 대금을 마련하지 못해 주문은 미결 상태로 닫혔다. 돈과 소지품은 바뀌지 않았다.' }));
    return;
  }
  buyer.money.amount -= event.price; supplier.money.amount += event.price;
  supplier.inventory.splice(supplier.inventory.indexOf(event.itemKo), 1);
  if (!buyer.inventory.includes(event.itemKo)) buyer.inventory.push(event.itemKo);
  buyer.relations[supplier.id] = '약방 물품 꾸러미를 공급받은 거래처';
  supplier.relations[buyer.id] = '약방 물품 꾸러미를 납품한 거래처';
  event.status = 'RESOLVED'; event.stage = 'DELIVERED'; event.resolvedAtMinute = state.world.clockMinutes;
  event.resolutionActionId = 'AUTO_SUPPLY_DELIVERED'; event.paidAmount = event.price;
  livingEventRows.push(apothecarySupplyEventRow(state, 'DELIVERED', minuteOffset, maps,
    { changeKo: '야코프가 꾸러미를 받고 3코페이카를 냈다. 공급자 소지품과 두 사람의 잔액이 바뀌었다. 건강이나 약효 상태는 바뀌지 않았다.',
      buyerHostId: buyer.id, supplierHostId: supplier.id, paidAmount: event.price, itemKo: event.itemKo }));
}
function livingMarketDisputeEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E13;
  const seller = state.hosts[event?.sellerHostId ?? 'market_nadezhda'];
  const position = seller?.position ?? { x: 13, y: 12 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E13', stage,
    stageIndex: ({ PRICE_CHALLENGE: 1, REFUND_ISSUED: 2, TRANSACTION_ACCEPTED: 2, REPORT_FILED: 2,
      WATCHMAN_REVIEWED: 3, REPORT_NO_VISIT: 3, PRICE_STANDS: 3 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute: minuteOffset, mapId: 'market-quay', position: { ...position },
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance', state: event ? clone(event) : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'market-quay', position, 6, maps), ...details };
}
function livingMarketRumorEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E23, position = event?.scenePosition ?? { x: 15, y: 10 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E23', stage,
    stageIndex: ({ RUMOR_ACTIVE: 1, PRICE_CHECKED_UNVERIFIED: 2, FORWARDED_UNVERIFIED: 2,
      CORRECTION_SPREAD: 2, IGNORED_UNCHECKED: 2, SPREAD_UNVERIFIED: 3,
      EDITORIAL_NOTE_TAKEN: 3, NEWSPAPER_PRINTED: 4 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute: minuteOffset, mapId: 'market-quay', position: { ...position },
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance', state: event ? clone(event) : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'market-quay', position, 6, maps), ...details };
}
function beginMarketRumorEvent(state, minuteOffset, maps, livingEventRows) {
  if (state.world.livingEventStates?.E23) return;
  const carrier = state.hosts.street_vendor_matryona, clerk = state.hosts.clerk_alexei;
  if (!carrier || !clerk || carrier.historicalAliveAndPresent === false) return;
  const position = { x: 15, y: 10 };
  const witnesses = Object.values(state.hosts).filter(host => ![carrier.id, clerk.id].includes(host.id)
    && host.historicalAliveAndPresent !== false && host.mapId === 'market-quay'
    && nearTile(host.position, position, 5)).map(host => host.id).sort();
  const event = state.world.livingEventStates.E23 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E23',
    status: 'ACTIVE', stage: 'RUMOR_ACTIVE', trigger: 'official_price_check_request_repeated_as_public_accusation',
    sourceCatalogEventId: 'E13', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', valueStatus: 'fictional_gameplay_balance',
    startedAtMinute: state.world.clockMinutes, autoResolveAtMinute: state.world.clockMinutes + 90,
    carrierHostId: carrier.id, clerkHostId: clerk.id, sellerHostId: state.world.livingEventStates.E13.sellerHostId,
    actorHostIds: [carrier.id, clerk.id], witnessHostIds: witnesses, scenePosition: position,
    rumorClaimKo: '상인이 빵을 숨기고 값을 두 배로 받았다는 말', claimStatus: 'UNVERIFIED',
    rumorReachedHostIds: [], correctionReachedHostIds: [], resolutionActionId: null };
  recordRumorHearing(state, { recipientHostId: carrier.id, fromHostId: carrier.id, status: 'UNVERIFIED' });
  for (const id of witnesses) recordRumorHearing(state, { recipientHostId: id, fromHostId: carrier.id, status: 'UNVERIFIED' });
  carrier.activeGoal = { type: 'LIVING_EVENT_RESPONSE', taskId: 'V37:E23:CARRY_RUMOR',
    targetHostId: clerk.id, reason: 'market_rumor_requires_source_check_or_correction',
    selectionBasis: { utilityScore: 179, eventId: 'E23' } };
  livingEventRows.push(livingMarketRumorEventRow(state, event.stage, minuteOffset, maps,
    { sourceEventId: 'E13', changeKo: '가격 확인 요청이 접수되자, 시장에 “상인이 빵을 숨기고 값을 두 배로 받았다”는 말이 퍼지기 시작했다. 장터 기록에는 그런 의도가 확인되지 않았다.' }));
}
function recordRumorHearing(state, { recipientHostId, fromHostId, status, recordNumber = null }) {
  const host = state.hosts?.[recipientHostId], event = state.world.livingEventStates?.E23;
  if (!host || !event || !['UNVERIFIED', 'CHECKED', 'CORRECTED'].includes(status)) return false;
  host.knownRumors ??= [];
  const item = { eventId: 'E23', sourceEventId: 'E13', status, fromHostId,
    atMinute: state.world.clockMinutes, recordNumber: status === 'CHECKED' || status === 'CORRECTED' ? recordNumber ?? null : null };
  const previous = host.knownRumors.findIndex(row => row.eventId === item.eventId);
  if (previous >= 0) host.knownRumors[previous] = item; else host.knownRumors.push(item);
  state.world.rumorPropagationLog ??= [];
  state.world.rumorPropagationLog.push({ recipientHostId, ...item });
  if (state.world.rumorPropagationLog.length > 256) state.world.rumorPropagationLog.splice(0, state.world.rumorPropagationLog.length - 256);
  return true;
}
function rumorAudienceAtScene(state, event, maps, speakerHostId) {
  const speaker = state.hosts[speakerHostId];
  if (!speaker) return [];
  return Object.values(state.hosts).filter(host => host.id !== speakerHostId
    && !event.actorHostIds.includes(host.id) && host.historicalAliveAndPresent !== false
    && host.mapId === speaker.mapId && nearTile(host.position, speaker.position, 5)
    && maps[host.mapId]?.metadata?.displayNameKo)
    .map(host => host.id).sort();
}
function advanceMarketRumorEvent(state, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E23;
  if (!event || event.status !== 'ACTIVE' || event.stage !== 'IGNORED_UNCHECKED'
    || state.world.clockMinutes < event.autoResolveAtMinute) return;
  event.status = 'RESOLVED'; event.stage = 'SPREAD_UNVERIFIED';
  event.resolvedAtMinute = state.world.clockMinutes; event.resolutionActionId = 'AUTO_RUMOR_SPREAD';
  event.rumorReachedHostIds = Object.values(state.hosts).filter(host => !event.actorHostIds.includes(host.id)
    && host.historicalAliveAndPresent !== false && host.mapId === 'market-quay'
    && nearTile(host.position, event.scenePosition, 6)).map(host => host.id).sort();
  for (const id of event.rumorReachedHostIds) recordRumorHearing(state, { recipientHostId: id, fromHostId: event.carrierHostId, status: 'UNVERIFIED' });
  livingEventRows.push(livingMarketRumorEventRow(state, event.stage, minuteOffset, maps,
    { changeKo: '확인이나 정정이 나오지 않자, 장터에 있던 사람들이 출처가 확인되지 않은 말을 들었다.',
      rumorReachedHostIds: [...event.rumorReachedHostIds], resolutionActionId: event.resolutionActionId }));
}
function innGuestEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E17, position = event?.scenePosition ?? { x: 10, y: 10 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E17', stage,
    stageIndex: ({ ROOM_REQUESTED: 1, GUEST_ARRIVED: 2, ROOM_RENTED: 3, RATE_REDUCED: 3,
      BED_OFFERED: 3, ROOM_DECLINED: 3, AUTO_ROOM_RENTED: 3, AUTO_LEFT_UNSERVED: 3 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute: minuteOffset, mapId: 'inn-interior', position: { ...position },
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance', state: event ? clone(event) : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'inn-interior', position, 6, maps), ...details };
}
function beginInnGuestEvent(state, minuteOffset, maps, livingEventRows) {
  state.world.livingEventStates ??= {};
  if (state.world.livingEventStates.E17 || state.world.activeRealm || state.world.chapterId !== 'V33_1847_PRINT'
    || !/^184[7-9]-\d\d-\d\d$/.test(state.world.date)) return;
  const minute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
  const guest = state.hosts.courier_pavel, innkeeper = state.hosts.innkeeper_irina, venue = maps?.['inn-interior'];
  const object = layer(venue, 'Interactions')?.objects.find(item => item.id === 4006);
  if (state.world.currentMapId !== 'inn-interior' || minute < 840 || minute > 1260 || !guest || !innkeeper || !object
    || guest.historicalAliveAndPresent === false || innkeeper.historicalAliveAndPresent === false
    || guest.needs?.fatigue < Math.max(32, (guest.needs?.restThreshold ?? 68) - 24)
    || guest.money?.unit !== 'kopeks'
    || !guest.allowedMaps.includes('inn-interior') || !innkeeper.allowedMaps.includes('inn-interior')
    || npcMapRoute(guest.mapId, 'inn-interior', guest, maps, state.world.clockMinutes, { allowClosedMapIds: ['inn-interior'] }) === null) return;
  const position = objectTile(object);
  const witnesses = Object.values(state.hosts).filter(person => ![guest.id, innkeeper.id].includes(person.id)
    && person.historicalAliveAndPresent !== false && person.mapId === 'inn-interior'
    && nearTile(person.position, position, 5)).map(person => person.id).sort();
  const event = state.world.livingEventStates.E17 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E17',
    status: 'ACTIVE', stage: 'ROOM_REQUESTED', trigger: 'late_evening_arrival_after_delivery_route',
    triggerMechanism: 'courier_fatigue_and_evening_hour_prompt_a_short_paid_rest',
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    startedAtMinute: state.world.clockMinutes, autoResolveAtMinute: state.world.clockMinutes + 45,
    guestHostId: guest.id, innkeeperHostId: innkeeper.id, actorHostIds: [guest.id, innkeeper.id],
    witnessHostIds: witnesses, scenePosition: position, roomId: 'INN_GUEST_ROOM_01',
    fullRate: 2, reducedRate: 1, valueStatus: 'fictional_gameplay_balance', resolutionActionId: null };
  state.world.innGuestLastTriggeredDate = state.world.date;
  livingEventRows.push(innGuestEventRow(state, event.stage, minuteOffset, maps,
    { changeKo: '저녁 배달을 마친 파벨이 여관에 들러 하룻밤 쉴 방을 물었다.' }));
}
function settleInnGuestStay(state, event, stage, payerHostId, amount, minuteOffset, maps, livingEventRows, actionId) {
  const guest = state.hosts[event.guestHostId], innkeeper = state.hosts[event.innkeeperHostId], payer = state.hosts[payerHostId];
  if (!guest || !innkeeper || !payer || (amount > 0 && (payer.money?.unit !== 'kopeks'
    || innkeeper.money?.unit !== 'kopeks' || payer.money.amount < amount))) return false;
  if (amount > 0) { payer.money.amount -= amount; innkeeper.money.amount += amount; }
  const nextMorning = (Math.floor(state.world.clockMinutes / 1440) + 1) * 1440 + 480;
  state.world.temporaryLodgingStays ??= {};
  state.world.temporaryLodgingStays[guest.id] = { eventId: 'E17', roomId: event.roomId, mapId: 'inn-interior',
    position: { ...event.scenePosition }, untilMinute: nextMorning, paidAmount: amount, valueStatus: 'fictional_gameplay_balance' };
  state.world.innGuestRecords ??= [];
  state.world.innGuestRecords.push({ eventId: 'E17', guestHostId: guest.id, innkeeperHostId: innkeeper.id,
    date: state.world.date, roomId: event.roomId, checkInMinute: state.world.clockMinutes, checkOutMinute: nextMorning,
    paidAmount: amount, payerHostId, audienceHostIds: [...event.actorHostIds], resolutionActionId: actionId,
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION' });
  if (state.world.innGuestRecords.length > 32) state.world.innGuestRecords.shift();
  guest.relations[innkeeper.id] = amount ? '늦은 배달 뒤 여관방을 빌린 손님' : '늦은 배달 뒤 하룻밤 쉴 방을 얻은 손님';
  innkeeper.relations[guest.id] = amount ? '배달 뒤 방값을 낸 손님' : '배달 뒤 방을 내어 준 손님';
  event.status = 'RESOLVED'; event.stage = stage; event.resolvedAtMinute = state.world.clockMinutes;
  event.resolutionActionId = actionId; event.paidAmount = amount; event.payerHostId = payerHostId;
  livingEventRows.push(innGuestEventRow(state, stage, minuteOffset, maps,
    { changeKo: amount ? `파벨은 ${amount}코페이카를 내고 다음 날 아침까지 방을 빌렸다.` : '이리나는 파벨에게 오늘 밤 쉴 방을 내주었다. 돈은 오가지 않았다.',
      paidAmount: amount, payerHostId, roomOccupiedUntilMinute: nextMorning, resolutionActionId: actionId }));
  return true;
}
function advanceInnGuestEvent(state, minuteOffset, maps, livingEventRows) {
  state.world.livingEventStates ??= {};
  const event = state.world.livingEventStates.E17;
  if (!event) { beginInnGuestEvent(state, minuteOffset, maps, livingEventRows); return; }
  if (event.status !== 'ACTIVE') return;
  const guest = state.hosts[event.guestHostId], innkeeper = state.hosts[event.innkeeperHostId];
  const arrived = [guest, innkeeper].every(person => person && person.historicalAliveAndPresent !== false
    && person.mapId === 'inn-interior' && nearTile(person.position, event.scenePosition, 2));
  if (arrived && event.stage === 'ROOM_REQUESTED') {
    event.stage = 'GUEST_ARRIVED'; event.arrivedAtMinute = state.world.clockMinutes;
    for (const person of [guest, innkeeper]) if (person && !event.witnessHostIds.includes(person.id)) event.witnessHostIds.push(person.id);
    livingEventRows.push(innGuestEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '파벨과 이리나가 여관 장부 앞에서 방값과 머물 시간을 확인한다.' }));
  }
  if (state.world.clockMinutes < event.autoResolveAtMinute) return;
  if (guest?.money?.amount >= event.fullRate && guest.money.unit === innkeeper?.money?.unit) {
    settleInnGuestStay(state, event, 'AUTO_ROOM_RENTED', guest.id, event.fullRate, minuteOffset, maps, livingEventRows, 'AUTO_INN_ROOM_RENTED');
  } else {
    event.status = 'RESOLVED'; event.stage = 'AUTO_LEFT_UNSERVED'; event.resolvedAtMinute = state.world.clockMinutes;
    event.resolutionActionId = 'AUTO_NO_AFFORDABLE_ROOM';
    if (guest) guest.relations[event.innkeeperHostId] = '여관방 값을 마련하지 못해 돌아간 손님';
    livingEventRows.push(innGuestEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '방값을 마련하지 못한 파벨은 방을 빌리지 않고 자기 하숙방으로 돌아갔다.', resolutionActionId: event.resolutionActionId }));
  }
}
function newspaperIssueEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E22, position = event?.scenePosition ?? { x: 25, y: 15 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E22', stage,
    stageIndex: ({ ISSUE_SOLD: 1, DISCUSSION_OPEN: 2, READ_ALOUD: 3, SOURCE_METADATA_COMPARED: 3,
      PUBLIC_COMMENT: 3, PRIVATE_READING: 3, AUTO_CLOSED: 3 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute: minuteOffset, mapId: 'nevsky', position: { ...position },
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance', sourceId: event?.sourceId ?? null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'nevsky', position, 6, maps), state: event ? clone(event) : null, ...details };
}
function advanceNewspaperIssueEvent(state, minuteOffset, maps, livingEventRows, options = {}) {
  const event = state.world.livingEventStates?.E22;
  if (!event || event.status !== 'ACTIVE' || options.deferLivingEventExpiryId === 'E22') return;
  const seller = state.hosts[event.sellerHostId], buyer = state.hosts[event.buyerHostId];
  const present = [seller, buyer].every(person => person && person.historicalAliveAndPresent !== false
    && person.mapId === 'nevsky' && nearTile(person.position, event.scenePosition, 3));
  if (event.stage === 'ISSUE_SOLD' && present) {
    event.stage = 'DISCUSSION_OPEN'; event.gatheredAtMinute = state.world.clockMinutes;
    livingEventRows.push(newspaperIssueEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '레프와 새 호를 산 독자가 가판 앞에 섰다. 호차와 발행인 정보가 적힌 서지 기록을 함께 확인할 수 있다.' }));
  }
  if (state.world.clockMinutes < event.autoResolveAtMinute) return;
  event.status = 'RESOLVED'; event.stage = 'AUTO_CLOSED'; event.resolvedAtMinute = state.world.clockMinutes;
  event.resolutionActionId = 'AUTO_ISSUE_LEFT_UNREAD';
  livingEventRows.push(newspaperIssueEventRow(state, event.stage, minuteOffset, maps,
    { changeKo: '정해진 시간 동안 서지 기록을 함께 읽거나 의견을 남기지 않아, 종이 호는 구매자의 소지품에 남았다.',
      resolutionActionId: event.resolutionActionId }));
}
function lateMealEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E18;
  const position = event?.scenePosition ?? { x: 10, y: 12 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E18', stage,
    stageIndex: ({ MEAL_REQUESTED: 1, MEAL_PAID: 2, SMALL_MEAL_PAID: 2, MEAL_DECLINED: 2, AUTO_SERVED: 2, AUTO_DECLINED: 2 })[stage],
    actorHostIds: [event?.buyerHostId, event?.sellerHostId].filter(Boolean), witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute: minuteOffset, mapId: 'inn-interior', position: { ...position },
    ...(event?.sourceEventId ? { sourceEventId: event.sourceEventId } : {}),
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance', state: event ? clone(event) : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'inn-interior', position, 6, maps), ...details };
}
function beginLateMealEvent(state, buyer, seller, offer, price, minuteOffset, maps, livingEventRows) {
  const sourceEventId = activeMealSeekingCauseEventId(buyer, state);
  const position = { ...seller.position };
  const witnesses = Object.values(state.hosts).filter(person => person.id !== buyer.id && person.id !== seller.id
    && person.historicalAliveAndPresent !== false && person.mapId === 'inn-interior' && nearTile(person.position, position, 4))
    .map(person => person.id).sort();
  const event = state.world.livingEventStates.E18 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E18',
    status: 'ACTIVE', stage: 'MEAL_REQUESTED', startedAtMinute: state.world.clockMinutes, resolvesAtMinute: state.world.clockMinutes + 30,
    buyerHostId: buyer.id, sellerHostId: seller.id, actorHostIds: [buyer.id, seller.id], witnessHostIds: witnesses,
    itemKo: offer.itemKo, price, smallPortionPrice: Math.max(1, Math.floor(price / 2)), unit: offer.unit,
    ...(sourceEventId ? { sourceEventId } : {}),
    fullHungerRelief: offer.hungerRelief, smallHungerRelief: Math.max(1, Math.floor(offer.hungerRelief / 2)),
    scenePosition: { ...position }, stockAtRequest: seller.marketStock[offer.itemKo], resolutionActionId: null,
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance' };
  livingEventRows.push(lateMealEventRow(state, event.stage, minuteOffset, maps,
    { changeKo: '허기가 큰 손님이 여관의 저녁 수프를 주문하고, 지불과 양을 정하기 전 잠시 기다린다.', price, itemKo: offer.itemKo }));
  delete buyer.needs.mealSeekingCauseEventId;
  delete buyer.needs.mealSeekingCauseExpiresAtMinute;
}
function advanceLateMealEvent(state, minuteOffset, maps, livingEventRows, options = {}) {
  const event = state.world.livingEventStates?.E18;
  if (event?.status !== 'ACTIVE' || options.deferLivingEventExpiryId === 'E18'
    || state.world.clockMinutes < event.resolvesAtMinute) return;
  const buyer = state.hosts[event.buyerHostId], seller = state.hosts[event.sellerHostId];
  if (buyer && seller && buyer.historicalAliveAndPresent !== false && seller.historicalAliveAndPresent !== false
    && seller.marketStock?.[event.itemKo] > 0 && buyer.money?.unit === event.unit && seller.money?.unit === event.unit
    && buyer.money.amount >= event.price) {
    seller.marketStock[event.itemKo] -= 1;
    buyer.money.amount -= event.price;
    seller.money.amount += event.price;
    buyer.needs.hunger = Math.max(0, buyer.needs.hunger - event.fullHungerRelief);
    buyer.needs.lastMealAtMinute = state.world.clockMinutes;
    event.stage = 'AUTO_SERVED'; event.resolutionActionId = 'AUTO_PAY_FOR_LATE_MEAL';
  } else {
    event.stage = 'AUTO_DECLINED'; event.resolutionActionId = 'AUTO_MEAL_UNAFFORDABLE';
  }
  event.status = 'RESOLVED'; event.resolvedAtMinute = state.world.clockMinutes;
  livingEventRows.push(lateMealEventRow(state, event.stage, minuteOffset, maps,
    { changeKo: event.stage === 'AUTO_SERVED' ? '기다리던 손님은 가진 돈으로 정량의 저녁을 사 먹었다.' : '손님이 값을 치르기 어려워 거래가 성사되지 않았다.', resolutionActionId: event.resolutionActionId }));
}
function charityMealEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E14, position = event?.scenePosition ?? { x: 5, y: 5 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E14', stage,
    stageIndex: ({ RELIEF_ANNOUNCED: 1, RELIEF_LINE_FORMS: 2, RATION_PURCHASED: 3, RATION_SPONSORED: 3,
      RATION_DONATED: 3, AID_DECLINED: 3, AUTO_SPONSORED: 3, AUTO_DONATED: 3, LINE_CLOSED: 3 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute: minuteOffset, mapId: 'market-quay', position: { ...position },
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance', state: event ? clone(event) : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'market-quay', position, 6, maps), ...details };
}
function beginCharityMealEvent(state, minuteOffset, maps, livingEventRows) {
  const date = state.world.date, minute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
  const market = state.hosts.market_nadezhda, poor = state.hosts.tenant_mikhail, organizer = state.hosts.yardkeeper_semyon;
  const venue = maps?.['market-quay'], object = layer(venue, 'Interactions')?.objects.find(item => item.id === 1175);
  if (state.world.activeRealm || state.world.chapterId !== 'V33_1847_PRINT' || !venue || !object
    || !/^184[7-9]-\d\d-\d\d$/.test(date) || new Date(`${date}T00:00:00Z`).getUTCDay() !== 0
    || minute !== 720 || state.world.charityDayLastTriggeredDate === date
    || state.world.livingEventStates?.E14 || !market || !poor || !organizer
    || market.historicalAliveAndPresent === false || poor.historicalAliveAndPresent === false || organizer.historicalAliveAndPresent === false
    || (market.marketStock?.['빵 한 묶음'] ?? 0) < 1 || poor.needs?.hunger < 65
    || !market.allowedMaps.includes('market-quay') || !poor.allowedMaps.includes('market-quay') || !organizer.allowedMaps.includes('market-quay')) return;
  const position = objectTile(object), witnesses = Object.values(state.hosts).filter(host => ![market.id, poor.id, organizer.id].includes(host.id)
    && host.historicalAliveAndPresent !== false && host.mapId === 'market-quay' && nearTile(host.position, position, 5)).map(host => host.id).sort();
  const event = state.world.livingEventStates.E14 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E14',
    status: 'ACTIVE', stage: 'RELIEF_ANNOUNCED', startedAtMinute: state.world.clockMinutes,
    resolvesAtMinute: state.world.clockMinutes + 360, donorHostId: market.id, organizerHostId: organizer.id,
    recipientHostId: poor.id, actorHostIds: [organizer.id, market.id, poor.id], witnessHostIds: witnesses,
    itemKo: '빵 한 묶음', price: 1, scenePosition: position, stockAtOpening: market.marketStock['빵 한 묶음'],
    resolutionActionId: null, occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED', valueStatus: 'fictional_gameplay_balance', venueBasis: 'FICTIONAL_MARKET_RELIEF_RECONSTRUCTION' };
  state.world.charityDayLastTriggeredDate = date;
  livingEventRows.push(charityMealEventRow(state, event.stage, minuteOffset, maps,
    { changeKo: '일요일 한낮, 시장에 남은 빵 한 묶음을 구호 몫으로 돌릴 수 있다는 말에 세 사람이 좌판 곁으로 모인다.',
      supplyItemKo: event.itemKo, availableStock: event.stockAtOpening, venueBasis: event.venueBasis }));
}
function settleCharityRation(state, event, stage, payerHostId, minuteOffset, maps, livingEventRows, resolutionActionId) {
  const donor = state.hosts[event.donorHostId], recipient = state.hosts[event.recipientHostId], payer = payerHostId ? state.hosts[payerHostId] : null;
  if (!donor || !recipient || (donor.marketStock?.[event.itemKo] ?? 0) < 1
    || (payerHostId && (!payer || payer.money?.unit !== donor.money?.unit || payer.money.amount < event.price))) return false;
  donor.marketStock[event.itemKo] -= 1;
  if (payer) { payer.money.amount -= event.price; donor.money.amount += event.price; }
  recipient.inventory.push(event.itemKo);
  const hungerBefore = recipient.needs.hunger;
  recipient.needs.hunger = Math.max(0, hungerBefore - 32);
  recipient.needs.lastMealAtMinute = state.world.clockMinutes;
  recipient.relations[donor.id] = payer ? '구호 줄에서 값을 낮춰 빵을 건넨 시장 상인' : '일요일 구호 몫으로 빵을 내어 준 시장 상인';
  donor.relations[recipient.id] = payer ? '구호 탁자에서 빵값을 낸 이웃' : '구호 빵을 받은 안뜰 이웃';
  if (event.organizerHostId !== payerHostId) {
    recipient.relations[event.organizerHostId] = '시장 구호 줄을 챙긴 안뜰 관리인';
    state.hosts[event.organizerHostId].relations[recipient.id] = '구호 빵을 받아 간 안뜰 이웃';
  }
  event.status = 'RESOLVED'; event.stage = stage; event.resolvedAtMinute = state.world.clockMinutes;
  event.resolutionActionId = resolutionActionId; event.resolvedByHostId = payerHostId ?? event.donorHostId;
  livingEventRows.push(charityMealEventRow(state, stage, minuteOffset, maps,
    { changeKo: stage === 'RATION_DONATED' || stage === 'AUTO_DONATED' ? '상인은 빵 한 묶음을 구호 몫으로 내놓았다.'
      : stage === 'AUTO_SPONSORED' ? '안뜰 관리인은 공동 돈으로 빵값을 치렀고, 시장 상인은 한 묶음을 건넸다.'
        : '빵 한 묶음이 값을 치르고 구호 줄의 주민에게 전달됐다.',
      itemKo: event.itemKo, payerHostId, recipientHostId: recipient.id, hungerBefore, hungerAfter: recipient.needs.hunger,
      moneyPaid: payer ? event.price : 0, stockAfter: donor.marketStock[event.itemKo], resolutionActionId }));
  return true;
}
function advanceCharityMealEvent(state, minuteOffset, maps, livingEventRows, options = {}) {
  const event = state.world.livingEventStates?.E14;
  if (!event) { beginCharityMealEvent(state, minuteOffset, maps, livingEventRows); return; }
  if (event.status !== 'ACTIVE' || options.deferLivingEventExpiryId === 'E14') return;
  const participants = event.actorHostIds.map(id => state.hosts[id]);
  const gathered = participants.length === 3 && participants.every(host => host && host.historicalAliveAndPresent !== false
    && host.mapId === 'market-quay' && nearTile(host.position, event.scenePosition, 5));
  if (gathered && event.stage === 'RELIEF_ANNOUNCED') {
    event.stage = 'RELIEF_LINE_FORMS';
    livingEventRows.push(charityMealEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '안뜰 관리인과 시장 상인, 배가 고픈 세입자가 좌판 곁 구호 줄에 모였다.' }));
  }
  if (state.world.clockMinutes < event.resolvesAtMinute) return;
  if (event.stage === 'RELIEF_LINE_FORMS') {
    const payer = state.hosts[event.organizerHostId];
    if (payer.money.amount >= event.price && settleCharityRation(state, event, 'AUTO_SPONSORED', payer.id, minuteOffset, maps, livingEventRows, 'AUTO_COMMUNAL_PURCHASE')) return;
    if (settleCharityRation(state, event, 'AUTO_DONATED', null, minuteOffset, maps, livingEventRows, 'AUTO_VENDOR_DONATION')) return;
  }
  event.status = 'RESOLVED'; event.stage = 'LINE_CLOSED'; event.resolvedAtMinute = state.world.clockMinutes;
  event.resolutionActionId = 'AUTO_LINE_CLOSED_WITHOUT_AID';
  const recipient = state.hosts[event.recipientHostId];
  recipient.needs.safetyConcern = Math.min(100, recipient.needs.safetyConcern + 3);
  livingEventRows.push(charityMealEventRow(state, event.stage, minuteOffset, maps,
    { changeKo: '구호 줄이 열리지 못해 빵은 좌판에 남았다. 세입자는 빈손으로 안뜰에 돌아갔다.',
      recipientHostId: recipient.id, safetyConcernAfter: recipient.needs.safetyConcern }));
}
function apprenticeLiteracyEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E19, position = event?.scenePosition ?? { x: 14, y: 11 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E19', stage,
    stageIndex: ({ LESSON_REQUESTED: 1, LESSON_READY: 2, LESSON_COMPLETED: 3, LESSON_PAID: 3,
      LESSON_DECLINED: 3, PRACTICED_UNATTENDED: 3, LESSON_POSTPONED: 3 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute: minuteOffset, mapId: 'printshop', position: { ...position },
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance', witnessedByPlayer: playerCanObserveWorldEvent(state, 'printshop', position, 6, maps), ...details };
}
function completeApprenticeLesson(state, event, stage, minuteOffset, maps, livingEventRows, { actionId, payerHostId = null, practiced = true } = {}) {
  const teacher = state.hosts[event.teacherHostId], student = state.hosts[event.studentHostId];
  if (!teacher || !student) return;
  if (practiced) {
    student.skills ??= {};
    student.skills.basicReading = Math.min(5, (student.skills.basicReading ?? 0) + 1);
    const sheet = '류보프와 함께 읽은 연습지';
    if (!student.inventory.includes(sheet)) student.inventory.push(sheet);
    student.needs.fatigue = Math.min(100, student.needs.fatigue + 5);
    teacher.needs.fatigue = Math.min(100, teacher.needs.fatigue + 3);
    student.relations[teacher.id] = payerHostId ? '읽기를 가르쳐 주고 보수를 받은 교사' : '저녁에 글을 함께 읽은 교사';
    teacher.relations[student.id] = payerHostId ? '수업료를 내고 읽기를 배운 견습생' : '저녁에 글을 함께 읽은 견습생';
  }
  event.status = 'RESOLVED'; event.stage = stage; event.resolvedAtMinute = state.world.clockMinutes;
  event.resolutionActionId = actionId; event.payerHostId = payerHostId;
  livingEventRows.push(apprenticeLiteracyEventRow(state, stage, minuteOffset, maps,
    { changeKo: practiced ? '스테판은 류보프와 활자 줄을 읽고 연습지를 챙겼다.' : '두 사람은 오늘 연습을 미루고 각자 돌아갔다.',
      actionId, payerHostId, studentSkillAfter: student.skills?.basicReading ?? 0,
      studentFatigueAfter: student.needs.fatigue, teacherFatigueAfter: teacher.needs.fatigue }));
}
function advanceApprenticeLiteracy(state, minuteOffset, maps, livingEventRows, options = {}) {
  const date = state.world.date, localMinute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
  let event = state.world.livingEventStates?.E19;
  if (!event && state.world.livingEventStates.E21?.status !== 'ACTIVE'
    && state.world.chapterId === 'V33_1847_PRINT' && !state.world.activeRealm
    && /^184[7-9]-\d\d-\d\d$/.test(date) && localMinute === 1000) {
    const map = maps?.printshop, object = layer(map, 'Interactions')?.objects.find(item => item.id === 1175);
    const teacher = state.hosts.teacher_lyubov, student = state.hosts.print_apprentice_stepan;
    if (map && object && teacher?.historicalAliveAndPresent !== false && student?.historicalAliveAndPresent !== false
      && teacher.allowedMaps.includes('printshop') && student.allowedMaps.includes('printshop')
      && npcMapRoute(teacher.mapId, 'printshop', teacher, maps, state.world.clockMinutes) !== null
      && npcMapRoute(student.mapId, 'printshop', student, maps, state.world.clockMinutes) !== null) {
      const position = objectTile(object);
      const witnesses = Object.values(state.hosts).filter(host => ![teacher.id, student.id].includes(host.id)
        && host.historicalAliveAndPresent !== false && host.mapId === 'printshop' && nearTile(host.position, position, 5)).map(host => host.id).sort();
      event = state.world.livingEventStates.E19 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E19',
        status: 'ACTIVE', stage: 'LESSON_REQUESTED', startedAtMinute: state.world.clockMinutes,
        resolvesAtMinute: state.world.clockMinutes + 360, teacherHostId: teacher.id, studentHostId: student.id,
        actorHostIds: [teacher.id, student.id], witnessHostIds: witnesses, scenePosition: position,
        resolutionActionId: null, occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
        validationStatus: 'DESIGN_SEED_NOT_VERIFIED', valueStatus: 'fictional_gameplay_balance',
        venueBasis: 'FICTIONAL_AFTER_WORK_PRINTSHOP_PRACTICE' };
      livingEventRows.push(apprenticeLiteracyEventRow(state, event.stage, minuteOffset, maps,
        { changeKo: '작업이 끝난 저녁, 견습생 스테판이 교사 류보프에게 글 읽기를 부탁했다.', venueBasis: event.venueBasis }));
    }
  }
  if (!event || event.status !== 'ACTIVE' || options.deferLivingEventExpiryId === 'E19') return;
  const teacher = state.hosts[event.teacherHostId], student = state.hosts[event.studentHostId];
  const gathered = [teacher, student].every(host => host && host.historicalAliveAndPresent !== false
    && host.mapId === 'printshop' && nearTile(host.position, event.scenePosition, 5));
  if (gathered && event.stage === 'LESSON_REQUESTED') {
    event.stage = 'LESSON_READY'; event.gatheredAtMinute = state.world.clockMinutes;
    event.practiceDurationMinutes = 30;
    event.resolvesAtMinute = state.world.clockMinutes + event.practiceDurationMinutes;
    livingEventRows.push(apprenticeLiteracyEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '류보프와 스테판이 인쇄소 작업대 곁에 모여 연습할 글자를 펼쳤다.' }));
  }
  if (state.world.clockMinutes < event.resolvesAtMinute) return;
  if (event.stage === 'LESSON_READY' && gathered) {
    completeApprenticeLesson(state, event, 'PRACTICED_UNATTENDED', minuteOffset, maps, livingEventRows,
      { actionId: 'AUTO_SHARED_READING_PRACTICE' });
  } else {
    completeApprenticeLesson(state, event, 'LESSON_POSTPONED', minuteOffset, maps, livingEventRows,
      { actionId: 'AUTO_NO_LESSON_TODAY', practiced: false });
  }
}
function studentCircleEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E24;
  const position = event?.scenePosition ?? { x: 15, y: 13 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E24', stage,
    stageIndex: ({ INVITATION_POSTED: 1, CIRCLE_READY: 2, SPOKE_WITH_NAME: 3, LISTENED_UNLISTED: 3,
      ROSTER_KEPT_PRIVATE: 3, UNATTENDED_DISCUSSION: 3, CIRCLE_POSTPONED: 3 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute: minuteOffset, mapId: 'courtyard', position: { ...position },
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance',
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'courtyard', position, 6, maps), ...details };
}
function policeDocumentCheckEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E25, position = event?.scenePosition ?? { x: 5, y: 3 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E25', stage,
    stageIndex: ({ CHECK_REQUESTED: 1, INTERVIEW_READY: 2, ROUTE_ENTERED: 3, SCOPE_ASKED: 3,
      LEFT_UNANSWERED: 3, CHECK_CLOSED_UNATTENDED: 3 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], date: state.world.date, minute: minuteOffset,
    mapId: 'police-station', position: { ...position }, valueStatus: 'fictional_gameplay_balance',
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'police-station', position, 6, maps), ...details };
}
function startPoliceDocumentCheck(state, minuteOffset, maps, livingEventRows) {
  state.world.livingEventStates ??= {};
  if (state.world.livingEventStates.E25 || state.world.chapterId !== 'V33_1847_PRINT' || state.world.activeRealm
    || state.quests?.PAVEL_MISSING_PARCEL_1847?.result !== 'PAVEL_REPORT_MISSING_PARCEL'
    || state.world.livingEventStates.E05?.resolutionActionId !== 'PAVEL_REPORT_MISSING_PARCEL') return;
  const courier = state.hosts.courier_pavel, officer = state.hosts.police_sergeant_ivan;
  const map = maps?.['police-station'], target = layer(map, 'Interactions')?.objects.find(item => item.id === 1174);
  if (!courier || !officer || !target || [courier, officer].some(host => host.historicalAliveAndPresent === false)
    || !courier.allowedMaps.includes('police-station') || !officer.allowedMaps.includes('police-station')
    || npcMapRoute(courier.mapId, 'police-station', courier, maps, state.world.clockMinutes) === null
    || npcMapRoute(officer.mapId, 'police-station', officer, maps, state.world.clockMinutes) === null) return;
  const position = { x: 5, y: 3 };
  const witnesses = Object.values(state.hosts).filter(host => ![courier.id, officer.id].includes(host.id)
    && host.historicalAliveAndPresent !== false && host.mapId === 'police-station'
    && nearTile(host.position, position, 5)).map(host => host.id).sort();
  const event = state.world.livingEventStates.E25 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E25',
    status: 'ACTIVE', stage: 'CHECK_REQUESTED', trigger: 'courier_loss_report_requests_route_confirmation',
    startedAtMinute: state.world.clockMinutes, courierHostId: courier.id, officerHostId: officer.id,
    actorHostIds: [courier.id, officer.id], witnessHostIds: witnesses, scenePosition: position,
    venueMapId: 'police-station', sourceEventId: 'E05', recordScope: 'NONE', resolutionActionId: null,
    valueStatus: 'fictional_gameplay_balance', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
  courier.activeGoal = { type: 'LIVING_EVENT_RESPONSE', taskId: 'V37:E25:ANSWER_CHECK', targetHostId: officer.id,
    reason: 'previously_reported_lost_parcel_requires_route_confirmation', selectionBasis: { utilityScore: 180, eventId: 'E25' } };
  officer.activeGoal = { type: 'LIVING_EVENT_RESPONSE', taskId: 'V37:E25:RECEIVE_COURIER', targetHostId: courier.id,
    reason: 'receive_courier_followup_to_fictional_loss_report', selectionBasis: { utilityScore: 180, eventId: 'E25' } };
  livingEventRows.push(policeDocumentCheckEventRow(state, event.stage, minuteOffset, maps,
    { sourceEventId: 'E05', changeKo: '분실 신고 뒤, 파벨이 배달 경로를 확인하러 경찰 접수실로 향한다.' }));
}
function advancePoliceDocumentCheck(state, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E25;
  if (event?.status !== 'ACTIVE') return;
  const courier = state.hosts[event.courierHostId], officer = state.hosts[event.officerHostId];
  if (!courier || !officer) return;
  if (event.stage === 'CHECK_REQUESTED' && courier.mapId === 'police-station' && officer.mapId === 'police-station'
    && nearTile(courier.position, event.scenePosition, 4) && nearTile(officer.position, event.scenePosition, 4)) {
    event.stage = 'INTERVIEW_READY'; event.gatheredAtMinute = state.world.clockMinutes;
    event.closesAtMinute = state.world.clockMinutes + 90;
    livingEventRows.push(policeDocumentCheckEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '파벨과 이반이 접수 창구에서 마주 섰다. 장부에는 아직 새 항목이 없다.' }));
  }
  if (event.stage === 'CHECK_REQUESTED' && state.world.clockMinutes >= event.startedAtMinute + 360) {
    event.stage = 'CHECK_CLOSED_UNATTENDED'; event.status = 'RESOLVED';
    event.resolvedAtMinute = state.world.clockMinutes; event.resolutionActionId = 'AUTO_COURIER_LEFT_AFTER_WAIT';
    event.recordScope = 'NONE';
    livingEventRows.push(policeDocumentCheckEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '기다리던 파벨이 돌아가면서 경로 확인은 미뤄졌다. 새 접수 기록은 남지 않았다.' }));
  } else if (event.stage === 'INTERVIEW_READY' && state.world.clockMinutes >= event.closesAtMinute) {
    event.stage = 'CHECK_CLOSED_UNATTENDED'; event.status = 'RESOLVED';
    event.resolvedAtMinute = state.world.clockMinutes; event.resolutionActionId = 'AUTO_COURIER_LEFT_AFTER_WAIT';
    event.recordScope = 'NONE';
    livingEventRows.push(policeDocumentCheckEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '파벨은 더 기다리지 않고 돌아갔다. 접수 장부에는 추가 답변이 남지 않았다.' }));
  }
  if (event.status === 'RESOLVED') {
    if (courier.activeGoal?.taskId?.startsWith('V37:E25:')) courier.activeGoal = null;
    if (officer.activeGoal?.taskId?.startsWith('V37:E25:')) officer.activeGoal = null;
  }
}
function streetMusicEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E38;
  const position = event?.scenePosition ?? { x: 20, y: 15 };
  const mapId = event?.venueMapId ?? 'nevsky';
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E38', stage,
    date: state.world.date, minute: minuteOffset, actorHostIds: [...(event?.actorHostIds ?? [])],
    mapId, position: { ...position }, occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED', valueStatus: 'fictional_gameplay_balance',
    witnessedByPlayer: playerCanObserveWorldEvent(state, mapId, position, 6, maps), ...details };
}
function advanceStreetMusicEvent(state, minuteOffset, maps, livingEventRows) {
  state.world.livingEventStates ??= {};
  let event = state.world.livingEventStates.E38;
  const dayIndex = Math.floor(state.world.clockMinutes / 1440);
  if (event?.status === 'RESOLVED' && event.performanceDayIndex !== dayIndex) {
    delete state.world.livingEventStates.E38;
    state.quests.V37_STREET_MUSIC_1847 = { status: 'open', result: null };
    event = null;
  }
  if (event?.status === 'ACTIVE') {
    if (state.world.clockMinutes < event.endsAtMinute) return;
    const musician = state.hosts[event.musicianHostId];
    const listener = ['street_vendor_matryona', 'watercarrier_luka', 'reader_darya', 'market_nadezhda']
      .map(id => state.hosts[id]).find(host => host && host.id !== musician?.id && host.historicalAliveAndPresent !== false
        && host.id !== event?.playerTipHostId
        && host.mapId === event.venueMapId && nearTile(host.position, event.scenePosition, 5)
        && host.money?.unit === musician?.money?.unit && host.money.amount >= 1);
    if (listener && musician) {
      listener.money.amount -= 1; musician.money.amount += 1;
      listener.relations[musician.id] = '네프스키 거리에서 연주를 듣고 동전 한 푼을 건넨 사람';
      musician.relations[listener.id] = '연주를 듣고 동전을 건넨 행인';
      event.tipHostId = listener.id; event.tipAmount = 1; event.stage = 'TIP_RECEIVED';
    } else event.stage = 'PERFORMANCE_ENDED';
    event.status = 'RESOLVED'; event.resolvedAtMinute = state.world.clockMinutes;
    event.resolutionActionId = 'AUTO_PERFORMANCE_ENDED';
    if (musician?.needs) musician.needs.fatigue = Math.min(100, musician.needs.fatigue + 4);
    livingEventRows.push(streetMusicEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: listener ? '연주가 끝나자 행인이 동전 한 푼을 건넸다.' : '연주가 끝났고 악사는 악기를 거두었다.',
        ...(listener ? { payerHostId: listener.id, recipientHostId: musician.id, paidAmount: 1 } : {}) }));
    return;
  }
  const localMinute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
  if (event || state.world.activeRealm || state.world.chapterId !== 'V33_1847_PRINT'
    || state.world.date < '1847-06-01' || localMinute < 600 || localMinute >= 900) return;
  const musician = state.hosts.street_musician_ivan;
  if (!musician || musician.historicalAliveAndPresent === false || musician.mapId !== 'nevsky'
    || !Number.isInteger(musician.position?.x) || !Number.isInteger(musician.position?.y)
    || !nearTile(musician.position, { x: 20, y: 14 }, 1)) return;
  const scenePosition = { x: 20, y: 14 };
  state.world.livingEventStates.E38 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E38',
    status: 'ACTIVE', stage: 'PERFORMING', trigger: 'street_musician_reaches_nevsky_at_performance_hour',
    startedAtMinute: state.world.clockMinutes, endsAtMinute: state.world.clockMinutes + 60,
    performanceDayIndex: dayIndex, musicianHostId: musician.id, actorHostIds: [musician.id], venueMapId: 'nevsky', scenePosition,
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance' };
  livingEventRows.push(streetMusicEventRow(state, 'PERFORMING', minuteOffset, maps,
    { changeKo: '네프스키 거리에서 악사가 연주를 시작했다.' }));
}

function advanceStudentCircle(state, minuteOffset, maps, livingEventRows) {
  state.world.livingEventStates ??= {};
  let event = state.world.livingEventStates.E24;
  const localMinute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
  if (!event && state.world.chapterId === 'V33_1847_PRINT' && !state.world.activeRealm
    && state.world.date === '1847-06-01' && localMinute >= 640 && localMinute < 700) {
    const student = state.hosts.student_vasily, organizer = state.hosts.reader_darya;
    const position = { x: 15, y: 13 };
    const map = maps?.courtyard, meeting = layer(map, 'Interactions')?.objects.find(item => item.id === 1174);
    if (student && organizer && meeting && student.historicalAliveAndPresent !== false
      && organizer.historicalAliveAndPresent !== false && student.allowedMaps.includes('courtyard')
      && npcMapRoute(organizer.mapId, 'courtyard', organizer, maps, state.world.clockMinutes,
        { allowUnlistedMapIds: ['courtyard'] }) !== null) {
      const witnesses = Object.values(state.hosts).filter(host => ![student.id, organizer.id].includes(host.id)
        && host.historicalAliveAndPresent !== false && host.mapId === 'courtyard'
        && nearTile(host.position, position, 5)).map(host => host.id).sort();
      event = state.world.livingEventStates.E24 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E24',
        status: 'ACTIVE', stage: 'INVITATION_POSTED', trigger: 'student_and_reader_arrive_at_the_shared_courtyard',
        startedAtMinute: state.world.clockMinutes, studentHostId: student.id, organizerHostId: organizer.id,
        actorHostIds: [student.id, organizer.id], witnessHostIds: witnesses, scenePosition: position,
        venueMapId: 'courtyard', venueBasis: 'FICTIONAL_NEIGHBORHOOD_READING_GATHERING',
        attendanceRecord: 'NONE', publicNames: [], resolutionActionId: null,
        occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
      organizer.activeGoal = { type: 'LIVING_EVENT_RESPONSE', taskId: 'V37:E24:ATTEND_CIRCLE',
        targetHostId: student.id, reason: 'reading_circle_invitation_at_shared_courtyard',
        selectionBasis: { utilityScore: 174, eventId: 'E24' } };
      livingEventRows.push(studentCircleEventRow(state, event.stage, minuteOffset, maps,
        { changeKo: '바실리가 안뜰에 독서 모임 자리를 펴고, 다리야가 네프스키에서 걸어오기 시작했다.', venueBasis: event.venueBasis }));
    }
  }
  if (!event || event.status !== 'ACTIVE') return;
  const student = state.hosts[event.studentHostId], organizer = state.hosts[event.organizerHostId];
  const gathered = [student, organizer].every(host => host && host.historicalAliveAndPresent !== false
    && host.mapId === event.venueMapId && nearTile(host.position, event.scenePosition, 4));
  if (gathered && event.stage === 'INVITATION_POSTED') {
    event.stage = 'CIRCLE_READY'; event.gatheredAtMinute = state.world.clockMinutes;
    event.closesAtMinute = state.world.clockMinutes + 90;
    livingEventRows.push(studentCircleEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '바실리와 다리야가 안뜰에 모여 책을 펴고, 참석 장부는 아직 비어 있다.' }));
  }
  if (event.stage === 'INVITATION_POSTED' && state.world.clockMinutes >= event.startedAtMinute + 120) {
    event.status = 'RESOLVED'; event.stage = 'CIRCLE_POSTPONED'; event.resolvedAtMinute = state.world.clockMinutes;
    event.resolutionActionId = 'AUTO_GATHERING_POSTPONED';
    livingEventRows.push(studentCircleEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '두 사람의 시간이 맞지 않아 모임을 미뤘다. 참석 장부에는 이름이 오르지 않았다.' }));
  } else if (event.stage === 'CIRCLE_READY' && state.world.clockMinutes >= event.closesAtMinute) {
    event.status = 'RESOLVED'; event.stage = 'UNATTENDED_DISCUSSION'; event.resolvedAtMinute = state.world.clockMinutes;
    event.resolutionActionId = 'AUTO_DISCUSSION_WITHOUT_PUBLIC_ROSTER'; event.attendanceRecord = 'PRIVATE_UNNAMED';
    student.relations[organizer.id] = '이름을 남기지 않고 함께 글을 읽은 독자';
    organizer.relations[student.id] = '참석 명단 없이 책을 함께 읽은 학생';
    if (organizer.activeGoal?.taskId === 'V37:E24:ATTEND_CIRCLE') organizer.activeGoal = null;
    livingEventRows.push(studentCircleEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '두 사람은 이름을 장부에 적지 않은 채 글을 읽었다. 공개 참석 명단은 남지 않았다.' }));
  }
}
function manuscriptOfferEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E30, position = event?.scenePosition ?? { x: 11, y: 12 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E30', stage,
    stageIndex: ({ OFFER_POSTED: 1, REVIEW_READY: 2, REVIEW_PURCHASED: 3, HELD_AT_BOOKSHOP: 3,
      RETURNED_WITHOUT_DEAL: 3, OFFER_WITHDRAWN_UNATTENDED: 3 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute: minuteOffset, mapId: 'bookshop-interior', position: { ...position },
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance', state: event ? clone(event) : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'bookshop-interior', position, 6, maps), ...details };
}
function advanceManuscriptOfferEvent(state, minuteOffset, maps, livingEventRows, options = {}) {
  state.world.livingEventStates ??= {};
  let event = state.world.livingEventStates.E30;
  if (!event) {
    const circle = state.world.livingEventStates.E24, actors = ['student_vasily', 'bookseller_lev', 'editor_sofia'].map(id => state.hosts[id]);
    const manuscriptObject = layer(maps?.['bookshop-interior'], 'Interactions')?.objects.find(item => item.id === 4010);
    if (state.world.chapterId !== 'V33_1847_PRINT' || state.world.activeRealm || state.world.date < '1847-06-01'
      || state.world.livingEventStates.E24?.status === 'ACTIVE'
      || circle?.status !== 'RESOLVED' || circle.stage === 'CIRCLE_POSTPONED' || !manuscriptObject
      || actors.some(host => !host || host.historicalAliveAndPresent === false || !host.allowedMaps.includes('bookshop-interior')
        || npcMapRoute(host.mapId, 'bookshop-interior', host, maps, state.world.clockMinutes) === null)) return;
    const [student, bookseller, editor] = actors, itemKo = '바실리의 접힌 원고';
    if (!student.inventory.includes(itemKo)) student.inventory.push(itemKo);
    event = state.world.livingEventStates.E30 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E30',
      status: 'ACTIVE', stage: 'OFFER_POSTED', trigger: 'student_brought_a_manuscript_after_the_reading_circle',
      startedAtMinute: state.world.clockMinutes, authorHostId: student.id, booksellerHostId: bookseller.id,
      editorHostId: editor.id, actorHostIds: actors.map(host => host.id), witnessHostIds: [],
      venueMapId: 'bookshop-interior', scenePosition: { x: 11, y: 12 }, manuscriptItemKo: itemKo,
      manuscriptHolderHostId: student.id, price: 2, unit: student.money.unit, resolutionActionId: null,
      occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
    livingEventRows.push(manuscriptOfferEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '독서 모임 뒤 바실리가 접힌 원고를 들고 책방에 왔다. 레프와 소피아가 원고를 살펴보러 이동한다.',
        sourceEventId: 'E24', manuscriptItemKo: itemKo }));
  }
  if (!event || event.status !== 'ACTIVE' || options.deferLivingEventExpiryId === 'E30') return;
  const actors = event.actorHostIds.map(id => state.hosts[id]);
  const gathered = actors.every(host => host && host.historicalAliveAndPresent !== false
    && host.mapId === event.venueMapId && nearTile(host.position, event.scenePosition, 5));
  if (gathered && event.stage === 'OFFER_POSTED') {
    event.stage = 'REVIEW_READY'; event.gatheredAtMinute = state.world.clockMinutes;
    event.closesAtMinute = state.world.clockMinutes + 120;
    livingEventRows.push(manuscriptOfferEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '바실리가 원고를 펼쳤다. 레프와 소피아가 인쇄비와 맡길 자리를 따져 본다.' }));
  }
  const expired = event.stage === 'OFFER_POSTED' && state.world.clockMinutes >= event.startedAtMinute + 240
    || event.stage === 'REVIEW_READY' && state.world.clockMinutes >= event.closesAtMinute;
  if (expired) {
    event.status = 'RESOLVED'; event.stage = 'OFFER_WITHDRAWN_UNATTENDED';
    event.resolvedAtMinute = state.world.clockMinutes; event.resolutionActionId = 'AUTO_AUTHOR_WITHDREW_MANUSCRIPT';
    event.manuscriptHolderHostId = event.authorHostId;
    for (const host of actors) {
      if (host.activeGoal?.taskId?.startsWith('V37:E30:')) host.activeGoal = null;
      if (host.id !== event.authorHostId) host.relations[event.authorHostId] ??= '원고를 검토하지 못한 책방의 사람';
    }
    livingEventRows.push(manuscriptOfferEventRow(state, event.stage, minuteOffset, maps,
      { actionId: event.resolutionActionId, changeKo: '바실리는 답을 기다리다 원고를 거두었다. 인쇄 계약과 돈은 오가지 않았다.' }));
  }
}
function serfdomReadingEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E31, position = event?.scenePosition ?? { x: 12, y: 12 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E31', stage,
    stageIndex: ({ BOOK_OPENED: 1, DISCUSSION_READY: 2, LANDLORD_DUTY_DISCUSSION: 3,
      OBEDIENCE_CHALLENGED: 3, PEASANT_VOICE_QUESTIONED: 3, DISCUSSION_ENDED: 3 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute: minuteOffset, mapId: 'bookshop-interior', position: { ...position },
    sourceIds: ['LIT-GOGOL-RUSSIAN-LANDLORD-1847'],
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'SOURCE_TEXT_VERIFIED_FICTIONAL_SCENE',
    state: event ? clone(event) : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'bookshop-interior', position, 6, maps), ...details };
}
function advanceSerfdomReadingEvent(state, minuteOffset, maps, livingEventRows, options = {}) {
  state.world.livingEventStates ??= {};
  let event = state.world.livingEventStates.E31;
  if (!event) {
    const manuscript = state.world.livingEventStates.E30;
    const actors = ['reader_darya', 'student_vasily', 'editor_sofia'].map(id => state.hosts[id]);
    const bookObject = layer(maps?.['bookshop-interior'], 'Interactions')?.objects.find(item => item.id === 4011);
    if (state.world.chapterId !== 'V33_1847_PRINT' || state.world.activeRealm || state.world.date < '1847-06-01'
      || manuscript?.status !== 'RESOLVED' || !bookObject
      || actors.some(host => !host || host.historicalAliveAndPresent === false || !host.allowedMaps.includes('bookshop-interior')
        || npcMapRoute(host.mapId, 'bookshop-interior', host, maps, state.world.clockMinutes) === null)) return;
    event = state.world.livingEventStates.E31 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E31',
      status: 'ACTIVE', stage: 'BOOK_OPENED', trigger: 'readers_opened_gogols_published_russian_landlord',
      startedAtMinute: state.world.clockMinutes, readerHostId: actors[0].id, studentHostId: actors[1].id,
      editorHostId: actors[2].id, actorHostIds: actors.map(host => host.id), witnessHostIds: [],
      venueMapId: 'bookshop-interior', scenePosition: { x: 12, y: 12 }, sourceId: 'LIT-GOGOL-RUSSIAN-LANDLORD-1847',
      resolutionActionId: null };
    livingEventRows.push(serfdomReadingEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '다리야가 고골의 책을 펼쳤다. 바실리와 소피아가 읽던 일을 멈추고 곁으로 왔다.' }));
  }
  if (!event || event.status !== 'ACTIVE' || options.deferLivingEventExpiryId === 'E31') return;
  const actors = event.actorHostIds.map(id => state.hosts[id]);
  const gathered = actors.every(host => host && host.historicalAliveAndPresent !== false
    && host.mapId === event.venueMapId && nearTile(host.position, event.scenePosition, 5));
  if (gathered && event.stage === 'BOOK_OPENED') {
    event.stage = 'DISCUSSION_READY'; event.gatheredAtMinute = state.world.clockMinutes;
    event.closesAtMinute = state.world.clockMinutes + 120;
    livingEventRows.push(serfdomReadingEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '세 사람은 고골의 「러시아 지주」를 읽고 이야기를 나누기 시작했다.' }));
  }
  if (state.world.clockMinutes >= (event.closesAtMinute ?? event.startedAtMinute + 240)) {
    event.status = 'RESOLVED'; event.stage = 'DISCUSSION_ENDED';
    event.resolvedAtMinute = state.world.clockMinutes; event.resolutionActionId = 'AUTO_DISCUSSION_ENDED';
    for (const host of actors) if (host.activeGoal?.taskId?.startsWith('V37:E31:')) host.activeGoal = null;
    livingEventRows.push(serfdomReadingEventRow(state, event.stage, minuteOffset, maps,
      { actionId: event.resolutionActionId, changeKo: '세 사람은 책을 덮고 각자 하던 일로 돌아갔다.' }));
  }
}
function physiologyReadingEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E39, position = event?.scenePosition ?? { x: 12, y: 12 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E39', stage,
    stageIndex: ({ READING_OPENED: 1, DISCUSSION_READY: 2, COPY_SOLD: 3, LIVES_COMPARED: 3,
      NARRATOR_QUESTIONED: 3, READING_ENDED: 3 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute: minuteOffset, mapId: 'bookshop-interior', position: { ...position },
    sourceIds: ['LIT-TURGENEV-KHOR-KALYNYCH-1847'],
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'PUBLIC_DOMAIN_TEXT_AND_1847_ISSUE_VERIFIED',
    state: event ? clone(event) : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'bookshop-interior', position, 6, maps), ...details };
}
function advancePhysiologyReadingEvent(state, minuteOffset, maps, livingEventRows, options = {}) {
  state.world.livingEventStates ??= {};
  let event = state.world.livingEventStates.E39;
  const dayIndex = Math.floor(state.world.clockMinutes / 1440);
  if (event?.status === 'RESOLVED' && event.readingDayIndex !== dayIndex) {
    delete state.world.livingEventStates.E39;
    state.quests.V37_PHYSIOLOGY_READING_1847 = { status: 'open', result: null };
    event = null;
  }
  if (!event) {
    const actors = ['reader_darya', 'student_vasily', 'bookseller_lev'].map(id => state.hosts[id]);
    const sourceObject = layer(maps?.['bookshop-interior'], 'Interactions')?.objects.find(item => item.type === 'source'
      && properties(item).sourceId === 'LIT-TURGENEV-KHOR-KALYNYCH-1847');
    if (state.world.chapterId !== 'V33_1847_PRINT' || state.world.activeRealm || state.world.date < '1847-06-01'
      || !sourceObject || !actors.some(host => host?.knownEvidenceIds?.includes('LIT-TURGENEV-KHOR-KALYNYCH-1847'))
      || actors.some(host => !host || host.historicalAliveAndPresent === false || !host.allowedMaps.includes('bookshop-interior')
        || npcMapRoute(host.mapId, 'bookshop-interior', host, maps, state.world.clockMinutes) === null)) return;
    event = state.world.livingEventStates.E39 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E39',
      status: 'ACTIVE', stage: 'READING_OPENED', trigger: 'reader_opened_turgenev_1847_sovremennik_text',
      startedAtMinute: state.world.clockMinutes, readingDayIndex: dayIndex,
      readerHostId: actors[0].id, studentHostId: actors[1].id, booksellerHostId: actors[2].id,
      actorHostIds: actors.map(host => host.id), witnessHostIds: [], venueMapId: 'bookshop-interior',
      scenePosition: { x: 12, y: 12 }, sourceId: 'LIT-TURGENEV-KHOR-KALYNYCH-1847',
      copy: { itemKo: '《현대인》 1847년 제1호 · 「호리와 칼리니치」', location: '책방의 독서대', ownerHostId: actors[2].id },
      closesAtMinute: state.world.clockMinutes + 240, resolutionActionId: null };
    livingEventRows.push(physiologyReadingEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '다리야가 1847년 《현대인》 제1호에 실린 「호리와 칼리니치」를 펼쳤다. 레프는 책방 자리를 내주고, 바실리가 읽으러 왔다.' }));
  }
  if (!event || event.status !== 'ACTIVE' || options.deferLivingEventExpiryId === 'E39') return;
  const actors = event.actorHostIds.map(id => state.hosts[id]);
  const gathered = actors.every(host => host && host.historicalAliveAndPresent !== false
    && host.mapId === event.venueMapId && nearTile(host.position, event.scenePosition, 5));
  if (gathered && event.stage === 'READING_OPENED') {
    event.stage = 'DISCUSSION_READY'; event.gatheredAtMinute = state.world.clockMinutes;
    event.closesAtMinute = state.world.clockMinutes + 120;
    event.witnessHostIds = Object.values(state.hosts).filter(host => !event.actorHostIds.includes(host.id)
      && host.historicalAliveAndPresent !== false && host.mapId === event.venueMapId
      && nearTile(host.position, event.scenePosition, 5)).map(host => host.id).sort();
    livingEventRows.push(physiologyReadingEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '세 사람이 책방에 모였다. 호리의 살림과 칼리니치의 재주, 두 농노를 바라보는 화자의 시선을 두고 읽기 시작했다.' }));
  }
  if (state.world.clockMinutes < event.closesAtMinute) return;
  const buyer = state.hosts[event.studentHostId], bookseller = state.hosts[event.booksellerHostId];
  if (buyer && bookseller && buyer.money?.unit === bookseller.money?.unit && buyer.money.amount >= 2) {
    buyer.money.amount -= 2; bookseller.money.amount += 2;
    buyer.inventory ??= []; buyer.inventory.push(event.copy.itemKo);
    event.copy.location = 'student_inventory'; event.copy.ownerHostId = buyer.id; event.copy.paidAmount = 2;
    event.stage = 'COPY_SOLD'; event.resolutionActionId = 'AUTO_READER_BOUGHT_COPY';
    buyer.relations[bookseller.id] = '책 한 부를 사고 값을 치른 학생 독자';
    bookseller.relations[buyer.id] = '읽을 책을 팔고 값을 받은 손님';
  } else {
    event.copy.location = '책방 선반'; event.stage = 'READING_ENDED';
    event.resolutionActionId = 'AUTO_COPY_RETURNED_TO_SHELF';
  }
  event.status = 'RESOLVED'; event.resolvedAtMinute = state.world.clockMinutes;
  for (const host of actors) if (host.activeGoal?.taskId?.startsWith('V37:E39:')) host.activeGoal = null;
  livingEventRows.push(physiologyReadingEventRow(state, event.stage, minuteOffset, maps,
    { actionId: event.resolutionActionId,
      ...(event.stage === 'COPY_SOLD' ? { payerHostId: buyer.id, recipientHostId: bookseller.id, paidAmount: 2, itemTransferredKo: event.copy.itemKo } : {}),
      changeKo: event.stage === 'COPY_SOLD' ? '바실리는 책값을 내고 한 부를 가져갔다.' : '독서대의 책을 덮고 선반에 돌려놓았다.' }));
}
function salonDebateEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E21, position = event?.scenePosition ?? { x: 12, y: 12 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E21', stage,
    stageIndex: ({ REVIEW_OPENED: 1, DEBATE_READY: 2, EUROPEAN_METHOD_DEFENDED: 3,
      RUSSIAN_INSTITUTIONS_DEFENDED: 3, BOTH_SIDES_TESTED: 3, DEBATE_ENDED: 3 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute: minuteOffset, mapId: 'bookshop-interior', position: { ...position },
    sourceIds: ['LIT-BELINSKY-GOGOL-REVIEW-1847'],
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'PUBLIC_REVIEW_TEXT_VERIFIED_FICTIONAL_DISCUSSION',
    state: event ? clone(event) : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'bookshop-interior', position, 6, maps), ...details };
}
function advanceSalonDebateEvent(state, minuteOffset, maps, livingEventRows, options = {}) {
  state.world.livingEventStates ??= {};
  let event = state.world.livingEventStates.E21;
  if (!event) {
    const actors = ['reader_darya', 'student_vasily', 'editor_sofia'].map(id => state.hosts[id]);
    const sourceObject = layer(maps?.['bookshop-interior'], 'Interactions')?.objects.find(item => item.type === 'source'
      && properties(item).sourceId === 'LIT-BELINSKY-GOGOL-REVIEW-1847');
    const hasReadReview = actors.some(host => host?.knownEvidenceIds?.includes('LIT-BELINSKY-GOGOL-REVIEW-1847'));
    if (state.world.chapterId !== 'V33_1847_PRINT' || state.world.activeRealm || state.world.date < '1847-06-01'
      || !hasReadReview || !sourceObject || actors.some(host => !host || host.historicalAliveAndPresent === false
        || !host.allowedMaps.includes('bookshop-interior')
        || npcMapRoute(host.mapId, 'bookshop-interior', host, maps, state.world.clockMinutes) === null)) return;
    event = state.world.livingEventStates.E21 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E21',
      status: 'ACTIVE', stage: 'REVIEW_OPENED', trigger: 'reader_opened_belinsky_public_review_of_gogol',
      startedAtMinute: state.world.clockMinutes, readerHostId: actors[0].id, studentHostId: actors[1].id,
      editorHostId: actors[2].id, actorHostIds: actors.map(host => host.id), witnessHostIds: [],
      venueMapId: 'bookshop-interior', scenePosition: { x: 12, y: 12 },
      sourceId: 'LIT-BELINSKY-GOGOL-REVIEW-1847', resolutionActionId: null };
    livingEventRows.push(salonDebateEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '다리야가 벨린스키의 서평을 펼쳤다. 바실리와 소피아가 곁에 앉아 슬라브파와 서구파를 다룬 대목을 읽었다.' }));
  }
  if (!event || event.status !== 'ACTIVE' || options.deferLivingEventExpiryId === 'E21') return;
  const actors = event.actorHostIds.map(id => state.hosts[id]);
  const gathered = actors.every(host => host && host.historicalAliveAndPresent !== false
    && host.mapId === event.venueMapId && nearTile(host.position, event.scenePosition, 5));
  if (gathered && event.stage === 'REVIEW_OPENED') {
    event.stage = 'DEBATE_READY'; event.gatheredAtMinute = state.world.clockMinutes;
    event.closesAtMinute = state.world.clockMinutes + 120;
    livingEventRows.push(salonDebateEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '세 사람은 고골의 글을 인용한 벨린스키의 서평을 두고 이야기를 시작했다.' }));
  }
  if (state.world.clockMinutes >= (event.closesAtMinute ?? event.startedAtMinute + 240)) {
    event.status = 'RESOLVED'; event.stage = 'DEBATE_ENDED';
    event.resolvedAtMinute = state.world.clockMinutes; event.resolutionActionId = 'AUTO_DEBATE_ENDED';
    for (const host of actors) if (host.activeGoal?.taskId?.startsWith('V37:E21:')) host.activeGoal = null;
    livingEventRows.push(salonDebateEventRow(state, event.stage, minuteOffset, maps,
      { actionId: event.resolutionActionId, changeKo: '세 사람은 책을 덮고 각자 하던 일로 돌아갔다.' }));
  }
}
function salonInvitationEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E29, position = event?.scenePosition ?? { x: 13, y: 12 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E29', stage,
    stageIndex: ({ INVITATION_OFFERED: 1, INVITATION_ACCEPTED: 2, INVITATION_DECLINED: 2,
      TEXT_COPIES_REQUESTED: 2, INVITATION_PASSED: 2 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute: minuteOffset, mapId: 'bookshop-interior', position: { ...position },
    sourceIds: ['LIT-BELINSKY-GOGOL-REVIEW-1847'],
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'PUBLIC_REVIEW_VERIFIED_FICTIONAL_INVITATION',
    state: event ? clone(event) : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'bookshop-interior', position, 6, maps), ...details };
}
function startSalonInvitationEvent(state, minuteOffset, maps, livingEventRows) {
  const discussion = state.world.livingEventStates?.E21;
  if (state.world.livingEventStates?.E29 || !discussion || discussion.status !== 'RESOLVED'
    || !['EUROPEAN_METHOD_DEFENDED', 'RUSSIAN_INSTITUTIONS_DEFENDED', 'BOTH_SIDES_TESTED'].includes(discussion.stage)
    || discussion.sourceId !== 'LIT-BELINSKY-GOGOL-REVIEW-1847') return false;
  const actors = (discussion.actorHostIds ?? []).map(id => state.hosts[id]);
  const sourceObject = layer(maps?.['bookshop-interior'], 'Interactions')?.objects.find(item => item.type === 'source'
    && properties(item).sourceId === discussion.sourceId);
  if (!sourceObject || actors.length !== 3 || actors.some(host => !host || host.historicalAliveAndPresent === false
    || host.mapId !== 'bookshop-interior' || !nearTile(host.position, discussion.scenePosition ?? { x: 12, y: 12 }, 5))) return false;
  const position = { ...(discussion.scenePosition ?? { x: 12, y: 12 }) };
  const event = state.world.livingEventStates.E29 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E29',
    status: 'ACTIVE', stage: 'INVITATION_OFFERED', trigger: 'sofia_invites_the_readers_after_belinsky_review_discussion',
    startedAtMinute: state.world.clockMinutes, inviterHostId: discussion.editorHostId ?? 'editor_sofia',
    actorHostIds: actors.map(host => host.id), witnessHostIds: [], venueMapId: 'bookshop-interior', scenePosition: position,
    sourceId: discussion.sourceId, resolvesAtMinute: state.world.clockMinutes + 120, resolutionActionId: null };
  livingEventRows.push(salonInvitationEventRow(state, event.stage, minuteOffset, maps,
    { changeKo: '서평 이야기가 끝나자 소피아가 접힌 종이를 내밀었다. 오늘 저녁, 책방 문을 닫은 뒤 이어서 읽자는 초대였다.' }));
  return true;
}
function advanceSalonInvitationEvent(state, minuteOffset, maps, livingEventRows, options = {}) {
  const event = state.world.livingEventStates?.E29;
  if (!event || event.status !== 'ACTIVE' || options.deferLivingEventExpiryId === 'E29') return;
  if (state.world.clockMinutes < event.resolvesAtMinute) return;
  event.status = 'RESOLVED'; event.stage = 'INVITATION_PASSED'; event.resolvedAtMinute = state.world.clockMinutes;
  event.resolutionActionId = 'AUTO_INVITATION_WINDOW_CLOSED';
  livingEventRows.push(salonInvitationEventRow(state, event.stage, minuteOffset, maps,
    { actionId: event.resolutionActionId, changeKo: '소피아는 초대장을 책 사이에 넣고 오늘 저녁 자리는 비워 두었다.' }));
}
function marketDayWorkEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E32, position = event?.scenePosition ?? { x: 15, y: 12 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E32', stage,
    stageIndex: ({ JOB_SEARCH_OPENED: 1, OFFER_READY: 2, HEAVY_LOADING_PAID: 3,
      LIGHT_SORTING_PAID: 3, PRINTSHOP_REFERRAL: 3, WORK_DECLINED: 3, NO_WORK_FOUND: 3 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute: minuteOffset, mapId: 'market-quay', position: { ...position },
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance', state: event ? clone(event) : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'market-quay', position, 6, maps), ...details };
}
function advanceMarketDayWorkEvent(state, minuteOffset, maps, livingEventRows, options = {}) {
  state.world.livingEventStates ??= {};
  let event = state.world.livingEventStates.E32;
  if (!event) {
    const minute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
    const worker = state.hosts.tenant_mikhail, employer = state.hosts.market_nadezhda;
    const entry = layer(maps?.['market-quay'], 'Interactions')?.objects.find(item => item.id === 1180);
    if (state.world.chapterId !== 'V33_1847_PRINT' || state.world.activeRealm || state.world.date < '1847-06-01'
      || minute < 540 || minute > 960 || !entry || !worker || !employer || worker.historicalAliveAndPresent === false
      || employer.historicalAliveAndPresent === false || worker.money?.amount > 9 && (worker.needs?.incomePressure ?? 0) < 65
      || !worker.allowedMaps.includes('market-quay')
      || !employer.allowedMaps.includes('market-quay') || employer.money?.amount < 3
      || npcMapRoute(worker.mapId, 'market-quay', worker, maps, state.world.clockMinutes) === null
      || npcMapRoute(employer.mapId, 'market-quay', employer, maps, state.world.clockMinutes) === null) return;
    const scenePosition = objectTile(entry);
    const witnesses = Object.values(state.hosts).filter(host => ![worker.id, employer.id].includes(host.id)
      && host.historicalAliveAndPresent !== false && host.mapId === 'market-quay'
      && nearTile(host.position, scenePosition, 5)).map(host => host.id).sort();
    event = state.world.livingEventStates.E32 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E32',
      status: 'ACTIVE', stage: 'JOB_SEARCH_OPENED', trigger: 'low_cash_day_laborer_seeks_a_market_shift',
      startedAtMinute: state.world.clockMinutes, workerHostId: worker.id, employerHostId: employer.id,
      actorHostIds: [worker.id, employer.id], witnessHostIds: witnesses, venueMapId: 'market-quay',
      scenePosition, offerExpiresAtMinute: state.world.clockMinutes + 240, resolutionActionId: null };
    livingEventRows.push(marketDayWorkEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '미하일이 시장에서 하루 일감을 묻는다. 나데즈다는 좌판을 지키며 맡길 일을 생각한다.' }));
  }
  if (event.status !== 'ACTIVE' || options.deferLivingEventExpiryId === 'E32') return;
  const worker = state.hosts[event.workerHostId], employer = state.hosts[event.employerHostId];
  const gathered = [worker, employer].every(person => person && person.historicalAliveAndPresent !== false
    && person.mapId === event.venueMapId && nearTile(person.position, event.scenePosition, 4));
  if (gathered && event.stage === 'JOB_SEARCH_OPENED') {
    event.stage = 'OFFER_READY'; event.gatheredAtMinute = state.world.clockMinutes;
    event.offerExpiresAtMinute = state.world.clockMinutes + 120;
    livingEventRows.push(marketDayWorkEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '나데즈다와 미하일이 일의 무게와 품삯을 의논할 수 있게 자리에 모였다.' }));
  }
  if (state.world.clockMinutes < event.offerExpiresAtMinute) return;
  event.status = 'RESOLVED'; event.stage = 'NO_WORK_FOUND'; event.resolvedAtMinute = state.world.clockMinutes;
  event.resolutionActionId = 'AUTO_OFFER_WINDOW_CLOSED';
  if (worker) {
    worker.relations[event.employerHostId] = '시장에 일자리를 물었으나 오늘은 일하지 못한 노동자';
    worker.activeGoal = null;
  }
  if (employer) employer.activeGoal = null;
  livingEventRows.push(marketDayWorkEventRow(state, event.stage, minuteOffset, maps,
    { actionId: event.resolutionActionId, changeKo: '나데즈다는 맡길 일을 정하지 못했고, 미하일은 오늘 다른 일감을 찾아 나섰다.' }));
}
function marketTheftEventRow(state, event, stage, minuteOffset, maps, details = {}) {
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E36', stage,
    stageIndex: stage === 'LOSS_NOTICED' ? 1 : stage === 'WITNESS_READY' ? 2 : 3,
    actorHostIds: [...event.actorHostIds], witnessHostIds: [...event.witnessHostIds],
    date: state.world.date, minute: minuteOffset, mapId: 'market-quay', position: { ...event.scenePosition },
    sourceIds: [...event.sourceIds], occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'CATALOGED_MARKET_RULES_AND_CASES_SCENE_RECONSTRUCTION',
    state: clone(event), witnessedByPlayer: playerCanObserveWorldEvent(state, 'market-quay', event.scenePosition, 6, maps), ...details };
}
function advanceMarketTheftEvent(state, minuteOffset, maps, livingEventRows, options = {}) {
  state.world.livingEventStates ??= {};
  let event = state.world.livingEventStates.E36;
  if (!event) {
    const minute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
    const seller = state.hosts.market_nadezhda, witness = state.hosts.porter_gavrila;
    const watchman = state.hosts.police_sergeant_ivan, neighbor = state.hosts.tenant_mikhail;
    const actors = [seller, witness, watchman, neighbor];
    const object = layer(maps?.['market-quay'], 'Interactions')?.objects.find(item => item.id === 1181);
    if (state.world.chapterId !== 'V33_1847_PRINT' || state.world.activeRealm || state.world.date !== '1847-06-01'
      || minute < 600 || minute > 900 || state.world.livingEventStates.E32?.status === 'ACTIVE'
      || !object || actors.some(host => !host || host.historicalAliveAndPresent === false
        || !host.allowedMaps.includes('market-quay')
        || npcMapRoute(host.mapId, 'market-quay', host, maps, state.world.clockMinutes) === null)
      || !Number.isFinite(seller.money?.amount) || seller.money.amount < 3) return;
    const scenePosition = objectTile(object), missingAmount = 2, unit = seller.money.unit;
    seller.money.amount -= missingAmount;
    state.world.untracedMarketCash = (state.world.untracedMarketCash ?? 0) + missingAmount;
    event = state.world.livingEventStates.E36 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E36',
      status: 'ACTIVE', stage: 'LOSS_NOTICED', trigger: 'market_seller_discovers_purse_missing',
      startedAtMinute: state.world.clockMinutes, resolvesAtMinute: state.world.clockMinutes + 240,
      sellerHostId: seller.id, witnessHostId: witness.id, watchmanHostId: watchman.id, neighborHostId: neighbor.id,
      actorHostIds: actors.map(host => host.id), witnessHostIds: [witness.id], venueMapId: 'market-quay', scenePosition,
      sourceIds: ['CAT-RSL-BAZAAR-WARDENS-1842', 'OBJ-PRLIB-STPETE-THEFT-CASES-1843-44'],
      unidentifiedLoss: { amount: missingAmount, unit, identified: false }, resolutionActionId: null };
    livingEventRows.push(marketTheftEventRow(state, event, event.stage, minuteOffset, maps,
      { changeKo: '나데즈다가 계산대 옆에 둔 돈주머니가 사라진 걸 알아차렸다.' }));
  }
  if (event.status !== 'ACTIVE' || options.deferLivingEventExpiryId === 'E36') return;
  const actors = event.actorHostIds.map(id => state.hosts[id]);
  const gathered = actors.every(host => host && host.historicalAliveAndPresent !== false
    && host.mapId === 'market-quay' && nearTile(host.position, event.scenePosition, 5));
  if (gathered && event.stage === 'LOSS_NOTICED') {
    event.stage = 'WITNESS_READY'; event.gatheredAtMinute = state.world.clockMinutes;
    event.resolvesAtMinute = state.world.clockMinutes + 120;
    livingEventRows.push(marketTheftEventRow(state, event, event.stage, minuteOffset, maps,
      { changeKo: '가브릴라와 경비가 좌판에 왔다. 누구도 가져간 사람을 알아보지 못했다.' }));
  }
  if (state.world.clockMinutes < event.resolvesAtMinute) return;
  event.status = 'RESOLVED'; event.stage = 'LOSS_UNREPORTED'; event.resolvedAtMinute = state.world.clockMinutes;
  event.resolutionActionId = 'AUTO_SELLER_RECORDED_SHORTFALL';
  for (const host of actors) if (host.activeGoal?.taskId?.startsWith('V37:E36:')) host.activeGoal = null;
  state.hosts[event.sellerHostId].currentActivityKo = '계산대의 부족액을 장부에 적고 장사를 계속한다';
  livingEventRows.push(marketTheftEventRow(state, event, event.stage, minuteOffset, maps,
    { actionId: event.resolutionActionId, unattended: true, changeKo: '신고 없이 시간이 지나 나데즈다는 돈주머니 손실을 좌판 장부에 적었다.' }));
}
function europeNewsEventRow(state, event, stage, minuteOffset, maps, details = {}) {
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E42', stage,
    stageIndex: stage === 'NOTICE_ARRIVED' ? 1 : stage === 'READING_READY' ? 2 : 3,
    actorHostIds: [...event.actorHostIds], witnessHostIds: [...event.witnessHostIds],
    date: state.world.date, minute: minuteOffset, mapId: event.venueMapId,
    position: { ...event.scenePosition }, sourceIds: [...event.sourceIds],
    occurrenceType: 'DOCUMENTED_HISTORICAL_EVENT',
    validationStatus: 'ARCHIVAL_METADATA_AND_ACADEMIC_TRANSCRIPTION_VERIFIED',
    historicalOutcomeId: 'EUROPE_REVOLUTIONS_1848', historicalOutcomeFixed: true,
    state: clone(event), witnessedByPlayer: playerCanObserveWorldEvent(state, event.venueMapId, event.scenePosition, 6, maps), ...details };
}
function advanceEuropeNewsEvent(state, minuteOffset, maps, livingEventRows) {
  state.world.livingEventStates ??= {};
  let event = state.world.livingEventStates.E42;
  if (!event) {
    const objects = layer(maps?.printshop, 'Interactions')?.objects ?? [];
    const source = objects.find(item => properties(item).sourceId === 'OBJ-NICHOLAS-MANIFESTO-1848');
    const stand = objects.find(item => item.id === 1184);
    const actorHostIds = ['clerk_alexei', 'printer_ekaterina', 'reader_darya', 'student_vasily'];
    const actors = actorHostIds.map(id => state.hosts[id]);
    const minute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
    if (state.world.chapterId !== 'V33_1848_PUBLIC' || state.world.activeRealm
      || state.world.date !== '1848-03-15' || minute < 540 || minute > 780
      || !source || !stand || actors.some(host => !host || host.historicalAliveAndPresent === false
        || !host.allowedMaps.includes('printshop')
        || npcMapRoute(host.mapId, 'printshop', host, maps, state.world.clockMinutes) === null)) return;
    const scenePosition = objectTile(stand), witnesses = actorHostIds.filter(id => id !== 'clerk_alexei');
    event = state.world.livingEventStates.E42 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E42',
      status: 'ACTIVE', stage: 'NOTICE_ARRIVED', trigger: '1848-03-15_northern_bee_issue_59_publishes_manifesto',
      startedAtMinute: state.world.clockMinutes, resolvesAtMinute: state.world.clockMinutes + 240,
      actorHostIds, witnessHostIds: witnesses, venueMapId: 'printshop', scenePosition,
      sourceIds: ['OBJ-NICHOLAS-MANIFESTO-1848'], historicalOutcomeId: 'EUROPE_REVOLUTIONS_1848',
      historicalOutcomeFixed: true, disposition: null, resolutionActionId: null };
    state.world.immutableOutcomes ??= {};
    state.world.immutableOutcomes.EUROPE_REVOLUTIONS_1848 = 'the documented events and dates remain unchanged';
    livingEventRows.push(europeNewsEventRow(state, event, event.stage, minuteOffset, maps,
      { changeKo: '3월 15일자 신문에 실린 황제 선언문이 인쇄소에 도착했다. 유럽의 변화를 황실의 말로 규정한 글이다.' }));
  }
  if (event.status !== 'ACTIVE') return;
  const gathered = event.actorHostIds.every(id => {
    const host = state.hosts[id];
    return host && host.historicalAliveAndPresent !== false && host.mapId === event.venueMapId
      && nearTile(host.position, event.scenePosition, 5);
  });
  if (gathered && event.stage === 'NOTICE_ARRIVED') {
    event.stage = 'READING_READY'; event.gatheredAtMinute = state.world.clockMinutes;
    event.resolvesAtMinute = state.world.clockMinutes + 180;
    livingEventRows.push(europeNewsEventRow(state, event, event.stage, minuteOffset, maps,
      { changeKo: '에카테리나와 다리야, 바실리가 곁에 왔다. 선언문을 읽고 장부에 남길 수 있다.' }));
  }
  if (state.world.clockMinutes < event.resolvesAtMinute) return;
  event.status = 'RESOLVED'; event.stage = 'UNRECORDED_NOTICE';
  event.resolvedAtMinute = state.world.clockMinutes; event.disposition = 'NO_LOCAL_COPY';
  event.resolutionActionId = 'AUTO_NOTICE_LEFT_UNRECORDED';
  state.world.europeNewsRecord = { eventId: 'E42', sourceIds: [...event.sourceIds], disposition: event.disposition,
    historicalOutcomeFixed: true, date: state.world.date, recordedAtMinute: state.world.clockMinutes };
  for (const id of event.actorHostIds) {
    const host = state.hosts[id]; if (host?.activeGoal?.taskId?.startsWith('V37:E42:')) host.activeGoal = null;
  }
  livingEventRows.push(europeNewsEventRow(state, event, event.stage, minuteOffset, maps,
    { unattended: true, changeKo: '그날 선언문은 관청 기록이나 인쇄소의 개인 기록으로 옮겨지지 않았다.' }));
}
function pushkinObituaryEventRow(state, event, minuteOffset, maps, details = {}) {
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E43', stage: event.stage,
    stageIndex: event.stage === 'NOTICE_ARRIVED' ? 1 : event.stage === 'READING_READY' ? 2 : 3,
    actorHostIds: [...event.actorHostIds], witnessHostIds: [...event.witnessHostIds],
    date: state.world.date, minute: minuteOffset, mapId: event.venueMapId,
    position: { ...event.scenePosition }, sourceIds: [...event.sourceIds],
    occurrenceType: 'DOCUMENTED_HISTORICAL_EVENT',
    validationStatus: 'PRIMARY_PERIODICAL_TEXT_AND_ACADEMIC_TRANSCRIPTION_VERIFIED',
    historicalOutcomeId: 'PUSHKIN_OBITUARY_TEXT_AND_PUBLICATION', historicalOutcomeFixed: true,
    state: clone(event), witnessedByPlayer: playerCanObserveWorldEvent(state, event.venueMapId, event.scenePosition, 6, maps), ...details };
}
function advancePushkinObituaryEvent(state, minuteOffset, maps, livingEventRows) {
  state.world.livingEventStates ??= {};
  let event = state.world.livingEventStates.E43;
  if (!event) {
    const objects = layer(maps?.['bookshop-interior'], 'Interactions')?.objects ?? [];
    const source = objects.find(item => properties(item).sourceId === 'OBJ-PUSHKIN-OBITUARY-1837');
    const stand = objects.find(item => item.id === 4018);
    const actorHostIds = ['bookseller_lev', 'reader_darya', 'student_vasily'];
    const actors = actorHostIds.map(id => state.hosts[id]);
    const minute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
    if (state.world.chapterId !== 'V33_1847_PRINT' || state.world.activeRealm
      || state.world.date !== '1847-06-01' || minute < 600 || minute > 780
      || !source || !stand || actors.some(host => !host || host.historicalAliveAndPresent === false
        || !host.allowedMaps.includes('bookshop-interior')
        || npcMapRoute(host.mapId, 'bookshop-interior', host, maps, state.world.clockMinutes) === null)) return;
    const scenePosition = objectTile(stand), witnesses = actorHostIds.filter(id => id !== 'bookseller_lev');
    event = state.world.livingEventStates.E43 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E43',
      status: 'ACTIVE', stage: 'NOTICE_ARRIVED', trigger: '1847-06-01_bookseller_opens_1837_pushkin_obituary',
      startedAtMinute: state.world.clockMinutes, resolvesAtMinute: state.world.clockMinutes + 240,
      actorHostIds, witnessHostIds: witnesses, venueMapId: 'bookshop-interior', scenePosition,
      booksellerHostId: 'bookseller_lev', sourceIds: ['OBJ-PUSHKIN-OBITUARY-1837'],
      historicalOutcomeId: 'PUSHKIN_OBITUARY_TEXT_AND_PUBLICATION', historicalOutcomeFixed: true,
      disposition: null, resolutionActionId: null };
    livingEventRows.push(pushkinObituaryEventRow(state, event, minuteOffset, maps,
      { changeKo: '레프가 1837년 《문학 증보》의 부고를 펼쳤다. 다리야와 바실리가 책방 안으로 모인다.' }));
  }
  if (event.status !== 'ACTIVE') return;
  const gathered = event.actorHostIds.every(id => {
    const host = state.hosts[id];
    return host && host.historicalAliveAndPresent !== false && host.mapId === event.venueMapId
      && nearTile(host.position, event.scenePosition, 5);
  });
  if (gathered && event.stage === 'NOTICE_ARRIVED') {
    event.stage = 'READING_READY'; event.gatheredAtMinute = state.world.clockMinutes;
    event.resolvesAtMinute = state.world.clockMinutes + 180;
    livingEventRows.push(pushkinObituaryEventRow(state, event, minuteOffset, maps,
      { changeKo: '세 사람이 낡은 부고를 둘러싼다. 첫 문장을 함께 읽을 수 있다.' }));
  }
  if (state.world.clockMinutes < event.resolvesAtMinute) return;
  event.status = 'RESOLVED'; event.stage = 'UNREAD_ISSUE'; event.resolvedAtMinute = state.world.clockMinutes;
  event.disposition = 'NO_LOCAL_READING'; event.resolutionActionId = 'AUTO_READING_ENDED';
  state.world.pushkinObituaryRecord = { eventId: 'E43', sourceIds: [...event.sourceIds],
    disposition: event.disposition, historicalOutcomeFixed: true, date: state.world.date,
    recordedAtMinute: state.world.clockMinutes };
  for (const id of event.actorHostIds) {
    const host = state.hosts[id]; if (host?.activeGoal?.taskId?.startsWith('V37:E43:')) host.activeGoal = null;
  }
  livingEventRows.push(pushkinObituaryEventRow(state, event, minuteOffset, maps,
    { unattended: true, changeKo: '책방의 사람들이 흩어졌다. 부고는 펼쳐진 채 책상에 남았다.' }));
}
function belinskyLetterEventRow(state, event, minuteOffset, maps, details = {}) {
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E44', stage: event.stage,
    stageIndex: event.stage === 'COPY_ARRIVED' ? 1 : event.stage === 'READING_READY' ? 2 : 3,
    actorHostIds: [...event.actorHostIds], witnessHostIds: [...event.witnessHostIds],
    date: state.world.date, minute: minuteOffset, mapId: event.venueMapId,
    position: { ...event.scenePosition }, sourceIds: [...event.sourceIds],
    occurrenceType: 'RECONSTRUCTED_COPY_ARRIVAL_OF_DOCUMENTED_LETTER',
    validationStatus: 'PRIMARY_LETTER_AND_CIRCULATION_HISTORY_VERIFIED',
    historicalOutcomeId: 'BELINSKY_LETTER_GOGOL_1847', historicalOutcomeFixed: true,
    state: clone(event), witnessedByPlayer: playerCanObserveWorldEvent(state, event.venueMapId, event.scenePosition, 6, maps), ...details };
}
function advanceBelinskyLetterEvent(state, minuteOffset, maps, livingEventRows) {
  state.world.livingEventStates ??= {};
  let event = state.world.livingEventStates.E44;
  if (!event) {
    const objects = layer(maps?.['bookshop-interior'], 'Interactions')?.objects ?? [];
    const source = objects.find(item => properties(item).sourceId === 'OBJ-BELINSKY-LETTER-GOGOL-1847');
    const stand = objects.find(item => item.id === 4021);
    const actorHostIds = ['bookseller_lev', 'reader_darya', 'student_vasily'];
    const actors = actorHostIds.map(id => state.hosts[id]);
    const minute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
    if (state.world.chapterId !== 'V33_1848_PUBLIC' || state.world.activeRealm
      || state.world.date !== '1848-01-02' || minute < 600 || minute > 780
      || !source || !stand || actors.some(host => !host || host.historicalAliveAndPresent === false
        || !host.allowedMaps.includes('bookshop-interior')
        || npcMapRoute(host.mapId, 'bookshop-interior', host, maps, state.world.clockMinutes) === null)) return;
    const scenePosition = objectTile(stand), witnesses = actorHostIds.filter(id => id !== 'bookseller_lev');
    event = state.world.livingEventStates.E44 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E44',
      status: 'ACTIVE', stage: 'COPY_ARRIVED', trigger: '1848-01-02_handwritten_copy_of_the_1847_belinsky_letter_reaches_readers',
      startedAtMinute: state.world.clockMinutes, resolvesAtMinute: state.world.clockMinutes + 240,
      actorHostIds, witnessHostIds: witnesses, venueMapId: 'bookshop-interior', scenePosition,
      booksellerHostId: 'bookseller_lev', sourceIds: ['OBJ-BELINSKY-LETTER-GOGOL-1847'],
      historicalOutcomeId: 'BELINSKY_LETTER_GOGOL_1847', historicalOutcomeFixed: true,
      disposition: null, resolutionActionId: null };
    livingEventRows.push(belinskyLetterEventRow(state, event, minuteOffset, maps,
      { changeKo: '레프가 벨린스키가 고골에게 보낸 편지의 필사본을 책방으로 가져왔다.' }));
  }
  if (event.status !== 'ACTIVE') return;
  const gathered = event.actorHostIds.every(id => {
    const host = state.hosts[id];
    return host && host.historicalAliveAndPresent !== false && host.mapId === event.venueMapId
      && nearTile(host.position, event.scenePosition, 5);
  });
  if (gathered && event.stage === 'COPY_ARRIVED') {
    event.stage = 'READING_READY'; event.gatheredAtMinute = state.world.clockMinutes;
    event.resolvesAtMinute = state.world.clockMinutes + 180;
    livingEventRows.push(belinskyLetterEventRow(state, event, minuteOffset, maps,
      { changeKo: '다리야와 바실리가 책방에 왔다. 필사본을 펼쳐 읽을 수 있다.' }));
  }
  if (state.world.clockMinutes < event.resolvesAtMinute) return;
  event.status = 'RESOLVED'; event.stage = 'COPY_STORED_UNREAD'; event.resolvedAtMinute = state.world.clockMinutes;
  event.disposition = 'NO_PUBLIC_READING'; event.resolutionActionId = 'AUTO_COPY_STORED';
  const record = { eventId: 'E44', sourceIds: [...event.sourceIds], disposition: event.disposition,
    historicalOutcomeFixed: true, date: state.world.date, recordedAtMinute: state.world.clockMinutes };
  state.world.belinskyLetterRecords ??= []; state.world.belinskyLetterRecords.push(record);
  for (const id of event.actorHostIds) {
    const host = state.hosts[id]; if (host?.activeGoal?.taskId?.startsWith('V37:E44:')) host.activeGoal = null;
  }
  livingEventRows.push(belinskyLetterEventRow(state, event, minuteOffset, maps,
    { unattended: true, changeKo: '독자들이 흩어지고 필사본은 책방 안에 보관됐다.' }));
}
function processionEventRow(state, event, minuteOffset, maps, details = {}) {
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E45', stage: event.stage,
    stageIndex: event.stage === 'CLEARANCE_READY' ? 1 : 2, actorHostIds: [...event.actorHostIds],
    witnessHostIds: [...event.witnessHostIds], date: state.world.date, minute: minuteOffset,
    mapId: event.venueMapId, position: { ...event.scenePosition }, sourceIds: [],
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    historicalOutcomeId: 'FICTIONAL_LOCAL_STREET_ENCOUNTER', historicalOutcomeFixed: false,
    state: clone(event), witnessedByPlayer: playerCanObserveWorldEvent(state, event.venueMapId, event.scenePosition, 6, maps), ...details };
}
function advanceProcessionEvent(state, minuteOffset, maps, livingEventRows) {
  state.world.livingEventStates ??= {};
  let event = state.world.livingEventStates.E45;
  if (!event) {
    const object = (layer(maps?.nevsky, 'Interactions')?.objects ?? []).find(row => row.id === 1184);
    const actorHostIds = ['street_vendor_matryona', 'junior_guard_sergey', 'coachman_timofey'];
    const actors = actorHostIds.map(id => state.hosts[id]);
    const minute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
    if (state.world.chapterId !== 'V33_1847_PRINT' || state.world.activeRealm || state.world.date !== '1847-06-01'
      || minute < 690 || minute > 780 || !object || actors.some(host => !host || host.historicalAliveAndPresent === false
        || !host.allowedMaps.includes('nevsky') || npcMapRoute(host.mapId, 'nevsky', host, maps, state.world.clockMinutes) === null)) return;
    const scenePosition = objectTile(object);
    event = state.world.livingEventStates.E45 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E45',
      status: 'ACTIVE', stage: 'CLEARANCE_READY', trigger: '1847_conditional_local_carriage_blockage',
      startedAtMinute: state.world.clockMinutes, resolvesAtMinute: state.world.clockMinutes + 180,
      actorHostIds, witnessHostIds: actorHostIds.filter(id => id !== 'street_vendor_matryona'),
      venueMapId: 'nevsky', scenePosition, vendorHostId: 'street_vendor_matryona', guardHostId: 'junior_guard_sergey',
      coachmanHostId: 'coachman_timofey', stallPosition: { ...state.hosts.street_vendor_matryona.position },
      historicalOutcomeId: 'FICTIONAL_LOCAL_STREET_ENCOUNTER', historicalOutcomeFixed: false };
    livingEventRows.push(processionEventRow(state, event, minuteOffset, maps,
      { changeKo: '마차가 길목을 막았다. 경비가 좌판 주인과 마부를 불러 세웠다.' }));
  }
  if (event.status !== 'ACTIVE') return;
  if (state.world.clockMinutes < event.resolvesAtMinute) return;
  event.status = 'RESOLVED'; event.stage = 'CARRIAGE_PASSED'; event.disposition = 'NO_PLAYER_INTERVENTION';
  event.resolvedAtMinute = state.world.clockMinutes;
  state.world.processionRecords ??= [];
  state.world.processionRecords.push({ eventId: 'E45', disposition: event.disposition,
    actorHostIds: [...event.actorHostIds], date: state.world.date, recordedAtMinute: state.world.clockMinutes,
    historicalOutcomeFixed: false });
  for (const id of event.actorHostIds) {
    const host = state.hosts[id]; if (host?.activeGoal?.taskId?.startsWith('V37:E45:')) host.activeGoal = null;
  }
  livingEventRows.push(processionEventRow(state, event, minuteOffset, maps,
    { unattended: true, changeKo: '마차가 지나갔다. 좌판 주인은 장사를 이어갔다.' }));
}
function advanceMarketPriceDispute(state, minuteOffset, maps, livingEventRows, options = {}) {
  state.world.livingEventStates ??= {};
  const event = state.world.livingEventStates.E13;
  if (event?.status === 'ACTIVE' && options.deferLivingEventExpiryId === 'E13') return;
  if (event?.status === 'ACTIVE') {
    const watchman = state.hosts[event.watchmanHostId];
    const seller = state.hosts[event.sellerHostId], buyer = state.hosts[event.buyerHostId];
    if (event.stage === 'REPORT_FILED' && watchman?.mapId === 'market-quay'
      && [seller, buyer].every(person => person?.historicalAliveAndPresent !== false
        && person?.mapId === 'market-quay' && nearTile(watchman.position, person.position, 5))) {
      event.status = 'RESOLVED'; event.stage = 'WATCHMAN_REVIEWED'; event.resolvedAtMinute = state.world.clockMinutes;
      if (!event.witnessHostIds.includes(watchman.id)) event.witnessHostIds.push(watchman.id);
      event.witnessedReviewHostId = watchman.id;
      const record = state.world.marketPriceComplaintRecords?.find(item => item.recordNumber === event.officialRecordNumber);
      if (record) { record.reviewStatus = 'WATCHMAN_HEARD_PARTIES'; record.reviewedAtMinute = state.world.clockMinutes; }
      livingEventRows.push(livingMarketDisputeEventRow(state, event.stage, minuteOffset, maps,
        { changeKo: '당직 경비가 좌판에 도착해 판매자와 구매자에게 각각 가격표와 거래 내용을 확인했다.', responseHostId: watchman.id }));
      return;
    }
    if (state.world.clockMinutes < event.resolvesAtMinute) return;
    event.status = 'RESOLVED'; event.resolvedAtMinute = state.world.clockMinutes;
    if (event.stage === 'REPORT_FILED') {
      event.stage = 'REPORT_NO_VISIT'; event.resolutionActionId = 'E13_FILE_PRICE_COMPLAINT';
      const record = state.world.marketPriceComplaintRecords?.find(item => item.recordNumber === event.officialRecordNumber);
      if (record) record.reviewStatus = 'NO_VISIT_WITHIN_RESPONSE_WINDOW';
      livingEventRows.push(livingMarketDisputeEventRow(state, event.stage, minuteOffset, maps,
        { changeKo: '가격 확인 요청은 당직 기록에 남았지만, 경비는 대응 시간 안에 좌판을 찾지 못했다.' }));
    } else {
      event.stage = 'PRICE_STANDS'; event.resolutionActionId = 'AUTO_PRICE_STANDS';
      livingEventRows.push(livingMarketDisputeEventRow(state, event.stage, minuteOffset, maps,
        { changeKo: '다른 이의 제기가 없어 거래 가격은 그대로 남았다. 가격 인상은 게임 내 공급 상황 설정이다.' }));
    }
    return;
  }
  const priceRow = livingEventRows.find(row => row.catalogEventId === 'E02' && row.stage === 'FIRST_PURCHASE');
  const sale = priceRow?.state;
  if (event || state.world.activeRealm || state.world.chapterId !== 'V33_1847_PRINT' || !sale
    || sale.status !== 'RESOLVED' || sale.stage !== 'RESOLVED') return;
  const seller = state.hosts[sale.sellerHostId], buyer = state.hosts[priceRow.buyerHostId];
  if (!seller || !buyer || seller.mapId !== 'market-quay' || buyer.mapId !== 'market-quay'
    || !nearTile(seller.position, buyer.position, 2)) return;
  const watchman = state.hosts.junior_guard_sergey;
  const witnessHostIds = [];
  if (watchman?.historicalAliveAndPresent !== false && watchman?.mapId === 'market-quay'
    && nearTile(watchman.position, seller.position, 6)) witnessHostIds.push(watchman.id);
  const surcharge = priceRow.pricePaid - priceRow.basePrice;
  if (!Number.isInteger(surcharge) || surcharge <= 0) return;
  state.world.livingEventStates.E13 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E13',
    status: 'ACTIVE', stage: 'PRICE_CHALLENGE', trigger: 'supply_shock', triggerMechanism: 'adjusted_price_paid_after_documented_game_stockout',
    sourceCatalogEventId: 'E02', startedAtMinute: state.world.clockMinutes, resolvesAtMinute: state.world.clockMinutes + 180,
    sellerHostId: seller.id, buyerHostId: buyer.id, watchmanHostId: watchman?.id ?? 'junior_guard_sergey',
    actorHostIds: [seller.id, buyer.id], witnessHostIds, scenePosition: { ...seller.position }, itemKo: '빵 한 묶음', basePrice: priceRow.basePrice,
    pricePaid: priceRow.pricePaid, surcharge, reportFiled: false,
    valueStatus: 'fictional_gameplay_balance', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
  livingEventRows.push(livingMarketDisputeEventRow(state, 'PRICE_CHALLENGE', minuteOffset, maps,
    { changeKo: '재고 부족 뒤 조정된 가격으로 빵이 팔렸다. 구매자가 값을 묻고, 판매자는 가격표를 설명할 기회를 얻는다.',
      sourceEventId: 'E02', pricePaid: priceRow.pricePaid, surcharge, buyerHostId: buyer.id }));
}
function livingWarehouseInjuryEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E12;
  const position = event?.position ?? { x: 9, y: 14 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E12', stage,
    stageIndex: stage === 'INJURY' ? 1 : stage === 'FATALITY' ? 3 : 2, actorHostIds: ['porter_gavrila', 'midwife_avdotya'],
    date: state.world.date, minute: minuteOffset, mapId: event?.mapId ?? 'market-quay', position: { ...position },
    valueStatus: 'fictional_gameplay_balance', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    witnessedByPlayer: playerCanObserveWorldEvent(state, event?.mapId ?? 'market-quay', position, 6, maps), ...details };
}
function missingRegisterEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E20, position = event?.scenePosition ?? { x: 13, y: 12 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E20', stage,
    actorHostIds: ['clerk_alexei', 'senior_clerk_konstantin'], date: state.world.date, minute: minuteOffset,
    mapId: 'chancery', position: { ...position }, occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED', valueStatus: 'fictional_gameplay_balance',
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'chancery', position, 6, maps), state: event ? clone(event) : null, ...details };
}
function beginMissingRegisterEvent(state, work, minuteOffset, maps, livingEventRows) {
  if (work.hostId !== 'clerk_alexei' || work.actionId !== 'V36_CLERK_REGISTER_INTAKE'
    || state.world.livingEventStates?.E20) return;
  state.world.livingEventStates ??= {};
  const position = { x: 14, y: 12 };
  state.world.livingEventStates.E20 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E20',
    status: 'ACTIVE', stage: 'RECORD_NOT_FOUND', trigger: 'completed_clerk_intake_with_unmatched_register_slip',
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    startedAtMinute: state.world.clockMinutes, autoResolveAtMinute: state.world.clockMinutes + 180,
    clerkHostId: work.hostId, supervisorHostId: 'senior_clerk_konstantin', scenePosition: position,
    document: { itemKo: '접수 표지 한 장', location: '접수부 반송 서류 더미', status: 'UNMATCHED', isHistoricalDocument: false },
    officialRecordNumber: null };
  livingEventRows.push(missingRegisterEventRow(state, 'RECORD_NOT_FOUND', minuteOffset, maps,
    { changeKo: '접수부 번호와 맞지 않는 표지가 반송 서류 더미에서 발견됐다. 알렉세이는 장부를 다시 확인하고, 콘스탄틴은 관청으로 향한다.' }));
}
function advanceMissingRegisterEvent(state, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E20;
  if (!event || event.status !== 'ACTIVE' || state.world.clockMinutes < event.autoResolveAtMinute) return;
  event.status = 'RESOLVED'; event.stage = 'UNMATCHED_FILED_AUTOMATICALLY';
  event.resolvedAtMinute = state.world.clockMinutes; event.resolutionActionId = 'E20_AUTO_FILE_UNMATCHED';
  event.officialRecordNumber = state.ledger.length + 1;
  event.document.location = '미결 서류함'; event.document.status = 'UNMATCHED_FILED';
  livingEventRows.push(missingRegisterEventRow(state, event.stage, minuteOffset, maps,
    { changeKo: '플레이어가 개입하지 않아 콘스탄틴이 번호 불일치를 미결 목록에 올렸다. 표지는 원본으로 취급하지 않고 미결 서류함으로 옮겼다.',
      officialRecordNumber: event.officialRecordNumber, resolutionActionId: event.resolutionActionId }));
}
function apprenticeFatigueEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E33, position = event?.scenePosition ?? { x: 14, y: 12 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E33', stage,
    actorHostIds: ['print_apprentice_stepan', 'printer_ekaterina'], date: state.world.date,
    minute: minuteOffset, mapId: 'printshop', position: { ...position },
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance', witnessedByPlayer: playerCanObserveWorldEvent(state, 'printshop', position, 6, maps),
    state: event ? clone(event) : null, ...details };
}
function beginApprenticeFatigueEvent(state, host, workAction, minuteOffset, maps, livingEventRows) {
  const threshold = Math.max(30, host.needs?.restThreshold ?? 46);
  if (host.id !== 'print_apprentice_stepan' || !['V36_APPRENTICE_SELECT_TYPE', 'V36_APPRENTICE_ORDER_WORK'].includes(workAction?.id)
    || state.world.livingEventStates?.E33 || (host.needs?.fatigue ?? 0) < threshold) return false;
  state.world.livingEventStates ??= {};
  const scenePosition = { x: 14, y: 12 };
  state.world.livingEventStates.E33 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E33',
    status: 'ACTIVE', stage: 'FATIGUE_LIMIT_REACHED', trigger: 'authored_work_and_rest_threshold',
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    startedAtMinute: state.world.clockMinutes, autoResolveAtMinute: state.world.clockMinutes + 45,
    studentHostId: host.id, coworkerHostId: 'printer_ekaterina', scenePosition,
    workActionId: workAction.id, fatigueAtTrigger: host.needs.fatigue,
    workProgressAtTrigger: host.workActionProgress?.[`${Math.floor(state.world.clockMinutes / 1440)}:${workAction.id}`] ?? 0,
    workOutputTransferred: false };
  livingEventRows.push(apprenticeFatigueEventRow(state, 'FATIGUE_LIMIT_REACHED', minuteOffset, maps,
    { changeKo: '스테판은 작업 시간과 피로 회복 기준에 닿아 손을 멈췄다. 인쇄소 동료가 작업대 옆으로 와서 다음 순서를 함께 정한다.',
      fatigueAtTrigger: host.needs.fatigue, workActionId: workAction.id }));
  return true;
}
function advanceApprenticeFatigueEvent(state, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E33;
  if (!event || event.status !== 'ACTIVE' || state.world.clockMinutes < event.autoResolveAtMinute) return;
  event.status = 'RESOLVED'; event.stage = event.stage === 'WORK_COVERED'
    ? 'RESTED_AFTER_COWORKER_COVER' : event.stage === 'SHIFT_STOPPED'
      ? 'RESTED_AFTER_SHIFT_STOP' : event.stage === 'REST_REQUESTED'
        ? 'RESTED_AFTER_BREAK' : 'RESTED_UNATTENDED';
  event.resolvedAtMinute = state.world.clockMinutes;
  const student = state.hosts[event.studentHostId];
  if (student?.needs) student.needs.fatigue = Math.max(0, student.needs.fatigue - 8);
  livingEventRows.push(apprenticeFatigueEventRow(state, event.stage, minuteOffset, maps,
    { changeKo: event.stage === 'RESTED_AFTER_BREAK'
      ? '스테판은 요청한 휴식 뒤 미완료 작업을 다시 이어갔다.'
      : event.stage === 'RESTED_AFTER_COWORKER_COVER'
      ? '스테판은 작업대에서 쉬고, 예카테리나가 넘겨받은 묶음을 정리했다.'
      : event.stage === 'RESTED_AFTER_SHIFT_STOP'
        ? '남은 작업을 다음 날로 넘기고 스테판은 작업대를 떠나 쉬었다.'
        : '도움을 기다리지 못한 스테판은 작업대 옆에서 쉬었다. 중단된 작업은 휴식 뒤 다시 이어졌다.',
    fatigueAfterRest: student?.needs?.fatigue ?? null }));
}
function beginWarehouseInjury(state, host, workAction, minuteOffset, maps, livingEventRows) {
  if (state.world.livingEventStates?.E12 || host.id !== 'porter_gavrila'
    || workAction.id !== 'V37_PORTER_UNLOAD_HEAVY_SACK' || workAction.loadClass !== 'HEAVY'
    || host.needs.fatigue < 30) return false;
  state.world.livingEventStates ??= {};
  const severity = host.needs.fatigue >= 88 ? 'CRITICAL' : 'MILD';
  const event = state.world.livingEventStates.E12 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E12',
    status: 'ACTIVE', stage: 'INJURY', startedAtMinute: state.world.clockMinutes,
    autoResolveAtMinute: state.world.clockMinutes + (severity === 'CRITICAL' ? 1440 : 31), mapId: host.mapId, position: { ...host.position },
    porterHostId: host.id, careHostId: 'midwife_avdotya', workActionId: workAction.id,
    injuryId: 'GAVRILA_HEAVY_LOAD_SHOULDER_STRAIN', severity, restedMinutes: 0,
    cargo: { itemKo: '밀가루 자루', status: 'FELL_TO_GROUND', position: { ...host.position } },
    valueStatus: 'fictional_gameplay_balance', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
  host.healthState = { condition: 'INJURED', injury: { id: event.injuryId, severity: event.severity,
    onsetMinute: state.world.clockMinutes, care: 'AWAITING_DECISION' }, recoveryUntilMinute: null,
    valueStatus: 'FICTIONAL_CHARACTER_DESIGN' };
  const dayIndex = Math.floor(state.world.clockMinutes / 1440);
  delete host.workActionProgress?.[`${dayIndex}:${workAction.id}`];
  livingEventRows.push(livingWarehouseInjuryEventRow(state, 'INJURY', minuteOffset, maps,
    { changeKo: severity === 'CRITICAL' ? '지친 몸으로 무거운 자루를 내리다 가브릴라가 크게 다쳤다. 오늘 안에 처치가 필요하다'
      : '무거운 밀가루 자루를 내리다 가브릴라가 어깨를 다쳐 하역을 멈춘다',
      injuryId: event.injuryId, cargo: { ...event.cargo } }));
  return true;
}
function advanceWarehouseInjury(state, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E12;
  for (const host of Object.values(state.hosts)) {
    if (host.healthState?.condition === 'RECOVERING' && Number.isInteger(host.healthState.recoveryUntilMinute)
      && state.world.clockMinutes >= host.healthState.recoveryUntilMinute) {
      host.healthState = { condition: 'FIT', injury: null, recoveryUntilMinute: null, valueStatus: host.healthState.valueStatus };
    }
  }
  if (!event) return;
  if (event.status === 'RESOLVED' && event.stage === 'RESTED_UNTREATED' && event.severity === 'CRITICAL'
    && state.world.clockMinutes >= event.fatalityDeadlineMinute) {
    const porter = state.hosts[event.porterHostId];
    if (porter?.kind === 'FICTIONAL' && porter.historicalAliveAndPresent !== false) {
      porter.historicalAliveAndPresent = false; porter.lifeStatus = 'DECEASED';
      porter.deathRecord = { causeId: event.injuryId, minute: state.world.clockMinutes, date: state.world.date,
        mapId: event.mapId, valueStatus: 'fictional_gameplay_outcome' };
      if (state.player.embodiment === porter.id) {
        state.player.embodiment = null; state.player.position = { ...porter.position };
        state.world.possessionHistory.push({ eventId: `RELEASE_DEATH_${state.world.possessionHistory.length + 1}`,
          date: state.world.date, hostId: porter.id, mapId: porter.mapId, reason: 'host_died_after_untreated_critical_injury' });
      }
      state.world.deathRecords ??= [];
      state.world.deathRecords.push({ hostId: porter.id, ...porter.deathRecord });
      event.stage = 'FATALITY'; event.resolutionActionId = 'AUTO_UNTREATED_CRITICAL_INJURY';
      event.resolvedAtMinute = state.world.clockMinutes;
      livingEventRows.push(livingWarehouseInjuryEventRow(state, 'FATALITY', minuteOffset, maps,
        { changeKo: '하루 동안 처치를 받지 못한 가브릴라가 중상을 이기지 못했다', causeId: event.injuryId }));
      beginFuneralCostsEvent(state, porter, minuteOffset, maps, livingEventRows);
    }
    return;
  }
  if (event.status !== 'ACTIVE') return;
  if (state.world.clockMinutes < event.autoResolveAtMinute) { event.restedMinutes += 1; return; }
  if (event.severity === 'CRITICAL') {
    const porter = state.hosts[event.porterHostId];
    event.status = 'RESOLVED'; event.stage = 'RESTED_UNTREATED'; event.resolvedAtMinute = state.world.clockMinutes;
    event.fatalityDeadlineMinute = state.world.clockMinutes + 1;
    if (porter) porter.healthState = { condition: 'INJURED', injury: { id: event.injuryId, severity: 'CRITICAL',
      onsetMinute: event.startedAtMinute, care: 'RESTED_UNTREATED' }, recoveryUntilMinute: null,
      valueStatus: 'FICTIONAL_CHARACTER_DESIGN' };
    livingEventRows.push(livingWarehouseInjuryEventRow(state, 'RESTED_UNTREATED', minuteOffset, maps,
      { changeKo: '가브릴라의 상처가 깊다. 처치를 받지 못하면 하루 안에 목숨을 잃을 수 있다', restedMinutes: event.restedMinutes }));
    return;
  }
  event.status = 'RESOLVED'; event.stage = 'RESTED_UNTREATED'; event.resolvedAtMinute = state.world.clockMinutes;
  event.cargo.status = 'LEFT_AT_WORKSITE';
  state.hosts[event.porterHostId].healthState = { condition: 'RECOVERING', injury: { id: event.injuryId,
    severity: event.severity, onsetMinute: event.startedAtMinute, care: 'RESTED_WITHOUT_TREATMENT' },
    recoveryUntilMinute: state.world.clockMinutes + 240, valueStatus: 'FICTIONAL_CHARACTER_DESIGN' };
  livingEventRows.push(livingWarehouseInjuryEventRow(state, 'RESTED_UNTREATED', minuteOffset, maps,
    { changeKo: '가브릴라는 조산사를 부르지 못한 채 쉬고, 자루는 작업장에 남는다',
      restedMinutes: event.restedMinutes, cargo: { ...event.cargo } }));
}

function funeralCostsEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E28, position = event?.scenePosition ?? { x: 11, y: 10 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E28', stage,
    stageIndex: ({ FUNERAL_COSTS_DUE: 1, FUNERAL_COSTS_PAID: 2, FUNERAL_COSTS_ON_CREDIT: 2,
      FUNERAL_COSTS_PAID_UNATTENDED: 3, FUNERAL_COSTS_ON_CREDIT_UNATTENDED: 3, FUNERAL_POSTPONED: 3,
      FUNERAL_DEBT_PARTIAL_PAYMENT: 4, FUNERAL_DEBT_REPAID: 5 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute: minuteOffset, mapId: event?.venueMapId ?? 'communal-room', position: { ...position },
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance', state: event ? clone(event) : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, event?.venueMapId ?? 'communal-room', position, 6, maps), ...details };
}

function beginFuneralCostsEvent(state, deceased, minuteOffset, maps, livingEventRows) {
  if (state.world.livingEventStates?.E28 || deceased?.kind !== 'FICTIONAL') return;
  const nextOfKin = (deceased.relationshipEdges ?? []).filter(edge => edge.kind === 'KINSHIP'
    && state.hosts[edge.toHostId]?.kind === 'FICTIONAL' && state.hosts[edge.toHostId]?.historicalAliveAndPresent !== false)
    .map(edge => edge.toHostId).sort()[0];
  if (!nextOfKin || !state.hosts.innkeeper_irina || !state.hosts.courier_pavel?.allowedMaps.includes('communal-room')) return;
  const actors = [nextOfKin, 'innkeeper_irina'].filter((id, index, all) => all.indexOf(id) === index
    && state.hosts[id]?.historicalAliveAndPresent !== false);
  state.world.livingEventStates ??= {};
  state.world.livingEventStates.E28 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E28',
    status: 'ACTIVE', stage: 'FUNERAL_COSTS_DUE', trigger: 'fictional_relative_death_after_untreated_critical_injury',
    startedAtMinute: state.world.clockMinutes, deadlineMinute: state.world.clockMinutes + 360,
    deceasedHostId: deceased.id, organizerHostId: nextOfKin, lenderHostId: 'innkeeper_irina', actorHostIds: actors,
    witnessHostIds: [], venueMapId: 'communal-room', scenePosition: { x: 11, y: 10 }, cost: 4, unit: 'kopeks',
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance' };
  livingEventRows.push(funeralCostsEventRow(state, 'FUNERAL_COSTS_DUE', minuteOffset, maps,
    { changeKo: `${state.hosts[nextOfKin].displayNameKo}가 ${deceased.displayNameKo}의 장례비를 마련해야 한다`,
      deceasedHostId: deceased.id, organizerHostId: nextOfKin, cost: 4, unit: 'kopeks' }));
}

function advanceFuneralCostsEvent(state, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E28;
  if (!event) return;
  if (event.status !== 'ACTIVE') {
    const debt = event.debt;
    if (!debt || debt.status !== 'OUTSTANDING' || state.world.clockMinutes < debt.nextPaymentAtMinute) return;
    const debtor = state.hosts[debt.debtorHostId], creditor = state.hosts[debt.creditorHostId];
    const amount = Math.min(2, debt.remainingAmount);
    if (!debtor || !creditor || debtor.id === state.player.embodiment || creditor.id === state.player.embodiment
      || debtor.historicalAliveAndPresent === false || creditor.historicalAliveAndPresent === false
      || debtor.mapId !== 'inn-interior' || creditor.mapId !== 'inn-interior'
      || !nearTile(debtor.position, creditor.position, 4) || debtor.money?.unit !== debt.unit || debtor.money.amount < amount) return;
    debtor.money.amount -= amount; creditor.money.amount += amount;
    debt.amountRepaid += amount; debt.remainingAmount -= amount; debt.lastPaymentAmount = amount;
    debt.lastPaymentAtMinute = state.world.clockMinutes;
    debt.status = debt.remainingAmount === 0 ? 'SETTLED' : 'OUTSTANDING';
    if (debt.remainingAmount > 0) debt.nextPaymentAtMinute = state.world.clockMinutes + 360;
    else {
      debt.settledAtMinute = state.world.clockMinutes;
      if (state.quests?.V37_FUNERAL_DEBT_REPAYMENT_1847) {
        state.quests.V37_FUNERAL_DEBT_REPAYMENT_1847 = { status: 'resolved', result: 'AUTO_E28_DEBT_SETTLED' };
      }
    }
    for (const hostId of event.actorHostIds) {
      if (state.hosts[hostId]?.activeGoal?.taskId?.startsWith('V37:E28:DEBT:')) state.hosts[hostId].activeGoal = null;
    }
    livingEventRows.push(funeralCostsEventRow(state, debt.status === 'SETTLED' ? 'FUNERAL_DEBT_REPAID' : 'FUNERAL_DEBT_PARTIAL_PAYMENT',
      minuteOffset, maps, { actionId: 'AUTO_E28_DEBT_INSTALLMENT', paidByHostId: debtor.id, paidToHostId: creditor.id,
        paidAmount: amount, remainingAmount: debt.remainingAmount, mapId: debtor.mapId, position: { ...debtor.position },
        witnessedByPlayer: playerCanObserveWorldEvent(state, debtor.mapId, debtor.position, 6, maps),
        changeKo: debt.remainingAmount === 0 ? '파벨이 장례비 빚을 모두 갚았다' : `파벨이 장례비 빚 ${amount}코페이카를 갚았다. ${debt.remainingAmount}코페이카가 남았다` }));
    return;
  }
  if (state.world.clockMinutes < event.deadlineMinute) return;
  const organizer = state.hosts[event.organizerHostId], lender = state.hosts[event.lenderHostId];
  if (organizer?.money?.unit === event.unit && organizer.money.amount >= event.cost) {
    organizer.money.amount -= event.cost; event.stage = 'FUNERAL_COSTS_PAID_UNATTENDED';
    event.paidByHostId = organizer.id; event.paidAmount = event.cost; event.status = 'RESOLVED';
    event.resolutionActionId = 'AUTO_NEXT_OF_KIN_PAID'; event.resolvedAtMinute = state.world.clockMinutes;
  } else if (lender?.money?.unit === event.unit && lender.money.amount >= event.cost) {
    lender.money.amount -= event.cost; event.stage = 'FUNERAL_COSTS_ON_CREDIT_UNATTENDED';
    event.paidByHostId = lender.id; event.paidAmount = event.cost; event.status = 'RESOLVED';
    event.debt = { debtorHostId: organizer.id, creditorHostId: lender.id, amount: event.cost, unit: event.unit,
      openedAtMinute: state.world.clockMinutes, status: 'OUTSTANDING', amountRepaid: 0,
      remainingAmount: event.cost, dueAtMinute: state.world.clockMinutes + 720,
      nextPaymentAtMinute: state.world.clockMinutes + 720, causeId: 'E28_FUNERAL_COSTS' };
    event.resolutionActionId = 'AUTO_LENDER_ADVANCE'; event.resolvedAtMinute = state.world.clockMinutes;
  } else {
    event.stage = 'FUNERAL_POSTPONED'; event.status = 'RESOLVED'; event.paidAmount = 0;
    event.resolutionActionId = 'AUTO_FUNERAL_POSTPONED'; event.resolvedAtMinute = state.world.clockMinutes;
  }
  livingEventRows.push(funeralCostsEventRow(state, event.stage, minuteOffset, maps,
    { changeKo: event.stage === 'FUNERAL_COSTS_PAID_UNATTENDED' ? '파벨이 가진 돈으로 장례 비용을 냈다'
      : event.stage === 'FUNERAL_COSTS_ON_CREDIT_UNATTENDED' ? '이리나가 비용을 대신 내고 파벨에게 빚으로 적었다'
        : '비용을 마련하지 못해 장례를 미뤘다', paidByHostId: event.paidByHostId ?? null,
      paidAmount: event.paidAmount, debt: event.debt ?? null }));
}

function sickLodgerEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E15, position = event?.scenePosition ?? { x: 5, y: 5 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E15', stage,
    actorHostIds: [...(event?.actorHostIds ?? ['lodging_tatyana'])], date: state.world.date, minute: minuteOffset, mapId: 'inn-interior',
    position: { ...position }, valueStatus: 'fictional_gameplay_balance',
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'inn-interior', position, 6, maps), ...details };
}
function advanceSickLodger(state, minuteOffset, maps, livingEventRows, options = {}) {
  const event = state.world.livingEventStates?.E15;
  const patient = state.hosts.lodging_tatyana;
  if (patient?.healthState?.condition === 'RECOVERING' && Number.isInteger(patient.healthState.recoveryUntilMinute)
    && state.world.clockMinutes >= patient.healthState.recoveryUntilMinute && patient.healthState.illness) {
    patient.healthState = { condition: 'FIT', injury: null, recoveryUntilMinute: null, valueStatus: patient.healthState.valueStatus };
  }
  if (event?.status === 'ACTIVE' && event.stage === 'MIDWIFE_REQUESTED') {
    const caregiver = state.hosts[event.caregiverHostId];
    if (caregiver?.historicalAliveAndPresent !== false && caregiver.mapId === event.mapId
      && nearTile(caregiver.position, event.scenePosition, 2)) {
      event.stage = 'MIDWIFE_PRESENT'; event.arrivedAtMinute = state.world.clockMinutes;
      event.actorHostIds = [event.patientHostId, caregiver.id]; event.resolvesAtMinute = state.world.clockMinutes + 20;
      event.witnessHostIds = Object.values(state.hosts).filter(host => !event.actorHostIds.includes(host.id)
        && host.historicalAliveAndPresent !== false && host.mapId === event.mapId
        && nearTile(host.position, event.scenePosition, 5)).map(host => host.id).sort();
      caregiver.currentActivityKo = '타티야나의 곁에서 다음 호출 전까지 이야기를 듣는다';
      if (patient?.healthState?.condition === 'UNWELL') patient.healthState.illness.care = 'CAREGIVER_PRESENT_GAMEPLAY';
      livingEventRows.push(sickLodgerEventRow(state, event.stage, minuteOffset, maps,
        { changeKo: '아브도티야는 문턱에서 먼저 물었다. “타티야나, 어디가 제일 불편해? 내가 다음 호출 전까지 여기 앉아 있을게.”',
          caregiverHostId: caregiver.id, arrivedAtMinute: event.arrivedAtMinute, witnessHostIds: [...event.witnessHostIds] }));
    }
  }
  if (event?.status === 'ACTIVE' && event.stage === 'MIDWIFE_PRESENT' && state.world.clockMinutes >= event.resolvesAtMinute) {
    event.status = 'RESOLVED'; event.stage = 'CARE_COMPLETED'; event.resolvedAtMinute = state.world.clockMinutes;
    event.requestActionId = event.resolutionActionId; event.resolutionActionId = 'AUTO_MIDWIFE_VISIT_COMPLETED';
    const caregiver = state.hosts[event.caregiverHostId];
    if (patient?.healthState?.condition === 'UNWELL') {
      patient.healthState = { condition: 'RECOVERING', injury: null,
        illness: { ...patient.healthState.illness, care: 'COMPANION_REST_GAMEPLAY' },
        recoveryUntilMinute: state.world.clockMinutes + 180, valueStatus: 'FICTIONAL_CHARACTER_DESIGN' };
    }
    if (caregiver) caregiver.needs.fatigue = Math.min(100, caregiver.needs.fatigue + 3);
    if (patient && caregiver) {
      patient.relations[caregiver.id] = '몸이 불편할 때 곁에 와 준 산파';
      caregiver.relations[patient.id] = '곁에서 다음 호출 전까지 쉰 하숙인';
    }
    livingEventRows.push(sickLodgerEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '아브도티야는 다음 호출을 위해 일어섰다. 타티야나는 조금 더 누워 있기로 했다.',
        resolutionActionId: event.resolutionActionId, caregiverHostId: event.caregiverHostId,
        caregiverFatigueAfter: caregiver?.needs.fatigue ?? null, paidAmount: event.carePrice,
        witnessHostIds: [...event.witnessHostIds] }));
    return;
  }
  if (!event && state.world.chapterId === 'V33_1847_PRINT' && !state.world.activeRealm
    && state.world.date >= '1847-06-06' && state.world.date <= '1849-05-31'
    && ((state.world.clockMinutes % 1440) + 1440) % 1440 === 420) {
    const scenePatient = state.hosts.lodging_tatyana, map = maps?.['inn-interior'];
    if (scenePatient && map?.layers?.some(item => item.name === 'Interactions')
      && scenePatient.historicalAliveAndPresent !== false && scenePatient.allowedMaps.includes('inn-interior')
      && ((scenePatient.needs?.fatigue ?? 0) >= 65 || (scenePatient.needs?.hunger ?? 0) >= 80)) {
      const bed = layer(map, 'Interactions')?.objects.find(item => item.id === 4000);
      if (bed) {
        const position = objectTile(bed);
        scenePatient.mapId = 'inn-interior'; scenePatient.position = { ...position };
        scenePatient.healthState = { condition: 'UNWELL', injury: null,
          illness: { id: 'FICTIONAL_TRANSIENT_MALAISE', severity: 'MILD', onsetMinute: state.world.clockMinutes,
            care: 'AWAITING_CHOICE', valueStatus: 'FICTIONAL_CHARACTER_DESIGN' }, recoveryUntilMinute: null,
          valueStatus: 'FICTIONAL_CHARACTER_DESIGN' };
        state.world.livingEventStates ??= {};
        state.world.livingEventStates.E15 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E15',
          status: 'ACTIVE', stage: 'CARE_REQUESTED', patientHostId: scenePatient.id, caregiverHostId: 'midwife_avdotya', actorHostIds: [scenePatient.id],
          witnessHostIds: [], startedAtMinute: state.world.clockMinutes, resolvesAtMinute: state.world.clockMinutes + 120,
          mapId: 'inn-interior', scenePosition: position, resolutionActionId: null,
          triggerMechanism: 'FICTIONAL_NEEDS_THRESHOLD_ONLY; NO_MEDICAL_CAUSATION_CLAIM',
          occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
          valueStatus: 'fictional_gameplay_balance' };
        livingEventRows.push(sickLodgerEventRow(state, 'CARE_REQUESTED', minuteOffset, maps,
          { changeKo: '타티야나는 재봉을 멈추고 하숙집 침상에 누웠다. “오늘은 손에 힘이 안 들어가네.”' }));
      }
    }
  }
  if (!event || event.status !== 'ACTIVE' || options.deferLivingEventExpiryId === 'E15') return;
  if (state.world.clockMinutes < event.resolvesAtMinute) return;
  const visitMissed = event.stage === 'MIDWIFE_REQUESTED';
  event.status = 'RESOLVED'; event.stage = event.stage === 'PRIVACY_CHOSEN' ? 'RESTED_IN_PRIVACY'
    : event.stage === 'MIDWIFE_REQUESTED' ? 'RESTED_AFTER_MISSED_VISIT'
      : event.stage === 'CARE_ACCEPTED' ? 'RESTED_AFTER_HELP_REQUEST' : 'RESTED_UNATTENDED';
  event.resolvedAtMinute = state.world.clockMinutes;
  if (visitMissed) { event.requestActionId = event.resolutionActionId; event.resolutionActionId = 'AUTO_MIDWIFE_MISSED_VISIT'; }
  else event.resolutionActionId ??= 'AUTO_REST';
  const resolvedPatient = state.hosts[event.patientHostId];
  if (resolvedPatient?.healthState?.condition === 'UNWELL') {
    resolvedPatient.healthState = { condition: 'RECOVERING', injury: null, illness: { ...resolvedPatient.healthState.illness,
      care: event.stage === 'RESTED_IN_PRIVACY' ? 'PRIVATE_REST'
        : event.stage === 'RESTED_AFTER_MISSED_VISIT' ? 'REQUESTED_VISIT_DID_NOT_ARRIVE'
          : event.stage === 'RESTED_AFTER_HELP_REQUEST' ? 'NEIGHBOR_HELP_REQUESTED' : 'RESTED_UNATTENDED' },
      recoveryUntilMinute: state.world.clockMinutes + 180, valueStatus: 'FICTIONAL_CHARACTER_DESIGN' };
  }
  livingEventRows.push(sickLodgerEventRow(state, event.stage, minuteOffset, maps,
    { changeKo: event.stage === 'RESTED_IN_PRIVACY' ? '타티야나는 문을 닫고 한동안 쉬었다. 하숙집에 상태를 알리지 않았다.'
      : event.stage === 'RESTED_AFTER_MISSED_VISIT' ? '아브도티야는 제시간에 오지 못했다. 타티야나는 침상에서 더 쉬었다.'
        : event.stage === 'RESTED_AFTER_HELP_REQUEST' ? '타티야나는 이웃에게 도움을 청한 뒤 침상에서 쉬었다.'
          : '타티야나는 한동안 쉬었다.', resolutionActionId: event.resolutionActionId }));
}

function routineActivityState(activityKo = '', task = null) {
  if (task?.type === 'DELIVER') return 'DELIVERING';
  if (/식사|쉬|휴식|잠|문을 닫|하루를 마|집으로 돌아/.test(activityKo)) return 'RESTING';
  if (/사러|팔|값을|장사|손님|거래|물건을 건네|물건을 전/.test(activityKo)) return 'TRADING';
  if (/대화|읽|수업|모임|이야기|방문/.test(activityKo)) return 'SOCIALIZING';
  if (activityKo) return 'WORKING';
  return 'IDLE';
}

function setRoutineState(worldState, host, state, activityKo, targetMapId, targetPosition, absoluteMinute, stateChanges, minuteOffset, maps) {
  const previous = host.routineState?.state ?? 'IDLE';
  if (previous !== state || host.routineState?.activityKo !== activityKo || host.routineState?.targetMapId !== targetMapId) {
    host.routineState = { state, activityKo, targetMapId, targetPosition: targetPosition ? { ...targetPosition } : null, changedAtMinute: absoluteMinute, minutesInState: 0 };
    stateChanges.push({ hostId: host.id, minute: minuteOffset, from: previous, to: state, activityKo, mapId: host.mapId,
      position: { ...host.position }, witnessedByPlayer: playerCanObserveWorldEvent(worldState, host.mapId, host.position, 6, maps) });
  } else {
    host.routineState.minutesInState = Math.min(10080, (host.routineState.minutesInState ?? 0) + 1);
  }
}

const NPC_STEPS = Object.freeze([[0, -1, 'up'], [1, 0, 'right'], [0, 1, 'down'], [-1, 0, 'left']]);
function tileKey(position) { return `${position.x},${position.y}`; }
function isReserved(mapId, position, reservedTiles) {
  return reservedTiles.some(tile => tile.mapId === mapId && tile.position.x === position.x && tile.position.y === position.y);
}
const mapExitObjectCache = new WeakMap();
const exitClearanceCache = new WeakMap();
const mapRouteCache = new WeakMap();
function npcCanOccupy(state, hostId, mapId, position, maps, reservedTiles) {
  const map = maps?.[mapId];
  if (!canOccupy(map, position.x, position.y, hostId, state.hosts) || isReserved(mapId, position, reservedTiles)) return false;
  if (!state.player.embodiment && state.world.currentMapId === mapId && state.player.position.x === position.x && state.player.position.y === position.y) return false;
  return true;
}
function findGridPath(map, start, goals, canStep) {
  const goalKeys = new Set(goals.map(tileKey)), startKey = tileKey(start);
  if (goalKeys.has(startKey)) return [];
  const queue = [start], visited = new Map([[startKey, null]]);
  let found = null;
  for (let cursor = 0; cursor < queue.length && !found; cursor += 1) {
    const position = queue[cursor], key = tileKey(position);
    for (const [dx, dy] of NPC_STEPS) {
      const next = { x: position.x + dx, y: position.y + dy }, nextKey = tileKey(next);
      if (visited.has(nextKey) || !canStep(next)) continue;
      visited.set(nextKey, { previous: key, next });
      if (goalKeys.has(nextKey)) { found = nextKey; break; }
      queue.push(next);
    }
  }
  if (!found) return null;
  const path = [];
  for (let key = found; key !== startKey;) { const node = visited.get(key); path.push(node.next); key = node.previous; }
  return path.reverse();
}
function mapExitObjects(map) {
  if (!map) return [];
  const cached = mapExitObjectCache.get(map);
  if (cached) return cached;
  const exits = (layer(map, 'Interactions')?.objects ?? []).filter(object => object.type === 'map-exit').map(object => ({ object, data: properties(object), tile: objectTile(object) }));
  mapExitObjectCache.set(map, exits);
  return exits;
}
function npcMapRoute(startMapId, targetMapId, host, maps, absoluteMinute = 540, options = {}) {
  if (startMapId === targetMapId) return [];
  const queue = [startMapId], prior = new Map([[startMapId, null]]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const mapId = queue[cursor], map = maps?.[mapId];
    if (!map) continue;
    for (const exit of mapExitObjects(map)) {
      const nextId = exit.data.targetMapId, nextMap = maps?.[nextId];
      if (!nextMap || prior.has(nextId)
        || (!host.allowedMaps.includes(nextId) && !options.allowUnlistedMapIds?.includes(nextId))) continue;
      const accessFailure = mapAccessFailure(nextMap, host, absoluteMinute);
      if (accessFailure && !(accessFailure === 'closed_hours' && options.allowClosedMapIds?.includes(nextId))) continue;
      const currentLiterary = map.metadata?.mapClass === 'LITERARY_REALM', nextLiterary = nextMap.metadata?.mapClass === 'LITERARY_REALM';
      if (currentLiterary !== nextLiterary || (currentLiterary && map.metadata.realmId !== nextMap.metadata.realmId)) continue;
      prior.set(nextId, { previous: mapId, exit });
      if (nextId === targetMapId) {
        const route = [];
        for (let id = nextId; id !== startMapId;) { const node = prior.get(id); route.push({ fromMapId: node.previous, toMapId: id, exit: node.exit }); id = node.previous; }
        return route.reverse();
      }
      queue.push(nextId);
    }
  }
  return null;
}
function exitApproachTiles(map, exitTile) {
  const candidates = [exitTile, ...NPC_STEPS.map(([dx, dy]) => ({ x: exitTile.x + dx, y: exitTile.y + dy }))];
  return candidates.filter(tile => tileAt(layer(map, 'Collision'), tile.x, tile.y) === 0);
}
function exitClearanceTiles(map) {
  const cached = exitClearanceCache.get(map);
  if (cached) return cached;
  const tiles = [];
  for (const { tile } of mapExitObjects(map)) {
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const candidate = { x: tile.x + dx, y: tile.y + dy };
      if (Math.abs(dx) + Math.abs(dy) <= 1 && tileAt(layer(map, 'Collision'), candidate.x, candidate.y) === 0) tiles.push(candidate);
    }
  }
  const result = new Set(tiles.map(tileKey));
  exitClearanceCache.set(map, result);
  return result;
}
function plannedGridStep(state, host, map, goals, cacheKey, maps, reservedTiles, forbidden = new Set()) {
  const canStep = tile => npcCanOccupy(state, host.id, map.mapId, tile, maps, reservedTiles) && !forbidden.has(tileKey(tile));
  let path = host.plannedPath?.key === cacheKey && host.plannedPath.tiles?.length ? host.plannedPath.tiles : null;
  if (!path?.length || Math.abs(path[0].x - host.position.x) + Math.abs(path[0].y - host.position.y) !== 1 || !canStep(path[0])) {
    path = findGridPath(map, host.position, goals, canStep);
  }
  if (!path?.length) {
    host.plannedPath = { key: cacheKey, tiles: [] };
    return null;
  }
  const [next, ...remaining] = path;
  host.plannedPath = { key: cacheKey, tiles: remaining };
  return next;
}
function plannedMapRoute(host, targetMapId, maps, absoluteMinute) {
  const accessPhase = host.allowedMaps.filter(id => maps?.[id]?.metadata?.access).map(id => `${id}:${mapAccessFailure(maps[id], host, absoluteMinute) ?? 'open'}`).join(',');
  const eventAccess = (host.activeGoal?.taskId === 'V37:E19:REACH_READING_PRACTICE' && targetMapId === 'printshop')
    || (host.activeGoal?.taskId?.startsWith('V37:E24:') && targetMapId === 'courtyard');
  const key = `${host.mapId}>${targetMapId}:${host.allowedMaps.join('|')}:${accessPhase}:${eventAccess ? host.activeGoal.taskId.split(':')[1] : ''}`;
  if (host.mapRoutePlan?.key === key && Array.isArray(host.mapRoutePlan.route)) {
    return host.mapRoutePlan.route.map(step => {
      const exit = mapExitObjects(maps[step.fromMapId]).find(item => item.data.exitId === step.exitId);
      return exit ? { ...step, exit } : null;
    }).filter(Boolean);
  }
  const routeOptions = host.activeGoal?.taskId === 'V37:E19:REACH_READING_PRACTICE' && targetMapId === 'printshop'
    ? { allowClosedMapIds: ['printshop'] }
    : host.activeGoal?.taskId?.startsWith('V37:E24:') && targetMapId === 'courtyard'
      ? { allowUnlistedMapIds: ['courtyard'] }
      : host.activeGoal?.taskId?.startsWith('V37:E28:DEBT:') && targetMapId === 'inn-interior'
        ? { allowClosedMapIds: ['inn-interior'] }
      : host.activeGoal?.type === 'NIGHT_REST' && host.residence?.sleepLocation?.mapId === targetMapId
        ? { allowClosedMapIds: [targetMapId] } : {};
  const route = npcMapRoute(host.mapId, targetMapId, host, maps, absoluteMinute, routeOptions);
  host.mapRoutePlan = { key, route: route?.map(step => ({ fromMapId: step.fromMapId, toMapId: step.toMapId, exitId: step.exit.data.exitId })) ?? null };
  return route;
}
function nextNpcStep(state, host, slot, maps, reservedTiles) {
  if (host.mapId !== slot.mapId) {
    const route = plannedMapRoute(host, slot.mapId, maps, state.world.clockMinutes);
    if (!route?.length) return null;
    const { exit, toMapId } = route[0], fromMap = maps[host.mapId], toMap = maps[toMapId];
    const canalEvent = state.world.livingEventStates?.E11;
    const canalExit = ['market-canal-road', 'canal-road-market'].includes(exit.data.exitId);
    const waitingCanalPartner = canalEvent?.stage === 'WAITING_FOR_PARTNER' && canalEvent.actorHostIds.includes(host.id);
    const blockedByActiveBoat = canalEvent?.stage === 'BOAT_TRAFFIC' && canalEvent.actorHostIds.includes(host.id)
      && state.world.clockMinutes < canalEvent.clearsAtMinute;
    const participantCannotLeaveCanal = waitingCanalPartner && host.mapId === 'canal-road' && exit.data.exitId === 'canal-road-market';
    if (canalEvent?.status === 'ACTIVE' && canalExit && (blockedByActiveBoat || participantCannotLeaveCanal)) {
      return null;
    }
    const approach = exitApproachTiles(fromMap, exit.tile);
    if (nearTile(host.position, exit.tile, 1)) {
      const preferred = { x: Number(exit.data.arrivalX), y: Number(exit.data.arrivalY) };
      if (!Number.isInteger(preferred.x) || !Number.isInteger(preferred.y)) return null;
      const arrival = nearestNpcArrival(state, host.id, toMap, preferred, maps, reservedTiles);
      if (!arrival) return null;
      host.plannedPath = { key: null, tiles: [] };
      return { mapId: toMapId, position: arrival, facing: host.facing, viaExit: exit.data.exitId };
    }
    const exitStep = plannedGridStep(state, host, fromMap, approach, `${fromMap.mapId}:EXIT:${exit.data.exitId}`, maps, reservedTiles);
    if (!exitStep) return null;
    const direction = NPC_STEPS.find(([dx, dy]) => host.position.x + dx === exitStep.x && host.position.y + dy === exitStep.y)?.[2];
    return direction ? { mapId: host.mapId, position: exitStep, facing: direction } : null;
  }
  const map = maps?.[host.mapId], requested = slot.position;
  if (!map || !Number.isInteger(requested?.x) || !Number.isInteger(requested?.y)) return null;
  const doorwayTiles = exitClearanceTiles(map);
  let goals = [requested, ...NPC_STEPS.map(([dx, dy]) => ({ x: requested.x + dx, y: requested.y + dy }))]
    .filter(tile => tileAt(layer(map, 'Collision'), tile.x, tile.y) === 0 && !isReserved(host.mapId, tile, reservedTiles) && !doorwayTiles.has(tileKey(tile)));
  if (!goals.length) {
    for (let radius = 2; radius <= 4 && !goals.length; radius += 1) {
      goals = [];
      for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(dx) + Math.abs(dy) !== radius) continue;
        const tile = { x: requested.x + dx, y: requested.y + dy };
        if (tileAt(layer(map, 'Collision'), tile.x, tile.y) === 0 && !isReserved(host.mapId, tile, reservedTiles) && !doorwayTiles.has(tileKey(tile))) goals.push(tile);
      }
    }
  }
  // Doorway clearance tiles are unsuitable stopping points, but they remain
  // walkable route segments between rooms. Blocking them from the path itself
  // silently disconnected interior work markers from otherwise valid routes.
  const next = plannedGridStep(state, host, map, goals, `${map.mapId}:WORK:${requested.x},${requested.y}`, maps, reservedTiles);
  if (!next) return null;
  const direction = NPC_STEPS.find(([dx, dy]) => host.position.x + dx === next.x && host.position.y + dy === next.y)?.[2];
  return direction ? { mapId: host.mapId, position: next, facing: direction } : null;
}
function nearestNpcArrival(state, hostId, map, preferred, maps, reservedTiles) {
  const maxRadius = map.width + map.height;
  const doorwayTiles = exitClearanceTiles(map);
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      const dx = radius - Math.abs(dy);
      const candidates = dx === 0
        ? [{ x: preferred.x, y: preferred.y + dy }]
        : [{ x: preferred.x - dx, y: preferred.y + dy }, { x: preferred.x + dx, y: preferred.y + dy }];
      const open = candidates.find(tile => npcCanOccupy(state, hostId, map.mapId, tile, maps, reservedTiles) && !doorwayTiles.has(tileKey(tile)));
      if (open) return open;
    }
  }
  return null;
}
const npcSocialForecastCache = new WeakMap();
function upcomingNpcSocialWork(state) {
  const cached = npcSocialForecastCache.get(state);
  if (cached?.clockMinutes === state.world.clockMinutes) return cached;
  const clockMinutes = state.world.clockMinutes ?? 540;
  const localMinute = ((clockMinutes % 1440) + 1440) % 1440;
  const dayIndex = Math.floor(clockMinutes / 1440);
  const hostIds = new Set(), mapIds = new Set();
  for (const sender of Object.values(state.hosts)) for (const slot of sender.schedule ?? []) {
    const task = slot.task;
    if (!task || !['DELIVER', 'EXCHANGE', 'CARE_TRANSFER'].includes(task.type) || taskCompletedForDay(sender, task, dayIndex)
      || (task.type === 'CARE_TRANSFER' ? !canMakeAuthoredCareTransfer(state, sender, task) : !sender.inventory.includes(task.itemKo))) continue;
    if (task.requiresMarketStockout === true && (state.hosts.market_nadezhda?.marketStock?.[task.itemKo] ?? 0) > 0) continue;
    const wait = (slot.atMinute - localMinute + 1440) % 1440, recipient = state.hosts[task.recipientHostId];
    const overdueToday = slot.atMinute <= localMinute;
    if ((!overdueToday && wait > 360) || !recipient || recipient.historicalAliveAndPresent === false || sender.historicalAliveAndPresent === false) continue;
    hostIds.add(sender.id); hostIds.add(recipient.id);
    if (!overdueToday) { mapIds.add(slot.mapId); mapIds.add(sender.mapId); mapIds.add(recipient.mapId); }
  }
  const forecast = { clockMinutes, hostIds, mapIds };
  npcSocialForecastCache.set(state, forecast);
  return forecast;
}

function selectNpcRoutineGoal(state, host, scheduledSlot, maps) {
  const localMinute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
  const canalEvent = state.world.livingEventStates?.E11;
  if (canalEvent?.status === 'ACTIVE' && canalEvent.stage === 'WAITING_FOR_PARTNER'
    && canalEvent.actorHostIds.includes(host.id) && host.allowedMaps.includes('canal-road')) {
    return { slot: { mapId: 'canal-road', position: { x: 11, y: 14 }, activityKo: '운하 물가에서 만나기로 한 사람을 기다린다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: canalEvent.actorHostIds.find(id => id !== host.id),
      taskId: 'V37:E11:MEET_AT_CANAL', reason: 'arrive_for_the_canal_crossing_and_wait_for_the_other_carrier',
      selectionBasis: { utilityScore: 170, eventId: 'E11', stage: canalEvent.stage } };
  }
  const homeward = state.world.homewardTravelGoals?.[host.id], home = host.residence?.homeLocation;
  if (homeward && state.world.clockMinutes < homeward.untilMinute && home?.mapId
    && Number.isInteger(home.position?.x) && Number.isInteger(home.position?.y)
    && host.allowedMaps.includes(home.mapId)
    && npcMapRoute(host.mapId, home.mapId, host, maps, state.world.clockMinutes) !== null) {
    return { slot: { mapId: home.mapId, position: { ...home.position }, routineKind: 'FICTIONAL_HOME_SLEEP', activityKo: '여관방을 사양하고 하숙방으로 돌아간다' },
      goalType: 'NIGHT_REST', targetHostId: null, taskId: `V37:E17:RETURN_HOME:${homeward.untilMinute}`,
      reason: 'guest_declined_room_and_walks_back_to_authored_home', selectionBasis: { utilityScore: 180, eventId: 'E17' } };
  }
  const temporaryStay = state.world.temporaryLodgingStays?.[host.id];
  if (temporaryStay && state.world.clockMinutes < temporaryStay.untilMinute
    && host.allowedMaps.includes(temporaryStay.mapId)
    && npcMapRoute(host.mapId, temporaryStay.mapId, host, maps, state.world.clockMinutes, { allowClosedMapIds: [temporaryStay.mapId] }) !== null) {
    return { slot: { mapId: temporaryStay.mapId, position: { ...temporaryStay.position }, routineKind: 'FICTIONAL_HOME_SLEEP',
      activityKo: '빌린 여관방에서 밤을 보낸다' }, goalType: 'NIGHT_REST', targetHostId: null,
      taskId: `V37:E17:REST:${temporaryStay.untilMinute}`, reason: 'temporary_paid_lodging_until_morning',
      selectionBasis: { utilityScore: 188, eventId: 'E17', roomId: temporaryStay.roomId } };
  }
  const innGuest = state.world.livingEventStates?.E17;
  if (innGuest?.status === 'ACTIVE' && [innGuest.guestHostId, innGuest.innkeeperHostId].includes(host.id)
    && host.allowedMaps.includes('inn-interior')
    && npcMapRoute(host.mapId, 'inn-interior', host, maps, state.world.clockMinutes, { allowClosedMapIds: ['inn-interior'] }) !== null) {
    const isGuest = host.id === innGuest.guestHostId;
    return { slot: { mapId: 'inn-interior', position: { ...innGuest.scenePosition }, activityKo: isGuest
      ? '늦은 배달 뒤 여관에서 방값을 묻는다' : '늦게 도착한 손님에게 방을 안내한다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: isGuest ? innGuest.innkeeperHostId : innGuest.guestHostId,
      taskId: `V37:E17:ARRIVAL:${host.id}`, reason: isGuest ? 'courier_requests_room_after_evening_route' : 'innkeeper_receives_late_guest',
      selectionBasis: { utilityScore: 181, eventId: 'E17', stage: innGuest.stage } };
  }
  const newspaperIssue = state.world.livingEventStates?.E22;
  if (newspaperIssue?.status === 'ACTIVE' && newspaperIssue.actorHostIds.includes(host.id)
    && host.allowedMaps.includes('nevsky')
    && npcMapRoute(host.mapId, 'nevsky', host, maps, state.world.clockMinutes) !== null) {
    const isBuyer = host.id === newspaperIssue.buyerHostId;
    return { slot: { mapId: 'nevsky', position: { ...newspaperIssue.scenePosition }, activityKo: isBuyer
      ? '가판에서 산 잡지의 서지 정보를 살펴본다' : '잡지를 판 뒤 독자가 자료를 펼치는 것을 기다린다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: isBuyer ? newspaperIssue.sellerHostId : newspaperIssue.buyerHostId,
      taskId: `V37:E22:ISSUE:${host.id}`, reason: 'periodical_purchase_opens_source_metadata_discussion',
      selectionBasis: { utilityScore: 177, eventId: 'E22', stage: newspaperIssue.stage } };
  }
  const activeSleepSlot = (host.schedule ?? []).find(slot => slot.routineKind === 'FICTIONAL_HOME_SLEEP');
  if (host.activeGoal?.type === 'NIGHT_REST' && activeSleepSlot && localMinute < activeSleepSlot.atMinute
    && !(host.mapId === activeSleepSlot.mapId && nearTile(host.position, activeSleepSlot.position, 1))) {
    return { slot: activeSleepSlot, goalType: 'NIGHT_REST', targetHostId: null,
      taskId: host.activeGoal.taskId, reason: 'finish_overnight_return_after_midnight',
      selectionBasis: { sleepMinute: activeSleepSlot.atMinute, continuingPriorNightGoal: true } };
  }
  const coldWave = state.world.livingEventStates?.E03;
  const marketRumor = state.world.livingEventStates?.E23;
  if (marketRumor?.status === 'ACTIVE' && [marketRumor.carrierHostId, marketRumor.clerkHostId].includes(host.id)
    && host.allowedMaps.includes('market-quay')
    && npcMapRoute(host.mapId, 'market-quay', host, maps, state.world.clockMinutes) !== null) {
    const isCarrier = host.id === marketRumor.carrierHostId;
    return { slot: { mapId: 'market-quay', position: { ...marketRumor.scenePosition }, activityKo: isCarrier ? '장터에서 값에 관한 소문을 전한다' : '장터 기록과 소문을 대조한다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: isCarrier ? marketRumor.clerkHostId : marketRumor.carrierHostId,
      taskId: `V37:E23:${marketRumor.stage}:${host.id}`, reason: isCarrier ? 'market_hawker_carries_unverified_price_rumor_to_the_stall' : 'market_clerk_checks_rumor_against_official_transaction_record',
      selectionBasis: { utilityScore: 179, eventId: 'E23', stage: marketRumor.stage } };
  }
  const apprenticeFatigue = state.world.livingEventStates?.E33;
  if (apprenticeFatigue?.status === 'ACTIVE' && host.id === apprenticeFatigue.studentHostId
    && host.allowedMaps.includes('printshop')
    && npcMapRoute(host.mapId, 'printshop', host, maps, state.world.clockMinutes) !== null) {
    return { slot: { mapId: 'printshop', position: { x: 13, y: 12 }, activityKo: '작업대 옆에서 손을 쉬고 피로를 푼다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: apprenticeFatigue.coworkerHostId,
      taskId: `V37:E33:REST:${apprenticeFatigue.stage}`, reason: 'apprentice_pauses_work_at_authored_rest_threshold',
      selectionBasis: { utilityScore: 181, eventId: 'E33', stage: apprenticeFatigue.stage } };
  }
  if (apprenticeFatigue?.status === 'ACTIVE' && host.id === apprenticeFatigue.coworkerHostId
    && host.allowedMaps.includes('printshop')
    && npcMapRoute(host.mapId, 'printshop', host, maps, state.world.clockMinutes) !== null) {
    return { slot: { mapId: 'printshop', position: { ...apprenticeFatigue.scenePosition }, activityKo: '스테판의 작업을 넘겨받을지 살핀다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: apprenticeFatigue.studentHostId,
      taskId: `V37:E33:CHECK_APPRENTICE:${apprenticeFatigue.stage}`, reason: 'coworker_responds_to_apprentice_fatigue_pause',
      selectionBasis: { utilityScore: 180, eventId: 'E33', stage: apprenticeFatigue.stage } };
  }
  const missingRegister = state.world.livingEventStates?.E20;
  if (missingRegister?.status === 'ACTIVE' && host.id === missingRegister.supervisorHostId
    && host.allowedMaps.includes('chancery')
    && npcMapRoute(host.mapId, 'chancery', host, maps, state.world.clockMinutes) !== null) {
    return { slot: { mapId: 'chancery', position: { ...missingRegister.scenePosition },
      activityKo: '번호가 맞지 않는 접수 표지를 확인한다' }, goalType: 'LIVING_EVENT_RESPONSE',
      targetHostId: missingRegister.clerkHostId, taskId: 'V37:E20:REVIEW_MISSING_REGISTER',
      reason: 'supervisor_reviews_unmatched_register_slip',
      selectionBasis: { utilityScore: 179, eventId: 'E20', stage: missingRegister.stage } };
  }
  const apothecarySupply = state.world.livingEventStates?.E16;
  if (apothecarySupply?.status === 'ACTIVE' && ['SHORTAGE_FOUND', 'ORDER_PLACED'].includes(apothecarySupply.stage)
    && [apothecarySupply.buyerHostId, ...(apothecarySupply.stage === 'ORDER_PLACED' ? [apothecarySupply.supplierHostId] : [])].includes(host.id)
    && host.allowedMaps.includes(apothecarySupply.scenePosition.mapId)
    && npcMapRoute(host.mapId, apothecarySupply.scenePosition.mapId, host, maps, state.world.clockMinutes) !== null) {
    const isSupplier = host.id === apothecarySupply.supplierHostId;
    const buyer = state.hosts[apothecarySupply.buyerHostId];
    return { slot: { mapId: apothecarySupply.scenePosition.mapId,
      position: isSupplier ? { ...buyer.position } : { x: apothecarySupply.scenePosition.x, y: apothecarySupply.scenePosition.y },
      activityKo: isSupplier ? '주문 메모를 확인하고 꾸러미를 약방으로 가져간다' : '재고가 빈 물품표를 거래처와 대조한다' },
    goalType: 'LIVING_EVENT_RESPONSE', targetHostId: isSupplier ? buyer.id : apothecarySupply.supplierHostId,
    taskId: `V37:E16:${apothecarySupply.stage}:${host.id}`, reason: 'apothecary_shortage_requires_counterparty_at_supply_counter',
    selectionBasis: { utilityScore: 177, eventId: 'E16', stage: apothecarySupply.stage } };
  }
  const imminentScheduledWork = (host.schedule ?? []).some(slot => slot.workAction && slot.atMinute > localMinute
    && slot.atMinute - localMinute <= 120);
  const sickLodger = state.world.livingEventStates?.E15;
  if (sickLodger?.status === 'ACTIVE' && ['MIDWIFE_REQUESTED', 'MIDWIFE_PRESENT'].includes(sickLodger.stage)
    && host.id === sickLodger.caregiverHostId && host.allowedMaps.includes(sickLodger.mapId)
    && npcMapRoute(host.mapId, sickLodger.mapId, host, maps, state.world.clockMinutes) !== null) {
    return { slot: { mapId: sickLodger.mapId, position: { ...sickLodger.scenePosition },
      activityKo: sickLodger.stage === 'MIDWIFE_PRESENT' ? '다음 호출 전까지 타티야나의 곁에 앉아 이야기를 듣는다'
        : '타티야나의 부탁을 확인하러 하숙집으로 간다' },
    goalType: 'LIVING_EVENT_RESPONSE', targetHostId: sickLodger.patientHostId,
    taskId: `V37:E15:${sickLodger.stage}`, reason: 'resident_requested_midwife_visit_at_lodging_house',
    selectionBasis: { utilityScore: 178, eventId: 'E15', stage: sickLodger.stage } };
  }
  const eveningLesson = state.world.livingEventStates?.E19;
  if (eveningLesson?.status === 'ACTIVE' && eveningLesson.actorHostIds.includes(host.id)
    && !(scheduledSlot?.workAction && host.activeGoal?.type === 'SCHEDULED_WORK'
      && host.activeGoal?.taskId === scheduledSlot.workAction.id)
    && host.allowedMaps.includes('printshop')
    && npcMapRoute(host.mapId, 'printshop', host, maps, state.world.clockMinutes, { allowClosedMapIds: ['printshop'] }) !== null) {
    return { slot: { mapId: 'printshop', position: { ...eveningLesson.scenePosition }, activityKo: '퇴근 뒤 읽기 연습을 하러 인쇄소에 간다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: null, taskId: 'V37:E19:REACH_READING_PRACTICE',
      reason: 'after_work_literacy_practice_requires_teacher_and_apprentice', selectionBasis: { utilityScore: 176, eventId: 'E19' } };
  }
  const readingCircle = state.world.livingEventStates?.E24;
  if (readingCircle?.status === 'ACTIVE' && readingCircle.actorHostIds.includes(host.id)
    && (host.allowedMaps.includes(readingCircle.venueMapId) || host.id === readingCircle.organizerHostId)
    && npcMapRoute(host.mapId, readingCircle.venueMapId, host, maps, state.world.clockMinutes,
      host.id === readingCircle.organizerHostId ? { allowUnlistedMapIds: [readingCircle.venueMapId] } : {}) !== null) {
    const otherHostId = host.id === readingCircle.studentHostId ? readingCircle.organizerHostId : readingCircle.studentHostId;
    return { slot: { mapId: readingCircle.venueMapId, position: { ...readingCircle.scenePosition },
      activityKo: host.id === readingCircle.studentHostId ? '안뜰 독서 모임 자리를 펴고 함께 읽을 글을 고른다'
        : '바실리와 안뜰에 모여 참석 장부와 읽을 글을 준비한다' },
    goalType: 'LIVING_EVENT_RESPONSE', targetHostId: otherHostId,
    taskId: `V37:E24:${readingCircle.stage}:${host.id}`, reason: 'scheduled_reading_gathering_requires_student_and_reader_together',
    selectionBasis: { utilityScore: 180, eventId: 'E24', stage: readingCircle.stage } };
  }
  const manuscriptOffer = state.world.livingEventStates?.E30;
  if (manuscriptOffer?.status === 'ACTIVE' && manuscriptOffer.actorHostIds.includes(host.id)
    && host.allowedMaps.includes(manuscriptOffer.venueMapId)
    && npcMapRoute(host.mapId, manuscriptOffer.venueMapId, host, maps, state.world.clockMinutes) !== null) {
    const roleActivity = host.id === manuscriptOffer.authorHostId ? '원고를 들고 책방으로 간다'
      : host.id === manuscriptOffer.booksellerHostId ? '책방에 맡길 원고를 보러 간다' : '원고의 인쇄 가능 여부를 살피러 간다';
    return { slot: { mapId: manuscriptOffer.venueMapId, position: { ...manuscriptOffer.scenePosition }, activityKo: roleActivity },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: host.id === manuscriptOffer.authorHostId ? manuscriptOffer.editorHostId : manuscriptOffer.authorHostId,
      taskId: `V37:E30:${manuscriptOffer.stage}:${host.id}`, reason: 'manuscript_offer_requires_author_bookseller_and_editor',
      selectionBasis: { utilityScore: 181, eventId: 'E30', stage: manuscriptOffer.stage } };
  }
  const serfdomReading = state.world.livingEventStates?.E31;
  if (serfdomReading?.status === 'ACTIVE' && serfdomReading.actorHostIds.includes(host.id)
    && host.allowedMaps.includes(serfdomReading.venueMapId)
    && npcMapRoute(host.mapId, serfdomReading.venueMapId, host, maps, state.world.clockMinutes) !== null) {
    const roleActivity = host.id === serfdomReading.readerHostId ? '고골의 책을 펼쳐 두고 다른 독자를 기다린다'
      : host.id === serfdomReading.studentHostId ? '책방에서 펼쳐진 글을 함께 읽으러 간다' : '읽는 이들과 책의 문장을 살핀다';
    return { slot: { mapId: serfdomReading.venueMapId, position: { ...serfdomReading.scenePosition }, activityKo: roleActivity },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: host.id === serfdomReading.readerHostId ? serfdomReading.studentHostId : serfdomReading.readerHostId,
      taskId: `V37:E31:${serfdomReading.stage}:${host.id}`, reason: 'readers_gather_to_discuss_published_gogol_text',
      selectionBasis: { utilityScore: 181, eventId: 'E31', stage: serfdomReading.stage } };
  }
  const physiologyReading = state.world.livingEventStates?.E39;
  if (physiologyReading?.status === 'ACTIVE' && physiologyReading.actorHostIds.includes(host.id)
    && host.allowedMaps.includes(physiologyReading.venueMapId)
    && npcMapRoute(host.mapId, physiologyReading.venueMapId, host, maps, state.world.clockMinutes) !== null) {
    const roleActivity = host.id === physiologyReading.readerHostId ? '투르게네프의 글을 펼쳐 두고 독자를 기다린다'
      : host.id === physiologyReading.studentHostId ? '두 농노의 삶을 비교해 읽으러 책방으로 간다'
      : '독자들에게 책방의 읽을 자리를 내준다';
    return { slot: { mapId: physiologyReading.venueMapId, position: { ...physiologyReading.scenePosition }, activityKo: roleActivity },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: host.id === physiologyReading.readerHostId
        ? physiologyReading.studentHostId : physiologyReading.readerHostId,
      taskId: `V37:E39:${physiologyReading.stage}:${host.id}`, reason: 'readers_gather_to_read_turgenevs_1847_text',
      selectionBasis: { utilityScore: 183, eventId: 'E39', stage: physiologyReading.stage } };
  }
  const salonDebate = state.world.livingEventStates?.E21;
  if (salonDebate?.status === 'ACTIVE' && salonDebate.actorHostIds.includes(host.id)
    && host.allowedMaps.includes(salonDebate.venueMapId)
    && npcMapRoute(host.mapId, salonDebate.venueMapId, host, maps, state.world.clockMinutes) !== null) {
    const roleActivity = host.id === salonDebate.readerHostId ? '벨린스키의 서평을 펼쳐 두고 다른 독자를 기다린다'
      : host.id === salonDebate.studentHostId ? '서평의 주장을 함께 따져 보러 책방으로 간다' : '서평에 적힌 논쟁의 근거를 살핀다';
    return { slot: { mapId: salonDebate.venueMapId, position: { ...salonDebate.scenePosition }, activityKo: roleActivity },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: host.id === salonDebate.readerHostId ? salonDebate.studentHostId : salonDebate.readerHostId,
      taskId: `V37:E21:${salonDebate.stage}:${host.id}`, reason: 'readers_gather_to_discuss_a_public_review',
      selectionBasis: { utilityScore: 182, eventId: 'E21', stage: salonDebate.stage } };
  }
  const marketTheft = state.world.livingEventStates?.E36;
  const unfinishedNeighborShift = host.activeGoal?.type === 'SCHEDULED_WORK' && (host.schedule ?? []).some(slot => slot.workAction?.id === host.activeGoal.taskId
      && !(host.completedWorkActionKeys ?? []).includes(`${Math.floor(state.world.clockMinutes / 1440)}:${slot.workAction.id}`))
      || (host.schedule ?? []).some(slot => {
        if (!slot.workAction || (host.completedWorkActionKeys ?? []).includes(`${Math.floor(state.world.clockMinutes / 1440)}:${slot.workAction.id}`)) return false;
        const wait = (slot.atMinute - localMinute + 1440) % 1440;
        return slot === scheduledSlot || (wait > 0 && wait <= 90);
      });
  const rentContract = host.housing, neighborRentDay = Math.floor(state.world.clockMinutes / 1440);
  const neighborRentDueMinute = Number.isInteger(rentContract?.dueMinute) ? rentContract.dueMinute : 1020;
  const neighborRentTravelLead = Number.isInteger(rentContract?.travelLeadMinutes) ? rentContract.travelLeadMinutes : 120;
  const neighborProtectingHome = rentContract?.kind === 'RENT' && neighborRentDay >= nextRentDueDay(rentContract)
    && rentContract.lastSettledDayIndex !== neighborRentDay
    && localMinute >= neighborRentDueMinute - neighborRentTravelLead
    && localMinute <= (Number.isInteger(rentContract.closeMinute) ? rentContract.closeMinute : 1380);
  const neighborShiftDue = host.id === marketTheft?.neighborHostId && (unfinishedNeighborShift || neighborProtectingHome);
  if (marketTheft?.status === 'ACTIVE' && marketTheft.actorHostIds.includes(host.id)
    && !neighborShiftDue
    && host.allowedMaps.includes(marketTheft.venueMapId)
    && npcMapRoute(host.mapId, marketTheft.venueMapId, host, maps, state.world.clockMinutes) !== null) {
    const roleActivity = host.id === marketTheft.sellerHostId ? '좌판의 분실 금액을 다시 확인한다'
      : host.id === marketTheft.witnessHostId ? '돈주머니가 사라진 때를 떠올려 본다'
        : host.id === marketTheft.watchmanHostId ? '장터의 분실 신고를 살핀다' : '이웃의 손해를 살펴본다';
    return { slot: { mapId: marketTheft.venueMapId, position: { ...marketTheft.scenePosition }, activityKo: roleActivity },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: host.id === marketTheft.sellerHostId
        ? marketTheft.watchmanHostId : marketTheft.sellerHostId,
      taskId: `V37:E36:${marketTheft.stage}:${host.id}`, reason: 'market_loss_witness_and_watchman_gather_at_stall',
      selectionBasis: { utilityScore: 184, eventId: 'E36', stage: marketTheft.stage } };
  }
  const europeNews = state.world.livingEventStates?.E42;
  if (europeNews?.status === 'ACTIVE' && europeNews.actorHostIds.includes(host.id)
    && host.allowedMaps.includes(europeNews.venueMapId)
    && npcMapRoute(host.mapId, europeNews.venueMapId, host, maps, state.world.clockMinutes) !== null) {
    const activities = { clerk_alexei: '황제 선언문의 접수 위치를 살핀다', printer_ekaterina: '선언문 인쇄본을 작업대에 편다',
      reader_darya: '선언문의 표현을 읽어 본다', student_vasily: '유럽 소식과 선언문을 함께 읽으러 간다' };
    return { slot: { mapId: europeNews.venueMapId, position: { ...europeNews.scenePosition },
      activityKo: activities[host.id] ?? '인쇄소에 도착한 선언문을 살핀다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: host.id === 'clerk_alexei' ? 'printer_ekaterina' : 'clerk_alexei',
      taskId: `V37:E42:${europeNews.stage}:${host.id}`, reason: 'read_the_1848_manifesto_with_local_readers',
      selectionBasis: { utilityScore: 184, eventId: 'E42', stage: europeNews.stage } };
  }
  const pushkinObituary = state.world.livingEventStates?.E43;
  if (pushkinObituary?.status === 'ACTIVE' && pushkinObituary.actorHostIds.includes(host.id)
    && host.allowedMaps.includes(pushkinObituary.venueMapId)
    && npcMapRoute(host.mapId, pushkinObituary.venueMapId, host, maps, state.world.clockMinutes) !== null) {
    const activities = { bookseller_lev: '책상 위에 푸시킨 부고를 펼친다',
      reader_darya: '부고의 첫 문장을 읽으러 책방으로 간다', student_vasily: '책방 사람들과 부고를 함께 읽으러 간다' };
    return { slot: { mapId: pushkinObituary.venueMapId, position: { ...pushkinObituary.scenePosition },
      activityKo: activities[host.id] ?? '책방의 부고를 읽으러 간다' }, goalType: 'LIVING_EVENT_RESPONSE',
      targetHostId: host.id === 'bookseller_lev' ? 'reader_darya' : 'bookseller_lev',
      taskId: `V37:E43:${pushkinObituary.stage}:${host.id}`, reason: 'gather_for_the_1837_pushkin_obituary_reading',
      selectionBasis: { utilityScore: 184, eventId: 'E43', stage: pushkinObituary.stage } };
  }
  const belinskyLetter = state.world.livingEventStates?.E44;
  if (belinskyLetter?.status === 'ACTIVE' && belinskyLetter.actorHostIds.includes(host.id)
    && host.allowedMaps.includes(belinskyLetter.venueMapId)
    && npcMapRoute(host.mapId, belinskyLetter.venueMapId, host, maps, state.world.clockMinutes) !== null) {
    const activities = { bookseller_lev: '고골에게 온 벨린스키의 편지 필사본을 펼친다',
      reader_darya: '편지에 적힌 농노제 비판을 읽으러 간다', student_vasily: '책방 사람들과 편지를 읽으러 간다' };
    return { slot: { mapId: belinskyLetter.venueMapId, position: { ...belinskyLetter.scenePosition },
      activityKo: activities[host.id] ?? '책방의 편지를 읽으러 간다' }, goalType: 'LIVING_EVENT_RESPONSE',
      targetHostId: host.id === 'bookseller_lev' ? 'reader_darya' : 'bookseller_lev',
      taskId: `V37:E44:${belinskyLetter.stage}:${host.id}`, reason: 'gather_to_read_the_handwritten_belinsky_letter',
      selectionBasis: { utilityScore: 184, eventId: 'E44', stage: belinskyLetter.stage } };
  }
  const procession = state.world.livingEventStates?.E45;
  if (procession?.status === 'ACTIVE' && procession.actorHostIds.includes(host.id)
    && host.allowedMaps.includes('nevsky')
    && npcMapRoute(host.mapId, 'nevsky', host, maps, state.world.clockMinutes) !== null) {
    const activities = { street_vendor_matryona: '막힌 길목에서 좌판을 지킨다',
      junior_guard_sergey: '통행 지시를 전하러 네프스키 거리로 간다',
      coachman_timofey: '마차를 세우고 길을 살핀다' };
    return { slot: { mapId: 'nevsky', position: { ...procession.scenePosition }, activityKo: activities[host.id] },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: host.id === 'street_vendor_matryona'
        ? 'junior_guard_sergey' : 'street_vendor_matryona',
      taskId: `V37:E45:${procession.stage}:${host.id}`, reason: 'residents_respond_to_blocked_street',
      selectionBasis: { utilityScore: 184, eventId: 'E45', stage: procession.stage } };
  }
  const smuggledEdition = state.world.livingEventStates?.E34;
  if (smuggledEdition?.status === 'ACTIVE' && smuggledEdition.actorHostIds.includes(host.id)
    && host.allowedMaps.includes(smuggledEdition.venueMapId)
    && npcMapRoute(host.mapId, smuggledEdition.venueMapId, host, maps, state.world.clockMinutes) !== null) {
    const activities = { typesetter_nikita: '인쇄소에서 가져온 종이를 책방에 펼친다',
      bookseller_lev: '선반 밑에 놓인 종이를 살핀다', student_vasily: '책방에 나온 종이의 인쇄 흔적을 살핀다',
      junior_guard_sergey: '책방 안의 종이를 확인하러 간다' };
    return { slot: { mapId: smuggledEdition.venueMapId, position: { ...smuggledEdition.scenePosition },
      activityKo: activities[host.id] }, goalType: 'LIVING_EVENT_RESPONSE',
      targetHostId: host.id === 'typesetter_nikita' ? 'bookseller_lev' : smuggledEdition.carrierHostId,
      taskId: `V37:E34:${smuggledEdition.stage}:${host.id}`, reason: 'private_proof_copy_draws_readers_and_local_watchman',
      selectionBasis: { utilityScore: 186, eventId: 'E34', stage: smuggledEdition.stage } };
  }
  const marketDayWork = state.world.livingEventStates?.E32;
  if (marketDayWork?.status === 'ACTIVE' && marketDayWork.actorHostIds.includes(host.id)
    && host.allowedMaps.includes(marketDayWork.venueMapId)
    && npcMapRoute(host.mapId, marketDayWork.venueMapId, host, maps, state.world.clockMinutes) !== null) {
    const worker = host.id === marketDayWork.workerHostId;
    return { slot: { mapId: marketDayWork.venueMapId, position: { ...marketDayWork.scenePosition },
      activityKo: worker ? '시장에서 하루 일감을 구한다' : '좌판을 지키며 오늘 맡길 일을 고른다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: worker ? marketDayWork.employerHostId : marketDayWork.workerHostId,
      taskId: `V37:E32:${marketDayWork.stage}:${host.id}`, reason: 'day_laborer_and_market_employer_meet_to_set_work_terms',
      selectionBasis: { utilityScore: 183, eventId: 'E32', stage: marketDayWork.stage } };
  }
  const documentCheck = state.world.livingEventStates?.E25;
  if (documentCheck?.status === 'ACTIVE' && documentCheck.actorHostIds.includes(host.id)
    && host.allowedMaps.includes(documentCheck.venueMapId)
    && npcMapRoute(host.mapId, documentCheck.venueMapId, host, maps, state.world.clockMinutes) !== null) {
    const courier = host.id === documentCheck.courierHostId;
    return { slot: { mapId: documentCheck.venueMapId, position: { ...documentCheck.scenePosition },
      activityKo: courier ? '분실 신고에 적은 배달 경로를 확인하러 경찰 접수실로 간다'
        : '분실 신고를 낸 배달부와 접수 장부를 대조한다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: courier ? documentCheck.officerHostId : documentCheck.courierHostId,
      taskId: `V37:E25:${documentCheck.stage}:${host.id}`,
      reason: 'follow_up_to_courier_loss_report_requires_both_people_at_station',
      selectionBasis: { utilityScore: 180, eventId: 'E25', stage: documentCheck.stage } };
  }
  const courtyardReport = state.world.livingEventStates?.E09;
  if (courtyardReport?.status === 'ACTIVE' && courtyardReport.stage === 'REPORT_FILED'
    && host.id === courtyardReport.watchmanHostId && !scheduledSlot?.workAction
    && host.allowedMaps.includes('courtyard')
    && npcMapRoute(host.mapId, 'courtyard', host, maps, state.world.clockMinutes) !== null) {
    const tenant = state.hosts[courtyardReport.tenantHostId];
    const landlord = state.hosts[courtyardReport.landlordHostId];
    const target = [tenant, landlord].find(person => person?.mapId === 'courtyard') ?? { position: courtyardReport.scenePosition };
    return { slot: { mapId: 'courtyard', position: { ...target.position }, activityKo: '안뜰 신고를 확인하러 간다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: target.id ?? null, taskId: 'V37:E09:ANSWER_COURTYARD_REPORT',
      reason: 'filed_courtyard_report_requires_watchman_visit', selectionBasis: { utilityScore: 170, eventId: 'E09' } };
  }
  const marketComplaint = state.world.livingEventStates?.E13;
  if (marketComplaint?.status === 'ACTIVE' && marketComplaint.stage === 'REPORT_FILED') {
    const scenePosition = marketComplaint.scenePosition ?? { x: 13, y: 12 };
    const seller = state.hosts[marketComplaint.sellerHostId], buyer = state.hosts[marketComplaint.buyerHostId];
    if ([seller, buyer].some(person => person?.id === host.id) && host.allowedMaps.includes('market-quay')) {
      return { slot: { mapId: 'market-quay', position: { ...scenePosition }, activityKo: '가격 확인을 위해 좌판에 머문다' },
        goalType: 'LIVING_EVENT_RESPONSE', targetHostId: null, taskId: 'V37:E13:WAIT_FOR_PRICE_REVIEW',
        reason: 'filed_market_price_report_keeps_parties_available', selectionBasis: { utilityScore: 169, eventId: 'E13' } };
    }
    if (host.id === marketComplaint.watchmanHostId && !scheduledSlot?.workAction && host.allowedMaps.includes('market-quay')) {
      return { slot: { mapId: 'market-quay', position: { ...scenePosition }, activityKo: '좌판의 가격 신고를 확인하러 간다' },
        goalType: 'LIVING_EVENT_RESPONSE', targetHostId: null, taskId: 'V37:E13:REVIEW_PRICE_COMPLAINT',
        reason: 'filed_market_price_report_requires_both_parties', selectionBasis: { utilityScore: 168, eventId: 'E13' } };
    }
  }
  const rentNotice = state.world.livingEventStates?.E26;
  if (rentNotice?.status === 'ACTIVE' && rentNotice.actorHostIds.includes(host.id)
    && host.allowedMaps.includes(rentNotice.venueMapId)
    && npcMapRoute(host.mapId, rentNotice.venueMapId, host, maps, state.world.clockMinutes) !== null) {
    const tenant = host.id === rentNotice.tenantHostId;
    return { slot: { mapId: rentNotice.venueMapId, position: { ...rentNotice.scenePosition },
      activityKo: tenant ? '안뜰 공지에 적힌 새 방세를 확인하러 간다' : '새 방세 공지를 붙이고 세입자와 이야기한다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: tenant ? rentNotice.landlordHostId : rentNotice.tenantHostId,
      taskId: `V37:E26:${rentNotice.stage}:${host.id}`, reason: 'rent_notice_requires_tenant_and_landlord_conversation',
      selectionBasis: { utilityScore: 180, eventId: 'E26', stage: rentNotice.stage } };
  }
  const courtyardFire = state.world.livingEventStates?.E27;
  if (courtyardFire?.status === 'ACTIVE' && courtyardFire.actorHostIds.includes(host.id)
    && !scheduledSlot?.workAction && host.allowedMaps.includes('courtyard')
    && npcMapRoute(host.mapId, courtyardFire.stage === 'EVACUATING'
      ? courtyardFire.evacuationTargets?.[host.id]?.mapId ?? 'nevsky' : 'courtyard', host, maps, state.world.clockMinutes) !== null) {
    const evacuationTarget = courtyardFire.stage === 'EVACUATING' ? courtyardFire.evacuationTargets?.[host.id] : null;
    return { slot: { mapId: evacuationTarget?.mapId ?? 'courtyard',
      position: { ...(evacuationTarget?.position ?? courtyardFire.scenePosition) },
      activityKo: evacuationTarget ? '안뜰 문을 지나 거리의 안전한 곳으로 이동한다' : '안뜰의 연기를 보고 이웃을 돕는다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: null, taskId: `V37:E27:${courtyardFire.stage}:${host.id}`,
      reason: evacuationTarget ? 'evacuation_route_to_safe_street_position' : 'courtyard_fire_requires_nearby_residents_to_respond',
      selectionBasis: { utilityScore: 184, eventId: 'E27', stage: courtyardFire.stage } };
  }
  const funeralCosts = state.world.livingEventStates?.E28;
  if (funeralCosts?.status === 'ACTIVE' && funeralCosts.actorHostIds.includes(host.id)
    && host.allowedMaps.includes(funeralCosts.venueMapId)
    && npcMapRoute(host.mapId, funeralCosts.venueMapId, host, maps, state.world.clockMinutes) !== null) {
    const organizer = host.id === funeralCosts.organizerHostId;
    return { slot: { mapId: funeralCosts.venueMapId, position: { ...funeralCosts.scenePosition },
      activityKo: organizer ? '삼촌의 장례 비용을 마련하러 간다' : '장례 비용을 빌려 달라는 부탁을 듣는다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: organizer ? funeralCosts.lenderHostId : funeralCosts.organizerHostId,
      taskId: `V37:E28:${funeralCosts.stage}:${host.id}`, reason: 'next_of_kin_and_lender_meet_over_funeral_costs',
      selectionBasis: { utilityScore: 186, eventId: 'E28', stage: funeralCosts.stage } };
  }
  const funeralDebt = funeralCosts?.debt;
  if (funeralCosts?.status === 'RESOLVED' && funeralDebt?.status === 'OUTSTANDING'
    && state.world.clockMinutes >= funeralDebt.nextPaymentAtMinute
    && [funeralDebt.debtorHostId, funeralDebt.creditorHostId].includes(host.id)
    && host.allowedMaps.includes('inn-interior')
    && npcMapRoute(host.mapId, 'inn-interior', host, maps, state.world.clockMinutes, { allowClosedMapIds: ['inn-interior'] }) !== null) {
    const debtor = host.id === funeralDebt.debtorHostId;
    const otherHostId = debtor ? funeralDebt.creditorHostId : funeralDebt.debtorHostId;
    const position = debtor ? { x: 12, y: 10 } : { x: 14, y: 10 };
    return { slot: { mapId: 'inn-interior', position, activityKo: debtor ? '여관에서 장례비 빚을 갚는다' : '파벨이 가져온 돈을 장부에 적는다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: otherHostId,
      taskId: `V37:E28:DEBT:${funeralDebt.amountRepaid}:${host.id}`,
      reason: 'autonomous_funeral_debt_repayment_meeting',
      selectionBasis: { utilityScore: 182, eventId: 'E28', remainingAmount: funeralDebt.remainingAmount } };
  }
  const lateMeal = state.world.livingEventStates?.E18;
  if (lateMeal?.status === 'ACTIVE' && lateMeal.stage === 'MEAL_REQUESTED'
    && [lateMeal.buyerHostId, lateMeal.sellerHostId].includes(host.id) && host.allowedMaps.includes('inn-interior')) {
    return { slot: { mapId: 'inn-interior', position: { ...lateMeal.scenePosition }, activityKo: '저녁 식사 주문을 마무리한다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: null, taskId: 'V37:E18:WAIT_FOR_MEAL_DECISION',
      reason: 'late_meal_transaction_waits_for_customer_choice', selectionBasis: { utilityScore: 171, eventId: 'E18' } };
  }
  const charityMeal = state.world.livingEventStates?.E14;
  const charityWorkSoon = (host.schedule ?? []).some(slot => slot.workAction && slot.atMinute > localMinute
    && slot.atMinute - localMinute <= 30);
  if (charityMeal?.status === 'ACTIVE' && charityMeal.actorHostIds.includes(host.id)
    && !scheduledSlot?.workAction && !charityWorkSoon && host.allowedMaps.includes('market-quay')
    && npcMapRoute(host.mapId, 'market-quay', host, maps, state.world.clockMinutes) !== null) {
    return { slot: { mapId: 'market-quay', position: { ...charityMeal.scenePosition }, activityKo: '시장 구호 줄로 가서 배급을 돕거나 차례를 기다린다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: null, taskId: 'V37:E14:REACH_RELIEF_TABLE',
      reason: 'charity_day_requires_donor_organizer_and_recipient_at_market_relief_table', selectionBasis: { utilityScore: 174, eventId: 'E14' } };
  }
  if (coldWave?.status === 'ACTIVE' && ['tenant_mikhail', 'landlady_polina'].includes(host.id)
    && !scheduledSlot?.workAction && !imminentScheduledWork
    && (host.mapId !== 'market-quay' || !nearTile(host.position, { x: 11, y: 11 }, 2)) && host.allowedMaps.includes('market-quay')
    && npcMapRoute(host.mapId, 'market-quay', host, maps, state.world.clockMinutes) !== null) {
    return { slot: { mapId: 'market-quay', position: { x: 11, y: 11 }, activityKo: '장작 장부를 살피러 장터로 간다' },
      goalType: 'LIVING_EVENT_RESPONSE', targetHostId: null, taskId: 'V37:E03:REACH_FUEL_LEDGER',
      reason: 'cold_wave_requires_a_household_response', selectionBasis: { utilityScore: 160, eventId: 'E03' } };
  }
  const scheduledTask = scheduledSlot?.task;
  const activeSocialSlot = pendingTaskSlot(host, ['DELIVER', 'EXCHANGE', 'CARE_TRANSFER'], localMinute, Math.floor(state.world.clockMinutes / 1440));
  const activeSocialTask = activeSocialSlot?.task?.requiresMarketStockout === true
    && (state.hosts.market_nadezhda?.marketStock?.[activeSocialSlot.task.itemKo] ?? 0) > 0 ? null : activeSocialSlot?.task;
  const activeLaundryEvent = state.world.livingEventStates?.E04;
  if (activeLaundryEvent?.status === 'ACTIVE' && activeLaundryEvent.stage === 'LINEN_EXCHANGED'
    && activeLaundryEvent.hostId === host.id && scheduledSlot?.workAction?.id === 'V36_LAUNDRESS_RECONCILE_PAYMENTS') {
    return { slot: scheduledSlot, goalType: 'LIVING_EVENT_CONTINUATION', targetHostId: null,
      taskId: `V37:E04:${activeLaundryEvent.dayIndex}:ACCOUNTS_RECONCILED`, reason: 'complete_the_open_linen_account_stage',
      selectionBasis: { utilityScore: 110, eventStage: activeLaundryEvent.stage } };
  }
  const socialForecast = upcomingNpcSocialWork(state);
  const imminentSocialTask = socialForecast.hostIds.has(host.id);
  const candidates = [];
  const addCandidate = (goal, utility, priority) => {
    if (!goal?.slot || !Number.isFinite(utility)) return;
    candidates.push({ ...goal, selectionBasis: { ...(goal.selectionBasis ?? {}), utilityScore: Math.round(utility * 100) / 100 }, _priority: priority });
  };
  if (activeSocialTask) {
    const recipient = state.hosts[activeSocialTask.recipientHostId];
    const canPay = activeSocialTask.type === 'CARE_TRANSFER' ? canMakeAuthoredCareTransfer(state, host, activeSocialTask)
      : activeSocialTask.type !== 'EXCHANGE' || (Number.isInteger(activeSocialTask.moneyAmount) && activeSocialTask.moneyAmount > 0 && Number.isFinite(recipient?.money?.amount) && recipient.money.amount >= activeSocialTask.moneyAmount);
    if (recipient && canPay && recipient.id !== state.player.embodiment && recipient.historicalAliveAndPresent !== false && host.allowedMaps.includes(recipient.mapId) && npcMapRoute(host.mapId, recipient.mapId, host, maps, state.world.clockMinutes) !== null) {
      return { slot: { ...activeSocialSlot, mapId: recipient.mapId, position: { ...recipient.position } }, goalType: activeSocialTask.type === 'DELIVER' ? 'FOLLOW_RECIPIENT' : activeSocialTask.type === 'CARE_TRANSFER' ? 'FOLLOW_FAMILY_MEMBER' : 'FOLLOW_TRADE_PARTNER', targetHostId: recipient.id, taskId: activeSocialTask.id, reason: activeSocialTask.type === 'CARE_TRANSFER' ? 'conditional_household_support' : 'committed_social_task', selectionBasis: { utilityScore: 100, committedTask: true } };
    }
  }

  const todayGoalKinds = new Set((host.todayGoals ?? []).map(goal => goal.kind));
  const personalPriority = Number.isFinite(host.plannerPolicy?.personalPriority) ? host.plannerPolicy.personalPriority : 0.5;
  addCandidate({ slot: scheduledSlot, goalType: 'SCHEDULE', targetHostId: null, taskId: scheduledTask?.id ?? null, reason: 'authored_daily_schedule' },
    43 + (scheduledTask ? 3 : 0), 0);
  const dayWorkIndex = Math.floor(state.world.clockMinutes / 1440);
  const unfinishedWorkSlot = (host.schedule ?? []).filter(slot => slot.workAction
    && (slot === scheduledSlot || (host.activeGoal?.type === 'SCHEDULED_WORK' && host.activeGoal.taskId === slot.workAction.id))
    && !(host.completedWorkActionKeys ?? []).includes(`${dayWorkIndex}:${slot.workAction.id}`))
    .sort((a, b) => b.atMinute - a.atMinute)[0];
  const scheduledWorkSlot = unfinishedWorkSlot ?? (scheduledSlot?.workAction
    && !(host.completedWorkActionKeys ?? []).includes(`${dayWorkIndex}:${scheduledSlot.workAction.id}`) ? scheduledSlot : null);
  const scheduledWork = scheduledWorkSlot?.workAction;
  const scheduledWorkKey = scheduledWork?.id ? `${dayWorkIndex}:${scheduledWork.id}` : null;
  if (scheduledWork && scheduledWorkKey && !(host.completedWorkActionKeys ?? []).includes(scheduledWorkKey)
    && !['INJURED', 'UNWELL'].includes(host.healthState?.condition)
    && !(host.healthState?.condition === 'RECOVERING' && state.world.clockMinutes < host.healthState.recoveryUntilMinute)) {
    const atScheduledWorksite = host.mapId === scheduledWorkSlot.mapId && nearTile(host.position, scheduledWorkSlot.position, 2);
    addCandidate({ slot: scheduledWorkSlot, goalType: 'SCHEDULED_WORK', targetHostId: null, taskId: scheduledWork.id,
      reason: 'finish_the_current_authored_shift_before_its_schedule_window_ends',
      selectionBasis: { workActionId: scheduledWork.id, atWorksite: atScheduledWorksite, workPriority: host.plannerPolicy?.workPriority ?? 0.9 } },
      116 + (atScheduledWorksite ? 4 : 0), 8);
  }
  if (scheduledSlot?.routineKind === 'FICTIONAL_HOME_SLEEP' && localMinute >= scheduledSlot.atMinute) {
    addCandidate({ slot: scheduledSlot, goalType: 'NIGHT_REST', targetHostId: null, taskId: `SLEEP:${host.id}:${Math.floor(state.world.clockMinutes / 1440)}`,
      reason: host.residence?.kind === 'STREET_SLEEPER' ? 'seek_the_authored_outdoor_sleeping_place' : 'follow_authored_night_rest_routine',
      selectionBasis: { sleepMinute: scheduledSlot.atMinute, fatigue: host.needs?.fatigue ?? 0,
        residenceKind: host.residence?.kind ?? host.places?.residenceKind ?? null } },
      108 + Math.min(8, (host.needs?.fatigue ?? 0) * 0.08), 9);
  }
  if (scheduledSlot?.workAction?.loadClass === 'HEAVY' && !imminentSocialTask && !['INJURED', 'UNWELL'].includes(host.healthState?.condition)
    && !(host.healthState?.condition === 'RECOVERING' && state.world.clockMinutes < host.healthState.recoveryUntilMinute)) {
    const workPriority = Number.isFinite(host.plannerPolicy?.workPriority) ? host.plannerPolicy.workPriority : 0.9;
    const fatigue = host.needs?.fatigue ?? 0, hunger = host.needs?.hunger ?? 0;
    const workUtility = 76 + workPriority * 15 + Math.min(10, (host.needs?.incomePressure ?? 0) * 0.12)
      + (todayGoalKinds.has('work') ? 5 : 0) - (fatigue >= (host.needs?.restThreshold ?? 72) ? 34 : 0) - (hunger >= 90 ? 18 : 0);
    addCandidate({ slot: scheduledSlot, goalType: 'NEED_INCOME', targetHostId: null,
      taskId: scheduledSlot.workAction.id, reason: 'authored_work_action_due_with_need_and_rest_checks',
      selectionBasis: { workPriority, incomePressure: host.needs?.incomePressure ?? null,
        fatigue, restThreshold: host.needs?.restThreshold ?? null } }, workUtility, 2);
  }
  const nextWorkSlot = !imminentSocialTask ? (host.schedule ?? []).filter(slot => slot.atMinute > localMinute
    && slot.atMinute - localMinute <= 60 && slot.workAction?.loadClass === 'HEAVY' && host.allowedMaps.includes(slot.mapId)
    && npcMapRoute(host.mapId, slot.mapId, host, maps, state.world.clockMinutes) !== null)
    .sort((a, b) => a.atMinute - b.atMinute)[0] : null;
  if (nextWorkSlot && !['INJURED', 'UNWELL'].includes(host.healthState?.condition)
    && !(host.healthState?.condition === 'RECOVERING' && state.world.clockMinutes < host.healthState.recoveryUntilMinute)) {
    const workPriority = Number.isFinite(host.plannerPolicy?.workPriority) ? host.plannerPolicy.workPriority : 0.9;
    const fatigue = host.needs?.fatigue ?? 0;
    const preparationUtility = 74 + workPriority * 15 + Math.min(8, (host.needs?.incomePressure ?? 0) * 0.1)
      + (todayGoalKinds.has('work') ? 4 : 0) - (fatigue >= (host.needs?.restThreshold ?? 72) ? 34 : 0);
    addCandidate({ slot: nextWorkSlot, goalType: 'PREPARE_SCHEDULED_WORK', targetHostId: null,
      taskId: `PREPARE_WORK:${nextWorkSlot.workAction.id}:${nextWorkSlot.atMinute}`,
      reason: 'travel_to_authored_worksite_before_shift',
      selectionBasis: { workPriority, workStartsAtMinute: nextWorkSlot.atMinute, fatigue } }, preparationUtility, 2);
  }

  const wageClaim = (host.pendingWageClaims ?? []).filter(claim => claim.status === 'DUE')
    .sort((a, b) => a.dueMinute - b.dueMinute || a.id.localeCompare(b.id))[0];
  if (wageClaim && !imminentSocialTask) {
    const payer = state.hosts[wageClaim.payerHostId];
    const payerCanPay = payer && payer.money?.unit === wageClaim.unit && Number.isFinite(payer.money?.amount) && payer.money.amount >= wageClaim.amount;
    if (payerCanPay && payer.id !== host.id && payer.historicalAliveAndPresent !== false && host.allowedMaps.includes(payer.mapId)
      && npcMapRoute(host.mapId, payer.mapId, host, maps, state.world.clockMinutes) !== null) {
      addCandidate({ slot: { mapId: payer.mapId, position: { ...payer.position }, activityKo: '밀린 품삯을 받으러 고용인을 찾아간다' },
        goalType: 'COLLECT_WAGE', targetHostId: payer.id, taskId: `WAGE:${wageClaim.id}`, reason: 'travel_to_payer_for_due_wage' }, 146, 6);
    }
  }
  const wageToPay = Object.values(state.hosts).flatMap(worker => (worker.pendingWageClaims ?? [])
    .filter(claim => claim.status === 'DUE' && claim.payerHostId === host.id)
    .map(claim => ({ worker, claim })))
    .filter(({ worker, claim }) => worker.id !== host.id && worker.id !== state.player.embodiment
      && host.id !== state.player.embodiment
      && worker.historicalAliveAndPresent !== false && worker.money?.unit === claim.unit
      && host.money?.unit === claim.unit && Number.isFinite(host.money?.amount) && host.money.amount >= claim.amount
      && host.allowedMaps.includes(worker.mapId)
      && npcMapRoute(host.mapId, worker.mapId, host, maps, state.world.clockMinutes) !== null)
    .sort((a, b) => a.claim.dueMinute - b.claim.dueMinute || a.worker.id.localeCompare(b.worker.id))[0];
  if (wageToPay && !imminentSocialTask) {
    const { worker, claim } = wageToPay;
    addCandidate({ slot: { mapId: worker.mapId, position: { ...worker.position }, activityKo: '밀린 품삯을 건네러 일꾼을 찾아간다' },
      goalType: 'PAY_WAGE', targetHostId: worker.id, taskId: `WAGE:${claim.id}`, reason: 'travel_to_worker_for_due_payroll' }, 146, 5);
  }

  const housing = host.housing, rentDay = Math.floor(state.world.clockMinutes / 1440);
  const rentDueMinute = Number.isInteger(housing?.dueMinute) ? housing.dueMinute : 1020;
  const rentTravelLead = Number.isInteger(housing?.travelLeadMinutes) ? housing.travelLeadMinutes : 120;
  const unfinishedScheduledWork = Boolean(unfinishedWorkSlot);
  if (housing?.kind === 'RENT' && !unfinishedScheduledWork && rentDay >= nextRentDueDay(housing) && housing.lastSettledDayIndex !== rentDay && localMinute >= rentDueMinute - rentTravelLead
    && localMinute <= (Number.isInteger(housing.closeMinute) ? housing.closeMinute : 1380) && !imminentSocialTask) {
    const landlord = state.hosts[housing.landlordHostId];
    const targetMapId = housing.mapId ?? landlord?.mapId;
    const targetPosition = landlord?.position ?? housing.position;
    if (landlord && targetPosition && host.allowedMaps.includes(targetMapId)
      && npcMapRoute(host.mapId, targetMapId, host, maps, state.world.clockMinutes) !== null) {
      addCandidate({ slot: { mapId: targetMapId, position: { ...targetPosition }, activityKo: '방세 지급을 위해 집주인을 찾아간다' },
        goalType: 'HOUSING_RENT', targetHostId: landlord.id, taskId: `RENT:${host.id}:${rentDay}`,
        reason: 'travel_to_landlord_before_rent_due' }, 150, 7);
    }
  }

  if (host.needs && !imminentSocialTask) {
    const continuingRestSlot = host.activeGoal?.type === 'NEED_REST'
      ? (host.schedule ?? []).find(slot => `REST:${host.id}:${slot.atMinute}` === host.activeGoal.taskId) : null;
    if (continuingRestSlot && host.needs.fatigue >= Math.max(0, host.needs.restThreshold - 10)) {
      const urgency = host.needs.fatigue - (host.needs.restThreshold - 10);
      addCandidate({ slot: continuingRestSlot, goalType: 'NEED_REST', targetHostId: null, taskId: host.activeGoal.taskId, reason: 'continue_rest_goal_until_physical_recovery' },
        57 + urgency * 0.55 + (host.activeGoal.type === 'NEED_REST' ? 8 : 0), 1);
    }
    const restCandidates = (host.schedule ?? []).filter(slot => /쉬|휴식|잠/.test(slot.activityKo ?? ''))
      .map(slot => ({ slot, wait: slot === scheduledSlot ? 0 : (slot.atMinute - localMinute + 1440) % 1440 }))
      .filter(goal => goal.wait <= 360);
    if (/쉬|휴식|잠/.test(scheduledSlot?.activityKo ?? '')) restCandidates.push({ slot: scheduledSlot, wait: 0 });
    const restCandidate = restCandidates.sort((a, b) => a.wait - b.wait)[0];
    if (restCandidate && host.needs.fatigue >= host.needs.restThreshold) {
      const urgency = host.needs.fatigue - host.needs.restThreshold;
      const restWeight = Number.isFinite(host.plannerPolicy?.restPriority) ? host.plannerPolicy.restPriority : 0.5;
      addCandidate({ slot: restCandidate.slot, goalType: 'NEED_REST', targetHostId: null, taskId: `REST:${host.id}:${restCandidate.slot.atMinute}`, reason: 'fatigue_threshold_before_authored_rest_window' },
        55 + urgency * 0.55 + restWeight * 8 + (todayGoalKinds.has('care') ? 3 : 0), 1);
    }
    const mealCandidates = (host.schedule ?? []).filter(slot => slot.task?.type === 'CONSUME' && slot.task.itemKo && host.inventory.includes(slot.task.itemKo))
      .map(slot => ({ slot, wait: (slot.atMinute - localMinute + 1440) % 1440 }))
      .filter(goal => goal.wait <= 60);
    if (scheduledTask?.type === 'CONSUME' && scheduledTask.itemKo && host.inventory.includes(scheduledTask.itemKo)) mealCandidates.push({ slot: scheduledSlot, wait: 0 });
    const meal = mealCandidates.filter(goal => host.needs.hunger >= (Number.isFinite(goal.slot.task.minimumHunger) ? goal.slot.task.minimumHunger : 40)).sort((a, b) => a.wait - b.wait)[0];
    if (meal) {
      const mealWeight = Number.isFinite(host.plannerPolicy?.mealPriority) ? host.plannerPolicy.mealPriority : 0.5;
      addCandidate({ slot: meal.slot, goalType: 'NEED_MEAL', targetHostId: null, taskId: meal.slot.task.id, reason: 'hunger_threshold_before_meal_window' },
        35 + host.needs.hunger * 0.55 + mealWeight * 8 + Math.max(0, 60 - meal.wait) * 0.35 + (meal.wait === 0 ? 8 : 0), 2);
    }
  }
  const foodItems = new Set(Object.values(state.hosts).flatMap(person => (person.marketOffers ?? [])
    .filter(offer => offer.category === 'food').map(offer => offer.itemKo)));
  if (host.needs?.hunger >= 60 && !host.inventory.some(item => foodItems.has(item))) {
    const foodOffers = Object.values(state.hosts).filter(seller => seller.id !== host.id
      && seller.id !== state.player.embodiment && seller.historicalAliveAndPresent !== false
      && seller.mapId && host.allowedMaps.includes(seller.mapId)
      && seller.money?.unit === host.money?.unit
      && Number.isFinite(host.money?.amount)
      && (seller.marketOffers ?? []).some(offer => offer.category === 'food'
        && Number.isInteger(marketOfferPrice(state, seller, offer)) && marketOfferPrice(state, seller, offer) > 0 && (seller.marketStock?.[offer.itemKo] ?? 0) > 0
        && seller.money?.unit === offer.unit && host.money.amount >= marketOfferPrice(state, seller, offer)
        && isMarketOfferOpen(seller, offer, state.world.clockMinutes)))
      .sort((a, b) => {
        const lateMealService = localMinute >= 960 && localMinute < 1200;
        return (lateMealService ? Number(b.id === 'innkeeper_irina') - Number(a.id === 'innkeeper_irina') : 0)
          || a.id.localeCompare(b.id);
      });
    const seller = foodOffers.find(candidate => (candidate.mapId === host.mapId && nearTile(candidate.position, host.position, 1))
      || npcMapRoute(host.mapId, candidate.mapId, host, maps, state.world.clockMinutes) !== null);
    const offer = seller?.marketOffers?.find(item => item.category === 'food' && (seller.marketStock?.[item.itemKo] ?? 0) > 0
      && isMarketOfferOpen(seller, item, state.world.clockMinutes)
      && item.unit === host.money?.unit && Number.isInteger(marketOfferPrice(state, seller, item)) && host.money.amount >= marketOfferPrice(state, seller, item));
    const price = seller && offer ? marketOfferPrice(state, seller, offer) : null;
    if (seller && offer) {
      const mealSourceEventId = activeMealSeekingCauseEventId(host, state);
      const unresolvedHungerPriority = mealSourceEventId === 'E14' && host.needs.hunger >= 90 ? 32 : 0;
      addCandidate({ slot: { mapId: seller.mapId, position: { ...seller.position }, activityKo: '시장 상인에게 빵값을 내고 끼니를 산다' },
        goalType: 'PURCHASE_MEAL', targetHostId: seller.id, taskId: `FOOD:${seller.id}:${offer.itemKo}`, reason: 'hunger_requires_affordable_market_food',
        selectionBasis: { hunger: host.needs.hunger, price, unit: offer.unit, ...(mealSourceEventId ? { sourceEventId: mealSourceEventId } : {}) } },
        62 + host.needs.hunger * 0.72 + unresolvedHungerPriority, 2);
    }
    if (!seller && host.needs.hunger >= 82) {
      const kinFoodDonor = (host.relationshipEdges ?? []).filter(edge => edge.kind === 'KINSHIP'
        && edge.status === 'FICTIONAL_CHARACTER_DESIGN' && edge.fromHostId === host.id)
        .map(edge => ({ edge, person: state.hosts[edge.toHostId] }))
        .filter(({ person }) => person && person.id !== state.player.embodiment && person.historicalAliveAndPresent !== false
          && person.mapId && host.allowedMaps.includes(person.mapId)
          && npcMapRoute(host.mapId, person.mapId, host, maps, state.world.clockMinutes) !== null
          && (person.inventory ?? []).some(item => person.inventory.filter(entry => entry === item).length >= 2 && foodItems.has(item)))
        .sort((a, b) => a.edge.edgeId.localeCompare(b.edge.edgeId))[0];
      const donorFood = kinFoodDonor?.person?.inventory.find(item => kinFoodDonor.person.inventory.filter(entry => entry === item).length >= 2
        && foodItems.has(item));
      if (kinFoodDonor && donorFood) addCandidate({
        slot: { mapId: kinFoodDonor.person.mapId, position: { ...kinFoodDonor.person.position }, activityKo: '가족을 찾아 끼니를 부탁한다' },
        goalType: 'SEEK_FOOD_AID', targetHostId: kinFoodDonor.person.id, taskId: `FOOD_AID:${host.id}:${kinFoodDonor.person.id}:${Math.floor(state.world.clockMinutes / 1440)}`,
        reason: 'severe_hunger_seeks_spare_food_from_kin', selectionBasis: { hunger: host.needs.hunger, donorHostId: kinFoodDonor.person.id } },
        78 + host.needs.hunger * 0.55, 2);
    }
  }
  const lifeFocus = selectPersonalLifeFocus(state, host, maps, localMinute, imminentSocialTask);
  if (lifeFocus) {
    const activeStage = host.activeGoal?.type === lifeFocus.goalType && host.activeGoal?.taskId === lifeFocus.taskId;
    addCandidate(lifeFocus, 90 + personalPriority * 14 + (todayGoalKinds.has('personal') ? 4 : 0) + (activeStage ? 9 : 0), 3);
  }
  const workPriority = Number.isFinite(host.plannerPolicy?.workPriority) ? host.plannerPolicy.workPriority : 0.9;
  const incomeGoalThreshold = Math.max(42, Math.min(74, Math.round(82 - workPriority * 30)));
  if (host.needs?.incomePressure >= incomeGoalThreshold && !imminentSocialTask) {
    const livelihoodSlots = (host.schedule ?? []).filter(slot => slot.activityKo
      && !/쉬|휴식|잠|식사|모임|책을 읽|독서 시간|잠시 쉰/.test(slot.activityKo)
      && host.allowedMaps.includes(slot.mapId)
      && !socialForecast.mapIds.has(slot.mapId)
      && !mapAccessFailure(maps?.[slot.mapId], host, state.world.clockMinutes)
      && npcMapRoute(host.mapId, slot.mapId, host, maps, state.world.clockMinutes) !== null)
      .map(slot => ({ slot, wait: slot === scheduledSlot ? 0 : (slot.atMinute - localMinute + 1440) % 1440 }))
      .filter(candidate => candidate.wait <= 360)
      .sort((a, b) => a.wait - b.wait || a.slot.atMinute - b.slot.atMinute);
    const livelihood = livelihoodSlots[0];
    if (livelihood) addCandidate({ slot: livelihood.slot, goalType: 'NEED_INCOME', targetHostId: null,
      taskId: `LIVELIHOOD:${host.id}:${Math.floor(state.world.clockMinutes / 1440)}:${livelihood.slot.atMinute}`,
      reason: 'income_pressure_exceeds_resident_work_priority_threshold',
      selectionBasis: { need: host.needs.incomePressure, threshold: incomeGoalThreshold, workPriority } },
      35 + host.needs.incomePressure * 0.4 + workPriority * 14 + (todayGoalKinds.has('work') ? 3 : 0), 4);
  }
  const relationshipGoal = (host.personalGoals ?? []).find(item => item.kind === 'RELATIONSHIP'
    && host.personalGoalProgress?.[item.id]?.status !== 'SATISFIED');
  const relationshipTargetId = relationshipGoal?.successCondition?.targetHostId;
  const authoredRelationshipTarget = relationshipTargetId ? state.hosts[relationshipTargetId] : null;
  const socialPriority = Number.isFinite(host.plannerPolicy?.socialPriority) ? host.plannerPolicy.socialPriority : 0.8;
  const riskTolerance = Number.isFinite(host.plannerPolicy?.riskTolerance) ? host.plannerPolicy.riskTolerance : 0.5;
  const localMinuteOfDay = ((state.world.clockMinutes % 1440) + 1440) % 1440;
  const optionalTravelRisk = (host.needs?.safetyConcern ?? 25) * (1 - riskTolerance)
    + (localMinuteOfDay >= 1200 || localMinuteOfDay < 360 ? 18 : 0);
  const riskAdjustedSocialThreshold = Math.max(28, Math.min(42,
    Math.round(36 - socialPriority * 8 + Math.min(6, optionalTravelRisk * 0.1))));
  const contactDay = Math.floor(state.world.clockMinutes / 1440);
  const kinshipTargets = (host.relationshipEdges ?? []).filter(edge => edge.kind === 'KINSHIP'
    && edge.status === 'FICTIONAL_CHARACTER_DESIGN' && edge.fromHostId === host.id)
    .map(edge => ({ edge, target: state.hosts[edge.toHostId] }))
    .filter(({ edge, target }) => target && target.id !== state.player.embodiment
      && target.historicalAliveAndPresent !== false && target.mapId === host.mapId
      && Math.abs(target.position.x - host.position.x) + Math.abs(target.position.y - host.position.y) <= 8
      && host.allowedMaps.includes(target.mapId)
      && npcMapRoute(host.mapId, target.mapId, host, maps, state.world.clockMinutes) !== null)
    .sort((a, b) => a.target.id.localeCompare(b.target.id));
  const kinshipChoice = kinshipTargets.length ? kinshipTargets[contactDay % kinshipTargets.length] : null;
  const familyVisit = Boolean(kinshipChoice && host.needs?.socialNeed >= 65 && localMinute >= 600 && localMinute <= 900
    && !scheduledSlot?.workAction && !imminentScheduledWork);
  const relationshipTarget = familyVisit ? kinshipChoice.target : authoredRelationshipTarget;
  const relationshipTaskId = familyVisit ? `${kinshipChoice.edge.edgeId}:DAY_${contactDay}`
    : relationshipGoal ? `${relationshipGoal.id}:DAY_${contactDay}` : null;
  const socialNeedThreshold = familyVisit ? 65
    : relationshipGoal?.successCondition?.autonomyNeedThreshold ?? riskAdjustedSocialThreshold;
  const contactTaskId = relationshipTaskId;
  const awaitingIncomingGoods = Object.values(state.hosts).some(sender => {
    const task=scheduleEntry(sender,state.world.clockMinutes)?.task;
    return ['DELIVER','EXCHANGE'].includes(task?.type)&&task.recipientHostId===host.id
      &&sender.id!==state.player.embodiment&&sender.historicalAliveAndPresent!==false&&!taskCompletedForDay(sender,task,Math.floor(state.world.clockMinutes/1440));
  });
  if (!imminentSocialTask && (relationshipGoal || familyVisit) && relationshipTarget && relationshipTarget.id !== state.player.embodiment
    && relationshipTarget.historicalAliveAndPresent !== false && host.needs?.socialNeed >= socialNeedThreshold
    && host.needs.fatigue < Math.max(0, (host.needs.restThreshold ?? 72) - 10)
    && !awaitingIncomingGoods
    && host.lastPersonalContactTaskId !== contactTaskId
    && host.allowedMaps.includes(relationshipTarget.mapId)
    && npcMapRoute(host.mapId, relationshipTarget.mapId, host, maps, state.world.clockMinutes) !== null) {
    addCandidate({ slot: { mapId: relationshipTarget.mapId, position: { ...relationshipTarget.position },
      activityKo: familyVisit ? '가족을 찾아가 안부와 집안 소식을 나눈다' : '개인적인 약속을 확인하려 이웃과 이야기를 나누러 간다' },
      goalType: 'PERSONAL_RELATIONSHIP', targetHostId: relationshipTarget.id, taskId: contactTaskId,
      reason: familyVisit ? 'kinship_contact_selected_by_social_need' : 'relationship_goal_selected_by_social_need_and_travel_risk',
      selectionBasis: { socialNeed: host.needs.socialNeed, threshold: socialNeedThreshold, socialPriority, optionalTravelRisk, riskTolerance } },
      familyVisit
        ? 42 + host.needs.socialNeed * 0.25 + socialPriority * 8 - optionalTravelRisk * 0.15
        : 60 + host.needs.socialNeed * 0.5 + socialPriority * 16 - optionalTravelRisk * 0.2 + (todayGoalKinds.has('social') ? 4 : 0), 5);
  }
  candidates.sort((a, b) => b.selectionBasis.utilityScore - a.selectionBasis.utilityScore || a._priority - b._priority || a.goalType.localeCompare(b.goalType));
  const selected = candidates[0] ?? { slot: scheduledSlot, goalType: 'SCHEDULE', targetHostId: null, taskId: scheduledTask?.id ?? null, reason: 'authored_daily_schedule' };
  delete selected._priority;
  return selected;
}
function selectPersonalLifeFocus(state, host, maps, localMinute, imminentSocialTask) {
  const goal = (host.personalGoals ?? []).find(item => item.kind === 'LIFE'
    && host.personalGoalProgress?.[item.id]?.status !== 'SATISFIED' && Array.isArray(item.autonomyStages));
  if (!goal) return null;
  const chainId = goal.successCondition?.chainId;
  const stageNumber = (state.world.lifeChains?.[chainId]?.stage ?? 0) + 1;
  const plan = goal.autonomyStages.find(item => item.stage === stageNumber);
  if (!plan || plan.date > state.world.date || !maps?.[plan.mapId]
    || !host.allowedMaps.includes(plan.mapId)
    || (plan.prerequisiteQuestIds ?? []).some(id => !state.ledger.some(entry => entry.questId === id))) return null;
  const day = Math.floor((state.world.clockMinutes ?? 540) / 1440);
  const taskId = `${goal.id}:STAGE_${stageNumber}:DAY_${day}`;
  const visited = host.personalGoalLastVisitKey === taskId;
  const preparationLeadMinutes = Number.isFinite(plan.preparationLeadMinutes) ? plan.preparationLeadMinutes : 90;
  const preparing = localMinute < plan.windowStartMinute;
  const holding = host.activeGoal?.type === 'PERSONAL_LIFE_FOCUS' && host.activeGoal.taskId === taskId
    && (!visited || (host.personalGoalFocusUntilMinute ?? 0) > state.world.clockMinutes);
  if (visited && !holding) return null;
  if (!holding && localMinute >= plan.windowEndMinute) return null;
  if (preparing && localMinute < plan.windowStartMinute - preparationLeadMinutes) return null;
  if (npcMapRoute(host.mapId, plan.mapId, host, maps, state.world.clockMinutes) === null) return null;
  return { slot: { mapId: plan.mapId, position: { ...plan.position }, activityKo: preparing ? `${plan.activityKo} · 미리 살핀다` : plan.activityKo },
    goalType: preparing ? 'PERSONAL_LIFE_PREPARATION' : 'PERSONAL_LIFE_FOCUS', targetHostId: null, taskId,
    reason: preparing ? 'preparing_route_for_approaching_personal_life_stage' : 'active_personal_life_arc_stage',
    lifeGoalId: goal.id, lifeQuestId: plan.questId, lifeStage: stageNumber, ...(preparing ? {} : { lifeFocusMinutes: plan.focusMinutes }) };
}
function recordNpcGoal(state, host, goal, absoluteMinute, minuteOffset, goalRows, maps) {
  const next = { type: goal.goalType, taskId: goal.taskId, targetHostId: goal.targetHostId, targetMapId: goal.slot?.mapId ?? null,
    reason: goal.reason, ...(goal.selectionBasis ? { selectionBasis: clone(goal.selectionBasis) } : {}) };
  const previous = host.activeGoal;
  if (!previous || previous.type !== next.type || previous.taskId !== next.taskId || previous.targetHostId !== next.targetHostId || previous.targetMapId !== next.targetMapId) {
    host.activeGoal = { ...next, selectedAtMinute: absoluteMinute };
    goalRows.push({ hostId: host.id, minute: minuteOffset, ...host.activeGoal, mapId: host.mapId,
      position: { ...host.position }, witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps) });
  }
}
function simulateNpcMinute(state, maps, options, minuteOffset, movementLog, stateChanges) {
  const embodiedId = state.player.embodiment, paused = new Set(options.pausedHostIds ?? []), reservedTiles = [...(options.reservedTiles ?? [])];
  if (!state.player.embodiment) reservedTiles.push({ mapId: state.world.currentMapId, position: state.player.position });
  const moveRows = [], deliveryRows = [], exchangeRows = [], careRows = [], paymentRows = [], housingRows = [], mealRows = [], goalRows = [], personalContactRows = [], restRecoveryRows = [], personalGoalRows = [], workRows = [], livingEventRows = [];
  const contactedPairs = new Set();
  const hosts = Object.values(state.hosts).sort((a, b) => a.id.localeCompare(b.id));
  const foodOfferByItem = new Map(hosts.flatMap(person => person.marketOffers ?? [])
    .filter(offer => offer.category === 'food').map(offer => [offer.itemKo, offer]));
  for (const host of hosts) {
    const scheduledSlot = scheduleEntry(host, state.world.clockMinutes);
    if (!scheduledSlot) continue;
    const scheduleId = `${scheduledSlot.mapId}:${scheduledSlot.atMinute}`;
    if (host.scheduleId !== scheduleId) host.routineTaskCompletedId = null;
    host.scheduleId = scheduleId;
    const currentMap = maps?.[host.mapId];
    const inActiveRealm = currentMap?.metadata?.mapClass === 'LITERARY_REALM';
    if (host.id === embodiedId) {
      const possessedWork = scheduledSlot.workAction;
      if (host.id === 'print_apprentice_stepan' && possessedWork
        && host.mapId === scheduledSlot.mapId && nearTile(host.position, scheduledSlot.position, 2)) {
        beginApprenticeFatigueEvent(state, host, possessedWork, minuteOffset, maps, livingEventRows);
      }
      const embodiedWork = scheduledSlot.workAction;
      if (host.id === 'clerk_alexei' && embodiedWork?.id === 'V36_CLERK_REGISTER_INTAKE'
        && state.world.clockMinutes >= scheduledSlot.atMinute + embodiedWork.durationMinutes
        && host.mapId === scheduledSlot.mapId && nearTile(host.position, scheduledSlot.position, 2)) {
        beginMissingRegisterEvent(state, { hostId: host.id, actionId: embodiedWork.id, position: host.position }, minuteOffset, maps, livingEventRows);
      }
      if (host.activeGoal?.type !== 'POSSESSED') host.activeGoal = { type: 'POSSESSED', taskId: null, targetHostId: null, targetMapId: host.mapId, reason: 'player_controls_embodied_host', selectedAtMinute: state.world.clockMinutes };
      setRoutineState(state, host, 'POSSESSED', host.currentActivityKo, host.mapId, host.position, state.world.clockMinutes, stateChanges, minuteOffset, maps);
      continue;
    }
    if (paused.has(host.id) || host.historicalAliveAndPresent === false || inActiveRealm !== Boolean(state.world.activeRealm)) continue;
    host.needs ??= initialNpcNeeds(host, state.world.clockMinutes);
    const goal = selectNpcRoutineGoal(state, host, scheduledSlot, maps), slot = goal.slot;
    if (!slot || !maps?.[slot.mapId]) continue;
    recordNpcGoal(state, host, goal, state.world.clockMinutes, minuteOffset, goalRows, maps);
    const canalTraffic = state.world.livingEventStates?.E11;
    const heldByCanalTraffic = canalTraffic?.status === 'ACTIVE' && state.world.clockMinutes < canalTraffic.clearsAtMinute
      && canalTraffic.actorHostIds.includes(host.id) && host.mapId === 'canal-road';
    const medicallyRestricted = ['INJURED', 'UNWELL'].includes(host.healthState?.condition)
      && host.healthState?.illness?.id !== 'FOOD_DEPRIVATION'
      || host.healthState?.condition === 'RECOVERING' && state.world.clockMinutes < host.healthState.recoveryUntilMinute;
    if (heldByCanalTraffic) {
      canalTraffic.waitMinutesByHost[host.id] = (canalTraffic.waitMinutesByHost[host.id] ?? 0) + 1;
      host.currentActivityKo = '배가 지나는 동안 운하 길목에서 기다린다';
    } else if (medicallyRestricted) host.currentActivityKo = host.healthState?.condition === 'UNWELL'
      ? '몸이 좋지 않아 일을 쉬고 있다' : '어깨를 다쳐 무거운 일을 쉬고 있다';
    else host.currentActivityKo = slot.activityKo ?? '';
    const workAction = slot.workAction;
    const atWorkplace = host.mapId === slot.mapId && nearTile(host.position, slot.position, workAction ? 2 : 1);
    const routine = medicallyRestricted ? 'RESTING' : heldByCanalTraffic ? 'TRAVELLING'
      : atWorkplace ? (goal.goalType === 'PERSONAL_LIFE_FOCUS' || workAction ? 'WORKING' : routineActivityState(host.currentActivityKo, slot.task)) : 'TRAVELLING';
    const previousRoutine = host.routineState?.state ?? 'IDLE';
    const fatigueBeforeRoutine = host.needs.fatigue;
    setRoutineState(state, host, routine, host.currentActivityKo, slot.mapId, slot.position, state.world.clockMinutes, stateChanges, minuteOffset, maps);
    if (!medicallyRestricted && atWorkplace && routine === 'WORKING'
      && beginApprenticeFatigueEvent(state, host, workAction, minuteOffset, maps, livingEventRows)) continue;
    if (!medicallyRestricted && !heldByCanalTraffic && atWorkplace && goal.goalType !== 'PERSONAL_LIFE_FOCUS' && ['WORKING', 'TRADING', 'SOCIALIZING'].includes(routine)
      && workAction && typeof workAction.id === 'string' && typeof workAction.outputKo === 'string'
      && Number.isInteger(workAction.durationMinutes) && workAction.durationMinutes > 0) {
      beginBookbindingContract(state, host, slot, minuteOffset, maps, livingEventRows);
      const dayIndex = Math.floor(state.world.clockMinutes / 1440), completionKey = `${dayIndex}:${workAction.id}`;
      host.completedWorkActionKeys ??= [];
      host.workActionProgress ??= {};
      if (!host.completedWorkActionKeys.includes(completionKey)) {
        for (const key of Object.keys(host.workActionProgress)) if (!key.startsWith(`${dayIndex}:`)) delete host.workActionProgress[key];
        host.workActionProgress[completionKey] = (host.workActionProgress[completionKey] ?? 0) + 1;
        const injuryStarted = beginWarehouseInjury(state, host, workAction, minuteOffset, maps, livingEventRows);
        if (!injuryStarted && host.workActionProgress[completionKey] >= workAction.durationMinutes) {
          delete host.workActionProgress[completionKey];
          host.completedWorkActionKeys.push(completionKey);
          if (host.completedWorkActionKeys.length > 64) host.completedWorkActionKeys.splice(0, host.completedWorkActionKeys.length - 64);
          host.workRecords ??= [];
          const record = { dayIndex, actionId: workAction.id, outputKind: workAction.outputKind ?? 'WORK_PRODUCT', outputKo: workAction.outputKo,
            minute: minuteOffset, mapId: host.mapId, ...(typeof workAction.inventoryItemKo === 'string' ? { inventoryItemKo: workAction.inventoryItemKo } : {}) };
          host.workRecords.push(record);
          if (host.workRecords.length > 32) host.workRecords.splice(0, host.workRecords.length - 32);
          if (typeof workAction.inventoryItemKo === 'string' && !host.inventory.includes(workAction.inventoryItemKo)) host.inventory.push(workAction.inventoryItemKo);
          const payroll = workAction.payroll;
          if (payroll && typeof payroll.payerHostId === 'string' && Number.isInteger(payroll.amount) && payroll.amount > 0
            && payroll.unit === host.money?.unit && payroll.payerHostId !== host.id) {
            host.pendingWageClaims ??= [];
            const claimId = `${dayIndex}:${workAction.id}`;
            if (!host.pendingWageClaims.some(claim => claim.id === claimId)) host.pendingWageClaims.push({ id: claimId, actionId: workAction.id,
              payerHostId: payroll.payerHostId, amount: payroll.amount, unit: payroll.unit, dueDayIndex: dayIndex, dueMinute: minuteOffset,
              mapId: host.mapId, status: 'DUE', valueStatus: payroll.valueStatus ?? 'fictional_gameplay_balance' });
          }
          const workEntry = { hostId: host.id, ...record, position: { ...host.position }, witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps) };
          workRows.push(workEntry);
          beginApothecarySupplyEvent(state, workEntry, minuteOffset, maps, livingEventRows);
          beginMissingRegisterEvent(state, workEntry, minuteOffset, maps, livingEventRows);
          completeBookbindingOnWork(state, workEntry, minuteOffset, maps, livingEventRows);
          beginLaundryEvent(state, workEntry, minuteOffset, maps, livingEventRows);
          resolveLaundryOnReconciliation(state, workEntry, minuteOffset, maps, livingEventRows);
          beginPrintDeadlineEvent(state, workEntry, minuteOffset, maps, livingEventRows);
          advancePrintDeadlineOnProof(state, workEntry, minuteOffset, maps, livingEventRows);
        }
      }
    }
    if (goal.goalType === 'PERSONAL_LIFE_FOCUS' && atWorkplace && host.personalGoalLastVisitKey !== goal.taskId) {
      host.personalGoalLastVisitKey = goal.taskId;
      host.personalGoalFocusUntilMinute = state.world.clockMinutes + goal.lifeFocusMinutes;
      personalGoalRows.push({ hostId: host.id, goalId: goal.lifeGoalId, questId: goal.lifeQuestId, stage: goal.lifeStage,
        mapId: host.mapId, position: { ...host.position }, minute: minuteOffset, activityKo: host.currentActivityKo,
        witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps) });
    }
    if (goal.goalType === 'PERSONAL_RELATIONSHIP' && atWorkplace && host.lastPersonalContactTaskId !== goal.taskId) {
      const partner = state.hosts[goal.targetHostId];
      const pairKey = partner ? [host.id, partner.id].sort().join('::') : '';
      if (partner && !contactedPairs.has(pairKey) && partner.historicalAliveAndPresent !== false && partner.mapId === host.mapId && nearTile(host.position, partner.position, 1)) {
        contactedPairs.add(pairKey);
        host.lastPersonalContactTaskId = goal.taskId;
        if (partner.activeGoal?.type === 'PERSONAL_RELATIONSHIP' && partner.activeGoal.targetHostId === host.id) {
          partner.lastPersonalContactTaskId = partner.activeGoal.taskId;
        }
        host.needs.socialNeed = Math.max(0, host.needs.socialNeed - 20);
        partner.needs ??= initialNpcNeeds(partner, state.world.clockMinutes);
        partner.needs.socialNeed = Math.max(0, partner.needs.socialNeed - 8);
        const meetings = recordRelationshipMeeting(host, partner, state.world.clockMinutes, state.world.date, host.mapId);
        personalContactRows.push({ hostId: host.id, partnerHostId: partner.id, goalId: goal.taskId, mapId: host.mapId, position: { ...host.position }, minute: minuteOffset,
          meetingCount: meetings.host.meetingCount, familiarity: meetings.host.familiarity, effect: 'social_need_relieved',
          witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps) });
      }
    }
    host.needs.hunger = Math.min(100, host.needs.hunger + host.needs.hungerPerMinute);
    const routineFatigue = routine === 'RESTING' ? -host.needs.restFatigueReliefPerMinute
      : routine === 'TRAVELLING' ? 0.01 : host.needs.workFatiguePerMinute;
    host.needs.fatigue = Math.max(0, Math.min(100, host.needs.fatigue + routineFatigue + outdoorWeatherFatiguePerMinute(state, host)));
    if (routine === 'RESTING' && previousRoutine !== 'RESTING' && host.needs.fatigue < fatigueBeforeRoutine) restRecoveryRows.push({ hostId: host.id, minute: minuteOffset, mapId: host.mapId, position: { ...host.position }, fatigueBefore: fatigueBeforeRoutine, fatigueAfter: host.needs.fatigue, witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps) });
    if (routine === 'SOCIALIZING') host.needs.socialNeed = Math.max(0, (host.needs.socialNeed ?? 0) - 0.05);
    else host.needs.socialNeed = Math.min(100, (host.needs.socialNeed ?? 0) + 0.004);
    if (routine === 'WORKING' && host.needs.incomePressure > 0) host.needs.incomePressure = Math.max(0, host.needs.incomePressure - host.needs.incomeReliefPerMinute);
    if (state.world.clockMinutes % 5 !== 0) continue;
    const before = { mapId: host.mapId, position: { ...host.position } };
    const newOrActiveInjury = state.world.livingEventStates?.E12?.status === 'ACTIVE'
      && state.world.livingEventStates.E12.porterHostId === host.id;
    const step = medicallyRestricted || newOrActiveInjury ? null : nextNpcStep(state, host, slot, maps, reservedTiles);
    if (step) { host.mapId = step.mapId; host.position = step.position; host.facing = step.facing; }
    if (before.mapId !== host.mapId || before.position.x !== host.position.x || before.position.y !== host.position.y) {
      const row = { hostId: host.id, minute: minuteOffset, scheduleId, activityKo: host.currentActivityKo, fromMapId: before.mapId, from: before.position, toMapId: host.mapId, to: { ...host.position }, viaExit: step?.viaExit ?? null,
        witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps) };
      moveRows.push(row); movementLog.push(row);
    }
  }
  advanceApothecarySupplyEvent(state, minuteOffset, maps, livingEventRows);
  for (const host of hosts) {
    for (const claim of host.pendingWageClaims ?? []) {
      const payer = state.hosts[claim.payerHostId];
      if (claim.status !== 'DUE' || host.id === embodiedId || payer?.id === embodiedId || paused.has(host.id) || paused.has(payer?.id)
        || host.historicalAliveAndPresent === false || payer?.historicalAliveAndPresent === false || !payer
        || host.mapId !== payer.mapId || !nearTile(host.position, payer.position, 1)
        || host.money?.unit !== claim.unit || payer.money?.unit !== claim.unit
        || !Number.isFinite(host.money?.amount) || !Number.isFinite(payer.money?.amount) || payer.money.amount < claim.amount) continue;
      payer.money.amount -= claim.amount;
      host.money.amount += claim.amount;
      claim.status = 'PAID';
      claim.paidAtMinute = minuteOffset;
      host.lastWageClaimDayIndex = claim.dueDayIndex;
      host.lastWageClaimId = claim.id;
      host.needs ??= initialNpcNeeds(host, state.world.clockMinutes);
      payer.needs ??= initialNpcNeeds(payer, state.world.clockMinutes);
      host.needs.incomePressure = Math.max(0, host.needs.incomePressure - Math.min(12, claim.amount * 2));
      payer.needs.incomePressure = Math.min(100, payer.needs.incomePressure + Math.min(8, claim.amount));
      host.relations[payer.id] ??= '품삯을 지급한 고용인';
      payer.relations[host.id] ??= '짐일을 마친 일꾼';
      const payment = { kind: 'WAGE', hostId: host.id, payerHostId: payer.id, amount: claim.amount, unit: claim.unit,
        actionId: claim.actionId, claimId: claim.id, mapId: host.mapId, counterpartyMapId: payer.mapId, position: { ...host.position }, counterpartyPosition: { ...payer.position }, minute: minuteOffset,
        witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps), valueStatus: claim.valueStatus };
      paymentRows.push(payment);
      resolvePrintDeadlineOnWage(state, payment, minuteOffset, maps, livingEventRows);
      syncPersistentPersonalGoals(state, host.id);
      syncPersistentPersonalGoals(state, payer.id);
    }
  }
  for (const host of hosts) {
    const contract = host.housing;
    if (!contract || contract.kind !== 'RENT' || !Number.isInteger(contract.amount) || contract.amount <= 0) continue;
    const localMinute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
    const dayIndex = Math.floor(state.world.clockMinutes / 1440), dueMinute = Number.isInteger(contract.dueMinute) ? contract.dueMinute : 1020;
    const closeMinute = Number.isInteger(contract.closeMinute) ? contract.closeMinute : 1380;
    if (localMinute < dueMinute || dayIndex < nextRentDueDay(contract) || contract.lastSettledDayIndex === dayIndex
      || host.historicalAliveAndPresent === false) continue;
    if (contract.dueDayIndex !== dayIndex) {
      contract.dueDayIndex = dayIndex;
      contract.amountDueRemaining = contract.amount + (contract.arrears ?? 0);
      contract.currentRentRemaining = contract.amount;
      contract.arrearsDue = contract.arrears ?? 0;
      contract.arrears = 0;
    }
    const landlord = state.hosts[contract.landlordHostId];
    const rentEventOrigin = { hostId: host.id, landlordHostId: contract.landlordHostId, amountDueRemaining: contract.amountDueRemaining,
      unit: contract.unit, mapId: host.mapId, position: { ...host.position }, witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps) };
    beginRentCatalogEvent(state, rentEventOrigin, minuteOffset, maps, livingEventRows);
    if (host.id === embodiedId || paused.has(host.id) || !landlord || landlord.id === embodiedId || paused.has(landlord.id) || landlord.historicalAliveAndPresent === false
      || host.mapId !== landlord.mapId || !nearTile(host.position, landlord.position, 1)
      || host.money?.unit !== contract.unit || landlord.money?.unit !== contract.unit
      || !Number.isFinite(host.money?.amount) || !Number.isFinite(landlord.money?.amount)) {
      if (localMinute >= closeMinute) {
        contract.arrears = contract.amountDueRemaining;
        contract.lastSettledDayIndex = dayIndex;
        contract.nextDueDayIndex = dayIndex + rentBillingIntervalDays(contract);
        const rentRow = { ...RENT_LIVING_EVENT, kind: 'RENT_OVERDUE', hostId: host.id, landlordHostId: contract.landlordHostId, amount: contract.amountDueRemaining,
          arrears: contract.arrears, unit: contract.unit, mapId: host.mapId, position: { ...host.position }, minute: minuteOffset,
          causedByClaimId: host.lastWageClaimDayIndex === dayIndex ? host.lastWageClaimId : null,
          witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps), valueStatus: contract.valueStatus };
        recordRentOverdue(state, host, contract, rentRow, minuteOffset, maps, housingRows, livingEventRows);
      }
      continue;
    }
    if (contract.amountDueRemaining > 0 && host.money.amount > 0) {
      const paidAmount = Math.min(host.money.amount, contract.amountDueRemaining);
      host.money.amount -= paidAmount;
      landlord.money.amount += paidAmount;
      contract.amountDueRemaining -= paidAmount;
      const paidTowardRent = Math.min(paidAmount, contract.currentRentRemaining ?? 0);
      contract.currentRentRemaining = Math.max(0, (contract.currentRentRemaining ?? 0) - paidTowardRent);
      const settledArrears = Math.min(Math.max(0, paidAmount - paidTowardRent), contract.arrearsDue ?? 0);
      contract.arrearsDue = Math.max(0, (contract.arrearsDue ?? 0) - settledArrears);
      const fullyPaid = contract.amountDueRemaining === 0;
      if (fullyPaid) {
        contract.lastSettledDayIndex = dayIndex;
        contract.nextDueDayIndex = dayIndex + rentBillingIntervalDays(contract);
      }
      host.relations[landlord.id] ??= '방세를 낸 세입자';
      landlord.relations[host.id] ??= '방세를 낸 세입자';
      syncPersistentPersonalGoals(state, host.id);
      syncPersistentPersonalGoals(state, landlord.id);
      const rentRow = { ...RENT_LIVING_EVENT, kind: fullyPaid ? 'RENT_PAID' : 'RENT_PARTIAL', hostId: host.id, landlordHostId: landlord.id, amount: paidAmount,
        amountDueRemaining: contract.amountDueRemaining, scheduledAmount: contract.amount, settledArrears, unit: contract.unit,
        mapId: host.mapId, position: { ...host.position }, minute: minuteOffset,
        causedByClaimId: host.lastWageClaimDayIndex === dayIndex ? host.lastWageClaimId : null,
        witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps), valueStatus: contract.valueStatus };
      recordRentOverdue(state, host, contract, rentRow, minuteOffset, maps, housingRows, livingEventRows);
    }
    if (localMinute >= closeMinute && contract.amountDueRemaining > 0) {
      contract.arrears = contract.amountDueRemaining;
      contract.lastSettledDayIndex = dayIndex;
      contract.nextDueDayIndex = dayIndex + rentBillingIntervalDays(contract);
      host.needs ??= initialNpcNeeds(host, state.world.clockMinutes);
      host.needs.incomePressure = Math.min(100, host.needs.incomePressure + 8);
      const rentRow = { ...RENT_LIVING_EVENT, kind: 'RENT_OVERDUE', hostId: host.id, landlordHostId: landlord.id, amount: contract.amountDueRemaining,
        arrears: contract.arrears, unit: contract.unit, mapId: host.mapId, position: { ...host.position }, minute: minuteOffset,
        causedByClaimId: host.lastWageClaimDayIndex === dayIndex ? host.lastWageClaimId : null,
        witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps), valueStatus: contract.valueStatus };
      housingRows.push(rentRow);
      advanceRentCatalogEvent(state, rentRow, minuteOffset, maps, livingEventRows);
    }
  }
  for (const host of hosts) {
    const localMinute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
    const goal = host.activeGoal;
    const seller = goal?.type === 'PURCHASE_MEAL' ? state.hosts[goal.targetHostId] : null;
    const offer = seller?.marketOffers?.find(item => item.category === 'food' && (seller.marketStock?.[item.itemKo] ?? 0) > 0
      && isMarketOfferOpen(seller, item, state.world.clockMinutes));
    const price = seller && offer ? marketOfferPrice(state, seller, offer) : null;
    if (!seller || host.id === embodiedId || seller.id === embodiedId || paused.has(host.id) || paused.has(seller.id)
      || host.historicalAliveAndPresent === false || seller.historicalAliveAndPresent === false
      || host.mapId !== seller.mapId || !nearTile(host.position, seller.position, 1)
      || !offer || offer.unit !== host.money?.unit || seller.money?.unit !== offer.unit
      || !Number.isInteger(price) || price <= 0 || host.money.amount < price
      || host.needs.hunger < 60) continue;
    if (seller.id === 'innkeeper_irina' && state.world.livingEventStates?.E18?.status !== 'ACTIVE') {
      beginLateMealEvent(state, host, seller, offer, price, minuteOffset, maps, livingEventRows);
      continue;
    }
    seller.marketStock[offer.itemKo] -= 1;
    host.money.amount -= price;
    seller.money.amount += price;
    const mealSourceEventId = activeMealSeekingCauseEventId(host, state);
    const hungerBefore = host.needs.hunger;
    host.needs.hunger = Math.max(0, hungerBefore - (Number.isFinite(offer.hungerRelief) ? offer.hungerRelief : 32));
    host.needs.lastMealAtMinute = state.world.clockMinutes;
    noteFoodConsumed(host, state);
    host.needs.incomePressure = Math.min(100, host.needs.incomePressure + Math.min(8, price * 2));
    mealRows.push({ kind: 'PURCHASE_AND_EAT', hostId: host.id, sellerHostId: seller.id, itemKo: offer.itemKo,
      price, unit: offer.unit, valueStatus: offer.valueStatus, hungerBefore, hungerAfter: host.needs.hunger,
      ...(mealSourceEventId ? { sourceEventId: mealSourceEventId } : {}),
      mapId: host.mapId, sellerMapId: seller.mapId, position: { ...host.position }, sellerPosition: { ...seller.position }, minute: minuteOffset,
      witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps) });
    beginBreadPriceEvent(state, mealRows.at(-1), minuteOffset, maps, livingEventRows);
    completeBreadPriceEventOnSale(state, mealRows.at(-1), minuteOffset, maps, livingEventRows);
    syncPersistentPersonalGoals(state, host.id);
  }
  for (const host of hosts) {
    const goal = host.activeGoal, donor = goal?.type === 'SEEK_FOOD_AID' ? state.hosts[goal.targetHostId] : null;
    if (!donor || host.id === embodiedId || donor.id === embodiedId || paused.has(host.id) || paused.has(donor.id)
      || host.historicalAliveAndPresent === false || donor.historicalAliveAndPresent === false
      || host.needs.hunger < 82 || host.mapId !== donor.mapId || !nearTile(host.position, donor.position, 1)
      || !(host.relationshipEdges ?? []).some(edge => edge.kind === 'KINSHIP' && edge.status === 'FICTIONAL_CHARACTER_DESIGN' && edge.toHostId === donor.id)) continue;
    const itemKo = donor.inventory.find(item => foodOfferByItem.has(item) && donor.inventory.filter(entry => entry === item).length >= 2);
    if (!itemKo) continue;
    const offer = foodOfferByItem.get(itemKo);
    donor.inventory.splice(donor.inventory.indexOf(itemKo), 1);
    const hungerBefore = host.needs.hunger;
    host.needs.hunger = Math.max(0, hungerBefore - (Number.isFinite(offer.hungerRelief) ? offer.hungerRelief : 32));
    host.needs.lastMealAtMinute = state.world.clockMinutes;
    noteFoodConsumed(host, state);
    host.relations[donor.id] = '끼니값을 빌려 준 가족';
    donor.relations[host.id] = '끼니값을 빌린 가족';
    host.activeGoal = null;
    syncPersistentPersonalGoals(state, host.id);
    syncPersistentPersonalGoals(state, donor.id);
    state.world.foodAidRecords ??= [];
    state.world.foodAidRecords.push({ recipientHostId: host.id, donorHostId: donor.id, itemKo, hungerBefore,
      hungerAfter: host.needs.hunger, minute: state.world.clockMinutes, kind: 'KIN_FOOD_AID',
      debt: { status: 'OUTSTANDING', amountDue: offer.price, amountRepaid: 0, unit: offer.unit } });
    careRows.push({ kind: 'KIN_FOOD_AID_LOAN', hostId: host.id, recipientHostId: donor.id,
      amount: offer.price, unit: offer.unit, itemKo, minute: minuteOffset, mapId: host.mapId,
      position: { ...host.position }, witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps) });
    while (state.world.foodAidRecords.length > 128) {
      const settledIndex = state.world.foodAidRecords.findIndex(row => row.debt?.status !== 'OUTSTANDING');
      if (settledIndex < 0) break;
      state.world.foodAidRecords.splice(settledIndex, 1);
    }
    mealRows.push({ kind: 'KIN_FOOD_AID_AND_EAT', hostId: host.id, donorHostId: donor.id, itemKo,
      hungerBefore, hungerAfter: host.needs.hunger, loanAmount: offer.price, unit: offer.unit,
      mapId: host.mapId, position: { ...host.position }, minute: minuteOffset,
      witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps) });
  }
  for (const aid of state.world.foodAidRecords ?? []) {
    if (aid.debt?.status !== 'OUTSTANDING') continue;
    const debtor = state.hosts[aid.recipientHostId], creditor = state.hosts[aid.donorHostId];
    if (!debtor || !creditor || debtor.id === embodiedId || creditor.id === embodiedId || paused.has(debtor.id) || paused.has(creditor.id)
      || debtor.historicalAliveAndPresent === false || creditor.historicalAliveAndPresent === false
      || debtor.mapId !== creditor.mapId || !nearTile(debtor.position, creditor.position, 1)
      || debtor.money?.unit !== aid.debt.unit || creditor.money?.unit !== aid.debt.unit || debtor.money.amount <= 2) continue;
    const payment = Math.min(aid.debt.amountDue - aid.debt.amountRepaid, debtor.money.amount - 2);
    if (!Number.isInteger(payment) || payment <= 0) continue;
    debtor.money.amount -= payment; creditor.money.amount += payment;
    aid.debt.amountRepaid += payment;
    aid.debt.status = aid.debt.amountRepaid >= aid.debt.amountDue ? 'PAID' : 'OUTSTANDING';
    aid.debt.lastPaidAtMinute = state.world.clockMinutes;
    careRows.push({ kind: 'KIN_FOOD_AID_REPAYMENT', hostId: debtor.id, recipientHostId: creditor.id,
      amount: payment, unit: aid.debt.unit, remainingAmount: aid.debt.amountDue - aid.debt.amountRepaid,
      minute: minuteOffset, mapId: debtor.mapId, position: { ...debtor.position },
      witnessedByPlayer: playerCanObserveWorldEvent(state, debtor.mapId, debtor.position, 6, maps) });
  }
  for (const host of hosts) {
    const localMinute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
    const slot = pendingTaskSlot(host, 'DELIVER', localMinute), task = slot?.task;
    if (!task || host.id === embodiedId || paused.has(host.id) || host.historicalAliveAndPresent === false) continue;
    const recipient = state.hosts[task.recipientHostId];
    if (!recipient || recipient.id === embodiedId || recipient.historicalAliveAndPresent === false || recipient.mapId !== host.mapId || nearTile(recipient.position, host.position, 1) === false || !host.inventory.includes(task.itemKo)) continue;
    host.inventory.splice(host.inventory.indexOf(task.itemKo), 1);
    if (!recipient.inventory.includes(task.itemKo)) recipient.inventory.push(task.itemKo);
    host.routineTaskCompletedId = task.id;
    host.completedSocialTaskIds ??= [];
    if (!host.completedSocialTaskIds.includes(task.id)) host.completedSocialTaskIds.push(task.id);
    host.needs ??= initialNpcNeeds(host, state.world.clockMinutes);
    recipient.needs ??= initialNpcNeeds(recipient, state.world.clockMinutes);
    host.needs.socialNeed = Math.max(0, host.needs.socialNeed - 8);
    recipient.needs.socialNeed = Math.max(0, recipient.needs.socialNeed - 8);
    host.relations[recipient.id] ??= '봉투를 건넨 수취인';
    recipient.relations[host.id] ??= '봉투를 전한 배달원';
    syncPersistentPersonalGoals(state, host.id);
    syncPersistentPersonalGoals(state, recipient.id);
    deliveryRows.push({ hostId: host.id, recipientHostId: recipient.id, itemKo: task.itemKo, taskId: task.id, mapId: host.mapId, position: { ...host.position }, minute: minuteOffset, witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps) });
  }
  for (const host of hosts) beginMissingParcelOnDeadline(state, host, minuteOffset, maps, livingEventRows);
  advanceMissingParcelIfUnclaimed(state, minuteOffset, maps, livingEventRows);
  for (const host of hosts) {
    const localMinute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
    const slot = pendingTaskSlot(host, 'EXCHANGE', localMinute, Math.floor(state.world.clockMinutes / 1440)), task = slot?.task;
    if (!task || host.id === embodiedId || paused.has(host.id) || host.historicalAliveAndPresent === false) continue;
    if (task.requiresMarketStockout === true && (state.hosts.market_nadezhda?.marketStock?.[task.itemKo] ?? 0) > 0) continue;
    if (Number.isInteger(task.notBeforeMinute) && localMinute < task.notBeforeMinute) continue;
    const recipient = state.hosts[task.recipientHostId], moneyAmount = task.moneyAmount;
    const interactionRadius = Number.isInteger(task.interactionRadius) && task.interactionRadius >= 1 && task.interactionRadius <= 3 ? task.interactionRadius : 1;
    if (!recipient || recipient.id === embodiedId || recipient.historicalAliveAndPresent === false || recipient.mapId !== host.mapId || !nearTile(recipient.position, host.position, interactionRadius)) continue;
    if (typeof task.itemKo !== 'string' || !host.inventory.includes(task.itemKo) || !Number.isInteger(moneyAmount) || moneyAmount <= 0 || !Number.isFinite(host.money?.amount) || !Number.isFinite(recipient.money?.amount) || recipient.money.amount < moneyAmount) continue;
    host.inventory.splice(host.inventory.indexOf(task.itemKo), 1);
    const stockedOffer = (recipient.marketOffers ?? []).find(offer => offer.itemKo === task.itemKo);
    if (stockedOffer) {
      recipient.marketStock ??= {};
      recipient.marketStock[task.itemKo] = (recipient.marketStock[task.itemKo] ?? 0) + 1;
    } else if (!recipient.inventory.includes(task.itemKo)) recipient.inventory.push(task.itemKo);
    host.money.amount += moneyAmount;
    recipient.money.amount -= moneyAmount;
    host.needs ??= initialNpcNeeds(host, state.world.clockMinutes);
    recipient.needs ??= initialNpcNeeds(recipient, state.world.clockMinutes);
    host.needs.incomePressure = Math.max(0, host.needs.incomePressure - Math.min(12, moneyAmount * 2));
    recipient.needs.incomePressure = Math.min(100, recipient.needs.incomePressure + Math.min(8, moneyAmount));
    host.needs.socialNeed = Math.max(0, host.needs.socialNeed - 8);
    recipient.needs.socialNeed = Math.max(0, recipient.needs.socialNeed - 8);
    host.relations[recipient.id] = task.relationshipKo ?? '거래를 마친 이웃';
    recipient.relations[host.id] = task.recipientRelationshipKo ?? '거래를 마친 이웃';
    syncPersistentPersonalGoals(state, host.id);
    syncPersistentPersonalGoals(state, recipient.id);
    if (task.repeatDaily === true) {
      host.completedSocialTaskDayById ??= {};
      host.completedSocialTaskDayById[task.id] = Math.floor(state.world.clockMinutes / 1440);
    } else host.routineTaskCompletedId = task.id;
    host.completedSocialTaskIds ??= [];
    if (task.repeatDaily !== true && !host.completedSocialTaskIds.includes(task.id)) host.completedSocialTaskIds.push(task.id);
    exchangeRows.push({ hostId: host.id, recipientHostId: recipient.id, itemKo: task.itemKo, moneyAmount, taskId: task.id,
      ...(stockedOffer ? { marketStockAdded: true, marketStockCount: recipient.marketStock[task.itemKo] } : {}),
      mapId: host.mapId, position: { ...host.position }, minute: minuteOffset, witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps) });
    advanceLaundryOnExchange(state, exchangeRows.at(-1), minuteOffset, maps, livingEventRows);
    advanceBreadPriceEventOnRestock(state, exchangeRows.at(-1), minuteOffset, maps, livingEventRows);
    completeBookbindingOnExchange(state, exchangeRows.at(-1), minuteOffset, maps, livingEventRows);
  }
  for (const host of hosts) {
    const localMinute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
    const slot = pendingTaskSlot(host, 'CARE_TRANSFER', localMinute, Math.floor(state.world.clockMinutes / 1440)), task = slot?.task;
    if (!task || host.id === embodiedId || paused.has(host.id) || host.historicalAliveAndPresent === false || !canMakeAuthoredCareTransfer(state, host, task)) continue;
    const recipient = state.hosts[task.recipientHostId];
    if (recipient.id === embodiedId || recipient.historicalAliveAndPresent === false || recipient.mapId !== host.mapId || !nearTile(recipient.position, host.position, 1)) continue;
    host.money.amount -= task.moneyAmount;
    recipient.money.amount += task.moneyAmount;
    host.relations[recipient.id] = task.relationshipKo ?? '생활비를 보탠 가족';
    recipient.relations[host.id] = task.recipientRelationshipKo ?? '생활비를 받은 가족';
    host.completedSocialTaskDayById ??= {};
    host.completedSocialTaskDayById[task.id] = Math.floor(state.world.clockMinutes / 1440);
    host.completedSocialTaskIds ??= [];
    if (!host.completedSocialTaskIds.includes(task.id)) host.completedSocialTaskIds.push(task.id);
    careRows.push({ kind: 'HOUSEHOLD_SUPPORT', hostId: host.id, recipientHostId: recipient.id, amount: task.moneyAmount,
      unit: host.money.unit, taskId: task.id, householdId: host.places.homeLocation.householdId, status: 'FICTIONAL_CHARACTER_DESIGN',
      mapId: host.mapId, position: { ...host.position }, minute: minuteOffset,
      witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps) });
  }
  for (const host of hosts) {
    const localMinute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
    const slot = pendingTaskSlot(host, 'CONSUME', localMinute), task = slot?.task;
    if (!task || host.id === embodiedId || paused.has(host.id) || host.historicalAliveAndPresent === false) continue;
    host.needs ??= initialNpcNeeds(host, state.world.clockMinutes);
    const minimumHunger = Number.isFinite(task.minimumHunger) ? task.minimumHunger : 40;
    if (host.mapId !== slot.mapId || !nearTile(host.position, slot.position, 1) || host.needs.hunger < minimumHunger || !host.inventory.includes(task.itemKo)) continue;
    host.inventory.splice(host.inventory.indexOf(task.itemKo), 1);
    const hungerBefore = host.needs.hunger;
    host.needs.hunger = Math.max(0, hungerBefore - (Number.isFinite(task.hungerRelief) ? task.hungerRelief : 32));
    host.needs.lastMealAtMinute = state.world.clockMinutes;
    noteFoodConsumed(host, state);
    host.routineTaskCompletedId = task.id;
    mealRows.push({ hostId: host.id, itemKo: task.itemKo, hungerBefore, hungerAfter: host.needs.hunger, taskId: task.id, mapId: host.mapId, position: { ...host.position }, minute: minuteOffset, witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position, 6, maps) });
  }
  return { moveRows, deliveryRows, exchangeRows, careRows, paymentRows, housingRows, mealRows, goalRows, personalContactRows, restRecoveryRows, personalGoalRows, workRows, livingEventRows };
}

function advanceNpcWorld(state, elapsedMinutes, maps, options = {}) {
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes <= 0) return state;
  const next = clone(state);
  const tickCount = Math.min(10080, Math.max(1, Math.floor(elapsedMinutes))), movementLog = [], deliveryLog = [];
  const startClock = next.world.clockMinutes ?? 540, stateChanges = [], exchangeLog = [], careLog = [], paymentLog = [], housingLog = [], mealLog = [], goalLog = [], personalContactLog = [], restRecoveryLog = [], personalGoalLog = [], workLog = [], livingEventLog = [];
  for (let tick = 1; tick <= tickCount; tick += 1) {
    next.world.clockMinutes = startClock + tick;
    const coldWaveRows = [];
    advanceMissingRegisterEvent(next, tick, maps, livingEventLog);
    advancePetrashevskyReportEvent(next, tick, maps, livingEventLog);
    advanceHouseholdTutorOffer(next, tick, maps, livingEventLog);
    advanceApprenticeFatigueEvent(next, tick, maps, livingEventLog);
    advanceColdWaveEvent(next, tick, maps, coldWaveRows);
    advanceCensoredPageEvent(next, tick, maps, coldWaveRows, options);
    advanceSmuggledEditionEvent(next, tick, maps, livingEventLog);
    advanceCanalTraffic(next, [], tick, maps, livingEventLog);
    advanceWarehouseInjury(next, tick, maps, livingEventLog);
    advanceFixedHistoricalEvent(next, tick, maps, livingEventLog);
    advanceEuropeNewsEvent(next, tick, maps, livingEventLog);
    advancePushkinObituaryEvent(next, tick, maps, livingEventLog);
    advanceBelinskyLetterEvent(next, tick, maps, livingEventLog);
    advanceProcessionEvent(next, tick, maps, livingEventLog);
    advanceSickLodger(next, tick, maps, livingEventLog, options);
    advanceLateMealEvent(next, tick, maps, livingEventLog, options);
    advanceApprenticeLiteracy(next, tick, maps, livingEventLog, options);
    startPoliceDocumentCheck(next, tick, maps, livingEventLog);
    const result = simulateNpcMinute(next, maps, options, tick, movementLog, stateChanges);
    advanceSmuggledEditionEvent(next, tick, maps, result.livingEventRows);
    advanceFoodDeprivation(next, tick, maps, result.careRows);
    advanceApprenticeLiteracy(next, tick, maps, result.livingEventRows, options);
    advanceStudentCircle(next, tick, maps, result.livingEventRows);
    advanceStreetMusicEvent(next, tick, maps, result.livingEventRows);
    advancePhysiologyReadingEvent(next, tick, maps, result.livingEventRows);
    advanceManuscriptOfferEvent(next, tick, maps, result.livingEventRows, options);
    advanceSerfdomReadingEvent(next, tick, maps, result.livingEventRows, options);
    advanceSalonDebateEvent(next, tick, maps, result.livingEventRows, options);
    startSalonInvitationEvent(next, tick, maps, result.livingEventRows);
    advanceSalonInvitationEvent(next, tick, maps, result.livingEventRows, options);
    advanceMarketDayWorkEvent(next, tick, maps, result.livingEventRows, options);
    advanceMarketTheftEvent(next, tick, maps, result.livingEventRows, options);
    advanceEuropeNewsEvent(next, tick, maps, result.livingEventRows);
    advancePushkinObituaryEvent(next, tick, maps, result.livingEventRows);
    advanceBelinskyLetterEvent(next, tick, maps, result.livingEventRows);
    advanceProcessionEvent(next, tick, maps, result.livingEventRows);
    advancePoliceDocumentCheck(next, tick, maps, result.livingEventRows);
    advanceRentNoticeEvent(next, tick, maps, result.livingEventRows);
    advanceRoofLeakRepairEvent(next, tick, maps, result.livingEventRows);
     advanceCourtyardFireEvent(next, tick, maps, result.livingEventRows);
      advanceFuneralCostsEvent(next, tick, maps, result.livingEventRows);
    advanceCourtyardDispute(next, tick, maps, result.livingEventRows, options);
    advanceMarketPriceDispute(next, tick, maps, result.livingEventRows, options);
    advanceMarketRumorEvent(next, tick, maps, result.livingEventRows);
    advanceInnGuestEvent(next, tick, maps, result.livingEventRows);
    advanceNewspaperIssueEvent(next, tick, maps, result.livingEventRows, options);
    advanceCharityMealEvent(next, tick, maps, result.livingEventRows, options);
    livingEventLog.push(...coldWaveRows);
    advanceCanalTraffic(next, result.moveRows, tick, maps, result.livingEventRows);
    deliveryLog.push(...result.deliveryRows);
    exchangeLog.push(...result.exchangeRows);
    careLog.push(...result.careRows);
    paymentLog.push(...result.paymentRows);
    housingLog.push(...result.housingRows);
    mealLog.push(...result.mealRows);
    goalLog.push(...result.goalRows);
    personalContactLog.push(...result.personalContactRows);
    restRecoveryLog.push(...result.restRecoveryRows);
    personalGoalLog.push(...result.personalGoalRows);
    workLog.push(...result.workRows);
    livingEventLog.push(...result.livingEventRows);
  }
  if (movementLog.length || deliveryLog.length || stateChanges.length || exchangeLog.length || careLog.length || paymentLog.length || housingLog.length || mealLog.length || goalLog.length || personalContactLog.length || restRecoveryLog.length || personalGoalLog.length || workLog.length || livingEventLog.length) {
    const entry = { eventId: `NPC_SIM_${next.ledger.length + 1}`, eventType: 'NPC_SIMULATION', date: next.world.date, mapId: next.world.currentMapId, startClockMinutes: startClock, endClockMinutes: next.world.clockMinutes, simulatedMinutes: tickCount, moves: movementLog, deliveries: deliveryLog, exchanges: exchangeLog, careTransfers: careLog, payments: paymentLog, housing: housingLog, meals: mealLog, goals: goalLog, personalContacts: personalContactLog, restRecoveries: restRecoveryLog, personalGoalVisits: personalGoalLog, workOutputs: workLog, livingEvents: livingEventLog, stateChanges };
    appendLedgerEvent(next, entry, state);
  }
  return next;
}

function beginRoofLeakRepairEvent(state, minuteOffset, maps, livingEventRows, sourceEventId = 'E26') {
  state.world.livingEventStates ??= {};
  if (state.world.livingEventStates.E35) return;
  const landlord = state.hosts.landlady_polina, tenant = state.hosts.tenant_mikhail;
  if (!landlord || !tenant || tenant.housing?.kind !== 'RENT' || tenant.housing.landlordHostId !== landlord.id) return;
  const scenePosition = { x: 12, y: 7 };
  const event = state.world.livingEventStates.E35 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E35',
    status: 'ACTIVE', stage: 'REPAIR_OPTIONS_OPEN', sourceEventId, startedAtMinute: state.world.clockMinutes,
    resolvesAtMinute: state.world.clockMinutes + 240, actorHostIds: [landlord.id, tenant.id], landlordHostId: landlord.id,
    tenantHostId: tenant.id, venueMapId: 'courtyard', scenePosition, repairStatus: 'LEAKING',
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance' };
  livingEventRows.push({ catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E35', stage: event.stage,
    stageIndex: 1, actorHostIds: [...event.actorHostIds], witnessHostIds: [], date: state.world.date,
    minute: minuteOffset, mapId: event.venueMapId, position: { ...scenePosition }, sourceEventId,
    occurrenceType: event.occurrenceType, validationStatus: event.validationStatus, valueStatus: event.valueStatus,
    state: clone(event), witnessedByPlayer: playerCanObserveWorldEvent(state, event.venueMapId, scenePosition, 6, maps),
    changeKo: '방세를 의논하던 중 미하일 방에 물이 새는 문제가 드러났다.' });
}
function advanceRoofLeakRepairEvent(state, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E35;
  if (!event || event.status !== 'ACTIVE' || state.world.clockMinutes < event.resolvesAtMinute) return;
  event.status = 'RESOLVED'; event.stage = 'REPAIR_POSTPONED'; event.repairStatus = 'LEAKING';
  event.resolvedAtMinute = state.world.clockMinutes; event.resolutionActionId = 'AUTO_REPAIR_POSTPONED';
  livingEventRows.push({ catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E35', stage: event.stage,
    stageIndex: 2, actorHostIds: [...event.actorHostIds], witnessHostIds: [], date: state.world.date,
    minute: minuteOffset, mapId: event.venueMapId, position: { ...event.scenePosition },
    occurrenceType: event.occurrenceType, validationStatus: event.validationStatus, valueStatus: event.valueStatus,
    state: clone(event), witnessedByPlayer: playerCanObserveWorldEvent(state, event.venueMapId, event.scenePosition, 6, maps),
    unattended: true, changeKo: '수리 약속은 정해지지 않았다. 천장은 계속 새고 두 사람은 각자 일터로 돌아갔다.' });
}
function advanceRentNoticeEvent(state, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E26;
  if (!event || event.status !== 'ACTIVE' || state.world.clockMinutes < event.closesAtMinute) return;
  event.status = 'RESOLVED'; event.stage = 'INCREASE_ACCEPTED'; event.resolvedAtMinute = state.world.clockMinutes;
  event.resolutionActionId = 'AUTO_RENT_INCREASE_AFTER_WAIT';
  const tenant = state.hosts[event.tenantHostId];
  if (tenant?.housing?.kind === 'RENT') tenant.housing.amount = event.proposedRent;
  for (const id of event.actorHostIds) {
    const host = state.hosts[id];
    if (host?.activeGoal?.taskId?.startsWith('V37:E26:')) host.activeGoal = null;
  }
  livingEventRows.push({ catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E26', stage: event.stage,
    stageIndex: 3, actorHostIds: [...event.actorHostIds], witnessHostIds: [], date: state.world.date,
    minute: minuteOffset, mapId: event.venueMapId, position: { ...event.scenePosition },
    occurrenceType: event.occurrenceType, validationStatus: event.validationStatus, valueStatus: event.valueStatus,
    state: clone(event), witnessedByPlayer: playerCanObserveWorldEvent(state, event.venueMapId, event.scenePosition, 6, maps),
    changeKo: '합의가 이뤄지지 않아 다음 납부일부터 새 방세가 적용된다.' });
  beginRoofLeakRepairEvent(state, minuteOffset, maps, livingEventRows);
}

function petrashevskyReportEventRow(state, stage, minuteOffset, maps, details = {}) {
  const event = state.world.livingEventStates?.E40, position = event?.scenePosition ?? { x: 12, y: 11 };
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E40', stage,
    stageIndex: ({ REPORT_ARRIVED: 1, OFFICIAL_REPORT_FILED: 2, NAMES_WITHHELD: 2,
      OWNERSHIP_AND_ORDER_SEPARATED: 2, AUTO_FILED: 2 })[stage],
    actorHostIds: [...(event?.actorHostIds ?? [])], witnessHostIds: [...(event?.witnessHostIds ?? [])],
    date: state.world.date, minute: minuteOffset, mapId: 'chancery', position: { ...position },
    sourceIds: [...(event?.sourceIds ?? ['OBJ-WS-PETRASHEVSKY-REPORT-1849'])],
    occurrenceType: 'DOCUMENTED_HISTORICAL_EVENT', validationStatus: 'CONTEMPORARY_1849_REPORT_RANGE_VERIFIED',
    historicalOutcomeId: 'PETRASHEVSKY_ARRESTS_1849', historicalOutcomeFixed: true,
    state: event ? clone(event) : null,
    witnessedByPlayer: playerCanObserveWorldEvent(state, 'chancery', position, 6, maps), ...details };
}
function advancePetrashevskyReportEvent(state, minuteOffset, maps, livingEventRows) {
  state.world.livingEventStates ??= {};
  let event = state.world.livingEventStates.E40;
  if (!event) {
    const report = layer(maps?.chancery, 'Interactions')?.objects.find(item => item.type === 'source'
      && properties(item).sourceId === 'OBJ-WS-PETRASHEVSKY-REPORT-1849');
    const register = layer(maps?.chancery, 'Interactions')?.objects.find(item => item.id === 32);
    if (state.world.chapterId !== 'V33_1849_CIRCLE' || state.world.date !== '1849-04-22'
      || state.world.clockMinutes < 540 || !report || !register) return;
    const witnesses = Object.values(state.hosts).filter(host => host.historicalAliveAndPresent !== false
      && host.mapId === 'chancery' && nearTile(host.position, { x: 12, y: 11 }, 6))
      .map(host => host.id).filter(id => id !== 'clerk_alexei').sort();
    event = state.world.livingEventStates.E40 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E40',
      status: 'ACTIVE', stage: 'REPORT_ARRIVED', trigger: '1849-04-22_state_report_reaches_the_chancery',
      startedAtMinute: state.world.clockMinutes, resolvesAtMinute: state.world.clockMinutes + 180,
      actorHostIds: state.hosts.clerk_alexei ? ['clerk_alexei'] : [], witnessHostIds: witnesses,
      venueMapId: 'chancery', scenePosition: { x: 12, y: 11 },
      sourceId: 'OBJ-WS-PETRASHEVSKY-REPORT-1849',
      sourceIds: ['OBJ-WS-PETRASHEVSKY-REPORT-1849', 'OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849'],
      outcomeSourceIds: ['OBJ-WS-PETRASHEVSKY-REPORT-1849', 'OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849'],
      historicalOutcomeId: 'PETRASHEVSKY_ARRESTS_1849', historicalOutcomeFixed: true,
      resolutionActionId: null };
    state.world.immutableOutcomes ??= {};
    state.world.immutableOutcomes.PETRASHEVSKY_ARRESTS_1849 = 'the documented arrests and sentences remain fixed historical outcomes';
    livingEventRows.push(petrashevskyReportEventRow(state, event.stage, minuteOffset, maps,
      { changeKo: '4월 22일자 수사 보고서가 관청에 도착했다. 문서에는 정보원의 보고와 체포 명령, 조사 대상자 명단이 이어져 있다.' }));
  }
  if (event.status !== 'ACTIVE' || state.world.clockMinutes < event.resolvesAtMinute) return;
  const hostId = state.hosts.clerk_alexei ? 'clerk_alexei' : null;
  event.status = 'RESOLVED'; event.stage = 'AUTO_FILED'; event.resolvedAtMinute = state.world.clockMinutes;
  event.resolvedByHostId = hostId; event.resolutionActionId = 'AUTO_REGULAR_REPORT_FILING';
  state.world.petrashevskyCaseRecord = { eventId: 'E40', sourceIds: [...event.sourceIds],
    disposition: 'AUTOMATIC_OFFICIAL_REGISTER', recordedByHostId: hostId,
    recordedAtMinute: state.world.clockMinutes, officialRecordNumber: state.ledger.length + 1,
    namesCopied: true, ownershipClaimsSeparated: false, historicalOutcomeFixed: true };
  if (hostId) {
    state.hosts[hostId].personalEventNotes ??= [];
    state.hosts[hostId].personalEventNotes.push({ eventId: 'E40', sourceId: event.sourceId,
      speakerHostId: hostId, atMinute: state.world.clockMinutes,
      noteKo: '응답을 기다리지 못해 보고서의 이름을 공식 등록부에 옮겼다.' });
  }
  livingEventRows.push(petrashevskyReportEventRow(state, event.stage, minuteOffset, maps,
    { actionId: event.resolutionActionId, unattended: true, officialRecordNumber: state.world.petrashevskyCaseRecord.officialRecordNumber,
      changeKo: '응답 시간이 지나 보고서가 관청 등록부에 접수됐다. 체포와 재판의 역사적 결과는 그대로다.' }));
}

function householdTutorEventRow(state, event, stage, minuteOffset, maps, details = {}) {
  return { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E37', stage,
    stageIndex: stage === 'OFFER_DELIVERED' ? 1 : 2, actorHostIds: [...event.actorHostIds],
    witnessHostIds: [...event.witnessHostIds], date: state.world.date, minute: minuteOffset,
    mapId: event.venueMapId, position: { ...event.scenePosition }, sourceIds: [...event.sourceIds],
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    state: clone(event), witnessedByPlayer: playerCanObserveWorldEvent(state, event.venueMapId, event.scenePosition, 6, maps), ...details };
}
function advanceHouseholdTutorOffer(state, minuteOffset, maps, livingEventRows) {
  state.world.livingEventStates ??= {};
  let event = state.world.livingEventStates.E37;
  if (!event) {
    const teacher = state.hosts.teacher_lyubov;
    const object = layer(maps?.courtyard, 'Interactions')?.objects.find(item => item.id === 1186);
    if (state.world.chapterId !== 'V33_1847_PRINT' || state.world.date !== '1847-06-01'
      || state.world.clockMinutes < 960 || !object || teacher?.historicalAliveAndPresent === false
      || teacher?.mapId !== 'courtyard' || !nearTile(teacher.position, { x: 17, y: 13 }, 3)) return;
    const witnesses = Object.values(state.hosts).filter(host => host.id !== teacher.id
      && host.historicalAliveAndPresent !== false && host.mapId === 'courtyard'
      && nearTile(host.position, { x: 17, y: 13 }, 5)).map(host => host.id).sort();
    event = state.world.livingEventStates.E37 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E37',
      status: 'ACTIVE', stage: 'OFFER_DELIVERED', trigger: 'teacher_reaches_courtyard_work_period',
      startedAtMinute: state.world.clockMinutes, resolvesAtMinute: state.world.clockMinutes + 180,
      teacherHostId: teacher.id, actorHostIds: [teacher.id], witnessHostIds: witnesses,
      venueMapId: 'courtyard', scenePosition: { x: 17, y: 13 }, sourceIds: ['OBJ-WS-HOME-TEACHERS-1834'],
      resolutionActionId: null, valueStatus: 'FICTIONAL_GAMEPLAY_BALANCE' };
    livingEventRows.push(householdTutorEventRow(state, event, event.stage, minuteOffset, maps,
      { changeKo: '가정교사 일자리를 제안하는 쪽지가 안뜰에 도착했다.' }));
  }
  if (event.status !== 'ACTIVE' || state.world.clockMinutes < event.resolvesAtMinute) return;
  event.status = 'RESOLVED'; event.stage = 'OFFER_EXPIRED'; event.resolvedAtMinute = state.world.clockMinutes;
  event.resolutionActionId = 'UNANSWERED_OFFER_EXPIRED';
  livingEventRows.push(householdTutorEventRow(state, event, event.stage, minuteOffset, maps,
    { actionId: event.resolutionActionId, unattended: true, changeKo: '쪽지에 정한 시각이 지나 일자리 제안이 거두어졌다.' }));
}

function advanceFixedHistoricalEvent(state, minuteOffset, maps, livingEventRows) {
  const event = state.world.livingEventStates?.E41;
  if (!event) return;
  if (event.status === 'SCHEDULED') {
    const actor = state.hosts[event.actorHostIds[0]];
    if (state.world.clockMinutes < event.startsAtMinute || actor?.mapId !== event.venueMapId
      || !nearTile(actor.position, event.scenePosition, 8)) return;
    event.status = 'ACTIVE';
    event.stage = 'MOCK_EXECUTION_PREPARATION';
    event.startedAtMinute = state.world.clockMinutes;
    event.closesAtMinute = event.startedAtMinute + event.durationMinutes;
    state.ledger.push({ eventId: `WORLD_EVENT_${state.ledger.length + 1}`, eventType: 'HISTORICAL_EVENT_STAGE',
      date: state.world.date, chapterId: 'V33_1849_CIRCLE', questId: 'E41_SEMENOVSKY_1849', catalogEventId: 'E41',
      stage: event.stage, sourceIds: [...event.outcomeSourceIds], outcomeFixed: true });
  }
  if (event.status !== 'ACTIVE' || state.world.clockMinutes < event.closesAtMinute) return;
  event.status = 'RESOLVED';
  event.stage = 'COMMUTATION_ANNOUNCED';
  event.resolvedAtMinute = state.world.clockMinutes;
  event.resolutionActionId = 'AUTO_FIXED_SENTENCE_AND_COMMUTATION';
  state.quests.E41_SEMENOVSKY_1849 = { status: 'resolved', result: event.resolutionActionId };
  livingEventRows.push({ catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E41', stage: event.stage,
    actorHostIds: [...event.actorHostIds], witnessHostIds: [], date: state.world.date,
    minute: minuteOffset, mapId: event.venueMapId, position: { ...event.scenePosition },
    occurrenceType: event.occurrenceType, validationStatus: event.validationStatus,
    valueStatus: event.valueStatus, sourceIds: [...event.outcomeSourceIds], state: clone(event),
    witnessedByPlayer: playerCanObserveWorldEvent(state, event.venueMapId, event.scenePosition, 8, maps),
    unattended: !event.playerChoiceActionId, historicalOutcomeFixed: true,
    changeKo: '광장에 사형 판결이 낭독되고, 곧 감형 명령이 전해졌다.' });
}

function advanceWorldTime(state, minutes, maps, reservedTiles = [], options = {}) {
  if (!Number.isFinite(minutes) || minutes <= 0) return state;
  if (options.pauseNpcSimulation) {
    const next = clone(state);
    next.world.clockMinutes = (next.world.clockMinutes ?? 540) + Math.min(10080, Math.max(1, Math.floor(minutes)));
    return next;
  }
  return advanceNpcWorld(state, minutes, maps, { reservedTiles, pausedHostIds: options.pausedHostIds,
    deferLivingEventExpiryId: options.deferLivingEventExpiryId });
}

function payRent(state, { tenantHostId = state?.player?.embodiment } = {}, maps = {}) {
  const tenant = state?.hosts?.[tenantHostId], contract = tenant?.housing;
  if (!state || state.player.embodiment !== tenantHostId || !tenant || !contract || contract.kind !== 'RENT') return { ok: false, reason: 'rent_contract_unavailable', state };
  const landlord = state.hosts[contract.landlordHostId];
  if (!landlord || landlord.historicalAliveAndPresent === false || tenant.historicalAliveAndPresent === false
    || tenant.mapId !== state.world.currentMapId || landlord.mapId !== state.world.currentMapId
    || !nearTile(tenant.position, landlord.position, 1)) return { ok: false, reason: 'landlord_not_nearby', state };
  if (!Number.isInteger(contract.amount) || contract.amount <= 0 || !Number.isFinite(tenant.money?.amount)
    || !Number.isFinite(landlord.money?.amount) || tenant.money.unit !== contract.unit || landlord.money.unit !== contract.unit) {
    return { ok: false, reason: 'invalid_rent_contract', state };
  }
  const dayIndex = Math.floor(state.world.clockMinutes / 1440);
  if (contract.evictionStatus !== 'EVICTED' && dayIndex < nextRentDueDay(contract)) return { ok: false, reason: 'rent_not_due_yet', state };
  if (contract.lastSettledDayIndex === dayIndex && contract.evictionStatus !== 'EVICTED') return { ok: false, reason: 'rent_already_settled', state };
  const amountDue = contract.dueDayIndex === dayIndex && Number.isInteger(contract.amountDueRemaining)
    ? contract.amountDueRemaining : contract.amount + (contract.arrears ?? 0);
  const paidAmount = Math.min(tenant.money.amount, amountDue);
  if (amountDue <= 0) return { ok: false, reason: 'rent_already_settled', state };
  if (paidAmount <= 0) return { ok: false, reason: 'insufficient_funds', state };
  const mapId = tenant.mapId, tenantPosition = { ...tenant.position }, landlordPosition = { ...landlord.position };
  const timed = advanceWorldTime(state, 5, maps, [{ mapId, position: tenantPosition }, { mapId, position: landlordPosition }],
    { pausedHostIds: [tenantHostId, contract.landlordHostId] });
  const next = clone(timed), nextTenant = next.hosts[tenantHostId], nextLandlord = next.hosts[contract.landlordHostId], nextContract = nextTenant.housing;
  if (nextContract.dueDayIndex !== dayIndex) {
    nextContract.dueDayIndex = dayIndex;
    nextContract.amountDueRemaining = nextContract.amount + (nextContract.arrears ?? 0);
    nextContract.currentRentRemaining = nextContract.amount;
    nextContract.arrearsDue = nextContract.arrears ?? 0;
  }
  nextTenant.money.amount -= paidAmount;
  nextLandlord.money.amount += paidAmount;
  nextContract.amountDueRemaining -= paidAmount;
  const towardRent = Math.min(paidAmount, nextContract.currentRentRemaining ?? nextContract.amount);
  nextContract.currentRentRemaining = Math.max(0, (nextContract.currentRentRemaining ?? nextContract.amount) - towardRent);
  const settledArrears = Math.min(Math.max(0, paidAmount - towardRent), nextContract.arrearsDue ?? 0);
  nextContract.arrearsDue = Math.max(0, (nextContract.arrearsDue ?? 0) - settledArrears);
  const fullyPaid = nextContract.amountDueRemaining === 0;
  nextContract.arrears = Math.max(0, nextContract.amountDueRemaining);
  if (fullyPaid) {
    nextContract.lastSettledDayIndex = dayIndex;
    nextContract.nextDueDayIndex = dayIndex + rentBillingIntervalDays(nextContract);
  }
  if (fullyPaid) settleEvictedTenant(nextTenant, nextContract);
  nextTenant.needs ??= initialNpcNeeds(nextTenant, next.world.clockMinutes);
  nextTenant.needs.incomePressure = Math.max(0, nextTenant.needs.incomePressure - Math.min(12, paidAmount * 2));
  nextTenant.relations[contract.landlordHostId] ??= '방세를 낸 세입자';
  nextLandlord.relations[tenantHostId] ??= '방세를 낸 세입자';
  syncPersistentPersonalGoals(next, tenantHostId);
  syncPersistentPersonalGoals(next, contract.landlordHostId);
  const row = { ...RENT_LIVING_EVENT, kind: fullyPaid ? 'RENT_PAID' : 'RENT_PARTIAL', hostId: tenantHostId, landlordHostId: contract.landlordHostId,
    amount: paidAmount, amountDueRemaining: nextContract.amountDueRemaining, scheduledAmount: contract.amount, settledArrears,
    unit: contract.unit, mapId, position: tenantPosition, minute: next.world.clockMinutes % 1440,
    witnessedByPlayer: playerCanObserveWorldEvent(next, mapId, tenantPosition, 6, maps), valueStatus: contract.valueStatus };
  const livingEventRows = [];
  beginRentCatalogEvent(next, row, row.minute, maps, livingEventRows);
  advanceRentCatalogEvent(next, row, row.minute, maps, livingEventRows);
  const entry = { eventId: `NPC_SIM_${next.ledger.length + 1}`, eventType: 'NPC_SIMULATION', date: next.world.date, mapId,
    startClockMinutes: timed.world.clockMinutes - 5, endClockMinutes: timed.world.clockMinutes, simulatedMinutes: 5,
    moves: [], deliveries: [], exchanges: [], payments: [], housing: [row], livingEvents: livingEventRows, meals: [], goals: [], personalContacts: [],
    restRecoveries: [], personalGoalVisits: [], workOutputs: [], stateChanges: [] };
  appendLedgerEvent(next, entry, timed);
  return { ok: true, state: next, paidAmount, amountDueRemaining: nextContract.amountDueRemaining, kind: row.kind };
}

function canOccupy(map, x, y, ignoreHostId = null, hostStates = null) {
  if (!map || tileAt(layer(map, 'Collision'), x, y) !== 0) return false;
  if (hostStates) return !Object.values(hostStates).some(host => host.id !== ignoreHostId && host.historicalAliveAndPresent !== false && host.mapId === map.mapId && host.position.x === x && host.position.y === y);
  const npcLayer = layer(map, 'NPCs');
  return !(npcLayer?.objects ?? []).some(npc => {
    if (properties(npc).hostId === ignoreHostId) return false;
    const tile = objectTile(npc);
    return tile.x === x && tile.y === y;
  });
}

function nearestOpenArrival(map, preferred, hostId, hosts) {
  const maxRadius = map.width + map.height;
  for (let radius = 0; radius <= maxRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const dx = radius - Math.abs(dy);
      const candidates = dx === 0
        ? [{ x: preferred.x, y: preferred.y + dy }]
        : [{ x: preferred.x - dx, y: preferred.y + dy }, { x: preferred.x + dx, y: preferred.y + dy }];
      const open = candidates.find(tile => canOccupy(map, tile.x, tile.y, hostId, hosts));
      if (open) return open;
    }
  }
  return null;
}

function yieldBlockingResident(state, map, x, y, movingHostId) {
  const blocker = Object.values(state.hosts).find(host => host.id !== movingHostId && host.historicalAliveAndPresent !== false && host.mapId === map.mapId && host.position.x === x && host.position.y === y);
  if (!blocker) return null;
  const actor = state.player.embodiment ? state.hosts[state.player.embodiment] : state.player;
  const doorwayTiles = exitClearanceTiles(map);
  const destination = NPC_STEPS.map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
    .find(tile => tileAt(layer(map, 'Collision'), tile.x, tile.y) === 0
      && !(actor.position.x === tile.x && actor.position.y === tile.y)
      && !(x === tile.x && y === tile.y)
      && !doorwayTiles.has(tileKey(tile))
      && !Object.values(state.hosts).some(host => host.id !== blocker.id && host.historicalAliveAndPresent !== false && host.mapId === map.mapId && host.position.x === tile.x && host.position.y === tile.y));
  if (!destination) return null;
  const from = { ...blocker.position };
  blocker.position = destination;
  return { hostId: blocker.id, from, to: { ...destination } };
}

function moveActor(state, direction, map, maps = { [map?.mapId]: map }) {
  const delta = DIRECTIONS[direction];
  if (!delta || !state || !map || state.world.currentMapId !== map.mapId) return { state, moved: false, reason: 'invalid_direction_or_map' };
  const hostId = state.player.embodiment;
  const actor = hostId ? state.hosts[hostId] : state.player;
  if (!actor || (hostId && actor.mapId !== state.world.currentMapId)) return { state, moved: false, reason: 'actor_not_present' };
  const x = actor.position.x + delta[0], y = actor.position.y + delta[1];
  if (tileAt(layer(map, 'Collision'), x, y) !== 0) return { state, moved: false, reason: 'collision' };
  const timed = advanceWorldTime(state, 1, maps, [{ mapId: map.mapId, position: { x, y } }]);
  let yielded = null;
  if (!canOccupy(map, x, y, hostId, timed.hosts)) yielded = yieldBlockingResident(timed, map, x, y, hostId);
  if (!canOccupy(map, x, y, hostId, timed.hosts)) return { state, moved: false, reason: 'collision' };
  const next = clone(timed);
  const nextActor = hostId ? next.hosts[hostId] : next.player;
  nextActor.position = { x, y };
  nextActor.facing = direction;
  next.player.position = { x, y };
  if (yielded) next.ledger.push({ eventId: `NPC_YIELD_${next.ledger.length + 1}`, eventType: 'NPC_YIELD', date: next.world.date, mapId: map.mapId, movingHostId: hostId, hostId: yielded.hostId, from: yielded.from, to: yielded.to, reason: 'resident_makes_room_for_player' });
  return { state: next, moved: true, reason: null };
}

function possessHost(state, hostId, map) {
  if (!state || state.player.embodiment) return { ok: false, reason: 'already_embodied', state };
  const host = state.hosts[hostId];
  if (!host || !host.historicalAliveAndPresent || host.mapId !== state.world.currentMapId || map.mapId !== state.world.currentMapId) return { ok: false, reason: 'host_not_here', state };
  if (host.presenceWindow && (state.world.date < host.presenceWindow.startDate || state.world.date > host.presenceWindow.endDate)) return { ok: false, reason: 'era_layer_mismatch', state };
  const era = host.eraProfile ?? runtimeEraProfile(host);
  if (era.layer === 'LITERARY') {
    const realm = state.world.activeRealm;
    if (!realm || realm.mapClass !== 'LITERARY_REALM' || realm.id !== era.realmId || state.world.currentMapId !== era.mapId
      || !era.allowedChapterIds.includes(realm.id) || (era.sourceIds.length && era.sourceIds.some(id => !realm.sourceIds?.includes(id)))) {
      return { ok: false, reason: 'era_layer_mismatch', state };
    }
  } else {
    if (state.world.activeRealm || !era.allowedChapterIds.includes(state.world.chapterId)) return { ok: false, reason: 'era_layer_mismatch', state };
  }
  if (!nearTile(state.player.position, host.position, 2)) return { ok: false, reason: 'too_far', state };
  const next = clone(state);
  next.player.embodiment = hostId;
  next.player.position = { ...host.position };
  next.world.possessionHistory.push({ eventId: `POSSESS_${next.world.possessionHistory.length + 1}`, date: next.world.date, hostId, mapId: next.world.currentMapId });
  return { ok: true, state: next };
}

function enterLiteraryRealm(state, map, card) {
  if (!state || state.player.embodiment || state.world.activeRealm || map?.metadata?.mapClass !== 'LITERARY_REALM' || card?.kind !== 'LITERARY' || !card.allowedMaps.includes(map.mapId) || !state.hosts[card.id]) return { ok: false, reason: 'literary_realm_unavailable', state };
  const requiredSources = map.metadata.sourceIds ?? [];
  if (requiredSources.some(sourceId => !(state.world.discoveredSourceIds ?? []).includes(sourceId))) return { ok: false, reason: 'literary_source_unread', state };
  const next = clone(state);
  next.world.returnLocation = { mapId: next.world.currentMapId, position: { ...next.player.position }, date: next.world.date };
  next.world.activeRealm = { id: map.metadata.realmId, mapClass: 'LITERARY_REALM', sourceIds: [...(map.metadata.sourceIds ?? [])] };
  next.world.currentMapId = map.mapId;
  if (map.metadata.date) next.world.date = map.metadata.date;
  next.player.position = { ...(map.metadata.observerStart ?? card.start) };
  next.hosts[card.id].mapId = map.mapId;
  next.hosts[card.id].position = { ...card.start };
   appendLedgerEvent(next, { eventId: `REALM_${next.ledger.length + 1}`, eventType: 'ENTER_LITERARY_REALM', realmId: map.metadata.realmId, sourceIds: [...(map.metadata.sourceIds ?? [])], date: next.world.date }, state);
  return { ok: true, state: next };
}

function leaveLiteraryRealm(state, maps = {}) {
  const location = state?.world?.returnLocation;
  if (!state?.world?.activeRealm || !location || !maps[location.mapId]) return { ok: false, reason: 'not_in_literary_realm', state };
  const next = clone(state);
  next.player.embodiment = null;
  next.world.currentMapId = location.mapId;
  if (location.date) next.world.date = location.date;
  next.player.position = { ...location.position };
  next.world.activeRealm = null;
  delete next.world.returnLocation;
   appendLedgerEvent(next, { eventId: `REALM_${next.ledger.length + 1}`, eventType: 'LEAVE_LITERARY_REALM', date: next.world.date }, state);
  return { ok: true, state: next };
}

function releaseHost(state, map) {
  const hostId = state?.player?.embodiment;
  if (!hostId) return { ok: false, reason: 'not_embodied', state };
  const host = state.hosts[hostId];
  if (!host || host.releaseLocked || state.activeDialogue) return { ok: false, reason: 'host_action_in_progress', state };
  if (host.mapId !== state.world.currentMapId || map?.mapId !== state.world.currentMapId) return { ok: false, reason: 'host_not_here', state };
  const next = clone(state);
  next.player.embodiment = null;
  next.player.position = { ...host.position };
  return { ok: true, state: next };
}

function transitionMap(state, exitId, maps) {
  const currentMap = maps?.[state.world.currentMapId];
  const exits = layer(currentMap, 'Interactions')?.objects ?? [];
  const exit = exits.find(item => item.type === 'map-exit' && properties(item).exitId === exitId);
  if (!exit) return { ok: false, reason: 'unknown_exit', state };
  const data = properties(exit), targetMap = maps[data.targetMapId];
  if (state.player.civic?.custody?.active && data.targetMapId !== 'police-station') return { ok: false, reason: 'custody_active', state };
  if (!targetMap || !nearTile(state.player.position, objectTile(exit))) return { ok: false, reason: 'exit_not_reachable', state };
  const currentRealmClass = currentMap.metadata?.mapClass === 'LITERARY_REALM';
  const targetRealmClass = targetMap.metadata?.mapClass === 'LITERARY_REALM';
  if (currentRealmClass !== targetRealmClass || (currentRealmClass && currentMap.metadata.realmId !== targetMap.metadata.realmId)) return { ok: false, reason: 'realm_boundary', state };
  const hostId = state.player.embodiment;
  const host = hostId ? state.hosts[hostId] : null;
  if (!data.publicAccess && !hostId) return { ok: false, reason: 'person_required', state };
  if (hostId && (!host || !host.allowedMaps.includes(data.targetMapId))) return { ok: false, reason: 'host_lacks_access', state };
  const accessFailure = mapAccessFailure(targetMap, host, state.world.clockMinutes);
  if (accessFailure) return { ok: false, reason: accessFailure, state };
  const preferredArrival = { x: Number(data.arrivalX), y: Number(data.arrivalY) };
  if (!Number.isInteger(preferredArrival.x) || !Number.isInteger(preferredArrival.y)) return { ok: false, reason: 'invalid_arrival', state };
  const arrival = nearestOpenArrival(targetMap, preferredArrival, hostId, state.hosts);
  if (!arrival) return { ok: false, reason: 'invalid_arrival', state };
  const timed = advanceWorldTime(state, 5, maps, [{ mapId: data.targetMapId, position: arrival }]);
  const next = clone(timed);
  next.world.currentMapId = data.targetMapId;
  const targetDate = targetMap.metadata?.date;
  if (targetDate && targetDate > next.world.date) next.world.date = targetDate;
  next.player.position = arrival;
  if (hostId) {
    next.hosts[hostId].mapId = data.targetMapId;
    next.hosts[hostId].position = { ...arrival };
  }
  return { ok: true, state: next };
}

function performQuestAction(state, { questId, hostId, actionId, objectId }, { quests = [], maps = {} } = {}) {
  const quest = quests.find(item => item.id === questId), current = state.quests?.[questId], action = quest?.actions.find(item => item.id === actionId);
  if (!quest || !current || current.status !== 'open' || !action) return { ok: false, reason: 'unknown_or_closed_action', state };
  if ((quest.prerequisiteQuestIds ?? []).some(id => state.quests?.[id]?.status !== 'resolved')) return { ok: false, reason: 'quest_chain_locked', state };
  const chain = quest.lifeChain, chainProgress = chain ? state.world.lifeChains?.[chain.id] : null;
  if (chain && (chain.stage === 1 ? Boolean(chainProgress) : chainProgress?.stage !== chain.stage - 1 || chainProgress?.history?.at(-1)?.questId !== chain.previousQuestId)) return { ok: false, reason: 'quest_chain_locked', state };
  if (action.requiredPriorResultFlags?.length && !action.requiredPriorResultFlags.includes(chainProgress?.history?.at(-1)?.resultFlag)) return { ok: false, reason: 'prior_choice_not_available', state };
  if (quest.date && quest.date > state.world.date) return { ok: false, reason: 'quest_not_yet_available', state };
  const requiredLivingEvent = quest.requiresLivingEventId ? state.world.livingEventStates?.[quest.requiresLivingEventId] : null;
  const requiredDebtStatuses = quest.requiresLivingEventDebtStatus
    ? [].concat(quest.requiresLivingEventDebtStatus) : null;
  if (quest.requiresLivingEventId && (requiredDebtStatuses
    ? !requiredDebtStatuses.includes(requiredLivingEvent?.debt?.status)
    : requiredLivingEvent?.status !== 'ACTIVE')) return { ok: false, reason: 'living_event_not_active', state };
  const literaryQuest = Boolean(quest.realmId) || quest.chapterId?.startsWith('LITERARY_');
  const requiredRealmId = quest.realmId ?? quest.chapterId;
  if (literaryQuest ? state.world.activeRealm?.id !== requiredRealmId : (quest.chapterId !== state.world.chapterId || Boolean(state.world.activeRealm))) return { ok: false, reason: 'quest_outside_chapter', state };
  if (state.player.embodiment !== hostId || !state.hosts[hostId]) return { ok: false, reason: 'wrong_embodiment', state };
  if (!action.hostIds.includes(hostId)) return { ok: false, reason: 'host_not_authorized', state };
  if (action.requiresLivingEventActorKey
    && (!/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(action.requiresLivingEventActorKey)
      || requiredLivingEvent?.[action.requiresLivingEventActorKey] !== hostId)) return { ok: false, reason: 'living_event_actor_required', state };
  if (action.requiredLivingEventStage && requiredLivingEvent?.stage !== action.requiredLivingEventStage) return { ok: false, reason: 'living_event_stage_not_ready', state };
  if (action.requiredLivingEventDebtStatus && requiredLivingEvent?.debt?.status !== action.requiredLivingEventDebtStatus) return { ok: false, reason: 'living_event_debt_status_not_ready', state };
  const host = state.hosts[hostId], entryMap = maps[quest.entry.mapId];
  const target = layer(entryMap, 'Interactions')?.objects.find(item => item.id === quest.entry.objectId);
  if (!target || host.mapId !== quest.entry.mapId || state.world.currentMapId !== quest.entry.mapId || objectId !== quest.entry.objectId || !nearTile(host.position, objectTile(target))) return { ok: false, reason: 'physical_object_unavailable', state };
  if (quest.socialChain) {
    const partner = state.hosts[quest.socialChain.partnerHostId];
    if (!partner || partner.historicalAliveAndPresent === false || partner.mapId !== state.world.currentMapId
      || !nearTile(host.position, partner.position, quest.socialChain.maxPartnerDistance ?? 2)) return { ok: false, reason: 'social_partner_not_present', state };
  }
  const requiredPresentHostIds = [...(action.requiredPresentHostIds ?? [])];
  if (action.requiredPresentLivingEventHostKey) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(action.requiredPresentLivingEventHostKey)) return { ok: false, reason: 'invalid_required_participant', state };
    const participantId = requiredLivingEvent?.[action.requiredPresentLivingEventHostKey];
    if (typeof participantId !== 'string') return { ok: false, reason: 'invalid_required_participant', state };
    requiredPresentHostIds.push(participantId);
  }
  if (!Array.isArray(requiredPresentHostIds) || requiredPresentHostIds.some(id => typeof id !== 'string' || !state.hosts[id] || id === hostId)) return { ok: false, reason: 'invalid_required_participant', state };
  const participantDistance = action.requiredParticipantDistance ?? 2;
  if (!Number.isInteger(participantDistance) || participantDistance < 1 || participantDistance > 8) return { ok: false, reason: 'invalid_required_participant', state };
  for (const participantId of requiredPresentHostIds) {
    const participant = state.hosts[participantId];
    if (participant.historicalAliveAndPresent === false || participant.mapId !== state.world.currentMapId
      || !nearTile(host.position, participant.position, participantDistance)) return { ok: false, reason: 'required_participant_not_present', state };
  }
  if (action.requiredKnowledgeId && !knowledgeForHost(state, hostId).includes(action.requiredKnowledgeId)) return { ok: false, reason: 'host_lacks_knowledge', state };
  const effects = action.effects ?? {}, relationEffects = effects.relations ?? {}, inventoryRemove = effects.inventoryRemove ?? [], inventoryAdd = effects.inventoryAdd ?? [];
  const chainDelta = effects.lifeChainDelta ?? {};
  if (Object.entries(chainDelta).some(([key, value]) => !/^[a-z][a-zA-Z0-9]{0,39}$/.test(key) || !Number.isInteger(value) || Math.abs(value) > 20)) return { ok: false, reason: 'invalid_life_chain_effect', state };
  if (effects.moneyDelta !== undefined && (!Number.isInteger(effects.moneyDelta) || Math.abs(effects.moneyDelta) > 10000 || !Number.isFinite(host.money?.amount) || host.money.amount + effects.moneyDelta < 0)) return { ok: false, reason: 'invalid_or_unaffordable_effect', state };
  const healthTransition = effects.healthTransition;
  if (healthTransition && (quest.id !== 'WAREHOUSE_INJURY_1847'
    || !['RECOVERING', 'INJURED'].includes(healthTransition.condition)
    || !Number.isInteger(healthTransition.recoveryMinutes) || healthTransition.recoveryMinutes < 1 || healthTransition.recoveryMinutes > 1440
    || !['MIDWIFE_TREATED', 'RESTED_WITHOUT_TREATMENT'].includes(healthTransition.care))) return { ok: false, reason: 'invalid_health_effect', state };
  if (questId === 'V37_APPRENTICE_LITERACY_1847' && ['E19_OFFER_KOPEK', 'E19_REQUEST_KOPEK'].includes(actionId)
    && state.hosts.print_apprentice_stepan.money.amount < 1) return { ok: false, reason: 'lesson_unaffordable', state };
  const actionDuration = action.durationMinutes ?? 5;
  if (!Number.isInteger(actionDuration) || actionDuration < 1 || actionDuration > 120) return { ok: false, reason: 'invalid_action_duration', state };
  if (Object.values(relationEffects).some(value => typeof value !== 'string' || value.length > 160)
    || (effects.partnerRelationKo !== undefined && (typeof effects.partnerRelationKo !== 'string' || effects.partnerRelationKo.length > 160))
    || (effects.situationKo !== undefined && (typeof effects.situationKo !== 'string' || effects.situationKo.length > 220))) return { ok: false, reason: 'invalid_action_effect', state };
  if (!Array.isArray(inventoryRemove) || !Array.isArray(inventoryAdd) || inventoryRemove.some(item => typeof item !== 'string' || !host.inventory.includes(item)) || inventoryAdd.some(item => typeof item !== 'string' || item.length > 80)) return { ok: false, reason: 'required_item_missing', state };
  const timed = advanceWorldTime(state, actionDuration, maps, [], { deferLivingEventExpiryId: questId === 'V37_MANUSCRIPT_OFFER_1847' ? 'E30'
    : questId === 'V37_SERFDOM_READING_1847' ? 'E31'
      : questId === 'CIRCLE_INVESTIGATION_1849' ? 'E40'
        : questId === 'V37_SALON_INVITATION_1847' ? 'E29'
        : questId === 'V37_SALON_DEBATE_1847' ? 'E21'
      : questId === 'V37_PHYSIOLOGY_READING_1847' ? 'E39'
      : questId === 'V37_MARKET_DAY_WORK_1847' ? 'E32'
        : questId === 'V37_MARKET_THEFT_1847' ? 'E36'
          : questId === 'V37_EUROPE_NEWS_1848' ? 'E42'
    : questId === 'V37_ROOF_LEAK_REPAIR_1847' ? 'E35'
    : questId === 'V37_CENSORED_PAGE_1847' ? 'E06'
    : questId === 'V37_COURTYARD_DISPUTE_1847' ? 'E09'
      : questId === 'V37_MARKET_PRICE_DISPUTE_1847' ? 'E13'
        : questId === 'V37_MARKET_RUMOR_1847' ? 'E23'
          : questId === 'V37_NEWSPAPER_RELEASE_1847' ? 'E22'
          : questId === 'V37_INN_GUEST_1847' ? 'E17'
          : questId === 'V37_LATE_MEAL_1847' ? 'E18'
          : questId === 'V37_CHARITY_DAY_1847' ? 'E14'
            : questId === 'V37_APPRENTICE_LITERACY_1847' ? 'E19'
            : questId === 'STUDENT_CIRCLE_RISK_1847' ? 'E24'
              : questId === 'V37_POLICE_DOCUMENT_CHECK_1847' ? 'E25'
            : questId === 'V37_SICK_LODGER_1847' ? 'E15'
            : questId === 'V37_APOTHECARY_ORDER_1847' ? 'E16'
            : questId === 'V37_APPRENTICE_FATIGUE_1847' ? 'E33'
              : questId === 'E41_SEMENOVSKY_1849' ? 'E41'
                : questId === 'V37_STREET_MUSIC_1847' ? 'E38' : undefined,
    pausedHostIds: ['CIRCLE_INVESTIGATION_1849', 'V37_MANUSCRIPT_OFFER_1847', 'V37_SERFDOM_READING_1847', 'V37_SALON_DEBATE_1847', 'V37_SALON_INVITATION_1847', 'V37_MARKET_DAY_WORK_1847', 'V37_ROOF_LEAK_REPAIR_1847', 'V37_CHARITY_DAY_1847', 'V37_APPRENTICE_LITERACY_1847', 'STUDENT_CIRCLE_RISK_1847', 'V37_POLICE_DOCUMENT_CHECK_1847', 'V37_SICK_LODGER_1847', 'V37_APPRENTICE_FATIGUE_1847', 'V37_MARKET_RUMOR_1847', 'V37_INN_GUEST_1847', 'V37_NEWSPAPER_RELEASE_1847', 'E41_SEMENOVSKY_1849', 'V37_STREET_MUSIC_1847', 'V37_PHYSIOLOGY_READING_1847', 'V37_HOUSEHOLD_TUTOR_OFFER_1847', 'V37_MARKET_THEFT_1847', 'V37_EUROPE_NEWS_1848'].includes(questId) ? [...(requiredLivingEvent?.actorHostIds ?? [])]
      : ['V37_MARKET_PRICE_DISPUTE_1847', 'V37_LATE_MEAL_1847'].includes(questId)
        ? [requiredLivingEvent?.sellerHostId, requiredLivingEvent?.buyerHostId].filter(Boolean)
            : questId === 'V37_APOTHECARY_ORDER_1847' ? [requiredLivingEvent?.buyerHostId, requiredLivingEvent?.supplierHostId].filter(Boolean)
              : questId === 'V37_FUNERAL_DEBT_REPAYMENT_1847' ? [requiredLivingEvent?.debt?.debtorHostId, requiredLivingEvent?.debt?.creditorHostId].filter(Boolean)
                : questId === 'E41_SEMENOVSKY_1849' ? [...(requiredLivingEvent?.actorHostIds ?? [])] : undefined });
  const next = clone(timed);
  const livingEvents = [];
  next.quests[questId] = questId === 'V37_APOTHECARY_ORDER_1847' && actionId === 'E16_PLACE_ORDER'
    ? { status: 'open', result: action.id }
    : { status: 'resolved', result: action.id };
  next.hosts[hostId].questFlags[action.resultFlag] = true;
  if (!literaryQuest && questId === 'CIRCLE_INVESTIGATION_1849') {
    const event = next.world.livingEventStates?.E40;
    const outcomes = {
      FILE_OFFICIAL_REPORT: ['OFFICIAL_REPORT_FILED', 'OFFICIAL_REGISTER', true, false],
      REFUSE_NAMING: ['NAMES_WITHHELD', 'PRIVATE_HOLD_NOTE', false, false],
      REGISTER_SEPARATE_OWNERSHIP: ['OWNERSHIP_AND_ORDER_SEPARATED', 'SEPARATE_OWNERSHIP_INDEX', true, true],
    };
    const [stage, disposition, namesCopied, ownershipClaimsSeparated] = outcomes[actionId] ?? [];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'REPORT_ARRIVED' || !stage
      || !next.world.discoveredSourceIds?.includes(event.sourceId)) {
      return { ok: false, reason: 'petrashevsky_report_not_ready', state };
    }
    event.status = 'RESOLVED'; event.stage = stage; event.resolvedAtMinute = next.world.clockMinutes;
    event.resolvedByHostId = hostId; event.resolutionActionId = actionId; event.playerChoiceActionId = actionId;
    const record = { eventId: 'E40', sourceIds: actionId === 'REGISTER_SEPARATE_OWNERSHIP'
      ? [...event.sourceIds] : [event.sourceId], disposition, recordedByHostId: hostId,
    recordedAtMinute: next.world.clockMinutes, officialRecordNumber: disposition === 'PRIVATE_HOLD_NOTE' ? null : next.ledger.length + 1,
    namesCopied, ownershipClaimsSeparated, assertionsClassifiedAs: 'INVESTIGATING_REPORT_CLAIMS', historicalOutcomeFixed: true };
    next.world.petrashevskyCaseRecord = record;
    if (actionId === 'REFUSE_NAMING') {
      next.hosts[hostId].personalEventNotes ??= [];
      next.hosts[hostId].personalEventNotes.push({ eventId: 'E40', sourceId: event.sourceId,
        speakerHostId: hostId, atMinute: next.world.clockMinutes,
        noteKo: '정보원 주장을 확인하지 못해 보고서에 적힌 이름을 새 장부에 옮기지 않았다.' });
    }
    livingEvents.push(petrashevskyReportEventRow(next, stage, next.world.clockMinutes % 1440, maps,
      { actionId, resolvedByHostId: hostId, ...record,
        changeKo: actionId === 'FILE_OFFICIAL_REPORT' ? '알렉세이는 보고서의 기관과 정보원 주장을 구분해 등록부에 접수했다.'
          : actionId === 'REFUSE_NAMING' ? '알렉세이는 확인되지 않은 이름을 새 장부에 옮기지 않고 개인 보류 메모를 남겼다.'
            : '알렉세이는 체포 명령과 소유자 주장을 별도 항목으로 접수했다. 수사 보고서의 혐의는 확정 판결과 구분해 두었다.' }));
  }
  if (questId === 'E41_SEMENOVSKY_1849') {
    const event = next.world.livingEventStates?.E41;
    if (!event || event.status !== 'ACTIVE' || event.historicalOutcomeId !== 'PETRASHEVSKY_SENTENCE_AND_COMMUTATION_1849') return { ok: false, reason: 'fixed_historical_event_closed', state };
    event.playerChoiceActionId = actionId;
    livingEvents.push({ catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E41', stage: event.stage,
      actorHostIds: [...event.actorHostIds], witnessHostIds: [], date: next.world.date,
      minute: next.world.clockMinutes % 1440, mapId: event.venueMapId, position: { ...event.scenePosition },
      occurrenceType: event.occurrenceType, validationStatus: event.validationStatus,
      valueStatus: event.valueStatus, sourceIds: [...event.outcomeSourceIds], state: clone(event),
      witnessedByPlayer: playerCanObserveWorldEvent(next, event.venueMapId, event.scenePosition, 8, maps),
      playerActionId: actionId, historicalOutcomeFixed: true,
      changeKo: actionId === 'KEEP_PRIVATE_NOTE' ? '현장에서 본 일을 개인 수첩에 적었다.' : '현장을 보고도 기록은 남기지 않았다.' });
  }
  if (effects.moneyDelta) next.hosts[hostId].money.amount += effects.moneyDelta;
  if (questId === 'V37_HOUSEHOLD_TUTOR_OFFER_1847') {
    const event = next.world.livingEventStates?.E37, payer = next.hosts.minor_noble_andrei, worker = next.hosts.teacher_lyubov;
    const outcomes = {
      E37_ACCEPT_OFFER: { stage: 'OFFER_ACCEPTED', amount: 10, daysPerWeek: 2 },
      E37_AGREE_LIGHTER_SCHEDULE: { stage: 'SCHEDULE_REDUCED', amount: 6, daysPerWeek: 1 },
      E37_DECLINE_OFFER: { stage: 'OFFER_DECLINED', amount: 0, daysPerWeek: 0 },
    };
    const outcome = outcomes[actionId];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'OFFER_DELIVERED'
      || hostId !== event.teacherHostId || !payer || !worker || !outcome
      || payer.money.unit !== worker.money.unit || payer.money.amount < outcome.amount) {
      return { ok: false, reason: 'household_tutor_offer_unavailable', state };
    }
    if (outcome.amount) {
      payer.money.amount -= outcome.amount; worker.money.amount += outcome.amount;
      event.payment = { payerHostId: payer.id, workerHostId: worker.id, amount: outcome.amount, unit: worker.money.unit, kind: 'FIRST_WEEK_WAGE' };
    }
    event.status = 'RESOLVED'; event.stage = outcome.stage; event.resolvedAtMinute = next.world.clockMinutes;
    event.resolvedByHostId = hostId; event.resolutionActionId = actionId; event.playerChoiceActionId = actionId;
    next.world.householdTutorRecord = { eventId: 'E37', sourceIds: [...event.sourceIds], hostId,
      disposition: actionId, weeklyDays: outcome.daysPerWeek, weeklyPay: outcome.amount,
      firstWeekPaid: outcome.amount > 0, employerHostId: payer.id, date: next.world.date,
      recordedAtMinute: next.world.clockMinutes };
    if (outcome.amount) next.world.householdTutorContract = { hostId, employerHostId: payer.id,
      weeklyDays: outcome.daysPerWeek, weeklyPay: outcome.amount, currency: worker.money.unit,
      startDate: next.world.date, status: 'ACTIVE', sourceIds: [...event.sourceIds] };
    livingEvents.push(householdTutorEventRow(next, event, event.stage, next.world.clockMinutes % 1440, maps,
      { actionId, resolvedByHostId: hostId, payment: clone(event.payment ?? null),
        changeKo: outcome.amount ? `가정교사 일을 주 ${outcome.daysPerWeek}회 맡고 첫 주 품삯 ${outcome.amount}코페이카를 받았다.` : '가정교사 일자리를 사양했다.' }));
  }
  if (questId === 'V37_MARKET_THEFT_1847') {
    const event = next.world.livingEventStates?.E36, seller = next.hosts.market_nadezhda;
    const witness = next.hosts.porter_gavrila, watchman = next.hosts.police_sergeant_ivan;
    const neighbor = next.hosts.tenant_mikhail;
    const outcomes = { E36_FILE_REPORT: 'FORMAL_REPORT_FILED', E36_REGISTER_LOSS: 'FORMAL_REPORT_FILED', E36_PRIVATE_WITNESS_NOTE: 'PRIVATE_WITNESS_NOTE',
      E36_REPAY_MISSING_CASH: 'LOSS_REPAID_BY_NEIGHBOR', E36_LEAVE_UNREPORTED: 'LOSS_UNREPORTED' };
    const stage = outcomes[actionId];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'WITNESS_READY' || !stage
      || hostId !== ({ E36_FILE_REPORT: seller?.id, E36_REGISTER_LOSS: watchman?.id, E36_PRIVATE_WITNESS_NOTE: witness?.id,
        E36_REPAY_MISSING_CASH: neighbor?.id, E36_LEAVE_UNREPORTED: seller?.id })[actionId]
      || !seller || !witness || !watchman || !neighbor
      || (actionId === 'E36_REPAY_MISSING_CASH' && neighbor.money.amount < event.unidentifiedLoss.amount)) {
      return { ok: false, reason: 'market_theft_response_unavailable', state };
    }
    if (actionId === 'E36_REPAY_MISSING_CASH') {
      neighbor.money.amount -= event.unidentifiedLoss.amount;
      seller.money.amount += event.unidentifiedLoss.amount;
      event.lossCompensation = { payerHostId: neighbor.id, recipientHostId: seller.id,
        amount: event.unidentifiedLoss.amount, unit: event.unidentifiedLoss.unit };
    } else if (actionId === 'E36_PRIVATE_WITNESS_NOTE') {
      witness.personalEventNotes ??= [];
      witness.personalEventNotes.push({ eventId: 'E36', speakerHostId: witness.id,
        atMinute: next.world.clockMinutes, noteKo: '돈주머니가 사라진 시각과 붐비던 좌판만 적었다. 누구도 지목하지 않았다.' });
      witness.relations[seller.id] = '분실 신고에 본 것만 보탠 짐꾼';
    } else if (['E36_FILE_REPORT', 'E36_REGISTER_LOSS'].includes(actionId)) {
      next.world.marketTheftRecords ??= [];
      const record = { eventId: 'E36', sourceIds: [...event.sourceIds], status: 'OPEN_UNIDENTIFIED_LOSS',
        sellerHostId: seller.id, witnessHostId: witness.id, watchmanHostId: watchman.id,
        missingAmount: event.unidentifiedLoss.amount, currency: event.unidentifiedLoss.unit,
        suspectHostId: null, filedByHostId: hostId, reportedByHostId: seller.id, filedAtMinute: next.world.clockMinutes };
      next.world.marketTheftRecords.push(record);
      event.officialRecordNumber = next.world.marketTheftRecords.length;
      watchman.currentActivityKo = '나데즈다의 분실 신고를 장터 기록에 올린다';
      watchman.relations[seller.id] = '장터의 분실 신고를 접수한 경비';
    } else seller.currentActivityKo = '돈주머니의 부족액을 적고 장사를 이어간다';
    event.status = 'RESOLVED'; event.stage = stage; event.resolvedAtMinute = next.world.clockMinutes;
    event.resolvedByHostId = hostId; event.resolutionActionId = actionId; event.playerChoiceActionId = actionId;
    for (const actorId of event.actorHostIds) {
      const actor = next.hosts[actorId]; if (actor?.activeGoal?.taskId?.startsWith('V37:E36:')) actor.activeGoal = null;
    }
    livingEvents.push(marketTheftEventRow(next, event, stage, next.world.clockMinutes % 1440, maps,
      { actionId, resolvedByHostId: hostId, ...(event.officialRecordNumber ? { officialRecordNumber: event.officialRecordNumber } : {}),
        ...(event.lossCompensation ? { payment: clone(event.lossCompensation) } : {}),
        changeKo: action.resultKo }));
  }
  if (questId === 'V37_EUROPE_NEWS_1848') {
    const event = next.world.livingEventStates?.E42;
    const outcomes = { E42_COPY_TO_REGISTER: ['clerk_alexei', 'OFFICIAL_REGISTER', 'OFFICIAL_NOTICE_FILED'],
      E42_KEEP_PRIVATE_NOTE: ['clerk_alexei', 'PRIVATE_NOTE', 'PRIVATE_NOTICE_RECORDED'],
      E42_READ_TO_SHOP: ['printer_ekaterina', 'SHOP_READING', 'DECLARATION_READ_ALOUD'] };
    const [requiredHostId, disposition, stage] = outcomes[actionId] ?? [];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'READING_READY' || hostId !== requiredHostId
      || !next.world.discoveredSourceIds?.includes('OBJ-NICHOLAS-MANIFESTO-1848')) {
      return { ok: false, reason: 'europe_news_event_not_ready', state };
    }
    event.status = 'RESOLVED'; event.stage = stage; event.disposition = disposition;
    event.resolvedAtMinute = next.world.clockMinutes; event.resolvedByHostId = hostId;
    event.resolutionActionId = actionId; event.playerChoiceActionId = actionId;
    const record = { eventId: 'E42', sourceIds: [...event.sourceIds], disposition, recordedByHostId: hostId,
      audienceHostIds: actionId === 'E42_READ_TO_SHOP' ? ['reader_darya', 'student_vasily'] : [],
      historicalOutcomeFixed: true, date: next.world.date, recordedAtMinute: next.world.clockMinutes };
    next.world.europeNewsRecord = record;
    if (actionId === 'E42_KEEP_PRIVATE_NOTE') {
      next.hosts[hostId].personalEventNotes ??= [];
      next.hosts[hostId].personalEventNotes.push({ eventId: 'E42', sourceId: event.sourceIds[0],
        speakerHostId: hostId, atMinute: next.world.clockMinutes,
        noteKo: '유럽의 소식을 황제의 선언은 어떻게 설명하는지 적었다. 공식 장부에는 옮기지 않았다.' });
    }
    for (const id of event.actorHostIds) {
      const host = next.hosts[id]; if (host?.activeGoal?.taskId?.startsWith('V37:E42:')) host.activeGoal = null;
    }
    livingEvents.push(europeNewsEventRow(next, event, stage, next.world.clockMinutes % 1440, maps,
      { actionId, ...record, changeKo: action.resultKo }));
  }
  if (questId === 'V37_PUSHKIN_OBITUARY_1847') {
    const event = next.world.livingEventStates?.E43;
    const outcomes = { E43_KEEP_FULL_TEXT: 'LEFT_OPEN_FOR_READERS',
      E43_COPY_TO_REGISTER: 'COPIED_TO_READING_LEDGER', E43_READ_TO_SHOP: 'READ_TO_SHOP' };
    const disposition = outcomes[actionId];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'READING_READY'
      || hostId !== 'bookseller_lev' || !disposition
      || !next.world.discoveredSourceIds?.includes('OBJ-PUSHKIN-OBITUARY-1837')) {
      return { ok: false, reason: 'pushkin_obituary_event_not_ready', state };
    }
    event.status = 'RESOLVED'; event.stage = disposition; event.disposition = disposition;
    event.resolvedAtMinute = next.world.clockMinutes; event.resolvedByHostId = hostId;
    event.resolutionActionId = actionId; event.playerChoiceActionId = actionId;
    const record = { eventId: 'E43', sourceIds: [...event.sourceIds], disposition,
      recordedByHostId: hostId, audienceHostIds: actionId === 'E43_READ_TO_SHOP' ? ['reader_darya', 'student_vasily'] : [],
      historicalOutcomeFixed: true, date: next.world.date, recordedAtMinute: next.world.clockMinutes };
    next.world.pushkinObituaryRecord = record;
    if (actionId === 'E43_COPY_TO_REGISTER') {
      next.hosts[hostId].readingLedger ??= [];
      next.hosts[hostId].readingLedger.push({ eventId: 'E43', sourceId: event.sourceIds[0],
        atMinute: next.world.clockMinutes, entryKo: '《문학 증보》 1837년 제5호 · 푸시킨 부고 첫 문단' });
    } else if (actionId === 'E43_READ_TO_SHOP') {
      for (const id of record.audienceHostIds) {
        const listener = next.hosts[id];
        listener.knownEvidenceIds ??= [];
        if (!listener.knownEvidenceIds.includes(event.sourceIds[0])) listener.knownEvidenceIds.push(event.sourceIds[0]);
        listener.relations[hostId] = '책방에서 부고를 함께 읽은 사람';
        appendLedgerEvent(next, { eventId: `E43_LISTEN_${next.ledger.length + 1}`,
          eventType: 'SOURCE_HEARD_ALOUD', catalogEventId: 'E43', date: next.world.date,
          mapId: next.world.currentMapId, hostId: id, speakerHostId: hostId, sourceId: event.sourceIds[0] });
      }
    }
    for (const id of event.actorHostIds) {
      const actor = next.hosts[id]; if (actor?.activeGoal?.taskId?.startsWith('V37:E43:')) actor.activeGoal = null;
    }
    livingEvents.push(pushkinObituaryEventRow(next, event, next.world.clockMinutes % 1440, maps,
      { actionId, ...record, changeKo: action.resultKo }));
  }
  if (questId === 'V37_BELINSKY_LETTER_1848') {
    const event = next.world.livingEventStates?.E44;
    const outcomes = { E44_KEEP_COPY_PRIVATE: 'KEPT_PRIVATE', E44_COPY_ARGUMENTS: 'ARGUMENTS_COPIED', E44_READ_TO_CIRCLE: 'READ_TO_CIRCLE' };
    const disposition = outcomes[actionId];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'READING_READY'
      || hostId !== 'bookseller_lev' || !disposition
      || !next.world.discoveredSourceIds?.includes('OBJ-BELINSKY-LETTER-GOGOL-1847')) {
      return { ok: false, reason: 'belinsky_letter_event_not_ready', state };
    }
    event.status = 'RESOLVED'; event.stage = disposition; event.disposition = disposition;
    event.resolvedAtMinute = next.world.clockMinutes; event.resolvedByHostId = hostId;
    event.resolutionActionId = actionId; event.playerChoiceActionId = actionId;
    const record = { eventId: 'E44', sourceIds: [...event.sourceIds], disposition,
      recordedByHostId: hostId, audienceHostIds: actionId === 'E44_READ_TO_CIRCLE' ? ['reader_darya', 'student_vasily'] : [],
      historicalOutcomeFixed: true, date: next.world.date, recordedAtMinute: next.world.clockMinutes };
    next.world.belinskyLetterRecords ??= []; next.world.belinskyLetterRecords.push(record);
    if (actionId === 'E44_COPY_ARGUMENTS') {
      next.hosts[hostId].readingLedger ??= [];
      next.hosts[hostId].readingLedger.push({ eventId: 'E44', sourceId: event.sourceIds[0],
        atMinute: next.world.clockMinutes, entryKo: '농노제 폐지·체벌 금지·기존 법의 엄격한 집행을 요구한 대목' });
    } else if (actionId === 'E44_READ_TO_CIRCLE') {
      for (const id of record.audienceHostIds) {
        const listener = next.hosts[id];
        listener.knownEvidenceIds ??= [];
        if (!listener.knownEvidenceIds.includes(event.sourceIds[0])) listener.knownEvidenceIds.push(event.sourceIds[0]);
        listener.relations[hostId] = '책방에서 벨린스키의 편지를 들은 사람';
        appendLedgerEvent(next, { eventId: `E44_LISTEN_${next.ledger.length + 1}`,
          eventType: 'SOURCE_HEARD_ALOUD', catalogEventId: 'E44', date: next.world.date,
          mapId: next.world.currentMapId, hostId: id, speakerHostId: hostId, sourceId: event.sourceIds[0] });
      }
    }
    for (const id of event.actorHostIds) {
      const actor = next.hosts[id]; if (actor?.activeGoal?.taskId?.startsWith('V37:E44:')) actor.activeGoal = null;
    }
    livingEvents.push(belinskyLetterEventRow(next, event, next.world.clockMinutes % 1440, maps,
      { actionId, ...record, changeKo: action.resultKo }));
  }
  if (questId === 'V37_OFFICIAL_PROCESSION_1847') {
    const event = next.world.livingEventStates?.E45;
    const dispositions = { E45_MOVE_STALL_TO_EDGE: 'STALL_MOVED_ASIDE',
      E45_CLEAR_ROUTE_OFFICIALLY: 'DUTY_BOOK_ENTRY', E45_TURN_CARRIAGE_BACK: 'CARRIAGE_REROUTED' };
    const disposition = dispositions[actionId];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'CLEARANCE_READY'
      || event.actorHostIds.includes(hostId) === false || !disposition) {
      return { ok: false, reason: 'procession_event_not_ready', state };
    }
    if ((actionId === 'E45_MOVE_STALL_TO_EDGE' && hostId !== event.vendorHostId)
      || (actionId === 'E45_CLEAR_ROUTE_OFFICIALLY' && hostId !== event.guardHostId)
      || (actionId === 'E45_TURN_CARRIAGE_BACK' && hostId !== event.coachmanHostId)) {
      return { ok: false, reason: 'procession_action_wrong_actor', state };
    }
    const vendor = next.hosts[event.vendorHostId], guard = next.hosts[event.guardHostId], coachman = next.hosts[event.coachmanHostId];
    if (actionId !== 'E45_TURN_CARRIAGE_BACK') {
      vendor.position = { x: event.scenePosition.x - 2, y: event.scenePosition.y };
      event.stallPosition = { ...vendor.position };
    }
    if (actionId === 'E45_TURN_CARRIAGE_BACK') {
      coachman.position = { x: event.scenePosition.x + 2, y: event.scenePosition.y - 1 };
      event.carriageRoute = 'SIDE_STREET';
    }
    if (actionId === 'E45_CLEAR_ROUTE_OFFICIALLY') {
      next.world.dutyRecords ??= [];
      next.world.dutyRecords.push({ eventId: 'E45', hostId, date: next.world.date,
        recordedAtMinute: next.world.clockMinutes, entryKo: '마차 통행 지시와 좌판 이동' });
    }
    event.status = 'RESOLVED'; event.stage = disposition; event.disposition = disposition;
    event.resolvedAtMinute = next.world.clockMinutes; event.resolvedByHostId = hostId; event.resolutionActionId = actionId;
    const audienceHostIds = event.actorHostIds.filter(id => id !== hostId);
    const record = { eventId: 'E45', disposition, recordedByHostId: hostId, audienceHostIds,
      date: next.world.date, recordedAtMinute: next.world.clockMinutes, historicalOutcomeFixed: false,
      officialRecord: actionId === 'E45_CLEAR_ROUTE_OFFICIALLY' };
    next.world.processionRecords ??= []; next.world.processionRecords.push(record);
    if (actionId === 'E45_CLEAR_ROUTE_OFFICIALLY') {
      guard.personalEventNotes ??= []; guard.personalEventNotes.push({ eventId: 'E45', atMinute: next.world.clockMinutes,
        noteKo: '마차 통행 지시와 좌판 이동을 근무 장부에 적었다.' });
    }
    for (const id of event.actorHostIds) {
      const actor = next.hosts[id]; if (actor?.activeGoal?.taskId?.startsWith('V37:E45:')) actor.activeGoal = null;
    }
    livingEvents.push(processionEventRow(next, event, next.world.clockMinutes % 1440, maps,
      { actionId, ...record, changeKo: action.resultKo }));
  }
  if (!literaryQuest && questId === 'V37_STREET_MUSIC_1847') {
    const event = next.world.livingEventStates?.E38, musician = event && next.hosts[event.musicianHostId], listener = next.hosts[hostId];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'PERFORMING' || !musician || !listener
      || musician.mapId !== 'nevsky' || listener.mapId !== 'nevsky'
      || !nearTile(listener.position, event.scenePosition, 5) || !nearTile(musician.position, event.scenePosition, 1)) {
      return { ok: false, reason: 'street_performance_not_present', state };
    }
    const outcomes = { E38_TIP_MUSICIAN: 'TIP_OFFERED', E38_ASK_MUSICIAN: 'ASKED_ABOUT_WORK', E38_PASS_BY: 'PASSED_BY' };
    if (!outcomes[actionId]) return { ok: false, reason: 'street_performance_action_invalid', state };
    event.stage = outcomes[actionId]; event.lastListenerHostId = listener.id; event.lastActionId = actionId;
    if (actionId === 'E38_TIP_MUSICIAN') {
      if (listener.money.amount < 1 || listener.money.unit !== musician.money.unit) return { ok: false, reason: 'street_tip_unaffordable', state };
      musician.money.amount += 1; event.playerTipHostId = listener.id; event.playerTipAmount = 1;
      musician.relations[listener.id] = '연주를 듣고 동전을 건넨 사람';
    } else if (actionId === 'E38_ASK_MUSICIAN') {
      listener.personalEventNotes ??= [];
      listener.personalEventNotes.push({ eventId: 'E38', speakerHostId: musician.id, atMinute: next.world.clockMinutes,
        noteKo: '이반은 연주로 버는 돈에서 집세와 악기 수리비를 마련한다고 말했다.' });
      musician.relations[listener.id] = '연주와 벌이를 물어본 행인';
    }
    livingEvents.push(streetMusicEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
      { playerActionId: actionId, listenerHostId: listener.id,
        ...(actionId === 'E38_TIP_MUSICIAN' ? { payerHostId: listener.id, recipientHostId: musician.id, paidAmount: 1 } : {}),
        changeKo: actionId === 'E38_TIP_MUSICIAN' ? '행인이 이반에게 동전 한 푼을 건넸다.'
          : actionId === 'E38_ASK_MUSICIAN' ? '행인이 이반에게 연주와 벌이를 물었다.' : '행인은 연주를 지나쳤다.' }));
  }
  if (questId === 'V37_FUNERAL_DEBT_REPAYMENT_1847') {
    const event = next.world.livingEventStates?.E28, debt = event?.debt;
    const amount = action.debtPaymentAmount, debtor = debt && next.hosts[debt.debtorHostId], creditor = debt && next.hosts[debt.creditorHostId];
    if (!debt || debt.status !== 'OUTSTANDING' || hostId !== debt.debtorHostId || !debtor || !creditor
      || !Number.isInteger(amount) || amount < 1 || amount > debt.remainingAmount
      || debtor.money.unit !== debt.unit || creditor.money.unit !== debt.unit || debtor.money.amount < amount
      || !action.requiredPresentHostIds?.includes(debt.creditorHostId)) return { ok: false, reason: 'funeral_debt_payment_unavailable', state };
    creditor.money.amount += amount;
    debt.amountRepaid += amount;
    debt.remainingAmount -= amount;
    debt.status = debt.remainingAmount === 0 ? 'SETTLED' : 'OUTSTANDING';
    debt.lastPaymentAtMinute = next.world.clockMinutes;
    debt.lastPaymentAmount = amount;
    if (debt.status === 'SETTLED') debt.settledAtMinute = next.world.clockMinutes;
    if (debt.remainingAmount > 0) next.quests[questId] = { status: 'open', result: action.id };
    livingEvents.push(funeralCostsEventRow(next, debt.status === 'SETTLED' ? 'FUNERAL_DEBT_REPAID' : 'FUNERAL_DEBT_PARTIAL_PAYMENT',
      next.world.clockMinutes % 1440, maps, { actionId, paidByHostId: debtor.id, paidToHostId: creditor.id,
        paidAmount: amount, remainingAmount: debt.remainingAmount,
        mapId: next.world.currentMapId, position: { ...debtor.position },
        witnessedByPlayer: playerCanObserveWorldEvent(next, next.world.currentMapId, debtor.position, 6, maps),
        changeKo: debt.remainingAmount === 0 ? '파벨이 장례비 대출을 다 갚았다' : `파벨이 장례비 빚을 ${amount}코페이카 갚았다. ${debt.remainingAmount}코페이카가 남았다` }));
  }
  for (const item of inventoryRemove) next.hosts[hostId].inventory.splice(next.hosts[hostId].inventory.indexOf(item), 1);
  next.hosts[hostId].inventory.push(...inventoryAdd);
  Object.assign(next.hosts[hostId].relations, relationEffects);
  const socialPartnerId = quest.socialChain?.partnerHostId;
  if (socialPartnerId) {
    const partner = next.hosts[socialPartnerId];
    if (!partner || socialPartnerId === hostId) return { ok: false, reason: 'invalid_social_partner', state };
    partner.relations[hostId] = effects.partnerRelationKo ?? relationEffects[hostId] ?? `${quest.socialChain.partnerNameKo ?? '이웃'}과 함께한 일`;
  }
  if (effects.situationKo && !next.hosts[hostId].situationNotes.includes(effects.situationKo)) next.hosts[hostId].situationNotes.push(effects.situationKo);
  if (healthTransition) {
    next.hosts[hostId].healthState = { condition: healthTransition.condition,
      injury: { id: 'GAVRILA_HEAVY_LOAD_SHOULDER_STRAIN', severity: healthTransition.care === 'MIDWIFE_TREATED' ? 'MILD' : 'MILD',
        onsetMinute: next.world.livingEventStates.E12.startedAtMinute, care: healthTransition.care },
      recoveryUntilMinute: next.world.clockMinutes + healthTransition.recoveryMinutes, valueStatus: 'FICTIONAL_CHARACTER_DESIGN' };
    if (healthTransition.care === 'MIDWIFE_TREATED') {
      const caregiver = next.hosts.midwife_avdotya;
      caregiver.money.amount += 2;
      next.hosts[hostId].relations.midwife_avdotya = '어깨를 치료해 준 조산사';
      caregiver.relations[hostId] = '처치를 받고 품삯을 낸 짐꾼';
    }
    if (quest.id === 'WAREHOUSE_INJURY_1847') {
      const event = next.world.livingEventStates.E12;
      event.status = 'RESOLVED';
      event.stage = healthTransition.care === 'MIDWIFE_TREATED' ? 'TREATED' : 'RESTED';
      event.resolvedAtMinute = next.world.clockMinutes;
      event.resolutionActionId = actionId;
      livingEvents.push(livingWarehouseInjuryEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
        { changeKo: healthTransition.care === 'MIDWIFE_TREATED' ? '조산사가 어깨를 살피고 처치비를 받는다' : '가브릴라가 자루를 내려놓고 쉬기로 한다',
          care: healthTransition.care, cargo: { ...event.cargo } }));
    }
  }
  if (!literaryQuest && questId === 'PAVEL_MISSING_PARCEL_1847') {
    const event = next.world.livingEventStates?.E05;
    const stages = {
      PAVEL_RECOVER_MISSING_PARCEL: ['RECOVERED_BY_COURIER', 'COURIER_CARRYING'],
      EKATERINA_ACCEPT_MISSING_PARCEL: ['ACCEPTED_BY_RECIPIENT', 'RECIPIENT_INVENTORY'],
      PAVEL_REPORT_MISSING_PARCEL: ['LOSS_REPORTED', 'UNRECOVERED_AFTER_REPORT'],
    };
    const resolution = stages[actionId];
    if (!event || event.status !== 'ACTIVE' || !resolution) return { ok: false, reason: 'living_event_not_active', state };
    [event.stage, event.itemLocation] = resolution;
    event.status = 'RESOLVED';
    event.resolvedAtMinute = next.world.clockMinutes;
    event.resolutionActionId = actionId;
    if (actionId === 'PAVEL_REPORT_MISSING_PARCEL') event.officialRecordNumber = next.ledger.length + 1;
    livingEvents.push(livingMissingParcelEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
      { changeKo: actionId === 'PAVEL_RECOVER_MISSING_PARCEL' ? '파벨이 봉투를 되찾아 다시 소지한다'
        : actionId === 'EKATERINA_ACCEPT_MISSING_PARCEL' ? '예카테리나가 봉투를 접수하고 늦은 도착을 기록한다'
          : '파벨의 분실 보고와 설명이 업무 기록에 남는다', resolutionActionId: actionId,
        ...(event.officialRecordNumber ? { officialRecordNumber: event.officialRecordNumber } : {}) }));
  }
  if (literaryQuest) {
    next.world.literaryOutcomes ??= {};
    next.world.literaryOutcomes[quest.historicalOutcome.id] = quest.historicalOutcome.value;
  } else next.world.immutableOutcomes[quest.historicalOutcome.id] = quest.historicalOutcome.value;
  if (chain) {
    next.world.lifeChains ??= {};
    const currentProgress = next.world.lifeChains[chain.id] ?? { stage: 0, metrics: {}, history: [] };
    const metrics = { ...currentProgress.metrics };
    for (const [key, delta] of Object.entries(chainDelta)) metrics[key] = Math.max(-100, Math.min(100, (metrics[key] ?? 0) + delta));
    next.world.lifeChains[chain.id] = { stage: chain.stage, metrics, history: [...currentProgress.history, { stage: chain.stage, questId, hostId, actionId, resultFlag: action.resultFlag, date: next.world.date }] };
  }
  syncPersistentPersonalGoals(next, hostId);
  if (!literaryQuest && questId === 'V37_CHARITY_DAY_1847') {
    const event = next.world.livingEventStates?.E14;
    const actions = {
      E14_BUY_FOR_SELF: { stage: 'RATION_PURCHASED', payerHostId: 'tenant_mikhail' },
      E14_ORGANIZER_SPONSORS: { stage: 'RATION_SPONSORED', payerHostId: 'yardkeeper_semyon' },
      E14_VENDOR_DONATES: { stage: 'RATION_DONATED', payerHostId: null },
    };
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'RELIEF_LINE_FORMS') return { ok: false, reason: 'living_event_not_active', state };
    if (actionId === 'E14_DECLINE_AID') {
      event.status = 'RESOLVED'; event.stage = 'AID_DECLINED'; event.resolvedAtMinute = next.world.clockMinutes;
      event.resolutionActionId = actionId; event.resolvedByHostId = hostId;
      const recipient = next.hosts[event.recipientHostId];
      recipient.needs.safetyConcern = Math.max(0, recipient.needs.safetyConcern - 2);
      recipient.needs.mealSeekingCauseEventId = 'E14';
      recipient.needs.mealSeekingCauseExpiresAtMinute = next.world.clockMinutes + 360;
      livingEvents.push(charityMealEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
        { changeKo: '미하일은 오늘은 줄에서 물러났다. 돈과 빵은 움직이지 않았고, 이 선택은 시장 좌판 곁에 있던 사람들만 안다.',
          resolvedByHostId: hostId, privacyConcernDelta: -2, resolutionActionId: actionId }));
    } else {
      const outcome = actions[actionId];
      if (!outcome) return { ok: false, reason: 'invalid_charity_action', state };
      if ((next.hosts.market_nadezhda.marketStock?.[event.itemKo] ?? 0) < 1) return { ok: false, reason: 'ration_unavailable', state };
      if (outcome.payerHostId && next.hosts[outcome.payerHostId].money.amount < event.price) return { ok: false, reason: 'insufficient_funds', state };
      if (!settleCharityRation(next, event, outcome.stage, outcome.payerHostId, next.world.clockMinutes % 1440, maps, livingEvents, actionId)) {
        return { ok: false, reason: 'ration_transaction_unavailable', state };
      }
    }
  }
  if (!literaryQuest && questId === 'V37_COLD_WAVE_FIREWOOD_1847') {
    const event = next.world.livingEventStates?.E03;
    const stageByAction = { E03_BUY_FIREWOOD: 'FIREWOOD_BOUGHT', E03_POOL_COURTYARD_FUEL: 'COURTYARD_FUEL_POOLED', E03_LEAVE_FUEL_UNBOUGHT: 'FUEL_DEFERRED' };
    const stage = stageByAction[actionId];
    if (!event || event.status !== 'ACTIVE' || !stage) return { ok: false, reason: 'living_event_not_active', state };
    event.status = 'RESOLVED'; event.stage = stage; event.resolvedAtMinute = next.world.clockMinutes;
    event.resolutionActionId = actionId; event.resolvedByHostId = hostId;
    event.tenantHostId = 'tenant_mikhail';
    const tenant = next.hosts.tenant_mikhail;
    const concernDelta = stage === 'FIREWOOD_BOUGHT' ? -8 : stage === 'COURTYARD_FUEL_POOLED' ? -5 : 4;
    tenant.needs.safetyConcern = Math.max(0, Math.min(100, tenant.needs.safetyConcern + concernDelta));
    livingEvents.push(livingColdWaveEventRow(next, stage, next.world.clockMinutes % 1440, maps,
      { actionId, resolvedByHostId: hostId, safetyConcernDelta: concernDelta,
        changeKo: stage === 'FIREWOOD_BOUGHT' ? '장작 한 단을 구매해 안뜰로 가져갈 준비를 했다'
          : stage === 'COURTYARD_FUEL_POOLED' ? '집주인과 세입자가 공동 장작 몫을 마련했다'
            : '장작 구입을 미뤘고 세입자의 추위 걱정이 커졌다' }));
  }
  if (!literaryQuest && questId === 'V37_CENSORED_PAGE_1847') {
    const event = next.world.livingEventStates?.E06;
    const outcomes = {
      E06_REMOVE_TYPE: ['TYPE_REMOVED', 'REVISED_PROOF', 'NONE', 0],
      E06_FILE_QUERY: ['QUERY_FILED', 'QUERY_PENDING', 'OFFICIAL_QUERY', 1],
      E06_KEEP_COPY: ['COPY_KEPT', 'PRIVATE_COPY_RETAINED', 'NONE', 3],
    };
    const [stage, disposition, officeRecord, risk] = outcomes[actionId] ?? [];
    if (!event || event.status !== 'ACTIVE' || !stage) return { ok: false, reason: 'living_event_not_active', state };
    event.status = 'RESOLVED'; event.stage = stage; event.resolvedAtMinute = next.world.clockMinutes;
    event.resolutionActionId = actionId; event.resolvedByHostId = hostId;
    event.proofDisposition = disposition; event.officeRecord = officeRecord; event.printerRisk = risk;
    if (actionId === 'E06_KEEP_COPY') {
      const typesetter = next.hosts[event.typesetterHostId];
      const copy = '삭제 표시가 남은 교정쇄 사본';
      if (!typesetter.inventory.includes(copy)) typesetter.inventory.push(copy);
      event.privateCopyHostId = typesetter.id;
    }
    next.world.printCensorshipState = { proofDisposition: disposition, officeRecord, printerRisk: risk,
      resolvedByHostId: hostId, resolvedAtMinute: next.world.clockMinutes };
    livingEvents.push(livingCensoredPageEventRow(next, stage, next.world.clockMinutes % 1440, maps,
      { actionId, resolvedByHostId: hostId, proofDisposition: disposition, officeRecord, printerRisk: risk,
        changeKo: actionId === 'E06_REMOVE_TYPE' ? '예카테리나는 표시된 활자를 빼고 수정 교정쇄를 넘겼다. 공식 이의 기록은 남지 않았다.'
          : actionId === 'E06_FILE_QUERY' ? '소피아는 삭제 표시의 근거를 묻는 메모를 편집부 기록에 남겼다.'
            : '니키타는 삭제 표시가 남은 교정쇄 사본을 작업복 안쪽에 숨겼다. 발견되면 작업자에게 책임이 돌아올 수 있다.' }));
  }
  if (!literaryQuest && questId === 'V37_SMUGGLED_EDITION_1847') {
    const event = next.world.livingEventStates?.E34;
    const actions = { E34_HIDE_COPY: ['booksellerHostId', 'HIDDEN_BY_BOOKSELLER', false],
      E34_COMPARE_MARKS: ['studentHostId', 'MARKS_NOTED', false],
      E34_REPORT_SHEET: ['watchmanHostId', 'TAKEN_FOR_OFFICIAL_RECORD', true] };
    const [actorKey, stage, officialRecord] = actions[actionId] ?? [];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'READING_READY' || !actorKey
      || event[actorKey] !== hostId) return { ok: false, reason: 'smuggled_edition_event_not_ready', state };
    const item = event.itemName, carrier = next.hosts[event.carrierHostId];
    if (event.itemLocation !== 'UNDER_BOOKSHOP_SHELF' || !carrier || carrier.inventory.includes(item)) {
      return { ok: false, reason: 'smuggled_edition_item_not_on_shelf', state };
    }
    const audienceHostIds = actionId === 'E34_HIDE_COPY' ? [hostId, event.carrierHostId]
      : actionId === 'E34_COMPARE_MARKS' ? [hostId, event.booksellerHostId] : [hostId, event.carrierHostId];
    if (actionId === 'E34_HIDE_COPY') {
      next.hosts[event.booksellerHostId].inventory.push(item); event.itemLocation = 'WITH_BOOKSELLER';
    } else if (actionId === 'E34_REPORT_SHEET') {
      next.hosts[event.watchmanHostId].inventory.push(item); event.itemLocation = 'WITH_WATCHMAN';
      next.world.officialBookshopReports ??= [];
      next.world.officialBookshopReports.push({ eventId: 'E34', date: next.world.date,
        filedAtMinute: next.world.clockMinutes, filedByHostId: hostId, documentItemName: item,
        reportKind: 'UNIDENTIFIED_PRINTED_SHEET_RECEIVED', historicalClaim: null });
    }
    const notes = { E34_HIDE_COPY: '레프가 책장 밑에서 나온 인쇄물을 다시 숨겼다.',
      E34_COMPARE_MARKS: '바실리가 종이의 인쇄 자국을 보았지만, 인쇄소나 인쇄자를 확인하지는 못했다.',
      E34_REPORT_SHEET: '세르게이가 정체를 확인하지 못한 인쇄물을 근무 기록과 함께 맡았다.' };
    for (const id of audienceHostIds) {
      const person = next.hosts[id]; person.personalEventNotes ??= [];
      person.personalEventNotes.push({ eventId: 'E34', atMinute: next.world.clockMinutes, noteKo: notes[actionId] });
    }
    event.status = 'RESOLVED'; event.stage = stage; event.disposition = stage;
    event.resolvedAtMinute = next.world.clockMinutes; event.resolvedByHostId = hostId; event.resolutionActionId = actionId;
    const record = { eventId: 'E34', actionId, disposition: stage, recordedByHostId: hostId,
      audienceHostIds, date: next.world.date, recordedAtMinute: next.world.clockMinutes, officialRecord,
      itemLocation: event.itemLocation, historicalOutcomeFixed: false };
    next.world.smuggledEditionRecords ??= []; next.world.smuggledEditionRecords.push(record);
    for (const id of event.actorHostIds) {
      const actor = next.hosts[id]; if (actor?.activeGoal?.taskId?.startsWith('V37:E34:')) actor.activeGoal = null;
    }
    livingEvents.push(smuggledEditionEventRow(next, event, next.world.clockMinutes % 1440, maps,
      { actionId, ...record, changeKo: action.resultKo }));
  }
  if (!literaryQuest && questId === 'V37_COURTYARD_DISPUTE_1847') {
    const event = next.world.livingEventStates?.E09;
    const outcomes = {
      E09_MEDIATE_DISPUTE: ['MEDIATED', 'NEIGHBORS_SETTLED'],
      E09_FILE_REPORT: ['REPORT_FILED', null],
      E09_DECLINE_REPORT: ['DECLINED_TO_REPORT', 'NEIGHBORS_SETTLED'],
    };
    const [stage, finalStage] = outcomes[actionId] ?? [];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'RAISED_VOICES' || !stage) return { ok: false, reason: 'living_event_not_active', state };
    event.stage = stage; event.resolutionActionId = actionId; event.resolvedByHostId = hostId;
    if (actionId === 'E09_FILE_REPORT') {
      event.reportFiled = true;
      event.officialRecordNumber = next.ledger.length + 1;
      event.resolvesAtMinute = next.world.clockMinutes + 360;
      next.world.courtyardIncidentRecords ??= [];
      next.world.courtyardIncidentRecords.push({ recordNumber: event.officialRecordNumber, eventId: 'E09', date: next.world.date,
        filedAtMinute: next.world.clockMinutes, filedByHostId: hostId, tenantHostId: event.tenantHostId,
        landlordHostId: event.landlordHostId, watchmanHostId: event.watchmanHostId,
        statementStatus: 'AWAITING_WATCHMAN', occurrenceType: event.occurrenceType });
    } else {
      event.status = 'RESOLVED'; event.stage = finalStage; event.resolvedAtMinute = next.world.clockMinutes;
      const tenant = next.hosts[event.tenantHostId];
      const delta = actionId === 'E09_MEDIATE_DISPUTE' ? -2 : 2;
      tenant.needs.safetyConcern = Math.max(0, Math.min(100, tenant.needs.safetyConcern + delta));
      event.safetyConcernDelta = delta;
    }
    livingEvents.push(livingCourtyardDisputeEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
      { changeKo: actionId === 'E09_MEDIATE_DISPUTE' ? '관리인이 두 사람의 말을 차례로 듣고, 방세 문제는 장부를 확인해 다시 이야기하기로 했다.'
        : actionId === 'E09_FILE_REPORT' ? '신고가 당직 기록에 접수됐다. 경비가 안뜰에 와서 당사자들의 말을 들을 때까지 기록은 미결 상태다.'
          : '관리인은 지금은 신고하지 않기로 했다. 방세 미납은 그대로 장부에 남는다.',
        actionId, resolvedByHostId: hostId, officialRecordNumber: event.officialRecordNumber ?? null,
        safetyConcernDelta: event.safetyConcernDelta ?? 0 }));
  }
  if (!literaryQuest && questId === 'V37_APOTHECARY_ORDER_1847') {
    const event = next.world.livingEventStates?.E16;
    if (!event || event.status !== 'ACTIVE') return { ok: false, reason: 'living_event_not_active', state };
    if (actionId === 'E16_PLACE_ORDER') {
      if (hostId !== event.buyerHostId || event.stage !== 'SHORTAGE_FOUND') return { ok: false, reason: 'living_event_stage_not_ready', state };
      event.stage = 'ORDER_PLACED'; event.orderRecorded = true; event.orderMethod = 'PRIVATE_ORDER_NOTE';
      event.orderPlacedAtMinute = next.world.clockMinutes; event.deliveryDeadlineMinute = next.world.clockMinutes + 180;
      event.resolvedByHostId = hostId; event.resolutionActionId = actionId;
      next.hosts[hostId].relations[event.supplierHostId] = '약방 물품을 주문한 거래처';
      livingEvents.push(apothecarySupplyEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
        { changeKo: '야코프가 사적인 주문 메모를 남겼다. 3코페이카는 꾸러미를 받을 때 지불하며, 아직 돈과 물건은 움직이지 않았다.', resolvedByHostId: hostId }));
    } else if (actionId === 'E16_DECLINE_ORDER') {
      if (hostId !== event.buyerHostId || event.stage !== 'SHORTAGE_FOUND') return { ok: false, reason: 'living_event_stage_not_ready', state };
      event.status = 'RESOLVED'; event.stage = 'ORDER_DECLINED'; event.resolvedAtMinute = next.world.clockMinutes;
      event.resolvedByHostId = hostId; event.resolutionActionId = actionId;
      livingEvents.push(apothecarySupplyEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
        { changeKo: '야코프는 주문을 미뤘다. 공식 장부와 사적인 주문 메모는 남지 않았고 돈과 재고도 그대로다.', resolvedByHostId: hostId }));
    } else if (actionId === 'E16_DISPATCH_SUPPLY') {
      const buyer = next.hosts[event.buyerHostId], supplier = next.hosts[event.supplierHostId];
      if (event.stage !== 'ORDER_PLACED' || hostId !== event.supplierHostId || !supplier.inventory.includes(event.itemKo)
        || !buyer || buyer.money.unit !== event.unit || buyer.money.amount < event.price) return { ok: false, reason: 'supply_or_payment_unavailable', state };
      buyer.money.amount -= event.price; supplier.money.amount += event.price;
      supplier.inventory.splice(supplier.inventory.indexOf(event.itemKo), 1);
      if (!buyer.inventory.includes(event.itemKo)) buyer.inventory.push(event.itemKo);
      buyer.relations[supplier.id] = '약방 물품 꾸러미를 공급받은 거래처';
      supplier.relations[buyer.id] = '약방 물품 꾸러미를 납품한 거래처';
      event.status = 'RESOLVED'; event.stage = 'DELIVERED'; event.resolvedAtMinute = next.world.clockMinutes;
      event.paidAmount = event.price; event.resolvedByHostId = hostId; event.resolutionActionId = actionId;
      livingEvents.push(apothecarySupplyEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
        { changeKo: '야코프가 꾸러미를 받고 3코페이카를 냈다. 공급자 소지품과 두 사람의 잔액이 바뀌었다. 건강이나 약효 상태는 바뀌지 않았다.',
          resolvedByHostId: hostId, paidAmount: event.price, itemKo: event.itemKo }));
    } else if (actionId === 'E16_WITHHOLD_SUPPLY') {
      if (event.stage !== 'ORDER_PLACED' || hostId !== event.supplierHostId) return { ok: false, reason: 'living_event_stage_not_ready', state };
      event.status = 'RESOLVED'; event.stage = 'SUPPLY_WITHHELD'; event.resolvedAtMinute = next.world.clockMinutes;
      event.resolvedByHostId = hostId; event.resolutionActionId = actionId;
      livingEvents.push(apothecarySupplyEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
        { changeKo: '표트르는 꾸러미를 내주지 않았다. 대금 거래는 없고 주문만 미결로 끝났다.', resolvedByHostId: hostId }));
    } else return { ok: false, reason: 'invalid_apothecary_supply_action', state };
  }
  if (!literaryQuest && questId === 'V37_MARKET_PRICE_DISPUTE_1847') {
    const event = next.world.livingEventStates?.E13;
    const outcomes = { E13_REFUND_SURCHARGE: 'REFUND_ISSUED', E13_ACCEPT_TRANSACTION: 'TRANSACTION_ACCEPTED', E13_FILE_PRICE_COMPLAINT: 'REPORT_FILED' };
    const stage = outcomes[actionId];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'PRICE_CHALLENGE' || !stage) return { ok: false, reason: 'living_event_not_active', state };
    const seller = next.hosts[event.sellerHostId], buyer = next.hosts[event.buyerHostId];
    if (!seller || !buyer || seller.mapId !== 'market-quay' || buyer.mapId !== 'market-quay'
      || !nearTile(seller.position, buyer.position, 3)) return { ok: false, reason: 'living_event_participants_not_present', state };
    event.stage = stage; event.resolvedByHostId = hostId; event.resolutionActionId = actionId;
    if (actionId === 'E13_REFUND_SURCHARGE') {
      if (hostId !== event.sellerHostId || event.surcharge > seller.money.amount
        || buyer.money.unit !== seller.money.unit) return { ok: false, reason: 'refund_unavailable', state };
      seller.money.amount -= event.surcharge;
      buyer.money.amount += event.surcharge;
      event.status = 'RESOLVED'; event.resolvedAtMinute = next.world.clockMinutes;
      event.refundedAmount = event.surcharge;
      seller.relations[buyer.id] = '가격 차액을 돌려준 판매자';
      buyer.relations[host.id] = '가격 차액을 돌려받은 손님';
    } else if (actionId === 'E13_ACCEPT_TRANSACTION') {
      if (hostId !== event.buyerHostId) return { ok: false, reason: 'living_event_actor_required', state };
      event.status = 'RESOLVED'; event.resolvedAtMinute = next.world.clockMinutes;
      buyer.relations[seller.id] = '가격표를 확인하고 빵을 산 손님';
      seller.relations[buyer.id] = '가격을 확인한 단골 손님';
    } else {
      if (hostId !== event.buyerHostId) return { ok: false, reason: 'living_event_actor_required', state };
      event.reportFiled = true;
      event.officialRecordNumber = next.ledger.length + 1;
      event.resolvesAtMinute = next.world.clockMinutes + 360;
      next.world.marketPriceComplaintRecords ??= [];
      next.world.marketPriceComplaintRecords.push({ recordNumber: event.officialRecordNumber, eventId: 'E13',
        date: next.world.date, filedAtMinute: next.world.clockMinutes, filedByHostId: hostId,
        sellerHostId: event.sellerHostId, buyerHostId: event.buyerHostId, watchmanHostId: event.watchmanHostId,
        pricePaid: event.pricePaid, basePrice: event.basePrice, reviewStatus: 'AWAITING_WATCHMAN',
        occurrenceType: event.occurrenceType });
      buyer.relations[seller.id] = '가격 확인을 요청한 손님';
      seller.relations[buyer.id] = '가격 확인 요청을 한 손님';
      beginMarketRumorEvent(next, next.world.clockMinutes % 1440, maps, livingEvents);
    }
    livingEvents.push(livingMarketDisputeEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
      { changeKo: actionId === 'E13_REFUND_SURCHARGE' ? '나데즈다가 조정된 게임 가격의 오른 몫을 구매자에게 돌려줬다.'
        : actionId === 'E13_ACCEPT_TRANSACTION' ? '구매자가 가격표를 확인하고 거래를 마쳤다. 공식 신고는 남기지 않았다.'
          : '구매자의 가격 확인 요청이 당직 기록에 접수됐다. 경비의 현장 확인은 도착한 뒤에만 기록된다.',
        actionId, resolvedByHostId: hostId, ...(event.refundedAmount ? { refundedAmount: event.refundedAmount } : {}),
        ...(event.officialRecordNumber ? { officialRecordNumber: event.officialRecordNumber } : {}) }));
  }
  if (!literaryQuest && questId === 'V37_NEWSPAPER_RELEASE_1847') {
    const event = next.world.livingEventStates?.E22;
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'DISCUSSION_OPEN'
      || hostId !== event.buyerHostId) return { ok: false, reason: 'living_event_stage_not_ready', state };
    const seller = next.hosts[event.sellerHostId], buyer = next.hosts[event.buyerHostId];
    if (!seller || !buyer || seller.mapId !== 'nevsky' || buyer.mapId !== 'nevsky'
      || !nearTile(seller.position, buyer.position, 3) || !buyer.inventory.includes(event.issueId)) {
      return { ok: false, reason: 'periodical_reader_not_present', state };
    }
    const heardHostIds = Object.values(next.hosts).filter(person => !event.actorHostIds.includes(person.id)
      && person.historicalAliveAndPresent !== false && person.mapId === 'nevsky'
      && nearTile(person.position, event.scenePosition, 5)).map(person => person.id).sort();
    next.world.periodicalDiscussionRecords ??= [];
    const outcomes = {
      E22_READ_ALOUD: ['READ_ALOUD', 'BIBLIOGRAPHIC_METADATA_READ_TO_NEARBY_LISTENERS'],
      E22_COMPARE_SOURCE: ['SOURCE_METADATA_COMPARED', 'BIBLIOGRAPHIC_FIELDS_CROSS_CHECKED'],
      E22_COMMENT: ['PUBLIC_COMMENT', 'FICTIONAL_READER_COMMENTED_ON_ISSUE_METADATA'],
      E22_KEEP_PRIVATE: ['PRIVATE_READING', 'PURCHASER_KEPT_COPY_PRIVATE'],
    };
    const outcome = outcomes[actionId];
    if (!outcome) return { ok: false, reason: 'host_not_authorized', state };
    if (actionId === 'E22_READ_ALOUD') event.heardHostIds = heardHostIds;
    event.status = 'RESOLVED'; event.stage = outcome[0]; event.resolvedAtMinute = next.world.clockMinutes;
    event.resolutionActionId = actionId;
    const record = { eventId: 'E22', issueId: event.issueId, sourceId: event.sourceId, buyerHostId: buyer.id,
      sellerHostId: seller.id, date: next.world.date, minute: next.world.clockMinutes,
      actionId, audienceHostIds: actionId === 'E22_READ_ALOUD' ? heardHostIds : [],
      scope: actionId === 'E22_COMPARE_SOURCE' ? 'BIBLIOGRAPHIC_METADATA_ONLY' : 'FICTIONAL_GAMEPLAY_RECONSTRUCTION' };
    next.world.periodicalDiscussionRecords.push(record);
    if (next.world.periodicalDiscussionRecords.length > 32) next.world.periodicalDiscussionRecords.shift();
    livingEvents.push(newspaperIssueEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
      { changeKo: actionId === 'E22_READ_ALOUD' ? '구매자가 자료에서 확인한 제목·연도·권호·발행인 정보를 가까운 사람에게 읽어 주었다.'
        : actionId === 'E22_COMPARE_SOURCE' ? '구매자가 잡지 본문이 아닌 서지 항목만 자료 기록과 대조했다.'
          : actionId === 'E22_COMMENT' ? '구매자와 레프가 서지 정보를 두고 의견을 나눴다.'
            : '구매자가 잡지를 다른 이에게 읽어 주지 않고 가져갔다.',
      audienceHostIds: [...record.audienceHostIds], recordScope: record.scope, resolutionActionId: actionId }));
  }
  if (!literaryQuest && questId === 'V37_MARKET_RUMOR_1847') {
    const event = next.world.livingEventStates?.E23;
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'RUMOR_ACTIVE') return { ok: false, reason: 'living_event_stage_not_ready', state };
    const carrier = next.hosts[event.carrierHostId], clerk = next.hosts[event.clerkHostId];
    if (!carrier || !clerk || carrier.mapId !== 'market-quay' || clerk.mapId !== 'market-quay'
      || !nearTile(carrier.position, clerk.position, 5)) return { ok: false, reason: 'living_event_participants_not_present', state };
    if (actionId === 'E23_CHECK_MARKET_RECORD' && hostId === event.clerkHostId) {
      const complaint = next.world.marketPriceComplaintRecords?.find(row => row.eventId === 'E13'
        && row.sellerHostId === event.sellerHostId && row.buyerHostId === next.world.livingEventStates.E13?.buyerHostId);
      if (!complaint) return { ok: false, reason: 'market_record_unavailable', state };
      event.stage = 'PRICE_CHECKED_UNVERIFIED'; event.status = 'RESOLVED'; event.resolvedAtMinute = next.world.clockMinutes;
      event.resolutionActionId = actionId; event.checkedRecordNumber = complaint.recordNumber;
      event.claimStatus = 'PRICE_ADJUSTMENT_CONFIRMED_STOCK_HIDING_UNVERIFIED';
      recordRumorHearing(next, { recipientHostId: clerk.id, fromHostId: clerk.id, status: 'CHECKED', recordNumber: complaint.recordNumber });
      recordRumorHearing(next, { recipientHostId: carrier.id, fromHostId: clerk.id, status: 'CHECKED', recordNumber: complaint.recordNumber });
      livingEvents.push(livingMarketRumorEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
        { changeKo: '알렉세이는 당직 기록에서 거래 가격 조정은 확인했지만, 재고를 숨겼다는 주장을 뒷받침하는 기록은 찾지 못했다.',
          checkedRecordNumber: complaint.recordNumber, claimStatus: event.claimStatus, resolutionActionId: actionId }));
    } else if (actionId === 'E23_REPEAT_RUMOR' && hostId === event.carrierHostId) {
      const audienceIds = rumorAudienceAtScene(next, event, maps, carrier.id);
      if (!audienceIds.length) return { ok: false, reason: 'no_audience_present', state };
      event.stage = 'FORWARDED_UNVERIFIED'; event.status = 'RESOLVED'; event.resolvedAtMinute = next.world.clockMinutes;
      event.resolutionActionId = actionId; event.rumorReachedHostIds = audienceIds;
      for (const audience of audienceIds) {
        recordRumorHearing(next, { recipientHostId: audience, fromHostId: carrier.id, status: 'UNVERIFIED' });
        next.hosts[event.carrierHostId].relations[audience] = '장터에서 확인되지 않은 가격 소문을 들려준 행상';
      }
      livingEvents.push(livingMarketRumorEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
        { changeKo: '마트료나는 확인되지 않은 말을 장터의 다른 손님에게 전했다.', rumorReachedHostIds: [...event.rumorReachedHostIds], resolutionActionId: actionId }));
    } else if (actionId === 'E23_CORRECT_RUMOR' && hostId === event.carrierHostId) {
      event.stage = 'CORRECTION_SPREAD'; event.status = 'RESOLVED'; event.resolvedAtMinute = next.world.clockMinutes;
      event.resolutionActionId = actionId;
      event.correctionReachedHostIds = rumorAudienceAtScene(next, event, maps, carrier.id);
      if (!event.correctionReachedHostIds.length) return { ok: false, reason: 'no_audience_present', state };
      recordRumorHearing(next, { recipientHostId: carrier.id, fromHostId: clerk.id, status: 'CHECKED', recordNumber: event.checkedRecordNumber });
      for (const audience of event.correctionReachedHostIds) recordRumorHearing(next,
        { recipientHostId: audience, fromHostId: carrier.id, status: 'CORRECTED', recordNumber: event.checkedRecordNumber });
      next.hosts[event.carrierHostId].relations[event.sellerHostId] = '가격 기록과 확인되지 않은 의혹을 나누어 정정한 행상';
      livingEvents.push(livingMarketRumorEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
        { changeKo: '마트료나는 가격 조정 기록과 확인되지 않은 의혹을 구분해 주변 손님에게 알렸다.',
          correctionReachedHostIds: [...event.correctionReachedHostIds], resolutionActionId: actionId }));
    } else if (actionId === 'E23_SEND_TO_PRESS' && hostId === 'editor_sofia'
      && hostId !== event.carrierHostId && hostId !== event.clerkHostId) {
      const editor = next.hosts[hostId];
      if (!editor || editor.mapId !== 'market-quay' || !nearTile(editor.position, carrier.position, 5))
        return { ok: false, reason: 'editorial_interview_not_present', state };
      const sourceId = 'V37-E23-MARKET-RUMOR';
      event.stage = 'EDITORIAL_NOTE_TAKEN'; event.status = 'RESOLVED'; event.resolvedAtMinute = next.world.clockMinutes;
      event.resolutionActionId = actionId; event.editorialNote = { sourceId, editorHostId: editor.id,
        witnessHostIds: [...new Set([carrier.id, ...event.witnessHostIds])].sort(), claimStatus: 'UNVERIFIED',
        takenAtMinute: next.world.clockMinutes };
      editor.inventory ??= [];
      if (!editor.inventory.includes('editorial-note:E23')) editor.inventory.push('editorial-note:E23');
      recordRumorHearing(next, { recipientHostId: editor.id, fromHostId: carrier.id, status: 'UNVERIFIED' });
      livingEvents.push(livingMarketRumorEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
        { changeKo: '소피야는 마트료나와 곁사람에게 들은 말을 취재 메모에 옮겼다. 소문은 확인되지 않은 채 남았다.',
          witnessHostIds: [...event.editorialNote.witnessHostIds], resolutionActionId: actionId }));
    } else if (actionId === 'E23_IGNORE_RUMOR' && [event.carrierHostId, event.clerkHostId].includes(hostId)) {
      event.stage = 'IGNORED_UNCHECKED'; event.resolutionActionId = actionId;
      event.autoResolveAtMinute = next.world.clockMinutes + 90;
      livingEvents.push(livingMarketRumorEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
        { changeKo: '알렉세이와 마트료나는 소문에 대꾸하지 않았다. 주변 사람들은 확인되지 않은 말을 계속 들을 수 있다.', resolutionActionId: actionId }));
    } else return { ok: false, reason: 'host_not_authorized', state };
  }
  if (!literaryQuest && questId === 'V37_INN_GUEST_1847') {
    const event = next.world.livingEventStates?.E17;
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'GUEST_ARRIVED') return { ok: false, reason: 'living_event_stage_not_ready', state };
    const guest = next.hosts[event.guestHostId], innkeeper = next.hosts[event.innkeeperHostId];
    if (!guest || !innkeeper || guest.mapId !== 'inn-interior' || innkeeper.mapId !== 'inn-interior'
      || !nearTile(guest.position, innkeeper.position, 3)) return { ok: false, reason: 'living_event_participants_not_present', state };
    if (actionId === 'E17_RENT_ROOM' && hostId === event.guestHostId) {
      if (!settleInnGuestStay(next, event, 'ROOM_RENTED', guest.id, event.fullRate,
        next.world.clockMinutes % 1440, maps, livingEvents, actionId)) return { ok: false, reason: 'room_unaffordable', state };
    } else if (actionId === 'E17_NEGOTIATE_RATE' && hostId === event.guestHostId) {
      if (!settleInnGuestStay(next, event, 'RATE_REDUCED', guest.id, event.reducedRate,
        next.world.clockMinutes % 1440, maps, livingEvents, actionId)) return { ok: false, reason: 'room_unaffordable', state };
    } else if (actionId === 'E17_OFFER_BED' && hostId === event.innkeeperHostId) {
      event.roomRevenueForgone = event.fullRate;
      if (!settleInnGuestStay(next, event, 'BED_OFFERED', guest.id, 0,
        next.world.clockMinutes % 1440, maps, livingEvents, actionId)) return { ok: false, reason: 'room_unavailable', state };
    } else if (actionId === 'E17_DECLINE_ROOM' && hostId === event.guestHostId) {
      event.status = 'RESOLVED'; event.stage = 'ROOM_DECLINED'; event.resolvedAtMinute = next.world.clockMinutes;
      event.resolutionActionId = actionId; guest.relations[innkeeper.id] = '여관방을 사양하고 하숙방으로 돌아간 손님';
      next.world.homewardTravelGoals ??= {};
      const home = guest.residence?.homeLocation;
      if (home?.mapId && Number.isInteger(home.position?.x) && Number.isInteger(home.position?.y)) {
        next.world.homewardTravelGoals[guest.id] = { mapId: home.mapId, position: { ...home.position }, untilMinute: next.world.clockMinutes + 180, eventId: 'E17' };
      }
      next.world.innGuestRecords ??= [];
      next.world.innGuestRecords.push({ eventId: 'E17', guestHostId: guest.id, innkeeperHostId: innkeeper.id,
        date: next.world.date, roomId: event.roomId, checkInMinute: next.world.clockMinutes, checkOutMinute: null,
        paidAmount: 0, payerHostId: null, audienceHostIds: [...event.actorHostIds], resolutionActionId: actionId,
        occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION' });
      livingEvents.push(innGuestEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
        { changeKo: '파벨은 숙박 기록을 남기지 않고 자기 하숙방으로 돌아가는 길에 올랐다.', resolutionActionId: actionId }));
    } else return { ok: false, reason: 'host_not_authorized', state };
  }
  if (!literaryQuest && questId === 'V37_LATE_MEAL_1847') {
    const event = next.world.livingEventStates?.E18;
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'MEAL_REQUESTED' || hostId !== event.buyerHostId) {
      return { ok: false, reason: 'living_event_actor_required', state };
    }
    const seller = next.hosts[event.sellerHostId], buyer = next.hosts[event.buyerHostId];
    if (!seller || !buyer || seller.mapId !== 'inn-interior' || buyer.mapId !== 'inn-interior'
      || !nearTile(seller.position, buyer.position, 4) || seller.marketStock?.[event.itemKo] < 1) {
      return { ok: false, reason: 'living_event_participants_not_present', state };
    }
    const fullMeal = actionId === 'E18_BUY_FULL_MEAL';
    const smallMeal = actionId === 'E18_BUY_SMALL_MEAL';
    if (fullMeal || smallMeal) {
      const price = smallMeal ? event.smallPortionPrice : event.price;
      if (!Number.isInteger(price) || price < 1 || buyer.money.unit !== event.unit || seller.money.unit !== event.unit || buyer.money.amount < price) {
        return { ok: false, reason: 'meal_unaffordable', state };
      }
      buyer.money.amount -= price; seller.money.amount += price; seller.marketStock[event.itemKo] -= 1;
      buyer.needs.hunger = Math.max(0, buyer.needs.hunger - (smallMeal ? event.smallHungerRelief : event.fullHungerRelief));
      buyer.needs.lastMealAtMinute = next.world.clockMinutes;
      event.paidPrice = price; event.servedPortion = smallMeal ? 'SMALL' : 'FULL';
      event.stage = smallMeal ? 'SMALL_MEAL_PAID' : 'MEAL_PAID';
    } else if (actionId === 'E18_DECLINE_MEAL') {
      event.stage = 'MEAL_DECLINED';
    } else return { ok: false, reason: 'unknown_or_closed_action', state };
    event.status = 'RESOLVED'; event.resolvedAtMinute = next.world.clockMinutes;
    event.resolutionActionId = actionId; event.resolvedByHostId = hostId;
    buyer.relations[seller.id] = fullMeal ? '저녁을 사 먹은 손님' : smallMeal ? '반 그릇을 주문한 손님' : '저녁 주문을 미룬 손님';
    seller.relations[buyer.id] = fullMeal ? '정량을 판 여관주인' : smallMeal ? '반 그릇을 판 여관주인' : '주문을 기다려 준 여관주인';
    livingEvents.push(lateMealEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
      { changeKo: fullMeal ? '손님이 정량의 수프값을 내고 저녁을 먹었다.'
        : smallMeal ? '손님은 반 그릇을 주문해 돈과 허기를 조금 아꼈다.'
          : '손님은 오늘 저녁을 사지 않고 여관을 나섰다.', actionId, resolvedByHostId: hostId,
        paidPrice: event.paidPrice ?? 0, hungerAfter: buyer.needs.hunger, remainingStock: seller.marketStock[event.itemKo] }));
  }
  if (!literaryQuest && questId === 'V37_APPRENTICE_LITERACY_1847') {
    const event = next.world.livingEventStates?.E19;
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'LESSON_READY'
      || !['E19_ASK_FOR_LESSON', 'E19_OFFER_KOPEK', 'E19_TEACH_FREE', 'E19_REQUEST_KOPEK',
        'E19_STUDENT_DECLINE', 'E19_TEACHER_POSTPONE'].includes(actionId)) return { ok: false, reason: 'living_event_not_active', state };
    const teacher = next.hosts[event.teacherHostId], student = next.hosts[event.studentHostId];
    if (!teacher || !student || [teacher, student].some(person => person.mapId !== 'printshop'
      || !nearTile(person.position, event.scenePosition, 5))) return { ok: false, reason: 'living_event_participants_not_present', state };
    if (actionId === 'E19_OFFER_KOPEK' || actionId === 'E19_REQUEST_KOPEK') {
      if (student.money.unit !== teacher.money.unit || student.money.amount < 1) return { ok: false, reason: 'lesson_unaffordable', state };
      student.money.amount -= 1; teacher.money.amount += 1;
    }
    const practiced = !['E19_STUDENT_DECLINE', 'E19_TEACHER_POSTPONE'].includes(actionId);
    event.resolvedByHostId = hostId;
    completeApprenticeLesson(next, event, practiced
      ? (['E19_OFFER_KOPEK', 'E19_REQUEST_KOPEK'].includes(actionId) ? 'LESSON_PAID' : 'LESSON_COMPLETED')
      : 'LESSON_DECLINED', next.world.clockMinutes % 1440, maps, livingEvents,
    { actionId, payerHostId: practiced && ['E19_OFFER_KOPEK', 'E19_REQUEST_KOPEK'].includes(actionId) ? student.id : null, practiced });
  }
  if (!literaryQuest && questId === 'V37_MANUSCRIPT_OFFER_1847') {
    const event = next.world.livingEventStates?.E30;
    const outcomes = {
      E30_EDITOR_BUYS_COPY: ['REVIEW_PURCHASED', 'editorHostId'],
      E30_BOOKSELLER_HOLDS_COPY: ['HELD_AT_BOOKSHOP', 'booksellerHostId'],
      E30_EDITOR_RETURNS_COPY: ['RETURNED_WITHOUT_DEAL', 'editorHostId'],
    };
    const outcome = outcomes[actionId], actors = event?.actorHostIds?.map(id => next.hosts[id]) ?? [];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'REVIEW_READY' || !outcome
      || event[outcome[1]] !== hostId || actors.some(person => !person || person.mapId !== event.venueMapId
        || !nearTile(person.position, event.scenePosition, 5))) return { ok: false, reason: 'manuscript_offer_not_ready', state };
    const author = next.hosts[event.authorHostId], bookseller = next.hosts[event.booksellerHostId], editor = next.hosts[event.editorHostId];
    if (actionId === 'E30_EDITOR_BUYS_COPY') {
      if (!author.inventory.includes(event.manuscriptItemKo) || editor.money.unit !== author.money.unit || editor.money.amount < 0) {
        return { ok: false, reason: 'manuscript_or_payment_unavailable', state };
      }
      author.inventory.splice(author.inventory.indexOf(event.manuscriptItemKo), 1);
      if (!editor.inventory.includes(event.manuscriptItemKo)) editor.inventory.push(event.manuscriptItemKo);
      author.money.amount += 2; event.manuscriptHolderHostId = editor.id; event.paymentAmount = 2;
      event.stage = outcome[0]; author.relations[editor.id] = '원고 값을 받고 편집자에게 넘긴 학생';
      editor.relations[author.id] = '원고를 값 치르고 검토하는 편집자';
    } else if (actionId === 'E30_BOOKSELLER_HOLDS_COPY') {
      if (!author.inventory.includes(event.manuscriptItemKo)) return { ok: false, reason: 'manuscript_unavailable', state };
      author.inventory.splice(author.inventory.indexOf(event.manuscriptItemKo), 1);
      if (!bookseller.inventory.includes(event.manuscriptItemKo)) bookseller.inventory.push(event.manuscriptItemKo);
      event.manuscriptHolderHostId = bookseller.id; event.stage = outcome[0];
      author.relations[bookseller.id] = '원고를 책방에 맡긴 학생';
      bookseller.relations[author.id] = '원고를 맡아 둔 책방 주인';
    } else {
      event.manuscriptHolderHostId = author.id; event.stage = outcome[0];
      author.relations[editor.id] = '원고를 돌려받은 학생';
      editor.relations[author.id] = '인쇄 약속 없이 원고를 돌려준 편집자';
    }
    event.status = 'RESOLVED'; event.resolvedAtMinute = next.world.clockMinutes;
    event.resolutionActionId = actionId; event.resolvedByHostId = hostId;
    for (const person of actors) if (person.activeGoal?.taskId?.startsWith('V37:E30:')) person.activeGoal = null;
    livingEvents.push(manuscriptOfferEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
      { actionId, resolvedByHostId: hostId, manuscriptHolderHostId: event.manuscriptHolderHostId,
        ...(event.paymentAmount ? { paidAmount: event.paymentAmount, payerHostId: editor.id, recipientHostId: author.id } : {}),
        changeKo: actionId === 'E30_EDITOR_BUYS_COPY' ? '소피아가 원고를 인수하고 바실리에게 2코페이카를 건넸다'
          : actionId === 'E30_BOOKSELLER_HOLDS_COPY' ? '레프가 원고를 책방에 맡아 두기로 했다'
            : '소피아가 인쇄 약속 없이 원고를 돌려주었다' }));
  }
  if (!literaryQuest && questId === 'V37_SERFDOM_READING_1847') {
    const event = next.world.livingEventStates?.E31;
    const outcomes = {
      E31_DEFEND_PATERNAL_DUTY: ['LANDLORD_DUTY_DISCUSSION', 'readerHostId'],
      E31_CHALLENGE_OBEDIENCE: ['OBEDIENCE_CHALLENGED', 'studentHostId'],
      E31_ASK_ABOUT_PEASANT_VOICE: ['PEASANT_VOICE_QUESTIONED', 'editorHostId'],
    };
    const [stage, requiredActorKey] = outcomes[actionId] ?? [], actors = event?.actorHostIds?.map(id => next.hosts[id]) ?? [];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'DISCUSSION_READY' || event[requiredActorKey] !== hostId
      || actors.some(person => person.mapId !== 'bookshop-interior' || !nearTile(person.position, event.scenePosition, 5))) {
      return { ok: false, reason: 'serfdom_reading_not_ready', state };
    }
    event.status = 'RESOLVED'; event.stage = stage; event.resolvedAtMinute = next.world.clockMinutes;
    event.resolutionActionId = actionId; event.resolvedByHostId = hostId;
    for (const person of actors) if (person.activeGoal?.taskId?.startsWith('V37:E31:')) person.activeGoal = null;
    livingEvents.push(serfdomReadingEventRow(next, stage, next.world.clockMinutes % 1440, maps,
      { actionId, resolvedByHostId: hostId, changeKo: action.resultKo }));
  }
  if (!literaryQuest && questId === 'V37_PHYSIOLOGY_READING_1847') {
    const event = next.world.livingEventStates?.E39;
    const outcomes = {
      E39_BUY_COPY: ['COPY_SOLD', 'studentHostId'],
      E39_COMPARE_KHORY_KALYNYCH: ['LIVES_COMPARED', 'readerHostId'],
      E39_ASK_WHO_SPEAKS: ['NARRATOR_QUESTIONED', 'studentHostId'],
    };
    const [stage, actorKey] = outcomes[actionId] ?? [], actors = event?.actorHostIds?.map(id => next.hosts[id]) ?? [];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'DISCUSSION_READY' || event[actorKey] !== hostId
      || actors.some(person => person.historicalAliveAndPresent === false || person.mapId !== 'bookshop-interior'
        || !nearTile(person.position, event.scenePosition, 5))) return { ok: false, reason: 'public_reading_not_ready', state };
    const buyer = next.hosts[event.studentHostId], bookseller = next.hosts[event.booksellerHostId];
    if (actionId === 'E39_BUY_COPY') {
      if (!buyer || buyer.money.unit !== bookseller.money.unit) return { ok: false, reason: 'copy_unaffordable', state };
      bookseller.money.amount += 2;
      event.copy.location = 'student_inventory'; event.copy.ownerHostId = buyer.id; event.copy.paidAmount = 2;
      event.stage = stage; event.buyerHostId = buyer.id; event.paymentAmount = 2;
      buyer.relations[bookseller.id] = '책 한 부를 사고 값을 치른 학생 독자';
      bookseller.relations[buyer.id] = '읽을 책을 팔고 값을 받은 손님';
    } else {
      event.copy.location = '책방 선반'; event.copy.ownerHostId = bookseller.id; event.stage = stage;
      const summaryKo = actionId === 'E39_COMPARE_KHORY_KALYNYCH'
        ? '호리와 칼리니치의 서로 다른 살림과 재주를 농노제 아래 놓인 삶으로 비교해 읽었다.'
        : '화자의 시선과 작품 속 농노들이 직접 말하는 자리를 구분해 물었다.';
      for (const person of actors) {
        person.personalEventNotes ??= [];
        person.personalEventNotes.push({ eventId: 'E39', sourceId: event.sourceId, speakerHostId: hostId,
          atMinute: next.world.clockMinutes, noteKo: summaryKo });
        if (person.id !== hostId) {
          person.relations[hostId] = actionId === 'E39_COMPARE_KHORY_KALYNYCH'
            ? '호리와 칼리니치의 삶을 함께 읽은 독자' : '작품 속 목소리를 함께 따져 본 독자';
          next.hosts[hostId].relations[person.id] ??= person.id === bookseller.id ? '읽을 자리를 내준 책방 주인' : '같은 글을 읽은 사람';
        }
      }
    }
    event.status = 'RESOLVED'; event.resolvedAtMinute = next.world.clockMinutes;
    event.resolutionActionId = actionId; event.resolvedByHostId = hostId;
    for (const person of actors) if (person.activeGoal?.taskId?.startsWith('V37:E39:')) person.activeGoal = null;
    livingEvents.push(physiologyReadingEventRow(next, stage, next.world.clockMinutes % 1440, maps,
      { actionId, resolvedByHostId: hostId,
        ...(actionId === 'E39_BUY_COPY' ? { payerHostId: buyer.id, recipientHostId: bookseller.id,
          paidAmount: 2, itemTransferredKo: event.copy.itemKo } : {}), changeKo: action.resultKo }));
  }
  if (!literaryQuest && questId === 'V37_SALON_DEBATE_1847') {
    const event = next.world.livingEventStates?.E21;
    const outcomes = {
      E21_DEFEND_EUROPEAN_METHOD: ['EUROPEAN_METHOD_DEFENDED', 'readerHostId'],
      E21_DEFEND_RUSSIAN_INSTITUTIONS: ['RUSSIAN_INSTITUTIONS_DEFENDED', 'studentHostId'],
      E21_TEST_BOTH_SIDES: ['BOTH_SIDES_TESTED', 'editorHostId'],
    };
    const [stage, requiredActorKey] = outcomes[actionId] ?? [], actors = event?.actorHostIds?.map(id => next.hosts[id]) ?? [];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'DEBATE_READY' || event[requiredActorKey] !== hostId
      || actors.some(person => person.mapId !== 'bookshop-interior' || !nearTile(person.position, event.scenePosition, 5))) {
      return { ok: false, reason: 'salon_debate_not_ready', state };
    }
    event.status = 'RESOLVED'; event.stage = stage; event.resolvedAtMinute = next.world.clockMinutes;
    event.resolutionActionId = actionId; event.resolvedByHostId = hostId;
    for (const person of actors) if (person.activeGoal?.taskId?.startsWith('V37:E21:')) person.activeGoal = null;
    livingEvents.push(salonDebateEventRow(next, stage, next.world.clockMinutes % 1440, maps,
      { actionId, resolvedByHostId: hostId, changeKo: action.resultKo }));
    startSalonInvitationEvent(next, next.world.clockMinutes % 1440, maps, livingEvents);
  }
  if (!literaryQuest && questId === 'V37_SALON_INVITATION_1847') {
    const event = next.world.livingEventStates?.E29;
    const outcomes = {
      E29_ACCEPT_INVITATION: 'INVITATION_ACCEPTED',
      E29_DECLINE_INVITATION: 'INVITATION_DECLINED',
      E29_REQUEST_SHARED_READING: 'TEXT_COPIES_REQUESTED',
    };
    const stage = outcomes[actionId], actors = event?.actorHostIds?.map(id => next.hosts[id]) ?? [];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'INVITATION_OFFERED' || !stage
      || actors.length !== 3 || actors.some(person => !person || person.historicalAliveAndPresent === false
        || person.mapId !== event.venueMapId || !nearTile(person.position, event.scenePosition, 5))) {
      return { ok: false, reason: 'salon_invitation_not_available', state };
    }
    event.status = 'RESOLVED'; event.stage = stage; event.resolvedAtMinute = next.world.clockMinutes;
    event.resolutionActionId = actionId; event.resolvedByHostId = hostId; event.invitationDisposition = stage;
    const noteKo = actionId === 'E29_ACCEPT_INVITATION' ? '소피아의 저녁 독서회 초대를 받아들였다.'
      : actionId === 'E29_DECLINE_INVITATION' ? '소피아의 저녁 독서회 초대를 사양했다.'
        : '저녁 독서회에서 서평 사본을 함께 읽자고 제안했다.';
    for (const person of actors) {
      person.personalEventNotes ??= [];
      person.personalEventNotes.push({ eventId: 'E29', sourceId: event.sourceId, speakerHostId: hostId,
        atMinute: next.world.clockMinutes, noteKo });
    }
    if (actionId === 'E29_ACCEPT_INVITATION') {
      next.world.readingCircleAccess ??= {};
      next.world.readingCircleAccess[hostId] = 'INVITED';
      next.hosts[event.inviterHostId].relations[hostId] = '저녁 독서회에 오기로 한 초대 손님';
    } else if (actionId === 'E29_DECLINE_INVITATION') {
      next.hosts[event.inviterHostId].relations[hostId] = '저녁 독서회 초대를 사양한 독자';
    } else {
      const copy = '독서회에서 함께 볼 서평 사본';
      const editor = next.hosts[event.inviterHostId];
      if (!editor.inventory.includes(copy)) editor.inventory.push(copy);
      event.copy = { itemKo: copy, ownerHostId: editor.id, location: 'bookshop_reading_table' };
      next.world.readingCircleAccess ??= {};
      next.world.readingCircleAccess[hostId] = 'SHARED_READING';
    }
    livingEvents.push(salonInvitationEventRow(next, stage, next.world.clockMinutes % 1440, maps,
      { actionId, resolvedByHostId: hostId, changeKo: action.resultKo,
        ...(event.copy ? { itemCreatedKo: event.copy.itemKo, itemOwnerHostId: event.copy.ownerHostId } : {}) }));
  }
  if (!literaryQuest && questId === 'V37_MARKET_DAY_WORK_1847') {
    const event = next.world.livingEventStates?.E32, worker = next.hosts[event?.workerHostId], employer = next.hosts[event?.employerHostId];
    const outcomes = {
      E32_HIRE_HEAVY_LOADING: ['HEAVY_LOADING_PAID', 2, 18, '상자 나르기', 'AUTO_DAY_WORK_COMPLETED'],
      E32_HIRE_LIGHT_SORTING: ['LIGHT_SORTING_PAID', 1, 7, '물건 분류', 'AUTO_DAY_WORK_COMPLETED'],
      E32_REFER_PRINTSHOP: ['PRINTSHOP_REFERRAL', 0, 0, null, 'MARKET_TO_PRINTSHOP_REFERRAL'],
      E32_LEAVE_WITHOUT_WORK: ['WORK_DECLINED', 0, 0, null, 'WORKER_DECLINED_MARKET_JOB'],
    };
    const [stage, wage, fatigue, workKind, resolutionActionId] = outcomes[actionId] ?? [];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'OFFER_READY' || !worker || !employer
      || ![worker, employer].every(person => person.historicalAliveAndPresent !== false
        && person.mapId === 'market-quay' && nearTile(person.position, event.scenePosition, 4))
      || (wage > 0 && (hostId !== employer.id || employer.money.amount < wage))) {
      return { ok: false, reason: 'market_day_work_not_ready', state };
    }
    event.status = 'RESOLVED'; event.stage = stage; event.resolvedAtMinute = next.world.clockMinutes;
    event.resolutionActionId = resolutionActionId; event.resolvedByHostId = hostId;
    event.workMinutes = wage ? action.durationMinutes : 0;
    event.workKind = workKind;
    if (wage > 0) {
      worker.money.amount += wage;
      worker.needs.fatigue = Math.min(100, worker.needs.fatigue + fatigue);
      worker.needs.incomePressure = Math.max(0, worker.needs.incomePressure - wage * 4);
      worker.lastPaidWorkAtMinute = next.world.clockMinutes;
      worker.relations[employer.id] = `${workKind}를 맡기고 품삯을 낸 좌판 주인`;
      employer.relations[worker.id] = `${workKind}를 하고 품삯을 받은 일용직 노동자`;
      worker.currentActivityKo = `${workKind}를 마치고 품삯 ${wage}코페이카를 받았다`;
      employer.currentActivityKo = `${worker.displayNameKo ?? '미하일'}에게 ${workKind} 품삯을 지급했다`;
    } else if (actionId === 'E32_REFER_PRINTSHOP') {
      worker.relations[employer.id] = '인쇄소 일자리를 소개해 준 좌판 주인';
      worker.relations.carter_roman = '나데즈다의 소개로 인쇄소 일을 알아보러 온 노동자';
      next.hosts.carter_roman.relations[worker.id] = '나데즈다에게 소개받아 일자리를 물으러 온 노동자';
      event.referredEmployerHostId = 'carter_roman';
    } else worker.relations[employer.id] = '오늘 제안된 일을 받지 않고 다른 일감을 찾으러 간 노동자';
    for (const person of [worker, employer]) if (person.activeGoal?.taskId?.startsWith('V37:E32:')) person.activeGoal = null;
    livingEvents.push(marketDayWorkEventRow(next, stage, next.world.clockMinutes % 1440, maps,
      { actionId, resolvedByHostId: hostId, wage, workKind, workMinutes: event.workMinutes,
        changeKo: action.resultKo }));
  }
  if (!literaryQuest && questId === 'STUDENT_CIRCLE_RISK_1847') {
    const event = next.world.livingEventStates?.E24;
    const outcomes = {
      STUDENT_VASILY_CHOICE_1: ['student_vasily', 'SPOKE_WITH_NAME', 'PUBLIC_NAMED_ATTENDANCE'],
      STUDENT_VASILY_CHOICE_2: ['student_vasily', 'LISTENED_UNLISTED', 'PRIVATE_UNNAMED'],
      STUDENT_VASILY_CHOICE_3: ['reader_darya', 'ROSTER_KEPT_PRIVATE', 'NO_PUBLIC_ROSTER'],
    };
    const [requiredActor, stage, attendanceRecord] = outcomes[actionId] ?? [];
    const student = next.hosts[event?.studentHostId], organizer = next.hosts[event?.organizerHostId];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'CIRCLE_READY' || hostId !== requiredActor
      || !student || !organizer || [student, organizer].some(person => person.mapId !== 'courtyard'
        || !nearTile(person.position, event.scenePosition, 4))) return { ok: false, reason: 'circle_event_not_ready', state };
    event.status = 'RESOLVED'; event.stage = stage; event.resolvedAtMinute = next.world.clockMinutes;
    event.resolutionActionId = actionId; event.resolvedByHostId = hostId; event.attendanceRecord = attendanceRecord;
    if (stage === 'SPOKE_WITH_NAME') {
      event.publicNames.push(student.id); event.publicStatementByHostId = student.id;
      student.relations[organizer.id] = '이름을 남기고 독서 모임에서 의견을 말한 학생';
      organizer.relations[student.id] = '공개 발언 순서를 내어 준 학생';
    } else if (stage === 'LISTENED_UNLISTED') {
      student.relations[organizer.id] = '이름을 남기지 않고 함께 글을 읽은 독자';
      organizer.relations[student.id] = '참석 명단 없이 책을 함께 읽은 학생';
    } else {
      event.publicNames = [];
      student.relations[organizer.id] = '공개 참석 명단을 만들지 않기로 합의한 독자';
      organizer.relations[student.id] = '이름을 공개하지 않고 의견을 나눈 학생';
    }
    if (organizer.activeGoal?.taskId === 'V37:E24:ATTEND_CIRCLE') organizer.activeGoal = null;
    livingEvents.push(studentCircleEventRow(next, stage, next.world.clockMinutes % 1440, maps,
      { actionId, resolvedByHostId: hostId, attendanceRecord, publicNames: [...event.publicNames],
        changeKo: stage === 'SPOKE_WITH_NAME' ? '바실리는 참석 장부에 이름을 쓰고 자신이 읽은 글에 대한 의견을 말했다.'
          : stage === 'LISTENED_UNLISTED' ? '바실리는 장부에 이름을 남기지 않고 토론을 들었다.'
            : '다리야는 참석자의 이름을 공개 장부에 옮기지 않고 읽을 자리를 내주었다.' }));
  }
  if (!literaryQuest && questId === 'V37_RENT_NOTICE_1847') {
    const event = next.world.livingEventStates?.E26, tenant = next.hosts.tenant_mikhail, landlord = next.hosts.landlady_polina;
    const outcomes = {
      E26_KEEP_OLD_RENT: ['RENT_HELD', '미하일은 오른 금액을 내기 어렵다고 말했다. 폴리나는 이번 납부일까지 이전 금액을 받기로 했다.'],
      E26_ACCEPT_NEW_RENT: ['INCREASE_ACCEPTED', '미하일은 다음 납부일부터 새 방세를 내기로 했다.'],
      E26_SHARE_ROOM_COST: ['ROOM_SHARE_PROPOSED', '미하일은 안나에게 방세 일부를 나눌 수 있는지 묻기로 했다.']
    };
    const outcome = outcomes[actionId];
    if (!outcome || !event || event.status !== 'ACTIVE' || event.stage !== 'NOTICE_POSTED' || hostId !== event.tenantHostId
      || !tenant || tenant.mapId !== event.venueMapId || !landlord || landlord.mapId !== event.venueMapId) {
      return { ok: false, reason: 'rent_notice_not_ready', state };
    }
    event.stage = outcome[0]; event.status = 'RESOLVED'; event.resolvedAtMinute = next.world.clockMinutes;
    event.resolvedByHostId = hostId; event.resolutionActionId = actionId;
    if (actionId === 'E26_ACCEPT_NEW_RENT') tenant.housing.amount = event.proposedRent;
    if (actionId === 'E26_SHARE_ROOM_COST') {
      tenant.housing.proposedRoomShareHostId = 'seamstress_anna';
      tenant.relations.seamstress_anna = '방세 부담을 함께할 수 있는지 물어보려는 세입자';
    }
    tenant.relations.landlady_polina = actionId === 'E26_KEEP_OLD_RENT'
      ? '이전 방세를 한 번 더 받기로 한 집주인' : actionId === 'E26_ACCEPT_NEW_RENT'
        ? '새 방세를 내기로 한 집주인' : '방세 분담 가능성을 함께 따져 본 집주인';
    landlord.relations.tenant_mikhail = actionId === 'E26_KEEP_OLD_RENT'
      ? '이전 방세를 한 번 더 받기로 한 세입자' : actionId === 'E26_ACCEPT_NEW_RENT'
        ? '새 방세를 받아들이기로 한 세입자' : '안나에게 방세 분담을 제안하려는 세입자';
    for (const id of event.actorHostIds) if (next.hosts[id]?.activeGoal?.taskId?.startsWith('V37:E26:')) next.hosts[id].activeGoal = null;
    livingEvents.push({ catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E26', stage: event.stage,
      stageIndex: 2, actorHostIds: [...event.actorHostIds], witnessHostIds: [], date: next.world.date,
      minute: next.world.clockMinutes % 1440, mapId: event.venueMapId, position: { ...event.scenePosition },
      occurrenceType: event.occurrenceType, validationStatus: event.validationStatus, valueStatus: event.valueStatus,
      state: clone(event), witnessedByPlayer: playerCanObserveWorldEvent(next, event.venueMapId, event.scenePosition, 6, maps),
      actionId, resolvedByHostId: hostId, changeKo: outcome[1] });
    beginRoofLeakRepairEvent(next, next.world.clockMinutes % 1440, maps, livingEvents);
  }
  if (!literaryQuest && questId === 'V37_ROOF_LEAK_REPAIR_1847') {
    const event = next.world.livingEventStates?.E35, landlord = next.hosts.landlady_polina, tenant = next.hosts.tenant_mikhail;
    const stages = { E35_OWNER_PAYS_REPAIR: 'OWNER_PAID', E35_SPLIT_REPAIR_COST: 'COST_SHARED', E35_DELAY_REPAIR: 'REPAIR_POSTPONED' };
    const stage = stages[actionId];
    if (!stage || event?.status !== 'ACTIVE' || event.stage !== 'REPAIR_OPTIONS_OPEN'
      || !landlord || !tenant || landlord.mapId !== 'courtyard' || tenant.mapId !== 'courtyard'
      || (actionId === 'E35_OWNER_PAYS_REPAIR' && (hostId !== landlord.id || landlord.money.amount < 4))
      || (actionId === 'E35_SPLIT_REPAIR_COST' && (hostId !== landlord.id || landlord.money.amount < 2 || tenant.money.amount < 2))) {
      return { ok: false, reason: 'roof_repair_not_ready_or_unaffordable', state };
    }
    if (actionId === 'E35_SPLIT_REPAIR_COST') { landlord.money.amount -= 2; tenant.money.amount -= 2; }
    event.status = 'RESOLVED'; event.stage = stage; event.resolvedAtMinute = next.world.clockMinutes;
    event.resolutionActionId = actionId; event.resolvedByHostId = hostId;
    event.repairStatus = actionId === 'E35_DELAY_REPAIR' ? 'LEAKING' : 'REPAIRED';
    if (actionId !== 'E35_DELAY_REPAIR') {
      tenant.housing.repairStatus = 'ROOF_REPAIRED';
      landlord.relations[tenant.id] = '수리비를 부담하고 방을 고쳐 준 집주인';
      tenant.relations[landlord.id] = actionId === 'E35_OWNER_PAYS_REPAIR' ? '수리비를 부담한 집주인' : '수리비를 함께 낸 집주인';
    } else landlord.relations[tenant.id] = '수리를 미룬 집주인';
    livingEvents.push({ catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E35', stage,
      stageIndex: 2, actorHostIds: [...event.actorHostIds], witnessHostIds: [], date: next.world.date,
      minute: next.world.clockMinutes % 1440, mapId: event.venueMapId, position: { ...event.scenePosition },
      occurrenceType: event.occurrenceType, validationStatus: event.validationStatus, valueStatus: event.valueStatus,
      state: clone(event), witnessedByPlayer: playerCanObserveWorldEvent(next, event.venueMapId, event.scenePosition, 6, maps),
      actionId, resolvedByHostId: hostId, repairStatus: event.repairStatus, changeKo: action.resultKo });
  }
  if (!literaryQuest && questId === 'V37_COURTYARD_FIRE_1847') {
    const event = next.world.livingEventStates?.E27;
    const outcomes = {
      E27_EVACUATE_RESIDENTS: ['EVACUATING', '미하일은 집주인과 짐꾼, 경비를 거리 쪽으로 이끌기 시작했다. 안뜰 문을 지나 안전한 곳까지 함께 나가야 한다.'],
      E27_RAISE_NEIGHBOR_ALARM: ['ALARM_RAISED', '종소리에 이웃들이 모여 불길을 막았고, 안뜰에는 경보 기록이 남았다.'],
      E27_REPORT_TO_WATCH: ['FIRE_REPORTED_TO_WATCH', '경비가 현장에 와 불길을 막았고 집주인이 방을 확인했다.']
    };
    const outcome = outcomes[actionId], tenant = next.hosts.tenant_mikhail;
    const guard = next.hosts[event?.guardHostId];
    if (!outcome || event?.status !== 'ACTIVE' || event.stage !== 'FIRE_REPORTED'
      || hostId !== event.tenantHostId || tenant?.mapId !== 'courtyard'
      || (actionId === 'E27_REPORT_TO_WATCH' && (!guard || guard.mapId !== 'courtyard' || !nearTile(guard.position, event.scenePosition, 4)))) {
      return { ok: false, reason: 'courtyard_fire_not_ready', state };
    }
    event.stage = outcome[0]; event.resolvedByHostId = hostId; event.resolutionActionId = actionId;
    event.propertyDamage = 0; event.witnessHostIds = event.actorHostIds.filter(id => id !== hostId);
    if (actionId === 'E27_EVACUATE_RESIDENTS') {
      event.protocolVersion = 2;
      event.status = 'ACTIVE';
      event.evacuationTargets = Object.fromEntries(event.actorHostIds.map(id => [id, clone(COURTYARD_FIRE_EVACUATION_TARGETS[id])]));
    } else {
      event.status = 'RESOLVED'; event.resolvedAtMinute = next.world.clockMinutes;
    }
    tenant.needs.safetyConcern = Math.max(0, tenant.needs.safetyConcern - 12);
    tenant.relations.landlady_polina = actionId === 'E27_REPORT_TO_WATCH'
      ? '화재를 경비에 알려 준 세입자' : '불길을 막고 이웃을 대피시킨 세입자';
    for (const id of event.actorHostIds) if (next.hosts[id]?.activeGoal?.taskId?.startsWith('V37:E27:')) next.hosts[id].activeGoal = null;
    livingEvents.push(courtyardFireEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
      { actionId, resolvedByHostId: hostId, changeKo: outcome[1], propertyDamage: 0 }));
  }
  if (!literaryQuest && questId === 'V37_FUNERAL_COSTS_1847') {
    const event = next.world.livingEventStates?.E28, organizer = next.hosts.courier_pavel, lender = next.hosts.innkeeper_irina;
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'FUNERAL_COSTS_DUE'
      || hostId !== event.organizerHostId || organizer.mapId !== event.venueMapId
      || !nearTile(organizer.position, event.scenePosition, 3)) return { ok: false, reason: 'funeral_costs_not_ready', state };
    if (actionId === 'E28_PAVEL_PAYS_COSTS') {
      event.stage = 'FUNERAL_COSTS_PAID'; event.paidByHostId = organizer.id; event.paidAmount = event.cost;
      event.status = 'RESOLVED'; event.resolutionActionId = actionId; event.resolvedAtMinute = next.world.clockMinutes;
      organizer.relations.porter_gavrila = '삼촌의 장례를 치른 조카';
    } else if (actionId === 'E28_IRINA_ADVANCES_COSTS') {
      if (lender.money.unit !== event.unit || lender.money.amount < event.cost || lender.mapId !== event.venueMapId
        || !nearTile(lender.position, event.scenePosition, 3)) return { ok: false, reason: 'funeral_loan_unavailable', state };
      lender.money.amount -= event.cost; event.stage = 'FUNERAL_COSTS_ON_CREDIT';
      event.paidByHostId = lender.id; event.paidAmount = event.cost; event.status = 'RESOLVED';
      event.resolutionActionId = actionId; event.resolvedAtMinute = next.world.clockMinutes;
      event.debt = { debtorHostId: organizer.id, creditorHostId: lender.id, amount: event.cost, unit: event.unit,
        openedAtMinute: next.world.clockMinutes, status: 'OUTSTANDING', amountRepaid: 0,
        remainingAmount: event.cost, dueAtMinute: next.world.clockMinutes + 720,
        nextPaymentAtMinute: next.world.clockMinutes + 720, causeId: 'E28_FUNERAL_COSTS' };
      organizer.relations.innkeeper_irina = '장례 비용을 외상으로 빌려 준 여관 주인';
      lender.relations.courier_pavel = '장례 비용을 갚기로 한 조카';
    } else return { ok: false, reason: 'invalid_funeral_cost_action', state };
    for (const id of event.actorHostIds) if (next.hosts[id]?.activeGoal?.taskId?.startsWith('V37:E28:')) next.hosts[id].activeGoal = null;
    livingEvents.push(funeralCostsEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
      { actionId, resolvedByHostId: hostId, paidByHostId: event.paidByHostId, paidAmount: event.paidAmount,
        debt: event.debt ?? null,
        changeKo: actionId === 'E28_PAVEL_PAYS_COSTS' ? '파벨은 가진 돈으로 삼촌의 장례 비용을 냈다'
          : '이리나는 장례 비용을 대신 내고 파벨이 갚을 돈으로 장부에 적었다' }));
  }
  if (!literaryQuest && questId === 'V37_POLICE_DOCUMENT_CHECK_1847') {
    const event = next.world.livingEventStates?.E25, officer = next.hosts.police_sergeant_ivan;
    const outcomes = {
      E25_ADD_ROUTE_TO_REGISTER: ['ROUTE_ENTERED', 'POLICE_INTAKE_REGISTER', '파벨은 배달 경로와 시각을 접수 장부에 덧붙였다.'],
      E25_ASK_SCOPE_FIRST: ['SCOPE_ASKED', 'PRIVATE_CONVERSATION', '파벨은 확인할 범위를 물었고 새 장부 항목은 남기지 않았다.'],
      E25_LEAVE_WITHOUT_ANSWER: ['LEFT_UNANSWERED', 'NONE', '파벨은 답을 미루고 접수실을 나섰다. 신고 내용은 미확인 상태로 남았다.'],
    };
    const outcome = outcomes[actionId];
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'INTERVIEW_READY' || hostId !== event.courierHostId
      || !officer || officer.mapId !== 'police-station') return { ok: false, reason: 'document_check_not_ready', state };
    [event.stage, event.recordScope] = outcome;
    event.status = 'RESOLVED'; event.resolvedAtMinute = next.world.clockMinutes;
    event.resolvedByHostId = hostId; event.resolutionActionId = actionId;
    if (actionId === 'E25_ADD_ROUTE_TO_REGISTER') event.officialRecordNumber = next.ledger.length + 1;
    next.hosts.courier_pavel.relations.police_sergeant_ivan = actionId === 'E25_ADD_ROUTE_TO_REGISTER'
      ? '배달 경로를 접수 장부에 남긴 경찰관'
      : actionId === 'E25_ASK_SCOPE_FIRST' ? '확인할 범위를 먼저 설명해 준 경찰관' : '답을 미룬 채 접수실을 나온 경찰관';
    officer.relations.courier_pavel = actionId === 'E25_ADD_ROUTE_TO_REGISTER'
      ? '경로와 시각을 장부에 덧붙인 배달부'
      : actionId === 'E25_ASK_SCOPE_FIRST' ? '확인 범위를 먼저 물은 배달부' : '확인에 답하지 않고 돌아간 배달부';
    livingEvents.push(policeDocumentCheckEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
      { actionId, resolvedByHostId: hostId, recordScope: event.recordScope,
        ...(event.officialRecordNumber ? { officialRecordNumber: event.officialRecordNumber } : {}), changeKo: outcome[2] }));
    if (host.activeGoal?.taskId?.startsWith('V37:E25:')) host.activeGoal = null;
    if (officer.activeGoal?.taskId?.startsWith('V37:E25:')) officer.activeGoal = null;
  }
  if (!literaryQuest && questId === 'V37_SICK_LODGER_1847') {
    const event = next.world.livingEventStates?.E15, patient = next.hosts.lodging_tatyana;
    const caregiver = next.hosts.midwife_avdotya;
    if (!event || event.status !== 'ACTIVE' || event.stage !== 'CARE_REQUESTED'
      || hostId !== event.patientHostId || !['E15_REQUEST_NEIGHBOR_HELP', 'E15_KEEP_PRIVATE'].includes(actionId)
      || patient.mapId !== 'inn-interior' || !nearTile(patient.position, event.scenePosition, 2)) {
      return { ok: false, reason: 'living_event_not_active', state };
    }
    if (actionId === 'E15_REQUEST_NEIGHBOR_HELP') {
      if (!caregiver || patient.money.unit !== caregiver.money.unit || patient.money.amount < 0) {
        return { ok: false, reason: 'care_visit_unaffordable', state };
      }
      caregiver.money.amount += 2; event.payerHostId = patient.id; event.carePrice = 2;
      event.stage = 'MIDWIFE_REQUESTED'; event.requestedAtMinute = next.world.clockMinutes;
      event.resolvesAtMinute = next.world.clockMinutes + 120;
      event.actorHostIds = [patient.id];
      patient.healthState.illness.care = 'MIDWIFE_VISIT_REQUESTED_GAMEPLAY';
    } else {
      event.stage = 'PRIVACY_CHOSEN'; event.resolvesAtMinute = next.world.clockMinutes + 45;
      patient.healthState.illness.care = 'PRIVATE_REST'; event.witnessHostIds = [];
    }
    event.resolutionActionId = actionId; event.resolvedByHostId = hostId;
    livingEvents.push(sickLodgerEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
      { changeKo: actionId === 'E15_KEEP_PRIVATE'
        ? '타티야나: “문은 닫아 주세요. 잠깐 혼자 누워 있을게요.”'
        : '타티야나가 아브도티야를 불러 달라며 2코페이카를 건넸다.',
      actionId, resolvedByHostId: hostId, ...(actionId === 'E15_REQUEST_NEIGHBOR_HELP'
        ? { caregiverHostId: caregiver.id, payerHostId: patient.id, paidAmount: event.carePrice } : {}) }));
  }
  if (!literaryQuest && questId === 'COACH_FARE_1847') {
    const fareStages = {
      COACHMAN_TIMOFEY_CHOICE_1: 'FARE_ACCEPTED_WITH_INSPECTION',
      COACHMAN_TIMOFEY_CHOICE_2: 'FARE_ACCEPTED_WITH_RISK_DISCLOSED',
      COACHMAN_TIMOFEY_CHOICE_3: 'FARE_DECLINED_FOR_REPAIR',
    };
    const stage = fareStages[actionId];
    if (stage) {
      const fareEvent = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E10', status: 'RESOLVED', stage,
        actorHostIds: [hostId], hostId, questId, actionId, date: next.world.date, mapId: next.world.currentMapId,
        valueStatus: 'fictional_gameplay_balance', validationStatus: 'DESIGN_SEED_NOT_VERIFIED', witnessedByPlayer: true };
      next.world.livingEventStates ??= {};
      next.world.livingEventStates.E10 = fareEvent;
      livingEvents.push(fareEvent);
    }
  }
  if (!literaryQuest && questId === 'V37_APPRENTICE_FATIGUE_1847') {
    const event = next.world.livingEventStates?.E33, student = next.hosts.print_apprentice_stepan, coworker = next.hosts.printer_ekaterina;
    if (!event || event.status !== 'ACTIVE' || !student || !coworker
      || !['E33_REST_NOW', 'E33_COWORKER_COVERS', 'E33_STOP_SHIFT', 'E33_KEEP_WORKING'].includes(actionId)) {
      return { ok: false, reason: 'living_event_not_active', state };
    }
    if (actionId === 'E33_COWORKER_COVERS') {
      const work = student.schedule.flatMap(slot => slot.workAction ? [{ ...slot.workAction, atMinute: slot.atMinute }] : [])
        .find(item => item.id === event.workActionId);
      const dayIndex = Math.floor(next.world.clockMinutes / 1440), completionKey = `${dayIndex}:${event.workActionId}`;
      const payment = work?.payroll?.amount ?? 0;
      if (!work || student.completedWorkActionKeys?.includes(completionKey)
        || !Number.isInteger(payment) || payment < 0 || coworker.money.amount < payment) return { ok: false, reason: 'cover_work_unavailable', state };
      student.workActionProgress ??= {}; delete student.workActionProgress[completionKey];
      student.completedWorkActionKeys ??= []; student.completedWorkActionKeys.push(completionKey);
      student.workRecords ??= [];
      const workRecord = { dayIndex, actionId: work.id, outputKind: work.outputKind ?? 'WORK_PRODUCT',
        outputKo: work.outputKo, completedByHostId: coworker.id, coveredForHostId: student.id,
        minute: next.world.clockMinutes % 1440, mapId: 'printshop', position: { ...coworker.position } };
      student.workRecords.push({ ...workRecord, outputKo: `${work.outputKo} · 동료가 대신 마침` });
      coworker.workRecords ??= []; coworker.workRecords.push(workRecord);
      if (typeof work.inventoryItemKo === 'string' && !coworker.inventory.includes(work.inventoryItemKo)) coworker.inventory.push(work.inventoryItemKo);
      if (payment > 0) { coworker.money.amount -= payment; student.money.amount += payment; }
      student.needs.fatigue = Math.max(0, student.needs.fatigue - 6);
      coworker.needs.fatigue = Math.min(100, coworker.needs.fatigue + 4);
      event.stage = 'WORK_COVERED'; event.workOutputTransferred = true; event.coveredByHostId = coworker.id;
      event.status = 'ACTIVE'; event.autoResolveAtMinute = next.world.clockMinutes + 25;
    } else if (actionId === 'E33_STOP_SHIFT') {
      const dayIndex = Math.floor(next.world.clockMinutes / 1440), completionKey = `${dayIndex}:${event.workActionId}`;
      student.workActionProgress ??= {}; delete student.workActionProgress[completionKey];
      student.completedWorkActionKeys ??= []; if (!student.completedWorkActionKeys.includes(completionKey)) student.completedWorkActionKeys.push(completionKey);
      student.cancelledWorkActionKeys ??= []; student.cancelledWorkActionKeys.push(completionKey);
      event.stage = 'SHIFT_STOPPED'; event.shiftStoppedByHostId = hostId; event.autoResolveAtMinute = next.world.clockMinutes + 30;
    } else if (actionId === 'E33_REST_NOW') {
      event.stage = 'REST_REQUESTED'; event.autoResolveAtMinute = next.world.clockMinutes + 30;
      event.restRequestedByHostId = hostId;
    } else {
      event.stage = 'WORK_CONTINUED'; event.status = 'RESOLVED'; event.resolvedAtMinute = next.world.clockMinutes;
      event.resolutionActionId = actionId; event.workContinuedByHostId = hostId;
      student.needs.fatigue = Math.min(100, student.needs.fatigue + 12);
      student.needs.safetyConcern = Math.min(100, student.needs.safetyConcern + 5);
    }
    event.resolutionActionId = actionId; event.resolvedByHostId = hostId;
    livingEvents.push(apprenticeFatigueEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
      { changeKo: ({ E33_REST_NOW: '스테판은 당장 쉬겠다고 말했다. 작업은 30분 동안 멈추고, 그는 손을 쉬게 했다.',
        E33_COWORKER_COVERS: '예카테리나가 스테판의 남은 작업을 맡았다. 완성된 작업물과 품삯은 기록에 나뉘어 남았다.',
        E33_STOP_SHIFT: '예카테리나는 오늘 작업을 멈췄다. 미완료 작업은 다음 순서로 넘기고 품삯은 지급되지 않았다.',
        E33_KEEP_WORKING: '스테판은 피로를 알고도 작업을 이어갔다. 피로가 더 쌓였다.' })[actionId],
        resolutionActionId: actionId, resolvedByHostId: hostId,
        ...(actionId === 'E33_COWORKER_COVERS' ? { coveredByHostId: coworker.id, coveredWorkActionId: event.workActionId,
          wageTransferred: student.schedule.find(slot => slot.workAction?.id === event.workActionId)?.workAction.payroll?.amount ?? 0 } : {}) }));
  }
  if (!literaryQuest && questId === 'V37_MISSING_RECORD_1847') {
    const event = next.world.livingEventStates?.E20;
    const resolutions = {
      E20_SEARCH_RETURNED_STACK: { stage: 'MATCHING_ENTRY_FOUND', location: '접수부 반송 서류 더미', status: 'MATCHED_TO_EXISTING_ENTRY' },
      E20_FILE_UNMATCHED: { stage: 'UNMATCHED_FILED', location: '미결 서류함', status: 'UNMATCHED_FILED' },
      E20_CROSS_REFERENCE: { stage: 'CROSS_REFERENCE_CREATED', location: '별도 대조표', status: 'CROSS_REFERENCED_COPY' },
      E20_HOLD_FOR_REVIEW: { stage: 'HELD_FOR_REVIEW', location: '상급자 검토함', status: 'PENDING_REVIEW' },
    };
    const resolution = resolutions[actionId];
    if (!event || event.status !== 'ACTIVE' || !resolution) return { ok: false, reason: 'living_event_not_active', state };
    event.stage = resolution.stage; event.resolutionActionId = actionId; event.resolvedByHostId = hostId;
    event.document.location = resolution.location; event.document.status = resolution.status;
    if (actionId === 'E20_FILE_UNMATCHED') event.officialRecordNumber = next.ledger.length + 1;
    if (actionId === 'E20_HOLD_FOR_REVIEW') {
      event.autoResolveAtMinute = next.world.clockMinutes + 60;
    } else {
      event.status = 'RESOLVED'; event.resolvedAtMinute = next.world.clockMinutes;
    }
    livingEvents.push(missingRegisterEventRow(next, event.stage, next.world.clockMinutes % 1440, maps,
      { changeKo: ({ E20_SEARCH_RETURNED_STACK: '반송 서류에서 접수부의 번호와 맞는 표지를 찾았다. 원본과 표지를 따로 보관했다.',
        E20_FILE_UNMATCHED: '번호가 맞지 않는 표지를 공식 미결 목록에 올렸다. 원본으로 확인된 문서는 없다는 점도 함께 남겼다.',
        E20_CROSS_REFERENCE: '기존 번호는 건드리지 않고, 불일치 표지를 따로 대조표에 연결했다. 사본은 원본으로 취급하지 않는다.',
        E20_HOLD_FOR_REVIEW: '표지를 상급자 검토함에 두었다. 한 시간 안에 결론이 없으면 미결 목록에 자동 기재된다.' })[actionId],
        resolutionActionId: actionId, resolvedByHostId: hostId,
        ...(event.officialRecordNumber ? { officialRecordNumber: event.officialRecordNumber } : {}) }));
  }
  const entry = { eventId: `ACTION_${next.ledger.length + 1}`, eventType: literaryQuest ? 'LITERARY_ACTION' : 'HISTORICAL_ACTION', ...(literaryQuest ? { realmId: state.world.activeRealm.id } : {}), ...(chain ? { lifeChainId: chain.id, lifeChainStage: chain.stage, lifeChainDelta: chainDelta } : {}), ...(quest.socialChain ? { socialChainId: quest.socialChain.id, socialPartnerHostId: socialPartnerId } : {}), date: next.world.date, mapId: next.world.currentMapId, hostId, questId, actionId, objectId, witnesses: [], ...(livingEvents.length ? { livingEvents } : {}), effectsApplied: { moneyDelta: effects.moneyDelta ?? 0, inventoryRemove, inventoryAdd, relations: relationEffects, ...(quest.socialChain ? { reciprocalPartnerRelationKo: effects.partnerRelationKo ?? null } : {}), situationKo: effects.situationKo ?? null }, sourceIds: action.requiredKnowledgeId ? [action.requiredKnowledgeId] : [...(quest.sourceIds ?? [])] };
  if (questId === 'V37_FUNERAL_DEBT_REPAYMENT_1847') {
    next.ledgerDigest = digestLedger(next.ledger);
    next.ledgerDigestCount = next.ledger.length;
  }
  appendLedgerEvent(next, entry, timed);
  return { ok: true, state: next };
}

function advanceChapter(state, chapterId, campaign, maps = {}) {
  const index = campaign?.arcs?.findIndex(arc => arc.id === chapterId) ?? -1;
  if (index < 0) return { ok: false, reason: 'unknown_chapter', state };
  const arc = campaign.arcs[index];
  if (state.world.chapterId === chapterId) return { ok: true, state };
  const previous = campaign.arcs[index - 1];
  if (!previous || state.world.chapterId !== previous.id || previous.questIds.some(id => state.quests?.[id]?.status !== 'resolved')) return { ok: false, reason: 'prior_chapter_incomplete', state };
  if (!maps[arc.startMapId]) return { ok: false, reason: 'chapter_map_missing', state };
  const next = clone(state);
  next.world.completedChapterIds ??= [];
  if (!next.world.completedChapterIds.includes(previous.id)) next.world.completedChapterIds.push(previous.id);
  next.world.chapterId = arc.id;
  next.world.date = arc.date;
  next.world.currentMapId = arc.startMapId;
  next.player.embodiment = null;
  next.player.position = { ...(maps[arc.startMapId].metadata?.observerStart ?? next.player.position) };
  next.ledger.push({ eventId: `CHAPTER_${next.ledger.length + 1}`, eventType: 'CHAPTER_ADVANCE', date: arc.date, chapterId: arc.id, unlockedSourceIds: [...arc.sources] });
  return { ok: true, state: next };
}

function advanceCampaignDate(state, date, campaign, quests = []) {
  const arc = campaign?.arcs?.find(item => item.id === state?.world?.chapterId);
  if (!arc || state.world.activeRealm || typeof date !== 'string' || date <= state.world.date) return { ok: false, reason: 'invalid_campaign_date', state };
  const pending = arc.questIds.find(id => state.quests?.[id]?.status !== 'resolved');
  if (!pending || state.quests[pending].status !== 'open') return { ok: false, reason: 'campaign_stage_incomplete', state };
  const pendingIndex = arc.questIds.indexOf(pending);
  if (pendingIndex === 0 || arc.questIds.slice(0, pendingIndex).some(id => state.quests?.[id]?.status !== 'resolved')) return { ok: false, reason: 'campaign_stage_incomplete', state };
  const nextQuest = quests.find(item => item.id === pending);
  if (!nextQuest || nextQuest.date !== date || nextQuest.chapterId !== arc.id) return { ok: false, reason: 'date_not_authored_for_campaign', state };
  const next = clone(state);
  next.world.date = date;
  for (const host of Object.values(next.hosts)) {
    if (!host.presenceWindow) continue;
    const present = host.presenceWindow.startDate <= date && date <= host.presenceWindow.endDate;
    host.historicalAliveAndPresent = present;
    if (present && host.presenceWindow.start) {
      host.mapId = host.presenceWindow.start.mapId;
      host.position = { ...host.presenceWindow.start.position };
    }
  }
  const fixedEvent = nextQuest.fixedEvent;
  if (fixedEvent) {
    next.world.livingEventStates ??= {};
    if (next.world.livingEventStates[fixedEvent.id]) return { ok: false, reason: 'fixed_event_already_started', state };
    const actorHostIds = [...(fixedEvent.actorHostIds ?? [])];
    if (actorHostIds.some(id => !next.hosts[id] || next.hosts[id].historicalAliveAndPresent === false)) return { ok: false, reason: 'fixed_event_actor_unavailable', state };
    const event = next.world.livingEventStates[fixedEvent.id] = {
      catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: fixedEvent.catalogEventId,
      status: 'SCHEDULED', stage: 'SCHEDULED', trigger: fixedEvent.trigger,
      startsAtMinute: fixedEvent.startsAtMinute, durationMinutes: fixedEvent.durationMinutes,
      actorHostIds, venueMapId: fixedEvent.venueMapId, scenePosition: { ...fixedEvent.scenePosition },
      outcomeSourceIds: [...fixedEvent.sourceIds], historicalOutcomeId: fixedEvent.historicalOutcomeId,
      occurrenceType: 'DOCUMENTED_HISTORICAL_EVENT', validationStatus: 'PRIMARY_SOURCE_VERIFIED',
      valueStatus: 'HISTORICAL_OUTCOME_FIXED', resolutionActionId: null, resolvedAtMinute: null,
    };
    next.ledger.push({ eventId: `WORLD_EVENT_${next.ledger.length + 1}`, eventType: 'HISTORICAL_EVENT_TRIGGER', date,
      chapterId: arc.id, questId: pending, catalogEventId: fixedEvent.catalogEventId,
      stage: event.stage, sourceIds: [...event.outcomeSourceIds], outcomeFixed: true });
  }
  next.ledger.push({ eventId: `DATE_${next.ledger.length + 1}`, eventType: 'CAMPAIGN_DATE_ADVANCE', date, chapterId: arc.id, questId: pending });
  return { ok: true, state: next };
}

function resolveEnding(state, endingId, campaign) {
  const ending = campaign?.endings?.find(item => item.id === endingId);
  if (!ending || state.endingId) return { ok: false, reason: 'unknown_or_closed_ending', state };
  if (state.learning?.phase !== 'complete' || !['passed', 'failed', 'deferred', 'helped-peer'].includes(state.learning?.examOutcome)) return { ok: false, reason: 'learning_arc_incomplete', state };
  const allQuestIds = campaign.arcs.flatMap(arc => arc.questIds);
  if (allQuestIds.some(id => state.quests?.[id]?.status !== 'resolved')) return { ok: false, reason: 'campaign_incomplete', state };
  const hostIds = new Set((state.world.possessionHistory ?? []).map(item => item.hostId).filter(id => state.hosts[id]?.kind !== 'LITERARY'));
  if (hostIds.size < 4) return { ok: false, reason: 'insufficient_perspectives', state };
  const sources = new Set(state.ledger.flatMap(item => item.sourceIds ?? (item.sourceId ? [item.sourceId] : [])));
  sources.delete(campaign.literaryRealm?.sourceId);
  if (sources.size < 3) return { ok: false, reason: 'insufficient_evidence', state };
  if (ending.requiredActions?.some(requirement => !state.ledger.some(item => typeof requirement === 'string'
    ? item.actionId === requirement
    : item.actionId === requirement.actionId && item.questId === requirement.questId))) return { ok: false, reason: 'route_evidence_missing', state };
  const next = clone(state);
  next.endingId = ending.id;
  next.ledger.push({ eventId: `ENDING_${next.ledger.length + 1}`, eventType: 'ENDING_RESOLVED', endingId: ending.id, date: next.world.date, sourceIds: [...sources] });
  return { ok: true, state: next };
}

function describeHostMoney(money) {
  if (!Number.isFinite(money?.amount)) return '개인 자금은 선택한 자료에서 확인되지 않는다.';
  const unit = money.unit === 'kopeks' ? '코페이카' : money.unit ?? '화폐 단위 미상';
  return `주머니에는 ${money.amount}${unit}가 있다.`;
}

function knowledgeForHost(state, hostId) {
  const host = state.hosts?.[hostId];
  if (!host) return [];
  return [...new Set([...host.privateKnowledgeIds, ...host.witnessedKnowledgeIds, ...host.knownEvidenceIds])];
}

function recordSourceRead(state, sourceId, maps, archiveSourceIds = [], readingMode = 'PHYSICAL_COPY') {
  const map = maps?.[state?.world?.currentMapId];
  const allSourceObjects = Object.values(maps ?? {}).flatMap(item => layer(item, 'Interactions')?.objects ?? []).filter(object => properties(object).sourceId === sourceId);
  const sourceMap = Object.values(maps ?? {}).find(item => layer(item, 'Interactions')?.objects.some(object => properties(object).sourceId === sourceId));
  const target = allSourceObjects[0];
  const inPlace = readingMode === 'PHYSICAL_COPY' && allSourceObjects.some(object => layer(map, 'Interactions')?.objects.includes(object));
  const archiveAccess = readingMode === 'PLAYER_ARCHIVE' && archiveSourceIds.includes(sourceId);
  const sourceChapter = properties(target ?? {}).availableChapterId;
  const chronology = ['V33_1847_PRINT', 'V33_1848_PUBLIC', 'V33_1849_CIRCLE'];
  const chapterAvailable = !sourceChapter || chronology.indexOf(state.world.chapterId) >= chronology.indexOf(sourceChapter);
  const literaryScope = sourceMap?.metadata?.mapClass === 'LITERARY_REALM';
  const scopeAllowed = literaryScope
    ? archiveAccess || state.world.activeRealm?.id === sourceMap.metadata.realmId
    : !state.world.activeRealm;
  const sourceDate = properties(target ?? {}).availableDate;
  const dateAvailable = !sourceDate || sourceDate <= state.world.date;
  const isHere = Boolean(target && chapterAvailable && dateAvailable && scopeAllowed && (inPlace || archiveAccess));
  if (!isHere || !sourceId) return { ok: false, reason: 'source_not_present', state };
  const timed = advanceWorldTime(state, 5, maps);
  const next = clone(timed);
  if (!next.world.discoveredSourceIds.includes(sourceId)) next.world.discoveredSourceIds.push(sourceId);
  if (!next.player.observedEvidenceIds.includes(sourceId)) next.player.observedEvidenceIds.push(sourceId);
  if (next.player.embodiment && inPlace) {
    const host = next.hosts[next.player.embodiment];
    if (host && !host.knownEvidenceIds.includes(sourceId)) host.knownEvidenceIds.push(sourceId);
  }
  appendLedgerEvent(next, { eventId: `READ_${next.ledger.length + 1}`, date: next.world.date, mapId: next.world.currentMapId, hostId: inPlace ? next.player.embodiment : null, sourceId, readingMode: inPlace ? 'PHYSICAL_COPY' : 'PLAYER_ARCHIVE' }, timed);
  return { ok: true, state: next };
}

function recordEvidenceRead(state, evidenceId, maps) {
  const map = maps?.[state?.world?.currentMapId];
  const target = layer(map, 'Interactions')?.objects.find(object => properties(object).evidenceId === evidenceId);
  const position = target && objectTile(target);
  if (!target || !nearTile(state.player.embodiment ? state.hosts[state.player.embodiment].position : state.player.position, position)) return { ok: false, reason: 'evidence_not_reachable', state };
  const timed = advanceWorldTime(state, 5, maps);
  const next = clone(timed), hostId = next.player.embodiment;
  if (!next.player.observedEvidenceIds.includes(evidenceId)) next.player.observedEvidenceIds.push(evidenceId);
  if (hostId && !next.hosts[hostId].knownEvidenceIds.includes(evidenceId)) next.hosts[hostId].knownEvidenceIds.push(evidenceId);
  const entry = { eventId: `OBSERVE_${next.ledger.length + 1}`, date: next.world.date, mapId: next.world.currentMapId, hostId, evidenceId };
  appendLedgerEvent(next, entry, timed);
  return { ok: true, state: next };
}

function recordDialogueTurn(state, { hostId, actorHostId, sceneId, intentClass = 'GENERAL_CONVERSATION', discussionId = null, discussionTitleKo = '', reflectionId = null, aiGenerated = false } = {}, maps = {}) {
  const map = maps?.[state?.world?.currentMapId], speaker = state?.hosts?.[hostId], actor = state?.hosts?.[actorHostId];
  const speakerPresent = layer(map, 'NPCs')?.objects.some(item => properties(item).hostId === hostId);
  if (!state?.player || state.player.embodiment !== actorHostId || !actor || actor.mapId !== state.world.currentMapId || !speaker || speaker.mapId !== state.world.currentMapId || !speakerPresent || typeof sceneId !== 'string' || !/^V33_[A-Z0-9_]{3,64}$/.test(sceneId)) return { ok: false, reason: 'dialogue_host_unavailable', state };
  if (hostId === actorHostId || !nearTile(actor.position, speaker.position, 2)) return { ok: false, reason: 'dialogue_partner_unavailable', state };
  if (!['SOURCE_REQUEST', 'ACTION_REQUEST', 'RISK_QUESTION', 'PERSONAL_QUESTION', 'GENERAL_CONVERSATION'].includes(intentClass)) return { ok: false, reason: 'invalid_intent_class', state };
  if (discussionId !== null && (typeof discussionId !== 'string' || !/^INQUIRY_[A-Z0-9_]{3,64}$/.test(discussionId))) return { ok: false, reason: 'invalid_discussion_id', state };
  if (reflectionId !== null && (typeof reflectionId !== 'string' || !/^INQUIRY_[A-Z0-9_]{3,64}$/.test(reflectionId))) return { ok: false, reason: 'invalid_reflection_id', state };
  if (typeof aiGenerated !== 'boolean') return { ok: false, reason: 'invalid_ai_generation_flag', state };
  const timed = advanceWorldTime(state, 1, maps, [], { pauseNpcSimulation: true, pausedHostIds: [hostId, actorHostId] });
  const next = clone(timed);
  next.player.dialogueGrowth ??= { insight: 0, aiReplies: 0, perspectiveNotes: [] };
  next.player.dialogueGrowth.perspectiveNotes ??= [];
  next.player.dialogueGrowth.comparisonNotes ??= [];
  next.player.dialogueGrowth.reflectionIds ??= [];
  if (aiGenerated) next.player.dialogueGrowth.aiReplies += 1;
  const alreadyHeardPerspective = discussionId && next.player.dialogueGrowth.perspectiveNotes.some(note => note.discussionId === discussionId && note.hostId === hostId);
  const priorPerspectiveCount = discussionId ? new Set(next.player.dialogueGrowth.perspectiveNotes.filter(note => note.discussionId === discussionId).map(note => note.hostId)).size : 0;
  // The player earns a perspective by asking the authored question and receiving
  // a response. AI generation is tracked separately and must not gate quest progress.
  const earnsInsight = Boolean(discussionId) && !alreadyHeardPerspective;
  let dialogueReward = null;
  if (earnsInsight) {
    next.player.dialogueGrowth.insight += 1;
    next.player.dialogueGrowth.perspectiveNotes.push({ discussionId, hostId, date: next.world.date });
    dialogueReward = 'PERSPECTIVE_NOTE';
    if (priorPerspectiveCount >= 1 && !next.player.dialogueGrowth.comparisonNotes.some(note => note.discussionId === discussionId)) {
      const comparisonNote = { discussionId, titleKo: String(discussionTitleKo).slice(0, 100) || '생각의 차이를 살핀 기록', hostIds: [...new Set([...next.player.dialogueGrowth.perspectiveNotes.filter(note => note.discussionId === discussionId).map(note => note.hostId), hostId])], date: next.world.date };
      next.player.dialogueGrowth.comparisonNotes.push(comparisonNote);
      dialogueReward = 'COMPARISON_NOTE';
    }
  }
  const reflectionKey = reflectionId ? `${reflectionId}::${hostId}` : null;
  if (reflectionKey && !next.player.dialogueGrowth.reflectionIds.includes(reflectionKey)) next.player.dialogueGrowth.reflectionIds.push(reflectionKey);
  const event = { eventId: `DIALOGUE_${next.ledger.length + 1}`, eventType: 'DIALOGUE_TURN', date: next.world.date, clockMinutes: next.world.clockMinutes, mapId: next.world.currentMapId, hostId, interlocutorHostId: actorHostId, sceneId, intentClass, ...(aiGenerated ? { aiGenerated: true } : {}), ...(discussionId ? { discussionId, ...(earnsInsight ? { dialogueReward } : {}) } : {}), ...(reflectionKey ? { reflectionId } : {}) };
  appendLedgerEvent(next, event, timed);
  return { ok: true, state: next };
}

function recordDiscussionPosition(state, { discussionId, positionId } = {}, definitions = {}) {
  const quest = definitions?.quests?.find(item => item.id === discussionId);
  const choice = definitions?.playerPositionChoices?.find(item => item.id === positionId);
  const growth = state?.player?.dialogueGrowth;
  if (!quest || !choice || !growth?.comparisonNotes?.some(note => note.discussionId === discussionId)) return { ok: false, reason: 'comparison_required', state };
  if ((growth.playerPositions ?? []).some(note => note.discussionId === discussionId)) return { ok: false, reason: 'position_already_recorded', state };
  const next = clone(state);
  next.player.dialogueGrowth.playerPositions ??= [];
  const record = { discussionId, positionId, titleKo: quest.titleKo, labelKo: choice.labelKo, stanceKo: choice.stanceKo, date: next.world.date };
  next.player.dialogueGrowth.playerPositions.push(record);
  const event = { eventId: `POSITION_${next.ledger.length + 1}`, eventType: 'PLAYER_DISCUSSION_POSITION', date: next.world.date, discussionId, positionId, labelKo: choice.labelKo };
  appendLedgerEvent(next, event, state);
  return { ok: true, state: next, record };
}

function hashText(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stateHash(value) { return hashText(JSON.stringify(value)); }

function nextLedgerDigest(previousDigest, entry) {
  const { nextStateHash, ...payload } = entry;
  return hashText(`${previousDigest}:${JSON.stringify(payload)}`);
}

function digestLedger(ledger) {
  return (ledger ?? []).reduce((digest, entry) => nextLedgerDigest(digest, entry), hashText('V36_LEDGER'));
}

function ensureLedgerDigest(state) {
  if (!Array.isArray(state.ledger)) state.ledger = [];
  if (state.ledgerDigestCount !== state.ledger.length || typeof state.ledgerDigest !== 'string') {
    state.ledgerDigest = digestLedger(state.ledger);
    state.ledgerDigestCount = state.ledger.length;
  }
}

function eventStateHash(state) {
  ensureLedgerDigest(state);
  const { ledger: ignoredLedger, ledgerDigest, ledgerDigestCount, ...core } = state;
  return hashText(`${stateHash(core)}:${ledgerDigest}:${ledgerDigestCount}`);
}

function appendLedgerEvent(state, entry, priorState = state) {
  ensureLedgerDigest(state);
  entry.priorStateHash = eventStateHash(priorState);
  entry.nextStateHash = null;
  state.ledger.push(entry);
  state.ledgerDigest = nextLedgerDigest(state.ledgerDigest, entry);
  state.ledgerDigestCount = state.ledger.length;
  entry.nextStateHash = eventStateHash(state);
}

function saveGame(state) {
  ensureLedgerDigest(state);
  return JSON.stringify({ saveVersion: SAVE_VERSION, checksum: stateHash(state), state });
}

function loadGame(raw, { maps, hostCards, quests = [], learningExam = null } = {}) {
  const envelope = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (![1, 2, 3, 36, SAVE_VERSION].includes(envelope?.saveVersion) || !envelope.state || envelope.checksum !== stateHash(envelope.state)) throw new Error('Invalid or corrupted V37 save');
  const state = clone(envelope.state);
  state.hosts ??= {};
  const missingHostIds = hostCards.filter(card => !state.hosts[card.id]).map(card => card.id);
  const runtimeSeed = missingHostIds.length ? createInitialState({ maps, hostCards, quests, startMapId: 'nevsky' }) : null;
  for (const card of hostCards) {
    if (!state.hosts[card.id]) {
      const addedHost = runtimeSeed.hosts?.[card.id];
      if (!addedHost) throw new Error(`Runtime host migration could not initialize ${card.id}`);
      state.hosts[card.id] = clone(addedHost);
    }
    state.hosts[card.id].eraProfile = runtimeEraProfile(card);
    state.hosts[card.id].healthState ??= { condition: 'FIT', injury: null, recoveryUntilMinute: null, valueStatus: 'FICTIONAL_CHARACTER_DESIGN' };
    state.hosts[card.id].knownRumors ??= [];
  }
  state.ledger ??= [];
  const verifiedLedgerDigest = digestLedger(state.ledger);
  if (state.ledgerDigest && state.ledgerDigest !== verifiedLedgerDigest) throw new Error('Save contains an invalid event ledger digest');
  state.ledgerDigest = verifiedLedgerDigest;
  state.ledgerDigestCount = state.ledger.length;
  state.version = SAVE_VERSION;
  state.player.gameSaveVersion = SAVE_VERSION;
  const legacyCensorshipCopy = state.world?.livingEventStates?.E06;
  if (legacyCensorshipCopy?.stage === 'COPY_KEPT' && legacyCensorshipCopy.resolutionActionId === 'E06_KEEP_COPY') {
    const copy = '삭제 표시가 남은 교정쇄 사본';
    const edition = state.world?.livingEventStates?.E34;
    const holderByLocation = { WITH_TYPESETTER: 'typesetter_nikita', WITH_BOOKSELLER: 'bookseller_lev',
      WITH_WATCHMAN: 'junior_guard_sergey' };
    const holderId = edition ? holderByLocation[edition.itemLocation] ?? null : legacyCensorshipCopy.typesetterHostId;
    for (const host of Object.values(state.hosts)) host.inventory = (host.inventory ?? []).filter(item => item !== copy || host.id === holderId);
    if (holderId && !state.hosts[holderId].inventory.includes(copy)) state.hosts[holderId].inventory.push(copy);
    legacyCensorshipCopy.privateCopyHostId = legacyCensorshipCopy.typesetterHostId;
  }
  const legacyWarehouseInjury = state.world?.livingEventStates?.E12;
  if (legacyWarehouseInjury && !legacyWarehouseInjury.severity) legacyWarehouseInjury.severity = 'MILD';
  if (legacyWarehouseInjury?.severity === 'MILD') legacyWarehouseInjury.autoResolveAtMinute ??= legacyWarehouseInjury.startedAtMinute + 31;
  if (!state.player.dialogueGrowth) {
    const legacyNotes = new Map();
    for (const entry of state.ledger ?? []) if (entry.eventType === 'DIALOGUE_TURN' && entry.discussionId && !legacyNotes.has(entry.discussionId)) legacyNotes.set(entry.discussionId, { discussionId: entry.discussionId, hostId: entry.hostId, date: entry.date });
    const perspectiveNotes = [...legacyNotes.values()];
    state.player.dialogueGrowth = { insight: perspectiveNotes.length, aiReplies: (state.ledger ?? []).filter(entry => entry.eventType === 'DIALOGUE_TURN' && entry.aiGenerated).length, perspectiveNotes, comparisonNotes: [], reflectionIds: [] };
  }
  state.player.dialogueGrowth.perspectiveNotes ??= [];
  state.player.dialogueGrowth.comparisonNotes ??= [];
  state.player.dialogueGrowth.reflectionIds ??= [];
  state.player.dialogueGrowth.playerPositions ??= [];
  state.player.civic ??= { suspicion: 0, custody: null, publishedIssues: [], readIssueIds: [], circulatedIssues: [] };
  state.player.civic.suspicion ??= 0;
  state.player.civic.publishedIssues ??= [];
  state.player.civic.readIssueIds ??= [];
  state.player.civic.circulatedIssues ??= [];
  if (!Number.isInteger(state.player.civic.suspicion) || state.player.civic.suspicion < 0 || state.player.civic.suspicion > 3 || !Array.isArray(state.player.civic.publishedIssues) || !Array.isArray(state.player.civic.readIssueIds) || !Array.isArray(state.player.civic.circulatedIssues) || (state.player.civic.custody !== null && (typeof state.player.civic.custody !== 'object' || typeof state.player.civic.custody.active !== 'boolean' || !hostCards.some(card => card.id === state.player.civic.custody.hostId)))) throw new Error('Save contains invalid civic state');
  if (!Number.isSafeInteger(state.player.dialogueGrowth.insight) || state.player.dialogueGrowth.insight < 0 || !Number.isSafeInteger(state.player.dialogueGrowth.aiReplies) || state.player.dialogueGrowth.aiReplies < 0 || !Array.isArray(state.player.dialogueGrowth.perspectiveNotes) || !Array.isArray(state.player.dialogueGrowth.comparisonNotes) || !Array.isArray(state.player.dialogueGrowth.reflectionIds)) throw new Error('Save contains invalid dialogue growth');
  state.learning ??= initialLearningState();
  state.learning.examAnswers ??= {};
  state.learning.examOutcome ??= 'unset';
  state.learning.examCorrectCount ??= null;
  state.learning.promotionStatus ??= state.learning.examOutcome === 'passed' ? 'promoted' : state.learning.examOutcome === 'failed' ? 'not-promoted' : 'pending';
  state.learning.timelineIndex ??= 0;
  if (!['circle-choice', 'learning', 'public-prep', 'exam-choice', 'exam', 'result', 'complete'].includes(state.learning.phase)) throw new Error('Save contains an invalid learning phase');
  if (!['unset', 'passed', 'failed', 'deferred', 'helped-peer'].includes(state.learning.examOutcome)) throw new Error('Save contains an invalid exam outcome');
  if (state.learning.circleLearning !== null && !['attended', 'attended-notes', 'declined'].includes(state.learning.circleLearning)) throw new Error('Save contains an invalid circle choice');
  if (state.learning.phase !== 'circle-choice' && !state.learning.circleLearning) throw new Error('Save skipped the circle choice');
  if (!state.learning.examAnswers || typeof state.learning.examAnswers !== 'object' || Array.isArray(state.learning.examAnswers)) throw new Error('Save contains invalid exam answers');
  if (!Number.isInteger(state.learning.timelineIndex) || state.learning.timelineIndex < 0 || state.learning.timelineIndex > 6) throw new Error('Save contains an invalid life timeline position');
  if (state.learning.examCorrectCount !== null && (!Number.isInteger(state.learning.examCorrectCount) || state.learning.examCorrectCount < 0 || state.learning.examCorrectCount > 5)) throw new Error('Save contains an invalid exam score');
  const promotion = state.learning.examOutcome === 'passed' ? 'promoted' : state.learning.examOutcome === 'failed' ? 'not-promoted' : 'pending';
  if (state.learning.promotionStatus !== promotion) throw new Error('Save contains an inconsistent promotion result');
  if (['passed', 'failed', 'deferred', 'helped-peer'].includes(state.learning.examOutcome) && !['result', 'complete'].includes(state.learning.phase)) throw new Error('Save contains a premature exam outcome');
  if (['deferred', 'helped-peer'].includes(state.learning.examOutcome) && (state.learning.examCorrectCount !== null || Object.keys(state.learning.examAnswers).length)) throw new Error('Unscored exam action contains answers or a score');
  if (state.learning.examOutcome === 'passed' && state.learning.examCorrectCount < 3) throw new Error('Passing result is below the published threshold');
  if (state.learning.examOutcome === 'failed' && state.learning.examCorrectCount >= 3) throw new Error('Failing result meets the published threshold');
  if (learningExam) for (const [questionId, optionId] of Object.entries(state.learning.examAnswers)) {
    const question = learningExam.questions.find(item => item.id === questionId);
    if (!question?.options.some(option => option.id === optionId)) throw new Error('Save contains an unknown exam answer');
  }
  state.world.clockMinutes ??= 540;
  state.world.immutableOutcomes ??= {};
  state.world.literaryOutcomes ??= {};
  state.world.marketPriceModifiers ??= {};
  state.world.livingEventStates ??= {};
  state.world.rumorPropagationLog ??= [];
  state.world.foodAidRecords ??= [];
  for (const row of state.world.foodAidRecords) if (!row.debt) {
    const offer = hostCards.flatMap(card => card.marketOffers ?? []).find(item => item.category === 'food' && item.itemKo === row.itemKo);
    row.debt = { status: 'GIFT', amountDue: 0, amountRepaid: 0, unit: offer?.unit ?? 'unknown' };
  }
  const legacyFuneralDebt = state.world.livingEventStates.E28?.debt;
  if (legacyFuneralDebt) {
    legacyFuneralDebt.amountRepaid ??= 0;
    legacyFuneralDebt.remainingAmount ??= legacyFuneralDebt.amount - legacyFuneralDebt.amountRepaid;
    legacyFuneralDebt.dueAtMinute ??= legacyFuneralDebt.openedAtMinute + 720;
    legacyFuneralDebt.nextPaymentAtMinute ??= legacyFuneralDebt.dueAtMinute;
  }
  if (state.world.livingEventStates.E02?.catalogEventId === 'E02') state.world.livingEventStates.E02.catalogIdSpace ??= 'V37_EVENT_CATALOG_45';
  if (!state.world.marketPriceModifiers || typeof state.world.marketPriceModifiers !== 'object' || Array.isArray(state.world.marketPriceModifiers)
    || Object.entries(state.world.marketPriceModifiers).some(([key, value]) => !/^[a-z0-9_]+:.+$/.test(key) || !Number.isInteger(value) || value < 0 || value > 100)) {
    throw new Error('Save contains invalid market price modifiers');
  }
  if (!state.world.livingEventStates || typeof state.world.livingEventStates !== 'object' || Array.isArray(state.world.livingEventStates)) {
    throw new Error('Save contains invalid living event state');
  }
  const breadEvent = state.world.livingEventStates.E02;
  const rentEvent = state.world.livingEventStates.E01;
  const coldWaveEvent = state.world.livingEventStates.E03;
  const missingParcelEvent = state.world.livingEventStates.E05;
  const courtyardDisputeEvent = state.world.livingEventStates.E09;
  const courtyardRecords = state.world.courtyardIncidentRecords ?? [];
  if (!Array.isArray(courtyardRecords) || courtyardRecords.some(record => !Number.isInteger(record.recordNumber)
    || record.eventId !== 'E09' || !['AWAITING_WATCHMAN', 'STATEMENT_HEARD', 'NO_VISIT_WITHIN_RESPONSE_WINDOW'].includes(record.statementStatus)
    || record.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || !state.hosts[record.filedByHostId] || !state.hosts[record.tenantHostId] || !state.hosts[record.landlordHostId]
    || !Number.isInteger(record.filedAtMinute))) throw new Error('Save contains invalid E09 courtyard incident record');
  if (courtyardDisputeEvent && (courtyardDisputeEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || courtyardDisputeEvent.catalogEventId !== 'E09'
    || !['ACTIVE', 'RESOLVED'].includes(courtyardDisputeEvent.status)
    || !['RAISED_VOICES', 'MEDIATED', 'REPORT_FILED', 'DECLINED_TO_REPORT', 'NEIGHBORS_SETTLED', 'WATCHMAN_HEARD_STATEMENT', 'REPORT_REGISTERED_NO_VISIT'].includes(courtyardDisputeEvent.stage)
    || courtyardDisputeEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED'
    || courtyardDisputeEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || courtyardDisputeEvent.trigger !== 'noise_or_theft'
    || courtyardDisputeEvent.triggerMechanism !== 'rent_arrears_dispute_audible_in_shared_courtyard'
    || courtyardDisputeEvent.sourceCatalogEventId !== 'E01'
    || !Array.isArray(courtyardDisputeEvent.actorHostIds) || courtyardDisputeEvent.actorHostIds.join(',') !== 'yardkeeper_semyon,tenant_mikhail,landlady_polina'
    || courtyardDisputeEvent.yardkeeperHostId !== 'yardkeeper_semyon' || courtyardDisputeEvent.tenantHostId !== 'tenant_mikhail'
    || courtyardDisputeEvent.landlordHostId !== 'landlady_polina' || courtyardDisputeEvent.watchmanHostId !== 'junior_guard_sergey'
    || !Array.isArray(courtyardDisputeEvent.witnessHostIds) || courtyardDisputeEvent.witnessHostIds.some(id => !state.hosts[id])
    || !Number.isInteger(courtyardDisputeEvent.startedAtMinute) || !Number.isInteger(courtyardDisputeEvent.resolvesAtMinute)
    || courtyardDisputeEvent.resolvesAtMinute < courtyardDisputeEvent.startedAtMinute
    || (courtyardDisputeEvent.status === 'ACTIVE') !== ['RAISED_VOICES', 'REPORT_FILED'].includes(courtyardDisputeEvent.stage)
    || ['REPORT_FILED', 'WATCHMAN_HEARD_STATEMENT', 'REPORT_REGISTERED_NO_VISIT'].includes(courtyardDisputeEvent.stage) !== (courtyardDisputeEvent.reportFiled === true)
    || (courtyardDisputeEvent.reportFiled && (!Number.isInteger(courtyardDisputeEvent.officialRecordNumber)
      || !courtyardRecords.some(record => record.recordNumber === courtyardDisputeEvent.officialRecordNumber)))
    || (courtyardDisputeEvent.status === 'RESOLVED' && (!Number.isInteger(courtyardDisputeEvent.resolvedAtMinute)
      || !['E09_MEDIATE_DISPUTE', 'E09_FILE_REPORT', 'E09_DECLINE_REPORT', 'AUTO_NEIGHBORS_SETTLED'].includes(courtyardDisputeEvent.resolutionActionId))))) {
    throw new Error('Save contains invalid E09 courtyard dispute event state');
  }
  const marketDisputeEvent = state.world.livingEventStates.E13;
  const marketComplaintRecords = state.world.marketPriceComplaintRecords ?? [];
  if (!Array.isArray(marketComplaintRecords) || marketComplaintRecords.some(record => !Number.isInteger(record.recordNumber)
    || record.eventId !== 'E13' || !['AWAITING_WATCHMAN', 'WATCHMAN_HEARD_PARTIES', 'NO_VISIT_WITHIN_RESPONSE_WINDOW'].includes(record.reviewStatus)
    || record.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || !state.hosts[record.filedByHostId] || !state.hosts[record.sellerHostId] || !state.hosts[record.buyerHostId]
    || !Number.isInteger(record.filedAtMinute) || !Number.isInteger(record.pricePaid) || !Number.isInteger(record.basePrice)
    || record.pricePaid <= record.basePrice)) throw new Error('Save contains invalid E13 market complaint record');
  if (marketDisputeEvent && (marketDisputeEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || marketDisputeEvent.catalogEventId !== 'E13'
    || !['ACTIVE', 'RESOLVED'].includes(marketDisputeEvent.status)
    || !['PRICE_CHALLENGE', 'REFUND_ISSUED', 'TRANSACTION_ACCEPTED', 'REPORT_FILED', 'WATCHMAN_REVIEWED', 'REPORT_NO_VISIT', 'PRICE_STANDS'].includes(marketDisputeEvent.stage)
    || marketDisputeEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED'
    || marketDisputeEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || marketDisputeEvent.valueStatus !== 'fictional_gameplay_balance'
    || marketDisputeEvent.trigger !== 'supply_shock'
    || marketDisputeEvent.triggerMechanism !== 'adjusted_price_paid_after_documented_game_stockout'
    || marketDisputeEvent.sourceCatalogEventId !== 'E02'
    || !['market_nadezhda'].includes(marketDisputeEvent.sellerHostId)
    || !state.hosts[marketDisputeEvent.buyerHostId] || marketDisputeEvent.sellerHostId === marketDisputeEvent.buyerHostId
    || marketDisputeEvent.watchmanHostId !== 'junior_guard_sergey'
    || !Array.isArray(marketDisputeEvent.actorHostIds)
    || marketDisputeEvent.actorHostIds.join(',') !== `${marketDisputeEvent.sellerHostId},${marketDisputeEvent.buyerHostId}`
    || !Array.isArray(marketDisputeEvent.witnessHostIds) || marketDisputeEvent.witnessHostIds.some(id => !state.hosts[id])
    || marketDisputeEvent.itemKo !== '빵 한 묶음' || !Number.isInteger(marketDisputeEvent.basePrice)
    || !Number.isInteger(marketDisputeEvent.pricePaid) || marketDisputeEvent.pricePaid <= marketDisputeEvent.basePrice
    || marketDisputeEvent.surcharge !== marketDisputeEvent.pricePaid - marketDisputeEvent.basePrice
    || !Number.isInteger(marketDisputeEvent.startedAtMinute) || !Number.isInteger(marketDisputeEvent.resolvesAtMinute)
    || marketDisputeEvent.resolvesAtMinute < marketDisputeEvent.startedAtMinute
    || marketDisputeEvent.resolvesAtMinute > marketDisputeEvent.startedAtMinute + 600
    || (marketDisputeEvent.status === 'ACTIVE') !== ['PRICE_CHALLENGE', 'REPORT_FILED'].includes(marketDisputeEvent.stage)
    || ['REPORT_FILED', 'WATCHMAN_REVIEWED', 'REPORT_NO_VISIT'].includes(marketDisputeEvent.stage) !== (marketDisputeEvent.reportFiled === true)
    || (marketDisputeEvent.reportFiled && (!Number.isInteger(marketDisputeEvent.officialRecordNumber)
      || !marketComplaintRecords.some(record => record.recordNumber === marketDisputeEvent.officialRecordNumber)))
    || (marketDisputeEvent.status === 'RESOLVED' && (!Number.isInteger(marketDisputeEvent.resolvedAtMinute)
      || !['E13_REFUND_SURCHARGE', 'E13_ACCEPT_TRANSACTION', 'E13_FILE_PRICE_COMPLAINT', 'AUTO_PRICE_STANDS'].includes(marketDisputeEvent.resolutionActionId))))) {
    throw new Error('Save contains invalid E13 market price dispute state');
  }
  const newspaperIssueEvent = state.world.livingEventStates.E22;
  const newspaperStages = ['ISSUE_SOLD', 'DISCUSSION_OPEN', 'READ_ALOUD', 'SOURCE_METADATA_COMPARED', 'PUBLIC_COMMENT', 'PRIVATE_READING', 'AUTO_CLOSED'];
  const newspaperActions = ['E22_READ_ALOUD', 'E22_COMPARE_SOURCE', 'E22_COMMENT', 'E22_KEEP_PRIVATE', 'AUTO_ISSUE_LEFT_UNREAD'];
  if (newspaperIssueEvent && (newspaperIssueEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45'
    || newspaperIssueEvent.catalogEventId !== 'E22' || !['ACTIVE', 'RESOLVED'].includes(newspaperIssueEvent.status)
    || !newspaperStages.includes(newspaperIssueEvent.stage)
    || newspaperIssueEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED'
    || newspaperIssueEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || newspaperIssueEvent.valueStatus !== 'fictional_gameplay_balance'
    || newspaperIssueEvent.trigger !== 'verified_1847_periodical_copy_sold_at_nevsky_counter'
    || newspaperIssueEvent.sourceId !== 'OBJ-SOV-1847' || newspaperIssueEvent.sourceKind !== 'PRIMARY_BIBLIOGRAPHIC_RECORD'
    || newspaperIssueEvent.sourceUrl !== 'https://rusneb.ru/catalog/000199_000009_007828983/'
    || newspaperIssueEvent.issueId !== 'newspaper_1847_01' || newspaperIssueEvent.sellerHostId !== 'bookseller_lev'
    || newspaperIssueEvent.buyerHostId === 'bookseller_lev' || !state.hosts[newspaperIssueEvent.buyerHostId]
    || !Array.isArray(newspaperIssueEvent.actorHostIds)
    || newspaperIssueEvent.actorHostIds.join(',') !== `bookseller_lev,${newspaperIssueEvent.buyerHostId}`
    || !Array.isArray(newspaperIssueEvent.witnessHostIds) || newspaperIssueEvent.witnessHostIds.some(id => !state.hosts[id])
    || !Number.isInteger(newspaperIssueEvent.startedAtMinute) || !Number.isInteger(newspaperIssueEvent.autoResolveAtMinute)
    || newspaperIssueEvent.autoResolveAtMinute !== newspaperIssueEvent.startedAtMinute + 60
    || !Number.isInteger(newspaperIssueEvent.scenePosition?.x) || !Number.isInteger(newspaperIssueEvent.scenePosition?.y)
    || newspaperIssueEvent.scenePosition.mapId !== undefined
    || newspaperIssueEvent.paidAmount !== 4 || newspaperIssueEvent.currency !== 'kopeks'
    || (newspaperIssueEvent.status === 'ACTIVE') !== ['ISSUE_SOLD', 'DISCUSSION_OPEN'].includes(newspaperIssueEvent.stage)
    || (newspaperIssueEvent.stage === 'DISCUSSION_OPEN' && !Number.isInteger(newspaperIssueEvent.gatheredAtMinute))
    || (newspaperIssueEvent.status === 'RESOLVED' && (!Number.isInteger(newspaperIssueEvent.resolvedAtMinute)
      || !newspaperActions.includes(newspaperIssueEvent.resolutionActionId))))) {
    throw new Error('Save contains invalid E22 newspaper issue event state');
  }
  const periodicalDiscussionRecords = state.world.periodicalDiscussionRecords ?? [];
  if (!Array.isArray(periodicalDiscussionRecords) || periodicalDiscussionRecords.length > 32
    || periodicalDiscussionRecords.some(record => record.eventId !== 'E22' || record.issueId !== 'newspaper_1847_01'
      || record.sourceId !== 'OBJ-SOV-1847' || record.sellerHostId !== 'bookseller_lev' || !state.hosts[record.buyerHostId]
      || !Number.isInteger(record.minute) || !['E22_READ_ALOUD', 'E22_COMPARE_SOURCE', 'E22_COMMENT', 'E22_KEEP_PRIVATE'].includes(record.actionId)
      || !Array.isArray(record.audienceHostIds) || record.audienceHostIds.some(id => !state.hosts[id])
      || !['BIBLIOGRAPHIC_METADATA_ONLY', 'FICTIONAL_GAMEPLAY_RECONSTRUCTION'].includes(record.scope))) {
    throw new Error('Save contains invalid E22 newspaper discussion record');
  }
  const marketRumorEvent = state.world.livingEventStates.E23;
  if (marketRumorEvent && (marketRumorEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || marketRumorEvent.catalogEventId !== 'E23'
    || !['ACTIVE', 'RESOLVED'].includes(marketRumorEvent.status)
    || !['RUMOR_ACTIVE', 'PRICE_CHECKED_UNVERIFIED', 'FORWARDED_UNVERIFIED', 'CORRECTION_SPREAD', 'IGNORED_UNCHECKED', 'SPREAD_UNVERIFIED', 'EDITORIAL_NOTE_TAKEN', 'NEWSPAPER_PRINTED'].includes(marketRumorEvent.stage)
    || marketRumorEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED'
    || marketRumorEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || marketRumorEvent.valueStatus !== 'fictional_gameplay_balance'
    || marketRumorEvent.trigger !== 'official_price_check_request_repeated_as_public_accusation'
    || marketRumorEvent.sourceCatalogEventId !== 'E13'
    || marketRumorEvent.carrierHostId !== 'street_vendor_matryona' || marketRumorEvent.clerkHostId !== 'clerk_alexei'
    || !state.hosts[marketRumorEvent.sellerHostId]
    || !Array.isArray(marketRumorEvent.actorHostIds) || marketRumorEvent.actorHostIds.join(',') !== 'street_vendor_matryona,clerk_alexei'
    || !Array.isArray(marketRumorEvent.witnessHostIds) || marketRumorEvent.witnessHostIds.some(id => !state.hosts[id])
    || !Array.isArray(marketRumorEvent.rumorReachedHostIds) || marketRumorEvent.rumorReachedHostIds.some(id => !state.hosts[id])
    || !Array.isArray(marketRumorEvent.correctionReachedHostIds) || marketRumorEvent.correctionReachedHostIds.some(id => !state.hosts[id])
    || (marketRumorEvent.editorialNote && (marketRumorEvent.editorialNote.sourceId !== 'V37-E23-MARKET-RUMOR'
      || marketRumorEvent.editorialNote.editorHostId !== 'editor_sofia'
      || !Array.isArray(marketRumorEvent.editorialNote.witnessHostIds)
      || marketRumorEvent.editorialNote.witnessHostIds.some(id => !state.hosts[id])
      || marketRumorEvent.editorialNote.claimStatus !== 'UNVERIFIED'
      || !Number.isInteger(marketRumorEvent.editorialNote.takenAtMinute)))
    || (marketRumorEvent.stage === 'EDITORIAL_NOTE_TAKEN' && (!marketRumorEvent.editorialNote
      || marketRumorEvent.status !== 'RESOLVED' || !state.hosts.editor_sofia?.inventory?.includes('editorial-note:E23')))
    || (marketRumorEvent.newspaperReaderHostIds && (!Array.isArray(marketRumorEvent.newspaperReaderHostIds)
      || marketRumorEvent.newspaperReaderHostIds.some(id => !state.hosts[id])))
    || (marketRumorEvent.stage === 'NEWSPAPER_PRINTED' && (!marketRumorEvent.editorialNote
      || typeof marketRumorEvent.newspaperIssueId !== 'string' || !marketRumorEvent.newspaperIssueId
      || !Number.isInteger(marketRumorEvent.newspaperPublishedAtMinute) || marketRumorEvent.status !== 'RESOLVED'))
    || marketRumorEvent.rumorClaimKo !== '상인이 빵을 숨기고 값을 두 배로 받았다는 말'
    || !Number.isInteger(marketRumorEvent.startedAtMinute) || !Number.isInteger(marketRumorEvent.autoResolveAtMinute)
    || !Number.isInteger(marketRumorEvent.scenePosition?.x) || !Number.isInteger(marketRumorEvent.scenePosition?.y)
    || (marketRumorEvent.status === 'ACTIVE') !== ['RUMOR_ACTIVE', 'IGNORED_UNCHECKED'].includes(marketRumorEvent.stage)
    || (marketRumorEvent.status === 'RESOLVED' && (!Number.isInteger(marketRumorEvent.resolvedAtMinute)
      || !['E23_CHECK_MARKET_RECORD', 'E23_REPEAT_RUMOR', 'E23_CORRECT_RUMOR', 'E23_SEND_TO_PRESS', 'AUTO_RUMOR_SPREAD'].includes(marketRumorEvent.resolutionActionId))))) {
    throw new Error('Save contains invalid E23 market rumor state');
  }
  const innGuestEvent = state.world.livingEventStates.E17;
  const innGuestStages = ['ROOM_REQUESTED', 'GUEST_ARRIVED', 'ROOM_RENTED', 'RATE_REDUCED', 'BED_OFFERED',
    'ROOM_DECLINED', 'AUTO_ROOM_RENTED', 'AUTO_LEFT_UNSERVED'];
  const innGuestActions = ['E17_RENT_ROOM', 'E17_NEGOTIATE_RATE', 'E17_OFFER_BED', 'E17_DECLINE_ROOM',
    'AUTO_INN_ROOM_RENTED', 'AUTO_NO_AFFORDABLE_ROOM'];
  if (innGuestEvent && (innGuestEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || innGuestEvent.catalogEventId !== 'E17'
    || !['ACTIVE', 'RESOLVED'].includes(innGuestEvent.status) || !innGuestStages.includes(innGuestEvent.stage)
    || innGuestEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED'
    || innGuestEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || innGuestEvent.valueStatus !== 'fictional_gameplay_balance'
    || innGuestEvent.guestHostId !== 'courier_pavel' || innGuestEvent.innkeeperHostId !== 'innkeeper_irina'
    || !Array.isArray(innGuestEvent.actorHostIds) || innGuestEvent.actorHostIds.join(',') !== 'courier_pavel,innkeeper_irina'
    || !Array.isArray(innGuestEvent.witnessHostIds) || innGuestEvent.witnessHostIds.some(id => !state.hosts[id])
    || innGuestEvent.witnessHostIds.some((id, index, list) => list.indexOf(id) !== index)
    || !Number.isInteger(innGuestEvent.startedAtMinute) || !Number.isInteger(innGuestEvent.autoResolveAtMinute)
    || innGuestEvent.autoResolveAtMinute !== innGuestEvent.startedAtMinute + 45
    || !Number.isInteger(innGuestEvent.scenePosition?.x) || !Number.isInteger(innGuestEvent.scenePosition?.y)
    || innGuestEvent.roomId !== 'INN_GUEST_ROOM_01' || innGuestEvent.fullRate !== 2 || innGuestEvent.reducedRate !== 1
    || (innGuestEvent.status === 'ACTIVE') !== ['ROOM_REQUESTED', 'GUEST_ARRIVED'].includes(innGuestEvent.stage)
    || (innGuestEvent.stage === 'GUEST_ARRIVED' && !Number.isInteger(innGuestEvent.arrivedAtMinute))
    || (innGuestEvent.status === 'RESOLVED' && (!Number.isInteger(innGuestEvent.resolvedAtMinute)
      || !innGuestActions.includes(innGuestEvent.resolutionActionId)))
    || (['ROOM_RENTED', 'RATE_REDUCED', 'BED_OFFERED', 'AUTO_ROOM_RENTED'].includes(innGuestEvent.stage)
      && (!Number.isInteger(innGuestEvent.paidAmount) || innGuestEvent.paidAmount < 0 || innGuestEvent.paidAmount > 2
        || !state.hosts[innGuestEvent.payerHostId])))) {
    throw new Error('Save contains invalid E17 inn guest state');
  }
  const innGuestRecords = state.world.innGuestRecords ?? [];
  if (!Array.isArray(innGuestRecords) || innGuestRecords.length > 32 || innGuestRecords.some(record => record.eventId !== 'E17'
    || record.guestHostId !== 'courier_pavel' || record.innkeeperHostId !== 'innkeeper_irina'
    || record.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || !Number.isInteger(record.checkInMinute) || (record.checkOutMinute !== null && !Number.isInteger(record.checkOutMinute))
    || !Number.isInteger(record.paidAmount) || record.paidAmount < 0 || record.paidAmount > 2
    || !Array.isArray(record.audienceHostIds) || record.audienceHostIds.some(id => !state.hosts[id])
    || !innGuestActions.includes(record.resolutionActionId))) throw new Error('Save contains invalid E17 lodging record');
  const temporaryLodgingStays = state.world.temporaryLodgingStays ?? {};
  if (!temporaryLodgingStays || typeof temporaryLodgingStays !== 'object' || Array.isArray(temporaryLodgingStays)
    || Object.entries(temporaryLodgingStays).some(([hostId, stay]) => hostId !== 'courier_pavel' || !state.hosts[hostId]
      || stay.eventId !== 'E17' || stay.roomId !== 'INN_GUEST_ROOM_01' || stay.mapId !== 'inn-interior'
      || !Number.isInteger(stay.position?.x) || !Number.isInteger(stay.position?.y)
      || !Number.isInteger(stay.untilMinute) || !Number.isInteger(stay.paidAmount) || stay.paidAmount < 0 || stay.paidAmount > 2
      || stay.valueStatus !== 'fictional_gameplay_balance')) throw new Error('Save contains invalid E17 temporary lodging');
  const charityMealEvent = state.world.livingEventStates.E14;
  if (charityMealEvent && (charityMealEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || charityMealEvent.catalogEventId !== 'E14'
    || !['ACTIVE', 'RESOLVED'].includes(charityMealEvent.status)
    || !['RELIEF_ANNOUNCED', 'RELIEF_LINE_FORMS', 'RATION_PURCHASED', 'RATION_SPONSORED', 'RATION_DONATED', 'AID_DECLINED', 'AUTO_SPONSORED', 'AUTO_DONATED', 'LINE_CLOSED'].includes(charityMealEvent.stage)
    || charityMealEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED'
    || charityMealEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || charityMealEvent.valueStatus !== 'fictional_gameplay_balance'
    || charityMealEvent.donorHostId !== 'market_nadezhda' || charityMealEvent.organizerHostId !== 'yardkeeper_semyon'
    || charityMealEvent.recipientHostId !== 'tenant_mikhail' || charityMealEvent.itemKo !== '빵 한 묶음'
    || !Number.isInteger(charityMealEvent.price) || charityMealEvent.price !== 1
    || charityMealEvent.venueBasis !== 'FICTIONAL_MARKET_RELIEF_RECONSTRUCTION'
    || !Array.isArray(charityMealEvent.actorHostIds)
    || charityMealEvent.actorHostIds.join(',') !== 'yardkeeper_semyon,market_nadezhda,tenant_mikhail'
    || !Array.isArray(charityMealEvent.witnessHostIds) || charityMealEvent.witnessHostIds.some(id => !state.hosts[id])
    || !Number.isInteger(charityMealEvent.startedAtMinute) || !Number.isInteger(charityMealEvent.resolvesAtMinute)
    || charityMealEvent.resolvesAtMinute !== charityMealEvent.startedAtMinute + 360
    || !Number.isInteger(charityMealEvent.stockAtOpening) || charityMealEvent.stockAtOpening < 1
    || !Number.isInteger(charityMealEvent.scenePosition?.x) || !Number.isInteger(charityMealEvent.scenePosition?.y)
    || (charityMealEvent.status === 'ACTIVE') !== ['RELIEF_ANNOUNCED', 'RELIEF_LINE_FORMS'].includes(charityMealEvent.stage)
    || (charityMealEvent.status === 'RESOLVED' && (!Number.isInteger(charityMealEvent.resolvedAtMinute)
      || !['E14_BUY_FOR_SELF', 'E14_ORGANIZER_SPONSORS', 'E14_VENDOR_DONATES', 'E14_DECLINE_AID',
        'AUTO_COMMUNAL_PURCHASE', 'AUTO_VENDOR_DONATION', 'AUTO_LINE_CLOSED_WITHOUT_AID'].includes(charityMealEvent.resolutionActionId))))) {
    throw new Error('Save contains invalid E14 charity-day state');
  }
  const apprenticeLessonEvent = state.world.livingEventStates.E19;
  if (apprenticeLessonEvent && (apprenticeLessonEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || apprenticeLessonEvent.catalogEventId !== 'E19'
    || !['ACTIVE', 'RESOLVED'].includes(apprenticeLessonEvent.status)
    || !['LESSON_REQUESTED', 'LESSON_READY', 'LESSON_COMPLETED', 'LESSON_PAID', 'LESSON_DECLINED',
      'PRACTICED_UNATTENDED', 'LESSON_POSTPONED'].includes(apprenticeLessonEvent.stage)
    || apprenticeLessonEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED'
    || apprenticeLessonEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || apprenticeLessonEvent.valueStatus !== 'fictional_gameplay_balance'
    || apprenticeLessonEvent.teacherHostId !== 'teacher_lyubov' || apprenticeLessonEvent.studentHostId !== 'print_apprentice_stepan'
    || !Array.isArray(apprenticeLessonEvent.actorHostIds) || apprenticeLessonEvent.actorHostIds.join(',') !== 'teacher_lyubov,print_apprentice_stepan'
    || !Array.isArray(apprenticeLessonEvent.witnessHostIds) || apprenticeLessonEvent.witnessHostIds.some(id => !state.hosts[id])
    || apprenticeLessonEvent.venueBasis !== 'FICTIONAL_AFTER_WORK_PRINTSHOP_PRACTICE'
    || !Number.isInteger(apprenticeLessonEvent.startedAtMinute) || !Number.isInteger(apprenticeLessonEvent.resolvesAtMinute)
    || apprenticeLessonEvent.resolvesAtMinute < apprenticeLessonEvent.startedAtMinute
    || !Number.isInteger(apprenticeLessonEvent.scenePosition?.x) || !Number.isInteger(apprenticeLessonEvent.scenePosition?.y)
    || (apprenticeLessonEvent.status === 'ACTIVE') !== ['LESSON_REQUESTED', 'LESSON_READY'].includes(apprenticeLessonEvent.stage)
    || (apprenticeLessonEvent.stage === 'LESSON_READY' && (!Number.isInteger(apprenticeLessonEvent.gatheredAtMinute)
      || (apprenticeLessonEvent.practiceDurationMinutes !== undefined
        && (!Number.isInteger(apprenticeLessonEvent.practiceDurationMinutes) || apprenticeLessonEvent.practiceDurationMinutes < 1 || apprenticeLessonEvent.practiceDurationMinutes > 120))
      || apprenticeLessonEvent.resolvesAtMinute !== apprenticeLessonEvent.gatheredAtMinute + (apprenticeLessonEvent.practiceDurationMinutes ?? 45)))
    || (apprenticeLessonEvent.status === 'RESOLVED' && (!Number.isInteger(apprenticeLessonEvent.resolvedAtMinute)
      || !['E19_ASK_FOR_LESSON', 'E19_OFFER_KOPEK', 'E19_TEACH_FREE', 'E19_REQUEST_KOPEK',
        'E19_STUDENT_DECLINE', 'E19_TEACHER_POSTPONE', 'AUTO_SHARED_READING_PRACTICE', 'AUTO_NO_LESSON_TODAY'].includes(apprenticeLessonEvent.resolutionActionId))))) {
    throw new Error('Save contains invalid E19 apprentice literacy event state');
  }
  const lateMealEvent = state.world.livingEventStates.E18;
  if (lateMealEvent && (lateMealEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || lateMealEvent.catalogEventId !== 'E18'
    || !['ACTIVE', 'RESOLVED'].includes(lateMealEvent.status)
    || !['MEAL_REQUESTED', 'MEAL_PAID', 'SMALL_MEAL_PAID', 'MEAL_DECLINED', 'AUTO_SERVED', 'AUTO_DECLINED'].includes(lateMealEvent.stage)
    || lateMealEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED'
    || lateMealEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || lateMealEvent.valueStatus !== 'fictional_gameplay_balance'
    || lateMealEvent.sellerHostId !== 'innkeeper_irina' || !state.hosts[lateMealEvent.buyerHostId]
    || lateMealEvent.sellerHostId === lateMealEvent.buyerHostId || lateMealEvent.itemKo !== '저녁 수프'
    || (lateMealEvent.sourceEventId !== undefined && (lateMealEvent.sourceEventId !== 'E14'
      || state.world.livingEventStates.E14?.stage !== 'AID_DECLINED'
      || state.world.livingEventStates.E14?.recipientHostId !== lateMealEvent.buyerHostId))
    || lateMealEvent.unit !== 'kopeks' || !Number.isInteger(lateMealEvent.price) || lateMealEvent.price < 1
    || lateMealEvent.smallPortionPrice !== Math.max(1, Math.floor(lateMealEvent.price / 2))
    || !Number.isInteger(lateMealEvent.startedAtMinute) || !Number.isInteger(lateMealEvent.resolvesAtMinute)
    || lateMealEvent.resolvesAtMinute !== lateMealEvent.startedAtMinute + 30
    || !Array.isArray(lateMealEvent.actorHostIds)
    || lateMealEvent.actorHostIds.join(',') !== `${lateMealEvent.buyerHostId},${lateMealEvent.sellerHostId}`
    || !Array.isArray(lateMealEvent.witnessHostIds) || lateMealEvent.witnessHostIds.some(id => !state.hosts[id])
    || !Number.isInteger(lateMealEvent.scenePosition?.x) || !Number.isInteger(lateMealEvent.scenePosition?.y)
    || (lateMealEvent.status === 'ACTIVE') !== (lateMealEvent.stage === 'MEAL_REQUESTED')
    || (lateMealEvent.status === 'RESOLVED' && (!Number.isInteger(lateMealEvent.resolvedAtMinute)
      || !['E18_BUY_FULL_MEAL', 'E18_BUY_SMALL_MEAL', 'E18_DECLINE_MEAL', 'AUTO_PAY_FOR_LATE_MEAL', 'AUTO_MEAL_UNAFFORDABLE'].includes(lateMealEvent.resolutionActionId))))) {
    throw new Error('Save contains invalid E18 late meal event state');
  }
  if (coldWaveEvent && (coldWaveEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || coldWaveEvent.catalogEventId !== 'E03'
    || !['ACTIVE', 'RESOLVED'].includes(coldWaveEvent.status)
    || !['COLD_WAVE', 'FIREWOOD_BOUGHT', 'COURTYARD_FUEL_POOLED', 'FUEL_DEFERRED', 'COLD_PASSED'].includes(coldWaveEvent.stage)
    || coldWaveEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED' || coldWaveEvent.valueStatus !== 'fictional_gameplay_balance'
    || coldWaveEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || !['snow', 'wind'].includes(coldWaveEvent.weather)
    || coldWaveEvent.trigger !== 'winter_snow_or_wind'
    || !Array.isArray(coldWaveEvent.actorHostIds) || coldWaveEvent.actorHostIds.join(',') !== 'tenant_mikhail,landlady_polina,porter_gavrila'
    || coldWaveEvent.tenantHostId !== 'tenant_mikhail' || coldWaveEvent.landlordHostId !== 'landlady_polina'
    || !Number.isInteger(coldWaveEvent.startedAtMinute) || !Number.isInteger(coldWaveEvent.resolvesAtMinute)
    || coldWaveEvent.resolvesAtMinute !== coldWaveEvent.startedAtMinute + 1440
    || (coldWaveEvent.status === 'ACTIVE') !== (coldWaveEvent.stage === 'COLD_WAVE')
    || (coldWaveEvent.status === 'RESOLVED' && (!Number.isInteger(coldWaveEvent.resolvedAtMinute)
      || (coldWaveEvent.stage !== 'COLD_PASSED' && !['E03_BUY_FIREWOOD', 'E03_POOL_COURTYARD_FUEL', 'E03_LEAVE_FUEL_UNBOUGHT'].includes(coldWaveEvent.resolutionActionId)))))) {
    throw new Error('Save contains invalid E03 cold wave event state');
  }
  const courtyardFireEvent = state.world.livingEventStates.E27;
  if (courtyardFireEvent && (courtyardFireEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || courtyardFireEvent.catalogEventId !== 'E27'
    || !['ACTIVE', 'RESOLVED'].includes(courtyardFireEvent.status)
    || !['FIRE_REPORTED', 'EVACUATING', 'RESIDENTS_EVACUATED', 'ALARM_RAISED', 'FIRE_REPORTED_TO_WATCH', 'DAMAGE_SPREAD'].includes(courtyardFireEvent.stage)
    || courtyardFireEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED'
    || courtyardFireEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || courtyardFireEvent.valueStatus !== 'fictional_gameplay_balance'
    || courtyardFireEvent.trigger !== 'tenant_brought_firewood_to_courtyard_on_windy_winter_evening'
    || courtyardFireEvent.sourceEventId !== 'E03' || courtyardFireEvent.tenantHostId !== 'tenant_mikhail'
    || !Array.isArray(courtyardFireEvent.actorHostIds) || courtyardFireEvent.actorHostIds.join(',') !== 'tenant_mikhail,landlady_polina,porter_gavrila,junior_guard_sergey'
    || !Array.isArray(courtyardFireEvent.witnessHostIds) || courtyardFireEvent.witnessHostIds.some(id => !state.hosts[id])
    || !Number.isInteger(courtyardFireEvent.startedAtMinute) || !Number.isInteger(courtyardFireEvent.deadlineMinute)
    || courtyardFireEvent.deadlineMinute !== courtyardFireEvent.startedAtMinute + 60
    || !Number.isInteger(courtyardFireEvent.scenePosition?.x) || !Number.isInteger(courtyardFireEvent.scenePosition?.y)
    || ![0, 1].includes(courtyardFireEvent.propertyDamage)
    || (courtyardFireEvent.status === 'ACTIVE') !== ['FIRE_REPORTED', 'EVACUATING'].includes(courtyardFireEvent.stage)
    || (courtyardFireEvent.stage === 'EVACUATING' && (courtyardFireEvent.protocolVersion !== 2
      || courtyardFireEvent.resolutionActionId !== 'E27_EVACUATE_RESIDENTS'
      || !courtyardFireEvent.evacuationTargets || courtyardFireEvent.actorHostIds.some(id => {
        const target = courtyardFireEvent.evacuationTargets[id];
        const expected = COURTYARD_FIRE_EVACUATION_TARGETS[id];
        return !target || target.mapId !== expected?.mapId || target.position?.x !== expected?.position?.x
          || target.position?.y !== expected?.position?.y;
      })))
    || (courtyardFireEvent.protocolVersion === 2 && courtyardFireEvent.status === 'RESOLVED'
      && courtyardFireEvent.stage === 'RESIDENTS_EVACUATED'
      && (!Array.isArray(courtyardFireEvent.evacuatedHostIds)
        || courtyardFireEvent.actorHostIds.some(id => !courtyardFireEvent.evacuatedHostIds.includes(id))))
    || (courtyardFireEvent.status === 'RESOLVED' && (!Number.isInteger(courtyardFireEvent.resolvedAtMinute)
      || !['E27_EVACUATE_RESIDENTS', 'E27_RAISE_NEIGHBOR_ALARM', 'E27_REPORT_TO_WATCH', 'AUTO_FIRE_SPREAD'].includes(courtyardFireEvent.resolutionActionId))))) {
    throw new Error('Save contains invalid E27 courtyard fire state');
  }
  const funeralCostsEvent = state.world.livingEventStates.E28;
  if (funeralCostsEvent && (funeralCostsEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || funeralCostsEvent.catalogEventId !== 'E28'
    || !['ACTIVE', 'RESOLVED'].includes(funeralCostsEvent.status)
    || !['FUNERAL_COSTS_DUE', 'FUNERAL_COSTS_PAID', 'FUNERAL_COSTS_ON_CREDIT', 'FUNERAL_COSTS_PAID_UNATTENDED',
      'FUNERAL_COSTS_ON_CREDIT_UNATTENDED', 'FUNERAL_POSTPONED'].includes(funeralCostsEvent.stage)
    || funeralCostsEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED'
    || funeralCostsEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || funeralCostsEvent.valueStatus !== 'fictional_gameplay_balance'
    || funeralCostsEvent.trigger !== 'fictional_relative_death_after_untreated_critical_injury'
    || funeralCostsEvent.deceasedHostId !== 'porter_gavrila' || funeralCostsEvent.organizerHostId !== 'courier_pavel'
    || funeralCostsEvent.lenderHostId !== 'innkeeper_irina' || funeralCostsEvent.venueMapId !== 'communal-room'
    || funeralCostsEvent.cost !== 4 || funeralCostsEvent.unit !== 'kopeks'
    || !Array.isArray(funeralCostsEvent.actorHostIds) || funeralCostsEvent.actorHostIds.join(',') !== 'courier_pavel,innkeeper_irina'
    || !Array.isArray(funeralCostsEvent.witnessHostIds) || funeralCostsEvent.witnessHostIds.some(id => !state.hosts[id])
    || !Number.isInteger(funeralCostsEvent.startedAtMinute) || !Number.isInteger(funeralCostsEvent.deadlineMinute)
    || funeralCostsEvent.deadlineMinute !== funeralCostsEvent.startedAtMinute + 360
    || !Number.isInteger(funeralCostsEvent.scenePosition?.x) || !Number.isInteger(funeralCostsEvent.scenePosition?.y)
    || (funeralCostsEvent.status === 'ACTIVE') !== (funeralCostsEvent.stage === 'FUNERAL_COSTS_DUE')
    || (funeralCostsEvent.status === 'RESOLVED' && (!Number.isInteger(funeralCostsEvent.resolvedAtMinute)
      || !['E28_PAVEL_PAYS_COSTS', 'E28_IRINA_ADVANCES_COSTS', 'AUTO_NEXT_OF_KIN_PAID', 'AUTO_LENDER_ADVANCE',
        'AUTO_FUNERAL_POSTPONED'].includes(funeralCostsEvent.resolutionActionId)))
    || (funeralCostsEvent.debt && (funeralCostsEvent.debt.debtorHostId !== 'courier_pavel'
      || funeralCostsEvent.debt.creditorHostId !== 'innkeeper_irina' || funeralCostsEvent.debt.amount !== 4
      || funeralCostsEvent.debt.unit !== 'kopeks' || !['OUTSTANDING', 'SETTLED'].includes(funeralCostsEvent.debt.status)
      || !Number.isInteger(funeralCostsEvent.debt.amountRepaid) || funeralCostsEvent.debt.amountRepaid < 0 || funeralCostsEvent.debt.amountRepaid > 4
      || funeralCostsEvent.debt.remainingAmount !== 4 - funeralCostsEvent.debt.amountRepaid
      || !Number.isInteger(funeralCostsEvent.debt.dueAtMinute) || funeralCostsEvent.debt.dueAtMinute !== funeralCostsEvent.debt.openedAtMinute + 720
      || !Number.isInteger(funeralCostsEvent.debt.nextPaymentAtMinute) || funeralCostsEvent.debt.nextPaymentAtMinute < funeralCostsEvent.debt.dueAtMinute
      || (funeralCostsEvent.debt.status === 'SETTLED') !== (funeralCostsEvent.debt.remainingAmount === 0))))) {
    throw new Error('Save contains invalid E28 funeral cost state');
  }
  const marketDayWorkEvent = state.world.livingEventStates.E32;
  if (marketDayWorkEvent && (marketDayWorkEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || marketDayWorkEvent.catalogEventId !== 'E32'
    || !['ACTIVE', 'RESOLVED'].includes(marketDayWorkEvent.status)
    || !['JOB_SEARCH_OPENED', 'OFFER_READY', 'HEAVY_LOADING_PAID', 'LIGHT_SORTING_PAID', 'PRINTSHOP_REFERRAL', 'WORK_DECLINED', 'NO_WORK_FOUND'].includes(marketDayWorkEvent.stage)
    || marketDayWorkEvent.workerHostId !== 'tenant_mikhail' || marketDayWorkEvent.employerHostId !== 'market_nadezhda'
    || !Array.isArray(marketDayWorkEvent.actorHostIds) || marketDayWorkEvent.actorHostIds.join(',') !== 'tenant_mikhail,market_nadezhda'
    || !Array.isArray(marketDayWorkEvent.witnessHostIds) || marketDayWorkEvent.witnessHostIds.some(id => !state.hosts[id])
    || marketDayWorkEvent.venueMapId !== 'market-quay' || marketDayWorkEvent.scenePosition?.x !== 15 || marketDayWorkEvent.scenePosition?.y !== 12
    || !Number.isInteger(marketDayWorkEvent.startedAtMinute) || !Number.isInteger(marketDayWorkEvent.offerExpiresAtMinute)
    || (marketDayWorkEvent.status === 'ACTIVE') !== ['JOB_SEARCH_OPENED', 'OFFER_READY'].includes(marketDayWorkEvent.stage)
    || (['HEAVY_LOADING_PAID', 'LIGHT_SORTING_PAID'].includes(marketDayWorkEvent.stage)
      && (!Number.isInteger(marketDayWorkEvent.workMinutes) || marketDayWorkEvent.workMinutes !== 60
        || !['상자 나르기', '물건 분류'].includes(marketDayWorkEvent.workKind)))
    || (marketDayWorkEvent.status === 'RESOLVED' && (!Number.isInteger(marketDayWorkEvent.resolvedAtMinute)
      || !['AUTO_DAY_WORK_COMPLETED', 'MARKET_TO_PRINTSHOP_REFERRAL', 'WORKER_DECLINED_MARKET_JOB', 'AUTO_OFFER_WINDOW_CLOSED'].includes(marketDayWorkEvent.resolutionActionId))))) {
    throw new Error('Save contains invalid E32 market day work state');
  }
  const marketTheftEvent = state.world.livingEventStates.E36;
  if (marketTheftEvent && (marketTheftEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || marketTheftEvent.catalogEventId !== 'E36'
    || !['ACTIVE', 'RESOLVED'].includes(marketTheftEvent.status)
    || !['LOSS_NOTICED', 'WITNESS_READY', 'FORMAL_REPORT_FILED', 'PRIVATE_WITNESS_NOTE', 'LOSS_REPAID_BY_NEIGHBOR', 'LOSS_UNREPORTED'].includes(marketTheftEvent.stage)
    || marketTheftEvent.sellerHostId !== 'market_nadezhda' || marketTheftEvent.witnessHostId !== 'porter_gavrila'
    || marketTheftEvent.watchmanHostId !== 'police_sergeant_ivan' || marketTheftEvent.neighborHostId !== 'tenant_mikhail'
    || !Array.isArray(marketTheftEvent.actorHostIds) || marketTheftEvent.actorHostIds.join(',') !== 'market_nadezhda,porter_gavrila,police_sergeant_ivan,tenant_mikhail'
    || !Array.isArray(marketTheftEvent.witnessHostIds) || marketTheftEvent.witnessHostIds.join(',') !== 'porter_gavrila'
    || marketTheftEvent.venueMapId !== 'market-quay' || marketTheftEvent.scenePosition?.x !== 16 || marketTheftEvent.scenePosition?.y !== 12
    || !Number.isInteger(marketTheftEvent.startedAtMinute) || !Number.isInteger(marketTheftEvent.resolvesAtMinute)
    || marketTheftEvent.unidentifiedLoss?.amount !== 2 || marketTheftEvent.unidentifiedLoss.identified !== false
    || (marketTheftEvent.status === 'ACTIVE') !== ['LOSS_NOTICED', 'WITNESS_READY'].includes(marketTheftEvent.stage)
    || (marketTheftEvent.stage === 'FORMAL_REPORT_FILED' && (!Number.isInteger(marketTheftEvent.officialRecordNumber)
      || !state.world.marketTheftRecords?.some(row => row.eventId === 'E36' && row.suspectHostId === null))))) {
    throw new Error('Save contains invalid E36 market theft state');
  }
  const roofLeakEvent = state.world.livingEventStates.E35;
  if (roofLeakEvent && (roofLeakEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || roofLeakEvent.catalogEventId !== 'E35'
    || !['ACTIVE', 'RESOLVED'].includes(roofLeakEvent.status)
    || !['REPAIR_OPTIONS_OPEN', 'OWNER_PAID', 'COST_SHARED', 'REPAIR_POSTPONED'].includes(roofLeakEvent.stage)
    || !['LEAKING', 'REPAIRED'].includes(roofLeakEvent.repairStatus)
    || roofLeakEvent.landlordHostId !== 'landlady_polina' || roofLeakEvent.tenantHostId !== 'tenant_mikhail'
    || !Array.isArray(roofLeakEvent.actorHostIds) || roofLeakEvent.actorHostIds.join(',') !== 'landlady_polina,tenant_mikhail'
    || roofLeakEvent.venueMapId !== 'courtyard' || roofLeakEvent.scenePosition?.x !== 12 || roofLeakEvent.scenePosition?.y !== 7
    || roofLeakEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || roofLeakEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED' || roofLeakEvent.valueStatus !== 'fictional_gameplay_balance'
    || !Number.isInteger(roofLeakEvent.startedAtMinute) || !Number.isInteger(roofLeakEvent.resolvesAtMinute)
    || (roofLeakEvent.status === 'ACTIVE') !== (roofLeakEvent.stage === 'REPAIR_OPTIONS_OPEN')
    || (['OWNER_PAID', 'COST_SHARED'].includes(roofLeakEvent.stage) !== (roofLeakEvent.repairStatus === 'REPAIRED'))
    || (roofLeakEvent.status === 'RESOLVED' && (!Number.isInteger(roofLeakEvent.resolvedAtMinute)
      || !['E35_OWNER_PAYS_REPAIR', 'E35_SPLIT_REPAIR_COST', 'E35_DELAY_REPAIR', 'AUTO_REPAIR_POSTPONED'].includes(roofLeakEvent.resolutionActionId))))) {
    throw new Error('Save contains invalid E35 roof leak repair state');
  }
  if (rentEvent && (rentEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || rentEvent.catalogEventId !== 'E01'
    || !['ACTIVE', 'RESOLVED'].includes(rentEvent.status) || !['DUE_NOTICE', 'PARTIAL_PAYMENT', 'OVERDUE', 'EVICTED', 'SETTLED'].includes(rentEvent.stage)
    || rentEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED' || typeof rentEvent.tenantHostId !== 'string'
    || typeof rentEvent.landlordHostId !== 'string' || !Number.isInteger(rentEvent.dueDayIndex) || rentEvent.dueDayIndex < 0
    || (rentEvent.status === 'RESOLVED') !== (rentEvent.stage === 'SETTLED'))) throw new Error('Save contains invalid E01 rent event state');
  if (missingParcelEvent && (missingParcelEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || missingParcelEvent.catalogEventId !== 'E05'
    || !['ACTIVE', 'RESOLVED'].includes(missingParcelEvent.status)
    || !['PARCEL_MISSING', 'RECOVERED_BY_COURIER', 'ACCEPTED_BY_RECIPIENT', 'LOSS_REPORTED', 'UNCLAIMED'].includes(missingParcelEvent.stage)
    || missingParcelEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED' || missingParcelEvent.valueStatus !== 'fictional_gameplay_balance'
    || missingParcelEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || missingParcelEvent.senderHostId !== 'courier_pavel' || missingParcelEvent.recipientHostId !== 'printer_ekaterina'
    || missingParcelEvent.taskId !== 'PAVEL_DELIVER_SEALED_ENVELOPE_01' || missingParcelEvent.itemKo !== '밀봉 봉투'
    || missingParcelEvent.mapId !== 'printshop' || missingParcelEvent.position?.x !== 10 || missingParcelEvent.position?.y !== 13
    || missingParcelEvent.itemLocation !== ({ PARCEL_MISSING: 'LOST_ON_DELIVERY_ROUTE', RECOVERED_BY_COURIER: 'COURIER_CARRYING',
      ACCEPTED_BY_RECIPIENT: 'RECIPIENT_INVENTORY', LOSS_REPORTED: 'UNRECOVERED_AFTER_REPORT', UNCLAIMED: 'NO_LONGER_AT_DELIVERY_DOOR' })[missingParcelEvent.stage]
    || !Number.isInteger(missingParcelEvent.startedAtMinute) || !Number.isInteger(missingParcelEvent.deadlineMinute)
    || missingParcelEvent.deadlineMinute !== 660
    || (missingParcelEvent.status === 'ACTIVE') !== (missingParcelEvent.stage === 'PARCEL_MISSING')
    || (missingParcelEvent.status === 'RESOLVED' && (!Number.isInteger(missingParcelEvent.resolvedAtMinute)
      || !['PAVEL_RECOVER_MISSING_PARCEL', 'EKATERINA_ACCEPT_MISSING_PARCEL', 'PAVEL_REPORT_MISSING_PARCEL', 'AUTO_UNCLAIMED_AFTER_ONE_DAY'].includes(missingParcelEvent.resolutionActionId)))
    || (missingParcelEvent.status === 'ACTIVE' && state.hosts.courier_pavel.inventory.includes('밀봉 봉투')))) {
    throw new Error('Save contains invalid E05 missing parcel event state');
  }
  const policeDocumentEvent = state.world.livingEventStates.E25;
  if (policeDocumentEvent && (policeDocumentEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || policeDocumentEvent.catalogEventId !== 'E25'
    || !['ACTIVE', 'RESOLVED'].includes(policeDocumentEvent.status)
    || !['CHECK_REQUESTED', 'INTERVIEW_READY', 'ROUTE_ENTERED', 'SCOPE_ASKED', 'LEFT_UNANSWERED', 'CHECK_CLOSED_UNATTENDED'].includes(policeDocumentEvent.stage)
    || policeDocumentEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED'
    || policeDocumentEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || policeDocumentEvent.valueStatus !== 'fictional_gameplay_balance'
    || policeDocumentEvent.sourceEventId !== 'E05'
    || policeDocumentEvent.courierHostId !== 'courier_pavel' || policeDocumentEvent.officerHostId !== 'police_sergeant_ivan'
    || !Array.isArray(policeDocumentEvent.actorHostIds) || policeDocumentEvent.actorHostIds.join(',') !== 'courier_pavel,police_sergeant_ivan'
    || policeDocumentEvent.venueMapId !== 'police-station' || policeDocumentEvent.scenePosition?.x !== 5 || policeDocumentEvent.scenePosition?.y !== 3
    || !['NONE', 'POLICE_INTAKE_REGISTER', 'PRIVATE_CONVERSATION'].includes(policeDocumentEvent.recordScope)
    || !Number.isInteger(policeDocumentEvent.startedAtMinute)
    || (policeDocumentEvent.stage === 'INTERVIEW_READY' && (!Number.isInteger(policeDocumentEvent.gatheredAtMinute)
      || policeDocumentEvent.closesAtMinute !== policeDocumentEvent.gatheredAtMinute + 90))
    || (policeDocumentEvent.status === 'ACTIVE') !== ['CHECK_REQUESTED', 'INTERVIEW_READY'].includes(policeDocumentEvent.stage)
    || (policeDocumentEvent.status === 'RESOLVED' && (!Number.isInteger(policeDocumentEvent.resolvedAtMinute)
      || !['E25_ADD_ROUTE_TO_REGISTER', 'E25_ASK_SCOPE_FIRST', 'E25_LEAVE_WITHOUT_ANSWER', 'AUTO_COURIER_LEFT_AFTER_WAIT'].includes(policeDocumentEvent.resolutionActionId)))
    || (policeDocumentEvent.recordScope === 'POLICE_INTAKE_REGISTER') !== Number.isInteger(policeDocumentEvent.officialRecordNumber))) {
    throw new Error('Save contains invalid E25 police document check state');
  }
  if (breadEvent && (breadEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || breadEvent.catalogEventId !== 'E02' || !['ACTIVE', 'RESOLVED'].includes(breadEvent.status)
    || !['PRICE_NOTICE', 'RESTOCKED', 'RESOLVED'].includes(breadEvent.stage)
    || breadEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED' || breadEvent.valueStatus !== 'fictional_gameplay_balance'
    || breadEvent.itemKo !== '빵 한 묶음' || breadEvent.sellerHostId !== 'market_nadezhda'
    || breadEvent.supplierHostId !== 'baker_fyodor' || !Number.isInteger(breadEvent.basePrice) || breadEvent.basePrice <= 0
    || !Number.isInteger(breadEvent.currentPrice) || breadEvent.currentPrice <= breadEvent.basePrice
    || breadEvent.currentPrice !== breadEvent.basePrice + (state.world.marketPriceModifiers['market_nadezhda:빵 한 묶음'] ?? 0)
    || (breadEvent.status === 'RESOLVED') !== (breadEvent.stage === 'RESOLVED'))) {
    throw new Error('Save contains invalid E02 market event state');
  }
  const printEvent = state.world.livingEventStates.E07;
  if (printEvent && (printEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || printEvent.catalogEventId !== 'E07'
    || !['ACTIVE', 'RESOLVED'].includes(printEvent.status) || !['PROOF_PREPARED', 'TYPESET_CHECKED', 'RESOLVED'].includes(printEvent.stage)
    || printEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED' || printEvent.valueStatus !== 'fictional_gameplay_balance'
    || printEvent.typesetterHostId !== 'typesetter_nikita' || printEvent.printerHostId !== 'printer_ekaterina'
    || printEvent.payerHostId !== 'printer_ekaterina' || printEvent.wageActionId !== 'PRINTSHOP_RELATED_WAGE'
    || (printEvent.status === 'RESOLVED') !== (printEvent.stage === 'RESOLVED'))) {
    throw new Error('Save contains invalid E07 print deadline event state');
  }
  const censorshipEvent = state.world.livingEventStates.E06;
  const smuggledEdition = state.world.livingEventStates.E34;
  const copyInExpectedHolder = !smuggledEdition
    ? state.hosts.typesetter_nikita.inventory.includes('삭제 표시가 남은 교정쇄 사본')
    : (smuggledEdition.itemLocation === 'WITH_TYPESETTER'
      ? state.hosts.typesetter_nikita.inventory.includes('삭제 표시가 남은 교정쇄 사본')
      : smuggledEdition.itemLocation === 'WITH_BOOKSELLER'
        ? state.hosts.bookseller_lev.inventory.includes('삭제 표시가 남은 교정쇄 사본')
        : smuggledEdition.itemLocation === 'WITH_WATCHMAN'
          ? state.hosts.junior_guard_sergey.inventory.includes('삭제 표시가 남은 교정쇄 사본')
          : ['UNDER_BOOKSHOP_SHELF', 'NO_ITEM'].includes(smuggledEdition.itemLocation)
            && !Object.values(state.hosts).some(host => host.inventory.includes('삭제 표시가 남은 교정쇄 사본')));
  if (censorshipEvent && (censorshipEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || censorshipEvent.catalogEventId !== 'E06'
    || !['ACTIVE', 'RESOLVED'].includes(censorshipEvent.status)
    || !['CENSOR_MARK_RETURNED', 'TYPE_REMOVED', 'QUERY_FILED', 'COPY_KEPT', 'INSTITUTIONAL_CUT'].includes(censorshipEvent.stage)
    || censorshipEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED' || censorshipEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || censorshipEvent.trigger !== 'censor_order'
    || censorshipEvent.triggerMechanism !== 'scheduled_typesetter_proof_check_after_returned_marked_proof'
    || censorshipEvent.printerHostId !== 'printer_ekaterina' || censorshipEvent.typesetterHostId !== 'typesetter_nikita'
    || censorshipEvent.editorHostId !== 'editor_sofia' || !Array.isArray(censorshipEvent.actorHostIds)
    || censorshipEvent.actorHostIds.join(',') !== 'printer_ekaterina,typesetter_nikita,editor_sofia'
    || !Number.isInteger(censorshipEvent.startedAtMinute) || !Number.isInteger(censorshipEvent.resolvesAtMinute)
    || censorshipEvent.resolvesAtMinute !== censorshipEvent.startedAtMinute + 1440
    || !['MARKED_COPY_ON_WORKTABLE', 'REVISED_PROOF', 'QUERY_PENDING', 'PRIVATE_COPY_RETAINED', 'TEXT_REMOVED_WITHOUT_PLAYER_RESPONSE'].includes(censorshipEvent.proofDisposition)
    || !['NONE', 'OFFICIAL_QUERY'].includes(censorshipEvent.officeRecord)
    || ![0, 1, 2, 3].includes(censorshipEvent.printerRisk)
    || (censorshipEvent.stage === 'COPY_KEPT' && (censorshipEvent.privateCopyHostId !== censorshipEvent.typesetterHostId
      || !copyInExpectedHolder || state.hosts[censorshipEvent.editorHostId].inventory.includes('삭제 표시가 남은 교정쇄 사본')))
    || (censorshipEvent.status === 'ACTIVE') !== (censorshipEvent.stage === 'CENSOR_MARK_RETURNED')
    || (censorshipEvent.status === 'RESOLVED' && (!Number.isInteger(censorshipEvent.resolvedAtMinute)
      || !['E06_REMOVE_TYPE', 'E06_FILE_QUERY', 'E06_KEEP_COPY', 'AUTO_INSTITUTIONAL_CUT'].includes(censorshipEvent.resolutionActionId))))) {
    throw new Error('Save contains invalid E06 censored page event state');
  }
  const smuggledEditionEvent = state.world.livingEventStates.E34;
  if (smuggledEditionEvent) {
    const item = '삭제 표시가 남은 교정쇄 사본';
    const holders = Object.values(state.hosts).filter(host => host.inventory.includes(item)).map(host => host.id);
    const expectedHolder = { WITH_TYPESETTER: 'typesetter_nikita', WITH_BOOKSELLER: 'bookseller_lev',
      WITH_WATCHMAN: 'junior_guard_sergey' }[smuggledEditionEvent.itemLocation] ?? null;
    const itemLocationValid = expectedHolder ? holders.length === 1 && holders[0] === expectedHolder
      : smuggledEditionEvent.itemLocation === 'UNDER_BOOKSHOP_SHELF' && holders.length === 0;
    if (smuggledEditionEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || smuggledEditionEvent.catalogEventId !== 'E34'
      || !['ACTIVE', 'RESOLVED'].includes(smuggledEditionEvent.status)
      || !['COPY_CARRIED', 'READING_READY', 'HIDDEN_BY_BOOKSELLER', 'MARKS_NOTED', 'TAKEN_FOR_OFFICIAL_RECORD', 'COPY_RETURNED', 'NO_GATHERING'].includes(smuggledEditionEvent.stage)
      || smuggledEditionEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED'
      || smuggledEditionEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
      || smuggledEditionEvent.historicalOutcomeFixed !== false
      || smuggledEditionEvent.actorHostIds?.join(',') !== 'typesetter_nikita,bookseller_lev,student_vasily,junior_guard_sergey'
      || smuggledEditionEvent.venueMapId !== 'bookshop-interior' || smuggledEditionEvent.itemName !== item
      || smuggledEditionEvent.carrierHostId !== 'typesetter_nikita'
      || !Number.isInteger(smuggledEditionEvent.startedAtMinute) || !Number.isInteger(smuggledEditionEvent.resolvesAtMinute)
      || !itemLocationValid
      || (smuggledEditionEvent.status === 'ACTIVE') !== ['COPY_CARRIED', 'READING_READY'].includes(smuggledEditionEvent.stage)
      || (smuggledEditionEvent.status === 'RESOLVED' && (!Number.isInteger(smuggledEditionEvent.resolvedAtMinute)
        || !['E34_HIDE_COPY', 'E34_COMPARE_MARKS', 'E34_REPORT_SHEET', 'AUTO_COPY_RETURNED'].includes(smuggledEditionEvent.resolutionActionId)))) {
      throw new Error('Save contains invalid E34 bookshop copy event state');
    }
  }
  const bookbindingEvent = state.world.livingEventStates.E08;
  if (bookbindingEvent && (bookbindingEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || bookbindingEvent.catalogEventId !== 'E08'
    || !['ACTIVE', 'RESOLVED'].includes(bookbindingEvent.status) || !['ORDER_ACCEPTED', 'BOOK_BOUND', 'DELIVERED_PAID'].includes(bookbindingEvent.stage)
    || bookbindingEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED' || bookbindingEvent.valueStatus !== 'fictional_gameplay_balance'
    || bookbindingEvent.binderHostId !== 'bookbinder_elizaveta' || bookbindingEvent.booksellerHostId !== 'bookseller_lev'
    || bookbindingEvent.itemKo !== '제본 중인 책 한 권' || bookbindingEvent.contractTaskId !== 'ELIZAVETA_BOOKBINDER_ORDER_TO_LEV_1847'
    || !Number.isInteger(bookbindingEvent.dayIndex) || bookbindingEvent.dayIndex < 0
    || (bookbindingEvent.status === 'RESOLVED') !== (bookbindingEvent.stage === 'DELIVERED_PAID'))) {
    throw new Error('Save contains invalid E08 bookbinding contract event state');
  }
  const coachFareEvent = state.world.livingEventStates.E10;
  const coachFareStages = {
    COACHMAN_TIMOFEY_CHOICE_1: 'FARE_ACCEPTED_WITH_INSPECTION',
    COACHMAN_TIMOFEY_CHOICE_2: 'FARE_ACCEPTED_WITH_RISK_DISCLOSED',
    COACHMAN_TIMOFEY_CHOICE_3: 'FARE_DECLINED_FOR_REPAIR',
  };
  if (coachFareEvent && (coachFareEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || coachFareEvent.catalogEventId !== 'E10'
    || coachFareEvent.status !== 'RESOLVED' || coachFareEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED'
    || coachFareEvent.valueStatus !== 'fictional_gameplay_balance' || coachFareEvent.hostId !== 'coachman_timofey'
    || coachFareEvent.questId !== 'COACH_FARE_1847' || coachFareEvent.actorHostIds?.length !== 1
    || coachFareEvent.actorHostIds[0] !== 'coachman_timofey' || coachFareStages[coachFareEvent.actionId] !== coachFareEvent.stage
    || coachFareEvent.witnessedByPlayer !== true || typeof coachFareEvent.date !== 'string' || coachFareEvent.mapId !== 'market-quay')) {
    throw new Error('Save contains invalid E10 carriage fare event state');
  }
  const canalTrafficEvent = state.world.livingEventStates.E11;
  if (canalTrafficEvent && (canalTrafficEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || canalTrafficEvent.catalogEventId !== 'E11'
    || !['ACTIVE', 'RESOLVED'].includes(canalTrafficEvent.status)
    || !['WAITING_FOR_PARTNER', 'BOAT_TRAFFIC', 'CLEARED'].includes(canalTrafficEvent.stage)
    || canalTrafficEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED' || canalTrafficEvent.valueStatus !== 'fictional_gameplay_balance'
    || canalTrafficEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || !Array.isArray(canalTrafficEvent.actorHostIds) || canalTrafficEvent.actorHostIds.length !== 2
    || canalTrafficEvent.actorHostIds[0] !== 'coachman_timofey' || canalTrafficEvent.actorHostIds[1] !== 'watercarrier_luka'
    || canalTrafficEvent.triggerHostId !== 'coachman_timofey' && canalTrafficEvent.triggerHostId !== 'watercarrier_luka'
    || !Number.isInteger(canalTrafficEvent.startedAtMinute) || !Number.isInteger(canalTrafficEvent.clearsAtMinute)
    || (canalTrafficEvent.stage === 'WAITING_FOR_PARTNER' && (!Number.isInteger(canalTrafficEvent.partnerWaitStartedAtMinute)
      || !Number.isInteger(canalTrafficEvent.partnerDeadlineMinute)
      || canalTrafficEvent.partnerDeadlineMinute !== canalTrafficEvent.partnerWaitStartedAtMinute + 360
      || canalTrafficEvent.clearsAtMinute !== canalTrafficEvent.partnerDeadlineMinute))
    || (['BOAT_TRAFFIC', 'CLEARED'].includes(canalTrafficEvent.stage)
      && canalTrafficEvent.clearsAtMinute !== canalTrafficEvent.startedAtMinute + 21)
    || (canalTrafficEvent.status === 'ACTIVE') !== ['WAITING_FOR_PARTNER', 'BOAT_TRAFFIC'].includes(canalTrafficEvent.stage)
    || (canalTrafficEvent.status === 'RESOLVED' && (!Number.isInteger(canalTrafficEvent.resolvedAtMinute)
      || canalTrafficEvent.resolvedAtMinute < canalTrafficEvent.clearsAtMinute)))) {
    throw new Error('Save contains invalid E11 canal traffic event state');
  }
  const warehouseInjuryEvent = state.world.livingEventStates.E12;
  if (warehouseInjuryEvent && (warehouseInjuryEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || warehouseInjuryEvent.catalogEventId !== 'E12'
    || !['ACTIVE', 'RESOLVED'].includes(warehouseInjuryEvent.status)
    || !['INJURY', 'TREATED', 'RESTED', 'RESTED_UNTREATED', 'FATALITY'].includes(warehouseInjuryEvent.stage)
    || warehouseInjuryEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED' || warehouseInjuryEvent.valueStatus !== 'fictional_gameplay_balance'
    || warehouseInjuryEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || warehouseInjuryEvent.porterHostId !== 'porter_gavrila' || warehouseInjuryEvent.careHostId !== 'midwife_avdotya'
    || warehouseInjuryEvent.workActionId !== 'V37_PORTER_UNLOAD_HEAVY_SACK'
    || !Number.isInteger(warehouseInjuryEvent.startedAtMinute) || !Number.isInteger(warehouseInjuryEvent.autoResolveAtMinute)
    || !['MILD', 'CRITICAL'].includes(warehouseInjuryEvent.severity)
    || warehouseInjuryEvent.autoResolveAtMinute !== warehouseInjuryEvent.startedAtMinute + (warehouseInjuryEvent.severity === 'CRITICAL' ? 1440 : 31)
    || (warehouseInjuryEvent.severity === 'CRITICAL' && (!Number.isInteger(warehouseInjuryEvent.fatalityDeadlineMinute)
      && ['FATALITY', 'RESTED_UNTREATED'].includes(warehouseInjuryEvent.stage)))
    || !Number.isInteger(warehouseInjuryEvent.restedMinutes) || warehouseInjuryEvent.restedMinutes < 0
    || (warehouseInjuryEvent.status === 'ACTIVE') !== (warehouseInjuryEvent.stage === 'INJURY')
    || !['FELL_TO_GROUND', 'LEFT_AT_WORKSITE'].includes(warehouseInjuryEvent.cargo?.status)
    || warehouseInjuryEvent.cargo?.itemKo !== '밀가루 자루'
    || (warehouseInjuryEvent.status === 'RESOLVED' && (!Number.isInteger(warehouseInjuryEvent.resolvedAtMinute)
      || (warehouseInjuryEvent.stage === 'FATALITY' && warehouseInjuryEvent.resolutionActionId !== 'AUTO_UNTREATED_CRITICAL_INJURY'))))) {
    throw new Error('Save contains invalid E12 warehouse injury event state');
  }
  const sickLodgerEvent = state.world.livingEventStates.E15;
  if (sickLodgerEvent && (sickLodgerEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || sickLodgerEvent.catalogEventId !== 'E15'
    || !['ACTIVE', 'RESOLVED'].includes(sickLodgerEvent.status)
    || !['CARE_REQUESTED', 'CARE_ACCEPTED', 'MIDWIFE_REQUESTED', 'MIDWIFE_PRESENT', 'PRIVACY_CHOSEN',
      'CARE_COMPLETED', 'RESTED_IN_PRIVACY', 'RESTED_AFTER_HELP_REQUEST', 'RESTED_AFTER_MISSED_VISIT', 'RESTED_UNATTENDED'].includes(sickLodgerEvent.stage)
    || sickLodgerEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED' || sickLodgerEvent.valueStatus !== 'fictional_gameplay_balance'
    || sickLodgerEvent.occurrenceType !== 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION'
    || sickLodgerEvent.patientHostId !== 'lodging_tatyana' || sickLodgerEvent.caregiverHostId !== 'midwife_avdotya'
    || !Array.isArray(sickLodgerEvent.actorHostIds)
    || !['lodging_tatyana', 'lodging_tatyana,midwife_avdotya'].includes(sickLodgerEvent.actorHostIds.join(','))
    || (['MIDWIFE_PRESENT', 'CARE_COMPLETED'].includes(sickLodgerEvent.stage) !== (sickLodgerEvent.actorHostIds.join(',') === 'lodging_tatyana,midwife_avdotya'))
    || !Array.isArray(sickLodgerEvent.witnessHostIds)
    || sickLodgerEvent.witnessHostIds.some(id => !state.hosts[id])
    || sickLodgerEvent.mapId !== 'inn-interior' || !Number.isInteger(sickLodgerEvent.startedAtMinute)
    || !Number.isInteger(sickLodgerEvent.resolvesAtMinute) || sickLodgerEvent.resolvesAtMinute < sickLodgerEvent.startedAtMinute
    || !Number.isInteger(sickLodgerEvent.scenePosition?.x) || !Number.isInteger(sickLodgerEvent.scenePosition?.y)
    || (sickLodgerEvent.stage === 'MIDWIFE_REQUESTED' && (!Number.isInteger(sickLodgerEvent.requestedAtMinute)
      || sickLodgerEvent.resolvesAtMinute !== sickLodgerEvent.requestedAtMinute + 120
      || sickLodgerEvent.payerHostId !== 'lodging_tatyana' || sickLodgerEvent.carePrice !== 2))
    || (['MIDWIFE_PRESENT', 'CARE_COMPLETED'].includes(sickLodgerEvent.stage) && (!Number.isInteger(sickLodgerEvent.arrivedAtMinute)
      || sickLodgerEvent.resolvesAtMinute !== sickLodgerEvent.arrivedAtMinute + 20
      || sickLodgerEvent.payerHostId !== 'lodging_tatyana' || sickLodgerEvent.carePrice !== 2))
    || (sickLodgerEvent.status === 'ACTIVE') !== ['CARE_REQUESTED', 'CARE_ACCEPTED', 'MIDWIFE_REQUESTED', 'MIDWIFE_PRESENT', 'PRIVACY_CHOSEN'].includes(sickLodgerEvent.stage)
    || (sickLodgerEvent.status === 'RESOLVED' && (!Number.isInteger(sickLodgerEvent.resolvedAtMinute)
      || !['E15_REQUEST_NEIGHBOR_HELP', 'E15_KEEP_PRIVATE', 'AUTO_REST_WITHOUT_DIAGNOSIS', 'AUTO_REST',
        'AUTO_MIDWIFE_MISSED_VISIT', 'AUTO_MIDWIFE_VISIT_COMPLETED'].includes(sickLodgerEvent.resolutionActionId))))) {
    throw new Error('Save contains invalid E15 sick lodger event state');
  }
  const laundryEvent = state.world.livingEventStates.E04;
  if (laundryEvent && (laundryEvent.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || laundryEvent.catalogEventId !== 'E04'
    || !['ACTIVE', 'RESOLVED'].includes(laundryEvent.status) || !['LINEN_WASHED', 'LINEN_EXCHANGED', 'ACCOUNTS_RECONCILED'].includes(laundryEvent.stage)
    || laundryEvent.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED' || laundryEvent.valueStatus !== 'fictional_gameplay_balance'
    || laundryEvent.hostId !== 'laundress_mariya' || laundryEvent.itemKo !== '접은 린넨'
    || !Number.isInteger(laundryEvent.dayIndex) || laundryEvent.dayIndex < 0
    || (laundryEvent.status === 'RESOLVED') !== (laundryEvent.stage === 'ACCOUNTS_RECONCILED')
    || (laundryEvent.stage === 'LINEN_EXCHANGED' && typeof laundryEvent.recipientHostId !== 'string'))) {
    throw new Error('Save contains invalid E04 laundry event state');
  }
  state.quests ??= {};
  for (const quest of quests) {
    if (quest.historicalOutcome?.id) {
      const literary = Boolean(quest.realmId) || quest.chapterId?.startsWith('LITERARY_');
      const outcomeStore = literary ? state.world.literaryOutcomes : state.world.immutableOutcomes;
      if (!Object.hasOwn(outcomeStore, quest.historicalOutcome.id)) outcomeStore[quest.historicalOutcome.id] = quest.historicalOutcome.value;
    }
    state.quests[quest.id] ??= { status: 'open', result: null };
  }
  const seededHosts = createInitialState({ maps, hostCards, quests }).hosts;
  state.hosts ??= {};
  for (const card of hostCards) if (!state.hosts[card.id]) state.hosts[card.id] = seededHosts[card.id];
  for (const card of hostCards) {
    const host = state.hosts?.[card.id];
    if (host) {
      host.healthState ??= { condition: 'FIT', injury: null, recoveryUntilMinute: null, valueStatus: 'FICTIONAL_CHARACTER_DESIGN' };
      host.skills ??= clone(card.skills ?? {});
      host.skillsValueStatus ??= card.skillsValueStatus ?? 'FICTIONAL_CHARACTER_DESIGN';
      if (!host.skills || typeof host.skills !== 'object' || Array.isArray(host.skills)
        || host.skillsValueStatus !== 'FICTIONAL_CHARACTER_DESIGN'
        || Object.entries(host.skills).some(([skill, level]) => !/^[a-z][A-Za-z0-9]{0,39}$/.test(skill)
          || !Number.isInteger(level) || level < 0 || level > 5)) throw new Error(`Save contains invalid resident skill: ${card.id}`);
      if (!['FIT', 'INJURED', 'UNWELL', 'RECOVERING'].includes(host.healthState.condition)
        || host.healthState.valueStatus !== 'FICTIONAL_CHARACTER_DESIGN'
        || (host.healthState.condition === 'FIT' && (host.healthState.injury !== null || host.healthState.illness != null || host.healthState.recoveryUntilMinute !== null))
        || (host.healthState.condition === 'INJURED' && (!host.healthState.injury || host.healthState.illness != null || !Number.isInteger(host.healthState.injury.onsetMinute) || host.healthState.recoveryUntilMinute !== null))
        || (host.healthState.condition === 'UNWELL' && (host.healthState.injury !== null || !host.healthState.illness || !Number.isInteger(host.healthState.illness.onsetMinute) || host.healthState.recoveryUntilMinute !== null))
        || (host.healthState.condition === 'RECOVERING' && ((!host.healthState.injury && !host.healthState.illness)
          || (host.healthState.injury && host.healthState.illness) || !Number.isInteger(host.healthState.recoveryUntilMinute)))) {
        throw new Error(`Save contains invalid health state: ${card.id}`);
      }
      host.socialEstate ??= card.socialEstate;
      host.allowedMaps = [...new Set([...(host.allowedMaps ?? []), ...(card.allowedMaps ?? []), ...(card.residence?.sleepLocation?.mapId ? [card.residence.sleepLocation.mapId] : [])])];
      host.relations ??= {};
      for (const [otherId, description] of Object.entries(card.relations ?? {})) host.relations[otherId] ??= description;
      const authoredSchedule = authoredDailySchedule(card);
      const persistedSchedule = host.housing?.evictionStatus === 'EVICTED'
        ? authoredSchedule.filter(slot => slot.routineKind !== 'FICTIONAL_HOME_SLEEP') : authoredSchedule;
      const authoredMinutes = new Set(persistedSchedule.map(slot => slot.atMinute));
      host.schedule = [...(host.schedule ?? []).filter(slot => !authoredMinutes.has(slot.atMinute)), ...persistedSchedule].sort((a,b) => a.atMinute - b.atMinute);
      if (host.completedSocialTaskDayById !== undefined) {
        const repeatTaskIds = new Set(host.schedule.flatMap(slot => slot.task?.repeatDaily === true ? [slot.task.id] : []));
        if (!host.completedSocialTaskDayById || typeof host.completedSocialTaskDayById !== 'object' || Array.isArray(host.completedSocialTaskDayById)
          || Object.entries(host.completedSocialTaskDayById).some(([taskId, dayIndex]) => !repeatTaskIds.has(taskId)
            || !Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > Math.floor(state.world.clockMinutes / 1440))) {
          throw new Error(`Save contains invalid daily task completion state: ${card.id}`);
        }
      }
      host.situationNotes ??= [];
      host.activeGoal ??= null;
      host.plannerPolicy = clone(card.plannerPolicy ?? host.plannerPolicy ?? {});
      host.todayGoals ??= clone(card.todayGoals ?? []);
      host.personalGoals ??= clone(card.persistentPersonalGoals ?? []);
      host.personalGoalProgress ??= Object.fromEntries((host.personalGoals ?? []).map(goal => [goal.id, { status: 'ACTIVE' }]));
      for(const goal of card.persistentPersonalGoals??[]){host.personalGoalProgress[goal.id]??={status:'ACTIVE'};}
      syncPersistentPersonalGoals(state,card.id);
      host.needs ??= initialNpcNeeds(card, state.world.clockMinutes);
      host.relationshipMemory ??= {};
      host.marketOffers ??= clone(card.marketOffers ?? []);
      if (JSON.stringify(host.marketOffers) !== JSON.stringify(card.marketOffers ?? [])) throw new Error(`Save contains invalid market offers: ${card.id}`);
      host.marketStock ??= clone(card.marketStock ?? {});
      if (!host.marketStock || typeof host.marketStock !== 'object' || Array.isArray(host.marketStock)
        || Object.entries(host.marketStock).some(([item, count]) => !(card.marketOffers ?? []).some(offer => offer.itemKo === item)
          || !Number.isInteger(count) || count < 0)) throw new Error(`Save contains invalid market stock: ${card.id}`);
      host.housing ??= card.housing ? clone(card.housing) : null;
      host.residence ??= card.residence ? clone(card.residence) : null;
      if (JSON.stringify(host.residence) !== JSON.stringify(card.residence ?? null)) throw new Error(`Save contains invalid residence assignment: ${card.id}`);
      host.places ??= clone(seededHosts[card.id].places);
      if (host.places.homeLocationStatus === 'NOT_AUTHORED' && seededHosts[card.id].places.homeLocationStatus !== 'NOT_AUTHORED') {
        host.places.homeLocation = clone(seededHosts[card.id].places.homeLocation);
        host.places.homeLocationStatus = seededHosts[card.id].places.homeLocationStatus;
        host.places.residenceKind = seededHosts[card.id].places.residenceKind;
      }
      const knownSleepLocations = new Set(host.places.sleepLocations.map(place => `${place.mapId}:${place.position?.x}:${place.position?.y}`));
      if (host.housing?.evictionStatus !== 'EVICTED') {
        for (const place of seededHosts[card.id].places.sleepLocations) {
          const key = `${place.mapId}:${place.position?.x}:${place.position?.y}`;
          if (!knownSleepLocations.has(key)) { host.places.sleepLocations.push(clone(place)); knownSleepLocations.add(key); }
        }
      }
      if (host.places.status !== 'FICTIONAL_GAMEPLAY_PROFILE' || !Array.isArray(host.places.workLocations)
        || !Array.isArray(host.places.sleepLocations)
        || (host.places.homeLocation !== null && (typeof host.places.homeLocation?.mapId !== 'string'
          || !Number.isInteger(host.places.homeLocation?.position?.x) || !Number.isInteger(host.places.homeLocation?.position?.y)))) {
        throw new Error(`Save contains invalid resident place profile: ${card.id}`);
      }
      host.pendingWageClaims ??= [];
      const defaultNeeds = initialNpcNeeds(card, state.world.clockMinutes);
      for (const [key, value] of Object.entries(defaultNeeds)) host.needs[key] ??= value;
      for (const key of ['hunger', 'fatigue', 'incomePressure', 'safetyConcern', 'socialNeed', 'restThreshold']) {
        if (!Number.isFinite(host.needs[key]) || host.needs[key] < 0 || host.needs[key] > 100) throw new Error(`Save contains invalid NPC need: ${card.id}.${key}`);
      }
      if (!Number.isInteger(host.needs.foodDeprivationMinutes) || host.needs.foodDeprivationMinutes < 0 || host.needs.foodDeprivationMinutes > 360) throw new Error(`Save contains invalid food deprivation state: ${card.id}`);
      const slot = scheduleEntry(host, state.world.clockMinutes);
      host.scheduleId ??= slot ? `${slot.mapId}:${slot.atMinute}` : null;
      host.currentActivityKo ??= slot?.activityKo ?? '';
      host.routineState ??= { state: 'IDLE', activityKo: host.currentActivityKo, targetMapId: slot?.mapId ?? host.mapId, targetPosition: slot?.position ? { ...slot.position } : { ...host.position }, changedAtMinute: state.world.clockMinutes, minutesInState: 0 };
    }
  }
  migrateRelationshipEdges(state, hostCards);
  const ids = new Set(hostCards.map(card => card.id));
  if (!maps[state.world?.currentMapId] || Object.keys(state.hosts ?? {}).length !== ids.size || Object.keys(state.hosts).some(id => !ids.has(id))) throw new Error('Save does not match this campaign');
  if (state.player.embodiment && !ids.has(state.player.embodiment)) throw new Error('Save references an unknown host');
  if (state.player.embodiment && state.hosts[state.player.embodiment].mapId !== state.world.currentMapId) throw new Error('Possessed host is outside the current map');
  const sourceIds = new Set(Object.values(maps).flatMap(map => (layer(map, 'Interactions')?.objects ?? []).map(properties).map(item => item.sourceId).filter(Boolean)));
  const evidenceIds = new Set(Object.values(maps).flatMap(map => (layer(map, 'Interactions')?.objects ?? []).map(properties).map(item => item.evidenceId).filter(Boolean)));
  const recordIds = new Set([...sourceIds, ...evidenceIds]);
  const cataloguedFoodItems = new Set(hostCards.flatMap(card => (card.marketOffers ?? [])
    .filter(offer => offer.category === 'food').map(offer => offer.itemKo)));
  if (!Array.isArray(state.world.foodAidRecords) || state.world.foodAidRecords.some(row => !row
    || !state.hosts[row.recipientHostId] || !state.hosts[row.donorHostId] || row.recipientHostId === row.donorHostId
    || !cataloguedFoodItems.has(row.itemKo) || row.kind !== 'KIN_FOOD_AID' || !Number.isInteger(row.minute)
    || !Number.isFinite(row.hungerBefore) || row.hungerBefore < 82 || row.hungerBefore > 100
    || !Number.isFinite(row.hungerAfter) || row.hungerAfter < 0 || row.hungerAfter >= row.hungerBefore
    || !row.debt || !['GIFT', 'OUTSTANDING', 'PAID'].includes(row.debt.status)
    || !Number.isInteger(row.debt.amountDue) || row.debt.amountDue < 0
    || !Number.isInteger(row.debt.amountRepaid) || row.debt.amountRepaid < 0 || row.debt.amountRepaid > row.debt.amountDue
    || typeof row.debt.unit !== 'string'
    || (row.debt.status === 'GIFT' && (row.debt.amountDue !== 0 || row.debt.amountRepaid !== 0))
    || (row.debt.status === 'PAID' && row.debt.amountRepaid !== row.debt.amountDue)
    || (row.debt.status === 'OUTSTANDING' && row.debt.amountRepaid >= row.debt.amountDue))) {
    throw new Error('Save contains invalid kin food-aid record');
  }
  const discovered = new Set(state.world.discoveredSourceIds ?? []);
  if ([...(state.player.observedEvidenceIds ?? []), ...discovered].some(id => !recordIds.has(id))) throw new Error('Save references an unknown source or clue');
  for (const card of hostCards) {
    const host = state.hosts[card.id];
    const circleEvent = state.world.livingEventStates?.E24;
    const eventVenueAccess = ['ACTIVE', 'RESOLVED'].includes(circleEvent?.status)
      && circleEvent.organizerHostId === card.id
      && circleEvent.actorHostIds?.includes(card.id)
      && circleEvent.venueMapId === host.mapId;
    if (!maps[host.mapId] || (!card.allowedMaps.includes(host.mapId) && !eventVenueAccess)
      || !Array.isArray(host.privateKnowledgeIds) || host.privateKnowledgeIds.some(id => !card.privateKnowledgeIds.includes(id))) throw new Error('Save contains invalid host state');
    if (!host.relationshipMemory || typeof host.relationshipMemory !== 'object' || Array.isArray(host.relationshipMemory)) throw new Error(`Save contains invalid relationship memory: ${card.id}`);
    if (!Array.isArray(host.knownRumors) || host.knownRumors.some(row => !row || row.eventId !== 'E23' || row.sourceEventId !== 'E13'
      || !['UNVERIFIED', 'CHECKED', 'CORRECTED'].includes(row.status) || !ids.has(row.fromHostId)
      || !Number.isInteger(row.atMinute) || (row.recordNumber !== null && typeof row.recordNumber !== 'string' && !Number.isInteger(row.recordNumber)))) throw new Error(`Save contains invalid rumor knowledge: ${card.id}`);
    for (const [otherId, memory] of Object.entries(host.relationshipMemory)) {
      const mirror = state.hosts[otherId]?.relationshipMemory?.[card.id];
      if (!mirror || !Number.isInteger(memory?.meetingCount) || memory.meetingCount < 1 || memory.meetingCount !== mirror.meetingCount
        || !Number.isInteger(memory?.firstMetAtMinute) || memory.firstMetAtMinute !== mirror.firstMetAtMinute
        || !Number.isInteger(memory?.lastMetAtMinute) || memory.lastMetAtMinute !== mirror.lastMetAtMinute
        || typeof memory?.lastMetDate !== 'string' || memory.lastMetDate !== mirror.lastMetDate
        || !maps[memory?.lastMetMapId] || memory.lastMetMapId !== mirror.lastMetMapId
        || !['첫 대화를 나눈 사이', '얼굴을 익힌 사이', '자주 마주치는 사이', '꾸준히 만나는 사이'].includes(memory?.familiarity)
        || memory.familiarity !== mirror.familiarity) throw new Error(`Save contains invalid relationship memory: ${card.id}:${otherId}`);
    }
    if ((host.knownEvidenceIds ?? []).some(id => !recordIds.has(id) || !state.ledger.some(entry => entry.hostId === card.id && (entry.sourceId === id || entry.evidenceId === id)))) throw new Error('Save leaked undiscovered source knowledge to a host');
    if ((host.witnessedKnowledgeIds ?? []).some(id => !state.ledger.some(entry => entry.hostId === card.id && (entry.sourceId === id || entry.evidenceId === id)))) throw new Error('Save forged witnessed host knowledge');
    if (!Number.isInteger(host.position?.x) || !Number.isInteger(host.position?.y) || host.position.x < 0 || host.position.y < 0 || host.position.x >= maps[host.mapId].width || host.position.y >= maps[host.mapId].height) throw new Error('Save contains an invalid host position');
  }
  if (!Number.isInteger(state.player.position?.x) || !Number.isInteger(state.player.position?.y) || state.player.position.x < 0 || state.player.position.y < 0 || state.player.position.x >= maps[state.world.currentMapId].width || state.player.position.y >= maps[state.world.currentMapId].height) throw new Error('Save contains an invalid player position');
  for (const quest of quests) {
    if (!quest.historicalOutcome?.id) continue;
    const outcomeStore = (Boolean(quest.realmId) || quest.chapterId?.startsWith('LITERARY_')) ? state.world.literaryOutcomes : state.world.immutableOutcomes;
    if (outcomeStore?.[quest.historicalOutcome.id] !== quest.historicalOutcome.value) throw new Error('Save modified an immutable historical or literary outcome');
  }
  return state;
}

const V33GameState = { describeHostMoney, createInitialState, moveActor, possessHost, enterLiteraryRealm, leaveLiteraryRealm, releaseHost, transitionMap, performQuestAction, payRent, knowledgeForHost, recordSourceRead, recordEvidenceRead, recordDialogueTurn, recordDiscussionPosition, advanceNpcWorld, advanceWorldTime, advanceChapter, advanceCampaignDate, resolveEnding, saveGame, loadGame, stateHash, canOccupy, nearTile, playerCanObserveWorldEvent };
if (typeof module !== 'undefined' && module.exports) module.exports = V33GameState;
if (typeof globalThis !== 'undefined') globalThis.V33GameState = V33GameState;
