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
  return (templates?.periods ?? []).map(period => {
    const key = valueAtPath(projected, period.statePath);
    const episode = period.variants && Object.hasOwn(period.variants, String(key)) ? period.variants[String(key)] : period.default;
    return { ...episode, periodId: period.id, year: period.year, periodLabel: `${period.year}년`, basis: [...(episode?.basis ?? [])] };
  }).filter(episode => episode.id && episode.fictional === true);
}
