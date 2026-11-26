import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WAVEFORMS, product, productAverage, series, testFunction } from '../../../tools/fourier/engine.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

const INPUTS = WAVEFORMS.flatMap((waveform) => [
  { waveform, amp: 1, f0: 1000, offset: 0, shift: 0 },
  { waveform, amp: 2, f0: 250, offset: 0.5, shift: 30 },
]);

// The tabled coefficients in the sine-cosine form v = a0 + Σ (an cos nωt + bn sin nωt), from the
// cos-convention table An·cos(nωt + φn): an = An cos φn and bn = −An sin φn; a0 is the DC term.
function tabled(input, n) {
  const s = series(input, 10);
  if (n === 0) return { a: s.dc, b: 0 };
  const { amp, phase } = s.terms[n - 1];
  const rad = (phase * Math.PI) / 180;
  return { a: amp * Math.cos(rad), b: -amp * Math.sin(rad) };
}

test('the test functions are cos and sin of 2π n f0 t, and n = 0 gives the DC test (cos 0 = 1, sin 0 = 0)', () => {
  close(testFunction('cos', 1000, 2, 0.125e-3), Math.cos(Math.PI / 2), 1e-12);
  close(testFunction('sin', 1000, 1, 0.25e-3), 1, 1e-12);
  for (const t of [0, 0.3e-3, 0.7e-3]) {
    assert.equal(testFunction('cos', 1000, 0, t), 1);
    assert.equal(testFunction('sin', 1000, 0, t), 0);
  }
  assert.throws(() => testFunction('tan', 1000, 1, 0), /test function/);
});

test('the product is the input times the test function', () => {
  const sq = { waveform: 'square', amp: 1, f0: 1000, offset: 0, shift: 0 };
  assert.equal(product(sq, 'cos', 0, 0.2e-3), 1);
  close(product(sq, 'sin', 1, 0.25e-3), 1, 1e-12);
  close(product(sq, 'sin', 1, 0.75e-3), 1, 1e-12); // −1 × −1: both halves add
  close(product(sq, 'cos', 1, 0.75e-3), 0, 1e-12);
});

test('for every waveform and n from 0 to 10, the product averages to the tabled coefficient (half of it for n ≥ 1)', () => {
  for (const input of INPUTS) {
    for (let n = 0; n <= 10; n += 1) {
      const { a, b } = tabled(input, n);
      const k = n === 0 ? 1 : 2;
      const where = `${input.waveform} shift ${input.shift} n=${n}`;
      close(k * productAverage(input, 'cos', n), a, 1e-3, `${where} cos`);
      close(k * productAverage(input, 'sin', n), b, 1e-3, `${where} sin`);
    }
  }
});

test('the square-wave products give the textbook bn = 4/(πn) for odd n and nothing for cos', () => {
  const sq = { waveform: 'square', amp: 1, f0: 1000, offset: 0, shift: 0 };
  for (const n of [1, 3, 5]) close(2 * productAverage(sq, 'sin', n), 4 / (Math.PI * n), 1e-3, `b${n}`);
  for (const n of [1, 2, 3]) close(productAverage(sq, 'cos', n), 0, 1e-3, `a${n}`);
});

test('for a pure sine, shifted or not, the n = 2 and n = 3 products average to zero', () => {
  for (const shift of [0, 45, -120]) {
    const sine = { waveform: 'sine', amp: 1, f0: 1000, offset: 0, shift };
    for (const n of [2, 3]) {
      for (const fn of ['cos', 'sin']) close(productAverage(sine, fn, n), 0, 1e-9, `shift ${shift} ${fn} n=${n}`);
    }
  }
});
