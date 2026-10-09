import fs from 'node:fs';

const bundle = JSON.parse(fs.readFileSync('data/v27-case-bundle.json', 'utf8'));
const characterSeeds = {
  alexei: {
    id: 'alexei', name: '알렉세이 오를로프', role: '관청 동료 서기', ageRange: '1836: 27–1849: 40',
    voice: '짧고 건조한 문장, 숫자와 봉인에 기대지만 궁지에서는 농담으로 겁을 숨긴다.',
    goal: '가족에게 돌아갈 수 있는 안전한 경력을 지키면서도 기록의 빈칸을 방치하지 않는다.',
    secret: '형의 이름이 오래된 감시 목록의 가장자리에서 지워지지 않았다.',
    access: '상트페테르부르크 관청의 등록부·봉인·전달 봉투',
    memoryRules: ['플레이어가 자기 이름을 감춰 준 일을 기억한다.', '공식 봉인을 건넨 순간을 오래 기억한다.', '거짓말을 들키면 문장을 짧게 끊고 손을 거둔다.']
  },
  ekaterina: {
    id: 'ekaterina', name: '예카테리나 벨로바', role: '민간 독서·인쇄망 연락자', ageRange: '1836: 24–1849: 37',
    voice: '질문을 먼저 던지고, 빈정거림과 정확한 지명을 섞으며 침묵을 거래 가능한 경계로 여긴다.',
    goal: '합법적으로 건넬 수 있는 글과 사람의 이름을 지키며 인쇄망의 신뢰를 잃지 않는다.',
    secret: '동생에게 보내지 못한 봉투가 아직 그녀의 작업장 바닥판 아래 있다.',
    access: '서점·인쇄소·합법적 우편 전달망',
    memoryRules: ['플레이어가 원문을 직접 읽은 뒤 말한 경우에만 다음 봉투를 보인다.', '이름을 보호받으면 거리의 소문을 막아 준다.', '허세로 아는 척하면 대답 대신 날짜를 묻는다.']
  },
  pavel: {
    id: 'pavel', name: '파벨 안토노프', role: '우편 연락원', ageRange: '1836: 31–1849: 44',
    voice: '날씨·거리·말의 무게를 먼저 말하고, 직접적인 정치어를 피하며 전달 경로를 계산한다.',
    goal: '봉투가 누구 손에서 누구 손으로 갔는지 거짓 없이 남기고 자기 노선을 잃지 않는다.',
    secret: '폭설 때 배달하지 못한 봉투 하나의 발신인을 끝내 확인하지 못했다.',
    access: '도시 우편소와 마차·도보 전달 경로',
    memoryRules: ['실제 봉투를 맡긴 사람만 다음 경로를 알 수 있다.', '플레이어가 침묵하면 위험한 이름을 기록에서 뺀다.', '독촉받으면 전달 지연의 시간을 숨기지 않는다.']
  }
};

const arc = {
  C01: ['1836-10', '차다예프의 편지가 봉인된 행정 명령과 한 책상에 놓였다', '알렉세이는 압수 명령의 날짜를 먼저 보지만 예카테리나는 문장이 금지된 이유와 사람의 목소리를 갈라 보라고 요구한다', '문명의 고립을 말한 편지와 잡지 금지 명령을 같은 목소리로 묶지 않는다', '처음으로 서로의 이름을 숨겨 주는 선택'],
  C02: ['1836-11', '모스크바에서 온 비평문이 발신자 없는 번역 초안과 섞였다', '알렉세이는 발신자 칸을 비워 두려 하고 예카테리나는 번역자의 책임을 지우지 말라고 한다', '판본의 차이를 원문의 부족으로 오해하지 않는다', '알렉세이의 형 이야기가 처음 암시된다'],
  C03: ['1837-03', '푸시킨의 사망 소식과 언론의 반응이 서로 다른 봉투로 도착했다', '예카테리나는 사망 소식의 보도와 추모의 목소리를 구분하고 알렉세이는 관청의 발표 시각을 확인한다', '푸시킨의 사망 사실과 뒤늦은 평론을 같은 시각의 기록으로 만들지 않는다', '파벨이 우편 경로의 겨울 지연을 증언한다'],
  C04: ['1839-12', '문학 비평의 한 문장이 행정 보고서에 인용됐다', '알렉세이는 한 줄을 잘라 올리려 하고 예카테리나는 앞뒤 문장을 요구한다', '인용의 잘린 자리를 표시한 채 상신한다', '예카테리나가 플레이어의 기억을 시험한다'],
  C05: ['1840-04', '레르몬토프 초판과 벨린스키의 동시기 평론이 함께 도착했다', '예카테리나는 시인의 목소리와 평론가의 판단을 섞지 말라고 하며 알렉세이는 판본 번호를 찾는다', '초판의 문장과 비평의 해석을 각각의 증거로 남긴다', '다음 사건에서 두 사람이 서로 다른 인용을 기억한다'],
  C06: ['1841-07', '레르몬토프 결투의 수사 기록과 증언이 봉인된 채 도착했다', '알렉세이는 결투 수사의 공식 날짜를 먼저 보지만 예카테리나는 증언과 판정을 섞지 말라고 한다', '결투의 발생 사실과 뒤늦은 수사 기록을 서로 다른 시점의 증거로 남긴다', '알렉세이가 처음으로 규정 밖의 질문을 한다'],
  C07: ['1842-05', '《죽은 혼》의 수정 원고와 허가된 판본이 나란히 놓였다', '알렉세이는 허가가 곧 원형 보증이라고 믿고 예카테리나는 작가의 수정과 검열관의 선을 나눈다', '삭제된 장면의 부재와 작가의 수정을 두 문서로 분리한다', '예카테리나가 지난번 플레이어의 표현을 되받아친다'],
  C08: ['1842-02', '인쇄소에서 돌아온 교정지가 젖은 우편 봉투와 함께 왔다', '파벨은 봉투가 늦어진 시간을 말하고 예카테리나는 누가 교정지를 읽었는지 묻는다', '젖은 봉투의 흔적을 내용의 증거로 부풀리지 않는다', '파벨의 신뢰가 실제 전달 선택에 따라 달라진다'],
  C09: ['1844-06', '지방 인쇄 허가서와 수도의 회신이 날짜를 달리한다', '알렉세이는 회신일만 적으려 하지만 파벨은 출발일이 사라지면 책임의 길도 사라진다고 한다', '출발·도착·열람 시각을 세 칸으로 기록한다', '알렉세이가 가족 이야기를 농담으로 덮는다'],
  C10: ['1845-01', '문학 동회의 초대장이 공식 기록의 여백에서 발견됐다', '예카테리나는 초대받지 않은 사람이 알 수 있는 정보와 참석자의 말을 분리한다', '초대장 자체와 참석 여부를 같은 사실로 만들지 않는다', '처음으로 침묵이 관계를 지키는 선택이 된다'],
  C11: ['1845-09', '외국 서신의 번역본에 러시아어 원문이 붙어 있다', '파벨은 번역본만 배달하라는 지시를 받았고 예카테리나는 원문을 숨기지 말라고 한다', '번역자가 고른 단어와 발신자의 문장을 다른 층위로 보관한다', '파벨이 봉투의 무게를 기억한다'],
  C12: ['1846-03', '서사시의 첫 연이 관청의 요약문으로 바뀌어 있다', '알렉세이는 요약을 편리한 표제로 삼고 예카테리나는 첫 연의 리듬이 사라졌다고 한다', '요약문을 원문 대용으로 쓰지 않는다', '플레이어가 기억한 한 단어가 다음 대화의 열쇠가 된다'],
  C13: ['1846-09', '새 판본의 서문과 판매 목록이 다른 날짜로 인쇄됐다', '예카테리나는 판매 목록을 서문의 의도처럼 읽지 말라고 하고 알렉세이는 활자소를 확인한다', '서문·판본·판매 목록의 생성 시점을 분리한다', '알렉세이가 기록을 고치는 대신 여백을 남긴다'],
  C14: ['1847-07', '편집부로 향한 편지가 검열관의 메모와 함께 도착했다', '예카테리나는 7월에 실제로 오간 문장만 말하고 알렉세이는 메모의 수신자를 확인한다', '편지의 비판과 행정 메모의 판단을 한 사람의 말로 만들지 않는다', '두 사람의 첫 협력이 이후 접촉망을 연다'],
  C15: ['1847-03', '잡지 목차에 없는 글의 소문이 인쇄소에 번졌다', '파벨은 소문을 배달할 수 없다고 하고 예카테리나는 목차에 없는 것은 아직 책이 아니라고 한다', '소문의 존재와 글의 발행을 구분한다', '침묵을 택하면 파벨이 위험한 이름을 지킨다'],
  C16: ['1847-06', '정기간행물의 발행 공고와 독자의 항의가 같은 봉투에 들어왔다', '예카테리나는 공고는 약속이고 항의는 반응이라고 말하며 알렉세이는 두 장의 날짜를 맞춘다', '공고와 항의를 같은 장르의 증거로 합치지 않는다', '알렉세이가 플레이어의 문장 길이를 놀린다'],
  C17: ['1847-07', '금지·회수 공문과 판매 광고가 서로 어긋난다', '알렉세이는 집행 의무를 강조하고 예카테리나는 광고가 실제로 남았다는 관찰을 지운다면 기록도 거짓말이라고 한다', '결정·집행 지시·판매 흔적을 세 목소리로 나눈다', '알렉세이가 처음으로 위험을 함께 감수한다'],
  C18: ['1847-12', '벨린스키의 안네코프 서신과 정기간행물 공고가 연달아 왔다', '예카테리나는 서신의 사적 분노를 공적 발행 계획과 섞지 말라고 하고 파벨은 겨울 우편의 시간을 계산한다', '받는 사람이 다른 두 문서의 전달 경로를 분리한다', '예카테리나가 숨겨 둔 봉투의 이유가 드러난다'],
  C19: ['1849-02', '1848년 지면과 후대 평론이 한 자료철에 놓였다', '알렉세이는 최신 평론을 결론으로 삼으려 하고 예카테리나는 발행 시점의 간격을 먼저 보라고 한다', '동시기 지면과 뒤늦은 평론을 시간차가 있는 증언으로 둔다', '지난 사건에서 보호받은 이름이 다시 등장한다'],
  C20: ['1848-04', '혁명 소식의 번역 공고와 러시아 잡지의 편집 계획이 겹쳤다', '파벨은 국경을 넘은 소식의 경로를 말하고 예카테리나는 편집 계획이 곧 정치 논평은 아니라고 한다', '외국 소식의 도착과 국내 편집 결정을 따로 기록한다', '파벨이 전달 거절의 이유를 설명한다'],
  C21: ['1848-10', '1849년 《현대인》 발행 계획 공고와 삽화 연감의 판매 문구가 대조된다', '예카테리나는 공고의 발신자와 삽화가의 목소리를 나누고 알렉세이는 저자명을 확인한다', '1848년에 나온 발행 계획과 판매 문구를 서로 다른 기록으로 남긴다', '예카테리나가 플레이어에게 실제 봉투를 맡긴다'],
  C22: ['1848-12', '후속 검열 회신이 최초 접수 기록보다 늦게 도착했다', '알렉세이는 늦은 회신을 처음 판단의 근거로 쓰려 하고 파벨은 도착 전에는 아무도 읽지 못했다고 한다', '접수 시점과 열람 시점을 분리한다', '알렉세이가 자신의 실수를 인정한다'],
  C23: ['1849-02', '수사 기록의 증언·신문·판결 초안이 한 묶음으로 묶였다', '알렉세이는 증언을 판결처럼 읽지 않으려 하고 예카테리나는 신문이 본인의 목소리를 대신할 수 없다고 한다', '증언·보도·판결의 발화자를 보존한다', '세 사람의 기억 규칙이 처음 동시에 시험된다'],
  C24: ['1849-12-22', '1849년 12월 22일 수사와 선고의 마지막 기록이 봉인 직전 책상에 놓였다', '알렉세이는 12월 22일의 봉인을 서두르고 예카테리나는 한 장의 뒤집힌 종이를 가리키며 파벨은 누가 이 방에 들어왔는지 묻는다', '실제 판결·허구 서기의 기록·전달 경로를 마지막까지 분리한다', '세 사람의 구체적인 기억이 다섯 엔딩을 가른다']
};

const callbackLines = {
  C01: '서로의 이름을 지켜 준 그날',
  C02: '알렉세이 형 이야기가 처음 드러난 순간',
  C03: '파벨이 겨울 우편의 지연을 증언한 일',
  C04: '예카테리나가 내 기억을 시험한 순간',
  C05: '두 사람이 서로 다른 인용을 기억한 일',
  C06: '알렉세이가 규정 밖의 질문을 처음 던진 순간',
  C07: '예카테리나가 지난번 내 말을 되받아친 순간',
  C08: '전달을 맡긴 뒤 파벨의 신뢰가 달라진 일',
  C09: '알렉세이가 가족 이야기를 농담으로 덮은 순간',
  C10: '침묵으로 서로를 지킨 그날',
  C11: '파벨이 봉투의 무게를 기억한 일',
  C12: '내가 기억한 한 단어가 다음 대화의 열쇠가 된 일',
  C13: '알렉세이가 기록을 고치는 대신 여백을 남긴 일',
  C14: '두 사람이 처음 손을 맞잡은 순간',
  C15: '파벨이 위험한 이름을 지켜 준 일',
  C16: '알렉세이가 내 문장 길이를 놀린 순간',
  C17: '알렉세이가 처음으로 위험을 함께 감수한 일',
  C18: '예카테리나가 봉투를 숨긴 이유를 털어놓은 순간',
  C19: '지난 사건에서 지킨 이름이 다시 나타난 일',
  C20: '파벨이 전달을 거절한 이유를 설명한 순간',
  C21: '예카테리나가 내게 실제 봉투를 맡긴 일',
  C22: '알렉세이가 자신의 실수를 인정한 순간',
  C23: '세 사람의 기억이 한꺼번에 시험받은 순간',
  C24: '세 사람의 기억이 다섯 갈래를 가른 순간'
};

const clean = (s) => String(s).replace(/[“”]/g, '"');
const hasBatchim = (text) => {
  const chars = [...String(text).trim()];
  const last = chars.at(-1)?.charCodeAt(0) || 0;
  return last >= 0xAC00 && last <= 0xD7A3 && (last - 0xAC00) % 28 !== 0;
};
const withParticle = (text, batchimParticle, openParticle) => `${String(text).trim()}${hasBatchim(text) ? batchimParticle : openParticle}`;
const evidenceTopic = (text) => String(text)
  .replace(/(?:하지 않는다|않는다|한다|둔다|기록한다|분리한다|표시한다|남긴다|확인한다)$/, '')
  .trim();
const makeChoice = (caseId, index, spokenKo, reactionKo, effects, revealsTo) => ({
  id: `V28-${caseId}-CHOICE-${index}`, spokenKo, actionChannel: 'SPOKEN', edgeTo: `V28-${caseId}-REACTION-${index}`, effects, revealsTo,
  reactionKo, historicalClaims: []
});

const cases = [...bundle.cases].map((oldCase) => {
  const id = oldCase.caseId; const [dateRange, conflict, tension, evidenceBeat, callbackSeed] = arc[id] || ['1847', oldCase.titleKo, '자료를 둘러싼 갈등이 생겼다', '원문과 번역을 분리한다', '이전 일을 기억한 순간']; const callback = callbackLines[id] || callbackSeed;
  const source = oldCase.sources?.[0]?.sourceId || `${id}-SOURCE-1`; const excerpts = (oldCase.excerpts || []).slice(0, 2).map(x => x.excerptId); const topic = evidenceTopic(evidenceBeat);
  const conflictObject = withParticle(conflict, '을', '를');
  const topicObject = withParticle(topic, '을', '를');
  const intro = [
    { id:`V28-${id}-ARRIVAL-1`, caseId:id, dateRange:[dateRange,dateRange], speakerId:'NARRATION_MINIMAL', utteranceKo:`${dateRange}의 비가 봉투 모서리를 적셨다. 오늘 아침, ${conflict}.`, locationId:'petersburg-office', historicalClaims:[{sourceId:source,excerptId:excerpts[0],classification:'PARAPHRASE'}] },
    { id:`V28-${id}-ALEXEI-1`, caseId:id, dateRange:[dateRange,dateRange], speakerId:'alexei', utteranceKo:`${tension}. 우선 봉인을 확인하지. 봉인은 글보다 먼저 거짓말을 하거든.`, poseId:'desk-lean', historicalClaims:[] },
    { id:`V28-${id}-EKATERINA-1`, caseId:id, dateRange:[dateRange,dateRange], speakerId:'ekaterina', utteranceKo:`봉인만 보면 편해요. 하지만 오늘은 “${evidenceBeat}”라고 적힌 줄부터 물어야 해요. 누가 무엇을 보았는지요.`, poseId:'coat-turn', historicalClaims:[] },
    { id:`V28-${id}-PAVEL-1`, caseId:id, dateRange:[dateRange,dateRange], speakerId:'pavel', utteranceKo:`길은 기록보다 느립니다. ${dateRange}의 그 봉투가 여기까지 온 시간도 내용의 일부로 남겨 두세요.`, poseId:'doorway', historicalClaims:[] }
  ];
  const choices = [
    makeChoice(id,1,`알렉세이, ${conflictObject}의 봉인과 본문을 나눠 적겠습니다. 먼저 누구 손을 거쳤는지 확인해 주세요.`,`알렉세이: ${dateRange}의 봉인을 그렇게까지 칸으로 나누면 일이 늦어져. 그래도 네 이름으로 남긴다면 내가 출발 시각은 찾아보지.`,{trust:{alexei:1},access:{officialRecord:1}},['alexei']),
    makeChoice(id,2,`예카테리나, ${conflict}에서 원문으로 실제 읽은 문장만 말해 주세요. 나머지는 제가 추측으로 채우지 않겠습니다.`,`예카테리나: ${tension}. 이제야 제대로 묻네요. 그럼 내가 숨긴 줄과 보여 줄 줄을 구분해 볼게요.`,{trust:{ekaterina:1},access:{dossierEvidence:1}},['ekaterina']),
    makeChoice(id,3,`파벨, ${conflictObject}의 봉투를 다음 사람에게 맡기겠습니다. 이름과 도착 시각을 함께 적어도 될까요?`,`파벨: ${dateRange}의 길에서 이름을 적으면 안전해지는 때도, 끊기는 때도 있습니다. 이번에는 도착 시각부터 쓰지요.`,{trust:{pavel:1},access:{crossBorder:1},relation:{editorContact:1}},['pavel'])
  ];
  choices[0].spokenKo = `알렉세이, ${conflictObject}의 봉인과 본문을 나눠 적겠습니다. 먼저 누구 손을 거쳤는지 확인해 주세요.`;
  choices[0].reactionKo = `${dateRange}의 봉인을 그렇게까지 칸을 나누면 일이 늦어져. 그래도 네 이름으로 남긴다면 내가 출발 시각은 찾아보지.`;
  choices[1].spokenKo = `예카테리나, ${evidenceBeat}를 원문에서 실제로 읽은 문장만 말해 주세요. 나머지는 제가 추측으로 채우지 않겠습니다.`;
  choices[1].reactionKo = `그 차이를 원문으로 확인하겠다고요? ${oldCase.titleKo}에서 숨긴 줄과 보여 줄 줄을 구분해 볼게요. 이제야 제대로 묻네요.`;
  choices[2].spokenKo = `파벨, ${dateRange}의 이 봉투를 다음 사람에게 맡기겠습니다. 이름과 도착 시각을 함께 적어도 될까요?`;
  choices[2].reactionKo = `${dateRange}의 그 봉투가 여기까지 온 길은 짧지 않았습니다. 이름은 봉투보다 먼저 움직이니 도착 시각부터 쓰지요.`;
  choices[0].spokenKo = `알렉세이, ${oldCase.titleKo}의 봉인과 본문을 나눠 적겠습니다. 출발 시각을 확인해 주세요.`;
  choices[1].spokenKo = `예카테리나, ${oldCase.titleKo}에서 실제로 읽은 문장만 말해 주세요. 나머지는 추측하지 않겠습니다.`;
  choices[2].spokenKo = `파벨, ${oldCase.titleKo}의 봉투를 맡기겠습니다. 이름과 도착 시각도 적을까요?`;
  const reactions = choices.map((choice) => ({ id:choice.edgeTo, caseId:id, dateRange:[dateRange,dateRange], speakerId:choice.revealsTo[0], utteranceKo:choice.reactionKo, historicalClaims:[] }));
  const evidence = [
    { id:`V28-${id}-INSPECT-1`, caseId:id, dateRange:[dateRange,dateRange], speakerId:'NARRATION_MINIMAL', utteranceKo:`책상 위에서 원문과 번역을 맞춘다. “${evidenceBeat}”라고 적힌 대목을 먼저 확인한다. ${oldCase.question || '문서의 생성 시점을 확인한다'}.`, historicalClaims:excerpts.map(excerptId=>({sourceId:source,excerptId,classification:'PARAPHRASE'})) },
    { id:`V28-${id}-EVIDENCE-1`, caseId:id, dateRange:[dateRange,dateRange], speakerId:'ekaterina', utteranceKo:`“${evidenceBeat}”라는 원칙을 읽고도 같은 판단을 하겠어요? ${oldCase.titleKo}를 읽기 전과 읽은 뒤의 말을 구분해야 해요.`, historicalClaims:[] },
    { id:`V28-${id}-EVIDENCE-2`, caseId:id, dateRange:[dateRange,dateRange], speakerId:'alexei', utteranceKo:`좋아. ${oldCase.titleKo}에서 네가 본 것과 내가 두려워한 것을 한 줄에 섞지 않겠다.`, historicalClaims:[] }
  ];
  const closing = [
    { id:`V28-${id}-CLOSE-1`, caseId:id, dateRange:[dateRange,dateRange], speakerId:'NARRATION_MINIMAL', utteranceKo:`기록을 접기 전, ${callback}라는 말이 책상 위에 남았다.`, historicalClaims:[] },
    { id:`V28-${id}-CLOSE-2`, caseId:id, dateRange:[dateRange,dateRange], speakerId:'alexei', utteranceKo:`다음번에는 ${conflict}에서 네가 고른 문장을 기억하고 오겠지. 나는 ${dateRange}의 봉인을 기억하겠다.`, historicalClaims:[] },
    { id:`V28-${id}-CLOSE-3`, caseId:id, dateRange:[dateRange,dateRange], speakerId:'ekaterina', utteranceKo:`“${evidenceBeat}”라는 원칙에 관한 다음 봉투를 가져올게요. 다만 오늘의 침묵까지 같은 뜻이었다고 쓰지는 마세요.`, historicalClaims:[] },
    { id:`V28-${id}-CLOSE-4`, caseId:id, dateRange:[dateRange,dateRange], speakerId:'pavel', utteranceKo:`${dateRange}의 문이 닫히기 전까지는 전달이 끝난 게 아닙니다. 누가 ${oldCase.titleKo}를 들었는지도 함께 남겨 주세요.`, historicalClaims:[] }
  ];
  const memory = [
    { id:`V28-${id}-MEMORY-A`, caseId:id, dateRange:[dateRange,dateRange], speakerId:'alexei', utteranceKo:`${callback}. 그 말을 다음 장부의 빈 칸에 적어 두지는 않겠지만, 나는 잊지 않겠다.`, historicalClaims:[] },
    { id:`V28-${id}-MEMORY-E`, caseId:id, dateRange:[dateRange,dateRange], speakerId:'ekaterina', utteranceKo:`다음에 만났을 때 “${evidenceBeat}”라는 원칙을 기억하고 있다면, 그때는 봉투를 한 겹 덜 접어도 되겠네요.`, historicalClaims:[] },
    { id:`V28-${id}-MEMORY-P`, caseId:id, dateRange:[dateRange,dateRange], speakerId:'pavel', utteranceKo:`${dateRange}의 길이는 짧지 않았습니다. 누가 들었는지 묻는 사람에게는 당신이 고른 말부터 전하겠습니다.`, historicalClaims:[] },
    { id:`V28-${id}-PLAYER`, caseId:id, dateRange:[dateRange,dateRange], speakerId:'PLAYER_ACTION', utteranceKo:`오늘은 ${oldCase.titleKo}를 한 사람의 의도로 줄이지 않겠다고 말한다.`, choices:[], historicalClaims:[] },
    { id:`V28-${id}-AFTERMATH`, caseId:id, dateRange:[dateRange,dateRange], speakerId:'NARRATION_MINIMAL', utteranceKo:`봉투의 접힌 선과 남겨 둔 이름이 다음 방문의 문턱이 된다. ${tension}. 이 기록의 답은 아직 닫히지 않았다.`, historicalClaims:[] }
  ];
  const nodes = [...intro, ...choices.map(c=>({id:c.edgeTo.replace('REACTION','CHOICE'),caseId:id,dateRange:[dateRange,dateRange],speakerId:'PLAYER_ACTION',utteranceKo:c.spokenKo,choices:[c]})), ...reactions, ...evidence, ...memory, ...closing];
  return { caseId:id, dateRange:[dateRange,dateRange], titleKo:oldCase.titleKo, sourceStatus:oldCase.sourceStatus, conflict, dramaticPurpose: tension, sourceIds:oldCase.sources?.map(x=>x.sourceId)||[source], nodes, entryNodeId:intro[0].id, choices, memoryCallback:callback, afterScene:`${id}-AFTERMATH`, historicalExcerptIds:excerpts };
}).sort((a,b)=>String(a.dateRange[0]).localeCompare(String(b.dateRange[0])));

// The four release-slice cases are hand-authored scene scripts, not output from the generic packet loop.
const releaseSlice = {
  C01: {
    lines:[['NARRATION_MINIMAL','1836년 10월, 봉인된 명령서와 차다예프의 편지가 같은 책상에 놓였다.'],['alexei','나는 명령서의 날짜부터 적겠어. 이름을 잘못 옮기면 내일 아침에 내 자리가 없어져.'],['ekaterina','그럼 편지는 누가 읽었는지조차 사라져요. 금지된 문장과 금지하라는 명령은 같은 목소리가 아니니까.'],['pavel','모스크바에서 온 봉투는 사흘 젖어 있었습니다. 발신인의 말보다 먼저 도착 경로가 보였지요.'],['PLAYER_ACTION','나는 봉인과 문장을 한 줄로 묶지 않겠다고 말한다.'],['alexei','네가 지금 그 말을 기록에 넣지는 않겠지?'],['PLAYER_ACTION','기록에 넣기 전에, 우리 셋이 무엇을 직접 보았는지부터 확인하죠.'],['ekaterina','좋아요. 그럼 내가 읽은 대목과 들은 소문을 나눠 말할게요.'],['NARRATION_MINIMAL','차다예프의 편지 첫 문장과 잡지 압수 명령을 나란히 펼쳤다.'],['ekaterina','여기서 편지는 자기 나라를 진단하고, 명령서는 잡지를 거두라고 합니다. 하나가 다른 하나의 해설은 아니에요.'],['alexei','문장을 읽었다고 해서 명령을 거부한 건 아니야. 하지만 명령서가 편지의 뜻을 대신하게 두지도 말자.'],['pavel','봉투를 누구에게 돌렸는지 남기면, 나중에 누가 그 문장을 보았는지 찾을 수 있습니다.'],['PLAYER_ACTION','나는 발신·수신·열람 시각을 따로 적는다.'],['alexei','좋아. 오늘은 칸을 늘리는 게 겁나는 날이 아니었군.'],['ekaterina','다음에 만났을 때도 이 선을 기억하세요. 소문은 원문보다 빨리 걷거든요.'],['pavel','문은 닫겠습니다. 봉투는 아직 누구의 것도 되지 않았습니다.'],['NARRATION_MINIMAL','첫 기록은 이름을 지우지 않고도 사람을 숨길 수 있다는 약속으로 접혔다.'],['alexei','다음 봉투가 오면 네가 먼저 읽어. 오늘은 내가 너무 빨리 결론을 냈으니까.']],
    choices:[['알렉세이의 명령서부터 읽되, 편지의 문장을 따로 보존하자.', '알렉세이: 순서는 받아들이겠어. 다만 편지의 문장은 접지 말자.', {trust:{alexei:1},access:{officialRecord:1}}, ['alexei']],['편지의 목소리를 먼저 듣고, 금지 명령은 그 뒤에 대조하자.','예카테리나: 이번에는 당신이 문장을 먼저 지켰네요. 다음 봉투를 보여 드리죠.',{trust:{ekaterina:1},access:{dossierEvidence:1}},['ekaterina']],['이 봉투는 내가 맡겠다. 세 사람의 이름은 아직 적지 말자.','파벨: 이름을 늦추는 건 숨기는 일과 다릅니다. 오늘은 그 차이를 배달하지요.',{trust:{pavel:1},access:{crossBorder:1}},['pavel']]]
  },
  C07: {
    lines:[['NARRATION_MINIMAL','1841년 겨울, 수정된 《죽은 혼》 원고와 허가 표기가 한 묶음으로 돌아왔다.'],['alexei','도장이 찍혔으니 읽을 수 있는 원고야. 없는 장면을 찾아내는 건 내 일이 아니고.'],['ekaterina','그 말이 가장 편하죠. 그런데 이 줄은 원고에서 사라졌고, 여백에는 작가의 손이 남아 있어요.'],['pavel','인쇄소에서 돌아오는 길에 봉투를 한 번 더 묶었습니다. 누가 열었는지는 모르지만, 젖은 자국은 보입니다.'],['PLAYER_ACTION','허가된 판본과 원고의 차이를 먼저 보여 달라고 말한다.'],['alexei','차이를 보여 주면 누군가는 삭제 이유까지 쓰라고 하겠지.'],['PLAYER_ACTION','이유를 모르면 이유를 쓰지 않겠습니다. 사라진 자리만 정확히 남기죠.'],['ekaterina','그게 내가 원한 답이에요. 작가가 고친 말과 검열관이 지운 말은 서로의 대리인이 아니니까.'],['NARRATION_MINIMAL','원고의 행과 허가된 인쇄본의 빈자리를 번갈아 확인했다.'],['alexei','나는 방금까지 허가를 원형의 증명처럼 쓰려 했어. 그건 편했을 뿐이군.'],['ekaterina','편한 문장은 오래 남지만, 남겨야 할 문장과 같지는 않아요.'],['pavel','다음 인쇄소로 돌릴 때 어느 판본을 맡겼는지도 적어 두겠습니다.'],['PLAYER_ACTION','삭제된 대목과 수정된 대목을 서로 다른 봉투에 넣는다.'],['alexei','이렇게 하면 내 장부에는 빈칸이 생겨. 이상하게도 그게 더 정직해 보여.'],['ekaterina','지난번에 당신이 지킨 날짜를 기억하고 있어요. 이번엔 문장도 그렇게 지켜 봐요.'],['pavel','눈이 그쳤습니다. 하지만 원고는 아직 이동 중인 물건입니다.'],['NARRATION_MINIMAL','허가 표기는 결말이 아니라 다음 질문을 여는 표지로 남았다.'],['alexei','다음번엔 내가 먼저 삭제된 줄을 묻겠다. 규정이 대답해 주지 않아도.']],
    choices:[['허가 표기를 먼저 적고, 원고의 빈자리는 부록에 둔다.','알렉세이: 그 정도면 장부가 버티겠지. 빈자리를 없던 일로 만들지는 않겠어.',{trust:{alexei:1},access:{officialRecord:1}},['alexei']],['삭제된 대목을 먼저 대조하자. 허가가 원고 전체를 대신하지는 않는다.','예카테리나: 이제야 같은 종이를 보고 다른 일을 말하네요.',{trust:{ekaterina:1},access:{dossierEvidence:1}},['ekaterina']],['판본을 나누지 말고 인쇄소에 그대로 돌려보낸다.','파벨: 그 봉투는 가벼워지겠지만, 도착한 뒤에는 누가 책임졌는지 남습니다.',{trust:{pavel:1},access:{crossBorder:1}},['pavel']]]
  },
  C17: {
    lines:[['NARRATION_MINIMAL','1847년 7월, 금지·회수 공문과 판매 광고가 서로 다른 날짜로 책상에 도착했다.'],['alexei','공문은 명령이야. 광고가 남아 있다는 사실이 명령을 없애지는 않아.'],['ekaterina','물론이죠. 하지만 광고를 지우면 실제로 무엇이 보였는지도 같이 지워져요.'],['pavel','나는 광고가 실린 호를 이틀 늦게 받았습니다. 늦었다는 사실도 집행의 일부입니다.'],['PLAYER_ACTION','결정, 집행 지시, 판매 흔적을 세 문서로 나누자고 제안한다.'],['alexei','세 칸이면 상급자는 귀찮아하겠지. 그래도 한 칸으로 만들면 더 큰 거짓말이 돼.'],['PLAYER_ACTION','광고를 보았다는 사실과 누가 읽었는지는 구별해서 적겠습니다.'],['ekaterina','좋아요. 내 이름을 광고의 증인처럼 쓰지 않는다면, 나는 호수와 페이지를 알려 줄 수 있어요.'],['NARRATION_MINIMAL','공문의 명령문, 회수 지시, 실제 판매 광고를 각각 펼쳤다.'],['alexei','명령은 분명하지만, 집행 결과까지 말해 주지는 않는군.'],['ekaterina','그리고 광고는 저항의 선언도 아니에요. 그저 그 날짜에 그 지면이 남아 있었다는 증거죠.'],['pavel','누가 어느 우편소에서 그 호를 받았는지까지는 내가 책임지고 적겠습니다.'],['PLAYER_ACTION','집행이 끝났다고 추정하지 않고, 확인된 수신만 봉인한다.'],['alexei','네가 멈추자 내가 서두르고 있었다는 게 보이는군.'],['ekaterina','지난번의 빈자리보다 이번엔 더 위험한 이름이 있어요. 아직 적지 않을게요.'],['pavel','오늘의 봉투는 내가 맡겠습니다. 다음에 돌려받을 때 열어 본 사람을 말하죠.'],['NARRATION_MINIMAL','결정과 흔적 사이의 거리가 다음 겨울까지 남았다.'],['alexei','이번에는 규정 뒤에 숨지 않겠다. 다만 네 이름도 나와 함께 쓰지는 말자.']],
    choices:[['공문을 상신하고 광고는 관찰 기록으로만 남긴다.','알렉세이: 명령과 관찰을 갈라 둔 건 옳아. 책임의 방향도 흐려지지 않겠지.',{trust:{alexei:1},access:{officialRecord:1}},['alexei']],['광고의 호수와 페이지를 먼저 예카테리나에게 확인한다.','예카테리나: 이제 그 지면을 내 입으로 과장하지 않아도 되겠네요.',{trust:{ekaterina:1},access:{dossierEvidence:1}},['ekaterina']],['봉인을 보류하고 파벨에게 실제 전달 경로를 맡긴다.','파벨: 위험을 늦춘다고 없애지는 못합니다. 그래도 누구 손에 갔는지는 지킬 수 있어요.',{trust:{pavel:1},access:{crossBorder:1}},['pavel']]]
  },
  C24: {
    lines:[['NARRATION_MINIMAL','1849년 봄, 수사 기록과 선고 문서가 봉인되기 직전 책상에 놓였다.'],['alexei','마지막 장부야. 여기서 한 줄을 틀리면 살아 있는 사람도 죽은 사람도 같은 이름이 돼.'],['ekaterina','그래서 마지막일수록 천천히 읽어야 해요. 증언이 판결의 목소리인 척하고 있지는 않은지.'],['pavel','문밖에 두 번 발소리가 났습니다. 누가 들었는지는 말할 수 있지만, 누가 명령했는지는 모릅니다.'],['PLAYER_ACTION','판결과 증언과 내가 본 방을 세 겹으로 나누자고 말한다.'],['alexei','이제 와서도 네 기록과 국가의 기록을 나누겠다는 건가?'],['PLAYER_ACTION','네. 내가 본 것을 판결의 문장으로 바꾸지 않겠습니다.'],['ekaterina','그 약속을 기억할게요. 대신 원문에 없는 위로도 덧붙이지 말아요.'],['NARRATION_MINIMAL','수사 기록의 증언, 선고 문서, 봉인 직전의 방을 따로 열람했다.'],['alexei','봉인은 닫히겠지만, 빈칸까지 닫을 수는 없어. 그걸 인정하는 게 내 몫이군.'],['ekaterina','당신이 오늘 누구에게 무엇을 건넸는지가 남아요. 이름보다 오래 갈 수도 있어요.'],['pavel','나는 문밖의 두 발소리를 기록하겠습니다. 들었다는 말과 보았다는 말은 다르니까요.'],['PLAYER_ACTION','마지막 종이를 누구에게 돌릴지 실제로 말한다.'],['alexei','그 선택은 네가 혼자 믿는 생각보다 무겁다. 누군가 들었으니까.'],['ekaterina','처음 만났을 때 당신은 소문과 원문을 나눴죠. 오늘은 판결과 기억을 나눴어요.'],['pavel','봉투가 떠납니다. 이번엔 어느 길로 갔는지 숨기지 않겠습니다.'],['NARRATION_MINIMAL','역사의 판결은 그대로 남고, 세 사람이 들은 말의 책임만 서로 다른 방향으로 흘렀다.'],['alexei','문을 닫겠습니다. 네가 적은 한 줄은, 내가 읽었다고만 남기지.']],
    choices:[['알렉세이와 공식 기록을 맞추고, 내가 본 방은 사적으로 남긴다.','알렉세이: 공식 칸과 네 칸을 나눈다면, 봉인을 맡을 수 있어.',{trust:{alexei:1},access:{officialRecord:1}},['alexei']],['예카테리나에게 원문을 돌려주고 이름은 쓰지 않는다.','예카테리나: 그럼 나는 이 문장을 밖으로 옮기지 않고도 지킬 수 있겠어요.',{trust:{ekaterina:1},access:{dossierEvidence:1}},['ekaterina']],['파벨에게 전달을 맡기고 수신·열람 경로를 공개한다.','파벨: 숨기지 않는 경로는 위험하지만, 적어도 다음 사람이 어디서 시작할지는 압니다.',{trust:{pavel:1},access:{crossBorder:1}},['pavel']]]
  }
};
for (const [id, custom] of Object.entries(releaseSlice)) {
  const base = cases.find(item=>item.caseId===id); if (!base) continue;
  const nodes=custom.lines.map(([speakerId,utteranceKo],index)=>({id:`V29-${id}-LINE-${index+1}`,caseId:id,dateRange:base.dateRange,speakerId,utteranceKo,historicalClaims:[]}));
  const choices=custom.choices.map(([spokenKo,reactionKo,effects,revealsTo],index)=>makeChoice(id,index+1,spokenKo,reactionKo,effects,revealsTo));
  const choiceNodes=choices.map(choice=>({id:choice.edgeTo.replace('REACTION','CHOICE'),caseId:id,dateRange:base.dateRange,speakerId:'PLAYER_ACTION',utteranceKo:choice.spokenKo,choices:[choice],historicalClaims:[]}));
  const reactions=choices.map(choice=>({id:choice.edgeTo,caseId:id,dateRange:base.dateRange,speakerId:choice.revealsTo[0],utteranceKo:choice.reactionKo,historicalClaims:[]}));
  const legacy= bundle.cases.find(item=>item.caseId===id); const sourceId=legacy?.sources?.[0]?.sourceId||base.sourceIds[0]; const excerptIds=(legacy?.excerpts||[]).slice(0,3).map(item=>item.excerptId);
  nodes.push(...choiceNodes,...reactions,{id:`V29-${id}-INSPECT`,caseId:id,dateRange:base.dateRange,speakerId:'NARRATION_MINIMAL',utteranceKo:`${base.titleKo}의 원문과 한국어 번역을 나란히 펼쳐, 서로 다른 문서의 목소리를 확인한다.`,historicalClaims:excerptIds.map(excerptId=>({sourceId,excerptId,classification:'PARAPHRASE'}))});
  base.nodes=nodes;base.choices=choices;base.entryNodeId=nodes[0].id;base.dramaticPurpose=`${base.dramaticPurpose} (release-slice authored scene)`;
}

const endings = [
  {id:'DOSTOEVSKY_PETRASHEVSKY', title:'문을 닫기 전의 목소리', requiredMemory:['alexei','pavel'], dialogue:['알렉세이: 네가 끝까지 이름을 함부로 쓰지 않은 일을 기억하겠다.','파벨: 봉투는 도착했지만, 누가 읽었는지는 아직 우리 셋의 말로 남아 있습니다.']},
  {id:'HERZEN', title:'먼 곳으로 건너간 종이', requiredMemory:['ekaterina','pavel'], dialogue:['예카테리나: 이번에는 내가 봉투를 맡길게요. 당신은 그 안의 빈칸을 거짓으로 메우지 않았으니까.','파벨: 강을 건넌 종이는 돌아오지 않아도, 건넨 사람은 기억됩니다.']},
  {id:'KHOMYAKOV', title:'같은 땅의 다른 문장', requiredMemory:['alexei','ekaterina'], dialogue:['알렉세이: 규정이 모든 것을 설명하지 못한다는 말을 네가 먼저 했지. 이제 내가 그 문장을 남긴다.','예카테리나: 같은 땅을 말해도 같은 목소리일 필요는 없어요.']},
  {id:'BELINSKY', title:'인쇄소에 남은 불빛', requiredMemory:['ekaterina'], dialogue:['예카테리나: 비판을 숨기지 않고도 사람의 이름을 지킬 수 있다는 걸 오늘 배웠어요.','알렉세이: 나는 아직 겁이 나지만, 네 문장을 지우지는 않겠다.']},
  {id:'UVAROV', title:'봉인된 기록의 안쪽', requiredMemory:['alexei'], dialogue:['알렉세이: 봉인은 닫혔고, 네 기록은 그 안에 있다. 내가 지킬 수 있는 선은 여기까지다.','파벨: 도착 경로는 남겼습니다. 나머지는 각자의 책임으로 두지요.']}
];

const graph = {schemaVersion:'V28-VN-1', generatedAt:new Date().toISOString(), characters:characterSeeds, cases, endings, rules:{noRuntimeTemplateCopy:true, privateMemoryRequiresWitness:true, historicalOutcomesImmutable:true}};
fs.mkdirSync('narrative',{recursive:true});
fs.writeFileSync('narrative/VN_DIALOGUE_GRAPH.json', JSON.stringify(graph,null,2));
fs.writeFileSync('narrative/ENDING_DIALOGUES.json', JSON.stringify(endings,null,2));
console.log(`v28-author-narrative: ${cases.length} cases, ${cases.flatMap(c=>c.nodes).length} nodes, ${cases.reduce((n,c)=>n+c.choices.length,0)} meaningful choices, ${endings.length} endings`);
