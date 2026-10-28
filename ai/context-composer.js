function bounded(value, limit) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function dateValue(value) {
  const parts = String(value ?? '').split('-').map(Number);
  if (!parts[0]) return 0;
  if (!parts[1]) return parts[0] * 10000 + 1231;
  const lastDay = new Date(Date.UTC(parts[0], parts[1], 0)).getUTCDate();
  return parts[0] * 10000 + parts[1] * 100 + (parts[2] || lastDay);
}

function composeContext({ scene, characterId, characterCards, state = {}, claims = new Map(), memories = [], summary = '', recentTurns = [], playerInput = '' } = {}) {
  const character = characterCards?.characters?.find(card => card.id === characterId);
  if (!scene || !character || !Array.isArray(scene.allowedClaimIds)) throw new Error('Validated scene and character cards are required');
  const claimMap = claims instanceof Map ? claims : new Map((claims ?? []).map(claim => [claim.id, claim]));
  const selectedClaims = scene.allowedClaimIds.map(id => claimMap.get(id)).filter(claim => claim && claim.npcUsable !== false && dateValue(scene.date) >= dateValue(claim.availableDate))
    .slice(0, 6).map(claim => ({
      id: claim.id,
      claimClass: claim.claimClass,
      factKo: bounded(claim.factKo, 360),
      sourceIds: Array.isArray(claim.sourceIds) ? claim.sourceIds.slice(0, 4) : [],
      locator: bounded(claim.locator, 220),
      forbiddenInferenceNotes: (claim.forbiddenInferenceNotes ?? []).slice(0, 3).map(note => bounded(note, 180)),
    }));
  const relevantMemories = memories.filter(memory => memory.subjectId === 'player' && memory.characterId === characterId && ['STANCE', 'PROMISE', 'QUESTION', 'RELATIONSHIP_MOMENT'].includes(memory.kind))
    .slice(-12).map(memory => ({ id: memory.id, kind: memory.kind, summaryKo: bounded(memory.summaryKo, 180), salience: memory.salience }));
  const relationshipTone = {};
  for (const id of ['alexei', 'ekaterina', 'pavel']) {
    const value = Number(state.relationships?.[id] ?? 0);
    relationshipTone[id] = value <= -2 ? 'strained' : value < 1 ? 'reserved' : value < 3 ? 'trusting' : 'close';
  }
  const visibleRouteFacts = {};
  for (const key of ['circleContact', 'bookshopChoice', 'literatureAction', 'newsAction', 'supperDisagreement', 'protectedNames']) {
    const value = state.branchState?.[key];
    if (value !== undefined && ['string', 'number', 'boolean'].includes(typeof value)) visibleRouteFacts[key] = value;
  }
  return {
    scene: { id: scene.id, date: scene.date, locationKo: bounded(scene.locationKo, 120), objectiveKo: bounded(scene.objectiveKo, 240), turnLimit: scene.turnLimit },
    character: { id: character.id, nameKo: character.nameKo, coreTension: bounded(character.coreTension, 220), voice: character.voice, register: character.register },
    state: { relationshipTone, visibleRouteFacts },
    claims: selectedClaims,
    memories: relevantMemories,
    summary: bounded(summary, 1200),
    recentTurns: recentTurns.slice(-10).map(turn => ({ role: turn.role === 'user' ? 'user' : 'assistant', text: bounded(turn.text, 500), speakerId: bounded(turn.speakerId, 40) })),
    playerInput: bounded(playerInput, 800),
  };
}

exports.composeContext = composeContext;
