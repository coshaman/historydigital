import { readFile, writeFile } from 'node:fs/promises';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const scenesData = await read('../rpg/data/historical-scene-play.json');
const catalog = await read('../rpg/data/v38-historical-events.json');
const conversations = await read('../rpg/data/historical-conversation-choices.json');

const expansions = {
  SENATE_SQUARE_1825: {
    actors: [
      { id: 'bread_carrier', templateId: 'porter_gavrila', nameKo: '짐꾼 안드레이', objectiveId: 'carry_family_supplies', occupationKo: '가게 짐과 집안 물건을 나르는 짐꾼', introductionKo: '광장에 남은 가족에게 담요와 빵을 가져가려 한다.', lines: ['수레는 돌렸는데, 천과 빵을 누가 가져갈지 정해야겠소.', '가족마다 짐이 다르오. 한 번에 다 옮길 수는 없소.'] },
      { id: 'medical_runner', templateId: 'midwife_avdotya', nameKo: '산파 다리야', objectiveId: 'organize_aid', occupationKo: '산파', introductionKo: '다친 사람과 아이들을 한꺼번에 돌볼 수 없어 우선순위를 세운다.', lines: ['아이를 안은 사람부터 강변으로 보내야 해요. 다친 사람도 길을 비켜야 하고요.', '붕대는 모자랍니다. 누구를 먼저 옮겼는지 기억해 두세요.'] },
      { id: 'courtyard_keeper', templateId: 'landlady_polina', nameKo: '하숙집 주인 마트료나', objectiveId: 'decide_shelter_limit', occupationKo: '도시 하숙집 주인', introductionKo: '안뜰 문을 열지, 가족과 세든 사람만 들일지 판단해야 한다.', lines: ['문을 열면 사람을 더 들일 수는 있어요. 방은 이미 찼지만요.', '누구든 들이면 군인들도 이 안뜰을 알게 됩니다. 그래도 문을 잠글까요?'] },
    ],
    objectives: [
      { id: 'carry_family_supplies', titleKo: '남은 가족에게 무엇을 가져갈지 정한다', actionKo: '짐꾼과 가게 주인에게 담요와 식량을 나눠 달라고 한다' },
      { id: 'organize_aid', titleKo: '다친 사람과 아이들의 이동 순서를 정한다', actionKo: '산파·의학생·퇴역병과 들것 및 피난길을 나눈다' },
      { id: 'decide_shelter_limit', titleKo: '안뜰에 누가 들어올지 결정한다', actionKo: '하숙집 주인과 세든 사람의 안전과 피난처를 의논한다' },
    ],
    actions: [
      { id: 'senate-approach-family-load', mapId: 'senate-approach', requiredActorId: 'bread_carrier', objectiveId: 'carry_family_supplies', propKo: '빵과 담요가 든 수레', promptKo: '짐꾼은 남은 가게 물품을 가족들에게 나눌 수 있지만, 어느 골목으로 옮길지 기다리고 있습니다.', gatherActorIds: ['bread_carrier','cobbler','coachman','fishseller'], options: [
        { id: 'split-load', labelKo: '빵은 아이들에게, 담요는 안뜰에 나눈다', directionKo: '짐꾼과 가게 사람들, 피난 가족이 압니다 · 당장 쓸 물건을 나눕니다 · 한 집에 모아 두기는 어렵습니다', textKo: '빵과 담요를 나누어 각각 피난길과 안뜰로 보냈다', effects: { familySupplies: 'split' }, groupReactionKo: '짐꾼 안드레이  빵은 아이들 쪽으로 먼저 보내겠소.\n구두장이 미하일  담요는 안뜰에 두고, 돌아오는 사람에게 나눠 줍시다.' },
        { id: 'keep-load-together', labelKo: '수레를 한 곳에 두고 인원을 붙인다', directionKo: '짐꾼과 마차꾼이 압니다 · 물품을 한 번에 지킵니다 · 수레가 좁은 길을 막을 수 있습니다', textKo: '물품을 수레에 둔 채 지킬 사람을 붙였다', effects: { familySupplies: 'guarded' }, groupReactionKo: '마차꾼 로만  수레를 세울 자리는 강변 쪽에 있소.\n생선 장수 클라브디야  아이들 몫은 따로 표시해 둬요.' },
      ] },
      { id: 'senate-square-aid-line', mapId: 'senate-square', requiredActorId: 'medical_runner', objectiveId: 'organize_aid', propKo: '들것과 붕대가 놓인 자리', promptKo: '다친 사람, 아이를 잃은 가족, 광장을 빠져나가려는 행인이 한 길목에 몰렸습니다. 누가 먼저 움직일지 정해야 합니다.', gatherActorIds: ['medical_runner','medical_student','veteran','guardsman'], options: [
        { id: 'wounded-first', labelKo: '들것 길을 먼저 열고 다친 사람을 보낸다', directionKo: '산파·의학생·퇴역병이 함께 압니다 · 부상자를 먼저 옮깁니다 · 피난 가족은 잠시 기다려야 합니다', textKo: '주민과 퇴역병이 들것 길을 열고 다친 사람부터 옮겼다', effects: { aidPriority: 'wounded' }, groupReactionKo: '의학생 바실리  들것을 들 사람은 셋이면 됩니다. 길을 비워 주세요.\n퇴역병 루카  나머지는 강변으로 보내겠소. 아이 손을 놓치지 마시오.' },
        { id: 'families-first', labelKo: '아이와 노인을 강변 길로 먼저 보낸다', directionKo: '산파와 길목의 주민들이 압니다 · 가족이 먼저 빠져나갑니다 · 다친 사람을 옮길 손이 늦게 모입니다', textKo: '산파와 주민들이 아이와 노인을 강변 길로 안내했다', effects: { aidPriority: 'families' }, groupReactionKo: '산파 다리야  아이를 혼자 보내지 마세요. 보호자와 함께 걷게 해요.\n근위병 세르게이  길이 열리면 다음 들것을 통과시키겠습니다.' },
      ] },
      { id: 'senate-river-shelter-roll', mapId: 'senate-river', requiredActorId: 'courtyard_keeper', objectiveId: 'decide_shelter_limit', propKo: '안뜰 문에 걸린 명단판', promptKo: '사람들이 안뜰 문 앞에서 기다립니다. 문을 열지, 세든 가족만 받을지 집주인이 결정을 기다립니다.', gatherActorIds: ['courtyard_keeper','widow','servant','warehouseman'], options: [
        { id: 'open-courtyard', labelKo: '아이와 다친 사람부터 안뜰에 들인다', directionKo: '집주인과 안뜰에 모인 가족이 압니다 · 잠시 몸을 피할 곳이 생깁니다 · 집 안의 혼잡과 수색 위험을 감수합니다', textKo: '아이와 다친 사람을 우선해 안뜰 문을 열었다', requiresEffects: { aidPriority: 'families' }, effects: { shelter: 'open', shelterList: 'priority' }, groupReactionKo: '하숙집 주인 안나  먼저 안으로 드세요. 한 집에 다 들어갈 수는 없어요.\n하녀 바르바라  물부터 가져오겠습니다. 이름은 묻지 말아요.' },
        { id: 'keep-courtyard-closed', labelKo: '안뜰은 닫고 강변 피난길을 안내한다', directionKo: '집주인과 길 안내를 맡은 사람들이 압니다 · 안뜰 사람은 줄어듭니다 · 바깥에서 피할 곳을 다시 찾아야 합니다', textKo: '안뜰은 닫고 가족들을 강변 골목으로 안내했다', effects: { shelter: 'closed', shelterList: 'route' }, groupReactionKo: '하숙집 주인 마트료나  문은 닫겠습니다. 대신 길을 알려 드리죠.\n강변 창고지기 표트르  뒤쪽 골목은 수레가 못 갑니다. 걸어서 가야 해요.' },
      ] },
    ],
    conversations: {
      carry_family_supplies: [
        ['bread-first','빵과 물을 아이들 몫으로 먼저 챙긴다','짐꾼과 가게 식구들이 압니다 · 아이들의 끼니를 먼저 확보합니다 · 어른 몫은 나중에 다시 나눠야 합니다','안드레이가 빵 꾸러미를 건넸다. 클라브디야는 아이들과 함께 걷겠다고 했다.'],
        ['blankets-first','다친 사람에게 담요를 먼저 보낸다','짐꾼과 산파가 압니다 · 추위와 쇼크를 막습니다 · 가족에게 돌아갈 물건이 줄어듭니다','다리야가 담요를 받아 부상자 곁으로 갔다. 남은 사람들은 수레를 기다렸다.'],
        ['ask-families','가족에게 필요한 물건을 직접 묻는다','피난 가족과 짐꾼이 압니다 · 각자 필요한 것을 고릅니다 · 배분이 늦어집니다','안드레이는 기다렸다가 가족별로 짐을 나눴다. 급한 사람은 먼저 길을 떠났다.'],
      ],
      organize_aid: [
        ['carry-wounded','퇴역병과 주민을 모아 들것부터 든다','퇴역병과 의학생이 압니다 · 광장 안 부상자를 옮깁니다 · 가족 피난을 도울 손이 줄어듭니다','루카가 들것 앞을 들었다. 바실리는 길이 비는 동안 상태를 살폈다.'],
        ['guide-children','산파에게 아이와 노인의 이동을 맡긴다','산파와 피난 가족이 압니다 · 가족이 함께 강변으로 갑니다 · 부상자는 더 기다려야 합니다','다리야가 보호자를 짝지어 보냈다. 루카는 남은 들것을 준비했다.'],
        ['divide-the-route','들것 한 조와 피난 안내 한 조로 나눈다','산파·퇴역병·의학생이 압니다 · 두 일을 함께 시작합니다 · 어느 쪽도 충분한 인원은 아닙니다','세 사람은 인원을 나눴다. 광장 길목은 느렸지만 한쪽에만 사람이 몰리진 않았다.'],
      ],
      decide_shelter_limit: [
        ['prioritize-neighbors','세든 가족과 아이를 먼저 들인다','집주인과 세입자가 압니다 · 아는 사람부터 피신합니다 · 낯선 피난민은 밖에 남습니다','마트료나는 세든 가족부터 불렀다. 바르바라는 문 앞에 남은 사람에게 물을 가져갔다.'],
        ['open-for-all','안뜰을 열고 순서대로 들인다','집주인과 피난민이 압니다 · 더 많은 사람이 몸을 피합니다 · 방과 식량이 모자랄 수 있습니다','문이 열리자 사람들이 한 줄로 섰다. 안나는 쉴 자리를 살피며 수를 세었다.'],
        ['route-only','집은 지키고 다른 대피처를 찾는다','집주인과 길 안내를 맡은 사람이 압니다 · 안뜰 혼잡을 막습니다 · 피난민은 더 걸어야 합니다','마트료나는 강변 길을 직접 가리켰다. 짐꾼은 수레를 돌려 길을 비웠다.'],
      ],
    },
  },
  GOGOL_INSPECTOR_1836: {
    actors: [
      { id: 'ticket_broker', templateId: 'street_vendor_matryona', nameKo: '표를 되파는 상인 나데즈다', objectiveId: 'settle_ticket_dispute', occupationKo: '극장 앞 표 장수', introductionKo: '남은 표를 팔려 하지만 늦게 온 관객과 먼저 온 관객이 다투고 있다.', lines: ['표를 돈 받고 넘겼더니 자리가 겹친다며 두 사람이 찾아왔어요.', '누구 말이 맞는지 보려면 표부터 같이 봐야겠네요.'] },
      { id: 'backstage_helper', templateId: 'print_apprentice_stepan', nameKo: '무대 견습공 표트르', objectiveId: 'protect_company', occupationKo: '극장 무대 견습공', introductionKo: '배우가 바꾼 대사와 인쇄 대본 사이에서 어느 쪽을 준비할지 기다린다.', lines: ['무대 뒤에서는 둘 다 들었습니다. 오늘 어느 대사로 갈지 알려 주세요.', '배우가 정하면 소품도 바꿔야 해요. 막이 오르기 전에만 말해 주세요.'] },
      { id: 'street_reader', templateId: 'reader_darya', nameKo: '극장 밖 낭독자 파벨', objectiveId: 'hold_public_discussion', occupationKo: '책과 공고를 읽어 주는 도시 주민', introductionKo: '공연을 못 본 사람들에게 관객의 반응을 전하려 한다.', lines: ['안에 못 들어간 이들이 무슨 공연인지 묻습니다. 한 줄로만 전하면 또 오해하겠지요.', '나온 관객과 먼저 이야기하고, 들은 말을 그대로 전하겠습니다.'] },
    ],
    objectives: [
      { id: 'settle_ticket_dispute', titleKo: '겹친 표와 자리를 정리한다', actionKo: '표 장수와 관객에게 좌석을 다시 확인한다' },
      { id: 'protect_company', titleKo: '무대 뒤 배우와 견습공의 판단을 듣는다', actionKo: '배우가 고친 대사를 무대에 올릴지 함께 결정한다' },
      { id: 'hold_public_discussion', titleKo: '공연을 못 본 사람에게 관객의 말을 전한다', actionKo: '극장 밖에서 서로 다른 관객의 반응을 듣는다' },
    ],
    actions: [
      { id: 'inspector-approach-seat-dispute', mapId: 'theatre-approach', requiredActorId: 'ticket_broker', objectiveId: 'settle_ticket_dispute', propKo: '서로 다른 번호가 적힌 공연표', promptKo: '두 관객이 같은 좌석 번호가 적힌 표를 내밉니다. 표 장수는 한 장을 더 팔았다고 주장하고 안내원은 입구를 비우라 재촉합니다.', gatherActorIds: ['ticket_broker','usher','student','reader'], options: [
        { id: 'check-both-stubs', labelKo: '두 표와 좌석판을 대조한다', directionKo: '표 장수와 관객, 안내원이 함께 압니다 · 좌석 겹침을 확인합니다 · 입장이 잠시 늦어집니다', textKo: '두 관객의 표와 좌석판을 함께 대조했다', effects: { ticketDispute: 'checked' }, groupReactionKo: '표 장수 나데즈다  제가 한 장을 더 팔았는지 확인해 보겠어요.\n안내원 이리나  표가 확인될 때까지만 줄을 옆으로 비켜 주세요.' },
        { id: 'seat-the-first', labelKo: '먼저 온 관객을 빈자리에 앉힌다', directionKo: '안내원과 줄 선 관객이 압니다 · 입구가 빨리 비워집니다 · 뒤늦게 온 관객은 항의할 수 있습니다', textKo: '먼저 온 관객을 빈자리에 안내하고 나머지 표는 확인하기로 했다', effects: { ticketDispute: 'first_arrival' }, groupReactionKo: '학생 바실리  자리를 먼저 잡았다고 표가 맞는 건 아니잖아요.\n안내원 이리나  알겠어요. 입구를 비우고 공연 뒤에 확인하죠.' },
      ] },
      { id: 'inspector-lobby-company-vote', mapId: 'theatre-lobby', requiredActorId: 'backstage_helper', objectiveId: 'protect_company', propKo: '배우와 견습공이 펼친 대본', promptKo: '배우는 고친 대사로 무대에 서겠다고 하고, 견습공은 소품과 다음 장면이 바뀌어야 한다고 말합니다. 안내원은 막을 늦출 수 있는 시간이 얼마 남지 않았다고 알립니다.', gatherActorIds: ['backstage_helper','actor','dresser','printer'], options: [
        { id: 'company-decides', labelKo: '배우와 무대 사람들에게 함께 정하게 한다', directionKo: '배우·재봉사·견습공이 압니다 · 준비를 마친 뒤 배우가 결정합니다 · 막이 늦게 오를 수 있습니다', textKo: '배우와 무대 사람들이 고친 대사를 올릴지 함께 정하도록 했다', effects: { companyChoice: 'shared' }, groupReactionKo: '배우 니콜라이  이 줄은 제가 책임지겠습니다.\n무대 견습공 표트르  그럼 소품을 바꾸겠습니다. 다음 신호는 제가 줄게요.' },
        { id: 'printed-script', labelKo: '인쇄된 대본대로 무대 준비를 끝낸다', directionKo: '배우와 무대 책임자가 압니다 · 공연은 예정대로 시작합니다 · 배우의 수정은 오늘 빠집니다', textKo: '배우에게 인쇄 대본으로 공연을 시작해 달라고 했다', effects: { companyChoice: 'printed' }, groupReactionKo: '재봉사 안나  옷은 준비됐어요. 대사는 배우가 정하면 좋겠는데요.\n배우 니콜라이  오늘은 대본대로 하죠. 관객 앞에서 다시 생각하겠습니다.' },
      ] },
      { id: 'inspector-street-open-forum', mapId: 'theatre-street', requiredActorId: 'street_reader', objectiveId: 'hold_public_discussion', propKo: '극장 벽에 놓인 빈 벤치', promptKo: '공연을 본 관객과 표만 사서 돌아간 사람들이 극장 앞에 남았습니다. 한 줄짜리 평으로는 서로 다른 반응을 전하기 어렵습니다.', gatherActorIds: ['street_reader','critic','merchant','official'], options: [
        { id: 'mixed-audience', labelKo: '학생·상인·관리의 말을 차례로 듣는다', directionKo: '극장 밖에 남은 관객이 압니다 · 서로 다른 반응이 한자리에 놓입니다 · 말다툼을 직접 정리해야 합니다', textKo: '학생과 상인, 관객으로 온 서기의 말을 차례로 들었다', requiresEffects: { companyChoice: 'shared' }, effects: { publicDiscussion: 'mixed' }, groupReactionKo: '학생 바실리  웃음이 나왔지만, 어느 장면에서였는지도 말해야 해요.\n상인 레프  객석에선 웃음이 달랐소. 다 같은 뜻은 아니었지.\n관객 서기 콘스탄틴  각자 본 장면을 말합시다. 서로 대신 말하진 말고요.' },
        { id: 'quiet-comments', labelKo: '관객에게 한마디씩 듣고 길을 비운다', directionKo: '평론가와 나가는 관객이 압니다 · 짧은 의견을 들을 수 있습니다 · 함께 토론할 시간은 없습니다', textKo: '관객에게 짧은 평을 듣고 마차가 지나갈 길을 비웠다', effects: { publicDiscussion: 'brief' }, groupReactionKo: '평론가 소피야  오늘은 결론을 적지 않겠어요. 어떤 장면을 말했는지만 남기죠.\n낭독자 파벨  그 정도면 밖에 기다린 사람들에게 전할 수 있겠습니다.' },
      ] },
    ],
    conversations: {
      settle_ticket_dispute: [
        ['compare-stubs','두 사람의 표를 나란히 확인한다','표 장수와 관객, 안내원이 압니다 · 좌석 배정 근거를 봅니다 · 줄이 늦어집니다','나데즈다는 표를 다시 펼쳤다. 안내원은 좌석판에서 번호를 찾았다.'],
        ['seat-oldest','먼저 온 관객에게 자리를 내준다','입구에 선 관객들이 압니다 · 줄이 빠르게 움직입니다 · 표 문제는 남습니다','먼저 온 관객은 안으로 들어갔다. 다른 관객은 표를 손에 쥔 채 기다렸다.'],
        ['ask-for-another-seat','빈자리를 찾아 두 관객을 따로 앉힌다','안내원과 표를 가진 두 사람이 압니다 · 공연을 볼 수 있습니다 · 일행이 갈라질 수 있습니다','이리나는 빈자리를 찾아 둘을 다른 줄에 앉혔다. 표 장수는 남은 표를 다시 세었다.'],
      ],
      protect_company: [
        ['hear-the-actor','배우에게 바꾼 이유를 직접 묻는다','배우와 무대 뒤 사람들이 압니다 · 수정한 대사의 까닭을 듣습니다 · 준비 시간이 줄어듭니다','니콜라이는 대사가 무대에서 어떻게 들리는지 설명했다. 견습공은 소품을 옮기기 시작했다.'],
        ['ask-the-company','배우와 무대 사람들 의견을 함께 듣는다','배우·재봉사·견습공이 함께 압니다 · 준비 문제를 나눠 봅니다 · 막이 늦어질 수 있습니다','서로 말이 달랐지만 막이 오르기 전에 결정할 수 있었다.'],
        ['keep-the-schedule','예정대로 시작하고 공연 뒤 다시 이야기한다','배우와 관객이 압니다 · 공연 시각을 지킵니다 · 무대 뒤 질문이 남습니다','안내원은 시작 신호를 보냈다. 배우는 대본을 들고 무대에 올랐다.'],
      ],
      hold_public_discussion: [
        ['keep-a-seat','관객 몇 명을 남겨 장면을 이야기한다','남은 관객과 극장 사람들이 압니다 · 장면별 반응을 듣습니다 · 마차가 늦게 빠집니다','학생은 웃음이 멈춘 장면을 말했고 상인은 다른 대목을 꼽았다.'],
        ['send-a-summary','밖에서 기다리는 사람에게 서로 다른 반응을 전한다','낭독자와 극장 밖 시민이 압니다 · 공연을 못 본 사람도 소식을 듣습니다 · 짧은 말로 전해야 합니다','파벨은 한쪽 평만 고르지 않고 두 관객의 말을 이어 전했다.'],
        ['close-the-street','길을 비우고 관객을 먼저 보낸다','안내원과 마차꾼이 압니다 · 출구가 막히지 않습니다 · 토론은 다음으로 미뤄집니다','안내원은 사람들을 둘로 나눠 내보냈다. 질문은 극장 문을 닫은 뒤에도 남았다.'],
      ],
    },
  },
  EMANCIPATION_1861: {
    actors: [
      { id: 'rural-copy-carrier', templateId: 'courier_pavel', nameKo: '마을 편지를 나르는 파벨', objectiveId: 'trace_copy_routes', occupationKo: '인쇄물과 사적인 편지를 나르는 심부름꾼', introductionKo: '어느 고을까지 선언문이 전해졌는지 확실한 답을 찾고 있다.', lines: ['마차는 큰길에 한 부씩 내릴 수 있어요. 집집마다 돌면 하루가 더 걸립니다.', '어느 마을에 먼저 보내야 할지 정해 주세요. 빈손으로 돌아가긴 싫습니다.'] },
      { id: 'wage_delegate', templateId: 'seamstress_anna', nameKo: '품삯을 모으는 하녀 소피야', objectiveId: 'negotiate_work_terms', occupationKo: '고용주 집에서 일하는 하녀', introductionKo: '하녀들이 각자 흩어져 요구하지 않도록 함께 조건을 묻고 싶다.', lines: ['혼자 가면 오늘 일도 잃을 수 있어요. 같이 가면 말을 끝까지 들을까요?', '방과 품삯을 한꺼번에 물으면 어느 쪽도 답하지 않을지 모르겠네요.'] },
      { id: 'petition_copyist', templateId: 'senior_clerk_konstantin', nameKo: '질문을 받아 적는 서기 이반', objectiveId: 'prepare_petition_route', occupationKo: '관청 민원 서기', introductionKo: '사람들이 묻는 토지·품삯 문제를 어떤 절차로 올릴지 알아보려 한다.', lines: ['질문을 모아 오면 접수는 해 보겠소. 다만 답이 오늘 오진 않소.', '누구 이름으로 냈는지 남길지, 대표만 적을지 먼저 정하시오.'] },
    ],
    objectives: [
      { id: 'trace_copy_routes', titleKo: '선언문이 어느 마을까지 갔는지 정한다', actionKo: '심부름꾼과 인쇄물 장수에게 배포 순서를 묻는다' },
      { id: 'negotiate_work_terms', titleKo: '품삯과 잠자리를 함께 요구할지 정한다', actionKo: '하녀와 고용주를 만나 다음 일주일의 조건을 묻는다' },
      { id: 'prepare_petition_route', titleKo: '생활 질문을 어떤 이름으로 관청에 낼지 정한다', actionKo: '서기와 대표단을 꾸려 질문서와 회신 방법을 정한다' },
    ],
    actions: [
      { id: 'emancipation-street-copy-route', mapId: 'manifesto-street', requiredActorId: 'rural-copy-carrier', objectiveId: 'trace_copy_routes', propKo: '마차에 실을 인쇄본 꾸러미', promptKo: '서로 다른 고을에서 온 사람들이 인쇄본을 기다립니다. 가까운 마을부터 보낼지, 큰길을 따라 여러 곳에 한꺼번에 보낼지 정해야 합니다.', gatherActorIds: ['rural-copy-carrier','typesetter','bookseller','porter'], options: [
        { id: 'nearby-first', labelKo: '가까운 마을부터 직접 전달한다', directionKo: '심부름꾼과 인쇄소 사람들이 압니다 · 원문을 함께 읽을 수 있습니다 · 먼 곳은 늦게 받습니다', textKo: '심부름꾼에게 가까운 마을부터 인쇄본을 전해 달라고 했다', effects: { copiesRoute: 'nearby' }, groupReactionKo: '마을 편지꾼 파벨  걸어서 가면 오늘 안에 두 곳은 닿습니다.\n식자공 니키타  한 부씩 읽고 질문을 받아 와요. 제목만 전하진 말고요.' },
        { id: 'carriage-distribution', labelKo: '마차에 여러 묶음을 실어 큰길로 보낸다', directionKo: '마차꾼과 인쇄물 장수가 압니다 · 더 먼 곳에 전달합니다 · 낭독할 사람을 따로 찾아야 합니다', textKo: '마차에 인쇄본을 실어 큰길의 여러 마을로 보냈다', effects: { copiesRoute: 'carriage' }, groupReactionKo: '마차꾼 로만  큰길이라면 여러 묶음을 실어 나를 수 있소.\n서점 주인 레프  받는 마을에 읽어 줄 사람도 적어 보내겠습니다.' },
      ] },
      { id: 'emancipation-square-wage-meeting', mapId: 'manifesto-square', requiredActorId: 'wage_delegate', objectiveId: 'negotiate_work_terms', propKo: '하녀들이 적은 품삯과 잠자리 목록', promptKo: '하녀들은 다음 주에도 같은 집에서 일할지, 품삯과 잠자리를 다시 정할지 망설입니다. 혼자 가면 고용주가 대화를 거절할 수 있습니다.', gatherActorIds: ['wage_delegate','maid','washer','former_servant'], options: [
        { id: 'collective-terms', labelKo: '하녀들이 함께 품삯과 잠자리를 요구한다', directionKo: '하녀·세탁부와 고용주가 압니다 · 조건을 함께 협상합니다 · 일감을 잃을 위험도 함께 집니다', textKo: '하녀들이 함께 고용주를 찾아가 다음 주 품삯과 잠자리를 요구했다', effects: { workNegotiation: 'collective' }, groupReactionKo: '하녀 소피야  한 사람씩 부르지 말고, 우리 모두의 조건을 말해요.\n전직 하녀 바르바라  방과 품삯을 한꺼번에 적어 두세요. 그래야 말을 바꾸지 못해요.' },
        { id: 'secure-bed-first', labelKo: '오늘 밤 잘 곳부터 함께 구한다', directionKo: '하녀와 집주인, 세탁부가 압니다 · 당장 지낼 곳을 찾습니다 · 다음 주 품삯 협상은 미뤄집니다', textKo: '하녀들이 오늘 밤 머물 방을 먼저 구하고 품삯은 다음 날 묻기로 했다', effects: { workNegotiation: 'lodging_first' }, groupReactionKo: '세탁부 마리야  내가 아는 집에 자리를 물어볼게요.\n하녀 소피야  잠자리부터 정하고, 내일 함께 고용주를 찾아갑시다.' },
      ] },
      { id: 'emancipation-lane-petition', mapId: 'manifesto-lane', requiredActorId: 'petition_copyist', objectiveId: 'prepare_petition_route', propKo: '대표 이름을 적을 청원 용지', promptKo: '토지 조건과 품삯을 묻는 사람들이 답을 기다립니다. 질문한 사람 모두의 이름을 쓸지, 대표단 이름으로만 접수할지 서기가 묻습니다.', gatherActorIds: ['petition_copyist','washer','messenger','midwife'], options: [
        { id: 'named-petition', labelKo: '질문한 사람의 이름을 함께 적는다', directionKo: '질문자와 관청 서기가 압니다 · 각자의 질문에 답을 요청합니다 · 이름을 올린 사람이 책임을 집니다', textKo: '질문자들의 이름을 적어 토지와 품삯 조건을 관청에 물었다', effects: { petitionRoute: 'named' }, groupReactionKo: '서기 이반  이름을 적으면 회신을 찾기는 쉽소. 서명한 사람은 직접 답을 받게 되겠지.\n산파 아브도티야  질문을 빼지 말고 그대로 적어 주세요.' },
        { id: 'representative-petition', labelKo: '대표단 이름으로 질문을 모아 낸다', directionKo: '대표단과 서기가 압니다 · 여러 사람의 질문을 한 번에 냅니다 · 개별 사정은 답변에서 빠질 수 있습니다', textKo: '대표단 이름으로 질문을 모아 관청에 제출했다', requiresEffects: { workNegotiation: 'collective' }, effects: { petitionRoute: 'representative' }, groupReactionKo: '심부름꾼 파벨  제가 대표단의 회신을 받아 오겠습니다.\n세탁부 마리야  우리 집 사정도 질문에 넣어야 해요. 대표가 빠뜨리지 않게 읽어 주세요.' },
      ] },
    ],
    conversations: {
      trace_copy_routes: [
        ['ask-distance','가장 먼 마을부터 전달할 수 있는지 묻는다','심부름꾼과 마차꾼이 압니다 · 전달 범위를 넓힙니다 · 가까운 주민의 낭독은 늦어집니다','파벨은 큰길과 걸어서 가는 길을 나눠 지도를 짚었다.'],
        ['ask-reader','인쇄본을 받아 읽어 줄 사람을 먼저 찾는다','인쇄소와 서점 주인이 압니다 · 문장을 함께 확인할 수 있습니다 · 배포가 하루 늦어집니다','니키타는 낭독할 사람에게 작은 활자 조항도 전해 달라고 했다.'],
        ['ask-return','전달 뒤 각 마을의 질문을 받아 오게 한다','심부름꾼과 기다리는 주민이 압니다 · 다음 대화를 이어갈 수 있습니다 · 왕복 시간이 더 듭니다','파벨은 전달 확인과 질문을 한 장에 적어 돌아오기로 했다.'],
      ],
      negotiate_work_terms: [
        ['ask-wage','품삯부터 얼마로 정할지 묻는다','하녀들과 고용주가 압니다 · 금액을 먼저 협상합니다 · 잠자리는 따로 구해야 합니다','소피야는 품삯 이야기를 꺼냈다. 고용주는 대답을 미루지 못했다.'],
        ['ask-room','오늘 밤과 다음 주 잠자리를 먼저 묻는다','하녀·집주인과 세탁부가 압니다 · 거처 문제를 확인합니다 · 품삯 결정은 다음으로 넘어갑니다','하녀들은 머물 방을 확인하고 품삯을 다시 물을 날짜를 정했다.'],
        ['write-both','품삯과 방 조건을 한 장에 적어 함께 요구한다','하녀와 고용주가 압니다 · 조건을 빠짐없이 봅니다 · 고용주가 협상을 거절할 수 있습니다','바르바라는 요구를 한 장에 적고 모두가 본 뒤 건넸다.'],
      ],
      prepare_petition_route: [
        ['representative-only','대표 한 사람의 이름으로 접수한다','대표단과 서기가 압니다 · 서류가 간단해집니다 · 각자 사정은 따로 실리지 않습니다','이반은 대표 이름을 적고 질문을 묶었다. 나머지는 내용을 다시 읽었다.'],
        ['every-name','질문한 사람의 이름과 질문을 함께 적는다','질문자와 관청 서기가 압니다 · 개인별 회신을 요청할 수 있습니다 · 공개 서명자가 늘어납니다','서기는 이름을 하나씩 확인했다. 사람들이 문구와 순서를 고쳤다.'],
        ['wait-for-copy','규정을 다시 읽고 제출을 하루 미룬다','서기와 질문자들이 압니다 · 잘못된 질문을 줄입니다 · 답변 요청은 늦어집니다','대표단은 인쇄본을 다시 읽은 뒤 다음 날 접수하기로 했다.'],
      ],
    },
    extraObjectives: [{ id: 'read_terms_together', titleKo: '함께 규정 인쇄본을 읽는다', actionKo: '인쇄물 장수와 하녀들에게 선언과 조건을 함께 읽어 준다' }],
    extraActions: [{ id: 'emancipation-square-terms-reading', mapId: 'manifesto-square', requiredActorId: 'former_servant', objectiveId: 'read_terms_together', groupEncounter: true,
      propKo: '선언과 조건이 인쇄된 두 장', promptKo: '선언의 제목은 이미 널리 읽혔지만, 함께 온 조건문은 작은 글씨로 인쇄돼 있습니다. 인쇄물 장수와 하녀들이 어느 대목부터 들을지 기다립니다.',
      gatherActorIds: ['former_servant','maid','wage_delegate','porter'], options: [
        { id: 'read-conditions', labelKo: '선언과 조건문을 차례로 읽는다', directionKo: '하녀와 인쇄물 장수가 함께 압니다 · 서로 다른 조항을 확인합니다 · 낭독에 시간이 걸리고 더 많은 질문이 나옵니다', textKo: '선언과 함께 인쇄된 조건문을 차례로 읽었다', effects: { termsReading: 'complete' },
          groupReactionKo: '인쇄물 장수 표트르  제목만 읽으면 여기 적힌 조건은 놓치게 됩니다.\n하녀 올가  천천히 읽어 주세요. 어느 말이 우리한테 해당하는지 물어볼게요.\n전직 하녀 바르바라  내가 겪은 일과 종이에 적힌 조건을 같이 보죠.' },
        { id: 'announce-title', labelKo: '선언의 핵심부터 알리고 질문을 모은다', directionKo: '낭독을 기다리는 주민이 압니다 · 먼저 모인 사람에게 소식을 전합니다 · 세부 조건은 뒤에 다시 읽어야 합니다', textKo: '선언의 핵심을 먼저 알리고 조건에 관한 질문을 따로 모았다', effects: { termsReading: 'questions_first' },
          groupReactionKo: '인쇄물 장수 표트르  먼저 모인 사람들에게 핵심을 읽어 주겠소.\n하녀 소피야  조건은 나중에라도 꼭 같이 읽어요. 우리 질문도 받아 적어 주세요.' },
      ] }],
    extraConversation: { read_terms_together: [
      ['read-all-lines','제목과 조건문을 모두 소리 내어 읽는다','낭독을 들은 하녀와 인쇄물 장수가 압니다 · 조항을 함께 확인합니다 · 시간이 더 걸리고 질문이 이어집니다','표트르는 작은 활자까지 읽었다. 하녀들은 고향에 물어볼 대목을 따로 적었다.'],
      ['collect-questions','먼저 생활에 닿는 질문부터 모은다','하녀와 주민들이 압니다 · 일자리와 토지 질문을 모읍니다 · 문서 전체를 읽는 일은 미뤄집니다','올가는 오늘 밤 머물 곳부터 물었다. 다른 사람들은 고향에 보낼 질문을 보탰다.'],
      ['ask-for-reprint','조건문을 읽기 쉽게 다시 인쇄해 달라고 한다','인쇄소와 기다리는 주민이 압니다 · 더 읽기 쉬운 사본을 요청합니다 · 배포가 늦어질 수 있습니다','니키타는 활자 크기와 종이 수를 계산했다. 표트르는 필요한 부수를 물었다.'],
    ] },
  },
};

for (const scene of scenesData.events) {
  const expansion = expansions[scene.eventId];
  if (!expansion) throw new Error(`Missing authored field expansion: ${scene.eventId}`);
  const unique = (rows, additions) => {
    const byId = new Map(rows.map(row => [row.id, row]));
    for (const row of additions) byId.set(row.id, row);
    return [...byId.values()];
  };
  scene.actors = unique(scene.actors, expansion.actors);
  scene.objectives = unique(scene.objectives, [...expansion.objectives, ...(expansion.extraObjectives ?? [])]);
  if (expansion.extraObjectives?.length) for (const actor of scene.actors) if (actor.id === 'former_servant') actor.objectiveId = expansion.extraObjectives[0].id;
  scene.fieldActions = unique(scene.fieldActions, [...expansion.actions.map(action => ({ ...action, groupEncounter: true })), ...(expansion.extraActions ?? [])]);
  scene.conclusionRequirements = { spokenActors: 12, completedObjectives: 7, requiredRoleActions: 6 };
  conversations[scene.eventId] ??= {};
  for (const [objectiveId, rows] of Object.entries(expansion.conversations)) {
    conversations[scene.eventId][objectiveId] = rows.map(([id, labelKo, directionKo, reactionKo], index) => ({
      id, labelKo, directionKo, reactionKo, stance: ['support', 'question', 'defer'][index],
    }));
  }
  for (const [objectiveId, rows] of Object.entries(expansion.extraConversation ?? {})) {
    conversations[scene.eventId][objectiveId] = rows.map(([id, labelKo, directionKo, reactionKo], index) => ({
      id, labelKo, directionKo, reactionKo, stance: ['support', 'question', 'defer'][index],
    }));
  }
  const entry = catalog.events.find(item => item.id === scene.eventId);
  if (!entry) throw new Error(`Missing event catalog entry: ${scene.eventId}`);
  entry.playableParticipantCount = scene.actors.length;
  entry.cast = scene.actors.map(person => person.nameKo);
}

await writeFile(new URL('../rpg/data/historical-scene-play.json', import.meta.url), `${JSON.stringify(scenesData, null, 2)}\n`);
await writeFile(new URL('../rpg/data/v38-historical-events.json', import.meta.url), `${JSON.stringify(catalog, null, 2)}\n`);
await writeFile(new URL('../rpg/data/historical-conversation-choices.json', import.meta.url), `${JSON.stringify(conversations, null, 2)}\n`);
console.log('Authored 3 expanded field events: 18 movable residents, 9 subobjectives, 9 physical choices and 6 role-specific actions per event.');
