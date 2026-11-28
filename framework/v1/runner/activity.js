import { questionKinds } from './questions.js';
import { validateCondition } from './conditions.js';

// The Activity definition shape, checked when a runner is created.
//
// {
//   id, version, title, course, tool,          // tool = the Tool's id
//   notes?,                                     // author-only text (see below)
//   conditionTypes?: { [type]: evaluator },     // extra Condition types (see conditions.js)
//   parts: [{
//     id, title, mode, setup, notes?,
//     tasks: [{
//       id, title, prompt,                      // prompt may contain math
//       show?: [controlId], lock?: [controlId], hide?: [controlId],
//       condition?,                             // see conditions.js
//       questions?: [question],                  // see questions.js
//       points,
//       hint?: { after: missCount, text },
//       notes?,
//     }],
//   }],
// }
//
// notes (Activity, Part, Task) is plain text for authors, such as design reasoning. The runner
// ignores it: it is never shown to students and never in the Report. It is stored unencoded, so
// it must not give an answer away.
//
// validateActivity(activity) throws `Invalid Activity: <message>` at the first problem.
// activityProblems(activity) lists every problem instead, in the same order, each as
// { path, message }: path leads from the Activity to the field at fault (such as
// ['parts', 0, 'tasks', 2, 'points']), and message is the text validateActivity would throw
// after its prefix. Its first problem is always the one validateActivity throws. The Activity
// editor lists them. A check that fails skips the checks beneath it (a Part with no tasks list
// has no Tasks to check).
export function validateActivity(activity) {
  const [first] = activityProblems(activity);
  if (first) throw new Error(`Invalid Activity: ${first.message}`);
}

const STOP = Symbol('stop');

export function activityProblems(activity) {
  const problems = [];
  // Run one check at path; its fail(message, subpath) records a problem and ends the check.
  const check = (path, fn) => {
    const fail = (message, sub = []) => {
      problems.push({ path: [...path, ...[sub].flat()], message });
      throw STOP;
    };
    try {
      fn(fail);
      return true;
    } catch (err) {
      if (err !== STOP) throw err;
      return false;
    }
  };
  const checkNotes = (owner, path, where) => check(path, (fail) => {
    if (owner.notes !== undefined && typeof owner.notes !== 'string') fail(`${where} notes must be text`, 'notes');
  });

  if (!check([], (fail) => { if (!activity || typeof activity !== 'object') fail('definition must be an object'); })) return problems;
  for (const key of ['id', 'title', 'tool']) {
    check([key], (fail) => { if (typeof activity[key] !== 'string' || !activity[key]) fail(`missing ${key}`); });
  }
  check(['version'], (fail) => { if (activity.version === undefined) fail('missing version'); });
  const hasParts = check(['parts'], (fail) => {
    if (!Array.isArray(activity.parts) || activity.parts.length === 0) fail('needs at least one Part');
  });
  checkNotes(activity, [], 'the Activity');
  if (!hasParts) return problems;

  const partIds = new Set();
  activity.parts.forEach((part, i) => {
    const P = ['parts', i];
    check(P, (fail) => {
      if (!part.id) fail('a Part is missing its id', 'id');
      if (partIds.has(part.id)) fail(`duplicate Part id "${part.id}"`, 'id');
      partIds.add(part.id);
    });
    checkNotes(part, P, `Part "${part.id}"`);
    check(P, (fail) => { if (!part.mode) fail(`Part "${part.id}" is missing its mode`, 'mode'); });
    if (!check(P, (fail) => { if (!Array.isArray(part.tasks)) fail(`Part "${part.id}" needs a tasks list`, 'tasks'); })) return;

    const taskIds = new Set();
    part.tasks.forEach((task, j) => {
      const T = [...P, 'tasks', j];
      check(T, (fail) => {
        if (!task.id) fail(`a Task in Part "${part.id}" is missing its id`, 'id');
        if (taskIds.has(task.id)) fail(`duplicate Task id "${task.id}" in Part "${part.id}"`, 'id');
        taskIds.add(task.id);
      });
      checkNotes(task, T, `Task "${task.id}"`);
      check(T, (fail) => {
        if (task.points !== undefined && typeof task.points !== 'number') fail(`Task "${task.id}" points must be a number`, 'points');
      });
      for (const list of ['show', 'lock', 'hide']) {
        check(T, (fail) => {
          if (task[list] !== undefined && !Array.isArray(task[list])) fail(`Task "${task.id}" ${list} must be a list of Control ids`, list);
        });
      }
      check(T, (fail) => {
        if (task.hint !== undefined && (typeof task.hint.after !== 'number' || typeof task.hint.text !== 'string')) {
          fail(`Task "${task.id}" hint needs { after: number, text: string }`, 'hint');
        }
      });
      if (task.condition !== undefined) {
        check([...T, 'condition'], (fail) => validateCondition(task.condition, (msg, sub) => fail(`Task "${task.id}" Condition ${msg}`, sub)));
      }
      const hasQuestions = check(T, (fail) => {
        if (task.questions !== undefined && !Array.isArray(task.questions)) fail(`Task "${task.id}" questions must be a list`, 'questions');
      });
      if (!hasQuestions) return;
      const questionIds = new Set();
      (task.questions ?? []).forEach((q, k) => {
        const Q = [...T, 'questions', k];
        const where = `Question "${q.id}" in Task "${task.id}"`;
        check(Q, (fail) => {
          if (!q.id) fail(`a Question in Task "${task.id}" is missing its id`, 'id');
          if (questionIds.has(q.id)) fail(`duplicate ${where}`, 'id');
          questionIds.add(q.id);
        });
        const kind = Object.hasOwn(questionKinds, q.kind) ? questionKinds[q.kind] : null;
        check(Q, (fail) => { if (!kind) fail(`${where} kind must be one of ${Object.keys(questionKinds).join(', ')}`, 'kind'); });
        check(Q, (fail) => { if (q.points !== undefined && typeof q.points !== 'number') fail(`${where} points must be a number`, 'points'); });
        if (kind) check(Q, (fail) => kind.validate(q, (msg, field) => fail(`${where} ${msg}`, field ?? [])));
      });
    });
  });
  return problems;
}
