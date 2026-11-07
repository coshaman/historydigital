// Display prerequisites without revealing ending scores or bypassing reducer checks.
function requiredParticipantsPresent(action, hostId, state, livingEvent) {
  const ids = [...(action.requiredPresentHostIds ?? [])];
  if (action.requiredPresentLivingEventHostKey) {
    const id = livingEvent?.[action.requiredPresentLivingEventHostKey];
    if (typeof id !== 'string') return false;
    ids.push(id);
  }
  if (!ids.length) return true;
  const actor = state?.hosts?.[hostId], distance = action.requiredParticipantDistance ?? 2;
  if (!actor || !Number.isInteger(distance) || distance < 1 || distance > 8) return false;
  return ids.every(id => {
    const participant = state.hosts[id];
    return participant && participant.id !== actor.id && participant.historicalAliveAndPresent !== false
      && participant.mapId === actor.mapId
      && Math.abs(participant.position.x - actor.position.x) + Math.abs(participant.position.y - actor.position.y) <= distance;
  });
}
function requiredNearbyAudiencePresent(action, hostId, state, livingEvent) {
  if (!action.requiresNearbyAudience) return true;
  const actor = state?.hosts?.[hostId], actorIds = new Set(livingEvent?.actorHostIds ?? []), distance = action.nearbyAudienceDistance ?? 5;
  if (!actor || !Number.isInteger(distance) || distance < 1 || distance > 8) return false;
  return Object.values(state.hosts ?? {}).some(person => person.id !== hostId && !actorIds.has(person.id)
    && person.historicalAliveAndPresent !== false && person.mapId === actor.mapId
    && Math.abs(person.position.x - actor.position.x) + Math.abs(person.position.y - actor.position.y) <= distance);
}
function requiredMarketStockPresent(action, state) {
  const requirement = action.requiredMarketStock;
  if (!requirement) return true;
  if (typeof requirement.sellerHostId !== 'string' || typeof requirement.itemKo !== 'string'
    || !Number.isInteger(requirement.quantity) || requirement.quantity < 1) return false;
  return (state?.hosts?.[requirement.sellerHostId]?.marketStock?.[requirement.itemKo] ?? 0) >= requirement.quantity;
}

export function questChoices(quest, hostId, knowledge = [], state = null) {
  const chain = quest.lifeChain, priorFlag = chain ? state?.world?.lifeChains?.[chain.id]?.history?.at(-1)?.resultFlag : null;
  const livingEvent = quest.requiresLivingEventId ? state?.world?.livingEventStates?.[quest.requiresLivingEventId] : null;
  return quest.actions.filter(action => action.hostIds.includes(hostId))
    .filter(action => !action.requiresLivingEventActorKey || livingEvent?.[action.requiresLivingEventActorKey] === hostId)
    .filter(action => !action.requiredLivingEventStage || livingEvent?.stage === action.requiredLivingEventStage)
    .filter(action => !action.requiredLivingEventDebtStatus || livingEvent?.debt?.status === action.requiredLivingEventDebtStatus)
    .filter(action => requiredParticipantsPresent(action, hostId, state, livingEvent))
    .filter(action => requiredNearbyAudiencePresent(action, hostId, state, livingEvent))
    .filter(action => requiredMarketStockPresent(action, state))
    .filter(action => action.minimumMoneyAmount === undefined
      || Number.isFinite(state?.hosts?.[hostId]?.money?.amount) && state.hosts[hostId].money.amount >= action.minimumMoneyAmount)
    .filter(action => !action.requiredPriorResultFlags?.length || action.requiredPriorResultFlags.includes(priorFlag)).map(action => ({
    action,
    missingSourceId: action.requiredKnowledgeId && !knowledge.includes(action.requiredKnowledgeId) ? action.requiredKnowledgeId : null,
  }));
}

// Keep continuation available after reading, conversation, movement and save/reload.
// A current playable quest still needs to be completed at its physical object.
export function continuationQuest(state, campaign, quests) {
  if (state.endingId || state.world.activeRealm) return null;
  const arc = campaign.arcs.find(item => item.id === state.world.chapterId);
  let previous = null;
  for (const id of arc?.questIds ?? []) {
    const quest = quests.find(item => item.id === id);
    if (!quest) return null;
    if (state.quests[id]?.status !== 'resolved') return previous && quest.date > state.world.date ? previous : null;
    previous = quest;
  }
  return previous;
}
