// The tolerance field (spec, "Tolerances"): one number with a unit / % switch, shared by the
// Condition builder's target and the numeric Question (ticket 12). Needs a DOM; the mapping to
// tol and relTol is tolerance.js.
//
// toleranceField(ctx, { owner, path, unit, toEdit }) -> node
//   ctx      the TaskContext (task-form.js): field, commitAndRender
//   owner    the object holding tol or relTol (a target Condition, a Question)
//   path     the owner's data-path; the input is tagged `${path}.tol` or `${path}.relTol`
//   unit     the State's (or answer's) unit, shown on the unit side ('' for none)
//   toEdit(fields) -> edit   fields is { tol, relTol } with the other key undefined (cleared)
// Typing writes the side shown; clicking the other side rewrites the same number on that side.
// The input is labelled "Tolerance" and the switch is the group "Tolerance in".

import { h } from '../../ui-kit.js';
import { toleranceOf, toleranceFields } from './tolerance.js';

export function toleranceField(ctx, { owner, path, unit = '', toEdit }) {
  const { side, text } = toleranceOf(owner);
  const [, input] = ctx.field({ label: 'Tolerance', path: `${path}.${side === 'percent' ? 'relTol' : 'tol'}`, value: text,
    class: 't num mono', inputmode: 'decimal', 'aria-label': 'Tolerance', toEdit: (v) => toEdit(toleranceFields(side, v)) });
  const sides = [['unit', unit || 'unit'], ['percent', '%']];
  const seg = h('span', { class: 'seg small', role: 'group', 'aria-label': 'Tolerance in' }, ...sides.map(([s, label]) => h('button', {
    type: 'button', 'aria-pressed': String(s === side),
    title: s === 'percent' ? 'A percentage of the target (stored as relTol, a fraction)' : 'In the unit (stored as tol)',
    onclick: () => { if (s !== side) ctx.commitAndRender(toEdit(toleranceFields(s, input.value))); } }, label)));
  return h('span', { class: 'tolfield' }, h('span', {}, '±'), input, seg);
}
