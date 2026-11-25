// Seam 1 (Spec 0002): the bench-scope engine, driven only through events and read only
// through acquire() frames, state() and serialize().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../../../tools/bench-scope/engine/engine.js';
import { skinProfile } from '../../../tools/bench-scope/engine/skins.js';

const tbs = () => skinProfile('tbs2072b');

/** Turn a frame's CH1 trace (screen divisions) back into time (s) and volts. */
function ch1Samples(frame) {
  const tr = frame.traces.ch1;
  const { sPerDiv, t0 } = frame.timebase;
  return tr.x.map((x, i) => ({ t: t0 + x * sPerDiv, v: (tr.y[i] - tr.position) * tr.vPerDiv }));
}

function summary(frame) {
  const s = ch1Samples(frame);
  const vs = s.map((p) => p.v);
  const max = Math.max(...vs);
  const min = Math.min(...vs);
  const mid = (max + min) / 2;
  // Rising crossings of the mid level, interpolated between samples.
  const rises = [];
  for (let i = 1; i < s.length; i++) {
    if (s[i - 1].v < mid && s[i].v >= mid) {
      const f = (mid - s[i - 1].v) / (s[i].v - s[i - 1].v);
      rises.push(s[i - 1].t + f * (s[i].t - s[i - 1].t));
    }
  }
  const periods = rises.slice(1).map((t, i) => t - rises[i]);
  const period = periods.reduce((a, b) => a + b, 0) / periods.length;
  return { max, min, period, cycles: periods.length };
}

const close = (actual, expected, tol, what) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: ${actual} not within ${tol} of ${expected}`);

for (const [wave, freq, vpp, offset] of [
  ['sine', 1000, 4, 1],
  ['square', 2000, 2, -0.5],
  ['triangle', 1500, 3, 0.25],
]) {
  test(`CH1 ${wave}: ${freq} Hz, ${vpp} Vpp, ${offset} V offset appears in the acquired samples`, () => {
    const engine = createEngine(tbs());
    engine.setSource({ gen1Wave: wave, gen1Freq: freq, gen1Vpp: vpp, gen1Offset: offset });
    const m = summary(engine.acquire(0));
    close(m.max, offset + vpp / 2, 0.02 * vpp, 'max');
    close(m.min, offset - vpp / 2, 0.02 * vpp, 'min');
    assert.ok(m.cycles >= 2, `at least two full cycles on screen, got ${m.cycles}`);
    close(m.period, 1 / freq, 0.01 / freq, 'period');
  });
}

test('the three waveforms differ in shape: a square sits at its peaks, a triangle is linear', () => {
  const fractionNearPeaks = (wave) => {
    const engine = createEngine(tbs());
    engine.setSource({ gen1Wave: wave, gen1Freq: 1000, gen1Vpp: 4, gen1Offset: 0 });
    const vs = ch1Samples(engine.acquire(0)).map((p) => p.v);
    return vs.filter((v) => Math.abs(Math.abs(v) - 2) < 0.1).length / vs.length;
  };
  // Within 0.1 V of ±2 V: a square is there almost always; a sine about 20% of the time
  // (|sin| > 0.95); a triangle only 5% of the time (linear ramps).
  assert.ok(fractionNearPeaks('square') > 0.9);
  close(fractionNearPeaks('sine'), 0.2, 0.05, 'sine');
  close(fractionNearPeaks('triangle'), 0.05, 0.03, 'triangle');
});

test('the generator clamps to 1 Hz–100 kHz and at most 20 Vpp, and ignores unknown waveforms', () => {
  const engine = createEngine(tbs());
  engine.setSource({ gen1Freq: 5e6, gen1Vpp: 50 });
  assert.equal(engine.state().gen1Freq, 100000);
  assert.equal(engine.state().gen1Vpp, 20);
  engine.setSource({ gen1Freq: 0.01, gen1Vpp: -3, gen1Wave: 'sawtooth' });
  assert.equal(engine.state().gen1Freq, 1);
  assert.equal(engine.state().gen1Vpp, 0);
  assert.equal(engine.state().gen1Wave, 'sine');
});

test('State publishes the source settings and the true CH1 frequency and Vpp, with labels and units', () => {
  const engine = createEngine(tbs(), { gen1Wave: 'square', gen1Freq: 250, gen1Vpp: 6, gen1Offset: 2 });
  const s = engine.state();
  assert.deepEqual(
    { wave: s.gen1Wave, f: s.gen1Freq, vpp: s.gen1Vpp, off: s.gen1Offset, tf: s.ch1TrueFreq, tvpp: s.ch1TrueVpp },
    { wave: 'square', f: 250, vpp: 6, off: 2, tf: 250, tvpp: 6 },
  );
  const info = engine.describe();
  for (const key of Object.keys(s)) {
    assert.equal(typeof info[key]?.label, 'string', `label for ${key}`);
    assert.equal(typeof info[key]?.unit, 'string', `unit for ${key}`);
  }
  assert.equal(info.gen1Freq.unit, 'Hz');
  assert.equal(info.ch1TrueVpp.unit, 'V');
});

test('serialize then restore round-trips the setup, through JSON', () => {
  const a = createEngine(tbs());
  a.setSource({ gen1Wave: 'triangle', gen1Freq: 4321, gen1Vpp: 7.5, gen1Offset: -1.25 });
  const saved = JSON.parse(JSON.stringify(a.serialize()));

  const b = createEngine(tbs());
  b.restore(saved);
  assert.deepEqual(b.state(), a.state());
  assert.deepEqual(b.acquire(0), a.acquire(0));
});

test('restore ignores junk and clamps out-of-range values', () => {
  const engine = createEngine(tbs());
  engine.restore({ source: { gen1Freq: 1e9, gen1Wave: 42, gen1Vpp: 'x' } });
  const s = engine.state();
  assert.equal(s.gen1Freq, 100000);
  assert.equal(s.gen1Wave, 'sine');
  assert.ok(Number.isFinite(s.gen1Vpp));
  assert.doesNotThrow(() => engine.restore(null));
});

test('two engines are independent', () => {
  const a = createEngine(tbs());
  const b = createEngine(tbs());
  a.setSource({ gen1Freq: 50 });
  assert.notEqual(b.state().gen1Freq, 50);
});
