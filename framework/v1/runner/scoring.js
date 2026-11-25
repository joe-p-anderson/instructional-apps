// Judging and scoring, shared by the runner and (later) the Report Viewer.
//
// Scores are recomputed from each Attempt's recorded State and answers
// against the Activity definition; stored results and totals are never trusted.
//
//   scoreActivity(activity, attempts, { conditionTypes? })
//     attempts: { [partId]: { [taskId]: [{ state, answers }, ...] } }
//     returns { earned, possible, parts: [{ id, earned, possible,
//               tasks: [{ id, passed, earned, possible }] }] }
//
// Rules (spec, Scoring):
//   - a Task's points are awarded if any Attempt passed; misses cost nothing;
//   - a graded Question's own points are earned once it was answered correctly in any Attempt;
//   - a free-text Question's own points are earned once any Attempt gave a non-empty answer.
import { evaluateCondition, createConditionRegistry } from './conditions.js';
import { evaluateQuestions, isGraded } from './questions.js';
import { decodeActivity } from './keys.js';

// Judge one Submit of a Task: the Condition (if any) and its Questions.
export function judgeTask(task, state, answers = {}, { info = {}, registry } = {}) {
  const results = task.condition ? evaluateCondition(task.condition, state, { info, registry }) : [];
  results.push(...evaluateQuestions(task.questions, answers));
  return { results, passed: results.every((r) => r.pass !== false) };
}

export function scoreActivity(definition, attempts = {}, { conditionTypes } = {}) {
  const activity = decodeActivity(definition);
  const registry = createConditionRegistry(activity.conditionTypes, conditionTypes);
  const parts = activity.parts.map((part) => {
    const tasks = part.tasks.map((task) => scoreTask(task, attempts[part.id]?.[task.id] ?? [], registry));
    return { id: part.id, ...totals(tasks), tasks };
  });
  return { ...totals(parts), parts };
}

function scoreTask(task, attempts, registry) {
  const judged = attempts.map((a) => {
    const answers = a?.answers ?? {};
    return { answers, ...safeJudge(task, a?.state ?? {}, answers, registry) };
  });
  const questions = (task.questions ?? []).map((q) => ({ id: q.id, graded: isGraded(q), points: q.points ?? 0 }));
  return { id: task.id, ...earnedFromResults({ points: task.points ?? 0, questions }, judged) };
}

// The scoring rules above, applied to judged Attempts. Shared with the Report Viewer,
// which has no Activity definition and so passes each Attempt's recorded results.
//   task:     { points, questions: [{ id, graded, points }] }
//   attempts: [{ passed, results: [{ kind, id, pass }], answers: { [questionId]: value } }]
//   returns   { passed, earned, possible }
export function earnedFromResults(task, attempts) {
  const passed = attempts.some((a) => a.passed);
  let earned = passed ? task.points : 0;
  let possible = task.points;
  for (const q of task.questions) {
    possible += q.points;
    const earns = q.graded
      ? attempts.some((a) => a.results.some((r) => r?.kind === 'question' && r.id === q.id && r.pass === true))
      : attempts.some((a) => nonEmpty(a.answers?.[q.id]));
    if (earns) earned += q.points;
  }
  return { passed, earned, possible };
}

// A recorded State that no longer fits the Condition (e.g. a missing name) is a miss.
function safeJudge(task, state, answers, registry) {
  try {
    return judgeTask(task, state, answers, { registry });
  } catch {
    return { results: evaluateQuestions(task.questions, answers), passed: false };
  }
}

const nonEmpty = (v) => v !== undefined && v !== null && String(v).trim() !== '';

function totals(items) {
  return {
    earned: items.reduce((n, i) => n + i.earned, 0),
    possible: items.reduce((n, i) => n + i.possible, 0),
  };
}
