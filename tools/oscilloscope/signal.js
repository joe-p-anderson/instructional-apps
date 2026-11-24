// Pure signal maths for the oscilloscope Tool (no DOM).
// Two traces: Va·cos(2π f t) and Va·cos(2π f (t + Δt)).

/** Derived metrics from the signal parameters. */
export function metrics({ Va, f, Dt }) {
  return { phi: 2 * Math.PI * f * Dt, T: 1 / f, pkpk: 2 * Va };
}

/** n evenly spaced samples from a to b inclusive. */
export function linspace(a, b, n) {
  const r = new Array(n);
  for (let i = 0; i < n; i++) r[i] = a + ((b - a) * i) / (n - 1);
  return r;
}

/** Samples of Va·cos(2π f (t + offset)) at each t. */
export function cosWave(ts, Va, f, offset) {
  return ts.map((t) => Va * Math.cos(2 * Math.PI * f * (t + offset)));
}
