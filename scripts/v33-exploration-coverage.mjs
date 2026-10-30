const addCount = (events, type) => events.reduce((total, event) => {
  if (event?.type !== type) return total;
  const count = event.count ?? 1;
  return Number.isSafeInteger(count) && count > 0 ? total + count : total;
}, 0);

export function summarizeExplorationCoverage(events) {
  const records = Array.isArray(events) ? events : [];
  const hostIds = [...new Set(records.filter(event => event?.type === 'possess' && typeof event.hostId === 'string').map(event => event.hostId))].sort();
  const coverage = {
    movementInputs: addCount(records, 'move'),
    objectInspections: addCount(records, 'inspect'),
    sourceReads: addCount(records, 'read_source'),
    hostIds,
    mapTransitions: addCount(records, 'map_transition'),
    questDecisions: addCount(records, 'quest_choice'),
  };
  coverage.goalDirected = coverage.movementInputs >= 20
    && coverage.objectInspections >= 3
    && coverage.sourceReads >= 2
    && coverage.hostIds.length >= 2
    && coverage.mapTransitions >= 1
    && coverage.questDecisions >= 1;
  return coverage;
}
