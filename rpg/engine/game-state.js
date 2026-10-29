'use strict';

const SAVE_VERSION = 1;
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
  const immutableOutcomes = Object.fromEntries(quests.filter(quest => quest.chapterId !== 'LITERARY_DEAD_SOULS').map(quest => [quest.historicalOutcome.id, quest.historicalOutcome.value]));
  const literaryOutcomes = Object.fromEntries(quests.filter(quest => quest.chapterId === 'LITERARY_DEAD_SOULS').map(quest => [quest.historicalOutcome.id, quest.historicalOutcome.value]));
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
    player: { position: { x: spawn.x, y: spawn.y }, facing: 'down', embodiment: null, currentGoals: [], observedEvidenceIds: [], crossPerspectiveNotes: [], gameSaveVersion: SAVE_VERSION },
    hosts,
    quests: Object.fromEntries(quests.map(quest => [quest.id, { status: 'open', result: null }])),
    ledger: [],
    activeDialogue: null,
  };
}

function scheduleEntry(host, clockMinutes) {
  const schedule = [...(host.schedule ?? [])].sort((a, b) => a.atMinute - b.atMinute);
  const minute = ((clockMinutes % 1440) + 1440) % 1440;
  return [...schedule].reverse().find(item => item.atMinute <= minute) ?? schedule.at(-1) ?? null;
}

function advanceWorldTime(state, minutes, maps, reservedTiles = []) {
  if (!Number.isFinite(minutes) || minutes <= 0) return state;
  const next = clone(state);
  next.world.clockMinutes = (next.world.clockMinutes ?? 540) + Math.floor(minutes);
  const embodiedId = next.player.embodiment;
  const moved = [];
  for (const host of Object.values(next.hosts)) {
    const slot = scheduleEntry(host, next.world.clockMinutes);
    if (!slot) continue;
    host.scheduleId = `${slot.mapId}:${slot.atMinute}`;
    host.currentActivityKo = slot.activityKo ?? '';
    if (host.id === embodiedId || host.mapId !== slot.mapId) continue;
    const map = maps?.[slot.mapId], target = slot.position;
    if (!map || !Number.isInteger(target?.x) || !Number.isInteger(target?.y)) continue;
    if (reservedTiles.some(tile => tile.mapId === slot.mapId && tile.position.x === target.x && tile.position.y === target.y)) continue;
    if (host.position.x === target.x && host.position.y === target.y) continue;
    if (!canOccupy(map, target.x, target.y, host.id, next.hosts)) continue;
    const previous = { ...host.position };
    host.position = { ...target };
    moved.push({ hostId: host.id, mapId: host.mapId, from: previous, to: { ...target }, scheduleId: host.scheduleId });
  }
  if (moved.length) {
    const entry = { eventId: `SCHEDULE_${next.ledger.length + 1}`, eventType: 'SCHEDULE_MOVEMENT', date: next.world.date, mapId: next.world.currentMapId, moves: moved, priorStateHash: stateHash(state), nextStateHash: null };
    next.ledger.push(entry);
    entry.nextStateHash = stateHash(next);
  }
  return next;
}

function canOccupy(map, x, y, ignoreHostId = null, hostStates = null) {
  if (!map || tileAt(layer(map, 'Collision'), x, y) !== 0) return false;
  const npcLayer = layer(map, 'NPCs');
  return !(npcLayer?.objects ?? []).some(npc => {
    const hostId = properties(npc).hostId;
    if (hostId === ignoreHostId) return false;
    const host = hostStates?.[hostId];
    if (hostStates && (!host || host.mapId !== map.mapId)) return false;
    const tile = host ? host.position : objectTile(npc);
    return tile.x === x && tile.y === y;
  });
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
  const present = (layer(map, 'NPCs')?.objects ?? []).some(item => properties(item).hostId === hostId);
  if (!host || !host.historicalAliveAndPresent || !present || host.mapId !== state.world.currentMapId || map.mapId !== state.world.currentMapId) return { ok: false, reason: 'host_not_here', state };
  if (!nearTile(state.player.position, host.position, 2)) return { ok: false, reason: 'too_far', state };
  const next = clone(state);
  next.player.embodiment = hostId;
  next.player.position = { ...host.position };
  next.world.possessionHistory.push({ eventId: `POSSESS_${next.world.possessionHistory.length + 1}`, date: next.world.date, hostId, mapId: next.world.currentMapId });
  return { ok: true, state: next };
}

function enterLiteraryRealm(state, map, card) {
  if (!state || state.player.embodiment || state.world.activeRealm || map?.metadata?.mapClass !== 'LITERARY_REALM' || card?.kind !== 'LITERARY' || !card.allowedMaps.includes(map.mapId) || !state.hosts[card.id]) return { ok: false, reason: 'literary_realm_unavailable', state };
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
  const arrival = { x: Number(data.arrivalX), y: Number(data.arrivalY) };
  if (!Number.isInteger(arrival.x) || !Number.isInteger(arrival.y) || !canOccupy(targetMap, arrival.x, arrival.y, hostId, state.hosts)) return { ok: false, reason: 'invalid_arrival', state };
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
  const literaryQuest = quest.chapterId === 'LITERARY_DEAD_SOULS';
  if (literaryQuest ? state.world.activeRealm?.id !== 'LITERARY_DEAD_SOULS' : (quest.chapterId !== state.world.chapterId || Boolean(state.world.activeRealm))) return { ok: false, reason: 'quest_outside_chapter', state };
  if (state.player.embodiment !== hostId || !state.hosts[hostId]) return { ok: false, reason: 'wrong_embodiment', state };
  if (!action.hostIds.includes(hostId)) return { ok: false, reason: 'host_not_authorized', state };
  const host = state.hosts[hostId], entryMap = maps[quest.entry.mapId];
  const target = layer(entryMap, 'Interactions')?.objects.find(item => item.id === quest.entry.objectId);
  if (!target || host.mapId !== quest.entry.mapId || state.world.currentMapId !== quest.entry.mapId || objectId !== quest.entry.objectId || !nearTile(host.position, objectTile(target))) return { ok: false, reason: 'physical_object_unavailable', state };
  if (action.requiredKnowledgeId && !knowledgeForHost(state, hostId).includes(action.requiredKnowledgeId)) return { ok: false, reason: 'host_lacks_knowledge', state };
  const timed = advanceWorldTime(state, 5, maps);
  const next = clone(timed);
  next.quests[questId] = { status: 'resolved', result: action.id };
  next.hosts[hostId].questFlags[action.resultFlag] = true;
  if (literaryQuest) {
    next.world.literaryOutcomes ??= {};
    next.world.literaryOutcomes[quest.historicalOutcome.id] = quest.historicalOutcome.value;
  } else next.world.immutableOutcomes[quest.historicalOutcome.id] = quest.historicalOutcome.value;
  const entry = { eventId: `ACTION_${next.ledger.length + 1}`, eventType: literaryQuest ? 'LITERARY_ACTION' : 'HISTORICAL_ACTION', ...(literaryQuest ? { realmId: state.world.activeRealm.id } : {}), date: next.world.date, mapId: next.world.currentMapId, hostId, questId, actionId, objectId, witnesses: [], sourceIds: action.requiredKnowledgeId ? [action.requiredKnowledgeId] : [], priorStateHash: stateHash(timed), nextStateHash: null };
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

function knowledgeForHost(state, hostId) {
  const host = state.hosts?.[hostId];
  if (!host) return [];
  return [...new Set([...host.privateKnowledgeIds, ...host.witnessedKnowledgeIds, ...host.knownEvidenceIds])];
}

function recordSourceRead(state, sourceId, maps, archiveSourceIds = []) {
  const map = maps?.[state?.world?.currentMapId];
  const allSourceObjects = Object.values(maps ?? {}).flatMap(item => layer(item, 'Interactions')?.objects ?? []).filter(object => properties(object).sourceId === sourceId);
  const sourceMap = Object.values(maps ?? {}).find(item => layer(item, 'Interactions')?.objects.some(object => properties(object).sourceId === sourceId));
  const target = allSourceObjects[0];
  const inPlace = allSourceObjects.some(object => layer(map, 'Interactions')?.objects.includes(object));
  const archiveAccess = archiveSourceIds.includes(sourceId);
  const sourceChapter = properties(target ?? {}).availableChapterId;
  const chronology = ['V33_1847_PRINT', 'V33_1848_PUBLIC', 'V33_1849_CIRCLE'];
  const chapterAvailable = !sourceChapter || chronology.indexOf(state.world.chapterId) >= chronology.indexOf(sourceChapter);
  const literaryScope = sourceMap?.metadata?.mapClass === 'LITERARY_REALM';
  const scopeAllowed = literaryScope ? state.world.activeRealm?.id === sourceMap.metadata.realmId : !state.world.activeRealm;
  const sourceDate = properties(target ?? {}).availableDate;
  const dateAvailable = !sourceDate || sourceDate <= state.world.date;
  const isHere = Boolean(target && chapterAvailable && dateAvailable && scopeAllowed && (inPlace || archiveAccess));
  if (!isHere || !sourceId) return { ok: false, reason: 'source_not_present', state };
  const timed = advanceWorldTime(state, 5, maps);
  const next = clone(timed);
  if (!next.world.discoveredSourceIds.includes(sourceId)) next.world.discoveredSourceIds.push(sourceId);
  if (!next.player.observedEvidenceIds.includes(sourceId)) next.player.observedEvidenceIds.push(sourceId);
  if (next.player.embodiment) {
    const host = next.hosts[next.player.embodiment];
    if (host && !host.knownEvidenceIds.includes(sourceId)) host.knownEvidenceIds.push(sourceId);
  }
  next.ledger.push({ eventId: `READ_${next.ledger.length + 1}`, date: next.world.date, mapId: next.world.currentMapId, hostId: next.player.embodiment, sourceId, priorStateHash: stateHash(timed), nextStateHash: null });
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

function recordDialogueTurn(state, { hostId, sceneId, intentClass = 'GENERAL_CONVERSATION' } = {}, maps = {}) {
  if (!state?.player || state.player.embodiment !== hostId || !state.hosts?.[hostId] || state.hosts[hostId].mapId !== state.world.currentMapId || typeof sceneId !== 'string' || !/^V33_[A-Z0-9_]{3,64}$/.test(sceneId)) return { ok: false, reason: 'dialogue_host_unavailable', state };
  if (!['SOURCE_REQUEST', 'ACTION_REQUEST', 'RISK_QUESTION', 'PERSONAL_QUESTION', 'GENERAL_CONVERSATION'].includes(intentClass)) return { ok: false, reason: 'invalid_intent_class', state };
  const timed = advanceWorldTime(state, 1, maps);
  const next = clone(timed);
  const event = { eventId: `DIALOGUE_${next.ledger.length + 1}`, eventType: 'DIALOGUE_TURN', date: next.world.date, clockMinutes: next.world.clockMinutes, mapId: next.world.currentMapId, hostId, sceneId, intentClass, priorStateHash: stateHash(timed), nextStateHash: null };
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

function loadGame(raw, { maps, hostCards, quests = [] } = {}) {
  const envelope = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (envelope?.saveVersion !== SAVE_VERSION || !envelope.state || envelope.checksum !== stateHash(envelope.state)) throw new Error('Invalid or corrupted V33 save');
  const state = clone(envelope.state);
  state.world.clockMinutes ??= 540;
  for (const card of hostCards) {
    const host = state.hosts?.[card.id];
    if (host) {
      host.schedule ??= clone(card.schedule ?? []);
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
    const outcomeStore = quest.chapterId === 'LITERARY_DEAD_SOULS' ? state.world.literaryOutcomes : state.world.immutableOutcomes;
    if (outcomeStore?.[quest.historicalOutcome.id] !== quest.historicalOutcome.value) throw new Error('Save modified an immutable historical or literary outcome');
  }
  return state;
}

const V33GameState = { createInitialState, moveActor, possessHost, enterLiteraryRealm, leaveLiteraryRealm, releaseHost, transitionMap, performQuestAction, knowledgeForHost, recordSourceRead, recordEvidenceRead, recordDialogueTurn, advanceWorldTime, advanceChapter, advanceCampaignDate, resolveEnding, saveGame, loadGame, stateHash, canOccupy, nearTile };
if (typeof module !== 'undefined' && module.exports) module.exports = V33GameState;
if (typeof globalThis !== 'undefined') globalThis.V33GameState = V33GameState;
