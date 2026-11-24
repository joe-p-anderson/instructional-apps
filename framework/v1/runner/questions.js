// Questions: what a Task asks the student to answer, judged only on Submit.
//
//   { id, kind: 'numeric', prompt, answer, tol }      |answer - given| <= tol
//   { id, kind: 'numeric', prompt, answer, relTol }   |answer - given| <= relTol * |answer|
//   { id, kind: 'choice',  prompt, choices: [{ id, text }], correct }   given === correct choice id
//   { id, kind: 'text',    prompt }                   recorded, never judged
//
// Any Question may carry its own points (see scoring.js).

export const isGraded = (q) => q.kind !== 'text';

// Judge each Question against the answers given ({ [questionId]: value }).
export function evaluateQuestions(questions = [], answers = {}) {
  return questions.map((q) => {
    const given = answers[q.id];
    if (!isGraded(q)) return { kind: 'question', id: q.id, graded: false, pass: null, feedback: null };
    const pass = judges[q.kind](q, given);
    return { kind: 'question', id: q.id, graded: true, pass, feedback: pass ? null : feedbackFor(q, given) };
  });
}

const judges = {
  numeric(q, given) {
    const value = typeof given === 'string' && given.trim() !== '' ? Number(given) : given;
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    const tol = q.relTol !== undefined ? q.relTol * Math.abs(q.answer) : q.tol;
    return Math.abs(value - q.answer) <= tol;
  },
  choice(q, given) {
    return given === q.correct;
  },
};

function feedbackFor(q, given) {
  if (given === undefined || given === null || given === '') return 'No answer given';
  return 'Not quite';
}
