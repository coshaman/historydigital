// Additional V47 story beats. This module is intentionally disjoint from
// v47-main-stories.mjs: it adds only the 29 graph beats not authored there.
// Scenario graph/role data informed fictional gameplay; it is not itself a
// historical source. Every choice uses the V47 world-change integration shape.
import { walkableTilesReachableFromArrivals } from './walkable-placement.mjs';

const sources = {
  belinskyLetter: 'OBJ-BELINSKY-LETTER-GOGOL-1847',
  dostoevskyArrestOrder: 'OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849',
  manifesto1848: 'OBJ-NICHOLAS-MANIFESTO-1848',
  fourierDictionary: 'V47-PETRASHESKY-FOURIER-NOVATORSTVO-1846',
  almanacReview: 'V47-KRYLOV-ASSESSMENT-1848-09-06',
};

const julianToGregorian = value => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 12);
  return date.toISOString().slice(0, 10);
};

const change = ({ money = [], inventory = [], moves = [], resources = {}, relationships = [], rumor = null, flags = {} }) => ({
  money: money.filter(transfer => transfer.amount > 0),
  inventory,
  moves,
  resources: {
    waterRiskDelta: 0,
    foodRiskDelta: 0,
    bedsDelta: 0,
    medicineDelta: 0,
    ...resources,
  },
  relationships: relationships.filter(edge => edge.fromHostId !== edge.toHostId),
  rumor,
  flags,
});

const choice = (id, hostIds, labelKo, outcomeKo, worldChange, requirements = {}) => ({
  id,
  hostIds: [...new Set(hostIds)],
  ...requirements,
  labelKo,
  resultKo: outcomeKo,
  effects: {
    v47StoryAction: id,
    v47WorldChange: {
      ...change(worldChange),
      // Authored move coordinates follow the map's 16px Tiled coordinates;
      // runtime character positions use tile coordinates.
      moves: change(worldChange).moves.map(move => ({ ...move, x: Math.floor(move.x / 16), y: Math.floor(move.y / 16) })),
      // A document, receipt, or parcel described as created by this action is
      // materialized in the sender's inventory before transfer.
      inventory: change(worldChange).inventory.map(item => ({ ...item, produceIfAbsent: true })),
    },
  },
});

const beat = ({ storyId, beatId, date, titleKo, objectiveKo, mapId, objectId, sourceIds = [], sourceContextKo, prerequisiteQuestIds = [], hosts, choices }) => ({
  id: `V47_${storyId}_${beatId}`,
  storyId,
  beatId,
  originalJulianDate: date,
  date: julianToGregorian(date),
  titleKo,
  objectiveKo,
  entry: { mapId, objectId },
  mapId,
  objectId,
  sourceIds,
  prerequisiteQuestIds,
  sourceContextKo,
  metadata: {
    reconstruction: 'FICTIONAL_SCENE',
    historicalOutcomeImmutable: true,
    playerHosts: hosts,
  },
  actions: choices,
});

export const v47StoryBeats = [
  // MAIN01 — the illustrated almanac. Beat dates are converted from the
  // Russian Julian calendar; the opening precedes the permit, while the
  // authored sequence keeps the documented ban and subscriber reply in order.
  beat({ storyId: 'MAIN01', beatId: 'A01', date: '1848-01-31', titleKo: '《동시대인》을 기다리는 사람들', objectiveKo: '서점에서 다리야와 연감 이야기를 하고 인쇄소에 갈 사람을 정한다', mapId: 'bookshop-interior', objectId: 9060, sourceIds: ['V47-NEKRASOV-ALMANAC-CONTENTS-1848'], sourceContextKo: '다리야가 네프스키의 서점에서 아직 나오지 않은 《삽화 연감》을 기다린다.', hosts: ['bookseller_lev', 'reader_darya', 'courier_pavel'], choices: [
    choice('V47_A01_OPEN_SUBSCRIBER_LEDGER', ['bookseller_lev', 'reader_darya'], '다리야와 《동시대인》을 함께 읽는다', '레프가 가게에 남은 《동시대인》을 다리야에게 내준다. 연감이 나올 때까지 책을 돌려 읽을 수 있다.', { inventory: [{ fromHostId: 'bookseller_lev', toHostId: 'reader_darya', itemKo: '함께 읽는 《동시대인》', quantity: 1 }], relationships: [{ fromHostId: 'bookseller_lev', toHostId: 'reader_darya', trustDelta: 1 }], rumor: { id: 'V47_SUBSCRIBER_LEDGER_CHECKED', fromHostId: 'reader_darya', hostIds: ['courier_pavel'] }, flags: { V47_A01_SUBSCRIBER_CONFIRMED: true } }),
    choice('V47_A01_SEND_PAVEL_TO_PRINTSHOP', ['bookseller_lev', 'courier_pavel'], '파벨을 리테이니로 보낸다', '파벨이 인쇄소로 가서 출고 가능한 묶음이 있는지 묻는다. 확인 전까지 다리야에게 날짜를 약속하지 않는다.', { inventory: [{ fromHostId: 'bookseller_lev', toHostId: 'courier_pavel', itemKo: '인쇄소 확인 쪽지', quantity: 1 }], moves: [{ hostId: 'courier_pavel', mapId: 'printshop', x: 144, y: 176 }], relationships: [{ fromHostId: 'bookseller_lev', toHostId: 'courier_pavel', trustDelta: 1 }], rumor: { id: 'V47_PRINTER_STATUS_REQUESTED', fromHostId: 'courier_pavel', hostIds: ['printer_ekaterina'] }, flags: { V47_A01_PRINT_STATUS_REQUESTED: true } }),
  ]}),
  beat({ storyId: 'MAIN01', beatId: 'A02', date: '1848-04-16', titleKo: '센나야 사람들이 묻는 파리', objectiveKo: '센나야 쪽 선술집에서 레프와 파벨의 이야기를 듣고, 독자와 인쇄소 중 먼저 도울 쪽을 고른다', mapId: 'inn-interior', objectId: 9061, sourceIds: [sources.manifesto1848], sourceContextKo: '루이 필리프가 물러났다. 니콜라이 1세의 3월 선언을 읽은 사람들이 술상에 둘러앉았다.', hosts: ['bookseller_lev', 'courier_pavel'], choices: [
    choice('V47_A02_REFUND_DEPOSIT', ['bookseller_lev', 'courier_pavel'], '안나에게 구독료 일부를 돌려준다', '기다리던 손님에게 일부를 돌려주어 당장 쓸 현금은 줄고 항의는 잦아든다.', { money: [{ fromHostId: 'bookseller_lev', toHostId: 'seamstress_anna', amount: 2 }], inventory: [{ fromHostId: 'bookseller_lev', toHostId: 'reader_darya', itemKo: '예약 영수증', quantity: 1 }], moves: [{ hostId: 'reader_darya', mapId: 'bookshop-interior', x: 112, y: 144 }], relationships: [{ fromHostId: 'bookseller_lev', toHostId: 'reader_darya', trustDelta: 1 }], rumor: { id: 'V47_SUBSCRIBER_REFUND', fromHostId: 'reader_darya', hostIds: ['seamstress_anna'] }, flags: { V47_A02_PARTIAL_REFUND: true } }),
    choice('V47_A02_PAY_PRINTER', ['bookseller_lev', 'courier_pavel'], '파벨 편에 식자공들의 품삯을 보낸다', '서점은 당장 환불할 여유를 잃지만 인쇄소가 작업자 품삯을 지급한다.', { money: [{ fromHostId: 'bookseller_lev', toHostId: 'printer_ekaterina', amount: 3 }], inventory: [{ fromHostId: 'courier_pavel', toHostId: 'printer_ekaterina', itemKo: '선금 봉투', quantity: 1 }], moves: [{ hostId: 'courier_pavel', mapId: 'printshop', x: 144, y: 176 }], relationships: [{ fromHostId: 'bookseller_lev', toHostId: 'printer_ekaterina', trustDelta: 1 }], rumor: { id: 'V47_ADVANCE_PAYMENT', fromHostId: 'courier_pavel', hostIds: ['print_apprentice_stepan'] }, flags: { V47_A02_PRINTER_ADVANCE: true } }),
  ]}),
  beat({ storyId: 'MAIN01', beatId: 'A03', date: '1848-05-06', titleKo: '아버지의 집', objectiveKo: '봄에 찍은 인쇄지를 읽고, 인쇄소 사람들과 누구까지 독서회에 부를지 정한다', mapId: 'printshop', objectId: 9062, sourceIds: ['V47-PANAEVA-TALNIKOV-CH1-1848'], sourceContextKo: '「탈니코프 가족」에서 아이가 죽은 날을 두고 편집자와 산파의 의견이 갈린다.', hosts: ['midwife_avdotya', 'editor_sofia', 'panaev_1848', 'panaeva_1848'], choices: [
    choice('V47_A03_HOST_READING', ['midwife_avdotya', 'editor_sofia', 'panaev_1848', 'panaeva_1848'], '작업이 끝난 뒤 함께 읽는다', '인쇄지 한 부를 작업자들과 돌려 본다. 작품 이야기는 편집실 밖으로도 전해질 수 있다.', { inventory: [{ fromHostId: 'editor_sofia', toHostId: 'midwife_avdotya', itemKo: '「탈니코프 가족」 인쇄지', quantity: 1 }], moves: [{ hostId: 'editor_sofia', mapId: 'printshop', x: 208, y: 160 }], relationships: [{ fromHostId: 'midwife_avdotya', toHostId: 'editor_sofia', trustDelta: 1 }], rumor: { id: 'V47_TALNIKOV_READING', fromHostId: 'print_apprentice_stepan', hostIds: ['reader_darya', 'bookseller_lev'] }, flags: { V47_A03_SHARED_READING: true } }, { requiredKnowledgeId: 'V47-PANAEVA-TALNIKOV-CH1-1848', subcopyKo: '함께 읽은 작업자와 소문을 들은 서점이 알게 됩니다.' }),
    choice('V47_A03_PRIVATE_COPY', ['midwife_avdotya', 'editor_sofia', 'panaev_1848', 'panaeva_1848'], '원고를 편집실에 돌려놓는다', '원고를 안쪽 작업대에 두고 스테판에게 품삯을 건넨다. 작품 이야기는 편집실 안에 남는다.', { money: [{ fromHostId: 'editor_sofia', toHostId: 'print_apprentice_stepan', amount: 1 }], inventory: [{ fromHostId: 'midwife_avdotya', toHostId: 'editor_sofia', itemKo: '교정용 원고 묶음', quantity: 1 }], moves: [{ hostId: 'midwife_avdotya', mapId: 'printshop', x: 176, y: 144 }], relationships: [{ fromHostId: 'midwife_avdotya', toHostId: 'editor_sofia', trustDelta: 1 }], rumor: { id: 'V47_MANUSCRIPT_STAYS_PRIVATE', fromHostId: 'editor_sofia', hostIds: ['printer_ekaterina'] }, flags: { V47_A03_MANUSCRIPT_SECURED: true } }, { requiredKnowledgeId: 'V47-PANAEVA-TALNIKOV-CH1-1848', subcopyKo: '원고와 품삯은 편집실 안에서 처리합니다. 밖으로 전하지 않습니다.' }),
    choice('V47_A03_PANAEV_CATALOGUE_NOTE', ['panaev_1848'], '알렉세이를 작업자들의 독서에 부른다', '작업자들과 서기가 같은 작업대에 둘러앉아 첫 장을 읽는다.', { inventory: [{ fromHostId: 'panaev_1848', toHostId: 'clerk_alexei', itemKo: '인쇄소 독서 모임 초대', quantity: 1 }], relationships: [{ fromHostId: 'panaev_1848', toHostId: 'clerk_alexei', trustDelta: 1 }], rumor: { id: 'V47_PANAEV_CATALOGUE_SHARED', fromHostId: 'panaev_1848', hostIds: ['clerk_alexei'] }, flags: { V47_A03_PANAEV_RECORD_KEPT: true } }, { requiredKnowledgeId: 'V47-PANAEVA-TALNIKOV-CH1-1848', subcopyKo: '함께 읽는 자리에서 알렉세이와 작업자들이 서로의 말을 듣습니다.' }),
    choice('V47_A03_PANAEVA_READING_NOTE', ['panaeva_1848'], '아브도티야에게 첫 장을 건넨다', '아브도티야가 교정쇄를 받아 다른 일터에서도 돌려 읽을 수 있게 된다.', { inventory: [{ fromHostId: 'panaeva_1848', toHostId: 'midwife_avdotya', itemKo: '「탈니코프 가족」 첫 장 교정쇄', quantity: 1 }], relationships: [{ fromHostId: 'panaeva_1848', toHostId: 'midwife_avdotya', trustDelta: 1 }], rumor: { id: 'V47_PANAEVA_READING_NOTE', fromHostId: 'midwife_avdotya', hostIds: ['reader_darya'] }, flags: { V47_A03_PANAEVA_READING_RECORDED: true } }, { requiredKnowledgeId: 'V47-PANAEVA-TALNIKOV-CH1-1848', subcopyKo: '교정쇄는 인쇄소 밖으로 나갑니다.' }),
  ]}),
  beat({ storyId: 'MAIN01', beatId: 'A04', date: '1848-07-10', titleKo: '활자함을 닫는 사람', objectiveKo: '스테판의 품삯과 인쇄를 이어갈 비용을 두고 예카테리나와 결정한다', mapId: 'printshop', objectId: 9063, sourceContextKo: '연감을 찍고도 밀린 품삯이 남았다. 다음 인쇄 일감도 지연되자 작업자들이 기계를 세운다.', hosts: ['print_apprentice_stepan', 'printer_ekaterina'], choices: [
    choice('V47_A04_PAY_WAGES', ['print_apprentice_stepan', 'printer_ekaterina'], '작업자 품삯부터 치른다', '작업자에게 돈을 지급한다. 종이 주문은 줄이고 남은 인쇄량을 다시 계산한다.', { money: [{ fromHostId: 'printer_ekaterina', toHostId: 'print_apprentice_stepan', amount: 3 }], inventory: [{ fromHostId: 'printer_ekaterina', toHostId: 'print_apprentice_stepan', itemKo: '작업 시간표', quantity: 1 }], moves: [{ hostId: 'print_apprentice_stepan', mapId: 'printshop', x: 192, y: 176 }], relationships: [{ fromHostId: 'print_apprentice_stepan', toHostId: 'printer_ekaterina', trustDelta: 2 }], rumor: { id: 'V47_WAGES_PAID', fromHostId: 'print_apprentice_stepan', hostIds: ['seamstress_anna'] }, flags: { V47_A04_WAGES_PAID: true } }),
    choice('V47_A04_DELAY_WAGES', ['print_apprentice_stepan', 'printer_ekaterina'], '종이 대금부터 막는다', '작업은 이어지지만 스테판은 다른 일자리를 알아보러 네프스키 거리로 나간다.', { money: [{ fromHostId: 'printer_ekaterina', toHostId: 'bookseller_lev', amount: 2 }], inventory: [{ fromHostId: 'bookseller_lev', toHostId: 'printer_ekaterina', itemKo: '종이 주문증', quantity: 1 }], moves: [{ hostId: 'print_apprentice_stepan', mapId: 'nevsky', x: 96, y: 144 }], relationships: [{ fromHostId: 'print_apprentice_stepan', toHostId: 'printer_ekaterina', trustDelta: -1 }], rumor: { id: 'V47_WAGE_DELAY', fromHostId: 'print_apprentice_stepan', hostIds: ['seamstress_anna', 'bookseller_lev'] }, flags: { V47_A04_WAGES_DELAYED: true } }),
  ]}),
  beat({ storyId: 'MAIN01', beatId: 'A05', date: '1848-09-06', titleKo: '크릴로프가 겁낸 독자', objectiveKo: '파나예프의 재심 요청과 크릴로프의 심사 의견을 읽고 콘스탄틴과 맞선다', mapId: 'chancery', objectId: 9064, sourceIds: ['V47-PANAEV-LETTER-1848-08-20', 'V47-KRYLOV-ASSESSMENT-1848-09-06'], sourceContextKo: '상트페테르부르크 검열위원장 무신푸시킨이 알렉산드르 루키치 크릴로프 검열관에게 재심을 맡겼다. 크릴로프는 작품이 한 권에 묶인 방식까지 문제 삼았다.', hosts: ['clerk_alexei', 'senior_clerk_konstantin'], choices: [
    choice('V47_A05_COPY_LEDGER', ['clerk_alexei', 'senior_clerk_konstantin'], '「탈니코프 가족」을 빼고 다시 청한다', '콘스탄틴이 「탈니코프 가족」을 덮고 달의 「신부를 보러 가다」를 따로 내보내 달라는 청을 위원장실로 가져간다. 인쇄소에서는 한 권으로 묶은 연감을 내보낼 길이 더 좁아졌음을 안다.', { money: [{ fromHostId: 'clerk_alexei', toHostId: 'scribal_yuri', amount: 1 }], inventory: [{ fromHostId: 'clerk_alexei', toHostId: 'senior_clerk_konstantin', itemKo: '분리 심사 제안', quantity: 1 }], moves: [{ hostId: 'clerk_alexei', mapId: 'chancery', x: 160, y: 144 }], relationships: [{ fromHostId: 'clerk_alexei', toHostId: 'senior_clerk_konstantin', trustDelta: 1 }], rumor: { id: 'V47_REVIEW_COPY', fromHostId: 'clerk_alexei', hostIds: ['printer_ekaterina'] }, flags: { V47_A05_COPY_MADE: true } }, { requiredKnowledgeIds: ['V47-PANAEV-LETTER-1848-08-20', 'V47-KRYLOV-ASSESSMENT-1848-09-06'] }),
    choice('V47_A05_ASK_OFFICE', ['clerk_alexei', 'senior_clerk_konstantin'], '위원장에게 이의를 전한다', '알렉세이는 집안의 폭력을 읽을 수 있어야 한다고 주장한다. 위원회의 판단은 달라지지 않지만 인쇄소는 그가 반대했다는 사실을 안다.', { money: [{ fromHostId: 'clerk_alexei', toHostId: 'scribal_yuri', amount: 1 }], inventory: [{ fromHostId: 'senior_clerk_konstantin', toHostId: 'clerk_alexei', itemKo: '위원장실 면담 통지', quantity: 1 }], moves: [{ hostId: 'senior_clerk_konstantin', mapId: 'chancery', x: 192, y: 160 }], relationships: [{ fromHostId: 'clerk_alexei', toHostId: 'senior_clerk_konstantin', trustDelta: 1 }], rumor: { id: 'V47_REVIEW_DELAY', fromHostId: 'clerk_alexei', hostIds: ['printer_ekaterina', 'bookseller_lev'] }, flags: { V47_A05_ORAL_INQUIRY: true } }, { requiredKnowledgeIds: ['V47-PANAEV-LETTER-1848-08-20', 'V47-KRYLOV-ASSESSMENT-1848-09-06'] }),
    choice('V47_A05_WITHHOLD_SIGNATURE', ['clerk_alexei', 'senior_clerk_konstantin'], '심사 업무에서 물러난다', '알렉세이는 심사에서 손을 뗀다. 콘스탄틴은 그가 끝까지 곁에 서지 않았음을 기억한다.', { inventory: [{ fromHostId: 'clerk_alexei', toHostId: 'senior_clerk_konstantin', itemKo: '업무에서 물러나는 청원', quantity: 1 }], relationships: [{ fromHostId: 'clerk_alexei', toHostId: 'senior_clerk_konstantin', trustDelta: -1 }], rumor: { id: 'V47_REVIEW_SIGNATURE_WITHHELD', fromHostId: 'senior_clerk_konstantin', hostIds: ['printer_ekaterina'] }, flags: { V47_A05_SIGNATURE_WITHHELD: true } }, { requiredKnowledgeIds: ['V47-PANAEV-LETTER-1848-08-20', 'V47-KRYLOV-ASSESSMENT-1848-09-06'] }),
  ]}),
  beat({ storyId: 'MAIN01', beatId: 'A07', date: '1848-10-21', titleKo: '하숙집 열쇠', objectiveKo: '안나나 폴리나로 하숙집 열쇠를 살펴보고 밀린 수선값을 받거나 새 일감을 맡는다', mapId: 'communal-room', objectId: 9065, sourceContextKo: '연감이 막히자 서점은 안나에게 외투 수선값을 줄 돈도 아낀다. 안나가 오늘 방세를 못 내면, 다리를 저는 세탁부 마리야도 그 방에서 나와야 한다.', hosts: ['seamstress_anna', 'landlady_polina'], choices: [
    choice('V47_A07_CLAIM_WAGES', ['seamstress_anna', 'landlady_polina'], '서점에 미지급 수선값을 청구한다', '레프가 일부를 먼저 건넨다. 안나는 집주인에게 방세 일부를 낸다.', { money: [{ fromHostId: 'bookseller_lev', toHostId: 'seamstress_anna', amount: 2 }, { fromHostId: 'seamstress_anna', toHostId: 'landlady_polina', amount: 1 }], inventory: [{ fromHostId: 'seamstress_anna', toHostId: 'bookseller_lev', itemKo: '수선 인수표', quantity: 1 }], moves: [{ hostId: 'seamstress_anna', mapId: 'bookshop-interior', x: 112, y: 160 }], relationships: [{ fromHostId: 'seamstress_anna', toHostId: 'bookseller_lev', trustDelta: 1 }], rumor: { id: 'V47_UNPAID_REPAIR', fromHostId: 'seamstress_anna', hostIds: ['print_apprentice_stepan'] }, flags: { V47_A07_WAGES_CLAIMED: true } }),
    choice('V47_A07_FIND_WORK', ['seamstress_anna', 'landlady_polina'], '이웃의 세탁 일을 맡는다', '새 일감으로 당일 품삯을 받지만 안나는 하숙집을 비운다.', { money: [{ fromHostId: 'laundress_mariya', toHostId: 'seamstress_anna', amount: 2 }], inventory: [{ fromHostId: 'laundress_mariya', toHostId: 'seamstress_anna', itemKo: '세탁물 꾸러미', quantity: 1 }], moves: [{ hostId: 'seamstress_anna', mapId: 'sewing-room', x: 128, y: 160 }], relationships: [{ fromHostId: 'seamstress_anna', toHostId: 'laundress_mariya', trustDelta: 1 }], rumor: { id: 'V47_NEW_SEWING_WORK', fromHostId: 'laundress_mariya', hostIds: ['landlady_polina'] }, flags: { V47_A07_NEW_WORK: true } }),
  ]}),
  beat({ storyId: 'MAIN01', beatId: 'A08', date: '1848-10-25', titleKo: '호각이 울리기 전에', objectiveKo: '책방 골목에서 젖은 소포를 돌려받거나 파벨로 수레를 쫓는다', mapId: 'bookshop-lane', objectId: 9066, sourceContextKo: '봉인된 연감이 제때 오지 않았다. 골목을 도는 짐수레가 마지막 단서다.', hosts: ['courier_pavel', 'bookseller_lev'], choices: [
    choice('V47_A08_RETURN_PACKAGE', ['courier_pavel', 'bookseller_lev'], '봉인된 소포를 서점으로 돌린다', '레프가 소포를 자기 가게 안으로 들이고 파벨에게 돌아오는 데 든 운임을 준다.', { money: [{ fromHostId: 'bookseller_lev', toHostId: 'courier_pavel', amount: 1 }], inventory: [{ fromHostId: 'courier_pavel', toHostId: 'bookseller_lev', itemKo: '반송된 소포', quantity: 1 }], moves: [{ hostId: 'courier_pavel', mapId: 'bookshop-interior', x: 144, y: 176 }], relationships: [{ fromHostId: 'courier_pavel', toHostId: 'bookseller_lev', trustDelta: 1 }], rumor: { id: 'V47_RETURNED_PACKAGE', fromHostId: 'courier_pavel', hostIds: ['reader_darya'] }, flags: { V47_A08_PACKAGE_RETURNED: true } }),
    choice('V47_A08_VERIFY_ROUTE', ['courier_pavel', 'bookseller_lev'], '파벨을 큰길로 먼저 보낸다', '파벨은 소포를 먼저 큰길 쪽으로 가져간다. 레프가 뒤에 남아 골목 사람들을 물린다.', { money: [{ fromHostId: 'bookseller_lev', toHostId: 'courier_pavel', amount: 2 }], inventory: [{ fromHostId: 'courier_pavel', toHostId: 'bookseller_lev', itemKo: '운송표', quantity: 1 }], moves: [{ hostId: 'courier_pavel', mapId: 'nevsky', x: 144, y: 160 }], relationships: [{ fromHostId: 'courier_pavel', toHostId: 'bookseller_lev', trustDelta: 1 }], rumor: { id: 'V47_ROUTE_CHECKED', fromHostId: 'courier_pavel', hostIds: ['police_sergeant_ivan'] }, flags: { V47_A08_ROUTE_CHECKED: true } }),
  ]}),
  beat({ storyId: 'MAIN01', beatId: 'A10', date: '1848-11-24', titleKo: '현관의 마차', objectiveKo: '소피야의 집에서 마르파와 마부의 말을 듣고 마차를 어디에 보낼지 정한다', mapId: 'sofiya-salon', objectId: 9067, sourceContextKo: '바실리가 금지된 연감 한 권을 빼내려고 마차를 불렀다. 바로 그때 수레에 깔린 마르파가 소피야의 집으로 실려 온다.', hosts: ['sofiya_salon_1848', 'reader_darya', 'editor_sofia'], choices: [

    // Legacy action IDs also identify the branch in saves made before this scene was rewritten.
    choice('V47_A10_HOST_READING', ['sofiya_salon_1848', 'reader_darya', 'editor_sofia'],
      '마르파를 병원으로 보낸다', '마르파가 마부에게 직접 태워 달라고 한다. 알렉세이가 내일 마부와 함께 주인 앞에 서겠다고 하고, 다리야가 마르파를 데리고 마리인스카야 병원으로 떠난다. 연감은 방에 남는다.', {
        inventory: [{ fromHostId: 'sofiya_salon_1848', toHostId: 'reader_darya', itemKo: '부상자에게 덮어 줄 숄', quantity: 1 }],
        moves: [{ hostId: 'midwife_avdotya', mapId: 'inn-interior', x: 160, y: 160 }],
        relationships: [{ fromHostId: 'reader_darya', toHostId: 'clerk_alexei', trustDelta: 4 },
          { fromHostId: 'student_vasily', toHostId: 'reader_darya', trustDelta: -2 }],
        rumor: { id: 'V47_SALON_CARRIAGE_FOR_INJURED', fromHostId: 'reader_darya', hostIds: ['print_apprentice_stepan', 'police_sergeant_ivan'] },
        flags: { V47_A10_READING_HELD: true, V47_A10_INJURED_RIDES: true },
      }),
    choice('V47_A10_STORE_COPY', ['sofiya_salon_1848', 'reader_darya', 'editor_sofia'],
      '연감을 먼저 내보낸다', '바실리가 연감을 들고 오른다. 다리야는 마르파 곁에 남는다. 이리나는 스테판이 가져온 산파의 겨울 외투를 맡고, 로만에게 두 번째 마차의 삯을 건넨다.', {
        money: [{ fromHostId: 'innkeeper_irina', toHostId: 'carter_roman', amount: 1 }],
        inventory: [{ fromHostId: 'sofiya_salon_1848', toHostId: 'student_vasily', itemKo: '보관 중인 연감 한 권', quantity: 1 },
          { fromHostId: 'midwife_avdotya', toHostId: 'innkeeper_irina', itemKo: '마차 삯에 맡긴 산파의 겨울 외투', quantity: 1 }],
        moves: [{ hostId: 'student_vasily', mapId: 'bookshop-lane', x: 112, y: 144 }, { hostId: 'print_apprentice_stepan', mapId: 'nevsky', x: 144, y: 160 }],
        relationships: [{ fromHostId: 'reader_darya', toHostId: 'sofiya_salon_1848', trustDelta: -3 },
          { fromHostId: 'student_vasily', toHostId: 'sofiya_salon_1848', trustDelta: 2 }],
        rumor: { id: 'V47_SALON_CARRIAGE_FOR_ALMANAC', fromHostId: 'midwife_avdotya', hostIds: ['print_apprentice_stepan'] },
        flags: { V47_A10_COPY_STORED: true, V47_A10_BOOK_RIDES: true },
      }),
  ]}),
  beat({ storyId: 'MAIN01', beatId: 'A11', date: '1848-11-30', titleKo: '마차가 떠난 뒤', prerequisiteQuestIds: ['V47_MAIN01_A10'], objectiveKo: '인쇄소에서 구독자 편지를 읽고, 무너진 작업장을 어떻게 수습할지 정한다', mapId: 'printshop', objectId: 9068, sourceIds: ['V47-NEKRASOV-SUBSCRIBER-LETTER-1848'], sourceContextKo: '《동시대인》 편집부의 편지가 도착했지만 연감은 나오지 않았다. 인쇄소는 다시 문을 열어야 한다.', hosts: ['nekrasov_reconstruction', 'printer_ekaterina', 'bookseller_lev', 'clerk_alexei'], choices: [
    choice('V47_A11_SETTLE_WORKERS', ['nekrasov_reconstruction', 'editor_sofia', 'printer_ekaterina', 'bookseller_lev'], '한 부를 감추고 작업자 품삯을 준다', '편집부는 위험을 감수해 인쇄본 한 부를 따로 보관하고, 남은 돈으로 스테판의 품삯을 먼저 정산한다. 환불을 기다리는 손님은 더 기다려야 한다.', { money: [{ fromHostId: 'editor_sofia', toHostId: 'printer_ekaterina', amount: 2 }, { fromHostId: 'printer_ekaterina', toHostId: 'print_apprentice_stepan', amount: 2 }], inventory: [{ fromHostId: 'printer_ekaterina', toHostId: 'editor_sofia', itemKo: '인쇄소에 나눌 품삯 봉투', quantity: 1 }, { fromHostId: 'printer_ekaterina', toHostId: 'editor_sofia', itemKo: '비공개 보관 연감 한 부', quantity: 1 }], moves: [{ hostId: 'print_apprentice_stepan', mapId: 'printshop', x: 208, y: 176 }], relationships: [{ fromHostId: 'printer_ekaterina', toHostId: 'editor_sofia', trustDelta: 1 }], rumor: { id: 'V47_FINAL_WAGE_SETTLEMENT', fromHostId: 'print_apprentice_stepan', hostIds: ['seamstress_anna'] }, flags: { V47_A11_WORKERS_SETTLED: true, V47_A11_PRIVATE_COPY_KEPT: true } }, { requiredKnowledgeId: 'V47-NEKRASOV-SUBSCRIBER-LETTER-1848' }),
    choice('V47_A11_SETTLE_SUBSCRIBERS', ['nekrasov_reconstruction', 'editor_sofia', 'printer_ekaterina', 'bookseller_lev'], '독자들과 직접 만난다', '레프가 서점 문을 연다. 남은 돈은 연감을 기다리던 독자들을 만나는 데 쓰인다.', { money: [{ fromHostId: 'editor_sofia', toHostId: 'bookseller_lev', amount: 2 }], inventory: [{ fromHostId: 'editor_sofia', toHostId: 'bookseller_lev', itemKo: '독자에게 보내는 서점 초대', quantity: 1 }], moves: [{ hostId: 'bookseller_lev', mapId: 'bookshop-interior', x: 112, y: 176 }, { hostId: 'print_apprentice_stepan', mapId: 'bookshop-lane', x: 80, y: 144 }], relationships: [{ fromHostId: 'bookseller_lev', toHostId: 'editor_sofia', trustDelta: 1 }, { fromHostId: 'print_apprentice_stepan', toHostId: 'printer_ekaterina', trustDelta: -1 }], rumor: { id: 'V47_SUBSCRIBER_LEDGER', fromHostId: 'bookseller_lev', hostIds: ['reader_darya', 'seamstress_anna'] }, flags: { V47_A11_SUBSCRIBERS_PRIORITIZED: true } }, { requiredKnowledgeId: 'V47-NEKRASOV-SUBSCRIBER-LETTER-1848' }),
    choice('V47_A11_FIND_REPLACEMENT_WORK', ['nekrasov_reconstruction', 'editor_sofia', 'printer_ekaterina', 'bookseller_lev', 'print_apprentice_stepan'], '급료를 잇도록 새 인쇄 일을 구한다', '레프가 다른 인쇄소에 보낼 소개장을 써 준다. 스테판은 새 일을 찾아 나서고 당장 받을 품삯은 줄어든다.', { inventory: [{ fromHostId: 'bookseller_lev', toHostId: 'print_apprentice_stepan', itemKo: '인쇄 일자리 소개장', quantity: 1 }], moves: [{ hostId: 'print_apprentice_stepan', mapId: 'bookshop-lane', x: 80, y: 144 }], relationships: [{ fromHostId: 'bookseller_lev', toHostId: 'print_apprentice_stepan', trustDelta: 1 }, { fromHostId: 'print_apprentice_stepan', toHostId: 'printer_ekaterina', trustDelta: 1 }], rumor: { id: 'V47_APPRENTICE_SEEKS_WORK', fromHostId: 'print_apprentice_stepan', hostIds: ['seamstress_anna'] }, flags: { V47_A11_REPLACEMENT_WORK_FOUND: true } }, { requiredKnowledgeId: 'V47-NEKRASOV-SUBSCRIBER-LETTER-1848' }),
    choice('V47_A11_PUBLIC_DISPOSAL_LIST', ['clerk_alexei', 'printer_ekaterina', 'bookseller_lev'], '작업장에 남은 책을 내준다', '알렉세이가 이 작업장에 남은 책을 내준다. 예카테리나와 레프는 다시 책을 내겠다는 약속을 거둔다.', { inventory: [{ fromHostId: 'clerk_alexei', toHostId: 'bookseller_lev', itemKo: '인쇄소에 남은 연감 묶음', quantity: 1 }], relationships: [{ fromHostId: 'bookseller_lev', toHostId: 'clerk_alexei', trustDelta: -1 }, { fromHostId: 'printer_ekaterina', toHostId: 'clerk_alexei', trustDelta: -1 }], rumor: { id: 'V47_PUBLIC_ALMANAC_DISPOSAL_LIST', fromHostId: 'clerk_alexei', hostIds: ['seamstress_anna', 'print_apprentice_stepan'] }, flags: { V47_A11_PUBLIC_DISPOSAL_LIST: true } }, { requiredKnowledgeId: 'V47-NEKRASOV-SUBSCRIBER-LETTER-1848' }),
  ]}),

  // MAIN03 — European news, the Petrashevsky circle, and the April arrests.
  beat({ storyId: 'MAIN03', beatId: 'P01', date: '1848-04-15', titleKo: '살롱 첫 방문', objectiveKo: '방문객과 인사를 나누고 어떤 책을 펼칠지 정한다', mapId: 'inn-interior', objectId: 9069, sourceIds: ['OBJ-NICHOLAS-MANIFESTO-1848'], sourceContextKo: '3월 선언문은 프랑스에서 시작한 변화를 ‘반란과 무정부 상태’라고 부르고 러시아에 대한 위협으로 제시한다. 참석자들은 그 표현과 자신들의 처지를 두고 이야기한다.', hosts: ['editor_sofia', 'student_vasily', 'minor_noble_andrei'], choices: [
    choice('V47_P01_OPEN_DISCUSSION', ['editor_sofia', 'student_vasily', 'minor_noble_andrei', 'petrashevsky_1849'], '선언문에 적힌 ‘무질서’라는 말을 다시 읽는다', '황실이 프랑스의 일을 어떤 말로 묘사했는지 함께 읽는다. 참석자들이 자리를 옮겨 토론에 합류하고, 그 문장을 들은 사람도 늘어난다.', { money: [{ fromHostId: 'editor_sofia', toHostId: 'innkeeper_irina', amount: 2 }], inventory: [{ fromHostId: 'bookseller_lev', toHostId: 'student_vasily', itemKo: '선언문 발췌 메모', quantity: 1 }], moves: [{ hostId: 'student_vasily', mapId: 'inn-interior', x: 160, y: 144 }, { hostId: 'minor_noble_andrei', mapId: 'inn-interior', x: 192, y: 144 }], relationships: [{ fromHostId: 'student_vasily', toHostId: 'editor_sofia', trustDelta: 1 }], rumor: { id: 'V47_SALON_NEWS_DISCUSSION', fromHostId: 'student_vasily', hostIds: ['printer_ekaterina', 'clerk_alexei'] }, flags: { V47_P01_PUBLIC_DISCUSSION: true } }, { requiredKnowledgeId: 'OBJ-NICHOLAS-MANIFESTO-1848' }),
    choice('V47_P01_KEEP_TO_SMALL_TABLE', ['editor_sofia', 'student_vasily', 'minor_noble_andrei', 'petrashevsky_1849'], '그 소식이 농노의 삶에 무엇을 바꿀지 묻는다', '작은 탁자에서 농노의 처지와 땅 문제를 놓고 이야기한다. 참석자는 적지만 안드레이는 자기 집안의 이해관계를 숨기기 어렵다.', { money: [{ fromHostId: 'student_vasily', toHostId: 'innkeeper_irina', amount: 1 }], inventory: [{ fromHostId: 'student_vasily', toHostId: 'editor_sofia', itemKo: '농노와 토지에 관한 메모', quantity: 1 }], moves: [{ hostId: 'editor_sofia', mapId: 'inn-interior', x: 112, y: 160 }], relationships: [{ fromHostId: 'editor_sofia', toHostId: 'student_vasily', trustDelta: 1 }], rumor: { id: 'V47_PRIVATE_NEWS_TALK', fromHostId: 'editor_sofia', hostIds: ['minor_noble_andrei'] }, flags: { V47_P01_PRIVATE_TABLE: true } }, { requiredKnowledgeId: 'OBJ-NICHOLAS-MANIFESTO-1848' }),
    choice('V47_P01_READ_NEWS_FIRST', ['editor_sofia', 'student_vasily', 'minor_noble_andrei'], '이 말을 어디까지 해도 되는지 묻는다', '소피야는 집 안에서 나눈 말과 문밖에서 되풀이될 말이 같지 않을 수 있다고 답한다. 참석자들의 경계심과 서로에 대한 신뢰가 함께 달라진다.', { inventory: [{ fromHostId: 'student_vasily', toHostId: 'editor_sofia', itemKo: '살롱에서 나눈 말의 메모', quantity: 1 }], moves: [{ hostId: 'student_vasily', mapId: 'inn-interior', x: 128, y: 160 }], relationships: [{ fromHostId: 'student_vasily', toHostId: 'minor_noble_andrei', trustDelta: 1 }], rumor: { id: 'V47_SALON_NEWS_READ_FIRST', fromHostId: 'editor_sofia', hostIds: ['student_vasily', 'minor_noble_andrei'] }, flags: { V47_P01_NEWS_READ_FIRST: true } }, { requiredKnowledgeId: 'OBJ-NICHOLAS-MANIFESTO-1848' }),
  ]}),
  beat({ storyId: 'MAIN03', beatId: 'P02', date: '1848-05-02', titleKo: '푸리에의 이름이 나온 사전', objectiveKo: '사전의 새 사회 개혁 항목을 읽고 생계에 닿는 질문을 나눈다', mapId: 'bookshop-interior', objectId: 9070, sourceIds: ['V47-PETRASHESKY-FOURIER-NOVATORSTVO-1846'], sourceContextKo: '사전은 오언·생시몽·푸리에의 체계를 사회생활을 바꾸려는 새로운 시도의 사례로 든다. 레프와 류보프는 그 말이 월세와 하루 일에 어떤 뜻인지 묻는다.', hosts: ['student_vasily', 'bookseller_lev', 'teacher_lyubov'], choices: [
    choice('V47_P02_LEND_BOOK', ['student_vasily', 'bookseller_lev', 'teacher_lyubov'], '책을 빌려 수업에 가져간다', '레프가 책을 외상으로 내준다. 바실리는 수업 뒤 돌려주기로 약속한다.', { money: [{ fromHostId: 'student_vasily', toHostId: 'bookseller_lev', amount: 1 }], inventory: [{ fromHostId: 'bookseller_lev', toHostId: 'student_vasily', itemKo: '외래어 소사전', quantity: 1 }], moves: [{ hostId: 'student_vasily', mapId: 'communal-room', x: 112, y: 144 }], relationships: [{ fromHostId: 'student_vasily', toHostId: 'bookseller_lev', trustDelta: 1 }], rumor: { id: 'V47_DICTIONARY_CIRCULATES', fromHostId: 'student_vasily', hostIds: ['teacher_lyubov', 'editor_sofia'] }, flags: { V47_P02_BOOK_LENT: true } }, { requiredKnowledgeId: 'V47-PETRASHESKY-FOURIER-NOVATORSTVO-1846' }),
    choice('V47_P02_COPY_NOTES', ['student_vasily', 'bookseller_lev', 'teacher_lyubov'], '그 대목을 베껴 적는다', '책은 서점에 남고 바실리는 필사에 시간을 쓴다. 교사는 글을 수업 자료로 살펴보기로 한다.', { money: [{ fromHostId: 'teacher_lyubov', toHostId: 'student_vasily', amount: 1 }], inventory: [{ fromHostId: 'student_vasily', toHostId: 'teacher_lyubov', itemKo: '사전 필사 쪽지', quantity: 1 }], moves: [{ hostId: 'teacher_lyubov', mapId: 'communal-room', x: 144, y: 144 }], relationships: [{ fromHostId: 'teacher_lyubov', toHostId: 'student_vasily', trustDelta: 1 }], rumor: { id: 'V47_DICTIONARY_NOTES', fromHostId: 'teacher_lyubov', hostIds: ['clerk_alexei'] }, flags: { V47_P02_NOTES_COPIED: true } }, { requiredKnowledgeId: 'V47-PETRASHESKY-FOURIER-NOVATORSTVO-1846' }),
  ]}),
  beat({ storyId: 'MAIN03', beatId: 'P03', date: '1848-09-20', titleKo: '자유를 말하는 사람, 경고하는 사람', objectiveKo: '서로 다른 문서를 읽고 농노제·신앙·언론을 둘러싼 입장을 듣는다', mapId: 'inn-interior', objectId: 9071, sourceIds: [sources.manifesto1848, sources.fourierDictionary, 'LIT-TURGENEV-KHOR-KALYNYCH-1847', sources.almanacReview], sourceContextKo: '니콜라이 1세의 선언문은 서유럽의 변화를 반란과 무정부 상태로 규정하고, 페트라솁스키의 사전은 사회를 바꾸려는 시도와 그에 대한 저항을 설명합니다. 투르게네프의 소설은 농노 두 사람을 다르게 그리지만 실제 증언은 아닙니다. 크릴로프의 9월 심사 의견은 작품을 연감으로 묶어 낸 효과를 따집니다. 네 문서는 서로 다른 목소리이며, 살롱에서 오간 말은 창작입니다.', hosts: ['printer_ekaterina', 'minor_noble_andrei', 'student_vasily'], choices: [
    choice('V47_P03_FOURIER_AND_LIVELIHOOD', ['printer_ekaterina', 'minor_noble_andrei', 'student_vasily'], '공동 노동과 생계를 따져 묻는다', '참석자들은 식사와 집세를 누가 부담할지 적어 본다. 약속만으로 비용이 사라지지 않는다는 점이 남았다.', { inventory: [{ fromHostId: 'printer_ekaterina', toHostId: 'student_vasily', itemKo: '공동 지출 메모', quantity: 1 }], relationships: [{ fromHostId: 'printer_ekaterina', toHostId: 'minor_noble_andrei', trustDelta: 1 }], rumor: { id: 'V47_DEBATE_LIVELIHOOD', fromHostId: 'student_vasily', hostIds: ['editor_sofia', 'teacher_lyubov'] }, flags: { V47_P03_TOPIC_LIVELIHOOD: true } }, { requiredKnowledgeId: sources.fourierDictionary }),
    choice('V47_P03_SERFDOM_AND_LAND', ['printer_ekaterina', 'minor_noble_andrei', 'student_vasily'], '농노의 노동과 토지를 묻는다', '누가 땅을 소유하고 누가 그 땅에서 일하는지 구체적 사례를 놓고 말한다. 안드레이는 자기 집안의 부담을 숨기지 않는다. 투르게네프의 두 인물은 문학적 묘사이지 현장 증언은 아니다.', { inventory: [{ fromHostId: 'minor_noble_andrei', toHostId: 'student_vasily', itemKo: '토지와 소작에 관한 쪽지', quantity: 1 }], relationships: [{ fromHostId: 'student_vasily', toHostId: 'minor_noble_andrei', trustDelta: 1 }], rumor: { id: 'V47_DEBATE_SERFDOM', fromHostId: 'printer_ekaterina', hostIds: ['teacher_lyubov', 'police_sergeant_ivan'] }, flags: { V47_P03_TOPIC_SERFDOM: true } }, { requiredKnowledgeId: 'LIT-TURGENEV-KHOR-KALYNYCH-1847' }),
    choice('V47_P03_FAITH_AND_FREEDOM', ['printer_ekaterina', 'minor_noble_andrei', 'student_vasily'], '신앙과 자유의 경계를 묻는다', '선언문이 러시아를 하느님께서 맡기신 땅으로 부르는 대목을 두고 각자의 믿음과 양심을 말한다. 이 편지는 아직 도착하지 않았으므로 벨린스키의 견해를 인물들이 안다고 가정하지 않는다.', { inventory: [{ fromHostId: 'student_vasily', toHostId: 'editor_sofia', itemKo: '신앙과 양심에 관한 메모', quantity: 1 }], relationships: [{ fromHostId: 'student_vasily', toHostId: 'printer_ekaterina', trustDelta: 1 }], rumor: { id: 'V47_DEBATE_FAITH', fromHostId: 'editor_sofia', hostIds: ['teacher_lyubov'] }, flags: { V47_P03_TOPIC_FAITH: true } }, { requiredKnowledgeId: sources.manifesto1848 }),
    choice('V47_P03_PRESS_AND_ORDER', ['printer_ekaterina', 'minor_noble_andrei', 'student_vasily'], '언론과 국가 질서를 묻는다', '선언문의 유럽 정세 설명과 크릴로프의 연감 심사를 나란히 놓고, 질서와 출판의 책임을 따진다. 문서에 적히지 않은 살롱 참석자들의 말은 창작이다.', { inventory: [{ fromHostId: 'student_vasily', toHostId: 'clerk_alexei', itemKo: '신문 논의 메모', quantity: 1 }], relationships: [{ fromHostId: 'student_vasily', toHostId: 'minor_noble_andrei', trustDelta: -1 }], rumor: { id: 'V47_DEBATE_PRESS', fromHostId: 'student_vasily', hostIds: ['police_sergeant_ivan', 'bookseller_lev'] }, flags: { V47_P03_TOPIC_PRESS: true } }, { requiredKnowledgeIds: [sources.manifesto1848, sources.almanacReview] }),
    choice('V47_P03_INVITE_WORKERS', ['printer_ekaterina', 'minor_noble_andrei', 'student_vasily'], '작업자와 학생도 토론에 부른다', '참석자가 늘어 식사비가 오르고 다양한 경험이 대화에 들어온다.', { money: [{ fromHostId: 'editor_sofia', toHostId: 'innkeeper_irina', amount: 2 }], inventory: [{ fromHostId: 'printer_ekaterina', toHostId: 'student_vasily', itemKo: '토론 메모', quantity: 1 }], moves: [{ hostId: 'printer_ekaterina', mapId: 'inn-interior', x: 176, y: 160 }, { hostId: 'student_vasily', mapId: 'inn-interior', x: 144, y: 176 }], relationships: [{ fromHostId: 'printer_ekaterina', toHostId: 'student_vasily', trustDelta: 1 }], rumor: { id: 'V47_OPEN_SOCIAL_DEBATE', fromHostId: 'student_vasily', hostIds: ['clerk_alexei', 'police_sergeant_ivan'] }, flags: { V47_P03_WIDER_DISCUSSION: true } }, { requiredKnowledgeId: sources.manifesto1848 }),
    choice('V47_KEEP_GUEST_LIST', ['printer_ekaterina', 'minor_noble_andrei', 'student_vasily'], '초대된 사람끼리만 계속한다', '방문객 수와 비용은 줄지만 노동자의 경험은 토론에서 빠진다.', { money: [{ fromHostId: 'minor_noble_andrei', toHostId: 'innkeeper_irina', amount: 1 }], inventory: [{ fromHostId: 'minor_noble_andrei', toHostId: 'editor_sofia', itemKo: '초대장 명단', quantity: 1 }], moves: [{ hostId: 'minor_noble_andrei', mapId: 'inn-interior', x: 208, y: 176 }], relationships: [{ fromHostId: 'printer_ekaterina', toHostId: 'minor_noble_andrei', trustDelta: -1 }], rumor: { id: 'V47_CLOSED_SALON', fromHostId: 'editor_sofia', hostIds: ['student_vasily'] }, flags: { V47_P03_CLOSED_GUEST_LIST: true } }, { requiredKnowledgeId: sources.manifesto1848 }),
  ]}),
  beat({ storyId: 'MAIN03', beatId: 'P04', date: '1849-03-20', titleKo: '금요일 초대장', objectiveKo: '책방에서 파벨 또는 엘리자베타로 초대장을 전달할지 정한다', mapId: 'bookshop-interior', objectId: 9072, sourceContextKo: '실제 페트라솁스키 모임의 구성원과 감시 기록은 별도 사료에 한정한다. 이 초대장과 허구 인물의 접근 경로는 창작이다.', hosts: ['courier_pavel', 'bookbinder_elizaveta'], choices: [
    choice('V47_P04_CARRY_INVITATION', ['courier_pavel', 'bookbinder_elizaveta'], '파벨 편에 초대장을 보낸다', '파벨이 초대장을 전달하고 모임 장소를 확인한다. 이동 경로를 아는 사람이 늘어난다.', { inventory: [{ fromHostId: 'bookbinder_elizaveta', toHostId: 'courier_pavel', itemKo: '접힌 초대장', quantity: 1, produceIfAbsent: true }], moves: [{ hostId: 'courier_pavel', mapId: 'communal-room', x: 160, y: 144 }], relationships: [{ fromHostId: 'courier_pavel', toHostId: 'student_vasily', trustDelta: 1 }], rumor: { id: 'V47_INVITATION_ROUTE', fromHostId: 'courier_pavel', hostIds: ['police_sergeant_ivan'] }, flags: { V47_P04_INVITATION_DELIVERED: true } }),
    choice('V47_P04_RETURN_INVITATION', ['courier_pavel', 'bookbinder_elizaveta'], '엘리자베타에게 봉투를 맡긴다', '엘리자베타가 초대장을 보관한다. 파벨은 배달 품삯을 받지 못하지만 모임 경로는 드러나지 않는다.', { inventory: [{ fromHostId: 'courier_pavel', toHostId: 'bookbinder_elizaveta', itemKo: '접힌 초대장', quantity: 1, produceIfAbsent: true }], moves: [{ hostId: 'student_vasily', mapId: 'bookshop-lane', x: 112, y: 144 }], relationships: [{ fromHostId: 'student_vasily', toHostId: 'courier_pavel', trustDelta: -1 }], rumor: { id: 'V47_INVITATION_DECLINED', fromHostId: 'bookbinder_elizaveta', hostIds: ['editor_sofia'] }, flags: { V47_P04_ATTENDANCE_DELAYED: true } }),
  ]}),
  beat({ storyId: 'MAIN03', beatId: 'P05', date: '1849-04-15', titleKo: '벨린스키 편지 낭독', objectiveKo: '편지의 주장과 문학적 평가를 듣고 사본을 어떻게 다룰지 정한다', mapId: 'bookshop-interior', objectId: 9073, sourceIds: [sources.belinskyLetter], sourceContextKo: '벨린스키가 고골에게 보낸 1847년 7월 3일자 편지의 확인된 본문과 필사본 유통 기록을 바탕으로 한다. 이 모임에서의 낭독과 청중 반응은 재구성이다.', hosts: ['student_vasily', 'editor_sofia', 'teacher_lyubov', 'petrashevsky_1849', 'dostoevsky_1849'], choices: [
    choice('V47_P05_SHARE_COPY', ['student_vasily', 'editor_sofia', 'teacher_lyubov', 'petrashevsky_1849', 'dostoevsky_1849'], '필사본을 참석자에게 돌린다', '편지를 함께 읽고 필사 비용을 나눈다. 참석자 사이에서 내용이 더 널리 전해진다.', { money: [{ fromHostId: 'editor_sofia', toHostId: 'bookbinder_elizaveta', amount: 1 }], inventory: [{ fromHostId: 'editor_sofia', toHostId: 'student_vasily', itemKo: '벨린스키 편지 필사본', quantity: 1 }], moves: [{ hostId: 'teacher_lyubov', mapId: 'communal-room', x: 176, y: 144 }], relationships: [{ fromHostId: 'student_vasily', toHostId: 'teacher_lyubov', trustDelta: 1 }], rumor: { id: 'V47_LETTER_COPIED', fromHostId: 'student_vasily', hostIds: ['printer_ekaterina', 'minor_noble_andrei'] }, flags: { V47_P05_LETTER_SHARED: true } }, { requiredKnowledgeId: sources.belinskyLetter }),
    choice('V47_P05_KEEP_COPY', ['student_vasily', 'editor_sofia', 'teacher_lyubov', 'petrashevsky_1849', 'dostoevsky_1849'], '사본을 맡은 사람에게 돌려준다', '편지는 소유자에게 돌아가며 참석자들은 기억에 의지해 논의를 이어간다.', { money: [{ fromHostId: 'teacher_lyubov', toHostId: 'bookbinder_elizaveta', amount: 1 }], inventory: [{ fromHostId: 'student_vasily', toHostId: 'editor_sofia', itemKo: '벨린스키 편지 필사본', quantity: 1 }], moves: [{ hostId: 'editor_sofia', mapId: 'bookshop-interior', x: 144, y: 144 }], relationships: [{ fromHostId: 'editor_sofia', toHostId: 'student_vasily', trustDelta: 1 }], rumor: { id: 'V47_LETTER_RETURNED', fromHostId: 'editor_sofia', hostIds: ['teacher_lyubov'] }, flags: { V47_P05_LETTER_RETURNED: true } }, { requiredKnowledgeId: sources.belinskyLetter }),
    choice('V47_P05_DISCUSS_ARGUMENT', ['student_vasily', 'editor_sofia', 'teacher_lyubov', 'petrashevsky_1849', 'dostoevsky_1849'], '박수 친 사람보다 글의 주장을 따진다', '참석자들은 편지에서 실제로 읽은 대목을 다시 짚고, 누구를 비판하는 문장인지 의견을 나눈다. 필사본은 탁자에 남는다.', { inventory: [{ fromHostId: 'student_vasily', toHostId: 'editor_sofia', itemKo: '편지에 적은 반론 메모', quantity: 1 }], moves: [{ hostId: 'teacher_lyubov', mapId: 'communal-room', x: 160, y: 160 }], relationships: [{ fromHostId: 'student_vasily', toHostId: 'teacher_lyubov', trustDelta: 1 }], rumor: { id: 'V47_LETTER_ARGUMENT_DISCUSSED', fromHostId: 'student_vasily', hostIds: ['editor_sofia', 'teacher_lyubov'] }, flags: { V47_P05_ARGUMENT_DISCUSSED: true } }, { requiredKnowledgeId: sources.belinskyLetter }),
  ]}),
  beat({ storyId: 'MAIN03', beatId: 'P06', date: '1849-04-15', titleKo: '새 방문자의 기억', objectiveKo: '낯선 방문자의 행선과 현장에서 들은 말을 확인한다', mapId: 'nevsky', objectId: 9074, sourceContextKo: '안토넬리와 감시 관련 자료는 별도 사료에서 확인해야 한다. 이 거리의 관찰자와 허구 인물의 만남은 창작이며 실제 정보원의 말로 제시하지 않는다.', hosts: ['courier_pavel', 'police_sergeant_ivan', 'student_vasily', 'antonelli_1849', 'clerk_alexei'], choices: [
    choice('V47_P06_FOLLOW_VISITOR', ['courier_pavel', 'police_sergeant_ivan', 'student_vasily', 'antonelli_1849'], '방문자의 이동을 멀리서 살핀다', '파벨이 인파에 섞여 뒤따른다. 목격 메모를 남기지만 학생은 뒤를 밟힌 사실을 눈치챈다.', { money: [{ fromHostId: 'courier_pavel', toHostId: 'porter_gavrila', amount: 1 }], inventory: [{ fromHostId: 'courier_pavel', toHostId: 'police_sergeant_ivan', itemKo: '거리 관찰 메모', quantity: 1 }], moves: [{ hostId: 'courier_pavel', mapId: 'nevsky', x: 176, y: 128 }, { hostId: 'student_vasily', mapId: 'bookshop-lane', x: 128, y: 160 }], relationships: [{ fromHostId: 'student_vasily', toHostId: 'courier_pavel', trustDelta: -1 }], rumor: { id: 'V47_VISITOR_FOLLOWED', fromHostId: 'courier_pavel', hostIds: ['police_sergeant_ivan'] }, flags: { V47_P06_VISITOR_FOLLOWED: true } }),
    choice('V47_P06_ASK_DIRECTLY', ['courier_pavel', 'police_sergeant_ivan', 'student_vasily', 'antonelli_1849'], '방문자에게 용건을 묻는다', '파벨이 말을 걸어 답을 듣는다. 추적 위험은 줄지만 대화 내용은 주변 사람도 들을 수 있다.', { money: [{ fromHostId: 'police_sergeant_ivan', toHostId: 'courier_pavel', amount: 1 }], inventory: [{ fromHostId: 'courier_pavel', toHostId: 'police_sergeant_ivan', itemKo: '방문 시각 메모', quantity: 1 }], moves: [{ hostId: 'courier_pavel', mapId: 'nevsky', x: 160, y: 144 }], relationships: [{ fromHostId: 'courier_pavel', toHostId: 'student_vasily', trustDelta: 1 }], rumor: { id: 'V47_VISITOR_QUESTIONED', fromHostId: 'courier_pavel', hostIds: ['student_vasily', 'police_sergeant_ivan'] }, flags: { V47_P06_VISITOR_QUESTIONED: true } }),
    choice('V47_P06_LOG_SOURCED_REPORT', ['courier_pavel', 'police_sergeant_ivan', 'student_vasily', 'antonelli_1849'], '들은 말과 제보자를 따로 적는다', '파벨은 직접 들은 말과 익명으로 전해진 내용을 구분해 기록한다. 경찰 서기는 확인 전인 제보에 표시를 남긴다.', { inventory: [{ fromHostId: 'courier_pavel', toHostId: 'police_sergeant_ivan', itemKo: '출처를 적은 비공개 제보', quantity: 1 }], moves: [{ hostId: 'police_sergeant_ivan', mapId: 'police-station', x: 128, y: 96 }], relationships: [{ fromHostId: 'police_sergeant_ivan', toHostId: 'courier_pavel', trustDelta: 1 }], rumor: { id: 'V47_TIP_SOURCE_RECORDED', fromHostId: 'courier_pavel', hostIds: ['police_sergeant_ivan'] }, flags: { V47_P06_SOURCED_TIP_RECORDED: true } }),
    choice('V47_P06_ASSERT_UNVERIFIED_SUSPICION', ['courier_pavel', 'police_sergeant_ivan', 'student_vasily', 'antonelli_1849', 'clerk_alexei'], '확인되지 않은 정황을 확신처럼 적는다', '서기는 추측을 사실로 적은 보고서를 올린다. 바실리에게 의심이 쏠리고, 뒤늦게 바로잡으려면 누가 무엇을 봤는지 다시 찾아야 한다.', { inventory: [{ fromHostId: 'clerk_alexei', toHostId: 'police_sergeant_ivan', itemKo: '확인 전 감시 보고서', quantity: 1 }], relationships: [{ fromHostId: 'clerk_alexei', toHostId: 'student_vasily', trustDelta: -2 }], rumor: { id: 'V47_UNVERIFIED_SUSPICION_REPORTED_AS_FACT', fromHostId: 'police_sergeant_ivan', hostIds: ['student_vasily', 'courier_pavel'] }, flags: { V47_P06_UNVERIFIED_SUSPICION_ASSERTED: true } }),
  ]}),
  beat({ storyId: 'MAIN03', beatId: 'P07', date: '1849-04-22', titleKo: '관청으로 넘어간 자료', objectiveKo: '정보 보고와 체포 관련 서류의 작성 시점을 대조한다', mapId: 'chancery', objectId: 9075, sourceIds: [sources.dostoevskyArrestOrder], sourceContextKo: '4월 22일자 체포 명령서를 읽고, 전달된 보고와 작성 시점을 나란히 확인한다. 관청 서기들의 접수와 대화는 이 사건을 바탕으로 한 장면이다.', hosts: ['clerk_alexei', 'senior_clerk_konstantin', 'scribal_yuri', 'liprandi_1849'], choices: [
    choice('V47_P07_SEPARATE_REPORTS', ['clerk_alexei', 'senior_clerk_konstantin', 'scribal_yuri', 'liprandi_1849'], '보고서와 명령을 따로 묶는다', '접수 날짜와 작성자를 분리해 적는다. 문서가 한꺼번에 전달되며 서기 한 명이 심부름을 맡는다.', { money: [{ fromHostId: 'clerk_alexei', toHostId: 'scribal_yuri', amount: 1 }], inventory: [{ fromHostId: 'clerk_alexei', toHostId: 'senior_clerk_konstantin', itemKo: '분리 정리한 문서철', quantity: 1 }], moves: [{ hostId: 'scribal_yuri', mapId: 'police-station', x: 128, y: 96 }], relationships: [{ fromHostId: 'clerk_alexei', toHostId: 'scribal_yuri', trustDelta: 1 }], rumor: { id: 'V47_SEPARATE_REPORTS', fromHostId: 'scribal_yuri', hostIds: ['police_sergeant_ivan'] }, flags: { V47_P07_RECORDS_SEPARATED: true } }, { requiredKnowledgeId: sources.dostoevskyArrestOrder }),
    choice('V47_P07_COPY_NAMES', ['clerk_alexei', 'senior_clerk_konstantin', 'scribal_yuri', 'liprandi_1849'], '열람한 이름을 개인 메모에 옮긴다', '메모는 서기 개인에게 남는다. 유출되면 허구 인물의 위험이 커진다.', { money: [{ fromHostId: 'clerk_alexei', toHostId: 'scribal_yuri', amount: 1 }], inventory: [{ fromHostId: 'scribal_yuri', toHostId: 'clerk_alexei', itemKo: '이름을 적은 개인 메모', quantity: 1 }], moves: [{ hostId: 'clerk_alexei', mapId: 'chancery', x: 176, y: 144 }], relationships: [{ fromHostId: 'clerk_alexei', toHostId: 'senior_clerk_konstantin', trustDelta: -1 }], rumor: { id: 'V47_PRIVATE_NAMES_NOTE', fromHostId: 'scribal_yuri', hostIds: ['student_vasily'] }, flags: { V47_P07_PRIVATE_NOTE: true } }, { requiredKnowledgeId: sources.dostoevskyArrestOrder }),
  ]}),
  beat({ storyId: 'MAIN03', beatId: 'P09', date: '1849-04-25', titleKo: '없어진 이름', objectiveKo: '수취 명부와 현장 목격을 대조해 잘못 적힌 이름을 찾는다', mapId: 'chancery', objectId: 9077, sourceContextKo: '명부와 잘못 기록된 허구 인물의 이름은 창작 요소다. 실제 수사 기록의 명단은 검증된 문서와 동일시하지 않는다.', hosts: ['clerk_alexei', 'scribal_yuri', 'police_sergeant_ivan'], choices: [
    choice('V47_P09_CORRECT_REGISTER', ['clerk_alexei', 'scribal_yuri', 'police_sergeant_ivan'], '수취 증빙을 확인하고 정정 요청한다', '관청이 정정 요청을 접수한다. 허구 인물의 위험은 줄지만 서류 처리는 늦어진다.', { money: [{ fromHostId: 'clerk_alexei', toHostId: 'scribal_yuri', amount: 1 }], inventory: [{ fromHostId: 'police_sergeant_ivan', toHostId: 'clerk_alexei', itemKo: '수취 확인표', quantity: 1 }], moves: [{ hostId: 'scribal_yuri', mapId: 'police-station', x: 128, y: 96 }], relationships: [{ fromHostId: 'clerk_alexei', toHostId: 'police_sergeant_ivan', trustDelta: 1 }], rumor: { id: 'V47_NAME_CORRECTION', fromHostId: 'scribal_yuri', hostIds: ['student_vasily'] }, flags: { V47_P09_CORRECTION_REQUESTED: true } }),
    choice('V47_P09_KEEP_ORIGINAL', ['clerk_alexei', 'scribal_yuri', 'police_sergeant_ivan'], '원본 명부를 그대로 둔다', '접수는 빨라지지만 허구 인물의 이름이 잘못된 기록에 남는다.', { money: [{ fromHostId: 'police_sergeant_ivan', toHostId: 'scribal_yuri', amount: 1 }], inventory: [{ fromHostId: 'scribal_yuri', toHostId: 'police_sergeant_ivan', itemKo: '원본 수취 명부', quantity: 1 }], moves: [{ hostId: 'police_sergeant_ivan', mapId: 'police-station', x: 128, y: 96 }], relationships: [{ fromHostId: 'clerk_alexei', toHostId: 'student_vasily', trustDelta: -1 }], rumor: { id: 'V47_UNCORRECTED_REGISTER', fromHostId: 'police_sergeant_ivan', hostIds: ['student_vasily', 'courier_pavel'] }, flags: { V47_P09_ORIGINAL_RETAINED: true } }),
  ]}),
  beat({ storyId: 'MAIN03', beatId: 'P10', date: '1849-05-17', titleKo: '현장 기록을 정리하다', objectiveKo: '현장 목격과 상급자에게 올릴 후속 보고를 정리한다', mapId: 'police-station', objectId: 9078, sourceContextKo: '서기는 현장 메모와 상급자에게 올릴 보고를 따로 묶는다.', hosts: ['police_sergeant_ivan', 'clerk_alexei', 'senior_clerk_konstantin'], choices: [
    choice('V47_P10_APPEND_WITNESS', ['police_sergeant_ivan', 'clerk_alexei', 'senior_clerk_konstantin'], '현장 목격을 별도 첨부한다', '목격 메모는 보고서와 분리된 부록이 된다. 서기는 날짜와 작성자를 확인한다.', { inventory: [{ fromHostId: 'police_sergeant_ivan', toHostId: 'clerk_alexei', itemKo: '현장 목격 메모', quantity: 1 }], moves: [{ hostId: 'clerk_alexei', mapId: 'chancery', x: 144, y: 160 }], relationships: [{ fromHostId: 'police_sergeant_ivan', toHostId: 'clerk_alexei', trustDelta: 1 }], rumor: { id: 'V47_WITNESS_APPENDIX', fromHostId: 'clerk_alexei', hostIds: ['student_vasily'] }, flags: { V47_P10_WITNESS_ATTACHED: true } }),
    choice('V47_P10_FORWARD_REPORT', ['police_sergeant_ivan', 'clerk_alexei', 'senior_clerk_konstantin'], '보고서만 상급 부서로 보낸다', '보고가 빠르게 올라가고 목격 메모는 현장에 남는다.', { inventory: [{ fromHostId: 'senior_clerk_konstantin', toHostId: 'courier_pavel', itemKo: '봉인된 보고서', quantity: 1 }], moves: [{ hostId: 'courier_pavel', mapId: 'chancery', x: 192, y: 144 }], relationships: [{ fromHostId: 'clerk_alexei', toHostId: 'senior_clerk_konstantin', trustDelta: 1 }], rumor: { id: 'V47_REPORT_FORWARDED', fromHostId: 'courier_pavel', hostIds: ['police_sergeant_ivan'] }, flags: { V47_P10_REPORT_FORWARDED: true } }),
  ]}),
  beat({ storyId: 'MAIN03', beatId: 'P11', date: '1849-12-22', titleKo: '세묘노프 광장', objectiveKo: '광장에 모인 사람들을 돕고 사건 뒤 남길 기록을 고른다', mapId: 'semenovsky-square', objectId: 9079, sourceIds: ['OBJ-WS-DOSTOEVSKY-LETTER-1849-DEC22'], prerequisiteQuestIds: ['E41_SEMENOVSKY_1849'], sourceContextKo: '페트라솁스키 사건의 선고와 감형은 실제 역사 결과로 고정된다. 광장에 있던 허구 인물의 행동과 기억은 창작이다. 이후 작성된 편지는 장면 완료 전 제시하지 않는다.', hosts: ['student_vasily', 'courier_pavel', 'editor_sofia'], choices: [
    choice('V47_P11_GUIDE_FAMILIES', ['student_vasily', 'courier_pavel', 'editor_sofia'], '가족들을 대기 장소로 안내한다', '파벨이 가족들을 광장 바깥으로 안내한다. 이동을 돕는 동안 소지품과 식비가 든다.', { money: [{ fromHostId: 'editor_sofia', toHostId: 'innkeeper_irina', amount: 2 }], inventory: [{ fromHostId: 'courier_pavel', toHostId: 'student_vasily', itemKo: '대기 장소 쪽지', quantity: 1 }], moves: [{ hostId: 'student_vasily', mapId: 'inn-interior', x: 144, y: 144 }, { hostId: 'courier_pavel', mapId: 'inn-interior', x: 160, y: 160 }], relationships: [{ fromHostId: 'student_vasily', toHostId: 'editor_sofia', trustDelta: 1 }], rumor: { id: 'V47_FAMILY_WAITING_PLACE', fromHostId: 'student_vasily', hostIds: ['seamstress_anna', 'landlady_polina'] }, flags: { V47_P11_FAMILIES_GUIDED: true } }),
    choice('V47_P11_KEEP_PRIVATE_ACCOUNT', ['student_vasily', 'courier_pavel', 'editor_sofia'], '목격한 일을 사적인 기록으로 남긴다', '편집실에서 개인 기록을 작성한다. 기록은 공개되지 않지만 보관 책임이 생긴다.', { money: [{ fromHostId: 'student_vasily', toHostId: 'editor_sofia', amount: 1 }], inventory: [{ fromHostId: 'student_vasily', toHostId: 'editor_sofia', itemKo: '광장 목격 기록', quantity: 1 }], moves: [{ hostId: 'student_vasily', mapId: 'communal-room', x: 128, y: 160 }], relationships: [{ fromHostId: 'student_vasily', toHostId: 'editor_sofia', trustDelta: 1 }], rumor: { id: 'V47_PRIVATE_SQUARE_ACCOUNT', fromHostId: 'editor_sofia', hostIds: ['courier_pavel'] }, flags: { V47_P11_PRIVATE_ACCOUNT: true } }),
  ]}),

  // MAIN05 — fictional household/city simulation around the documented 1848
  // epidemic. No post-publication medical report is surfaced in June scenes.
  beat({ storyId: 'MAIN05', beatId: 'C01', date: '1848-06-04', titleKo: '물통을 나르는 사람', objectiveKo: '주문이 몰린 두 골목 가운데 어디에 먼저 물을 보낼지 정한다', mapId: 'market-quay', objectId: 9080, sourceContextKo: '수원·주문·운송자는 허구 설정이다. 현대적인 전파 설명 대신 인물은 냄새, 물통, 비용, 손님의 불평처럼 당시 관찰 가능한 일만 말한다.', hosts: ['watercarrier_luka', 'baker_fyodor', 'landlady_polina'], choices: [
    choice('V47_C01_SUPPLY_LODGING', ['watercarrier_luka', 'baker_fyodor', 'landlady_polina'], '하숙집 물통부터 채운다', '루카는 하숙집에 먼저 물을 보내고 빵집은 다음 차례를 기다린다.', { money: [{ fromHostId: 'landlady_polina', toHostId: 'watercarrier_luka', amount: 2 }], inventory: [{ fromHostId: 'watercarrier_luka', toHostId: 'landlady_polina', itemKo: '물통', quantity: 2 }], moves: [{ hostId: 'watercarrier_luka', mapId: 'communal-room', x: 144, y: 144 }], resources: { waterRiskDelta: -1 }, relationships: [{ fromHostId: 'landlady_polina', toHostId: 'watercarrier_luka', trustDelta: 1 }], rumor: { id: 'V47_WATER_LODGING_FIRST', fromHostId: 'landlady_polina', hostIds: ['tenant_mikhail', 'innkeeper_irina'] }, flags: { V47_C01_LODGING_SUPPLIED: true } }),
    choice('V47_C01_SUPPLY_BAKERY', ['watercarrier_luka', 'baker_fyodor', 'landlady_polina'], '빵집 주문부터 채운다', '빵집은 영업을 이어가지만 하숙집은 물을 아껴 써야 한다.', { money: [{ fromHostId: 'baker_fyodor', toHostId: 'watercarrier_luka', amount: 2 }], inventory: [{ fromHostId: 'watercarrier_luka', toHostId: 'baker_fyodor', itemKo: '물통', quantity: 2 }], moves: [{ hostId: 'watercarrier_luka', mapId: 'bakery-interior', x: 144, y: 144 }], resources: { waterRiskDelta: 1 }, relationships: [{ fromHostId: 'baker_fyodor', toHostId: 'watercarrier_luka', trustDelta: 1 }, { fromHostId: 'landlady_polina', toHostId: 'watercarrier_luka', trustDelta: -1 }], rumor: { id: 'V47_WATER_BAKERY_FIRST', fromHostId: 'landlady_polina', hostIds: ['tenant_mikhail', 'seamstress_anna'] }, flags: { V47_C01_BAKERY_SUPPLIED: true } }),
  ]}),
  beat({ storyId: 'MAIN05', beatId: 'C03', date: '1848-06-12', titleKo: '약품이 모자란다', objectiveKo: '약국 재고를 병원과 형편이 어려운 손님에게 나눈다', mapId: 'market-quay', objectId: 9081, sourceContextKo: '약제사의 재고와 구매자는 허구의 생활 시뮬레이션이다. 1848년 인물이 병원체나 현대 치료법을 알고 있는 듯 말하지 않는다.', hosts: ['apothecary_yakov', 'midwife_avdotya', 'tenant_mikhail', 'market_nadezhda'], choices: [
    choice('V47_C03_RESERVE_CLINIC', ['apothecary_yakov', 'midwife_avdotya', 'tenant_mikhail'], '병원 몫을 따로 둔다', '의사는 필요한 물품을 받지만 약국은 일반 판매를 줄인다.', { money: [{ fromHostId: 'midwife_avdotya', toHostId: 'apothecary_yakov', amount: 2 }], inventory: [{ fromHostId: 'apothecary_yakov', toHostId: 'midwife_avdotya', itemKo: '붕대와 약재 꾸러미', quantity: 2 }], moves: [{ hostId: 'midwife_avdotya', mapId: 'inn-interior', x: 176, y: 144 }], resources: { medicineDelta: 2 }, relationships: [{ fromHostId: 'midwife_avdotya', toHostId: 'apothecary_yakov', trustDelta: 1 }], rumor: { id: 'V47_MEDICINE_CLINIC_RESERVE', fromHostId: 'midwife_avdotya', hostIds: ['innkeeper_irina', 'midwife_avdotya'] }, flags: { V47_C03_CLINIC_STOCK: true } }),
    choice('V47_C03_SELL_ON_CREDIT', ['apothecary_yakov', 'midwife_avdotya', 'tenant_mikhail'], '가난한 이웃에게 외상으로 판다', '미하일 세입자는 필요한 물품을 받지만 야코프는 장부에 빚을 적는다.', { inventory: [{ fromHostId: 'apothecary_yakov', toHostId: 'tenant_mikhail', itemKo: '가정용 약재 꾸러미', quantity: 1 }], moves: [{ hostId: 'tenant_mikhail', mapId: 'communal-room', x: 144, y: 144 }], resources: { medicineDelta: -1 }, relationships: [{ fromHostId: 'tenant_mikhail', toHostId: 'apothecary_yakov', trustDelta: 1 }], rumor: { id: 'V47_MEDICINE_CREDIT', fromHostId: 'tenant_mikhail', hostIds: ['landlady_polina', 'midwife_avdotya'] }, flags: { V47_C03_MEDICINE_CREDIT: true } }),
    choice('V47_C03_REQUEST_STOCK', ['apothecary_yakov', 'market_nadezhda', 'midwife_avdotya'], '다른 가게에 남은 물품을 묻는다', '야코프는 시장 상인에게 값을 치르고 천과 약재를 받아 온다. 환자 몫은 늘지만 약국의 남은 돈은 줄어든다.', { money: [{ fromHostId: 'apothecary_yakov', toHostId: 'market_nadezhda', amount: 1 }], inventory: [{ fromHostId: 'market_nadezhda', toHostId: 'apothecary_yakov', itemKo: '추가 붕대와 약재', quantity: 1 }], moves: [{ hostId: 'apothecary_yakov', mapId: 'market-quay', x: 176, y: 144 }], resources: { medicineDelta: 1 }, relationships: [{ fromHostId: 'apothecary_yakov', toHostId: 'market_nadezhda', trustDelta: 1 }], rumor: { id: 'V47_MEDICINE_STOCK_REQUESTED', fromHostId: 'market_nadezhda', hostIds: ['midwife_avdotya'] }, flags: { V47_C03_STOCK_REQUESTED: true } }),
  ]}),
  beat({ storyId: 'MAIN05', beatId: 'C04', date: '1848-06-18', titleKo: '이웃이 들은 말', objectiveKo: '시장 소문을 확인하고 실제로 본 사람을 찾는다', mapId: 'market-quay', objectId: 9082, sourceContextKo: '시장에 도는 소문과 군중 반응은 허구의 사건이다. 당시의 병인 이해를 현대적 사실로 바꾸어 인물에게 부여하지 않는다.', hosts: ['seamstress_anna', 'market_nadezhda', 'police_sergeant_ivan'], choices: [
    choice('V47_C04_CHECK_WITNESS', ['seamstress_anna', 'market_nadezhda', 'police_sergeant_ivan'], '말을 처음 들은 사람을 찾아 묻는다', '안나가 목격자를 찾아 이동한다. 소문은 늦게 퍼지지만 시장 판매자에게 확인 비용을 지불한다.', { money: [{ fromHostId: 'seamstress_anna', toHostId: 'market_nadezhda', amount: 1 }], inventory: [{ fromHostId: 'market_nadezhda', toHostId: 'seamstress_anna', itemKo: '시장 거래 쪽지', quantity: 1 }], moves: [{ hostId: 'seamstress_anna', mapId: 'market-quay', x: 176, y: 160 }], relationships: [{ fromHostId: 'seamstress_anna', toHostId: 'market_nadezhda', trustDelta: 1 }], rumor: { id: 'V47_WITNESS_CHECKED', fromHostId: 'seamstress_anna', hostIds: ['police_sergeant_ivan'] }, flags: { V47_C04_WITNESS_CHECKED: true } }),
    choice('V47_C04_WARN_POLICE', ['seamstress_anna', 'market_nadezhda', 'police_sergeant_ivan'], '경찰에게 시장 소란을 알린다', '경찰관이 시장으로 와 군중을 살핀다. 소문은 더 넓게 알려지고 거래가 잠시 줄어든다.', { money: [{ fromHostId: 'market_nadezhda', toHostId: 'police_sergeant_ivan', amount: 1 }], inventory: [{ fromHostId: 'seamstress_anna', toHostId: 'police_sergeant_ivan', itemKo: '소문을 적은 신고 쪽지', quantity: 1 }], moves: [{ hostId: 'police_sergeant_ivan', mapId: 'market-quay', x: 192, y: 144 }], resources: { foodRiskDelta: 1 }, relationships: [{ fromHostId: 'market_nadezhda', toHostId: 'police_sergeant_ivan', trustDelta: -1 }], rumor: { id: 'V47_MARKET_REPORT', fromHostId: 'police_sergeant_ivan', hostIds: ['watercarrier_luka', 'baker_fyodor'] }, flags: { V47_C04_POLICE_NOTIFIED: true } }),
  ]}),
  beat({ storyId: 'MAIN05', beatId: 'C05', date: '1848-06-23', titleKo: '병원 침상 수', objectiveKo: '환자 돌봄에 쓸 침상과 의료 인력을 배치한다', mapId: 'inn-interior', objectId: 9083, sourceContextKo: '병상·직원·환자는 허구의 게임 시뮬레이션이다. 장면에서 의사는 관찰한 증상과 돌봄 여건만 말하며 현대 질병 지식을 드러내지 않는다.', hosts: ['midwife_avdotya', 'doctor_mikhail_1848', 'innkeeper_irina', 'tenant_mikhail'], choices: [
    choice('V47_C05_OPEN_BEDS', ['midwife_avdotya', 'doctor_mikhail_1848', 'innkeeper_irina'], '여관 방을 임시 침상으로 쓴다', '두 침상을 더 놓는다. 여관 수입과 손님의 사생활은 줄어든다.', { money: [{ fromHostId: 'midwife_avdotya', toHostId: 'innkeeper_irina', amount: 2 }], inventory: [{ fromHostId: 'innkeeper_irina', toHostId: 'midwife_avdotya', itemKo: '침구 꾸러미', quantity: 2 }], moves: [{ hostId: 'midwife_avdotya', mapId: 'inn-interior', x: 176, y: 160 }, { hostId: 'doctor_mikhail_1848', mapId: 'inn-interior', x: 144, y: 176 }], resources: { bedsDelta: 2 }, relationships: [{ fromHostId: 'midwife_avdotya', toHostId: 'innkeeper_irina', trustDelta: 1 }], rumor: { id: 'V47_INN_BEDS_OPEN', fromHostId: 'innkeeper_irina', hostIds: ['landlady_polina', 'tenant_mikhail'] }, flags: { V47_C05_BEDS_OPENED: true } }),
    choice('V47_C05_KEEP_HOUSEHOLD_CARE', ['midwife_avdotya', 'doctor_mikhail_1848', 'tenant_mikhail', 'innkeeper_irina'], '가족 돌봄을 위해 방문 인력을 보낸다', '아브도티야가 환자 집을 방문한다. 병원 침상은 그대로지만 집안 돌봄에 시간이 든다.', { inventory: [{ fromHostId: 'midwife_avdotya', toHostId: 'tenant_mikhail', itemKo: '깨끗한 천과 물병', quantity: 1 }], moves: [{ hostId: 'midwife_avdotya', mapId: 'communal-room', x: 144, y: 144 }], resources: { medicineDelta: -1 }, relationships: [{ fromHostId: 'midwife_avdotya', toHostId: 'tenant_mikhail', trustDelta: 1 }], rumor: { id: 'V47_HOME_VISIT', fromHostId: 'tenant_mikhail', hostIds: ['landlady_polina'] }, flags: { V47_C05_HOME_VISIT: true } }),
    choice('V47_C05_LISTEN_TO_FAMILY', ['midwife_avdotya', 'doctor_mikhail_1848', 'tenant_mikhail'], '가족이 들은 말을 먼저 듣는다', '의사는 가족이 관찰한 시각과 증상을 묻고, 아브도티야는 물장수에 대한 소문과 냉기를 탓하는 말을 구분해 적는다. 진료는 잠시 늦어진다.', { inventory: [{ fromHostId: 'tenant_mikhail', toHostId: 'doctor_mikhail_1848', itemKo: '가족의 증상과 목격 메모', quantity: 1 }], moves: [{ hostId: 'midwife_avdotya', mapId: 'communal-room', x: 144, y: 144 }], relationships: [{ fromHostId: 'doctor_mikhail_1848', toHostId: 'tenant_mikhail', trustDelta: 1 }], rumor: { id: 'V47_FAMILY_ACCOUNT_HEARD', fromHostId: 'tenant_mikhail', hostIds: ['doctor_mikhail_1848', 'midwife_avdotya'] }, flags: { V47_C05_FAMILY_ACCOUNT_HEARD: true } }),
  ]}),
  beat({ storyId: 'MAIN05', beatId: 'C06', date: '1848-06-28', titleKo: '물장수 앞에 모인 사람들', objectiveKo: '군중을 가라앉히고 물 공급을 이어갈 방법을 고른다', mapId: 'market-quay', objectId: 9084, sourceContextKo: '이 군중과 물장수에 대한 비난은 허구 장면이다. 1831년 콜레라 폭동 같은 다른 시기의 사건을 1848년 현장 사실로 옮기지 않는다.', hosts: ['police_sergeant_ivan', 'watercarrier_luka', 'market_nadezhda'], choices: [
    choice('V47_C06_PROTECT_CART', ['police_sergeant_ivan', 'watercarrier_luka', 'market_nadezhda'], '수레를 보호하고 주문표를 다시 확인한다', '경찰관이 수레 주변을 비운다. 루카는 기다린 집에 물을 배달하고 시장 상인은 손해 일부를 보전한다.', { money: [{ fromHostId: 'market_nadezhda', toHostId: 'watercarrier_luka', amount: 1 }], inventory: [{ fromHostId: 'watercarrier_luka', toHostId: 'market_nadezhda', itemKo: '물 배달 확인표', quantity: 1 }], moves: [{ hostId: 'watercarrier_luka', mapId: 'communal-room', x: 160, y: 144 }], resources: { waterRiskDelta: -1 }, relationships: [{ fromHostId: 'police_sergeant_ivan', toHostId: 'watercarrier_luka', trustDelta: 1 }], rumor: { id: 'V47_CART_PROTECTED', fromHostId: 'market_nadezhda', hostIds: ['landlady_polina', 'baker_fyodor'] }, flags: { V47_C06_CART_PROTECTED: true } }),
    choice('V47_C06_DISPERSE_CROWD', ['police_sergeant_ivan', 'watercarrier_luka', 'market_nadezhda'], '사람들을 흩어지게 하고 수레를 옮긴다', '군중은 흩어지지만 물 공급은 늦어진다. 루카는 다른 길로 돌아간다.', { money: [{ fromHostId: 'police_sergeant_ivan', toHostId: 'watercarrier_luka', amount: 1 }], inventory: [{ fromHostId: 'police_sergeant_ivan', toHostId: 'market_nadezhda', itemKo: '통행 허가 쪽지', quantity: 1 }], moves: [{ hostId: 'watercarrier_luka', mapId: 'canal-road', x: 112, y: 144 }, { hostId: 'police_sergeant_ivan', mapId: 'market-quay', x: 192, y: 160 }], resources: { waterRiskDelta: 1 }, relationships: [{ fromHostId: 'market_nadezhda', toHostId: 'police_sergeant_ivan', trustDelta: -1 }], rumor: { id: 'V47_CROWD_DISPERSED', fromHostId: 'market_nadezhda', hostIds: ['tenant_mikhail', 'baker_fyodor'] }, flags: { V47_C06_CROWD_DISPERSED: true } }),
    choice('V47_C06_HEAR_WITNESSES', ['police_sergeant_ivan', 'watercarrier_luka', 'market_nadezhda'], '먼저 주민의 목격을 듣는다', '경찰관은 누가 어디서 처음 아팠는지 따로 묻는다. 수레는 잠시 멈추지만 루카를 탓하는 소문은 가라앉는다.', { inventory: [{ fromHostId: 'market_nadezhda', toHostId: 'police_sergeant_ivan', itemKo: '시장 목격자 메모', quantity: 1 }], moves: [{ hostId: 'police_sergeant_ivan', mapId: 'market-quay', x: 176, y: 160 }], resources: { waterRiskDelta: 0 }, relationships: [{ fromHostId: 'police_sergeant_ivan', toHostId: 'watercarrier_luka', trustDelta: 1 }], rumor: { id: 'V47_WITNESS_HEARD_BEFORE_ACCUSATION', fromHostId: 'police_sergeant_ivan', hostIds: ['watercarrier_luka', 'landlady_polina'] }, flags: { V47_C06_WITNESSES_HEARD: true } }),
    choice('V47_C06_REPEAT_RUMOR', ['police_sergeant_ivan', 'watercarrier_luka', 'market_nadezhda'], '물장수가 병을 옮긴다는 말을 퍼뜨린다', '사람들은 수레를 피하지만 물 배달이 끊기고 루카와 시장 상인에 대한 불신이 커진다.', { moves: [{ hostId: 'watercarrier_luka', mapId: 'canal-road', x: 112, y: 144 }], resources: { waterRiskDelta: 1 }, relationships: [{ fromHostId: 'watercarrier_luka', toHostId: 'police_sergeant_ivan', trustDelta: -2 }, { fromHostId: 'market_nadezhda', toHostId: 'police_sergeant_ivan', trustDelta: -1 }], rumor: { id: 'V47_WATER_CARRIER_RUMOR_REPEATED', fromHostId: 'market_nadezhda', hostIds: ['tenant_mikhail', 'baker_fyodor', 'landlady_polina'] }, flags: { V47_C06_RUMOR_REPEATED: true } }),
  ]}),
  beat({ storyId: 'MAIN05', beatId: 'C07', date: '1848-07-03', titleKo: '가게 문은 열 것인가', objectiveKo: '빵집 영업과 병원 공급, 견습공 품삯을 함께 결정한다', mapId: 'bakery-interior', objectId: 9085, sourceContextKo: '빵집의 영업 결정과 거래는 허구 생활 시뮬레이션이다. 실제 콜레라 유행의 도시 단위 규모나 원인은 이 가게의 재고로 대표하지 않는다.', hosts: ['baker_fyodor', 'innkeeper_irina', 'apothecary_yakov'], choices: [
    choice('V47_C07_SUPPLY_HOSPITAL', ['baker_fyodor', 'innkeeper_irina', 'apothecary_yakov'], '병원에 빵을 보내고 가게는 짧게 연다', '병원 주문을 보내고 견습공 품삯을 지급한다. 일반 손님은 빵을 덜 산다.', { money: [{ fromHostId: 'midwife_avdotya', toHostId: 'baker_fyodor', amount: 3 }, { fromHostId: 'baker_fyodor', toHostId: 'print_apprentice_stepan', amount: 1 }], inventory: [{ fromHostId: 'baker_fyodor', toHostId: 'midwife_avdotya', itemKo: '빵 바구니', quantity: 2 }], moves: [{ hostId: 'baker_fyodor', mapId: 'inn-interior', x: 176, y: 144 }], resources: { foodRiskDelta: -1 }, relationships: [{ fromHostId: 'baker_fyodor', toHostId: 'midwife_avdotya', trustDelta: 1 }], rumor: { id: 'V47_BAKERY_HOSPITAL_ORDER', fromHostId: 'innkeeper_irina', hostIds: ['market_nadezhda', 'tenant_mikhail'] }, flags: { V47_C07_HOSPITAL_SUPPLY: true } }),
    choice('V47_C07_KEEP_PUBLIC_COUNTER', ['baker_fyodor', 'innkeeper_irina', 'apothecary_yakov'], '가게를 열고 단골 주문을 우선한다', '단골 매출로 밀가루 대금을 갚는다. 병원 주문은 다른 상인에게 넘어간다.', { money: [{ fromHostId: 'innkeeper_irina', toHostId: 'baker_fyodor', amount: 2 }, { fromHostId: 'baker_fyodor', toHostId: 'apothecary_yakov', amount: 1 }], inventory: [{ fromHostId: 'baker_fyodor', toHostId: 'innkeeper_irina', itemKo: '빵 꾸러미', quantity: 1 }], moves: [{ hostId: 'innkeeper_irina', mapId: 'bakery-interior', x: 128, y: 160 }], resources: { foodRiskDelta: 1 }, relationships: [{ fromHostId: 'baker_fyodor', toHostId: 'midwife_avdotya', trustDelta: -1 }], rumor: { id: 'V47_BAKERY_PUBLIC_TRADE', fromHostId: 'innkeeper_irina', hostIds: ['market_nadezhda', 'landlady_polina'] }, flags: { V47_C07_PUBLIC_COUNTER: true } }),
  ]}),
  beat({ storyId: 'MAIN05', beatId: 'C08', date: '1848-07-10', titleKo: '아브도티야의 방문', objectiveKo: '환자 가족과 방문 돌봄에 참여할 이웃을 정한다', mapId: 'communal-room', objectId: 9086, sourceIds: ['V47-ECONOMIST-PETERSBURG-1848-06-24'], sourceContextKo: '1848년 7월 8일자 신문에 실린 페테르부르크발 보고가 자료실에 도착했다. 보도에 적힌 날씨 설명은 당시 기자의 추정이며 현대 의학적 원인 설명이 아니다. 방문 환자와 가족은 허구 인물이다.', hosts: ['midwife_avdotya', 'tenant_mikhail', 'landlady_polina', 'doctor_mikhail_1848'], choices: [
    choice('V47_C08_ASK_NEIGHBOR_HELP', ['midwife_avdotya', 'tenant_mikhail', 'landlady_polina', 'doctor_mikhail_1848'], '이웃에게 하루씩 돌봄을 부탁한다', '폴리나가 공동 공간과 물을 내놓고 이웃들이 교대로 돕는다.', { money: [{ fromHostId: 'landlady_polina', toHostId: 'watercarrier_luka', amount: 1 }], inventory: [{ fromHostId: 'midwife_avdotya', toHostId: 'tenant_mikhail', itemKo: '깨끗한 천 묶음', quantity: 1 }], moves: [{ hostId: 'landlady_polina', mapId: 'communal-room', x: 176, y: 144 }], resources: { waterRiskDelta: -1, medicineDelta: 1 }, relationships: [{ fromHostId: 'tenant_mikhail', toHostId: 'landlady_polina', trustDelta: 1 }], rumor: { id: 'V47_NEIGHBOR_CARE', fromHostId: 'landlady_polina', hostIds: ['seamstress_anna', 'midwife_avdotya'] }, flags: { V47_C08_SHARED_CARE: true } }),
    choice('V47_C08_MOVE_PATIENT', ['midwife_avdotya', 'tenant_mikhail', 'landlady_polina', 'doctor_mikhail_1848'], '환자를 여관의 임시 침상으로 옮긴다', '환자는 이동하지만 가족은 방을 비워야 하고 여관의 침상 하나가 찬다.', { money: [{ fromHostId: 'tenant_mikhail', toHostId: 'innkeeper_irina', amount: 1 }], inventory: [{ fromHostId: 'midwife_avdotya', toHostId: 'tenant_mikhail', itemKo: '환자용 담요', quantity: 1 }], moves: [{ hostId: 'tenant_mikhail', mapId: 'inn-interior', x: 160, y: 160 }, { hostId: 'midwife_avdotya', mapId: 'inn-interior', x: 144, y: 176 }], resources: { bedsDelta: -1 }, relationships: [{ fromHostId: 'tenant_mikhail', toHostId: 'landlady_polina', trustDelta: -1 }], rumor: { id: 'V47_PATIENT_MOVED_TO_INN', fromHostId: 'innkeeper_irina', hostIds: ['midwife_avdotya', 'seamstress_anna'] }, flags: { V47_C08_PATIENT_MOVED: true } }),
  ]}),
  beat({ storyId: 'MAIN05', beatId: 'C09', date: '1848-07-15', titleKo: '결근 사유서', objectiveKo: '가족 간병과 일자리·방세를 함께 감당할 방법을 찾는다', mapId: 'sewing-room', objectId: 9087, sourceContextKo: '결근·임금·간병 문제는 허구 노동자의 경험이다. 진단이나 병의 경로를 알 수 없는 당대 인물의 시야를 유지한다.', hosts: ['tenant_mikhail', 'seamstress_anna', 'landlady_polina'], choices: [
    choice('V47_C09_REQUEST_ADVANCE', ['tenant_mikhail', 'seamstress_anna', 'landlady_polina'], '고용주에게 하루치 선금을 청한다', '선금을 받고 방세를 일부 낸다. 다음 급료에서 그만큼 공제된다.', { money: [{ fromHostId: 'seamstress_anna', toHostId: 'tenant_mikhail', amount: 2 }, { fromHostId: 'tenant_mikhail', toHostId: 'landlady_polina', amount: 1 }], inventory: [{ fromHostId: 'tenant_mikhail', toHostId: 'seamstress_anna', itemKo: '결근 사유 쪽지', quantity: 1 }], moves: [{ hostId: 'tenant_mikhail', mapId: 'communal-room', x: 128, y: 144 }], relationships: [{ fromHostId: 'tenant_mikhail', toHostId: 'seamstress_anna', trustDelta: 1 }], rumor: { id: 'V47_ABSENCE_ADVANCE', fromHostId: 'seamstress_anna', hostIds: ['landlady_polina'] }, flags: { V47_C09_WAGE_ADVANCE: true } }),
    choice('V47_C09_STAY_AND_CARE', ['tenant_mikhail', 'seamstress_anna', 'landlady_polina'], '일을 쉬고 가족 곁에 남는다', '가족을 돌보지만 하루 품삯을 잃는다. 집주인은 방세 기한을 늦춰 준다.', { money: [{ fromHostId: 'landlady_polina', toHostId: 'tenant_mikhail', amount: 1 }], inventory: [{ fromHostId: 'seamstress_anna', toHostId: 'tenant_mikhail', itemKo: '돌봄용 물병', quantity: 1 }], moves: [{ hostId: 'tenant_mikhail', mapId: 'communal-room', x: 144, y: 176 }], resources: { waterRiskDelta: -1 }, relationships: [{ fromHostId: 'landlady_polina', toHostId: 'tenant_mikhail', trustDelta: 1 }, { fromHostId: 'tenant_mikhail', toHostId: 'seamstress_anna', trustDelta: 1 }], rumor: { id: 'V47_FAMILY_CARE_ABSENCE', fromHostId: 'tenant_mikhail', hostIds: ['midwife_avdotya'] }, flags: { V47_C09_FAMILY_CARE: true } }),
  ]}),
  beat({ storyId: 'MAIN05', beatId: 'C10', date: '1848-08-22', titleKo: '여름을 지나온 기록', objectiveKo: '환자와 가구, 문을 닫은 방의 변화를 살핀다', mapId: 'inn-interior', objectId: 9088, sourceContextKo: '여름 동안 환자를 돌본 사람들과 남은 가구의 형편을 확인한다.', hosts: ['midwife_avdotya', 'clerk_alexei', 'innkeeper_irina'], choices: [
    choice('V47_C10_KEEP_CASE_NOTES', ['midwife_avdotya', 'clerk_alexei', 'innkeeper_irina'], '환자별 관찰을 따로 적는다', '환자 상태와 돌봄 시간을 분리해 기록한다. 기록을 위해 의료 인력이 일을 잠시 멈춘다.', { money: [{ fromHostId: 'midwife_avdotya', toHostId: 'scribal_yuri', amount: 1 }], inventory: [{ fromHostId: 'midwife_avdotya', toHostId: 'clerk_alexei', itemKo: '환자별 관찰장', quantity: 1 }], moves: [{ hostId: 'clerk_alexei', mapId: 'inn-interior', x: 176, y: 176 }], resources: { medicineDelta: -1 }, relationships: [{ fromHostId: 'midwife_avdotya', toHostId: 'innkeeper_irina', trustDelta: 1 }], rumor: { id: 'V47_CASE_NOTES_KEPT', fromHostId: 'midwife_avdotya', hostIds: ['landlady_polina'] }, flags: { V47_C10_CASE_NOTES: true } }),
    choice('V47_C10_RESTOCK_FIRST', ['midwife_avdotya', 'clerk_alexei', 'innkeeper_irina'], '기록을 미루고 물품을 구하러 간다', '야코프에게서 약재와 천을 더 받는다. 당일 환자 기록은 빈칸으로 남는다.', { money: [{ fromHostId: 'midwife_avdotya', toHostId: 'apothecary_yakov', amount: 2 }], inventory: [{ fromHostId: 'apothecary_yakov', toHostId: 'midwife_avdotya', itemKo: '약재와 깨끗한 천', quantity: 2 }], moves: [{ hostId: 'midwife_avdotya', mapId: 'market-quay', x: 144, y: 160 }], resources: { medicineDelta: 2 }, relationships: [{ fromHostId: 'midwife_avdotya', toHostId: 'apothecary_yakov', trustDelta: 1 }], rumor: { id: 'V47_MEDICAL_RESTOCK', fromHostId: 'apothecary_yakov', hostIds: ['midwife_avdotya', 'innkeeper_irina'] }, flags: { V47_C10_RESTOCKED: true } }),
  ]}),
  beat({ storyId: 'MAIN05', beatId: 'C11', date: '1848-09-02', titleKo: '비어 있는 객실', objectiveKo: '회복·실직·이주 뒤 남은 방과 빚을 정리한다', mapId: 'inn-interior', objectId: 9089, sourceContextKo: '특정 객실의 환자·사망·회복·이주는 허구 인물의 결과다. 콜레라 유행의 실제 결과를 바꾸거나 개별 역사 인물에게 귀속하지 않는다.', hosts: ['innkeeper_irina', 'midwife_avdotya', 'tenant_mikhail'], choices: [
    choice('V47_C11_REOPEN_ROOM', ['innkeeper_irina', 'midwife_avdotya', 'tenant_mikhail'], '객실을 정리해 다시 연다', '침구를 씻고 객실을 연다. 수입이 돌아오지만 직원과 손님은 서두르는 데 불만을 보인다.', { money: [{ fromHostId: 'innkeeper_irina', toHostId: 'laundress_mariya', amount: 2 }, { fromHostId: 'tenant_mikhail', toHostId: 'innkeeper_irina', amount: 1 }], inventory: [{ fromHostId: 'laundress_mariya', toHostId: 'innkeeper_irina', itemKo: '세탁한 침구', quantity: 1 }], moves: [{ hostId: 'tenant_mikhail', mapId: 'inn-interior', x: 112, y: 144 }], resources: { bedsDelta: -1 }, relationships: [{ fromHostId: 'innkeeper_irina', toHostId: 'tenant_mikhail', trustDelta: -1 }], rumor: { id: 'V47_INN_ROOM_REOPENED', fromHostId: 'innkeeper_irina', hostIds: ['market_nadezhda', 'baker_fyodor'] }, flags: { V47_C11_ROOM_REOPENED: true } }),
    choice('V47_C11_KEEP_CARE_ROOM', ['innkeeper_irina', 'midwife_avdotya', 'tenant_mikhail'], '방 하나를 며칠 더 돌봄에 남긴다', '객실 수입은 늦게 회복되지만 필요한 가족이 잠시 머물 자리가 생긴다.', { money: [{ fromHostId: 'midwife_avdotya', toHostId: 'innkeeper_irina', amount: 1 }], inventory: [{ fromHostId: 'innkeeper_irina', toHostId: 'tenant_mikhail', itemKo: '깨끗한 침구', quantity: 1 }], moves: [{ hostId: 'tenant_mikhail', mapId: 'inn-interior', x: 160, y: 144 }], resources: { bedsDelta: 1, medicineDelta: 1 }, relationships: [{ fromHostId: 'tenant_mikhail', toHostId: 'innkeeper_irina', trustDelta: 1 }], rumor: { id: 'V47_INN_CARE_ROOM', fromHostId: 'tenant_mikhail', hostIds: ['midwife_avdotya', 'landlady_polina'] }, flags: { V47_C11_CARE_ROOM_KEPT: true } }),
  ]}),
];

// Scene dialogue is taken from the supplied V47 scenario scripts and is
// authored fiction, never a claim about a historical person's verbatim words.
const scriptedDialogue = {
  V47_MAIN01_A01: [
    ['다리야', '레프 세묘노비치, 《동시대인》에 딸린다는 그 별책 말이에요. 어제 빌린 호는 돌려드렸지요. 부디 우리 집으로는 보내지 마세요.'],
    ['레프', '아가씨 댁에는 파리 소설이라면 표지도 안 보고 들이지요. 리테이니 인쇄소에선 아직 소식이 없소. 여기 의자에 앉으시오. 책을 사려 온 사람이 창밖에 서서 읽다니.'],
    ['파벨', '리테이니까지야 제가 다녀오죠. 저 집 마부가 오면 두 사람 다 기다린다고 일러 주시오.'],
  ],
  V47_MAIN01_A02: [
    ['파벨', '레프 세묘노비치, 파리서는 루이 필리프가 달아났답니까? 그럼 주인한테 허락받아야 어미가 아들 집에 오는 일도 없어졌소?'],
    ['레프', '왕이 없어졌다고 저녁거리가 생기지는 않소. 여기 청어 한 점 내려놓으시게. 두 나라 사람이 그건 같은 값에 먹는지나 묻자고.'],
    ['파벨', '제 동무는 그 청어도 여기 와선 못 먹소. 그 애 주인이 길 떠날 허락을 안 내주는 통에.'],
    ['이리나', '파리 양반은 우리 마을 우물이 어느 쪽에 있는지도 몰라요. 봄 얼음에 우물이 상하면 가난한 집이고 넉넉한 집이고 사내들이 한데 달려들지.'],
    ['파벨', '고친 다음 날은요? 우리 어멈은 물을 길으러 닷새도 아니고 마흔 해를 그 우물에 갔소. 그 양반도 등 뒤에 양동이 자국이 났답니까?'],
    ['이리나', '그 물로 내가 사흘 열 앓은 애를 먹여 살렸어요. 그해 얼음은 주인도 깼지요. 그리고 이듬해 내 맏이가 일곱 살이 되자, 내가 그 애한테 두레박을 매 주었소. 아침에 부른 것도 나였고.'],
    ['레프', '니콜라이 파블로비치 폐하의 선언이 저기 걸렸소. 자네 말이 거기 든 소요 같은 건 아니겠지. 목소리를 조금만 낮추게.'],
    ['안나', '목소리는 낮추겠소. 다만 잡지 구독료 좀 내주오. 별책이 온다기로 남편과 《동시대인》을 신청했지요. 남편을 묻고 나선 이불을 팔라 합니다. 제가 돈을 냈으니 제게 주셔야지요. 이불을 팔면 그 자리에 잠들 사람도 저고.'],
    ['레프', '안나 이바노브나, 그 자리에서 일어나지 마오. 파벨에게 줄 인쇄소 선금과 안나한테 줄 돈이 내게는 같은 주머니에 있소.'],
  ],
  V47_MAIN01_A03: [
    ['산파 아브도티야', '부모는 울지를 않는데 유모는 웁디다. 장례가 끝나면 그 모피옷은 다른 이가 입겠지요. 유모가 한겨울에 그 집 문을 나설 때는 무얼 입나요?'],
    ['편집자 소피야', '아브도티야 야코블레브나의 저 대목을 읽고 저는 제 아버지의 손을 떠올렸답니다. 사순절 내내 성상 앞에 켜진 촛불을 손수 갈아 주시던 손이에요. 우리 하녀는 겨울에도 그 손이 닿을까 소매를 걷지 못했고요.'],
    ['파나예프', '그 의자에서 아비를 내몰면 다음에는 누가 앉겠습니까? 프랑스 사람에게 묻기엔 집이 너무 가깝지요.'],
    ['편집자 소피야', '이반 이바노비치, 그 의자에 앉은 이가 우리들 중 하나라면요? 그분 앞에서 제 얘기를 마칠 때까지 기다려 주시겠습니까?'],
    ['파나예바', '그 물음에는 서둘러 대답하고 싶지 않군요. 나는 저 방 문이 안에서 열리는지부터 생각했습니다. 아이는 그걸 먼저 알아야 하니까요.'],
    ['산파 아브도티야', '유모를 부르시오. 이 집에서 문을 가장 많이 열어 본 사람은 한밤에 애 울음 듣고 일어나던 그 여자요.'],
  ],
  V47_MAIN01_A04: [
    ['스테판', '손을 떼자고 한 건 저만이 아니오. 그런데 예카테리나가 공장 문을 여니까, 손을 뗀 놈은 저 하나가 되었네요.'],
    ['예카테리나', '내가 문을 열었지. 주인 손에 열쇠가 돌아가면 너희는 내일 이 의자에도 못 앉아. 그 양반은 활자 대신 식자공을 갈아 끼우려 할 테니.'],
    ['스테판', '제가 가르친 애가 여기 올지도 모르겠소. 그 애한테는 꼭 저보다 후한 품삯을 줍시다.'],
    ['예카테리나', '정작 네 입으론 한 푼이라도 올려 달라고 못하니? 밖에 저 애들 듣는 데서 다시 말해 봐.'],
    ['스테판', '못합니다. 저는 저 애들더러 밤에 남아 있으라던 사람이거든요.'],
  ],
  V47_MAIN01_A05: [
    ['콘스탄틴', '무신푸시킨 각하가 크릴로프 검열관에게 맡긴 게 이 연감이네. 크릴로프는 책을 통째 읽고 그중 네 편을 문제 삼았어. 달의 「신부를 보러 가다」라면 조금 손봐 따로 보낼 수 있다네. 그런데 같은 연감에 술 한 잔 얻으려 시중드는 퇴역 장교가 앉아 있지. 파나예프의 「역에서의 만남」이야.'],
    ['알렉세이', '그 장교가 남의 잔을 드는 데서 아침의 저는 웃었지요. 「탈니코프 가족」을 덮고 나니 그 주막이 낯설어졌습니다. 밖에서 허리를 굽히고 돌아온 사람이 집 안에서는 누구를 세워 두고 술을 마시는지, 종이를 한 장 더 넘기고 싶더군요.'],
    ['콘스탄틴', '나는 원로원 광장에서 앞으로만 걷는 말과 뒤로만 뛰는 사람을 보았네. 둘 다 같은 황제의 말과 백성이었어. 자네가 그 눈밭을 보고도 질서를 쉽게 버릴지 들어 보고 싶군.'],
    ['알렉세이', '제 어머니에게는 들어서 아는 질서도 있습니다. 저를 속량해 주신 날 어머니 손엔 제 옷이 들려 있었지요. 그날도 어머니는 주인댁 부엌으로 돌아갔습니다.'],
    ['콘스탄틴', '장교의 잔에서 아버지 손까지 옮겨 간 것이 자네 하나일까. 책을 한 권 손에 쥔 사람마다 그리하면 그다음엔 우리가 누구 집 문을 두드려야 하나. 「신부를 보러 가다」만이라도 이쪽에 놓게.'],
    ['알렉세이', '신부 보러 가는 길은 열어 주시고 저 아이 방은 또 잠그시겠군요. 문 하나만 닫은 줄 아시겠지만, 그 방에서 보면 집 안의 문은 그게 다입니다.'],
    ['콘스탄틴', '어머니도 그 집 안주인도 같은 그리스도 앞에 무릎을 꿇네. 자네는 그런 데서도 러시아를 찾을 수 있어. 프랑스에서 가져오는 자로만 치수를 재지 말게.'],
    ['알렉세이', '예, 두 분이 일요일이면 똑같은 바닥에 무릎을 꿇으십니다. 월요일에 어머니의 무릎을 제가 일으켜 드릴 수 있으면 좋겠습니다.'],
  ],
  V47_MAIN01_A07: [
    ['폴리나', '안나 이바노브나, 오늘 주인이 열쇠를 가져간단다. 네가 비워도 마리야는 들이지 말라더구나. 나더러 그 애의 자리를 어디에 펴 주라는 것인지.'],
    ['안나', '레프는 책을 못 팔아서 돈을 못 준다지요. 내가 기운 외투는 벌써 입고 다니던데. 책은 못 나갔어도 그 양반은 날마다 문밖으로 나가오.'],
    ['폴리나', '나도 수요일이면 이자를 낸다. 집주인한테는 그 말이 참 쉬운데, 네 앞에서 하려니 입이 떨어지지 않는구나.'],
    ['안나', '주인이 묻거든 내가 아직 그 방에 산다고 해 줘요. 마리야는 서서 신 한 짝도 못 신는 사람인데 오늘 밤 어디로 보냅니까.'],
  ],
  V47_MAIN01_A08: [
    ['파벨', '인쇄소 끈이 수레 뒤에 끌렸소. 차양이 내려와 누가 몰았는지는 못 봤지만, 바퀴가 돌을 때릴 때 한 짝만 덜컹거렸지요.'],
    ['레프', '운하엔 부도치니크가 나왔소. 사람 먼저 세우고 짐은 그 다음이었어. 이 젖은 길을 뛰다가 자네가 먼저 넘어지면 누가 자네 몫을 달라고 해 주나?'],
    ['파벨', '그때는 주인 잃은 짐인 척할 참이었소. 네프스키 쪽이 막혔다면 책방 뒤 작은 문까지는 돌아갈 수 있어요.'],
  ],
  V47_MAIN01_A10: [
    ['바실리', '다리야, 내 모자를 본 적 있소? 됐소, 책부터 내주오. 파벨이 네프스키 끝에서 기다린다오. 내일은 그 가게 뒷문마저 닫힐 테니.'],
    ['다리야', '모자는 거기 있어요. 이리 와서 이 사람 손이나 받쳐요. 숨이 올 때마다 제 손이 내려가니 혼자서는 못 받치겠소.'],
    ['마르파', '센나야에서 언니하고 생선을 팔아요. 인쇄소에서 못 쓰는 종이가 있으면 좀 사려 했는데요. 신 한 짝 떨어진 건 못 보셨소? 내일은 언니가 신고 나가야 해요.'],
    ['다리야', '주소만 일러 줘요. 신은 내가 찾아 보낼게요.'],
    ['마르파', '고맙소. 그리고 나는 병원에 가겠어요. 아까부터 내가 죽으면 어쩌는지는 다들 묻던데, 아직 내게 물으실 것도 있잖소.'],
    ['바실리', '다리야, 마부가 맡은 건 책 한 짐이었소. 이분이 가다가 죽으면 아버님은 그자에게 왜 태웠느냐고 물으실 거요.'],
    ['소피야', '손을 받으라는데 어른 이름부터 꺼내시는군. 그 어른 댁 정문에 들어갈 줄 아는 사람은 여기 당신뿐입니까?'],
    ['바실리', '내일 아버님이 나를 용서하실 때면 저 사람은 문밖일 거요. 우리 집에선 죄를 용서하는 데 자리가 두 개 듭니다. 하나는 차 마실 자리요. 하나는 짐을 쌀 자리지.'],
    ['알렉세이', '그럼 이 집에 처음 들어온 사람을 불러 주십시오. 부도치니크가 문 앞에 왔습니다. 마부도 들이라 하시고요.'],
    ['다리야', '짐수레가 큰길 어귀를 가로막았습니다. 안뜰 옆 대문은 열려 있어요. 거기 있는 마차는 한 대요.'],
    ['마부', '나리, 그 댁 정문은 제가 열어 드리오. 내 이름을 부르는 건 언제나 부엌 쪽인데. 아침에 어디로 오실 겁니까?'],
    ['알렉세이', '내가 정문으로 먼저 가겠네. 이분도 들으셨으니 내일 문 안에서 자네 이름을 부르거든 내 이름부터 대게.'],
    ['산파 아브도티야', '못 믿겠거든 스테판, 내 외투를 이리나에게 맡겨요. 그 삯으로 큰길에서 다른 마차를 부릅시다.'],
  ],
  V47_MAIN01_A11: [
    ['편집자 소피야', '《동시대인》에서 구독자들에게 편지를 보냈어요. 인쇄된 연감을 우리 손으로 못 내놓았다고. 아침부터 사람을 기다리고는 있는데 책을 달라 할까 보아 자꾸 문간으로 나가 보게 되는군요.'],
    ['예카테리나', '스테판, 솜씨 좋은 손을 언제까지 남이 서라는 데 세워 둘 거니. 가서 의자를 가져오렴. 오늘은 네 입에서 내일 일을 듣자.'],
    ['스테판', '어머니께 러시아가 달라지면 무얼 하시겠냐 물었지요. 자기 부엌에서 남들보다 한 시간 늦게 일어나고 싶다 하셨소.'],
    ['알렉세이', '어디로 가고 싶다는 말씀은 않으셨니?'],
    ['스테판', '나갈 날은 일어나서 정하면 되는데 어찌 밤부터 그걸 정하느냐고 하십디다.'],
  ],
  V47_MAIN03_P01: [
    ['소피야', '바실리 씨, 외투부터 벗으세요. 어깨가 다 젖었네요.'],
    ['바실리', '서점에서 선언문을 읽느라 늦었어요. 프랑스 일을 “반란과 무질서”라고 부르더군요.'],
    ['소피야', '바실리, 그 선언문에서 어떤 말이 제일 걸렸어요?'],
    ['바실리', '“반란과 무질서”요. 그렇게만 부르면 사람들이 왜 거리로 나왔는지는 사라지잖아요.'],
    ['소피야', '여기선 끝까지 들어볼게요. 길에서도 같은 말을 할 수 있을지는 사람마다 다르겠지요.'],
  ],
  V47_MAIN03_P02: [
    ['바실리', '레프 씨, 여기 푸리에라는 이름이 나와요. 사회를 새로 짜면 삶이 달라진다는데, 이 책 좀 빌릴 수 있을까요?'],
    ['레프', '빌려줄 순 있소. 하지만 그런 체계가 우리 가게 월세까지 내주진 않지.'],
    ['류보프', '그럼 책에서 말하는 변화가 사람들 하루 일과에 어떻게 닿는지 읽어 봅시다. 누구의 일을 덜고, 누구의 몫을 바꾸는지요.'],
    ['바실리', '좋아요. 수업에 가져가서 읽을지, 이 대목만 베껴 둘지 정하겠습니다.'],
  ],
  V47_MAIN03_P03: [
    ['페트라솁스키', '공동 노동이라 한다면 먼저 묻고 싶습니다. 집세와 식량은 누가 얼마나 내야 합니까?'],
    ['바실리', '일할 수 있는 사람부터 맡으면 되지 않을까요? 가진 돈이 적어도 함께 지낼 수 있고요.'],
    ['안드레이', '말은 쉽소. 땅과 집을 가진 사람에게 무엇을 내놓으라는 건지부터 정해야 하오.'],
    ['예카테리나', '내가 걱정하는 건 종이 위의 약속이 아니에요. 일한 만큼 받는 돈을 누가 보장하죠?'],
    ['페트라솁스키', '좋습니다. 집세와 식량부터 나눠 봅시다. 바실리, 가진 돈이 없는 사람은 어디서부터 함께할 수 있습니까?'],
  ],
  V47_MAIN03_P04: [
    ['엘리자베타', '이 초대장을 파벨 씨가 전해도 괜찮겠어요? 봉투에 모임 장소까지 적혀 있어요.'],
    ['파벨', '배달은 하겠소. 다만 길에서 누가 받았는지 묻는다면, 내가 아는 건 봉투를 건넨 사람뿐이오.'],
    ['바실리', '금요일에 가고 싶습니다. 가서 듣기만 할지, 책을 가져갈지도 정해야겠군요.'],
    ['엘리자베타', '그럼 먼저 초대장을 돌려드릴지, 파벨 씨에게 맡길지 말해 주세요.'],
  ],
  V47_MAIN03_P05: [
    ['도스토옙스키', '그 편지는 제가 읽었습니다. 읽었다고 해서 모든 글자에 제 이름을 썼다는 뜻은 아니겠지요.'],
    ['바실리', '하지만 그 대목에서 다들 박수를 쳤습니다.'],
    ['페트라솁스키', '박수는 들었소. 누구 말에 동의했는지는 직접 물어보았소?'],
  ],
  V47_MAIN03_P06: [
    ['안토넬리', '그쪽에서 웃던 사람이 누군지 보셨습니까?'],
    ['이반', '모임엔 들어가지 않았습니다. 나오는 사람만 봤어요.'],
    ['안토넬리', '그 방 안에서 무슨 말이 오갔는지는 못 들으셨겠군요.'],
  ],
  V47_MAIN03_P07: [
    ['유리', '이 명령은 오늘 접수됐습니다. 보고서 묶음은 작성 날짜가 서로 다르군요.'],
    ['알렉세이', '접수 날짜만 보고 한꺼번에 쓴 문서처럼 정리하면 안 되겠어요. 작성자와 날짜를 따로 확인하죠.'],
    ['리프란디', '명령서의 이름과 보고에 적힌 이름은 대조하십시오. 확인하지 못한 내용은 덧붙이지 마시오.'],
    ['콘스탄틴', '먼저 문서철을 분리할지, 열람한 이름을 개인 메모에 남길지 정합시다.'],
  ],
  V47_MAIN03_P09: [
    ['유리', '수취 명부에 바실리 이름이 있는데, 이 서명은 그가 쓴 글씨가 아닙니다.'],
    ['이반', '내가 본 건 봉투를 받은 사람이오. 이름을 적는 순간은 보지 못했소.'],
    ['알렉세이', '그럼 수취표와 목격을 맞춰 봅시다. 틀린 이름을 고칠지, 원본을 그대로 둘지 결정해야 해요.'],
  ],
  V47_MAIN03_P10: [
    ['이반', '현장에선 사람들 얼굴을 확인했소. 무슨 말을 했는지까지 적을 근거는 없었소.'],
    ['알렉세이', '그럼 목격 메모는 보고서와 따로 붙이겠습니다. 날짜와 누가 썼는지도 적고요.'],
    ['콘스탄틴', '상급 부서가 기다리고 있습니다. 메모를 부록으로 보낼지, 보고부터 먼저 보낼지 정하십시오.'],
  ],
  V47_MAIN03_P11: [
    ['바실리', '광장에 서 있던 사람들은 다들 말이 없었어요. 누군가는 가족을 찾고 있었고요.'],
    ['파벨', '여기 더 머물면 안 되겠소. 바람도 매섭고, 기다리는 사람들을 먼저 안쪽으로 모읍시다.'],
    ['소피야', '오늘 본 일을 남기더라도, 그 자리의 사람들 이름까지 허락 없이 적진 말아요.'],
    ['바실리', '가족들을 데려갈까요, 아니면 내가 본 일만 따로 적어 둘까요?'],
  ],
  V47_MAIN05_C05: [
    ['미하일 의사', '지난밤엔 몇 번이나 쓰러졌습니까?'],
    ['미하일 세입자', '두 번입니다. 냉기를 쐰 게 탈이 났다는 사람도 있고… 물장수를 의심하는 이도 있어요.'],
    ['미하일 의사', '어느 말도 지금은 그대로 병 이름이 되지 않습니다. 동생이 마신 물을 가져오시죠. 적어도 무엇이 있었는지는 알아야 합니다.'],
  ],
  V47_MAIN05_C06: [
    ['주민', '저 사람이 오는 골목마다 사람들이 쓰러진다더군요!'],
    ['루카', '제가 들어간 집은 전부 아픈 집이었습니다. 아프니까 물을 더 부른 겁니다!'],
    ['경찰 이반', '비켜 주십시오. 직접 본 사람이 먼저 이야기하십시오.'],
    ['안나', '물통보다 사람들을 먼저 보세요. 누구네 집에서 처음 아팠는지 제가 알아요.'],
  ],
  V47_MAIN05_C03: [
    ['야코프', '이 양은 병원에서 전부 주문했습니다. 남은 건 많지 않군요.'],
    ['아브도티야', '병원 말고 바로 뒤 하숙집에도 아픈 사람이 둘이에요.'],
    ['야코프', '그분들이 돈을 못 내시는 건 압니다. 하지만 전 물건을 또 들여와야 해요.'],
  ],
  V47_MAIN05_C11: [
    ['이리나', '어제까진 저녁마다 소란스러웠는데, 오늘은 숟가락 부딪히는 소리도 없네요.'],
    ['안나', '문이 열리면 손님이 돌아올 거예요. 하지만 지금은 그 방에 누가 남아 있죠?'],
  ],
};
for (const beatData of v47StoryBeats) {
  if (scriptedDialogue[beatData.id]) {
    beatData.dialogue = scriptedDialogue[beatData.id].map(([speakerKo, lineKo]) => ({ speakerKo, lineKo }));
    beatData.dialogueStatus = 'NEWLY_AUTHORED_FROM_V47_SCENARIO';
  }
}

export function toV47StoryQuests() {
  return v47StoryBeats.map(beatData => {
    const chapterId = beatData.date <= '1848-12-31' ? 'V33_1848_PUBLIC'
      : beatData.date <= '1849-05-04' ? 'V33_1849_PRELUDE' : 'V33_1849_CIRCLE';
    return {
      ...beatData,
      prerequisiteQuestIds: beatData.prerequisiteQuestIds,
      titleKo: beatData.titleKo,
      chapterId,
      premiseKo: beatData.storyId === 'MAIN01' ? beatData.sourceContextKo : beatData.objectiveKo,
      storyContextKo: beatData.sourceContextKo,
      actions: beatData.actions,
      optionalStoryBeat: true,
    };
  });
}

export function attachV47StoryBeatObjects(maps, quests) {
  for (const quest of quests) {
    const map = maps[quest.entry?.mapId], layer = map?.layers?.find(item => item.name === 'Interactions')
      ?? map?.layers?.find(item => item.type === 'objectgroup');
    if (!map || !layer) throw new Error(`V47 beat has no physical map layer: ${quest.id}`);
    if ((layer.objects ?? []).some(object => object.id === quest.entry.objectId)) continue;
    const collision = map.layers.find(item => item.name === 'Collision')?.data ?? [];
    const reachable = walkableTilesReachableFromArrivals(map.mapId, maps);
    const npcTiles = new Set((map.layers.find(item => item.name === 'NPCs')?.objects ?? []).map(npc =>
      `${Math.floor(npc.x / map.tilewidth)},${Math.floor(npc.y / map.tileheight)}`));
    const occupied = map.layers.flatMap(item => item.objects ?? []).map(object => ({
      x: Math.floor(object.x / map.tilewidth), y: Math.floor(object.y / map.tileheight),
    }));
    const walkable = (x, y) => x >= 1 && y >= 1 && x < map.width - 1 && y < map.height - 1
      && collision[y * map.width + x] === 0 && !npcTiles.has(`${x},${y}`);
    const candidates = [];
    for (let y = 1; y < map.height - 1; y += 1) for (let x = 1; x < map.width - 1; x += 1) {
      if (walkable(x, y) && reachable.has(`${x},${y}`)
        && !occupied.some(point => Math.abs(point.x - x) + Math.abs(point.y - y) <= 2)
        && [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([nx, ny]) => walkable(nx, ny))) {
        candidates.push({ x, y });
      }
    }
    if (!candidates.length) throw new Error(`V47 beat map has no walkable interaction point: ${quest.id}`);
    let tile;
    if (quest.id === 'V47_MAIN01_A03') {
      const source = layer.objects.find(object => object.type === 'source'
        && (object.properties ?? []).some(property => property.name === 'sourceId' && property.value === 'V47-PANAEVA-TALNIKOV-CH1-1848'));
      if (source) {
        const sourceTile = { x: Math.floor(source.x / map.tilewidth), y: Math.floor(source.y / map.tileheight) };
        const occupiedElsewhere = map.layers.flatMap(item => item.objects ?? []).filter(object => object !== source)
          .map(object => ({ x: Math.floor(object.x / map.tilewidth), y: Math.floor(object.y / map.tileheight) }));
        tile = [[sourceTile.x + 1, sourceTile.y], [sourceTile.x - 1, sourceTile.y],
          [sourceTile.x, sourceTile.y + 1], [sourceTile.x, sourceTile.y - 1]]
          .map(([x, y]) => ({ x, y }))
          .find(point => walkable(point.x, point.y) && reachable.has(`${point.x},${point.y}`)
            && occupiedElsewhere.every(occupied => Math.abs(occupied.x - point.x) + Math.abs(occupied.y - point.y) > 2));
      }
    }
    tile ??= candidates[quest.entry.objectId % candidates.length];
    layer.objects ??= [];
    layer.objects.push({ id: quest.entry.objectId, name: quest.titleKo, type: 'quest-object',
      x: tile.x * map.tilewidth, y: tile.y * map.tileheight, width: map.tilewidth, height: map.tileheight, visible: true,
      properties: [{ name: 'questId', type: 'string', value: quest.id }, { name: 'actionId', type: 'string', value: 'OPEN' }] });
    map.nextobjectid = Math.max(map.nextobjectid ?? 1, quest.entry.objectId + 1);
  }

  // The subscriber's November 1848 letter is a core MAIN01 document. Keep it
  // as a physical, date-gated object in the printshop so the A11 scene can be
  // played from the source itself rather than only through an abstract quest.
  const subscriberLetter = 'V47-NEKRASOV-SUBSCRIBER-LETTER-1848';
  const printshop = maps.printshop;
  const interactionLayer = printshop?.layers?.find(item => item.name === 'Interactions');
  const alreadyPlaced = interactionLayer?.objects?.some(object => (object.properties ?? [])
    .some(property => property.name === 'sourceId' && property.value === subscriberLetter));
  if (printshop && interactionLayer && !alreadyPlaced) {
    const collision = printshop.layers.find(item => item.name === 'Collision')?.data ?? [];
    const reachable = walkableTilesReachableFromArrivals('printshop', maps);
    const npcTiles = new Set((printshop.layers.find(item => item.name === 'NPCs')?.objects ?? []).map(npc =>
      `${Math.floor(npc.x / printshop.tilewidth)},${Math.floor(npc.y / printshop.tileheight)}`));
    const occupied = printshop.layers.flatMap(item => item.objects ?? []).map(object => ({
      x: Math.floor(object.x / printshop.tilewidth), y: Math.floor(object.y / printshop.tileheight),
    }));
    const preferred = { x: 14, y: 12 };
    const candidates = [];
    for (let y = 1; y < printshop.height - 1; y += 1) for (let x = 1; x < printshop.width - 1; x += 1) {
      if (collision[y * printshop.width + x] !== 0 || !reachable.has(`${x},${y}`) || npcTiles.has(`${x},${y}`)) continue;
      if (occupied.some(point => Math.abs(point.x - x) + Math.abs(point.y - y) <= 2)) continue;
      candidates.push({ x, y, distance: Math.abs(preferred.x - x) + Math.abs(preferred.y - y) });
    }
    candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
    const tile = candidates[0];
    if (!tile) throw new Error('No reachable physical tile for the MAIN01 subscriber letter');
    const id = Math.max(printshop.nextobjectid ?? 1, ...printshop.layers.flatMap(item => (item.objects ?? []).map(object => object.id + 1)));
    interactionLayer.objects.push({ id, name: '《동시대인》 편집부가 구독자에게 보낸 편지', type: 'source',
      x: tile.x * printshop.tilewidth, y: tile.y * printshop.tileheight,
      width: printshop.tilewidth, height: printshop.tileheight, visible: true,
      properties: [
        { name: 'sourceId', type: 'string', value: subscriberLetter },
        { name: 'scope', type: 'string', value: 'public' },
        { name: 'availableChapterId', type: 'string', value: 'V33_1848_PUBLIC' },
        { name: 'availableDate', type: 'string', value: '1848-11-29' },
      ] });
    printshop.nextobjectid = id + 1;
  }
}

// Full graph index for integration/coverage audits. Existing seven authored
// beats remain owned by v47-main-stories.mjs and must not be merged twice.
export const v47StoryBeatIds = {
  MAIN01: ['A00', 'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10', 'A11'],
  MAIN03: ['P00', 'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10', 'P11'],
  MAIN05: ['C00', 'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11'],
};

export const v47PreviouslyAuthoredBeatIds = {
  MAIN01: ['A00', 'A06', 'A09'],
  MAIN03: ['P00', 'P08'],
  MAIN05: ['C00', 'C02'],
};
