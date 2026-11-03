import { createRenderer } from './engine/renderer.js';
import { objectIsPresent, questPrerequisitesMet } from './engine/world-presentation.mjs';
import { questChoices, continuationQuest } from './engine/quest-presentation.mjs';
import { guideToResident, resolveQuestGuidance } from './engine/quest-guidance.mjs';
import { ownsKeyboardInput, observationText } from './engine/player-presentation.mjs';
import { availableDiscussionQuests, discussionBoardView, discussionPromptsForHost, discussionReflectionPromptsForHost } from './engine/discussion-quests.mjs';
import { dialogueSessionNeedsReconnect, selectDialogueTurn } from './engine/dialogue-response.mjs';
import { appendApiDiagnostic, clearApiDiagnostics, readApiDiagnostics } from './engine/api-diagnostics.mjs';
import { CITY_PRODUCTS, NEWSPAPER_STORIES, newspaperAssignment, purchaseCityProduct, publishNewspaperIssue, shareSourceWithEditor, readNewspaperIssue, circulateNewspaperIssue, commitSuspiciousAct, resolvePoliceCustody, publishedIssueLabel } from './engine/civic-life.mjs';
import { availableTopics, contextualOpening } from './ai/authored-dialogue.mjs';
import { advanceStudy, beginExam, buildLifeTimeline, chooseCirclePath, completeLearning, getExamQuestions, selectExamAnswer, submitExam } from './engine/learning-life.mjs';
import './engine/game-state.js';
const { createInitialState, moveActor, possessHost, releaseHost, transitionMap, performQuestAction, saveGame, loadGame, nearTile, knowledgeForHost, recordSourceRead, recordEvidenceRead, recordDialogueTurn, recordDiscussionPosition, enterLiteraryRealm, leaveLiteraryRealm, advanceChapter, advanceCampaignDate, resolveEnding, describeHostMoney } = globalThis.V33GameState;

const readJson = async path => (await fetch(path)).json();
const [street, shop, chancery, courtyard, marketMap, literaryMap, overcoatMap, policeMap, firstQuest, marketPersonalQuests, source, firstIssue, historicalSources, literarySource, overcoatSource, campaign, publicQuest, circleQuest, letterQuest, literaryQuest, overcoatQuest, sceneObservations, aiScenes, learningExam, learningSourceData, lifeTemplates, historicalComparisons] = await Promise.all([readJson('./rpg/maps/nevsky.json'), readJson('./rpg/maps/printshop.json'), readJson('./rpg/maps/chancery.json'), readJson('./rpg/maps/courtyard.json'), readJson('./rpg/maps/market-quay.json'), readJson('./rpg/maps/dead-souls.json'), readJson('./rpg/maps/overcoat.json'), readJson('./rpg/maps/police-station.json'), readJson('./rpg/quests/printshop-article.json'), Promise.all(['yard-ledger-1847','laundry-wages-1847','bakery-flour-1847','market-prices-1847','porter-load-1847','coach-fare-1847','household-privacy-1847','midwife-care-cost-1847','apothecary-limits-1847','apprentice-authorship-1847','bookbinder-damage-1847','scribal-copy-1847','inn-debt-rumor-1847','student-circle-risk-1847','teacher-access-cost-1847','noble-status-debt-1847','landlady-rent-commons-1847','water-access-queue-1847','fish-storage-time-1847','warehouse-loss-record-1847','servant-private-warning-1847','guard-entry-bribe-1847','carter-delivery-delay-1847','street-vendor-weather-1847','typesetter-speed-censorship-1847','lodging-reading-income-1847','clerk-alexei-life-1-1847','clerk-alexei-life-2-1847','clerk-alexei-life-3-1847','courier-pavel-life-1-1847','courier-pavel-life-2-1847','courier-pavel-life-3-1847','seamstress-anna-life-1-1847','seamstress-anna-life-2-1847','seamstress-anna-life-3-1847','bookseller-lev-life-1-1847','bookseller-lev-life-2-1847','bookseller-lev-life-3-1847'].map(id => readJson(`./rpg/quests/${id}.json`))), readJson('./rpg/data/khor-kalynych-source.json'), readJson('./rpg/data/sovremennik-1847-issue.json'), readJson('./rpg/data/historical-source-packets.json'), readJson('./rpg/data/dead-souls-source.json'), readJson('./rpg/data/overcoat-source.json'), readJson('./rpg/quests/campaign.json'), readJson('./rpg/quests/public-discourse-1848.json'), readJson('./rpg/quests/circle-investigation-1849.json'), readJson('./rpg/quests/circle-letter-1849-may.json'), readJson('./rpg/quests/literary-dead-souls.json'), readJson('./rpg/quests/literary-overcoat.json'), readJson('./rpg/data/scene-observations.json'), readJson('./rpg/ai/scenes.json'), readJson('./rpg/data/learning-exam.json'), readJson('./rpg/data/learning-sources.json'), readJson('./rpg/data/life-simulation.json'), readJson('./rpg/data/historical-comparisons.json')]);
const [sourceReaderIndex, caseContextData, discussionQuestData, districtRegistry] = await Promise.all([readJson('./rpg/data/source-reader-index.json'), readJson('./rpg/data/case-contexts.json'), readJson('./rpg/data/discussion-quests.json'), readJson('./rpg/data/city-districts-v36.json')]);
const cards = await Promise.all(['clerk_alexei','printer_ekaterina','courier_pavel','seamstress_anna','tenant_mikhail','bookseller_lev','senior_clerk_konstantin','reader_darya','editor_sofia','police_sergeant_ivan','yardkeeper_semyon','laundress_mariya','baker_fyodor','market_nadezhda','porter_gavrila','coachman_timofey','housemaid_olga','midwife_avdotya','apothecary_yakov','print_apprentice_stepan','bookbinder_elizaveta','scribal_yuri','innkeeper_irina','student_vasily','teacher_lyubov','minor_noble_andrei','landlady_polina','watercarrier_luka','fishseller_klavdiya','warehouse_pyotr','servant_varvara','junior_guard_sergey','carter_roman','street_vendor_matryona','typesetter_nikita','lodging_tatyana','nekrasov_reconstruction','literary_chichikov','literary_akaky','literary_petrovich'].map(id => readJson(`./rpg/characters/${id}.json`)));
const maps = { nevsky: street, printshop: shop, chancery, courtyard, 'market-quay': marketMap, 'dead-souls': literaryMap, overcoat: overcoatMap, 'police-station': policeMap }, hostCards = cards;
const residentQuestBatchTwo = ['market-nadezhda-life-extra-1-1847','market-nadezhda-life-extra-2-1847','market-nadezhda-life-extra-3-1847','porter-gavrila-life-extra-1-1847','porter-gavrila-life-extra-2-1847','porter-gavrila-life-extra-3-1847','warehouse-pyotr-life-extra-1-1847','warehouse-pyotr-life-extra-2-1847','warehouse-pyotr-life-extra-3-1847','baker-fyodor-life-extra-1-1847','baker-fyodor-life-extra-2-1847','baker-fyodor-life-extra-3-1847','landlady-polina-life-extra-1-1847','landlady-polina-life-extra-2-1847','landlady-polina-life-extra-3-1847','carter-roman-life-extra-1-1847','carter-roman-life-extra-2-1847','carter-roman-life-extra-3-1847'];
const addedPersonalQuests = await Promise.all(['editor-publication-record-1847','police-testimony-record-1849','reader-source-and-rumor-1847','senior-clerk-review-and-signature-1847','tenant-rent-and-firewood-1847',
  'editor-sofia-chain-1-stage-1-1847','editor-sofia-chain-1-stage-2-1847','editor-sofia-chain-1-stage-3-1847',
  'police-sergeant-ivan-chain-2-stage-1-1847','police-sergeant-ivan-chain-2-stage-2-1847','police-sergeant-ivan-chain-2-stage-3-1847',
  'reader-darya-chain-3-stage-1-1847','reader-darya-chain-3-stage-2-1847','reader-darya-chain-3-stage-3-1847',
  'housemaid-olga-chain-4-stage-1-1847','housemaid-olga-chain-4-stage-2-1847','housemaid-olga-chain-4-stage-3-1847',
  'midwife-avdotya-chain-5-stage-1-1847','midwife-avdotya-chain-5-stage-2-1847','midwife-avdotya-chain-5-stage-3-1847',
  'junior-guard-sergey-chain-6-stage-1-1847','junior-guard-sergey-chain-6-stage-2-1847','junior-guard-sergey-chain-6-stage-3-1847',...residentQuestBatchTwo].map(id => readJson(`./rpg/quests/${id}.json`)));
const questList = [firstQuest, publicQuest, circleQuest, letterQuest, literaryQuest, overcoatQuest, ...marketPersonalQuests, ...addedPersonalQuests];
const questsById = new Map(questList.map(item => [item.id, item]));
const relationHintValues = new Map();
for (const quest of questList) for (const action of quest.actions ?? []) {
  for (const [group, relation] of Object.entries(action.effects?.relations ?? {})) {
    if (!relationHintValues.has(group)) relationHintValues.set(group, new Set());
    relationHintValues.get(group).add(relation);
  }
}
relationHintValues.set('reading_circle', new Set(['초대에 응해 독서 모임에 다녀왔다.', '모임에 참석해 책 제목만 수첩에 남겼다.', '독서 모임 초대를 사양했다.']));
relationHintValues.set('examPreparation', new Set(['시험 대신 함께 공부했다']));
relationHintValues.set('market_nadezhda', new Set(['빵값을 치른 거래 이웃']));
relationHintValues.set('baker_fyodor', new Set(['빵을 산 거래 이웃']));
function relationshipHintsFor(hostId) {
  const relations = state.hosts[hostId]?.relations ?? {};
  return Object.fromEntries(Object.entries(relations).filter(([group, value]) => relationHintValues.get(group)?.has(value)));
}
function playerActionHintsFor(hostId) {
  return state.ledger.filter(entry => entry.hostId === hostId && ['HISTORICAL_ACTION', 'LITERARY_ACTION'].includes(entry.eventType))
    .slice(-12).map(({ questId, actionId }) => ({ questId, actionId }));
}
const sourceRecords = new Map([source, firstIssue, ...historicalSources.records, literarySource, overcoatSource].map(record => [record.sourceId, record]));
const sourceReaderRecords = new Map(sourceReaderIndex.records.map(record => [record.sourceId, record]));
const caseContextsByQuest = new Map(caseContextData.cases.map(item => [item.questId, item]));
const discussionQuestById = new Map(discussionQuestData.quests.map(item => [item.id, item]));
const districtById = new Map(districtRegistry.districts.map(item => [item.id, item]));
const currentDiscussionQuests = () => availableDiscussionQuests(state, discussionQuestData);
const initial = () => createInitialState({ maps, hostCards, quests: questList });
let state;
try { state = localStorage.getItem('v33-rpg-save') ? loadGame(localStorage.getItem('v33-rpg-save'), { maps, hostCards, quests: questList, learningExam }) : initial(); }
catch { state = initial(); }
const canvas = document.querySelector('#world'), renderer = createRenderer(canvas, { hostCards, quests: questList });
const $ = selector => document.querySelector(selector);
const caseContextButton = document.createElement('button');
caseContextButton.id = 'case-context-open'; caseContextButton.type = 'button'; caseContextButton.hidden = true; caseContextButton.textContent = '사건 맥락 보기';
caseContextButton.addEventListener('click', () => {
  const hostId = state.player.embodiment, context = caseContextsByQuest.get(missionGuidance?.questId), role = context?.roles?.[hostId];
  if (!context || !role) return;
  const questions = role.discussionQuestions.map(question => `· ${question}`).join('\n');
  const text = `${role.entrySituationKo}\n\n${context.playerFacing.premiseKo}\n\n${role.personalStakesKo}\n\n${context.playerFacing.decisionQuestionKo}\n\n이 인물이 던질 질문\n${questions}\n\n${context.historicalBoundaryKo}`;
  const sourceActions = context.sourceIds.map(id => sourceRecords.get(id)).filter(Boolean).map(record => ({
    label: `관련 자료 · ${record.titleKo}`,
    subcopy: `${record.sourceId} · ${sourceReaderRecords.get(record.sourceId)?.pageLocator ?? record.range ?? record.witness?.range ?? ''}`,
    run: () => {
      const physical = currentNearby().some(item => item.type === 'source' && mapObjectProperties(item).sourceId === record.sourceId);
      if (physical) sourceRead(record.sourceId);
      else sourceRead(record.sourceId, context.sourceIds, 'PLAYER_ARCHIVE');
    },
  }));
  say(context.playerFacing.sceneTitleKo, text, sourceActions);
});
$('.mission-controls').append(caseContextButton);
let lastMoveAt = 0, renderFrame = null, renderTimer = null, activeDialogueHost = null, activeDialogueKey = null, activeDialogueController = null, dialogueGeneration = 0, dialogueRequestPending = false;
const dialogueSessions = new Map(), dialogueTranscripts = new Map();
const dialogueCurrentLines = new Map();
const dialogueFailedQuestions = new Map();
const hasLiveDialogue = key => !dialogueSessionNeedsReconnect(dialogueSessions.get(key));
const dialogueKey = (actorHostId, speakerHostId) => `${actorHostId}::${speakerHostId}`;
const dialogueStorageKey = key => `v33-rpg-session:${key}`;
const aiBaseUrl = '';
function saveApiError(entry) { appendApiDiagnostic(localStorage, entry); }
function recordApiFailure(endpoint, error) {
  if (error?.apiCode && error.apiCode !== 'BLOCKED_NO_KEY') saveApiError({ endpoint, kind: 'client_error', code: error.apiCode });
  else if (!error?.status) saveApiError({ endpoint, kind: error?.name === 'SyntaxError' ? 'client_error' : 'network_error', code: error?.name === 'AbortError' ? 'timeout' : error?.name === 'SyntaxError' ? 'invalid_response_json' : 'network_error' });
}
function dialogueApiFailure(error) {
  if (error?.apiCode === 'invalid_scene_context') return '현재 목표 문맥을 확인하지 못했습니다. 질문은 기록되지 않았으니 다시 시도해 주세요.';
  if (error?.apiCode === 'client_response_invalid') return 'API가 응답했지만 대화 형식 검증에 실패했습니다. 설정의 오류 기록과 Vercel Function 로그를 확인해 주세요.';
  if (error?.apiCode === 'invalid_response_json' || error?.name === 'SyntaxError') return 'API 응답을 JSON으로 읽지 못했습니다. 설정의 오류 기록과 Vercel Function 로그를 확인해 주세요.';
  if (error?.apiCode === 'BLOCKED_NO_KEY') return 'Vercel에 OPENAI_API_KEY가 설정되지 않았습니다.';
  if (error?.apiCode === 'ai_not_configured') return 'Vercel에 OPENAI_API_KEY가 설정되지 않았습니다.';
  if (error?.status === 502 && error?.apiCode) return `AI 답변 생성 실패 · ${providerFailureLabel(error.apiCode)}. 같은 질문을 다시 보낼 수 있습니다.`;
  if (error?.status === 404) return location.hostname.endsWith('.github.io')
    ? 'GitHub Pages에는 서버 API가 없습니다. Vercel에 배포된 같은 게임 주소를 열어야 AI 대화를 사용할 수 있습니다.'
    : '이 배포에는 대화 API가 없습니다. Vercel master 최신 배포를 열어 주세요.';
  if (error?.status === 403) return '게임 주소와 API 주소가 다릅니다. 같은 Vercel 도메인에서 열어 주세요.';
  if (error?.status === 401) return '대화 세션이 만료되었습니다. 새 연결로 다시 시도합니다.';
  if (error?.status === 429) return '대화 요청 한도에 도달했습니다. 잠시 뒤 다시 시도해 주세요.';
  if (error?.status === 503) return 'Vercel 대화 기능이 준비되지 않았습니다. 환경 변수와 Function 로그를 확인해 주세요.';
  if (error?.status === 500) return 'Vercel 대화 Function 내부 오류입니다. Function 로그를 확인해 주세요.';
  if (error?.status) return `대화 세션을 열지 못했습니다 · HTTP ${error.status}${error.apiCode ? ` (${error.apiCode})` : ''}`;
  return '대화 API에 연결하지 못했습니다. Vercel 배포 주소와 네트워크를 확인해 주세요.';
}
function providerFailureLabel(code) {
  const known = {
    network_error: 'OpenAI 연결 실패', timeout: 'OpenAI 응답 시간 초과', http_401: 'OpenAI API 키 인증 실패',
    http_403: 'OpenAI 키 권한 또는 프로젝트 접근 거부', http_429: 'OpenAI 사용량 한도 또는 속도 제한',
    http_500: 'OpenAI 서버 오류', http_502: 'OpenAI 게이트웨이 오류', http_503: 'OpenAI 일시 중단',
    incomplete_response: '모델 응답 미완료', incomplete_max_output_tokens: '응답 토큰 한도 부족', incomplete_content_filter: '모델 응답 안전 필터 중단', missing_output: '모델 응답 본문 없음', malformed_json: '모델 구조화 응답 해석 실패',
    response_schema_invalid: '모델 응답 형식 검증 실패', unsupported_historical_year: '역사 연도 근거 검증 실패',
    uncited_historical_person: '인물 근거 검증 실패', undisclosed_player_context: '비공개 맥락 보호 검증 실패',
    provider_response_validation: '모델 응답 검증 실패',
  };
  return known[code] ?? `응답 생성 실패 (${String(code || 'unknown').slice(0, 40)})`;
}
async function openDialogueSession(card, actorCard, signal) {
  const response = await fetch(`${aiBaseUrl}/api/rpg/session/start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hostId: card.id, actorHostId: actorCard.id }), signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    saveApiError({ endpoint: '/api/rpg/session/start', kind: 'http_error', status: response.status, code: body.error || 'session_start_failed' });
    throw Object.assign(new Error('dialogue_session_unavailable'), { status: response.status, apiCode: body.error });
  }
  const result = await response.json().catch(error => { error.apiCode = 'invalid_response_json'; throw error; });
  if (result.mode === 'BLOCKED_NO_KEY') { saveApiError({ endpoint: '/api/rpg/session/start', kind: 'provider_not_configured', status: response.status, code: 'blocked_no_key' }); throw Object.assign(new Error('dialogue_provider_not_configured'), { apiCode: 'BLOCKED_NO_KEY' }); }
  if (!result.sessionToken || result.mode !== 'AI') { saveApiError({ endpoint: '/api/rpg/session/start', kind: 'http_error', status: response.status, code: result.mode || 'invalid_session' }); throw Object.assign(new Error('dialogue_session_invalid'), { apiCode: result.mode || 'invalid_session' }); }
  return { token: result.sessionToken, mode: 'AI' };
}
let missionGuidance = null, destinationPinned = false, journalReturnFocus = null;
let queuedDiscussionInquiry = null, showAllDiscussionQuestions = false;
const tutorialStorageKey = 'v34-tutorial-stage';
let tutorialStage = localStorage.getItem(tutorialStorageKey) ?? '0';
const tutorialCopy = [
  '먼저 가까운 사람에게 다가가 보세요. 이미 곁에 있으면 바로 살펴보기를 눌러도 됩니다.',
  '사람 가까이에서 E 또는 살펴보기를 누르면 그 사람의 사정과 몸을 빌리는 선택이 나옵니다.',
  '몸을 빌리면 그 사람의 자리와 아는 것이 적용됩니다. 아래 목표에서 지금 할 일을 확인하세요.',
  'J 또는 수첩 열기로 해야 할 일, 가진 것, 읽은 자료를 나누어 볼 수 있습니다.',
  '해야 할 일을 읽었으면 수첩을 닫으세요. 필요할 때 목적지를 표시할 수 있습니다.',
  '표시된 곳에 가서 실제 문서나 물건을 살펴보세요. 조사와 선택이 기록되어야 다음 단계로 넘어갑니다.',
  '사람 가까이에서 말 걸기를 누르세요. 선택지는 빠른 대답이고, 직접 입력은 원하는 말입니다.',
  '대화를 마치면 아래 ‘생각과 사건을 묻는 임무’에서 쟁점을 하나 고르세요. 질문을 담고 서로 다른 두 사람에게 같은 문제를 물은 뒤, 답을 비교하고 내 입장을 수첩에 기록하면 됩니다.',
];
function updateTutorial() {
  const card = $('#tutorial-card');
  const active = tutorialStage !== 'done' && Number(tutorialStage) < tutorialCopy.length;
  card.hidden = !active;
  if (active) { $('#tutorial-step').textContent = `처음 안내 · ${Number(tutorialStage) + 1} / ${tutorialCopy.length} · ${tutorialCopy[Number(tutorialStage)]}`; $('#tutorial-skip').textContent = '건너뛰기'; }
}
function tutorialAdvance(eventName) {
  if (tutorialStage === 'done') return;
  const stage = Number(tutorialStage);
  const advances = { move: [[0,1]], inspect: [[0,2],[1,2]], possess: [[2,3]], journalOpen: [[3,4]], journalClose: [[4,5]], target: [[5,6]], talk: [[6,7]], finish: [[7,8]] };
  const nextStage = advances[eventName]?.find(([from]) => from === stage)?.[1];
  if (nextStage !== undefined) {
    tutorialStage = String(nextStage);
    if (Number(tutorialStage) >= tutorialCopy.length) tutorialStage = 'done';
    localStorage.setItem(tutorialStorageKey, tutorialStage); updateTutorial();
  }
}
function learningActionButton(label, run, subcopy = '') {
  const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
  if (subcopy) { const note = document.createElement('small'); note.textContent = subcopy; button.append(note); }
  button.addEventListener('click', run); return button;
}
function writeLearningProgress(progress, eventType = null, details = {}) {
  if (!progress || progress === state.learning) return;
  const next = structuredClone(state); next.learning = progress;
  if (eventType) next.ledger.push({ eventId: `LEARNING_${next.ledger.length + 1}`, eventType, date: next.world.date, ...details });
  setState(next);
  localStorage.setItem('v33-rpg-save', saveGame(next));
  $('#load').disabled = false;
}
function chooseCircle(choice) {
  const nextProgress = chooseCirclePath(state.learning, choice);
  if (nextProgress === state.learning) return;
  const next = structuredClone(state); next.learning = nextProgress;
  const pavel = next.hosts.courier_pavel;
  pavel.relations ??= {};
  pavel.situationNotes ??= [];
  const notes = {
    attended: ['초대에 응해 독서 모임에 다녀왔다.', '모임에서 함께 책을 읽었다.'],
    'attended-notes': ['모임에 참석해 책 제목만 수첩에 남겼다.', '책 제목만 적고 참석자의 말을 기록하지 않았다.'],
    declined: ['독서 모임 초대를 사양했다.', '초대를 사양했지만 공개 교재로 시험 내용을 공부할 수 있다.'],
  }[choice];
  pavel.relations.reading_circle = notes[0];
  pavel.situationNotes.push(notes[1]);
  next.ledger.push({ eventId: `LEARNING_${next.ledger.length + 1}`, eventType: 'CIRCLE_LEARNING_CHOICE', date: next.world.date, choice, sourceIds: [] });
  setState(next); localStorage.setItem('v33-rpg-save', saveGame(next)); $('#load').disabled = false; renderLearning();
}
function hideLearningScreen() {
  $('#learning-screen').hidden = true; document.body.classList.remove('learning-active');
  say('학습을 잠시 멈췄다', '여기까지의 진행과 선택한 답은 저장됐다. 마지막 자료를 다시 살펴보면 이어서 열 수 있다.', [{ label: '학습을 이어간다', run: showLearningHub }]);
}
function showLearningHub() {
  if (state.learning.phase === 'complete') { showEndingChoices(); return; }
  renderLearning(true);
}
function renderLearning(focus = false) {
  const screen = $('#learning-screen'), content = $('#learning-content'), controls = $('#learning-controls'), learning = state.learning;
  screen.hidden = false; document.body.classList.add('learning-active'); content.replaceChildren(); controls.replaceChildren();
  $('#learning-leave').onclick = hideLearningScreen;
  $('#learning-save').onclick = () => { localStorage.setItem('v33-rpg-save', saveGame(state)); $('#learning-save-state').textContent = '현재 단계와 답을 저장했습니다.'; $('#load').disabled = false; };
  const addButton = (label, run, note = '') => controls.append(learningActionButton(label, run, note));
  const persist = (progress, eventType, details) => { writeLearningProgress(progress, eventType, details); renderLearning(); };
  if (learning.phase === 'circle-choice') {
    $('#learning-stage').textContent = '독서 모임 · 초대장'; $('#learning-title').textContent = '파벨이 저녁 모임을 권했다';
    $('#learning-intro').textContent = '모임에 갈지, 책 제목만 적을지, 초대를 사양할지 정할 수 있다. 참석 기록은 공식 장부에 들어가지 않는다.';
    const choices = [
      ['모임에 참석한다', 'attended', '창고의 독서방에서 책과 사료를 읽고 이야기를 듣는다 · 공식 장부에는 남지 않는다 · 참석자에게 얼굴이 알려진다'],
      ['참석해 책 제목만 적는다', 'attended-notes', '독서방에는 가되 발언은 옮기지 않는다 · 수첩에는 책 제목만 남긴다 · 수첩을 잃으면 노출될 수 있다'],
      ['초대를 사양한다', 'declined', '모임에는 가지 않는다 · 같은 시험 범위는 공개 교재로 공부할 수 있다 · 파벨과 거리가 생길 수 있다'],
    ];
    for (const [label, value, note] of choices) addButton(label, () => chooseCircle(value), note);
  } else if (learning.phase === 'learning' || learning.phase === 'public-prep') {
    const unit = learningExam.learningUnits[learning.lessonIndex];
    if (!unit) { persist({ ...learning, phase: 'exam-choice' }); return; }
    const attendee = learning.phase === 'learning';
    $('#learning-stage').textContent = attendee ? `독서방 · ${learning.lessonIndex + 1} / ${learningExam.learningUnits.length}` : `공개 교재 · ${learning.lessonIndex + 1} / ${learningExam.publicPrepUnitIds.length}`;
    $('#learning-title').textContent = unit.title;
    $('#learning-intro').textContent = attendee ? '창고의 작은 독서방. 문서에 적힌 내용과 이 방에서 만든 허구의 장면을 나눠 읽는다.' : '모임에 가지 않아도 볼 수 있는 공개 준비 자료다. 참석자와 같은 다섯 문항, 같은 정답 기준으로 시험을 본다.';
    const body = document.createElement('p'); body.className = 'learning-unit-body'; body.textContent = unit.bodyKo; content.append(body);
    const fiction = document.createElement('p'); fiction.className = 'learning-fiction-note'; fiction.textContent = `이야기를 위한 장면 · ${unit.fictionalElements?.join(' · ') ?? '가상의 서기가 자료를 읽는 장면'}`; content.append(fiction);
    if (attendee && learning.circleLearning === 'attended') for (const line of unit.speakerLines ?? []) {
      const voice = document.createElement('p'); voice.className = 'learning-voice'; voice.textContent = `${({ alexei: '알렉세이', ekaterina: '예카테리나', pavel: '파벨', protagonist: '서기' })[line.speaker] ?? line.speaker} · “${line.text}”`; content.append(voice);
    }
    if (unit.provenance?.quotedRussian) {
      const excerpt = document.createElement('blockquote'); excerpt.className = 'learning-excerpt'; excerpt.textContent = unit.provenance.quotedRussian; content.append(excerpt);
      if (unit.provenance.projectTranslationKo) { const translation = document.createElement('p'); translation.className = 'learning-translation'; translation.textContent = unit.provenance.projectTranslationKo; content.append(translation); }
    }
    if (unit.provenance?.contextNoteKo) { const context = document.createElement('p'); context.className = 'learning-context'; context.textContent = unit.provenance.contextNoteKo; content.append(context); }
    const source = learningSourceData.sources.find(item => item.sourceId === unit.provenance?.sourceId);
    if (source) {
      const citation = document.createElement('p'); citation.className = 'learning-citation'; citation.textContent = `${source.sourceId} · ${source.authorOrIssuer} · ${source.edition}\n확인 범위: ${unit.provenance.startLocator} → ${unit.provenance.endLocator}`; content.append(citation);
      const link = document.createElement('a'); link.href = source.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = '원문·자료 설명 열기'; link.className = 'learning-source-link'; content.append(link);
    }
    if (learning.lessonIndex > 0) addButton('이전 자료', () => persist({ ...learning, lessonIndex: learning.lessonIndex - 1 }, null));
    addButton(learning.lessonIndex + 1 >= learningExam.learningUnits.length ? '시험 선택으로' : '다음 자료', () => {
      const nextProgress = advanceStudy(learning, learningExam);
      const eventType = unit.sourceIds?.length ? 'LEARNING_UNIT_READ' : null;
      persist(nextProgress, eventType, { learningUnitId: unit.id, sourceIds: [...(unit.sourceIds ?? [])], publicPreparation: learning.phase === 'public-prep' });
    }, `문항에 쓰이는 자료 · ${unit.sourceIds.join(', ')}`);
  } else if (learning.phase === 'exam-choice') {
    $('#learning-stage').textContent = '진급 시험 · 선택'; $('#learning-title').textContent = '이번 회차를 어떻게 할까';
    $('#learning-intro').textContent = '시험에 응시하거나, 미루거나, 파벨과 함께 공부할 수 있다. 모임에 갔는지는 문항과 합격 기준을 바꾸지 않는다.';
    const note = document.createElement('p'); note.className = 'learning-result-note'; note.textContent = '응시하면 사실 확인 문항 5개를 풀고 3개 이상 맞힐 때 이번 회차 진급 자격을 얻는다. 미루기와 동료 돕기는 점수 없이 기록된다.'; content.append(note);
    const takeExamAction = (action, eventType) => {
      const progress = beginExam(state.learning, action), next = structuredClone(state); next.learning = progress;
      if (action === 'help-peer') {
        const pavel = next.hosts.courier_pavel; pavel.situationNotes ??= []; pavel.relations ??= {};
        pavel.situationNotes.push('가상의 서기와 진급 시험 조항을 함께 공부했다.');
        pavel.relations.examPreparation = '시험 대신 함께 공부했다';
      }
      next.ledger.push({ eventId: `LEARNING_${next.ledger.length + 1}`, eventType, date: next.world.date, partnerHostId: action === 'help-peer' ? 'courier_pavel' : undefined, score: null });
      setState(next); localStorage.setItem('v33-rpg-save', saveGame(next)); renderLearning();
    };
    addButton('시험에 응시한다', () => takeExamAction('sit', 'EXAM_STARTED'), '모임 참석 여부와 무관하게 같은 다섯 문항에 답한다');
    addButton('이번 회차를 미룬다', () => takeExamAction('defer', 'EXAM_DEFERRED'), '점수와 승패를 기록하지 않는다 · 승진은 보류된다');
    addButton('파벨과 함께 공부한다', () => takeExamAction('help-peer', 'EXAM_HELPED_PEER'), '시험은 보지 않는다 · 파벨과의 공부 기록을 남긴다');
    addButton('자료를 다시 읽는다', () => persist({ ...learning, phase: learning.circleLearning === 'declined' ? 'public-prep' : 'learning', lessonIndex: 0 }, null));
  } else if (learning.phase === 'exam') {
    $('#learning-stage').textContent = `진급 시험 · ${Object.keys(learning.examAnswers ?? {}).length} / ${learningExam.questionCount} 답`; $('#learning-title').textContent = '문서에서 확인한 사실';
    $('#learning-intro').textContent = '정답은 앞서 읽은 자료에 적힌 사실로 정한다. 다섯 문항 중 세 문항 이상을 맞히면 이번 회차에 진급 자격을 얻는다.';
    for (const [index, question] of learningExam.questions.entries()) {
      const fieldset = document.createElement('fieldset'); fieldset.className = 'exam-question';
      const legend = document.createElement('legend'); legend.textContent = `${index + 1}. ${question.prompt}`; fieldset.append(legend);
      for (const option of question.options) {
        const label = document.createElement('label'); label.className = 'exam-option';
        const radio = document.createElement('input'); radio.type = 'radio'; radio.name = question.id; radio.value = option.id; radio.checked = learning.examAnswers?.[question.id] === option.id;
        radio.addEventListener('change', () => {
          const next = selectExamAnswer(state.learning, question.id, option.id, learningExam);
          writeLearningProgress(next);
          const count = Object.keys(next.examAnswers).length;
          $('#learning-stage').textContent = `진급 시험 · ${count} / ${learningExam.questionCount} 답`;
          const submit = $('#learning-controls [data-submit-exam]'); if (submit) submit.disabled = count !== learningExam.questionCount;
        });
        const text = document.createElement('span'); text.textContent = option.text; label.append(radio, text); fieldset.append(label);
      }
      const citation = document.createElement('small'); citation.className = 'exam-source'; citation.textContent = `확인할 자료 · ${question.sourceIds.join(', ')}`; fieldset.append(citation); content.append(fieldset);
    }
    const submit = learningActionButton('답안을 제출한다', () => {
      const result = submitExam(state.learning, state.learning.examAnswers, learningExam);
      persist(result, 'EXAM_SUBMITTED', { correctCount: result.examCorrectCount, outcome: result.examOutcome });
    }, '제출 뒤에는 이번 회차 점수와 승진 자격을 확인할 수 있다');
    submit.dataset.submitExam = 'true'; submit.disabled = Object.keys(learning.examAnswers ?? {}).length !== learningExam.questionCount; controls.append(submit);
  } else if (learning.phase === 'result') {
    $('#learning-stage').textContent = '진급 시험 · 결과';
    const resultText = {
      passed: ['이번 회차는 통과했다', `${learning.examCorrectCount} / ${learningExam.questionCount}개 정답. 가상의 서기는 이번 회차 진급 자격을 얻었다. 실제 관등표의 절차와 역사적 사건은 바뀌지 않는다.`],
      failed: ['이번 회차는 통과하지 못했다', `${learning.examCorrectCount} / ${learningExam.questionCount}개 정답. 이번 회차 진급은 이뤄지지 않는다. 답안은 기록에 남고 이후의 역사 사건은 바뀌지 않는다.`],
      deferred: ['이번 회차를 미뤘다', '점수는 기록하지 않았다. 진급 여부도 보류 상태로 남는다.'],
      'helped-peer': ['파벨과 함께 공부했다', '시험 점수는 없다. 파벨과 조항을 함께 살펴본 일이 서기의 이후 삶에 남는다.'],
    }[learning.examOutcome] ?? ['결과를 확인할 수 없다', '학습 화면을 다시 열어 진행을 확인하자.'];
    $('#learning-title').textContent = resultText[0]; $('#learning-intro').textContent = resultText[1];
    const record = document.createElement('p'); record.className = 'learning-result-note'; record.textContent = `점수 · ${learning.examCorrectCount == null ? '미기록' : `${learning.examCorrectCount} / ${learningExam.questionCount}`}　진급 · ${{ promoted: '이번 회차 자격 획득', 'not-promoted': '이번 회차에는 해당 없음', pending: '보류' }[learning.promotionStatus]}`; content.append(record);
    addButton('마지막 기록으로 이어간다', () => {
      const progress = completeLearning(state.learning);
      writeLearningProgress(progress, 'LEARNING_ARC_COMPLETED', { circleLearning: progress.circleLearning, examOutcome: progress.examOutcome, promotionStatus: progress.promotionStatus });
      $('#learning-screen').hidden = true; document.body.classList.remove('learning-active'); showEndingChoices();
    }, '다섯 결말은 앞서 한 역사적 행동으로 결정된다');
  } else {
    $('#learning-stage').textContent = '독서 모임'; $('#learning-title').textContent = '다음 장으로 이어진다';
    $('#learning-intro').textContent = '선택한 공부 방식과 시험 결과가 이후 삶의 연표에 반영된다.';
    addButton('마지막 기록으로 이어간다', showEndingChoices);
  }
  $('#learning-save-state').textContent = '진행 단계와 답안은 선택할 때마다 이 기기에 저장됩니다.';
  if (focus) requestAnimationFrame(() => $('#learning-title').focus());
}
function classifyTypedResponse(input) {
  const text = String(input).toLocaleLowerCase('ko-KR');
  if (/출처|사료|원문|자료|문서|근거/.test(text)) return 'SOURCE_REQUEST';
  if (/누가|보여|공개|들키|위험|문책|비밀|기밀/.test(text)) return 'RISK_QUESTION';
  if (/해\s*줘|보내|전달|옮기|적어|기록하|보류|멈추|도와/.test(text)) return 'ACTION_REQUEST';
  if (/왜|어떻|느끼|가족|좋아|싫어|걱정|이름/.test(text)) return 'PERSONAL_QUESTION';
  return 'GENERAL_CONVERSATION';
}

const relationLabels = { editorial_office: '편집부', workshop: '작업장 동료', source_readers: '출처를 확인하는 독자', postal_route: '우편 경로', local_readers: '가게의 독자들', office_supervisor: '상급자', archive_keeper: '문서 담당자', market_nadezhda: '나데즈다와', baker_fyodor: '표도르와' };
function render(now) {
  renderFrame = null;
  const map = currentMap();
  renderer.draw(state, map, now, lastMoveAt, { ...missionGuidance, pinned: destinationPinned });
  const animate = renderer.needsAmbientFrames(map) && document.visibilityState !== 'hidden';
  if (now - lastMoveAt < 360 || animate) renderTimer = window.setTimeout(() => { renderTimer = null; requestRender(); }, animate ? 80 : 40);
}
function requestRender() {
  if (renderTimer !== null) { window.clearTimeout(renderTimer); renderTimer = null; }
  if (renderFrame === null) renderFrame = requestAnimationFrame(render);
}
window.addEventListener('resize', requestRender, { passive: true });
document.addEventListener('visibilitychange', requestRender);
window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', requestRender);
function say(title, text, actions = []) {
  $('#headline').textContent = title;
  $('#journal-text').textContent = text;
  const readyQuest = continuationQuest(state, campaign, questList);
  const persistentLabel = readyQuest ? continuationFor(readyQuest)[0].label : null;
  const visibleActions = actions.filter(action => action.label !== persistentLabel);
  $('#actions').replaceChildren(...visibleActions.map(({ label, subcopy, run, disabled = false }) => {
    const button = document.createElement('button');
    button.type = 'button'; button.disabled = disabled;
    const heading = document.createElement('span'); heading.textContent = label; button.append(heading);
    if (subcopy) { const detail = document.createElement('small'); detail.textContent = subcopy; button.append(detail); }
    button.addEventListener('click', run);
    return button;
  }));
  $('.journal').scrollTop = 0;
}
const setState = next => {
  const oldHost = state?.player?.embodiment, oldQuest = missionGuidance?.questId;
  state = next; updateHud();
  if (oldHost !== state.player.embodiment || oldQuest !== missionGuidance?.questId) { destinationPinned = false; updateHud(); }
  requestRender();
};
function currentMap() { return maps[state.world.currentMapId]; }
function actor() { return state.player.embodiment ? state.hosts[state.player.embodiment] : state.player; }
function mapObjectProperties(object) { return Object.fromEntries((object?.properties ?? []).map(property => [property.name, property.value])); }
function mapWithSource(sourceId) {
  const candidates = Object.values(maps).filter(map => map.layers?.find(layer => layer.name === 'Interactions')?.objects.some(object => mapObjectProperties(object).sourceId === sourceId));
  return candidates.find(map => map.mapId === state.world.currentMapId) ?? candidates[0] ?? null;
}
function nearbyConversationPartner() {
  const actorId = state.player.embodiment;
  if (!actorId) return null;
  const position = state.hosts[actorId].position;
  return Object.values(state.hosts).map(person => ({ person, card: cards.find(card => card.id === person.id) })).filter(({ person, card }) => {
    return card && person.historicalAliveAndPresent && card.id !== actorId && person.mapId === state.world.currentMapId && Math.abs(person.position.x - position.x) + Math.abs(person.position.y - position.y) <= 2;
  }).sort((a, b) => {
    const aPosition = a.person.position, bPosition = b.person.position;
    return Math.abs(aPosition.x - position.x) + Math.abs(aPosition.y - position.y) - Math.abs(bPosition.x - position.x) - Math.abs(bPosition.y - position.y);
  })[0]?.card ?? null;
}
function updateHud() {
  const map = currentMap(), host = state.player.embodiment ? cards.find(card => card.id === state.player.embodiment) : null;
  $('#place').textContent = districtById.get(map.metadata.districtId)?.nameKo ?? map.metadata.displayNameKo; $('#mapname').textContent = map.metadata.displayNameKo;
  document.body.classList.toggle('literary-world', Boolean(state.world.activeRealm));
  const [year, month, day] = state.world.date.split('-').map(Number);
  $('#world-date').textContent = state.world.activeRealm ? '문학 속 1842년' : `${year}년 ${month}월`;
  $('#calendar-date').textContent = state.world.activeRealm ? '소설 속 장면' : `${year}년 ${month}월 ${day}일`;
  const dayMinute = ((state.world.clockMinutes ?? 540) % 1440 + 1440) % 1440;
  $('#clock').textContent = state.world.activeRealm ? '문학 세계 · 1842' : `${String(Math.floor(dayMinute / 60)).padStart(2, '0')}:${String(dayMinute % 60).padStart(2, '0')}`;
  $('#bodyname').textContent = state.player.civic?.custody?.active ? `경찰 접수실 · 조사 대기 · ${cards.find(card => card.id === state.player.civic.custody.hostId)?.displayNameKo ?? '당사자'}` : host ? `몸을 빌림 · ${host.displayNameKo}` : '바깥에서 바라보는 중';
  $('#coins').textContent = host ? (state.hosts[host.id].money.amount == null ? '자금 기록 없음' : `${state.hosts[host.id].money.amount} 코페이카`) : '몸을 빌리면 주머니를 확인할 수 있습니다';
  $('#release').disabled = !host || Boolean(activeDialogueHost);
  const conversationPartner = nearbyConversationPartner();
  $('#talk').textContent = conversationPartner ? `말 걸기 · ${conversationPartner.displayNameKo}` : '가까이서 말하기';
  $('#talk').disabled = !host || !conversationPartner || Boolean(activeDialogueHost);
  document.querySelectorAll('.touch-pad button').forEach(button => { button.disabled = Boolean(activeDialogueHost && !button.hasAttribute('data-move')); });
  $('#load').disabled = !localStorage.getItem('v33-rpg-save');
  missionGuidance = resolveQuestGuidance({ state, quests: questList, maps, hostCards: cards });
  const tracker = $('#mission-tracker'); tracker.hidden = Boolean(state.endingId);
  $('#mission-identity').textContent = host ? `현재 빙의: ${host.displayNameKo} · ${host.occupation}` : '현재 인물: 관찰자';
  $('#mission-title').textContent = missionGuidance.questTitleKo ?? '지금 할 일';
  $('#mission-action').textContent = `${missionGuidance.actionKo}${missionGuidance.placeKo ? ` · ${missionGuidance.placeKo}` : ''}`;
  $('#mission-reason').textContent = missionGuidance.reasonKo ?? '';
  $('#mission-method').textContent = missionGuidance.blocked ? `막힘 · ${missionGuidance.blockedReasonKo ?? '조건을 확인하세요.'}` : missionGuidance.howKo ?? '';
  if (state.player.civic?.custody?.active) {
    $('#mission-title').textContent = '경찰 접수실에서 진술하기';
    $('#mission-action').textContent = `접수 사유 · ${state.player.civic.custody.reasonKo}`;
    $('#mission-reason').textContent = '진술서를 쓰거나 8코페이카를 내야 거리로 돌아갈 수 있습니다.';
    $('#mission-method').textContent = '접수 창구에 다가가 살펴보세요.';
  } else if (host) {
    const press = newspaperAssignment(state, host.id, maps);
    if (press) {
      $('#mission-title').textContent = press.titleKo;
      $('#mission-action').textContent = `${press.actionKo} · ${press.placeKo}`;
      $('#mission-reason').textContent = press.reasonKo;
      $('#mission-method').textContent = press.howKo;
    }
  }
  if (queuedDiscussionInquiry) {
    const targetHost = state.hosts[queuedDiscussionInquiry.hostId];
    const targetGuide = targetHost ? guideToResident({ state, maps, hostCards: cards, targetHostId: targetHost.id }) : null;
    const nextAction = !host ? '먼저 질문할 인물과 다른 주민의 몸을 빌리세요' : host.id === queuedDiscussionInquiry.hostId ? '다른 주민의 몸을 빌린 뒤 이 인물에게 말을 거세요' : '표시된 상대에게 가까이 가서 말을 거세요';
    missionGuidance = {
      ...missionGuidance,
      questId: queuedDiscussionInquiry.questId,
      phaseId: 'opinion-inquiry',
      hostId: queuedDiscussionInquiry.hostId,
      taskType: host?.id === queuedDiscussionInquiry.hostId ? 'TALK' : host ? 'TRAVEL' : 'POSSESS',
      questTitleKo: `생각·사건 임무 · ${queuedDiscussionInquiry.titleKo}`,
      actionKo: `${queuedDiscussionInquiry.hostNameKo}에게 물어보기 · ${queuedDiscussionInquiry.progressKo}`,
      reasonKo: queuedDiscussionInquiry.stakesKo,
      howKo: `${nextAction}. ${targetGuide?.howKo ?? ''} 준비한 질문은 대화 선택지 맨 앞에 놓입니다.`,
      placeKo: targetGuide?.placeKo ?? (targetHost ? maps[targetHost.mapId]?.metadata.displayNameKo : '위치를 확인할 수 없음'),
      target: targetGuide?.target ?? null,
      progress: { completedSteps: queuedDiscussionInquiry.completedPerspectives, totalSteps: queuedDiscussionInquiry.requiredPerspectives },
      known: true,
      blocked: !targetHost || Boolean(targetGuide?.blocked),
    };
    $('#mission-title').textContent = missionGuidance.questTitleKo;
    $('#mission-action').textContent = missionGuidance.actionKo;
    $('#mission-reason').textContent = missionGuidance.reasonKo;
    $('#mission-method').textContent = missionGuidance.howKo;
    $('#mission-progress').textContent = `${missionGuidance.progress.completedSteps} / ${missionGuidance.progress.totalSteps} 관점`;
    $('#mission-pin').disabled = !missionGuidance.target;
    $('#mission-pin').setAttribute('aria-pressed', String(destinationPinned && Boolean(missionGuidance.target)));
    $('#mission-pin').textContent = destinationPinned && missionGuidance.target ? '목적지 표시 중' : '목적지 표시';
    $('#pin-legend').hidden = !(destinationPinned && missionGuidance.target);
  }
  const caseContext = host ? caseContextsByQuest.get(missionGuidance.questId) : null;
  caseContextButton.hidden = !caseContext?.roles?.[host.id] || Boolean(state.endingId);
  const discussionQuests = currentDiscussionQuests();
  const discussionBoard = $('#discussion-quest-board');
  const discussionHost = conversationPartner;
  const reflectionPrompts = discussionHost ? discussionReflectionPromptsForHost(discussionHost.id, state, discussionQuests) : [];
  const discussionView = discussionBoardView(discussionQuests, discussionHost?.id ?? null,
    Object.fromEntries(cards.map(card => [card.id, card.displayNameKo])), discussionQuestData.quests.length);
  discussionBoard.hidden = (!discussionView.visible && !reflectionPrompts.length) || Boolean(state.endingId);
  $('#discussion-quest-progress').textContent = discussionView.progressKo;
  $('#discussion-quest-guidance').textContent = queuedDiscussionInquiry
    ? `선택한 질문 · ${queuedDiscussionInquiry.titleKo} — ${queuedDiscussionInquiry.hostNameKo}에게 “${queuedDiscussionInquiry.promptKo}”라고 물어보세요. 현재 위치: ${state.hosts[queuedDiscussionInquiry.hostId]?.mapId === map.mapId ? '이 구역' : maps[state.hosts[queuedDiscussionInquiry.hostId]?.mapId]?.metadata.displayNameKo ?? '다른 구역'}. ${host ? '가까이 다가가 말을 걸면 대화 선택지 맨 앞에 나타납니다.' : '그 인물 가까이서 E를 눌러 몸을 빌린 뒤, 다시 가까이서 말을 거세요.'}`
    : discussionView.guidanceKo;
  const inquiryRows = discussionView.recommendations ?? [];
  const followUpRows = reflectionPrompts.slice(0, 2).map(prompt => `비교 메모 후속 대화 · ${discussionHost.displayNameKo}에게: “${prompt.promptKo}”`);
  const inquiryList = $('#discussion-quest-items');
  const visibleInquiries = showAllDiscussionQuestions ? inquiryRows : inquiryRows.slice(0, 8);
  const positionRows = (discussionView.positionPrompts ?? []).flatMap(prompt => prompt.choices.map(choice => {
    const li = document.createElement('li');
    const detail = document.createElement('span');
    detail.textContent = `${prompt.titleKo} · 내 입장: ${choice.labelKo} — ${choice.consequenceKo}`;
    const choose = document.createElement('button');
    choose.type = 'button';
    choose.className = 'discussion-position-select';
    choose.textContent = '이 입장으로 기록';
    choose.addEventListener('click', () => {
      const result = recordDiscussionPosition(state, { discussionId: prompt.questId, positionId: choice.id }, discussionQuestData);
      if (!result.ok) { sayRecord(result.reason === 'position_already_recorded' ? '이 쟁점에 대한 내 입장은 이미 수첩에 남아 있습니다.' : '두 인물의 관점을 먼저 모아야 내 입장을 기록할 수 있습니다.'); return; }
      setState(result.state);
      queuedDiscussionInquiry = null;
      destinationPinned = false;
      sayRecord(`내 입장을 수첩에 남겼습니다 · ${choice.labelKo}`);
    });
    li.append(detail, choose);
    return li;
  }));
  inquiryList.replaceChildren(...(visibleInquiries.length || followUpRows.length
    ? [
      ...visibleInquiries.map(item => {
        const li = document.createElement('li');
        const detail = document.createElement('span');
        const targetState = state.hosts[item.hostId];
        const targetPlaceKo = maps[targetState?.mapId]?.metadata.displayNameKo ?? '위치 확인 중';
        const evidenceTitles = (discussionQuestById.get(item.questId)?.sourceIds ?? []).map(id => sourceRecords.get(id)?.titleKo).filter(Boolean);
        detail.textContent = `${item.titleKo} · ${item.progressKo} · ${item.hostNameKo} (${targetPlaceKo})에게: “${item.promptKo}”${item.stakesKo ? ` — ${item.stakesKo}` : ''}${evidenceTitles.length ? ` · 관련 자료: ${evidenceTitles.join(', ')}` : ''}`;
        const choose = document.createElement('button');
        choose.type = 'button'; choose.className = 'discussion-inquiry-select';
        choose.textContent = queuedDiscussionInquiry?.questId === item.questId && queuedDiscussionInquiry?.hostId === item.hostId ? '선택됨' : '이 질문 담기';
        choose.setAttribute('aria-pressed', String(queuedDiscussionInquiry?.questId === item.questId && queuedDiscussionInquiry?.hostId === item.hostId));
        choose.addEventListener('click', () => {
          queuedDiscussionInquiry = item;
          destinationPinned = true;
          updateHud();
          const target = state.hosts[item.hostId];
          const place = maps[target?.mapId]?.metadata.displayNameKo ?? '현재 위치';
          sayRecord(`${item.titleKo} 질문을 담았습니다. ${place}에 있는 ${item.hostNameKo}에게 물어보세요. 먼저 다른 주민의 몸을 빌린 뒤, 그 인물 가까이서 말 걸기를 누르면 질문이 대화 선택지 맨 앞에 나타납니다.`);
        });
        li.append(detail, choose);
        return li;
      }),
      ...followUpRows.map(text => Object.assign(document.createElement('li'), { textContent: text })),
      ...positionRows,
    ]
    : positionRows.length ? positionRows : [Object.assign(document.createElement('li'), { textContent: discussionHost ? '이 인물에게 남은 관점 질문이 없습니다. 다른 사람에게 같은 쟁점을 묻거나 수첩의 관점 노트를 살펴보세요.' : '생각·이념·역사 사건을 살피려면 질문을 담고, 표시된 인물에게 다가가 말을 거세요.' })]));
  const moreQuestions = $('#discussion-quest-more');
  moreQuestions.hidden = inquiryRows.length <= 8;
  moreQuestions.textContent = showAllDiscussionQuestions ? '임무 목록 접기' : `다른 사건·이념 임무 보기 · ${inquiryRows.length - 8}개`;
  moreQuestions.onclick = () => { showAllDiscussionQuestions = !showAllDiscussionQuestions; updateHud(); };
  $('#mission-progress').textContent = missionGuidance.progress?.totalSteps ? `${missionGuidance.progress.completedSteps} / ${missionGuidance.progress.totalSteps}` : '';
  $('#mission-pin').disabled = !missionGuidance.target;
  $('#mission-pin').setAttribute('aria-pressed', String(destinationPinned && Boolean(missionGuidance.target)));
  $('#mission-pin').textContent = destinationPinned && missionGuidance.target ? '목적지 표시 중' : '목적지 표시';
  $('#pin-legend').hidden = !(destinationPinned && missionGuidance.target);
  const readyQuest = continuationQuest(state, campaign, questList);
  const routeButton = $('#route-continue');
  routeButton.hidden = !readyQuest || Boolean(activeDialogueHost);
  if (readyQuest) routeButton.textContent = continuationFor(readyQuest)[0].label;
  $('#host-notebook').hidden = true;
  const oldFacts = $('#host-facts'); if (oldFacts) oldFacts.replaceChildren();
  $('#journal-host-name').textContent = host ? `${host.displayNameKo} · ${host.occupation}` : '관찰자';
  $('#journal-title').textContent = host ? `${host.displayNameKo}의 수첩` : '현장 수첩';
  $('#journal-quest-title').textContent = missionGuidance.questTitleKo ?? '지금 할 일';
  $('#journal-goal-action').textContent = missionGuidance.actionKo ?? '';
  $('#journal-goal-reason').textContent = missionGuidance.reasonKo ?? '';
  $('#journal-goal-how').textContent = missionGuidance.howKo ?? '';
  $('#journal-goal-place').textContent = `장소 · ${missionGuidance.placeKo ?? map.metadata.displayNameKo}`;
  $('#journal-completed').textContent = missionGuidance.progress?.totalSteps ? `이 사건 진행 · ${missionGuidance.progress.completedSteps} / ${missionGuidance.progress.totalSteps} 완료` : '';
  $('#journal-pin').disabled = !missionGuidance.target;
  $('#journal-pin').textContent = destinationPinned ? '목적지 표시 중' : '목적지 표시';
  const fill = (selector, rows, tag = 'li') => { const list = $(selector); list.replaceChildren(...rows.map(value => { const item = document.createElement(tag); item.textContent = value; return item; })); };
  for (const selector of ['#journal-inventory','#journal-relations','#journal-sources','#journal-history','#journal-perspective-notes','#journal-today-goals']) $(selector).replaceChildren();
  if (host) {
    const live = state.hosts[host.id], known = host.secretKnowledge.filter(item => live.privateKnowledgeIds.includes(item.id)).map(item => item.summaryKo);
    const goalList = $('#journal-today-goals');
    for (const goal of host.todayGoals ?? []) {
      const item = document.createElement('li'), title = document.createElement('strong'), body = document.createElement('span');
      title.textContent = `${goal.titleKo} · `; body.textContent = goal.textKo; item.append(title, body); goalList.append(item);
    }
    if (live.knownEvidenceIds.includes(source.sourceId)) known.push('투르게네프 「호리와 칼리니치」 원문');
    for (const record of historicalSources.records) if (live.knownEvidenceIds.includes(record.sourceId)) known.push(`${record.documentDate} · ${record.titleKo}`);
    for (const id of live.knownEvidenceIds) {
      const clue = sceneObservations.entries[id];
      if (clue) known.push(clue.titleKo);
    }
    const discussionItems = [
      ...(state.player.dialogueGrowth?.comparisonNotes ?? []).map(note => `관점 대조 메모 · ${note.titleKo}`),
      ...(state.player.dialogueGrowth?.playerPositions ?? []).map(note => `내 입장 · ${note.titleKo} · ${note.labelKo}`),
    ];
    const visibleInventory = [...live.inventory.map(item => publishedIssueLabel(state, item) ?? CITY_PRODUCTS.find(product => product.id === item)?.titleKo ?? item), ...discussionItems];
    $('#journal-inventory').append(...(visibleInventory.length ? visibleInventory : ['따로 기록된 물건이 없습니다.']).map(value => { const li=document.createElement('li');li.textContent=value;return li; }));
    const relations = Object.entries(live.relations ?? {}).map(([group,status])=>`${relationLabels[group] ?? group} · ${status}`).concat(live.situationNotes ?? []);
    fill('#journal-relations', relations.length ? relations : ['아직 기록된 관계 변화가 없습니다.']);
    fill('#journal-sources', known.length ? known : ['이 몸으로 확인한 자료와 단서가 없습니다.']);
  }
  if (!host) {
    const discussionItems = [
      ...(state.player.dialogueGrowth?.comparisonNotes ?? []).map(note => `관점 대조 메모 · ${note.titleKo}`),
      ...(state.player.dialogueGrowth?.playerPositions ?? []).map(note => `내 입장 · ${note.titleKo} · ${note.labelKo}`),
    ];
    $('#journal-inventory').append(...(discussionItems.length ? discussionItems : ['따로 기록된 물건이 없습니다.']).map(value => { const li=document.createElement('li');li.textContent=value;return li; }));
  }
  const dialogueGrowth = state.player.dialogueGrowth ?? { insight: 0, aiReplies: 0, perspectiveNotes: [] };
  $('#journal-growth-stats').textContent = `AI 대화 ${dialogueGrowth.aiReplies}회 · 모은 관점 ${dialogueGrowth.insight}개 · 대조 메모 ${dialogueGrowth.comparisonNotes?.length ?? 0}개 · 내 입장 ${dialogueGrowth.playerPositions?.length ?? 0}개`;
  const reflectionRows = (dialogueGrowth.perspectiveNotes ?? []).map(note => {
    const quest = discussionQuestById.get(note.discussionId), hostCard = cards.find(item => item.id === note.hostId);
    return `${note.date} · ${quest?.titleKo ?? '대화에서 얻은 관점'} · ${hostCard?.displayNameKo ?? '대화 상대'}의 시각`;
  });
  for (const note of dialogueGrowth.comparisonNotes ?? []) {
    const quest = discussionQuestById.get(note.discussionId);
    const names = note.hostIds.map(id => cards.find(item => item.id === id)?.displayNameKo).filter(Boolean);
    reflectionRows.push(`${note.date} · 대조 메모: ${note.titleKo} · ${names.join(' ↔ ')}`);
  }
  for (const note of dialogueGrowth.playerPositions ?? []) reflectionRows.push(`${note.date} · 내 입장: ${note.titleKo} · ${note.labelKo}`);
  fill('#journal-perspective-notes', reflectionRows.length ? reflectionRows : ['사건이나 생각에 관한 질문을 AI와 나누면 이곳에 관점 메모와 통찰이 쌓입니다.']);
  const logs = state.ledger.slice(-12).reverse().map(entry => {
    if (entry.eventType === 'DIALOGUE_TURN') return `${entry.date} · ${entry.discussionId ? `견해 질문 · ${discussionQuestById.get(entry.discussionId)?.titleKo ?? '주제 대화'}` : `${cards.find(item=>item.id===entry.hostId)?.displayNameKo ?? '대화'}와 이야기함`}`;
    if (entry.eventType === 'HISTORICAL_ACTION' || entry.eventType === 'LITERARY_ACTION') { const q=questsById.get(entry.questId), a=q?.actions.find(item=>item.id===entry.actionId); return `${entry.date} · ${a?.labelKo ?? '문서에 선택을 남김'}`; }
    if (entry.eventType === 'READ_SOURCE') return `${entry.date} · 자료를 읽음`;
    if (entry.eventType === 'OBSERVE_EVIDENCE') return `${entry.date} · 현장의 흔적을 살펴봄`;
    if (entry.eventType === 'CITY_PURCHASE') return `${entry.date} · 가판대에서 ${CITY_PRODUCTS.find(product => product.id === entry.productId)?.titleKo ?? '물건'} 구입 · ${entry.priceKopeks} 코페이카`;
    if (entry.eventType === 'NEWSPAPER_PUBLISHED') return `${entry.date} · 신문 인쇄 · ${NEWSPAPER_STORIES.find(story => story.id === entry.storyId)?.titleKo ?? entry.storyId}`;
    if (entry.eventType === 'NEWSPAPER_CIRCULATED') return `${entry.date} · 신문 배포 · ${entry.route === 'postal' ? '지방행 우편' : '거리 독자'}`;
    if (entry.eventType === 'SUSPICIOUS_ACT' || entry.eventType === 'POLICE_CUSTODY' || entry.eventType === 'POLICE_RELEASE') return `${entry.date} · ${entry.eventType === 'SUSPICIOUS_ACT' ? '수상한 행동 기록' : entry.eventType === 'POLICE_CUSTODY' ? '경찰 접수·연행' : '경찰 접수실 석방'}`;
    return null;
  }).filter(Boolean);
  fill('#journal-history', logs.length ? logs : ['아직 남긴 기록이 없습니다.'], 'li');
  updateTutorial();
}
function setJournalTab(name) {
  document.querySelectorAll('[data-journal-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.journalTab === name)));
  document.querySelectorAll('[data-journal-panel]').forEach(panel => { panel.hidden = panel.dataset.journalPanel !== name; });
  $('#journal-title').textContent = ({ goal: '해야 할 일', inventory: '지금 가진 것', people: '인물과 관계', sources: '읽은 자료', reflections: '관점 노트', history: '지난 기록' })[name] ?? '해야 할 일';
}
function openJournal() {
  journalReturnFocus = document.activeElement;
  setJournalTab('goal'); $('#quest-journal').showModal(); $('#journal-close').focus();
  tutorialAdvance('journalOpen');
}
function closeJournal() {
  const dialog = $('#quest-journal'); if (dialog.open) dialog.close();
  tutorialAdvance('journalClose');
  if (journalReturnFocus?.isConnected) journalReturnFocus.focus();
}
function toggleDestinationPin() {
  if (!missionGuidance?.target) return;
  destinationPinned = !destinationPinned;
  updateHud(); requestRender();
}
function renderApiDiagnostics() {
  const rows = readApiDiagnostics(localStorage);
  const list = $('#api-diagnostics-list');
  list.replaceChildren(...(rows.length ? rows : [{ at: '', endpoint: '', kind: '', status: null, code: '' }]).map(entry => {
    const item = document.createElement('li');
    item.textContent = entry.at
      ? `${new Date(entry.at).toLocaleString('ko-KR')} · ${entry.endpoint} · ${entry.kind} · HTTP ${entry.status ?? '—'} · ${entry.code}`
      : '이 브라우저에 저장된 API 오류가 없습니다.';
    return item;
  }));
}
async function checkApiHealth() {
  const stateText = $('#api-health-state'), detail = $('#api-health-detail'), checked = $('#api-health-checked');
  const button = $('#api-health-refresh'); button.disabled = true; stateText.textContent = '확인 중…'; detail.textContent = '모델 생성은 요청하지 않습니다.';
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('/api/rpg/health', { cache: 'no-store', signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    checked.textContent = `마지막 확인 · ${new Date().toLocaleString('ko-KR')}`;
    if (!response.ok || body.status !== 'ok') {
      saveApiError({ endpoint: '/api/rpg/health', kind: 'health_error', status: response.status, code: body.error || 'health_unavailable' });
      stateText.textContent = `API 확인 실패 · HTTP ${response.status}`;
      detail.textContent = response.status === 404 && location.hostname.endsWith('.github.io')
        ? 'GitHub Pages는 정적 파일만 제공합니다. AI 대화는 Vercel의 master 배포 주소에서 사용하세요.'
        : response.status === 404 ? '이 배포에서 /api/rpg/health 경로를 찾지 못했습니다. Vercel의 master Production 배포를 확인하세요.' : 'Vercel Function 응답과 배포 로그를 확인하세요.';
    } else if (body.ai === 'configured') {
      stateText.textContent = '서버 키 확인됨 · 모델 응답은 미검증';
      detail.textContent = '여기서는 Vercel Function과 OPENAI_API_KEY 설정만 확인했습니다. 실제 모델 답변은 아래의 답변 시험이나 인물 대화로 확인하세요. 생성에 실패하면 고정 대사로 대신하지 않고 오류와 재시도 버튼을 표시합니다.';
    } else {
      stateText.textContent = '대화 API 응답 · 서버 키 미설정';
      detail.textContent = '대화 API 경로는 응답하지만 Vercel에 OPENAI_API_KEY가 설정되지 않아 실제 모델 대화는 생성할 수 없습니다.';
    }
  } catch (error) {
    const code = error?.name === 'AbortError' ? 'timeout' : 'network_error';
    saveApiError({ endpoint: '/api/rpg/health', kind: 'health_error', code });
    stateText.textContent = 'API 확인 실패';
    detail.textContent = code === 'timeout' ? '8초 안에 응답하지 않았습니다. 네트워크 또는 Vercel Function 로그를 확인하세요.' : '네트워크에 연결하지 못했습니다. 배포 주소와 브라우저 연결을 확인하세요.';
    checked.textContent = `마지막 확인 · ${new Date().toLocaleString('ko-KR')}`;
  } finally {
    clearTimeout(timer); button.disabled = false; renderApiDiagnostics();
  }
}
async function probeApiGeneration() {
  const button = $('#api-generation-probe'), result = $('#api-generation-probe-result');
  button.disabled = true;
  result.textContent = '실제 AI 답변을 요청하는 중…';
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 26000);
  try {
    const headers = { 'content-type': 'application/json' };
    const startResponse = await fetch('/api/rpg/session/start', { method: 'POST', headers, body: JSON.stringify({ hostId: 'printer_ekaterina', actorHostId: 'clerk_alexei' }), cache: 'no-store', signal: controller.signal });
    const session = await startResponse.json().catch(() => ({}));
    if (!startResponse.ok || !session.sessionToken || session.mode !== 'AI') {
      const code = session.mode === 'BLOCKED_NO_KEY' ? 'BLOCKED_NO_KEY' : session.error || 'session_start_failed';
      result.textContent = `AI 답변 시험 실패 · ${dialogueApiFailure({ apiCode: code, status: startResponse.status })}`;
      saveApiError({ endpoint: '/api/rpg/session/start', kind: code === 'BLOCKED_NO_KEY' ? 'provider_not_configured' : 'client_error', status: code === 'BLOCKED_NO_KEY' ? null : startResponse.status, code: code.toLowerCase() });
      return;
    }
    const response = await fetch('/api/rpg/dialogue', { method: 'POST', headers, cache: 'no-store', signal: controller.signal, body: JSON.stringify({
      sessionToken: session.sessionToken, requestId: crypto.randomUUID(),
      playerInput: '인쇄된 문장의 책임은 글을 쓴 사람과 활자를 다룬 사람에게 어떻게 나뉜다고 생각하나요?',
    }) });
    const data = await response.json().catch(() => ({}));
    const selection = selectDialogueTurn(data);
    if (!response.ok || selection.kind !== 'generated') {
      const code = data.providerErrorCode || response.headers.get('x-v33-provider-result') || data.error || `http_${response.status}`;
      result.textContent = `AI 답변 시험 실패 · ${providerFailureLabel(code)}`;
      saveApiError({ endpoint: '/api/rpg/dialogue', kind: 'provider_error', status: response.status, code });
      return;
    }
    result.textContent = `AI 생성 성공 · ${data.turn.beats.map(beat => beat.textKo).join(' ')}`;
  } catch (error) {
    const code = error?.name === 'AbortError' ? 'timeout' : 'network_error';
    result.textContent = `AI 답변 시험 실패 · ${dialogueApiFailure({ apiCode: code })}`;
    saveApiError({ endpoint: '/api/rpg/dialogue', kind: 'network_error', code });
  } finally {
    clearTimeout(timer); button.disabled = false; renderApiDiagnostics();
  }
}
function sayRecord(text) { $('#record').textContent = text; }
function currentNearby() {
  const at = actor().position;
  const people = Object.values(state.hosts).filter(host => host.historicalAliveAndPresent && host.mapId === currentMap().mapId).map(host => ({
    type: 'npc', x: host.position.x * 16, y: host.position.y * 16,
    properties: [{ name: 'hostId', value: host.id }],
  }));
  const interactables = [...currentMap().layers.find(layer => layer.name === 'Interactions').objects, ...people];
  return interactables.filter(object => {
    if (!objectIsPresent(object, state, questList)) return false;
    const props = Object.fromEntries((object.properties ?? []).map(p => [p.name, p.value]));
    const host = object.type === 'npc' ? state.hosts[props.hostId] : null;
    if (object.type === 'npc' && (!host || host.mapId !== currentMap().mapId)) return false;
    if (object.type === 'npc' && props.hostId === state.player.embodiment) return false;
    const position = object.type === 'npc' ? host.position : { x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) };
    return nearTile(at, position, object.type === 'npc' ? 2 : 1);
  });
}
function questIsAvailable(activeQuest) {
  const literary = Boolean(activeQuest?.realmId || activeQuest?.chapterId?.startsWith('LITERARY_'));
  return Boolean(activeQuest && questPrerequisitesMet(state, activeQuest) && (literary ? state.world.activeRealm?.id === (activeQuest.realmId ?? activeQuest.chapterId) : activeQuest.chapterId === state.world.chapterId) && (!activeQuest.date || activeQuest.date <= state.world.date || literary));
}
let pendingSourceRead = null;
let sourceReaderMode = ['bilingual', 'ko', 'ru'].includes(localStorage.getItem('v35-source-reader-mode')) ? localStorage.getItem('v35-source-reader-mode') : 'bilingual';
function applySourceReaderMode(mode) {
  if (!['bilingual', 'ko', 'ru'].includes(mode)) return;
  sourceReaderMode = mode; localStorage.setItem('v35-source-reader-mode', mode);
  const dialog = $('#source-reader'); dialog.dataset.readingMode = mode;
  dialog.querySelectorAll('[data-reading-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.readingMode === mode)));
}
$('#source-reader').querySelectorAll('[data-reading-mode]').forEach(button => button.addEventListener('click', () => applySourceReaderMode(button.dataset.readingMode)));
function sourceRead(sourceId, archiveSourceIds = [], readingMode = 'PHYSICAL_COPY') {
  const record = sourceRecords.get(sourceId);
  if (!record) { sayRecord('자료 목록에서 확인되지 않는 문서다.'); return; }
  const prepared = recordSourceRead(state, sourceId, maps, archiveSourceIds, readingMode);
  if (!prepared.ok) { sayRecord(prepared.reason === 'source_not_present' ? '이 장소나 시점에는 아직 열람할 수 없는 자료다.' : '이 자료를 지금은 읽을 수 없다.'); return; }
  openSourceReader(record, { nextState: prepared.state, readingMode });
}
function openSourceReader(record, { nextState = null, readingMode = null } = {}) {
  const dialog = $('#source-reader'), index = sourceReaderRecords.get(record.sourceId), isTurgenev = record.sourceId === source.sourceId;
  if (!index) { sayRecord('이 자료의 서지 표시 정보를 찾지 못했다.'); return; }
  const context = isTurgenev ? index.contextKo : index.contextKo ?? record.contextKo;
  const provenance = `${record.creator ?? record.author ?? ''}\n작성·문서 시점: ${index.documentDate ?? index.creationDate ?? record.documentDate ?? record.dateCreated ?? '기재 없음'}\n최초 간행: ${index.publicationDate ?? record.firstPublication ?? '서지상 간행일 확인 불가'}\n판본: ${record.edition ?? record.witness?.edition ?? '서지 판본 정보 없음'}\n정확한 범위: ${index.pageLocator ?? record.range ?? record.witness?.range ?? ''}\n자료 성격: ${record.type ?? '기록 유형 미분류'} · ${index.rightsNoteKo}\n${record.translationNoteKo ?? sourceReaderIndex.translationPolicyKo}`;
  const url = isTurgenev ? record.witness.stableRevisionUrl : record.sourceUrl;
  pendingSourceRead = nextState ? { nextState, readingMode, record } : null;
  dialog.className = `source-reader source-reader--${index.layout}`;
  const layoutLabel = ({ catalog: '서지 자료', book: '책 원문', periodical: '잡지 자료', official: '관청 문서', letter: '편지' })[index.layout] ?? '사료';
  const sourceYear = String(index.documentDate ?? index.creationDate ?? index.publicationDate ?? record.documentDate ?? '연도 미상').slice(0, 4);
  $('#source-reader-meta').textContent = `${sourceYear}년 · ${layoutLabel} · 발췌 ${index.excerptId}`;
  $('#source-reader-title').textContent = record.titleKo;
  $('#source-reader-title-ru').textContent = record.titleRu ?? '';
  $('#source-reader-context').textContent = context;
  $('#source-reader-provenance-text').textContent = provenance;
  $('#source-reader-ids').textContent = `${record.sourceId} · ${index.excerptId} · ${index.textStatus} 원문 · 판면 ${index.renderingStatus}`;
  $('#source-reader-dates').textContent = `작성·문서: ${index.documentDate ?? index.creationDate ?? record.documentDate ?? record.dateCreated ?? '확인된 날짜 없음'} · 최초 간행: ${index.publicationDate ?? record.firstPublication ?? '확인된 간행일 없음'} · 이 장면의 날짜: ${state.world.date}`;
  $('#source-reader-reconstruction').textContent = '실제 스캔 이미지가 아니라, 확인 가능한 원문을 읽기 좋게 배치한 재구성 판면입니다.';
  $('#source-reader-passages').replaceChildren(...record.paragraphs.map((paragraph, index) => {
    const section = document.createElement('section'); section.className = 'source-passage';
    const label = document.createElement('h3'); label.textContent = `문단 ${index + 1} · 원문과 번역`;
    const ru = document.createElement('p'); ru.className = 'source-passage-ru'; ru.lang = 'ru'; ru.textContent = paragraph.ru;
    const ko = document.createElement('p'); ko.className = 'source-passage-ko'; ko.lang = 'ko'; ko.textContent = paragraph.ko;
    section.append(label, ru, ko); return section;
  }));
  const links = [
    { label: '확인한 러시아어 원문 열기', href: url, detail: index.pageLocator ?? record.range ?? record.witness?.range },
    ...(isTurgenev ? [{ label: '첫 간행 기록', href: record.firstPublicationSourceUrl }, { label: '잡지 서지', href: record.catalogUrl }] : []),
  ].filter(item => item.href);
  $('#source-reader-links').replaceChildren(...links.map(item => { const a = document.createElement('a'); a.href = item.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = item.detail ? `${item.label} · ${item.detail}` : item.label; return a; }));
  $('#source-reader-status').textContent = pendingSourceRead ? '원문과 번역을 읽은 뒤 수첩에 남기세요.' : '이미 읽은 자료입니다.';
  $('#source-reader-complete').hidden = !pendingSourceRead;
  applySourceReaderMode(sourceReaderMode);
  if (dialog.open) dialog.close();
  dialog.showModal();
}
$('#source-reader-close').addEventListener('click', () => $('#source-reader').close());
$('#source-reader-complete').addEventListener('click', () => {
  if (!pendingSourceRead) return;
  const { nextState, readingMode, record } = pendingSourceRead;
  setState(nextState); pendingSourceRead = null; $('#source-reader').close();
  tutorialAdvance('target');
  sayRecord(readingMode === 'PHYSICAL_COPY'
    ? `현장에서 읽음 · ${record.creator ?? record.author} · 현재 몸의 자료 기록에 남겼다`
    : `자료철에서 살펴봄 · ${record.creator ?? record.author} · 기록의 손님 메모에 남겼다`);
});
$('#source-reader').addEventListener('close', () => { pendingSourceRead = null; });
function showSourceSummary(record = source) {
  openSourceReader(record);
}
function openSourceDrawer() {
  const available = state.world.activeRealm
    ? [...(state.world.activeRealm.sourceIds ?? [])]
    : [...campaign.arcs.filter(arc => arc.id === state.world.chapterId || state.world.completedChapterIds?.includes(arc.id)).flatMap(arc => arc.sources), ...campaign.literaryRealms.map(realm => realm.sourceId)];
  const unlocked = [...new Set(available)].filter(id => {
    if (!sourceRecords.has(id)) return false;
    const sourceObject = Object.values(maps).flatMap(map => map.layers.find(layer => layer.name === 'Interactions')?.objects ?? []).find(object => object.properties?.some(property => property.name === 'sourceId' && property.value === id));
    const availableDate = sourceObject?.properties?.find(property => property.name === 'availableDate')?.value;
    return !availableDate || availableDate <= state.world.date;
  });
  const sourceButtons = unlocked.map(id => sourceRecords.get(id)).map(record => ({ label: record.titleKo, subcopy: `${record.documentDate ?? '1847'} · ${record.type ?? '문학 원문'} · ${record.range ?? record.witness.range}`, run: () => sourceRead(record.sourceId, unlocked, 'PLAYER_ARCHIVE') }));
  const realmActions = state.world.activeRealm
    ? [{ label: '문학 세계에서 돌아오기', subcopy: '1847–1849 역사 연표로 돌아갑니다 · 문학 속 사건은 역사 기록에 합쳐지지 않습니다', run: () => { const result = leaveLiteraryRealm(state, maps); if (result.ok) { setState(result.state); say('현실의 거리로 돌아오다', '도청 소재지의 여관은 소설 속에 남아 있다. 이곳에서 본 것은 역사 속 사람의 기억이 되지 않는다.', [{ label: '자료철 열기', run: openSourceDrawer }]); } } }]
    : campaign.literaryRealms.map(realm => ({ label: realm.entryLabelKo, subcopy: `먼저 자료철에서 작품 원문을 읽습니다 · 1842년 소설의 장면이며 역사 연표와 분리됩니다`, run: () => { const card = cards.find(item => item.id === realm.hostId); const result = enterLiteraryRealm(state, maps[realm.mapId], card); if (result.ok) { setState(result.state); say(realm.titleKo, `${card.displayNameKo}의 작품 속 장면이다. 이곳의 인물과 선택은 문학 세계에만 남는다.`, [{ label: '자료철 열기', run: openSourceDrawer }]); } else sayRecord(result.reason === 'literary_source_unread' ? '자료철에서 해당 작품의 원문을 먼저 읽어야 한다.' : '먼저 빌린 몸을 놓아주고 다시 시도하자.'); } }));
  say(state.world.activeRealm ? '문학 세계의 자료' : '지금까지 열린 자료', state.world.activeRealm
    ? '소설 속에 놓인 책을 직접 읽으면 그 장면의 인물이 알게 된다.'
    : '자료철은 기록의 손님이 살펴보는 목록이다. 빌린 몸의 지식에는 그 사람이 현장에서 직접 읽거나 전달받은 자료만 남는다. 날짜가 오지 않은 문서는 연표가 진행된 뒤 열린다.', [...sourceButtons, ...realmActions]);
}
function continuationFor(activeQuest) {
  if (activeQuest.realmId || activeQuest.chapterId?.startsWith('LITERARY_')) return [{ label: '문학 세계 자료철 열기', run: openSourceDrawer }];
  const arcIndex = campaign.arcs.findIndex(arc => arc.id === state.world.chapterId), arc = campaign.arcs[arcIndex];
  const questIndex = arc?.questIds.indexOf(activeQuest.id) ?? -1;
  const laterQuest = arc?.questIds.slice(questIndex + 1).map(id => questsById.get(id)).find(quest => state.quests[quest.id]?.status !== 'resolved');
  if (laterQuest) { const [nextMonth, nextDay] = laterQuest.date.slice(5).split('-').map(Number); return [{ label: laterQuest.date > state.world.date ? `${nextMonth}월 ${nextDay}일 자료로 이어가기` : '다음 자료 열기', subcopy: `연표 ${state.world.date} → ${laterQuest.date} · 다음 문서가 만들어진 뒤로 진행합니다`, run: () => {
    const advanced = advanceCampaignDate(state, laterQuest.date, campaign, questList);
    if (!advanced.ok) { sayRecord(`날짜를 진행할 수 없음 · ${advanced.reason}`); return; }
    setState(advanced.state);
    say(laterQuest.titleKo, laterQuest.premiseKo, [{ label: '열람 가능한 자료 확인', run: openSourceDrawer }]);
  } }]; }
  const nextArc = arcIndex >= 0 ? campaign.arcs[arcIndex + 1] : null;
  if (nextArc) return [{ label: `${nextArc.date.slice(0, 4)}년으로 이어가기`, subcopy: '다음 장을 시작합니다 · 역사 연표가 앞으로 이동합니다', run: () => {
    const advanced = advanceChapter(state, nextArc.id, campaign, maps);
    if (!advanced.ok) { sayRecord(`다음 장을 열 수 없음 · ${advanced.reason}`); return; }
    setState(advanced.state);
    say(nextArc.titleKo, `기록은 다음 연도로 이어졌다. ${nextArc.date.slice(0, 4)}년의 거리에서 새 사건을 살펴보자.`, [{ label: '자료철 열기', run: openSourceDrawer }]);
  } }];
  return [{ label: '마지막 기록을 정리한다', subcopy: '독서 모임 선택과 진급 시험을 마친 뒤 다섯 결말을 확인합니다', run: showLearningHub }];
}
function civicWitnesses(object, offenderId) {
  const tile = { x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) };
  return Object.values(state.hosts).filter(person => person.id !== offenderId && person.historicalAliveAndPresent && person.mapId === state.world.currentMapId
    && Math.abs(person.position.x - tile.x) + Math.abs(person.position.y - tile.y) <= 4).map(person => person.id);
}
function requireCivicHost(serviceName) {
  const hostId = state.player.embodiment;
  if (!hostId) { say(serviceName, '돈을 내거나 장부에 이름을 남기려면 먼저 이곳을 드나드는 사람의 몸을 빌려야 합니다.', []); return null; }
  return hostId;
}
function buyCityProduct(product, hostId) {
  const result = purchaseCityProduct(state, { hostId, productId: product.id });
  if (!result.ok) {
    const reason = { insufficient_funds: '주머니에 든 돈이 모자랍니다.', money_not_established: '이 인물의 소지금은 기록에 없어 거래할 수 없습니다.' }[result.reason] ?? '지금은 거래할 수 없습니다.';
    sayRecord(reason); return;
  }
  setState(result.state);
  say('가판대에서 물건을 샀다', `${product.titleKo} · ${product.priceKopeks} 코페이카를 지불했습니다. 소지품은 수첩에 기록됩니다.`, product.sourceId ? [{ label: '구입한 호를 읽는다', subcopy: '개인 소장본을 펼칩니다 · 읽은 자료에 남습니다.', run: () => sourceRead(product.sourceId, [product.sourceId], 'PLAYER_ARCHIVE') }] : []);
  sayRecord(`${product.titleKo} 구입 · ${product.priceKopeks} 코페이카`);
}
function openBooksellerCounter() {
  const hostId = requireCivicHost('레프의 가판');
  const products = CITY_PRODUCTS.map(product => ({ label: `${product.titleKo} · ${product.priceKopeks} 코페이카`, subcopy: product.kind === 'periodical' ? '출판된 호를 소장합니다 · 구매 내역이 장부에 남습니다.' : '신문 제작이나 발송에 쓰입니다 · 소지품에 추가됩니다.', disabled: !hostId || hostId === 'bookseller_lev' || !Number.isFinite(state.hosts[hostId]?.money?.amount) || state.hosts[hostId].money.amount < product.priceKopeks, run: () => hostId && buyCityProduct(product, hostId) }));
  if (hostId) products.push({ label: '신문 한 부를 값을 치르지 않고 가져간다', subcopy: '레프와 거리의 목격자가 볼 수 있습니다 · 발각되면 경찰 접수실로 연행되고 신문은 압수됩니다.', run: () => performSuspiciousAct('TAKE_UNPAID_NEWSPAPER', hostId, currentNearby().find(item => item.type === 'shop-counter')) });
  say('레프의 서적·신문 가판', `물품값은 게임 진행을 위한 설정 금액입니다. 현재 소지금 · ${describeHostMoney(hostId ? state.hosts[hostId].money : { amount: null })}`, products);
}
function showPrintedIssue(issue, hostId) {
  const read = readNewspaperIssue(state, { hostId, issueId: issue.id });
  if (!read.ok) { sayRecord('그 호를 가진 사람만 펼쳐 볼 수 있습니다.'); return; }
  if (!read.alreadyRead) setState(read.state);
  say(issue.titleKo, `${issue.editorialKo}\n\n${issue.bodyKo}\n\n근거 자료 · ${issue.sourceId} · 발행일 ${issue.publishedDate}`, [
    { label: '근거 원문을 함께 읽는다', subcopy: '인쇄한 기사의 바탕이 된 자료를 엽니다.', run: () => sourceRead(issue.sourceId, [issue.sourceId], 'PLAYER_ARCHIVE') },
  ]);
  sayRecord(read.alreadyRead ? '이미 읽은 호입니다.' : '신문을 읽었다 · 근거 자료가 수첩에 기록됐다.');
}
function circulateIssue(hostId, issueId, route) {
  const result = circulateNewspaperIssue(state, { hostId, issueId, route });
  if (!result.ok) { sayRecord(({ envelope_missing: '먼저 발송용 봉투를 사세요.', insufficient_postage: '우편료 4코페이카가 부족합니다.', issue_not_owned: '그 신문은 지금 소지품에 없습니다.' })[result.reason] ?? '이 경로로 보낼 수 없습니다.'); return; }
  setState(result.state);
  const resultText = route === 'postal' ? '한 부를 봉투에 넣어 지방행 묶음에 맡겼습니다. 도착 여부는 아직 알 수 없습니다.' : '한 부를 가판에 놓아 거리 독자에게 건넸습니다.';
  say('호외를 배포했다', `${resultText} 실제 간행 기록을 바꾸는 일은 아닙니다.`, []);
  sayRecord(route === 'postal' ? '발송료 4 코페이카 · 봉투 1개 사용' : '거리 배포 기록 · 신문 1부 사용');
}
function openNewsstand() {
  const hostId = requireCivicHost('신문 가판');
  if (!hostId) return;
  const civic = state.player.civic ?? { publishedIssues: [] };
  const host = state.hosts[hostId];
  const issues = civic.publishedIssues.filter(issue => host.inventory.includes(`newspaper_issue:${issue.id}`) || civic.circulatedIssues.some(entry => entry.issueId === issue.id && entry.route === 'street'));
  const actions = issues.flatMap(issue => {
    const ownsIssue = host.inventory.includes(`newspaper_issue:${issue.id}`);
    const read = { label: `${ownsIssue ? '소장한 호 읽기' : '거리 독자가 놓고 간 호 읽기'} · ${issue.titleKo}`, subcopy: `${issue.sourceId}에 근거한 기사 · 읽은 자료가 이 인물의 수첩에 남습니다.`, run: () => showPrintedIssue(issue, hostId) };
    if (!ownsIssue) return [read];
    return [read,
      { label: `거리 독자에게 나눈다 · ${issue.titleKo}`, subcopy: '가판에 공개합니다 · 이 거리의 다른 인물이 읽고 근거를 확인할 수 있습니다.', run: () => circulateIssue(hostId, issue.id, 'street') },
      { label: `지방행 우편으로 보낸다 · ${issue.titleKo}`, subcopy: '발송 장부에 남습니다 · 봉투 1개와 우편료 4코페이카를 씁니다.', disabled: !host.inventory.includes('envelope_bundle') || host.money.amount < 4, run: () => circulateIssue(hostId, issue.id, 'postal') },
    ];
  });
  if (!issues.length) actions.push({ label: '아직 배포할 호외가 없다', subcopy: '인쇄소 편집대에서 자료를 확인하고 신문용 종이와 잉크로 한 부를 만들어 오세요.', disabled: true, run() {} });
  say('거리 신문 가판', `${issues.length ? `소장하거나 거리 독자가 놓고 간 호외 ${issues.length}부가 있습니다.` : '이 가판은 신문이 독자에게 닿는 곳입니다.'}\n\n《현대인》 1847년 제1호의 출판 자료는 레프에게서 구입할 수 있습니다.`, actions);
}
function printIssue(story, hostId) {
  const result = publishNewspaperIssue(state, { hostId, storyId: story.id });
  if (!result.ok) {
    const missing = result.reason === 'source_not_read_by_editor' ? '이 편집자가 먼저 근거 자료를 읽어야 합니다.' : result.reason === 'printing_supplies_missing' ? '신문용 종이 한 묶음과 인쇄용 잉크가 필요합니다.' : result.reason === 'not_newsroom_staff' ? '교정·편집을 맡은 사람의 몸이 필요합니다.' : '지금은 이 호를 인쇄할 수 없습니다.';
    sayRecord(missing); return;
  }
  setState(result.state);
  say('거리 신문을 인쇄했다', `${story.titleKo} · 종이와 잉크를 사용했습니다. 기사에는 확인한 자료와 인쇄 날짜를 함께 남겼습니다.`, [{ label: '새 호를 읽는다', subcopy: '인쇄한 문장과 근거를 확인합니다.', run: () => showPrintedIssue(result.issue, hostId) }]);
  sayRecord(`신문 발행 · ${story.sourceId}`);
}
function shareEditorialSource(story, hostId) {
  const result = shareSourceWithEditor(state, { hostId, sourceId: story.sourceId });
  if (!result.ok) { sayRecord(result.reason === 'source_not_read_by_player' ? '먼저 원문을 읽고 자료철에 남기세요.' : '편집대에서 자료를 전달할 수 없습니다.'); return; }
  if (!result.alreadyKnown) setState(result.state);
  say('근거를 편집자에게 건넸다', `「${story.sourceId}」를 확인한 기록과 함께 ${cards.find(card => card.id === hostId)?.displayNameKo}의 편집 수첩에 옮겼습니다.`, []);
  sayRecord('자료 전달 · 원문 확인과 편집자 인계가 장부에 남았다.');
}
function openNewsroomDesk() {
  const hostId = requireCivicHost('거리 신문 편집대');
  if (!hostId) return;
  const host = state.hosts[hostId], stories = NEWSPAPER_STORIES.filter(story => story.date <= state.world.date);
  const actions = stories.map(story => {
    const hasSource = host.knownEvidenceIds.includes(story.sourceId), hasSupplies = host.inventory.includes('newsprint_sheet') && host.inventory.includes('printing_ink');
    const allowedEditor = ['printer_ekaterina', 'editor_sofia', 'nekrasov_reconstruction'].includes(hostId);
    return { label: `호외 인쇄 · ${story.titleKo}`, subcopy: !allowedEditor ? '교정·편집을 맡은 사람과 함께 오세요.' : !hasSource ? `먼저 편집자가 근거를 읽어야 합니다 · ${story.sourceId}` : !hasSupplies ? '신문용 종이 한 묶음과 인쇄용 잉크가 필요합니다.' : `${story.sourceId}에 근거한 기사 · 신문 1부와 종이, 잉크를 씁니다.`, disabled: !allowedEditor || !hasSource || !hasSupplies, run: () => printIssue(story, hostId) };
  });
  const remoteSources = stories.filter(item => !host.knownEvidenceIds.includes(item.sourceId)).filter(story => {
    if (state.player.observedEvidenceIds?.includes(story.sourceId)) return false;
    const map = mapWithSource(story.sourceId);
    return map && map.mapId !== state.world.currentMapId;
  });
  for (const story of stories.filter(item => !host.knownEvidenceIds.includes(item.sourceId))) {
    if (state.player.observedEvidenceIds?.includes(story.sourceId)) {
      actions.push({ label: `확인한 자료 전달 · ${story.titleKo}`, subcopy: `${story.sourceId} · 편집자에게 원문을 확인한 기록을 넘깁니다.`, run: () => shareEditorialSource(story, hostId) });
      continue;
    }
    const sourceMap = mapWithSource(story.sourceId);
    if (sourceMap?.mapId === state.world.currentMapId) actions.push({ label: `근거 자료 읽기 · ${story.titleKo}`, subcopy: `${story.sourceId} · 이 편집자가 인쇄소에서 원문을 읽고 수첩에 기록합니다.`, run: () => sourceRead(story.sourceId) });
  }
  const sealed = currentNearby().find(item => mapObjectProperties(item).serviceId === 'sealed-dispatch');
  if (sealed) actions.push({ label: '봉인된 발송 묶음을 허락 없이 연다', subcopy: '편집자와 배달원이 알 수 있습니다 · 발각되면 경찰 접수실로 연행됩니다.', run: () => performSuspiciousAct('OPEN_SEALED_DISPATCH', hostId, sealed) });
  const remoteNote = remoteSources.length ? `\n\n다음 원문은 ${remoteSources.map(story => `${mapWithSource(story.sourceId)?.metadata.displayNameKo ?? '다른 장소'}에서 직접 읽으세요.`).join(' ')}` : '';
  say('거리 신문 편집대', `출처를 확인한 기사만 인쇄할 수 있습니다. 실제 자료를 요약할 때도 소설 속 인물과 역사적 증언은 구분합니다.${remoteNote}\n\n현재 가진 종이 ${host.inventory.filter(item => item === 'newsprint_sheet').length}묶음 · 잉크 ${host.inventory.filter(item => item === 'printing_ink').length}병`, actions);
}
function performSuspiciousAct(actId, hostId, object) {
  if (!object) { sayRecord('현장을 찾지 못했습니다.'); return; }
  const result = commitSuspiciousAct(state, { hostId, actId, witnessIds: civicWitnesses(object, hostId), maps });
  if (!result.ok) { sayRecord('지금은 그 행동을 할 수 없습니다.'); return; }
  setState(result.state);
  if (result.arrested) {
    const names = result.witnessed.map(id => cards.find(card => card.id === id)?.displayNameKo).filter(Boolean);
    say('경찰 접수실로 연행됐다', `${result.act.titleKo}. ${names.length ? `${names.join(', ')}이(가) 현장을 보았습니다. ` : ''}가져간 물건은 확인 뒤 돌려줘야 합니다. 접수 창구에서 진술하거나 8코페이카를 내고 풀려날 수 있습니다.`, []);
    sayRecord('목격자 진술로 경찰이 현장에 출동했다.');
  } else {
    say('수상한 행동이 장부에 남았다', `${result.act.titleKo}. 이번에는 본 사람이 없었습니다. 다시 수상한 일을 하면 발각될 수 있습니다.`, []);
    sayRecord(`주의 수준 ${result.state.player.civic.suspicion} / 3`);
  }
}
function releaseFromCustody(resolution) {
  const result = resolvePoliceCustody(state, { resolution });
  if (!result.ok) { sayRecord(result.reason === 'insufficient_funds' ? '8코페이카가 부족합니다. 진술서를 쓸 수 있습니다.' : '석방 절차를 처리하지 못했습니다.'); return; }
  setState(result.state);
  say('접수실을 나설 수 있다', resolution === 'pay_fine' ? '벌금 8코페이카를 납부했습니다. 압수된 물건을 돌려주고 기록을 정리했습니다.' : '진술서가 장부에 들어갔습니다. 압수된 물건을 돌려주고 기록을 정리했습니다.', []);
  sayRecord('석방 처리 · 네프스키 거리로 나가는 문이 열렸다.');
}
function openPoliceDesk() {
  const custody = state.player.civic?.custody;
  if (!custody?.active) { say('경찰 접수 창구', '신고자의 말, 직접 목격한 사실, 아직 확인하지 못한 추정을 장부의 서로 다른 칸에 적습니다. 이 접수실과 절차는 허구의 게임 장면입니다.', []); return; }
  const host = state.hosts[custody.hostId], canPay = Number.isFinite(host.money?.amount) && host.money.amount >= 8;
  say('진술과 석방 절차', `접수 사유 · ${custody.reasonKo}\n압수 대상 · ${custody.stolenItemId ? '신문 1부' : '없음'}\n\n벌금을 내면 소지금에서 8코페이카가 빠집니다. 진술서를 쓰면 돈은 들지 않지만 사건 경위가 장부에 남습니다. 어느 쪽이든 압수된 물건은 돌려줘야 합니다.`, [
    { label: '8코페이카를 내고 석방된다', subcopy: '경찰 접수 장부에 벌금 납부가 남습니다.', disabled: !canPay, run: () => releaseFromCustody('pay_fine') },
    { label: '진술서를 쓰고 석방된다', subcopy: '돈은 들지 않습니다 · 사건 경위와 본인의 설명이 공식 기록으로 남습니다.', run: () => releaseFromCustody('give_statement') },
  ]);
}
function openCivicService(serviceId, object) {
  if (serviceId === 'bookseller-counter') return openBooksellerCounter();
  if (serviceId === 'newsstand') return openNewsstand();
  if (serviceId === 'newsroom-desk') return openNewsroomDesk();
  if (serviceId === 'police-desk' || serviceId === 'police-ledger') return openPoliceDesk();
  if (serviceId === 'sealed-dispatch' || serviceId === 'circulation-register') {
    const hostId = requireCivicHost(object.name); if (!hostId) return;
    const actId = serviceId === 'sealed-dispatch' ? 'OPEN_SEALED_DISPATCH' : 'ALTER_CIRCULATION_REGISTER';
    say(object.name, serviceId === 'sealed-dispatch' ? '발송을 기다리는 봉투가 봉인되어 있습니다. 열람 권한은 주어지지 않았습니다.' : '접수표와 발송 기록이 묶여 있습니다. 고치면 원본과 장부의 번호가 달라집니다.', [
      { label: '장부와 봉인을 그대로 둔다', subcopy: '아무 기록도 바뀌지 않습니다.', run() {} },
      { label: serviceId === 'sealed-dispatch' ? '봉인을 몰래 연다' : '기록을 몰래 고친다', subcopy: '주변 사람이 볼 수 있습니다 · 발각되면 경찰에 연행되고 공식 기록이 남습니다.', run: () => performSuspiciousAct(actId, hostId, object) },
    ]);
    return;
  }
  say(object.name || '시청할 기록', '이곳의 문서와 흔적을 살펴볼 수 있습니다.', []);
}
function inspect(object) {
  const props = Object.fromEntries((object.properties ?? []).map(p => [p.name, p.value]));
  if (props.serviceId) { openCivicService(props.serviceId, object); return; }
  if (object.type === 'npc') {
    tutorialAdvance('inspect');
    const card = cards.find(item => item.id === props.hostId), host = state.hosts[props.hostId];
    if (state.player.embodiment && card.id !== state.player.embodiment) {
      say(card.displayNameKo, `${card.occupation}. ${card.personalObjective}`, [{ label: `${card.displayNameKo}에게 말 걸기`, run: () => startConversation(card) }]);
    } else if (state.player.embodiment === card.id) {
      say(card.displayNameKo, `지금 빌린 몸이다. ${card.personalObjective} · ${describeHostMoney(host.money)}`, [{ label: '이 몸의 수첩 보기', run: openJournal }]);
    } else {
      const context = caseContextsByQuest.get(missionGuidance?.questId), role = context?.roles?.[card.id];
      const intro = role ? `${role.entrySituationKo}\n\n${context.playerFacing.stakesKo}` : `${card.occupation}. ${card.personalObjective}`;
      const options = [{ label: '몸을 빌린다', subcopy: role?.goalKo, run: () => {
        const result = possessHost(state, card.id, currentMap());
        if (result.ok) {
          setState(result.state); tutorialAdvance('possess');
          const opening = role ? `${role.entrySituationKo}\n\n${context.playerFacing.premiseKo}\n\n${role.personalStakesKo}` : `눈높이가 달라졌다. ${card.personalObjective} ${describeHostMoney(host.money)}`;
          say(role ? context.playerFacing.sceneTitleKo : card.displayNameKo, opening, role ? [{ label: '사건의 배경과 확인할 질문', run: () => caseContextButton.click() }] : []);
          sayRecord(`시야 전환 · ${card.displayNameKo}`);
        } else sayRecord(result.reason === 'already_embodied' ? '먼저 현재 몸을 놓아주자.' : '한두 걸음 더 가까이 가 보자.');
      } }];
      if (role) options.push({ label: '이 사건의 맥락을 먼저 읽는다', subcopy: context.playerFacing.decisionQuestionKo, run: () => caseContextButton.click() });
      say(card.displayNameKo, `${intro}\n\n가까이에서 그 사람의 시야로 들어갈 수 있다.`, options);
    }
  } else if (object.type === 'map-exit') {
    const result = transitionMap(state, props.exitId, maps);
    if (result.ok) { setState(result.state); say('문을 나서다', `${currentMap().metadata.displayNameKo}의 공기와 소리가 바뀐다. 다른 사람들은 각자 있던 자리에 남아 있다.`, []); sayRecord('직접 문을 지나 장소를 옮겼다.'); }
    else if (result.reason === 'host_lacks_access') { say('이 몸으로는 들어갈 수 없다', '맡은 일과 신분에 따라 드나들 수 있는 곳이 다르다. 다른 공개 길을 찾아보자.', []); sayRecord('현재 인물에게 이 장소의 출입 권한이 없다.'); }
    else if (result.reason === 'person_required') { say('사람을 통해서만 들어갈 수 있다', '이 문은 관찰자 혼자 통과할 수 없다. 이곳을 오갈 수 있는 사람을 찾아보자.', []); sayRecord('이 출입문은 특정 인물의 권한이 필요하다.'); }
    else { say('문까지 아직 남았다', '문이 보이지만 가까이 가야 한다. 길을 따라 걸어가 보자.', []); sayRecord('출구와 한 타일 거리까지 이동해야 한다.'); }
  } else if (object.type === 'source') sourceRead(props.sourceId);
  else if (props.evidenceId) {
    const clue = sceneObservations.entries[props.evidenceId];
    const recorded = recordEvidenceRead(state, props.evidenceId, maps);
    if (!clue || !recorded.ok) { say('아직 손이 닿지 않는다', '한 걸음 가까이 가서 살펴보자.', []); return; }
    setState(recorded.state);
    const hostLine = state.player.embodiment ? clue.hostLines[state.player.embodiment] : null;
    say(clue.titleKo, observationText(clue, state.player.embodiment), []);
    sayRecord(`허구 소품 조사 · ${clue.titleKo} · ${state.player.embodiment ? '현재 몸의 수첩에 기록' : '관찰 기록에만 저장'}`);
  }
  else if (props.questId) {
    const activeQuest = questsById.get(props.questId);
    if (!questIsAvailable(activeQuest)) { say('아직 시작할 때가 아니다', '이 장의 사건이 열리면 여기서 이어진다.', []); return; }
    if (state.quests[activeQuest.id]?.status === 'resolved') {
      say(activeQuest.titleKo, '이 장의 선택은 이미 기록되어 있다. 다음으로 이어갈 수 있다.', continuationFor(activeQuest));
      return;
    }
    const choiceStates = questChoices(activeQuest, state.player.embodiment, knowledgeForHost(state, state.player.embodiment), state);
    const opts = choiceStates.map(({ action, missingSourceId }) => ({ label: action.labelKo, disabled: Boolean(missingSourceId), subcopy: `${missingSourceId ? `먼저 이 몸으로 「${sourceRecords.get(missingSourceId)?.titleKo ?? '관련 자료'}」을 현장에서 읽어야 합니다.\n` : ''}${action.subcopyKo}`, run: () => {
      const result = performQuestAction(state, { questId: activeQuest.id, hostId: state.player.embodiment, actionId: action.id, objectId: object.id }, { quests: questList, maps });
      if (!result.ok) { sayRecord(`처리할 수 없음 · ${result.reason}`); return; }
      setState(result.state);
      tutorialAdvance('target');
      const actions = continuationFor(activeQuest);
      const chain = activeQuest.lifeChain, chainProgress = chain ? result.state.world.lifeChains?.[chain.id] : null;
      const changedMetrics = chainProgress ? Object.entries(chainProgress.metrics).filter(([, value]) => value !== 0).map(([key, value]) => `${chain.metricsKo?.[key] ?? key} ${value > 0 ? '+' : ''}${value}`).join(' · ') : '';
      const chainNote = chain ? `\n\n${chain.titleKo} · ${chainProgress.stage}/${chain.stageCount}${changedMetrics ? `\n이어진 장부: ${changedMetrics}` : ''}` : '';
      say(action.followupTitleKo ?? activeQuest.titleKo, `${action.resultKo}${action.followupKo ? `\n\n${action.followupKo}` : ''}${chainNote}`, actions);
      sayRecord('현장 행동을 장부에 기록했다.');
    } }));
    let guidance = '';
    if (!choiceStates.length) {
      const names = [...new Set(activeQuest.actions.flatMap(action => action.hostIds))].map(id => cards.find(card => card.id === id)?.displayNameKo).filter(Boolean);
      guidance = `\n\n이 일은 ${names.join(', ')}의 몸으로 할 수 있다. ${state.player.embodiment ? '지금 몸을 놓아준 뒤 그 사람을 찾아가자.' : '그 사람 곁에서 살펴보기를 눌러 몸을 빌리자.'}`;
    }
    const missingIds = [...new Set(choiceStates.map(choice => choice.missingSourceId).filter(Boolean))];
    for (const id of missingIds) {
      const record = sourceRecords.get(id);
      const physical = currentNearby().find(item => item.type === 'source' && mapObjectProperties(item).sourceId === id);
      if (physical) opts.push({ label: `자료 읽기 · ${record.titleKo}`, subcopy: '바로 곁의 자료를 현재 인물의 시야로 읽습니다.', run: () => sourceRead(id) });
      else {
        const location = Object.values(maps).find(map => map.layers.find(layer => layer.name === 'Interactions')?.objects.some(item => item.type === 'source' && mapObjectProperties(item).sourceId === id));
        guidance += `\n\n「${record?.titleKo ?? '관련 자료'}」은 ${location?.metadata.displayNameKo ?? '현장'}에 있다. 종이 모양의 자료 곁으로 가서 살펴보자.`;
      }
    }
    const chain = activeQuest.lifeChain;
    const progress = chain ? state.world.lifeChains?.[chain.id] : null;
    const priorEntry = chain && chain.stage > 1 ? progress?.history?.at(-1) : null;
    const priorQuest = priorEntry ? questsById.get(priorEntry.questId) : null;
    const priorAction = priorEntry ? priorQuest?.actions.find(item => item.id === priorEntry.actionId) : null;
    const chainContext = priorAction ? `\n\n앞선 일 · ${priorAction.resultKo}` : '';
    const title = chain ? `${chain.titleKo} · ${chain.stage}/${chain.stageCount} — ${activeQuest.titleKo}` : activeQuest.titleKo;
    say(title, `${activeQuest.premiseKo}${chainContext}${guidance}`, opts);
  } else {
    const title = object.name || '작업장';
    say(title, '종이와 활자에 손이 닿은 흔적이 남아 있다. 여기서 보이는 물건은 한 사람이 확인한 만큼만 기록할 수 있다.', []);
    sayRecord('살펴본 물건을 현장 기록에 남겼다.');
  }
}
function showEndingChoices() {
  if (state.learning?.phase !== 'complete') { showLearningHub(); return; }
  const options = campaign.endings.filter(ending => resolveEnding(state, ending.id, campaign).ok).map(ending => ({ label: ending.titleKo, subcopy: ending.choiceSubcopyKo, run: () => {
    const result = resolveEnding(state, ending.id, campaign);
    if (!result.ok) { sayRecord(`이 결말을 기록하려면 아직 확인할 자료가 있다 · ${result.reason}`); return; }
    setState(result.state);
    localStorage.setItem('v33-rpg-save', saveGame(result.state));
    renderEnding(ending);
  } }));
  if (!options.length) { say('아직 기록을 닫을 수 없다', '세 시기의 선택과 자료를 확인한 뒤 다시 정리하자.', []); return; }
  say('마지막 기록을 정리하다', '남겨 둔 행동과 읽은 문서를 살펴보고, 그중 하나를 기록의 끝에 둔다.', options);
}
function renderLifeTimeline() {
  const episodes = buildLifeTimeline(state, lifeTemplates), index = Math.min(state.learning.timelineIndex, episodes.length - 1), episode = episodes[index];
  const card = $('#ending-life-episode'); card.replaceChildren();
  if (!episode) { card.textContent = '이후 삶의 연표 자료를 찾을 수 없다.'; return; }
  $('#ending-life-progress').textContent = `${episode.periodLabel} · ${index + 1} / ${episodes.length}`;
  const title = document.createElement('h4'); title.textContent = episode.title;
  const text = document.createElement('p'); text.textContent = episode.textKo;
  const mark = document.createElement('small'); mark.textContent = '가상의 서기 · 플레이 기록으로 구성한 장면';
  card.append(title, text, mark);
  $('#ending-life-previous').disabled = index === 0;
  $('#ending-life-next').disabled = index === episodes.length - 1;
  $('#ending-life-previous').onclick = () => moveLifeTimeline(-1);
  $('#ending-life-next').onclick = () => moveLifeTimeline(1);
  $('#ending-life-replay').onclick = () => {
    const next = structuredClone(state); next.learning.timelineIndex = 0; state = next;
    localStorage.setItem('v33-rpg-save', saveGame(next)); renderLifeTimeline(); $('#ending-life-replay').focus();
  };
}
function moveLifeTimeline(delta) {
  const count = buildLifeTimeline(state, lifeTemplates).length;
  const next = structuredClone(state); next.learning.timelineIndex = Math.max(0, Math.min(count - 1, next.learning.timelineIndex + delta)); state = next;
  localStorage.setItem('v33-rpg-save', saveGame(next)); renderLifeTimeline(); $(`#ending-life-${delta < 0 ? 'previous' : 'next'}`).focus();
}
function renderEnding(ending) {
  $('#learning-screen').hidden = true; document.body.classList.remove('learning-active');
  $('#ending-date').textContent = `${state.world.date.replaceAll('-', '.')} · 보존 기록`;
  $('#ending-title').textContent = ending.titleKo;
  $('#ending-epilogue').textContent = ending.epilogueKo;
  $('#ending-history').textContent = campaign.endingHistoryNoteKo;
  const comparison = historicalComparisons.comparisons.find(item => item.endingId === ending.id);
  $('#ending-comparison-title').textContent = comparison ? comparison.personKo : '비교 자료 없음';
  $('#ending-comparison-text').textContent = comparison?.documentedLifeKo ?? '';
  $('#ending-comparison-route').textContent = comparison?.routeContextKo ?? '';
  const comparisonSources = $('#ending-comparison-sources'); comparisonSources.replaceChildren();
  for (const sourceInfo of comparison?.sources ?? []) {
    const item = document.createElement('li'), link = document.createElement('a');
    link.href = sourceInfo.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.textContent = `${sourceInfo.sourceId} · ${sourceInfo.claim} · ${sourceInfo.locator}`; item.append(link); comparisonSources.append(item);
  }
  const actionLines = state.ledger.filter(item => item.actionId).map(item => {
    const quest = questsById.get(item.questId), action = quest?.actions.find(entry => entry.id === item.actionId);
    const card = cards.find(entry => entry.id === item.hostId);
    return { text: `${card?.displayNameKo ?? '이름 없는 인물'} · ${action?.resultKo ?? item.actionId}` };
  });
  const journey = $('#ending-journey'); journey.replaceChildren();
  for (const line of actionLines) { const item = document.createElement('li'); item.textContent = line.text; journey.append(item); }
  const hostList = $('#ending-hosts'); hostList.replaceChildren(); hostList.classList.add('ending-host-list');
  const witnessedHosts = [...new Set(state.world.possessionHistory.map(item => item.hostId))].map(id => cards.find(card => card.id === id)).filter(card => card && card.kind !== 'LITERARY');
  for (const card of witnessedHosts) { const item = document.createElement('li'); item.textContent = `${card.displayNameKo} · ${card.occupation}`; hostList.append(item); }
  const sourceList = $('#ending-sources'); sourceList.replaceChildren();
  const readIds = [...new Set(state.ledger.flatMap(item => item.sourceIds ?? (item.sourceId ? [item.sourceId] : [])))];
  for (const id of readIds) {
    const record = sourceRecords.get(id), url = record?.sourceUrl ?? record?.witness?.stableRevisionUrl;
    if (!record || !url) continue;
    const item = document.createElement('li'), link = document.createElement('a');
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = `${record.titleKo} · ${record.documentDate ?? '문학 원문'}`;
    item.append(link); sourceList.append(item);
  }
  for (const id of readIds) {
    const record = learningSourceData.sources.find(item => item.sourceId === id);
    if (!record) continue;
    const item = document.createElement('li'), link = document.createElement('a');
    link.href = record.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = `${record.titleKo} · ${record.sourceId} · ${record.range}`;
    item.append(link); sourceList.append(item);
  }
  renderLifeTimeline();
  document.body.classList.add('ending-active');
  $('#ending-screen').hidden = false;
  $('#ending-restart').focus();
}
function interact() {
  if (activeDialogueHost || state.endingId || !$('#learning-screen').hidden) return;
  const near = currentNearby();
  if (!near.length) { say('아직 손이 닿지 않는다', '주변을 조금 더 걸어 가까이 가 보자. 사람에게 다가가면 그 사람의 자리에서 도시를 볼 수 있다.', []); return; }
  const civicService = near.find(item => mapObjectProperties(item).serviceId);
  const nearbyPeople = near.filter(item => item.type === 'npc');
  if (!state.player.embodiment && nearbyPeople.length > 0 && (nearbyPeople.length > 1 || Boolean(civicService) || near.some(item => ['source', 'map-exit', 'quest-object'].includes(item.type)))) {
    const peopleChoices = nearbyPeople.map(item => {
      const hostId = mapObjectProperties(item).hostId, card = cards.find(character => character.id === hostId), person = state.hosts[hostId];
      const routineStateKo = ({ TRAVELLING: '이동 중', WORKING: '일하는 중', TRADING: '거래 중', RESTING: '쉬는 중', SOCIALIZING: '사람들과 이야기하는 중', DELIVERING: '물건을 전하는 중', POSSESSED: '다른 이의 시야에 들어와 있음' })[person.routineState?.state] ?? '자기 일과를 보내는 중';
      const goalKo = ({ FOLLOW_RECIPIENT: '받을 사람을 찾아가는 중', FOLLOW_TRADE_PARTNER: '거래 상대를 찾아가는 중', NEED_MEAL: '허기를 채우러 가는 중', NEED_REST: '피로를 풀 곳으로 가는 중' })[person.activeGoal?.type] ?? person.currentActivityKo ?? card.personalObjective;
      const hungerKo = (person.needs?.hunger ?? 0) >= 65 ? '끼니가 급함' : (person.needs?.hunger ?? 0) >= 45 ? '허기를 느끼는 중' : '허기 낮음';
      return { label: `${card.displayNameKo} 살펴보기`, subcopy: `${card.occupation} · ${routineStateKo} · ${goalKo} · ${hungerKo}`, run: () => inspect(item) };
    });
    const nearbyObjects = near.filter(item => ['source', 'map-exit', 'quest-object'].includes(item.type) || Boolean(mapObjectProperties(item).serviceId)).map(item => {
      const props = mapObjectProperties(item);
      if (props.serviceId) return { label: `${item.name} 이용`, subcopy: '이 장소의 물건이나 기록을 살펴봅니다.', run: () => inspect(item) };
      if (item.type === 'source') {
        const record = sourceRecords.get(props.sourceId);
        return { label: `자료 읽기 · ${record?.titleKo ?? '문서'}`, subcopy: record?.range ?? record?.witness?.range ?? '가까이에 놓인 자료', run: () => inspect(item) };
      }
      if (item.type === 'map-exit') {
        const destination = maps[props.targetMapId]?.metadata?.displayNameKo ?? '다음 장소';
        return { label: `문을 지나 ${destination}로`, subcopy: '실제 출입문을 통해 장소를 옮깁니다.', run: () => inspect(item) };
      }
      const quest = questsById.get(props.questId);
      return { label: `사건 살펴보기 · ${quest?.titleKo ?? '현장 기록'}`, subcopy: quest?.premiseKo ?? '', run: () => inspect(item) };
    });
    say('가까이에 사람과 문서가 있다', '살펴볼 사람이나 주변의 문서·출입문을 고르세요.', [...peopleChoices, ...nearbyObjects]);
    return;
  }
  if (state.player.embodiment && civicService) { inspect(civicService); return; }
  if (!state.player.embodiment && civicService && !nearbyPeople.length) { inspect(civicService); return; }
  const activeQuestObject = near.find(item => {
      if (item.type !== 'quest-object') return false;
      const questId = Object.fromEntries((item.properties ?? []).map(property => [property.name, property.value])).questId;
      const quest = questsById.get(questId);
      return questIsAvailable(quest) && state.quests[questId]?.status !== 'resolved'
        && (!state.player.embodiment || quest.actions.some(action => action.hostIds.includes(state.player.embodiment)));
    });
  const object = activeQuestObject
    ?? near.find(item => item.type === 'source')
    ?? (state.player.embodiment ? near.find(item => item.type === 'map-exit') : null)
    ?? near.find(item => item.type === 'npc' && mapObjectProperties(item).hostId !== state.player.embodiment)
    ?? near.find(item => item.type === 'map-exit')
    ?? near.find(item => item.type === 'quest-object' && questIsAvailable(questsById.get(mapObjectProperties(item).questId)))
    ?? near[0];
  inspect(object);
}
function move(direction) {
  if (activeDialogueHost) finishConversation(activeDialogueHost);
  if (state.endingId || !$('#learning-screen').hidden) return;
  const result = moveActor(state, direction, currentMap(), maps);
  if (result.moved) { setState(result.state); tutorialAdvance('move'); lastMoveAt = performance.now(); }
  else sayRecord('벽이나 가구가 길을 막고 있다.');
}
function finishConversation(hostId) {
  const key = activeDialogueKey;
  const interruptedTurn = dialogueRequestPending;
  dialogueGeneration += 1; dialogueRequestPending = false;
  activeDialogueController?.abort(); activeDialogueController = null; activeDialogueHost = null; activeDialogueKey = null; updateHud();
  $('.lower').classList.remove('is-talking');
  $('#dialogue-speaker').hidden = true;
  if (key && interruptedTurn) { dialogueSessions.delete(key); sessionStorage.removeItem(dialogueStorageKey(key)); }
  if (key && dialogueSessions.get(key)?.mode === 'BLOCKED_LIMIT') { dialogueSessions.delete(key); sessionStorage.removeItem(dialogueStorageKey(key)); }
  const card = cards.find(item => item.id === hostId);
  tutorialAdvance('finish');
  say(card.displayNameKo, '대화를 마쳤다. 그 사람은 지금 하던 일을 이어간다.', []);
  sayRecord('대화 기록을 남기고 현장으로 돌아왔다.');
}
function showConversation(card, promptText, replies, statusText = '') {
  $('.lower').classList.add('is-talking');
  $('#dialogue-portrait').src = `./rpg/${card.portrait.file}`;
  $('#dialogue-portrait').alt = `${card.displayNameKo} 초상`;
  $('#dialogue-speaker-name').textContent = card.displayNameKo;
  $('#dialogue-speaker').hidden = false;
  $('#host-notebook').open = false; $('#host-notebook').hidden = true;
  const lines = dialogueTranscripts.get(activeDialogueKey) ?? [];
  const history = $('#dialogue-history'), historyLines = $('#dialogue-history-lines');
  history.hidden = !lines.length; historyLines.replaceChildren(...lines.slice(-12).map(line => { const li=document.createElement('li'); li.textContent=`${line.speaker} · ${line.text}`; return li; }));
  const replyActions = replies.slice(0, 3).map((label, index) => ({ label, run: () => sendConversation(card, label, `R${index + 1}`) }));
  replyActions.push({ label: '대화 마치기', run: () => finishConversation(card.id) });
  say('대화 중', promptText || dialogueCurrentLines.get(activeDialogueKey) || '', replyActions);
  if (dialogueRequestPending) $('#actions').querySelectorAll('.dialogue-input button').forEach(button => { button.disabled = true; });
  {
  const form = document.createElement('form'); form.className = 'dialogue-input';
  const input = document.createElement('input'); input.type = 'text'; input.maxLength = 800; input.autocomplete = 'off'; input.placeholder = '직접 하고 싶은 말을 적어보세요'; input.setAttribute('aria-label', '대사 입력, 최대 800자'); input.disabled = dialogueRequestPending;
  const counter = document.createElement('span'); counter.className = 'dialogue-char-count'; counter.setAttribute('aria-live','polite'); counter.textContent = `${input.value.length} / 800자`;
  const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = dialogueRequestPending ? '답을 기다리는 중' : '직접 말하기'; submit.disabled = dialogueRequestPending;
  input.addEventListener('input',()=>{counter.textContent=`${input.value.length} / 800자`;});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();form.requestSubmit();}});
  form.append(input, counter, submit); form.addEventListener('submit', event => { event.preventDefault(); const value = input.value.trim(); if (value && !event.isComposing) sendConversation(card, value); });
  $('#actions').append(form);
  }
  if (statusText.startsWith('AI 연결 실패') || statusText.startsWith('AI 응답 생성 실패')) {
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'AI 다시 연결';
    retry.addEventListener('click', async () => {
      const key = activeDialogueKey;
      const retryText = dialogueFailedQuestions.get(key) ?? null;
      if (key) { dialogueSessions.delete(key); sessionStorage.removeItem(dialogueStorageKey(key)); }
      finishConversation(card.id);
      await startConversation(card);
      if (retryText && activeDialogueHost === card.id && activeDialogueKey === key) sendConversation(card, retryText);
    });
    $('#actions').append(retry);
  }
  $('.journal').scrollTop = 0;
  sayRecord(statusText || (hasLiveDialogue(activeDialogueKey) ? '직접 말하거나 준비된 대답을 고르세요.' : 'AI 연결이 필요합니다. 설정에서 연결 상태를 확인하세요.'));
}
async function startConversation(card) {
  const actorCard = cards.find(item => item.id === state.player.embodiment), partner = nearbyConversationPartner();
  if (!actorCard || partner?.id !== card.id || activeDialogueHost) { sayRecord('말을 건넬 사람이 가까이 있지 않다.'); return; }
  const key = dialogueKey(actorCard.id, card.id);
  const generation = ++dialogueGeneration;
  dialogueRequestPending = false;
  activeDialogueHost = card.id; activeDialogueKey = key; updateHud();
  tutorialAdvance('talk');
  let session = dialogueSessions.get(key), sessionFailure = '';
  if (session && dialogueSessionNeedsReconnect(session)) {
    dialogueSessions.delete(key);
    sessionStorage.removeItem(dialogueStorageKey(key));
    session = null;
  }
  const remaining = availableTopics(card.id);
  dialogueCurrentLines.set(key, contextualOpening(card.id, actorCard.id));
  showConversation(card, dialogueCurrentLines.get(key), remaining, '선택지는 빠른 대답입니다. 직접 입력해도 됩니다.');
  if (!session) {
    const controller = new AbortController(); activeDialogueController = controller;
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const saved = sessionStorage.getItem(dialogueStorageKey(key));
      if (saved) session = { token: saved, mode: 'AI' };
      else {
        session = await openDialogueSession(card, actorCard, controller.signal);
        sessionStorage.setItem(dialogueStorageKey(key), session.token);
      }
      if (dialogueGeneration !== generation || activeDialogueKey !== key) return;
      dialogueSessions.set(key, session);
    } catch (error) { recordApiFailure('/api/rpg/session/start', error); session = null; sessionFailure = dialogueApiFailure(error); }
    finally { clearTimeout(timer); if (activeDialogueController === controller) activeDialogueController = null; }
    if (activeDialogueHost !== card.id || activeDialogueKey !== key || dialogueGeneration !== generation) return;
  }

  const liveDiscussionQuests = currentDiscussionQuests();
  const topicalQuestions = discussionPromptsForHost(card.id, liveDiscussionQuests).map(item => item.promptKo);
  const reflectionQuestions = discussionReflectionPromptsForHost(card.id, state, liveDiscussionQuests).map(item => item.promptKo);
  const queuedQuestion = queuedDiscussionInquiry?.hostId === card.id ? queuedDiscussionInquiry.promptKo : null;
  const starterReplies = [...new Set([queuedQuestion, ...topicalQuestions, ...reflectionQuestions, ...remaining].filter(Boolean))].slice(0, 3);
  showConversation(card, dialogueCurrentLines.get(key), starterReplies,
    sessionFailure ? `AI 연결 실패 · ${sessionFailure}` : hasLiveDialogue(key) ? 'AI 세션 준비됨 · 질문을 보내면 실제 생성 답변을 요청합니다.' : 'AI 답변 대기 · 인물에게 질문을 보내면 서버에서 답변을 생성합니다.');
}
async function sendConversation(card, playerText, replyId = null) {
  const key = activeDialogueKey;
  const generation = dialogueGeneration;
  if (activeDialogueHost !== card.id || !key || dialogueRequestPending || state.player.embodiment === card.id || nearbyConversationPartner()?.id !== card.id) return;
  const intentClass = classifyTypedResponse(playerText);
  const actorCard = cards.find(item => item.id === state.player.embodiment);
  const liveDiscussionQuests = currentDiscussionQuests();
  const discussionPrompt = discussionPromptsForHost(card.id, liveDiscussionQuests).find(item => item.promptKo === playerText);
  const reflectionPrompt = discussionReflectionPromptsForHost(card.id, state, liveDiscussionQuests).find(item => item.promptKo === playerText);
  const lines = dialogueTranscripts.get(key) ?? [];
  if (lines.at(-1)?.speaker !== actorCard.displayNameKo || lines.at(-1)?.text !== playerText) lines.push({ speaker: actorCard.displayNameKo, text: playerText });
  dialogueFailedQuestions.set(key, playerText);
  dialogueTranscripts.set(key, lines.slice(-24));
  let session = dialogueSessions.get(key); let turn = null, generationFailure = '';
  if (!hasLiveDialogue(key)) {
    const controller = new AbortController(); activeDialogueController = controller;
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      session = await openDialogueSession(card, actorCard, controller.signal);
      dialogueSessions.set(key, session); sessionStorage.setItem(dialogueStorageKey(key), session.token);
    } catch (error) { recordApiFailure('/api/rpg/session/start', error); generationFailure = `AI 연결 실패 · ${dialogueApiFailure(error)}`; }
    finally { clearTimeout(timer); if (activeDialogueController === controller) activeDialogueController = null; }
    if (activeDialogueHost !== card.id || activeDialogueKey !== key || dialogueGeneration !== generation) return;
  }
  if (hasLiveDialogue(key)) {
    dialogueRequestPending = true;
    const sessionStorageKey = dialogueStorageKey(key);
    const controller = new AbortController(); activeDialogueController = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    dialogueCurrentLines.set(key, '말을 들었어요. 잠시 생각하고 있어요.');
    showConversation(card, dialogueCurrentLines.get(key), [], '답변을 기다리는 중 · Esc로 대화를 마칠 수 있습니다.');
    try {
      const requestDialogue = currentSession => fetch(`${aiBaseUrl}/api/rpg/dialogue`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionToken: currentSession.token, requestId: crypto.randomUUID(), playerInput: playerText, actorRelations: relationshipHintsFor(actorCard.id), actorActions: playerActionHintsFor(actorCard.id), sceneContext: { date: state.world.date, mapId: state.world.currentMapId, questId: discussionPrompt ? null : missionGuidance?.questId ?? null } }), signal: controller.signal });
      let response = await requestDialogue(session);
      if (response.status === 401) {
        sessionStorage.removeItem(sessionStorageKey); dialogueSessions.delete(key);
        session = await openDialogueSession(card, actorCard, controller.signal);
        dialogueSessions.set(key, session); sessionStorage.setItem(sessionStorageKey, session.token);
        response = await requestDialogue(session);
      }
      if (!response.ok) {
        if (response.status === 429) {
          session.mode = 'BLOCKED_LIMIT'; dialogueSessions.set(key, session); sessionStorage.removeItem(dialogueStorageKey(key));
        }
        const failure = await response.json().catch(() => ({}));
        const code = failure.providerErrorCode || failure.error || 'dialogue_request_failed';
        saveApiError({ endpoint: '/api/rpg/dialogue', kind: 'http_error', status: response.status, code });
        throw Object.assign(new Error('dialogue_unavailable'), { status: response.status, apiCode: code });
      }
      const data = await response.json(), candidate = data.turn;
      if (candidate?.sceneId !== aiScenes.sessions[card.id].sceneId || !Array.isArray(candidate.beats) || candidate.beats.length < 1 || candidate.beats.length > 2 || !candidate.beats.every(beat => beat && [card.id, 'NARRATION'].includes(beat.speakerId) && typeof beat.textKo === 'string' && beat.textKo.length <= 420) || !Array.isArray(candidate.suggestedReplies) || candidate.suggestedReplies.length < 2 || candidate.suggestedReplies.length > 3 || !candidate.suggestedReplies.every(reply => reply && typeof reply.textKo === 'string' && reply.textKo.length <= 80)) throw Object.assign(new Error('invalid dialogue response'), { apiCode: 'client_response_invalid' });
      if (data.sessionToken) {
        session.token = data.sessionToken;
        sessionStorage.setItem(dialogueStorageKey(key), session.token);
      }
      const selection = selectDialogueTurn(data);
      turn = selection.kind === 'generated' ? selection.turn : null;
      generationFailure = selection.kind === 'unavailable' ? `AI 응답 생성 실패 · ${providerFailureLabel(selection.providerErrorCode || response.headers.get('x-v33-provider-result'))}. 생성된 답변이 없어 이번 질문은 기록하지 않았습니다. ‘AI 다시 연결’로 같은 질문을 재시도할 수 있습니다.` : '';
      if (selection.kind === 'unavailable' && data.mode !== 'BLOCKED_NO_KEY') saveApiError({ endpoint: '/api/rpg/dialogue', kind: 'provider_error', status: response.status, code: selection.providerErrorCode || 'provider_response_validation' });
    } catch (error) {
      recordApiFailure('/api/rpg/dialogue', error);
      generationFailure ||= `AI 연결 실패 · ${dialogueApiFailure(error)}`;
    }
    finally {
      clearTimeout(timer);
      if (activeDialogueController === controller) activeDialogueController = null;
      if (dialogueGeneration === generation) dialogueRequestPending = false;
    }
    if (activeDialogueHost !== card.id || activeDialogueKey !== key || dialogueGeneration !== generation) return;
  }
  const local = aiScenes.sessions[card.id];
  if (!turn && generationFailure) {
    dialogueCurrentLines.set(key, '이번 질문에 대한 생성 답변을 받지 못했습니다. 연결을 확인한 뒤 같은 질문을 다시 보낼 수 있습니다.');
    showConversation(card, dialogueCurrentLines.get(key), [], generationFailure);
    $('.journal').scrollTop = $('.journal').scrollHeight;
    return;
  }
  const aiGenerated = Boolean(turn);
  if (!turn) return;
  dialogueFailedQuestions.delete(key);
  for (const beat of turn.beats) lines.push({ speaker: beat.speakerId === 'NARRATION' ? card.displayNameKo : card.displayNameKo, text: beat.textKo });
  dialogueTranscripts.set(key, lines.slice(-24));
  dialogueCurrentLines.set(key, turn.beats.map(beat => beat.textKo).join('\n'));
  const recorded = recordDialogueTurn(state, { hostId: card.id, actorHostId: actorCard.id, sceneId: local.sceneId, intentClass, discussionId: discussionPrompt?.discussionId ?? null, discussionTitleKo: discussionPrompt?.questTitleKo, reflectionId: reflectionPrompt?.reflectionId ?? null, aiGenerated }, maps);
  if (recorded.ok && queuedDiscussionInquiry?.hostId === card.id && queuedDiscussionInquiry?.promptKo === playerText) queuedDiscussionInquiry = null;
  if (recorded.ok) setState(recorded.state);
  const replies = (turn.suggestedReplies ?? []).slice(0, 3);
  const reward = recorded.ok ? recorded.state.ledger.at(-1)?.dialogueReward : null;
  const rewardStatus = reward === 'COMPARISON_NOTE' ? ' · 관점 대조 메모 획득 · 다른 인물에게 후속 질문 가능' : reward === 'PERSPECTIVE_NOTE' ? ' · 관점 메모와 통찰 +1' : '';
  const recordFailure = recorded.ok ? '' : `대화 기록 실패 · ${recorded.reason}`;
  const conversationStatus = [generationFailure, recordFailure].filter(Boolean).join(' · ') || `AI 생성 답변 · ${card.displayNameKo}의 처지와 견해가 반영되었습니다.${rewardStatus}`;
  showConversation(card, dialogueCurrentLines.get(key), replies.map(reply => reply.textKo), conversationStatus);
  $('.journal').scrollTop = $('.journal').scrollHeight;
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !event.isComposing && $('#quest-journal').open) { event.preventDefault(); closeJournal(); return; }
  if (event.key === 'Escape' && activeDialogueHost && !event.isComposing) { event.preventDefault(); finishConversation(activeDialogueHost); return; }
  if (ownsKeyboardInput(event) || state.endingId) return;
  if (!$('#learning-screen').hidden) {
    if (event.key === 'Escape') { event.preventDefault(); hideLearningScreen(); }
    return;
  }
  const direction = ({ ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' })[event.key];
  if (direction) { event.preventDefault(); move(direction); }
  if (!activeDialogueHost && (event.key === 'j' || event.key === 'J')) { event.preventDefault(); if ($('#quest-journal').open) closeJournal(); else openJournal(); return; }
  if (!activeDialogueHost && (event.key === 'e' || event.key === 'E' || event.key === 'Enter')) { event.preventDefault(); interact(); }
  if (!activeDialogueHost && (event.key === 'h' || event.key === 'H')) { event.preventDefault(); openSourceDrawer(); }
  if (event.key === 'Escape' && activeDialogueHost) { finishConversation(activeDialogueHost); return; }
  if (event.key === 'Escape' && state.player.embodiment) { const released = releaseHost(state, currentMap()); if (released.ok) { setState(released.state); say('몸을 놓아주다', '그 사람은 자기 자리에서 계속 살아간다. 네가 본 것과 그 사람이 아는 것은 섞이지 않는다.', []); } }
});
document.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => move(button.dataset.move)));
$('#use').addEventListener('click', interact);
$('#talk').addEventListener('click', () => { const partner = nearbyConversationPartner(); if (partner) startConversation(partner); else sayRecord('먼저 다른 사람 곁으로 다가가자.'); });
$('#release').addEventListener('click', () => { const result = releaseHost(state, currentMap()); if (result.ok) { setState(result.state); say('몸을 놓아주다', '그 사람은 자기 자리에서 계속 살아간다. 네가 본 것과 그 사람이 아는 것은 섞이지 않는다.', []); } });
$('#save').addEventListener('click', () => { localStorage.setItem('v33-rpg-save', saveGame(state)); $('#load').disabled = false; sayRecord('기록을 저장했다.'); });
$('#load').addEventListener('click', () => {
  const saved = localStorage.getItem('v33-rpg-save');
  if (!saved) return;
  try {
    $('#learning-screen').hidden = true; document.body.classList.remove('learning-active');
    setState(loadGame(saved, { maps, hostCards, quests: questList, learningExam })); restoreJournal();
    if (state.endingId) renderEnding(campaign.endings.find(item => item.id === state.endingId));
    else if (['learning', 'public-prep', 'exam-choice', 'exam', 'result'].includes(state.learning.phase)) showLearningHub();
    else if (state.learning.phase === 'complete') showEndingChoices();
    sayRecord('저장한 현장으로 돌아왔다.');
  }
  catch { sayRecord('저장 기록을 읽지 못했다. 새 기록으로 시작해 주세요.'); }
});
$('#ending-restart').addEventListener('click', () => { localStorage.removeItem('v33-rpg-save'); location.reload(); });
$('#mission-pin').addEventListener('click', toggleDestinationPin);
$('#journal-pin').addEventListener('click', toggleDestinationPin);
$('#journal-open').addEventListener('click', openJournal);
$('#journal-close').addEventListener('click', closeJournal);
$('#quest-journal').addEventListener('click', event => { if (event.target === $('#quest-journal')) closeJournal(); });
document.querySelectorAll('[data-journal-tab]').forEach(button => button.addEventListener('click', () => setJournalTab(button.dataset.journalTab)));
$('#tutorial-skip').addEventListener('click', () => { tutorialStage = 'done'; localStorage.setItem(tutorialStorageKey, tutorialStage); updateTutorial(); sayRecord('도움말을 건너뛰었습니다. 수첩은 언제든 J로 열 수 있습니다.'); });
$('#tutorial-replay').addEventListener('click', () => { tutorialStage = '0'; localStorage.setItem(tutorialStorageKey, tutorialStage); updateTutorial(); sayRecord('도움말을 처음부터 다시 시작합니다.'); });
function restoreJournal() {
  const latest = state.ledger.at(-1);
  if (latest?.questId && latest.actionId) {
    const quest = questsById.get(latest.questId), action = quest?.actions.find(item => item.id === latest.actionId);
    if (action) { say('교정쇄에 남긴 결정', action.resultKo, state.quests[latest.questId]?.status === 'resolved' ? continuationFor(quest) : []); return; }
  }
  if (latest?.evidenceId) {
    const clue = sceneObservations.entries[latest.evidenceId];
    if (clue) {
      const hostLine = latest.hostId ? clue.hostLines[latest.hostId] : null;
      say(clue.titleKo, observationText(clue, latest.hostId), []);
      sayRecord('저장한 허구 소품 관찰을 불러왔다.');
      return;
    }
  }
  if (latest?.sourceId) showSourceSummary(sourceRecords.get(latest.sourceId) ?? source);
}
restoreJournal();
updateHud();
requestRender();
if (state.endingId) renderEnding(campaign.endings.find(item => item.id === state.endingId));
else if (['learning', 'public-prep', 'exam-choice', 'exam', 'result'].includes(state.learning.phase)) showLearningHub();
else if (state.learning.phase === 'complete') showEndingChoices();
$('#settings-open').addEventListener('click', () => { renderApiDiagnostics(); $('#api-settings').showModal(); checkApiHealth(); });
$('#api-settings-close').addEventListener('click', () => $('#api-settings').close());
$('#api-health-refresh').addEventListener('click', checkApiHealth);
$('#api-generation-probe').addEventListener('click', probeApiGeneration);
$('#api-settings').addEventListener('click', event => { if (event.target === $('#api-settings')) $('#api-settings').close(); });
$('#api-diagnostics-clear').addEventListener('click', () => { clearApiDiagnostics(localStorage); renderApiDiagnostics(); });
$('#api-diagnostics-copy').addEventListener('click', async () => {
  const report = JSON.stringify(readApiDiagnostics(localStorage), null, 2);
  try { await navigator.clipboard.writeText(report); sayRecord('민감한 대화 내용 없이 API 오류 기록을 복사했습니다.'); }
  catch { sayRecord('클립보드 접근을 허용하지 않았습니다.'); }
});
$('#source-drawer-open').addEventListener('click', openSourceDrawer);
$('#route-continue').addEventListener('click', () => {
  const quest = continuationQuest(state, campaign, questList);
  if (quest && !activeDialogueHost) continuationFor(quest)[0].run();
});
