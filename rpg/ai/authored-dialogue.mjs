// Project-authored dialogue, not historical quotation or literary borrowing.
// Fictional voices draw on their checked-in character cards. Reconstruction
// voices paraphrase only the scene's existing allowed source records.
export const conversations = {
  clerk_alexei: {
    provenance: ['rpg/characters/clerk_alexei.json'],
    opening: '한 장씩 올려 주세요. 수신인과 접수 번호부터 보겠습니다.',
    closing: '그럼 저는 접수하던 것부터 마저 보겠습니다.',
    topics: [
      ['번호만 맞으면 접수해도 됩니까?', '번호를 보고 원본과 사본을 대조해야 합니다. 한쪽만 보면 빠뜨리기 쉬워요.'],
      ['이름을 잘못 옮기면 어떻게 하죠?', '제가 고쳐야죠. 그러니 원본과 한 번 더 맞춰 봅니다.'],
      ['상급자 지시와 확인한 사실이 다르면 장부에는 어떻게 적어야 합니까?', '둘을 한 문장으로 섞어 쓰면 안 됩니다. 지시는 누가 했는지, 확인한 사실은 무엇인지 따로 남겨야 해요.'],
    ],
  },
  printer_ekaterina: {
    provenance: ['rpg/characters/printer_ekaterina.json'],
    opening: '잠깐 종이 끝을 잡아줘요. 글자가 가려졌네. 어느 줄을 보러 왔어요?',
    closing: '얘기는 여기까지 하고, 난 이 줄 좀 더 볼게요.',
    topics: [
      ['원문을 옆에 놓고 같이 볼까요?', '그래요. 교정쇄만 들여다보면 틀린 글자도 맞는 것처럼 보여요. 한 줄씩 짚어봐요.'],
      ['급하면 일단 넘겨도 되지 않아요?', '틀리면 누가 다시 찍어요? 종이도 버리고, 나도 같은 일을 두 번 해야 하는데.'],
      ['검열 뒤에 돌아온 문장은 작업자도 책임져야 할까요?', '내가 찍은 글자는 책임져야죠. 그렇다고 그 뜻까지 내가 정했다고 하면 곤란해요. 누가 고쳤는지는 남겨야 해요.'],
    ],
  },
  courier_pavel: {
    provenance: ['rpg/characters/courier_pavel.json'],
    opening: '잠깐 쉬는 중이에요. 맡은 봉투는 수취인에게 전한 뒤에 얘기할 수 있어요.',
    closing: '자, 난 이제 길을 나서야겠어요. 또 만나면 얘기해요.',
    topics: [
      ['받는 사람부터 확인해요.', '맞아요. 이름이랑 주소요. 잘못 찾아가면 되돌아오는 길도 내 몫이거든요.'],
      ['안에 무슨 말이 들었을까요?', '글쎄요. 봉한 채로 받았어요. 궁금하다고 열었다간 배달할 때 할 말이 없잖아요.'],
      ['봉투 안을 모른 채 전했다면, 전달한 사람은 어디까지 책임져야 합니까?', '내가 책임질 건 맡은 봉투를 제대로 전하는 일이에요. 안에 든 말까지 안다고 할 순 없죠.'],
    ],
  },
  seamstress_anna: {
    provenance: ['rpg/characters/seamstress_anna.json'],
    opening: '무슨 일로 왔어요? 지금 마무리할 소매가 있어서 길게는 못 얘기해요.',
    closing: '이제 손을 좀 놀려야겠어요. 얘기하느라 일이 밀렸네.',
    topics: [
      ['수선값을 아직 못 받았어요?', '아직요. 수선은 다 했는데, 돈은 받아야죠.'],
      ['급한 일부터 하면 되겠네요.', '금방 끝낼 수 있는 것부터요. 하루 종일 붙들고도 오늘 값을 못 받으면 곤란해요.'],
      ['큰 사상 논쟁이 일하는 사람의 하루도 바꿀까요?', '글쎄요, 논쟁이 오늘 품삯을 주진 않잖아요. 그래도 누가 일하고 누가 가져가는지 말하기 시작하면, 아주 남의 일은 아니겠죠.'],
    ],
  },
  tenant_mikhail: {
    provenance: ['rpg/characters/tenant_mikhail.json'],
    opening: '일자리를 찾으러 다니는 중이에요. 혹시 오늘 하루 품을 쓰는 곳을 봤어요?',
    closing: '붙잡아서 미안해요. 나도 일자리 좀 더 찾아볼게요.',
    topics: [
      ['방세는 언제까지예요?', '내일까지요. 오늘 품을 팔면 어떻게 맞춰볼 텐데… 아직 못 구했어요.'],
      ['집주인에게 하루 더 달라고 해봐요.', '말은 해봐야죠. 그런데 언제 낼 수 있느냐고 하면… 뭐라고 답하겠어요.'],
      ['가난은 게으른 탓이라고 생각하세요?', '그건 잘 모르겠어요. 오늘 일자리를 찾으러 다녔는데 아직 못 찾았다는 것만은 분명해요.'],
    ],
  },
  bookseller_lev: {
    provenance: ['rpg/characters/bookseller_lev.json'],
    opening: '찾는 책이 있소? 새로 온 묶음은 수량부터 세야 하오.',
    closing: '그럼 천천히 보고 가시오. 난 묶음 수를 좀 세야겠소.',
    topics: [
      ['외상으로 가져가도 될까요?', '갚을 날짜부터 정합시다. 값만 정하고 언제 갚을지 안 정하면 서로 곤란하오.'],
      ['반품 기한이 남았나요?', '아직 남았소. 그래도 돌려보낼 것은 미리 묶어야지. 마지막 날까지 쌓아둘 순 없소.'],
      ['책값 때문에 못 읽는 사람이 있다면 값을 낮춰야 하오?', '값을 낮추면 책을 더 집을 수 있겠지. 하지만 외상과 인쇄비도 장부에 남소. 선의만으로 값을 정할 순 없소.'],
    ],
  },
  literary_chichikov: {
    provenance: ['LIT-GOGOL-DEAD-SOULS-1842', 'rpg/characters/literary_chichikov.json'],
    opening: '여관 장부에 이름을 적으시는 거라면, 말씀드리겠습니다.',
    closing: '그럼 장부는 부탁드리겠습니다.',
    topics: [
      ['이름을 다시 확인해도 될까요?', '파벨 이바노비치 치치코프입니다.'],
      ['관등도 적어야 합니다.', '콜레기아 고문입니다.'],
      ['저 마차로 오셨습니까?', '그렇습니다. 여관 앞까지 타고 왔지요.'],
    ],
  },
  literary_petrovich: {
    provenance: ['LIT-GOGOL-OVERCOAT-1842'],
    opening: '외투를 좀 봅시다. 등하고 어깨가 많이 닳았군요.',
    closing: '이 외투는 고치기 어렵소.',
    topics: [
      ['어디가 제일 심한가요?', '등하고 어깨요. 보시오, 천이 다 비치잖소.'],
      ['안감만 고치면 안 될까요?', '안감은 터지고 겉감은 닳았소. 안감만 손봐서는 소용없소.'],
      ['조금만 더 입을 수는 없을까요?', '덧대 봐야 오래 못 입소.'],
    ],
  },
  nekrasov_reconstruction: {
    provenance: ['OBJ-WS-NEKRASOV-EDITORIAL-1848', 'OBJ-WS-NEKRASOV-1849-ISSUE-NOTICE'],
    opening: '발송 공고를 찾으시는군요. 날짜와 재발송 안내는 여기에 적혀 있습니다.',
    closing: '수령 확인과 재발송 안내는 공고에 적어두었습니다.',
    topics: [
      ['발송이 늦어진 건가요?', '발송 사정은 공고에 적었습니다. 먼저 그 날짜부터 확인해 보시죠.'],
      ['받지 못한 호는 어떻게 합니까?', '편집부에서 받으셨는지 확인하고 조사할 겁니다. 공고에도 그렇게 밝혔고요.'],
      ['분실한 호는 다시 보내줍니까?', '받지 못한 호는 편집부가 확인한 뒤 다시 보내도록 했습니다.'],
    ],
  },
};

export function contextualOpening(hostId, actorHostId) {
  if (hostId === 'seamstress_anna') {
    if (actorHostId === 'clerk_alexei') return '관청에서 오셨어요? 수선값을 받으러 온 건 아니죠. 지금 끝낼 소매가 있어요.';
    if (['tenant_mikhail','courier_pavel','bookseller_lev'].includes(actorHostId)) return '무슨 일이야? 오늘 품삯을 받아야 해서 오래 얘기하긴 어려워.';
    return conversations[hostId].opening;
  }
  if (hostId === 'printer_ekaterina' && actorHostId === 'clerk_alexei') return '서류는 작업대 끝에 두세요. 어느 줄을 확인하러 오셨어요?';
  if (hostId === 'courier_pavel' && actorHostId === 'seamstress_anna') return '배달 나가기 전에 잠깐 쉬는 중이야. 무슨 일이야?';
  return conversations[hostId]?.opening ?? '무슨 일인지 말씀해 주세요.';
}

export function availableTopics(hostId, heard = []) {
  return (conversations[hostId]?.topics ?? []).filter(([question]) => !heard.includes(question)).map(([question]) => question);
}

export function authoredReply(hostId, playerText, heard = []) {
  const conversation = conversations[hostId];
  if (!conversation) return null;
  const match = conversation.topics.find(([question]) => question === playerText && !heard.includes(question));
  const nextHeard = match ? [...heard, match[0]] : [...heard];
  const replies = availableTopics(hostId, nextHeard);
  const lower = String(playerText).toLocaleLowerCase('ko');
  const intent = /사상|농노|검열|책값|읽을 권리|논쟁|책임|가난/.test(lower) ? 'viewpoint'
    : /품삯|방세|돈|값|일감|일자리|급여|일은 많|일이 많|오늘 일|일 많/.test(lower) ? 'livelihood'
    : /문서|자료|문장|원문|교정|이름|편지|장부|공고|기록/.test(lower) ? 'work'
      : /걱정|가족|관계|상급|사람|생각|기분|어떻/.test(lower) ? 'personal' : 'unknown';
  const localReplies = {
    clerk_alexei: { viewpoint: '지시와 사실을 한데 적으면 나중에 누구 판단이었는지 흐려집니다. 둘을 나눠 기록하는 편이 맞아요.', livelihood: '돈 문제는 접수 순서부터 봐야 합니다. 제가 직접 맡은 기록이라면 확인해 드리죠.', work: '원본과 사본을 대조해 봅시다. 제가 확인하지 않은 이름은 장부에 옮길 수 없습니다.', personal: '그 일은 쉽게 말하기 어렵네요. 우선 제가 맡은 서류부터 끝내야 합니다.' },
    printer_ekaterina: { viewpoint: '찍은 글자는 내 일이에요. 하지만 누가 문장을 고쳤는지까지 흐리면 그건 공평하지 않죠.', livelihood: '품삯은 밀리면 곤란하죠. 내 몫과 작업량은 분명히 적어두려고 해요.', work: '원문을 옆에 놓고 봐요. 내가 확인한 줄까지만 책임질게요.', personal: '그 얘긴 잘 모르겠어요. 지금은 이 문장부터 제대로 읽고 싶어요.' },
    courier_pavel: { viewpoint: '봉투를 온전히 전하는 건 내 몫입니다. 안에 무슨 말이 있는지 모르는 건 모른다고 해야죠.', livelihood: '배달 건마다 품삯이 달라요. 오늘 맡은 봉투부터 전하고 봐야죠.', work: '내가 아는 건 봉투를 받은 곳과 전할 곳뿐이에요. 안은 열어보지 않았습니다.', personal: '길에서 만난 사람들 사정까지는 잘 몰라요. 내가 직접 본 일만 말할게요.' },
    seamstress_anna: { viewpoint: '큰말이 밥을 주진 않아요. 그래도 일한 만큼 받는 게 당연하다는 말부터는 해야죠.', livelihood: '수선은 끝냈어요. 아직 값을 못 받아서 오늘은 그 얘기부터 해야 해요.', work: '그 문서에 누가 뭘 썼는지는 몰라요. 내가 맡은 옷과 품삯에 대해서는 말할 수 있어요.', personal: '그 사람 얘기는 내가 대신 하지 않을게요. 내 일은 내가 본 만큼만 말할게요.' },
    tenant_mikhail: { viewpoint: '그런 이론은 잘 모릅니다. 일을 구하러 돌아다녀도 오늘은 아직 품을 못 팔았어요. 그건 제가 겪은 일이에요.' , livelihood: '오늘 일자리를 아직 못 구했어요. 방세가 내일까지라 마음이 급합니다.', work: '그 일은 직접 보지 못했어요. 내가 아는 건 오늘 품을 구하려고 돌아다닌다는 것뿐이에요.', personal: '집안 사정은 말하기 조심스럽네요. 그래도 일자리는 계속 찾고 있어요.' },
    bookseller_lev: { viewpoint: '읽을 기회는 넓혀야 하오. 다만 종이값과 인쇄한 사람 몫도 있으니 누가 부담할지 함께 정해야 하오.', livelihood: '외상은 갚을 날짜부터 정해야 하오. 장부에 적힌 값은 확인해 드리지.', work: '책과 잡지의 인쇄 내용은 보여드릴 수 있소. 묶음은 허락 없이 풀 수 없소.', personal: '남의 사정은 내가 함부로 옮기지 않소. 여기 놓인 책 얘기라면 같이 볼 수 있지.' },
    nekrasov_reconstruction: { livelihood: '발송 비용과 구독료는 장부에 적힌 범위에서 확인할 수 있습니다.', work: '공고에 적힌 발행과 재발송 일정은 확인해 드리겠습니다. 적히지 않은 사정은 단정할 수 없습니다.', personal: '개인의 사정은 대신 말하지 않겠습니다. 편집부가 확인한 공고를 먼저 보시죠.' },
    literary_chichikov: { livelihood: '여관의 비용은 장부에 적으시면 됩니다. 제가 낸 돈의 범위라면 답하지요.', work: '이름과 관등은 말씀드렸습니다. 장부에는 들은 그대로 적어 주십시오.', personal: '그런 속내까지 말할 사이는 아니지요. 필요한 사항만 확인하시면 됩니다.' },
    literary_akaky: { livelihood: '그렇게 큰돈은 없습니다. 외투를 고칠 수 있는지부터 알아보려 합니다.', work: '제 외투와 수선 이야기는 답할 수 있습니다. 다른 사람 일은 잘 모릅니다.', personal: '저는 그런 말을 잘 하지 못합니다. 외투 얘기로 돌아가도 될까요?' },
    literary_petrovich: { livelihood: '새 외투에는 돈이 꽤 들겠소. 수선값과 천값부터 따져야 하오.', work: '등과 어깨 천이 닳았소. 내가 본 외투 상태는 그게 전부요.', personal: '남의 속은 모르오. 천이 얼마나 해졌는지는 보여줄 수 있소.' },
  };
  const text = match ? match[1] : replies.length ? (localReplies[hostId]?.[intent] ?? localReplies[hostId]?.unknown ?? '그건 내가 직접 본 일이 아니에요.') : conversation.closing;
  return {
    text,
    speakerId: hostId,
    heard: nextHeard,
    replies,
    complete: replies.length === 0,
  };
}
