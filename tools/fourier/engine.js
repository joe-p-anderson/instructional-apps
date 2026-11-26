// Fourier engine (pure maths, no DOM): the Fourier Tool's only source of signal maths.
//
// Input: { waveform, amp, f0, offset, shift }
//   waveform  'sine' | 'square' | 'triangle' | 'sawtooth' (WAVEFORMS)
//   amp       V, the waveform's peak (a ±amp swing about the offset)
//   f0        Hz, the fundamental frequency
//   offset    V, the DC offset
//   shift     degrees of the fundamental; the waveform is delayed by shift/360 of a period
//
// Series: { f0, dc, terms: [{ n, amp, phase }] } with terms[n − 1] for n = 1 … nMax, meaning
//   v(t) = dc + Σ amp·cos(2π n f0 t + phase)      (cos convention, phase in degrees, amp ≥ 0)
// Tables are exact and unsmoothed, so partial sums show the Gibbs overshoot.
//
// Alignments (shift = 0): every waveform starts at its mean, rising, at t = 0 (as bench-scope's
// generator does), so all of them are odd functions of t and every φn is ±90°.
//   sine      amp·sin(2π f0 t): A1 = amp at φ1 = −90°, and An = 0 for n ≥ 2.
//   square    +amp for the first half period, −amp for the second: An = 4·amp/(πn) for odd n at
//             φn = −90°, and An = 0 for even n.
//   triangle  rises from 0 to +amp at T/4, falls to −amp at 3T/4, back to 0 at T:
//             An = 8·amp/(π²n²) for odd n, at φn = −90° for n = 1, 5, 9, … and +90° for
//             n = 3, 7, 11, …; An = 0 for even n.
//   sawtooth  ramps from 0 up to +amp just before T/2, jumps to −amp, ramps back to 0 at T:
//             An = 2·amp/(πn) for every n, at φn = −90° for odd n and +90° for even n.
// Square and sawtooth jump, so their terms fall as 1/n; the triangle only has corners, so its
// terms fall as 1/n².
// A shift of Δφ degrees adds −nΔφ to each φn; the DC offset is only the n = 0 term.
//
// Time t is in seconds throughout.

import { filterGain } from '../bench-scope/engine/signal.js';

export const MAX_N = 100; // the N slider's range, and the default table length

const TAU = 2 * Math.PI;

/** Wrap an angle in degrees into (−180, 180]. */
function wrapDeg(deg) {
  const w = ((deg % 360) + 360) % 360;
  return w > 180 ? w - 360 : w;
}

// Each waveform's table at amp = 1, shift = 0: n -> { amp, phase (degrees) }.
const ZERO = { amp: 0, phase: 0 };
const UNIT_TERMS = {
  sine: (n) => (n === 1 ? { amp: 1, phase: -90 } : ZERO),
  square: (n) => (n % 2 ? { amp: 4 / (Math.PI * n), phase: -90 } : ZERO),
  triangle: (n) => (n % 2 ? { amp: 8 / (Math.PI * n) ** 2, phase: n % 4 === 1 ? -90 : 90 } : ZERO),
  sawtooth: (n) => ({ amp: 2 / (Math.PI * n), phase: n % 2 ? -90 : 90 }),
};

// Each waveform over one period at amp = 1, shift = 0: p = t·f0 in [0, 1) -> value.
const UNIT_SHAPES = {
  sine: (p) => Math.sin(TAU * p),
  square: (p) => (p === 0 || p === 0.5 ? 0 : p < 0.5 ? 1 : -1),
  triangle: (p) => (p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4),
  sawtooth: (p) => (p === 0.5 ? 0 : p < 0.5 ? 2 * p : 2 * p - 2),
};

/** The waveforms the engine knows, in the order the waveform select lists them. */
export const WAVEFORMS = Object.keys(UNIT_TERMS);

function check(waveform) {
  if (!UNIT_TERMS[waveform]) throw new Error(`fourier engine: unknown waveform '${waveform}'`);
}

/** The exact harmonic table of an input, for n = 1 … nMax. */
export function series({ waveform, amp, f0, offset = 0, shift = 0 }, nMax = MAX_N) {
  check(waveform);
  const terms = [];
  for (let n = 1; n <= nMax; n += 1) {
    const unit = UNIT_TERMS[waveform](n);
    const a = unit.amp * amp;
    terms.push({ n, amp: a, phase: a === 0 ? 0 : wrapDeg(unit.phase - n * shift) });
  }
  return { f0, dc: offset, terms };
}

/** The ideal waveform at time t (at a jump, the midpoint of the two sides). */
export function ideal({ waveform, amp, f0, offset = 0, shift = 0 }, t) {
  check(waveform);
  const cycles = t * f0 - shift / 360;
  const p = cycles - Math.floor(cycles);
  return offset + amp * UNIT_SHAPES[waveform](p);
}

/**
 * The N = ∞ curve of the unfiltered series at time t: the ideal waveform. For a filtered
 * series, see limitCurve(input, filter) below.
 */
export function limit(input, t) {
  return ideal(input, t);
}

/** Term n of a series at time t: the DC term for n = 0, else An·cos(2π n f0 t + φn). */
export function harmonic(s, n, t) {
  if (n === 0) return s.dc;
  const term = s.terms[n - 1];
  if (!term) throw new Error(`fourier engine: the series has no harmonic ${n}`);
  if (term.amp === 0) return 0;
  return term.amp * Math.cos(TAU * n * s.f0 * t + (term.phase * Math.PI) / 180);
}

/** The partial sum through harmonic N (DC included) at time t. */
export function partialSum(s, N, t) {
  let v = s.dc;
  for (let n = 1; n <= N; n += 1) v += harmonic(s, n, t);
  return v;
}

// ── The RC filter (ticket 04) ──
//
// Filter: { type, fc, gain, phase }
//   type   'off' | 'lowpass' | 'highpass' (FILTER_TYPES): a first-order RC low-pass (output V_C,
//          H = 1/(1 + j f/fc)) or high-pass (output V_R, H = j(f/fc)/(1 + j f/fc))
//   fc     Hz, the cutoff; τ = 1/(2π fc)
//   gain   whether each harmonic is scaled by |H(n f0)| (and the DC term by H(0))
//   phase  whether ∠H(n f0) is added to each harmonic's phase
// The complex gain is bench-scope's filterGain, imported (not copied).

export const FILTER_TYPES = ['off', 'lowpass', 'highpass'];

const isOn = (filter) => Boolean(filter) && (filter.type === 'lowpass' || filter.type === 'highpass')
  && (filter.gain || filter.phase);

/** A series passed through the filter: harmonic by harmonic, gain and phase as toggled. */
export function filterSeries(s, filter) {
  if (!isOn(filter)) return { f0: s.f0, dc: s.dc, terms: s.terms.map((t) => ({ ...t })) };
  const rc = { type: filter.type, fc: filter.fc };
  return {
    f0: s.f0,
    dc: filter.gain ? s.dc * filterGain(rc, 0).re : s.dc,
    terms: s.terms.map(({ n, amp, phase }) => {
      if (amp === 0) return { n, amp, phase };
      const h = filterGain(rc, n * s.f0);
      return {
        n,
        amp: filter.gain ? amp * Math.hypot(h.re, h.im) : amp,
        phase: filter.phase ? wrapDeg(phase + (Math.atan2(h.im, h.re) * 180) / Math.PI) : phase,
      };
    }),
  };
}

// Each piecewise-linear waveform over one period at amp = 1, shift = 0, as segments
// [p0, p1) on which v = a + b·(p − p0) (p = t·f0, so b is per period).
const UNIT_SEGMENTS = {
  square: [{ p0: 0, p1: 0.5, a: 1, b: 0 }, { p0: 0.5, p1: 1, a: -1, b: 0 }],
  triangle: [{ p0: 0, p1: 0.25, a: 0, b: 4 }, { p0: 0.25, p1: 0.75, a: 1, b: -4 },
    { p0: 0.75, p1: 1, a: -1, b: 4 }],
  sawtooth: [{ p0: 0, p1: 0.5, a: 0, b: 2 }, { p0: 0.5, p1: 1, a: -1, b: 2 }],
};

/**
 * The analytic periodic steady state of the RC circuit, V_C for low-pass and V_R = v_in − V_C
 * for high-pass, as a function of t. On each linear segment v = a + b·s of the input, V_C is the
 * particular solution a + b·(s − τ) plus C·e^(−s/τ); V_C is continuous, and C is fixed by
 * requiring V_C to be periodic. The sine uses its single-harmonic result.
 */
function rcSteadyState(input, filter) {
  const { waveform, amp, f0, offset = 0, shift = 0 } = input;
  if (waveform === 'sine') {
    const s = filterSeries(series(input, 1), { ...filter, gain: true, phase: true });
    return (t) => partialSum(s, 1, t);
  }
  const tau = f0 / (TAU * filter.fc); // τ in periods
  const segs = UNIT_SEGMENTS[waveform].map(({ p0, p1, a, b }) => ({ p0, p1, a: offset + amp * a, b: amp * b }));
  // V_C at the end of a segment from its value y at the start.
  const across = ({ p0, p1, a, b }, y, len = p1 - p0) => a + b * (len - tau) + (y - (a - b * tau)) * Math.exp(-len / tau);
  // One period is affine in V_C(0): V_C(1) = α + β·V_C(0), with β = e^(−1/τ). Periodic: V_C(0) = α/(1 − β).
  const alpha = segs.reduce((y, seg) => across(seg, y), 0);
  const y0 = alpha / (1 - Math.exp(-1 / tau));
  const starts = [];
  segs.reduce((y, seg) => { starts.push(y); return across(seg, y); }, y0);
  return (t) => {
    const cycles = t * f0 - shift / 360;
    const p = cycles - Math.floor(cycles);
    const k = segs.findIndex((seg) => p < seg.p1);
    const seg = segs[k === -1 ? segs.length - 1 : k];
    const vc = across(seg, starts[segs.indexOf(seg)], p - seg.p0);
    return filter.type === 'lowpass' ? vc : ideal(input, t) - vc;
  };
}

export const LIMIT_N = 1000; // harmonics in the numerical N = ∞ curve (gain only or phase only)

/**
 * The N = ∞ curve of the filtered series, as a function of t (seconds): the limit of the
 * partial sums of filterSeries(series(input), filter). With no filter (type 'off', or both
 * toggles off) it is the ideal waveform; with gain and phase both on it is the analytic RC
 * steady state; with one toggle on it is the partial sum through LIMIT_N.
 */
export function limitCurve(input, filter) {
  check(input.waveform);
  if (!isOn(filter)) return (t) => ideal(input, t);
  if (filter.gain && filter.phase) return rcSteadyState(input, filter);
  const s = filterSeries(series(input, LIMIT_N), filter);
  return (t) => partialSum(s, LIMIT_N, t);
}
