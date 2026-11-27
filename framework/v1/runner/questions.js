// Questions: what a Task asks the student to answer, judged only on Submit.
//
//   { id, kind: 'numeric', prompt, answer, tol }      |answer - given| <= tol
//     answer is a number or a State expression { expr } (see ../expression.js), worked out
//     against the Part's State at Submit; an unknown State name or a non-finite value is a
//     miss whose feedback names the problem. tol, relTol and modulus are always numbers.
//   { id, kind: 'numeric', prompt, answer, relTol }   |answer - given| <= relTol * |answer|
//   either numeric form may add modulus (> 0): the difference is first wrapped into
//   (-modulus/2, modulus/2], so a phase with modulus 360 accepts -90 and 270 alike
//   { id, kind: 'choice', prompt, choices: [{ id, text }], correct }   given === correct choice id
//   { id, kind: 'text',    prompt }                   recorded, never judged
//
// Any Question may carry its own points (see scoring.js).
//
// questionKinds is the one table of Question kinds: how each is validated (validate(q, fail),
// used by activity.js) and judged (judge(q, given, state), absent for a kind that is never
// graded). judge returns a boolean or { pass, expected?, feedback? }.
// Adding a kind means adding an entry here, and a matching input in activity-ui.js.
//
// A judged numeric result records `expected`: the key it was judged against, from a number
// or an expression (omitted when the key couldn't be worked out).

import { cachedExpression as expressionFor, isExpression, ExpressionError } from '../expression.js';

export const questionKinds = {
  numeric: {
    validate(q, fail) {
      if (isExpression(q.answer)) {
        try {
          expressionFor(q.answer.expr);
        } catch (err) {
          if (!(err instanceof ExpressionError)) throw err;
          fail(`answer expression "${q.answer.expr}" doesn't parse: ${err.message}`);
        }
      } else if (typeof q.answer !== 'number') fail('needs a numeric answer');
      if (typeof q.tol !== 'number' && typeof q.relTol !== 'number') fail('needs tol or relTol');
      if (q.modulus !== undefined && !(Number.isFinite(q.modulus) && q.modulus > 0)) {
        fail('modulus must be a positive number');
      }
    },
    judge(q, given, state) {
      let expected = q.answer;
      if (isExpression(q.answer)) {
        try {
          expected = expressionFor(q.answer.expr).evaluate(state);
        } catch (err) {
          if (!(err instanceof ExpressionError)) throw err;
          return { pass: false, feedback: `Can't judge this answer: its answer key has ${lowerFirst(err.message).replace(/\.$/, '')}.` };
        }
        if (!Number.isFinite(expected)) {
          return { pass: false, feedback: `Can't judge this answer: the answer key works out to ${expected}.` };
        }
      }
      const value = typeof given === 'string' && given.trim() !== '' ? Number(given) : given;
      if (typeof value !== 'number' || !Number.isFinite(value)) return { pass: false, expected };
      const tol = q.relTol !== undefined ? q.relTol * Math.abs(expected) : q.tol;
      return { pass: Math.abs(wrap(value - expected, q.modulus)) <= tol, expected };
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

// Wrap a difference into (-modulus/2, modulus/2]; unchanged when there is no modulus.
function wrap(diff, modulus) {
  if (modulus === undefined) return diff;
  const r = diff - modulus * Math.floor(diff / modulus); // [0, modulus)
  return r > modulus / 2 ? r - modulus : r;
}

export const isGraded = (q) => typeof questionKinds[q.kind]?.judge === 'function';

// Judge each Question against the answers given ({ [questionId]: value }) and the
// State snapshot at Submit, which expression answers are worked out from.
export function evaluateQuestions(questions = [], answers = {}, state = {}) {
  return questions.map((q) => {
    const given = answers[q.id];
    if (!isGraded(q)) return { kind: 'question', id: q.id, graded: false, pass: null, feedback: null };
    const outcome = questionKinds[q.kind].judge(q, given, state);
    const { pass, expected, feedback } = typeof outcome === 'object' ? outcome : { pass: outcome };
    return {
      kind: 'question', id: q.id, graded: true, pass,
      feedback: pass ? null : feedback ?? feedbackFor(q, given),
      ...(expected === undefined ? {} : { expected }),
    };
  });
}

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

function feedbackFor(q, given) {
  if (given === undefined || given === null || given === '') return 'No answer given';
  return 'Not quite';
}
