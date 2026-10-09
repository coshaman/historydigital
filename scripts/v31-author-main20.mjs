import fs from 'node:fs';

const sourceUrls = {
  'C03-S1': 'https://ru.wikisource.org/wiki/О_смерти_Пушкина_(Пушкин)',
  'C03-S2': 'https://ru.wikisource.org/wiki/О_смерти_Пушкина_(Пушкин)',
  'C06-S1': 'https://lermontov.info/duel/delo2.shtml',
  'C06-S2': 'https://lermontov.info/duel/delo2.shtml',
  'C07-S1': 'https://ru.wikisource.org/wiki/Переписка_с_П._А._Плетневым_(Гоголь)',
  'C07-S2': 'https://ru.wikisource.org/wiki/Переписка_с_П._А._Плетневым_(Гоголь)',
  'E02-S2': 'https://slova.org.ru/rostopchina/nasil-nyj-brak/',
  'E02-S3': 'https://ru.wikisource.org/wiki/Дневник._Том_1_(Никитенко)',
  'E07-S4': 'https://ru.wikisource.org/wiki/Исповедь_(Баласогло)/ДО',
  'E07-S5': 'https://feb-web.ru/feb/rosarc/rae/rae-146-.htm?cmd=p'
};
const excerpt = (excerptId, sourceId, sourceDate, locator, ru, ko, quoteClass, sourceQuality, context, availableDate = sourceDate) => ({
  excerptId, sourceId, sourceDate, availableDate, sourceUrl: sourceUrls[sourceId] || '', locator, ru, ko, quoteClass, sourceQuality, context
});

const scenes = [
  {
    id: 'C03', date: '1837-01-31', dateLabel: '1837년 1월 31일', title: '푸시킨의 죽음과 첫 부고', character: 'ekaterina', transition: '1837년 겨울 · 아직 조사 편지는 도착하지 않았다.', sourceMoment: '1837년 1월 말에 공개된 부고만 먼저 읽습니다. 3월 조사 편지는 아직 이 책상에 없습니다.',
    intro: [
      ['NARRATION', '상트페테르부르크의 아침. 잉크가 마르기도 전에 푸시킨의 이름이 인쇄소와 복도를 돌았다.'],
      ['ekaterina', '사람들이 울고 있다는 말은 벌써 퍼졌어요. 하지만 부고의 문장은 사람마다 조금씩 달라요.'],
      ['PLAYER_PROMPT', '예카테리나가 두 장의 부고를 내밉니다. 어느 문장부터 확인할지 당신이 정합니다.'],
      ['ekaterina', '오늘은 1월 말이에요. 아직 3월 조사 편지는 오지 않았습니다. 지금 아는 것만으로 결정해야 해요.'],
      ['NARRATION', '그녀는 두 신문의 날짜를 나란히 놓고, 확인되지 않은 사망 원인에 빈칸을 남겼다.']
    ],
    question: '부고의 사실과 애도의 목소리가 다를 때 무엇을 먼저 보존할까?',
    readPrompt: '부고 두 편을 읽고, 서로 다른 강조점을 직접 비교하세요.',
    excerpts: [
      excerpt('C03-R1', 'C03-S1', '1837-01-30', '《Литературные прибавления к Русскому инвалиду》, 30 января 1837', 'Солнце нашей поэзии закатилось! Пушкин скончался, скончался во цвете лет, в средине своего великого поприща!.. Более говорить о сем не имеем силы, да и не нужно; всякое Русское сердце знает всю цену этой невозвратимой потери.', '우리 시의 태양이 저물었습니다! 푸시킨은 삶의 한창때, 위대한 여정의 한가운데서 세상을 떠났습니다! 더 말할 힘도, 필요도 없습니다. 모든 러시아인의 마음이 이 돌이킬 수 없는 상실의 값을 알고 있으니까요.', 'PRIMARY_PUBLIC_NOTICE', 'VERIFIED_WITNESS', '동시기 애도 부고의 연속 문단'),
      excerpt('C03-R2', 'C03-S1', '1837-01-30', '《Северная пчела》, 30 января 1837', 'Пораженные глубочайшей горестью, мы не будем многоречивы при сем извещении. Россия обязана Пушкину благодарностью за 22-летние заслуги его на поприще словесности, ряд его блистательнейших и полезнейших успехов в сочинениях всех родов.', '깊은 슬픔에 잠긴 우리는 이 소식에 말을 많이 보태지 않겠습니다. 러시아는 문학의 길에서 22년 동안 공헌한 푸시킨에게, 모든 종류의 작품에서 거둔 빛나는 유익한 성취에 대해 감사해야 합니다.', 'PRIMARY_PUBLIC_NOTICE', 'VERIFIED_WITNESS', '동시기 공적 부고의 연속 문단')
    ],
    choices: [
      { id: 'C03-A', text: '두 부고의 날짜와 확인된 사실만 먼저 고정한다.', actor: 'alexei', action: 'fix_public_fact', flagsAdd: ['publicRecord', 'chronologyCare'], reaction: '알렉세이: 좋아. 원인은 아직 비워 두자. 빈칸을 남기는 편이 틀린 이름을 남기는 것보다 낫다.', relationship: { alexei: 1 } },
      { id: 'C03-B', text: '애도의 어조도 자료로 보존하되, 사실과 별도 표기를 한다.', actor: 'ekaterina', action: 'preserve_mourning', flagsAdd: ['privateWitness', 'literaryAttention'], reaction: '예카테리나: 이제야 읽는 사람에게 선택권을 돌려주네요. 슬픔은 사실이 아니지만, 사라져도 안 되는 증언이에요.', relationship: { ekaterina: 2 } },
      { id: 'C03-C', text: '발신 경로를 먼저 확인하고 확인 전에는 이름을 더 얹지 않는다.', actor: 'pavel', action: 'trace_news_route', flagsAdd: ['deliveryTrace', 'caution'], reaction: '파벨: 기다리는 데도 값이 듭니다. 그래도 모르는 발신자를 적는 값보다는 싸죠.', relationship: { pavel: 1 } }
    ],
    postChoices: [
      { id: 'C03-P1', text: '두 부고의 문장을 그대로 인용하고 사망 원인은 보류한다.', actor: 'alexei', action: 'quote_without_cause', flagsAdd: ['publicRecord', 'evidenceDiscipline'], reaction: '알렉세이: 네가 처음 말한 원칙을 문장으로 지켰군. 이번 기록에는 날짜가 책임을 진다.', relationship: { alexei: 1 } },
      { id: 'C03-P2', text: '애도 문단을 남기되 ‘공적 사실’ 표지와 분리한다.', actor: 'ekaterina', action: 'separate_mourning', flagsAdd: ['privateWitness', 'evidenceDiscipline'], reaction: '예카테리나: 이 문단은 사람들의 목소리로 남겨요. 다만 그 목소리를 조사 결과인 척하지는 말아요.', relationship: { ekaterina: 1 } },
      { id: 'C03-P3', text: '다음 조사 문서가 올 때까지 추가 인용을 보류하고 도착 경로를 기록한다.', actor: 'pavel', action: 'hold_for_arrival', flagsAdd: ['deliveryTrace', 'delayWithReason'], reaction: '파벨: 봉투가 늦었다는 사실도 기록이 됩니다. 기다린 이유까지 적었으니 말이죠.', relationship: { pavel: 1 } }
    ],
    laterDocuments: [{ availableDate: '1837-03-24', sourceId: 'C03-S2', label: '푸시킨 사후 조사 편지', status: 'LATER_DOCUMENT_NOT_IN_INITIAL_SCENE', note: '3월 자료는 1월 장면의 본문으로 열지 않는다.' }]
  },
  {
    id: 'C06', date: '1841-07-18', dateLabel: '1841년 7월 18일', title: '레르몬토프 결투 수사의 첫 보고', character: 'pavel', transition: '1841년 여름 · 7월 현장 보고만 도착한 상태.', sourceMoment: '7월 16–18일 현장 보고와 물증만 읽습니다. 8월 이후 군사재판 문서는 아직 도착하지 않았습니다.',
    intro: [
      ['NARRATION', '두 해가 흘렀다. 이번 봉투에는 시인의 죽음보다 먼저 날짜와 장소와 총기가 적혀 있었다.'],
      ['pavel', '여기까진 확실해요. 15일 결투, 16일 보고, 18일에는 권총 두 자루가 사건철로 들어왔습니다.'],
      ['PLAYER_PROMPT', '파벨이 봉투의 모서리를 가리킵니다. 지금 조사할 범위를 당신이 정합니다.'],
      ['pavel', '마르티노프의 9월 답변이나 11월 의견은 아직 이 봉투에 없어요. 그걸 미리 읽었다고 쓰면 안 됩니다.'],
      ['NARRATION', '그는 후대 문서가 들어올 자리를 비워 두고, 7월 보고의 날짜만 먼저 옮긴다.']
    ],
    question: '현장 보고와 추측을 어떻게 갈라 둘까?',
    readPrompt: '7월의 현장 보고 세 대목을 읽고, 아직 알 수 없는 것을 확인하세요.',
    excerpts: [
      excerpt('C06-R1', 'C06-S1', '1841-07-16', '№ 1351, 16 июля 1841', 'Корнет Глебов, вчерашнего числа в вечеру пришед ко мне в квартиру, объявил, что отставной Маиор Мартынов убил на дуеле ... Поручика Лермантова.', '글레보프 코넷이 어제 저녁 찾아와, 퇴역 소령 마르티노프가 결투에서 레르몬토프 중위를 살해했다고 알렸다.', 'PRIMARY_ADMIN_REPORT', 'VERIFIED_WITNESS', '사건 발생 직후의 행정 보고'),
      excerpt('C06-R2', 'C06-S1', '1841-07-17', '№ 35, свидетельство, 17 июля 1841', 'При осмотре оказалось, что пистолетная пуля ... от которой раны Поручик Лермантов мгновенно на месте поединка помер.', '검시 결과 권총 탄환은 몸을 관통했고, 그 상처로 레르몬토프 중위는 결투 현장에서 즉시 사망했다.', 'PRIMARY_MEDICAL_RECORD', 'VERIFIED_WITNESS', '7월 17일 검시 증명서'),
      excerpt('C06-R3', 'C06-S1', '1841-07-18', '№ 58, 18 июля 1841', 'Находящиеся в оной Управе два пистолета, взятые после поединка ... просим Управу прислать к нам при описи для приобщения оных к делу.', '결투 뒤 회수된 권총 두 자루를 목록과 함께 보내 사건 기록에 편철해 달라고 우라파에 요청한다.', 'PRIMARY_EVIDENCE_REGISTER', 'VERIFIED_WITNESS', '물증 편철 요청')
    ],
    choices: [
      { id: 'C06-A', text: '7월 보고와 물증만으로 현재 확인 범위를 닫는다.', actor: 'alexei', action: 'bound_july_record', flagsAdd: ['publicRecord', 'evidenceDiscipline'], reaction: '알렉세이: 이번에는 멈출 줄 아는 기록이 필요해. 11월의 판정을 7월에 끼워 넣지 마.', relationship: { alexei: 1 } },
      { id: 'C06-B', text: '아직 오지 않은 증언이 있음을 별도 표지로 남긴다.', actor: 'ekaterina', action: 'mark_future_testimony', flagsAdd: ['privateWitness', 'futureCaution'], reaction: '예카테리나: 빈칸을 숨기지 않는 것도 편집이에요. 나중에 누군가 그 빈칸을 대신 말하게 두지 않도록.', relationship: { ekaterina: 1 } },
      { id: 'C06-C', text: '권총과 봉투가 지나온 행정 경로를 추적한다.', actor: 'pavel', action: 'trace_physical_evidence', flagsAdd: ['deliveryTrace', 'materialEvidence'], reaction: '파벨: 권총은 말하지 않지만, 누가 언제 넘겼는지는 남아요. 그게 지금 내가 책임질 수 있는 부분입니다.', relationship: { pavel: 2 } }
    ],
    postChoices: [
      { id: 'C06-P1', text: '현장 확인과 사망 사실만 공식 보고로 옮기고 원인은 유보한다.', actor: 'alexei', action: 'report_observed_only', flagsAdd: ['publicRecord', 'evidenceDiscipline', 'safetyAttribution'], reaction: '알렉세이: 관청은 빠른 결론을 좋아하지만, 이 줄은 빨라지면 거짓말이 된다.', relationship: { alexei: 1 } },
      { id: 'C06-P2', text: '후대 심문이 도착할 자리를 표시하고 현재 기록을 닫는다.', actor: 'ekaterina', action: 'preserve_unknown_testimony', flagsAdd: ['privateWitness', 'evidenceDiscipline'], reaction: '예카테리나: 좋아요. 모르는 이유를 모른다고 쓰는 건 누군가를 변호하거나 고발하는 일이 아니에요.', relationship: { ekaterina: 1 } },
      { id: 'C06-P3', text: '권총의 인수자와 봉인만 기록하고 사람의 동기는 판단하지 않는다.', actor: 'pavel', action: 'seal_material_chain', flagsAdd: ['deliveryTrace', 'materialEvidence'], reaction: '파벨: 이 봉인은 나중에 열릴 겁니다. 그래도 누가 닫았는지는 지금 남길 수 있어요.', relationship: { pavel: 1 } }
    ],
    laterDocuments: [{ availableDate: '1841-09-13', sourceId: 'C06-S2', label: '마르티노프 질문 답변', status: 'LATER_DOCUMENT_NOT_IN_INITIAL_SCENE', note: '9월 답변과 11월 판정은 현 장면의 읽기 대상이 아니다.' }]
  },
  {
    id: 'C07', date: '1842-01-07', dateLabel: '1842년 1월 7일', title: '《죽은 혼》과 검열의 문턱', character: 'ekaterina', transition: '1842년 초 · 고골의 편지는 검열 결과보다 먼저 도착했다.', sourceMoment: '1월 7일 고골의 편지를 먼저 읽고, 3월의 허가 표기와 출판 목록은 후속 문서로 분리합니다.',
    intro: [
      ['NARRATION', '이번에는 작품이 아니라 작품을 통과시키는 문장이 봉투 안에서 먼저 떨고 있었다.'],
      ['ekaterina', '고골은 원고 전체를 막는다는 말을 들었다고 썼어요. 이 편지는 관청의 판정문이 아니라 작가의 편지예요.'],
      ['PLAYER_PROMPT', '예카테리나가 편지와 빈 판본 목록을 건넵니다. 어느 층위를 먼저 기록할지 당신이 고릅니다.'],
      ['ekaterina', '3월의 허가 표기는 아직 오지 않았어요. 오늘은 놀람과 확인 요청을 같은 목소리로 만들지 말아요.'],
      ['NARRATION', '그녀는 편지의 날짜를 접어 두고, 허가 표기가 들어올 자리를 판본 옆에 남겼다.']
    ],
    question: '작가의 항의와 검열 절차를 한 문서로 섞지 않으려면?',
    readPrompt: '1월 7일 편지의 연속된 두 대목을 읽고, 무엇이 아직 확인되지 않았는지 선택하세요.',
    excerpts: [
      excerpt('C07-R1', 'C07-S1', '1842-01-07', 'Гоголь — Плетневу, 7 января 1842, Москва', 'Расстроенный и телом и духом пишу к вам. ... но об цензуре я теперь должен говорить. Удар для меня никак не ожиданный: запрещают всю рукопись.', '몸과 마음이 모두 무너진 채 편지를 씁니다. … 하지만 이제 검열에 대해 말해야 합니다. 전혀 예상하지 못한 타격입니다. 원고 전체를 금지하고 있습니다.', 'PRIMARY_PRIVATE_LETTER', 'VERIFIED_WITNESS', '작가가 전한 당시의 경험'),
      excerpt('C07-R2', 'C07-S1', '1842-01-07', 'same letter, censor Snegirev passage', 'Я отдаю сначала ее цензору Снегиреву ... если он находит в ней какое-нибудь место, наводящее на него сомнение, чтоб объявил мне прямо.', '나는 우선 그 원고를 스네기료프 검열관에게 맡깁니다. 그가 의심을 불러일으키는 대목을 찾으면 내게 직접 말해 달라고 했습니다.', 'PRIMARY_PRIVATE_LETTER', 'VERIFIED_WITNESS', '검열 절차에 대한 편지의 연속 대목'),
    ],
    laterDocuments: [{ availableDate: '1842-03-09', sourceId: 'C07-S2', label: '니키텐코 허가 표기와 출판 기록', status: 'LATER_DOCUMENT_NOT_IN_INITIAL_SCENE', note: '3월 허가 기록은 1월 장면의 읽기 대상이 아니다.', text: '9 марта 1842 г. цензор А. В. Никитенко сделал разрешительную надпись.', sourceUrl: sourceUrls['C07-S2'] }],
    choices: [
      { id: 'C07-A', text: '편지의 호소와 관청의 판정을 별도 문서로 분리한다.', actor: 'alexei', action: 'separate_letter_from_ruling', flagsAdd: ['publicRecord', 'literaryArgument'], reaction: '알렉세이: 작가의 불안은 판정문이 아니고, 판정문은 작가의 불안을 지워서도 안 돼.', relationship: { alexei: 1 } },
      { id: 'C07-B', text: '작가가 무엇을 두려워했는지 편지의 목소리로 보존한다.', actor: 'ekaterina', action: 'preserve_author_voice', flagsAdd: ['privateWitness', 'literaryArgument'], reaction: '예카테리나: 고마워요. 내가 본 것은 검열관의 머릿속이 아니라, 그 문을 두드린 사람의 문장이니까.', relationship: { ekaterina: 2 } },
      { id: 'C07-C', text: '허가 표기와 판본을 기다릴 도착 경로를 기록한다.', actor: 'pavel', action: 'await_edition_record', flagsAdd: ['deliveryTrace', 'chronologyCare'], reaction: '파벨: 다음 봉투가 와야 비교할 수 있군요. 없는 판본을 이미 본 것처럼 말하지 않겠습니다.', relationship: { pavel: 1 } }
    ],
    postChoices: [
      { id: 'C07-P1', text: '편지의 금지 호소와 3월 허가를 시간순으로 병치한다.', actor: 'alexei', action: 'chronological_permission_compare', flagsAdd: ['publicRecord', 'chronologyCare', 'safetyAttribution'], reaction: '알렉세이: 날짜가 서로를 반박하지 않게 놓았군. 뒤에 온 허가가 앞선 공포를 없애지는 않아.', relationship: { alexei: 1 } },
      { id: 'C07-P2', text: '삭제된 대목은 확인된 판본의 차이로만 남기고 이유는 추정하지 않는다.', actor: 'ekaterina', action: 'record_deletion_without_motive', flagsAdd: ['privateWitness', 'literaryArgument'], reaction: '예카테리나: 그 선이면 내가 본 지면을 말할 수 있어요. 작가의 의도를 대신 판결하지 않고도.', relationship: { ekaterina: 1 } },
      { id: 'C07-P3', text: '판본과 인쇄소의 도착 시각을 비교해 전달 책임을 남긴다.', actor: 'pavel', action: 'compare_edition_arrival', flagsAdd: ['deliveryTrace', 'materialEvidence'], reaction: '파벨: 같은 책도 다른 시간에 옵니다. 그 차이를 지우지 않는 게 내 일입니다.', relationship: { pavel: 1 } }
    ]
  },
  {
    id: 'E02', date: '1847-01-05', dateLabel: '1847년 1월 5일', title: '로스토프치나의 〈강제 결혼〉', character: 'alexei', transition: '1847년 겨울 · 시와 독자의 오독이 한 책상에 놓였다.', sourceMoment: '1846년 12월 신문, 작품의 연결된 연, 1847년 1월 4일 니키텐코 일기를 서로 다른 층위로 읽습니다.',
    intro: [
      ['NARRATION', '1847년. 책상 위에는 1846년 12월호와 전날의 니키텐코 일기가 겹쳐 있다.'],
      ['alexei', '시가 문제라더니, 다들 시는 읽지도 않았어. 제목만 보고 집안 싸움이라고 결론을 냈지.'],
      ['PLAYER_PROMPT', '알렉세이가 작품의 연속된 대목과 독자의 반응을 나란히 놓습니다. 당신이 먼저 읽을 순서를 정합니다.'],
      ['alexei', '이번엔 내 동생 얘기처럼 쓰지 마. 시가 말한 것과 사람들이 겁먹은 것을 따로 보자고.'],
      ['NARRATION', '봉투에는 1846년 12월 17일 발행호와 1847년 1월 4일 일기 기록의 날짜가 각각 찍혀 있다.']
    ],
    question: '시의 목소리와 독자의 정치적 독해를 어떻게 분리할까?',
    readPrompt: '발라드의 두 목소리와 니키텐코의 반응을 읽고, 해석의 근거를 직접 판단하세요.',
    excerpts: [
      excerpt('E02-R1', 'E02-S2', '1845', 'opening stanza, lines 22–32', 'Сбирайтесь, слуги и вассалы, / На кроткий господина зов! / Судите, не боясь опалы,– / Я правду выслушать готов! ... Не властен у себя я дома: / Все непокорна мне она, / Моя мятежная жена!', '모여라, 하인들과 가신들이여, 온순한 주인의 부름에! / 불이익을 두려워하지 말고 판단하라, 나는 진실을 들을 준비가 되어 있다! … 나는 집 안에서조차 권력을 행사하지 못한다. 그녀는 끝내 복종하지 않는다, 나의 반항적인 아내여!', 'PRIMARY_POEM_CONTINUOUS_STANZA', 'VERIFIED_WITNESS', '작품의 첫 번째 화자와 연결된 연'),
      excerpt('E02-R2', 'E02-S2', '1845', 'wife stanza, lines 63–83', 'Раба ли я или подруга – / То знает Бог!.. Я ль избрала / Себе жестокого супруга? ... Я предана, я продана – / Я узница, я не жена!', '나는 노예인가, 동반자인가—그것은 신만이 아신다! 내가 잔혹한 남편을 스스로 골랐던가? … 나는 넘겨지고 팔렸다. 나는 포로이지 아내가 아니다!', 'PRIMARY_POEM_CONTINUOUS_STANZA', 'VERIFIED_WITNESS', '작품 속 두 번째 화자의 연결된 연'),
      excerpt('E02-R3', 'E02-S3', '1847-01-04', 'diary entry on № 284 and Насильный брак', 'В N 284 за 17 декабря «Северной пчелы» напечатано несколько стихотворений графини Ростопчиной и, между прочим, баллада: «Насильный брак». И цензура и публика сначала поняли так, что графиня Ростопчина говорит о своих собственных отношениях к мужу.', '《북방의 벌》 12월 17일자 284호에는 로스토프치나 백작부인의 시 몇 편과 발라드 〈강제 결혼〉이 실렸다. 검열 당국과 독자는 처음에는 로스토프치나가 자신의 남편과의 관계를 말한 것으로 이해했다.', 'PRIMARY_DIARY_CONTEXT', 'VERIFIED_WITNESS', '동시기 독해 반응. 작품의 본뜻이라고 단정하지 않음')
    ],
    choices: [
      { id: 'E02-A', text: '두 화자의 연을 먼저 대조하고, 집안 이야기라는 단정은 보류한다.', actor: 'alexei', action: 'read_poem_before_claim', flagsAdd: ['publicRecord', 'literaryArgument'], reaction: '알렉세이: 맞아. 제목이 사람을 대신 말하게 두면, 시의 두 목소리가 사라지니까.', relationship: { alexei: 2 } },
      { id: 'E02-B', text: '독자들이 왜 사적인 결혼으로 읽었는지 반응 자체를 보존한다.', actor: 'ekaterina', action: 'preserve_reception', flagsAdd: ['privateWitness', 'literaryArgument'], reaction: '예카테리나: 반응은 작품의 뜻과 같지 않지만, 그 시대가 무엇을 두려워했는지는 보여 줘요.', relationship: { ekaterina: 1 } },
      { id: 'E02-C', text: '보고를 미루고 시가 이동한 신문·일기 경로부터 고정한다.', actor: 'pavel', action: 'trace_poem_delivery', flagsAdd: ['deliveryTrace', 'materialEvidence', 'literaryArgument'], reaction: '파벨: 이건 봉투를 탓할 일이 아니야. 어디서 읽혔는지 알아야 다음 사람이 덜 위험해져.', relationship: { pavel: 1 } }
    ],
    postChoices: [
      { id: 'E02-P1', text: '첫 화자와 아내의 반박을 함께 인용해 작품의 긴장을 보존한다.', actor: 'alexei', action: 'publish_two_voices', flagsAdd: ['publicRecord', 'literaryArgument', 'safetyAttribution'], reaction: '알렉세이: 이제야 한쪽의 죄목으로 시를 닫지 않았군. 결재는 하겠지만, 내 이름도 옆에 남겨.', relationship: { alexei: 2 } },
      { id: 'E02-P2', text: '니키텐코의 오독을 독자의 반응으로 표시하고 작품의 뜻과 분리한다.', actor: 'ekaterina', action: 'label_misreading', flagsAdd: ['privateWitness', 'evidenceDiscipline'], reaction: '예카테리나: 좋아요. 오독도 기록이지만, 작가의 입을 빌려 오독을 정당화하진 않겠어요.', relationship: { ekaterina: 2 } },
      { id: 'E02-P3', text: '신문호·전사본·일기의 도착 날짜를 나누고 공개를 하루 늦춘다.', actor: 'pavel', action: 'delay_for_source_chain', flagsAdd: ['deliveryTrace', 'delayWithReason'], reaction: '파벨: 하루 늦게 도착한 기록은 하루 늦게 말해야 합니다. 그게 운반자의 안전이기도 해요.', relationship: { pavel: 2 } }
    ]
  },
  {
    id: 'E07', date: '1849-05-10', dateLabel: '1849년 5월 10일', title: '페트라셰프스키 사건철: 증언과 기록의 간격', character: 'alexei', transition: '1849년 5월 · 사건철의 표지와 실제 심문 답변이 분리되어 도착했다.', sourceMoment: '사건철의 식별 정보는 메타데이터로만 표시합니다. 본문 읽기는 1849년 5월 증언과 당대 기록 편찬본의 실제 문장으로 진행합니다.',
    intro: [
      ['NARRATION', '마지막 봉투에는 사건철 표지와, 5월 10일 조사위원회에 제출된 한 사람의 자기변호가 따로 들어 있다.'],
      ['alexei', '이번엔 표지의 번호만 보고 사람을 판단하면 안 돼. 실제로 말한 문장이 따로 있어.'],
      ['PLAYER_PROMPT', '알렉세이가 메타데이터 카드와 증언 본문을 분리합니다. 무엇을 먼저 읽을지 당신이 정합니다.'],
      ['alexei', '이 사건의 결말은 우리가 바꿀 수 없어. 하지만 누가 무엇을 인정했는지, 무엇을 모르는지는 바꿔 적을 수 있지.'],
      ['NARRATION', '표지에는 GARF 기금·목록·사건철 번호가 적혀 있고, 본문에는 조사위원회에 제출된 증언의 날짜가 적혀 있다.']
    ],
    question: '사건철의 표지와 실제 증언을 섞지 않고 무엇을 책임질까?',
    readPrompt: '메타데이터는 본문이 아님을 확인한 뒤, 실제 증언과 당대 보고의 대목을 읽으세요.',
    metadata: [
      { id: 'E07-M1', sourceId: 'E07-S1', text: 'Ф.109 Оп.24 Д.214 ч.I', ko: '러시아연방국가문서보관소 109기금 24목록 214사건철 1부', status: 'ARCHIVAL_METADATA', role: '식별자만 제공; 본문 읽기 단위에 포함하지 않음' },
      { id: 'E07-M2', sourceId: 'E07-S1', text: 'Донесения Антонелли; Донесение Дубельта; Список приговорённых', ko: '안토넬리 보고·두벨트 보고·선고 명단', status: 'ARCHIVAL_METADATA', role: '표제·폴리오 안내; 본문 대체 불가' }
    ],
    excerpts: [
      excerpt('E07-R1', 'E07-S4', '1849-05-10', 'Баласогло, Исповедь, opening of written explanation', 'По приглашению следственной комиссии ... изложить на бумаге свое оправдание ... имею честь представить следующее объяснение.', '조사위원회의 요청으로 종이에 나의 변론을 적어 제출하라는 말을 듣고, 다음과 같이 설명을 올립니다.', 'PUBLISHED_ARCHIVAL_TESTIMONY', 'VERIFIED_WITNESS', '실제 심문·자기변호 문서의 도입'),
      excerpt('E07-R2', 'E07-S4', '1849-05-10', 'Баласогло, Исповедь, accusation paragraph', 'Я обвиняюсь ... в соучастии в так называемом тайном обществе ... распространением этих идей в России.', '나는 이른바 비밀 결사에 가담했고, 러시아에서 그 사상을 퍼뜨려 사회 질서를 전복하려 했다는 혐의를 받고 있습니다.', 'PUBLISHED_ARCHIVAL_TESTIMONY', 'VERIFIED_WITNESS', '혐의가 어떻게 서술되는지 보여 주는 실제 증언'),
      excerpt('E07-R3', 'E07-S5', '1849', 'Дубельт, Записки для сведения, commission finding', 'собрания ... не обнаруживающие, однако ж, ни единства действий, ни взаимного согласия, к разряду тайных организованных обществ не принадлежали', '그 모임들은 행동의 통일성이나 상호 합의를 드러내지 않았으므로, 조직된 비밀 결사에 속하지 않는다고 조사위원회는 보았다.', 'PUBLISHED_OFFICIAL_REPORT', 'VERIFIED_WITNESS', '당대 보고 편찬본의 조사위원회 판단')
    ],
    choices: [
      { id: 'E07-A', text: '혐의·증언·위원회 판단을 서로 다른 문서 층위로 기록한다.', actor: 'alexei', action: 'separate_charge_and_testimony', flagsAdd: ['publicRecord', 'safetyAttribution', 'e07Evidence'], reaction: '알렉세이: 이제 사람을 혐의의 문법으로만 남기지 않았군. 역사적 판결은 그대로지만, 우리 기록은 섞이지 않았어.', relationship: { alexei: 2 } },
      { id: 'E07-B', text: '자기변호의 목소리를 보존하되, 그 말이 무죄 판정은 아님을 표시한다.', actor: 'ekaterina', action: 'preserve_testimony_without_verdict', flagsAdd: ['privateWitness', 'e07Evidence'], reaction: '예카테리나: 증언을 남기는 것과 믿는 것은 다르죠. 그 차이를 독자에게 돌려줍시다.', relationship: { ekaterina: 2 } },
      { id: 'E07-C', text: '표지·보고서·전달 경로를 나누고 확인되지 않은 이름은 쓰지 않는다.', actor: 'pavel', action: 'limit_names_to_witness', flagsAdd: ['deliveryTrace', 'e07Evidence'], reaction: '파벨: 내가 옮긴 건 봉투와 확인된 이름까지야. 나머지는 내 손으로 만들지 않겠어.', relationship: { pavel: 2 } }
    ],
    postChoices: [
      { id: 'E07-P1', text: '위원회가 한 판단과 증언자가 받은 혐의를 같은 문장에 쓰지 않는다.', actor: 'alexei', action: 'separate_institutional_voice', flagsAdd: ['publicRecord', 'safetyAttribution', 'historicalBoundary'], reaction: '알렉세이: 마지막에도 경계선을 지켰군. 결말은 국가의 기록으로 남고, 서기의 책임은 그 선을 흐리지 않은 데 있어.', relationship: { alexei: 2 } },
      { id: 'E07-P2', text: '자기변호의 문장을 자료철에 남기고, 판결과 별개로 열람하게 한다.', actor: 'ekaterina', action: 'archive_voice_beside_verdict', flagsAdd: ['privateWitness', 'historicalBoundary'], reaction: '예카테리나: 누군가의 말이 판결을 지우지는 않아요. 하지만 판결만 남으면 그 사람이 말할 자리가 사라지죠.', relationship: { ekaterina: 2 } },
      { id: 'E07-P3', text: '확인된 증언자와 전달 단계만 공개하고 표지의 이름 목록은 판단 근거로 쓰지 않는다.', actor: 'pavel', action: 'publish_verified_chain_only', flagsAdd: ['deliveryTrace', 'historicalBoundary'], reaction: '파벨: 이번에는 빈칸이 약속이야. 확인되지 않은 사람을 내 문장으로 끌어오지 않겠어.', relationship: { pavel: 2 } }
    ]
  }
];

const endings = [
  { id: 'DOSTOEVSKY_PETRASHEVSKY', title: '공식 기록의 사람', rule: { allFlags: ['publicRecord', 'safetyAttribution', 'e07Evidence', 'historicalBoundary'], noneFlags: ['privateWitness', 'deliveryTrace'], minScenes: 5 }, dialogue: [
    ['alexei', '네 기록에는 공식 문서의 경계가 남아 있어.'], ['alexei', '푸시킨의 부고에서 날짜를 고정했고, 레르몬토프 사건에서 7월의 빈칸을 지켰지.'], ['alexei', '고골의 편지와 허가 표기도 한 줄로 섞지 않았고.'], ['alexei', '마지막 사건철에서도 혐의와 증언을 갈랐어.'], ['NARRATION', '역사적 판결은 바뀌지 않는다. 다만 서기는 확인된 범위 밖으로 사람을 밀어 넣지 않았다.'] ], historicalOutcome: '1849년의 국가 수사·판결은 고정되며, 플레이어는 공식 기록의 경계를 지킨 가상 서기의 책임만 경험한다.' },
  { id: 'HERZEN', title: '사적인 목소리의 보관자', rule: { allFlags: ['privateWitness', 'e07Evidence', 'historicalBoundary'], noneFlags: ['publicRecord', 'deliveryTrace'], minScenes: 5 }, dialogue: [
    ['ekaterina', '당신은 사람의 목소리를 판정문으로 바꾸지 않았어요.'], ['ekaterina', '푸시킨의 애도를 사실과 따로 보관했고, 고골의 편지를 검열관의 목소리로 바꾸지 않았죠.'], ['ekaterina', '레르몬토프 사건의 빈 증언도 빈 채로 남겼고.'], ['ekaterina', '마지막 자기변호는 무죄 판결이 아니지만, 지워도 되는 문장도 아니에요.'], ['NARRATION', '역사적 결과는 고정된다. 개인 기록은 공식 판단 옆에서 사라지지 않았다.'] ], historicalOutcome: '개인 목소리의 보존은 허구의 서기 경로이며, 실제 인물의 역사적 결과를 바꾸지 않는다.' },
  { id: 'BELINSKY', title: '먼 길의 기록자', rule: { allFlags: ['deliveryTrace', 'literaryArgument', 'e07Evidence', 'historicalBoundary'], noneFlags: ['publicRecord', 'privateWitness'], minScenes: 5 }, dialogue: [
    ['pavel', '당신은 문장이 어디서 와서 누구 손을 거쳤는지 끝까지 물었어요.'], ['pavel', '푸시킨 소식의 발신을 확인했고, 권총과 판본의 인수 기록을 남겼죠.'], ['pavel', '로스토프치나의 시도 뜻보다 먼저 이동한 종이를 보았고.'], ['pavel', '마지막에는 확인된 증언자만 건넜습니다.'], ['NARRATION', '기록의 길은 국경을 넘는 모험담이 아니라, 책임질 수 있는 전달 단계의 목록으로 남는다.'] ], historicalOutcome: '전달 경로와 문학적 공개의 가상 선택만 달라지며, 실제 문학사의 인물과 사건은 변경되지 않는다.' },
  { id: 'KHOMYAKOV', title: '두 목소리 사이의 중재자', rule: { allFlags: ['publicRecord', 'privateWitness', 'literaryArgument', 'e07Evidence'], noneFlags: ['deliveryTrace'], minScenes: 5 }, dialogue: [
    ['alexei', '공식 대장만으로는 사라지는 목소리가 있었고, 사적인 기록만으로는 확인할 날짜가 없었어.'], ['ekaterina', '당신은 두 층위를 나란히 놓았지만, 서로의 증거인 척하지 않았죠.'], ['alexei', '그 선택은 편하지 않았어. 누구도 완전히 만족하지 않으니까.'], ['ekaterina', '그래도 문학의 논쟁과 행정의 기록을 한쪽의 승리로 만들지는 않았어요.'], ['NARRATION', '두 장부는 합쳐지지 않는다. 플레이어는 그 사이를 오래 보존하는 책임을 택했다.'] ], historicalOutcome: '당대 사상가의 입장을 플레이어에게 귀속하지 않으며, 중재자의 가상 기록만 변한다.' },
  { id: 'UVAROV', title: '세 방향의 증인', rule: { allFlags: ['publicRecord', 'privateWitness', 'deliveryTrace', 'e07Evidence', 'historicalBoundary'], minScenes: 5 }, dialogue: [
    ['alexei', '사람, 문장, 전달 경로를 모두 적었군. 그래서 어느 기록도 다른 기록을 대신하지 못해.'], ['ekaterina', '당신은 내가 본 지면과 내가 모르는 판결을 구분했어요.'], ['pavel', '봉투가 지나온 길도 숨기지 않았고요. 그건 나 같은 사람에게 드문 예의입니다.'], ['alexei', '안전한 선택은 아니었지만, 책임의 위치가 보입니다.'], ['NARRATION', '세 방향의 기록이 서로를 감시한다. 역사적 결과는 고정되고, 가상 서기의 노선만 달라진다.'] ], historicalOutcome: '세 종류의 책임을 함께 기록한 가상 경로이며, 실제 역사적 사건의 결과는 변경하지 않는다.' }
];

const document = {
  schemaVersion: 'MAIN-20MIN-DIALOGUE-V31',
  title: 'Russian Lives: Act III — V31 chronology and reading route',
  playerFrame: '현대 한국인 플레이어가 19세기 러시아의 허구 서기 기록을 읽는다. 1837년 러시아 관료라는 역사적 사실을 주장하지 않는다.',
  timingEstimate: { minMinutes: 15, maxMinutes: 25, targetMinutes: 20, kind: 'TIMING_ESTIMATE', humanMeasured: false },
  chronology: { sceneOrder: ['C03', 'C06', 'C07', 'E02', 'E07'], rule: 'availableDate must be on or before sceneDate; laterDocuments are not shown as initial body text' },
  readModel: { key: 'readExcerptIdsByScene', requirementKind: 'SUBSTANTIVE_EXCERPTS_ONLY', metadataNeverCounts: true, migration: 'legacy readExcerptIds is discarded into an empty per-scene map' },
  sourcePolicy: 'VERIFIED_WITNESS means the checked-in source record points to a reviewed public transcription or archival publication; metadata is never rendered as body text.',
  scenes,
  endings
};
fs.mkdirSync('narrative', { recursive: true });
fs.writeFileSync('narrative/MAIN_20MIN_DIALOGUE.json', JSON.stringify(document, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', scenes: scenes.length, choices: scenes.reduce((n, s) => n + s.choices.length + s.postChoices.length, 0), substantiveExcerpts: scenes.reduce((n, s) => n + s.excerpts.length, 0), metadataNotCounted: true, endings: endings.length }, null, 2));
