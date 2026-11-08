export function historicalConversationChoices(data, eventId, objectiveId) {
  return data?.[eventId]?.[objectiveId] ?? [];
}
