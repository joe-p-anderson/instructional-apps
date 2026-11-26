// The Fourier Tool's shared filter Controls and readouts: every Mode builds them here, so the
// ids, ranges and State entries are the same in each Mode (as with ./inputs.js).
//
// Controls (ids = State keys):
//   'filter'      select: 'off', 'lowpass' (RC low-pass, output V_C), 'highpass' (RC high-pass,
//                 output V_R) (engine FILTER_TYPES)
//   'fc'          slider, Hz, 10 to 100 000 on a log scale: the cutoff f_c
//   'applyGain'   toggle "Apply gain": scale each harmonic by |H|
//   'applyPhase'  toggle "Apply phase shift": shift each harmonic by ∠H
// Readouts (UI-kit metrics, also in State): 'fcRatio' f_c/f₀, and 'tau' τ = 1/(2π f_c) in ms.
//
// filterControls(start, onChange) returns
// { controls, el, value(), settings(), state(f0), update(f0), restore(saved) }:
//   controls  { filter, fc, applyGain, applyPhase }, to spread into the Mode's controlRegistry
//   el        the 'Filter' section holding them and the readouts
//   value()   the filter as the engine takes it: { type, fc, gain, phase }
//   settings() the Control values { filter, fc, applyGain, applyPhase }, as serialize() keeps them
//   state(f0) the State entries: settings() plus the readouts fcRatio and tau
//   update(f0) refreshes the readouts for the input's f₀ (call it whenever f₀ or f_c changes)
//   restore(saved)  sets each saved field it can, then calls onChange once
// onChange(filter) runs after any change, with value().

import { metric, section, select, slider, toggle } from '../../framework/v1/ui-kit.js';
import { FILTER_TYPES } from './engine.js';

export const FILTER_DEFAULTS = { filter: 'off', fc: 3000, applyGain: true, applyPhase: true };
export const FILTER_KEYS = Object.keys(FILTER_DEFAULTS);

export const FILTER_STATE_INFO = {
  filter: { label: 'Filter', unit: '' },
  fc: { label: 'Cutoff frequency f_c', unit: 'Hz' },
  applyGain: { label: 'Apply gain', unit: '' },
  applyPhase: { label: 'Apply phase shift', unit: '' },
  fcRatio: { label: 'f_c/f₀', unit: '' },
  tau: { label: 'Time constant τ', unit: 'ms' },
};

/** Each filter type's name, as the select and the Displays' notes show it. */
export const FILTER_LABELS = { off: 'Off', lowpass: 'RC low-pass', highpass: 'RC high-pass' };

const tauMs = (fc) => 1e3 / (2 * Math.PI * fc);
const sig3 = (v) => Number(v.toPrecision(3)).toString();
const fixed3 = (v) => v.toPrecision(3); // keeps trailing zeros: 3.00, 0.500

export function filterControls(start = {}, onChange = () => {}) {
  let quiet = false; // restore() sets several Controls, then reports once
  const changed = () => { if (!quiet) onChange(value()); };

  const filter = select({
    id: 'filter', name: 'Filter', label: 'Filter',
    options: FILTER_TYPES.map((t) => ({ value: t, label: FILTER_LABELS[t] })),
    value: FILTER_TYPES.includes(start.filter) ? start.filter : FILTER_DEFAULTS.filter,
    onChange: changed,
  });
  const fcStart = Number(start.fc);
  const fc = slider({ id: 'fc', name: 'f_c', label: 'f<sub>c</sub>', unit: 'Hz', min: 10, max: 100000, step: 1,
    decimals: 0, log: true, value: Number.isFinite(fcStart) ? fcStart : FILTER_DEFAULTS.fc,
    reset: FILTER_DEFAULTS.fc, onChange: changed });
  const flag = (k) => (typeof start[k] === 'boolean' ? start[k] : FILTER_DEFAULTS[k]);
  const applyGain = toggle({ id: 'applyGain', name: 'Apply gain', value: flag('applyGain'), onChange: changed });
  const applyPhase = toggle({ id: 'applyPhase', name: 'Apply phase shift', value: flag('applyPhase'), onChange: changed });
  const controls = { filter, fc, applyGain, applyPhase };

  const readouts = {
    fcRatio: metric({ name: 'f_c/f₀', label: 'f<sub>c</sub>/f<sub>0</sub>', format: fixed3 }),
    tau: metric({ name: 'τ', label: 'τ = 1/(2π f<sub>c</sub>)', format: (v) => `${sig3(v)} ms` }),
  };

  function value() {
    return { type: filter.get(), fc: fc.get(), gain: applyGain.get(), phase: applyPhase.get() };
  }
  function settings() {
    return Object.fromEntries(FILTER_KEYS.map((k) => [k, controls[k].get()]));
  }
  function state(f0) {
    return { ...settings(), fcRatio: fc.get() / f0, tau: tauMs(fc.get()) };
  }
  function update(f0) {
    const s = state(f0);
    readouts.fcRatio.update(s.fcRatio);
    readouts.tau.update(s.tau);
  }

  function restore(saved = {}) {
    quiet = true;
    try {
      for (const k of FILTER_KEYS) {
        if (saved[k] === undefined) continue;
        if ((k === 'applyGain' || k === 'applyPhase') && typeof saved[k] !== 'boolean') continue;
        controls[k].set(saved[k]);
      }
    } finally {
      quiet = false;
    }
    onChange(value());
  }

  const el = section('Filter', filter.el, fc.el, applyGain.el, applyPhase.el,
    readouts.fcRatio.el, readouts.tau.el);
  return { controls, el, value, settings, state, update, restore };
}
