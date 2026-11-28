// Phasors Tool, Sum Mode: add two same-frequency sinusoids as phasors.
//
// Setup: { A1, phi1, A2, phi2, omega } (any subset; DEFAULTS below).
// State (state.snapshot(), each with a label and unit in describe()): mode ('sum'), A1 (V),
//   phi1 (°), A2 (V), phi2 (°), the resultant A (V), phi (°) (published even while its layer is
//   hidden), showSum (the resultant's toggle), and the time State omega (rad/s), f (Hz, ω/2π),
//   t (s), playing (../time-controls.js).
// Controls: number inputs 'A1', 'A2' (V, 0 to A_MAX) and 'phi1', 'phi2' (°, any number, wrapped
//   into (−180, 180]). Each also has update(v), which sets and shows it without reporting.
//   The shared time Controls 'omega', 'play', 't' and 'cursor' (../time-controls.js).
//   Revealable layer (ids in ../layers.js, for Activity Task hide/show lists): 'sum', the toggle
//   "Show v₁ + v₂". Unticked, the resultant is not drawn on either Display; hide() also hides
//   the toggle and the v₁ + v₂ readouts, so a Task can ask for the sum before showing it.
//   Drag handles (kit 2-D handles, keyboard-operable): 'tip1', 'tip2' ("v₁ tip", "v₂ tip") on the
//   plane, value { x: Re, y: Im } in V of that (static) phasor, drawn at its tip rotated to
//   ωt + φ; 'crest1',
//   'crest2' ("v₁ crest", "v₂ crest") on the time plot at the crest nearest t = 0, value
//   { x: ωt in °, y: A in V } (the engine's crest mapping, with t as phase so a key step is 1°
//   at any ω). Handles set the number inputs; the inputs are the one source of truth.
// Displays: 'plane' (the complex plane: v₁, v₂ and the resultant v₁ + v₂, each from the origin
//   and rotated to ωt + φ, the resultant's parallelogram dashed, with their projections on the
//   real axis; toScreen(re, im) in
//   V) and 'time' (v₁(t), v₂(t) and their sum over t ∈ [−T, T], with the time cursor at t, where
//   each curve's value is its phasor's projection; toScreen(t, v) with t in s and v in V). Both
//   share one amplitude scale, and each quantity has one colour in both. The Tool starts paused
//   at t = 0, where every phasor sits at its static angle φ.
// serialize() is { A1, phi1, A2, phi2, showSum, omega, t }; restore() pauses, ignores non-numbers, clamps
//   A and ω, wraps φ and t, and reports once.
//
// All phasor maths is the engine's (../engine.js); drawing helpers are ../draw.js.

import { controlRegistry } from '../../../framework/v1/control.js';
import { createEmitter } from '../../../framework/v1/tool.js';
import { h, handle, metric, section, themeVars, toggle } from '../../../framework/v1/ui-kit.js';
import { plotTheme } from '../../../framework/v1/plot-theme.js';
import { crest, evaluate, fromCrest, fromPolar, rotate, sum, toPolar, wrapDeg } from '../engine.js';
import { angleArc, arrow, curve, dot, line, niceFine, plotFrame, prepCanvas, tipLabel } from '../draw.js';
import { attachTimeCursor, drawTimeCursor, paintSwatches, redrawOnResize, screenMapper, snapshotOf, timeAxis } from '../display.js';
import { num, polarText, rectText, timeUnit } from '../format.js';
import { LAYERS } from '../layers.js';
import { numberInput } from '../number-input.js';
import { DEG, finite } from '../numbers.js';
import { toolStyles } from '../styles.js';
import { TIME_STATE_INFO, timeControls } from '../time-controls.js';

export const id = 'sum';
export const title = 'Sum';
export const setupKeys = ['A1', 'phi1', 'A2', 'phi2', 'omega'];

export const A_MAX = 10; // V
const DEFAULTS = { A1: 3, phi1: 0, A2: 2, phi2: 90, omega: 1000 };
const INPUTS = ['A1', 'phi1', 'A2', 'phi2'];

const STATE_INFO = {
  mode: { label: 'Mode', unit: '' },
  A1: { label: 'Amplitude A₁ of v₁', unit: 'V' },
  phi1: { label: 'Phase φ₁ of v₁', unit: '°' },
  A2: { label: 'Amplitude A₂ of v₂', unit: 'V' },
  phi2: { label: 'Phase φ₂ of v₂', unit: '°' },
  A: { label: 'Amplitude A of v₁ + v₂', unit: 'V' },
  phi: { label: 'Phase φ of v₁ + v₂', unit: '°' },
  showSum: { label: 'v₁ + v₂ shown', unit: '' },
  ...TIME_STATE_INFO,
};

const [SUM_LAYER] = LAYERS.sum; // the resultant's toggle

export function mount(container, setup = {}) {
  const start = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) if (finite(setup[k])) start[k] = Number(setup[k]);
  const changes = createEmitter();
  let quiet = false; // restore() sets several inputs, then reports once

  // ── Controls ──
  const changed = () => { if (!quiet) update(); };
  const time = timeControls({ omega: start.omega, onChange: changed });
  const amp = (k, n) => numberInput({ id: k, name: `A${n}`, label: `A<sub>${n}</sub>`, unit: 'V',
    min: 0, max: A_MAX, value: start[k], onChange: changed });
  const phase = (k, n) => numberInput({ id: k, name: `φ${n}`, label: `φ<sub>${n}</sub>`, unit: '°',
    min: -180, max: 180, value: start[k], decimals: 1, normalize: wrapDeg, onChange: changed });
  // a11y names use subscript digits, as the readouts do
  const SUB = { 1: '₁', 2: '₂' };
  const ctl = {
    A1: amp('A1', SUB[1]), phi1: phase('phi1', SUB[1]),
    A2: amp('A2', SUB[2]), phi2: phase('phi2', SUB[2]),
  };

  // The resultant is a revealable layer.
  const resultant = toggle({ id: SUM_LAYER, name: 'Show v₁ + v₂', value: true,
    label: '<span class="fw-legend-line ph-swatch" data-color="sum"></span>Show v<sub>1</sub> + v<sub>2</sub>',
    onChange: changed, onHide: (hidden) => { sumBlock.hidden = hidden; draw(); } });
  const sumShown = () => !resultant.isHidden() && resultant.get();

  const p1 = () => ({ A: ctl.A1.get(), phi: ctl.phi1.get() });
  const p2 = () => ({ A: ctl.A2.get(), phi: ctl.phi2.get() });
  const getState = () => {
    const s = sum(p1(), p2());
    return { mode: id, A1: ctl.A1.get(), phi1: ctl.phi1.get(), A2: ctl.A2.get(), phi2: ctl.phi2.get(),
      A: s.A, phi: s.phi, showSum: resultant.get(), ...time.state() };
  };

  // ── Readouts ──
  const readout = (name) => ({
    rect: metric({ name: `${name} rectangular`, label: 'a + jb' }),
    polar: metric({ name: `${name} polar`, label: 'A∠φ' }),
  });
  const readouts = { v1: readout('v₁'), v2: readout('v₂'), sum: readout('v₁ + v₂') };

  // ── Drag handles ──
  // Each phasor's tip on the plane and its crest on the time plot. A handle reports by setting
  // the number inputs (then one update()), and update() moves every handle to match, so the
  // views never drift apart.
  const omega = () => time.omega(); // ω is a Control: every mapping reads its current value
  const pOf = (n) => (n === 1 ? p1() : p2());
  const zOf = (n) => { const p = pOf(n); return fromPolar(p.A, p.phi); };
  const VOLTS = { unit: 'V', step: 0.1, coarse: 1, decimals: 2 };
  const tipValue = (n) => { const z = zOf(n); return { x: z.re, y: z.im }; };
  const crestValue = (n) => { const c = crest(pOf(n), omega()); return { x: c.t * omega() * DEG, y: c.A }; };
  const local = (cv, cx, cy) => { const r = cv.getBoundingClientRect(); return [cx - r.left, cy - r.top]; };
  // A tip handle's value is the static phasor; on screen it sits at the phasor rotated to ωt + φ.
  const turn = (re, im, t) => (re === 0 && im === 0 ? { re, im } : rotate(toPolar({ re, im }), omega(), t));

  /** Set phasor n from a handle; at A = 0 the phase is kept (a zero phasor has no direction). */
  function setPhasor(n, p) {
    quiet = true;
    try {
      ctl[`A${n}`].set(p.A);
      if (p.A > 1e-9) ctl[`phi${n}`].set(p.phi);
    } finally {
      quiet = false;
    }
    update();
  }

  function tipHandle(n) {
    return handle({ id: `tip${n}`, name: `v${SUB[n]} tip`,
      x: { name: 'Re', min: -A_MAX, max: A_MAX, ...VOLTS }, y: { name: 'Im', min: -A_MAX, max: A_MAX, ...VOLTS },
      value: tipValue(n),
      format: () => `v${SUB[n]} = ${rectText(zOf(n), 'V')} = ${polarText(pOf(n), 'V')}`,
      toScreen: (v) => { const z = turn(v.x, v.y, time.t()); return planeToScreen(z.re, z.im); },
      fromScreen: (cx, cy) => {
        const f = frames.plane;
        if (!f) return null;
        const [x, y] = local(planeCv, cx, cy);
        const z = turn(f.ix(x), f.iy(y), -time.t()); // back to the static frame
        return { x: z.re, y: z.im };
      },
      onChange: (v) => setPhasor(n, toPolar({ re: v.x, im: v.y })),
      onHide: () => draw() });
  }

  function crestHandle(n) {
    return handle({ id: `crest${n}`, name: `v${SUB[n]} crest`,
      // ωt may run past ±180° while dragging; φ then wraps and the handle jumps to the new nearest crest
      x: { name: 'ωt', unit: '°', min: -360, max: 360, step: 1, coarse: 15, decimals: 1 },
      y: { name: 'A', min: 0, max: A_MAX, ...VOLTS },
      value: crestValue(n),
      format: () => {
        const c = crest(pOf(n), omega());
        const { unit, scale: k } = timeUnit(time.period());
        return `t = ${num(c.t * k, 3)} ${unit}, A = ${num(c.A)} V (φ${SUB[n]} = ${num(pOf(n).phi, 1)}°)`;
      },
      toScreen: (v) => timeToScreen(v.x / DEG / omega(), v.y),
      fromScreen: (cx, cy) => {
        const f = frames.time;
        if (!f) return null;
        const [x, y] = local(timeCv, cx, cy);
        return { x: f.ix(x) * omega() * DEG, y: f.iy(y) };
      },
      onChange: (v) => setPhasor(n, fromCrest({ t: v.x / DEG / omega(), A: v.y }, omega())),
      onHide: () => draw() });
  }

  const tips = { 1: tipHandle(1), 2: tipHandle(2) };
  const crests = { 1: crestHandle(1), 2: crestHandle(2) };
  const handles = [tips[1], tips[2], crests[1], crests[2]];

  // While a handle is dragged the amplitude scale is held, so the plots do not rescale under the
  // pointer and the handle follows it; it is fitted again on release.
  let heldScale = null;
  for (const hd of handles) {
    hd.el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || hd.isLocked() || hd.isHidden()) return;
      heldScale = null;
      heldScale = scale();
    });
    const release = () => { if (heldScale !== null) { heldScale = null; draw(); } };
    hd.el.addEventListener('pointerup', release);
    hd.el.addEventListener('pointercancel', release);
  }

  // ── Layout ──
  const planeCv = h('canvas', { class: 'ph-canvas' });
  const timeCv = h('canvas', { class: 'ph-canvas' });
  const swatch = (key) => h('span', { class: 'fw-legend-line ph-swatch', 'data-color': key });
  const phasorBlock = (key, html) => h('div', { class: 'ph-phasor' },
    h('div', { class: 'fw-legend-row' }, swatch(key), h('span', { html })),
    readouts[key].rect.el, readouts[key].polar.el);
  const sumBlock = phasorBlock('sum', 'v<sub>1</sub> + v<sub>2</sub>');

  const root = h('div', { class: 'fw-tool ph-tool', 'data-tool': 'phasors', 'data-mode': id },
    toolStyles(),
    h('aside', { class: 'fw-controls' },
      section('First sinusoid', h('div', { class: 'ph-formula', html: 'v<sub>1</sub> = A<sub>1</sub> cos(ωt + φ<sub>1</sub>)' }),
        h('div', { class: 'ph-pair' }, ctl.A1.el, ctl.phi1.el)),
      section('Second sinusoid', h('div', { class: 'ph-formula', html: 'v<sub>2</sub> = A<sub>2</sub> cos(ωt + φ<sub>2</sub>)' }),
        h('div', { class: 'ph-pair' }, ctl.A2.el, ctl.phi2.el)),
      time.frequencyEl,
      time.timeEl,
      section('Phasors',
        phasorBlock('v1', 'v<sub>1</sub>'),
        phasorBlock('v2', 'v<sub>2</sub>'),
        sumBlock,
        resultant.el)),
    h('div', { class: 'fw-displays' },
      h('div', { class: 'ph-displays' },
        h('div', { class: 'fw-display', 'data-display': 'plane' }, planeCv,
          h('div', { class: 'fw-handle-layer' }, tips[1].el, tips[2].el)),
        h('div', { class: 'fw-display', 'data-display': 'time' }, timeCv,
          h('div', { class: 'fw-handle-layer' }, crests[1].el, crests[2].el, time.cursorEl)))));
  container.append(root);

  // One colour per quantity, in both Displays and the legend.
  let colors = null;
  const readColors = () => {
    const theme = plotTheme(root);
    const { green } = themeVars(root, { green: '--fw-green' });
    colors = { ...theme, v1: theme.traces[0], v2: theme.traces[1], sum: green };
    paintSwatches(root, colors);
  };

  // ── Drawing ──
  // One amplitude scale for both Displays, a fine round step just above the longest phasor shown:
  // A₁, A₂ and, while its layer is shown, the resultant (so a hidden sum never sets the scale).
  // Held during a drag, see heldScale.
  const scale = () => {
    if (heldScale !== null) return heldScale;
    const reach = [ctl.A1.get(), ctl.A2.get(), 0.5];
    if (sumShown()) reach.push(sum(p1(), p2()).A);
    return niceFine(Math.max(...reach) * 1.08);
  };
  const frames = { plane: null, time: null };

  function drawPlane() {
    const { ctx, W, H, laidOut } = prepCanvas(planeCv, colors);
    const R = scale();
    const f = plotFrame(ctx, { x: 0, y: 0, w: W, h: H }, [-R, R], [-R, R],
      { colors, xTitle: 'Re (V)', yTitle: 'Im (V)', equal: true });
    const at = (z) => ({ x: f.X(z.re), y: f.Y(z.im) });
    const o = { re: 0, im: 0 };
    // Every phasor rotated to ωt + φ: at t = 0 each sits at its static angle.
    const z1 = rotate(p1(), time.omega(), time.t());
    const z2 = rotate(p2(), time.omega(), time.t());
    const tip = { re: z1.re + z2.re, im: z1.im + z2.im };
    // Projections on the real axis, which are the curves' values at the cursor: dashed drops from
    // the tips, v₁'s span just above the axis and v₂'s just below, each from the origin.
    const foot = (z) => at({ re: z.re, im: 0 });
    const nudge = (p, dy) => ({ x: p.x, y: p.y + dy });
    line(ctx, at(z1), foot(z1), colors.v1, { dashed: true });
    line(ctx, at(z2), foot(z2), colors.v2, { dashed: true });
    if (sumShown()) {
      line(ctx, at(tip), foot(tip), colors.sum, { dashed: true });
      // the parallelogram: v₂ from v₁'s tip and v₁ from v₂'s tip both reach the resultant's tip
      line(ctx, at(z1), at(tip), colors.v2, { dashed: true });
      line(ctx, at(z2), at(tip), colors.v1, { dashed: true });
    }
    line(ctx, nudge(at(o), -4), nudge(foot(z1), -4), colors.v1, { width: 3 });
    line(ctx, nudge(at(o), 4), nudge(foot(z2), 4), colors.v2, { width: 3 });
    if (sumShown()) arrow(ctx, at(o), at(tip), colors.sum, { width: 3 });
    arrow(ctx, at(o), at(z1), colors.v1);
    arrow(ctx, at(o), at(z2), colors.v2);
    // The angle from v₁ to v₂, fixed while they rotate together.
    if (ctl.A1.get() > 0 && ctl.A2.get() > 0) {
      angleArc(ctx, at(o), 22, toPolar(z1).phi, toPolar(z2).phi, colors.muted);
    }
    if (sumShown()) dot(ctx, foot(tip), colors.sum, 4);
    dot(ctx, foot(z1), colors.v1);
    dot(ctx, foot(z2), colors.v2);
    dot(ctx, at(z1), colors.v1);
    dot(ctx, at(z2), colors.v2);
    tipLabel(ctx, 'v₁', at(o), at(z1), colors.v1, colors);
    tipLabel(ctx, 'v₂', at(o), at(z2), colors.v2, colors);
    if (sumShown()) tipLabel(ctx, 'v₁ + v₂', at(o), at(tip), colors.sum, colors);
    frames.plane = laidOut ? f : null;
  }

  function drawTime() {
    const { ctx, W, H, laidOut } = prepCanvas(timeCv, colors);
    const omega = time.omega();
    const T = time.period();
    const R = scale();
    const f = plotFrame(ctx, { x: 0, y: 0, w: W, h: H }, [-T, T], [-R, R],
      { colors, yTitle: 'v (V)', ...timeAxis(T) });
    const s = sum(p1(), p2());
    // The resultant goes underneath, as on the plane, so v₁ and v₂ stay visible where they meet it.
    if (sumShown()) curve(ctx, f, -T, T, (t) => evaluate(s, omega, t), colors.sum, 3);
    curve(ctx, f, -T, T, (t) => evaluate(p1(), omega, t), colors.v1);
    curve(ctx, f, -T, T, (t) => evaluate(p2(), omega, t), colors.v2);
    for (const n of [1, 2]) {
      if (crests[n].isHidden()) continue;
      const c = crest(pOf(n), omega);
      dot(ctx, { x: f.X(c.t), y: f.Y(c.A) }, colors[`v${n}`]);
    }
    // The time cursor at t, and each curve's value there (its phasor's real-axis projection).
    const t = time.t();
    const at = (p, color) => ({ v: evaluate(p, omega, t), color });
    drawTimeCursor(ctx, f, t, colors,
      [...(sumShown() ? [at(s, colors.sum)] : []), at(p2(), colors.v2), at(p1(), colors.v1)]);
    frames.time = laidOut ? f : null;
  }

  function draw() {
    if (!colors) readColors();
    drawPlane();
    drawTime();
    time.place();
    for (const hd of handles) hd.place();
  }

  function update() {
    const z1 = fromPolar(ctl.A1.get(), ctl.phi1.get());
    const z2 = fromPolar(ctl.A2.get(), ctl.phi2.get());
    const s = sum(p1(), p2());
    for (const [key, z, p] of [['v1', z1, p1()], ['v2', z2, p2()], ['sum', fromPolar(s.A, s.phi), s]]) {
      readouts[key].rect.update(rectText(z, 'V'));
      readouts[key].polar.update(polarText(p, 'V'));
    }
    for (const n of [1, 2]) {
      tips[n].update(tipValue(n));
      crests[n].update(crestValue(n));
    }
    draw();
    changes.emit(getState());
  }

  const stopResizing = redrawOnResize(root, draw);
  // Display contract: the client position of a plot point, or null until laid out.
  const planeToScreen = screenMapper(planeCv, frames, 'plane');
  const timeToScreen = screenMapper(timeCv, frames, 'time');
  const snap = (cv) => snapshotOf(cv, draw);
  attachTimeCursor(time, timeCv, frames);

  readColors();
  update();

  return {
    state: {
      snapshot: getState,
      describe: () => structuredClone(STATE_INFO),
      onChange: (fn) => changes.on(fn),
    },
    controls: controlRegistry({ ...ctl, [SUM_LAYER]: resultant, tip1: tips[1], tip2: tips[2], crest1: crests[1], crest2: crests[2],
      ...time.controls }),
    displays: [
      { id: 'plane', label: 'Complex plane', snapshot: snap(planeCv), toScreen: planeToScreen },
      { id: 'time', label: 'Time plot', snapshot: snap(timeCv), toScreen: timeToScreen },
    ],
    serialize: () => ({ ...Object.fromEntries(INPUTS.map((k) => [k, ctl[k].get()])), showSum: resultant.get(),
      ...time.serialize() }),
    restore(saved = {}) {
      quiet = true;
      try {
        for (const k of INPUTS) if (finite(saved?.[k])) ctl[k].set(saved[k]);
        if (typeof saved?.showSum === 'boolean') resultant.set(saved.showSum);
        time.restore(saved ?? {});
      } finally {
        quiet = false;
      }
      update();
    },
    resize: () => { readColors(); draw(); },
    destroy() {
      time.destroy();
      stopResizing();
      for (const hd of handles) hd.destroy();
      changes.clear();
      root.remove();
    },
  };
}
