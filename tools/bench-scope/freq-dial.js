// A frequency Control laid out like an analog function generator: a decade Range selector
// and a linear dial that sweeps the chosen range from 1/10 of it up to its top.
//
// freqDial({ id, name, label, limits: [min, max], value, reset, onChange })
//   -> { control, rangeControl }
//   control       the frequency Control (id), get/set in Hz. Setting a frequency outside the
//                 current range moves to the smallest range that holds it. Its el holds the
//                 whole composite, so locking or hiding it covers the range selector too.
//   rangeControl  the Range selector (id + '-range'), get/set the range's top in Hz. Changing
//                 the range keeps the dial position and scales the frequency by the same factor.
//
// The dial steps in 1/1000 of the range (arrow keys), so a 1 kHz range moves 1 Hz per step.
// The number box accepts any frequency within the limits.

import { createControl } from '../../framework/v1/control.js';
import { h } from '../../framework/v1/ui-kit.js';

const STEPS = 1000;

function fmtHz(f) {
  if (f >= 1e6) return `${f / 1e6} MHz`;
  if (f >= 1e3) return `${f / 1e3} kHz`;
  return `${f} Hz`;
}

/** Decade range tops covering [min, max]: e.g. [1, 100e3] -> 10, 100, 1k, 10k, 100k. */
function rangeTops([min, max]) {
  const tops = [];
  for (let e = Math.floor(Math.log10(min)) + 1; 10 ** e <= max * (1 + 1e-9); e += 1) tops.push(10 ** e);
  return tops;
}

const decimalsFor = (top) => Math.max(0, -Math.floor(Math.log10(top / STEPS)));

export function freqDial({ id, name = id, label, limits, value, reset = value, onChange = () => {} }) {
  const [min, max] = limits;
  const tops = rangeTops(limits);
  const clampHz = (f) => Math.min(max, Math.max(min, f));
  const fitTop = (f) => tops.find((t) => f <= t * (1 + 1e-9)) ?? tops[tops.length - 1];
  const roundTo = (f, top) => Number(f.toFixed(decimalsFor(top)));

  let current = clampHz(Number(value));
  let top = fitTop(current);

  const rangeSel = h('select', { class: 'bs-freq-range', 'aria-label': `${name} range`, title: 'Range' },
    tops.map((t) => h('option', { value: String(t) }, fmtHz(t))));
  // Lock disables the inputs inside a Control's el, so the selector needs a wrapper of its own.
  const rangeWrap = h('span', { class: 'bs-freq-range-wrap' }, rangeSel);
  const dial = h('input', { type: 'range', class: 'fw-range', 'aria-label': name });
  const num = h('input', { type: 'number', class: 'fw-number', min, max, step: 'any', 'aria-label': name });
  const resetBtn = h('button', { type: 'button', class: 'fw-reset', 'aria-label': `Reset ${name}`,
    title: `Reset to ${reset}` }, `↻ ${reset}`);

  const el = h('div', { class: 'fw-slider bs-freq-dial' },
    h('div', { class: 'fw-slider-header' },
      h('span', { class: 'fw-control-name', html: label ?? name }, h('span', { class: 'fw-unit' }, ' Hz')), num),
    h('div', { class: 'fw-slider-row' }, rangeWrap, dial, resetBtn));

  function render() {
    rangeSel.value = String(top);
    const lo = Math.max(min, top / 10);
    dial.min = String(lo);
    dial.max = String(Math.min(max, top));
    dial.step = String(top / STEPS);
    dial.value = String(current);
    num.value = current.toFixed(decimalsFor(top));
    num.classList.remove('fw-invalid');
  }

  function apply(f, keepRange = false) {
    current = roundTo(clampHz(f), top);
    if (!keepRange && (current > top * (1 + 1e-9) || current < top / 10 * (1 - 1e-9))) top = fitTop(current);
    current = roundTo(current, top);
    render();
    onChange(current);
  }

  function set(v) {
    const n = Number(v);
    if (Number.isFinite(n)) apply(n);
  }

  function setRange(v) {
    const t = Number(v);
    if (!tops.includes(t) || t === top) { render(); return; }
    const scaled = current * (t / top);
    top = t;
    apply(Math.min(Math.min(max, t), Math.max(Math.max(min, t / 10), scaled)), true);
  }

  function commitNumber() {
    const n = parseFloat(num.value);
    if (Number.isNaN(n)) { num.classList.add('fw-invalid'); return; }
    set(n);
  }

  dial.addEventListener('input', () => apply(Number(dial.value), true));
  rangeSel.addEventListener('change', () => setRange(rangeSel.value));
  num.addEventListener('keydown', (e) => { if (e.key === 'Enter') commitNumber(); });
  num.addEventListener('change', commitNumber);
  resetBtn.addEventListener('click', () => set(reset));
  render();

  return {
    control: createControl({ id, label: name, el, get: () => current, set }),
    rangeControl: createControl({ id: `${id}-range`, label: `${name} range`, el: rangeWrap, get: () => top, set: setRange }),
  };
}
