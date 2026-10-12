const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validateBranchGraph(graph, sources = []) {
  const errors = [];
  if (!isObject(graph)) return { valid: false, errors: ['branch graph must be an object'] };
  for (const key of ['hubs', 'branches', 'events', 'anchors', 'transitions', 'endingRoutes']) if (!Array.isArray(graph[key])) errors.push(`graph missing ${key} array`);
  if (errors.length) return { valid: false, errors };
  if (graph.hubs.length !== 4) errors.push(`expected 4 pivotal hubs, found ${graph.hubs.length}`);
  const unique = (items, kind) => {
    const seen = new Set();
    for (const item of items) {
      const id = item?.id ?? (kind === 'branch' ? item?.choiceId : null);
      if (!id) errors.push(`${kind} missing id`);
      else if (seen.has(id)) errors.push(`duplicate ${kind} id ${id}`);
      else seen.add(id);
    }
    return seen;
  };
  const hubIds = unique(graph.hubs, 'hub');
  const branchIds = unique(graph.branches, 'branch');
  const eventIds = unique(graph.events, 'event');
  unique(graph.anchors, 'anchor');
  if (graph.endingRoutes.length !== 5 || new Set(graph.endingRoutes).size !== 5) errors.push('graph must preserve exactly five unique ending routes');
  if (Array.isArray(graph.sequence)) {
    const stepDates = new Map([...graph.hubs, ...graph.anchors].map(item => [item.id, item.date]));
    const expectedHubs = new Set(graph.hubs.map(hub => hub.id));
    const sequenceHubs = graph.sequence.filter(id => expectedHubs.has(id));
    if (expectedHubs.size !== sequenceHubs.length || [...expectedHubs].some(id => !sequenceHubs.includes(id))) errors.push('route sequence must include each branch hub exactly once');
    for (const id of graph.sequence) if (!stepDates.has(id)) errors.push(`route sequence references unknown step ${id}`);
    const dates = graph.sequence.map(id => stepDates.get(id)).filter(Boolean);
    for (let index = 1; index < dates.length; index += 1) if (dates[index] < dates[index - 1]) errors.push(`route chronology reverses between ${graph.sequence[index - 1]} and ${graph.sequence[index]}`);
  } else errors.push('route sequence is missing');
  const callbackKeys = new Set();
  const reactionIds = new Set();
  const reactionTexts = graph.eventPredicates?.nextHubAcknowledgements?.flatMap(group => Object.keys(group.reactionTexts ?? {})) ?? [];
  const sourceIds = new Set(sources.map(source => typeof source === 'string' ? source : source?.sourceId ?? source?.id));
  for (const [choiceId, ids] of Object.entries(graph.eventSourceIdsByChoice ?? {})) {
    if (!branchIds.has(choiceId)) errors.push(`event sources reference unknown choice ${choiceId}`);
    if (!Array.isArray(ids)) errors.push(`${choiceId}: event source list must be an array`);
    for (const id of ids ?? []) if (!sourceIds.has(id)) errors.push(`${choiceId}: unknown event source ${id}`);
  }
  for (const hub of graph.hubs) {
    const owned = graph.branches.filter(branch => branch.hubId === hub.id);
    if (owned.length !== 3 || !Array.isArray(hub.branchIds) || hub.branchIds.length !== 3 || new Set(hub.branchIds).size !== 3) errors.push(`${hub.id}: expected exactly three unique branch options`);
    for (const id of hub.branchIds ?? []) if (!branchIds.has(id) || !owned.some(branch => branch.id === id || branch.choiceId === id)) errors.push(`${hub.id}: unknown branch ${id}`);
    if (hub.nextHubId && hub.nextHubId !== 'END' && !hubIds.has(hub.nextHubId)) errors.push(`${hub.id}: missing next hub target ${hub.nextHubId}`);
  }
  for (const branch of graph.branches) {
    if (!hubIds.has(branch.hubId)) errors.push(`${branch.id ?? branch.choiceId}: missing hub ${branch.hubId}`);
    const label = branch.id ?? branch.choiceId;
    const direction = branch.immediateDirection;
    if (!direction || !isObject(direction)) errors.push(`${label}: missing immediateDirection`);
    else for (const field of ['action', 'audience', 'risk']) if (typeof direction[field] !== 'string' || !direction[field].trim()) errors.push(`${label}: immediateDirection missing ${field}`);
    if (direction && !('recordMode' in direction) && !('record' in direction)) errors.push(`${label}: immediateDirection missing recordMode`);
    if (direction && typeof direction.documentLeavesOffice !== 'boolean' && typeof direction.leavesOffice !== 'boolean') errors.push(`${label}: immediateDirection missing documentLeavesOffice`);
    if (!eventIds.has(branch.immediateEventId)) errors.push(`${branch.id ?? branch.choiceId}: missing immediate event ${branch.immediateEventId}`);
    if (!branch.nextHubReactionId || !reactionTexts.includes(branch.nextHubReactionId)) errors.push(`${label}: missing nextHubReactionId reaction text`);
    if (branch.nextHubReactionId && reactionIds.has(branch.nextHubReactionId)) errors.push(`${label}: duplicate nextHubReactionId ${branch.nextHubReactionId}`);
    if (branch.nextHubReactionId) reactionIds.add(branch.nextHubReactionId);
    if (!branch.callbackKey) errors.push(`${label}: missing callbackKey`);
    if (branch.callbackKey && callbackKeys.has(branch.callbackKey)) errors.push(`${label}: duplicate callbackKey ${branch.callbackKey}`);
    if (branch.callbackKey) callbackKeys.add(branch.callbackKey);
    if (!Array.isArray(branch.sourceIds) || !branch.sourceIds.length) errors.push(`${label}: missing sourceIds`);
    for (const id of branch.sourceIds ?? []) if (!sourceIds.has(id)) errors.push(`${branch.id ?? branch.choiceId}: unknown source ${id}`);
    if (branch.eventSourceIds !== undefined && !Array.isArray(branch.eventSourceIds)) errors.push(`${label}: eventSourceIds must be an array`);
    for (const id of branch.eventSourceIds ?? []) if (!sourceIds.has(id)) errors.push(`${label}: unknown event source ${id}`);
  }
  if (graph.pairwiseInteractions !== undefined) {
    if (!Array.isArray(graph.pairwiseInteractions)) errors.push('pairwiseInteractions must be an array');
    else {
      const pairKeys = new Set();
      const hubOrder = new Map(graph.hubs.map((hub, index) => [hub.id, index]));
      for (const interaction of graph.pairwiseInteractions) {
        const label = `${interaction?.afterChoiceId ?? '(missing prior choice)'} -> ${interaction?.currentChoiceId ?? '(missing current choice)'}`;
        const prior = graph.branches.find(branch => branch.choiceId === interaction?.afterChoiceId);
        const current = graph.branches.find(branch => branch.choiceId === interaction?.currentChoiceId);
        if (!prior || !current) errors.push(`pairwise interaction ${label}: references unknown choice`);
        else if (hubOrder.get(prior.hubId) >= hubOrder.get(current.hubId)) errors.push(`pairwise interaction ${label}: choices are not in forward hub order`);
        const key = `${interaction?.currentChoiceId}|${interaction?.afterChoiceId}`;
        if (pairKeys.has(key)) errors.push(`pairwise interaction ${label}: duplicate choice pair`);
        pairKeys.add(key);
        if (!interaction?.line || typeof interaction.line.speaker !== 'string' || !interaction.line.speaker.trim() || typeof interaction.line.text !== 'string' || !interaction.line.text.trim()) errors.push(`pairwise interaction ${label}: missing speaker or dialogue text`);
      }
      for (const [currentIndex, hub] of graph.hubs.entries()) {
        if (currentIndex === 0) continue;
        for (const current of graph.branches.filter(branch => branch.hubId === hub.id)) {
          for (const priorHub of graph.hubs.slice(0, currentIndex)) for (const prior of graph.branches.filter(branch => branch.hubId === priorHub.id)) {
            if (!pairKeys.has(`${current.choiceId}|${prior.choiceId}`)) errors.push(`pairwise interaction missing ${prior.choiceId} -> ${current.choiceId}`);
          }
        }
      }
    }
  }
  for (const transition of graph.transitions) {
    if (!hubIds.has(transition.fromHubId)) errors.push(`transition has missing source hub ${transition.fromHubId}`);
    if (transition.toHubId !== 'END' && !hubIds.has(transition.toHubId)) errors.push(`transition has missing target ${transition.toHubId}`);
  }
  return { valid: errors.length === 0, errors };
}

function enumerateRouteVectors(graph) {
  const hubs = [...(graph?.hubs ?? [])].sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  return hubs.reduce((vectors, hub) => {
    const options = hub.branchIds ?? graph.branches.filter(branch => branch.hubId === hub.id).map(branch => branch.choiceId ?? branch.id);
    return vectors.flatMap(vector => options.map(choiceId => ({ choiceIds: [...vector.choiceIds, choiceId] })));
  }, [{ choiceIds: [] }]);
}

function resolveBranchEvent(graph, hubId, choiceId, routeState = {}) {
  const branch = graph.branches.find(item => item.hubId === hubId && (item.choiceId === choiceId || item.id === choiceId));
  if (!branch) throw new Error(`unknown branch choice ${hubId}/${choiceId}`);
  const orderedHubs = [...graph.hubs].sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  const choiceIndex = orderedHubs.findIndex(hub => hub.id === hubId);
  const existing = [...(routeState.routeChoices ?? [])].slice(0, choiceIndex);
  const nextState = {
    ...routeState,
    routeChoices: [...existing, branch.choiceId ?? branch.id],
    branchState: { ...(routeState.branchState ?? {}), ...(branch.stateWrites ?? {}) },
    historicalAnchors: routeState.historicalAnchors ?? graph.anchors
  };
  const priorChoiceIds = new Set(existing);
  const interactionLines = (graph.pairwiseInteractions ?? [])
    .filter((variant) => variant.currentChoiceId === branch.choiceId && priorChoiceIds.has(variant.afterChoiceId))
    .map((variant) => ({ ...variant.line, choiceId: variant.afterChoiceId }));
  return { eventId: branch.immediateEventId, reactionId: branch.nextHubReactionId, callbackKey: branch.callbackKey, interactionLines, nextState };
}

function matches(when, state) {
  if (!when || !isObject(when)) return false;
  return Object.entries(when).every(([key, value]) => {
    if (key === 'exposureAtLeast') return Number(state.exposure ?? state.branchState?.exposure ?? 0) >= Number(value);
    if (key.endsWith('AtLeast')) return Number(state[key.slice(0, -8)] ?? state.branchState?.[key.slice(0, -8)] ?? 0) >= Number(value);
    if (key.endsWith('Equals')) return (state[key.slice(0, -6)] ?? state.branchState?.[key.slice(0, -6)]) === value;
    return (state[key] ?? state.branchState?.[key]) === value;
  });
}

function resolveNextHub(graph, hubId, state = {}) {
  const transition = graph.transitions.find(item => item.fromHubId === hubId && !item.fallback && matches(item.when, state));
  if (transition) return transition.toHubId;
  const fallback = graph.transitions.find(item => item.fromHubId === hubId && item.fallback);
  if (fallback) return fallback.toHubId;
  return graph.hubs.find(hub => hub.id === hubId)?.nextHubId ?? null;
}

function resolveRouteNextStep(graph, stepId) {
  const index = graph.sequence?.indexOf(stepId) ?? -1;
  return index >= 0 ? graph.sequence[index + 1] ?? null : null;
}

const api = { validateBranchGraph, enumerateRouteVectors, resolveBranchEvent, resolveNextHub, resolveRouteNextStep };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof globalThis !== 'undefined') globalThis.Main20BranchGraph = api;
