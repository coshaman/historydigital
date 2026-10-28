(async function () {
  const query = new URLSearchParams(location.search);
  const isMain20Route = location.hash === '' || location.hash === '#main' || query.has('main20');
  if (!isMain20Route) return;
  window.__main20RuntimeOwner = 'main20'; window.runtimeOwner = 'main20';
  const data = await fetch('narrative/MAIN_20MIN_DIALOGUE.json?v=48').then((response) => response.json());
  const [branchGraph, branchSources, e04Scene, learningExam, lifeSimulation, lateGame] = await Promise.all([
    fetch('narrative/ACT_III_BRANCH_ROUTE.json?v=3').then((response) => response.json()),
    fetch('narrative/ACT_III_BRANCHING_SOURCES.json?v=2').then((response) => response.json()),
    fetch('narrative/E04_SCENE.json?v=1').then((response) => response.json()),
    fetch('narrative/ACT_III_LEARNING_EXAM.json?v=1').then((response) => response.json()),
    fetch('narrative/ACT_III_LIFE_SIMULATION.json?v=1').then((response) => response.json()),
    fetch('narrative/LATE_GAME_SCENARIOS.json?v=1').then((response) => response.json())
  ]);
  data.sourceRegister = [...(data.sourceRegister || []), ...branchSources.map((source) => ({
    sourceId: source.sourceId, date: source.date, edition: source.edition, locator: source.locator,
    originalRussian: source.originalRussian.map((part) => part.text).join('\n\n'),
    koreanTranslation: source.koreanTranslation.map((part) => part.text).join('\n\n'),
    classification: source.sourceClass, availableDate: source.availabilityDate, url: source.url,
    contextRangeId: source.sourceId, context: source.provenanceNote
  }))];
  if (Array.isArray(data.v44MainSceneIds) && Array.isArray(data.scenes)) { const archived = data.scenes.filter((item) => !data.v44MainSceneIds.includes(item.id)); data.archiveSceneRecords = [...(data.archiveSceneRecords || []), ...archived]; data.scenes = data.scenes.filter((item) => data.v44MainSceneIds.includes(item.id)); }
  if (e04Scene && !data.scenes.some((item) => item.id === 'E04')) { const e07Index = data.scenes.findIndex((item) => item.id === 'E07'); data.scenes.splice(e07Index < 0 ? data.scenes.length : e07Index, 0, e04Scene); }
  for (const excerpt of e04Scene?.excerpts || []) if (!data.sourceRegister.some((source) => source.sourceId === excerpt.sourceId)) data.sourceRegister.push({
    sourceId: excerpt.sourceId, date: excerpt.sourceDate, edition: excerpt.edition, locator: excerpt.locator,
    originalRussian: excerpt.ru, koreanTranslation: excerpt.ko, classification: 'PRIMARY_DOCUMENT',
    availableDate: excerpt.availableDate, url: excerpt.sourceUrl, contextRangeId: excerpt.excerptId, context: excerpt.context
  });
  const storageKey = 'chancery-main20-v35';
  const $ = (id) => document.getElementById(id);
  const rawSave = query.has('v42fresh') ? null : JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem('chancery-main20-v34') || localStorage.getItem('chancery-main20-v33') || localStorage.getItem('chancery-main20-v32') || 'null');
  const defaultExamSeed = rawSave?.examSeed || rawSave?.lateGameSessionId || crypto.randomUUID?.() || `exam-${Date.now()}`;
  const examQuestionBank = [...learningExam.questions];
  const applyExamSeed = (seed) => { learningExam.questions = window.Main20Exam.selectExamQuestions({ ...learningExam, questions: examQuestionBank }, seed); };
  applyExamSeed(defaultExamSeed);
  const fresh = () => ({ schemaVersion: data.schemaVersion, sceneIndex: 0, phase: 'onboarding', onboardingIndex: 0, onboardingComplete: false, introIndex: 0, discussionIndex: 0, reactionIndex: 0, ideologyBeatIndex: 0, ideologyLineIndex: 0, ideologyReadBeat: null, c07BeatIndex: 0, c07LineIndex: 0, c07ReadBeat: null, c07IdeologyComplete: false, initialChoiceId: null, postChoiceId: null, branchHubIndex: 0, routeChoices: [], branchState: {}, activeBranchEventId: null, activeBranchLineIndex: 0, activeBranchReadHub: null, circleLearningIndex: 0, examQuestionIndex: 0, examAnswers: {}, examOutcome: 'unset', examCorrectCount: null, promotionStatus: 'pending', examSeed: defaultExamSeed, endingTimelineIndex: 0, readExcerptIdsByScene: {}, readEventsByScene: {}, readingScrollByScene: {}, history: [], flags: [], ideology: Object.fromEntries((data.ideologyDimensions || []).map((key) => [key, 0])), ideologyEvidence: [], beliefs: [], actions: [], visibleCallbacks: [], relationships: { alexei: 0, ekaterina: 0, pavel: 0 }, lateGameSessionId: crypto.randomUUID?.() || `session-${Date.now()}-${Math.random()}`, lateGameMemories: [], lateGameTurns: [], lateGameSummary: '', lateGameSceneId: null, lateGameSceneTurn: 0, lateGameActivities: [], lateGamePendingActivities: [], windowView: 'closed', endingId: null, endingResolution: null, legacyEndingTitle: null });
  const normalize = (raw) => { const next = fresh(); if (!raw) return next; const legacy = raw.schemaVersion === 'MAIN-20MIN-DIALOGUE-V34' || raw.schemaVersion === 'MAIN-20MIN-DIALOGUE-V33' || raw.schemaVersion === 'MAIN-20MIN-DIALOGUE-V32' || raw.schemaVersion === 'MAIN-20MIN-DIALOGUE-V35'; if (raw.schemaVersion !== data.schemaVersion && !legacy) return next; Object.assign(next, raw); next.schemaVersion = data.schemaVersion; next.routeChoices = Array.isArray(raw.routeChoices) ? raw.routeChoices.filter((id) => branchGraph.branches.some((branch) => branch.choiceId === id)).slice(0, branchGraph.hubs.length) : []; next.branchHubIndex = Number.isInteger(raw.branchHubIndex) && raw.branchHubIndex >= 0 && raw.branchHubIndex <= branchGraph.hubs.length ? raw.branchHubIndex : 0; next.branchState = raw.branchState && typeof raw.branchState === 'object' && !Array.isArray(raw.branchState) ? raw.branchState : {}; next.activeBranchEventId = branchGraph.events.some((event) => event.id === raw.activeBranchEventId) ? raw.activeBranchEventId : null; next.activeBranchLineIndex = Number.isInteger(raw.activeBranchLineIndex) && raw.activeBranchLineIndex >= 0 ? raw.activeBranchLineIndex : 0; next.activeBranchReadHub = branchGraph.hubs.some((hub) => hub.id === raw.activeBranchReadHub) ? raw.activeBranchReadHub : null; next.readExcerptIdsByScene = raw.readExcerptIdsByScene && typeof raw.readExcerptIdsByScene === 'object' ? raw.readExcerptIdsByScene : {}; next.readEventsByScene = raw.readEventsByScene && typeof raw.readEventsByScene === 'object' ? raw.readEventsByScene : {}; next.readingScrollByScene = raw.readingScrollByScene && typeof raw.readingScrollByScene === 'object' ? raw.readingScrollByScene : {}; next.flags = Array.isArray(raw.flags) ? [...new Set(raw.flags)] : []; next.history = Array.isArray(raw.history) ? raw.history : []; next.ideology = { ...fresh().ideology, ...(raw.ideology || {}) }; next.ideologyEvidence = Array.isArray(raw.ideologyEvidence) ? raw.ideologyEvidence : []; next.beliefs = Array.isArray(raw.beliefs) ? raw.beliefs : next.ideologyEvidence; next.actions = Array.isArray(raw.actions) ? raw.actions : next.history.filter((item) => item.choiceKind === 'ACTION').map((item) => item.action); next.visibleCallbacks = Array.isArray(raw.visibleCallbacks) ? raw.visibleCallbacks : []; next.relationships = { ...next.relationships, ...(raw.relationships || {}) }; if (legacy) { next.legacyEndingTitle = raw.endingId || raw.legacyEndingTitle || null; next.endingId = null; next.endingResolution = null; if (next.phase === 'ending' || next.phase === 'final_choice') next.phase = 'legacy_recovery'; } return next; };
  const normalizeFeatureState = (candidate) => {
    const next = candidate || fresh();
    if (typeof next.lateGameSessionId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(next.lateGameSessionId)) next.lateGameSessionId = fresh().lateGameSessionId;
    next.lateGameMemories = Array.isArray(next.lateGameMemories) ? next.lateGameMemories.filter((item) => item?.subjectId === 'player' && ['alexei', 'ekaterina', 'pavel'].includes(item.characterId) && typeof item.summaryKo === 'string').slice(-24) : [];
    next.lateGameTurns = Array.isArray(next.lateGameTurns) ? next.lateGameTurns.filter((item) => ['user', 'assistant'].includes(item.role) && typeof item.text === 'string').slice(-10) : [];
    next.lateGameSummary = typeof next.lateGameSummary === 'string' ? next.lateGameSummary.slice(0, 1200) : '';
    next.lateGameSceneId = lateGame.scenes.some((item) => item.id === next.lateGameSceneId && (item.kind === 'AI_DIALOGUE' || item.id === 'EXAM_01')) ? next.lateGameSceneId : null;
    next.lateGameSceneTurn = Number.isInteger(next.lateGameSceneTurn) ? Math.max(0, Math.min(8, next.lateGameSceneTurn)) : 0;
    next.lateGameActivities = Array.isArray(next.lateGameActivities) ? next.lateGameActivities.filter((id, index, all) => lateGame.schedule.activityIds.includes(id) && all.indexOf(id) === index).slice(0, 2) : [];
    next.lateGamePendingActivities = Array.isArray(next.lateGamePendingActivities) ? next.lateGamePendingActivities.filter((id) => lateGame.schedule.activityIds.includes(id)).slice(0, 2) : [];
    next.circleLearningIndex = Number.isInteger(next.circleLearningIndex) ? Math.max(0, Math.min(learningExam.learningUnits.length - 1, next.circleLearningIndex)) : 0;
    next.examQuestionIndex = Number.isInteger(next.examQuestionIndex) ? Math.max(0, Math.min(learningExam.questions.length - 1, next.examQuestionIndex)) : 0;
    const validQuestionIds = new Set(learningExam.questions.map((question) => question.id));
    next.examAnswers = Object.fromEntries(Object.entries(next.examAnswers && typeof next.examAnswers === 'object' ? next.examAnswers : {}).filter(([questionId, optionId]) => validQuestionIds.has(questionId) && learningExam.questions.find((question) => question.id === questionId)?.options.some((option) => option.id === optionId)));
    if (!['passed', 'failed', 'deferred', 'helped-peer', 'unset'].includes(next.examOutcome)) next.examOutcome = 'unset';
    next.examCorrectCount = Number.isInteger(next.examCorrectCount) && next.examCorrectCount >= 0 && next.examCorrectCount <= learningExam.questionCount ? next.examCorrectCount : null;
    next.promotionStatus = window.Main20Exam.derivePromotionStatus(next.examOutcome);
    next.endingTimelineIndex = Number.isInteger(next.endingTimelineIndex) ? Math.max(0, Math.min(lifeSimulation.periods.length - 1, next.endingTimelineIndex)) : 0;
    return next;
  };
  let state = normalizeFeatureState(normalize(rawSave));
  const scene = () => data.scenes[state.sceneIndex]; const save = () => localStorage.setItem(storageKey, JSON.stringify(state)); const setText = (id, text) => { const node = $(id); if (node) node.textContent = text; }; const setVisible = (id, visible) => { const node = $(id); if (node) node.hidden = !visible; }; const choices = () => $('choiceArea'); const readIds = (current = scene()) => state.readExcerptIdsByScene[current.id] || [];
  const markRead = (current, excerptId) => { const ids = new Set(readIds(current)); if (ids.has(excerptId)) return; ids.add(excerptId); state.readExcerptIdsByScene[current.id] = [...ids]; state.readEventsByScene[current.id] = [...(state.readEventsByScene[current.id] || []), { excerptId, at: new Date().toISOString() }]; save(); };
  const currentContextId = () => state.phase === 'ideology_prologue' ? data.ideologyPrologue.beats[state.ideologyBeatIndex]?.id : state.phase === 'c07_ideology' ? data.c07IdeologicalFollowUp.beats[state.c07BeatIndex]?.id : scene().id;
  const choiceTypeFor = (choice) => choice.choiceKind || Object.entries(data.v44ChoiceTypes || {}).find(([, ids]) => ids.includes(choice.id))?.[0] || Object.entries(data.v43ChoiceTypeRegistry || {}).find(([, ids]) => ids.includes(choice.id))?.[0] || (choice.action ? 'ACTION' : 'DIALOGUE_RESPONSE');
  const addChoiceEffects = (choice, kind) => { const choiceKind = choiceTypeFor(choice); state.flags = [...new Set([...state.flags, ...(choice.flagsAdd || [])])]; for (const [person, amount] of Object.entries(choice.relationship || {})) state.relationships[person] = (state.relationships[person] || 0) + amount; for (const [dimension, amount] of Object.entries(choice.ideologyEffects || {})) state.ideology[dimension] = (state.ideology[dimension] || 0) + Number(amount || 0); if (choice.beliefStatement && choiceKind !== 'ACTION') { const belief = { choiceId: choice.id, statement: choice.beliefStatement, callbackKey: choice.callbackKey || null, sceneId: currentContextId(), choiceKind }; state.ideologyEvidence.push(belief); state.beliefs.push(belief); } if (choiceKind === 'ACTION') state.actions.push(choice.action || choice.id); if (choice.callbackKey) state.visibleCallbacks = [...new Set([...state.visibleCallbacks, choice.callbackKey])]; state.history.push({ sceneId: currentContextId(), kind, choiceId: choice.id, choiceKind, action: choice.action || choice.id, actor: choice.actor || 'PLAYER', witnesses: choice.witnesses || choice.semantic?.whoHears || ['NONE'], visibility: choice.visibility || choice.semantic?.visibility || 'SPOKEN', endingAffinity: choice.endingAffinity || {}, affinityRationale: choice.affinityRationale || {}, ideologyEffects: choice.ideologyEffects || {}, beliefStatement: choice.beliefStatement || null, callbackKey: choice.callbackKey || null, flags: choice.flagsAdd || [] }); };
  const labelFor = (speaker) => speaker === 'NARRATION' ? '장면' : (speaker === 'PLAYER_PROMPT' || speaker === 'PLAYER' || speaker === 'protagonist') ? '서기관' : ({ alexei: '알렉세이 오를로프', ekaterina: '예카테리나 벨로바', pavel: '파벨 안토노프' }[speaker] || speaker);
  function renderDialogueLine(speaker, text) { setText('speaker', labelFor(speaker)); setText('dialogue', data.dialoguePresentation?.[text] || text); const frame = document.querySelector('#v28Portrait'); const image = frame?.querySelector('img'); const src = speaker === 'alexei' ? 'assets/portraits/alexei-orlov.png' : speaker === 'ekaterina' ? 'assets/portraits/ekaterina-belova.png' : speaker === 'pavel' ? 'assets/portraits/pavel-antonov.png' : ''; if (frame) { frame.hidden = !src; frame.style.display = src ? '' : 'none'; } if (image) { image.alt = labelFor(speaker); image.src = src; } }
  let headerScene = -1; let headerTimer;
  function renderHeader(current) { setText('globalPlaceYear', `상트페테르부르크 · ${current.dateLabel}`); setText('dateLabel', current.dateLabel); setText('globalYear', current.date.slice(0, 4)); setText('slipNo', current.id); setText('paperCollection', '연속 자료 발췌'); setText('paperIssue', `${state.sceneIndex + 1} / ${data.scenes.length}`); setText('paperDate', current.dateLabel); setText('paperTitle', current.transitionCard?.event || current.title); setText('paperSub', current.transitionCard?.change || current.sourceMoment); setText('paperFooterLabel', `자료철 · ${current.id}`); const first = current.excerpts[0]; setText('drawerKicker', `자료철 / ${current.id}`); setText('sourceIdA', first?.sourceId || 'SOURCE'); setText('sourceMetaA', `${first?.quoteClass || '자료'} · ${first?.availableDate || current.date}`); setText('sourceContextA', `${first?.context || current.title} · ${first?.locator || ''}`); if ($('sourceLinkA')) $('sourceLinkA').href = first?.sourceUrl || '#'; setText('sourceIdB', current.metadata?.[0]?.sourceId || first?.sourceId || 'SOURCE'); setText('sourceMetaB', current.metadata?.length ? '식별 정보 · 본문 아님' : '연결 자료'); setText('sourceContextB', current.metadata?.[0]?.role || current.sourceMoment); if ($('sourceLinkB')) $('sourceLinkB').href = '#'; if (headerScene !== state.sceneIndex) { headerScene = state.sceneIndex; document.body.classList.remove('scene-header-collapsed'); clearTimeout(headerTimer); if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.body.classList.add('scene-header-collapsed'); else headerTimer = window.setTimeout(() => document.body.classList.add('scene-header-collapsed'), 2500); } }
  document.addEventListener('pointerup', () => window.setTimeout(() => document.body.classList.add('scene-header-collapsed'), 0), { once: true });
  function mode(name) { document.body.classList.add('main20-mode'); document.body.dataset.runtimeOwner = 'main20'; const legacyWalk = $('walkBtn'); if (legacyWalk) legacyWalk.hidden = true; document.body.classList.toggle('main20-reading', name === 'reading'); document.body.classList.toggle('main20-dialogue', name !== 'reading' && name !== 'ending'); document.body.classList.toggle('main20-ending', name === 'ending'); }
  function clearChoices() { const node = choices(); node.replaceChildren(); node.hidden = false; } function button(text, handler, disabled = false) { const node = document.createElement('button'); node.type = 'button'; node.className = 'main20-action document-action'; node.textContent = text; node.disabled = disabled; node.onclick = handler; return node; }
  const directionFor = (choice) => choice.immediateDirection || data.choiceImmediateDirections?.[choice.id] || null;
  const MAIN20_DEAD_END_STATES = new Set(['late_game_scene', 'late_game_activities', 'onboarding', 'ideology_prologue', 'c07_ideology', 'branch_hub', 'branch_event', 'branch_callback', 'circle_learning', 'exam_prep', 'exam_questions', 'exam_result', 'intro', 'reading', 'source_discussion', 'decision', 'choice', 'post_choice', 'reaction', 'final_reaction', 'ending', 'legacy_recovery']);
  function choiceButton(choice, handler) { const node = button('', handler); node.classList.add('main20-choice-card'); const label = document.createElement('span'); label.className = 'main20-choice-label'; label.textContent = choice.displayText || choice.uiLabel || choice.text; node.append(label); const hint = document.createElement('span'); hint.className = 'main20-choice-hint document-action-detail'; const direction = directionFor(choice); hint.textContent = direction ? `${direction.audience} · ${direction.recordMode} · ${direction.leavesOffice} · ${direction.risk}` : (choice.hint || choice.uiHint || '선택 직후의 기록 경로를 정합니다.'); node.append(hint); node.removeAttribute('title'); return node; }
  function selectMemoryCallbacks(current, source = state, limit = 1) { const history = source.history || []; return (current.memoryCallbacks || []).map((callback) => { const hits = history.map((item, index) => ({ item, index })).filter(({ item }) => callback.actionsAny.includes(item.action) && !callback.notIfActions?.some((action) => history.some((entry) => entry.action === action))); const latest = hits.at(-1); return { callback, latestIndex: latest?.index ?? -1, relevance: callback.relevanceScenes?.includes(current.id) ? 20 : 0, priority: callback.priority || 0 }; }).filter((item) => item.latestIndex >= 0).sort((a, b) => (b.relevance + b.latestIndex + b.priority) - (a.relevance + a.latestIndex + a.priority)).slice(0, limit).map((item) => item.callback); }
  function memoryLine(current) { return selectMemoryCallbacks(current, state, 1)[0]; }
  function renderOnboarding() { mode('dialogue'); setVisible('paper', false); setVisible('responseArea', false); clearChoices(); const line = data.onboarding.lines[Math.min(state.onboardingIndex, data.onboarding.lines.length - 1)]; renderDialogueLine(line[0], line[1]); const task = $('currentTask')?.querySelector('span'); if (task) task.textContent = '이 기록실에서 읽고, 남기고, 보낼 경로를 고릅니다.'; const last = state.onboardingIndex === data.onboarding.lines.length - 1; choices().append(button(last ? data.onboarding.response.text : '다음 말을 듣는다', () => { if (last) { state.onboardingComplete = true; state.phase = 'ideology_prologue'; state.ideologyBeatIndex = 0; state.ideologyLineIndex = 0; state.history.push({ sceneId: 'ONBOARDING', kind: 'orientation', choiceId: data.onboarding.response.action, action: data.onboarding.response.action, actor: data.onboarding.response.actor, witnesses: ['PLAYER'], visibility: data.onboarding.response.visibility }); } else state.onboardingIndex += 1; save(); render(); })); }
  function renderIdeologyConversation(beat, collection, indexKey, lineKey, readKey, label) {
    mode('dialogue'); setVisible('paper', true); clearChoices();
    const lines = beat.lines || []; const lineIndex = state[lineKey] || 0;
    const line = lines[Math.min(lineIndex, lines.length - 1)];
    renderDialogueLine(line?.[0] || beat.character, line?.[1] || beat.title);
    const lastLine = lineIndex >= lines.length - 1;
    setText('instruction', lastLine && state[readKey] !== beat.id ? '신문에서 자료를 읽으면 대화 선택지가 열립니다.' : `${label} · 신문 자료를 읽고 자신의 말로 답하세요.`);
    if (!lastLine) { choices().append(button('다음 말을 듣는다', () => { state[lineKey] += 1; save(); render(); })); return; }
    if (state[readKey] !== beat.id) return;
    const prompt = document.createElement('p'); prompt.className = 'main20-choice-progress';
    const kinds = [...new Set(beat.choices.map((choice) => choiceTypeFor(choice)))];
    prompt.textContent = kinds.includes('OPINION') ? '어떻게 생각하시나요?' : kinds.includes('INTERPRETATION') ? '이 글을 어떻게 읽으시겠습니까?' : '다음 대화에 어떻게 답하시겠습니까?';
    choices().append(prompt);
    beat.choices.forEach((choice) => choices().append(choiceButton(choice, () => {
      addChoiceEffects(choice, 'ideology_choice');
      const nextIndex = (state[indexKey] || 0) + 1;
      if (nextIndex < collection.beats.length) { state[indexKey] = nextIndex; state[lineKey] = 0; state[readKey] = null; }
      else if (collection === data.ideologyPrologue) { state.phase = 'intro'; state.introIndex = 0; state.sceneIndex = 0; }
      else { state.c07IdeologyComplete = true; state.branchHubIndex = 0; state.phase = 'branch_hub'; }
      save(); render();
    })));
  }
  function renderIdeologyPaper(beat, readKey) {
    setText('paperCollection', '사상 자료 발췌');
    setText('paperIssue', `${state.phase === 'ideology_prologue' ? state.ideologyBeatIndex + 1 : state.c07BeatIndex + 1} / ${state.phase === 'ideology_prologue' ? data.ideologyPrologue.beats.length : data.c07IdeologicalFollowUp.beats.length}`);
    setText('paperDate', beat.date); setText('paperTitle', beat.title);
    setText('paperSub', '자료를 읽고 아래 표시를 누르면 대화를 이어갈 수 있습니다.');
    setText('paperFooterLabel', `자료철 · ${beat.id}`);
    const columns = $('paperColumns'); if (!columns) return; columns.replaceChildren();
    (beat.sourceIds || []).map((id) => data.sourceRegister?.find((source) => source.sourceId === id)).filter(Boolean).forEach((source) => {
      const article = document.createElement('article'); article.className = 'main20-excerpt main20-ideology-paper';
      article.innerHTML = `<small>${source.sourceId} · ${source.date} · ${source.locator}</small><p class="ru-text">${source.originalRussian}</p><p class="ko-text">${source.koreanTranslation}</p><em>${source.classification} · verified source context</em>`;
      columns.append(article);
    });
    const read = button(state[readKey] === beat.id ? '읽었습니다 · 대화 이어가기' : '신문을 읽고 답하기', () => { state[readKey] = beat.id; save(); render(); });
    read.classList.add('main20-ideology-read'); columns.append(read);
  }
  function renderIdeologyDrawer(beat) { const source = data.sourceRegister?.find((item) => item.sourceId === beat.sourceIds?.[0]); if (!source) return; setText('drawerKicker', `자료철 / ${beat.id}`); setText('sourceIdA', source.sourceId); setText('sourceMetaA', `${source.classification} · ${source.date}`); setText('sourceContextA', source.locator); if ($('sourceLinkA')) $('sourceLinkA').href = source.url; setText('sourceIdB', source.sourceId); setText('sourceMetaB', '연속 문맥 · 본문'); setText('sourceContextB', '원문과 프로젝트 번역을 나란히 읽습니다.'); if ($('sourceLinkB')) $('sourceLinkB').href = source.url; const translation = $('paperTranslation'); if (translation) { translation.replaceChildren(); const heading = document.createElement('strong'); heading.textContent = '한국어 번역'; const text = document.createElement('p'); text.textContent = source.koreanTranslation; translation.append(heading, text); } }
  function renderIdeologyPrologue() { const beat = data.ideologyPrologue.beats[state.ideologyBeatIndex] || data.ideologyPrologue.beats[0]; renderIdeologyPaper(beat, 'ideologyReadBeat'); renderIdeologyDrawer(beat); renderIdeologyConversation(beat, data.ideologyPrologue, 'ideologyBeatIndex', 'ideologyLineIndex', 'ideologyReadBeat', '사상적 프롤로그'); }
  function renderC07Ideology() { const beat = data.c07IdeologicalFollowUp.beats[state.c07BeatIndex] || data.c07IdeologicalFollowUp.beats[0]; renderIdeologyPaper(beat, 'c07ReadBeat'); renderIdeologyDrawer(beat); renderIdeologyConversation(beat, data.c07IdeologicalFollowUp, 'c07BeatIndex', 'c07LineIndex', 'c07ReadBeat', '1842년 이후 · 1847년 논쟁'); }
  function renderIntro() { const current = scene(); mode('dialogue'); setVisible('paper', false); setVisible('responseArea', false); clearChoices(); const callback = state.introIndex === current.intro.length - 1 ? memoryLine(current) : null; const line = callback ? [callback.character, callback.line] : current.intro[Math.min(state.introIndex, current.intro.length - 1)]; renderDialogueLine(line[0], line[1]); const task = $('currentTask')?.querySelector('span'); if (task) task.textContent = current.transition; choices().append(button(state.introIndex < current.intro.length - 1 ? '다음 말을 듣는다' : '자료를 펼쳐 읽는다', () => { if (state.introIndex < current.intro.length - 1) state.introIndex += 1; else { state.phase = 'reading'; state.discussionIndex = 0; } save(); render(); })); }
  function renderSourceDiscussion() { const current = scene(); mode('dialogue'); setVisible('paper', true); setVisible('responseArea', false); clearChoices(); const lines = current.sourceDiscussion || []; const line = lines[Math.min(state.discussionIndex, lines.length - 1)]; renderDialogueLine(line?.[0] || current.character, line?.[1] || current.decisionPrompt); setText('instruction', '읽은 자료의 차이와 확인 범위를 대화로 정리합니다.'); choices().append(button(state.discussionIndex < lines.length - 1 ? '다음 설명을 듣는다' : '이제 기록 방식을 고른다', () => { if (state.discussionIndex < lines.length - 1) state.discussionIndex += 1; else state.phase = 'decision'; save(); render(); })); }
  function renderDecision() { const current = scene(); mode('dialogue'); setVisible('paper', true); clearChoices(); renderDialogueLine(current.character, current.decisionPrompt || current.question); setText('instruction', '선택 전에 바로 보이는 기록 경로와 위험을 확인하세요.'); const progress = document.createElement('p'); progress.className = 'main20-choice-progress'; const kinds = [...new Set(current.choices.map((choice) => choiceTypeFor(choice)))]; progress.textContent = kinds.includes('OPINION') ? '어떻게 생각하시나요?' : kinds.includes('INTERPRETATION') ? '이 글을 어떻게 읽으시겠습니까?' : '이 자료를 어떻게 처리할까요?'; choices().append(progress); current.choices.forEach((choice) => choices().append(choiceButton(choice, () => { state.initialChoiceId = choice.id; addChoiceEffects(choice, 'post_read_choice'); state.reactionIndex = 0; state.phase = 'reaction'; save(); render(); }))); }
  function renderReaction() { const current = scene(); const choice = current.choices.find((item) => item.id === state.initialChoiceId); mode('dialogue'); setVisible('paper', true); clearChoices(); const sequence = [['PLAYER', choice.spokenText || choice.text], ...(choice.reactionSequence || [[choice.reactionActor || choice.actor, choice.reaction]])]; const line = sequence[Math.min(state.reactionIndex, sequence.length - 1)]; renderDialogueLine(line[0], line[1]); setText('instruction', state.reactionIndex === 0 ? '선택한 문장을 확인한 뒤 상대의 반응을 듣습니다.' : '선택에 대한 반응입니다.'); const last = state.reactionIndex >= sequence.length - 1; choices().append(button(last ? '이 기록의 다음 처리를 고른다' : '다음 반응을 듣는다', () => { if (!last) state.reactionIndex += 1; else { state.phase = 'post_choice'; state.postChoiceId = null; state.reactionIndex = 0; } save(); render(); })); }
  function renderReading(previousScroll = null) { const current = scene(); mode('reading'); setVisible('paper', true); setVisible('responseArea', false); clearChoices(); const columns = $('paperColumns'); const restore = previousScroll ?? state.readingScrollByScene[current.id] ?? 0; columns.replaceChildren(); if (current.metadata?.length) { const meta = document.createElement('aside'); meta.className = 'main20-metadata'; meta.innerHTML = `<strong>자료 정보</strong><p>${current.metadata.map((item) => `${item.text} — ${item.role}`).join('<br>')}</p>`; columns.append(meta); } const isVisible = (article) => { const box = article.getBoundingClientRect(); const view = columns.getBoundingClientRect(); return box.bottom > view.top + 8 && box.top < view.bottom - 8; }; const refreshReadButtons = () => columns.querySelectorAll('.main20-excerpt').forEach((article) => { const mark = article.querySelector('.main20-read-mark'); if (!mark || mark.dataset.read === 'true') return; mark.disabled = !isVisible(article); mark.title = mark.disabled ? '먼저 이 대목을 화면에 보이게 하세요' : '읽음으로 표시'; }); for (const [excerptIndex, item] of current.excerpts.entries()) { const article = document.createElement('article'); const range = item.contextRange || data.sourceContextRanges?.[item.excerptId]; const read = readIds(current).includes(item.excerptId); article.className = `main20-excerpt${read ? ' is-read' : ''}`; article.tabIndex = 0; article.setAttribute('aria-label', `${item.excerptId} ${read ? '읽음' : '읽지 않음'}`); article.innerHTML = `<small>${item.excerptId} · ${item.sourceId} · ${item.locator}</small><p class="main20-context-range">문맥 · ${excerptIndex + 1}/${current.excerpts.length} · ${range?.startLocator || item.locator}${range?.endLocator && range.endLocator !== range.startLocator ? ` → ${range.endLocator}` : ''}<br>${range?.contextPurpose || item.context}</p><p class="ru-text">${item.ru}</p><p class="ko-text">${item.ko}</p><em>${item.context} · ${item.quoteClass}</em><button type="button" class="main20-read-mark" data-read="${read}" ${read ? 'disabled' : ''}>${read ? '읽음' : '읽기'}</button>`; const activate = () => { if (read || !isVisible(article)) return; state.readingScrollByScene[current.id] = columns.scrollTop; markRead(current, item.excerptId); renderReading(columns.scrollTop); }; article.onclick = (event) => { if (event.target.closest('.main20-excerpt')) activate(); }; article.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } }; columns.append(article); } state.readingScrollByScene[current.id] = restore; const next = button('자료 토론으로 간다', () => { if (readIds(current).length === current.excerpts.length) { state.phase = 'source_discussion'; state.discussionIndex = 0; save(); render(); } }, readIds(current).length !== current.excerpts.length); choices().append(next); columns.addEventListener('scroll', refreshReadButtons, { passive: true }); requestAnimationFrame(() => { columns.scrollTop = restore; refreshReadButtons(); }); }
  function renderPostChoice() { const current = scene(); mode('dialogue'); setVisible('paper', true); clearChoices(); const first = current.choices.find((item) => item.id === state.initialChoiceId); renderDialogueLine(first.reactionActor || first.actor, `${current.question} ${current.readPrompt}`); setText('instruction', '무엇을 남길까?'); current.postChoices.forEach((choice) => choices().append(choiceButton(choice, () => { state.postChoiceId = choice.id; addChoiceEffects(choice, 'post_read_choice'); state.phase = 'final_reaction'; save(); render(); }))); }
  const ideologyGateMatches = (gate, source = state) => !gate || Object.entries(gate).every(([dimension, minimum]) => Number(source.ideology?.[dimension] || 0) >= Number(minimum));
  const actionGateMatches = (gate, source = state) => { if (!gate) return true; const actions = new Set((source.history || []).map((item) => item.action)); return (gate.all || []).every((action) => actions.has(action)) && (!gate.any || gate.any.some((action) => actions.has(action))); };
  function matches(rule, source = state) { const actions = new Set(source.history.map((item) => item.action)); const requiredActions = rule.requiredActions || rule.actionsAll || []; const forbiddenActions = rule.forbiddenActions || rule.noneFlags || []; const relationshipGate = rule.relationshipGate || rule.minRelationships; const relationshipsOk = !relationshipGate || Object.entries(relationshipGate).every(([person, amount]) => (source.relationships[person] || 0) >= amount); const beliefScenes = new Set((source.ideologyEvidence || []).map((item) => item.sceneId).filter(Boolean)); const beliefActs = new Set(Object.entries(data.v44EndingBeliefRequirement?.acts || {}).filter(([, contexts]) => contexts.some((context) => beliefScenes.has(context))).map(([act]) => act)); const beliefActMinimum = data.v44EndingBeliefRequirement?.minimumActs || 0; const legacyGate = !rule.ideologyGate; const legacyConditions = !legacyGate || ((!rule.allFlags || rule.allFlags.every((flag) => source.flags.includes(flag))) && (!rule.anyFlags || rule.anyFlags.some((flag) => source.flags.includes(flag))) && requiredActions.every((action) => actions.has(action)) && relationshipsOk && (!rule.minScenes || source.history.filter((item) => item.kind === 'post_read_choice').length >= rule.minScenes)); return ideologyGateMatches(rule.ideologyGate, source) && actionGateMatches(rule.actionGate, source) && legacyConditions && !forbiddenActions.some((item) => actions.has(item) || source.flags.includes(item)) && (!rule.beliefSceneMinimum || beliefScenes.size >= rule.beliefSceneMinimum) && beliefActs.size >= beliefActMinimum; }
  function choiceForAction(action) { const onboarding = data.onboarding?.response; if (onboarding?.action === action) return onboarding; for (const beat of [...(data.ideologyPrologue?.beats || []), ...(data.c07IdeologicalFollowUp?.beats || [])]) { const found = (beat.choices || []).find((item) => item.action === action || item.id === action); if (found) return found; } for (const current of [...(data.scenes || []), ...(data.archiveSceneRecords || [])]) for (const list of [current.choices || [], current.postChoices || []]) { const found = list.find((item) => item.action === action || item.id === action); if (found) return found; } return null; }
  function actionLabel(action) { const choice = choiceForAction(action); return choice?.text || choice?.spoken || choice?.label || data.v32ActionLabels?.[action] || '선택한 처리 내용을 기록에 남겼습니다.'; }
  function resolveEndingDetailed(source = state) { if (!source.history?.length) return null; const ids = data.endings.map((ending) => ending.id); const scores = Object.fromEntries(ids.map((id) => [id, 0])); const supporting = Object.fromEntries(ids.map((id) => [id, []])); const supportStrength = Object.fromEntries(ids.map((id) => [id, 0])); const contradictions = Object.fromEntries(ids.map((id) => [id, []])); const relationshipScores = Object.fromEntries(ids.map((id) => [id, 0])); const e07Affinity = Object.fromEntries(ids.map((id) => [id, 0])); for (const item of source.history) { const choice = choiceForAction(item.action); const values = item.endingAffinity || choice?.endingAffinity || {}; for (const id of ids) { const value = Number(values[id] || 0); scores[id] += value; if (value > 0) { supporting[id].push(item.action); supportStrength[id] += value; if (item.sceneId === 'E07') e07Affinity[id] += value; } } } const relationshipEvidence = { ...source.relationships }; for (const ending of data.endings) { const gate = ending.rule.relationshipGate || ending.rule.minRelationships || {}; const ratios = Object.entries(gate).map(([person, amount]) => Math.min(1, (source.relationships[person] || 0) / Math.max(1, amount))); relationshipScores[ending.id] = ratios.length ? ratios.reduce((sum, value) => sum + value, 0) / ratios.length : 0; const satisfied = ratios.every((value) => value >= 1); if (satisfied) scores[ending.id] += 2; else for (const [person, amount] of Object.entries(gate)) scores[ending.id] += Math.min(1, (source.relationships[person] || 0) / Math.max(1, amount)); const forbidden = ending.rule.forbiddenActions || ending.rule.noneFlags || []; for (const item of source.history) if (forbidden.some((value) => value === item.action || (item.flags || []).includes(value))) { scores[ending.id] -= 2; contradictions[ending.id].push(item.action); } } const strongMatches = data.endings.filter((ending) => matches({ ...ending.rule, ...(data.endingIdeologyProfiles?.[ending.id] || {}) }, source)).map((ending) => ending.id); const pool = strongMatches.length ? strongMatches : ids; const topScore = Math.max(...pool.map((id) => scores[id])); let remaining = pool.filter((id) => Math.abs(scores[id] - topScore) < 1e-9); let tieBreak = remaining.length === 1 ? 'score-unique' : null; let tieProfile = null; const retainMaximum = (metric, reason) => { if (remaining.length < 2) return; const maximum = Math.max(...remaining.map(metric)); const next = remaining.filter((id) => Math.abs(metric(id) - maximum) < 1e-9); if (next.length < remaining.length) { remaining = next; tieBreak = reason; } }; retainMaximum((id) => supporting[id].length, 'support-count'); retainMaximum((id) => supportStrength[id], 'support-strength'); retainMaximum((id) => relationshipScores[id], 'relationship-evidence'); retainMaximum((id) => e07Affinity[id], 'e07-affinity'); if (remaining.length > 1) { for (let index = source.history.length - 1; index >= 0 && remaining.length > 1; index -= 1) { const item = source.history[index]; const values = item.endingAffinity || choiceForAction(item.action)?.endingAffinity || {}; const maximum = Math.max(...remaining.map((id) => Number(values[id] || 0))); if (maximum > 0) { const next = remaining.filter((id) => Math.abs(Number(values[id] || 0) - maximum) < 1e-9); if (next.length < remaining.length) { remaining = next; tieBreak = 'recent-observable-action'; } } } } if (remaining.length > 1) { const profile = (data.endingTieProfiles || []).find((item) => item.candidates.length === remaining.length && item.candidates.every((id) => remaining.includes(id))); if (profile && remaining.includes(profile.chosenEnding)) { tieProfile = profile; remaining = [profile.chosenEnding]; tieBreak = 'explicit-profile'; } } const unresolvedSemanticTie = remaining.length > 1; const endingId = unresolvedSemanticTie ? null : remaining[0] || null; const arrayOrderFallback = Boolean(tieBreak === 'array-order-fallback' && endingId); const profile = endingId ? data.endingIdeologyProfiles?.[endingId] : null; const endingDetail = { endingId, unresolvedSemanticTie, scores, supportingActions: endingId ? supporting[endingId].slice(-6) : [], contradictions: endingId ? contradictions[endingId] : [], strongGateSatisfied: strongMatches.includes(endingId), strongMatches, relationshipEvidence, relationshipScores, supportCounts: Object.fromEntries(ids.map((id) => [id, supporting[id].length])), supportStrength, e07Affinity, tieBreak, tieProfile, arrayOrderFallback, ideologicalEvidence: source.ideology || {}, beliefLedger: (source.ideologyEvidence || []).map((item) => item.statement).filter(Boolean).slice(-5), actionEvidence: (source.history || []).filter((item) => !item.choiceKind || item.choiceKind === 'ACTION').map((item) => item.action).filter(Boolean).slice(-6), callbackEvidence: (source.visibleCallbacks || []).slice(-3), beliefLedgerLabels: profile?.beliefLedgerLabels || [] }; return endingDetail; }
  function resolveEnding(source = state) { return resolveEndingDetailed(source)?.endingId || null; }
  function renderBranchPaper(title, date, sourceIds, note) {
    setVisible('paper', true); setVisible('responseArea', false); setText('paperCollection', '기록실 · 읽기와 선택');
    setText('paperIssue', `${state.branchHubIndex + 1} / ${branchGraph.hubs.length}`); setText('paperDate', date); setText('paperTitle', title); setText('paperSub', note); setText('paperFooterLabel', '자료철 · 1840년대');
    const columns = $('paperColumns'); if (!columns) return; columns.replaceChildren();
    for (const id of sourceIds ?? []) {
      const source = data.sourceRegister?.find((item) => item.sourceId === id);
      const article = document.createElement('article'); article.className = 'main20-excerpt document-surface';
      const meta = document.createElement('small'); meta.textContent = `${source?.sourceId ?? id} · ${source?.date ?? ''} · ${source?.locator ?? ''}`;
      const original = document.createElement('p'); original.className = 'ru-text'; original.textContent = source?.originalRussian || '원문은 연결 자료철에서 판본과 함께 확인합니다.';
      const translation = document.createElement('p'); translation.className = 'ko-text'; translation.textContent = source?.koreanTranslation || source?.context || '이 자료가 뒷받침하는 범위는 연결 자료철에 표시합니다.';
      article.append(meta, original, translation); columns.append(article);
    }
  }
  function branchSourceIds(branch) { return [...new Set([...(branch?.sourceIds || []), ...(branchGraph.choiceSourceIds?.[branch?.choiceId] || [])])]; }
  function branchEventSourceIds(branch) { return [...new Set([...branchSourceIds(branch), ...(branchGraph.eventSourceIdsByChoice?.[branch?.choiceId] || []), ...(branch?.eventSourceIds || [])])]; }
  function renderBranchHub() {
    const hub = branchGraph.hubs[state.branchHubIndex];
    if (!hub) { state.phase = 'intro'; save(); render(); return; }
    mode('dialogue'); clearChoices(); renderDialogueLine('NARRATION', hub.prompt);
    setText('instruction', state.activeBranchReadHub === hub.id ? '자료를 읽었습니다. 아래에서 이번 행동을 고르세요.' : '신문 자료를 먼저 읽으면 선택지가 열립니다.');
    const options = branchGraph.branches.filter((branch) => branch.hubId === hub.id);
    const sources = [...new Set(options.flatMap((branch) => branchSourceIds(branch)))];
    renderBranchPaper(hub.title, hub.date, sources, hub.topic);
    if (state.activeBranchReadHub !== hub.id) {
      choices().hidden = true;
      const read = button('신문에서 읽고 선택지를 연다', () => { state.activeBranchReadHub = hub.id; save(); render(); });
      read.classList.add('main20-ideology-read', 'document-action'); $('paperColumns')?.append(read); return;
    }
    for (const branch of options) {
      const direction = branch.immediateDirection;
      choices().append(choiceButton({ ...branch, displayText: direction.action, immediateDirection: { audience: direction.audience, recordMode: direction.recordMode, leavesOffice: direction.documentLeavesOffice ? '문서가 사무실을 나감' : '사무실에 보관', risk: direction.risk } }, () => {
        const result = window.Main20BranchGraph.resolveBranchEvent(branchGraph, hub.id, branch.choiceId, state);
        state.routeChoices = result.nextState.routeChoices; state.branchState = result.nextState.branchState;
        state.activeBranchEventId = result.eventId; state.activeBranchLineIndex = 0; state.activeBranchReadHub = null;
        for (const [key, amount] of Object.entries(branch.stateWrites ?? {})) if (key.startsWith('relationship')) { const person = key.slice('relationship'.length).toLowerCase(); state.relationships[person] = (state.relationships[person] || 0) + Number(amount || 0); }
        state.actions.push(branch.choiceId); state.visibleCallbacks = [...new Set([...state.visibleCallbacks, branch.callbackKey])];
        state.history.push({ sceneId: hub.id, kind: 'branch_choice', choiceId: branch.choiceId, action: branch.choiceId, choiceKind: 'ACTION', witnesses: [direction.audience], visibility: direction.recordMode, callbackKey: branch.callbackKey, sourceIds: branch.sourceIds, endingAffinity: branchGraph.choiceEndingAffinity?.[branch.choiceId] || {} });
        if (branch.choiceId === 'CIRCLE-ATTEND' || branch.choiceId === 'CIRCLE-KEEP-NOTES') { state.circleLearningIndex = 0; state.phase = 'circle_learning'; }
        else if (branch.choiceId === 'EXAM-SIT') { state.examQuestionIndex = 0; state.examAnswers = {}; state.examOutcome = 'unset'; state.examCorrectCount = null; state.promotionStatus = 'pending'; state.phase = 'exam_prep'; }
        else if (branch.choiceId === 'EXAM-DEFER') { state.examOutcome = 'deferred'; state.examCorrectCount = null; state.examAnswers = {}; state.promotionStatus = 'pending'; state.phase = 'branch_event'; }
        else if (branch.choiceId === 'EXAM-HELP-PEER') { state.examOutcome = 'helped-peer'; state.examCorrectCount = null; state.examAnswers = {}; state.promotionStatus = 'pending'; state.phase = 'branch_event'; }
        else state.phase = 'branch_event';
        save(); render();
      }));
    }
  }
  function renderBranchEvent() {
    const branch = branchGraph.branches.find((item) => item.immediateEventId === state.activeBranchEventId);
    if (!branch) { state.phase = 'branch_hub'; save(); render(); return; }
    mode('dialogue'); clearChoices(); renderBranchPaper(branch.event.title, branchGraph.hubs[state.branchHubIndex].date, branchEventSourceIds(branch), branch.event.description);
    const line = branch.speakerLines[state.activeBranchLineIndex];
    if (line) {
      renderDialogueLine(line.speaker, line.text);
      choices().append(button('다음 말을 듣는다', () => { state.activeBranchLineIndex += 1; save(); render(); }));
    } else {
      renderDialogueLine('NARRATION', branch.event.description);
      choices().append(button('이 선택의 뒷말을 듣는다', () => { state.phase = 'branch_callback'; save(); render(); }));
    }
  }
  function renderLearningExcerpt(unit, includeSummary = true) {
    const columns = $('paperColumns'); if (!columns) return;
    columns.replaceChildren();
    const article = document.createElement('article'); article.className = 'main20-excerpt main20-learning-excerpt';
    const source = data.sourceRegister.find((item) => item.sourceId === unit.provenance.sourceId);
    const meta = document.createElement('small'); meta.textContent = `${source?.edition || unit.provenance.sourceClass} · ${unit.provenance.startLocator} — ${unit.provenance.endLocator}`;
    article.append(meta);
    if (unit.provenance.quotedRussian) { const ru = document.createElement('p'); ru.className = 'ru-text'; ru.textContent = unit.provenance.quotedRussian; article.append(ru); }
    const ko = document.createElement('p'); ko.className = 'ko-text'; ko.textContent = unit.provenance.projectTranslationKo || unit.bodyKo; article.append(ko);
    if (includeSummary) { const context = document.createElement('p'); context.className = 'learning-context-note'; context.textContent = unit.provenance.contextNoteKo || ''; article.append(context); }
    columns.append(article);
  }
  function renderLearningScene() {
    mode('reading'); clearChoices(); setVisible('paper', true); setVisible('responseArea', false);
    const unit = learningExam.learningUnits[state.circleLearningIndex];
    if (!unit) { state.phase = 'branch_event'; save(); render(); return; }
    setText('paperCollection', '페테르부르크 · 저녁 독서 모임'); setText('paperIssue', `${state.circleLearningIndex + 1} / ${learningExam.learningUnits.length}`);
    setText('paperDate', '1847년 8월'); setText('paperTitle', unit.title); setText('paperSub', '읽은 문장과 그 문맥을 함께 살펴봅니다.'); setText('paperFooterLabel', `자료철 · ${unit.sourceIds.join(' · ')}`);
    renderLearningExcerpt(unit);
    const line = unit.speakerLines?.[0];
    renderDialogueLine(line?.speaker || 'NARRATION', line?.text || unit.bodyKo);
    choices().append(button(state.circleLearningIndex + 1 < learningExam.learningUnits.length ? '다음 쪽을 읽는다' : '책을 덮고 자리로 돌아간다', () => {
      if (state.circleLearningIndex + 1 < learningExam.learningUnits.length) state.circleLearningIndex += 1;
      else { state.phase = 'late_game_scene'; state.lateGameSceneId = 'CIRCLE_01'; state.lateGameSceneTurn = 0; state.lateGameTurns = []; }
      save(); render();
    }));
  }
  function renderExamPrep() {
    mode('reading'); clearChoices(); setVisible('paper', true); setVisible('responseArea', false);
    const attended = ['attended', 'attended-notes'].includes(state.branchState.circleContact);
    setText('paperCollection', '진급 시험 · 공개 교재'); setText('paperIssue', `${learningExam.questions.length}문항 · 통과 기준 ${learningExam.passThreshold}개`);
    setText('paperDate', '1847년 9월'); setText('paperTitle', attended ? '읽었던 내용을 다시 펼치다' : '시험 전에 공개 교재를 읽다');
    setText('paperSub', attended ? '모임에서 읽은 자료와 같은 범위를 다시 볼 수 있습니다.' : '모임에 참석하지 않았어도 누구나 같은 범위를 읽고 시험을 볼 수 있습니다.');
    setText('paperFooterLabel', '시험 준비 자료 · 누구나 열람 가능');
    const columns = $('paperColumns'); columns?.replaceChildren();
    for (const unitId of learningExam.publicPrepUnitIds) {
      const unit = learningExam.learningUnits.find((item) => item.id === unitId); if (!unit || !columns) continue;
      const section = document.createElement('section'); section.className = 'main20-prep-unit';
      const heading = document.createElement('h3'); heading.textContent = unit.title;
      const body = document.createElement('p'); body.textContent = unit.bodyKo;
      const range = document.createElement('small'); range.textContent = `${unit.provenance.sourceId} · ${unit.provenance.startLocator} — ${unit.provenance.endLocator}`;
      section.append(heading, body, range); columns.append(section);
    }
    renderDialogueLine('NARRATION', '다섯 문제는 여기 실린 내용에서만 나옵니다. 서클에 갔는지에 따라 문제나 기준이 달라지지는 않습니다.');
    choices().append(button('같은 다섯 문제에 답한다', () => { state.examQuestionIndex = 0; state.phase = 'exam_questions'; save(); render(); }));
  }
  function renderExamQuestion() {
    mode('reading'); clearChoices(); setVisible('paper', true); setVisible('responseArea', false);
    const question = learningExam.questions[state.examQuestionIndex];
    if (!question) { state.phase = 'exam_result'; save(); render(); return; }
    const unit = learningExam.learningUnits.find((item) => question.learningUnitIds.includes(item.id));
    setText('paperCollection', '진급 시험 · 답안지'); setText('paperIssue', `${state.examQuestionIndex + 1} / ${learningExam.questionCount}`);
    setText('paperDate', '1847년 9월'); setText('paperTitle', '시험 문제'); setText('paperSub', question.prompt); setText('paperFooterLabel', `문항 ${state.examQuestionIndex + 1} · 출처 ${question.sourceIds.join(' · ')}`);
    renderLearningExcerpt(unit, false);
    renderDialogueLine('NARRATION', question.prompt);
    const selected = state.examAnswers[question.id];
    for (const option of question.options) {
      const answer = button(option.text, () => { state.examAnswers[question.id] = option.id; save(); render(); choices().querySelector('[aria-pressed="true"]')?.focus(); });
      answer.classList.add('main20-exam-option'); answer.setAttribute('aria-pressed', String(selected === option.id)); answer.setAttribute('data-answer-id', option.id); choices().append(answer);
    }
    const finalQuestion = state.examQuestionIndex === learningExam.questions.length - 1;
    choices().append(button(finalQuestion ? '답안을 제출한다' : '다음 문제', () => {
      if (!state.examAnswers[question.id]) return;
      if (finalQuestion) {
        const result = window.Main20Exam.scoreExam(state.examAnswers, learningExam);
        state.examCorrectCount = result.correctCount; state.examOutcome = result.outcome; state.promotionStatus = window.Main20Exam.derivePromotionStatus(result.outcome); state.phase = 'exam_result';
      } else state.examQuestionIndex += 1;
      save(); render();
    }, !selected));
  }
  function renderExamResult() {
    mode('reading'); clearChoices(); setVisible('paper', true); setVisible('responseArea', false);
    const passed = state.examOutcome === 'passed';
    setText('paperCollection', '진급 시험 · 결과 통지'); setText('paperIssue', `${state.examCorrectCount} / ${learningExam.questionCount}`);
    setText('paperDate', '1847년 9월'); setText('paperTitle', passed ? '이번 회차 시험을 통과했습니다' : '이번 회차는 기준에 미치지 못했습니다');
    setText('paperSub', passed ? '이번 회차 진급 절차에 들어갑니다.' : '이번 회차의 진급은 이뤄지지 않습니다.');
    setText('paperFooterLabel', `가상 주인공 · ${passed ? '진급 절차 진행' : '이번 회차 미통과'}`);
    const columns = $('paperColumns'); columns?.replaceChildren();
    learningExam.questions.forEach((question, index) => {
      const row = document.createElement('p'); row.className = 'main20-exam-result-row';
      const correct = state.examAnswers[question.id] === learningExam.answerKey[question.id];
      row.textContent = `${index + 1}. ${question.prompt} · ${correct ? '맞음' : '다시 확인할 문제'}`; columns?.append(row);
    });
    renderDialogueLine('NARRATION', passed ? '답안은 기록실에 들어갑니다. 이제 그 결과가 당신에게 어떤 자리를 열었는지 지켜봅니다.' : '틀린 답은 숨기지 않고 표시했습니다. 이번 결과는 이 이야기 속 당신의 경로에만 남습니다.');
    choices().append(button('시험 기록을 접는다', () => { state.activeBranchLineIndex = 0; enterLateGameScene('EXAM_01'); }));
  }
  function renderBranchCallback() {
    const branch = branchGraph.branches.find((item) => item.choiceId === state.routeChoices[state.branchHubIndex]);
    const callback = branchGraph.eventPredicates.nextHubAcknowledgements.map((group) => group.reactionTexts?.[branch?.nextHubReactionId]).find(Boolean);
    if (callback) renderDialogueLine(callback.speaker, callback.text); else renderDialogueLine('NARRATION', '그날의 선택은 다음 기록에서도 잊히지 않았습니다.');
    mode('dialogue'); clearChoices(); renderBranchPaper('그때의 선택이 돌아오다', branchGraph.hubs[state.branchHubIndex].date, branch?.sourceIds, '이전 행동에 대한 동료의 반응');
    choices().append(button(state.branchHubIndex + 1 < branchGraph.hubs.length ? '다음 기록을 펼친다' : '1849년 사건철을 펼친다', () => {
      const completedHub = branchGraph.hubs[state.branchHubIndex];
      const nextStep = window.Main20BranchGraph.resolveRouteNextStep(branchGraph, completedHub.id);
      state.branchHubIndex += 1; state.activeBranchLineIndex = 0;
      if (branchGraph.anchors.some((anchor) => anchor.id === nextStep)) {
        state.sceneIndex = data.scenes.findIndex((item) => item.id === nextStep);
        state.phase = state.sceneIndex >= 0 ? 'intro' : 'legacy_recovery';
        state.introIndex = 0; state.initialChoiceId = null; state.postChoiceId = null;
      } else if (nextStep && branchGraph.hubs.some((hub) => hub.id === nextStep)) state.phase = 'branch_hub';
      else state.phase = 'legacy_recovery';
      save(); render();
    }));
  }
  function renderRecovery() { mode('dialogue'); setVisible('paper', false); clearChoices(); renderDialogueLine('NARRATION', '이 기록은 이전 버전에서 만들어져 결말을 계산할 수 없습니다. 마지막 장면을 다시 시작할까요?'); setText('instruction', '이전 기록은 보존되었습니다.'); choices().append(button('마지막 장면을 다시 시작한다', () => { state.sceneIndex = data.scenes.length - 1; state.phase = 'intro'; state.introIndex = 0; state.initialChoiceId = null; state.postChoiceId = null; state.endingId = null; state.legacyEndingTitle = null; save(); render(); })); }
  function renderFinalReaction() { const current = scene(); const choice = current.postChoices.find((item) => item.id === state.postChoiceId); mode('dialogue'); setVisible('paper', true); clearChoices(); renderDialogueLine(choice.reactionActor || choice.actor, choice.reaction); const last = state.sceneIndex === data.scenes.length - 1; const c07FollowUp = current.id === 'E04' && !state.c07IdeologyComplete; const nextRouteStep = window.Main20BranchGraph.resolveRouteNextStep(branchGraph, current.id); const resumeBranchRoute = branchGraph.hubs.some((hub, index) => hub.id === nextRouteStep && index === state.branchHubIndex); choices().append(button(last ? '마지막 장면을 닫는다' : c07FollowUp ? '1847년 여름의 독서 대화를 이어간다' : resumeBranchRoute ? '다음 자료를 연다' : `장면을 덮고 ${data.scenes[state.sceneIndex + 1].dateLabel}로 간다`, () => { if (last) { state.endingResolution = resolveEndingDetailed(state); state.endingId = state.endingResolution?.endingId || null; state.phase = state.endingId ? 'ending' : 'legacy_recovery'; } else if (c07FollowUp) { state.phase = 'c07_ideology'; state.c07BeatIndex = 0; state.c07LineIndex = 0; state.c07ReadBeat = null; } else if (resumeBranchRoute) { state.phase = 'branch_hub'; state.activeBranchReadHub = null; } else { state.sceneIndex += 1; state.phase = 'intro'; state.introIndex = 0; state.initialChoiceId = null; state.postChoiceId = null; } save(); render(); })); }
  function renderEnding() {
    const ending = data.endings.find((item) => item.id === state.endingId);
    if (!ending) { state.phase = 'legacy_recovery'; renderRecovery(); return; }
    const detail = state.endingResolution || resolveEndingDetailed(state);
    mode('ending'); setVisible('paper', false); clearChoices();
    setText('endingTitle', ending.title); setText('endingDocumented', ending.historicalLifeSummary);
    setText('endingLifeHeading', ending.id === 'DOSTOEVSKY_PETRASHEVSKY' ? '도스토옙스키와 페트라셰프스키 모임은 실제로 어떻게 살았나' : `${ending.historicalPerson}은 실제로 어떻게 살았나`);
    setText('endingReconstructed', ending.whyThisResult); setText('endingFuture', ending.futureLife);
    setText('endingSources', (ending.historicalLifeSources || []).map((source) => `${source.sourceId} · ${source.claim} · ${source.url}`).join(' / '));
    const beliefsNode = $('endingBeliefs');
    if (beliefsNode) { beliefsNode.replaceChildren(); (detail?.beliefLedger?.length ? detail.beliefLedger : detail?.beliefLedgerLabels || []).slice(-5).forEach((belief) => { const item = document.createElement('p'); item.className = 'ending-belief-line'; item.textContent = `· ${belief}`; beliefsNode.append(item); }); }
    const actionNode = $('endingActions');
    if (actionNode) { actionNode.replaceChildren(); (detail?.actionEvidence || []).slice(-6).forEach((action) => { const item = document.createElement('p'); item.textContent = `· ${actionLabel(action)}`; actionNode.append(item); }); }
    const callbackNode = $('endingCallbackLines');
    if (callbackNode) {
      callbackNode.replaceChildren();
      (detail?.supportingActions || []).filter((action) => ending.callbackLines?.[action]).slice(-3).forEach((action) => {
        const choice = choiceForAction(action); const item = document.createElement('p'); item.className = 'ending-callback-line';
        const speaker = document.createElement('strong'); speaker.textContent = labelFor(choice?.reactionActor || 'NARRATION');
        const line = document.createElement('span'); line.textContent = ending.callbackLines[action]; item.append(speaker, line); callbackNode.append(item);
      });
    }
    const initials = { UVAROV: 'У', BELINSKY: 'Б', HERZEN: 'Г', KHOMYAKOV: 'Х', DOSTOEVSKY_PETRASHEVSKY: 'Д·П' }[ending.id] || '∴';
    setText('endingPortraitInitials', initials);
    const portraitUrls = { UVAROV: 'https://commons.wikimedia.org/wiki/Special:FilePath/Golike%20Vasily%20Portrait%20of%20Count%20Sergey%20Uvarov%20(1833).jpg', BELINSKY: 'https://commons.wikimedia.org/wiki/Special:FilePath/Vissarion%20Belinsky%20by%20K%20Gorbunov%201843.jpg', HERZEN: 'https://commons.wikimedia.org/wiki/Special:FilePath/Herzen%20ge.jpg', DOSTOEVSKY_PETRASHEVSKY: 'https://commons.wikimedia.org/wiki/Special:FilePath/Dostoevsky%201872.jpg' };
    const portrait = $('endingPortraitImage');
    if (portrait) { portrait.hidden = !portraitUrls[ending.id]; portrait.src = portraitUrls[ending.id] || ''; portrait.onerror = () => { portrait.hidden = true; }; }
    setText('endingPortraitName', `실제 역사 속 인물 · ${ending.historicalPerson || ending.title}`);
    setText('endingPortraitReason', ending.whyThisResult); setVisible('endingOverlay', true);
    const overlay = $('endingOverlay'); overlay?.setAttribute('role', 'dialog'); overlay?.setAttribute('aria-modal', 'true'); overlay?.setAttribute('aria-labelledby', 'endingTitle'); overlay?.setAttribute('tabindex', '-1');
    const app = document.querySelector('main'); if (app) app.inert = true;
    $('endingOverlay')?.focus({ preventScroll: true });
    const review = $('endingReview'); if (review) review.onclick = () => $('endingActions')?.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const restart = $('restart'); if (restart) { restart.textContent = '처음부터 다시 읽는다'; restart.onclick = () => { state = fresh(); save(); setVisible('endingOverlay', false); const app = document.querySelector('main'); if (app) app.inert = false; render(); }; }
  }
  function renderLifeTimeline() {
    const timeline = window.Main20LifeSimulation.buildLifeTimeline(state, lifeSimulation);
    if (!timeline.length) return;
    let section = $('endingTimeline');
    if (!section) {
      section = document.createElement('section'); section.id = 'endingTimeline'; section.className = 'ending-stage ending-life-timeline';
      const card = document.querySelector('.ending-card'); const future = $('endingFuture')?.parentElement;
      if (card) card.insertBefore(section, future || null);
    }
    const index = Math.max(0, Math.min(timeline.length - 1, state.endingTimelineIndex));
    const episode = timeline[index]; section.replaceChildren();
    const label = document.createElement('p'); label.className = 'kicker'; label.textContent = '기록된 역사 뒤 · 가상의 삶';
    const heading = document.createElement('h3'); heading.textContent = '그 뒤의 시간';
    const notice = document.createElement('p'); notice.className = 'ending-timeline-note'; notice.textContent = '이 시간선은 당신의 선택에 따라 그려 본 가상의 서사입니다.';
    const track = document.createElement('div'); track.className = 'ending-timeline-track'; track.setAttribute('aria-label', '이후 삶의 시간선');
    timeline.forEach((entry, dotIndex) => { const dot = document.createElement('span'); dot.className = dotIndex === index ? 'active' : ''; dot.setAttribute('aria-hidden', 'true'); track.append(dot); });
    const progress = document.createElement('p'); progress.className = 'ending-timeline-progress'; progress.setAttribute('aria-live', 'polite'); progress.textContent = `${index + 1} / ${timeline.length} · ${episode.periodLabel}`;
    const title = document.createElement('h4'); title.textContent = episode.title;
    const copy = document.createElement('p'); copy.className = 'ending-timeline-copy'; copy.textContent = episode.textKo;
    const controls = document.createElement('div'); controls.className = 'ending-timeline-controls';
    const previous = document.createElement('button'); previous.type = 'button'; previous.className = 'ink-button'; previous.textContent = '이전 시기'; previous.disabled = index === 0;
    previous.onclick = () => { state.endingTimelineIndex = Math.max(0, index - 1); save(); renderLifeTimeline(); $('endingTimelinePrevious')?.focus(); };
    previous.id = 'endingTimelinePrevious';
    const next = document.createElement('button'); next.type = 'button'; next.className = 'ink-button'; next.id = 'endingTimelineNext'; next.textContent = index + 1 < timeline.length ? '다음 시기' : '마지막 시기'; next.disabled = index + 1 >= timeline.length;
    next.onclick = () => { state.endingTimelineIndex = Math.min(timeline.length - 1, index + 1); save(); renderLifeTimeline(); $('endingTimelineNext')?.focus(); };
    const replay = document.createElement('button'); replay.type = 'button'; replay.className = 'plain-button'; replay.id = 'endingTimelineReplay'; replay.textContent = '처음부터 다시 보기';
    replay.onclick = () => { state.endingTimelineIndex = 0; save(); renderLifeTimeline(); $('endingTimelineReplay')?.focus(); };
    controls.append(previous, next, replay); section.append(label, heading, notice, track, progress, title, copy, controls);
  }
  const renderEndingBase = renderEnding;
  renderEnding = function renderEndingWithLifeTimeline() { renderEndingBase(); renderLifeTimeline(); };
  function enterLateGameScene(sceneId) {
    state.lateGameSceneId = sceneId; state.lateGameSceneTurn = 0; state.lateGameTurns = [];
    state.phase = 'late_game_scene'; save(); render();
  }
  function renderLateGamePhase() {
    document.body.classList.add('late-game-mode');
    if (state.phase === 'late_game_activities') {
      document.querySelector('.document-stage')?.style.setProperty('background-image', 'linear-gradient(rgba(24,18,13,.38),rgba(24,18,13,.52)),url("assets/late-game/petersburg_snow_street.webp")');
      const selected = new Set(state.lateGameActivities);
      mode('reading'); clearChoices(); setVisible('paper', true); setVisible('responseArea', false);
      setText('paperCollection', '서클 이후 · 저녁 약속'); setText('paperIssue', `${selected.size} / 2`); setText('paperDate', '1847년 8월'); setText('paperTitle', '오늘 저녁, 어디에 갈까'); setText('paperSub', '서점·저녁 식사·함께 읽기 중 두 곳을 고릅니다. 선택하지 않은 자리는 다음 날로 미뤄집니다.'); setText('paperFooterLabel', '서클 뒤의 두 저녁');
      const columns = $('paperColumns'); columns?.replaceChildren();
      for (const id of lateGame.schedule.activityIds) {
        const scene = lateGame.scenes.find(item => item.id === id); const buttonNode = button(`${selected.has(id) ? '✓ ' : ''}${scene.locationKo}`, () => {
          if (selected.has(id) || selected.size >= 2) return;
          state.lateGameActivities = [...state.lateGameActivities, id];
          if (state.lateGameActivities.length === 2) { state.lateGamePendingActivities = [...state.lateGameActivities]; enterLateGameScene(state.lateGamePendingActivities.shift()); }
          else { save(); render(); }
        }, selected.has(id) || selected.size >= 2);
        buttonNode.classList.add('late-game-activity-choice'); columns?.append(buttonNode);
      }
      renderDialogueLine('NARRATION', '둘러볼 자리는 셋이다. 오늘은 두 곳만 들를 수 있다.');
      choices().append(button('오늘은 여기까지 정한다', () => { if (state.lateGameActivities.length === 2) { state.lateGamePendingActivities = [...state.lateGameActivities]; enterLateGameScene(state.lateGamePendingActivities.shift()); } }, state.lateGameActivities.length !== 2));
      return;
    }
    const scene = lateGame.scenes.find(item => item.id === state.lateGameSceneId);
    if (!scene) { state.phase = 'branch_event'; save(); render(); return; }
    document.querySelector('.document-stage')?.style.setProperty('background-image', `linear-gradient(rgba(24,18,13,.38),rgba(24,18,13,.52)),url("assets/late-game/${scene.backgroundId}.webp")`);
    const date = scene.date.split('-'); const dateLabel = `${date[0]}년 ${Number(date[1])}월 ${Number(date[2])}일`;
    renderHeader({ ...sceneForRuntime(), id: scene.id, date: scene.date, dateLabel, title: scene.locationKo, sourceMoment: scene.objectiveKo, transitionCard: { event: scene.locationKo, change: scene.objectiveKo }, excerpts: [] });
    mode('dialogue'); clearChoices(); setVisible('paper', true);
    setText('paperCollection', '페테르부르크 · 1847년'); setText('paperIssue', `${Math.min(state.lateGameSceneTurn, scene.turnLimit)} / ${scene.turnLimit}`); setText('paperDate', dateLabel); setText('paperTitle', scene.locationKo); setText('paperSub', scene.objectiveKo); setText('paperFooterLabel', `자료철 · ${scene.sourceIds.join(' · ') || '허구의 대화 장면'}`);
    const columns = $('paperColumns'); columns?.replaceChildren();
    const note = document.createElement('p'); note.className = 'late-game-objective'; note.textContent = scene.objectiveKo; columns?.append(note);
    if (scene.cgId && scene.id !== 'EXAM_01') { const image = document.createElement('img'); image.className = 'late-game-event-still'; image.src = `assets/late-game/${scene.cgId}.webp`; image.alt = ''; image.setAttribute('aria-hidden', 'true'); image.loading = 'lazy'; image.onerror = () => image.remove(); columns?.append(image); }
    for (const sourceId of scene.sourceIds) { const source = data.sourceRegister.find(item => item.sourceId === sourceId); if (!source) continue; const entry = document.createElement('article'); entry.className = 'main20-excerpt late-game-source-note'; const title = document.createElement('strong'); title.textContent = `${source.sourceId} · ${source.classification || '자료'}`; const provenance = document.createElement('small'); provenance.textContent = `${source.edition || ''} · ${source.contextRangeId || sourceId} · ${source.availableDate || ''}`; entry.append(title, provenance); columns?.append(entry); }
    for (const excerpt of scene.excerpts || []) {
      const source = branchSources.find(item => item.sourceId === excerpt.sourceId); if (!source) continue;
      const article = document.createElement('article'); article.className = 'main20-excerpt late-game-primary-excerpt';
      const label = document.createElement('small'); label.textContent = `${source.sourceId} · ${excerpt.locator}`; article.append(label);
      for (const segmentId of excerpt.segmentIds) {
        const ruText = source.originalRussian.find(item => item.segmentId === segmentId)?.text; const koText = source.koreanTranslation.find(item => item.segmentId === segmentId)?.text;
        if (!ruText || !koText) continue;
        const pair = document.createElement('div'); pair.className = 'late-game-paragraph-pair'; const ru = document.createElement('p'); ru.lang = 'ru'; ru.textContent = ruText; const ko = document.createElement('p'); ko.lang = 'ko'; ko.textContent = koText; pair.append(ru, ko); article.append(pair);
      }
      columns?.append(article);
    }
    const last = state.lateGameTurns.at(-1);
    const lastBeat = last?.role === 'assistant' ? last.beats?.at(-1) : null;
    if (lastBeat) renderDialogueLine(lastBeat.speakerId, lastBeat.textKo);
    else if (last?.role === 'user') renderDialogueLine('NARRATION', '말이 잠시 끊겼다. 상대가 생각을 고르는 동안, 창밖 눈발이 유리창을 두드린다.');
    else renderDialogueLine('NARRATION', scene.objectiveKo);
    renderLateGameTranscript(scene);
    const replies = last?.role === 'assistant' && Array.isArray(last.replies) ? last.replies : [
      { id: 'R1', textKo: '그렇게 생각한 까닭을 먼저 들어 보고 싶어요.', tone: 'curious' },
      { id: 'R2', textKo: '오늘은 그 이야기를 조금 더 해 봐요.', tone: 'reflective' },
    ];
    for (const reply of replies) choices().append(button(reply.textKo, () => submitLateGameTurn(reply.textKo)));
    const responseArea = $('responseArea'); responseArea.replaceChildren(); responseArea.hidden = false;
    const label = document.createElement('label'); label.htmlFor = 'lateGameReply'; label.textContent = '직접 답하기';
    const input = document.createElement('textarea'); input.id = 'lateGameReply'; input.rows = 2; input.maxLength = 800; input.placeholder = '하고 싶은 말을 적으세요. 비워 둔 채 제안 답변을 골라도 됩니다.';
    const send = button('말을 건넨다', () => submitLateGameTurn(input.value)); send.classList.add('late-game-send');
    responseArea.append(label, input, send);
    input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send.click(); } });
    const continueButton = button(state.lateGameSceneTurn >= scene.turnLimit ? '다음 장소로 간다' : '이 장면을 마친다', finishLateGameScene);
    choices().append(continueButton);
  }
  function sceneForRuntime() { return data.scenes[state.sceneIndex] || data.scenes[0]; }
  function renderLateGameTranscript(scene) {
    const strip = document.querySelector('.dialogue-strip'); const dialogue = $('dialogue'); if (!strip || !dialogue) return;
    strip.querySelector('.late-game-transcript')?.remove(); dialogue.hidden = true;
    const transcript = document.createElement('div'); transcript.className = 'late-game-transcript'; transcript.setAttribute('role', 'log'); transcript.setAttribute('aria-live', 'polite');
    const entries = state.lateGameTurns.slice(-10);
    if (!entries.length) entries.push({ role: 'assistant', speakerId: 'NARRATION', text: scene.objectiveKo });
    for (const entry of entries) {
      const beats = entry.role === 'assistant' && Array.isArray(entry.beats) ? entry.beats : [{ speakerId: entry.role === 'user' ? 'PLAYER' : entry.speakerId, textKo: entry.text }];
      for (const beat of beats) {
        const row = document.createElement('p'); row.className = entry.role === 'user' ? 'late-game-user-line' : 'late-game-character-line';
        const name = document.createElement('strong'); name.textContent = labelFor(beat.speakerId); const copy = document.createElement('span'); copy.textContent = beat.textKo || entry.text || '';
        row.append(name, copy); transcript.append(row);
      }
    }
    strip.insertBefore(transcript, $('responseArea')); transcript.scrollTop = transcript.scrollHeight;
  }
  function localLateGameFallback(scene) {
    const line = lateGame.fallbackBeats.find(item => scene.fallbackBeatIds.includes(item.id));
    const speaker = scene.cast.includes(line.speakerId) ? line.speakerId : scene.cast[0];
    const expression = scene.allowedExpressionIds.find(id => id.startsWith(`${speaker}_`)) || (scene.allowedExpressionIds.includes('none') ? 'none' : scene.allowedExpressionIds[0]);
    return { turn: { schemaVersion: 'AI_SCENE_TURN_V1', sceneId: scene.id, turnType: 'DIALOGUE', beats: [{ type: 'DIALOGUE', speakerId: speaker, textKo: line.textKo, emotion: 'neutral', expressionId: expression, actionId: 'NONE' }], suggestedReplies: [{ id: 'R1', textKo: '그 말의 근거가 된 문장을 같이 볼까요?', tone: 'curious' }, { id: 'R2', textKo: '오늘은 여기까지 듣고 생각해 볼게요.', tone: 'reflective' }], semanticSignals: [], relationshipSignals: [], goalSignal: 'HOLD', memoryCandidates: [], historicalClaimIds: [], uiCue: { backgroundId: scene.backgroundId, cgId: scene.cgId, sfxId: 'none' } }, memories: state.lateGameMemories, fallback: true };
  }
  async function submitLateGameTurn(raw) {
    const playerInput = String(raw || '').trim().slice(0, 800); if (!playerInput) { $('lateGameReply')?.focus(); return; }
    const scene = lateGame.scenes.find(item => item.id === state.lateGameSceneId); if (!scene || state.lateGameSceneTurn >= scene.turnLimit) return;
    const responseArea = $('responseArea'); const controls = [...responseArea.querySelectorAll('button,textarea'), ...choices().querySelectorAll('button')]; controls.forEach(node => { node.disabled = true; });
    renderDialogueLine('NARRATION', '잠시 이야기를 고르고 있습니다…');
    $('dialogue').hidden = false;
    const sessionId = state.lateGameSessionId;
    let result;
    try {
      const apiBase = String(window.CHANCERY_AI_API_BASE_URL || '').replace(/\/+$/, '');
      const request = await fetch(`${apiBase}/api/ai/turn`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, sceneId: scene.id, turnIndex: state.lateGameSceneTurn + 1, playerInput }) });
      if (!request.ok) throw new Error('turn unavailable'); result = await request.json();
    } catch { result = localLateGameFallback(scene); }
    const turn = result?.turn;
    if (!turn?.beats?.length) { controls.forEach(node => { node.disabled = false; }); renderDialogueLine('NARRATION', '대화가 잠시 끊겼다. 다시 말하거나 이 장면을 마칠 수 있다.'); return; }
    state.lateGameMemories = Array.isArray(result.memories) ? result.memories.slice(-24) : state.lateGameMemories;
    state.lateGameSummary = typeof result.summary === 'string' ? result.summary.slice(0, 1200) : state.lateGameSummary;
    const speaker = turn.beats[0].speakerId; const responseText = turn.beats.map(beat => beat.textKo).join(' ');
    state.lateGameTurns = [...state.lateGameTurns, { role: 'user', text: playerInput }, { role: 'assistant', speakerId: speaker, text: responseText, beats: turn.beats.map(beat => ({ speakerId: beat.speakerId, textKo: beat.textKo })), replies: turn.suggestedReplies }].slice(-10);
    state.lateGameSceneTurn += 1;
    if (window.Main20AiStateEngine) { const applied = window.Main20AiStateEngine.applySceneTurn(state, turn, scene, playerInput); Object.assign(state, applied.state); }
    save(); render();
  }
  function finishLateGameScene() {
    if (state.lateGameSceneId === 'CIRCLE_01') { state.phase = 'late_game_activities'; }
    else if (state.lateGamePendingActivities.length) { enterLateGameScene(state.lateGamePendingActivities.shift()); return; }
    else { state.phase = 'branch_event'; state.activeBranchLineIndex = 0; }
    state.lateGameSceneId = null; state.lateGameSceneTurn = 0; save(); render();
  }
  function render() { setVisible('endingOverlay', false); const app = document.querySelector('main'); if (app) app.inert = false; const headerBeat = state.phase === 'ideology_prologue' ? data.ideologyPrologue.beats[state.ideologyBeatIndex] : state.phase === 'c07_ideology' ? data.c07IdeologicalFollowUp.beats[state.c07BeatIndex] : state.phase === 'branch_hub' || state.phase === 'branch_event' || state.phase === 'branch_callback' ? branchGraph.hubs[Math.min(state.branchHubIndex, branchGraph.hubs.length - 1)] : null; renderHeader(headerBeat ? { ...scene(), id: headerBeat.id, date: headerBeat.date, dateLabel: headerBeat.dateLabel || headerBeat.date, title: headerBeat.title, sourceMoment: headerBeat.prompt || '사료를 읽고 당대의 논쟁을 자신의 말로 정리합니다.', transitionCard: { event: headerBeat.title, change: '자료를 읽고 선택한 뒤 동료의 반응을 확인합니다.' }, excerpts: [] } : scene()); if (!MAIN20_DEAD_END_STATES.has(state.phase)) state.phase = 'legacy_recovery'; if (state.phase === 'onboarding') renderOnboarding(); else if (state.phase === 'ideology_prologue') renderIdeologyPrologue(); else if (state.phase === 'c07_ideology') renderC07Ideology(); else if (state.phase === 'branch_hub') renderBranchHub(); else if (state.phase === 'branch_event') renderBranchEvent(); else if (state.phase === 'branch_callback') renderBranchCallback(); else if (state.phase === 'intro') renderIntro(); else if (state.phase === 'reading') renderReading(); else if (state.phase === 'source_discussion') renderSourceDiscussion(); else if (state.phase === 'decision' || state.phase === 'choice') renderDecision(); else if (state.phase === 'post_choice') renderPostChoice(); else if (state.phase === 'reaction') renderReaction(); else if (state.phase === 'final_reaction') renderFinalReaction(); else if (state.phase === 'legacy_recovery') renderRecovery(); else renderEnding(); }
  const renderCore = render;
  render = function renderLearningAndExam() {
    state = normalizeFeatureState(state);
    if (['late_game_scene', 'late_game_activities'].includes(state.phase)) return renderLateGamePhase();
    document.body.classList.remove('late-game-mode');
    $('dialogue').hidden = false;
    document.querySelector('.late-game-transcript')?.remove();
    document.querySelector('.document-stage')?.style.removeProperty('background-image');
    document.body.classList.toggle('main20-circle-warehouse', state.phase === 'circle_learning');
    if (!['circle_learning', 'exam_prep', 'exam_questions', 'exam_result'].includes(state.phase)) return renderCore();
    const hub = branchGraph.hubs[Math.min(state.branchHubIndex, branchGraph.hubs.length - 1)];
    const title = state.phase === 'circle_learning' ? '창고의 저녁 독서 모임' : state.phase === 'exam_prep' ? '진급 시험 준비' : '진급 시험';
    renderHeader({ ...scene(), id: hub?.id || 'H1-CIRCLE', date: hub?.date || '1847-09-12', dateLabel: hub?.date || '1847-09-12', title, sourceMoment: '읽은 문서의 문맥을 확인하고 다음 절차로 나아갑니다.', transitionCard: { event: title, change: '자료를 읽고 이어서 진행할 수 있습니다.' }, excerpts: [] });
    if (state.phase === 'circle_learning') renderLearningScene();
    else if (state.phase === 'exam_prep') renderExamPrep();
    else if (state.phase === 'exam_questions') renderExamQuestion();
    else renderExamResult();
  };
  if (state.legacyEndingTitle) { state.phase = 'legacy_recovery'; state.endingId = null; } else if (state.phase === 'ending' && !resolveEnding(state)) { state.phase = 'legacy_recovery'; state.endingId = null; }
  const resetMain20 = () => { state = fresh(); state.examSeed = crypto.randomUUID?.() || `exam-${Date.now()}-${Math.random()}`; applyExamSeed(state.examSeed); save(); setVisible('endingOverlay', false); const app = document.querySelector('main'); if (app) app.inert = false; render(); };
  const restart = $('main20Restart'); if (restart) { restart.hidden = false; restart.onclick = resetMain20; }
  $('saveBtn').onclick = () => { save(); $('saveBtn').textContent = '기록 저장됨'; }; $('loadBtn').onclick = () => { state = normalize(JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem('chancery-main20-v34') || 'null')); render(); $('loadBtn').textContent = '기록 불러옴'; }; window.addEventListener('window-view-change', (event) => { state.windowView = event.detail.open ? 'open' : 'closed'; save(); }); document.body.classList.add('main20-mode'); window.__main20 = { getState: () => JSON.parse(JSON.stringify(state)), data, resolveEnding, resolveEndingFor: (candidate) => resolveEnding(candidate), resolveEndingDetailedFor: (candidate) => resolveEndingDetailed(candidate), readIds: (sceneId) => [...(state.readExcerptIdsByScene[sceneId] || [])], memoryLineFor: (sceneId, candidate) => { const current = data.scenes.find((item) => item.id === sceneId); return selectMemoryCallbacks(current, candidate || state, 2).map((callback) => callback.character); }, renderedMemory: () => selectMemoryCallbacks(scene(), state, 1).map((callback) => ({ character: callback.character, line: callback.line })), getWindowSnapshot: () => ({ state: JSON.parse(JSON.stringify(state)), scrollTop: $('paperColumns')?.scrollTop || 0 }), setWindowView: (open) => { state.windowView = open ? 'open' : 'closed'; save(); }, restoreWindowSnapshot: (snapshot) => { if (snapshot?.state) state = normalize(snapshot.state); state.windowView = 'closed'; save(); render(); requestAnimationFrame(() => { if ($('paperColumns')) $('paperColumns').scrollTop = snapshot?.scrollTop || 0; }); }, reset: resetMain20 }; render();
  window.__main20.getBranchGraph = () => JSON.parse(JSON.stringify(branchGraph));
  window.__main20.enumerateRouteVectors = () => window.Main20BranchGraph.enumerateRouteVectors(branchGraph);
  window.__main20.replayRouteVector = (choiceIds) => {
    if (!Array.isArray(choiceIds) || choiceIds.length !== branchGraph.hubs.length) throw new Error('A route vector must contain one choice for each of the four hubs.');
    let routeState = { routeChoices: [], branchState: {}, historicalAnchors: branchGraph.anchors };
    const events = [];
    for (let index = 0; index < choiceIds.length; index += 1) {
      const hub = branchGraph.hubs[index];
      const resolved = window.Main20BranchGraph.resolveBranchEvent(branchGraph, hub.id, choiceIds[index], routeState);
      routeState = resolved.nextState; events.push(resolved.eventId, resolved.reactionId);
    }
    return { routeChoices: routeState.routeChoices, branchState: routeState.branchState, events, endingRoutes: [...branchGraph.endingRoutes] };
  };
})();
