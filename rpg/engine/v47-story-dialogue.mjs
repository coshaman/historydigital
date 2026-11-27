const option = (id, labelKo, replyKo) => Object.freeze({ id, labelKo, replyKo });
const makeBranch = (promptKo, rows) => Object.freeze({ promptKo, options: rows.map(row => option(...row)) });

// Fixed, source-linked dialogue for the conversations that carry MAIN01's
// current scene. Other residents and ordinary open-world conversations keep
// their existing AI-first flow.
const TRACKS = [
  {
    id: 'MAIN01_A01_DARYA', questId: 'V47_MAIN01_A01', hostId: 'reader_darya',
    sourceIds: ['V47-NEKRASOV-ALMANAC-CONTENTS-1848'],
    openingKo: '《동시대인》은 여기 두어 주세요. 아버님은 제가 실을 사러 나온 줄 아세요. 실이라면 저더러 어떤 빛을 골랐는지 굳이 묻지도 않으시고요.',
    firstPromptKo: '서점 문 앞에 집안 마차가 멈췄다.',
    first: [
      option('ledger', '댁의 마차를 기다리게 해도 되겠소?', '저한테는 책방에 또 갔느냐고 한마디 하시면 그만이에요. 마부는 그날 저녁 식사도 못 하고 불려가고요.'),
      option('printer', '뭘 읽고 싶으세요?', '신문이요. 어젯밤에도 아버님이 읽으시다가 화를 내셨는데, 저는 영문도 모르고 그분 말씀에 옳다고 했답니다. 나중에 신문을 펴 보려 했더니 이미 접어 가셨더군요.'),
      option('receipt', '밖의 마차는 댁에서 온 겁니까?', '예. 제가 얼마 안 걸린다고 했어요. 성에가 저렇게 끼기 전에 들어가겠다고 했는데.'),
    ],
    branches: {
      ledger: makeBranch('', [
        ['ledger1', '그래도 사겠어요?', '네. 무슨 책을 덮을지는 제가 읽어 보고 정하고 싶어요.'],
        ['ledger2', '그럼 집에 가져갈 수는 있나요?', '예카테리나 방에서 다 읽고 가면 돼요. 아버지는 그분이 글을 읽을 줄 모르시는 줄 알아요.'],
        ['ledger3', '망설여지지 않아요?', '겁나죠. 그런데 못 읽게 하는 분께 무서워서 덮었다고는 말하기 싫어요.'],
      ]),
      printer: makeBranch('', [
        ['printer1', '이쪽 신문은 보셨어요?', '뒤에 실린 글부터 봐도 돼요? 아버지가 꼭 그쪽은 소리 내서 읽지 않거든요.'],
        ['printer2', '집에서는 아무도 같이 안 읽나요?', '하녀랑 같이 볼까 했는데, 제가 읽어 주는 동안 그 애는 제 신발을 닦아요.'],
        ['printer3', '여기서 먼저 읽으시죠.', '잠깐만요. 아버지 마차가 가는 소리가 나는 것 같아요.'],
      ]),
      receipt: makeBranch('', [
        ['receipt1', '먼저 밖에 나가 봐요.', '잠깐만요. 이 책은 사 놓고요. 제가 돌아오면 여기서 펼칠 수 있게.'],
        ['receipt2', '같이 읽고 나서 나가요.', '그럼 마부도 안으로 부르면 안 돼요? 저 사람도 저 때문에 추운데요.'],
        ['receipt3', '집에서 오늘 일을 알게 되면요?', '그럼 제가 도망친 게 아니라고 해야죠. 마부를 내버려 두고 사라진 적은 없어요.'],
      ]),
    },
    finalPromptKo: '',
    final: [
      option('close1', '여기서 같이 읽어요.', '제가 먼저 읽을게요. 저기 있는 의자도 하나 가져와 주세요.'),
      option('close2', '인쇄소에 가 봅시다.', '예카테리나가 일하는 곳이죠? 저도 언젠간 제 손으로 한 장 찍어 보고 싶어요.'),
      option('close3', '마부부터 들어오라고 해요.', '제가 부를게요. 실은 집 밖에서 그 사람 이름을 불러 본 적이 없어요.'),
    ],
  },
  {
    id: 'MAIN01_A02_LEV', questId: 'V47_MAIN01_A02', hostId: 'bookseller_lev',
    sourceIds: ['OBJ-NICHOLAS-MANIFESTO-1848'],
    openingKo: '파리에서 국왕을 내보냈다지. 그 소식 들은 날 외상값 받으러 갔다가 내게 술값도 못 주는 사내한테 국왕 이야기만 실컷 듣고 왔소.',
    firstPromptKo: '레프는 다음 상의 손님을 흘끗 본다.',
    first: [
      option('topic1', '프랑스에선 이제 누구 말을 듣겠소?', '공화국이 섰다 하지 않소. 우리 손님들은 벌써 그 나라 대통령이 될 사람 이름까지 대던데, 그중에 파리에 가 본 사람이 한 명도 없어요.'),
      option('topic2', '파벨은 왜 어머니 얘기를 꺼냈소?', '지난번엔 어머니를 마중하러 혼자 역참까지 갔다오. 마차가 두 대나 들어오는 걸 보고서야 그 집에서 보내 줄 리 없다고 하더군.'),
      option('topic3', '저 손님들도 파리 소식을 들었소?', '저 창가에 앉은 양반 있지. 혁명 소식이 들리자마자 여기 와서 프랑스 소설을 사 갔소. 외상 장부에는 불어로 이름을 적었고.'),
    ],
    branches: {
      topic1: makeBranch('', [
        ['topic11', '여기서도 그런 일이 일어나겠소?', '모르지. 내 생각을 묻는 손님한테는 책이라도 한 권 팔겠는데, 저기 순경한테서 같은 말을 들으면 뭘 내놓아야 할지 모르겠소.'],
      ]),
      topic2: makeBranch('', [
        ['topic21', '어머니를 여기 모셔 올 수 없소?', '집주인 앞으로 가서 편지를 직접 읽어 줄 사람만 있어도 파벨이 따라가겠지요. 내일 장이 안 서면 내가 가든가 하리다.'],
      ]),
      topic3: makeBranch('', [
        ['topic31', '그 양반은 어느 쪽이오?', '책값을 치른 뒤에 물어봅시다. 지금 물으면 내가 외상값을 재촉하는 줄 알 거요.'],
      ]),
    },
    finalPromptKo: '',
    final: [
      option('close1', '기다리는 사람을 먼저 만납시다.', '좋소. 장사가 어려워도 손님을 쫓아내라고 파리에까지 물으러 갈 일은 없지.'),
      option('close2', '인쇄소부터 살펴봅시다.', '예카테리나가 기계를 돌려야 저도 팔 책이 있지. 갑시다.'),
    ],
  },
  {
    id: 'MAIN01_A03_AVDOTYA', questId: 'V47_MAIN01_A03', hostId: 'midwife_avdotya',
    sourceIds: ['V47-PANAEVA-TALNIKOV-CH1-1848'],
    openingKo: '어린 화자는 유모가 모피옷 때문에 울었다고 하는군요. 내가 그 곁에 있었으면 아이를 내려놓을 때 무얼 입고 있었는지부터 보았을 것이오.',
    firstPromptKo: '아브도티야가 원고를 창가에 놓는다.',
    first: [
      option('topic1', '옷을 생각하면서도 아이를 사랑할 수 있어요?', '그럼요. 밤에 내가 받으러 갈 돈 생각도 하는데, 그렇다고 산모를 반만 돌보진 않아요.'),
      option('topic2', '그래도 아버지는 공경해야 하지 않습니까?', '공경하라고 가르치기 전에 아이 손부터 좀 보시오. 매 자국이 나 있으면 그 손으로 성호를 긋기도 힘들어요.'),
      option('topic3', '댁에서도 이런 일을 보셨소?', '산모 보러 갔다가 그 집 큰애 등을 본 적이 있소. 어미는 계단에서 굴렀다고 했어요. 애는 내가 약을 바르는 동안에도 그 계단이 어디 있는지 한마디도 못 하더군요.'),
    ],
    branches: {
      topic1: makeBranch('', [
        ['topic11', '삯을 못 받으면 다시 찾아가세요?', '마님이 다음 산모를 소개해 준다고 하면 망설여지지요. 돈 달라고 다시 갔다가 다음 일까지 잃을까 봐요.'],
      ]),
      topic2: makeBranch('', [
        ['topic21', '그러면 신부가 그 집에 가면 되겠네요.', '사순절마다 가지요. 그날이면 우는 애를 데리고 나온 유모더러 어쩌자고 애를 달래지 못했느냐고 해요. 어쩌다 조용히 있으면 잘 가르쳤다고 주인 어른께 인사를 드리고요.'],
      ]),
      topic3: makeBranch('', [
        ['topic31', '그 애는 다시 보셨소?', '이듬해에 또 부르길래 갔지요. 대문에서 그 애 이름을 댔더니 이번 산모는 그 집 사람이 아니라고 해요. 그날 또 물었어야 했는데.'],
      ]),
    },
    finalPromptKo: '',
    final: [
      option('close1', '밤 일 끝에 식자공들을 불러요.', '좋아요. 선생님만 부르지 말고, 유모 일을 했던 여자도 불러요.'),
      option('close2', '편집실에서 먼저 얘기해요.', '그럼 책을 만드는 사람들 앞에서는 내가 직접 내가 본 집 얘길 할게요.'),
    ],
  },
  {
    id: 'MAIN01_A04_STEPAN', questId: 'V47_MAIN01_A04', hostId: 'print_apprentice_stepan',
    sourceIds: ['V47-PANAEVA-TALNIKOV-CH1-1848'],
    openingKo: '아까 기계를 세울 때는 다들 같이 나가자고 했지요. 문이 열리니 하나둘 안으로 들어가더군요. 저도 들어가려다가 맨 처음 누구더러 나오자고 했는지 생각났어요.',
    firstPromptKo: '스테판은 손가락에서 굳은 잉크를 떼어 낸다.',
    first: [
      option('topic1', '무슨 일이 벌어질 줄 알았어?', '말하기 전에는 주인이 왜 급료가 늦는지 미안해할 줄 알았죠. 왜 미안해할 거라고 생각했는지 지금은 모르겠어요.'),
      option('topic2', '그래도 네가 없으면 작업이 멎잖아.', '오늘은요. 내일은 다른 애를 데려와서 제 자리에 세우겠죠.'),
      option('topic3', '어머니께 품삯 밀린 얘기도 했니?', '꼬박꼬박 받는다고 썼어요. 그 뒤로는 어머니가 2코페이카라도 봉투에 넣어 보내세요. 쓸 일이 없으시다고요.'),
    ],
    branches: {
      topic1: makeBranch('', [
        ['topic11', '넌 동료한테 먼저 물었니?', '아뇨. 제가 먼저 뛰어들면 쫓아올 줄 알았는데.'],
      ]),
      topic2: makeBranch('', [
        ['topic21', '그 애가 오면 무슨 말을 할래?', '여기 사장은 무서운 분이라고요? 그래도 저한테 그 기계를 가르쳐 준 건 예카테리나예요.'],
      ]),
      topic3: makeBranch('', [
        ['topic31', '그 돈을 돌려드렸니?', '아직 두 닢은 있어요. 다른 두 닢으로는 그저께 점심을 먹었고요.'],
      ]),
    },
    finalPromptKo: '',
    final: [
      option('close1', '급료부터 얘기하자.', '제가 말할게요. 제일 늦게 온 애 몫부터요.'),
      option('close2', '기계를 다시 돌리자.', '좋아요. 제가 자리를 뜨기 전에 저 애들한테 조판을 가르쳐 주세요.'),
    ],
  },
  {
    id: 'MAIN01_A05_ALEXEI', questId: 'V47_MAIN01_A05', hostId: 'clerk_alexei',
    sourceIds: ['V47-PANAEV-LETTER-1848-08-20', 'V47-KRYLOV-ASSESSMENT-1848-09-06'],
    openingKo: '크릴로프 검열관이 읽은 데를 보십시오. 「탈니코프 가족」 귀퉁이에 먹물 자국이 있습니다. 콘스탄틴은 그 쪽을 따로 떼면 다른 글이라도 무신푸시킨 각하께 올릴 수 있으리라 여깁니다.',
    firstPromptKo: '알렉세이는 관복 소매를 잡아당긴다.',
    first: [
      option('topic1', '콘스탄틴에게 그 장을 다시 펴 드리시오.', '원로원 광장에서 포를 쏜 쪽도 맞은 쪽도 러시아인인 걸 봤다고 합니다. 그 기억을 빼고 그분과 논쟁할 수는 없지요.'),
      option('topic2', '각하께 파리 얘기를 할 참이오?', '프랑스의 왕은 물러났습니다. 우리는 이 도시에서 누가 아랫사람 앞에 사과하는지부터 알아봐도 좋겠습니다.'),
      option('topic3', '어머니가 불을 켜셨다는 성상 말씀이오.', '예. 그 앞에서 부디 어머니를 건드리지 말아 달라고 빈 뒤, 주인에게도 당신께 빌던 말 그대로 빌었습니다. 어느 쪽에서 더 낮게 말했는지 저도 모르겠군요.'),
    ],
    branches: {
      topic1: makeBranch('', [
        ['topic11', '그래도 아이는 맞고 있잖아요.', '예. 처음엔 아버지가 아이한테 버드나무 가지로 자길 쳐 보라고 시킨 대목만 기억했습니다. 다시 읽어 보니 누나가 동생을 감싸고 엎드렸는데도 아버지는 매질을 멈추지 않더군요.'],
      ]),
      topic2: makeBranch('', [
        ['topic21', '관청에서 누가 한번 그랬습니까?', '아직은 못 봤습니다. 누가 묻기 전까지 저도 그게 이상하다고 생각한 적이 없고요.'],
      ]),
      topic3: makeBranch('', [
        ['topic31', '그래서 지금은 어느 쪽에 비시오?', '오늘은 아무한테도 안 빌겠다고 일찍이 마음먹었습니다. 그런데 명패에 각하 성함이 보이니, 저도 모르게 발을 모았소.'],
      ]),
    },
    finalPromptKo: '',
    final: [
      option('close1', '위원회에서 직접 읽어 드리겠소?', '각하 앞에만 서면 말이 잘 안 나옵니다. 이 대목을 각하께 좀 보여 주시겠습니까? 문밖에서 기다리겠습니다.'),
      option('close2', '일단 밖으로 나갑시다.', '좋습니다. 다음에 돌아와도 지금 했던 말은 할 수 있었으면 좋겠군요.'),
    ],
  },
  {
    id: 'MAIN01_A08_PAVEL', questId: 'V47_MAIN01_A08', hostId: 'courier_pavel',
    sourceIds: ['V47-MUSIN-PUSHKIN-REPORT-MARGIN-NOTE-1848-10-15'],
    openingKo: '풀린 끈이 수레 바퀴 밑으로 들어가는 걸 봤소. 그때부터 한 짝만 요란했지. 초소에서 나온 양반은 끈은 못 보고 내 얼굴을 보더군요.',
    firstPromptKo: '골목 어귀에서 바퀴가 돌을 치는 소리가 난다.',
    first: [
      option('topic1', '지금 따라갈 수 있어?', '저녁 종이 울리기 전에요. 저 말이 큰길까지 가면 저는 아무리 뛰어도 뒤꽁무니만 볼 겁니다.'),
      option('topic2', '왜 그렇게까지 하려고?', '그 꾸러미를 잃으면 레프가 내일 또 제 돈으로 물어 줘요. 지난번엔 안 물어냈다고 내게 거짓말까지 했소.'),
      option('topic3', '레프를 먼저 불러올까?', '그분을 기다리는 동안 수레가 한 바퀴 더 돌겠죠. 그래도 혼자 찾다 혼자 잡혀가는 것보다는 나을 겁니다.'),
    ],
    branches: {
      topic1: makeBranch('', [
        ['topic11', '그럼 어디부터?', '운하 밑에 수레 바퀴가 내려가는 길이 있어요. 먼저 거기 희끄무레한 돌을 봐요.'],
      ]),
      topic2: makeBranch('', [
        ['topic21', '빙판에선 뛰지 마시오.', '운하 내리막은 걸을게요. 거기서 한 번 미끄러져 봤소.'],
      ]),
      topic3: makeBranch('', [
        ['topic31', '같이 가자.', '그럼 물러설 때에도 같이 갑시다. 어느 쪽이든 내가 먼저 말할게요.'],
      ]),
    },
    finalPromptKo: '',
    final: [
      option('close1', '수레 쪽으로 간다.', '운하부터요. 소리 지르지 말고 따라와요.'),
      option('close2', '서점으로 들어간다.', '곧 쫓아올게요. 먼저 문을 열어 줘요.'),
    ],
  },
  {
    id: 'MAIN01_A10_DARYA', questId: 'V47_MAIN01_A10', hostId: 'reader_darya',
    sourceIds: ['V47-PANAEVA-TALNIKOV-CH1-1848'],
    openingKo: '이분 어깨 좀 받쳐 주세요. 그래야 담요를 밑으로 넣지요. 바실리 마차는 방금 안뜰에 왔어요.',
    firstPromptKo: '다리야가 부상자에게 자기 숄을 덮는다.',
    first: [
      option('topic1', '마부를 안으로 부르겠소.', '예. 다 같이 쳐다보지는 말아요. 저분은 이 집 대문 안에 들어와 본 적도 없어요.'),
      option('topic2', '바실리를 부를까요?', '불렀어요. 제가 옆 사람을 받쳐 달라고 하니 제 외투부터 가져다주더군요. 여기서 제일 추운 사람이 저인 줄 알고요.'),
      option('topic3', '이 동네에 다른 마차는 없어요?', '큰길 어귀가 막혀서 안뜰 대문만 열려 있어요. 사람이 나가서 데려오지 않는 한, 마차는 문 앞의 한 대뿐이에요.'),
    ],
    branches: {
      topic1: makeBranch('', [
        ['topic11', '누가 마부와 병원에 가죠?', '마르파 옆에는 제가 앉을게요. 마부한테 내일 같이 주인 만나 줄 사람도 찾아야 해요.'],
      ]),
      topic2: makeBranch('', [
        ['topic21', '어떻게 도우면 돼요?', '제 손이 목 아래에 있지요? 그 밑으로 손을 넣어요. 예, 그렇게.'],
      ]),
      topic3: makeBranch('', [
        ['topic31', '그럼 마부를 안으로 불러요.', '그분도 이 사람을 직접 봐야겠죠. 잠시만요. 제가 문을 열게요.'],
      ]),
    },
    finalPromptKo: '',
    final: [
      option('close1', '안에 있는 사람들과 결정해요.', '좋아요. 모두가 듣는 데서 하죠. 바실리도 다시 부르고요.'),
      option('close2', '아브도티야를 불러요.', '저기 계세요. 안에 있는 사람이 당신을 기다리고 있습니다.'),
    ],
  },
  {
    id: 'MAIN01_A11_EKATERINA', questId: 'V47_MAIN01_A11', hostId: 'printer_ekaterina',
    sourceIds: ['V47-NEKRASOV-SUBSCRIBER-LETTER-1848'],
    openingKo: '책은 결국 못 냈어. 난 아침에 다시 문을 열었는데 들어올 사람이 절반도 안 되더라.',
    firstPromptKo: '예카테리나는 작업대에 찻잔을 하나 더 놓는다.',
    first: [
      option('topic1', '마르파 쪽에서 소식이 왔어요?', '스테판이 갔다 왔어. 내일 아침에 다시 들른다더라. 장화가 다 젖었는데 갈아 신을 게 있는지나 물어볼 걸 그랬네.'),
      option('topic2', '인쇄대의 빈 자리는 어쩌실 거요?', '스테판 것인 줄 알면서도 그 자리에 새 앞치마를 걸었다. 그 애가 제 손을 쓰지 못하면 누구라도 들일 수 있게 말이지. 그 앞치마부터 내가 걷어야지.'),
      option('topic3', '연감 찾는 사람이 아직 있어요?', '아침에 어린 손님이 왔더라. 어머니가 하녀한테 글 가르친다고 싫어하시니 한 장만 달래. 집에 가서 소리 내 읽어 주겠다고.'),
    ],
    branches: {
      topic1: makeBranch('', [
        ['topic11', '마부 소식은 들었어요?', '그 집 일은 그 집 대문에서 좀 물어봐. 스테판이 형 데리고 갈 참이라더라.'],
      ]),
      topic2: makeBranch('', [
        ['topic21', '의견이 다르면요?', '찻물을 좀 더 올려야겠지. 여태 그럴 시간도 안 주고 집에 보냈으니까.'],
      ]),
      topic3: makeBranch('', [
        ['topic31', '그래서 한 장 주셨어요?', '「탈니코프 가족」 첫 장을 줬어. 그 애는 감추지도 않고 들고 나가더라. 담 너머로 안 보일 때까지 문간에 서 있었지.'],
      ]),
    },
    finalPromptKo: '',
    final: [
      option('close1', '다시 문을 열어요.', '그래. 내가 먼저 의자부터 내놓을게.'),
      option('close2', '그 집 앞으로 같이 갑시다.', '장갑 가져와. 이번에는 손님으로 가는 거 아니니까 오래 서 있을지도 몰라.'),
    ],
  },
];

const INDEX = new Map(TRACKS.map(track => [`${track.questId}:${track.hostId}`, track]));

export function main01StoryDialogueTrack({ storyId, questId, hostId }) {
  if (storyId !== 'MAIN01') return null;
  return INDEX.get(`${questId}:${hostId}`) ?? null;
}

export function main01StoryDialogueStage(track, progress = { step: 0 }) {
  const step = Math.max(0, Math.min(3, Number(progress.step) || 0));
  if (step === 0) return { promptKo: track.firstPromptKo, options: track.first };
  if (step === 1) {
    const branch = track.branches[progress.branchId] ?? track.branches[Object.keys(track.branches)[0]];
    return { promptKo: branch.promptKo, options: branch.options };
  }
  if (step === 2) return { promptKo: track.finalPromptKo, options: track.final };
  return { promptKo: '', options: [] };
}

export function advanceMain01StoryDialogue(progress, selectedOption) {
  const next = { ...progress, step: Math.min(3, (Number(progress.step) || 0) + 1) };
  if ((Number(progress.step) || 0) === 0) next.branchId = selectedOption.id;
  if (next.step === 3) next.completed = true;
  return next;
}

export function main01StoryDialogueAllowsAi(progress) {
  return progress?.completed === true && Number(progress.step) >= 3;
}

export const MAIN01_STORY_DIALOGUE_TRACKS = Object.freeze(TRACKS);

export const MAIN01_RETURN_DOORS = Object.freeze([
  { id: 9240, name: '바실리 댁 정문', x: 176, y: 128, step: 'front' },
  { id: 9241, name: '담장 끝 부엌문', x: 144, y: 144, step: 'kitchen' },
]);

export function main01ReturnDoor(state) {
  const flags = state.world.worldFlags ?? {};
  if (!canReturnToMain01Driver(state) || !flags.V47_A11_RETURN_STARTED) return null;
  return MAIN01_RETURN_DOORS[flags.V47_A11_FRONT_DOOR_SEEN ? 1 : 0];
}

export function canReturnToMain01Driver(state) {
  const flags = state.world.worldFlags ?? {};
  return state.world.chapterId === 'V33_1848_PUBLIC' && state.quests?.V47_MAIN01_A11?.status === 'resolved'
    && flags.V47_A10_INJURED_RIDES && !flags.V47_A11_DRIVER_MET;
}

export function attachMain01ReturnDoors(map) {
  const layer = map.layers.find(layer => layer.name === 'Interactions');
  for (const door of MAIN01_RETURN_DOORS) {
    if (layer.objects.some(object => object.id === door.id)) continue;
    layer.objects.push({ id: door.id, name: door.name, x: door.x, y: door.y, width: 16, height: 16,
      type: 'inspectable', visible: true, properties: [{ name: 'v47DriverDoor', type: 'string', value: door.step },
        { name: 'assetTileId', type: 'int', value: 13 }] });
  }
  map.nextobjectid = Math.max(map.nextobjectid ?? 1, MAIN01_RETURN_DOORS.at(-1).id + 1);
}
