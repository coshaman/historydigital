# MAIN 20분 대본 전체 원고 — V36

원본: narrative/MAIN_20MIN_DIALOGUE.json
SHA-256: 25f245f8e3667575ce0ee572c458ed8eaccdc3ae8eb2850e43b7e2a9137bd66c

> 원문·번역·출처 위치·입수 분류를 함께 보존합니다.

## C03 · 푸시킨의 죽음과 첫 부고 · 1837년 1월 31일

시간축: 1837년 겨울 · 아직 조사 편지는 도착하지 않았다.
자료 프레임: 현대 한국인이 공개된 1837년 신문 전사를 아카이브에서 읽습니다. 허구의 서기는 두 인쇄물을 같은 봉투로 받았다고 역사적 사실처럼 주장하지 않습니다.
쟁점: 부고의 사실과 애도의 목소리가 다를 때 무엇을 먼저 보존할까?

### 도입
1. **NARRATION** 상트페테르부르크의 아침. 잉크가 마르기도 전에 알렉산드르 푸시킨의 이름이 인쇄소와 복도를 돌았다.
2. **ekaterina** 사람들이 울고 있다는 소식이 벌써 퍼졌어요. 푸시킨은 시를 읽지 않는 사람도 이름을 아는 사람이었으니까요.
3. **alexei** 그리고 같은 날 나온 신문 부고가 두 장 들어왔습니다. 한 장은 큰 슬픔을, 다른 한 장은 그의 문학 활동과 공헌을 앞세워요.
4. **ekaterina** 오늘은 1월 말이에요. 아직 사망 원인을 확인한 후대 조사 자료는 오지 않았습니다. 지금 책상에 있는 건 이 두 부고뿐이에요.
5. **NARRATION** 두 신문이 펼쳐진다. 먼저 각각의 글을 읽고, 확인한 사실과 당시 사람들이 남긴 목소리를 나누어 보아야 한다.

### 첫 선택
#### C03-A
- 플레이어: 두 부고가 같은 죽음을 다르게 전하네요. 날짜와 신문 이름을 나란히 적겠습니다.
- 행동: public_citation
- 반응: 좋아. 원인은 아직 비워 두자. 빈칸을 남기는 편이 틀린 이름을 남기는 것보다 낫다.
- 의미: {"selectedExactExcerpt":"C03-R1,C03-R2","claim":"두 매체의 애도 어조와 공적 감사는 같은 사실이 아니다","channel":"spoken","whoHears":["PUBLIC"],"observableConsequence":"twoWitnessesSeparated","relationshipJustification":"알렉세이는 인쇄면을 구분하는 태도를 책임감으로 읽는다","visibility":"PUBLIC"}

#### C03-B
- 플레이어: 사람들이 슬퍼한 문장을 빼면 상실의 목소리가 사라져요. 사실과 나란히 보관하죠.
- 행동: preserve_public_grief
- 반응: 이제야 읽는 사람에게 선택권을 돌려주네요. 슬픔은 사실이 아니지만, 사라져도 안 되는 증언이에요.
- 의미: {"selectedExactExcerpt":"C03-R1","claim":"공적 애도는 원인의 증명이 아니지만 보존할 증언이다","channel":"spoken","whoHears":["PUBLIC"],"observableConsequence":"mourningKeptBesideFact","relationshipJustification":"예카테리나는 감정과 사실을 분리한 보존을 신뢰한다","visibility":"PUBLIC"}

#### C03-C
- 플레이어: 신문 이름만 옮기지 말고 누가 어느 신문을 건넸는지 적겠습니다. 소식이 전해진 길도 남기겠습니다.
- 행동: trace_print_route
- 반응: 기다리는 데도 값이 듭니다. 그래도 모르는 발신자를 적는 값보다는 싸죠.
- 의미: {"selectedExactExcerpt":"C03-R2","claim":"전달 경로는 내용의 진위를 대신하지 않지만 노출 위험을 드러낸다","channel":"delivery","whoHears":["pavel"],"observableConsequence":"printRouteLogged","relationshipJustification":"파벨은 인수 기록이 실제 위험을 줄인다고 본다","visibility":"DELIVERY_NETWORK"}

### 실제 원문·번역
#### C03-R1 · 30 января 1837, first mourning notice
- 러시아어: Солнце нашей поэзии закатилось! Пушкин скончался, скончался во цвете лет, в средине своего великого поприща!.. Более говорить о сем не имеем силы, да и не нужно; всякое Русское сердце знает всю цену этой невозвратимой потери, и всякое Русское сердце будет растерзано. Пушкин! наш поэт! наша радость, наша народная слава!.. Неужели в самом деле нет уже у нас Пушкина?.. К этой мысли нельзя привыкнуть!
- 한국어: 우리 시의 태양이 저물었습니다! 푸시킨은 삶의 한창때, 위대한 여정의 한가운데서 세상을 떠났습니다. 이 소식에 더 말할 힘도, 필요도 없습니다. 모든 러시아인의 마음이 이 돌이킬 수 없는 상실의 값을 알고 갈기갈기 찢길 테니까요. 푸시킨, 우리의 시인, 우리의 기쁨, 우리의 민족적 영광이여! 정말 이제 우리에게 푸시킨이 없는 것일까요? 이 생각에는 익숙해질 수 없습니다.
- 출처: https://ru.wikisource.org/wiki/О_смерти_Пушкина_(Пушкин)
- 발행/판본: Литературные прибавления к «Русскому инвалиду» / checked public transcription
- 작성일/최초 열람: 1837-01-30 / 1837-01-30
- provenance: reviewed against the cited continuous passage
- 입수 분류: MODERN_ARCHIVE_READING
- omission: NONE

#### C03-R2 · 30 января 1837, separate newspaper notice
- 러시아어: Пораженные глубочайшей горестью, мы не будем многоречивы при сем извещении. Россия обязана Пушкину благодарностью за 22-летние заслуги его на поприще словесности, ряд его блистательнейших и полезнейших успехов в сочинениях всех родов.
- 한국어: 깊은 슬픔에 잠긴 우리는 이 소식에 말을 많이 보태지 않겠습니다. 러시아는 문학의 길에서 22년 동안 공헌한 푸시킨에게, 모든 종류의 작품에서 거둔 빛나고 유익한 성취에 대해 감사해야 합니다.
- 출처: https://ru.wikisource.org/wiki/О_смерти_Пушкина_(Пушкин)
- 발행/판본: «Северная пчела» / checked public transcription
- 작성일/최초 열람: 1837-01-30 / 1837-01-30
- provenance: reviewed against the cited continuous passage
- 입수 분류: MODERN_ARCHIVE_READING
- omission: NONE

### 후대 도착 자료 — 현재 장면에서 읽지 않음
- 1837-03-24 · C03-S2 · 푸시킨 사후 조사 편지 · LATER_DOCUMENT_NOT_IN_INITIAL_SCENE

### 읽은 뒤의 두 번째 선택
#### C03-P1
- 플레이어: 첫 부고의 비탄과 둘째 부고의 감사를 각각 인용하고, 사망 원인은 아직 쓰지 않겠습니다.
- 행동: quote_two_public_voices
- 반응: 네가 처음 말한 원칙을 문장으로 지켰군. 이번 기록에는 날짜가 책임을 진다.
- 의미: {"selectedExactExcerpt":"C03-R1,C03-R2","claim":"두 공적 목소리를 함께 싣되 확인되지 않은 원인을 만들지 않는다","channel":"official","whoHears":["OFFICIAL_RECORD"],"observableConsequence":"publicTwoVoiceNotice","relationshipJustification":"알렉세이는 공개 기록의 책임을 함께 진다","visibility":"OFFICIAL_RECORD"}

#### C03-P2
- 플레이어: “상실”이라는 표현은 남기되 조사 결과처럼 쓰지 않겠어요. 독자가 두 층위를 보게 하죠.
- 행동: separate_grief_from_cause
- 반응: 이 문단은 사람들의 목소리로 남겨요. 다만 그 목소리를 조사 결과인 척하지는 말아요.
- 의미: {"selectedExactExcerpt":"C03-R1","claim":"애도와 원인 판단을 분리한다","channel":"private","whoHears":["ekaterina"],"observableConsequence":"griefLabelled","relationshipJustification":"예카테리나는 개인 목소리를 지키는 대화를 기억한다","visibility":"SPOKEN_PRIVATE_TO_NPC"}

#### C03-P3
- 플레이어: 두 인쇄면의 도착 순서와 전달자를 적고, 다음 조사 자료 전에는 원인을 보류하겠습니다.
- 행동: hold_cause_for_next_record
- 반응: 봉투가 늦었다는 사실도 기록이 됩니다. 기다린 이유까지 적었으니 말이죠.
- 의미: {"selectedExactExcerpt":"C03-R2","claim":"추가 자료가 올 때까지 원인 판단을 유보한다","channel":"delivery","whoHears":["pavel"],"observableConsequence":"causeHeldWithReason","relationshipJustification":"파벨은 설명 가능한 지연을 안전한 전달로 인정한다","visibility":"DELIVERY_NETWORK"}

## C06 · 레르몬토프 결투 수사의 첫 보고 · 1841년 7월 18일

시간축: 1841년 여름 · 7월 현장 보고만 도착한 상태.
자료 프레임: 현대 한국인 플레이어가 1841년 결투 사건철의 공개 전사를 읽습니다. 당시 관청이 이 화면을 받았다는 주장이 아니라 후대 아카이브 재구성임을 표시합니다.
쟁점: 현장 보고와 추측을 어떻게 갈라 둘까?

### 도입
1. **NARRATION** 푸시킨의 부고 뒤로 네 번의 겨울이 지났다. 이번 봉투에는 시인의 죽음보다 먼저 날짜와 장소와 총기가 적혀 있었다.
2. **pavel** 여기까진 확실해요. 15일 결투, 16일 보고, 18일에는 권총 두 자루가 사건철로 들어왔습니다.
3. **pavel** 파벨이 봉투의 모서리를 가리킵니다. 먼저 7월 기록이 실제로 말하는 범위를 읽어 보세요.
4. **pavel** 마르티노프의 9월 답변이나 11월 의견은 아직 이 봉투에 없어요. 그걸 미리 읽었다고 쓰면 안 됩니다.
5. **NARRATION** 그는 후대 문서가 들어올 자리를 비워 두고, 7월 보고의 날짜만 먼저 옮긴다.

### 첫 선택
#### C06-A
- 플레이어: 글레보프의 신고가 말하는 범위를 정하죠. 죽음은 확인해도 동기는 아직 없습니다.
- 행동: bound_witness_statement
- 반응: 이번에는 멈출 줄 아는 기록이 필요합니다. 11월의 판정을 7월에 끼워 넣지는 마십시오.
- 의미: {"selectedExactExcerpt":"C06-R1","claim":"현장 신고는 사망과 장소를 말하지만 동기를 말하지 않는다","channel":"spoken","whoHears":["PUBLIC"],"observableConsequence":"witnessScopeBound","relationshipJustification":"알렉세이는 범위 제한을 책임 있는 판단으로 평가한다","visibility":"PUBLIC"}

#### C06-B
- 플레이어: 검시 결과만으로 결투의 전부를 안다고 하지 않겠습니다. 빈 증언의 자리를 남겨요.
- 행동: mark_missing_witness
- 반응: 빈칸을 숨기지 않는 것도 편집이에요. 나중에 누군가 그 빈칸을 대신 말하게 두지 않도록.
- 의미: {"selectedExactExcerpt":"C06-R2","claim":"의학적 결과와 책임 서사는 다르다","channel":"spoken","whoHears":["PUBLIC"],"observableConsequence":"missingTestimonyMarked","relationshipJustification":"예카테리나는 불확실성을 숨기지 않는 사람에게 가까워진다","visibility":"PUBLIC"}

#### C06-C
- 플레이어: 누가 언제 현장을 조사했고 네 개의 모자를 놓았는지부터 추적하겠습니다.
- 행동: map_scene_inspection
- 반응: 권총은 말하지 않지만, 누가 언제 넘겼는지는 남아요. 그게 지금 내가 책임질 수 있는 부분입니다.
- 의미: {"selectedExactExcerpt":"C06-R3","claim":"현장 배치와 조사자의 전달 경로를 기록한다","channel":"delivery","whoHears":["pavel"],"observableConsequence":"sceneMapLogged","relationshipJustification":"파벨은 물증과 행정 이동을 함께 본다","visibility":"DELIVERY_NETWORK"}

### 실제 원문·번역
#### C06-R1 · № 1351, 16 июля 1841, report and order to begin inquiry
- 러시아어: Корнет Глебов вчерашнего числа в вечеру пришед ко мне в квартиру, объявил, что отставной Маиор Мартынов, убил на дуеле Тенгинского пехотного полка Поручика Лермантова, и что эта дуель происходила версты за четыре от Города Пятигорска у подошвы горы Машухи. Предлагаю Вашему Высокоблагородию с получения сего немедленно приступить к производству о прописанном следствия при бытности Заседателя Пятигорского Земского Суда и Медика который будет командирован от Госпитальной Конторы.
- 한국어: 글레보프 코넷이 전날 저녁 내 집으로 와서 퇴역 소령 마르티노프가 결투에서 텡긴스키 보병연대 레르몬토프 중위를 죽였다고 알렸다. 결투는 퍄티고르스크에서 약 4베르스타 떨어진 마슈크 산기슭에서 벌어졌다고 한다. 이 통지를 받는 즉시 지방 법원의 배석자와 병원 사무국이 파견할 의사의 입회 아래 조사를 시작해 주기 바란다.
- 출처: https://lermontov.info/duel/delo2.shtml
- 발행/판본: Дело о поединке майора Мартынова с поручиком Лермонтовым / checked public transcription
- 작성일/최초 열람: 1841-07-16 / 1841-07-16
- provenance: reviewed against the cited continuous passage
- 입수 분류: MODERN_ARCHIVE_READING
- omission: NONE

#### C06-R2 · № 35, 17 июля 1841, full medical finding paragraph
- 러시아어: При осмотре оказалось, что пистолетная пуля опав в правый бок ниже последнего ребра, при срастении ребра с хрящем, пробила правое и левое легкое поднимаясь в верх вышла между пятым и шестым ребром левой стороны и при выходе прорезала мягкие части левого плеча; от которой раны Поручик Лермантов мгновенно на месте поединка помер. В удостоверение чего общим подписом и приложением герба моего печати свидетельствуем.
- 한국어: 검시 결과 권총 탄환은 마지막 갈비뼈 아래 오른쪽 옆구리로 들어가 갈비뼈와 연골이 만나는 곳을 지나 양쪽 폐를 관통했고 왼쪽 다섯째와 여섯째 갈비뼈 사이로 빠져나오며 왼쪽 어깨의 연부 조직을 베었다. 이 상처로 레르몬토프 중위는 결투 현장에서 즉시 사망했다. 이를 증명하기 위해 공동 서명하고 인장을 찍는다.
- 출처: https://lermontov.info/duel/delo2.shtml
- 발행/판본: Дело о поединке майора Мартынова с поручиком Лермонтовым / checked public transcription
- 작성일/최초 열람: 1841-07-17 / 1841-07-17
- provenance: reviewed against the cited continuous passage
- 입수 분류: MODERN_ARCHIVE_READING
- omission: NONE

#### C06-R3 · № 1351 dossier, 16 July site inspection, continuous site paragraph
- 러시아어: Тут-то поединщики избрали место для стреляния. Привязав своих лошадей к кустарникам, где приметна истоптанная трава и следы от беговых дрожек, они, как указали нам следователям, Гг. Глебов и Князь Васильчиков, отмерили вдоль по дороге Барьер в 15 шагов, и поставили по концам оного по шапке, потом, от этих шапок, еще отмерили по дороге ж в обе стороны по 10-ти шагов, и на концах оных также поставили по шапке, что составилось уже четыре шапки. Поединщики с начала стали на крайних точках, т. е. каждый в 10 шагах от Барьера: Мартынов от Севера к Югу, а Лермантов от Юга к Северу. По данному Секундантами знаку они подошли к Барьеру. Маиор Мартынов выстрелив из рокового пистолета, убил Поручика Лермантова, не успевшего выстрелить из своего пистолета.
- 한국어: 결투자들은 그곳을 사격 장소로 골랐다. 말들을 덤불에 묶은 뒤 글레보프와 바실치코프 공작이 가리킨 짓밟힌 풀과 썰매 자국이 있는 곳에서 길을 따라 15보의 장벽을 재고 양 끝에 모자를 놓았다. 다시 양쪽으로 10보를 재 네 개의 모자를 세웠다. 두 사람은 장벽에서 각각 10보 떨어진 끝점에 섰다. 초청인들이 신호하자 두 사람은 장벽으로 다가갔다. 마르티노프 소령이 치명적인 권총을 쏘았고 레르몬토프 중위는 발사하기도 전에 죽었다.
- 출처: https://lermontov.info/duel/delo2.shtml
- 발행/판본: Дело о поединке майора Мартынова с поручиком Лермонтовым / checked public transcription
- 작성일/최초 열람: 1841-07-18 / 1841-07-18
- provenance: reviewed against the cited continuous passage
- 입수 분류: MODERN_ARCHIVE_READING
- omission: NONE

### 후대 도착 자료 — 현재 장면에서 읽지 않음
- 1841-09-13 · C06-S2 · 마르티노프 질문 답변 · LATER_DOCUMENT_NOT_IN_INITIAL_SCENE

### 읽은 뒤의 두 번째 선택
#### C06-P1
- 플레이어: 검시가 확정한 사망만 보고하고, 결투의 책임은 다음 심문으로 넘기겠습니다.
- 행동: report_medical_fact_only
- 반응: 관청은 빠른 결론을 좋아하지만, 이 줄이 빨라지면 거짓말이 됩니다.
- 의미: {"selectedExactExcerpt":"C06-R2","claim":"검시의 확정 범위를 넘지 않는다","channel":"official","whoHears":["OFFICIAL_RECORD"],"observableConsequence":"medicalFactFiled","relationshipJustification":"알렉세이는 사실과 귀속을 가르는 판단을 신뢰한다","visibility":"OFFICIAL_RECORD"}

#### C06-P2
- 플레이어: 현장 배치와 검시를 함께 남기되 누가 먼저 쐈는지는 아직 판단하지 않겠습니다.
- 행동: preserve_uncertain_causation
- 반응: 좋아요. 모르는 이유를 모른다고 쓰는 건 누군가를 변호하거나 고발하는 일이 아니에요.
- 의미: {"selectedExactExcerpt":"C06-R2,C06-R3","claim":"사망과 발포 순서에 대한 불확실성을 보존한다","channel":"private","whoHears":["ekaterina"],"observableConsequence":"causationHeldOpen","relationshipJustification":"예카테리나는 질문을 남기는 대화를 신뢰한다","visibility":"SPOKEN_PRIVATE_TO_NPC"}

#### C06-P3
- 플레이어: 네 개의 모자와 조사자의 서명을 지도처럼 묶고, 목격자가 말한 것만 전달하겠습니다.
- 행동: deliver_scene_chain
- 반응: 이 봉인은 나중에 열릴 겁니다. 그래도 누가 닫았는지는 지금 남길 수 있어요.
- 의미: {"selectedExactExcerpt":"C06-R3","claim":"현장 기록의 물리적 이동을 추적 가능한 형태로 전달한다","channel":"delivery","whoHears":["pavel"],"observableConsequence":"sceneChainDelivered","relationshipJustification":"파벨은 위험을 알면서도 전달 책임을 공유한다","visibility":"DELIVERY_NETWORK"}

## C07 · 《죽은 혼》과 검열의 문턱 · 1842년 1월 7일

시간축: 1842년 초 · 고골의 편지는 검열 결과보다 먼저 도착했다.
자료 프레임: 현대 한국인 플레이어가 고골이 플레트뇨프에게 보낸 사적 편지를 역사 아카이브에서 읽습니다. 이 편지는 공식 관청 접수물이 아닙니다.
쟁점: 작가의 항의와 검열 절차를 한 문서로 섞지 않으려면?

### 도입
1. **NARRATION** 이번에는 작품을 통과시키는 문장과 작품을 말하는 목소리가 봉투 안에서 서로 부딪혔다.
2. **alexei** 검열 절차는 책임의 선을 남겨. 하지만 그 선이 작가의 말을 대신할 수는 없어.
3. **ekaterina** 작가의 편지를 절차 한 줄로 줄이면, 우리가 보존하는 건 판정뿐이에요.
4. **NARRATION** 최종 허가가 오기까지의 빈칸이 남아 있다. 먼저 편지와 검열 경과부터 읽어 보자.

### 첫 선택
#### C07-A
- 플레이어: 알렉세이 말대로 절차부터 확인하죠. 다만 그 기록이 작가의 목소리를 대신하게 두지는 않겠습니다.
- 행동: institutionalBoundaryChoice
- 반응: 절차를 먼저 확인하겠다는 말은 제 책임도 피하지 않겠다는 뜻이군요.
- 의미: {"selectedExactExcerpt":"C07-R1","claim":"알렉세이의 주장에 동의한다. 먼저 검열 절차와 책임의 경계를 확인하자.","channel":"opinion","whoHears":["alexei"],"observableConsequence":"institutionalBoundaryChoice","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"SPOKEN"}

#### C07-B
- 플레이어: 예카테리나 말이 맞아요. 판정문부터 쓰기 전에 작가가 실제로 무엇을 항의했는지 남기죠.
- 행동: literaryArgumentChoice
- 반응: 이제야 편지가 절차에 삼켜지지 않네요. 하지만 위험을 모른 척하지도 말아요.
- 의미: {"selectedExactExcerpt":"C07-R1,C07-R2","claim":"예카테리나의 반박을 따른다. 작가의 편지를 판정문으로 바꾸지 말고 목소리부터 보존하자.","channel":"opinion","whoHears":["ekaterina"],"observableConsequence":"literaryArgumentChoice","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"SPOKEN"}

#### C07-C
- 플레이어: 잠깐만요. 둘 다 결론을 늦추고, 원문과 날짜부터 같이 확인합시다.
- 행동: suspend_verdict
- 반응: 유보는 회피가 아니군요.
- 의미: {"selectedExactExcerpt":"C07-R1,C07-R2","claim":"둘 다 멈추게 한다. 원문과 날짜를 먼저 확인한 뒤 판단하겠다.","channel":"reserve","whoHears":["alexei","ekaterina"],"observableConsequence":"suspend_verdict","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"SPOKEN"}

### 실제 원문·번역
#### C07-R1 · 7 января 1842, opening and first censorship account
- 러시아어: Расстроенный и телом и духом пишу к вам. Сильно хотел бы ехать теперь в Петербург, мне это нужно, это я знаю, и при всем том не могу. Никогда так не в пору не подвернулась ко мне болезнь, как теперь. Припадки ее приняли теперь такие странные образы… но бог с ними, не об болезни, а об цензуре я теперь должен говорить. Удар для меня никак не ожиданный: запрещают всю рукопись. Я отдаю сначала ее цензору Снегиреву, который несколько толковее других, с тем, что если он находит в ней какое-нибудь место, наводящее на него сомнение, чтоб объявил мне прямо, что я тогда посылаю ее в Петербург.
- 한국어: 몸과 마음이 모두 무너진 채 편지를 씁니다. 페테르부르크로 가고 싶고 가야 한다는 것도 알지만 갈 수가 없습니다. 병이 이상한 양상을 띠지만 병 이야기는 접어 두겠습니다. 이제는 검열에 대해 말해야 합니다. 전혀 예상하지 못한 타격입니다. 원고 전체를 금지하고 있습니다. 저는 먼저 다른 사람들보다 분별 있는 검열관 스네기료프에게 원고를 맡기고, 의심스러운 대목이 있으면 솔직히 알려 달라고 했습니다. 그러면 원고를 페테르부르크로 보내려 했습니다.
- 출처: https://ru.wikisource.org/wiki/Переписка_с_П._А._Плетневым_(Гоголь)
- 발행/판본: Гоголь — Плетневу / checked public transcription
- 작성일/최초 열람: 1842-01-07 / 1842-01-07
- provenance: reviewed against the cited continuous passage
- 입수 분류: MODERN_ARCHIVE_READING
- omission: NONE

#### C07-R2 · 7 января 1842, Snegirev assessment and committee referral
- 러시아어: Снегирев чрез два дни объявляет мне торжественно, что рукопись он находит совершенно благонамеренной и в отношении к цели, и в отношении к впечатлению, производимому на читателя, и что, кроме одного незначительного места, перемены двух-трех имен, на которые я тот же час согласился и изменил, — нет ничего, что бы могло навлечь притязанья цензуры самой строгой. Это же самое он объявил и другим. Вдруг Снегирева сбил кто-то с толку, и я узнаю, что он представляет мою рукопись в комитет.
- 한국어: 이틀 뒤 스네기료프는 원고가 목적과 독자에게 미칠 인상 모두에서 건전하며, 사소한 한 곳과 두세 이름의 변경 외에는 엄격한 검열도 문제 삼을 것이 없다고 단언했습니다. 저는 그 이름을 바로 바꾸었습니다. 그는 다른 사람들에게도 같은 말을 했습니다. 그런데 갑자기 누군가 스네기료프를 혼란에 빠뜨렸고, 저는 그가 원고를 위원회에 제출한다는 사실을 알게 되었습니다.
- 출처: https://ru.wikisource.org/wiki/Переписка_с_П._А._Плетневым_(Гоголь)
- 발행/판본: Гоголь — Плетневу / checked public transcription
- 작성일/최초 열람: 1842-01-07 / 1842-01-07
- provenance: reviewed against the cited continuous passage
- 입수 분류: MODERN_ARCHIVE_READING
- omission: NONE

### 후대 도착 자료 — 현재 장면에서 읽지 않음
- 1842-03-09 · C07-S2 · 니키텐코 허가 표기와 출판 기록 · LATER_DOCUMENT_NOT_IN_INITIAL_SCENE

### 읽은 뒤의 두 번째 선택
#### C07-P1
- 플레이어: 검열위원의 판단을 공식 기록으로 남기되, 작가의 호소와 같은 목소리라고 쓰지 않겠다.
- 행동: official_record
- 반응: 공식 기록을 남기되 그 기록이 모든 목소리를 대신하지 않게 했군요.
- 의미: {"selectedExactExcerpt":"C07-R1,C07-R2","claim":"검열위원의 판단을 공식 기록으로 남기되, 작가의 호소와 같은 목소리라고 쓰지 않겠다.","channel":"official","whoHears":["OFFICIAL_RECORD"],"observableConsequence":"official_record","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"OFFICIAL_RECORD"}

#### C07-P2
- 플레이어: 작품의 주장을 공적 논쟁으로 열어 둔다. 검열의 판단도 반박 가능한 문장으로 놓겠다.
- 행동: literaryArgument
- 반응: 그 문장은 작품을 무죄로 만들지 않지만, 토론할 권리를 닫지도 않아요.
- 의미: {"selectedExactExcerpt":"C07-R1,C07-R2","claim":"작품의 주장을 공적 논쟁으로 열어 둔다. 검열의 판단도 반박 가능한 문장으로 놓겠다.","channel":"spoken","whoHears":["PUBLIC"],"observableConsequence":"literaryArgument","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"PUBLIC"}

#### C07-P3
- 플레이어: 편지와 허가 표기를 공동체가 함께 검토할 수 있게 중재하고, 어느 한쪽의 판정으로 닫지 않겠다.
- 행동: communalMediation
- 반응: 두 사람은 잠시 말을 멈춘다. 서로의 책임을 지우지 않고 다음 독자에게 판단을 넘겼다.
- 의미: {"selectedExactExcerpt":"C07-R1,C07-R2","claim":"편지와 허가 표기를 공동체가 함께 검토할 수 있게 중재하고, 어느 한쪽의 판정으로 닫지 않겠다.","channel":"mediation","whoHears":["alexei"],"observableConsequence":"communalMediation","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"SPOKEN"}

## E02 · 로스토프치나의 〈강제 결혼〉 · 1847년 1월 5일

시간축: 1847년 겨울 · 시와 독자의 오독이 한 책상에 놓였다.
자료 프레임: 1846년 12월 신문, 작품의 연결된 연, 1847년 1월 4일 니키텐코 일기를 서로 다른 층위로 읽습니다.
쟁점: 시의 목소리와 독자의 정치적 독해를 어떻게 분리할까?

### 도입
1. **NARRATION** 1847년. 시의 두 화자와 그것을 읽은 사람의 일기가 같은 책상 위에서 서로 다른 방향을 가리켰다.
2. **ekaterina** 나는 포로라는 말의 폭력을 먼저 읽어요. 비유가 누군가의 목소리를 가둘 수도 있으니까.
3. **alexei** 나는 그 시를 행정 증거로 만들고 싶지 않아. 다만 권력의 말이 어떻게 들리는지는 물어야 해.
4. **pavel** 누가 어떤 독법을 다음 사람에게 건네는지도 위험이에요. 시는 종이 위에만 머물지 않으니까.
5. **NARRATION** 세 목소리가 같은 시와 일기를 서로 다르게 읽는다. 먼저 작품 속 화자와 실제 독자의 반응을 나누어 확인한다.

### 첫 선택
#### E02-A
- 플레이어: 저는 ‘포로’라고 말하는 쪽에 더 마음이 갑니다. ‘보호’라는 말이 누구의 힘을 가리는지도 살펴보고 싶어요.
- 행동: interpret_captive_voice
- 반응: 그 말의 폭력을 들었군요. 다만 비유를 곧바로 사실 기록이라고 부르지는 말아요.
- 의미: {"selectedExactExcerpt":"E02-R1,E02-R2","claim":"보호를 말하는 화자보다 “포로”라고 말하는 화자에 더 설득된다. 권력의 언어를 의심하겠다.","channel":"interpretation","whoHears":["ekaterina"],"observableConsequence":"interpret_captive_voice","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"SPOKEN"}

#### E02-B
- 플레이어: 두 화자 어느 쪽도 즉시 믿지 않겠다. 시의 장면과 일기의 반응을 함께 확인하겠다.
- 행동: reserve_poem_judgment
- 반응: 유보하면서도 읽기를 멈추지 않는군. 판단을 늦추는 이유가 남아 있어.
- 의미: {"selectedExactExcerpt":"E02-R1,E02-R2,E02-R3","claim":"두 화자 어느 쪽도 즉시 믿지 않겠다. 시의 장면과 일기의 반응을 함께 확인하겠다.","channel":"reserve","whoHears":["alexei"],"observableConsequence":"reserve_poem_judgment","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"SPOKEN"}

#### E02-C
- 플레이어: 시의 비유가 독자 사이에서 어떻게 전달되는지가 중요하다. 읽는 사람의 위험까지 살피겠다.
- 행동: networkReception
- 반응: 바로 그 지점이 두려워요. 뜻을 전달하는 일이 사람을 노출할 수도 있으니까.
- 의미: {"selectedExactExcerpt":"E02-R1,E02-R2,E02-R3","claim":"시의 비유가 독자 사이에서 어떻게 전달되는지가 중요하다. 읽는 사람의 위험까지 살피겠다.","channel":"delivery","whoHears":["pavel"],"observableConsequence":"networkReception","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"DELIVERY_NETWORK"}

### 실제 원문·번역
#### E02-R1 · 1845, Старый барон, continuous opening stanza
- 러시아어: Сбирайтесь, слуги и вассалы, На кроткий господина зов! Судите, не боясь опалы, — Я правду выслушать готов! Судите спор, вам всем знакомый: Хотя могуч и славен я, Хотя всесильным чтут меня — Не властен у себя я дома: Все непокорна мне она, Моя мятежная жена!
- 한국어: 하인과 봉신들이여, 온화한 주인의 부름에 모여라! 화를 두려워하지 말고 판단하라, 나는 진실을 들을 준비가 되어 있다! 모두에게 익숙한 분쟁을 판단하라. 나는 강하고 이름 높으며 전능하다고 여겨지지만 내 집에서는 권력을 부릴 수 없다. 그녀는 내게 복종하지 않는다, 나의 반항적인 아내는!
- 출처: https://slova.org.ru/rostopchina/nasil-nyj-brak/
- 발행/판본: Евдокия Ростопчина, «Насильный брак» / checked public transcription
- 작성일/최초 열람: 1845 / 1845
- provenance: reviewed against the cited continuous passage
- 입수 분류: MODERN_ARCHIVE_READING
- omission: NONE

#### E02-R2 · 1845, Жена, continuous reply stanza
- 러시아어: Раба ли я или подруга — То знает Бог!.. Я ль избрала Себе жестокого супруга? Сама ли клятву я дала? Жила я вольно и счастливо, Свою любила волю я; Но победил, пленил меня Соседей злых набег хищливый. Я предана, я продана — Я узница, не жена!
- 한국어: 내가 노예인지 친구인지는 하느님만 아신다! 내가 잔혹한 남편을 스스로 골랐는가? 내가 직접 맹세했는가? 나는 자유롭고 행복하게 살며 내 의지를 사랑했다. 그러나 사나운 이웃의 침입이 나를 이기고 사로잡았다. 나는 넘겨지고 팔렸다. 나는 포로이지 아내가 아니다!
- 출처: https://slova.org.ru/rostopchina/nasil-nyj-brak/
- 발행/판본: Евдокия Ростопчина, «Насильный брак» / checked public transcription
- 작성일/최초 열람: 1845 / 1845
- provenance: reviewed against the cited continuous passage
- 입수 분류: MODERN_ARCHIVE_READING
- omission: NONE

#### E02-R3 · diary entry on № 284 and Насильный брак
- 러시아어: В N 284 за 17 декабря «Северной пчелы» напечатано несколько стихотворений графини Ростопчиной и, между прочим, баллада: «Насильный брак». И цензура и публика сначала поняли так, что графиня Ростопчина говорит о своих собственных отношениях к мужу.
- 한국어: 《북방의 벌》 12월 17일자 284호에는 로스토프치나 백작부인의 시 몇 편과 발라드 〈강제 결혼〉이 실렸다. 검열 당국과 독자는 처음에는 로스토프치나가 자신의 남편과의 관계를 말한 것으로 이해했다.
- 출처: https://ru.wikisource.org/wiki/Дневник._Том_1_(Никитенко)
- 발행/판본: Никитенко diary entry / checked public transcription
- 작성일/최초 열람: 1847-01-04 / 1847-01-04
- provenance: reviewed against the cited continuous passage
- 입수 분류: MODERN_ARCHIVE_READING
- omission: NONE


### 읽은 뒤의 두 번째 선택
#### E02-P1
- 플레이어: 이 시를 공개 논쟁의 장에 놓겠다. 정치적 비유는 검열의 결론이 아니라 독자가 다투는 주장이다.
- 행동: literaryArgument
- 반응: 이제 독자가 말할 자리를 남겼네요. 작품을 판결문으로 만들지 않았어요.
- 의미: {"selectedExactExcerpt":"E02-R1,E02-R2","claim":"이 시를 공개 논쟁의 장에 놓겠다. 정치적 비유는 검열의 결론이 아니라 독자가 다투는 주장이다.","channel":"public-debate","whoHears":["PUBLIC"],"observableConsequence":"literaryArgument","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"PUBLIC"}

#### E02-P2
- 플레이어: 두 화자의 긴장을 공동체의 책임으로 읽겠다. 누구의 말도 혼자 결론이 되지 않게 중재하겠다.
- 행동: communalMediation
- 반응: 행정의 언어만으로는 모자라고, 한 사람의 분노만으로도 모자라다는 말이군.
- 의미: {"selectedExactExcerpt":"E02-R1,E02-R2,E02-R3","claim":"두 화자의 긴장을 공동체의 책임으로 읽겠다. 누구의 말도 혼자 결론이 되지 않게 중재하겠다.","channel":"mediation","whoHears":["alexei"],"observableConsequence":"communalMediation","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"SPOKEN"}

#### E02-P3
- 플레이어: 이 독법을 믿을 만한 독자에게 위험을 설명하며 전달하겠다. 시가 사람을 대신해 고발하지 않게 하겠다.
- 행동: dangerous_discussion
- 반응: 전달은 중립이 아니에요. 누구에게 건네는지까지 책임지겠다는 말로 들립니다.
- 의미: {"selectedExactExcerpt":"E02-R1,E02-R2,E02-R3","claim":"이 독법을 믿을 만한 독자에게 위험을 설명하며 전달하겠다. 시가 사람을 대신해 고발하지 않게 하겠다.","channel":"risked-discussion","whoHears":["pavel"],"observableConsequence":"dangerous_discussion","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"SPOKEN"}

## E07 · 페트라셰프스키 사건철: 증언과 기록의 간격 · 1849년 5월 10일

시간축: 1849년 5월 · 사건철의 표지와 실제 심문 답변이 분리되어 도착했다.
자료 프레임: 현대 한국인 플레이어가 1849년 증언의 현대 전사본을 읽습니다. 1927년 편찬 정보와 사건철 식별자는 H키 provenance 층위에만 있으며, 1849년 인물의 대사에는 들어가지 않습니다. 실제 판결과 가상 서기의 선택은 분리됩니다.
쟁점: 사건철의 표지와 실제 증언을 섞지 않고 무엇을 책임질까?

### 도입
1. **NARRATION** 마지막 봉투에는 증언, 사건철, 그리고 말이 언제 국가적 위험으로 불리는지에 대한 세 사람의 서로 다른 두려움이 들어 있다.
2. **alexei** 혐의와 자기변호는 분리해야 해. 하지만 말과 토론이 언제 공적 위험이 되는지도 기록의 책임이야.
3. **ekaterina** 문학적 주장이라고 해서 안전한 건 아니죠. 그렇다고 침묵을 국가의 판단과 같은 것으로 만들 수도 없어요.
4. **pavel** 제가 봉투를 건네면 받는 사람의 이름도 기록에 남을 수 있어요. 누구 손에 들어가는지 모른 채 보내지는 않겠습니다.
5. **NARRATION** 말하기와 기록과 전달이 각각 누구에게 닿는지 먼저 읽는다. 그 뒤에 이 순간 감당할 책임을 고른다.

### 첫 선택
#### E07-A
- 플레이어: 토론과 문학적 주장이 언제 혐의가 되는지 공개적으로 묻겠습니다. 말하고 읽었다는 이유만으로 처벌하지 말라고 요구하겠습니다.
- 행동: spoken_risk_boundary
- 반응: 질문을 공개했다고 무죄가 되는 건 아니에요. 하지만 질문할 문턱을 없애지도 않았군요.
- 의미: {"selectedExactExcerpt":"E07-R1,E07-R2","claim":"토론과 문학적 주장이 언제 혐의가 되는지 공개적으로 묻겠다. 말하기 자체를 범죄로 기록하지 않겠다.","channel":"spoken","whoHears":["PUBLIC"],"observableConsequence":"spoken_risk_boundary","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"PUBLIC"}

#### E07-B
- 플레이어: 혐의와 자기변호를 공식 기록에서 나누겠습니다. 확인되지 않은 사실로 사람을 몰아가지 않겠습니다.
- 행동: official_record
- 반응: 책임질 수 있는 문장과 추측을 나눴군요. 이번에는 그 선이 사람을 보호할 수도 있습니다.
- 의미: {"selectedExactExcerpt":"E07-R1","claim":"혐의와 자기변호를 공식 기록의 층위로 나눠 적겠다. 확인된 사실 밖으로 사람을 밀어 넣지 않겠다.","channel":"official-record","whoHears":["alexei"],"observableConsequence":"official_record","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"SPOKEN"}

#### E07-C
- 플레이어: 확인된 자료와 노출 위험을 함께 적어 믿을 만한 독자에게 전달하겠습니다. 봉투를 건네는 책임도 기록하겠습니다.
- 행동: routed_document
- 반응: 전달을 선택했군요. 이번에는 누가 다칠 수 있는지까지 적고 건네야 해요.
- 의미: {"selectedExactExcerpt":"E07-R1,E07-R2,E07-R3","claim":"확인된 자료를 위험을 설명한 뒤 믿을 만한 독자에게 전달하겠다. 봉투를 건네는 책임도 내 몫이다.","channel":"routed-document","whoHears":["pavel"],"observableConsequence":"routed_document","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"DELIVERY_NETWORK"}

#### E07-D
- 플레이어: 지금은 침묵하고 증언을 사적으로 보존하겠습니다. 보류가 동의로 읽히지 않도록 이유도 남기겠습니다.
- 행동: silence
- 반응: 침묵에도 책임을 적는다면, 목소리를 버리는 것과는 다르겠죠.
- 의미: {"selectedExactExcerpt":"E07-R1,E07-R2","claim":"지금은 침묵하고 증언을 사적으로 보존하겠다. 침묵이 동의가 되지 않도록 이유를 남기겠다.","channel":"silence","whoHears":["ekaterina"],"observableConsequence":"silence","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"SPOKEN_PRIVATE_TO_NPC"}

### 실제 원문·번역
#### E07-R1 · 1849-05-10, opening of written explanation
- 러시아어: По приглашению следственной комиссии, которою я имел честь быть допрашиваем вечером 10 мая текущего 1849 года, изложить на бумаге свое оправдание во взводимых на меня неизвестными мне обвинителями государственных преступлениях, имею честь представить следующее объяснение.
- 한국어: 1849년 5월 10일 저녁 조사위원회의 요청으로 심문을 받은 뒤, 나를 알지 못하는 고발자들이 제기한 국가범죄 혐의에 대한 변론을 종이에 적으라는 요구를 받았습니다. 이에 다음과 같은 설명을 올립니다.
- 출처: https://ru.wikisource.org/wiki/Исповедь_(Баласогло)/ДО
- 발행/판본: А. П. Баласогло, «Исповедь» / checked public transcription
- 작성일/최초 열람: 1849-05-10 / 1849-05-10
- provenance: reviewed against the cited continuous passage
- 입수 분류: MODERN_ARCHIVE_READING
- omission: NONE

#### E07-R2 · 1849-05-10, accusation paragraph
- 러시아어: Я обвиняюсь, в числе 36 человек других, отчасти мне названных лиц в соучастии в так называемом тайном обществе г. Буташевича-Петрашевского, которого главной целью будто бы было ниспровержение существующего порядка вещей в государстве, пагубные намерения относительно самой особы нашего всемилостивейшего государя императора и заменение общественного устройства другим, на основании так называемых социальных идей, к чему, как средство, будто уже и принято нами было к исполнению приготовление умов распространением этих идей в России.
- 한국어: 나는 다른 36명과 함께 부타셰비치-페트라셰프스키의 이른바 비밀 결사에 가담했다는 혐의를 받고 있습니다. 그 목적은 국가의 기존 질서를 전복하고 황제의 신변을 해치며 다른 사회제도로 바꾸려는 것이었다고 합니다. 러시아에 그 사상을 퍼뜨려 사람들의 마음을 준비하는 일이 이미 실행되었다고 고발당했습니다.
- 출처: https://ru.wikisource.org/wiki/Исповедь_(Баласогло)/ДО
- 발행/판본: А. П. Баласогло, «Исповедь» / checked public transcription
- 작성일/최초 열람: 1849-05-10 / 1849-05-10
- provenance: reviewed against the cited continuous passage
- 입수 분류: MODERN_ARCHIVE_READING
- omission: NONE

#### E07-R3 · 1849-05-10, actions and opinions paragraph
- 러시아어: Я понимаю, что общество может судить человека только либо 1) за его действия, либо 2) за его мнения; последние только в таком случае, если они были выражаемы, следовательно, как бы уже превращались в действия, и в таком случае — в той мере, в какой могла в них явно обнаруживаться какая-либо общественная цель.
- 한국어: 나는 사회가 사람을 판단할 수 있는 것은 그의 행동이나 의견에 대해서뿐이라고 생각합니다. 의견은 표현되었을 때, 이미 행동으로 바뀌었을 때에만 판단할 수 있고, 그때에도 그 안에 어떤 사회적 목적이 명백히 드러나는 범위에서만 판단할 수 있습니다.
- 출처: https://ru.wikisource.org/wiki/Исповедь_(Баласогло)/ДО
- 발행/판본: А. П. Баласогло, «Исповедь» / checked public transcription
- 작성일/최초 열람: 1849 / 1849
- provenance: reviewed against the cited continuous passage
- 입수 분류: MODERN_ARCHIVE_READING
- omission: NONE

### 메타데이터 — 본문 아님
- E07-M1: Ф.109 Оп.24 Д.214 ч.I / 러시아연방국가문서보관소 109기금 24목록 214사건철 1부 — 식별자만 제공; 본문 읽기 단위에 포함하지 않음
- E07-M2: Донесения Антонелли; Донесение Дубельта; Список приговорённых / 안토넬리 보고·두벨트 보고·선고 명단 — 표제·폴리오 안내; 본문 대체 불가

### 읽은 뒤의 두 번째 선택
#### E07-P1
- 플레이어: 발언을 기록한다. 말과 토론이 국가적 위험으로 취급되는 경계를 공개 논쟁의 문제로 남긴다.
- 행동: spoken_public_argument
- 반응: 위험을 안 뒤에도 말할 자리를 남겼어요. 그건 판결을 대신하지 않지만 침묵도 아니죠.
- 의미: {"selectedExactExcerpt":"E07-R1,E07-R2","claim":"발언을 기록한다. 말과 토론이 국가적 위험으로 취급되는 경계를 공개 논쟁의 문제로 남긴다.","channel":"spoken","whoHears":["PUBLIC"],"observableConsequence":"spoken_public_argument","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"PUBLIC"}

#### E07-P2
- 플레이어: 공식 메모를 남긴다. 사건의 결말은 바꾸지 않고, 혐의·자기변호·확인 사실을 분리한다.
- 행동: official_memo
- 반응: 공식 기록이 사람의 목소리를 삼키지 않도록 선을 남겼습니다. 그것이 제가 책임질 수 있는 방식입니다.
- 의미: {"selectedExactExcerpt":"E07-R1,E07-R2","claim":"공식 메모를 남긴다. 사건의 결말은 바꾸지 않고, 혐의·자기변호·확인 사실을 분리한다.","channel":"official","whoHears":["OFFICIAL_RECORD"],"observableConsequence":"official_memo","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"OFFICIAL_RECORD"}

#### E07-P3
- 플레이어: 자료를 전달한다. 확인된 증언을 믿을 만한 독자에게 보내고, 노출될 위험을 함께 알린다.
- 행동: send_to_trusted_reader
- 반응: 누군가를 위험에 빠뜨릴 수 있다는 사실까지 봉투에 넣었어요. 이제 전달은 내 선택이기도 합니다.
- 의미: {"selectedExactExcerpt":"E07-R1,E07-R2,E07-R3","claim":"자료를 전달한다. 확인된 증언을 믿을 만한 독자에게 보내고, 노출될 위험을 함께 알린다.","channel":"routed-document","whoHears":["pavel"],"observableConsequence":"send_to_trusted_reader","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"DELIVERY_NETWORK"}

#### E07-P4
- 플레이어: 침묵을 선택한다. 증언을 보존하되 지금 공개하지 않는 이유와 공동체의 안전을 함께 기록한다.
- 행동: protective_silence
- 반응: 침묵도 선택이에요. 공개하지 않는 이유와 공동체의 안전을 함께 남겨야 해요.
- 의미: {"selectedExactExcerpt":"E07-R1,E07-R2","claim":"침묵을 선택한다. 증언을 보존하되 지금 공개하지 않는 이유와 공동체의 안전을 함께 기록한다.","channel":"silence","whoHears":["ekaterina"],"observableConsequence":"protective_silence","relationshipJustification":"플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다","visibility":"SPOKEN_PRIVATE_TO_NPC"}

## 다섯 엔딩
### UVAROV · 당신의 선택은 세르게이 우바로프와 가장 닮았습니다
- 조건: {"allFlags":["publicCivicClaim","institutionalBoundary","e07Evidence","chronologyBoundary"],"noneFlags":["networkDelivery","publicDebate"],"minScenes":5,"actionsAll":["public_citation","report_medical_fact_only","institutionalBoundaryChoice","official_record","official_memo"],"minRelationships":{"alexei":4},"meaningStatement":"확인된 사실·기관 책임·공식 문서의 경계를 우선한 삶의 방향.","requiredActions":["public_citation","report_medical_fact_only","institutionalBoundaryChoice","official_record","official_memo"],"forbiddenActions":["networkDelivery","publicDebate"],"relationshipGate":{"alexei":4},"sourceScenes":["C03","C06","C07","E07"]}
- callback: C03-A, C06-P1, C07-A, E07-B, E07-P2
- 방향: 공적 질서와 기관 책임을 우선하는 관료적 경로를 택했다. 우바로프 체제와 의미상 가까운 선택이지, 우바로프와의 교류를 뜻하지 않는다.
- 역사적 경계: 1849년의 국가 수사와 판결은 고정된다. 변하는 것은 가상 서기가 공식 기록의 책임을 감당하는 방식뿐이다.
- **NARRATION** 당신은 확인된 사실과 기관의 책임을 함께 장부에 남기는 삶을 택했습니다.

### BELINSKY · 당신의 선택은 비사리온 벨린스키와 가장 닮았습니다
- 조건: {"allFlags":["literaryArgument","publicDebate","e07Evidence","chronologyBoundary"],"noneFlags":["networkDelivery","institutionalBoundary"],"minScenes":5,"actionsAll":["literaryArgumentChoice","interpret_captive_voice","literaryArgument","spoken_risk_boundary","spoken_public_argument"],"minRelationships":{"ekaterina":4},"meaningStatement":"문학적 주장과 검열을 공개 논쟁의 대상으로 남긴 삶의 방향.","requiredActions":["literaryArgumentChoice","interpret_captive_voice","literaryArgument","spoken_risk_boundary","spoken_public_argument"],"forbiddenActions":["networkDelivery","institutionalBoundary"],"relationshipGate":{"ekaterina":4},"sourceScenes":["C07","E02","E07"]}
- callback: C07-B, E02-A, E02-P1, E07-A, E07-P1
- 방향: 문학을 공적 비평과 논쟁의 장으로 보는 경로를 택했다. 벨린스키와 실제 친분을 맺었다는 뜻이 아니다.
- 역사적 경계: 실제 검열과 1849년 판결은 바뀌지 않는다. 가상 서기는 문학적 주장을 토론 가능한 말로 보존한다.
- **NARRATION** 당신은 문학의 목소리가 공개 논쟁의 자리에서 계속 읽히도록 했습니다.

### HERZEN · 당신의 선택은 알렉산드르 게르첸과 가장 닮았습니다
- 조건: {"allFlags":["networkDelivery","riskAccepted","e07Evidence","chronologyBoundary"],"noneFlags":["institutionalBoundary","publicCivicClaim"],"minScenes":5,"actionsAll":["trace_print_route","deliver_scene_chain","networkReception","routed_document","send_to_trusted_reader"],"minRelationships":{"pavel":4},"meaningStatement":"제도 밖 전달망으로 비판적 목소리를 운반하되 노출 위험을 감당한 삶의 방향.","requiredActions":["trace_print_route","deliver_scene_chain","networkReception","routed_document","send_to_trusted_reader"],"forbiddenActions":["institutionalBoundary","publicCivicClaim"],"relationshipGate":{"pavel":4},"sourceScenes":["C03","C06","E02","E07"]}
- callback: C03-C, C06-P3, E02-C, E07-C, E07-P3
- 방향: 위험을 설명하고 믿을 만한 독자에게 자료를 전달하는 제도 밖의 경로를 택했다. 헤르첸의 미래 해외 활동을 비유로만 참조한다.
- 역사적 경계: 실제 1849년 수사와 판결은 변경되지 않는다. 가상 서기의 전달 선택만 달라진다.
- **NARRATION** 당신은 위험을 계산하면서도 문서가 읽힐 사람에게 도착하는 길을 열었습니다.

### KHOMYAKOV · 당신의 선택은 알렉세이 호먀코프와 가장 닮았습니다
- 조건: {"allFlags":["mediatedConflict","communalDuty","privateVoiceProtected","e07Evidence"],"noneFlags":["networkDelivery","institutionalBoundary"],"minScenes":5,"actionsAll":["preserve_public_grief","mark_missing_witness","suspend_verdict","reserve_poem_judgment","protective_silence"],"minRelationships":{"alexei":1,"ekaterina":3},"meaningStatement":"행정적 판단과 문학적 목소리 사이에서 공동체적·중재적 책임을 택한 삶의 방향.","requiredActions":["preserve_public_grief","mark_missing_witness","suspend_verdict","reserve_poem_judgment","protective_silence"],"forbiddenActions":["networkDelivery","institutionalBoundary"],"relationshipGate":{"alexei":1,"ekaterina":3},"sourceScenes":["C03","C06","C07","E02","E07"]}
- callback: C03-B, C06-B, C07-C, E02-B, E07-D, E07-P4
- 방향: 어느 한쪽의 승리보다 공동체가 함께 감당할 판단을 남겼다. 호먀코프와 동일한 사상을 가졌다고 단정하지 않는다.
- 역사적 경계: 역사적 결과는 고정된다. 가상 서기는 서로 다른 목소리가 공동체 안에서 검토될 자리를 보존한다.
- **NARRATION** 당신은 충돌하는 목소리가 공동체 안에서 검토될 자리를 지켰습니다.

### DOSTOEVSKY_PETRASHEVSKY · 젊은 도스토옙스키와 페트라셰프스키 모임을 닮은 선택
- 조건: {"allFlags":["networkDelivery","riskAccepted","literaryArgument","e07Evidence","chronologyBoundary"],"noneFlags":["institutionalBoundary"],"minScenes":5,"actionsAll":["map_scene_inspection","deliver_scene_chain","dangerous_discussion","spoken_risk_boundary","spoken_public_argument"],"minRelationships":{"pavel":3,"ekaterina":2},"meaningStatement":"문학적 토론·서클·전달이 국가 수사의 경계에 닿는 위험을 감수한 삶의 방향.","requiredActions":["map_scene_inspection","deliver_scene_chain","dangerous_discussion","spoken_risk_boundary","spoken_public_argument"],"forbiddenActions":["institutionalBoundary"],"relationshipGate":{"pavel":3,"ekaterina":2},"sourceScenes":["C06","E02","E07"]}
- callback: C03-C, C06-C, C06-P3, E02-P3, E07-A, E07-P1
- 방향: 위험한 토론의 문턱에서 말하기와 전달의 책임을 함께 택했다. 도스토옙스키·페트라셰프스키와의 친분을 만들지 않는다.
- 역사적 경계: 1849년의 수사와 판결은 고정된다. 가상 서기는 위험한 토론이 언제 국가적 혐의로 읽히는지 경험한다.
- **NARRATION** 당신은 토론의 위험을 알면서도 말할 자리와 전달의 책임을 함께 선택했습니다.
