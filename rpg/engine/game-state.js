'use strict';

const SAVE_VERSION = 36;
const DIRECTIONS = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] });

function layer(map, name) { return map?.layers?.find(item => item.name === name); }
function properties(object) { return Object.fromEntries((object?.properties ?? []).map(item => [item.name, item.value])); }
function tileAt(dataLayer, x, y) {
  if (!dataLayer || x < 0 || y < 0 || x >= dataLayer.width || y >= dataLayer.height) return 1;
  return Number(dataLayer.data[y * dataLayer.width + x] ?? 0);
}
function nearTile(position, tile, maxDistance = 1) {
  return Math.abs(position.x - tile.x) + Math.abs(position.y - tile.y) <= maxDistance;
}
function playerCanObserveWorldEvent(state, mapId, position, maxDistance = 6) {
  return Boolean(state?.world?.currentMapId === mapId && state?.player?.position
    && position && nearTile(state.player.position, position, maxDistance));
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
    lastMealAtMinute: clockMinutes };
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

function createInitialState({ maps, hostCards, quests = [], startMapId = 'nevsky' }) {
  if (!maps?.[startMapId] || !Array.isArray(hostCards) || hostCards.length < 1) throw new Error('A known start map and host cards are required');
  const map = maps[startMapId];
  const spawn = map.metadata?.observerStart ?? { x: 2, y: 2 };
  const hosts = Object.fromEntries(hostCards.map(card => [card.id, {
    id: card.id,
    kind: card.kind,
    socialEstate: card.socialEstate,
    mapId: card.start.mapId,
    position: { x: card.start.x, y: card.start.y },
    schedule: clone(card.schedule ?? []),
    scheduleId: null,
    plannedPath: { key: null, tiles: [] },
    mapRoutePlan: { key: null, route: null },
    currentActivityKo: '',
    routineState: { state: 'IDLE', activityKo: '', targetMapId: card.start.mapId, targetPosition: { x: card.start.x, y: card.start.y }, changedAtMinute: 540, minutesInState: 0 },
    activeGoal: null,
    needs: initialNpcNeeds(card),
    situationNotes: [],
    facing: 'down',
    historicalAliveAndPresent: true,
    money: { ...card.money },
    inventory: [...card.inventory],
    privateKnowledgeIds: [...card.privateKnowledgeIds],
    witnessedKnowledgeIds: [],
    knownEvidenceIds: [...card.knownEvidenceIds],
    relations: clone(card.relations ?? {}),
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
      date: map.metadata?.date ?? '1847-06-01',
      currentMapId: startMapId,
      clockMinutes: 540,
      discoveredSourceIds: [],
      witnessedFacts: [],
      worldFlags: {},
      lifeChains: {},
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
function pendingTaskSlot(host, taskTypes, localMinute) {
  const types = new Set(Array.isArray(taskTypes) ? taskTypes : [taskTypes]);
  return [...(host.schedule ?? [])]
    .filter(slot => slot.atMinute <= localMinute && types.has(slot.task?.type)
      && host.routineTaskCompletedId !== slot.task.id && !host.completedSocialTaskIds?.includes(slot.task.id)
      && typeof slot.task.itemKo === 'string' && host.inventory?.includes(slot.task.itemKo))
    .sort((a, b) => b.atMinute - a.atMinute)[0] ?? null;
}

function routineActivityState(activityKo = '', task = null) {
  if (task?.type === 'DELIVER') return 'DELIVERING';
  if (/식사|쉬|휴식|잠|문을 닫|하루를 마|집으로 돌아/.test(activityKo)) return 'RESTING';
  if (/사러|팔|값을|장사|손님|거래|물건을 건네|물건을 전/.test(activityKo)) return 'TRADING';
  if (/대화|읽|수업|모임|이야기|방문/.test(activityKo)) return 'SOCIALIZING';
  if (activityKo) return 'WORKING';
  return 'IDLE';
}

function setRoutineState(worldState, host, state, activityKo, targetMapId, targetPosition, absoluteMinute, stateChanges, minuteOffset) {
  const previous = host.routineState?.state ?? 'IDLE';
  if (previous !== state || host.routineState?.activityKo !== activityKo || host.routineState?.targetMapId !== targetMapId) {
    host.routineState = { state, activityKo, targetMapId, targetPosition: targetPosition ? { ...targetPosition } : null, changedAtMinute: absoluteMinute, minutesInState: 0 };
    stateChanges.push({ hostId: host.id, minute: minuteOffset, from: previous, to: state, activityKo, mapId: host.mapId,
      position: { ...host.position }, witnessedByPlayer: playerCanObserveWorldEvent(worldState, host.mapId, host.position) });
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
function npcMapRoute(startMapId, targetMapId, host, maps, absoluteMinute = 540) {
  if (startMapId === targetMapId) return [];
  const queue = [startMapId], prior = new Map([[startMapId, null]]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const mapId = queue[cursor], map = maps?.[mapId];
    if (!map) continue;
    for (const exit of mapExitObjects(map)) {
      const nextId = exit.data.targetMapId, nextMap = maps?.[nextId];
      if (!nextMap || prior.has(nextId) || !host.allowedMaps.includes(nextId)) continue;
      if (mapAccessFailure(nextMap, host, absoluteMinute)) continue;
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
  const key = `${host.mapId}>${targetMapId}:${host.allowedMaps.join('|')}:${accessPhase}`;
  if (host.mapRoutePlan?.key === key && Array.isArray(host.mapRoutePlan.route)) {
    return host.mapRoutePlan.route.map(step => {
      const exit = mapExitObjects(maps[step.fromMapId]).find(item => item.data.exitId === step.exitId);
      return exit ? { ...step, exit } : null;
    }).filter(Boolean);
  }
  const route = npcMapRoute(host.mapId, targetMapId, host, maps, absoluteMinute);
  host.mapRoutePlan = { key, route: route?.map(step => ({ fromMapId: step.fromMapId, toMapId: step.toMapId, exitId: step.exit.data.exitId })) ?? null };
  return route;
}
function nextNpcStep(state, host, slot, maps, reservedTiles) {
  if (host.mapId !== slot.mapId) {
    const route = plannedMapRoute(host, slot.mapId, maps, state.world.clockMinutes);
    if (!route?.length) return null;
    const { exit, toMapId } = route[0], fromMap = maps[host.mapId], toMap = maps[toMapId];
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
  const hostIds = new Set(), mapIds = new Set();
  for (const sender of Object.values(state.hosts)) for (const slot of sender.schedule ?? []) {
    const task = slot.task;
    if (!task || !['DELIVER', 'EXCHANGE'].includes(task.type) || sender.routineTaskCompletedId === task.id || sender.completedSocialTaskIds?.includes(task.id) || !sender.inventory.includes(task.itemKo)) continue;
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
  const scheduledTask = scheduledSlot?.task;
  const activeSocialSlot = pendingTaskSlot(host, ['DELIVER', 'EXCHANGE'], localMinute);
  const activeSocialTask = activeSocialSlot?.task;
  const socialForecast = upcomingNpcSocialWork(state);
  const imminentSocialTask = socialForecast.hostIds.has(host.id);
  const candidates = [];
  const addCandidate = (goal, utility, priority) => {
    if (!goal?.slot || !Number.isFinite(utility)) return;
    candidates.push({ ...goal, selectionBasis: { ...(goal.selectionBasis ?? {}), utilityScore: Math.round(utility * 100) / 100 }, _priority: priority });
  };
  if (activeSocialTask) {
    const recipient = state.hosts[activeSocialTask.recipientHostId];
    const canPay = activeSocialTask.type !== 'EXCHANGE' || (Number.isInteger(activeSocialTask.moneyAmount) && activeSocialTask.moneyAmount > 0 && Number.isFinite(recipient?.money?.amount) && recipient.money.amount >= activeSocialTask.moneyAmount);
    if (recipient && canPay && recipient.id !== state.player.embodiment && recipient.historicalAliveAndPresent !== false && host.allowedMaps.includes(recipient.mapId) && npcMapRoute(host.mapId, recipient.mapId, host, maps, state.world.clockMinutes) !== null) {
      return { slot: { ...activeSocialSlot, mapId: recipient.mapId, position: { ...recipient.position } }, goalType: activeSocialTask.type === 'DELIVER' ? 'FOLLOW_RECIPIENT' : 'FOLLOW_TRADE_PARTNER', targetHostId: recipient.id, taskId: activeSocialTask.id, reason: 'committed_social_task', selectionBasis: { utilityScore: 100, committedTask: true } };
    }
  }

  const todayGoalKinds = new Set((host.todayGoals ?? []).map(goal => goal.kind));
  const personalPriority = Number.isFinite(host.plannerPolicy?.personalPriority) ? host.plannerPolicy.personalPriority : 0.5;
  addCandidate({ slot: scheduledSlot, goalType: 'SCHEDULE', targetHostId: null, taskId: scheduledTask?.id ?? null, reason: 'authored_daily_schedule' },
    43 + (scheduledTask ? 3 : 0), 0);

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
  const lifeFocus = selectPersonalLifeFocus(state, host, maps, localMinute, imminentSocialTask);
  if (lifeFocus) {
    const activeStage = host.activeGoal?.type === lifeFocus.goalType && host.activeGoal?.taskId === lifeFocus.taskId;
    addCandidate(lifeFocus, 80 + personalPriority * 14 + (todayGoalKinds.has('personal') ? 4 : 0) + (activeStage ? 9 : 0), 3);
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
  const relationshipTarget = relationshipTargetId ? state.hosts[relationshipTargetId] : null;
  const socialPriority = Number.isFinite(host.plannerPolicy?.socialPriority) ? host.plannerPolicy.socialPriority : 0.8;
  const riskTolerance = Number.isFinite(host.plannerPolicy?.riskTolerance) ? host.plannerPolicy.riskTolerance : 0.5;
  const localMinuteOfDay = ((state.world.clockMinutes % 1440) + 1440) % 1440;
  const optionalTravelRisk = (host.needs?.safetyConcern ?? 25) * (1 - riskTolerance)
    + (localMinuteOfDay >= 1200 || localMinuteOfDay < 360 ? 18 : 0);
  const riskAdjustedSocialThreshold = Math.max(28, Math.min(42,
    Math.round(36 - socialPriority * 8 + Math.min(6, optionalTravelRisk * 0.1))));
  const socialNeedThreshold = relationshipGoal?.successCondition?.autonomyNeedThreshold ?? riskAdjustedSocialThreshold;
  const contactDay = Math.floor(state.world.clockMinutes / 1440);
  const contactTaskId = relationshipGoal ? `${relationshipGoal.id}:DAY_${contactDay}` : null;
  const awaitingIncomingGoods = Object.values(state.hosts).some(sender => {
    const task=scheduleEntry(sender,state.world.clockMinutes)?.task;
    return ['DELIVER','EXCHANGE'].includes(task?.type)&&task.recipientHostId===host.id
      &&sender.id!==state.player.embodiment&&sender.historicalAliveAndPresent!==false&&sender.routineTaskCompletedId!==task.id&&!sender.completedSocialTaskIds?.includes(task.id);
  });
  if (!imminentSocialTask && relationshipGoal && relationshipTarget && relationshipTarget.id !== state.player.embodiment
    && relationshipTarget.historicalAliveAndPresent !== false && host.needs?.socialNeed >= socialNeedThreshold
    && host.needs.fatigue < Math.max(0, (host.needs.restThreshold ?? 72) - 10)
    && !awaitingIncomingGoods
    && host.lastPersonalContactTaskId !== contactTaskId
    && host.allowedMaps.includes(relationshipTarget.mapId)
    && npcMapRoute(host.mapId, relationshipTarget.mapId, host, maps, state.world.clockMinutes) !== null) {
    addCandidate({ slot: { mapId: relationshipTarget.mapId, position: { ...relationshipTarget.position }, activityKo: '개인적인 약속을 확인하려 이웃과 이야기를 나누러 간다' },
      goalType: 'PERSONAL_RELATIONSHIP', targetHostId: relationshipTarget.id, taskId: contactTaskId, reason: 'relationship_goal_selected_by_social_need_and_travel_risk',
      selectionBasis: { socialNeed: host.needs.socialNeed, threshold: socialNeedThreshold, socialPriority, optionalTravelRisk, riskTolerance } },
      60 + host.needs.socialNeed * 0.5 + socialPriority * 16 - optionalTravelRisk * 0.2 + (todayGoalKinds.has('social') ? 4 : 0), 5);
  }
  candidates.sort((a, b) => b.selectionBasis.utilityScore - a.selectionBasis.utilityScore || a._priority - b._priority || a.goalType.localeCompare(b.goalType));
  const selected = candidates[0] ?? { slot: scheduledSlot, goalType: 'SCHEDULE', targetHostId: null, taskId: scheduledTask?.id ?? null, reason: 'authored_daily_schedule' };
  delete selected._priority;
  return selected;
}
function selectPersonalLifeFocus(state, host, maps, localMinute, imminentSocialTask) {
  if (imminentSocialTask) return null;
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
function recordNpcGoal(state, host, goal, absoluteMinute, minuteOffset, goalRows) {
  const next = { type: goal.goalType, taskId: goal.taskId, targetHostId: goal.targetHostId, targetMapId: goal.slot?.mapId ?? null,
    reason: goal.reason, ...(goal.selectionBasis ? { selectionBasis: clone(goal.selectionBasis) } : {}) };
  const previous = host.activeGoal;
  if (!previous || previous.type !== next.type || previous.taskId !== next.taskId || previous.targetHostId !== next.targetHostId || previous.targetMapId !== next.targetMapId) {
    host.activeGoal = { ...next, selectedAtMinute: absoluteMinute };
    goalRows.push({ hostId: host.id, minute: minuteOffset, ...host.activeGoal, mapId: host.mapId,
      position: { ...host.position }, witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position) });
  }
}
function simulateNpcMinute(state, maps, options, minuteOffset, movementLog, stateChanges) {
  const embodiedId = state.player.embodiment, paused = new Set(options.pausedHostIds ?? []), reservedTiles = [...(options.reservedTiles ?? [])];
  if (!state.player.embodiment) reservedTiles.push({ mapId: state.world.currentMapId, position: state.player.position });
  const moveRows = [], deliveryRows = [], exchangeRows = [], mealRows = [], goalRows = [], personalContactRows = [], restRecoveryRows = [], personalGoalRows = [], workRows = [];
  const hosts = Object.values(state.hosts).sort((a, b) => a.id.localeCompare(b.id));
  for (const host of hosts) {
    const scheduledSlot = scheduleEntry(host, state.world.clockMinutes);
    if (!scheduledSlot) continue;
    const scheduleId = `${scheduledSlot.mapId}:${scheduledSlot.atMinute}`;
    if (host.scheduleId !== scheduleId) host.routineTaskCompletedId = null;
    host.scheduleId = scheduleId;
    const currentMap = maps?.[host.mapId];
    const inActiveRealm = currentMap?.metadata?.mapClass === 'LITERARY_REALM';
    if (host.id === embodiedId) {
      if (host.activeGoal?.type !== 'POSSESSED') host.activeGoal = { type: 'POSSESSED', taskId: null, targetHostId: null, targetMapId: host.mapId, reason: 'player_controls_embodied_host', selectedAtMinute: state.world.clockMinutes };
      setRoutineState(state, host, 'POSSESSED', host.currentActivityKo, host.mapId, host.position, state.world.clockMinutes, stateChanges, minuteOffset);
      continue;
    }
    if (paused.has(host.id) || host.historicalAliveAndPresent === false || inActiveRealm !== Boolean(state.world.activeRealm)) continue;
    host.needs ??= initialNpcNeeds(host, state.world.clockMinutes);
    const goal = selectNpcRoutineGoal(state, host, scheduledSlot, maps), slot = goal.slot;
    if (!slot || !maps?.[slot.mapId]) continue;
    recordNpcGoal(state, host, goal, state.world.clockMinutes, minuteOffset, goalRows);
    host.currentActivityKo = slot.activityKo ?? '';
    const workAction = slot.workAction;
    const atWorkplace = host.mapId === slot.mapId && nearTile(host.position, slot.position, workAction ? 2 : 1);
    const routine = atWorkplace ? (goal.goalType === 'PERSONAL_LIFE_FOCUS' || workAction ? 'WORKING' : routineActivityState(host.currentActivityKo, slot.task)) : 'TRAVELLING';
    const previousRoutine = host.routineState?.state ?? 'IDLE';
    const fatigueBeforeRoutine = host.needs.fatigue;
    setRoutineState(state, host, routine, host.currentActivityKo, slot.mapId, slot.position, state.world.clockMinutes, stateChanges, minuteOffset);
    if (atWorkplace && goal.goalType !== 'PERSONAL_LIFE_FOCUS' && ['WORKING', 'TRADING', 'SOCIALIZING'].includes(routine)
      && workAction && typeof workAction.id === 'string' && typeof workAction.outputKo === 'string'
      && Number.isInteger(workAction.durationMinutes) && workAction.durationMinutes > 0) {
      const dayIndex = Math.floor(state.world.clockMinutes / 1440), completionKey = `${dayIndex}:${workAction.id}`;
      host.completedWorkActionKeys ??= [];
      host.workActionProgress ??= {};
      if (!host.completedWorkActionKeys.includes(completionKey)) {
        for (const key of Object.keys(host.workActionProgress)) if (!key.startsWith(`${dayIndex}:`)) delete host.workActionProgress[key];
        host.workActionProgress[completionKey] = (host.workActionProgress[completionKey] ?? 0) + 1;
        if (host.workActionProgress[completionKey] >= workAction.durationMinutes) {
          delete host.workActionProgress[completionKey];
          host.completedWorkActionKeys.push(completionKey);
          if (host.completedWorkActionKeys.length > 64) host.completedWorkActionKeys.splice(0, host.completedWorkActionKeys.length - 64);
          host.workRecords ??= [];
          const record = { dayIndex, actionId: workAction.id, outputKind: workAction.outputKind ?? 'WORK_PRODUCT', outputKo: workAction.outputKo,
            minute: minuteOffset, mapId: host.mapId, ...(typeof workAction.inventoryItemKo === 'string' ? { inventoryItemKo: workAction.inventoryItemKo } : {}) };
          host.workRecords.push(record);
          if (host.workRecords.length > 32) host.workRecords.splice(0, host.workRecords.length - 32);
          if (typeof workAction.inventoryItemKo === 'string' && !host.inventory.includes(workAction.inventoryItemKo)) host.inventory.push(workAction.inventoryItemKo);
          workRows.push({ hostId: host.id, ...record, position: { ...host.position }, witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position) });
        }
      }
    }
    if (goal.goalType === 'PERSONAL_LIFE_FOCUS' && atWorkplace && host.personalGoalLastVisitKey !== goal.taskId) {
      host.personalGoalLastVisitKey = goal.taskId;
      host.personalGoalFocusUntilMinute = state.world.clockMinutes + goal.lifeFocusMinutes;
      personalGoalRows.push({ hostId: host.id, goalId: goal.lifeGoalId, questId: goal.lifeQuestId, stage: goal.lifeStage,
        mapId: host.mapId, position: { ...host.position }, minute: minuteOffset, activityKo: host.currentActivityKo,
        witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position) });
    }
    if (goal.goalType === 'PERSONAL_RELATIONSHIP' && atWorkplace && host.lastPersonalContactTaskId !== goal.taskId) {
      const partner = state.hosts[goal.targetHostId];
      if (partner && partner.historicalAliveAndPresent !== false && partner.mapId === host.mapId && nearTile(host.position, partner.position, 1)) {
        host.lastPersonalContactTaskId = goal.taskId;
        host.needs.socialNeed = Math.max(0, host.needs.socialNeed - 20);
        partner.needs ??= initialNpcNeeds(partner, state.world.clockMinutes);
        partner.needs.socialNeed = Math.max(0, partner.needs.socialNeed - 8);
        personalContactRows.push({ hostId: host.id, partnerHostId: partner.id, goalId: goal.taskId, mapId: host.mapId, position: { ...host.position }, minute: minuteOffset, effect: 'social_need_relieved', witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position) });
      }
    }
    host.needs.hunger = Math.min(100, host.needs.hunger + host.needs.hungerPerMinute);
    host.needs.fatigue = Math.max(0, Math.min(100, host.needs.fatigue + (routine === 'RESTING' ? -host.needs.restFatigueReliefPerMinute : routine === 'TRAVELLING' ? 0.01 : host.needs.workFatiguePerMinute)));
    if (routine === 'RESTING' && previousRoutine !== 'RESTING' && host.needs.fatigue < fatigueBeforeRoutine) restRecoveryRows.push({ hostId: host.id, minute: minuteOffset, mapId: host.mapId, position: { ...host.position }, fatigueBefore: fatigueBeforeRoutine, fatigueAfter: host.needs.fatigue, witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position) });
    if (routine === 'SOCIALIZING') host.needs.socialNeed = Math.max(0, (host.needs.socialNeed ?? 0) - 0.05);
    else host.needs.socialNeed = Math.min(100, (host.needs.socialNeed ?? 0) + 0.004);
    if (routine === 'WORKING' && host.needs.incomePressure > 0) host.needs.incomePressure = Math.max(0, host.needs.incomePressure - host.needs.incomeReliefPerMinute);
    if (state.world.clockMinutes % 5 !== 0) continue;
    const before = { mapId: host.mapId, position: { ...host.position } };
    const step = nextNpcStep(state, host, slot, maps, reservedTiles);
    if (step) { host.mapId = step.mapId; host.position = step.position; host.facing = step.facing; }
    if (before.mapId !== host.mapId || before.position.x !== host.position.x || before.position.y !== host.position.y) {
      const row = { hostId: host.id, minute: minuteOffset, scheduleId, activityKo: host.currentActivityKo, fromMapId: before.mapId, from: before.position, toMapId: host.mapId, to: { ...host.position }, viaExit: step?.viaExit ?? null,
        witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position) };
      moveRows.push(row); movementLog.push(row);
    }
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
    deliveryRows.push({ hostId: host.id, recipientHostId: recipient.id, itemKo: task.itemKo, taskId: task.id, mapId: host.mapId, position: { ...host.position }, minute: minuteOffset, witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position) });
  }
  for (const host of hosts) {
    const localMinute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
    const slot = pendingTaskSlot(host, 'EXCHANGE', localMinute), task = slot?.task;
    if (!task || host.id === embodiedId || paused.has(host.id) || host.historicalAliveAndPresent === false) continue;
    if (Number.isInteger(task.notBeforeMinute) && localMinute < task.notBeforeMinute) continue;
    const recipient = state.hosts[task.recipientHostId], moneyAmount = task.moneyAmount;
    if (!recipient || recipient.id === embodiedId || recipient.historicalAliveAndPresent === false || recipient.mapId !== host.mapId || !nearTile(recipient.position, host.position, 1)) continue;
    if (typeof task.itemKo !== 'string' || !host.inventory.includes(task.itemKo) || !Number.isInteger(moneyAmount) || moneyAmount <= 0 || !Number.isFinite(host.money?.amount) || !Number.isFinite(recipient.money?.amount) || recipient.money.amount < moneyAmount) continue;
    host.inventory.splice(host.inventory.indexOf(task.itemKo), 1);
    if (!recipient.inventory.includes(task.itemKo)) recipient.inventory.push(task.itemKo);
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
    host.routineTaskCompletedId = task.id;
    host.completedSocialTaskIds ??= [];
    if (!host.completedSocialTaskIds.includes(task.id)) host.completedSocialTaskIds.push(task.id);
    exchangeRows.push({ hostId: host.id, recipientHostId: recipient.id, itemKo: task.itemKo, moneyAmount, taskId: task.id, mapId: host.mapId, position: { ...host.position }, minute: minuteOffset, witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position) });
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
    host.routineTaskCompletedId = task.id;
    mealRows.push({ hostId: host.id, itemKo: task.itemKo, hungerBefore, hungerAfter: host.needs.hunger, taskId: task.id, mapId: host.mapId, position: { ...host.position }, minute: minuteOffset, witnessedByPlayer: playerCanObserveWorldEvent(state, host.mapId, host.position) });
  }
  return { moveRows, deliveryRows, exchangeRows, mealRows, goalRows, personalContactRows, restRecoveryRows, personalGoalRows, workRows };
}

function advanceNpcWorld(state, elapsedMinutes, maps, options = {}) {
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes <= 0) return state;
  const next = clone(state);
  const tickCount = Math.min(10080, Math.max(1, Math.floor(elapsedMinutes))), movementLog = [], deliveryLog = [];
  const startClock = next.world.clockMinutes ?? 540, stateChanges = [], exchangeLog = [], mealLog = [], goalLog = [], personalContactLog = [], restRecoveryLog = [], personalGoalLog = [], workLog = [];
  for (let tick = 1; tick <= tickCount; tick += 1) {
    next.world.clockMinutes = startClock + tick;
    const result = simulateNpcMinute(next, maps, options, tick, movementLog, stateChanges);
    deliveryLog.push(...result.deliveryRows);
    exchangeLog.push(...result.exchangeRows);
    mealLog.push(...result.mealRows);
    goalLog.push(...result.goalRows);
    personalContactLog.push(...result.personalContactRows);
    restRecoveryLog.push(...result.restRecoveryRows);
    personalGoalLog.push(...result.personalGoalRows);
    workLog.push(...result.workRows);
  }
  if (movementLog.length || deliveryLog.length || stateChanges.length || exchangeLog.length || mealLog.length || goalLog.length || personalContactLog.length || restRecoveryLog.length || personalGoalLog.length || workLog.length) {
    const entry = { eventId: `NPC_SIM_${next.ledger.length + 1}`, eventType: 'NPC_SIMULATION', date: next.world.date, mapId: next.world.currentMapId, startClockMinutes: startClock, endClockMinutes: next.world.clockMinutes, simulatedMinutes: tickCount, moves: movementLog, deliveries: deliveryLog, exchanges: exchangeLog, meals: mealLog, goals: goalLog, personalContacts: personalContactLog, restRecoveries: restRecoveryLog, personalGoalVisits: personalGoalLog, workOutputs: workLog, stateChanges };
    appendLedgerEvent(next, entry, state);
  }
  return next;
}

function advanceWorldTime(state, minutes, maps, reservedTiles = [], options = {}) {
  if (!Number.isFinite(minutes) || minutes <= 0) return state;
  if (options.pauseNpcSimulation) {
    const next = clone(state);
    next.world.clockMinutes = (next.world.clockMinutes ?? 540) + Math.min(10080, Math.max(1, Math.floor(minutes)));
    return next;
  }
  return advanceNpcWorld(state, minutes, maps, { reservedTiles, pausedHostIds: options.pausedHostIds });
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
  next.world.returnLocation = { mapId: next.world.currentMapId, position: { ...next.player.position } };
  next.world.activeRealm = { id: map.metadata.realmId, mapClass: 'LITERARY_REALM', sourceIds: [...(map.metadata.sourceIds ?? [])] };
  next.world.currentMapId = map.mapId;
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
  const literaryQuest = Boolean(quest.realmId) || quest.chapterId?.startsWith('LITERARY_');
  const requiredRealmId = quest.realmId ?? quest.chapterId;
  if (literaryQuest ? state.world.activeRealm?.id !== requiredRealmId : (quest.chapterId !== state.world.chapterId || Boolean(state.world.activeRealm))) return { ok: false, reason: 'quest_outside_chapter', state };
  if (state.player.embodiment !== hostId || !state.hosts[hostId]) return { ok: false, reason: 'wrong_embodiment', state };
  if (!action.hostIds.includes(hostId)) return { ok: false, reason: 'host_not_authorized', state };
  const host = state.hosts[hostId], entryMap = maps[quest.entry.mapId];
  const target = layer(entryMap, 'Interactions')?.objects.find(item => item.id === quest.entry.objectId);
  if (!target || host.mapId !== quest.entry.mapId || state.world.currentMapId !== quest.entry.mapId || objectId !== quest.entry.objectId || !nearTile(host.position, objectTile(target))) return { ok: false, reason: 'physical_object_unavailable', state };
  if (quest.socialChain) {
    const partner = state.hosts[quest.socialChain.partnerHostId];
    if (!partner || partner.historicalAliveAndPresent === false || partner.mapId !== state.world.currentMapId
      || !nearTile(host.position, partner.position, quest.socialChain.maxPartnerDistance ?? 2)) return { ok: false, reason: 'social_partner_not_present', state };
  }
  const requiredPresentHostIds = action.requiredPresentHostIds ?? [];
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
  if (Object.values(relationEffects).some(value => typeof value !== 'string' || value.length > 160)
    || (effects.partnerRelationKo !== undefined && (typeof effects.partnerRelationKo !== 'string' || effects.partnerRelationKo.length > 160))
    || (effects.situationKo !== undefined && (typeof effects.situationKo !== 'string' || effects.situationKo.length > 220))) return { ok: false, reason: 'invalid_action_effect', state };
  if (!Array.isArray(inventoryRemove) || !Array.isArray(inventoryAdd) || inventoryRemove.some(item => typeof item !== 'string' || !host.inventory.includes(item)) || inventoryAdd.some(item => typeof item !== 'string' || item.length > 80)) return { ok: false, reason: 'required_item_missing', state };
  const timed = advanceWorldTime(state, 5, maps);
  const next = clone(timed);
  next.quests[questId] = { status: 'resolved', result: action.id };
  next.hosts[hostId].questFlags[action.resultFlag] = true;
  if (effects.moneyDelta) next.hosts[hostId].money.amount += effects.moneyDelta;
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
  const entry = { eventId: `ACTION_${next.ledger.length + 1}`, eventType: literaryQuest ? 'LITERARY_ACTION' : 'HISTORICAL_ACTION', ...(literaryQuest ? { realmId: state.world.activeRealm.id } : {}), ...(chain ? { lifeChainId: chain.id, lifeChainStage: chain.stage, lifeChainDelta: chainDelta } : {}), ...(quest.socialChain ? { socialChainId: quest.socialChain.id, socialPartnerHostId: socialPartnerId } : {}), date: next.world.date, mapId: next.world.currentMapId, hostId, questId, actionId, objectId, witnesses: [], effectsApplied: { moneyDelta: effects.moneyDelta ?? 0, inventoryRemove, inventoryAdd, relations: relationEffects, ...(quest.socialChain ? { reciprocalPartnerRelationKo: effects.partnerRelationKo ?? null } : {}), situationKo: effects.situationKo ?? null }, sourceIds: action.requiredKnowledgeId ? [action.requiredKnowledgeId] : [] };
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
  if (![1, 2, 3, SAVE_VERSION].includes(envelope?.saveVersion) || !envelope.state || envelope.checksum !== stateHash(envelope.state)) throw new Error('Invalid or corrupted V36 save');
  const state = clone(envelope.state);
  state.ledger ??= [];
  const verifiedLedgerDigest = digestLedger(state.ledger);
  if (state.ledgerDigest && state.ledgerDigest !== verifiedLedgerDigest) throw new Error('Save contains an invalid event ledger digest');
  state.ledgerDigest = verifiedLedgerDigest;
  state.ledgerDigestCount = state.ledger.length;
  state.version = SAVE_VERSION;
  state.player.gameSaveVersion = SAVE_VERSION;
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
      host.socialEstate ??= card.socialEstate;
      host.allowedMaps = [...new Set([...(host.allowedMaps ?? []), ...(card.allowedMaps ?? [])])];
      host.relations ??= {};
      for (const [otherId, description] of Object.entries(card.relations ?? {})) host.relations[otherId] ??= description;
      const authoredMinutes = new Set((card.schedule ?? []).map(slot => slot.atMinute));
      host.schedule = [...(host.schedule ?? []).filter(slot => !authoredMinutes.has(slot.atMinute)), ...clone(card.schedule ?? [])].sort((a,b) => a.atMinute - b.atMinute);
      host.situationNotes ??= [];
      host.activeGoal ??= null;
      host.plannerPolicy = clone(card.plannerPolicy ?? host.plannerPolicy ?? {});
      host.todayGoals ??= clone(card.todayGoals ?? []);
      host.personalGoals ??= clone(card.persistentPersonalGoals ?? []);
      host.personalGoalProgress ??= Object.fromEntries((host.personalGoals ?? []).map(goal => [goal.id, { status: 'ACTIVE' }]));
      for(const goal of card.persistentPersonalGoals??[]){host.personalGoalProgress[goal.id]??={status:'ACTIVE'};}
      syncPersistentPersonalGoals(state,card.id);
      host.needs ??= initialNpcNeeds(card, state.world.clockMinutes);
      const defaultNeeds = initialNpcNeeds(card, state.world.clockMinutes);
      for (const [key, value] of Object.entries(defaultNeeds)) host.needs[key] ??= value;
      for (const key of ['hunger', 'fatigue', 'incomePressure', 'safetyConcern', 'socialNeed', 'restThreshold']) {
        if (!Number.isFinite(host.needs[key]) || host.needs[key] < 0 || host.needs[key] > 100) throw new Error(`Save contains invalid NPC need: ${card.id}.${key}`);
      }
      const slot = scheduleEntry(host, state.world.clockMinutes);
      host.scheduleId ??= slot ? `${slot.mapId}:${slot.atMinute}` : null;
      host.currentActivityKo ??= slot?.activityKo ?? '';
      host.routineState ??= { state: 'IDLE', activityKo: host.currentActivityKo, targetMapId: slot?.mapId ?? host.mapId, targetPosition: slot?.position ? { ...slot.position } : { ...host.position }, changedAtMinute: state.world.clockMinutes, minutesInState: 0 };
    }
  }
  const ids = new Set(hostCards.map(card => card.id));
  if (!maps[state.world?.currentMapId] || Object.keys(state.hosts ?? {}).length !== ids.size || Object.keys(state.hosts).some(id => !ids.has(id))) throw new Error('Save does not match this campaign');
  if (state.player.embodiment && !ids.has(state.player.embodiment)) throw new Error('Save references an unknown host');
  if (state.player.embodiment && state.hosts[state.player.embodiment].mapId !== state.world.currentMapId) throw new Error('Possessed host is outside the current map');
  const sourceIds = new Set(Object.values(maps).flatMap(map => (layer(map, 'Interactions')?.objects ?? []).map(properties).map(item => item.sourceId).filter(Boolean)));
  const evidenceIds = new Set(Object.values(maps).flatMap(map => (layer(map, 'Interactions')?.objects ?? []).map(properties).map(item => item.evidenceId).filter(Boolean)));
  const recordIds = new Set([...sourceIds, ...evidenceIds]);
  const discovered = new Set(state.world.discoveredSourceIds ?? []);
  if ([...(state.player.observedEvidenceIds ?? []), ...discovered].some(id => !recordIds.has(id))) throw new Error('Save references an unknown source or clue');
  for (const card of hostCards) {
    const host = state.hosts[card.id];
    if (!maps[host.mapId] || !card.allowedMaps.includes(host.mapId) || !Array.isArray(host.privateKnowledgeIds) || host.privateKnowledgeIds.some(id => !card.privateKnowledgeIds.includes(id))) throw new Error('Save contains invalid host state');
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

const V33GameState = { describeHostMoney, createInitialState, moveActor, possessHost, enterLiteraryRealm, leaveLiteraryRealm, releaseHost, transitionMap, performQuestAction, knowledgeForHost, recordSourceRead, recordEvidenceRead, recordDialogueTurn, recordDiscussionPosition, advanceNpcWorld, advanceWorldTime, advanceChapter, advanceCampaignDate, resolveEnding, saveGame, loadGame, stateHash, canOccupy, nearTile, playerCanObserveWorldEvent };
if (typeof module !== 'undefined' && module.exports) module.exports = V33GameState;
if (typeof globalThis !== 'undefined') globalThis.V33GameState = V33GameState;
