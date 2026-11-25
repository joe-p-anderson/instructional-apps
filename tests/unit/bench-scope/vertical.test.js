// Seam 1 (Spec 0002), ticket 02: the vertical controls, driven only through engine events and
// read through acquire() frames, state() and serialize().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../../../tools/bench-scope/engine/engine.js';
import { skinProfile } from '../../../tools/bench-scope/engine/skins.js';

const tbs = () => skinProfile('tbs2072b');
const readout = (frame, id) => frame.readouts.find((r) => r.id === id)?.text;

test('turning the CH1 Scale knob clockwise steps V/div down the 1-2-5 sequence and stops at 2 mV', () => {
  const engine = createEngine(tbs());
  assert.equal(engine.state().ch1VPerDiv, 1);
  const seen = [];
  for (let i = 0; i < 12; i++) {
    engine.turn('ch1-scale', 1);
    seen.push(engine.state().ch1VPerDiv);
  }
  assert.deepEqual(seen, [0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.002, 0.002, 0.002, 0.002]);
  assert.equal(readout(engine.acquire(0), 'ch1-scale'), '2.00mV');
});

test('turning the CH1 Scale knob anticlockwise steps V/div up and stops at 5 V', () => {
  const engine = createEngine(tbs());
  engine.turn('ch1-scale', -1);
  assert.equal(engine.state().ch1VPerDiv, 2);
  assert.equal(readout(engine.acquire(0), 'ch1-scale'), '2.00V');
  engine.turn('ch1-scale', -5);
  assert.equal(engine.state().ch1VPerDiv, 5);
  engine.turn('ch1-scale', 3);
  assert.equal(engine.state().ch1VPerDiv, 0.5);
});

/** The CH volts back from a frame's trace: (y − position) · V/div. */
const volts = (tr) => tr.y.map((y) => (y - tr.position) * tr.vPerDiv);
const peak = (arr) => Math.max(...arr);

test('the CH1 Position knob moves the trace 0.1 division per detent, and a push recentres it', () => {
  const engine = createEngine(tbs());
  const centred = peak(engine.acquire(0).traces.ch1.y);
  engine.turn('ch1-position', 5);
  assert.equal(engine.state().ch1Position, 0.5);
  assert.ok(Math.abs(peak(engine.acquire(0).traces.ch1.y) - (centred + 0.5)) < 1e-9, 'trace moved up 0.5 div');
  engine.turn('ch1-position', -8);
  assert.equal(engine.state().ch1Position, -0.3);
  engine.push('ch1-position');
  assert.equal(engine.state().ch1Position, 0);
  assert.ok(Math.abs(peak(engine.acquire(0).traces.ch1.y) - centred) < 1e-9, 'trace back at centre');
});

test('the Position knob stops at ±5 divisions', () => {
  const engine = createEngine(tbs());
  engine.turn('ch1-position', 80);
  assert.equal(engine.state().ch1Position, 5);
  engine.turn('ch1-position', -200);
  assert.equal(engine.state().ch1Position, -5);
});

test('samples clip at the top and bottom of the screen, as the ADC would', () => {
  const engine = createEngine(tbs(), { gen1Vpp: 20 }); // ±10 V at 1 V/div: off both edges
  const tr = engine.acquire(0).traces.ch1;
  assert.equal(Math.max(...tr.y), 4);
  assert.equal(Math.min(...tr.y), -4);
  assert.equal(tr.clipped, true);

  engine.turn('ch1-scale', -2); // 5 V/div: fits
  const fits = engine.acquire(0).traces.ch1;
  assert.ok(Math.max(...fits.y) < 4 && Math.min(...fits.y) > -4);
  assert.equal(fits.clipped, false);

  engine.turn('ch1-position', 30); // +3 div: the 10 V peak (+2 div) would be at +5 div
  assert.equal(Math.max(...engine.acquire(0).traces.ch1.y), 4);
});

test('CH2 starts off; its menu button turns it on as a copy of CH1, with its own scale and position', () => {
  const engine = createEngine(tbs(), { gen1Vpp: 2 });
  let frame = engine.acquire(0);
  assert.equal(frame.traces.ch2, undefined);
  assert.equal(readout(frame, 'ch2-scale'), undefined);
  assert.equal(engine.state().ch2Display, false);

  engine.press('ch2-menu');
  engine.turn('ch2-scale', 1); // 500 mV/div
  engine.turn('ch2-position', -20);
  frame = engine.acquire(0);
  assert.equal(engine.state().ch2Display, true);
  assert.equal(readout(frame, 'ch2-scale'), '500mV');
  assert.equal(frame.traces.ch2.position, -2);
  const v1 = volts(frame.traces.ch1);
  const v2 = volts(frame.traces.ch2);
  for (let i = 0; i < v1.length; i++) assert.ok(Math.abs(v1[i] - v2[i]) < 0.1, `sample ${i}`); // each input has its own noise
  assert.equal(engine.state().ch1VPerDiv, 1, 'CH1 untouched');

  engine.press('ch2-menu');
  assert.equal(engine.acquire(0).traces.ch2, undefined);
});

test('the CH1 menu button (pressed with its menu showing) turns the CH1 trace and its readout off', () => {
  const engine = createEngine(tbs());
  engine.press('ch1-menu'); // opens the CH1 menu
  engine.press('ch1-menu'); // turns CH1 off
  const frame = engine.acquire(0);
  assert.equal(frame.traces.ch1, undefined);
  assert.equal(readout(frame, 'ch1-scale'), undefined);
  assert.equal(engine.state().ch1Display, false);
  engine.press('ch1-menu');
  assert.ok(engine.acquire(0).traces.ch1);
});

test('serialize/restore keeps both channels; junk is snapped and clamped', () => {
  const a = createEngine(tbs());
  a.turn('ch1-scale', 3);
  a.turn('ch1-position', 7);
  a.press('ch2-menu');
  a.turn('ch2-scale', -1);
  const b = createEngine(tbs());
  b.restore(JSON.parse(JSON.stringify(a.serialize())));
  assert.deepEqual(b.state(), a.state());
  assert.equal(b.state().ch1VPerDiv, 0.1);
  assert.equal(b.state().ch2Display, true);

  b.restore({ v: 1, ch1: { display: 'yes', vPerDiv: 0.3, position: 99 }, ch2: { vPerDiv: -4, position: 0.123 } });
  assert.deepEqual(
    [b.state().ch1Display, b.state().ch1VPerDiv, b.state().ch1Position, b.state().ch2Display, b.state().ch2VPerDiv, b.state().ch2Position],
    [true, 0.2, 5, false, 1, 0.1],
  );
});

test('knob and button Controls have engine values: get, set and a detent count for drawing', () => {
  const engine = createEngine(tbs());
  assert.equal(engine.value('ch1-scale'), 1);
  engine.apply({ type: 'set', control: 'ch1-scale', value: 0.05 });
  assert.equal(engine.state().ch1VPerDiv, 0.05);
  engine.apply({ type: 'set', control: 'ch1-scale', value: 0.04 }); // snaps to the sequence
  assert.equal(engine.value('ch1-scale'), 0.05);
  engine.apply({ type: 'set', control: 'ch2-position', value: -1.234 });
  assert.equal(engine.state().ch2Position, -1.2);
  engine.apply({ type: 'set', control: 'ch2-menu', value: true });
  assert.equal(engine.value('ch2-menu'), true);
  assert.equal(engine.value('no-such-control'), undefined);

  // The detent count follows the value: one per clockwise step.
  const d = engine.detent('ch1-scale');
  engine.turn('ch1-scale', 2);
  assert.equal(engine.detent('ch1-scale'), d + 2);
  engine.turn('ch1-scale', 9); // clamped at 2 mV: stops turning
  const stop = engine.detent('ch1-scale');
  engine.turn('ch1-scale', 1);
  assert.equal(engine.detent('ch1-scale'), stop);
  assert.equal(engine.detent('ch2-position'), -12);

  // A knob no feature handles yet still counts its turns.
  engine.turn('mp-knob', 3);
  engine.turn('mp-knob', -1);
  assert.equal(engine.detent('mp-knob'), 2);
});
