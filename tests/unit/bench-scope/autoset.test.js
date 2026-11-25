// Seam 1 (Spec 0002), ticket 07: Autoset, through engine events, acquire() frames and state() only.
// From a scrambled setup, pressing Autoset gives a stable trace showing 2–3 cycles and spanning
// 4–6 divisions, centred, triggered rising at 50% in Auto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../../../tools/bench-scope/engine/engine.js';
import { skinProfile, SKIN_IDS } from '../../../tools/bench-scope/engine/skins.js';

const within = (v, lo, hi, what) => assert.ok(v >= lo && v <= hi, `${what}: ${v} not in [${lo}, ${hi}]`);

/** Span (divisions, max − min of y) and centre (divisions) of a channel's trace. */
function spanOf(frame, ch) {
  const tr = frame.traces[ch];
  assert.ok(tr, `${ch} trace present`);
  assert.equal(tr.clipped, false, `${ch} not clipped`);
  const min = Math.min(...tr.y);
  const max = Math.max(...tr.y);
  return { span: max - min, centre: (max + min) / 2 };
}

/** Cycles of frequency f on screen. */
const cycles = (frame, f) => frame.timebase.sPerDiv * frame.screen.divX * f;

/** Every knob turned well away from home, the trigger lost, and the scope stopped. */
function scramble(engine) {
  engine.apply({ type: 'set', control: 'ch1-scale', value: 0.005 });
  engine.apply({ type: 'set', control: 'ch1-position', value: 3.7 });
  engine.apply({ type: 'set', control: 'ch2-scale', value: 5 });
  engine.apply({ type: 'set', control: 'ch2-position', value: -4.2 });
  engine.apply({ type: 'set', control: 'hor-scale', value: 1e-6 });
  engine.turn('hor-position', 20);
  engine.apply({ type: 'set', control: 'trig-level', value: 40 });
  engine.press('run-stop');
}

function scrambled(skin, patch, { ch2 = false } = {}) {
  const engine = createEngine(skinProfile(skin));
  if (ch2) engine.press('ch2-menu');
  engine.setSource(patch);
  scramble(engine);
  engine.acquire(0);
  return engine;
}

for (const skin of SKIN_IDS) {
  test(`${skin}: Autoset recovers a scrambled CH1 sine: 4–6 div, centred, 2–3 cycles, stable`, () => {
    const engine = scrambled(skin, { gen1Wave: 'sine', gen1Freq: 1000, gen1Vpp: 2, gen1Offset: 0 });
    assert.equal(engine.state().traceStable, false, 'scrambled setup is not stable');
    engine.press('autoset');
    const st = engine.state();
    assert.equal(st.traceStable, true);
    assert.equal(st.runState, 'running');
    const frame = engine.acquire(1234);
    assert.equal(frame.status, 'triggered');
    const { span, centre } = spanOf(frame, 'ch1');
    within(span, 4, 6, 'CH1 span');
    within(centre, -0.3, 0.3, 'CH1 centre');
    within(cycles(frame, 1000), 2, 3, 'cycles');
  });

  test(`${skin}: with an independent CH2 at a lower frequency, Autoset shows 2–3 of its cycles and triggers on CH1`, () => {
    const engine = scrambled(skin, {
      gen1Wave: 'square', gen1Freq: 5000, gen1Vpp: 1, gen1Offset: 0.5,
      ch2Source: 'independent', gen2Wave: 'triangle', gen2Freq: 1000, gen2Vpp: 10, gen2Offset: -2,
    }, { ch2: true });
    engine.press('autoset');
    const st = engine.state();
    assert.equal(st.trigSource, 'ch1');
    assert.equal(st.trigSlope, 'rising');
    assert.equal(st.trigMode, 'auto');
    within(st.trigLevel, 0.45, 0.55, 'trigger level at 50% of CH1');
    assert.equal(st.traceStable, true);
    const frame = engine.acquire(777);
    assert.equal(frame.status, 'triggered');
    within(cycles(frame, 1000), 2, 3, 'cycles of the slower CH2');
    for (const ch of ['ch1', 'ch2']) {
      const { span, centre } = spanOf(frame, ch);
      within(span, 4, 6, `${ch} span`);
      within(centre, -0.3, 0.3, `${ch} centre`);
    }
  });

  test(`${skin}: with only CH2 displayed, Autoset triggers on CH2`, () => {
    const engine = scrambled(skin, { gen1Freq: 2000, ch2Source: 'lowpass', ch2Fc: 500 }, { ch2: true });
    engine.press('ch1-menu'); // CH1 off
    engine.press('autoset');
    const st = engine.state();
    assert.equal(st.ch1Display, false);
    assert.equal(st.trigSource, 'ch2');
    assert.equal(st.traceStable, true);
    const frame = engine.acquire(50);
    assert.equal(frame.traces.ch1, undefined);
    within(cycles(frame, 2000), 2, 3, 'cycles');
    within(spanOf(frame, 'ch2').span, 4, 6, 'CH2 span');
  });
}

test('a small signal on a large DC offset, beyond the Position range, stays wholly on screen', () => {
  const engine = scrambled('tbs2072b', { gen1Wave: 'sine', gen1Freq: 1000, gen1Vpp: 1, gen1Offset: 4 });
  engine.press('autoset');
  const frame = engine.acquire(0);
  const { span } = spanOf(frame, 'ch1'); // asserts not clipped
  assert.ok(span > 0.5, `visible: span ${span}`);
  assert.equal(engine.state().traceStable, true);
});

test('Autoset with nothing displayed turns CH1 on', () => {
  const engine = createEngine(skinProfile('tbs2072b'));
  engine.press('ch1-menu');
  engine.press('autoset');
  assert.equal(engine.state().ch1Display, true);
  within(spanOf(engine.acquire(0), 'ch1').span, 4, 6, 'CH1 span');
});

test('Autoset returns the display format to YT, and the format is saved', () => {
  const engine = createEngine(skinProfile('tbs2072b'));
  assert.equal(engine.state().displayFormat, 'yt');
  engine.restore({ ...engine.serialize(), display: { format: 'xy' } });
  assert.equal(engine.state().displayFormat, 'xy');
  engine.press('autoset');
  assert.equal(engine.state().displayFormat, 'yt');
  engine.restore({ ...engine.serialize(), display: { format: 'bogus' } });
  assert.equal(engine.state().displayFormat, 'yt');
});

test('Autoset from Single leaves the scope running', () => {
  const engine = createEngine(skinProfile('tds2001c'));
  engine.press('single');
  engine.press('autoset');
  assert.equal(engine.state().runState, 'running');
});
