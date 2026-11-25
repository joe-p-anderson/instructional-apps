// The source panel: UI-kit Controls that set what is wired to the scope inputs.
// Every Control action becomes one engine setSource(patch) event.
//
// createSourcePanel({ values, onPatch }) -> { el, controls: { [id]: Control }, sync(values) }
//   values    the engine's State (source keys gen1Wave, gen1Freq, ..., ch2Source, ...)
//   onPatch   (patch) => void, e.g. { gen1Freq: 2000 }
//   sync      show new values (after a restore) without re-sending them
//
// Control ids: gen1-wave, gen1-freq, gen1-vpp, gen1-offset; ch2-source; ch2-fc, ch2-f0, ch2-q;
// gen2-wave, gen2-freq, gen2-vpp, gen2-offset, gen2-phase.
// Controls that don't apply to the current CH2 source are hidden by a wrapper element, so this
// composes with an Activity's Control.hide()/show() (which acts on the Control's own element).

import { h, section, select, slider } from '../../framework/v1/ui-kit.js';
import { CH2_SOURCE_KEYS, CH2_SOURCES, FILTER_LIMITS, GEN_LIMITS, SOURCE_DEFAULTS, WAVES } from './engine/source.js';

const WAVE_LABELS = { sine: 'Sine', square: 'Square', triangle: 'Triangle' };
const CH2_LABELS = {
  off: 'Off', copy: 'Copy of CH1', lowpass: 'Low-pass of CH1', highpass: 'High-pass of CH1',
  bandpass: 'Band-pass of CH1', independent: 'Independent generator',
};

export function createSourcePanel({ values, onPatch }) {
  let syncing = false;
  let ch2Source = values.ch2Source;
  const send = (key) => (v) => {
    if (key === 'ch2Source') { ch2Source = v; showRelevant(); }
    if (!syncing) onPatch({ [key]: v });
  };
  const v = (key) => values[key] ?? SOURCE_DEFAULTS[key];

  const waveSelect = (id, key, name) => select({ id, name, label: 'Waveform',
    options: WAVES.map((w) => ({ value: w, label: WAVE_LABELS[w] })), value: v(key), onChange: send(key) });
  const freqSlider = (id, key, name, label, [min, max]) => slider({ id, name, label, unit: 'Hz', min, max,
    step: 1, log: true, decimals: 0, value: v(key), reset: SOURCE_DEFAULTS[key], onChange: send(key) });
  const plain = (id, key, name, label, unit, [min, max], step, decimals = 2) => slider({ id, name, label, unit,
    min, max, step, decimals, value: v(key), reset: SOURCE_DEFAULTS[key], onChange: send(key) });

  // [id, key, make]
  const ch1Specs = [
    ['gen1-wave', 'gen1Wave', () => waveSelect('gen1-wave', 'gen1Wave', 'CH1 waveform')],
    ['gen1-freq', 'gen1Freq', () => freqSlider('gen1-freq', 'gen1Freq', 'CH1 frequency', 'Frequency', GEN_LIMITS.freq)],
    ['gen1-vpp', 'gen1Vpp', () => plain('gen1-vpp', 'gen1Vpp', 'CH1 amplitude', 'Amplitude', 'Vpp', GEN_LIMITS.vpp, 0.01)],
    ['gen1-offset', 'gen1Offset', () => plain('gen1-offset', 'gen1Offset', 'CH1 offset', 'DC offset', 'V', GEN_LIMITS.offset, 0.01)],
  ];
  const ch2Specs = [
    ['ch2-source', 'ch2Source', () => select({ id: 'ch2-source', name: 'CH2 source', label: 'Source',
      options: CH2_SOURCES.map((s) => ({ value: s, label: CH2_LABELS[s] })), value: v('ch2Source'),
      onChange: send('ch2Source') })],
    ['ch2-fc', 'ch2Fc', () => freqSlider('ch2-fc', 'ch2Fc', 'CH2 cutoff', 'Cutoff f<sub>c</sub>', FILTER_LIMITS.fc)],
    ['ch2-f0', 'ch2F0', () => freqSlider('ch2-f0', 'ch2F0', 'CH2 centre frequency', 'Centre f<sub>0</sub>', FILTER_LIMITS.f0)],
    ['ch2-q', 'ch2Q', () => plain('ch2-q', 'ch2Q', 'CH2 Q', 'Q', '', FILTER_LIMITS.q, 0.1, 1)],
    ['gen2-wave', 'gen2Wave', () => waveSelect('gen2-wave', 'gen2Wave', 'CH2 waveform')],
    ['gen2-freq', 'gen2Freq', () => freqSlider('gen2-freq', 'gen2Freq', 'CH2 frequency', 'Frequency', GEN_LIMITS.freq)],
    ['gen2-vpp', 'gen2Vpp', () => plain('gen2-vpp', 'gen2Vpp', 'CH2 amplitude', 'Amplitude', 'Vpp', GEN_LIMITS.vpp, 0.01)],
    ['gen2-offset', 'gen2Offset', () => plain('gen2-offset', 'gen2Offset', 'CH2 offset', 'DC offset', 'V', GEN_LIMITS.offset, 0.01)],
    ['gen2-phase', 'gen2Phase', () => plain('gen2-phase', 'gen2Phase', 'CH2 phase', 'Phase vs CH1', '°', GEN_LIMITS.phase, 1, 0)],
  ];

  const controls = {};
  const keys = {};
  const wrappers = {};
  for (const [id, key, make] of [...ch1Specs, ...ch2Specs]) { controls[id] = make(); keys[id] = key; }
  for (const [id] of ch2Specs) wrappers[id] = h('div', { class: 'bs-source-slot' }, controls[id].el);

  function showRelevant() {
    const relevant = CH2_SOURCE_KEYS[ch2Source] ?? [];
    for (const [id, wrap] of Object.entries(wrappers)) {
      wrap.hidden = id !== 'ch2-source' && !relevant.includes(keys[id]);
    }
  }
  showRelevant();

  const el = h('div', { class: 'bs-source-panel' },
    section('CH1 generator', ...ch1Specs.map(([id]) => controls[id].el)),
    section('CH2 source', ...ch2Specs.map(([id]) => wrappers[id])));

  return {
    el,
    controls,
    sync(next) {
      syncing = true;
      try {
        for (const [id, c] of Object.entries(controls)) {
          if (next[keys[id]] !== undefined && next[keys[id]] !== c.get()) c.set(next[keys[id]]);
        }
        ch2Source = next.ch2Source ?? ch2Source;
        showRelevant();
      } finally { syncing = false; }
    },
  };
}
