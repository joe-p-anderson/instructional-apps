// Periodic signals as Fourier series, and exact steady-state filtering of them. Pure, no DOM.
//
// A series is { freq, dc, terms: [{ n, amp, phase }] }, meaning
//   v(t) = dc + Σ amp · sin(2π · n · freq · t + phase)        (phase in radians)
// Filtering multiplies each harmonic (and the DC term) by the filter's complex gain at that
// frequency, so there is no start-up transient and the gain and phase at the fundamental are the
// textbook values exactly.
//
//   waveSeries({ wave, freq, vpp, offset })    the series of a generator waveform (see source.js:
//                                              all start at their mean, rising, at t = 0)
//   filterGain(filter, f) -> { re, im }        complex gain; filter is one of
//                                                { type: 'lowpass',  fc }      first-order RC
//                                                { type: 'highpass', fc }      first-order RC
//                                                { type: 'bandpass', f0, q }   second-order, unity at f0
//   gainAndPhase(filter, f) -> { gain, phase } |H| and arg H in degrees
//   filterSeries(series, filter) -> series
//   seriesSignal(series) -> (t) => volts       pure function of time (one period tabulated once)
//   seriesRange(series) -> { min, max }        of the synthesised waveform

/** Highest harmonic kept for square and triangle waves. */
export const MAX_HARMONIC = 1023;
const TABLE = 4096; // samples per period of a synthesised waveform

export function waveSeries({ wave, freq, vpp, offset }) {
  const a = vpp / 2;
  const terms = [];
  if (wave === 'square' || wave === 'triangle') {
    for (let n = 1; n <= MAX_HARMONIC; n += 2) {
      // Lanczos sigma factor: tames the Gibbs ringing of the truncated series.
      const x = (Math.PI * n) / (MAX_HARMONIC + 1);
      const sigma = Math.sin(x) / x;
      if (wave === 'square') terms.push({ n, amp: sigma * (4 * a) / (Math.PI * n), phase: 0 });
      else {
        const sign = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
        terms.push({ n, amp: sigma * (8 * a) / (Math.PI * Math.PI * n * n), phase: sign > 0 ? 0 : Math.PI });
      }
    }
  } else {
    terms.push({ n: 1, amp: a, phase: 0 });
  }
  return { freq, dc: offset, terms };
}

/** Amplitude of the fundamental of a generator waveform (exact, not truncated). */
export function fundamentalAmplitude(wave, vpp) {
  const a = vpp / 2;
  if (wave === 'square') return (4 * a) / Math.PI;
  if (wave === 'triangle') return (8 * a) / (Math.PI * Math.PI);
  return a;
}

export function filterGain(filter, f) {
  // H = num / den, both complex.
  let num;
  let den;
  if (filter.type === 'lowpass') {
    const x = f / filter.fc;
    num = { re: 1, im: 0 };
    den = { re: 1, im: x };
  } else if (filter.type === 'highpass') {
    const x = f / filter.fc;
    num = { re: 0, im: x };
    den = { re: 1, im: x };
  } else if (filter.type === 'bandpass') {
    const u = f / filter.f0;
    const y = u / filter.q;
    num = { re: 0, im: y };
    den = { re: 1 - u * u, im: y };
  } else {
    return { re: 1, im: 0 };
  }
  const d = den.re * den.re + den.im * den.im;
  return {
    re: (num.re * den.re + num.im * den.im) / d,
    im: (num.im * den.re - num.re * den.im) / d,
  };
}

export function gainAndPhase(filter, f) {
  const h = filterGain(filter, f);
  return { gain: Math.hypot(h.re, h.im), phase: (Math.atan2(h.im, h.re) * 180) / Math.PI };
}

export function filterSeries(series, filter) {
  const h0 = filterGain(filter, 0);
  return {
    freq: series.freq,
    dc: series.dc * h0.re,
    terms: series.terms.map(({ n, amp, phase }) => {
      const h = filterGain(filter, n * series.freq);
      return { n, amp: amp * Math.hypot(h.re, h.im), phase: phase + Math.atan2(h.im, h.re) };
    }),
  };
}

const tables = new WeakMap();

/** One period of the series, TABLE samples, cached per series object. */
function table(series) {
  let tab = tables.get(series);
  if (tab) return tab;
  tab = new Float64Array(TABLE).fill(series.dc);
  for (const { n, amp, phase } of series.terms) {
    if (amp === 0 || n >= TABLE / 2) continue;
    // Rotate z = e^{i(nθ + phase)} by e^{i n 2π / TABLE} per sample.
    const wr = Math.cos((2 * Math.PI * n) / TABLE);
    const wi = Math.sin((2 * Math.PI * n) / TABLE);
    let zr = Math.cos(phase);
    let zi = Math.sin(phase);
    for (let k = 0; k < TABLE; k++) {
      tab[k] += amp * zi;
      const r = zr * wr - zi * wi;
      zi = zr * wi + zi * wr;
      zr = r;
    }
  }
  tables.set(series, tab);
  return tab;
}

export function seriesSignal(series) {
  const { freq } = series;
  if (series.terms.length === 1) {
    const { n, amp, phase } = series.terms[0];
    return (t) => series.dc + amp * Math.sin(2 * Math.PI * n * freq * t + phase);
  }
  const tab = table(series);
  return (t) => {
    const p = (t * freq - Math.floor(t * freq)) * TABLE;
    const i = Math.floor(p);
    const f = p - i;
    return tab[i % TABLE] * (1 - f) + tab[(i + 1) % TABLE] * f;
  };
}

export function seriesRange(series) {
  if (series.terms.length === 1) {
    const { amp } = series.terms[0];
    return { min: series.dc - amp, max: series.dc + amp };
  }
  const tab = table(series);
  let min = Infinity;
  let max = -Infinity;
  for (const v of tab) { if (v < min) min = v; if (v > max) max = v; }
  return { min, max };
}
