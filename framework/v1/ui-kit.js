// UI kit (framework v1): standard Controls and small building blocks, styled by theme.css.
//
// Every Control factory returns a Control (see tool.js) whose `el` the Tool places in its layout.
// `name` is the plain-text accessible name (e.g. 'Va'); `label` is optional trusted HTML shown
// to the student (e.g. 'V<sub>a</sub>'), defaulting to the name. `toggle` and `button` also take
// optional `onLock(locked)` / `onHide(hidden)` for extra work on lock or hide (see control.js).

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

/** Escape text for HTML or XML markup (& < > " ' as numeric character references). */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Slider paired with a number box and a reset button.
 * slider({ id, name, label, unit, min, max, step, value, reset = value, decimals = 2, log = false, onChange })
 *   log: the range input moves on a logarithmic scale (min > 0), for values spanning decades
 *        such as a frequency; dragging it rounds to 3 significant digits. The number box and
 *        get/set stay in plain units.
 */
export function slider({ id, name = id, label, unit = '', min, max, step = 'any', value, reset = value,
  decimals = 2, log = false, onChange = () => {} }) {
  let current = clamp(Number(value), min, max);

  const range = log
    ? h('input', { type: 'range', class: 'fw-range', min: Math.log10(min), max: Math.log10(max), step: 'any',
      'aria-label': name })
    : h('input', { type: 'range', class: 'fw-range', min, max, step, 'aria-label': name });
  const num = h('input', { type: 'number', class: 'fw-number', min, max, step, 'aria-label': name });
  const resetBtn = h('button', { type: 'button', class: 'fw-reset', 'aria-label': `Reset ${name}`,
    title: `Reset to ${reset}` }, `↻ ${reset}`);

  const el = h('div', { class: 'fw-slider' },
    h('div', { class: 'fw-slider-header' }, nameLabel(name, label, unit), num),
    h('div', { class: 'fw-slider-row' }, range, resetBtn));

  function render() {
    range.value = String(log ? Math.log10(current) : current);
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

  range.addEventListener('input', () => set(log ? Number((10 ** Number(range.value)).toPrecision(3)) : range.value));
  num.addEventListener('keydown', (e) => { if (e.key === 'Enter') commitNumber(); });
  num.addEventListener('change', commitNumber);
  resetBtn.addEventListener('click', () => set(reset));
  render();

  return createControl({ id, label: name, el, get: () => current, set });
}

/** Checkbox toggle. toggle({ id, name, label, value = false, onChange, onLock, onHide }) */
export function toggle({ id, name = id, label, value = false, onChange = () => {}, onLock, onHide }) {
  const input = h('input', { type: 'checkbox', 'aria-label': name });
  input.checked = Boolean(value);
  const el = h('label', { class: 'fw-toggle' }, input, nameLabel(name, label));
  const set = (v) => { input.checked = Boolean(v); onChange(input.checked); };
  input.addEventListener('change', () => onChange(input.checked));
  return createControl({ id, label: name, el, get: () => input.checked, set, onLock, onHide });
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
 * Push button. button({ id, name, label, title, onClick, onLock, onHide })
 * get() returns how many times it has been pressed; set() presses it. A locked button is
 * disabled, and neither a click nor set() presses it.
 */
export function button({ id, name = id, label, title, onClick = () => {}, onLock, onHide }) {
  let presses = 0;
  const btn = h('button', { type: 'button', class: 'fw-button', 'aria-label': name, title, html: label ?? escapeHtml(name) });
  const press = () => { if (ctl.isLocked()) return; presses += 1; onClick(presses); };
  btn.addEventListener('click', press);
  const ctl = createControl({ id, label: name, el: btn, get: () => presses, set: press, onLock, onHide });
  return ctl;
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

// The :root values of theme.css, used while an element is not in a page (keep the two in step).
const PALETTE = {
  '--fw-page': '#D8D0BC', '--fw-bg': '#F2EFE4', '--fw-surface': '#FAF8F2', '--fw-paper': '#FFFFFF',
  '--fw-border': '#C8BFA0', '--fw-border-dk': '#8B7D5E', '--fw-blue': '#1B4F8A', '--fw-blue-dk': '#13376A',
  '--fw-red': '#B81C1C', '--fw-orange': '#E8720C', '--fw-yellow': '#8A5F00', '--fw-hint-bg': '#FBF3DF',
  '--fw-green': '#2A6E2A', '--fw-text': '#1A1008', '--fw-text-dim': '#5C4F38', '--fw-text-muted': '#6E604A',
  '--fw-grid': '#DDD5C0', '--fw-font': "'Libre Baskerville', Georgia, serif",
};

/**
 * Theme variables as computed at `el`, for drawing colours that CSS can't reach (canvas, SVG
 * rendered to PNG, Plotly). themeVars(el, { accent: '--fw-blue', ink: '--fw-text' })
 * -> { accent: '#1B4F8A', ink: '#1A1008' }. A variable the page doesn't set, or every one while
 * el is not in a page, falls back to the v1 palette.
 */
export function themeVars(el, names) {
  const css = el?.isConnected ? el.ownerDocument.defaultView.getComputedStyle(el) : null;
  const out = {};
  for (const [key, name] of Object.entries(names)) out[key] = css?.getPropertyValue(name).trim() || PALETTE[name] || '';
  return out;
}

/** Titled section of the Controls column. */
export function section(title, ...children) {
  return h('div', { class: 'fw-section' }, h('div', { class: 'fw-section-label' }, title), ...children);
}

// The draggable handle (1-D and 2-D) and the rotary knob live in handle.js.
export { handle, knob } from './handle.js';
