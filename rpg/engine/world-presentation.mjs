const chapters = ['V33_1847_PRINT', 'V33_1848_PUBLIC', 'V33_1849_CIRCLE'];

export function ambientBubbleFor(state, hostCards, map, time, paused = false, exchanges = []) {
  const period = 18000, phase = time % period;
  if (paused || phase >= 3600) return null;
  const presentIds = new Set(hostCards.filter(card => card.id !== state.player.embodiment
    && state.hosts?.[card.id]?.mapId === map.mapId && state.hosts[card.id]?.historicalAliveAndPresent !== false).map(card => card.id));
  const available = exchanges.filter(item => (item.mapIds ?? []).includes(map.mapId)
    && item.speakers?.length === 2 && item.speakers.every(speaker => presentIds.has(speaker.hostId))
    && item.speakers.every(speaker => {
      const position = state.hosts[speaker.hostId]?.position;
      return Number.isFinite(position?.x) && Number.isFinite(position?.y);
    })
    && Math.abs(state.hosts[item.speakers[0].hostId].position.x - state.hosts[item.speakers[1].hostId].position.x)
      + Math.abs(state.hosts[item.speakers[0].hostId].position.y - state.hosts[item.speakers[1].hostId].position.y) <= 10);
  if (available.length) {
    const offset = [...map.mapId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const exchange = available[(Math.floor(time / period) + offset) % available.length];
    return { exchange: exchange.speakers };
  }
  const residents = hostCards.filter(card => card.ambientLines?.length
    && card.id !== state.player.embodiment && state.hosts?.[card.id]?.mapId === map.mapId
    && state.hosts[card.id]?.historicalAliveAndPresent !== false);
  if (!residents.length) return null;
  const offset = [...map.mapId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const card = residents[(Math.floor(time / period) + offset) % residents.length];
  return { hostId: card.id, line: card.ambientLines[Math.floor(time / 7000) % card.ambientLines.length] };
}

export function objectIsPresent(object, state, quests = []) {
  if (object.visible === false) return false;
  const p = Object.fromEntries((object.properties ?? []).map(item => [item.name, item.value]));
  if (p.availableChapterId && (chapters.indexOf(p.availableChapterId) < 0 || chapters.indexOf(state.world.chapterId) < chapters.indexOf(p.availableChapterId))) return false;
  if (p.availableDate && p.availableDate > state.world.date) return false;
  if (object.type !== 'quest-object') return true;
  const quest = quests.find(item => item.id === p.questId);
  if (!quest) return false;
  const requiredEventId = p.requiresLivingEventId ?? quest.requiresLivingEventId;
  const requiredEvent = requiredEventId ? state.world.livingEventStates?.[requiredEventId] : null;
  const requiredEventStage = p.requiresLivingEventStage ?? quest.requiresLivingEventStage;
  const debtStatuses = quest.requiresLivingEventDebtStatus ? [].concat(quest.requiresLivingEventDebtStatus) : null;
  if (requiredEventId && (debtStatuses ? !debtStatuses.includes(requiredEvent?.debt?.status) : requiredEvent?.status !== 'ACTIVE')) return false;
  if (requiredEventStage && requiredEvent?.stage !== requiredEventStage) return false;
  if (!questPrerequisitesMet(state, quest)) return false;
  const realm = quest.realmId ?? (quest.chapterId?.startsWith('LITERARY_') ? quest.chapterId : null);
  return realm ? state.world.activeRealm?.id === realm
    : quest.chapterId === state.world.chapterId && (!quest.date || quest.date <= state.world.date);
}

// Keep map emphasis aligned with the actions inspect() can actually perform.
// This deliberately excludes scenery and objects whose current gate is closed.
export function isActionableInteraction(object, state, map, quests = []) {
  if (!object || !state || !map || map.mapId !== state.world.currentMapId
    || !objectIsPresent(object, state, quests)) return false;
  const p = Object.fromEntries((object.properties ?? []).map(item => [item.name, item.value]));
  const hostId = state.player.embodiment;
  if (object.type === 'npc') {
    const id = p.hostId;
    return Boolean(id && id !== hostId && state.hosts?.[id]?.historicalAliveAndPresent
      && state.hosts[id].mapId === map.mapId);
  }
  if (object.type === 'quest-object') {
    const quest = quests.find(item => item.id === p.questId);
    return Boolean(hostId && quest && state.quests?.[quest.id]?.status !== 'resolved'
      && quest.actions?.some(action => action.hostIds?.includes(hostId)));
  }
  if (object.type === 'source') return Boolean(p.sourceId);
  if (object.type === 'map-exit') {
    if (state.player.civic?.custody?.active && p.targetMapId !== 'police-station') return false;
    if (!hostId) return p.publicAccess === true || p.publicAccess === 'true';
    return Boolean(state.hosts?.[hostId]?.allowedMaps?.includes(p.targetMapId));
  }
  // Service desks and authored scene props are interpreted by inspect().
  return Boolean(object.type || p.serviceId || p.evidenceId || p.sourceId);
}

export function questPrerequisitesMet(state, quest) {
  if ((quest.prerequisiteQuestIds ?? []).some(id => state.quests?.[id]?.status !== 'resolved')) return false;
  const chain = quest.lifeChain;
  if (!chain) return true;
  const progress = state.world?.lifeChains?.[chain.id];
  if (chain.stage === 1) return !progress;
  return progress?.stage === chain.stage - 1
    && progress.history?.at(-1)?.questId === chain.previousQuestId;
}

// Existing project-authored tiles: a physical object, not a generic hollow square.
export function interactionTile(object) {
  const p = Object.fromEntries((object.properties ?? []).map(item => [item.name, item.value]));
  const assetTileId = Number(p.assetTileId);
  if (Number.isInteger(assetTileId) && assetTileId >= 1 && assetTileId <= 85) return assetTileId;
  if (object.type === 'map-exit') return 13;
  if (object.type === 'source') return 29;
  if (object.type === 'quest-object') return 24;
  if (p.evidenceId === 'TYPE_CASE_LAYOUT') return 20;
  if (p.evidenceId === 'COURTYARD_WELL_NOTE') return 28;
  return 21;
}
