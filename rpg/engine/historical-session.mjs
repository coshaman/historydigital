const clone = value => structuredClone(value);
const actorKey = (eventId, actorId) => `historical:${eventId}:${actorId}`;

export function historicalReplyText(actor, response) {
  return [actor?.lines?.[1], response?.reactionKo].filter(Boolean).join('\n\n');
}

export function historicalParticipantGuide(scene, actorId, activeSession = {}) {
  const actor = scene?.actors?.find(person => person.id === actorId);
  if (!actor) return null;
  const objective = scene.objectives?.find(item => item.id === actor.objectiveId);
  const authoredGuide = scene.actorQuestGuides?.[actor.id];
  const actions = (scene.fieldActions ?? []).filter(item => item.objectiveId === actor.objectiveId);
  const authoredAction = (scene.fieldActions ?? []).find(item => item.id === authoredGuide?.actionId);
  const ownAction = actions.find(item => item.requiredActorId === actor.id);
  const involvedAction = actions.find(item => item.gatherActorIds?.includes(actor.id)
    && !activeSession.actionOutcomes?.[item.id]);
  const pendingAction = actions.find(item => !activeSession.actionOutcomes?.[item.id]) ?? actions[0];
  const action = authoredGuide && authoredAction
    ? authoredAction : ownAction && !activeSession.actionOutcomes?.[ownAction.id]
    ? ownAction : involvedAction ?? pendingAction ?? ownAction;
  const partners = (scene.actors ?? []).filter(person => person.objectiveId === actor.objectiveId && person.id !== actor.id);
  const partnerIds = partners.map(person => person.id);
  const fallbackIds = (action?.gatherActorIds ?? []).filter(id => id !== actor.id);
  const localPartnerIds = partnerIds.filter(id => scene.actors.find(person => person.id === id)?.mapId === action?.mapId);
  const localFallbackIds = fallbackIds.filter(id => scene.actors.find(person => person.id === id)?.mapId === action?.mapId);
  const authoredTargets = (authoredGuide?.actionId === action?.id ? authoredGuide.talkToActorIds : null) ?? [];
  const talkToIds = authoredTargets.length ? authoredTargets : localPartnerIds.length ? localPartnerIds : localFallbackIds.length ? localFallbackIds : partnerIds.length ? partnerIds : fallbackIds;
  const talkToNamesKo = [...new Set(talkToIds.map(id => {
    const person = scene.actors.find(item => item.id === id);
    if (!person) return null;
    const zone = scene.zoneTitlesKo?.[scene.maps.indexOf(person.mapId)];
    return person.mapId === action?.mapId || !zone ? person.nameKo : `${person.nameKo} · ${zone}`;
  }).filter(Boolean))].slice(0, 1);
  const mapIndex = action ? scene.maps.indexOf(action.mapId) : -1;
  const placeKo = mapIndex >= 0 ? scene.zoneTitlesKo?.[mapIndex] ?? action.mapId : actor.mapId;
  const firstContactKo = talkToNamesKo[0]?.split(' · ')[0] ?? '현장 인물';
  const taskKo = authoredGuide?.actionId === action?.id
    ? authoredGuide.taskKo : objective?.actionKo ?? action?.promptKo ?? '맡은 일을 처리한다';
  const roleStep = action?.requiredActorId && action.requiredActorId !== actor.id
    ? [`인물 바꾸기 · ${scene.actors.find(person => person.id === action.requiredActorId)?.nameKo ?? '맡을 인물'}로 전환`] : [];
  return {
    actorNameKo: actor.nameKo,
    objectiveTitleKo: authoredGuide?.actionId === action?.id ? authoredGuide.titleKo : objective?.titleKo ?? actor.introductionKo ?? actor.lines?.[0] ?? '현장 사람들과 이야기를 나눈다',
    actionKo: authoredGuide?.actionId === action?.id ? authoredGuide.taskKo : objective?.actionKo ?? '가까운 사람에게 오늘 일을 물어본다',
    actionId: action?.id ?? null,
    talkToNamesKo,
    propKo: action?.propKo ?? '주변 사람과 이야기',
    placeKo,
    questStepsKo: [
      `갈 곳 · ${placeKo}`,
      `말 걸기 · ${firstContactKo}`,
      ...roleStep,
      `할 일 · ${action?.propKo ?? '주변 사람'} · ${taskKo}`,
    ],
    requiredActorNameKo: action?.requiredActorId
      ? scene.actors.find(person => person.id === action.requiredActorId)?.nameKo ?? null : null,
    completed: Boolean((action && activeSession.actionOutcomes?.[action.id])
      || activeSession.completedObjectives?.includes(actor.objectiveId)),
    actionCompleted: Boolean(action && activeSession.actionOutcomes?.[action.id]),
  };
}

export function beginHistoricalSession(campaignState, event, maps, cards) {
  if (!campaignState || !event?.id || !maps?.[event.entryMapId] || !Array.isArray(event.actors))
    return { ok: false, reason: 'invalid_historical_event' };
  const session = clone(campaignState), returnState = clone(campaignState), nextCards = [...cards];
  session.historicalSession = { eventId: event.id, returnState, choices: [], completedObjectives: [], actionOutcomes: {}, pledgedActorIds: [], stage: 0,
    startedAtMinute: event.startMinute ?? 600, elapsedMinutes: 0 };
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
    card.occupation = actor.occupationKo ?? templateCard.occupation ?? '현장 인물';
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

export function advanceHistoricalSessionTime(session, minutes, maps, advanceWorldTime) {
  if (!session?.historicalSession || !Number.isFinite(minutes) || minutes <= 0 || typeof advanceWorldTime !== 'function') return session;
  const spent = Math.min(10080, Math.max(1, Math.floor(minutes)));
  const reservations = session.world?.currentMapId && session.player?.position
    ? [{ mapId: session.world.currentMapId, position: clone(session.player.position) }] : [];
  const next = advanceWorldTime(session, spent, maps, reservations);
  next.historicalSession.elapsedMinutes = (next.historicalSession.elapsedMinutes ?? 0) + spent;
  return next;
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
  if ((active.elapsedMinutes ?? 0) < (requirements.minimumElapsedMinutes ?? 0)) return false;
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
  const sceneMoves = option.sceneMoves ?? [];
  if (!Array.isArray(sceneMoves) || (action.gatherActorIds !== undefined
    && (!Array.isArray(action.gatherActorIds) || action.gatherActorIds.some(id => !scene.actors?.some(actor => actor.id === id))))
    || sceneMoves.some(move => {
    const actor = scene?.actors?.find(person => person.id === move.actorId);
    const target = scene?.fieldActions?.find(item => item.id === move.targetActionId);
    return !actor || !target || !scene.maps?.includes(target.mapId)
      || !Number.isInteger(target.position?.x) || !Number.isInteger(target.position?.y)
      || typeof move.activityKo !== 'string' || !session.hosts?.[actorKey(scene.eventId, actor.id)];
  })) return { ok: false, reason: 'invalid_historical_action', state: session };
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
  const gatheringActorIds = (action.gatherActorIds ?? []).filter(actorId =>
    next.player?.embodiment !== actorKey(scene.eventId, actorId));
  if (gatheringActorIds.length && Number.isInteger(action.position?.x) && Number.isInteger(action.position?.y)) {
    const atMinute = Number.isInteger(next.world.clockMinutes) ? next.world.clockMinutes : 0;
    next.historicalSession.groupGatherings ??= [];
    next.historicalSession.groupGatherings.push({ actionId: action.id, choiceId: option.id, mapId: action.mapId,
      position: clone(action.position), actorIds: clone(gatheringActorIds), atMinute });
    for (const actorId of gatheringActorIds) {
      const host = next.hosts[actorKey(scene.eventId, actorId)];
      if (!host) continue;
      const gatheringPosition = action.gatherPositions?.find(item => item.actorId === actorId)?.position ?? action.position;
      host.currentActivityKo = '현장 일에 참여하러 모인다';
      host.activeGoal = null; host.plannedPath = { key: null, tiles: [] }; host.mapRoutePlan = { key: null, route: null };
      host.schedule = [1, 31, 61].map(offset => ({ atMinute: atMinute + offset, mapId: action.mapId,
        position: clone(gatheringPosition), activityKo: '사람들과 현장 일을 살핀다' }));
    }
  }
  for (const move of sceneMoves) {
    const target = scene.fieldActions.find(item => item.id === move.targetActionId), host = next.hosts[actorKey(scene.eventId, move.actorId)];
    const destination = { mapId: target.mapId, position: clone(target.position), activityKo: move.activityKo };
    const atMinute = Number.isInteger(next.world.clockMinutes) ? next.world.clockMinutes : 0;
    // Keep the actor in the world and let the regular NPC pathfinder carry them
    // through the scene's exits. A choice sets their next appointment; it does
    // not teleport them (or a player controlling them) to its destination.
    host.currentActivityKo = `${destination.activityKo} · 그쪽으로 향한다`;
    host.activeGoal = null; host.plannedPath = { key: null, tiles: [] }; host.mapRoutePlan = { key: null, route: null };
    host.schedule = [1, 31, 61].map(offset => ({ atMinute: atMinute + offset, mapId: destination.mapId,
      position: clone(destination.position), activityKo: destination.activityKo }));
    next.historicalSession.physicalMoves ??= [];
    next.historicalSession.physicalMoves.push({ actorId: move.actorId, fromMapId: host.mapId,
      fromPosition: clone(host.position), targetMapId: destination.mapId, targetPosition: clone(destination.position),
      activityKo: destination.activityKo, choiceId: option.id, atMinute, status: 'EN_ROUTE' });
  }
  return { ok: true, state: next, action, option };
}
