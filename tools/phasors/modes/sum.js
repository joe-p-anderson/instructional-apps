// Phasors Tool, Sum Mode: add two same-frequency sinusoids as phasors.
//
// Setup: { A1, phi1, A2, phi2, omega } (any subset; DEFAULTS below).
// State (state.snapshot(), each with a label and unit in describe()): mode ('sum'), A1 (V),
//   phi1 (°), A2 (V), phi2 (°), the resultant A (V), phi (°), and the time State omega (rad/s),
//   f (Hz, ω/2π), t (s), playing (../time-controls.js).
// Controls: number inputs 'A1', 'A2' (V, 0 to A_MAX) and 'phi1', 'phi2' (°, any number, wrapped
//   into (−180, 180]). Each also has update(v), which sets and shows it without reporting.
//   The shared time Controls 'omega', 'play', 't' and 'cursor' (../time-controls.js).
// Displays: 'plane' (the complex plane: v₁ from the origin, v₂ from v₁'s tip, and the resultant
//   v₁ + v₂, each rotated to ωt + φ, with their projections on the real axis; toScreen(re, im) in
//   V) and 'time' (v₁(t), v₂(t) and their sum over t ∈ [−T, T], with the time cursor at t, where
//   each curve's value is its phasor's projection; toScreen(t, v) with t in s and v in V). Both
//   share one amplitude scale, and each quantity has one colour in both. The Tool starts paused
//   at t = 0, where every phasor sits at its static angle φ.
// serialize() is { A1, phi1, A2, phi2, omega, t }; restore() pauses, ignores non-numbers, clamps
//   A and ω, wraps φ and t, and reports once.
//
// All phasor maths is the engine's (../engine.js); drawing helpers are ../draw.js.

import { controlRegistry } from '../../../framework/v1/control.js';
import { createEmitter } from '../../../framework/v1/tool.js';
import { h, metric, section, themeVars } from '../../../framework/v1/ui-kit.js';
import { plotTheme } from '../../../framework/v1/plot-theme.js';
import { evaluate, fromPolar, rotate, sum, toPolar, wrapDeg } from '../engine.js';
import { angleArc, arrow, curve, dot, line, niceStep, plotFrame, prepCanvas, sideLabel } from '../draw.js';
import { num, polarText, rectText, timeUnit } from '../format.js';
import { numberInput } from '../number-input.js';
import { toolStyles } from '../styles.js';
import { TIME_STATE_INFO, timeControls } from '../time-controls.js';

export const id = 'sum';
export const title = 'Sum';

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
  ...TIME_STATE_INFO,
};

const finite = (v) => v !== null && v !== '' && Number.isFinite(Number(v));

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

  const p1 = () => ({ A: ctl.A1.get(), phi: ctl.phi1.get() });
  const p2 = () => ({ A: ctl.A2.get(), phi: ctl.phi2.get() });
  const getState = () => {
    const s = sum(p1(), p2());
    return { mode: id, A1: ctl.A1.get(), phi1: ctl.phi1.get(), A2: ctl.A2.get(), phi2: ctl.phi2.get(),
      A: s.A, phi: s.phi, ...time.state() };
  };

  // ── Readouts ──
  const readout = (name) => ({
    rect: metric({ name: `${name} rectangular`, label: 'a + jb' }),
    polar: metric({ name: `${name} polar`, label: 'A∠φ' }),
  });
  const readouts = { v1: readout('v₁'), v2: readout('v₂'), sum: readout('v₁ + v₂') };

  // ── Layout ──
  const planeCv = h('canvas', { class: 'ph-canvas' });
  const timeCv = h('canvas', { class: 'ph-canvas' });
  const swatch = (key) => h('span', { class: 'fw-legend-line ph-swatch', 'data-color': key });
  const phasorBlock = (key, html) => h('div', { class: 'ph-phasor' },
    h('div', { class: 'fw-legend-row' }, swatch(key), h('span', { html })),
    readouts[key].rect.el, readouts[key].polar.el);

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
        phasorBlock('sum', 'v<sub>1</sub> + v<sub>2</sub>'))),
    h('div', { class: 'fw-displays' },
      h('div', { class: 'ph-displays' },
        h('div', { class: 'fw-display', 'data-display': 'plane' }, planeCv),
        h('div', { class: 'fw-display', 'data-display': 'time' }, timeCv,
          h('div', { class: 'fw-handle-layer' }, time.cursorEl)))));
  container.append(root);

  // One colour per quantity, in both Displays and the legend.
  let colors = null;
  const readColors = () => {
    const theme = plotTheme(root);
    const { green } = themeVars(root, { green: '--fw-green' });
    colors = { ...theme, v1: theme.traces[0], v2: theme.traces[1], sum: green };
    for (const el of root.querySelectorAll('.ph-swatch')) el.style.background = colors[el.dataset.color];
  };

  // ── Drawing ──
  // One amplitude scale for both Displays: a 1-2-5 step above A₁ + A₂, so every tip fits.
  const scale = () => {
    const reach = Math.max(ctl.A1.get() + ctl.A2.get(), 0.5) * 1.1;
    const step = niceStep(reach, 4);
    return Math.ceil(reach / step) * step;
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
    // the tips, v₁'s span just above the axis and v₂'s (from v₁'s foot) just below.
    const foot = (z) => at({ re: z.re, im: 0 });
    const nudge = (p, dy) => ({ x: p.x, y: p.y + dy });
    line(ctx, at(z1), foot(z1), colors.v1, { dashed: true });
    line(ctx, at(tip), foot(tip), colors.sum, { dashed: true });
    line(ctx, nudge(at(o), -4), nudge(foot(z1), -4), colors.v1, { width: 3 });
    line(ctx, nudge(foot(z1), 4), nudge(foot(tip), 4), colors.v2, { width: 3 });
    arrow(ctx, at(o), at(tip), colors.sum, { width: 3 });
    arrow(ctx, at(o), at(z1), colors.v1);
    arrow(ctx, at(z1), at(tip), colors.v2);
    // The angle from v₁ to v₂, fixed while they rotate together.
    if (ctl.A1.get() > 0 && ctl.A2.get() > 0) {
      angleArc(ctx, at(z1), 22, toPolar(z1).phi, toPolar(z2).phi, colors.muted);
    }
    dot(ctx, foot(tip), colors.sum, 4);
    dot(ctx, foot(z1), colors.v1);
    dot(ctx, at(z1), colors.v1);
    dot(ctx, at(tip), colors.v2);
    // each side of the triangle is labelled outside it
    sideLabel(ctx, 'v₁', at(o), at(z1), at(tip), colors.v1, colors);
    sideLabel(ctx, 'v₂', at(z1), at(tip), at(o), colors.v2, colors);
    sideLabel(ctx, 'v₁ + v₂', at(o), at(tip), at(z1), colors.sum, colors);
    frames.plane = laidOut ? f : null;
  }

  function drawTime() {
    const { ctx, W, H, laidOut } = prepCanvas(timeCv, colors);
    const omega = time.omega();
    const T = time.period();
    const { unit, scale: k } = timeUnit(T);
    const R = scale();
    const f = plotFrame(ctx, { x: 0, y: 0, w: W, h: H }, [-T, T], [-R, R], {
      colors, xTitle: `t (${unit})`, yTitle: 'v (V)',
      xFormat: (v) => num(v * k, Math.max(0, -Math.floor(Math.log10(niceStep(2 * T * k, 4))))),
    });
    const s = sum(p1(), p2());
    // The resultant goes underneath, as on the plane, so v₁ and v₂ stay visible where they meet it.
    curve(ctx, f, -T, T, (t) => evaluate(s, omega, t), colors.sum, 3);
    curve(ctx, f, -T, T, (t) => evaluate(p1(), omega, t), colors.v1);
    curve(ctx, f, -T, T, (t) => evaluate(p2(), omega, t), colors.v2);
    // The time cursor at t, and each curve's value there (its phasor's real-axis projection).
    const t = time.t();
    line(ctx, { x: f.X(t), y: f.rect.T }, { x: f.X(t), y: f.rect.B }, colors.ink, { width: 1.5 });
    dot(ctx, { x: f.X(t), y: f.rect.T }, colors.ink, 6);
    dot(ctx, { x: f.X(t), y: f.Y(evaluate(s, omega, t)) }, colors.sum);
    dot(ctx, { x: f.X(t), y: f.Y(evaluate(p2(), omega, t)) }, colors.v2);
    dot(ctx, { x: f.X(t), y: f.Y(evaluate(p1(), omega, t)) }, colors.v1);
    frames.time = laidOut ? f : null;
  }

  function draw() {
    if (!colors) readColors();
    drawPlane();
    drawTime();
    time.place();
  }

  function update() {
    const z1 = fromPolar(ctl.A1.get(), ctl.phi1.get());
    const z2 = fromPolar(ctl.A2.get(), ctl.phi2.get());
    const s = sum(p1(), p2());
    for (const [key, z, p] of [['v1', z1, p1()], ['v2', z2, p2()], ['sum', fromPolar(s.A, s.phi), s]]) {
      readouts[key].rect.update(rectText(z, 'V'));
      readouts[key].polar.update(polarText(p, 'V'));
    }
    draw();
    changes.emit(getState());
  }

  const resizeObserver = new ResizeObserver(() => draw());
  resizeObserver.observe(root);

  // Display contract: the client position of a plot point, or null until laid out.
  const screenOf = (cv, key) => (x, y) => {
    const f = frames[key];
    if (!f) return null;
    const r = cv.getBoundingClientRect();
    if (Math.abs(r.width - cv.width / (globalThis.devicePixelRatio || 1)) > 1) return null;
    return { x: r.left + f.X(x), y: r.top + f.Y(y) };
  };
  const snap = (cv) => async () => { draw(); return cv.toDataURL('image/png'); };
  // The time cursor's handle rides the top edge of the time plot at t.
  const timeAt = screenOf(timeCv, 'time');
  time.attachCursor(
    (t) => { const p = timeAt(t, 0); return p && { x: p.x, y: timeCv.getBoundingClientRect().top + frames.time.rect.T }; },
    (cx) => (frames.time ? frames.time.ix(cx - timeCv.getBoundingClientRect().left) : time.t()),
  );

  readColors();
  update();

  return {
    state: {
      snapshot: getState,
      describe: () => structuredClone(STATE_INFO),
      onChange: (fn) => changes.on(fn),
    },
    controls: controlRegistry({ ...ctl, ...time.controls }),
    displays: [
      { id: 'plane', label: 'Complex plane', snapshot: snap(planeCv), toScreen: screenOf(planeCv, 'plane') },
      { id: 'time', label: 'Time plot', snapshot: snap(timeCv), toScreen: screenOf(timeCv, 'time') },
    ],
    serialize: () => ({ ...Object.fromEntries(INPUTS.map((k) => [k, ctl[k].get()])), ...time.serialize() }),
    restore(saved = {}) {
      quiet = true;
      try {
        for (const k of INPUTS) if (finite(saved?.[k])) ctl[k].set(saved[k]);
        time.restore(saved ?? {});
      } finally {
        quiet = false;
      }
      update();
    },
    resize: () => { readColors(); draw(); },
    destroy() {
      time.destroy();
      resizeObserver.disconnect();
      changes.clear();
      root.remove();
    },
  };
}
