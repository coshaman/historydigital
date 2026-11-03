import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const residents = Object.fromEntries(await Promise.all(['editor_sofia','police_sergeant_ivan','reader_darya','housemaid_olga','midwife_avdotya','junior_guard_sergey'].map(async id => [id, JSON.parse(await fs.readFile(path.join(root, `rpg/characters/${id}.json`), 'utf8'))])));
const chains = [
  {
    host:'editor_sofia', map:'printshop', id:'SOFIA_MISSING_RECEIPTS_1847', title:'도착하지 않은 신문 묶음', other:'courier_pavel', metric:'distributionTrust', prerequisite:'EDITOR_PUBLICATION_RECORD_1847',
    stages:[
      ['반송된 신문 묶음 메모','가판대에 약속한 신문이 오지 않았다. 소피아는 인쇄가 늦었는지 전달 중 문제가 생겼는지 먼저 가려야 한다.',[['인쇄 완료 시각부터 확인한다','편집부와 인쇄소가 압니다 · 작업 시각표에 확인 시각이 남습니다 · 배달 지연 여부는 더 늦게 알 수 있습니다','인쇄가 끝난 시각부터 확인하기로 했다. 도착이 늦었다고 인쇄소에 바로 책임을 돌리진 않았다.','pressTime',1],['배달원이 확인한 경로를 묻는다','소피아와 배달원이 압니다 · 개인 확인 쪽지에 남습니다 · 오늘 호의 배포가 더 늦어질 수 있습니다','배달원이 직접 확인한 구간부터 물었다. 길에서 보지 못한 일은 단정하지 않기로 했다.','routeAsked',2],['누락 호수를 편집부 공고에 적는다','편집부와 구독자가 봅니다 · 배포 공고에 누락 호수가 남습니다 · 확인 전에 인쇄소가 비난받을 수 있습니다','누락된 호수를 공고에 알렸다. 독자에게는 상황이 보이지만 원인은 아직 확인되지 않았다.','publicNotice',0]]],
      ['독자에게 보낼 정정 안내','인쇄 시각과 배달 경로를 확인했다. 소피아는 독자에게 어디까지 알릴지 정해야 한다.',[['확인된 도착 시각과 미수령 지역만 알린다','해당 가판대와 구독자가 봅니다 · 정정 안내에 확인 범위가 남습니다 · 원인 설명은 뒤로 미뤄집니다','도착 시각과 확인된 미수령 지역만 알렸다. 독자가 기다릴 정보는 주고 원인은 보태지 않았다.','limitedNotice',2],['배달 지연 가능성을 편집부 책임으로 공지한다','편집부와 독자가 봅니다 · 공식 안내에 책임 범위가 남습니다 · 사실과 다르면 소피아가 설명해야 합니다','편집부가 확인을 맡겠다고 공지했다. 독자에게 답할 창구는 생겼지만 원인이 확정된 것은 아니다.','editorTakesCharge',1],['원인을 밝힐 때까지 공지를 보류한다','편집부만 압니다 · 내부 확인 메모에 보류가 남습니다 · 독자가 재발송 일정을 알지 못합니다','원인을 확인할 때까지 공지를 미뤘다. 추측은 줄었지만 독자는 기다릴 수밖에 없다.','holdNotice',0]]],
      ['재발송과 비용 처리 기록','빠진 신문을 다시 보낼지 비용을 누가 감당할지 정해야 한다.',[['남은 호수를 확인해 필요한 수량만 다시 보낸다','편집부와 수취인이 압니다 · 재발송 대장에 수량이 남습니다 · 인쇄분이 부족하면 다른 가판대 몫이 줄 수 있습니다','필요한 수량만 확인해 다시 보냈다. 모든 가판대를 채우진 못해도 부족분을 숨기지 않았다.','targetedResend',2],['인쇄소와 배달원에게 비용을 나눠 확인한다','편집부·인쇄소·배달원이 압니다 · 비용 검토표에 책임 범위가 남습니다 · 합의가 늦어질 수 있습니다','원인이 확인된 부분부터 비용을 나눠 보기로 했다. 결론은 늦지만 한 사람에게 손실을 먼저 떠넘기지 않는다.','sharedReview',1],['이번 호 손실은 편집부 예비금으로 처리한다','편집부가 압니다 · 지출 장부에 손실이 남습니다 · 다음 호 종이값이 부족할 수 있습니다','이번 손실은 예비금으로 메웠다. 배포는 회복되지만 다음 호 예산은 줄어든다.','reservePays',0]]],
    ],
  },
  {
    host:'police_sergeant_ivan', map:'police-station', id:'IVAN_WITNESS_ACCOUNT_1849', chapter:'V33_1849_CIRCLE', date:'1849-04-22', title:'목격과 전언 사이', other:'junior_guard_sergey', metric:'verifiedAccounts', prerequisite:'POLICE_TESTIMONY_RECORD_1849',
    stages:[
      ['진술의 출처 구분표','접수된 말에는 직접 본 내용과 다른 사람에게 들은 내용이 섞여 있다. 이반은 이름을 적기 전에 출처부터 나눠야 한다.',[['직접 본 사람의 말만 별도 기록한다','진술자와 접수 담당자가 압니다 · 진술서에 직접 목격 범위가 남습니다 · 다른 전언은 확인이 늦어집니다','직접 본 내용만 먼저 적었다. 전해 들은 말을 목격으로 바꾸진 않았다.','directOnly',2],['전해 들은 말은 이름 없이 첨부한다','접수 담당자와 검토자가 압니다 · 익명 참고 메모에 남습니다 · 확인할 사람이 부족할 수 있습니다','전언은 이름을 빼고 참고 메모에 붙였다. 단서는 남지만 사실로 확정하진 않았다.','anonymousRumor',1],['두 내용을 한 진술서에 함께 적는다','접수실과 상급자가 봅니다 · 단일 진술서에 직접 목격과 전언이 함께 남습니다 · 출처가 뒤섞여 책임이 흐려질 수 있습니다','두 종류의 말을 한 서류에 적되 출처를 표시하기로 했다. 읽는 사람이 구분하지 못하면 다시 확인해야 한다.','combinedStatement',0]]],
      ['추가 확인 요청서','출처를 나누자 진술 사이에 시간이 맞지 않는 부분이 보인다. 누가 직접 확인할 수 있는지 정해야 한다.',[['각 진술자에게 시각을 따로 묻는다','진술자와 기록 담당자가 압니다 · 개별 확인표에 답변 시각이 남습니다 · 접수 처리가 늦어질 수 있습니다','각자 기억하는 시각을 따로 확인하기로 했다. 서로의 말을 맞추기 전에 차이를 보존한다.','separateTimes',2],['거리 순찰 기록과 대조한다','접수실과 순찰 담당자가 압니다 · 대조 요청서와 회신이 남습니다 · 기록이 없으면 결론을 못 낼 수 있습니다','순찰 기록에 확인을 요청했다. 자료가 없으면 빈칸을 그대로 둘 생각이다.','patrolCheck',1],['상급자에게 현재 진술만 올린다','상급자가 봅니다 · 검토 상신서에 미확인 부분이 남습니다 · 성급한 판단을 막지만 결정이 늦어집니다','확인하지 못한 시각을 표시해 상급자에게 올렸다. 판단은 넘어가지만 모르는 부분은 숨기지 않았다.','escalateUnclear',1]]],
      ['접수 결과와 보관 범위','진술과 대조 기록을 모았다. 이반은 어떤 사본을 남기고 누구에게 보일지 정해야 한다.',[['이름이 든 원본은 접수실에 두고 요약만 회람한다','접수 담당자와 결재자가 압니다 · 원본 보관표와 요약본이 남습니다 · 요약에서 중요한 맥락이 빠질 수 있습니다','원본은 접수실에 두고 출처 구분을 적은 요약만 돌렸다. 신원 노출은 줄었지만 요약이 전부는 아니다.','restrictedOriginal',2],['진술자 확인을 받은 뒤 관련자에게 사본을 준다','진술자와 지정 수취인이 압니다 · 교부 서명과 사본 번호가 남습니다 · 전달이 늦어질 수 있습니다','진술자가 확인한 사본만 지정된 사람에게 건넸다. 널리 돌리진 않지만 필요한 확인은 가능하다.','signedCopy',1],['모든 이름과 전언을 접수 장부에 공개한다','접수실을 드나드는 담당자들이 봅니다 · 공식 장부에 전체 기록이 남습니다 · 확인되지 않은 말이 당사자를 해칠 수 있습니다','이름과 전언을 장부에 함께 남겼다. 추적은 쉽지만 잘못된 말도 오래 기록된다.','fullRegister',0]]],
    ],
  },
  {
    host:'reader_darya', map:'nevsky', id:'DARYA_READING_CIRCLE_1847', title:'읽을 권리와 책값', other:'bookseller_lev', metric:'sharedReading', prerequisite:'READER_SOURCE_AND_RUMOR_1847',
    stages:[
      ['빌려줄 책과 읽는 순서','몇 사람이 같은 책을 원하지만 책은 한 권뿐이다. 다리야는 읽을 기회를 넓히면서 책을 지킬 방법을 찾아야 한다.',[['돌려 읽을 순서와 기한을 정한다','읽는 사람과 다리야가 압니다 · 대여 쪽지에 순서와 날짜가 남습니다 · 차례가 늦은 사람은 기다려야 합니다','읽을 순서와 날짜를 적었다. 모두가 바로 읽지는 못하지만 누가 다음인지 보이게 했다.','readingQueue',2],['책의 일부를 읽어 서로 베껴 나눈다','모임 참석자가 압니다 · 필사 쪽지에 나눈 부분이 남습니다 · 옮기는 동안 문장이 달라질 수 있습니다','필요한 대목을 나눠 베끼기로 했다. 책은 돌려줄 수 있어도 베껴 쓴 문장은 다시 대조해야 한다.','sharedCopy',1],['대여 보증금을 받고 책을 내준다','다리야와 빌리는 사람이 압니다 · 대여 장부에 보증금이 남습니다 · 돈이 없는 독자는 읽기 어렵습니다','보증금을 받고 책을 내줬다. 책이 돌아올 가능성은 커졌지만 형편이 어려운 사람은 빠질 수 있다.','deposit',0]]],
      ['독서 모임의 질문 목록','책을 읽은 사람마다 같은 문장을 다르게 받아들였다. 다리야는 저자의 뜻을 대신 말하지 않고 질문을 남길 수 있다.',[['해석이 갈린 문장만 나란히 적는다','모임 참석자가 압니다 · 개인 독서 노트에 다른 해석이 남습니다 · 문맥을 놓치면 차이가 과장될 수 있습니다','서로 다르게 읽은 문장만 나란히 적었다. 어느 쪽이 작가의 뜻이라고 단정하진 않았다.','parallelReadings',2],['읽은 쪽과 아직 읽지 못한 쪽의 사정을 함께 적는다','모임 참석자가 봅니다 · 참석·대기 메모에 접근 조건이 남습니다 · 사정이 사적인 사람은 불편할 수 있습니다','누가 읽었고 누가 기다리는지 적었다. 읽을 기회 차이가 보이지만 개인 형편까지 공개되진 않게 조심해야 한다.','accessGap',1],['정답 해석 하나를 골라 모임 기록에 쓴다','참석자와 다음 독자가 봅니다 · 모임 기록에 한 해석이 대표로 남습니다 · 다른 독자의 목소리가 밀릴 수 있습니다','한 해석을 대표 의견으로 기록했다. 읽기는 쉬워져도 다른 생각은 뒤로 밀릴 수 있다.','singleReading',0]]],
      ['책값과 접근 기록','독서 모임은 계속 열 수 있지만 종이와 책을 마련할 돈이 부족하다. 누가 비용을 낼지 정해야 한다.',[['빌려 읽기와 필사 시간을 함께 마련한다','모임과 책 주인이 압니다 · 대여·필사 시간표가 남습니다 · 책 주인이 마모와 시간을 부담합니다','대여와 필사를 나눠 운영하기로 했다. 돈을 덜 쓰는 대신 책 주인과 필사자가 시간을 낸다.','timeContribution',2],['책값을 조금씩 모아 공동으로 산다','모임 참석자가 압니다 · 공동 구매 장부에 낸 금액이 남습니다 · 당장 낼 수 없는 사람은 기다립니다','각자 가능한 만큼 모아 공동 책을 사기로 했다. 함께 소유하지만 모금이 끝날 때까지 기다려야 한다.','sharedPurchase',1],['외상으로 책을 사고 모임원 이름을 장부에 올린다','모임원과 서점 주인이 압니다 · 외상 장부에 이름과 금액이 남습니다 · 갚지 못하면 신뢰를 잃을 수 있습니다','외상으로 책을 들였다. 지금은 읽을 수 있지만 갚을 책임도 모임원에게 남는다.','creditPurchase',0]]],
    ],
  },
  {
    host:'housemaid_olga', map:'courtyard', id:'OLGA_WARNING_AND_RUMOR_1847', title:'들어 들은 말과 확인할 일', other:'servant_varvara', metric:'verifiedWarnings', prerequisite:'HOUSEHOLD_PRIVACY_1847',
    stages:[
      ['집안 경고 쪽지','안뜰에서 누군가 방을 비우라는 말을 들었다고 한다. 올가는 자신이 직접 들은 것과 전해 들은 것을 나눠야 한다.',[['직접 들은 사람에게 말 그대로 확인한다','올가와 당사자가 압니다 · 비공개 확인 쪽지에 들은 문구만 남습니다 · 확인 전까지 대응이 늦어질 수 있습니다','직접 들은 사람에게 표현을 확인하기로 했다. 뜻을 부풀리지 않지만 기다리는 동안 불안은 남는다.','quoteCheck',2],['집주인에게 지시가 있었는지 묻는다','올가와 집주인이 압니다 · 개인 확인 메모에 답변이 남습니다 · 질문한 사람이 의심받을 수 있습니다','집주인에게 방을 비우라는 지시가 있었는지 물었다. 모호한 말을 확인하는 대신 눈에 띄는 위험을 감수한다.','landladyAsk',1],['안뜰 사람들에게 소문을 먼저 알린다','안뜰 주민들이 압니다 · 구두 전달이라 기록은 없습니다 · 잘못 전해지면 누군가를 곤란하게 할 수 있습니다','안뜰에 말을 전했다. 사람들이 대비할 수 있지만 소문이 더 커질 수도 있다.','spreadWarning',0]]],
      ['대비할 사람과 물건','지시는 확인되지 않았지만 몇몇 세입자는 걱정한다. 올가는 필요한 대비를 어디까지 알릴지 정해야 한다.',[['해당 방 사람에게만 준비할 시간을 준다','당사자와 올가가 압니다 · 개인 심부름 메모에 전달 시각이 남습니다 · 다른 세입자는 소식을 늦게 들을 수 있습니다','해당 방 사람에게만 준비 시간을 알렸다. 불안을 넓히진 않았지만 다른 사람은 모른다.','privateNotice',2],['공용 물건과 보관 장소를 점검한다','올가와 안뜰 관리인이 압니다 · 공동 물품 점검표에 수량이 남습니다 · 지시가 없는데 일을 키운다는 말을 들을 수 있습니다','공용 물건과 보관 장소를 확인했다. 피난을 단정하지 않아도 필요한 물건은 찾을 수 있다.','inventoryCheck',1],['아직 확인이 안 됐다고 안뜰 게시판에 쓴다','안뜰 주민이 봅니다 · 게시 메모에 미확인 표시가 남습니다 · 걱정을 키울 수 있습니다','확인되지 않았다고 게시했다. 소문과 사실은 나뉘지만 불안한 사람은 더 늘 수 있다.','uncertaintyPosted',1]]],
      ['확인 결과와 전달 범위','추가 확인에서 방을 비우라는 명령은 찾지 못했다. 올가는 무엇을 기록하고 누구에게 알릴지 선택한다.',[['명령이 확인되지 않았다는 결과만 비공개로 전한다','당사자와 올가가 압니다 · 개인 전달 쪽지에 확인 결과가 남습니다 · 나중에 다른 소문이 돌면 설명이 어렵습니다','명령을 확인하지 못했다는 사실만 당사자에게 전했다. 공포를 낮추되 확인하지 못한 일을 없었다고 말하진 않았다.','privateResult',2],['확인 경로와 미확인 사항을 안뜰 기록에 적는다','관리인과 세입자가 봅니다 · 공동 확인 장부에 문의 경로와 빈칸이 남습니다 · 이름이 드러날 수 있습니다','확인한 경로와 모르는 점을 장부에 나눠 적었다. 다음 사람이 다시 확인할 수 있지만 문의한 사람이 드러난다.','sharedRecord',1],['개인 이름 없이 확인 결과를 구두로 전한다','전해 들은 주민이 압니다 · 이름을 빼고 전달해 공식 기록은 남지 않습니다 · 말이 바뀌어 퍼질 수 있습니다','이름을 빼고 결과를 전했다. 사생활은 지켰지만 말이 다시 옮겨지며 달라질 수 있다.','oralSummary',0]]],
    ],
  },
  {
    host:'midwife_avdotya', map:'courtyard', id:'AVDOTYA_CARE_COSTS_1847', title:'돌봄의 비용과 차례', other:'landlady_polina', metric:'careAccess', prerequisite:'MIDWIFE_CARE_COST_1847',
    stages:[
      ['방문 순서와 비용표','안뜰 두 집에서 같은 날 도움을 청했다. 아브도티야는 급한 사정과 이동 비용을 함께 따져야 한다.',[['먼저 요청한 집에 도착 시간을 알린다','두 집과 조산원이 압니다 · 방문 순서 메모에 시각이 남습니다 · 다른 집은 기다려야 합니다','먼저 약속한 집에 도착 시간을 알렸다. 순서는 지키지만 다른 집의 급한 사정을 더 확인해야 한다.','firstPromise',2],['상태를 확인하고 긴급한 집을 먼저 방문한다','두 집과 아브도티야가 압니다 · 방문 확인표에 순서 변경 이유가 남습니다 · 처음 약속한 집이 서운해할 수 있습니다','상태를 확인해 급한 집을 먼저 보기로 했다. 순서를 바꾼 이유를 설명해야 한다.','triage',1],['두 집에 같은 시간에 와 달라고 한다','두 집이 압니다 · 구두 약속이라 자세한 기록은 없습니다 · 한 집이 늦게 도움을 받을 수 있습니다','두 집에 같은 시간에 오라고 알렸다. 이동은 줄지만 도착 순서는 다시 정해야 한다.','sharedVisit',0]]],
      ['약품과 교통비 내역','방문 순서를 정했지만 약품과 이동에 드는 돈이 부담이다. 비용을 누가 나눌지 결정해야 한다.',[['필요한 물품과 실제 비용만 적는다','아브도티야와 당사자가 압니다 · 개인 비용표에 지출만 남습니다 · 당장 비용을 마련하지 못할 수 있습니다','필요한 물품과 실제 비용만 적었다. 치료 효과를 장담하거나 쓸데없는 물건을 더하진 않았다.','actualCosts',2],['형편에 따라 낼 수 있는 만큼을 따로 묻는다','당사자와 아브도티야가 압니다 · 비공개 분담 메모에 합의액이 남습니다 · 다른 집이 불공정하다고 느낄 수 있습니다','각 집에 감당할 수 있는 몫을 따로 물었다. 사정은 지키지만 기준을 설명하기 어려울 수 있다.','meansTest',1],['두 집의 부담을 똑같이 나눈다','두 집과 조산원이 압니다 · 공동 비용표에 같은 몫이 남습니다 · 형편이 더 어려운 집엔 무거울 수 있습니다','비용을 반씩 나눴다. 기준은 간단하지만 같은 액수가 모두에게 같은 부담은 아니다.','equalSplit',0]]],
      ['다음 방문과 미납 기록','오늘 방문을 마쳤다. 다음에 누가 언제 도움을 받고 미납 비용을 어떻게 다룰지 정한다.',[['다음 방문 시간과 남은 비용을 각각 적는다','당사자와 아브도티야가 압니다 · 개인 방문표에 날짜와 미납액이 남습니다 · 기록을 지킬 시간이 더 듭니다','다음 방문과 남은 비용을 따로 적었다. 다시 확인하기 쉽지만 기록을 안전하게 보관해야 한다.','nextVisit',2],['공동 물품을 마련하고 사용량만 공개한다','두 집과 안뜰 관리인이 압니다 · 공동 물품 장부에 수량이 남습니다 · 필요한 물품이 제때 없을 수 있습니다','함께 쓰는 물품을 마련하기로 했다. 부담을 나눌 수 있지만 재고가 모자라면 기다려야 한다.','sharedSupplies',1],['미납은 다음 방문까지 미루고 우선 도움을 이어간다','당사자와 아브도티야가 압니다 · 비공개 미납 메모에 기한이 남습니다 · 조산원이 비용을 먼저 감당합니다','미납은 다음 방문 때 다시 확인하기로 했다. 도움은 이어지지만 당장은 조산원이 비용을 부담한다.','deferFee',0]]],
    ],
  },
  {
    host:'junior_guard_sergey', map:'chancery', id:'SERGEY_ENTRY_AND_FAVOR_1847', title:'출입 허가와 부탁', other:'senior_clerk_konstantin', metric:'fairAccess', prerequisite:'GUARD_ENTRY_BRIBE_1847',
    stages:[
      ['방문자 출입 메모','허가증을 가져오지 않은 사람이 급한 서류를 전하러 왔다. 세르게이는 부탁을 들으면서도 출입 기준을 확인해야 한다.',[['이름과 용무를 기록하고 담당자에게 확인한다','방문자와 담당 서기가 압니다 · 임시 방문 메모에 이름과 시각이 남습니다 · 전달이 늦어질 수 있습니다','이름과 용무를 적고 담당자에게 확인하기로 했다. 절차는 늦어져도 방문자를 몰래 들이진 않는다.','verifyVisitor',2],['문 앞에서 서류만 받아 담당자에게 전달한다','세르게이와 방문자가 압니다 · 수령 쪽지에 봉투 상태가 남습니다 · 내용과 발신자를 확인하지 못합니다','문 앞에서 봉투만 받고 담당자에게 전달하기로 했다. 안으로 들이진 않지만 전달 경로를 기록해야 한다.','doorHandoff',1],['아는 사람의 부탁이라 먼저 들여보낸다','세르게이와 방문자가 압니다 · 공식 기록에는 출입이 남지 않습니다 · 문제가 생기면 세르게이가 책임질 수 있습니다','아는 사람을 먼저 들였다. 급한 일은 진행되지만 출입 기록을 남기지 않은 책임이 생긴다.','quietEntry',0]]],
      ['교대 시간과 열쇠 인계','담당자가 바로 오지 않아 방문자는 기다린다. 교대가 다가오고 열쇠를 누구에게 맡길지 정해야 한다.',[['교대 담당자에게 현재 상황을 직접 인계한다','두 근무자가 압니다 · 교대 장부에 대기자와 열쇠 인계 시각이 남습니다 · 처리가 늦어질 수 있습니다','대기 상황과 열쇠를 다음 근무자에게 직접 넘겼다. 대기자는 더 기다리지만 기록은 이어진다.','writtenHandoff',2],['상급자가 올 때까지 열쇠를 보관한다','세르게이와 방문자가 압니다 · 보관 메모에 열쇠 인수만 남습니다 · 다른 업무가 밀릴 수 있습니다','상급자가 올 때까지 열쇠를 보관했다. 출입은 보류했지만 다른 업무가 늦어질 수 있다.','holdKey',1],['담당자 자리를 비운 틈에 봉투를 안쪽에 둔다','세르게이와 담당 서기가 알 수 있습니다 · 공식 인수 서명이 없습니다 · 분실이나 오해가 생기면 경위를 밝히기 어렵습니다','담당자 책상에 봉투를 두었다. 전달은 빨라져도 누가 인수했는지는 비어 있다.','unloggedDrop',0]]],
      ['출입 결정과 책임 기록','담당 서기는 돌아왔고 봉투는 도착했다. 세르게이는 방문자 처리와 자기 근무 기록을 마무리해야 한다.',[['확인된 허가 범위만 적고 서명을 받는다','방문자와 담당 서기가 압니다 · 출입 장부에 확인 범위와 서명이 남습니다 · 허가가 부족하면 다시 방문해야 합니다','확인된 범위와 서명을 장부에 남겼다. 한 번에 끝나진 않아도 누구의 판단인지 분명하다.','signedEntry',2],['거절 사유와 다시 올 방법을 알려준다','방문자와 담당 서기가 압니다 · 거절 메모에 사유와 재방문 방법이 남습니다 · 급한 서류가 늦어집니다','오늘은 들이지 않고 재방문 방법을 알려줬다. 기준은 지켰지만 서류는 제때 전달되지 않을 수 있다.','clearRefusal',1],['부탁을 들어준 사실을 교대 장부에 뒤늦게 적는다','교대 근무자와 상급자가 봅니다 · 사후 기록에 세르게이의 판단이 남습니다 · 절차 위반을 조사받을 수 있습니다','뒤늦게 부탁을 들어준 일을 적었다. 출입 절차는 어겼지만 기록에서 감추지는 않았다.','lateDisclosure',0]]],
    ],
  },
];

const property = (name, value) => ({ name, type: 'string', value });
const maps = new Map();
function mapRecord(id) {
  if (!maps.has(id)) maps.set(id, JSON.parse(readFileSync(path.join(root, `rpg/maps/${id}.json`), 'utf8')));
  return maps.get(id);
}
const tileUsed = new Map();
for (const [chainIndex, chain] of chains.entries()) {
  const person = residents[chain.host];
  if (!person.allowedMaps.includes(chain.map)) throw new Error(`${chain.host} cannot access ${chain.map}`);
  const map = mapRecord(chain.map);
  const interactions = map.layers.find(layer => layer.name === 'Interactions');
  const collision = map.layers.find(layer => layer.name === 'Collision').data;
  const occupied = new Set(interactions.objects.map(object => `${Math.floor(object.x / 16)},${Math.floor(object.y / 16)}`));
  const used = tileUsed.get(chain.map) ?? new Set();
  const origin = { x: person.start.x, y: person.start.y };
  const candidates = [];
  for (let y = 1; y < map.height - 1; y++) for (let x = 1; x < map.width - 1; x++) {
    const nearExisting = [...occupied].some(value => { const [ox, oy] = value.split(',').map(Number); return Math.abs(x - ox) + Math.abs(y - oy) <= 1; });
    if (collision[y * map.width + x] !== 0 || nearExisting || used.has(`${x},${y}`)) continue;
    candidates.push({ x, y, distance: Math.abs(x - origin.x) + Math.abs(y - origin.y) });
  }
  candidates.sort((a,b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
  for (const [stageIndex, [stageName, premise, actions]] of chain.stages.entries()) {
    const tile = candidates.find(candidate => !used.has(`${candidate.x},${candidate.y}`) && [...used].every(value => { const [x,y]=value.split(',').map(Number); return Math.abs(candidate.x-x)+Math.abs(candidate.y-y) >= 2; }));
    if (!tile) throw new Error(`no free reachable-looking object tile for ${chain.id} stage ${stageIndex + 1}`);
    const objectId = Math.max(1100 + chainIndex * 10 + stageIndex, ...interactions.objects.map(object => object.id + 1));
    const questId = `${chain.id}_STAGE_${stageIndex + 1}`;
    const previousQuestId = stageIndex ? `${chain.id}_STAGE_${stageIndex}` : null;
    const actionsOut = actions.map(([labelKo, subcopyKo, resultKo, resultFlag, metricValue], index) => ({
      id: `${questId}_CHOICE_${index + 1}`, hostIds: [chain.host], labelKo, subcopyKo, resultKo, resultFlag,
      followupTitleKo: stageName, followupKo: '이 선택은 허구 주민의 일과와 이웃 관계에만 남는다.',
      effects: { situationKo: resultKo, relations: { [chain.other]: `오늘 함께 확인한 일: ${stageName}` }, lifeChainDelta: { [chain.metric]: metricValue } },
    }));
    const quest = {
      id: questId, titleKo: chain.title, chapterId: chain.chapter ?? 'V33_1847_PRINT', date: chain.date ?? '1847-06-01', premiseKo: premise,
      historicalOutcome: { id: `${questId}_FICTIONAL_OUTCOME`, value: 'fictional resident daily life choice only; no historical public record is altered', sourceIds: [] },
      entry: { mapId: chain.map, objectId, requiredHostId: chain.host }, actions: actionsOut,
      completion: 'one authorized choice at the named physical work object',
      lifeChain: { id: chain.id, titleKo: chain.title, stage: stageIndex + 1, stageCount: 3, metricsKo: { [chain.metric]: '이 문제를 처리하며 남긴 결과' }, ...(previousQuestId ? { previousQuestId } : {}) },
      ...(previousQuestId ? { prerequisiteQuestIds: [previousQuestId] } : chain.prerequisite ? { prerequisiteQuestIds: [chain.prerequisite] } : {}),
    };
    const filename = `${chain.host.replaceAll('_','-')}-chain-${chainIndex + 1}-stage-${stageIndex + 1}-1847.json`;
    const filePath = path.join(root, `rpg/quests/${filename}`);
    try { await fs.access(filePath); throw new Error(`refusing to overwrite ${filename}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await fs.writeFile(filePath, `${JSON.stringify(quest, null, 2)}\n`, 'utf8');
    interactions.objects.push({ id: objectId, name: stageName, type: 'quest-object', x: tile.x * 16, y: tile.y * 16, width: 16, height: 16, visible: true, properties: [property('questId', questId)] });
    occupied.add(`${tile.x},${tile.y}`); used.add(`${tile.x},${tile.y}`);
  }
  tileUsed.set(chain.map, used);
}
for (const [id, map] of maps) await fs.writeFile(path.join(root, `rpg/maps/${id}.json`), `${JSON.stringify(map, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: 'PASS', newThreeStageChains: chains.length, questStages: chains.length * 3, residents: chains.map(chain => chain.host), changedMaps: [...maps.keys()] }, null, 2));
