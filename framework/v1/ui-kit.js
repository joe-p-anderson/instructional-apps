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
    unit ? h('span', { class: 'fw-unit' }, ` (${unit})`) : null);
}

/** Plain text of trusted label HTML ('<i>v</i>/<i>c</i>' -> 'v/c'). */
function labelText(label) {
  const tmp = document.createElement('span');
  tmp.innerHTML = label;
  return tmp.textContent;
}

/** Escape text for HTML or XML markup (& < > " ' as numeric character references). */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Reset button, the slider's: an icon-only ↻ named and titled "Reset to <text>".
 * resetButton({ text, onReset, atDefault, isLocked }) -> { el, sync() }
 *   sync() disables it while atDefault() or isLocked() is true; call it after every change of
 *   value and on lock and unlock (a Control's onLock), so lock behaves the same in every Control.
 */
export function resetButton({ text, onReset = () => {}, atDefault = () => false, isLocked = () => false }) {
  const name = `Reset to ${text}`;
  const el = h('button', { type: 'button', class: 'fw-reset', 'aria-label': name, title: name }, '↻');
  el.addEventListener('click', () => onReset());
  return { el, sync() { el.disabled = isLocked() || atDefault(); } };
}

/**
 * Number box, the slider's. numberBox({ name, min, max, step = 'any', width, onCommit(n) }) -> { el, show(text) }
 *   onCommit(n) runs when the student enters a new number (Enter or change). A box still showing
 *   the text it was last shown with is not committed, so rounding never feeds back into a value;
 *   a box that isn't a number is marked invalid (aria-invalid) instead. show(text) displays a value.
 */
export function numberBox({ name, min, max, step = 'any', width, onCommit = () => {} }) {
  const el = h('input', { type: 'number', class: 'fw-number', min, max, step, 'aria-label': name,
    style: width ? `width:${width}` : null });
  let shown = null;
  const invalid = (bad) => {
    el.classList.toggle('fw-invalid', bad);
    if (bad) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  };
  const commit = () => {
    if (el.value === shown) return;
    const n = parseFloat(el.value);
    if (Number.isNaN(n)) { invalid(true); return; }
    shown = el.value; // Enter then change commits once
    onCommit(n);
  };
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
  el.addEventListener('change', commit);
  return { el, show(text) { el.value = text; shown = el.value; invalid(false); } };
}

/**
 * Slider paired with a number box and a reset button.
 * slider({ id, name, label, unit, min, max, step, value, reset = value, decimals = 2, log = false, onChange })
 *   The label reads "Label (unit)"; both inputs are named "name (unit)", where name defaults to
 *   the label's text (then the id). The reset is an icon-only ↻ named "Reset to <reset> <unit>",
 *   disabled while the value equals the reset value.
 *   log: the range input moves on a logarithmic scale (min > 0), for values spanning decades
 *        such as a frequency; dragging it rounds to 3 significant digits. The number box and
 *        get/set stay in plain units.
 *   valueText(v): optional; returns the text for a value that a number can't show (such as '∞'
 *        for a top position past the last number), or undefined for a plain value. At such a
 *        value the range's aria-valuetext is that text and the number box is empty, with the
 *        text as its placeholder and aria-valuetext. get/set still use the number.
 */
export function slider({ id, label, name = label != null ? labelText(label) : id, unit = '', min, max,
  step = 'any', value, reset = value, decimals = 2, log = false, valueText = () => undefined, onChange = () => {} }) {
  let current = clamp(Number(value), min, max);

  const a11yName = unit ? `${name} (${unit})` : name;
  const range = log
    ? h('input', { type: 'range', class: 'fw-range', min: Math.log10(min), max: Math.log10(max), step: 'any',
      'aria-label': a11yName })
    : h('input', { type: 'range', class: 'fw-range', min, max, step, 'aria-label': a11yName });
  const num = numberBox({ name: a11yName, min, max, step, onCommit: (n) => set(n) });
  const resetBtn = resetButton({ text: `${reset}${unit ? ` ${unit}` : ''}`, onReset: () => set(reset),
    atDefault: () => current === clamp(Number(reset), min, max), isLocked: () => ctl.isLocked() });

  const el = h('div', { class: 'fw-slider', role: 'group', 'aria-label': a11yName },
    h('div', { class: 'fw-slider-header' }, nameLabel(name, label, unit), num.el),
    h('div', { class: 'fw-slider-row' }, range, resetBtn.el));

  function render() {
    range.value = String(log ? Math.log10(current) : current);
    const text = valueText(current);
    num.show(text == null ? current.toFixed(decimals) : '');
    for (const el of [range, num.el]) {
      if (text == null) el.removeAttribute('aria-valuetext'); else el.setAttribute('aria-valuetext', text);
    }
    if (text == null) num.el.removeAttribute('placeholder'); else num.el.setAttribute('placeholder', text);
    resetBtn.sync();
  }

  function set(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    current = clamp(n, min, max);
    render();
    onChange(current);
  }

  range.addEventListener('input', () => set(log ? Number((10 ** Number(range.value)).toPrecision(3)) : range.value));

  // Lock disables the reset with the inputs; unlock leaves it disabled at the default.
  const ctl = createControl({ id, label: name, el, get: () => current, set, onLock: () => resetBtn.sync() });
  render();
  return ctl;
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
  // Plot tokens (plot-theme.js), resolved.
  '--fw-plot-bg': '#FAF8F2', '--fw-plot-grid': '#DDD5C0', '--fw-plot-axis': '#8B7D5E', '--fw-plot-text': '#5C4F38',
  '--fw-plot-ink': '#1A1008', '--fw-plot-muted': '#C8BFA0', '--fw-plot-trace-1': '#1B4F8A',
  '--fw-plot-trace-2': '#B81C1C', '--fw-plot-trace-3': '#E8720C',
  '--fw-plot-font': "'Libre Baskerville', Georgia, serif", '--fw-plot-font-size': '13px',
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

let menuCount = 0;

/**
 * Menu button (the WAI-ARIA menu button pattern): a button that opens a list of actions.
 * menuButton({ label = '⋯', name = 'More actions', items = [] })
 *   items: [{ id, label, onSelect }]. Add more later with add(item, { before }), where before is
 *   the id of an item to insert ahead of (default: at the end).
 *   Returns { el, button, menu, add(item, opts) -> menuitem element, item(id) -> element, open(), close() }.
 *   Hide an item with item(id).hidden = true; the keyboard skips hidden items.
 * Keys: Enter, Space or ArrowDown on the button open it on the first item, ArrowUp on the last;
 * ArrowDown/ArrowUp (wrapping), Home and End move; Escape closes it and returns focus to the
 * button; Tab closes it. Choosing an item closes the menu and returns focus to the button before
 * onSelect runs, so a confirm() or print() it opens starts from the button. A click outside closes it.
 */
export function menuButton({ label = '⋯', name = 'More actions', items = [] } = {}) {
  const menuId = `fw-menu-${++menuCount}`;
  const button = h('button', { type: 'button', class: 'fw-button fw-menu-button', 'aria-label': name, title: name,
    'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': menuId }, label);
  const menu = h('div', { class: 'fw-menu', role: 'menu', id: menuId, 'aria-label': name, hidden: true });
  const el = h('div', { class: 'fw-menu-wrap' }, button, menu);
  const byId = {};

  const visible = () => [...menu.children].filter((i) => !i.hidden);
  const focusAt = (i) => { const list = visible(); if (list.length) list[(i + list.length) % list.length].focus(); };
  const isOpen = () => !menu.hidden;

  function open(at = 0) {
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outside, true);
    focusAt(at);
  }
  function close(returnFocus = false) {
    if (!isOpen()) return;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
    if (returnFocus) button.focus();
  }
  function outside(e) { if (!el.contains(e.target)) close(); }

  button.addEventListener('click', () => (isOpen() ? close() : open(0)));
  button.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    open(e.key === 'ArrowDown' ? 0 : -1);
  });
  menu.addEventListener('keydown', (e) => {
    const i = visible().indexOf(document.activeElement);
    const moves = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: -1 };
    if (e.key in moves) { e.preventDefault(); focusAt(moves[e.key]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') close();
  });

  function add({ id, label: text, onSelect = () => {} }, { before } = {}) {
    const item = h('button', { type: 'button', class: 'fw-menu-item', role: 'menuitem', tabindex: '-1' }, text);
    item.addEventListener('click', () => { close(true); onSelect(); });
    menu.insertBefore(item, (before && byId[before]) || null);
    byId[id] = item;
    return item;
  }
  for (const item of items) add(item);

  return { el, button, menu, add, item: (id) => byId[id], open, close: () => close(true) };
}
