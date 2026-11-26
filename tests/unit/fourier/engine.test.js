import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harmonic, ideal, limit, partialSum, series } from '../../../tools/fourier/engine.js';

const SQUARE = { waveform: 'square', amp: 1, f0: 1000, offset: 0, shift: 0 };
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('the square wave table is the textbook one: An = 4·amp/(πn) for odd n at φn = −90°, zero for even n', () => {
  const s = series({ ...SQUARE, amp: 2 });
  assert.equal(s.dc, 0);
  close(s.terms[0].amp, 8 / Math.PI, 1e-12, 'A1');
  close(s.terms[2].amp, 8 / (3 * Math.PI), 1e-12, 'A3');
  close(s.terms[98].amp, 8 / (99 * Math.PI), 1e-12, 'A99');
  for (const n of [1, 3, 5, 99]) {
    assert.equal(s.terms[n - 1].n, n);
    close(s.terms[n - 1].phase, -90, 1e-12, `φ${n}`);
  }
  for (const n of [2, 4, 50, 100]) assert.equal(s.terms[n - 1].amp, 0, `A${n}`);
});

const TS = Array.from({ length: 41 }, (_, i) => (i / 40) * 2e-3); // two periods at 1 kHz

test('the partial sum with N = 0 is the DC term alone', () => {
  const s = series({ ...SQUARE, offset: 0.5 });
  for (const t of TS) assert.equal(partialSum(s, 0, t), 0.5);
  for (const t of TS) assert.equal(harmonic(s, 0, t), 0.5);
});

test('the fundamental of a ±1 V square peaks at 4/π V a quarter period in', () => {
  const s = series(SQUARE);
  close(partialSum(s, 1, 0.25e-3), 4 / Math.PI, 1e-12);
  close(harmonic(s, 1, 0.75e-3), -4 / Math.PI, 1e-12);
  close(harmonic(s, 3, 0.25e-3 / 3), 4 / (3 * Math.PI), 1e-12);
});

test('each extra harmonic changes the partial sum by exactly that harmonic', () => {
  const s = series(SQUARE);
  for (const N of [1, 2, 3, 7, 50, 100]) {
    for (const t of TS) close(partialSum(s, N, t) - partialSum(s, N - 1, t), harmonic(s, N, t), 1e-12, `N=${N}`);
  }
});

test('an even N adds nothing to the square wave partial sum', () => {
  const s = series(SQUARE);
  for (const N of [2, 4, 10, 100]) {
    for (const t of TS) {
      assert.equal(harmonic(s, N, t), 0);
      assert.equal(partialSum(s, N, t), partialSum(s, N - 1, t));
    }
  }
});

test('the ideal square is +amp for the first half period and −amp for the second', () => {
  const sq = { ...SQUARE, amp: 2 };
  for (const t of [0.1e-3, 0.4e-3, 1.2e-3]) assert.equal(ideal(sq, t), 2);
  for (const t of [0.6e-3, 0.9e-3, 1.7e-3]) assert.equal(ideal(sq, t), -2);
});

test('with no filter the N = ∞ curve is the ideal waveform', () => {
  for (const t of TS) assert.equal(limit(SQUARE, t), ideal(SQUARE, t));
});

test('a high-N partial sum approaches the ideal square away from the jumps', () => {
  const s = series(SQUARE, 1000);
  // Sample points at least a twentieth of a period from each jump (t = 0, T/2, T, ...).
  for (let p = 0.05; p <= 0.45; p += 0.01) {
    for (const t of [p * 1e-3, (p + 0.5) * 1e-3]) close(partialSum(s, 1000, t), ideal(SQUARE, t), 0.01, `t=${t}`);
  }
});

test('the partial sum through N = 100 is already within 5% of the square a tenth of a period from the jumps', () => {
  const s = series(SQUARE);
  for (let p = 0.1; p <= 0.4; p += 0.01) close(partialSum(s, 100, p * 1e-3), 1, 0.05, `p=${p}`);
});
