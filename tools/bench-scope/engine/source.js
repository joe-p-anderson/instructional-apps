// Feature: the source panel (what is wired to the inputs). Owns settings.source.
// CH1 is a function generator. Ticket 06 adds the CH2 source here.
//
// Source keys (flat, also used as Setup keys and setSource() patch keys):
//   gen1Wave 'sine' | 'square' | 'triangle', gen1Freq Hz (1–100 kHz), gen1Vpp V (0–20), gen1Offset V (±10)

import { clampNumber, oneOf } from './util.js';

export const WAVES = ['sine', 'square', 'triangle'];
export const GEN_LIMITS = {
  freq: [1, 100e3],
  vpp: [0, 20],
  offset: [-10, 10],
};

const DEFAULTS = { gen1Wave: 'sine', gen1Freq: 1000, gen1Vpp: 4, gen1Offset: 0 };

const INFO = {
  gen1Wave: { label: 'CH1 generator waveform', unit: '' },
  gen1Freq: { label: 'CH1 generator frequency', unit: 'Hz' },
  gen1Vpp: { label: 'CH1 generator amplitude', unit: 'V' },
  gen1Offset: { label: 'CH1 generator DC offset', unit: 'V' },
  ch1TrueFreq: { label: 'True CH1 frequency', unit: 'Hz' },
  ch1TrueVpp: { label: 'True CH1 peak-to-peak', unit: 'V' },
};

/** Apply the source keys of `patch` that are valid, clamped; others are ignored. */
function applyPatch(src, patch) {
  if (!patch || typeof patch !== 'object') return;
  if ('gen1Wave' in patch) src.gen1Wave = oneOf(patch.gen1Wave, WAVES, src.gen1Wave);
  if ('gen1Freq' in patch) src.gen1Freq = clampNumber(patch.gen1Freq, ...GEN_LIMITS.freq, src.gen1Freq);
  if ('gen1Vpp' in patch) src.gen1Vpp = clampNumber(patch.gen1Vpp, ...GEN_LIMITS.vpp, src.gen1Vpp);
  if ('gen1Offset' in patch) src.gen1Offset = clampNumber(patch.gen1Offset, ...GEN_LIMITS.offset, src.gen1Offset);
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

/** The signal v(t) at a scope input ('ch1' | 'ch2'), or null if nothing is wired to it. */
export function inputSignal(settings, channel) {
  const s = settings.source;
  const gen1 = () => generator({ wave: s.gen1Wave, freq: s.gen1Freq, vpp: s.gen1Vpp, offset: s.gen1Offset });
  if (channel === 'ch1') return gen1();
  if (channel === 'ch2') return gen1(); // a copy of CH1 until ticket 06 adds the CH2 sources
  return null;
}

export const source = {
  init(settings, setup) {
    settings.source = { ...DEFAULTS };
    applyPatch(settings.source, setup);
  },
  restore(settings, saved) {
    settings.source = { ...DEFAULTS };
    applyPatch(settings.source, saved?.source);
  },
  setSource(settings, patch) { applyPatch(settings.source, patch); },
  state({ settings }) {
    const s = settings.source;
    return { ...s, ch1TrueFreq: s.gen1Freq, ch1TrueVpp: s.gen1Vpp };
  },
  describe: () => INFO,
};
