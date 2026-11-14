// V47 story entry points use only source IDs already present in the shipped
// source packet. Bundle-only references are never exposed as in-game sources.
const action = (id, hostIds, labelKo, resultKo, effects = {}) => {
  const { flags: _seedOnlyFlags, ...runtimeEffects } = effects;
  runtimeEffects.v47StoryAction ??= id;
  if (runtimeEffects.v47WorldChange?.inventory) {
    runtimeEffects.v47WorldChange.inventory = runtimeEffects.v47WorldChange.inventory.map(item => ({ ...item, produceIfAbsent: true }));
  }
  return { id, hostIds, labelKo, resultKo, resultFlag: id, effects: runtimeEffects };
};
const sceneDialogue = (...turns) => turns.map(([speakerKo, lineKo]) => ({ speakerKo, lineKo }));

export const v47StoryQuests = [
  {
    id: 'V47_MAIN01_PERMISSION', titleKo: '허가 도장과 아직 나가지 못한 책', chapterId: 'V33_1848_PUBLIC', date: '1848-03-09',
    entry: { mapId: 'printshop', objectId: 9047 }, sourceIds: [],
    actions: [
      action('V47_A01_COLLATE_PROOFS', ['printer_ekaterina', 'print_apprentice_stepan'], '교정쇄와 활자 수를 맞춘다', '작업대 위 교정쇄와 활자 수를 대조했다. 인쇄 부수와 실제 판본 내용은 확인 가능한 자료가 확보될 때까지 장부에 추정치로 남겼다.', { situationKo: '1848년 연감 인쇄 작업을 시작했다.', flags: { V47_MAIN01_PROOFS_COLLATION: true } }),
      action('V47_A01_SECURE_WAGES', ['nekrasov_reconstruction', 'editor_sofia'], '먼저 작업자 품삯을 마련한다', '종이 대금보다 작업자 품삯부터 계산했다. 편집부는 출고가 늦어질 수 있다는 사실을 서점에 전해야 했다.', { situationKo: '연감 인쇄 작업의 임금 지급을 우선했다.', flags: { V47_MAIN01_WAGES_PRIORITIZED: true }, v47WorldChange: { money: [{ fromHostId: 'editor_sofia', toHostId: 'print_apprentice_stepan', amount: 2 }], relationships: [{ fromHostId: 'print_apprentice_stepan', toHostId: 'editor_sofia', trustDelta: 4 }] } }),
      action('V47_A01_RECORD_PERMISSION', ['clerk_alexei'], '허가 도장을 장부에 옮긴다', '도장에 적힌 날짜를 장부에 옮겼다. 새 공문이 오면 다시 대조해야 한다.', { situationKo: '연감 허가 기록을 장부에 옮겼다.' }),
    ],
  },
  {
    id: 'V47_MAIN01_DISTRIBUTION_BAN', titleKo: '배포가 막힌 날', chapterId: 'V33_1848_PUBLIC', date: '1848-11-01',
    prerequisiteQuestIds: ['V47_MAIN01_PERMISSION'], entry: { mapId: 'printshop', objectId: 9048 }, sourceIds: ['V47-MUSIN-PUSHKIN-REPORT-MARGIN-NOTE-1848-10-15'],
    dialogueStatus: 'NEWLY_AUTHORED_FROM_V47_SCENARIO', dialogue: sceneDialogue(
      ['스테판', '판을 깨면 끝입니까? 이 종이 찍느라 사흘을 샜는데요.'],
      ['네크라소프', '그 시간을 모르는 줄 아나. 내 이름으로 이미—'],
      ['스테판', '그럼 제 임금은 누구 이름으로 줍니까?']),
    actions: [
      action('V47_A06_COUNT_STOCK', ['printer_ekaterina', 'bookseller_lev'], '창고의 묶음과 주문 장부를 맞춘다', '창고의 묶음 수와 서점 주문 장부를 한 줄씩 대조했다. 나갈 수 없는 책이 몇 권인지 이제 알 수 있다.', { situationKo: '창고 재고와 서점 주문을 대조했다.' }),
      action('V47_A06_PAY_WORKERS', ['nekrasov_reconstruction', 'courier_pavel'], '남은 돈을 품삯과 환불에 나눈다', '품삯과 구독자 환불에 남은 돈을 나누었다. 어느 쪽을 먼저 갚았는지가 뒤의 인물 관계와 생계에 남는다.', { situationKo: '배포 금지 뒤 품삯과 환불을 나누어 지급했다.', flags: { V47_MAIN01_COMPENSATION_CHOSEN: true }, v47WorldChange: { money: [{ fromHostId: 'editor_sofia', toHostId: 'seamstress_anna', amount: 1 }, { fromHostId: 'editor_sofia', toHostId: 'print_apprentice_stepan', amount: 1 }], relationships: [{ fromHostId: 'seamstress_anna', toHostId: 'editor_sofia', trustDelta: 2 }, { fromHostId: 'print_apprentice_stepan', toHostId: 'editor_sofia', trustDelta: 2 }] } }),
      action('V47_A06_KEEP_COPY', ['bookseller_lev', 'seamstress_anna'], '한 부를 따로 보관한다', '레프가 주문 묶음에서 한 부를 떼어 안나에게 맡겼다. 사본은 실제로 안나의 소지품에 남고, 보관 사실은 들은 사람에게만 알려진다.', { situationKo: '허구의 인쇄본 한 부를 따로 보관했다.', v47WorldChange: { inventory: [{ fromHostId: 'bookseller_lev', toHostId: 'seamstress_anna', itemKo: '보관 중인 연감 한 부', quantity: 1 }], relationships: [{ fromHostId: 'bookseller_lev', toHostId: 'seamstress_anna', trustDelta: 2 }], rumor: { id: 'V47_ALMANAC_COPY_STORED', fromHostId: 'bookseller_lev', hostIds: ['seamstress_anna'] }, flags: { V47_MAIN01_PRIVATE_COPY: true } }, flags: { V47_MAIN01_PRIVATE_COPY: true } }),
    ],
  },
  {
    id: 'V47_MAIN01_SUBSCRIBER_REPLY', titleKo: '구독자에게 답장을 쓰다', chapterId: 'V33_1848_PUBLIC', date: '1848-11-29',
    prerequisiteQuestIds: ['V47_MAIN01_DISTRIBUTION_BAN'], entry: { mapId: 'bookshop-interior', objectId: 9049 }, sourceIds: ['V47-NEKRASOV-SUBSCRIBER-LETTER-1848'],
    dialogueStatus: 'NEWLY_AUTHORED_FROM_V47_SCENARIO', dialogue: sceneDialogue(
      ['파나예프', '계약서엔 지급한다고 써 있습니다. 지금 제 손엔 지급할 책이 없고요.'],
      ['레프', '손님들은 검열위원회보다 제 얼굴을 먼저 봅니다.']),
    actions: [
      action('V47_A08_REFUND_SUBSCRIBERS', ['bookseller_lev', 'nekrasov_reconstruction'], '구독료를 돌려보낸다', '레프가 이름을 확인한 구독자에게 돈을 돌려보냈다. 장부에 남은 사람은 아직 기다리고 있다.', { situationKo: '구독료 일부를 돌려보냈다.' }),
      action('V47_A08_SEND_LETTER', ['courier_pavel', 'editor_sofia'], '답신을 우편으로 보낸다', '파벨이 답신을 받아 우편 창구로 가져간다. 장부에는 발송이, 파벨의 소지품에는 전달할 봉투가 남는다.', { situationKo: '구독자 답신을 발송했다.', v47WorldChange: { inventory: [{ fromHostId: 'editor_sofia', toHostId: 'courier_pavel', itemKo: '구독자 답신 봉투', quantity: 1 }], moves: [{ hostId: 'courier_pavel', mapId: 'bookshop-lane', x: 7, y: 9 }], rumor: { id: 'V47_SUBSCRIBER_REPLY_IN_TRANSIT', fromHostId: 'courier_pavel', hostIds: ['bookseller_lev', 'editor_sofia'] }, flags: { V47_MAIN01_REPLY_SENT: true } }, flags: { V47_MAIN01_REPLY_SENT: true } }),
      action('V47_A08_PROMISE_UNAVAILABLE_COPY', ['bookseller_lev', 'courier_pavel'], '곧 책을 보내겠다고 둘러댄다', '레프는 기다리는 손님에게 출고가 임박했다고 말하지만, 실제 책은 없다. 답신은 빨리 나가고 다음에 들킬 위험과 손님들의 불신이 남는다.', { situationKo: '없는 재고를 약속한 답신을 보냈다.', v47WorldChange: { inventory: [{ fromHostId: 'bookseller_lev', toHostId: 'courier_pavel', itemKo: '출고를 약속한 답신 봉투', quantity: 1 }], moves: [{ hostId: 'courier_pavel', mapId: 'bookshop-lane', x: 7, y: 9 }], relationships: [{ fromHostId: 'bookseller_lev', toHostId: 'reader_darya', trustDelta: -2 }], rumor: { id: 'V47_UNAVAILABLE_COPY_PROMISED', fromHostId: 'bookseller_lev', hostIds: ['reader_darya', 'seamstress_anna'] }, flags: { V47_MAIN01_FALSE_PROMISE_SENT: true } }, flags: { V47_MAIN01_FALSE_PROMISE_SENT: true } }),
    ],
  },
  {
    id: 'V47_MAIN03_REVOLUTION_NEWS', titleKo: '유럽에서 온 신문', chapterId: 'V33_1848_PUBLIC', date: '1848-03-26',
    entry: { mapId: 'printshop', objectId: 9050 }, sourceIds: ['OBJ-NICHOLAS-MANIFESTO-1848'],
    actions: [
      action('V47_P00_READ_ALOUD', ['printer_ekaterina', 'student_vasily'], '작업장 사람들과 공고를 읽는다', '작업장에 있던 사람들이 공고를 함께 읽었다. 바실리는 유럽의 소식이 이곳의 검열과 어떤 관계인지 물었고, 각자는 자기 일과 위험을 먼저 이야기했다.', { situationKo: '유럽 혁명 소식과 황제의 대응을 함께 읽었다.', flags: { V47_MAIN03_NEWS_SHARED: true }, v47WorldChange: { rumor: { id: 'V47_EUROPE_NEWS_PUBLIC_READING', fromHostId: 'student_vasily', hostIds: ['student_vasily', 'printer_ekaterina', 'bookseller_lev'] }, relationships: [{ fromHostId: 'student_vasily', toHostId: 'printer_ekaterina', trustDelta: 2 }] } }),
      action('V47_P00_PRIVATE_NOTE', ['clerk_alexei'], '읽은 날짜와 출처를 수첩에 적는다', '읽은 날짜와 출처를 사적인 수첩에 남겼다. 관청 장부나 다른 인물의 기억에는 자동으로 옮겨지지 않는다.', { situationKo: '유럽 소식의 출처를 개인 수첩에 기록했다.', flags: { V47_MAIN03_NEWS_PRIVATE: true } }),
      action('V47_P00_FILE_NOTICE', ['clerk_alexei'], '선언문을 관청 장부에 접수한다', '선언문 사본을 공식 장부에 접수했다. 접수 기록에는 유럽의 사건과 러시아 당국의 대응 문구가 나란히 남았다.', { situationKo: '유럽 소식과 황제의 대응을 공식 장부에 접수했다.', flags: { officialNoticeFiled: true, V47_MAIN03_NEWS_FILED: true } }),
    ],
  },
  {
    id: 'V47_MAIN03_ARRESTS', titleKo: '닫힌 문 앞의 금요일', chapterId: 'V33_1849_CIRCLE', date: '1849-05-05',
    entry: { mapId: 'morskaya-intersection', objectId: 9051 }, sourceIds: ['OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849'],
    dialogueStatus: 'NEWLY_AUTHORED_FROM_V47_SCENARIO', dialogue: sceneDialogue(
      ['이반', '명령서에 적힌 주소는 말라야 모르스카야와 보즈네센스키 대로가 만나는 곳입니다. 순찰은 골목 입구부터 맡으세요.'],
      ['알렉세이', '책과 종이도 전부 가져오라는군요. 주인의 물건이 아니라고 해도 봉인하라고 적혀 있습니다.'],
      ['파벨', '그 골목으로 가는 마차가 막 출발했어요. 아직 안에 누가 있는지는 모릅니다.'],
      ['폴리나', '새벽부터 문을 두드리면 옆집 아이들까지 깹니다. 적어도 통로는 비워 주세요.'],
      ['이반', '문 좀 열어 주십시오. 집주인을 먼저 찾겠습니다.'],
      ['이반', '명단에 적힌 사람입니다. 여기 있다고는 아직 확인하지 못했습니다.'],
      ['이반', '명령은 집행하되 확인하지 않은 이름을 명부에 더하지는 않겠소.']),
    actions: [
      action('V47_P07_SEPARATE_WITNESS', ['police_sergeant_ivan', 'clerk_alexei', 'scribal_yuri', 'landlady_polina', 'porter_gavrila'], '직접 본 일과 전해 들은 말을 나눈다', '알렉세이는 폴리나와 가브릴라가 직접 본 일만 진술서에 적고, 출처를 모르는 말은 따로 표시한다. 조사 기록은 남지만 그들의 말이 곧 혐의가 되지는 않는다.', { situationKo: '현장 목격과 전해 들은 말을 구분해 기록했다.', v47WorldChange: { inventory: [{ fromHostId: 'porter_gavrila', toHostId: 'clerk_alexei', itemKo: '문 앞 직접 목격 진술서', quantity: 1 }], relationships: [{ fromHostId: 'porter_gavrila', toHostId: 'clerk_alexei', trustDelta: 2 }, { fromHostId: 'landlady_polina', toHostId: 'police_sergeant_ivan', trustDelta: -1 }], rumor: { id: 'V47_WITNESS_AND_HEARSAY_SEPARATED', fromHostId: 'clerk_alexei', hostIds: ['porter_gavrila', 'landlady_polina'] }, flags: { V47_HISTORICAL_ARRESTS_REMAIN_FIXED: true, V47_P08_WITNESSES_RECORDED: true } } }),
      action('V47_P08_CLEAR_STAIRWELL', ['police_sergeant_ivan', 'landlady_polina', 'porter_gavrila', 'courier_pavel'], '이웃을 깨우지 않게 계단을 비운다', '폴리나와 가브릴라는 아이들과 세입자를 안뜰 쪽으로 안내한다. 이반은 출입을 막고 파벨은 마차가 들어올 자리를 확보한다. 체포 대상과 책·서류의 압수는 명령대로 진행된다.', { situationKo: '이웃을 통로 밖으로 안내하고 현장 출입을 정리했다.', v47WorldChange: { moves: [{ hostId: 'landlady_polina', mapId: 'courtyard', x: 11, y: 11 }, { hostId: 'porter_gavrila', mapId: 'courtyard', x: 12, y: 11 }, { hostId: 'courier_pavel', mapId: 'nevsky', x: 11, y: 9 }], inventory: [{ fromHostId: 'landlady_polina', toHostId: 'courier_pavel', itemKo: '안뜰 출입문 열쇠', quantity: 1 }], relationships: [{ fromHostId: 'landlady_polina', toHostId: 'porter_gavrila', trustDelta: 2 }, { fromHostId: 'courier_pavel', toHostId: 'police_sergeant_ivan', trustDelta: 1 }], rumor: { id: 'V47_STAIRWELL_CLEARED', fromHostId: 'landlady_polina', hostIds: ['porter_gavrila', 'courier_pavel'] }, flags: { V47_HISTORICAL_ARRESTS_REMAIN_FIXED: true } } }),
      action('V47_P07_WARN_FICTIONAL', ['courier_pavel', 'student_vasily', 'editor_sofia', 'bookbinder_elizaveta'], '바실리에게 몸을 피하라고 알린다', '파벨이 소피야와 엘리자베타를 거쳐 소식을 전한다. 바실리는 안뜰 숙소로 몸을 옮기고, 경찰은 훗날 그가 마지막으로 목격된 교차로를 수색한다. 실존 인물의 체포는 그대로 진행된다.', { situationKo: '바실리가 안뜰로 피하도록 쪽지를 보냈다.', v47WorldChange: { moves: [{ hostId: 'student_vasily', mapId: 'communal-room', x: 12, y: 8 }, { hostId: 'courier_pavel', mapId: 'bookshop-lane', x: 6, y: 9 }, { hostId: 'editor_sofia', mapId: 'communal-room', x: 9, y: 9 }], inventory: [{ fromHostId: 'courier_pavel', toHostId: 'student_vasily', itemKo: '안뜰로 피하라는 쪽지', quantity: 1 }], relationships: [{ fromHostId: 'student_vasily', toHostId: 'courier_pavel', trustDelta: 4 }, { fromHostId: 'student_vasily', toHostId: 'editor_sofia', trustDelta: 1 }], rumor: { id: 'V47_VASILY_WARNED_BEFORE_ARREST', fromHostId: 'courier_pavel', hostIds: ['student_vasily', 'editor_sofia'] }, flags: { V47_HISTORICAL_ARRESTS_REMAIN_FIXED: true, V47_FICTIONAL_STUDENT_WARNED: true } } }),
      action('V47_P07_SEAL_ROOM', ['police_sergeant_ivan', 'clerk_alexei', 'scribal_yuri', 'senior_clerk_konstantin', 'dostoevsky_1849'], '압수한 책과 종이를 목록에 봉인한다', '알렉세이와 유리는 수량을 세고 봉인을 붙인다. 도스토옙스키는 실제 체포·이송 기록에 따라 제3부로 옮겨진다. 게임의 선택은 압수품을 목록에 남기고 넘기는 절차에 영향을 준다.', { situationKo: '압수한 책과 서류를 목록으로 남겨 봉인했다.', v47WorldChange: { moves: [{ hostId: 'clerk_alexei', mapId: 'police-station', x: 5, y: 5 }, { hostId: 'scribal_yuri', mapId: 'police-station', x: 6, y: 5 }], inventory: [{ fromHostId: 'police_sergeant_ivan', toHostId: 'clerk_alexei', itemKo: '압수 서류 봉인 목록', quantity: 1 }, { fromHostId: 'police_sergeant_ivan', toHostId: 'senior_clerk_konstantin', itemKo: '압수 책 꾸러미', quantity: 1 }], relationships: [{ fromHostId: 'clerk_alexei', toHostId: 'police_sergeant_ivan', trustDelta: 1 }, { fromHostId: 'scribal_yuri', toHostId: 'senior_clerk_konstantin', trustDelta: 1 }], rumor: { id: 'V47_BOOKS_AND_PAPERS_SEALED', fromHostId: 'clerk_alexei', hostIds: ['senior_clerk_konstantin', 'police_sergeant_ivan'] }, flags: { V47_HISTORICAL_ARRESTS_REMAIN_FIXED: true, V47_PETRASHEVSKY_ROOM_SEALED: true } } }),
      action('V47_P08_RECORD_WITNESSES', ['police_sergeant_ivan', 'clerk_alexei', 'scribal_yuri', 'porter_gavrila', 'landlady_polina'], '문 앞에 있던 사람들의 목격을 따로 적는다', '알렉세이는 가브릴라와 폴리나가 직접 본 일만 구술받고, 유리는 익명으로 전해진 말을 별도 칸에 둔다. 서류는 관청으로 넘어가고 현장에는 작성 시각이 남는다.', { situationKo: '현장 목격과 전해 들은 말을 구분해 기록했다.', v47WorldChange: { moves: [{ hostId: 'scribal_yuri', mapId: 'chancery', x: 10, y: 9 }], inventory: [{ fromHostId: 'porter_gavrila', toHostId: 'clerk_alexei', itemKo: '문 앞 목격 진술서', quantity: 1 }, { fromHostId: 'clerk_alexei', toHostId: 'senior_clerk_konstantin', itemKo: '서명된 수취 시각표', quantity: 1 }], relationships: [{ fromHostId: 'porter_gavrila', toHostId: 'clerk_alexei', trustDelta: 2 }, { fromHostId: 'landlady_polina', toHostId: 'police_sergeant_ivan', trustDelta: -1 }], rumor: { id: 'V47_WITNESS_STATEMENTS_SEPARATED', fromHostId: 'clerk_alexei', hostIds: ['porter_gavrila', 'landlady_polina'] }, flags: { V47_HISTORICAL_ARRESTS_REMAIN_FIXED: true, V47_P08_WITNESSES_RECORDED: true } } }),
    ],
  },
  {
    id: 'V47_MAIN05_WATER_NOTICE', titleKo: '공동 우물의 물통', chapterId: 'V33_1848_PUBLIC', date: '1848-06-14',
    // The supplied screenplay opens the cholera arc inside Irina's inn.
    // Keep its water, food, and care choices attached to that physical scene.
    entry: { mapId: 'inn-interior', objectId: 9052 }, sourceIds: [],
    dialogueStatus: 'NEWLY_AUTHORED_FROM_V47_SCENARIO', dialogue: sceneDialogue(
      ['이리나', '식사는 방으로 가져다드릴까요? 오전부터 손을 못 대셨네요.'],
      ['손님', '속이 계속 뒤집혀서… 물만 조금 주시오.'],
      ['직원', '주인마님, 저 방 사람 아픈 것 같아요. 다른 손님들도 봤어요.'],
      ['이리나', '창문부터 열어. 그리고 아브도티야를 불러 와. 손님을 거리로 내보내지는 마.']),
    actions: [
      action('V47_C00_CLEAN_WATER', ['innkeeper_irina', 'watercarrier_luka', 'landlady_polina'], '마신 물과 아픈 시각을 적고 물통을 씻는다', '폴리나는 환자가 마신 것과 처음 아팠던 때를 적는다. 루카는 공동 물통을 씻어 다시 채운다.', { v47CholeraAction: 'CLEAN_WATER', v47TargetHostId: 'watercarrier_luka', v47WorldChange: { inventory: [{ fromHostId: 'landlady_polina', toHostId: 'midwife_avdotya', itemKo: '환자가 마신 물과 증상 시각 메모', quantity: 1 }], rumor: { id: 'V47_WATER_CASK_CLEANED', fromHostId: 'watercarrier_luka', hostIds: ['watercarrier_luka', 'landlady_polina'] } }, situationKo: '환자의 관찰 내용과 물통을 함께 확인했다.' }),
      action('V47_C00_CLOSE_FOOD', ['baker_fyodor', 'innkeeper_irina'], '다른 손님들 동선을 나누고 음식 꾸러미를 치운다', '이리나는 손님들이 한곳에 몰리지 않게 자리를 나눈다. 표도르는 의심되는 음식 꾸러미를 치우고 빵집 장부를 고친다.', { v47CholeraAction: 'CLOSE_CONTAMINATED_FOOD', v47WorldChange: { moves: [{ hostId: 'innkeeper_irina', mapId: 'inn-interior', x: 10, y: 9 }, { hostId: 'baker_fyodor', mapId: 'bakery-interior', x: 9, y: 9 }] }, situationKo: '여관 손님과 음식 재고를 따로 관리했다.' }),
      action('V47_C00_TEND_PATIENT', ['innkeeper_irina', 'midwife_avdotya', 'tenant_mikhail'], '아브도티야가 올 때까지 환자 곁에 있는다', '이리나는 환자 곁을 지킨다. 아브도티야가 도착하면 상태와 필요한 것을 직접 전하고, 치료 물품은 환자에게 쓴다.', { v47CholeraAction: 'CARE_PATIENT', v47TargetHostId: 'tenant_mikhail', v47WorldChange: { moves: [{ hostId: 'tenant_mikhail', mapId: 'inn-interior', x: 10, y: 10 }, { hostId: 'midwife_avdotya', mapId: 'inn-interior', x: 11, y: 10 }] }, situationKo: '이리나가 환자 곁을 지키고 조산사를 불렀다.' }),
    ],
  },
  {
    id: 'V47_MAIN05_MARKET_RESPONSE', titleKo: '시장과 진료소의 빈자리', chapterId: 'V33_1848_PUBLIC', date: '1848-06-14',
    prerequisiteQuestIds: ['V47_MAIN05_WATER_NOTICE'], entry: { mapId: 'inn-interior', objectId: 9053 }, sourceIds: [],
    actions: [
      action('V47_C02_ADD_BEDS', ['midwife_avdotya', 'innkeeper_irina'], '방 한 칸을 환자에게 내준다', '방 한 칸을 비우고 침상을 마련했다. 치료 공간이 늘었지만 여관의 수입과 다른 투숙객의 잠자리도 줄었다.', { v47CholeraAction: 'ADD_BEDS', situationKo: '환자를 위한 침상을 마련했다.' }),
      action('V47_C02_RESTOCK', ['apothecary_yakov', 'baker_fyodor'], '필요한 물품을 공동으로 산다', '야코프가 붕대와 약재를 내놓고, 표도르는 빵과 따뜻한 물을 보탰다. 두 사람은 값을 나중에 계산하기로 했다.', { v47CholeraAction: 'RESTOCK_MEDICINE', situationKo: '환자에게 쓸 물품을 마련했다.' }),
    ],
  },
];

import { walkableTilesReachableFromArrivals } from './walkable-placement.mjs';

const objectSpec = [
  ['printshop', 9047, '연감 교정쇄와 인쇄 장부', 'V47_MAIN01_PERMISSION', 208, 176],
  ['printshop', 9048, '배포 중지 뒤 남은 인쇄 묶음', 'V47_MAIN01_DISTRIBUTION_BAN', 224, 176],
  ['bookshop-interior', 9049, '구독자 답신과 주문 장부', 'V47_MAIN01_SUBSCRIBER_REPLY', 160, 176],
  ['printshop', 9050, '유럽에서 온 공고 사본', 'V47_MAIN03_REVOLUTION_NEWS', 192, 192],
  ['morskaya-intersection', 9051, '닫힌 문 앞의 체포 명령', 'V47_MAIN03_ARRESTS', 224, 128],
  ['inn-interior', 9052, '여관의 첫 환자와 물통 장부', 'V47_MAIN05_WATER_NOTICE', 240, 208],
  ['inn-interior', 9053, '하숙집 환자 방문부', 'V47_MAIN05_MARKET_RESPONSE', 192, 144],
  ['printshop', 9054, '연감 날짜 대조판', 'V47_MAIN01_A11', 320, 208, 'MAIN01_TIMELINE'],
];

export function attachV47StoryObjects(maps) {
  for (const [mapId, id, name, questId, x, y, puzzleId] of objectSpec) {
    const map = maps[mapId];
    const layer = map?.layers?.find(item => item.name === 'Interactions') ?? map?.layers?.find(item => item.type === 'objectgroup');
    if (!layer || layer.objects.some(item => item.id === id)) continue;
    const collision = map.layers.find(item => item.name === 'Collision')?.data ?? [];
    const reachable = walkableTilesReachableFromArrivals(mapId, maps);
    const npcTiles = new Set((map.layers.find(item => item.name === 'NPCs')?.objects ?? []).map(npc =>
      `${Math.floor(npc.x / map.tilewidth)},${Math.floor(npc.y / map.tileheight)}`));
    const occupied = map.layers.flatMap(item => item.objects ?? []).map(object => ({
      x: Math.floor(object.x / map.tilewidth), y: Math.floor(object.y / map.tileheight),
    }));
    const preferred = { x: Math.floor(x / map.tilewidth), y: Math.floor(y / map.tileheight) };
    const candidates = [];
    for (let tileY = 1; tileY < map.height - 1; tileY += 1) for (let tileX = 1; tileX < map.width - 1; tileX += 1) {
      const walkable = (tx, ty) => tx >= 1 && ty >= 1 && tx < map.width - 1 && ty < map.height - 1
        && collision[ty * map.width + tx] === 0 && !npcTiles.has(`${tx},${ty}`);
      if (!walkable(tileX, tileY) || !reachable.has(`${tileX},${tileY}`)
        || ![[tileX - 1, tileY], [tileX + 1, tileY], [tileX, tileY - 1], [tileX, tileY + 1]]
        .some(([tx, ty]) => walkable(tx, ty))) continue;
      if (occupied.some(point => Math.abs(point.x - tileX) + Math.abs(point.y - tileY) <= 2)) continue;
      candidates.push({ x: tileX, y: tileY, distance: Math.abs(preferred.x - tileX) + Math.abs(preferred.y - tileY) });
    }
    candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
    const tile = candidates[0];
    if (!tile) throw new Error(`No unoccupied physical tile for V47 event ${questId} on ${mapId}`);
    layer.objects.push({ id, name, type: 'quest-object', x: tile.x * map.tilewidth, y: tile.y * map.tileheight,
      width: map.tilewidth, height: map.tileheight, visible: true,
      properties: [{ name: 'questId', type: 'string', value: questId }, { name: 'actionId', type: 'string', value: 'OPEN' },
        ...(questId === 'V47_MAIN01_PERMISSION' ? [{ name: 'v47PuzzleId', type: 'string', value: 'MAIN01_PRINTWORK' }] : []),
        ...(puzzleId ? [{ name: 'v47PuzzleId', type: 'string', value: puzzleId }] : [])] });
    map.nextobjectid = Math.max(map.nextobjectid ?? 1, id + 1);
  }
}
