const clone = value => structuredClone(value);
const actorKey = (eventId, actorId) => `historical:${eventId}:${actorId}`;

export function beginHistoricalSession(campaignState, event, maps, cards) {
  if (!campaignState || !event?.id || !maps?.[event.entryMapId] || !Array.isArray(event.actors))
    return { ok: false, reason: 'invalid_historical_event' };
  const session = clone(campaignState), returnState = clone(campaignState), nextCards = [...cards];
  session.historicalSession = { eventId: event.id, returnState, choices: [], completedObjectives: [], stage: 0 };
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
    card.occupation = actor.occupationKo ?? '현장에 모인 사람';
    card.personalObjective = actor.introductionKo ?? actor.lines?.[0] ?? '사람들과 오늘의 일을 의논한다';
    const allowedMaps = event.mapIds ?? [event.entryMapId];
    card.allowedMaps = [...new Set([...(card.allowedMaps ?? []), ...allowedMaps])];
    card.start = { mapId: actor.mapId, x: actor.position.x, y: actor.position.y };
    card.presenceWindow = null;
    host.id = id; host.mapId = actor.mapId; host.position = clone(actor.position); host.historicalAliveAndPresent = true;
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

export function completeHistoricalObjective(session, objectiveId) {
  if (!session?.historicalSession || !objectiveId) return session;
  const next = clone(session);
  if (!next.historicalSession.completedObjectives.includes(objectiveId)) next.historicalSession.completedObjectives.push(objectiveId);
  return next;
}
