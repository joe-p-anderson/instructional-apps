// Phasors Tool: a labelled number input as a v1 Control (the kit's number box, without a range).
//
// numberInput({ id, name, label, unit, min, max, value, decimals, normalize, onChange })
//   The box is named "name (unit)". get() is the value; set(v) takes any number, normalizes it
//   (default: clamp to [min, max]) and calls onChange(value); a non-number is ignored.
//   update(v) sets and shows a value without calling onChange (for a view of the same value,
//   such as a drag handle, that has already reported it).

import { createControl } from '../../framework/v1/control.js';
import { h, numberBox } from '../../framework/v1/ui-kit.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function numberInput({ id, name, label = name, unit = '', min, max, value, decimals = 2,
  normalize = (v) => clamp(v, min, max), onChange = () => {} }) {
  const a11yName = unit ? `${name} (${unit})` : name;
  let current = normalize(Number(value));
  const box = numberBox({ name: a11yName, min, max, step: 'any', width: '6em', onCommit: (n) => set(n) });
  const el = h('label', { class: 'ph-number' },
    h('span', { class: 'ph-number-label', html: unit ? `${label} (${unit})` : label }), box.el);

  const show = () => box.show(Number(current.toFixed(decimals)).toString());
  function update(v) {
    const n = Number(v);
    if (v === null || v === '' || !Number.isFinite(n)) return false;
    current = normalize(n);
    show();
    return true;
  }
  function set(v) { if (update(v)) onChange(current); }

  show();
  const ctl = createControl({ id, label: a11yName, el, get: () => current, set });
  ctl.update = update;
  return ctl;
}
