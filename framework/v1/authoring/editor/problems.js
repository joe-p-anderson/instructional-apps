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
import { cachedExpression, isExpression } from '../../expression.js';
import { kindOf, items, childPath, conditionSlots } from './condition-model.js';

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
  // Conditions (condition-model.js): the shape the runner's validation leaves to Submit (an
  // empty group, a target with no value, a range with no bound), and, with Tool info, State
  // names that are not State of the Part's Mode, whether a slot's State name or a name inside an
  // expression. An expression that doesn't parse is the runner's problem, so it isn't checked.
  // Path: the node (a group) or its slot.
  { source: 'conditions', run(doc, toolInfo) {
    return partsOf(doc).flatMap((part, p) => {
      const mode = toolInfo && Object.hasOwn(toolInfo.modes, part?.mode) ? toolInfo.modes[part.mode] : null;
      return (Array.isArray(part?.tasks) ? part.tasks : []).flatMap((task, t) => {
        if (task?.condition === undefined) return [];
        const at = (path) => ['parts', p, 'tasks', t, 'condition', ...path];
        const say = (text) => `Task "${task.id}" Condition ${text}`;
        const out = conditionShapeProblems(task.condition).map(({ path, text }) => ({ path: at(path), message: say(text) }));
        if (!mode) return out;
        const known = (name) => Object.hasOwn(mode.state ?? {}, name);
        for (const { path, slot, value } of conditionSlots(task.condition)) {
          if (slot === 'state' && typeof value === 'string' && !known(value)) {
            out.push({ path: at([...path, slot]), message: say(`names "${value}", which is not State of Mode "${part.mode}"`) });
          } else if (isExpression(value)) {
            let names;
            try { names = cachedExpression(value.expr).names; } catch { continue; }
            const unknown = names.filter((n) => !known(n));
            if (unknown.length) out.push({ path: at([...path, slot]), message: say(`expression "${value.expr}" names ${unknown.map((n) => `"${n}"`).join(' and ')}, `
              + `which ${unknown.length === 1 ? 'is' : 'are'} not State of Mode "${part.mode}"`) });
          }
        }
        return out;
      });
    });
  } },
];

function conditionShapeProblems(node, path = []) {
  const kind = kindOf(node);
  if (kind === 'anyOf' || kind === 'allOf') {
    const list = items(node);
    if (!list.length) return [{ path, text: `has an empty ${kind === 'anyOf' ? 'any-of' : 'all-of'} group` }];
    return list.flatMap((x, i) => conditionShapeProblems(x, childPath(path, node, i)));
  }
  if (kind === 'target' && node.target === undefined) return [{ path: [...path, 'target'], text: 'target needs a value' }];
  if (kind === 'range' && node.above === undefined && node.below === undefined) return [{ path: [...path, 'above'], text: 'range needs an above or below bound' }];
  return [];
}

export function findProblems(doc, toolInfo) {
  const runner = activityProblems(doc).map((p) => ({ ...p, source: 'runner' }));
  const others = CHECKS.flatMap((c) => c.run(doc, toolInfo).map((p) => ({ ...p, source: c.source })));
  return [...runner, ...others];
}
