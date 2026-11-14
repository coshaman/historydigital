const CIRCLE_PATHS = new Set(['attended', 'attended-notes', 'declined']);
const EXAM_ACTIONS = new Set(['sit', 'defer', 'help-peer']);

export function createLearningProgress() {
  return {
    phase: 'circle-choice',
    circleLearning: null,
    lessonIndex: 0,
    examAnswers: {},
    examOutcome: 'unset',
    examCorrectCount: null,
    promotionStatus: 'pending',
    timelineIndex: 0,
  };
}

export function chooseCirclePath(progress, choice) {
  if (progress?.phase !== 'circle-choice' || !CIRCLE_PATHS.has(choice)) return progress;
  return {
    ...progress,
    circleLearning: choice,
    lessonIndex: 0,
    phase: choice === 'declined' ? 'public-prep' : 'learning',
  };
}

export function advanceStudy(progress, examData) {
  if (!['learning', 'public-prep'].includes(progress?.phase)) return progress;
  const count = Array.isArray(examData?.learningUnits) ? examData.learningUnits.length : 0;
  if (count === 0) return progress;
  const nextIndex = progress.lessonIndex + 1;
  return {
    ...progress,
    lessonIndex: Math.min(nextIndex, count),
    phase: nextIndex >= count ? 'exam-choice' : progress.phase,
  };
}

export function beginExam(progress, action) {
  if (progress?.phase !== 'exam-choice' || !EXAM_ACTIONS.has(action)) return progress;
  if (action === 'sit') return { ...progress, phase: 'exam', examAction: action, examAnswers: {}, examOutcome: 'unset', examCorrectCount: null, promotionStatus: 'pending' };
  return {
    ...progress,
    phase: 'result',
    examAction: action,
    examAnswers: {},
    examOutcome: action === 'defer' ? 'deferred' : 'helped-peer',
    examCorrectCount: null,
    promotionStatus: 'pending',
  };
}

export function getExamQuestions(progress, examData) {
  return progress?.phase === 'exam' && Array.isArray(examData?.questions) ? examData.questions : [];
}

export function selectExamAnswer(progress, questionId, optionId, examData) {
  if (progress?.phase !== 'exam') return progress;
  const question = examData?.questions?.find(item => item.id === questionId);
  if (!question?.options?.some(option => option.id === optionId)) return progress;
  return { ...progress, examAnswers: { ...(progress.examAnswers ?? {}), [questionId]: optionId } };
}

function persistableExamAnswers(answers, examData) {
  const submitted = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
  const questions = new Map((Array.isArray(examData?.questions) ? examData.questions : []).map(question => [question.id, question]));
  if (Object.keys(submitted).some(questionId => !questions.has(questionId))) return {};
  return Object.fromEntries(Object.entries(submitted).filter(([questionId, optionId]) => questions.get(questionId).options?.some(option => option.id === optionId)));
}

export function scoreExam(answers, examData) {
  const submitted = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
  const questions = Array.isArray(examData?.questions) ? examData.questions : [];
  const answerKey = examData?.answerKey && typeof examData.answerKey === 'object' ? examData.answerKey : {};
  const questionIds = new Set(questions.map(question => question.id));
  if (Object.keys(submitted).some(questionId => !questionIds.has(questionId))) {
    return { correctCount: 0, total: questions.length, passed: false, outcome: 'failed' };
  }
  const correctCount = questions.reduce((count, question) => {
    const answerId = submitted[question.id];
    const isKnownOption = question.options?.some(option => option.id === answerId) === true;
    return count + (isKnownOption && answerId === answerKey[question.id] ? 1 : 0);
  }, 0);
  const passed = questions.length > 0 && Number.isInteger(examData?.passThreshold) && correctCount >= examData.passThreshold;
  return { correctCount, total: questions.length, passed, outcome: passed ? 'passed' : 'failed' };
}

export function submitExam(progress, answers, examData) {
  if (progress?.phase !== 'exam') return progress;
  const examAnswers = persistableExamAnswers(answers, examData);
  const score = scoreExam(examAnswers, examData);
  return {
    ...progress,
    phase: 'result',
    examAnswers,
    examCorrectCount: score.correctCount,
    examOutcome: score.outcome,
    promotionStatus: score.passed ? 'promoted' : 'not-promoted',
  };
}

export function completeLearning(progress) {
  return progress?.phase === 'result' && ['passed', 'failed', 'deferred', 'helped-peer'].includes(progress.examOutcome)
    ? { ...progress, phase: 'complete' }
    : progress;
}

function routeState(state) {
  const actions = state?.ledger ?? [];
  const actionFor = questId => actions.findLast(item => item.questId === questId && item.actionId)?.actionId ?? 'unset';
  const workshopRelations = Object.values(state?.hosts ?? {}).flatMap(host => Object.values(host.relations ?? {}));
  return {
    circleLearning: state?.learning?.circleLearning ?? 'unset',
    printshopAction: actionFor('PRINTSHOP_PROOF_1847'),
    publicAction: actionFor('PUBLIC_DISCOURSE_1848'),
    workshopRelationship: workshopRelations.some(value => /재확인|보관을 맡|함께 맡/.test(String(value))) ? 'shared-work' : 'separate-work',
    hostCount: new Set((state?.world?.possessionHistory ?? []).map(item => item.hostId).filter(id => state?.hosts?.[id]?.kind !== 'LITERARY')).size,
  };
}

function valueAtPath(value, path) {
  return String(path ?? '').split('.').filter(Boolean).reduce((current, key) => current == null ? undefined : current[key], value);
}

export function buildLifeTimeline(state, templates) {
  const projected = { ...state, route: routeState(state) };
  const episodes = (templates?.periods ?? []).map(period => {
    const key = valueAtPath(projected, period.statePath);
    const episode = period.variants && Object.hasOwn(period.variants, String(key)) ? period.variants[String(key)] : period.default;
    return { ...episode, periodId: period.id, year: period.year, periodLabel: `${period.year}년`, basis: [...(episode?.basis ?? [])] };
  }).filter(episode => episode.id && episode.fictional === true);
  const v47Rows = state?.ledger?.filter(row => row.questId?.startsWith('V47_MAIN0')) ?? [];
  const aftermath = [];
  const selected = (storyPrefix, actionIds) => v47Rows.find(row => row.questId.startsWith(storyPrefix) && actionIds.includes(row.actionId));
  if (v47Rows.some(row => row.questId.startsWith('V47_MAIN01_'))) {
    const copyKept = selected('V47_MAIN01_', ['V47_A06_KEEP_COPY']);
    const replySent = selected('V47_MAIN01_', ['V47_A08_SEND_LETTER']);
    const workersPaid = selected('V47_MAIN01_', ['V47_A06_PAY_WORKERS', 'V47_A11_SETTLE_WORKERS']);
    const details = [
      copyKept ? '레프가 맡긴 한 부는 안나의 물건으로 남았다.' : null,
      replySent ? '구독자에게 보낸 답장은 파벨의 배달 경로에 올랐다.' : null,
      workersPaid ? '배포가 멈춘 뒤에도 작업자 품삯 일부가 지급되었다.' : null,
    ].filter(Boolean);
    aftermath.push({ id: 'V47-LIFE-ALMANAC-AFTERMATH', title: '연감 뒤에 남은 사람들',
      textKo: details.length ? details.join(' ') : '연감의 배포 금지 뒤 재고와 약속이 각자의 장부에 남았다.',
      fictional: true, basis: v47Rows.filter(row => row.questId.startsWith('V47_MAIN01_')).map(row => `${row.questId}:${row.actionId}`) });
  }
  if (v47Rows.some(row => row.questId.startsWith('V47_MAIN03_'))) {
    const vasilyWarned = selected('V47_MAIN03_', ['V47_P07_WARN_FICTIONAL']);
    const recordsSeparated = selected('V47_MAIN03_', ['V47_P07_SEPARATE_REPORTS']);
    const details = [
      vasilyWarned ? '바실리는 경고를 받고 수색대보다 먼저 뒷길로 빠져나왔다.' : null,
      recordsSeparated ? '조서에는 확인된 보고와 현장에서 본 일이 따로 묶였다.' : null,
      '실제 체포와 그 뒤의 역사적 결과는 그대로 이어졌다.',
    ].filter(Boolean);
    aftermath.push({ id: 'V47-LIFE-FRIDAY-AFTERMATH', title: '금요일 뒤의 소식', textKo: details.join(' '),
      fictional: true, basis: v47Rows.filter(row => row.questId.startsWith('V47_MAIN03_')).map(row => `${row.questId}:${row.actionId}`) });
  }
  if (v47Rows.some(row => row.questId.startsWith('V47_MAIN05_'))) {
    const cholera = state?.world?.v47?.cholera;
    const cases = cholera ? `기록된 회복 ${cholera.counters?.recoveries ?? 0}명, 사망 ${cholera.counters?.deaths ?? 0}명` : '가구별 환자 기록';
    const cleaned = Object.values(cholera?.waterSources ?? {}).filter(source => source.cleaned).length;
    aftermath.push({ id: 'V47-LIFE-CHOLERA-AFTERMATH', title: '여름이 지난 뒤',
      textKo: `${cases}. 수원을 씻거나 침상을 늘린 선택은 해당 구역의 살림과 돌봄에 남았다${cleaned ? ` · 씻어 낸 수원 ${cleaned}곳` : ''}.`,
      fictional: true, basis: v47Rows.filter(row => row.questId.startsWith('V47_MAIN05_')).map(row => `${row.questId}:${row.actionId}`) });
  }
  if (aftermath.length) {
    const firstLaterYear = episodes.findIndex(episode => Number(episode.year) >= 1850);
    episodes.splice(firstLaterYear < 0 ? episodes.length : firstLaterYear + 1, 0, ...aftermath);
  }
  return episodes;
}
