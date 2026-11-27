// Phasors Tool, Circuit Mode: one series loop of R, L and/or C driven by V₀ cos(ωt). The source
// has phase 0 and is the phase reference.
//
// Setup: { includeR, includeL, includeC (booleans), V0 (V), R (Ω), L (mH), C (µF), omega (rad/s) }
//   (any subset; DEFAULTS below).
// State (state.snapshot(), each with a label and unit in describe()):
//   mode ('circuit'); the Controls includeR, includeL, includeC, V0 (V), R (Ω), L (mH), C (µF),
//   showVin, showI, showVR, showVL, showVC, showZtotal, showKVL (the toggles); the solved circuit ZtotRe, ZtotIm,
//   ZtotMag (Ω), angleZ (°), Imag (A), angleI (°), VRmag, VLmag, VCmag (V), angleVR, angleVL,
//   angleVC (°) — null for an excluded element, and I and every V_k null when Z = 0 (L and C alone
//   exactly at ω₀); omega0 (rad/s, ω₀ = 1/√(LC), null unless L and C are both on), omegaC (rad/s,
//   ω_c = 1/(RC), null unless R and C are on without L); omegaMin, omegaMax (rad/s, the range of ω
//   swept since mount or restore, for sweep Conditions); and the time State omega, f, t, playing
//   (../time-controls.js).
// Controls (ids):
//   'includeR', 'includeL', 'includeC'  toggles "Include R" etc.; the last one on refuses to go off
//   'V0', 'R', 'L', 'C'                 sliders with number boxes, "V₀ (V)", "R (Ω)", "L (mH)",
//                                       "C (µF)" (R, L and C on log scales)
//   'vin', 'I', 'VR', 'VL', 'VC'        trace toggles "Show V_in", "Show I", ...: each shows or
//                                       hides that quantity on the phasor plane and the time plot
//   'Ztotal'                            toggle "Show Z_total": Z_total and ∠Z on the impedance plane
//   'kvl'                               toggle "Show KVL closure": on, V_R, V_L and V_C are drawn
//                                       head to tail, closing on V_in; off, each from the origin
//   Revealable layers (ids in ../layers.js, for Activity Task hide/show lists): 'Ztotal', 'I',
//   'VR', 'VL', 'VC', 'kvl'. hide() on one hides its toggle, its drawing on every Display and its
//   readouts, whatever the toggle says: hiding I also hides i(t), the time plot's A axis and the
//   I scale; hiding Z_total also hides the Z_total readouts, never Z_R, Z_L or Z_C. 'vin' hides
//   the same way, but V_in is the given source, not a layer to reveal. State keeps publishing
//   every solved value while its layer is hidden.
//   the shared time Controls 'omega', 'play', 't' and 'cursor' (../time-controls.js)
// Displays: 'impedance' (the static impedance plane: Z_R, Z_L, Z_C head to tail from the origin,
//   and Z_total from the origin to the chain's end with ∠Z marked by an arc; auto-scaled to fit
//   the whole chain, its axes in Ω, kΩ or MΩ; toScreen(re, im) in Ω), 'phasor' (the rotating phasor plane: V_in from the origin, V_R, V_L, V_C head to tail
//   closing on V_in, and I dashed on its own scale, every phasor rotated by ωt; toScreen(re, im) in
//   V) , 'time' (v_in(t), v_R(t), v_L(t), v_C(t) on the left axis in V, and i(t) dashed on the
//   right-hand axis in A, over t ∈ [−T, T], with the time cursor; toScreen(t, v) with t in s and v
//   in V) and 'schematic' (the series loop: the source and whichever of R, L and C are in it, each
//   with its value; its accessible name lists them). I is drawn as I/kI on the volt axes, kI (A per V) the smallest 1-2-5 step that keeps
//   it no longer than V_in, so both Displays share one current scale.
// Colours (one per quantity, the same in every Display and the legend): V_in ink, I green,
//   R (V_R, and Z_R) trace 1 blue, L trace 2 red, C yellow (gold), Z_total ink like V_in (V_in =
//   I·Z_total, as V_k = I·Z_k shares Z_k's colour).
// serialize() is every settable value plus { omega, t }; restore() pauses, ignores bad values,
//   clamps numbers, keeps at least one element on, and reports once.
//
// All circuit maths is the engine's (../engine.js); drawing helpers are ../draw.js.

import { controlRegistry } from '../../../framework/v1/control.js';
import { createEmitter } from '../../../framework/v1/tool.js';
import { h, metric, section, slider, themeVars, toggle } from '../../../framework/v1/ui-kit.js';
import { plotTheme } from '../../../framework/v1/plot-theme.js';
import { add, evaluate, fromPolar, mul, omega0, omegaC, solve, toPolar } from '../engine.js';
import { angleArc, arrow, curve, dot, label, line, niceStep, plotFrame, prepCanvas, sideLabel } from '../draw.js';
import { num, prefix, siPolarText, siRectText, timeUnit } from '../format.js';
import { toolStyles } from '../styles.js';
import { TIME_STATE_INFO, timeControls } from '../time-controls.js';

export const id = 'circuit';
export const title = 'Circuit';

const ELEMENTS = ['R', 'L', 'C'];
const DEFAULTS = { includeR: true, includeL: true, includeC: true, V0: 5, R: 100, L: 50, C: 2, omega: 1000 };
const RANGES = {
  V0: { min: 0.1, max: 10 },
  R: { min: 1, max: 1e4 },
  L: { min: 0.1, max: 1000 },
  C: { min: 0.01, max: 100 },
};
const NUMBERS = ['V0', 'R', 'L', 'C'];
// The drawn quantities, each with its trace toggle: [key, State key, a11y name, label HTML]
const TRACES = [
  ['vin', 'showVin', 'V_in', 'V<sub>in</sub>'],
  ['I', 'showI', 'I', 'I'],
  ['VR', 'showVR', 'V_R', 'V<sub>R</sub>'],
  ['VL', 'showVL', 'V_L', 'V<sub>L</sub>'],
  ['VC', 'showVC', 'V_C', 'V<sub>C</sub>'],
];
// The other toggles: [key, State key, a11y name]
const OVERLAYS = [
  ['Ztotal', 'showZtotal', 'Show Z_total'],
  ['kvl', 'showKVL', 'Show KVL closure'],
];

const STATE_INFO = {
  mode: { label: 'Mode', unit: '' },
  includeR: { label: 'R in the loop', unit: '' },
  includeL: { label: 'L in the loop', unit: '' },
  includeC: { label: 'C in the loop', unit: '' },
  V0: { label: 'Source amplitude V₀', unit: 'V' },
  R: { label: 'Resistance R', unit: 'Ω' },
  L: { label: 'Inductance L', unit: 'mH' },
  C: { label: 'Capacitance C', unit: 'µF' },
  showVin: { label: 'V_in shown', unit: '' },
  showI: { label: 'I shown', unit: '' },
  showVR: { label: 'V_R shown', unit: '' },
  showVL: { label: 'V_L shown', unit: '' },
  showVC: { label: 'V_C shown', unit: '' },
  showZtotal: { label: 'Z_total shown', unit: '' },
  showKVL: { label: 'KVL closure shown (device voltages head to tail)', unit: '' },
  ZtotRe: { label: 'Real part of Z_total', unit: 'Ω' },
  ZtotIm: { label: 'Imaginary part of Z_total', unit: 'Ω' },
  ZtotMag: { label: 'Magnitude |Z_total|', unit: 'Ω' },
  angleZ: { label: 'Angle ∠Z_total', unit: '°' },
  Imag: { label: 'Current amplitude |I|', unit: 'A' },
  angleI: { label: 'Current phase ∠I', unit: '°' },
  VRmag: { label: 'Amplitude |V_R|', unit: 'V' },
  angleVR: { label: 'Phase ∠V_R', unit: '°' },
  VLmag: { label: 'Amplitude |V_L|', unit: 'V' },
  angleVL: { label: 'Phase ∠V_L', unit: '°' },
  VCmag: { label: 'Amplitude |V_C|', unit: 'V' },
  angleVC: { label: 'Phase ∠V_C', unit: '°' },
  omega0: { label: 'Resonance ω₀ = 1/√(LC)', unit: 'rad/s' },
  omegaC: { label: 'Corner ω_c = 1/(RC)', unit: 'rad/s' },
  omegaMin: { label: 'Lowest ω swept', unit: 'rad/s' },
  omegaMax: { label: 'Highest ω swept', unit: 'rad/s' },
  ...TIME_STATE_INFO,
};

const finite = (v) => v !== null && v !== '' && typeof v !== 'boolean' && Number.isFinite(Number(v));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ZERO = { re: 0, im: 0 };
const DEG = 180 / Math.PI;

/** The smallest 1-2-5 step ≥ x (x > 0). */
function niceUp(x) {
  const p = 10 ** Math.floor(Math.log10(x));
  const m = x / p;
  return (m <= 1 + 1e-9 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

export function mount(container, setup = {}) {
  const start = { ...DEFAULTS };
  for (const k of NUMBERS.concat('omega')) if (finite(setup[k])) start[k] = Number(setup[k]);
  for (const k of ELEMENTS) if (typeof setup[`include${k}`] === 'boolean') start[`include${k}`] = setup[`include${k}`];
  if (!ELEMENTS.some((k) => start[`include${k}`])) start.includeR = true;
  const changes = createEmitter();
  let quiet = false; // restore() sets several Controls, then reports once
  const changed = () => { if (!quiet) update(); };

  // ── Controls ──
  const time = timeControls({ omega: start.omega, onChange: changed });

  const includes = {};
  for (const k of ELEMENTS) {
    includes[k] = toggle({ id: `include${k}`, name: `Include ${k}`, label: k, value: start[`include${k}`],
      onChange: (on) => {
        // at least one element stays in the loop
        if (!on && !ELEMENTS.some((e) => e !== k && includes[e].get())) {
          includes[k].el.querySelector('input').checked = true;
          return;
        }
        changed();
      } });
  }
  const included = () => ELEMENTS.filter((k) => includes[k].get());

  const sliders = {
    V0: slider({ id: 'V0', name: 'V₀', label: 'V<sub>0</sub>', unit: 'V', ...RANGES.V0, step: 0.1, decimals: 2,
      value: start.V0, reset: DEFAULTS.V0, onChange: changed }),
    R: slider({ id: 'R', name: 'R', unit: 'Ω', ...RANGES.R, log: true, decimals: 1, value: start.R,
      reset: DEFAULTS.R, onChange: changed }),
    L: slider({ id: 'L', name: 'L', unit: 'mH', ...RANGES.L, log: true, decimals: 2, value: start.L,
      reset: DEFAULTS.L, onChange: changed }),
    C: slider({ id: 'C', name: 'C', unit: 'µF', ...RANGES.C, log: true, decimals: 3, value: start.C,
      reset: DEFAULTS.C, onChange: changed }),
  };

  const traces = {};
  for (const [key, , name, html] of TRACES) {
    traces[key] = toggle({ id: key, name: `Show ${name}`, value: true,
      label: `<span class="fw-legend-line ph-swatch" data-color="${key}"></span>${html}`,
      onChange: changed, onHide: () => { showRows(); draw(); } });
  }
  traces.Ztotal = toggle({ id: 'Ztotal', name: 'Show Z_total', value: true, label: 'Show Z<sub>total</sub>',
    onChange: changed, onHide: () => { showRows(); draw(); } });
  traces.kvl = toggle({ id: 'kvl', name: 'Show KVL closure', value: true, label: 'Show KVL closure (head to tail)',
    onChange: changed, onHide: () => draw() });
  const shown = (key) => !traces[key].isHidden() && traces[key].get();

  // ── The solved circuit ──
  const solved = () => solve({ V0: sliders.V0.get(), R: sliders.R.get(), L: sliders.L.get() * 1e-3,
    C: sliders.C.get() * 1e-6, include: included(), omega: time.omega() });
  const has = (k) => includes[k].get();
  const resonance = () => (has('L') && has('C') ? omega0(sliders.L.get() * 1e-3, sliders.C.get() * 1e-6) : null);
  const corner = () => (has('R') && has('C') && !has('L') ? omegaC(sliders.R.get(), sliders.C.get() * 1e-6) : null);
  let sweep = null; // { min, max } of ω since mount or restore
  const track = () => {
    const w = time.omega();
    sweep = sweep ? { min: Math.min(sweep.min, w), max: Math.max(sweep.max, w) } : { min: w, max: w };
  };

  function getState() {
    const c = solved();
    const polar = (z) => (z ? toPolar(z) : null);
    const I = polar(c.I);
    const Z = toPolar(c.Z.total);
    const out = { mode: id };
    for (const k of ELEMENTS) out[`include${k}`] = has(k);
    for (const k of NUMBERS) out[k] = sliders[k].get();
    for (const [key, stateKey] of TRACES.concat(OVERLAYS)) out[stateKey] = traces[key].get();
    Object.assign(out, {
      ZtotRe: c.Z.total.re, ZtotIm: c.Z.total.im, ZtotMag: Z.A, angleZ: Z.phi,
      Imag: I ? I.A : null, angleI: I ? I.phi : null,
    });
    for (const k of ELEMENTS) {
      const v = polar(c.V[k]);
      out[`V${k}mag`] = v ? v.A : null;
      out[`angleV${k}`] = v ? v.phi : null;
    }
    return { ...out, omega0: resonance(), omegaC: corner(), omegaMin: sweep.min, omegaMax: sweep.max,
      ...time.state() };
  }

  // ── Readouts ──
  const zReadout = (key, name, html) => {
    const r = { rect: metric({ name: `${name} rectangular`, label: 'a + jb' }),
      polar: metric({ name: `${name} polar`, label: '|Z|∠θ' }) };
    r.el = h('div', { class: 'ph-phasor' },
      h('div', { class: 'fw-legend-row' }, h('span', { class: 'fw-legend-line ph-swatch', 'data-color': key }),
        h('span', { html })),
      r.rect.el, r.polar.el);
    return r;
  };
  const zReadouts = {
    R: zReadout('R', 'Z_R', 'Z<sub>R</sub> = R'),
    L: zReadout('L', 'Z_L', 'Z<sub>L</sub> = jωL'),
    C: zReadout('C', 'Z_C', 'Z<sub>C</sub> = 1/(jωC)'),
    total: zReadout('total', 'Z_total', 'Z<sub>total</sub>'),
  };
  const w0Readout = metric({ name: 'ω₀', label: 'ω<sub>0</sub> = 1/√(LC)' });
  const wcReadout = metric({ name: 'ω_c', label: 'ω<sub>c</sub> = 1/(RC)' });
  const phasorReadouts = Object.fromEntries(TRACES.map(([key, , name]) => [key, metric({ name, label: 'A∠φ' })]));
  const traceRows = Object.fromEntries(TRACES.map(([key]) => [key,
    h('div', { class: 'ph-trace' }, traces[key].el, phasorReadouts[key].el)]));
  /** A row shows unless its element is out of the loop or its layer is hidden (the toggle hides itself). */
  function showRows() {
    const c = solved();
    for (const [key] of TRACES) traceRows[key].hidden = traces[key].isHidden();
    for (const k of ELEMENTS) if (!c.Z[k]) traceRows[`V${k}`].hidden = true;
    zReadouts.total.el.hidden = traces.Ztotal.isHidden();
  }

  // ── Layout ──
  const impedanceCv = h('canvas', { class: 'ph-canvas' });
  const schematicCv = h('canvas', { class: 'ph-canvas', role: 'img' });
  const phasorCv = h('canvas', { class: 'ph-canvas' });
  const timeCv = h('canvas', { class: 'ph-canvas' });
  const root = h('div', { class: 'fw-tool ph-tool', 'data-tool': 'phasors', 'data-mode': id },
    toolStyles(),
    h('aside', { class: 'fw-controls' },
      section('Circuit',
        h('div', { class: 'ph-formula', html: 'v<sub>in</sub> = V<sub>0</sub> cos(ωt), in series with' }),
        h('div', { class: 'ph-includes' }, includes.R.el, includes.L.el, includes.C.el),
        sliders.V0.el, sliders.R.el, sliders.L.el, sliders.C.el),
      time.frequencyEl,
      time.timeEl,
      section('Impedances', zReadouts.R.el, zReadouts.L.el, zReadouts.C.el, zReadouts.total.el,
        traces.Ztotal.el, w0Readout.el, wcReadout.el),
      section('Phasors', ...TRACES.map(([key]) => traceRows[key]), traces.kvl.el)),
    h('div', { class: 'fw-displays' },
      h('div', { class: 'ph-displays ph-circuit-displays' },
        h('div', { class: 'fw-display', 'data-display': 'impedance' }, impedanceCv),
        h('div', { class: 'fw-display', 'data-display': 'phasor' }, phasorCv),
        h('div', { class: 'fw-display', 'data-display': 'time' }, timeCv,
          h('div', { class: 'fw-handle-layer' }, time.cursorEl)),
        h('div', { class: 'fw-display', 'data-display': 'schematic' }, schematicCv))));
  container.append(root);

  // One colour per quantity, in every Display and the legend.
  let colors = null;
  function readColors() {
    const theme = plotTheme(root);
    const { green, yellow } = themeVars(root, { green: '--fw-green', yellow: '--fw-yellow' });
    colors = { ...theme, vin: theme.ink, I: green, R: theme.traces[0], L: theme.traces[1], C: yellow,
      total: theme.ink };
    colors.VR = colors.R; colors.VL = colors.L; colors.VC = colors.C;
    for (const el of root.querySelectorAll('.ph-swatch')) el.style.background = colors[el.dataset.color];
  }

  // ── Scales ──
  // The volt axes reach every point of the head-to-tail chain (V_L and V_C can exceed V₀ near
  // ω₀); I is drawn as I/kI, kI the smallest 1-2-5 step (A per V) that keeps it within V₀.
  const chain = (c) => {
    const pts = [ZERO];
    for (const k of ELEMENTS) if (c.V[k]) pts.push(add(pts[pts.length - 1], c.V[k]));
    return pts;
  };
  const currentScale = (c) => (c.I ? niceUp(toPolar(c.I).A / sliders.V0.get()) : 1);
  function voltScale(c) {
    const reach = Math.max(sliders.V0.get(), ...chain(c).map((z) => Math.hypot(z.re, z.im))) * 1.1;
    const step = niceStep(reach, 4);
    return Math.ceil(reach / step) * step;
  }
  const frames = { impedance: null, phasor: null, time: null };

  // ── Impedance plane (static): Z_R, Z_L, Z_C head to tail, then Z_total ──
  const zChain = (c) => {
    const pts = [ZERO];
    for (const k of ELEMENTS) if (c.Z[k]) pts.push(add(pts[pts.length - 1], c.Z[k]));
    return pts;
  };
  /** The plane's half-height S (Ω): a 1-2-5 multiple that fits every point of the chain. */
  function impedanceScale(c) {
    const reach = Math.max(...zChain(c).map((z) => Math.max(Math.abs(z.re), Math.abs(z.im)))) * 1.1 || 1;
    const step = niceStep(reach, 4);
    return Math.ceil(reach / step) * step;
  }

  /** Z_total from the origin to the end of the chain, and ∠Z as an arc off the real axis. */
  function drawZtotal(ctx, at, Z, away) {
    if (Math.hypot(Z.re, Z.im) < 1e-9) return;
    arrow(ctx, at(ZERO), at(Z), colors.total, { width: 3 });
    sideLabel(ctx, 'Z', at(ZERO), at(Z), away, colors.total, colors);
    const { phi } = toPolar(Z);
    if (Math.abs(phi) < 1) return;
    const o = at(ZERO);
    angleArc(ctx, o, 30, 0, phi, colors.total, 2);
    const mid = (phi / 2) * (Math.PI / 180);
    label(ctx, '∠Z', { x: o.x + 48 * Math.cos(mid), y: o.y - 48 * Math.sin(mid) }, colors.total, colors, 'center');
  }

  function drawImpedancePlane() {
    const { ctx, W, H, laidOut } = prepCanvas(impedanceCv, colors);
    const c = solved();
    const S = impedanceScale(c);
    const { prefix: p, scale } = prefix(S);
    const fmt = (v, step) => num(v * scale, Math.max(0, -Math.floor(Math.log10(step * scale) + 1e-9)));
    const f = plotFrame(ctx, { x: 0, y: 0, w: W, h: H }, [-S / 4, S], [-S, S],
      { colors, xTitle: `Re (${p}Ω)`, yTitle: `Im (${p}Ω)`, xFormat: fmt, yFormat: fmt, equal: true });
    const at = (z) => ({ x: f.X(z.re), y: f.Y(z.im) });
    const pts = zChain(c);
    const away = at({ re: pts.reduce((a, z) => a + z.re, 0) / pts.length, im: pts.reduce((a, z) => a + z.im, 0) / pts.length });
    // Z_L and Z_C are antiparallel, so head to tail they overlap: the longest goes underneath
    const segments = ELEMENTS.filter((k) => c.Z[k]).map((k, i) => ({ k, from: pts[i], to: pts[i + 1], len: toPolar(c.Z[k]).A }));
    for (const sg of segments.sort((a, b) => b.len - a.len)) {
      arrow(ctx, at(sg.from), at(sg.to), colors[sg.k]);
      sideLabel(ctx, `Z${sg.k}`, at(sg.from), at(sg.to), away, colors[sg.k], colors);
    }
    if (shown('Ztotal')) drawZtotal(ctx, at, c.Z.total, away);
    frames.impedance = laidOut ? f : null;
  }

  // ── Schematic: the series loop ──
  const valueText = (v, unit) => {
    const { prefix: p, scale } = prefix(v);
    return `${Number((v * scale).toPrecision(3))} ${p}${unit}`;
  };
  const schematicName = () => {
    const els = included();
    const list = els.length === 1 ? els[0] : `${els.slice(0, -1).join(', ')} and ${els[els.length - 1]}`;
    return `Series loop: the source, ${list}`;
  };

  /** Element k's symbol on the wire from canvas point a to b, in k's colour. */
  function drawSymbol(ctx, k, a, b) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / len; const uy = (b.y - a.y) / len; // along the wire
    const nx = uy; const ny = -ux;                              // across it, outward from the loop
    const pt = (s, n) => ({ x: a.x + ux * s + nx * n, y: a.y + uy * s + ny * n });
    const seg = (p, q) => { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); };
    const body = Math.min(48, len - 12); const s0 = (len - body) / 2; const s1 = s0 + body;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 2;
    ctx.strokeStyle = colors.ink;
    if (k === 'C') { seg(a, pt(len / 2 - 4, 0)); seg(pt(len / 2 + 4, 0), b); } else { seg(a, pt(s0, 0)); seg(pt(s1, 0), b); }
    ctx.strokeStyle = colors[k]; ctx.lineWidth = 2.5;
    if (k === 'R') {
      ctx.beginPath(); ctx.moveTo(pt(s0, 0).x, pt(s0, 0).y);
      for (let i = 0; i < 6; i += 1) { const q = pt(s0 + (body * (i + 0.5)) / 6, i % 2 ? -7 : 7); ctx.lineTo(q.x, q.y); }
      ctx.lineTo(pt(s1, 0).x, pt(s1, 0).y); ctx.stroke();
    } else if (k === 'L') {
      const n = 4; const r = body / (2 * n);
      ctx.beginPath(); ctx.moveTo(pt(s0, 0).x, pt(s0, 0).y);
      for (let i = 0; i < n; i += 1) {
        for (let j = 1; j <= 12; j += 1) { // a half circle bulging outward
          const th = Math.PI - (Math.PI * j) / 12;
          const q = pt(s0 + r * (2 * i + 1) + r * Math.cos(th), r * Math.sin(th));
          ctx.lineTo(q.x, q.y);
        }
      }
      ctx.stroke();
    } else {
      ctx.lineWidth = 3;
      seg(pt(len / 2 - 4, -13), pt(len / 2 - 4, 13)); seg(pt(len / 2 + 4, -13), pt(len / 2 + 4, 13));
    }
    ctx.restore();
  }

  /** Lines of text centred on canvas point `at` vertically, aligned `align`. */
  function textLines(ctx, lines, at, align) {
    ctx.save();
    ctx.font = `${colors.font.size}px ${colors.font.family}`;
    ctx.fillStyle = colors.text; ctx.textAlign = align; ctx.textBaseline = 'middle';
    lines.forEach((t, i) => ctx.fillText(t, at.x, at.y + (i - (lines.length - 1) / 2) * 18));
    ctx.restore();
  }

  function drawSchematic() {
    const { ctx, W, H } = prepCanvas(schematicCv, colors);
    schematicCv.setAttribute('aria-label', schematicName());
    // the loop: the source down the left side, R and L along the top, C down the right side
    const w = Math.min(W - 48, 360); const hgt = Math.max(60, Math.min(H - 76, 200));
    const L = (W - w) / 2; const R = L + w; const T = (H - hgt) / 2 + 16; const B = T + hgt;
    const cy = (T + B) / 2; const r = 16;
    const seg = (p, q) => { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); };
    const slots = { R: [{ x: L, y: T }, { x: L + w / 2, y: T }], L: [{ x: L + w / 2, y: T }, { x: R, y: T }],
      C: [{ x: R, y: T }, { x: R, y: B }] };
    ctx.save();
    ctx.strokeStyle = colors.ink; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (const k of ELEMENTS) { if (has(k)) drawSymbol(ctx, k, ...slots[k]); else seg(...slots[k]); }
    ctx.strokeStyle = colors.ink; ctx.lineWidth = 2;
    seg({ x: R, y: B }, { x: L, y: B });
    seg({ x: L, y: B }, { x: L, y: cy + r }); seg({ x: L, y: cy - r }, { x: L, y: T });
    // the source: a circle round a sine wave
    ctx.strokeStyle = colors.vin;
    ctx.beginPath(); ctx.arc(L, cy, r, 0, 2 * Math.PI); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= 20; i += 1) {
      const x = L - 9 + (18 * i) / 20; const y = cy - 6 * Math.sin((2 * Math.PI * i) / 20);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    textLines(ctx, ['V₀', valueText(sliders.V0.get(), 'V')], { x: L + r + 8, y: cy }, 'left');
    if (has('R')) textLines(ctx, [`R = ${valueText(sliders.R.get(), 'Ω')}`], { x: L + w / 4, y: T - 24 }, 'center');
    if (has('L')) textLines(ctx, [`L = ${valueText(sliders.L.get() * 1e-3, 'H')}`], { x: L + (3 * w) / 4, y: T - 24 }, 'center');
    if (has('C')) textLines(ctx, ['C', valueText(sliders.C.get() * 1e-6, 'F')], { x: R - 20, y: cy }, 'right');
  }


  // ── Phasor plane: one function per quantity ──
  const turn = (z) => mul(z, fromPolar(1, time.omega() * time.t() * DEG)); // rotated by ωt

  function drawVin(ctx, at, vin, away) {
    const foot = at({ re: vin.re, im: 0 });
    line(ctx, at(vin), foot, colors.vin, { dashed: true });
    arrow(ctx, at(ZERO), at(vin), colors.vin, { width: 3 });
    dot(ctx, foot, colors.vin, 4);
    sideLabel(ctx, 'Vin', at(ZERO), at(vin), away, colors.vin, colors);
  }

  function drawDevice(ctx, at, k, from, to, away) {
    arrow(ctx, at(from), at(to), colors[k]);
    sideLabel(ctx, `V${k}`, at(from), at(to), away, colors[k], colors);
  }

  function drawCurrent(ctx, at, I, kI) {
    const tip = { re: I.re / kI, im: I.im / kI };
    const foot = at({ re: tip.re, im: 0 });
    line(ctx, at(tip), foot, colors.I, { dashed: true });
    arrow(ctx, at(ZERO), at(tip), colors.I, { width: 2, dashed: true });
    dot(ctx, foot, colors.I, 4);
    const p = at(tip); const o = at(ZERO);
    const d = Math.hypot(p.x - o.x, p.y - o.y) || 1; // the label sits just past the tip
    label(ctx, 'I', { x: p.x + ((p.x - o.x) / d) * 12, y: p.y + ((p.y - o.y) / d) * 12 }, colors.I, colors, 'center');
  }

  /** The current's scale, as one grid step in V and in A, in the plot's top-left corner. */
  function drawCurrentScale(ctx, f, kI) {
    const step = f.step.y;
    const amps = step * kI;
    const { prefix: p, scale } = prefix(amps);
    label(ctx, `I scale: ${num(step, step < 1 ? 1 : 0)} V ↔ ${num(amps * scale, amps * scale < 10 ? 1 : 0)} ${p}A`,
      { x: f.rect.L + 6, y: f.rect.T + 12 }, colors.I, colors);
  }

  function drawPhasorPlane() {
    const { ctx, W, H, laidOut } = prepCanvas(phasorCv, colors);
    const c = solved();
    const R = voltScale(c);
    const f = plotFrame(ctx, { x: 0, y: 0, w: W, h: H }, [-R, R], [-R, R],
      { colors, xTitle: 'Re (V)', yTitle: 'Im (V)', equal: true });
    const at = (z) => ({ x: f.X(z.re), y: f.Y(z.im) });
    const pts = chain(c).map(turn);
    // labels sit outside the KVL polygon (origin, the chain, back along V_in)
    const away = at({ re: pts.reduce((s, z) => s + z.re, 0) / pts.length, im: pts.reduce((s, z) => s + z.im, 0) / pts.length });
    if (shown('vin')) drawVin(ctx, at, turn(c.Vin), away);
    // V_L and V_C are antiparallel, so head to tail they overlap: the longest goes underneath
    // Without the KVL closure each starts at the origin, labelled on the side away from V_in.
    const kvl = shown('kvl');
    const segments = ELEMENTS.filter((k) => c.V[k]).map((k, i) => (kvl
      ? { k, from: pts[i], to: pts[i + 1], len: toPolar(c.V[k]).A }
      : { k, from: ZERO, to: turn(c.V[k]), len: toPolar(c.V[k]).A }));
    for (const s of segments.sort((a, b) => b.len - a.len)) {
      if (shown(`V${s.k}`)) drawDevice(ctx, at, s.k, s.from, s.to, kvl ? away : at(turn(c.Vin)));
    }
    if (c.I && shown('I')) {
      const kI = currentScale(c);
      drawCurrent(ctx, at, turn(c.I), kI);
      drawCurrentScale(ctx, f, kI);
    }
    frames.phasor = laidOut ? f : null;
  }

  // ── Time plot ──
  function drawTime() {
    const { ctx, W, H, laidOut } = prepCanvas(timeCv, colors);
    const c = solved();
    const omega = time.omega();
    const T = time.period();
    const { unit, scale: k } = timeUnit(T);
    const R = voltScale(c);
    const kI = currentScale(c);
    const amp = prefix(R * kI);
    const ampDecimals = (step) => Math.max(0, -Math.floor(Math.log10(step * kI * amp.scale) + 1e-9));
    const f = plotFrame(ctx, { x: 0, y: 0, w: W, h: H }, [-T, T], [-R, R], {
      colors, xTitle: `t (${unit})`, yTitle: 'v (V)',
      xFormat: (v) => num(v * k, Math.max(0, -Math.floor(Math.log10(niceStep(2 * T * k, 4))))),
      y2: c.I && shown('I') ? { title: `i (${amp.prefix}A)`, format: (v, step) => num(v * kI * amp.scale, ampDecimals(step)) } : null,
    });
    const signals = timeSignals(c, kI);
    for (const s of signals) curve(ctx, f, -T, T, (t) => evaluate(s.p, omega, t), s.color, s.width, { dashed: s.dashed });
    // The time cursor at t, and each curve's value there (its phasor's real-axis projection).
    const t = time.t();
    line(ctx, { x: f.X(t), y: f.rect.T }, { x: f.X(t), y: f.rect.B }, colors.ink, { width: 1.5 });
    dot(ctx, { x: f.X(t), y: f.rect.T }, colors.ink, 6);
    for (const s of signals) dot(ctx, { x: f.X(t), y: f.Y(evaluate(s.p, omega, t)) }, s.color, 4);
    frames.time = laidOut ? f : null;
  }

  /** The shown time signals as phasors on the volt axes (i(t) as i/kI), v_in underneath. */
  function timeSignals(c, kI) {
    const out = [];
    const sig = (key, z, extra = {}) => { if (z && shown(key)) out.push({ p: toPolar(z), color: colors[key], width: 2.5, ...extra }); };
    sig('vin', c.Vin, { width: 3 });
    for (const k of ELEMENTS) sig(`V${k}`, c.V[k]);
    if (c.I) sig('I', { re: c.I.re / kI, im: c.I.im / kI }, { width: 2, dashed: true });
    return out;
  }

  function draw() {
    if (!colors) readColors();
    drawImpedancePlane();
    drawPhasorPlane();
    drawTime();
    drawSchematic();
    time.place();
  }

  function update() {
    track();
    const c = solved();
    for (const k of ELEMENTS) {
      zReadouts[k].el.hidden = !c.Z[k];
      if (c.Z[k]) {
        zReadouts[k].rect.update(siRectText(c.Z[k], 'Ω'));
        zReadouts[k].polar.update(siPolarText(toPolar(c.Z[k]), 'Ω'));
      }
    }
    showRows();
    zReadouts.total.rect.update(siRectText(c.Z.total, 'Ω'));
    zReadouts.total.polar.update(siPolarText(toPolar(c.Z.total), 'Ω'));
    const w0 = resonance(); const wc = corner();
    w0Readout.el.hidden = w0 === null;
    wcReadout.el.hidden = wc === null;
    if (w0 !== null) w0Readout.update(`${num(w0, 0)} rad/s`);
    if (wc !== null) wcReadout.update(`${num(wc, 0)} rad/s`);
    phasorReadouts.vin.update(siPolarText(toPolar(c.Vin), 'V'));
    phasorReadouts.I.update(c.I ? siPolarText(toPolar(c.I), 'A') : 'unbounded (Z = 0)');
    for (const k of ELEMENTS) phasorReadouts[`V${k}`].update(c.V[k] ? siPolarText(toPolar(c.V[k]), 'V') : '—');
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
  const impedanceToScreen = screenOf(impedanceCv, 'impedance');
  const phasorToScreen = screenOf(phasorCv, 'phasor');
  const timeToScreen = screenOf(timeCv, 'time');
  const snap = (cv) => async () => { draw(); return cv.toDataURL('image/png'); };
  // The time cursor's handle rides the top edge of the time plot at t.
  time.attachCursor(
    (t) => { const p = timeToScreen(t, 0); return p && { x: p.x, y: timeCv.getBoundingClientRect().top + frames.time.rect.T }; },
    (cx) => (frames.time ? frames.time.ix(cx - timeCv.getBoundingClientRect().left) : time.t()),
  );

  readColors();
  update();

  const controls = { ...Object.fromEntries(ELEMENTS.map((k) => [`include${k}`, includes[k]])), ...sliders,
    ...traces, ...time.controls };

  return {
    state: {
      snapshot: getState,
      describe: () => structuredClone(STATE_INFO),
      onChange: (fn) => changes.on(fn),
    },
    controls: controlRegistry(controls),
    displays: [
      { id: 'impedance', label: 'Impedance plane', snapshot: snap(impedanceCv), toScreen: impedanceToScreen },
      { id: 'phasor', label: 'Phasor plane', snapshot: snap(phasorCv), toScreen: phasorToScreen },
      { id: 'time', label: 'Time plot', snapshot: snap(timeCv), toScreen: timeToScreen },
      { id: 'schematic', label: 'Schematic', snapshot: snap(schematicCv) },
    ],
    serialize: () => {
      const s = getState();
      return { ...Object.fromEntries(ELEMENTS.map((k) => [`include${k}`, s[`include${k}`]])),
        ...Object.fromEntries(NUMBERS.map((k) => [k, s[k]])),
        ...Object.fromEntries(TRACES.concat(OVERLAYS).map(([, stateKey]) => [stateKey, s[stateKey]])),
        ...time.serialize() };
    },
    restore(saved = {}) {
      saved = saved ?? {};
      quiet = true;
      try {
        // elements going on first, so the one-element guard never refuses a valid saved loop
        const want = (k) => saved[`include${k}`];
        for (const k of ELEMENTS) if (want(k) === true) includes[k].set(true);
        for (const k of ELEMENTS) if (want(k) === false) includes[k].set(false);
        for (const k of NUMBERS) if (finite(saved[k])) sliders[k].set(saved[k]);
        for (const [key, stateKey] of TRACES.concat(OVERLAYS)) if (typeof saved[stateKey] === 'boolean') traces[key].set(saved[stateKey]);
        time.restore(saved);
      } finally {
        quiet = false;
      }
      sweep = null;
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
