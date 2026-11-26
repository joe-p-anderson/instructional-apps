// The Fourier Tool's shared input Controls: every Mode builds them here, so the ids, ranges and
// State entries are the same in each Mode and an Activity Setup reads the same way in either.
//
// Controls (ids = State keys):
//   'waveform'  select: sine, square, triangle, sawtooth (engine WAVEFORMS)
//   'amp'       slider, V, 0.1 to 5: the waveform's peak about its offset
//   'f0'        slider, Hz, 10 to 10 000 on a log scale: the fundamental frequency
//   'offset'    slider, V, −2 to 2: the DC offset (the n = 0 term)
//   'shift'     slider, °, −180 to 180: the delay in degrees of the fundamental
//
// inputControls(start, onChange) returns { controls, el, value(), restore(saved) }:
//   controls  { waveform, amp, f0, offset, shift }, to spread into the Mode's controlRegistry
//   el        the 'Input' section holding them
//   value()   the current input { waveform, amp, f0, offset, shift }, as the engine takes it
//   restore(saved)  sets each saved field it can (unknown waveforms and non-numbers are
//             ignored, numbers clamped), then calls onChange once
// onChange(input) runs after any change, with the whole input.

import { section, select, slider } from '../../framework/v1/ui-kit.js';
import { WAVEFORMS } from './engine.js';

export const INPUT_DEFAULTS = { waveform: 'square', amp: 1, f0: 1000, offset: 0, shift: 0 };
export const INPUT_KEYS = Object.keys(INPUT_DEFAULTS);

export const INPUT_STATE_INFO = {
  waveform: { label: 'Waveform', unit: '' },
  amp: { label: 'Amplitude', unit: 'V' },
  f0: { label: 'Fundamental frequency f₀', unit: 'Hz' },
  offset: { label: 'DC offset', unit: 'V' },
  shift: { label: 'Shift', unit: '°' },
};

const SLIDERS = {
  amp: { name: 'Amplitude', unit: 'V', min: 0.1, max: 5, step: 0.05, decimals: 2 },
  f0: { name: 'f₀', label: 'f<sub>0</sub>', unit: 'Hz', min: 10, max: 10000, step: 1, decimals: 0, log: true },
  offset: { name: 'DC offset', unit: 'V', min: -2, max: 2, step: 0.05, decimals: 2 },
  shift: { name: 'Shift', unit: '°', min: -180, max: 180, step: 1, decimals: 0 },
};

const capital = (s) => s[0].toUpperCase() + s.slice(1);

export function inputControls(start = {}, onChange = () => {}) {
  let quiet = false; // restore() sets several Controls, then reports once
  const changed = () => { if (!quiet) onChange(value()); };

  const waveform = select({
    id: 'waveform', name: 'Waveform', label: 'Waveform',
    options: WAVEFORMS.map((w) => ({ value: w, label: capital(w) })),
    value: WAVEFORMS.includes(start.waveform) ? start.waveform : INPUT_DEFAULTS.waveform,
    onChange: changed,
  });
  const sliders = Object.fromEntries(Object.entries(SLIDERS).map(([id, opts]) => {
    const v = Number(start[id]);
    return [id, slider({ id, ...opts, value: Number.isFinite(v) ? v : INPUT_DEFAULTS[id],
      reset: INPUT_DEFAULTS[id], onChange: changed })];
  }));
  const controls = { waveform, ...sliders };

  function value() {
    return Object.fromEntries(INPUT_KEYS.map((k) => [k, controls[k].get()]));
  }

  function restore(saved = {}) {
    quiet = true;
    try {
      for (const k of INPUT_KEYS) if (saved[k] !== undefined) controls[k].set(saved[k]);
    } finally {
      quiet = false;
    }
    onChange(value());
  }

  const el = section('Input', ...INPUT_KEYS.map((k) => controls[k].el));
  return { controls, el, value, restore };
}
