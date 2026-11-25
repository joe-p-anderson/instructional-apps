// Seam 1 (Spec 0002), ticket 04: horizontal controls, the edge trigger and acquisition, driven
// only through engine events and read through acquire() frames, state() and serialize().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../../../tools/bench-scope/engine/engine.js';
import { skinProfile } from '../../../tools/bench-scope/engine/skins.js';

const tbs = () => skinProfile('tbs2072b');
const readout = (frame, id) => frame.readouts.find((r) => r.id === id);

test('the horizontal Scale knob steps s/div through the TBS 1-2-4 sequence, 1 µs to 1 s', () => {
  const engine = createEngine(tbs());
  assert.equal(engine.state().hScale, 200e-6);
  assert.equal(readout(engine.acquire(0), 'timebase').text, 'M 200µs');
  engine.turn('hor-scale', -1); // anticlockwise: slower
  assert.equal(engine.state().hScale, 400e-6);
  engine.turn('hor-scale', -100);
  assert.equal(engine.state().hScale, 1);
  const seen = [];
  for (let i = 0; i < 20; i++) {
    engine.turn('hor-scale', 1);
    seen.push(engine.state().hScale);
  }
  assert.deepEqual(seen.slice(0, 7), [0.4, 0.2, 0.1, 0.04, 0.02, 0.01, 0.004]);
  assert.equal(seen.at(-2), 1e-6);
  assert.equal(seen.at(-1), 1e-6, 'stops at 1 µs');
});

/** Screen x (divisions) of the first rising crossing of `level` in the CH1 trace's volts. */
function firstRise(frame, level = 0) {
  const tr = frame.traces.ch1;
  const v = tr.y.map((y) => (y - tr.position) * tr.vPerDiv);
  for (let i = 1; i < v.length; i++) {
    if (v[i - 1] < level && v[i] >= level) return tr.x[i - 1] + ((level - v[i - 1]) / (v[i] - v[i - 1])) * (tr.x[i] - tr.x[i - 1]);
  }
  return NaN;
}

/** The signal phase (cycles, -0.5..0.5) at the screen centre of a frame, for a signal of `freq` Hz. */
function phase(frame, freq) {
  const { t0, sPerDiv } = frame.timebase;
  const c = (t0 + (frame.screen.divX / 2) * sPerDiv) * freq;
  return c - Math.round(c);
}

test('the horizontal Position knob moves the trigger point on screen, and a push recentres it', () => {
  const engine = createEngine(tbs(), { gen1Freq: 100 }); // 10 ms period: one rise on screen at 200 µs/div
  const centre = tbs().screen.divX / 2;
  assert.ok(Math.abs(firstRise(engine.acquire(0)) - centre) < 0.05, 'trigger point at the centre');
  engine.turn('hor-position', 5); // 0.2 div per detent: 1 div = 200 µs
  assert.equal(engine.state().hPosition, 200e-6);
  assert.ok(Math.abs(firstRise(engine.acquire(0)) - (centre + 1)) < 0.05, 'moved right one division');
  engine.turn('hor-position', 1000);
  assert.equal(engine.state().hPosition, 1.5e-3, 'stops with the trigger point at the screen edge');
  engine.push('hor-position');
  assert.equal(engine.state().hPosition, 0);
  engine.turn('hor-position', -3);
  engine.press('set-to-zero'); // the TDS button
  assert.equal(engine.state().hPosition, 0);
});

test('s/div and position survive serialize and restore, snapped and clamped', () => {
  const a = createEngine(tbs());
  a.turn('hor-scale', -2);
  a.turn('hor-position', 4);
  const b = createEngine(tbs());
  b.restore(JSON.parse(JSON.stringify(a.serialize())));
  assert.equal(b.state().hScale, a.state().hScale);
  assert.equal(b.state().hPosition, a.state().hPosition);
  b.restore({ horizontal: { sPerDiv: 3e-4, position: 99 } });
  assert.equal(b.state().hScale, 400e-6);
  assert.equal(b.state().hPosition, 7.5 * 400e-6);
});

test('the edge trigger defaults to CH1, rising, 0 V, Auto and running, with a stable trace', () => {
  const engine = createEngine(tbs());
  const s = engine.state();
  assert.deepEqual(
    { src: s.trigSource, slope: s.trigSlope, level: s.trigLevel, mode: s.trigMode, run: s.runState, stable: s.traceStable },
    { src: 'ch1', slope: 'rising', level: 0, mode: 'auto', run: 'running', stable: true },
  );
  const frame = engine.acquire(0);
  assert.equal(frame.status, 'triggered');
  const r = readout(frame, 'trigger');
  assert.equal(r.channel, 'ch1');
  assert.match(r.text, /0\.00V/);
  const info = engine.describe();
  assert.equal(info.trigLevel.unit, 'V');
  assert.equal(typeof info.traceStable.label, 'string');
});

test('the Level knob moves the level and its on-screen marker', () => {
  const engine = createEngine(tbs()); // CH1 at 1 V/div
  assert.equal(engine.acquire(0).markers.triggerLevel.y, 0);
  engine.turn('trig-level', 25); // 1/25 division per detent
  const level = engine.state().trigLevel;
  assert.equal(level, 1, 'clockwise raises the level');
  const frame = engine.acquire(0);
  assert.ok(Math.abs(frame.markers.triggerLevel.y - 1) < 1e-9, 'marker at the level, in divisions');
  assert.equal(frame.markers.triggerLevel.channel, 'ch1');
  assert.ok(readout(frame, 'trigger').text.includes('1.00V'), readout(frame, 'trigger').text);
  engine.turn('ch1-position', 10); // the marker follows the source trace
  assert.ok(Math.abs(engine.acquire(0).markers.triggerLevel.y - (level + 1)) < 1e-9);
});

test('in Auto, a level above the signal free-runs: unstable, and the trace drifts between captures', () => {
  const engine = createEngine(tbs()); // 4 Vpp sine: ±2 V
  engine.apply({ type: 'set', control: 'trig-level', value: 3 });
  assert.equal(engine.state().trigLevel, 3);
  assert.equal(engine.state().traceStable, false);
  const a = engine.acquire(1000);
  const b = engine.acquire(1016.7);
  assert.equal(a.status, 'auto');
  assert.ok(a.traces.ch1, 'still draws a trace');
  assert.ok(Math.abs(phase(a, 1000) - phase(b, 1000)) > 0.05, 'the trace does not stand still');
});

test('a triggered trace stands still from capture to capture', () => {
  const engine = createEngine(tbs(), { gen1Freq: 100 }); // one rising edge on screen
  const a = engine.acquire(1000);
  const b = engine.acquire(1016.7);
  assert.equal(b.status, 'triggered');
  assert.ok(Math.abs(phase(a, 100) - phase(b, 100)) < 1e-3);
  assert.ok(Math.abs(firstRise(a) - tbs().screen.divX / 2) < 0.1, 'trigger point at the centre');
});

test('Set to 50% (the TBS Level push, or the TDS button) puts the level mid-signal and restores stability', () => {
  for (const event of [{ type: 'push', control: 'trig-level' }, { type: 'press', control: 'trig-50' }]) {
    const engine = createEngine(tbs(), { gen1Vpp: 4, gen1Offset: 1 }); // -1 .. 3 V
    engine.apply({ type: 'set', control: 'trig-level', value: 5 });
    engine.acquire(0);
    assert.equal(engine.state().traceStable, false);
    engine.apply(event);
    assert.ok(Math.abs(engine.state().trigLevel - 1) < 0.05, `level ${engine.state().trigLevel} near 1 V`);
    assert.equal(engine.state().traceStable, true);
    assert.equal(engine.acquire(20).status, 'triggered');
  }
});

test('falling slope triggers on the falling edge', () => {
  const engine = createEngine(tbs(), { gen1Freq: 100 });
  engine.restore({ ...engine.serialize(), trigger: { slope: 'falling' } });
  assert.equal(engine.state().trigSlope, 'falling');
  const tr = engine.acquire(0).traces.ch1;
  const mid = tr.y.findIndex((_, i) => tr.x[i] >= tbs().screen.divX / 2);
  assert.ok(tr.y[mid - 5] > 0 && tr.y[mid + 5] < 0, 'high before the trigger point, low after');
});

test('Run/Stop freezes the trace and resumes; the held trace does not drift', () => {
  const engine = createEngine(tbs());
  engine.apply({ type: 'set', control: 'trig-level', value: 3 }); // free-running
  const before = engine.acquire(1000);
  engine.press('run-stop');
  assert.equal(engine.state().runState, 'stopped');
  const held = engine.acquire(1016.7);
  assert.equal(held.status, 'stopped');
  assert.deepEqual(held.traces, before.traces);
  assert.deepEqual(engine.acquire(1500).traces, before.traces);
  engine.press('run-stop');
  assert.equal(engine.state().runState, 'running');
  assert.notDeepEqual(engine.acquire(1033.4).traces, before.traces);
});

test('Single waits for a trigger, captures once, then stops', () => {
  const engine = createEngine(tbs());
  engine.press('single');
  assert.equal(engine.state().runState, 'single');
  const shot = engine.acquire(1000);
  assert.equal(shot.status, 'stopped');
  assert.equal(engine.state().runState, 'stopped');
  assert.equal(engine.state().traceStable, true, 'the held capture was triggered');
  assert.deepEqual(engine.acquire(2000).traces, shot.traces, 'no further captures');
});

test('Force Trig acquires while Single is waiting for a trigger that never comes', () => {
  const engine = createEngine(tbs());
  engine.apply({ type: 'set', control: 'trig-level', value: 3 });
  engine.press('single');
  const waiting = engine.acquire(1000);
  assert.equal(waiting.status, 'waiting');
  assert.equal(engine.acquire(1100).status, 'waiting');
  assert.equal(engine.state().runState, 'single');
  engine.press('force-trig');
  const forced = engine.acquire(1200);
  assert.ok(forced.traces.ch1, 'a forced acquisition');
  assert.equal(engine.state().runState, 'stopped');
  assert.equal(engine.state().traceStable, false, 'forced at an arbitrary phase, not triggered');
});

test('Normal mode with no crossing waits and keeps the last frame', () => {
  const engine = createEngine(tbs());
  engine.restore({ ...engine.serialize(), trigger: { mode: 'normal' } });
  assert.equal(engine.state().trigMode, 'normal');
  const last = engine.acquire(1000);
  assert.equal(last.status, 'triggered');
  engine.apply({ type: 'set', control: 'trig-level', value: 3 });
  const waiting = engine.acquire(1016.7);
  assert.equal(waiting.status, 'waiting');
  assert.deepEqual(waiting.traces, last.traces);
  assert.equal(engine.state().traceStable, false);
});

test('the noise is seeded: the same seed and events give identical frames, another seed differs', () => {
  const run = (seed) => {
    const engine = createEngine(tbs(), { seed, gen1Freq: 1234 });
    engine.turn('trig-level', 7);
    engine.turn('hor-scale', 1);
    return [engine.acquire(100), engine.acquire(116.7), engine.acquire(133.4)];
  };
  assert.deepEqual(run(7), run(7));
  assert.notDeepEqual(run(7)[0].traces, run(8)[0].traces);
  const [a, b] = run(7);
  assert.notDeepEqual(a.traces.ch1.y, b.traces.ch1.y, 'fresh noise in each capture');
});

test('the noise is small but present on a flat signal', () => {
  const engine = createEngine(tbs(), { gen1Vpp: 0 });
  for (let i = 0; i < 8; i++) engine.turn('ch1-scale', 1); // 5 mV/div
  const v = engine.acquire(0).traces.ch1.y.map((y) => y * 0.005);
  const rms = Math.sqrt(v.reduce((a, x) => a + x * x, 0) / v.length);
  assert.ok(rms > 0.001 && rms < 0.02, `noise rms ${rms} V`);
});

test('a level near a peak gives trigger jitter; a level mid-signal does not', () => {
  const spread = (level) => {
    const engine = createEngine(tbs(), { gen1Freq: 100 });
    engine.apply({ type: 'set', control: 'trig-level', value: level });
    const xs = [];
    for (let i = 0; i < 20; i++) {
      const f = engine.acquire(1000 + i * 16.7);
      if (f.status === 'triggered') xs.push(phase(f, 100) * 50); // divisions: 10 ms period at 200 µs/div
    }
    return Math.max(...xs) - Math.min(...xs);
  };
  assert.ok(spread(0) < 0.05, `mid-level jitter ${spread(0)} div`);
  assert.ok(spread(1.995) > 0.15, `near-peak jitter ${spread(1.995)} div`);
});
