// UI kit (framework v1): standard Controls and small building blocks, styled by theme.css.
//
// Every Control factory returns a Control (see tool.js) whose `el` the Tool places in its layout.
// `name` is the plain-text accessible name (e.g. 'Va'); `label` is optional trusted HTML shown
// to the student (e.g. 'V<sub>a</sub>'), defaulting to the name.

import { createControl } from './control.js';

/** Create an element: h('div', { class: 'x', 'aria-label': 'y' }, child, 'text', ...) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function nameLabel(name, label, unit) {
  return h('span', { class: 'fw-control-name', html: label ?? escapeHtml(name) },
    unit ? h('span', { class: 'fw-unit' }, ' ', unit) : null);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Slider paired with a number box and a reset button.
 * slider({ id, name, label, unit, min, max, step, value, reset = value, decimals = 2, onChange })
 */
export function slider({ id, name = id, label, unit = '', min, max, step = 'any', value, reset = value,
  decimals = 2, onChange = () => {} }) {
  let current = clamp(Number(value), min, max);

  const range = h('input', { type: 'range', class: 'fw-range', min, max, step, 'aria-label': name });
  const num = h('input', { type: 'number', class: 'fw-number', min, max, step, 'aria-label': name });
  const resetBtn = h('button', { type: 'button', class: 'fw-reset', 'aria-label': `Reset ${name}`,
    title: `Reset to ${reset}` }, `↻ ${reset}`);

  const el = h('div', { class: 'fw-slider' },
    h('div', { class: 'fw-slider-header' }, nameLabel(name, label, unit), num),
    h('div', { class: 'fw-slider-row' }, range, resetBtn));

  function render() {
    range.value = String(current);
    num.value = current.toFixed(decimals);
    num.classList.remove('fw-invalid');
  }

  function set(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    current = clamp(n, min, max);
    render();
    onChange(current);
  }

  function commitNumber() {
    const n = parseFloat(num.value);
    if (Number.isNaN(n)) { num.classList.add('fw-invalid'); return; }
    set(n);
  }

  range.addEventListener('input', () => set(range.value));
  num.addEventListener('keydown', (e) => { if (e.key === 'Enter') commitNumber(); });
  num.addEventListener('change', commitNumber);
  resetBtn.addEventListener('click', () => set(reset));
  render();

  return createControl({ id, label: name, el, get: () => current, set });
}

/** Checkbox toggle. toggle({ id, name, label, value = false, onChange }) */
export function toggle({ id, name = id, label, value = false, onChange = () => {} }) {
  const input = h('input', { type: 'checkbox', 'aria-label': name });
  input.checked = Boolean(value);
  const el = h('label', { class: 'fw-toggle' }, input, nameLabel(name, label));
  const set = (v) => { input.checked = Boolean(v); onChange(input.checked); };
  input.addEventListener('change', () => onChange(input.checked));
  return createControl({ id, label: name, el, get: () => input.checked, set });
}

/** Drop-down select. select({ id, name, label, options: [{ value, label }], value, onChange }) */
export function select({ id, name = id, label, options, value = options[0]?.value, onChange = () => {} }) {
  const sel = h('select', { 'aria-label': name },
    options.map((o) => h('option', { value: o.value }, o.label ?? String(o.value))));
  sel.value = String(value);
  const el = h('label', { class: 'fw-select' }, nameLabel(name, label), sel);
  const valueOf = () => options.find((o) => String(o.value) === sel.value)?.value;
  const set = (v) => {
    if (!options.some((o) => String(o.value) === String(v))) return;
    sel.value = String(v);
    onChange(valueOf());
  };
  sel.addEventListener('change', () => onChange(valueOf()));
  return createControl({ id, label: name, el, get: valueOf, set });
}

/**
 * Push button. button({ id, name, label, onClick })
 * get() returns how many times it has been pressed; set() presses it.
 */
export function button({ id, name = id, label, onClick = () => {} }) {
  let presses = 0;
  const btn = h('button', { type: 'button', class: 'fw-button', 'aria-label': name, html: label ?? escapeHtml(name) });
  const press = () => { presses += 1; onClick(presses); };
  btn.addEventListener('click', press);
  return createControl({ id, label: name, el: btn, get: () => presses, set: press });
}

/**
 * Read-only metric readout (not a Control). metric({ name, label, format })
 * Returns { el, update(value) }. The value element has role="status" named `name`.
 */
export function metric({ name, label, format = String }) {
  const value = h('span', { class: 'fw-metric-value', role: 'status', 'aria-label': name }, '—');
  const el = h('div', { class: 'fw-metric' }, h('span', { html: label ?? escapeHtml(name) }), ': ', value);
  return { el, update(v) { value.textContent = format(v); } };
}

/** Titled section of the Controls column. */
export function section(title, ...children) {
  return h('div', { class: 'fw-section' }, h('div', { class: 'fw-section-label' }, title), ...children);
}
