// Questions: what a Task asks the student to answer, judged only on Submit.
//
//   { id, kind: 'numeric', prompt, answer, tol }      |answer - given| <= tol
//   { id, kind: 'numeric', prompt, answer, relTol }   |answer - given| <= relTol * |answer|
//   { id, kind: 'choice',  prompt, choices: [{ id, text }], correct }   given === correct choice id
//   { id, kind: 'text',    prompt }                   recorded, never judged
//
// Any Question may carry its own points (see scoring.js).
//
// questionKinds is the one table of Question kinds: how each is validated (validate(q, fail),
// used by activity.js) and judged (judge(q, given), absent for a kind that is never graded).
// Adding a kind means adding an entry here, and a matching input in activity-ui.js.

export const questionKinds = {
  numeric: {
    validate(q, fail) {
      if (typeof q.answer !== 'number') fail('needs a numeric answer');
      if (typeof q.tol !== 'number' && typeof q.relTol !== 'number') fail('needs tol or relTol');
    },
    judge(q, given) {
      const value = typeof given === 'string' && given.trim() !== '' ? Number(given) : given;
      if (typeof value !== 'number' || !Number.isFinite(value)) return false;
      const tol = q.relTol !== undefined ? q.relTol * Math.abs(q.answer) : q.tol;
      return Math.abs(value - q.answer) <= tol;
    },
  },
  choice: {
    validate(q, fail) {
      if (!Array.isArray(q.choices) || q.choices.length < 2) fail('needs at least two choices');
      if (!q.choices.some((c) => c.id === q.correct)) fail('correct must name one of its choices');
    },
    judge(q, given) {
      return given === q.correct;
    },
  },
  text: {
    validate() {},
  },
};

export const isGraded = (q) => typeof questionKinds[q.kind]?.judge === 'function';

// Judge each Question against the answers given ({ [questionId]: value }).
export function evaluateQuestions(questions = [], answers = {}) {
  return questions.map((q) => {
    const given = answers[q.id];
    if (!isGraded(q)) return { kind: 'question', id: q.id, graded: false, pass: null, feedback: null };
    const pass = questionKinds[q.kind].judge(q, given);
    return { kind: 'question', id: q.id, graded: true, pass, feedback: pass ? null : feedbackFor(q, given) };
  });
}

function feedbackFor(q, given) {
  if (given === undefined || given === null || given === '') return 'No answer given';
  return 'Not quite';
}
