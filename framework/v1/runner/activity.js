// The Activity definition shape, checked when a runner is created.
//
// {
//   id, version, title, course, tool,          // tool = the Tool's id
//   conditionTypes?: { [type]: evaluator },     // extra Condition types (see conditions.js)
//   parts: [{
//     id, title, mode, setup,
//     tasks: [{
//       id, title, prompt,                      // prompt may contain math
//       show?: [controlId], lock?: [controlId], hide?: [controlId],
//       condition?,                             // see conditions.js
//       questions?: [question],                  // see questions.js
//       points,
//       hint?: { after: missCount, text },
//     }],
//   }],
// }
export function validateActivity(activity) {
  const fail = (msg) => { throw new Error(`Invalid Activity: ${msg}`); };
  if (!activity || typeof activity !== 'object') fail('definition must be an object');
  for (const key of ['id', 'title', 'tool']) {
    if (typeof activity[key] !== 'string' || !activity[key]) fail(`missing ${key}`);
  }
  if (activity.version === undefined) fail('missing version');
  if (!Array.isArray(activity.parts) || activity.parts.length === 0) fail('needs at least one Part');

  const partIds = new Set();
  for (const part of activity.parts) {
    if (!part.id) fail('a Part is missing its id');
    if (partIds.has(part.id)) fail(`duplicate Part id "${part.id}"`);
    partIds.add(part.id);
    if (!part.mode) fail(`Part "${part.id}" is missing its mode`);
    if (!Array.isArray(part.tasks)) fail(`Part "${part.id}" needs a tasks list`);

    const taskIds = new Set();
    for (const task of part.tasks) {
      if (!task.id) fail(`a Task in Part "${part.id}" is missing its id`);
      if (taskIds.has(task.id)) fail(`duplicate Task id "${task.id}" in Part "${part.id}"`);
      taskIds.add(task.id);
      if (task.points !== undefined && typeof task.points !== 'number') fail(`Task "${task.id}" points must be a number`);
      for (const list of ['show', 'lock', 'hide']) {
        if (task[list] !== undefined && !Array.isArray(task[list])) fail(`Task "${task.id}" ${list} must be a list of Control ids`);
      }
      if (task.hint !== undefined && (typeof task.hint.after !== 'number' || typeof task.hint.text !== 'string')) {
        fail(`Task "${task.id}" hint needs { after: number, text: string }`);
      }
      if (task.questions !== undefined && !Array.isArray(task.questions)) fail(`Task "${task.id}" questions must be a list`);
      const questionIds = new Set();
      for (const q of task.questions ?? []) {
        const where = `Question "${q.id}" in Task "${task.id}"`;
        if (!q.id) fail(`a Question in Task "${task.id}" is missing its id`);
        if (questionIds.has(q.id)) fail(`duplicate ${where}`);
        questionIds.add(q.id);
        if (!['numeric', 'choice', 'text'].includes(q.kind)) fail(`${where} kind must be numeric, choice or text`);
        if (q.points !== undefined && typeof q.points !== 'number') fail(`${where} points must be a number`);
        if (q.kind === 'numeric') {
          if (typeof q.answer !== 'number') fail(`${where} needs a numeric answer`);
          if (typeof q.tol !== 'number' && typeof q.relTol !== 'number') fail(`${where} needs tol or relTol`);
        }
        if (q.kind === 'choice') {
          if (!Array.isArray(q.choices) || q.choices.length < 2) fail(`${where} needs at least two choices`);
          if (!q.choices.some((c) => c.id === q.correct)) fail(`${where} correct must name one of its choices`);
        }
      }
    }
  }
}
