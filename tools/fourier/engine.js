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
 * The N = ∞ curve at time t: the limit of the partial sums. With no filter (all ticket 02 has)
 * it is the ideal waveform; ticket 04 adds the filtered limits.
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
