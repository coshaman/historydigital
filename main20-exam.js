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

  root.Main20Exam = Object.freeze({ scoreExam, derivePromotionStatus });
})(globalThis);
