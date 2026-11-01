// Project-authored dialogue, not historical quotation or literary borrowing.
// Fictional voices draw on their checked-in character cards. Reconstruction
// voices paraphrase only the scene's existing allowed source records.
export const conversations = {
  clerk_alexei: {
    provenance: ['rpg/characters/clerk_alexei.json'],
    opening: '잠깐만요. 이 서류부터 내려놓고요. 무슨 일입니까?',
    closing: '그럼 저는 접수하던 것부터 마저 보겠습니다.',
    topics: [
      ['번호부터 보면 될까요?', '네. 맨 위의 번호부터 보시죠. 그다음에 원본과 사본이 맞는지 확인하면 됩니다.'],
      ['이름 하나 적는 데도 조심스럽네요.', '잘못 옮기면 고치는 건 제 몫이니까요. 이름은 한 번 더 봅니다.'],
      ['담당자가 없으면 어떻게 하죠?', '받을 사람이 없으면 두겠습니다. 그냥 넘겼다가 어디 갔냐고 물으면 제가 답해야 하니까요.'],
    ],
  },
  printer_ekaterina: {
    provenance: ['rpg/characters/printer_ekaterina.json'],
    opening: '잠깐, 종이 끝만 잡아줘요. 글자가 가려져서. 어느 줄을 보러 왔어요?',
    closing: '얘기는 여기까지 하고, 난 이 줄 좀 더 볼게요.',
    topics: [
      ['원문을 옆에 놓고 같이 볼까요?', '그래요. 교정쇄만 들여다보면 틀린 글자도 맞는 것처럼 보여요. 한 줄씩 짚어봐요.'],
      ['급하면 일단 넘겨도 되지 않아요?', '틀리면 누가 다시 찍어요? 종이도 버리고, 나도 같은 일을 두 번 해야 하는데.'],
      ['어디까지 책임져야 하는 거예요?', '내가 본 줄까지요. 안 본 문장에 내 이름을 붙이는 건 싫어요.'],
    ],
  },
  courier_pavel: {
    provenance: ['rpg/characters/courier_pavel.json'],
    opening: '봉투는 여기 있어요. 어디로 가져가면 돼요?',
    closing: '자, 난 이제 길을 나서야겠어요. 또 만나면 얘기해요.',
    topics: [
      ['받는 사람부터 확인해요.', '맞아요. 이름이랑 주소요. 잘못 찾아가면 되돌아오는 길도 내 몫이거든요.'],
      ['안에 무슨 말이 들었을까요?', '글쎄요. 봉한 채로 받았어요. 궁금하다고 열었다간 배달할 때 할 말이 없잖아요.'],
      ['비가 오면 봉투는 어떻게 해요?', '품에 넣어야죠. 옷은 젖어도 종이까지 젖으면 안 되니까.'],
    ],
  },
  seamstress_anna: {
    provenance: ['rpg/characters/seamstress_anna.json'],
    opening: '수선 맡기러 왔어요? 어디가 터졌는지부터 보여줘요.',
    closing: '이제 손을 좀 놀려야겠어요. 얘기하느라 일이 밀렸네.',
    topics: [
      ['수선값을 아직 못 받았어요?', '아직요. 수선은 다 했는데, 돈은 받아야죠.'],
      ['급한 일부터 하면 되겠네요.', '금방 끝낼 수 있는 것부터요. 하루 종일 붙들고도 오늘 값을 못 받으면 곤란해요.'],
      ['하루쯤 쉬어도 괜찮지 않아요?', '나도 쉬고 싶죠. 방세 낼 날은 그대로인데 어쩌겠어요.'],
    ],
  },
  tenant_mikhail: {
    provenance: ['rpg/characters/tenant_mikhail.json'],
    opening: '혹시 사람 쓰는 데 못 봤어요? 하루 품이라도 괜찮은데.',
    closing: '붙잡아서 미안해요. 나도 일자리 좀 더 찾아볼게요.',
    topics: [
      ['방세는 언제까지예요?', '내일까지요. 오늘 품을 팔면 어떻게 맞춰볼 텐데… 아직 못 구했어요.'],
      ['집주인에게 하루 더 달라고 해봐요.', '말은 해봐야죠. 그런데 언제 낼 수 있느냐고 하면… 뭐라고 답하겠어요.'],
      ['이웃에게 일거리를 물어볼까요?', '그래 주면 고맙죠. 다들 바쁠 텐데 괜히 붙잡는 건 아닌가 싶기도 하고요.'],
    ],
  },
  bookseller_lev: {
    provenance: ['rpg/characters/bookseller_lev.json'],
    opening: '잡지를 보러 왔소? 묶음은 풀기 전에 말해주시오.',
    closing: '그럼 천천히 보고 가시오. 난 묶음 수를 좀 세야겠소.',
    topics: [
      ['외상으로 가져가도 될까요?', '갚을 날짜부터 정합시다. 값만 정하고 언제 갚을지 안 정하면 서로 곤란하오.'],
      ['반품 기한이 남았나요?', '아직 남았소. 그래도 돌려보낼 것은 미리 묶어야지. 마지막 날까지 쌓아둘 순 없소.'],
      ['많이 내놓으면 더 팔리지 않을까요?', '팔리기만 하면 좋지요. 안 팔리면 저 묶음들이 다 자리만 차지하오. 그래서 이만큼만 내놓는 거요.'],
    ],
  },
  literary_chichikov: {
    provenance: ['LIT-GOGOL-DEAD-SOULS-1842', 'rpg/characters/literary_chichikov.json'],
    opening: '장부에 적으시려고요? 말씀드리지요.',
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
    opening: '잡지를 받지 못하셨습니까? 발송에 관한 공고를 보시죠.',
    closing: '수령 확인과 재발송 안내는 공고에 적어두었습니다.',
    topics: [
      ['발송이 늦어진 건가요?', '발송 사정은 공고에 적었습니다. 먼저 그 날짜부터 확인해 보시죠.'],
      ['받지 못한 호는 어떻게 합니까?', '편집부에서 받으셨는지 확인하고 조사할 겁니다. 공고에도 그렇게 밝혔고요.'],
      ['분실한 호는 다시 보내줍니까?', '받지 못한 호는 편집부가 확인한 뒤 다시 보내도록 했습니다.'],
    ],
  },
};

export function availableTopics(hostId, heard = []) {
  return (conversations[hostId]?.topics ?? []).filter(([question]) => !heard.includes(question)).map(([question]) => question);
}

export function authoredReply(hostId, playerText, heard = []) {
  const conversation = conversations[hostId];
  if (!conversation) return null;
  const match = conversation.topics.find(([question]) => question === playerText && !heard.includes(question));
  const nextHeard = match ? [...heard, match[0]] : [...heard];
  const replies = availableTopics(hostId, nextHeard);
  return {
    text: match ? match[1] : replies.length ? '잠시 말이 끊겼다. 다른 이야기를 꺼내 볼까.' : conversation.closing,
    speakerId: match || !replies.length ? hostId : 'NARRATION',
    heard: nextHeard,
    replies,
    complete: replies.length === 0,
  };
}
