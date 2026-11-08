const NPC_REACTION_FAMILIES = Object.freeze([
  ['stateChanges', (change, name) => `일과 변화: ${name(change.hostId)}이(가) ${change.from === 'IDLE' ? '일을 시작해' : '하던 일을 바꾸어'} ${change.activityKo || ({ TRAVELLING: '길을 나섬', WORKING: '일을 시작함', TRADING: '거래를 시작함', RESTING: '잠시 쉼', SOCIALIZING: '사람들과 어울림', DELIVERING: '물건을 전함' })[change.to] || '새 일과에 들어감'}`],
  ['moves', (move, name) => `길 위의 변화: ${name(move.hostId)}이(가) ${move.viaExit ? '다른 구역으로 길을 건너' : '골목을 따라'} ${move.activityKo || '목적지'}로 향함`],
  ['personalGoalVisits', (visit, name) => `목격한 생활 목표: ${name(visit.hostId)}이(가) ${visit.activityKo} (${visit.stage}/3)`],
  ['personalLifeOutcomes', (outcome, name) => `목격한 선택: ${name(outcome.hostId)}이(가) ${outcome.activityKo}`],
  ['personalContacts', (contact, name) => `목격한 이웃 만남: ${name(contact.hostId)}가 ${name(contact.partnerHostId, '이웃')}와 이야기를 나눔 · ${contact.meetingCount}번째 만남, ${contact.familiarity}`],
  ['deliveries', (delivery, name) => `목격한 배달: ${name(delivery.hostId)}가 ${name(delivery.recipientHostId, '이웃')}에게 ${delivery.itemKo} 전달`],
  ['exchanges', (exchange, name) => `목격한 거래: ${name(exchange.hostId)}와 ${name(exchange.recipientHostId, '이웃')}가 ${exchange.itemKo} 거래`],
  ['careTransfers', (transfer, name) => `목격한 가족 부양: ${name(transfer.hostId)}가 ${name(transfer.recipientHostId, '가족')}에게 ${transfer.amount}${transfer.unit === 'kopeks' ? '코페이카' : transfer.unit} 보탬`],
  ['payments', (payment, name) => `목격한 품삯 지급: ${name(payment.payerHostId)}가 ${name(payment.hostId)}에게 ${payment.amount}${payment.unit === 'kopeks' ? '코페이카' : payment.unit} 지급`],
  ['housing', (housing, name) => {
    const eventLabel = '목격한 방세';
    return housing.kind === 'RENT_PAID'
    ? `${eventLabel} · ${name(housing.hostId)}가 ${name(housing.landlordHostId)}에게 ${housing.amount}${housing.unit === 'kopeks' ? '코페이카' : housing.unit} 전달`
    : housing.kind === 'RENT_PARTIAL'
      ? `${eventLabel} · 일부 지급: ${name(housing.hostId)}가 ${name(housing.landlordHostId)}에게 ${housing.amount}${housing.unit === 'kopeks' ? '코페이카' : housing.unit} 전달 · 남은 금액 ${housing.amountDueRemaining}${housing.unit === 'kopeks' ? '코페이카' : housing.unit}`
      : `${eventLabel} · 체납: ${name(housing.hostId)}의 미납액 ${housing.arrears}${housing.unit === 'kopeks' ? '코페이카' : housing.unit}`;
  }],
  ['meals', (meal, name) => meal.kind === 'PURCHASE_AND_EAT'
    ? `목격한 시장 식사: ${name(meal.hostId)}가 ${name(meal.sellerHostId)}에게 ${meal.price}${meal.unit === 'kopeks' ? '코페이카' : meal.unit}를 내고 ${meal.itemKo}를 사서 먹음`
    : `목격한 끼니: ${name(meal.hostId)}가 ${meal.itemKo}로 끼니를 챙김`],
  ['livingEvents', (event, name) => {
    if (event.catalogIdSpace !== 'V37_EVENT_CATALOG_45' || event.validationStatus !== 'DESIGN_SEED_NOT_VERIFIED') return null;
    const label = event.catalogEventId === 'E01'
      ? event.stage === 'DUE_NOTICE' ? '방세 납부일 확인'
        : event.stage === 'PARTIAL_PAYMENT' ? '방세 일부 납부'
          : event.stage === 'OVERDUE' ? '방세 체납'
            : event.stage === 'SETTLED' ? '방세 납부 완료' : null
      : event.catalogEventId === 'E02'
      ? event.stage === 'PRICE_NOTICE' ? '빵 재고 소진 · 가격표 조정'
        : event.stage === 'RESTOCKED' ? '빵 재입고 · 조정 가격 적용'
          : event.stage === 'FIRST_PURCHASE' ? '조정 가격으로 첫 구매' : null
      : event.catalogEventId === 'E04'
        ? event.stage === 'LINEN_WASHED' ? '린넨 세탁'
          : event.stage === 'LINEN_EXCHANGED' ? '린넨 납품 · 세탁값 수령'
            : event.stage === 'ACCOUNTS_RECONCILED' ? '세탁값 장부 정리' : null
      : event.catalogEventId === 'E05'
        ? event.stage === 'PARCEL_MISSING' ? '배달 봉투가 인쇄소 문 앞에 남음'
          : event.stage === 'RECOVERED_BY_COURIER' ? '배달원이 봉투를 되찾음'
            : event.stage === 'ACCEPTED_BY_RECIPIENT' ? '늦은 봉투 접수 · 도착 기록'
            : event.stage === 'LOSS_REPORTED' ? '봉투 분실 보고'
              : event.stage === 'UNCLAIMED' ? '찾지 못한 봉투 · 현장 물품 회수' : null
      : event.catalogEventId === 'E07'
        ? event.stage === 'PROOF_PREPARED' ? '인쇄 마감 · 교정쇄 작성'
          : event.stage === 'TYPESET_CHECKED' ? '인쇄 마감 · 교정쇄 대조'
            : event.stage === 'WAGE_PAID' ? '인쇄 마감 · 품삯 지급'
              : event.stage === 'PRINTED_WITHOUT_RECHECK' ? '교정 전 인쇄를 보냄'
                : event.stage === 'JOB_CANCELLED' ? '인쇄 작업을 중단함' : null
        : event.catalogEventId === 'E08'
          ? event.stage === 'ORDER_ACCEPTED' ? '제본 주문 접수'
            : event.stage === 'BOOK_BOUND' ? '책 제본 완료'
              : event.stage === 'DELIVERED_PAID' ? '제본품 납품 · 대금 수령' : null
        : event.catalogEventId === 'E11'
          ? event.stage === 'BOAT_TRAFFIC' ? '배 통과 · 운하 길 통행 지연'
            : event.stage === 'CLEARED' ? '운하 길 통행 재개' : null
          : event.catalogEventId === 'E12'
            ? event.stage === 'INJURY' ? '하역 중 부상 · 자루를 떨어뜨림'
              : event.stage === 'TREATED' ? '하역 부상 · 조산사 처치'
                : event.stage === 'RESTED' ? '하역 부상 · 휴식 선택'
                  : event.stage === 'RESTED_UNTREATED' ? '하역 부상 · 치료 없이 휴식' : null
        : event.catalogEventId === 'E23'
          ? event.stage === 'EDITORIAL_NOTE_AT_PRESS' ? '장터 취재 메모가 편집대에 도착' : null
        : event.catalogEventId === 'E16'
          ? event.stage === 'SHORTAGE_FOUND' ? '약방 재고 부족 확인'
            : event.stage === 'ORDER_PLACED' ? '약방 물품 주문 메모'
              : event.stage === 'DELIVERED' ? '약방 물품 꾸러미 입고'
                : event.stage === 'ORDER_DECLINED' ? '약방 물품 주문 보류'
                  : event.stage === 'SUPPLY_UNAVAILABLE' ? '약방 물품 주문 미도착'
                    : event.stage === 'SUPPLY_WITHHELD' ? '약방 물품 인도 보류' : null
        : null;
    if (!label) return null;
    const actors = event.actorHostIds.map(id => name(id)).join(' · ');
    const amount = Number.isInteger(event.currentPrice) ? ` · ${event.currentPrice}코페이카`
      : Number.isInteger(event.payment) ? ` · ${event.payment}코페이카` : '';
    const delay = Number.isInteger(event.delayMinutes) ? ` · 약 ${event.delayMinutes}분 지연`
      : event.waitMinutesByHost ? ` · 이동 지연 ${Object.values(event.waitMinutesByHost).reduce((sum, value) => sum + value, 0)}분` : '';
    return `${label} · ${actors}${amount}${delay}`;
  }],
  ['restRecoveries', (rest, name) => `목격한 휴식: ${name(rest.hostId)}가 일손을 멈추고 숨을 돌림`],
  ['workOutputs', (work, name) => `목격한 일의 결과: ${name(work.hostId)} ${work.outputKo}`],
]);

const CIVIC_REACTION_TYPES = Object.freeze(['CITY_PURCHASE', 'NEWSPAPER_PUBLISHED', 'NEWSPAPER_CIRCULATED', 'POLICE_CUSTODY']);

export function formatObservedNpcReactions(entries, residents) {
  const residentNames = new Map(residents.map(resident => [resident.id, resident.displayNameKo]));
  const name = (id, fallback = '주민') => residentNames.get(id) ?? fallback;
  return entries.filter(entry => entry.eventType === 'NPC_SIMULATION').flatMap(entry => NPC_REACTION_FAMILIES.flatMap(([field, format]) =>
    (entry[field] ?? []).filter(event => event.witnessedByPlayer === true).map(event => format(event, name)).filter(Boolean).map(line => `${entry.date} · ${line}`)));
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
