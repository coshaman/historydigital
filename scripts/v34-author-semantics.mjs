import fs from 'node:fs';

const file = 'narrative/MAIN_20MIN_DIALOGUE.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
data.schemaVersion = 'MAIN-20MIN-DIALOGUE-V34';
data.title = 'Russian Lives: Act III — Main 20-minute route V34 semantic endings';
const scene = (id) => data.scenes.find((item) => item.id === id);
const pick = (id, text, action, reaction, flagsAdd, relationship = {}, channel = 'spoken', selectedExactExcerpt = '') => ({
  id, text, actor: 'PLAYER', action, flagsAdd, reaction, relationship, selectedExactExcerpt,
  claim: text, channel,
  reactionActor: ['institutionalBoundaryChoice', 'official_record', 'official_memo', 'reserve_poem_judgment', 'communalMediation'].includes(action) ? 'alexei' : ['literaryArgumentChoice', 'literaryArgument', 'interpret_captive_voice', 'spoken_risk_boundary', 'spoken_public_argument', 'silence', 'protective_silence'].includes(action) ? 'ekaterina' : ['networkReception', 'routed_document', 'dangerous_discussion', 'send_to_trusted_reader'].includes(action) ? 'pavel' : 'NARRATION',
  semantic: { selectedExactExcerpt, claim: text, channel, whoHears: 'PLAYER', observableConsequence: action, relationshipJustification: '플레이어의 독립 판단이 이후 인물의 신뢰와 위험을 바꾼다' }
});
const setScene = (id, intro, choices, postChoices, memoryCallbacks) => {
  const current = scene(id);
  current.intro = intro;
  current.choices = choices;
  current.postChoices = postChoices;
  current.memoryCallbacks = memoryCallbacks;
};

setScene('C07', [
  ['NARRATION', '이번에는 작품을 통과시키는 문장과 작품을 말하는 목소리가 봉투 안에서 서로 부딪혔다.'],
  ['alexei', '검열 절차는 책임의 선을 남겨요. 그런데 그 선이 작가가 말한 내용을 대신할 수는 없지.'],
  ['ekaterina', '작가의 편지를 절차 한 줄로 줄이면, 우리가 보존하는 건 판정뿐이에요.'],
  ['PLAYER_PROMPT', '두 사람의 주장이 충돌합니다. 누구를 고를지가 아니라, 무엇에 동의하고 무엇을 먼저 확인할지 정하세요.'],
  ['NARRATION', '편지와 허가 표기 사이에는 아직 비어 있는 시간이 있다. 그 빈칸도 판단의 일부다.']
], [
  pick('C07-A', '알렉세이의 주장에 동의한다. 먼저 검열 절차와 책임의 경계를 확인하자.', 'institutionalBoundaryChoice', '알렉세이: 절차를 먼저 확인하겠다는 말은 내 책임도 피하지 않겠다는 뜻이군.', ['institutionalBoundary', 'literaryArgument'], { alexei: 1 }, 'opinion', 'C07-R1'),
  pick('C07-B', '예카테리나의 반박을 따른다. 작가의 편지를 판정문으로 바꾸지 말고 목소리부터 보존하자.', 'literaryArgumentChoice', '예카테리나: 이제야 편지가 절차에 삼켜지지 않네요. 하지만 위험을 모른 척하지도 말아요.', ['literaryArgument', 'privateVoiceProtected', 'publicDebate'], { ekaterina: 1 }, 'opinion', 'C07-R1,C07-R2'),
  pick('C07-C', '둘 다 멈추게 한다. 원문과 날짜를 먼저 확인한 뒤 판단하겠다.', 'suspend_verdict', '알렉세이: 유보는 회피가 아니군. 예카테리나: 원문을 먼저 보자는 말이라면 나도 기다리겠어요.', ['mediatedConflict', 'evidenceFirst', 'communalDuty'], {}, 'reserve', 'C07-R1,C07-R2')
], [
  pick('C07-P1', '검열위원의 판단을 공식 기록으로 남기되, 작가의 호소와 같은 목소리라고 쓰지 않겠다.', 'official_record', '알렉세이: 공식 기록을 남기되 그 기록이 모든 목소리를 대신하지 않게 했군.', ['institutionalBoundary', 'publicCivicClaim'], { alexei: 1 }, 'official', 'C07-R1,C07-R2'),
  pick('C07-P2', '작품의 주장을 공적 논쟁으로 열어 둔다. 검열의 판단도 반박 가능한 문장으로 놓겠다.', 'literaryArgument', '예카테리나: 그 문장은 작품을 무죄로 만들지 않지만, 토론할 권리를 닫지도 않아요.', ['literaryArgument', 'publicDebate'], { ekaterina: 1 }, 'spoken', 'C07-R1,C07-R2'),
  pick('C07-P3', '편지와 허가 표기를 공동체가 함께 검토할 수 있게 중재하고, 어느 한쪽의 판정으로 닫지 않겠다.', 'communalMediation', '두 사람은 잠시 말을 멈춘다. 서로의 책임을 지우지 않고 다음 독자에게 판단을 넘겼다.', ['mediatedConflict', 'communalDuty'], {}, 'mediation', 'C07-R1,C07-R2')
], [
  { character: 'alexei', actionsAny: ['public_citation', 'bound_witness_statement'], line: '알렉세이: 푸시킨의 날짜와 레르몬토프의 빈 범위를 기억하니, 이번에도 절차와 목소리를 섞지 않으려는군.' },
  { character: 'ekaterina', actionsAny: ['preserve_public_grief', 'mark_missing_witness'], line: '예카테리나: 예전에 남겨 둔 애도와 빈 증언처럼, 이번 편지도 지우지 않되 대신 말하지 말아요.' },
  { character: 'pavel', actionsAny: ['trace_print_route', 'map_scene_inspection'], line: '파벨: 당신은 예전부터 도착 경로를 따졌죠. 이번엔 그 경로가 사람을 위험에 빠뜨릴 수도 있다는 걸 기억해 주세요.' }
]);

setScene('E02', [
  ['NARRATION', '1847년. 시의 두 화자와 그것을 읽은 사람의 일기가 같은 책상 위에서 서로 다른 방향을 가리켰다.'],
  ['ekaterina', '나는 포로라는 말의 폭력을 먼저 읽어요. 비유가 누군가의 목소리를 가둘 수도 있으니까.'],
  ['alexei', '나는 그 시를 행정 증거로 만들고 싶지 않아. 다만 권력의 말이 어떻게 들리는지는 물어야 해.'],
  ['pavel', '누가 어떤 독법을 다음 사람에게 건네는지도 위험이에요. 시는 종이 위에만 머물지 않으니까.'],
  ['PLAYER_PROMPT', '세 사람 중 하나를 고르는 대신, 시의 두 화자와 정치적 비유를 어떻게 읽는지 자신의 판단을 고르세요.']
], [
  pick('E02-A', '보호를 말하는 화자보다 “포로”라고 말하는 화자에 더 설득된다. 권력의 언어를 의심하겠다.', 'interpret_captive_voice', '예카테리나: 그 말의 폭력을 들었군요. 다만 비유를 곧바로 사실 기록이라고 부르지는 말아요.', ['literaryArgument', 'publicDebate'], { ekaterina: 1 }, 'interpretation', 'E02-R1,E02-R2'),
  pick('E02-B', '두 화자 어느 쪽도 즉시 믿지 않겠다. 시의 장면과 일기의 반응을 함께 확인하겠다.', 'reserve_poem_judgment', '알렉세이: 유보하면서도 읽기를 멈추지 않는군. 판단을 늦추는 이유가 남아 있어.', ['evidenceFirst', 'communalDuty'], {}, 'reserve', 'E02-R1,E02-R2,E02-R3'),
  pick('E02-C', '시의 비유가 독자 사이에서 어떻게 전달되는지가 중요하다. 읽는 사람의 위험까지 살피겠다.', 'networkReception', '파벨: 바로 그 지점이 두려워요. 뜻을 전달하는 일이 사람을 노출할 수도 있으니까.', ['networkDelivery', 'riskAccepted'], { pavel: 1 }, 'delivery', 'E02-R1,E02-R2,E02-R3')
], [
  pick('E02-P1', '이 시를 공개 논쟁의 장에 놓겠다. 정치적 비유는 검열의 결론이 아니라 독자가 다투는 주장이다.', 'literaryArgument', '예카테리나: 이제 독자가 말할 자리를 남겼네요. 작품을 판결문으로 만들지 않았어요.', ['literaryArgument', 'publicDebate'], { ekaterina: 1 }, 'public-debate', 'E02-R1,E02-R2'),
  pick('E02-P2', '두 화자의 긴장을 공동체의 책임으로 읽겠다. 누구의 말도 혼자 결론이 되지 않게 중재하겠다.', 'communalMediation', '알렉세이: 행정의 언어만으로는 모자라고, 한 사람의 분노만으로도 모자라다는 말이군.', ['mediatedConflict', 'communalDuty'], { alexei: 1 }, 'mediation', 'E02-R1,E02-R2,E02-R3'),
  pick('E02-P3', '이 독법을 믿을 만한 독자에게 위험을 설명하며 전달하겠다. 시가 사람을 대신해 고발하지 않게 하겠다.', 'dangerous_discussion', '파벨: 전달은 중립이 아니에요. 누구에게 건네는지까지 책임지겠다는 말로 들립니다.', ['networkDelivery', 'riskAccepted', 'literaryArgument'], { pavel: 1 }, 'risked-discussion', 'E02-R1,E02-R2,E02-R3')
], [
  { character: 'alexei', actionsAny: ['public_citation', 'report_medical_fact_only'], line: '알렉세이: 네가 예전에 사실의 범위를 지키던 방식이 이번 시에서는 어떤 결론을 늦추는지 보이는군.' },
  { character: 'ekaterina', actionsAny: ['preserve_public_grief', 'compare_censor_turn'], line: '예카테리나: 애도와 검열의 목소리를 따로 보존했던 선택을 기억해요. 이번엔 화자의 말도 그렇게 다뤄요.' },
  { character: 'pavel', actionsAny: ['trace_print_route', 'deliver_scene_chain'], line: '파벨: 인쇄면과 사건철의 이동을 추적했던 당신이, 이제는 독법 자체가 이동한다는 걸 보게 됐어요.' }
]);

setScene('E07', [
  ['NARRATION', '마지막 봉투에는 증언, 사건철, 그리고 말이 언제 국가적 위험으로 불리는지에 대한 세 사람의 서로 다른 두려움이 들어 있다.'],
  ['alexei', '혐의와 자기변호는 분리해야 해. 하지만 말과 토론이 언제 공적 위험이 되는지도 기록의 책임이야.'],
  ['ekaterina', '문학적 주장이라고 해서 안전한 건 아니죠. 그렇다고 침묵을 국가의 판단과 같은 것으로 만들 수도 없어요.'],
  ['pavel', '나는 봉투를 건넬 수 있어요. 그래서 누구를 위험에 노출시키는지 모른 척할 수 없습니다.'],
  ['PLAYER_PROMPT', '말하기, 공식 기록, 자료 전달, 침묵 중 무엇이 이 순간의 책임인지 행동으로 선택하세요.']
], [
  pick('E07-A', '토론과 문학적 주장이 언제 혐의가 되는지 공개적으로 묻겠다. 말하기 자체를 범죄로 기록하지 않겠다.', 'spoken_risk_boundary', '예카테리나: 질문을 공개했다고 무죄가 되는 건 아니에요. 하지만 질문할 문턱을 없애지도 않았군요.', ['literaryArgument', 'publicDebate', 'riskAccepted', 'e07Evidence', 'chronologyBoundary'], { ekaterina: 1 }, 'spoken', 'E07-R1,E07-R2'),
  pick('E07-B', '혐의와 자기변호를 공식 기록의 층위로 나눠 적겠다. 확인된 사실 밖으로 사람을 밀어 넣지 않겠다.', 'official_record', '알렉세이: 책임질 수 있는 문장과 추측을 나눴군. 이번엔 그 선이 사람을 보호할 수도 있어.', ['publicCivicClaim', 'institutionalBoundary', 'e07Evidence', 'chronologyBoundary'], { alexei: 1 }, 'official-record', 'E07-R1'),
  pick('E07-C', '확인된 자료를 위험을 설명한 뒤 믿을 만한 독자에게 전달하겠다. 봉투를 건네는 책임도 내 몫이다.', 'routed_document', '파벨: 전달을 선택했군요. 이번에는 누가 다칠 수 있는지까지 적고 건네야 해요.', ['networkDelivery', 'riskAccepted', 'e07Evidence', 'chronologyBoundary'], { pavel: 1 }, 'routed-document', 'E07-R1,E07-R2,E07-R3'),
  pick('E07-D', '지금은 침묵하고 증언을 사적으로 보존하겠다. 침묵이 동의가 되지 않도록 이유를 남기겠다.', 'silence', '예카테리나: 침묵에도 책임을 적는다면, 목소리를 버리는 것과는 다르겠죠.', ['privateVoiceProtected', 'communalDuty', 'e07Evidence', 'chronologyBoundary'], { ekaterina: 1 }, 'silence', 'E07-R1,E07-R2')
], [
  pick('E07-P1', '발언을 기록한다. 말과 토론이 국가적 위험으로 취급되는 경계를 공개 논쟁의 문제로 남긴다.', 'spoken_public_argument', '예카테리나: 위험을 안 뒤에도 말할 자리를 남겼어요. 그건 판결을 대신하지 않지만 침묵도 아니죠.', ['literaryArgument', 'publicDebate', 'riskAccepted', 'e07Evidence', 'chronologyBoundary'], { ekaterina: 1 }, 'spoken', 'E07-R1,E07-R2'),
  pick('E07-P2', '공식 메모를 남긴다. 사건의 결말은 바꾸지 않고, 혐의·자기변호·확인 사실을 분리한다.', 'official_memo', '알렉세이: 공식 기록이 사람의 목소리를 삼키지 않도록 선을 남겼어. 그게 내가 책임질 수 있는 방식이야.', ['publicCivicClaim', 'institutionalBoundary', 'e07Evidence', 'chronologyBoundary'], { alexei: 1 }, 'official', 'E07-R1,E07-R2'),
  pick('E07-P3', '자료를 전달한다. 확인된 증언을 믿을 만한 독자에게 보내고, 노출될 위험을 함께 알린다.', 'send_to_trusted_reader', '파벨: 누군가를 위험에 빠뜨릴 수 있다는 사실까지 봉투에 넣었어요. 이제 전달은 내 선택이기도 합니다.', ['networkDelivery', 'riskAccepted', 'e07Evidence', 'chronologyBoundary'], { pavel: 1 }, 'routed-document', 'E07-R1,E07-R2,E07-R3'),
  pick('E07-P4', '침묵을 선택한다. 증언을 보존하되 지금 공개하지 않는 이유와 공동체의 안전을 함께 기록한다.', 'protective_silence', '세 사람은 침묵의 대가를 적는다. 누구도 그것을 중립이라고 부르지 않는다.', ['privateVoiceProtected', 'communalDuty', 'e07Evidence', 'chronologyBoundary'], {}, 'silence', 'E07-R1,E07-R2')
], [
  { character: 'alexei', actionsAny: ['public_citation', 'report_medical_fact_only', 'institutionalBoundaryChoice'], line: '알렉세이: 네가 푸시킨과 레르몬토프에서 범위를 지킨 선택을 기억해. 이제 그 책임이 사람의 말 앞에 서 있군.' },
  { character: 'ekaterina', actionsAny: ['preserve_public_grief', 'literaryArgumentChoice', 'interpret_captive_voice'], line: '예카테리나: 목소리를 보존하자고 했던 네 선택을 기억해요. 이번엔 그 원칙이 누군가를 위험에 빠뜨리지 않는지도 말해요.' },
  { character: 'pavel', actionsAny: ['trace_print_route', 'networkReception', 'dangerous_discussion'], line: '파벨: 당신은 계속 전달의 길을 물었죠. 이제 그 길 끝에 사람이 있다는 사실을 외면할 수 없어요.' }
]);

const makeEnding = (id, title, meaningStatement, lifeDirection, historicalOutcome, rule, dialogue, callbacks, sourceScenes, historicalAnalogyLimits) => ({
  id, title, meaningStatement, lifeDirection, historicalOutcome,
  rule: { ...rule, meaningStatement, requiredActions: rule.actionsAll, forbiddenActions: rule.noneFlags, relationshipGate: rule.minRelationships, sourceScenes },
  dialogue, callbacks, sourceScenes, historicalAnalogyLimits
});
data.endings = [
  makeEnding('UVAROV', '국가의 장부에 남는 사람', '확인된 사실·기관 책임·공식 문서의 경계를 우선한 삶의 방향.', '공적 질서와 기관 책임을 우선하는 관료적 경로를 택했다. 우바로프 체제와 의미상 가까운 선택이지, 우바로프와의 교류를 뜻하지 않는다.', '1849년의 국가 수사와 판결은 고정된다. 변하는 것은 가상 서기가 공식 기록의 책임을 감당하는 방식뿐이다.', { allFlags: ['publicCivicClaim', 'institutionalBoundary', 'e07Evidence', 'chronologyBoundary'], noneFlags: ['networkDelivery', 'riskAccepted', 'publicDebate'], minScenes: 5, actionsAll: ['public_citation', 'report_medical_fact_only', 'institutionalBoundaryChoice', 'official_record', 'official_memo'], minRelationships: { alexei: 4 } }, [['alexei', '당신은 처음부터 날짜와 확인 범위를 책임의 선으로 삼았어.'], ['alexei', '푸시킨의 부고와 레르몬토프 사건에서 멈춘 방식이 이번 공식 메모에도 남았지.'], ['NARRATION', '이것은 우바로프와의 만남이 아니다. 국가 관료적 질서와 기관 책임에 가까운 가상 서기의 방향이다.']], ['C03-A', 'C06-P1', 'C07-A', 'E07-B', 'E07-P2'], ['C03', 'C06', 'C07', 'E07'], 'historical analogy only; no direct contact or identity claim'),
  makeEnding('BELINSKY', '문학을 공론장에 남기는 사람', '문학적 주장과 검열을 공개 논쟁의 대상으로 남긴 삶의 방향.', '문학을 공적 비평과 논쟁의 장으로 보는 경로를 택했다. 벨린스키와 실제 친분을 맺었다는 뜻이 아니다.', '실제 검열과 1849년 판결은 바뀌지 않는다. 가상 서기는 문학적 주장을 토론 가능한 말로 보존한다.', { allFlags: ['literaryArgument', 'publicDebate', 'e07Evidence', 'chronologyBoundary'], noneFlags: ['networkDelivery', 'institutionalBoundary'], minScenes: 5, actionsAll: ['literaryArgumentChoice', 'interpret_captive_voice', 'literaryArgument', 'spoken_risk_boundary', 'spoken_public_argument'], minRelationships: { ekaterina: 4 } }, [['ekaterina', '당신은 작가의 목소리를 검열의 결론으로 줄이지 않았어요.'], ['ekaterina', '로스토프치나의 두 화자를 읽을 때도 문학이 공적 논쟁을 열 수 있다는 걸 기억했죠.'], ['NARRATION', '이것은 벨린스키와의 만남이 아니다. 문학을 공론장에 남기는 가상 서기의 방향이다.']], ['C07-B', 'E02-A', 'E02-P1', 'E07-A', 'E07-P1'], ['C07', 'E02', 'E07'], 'historical analogy only; no direct contact or identity claim'),
  makeEnding('HERZEN', '국경 밖으로 목소리를 보내는 사람', '제도 밖 전달망으로 비판적 목소리를 운반하되 노출 위험을 감당한 삶의 방향.', '위험을 설명하고 믿을 만한 독자에게 자료를 전달하는 제도 밖의 경로를 택했다. 헤르첸의 미래 해외 활동을 비유로만 참조한다.', '실제 1849년 수사와 판결은 변경되지 않는다. 가상 서기의 전달 선택만 달라진다.', { allFlags: ['networkDelivery', 'riskAccepted', 'e07Evidence', 'chronologyBoundary'], noneFlags: ['institutionalBoundary', 'publicCivicClaim'], minScenes: 5, actionsAll: ['trace_print_route', 'deliver_scene_chain', 'networkReception', 'routed_document', 'send_to_trusted_reader'], minRelationships: { pavel: 4 } }, [['pavel', '당신은 종이의 이동을 사람의 위험과 함께 보았어.'], ['pavel', '이번에는 봉투를 건네는 일이 책임이라는 걸 숨기지 않았고.'], ['NARRATION', '이것은 헤르첸과의 접촉이 아니다. 제도 밖으로 비판적 목소리를 보내는 가상 경로다.']], ['C03-C', 'C06-P3', 'E02-C', 'E07-C', 'E07-P3'], ['C03', 'C06', 'E02', 'E07'], 'future-direction analogy only; no 1849 direct contact claim'),
  makeEnding('KHOMYAKOV', '공동체의 책임을 중재하는 사람', '행정적 판단과 문학적 목소리 사이에서 공동체적·중재적 책임을 택한 삶의 방향.', '어느 한쪽의 승리보다 공동체가 함께 감당할 판단을 남겼다. 호먀코프와 동일한 사상을 가졌다고 단정하지 않는다.', '역사적 결과는 고정된다. 가상 서기는 서로 다른 목소리가 공동체 안에서 검토될 자리를 보존한다.', { allFlags: ['mediatedConflict', 'communalDuty', 'privateVoiceProtected', 'e07Evidence'], noneFlags: ['networkDelivery', 'institutionalBoundary'], minScenes: 5, actionsAll: ['preserve_public_grief', 'mark_missing_witness', 'suspend_verdict', 'reserve_poem_judgment', 'protective_silence'], minRelationships: { alexei: 3, ekaterina: 3 } }, [['alexei', '너는 행정의 빈칸을 혼자 메우지 않았어.'], ['ekaterina', '목소리를 보존하되 누구의 문장도 공동체 전체의 판정이라고 부르지 않았죠.'], ['NARRATION', '이것은 호먀코프와 동일한 사상을 선언하는 결말이 아니다. 중재와 공동체적 책임에 가까운 가상 방향이다.']], ['C03-B', 'C06-B', 'C07-C', 'E02-B', 'E07-D', 'E07-P4'], ['C03', 'C06', 'C07', 'E02', 'E07'], 'limited analogy; no identity or direct contact claim'),
  makeEnding('DOSTOEVSKY_PETRASHEVSKY', '위험한 토론의 문턱에 선 사람', '문학적 토론·서클·전달이 국가 수사의 경계에 닿는 위험을 감수한 삶의 방향.', '위험한 토론의 문턱에서 말하기와 전달의 책임을 함께 택했다. 도스토옙스키·페트라셰프스키와의 친분을 만들지 않는다.', '1849년의 수사와 판결은 고정된다. 가상 서기는 위험한 토론이 언제 국가적 혐의로 읽히는지 경험한다.', { allFlags: ['networkDelivery', 'riskAccepted', 'literaryArgument', 'e07Evidence', 'chronologyBoundary'], noneFlags: ['institutionalBoundary'], minScenes: 5, actionsAll: ['map_scene_inspection', 'deliver_scene_chain', 'dangerous_discussion', 'spoken_risk_boundary', 'spoken_public_argument'], minRelationships: { pavel: 3, ekaterina: 2 } }, [['pavel', '전달은 단순한 기술이 아니었어. 네가 위험한 토론을 건넨 순간, 사람의 이름도 함께 움직였지.'], ['ekaterina', '말할 권리를 남겼지만 그 말이 안전하다고 꾸미지는 않았어요.'], ['NARRATION', '이것은 실존 인물과의 친분을 뜻하지 않는다. 위험한 토론과 국가 수사의 경계에 가까운 가상 방향이다.']], ['C03-C', 'C06-C', 'C06-P3', 'E02-P3', 'E07-A', 'E07-P1'], ['C06', 'E02', 'E07'], 'historical analogy only; no direct contact or identity claim')
];
data.endingPolicy = 'V34 endings require meaningStatement, requiredActions, forbiddenActions, relationshipGate, sourceScenes, and multi-scene action history; no final-choice-only fallback is eligible.';
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', schemaVersion: data.schemaVersion, scenes: data.scenes.map((item) => item.id), endings: data.endings.map((item) => item.id) }, null, 2));
