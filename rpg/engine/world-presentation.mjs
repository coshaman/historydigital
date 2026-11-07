const chapters = ['V33_1847_PRINT', 'V33_1848_PUBLIC', 'V33_1849_CIRCLE'];

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
