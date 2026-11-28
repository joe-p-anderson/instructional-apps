// The editor's problems list. No DOM.
//
// A problem is { path, message, source }:
//   path     leads from the Activity to the field at fault, as in the document:
//            ['parts', 0, 'tasks', 2, 'questions', 1, 'answer']
//   message  plain text for the instructor
//   source   'runner' for the runner's own validation (it would refuse the Activity, so the
//            preview can't start), or the name of the check that found it
//
// CHECKS are run in order after the runner's validation. Each is
//   { source, run(doc, toolInfo) -> [{ path, message }] }
// toolInfo is what the page learned by mounting each Mode (see core.js); it is undefined until
// the page has it, and a check that needs it returns [] without it.
// To add a check (unknown Controls, unknown State, Setup values, ...), append it here.

import { activityProblems } from '../../runner/activity.js';
import { parseExpression, isExpression } from '../../expression.js';

const partsOf = (doc) => (Array.isArray(doc.parts) ? doc.parts : []);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export const CHECKS = [
  // A Part's Mode must be one of the Tool's Modes.
  { source: 'modes', run(doc, toolInfo) {
    if (!toolInfo) return [];
    return partsOf(doc).flatMap((part, p) => (typeof part?.mode === 'string' && !Object.hasOwn(toolInfo.modes, part.mode)
      ? [{ path: ['parts', p, 'mode'], message: `Part "${part.id}" Mode "${part.mode}" is not a Mode of the Tool` }] : []));
  } },
  // Every Setup value is a Setup key or a Setup option of the Part's Mode (an unknown Mode is
  // the check above's problem, so its Setup is not checked).
  { source: 'setup', run(doc, toolInfo) {
    if (!toolInfo) return [];
    return partsOf(doc).flatMap((part, p) => {
      const mode = Object.hasOwn(toolInfo.modes, part?.mode) ? toolInfo.modes[part.mode] : null;
      if (!mode || !isObject(part.setup)) return [];
      const known = [...(mode.setupKeys ?? []), ...(mode.setupOptions ?? [])];
      return Object.keys(part.setup).filter((k) => !known.includes(k)).map((k) => ({ path: ['parts', p, 'setup', k],
        message: `Part "${part.id}" Setup "${k}" is not a Setup key or Setup option of Mode "${part.mode}"` }));
    });
  } },
  // Every id in a Task's show, lock and hide lists is a Control of the Part's Mode (the runner
  // throws on one that isn't when it applies the Task). Path: the list entry.
  { source: 'controls', run(doc, toolInfo) {
    if (!toolInfo) return [];
    return partsOf(doc).flatMap((part, p) => {
      const mode = Object.hasOwn(toolInfo.modes, part?.mode) ? toolInfo.modes[part.mode] : null;
      if (!mode || !Array.isArray(part.tasks)) return [];
      const known = new Set(mode.controls.map((c) => c.id));
      return part.tasks.flatMap((task, t) => ['show', 'lock', 'hide'].flatMap((k) => (Array.isArray(task?.[k]) ? task[k] : [])
        .flatMap((id, i) => (known.has(id) ? [] : [{ path: ['parts', p, 'tasks', t, k, i],
          message: `Task "${task.id}" ${k} list names "${id}", which is not a Control of Mode "${part.mode}"` }]))));
    });
  } },
  // A numeric Question's expression answer names only State the Part's Mode has (an expression
  // that doesn't parse is the runner's problem). Path: the answer.
  { source: 'questions', run(doc, toolInfo) {
    if (!toolInfo) return [];
    return partsOf(doc).flatMap((part, p) => {
      const mode = Object.hasOwn(toolInfo.modes, part?.mode) ? toolInfo.modes[part.mode] : null;
      if (!mode || !Array.isArray(part.tasks)) return [];
      return part.tasks.flatMap((task, t) => (Array.isArray(task?.questions) ? task.questions : []).flatMap((q, k) => {
        if (q?.kind !== 'numeric' || !isExpression(q.answer)) return [];
        let names;
        try { names = parseExpression(q.answer.expr).names; } catch { return []; }
        return names.filter((n) => !Object.hasOwn(mode.state ?? {}, n)).map((n) => ({ path: ['parts', p, 'tasks', t, 'questions', k, 'answer'],
          message: `Task "${task.id}" Question "${q.id}" answer names "${n}", which is not State of Mode "${part.mode}"` }));
      }));
    });
  } },
];

export function findProblems(doc, toolInfo) {
  const runner = activityProblems(doc).map((p) => ({ ...p, source: 'runner' }));
  const others = CHECKS.flatMap((c) => c.run(doc, toolInfo).map((p) => ({ ...p, source: c.source })));
  return [...runner, ...others];
}
