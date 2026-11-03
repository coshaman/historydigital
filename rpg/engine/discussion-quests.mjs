export function availableDiscussionQuests(state, definitions) {
  if (!state?.world?.date || !Array.isArray(definitions?.quests)) return [];
  const perspectivesByQuest = new Map();
  const comparisonByQuest = new Map((state.player?.dialogueGrowth?.comparisonNotes ?? []).map(note => [note.discussionId, note]));
  const positionByQuest = new Map((state.player?.dialogueGrowth?.playerPositions ?? []).map(note => [note.discussionId, note]));
  for (const entry of state.ledger ?? []) {
    if (entry.eventType !== 'DIALOGUE_TURN' || !entry.discussionId || !entry.hostId) continue;
    const perspectives = perspectivesByQuest.get(entry.discussionId) ?? new Set();
    perspectives.add(entry.hostId);
    perspectivesByQuest.set(entry.discussionId, perspectives);
  }
  return definitions.quests.filter(quest => quest.date <= state.world.date).map(quest => {
    const perspectiveHostIds = [...(perspectivesByQuest.get(quest.id) ?? [])];
    const requiredPerspectiveCount = Math.min(quest.requiredPerspectiveCount ?? 2, Object.keys(quest.hosts ?? {}).length);
    const comparisonNote = comparisonByQuest.get(quest.id) ?? null;
    return {
      ...quest,
      perspectiveHostIds,
      requiredPerspectiveCount,
      completed: perspectiveHostIds.length >= requiredPerspectiveCount,
      comparisonNote,
      playerPosition: positionByQuest.get(quest.id) ?? null,
      positionPending: Boolean(comparisonNote && !positionByQuest.has(quest.id) && definitions.playerPositionChoices?.length),
      playerPositionChoices: definitions.playerPositionChoices ?? [],
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

export function discussionBoardView(quests, hostId = null, hostNames = {}, totalQuestCount = quests?.length ?? 0) {
  const active = (quests ?? []).filter(quest => !quest.completed)
    .sort((a, b) => (b.perspectiveHostIds?.length ?? 0) - (a.perspectiveHostIds?.length ?? 0));
  const completedCount = (quests ?? []).length - active.length;
  const positionPrompts = (quests ?? []).filter(quest => quest.positionPending);
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
      })
    : active.map(quest => {
      const firstHost = eligibleFor(quest)[0];
      const firstName = hostNames[firstHost] ?? firstHost ?? '가까운 인물';
      const firstQuestion = quest.hosts?.[firstHost]?.promptKo ?? quest.reflectionPromptKo ?? quest.titleKo;
      return `${quest.titleKo} · ${quest.perspectiveHostIds?.length ?? 0}/${quest.requiredPerspectiveCount ?? 2} 관점 · ${firstName}에게 먼저 묻기: “${firstQuestion}”`;
    });
  const nextComparison = active.find(quest => (quest.perspectiveHostIds?.length ?? 0) > 0 && eligibleFor(quest).length);
  const nextComparisonHost = nextComparison ? eligibleFor(nextComparison)[0] : null;
  const nextComparisonName = hostNames[nextComparisonHost] ?? nextComparisonHost;
  const nextComparisonQuestion = nextComparison?.hosts?.[nextComparisonHost]?.promptKo;
  const recommendations = active.map(quest => {
    const eligible = eligibleFor(quest);
    const selectedHostId = hostId && eligible.includes(hostId) ? hostId : eligible[0];
    const prompt = selectedHostId ? quest.hosts?.[selectedHostId]?.promptKo : null;
    if (!selectedHostId || !prompt) return null;
    return {
      questId: quest.id,
      hostId: selectedHostId,
      hostNameKo: hostNames[selectedHostId] ?? selectedHostId,
      titleKo: quest.titleKo,
      promptKo: prompt,
      progressKo: `${quest.perspectiveHostIds?.length ?? 0}/${quest.requiredPerspectiveCount ?? 2} 관점`,
      completedPerspectives: quest.perspectiveHostIds?.length ?? 0,
      requiredPerspectives: quest.requiredPerspectiveCount ?? 2,
      stakesKo: quest.stakesKo ?? '',
    };
  }).filter(Boolean);
  return {
    progressKo: `사건·철학·이념 임무 · 쟁점 비교 ${completedCount}/${(quests ?? []).length} · 지금 할 수 있는 임무 ${(quests ?? []).length}개 / 전체 ${totalQuestCount}개${positionPrompts.length ? ` · 내 입장 기록 ${positionPrompts.length}개 남음` : ''}`,
    guidanceKo: positionPrompts.length
      ? `두 사람의 관점을 모았습니다. 아래에서 이 사건을 볼 때 당신이 먼저 따질 기준을 골라 수첩에 남기세요.`
      : nextComparison
      ? `첫 관점을 기록했습니다. 다음은 ${nextComparisonName}에게 같은 쟁점을 물어보세요: “${nextComparisonQuestion}” 질문할 인물과 다른 주민의 몸을 빌린 뒤, 표시된 상대에게 가까이 가서 말 걸기를 누르세요. 두 관점을 모으면 수첩에 비교 메모가 남습니다.`
      : hostId
        ? '쟁점 하나를 골라 표시된 주민에게 먼저 물으세요. 다른 주민에게 같은 질문을 해 답을 비교한 뒤, 내 판단을 수첩에 남기면 끝납니다.'
        : '사건·철학·이념 임무입니다. 질문 하나를 담고 표시된 사람에게 가세요. 그와 다른 주민의 몸을 빌려 가까이서 말을 걸면 질문 선택지가 나타납니다. 두 번째 주민에게 같은 질문을 하고 답을 비교한 뒤, 내 판단을 수첩에 남기세요. 다음 사람과 장소는 목록에 표시됩니다.',
    rows,
    recommendations,
    positionPrompts: positionPrompts.map(quest => ({
      questId: quest.id,
      titleKo: quest.titleKo,
      choices: quest.playerPositionChoices,
    })),
    visible: active.length > 0 || positionPrompts.length > 0,
  };
}
