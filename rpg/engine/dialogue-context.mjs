function authoredCueSets(card) {
  const activities = new Set([...(card.schedule ?? []).map(slot => slot.activityKo),
    ...(card.persistentPersonalGoals ?? []).flatMap(goal => (goal.autonomyStages ?? []).map(stage => stage.activityKo))].filter(Boolean));
  const aims = new Set([card.personalObjective, ...(card.todayGoals ?? []).map(goal => goal.textKo),
    ...(card.persistentPersonalGoals ?? []).flatMap(goal => [goal.descriptionKo, ...(goal.autonomyStages ?? []).map(stage => stage.activityKo)])].filter(Boolean));
  return { activities, aims };
}

export function dialogueSceneContext(card, host, date, mapId, questId = null, playerHistoricalEvents = [], embodiedHost = null) {
  const cues = authoredCueSets(card), activeGoal = host?.activeGoal, taskId = activeGoal?.taskId ?? '';
  const activityKo = cues.activities.has(host?.currentActivityKo) ? host.currentActivityKo : null;
  const persistentGoal = (card.persistentPersonalGoals ?? []).find(goal => taskId === goal.id || taskId.startsWith(`${goal.id}:`));
  const dailyGoal = (card.todayGoals ?? []).find(goal => goal.id === taskId);
  const workSlot = (card.schedule ?? []).find(slot => slot.workAction?.id === taskId || slot.task?.id === taskId);
  const kindByGoal = { NEED_INCOME: 'work', NEED_REST: 'care', PURCHASE_MEAL: 'personal', NEED_MEAL: 'personal', PERSONAL_RELATIONSHIP: 'social' };
  const kindGoal = (card.todayGoals ?? []).find(goal => goal.kind === kindByGoal[activeGoal?.type]);
  const currentAimKo = dailyGoal?.textKo ?? (persistentGoal ? persistentGoal.descriptionKo : null) ?? workSlot?.activityKo ?? kindGoal?.textKo ?? card.personalObjective ?? null;
  const needs = host?.needs ?? {};
  const hungerBand = Number.isFinite(needs.hunger) ? needs.hunger >= 75 ? 'VERY_HUNGRY' : needs.hunger >= 45 ? 'HUNGRY' : 'SATIATED' : 'UNKNOWN';
  const fatigueBand = Number.isFinite(needs.fatigue) ? needs.fatigue >= 70 ? 'EXHAUSTED' : needs.fatigue >= 40 ? 'TIRED' : 'RESTED' : 'UNKNOWN';
  const healthCondition = ['FIT', 'INJURED', 'UNWELL', 'RECOVERING'].includes(host?.healthState?.condition) ? host.healthState.condition : 'UNKNOWN';
  const heardRumors = host?.id === card.id ? (host.knownRumors ?? []).filter(row => row.eventId === 'E23'
    && ['UNVERIFIED', 'CHECKED', 'CORRECTED'].includes(row.status)).slice(-3).map(row => ({
      eventId: row.eventId, sourceEventId: row.sourceEventId, status: row.status, fromHostId: row.fromHostId,
    })) : [];
  const heardEvents = host?.id === card.id ? [...(host.heardEventReports ?? [])].sort((a, b) => b.atMinute - a.atMinute)
    .slice(0, 4).map(row => ({ catalogEventId: row.catalogEventId, stage: row.stage,
      summaryKo: row.summaryKo, sourceIds: [...row.sourceIds], knowledgeKind: row.knowledgeKind,
      occurrenceType: row.occurrenceType, validationStatus: row.validationStatus,
      historicalOutcomeFixed: row.historicalOutcomeFixed, fromHostId: row.fromHostId })) : [];
  const playerKnowledgeIds = embodiedHost ? [...new Set([...(embodiedHost.privateKnowledgeIds ?? []),
    ...(embodiedHost.witnessedKnowledgeIds ?? []), ...(embodiedHost.knownEvidenceIds ?? [])])].slice(-24) : [];
  return { date, mapId, questId, activityKo, currentAimKo: cues.aims.has(currentAimKo) ? currentAimKo : null,
    hungerBand, fatigueBand, healthCondition, heardRumors, heardEvents, playerHistoricalEvents, playerKnowledgeIds };
}
