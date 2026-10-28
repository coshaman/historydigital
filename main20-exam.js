(function attachMain20Exam(root) {
  function scoreExam(answers, examData) {
    const submitted = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
    const questions = Array.isArray(examData?.questions) ? examData.questions : [];
    const answerKey = examData?.answerKey && typeof examData.answerKey === 'object' ? examData.answerKey : {};
    const correctCount = questions.reduce((count, question) => {
      const answerId = submitted[question.id];
      const isKnownOption = question.options?.some((option) => option.id === answerId) === true;
      return count + (isKnownOption && answerId === answerKey[question.id] ? 1 : 0);
    }, 0);
    const passed = questions.length > 0 && correctCount >= Number(examData?.passThreshold || Infinity);
    return { correctCount, total: questions.length, passed, outcome: passed ? 'passed' : 'failed' };
  }

  function derivePromotionStatus(examOutcome) {
    if (examOutcome === 'passed') return 'promoted';
    if (examOutcome === 'failed') return 'not-promoted';
    return 'pending';
  }

  function selectExamQuestions(examData, seed) {
    const questions = Array.isArray(examData?.questions) ? examData.questions.filter(question => question && typeof question.id === 'string') : [];
    const count = Number.isInteger(examData?.questionCount) && examData.questionCount > 0 ? examData.questionCount : 5;
    if (questions.length <= count) return questions.slice();
    let state = 2166136261;
    for (const char of String(seed ?? '')) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
    const random = () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    const shuffled = questions.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    return shuffled.slice(0, count);
  }

  root.Main20Exam = Object.freeze({ scoreExam, derivePromotionStatus, selectExamQuestions });
})(globalThis);
