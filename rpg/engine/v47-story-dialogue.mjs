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
      option('ledger', '댁의 마차를 기다리게 해도 되겠소?', '제가 늦으면 말이 서고, 말이 늦으면 아버님은 마부를 부르세요. 집에서는 저를 기다렸다는 말도 마부가 먼저 듣는답니다.'),
      option('printer', '뭘 읽고 싶으세요?', '신문을요. 우리 집 저녁상에선 아버님이 성내시는 곳에만 세상이 있어요. 그분이 신문을 접으시면 거기서 끝이고요.'),
      option('receipt', '밖의 마차는 댁에서 온 겁니까?', '네, 우리 집 마부예요. 아버지가 나오라면 저보다 먼저 맞을 사람이죠.'),
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
      option('topic1', '황제 없이 나라도 굴러갈까요?', '굴러가는 일과 누구 밑으로 굴러가느냐는 별개요. 프랑스에서 새로 좋은 자리에 앉은 사람들도 그쯤은 알 거요.'),
      option('topic2', '파벨의 이야기는 어떻게 들었소?', '파벨은 프랑스에 별 관심 없소. 오늘이 지나면 엊그제 못 본 사람을 또 못 보게 될 뿐이니까.'),
      option('topic3', '다른 손님들은 무슨 생각이오?', '그 친구들은 내가 파리 책을 잘 판다고 서구파래요. 빚 독촉할 땐 아주 러시아 사람처럼 대하면서.'),
    ],
    branches: {
      topic1: makeBranch('', [
        ['topic11', '러시아도 바뀌어야 하지 않소?', '모르겠소. 올해도 어머니가 영지에서 못 나오면, 내년에도 모른다고 할 여유는 없겠지.'],
      ]),
      topic2: makeBranch('', [
        ['topic21', '그 사람을 여기 데려올 수 없소?', '곁에 데려와서 저 아이한테 손님들 술만 따르게 하고 싶지는 않구먼.'],
      ]),
      topic3: makeBranch('', [
        ['topic31', '당신은 어느 쪽이오?', '잘 물었소. 이번엔 아무 모자도 쓰지 않고 밖에 나가 보려오.'],
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
      option('topic2', '교회에선 아버지를 공경하라고 하잖아요.', '맞아요. 한데 이웃도 사랑하라는데 아버지가 이웃의 아이를 때리면요? 교회 문턱에는 그 아이도 올라요.'),
      option('topic3', '러시아의 집에서는 다 이런 일이 벌어져요?', '다 그렇다고 하면 이 책을 집어 던질 사람이 많겠죠. 나는 저 집이 하나만 있어도 문을 두드려야 한다는 말이에요.'),
    ],
    branches: {
      topic1: makeBranch('', [
        ['topic11', '받을 몫을 요구하면 뭐라던가요?', '우리 동네에선 돈 내기 싫으면 어김없이 나더러 사람 살리는 일에 왜 값을 매기느냐고 해요.'],
      ]),
      topic2: makeBranch('', [
        ['topic21', '그러면 신부가 그 집에 가면 되겠네요.', '사순절마다 가지요. 신부님 오시는 날이면 우는 아이는 뒷방에 데려다 놓소. 그 집에선 조용한 것부터 축복을 받거든요.'],
      ]),
      topic3: makeBranch('', [
        ['topic31', '누가 함께 가 줄까요?', '읽을 줄 아는 사람만 부르지 말아요. 어느 방에 아이가 있는지는 유모가 알죠.'],
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
    openingKo: '아까 기계를 세울 땐 다들 같은 분 앞에 설 줄 알았지요. 예카테리나가 문을 열고 호통을 안 치니 오히려 저 혼자 문밖에 남았소.',
    firstPromptKo: '스테판은 손가락에서 굳은 잉크를 떼어 낸다.',
    first: [
      option('topic1', '무슨 일이 벌어질 줄 알았어?', '말하기 전에는 주인이 왜 급료가 늦는지 미안해할 줄 알았죠. 왜 미안해할 거라고 생각했는지 지금은 모르겠어요.'),
      option('topic2', '그래도 네가 없으면 작업이 멎잖아.', '오늘은요. 내일은 다른 애를 데려와서 제 자리에 세우겠죠.'),
      option('topic3', '네 어머니 이야기는 했어?', '했어요. 주인 없는 나라가 오면 어머니가 쉬실 줄 알았다고요. 그런데 집에 돌아가면 제일 먼저 부르는 사람이 나예요.'),
    ],
    branches: {
      topic1: makeBranch('', [
        ['topic11', '넌 동료한테 먼저 물었니?', '아뇨. 제가 먼저 뛰어들면 쫓아올 줄 알았는데.'],
      ]),
      topic2: makeBranch('', [
        ['topic21', '그 애가 오면 무슨 말을 할래?', '여기 사장은 무서운 분이라고요? 그래도 저한테 그 기계를 가르쳐 준 건 예카테리나예요.'],
      ]),
      topic3: makeBranch('', [
        ['topic31', '어머니는 뭐라고 하셨는데?', '불렀으면 심부름은 내가 하고 어머니가 좀 앉아 계셔야 한대요.'],
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
        ['topic11', '그래도 아이는 맞고 있잖아요.', '예. 마지막 장을 덮으면 우리 방은 조용해집니다. 그 댁 식당도 조용했지요. 아이가 우는 방은 식당에서 멀었으니까요.'],
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
      option('close1', '위원회에서 말씀하십시오.', '잠깐 밖에서 기다려 주시겠습니까? 혼자 들어갈 수는 있어도 혼자 나오고 싶지는 않습니다.'),
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
      option('topic2', '왜 그렇게까지 하려고?', '레프한테서 그만두라는 말을 듣기까지는 내가 달려도 좋을지 물어 볼 생각이었어요. 물어 봤으면 오늘도 멈췄겠죠.'),
      option('topic3', '레프를 먼저 불러올까?', '그분을 기다리는 동안 수레가 한 바퀴 더 돌겠죠. 그래도 혼자 찾다 혼자 잡혀가는 것보다는 나을 겁니다.'),
    ],
    branches: {
      topic1: makeBranch('', [
        ['topic11', '그럼 어디부터?', '운하 밑에 수레 바퀴가 내려가는 길이 있어요. 먼저 거기 희끄무레한 돌을 봐요.'],
      ]),
      topic2: makeBranch('', [
        ['topic21', '다칠 수도 있어.', '알아요. 그 소리는 아까부터 내 마음속에서도 하고 있습니다.'],
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
    openingKo: '이분 어깨에 손 좀 받쳐 주겠어요? 바실리의 마차는 왔는데 저 혼자서는 담요도 못 펴겠소.',
    firstPromptKo: '다리야가 부상자에게 자기 숄을 덮는다.',
    first: [
      option('topic1', '마부를 안으로 부르겠소.', '부르세요. 손님 앞에선 저분을 보고 털모자부터 벗으라던 집이오. 여기서는 모자를 벗으라고 아무도 말하지 마세요.'),
      option('topic2', '바실리에게 이 손을 받으라 하시오.', '그러려 했어요. 아까 저한테 손을 내밀 때는 그 손이 꽤 따뜻했는데, 이분이 손을 찾으니까 방 건너에 서 있지 뭡니까.'),
      option('topic3', '이 동네에 다른 마차는 없어요?', '큰길 어귀가 막혀서 안뜰 대문만 열려 있어요. 사람이 나가서 데려오지 않는 한, 마차는 문 앞의 한 대뿐이에요.'),
    ],
    branches: {
      topic1: makeBranch('', [
        ['topic11', '누가 마부와 같이 가죠?', '저요. 그리고 내일 정문까지 와 줄 사람이 있어야 해요. 먼저 맞서는 사람이 필요하잖아요.'],
      ]),
      topic2: makeBranch('', [
        ['topic21', '당신이라면?', '제 손이 이분 목 아래에 있어요. 대답해야 한다면 당신이 잠깐만 이 손을 대신해 주오.'],
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
      option('topic1', '마르파 쪽에서 소식이 왔어요?', '스테판이 갔다 왔어. 나도 참. 추운 데 다녀온 애한테 남의 안부부터 내놓으랬네. 장화 밑에서 녹은 눈이 다 마를 때까지 그 애 앞에 찻잔 하나 없더라.'),
      option('topic2', '인쇄대의 빈 자리는 어쩌실 거요?', '스테판 것인 줄 알면서도 그 자리에 새 앞치마를 걸었다. 그 애가 제 손을 쓰지 못하면 누구라도 들일 수 있게 말이지. 그 앞치마부터 내가 걷어야지.'),
      option('topic3', '이 책은 결국 누구를 위한 거였죠?', '어느 집 아이가 읽었으면 했어. 그 아이가 읽고 나서 자기 방에서 걸쇠를 알아볼 수 있기를 바랐지.'),
    ],
    branches: {
      topic1: makeBranch('', [
        ['topic11', '마부도 다시 찾아가 보실 거요?', '이제 내가 가 볼게. 어제는 마부를 찾아가 놓고도, 집 대문을 보자 나도 모르게 내가 아는 이쪽 문부터 열었어.'],
      ]),
      topic2: makeBranch('', [
        ['topic21', '의견이 다르면요?', '찻물을 좀 더 올려야겠지. 여태 그럴 시간도 안 주고 집에 보냈으니까.'],
      ]),
      topic3: makeBranch('', [
        ['topic31', '집을 떠나게 하려고요?', '떠날지 남을지는 그 아이가 정해야지. 누가 앞에서 먼저 정해 주면 그 집 안에서 하던 일하고 똑같잖아.'],
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
