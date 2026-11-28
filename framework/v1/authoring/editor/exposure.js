// Effective exposure: what each Control is at a Task after carry-over. No DOM.
//
// It follows the runner's rule exactly (applyExposure in runner/index.js): Controls start open;
// at each Task in order, show opens a Control, then lock shows and locks it, then hide hides it.
// A Control a Task doesn't name keeps what the Tasks before gave it.
//
// effectiveExposure(doc, p, t, toolInfo?) -> { [controlId]: { state, from, here } }
//   state  'open' | 'locked' | 'hidden' at Task t of Part p (t = -1: before the first Task)
//   from   the index of the last Task up to t that named the Control, or null (never named)
//   here   from === t: this Task's lists set it, rather than it being inherited
// The Controls are the Mode's (from toolInfo, in its order) followed by any other id Tasks 0..t
// name (unknown Controls, or every named id when there is no Tool info).
//
// The set-exposure edits (setExposure, clearExposure) are in edits.js; they use exposureState.

export const STATES = ['open', 'locked', 'hidden'];
export const LIST_OF = { open: 'show', locked: 'lock', hidden: 'hide' };
const LISTS = ['show', 'lock', 'hide'];
const STATE_OF = { show: 'open', lock: 'locked', hide: 'hidden' };

const tasksOf = (doc, p) => (Array.isArray(doc.parts?.[p]?.tasks) ? doc.parts[p].tasks : []);
const listOf = (task, k) => (Array.isArray(task?.[k]) ? task[k] : []);

export function effectiveExposure(doc, p, t, toolInfo) {
  const part = doc.parts?.[p];
  const mode = toolInfo && part && Object.hasOwn(toolInfo.modes, part.mode) ? toolInfo.modes[part.mode] : null;
  const out = {};
  for (const c of mode?.controls ?? []) out[c.id] = { state: 'open', from: null, here: false };
  const tasks = tasksOf(doc, p);
  for (let i = 0; i <= t && i < tasks.length; i++) {
    for (const k of LISTS) {
      for (const id of listOf(tasks[i], k)) {
        out[id] = { state: STATE_OF[k], from: i, here: i === t };
      }
    }
  }
  return out;
}

// One Control's state at Task t (open when nothing named it).
export function exposureState(doc, p, t, control) {
  let state = 'open';
  const tasks = tasksOf(doc, p);
  for (let i = 0; i <= t && i < tasks.length; i++) {
    for (const k of LISTS) if (listOf(tasks[i], k).includes(control)) state = STATE_OF[k];
  }
  return state;
}
