// Feature: the source panel (what is wired to the inputs). Owns settings.source.
// CH1 is a function generator. CH2 is off, a copy of CH1, CH1 through a filter, or a second
// independent generator. The signals are pure functions of time (see inputSignal).
//
// Source keys (flat, also used as Setup keys and setSource() patch keys):
//   gen1Wave 'sine' | 'square' | 'triangle', gen1Freq Hz (1–100 kHz), gen1Vpp V (0–20), gen1Offset V (±10)
//   ch2Source 'off' | 'copy' | 'lowpass' | 'highpass' | 'bandpass' | 'independent'
//   ch2Fc Hz (low-pass and high-pass cutoff, 1 Hz–1 MHz), ch2F0 Hz (band-pass centre, 1 Hz–1 MHz),
//   ch2Q (band-pass Q, 0.1–100)
//   gen2Wave, gen2Freq, gen2Vpp, gen2Offset (as gen1), gen2Phase degrees (±180, + = CH2 leads CH1)
//
// Ground truth in State: ch1TrueFreq, ch1TrueVpp, ch2TrueFreq, ch2TrueVpp, and CH2 relative to CH1
// at the CH1 fundamental: ch2Gain (ratio), ch2GainDb, ch2Phase (degrees, + = CH2 leads). For
// 'off', and for 'independent' at a different frequency from CH1, these are null.

import { clampNumber, oneOf } from './util.js';
import { filterSeries, fundamentalAmplitude, gainAndPhase, seriesRange, seriesSignal, waveSeries } from './signal.js';

export const WAVES = ['sine', 'square', 'triangle'];
export const CH2_SOURCES = ['off', 'copy', 'lowpass', 'highpass', 'bandpass', 'independent'];
export const GEN_LIMITS = {
  freq: [1, 100e3],
  vpp: [0, 20],
  offset: [-10, 10],
  phase: [-180, 180],
};
export const FILTER_LIMITS = {
  fc: [1, 1e6],
  f0: [1, 1e6],
  q: [0.1, 100],
};

/** Which source keys apply to each CH2 source (the source panel hides the rest). */
export const CH2_SOURCE_KEYS = {
  off: [],
  copy: [],
  lowpass: ['ch2Fc'],
  highpass: ['ch2Fc'],
  bandpass: ['ch2F0', 'ch2Q'],
  independent: ['gen2Wave', 'gen2Freq', 'gen2Vpp', 'gen2Offset', 'gen2Phase'],
};

export const SOURCE_DEFAULTS = {
  gen1Wave: 'sine', gen1Freq: 1000, gen1Vpp: 4, gen1Offset: 0,
  ch2Source: 'copy', ch2Fc: 1000, ch2F0: 1000, ch2Q: 5,
  gen2Wave: 'sine', gen2Freq: 1000, gen2Vpp: 2, gen2Offset: 0, gen2Phase: 0,
};

const INFO = {
  gen1Wave: { label: 'CH1 generator waveform', unit: '' },
  gen1Freq: { label: 'CH1 generator frequency', unit: 'Hz' },
  gen1Vpp: { label: 'CH1 generator amplitude', unit: 'V' },
  gen1Offset: { label: 'CH1 generator DC offset', unit: 'V' },
  ch2Source: { label: 'CH2 source', unit: '' },
  ch2Fc: { label: 'CH2 filter cutoff frequency', unit: 'Hz' },
  ch2F0: { label: 'CH2 band-pass centre frequency', unit: 'Hz' },
  ch2Q: { label: 'CH2 band-pass Q', unit: '' },
  gen2Wave: { label: 'CH2 generator waveform', unit: '' },
  gen2Freq: { label: 'CH2 generator frequency', unit: 'Hz' },
  gen2Vpp: { label: 'CH2 generator amplitude', unit: 'V' },
  gen2Offset: { label: 'CH2 generator DC offset', unit: 'V' },
  gen2Phase: { label: 'CH2 generator phase relative to CH1', unit: '°' },
  ch1TrueFreq: { label: 'True CH1 frequency', unit: 'Hz' },
  ch1TrueVpp: { label: 'True CH1 peak-to-peak', unit: 'V' },
  ch2TrueFreq: { label: 'True CH2 frequency', unit: 'Hz' },
  ch2TrueVpp: { label: 'True CH2 peak-to-peak', unit: 'V' },
  ch2Gain: { label: 'True CH2/CH1 gain at the CH1 fundamental', unit: '' },
  ch2GainDb: { label: 'True CH2/CH1 gain at the CH1 fundamental', unit: 'dB' },
  ch2Phase: { label: 'True CH2 phase relative to CH1 at the CH1 fundamental', unit: '°' },
};

const NUMBERS = {
  gen1Freq: GEN_LIMITS.freq, gen1Vpp: GEN_LIMITS.vpp, gen1Offset: GEN_LIMITS.offset,
  ch2Fc: FILTER_LIMITS.fc, ch2F0: FILTER_LIMITS.f0, ch2Q: FILTER_LIMITS.q,
  gen2Freq: GEN_LIMITS.freq, gen2Vpp: GEN_LIMITS.vpp, gen2Offset: GEN_LIMITS.offset, gen2Phase: GEN_LIMITS.phase,
};

/** Apply the source keys of `patch` that are valid, clamped; others are ignored. */
function applyPatch(src, patch) {
  if (!patch || typeof patch !== 'object') return;
  if ('gen1Wave' in patch) src.gen1Wave = oneOf(patch.gen1Wave, WAVES, src.gen1Wave);
  if ('gen2Wave' in patch) src.gen2Wave = oneOf(patch.gen2Wave, WAVES, src.gen2Wave);
  if ('ch2Source' in patch) src.ch2Source = oneOf(patch.ch2Source, CH2_SOURCES, src.ch2Source);
  for (const [key, [lo, hi]] of Object.entries(NUMBERS)) {
    if (key in patch) src[key] = clampNumber(patch[key], lo, hi, src[key]);
  }
}

/**
 * A periodic generator v(t) in volts. All waveforms start at their mean, rising, at t = 0:
 * sine; square high for the first half period; triangle peaking at T/4.
 */
export function generator({ wave, freq, vpp, offset }) {
  const a = vpp / 2;
  if (wave === 'square') {
    return (t) => {
      const p = t * freq - Math.floor(t * freq);
      return offset + (p < 0.5 ? a : -a);
    };
  }
  if (wave === 'triangle') {
    return (t) => {
      const p = t * freq + 0.25 - Math.floor(t * freq + 0.25); // 0 at the trough
      return offset + a * (p < 0.5 ? 4 * p - 1 : 3 - 4 * p);
    };
  }
  return (t) => offset + a * Math.sin(2 * Math.PI * freq * t);
}

const gen1Of = (s) => ({ wave: s.gen1Wave, freq: s.gen1Freq, vpp: s.gen1Vpp, offset: s.gen1Offset });
const gen2Of = (s) => ({ wave: s.gen2Wave, freq: s.gen2Freq, vpp: s.gen2Vpp, offset: s.gen2Offset });

/** The CH2 filter for a filtered source, or null. */
export function ch2Filter(s) {
  if (s.ch2Source === 'lowpass' || s.ch2Source === 'highpass') return { type: s.ch2Source, fc: s.ch2Fc };
  if (s.ch2Source === 'bandpass') return { type: 'bandpass', f0: s.ch2F0, q: s.ch2Q };
  return null;
}

// The filtered CH2 series, cached on the settings it depends on (synthesis is the costly part).
let filtered = { key: '', series: null, signal: null };
function filteredCh2(s) {
  const filter = ch2Filter(s);
  const key = JSON.stringify([gen1Of(s), filter]);
  if (filtered.key !== key) {
    const series = filterSeries(waveSeries(gen1Of(s)), filter);
    filtered = { key, series, signal: seriesSignal(series) };
  }
  return filtered;
}

/**
 * The signal v(t) at a scope input ('ch1' | 'ch2'), or null if nothing is wired to it.
 * A pure function of time t in seconds (any t; t = 0 is CH1's rising mean crossing), so it can be
 * sampled anywhere, e.g. by the trigger.
 */
export function inputSignal(settings, channel) {
  const s = settings.source;
  if (channel === 'ch1') return generator(gen1Of(s));
  if (channel !== 'ch2') return null;
  switch (s.ch2Source) {
    case 'copy': return generator(gen1Of(s));
    case 'lowpass': case 'highpass': case 'bandpass': return filteredCh2(s).signal;
    case 'independent': {
      const g = generator(gen2Of(s));
      const shift = s.gen2Phase / (360 * s.gen2Freq);
      return (t) => g(t + shift);
    }
    default: return null;
  }
}

/** Ground truth for CH2. */
function ch2Truth(s) {
  const none = { ch2TrueFreq: null, ch2TrueVpp: null, ch2Gain: null, ch2GainDb: null, ch2Phase: null };
  const withGain = (gain, phase) => ({
    ch2Gain: gain,
    ch2GainDb: gain > 0 ? 20 * Math.log10(gain) : null,
    ch2Phase: phase,
  });
  switch (s.ch2Source) {
    case 'copy':
      return { ch2TrueFreq: s.gen1Freq, ch2TrueVpp: s.gen1Vpp, ...withGain(1, 0) };
    case 'lowpass': case 'highpass': case 'bandpass': {
      const { min, max } = seriesRange(filteredCh2(s).series);
      const { gain, phase } = gainAndPhase(ch2Filter(s), s.gen1Freq);
      return { ch2TrueFreq: s.gen1Freq, ch2TrueVpp: max - min, ...withGain(gain, phase) };
    }
    case 'independent': {
      const out = { ...none, ch2TrueFreq: s.gen2Freq, ch2TrueVpp: s.gen2Vpp };
      const a1 = fundamentalAmplitude(s.gen1Wave, s.gen1Vpp);
      if (s.gen2Freq !== s.gen1Freq || a1 === 0) return out;
      return { ...out, ...withGain(fundamentalAmplitude(s.gen2Wave, s.gen2Vpp) / a1, s.gen2Phase) };
    }
    default:
      return none;
  }
}

export const source = {
  init(settings, setup) {
    settings.source = { ...SOURCE_DEFAULTS };
    applyPatch(settings.source, setup);
  },
  restore(settings, saved) {
    settings.source = { ...SOURCE_DEFAULTS };
    applyPatch(settings.source, saved?.source);
  },
  setSource(settings, patch) { applyPatch(settings.source, patch); },
  state({ settings }) {
    const s = settings.source;
    return { ...s, ch1TrueFreq: s.gen1Freq, ch1TrueVpp: s.gen1Vpp, ...ch2Truth(s) };
  },
  describe: () => INFO,
};
