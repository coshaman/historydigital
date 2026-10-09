import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const write = (file, value) => fs.writeFileSync(path.join(root, file), JSON.stringify(value, null, 2) + '\n');
const year = (value) => Number(String(value).match(/\d{4}/)?.[0] ?? NaN);
const endYear = (value) => Number([...String(value).matchAll(/\d{4}/g)].at(-1)?.[0] ?? NaN);

const prior = read('data/v26-case-bundle.json');
const pilot = read('data/v25-pilot-cases.json').cases;
const sourceTypes = {
  ADMINISTRATIVE_PRIMARY: ['MODERN_TRANSCRIPTION', 'IN_WORLD'],
  JUDICIAL_PRIMARY: ['MODERN_TRANSCRIPTION', 'IN_WORLD'],
  MILITARY_PRIMARY: ['MODERN_TRANSCRIPTION', 'IN_WORLD'],
  LETTER_PRIMARY: ['MODERN_TRANSCRIPTION', 'IN_WORLD'],
  PERIODICAL_PRIMARY: ['MODERN_TRANSCRIPTION', 'IN_WORLD'],
  LITERARY_CRITICISM_PRIMARY: ['MODERN_TRANSCRIPTION', 'IN_WORLD'],
};
const inferPerson = (source) => {
  const id = `${source.sourceId} ${source.titleRu ?? ''}`.toUpperCase();
  if (id.includes('BELINSKY') || id.includes('БЕЛИНСК')) return 'В. Г. Белинский';
  if (id.includes('GOGOL') || id.includes('ГОГОЛ')) return 'Н. В. Гоголь';
  if (id.includes('CHAADAEV') || id.includes('ЧААДАЕВ')) return 'П. Я. Чаадаев';
  if (id.includes('PUSHKIN') || id.includes('ПУШКИН')) return 'А. С. Пушкин';
  if (id.includes('NEKRASOV') || id.includes('НЕКРАСОВ')) return 'Н. А. Некрасов';
  if (id.includes('ANNENKOV') || id.includes('АННЕНКОВ')) return 'П. В. Анненков';
  if (id.includes('PETRASHEVSKY') || id.includes('ПЕТРАШЕВСК')) return 'М. В. Петрашевский';
  if (id.includes('DOSTOEVSKY') || id.includes('ДОСТОЕВСК')) return 'М. М. Достоевский';
  if (id.includes('YAZYKOV') || id.includes('ЯЗЫКОВ')) return 'Н. М. Языков';
  if (id.includes('KRAEVSKY') || id.includes('КРАЕВСК')) return 'И. И. Краевский';
  if (id.includes('SOVREMENNIK')) return 'Редакция «Современника»';
  if (id.includes('TELESKOP') || id.includes('ТЕЛЕСКОП')) return 'Редакция «Телескопа»';
  if (id.includes('LERMONTOV') || id.includes('ЛЕРМОНТОВ')) return 'М. Ю. Лермонтов';
  if (id.includes('MARTYNOV') || id.includes('МАРТЫНОВ')) return 'Н. С. Мартынов';
  if (id.includes('CAUCASUS') || id.includes('КАВКАЗ') || id.includes('КОРПУС')) return 'Штаб Отдельного Кавказского корпуса';
  if (id.includes('MOSKVITYANIN') || id.includes('МОСКВИТЯНИН')) return 'Редакция «Москвитянина»';
  if (id.includes('SHEVCHENKO') || id.includes('ШЕВЧЕН')) return 'Кирило-Мефодиевское товарищество / цензурное ведомство';
  if (id.includes('POBEDONOSTSEV') || id.includes('ПОБЕДОНОСЦ')) return 'К. П. Победоносцев';
  if (id.includes('HERZEN') || id.includes('ГЕРЦЕН')) return 'А. И. Герцен';
  return null;
};
const inferSourceType = (source) => {
  const text = `${source.sourceId} ${source.titleRu ?? ''} ${source.publication ?? ''}`.toUpperCase();
  if (text.includes('LETTER') || text.includes('ПИСЬМ') || text.includes('ПЕРЕПИСК')) return 'LETTER_PRIMARY';
  if (text.includes('INVESTIGATION') || text.includes('ДЕЛО') || text.includes('ПЕТРАШЕВ')) return 'JUDICIAL_PRIMARY';
  if (text.includes('СОВРЕМЕННИК') || text.includes('ОТЕЧЕСТВЕННЫЕ ЗАПИСКИ') || text.includes('ТЕЛЕСКОП')) return 'PERIODICAL_PRIMARY';
  return 'LITERARY_CRITICISM_PRIMARY';
};
const sourceRoleFor = (sceneRole) => sceneRole === 'IN_WORLD' ? 'PRIMARY_IN_WORLD' : sceneRole === 'LATER_CONTEXT' ? 'LATER_CONTEXT' : 'MODERN_ARCHIVE_COMMENTARY';
const displayCapabilityFor = (materialStatus) => materialStatus === 'MODERN_ARCHIVE_COMMENTARY' ? 'CATALOG_LINK_ONLY' : 'MODERN_TRANSCRIPTION';
const dateRecordFor = (value) => {
  const text = String(value ?? '');
  const years = [...text.matchAll(/\d{4}/g)].map((m) => Number(m[0]));
  const granularity = /-\d{2}-\d{2}$/.test(text) ? 'DAY' : /-\d{2}$/.test(text) ? 'MONTH' : years.length > 1 ? 'RANGE' : 'YEAR';
  return { granularity, earliest: text, latest: text, originalDateText: text, yearStart: years[0] ?? null, yearEnd: years.at(-1) ?? null };
};
const issueLabel = {
  pressFreedom: '언론 자유', westernism: '서구 사상', socialReform: '사회 개혁', stateAuthority: '국가 권한',
  literaturePublicRole: '문학의 공적 역할', slavophileAffinity: '슬라브주의 친화', riskTolerance: '위험 감수', inferredMeaningAsEvidence: '추론을 증거로 삼는 태도',
};
const semanticJustification = (judgment, excerpts) => {
  const cited = excerpts.slice(0, 2).map((e) => `${e.locator}의 “${e.ru.slice(0, 96)}${e.ru.length > 96 ? '…' : ''}”`).join('와 ');
  const issue = Object.entries(judgment.effect?.issue ?? {}).map(([key, value]) => `${issueLabel[key] ?? key}${value > 0 ? '을 강화' : '에 거리를 둠'}`).join('·');
  return `${cited || '연결된 직접 발췌'}를 대조해, “${judgment.text}”라는 판단을 ${issue || '중립적 기록'}으로 남긴다. 인용된 문장에 없는 인물의 의도나 후대의 결과는 이 판단에 덧붙이지 않는다.`;
};
const supplemental = {
  C02: {
    sources: [
      { sourceId: 'OBJ-WS-CHAADAEV-1836', titleKo: '차다예프 《철학적 편지》 제1서', titleRu: 'Философические письма, письмо первое', publication: '«Телескоп», 1836, т. 34; Wikisource transcription', date: '1836-09', locator: 'Wikisource lines 152–157', url: 'https://ru.wikisource.org/wiki/Философические_письма_(Чаадаев)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '1836년 《텔레스코프》 게재본의 동시기 공개 텍스트를 확인하고 해당 줄을 고정함' },
      { sourceId: 'OBJ-WS-PUSHKIN-CHAADAEV-1836', titleKo: '푸시킨이 차다예프에게 보낸 답신', titleRu: 'Письмо П. Я. Чаадаеву 19 октября 1836 г.', publication: 'Пушкин, Собрание сочинений, т. 10; Wikisource transcription', date: '1836-10-19', locator: 'Wikisource lines 106–107', url: 'https://ru.wikisource.org/wiki/Письмо_П._Я._Чаадаеву_19_октября_1836_г._(Пушкин)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '발신일·수신인·도시가 명시된 1836년 서신 본문을 확인함' },
    ],
    excerpts: [
      ['X1','OBJ-WS-CHAADAEV-1836','line 153','Мы живем лишь в самом ограниченном настоящем без прошедшего и без будущего, среди плоского застоя.','우리는 과거도 미래도 없는 가장 제한된 현재, 평평한 정체 속에서만 살아갑니다.','차다예프가 러시아의 역사적 단절을 현재의 정체라는 말로 진단하는 대목'],
      ['X2','OBJ-WS-CHAADAEV-1836','line 155','Настоящее развитие человеческого существа в обществе еще не началось для народа','사회 안에서 인간이 제대로 발전하는 일은 아직 민중에게 시작되지 않았습니다.','차다예프가 사회적 발전의 부재를 별도의 문제로 제시하는 대목'],
      ['X3','OBJ-WS-CHAADAEV-1836','line 157','не восприняли мы и традиционных идей человеческого рода.','우리는 인류가 이어 온 전통적 관념도 받아들이지 못했습니다.','역사적 전통과 사상의 단절을 구체화하는 문장'],
      ['X4','OBJ-WS-PUSHKIN-CHAADAEV-1836','line 106','разве не находите вы чего-то значительного в теперешнем положении России, чего-то такого, что поразит будущего историка?','지금 러시아의 상황에서 미래의 역사가를 놀라게 할 만한 중요한 무언가를 찾지 못하겠습니까?','푸시킨이 차다예프의 진단에 역사적 가능성을 맞세우는 대목'],
      ['X5','OBJ-WS-PUSHKIN-CHAADAEV-1836','line 107','Действительно, нужно сознаться, что наша общественная жизнь — грустная вещь.','실제로 우리의 사회생활이 슬픈 것임을 인정해야 합니다.','푸시킨이 반론 속에서도 사회 비판의 핵심을 인정하는 대목'],
    ],
    judgments: ['차다예프의 단절 진단과 푸시킨의 반론을 한 목소리로 합치지 않는다.','사회생활에 대한 비판과 국가 역사에 대한 애착을 서로 다른 주장으로 기록한다.','공개된 1836년 텍스트와 사적 답신의 도착 경로를 구분해 보관한다.'],
    effects: [{westernism:1},{stateAuthority:1},{socialReform:1}],
  },
  C04: {
    sources: [
      { sourceId: 'OBJ-WS-BELINSKY-RUSSIAN-PROSE-1835', titleKo: '벨린스키 《러시아 소설과 고골의 소설들에 관하여》', titleRu: 'О русской повести и повестях г. Гоголя', publication: '«Телескоп», 1835; Wikisource transcription', date: '1835', locator: 'Wikisource lines 121–127, 271–277', url: 'https://ru.wikisource.org/wiki/О_русской_повести_и_повестях_г._Гоголя_(Белинский)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '1835년 공개 비평문으로서 1839년 독자가 열람할 수 있는 기존 출판물의 본문을 확인함' },
      { sourceId: 'OBJ-WS-BELINSKY-KRAEVSKY-1839', titleKo: '벨린스키가 크라예프스키에게 보낸 1839년 2월 서신', titleRu: 'Письмо В. Г. Белинского И. И. Краевскому, 18 февраля 1839 г.', publication: 'Белинский, letter reproduced in contemporary correspondence record; Wikisource transcription', date: '1839-02-18', locator: 'Wikisource lines 169–179', url: 'https://ru.wikisource.org/wiki/Воспоминания_о_Белинском_(Панаев)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '서신의 날짜·수신인·잡지 협업 조건이 본문에 명시되어 있어 1839년 편집 환경의 직접 증거로 사용함' },
    ],
    excerpts: [
      ['X1','OBJ-WS-BELINSKY-RUSSIAN-PROSE-1835','line 122','может ли иметь на Руси успех русский роман, написанный по-русски и почерпнутый из русской жизни.','러시아어로 쓰이고 러시아의 삶에서 길어 올린 러시아 소설이 러시아에서 성공할 수 있는가.','벨린스키가 문학의 기준을 번역물이 아니라 러시아 현실에 연결하는 질문'],
      ['X2','OBJ-WS-BELINSKY-RUSSIAN-PROSE-1835','line 125','сделались не столько вследствие слепого подражания ... сколько вследствие общей потребности и господствующего духа времени.','그 형식은 맹목적 모방 때문이 아니라 사회의 공통된 필요와 시대의 지배적 정신 때문에 자리 잡았습니다.','문학 형식의 변화 원인을 독자의 사회적 필요와 연결하는 주장'],
      ['X3','OBJ-WS-BELINSKY-RUSSIAN-PROSE-1835','line 277','Отличительный характер повестей г. Гоголя составляют — простота вымысла, народность, совершенная истина жизни','고골 소설의 특징은 단순한 구성, 민중성, 삶의 완전한 진실성입니다.','고골을 평가할 때 실제 삶의 진실성을 기준으로 삼는 대목'],
      ['X4','OBJ-WS-BELINSKY-KRAEVSKY-1839','line 171','я бы желал взять на себя разбор всех книг чисто литературных','저는 순수하게 문학적인 책들의 서평을 맡고 싶습니다.','벨린스키가 편집 업무에서 맡으려는 비평 영역을 밝히는 대목'],
      ['X5','OBJ-WS-BELINSKY-KRAEVSKY-1839','line 173','литературной совести, которая для меня так дорога','저에게는 무엇보다 소중한 문학적 양심이 있습니다.','협업 조건에서 독립적 판단을 양보하지 않겠다는 서신의 표현'],
    ],
    judgments: ['러시아 현실에서 길어 올린 작품을 번역물과 같은 잣대로 처리하지 않는다.','문학 형식의 변화와 편집자의 생계·협업 조건을 하나의 주장으로 섞지 않는다.','잡지에 참여하되 문학적 양심을 포기하지 않는 선택을 공개 발언으로 남긴다.'],
    effects: [{literaturePublicRole:1},{pressFreedom:1},{pressFreedom:1}],
  },
  C08: {
    sources: [
      { sourceId: 'OBJ-WS-BELINSKY-HISTORY-1842', titleKo: '벨린스키 《보편사 안내서》 서평', titleRu: 'Руководство к всеобщей истории', publication: '«Отечественные записки», 1842, т. XXI; Wikisource transcription', date: '1842', locator: 'Wikisource lines 118–131', url: 'https://ru.wikisource.org/wiki/Руководство_к_всеобщей_истории_(Белинский)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '1842년 《Отечественные записки》 게재 정보와 본문을 확인함' },
      { sourceId: 'OBJ-WS-BELINSKY-GOGOL-1842', titleKo: '벨린스키가 고골에게 보낸 1842년 4월 서신', titleRu: 'Письмо Н. В. Гоголю 20 апреля 1842 г.', publication: 'Белинский correspondence record; Wikisource transcription', date: '1842-04-20', locator: 'letter text; dated Petersburg, 20 April 1842', url: 'https://ru.wikisource.org/wiki/Письмо_Н._В._Гоголю_20_апреля_1842_г._(Белинский)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '서신의 날짜·발신 도시·수신인이 본문에 명시되어 있고 공개 전사본의 원문을 대조함' },
    ],
    excerpts: [
      ['X1','OBJ-WS-BELINSKY-HISTORY-1842','line 118','Век наш — по преимуществу исторический век.','우리 시대는 무엇보다 역사적인 시대입니다.','벨린스키가 현재의 예술과 사회를 역사적 의식 속에서 읽는 선언'],
      ['X2','OBJ-WS-BELINSKY-HISTORY-1842','line 125','это не интересы сословия, но интересы общества; не интересы государства, но интересы человечества','이것은 한 계층의 이익이 아니라 사회의 이익이며, 국가의 이익이 아니라 인류의 이익입니다.','문학의 공적 기준을 국가나 계층보다 넓은 사회적 관심과 연결하는 대목'],
      ['X3','OBJ-WS-BELINSKY-HISTORY-1842','line 131','Чувство общественности теперь везде сильнее, чем когда-либо прежде было.','공동체 의식은 이제 그 어느 때보다 강합니다.','역사 의식과 사회적 감각의 관계를 설명하는 대목'],
      ['X4','OBJ-WS-BELINSKY-GOGOL-1842','line 1','Главною причиною этого было желание написать вам что-нибудь положительное и верное, хотя бы даже и неприятное.','가장 큰 이유는 불쾌하더라도 긍정적이고 정확한 말을 쓰고 싶었기 때문입니다.','비평에서 호의보다 정확성을 우선하겠다는 1842년 서신의 진술'],
      ['X5','OBJ-WS-BELINSKY-GOGOL-1842','line 2','Вы у нас теперь один — и мое нравственное существование, моя любовь к творчеству тесно связаны с вашею судьбою','당신은 지금 우리에게 유일한 사람이며, 나의 도덕적 존재와 창작에 대한 사랑은 당신의 운명과 긴밀히 이어져 있습니다.','문학적 판단과 실제 인물에 대한 관계가 함께 놓인 대목'],
    ],
    judgments: ['역사 의식이라는 문장을 슬라브파와 서구파 어느 한쪽의 구호로 축소하지 않는다.','국가·계층의 이익과 사회·인류의 이익을 구별해 비평의 기준으로 남긴다.','고골에 대한 공개 비평과 사적 신뢰를 서로 다른 관계 기록으로 보관한다.'],
    effects: [{westernism:1},{socialReform:1},{literaturePublicRole:1}],
  },
  C09: {
    sources: [
      { sourceId: 'OBJ-WS-BELINSKY-ODOEVSKY-1844', titleKo: '벨린스키 《오도옙스키 공작의 작품》', titleRu: 'Сочинения князя В. Ф. Одоевского', publication: '1844; Wikisource transcription of Belinsky collected works', date: '1844', locator: 'Wikisource lines 100, 108–113, 130–133', url: 'https://ru.wikisource.org/wiki/Сочинения_князя_В._Ф._Одоевского_(Белинский)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: 'Wikisource record identifies 1844 publication and the reviewed St Petersburg edition; quoted paragraphs are fixed by page lines' },
      { sourceId: 'OBJ-WS-BELINSKY-LERMONTOV-1844', titleKo: '벨린스키 《우리 시대의 영웅》 제3판 평론', titleRu: 'Герой нашего времени. Сочинение М. Лермонтова. Издание третье', publication: '1844; Wikisource transcription of Belinsky collected works', date: '1844', locator: 'Wikisource lines 105, 120–129', url: 'https://ru.wikisource.org/wiki/Герой_нашего_времени._Сочинение_М._Лермонтова._Издание_третье..._(Белинский)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: 'Wikisource record identifies 1844 publication and quotes the 1843 third edition under review' },
    ],
    excerpts: [
      ['X1','OBJ-WS-BELINSKY-ODOEVSKY-1844','line 108','Князь Одоевский принадлежит к числу наиболее уважаемых из современных русских писателей','오도옙스키 공작은 당대 러시아 작가 가운데 가장 존경받는 이들에 속합니다.','평론이 작가의 동시대적 위상을 먼저 특정하는 대목'],
      ['X2','OBJ-WS-BELINSKY-ODOEVSKY-1844','line 111','тут не было ни классицизма, ни романтизма, а была только борьба умственного движения с умственным застоем','여기에는 고전주의도 낭만주의도 없었고, 지적 운동과 지적 정체의 투쟁만이 있었습니다.','문학사 분류를 지적 운동과 정체의 대립으로 다시 규정하는 대목'],
      ['X3','OBJ-WS-BELINSKY-ODOEVSKY-1844','line 131','Это была первая повесть из русской действительности, первая попытка изобразить общество не идеальное и нигде не существующее, но такое, каким автор видел его в действительности.','이 작품은 러시아 현실에서 나온 첫 소설이자, 이상적이고 어디에도 없는 사회가 아니라 작가가 실제로 본 사회를 그린 첫 시도였습니다.','문학의 가치를 현실 사회의 재현과 연결하는 대목'],
      ['X4','OBJ-WS-BELINSKY-LERMONTOV-1844','line 123','Три издания менее чем в четыре года: как хотите, а это успех, огромный успех!','네 해가 되기도 전에 세 판이 나왔습니다. 어떻게 생각하시든, 이것은 성공, 엄청난 성공입니다!','출판 횟수와 독자 반응을 문학적 영향의 공개 지표로 기록하는 대목'],
      ['X5','OBJ-WS-BELINSKY-LERMONTOV-1844','line 124','кроме «Мертвых душ» и нескольких новых пьес Гоголя, — «Герой нашего времени» ... все-таки новые, словно сегодня написанные книги','《죽은 혼》과 고골의 몇몇 새 희곡을 빼면, 《우리 시대의 영웅》은 오늘 쓰인 듯 여전히 새롭습니다.','동시대 문학의 지속성을 다른 작품들과 비교하는 대목'],
    ],
    judgments: ['문학사의 분류명을 그대로 정치적 진영의 표지로 바꾸지 않고, 지적 운동과 정체의 대비로 기록한다.','러시아 현실의 재현이라는 비평 기준이 작품의 형식·독자 반응과 어떻게 이어지는지 구분해 남긴다.','판본 수와 지속되는 새로움을 문학적 영향의 공개 증거로 사용하되 작가의 사적 의도라고 과장하지 않는다.'],
    effects: [{westernism:1},{literaturePublicRole:1},{socialReform:1}],
  },
  C10: {
    sources: [
      { sourceId: 'OBJ-WS-BELINSKY-PHYSIOLOGY-INTRO-1845', titleKo: '벨린스키 《페테르부르크의 생리학》 서문', titleRu: 'Вступление к «Физиологии Петербурга»', publication: '«Физиология Петербурга», part I, 1845; Wikisource transcription', date: '1845', locator: 'Wikisource lines 92, 96, 105–113', url: 'https://ru.wikisource.org/wiki/Вступление_(Белинский)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: 'Wikisource record identifies 1845 publication and the Nekrasov-edited collection; direct paragraphs are fixed by lines' },
      { sourceId: 'OBJ-WS-BELINSKY-TARANTAS-1845', titleKo: '벨린스키 《타란타스》 평론', titleRu: 'Тарантас. Путевые впечатления. Сочинение графа В. А. Соллогуба', publication: '«Отечественные записки», 1845, т. XL, № 6; Wikisource transcription', date: '1845', locator: 'Wikisource lines 99, 103–110', url: 'https://ru.wikisource.org/wiki/Тарантас_(Белинский)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: 'Wikisource record identifies 1845 publication, censorship date, reviewed book, and direct review text' },
    ],
    excerpts: [
      ['X1','OBJ-WS-BELINSKY-PHYSIOLOGY-INTRO-1845','line 105','Русскую литературу часто упрекают за равнодушие к предметам отечественным.','러시아 문학은 국내의 문제에 무관심하다는 비판을 자주 받습니다.','서문이 자연파 논쟁을 러시아 사회의 재현 문제로 시작하는 대목'],
      ['X2','OBJ-WS-BELINSKY-PHYSIOLOGY-INTRO-1845','line 109','у нас довольно романов исторических, которые хотят знакомить публику с прошедшим бытом России ... еще более у нас повестей в этом роде','러시아의 과거 생활을 독자에게 알리려는 역사소설은 충분하고, 그런 종류의 단편소설은 더 많습니다.','기존 문학 장르가 사회 현실을 어떻게 다루는지 비판적으로 구분하는 대목'],
      ['X3','OBJ-WS-BELINSKY-PHYSIOLOGY-INTRO-1845','line 113','в них нет ни сатиры, ни нравов, потому что нет взгляда на вещи, нет идеи, нет знания русского общества','그 안에는 사물에 대한 시선도, 사상도, 러시아 사회에 대한 지식도 없기에 풍자도 풍속도 없습니다.','현실 묘사의 기준을 단순한 외양이 아니라 사회 인식으로 제시하는 대목'],
      ['X4','OBJ-WS-BELINSKY-TARANTAS-1845','line 104','В современной русской литературе журнал совершенно убил книгу.','현대 러시아 문학에서 잡지가 책을 완전히 죽였습니다.','평론이 출판 매체의 변화와 문학적 판단의 조건을 지적하는 대목'],
      ['X5','OBJ-WS-BELINSKY-TARANTAS-1845','line 110','объективную верность, с какою изобразил он характер одного из героев «Тарантаса», приняли за выражение его личных убеждений','사람들은 《타란타스》 인물의 성격을 객관적으로 그린 것을 작가 자신의 신념 표현으로 받아들였습니다.','작품 속 인물의 목소리와 작가의 입장을 구분하는 비평상의 판단'],
    ],
    judgments: ['자국 사회를 다루는 문학의 부족이라는 비판을 단순한 애국 구호가 아니라 자료와 관찰의 문제로 기록한다.','자연파의 현실 묘사와 기존 역사·풍속소설의 장르 주장을 같은 증거로 합치지 않는다.','작품 속 인물의 발언을 작가의 사적 신념으로 오인하지 않고, 잡지와 책의 매체 조건을 별도로 남긴다.'],
    effects: [{socialReform:1},{literaturePublicRole:1},{pressFreedom:1}],
  },
  C11: {
    sources: [
      { sourceId: 'OBJ-WS-BELINSKY-METEOR-1845', titleKo: '벨린스키 《1845년의 유성》 평론', titleRu: 'Метеор, на 1845 год', publication: '«Отечественные записки», 1845, т. XL, № 5; Wikisource transcription', date: '1845-05-02', locator: 'Wikisource lines 99, 113–119, 314', url: 'https://ru.wikisource.org/wiki/Метеор,_на_1845_год..._(Белинский)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: 'Wikisource record identifies the 1845 almanac, publication issue, censorship and release dates, and review text' },
      { sourceId: 'OBJ-WS-BELINSKY-PHYSIOLOGY-1845', titleKo: '벨린스키 《페테르부르크의 생리학》 평론', titleRu: 'Физиология Петербурга', publication: '«Отечественные записки», 1845, parts I–II; Wikisource transcription', date: '1845', locator: 'Wikisource lines 101, 109–115, commentary lines 403–409', url: 'https://ru.wikisource.org/wiki/Физиология_Петербурга_(Белинский)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: 'Wikisource record identifies the 1845 two-part almanac and direct review text; later editorial notes are not used as direct excerpts' },
    ],
    excerpts: [
      ['X1','OBJ-WS-BELINSKY-METEOR-1845','line 113','МЕТЕОР, НА 1845 ГОД. Санкт-Петербург. В тип. Штаба Отдельного корпуса внутренней стражи. В 8-ю д. л. 175 стр.','《1845년의 유성》. 상트페테르부르크, 내무경비 별도부대 사령부 인쇄소, 8절판 175쪽.','연감의 서지 정보와 제작 장소를 직접 기록하는 대목'],
      ['X2','OBJ-WS-BELINSKY-METEOR-1845','line 115','Подобно альманахам, стихи были в большой моде, и появись эта книжка в свое время ... публика покупала и читала бы ее.','연감처럼 시집은 한때 크게 유행했으며, 이 책이 제때 나왔다면 독자들이 사서 읽었을 것입니다.','연감의 유행과 독자 수용을 연결하는 평론의 판단'],
      ['X3','OBJ-WS-BELINSKY-METEOR-1845','line 118','нужно могучее сочувствие с вопросами современной действительности','현대 현실의 문제에 대한 강한 공감이 필요합니다.','문학적 가치 판단을 동시대 현실과 연결하는 기준'],
      ['X4','OBJ-WS-BELINSKY-PHYSIOLOGY-1845','line 109','у нас довольно романов исторических ... еще более у нас повестей в этом роде','우리에게는 역사소설이 충분하고, 그와 같은 풍속소설과 단편소설은 더 많습니다.','기존 연감·소설 형식의 사회 묘사 범위를 구분하는 대목'],
      ['X5','OBJ-WS-BELINSKY-PHYSIOLOGY-1845','line 112','Физиология Петербурга — есть род альманаха в прозе, со статьями разнообразными, но относящимися к одному предмету — к Петербургу.','《페테르부르크의 생리학》은 서로 다른 글을 싣되 하나의 대상, 페테르부르크를 다루는 산문 연감입니다.','연감의 편집 원리와 공통 주제를 설명하는 직접 문장'],
    ],
    judgments: ['연감의 서지·제작 정보를 작품의 정치적 의미와 분리해 기록하되, 공개된 출판 조건은 pressFreedom의 판단 근거로 남긴다.','독자 수용과 현실에 대한 공감이라는 평론의 기준을 문학의 공적 역할로 반영한다.','서로 다른 글을 하나의 도시라는 공통 대상에 묶는 편집 원리를 사회 현실을 보는 관점으로 기록한다.'],
    effects: [{pressFreedom:1},{literaturePublicRole:1},{socialReform:1}],
  },
  C12: {
    sources: [
      { sourceId: 'OBJ-WS-BELINSKY-PETERSBURG-COLLECTION-1846', titleKo: '벨린스키 《페테르부르크 모음집》 평론', titleRu: 'Петербургский сборник', publication: '«Отечественные записки», 1846, т. XLV, № 3; Wikisource transcription', date: '1846-03', locator: 'Wikisource lines 100, 104–108, 143–166, 177–181', url: 'https://ru.wikisource.org/wiki/Петербургский_сборник_(Белинский)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: 'Wikisource record identifies the 1846 publication, censorship date, almanac contents, and Belinsky review text' },
      { sourceId: 'OBJ-WS-YAZYKOV-GOGOL-1846', titleKo: '야지코프가 고골에게 보낸 1846년 2월 서신', titleRu: 'Языков Н. М. — Гоголю, 18 февраля 1846', publication: 'Correspondence transcription; Wikisource', date: '1846-02-18', locator: 'Wikisource lines 937–960', url: 'https://ru.wikisource.org/wiki/Переписка_с_Н._М._Языковым_(Гоголь)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '서신의 발신일·발신지·수신인과 도스토옙스키의 신작을 언급하는 동시기 문장을 확인함' },
    ],
    excerpts: [
      ['X1','OBJ-WS-BELINSKY-PETERSBURG-COLLECTION-1846','line 108','«Бедные люди», роман г. Достоевского, в этом альманахе — первая статья и по месту и по достоинству. Начинаем с нее.','도스토옙스키의 소설 《가난한 사람들》은 이 연감에서 지면과 가치 모두 첫 번째입니다. 이 작품부터 시작하겠습니다.','평론이 신인의 첫 소설을 연감의 중심 작품으로 특정하는 대목'],
      ['X2','OBJ-WS-BELINSKY-PETERSBURG-COLLECTION-1846','line 143','Несмотря на то, успех «Бедных людей» был полный.','그럼에도 《가난한 사람들》의 성공은 완전했습니다.','초기 독자 반응을 단정하되 지역별 독서 범위와 구분하는 대목'],
      ['X3','OBJ-WS-BELINSKY-PETERSBURG-COLLECTION-1846','line 155','талант г. Достоевского не сатирический, не описательный, но в высокой степени творческий','도스토옙스키의 재능은 풍자적이거나 묘사적인 것이 아니라 매우 창조적입니다.','작가의 문학적 방법을 장르 표지와 구별해 판단하는 대목'],
      ['X4','OBJ-WS-YAZYKOV-GOGOL-1846','line 945','В Питере, по мнению «Отечественных записок», явился новый гений — какой-то Достоевский; повесть его найдешь ты в сборнике Некрасова.','《조국 수기》의 견해로는 페테르부르크에 새로운 천재, 어떤 도스토옙스키가 나타났다고 합니다. 그의 소설은 네크라소프의 모음집에서 찾을 수 있습니다.','모스크바의 동시기 서신이 페테르부르크의 문학적 반응을 전달하는 대목'],
      ['X5','OBJ-WS-YAZYKOV-GOGOL-1846','line 960','В «Петербургском сборнике, изданном Н. Некрасовым» ... был опубликован роман Ф. М. Достоевского «Бедные люди», высоко оцененный В. Г. Белинским','네크라소프가 펴낸 《페테르부르크 모음집》에는 벨린스키가 높이 평가한 도스토옙스키의 소설 《가난한 사람들》이 실렸습니다.','서신의 주석이 작품·출판물·평론가의 관계를 명시하는 대목'],
    ],
    judgments: ['도스토옙스키의 첫 소설을 신인의 명성으로만 처리하지 않고, 연감의 배치와 평론의 실제 문장으로 기록한다.','빈곤한 인물의 인간적 존엄을 읽어내는 평론의 판단을 사회 현실에 대한 문학의 공적 역할로 반영한다.','페테르부르크의 평판이 모스크바로 전달되는 서신 경로와 벨린스키의 직접 평론을 서로 다른 증거로 보관한다.'],
    effects: [{literaturePublicRole:1},{socialReform:1},{pressFreedom:1}],
  },
  C13: {
    sources: [
      { sourceId: 'OBJ-WS-PETRASHEVSKY-DICTIONARY-1846', titleKo: '페트라셰프스키 《외국어 휴대 사전》 제2호 발췌', titleRu: 'Карманный словарь иностранных слов', publication: '1846 edition excerpts; Wikisource transcription', date: '1846-04', locator: 'Wikisource lines 101, 109–113, 156–176, 193', url: 'https://ru.wikisource.org/wiki/Карманный_словарь_иностранных_слов_(Петрашевский)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: 'Wikisource record identifies the 1846 publication and preserves direct dictionary entries; later biography paragraphs are excluded from excerpts' },
      { sourceId: 'OBJ-WS-NEKRASOV-PETERSBURG-CHRONICLE-1844', titleKo: '네크라소프 《페테르부르크 연대기》의 사전 발행 예고', titleRu: 'Петербургская хроника', publication: '26 October 1844; Wikisource transcription', date: '1844-10-26', locator: 'Wikisource lines 139–147, 251–253', url: 'https://ru.wikisource.org/wiki/Петербургская_хроника_(Некрасов)/Версия_3', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '1846년 자료철에서 독자가 이미 확인할 수 있었던 1844년 공개 발행 예고의 원문과 날짜를 고정함' },
    ],
    excerpts: [
      ['X1','OBJ-WS-PETRASHEVSKY-DICTIONARY-1846','line 111','На нас лежит труд немалый — труд применения тех общих начал, которые выработала наука на Западе, к нашей действительности.','우리에게는 서구의 학문이 만들어 낸 일반 원리를 우리의 현실에 적용하는 큰 과제가 놓여 있습니다.','사전이 외국 사상을 러시아 현실에 옮기는 작업임을 직접 밝히는 문장'],
      ['X2','OBJ-WS-PETRASHEVSKY-DICTIONARY-1846','line 170','Натуральным, или естественным, правом называется та наука, которая из начал чистого разума или идеи о справедливости выводит все права и обязанности человека','자연법은 순수한 이성이나 정의의 관념에서 인간의 모든 권리와 의무를 이끌어 내는 학문입니다.','사전 항목이 권리·의무의 사회적 언어를 정의하는 대목'],
      ['X3','OBJ-WS-PETRASHEVSKY-DICTIONARY-1846','lines 173–174','жизнь человека всегда и везде и для всех безусловно священна','인간의 생명은 언제 어디서나 누구에게나 무조건 신성합니다.','인간의 보편적 권리를 정의하는 직접 문장'],
      ['X4','OBJ-WS-NEKRASOV-PETERSBURG-CHRONICLE-1844','line 141','множество иностранных слов сделались для нас почти единственным ... оружием для выражения наших понятий','많은 외국어가 우리의 관념을 표현하는 거의 유일한 도구가 되었습니다.','사전 발행의 공적 필요를 설명하는 당시의 공개 예고'],
      ['X5','OBJ-WS-NEKRASOV-PETERSBURG-CHRONICLE-1844','line 143','около 4000 слов, объясненных кратко, но с возможною ясностию — не только для читателей совершенно образованных, но и для молодых людей','약 4천 개의 단어를 가능한 한 명료하게 설명하며, 완전히 교육받은 독자뿐 아니라 아직 학업을 마치지 않은 젊은이도 대상으로 합니다.','사전의 예상 독자와 지식의 공공성을 특정하는 대목'],
    ],
    judgments: ['사전의 서구 개념 수용을 막연한 반정부 음모로 확정하지 않고, 러시아 현실에 적용하려는 공개 편집 목적과 구분해 기록한다.','자연법과 인간 생명의 보편성에 관한 항목을 사회개혁 쟁점으로 반영하되, 훗날의 체포 기록을 소급해 넣지 않는다.','외국어 사전의 발행 목적·예상 독자·표현의 명료성을 출판과 공론 접근의 문제로 판단한다.'],
    effects: [{westernism:1},{socialReform:1},{pressFreedom:1}],
  },
  C23: {
    sources: [
      { sourceId: 'OBJ-WS-PETRASHEVSKY-CASE-1849', titleKo: '페트라셰프스키 사건 조사·판결 기록', titleRu: 'Петрашевцы', publication: '1849 investigation, official reports and verdict; Wikisource modern transcription', date: '1849', locator: 'Wikisource lines 391, 1410, 2768', url: 'https://ru.wikisource.org/wiki/Петрашевцы_(Петрашевский)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '현대 전사본에서 1849년 수사·공식 보고·판결에 포함된 직접 기록만 사용하고, 후대 해설 문단은 제외함' },
      { sourceId: 'OBJ-WS-DOSTOEVSKY-INVESTIGATION-1849', titleKo: '도스토옙스키 페트라셰프스키 사건 조사철', titleRu: 'Следственное дело М. М. Достоевского-петрашевца', publication: '1849 investigation dossier; Wikisource modern transcription', date: '1849', locator: 'Wikisource lines 105–121', url: 'https://ru.wikisource.org/wiki/Следственное_дело_М._М._Достоевского-петрашевца', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '1849년 체포·신문·공식 보고 문서의 전사본에서 직접 조사 기록과 증거 한계를 대조함' },
    ],
    excerpts: [
      ['X1','OBJ-WS-PETRASHEVSKY-CASE-1849','line 391','в 22 день апреля сего 1849 года ... повелеть соизволили: арестовать как Петрашевского, так и тех лиц, которые посещали его собрания','1849년 4월 22일, 페트라셰프스키와 그의 모임에 출석한 사람들을 체포하라는 명령이 내려졌습니다.','체포 명령이라는 행정 조치와 실제 모임의 발언을 구분하게 하는 공식 기록'],
      ['X2','OBJ-WS-PETRASHEVSKY-CASE-1849','line 1410','в январе 1848 года познакомился с Петрашевским ... бывал у него на вечерах 1 и 15 апреля 1849 года ... говорили об освобождении крестьян','1848년 1월 페트라셰프스키를 알게 되었고, 1849년 4월 1일과 15일 그의 모임에 갔으며, 농민 해방에 관해 이야기했습니다.','골로빈스키의 증언이 만남의 시점과 농민 해방 논의를 함께 특정하는 대목'],
      ['X3','OBJ-WS-PETRASHEVSKY-CASE-1849','line 2768','Достоевский посещал собрания у Петрашевского в продолжение трех лет ... слышал разговоры об освобождении крестьян, о судопроизводстве и цензуре','도스토옙스키는 3년 동안 페트라셰프스키의 모임에 참석했고, 농민 해방·사법 절차·검열에 관한 대화를 들었습니다.','판결 자료가 모임의 기간과 논의된 공적 쟁점을 함께 기록하는 대목'],
      ['X4','OBJ-WS-DOSTOEVSKY-INVESTIGATION-1849','line 115','Допрашивали Достоевского 2-го ... Бывал у Петрашевского и уверяет, что у него собирались только для веселья. Но потом просил разрешения припомнить и изложить их на бумаге','도스토옙스키를 두 번째로 신문했다. 그는 페트라셰프스키 집에 갔지만 모임은 오락을 위한 것뿐이었다고 주장했다. 그러나 뒤에 기억을 정리해 종이에 쓰게 해 달라고 요청했다.','초기 진술과 이후 서면 진술 요청 사이의 증거 충돌을 보존하는 신문 기록'],
      ['X5','OBJ-WS-DOSTOEVSKY-INVESTIGATION-1849','line 118','в бумагах отставного подпоручика Михаила Достоевского не оказалось ничего относящегося к известному делу','퇴역 소위 미하일 도스토옙스키의 서류에서는 해당 사건과 관련된 것이 아무것도 나오지 않았습니다.','수사 서류가 확인하지 못한 범위를 함께 기록하는 공식 보고'],
    ],
    judgments: ['체포 명령이라는 국가 조치와 참석자 증언을 같은 종류의 사실로 합치하지 않는다.','농민 해방에 관한 증언은 정치적 주장으로 기록하되, 증언자의 시점과 출처를 함께 남긴다.','“오락을 위한 모임”이라는 초기 진술과 이후 서면 진술 요청을 대조하고, 확인되지 않은 의도를 덧붙이지 않는다.'],
    effects: [{stateAuthority:1},{socialReform:1},{pressFreedom:1}],
  },
  C20: {
    sources: [
      { sourceId: 'OBJ-WS-BELINSKY-REVIEW-1848', titleKo: '벨린스키 《1847년 러시아 문학 개관》', titleRu: 'Взгляд на русскую литературу 1847 года', publication: '«Современник», 1848, т. VII–VIII; Wikisource transcription', date: '1848-02', locator: 'Wikisource lines 663–666, 636–637', url: 'https://ru.wikisource.org/wiki/Взгляд_на_русскую_литературу_1847_года_(Белинский)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '1848년 《Современник》 게재 정보와 검열로 왜곡된 잡지 본문에 대한 당시 기록을 확인함' },
      { sourceId: 'OBJ-WS-SOVREMENNIK-EDITORIAL-1848', titleKo: '《현대인》 편집부의 알림', titleRu: 'От редакции «Современника»', publication: '«Современник», 1848, № 4; Wikisource transcription', date: '1848-03-31', locator: 'Wikisource publication record and editorial notice', url: 'https://ru.wikisource.org/wiki/От_редакции_«Современника»_(Некрасов)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '1848년 3월 31일 검열 허가가 표시된 편집부 공지의 직접 문장을 사용함' },
    ],
    excerpts: [
      ['X1','OBJ-WS-BELINSKY-REVIEW-1848','line 663','„Современник“, 1848, т. VII, № 1 ... и т. VIII, № 3 ... Подпись: В. Белинский.','《현대인》 1848년 제7·8권에 실렸고, 벨린스키의 서명이 붙었습니다.','발언의 매체·연도·저자를 특정하는 서지 표지'],
      ['X2','OBJ-WS-BELINSKY-REVIEW-1848','line 665','Журнальный текст искажен цензурой.','잡지 본문은 검열로 왜곡되었습니다.','인쇄된 문장과 원고·후대 대조본을 같은 텍스트로 취급하지 않게 하는 기록'],
      ['X3','OBJ-WS-BELINSKY-REVIEW-1848','line 636','она уже дело, подлежащее суду общественного мнения, а не книжное, не имеющее связи с жизнию занятие','비평은 이제 여론의 판단을 받는 일이 되었지, 삶과 관계없는 책상 위의 일이 아닙니다.','문학 비평을 공적 판단과 연결하는 당시의 주장'],
      ['X4','OBJ-WS-SOVREMENNIK-EDITORIAL-1848','line 1','Мы уже говорили, что издание иллюстрированных книг сопряжено у нас с чрезвычайными затруднениями','그림이 있는 책을 발행하는 일은 우리에게 매우 큰 어려움과 맞닿아 있다고 이미 말씀드렸습니다.','편집부가 출판 지연을 행정·검열 환경의 문제로 알리는 문장'],
      ['X5','OBJ-WS-SOVREMENNIK-EDITORIAL-1848','line 2','одна из таких непредвиденных остановок случилась с «Иллюстрированным альманахом»','그런 예기치 않은 중단이 《삽화 연감》에 일어났습니다.','특정 간행물의 중단을 일반론이 아니라 편집부 공지로 확인하는 문장'],
    ],
    judgments: ['검열로 변형된 잡지 본문과 편집자가 보존하려 한 비평의 범위를 분리해 기록한다.','비평의 공적 기능을 인정하되, 이를 곧바로 혁명적 의도의 증거로 확정하지 않는다.','출판 중단 공지를 외부 소문이 아니라 편집부가 독자에게 보낸 행정적 설명으로 분류한다.'],
    effects: [{pressFreedom:1},{literaturePublicRole:1},{stateAuthority:1}],
  },
  C22: {
    sources: [
      { sourceId: 'OBJ-WS-NEKRASOV-SUBSCRIBERS-1848', titleKo: '네크라소프·파나예프의 구독자 서신', titleRu: 'Письменное обращение редакции «Современника» к подписчикам', publication: '17 November 1848; authorized copies, Wikisource transcription', date: '1848-11-17', locator: 'Wikisource dated letter and body', url: 'https://ru.wikisource.org/wiki/Письменное_обращение_редакции_«Современника»_к_подписчикам_(Некрасов)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '1848년 11월 17일자 네크라소프·파나예프 서명 사본의 구독자 대상 본문을 확인함' },
      { sourceId: 'OBJ-WS-NEKRASOV-CENSOR-NOTE-1848', titleKo: '네크라소프의 《세상의 세 지역》 검열관 제출 메모', titleRu: 'Примечание для г. цензоров «Современника» к роману «Три страны света»', publication: '1848; autograph, Wikisource transcription', date: '1848', locator: 'Wikisource direct note and archival publication record', url: 'https://ru.wikisource.org/wiki/Примечание_для_г._цензоров_«Современника»_к_роману_«Три_страны_света»_(Некрасов)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '1848년 검열관에게 제출한 자필 메모의 직접 문장과 문서 성격을 사용함' },
    ],
    excerpts: [
      ['X1','OBJ-WS-NEKRASOV-SUBSCRIBERS-1848','line 1','Многие подписчики «Современника» ... справедливо жалуются на долговременную невыдачу давно обещанного «Иллюстрированного альманаха»','많은 《현대인》 구독자들이 오래 약속한 《삽화 연감》이 오랫동안 나오지 않은 일을 정당하게 항의하고 있습니다.','출판 지연을 독자에게 설명해야 했던 편집부의 공개 상황'],
      ['X2','OBJ-WS-NEKRASOV-SUBSCRIBERS-1848','line 2','Редактор «Современника» Ив. Панаев. Издатель «Современника» Н. Некрасов.','《현대인》 편집자 이반 파나예프, 발행인 니콜라이 네크라소프.','책임 주체가 서명으로 명시된 편집부 문서'],
      ['X3','OBJ-WS-NEKRASOV-SUBSCRIBERS-1848','line 3','17 ноября 1848. СПб.','1848년 11월 17일, 상트페테르부르크.','문서의 시점과 장소를 고정하는 원문 표지'],
      ['X4','OBJ-WS-NEKRASOV-CENSOR-NOTE-1848','line 1','Примечание ... было написано согласно цензурному правилу','이 메모는 검열 규칙에 따라 작성되었습니다.','검열 제출 문서가 자발적 선언과 다른 행정 장르임을 보여 주는 기록'],
      ['X5','OBJ-WS-NEKRASOV-CENSOR-NOTE-1848','line 2','в романе «Три страны света» «порок будет наказан, а добродетель восторжествует»','《세상의 세 지역》에서는 악덕이 벌을 받고 덕이 승리할 것입니다.','검열을 통과시키기 위해 작품의 도덕적 결말을 보증한 문장'],
    ],
    judgments: ['구독자에게 한 출판 지연 설명과 검열관에게 낸 작품 보증을 서로 다른 공적 기록으로 분리한다.','서명과 날짜가 있는 편집부 문서를 익명 소문보다 높은 식별 가능 증거로 기록한다.','검열 문구의 도덕적 보증을 작가의 전체 정치관으로 확대하지 않는다.'],
    effects: [{pressFreedom:1},{stateAuthority:1},{inferredMeaningAsEvidence:-1}],
  },
  C15: {
    sources: [
      { sourceId: 'OBJ-WS-GOGOL-BEL-1847-JUNE', titleKo: '고골이 벨린스키에게 보낸 1847년 6월 서신', titleRu: 'Гоголь — Белинскому, около 8 (20) июня 1847', publication: 'Викитека correspondence transcription', date: '1847-06', locator: 'letter sections; lines 206–223', url: 'https://ru.wikisource.org/wiki/Переписка_с_В._Г._Белинским_(Гоголь)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: 'Wikisource page identifies date, sender, recipient, place, and cited collected edition' },
      { sourceId: 'OBJ-WS-GOGOL-BEL-1847-AUG', titleKo: '고골이 벨린스키에게 보낸 1847년 8월 서신', titleRu: 'Гоголь — Белинскому, 29 июля (10 августа) 1847', publication: 'Викитека correspondence transcription', date: '1847-08-10', locator: 'letter section; lines 330–345', url: 'https://ru.wikisource.org/wiki/Переписка_с_В._Г._Белинским_(Гоголь)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: 'Wikisource page identifies the 29 July / 10 August 1847 letter and Ostend' },
    ],
    excerpts: [
      ['X1','OBJ-WS-GOGOL-BEL-1847-JUNE','line 211','Я прочел с прискорбием статью вашу обо мне во втором No «Современника».','《현대인》 제2호에 실린 나에 관한 당신의 글을 슬픔으로 읽었습니다.','고골이 벨린스키의 비평을 읽은 사실과 감정적 반응'],
      ['X2','OBJ-WS-GOGOL-BEL-1847-JUNE','line 212','Я думал, что мне великодушно простят и что в книге моей зародыш примирения всеобщего, а не раздора.','나는 사람들이 관대하게 용서하고, 내 책에서 분열이 아니라 보편적 화해의 싹을 보리라 생각했습니다.','고골이 책의 의도를 스스로 설명하는 대목'],
      ['X3','OBJ-WS-GOGOL-BEL-1847-JUNE','line 213','Оставьте все те места, которые покаместь еще загадка для многих, если не для всех','아직 많은 사람에게, 아니 모두에게도 수수께끼인 대목은 일단 그대로 두십시오.','고골이 반론에 앞서 독해의 범위를 제안하는 대목'],
      ['X4','OBJ-WS-GOGOL-BEL-1847-AUG','line 336','Бог весть, может быть, и в ваших словах есть часть правды.','하느님만 아시겠지만, 당신의 말에도 어쩌면 진실의 일부가 있을 것입니다.','고골이 벨린스키의 비판에 일부 진실이 있을 수 있다고 인정하는 대목'],
      ['X5','OBJ-WS-GOGOL-BEL-1847-AUG','line 337','ни одно из них не похоже на другое, нет двух человек, согласных во мненьях об одном и том же предмете','그 편지들 중 어느 것도 서로 같지 않았고, 같은 사안에 의견이 일치하는 두 사람도 없었습니다.','고골이 상반된 독자 반응을 기록하는 대목'],
    ],
    judgments: ['서신의 상처와 책의 공적 주장을 같은 사실로 합치지 않는다.','고골의 자기 해명을 후대의 평가가 아니라 1847년 서신의 발언으로 기록한다.','“일부 진실”이라는 유보를 전면적 철회로 확대하지 않는다.'],
    effects: [{inferredMeaningAsEvidence:-1},{literaturePublicRole:1},{inferredMeaningAsEvidence:-1}],
  },
  C16: {
    sources: [
      { sourceId: 'OBJ-WS-BELINSKY-1847', titleKo: '고골에게 보낸 1847년 7월 벨린스키의 편지', titleRu: 'Белинский В. Г. — Гоголю, 3(15) июля 1847', publication: 'Викитека correspondence transcription', date: '1847-07-15', locator: 'letter section; lines 227–243', url: 'https://ru.wikisource.org/wiki/Переписка_с_В._Г._Белинским_(Гоголь)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: 'Wikisource page identifies date, sender, recipient, and cited collected edition' },
      { sourceId: 'OBJ-WS-GOGOL-BEL-1847-AUG', titleKo: '고골이 벨린스키에게 보낸 1847년 8월 서신', titleRu: 'Гоголь — Белинскому, 29 июля (10 августа) 1847', publication: 'Викитека correspondence transcription', date: '1847-08-10', locator: 'letter section; lines 330–345', url: 'https://ru.wikisource.org/wiki/Переписка_с_В._Г._Белинским_(Гоголь)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: 'Wikisource page identifies the date, sender, recipient, and place' },
    ],
    excerpts: [
      ['X1','OBJ-WS-BELINSKY-1847','line 233','нельзя перенести оскорбленного чувства истины, человеческого достоинства; нельзя умолчать, когда под покровом религии и защитою кнута проповедуют ложь и безнравственность как истину и добродетель.','진실과 인간의 존엄이 모욕당한 것은 견딜 수 없습니다. 종교의 덮개와 채찍의 보호 아래 거짓과 부도덕을 진실과 덕으로 설교할 때 침묵할 수 없습니다.','벨린스키가 논쟁의 핵심을 인간 존엄과 공적 발언의 문제로 규정하는 대목'],
      ['X2','OBJ-WS-BELINSKY-1847','line 234','я любил вас со всею страстью, с какою человек, кровно связанный со своею страною, может любить ее надежду, честь, славу','나는 조국과 혈연처럼 묶인 사람이 그 희망·명예·영광을 사랑하는 모든 열정으로 당신을 사랑했습니다.','비판과 개인적 관계가 함께 놓이는 대목'],
      ['X3','OBJ-WS-GOGOL-BEL-1847-AUG','line 336','Письмо ваше я прочел почти бесчувственно, но тем не менее был не в силах отвечать на него.','당신의 편지를 거의 감정 없이 읽었지만, 그럼에도 답할 힘이 없었습니다.','고골의 응답 지연과 정서적 상태에 대한 자기 진술'],
      ['X4','OBJ-WS-GOGOL-BEL-1847-AUG','line 337','пока мне показалось только то непреложной истиной, что я не знаю вовсе России','지금 내가 확실한 진실이라고 느낀 것은, 내가 러시아를 전혀 모른다는 사실뿐입니다.','고골이 자신의 지식 한계를 인정하는 대목'],
      ['X5','OBJ-WS-GOGOL-BEL-1847-AUG','line 338','мне нужно почти сызнова узнавать все то, что ни есть в ней теперь','나는 지금 러시아에 있는 모든 것을 거의 처음부터 다시 알아가야 합니다.','서신 논쟁을 자기 수정의 과제로 돌리는 대목'],
    ],
    judgments: ['인간 존엄에 대한 벨린스키의 문장을 개인적 불화로 축소하지 않는다.','고골의 답변 지연과 자기 한계를 독립된 발언으로 기록한다.','두 편지의 주체와 수신 시점을 분리해 공개 논쟁의 경로를 남긴다.'],
    effects: [{socialReform:1},{inferredMeaningAsEvidence:-1},{pressFreedom:1}],
  },
  C18: {
    sources: [{ sourceId: 'OBJ-WS-BEL-ANNENKOV-1847', titleKo: '벨린스키가 안넨코프에게 보낸 1847년 12월 서신', titleRu: 'Письмо В. Г. Белинского П. В. Анненкову, 1–10 декабря 1847', publication: 'Викитека transcription; Белинский, Полное собрание сочинений, т. XII', date: '1847-12', locator: 'letter sections; lines 103–148', url: 'https://ru.wikisource.org/wiki/Письмо_В._Г._Белинского_П._В._Анненкову_(Шевченко)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: 'Wikisource page identifies the 1–10 December 1847 date, Petersburg, addressee, and 1956 collected edition' }],
    excerpts: [
      ['X1','OBJ-WS-BEL-ANNENKOV-1847','line 126','Движение это отразилось, хотя и робко, и в литературе. Проскальзывают там и сям то статьи, то статейки, очень осторожные и умеренные по тону, но понятные по содержанию.','이 움직임은 비록 조심스럽게나마 문학에도 나타났습니다. 곳곳에서 매우 신중하고 온건하지만 내용은 분명한 글들이 보입니다.','정치적 움직임이 문학 지면에 반영된다는 벨린스키의 관찰'],
      ['X2','OBJ-WS-BEL-ANNENKOV-1847','line 127','Обо всем этом Вам дадут понятие XI и особенно XII NoNo «Современника» (смесь).','이 모든 일은 《현대인》 제11호, 특히 제12호의 혼합 지면을 보면 알 수 있을 것입니다.','정기간행물 지면을 동시기 논쟁의 자료로 지목하는 대목'],
      ['X3','OBJ-WS-BEL-ANNENKOV-1847','line 129','находя исполнение этого предписания противным своей совести, я скорее готов выйти в отставку','그 지시를 따르는 일이 양심에 어긋난다고 여겨 차라리 사임할 준비가 된 사람도 있습니다.','슬라브파 감시와 공직자의 양심을 연결하는 보고 대목'],
      ['X4','OBJ-WS-BEL-ANNENKOV-1847','line 147','Возникло прение — печатать или нет этот документ. Большинством голосов решено — печатать. Славянофилы в отчаянии.','그 문서를 인쇄할지 말지를 두고 논쟁이 생겼고, 다수결로 인쇄하기로 했습니다. 슬라브파 사람들은 절망했습니다.','공개 인쇄 결정과 슬라브파의 반응을 함께 기록하는 대목'],
      ['X5','OBJ-WS-BEL-ANNENKOV-1847','line 148','Это что-то до того превосходное, что боюсь и говорить','너무나 뛰어나서 말하기조차 두려울 정도입니다.','동시기 문학 평가의 사적 어조를 보여 주는 대목'],
    ],
    judgments: ['문학 지면의 조심스러운 표현을 정치적 사실과 같은 증거로 합치지 않는다.','《현대인》의 호수와 지면을 특정해 슬라브파의 반응을 확인한다.','인쇄 여부의 논쟁과 사적 평가를 서로 다른 발언 장르로 남긴다.'],
    effects: [{pressFreedom:1},{literaturePublicRole:1},{inferredMeaningAsEvidence:-1}],
  },
};
// Strict V27 eligibility repairs: each normal-run packet must have two
// substantive contemporaneous witnesses and direct excerpts from both.
Object.assign(supplemental, {
  C01: {
    sources: [
      { sourceId: 'OBJ-CHAADAEV-DOSSIER-1836', titleKo: '차다예프의 《철학적 편지》 게재와 《망원경》 금지 사건 기록', titleRu: 'Дело о запрещении журнала Телескоп за напечатание Философических писем Чаадаева', publication: '공개된 모스크바 기록철 66개 문서 중 발췌', date: '1836–1837', locator: 'published dossier documents 1–8', url: 'https://yakovkrotov.com/libr_min/1801/2/1836teleskop.htm', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '디지털 학술 공개본이 CIAM Ф.16 Оп.31 Д.977을 식별하고 관련 행정 문서를 전사함' },
      { sourceId: 'OBJ-TELESKOP-1836', titleKo: '《망원경》 제15호에 실린 차다예프의 첫 철학적 편지', titleRu: 'Философические письма к г-же… Письмо первое', publication: 'Телескоп, № 15, 1836; Cornell Russian text transcription', date: '1836', locator: 'Письмо первое; Cornell transcription of the 1836 printed text', url: 'https://russian.cornell.edu/russian.web/courses/309/Chaadaev_Fil_Pisma_PismoPervoe.html', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '1836년 《텔레스코프》 제15호의 첫 편지 본문을 확인할 수 있는 공개 전사본과 발행 정보를 함께 고정함' },
    ],
    excerpts: [
      ['X1','OBJ-CHAADAEV-DOSSIER-1836','document 2; 23 October 1836','ГОСУДАРЮ ИМПЕРАТОРУ угодно, чтобы журнал сей запретить и вызвать сюда к ответу издателя оного Надеждина и Ценсора Болдырева.','황제 폐하께서는 이 잡지를 금지하고 발행인 나데즈딘과 검열관 볼디레프를 불러 책임을 묻도록 하셨습니다.','잡지 금지와 관계자 소환을 기록한 행정 보고'],
      ['X2','OBJ-CHAADAEV-DOSSIER-1836','document 3; 27 October 1836','ГОСУДАРЬ ИМПЕРАТОР ВЫСОЧАЙШЕ повелеть соизволил взять у сочинителя известной Вашему Сиятельству статьи № 15 журнала Телескопа: Философические письма, Г. Чеодаева, все его бумаги без исключения.','황제 폐하께서는 《망원경》 제15호의 해당 글을 쓴 차다예프에게서 서류를 예외 없이 모두 거두라고 명하셨습니다.','저자 서류 압수 명령을 기록한 후속 문서'],
      ['X3','OBJ-TELESKOP-1836','Письмо первое; Cornell transcription','Одна из наиболее печальных черт нашей своеобразной цивилизации заключается в том, что мы еще только открываем истины, давно уже ставшие избитыми в других местах','우리 문명의 가장 슬픈 특징 가운데 하나는 다른 곳에서는 오래전에 상식이 된 진리를 우리가 이제야 발견한다는 데 있습니다.','첫 편지의 러시아 문명 진단'],
      ['X4','OBJ-TELESKOP-1836','Письмо первое; Cornell transcription','мы никогда не шли об руку с прочими народами; мы не принадлежим ни к одному из великих семейств человеческого рода','우리는 다른 민족들과 함께 걸어온 적이 없고, 인류의 위대한 가족 어느 쪽에도 속하지 않습니다.','러시아의 역사적 고립을 서술하는 대목'],
      ['X5','OBJ-CHAADAEV-DOSSIER-1836','document 7; 30 October 1836','Поводом к напечатанию Статьи философические письма в Телескопе было суждение многих лиц, которые ставят себя в просвещении на ряду с Европою.','《망원경》에 이 글을 실은 까닭은 스스로 유럽과 나란히 계몽되었다고 여기는 여러 사람의 판단 때문이었다고 합니다.','발행인이 밝힌 게재 동기를 전하는 수사 보고'],
    ],
    judgments: ['잡지 금지와 편지의 문명 비판을 각각 행정 조치와 공개 텍스트로 기록한다.','차다예프의 자기 진단을 보고서가 전하는 여론과 동일한 목소리로 합치지 않는다.','원문이 말한 역사적 고립과 후속 압수 명령의 시점을 분리해 보관한다.'],
    effects: [{pressFreedom:1},{westernism:1},{stateAuthority:1}],
  },
  C03: {
    sources: [
      { sourceId: 'OBJ-PUSHKIN-DEATH-WIKISOURCE-1837', titleKo: '《푸시킨의 죽음에 관하여》 1837년 동시기 부고 인용', titleRu: 'О смерти Пушкина', publication: 'Викитека transcription; Русский инвалид 및 정기간행물 부고', date: '1837-01-30 to 1837-01-31', locator: 'page lines 95–104; cited 30–31 January 1837 notices', url: 'https://ru.wikisource.org/wiki/О_смерти_Пушкина_(Пушкин)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '동시기 부고가 인용한 발행 날짜와 정기간행물 표기를 본문에서 대조함' },
      { sourceId: 'OBJ-PUSHKIN-DOCUMENTS-1837', titleKo: '푸시킨 사망 관련 행정 문서', titleRu: 'Документы к биографии Пушкина: март 1837', publication: 'Pushkin House digital PDF / archival document transcription', date: '1837-03', locator: '24 марта 1837; письмо о посмертном расследовании', url: 'https://pushkinskijdom.ru/wp-content/uploads/2018/02/Pushkin.-Dokumenty-k-biografii-1.pdf', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '푸시킨 하우스 공개 PDF의 1837년 3월 행정 서신과 문서 위치를 고정함' },
    ],
    excerpts: [
      ['X1','OBJ-PUSHKIN-DEATH-WIKISOURCE-1837','line 95','Пушкин скончался, скончался во цвете лет, в средине своего великого поприща!','푸시킨은 생의 한창때, 위대한 여정의 한가운데서 세상을 떠났습니다!','동시기 부고의 사망 서술'],
      ['X2','OBJ-PUSHKIN-DEATH-WIKISOURCE-1837','line 98','Россия обязана Пушкину благодарностью за 22-летние заслуги его на поприще словесности','러시아는 문학의 길에서 22년 동안 공헌한 푸시킨에게 감사해야 합니다.','《러시아 장애인》 문학 부록의 평가'],
      ['X3','OBJ-PUSHKIN-DOCUMENTS-1837','24 марта 1837; письмо о посмертном расследовании','Мы начали с лиц, которые были в особенной связи с Пушкиным и особенно известны правительству','우리는 푸시킨과 특별히 가까웠고 정부에도 잘 알려진 사람들부터 조사하기 시작했습니다.','사망 뒤 조사 대상을 정한 순서'],
      ['X4','OBJ-PUSHKIN-DOCUMENTS-1837','24 марта 1837; письмо о посмертном расследовании','в письмах не нашлось ничего такого, что могло бы потребовать дальнейшего исследования.','그 편지들에서는 더 조사해야 할 만한 내용이 나오지 않았습니다.','서신 조사 결과를 정리하는 행정 문장'],
      ['X5','OBJ-PUSHKIN-DOCUMENTS-1837','24 марта 1837; письмо о посмертном расследовании','Такого рода инквизиция производит только обоюдное раздражение, весьма неравственным образом действует на общество','그런 식의 종교재판 같은 조사는 서로의 반감만 키우고 사회에도 몹시 해롭게 작용합니다.','과도한 조사에 대한 비판'],
    ],
    judgments: ['사망 사실과 동시기 애도 표현을 서로 다른 발행 기록으로 구분한다.','부고의 문학적 평가와 행정 조사 서신의 절차 언어를 하나의 여론으로 합치지 않는다.','조사 대상의 선정과 조사 결과에 대한 비판을 별도 문서로 남긴다.'],
    effects: [{pressFreedom:1},{literaturePublicRole:1},{stateAuthority:1}],
  },
  C06: {
    sources: [
      { sourceId: 'V25-LERMONTOV-DUEL', titleRu: 'Дело о произшедшем поединке...', titleKo: '마르티노프와 레르몬토프의 결투 사건', publication: 'Пятигорское окружное управление', date: '1841-07-16 to 1841-07-30', locator: 'дело о поединке; documents 1, 2, 5, 7, 9', url: 'https://lermontov.info/duel/delo2.shtml', sourceType: 'ADMINISTRATIVE_PRIMARY', rights: 'public-domain transcription; attribution retained', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD' },
      { sourceId: 'V25-LERMONTOV-QUESTIONS', titleRu: 'Вопросные пункты... Мартынову', titleKo: '마르티노프에게 보낸 심문 문항과 답변', publication: 'Пятигорский окружной суд', date: '1841-09-13', locator: 'вопросные пункты; ответы 8–11', url: 'https://lermontov.info/duel/voprosi.shtml', sourceType: 'JUDICIAL_PRIMARY', rights: 'public-domain transcription; attribution retained', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD' },
      { sourceId: 'V25-LERMONTOV-COURT', titleRu: 'Дело штаба отдельного Кавказского корпуса', titleKo: '코카서스 군단 본부 군사재판 기록', publication: 'Штаб отдельного Кавказского корпуса', date: '1841-08-19 to 1842-02-06', locator: 'военное судное отделение; documents 1, 4, 14', url: 'https://lermontov.info/duel/delo3.shtml', sourceType: 'MILITARY_PRIMARY', rights: 'public-domain transcription; attribution retained', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD' },
    ],
    excerpts: [
      ['X1','V25-LERMONTOV-DUEL','№1351, 16 июля 1841','отставной Маиор Мартынов, убил на дуеле Тенгинского пехотного полка Поручика Лермантова','퇴역 소령 마르티노프가 텡긴 보병연대 레르몬토프 중위를 결투에서 살해했습니다.','사건을 처음 알린 행정 보고'],
      ['X2','V25-LERMONTOV-QUESTIONS','ответ Мартынова, пункт 8','поединок этот был совершенно случайный, злобы к нему я никогда не питал','이 결투는 전적으로 우발적이었고 나는 그에게 악의를 품은 적이 없습니다.','피심문자의 자기 설명'],
      ['X3','V25-LERMONTOV-COURT','документ 1; рапорт 16 июля 1841','По сему произшествию производится законное следствие, а Маиор Мартынов, Корнет Глебов и Князь Васильчиков арестованы','이 사건에 대해 정식 수사가 진행되며 마르티노프 소령, 글레보프 코넷, 바실치코프 공의원이 체포되었습니다.','군사재판 기록이 수사와 구금 절차를 명시하는 대목'],
      ['X4','V25-LERMONTOV-COURT','документ 4; 4 августа 1841','предать военному суду не арестованными, с тем, чтобы судное дело было окончено немедленно','구금하지 않은 채 군사재판에 넘기고 재판 사건을 즉시 마치도록 하라.','황제 명령에 따른 군사재판 회부와 처리 기한'],
      ['X5','V25-LERMONTOV-COURT','документ 14; мнение 23 ноября 1841','Военно-судное дело, произведенное в комиссии учрежденной в Г. Пятигорске','군사재판 사건은 퍄티고르스크에 설치된 위원회에서 진행되었습니다.','재판위원회의 관할과 절차를 적은 기록'],
    ],
    judgments: ['사망 보고와 마르티노프의 자기 설명을 각각 사실 기록과 당사자 주장으로 남긴다.','군사재판 기록의 수사·구금 절차를 목격자의 인상과 섞지 않는다.','황제의 회부 명령과 실제 위원회 절차를 시간순으로 분리한다.'],
    effects: [{inferredMeaningAsEvidence:-1},{stateAuthority:1},{legalism:1}],
  },
  C05: {
    sources: [
      { sourceId: 'OBJ-WS-LERMONTOV-1840', titleKo: '《우리 시대의 영웅》 1840년 초판', titleRu: 'Герой нашего времени', publication: 'Герой нашего времени, первое отдельное издание, 1840', date: '1840', locator: '1840 first edition; pages 11–20 and postscript', url: 'https://ru.wikisource.org/wiki/Герой_нашего_времени_(Лермонтов)/1840_(ДО)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '1840년 초판의 작품 본문과 서술 범위를 확인함' },
      { sourceId: 'OBJ-WS-BELINSKY-LERMONTOV-1840', titleKo: '벨린스키의 《우리 시대의 영웅》 1840년 평론', titleRu: 'Герой нашего времени. Сочинение М. Лермонтова', publication: 'Отечественные записки, 1840, т. X, № 5; Wikisource transcription', date: '1840-05-15', locator: 'Отечественные записки 1840, т. X, № 5, bibliographic chronicle', url: 'https://ru.wikisource.org/wiki/Герой_нашего_времени._Сочинение_М._Лермонтова_(Белинский)/ОЗ_1840', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '페이지에 1840년 5월 15일 발행 호수와 원문 위치가 명시된 동시기 평론을 확인함' },
    ],
    excerpts: [
      ['X1','OBJ-WS-LERMONTOV-1840','page 11; Бэла','Я ѣхалъ на перекладныхъ изъ Тифлиса.','나는 티플리스에서 역마차를 타고 왔습니다.','작품 서술자가 캅카스로 들어오는 첫 문장'],
      ['X2','OBJ-WS-LERMONTOV-1840','page 28; Максим Максимыч о Печорине','Славный былъ малый, смѣю васъ увѣрить; только немножко страненъ.','좋은 사람이었다고 장담할 수 있습니다. 다만 조금 별났지요.','막심 막시므이치가 페초린을 회고하는 대목'],
      ['X3','OBJ-WS-LERMONTOV-1840','postscript; scope of the book','Я помѣстилъ въ этой книгѣ только то, что относилось къ пребыванію Печорина на Кавказѣ.','나는 이 책에 페초린의 캅카스 체류에 관한 내용만 실었습니다.','작품에 포함한 기록의 범위를 밝히는 문장'],
      ['X4','OBJ-WS-BELINSKY-LERMONTOV-1840','line 107; 1840 review','«Герой нашего времени» принадлежит къ тѣмъ явленіямъ истиннаго искусства, которыя, занимая и услаждая вниманіе публики, какъ литературная новость, обращаются въ прочный литературный капиталъ','《우리 시대의 영웅》은 문학적 신작으로 대중의 관심을 끌고 즐겁게 하면서도 오래 남는 문학적 자산이 되는 진정한 예술의 현상에 속합니다.','벨린스키가 작품의 유행성과 지속성을 구분하는 평론'],
      ['X5','OBJ-WS-BELINSKY-LERMONTOV-1840','line 112; 1840 review','Въ основной идеѣ романа г. Лермонтова лежитъ важный современный вопросъ о внутреннемъ человѣкѣ','레르몬토프 소설의 핵심에는 내면적 인간에 관한 중요한 현대의 질문이 놓여 있습니다.','작품의 문학적 질문을 동시대의 인간 문제로 읽는 평론'],
    ],
    judgments: ['작품 속 여행과 인물 회고를 실제 군사·지리 보고서로 바꾸지 않는다.','페초린의 이상함을 화자의 증언으로 남기고 작가의 의도라고 단정하지 않는다.','벨린스키의 동시기 평론이 말한 문학적 질문과 작품 서술을 서로 다른 목소리로 보관한다.'],
    effects: [{literaturePublicRole:1},{inferredMeaningAsEvidence:-1},{westernism:1}],
  },
  C18: {
    sources: [
      { sourceId: 'OBJ-WS-BEL-ANNENKOV-1847', titleKo: '벨린스키가 안넨코프에게 보낸 1847년 12월 서신', titleRu: 'Письмо В. Г. Белинского П. В. Анненкову, 1–10 декабря 1847', publication: 'Белинский, Полное собрание сочинений, т. XII; Wikisource transcription', date: '1847-12', locator: 'letter sections; lines 126–148', url: 'https://ru.wikisource.org/wiki/Письмо_В._Г._Белинского_П._В._Анненкову_(Шевченко)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '1847년 12월 서신의 날짜·수신인·《Современник》 호수와 인쇄 논쟁을 본문에서 확인함' },
      { sourceId: 'OBJ-WS-SOVREMENNIK-1847-ANNOUNCEMENT', titleKo: '1847년 《현대인》 개편·발행 공고', titleRu: 'Об издании «Современника» в 1847 году', publication: 'Современник subscription announcement, 1846/1847; Wikisource transcription', date: '1846-12 to 1847', locator: 'lines 116–123, 216–221; 1847 editorial program', url: 'https://ru.wikisource.org/wiki/Об_издании_«Современника»_в_1847_году_(Некрасов)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '1847 발행 공고가 편집자·참여자·공개 편집 방침을 직접 명시함' },
    ],
    excerpts: [
      ['X1','OBJ-WS-BEL-ANNENKOV-1847','line 126','Движение это отразилось, хотя и робко, и в литературе. Проскальзывают там и сям то статьи, то статейки, очень осторожные и умеренные по тону, но понятные по содержанию.','이 움직임은 비록 조심스럽게나마 문학에도 나타났습니다. 곳곳에서 매우 신중하지만 내용은 분명한 글들이 보입니다.','정치적 움직임이 문학 지면에 반영된다는 관찰'],
      ['X2','OBJ-WS-BEL-ANNENKOV-1847','line 147','Возникло прение — печатать или нет этот документ. Большинством голосов решено — печатать. Славянофилы в отчаянии.','그 문서를 인쇄할지 말지를 두고 논쟁이 생겼고, 다수결로 인쇄하기로 했습니다. 슬라브파 사람들은 절망했습니다.','인쇄 결정과 슬라브파 반응을 함께 적은 서신'],
      ['X3','OBJ-WS-SOVREMENNIK-1847-ANNOUNCEMENT','line 116','Издание же сего журнала, по взаимному согласию и условию с прежним издателем и редактором, приняли на себя И. И. Панаев и Н. А. Некрасов.','이 잡지의 발행은 이전 발행인·편집자와의 합의에 따라 파나예프와 네크라소프가 맡았습니다.','새 편집·발행 주체를 밝히는 공고'],
      ['X4','OBJ-WS-SOVREMENNIK-1847-ANNOUNCEMENT','line 121','В «Современнике» с 1847 года будут участвовать следующие ученые и литераторы: Белинский В. Г.','1847년부터 《현대인》에는 다음 학자와 문필가들이 참여할 예정이며, 그 가운데 벨린스키도 있습니다.','공개된 참여자 명단에 벨린스키를 포함한 문장'],
      ['X5','OBJ-WS-SOVREMENNIK-1847-ANNOUNCEMENT','line 221','Мелкая, личная и никаких ученых или литературных вопросов не решающая полемика вовсе не будет иметь места в «Современнике».','사소하고 개인적이며 학문·문학적 문제를 해결하지 못하는 논쟁은 《현대인》에 싣지 않겠습니다.','편집부가 배제하겠다고 밝힌 논쟁의 기준'],
    ],
    judgments: ['문학 지면에 나타난 조심스러운 움직임과 인쇄 결정의 주체를 분리한다.','《현대인》의 편집 공고와 벨린스키의 사적 서신을 같은 종류의 발언으로 합치지 않는다.','개인적 싸움과 문학적 쟁점을 구분하겠다는 편집 원칙을 후속 판단의 기준으로 남긴다.'],
    effects: [{socialReform:1},{slavophileAffinity:1},{pressFreedom:1}],
  },
  C21: {
    sources: [
      { sourceId: 'OBJ-WS-SOVREMENNIK-1848', titleKo: '1849년 《현대인》 발행에 관한 1848년 편집부 공고', titleRu: 'Об издании «Современника» в 1849 году', publication: 'Современник editorial notice, 1848', date: '1848', locator: 'lines 114–117, 229–243; 1848 editorial notice', url: 'https://ru.wikisource.org/wiki/Об_издании_«Современника»_в_1849_году_(Некрасов)', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '1848년 활동 보고와 배송·발행 계획을 공고 본문에서 확인함' },
      { sourceId: 'OBJ-WS-ILLUSTRATED-ALMANAC-1848', titleKo: '《현대인》 편집부의 《삽화 연감》 공고', titleRu: 'От редакции; Иллюстрированный альманах', publication: 'Современник, 1848, № 2; editorial notice', date: '1848', locator: 'notice lines 122, 153–178', url: 'https://ru.wikisource.org/wiki/От_редакции_(Некрасов)/Версия_3', authorOrSender: 'Редакция «Современника»; Н. А. Некрасов и И. И. Панаев', materialStatus: 'MODERN_TRANSCRIPTION', sceneRole: 'IN_WORLD', acquisitionBasis: '1848년 공고가 삽화 연감의 제목·제작자·배포 방식을 직접 열거함' },
    ],
    excerpts: [
      ['X1','OBJ-WS-SOVREMENNIK-1848','line 114; 1848 editorial notice','По примеру прошлого года мы считаем нелишним начать наше объявление обозрением деятельности редакции «Современника» в истекающем году.','지난해에 이어 이번 공고도 올해 《현대인》 편집부의 활동을 돌아보는 일로 시작하겠습니다.','편집부가 전년도 활동을 회고하는 서두'],
      ['X2','OBJ-WS-SOVREMENNIK-1848','line 117; 1848 editorial notice','все замечательнейшие таланты, действующие у нас в настоящее время на литературном поприще, принимали участие в «Современнике» 1848 года','당시 문단에서 활동하던 뛰어난 재능의 작가들이 모두 1848년 《현대인》에 참여했습니다.','1848년 참여 필자층에 대한 편집부의 자기 기술'],
      ['X3','OBJ-WS-SOVREMENNIK-1848','line 229; 1848 editorial notice','Стараясь всеми силами об учреждении наибольшего порядка в доставке журнала, мы считаем необходимым отменить на будущий год рассылку переплетенных экземпляров','잡지 배송을 최대한 질서 있게 만들기 위해 내년부터 제본본 발송을 폐지할 필요가 있다고 생각합니다.','배송 운영을 바꾸는 편집 공고'],
      ['X4','OBJ-WS-ILLUSTRATED-ALMANAC-1848','notice lines 153–167','Карикатуры, рисованные Н. А. Степановым: «Мазурка». «Дровяной двор». «Поэт». «Журналист и сотрудник». «Петербургский Том-Пус». «Огорченный литератор».','N. A. 스테파노프가 그린 풍자화에는 《마주르카》, 《장작 마당》, 《시인》, 《기자와 동료》, 《페테르부르크의 톰 푸스》, 《낙담한 문필가》 등이 있습니다.','연감 공고가 풍자화의 제목과 작가를 명시하는 대목'],
      ['X5','OBJ-WS-ILLUSTRATED-ALMANAC-1848','notice line 174','Кроме того, все повести и рассказы, которые войдут в состав «Альманаха», будут иллюстрированы.','또한 연감에 들어갈 모든 소설과 이야기는 삽화로 꾸밀 예정입니다.','문학 텍스트와 삽화 제작을 연결하는 편집 공고'],
    ],
    judgments: ['1848년 활동 회고는 편집부의 자기 기술로 기록하고 검열 제도의 전체 역사로 확대하지 않는다.','배송 방식과 삽화 연감의 제작 계획을 각각 운영 기록과 편집 방향으로 구분한다.','후대 회고 없이 1848년 공고에서 확인되는 위험과 공개 범위만 판단 근거로 삼는다.'],
    effects: [{pressFreedom:1},{literaturePublicRole:1},{riskTolerance:1}],
  },
});
const playable = new Set(['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C14', 'C17', 'C19', 'C21', 'C24']);
const signalIssue = {
  legalism: 'stateAuthority',
  state_loyalty: 'stateAuthority',
  press_freedom: 'pressFreedom',
  westernism: 'westernism',
  slavophile_affinity: 'slavophileAffinity',
  social_reform: 'socialReform',
  risk_tolerance: 'riskTolerance',
};

const fromPilot = new Map(pilot.map((c) => [c.caseId, c]));
const oldExcerptUse = new Map();
for (const c of prior.cases) for (const x of c.excerpts ?? []) oldExcerptUse.set(x.ru, [...(oldExcerptUse.get(x.ru) ?? []), c.caseId]);
const cases = prior.cases.map((old) => {
  const p = fromPilot.get(old.caseId);
  const c = p ? structuredClone(p) : structuredClone(old);
  if (supplemental[old.caseId]) {
    const s = supplemental[old.caseId];
    c.sources = structuredClone(s.sources);
    c.excerpts = s.excerpts.map(([id, sourceId, locator, ru, ko, context]) => ({ excerptId: `V27-${old.caseId}-${id}`, sourceId, locator, ru, ko, context, evidence: 'DIRECT', quotationStatus: 'VERBATIM', translationReview: 'REVIEWED' }));
    c.judgments = s.judgments.map((text, i) => ({ id: `V27-${old.caseId}-J${i + 1}`, text, evidenceExcerptIds: c.excerpts.slice(i, i + 2).map((e) => e.excerptId), effect: { issue: s.effects[i] }, routeSignal: null, justification: '동시기 서신의 발언 주체·장르·시점을 분리해 읽는 판단' }));
    c.followups = c.judgments.map((j) => `선택한 판단에 대응하는 ${j.evidenceExcerptIds.length}개 서신 대조표가 열렸습니다.`);
  }
  c.caseId = old.caseId;
  c.casePackId = old.casePackId;
  c.sceneId = `V27-${old.caseId}`;
  c.historicalAudit = { checkedAt: '2026-10-02', sourceFirst: true, normalRun: playable.has(old.caseId) };
  c.sources = (c.sources ?? []).map((s) => {
    const source = { ...s };
    if (p) {
      const type = source.sourceType;
      const [materialStatus, sceneRole] = sourceTypes[type] ?? ['MODERN_TRANSCRIPTION', 'IN_WORLD'];
      source.materialStatus = materialStatus;
      source.sceneRole = sceneRole;
      source.acquisitionBasis = '공개된 1차 자료의 현대 전사; 원문 위치와 발행일을 보존함';
    }
    if (source.sourceId === 'OBJ-PETRASHEVSKY-1849' && old.caseId === 'C23' && !supplemental[old.caseId]) {
      source.materialStatus = 'MODERN_ARCHIVE_COMMENTARY';
      source.sceneRole = 'LATER_CONTEXT';
      source.acquisitionBasis = '현대 GARF 설명 페이지는 기록철의 존재만 확인하며 당시 문서의 직접 인용으로 사용하지 않음';
    }
    if (old.caseId === 'C01' && source.sourceId === 'OBJ-TELESKOP-1836') {
      source.sceneRole = 'IN_WORLD';
      source.materialStatus = 'MODERN_TRANSCRIPTION';
      source.sourceRole = 'PRIMARY_IN_WORLD';
      source.availableToPlayerDate = source.date;
      source.arrivalBasis = '1836년 제15호에 실린 공개 텍스트의 발행 기록';
    }
    if (old.caseId === 'C03' && source.sourceId === 'OBJ-PUSHKIN-DEATH-WIKISOURCE-1837') {
      source.sceneRole = 'IN_WORLD';
      source.materialStatus = 'MODERN_TRANSCRIPTION';
      source.sourceRole = 'PRIMARY_IN_WORLD';
      source.availableToPlayerDate = source.date;
      source.arrivalBasis = '1837년 1월 동시기 부고·정기간행물 공지의 공개 발행 기록';
    }
    const sceneYear = endYear(c.date);
    if (source.sceneRole === 'IN_WORLD' && Number.isFinite(sceneYear) && Number.isFinite(year(source.date)) && year(source.date) > sceneYear) {
      source.sceneRole = 'LATER_CONTEXT';
      source.materialStatus = source.materialStatus || 'MODERN_TRANSCRIPTION';
      source.acquisitionBasis = `${source.acquisitionBasis ?? '자료 분류'}; 장면 이후 공개된 자료라 후대 맥락으로만 보존`;
    }
    source.sourceType ??= inferSourceType(source);
    source.authorOrSender ??= inferPerson(source);
    source.recipient ??= null;
    source.issue ??= null;
    source.page ??= null;
    source.archiveDocumentNo ??= null;
    source.scanUrl ??= null;
    source.rights ??= source.url?.includes('wikisource.org') ? 'PUBLIC_DOMAIN_TRANSCRIPTION_CC_BY_SA' : 'RIGHTS_UNVERIFIED';
    source.sourceCreationDate ??= dateRecordFor(source.date);
    source.sourceRole ??= sourceRoleFor(source.sceneRole);
    source.displayCapability ??= displayCapabilityFor(source.materialStatus);
    source.availableToPlayerDate ??= source.sceneRole === 'IN_WORLD' ? source.date : null;
    source.arrivalBasis ??= source.sceneRole === 'IN_WORLD'
      ? (source.publication ? 'PUBLICATION_RECORD_AND_CHECKED_IN_LOCATOR' : 'ARRIVAL_BASIS_UNVERIFIED')
      : 'NOT_IN_WORLD';
    return source;
  });
  const sceneYear = endYear(c.date);
  const invalid = c.sources.filter((s) => !s.materialStatus || !s.sceneRole || (s.sceneRole === 'IN_WORLD' && year(s.date) > sceneYear));
  const modernC23 = old.caseId === 'C23' && !supplemental[old.caseId];
  c.excerpts = (c.excerpts ?? []).map((x) => {
    const source = c.sources.find((s) => s.sourceId === x.sourceId);
    const excerpt = { ...x };
    if (source?.sceneRole === 'LATER_CONTEXT') {
      excerpt.evidence = 'LATER_CONTEXT';
      excerpt.quotationStatus = 'CONTEXT_ONLY';
      excerpt.context = `${excerpt.context ?? ''} 장면 당시의 직접 증거가 아니라 후대 맥락으로만 열람한다.`.trim();
    }
    if (modernC23) excerpt.evidence = 'LATER_CONTEXT';
    return excerpt;
  });
  c.judgments = (c.judgments ?? []).map((j) => {
    const signal = j.routeSignal ?? null;
    const key = signalIssue[signal];
    const effect = { ...(j.effect ?? {}), issue: { ...((j.effect ?? {}).issue ?? {}) } };
    if (key && !Object.keys(effect.issue).length) effect.issue[key] = 1;
    if (!Object.keys(effect.issue).length) effect.issue.inferredMeaningAsEvidence = -1;
    const evidence = (j.evidenceExcerptIds ?? []).map((id) => c.excerpts.find((x) => x.excerptId === id)).filter(Boolean);
    const laterOnly = evidence.length > 0 && evidence.every((x) => x.evidence === 'LATER_CONTEXT');
    if (c.caseId === 'C17' && j.id.endsWith('J2')) effect.issue.riskTolerance = 1;
    if (c.caseId === 'C21' && j.id.endsWith('J3')) effect.issue.riskTolerance = 1;
    // Keep all five ending families causally reachable in the verified
    // normal journey without making a procedure-only choice sufficient.
    if (c.caseId === 'C24' && j.id.endsWith('J2')) effect.issue.riskTolerance = 1;
    if (c.caseId === 'C07' && j.id.endsWith('J1')) effect.issue.slavophileAffinity = 1;
    const semantic = (!j.justification || /동시기 서신의 발언 주체|이 판단은 \d+개 발췌/.test(j.justification))
      ? semanticJustification({ ...j, effect }, evidence)
      : j.justification;
    const followupText = c.followups?.[c.judgments.indexOf(j)] ?? `이 판단에 연결된 ${evidence.length}개 발췌를 다시 대조한다.`;
    return {
      ...j,
      effect,
      issueEffect: effect.issue,
      routeSignal: signal,
      historicalQuestion: j.historicalQuestion ?? c.question,
      visibleText: j.visibleText ?? j.text,
      justification: semantic,
      effectJustification: semantic,
      visibility: j.visibility ?? 'PRIVATE_JUDGMENT',
      immediateConsequence: j.immediateConsequence ?? `쟁점 상태에 ${Object.keys(effect.issue).join(', ')} 기록이 누적된다.`,
      laterConsequence: j.laterConsequence ?? followupText,
      alternateFollowUpIds: j.alternateFollowUpIds ?? c.judgments.map((_, i) => `${c.caseId}-FOLLOWUP-${i + 1}`),
      routeBasis: key ? `이 판단이 실제로 누적하는 쟁점: ${key}` : '중립적 기록 절차; 결말 성향 점수 없음',
      playable: !laterOnly,
      laterOnly,
    };
  });
  const substantive = c.sources.some((s) => s.sceneRole === 'IN_WORLD' && s.materialStatus !== 'MODERN_ARCHIVE_COMMENTARY');
  const inWorldSources = c.sources.filter((s) => s.sceneRole === 'IN_WORLD' && s.materialStatus !== 'MODERN_ARCHIVE_COMMENTARY');
  const direct = c.excerpts.filter((e) => e.evidence === 'DIRECT');
  const sourceDiversityReady = inWorldSources.length >= 2 && direct.length >= 5 && inWorldSources.every((s) => c.excerpts.some((e) => e.sourceId === s.sourceId && e.evidence === 'DIRECT'));
  const historicallyVerified = Boolean(supplemental[old.caseId]) && substantive && sourceDiversityReady && !invalid.length && !modernC23;
  const status = playable.has(old.caseId) && substantive && sourceDiversityReady && !invalid.length && !modernC23 ? 'READY_V27' : historicallyVerified ? 'VERIFIED_V27_NOT_IN_NORMAL_RUN' : 'BLOCKED_HISTORICAL_AUDIT';
  c.sourceStatus = status;
  c.availableInNormalRun = status === 'READY_V27';
  const repeatedPacket = old.caseId !== 'C14' && (c.excerpts ?? []).filter((x) => (oldExcerptUse.get(x.ru) ?? []).length > 1).length >= 3;
  c.blockReason = ['READY_V27', 'VERIFIED_V27_NOT_IN_NORMAL_RUN'].includes(status) ? (status === 'VERIFIED_V27_NOT_IN_NORMAL_RUN' ? '역사 자료 검증 완료; 정상 여정은 12개 사건으로 제한' : null) : modernC23 ? '현대 아카이브 해설만으로는 당시 직접 증거를 만들 수 없음' : invalid.length ? '장면 시점 이후 자료 또는 source classification 누락' : !sourceDiversityReady ? `독립 substantive in-world source 또는 직접 발췌 부족 (${inWorldSources.length}개 source, ${direct.length}개 direct excerpt)` : repeatedPacket ? '1847 벨린스키·고골 발췌 패킷이 다른 사건과 재사용됨; 사건별 원문 교체 필요' : '동시기 독립 substantive source 추가 전 정상 여정 편입 보류';
  return c;
});

const manifest = { schemaVersion: 'v27-case-bundle-1', policy: 'Only READY_V27 cases enter the normal run; blocked cases remain inspectable but cannot be forced through.', normalRunCaseIds: cases.filter((c) => c.availableInNormalRun).map((c) => c.caseId), cases };
write('data/v27-case-bundle.json', manifest);
write('data/v27-ending-rules.json', {
  schemaVersion: 'v27-ending-rules-1',
  rules: [
    { id: 'DOSTOEVSKY_PETRASHEVSKY', requires: { issue: { riskTolerance: 2, socialReform: 2 }, access: { dossierEvidence: 3 }, relation: { officialPressure: 1 }, evidenceCount: 4 } },
    { id: 'HERZEN', requires: { issue: { pressFreedom: 2, westernism: 2, riskTolerance: 1 }, access: { crossBorder: 1 }, relation: { editorContact: 1 }, evidenceCount: 3 } },
    { id: 'BELINSKY', requires: { issue: { pressFreedom: 2 }, access: { officialRecord: 1 }, relation: { editorContact: 1 }, evidenceCount: 3 } },
    { id: 'KHOMYAKOV', requires: { issue: { slavophileAffinity: 1 }, access: { officialRecord: 1 }, relation: { editorContact: 1 }, evidenceCount: 3 } },
    { id: 'UVAROV', requires: { issue: { stateAuthority: 2 }, access: { officialRecord: 2 }, relation: { officialPressure: 1 }, evidenceCount: 3 } },
  ],
  resolutionOrder: ['DOSTOEVSKY_PETRASHEVSKY', 'HERZEN', 'KHOMYAKOV', 'BELINSKY', 'UVAROV'],
});
console.log(JSON.stringify({ normalRunCaseIds: manifest.normalRunCaseIds, blocked: cases.filter((c) => !c.availableInNormalRun).map((c) => ({ caseId: c.caseId, reason: c.blockReason })), cases: cases.length }, null, 2));
