// Display prerequisites without revealing ending scores or bypassing reducer checks.
export function questChoices(quest, hostId, knowledge = [], state = null) {
  const chain = quest.lifeChain, priorFlag = chain ? state?.world?.lifeChains?.[chain.id]?.history?.at(-1)?.resultFlag : null;
  return quest.actions.filter(action => action.hostIds.includes(hostId))
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
