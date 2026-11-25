// Seam 1 (Spec 0002), ticket 06: the CH2 sources (copy, filters, independent generator) and
// their ground truth, through engine events, acquire() frames and state() only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../../../tools/bench-scope/engine/engine.js';
import { skinProfile } from '../../../tools/bench-scope/engine/skins.js';

const close = (actual, expected, tol, what) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: ${actual} not within ${tol} of ${expected}`);

/** A frame's trace for `ch` as { t, v } samples. */
function samples(frame, ch) {
  const tr = frame.traces[ch];
  assert.ok(tr, `${ch} trace present`);
  const { sPerDiv, t0 } = frame.timebase;
  return tr.x.map((x, i) => ({ t: t0 + x * sPerDiv, v: (tr.y[i] - tr.position) * tr.vPerDiv }));
}

/** An engine with CH2 displayed and the given source settings. */
function scope(patch) {
  const engine = createEngine(skinProfile('tbs2072b'));
  engine.press('ch2-menu');
  engine.setSource(patch);
  return engine;
}

/** Time of the first rising crossing of `level` in the samples, interpolated. */
function firstRise(s, level) {
  for (let i = 1; i < s.length; i++) {
    if (s[i - 1].v < level && s[i].v >= level) {
      const f = (level - s[i - 1].v) / (s[i].v - s[i - 1].v);
      return s[i - 1].t + f * (s[i].t - s[i - 1].t);
    }
  }
  return NaN;
}

test('a sine through a low-pass at fc = f: gain 1/√2 and phase −45° in the truth, and on screen', () => {
  const engine = scope({ gen1Wave: 'sine', gen1Freq: 1000, gen1Vpp: 4, gen1Offset: 0, ch2Source: 'lowpass', ch2Fc: 1000 });
  const st = engine.state();
  close(st.ch2Gain, Math.SQRT1_2, 1e-9, 'gain ratio');
  close(st.ch2GainDb, 20 * Math.log10(Math.SQRT1_2), 1e-6, 'gain dB');
  close(st.ch2Phase, -45, 1e-6, 'phase');
  close(st.ch2TrueFreq, 1000, 1e-9, 'true freq');
  close(st.ch2TrueVpp, 4 * Math.SQRT1_2, 1e-3, 'true Vpp');

  const frame = engine.acquire(0);
  const vs = samples(frame, 'ch2').map((p) => p.v);
  close(Math.max(...vs) - Math.min(...vs), 4 * Math.SQRT1_2, 0.03, 'acquired CH2 pk-pk');
  // CH2 lags CH1 by an eighth of a period.
  const lag = firstRise(samples(frame, 'ch2'), 0) - firstRise(samples(frame, 'ch1'), 0);
  const T = 1e-3;
  close(((lag % T) + T) % T, T / 8, T / 100, 'CH2 delay');
});

test('a square wave through a high-pass well above f turns into spikes at the edges', () => {
  const engine = scope({ gen1Wave: 'square', gen1Freq: 1000, gen1Vpp: 4, gen1Offset: 1, ch2Source: 'highpass', ch2Fc: 5000 });
  engine.turn('ch2-scale', -1); // 2 V/div, so ±4 V spikes stay on screen
  const s = samples(engine.acquire(0), 'ch2');
  const vs = s.map((p) => p.v);
  assert.ok(Math.max(...vs) > 3.3, `positive spike, max ${Math.max(...vs)}`);
  assert.ok(Math.min(...vs) < -3.3, `negative spike, min ${Math.min(...vs)}`);
  const quiet = vs.filter((v) => Math.abs(v) < 0.3).length / vs.length;
  assert.ok(quiet > 0.7, `flat (DC removed) between the edges, ${quiet}`);
  // Each sample above 3 V comes just after a rising edge of CH1 (t = whole periods).
  const T = 1e-3;
  for (const p of s.filter((q) => q.v > 3)) {
    const since = ((p.t % T) + T) % T;
    assert.ok(since < 20e-6, `spike ${since} s after a rising edge`);
  }
  close(engine.state().ch2TrueVpp, 8, 0.3, 'true Vpp');
});

test('a band-pass passes its centre harmonic: a square wave at f gives a sine at 3f', () => {
  const engine = scope({ gen1Wave: 'square', gen1Freq: 1000, gen1Vpp: 4, gen1Offset: 0,
    ch2Source: 'bandpass', ch2F0: 3000, ch2Q: 30 });
  const s = samples(engine.acquire(0), 'ch2');
  const vs = s.map((p) => p.v);
  const third = (4 * 2) / (3 * Math.PI); // amplitude of the square's 3rd harmonic
  close(Math.max(...vs) - Math.min(...vs), 2 * third, 0.12, 'pk-pk');
  const rises = [];
  for (let i = 1; i < s.length; i++) if (s[i - 1].v < 0 && s[i].v >= 0) rises.push(s[i].t);
  const period = (rises.at(-1) - rises[0]) / (rises.length - 1);
  close(period, 1 / 3000, 0.02 / 3000, 'period');
  // At the CH1 fundamental the band-pass is far off resonance.
  assert.ok(engine.state().ch2Gain < 0.02, `fundamental gain ${engine.state().ch2Gain}`);
});

test('the independent generator has its own amplitude, and its phase offset appears in the samples', () => {
  const engine = scope({ gen1Wave: 'sine', gen1Freq: 1000, gen1Vpp: 4, ch2Source: 'independent',
    gen2Wave: 'sine', gen2Freq: 1000, gen2Vpp: 2, gen2Offset: 0.5, gen2Phase: 90 });
  const frame = engine.acquire(0);
  const vs = samples(frame, 'ch2').map((p) => p.v);
  close(Math.max(...vs), 1.5, 0.02, 'max');
  close(Math.min(...vs), -0.5, 0.02, 'min');
  const T = 1e-3;
  const lead = firstRise(samples(frame, 'ch1'), 0) - firstRise(samples(frame, 'ch2'), 0.5);
  close(((lead % T) + T) % T, T / 4, T / 100, 'CH2 lead');
  const st = engine.state();
  close(st.ch2Phase, 90, 1e-9, 'true phase');
  close(st.ch2Gain, 0.5, 1e-9, 'true gain');
  assert.equal(st.ch2TrueVpp, 2);

  engine.setSource({ gen2Freq: 1500, gen2Wave: 'triangle' });
  const st2 = engine.state();
  assert.equal(st2.ch2TrueFreq, 1500);
  assert.equal(st2.ch2Phase, null, 'no phase between different frequencies');
});

test('CH2 source off removes the CH2 trace and its truth; copy matches CH1', () => {
  const engine = scope({ gen1Wave: 'triangle', gen1Freq: 2000, gen1Vpp: 3, ch2Source: 'copy' });
  const frame = engine.acquire(0);
  assert.deepEqual(frame.traces.ch2.y, frame.traces.ch1.y);
  assert.equal(engine.state().ch2Gain, 1);
  assert.equal(engine.state().ch2TrueVpp, 3);

  engine.setSource({ ch2Source: 'off' });
  assert.equal(engine.acquire(0).traces.ch2, undefined);
  assert.equal(engine.state().ch2TrueVpp, null);
  assert.equal(engine.state().ch2Gain, null);
});

test('every CH2 source setting is in State, survives serialize/restore, and junk is clamped', () => {
  const patch = { ch2Source: 'bandpass', ch2Fc: 2500, ch2F0: 4000, ch2Q: 12, gen2Wave: 'square',
    gen2Freq: 700, gen2Vpp: 6, gen2Offset: -1, gen2Phase: -30 };
  const engine = scope(patch);
  const saved = JSON.parse(JSON.stringify(engine.serialize()));
  const again = createEngine(skinProfile('tbs2072b'));
  again.restore(saved);
  for (const [k, v] of Object.entries(patch)) assert.equal(again.state()[k], v, k);

  again.setSource({ ch2Source: 'nope', ch2Q: 1e6, gen2Phase: 400, ch2Fc: 'x' });
  const st = again.state();
  assert.equal(st.ch2Source, 'bandpass');
  assert.equal(st.ch2Q, 100);
  assert.equal(st.gen2Phase, 180);
  assert.equal(st.ch2Fc, 2500);
  for (const k of [...Object.keys(patch), 'ch2TrueFreq', 'ch2TrueVpp', 'ch2Gain', 'ch2GainDb', 'ch2Phase']) {
    assert.ok(engine.describe()[k], `${k} described`);
  }
});

test('a Setup can choose the CH2 source', () => {
  const engine = createEngine(skinProfile('tbs2072b'), { ch2Source: 'lowpass', ch2Fc: 500, gen1Freq: 500 });
  close(engine.state().ch2Phase, -45, 1e-6, 'phase');
});
