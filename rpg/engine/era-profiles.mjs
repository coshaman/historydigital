const DEFAULT_PROFILE = Object.freeze({
  layer: 'FICTIONAL_1840S',
  allowedChapterIds: ['V33_1847_PRINT', 'V33_1848_PUBLIC', 'V33_1849_PRELUDE', 'V33_1849_CIRCLE'],
  realmId: null,
  mapId: null,
  sourceIds: [],
});

export function decorateCardsWithEraProfiles(cards, registry) {
  const profiles = registry?.runtime_profiles;
  if (!profiles || !Array.isArray(cards)) throw new Error('Era registry runtime profiles are required');
  return cards.map(card => {
    let profile;
    if (card.kind === 'LITERARY') profile = profiles[card.id];
    else if (card.kind === 'HISTORICAL_RECONSTRUCTION') profile = profiles[card.id];
    else profile = profiles.default_fictional;
    if (!profile || !Array.isArray(profile.allowedChapterIds) || !Array.isArray(profile.sourceIds)) {
      throw new Error(`Missing era profile for runtime host ${card.id}`);
    }
    const expectedLayer = card.kind === 'LITERARY' ? 'LITERARY'
      : card.kind === 'HISTORICAL_RECONSTRUCTION' ? 'HISTORICAL_RECONSTRUCTION' : 'FICTIONAL_1840S';
    if (profile.layer !== expectedLayer) throw new Error(`Era layer disagrees with runtime card ${card.id}`);
    if (profile.layer === 'LITERARY' && (!profile.realmId || !profile.mapId || !profile.sourceIds.length)) {
      throw new Error(`Incomplete literary era profile for ${card.id}`);
    }
    if (profile.layer === 'LITERARY') {
      const chapterIds = Object.keys(card.objectiveByChapter ?? {});
      const sourceIds = [...(card.sourceIds ?? [])].sort();
      if (profile.realmId !== chapterIds[0] || profile.mapId !== card.start?.mapId
        || JSON.stringify([...profile.allowedChapterIds].sort()) !== JSON.stringify([...chapterIds].sort())
        || JSON.stringify([...profile.sourceIds].sort()) !== JSON.stringify(sourceIds)) {
        throw new Error(`Literary realm/source mismatch for runtime card ${card.id}`);
      }
    }
    if (profile.layer === 'HISTORICAL_RECONSTRUCTION') {
      const chapterIds = Object.keys(card.objectiveByChapter ?? {}).filter(id => id.startsWith('V33_'));
      if (JSON.stringify([...profile.allowedChapterIds].sort()) !== JSON.stringify([...chapterIds].sort())
        || JSON.stringify([...profile.sourceIds].sort()) !== JSON.stringify([...(card.sourceIds ?? [])].sort())) {
        throw new Error(`Historical reconstruction chapter/source mismatch for ${card.id}`);
      }
    }
    return { ...card, eraProfile: structuredClone(profile) };
  });
}

export function fallbackEraProfile(card) {
  if (card?.eraProfile) return structuredClone(card.eraProfile);
  if (card?.kind === 'LITERARY') {
    const realmId = card.objectiveByChapter && Object.keys(card.objectiveByChapter)[0];
    return { layer: 'LITERARY', allowedChapterIds: realmId ? [realmId] : [], realmId, mapId: card.start?.mapId ?? null, sourceIds: [] };
  }
  if (card?.kind === 'HISTORICAL_RECONSTRUCTION') {
    const chapters = Object.keys(card.objectiveByChapter ?? {}).filter(id => id.startsWith('V33_'));
    return { layer: 'HISTORICAL_RECONSTRUCTION', allowedChapterIds: chapters, realmId: null, mapId: null, sourceIds: [] };
  }
  return structuredClone(DEFAULT_PROFILE);
}
