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
    const perspectiveHostIds = [...(perspectivesByQuest.get(quest.id) ?? [])].filter(hostId => quest.hosts?.[hostId]);
    const requiredPerspectiveCount = Math.min(quest.requiredPerspectiveCount ?? 2, Object.keys(quest.hosts ?? {}).length);
    const comparisonNote = comparisonByQuest.get(quest.id) ?? null;
    return {
      ...quest,
      perspectiveHostIds,
      requiredPerspectiveCount,
      completed: perspectiveHostIds.length >= requiredPerspectiveCount && positionByQuest.has(quest.id),
      comparisonNote,
      playerPosition: positionByQuest.get(quest.id) ?? null,
      positionPending: Boolean(comparisonNote && perspectiveHostIds.length >= requiredPerspectiveCount
        && !positionByQuest.has(quest.id) && (quest.playerPositionChoices ?? definitions.playerPositionChoices)?.length),
      playerPositionChoices: quest.playerPositionChoices ?? definitions.playerPositionChoices ?? [],
    };
  });
}

export function discussionPromptsForHost(hostId, quests, { contextQuestId = null, requireContext = false } = {}) {
  return (quests ?? []).filter(quest => !quest.completed && quest.hosts?.[hostId] && !quest.perspectiveHostIds?.includes(hostId)
    && (!requireContext || Boolean(contextQuestId && quest.contextQuestId === contextQuestId))).map(quest => ({
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

export function discussionQuestInstruction(quest, hostNames = {}) {
  if (!quest) return null;
  const required = quest.requiredPerspectiveCount ?? 2;
  const heard = quest.perspectiveHostIds ?? [];
  if (quest.positionPending || heard.length >= required) return {
    phase: 'RECORD_POSITION', questTitleKo: quest.titleKo, hostId: null, hostNameKo: null, promptKo: null,
    howKo: `대화는 끝났습니다. 지금 할 일 · 수첩에서 「${quest.titleKo}」에 대한 입장 하나를 기록하세요. 기록하면 퀘스트가 끝납니다.`,
  };
  const hostId = Object.keys(quest.hosts ?? {}).find(id => !heard.includes(id));
  if (!hostId) return {
    phase: 'WAIT', hostId: null, hostNameKo: null, promptKo: null,
    howKo: '수첩의 쟁점 목록을 확인하세요.',
  };
  const hostNameKo = hostNames[hostId] ?? hostId;
  const promptKo = quest.hosts[hostId].promptKo;
  const nextHostId = heard.length + 1 < required
    ? Object.keys(quest.hosts ?? {}).find(id => id !== hostId && !heard.includes(id))
    : null;
  const nextHostKo = nextHostId ? hostNames[nextHostId] ?? nextHostId : null;
  const nextPromptKo = nextHostId ? quest.hosts[nextHostId].promptKo : null;
  return {
    phase: 'ASK', questTitleKo: quest.titleKo, hostId, hostNameKo, promptKo, nextHostNameKo: nextHostKo, nextPromptKo,
    howKo: `${quest.situationKo ? `상황 · ${quest.situationKo}\n` : ''}1단계 · ${hostNameKo}에게 말 걸기\n질문 · “${promptKo}”를 고르거나 같은 내용을 직접 물으세요.\n진행 · 답변을 받으면 ${heard.length + 1}/${required} 관점 기록 (인사나 대화창 열기만으로는 진행되지 않음)\n${nextHostKo && nextPromptKo ? `다음 · ${nextHostKo}에게 “${nextPromptKo}”라고 물으세요.\n` : ''}완료 · 서로 다른 ${required}명의 답을 들은 뒤 수첩에서 「${quest.titleKo}」의 입장을 기록하세요.`,
  };
}

export function discussionFollowUpAfterTurn(quest, hostNames = {}) {
  if (!quest) return null;
  const instruction = discussionQuestInstruction(quest, hostNames);
  if (instruction?.phase === 'ASK') return {
    phase: 'ASK',
    queuedInquiry: {
      questId: quest.id,
      hostId: instruction.hostId,
      hostNameKo: instruction.hostNameKo,
      titleKo: quest.titleKo,
      promptKo: instruction.promptKo,
      progressKo: `${quest.perspectiveHostIds?.length ?? 0}/${quest.requiredPerspectiveCount ?? 2} 관점`,
      completedPerspectives: quest.perspectiveHostIds?.length ?? 0,
      requiredPerspectives: quest.requiredPerspectiveCount ?? 2,
      stakesKo: quest.stakesKo ?? '',
    },
    statusKo: `질문 답변 기록 · ${quest.perspectiveHostIds?.length ?? 0}/${quest.requiredPerspectiveCount ?? 2}명. 다음은 ${instruction.hostNameKo}에게 “${instruction.promptKo}”라고 물어보세요.`,
  };
  return {
    phase: 'RECORD_POSITION',
    queuedInquiry: null,
    statusKo: '필요한 답을 모두 기록했습니다. 수첩에서 내 입장을 고르면 이 퀘스트가 끝납니다.',
  };
}

export function formatDiscussionQuestTaskKo(instruction, { placeKo = '', travelHowKo = '' } = {}) {
  if (!instruction) return '';
  if (instruction.phase === 'RECORD_POSITION')
    return instruction.howKo ?? '지금 할 일 · 수첩에서 이 쟁점에 대한 입장 하나를 기록하세요. 기록하면 퀘스트가 끝납니다.';
  if (instruction.phase !== 'ASK') return '';
  const required = instruction.quest?.requiredPerspectiveCount ?? 2;
  const count = instruction.quest?.perspectiveHostIds?.length ?? 0;
  return [
    instruction.quest?.situationKo ? `상황 · ${instruction.quest.situationKo}` : '',
    `1단계 · ${instruction.hostNameKo}에게 말 걸기${placeKo ? ` · ${placeKo}` : ''}`,
    travelHowKo ? `이동 · ${travelHowKo}` : '',
    `질문 · “${instruction.promptKo}”를 고르거나 같은 내용을 직접 물으세요.`,
    `진행 · 답변을 받으면 ${count + 1}/${required} 관점이 기록됩니다. 인사만으로는 기록되지 않습니다.`,
    instruction.nextHostNameKo && instruction.nextPromptKo ? `다음 · ${instruction.nextHostNameKo}에게 “${instruction.nextPromptKo}”라고 물으세요.` : '',
    `완료 · 서로 다른 ${required}명의 답을 들은 뒤 수첩에서 「${instruction.quest?.titleKo ?? instruction.questTitleKo ?? '이 쟁점'}」의 입장을 선택해 기록하세요 (${count}/${required}명 답변).`,
  ].filter(Boolean).join('\n');
}

export function formatQueuedDiscussionTaskKo(quest, {
  hostNameKo = '표시된 인물', placeKo = '', promptKo = '',
  nextHostNameKo = '', nextPromptKo = '',
} = {}) {
  if (!quest) return '';
  const required = quest.requiredPerspectiveCount ?? 2;
  const heard = quest.perspectiveHostIds?.length ?? 0;
  if (heard >= required || quest.positionPending) return [
    `마지막 단계 · 「${quest.titleKo}」`,
    '수첩을 열고 이 쟁점에 대한 내 입장 하나를 고르세요.',
    '완료 조건 · 입장을 기록하면 퀘스트가 끝납니다.',
  ].join('\n');
  return [
    quest.situationKo ? `상황 · ${quest.situationKo}` : '',
    `진행 · ${heard + 1}/${required + 1}단계 · ${hostNameKo}에게 말 걸기${placeKo ? ` · ${placeKo}` : ''}`,
    `질문 · “${promptKo}”를 고르거나 같은 내용을 직접 물으세요.`,
    `진행 인정 · 답변을 받아야 관점 ${heard + 1}/${required}가 기록됩니다. 인사·대화창 열기만으로는 진행되지 않습니다.`,
    heard + 1 < required
      ? nextHostNameKo && nextPromptKo ? `다음 · ${nextHostNameKo}에게 “${nextPromptKo}”라고 물으세요.` : `다음 · 다른 인물에게 물어 ${required}명의 답을 모으세요.`
      : '다음 · 이 답을 들은 뒤 수첩에서 내 입장을 기록하세요.',
    `완료 · 서로 다른 ${required}명의 답을 듣고 수첩에서 「${quest.titleKo}」의 내 입장을 선택해 기록하세요.`,
  ].filter(Boolean).join('\n');
}

export function discussionReplyAction(replyText, queuedPrompt) {
  if (queuedPrompt && replyText === queuedPrompt) return {
    label: '퀘스트 질문 묻기',
    subcopy: `이 질문을 고르거나 같은 쟁점을 직접 물어보세요 · “${queuedPrompt}”`,
    questQuestion: true,
  };
  return { label: replyText, subcopy: '', questQuestion: false };
}

export function resolveQueuedDiscussionPrompt(queuedInquiry, quests, hostId, playerText = '') {
  if (!queuedInquiry || queuedInquiry.hostId !== hostId) return null;
  const quest = (quests ?? []).find(item => item.id === queuedInquiry.questId && item.hosts?.[hostId]);
  if (!quest) return null;
  const plainText = String(playerText).trim();
  if (/^(?:안녕하세요[!.?。]?|안녕하십니까[!.?。]?|좋은 아침(?:입니다)?[!.?。]?|잠깐 이야기 나눠도 될까요[!.?。]?|오늘은 무슨 일로 바쁘세요[!.?。]?|요즘 지내는 이야기를 들려주세요[!.?。]?)$/u.test(plainText)) return null;
  const stripKoreanEnding = token => token.replace(/(?:에게서|에서는|으로는|이라면|라면|다면|습니까|인가요|까요|에게|에서|으로|부터|까지|은|는|이|가|을|를|의|에|와|과|도|만|로|고|면|서|다|요|오|죠)$/u, '');
  const ignored = new Set(['좋', '담', '못', '그', '누구', '무엇', '어떤', '어떻게', '어디', '우리', '당신', '것']);
  const relatedTerms = [['책', '도서', '읽기'], ['비싸', '값', '가격', '저렴', '싸'], ['품삯', '임금', '월급']];
  const topicTerms = [...new Set((queuedInquiry.promptKo ?? quest.hosts[hostId].promptKo).match(/[가-힣]{2,}/gu)
    .map(stripKoreanEnding).filter(term => (term.length >= 2 || relatedTerms.some(group => group.includes(term))) && !ignored.has(term)))];
  const playerTerms = new Set((plainText.match(/[가-힣]{2,}/gu) ?? []).map(stripKoreanEnding).filter(Boolean));
  const matchesPlayer = term => playerTerms.has(term) || [...playerTerms].some(word => word.includes(term) || term.includes(word));
  const overlap = topicTerms.filter(term => matchesPlayer(term)
    || relatedTerms.some(group => group.includes(term) && group.some(alias => matchesPlayer(alias)))).length;
  if (plainText !== (queuedInquiry.promptKo ?? quest.hosts[hostId].promptKo) && overlap < Math.min(2, topicTerms.length)) return null;
  return { discussionId: quest.id, questTitleKo: quest.titleKo, promptKo: quest.hosts[hostId].promptKo };
}

export function nextDiscussionInstructionForQuest(questId, quests, hostNames = {}, sourceIds = []) {
  if (!questId) return null;
  const sources = new Set(sourceIds);
  const active = (quests ?? []).filter(item => !item.completed);
  const quest = active.find(item => item.contextQuestId === questId)
    ?? active.find(item => !item.contextQuestId && (item.sourceIds ?? []).some(id => sources.has(id)));
  if (!quest) return null;
  return { quest, ...discussionQuestInstruction(quest, hostNames) };
}

export function discussionReplyChoices(queuedPrompt, suggestedReplies = []) {
  const choices = (Array.isArray(suggestedReplies) ? suggestedReplies : []).slice(0, 3);
  if (!queuedPrompt) return choices;
  if (choices.some(choice => choice?.textKo === queuedPrompt)) return choices;
  // Keep the quest's actionable question visible when the model fills all
  // three reply slots.
  return [...choices.slice(0, 2), { textKo: queuedPrompt }];
}


export function shouldShowQuestTracker({ ending = false, literaryScene = false, hasActions = false, storyOverview = false, activeDialogue = false, keepVisible = false } = {}) {
  return !ending && !literaryScene && (!hasActions || storyOverview || activeDialogue || keepVisible);
}

export function shouldOpenDiscussionBoard({ queuedInquiry = false, positionPending = false, activeDialogue = false, missionInquiry = false } = {}) {
  return queuedInquiry || positionPending || activeDialogue || missionInquiry;
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
  const steps = active.flatMap(quest => {
    const count = quest.perspectiveHostIds?.length ?? 0;
    const required = quest.requiredPerspectiveCount ?? 2;
    const heard = (quest.perspectiveHostIds ?? []).map(id => ({ questId: quest.id, done: true,
      textKo: `${hostNames[id] ?? id}의 관점을 들었습니다.` }));
    const remaining = eligibleFor(quest).slice(0, Math.max(0, required - count)).map((id, index) => ({
      questId: quest.id, done: false,
      textKo: `${count + index + 1}/${required} · ${hostNames[id] ?? id}에게 “${quest.hosts?.[id]?.promptKo ?? quest.reflectionPromptKo ?? quest.titleKo}”라고 물으세요.`,
    }));
    return [...heard, ...remaining, { questId: quest.id, done: false,
      textKo: `${required}명의 답을 들은 뒤 수첩에서 「${quest.titleKo}」의 입장을 하나 선택하면 끝납니다.` }];
  });
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
      situationKo: quest.situationKo ?? '',
      promptKo: prompt,
      progressKo: `${quest.perspectiveHostIds?.length ?? 0}/${quest.requiredPerspectiveCount ?? 2} 관점`,
      completedPerspectives: quest.perspectiveHostIds?.length ?? 0,
      requiredPerspectives: quest.requiredPerspectiveCount ?? 2,
      stakesKo: quest.stakesKo ?? '',
    };
  }).filter(Boolean);
  return {
    progressKo: `쟁점 ${completedCount}/${(quests ?? []).length}${positionPrompts.length ? ` · 내 입장 ${positionPrompts.length}개` : ''}`,
    guidanceKo: positionPrompts.length
      ? `지금 할 일 · 수첩에서 「${positionPrompts[0]?.titleKo ?? '이 쟁점'}」의 입장을 골라 기록하세요. 선택하면 퀘스트가 끝납니다.`
      : nextComparison
      ? discussionQuestInstruction(nextComparison, hostNames)?.howKo
      : active.length
        ? discussionQuestInstruction(active[0], hostNames)?.howKo
        : '질문을 담고 표시된 인물에게 말을 거세요. 대화에서 제시된 질문을 고르고, 서로 다른 두 사람의 답을 들은 뒤 수첩에서 내 입장을 기록하면 끝납니다.',
    rows,
    recommendations,
    steps: positionPrompts.length
        ? [{ done: true, textKo: '서로 다른 두 인물의 답을 들었습니다.' }, { done: false, textKo: `수첩에서 「${positionPrompts[0]?.titleKo ?? '이 쟁점'}」의 입장을 하나 골라 기록하면 퀘스트가 끝납니다.` }]
      : steps,
    positionPrompts: positionPrompts.map(quest => ({
      questId: quest.id,
      titleKo: quest.titleKo,
      choices: quest.playerPositionChoices,
    })),
    visible: active.length > 0 || positionPrompts.length > 0,
  };
}
