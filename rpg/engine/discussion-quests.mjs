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

export function discussionBoardView(quests, hostId = null, hostNames = {}, totalQuestCount = quests?.length ?? 0) {
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
    progressKo: `사건과 생각을 묻기 · ${completedCount} / ${(quests ?? []).length} 완료 · 지금 ${(quests ?? []).length}개 / 전체 ${totalQuestCount}개`,
    guidanceKo: nextComparison
      ? `사건·이념 임무 · 첫 관점 기록됨. 다음은 ${nextComparisonName}에게 같은 쟁점 묻기: “${nextComparisonQuestion}” 표시된 인물에게 이동해 E로 몸을 빌린 뒤, 가까이서 말을 걸어 질문하세요. 두 관점을 모으면 수첩에 비교 메모가 남습니다.`
      : hostId
        ? '사건·이념 임무 · 질문을 하나 고르고 이 인물에게 말을 건 뒤, 표시되는 다른 직업의 사람에게 같은 쟁점을 물어보세요. 두 관점이 모이면 수첩에 비교 메모가 남습니다.'
        : '사건·이념 임무 · ① 질문 선택 ② 표시된 인물에게 이동해 E로 몸을 빌리기 ③ 가까이서 말을 걸고 질문하기. 다음 인물에게 같은 쟁점을 물으면 관점 비교 메모를 얻습니다.',
    rows,
    recommendations,
    visible: active.length > 0,
  };
}
