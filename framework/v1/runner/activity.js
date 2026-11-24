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
    }
  }
}
