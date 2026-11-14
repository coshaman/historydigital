const STORY_ENTRIES = Object.freeze([
  { id: 'MAIN01', titleKo: '금지된 삽화 연감', dateKo: '1848년', firstTaskKo: '구독 장부에서 이름을 찾고 인쇄소에서 부록을 확인한다.',
    introKo: '기다리는 손님은 늘고, 인쇄소에서는 아직 책이 나가지 못했다는 말만 들린다. 구독 장부부터 확인해 보자.',
    activitiesKo: [
      { type: 'quiz', labelKo: '날짜 퀴즈', startKo: '1848년 11월 30일 · 인쇄소 날짜 대조판에서 기록 네 장을 순서대로 놓는다' },
      { type: 'chase', labelKo: '파벨 추격', startKo: '1848년 10월 25일 · 파벨로 빙의해 책방 골목에서 세 흔적을 45분 안에 쫓는다' },
      { type: 'exploration', labelKo: '현장 문서 탐색', startKo: '각 장면 · 종이 모양 자료나 책 가까이에서 살펴보기를 눌러 읽는다' },
      { type: 'purchase', labelKo: '신문 종이·잉크 구매', startKo: '네프스키 거리 · 레프의 가판을 살펴보고 종이와 잉크를 산다' },
    ] },
  { id: 'MAIN03', titleKo: '혁명의 소식과 마지막 금요일', dateKo: '1848–1849년', firstTaskKo: '유럽에서 온 신문을 펼쳐 소식을 읽는다.',
    introKo: '유럽에서 전해진 소식이 서점과 모임에 닿는다. 누가 무엇을 읽고 어디서 들었는지부터 살펴보자.' },
  { id: 'MAIN05', titleKo: '콜레라가 도는 도시', dateKo: '1848년', firstTaskKo: '여관의 물통과 환자 기록을 확인한다.',
    introKo: '여관 손님 하나가 물을 찾고, 집주인은 물통과 방 안을 살핀다. 환자가 마신 물과 처음 아팠던 때를 확인하자.' },
]);

const storyIdFor = quest => quest?.storyId ?? (quest?.id?.includes('MAIN01') ? 'MAIN01'
  : quest?.id?.includes('MAIN03') ? 'MAIN03' : quest?.id?.includes('MAIN05') ? 'MAIN05' : null);
const yearMonthKo = date => {
  if (!/^\d{4}-\d{2}/.test(date ?? '')) return null;
  const [year, month] = date.split('-');
  return `${Number(year)}년 ${Number(month)}월`;
};

export function v47StoryMenuEntries() {
  return STORY_ENTRIES.map(entry => ({ ...entry }));
}

export function resolveV47StoryMenuEntries(state, quests = [], campaign = { arcs: [] }) {
  return STORY_ENTRIES.map(entry => {
    const guide = resolveV47StoryEntry(state, entry.id, quests, campaign);
    const statusLabelKo = guide.status === 'READY' ? '지금 시작'
      : guide.status === 'WAITING_FOR_DATE' ? '날짜를 기다리는 중'
        : guide.status === 'COMPLETE' ? '완료'
          : '도입 퀘스트';
    const menuTaskKo = guide.status === 'WAITING_FOR_CAMPAIGN'
      ? `먼저 할 퀘스트 · ${guide.currentTitleKo}\n${guide.currentTaskKo}`
      : guide.status === 'WAITING_FOR_DATE' ? guide.currentTaskKo
        : guide.status === 'COMPLETE' ? '기록된 선택과 후일담을 다시 볼 수 있습니다.'
          : `${guide.currentTitleKo} · ${guide.currentTaskKo}`;
    const introKo = guide.status === 'WAITING_FOR_CAMPAIGN'
      ? `먼저 ‘${guide.currentTitleKo}’ 일을 마치자.\n${guide.currentTaskKo}`
      : guide.status === 'WAITING_FOR_DATE'
        ? `${guide.currentTaskKo} 그동안 표시된 목표를 따라 도시를 둘러보세요.`
        : guide.status === 'COMPLETE' ? '남긴 선택과 후일담을 수첩에서 다시 볼 수 있습니다.' : entry.introKo;
    const currentPeriod = yearMonthKo(state?.world?.date);
    const storyPeriod = yearMonthKo(guide.storyStartDate);
    const timelineNoteKo = guide.status === 'WAITING_FOR_CAMPAIGN' && currentPeriod && storyPeriod
      && currentPeriod !== storyPeriod
      ? `현재 ${currentPeriod}입니다. 수첩의 도입 퀘스트를 따라가면 ${storyPeriod} 첫 장면이 열립니다.` : '';
    return { ...guide, statusLabelKo, menuTaskKo, introKo, timelineNoteKo,
      activitiesKo: (entry.activitiesKo ?? []).map(activity => ({ ...activity })) };
  });
}

export function resolveV47StoryEntry(state, storyId, quests = [], campaign = { arcs: [] }) {
  const entry = STORY_ENTRIES.find(item => item.id === storyId);
  if (!entry) return null;
  const storyQuest = quests.filter(quest => storyIdFor(quest) === storyId
      && state?.quests?.[quest.id]?.status !== 'resolved')
    .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')))[0];
  if (!storyQuest) return { ...entry, status: 'COMPLETE', storyQuestId: null, currentQuestId: null };
  const storyStartDate = storyQuest.date ?? null;

  const targetArcIndex = campaign.arcs.findIndex(arc => arc.id === storyQuest.chapterId);
  const currentArcIndex = campaign.arcs.findIndex(arc => arc.id === state?.world?.chapterId);
  const priorIds = targetArcIndex < 0 ? [] : campaign.arcs.slice(0, targetArcIndex + 1)
    .flatMap((arc, index) => arc.questIds.slice(0, index === targetArcIndex
      ? Math.max(0, arc.questIds.indexOf(storyQuest.id)) : undefined));
  const currentQuestId = priorIds.find(id => state?.quests?.[id]?.status !== 'resolved') ?? null;
  if (currentQuestId) {
    const currentQuest = quests.find(quest => quest.id === currentQuestId);
    return { ...entry, status: 'WAITING_FOR_CAMPAIGN', storyQuestId: storyQuest.id, storyStartDate, currentQuestId,
      currentTaskKo: currentQuest?.objectiveKo ?? currentQuest?.titleKo ?? '현재 열린 퀘스트를 진행한다.',
      currentContextKo: currentQuest?.premiseKo ?? currentQuest?.sourceContextKo ?? '',
      currentTitleKo: currentQuest?.titleKo ?? '현재 퀘스트', currentMapId: currentQuest?.entry?.mapId ?? null,
      currentChapterId: currentQuest?.chapterId ?? null };
  }
  if (storyQuest.chapterId !== state?.world?.chapterId || currentArcIndex < targetArcIndex) {
    return { ...entry, status: 'WAITING_FOR_CAMPAIGN', storyQuestId: storyQuest.id, storyStartDate, currentQuestId: null,
      currentTaskKo: '현재 장을 마치면 이 이야기가 열린다.', currentTitleKo: '다음 장을 기다린다',
      currentMapId: campaign.arcs[targetArcIndex]?.startMapId ?? null, currentChapterId: storyQuest.chapterId };
  }
  if (storyQuest.date && storyQuest.date > state.world.date) {
    return { ...entry, status: 'WAITING_FOR_DATE', storyQuestId: storyQuest.id, storyStartDate, currentQuestId: null,
      currentTaskKo: `${storyQuest.date}에 첫 장면이 열린다. 그동안 이 거리의 사람들과 일을 살핀다.`,
      currentTitleKo: storyQuest.titleKo, currentMapId: storyQuest.entry?.mapId ?? null,
      currentChapterId: storyQuest.chapterId };
  }
  return { ...entry, status: 'READY', storyQuestId: storyQuest.id, storyStartDate, currentQuestId: storyQuest.id,
    currentTaskKo: storyQuest.objectiveKo ?? entry.firstTaskKo, currentTitleKo: storyQuest.titleKo,
    currentContextKo: storyQuest.premiseKo ?? storyQuest.sourceContextKo ?? '',
    currentMapId: storyQuest.entry?.mapId ?? null, currentChapterId: storyQuest.chapterId };
}
