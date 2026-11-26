// Custom Controls for the electrostatics Tool, shared by its Modes:
//   e0Joystick  the applied field E₀: a joystick (|E₀| ≤ E0_MAX) with E₀x / E₀y boxes and a reset
//   arcPicker   the angle θ (0 to π/2): a quarter-arc picker with a number box and a reset
// Both are full Controls (createControl): lock disables the boxes, the reset and the pad;
// hide hides the whole group. Each pad is the kit's handle (a 2-D handle for the joystick, a 1-D
// one for the arc), so it can be focused and moved with the arrow keys (Shift for bigger steps)
// and dragged with any pointer without scrolling the page; a press anywhere on the pad also jumps
// the value there. The resets follow the kit slider's: an icon-only ↻ named "Reset to …",
// disabled at the default. Canvas colours come from the theme variables; each Control also has
// redraw(), to call once its element is in the page so the canvas can read them.

import { createControl } from '../../framework/v1/control.js';
import { h, handle } from '../../framework/v1/ui-kit.js';
import { E0_MAX, clamp, limitE0 } from './conductor.js';
import { plotColors } from './plot.js';

/**
 * A square canvas of `size` CSS pixels drawn at the device pixel ratio, inside a wrapper element
 * that becomes the pad's kit handle. local(clientX, clientY) -> CSS pixels from the canvas's top left.
 */
function pad(size) {
  const canvas = h('canvas', { 'aria-hidden': 'true', style: `width:${size}px;height:${size}px` });
  const el = h('div', { class: 'es-pad' }, canvas);
  const dpr = globalThis.devicePixelRatio || 1;
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const local = (cx, cy) => { const r = canvas.getBoundingClientRect(); return [cx - r.left, cy - r.top]; };
  function context() {
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    return ctx;
  }
  return { el, local, context };
}

/** The kit handle drags only from the handle itself; a press on the pad also jumps there. */
function jumpOnPress(stick, fromScreen) {
  stick.el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || stick.isLocked()) return;
    stick.set(fromScreen(e.clientX, e.clientY));
  });
}

/** The kit slider's reset: an icon-only ↻ named and titled "Reset to <text>". */
function resetButton(text) {
  const name = `Reset to ${text}`;
  return h('button', { type: 'button', class: 'fw-reset', 'aria-label': name, title: name }, '↻');
}

function numberBox(name, { min, max, step, width }) {
  return h('input', { type: 'number', class: 'fw-number', min, max, step, 'aria-label': name,
    style: width ? `width:${width}` : null });
}

/**
 * Call commit() when the student enters a new value (Enter or change). A box still showing the
 * rounded value it was rendered with is not committed, so rounding never feeds back into the value.
 */
function onCommit(input, commit) {
  const go = () => { if (input.value !== input.dataset.shown) commit(); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  input.addEventListener('change', go);
}

function show(input, text) {
  input.value = text;
  input.dataset.shown = text;
  input.classList.remove('fw-invalid');
}

const JOY_SIZE = 106;
const JOY_C = 53;
const JOY_R = 46;

/**
 * E₀ joystick paired with E₀x / E₀y boxes and a reset button.
 * e0Joystick({ id, name = 'E₀', value: { x, y }, reset = { x: 0, y: 0 }, onChange({ x, y }) })
 * get() -> { x, y } in V/m; set({ x, y }) applies it, scaled back to |E₀| ≤ E0_MAX.
 * Typing into either box, or moving the joystick with the keys (10 V/m a step, 100 with Shift),
 * keeps the magnitude within E0_MAX the same way.
 */
export function e0Joystick({ id, name = 'E₀', value = { x: 0, y: 0 }, reset = { x: 0, y: 0 }, onChange = () => {} }) {
  let current = { x: 0, y: 0 };
  let control = null;
  const isLocked = () => control?.isLocked() ?? false;

  const board = pad(JOY_SIZE);
  const fromScreen = (cx, cy) => {
    const [px, py] = board.local(cx, cy);
    let dx = px - JOY_C;
    let dy = -(py - JOY_C);
    const r = Math.hypot(dx, dy);
    if (r > JOY_R) { dx = dx / r * JOY_R; dy = dy / r * JOY_R; }
    return { x: Math.round(dx / JOY_R * E0_MAX), y: Math.round(dy / JOY_R * E0_MAX) };
  };
  const axis = (s) => ({ name: `${name}${s}`, unit: 'V/m', min: -E0_MAX, max: E0_MAX, step: 10, coarse: 100, decimals: 0 });
  const stick = handle({ id: `${id}-joystick`, name: `${name} joystick`, el: board.el, x: axis('x'), y: axis('y'),
    value: current, fromScreen, onChange: (v) => set(v) });
  jumpOnPress(stick, fromScreen);

  const boxX = numberBox(`${name}x`, { min: -E0_MAX, max: E0_MAX, step: 10, width: '100%' });
  const boxY = numberBox(`${name}y`, { min: -E0_MAX, max: E0_MAX, step: 10, width: '100%' });
  const resetBtn = resetButton(`(${reset.x}, ${reset.y}) V/m`);

  const sub = (s) => `${name.replace('₀', '<sub>0</sub>')}<sub>${s}</sub>`;
  const el = h('div', { class: 'es-joystick' },
    h('div', { class: 'es-pad-wrap' }, board.el,
      h('div', { class: 'es-caption' }, `Drag or use the arrow keys — max |${name}| = ${E0_MAX} V/m`)),
    h('div', { class: 'es-pair' },
      h('label', {}, h('span', { class: 'es-box-label', html: `${sub('x')} V/m` }), boxX),
      h('label', {}, h('span', { class: 'es-box-label', html: `${sub('y')} V/m` }), boxY),
      resetBtn));

  function draw() {
    const C = plotColors(el);
    const ctx = board.context();
    ctx.beginPath(); ctx.arc(JOY_C, JOY_C, JOY_R, 0, 2 * Math.PI);
    ctx.strokeStyle = C.borderDk; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(JOY_C - JOY_R, JOY_C); ctx.lineTo(JOY_C + JOY_R, JOY_C);
    ctx.moveTo(JOY_C, JOY_C - JOY_R); ctx.lineTo(JOY_C, JOY_C + JOY_R);
    ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.stroke();
    const frac = Math.min(Math.hypot(current.x, current.y) / E0_MAX, 1);
    const ang = Math.atan2(current.y, current.x);
    ctx.beginPath(); ctx.arc(JOY_C + Math.cos(ang) * frac * JOY_R, JOY_C - Math.sin(ang) * frac * JOY_R, 7, 0, 2 * Math.PI);
    ctx.fillStyle = isLocked() ? C.border : C.blue; ctx.fill();
    ctx.strokeStyle = C.text; ctx.lineWidth = 1.5; ctx.stroke();
  }

  const syncReset = () => { resetBtn.disabled = isLocked() || (current.x === reset.x && current.y === reset.y); };

  function render() {
    show(boxX, current.x.toFixed(0));
    show(boxY, current.y.toFixed(0));
    stick.update(current);
    syncReset();
    draw();
  }

  function apply(v) {
    const x = Number(v?.x);
    const y = Number(v?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const [lx, ly] = limitE0(clamp(x, -E0_MAX, E0_MAX), clamp(y, -E0_MAX, E0_MAX));
    current = { x: lx, y: ly };
    render();
    return true;
  }

  function set(v) { if (apply(v)) onChange({ ...current }); }

  const commit = (box, key) => () => {
    const n = parseFloat(box.value);
    if (Number.isNaN(n)) { box.classList.add('fw-invalid'); return; }
    set({ ...current, [key]: n });
  };
  onCommit(boxX, commit(boxX, 'x'));
  onCommit(boxY, commit(boxY, 'y'));
  resetBtn.addEventListener('click', () => set(reset));

  apply(value);
  control = createControl({ id, label: name, el, get: () => ({ ...current }), set,
    onLock: (locked) => { if (locked) stick.lock(); else stick.unlock(); syncReset(); draw(); } });
  control.redraw = draw; // once in the page, so the theme colours are read
  return control;
}

const ARC_SIZE = 86;
const ARC_CX = 30;
const ARC_CY = 72;
const ARC_R = 34;

/**
 * θ arc picker paired with a number box and a reset button.
 * arcPicker({ id, name = 'θ', value = 0, reset = 0, onChange(theta) })
 * The handle runs over a quarter arc from straight up (θ = 0, ⊥ to Ê₀) to the right
 * (θ = π/2, ∥ to Ê₀); the arrow keys move it 0.01 rad (0.1 with Shift), Home/End to the ends.
 * get() -> θ in rad; set(θ) clamps to [0, π/2].
 */
export function arcPicker({ id, name = 'θ', value = 0, reset = 0, onChange = () => {} }) {
  let current = 0;
  let control = null;
  const isLocked = () => control?.isLocked() ?? false;

  const board = pad(ARC_SIZE);
  const fromScreen = (cx, cy) => {
    const [px, py] = board.local(cx, cy);
    return Math.PI / 2 - clamp(Math.atan2(-(py - ARC_CY), px - ARC_CX), 0, Math.PI / 2);
  };
  const knob = handle({ id: `${id}-arc`, name: `${name} arc picker`, el: board.el, unit: 'rad',
    min: 0, max: Math.PI / 2, step: 0.01, coarse: 0.1, decimals: 2, value: current, fromScreen,
    onChange: (v) => set(v) });
  jumpOnPress(knob, fromScreen);

  const box = numberBox(name, { min: 0, max: 1.5708, step: 0.01, width: '72px' });
  const resetBtn = resetButton(`${reset} rad`);
  const el = h('div', { class: 'es-arc' },
    h('div', { class: 'fw-slider-header' },
      h('span', { class: 'fw-control-name' }, name, h('span', { class: 'fw-unit' }, ' rad')),
      h('span', { class: 'es-box-row' }, box, resetBtn)),
    h('div', { class: 'es-arc-row' }, board.el,
      h('div', { class: 'es-caption es-arc-caption', html:
        `↑ ${name} = 0 : ⊥ to <i>Ê</i><sub>0</sub><br>→ ${name} = π/2 : ∥ to <i>Ê</i><sub>0</sub>` })));

  function draw() {
    const C = plotColors(el);
    const ctx = board.context();
    ctx.beginPath(); ctx.arc(ARC_CX, ARC_CY, ARC_R, -Math.PI / 2, 0);
    ctx.strokeStyle = C.border; ctx.lineWidth = 3; ctx.stroke();
    ctx.font = '10px serif'; ctx.fillStyle = C.muted; ctx.textAlign = 'center';
    ctx.fillText('⊥', ARC_CX, ARC_CY - ARC_R - 15);
    ctx.fillText('∥', ARC_CX + ARC_R + 15, ARC_CY + 3);
    ctx.beginPath();
    ctx.moveTo(ARC_CX, ARC_CY); ctx.lineTo(ARC_CX, ARC_CY - ARC_R - 2);
    ctx.moveTo(ARC_CX, ARC_CY); ctx.lineTo(ARC_CX + ARC_R + 2, ARC_CY);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.stroke();
    const a = Math.PI / 2 - current;
    ctx.beginPath(); ctx.arc(ARC_CX + ARC_R * Math.cos(a), ARC_CY - ARC_R * Math.sin(a), 7, 0, 2 * Math.PI);
    ctx.fillStyle = isLocked() ? C.border : C.blue; ctx.fill();
    ctx.strokeStyle = C.text; ctx.lineWidth = 1.5; ctx.stroke();
  }

  const syncReset = () => { resetBtn.disabled = isLocked() || current === clamp(Number(reset), 0, Math.PI / 2); };

  function apply(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return false;
    current = clamp(n, 0, Math.PI / 2);
    show(box, current.toFixed(2));
    knob.update(current);
    syncReset();
    draw();
    return true;
  }
  function set(v) { if (apply(v)) onChange(current); }

  onCommit(box, () => {
    const n = parseFloat(box.value);
    if (Number.isNaN(n)) { box.classList.add('fw-invalid'); return; }
    set(n);
  });
  resetBtn.addEventListener('click', () => set(reset));

  apply(value);
  control = createControl({ id, label: name, el, get: () => current, set,
    onLock: (locked) => { if (locked) knob.lock(); else knob.unlock(); syncReset(); draw(); } });
  control.redraw = draw; // once in the page, so the theme colours are read
  return control;
}
