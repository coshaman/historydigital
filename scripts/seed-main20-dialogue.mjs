import fs from 'node:fs';

const v6 = JSON.parse(fs.readFileSync('data/v6-gold-cases.json', 'utf8'));
const v27 = JSON.parse(fs.readFileSync('data/v27-case-bundle.json', 'utf8'));
const find = (id) => v6.cases.find((item) => item.caseId === id) || v27.cases.find((item) => item.caseId === id);

const sceneSeeds = [
  {
    id: 'E02', date: '1847-01-05', title: '로스토프치나의 〈강제 결혼〉', character: 'alexei', sourceCase: 'E02',
    intro: [
      ['NARRATION', '눈이 녹지 않은 아침, 알렉세이가 봉투 하나를 내 책상 앞에 밀어 놓는다.'],
      ['alexei', '이건 시 한 편이야. 그런데 사람들은 시보다 먼저 죄목을 읽더군.'],
      ['PLAYER_ACTION', '“먼저 종이에 적힌 것과 사람들이 덧붙인 말을 나누어 보자.”'],
      ['alexei', '좋아. 네가 그렇게 말해 주면, 나도 상급자에게 그대로 올릴 수 있어.'],
      ['NARRATION', '그는 봉투의 봉인을 풀고, 1846년 12월호의 표제와 일기 기록을 나란히 놓는다.']
    ],
    question: '이 시와 일기에서 먼저 지켜야 할 것은 무엇일까?',
    choices: [
      {id:'E02-A', text:'“문장과 추측을 갈라 적자. 없는 죄까지 우리가 만들 필요는 없어.”', actor:'alexei', action:'separate_fact', channel:'official', effect:{trust:1, caution:1}, reaction:'그래. 문장이 말한 데까지만 적자. 내 이름으로 빈칸을 채우진 않겠어.'},
      {id:'E02-B', text:'“사람들이 왜 불안해했는지도 기록에 남겨야 해.”', actor:'ekaterina', action:'preserve_public_voice', channel:'dossier', effect:{curiosity:1, press:1}, reaction:'그 불안이 어디서 왔는지 읽어야지. 문장을 겁먹은 사람의 입으로 다시 쓰지는 말고.'},
      {id:'E02-C', text:'“유통 경로와 위험 표시를 먼저 적자. 봉투가 어디서 왔는지부터.”', actor:'pavel', action:'trace_delivery', channel:'crossBorder', effect:{risk:1, logistics:1}, reaction:'그게 맞아. 누가 읽었는지 모르면, 좋은 뜻도 사람을 곤란하게 만들거든.'}
    ]
  },
  {
    id: 'C03', date: '1837-03', title: '푸시킨의 죽음과 언론의 반응', character: 'ekaterina', sourceCase: 'C03',
    intro: [
      ['NARRATION', '두 번째 봉투에는 짧은 부고와 발행 날짜가 함께 묶여 있다.'],
      ['ekaterina', '푸시킨이 죽었다는 말보다, 그 소식이 어떤 목소리로 퍼졌는지가 더 오래 남아요.'],
      ['PLAYER_ACTION', '“사망 소식의 출처와 발표 시각을 먼저 대조하자.”'],
      ['ekaterina', '그래야 애도의 문장과 확인된 사실을 서로 대신 쓰게 하지 않죠.'],
      ['NARRATION', '예카테리나는 펜 끝으로 동시기 부고의 문장을 짚고, 빈칸을 남겨 둔다.']
    ],
    question: '사망 소식과 애도의 목소리를 어떻게 함께 남길까?',
    choices: [
      {id:'C03-A', text:'“발표 시각과 출처를 공식 기록에 먼저 고정하자.”', actor:'alexei', action:'fix_official_time', channel:'official', effect:{trust:1, chronology:1}, reaction:'그 날짜는 흔들리지 않게 두자. 나머지는 그 주변에서 말하게 하면 돼.'},
      {id:'C03-B', text:'“추모의 문장도 지우지 말자. 사실과 애도를 두 칸에 나누어 적어.”', actor:'ekaterina', action:'keep_mourning_voice', channel:'dossier', effect:{curiosity:1, press:1}, reaction:'이제야 제대로 읽었네요. 애도는 사실의 적이 아니라, 그 소식이 사람에게 닿은 흔적이에요.'},
      {id:'C03-C', text:'“소식이 온 길을 추적하자. 확인 전에는 발신자를 적지 않겠어.”', actor:'pavel', action:'trace_news', channel:'crossBorder', effect:{risk:1, logistics:1}, reaction:'길을 확인하면 소문도 줄어들어. 모르는 이름을 넣는 것보다 훨씬 안전하지.'}
    ]
  },
  {
    id: 'C06', date: '1841-07-16 to 1841-07-30', title: '레르몬토프 결투 수사 기록', character: 'pavel', sourceCase: 'C06',
    intro: [
      ['NARRATION', '세 번째 자료철은 결투 뒤에 작성된 행정 보고로 시작한다.'],
      ['pavel', '여기엔 누가 언제 총을 들었는지만 있어. 사람들 마음까지 배달된 건 아니야.'],
      ['PLAYER_ACTION', '“증언과 공식 날짜를 나누어 읽고, 모르는 대목은 비워 두자.”'],
      ['pavel', '그 빈칸을 채우려고 사람을 더 부르면 비용도 위험도 늘어나.'],
      ['NARRATION', '파벨은 봉투의 이동 경로를 손가락으로 세며, 확인된 이름만 옮겨 적는다.']
    ],
    question: '결투 사건에서 확인된 사실과 추정을 어디까지 나눌까?',
    choices: [
      {id:'C06-A', text:'“공식 날짜와 판정의 범위만 먼저 확인하자.”', actor:'alexei', action:'bound_inquiry', channel:'official', effect:{trust:1, caution:1}, reaction:'좋아. 판정의 범위를 넘지 않으면 적어도 문서는 거짓말을 덜 하겠지.'},
      {id:'C06-B', text:'“증언의 빈칸을 서로 대조하되, 삭제된 말을 추정하지는 말자.”', actor:'ekaterina', action:'compare_testimony', channel:'dossier', effect:{curiosity:1, press:1}, reaction:'바로 그거예요. 빠진 문장이 있다고 해서 우리가 원하는 말을 넣을 권리는 없어요.'},
      {id:'C06-C', text:'“봉투가 거친 사람과 시간을 먼저 남기자.”', actor:'pavel', action:'record_route', channel:'crossBorder', effect:{risk:1, logistics:1}, reaction:'그럼 나중에 내가 누구에게 무엇을 건넸는지도 설명할 수 있겠네.'}
    ]
  },
  {
    id: 'C07', date: '1842-01-07 to 1842-05', title: '《죽은 혼》의 출판과 검열', character: 'ekaterina', sourceCase: 'C07',
    intro: [
      ['NARRATION', '네 번째 봉투에서는 원고 전체를 금지한다는 문장이 먼저 보인다.'],
      ['ekaterina', '이제 검열에 대해 말해야 한다는 편지예요. 작가가 놀란 이유를 문장 밖으로 밀어내면 안 돼요.'],
      ['PLAYER_ACTION', '“금지 통보와 작가의 말을 같은 사실로 만들지 말고 나란히 읽자.”'],
      ['ekaterina', '고집이 아니라 구분이에요. 한쪽의 두려움이 다른 쪽의 증거가 되지는 않으니까.'],
      ['NARRATION', '그녀는 원고의 제목, 편지의 날짜, 검열 통보의 어조를 서로 다른 색으로 표시한다.']
    ],
    question: '금지된 원고를 기록할 때 무엇을 보존해야 할까?',
    choices: [
      {id:'C07-A', text:'“허가 표기와 원고의 빈자리를 별도 기록으로 남기자.”', actor:'alexei', action:'separate_permission', channel:'official', effect:{trust:1, chronology:1}, reaction:'허가된 것과 사라진 것을 같은 줄에 두지 않겠어. 기록이 먼저 구분해야 해.'},
      {id:'C07-B', text:'“삭제된 대목은 대조하되, 삭제 이유는 추정하지 말자.”', actor:'ekaterina', action:'protect_unknowns', channel:'dossier', effect:{curiosity:1, press:1}, reaction:'그 선을 지키면 나중에 읽는 사람도 우리 편견까지 물려받지는 않겠죠.'},
      {id:'C07-C', text:'“판본과 인쇄소를 나누어 전달 시간을 기록하자.”', actor:'pavel', action:'route_editions', channel:'crossBorder', effect:{risk:1, logistics:1}, reaction:'종이는 같은데 길이 다르면, 도착한 시간부터 증거가 되니까.'}
    ]
  },
  {
    id: 'E07', date: '1849', title: '페트라셰프스키 사건철', character: 'alexei', sourceCase: 'E07',
    intro: [
      ['NARRATION', '마지막 사건철은 앞선 기록들이 사람의 이름으로 좁혀지는 순간을 보여 준다.'],
      ['alexei', '여기서부터는 종이가 사람을 따라가. 이름 하나를 잘못 옮기면, 그 사람의 밤까지 바뀌지.'],
      ['PLAYER_ACTION', '“독서와 실제 행위를 같은 칸에 넣지 말자.”'],
      ['alexei', '그 말을 공식 대장에 남기면, 적어도 내가 무엇을 섞었는지는 보이겠지.'],
      ['NARRATION', '우리는 다섯 봉투의 흔적을 펼쳐 놓고, 누구와 어떤 방식으로 기록을 끝낼지 결정한다.']
    ],
    question: '사건철을 닫으며 어떤 관계와 기록을 남길까?',
    choices: [
      {id:'E07-A', text:'“사람을 사상과 관계만으로 적지 말고, 확인된 행위만 남기자.”', actor:'alexei', action:'protect_person', channel:'official', effect:{trust:2, caution:1}, reaction:'그렇게 쓰면 적어도 이름이 죄목보다 먼저 달리지는 않겠지.'},
      {id:'E07-B', text:'“읽은 문장과 실제 행위를 두 문서로 나누어 보관하자.”', actor:'ekaterina', action:'protect_context', channel:'dossier', effect:{curiosity:2, press:1}, reaction:'좋아요. 기록을 나누는 건 숨기는 일이 아니라, 서로 다른 목소리를 살려 두는 일이니까.'},
      {id:'E07-C', text:'“전달 경로와 확인된 수신자만 남기고, 모르는 사람은 쓰지 않자.”', actor:'pavel', action:'protect_route', channel:'crossBorder', effect:{risk:2, logistics:1}, reaction:'그럼 내가 감당할 수 있는 약속만 남네. 그게 오래 가는 기록이야.'}
    ]
  }
];

const scenes = sceneSeeds.map((seed) => {
  const sourceCase = find(seed.sourceCase);
  const excerpts = (sourceCase?.excerpts || []).slice(0, 5).map((excerpt, index) => ({
    excerptId: excerpt.excerptId || `${seed.id}-X${index + 1}`,
    sourceId: excerpt.sourceId,
    locator: excerpt.locator,
    ru: excerpt.ru,
    ko: excerpt.ko,
    context: excerpt.context || excerpt.evidenceKind || '확인된 자료 대목',
    evidence: excerpt.evidence || excerpt.evidenceKind || 'DIRECT',
    quotationStatus: excerpt.quotationStatus || 'VERBATIM',
    translationReview: excerpt.translationReview || 'REVIEWED'
  }));
  const sources = (sourceCase?.sources || []).map((source) => ({sourceId:source.sourceId,titleRu:source.titleRu,titleKo:source.titleKo,publication:source.publication,date:source.date || source.sourceDate,locator:source.locator || source.page,url:source.url || source.stableUrl,rights:source.rights,role:source.sourceRole || source.role}));
  return { id:seed.id, date:seed.date, title:seed.title, character:seed.character, intro:seed.intro, question:seed.question, choices:seed.choices, excerpts, sources, readRequirement: excerpts.length, next: sceneSeeds[sceneSeeds.indexOf(seed)+1]?.id || null };
});

const endings = [
  {id:'DOSTOEVSKY_PETRASHEVSKY', title:'공식 기록의 사람', condition:'official', epilogue:'당신은 확인된 행위와 문서의 범위를 지켰다. 알렉세이는 이름보다 기록이 먼저 남았다고 말한다.'},
  {id:'HERZEN', title:'사적인 목소리의 보관자', condition:'dossier', epilogue:'당신은 문서의 가장자리에서 사라질 목소리를 보관했다. 예카테리나는 그 빈칸을 다음 사람에게 넘긴다.'},
  {id:'BELINSKY', title:'먼 길의 기록자', condition:'crossBorder', epilogue:'당신은 봉투가 건넌 길과 위험을 기록했다. 파벨은 이제 약속의 무게를 계산할 수 있다고 말한다.'},
  {id:'KHOMYAKOV', title:'두 장부 사이', condition:'official+dossier', epilogue:'당신은 공식 대장과 사적인 목소리를 함께 남겼다. 어느 한쪽도 다른 쪽을 지우지 못하게 했다.'},
  {id:'UVAROV', title:'세 방향의 증인', condition:'all-three', epilogue:'당신은 사람·문장·전달 경로를 모두 책임졌다. 결말은 하나가 아니라 서로 다른 기록의 결로 남는다.'}
];

const document = { schemaVersion:'MAIN-20MIN-DIALOGUE-1', title:'Russian Lives: Act III — 20분 메인 루트', timingEstimate:{minMinutes:15,maxMinutes:25,targetMinutes:20,kind:'TIMING_ESTIMATE'}, coreSceneIds:scenes.map((scene)=>scene.id), scenes, endings, sourcePolicy:'모든 인용은 checked-in source record의 원문·번역·locator를 보존한다.' };
fs.mkdirSync('narrative', {recursive:true});
fs.writeFileSync('narrative/MAIN_20MIN_DIALOGUE.json', `${JSON.stringify(document, null, 2)}\n`);
console.log(JSON.stringify({status:'PASS', scenes:scenes.length, excerpts:scenes.reduce((sum,scene)=>sum+scene.excerpts.length,0), choices:scenes.reduce((sum,scene)=>sum+scene.choices.length,0), endings:endings.length}, null, 2));
