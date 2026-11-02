export function availableDiscussionQuests(state, definitions) {
  if (!state?.world?.date || !Array.isArray(definitions?.quests)) return [];
  const perspectivesByQuest = new Map();
  for (const entry of state.ledger ?? []) {
    if (entry.eventType !== 'DIALOGUE_TURN' || !entry.discussionId || !entry.hostId) continue;
    const perspectives = perspectivesByQuest.get(entry.discussionId) ?? new Set();
    perspectives.add(entry.hostId);
    perspectivesByQuest.set(entry.discussionId, perspectives);
  }
  return definitions.quests.filter(quest => quest.date <= state.world.date).map(quest => {
    const perspectiveHostIds = [...(perspectivesByQuest.get(quest.id) ?? [])];
    const requiredPerspectiveCount = Math.min(quest.requiredPerspectiveCount ?? 2, Object.keys(quest.hosts ?? {}).length);
    return {
      ...quest,
      perspectiveHostIds,
      requiredPerspectiveCount,
      completed: perspectiveHostIds.length >= requiredPerspectiveCount,
    };
  });
}

export function discussionPromptsForHost(hostId, quests) {
  return (quests ?? []).filter(quest => !quest.completed && quest.hosts?.[hostId] && !quest.perspectiveHostIds?.includes(hostId)).map(quest => ({
    discussionId: quest.id,
    topicId: quest.topicId,
    questTitleKo: quest.titleKo,
    promptKo: quest.hosts[hostId].promptKo,
    progressKo: `서로 다른 인물의 관점 ${quest.perspectiveHostIds?.length ?? 0}/${quest.requiredPerspectiveCount ?? 2}`,
  }));
}

export function discussionReflectionPromptsForHost(hostId, state, quests) {
  const completedReflections = new Set(state?.player?.dialogueGrowth?.reflectionIds ?? []);
  const comparisonNotes = new Set((state?.player?.dialogueGrowth?.comparisonNotes ?? []).map(note => note.discussionId));
  return (quests ?? []).filter(quest => quest.completed && comparisonNotes.has(quest.id) && quest.hosts?.[hostId])
    .filter(quest => !completedReflections.has(`${quest.id}::${hostId}`))
    .map(quest => ({
      reflectionId: quest.id,
      topicId: quest.topicId,
      questTitleKo: quest.titleKo,
      promptKo: quest.reflectionPromptKo ?? '이 문제를 다른 사람과도 이야기했어요. 당신은 어떤 점을 가장 먼저 따져봐야 한다고 생각하나요?',
    }));
}

export function discussionBoardView(quests, hostId = null, hostNames = {}) {
  const active = (quests ?? []).filter(quest => !quest.completed)
    .sort((a, b) => (b.perspectiveHostIds?.length ?? 0) - (a.perspectiveHostIds?.length ?? 0));
  const completedCount = (quests ?? []).length - active.length;
  const eligibleFor = quest => Object.keys(quest.hosts ?? {})
    .filter(id => !quest.perspectiveHostIds?.includes(id));
  const rows = hostId
    ? active.flatMap(quest => {
        const count = quest.perspectiveHostIds?.length ?? 0;
        const prompt = quest.hosts?.[hostId];
        if (prompt && !quest.perspectiveHostIds?.includes(hostId)) return [`${quest.titleKo} · ${count}/${quest.requiredPerspectiveCount ?? 2} 관점 · 지금 대화 중인 ${hostNames[hostId] ?? '인물'}에게 “${prompt.promptKo}”를 물어보세요.`];
        if (count > 0) {
          const nextHosts = eligibleFor(quest);
          const nextNames = nextHosts.map(id => hostNames[id] ?? id);
          return [`${quest.titleKo} · ${count}/${quest.requiredPerspectiveCount ?? 2} 관점 · 다음에는 ${nextNames.join(' · ')}에게 같은 쟁점을 물어보세요. 질문: “${quest.hosts?.[nextHosts[0]]?.promptKo ?? quest.reflectionPromptKo ?? quest.titleKo}”`];
        }
        return [];
      }).slice(0, 3)
    : active.slice(0, 3).map(quest => `${quest.titleKo} · ${quest.perspectiveHostIds?.length ?? 0}/${quest.requiredPerspectiveCount ?? 2} 관점 · 질문을 받을 사람: ${eligibleFor(quest).map(id => hostNames[id] ?? id).join(' · ')}. 두 사람에게 같은 쟁점을 물어보세요.`);
  return {
    progressKo: `견해 임무 · ${completedCount} / ${(quests ?? []).length} 완료`,
    guidanceKo: hostId
      ? '질문을 받은 인물의 관점이 기록됩니다. 다음 질문 대상이 지금 빌린 몸이라면 다른 인물의 몸으로 바꾼 뒤 말을 거세요.'
      : '질문을 받을 인물을 찾아 대화하세요. 직접 그 인물에게 말을 걸 수는 없으니, 다른 인물의 몸을 빌려 같은 쟁점을 두 사람에게 물어보세요.',
    rows,
    visible: active.length > 0,
  };
}
