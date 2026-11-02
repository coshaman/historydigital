'use strict';

const SAVE_VERSION = 3;
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
function objectTile(object) { return { x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) }; }
function clone(value) { return structuredClone(value); }
function initialLearningState() {
  return { phase: 'circle-choice', circleLearning: null, lessonIndex: 0, examAnswers: {}, examOutcome: 'unset', examCorrectCount: null, promotionStatus: 'pending', timelineIndex: 0 };
}

function createInitialState({ maps, hostCards, quests = [], startMapId = 'nevsky' }) {
  if (!maps?.[startMapId] || !Array.isArray(hostCards) || hostCards.length < 1) throw new Error('A known start map and host cards are required');
  const map = maps[startMapId];
  const spawn = map.metadata?.observerStart ?? { x: 2, y: 2 };
  const hosts = Object.fromEntries(hostCards.map(card => [card.id, {
    id: card.id,
    kind: card.kind,
    mapId: card.start.mapId,
    position: { x: card.start.x, y: card.start.y },
    schedule: clone(card.schedule ?? []),
    scheduleId: null,
    currentActivityKo: '',
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
  const immutableOutcomes = Object.fromEntries(quests.filter(quest => !isLiteraryQuest(quest)).map(quest => [quest.historicalOutcome.id, quest.historicalOutcome.value]));
  const literaryOutcomes = Object.fromEntries(quests.filter(isLiteraryQuest).map(quest => [quest.historicalOutcome.id, quest.historicalOutcome.value]));
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
      immutableOutcomes,
      literaryOutcomes,
      possessionHistory: [],
      completedChapterIds: [],
    },
    player: { position: { x: spawn.x, y: spawn.y }, facing: 'down', embodiment: null, currentGoals: [], observedEvidenceIds: [], crossPerspectiveNotes: [], dialogueGrowth: { insight: 0, aiReplies: 0, perspectiveNotes: [], comparisonNotes: [], reflectionIds: [] }, gameSaveVersion: SAVE_VERSION },
    hosts,
    quests: Object.fromEntries(quests.map(quest => [quest.id, { status: 'open', result: null }])),
    learning: initialLearningState(),
    ledger: [],
    activeDialogue: null,
  };
}

function scheduleEntry(host, clockMinutes) {
  const schedule = [...(host.schedule ?? [])].sort((a, b) => a.atMinute - b.atMinute);
  const minute = ((clockMinutes % 1440) + 1440) % 1440;
  return [...schedule].reverse().find(item => item.atMinute <= minute) ?? schedule[0] ?? null;
}

const NPC_STEPS = Object.freeze([[0, -1, 'up'], [1, 0, 'right'], [0, 1, 'down'], [-1, 0, 'left']]);
function tileKey(position) { return `${position.x},${position.y}`; }
function isReserved(mapId, position, reservedTiles) {
  return reservedTiles.some(tile => tile.mapId === mapId && tile.position.x === position.x && tile.position.y === position.y);
}
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
  return (layer(map, 'Interactions')?.objects ?? []).filter(object => object.type === 'map-exit').map(object => ({ object, data: properties(object), tile: objectTile(object) }));
}
function npcMapRoute(startMapId, targetMapId, host, maps) {
  if (startMapId === targetMapId) return [];
  const queue = [startMapId], prior = new Map([[startMapId, null]]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const mapId = queue[cursor], map = maps?.[mapId];
    if (!map) continue;
    for (const exit of mapExitObjects(map)) {
      const nextId = exit.data.targetMapId, nextMap = maps?.[nextId];
      if (!nextMap || prior.has(nextId) || !host.allowedMaps.includes(nextId)) continue;
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
function nextNpcStep(state, host, slot, maps, reservedTiles) {
  if (host.mapId !== slot.mapId) {
    const route = npcMapRoute(host.mapId, slot.mapId, host, maps);
    if (!route?.length) return null;
    const { exit, toMapId } = route[0], fromMap = maps[host.mapId], toMap = maps[toMapId];
    const approach = findGridPath(fromMap, host.position, exitApproachTiles(fromMap, exit.tile), tile => npcCanOccupy(state, host.id, host.mapId, tile, maps, reservedTiles));
    if (approach === null) return null;
    if (!approach.length) {
      const arrival = { x: Number(exit.data.arrivalX), y: Number(exit.data.arrivalY) };
      if (!Number.isInteger(arrival.x) || !Number.isInteger(arrival.y) || !npcCanOccupy(state, host.id, toMapId, arrival, maps, reservedTiles)) return null;
      return { mapId: toMapId, position: arrival, facing: host.facing, viaExit: exit.data.exitId };
    }
    const next = approach[0], direction = NPC_STEPS.find(([dx, dy]) => host.position.x + dx === next.x && host.position.y + dy === next.y)?.[2];
    return direction ? { mapId: host.mapId, position: next, facing: direction } : null;
  }
  const map = maps?.[host.mapId], requested = slot.position;
  if (!map || !Number.isInteger(requested?.x) || !Number.isInteger(requested?.y)) return null;
  const goals = [requested, ...NPC_STEPS.map(([dx, dy]) => ({ x: requested.x + dx, y: requested.y + dy }))]
    .filter(tile => tileAt(layer(map, 'Collision'), tile.x, tile.y) === 0 && !isReserved(host.mapId, tile, reservedTiles));
  const path = findGridPath(map, host.position, goals, tile => npcCanOccupy(state, host.id, host.mapId, tile, maps, reservedTiles));
  if (path === null || !path.length) return null;
  const next = path[0], direction = NPC_STEPS.find(([dx, dy]) => host.position.x + dx === next.x && host.position.y + dy === next.y)?.[2];
  return direction ? { mapId: host.mapId, position: next, facing: direction } : null;
}
function simulateNpcMinute(state, maps, options, minuteOffset, movementLog) {
  const embodiedId = state.player.embodiment, paused = new Set(options.pausedHostIds ?? []), reservedTiles = [...(options.reservedTiles ?? [])];
  if (!state.player.embodiment) reservedTiles.push({ mapId: state.world.currentMapId, position: state.player.position });
  const moveRows = [], deliveryRows = [];
  const hosts = Object.values(state.hosts).sort((a, b) => a.id.localeCompare(b.id));
  for (const host of hosts) {
    const slot = scheduleEntry(host, state.world.clockMinutes);
    if (!slot) continue;
    const scheduleId = `${slot.mapId}:${slot.atMinute}`;
    if (host.scheduleId !== scheduleId) host.routineTaskCompletedId = null;
    host.scheduleId = scheduleId;
    host.currentActivityKo = slot.activityKo ?? '';
    const currentMap = maps?.[host.mapId], scheduledMap = maps?.[slot.mapId];
    const inActiveRealm = currentMap?.metadata?.mapClass === 'LITERARY_REALM';
    if (host.id === embodiedId || paused.has(host.id) || host.historicalAliveAndPresent === false || !scheduledMap || inActiveRealm !== Boolean(state.world.activeRealm) || state.world.clockMinutes % 5 !== 0) continue;
    const before = { mapId: host.mapId, position: { ...host.position } };
    const step = nextNpcStep(state, host, slot, maps, reservedTiles);
    if (step) { host.mapId = step.mapId; host.position = step.position; host.facing = step.facing; }
    if (before.mapId !== host.mapId || before.position.x !== host.position.x || before.position.y !== host.position.y) {
      const row = { hostId: host.id, minute: minuteOffset, scheduleId, activityKo: host.currentActivityKo, fromMapId: before.mapId, from: before.position, toMapId: host.mapId, to: { ...host.position }, viaExit: step?.viaExit ?? null };
      moveRows.push(row); movementLog.push(row);
    }
  }
  for (const host of hosts) {
    const slot = scheduleEntry(host, state.world.clockMinutes), task = slot?.task;
    if (task?.type !== 'DELIVER' || host.routineTaskCompletedId === task.id || host.id === embodiedId || paused.has(host.id) || host.historicalAliveAndPresent === false) continue;
    const recipient = state.hosts[task.recipientHostId];
    if (!recipient || recipient.id === embodiedId || recipient.historicalAliveAndPresent === false || recipient.mapId !== host.mapId || nearTile(recipient.position, host.position, 1) === false || !host.inventory.includes(task.itemKo)) continue;
    host.inventory.splice(host.inventory.indexOf(task.itemKo), 1);
    if (!recipient.inventory.includes(task.itemKo)) recipient.inventory.push(task.itemKo);
    host.routineTaskCompletedId = task.id;
    deliveryRows.push({ hostId: host.id, recipientHostId: recipient.id, itemKo: task.itemKo, taskId: task.id, mapId: host.mapId, minute: minuteOffset });
  }
  return { moveRows, deliveryRows };
}

function advanceNpcWorld(state, elapsedMinutes, maps, options = {}) {
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes <= 0) return state;
  const next = clone(state);
  const tickCount = Math.min(10080, Math.max(1, Math.floor(elapsedMinutes))), movementLog = [], deliveryLog = [];
  const startClock = next.world.clockMinutes ?? 540;
  for (let tick = 1; tick <= tickCount; tick += 1) {
    next.world.clockMinutes = startClock + tick;
    const result = simulateNpcMinute(next, maps, options, tick, movementLog);
    deliveryLog.push(...result.deliveryRows);
  }
  if (movementLog.length || deliveryLog.length) {
    const entry = { eventId: `NPC_SIM_${next.ledger.length + 1}`, eventType: 'NPC_SIMULATION', date: next.world.date, mapId: next.world.currentMapId, startClockMinutes: startClock, endClockMinutes: next.world.clockMinutes, simulatedMinutes: tickCount, moves: movementLog, deliveries: deliveryLog, priorStateHash: stateHash(state), nextStateHash: null };
    next.ledger.push(entry);
    entry.nextStateHash = stateHash(next);
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

function moveActor(state, direction, map, maps = { [map?.mapId]: map }) {
  const delta = DIRECTIONS[direction];
  if (!delta || !state || !map || state.world.currentMapId !== map.mapId) return { state, moved: false, reason: 'invalid_direction_or_map' };
  const hostId = state.player.embodiment;
  const actor = hostId ? state.hosts[hostId] : state.player;
  if (!actor || (hostId && actor.mapId !== state.world.currentMapId)) return { state, moved: false, reason: 'actor_not_present' };
  const x = actor.position.x + delta[0], y = actor.position.y + delta[1];
  if (!canOccupy(map, x, y, hostId, state.hosts)) return { state, moved: false, reason: 'collision' };
  const timed = advanceWorldTime(state, 1, maps, [{ mapId: map.mapId, position: { x, y } }]);
  if (!canOccupy(map, x, y, hostId, timed.hosts)) return { state, moved: false, reason: 'collision' };
  const next = clone(timed);
  const nextActor = hostId ? next.hosts[hostId] : next.player;
  nextActor.position = { x, y };
  nextActor.facing = direction;
  next.player.position = { x, y };
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
  next.ledger.push({ eventId: `REALM_${next.ledger.length + 1}`, eventType: 'ENTER_LITERARY_REALM', realmId: map.metadata.realmId, sourceIds: [...(map.metadata.sourceIds ?? [])], date: next.world.date });
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
  next.ledger.push({ eventId: `REALM_${next.ledger.length + 1}`, eventType: 'LEAVE_LITERARY_REALM', date: next.world.date });
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
  if (!targetMap || !nearTile(state.player.position, objectTile(exit))) return { ok: false, reason: 'exit_not_reachable', state };
  const currentRealmClass = currentMap.metadata?.mapClass === 'LITERARY_REALM';
  const targetRealmClass = targetMap.metadata?.mapClass === 'LITERARY_REALM';
  if (currentRealmClass !== targetRealmClass || (currentRealmClass && currentMap.metadata.realmId !== targetMap.metadata.realmId)) return { ok: false, reason: 'realm_boundary', state };
  const hostId = state.player.embodiment;
  const host = hostId ? state.hosts[hostId] : null;
  if (!data.publicAccess && !hostId) return { ok: false, reason: 'person_required', state };
  if (hostId && (!host || !host.allowedMaps.includes(data.targetMapId))) return { ok: false, reason: 'host_lacks_access', state };
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
  if (quest.date && quest.date > state.world.date) return { ok: false, reason: 'quest_not_yet_available', state };
  const literaryQuest = Boolean(quest.realmId) || quest.chapterId?.startsWith('LITERARY_');
  const requiredRealmId = quest.realmId ?? quest.chapterId;
  if (literaryQuest ? state.world.activeRealm?.id !== requiredRealmId : (quest.chapterId !== state.world.chapterId || Boolean(state.world.activeRealm))) return { ok: false, reason: 'quest_outside_chapter', state };
  if (state.player.embodiment !== hostId || !state.hosts[hostId]) return { ok: false, reason: 'wrong_embodiment', state };
  if (!action.hostIds.includes(hostId)) return { ok: false, reason: 'host_not_authorized', state };
  const host = state.hosts[hostId], entryMap = maps[quest.entry.mapId];
  const target = layer(entryMap, 'Interactions')?.objects.find(item => item.id === quest.entry.objectId);
  if (!target || host.mapId !== quest.entry.mapId || state.world.currentMapId !== quest.entry.mapId || objectId !== quest.entry.objectId || !nearTile(host.position, objectTile(target))) return { ok: false, reason: 'physical_object_unavailable', state };
  if (action.requiredKnowledgeId && !knowledgeForHost(state, hostId).includes(action.requiredKnowledgeId)) return { ok: false, reason: 'host_lacks_knowledge', state };
  const effects = action.effects ?? {}, relationEffects = effects.relations ?? {}, inventoryRemove = effects.inventoryRemove ?? [], inventoryAdd = effects.inventoryAdd ?? [];
  if (effects.moneyDelta !== undefined && (!Number.isInteger(effects.moneyDelta) || Math.abs(effects.moneyDelta) > 10000 || !Number.isFinite(host.money?.amount) || host.money.amount + effects.moneyDelta < 0)) return { ok: false, reason: 'invalid_or_unaffordable_effect', state };
  if (Object.values(relationEffects).some(value => typeof value !== 'string' || value.length > 160) || (effects.situationKo !== undefined && (typeof effects.situationKo !== 'string' || effects.situationKo.length > 220))) return { ok: false, reason: 'invalid_action_effect', state };
  if (!Array.isArray(inventoryRemove) || !Array.isArray(inventoryAdd) || inventoryRemove.some(item => typeof item !== 'string' || !host.inventory.includes(item)) || inventoryAdd.some(item => typeof item !== 'string' || item.length > 80)) return { ok: false, reason: 'required_item_missing', state };
  const timed = advanceWorldTime(state, 5, maps);
  const next = clone(timed);
  next.quests[questId] = { status: 'resolved', result: action.id };
  next.hosts[hostId].questFlags[action.resultFlag] = true;
  if (effects.moneyDelta) next.hosts[hostId].money.amount += effects.moneyDelta;
  for (const item of inventoryRemove) next.hosts[hostId].inventory.splice(next.hosts[hostId].inventory.indexOf(item), 1);
  next.hosts[hostId].inventory.push(...inventoryAdd);
  Object.assign(next.hosts[hostId].relations, relationEffects);
  if (effects.situationKo && !next.hosts[hostId].situationNotes.includes(effects.situationKo)) next.hosts[hostId].situationNotes.push(effects.situationKo);
  if (literaryQuest) {
    next.world.literaryOutcomes ??= {};
    next.world.literaryOutcomes[quest.historicalOutcome.id] = quest.historicalOutcome.value;
  } else next.world.immutableOutcomes[quest.historicalOutcome.id] = quest.historicalOutcome.value;
  const entry = { eventId: `ACTION_${next.ledger.length + 1}`, eventType: literaryQuest ? 'LITERARY_ACTION' : 'HISTORICAL_ACTION', ...(literaryQuest ? { realmId: state.world.activeRealm.id } : {}), date: next.world.date, mapId: next.world.currentMapId, hostId, questId, actionId, objectId, witnesses: [], effectsApplied: { moneyDelta: effects.moneyDelta ?? 0, inventoryRemove, inventoryAdd, relations: relationEffects, situationKo: effects.situationKo ?? null }, sourceIds: action.requiredKnowledgeId ? [action.requiredKnowledgeId] : [], priorStateHash: stateHash(timed), nextStateHash: null };
  next.ledger.push(entry);
  entry.nextStateHash = stateHash(next);
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
  if (ending.requiredActions?.some(id => !state.ledger.some(item => item.actionId === id))) return { ok: false, reason: 'route_evidence_missing', state };
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
  next.ledger.push({ eventId: `READ_${next.ledger.length + 1}`, date: next.world.date, mapId: next.world.currentMapId, hostId: inPlace ? next.player.embodiment : null, sourceId, readingMode: inPlace ? 'PHYSICAL_COPY' : 'PLAYER_ARCHIVE', priorStateHash: stateHash(timed), nextStateHash: null });
  next.ledger.at(-1).nextStateHash = stateHash(next);
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
  const entry = { eventId: `OBSERVE_${next.ledger.length + 1}`, date: next.world.date, mapId: next.world.currentMapId, hostId, evidenceId, priorStateHash: stateHash(timed), nextStateHash: null };
  next.ledger.push(entry); entry.nextStateHash = stateHash(next);
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
  const earnsInsight = aiGenerated && Boolean(discussionId) && !alreadyHeardPerspective;
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
  if (aiGenerated && reflectionKey && !next.player.dialogueGrowth.reflectionIds.includes(reflectionKey)) next.player.dialogueGrowth.reflectionIds.push(reflectionKey);
  const event = { eventId: `DIALOGUE_${next.ledger.length + 1}`, eventType: 'DIALOGUE_TURN', date: next.world.date, clockMinutes: next.world.clockMinutes, mapId: next.world.currentMapId, hostId, interlocutorHostId: actorHostId, sceneId, intentClass, ...(aiGenerated ? { aiGenerated: true } : {}), ...(earnsInsight ? { discussionId, dialogueReward } : {}), ...(aiGenerated && reflectionKey ? { reflectionId } : {}), priorStateHash: stateHash(timed), nextStateHash: null };
  next.ledger.push(event);
  event.nextStateHash = stateHash(next);
  return { ok: true, state: next };
}

function stateHash(value) {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function saveGame(state) {
  return JSON.stringify({ saveVersion: SAVE_VERSION, checksum: stateHash(state), state });
}

function loadGame(raw, { maps, hostCards, quests = [], learningExam = null } = {}) {
  const envelope = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (![1, 2, SAVE_VERSION].includes(envelope?.saveVersion) || !envelope.state || envelope.checksum !== stateHash(envelope.state)) throw new Error('Invalid or corrupted V33 save');
  const state = clone(envelope.state);
  state.version = SAVE_VERSION;
  if (!state.player.dialogueGrowth) {
    const legacyNotes = new Map();
    for (const entry of state.ledger ?? []) if (entry.eventType === 'DIALOGUE_TURN' && entry.discussionId && !legacyNotes.has(entry.discussionId)) legacyNotes.set(entry.discussionId, { discussionId: entry.discussionId, hostId: entry.hostId, date: entry.date });
    const perspectiveNotes = [...legacyNotes.values()];
    state.player.dialogueGrowth = { insight: perspectiveNotes.length, aiReplies: (state.ledger ?? []).filter(entry => entry.eventType === 'DIALOGUE_TURN' && entry.aiGenerated).length, perspectiveNotes, comparisonNotes: [], reflectionIds: [] };
  }
  state.player.dialogueGrowth.perspectiveNotes ??= [];
  state.player.dialogueGrowth.comparisonNotes ??= [];
  state.player.dialogueGrowth.reflectionIds ??= [];
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
  const seededHosts = createInitialState({ maps, hostCards, quests }).hosts;
  state.hosts ??= {};
  for (const card of hostCards) if (!state.hosts[card.id]) state.hosts[card.id] = seededHosts[card.id];
  for (const card of hostCards) {
    const host = state.hosts?.[card.id];
    if (host) {
      host.schedule ??= clone(card.schedule ?? []);
      host.situationNotes ??= [];
      const slot = scheduleEntry(host, state.world.clockMinutes);
      host.scheduleId ??= slot ? `${slot.mapId}:${slot.atMinute}` : null;
      host.currentActivityKo ??= slot?.activityKo ?? '';
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
    const outcomeStore = (Boolean(quest.realmId) || quest.chapterId?.startsWith('LITERARY_')) ? state.world.literaryOutcomes : state.world.immutableOutcomes;
    if (outcomeStore?.[quest.historicalOutcome.id] !== quest.historicalOutcome.value) throw new Error('Save modified an immutable historical or literary outcome');
  }
  return state;
}

const V33GameState = { describeHostMoney, createInitialState, moveActor, possessHost, enterLiteraryRealm, leaveLiteraryRealm, releaseHost, transitionMap, performQuestAction, knowledgeForHost, recordSourceRead, recordEvidenceRead, recordDialogueTurn, advanceNpcWorld, advanceWorldTime, advanceChapter, advanceCampaignDate, resolveEnding, saveGame, loadGame, stateHash, canOccupy, nearTile };
if (typeof module !== 'undefined' && module.exports) module.exports = V33GameState;
if (typeof globalThis !== 'undefined') globalThis.V33GameState = V33GameState;
