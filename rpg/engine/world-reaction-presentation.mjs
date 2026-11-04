const NPC_REACTION_FAMILIES = Object.freeze([
  ['stateChanges', (change, name) => `일과 변화: ${name(change.hostId)}이(가) ${change.from === 'IDLE' ? '일을 시작해' : '하던 일을 바꾸어'} ${change.activityKo || ({ TRAVELLING: '길을 나섬', WORKING: '일을 시작함', TRADING: '거래를 시작함', RESTING: '잠시 쉼', SOCIALIZING: '사람들과 어울림', DELIVERING: '물건을 전함' })[change.to] || '새 일과에 들어감'}`],
  ['moves', (move, name) => `길 위의 변화: ${name(move.hostId)}이(가) ${move.viaExit ? '다른 구역으로 길을 건너' : '골목을 따라'} ${move.activityKo || '목적지'}로 향함`],
  ['personalGoalVisits', (visit, name) => `목격한 생활 목표: ${name(visit.hostId)}이(가) ${visit.activityKo} (${visit.stage}/3)`],
  ['personalContacts', (contact, name) => `목격한 이웃 만남: ${name(contact.hostId)}가 ${name(contact.partnerHostId, '이웃')}를 찾아가 이야기를 나눔`],
  ['deliveries', (delivery, name) => `목격한 배달: ${name(delivery.hostId)}가 ${name(delivery.recipientHostId, '이웃')}에게 ${delivery.itemKo} 전달`],
  ['exchanges', (exchange, name) => `목격한 거래: ${name(exchange.hostId)}와 ${name(exchange.recipientHostId, '이웃')}가 ${exchange.itemKo} 거래`],
  ['meals', (meal, name) => `목격한 끼니: ${name(meal.hostId)}가 ${meal.itemKo}로 끼니를 챙김`],
  ['restRecoveries', (rest, name) => `목격한 휴식: ${name(rest.hostId)}가 일손을 멈추고 숨을 돌림`],
]);

const CIVIC_REACTION_TYPES = Object.freeze(['CITY_PURCHASE', 'NEWSPAPER_PUBLISHED', 'NEWSPAPER_CIRCULATED', 'POLICE_CUSTODY']);

export function formatObservedNpcReactions(entries, residents) {
  const residentNames = new Map(residents.map(resident => [resident.id, resident.displayNameKo]));
  const name = (id, fallback = '주민') => residentNames.get(id) ?? fallback;
  return entries.filter(entry => entry.eventType === 'NPC_SIMULATION').flatMap(entry => NPC_REACTION_FAMILIES.flatMap(([field, format]) =>
    (entry[field] ?? []).filter(event => event.witnessedByPlayer === true).map(event => `${entry.date} · ${format(event, name)}`)));
}

export function formatCivicReaction(entry, { productName, storyName, residentName }) {
  if (!CIVIC_REACTION_TYPES.includes(entry?.eventType)) return null;
  if (entry.eventType === 'CITY_PURCHASE') return `${entry.date} · 가판대에서 ${productName(entry.productId)} 구입 · ${entry.priceKopeks} 코페이카`;
  if (entry.eventType === 'NEWSPAPER_PUBLISHED') return `${entry.date} · 신문 인쇄 · ${storyName(entry.storyId)}`;
  if (entry.eventType === 'NEWSPAPER_CIRCULATED') return `${entry.date} · 신문 배포 · ${entry.route === 'postal' ? '지방행 우편' : '거리 독자'}`;
  const name = residentName(entry.hostId);
  return `${entry.date} · 경찰 접수·연행 · ${name}`;
}

export const OBSERVED_NPC_REACTION_FAMILY_COUNT = NPC_REACTION_FAMILIES.length;
export const CIVIC_REACTION_FAMILY_COUNT = CIVIC_REACTION_TYPES.length;
