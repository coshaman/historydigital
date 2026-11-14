const sourceCards = [
  { id: 'announcement', titleKo: '2월호에 실린 연감 공고', dateJulian: '31 января 1848 · 허가', dateGregorian: '1848-02-12',
    sourceId: 'V47-NEKRASOV-ALMANAC-CONTENTS-1848', sourceKindKo: '1848년 잡지 공고' },
  { id: 'request', titleKo: '수정 원고를 다시 맡기다', dateJulian: '20 августа 1848', dateGregorian: '1848-09-01',
    sourceId: 'V47-PANAEV-LETTER-1848-08-20', sourceKindKo: '파나예프의 편지' },
  { id: 'ban', titleKo: '배포를 금하다', dateJulian: '20 октября 1848', dateGregorian: '1848-11-01',
    sourceId: 'V47-ALMANAC-CENSORSHIP-EDITORIAL', sourceKindKo: '1997년 편집 주기' },
  { id: 'subscriber', titleKo: '구독자에게 답하다', dateJulian: '17 ноября 1848', dateGregorian: '1848-11-29',
    sourceId: 'V47-NEKRASOV-SUBSCRIBER-LETTER-1848', sourceKindKo: '1848년 구독자 편지' },
];
const answer = ['announcement', 'request', 'ban', 'subscriber'];

export function createMain01TimelineState() {
  return { schemaVersion: 'V47_MAIN01_TIMELINE_V1', status: 'IN_PROGRESS', order: [], attempts: 0 };
}

export function main01TimelineStage(previousState) {
  const state = previousState ?? createMain01TimelineState();
  if (state.status === 'COMPLETE') return null;
  return {
    title: '연감의 날짜를 맞추다',
    prompt: '날짜표를 오래된 기록부터 놓아 순서를 맞춘다.',
    order: [...state.order],
    cards: sourceCards.filter(card => !state.order.includes(card.id)).map(card => ({ ...card })),
    placed: state.order.map(id => ({ ...sourceCards.find(card => card.id === id) })),
    canConfirm: state.order.length === answer.length,
  };
}

export function resolveMain01Timeline(previousState, actionId) {
  const state = structuredClone(previousState ?? createMain01TimelineState());
  if (state.status === 'COMPLETE') return { accepted: false, state, reason: 'already_complete' };
  if (actionId.startsWith('V47_TIMELINE_PLACE:')) {
    const id = actionId.slice('V47_TIMELINE_PLACE:'.length);
    if (!sourceCards.some(card => card.id === id) || state.order.includes(id) || state.order.length >= answer.length) {
      return { accepted: false, state, reason: 'card_unavailable' };
    }
    state.order.push(id);
    return { accepted: true, state, effects: {} };
  }
  if (actionId === 'V47_TIMELINE_UNDO') {
    state.order.pop();
    return { accepted: true, state, effects: {} };
  }
  if (actionId === 'V47_TIMELINE_RESET') {
    state.order = [];
    return { accepted: true, state, effects: {} };
  }
  if (actionId === 'V47_TIMELINE_CHECK') {
    if (state.order.length !== answer.length) return { accepted: false, state, reason: 'incomplete_order' };
    if (state.order.some((id, index) => id !== answer[index])) {
      state.attempts += 1;
      return { accepted: false, state, reason: 'dates_out_of_order' };
    }
    state.status = 'COMPLETE';
    return { accepted: true, state, effects: { item: { hostId: 'editor_sofia', itemKo: '연감의 날짜를 정리한 대조표' } } };
  }
  return { accepted: false, state, reason: 'choice_unavailable' };
}

export const main01TimelineSources = sourceCards.map(card => ({ ...card }));
