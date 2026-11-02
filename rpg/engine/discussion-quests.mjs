export function availableDiscussionQuests(state, definitions) {
  if (!state?.world?.date || !Array.isArray(definitions?.quests)) return [];
  const completedIds = new Set((state.ledger ?? []).filter(entry => entry.eventType === 'DIALOGUE_TURN' && entry.discussionId).map(entry => entry.discussionId));
  return definitions.quests.filter(quest => quest.date <= state.world.date).map(quest => ({
    ...quest,
    completed: completedIds.has(quest.id),
  }));
}

export function discussionPromptsForHost(hostId, quests) {
  return (quests ?? []).filter(quest => !quest.completed && quest.hosts?.[hostId]).map(quest => ({
    discussionId: quest.id,
    topicId: quest.topicId,
    questTitleKo: quest.titleKo,
    promptKo: quest.hosts[hostId].promptKo,
  }));
}
