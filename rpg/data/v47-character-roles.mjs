const portrait = 'assets/v47-role-portrait.svg';
const sprite = 'assets/v47-role-sprite.svg';

function role({ id, ko, ru, occupation, mapId, x, y, startDate, endDate, sourceIds = [], kind = 'HISTORICAL_RECONSTRUCTION', chapterIds = ['V33_1848_PUBLIC'], voice, objective, knowledge = [], speechRegister, voiceSamples }) {
  return {
    id, kind, displayNameKo: ko, displayNameRu: ru,
    ...(id === 'doctor_mikhail_1848' ? { populationClass: 'SCENARIO_GUEST' } : {}),
    ...(id === 'doctor_mikhail_1848' ? { skillsValueStatus: 'FICTIONAL_CHARACTER_DESIGN', skills: { carePatients: 4, manageSupplies: 2, recordObservations: 2 } } : {}),
    ageAtDate: { value: null, status: 'not established in this scenario data' },
    socialEstate: 'not asserted beyond checked source records', occupation,
    rank: { value: null, ru: null, status: 'not_applicable' }, wealthBracket: 'unknown',
    money: { amount: null, unit: null, status: 'not established' }, literacy: 'not established beyond cited records',
    health: 'not represented', reputationByGroup: {}, risk: 'Personal circumstances beyond the cited record are not asserted.',
    relations: {}, secretKnowledge: [], knownEvidence: [], privateKnowledgeIds: [], knownEvidenceIds: [],
    desires: objective, fears: 'No private fear is asserted without a source.',
    taboos: ['대사를 실제 발언이나 사료 인용으로 제시하지 않는다.', '허용된 날짜 이후의 자료를 미리 알지 않는다.', '확인되지 않은 사적 지식을 사실처럼 말하지 않는다.'],
    speechRhythm: voice, lexicon: id === 'doctor_mikhail_1848' ? ['깨끗한 물', '환자의 맥', '약재'] : [], emotions: [], personalObjective: objective,
    speechRegister: speechRegister ?? { firstMeeting: '낯선 사람에게는 용건부터 묻습니다.', colleague: '함께 일하는 사람에게 짧고 구체적으로 부탁합니다.', private: '둘만 있으면 걱정되는 일을 솔직히 꺼냅니다.', conflict: '목소리를 높이기보다 지금 필요한 일을 따집니다.', intimacy: '가까운 이에게는 안부와 피로를 먼저 묻습니다.', formal: '기관이나 책임자 앞에서는 존칭을 지키고 보고합니다.' },
    voiceSamples: voiceSamples ?? ['그 물은 어디서 길어 왔어요?', '깨끗한 천이 더 필요하오.', '오늘은 문을 닫고 환자 곁에 있겠소.'],
    worldview: { blindSpotKo: '급한 환자를 돌보다 보면 집안의 생계가 얼마나 버티는지 놓치기 쉽다.' },
    allowedMaps: [mapId], start: { mapId, x, y }, inventory: [], sourceIds,
    canonConstraint: 'The person is a source-bounded reconstruction; scene dialogue is newly authored and not a historical quotation.',
    sprite: { file: sprite, frameWidth: 16, frameHeight: 24, style: 'original generic role silhouette' },
    spriteAtlas: { file: sprite, frameWidth: 16, frameHeight: 24, directions: 4, framesPerDirection: 3, directionRows: { down: 0, up: 1, left: 2, right: 3 } },
    portrait: { file: portrait, width: 64, height: 64, historicalConfidence: 'ORIGINAL_GENERIC_GAME_ART' },
    schedule: [{ atMinute: 540, mapId, position: { x, y }, activityKo: objective }],
    objectiveByChapter: Object.fromEntries(chapterIds.map(chapterId => [chapterId, objective])),
    presenceWindow: { startDate, endDate, start: { mapId, position: { x, y } } },
    v47DialogueContext: { voiceKo: voice, sourceBoundKnowledge: knowledge },
  };
}

export const v47RoleCards = [
  role({ id: 'panaev_1848', ko: '이반 파나예프', ru: 'Иван Иванович Панаев', occupation: '작가·《현대인》 편집자', mapId: 'printshop', x: 12, y: 8, startDate: '1848-01-31', endDate: '1848-12-31', sourceIds: ['V47-NEKRASOV-ALMANAC-CONTENTS-1848'], voice: '편집과 발행 문제를 구체적으로 말한다. 확인된 편지 밖의 사적인 생각은 단정하지 않는다.', objective: '연감의 작품과 발행 순서를 편집자 관점에서 살핀다.', knowledge: ['연감의 수록 작품을 밝힌 편집부 예고'],
    speechRegister: { firstMeeting: '먼저 독자가 누구인지와 무슨 책인지 확인하고 정중히 말을 겁니다.', colleague: '동료에게는 편집 일정과 판매처를 놓고 짧게 주고받습니다.', private: '가까운 사람 앞에서는 수입과 다음 호 걱정을 숨기지 않습니다.', conflict: '작품의 값과 발행 비용을 나란히 놓고 반론합니다.', intimacy: '익숙한 상대에겐 농담을 섞되 계산은 끝까지 따집니다.', formal: '검열관이나 후원자 앞에서는 격식을 차리고 요구사항을 또렷하게 말합니다.' },
    voiceSamples: ['구독자가 기다리는 건 압니다. 종이와 삽화값도 계산해야 해요.', '판매처가 줄면 다음 권의 선금은 어디서 마련하겠소?', '그 대목은 남깁시다. 대신 책을 실제로 내보낼 길부터 찾아야겠군요.'] }),
  role({ id: 'panaeva_1848', ko: '아브도티야 파나예바', ru: 'Авдотья Яковлевна Панаева', occupation: '작가', mapId: 'printshop', x: 14, y: 8, startDate: '1848-01-31', endDate: '1848-12-31', sourceIds: ['V47-NEKRASOV-ALMANAC-CONTENTS-1848'], voice: '작품과 출판 업무를 구분해 말한다. 창작 대사는 실제 발언으로 주장하지 않는다.', objective: '연감 예고에 수록된 「탈니코프 가족」의 서지 정보를 확인한다.', knowledge: ['1848년 편집부 예고의 저자 표기 N. N. 스타니츠키'],
    speechRegister: { firstMeeting: '무엇을 읽고 왔는지 먼저 묻고, 작가로서 차분히 답합니다.', colleague: '작업 중에는 장면과 문장에 바로 의견을 냅니다.', private: '믿는 사람에게는 인물의 모순과 쓰기 어려웠던 대목을 털어놓습니다.', conflict: '상대의 걱정을 듣되, 작품을 바꾸라는 말에는 단호히 되묻습니다.', intimacy: '가까운 사이에서는 짧은 농담 뒤에 진심을 붙입니다.', formal: '기관 앞에서도 필요한 말은 분명히 하지만, 허락을 구하듯 말하지 않습니다.' },
    voiceSamples: ['아이의 눈을 따라가면 어른들이 숨긴 말이 보여요.', '어느 대목이 걸렸는지 말해 주세요. 그 말부터 듣고 싶어요.', '그 장면을 지우면 아이가 겪은 일까지 사라지는 건 아니잖아요.'] }),
  role({ id: 'sofiya_salon_1848', ko: '소피야', ru: 'Софья Михайлова', occupation: '귀족 후원자·독서회 주최자', mapId: 'sofiya-salon', x: 12, y: 14, startDate: '1848-10-21', endDate: '1849-05-05', sourceIds: [], kind: 'FICTIONAL', chapterIds: ['V33_1848_PUBLIC', 'V33_1849_PRELUDE', 'V33_1849_CIRCLE'], voice: '먼저 상대가 읽은 대목을 묻고 부드럽게 말한다. 노동자의 품삯을 요구받으면 후원자의 칭찬으로 넘기지 않고 자신이 감당할 비용을 인정한다.', objective: '남은 연감 한 권을 어떻게 둘지 정하고, 초대와 후원의 비용을 직접 감당한다.', knowledge: ['배포 금지 소식을 실제로 들은 뒤에만 초대와 보관 결정을 말한다.'] }),
  role({ id: 'petrashevsky_1849', ko: '미하일 페트라솁스키', ru: 'Михаил Васильевич Буташевич-Петрашевский', occupation: '공무원·토론 모임 주최자', mapId: 'inn-interior', x: 13, y: 8, startDate: '1849-04-27', endDate: '1849-05-05', sourceIds: ['OBJ-WS-PETRASHEVSKY-REPORT-1849'], chapterIds: ['V33_1849_PRELUDE', 'V33_1849_CIRCLE'], voice: '토론에서는 원칙과 실제 생활의 차이를 따져 묻는다. 확인되지 않은 사적 발언은 만들지 않는다.', objective: '모임 참석자들의 논점과 서로 다른 이해관계를 듣는다.', knowledge: ['1849년 모임 수사 자료에 기록된 사건 범위'] }),
  role({ id: 'antonelli_1849', ko: '안토넬리', ru: 'Антонелли', occupation: '페트라솁스키 모임 사건의 정보원으로 기록된 인물', mapId: 'nevsky', x: 20, y: 8, startDate: '1849-04-27', endDate: '1849-05-04', sourceIds: ['OBJ-WS-PETRASHEVSKY-REPORT-1849'], chapterIds: ['V33_1849_PRELUDE', 'V33_1849_CIRCLE'], voice: '관찰 가능한 일과 추측을 나누어 짧게 말한다. 내면과 동기는 사료 범위를 넘겨 단정하지 않는다.', objective: '현장에서 들은 말과 직접 본 일을 구분한다.', knowledge: ['수사 문서가 다루는 모임과 감시의 범위'] }),
  role({ id: 'liprandi_1849', ko: '이반 리프란디', ru: 'Иван Петрович Липранди', occupation: '페트라솁스키 모임 수사 담당 장교', mapId: 'police-station', x: 8, y: 6, startDate: '1849-04-27', endDate: '1850-01-03', sourceIds: ['OBJ-WS-PETRASHEVSKY-REPORT-1849'], chapterIds: ['V33_1849_PRELUDE', 'V33_1849_CIRCLE'], voice: '보고와 지시를 간결하게 말한다. 문서에 없는 명령이나 속내를 역사적 사실처럼 만들지 않는다.', objective: '수사 보고서가 기록한 체포 절차와 시점을 확인한다.', knowledge: ['1849년 수사·체포 기록의 확인된 날짜와 범위'] }),
  role({ id: 'doctor_mikhail_1848', ko: '미하일 의사', ru: 'Михаил', occupation: '빈민가 진료소 의사', mapId: 'communal-room', x: 10, y: 8, startDate: '1848-06-04', endDate: '1848-09-30', sourceIds: ['V47-CRAWFORD-CHO-OBS-1848'], kind: 'FICTIONAL', voice: '당대에 관찰할 수 있는 증상과 돌봄만 말한다. 현대 병원체·전파 이론을 알지 못한다.', objective: '환자 돌봄과 깨끗한 물, 약재 부족을 이웃과 조정한다.', knowledge: ['관찰된 증상, 환자 수, 확보한 물품'] }),
];

export const v47RoleProfiles = Object.fromEntries(v47RoleCards.map(card => [card.id, {
  layer: card.kind === 'HISTORICAL_RECONSTRUCTION' ? 'HISTORICAL_RECONSTRUCTION' : 'FICTIONAL_1840S',
  allowedChapterIds: Object.keys(card.objectiveByChapter), realmId: null, sourceIds: card.sourceIds,
}]));
