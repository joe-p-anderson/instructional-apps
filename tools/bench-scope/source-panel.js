// The source panel: UI-kit Controls that set what is wired to the scope inputs.
// Every Control action becomes one engine setSource(patch) event.
//
// createSourcePanel({ values, onPatch }) -> { el, controls: { [id]: Control }, sync(values) }
//   values    the engine's State (source keys gen1Wave, gen1Freq, ...)
//   onPatch   (patch) => void, e.g. { gen1Freq: 2000 }
//   sync      show new values (after a restore) without re-sending them
//
// Control ids: gen1-wave, gen1-freq, gen1-vpp, gen1-offset (ticket 06 adds CH2's here).

import { section, select, slider } from '../../framework/v1/ui-kit.js';
import { GEN_LIMITS, WAVES } from './engine/source.js';

const WAVE_LABELS = { sine: 'Sine', square: 'Square', triangle: 'Triangle' };

export function createSourcePanel({ values, onPatch }) {
  let syncing = false;
  const send = (key) => (v) => { if (!syncing) onPatch({ [key]: v }); };

  const specs = [
    ['gen1-wave', 'gen1Wave', () => select({ id: 'gen1-wave', name: 'CH1 waveform', label: 'Waveform',
      options: WAVES.map((w) => ({ value: w, label: WAVE_LABELS[w] })), value: values.gen1Wave,
      onChange: send('gen1Wave') })],
    ['gen1-freq', 'gen1Freq', () => slider({ id: 'gen1-freq', name: 'CH1 frequency', label: 'Frequency', unit: 'Hz',
      min: GEN_LIMITS.freq[0], max: GEN_LIMITS.freq[1], step: 1, log: true, decimals: 0, value: values.gen1Freq,
      reset: 1000, onChange: send('gen1Freq') })],
    ['gen1-vpp', 'gen1Vpp', () => slider({ id: 'gen1-vpp', name: 'CH1 amplitude', label: 'Amplitude', unit: 'Vpp',
      min: GEN_LIMITS.vpp[0], max: GEN_LIMITS.vpp[1], step: 0.01, value: values.gen1Vpp, reset: 4,
      onChange: send('gen1Vpp') })],
    ['gen1-offset', 'gen1Offset', () => slider({ id: 'gen1-offset', name: 'CH1 offset', label: 'DC offset', unit: 'V',
      min: GEN_LIMITS.offset[0], max: GEN_LIMITS.offset[1], step: 0.01, value: values.gen1Offset, reset: 0,
      onChange: send('gen1Offset') })],
  ];

  const controls = {};
  const keys = {};
  for (const [id, key, make] of specs) { controls[id] = make(); keys[id] = key; }

  const el = section('CH1 generator', ...Object.values(controls).map((c) => c.el));
  el.classList.add('bs-source-panel');

  return {
    el,
    controls,
    sync(next) {
      syncing = true;
      try { for (const [id, c] of Object.entries(controls)) if (next[keys[id]] !== c.get()) c.set(next[keys[id]]); }
      finally { syncing = false; }
    },
  };
}
