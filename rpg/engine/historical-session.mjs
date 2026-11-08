const clone = value => structuredClone(value);
const actorKey = (eventId, actorId) => `historical:${eventId}:${actorId}`;

export function beginHistoricalSession(campaignState, event, maps, cards) {
  if (!campaignState || !event?.id || !maps?.[event.entryMapId] || !Array.isArray(event.actors))
    return { ok: false, reason: 'invalid_historical_event' };
  const session = clone(campaignState), returnState = clone(campaignState), nextCards = [...cards];
  session.historicalSession = { eventId: event.id, returnState, choices: [], completedObjectives: [], actionOutcomes: {}, pledgedActorIds: [], stage: 0 };
  session.world.currentMapId = event.entryMapId;
  session.world.date = event.date;
  session.world.clockMinutes = event.startMinute ?? 600;
  session.world.activeRealm = null;
  session.player.embodiment = null;
  session.player.position = clone(event.entryPosition ?? maps[event.entryMapId].metadata?.observerStart ?? { x: 2, y: 2 });
  for (const actor of event.actors) {
    const templateCard = cards.find(card => card.id === actor.templateId), templateHost = session.hosts[actor.templateId];
    if (!templateCard || !templateHost || !maps[actor.mapId]) return { ok: false, reason: 'invalid_historical_actor' };
    const id = actorKey(event.id, actor.id), card = clone(templateCard), host = clone(templateHost);
    card.id = id; card.displayNameKo = actor.nameKo; card.kind = 'FICTIONAL';
    card.eraProfile = null;
    card.occupation = actor.occupationKo ?? '현장에 모인 사람';
    card.personalObjective = actor.introductionKo ?? actor.lines?.[0] ?? '사람들과 오늘의 일을 의논한다';
    const allowedMaps = event.mapIds ?? [event.entryMapId];
    card.allowedMaps = [...new Set([...(card.allowedMaps ?? []), ...allowedMaps])];
    card.start = { mapId: actor.mapId, x: actor.position.x, y: actor.position.y };
    card.presenceWindow = null;
    host.id = id; host.mapId = actor.mapId; host.position = clone(actor.position); host.historicalAliveAndPresent = true;
    host.eraProfile = null;
    host.presenceWindow = null;
    host.allowedMaps = [...new Set([...(host.allowedMaps ?? []), ...allowedMaps])];
    const nextStops = actor.stops ?? [actor.position, { x: Math.min(maps[actor.mapId].width - 3, actor.position.x + 2), y: actor.position.y },
      { x: Math.max(1, actor.position.x - 1), y: Math.min(maps[actor.mapId].height - 3, actor.position.y + 1) }];
    host.schedule = nextStops.map((position, index) => ({ atMinute: (event.startMinute ?? 600) + index * 4, mapId: actor.mapId,
      position: clone(position), activityKo: actor.activityKo ?? '사람들 사이를 오가며 현장을 살핀다' }));
    host.activeGoal = null; host.currentActivityKo = actor.activityKo ?? '사람들과 오늘의 일을 의논한다';
    host.plannedPath = { key: null, tiles: [] }; host.mapRoutePlan = { key: null, route: null };
    host.relations = {}; host.relationshipEdges = []; host.heardEventReports = [];
    session.hosts[id] = host; nextCards.push(card);
  }
  return { ok: true, session, returnState, cards: nextCards };
}

export function recordHistoricalChoice(session, choice) {
  if (!session?.historicalSession || !choice?.id || !choice?.textKo) return session;
  const next = clone(session);
  next.historicalSession.choices.push({ id: choice.id, textKo: choice.textKo });
  return next;
}

export function exitHistoricalSession(session) {
  return clone(session?.historicalSession?.returnState ?? session);
}

export function canConcludeHistoricalSession(session, scene) {
  const active = session?.historicalSession;
  if (!active || active.eventId !== scene?.eventId) return false;
  const requirements = scene.conclusionRequirements ?? { spokenActors: 8, completedObjectives: 5 };
  if ((active.spokenActorIds?.length ?? 0) < requirements.spokenActors
    || (active.completedObjectives?.length ?? 0) < requirements.completedObjectives) return false;
  if (!Array.isArray(scene?.maps) || scene.maps.some(mapId => !(active.visitedMapIds ?? []).includes(mapId))) return false;
  const requiredActions = (scene.fieldActions ?? []).filter(action => action.requiredActorId);
  if (Number.isInteger(requirements.requiredRoleActions)) return requiredActions
    .filter(action => Boolean(active.actionOutcomes?.[action.id])).length >= requirements.requiredRoleActions;
  return requiredActions.every(action => Boolean(active.actionOutcomes?.[action.id]));
}

export function completeHistoricalObjective(session, objectiveId) {
  if (!session?.historicalSession || !objectiveId) return session;
  const next = clone(session);
  if (!next.historicalSession.completedObjectives.includes(objectiveId)) next.historicalSession.completedObjectives.push(objectiveId);
  return next;
}

export function performHistoricalAction(session, scene, actionId, choiceId) {
  const action = scene?.fieldActions?.find(item => item.id === actionId);
  const option = action?.options?.find(item => item.id === choiceId);
  if (!session?.historicalSession || session.historicalSession.eventId !== scene?.eventId || !action || !option)
    return { ok: false, reason: 'invalid_historical_action', state: session };
  if (session.world?.currentMapId !== action.mapId)
    return { ok: false, reason: 'wrong_historical_area', state: session };
  if (action.requiredActorId && session.player?.embodiment !== actorKey(scene.eventId, action.requiredActorId))
    return { ok: false, reason: 'wrong_historical_actor', state: session };
  if (session.historicalSession.actionOutcomes?.[action.id])
    return { ok: false, reason: 'action_already_resolved', state: session };
  const priorEffects = session.world?.historicalEventEffects?.[scene.eventId] ?? {};
  if (option.requiresEffects && Object.entries(option.requiresEffects).some(([key, value]) => priorEffects[key] !== value))
    return { ok: false, reason: 'historical_choice_locked', state: session };

  const next = clone(session);
  next.historicalSession.actionOutcomes ??= {};
  next.historicalSession.actionOutcomes[action.id] = option.id;
  next.historicalSession.completedObjectives ??= [];
  if (action.objectiveId && !next.historicalSession.completedObjectives.includes(action.objectiveId))
    next.historicalSession.completedObjectives.push(action.objectiveId);
  next.historicalSession.choices ??= [];
  next.historicalSession.choices.push({ id: `${action.id}:${option.id}`, textKo: option.textKo,
    ...(action.requiredActorId ? { performedByActorId: action.requiredActorId } : {}) });
  next.world.historicalEventEffects ??= {};
  next.world.historicalEventEffects[scene.eventId] ??= {};
  Object.assign(next.world.historicalEventEffects[scene.eventId], clone(option.effects ?? {}));
  return { ok: true, state: next, action, option };
}
