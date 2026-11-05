import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const actionDefinitions = {
  apothecary_yakov: [[420,'APOTHECARY_CHECK_STOCK','재고 대조','약병과 꾸러미 수를 확인해 약방 재고표의 빈칸을 채운다'],[960,'APOTHECARY_CLOSE_ACCOUNTS','약방 장부','남은 재고와 미수금 항목을 나눠 마감 메모를 남긴다']],
  baker_fyodor: [[780,'BAKER_PREPARE_DOUGH','제빵 생산','오븐에 넣을 반죽을 나눠 굽기 순서를 적는다','반죽 한 몫'],[1020,'BAKER_CLOSE_BAKERY','제빵 마감','남은 밀가루와 오늘 주문의 인수 여부를 장부에 맞춘다']],
  bookbinder_elizaveta: [[420,'BOOKBINDER_SEW_SIGNATURES','제본 작업','속장을 꿰매고 실이 느슨한 쪽을 다시 고정한다','제본 중인 책 한 권'],[780,'BOOKBINDER_DELIVERY_REGISTER','제본 인수','책방에 보낼 묶음의 수와 인수 시각을 기록한다']],
  bookseller_lev: [[540,'BOOKSELLER_SORT_STOCK','서점 재고','책과 잡지를 주제별로 나누고 가판 목록을 고친다'],[660,'BOOKSELLER_RESERVATION_LEDGER','예약 관리','예약한 독자의 이름과 인도 순서를 장부에 대조한다']],
  carter_roman: [[420,'CARTER_LOAD_MANIFEST','운송 적재','시장 창고의 종이 묶음 수와 마차 적재 순서를 기록한다'],[780,'CARTER_QUAY_FREIGHT_TALLY','운임 정산','부두에서 받은 짐의 수량과 운송표를 맞춘다']],
  clerk_alexei: [[540,'CLERK_REGISTER_INTAKE','관청 접수','접수 문서의 번호와 도착 시각을 접수부에 적는다'],[660,'CLERK_COMPARE_ORIGINALS','원본 대조','접수부와 원본의 이름·쪽수를 한 줄씩 대조한다']],
  coachman_timofey: [[480,'COACHMAN_CHECK_FARE_BOARD','마차 운송','운임표와 마차 상태를 확인해 오늘 운행표에 표시한다'],[840,'COACHMAN_ROUTE_CONDITION','노상 운송','강변 길의 통행 상태와 바퀴 점검 결과를 운행 메모에 적는다']],
  courier_pavel: [[600,'COURIER_SORT_ROUTE','우편 분류','받을 사람과 전달 순서에 따라 봉투를 가방 칸에 나눈다'],[660,'COURIER_RETURN_RECEIPT','우편 인계','빈 가방과 전달 확인표를 우편 접수 담당에게 돌려준다']],
  editor_sofia: [[540,'EDITOR_ANNOTATE_PROOF','편집 교정','교정쇄에 출처와 날짜가 빠지지 않았는지 표시한다'],[840,'EDITOR_REPLY_REGISTER','편집 회신','들어온 원고의 수신인과 답장을 보낼 시각을 정리한다']],
  fishseller_klavdiya: [[420,'FISHSELLER_RECEIVE_CATCH','시장 판매','강변에서 들어온 생선의 수량과 받은 시각을 적는다','생선 좌판 한 몫'],[780,'FISHSELLER_STOCK_TALLY','시장 재고','좌판에 남은 물량과 보관 시간을 비교해 손실을 기록한다']],
  housemaid_olga: [[420,'HOUSEMAID_PREPARE_WATER','가사 노동','물과 마른 걸레를 챙기고 맡은 방의 청소 순서를 정한다'],[960,'HOUSEMAID_CLOSE_ERRANDS','가사 심부름','저녁에 필요한 물품과 끝내지 못한 심부름을 구분해 적는다']],
  innkeeper_irina: [[420,'INNKEEPER_PREPARE_ROOMS','여관 운영','빈방과 식사 준비를 확인해 손님 명부를 갱신한다'],[960,'INNKEEPER_EVENING_REGISTER','여관 접수','저녁 손님의 이름과 빈자리 수를 접수 장부에 맞춘다']],
  junior_guard_sergey: [[420,'GUARD_CHECK_VISITOR_PASSES','출입 감독','방문증과 방문 목적을 대조해 출입 기록을 남긴다'],[960,'GUARD_HANDOVER_REGISTER','당직 인계','허가된 방문과 대기 인원을 교대 목록에 맞춘다']],
  landlady_polina: [[420,'LANDLADY_COMPARE_RENT','셋방 관리','방세와 공동 장작 비용을 따로 장부에 적는다'],[960,'LANDLADY_CLOSE_SHARED_COSTS','셋방 정산','세입자별 공동 지출과 아직 합의되지 않은 항목을 구분한다']],
  laundress_mariya: [[420,'LAUNDRESS_WASH_LINEN','세탁 노동','린넨을 물에 담그고 세탁물마다 맡긴 사람을 표시한다','접은 린넨 한 벌'],[780,'LAUNDRESS_RECONCILE_PAYMENTS','세탁 정산','받은 세탁값과 아직 받지 못한 값을 장부에서 나눈다']],
  lodging_tatyana: [[420,'LODGING_SEWING_ORDER','재봉 작업','수선할 옷감의 손상 부위와 납기 순서를 적는다','수선 중인 옷감 한 벌'],[840,'LODGING_RETURN_BOOK_AND_TOOLS','대여품 관리','빌린 책의 반납과 수선 도구의 인수 여부를 기록한다']],
  market_nadezhda: [[480,'MARKET_CHECK_SCALE','시장 좌판','저울과 채소 꾸러미의 상태를 확인해 좌판 목록을 고친다'],[780,'MARKET_SETTLE_BREAD_ORDER','시장 거래','빵집에 넘긴 채소와 젖은 물량의 값을 정산한다','채소 꾸러미 한 몫']],
  midwife_avdotya: [[420,'MIDWIFE_PREPARE_CALL','산파 방문','호출 시각과 가져갈 물품을 방문 순서표에 적는다'],[960,'MIDWIFE_CLOSE_VISITS','돌봄 기록','방문 순서와 아직 확인하지 못한 비용을 구분해 기록한다']],
  minor_noble_andrei: [[600,'NOBLE_PREPARE_PAPERS','개인 서류','면담에 필요한 서류와 약속 어음의 날짜를 대조한다'],[960,'NOBLE_REVIEW_PAYMENT_DATE','채무 관리','늦어진 지급 날짜를 다시 확인해 가족 지출표에 적는다']],
  police_sergeant_ivan: [[540,'POLICE_COMPARE_WITNESS_STATEMENTS','경찰 기록','신고 장부의 목격자 진술과 접수 시각을 대조한다'],[720,'POLICE_SORT_EVIDENCE_REGISTER','경찰 기록','진술서와 압수 목록을 섞이지 않게 별도 묶음으로 정리한다']],
  porter_gavrila: [[780,'PORTER_RECORD_LOAD_AND_FEE','짐 운반','짐의 무게와 합의한 품삯을 운송표에 적는다'],[840,'PORTER_TRANSFER_FLOUR_SACKS','짐 운반','밀가루 포대를 빵집 안으로 옮기고 인수표를 받아 둔다','인수 확인표 한 장']],
  print_apprentice_stepan: [[420,'APPRENTICE_SELECT_TYPE','인쇄 견습','교정에 필요한 활자를 찾아 조판대에 모아 둔다','교정용 활자 묶음'],[960,'APPRENTICE_ORDER_WORK','인쇄 견습','교정표와 다음 작업 순서를 인쇄소 장부에 정리한다']],
  printer_ekaterina: [[540,'PRINTER_MARK_PROOF','인쇄 교정','교정쇄의 날짜·출처·오자를 표시한다','수정 표시가 된 교정쇄'],[660,'PRINTER_RECONCILE_COST','인쇄 회계','활자 정리와 인쇄비 항목을 주문 장부에 맞춘다']],
  reader_darya: [[540,'READER_COMPARE_NEW_PRINT','독서 기록','새로 나온 글에서 확인할 문장과 질문을 독서 수첩에 적는다'],[1020,'READER_RETURN_PROOF','자료 반환','빌린 교정쇄를 돌려주고 다음에 읽을 쪽을 장부에 남긴다']],
  scribal_yuri: [[420,'SCRIBAL_PREPARE_COPY','필사 작업','원본과 베낄 종이를 나누고 필사 순서를 표시한다'],[960,'SCRIBAL_COMPARE_COPIES','필사 검토','원본과 사본의 다른 글자를 한 줄씩 대조한다']],
  seamstress_anna: [[540,'SEAMSTRESS_FIND_ORDER','수선 노동','맡길 옷과 수선 기한을 확인해 작업 순서를 적는다'],[660,'SEAMSTRESS_PRICE_REPAIR','수선 정산','수선한 소매의 값과 아직 남은 손질을 주문표에 적는다','수선 완료한 소매 한 점']],
  senior_clerk_konstantin: [[540,'SENIOR_CLERK_REVIEW_MEMO','관청 검토','검토 메모와 결재 문서를 서로 다른 묶음으로 나눈다'],[840,'SENIOR_CLERK_COMPARE_STATEMENT','관청 검토','경찰 연락실 진술서의 접수 날짜와 서명을 대조한다']],
  servant_varvara: [[420,'SERVANT_PREPARE_CLEANING','가사 노동','청소할 방과 먼저 전할 집안 지시를 순서대로 적는다'],[960,'SERVANT_CLOSE_ERRANDS','가사 심부름','전달한 말과 남은 심부름을 주인집 메모에 나눠 둔다']],
  street_vendor_matryona: [[420,'VENDOR_OPEN_STALL','거리 행상','날씨와 통행량을 보고 좌판에 펼 물건을 고른다','솔과 생활용품 꾸러미'],[960,'VENDOR_CLOSE_STOCK','거리 행상','하루 매상과 비에 젖은 재고를 따로 기록한다']],
  student_vasily: [[420,'STUDENT_FIND_READING','학생 독서','서점에서 읽을 책을 고르고 확인할 질문을 수첩에 적는다'],[960,'STUDENT_RETURN_BOOK','학생 독서','책을 반납하고 다음 모임에 가져갈 쪽을 메모한다']],
  teacher_lyubov: [[420,'TEACHER_PREPARE_LESSON','수업 준비','수업할 글과 학생별 연습 분량을 준비한다'],[960,'TEACHER_REVIEW_EXERCISES','수업 정리','학생별 연습 종이를 확인하고 다음 수업의 분량을 정한다']],
  tenant_mikhail: [[660,'TENANT_SEEK_DAY_WORK','품일 찾기','강변 장터에서 오늘 맡을 짐일과 시작 시각을 확인한다'],[840,'TENANT_RESERVE_RETURN_FARE','품삯 관리','오늘 받은 일감과 귀가에 남겨 둘 돈을 개인 장부에 적는다']],
  typesetter_nikita: [[420,'TYPESETTER_SET_LINES','활자 작업','인쇄할 줄의 활자를 맞추고 빠진 글자를 보충한다'],[840,'TYPESETTER_MARK_PROOF_ERRORS','활자 교정','교정쇄의 오자를 표시해 재인쇄할 줄을 정리한다']],
  warehouse_pyotr: [[420,'WAREHOUSE_CHECK_INTAKE','창고 관리','입고표와 물품 번호를 대조해 창고 장부를 갱신한다'],[960,'WAREHOUSE_CLOSE_STOCK','창고 관리','남은 물량과 비어 있는 장부 칸을 다시 확인한다']],
  watercarrier_luka: [[420,'WATERCARRIER_FILL_PAIL','물 운반','물동이를 채우고 안뜰의 배달 순서를 확인한다','물동이 한 개'],[780,'WATERCARRIER_PLAN_DELIVERIES','물 운반','물통을 채울 순서와 안뜰까지의 운반량을 기록한다']],
  yardkeeper_semyon: [[480,'YARDKEEPER_OPEN_AND_COUNT_WOOD','안뜰 관리','안뜰 문을 열고 공동 장작의 남은 수량을 센다'],[840,'YARDKEEPER_RECONCILE_WOOD','안뜰 관리','작업 뜰 장작 수량을 세입자 장부와 대조한다']],
};

const files = (await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json'));
const residents = new Map();
for (const file of files) {
  const card = JSON.parse(await readFile(path.join(root, 'rpg/characters', file), 'utf8'));
  if (card.kind === 'FICTIONAL' && !card.id.startsWith('literary_')) residents.set(card.id, { file, card });
}
assert.equal(residents.size, 36, 'work-action rollout targets exactly the 36 active city residents');
assert.deepEqual([...residents.keys()].sort(), Object.keys(actionDefinitions).sort(), 'each active resident needs authored job actions');
const allIds = [];
const allOutputs = [];
for (const [hostId, definitions] of Object.entries(actionDefinitions)) {
  assert.equal(definitions.length, 2, `${hostId} needs two distinct job actions`);
  const { file, card } = residents.get(hostId);
  for (const [atMinute, id, outputKind, outputKo, inventoryItemKo] of definitions) {
    const slot = card.schedule.find(item => item.atMinute === atMinute);
    assert.ok(slot, `${hostId} has authored schedule slot ${atMinute}`);
    assert.ok(!slot.task || ['DELIVER','EXCHANGE','CONSUME'].includes(slot.task.type), `${hostId} existing task remains intact`);
    slot.workAction = { id: `V36_${id}`, outputKind, outputKo, durationMinutes: 20, ...(inventoryItemKo ? { inventoryItemKo } : {}) };
    allIds.push(slot.workAction.id);
    allOutputs.push(outputKo);
  }
  await writeFile(path.join(root, 'rpg/characters', file), `${JSON.stringify(card, null, 2)}\n`, 'utf8');
}
assert.equal(new Set(allIds).size, 72, 'all authored work actions have unique stable IDs');
assert.equal(new Set(allOutputs).size, 72, 'each authored work action has its own output description');
console.log(JSON.stringify({ status: 'GENERATED', residents: residents.size, authoredWorkActions: allIds.length,
  distinctOutputs: new Set(allOutputs).size, wagesInvented: false }, null, 2));
