// The tolerance field (spec, "Tolerances"): one number with a unit / % switch. Needs a DOM.
// Shared by the numeric Questions and the Condition builder's target ± tolerance.
//
// toleranceField(ctx, { label, path, owner, unit?, toEdit }) -> [label, input, switch]
//   ctx is the TaskContext (task-form.js); path is the data-path of the number, so a problem
//   jumps to it; owner is the object holding tol / relTol; unit names the unit side (the State's
//   unit, else 'units'); toEdit({ tol, relTol }) -> the edit that sets both keys (undefined
//   removes one). Typing writes the current side's key; flipping the switch writes the number
//   shown to the other side's key and clears the first (tolerance.js has the arithmetic).

import { h } from '../../ui-kit.js';
import { SIDES, toleranceText, toleranceValues } from './tolerance.js';

let visits = 0; // one undo group per click on the switch

export function toleranceField(ctx, { label, path, owner, unit, toEdit }) {
  let { side, text } = toleranceText(owner);
  const [fieldLabel, input] = ctx.field({ label, path, value: text, class: 't num mono', inputmode: 'decimal',
    toEdit: (v) => toEdit(toleranceValues(side, v)) });
  const words = { unit: unit || 'units', percent: '%' };
  const buttons = SIDES.map((s) => h('button', { type: 'button', 'data-side': s, 'aria-pressed': String(s === side),
    onclick: () => {
      if (s === side) return;
      side = s;
      for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.side === side));
      visits += 1;
      ctx.commit(toEdit(toleranceValues(side, input.value)), { group: `${path}#side${visits}` });
    } }, words[s]));
  const toggle = h('span', { class: 'seg small', role: 'group', 'aria-label': `${label} in` }, ...buttons);
  return [fieldLabel, input, toggle];
}
