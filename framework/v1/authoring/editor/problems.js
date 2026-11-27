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

export const CHECKS = [];

export function findProblems(doc, toolInfo) {
  const runner = activityProblems(doc).map((p) => ({ ...p, source: 'runner' }));
  const others = CHECKS.flatMap((c) => c.run(doc, toolInfo).map((p) => ({ ...p, source: c.source })));
  return [...runner, ...others];
}
