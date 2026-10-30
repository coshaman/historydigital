import { createRenderer } from './engine/renderer.js';
import { advanceStudy, beginExam, buildLifeTimeline, chooseCirclePath, completeLearning, getExamQuestions, selectExamAnswer, submitExam } from './engine/learning-life.mjs';
import './engine/game-state.js';
const { createInitialState, moveActor, possessHost, releaseHost, transitionMap, performQuestAction, saveGame, loadGame, nearTile, knowledgeForHost, recordSourceRead, recordEvidenceRead, recordDialogueTurn, enterLiteraryRealm, leaveLiteraryRealm, advanceChapter, advanceCampaignDate, resolveEnding, describeHostMoney } = globalThis.V33GameState;

const readJson = async path => (await fetch(path)).json();
const [street, shop, chancery, courtyard, literaryMap, firstQuest, source, firstIssue, historicalSources, literarySource, campaign, publicQuest, circleQuest, letterQuest, literaryQuest, sceneObservations, aiScenes, learningExam, learningSourceData, lifeTemplates, historicalComparisons] = await Promise.all([readJson('./rpg/maps/nevsky.json'), readJson('./rpg/maps/printshop.json'), readJson('./rpg/maps/chancery.json'), readJson('./rpg/maps/courtyard.json'), readJson('./rpg/maps/dead-souls.json'), readJson('./rpg/quests/printshop-article.json'), readJson('./rpg/data/khor-kalynych-source.json'), readJson('./rpg/data/sovremennik-1847-issue.json'), readJson('./rpg/data/historical-source-packets.json'), readJson('./rpg/data/dead-souls-source.json'), readJson('./rpg/quests/campaign.json'), readJson('./rpg/quests/public-discourse-1848.json'), readJson('./rpg/quests/circle-investigation-1849.json'), readJson('./rpg/quests/circle-letter-1849-may.json'), readJson('./rpg/quests/literary-dead-souls.json'), readJson('./rpg/data/scene-observations.json'), readJson('./rpg/ai/scenes.json'), readJson('./rpg/data/learning-exam.json'), readJson('./rpg/data/learning-sources.json'), readJson('./rpg/data/life-simulation.json'), readJson('./rpg/data/historical-comparisons.json')]);
const cards = await Promise.all(['clerk_alexei','printer_ekaterina','courier_pavel','seamstress_anna','tenant_mikhail','bookseller_lev','nekrasov_reconstruction','literary_chichikov'].map(id => readJson(`./rpg/characters/${id}.json`)));
const maps = { nevsky: street, printshop: shop, chancery, courtyard, 'dead-souls': literaryMap }, hostCards = cards;
const questList = [firstQuest, publicQuest, circleQuest, letterQuest, literaryQuest];
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
function relationshipHintsFor(hostId) {
  const relations = state.hosts[hostId]?.relations ?? {};
  return Object.fromEntries(Object.entries(relations).filter(([group, value]) => relationHintValues.get(group)?.has(value)));
}
function playerActionHintsFor(hostId) {
  return state.ledger.filter(entry => entry.hostId === hostId && ['HISTORICAL_ACTION', 'LITERARY_ACTION'].includes(entry.eventType))
    .slice(-12).map(({ questId, actionId }) => ({ questId, actionId }));
}
const sourceRecords = new Map([source, firstIssue, ...historicalSources.records, literarySource].map(record => [record.sourceId, record]));
const initial = () => createInitialState({ maps, hostCards, quests: questList });
let state;
try { state = localStorage.getItem('v33-rpg-save') ? loadGame(localStorage.getItem('v33-rpg-save'), { maps, hostCards, quests: questList, learningExam }) : initial(); }
catch { state = initial(); }
const canvas = document.querySelector('#world'), renderer = createRenderer(canvas, { hostCards });
const $ = selector => document.querySelector(selector);
let lastMoveAt = 0, renderFrame = null, renderTimer = null, activeDialogueHost = null, activeDialogueKey = null, activeDialogueController = null, dialogueGeneration = 0, dialogueRequestPending = false;
const dialogueSessions = new Map(), dialogueTranscripts = new Map();
const dialogueKey = (actorHostId, speakerHostId) => `${actorHostId}::${speakerHostId}`;
const dialogueStorageKey = key => `v33-rpg-session:${key}`;
const aiBaseUrl = String(window.V33_RPG_AI_API_BASE_URL ?? '').replace(/\/$/, '');
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
const intentLabels = { SOURCE_REQUEST: '자료 확인', ACTION_REQUEST: '행동 요청', RISK_QUESTION: '공개·위험 질문', PERSONAL_QUESTION: '개인 질문', GENERAL_CONVERSATION: '일반 대화' };
const relationLabels = { editorial_office: '편집부', workshop: '작업장 동료', source_readers: '출처를 확인하는 독자', postal_route: '우편 경로', local_readers: '가게의 독자들', office_supervisor: '상급자', archive_keeper: '문서 담당자' };
function render(now) {
  renderFrame = null;
  renderer.draw(state, currentMap(), now, lastMoveAt);
  if (now - lastMoveAt < 360) renderTimer = window.setTimeout(() => { renderTimer = null; requestRender(); }, 40);
}
function requestRender() {
  if (renderTimer !== null) { window.clearTimeout(renderTimer); renderTimer = null; }
  if (renderFrame === null) renderFrame = requestAnimationFrame(render);
}
window.addEventListener('resize', requestRender, { passive: true });
const say = (title, text, actions = []) => { $('#headline').textContent = title; $('#journal-text').textContent = text; $('#actions').replaceChildren(...actions.map(({ label, subcopy, run }) => { const button = document.createElement('button'); button.type = 'button'; const heading = document.createElement('span'); heading.textContent = label; button.append(heading); if (subcopy) { const detail = document.createElement('small'); detail.textContent = subcopy; button.append(detail); } button.addEventListener('click', run); return button; })); };
const setState = next => { state = next; updateHud(); requestRender(); };
function currentMap() { return maps[state.world.currentMapId]; }
function actor() { return state.player.embodiment ? state.hosts[state.player.embodiment] : state.player; }
function mapObjectProperties(object) { return Object.fromEntries((object?.properties ?? []).map(property => [property.name, property.value])); }
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
  $('#place').textContent = map.metadata.displayNameKo; $('#mapname').textContent = map.metadata.displayNameKo;
  document.body.classList.toggle('literary-world', Boolean(state.world.activeRealm));
  const [year, month, day] = state.world.date.split('-').map(Number);
  $('#world-date').textContent = state.world.activeRealm ? '문학 속 1842년' : `${year}년 ${month}월`;
  $('#calendar-date').textContent = state.world.activeRealm ? '소설 속 장면' : `${year}년 ${month}월 ${day}일`;
  const dayMinute = ((state.world.clockMinutes ?? 540) % 1440 + 1440) % 1440;
  $('#clock').textContent = state.world.activeRealm ? '문학 세계 · 1842' : `${String(Math.floor(dayMinute / 60)).padStart(2, '0')}:${String(dayMinute % 60).padStart(2, '0')}`;
  $('#bodyname').textContent = host ? `몸을 빌림 · ${host.displayNameKo}` : '바깥에서 바라보는 중';
  $('#coins').textContent = host ? (state.hosts[host.id].money.amount == null ? '자금 기록 없음' : `${state.hosts[host.id].money.amount} 코페이카`) : '몸을 빌리면 주머니를 확인할 수 있습니다';
  $('#release').disabled = !host || Boolean(activeDialogueHost);
  const conversationPartner = nearbyConversationPartner();
  $('#talk').textContent = conversationPartner ? `말 걸기 · ${conversationPartner.displayNameKo}` : '가까이서 말하기';
  $('#talk').disabled = !host || !conversationPartner || Boolean(activeDialogueHost);
  document.querySelectorAll('.touch-pad button').forEach(button => { button.disabled = Boolean(activeDialogueHost); });
  $('#load').disabled = !localStorage.getItem('v33-rpg-save');
  const notebook = $('#host-notebook'), facts = $('#host-facts');
  notebook.hidden = !host; facts.replaceChildren();
  if (host) {
    const live = state.hosts[host.id], known = host.secretKnowledge.filter(item => live.privateKnowledgeIds.includes(item.id)).map(item => item.summaryKo);
    if (live.knownEvidenceIds.includes(source.sourceId)) known.push('투르게네프의 작품 원문과 번역을 읽었다.');
    for (const record of historicalSources.records) if (live.knownEvidenceIds.includes(record.sourceId)) known.push(`${record.documentDate}년 자료를 읽었다 · ${record.titleKo}`);
    for (const id of live.knownEvidenceIds) {
      const clue = sceneObservations.entries[id];
      if (clue) known.push(`허구 소품 조사 · ${clue.titleKo}`);
    }
    for (const fact of [`현재 일과 · ${live.currentActivityKo || host.personalObjective}`, `오늘 할 일 · ${host.personalObjective}`, `신분/직업 · ${host.socialEstate} · ${host.occupation}`, `갈 수 있는 곳 · ${live.allowedMaps.map(id => maps[id].metadata.displayNameKo).join(', ')}`, `다닐 수 없는 곳 · ${host.legalMobility}`, `가진 물건 · ${live.inventory.join(', ')}`, `아는 것 · ${known.join(' ') || '아직 기록된 정보가 없다.'}`]) {
      const item = document.createElement('li'); item.textContent = fact; facts.append(item);
    }
    for (const [group, status] of Object.entries(live.relations ?? {})) { const item = document.createElement('li'); item.textContent = `관계 · ${relationLabels[group] ?? group} · ${status}`; facts.append(item); }
    for (const situation of live.situationNotes ?? []) { const item = document.createElement('li'); item.textContent = `상황 변화 · ${situation}`; facts.append(item); }
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
    const props = Object.fromEntries((object.properties ?? []).map(p => [p.name, p.value]));
    const host = object.type === 'npc' ? state.hosts[props.hostId] : null;
    if (object.type === 'npc' && (!host || host.mapId !== currentMap().mapId)) return false;
    if (object.type === 'npc' && props.hostId === state.player.embodiment) return false;
    const position = object.type === 'npc' ? host.position : { x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) };
    return nearTile(at, position, object.type === 'npc' ? 2 : 1);
  });
}
function questIsAvailable(activeQuest) {
  return Boolean(activeQuest && (activeQuest.chapterId === state.world.chapterId || (activeQuest.chapterId === 'LITERARY_DEAD_SOULS' && state.world.activeRealm?.id === campaign.literaryRealm.id)) && (!activeQuest.date || activeQuest.date <= state.world.date || activeQuest.chapterId === 'LITERARY_DEAD_SOULS'));
}
function sourceRead(sourceId, archiveSourceIds = [], readingMode = 'PHYSICAL_COPY') {
  const record = sourceRecords.get(sourceId);
  if (!record) { sayRecord('자료 목록에서 확인되지 않는 문서다.'); return; }
  const recorded = recordSourceRead(state, sourceId, maps, archiveSourceIds, readingMode);
  if (recorded.ok) setState(recorded.state);
  else { sayRecord(recorded.reason === 'source_not_present' ? '이 장소나 시점에는 아직 열람할 수 없는 자료다.' : '이 자료를 지금은 읽을 수 없다.'); return; }
  showSourceSummary(record);
  const recordedMode = recorded.state.ledger.at(-1)?.readingMode;
  sayRecord(recordedMode === 'PHYSICAL_COPY'
    ? `현장에서 읽음 · ${record.creator ?? record.author} · 현재 몸의 자료 기록에 남겼다`
    : `자료철에서 살펴봄 · ${record.creator ?? record.author} · 기록의 손님 메모에 남겼다`);
}
function showSourceSummary(record = source) {
  const isTurgenev = record.sourceId === source.sourceId;
  const context = isTurgenev ? '1847년 《Современник》 첫 호에 실린 「호리와 칼리니치」의 도입부다. 화자는 지주 폴루티킨을 따라 그의 농노 호리 집으로 향한다. 작품 속 서술이며 역사적 증언이 아니다.' : record.contextKo;
  const provenance = isTurgenev ? `${record.witness.edition}\n\n위치: ${record.witness.range}\n\n첫 간행물: ${record.firstPublication}\n\n${record.witness.note}\n\n${record.translationNoteKo}` : `${record.edition}\n\n문서 시점: ${record.documentDate}\n위치: ${record.range}\n자료 성격: ${record.type}\n\n${record.translationNoteKo}`;
  const url = isTurgenev ? record.witness.stableRevisionUrl : record.sourceUrl;
  say(record.titleKo, context, [{ label: '원문과 번역 펼치기', run: () => {
    const body = record.paragraphs.map((paragraph, index) => `(${index + 1}) ${paragraph.ru}\n${paragraph.ko}`).join('\n\n');
    say(record.titleKo, `${context}\n\n${body}`, [{ label: '판본과 출처 보기', run: () => { say('판본과 출처', provenance, [
      { label: '확인한 원문 열기', subcopy: record.range ?? record.witness.range, run: () => window.open(url, '_blank', 'noopener,noreferrer') },
      ...(isTurgenev ? [{ label: '작품의 첫 간행 기록 열기', subcopy: '투르게네프 전자도서관', run: () => window.open(record.firstPublicationSourceUrl, '_blank', 'noopener,noreferrer') }, { label: '《Современник》 1847년 제1호 서지 열기', subcopy: '러시아 국립전자도서관', run: () => window.open(record.catalogUrl, '_blank', 'noopener,noreferrer') }] : []),
      { label: '자료 목록으로', run: () => openSourceDrawer() },
    ]); } }]);
  } }]);
}
function openSourceDrawer() {
  const available = state.world.activeRealm ? [...(state.world.activeRealm.sourceIds ?? [])] : campaign.arcs.filter(arc => arc.id === state.world.chapterId || state.world.completedChapterIds?.includes(arc.id)).flatMap(arc => arc.sources);
  const unlocked = [...new Set(available)].filter(id => {
    if (!sourceRecords.has(id)) return false;
    const sourceObject = Object.values(maps).flatMap(map => map.layers.find(layer => layer.name === 'Interactions')?.objects ?? []).find(object => object.properties?.some(property => property.name === 'sourceId' && property.value === id));
    const availableDate = sourceObject?.properties?.find(property => property.name === 'availableDate')?.value;
    return !availableDate || availableDate <= state.world.date;
  });
  const sourceButtons = unlocked.map(id => sourceRecords.get(id)).map(record => ({ label: record.titleKo, subcopy: `${record.documentDate ?? '1847'} · ${record.type ?? '문학 원문'} · ${record.range ?? record.witness.range}`, run: () => sourceRead(record.sourceId, unlocked, 'PLAYER_ARCHIVE') }));
  const realmActions = state.world.activeRealm
    ? [{ label: '문학 세계에서 돌아오기', subcopy: '1847–1849 역사 연표로 돌아갑니다 · 문학 속 사건은 역사 기록에 합쳐지지 않습니다', run: () => { const result = leaveLiteraryRealm(state, maps); if (result.ok) { setState(result.state); say('현실의 거리로 돌아오다', '도청 소재지의 여관은 소설 속에 남아 있다. 이곳에서 본 것은 역사 속 사람의 기억이 되지 않는다.', [{ label: '자료철 열기', run: openSourceDrawer }]); } } }]
    : [{ label: '《죽은 혼》의 문학 세계로 들어가기', subcopy: '1842년 소설의 별도 장면입니다 · 역사 연표와 인물의 지식은 섞이지 않습니다 · 몸을 놓은 뒤 들어갑니다', run: () => { const card = cards.find(item => item.id === campaign.literaryRealm.hostId); const result = enterLiteraryRealm(state, maps[campaign.literaryRealm.mapId], card); if (result.ok) { setState(result.state); say('《죽은 혼》의 여관', '소설 제1장에 나오는 도청 소재지 여관이다. 여기의 장부와 인물은 문학 세계에만 속한다.', [{ label: '자료철 열기', run: openSourceDrawer }]); } else sayRecord('먼저 빌린 몸을 놓아주고 다시 시도하자.'); } }];
  say(state.world.activeRealm ? '문학 세계의 자료' : '지금까지 열린 자료', state.world.activeRealm
    ? '소설 속에 놓인 책을 직접 읽으면 그 장면의 인물이 알게 된다.'
    : '자료철은 기록의 손님이 살펴보는 목록이다. 빌린 몸의 지식에는 그 사람이 현장에서 직접 읽거나 전달받은 자료만 남는다. 날짜가 오지 않은 문서는 연표가 진행된 뒤 열린다.', [...sourceButtons, ...realmActions]);
}
function continuationFor(activeQuest) {
  if (activeQuest.chapterId === 'LITERARY_DEAD_SOULS') return [{ label: '문학 세계 자료철 열기', run: openSourceDrawer }];
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
function inspect(object) {
  const props = Object.fromEntries((object.properties ?? []).map(p => [p.name, p.value]));
  if (object.type === 'npc') {
    const card = cards.find(item => item.id === props.hostId), host = state.hosts[props.hostId];
    if (state.player.embodiment && card.id !== state.player.embodiment) {
      say(card.displayNameKo, `${card.occupation}. ${card.personalObjective}`, [{ label: `${card.displayNameKo}에게 말 걸기`, run: () => startConversation(card) }]);
    } else if (state.player.embodiment === card.id) {
      say(card.displayNameKo, `지금 빌린 몸이다. ${card.personalObjective} · ${describeHostMoney(host.money)}`, [{ label: '이 몸의 수첩 보기', run: () => { $('#host-notebook').open = true; $('#host-notebook').hidden = false; } }]);
    } else {
      say(card.displayNameKo, `${card.occupation}. ${card.personalObjective} 가까이에서 그 사람의 시야로 들어갈 수 있다.`, [{ label: '몸을 빌린다', run: () => { const result = possessHost(state, card.id, currentMap()); if (result.ok) { setState(result.state); say(card.displayNameKo, `눈높이가 달라졌다. ${card.speechRhythm} ${describeHostMoney(host.money)}`, []); sayRecord(`시야 전환 · ${card.displayNameKo}`); } else sayRecord(result.reason === 'already_embodied' ? '먼저 현재 몸을 놓아주자.' : '한두 걸음 더 가까이 가 보자.'); } }]);
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
    say(clue.titleKo, `${hostLine ?? clue.textKo}\n\n${clue.textKo}\n\n${sceneObservations.disclaimerKo}`, []);
    sayRecord(`허구 소품 조사 · ${clue.titleKo} · ${state.player.embodiment ? '현재 몸의 수첩에 기록' : '관찰 기록에만 저장'}`);
  }
  else if (props.questId) {
    const activeQuest = questsById.get(props.questId);
    if (!questIsAvailable(activeQuest)) { say('아직 시작할 때가 아니다', '이 장의 사건이 열리면 여기서 이어진다.', []); return; }
    if (state.quests[activeQuest.id]?.status === 'resolved') {
      say(activeQuest.titleKo, '이 장의 선택은 이미 기록되어 있다. 다음으로 이어갈 수 있다.', continuationFor(activeQuest));
      return;
    }
    const actionSpecs = activeQuest.actions.filter(action => action.hostIds.includes(state.player.embodiment) && (!action.requiredKnowledgeId || knowledgeForHost(state, state.player.embodiment).includes(action.requiredKnowledgeId)));
    const opts = actionSpecs.map(action => ({ label: action.labelKo, subcopy: action.subcopyKo, run: () => {
      const result = performQuestAction(state, { questId: activeQuest.id, hostId: state.player.embodiment, actionId: action.id, objectId: object.id }, { quests: questList, maps });
      if (!result.ok) { sayRecord(`처리할 수 없음 · ${result.reason}`); return; }
      setState(result.state);
      const actions = continuationFor(activeQuest);
      say(action.followupTitleKo ?? activeQuest.titleKo, `${action.resultKo}${action.followupKo ? `\n\n${action.followupKo}` : ''}`, actions);
      sayRecord('현장 행동을 장부에 기록했다.');
    } }));
    say(activeQuest.titleKo, activeQuest.premiseKo, opts);
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
  if (activeDialogueHost) return;
  const near = currentNearby();
  if (!near.length) { say('아직 손이 닿지 않는다', '주변을 조금 더 걸어 가까이 가 보자. 사람에게 다가가면 그 사람의 자리에서 도시를 볼 수 있다.', []); return; }
  const nearbyPeople = near.filter(item => item.type === 'npc');
  if (!state.player.embodiment && nearbyPeople.length > 1 && !near.some(item => item.type === 'source' || item.type === 'map-exit')) {
    const choices = nearbyPeople.map(item => {
      const hostId = mapObjectProperties(item).hostId, card = cards.find(character => character.id === hostId), person = state.hosts[hostId];
      return { label: `${card.displayNameKo} 살펴보기`, subcopy: `${card.occupation} · ${person.currentActivityKo || card.personalObjective}`, run: () => inspect(item) };
    });
    say('가까이에 사람이 있다', '누구에게 다가갈지 고르자. 인물을 먼저 살펴본 뒤 몸을 빌릴 수 있다.', choices);
    return;
  }
  const activeQuestObject = near.find(item => {
      if (item.type !== 'quest-object') return false;
      const questId = Object.fromEntries((item.properties ?? []).map(property => [property.name, property.value])).questId;
      return questIsAvailable(questsById.get(questId)) && state.quests[questId]?.status !== 'resolved';
    });
  const object = activeQuestObject
    ?? near.find(item => item.type === 'source')
    ?? near.find(item => item.type === 'map-exit')
    ?? near.find(item => item.type === 'npc' && mapObjectProperties(item).hostId !== state.player.embodiment)
    ?? near.find(item => item.type === 'quest-object' && questIsAvailable(questsById.get(mapObjectProperties(item).questId)))
    ?? near[0];
  inspect(object);
}
function move(direction) {
  if (activeDialogueHost) return;
  const result = moveActor(state, direction, currentMap(), maps);
  if (result.moved) { setState(result.state); lastMoveAt = performance.now(); }
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
  const text = lines.length ? lines.slice(-12).map(line => `${line.speaker} · ${line.text}`).join('\n\n') : promptText;
  const replyActions = replies.slice(0, 3).map((label, index) => ({ label, run: () => sendConversation(card, label, `R${index + 1}`) }));
  replyActions.push({ label: '대화 마치기', run: () => finishConversation(card.id) });
  say(card.displayNameKo, text, replyActions);
  if (dialogueRequestPending) $('#actions').querySelectorAll('button').forEach(button => { if (button.textContent.trim() !== '대화 마치기') button.disabled = true; });
  const form = document.createElement('form'); form.className = 'dialogue-input';
  const input = document.createElement('input'); input.type = 'text'; input.maxLength = 800; input.autocomplete = 'off'; input.placeholder = '하고 싶은 말을 적어보세요'; input.setAttribute('aria-label', '대사 입력'); input.disabled = dialogueRequestPending;
  const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = '말하기'; submit.disabled = dialogueRequestPending;
  form.append(input, submit); form.addEventListener('submit', event => { event.preventDefault(); const value = input.value.trim(); if (value) sendConversation(card, value); });
  $('#actions').append(form);
  $('.journal').scrollTop = 0;
  if (statusText) sayRecord(statusText);
}
async function startConversation(card) {
  const actorCard = cards.find(item => item.id === state.player.embodiment), partner = nearbyConversationPartner();
  if (!actorCard || partner?.id !== card.id || activeDialogueHost) { sayRecord('말을 건넬 사람이 가까이 있지 않다.'); return; }
  const key = dialogueKey(actorCard.id, card.id);
  const generation = ++dialogueGeneration;
  dialogueRequestPending = false;
  activeDialogueHost = card.id; activeDialogueKey = key; updateHud();
  let session = dialogueSessions.get(key);
  if (!session && aiBaseUrl) {
    showConversation(card, '대화를 준비하고 있다…', [], '서버 연결을 확인하는 중');
    const controller = new AbortController(); activeDialogueController = controller;
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const saved = sessionStorage.getItem(dialogueStorageKey(key));
      if (saved) session = { token: saved };
      else {
        const response = await fetch(`${aiBaseUrl}/api/rpg/session/start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hostId: card.id, actorHostId: actorCard.id }), signal: controller.signal });
        if (!response.ok) throw new Error('session unavailable');
        const result = await response.json(); session = { token: result.sessionToken, mode: result.mode };
        if (!session.token) throw new Error('session token missing');
        sessionStorage.setItem(dialogueStorageKey(key), session.token);
      }
      if (dialogueGeneration !== generation || activeDialogueKey !== key) return;
      dialogueSessions.set(key, session);
    } catch { session = null; }
    finally { clearTimeout(timer); if (activeDialogueController === controller) activeDialogueController = null; }
    if (activeDialogueHost !== card.id || activeDialogueKey !== key || dialogueGeneration !== generation) return;
  }
  const mode = !aiBaseUrl ? '오프라인 대사로 진행한다' : session?.mode === 'BLOCKED_NO_KEY' ? 'BLOCKED_NO_KEY · 인물별 오프라인 대사로 진행한다' : session ? '대화 세션이 준비됐다' : '연결할 수 없어 오프라인 대사로 진행한다';
  showConversation(card, `${actorCard.displayNameKo}의 처지에서 ${card.displayNameKo}에게 말을 건넨다. 상대는 자기 경험과 알고 있는 범위 안에서 답한다. 대화만으로 돈이나 퀘스트 결과가 바뀌지는 않는다.`, aiScenes.sessions[card.id].fallbackReplies, mode);
}
async function sendConversation(card, playerText, replyId = null) {
  const key = activeDialogueKey;
  const generation = dialogueGeneration;
  if (activeDialogueHost !== card.id || !key || dialogueRequestPending || state.player.embodiment === card.id || nearbyConversationPartner()?.id !== card.id) return;
  const intentClass = classifyTypedResponse(playerText);
  const actorCard = cards.find(item => item.id === state.player.embodiment);
  const lines = dialogueTranscripts.get(key) ?? []; lines.push({ speaker: actorCard.displayNameKo, text: playerText });
  const session = dialogueSessions.get(key); let turn = null, fallbackReason = '';
  if (session?.token && !['BLOCKED_NO_KEY', 'BLOCKED_LIMIT'].includes(session.mode) && aiBaseUrl) {
    dialogueRequestPending = true;
    const controller = new AbortController(); activeDialogueController = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    showConversation(card, '', [], '잠시 생각하는 중…');
    try {
      const response = await fetch(`${aiBaseUrl}/api/rpg/dialogue`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionToken: session.token, requestId: crypto.randomUUID(), playerInput: playerText, actorRelations: relationshipHintsFor(actorCard.id), actorActions: playerActionHintsFor(actorCard.id) }), signal: controller.signal });
      if (!response.ok) {
        if (response.status === 429) {
          session.mode = 'BLOCKED_LIMIT'; dialogueSessions.set(key, session); sessionStorage.removeItem(dialogueStorageKey(key));
          fallbackReason = '대화 요청 한도에 도달해 오프라인 대사로 이어간다';
        }
        throw new Error('dialogue unavailable');
      }
      const data = await response.json(), candidate = data.turn;
      if (candidate?.sceneId !== aiScenes.sessions[card.id].sceneId || !Array.isArray(candidate.beats) || candidate.beats.length < 1 || candidate.beats.length > 2 || !candidate.beats.every(beat => beat && [card.id, 'NARRATION'].includes(beat.speakerId) && typeof beat.textKo === 'string' && beat.textKo.length <= 420) || !Array.isArray(candidate.suggestedReplies) || candidate.suggestedReplies.length < 2 || candidate.suggestedReplies.length > 3 || !candidate.suggestedReplies.every(reply => reply && typeof reply.textKo === 'string' && reply.textKo.length <= 80)) throw new Error('invalid dialogue response');
      turn = candidate; fallbackReason = data.fallback ? data.mode : '';
    } catch { fallbackReason ||= '연결이 늦어 오프라인 대사로 이어간다'; }
    finally {
      clearTimeout(timer);
      if (activeDialogueController === controller) activeDialogueController = null;
      if (dialogueGeneration === generation) dialogueRequestPending = false;
    }
    if (activeDialogueHost !== card.id || activeDialogueKey !== key || dialogueGeneration !== generation) return;
  }
  const local = aiScenes.sessions[card.id];
  if (!turn) turn = { beats: [{ speakerId: card.id, textKo: local.fallbackKo, emotion: 'neutral' }], suggestedReplies: local.fallbackReplies.map((textKo, index) => ({ id: `R${index + 1}`, textKo })) };
  for (const beat of turn.beats) lines.push({ speaker: beat.speakerId === 'NARRATION' ? '기록' : card.displayNameKo, text: beat.textKo });
  dialogueTranscripts.set(key, lines.slice(-24));
  const recorded = recordDialogueTurn(state, { hostId: card.id, actorHostId: actorCard.id, sceneId: local.sceneId, intentClass }, maps);
  if (recorded.ok) setState(recorded.state);
  const replies = (turn.suggestedReplies ?? []).slice(0, 3);
  showConversation(card, '', replies.map(reply => reply.textKo), `${replyId ? `선택한 말 · ${replyId} · ` : ''}입력 분류 · ${intentLabels[intentClass]} · ${fallbackReason || (session ? '대화 내용을 이 인물의 세션에만 남겼다' : '오프라인 대사 · 게임 진행은 계속할 수 있다')}`);
  $('.journal').scrollTop = $('.journal').scrollHeight;
}
document.addEventListener('keydown', event => {
  if (!$('#learning-screen').hidden) {
    if (event.key === 'Escape') { event.preventDefault(); hideLearningScreen(); }
    return;
  }
  const direction = ({ ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' })[event.key];
  if (direction) { event.preventDefault(); move(direction); }
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
      say(clue.titleKo, `${hostLine ?? clue.textKo}\n\n${clue.textKo}\n\n${sceneObservations.disclaimerKo}`, []);
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
$('#record').insertAdjacentHTML('afterend', '<button id="source-drawer-open" type="button">자료철 열기</button>');
$('#source-drawer-open').addEventListener('click', openSourceDrawer);
