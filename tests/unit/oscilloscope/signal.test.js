import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metrics } from '../../../tools/oscilloscope/signal.js';

test('phase shift is 2π f Δt: f = 0.5 Hz, Δt = 0.5 s gives π/2', () => {
  const m = metrics({ Va: 2, f: 0.5, Dt: 0.5 });
  assert.ok(Math.abs(m.phi - 1.5707963) < 1e-6);
});

test('period is 1/f: f = 1/3 Hz gives T = 3 s', () => {
  assert.ok(Math.abs(metrics({ Va: 1, f: 1 / 3, Dt: 0 }).T - 3) < 1e-9);
});

test('peak-to-peak is twice the amplitude: Va = 2 V gives 4 V', () => {
  assert.equal(metrics({ Va: 2, f: 0.5, Dt: 0 }).pkpk, 4);
});
