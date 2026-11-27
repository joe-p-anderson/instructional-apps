// Phasors Tool, Circuit Mode: one series loop of R, L and/or C driven by V₀ cos(ωt). The source
// has phase 0 and is the phase reference.
//
// Setup: { includeR, includeL, includeC (booleans), V0 (V), R (Ω), L (mH), C (µF), omega (rad/s) }
//   (any subset; DEFAULTS below).
// State (state.snapshot(), each with a label and unit in describe()):
//   mode ('circuit'); the Controls includeR, includeL, includeC, V0 (V), R (Ω), L (mH), C (µF),
//   showVin, showI, showVR, showVL, showVC, showZtotal, showKVL (the toggles); the solved circuit ZtotRe, ZtotIm,
//   ZtotMag (Ω), angleZ (°), IMag (A), angleI (°), VRMag, VLMag, VCMag (V), angleVR, angleVL,
//   angleVC (°) — null for an excluded element, and I and every V_k null when Z = 0 (L and C alone
//   exactly at ω₀); omega0 (rad/s, ω₀ = 1/√(LC), null unless L and C are both on), omegaC (rad/s,
//   ω_c = 1/(RC), null unless R and C are on without L); omegaMin, omegaMax (rad/s, the range of ω
//   swept since mount, kept through serialize and restore, for sweep Conditions); and the time
//   State omega, f, t, playing
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
//   readouts (a + jb and A∠φ°), whatever the toggle says: hiding I also hides i(t), the time plot's A axis and the
//   I scale; hiding Z_total also hides the Z_total readouts, never Z_R, Z_L or Z_C. 'vin' hides
//   the same way, but V_in is the given source, not a layer to reveal. State keeps publishing
//   every solved value while its layer is hidden.
//   the shared time Controls 'omega', 'play', 't' and 'cursor' (../time-controls.js)
// Readouts (status regions): each impedance and each phasor in both forms, "Z_R rectangular",
//   "Z_R polar", ..., "Z_total polar", "V_in rectangular", "I polar", "V_C polar", ...; "ω₀", "ω_c".
// Displays: 'impedance' (the static impedance plane: Z_R along +Re, Z_L along +Im, Z_C along −Im
//   and Z_total, each from the origin, Z_total with dashed drops to the axes and ∠Z marked by an
//   arc; auto-scaled to fit every arrow, its axes in Ω, kΩ or MΩ; toScreen(re, im) in Ω),
//   'phasor' (the rotating phasor plane: V_in from the origin, V_R, V_L, V_C head to tail
//   closing on V_in, and I dashed on its own scale, every phasor rotated by ωt; toScreen(re, im) in
//   V) , 'time' (v_in(t), v_R(t), v_L(t), v_C(t) on the left axis in V, and i(t) dashed on the
//   right-hand axis in A, over t ∈ [−T, T], with the time cursor; toScreen(t, v) with t in s and v
//   in V) and 'schematic' (the series loop: the source and whichever of R, L and C are in it, each
//   with its value; its accessible name lists them; ../schematic.js). I is drawn as I/kI on the
//   volt axes, kI (A per V) the smallest 1-2-5 step that keeps it no longer than V_in, so both
//   Displays share one current scale. The volt axes fit V₀ and what the shown layers can draw, so
//   their range never hints at a hidden device voltage.
// Colours (one per quantity, the same in every Display and the legend): V_in ink, I green,
//   R (V_R, and Z_R) trace 1 blue, L trace 2 red, C yellow (gold), Z_total ink like V_in (V_in =
//   I·Z_total, as V_k = I·Z_k shares Z_k's colour).
// serialize() is every settable value plus { omega, t, omegaMin, omegaMax }; restore() pauses,
//   ignores bad values, clamps numbers (the swept range too, which then widens to take in the
//   restored ω), keeps at least one element on, and reports once.
//
// All circuit maths is the engine's (../engine.js); drawing helpers are ../draw.js and
// ../display.js.
import { controlRegistry } from '../../../framework/v1/control.js';
import { createEmitter } from '../../../framework/v1/tool.js';
import { h, metric, section, slider, themeVars, toggle } from '../../../framework/v1/ui-kit.js';
import { plotTheme } from '../../../framework/v1/plot-theme.js';
import { add, evaluate, fromPolar, mul, omega0, omegaC, solve, toPolar } from '../engine.js';
import { angleArc, arrow, curve, dot, label, line, niceFine, plotFrame, prepCanvas, sideLabel, tipLabel } from '../draw.js';
import { attachTimeCursor, drawTimeCursor, paintSwatches, redrawOnResize, screenMapper, snapshotOf, timeAxis } from '../display.js';
import { num, prefix, siPolarText, siRectText } from '../format.js';
import { LAYERS } from '../layers.js';
import { clamp, DEG, finite } from '../numbers.js';
import { drawSchematic } from '../schematic.js';
import { toolStyles } from '../styles.js';
import { OMEGA_MAX, OMEGA_MIN, TIME_STATE_INFO, timeControls } from '../time-controls.js';

export const id = 'circuit';
export const title = 'Circuit';
export const setupKeys = ['includeR', 'includeL', 'includeC', 'V0', 'R', 'L', 'C', 'omega'];

const ELEMENTS = ['R', 'L', 'C'];
const DEFAULTS = { includeR: true, includeL: true, includeC: true, V0: 5, R: 100, L: 50, C: 2, omega: 1000 };
const RANGES = {
  V0: { min: 0.1, max: 10 },
  R: { min: 1, max: 1e4 },
  L: { min: 0.1, max: 1000 },
  C: { min: 0.01, max: 100 },
};
const NUMBERS = ['V0', 'R', 'L', 'C'];
// Each number Control's unit in SI units: L is set in mH and C in µF.
const TO_SI = { V0: 1, R: 1, L: 1e-3, C: 1e-6 };

// The toggles, by Control id: V_in's, then the revealable layers (../layers.js). A trace is a
// drawn phasor, with a legend swatch and readouts in the Phasors section.
const TOGGLES = {
  vin: { state: 'showVin', name: 'V_in', html: 'V<sub>in</sub>', trace: true },
  Ztotal: { state: 'showZtotal', name: 'Z_total', label: 'Show Z<sub>total</sub>' },
  I: { state: 'showI', name: 'I', html: 'I', trace: true },
  VR: { state: 'showVR', name: 'V_R', html: 'V<sub>R</sub>', trace: true },
  VL: { state: 'showVL', name: 'V_L', html: 'V<sub>L</sub>', trace: true },
  VC: { state: 'showVC', name: 'V_C', html: 'V<sub>C</sub>', trace: true },
  kvl: { state: 'showKVL', name: 'KVL closure', label: 'Show KVL closure (head to tail)' },
};
const TOGGLE_IDS = ['vin', ...LAYERS.circuit];
const TRACES = ['vin', 'I', 'VR', 'VL', 'VC'];

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
  IMag: { label: 'Current amplitude |I|', unit: 'A' },
  angleI: { label: 'Current phase ∠I', unit: '°' },
  VRMag: { label: 'Amplitude |V_R|', unit: 'V' },
  angleVR: { label: 'Phase ∠V_R', unit: '°' },
  VLMag: { label: 'Amplitude |V_L|', unit: 'V' },
  angleVL: { label: 'Phase ∠V_L', unit: '°' },
  VCMag: { label: 'Amplitude |V_C|', unit: 'V' },
  angleVC: { label: 'Phase ∠V_C', unit: '°' },
  omega0: { label: 'Resonance ω₀ = 1/√(LC)', unit: 'rad/s' },
  omegaC: { label: 'Corner ω_c = 1/(RC)', unit: 'rad/s' },
  omegaMin: { label: 'Lowest ω swept', unit: 'rad/s' },
  omegaMax: { label: 'Highest ω swept', unit: 'rad/s' },
  ...TIME_STATE_INFO,
};

const ZERO = { re: 0, im: 0 };
const size = (z) => Math.hypot(z.re, z.im);
/** The points of the head-to-tail chain of complex numbers zs (nulls skipped), from the origin. */
function chain(zs) {
  const pts = [ZERO];
  for (const z of zs) if (z) pts.push(add(pts[pts.length - 1], z));
  return pts;
}
const centroid = (pts) => ({ re: pts.reduce((a, z) => a + z.re, 0) / pts.length, im: pts.reduce((a, z) => a + z.im, 0) / pts.length });

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
  const has = (k) => includes[k].get();

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
  /** Number Control k's value in SI units (Ω, H, F, V). */
  const si = (k) => sliders[k].get() * TO_SI[k];

  const traces = {};
  for (const key of TOGGLE_IDS) {
    const t = TOGGLES[key];
    traces[key] = toggle({ id: key, name: `Show ${t.name}`, value: true,
      label: t.label ?? `<span class="fw-legend-line ph-swatch" data-color="${key}"></span>${t.html}`,
      onChange: changed, onHide: () => { showRows(); draw(); } });
  }
  const shown = (key) => !traces[key].isHidden() && traces[key].get();

  // ── The solved circuit ──
  const solved = () => solve({ V0: si('V0'), R: si('R'), L: si('L'), C: si('C'), include: included(), omega: time.omega() });
  const resonance = () => (has('L') && has('C') ? omega0(si('L'), si('C')) : null);
  const corner = () => (has('R') && has('C') && !has('L') ? omegaC(si('R'), si('C')) : null);
  let sweep = null; // { min, max } of ω since mount (or the restored range)
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
    for (const key of TOGGLE_IDS) out[TOGGLES[key].state] = traces[key].get();
    Object.assign(out, {
      ZtotRe: c.Z.total.re, ZtotIm: c.Z.total.im, ZtotMag: Z.A, angleZ: Z.phi,
      IMag: I ? I.A : null, angleI: I ? I.phi : null,
    });
    for (const k of ELEMENTS) {
      const v = polar(c.V[k]);
      out[`V${k}Mag`] = v ? v.A : null;
      out[`angleV${k}`] = v ? v.phi : null;
    }
    return { ...out, omega0: resonance(), omegaC: corner(), omegaMin: sweep.min, omegaMax: sweep.max,
      ...time.state() };
  }

  // ── Readouts: every impedance and phasor in both forms ──
  const twoForms = (name, polarLabel) => {
    const r = { rect: metric({ name: `${name} rectangular`, label: 'a + jb' }),
      polar: metric({ name: `${name} polar`, label: polarLabel }) };
    r.show = (rectText, polarText) => { r.rect.update(rectText); r.polar.update(polarText); };
    return r;
  };
  const zReadout = (key, name, html) => {
    const r = twoForms(name, '|Z|∠θ');
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
  const phasorReadouts = Object.fromEntries(TRACES.map((key) => [key, twoForms(TOGGLES[key].name, 'A∠φ')]));
  const traceRows = Object.fromEntries(TRACES.map((key) => [key,
    h('div', { class: 'ph-trace' }, traces[key].el, phasorReadouts[key].rect.el, phasorReadouts[key].polar.el)]));
  /** A row shows unless its element is out of the loop or its layer is hidden (the toggle hides itself). */
  function showRows() {
    const c = solved();
    for (const key of TRACES) traceRows[key].hidden = traces[key].isHidden();
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
      section('Phasors', ...TRACES.map((key) => traceRows[key]), traces.kvl.el)),
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
    paintSwatches(root, colors);
  }

  // ── Scales ──
  // The volt axes reach V₀ and what the layers not hidden can draw: each device voltage's
  // amplitude (on the time plot, or from the origin), and with the KVL closure every point of the
  // head-to-tail chain (V_L and V_C can exceed V₀ near ω₀). A hidden layer never widens them.
  // I is drawn as I/kI, kI the smallest round step (1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ⁿ
  // A per V) that keeps it within V₀, so the I arrow is most of V₀'s length.
  const currentScale = (c) => (c.I ? niceFine(size(c.I) / si('V0')) : 1);
  function voltScale(c) {
    const open = (key) => !traces[key].isHidden();
    const present = ELEMENTS.filter((k) => c.V[k]);
    const visible = present.filter((k) => open(`V${k}`));
    const reach = [si('V0'), ...visible.map((k) => size(c.V[k]))];
    if (open('kvl') && visible.length === present.length) reach.push(...chain(present.map((k) => c.V[k])).map(size));
    return niceFine(Math.max(...reach) * 1.08);
  }
  const frames = { impedance: null, phasor: null, time: null };

  // ── Impedance plane (static): Z_R, Z_L, Z_C and Z_total, each from the origin ──
  // Z_R lies along +Re, Z_L along +Im and Z_C along −Im. The ranges reach just past the longest
  // arrow each way (Z_total included, so hiding it never changes the scale), with a little room
  // on the side no arrow uses so the axis stays visible; the plot frame then widens the shorter
  // range to fill its box at an equal scale.
  function impedanceRanges(c) {
    const zs = [...ELEMENTS.map((k) => c.Z[k]).filter(Boolean), c.Z.total];
    const right = Math.max(0, ...zs.map((z) => z.re));
    const up = Math.max(0, ...zs.map((z) => z.im));
    const down = Math.max(0, ...zs.map((z) => -z.im));
    const S = niceFine(Math.max(right, up, down) * 1.1 || 1);
    const room = S * 0.15;
    // past each arrow's tip there is room for its label; rounded up to a fine step, so an arrow
    // visibly grows or shrinks as ω moves between steps
    const reach = (v) => (v > 0 ? niceFine(v * 1.05 + S * 0.12) : room);
    return { S, xr: [-room, reach(right)], yr: [-reach(down), reach(up)] };
  }

  /** Z_total from the origin, dashed drops to its parts on the axes, and ∠Z as an arc off Re. */
  function drawZtotal(ctx, at, Z) {
    if (size(Z) < 1e-9) return;
    line(ctx, at(Z), at({ re: Z.re, im: 0 }), colors.total, { dashed: true });
    line(ctx, at(Z), at({ re: 0, im: Z.im }), colors.total, { dashed: true });
    arrow(ctx, at(ZERO), at(Z), colors.total, { width: 3 });
    tipLabel(ctx, 'Z', at(ZERO), at(Z), colors.total, colors);
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
    const { S, xr, yr } = impedanceRanges(c);
    const { prefix: p, scale } = prefix(S);
    const fmt = (v, step) => num(v * scale, Math.max(0, -Math.floor(Math.log10(step * scale) + 1e-9)));
    const f = plotFrame(ctx, { x: 0, y: 0, w: W, h: H }, xr, yr,
      { colors, xTitle: `Re (${p}Ω)`, yTitle: `Im (${p}Ω)`, xFormat: fmt, yFormat: fmt, equal: true });
    const at = (z) => ({ x: f.X(z.re), y: f.Y(z.im) });
    if (shown('Ztotal')) drawZtotal(ctx, at, c.Z.total);
    for (const k of ELEMENTS.filter((e) => c.Z[e])) {
      arrow(ctx, at(ZERO), at(c.Z[k]), colors[k]);
      tipLabel(ctx, `Z${k}`, at(ZERO), at(c.Z[k]), colors[k], colors);
    }
    frames.impedance = laidOut ? f : null;
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
    const pts = chain(ELEMENTS.map((k) => c.V[k])).map(turn);
    // labels sit outside the KVL polygon (origin, the chain, back along V_in)
    const away = at(centroid(pts));
    if (shown('vin')) drawVin(ctx, at, turn(c.Vin), away);
    // V_L and V_C are antiparallel, so head to tail they overlap: the longest goes underneath
    // Without the KVL closure each starts at the origin, labelled on the side away from V_in.
    const kvl = shown('kvl');
    const segments = ELEMENTS.filter((k) => c.V[k]).map((k, i) => (kvl
      ? { k, from: pts[i], to: pts[i + 1], len: size(c.V[k]) }
      : { k, from: ZERO, to: turn(c.V[k]), len: size(c.V[k]) }));
    for (const sg of segments.sort((a, b) => b.len - a.len)) {
      if (shown(`V${sg.k}`)) drawDevice(ctx, at, sg.k, sg.from, sg.to, kvl ? away : at(turn(c.Vin)));
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
    const R = voltScale(c);
    const kI = currentScale(c);
    const amp = prefix(R * kI);
    const ampDecimals = (step) => Math.max(0, -Math.floor(Math.log10(step * kI * amp.scale) + 1e-9));
    const f = plotFrame(ctx, { x: 0, y: 0, w: W, h: H }, [-T, T], [-R, R], {
      colors, yTitle: 'v (V)', ...timeAxis(T),
      y2: c.I && shown('I') ? { title: `i (${amp.prefix}A)`, format: (v, step) => num(v * kI * amp.scale, ampDecimals(step)) } : null,
    });
    const signals = timeSignals(c, kI);
    for (const s of signals) curve(ctx, f, -T, T, (t) => evaluate(s.p, omega, t), s.color, s.width, { dashed: s.dashed });
    // The time cursor at t, and each curve's value there (its phasor's real-axis projection).
    const t = time.t();
    drawTimeCursor(ctx, f, t, colors, signals.map((s) => ({ v: evaluate(s.p, omega, t), color: s.color })), 4);
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
    drawSchematic(schematicCv, { colors, include: included(),
      values: { V0: si('V0'), R: si('R'), L: si('L'), C: si('C') } });
    time.place();
  }

  function update() {
    track();
    const c = solved();
    for (const k of ELEMENTS) {
      zReadouts[k].el.hidden = !c.Z[k];
      if (c.Z[k]) zReadouts[k].show(siRectText(c.Z[k], 'Ω'), siPolarText(toPolar(c.Z[k]), 'Ω'));
    }
    showRows();
    zReadouts.total.show(siRectText(c.Z.total, 'Ω'), siPolarText(toPolar(c.Z.total), 'Ω'));
    const w0 = resonance(); const wc = corner();
    w0Readout.el.hidden = w0 === null;
    wcReadout.el.hidden = wc === null;
    if (w0 !== null) w0Readout.update(`${num(w0, 0)} rad/s`);
    if (wc !== null) wcReadout.update(`${num(wc, 0)} rad/s`);
    const showPhasor = (key, z, unit, none) => phasorReadouts[key].show(
      z ? siRectText(z, unit) : none, z ? siPolarText(toPolar(z), unit) : none);
    showPhasor('vin', c.Vin, 'V');
    showPhasor('I', c.I, 'A', 'unbounded (Z = 0)');
    for (const k of ELEMENTS) showPhasor(`V${k}`, c.V[k], 'V', '—');
    draw();
    changes.emit(getState());
  }

  const stopResizing = redrawOnResize(root, draw);
  const snap = (cv) => snapshotOf(cv, draw);
  attachTimeCursor(time, timeCv, frames);

  readColors();
  update();

  const controls = { ...Object.fromEntries(ELEMENTS.map((k) => [`include${k}`, includes[k]])), ...sliders,
    ...traces, ...time.controls };
  const omegaIn = (v) => clamp(Number(v), OMEGA_MIN, OMEGA_MAX);

  return {
    state: {
      snapshot: getState,
      describe: () => structuredClone(STATE_INFO),
      onChange: (fn) => changes.on(fn),
    },
    controls: controlRegistry(controls),
    displays: [
      { id: 'impedance', label: 'Impedance plane', snapshot: snap(impedanceCv), toScreen: screenMapper(impedanceCv, frames, 'impedance') },
      { id: 'phasor', label: 'Phasor plane', snapshot: snap(phasorCv), toScreen: screenMapper(phasorCv, frames, 'phasor') },
      { id: 'time', label: 'Time plot', snapshot: snap(timeCv), toScreen: screenMapper(timeCv, frames, 'time') },
      { id: 'schematic', label: 'Schematic', snapshot: snap(schematicCv) },
    ],
    serialize: () => {
      const s = getState();
      return { ...Object.fromEntries(ELEMENTS.map((k) => [`include${k}`, s[`include${k}`]])),
        ...Object.fromEntries(NUMBERS.map((k) => [k, s[k]])),
        ...Object.fromEntries(TOGGLE_IDS.map((key) => [TOGGLES[key].state, s[TOGGLES[key].state]])),
        ...time.serialize(), omegaMin: s.omegaMin, omegaMax: s.omegaMax };
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
        for (const key of TOGGLE_IDS) {
          const v = saved[TOGGLES[key].state];
          if (typeof v === 'boolean') traces[key].set(v);
        }
        time.restore(saved);
      } finally {
        quiet = false;
      }
      // the saved swept range, if it is one; update() widens it to take in the restored ω
      const { omegaMin: lo, omegaMax: hi } = saved;
      sweep = finite(lo) && finite(hi) && Number(lo) <= Number(hi) ? { min: omegaIn(lo), max: omegaIn(hi) } : null;
      update();
    },
    resize: () => { readColors(); draw(); },
    destroy() {
      time.destroy();
      stopResizing();
      changes.clear();
      root.remove();
    },
  };
}
