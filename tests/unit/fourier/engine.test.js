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

// ── Every waveform (ticket 03) ──

const WAVE = (waveform, extra = {}) => ({ waveform, amp: 1, f0: 1000, offset: 0, shift: 0, ...extra });

test('the sine table is a single term: A1 = amp at φ1 = −90° (amp·sin), every other harmonic zero', () => {
  const s = series(WAVE('sine', { amp: 1.5 }));
  close(s.terms[0].amp, 1.5, 1e-12, 'A1');
  close(s.terms[0].phase, -90, 1e-12, 'φ1');
  for (let n = 2; n <= 100; n += 1) assert.equal(s.terms[n - 1].amp, 0, `A${n}`);
});

test('the triangle table is the textbook one: An = 8·amp/(π²n²) for odd n, alternating −90°/+90°, zero for even n', () => {
  const s = series(WAVE('triangle', { amp: 2 }));
  close(s.terms[0].amp, 16 / Math.PI ** 2, 1e-12, 'A1');
  close(s.terms[2].amp, 16 / (9 * Math.PI ** 2), 1e-12, 'A3');
  close(s.terms[4].amp, 16 / (25 * Math.PI ** 2), 1e-12, 'A5');
  close(s.terms[0].phase, -90, 1e-12, 'φ1');
  close(s.terms[2].phase, 90, 1e-12, 'φ3');
  close(s.terms[4].phase, -90, 1e-12, 'φ5');
  close(s.terms[6].phase, 90, 1e-12, 'φ7');
  for (const n of [2, 4, 50, 100]) assert.equal(s.terms[n - 1].amp, 0, `A${n}`);
});

test('the sawtooth table is the textbook one: An = 2·amp/(πn) for every n, with nonzero even harmonics', () => {
  const s = series(WAVE('sawtooth'));
  close(s.terms[0].amp, 2 / Math.PI, 1e-12, 'A1');
  close(s.terms[1].amp, 1 / Math.PI, 1e-12, 'A2');
  close(s.terms[9].amp, 2 / (10 * Math.PI), 1e-12, 'A10');
  for (const n of [1, 3, 5]) close(s.terms[n - 1].phase, -90, 1e-12, `φ${n}`);
  for (const n of [2, 4, 6]) close(s.terms[n - 1].phase, 90, 1e-12, `φ${n}`);
});

test('square terms fall as 1/n and triangle terms as 1/n²', () => {
  const sq = series(WAVE('square'));
  const tri = series(WAVE('triangle'));
  close(sq.terms[0].amp / sq.terms[8].amp, 9, 1e-9, 'square A1/A9');
  close(tri.terms[0].amp / tri.terms[8].amp, 81, 1e-9, 'triangle A1/A9');
});

test('the ideal waveforms all start at their mean, rising, at t = 0', () => {
  close(ideal(WAVE('sine'), 0.25e-3), 1, 1e-12, 'sine peak at T/4');
  close(ideal(WAVE('triangle'), 0.25e-3), 1, 1e-12, 'triangle peak at T/4');
  close(ideal(WAVE('triangle'), 0.75e-3), -1, 1e-12, 'triangle trough at 3T/4');
  close(ideal(WAVE('triangle'), 0.125e-3), 0.5, 1e-12, 'triangle at T/8');
  close(ideal(WAVE('sawtooth'), 0.25e-3), 0.5, 1e-12, 'sawtooth at T/4');
  close(ideal(WAVE('sawtooth'), 0.75e-3), -0.5, 1e-12, 'sawtooth at 3T/4');
  assert.equal(ideal(WAVE('sawtooth'), 0.5e-3), 0, 'sawtooth jump midpoint');
});

test('a shift of Δφ degrees adds −nΔφ to each φn and leaves every An alone', () => {
  for (const waveform of ['sine', 'square', 'triangle', 'sawtooth']) {
    const base = series(WAVE(waveform));
    const shifted = series(WAVE(waveform, { shift: 30 }));
    for (let n = 1; n <= 20; n += 1) {
      const b = base.terms[n - 1];
      const s = shifted.terms[n - 1];
      close(s.amp, b.amp, 1e-12, `${waveform} A${n}`);
      if (b.amp === 0) continue;
      const d = ((((s.phase - (b.phase - 30 * n)) % 360) + 540) % 360) - 180; // wrapped difference
      close(d, 0, 1e-9, `${waveform} φ${n}`);
    }
  }
});

test('a DC offset changes only the n = 0 term', () => {
  for (const waveform of ['sine', 'square', 'triangle', 'sawtooth']) {
    const base = series(WAVE(waveform));
    const off = series(WAVE(waveform, { offset: -0.75 }));
    assert.equal(base.dc, 0);
    assert.equal(off.dc, -0.75);
    assert.deepEqual(off.terms, base.terms, waveform);
  }
});

test('the N = ∞ curve is the ideal waveform, shift and DC offset included', () => {
  const tri = WAVE('triangle', { offset: 0.5, shift: 90 });
  // Delayed by a quarter period, the triangle peaks at T/2 and sits at its mean at T/4.
  close(limit(tri, 0.5e-3), 1.5, 1e-12, 'peak');
  close(limit(tri, 0.25e-3), 0.5, 1e-12, 'mean');
  const saw = WAVE('sawtooth', { offset: 1, shift: -90 });
  close(limit(saw, 0), 1.5, 1e-12, 'sawtooth advanced by T/4');
});

test('high-N partial sums approach each ideal waveform, shifted and offset, away from the jumps', () => {
  const cases = [ // ranges of phase p within the (shifted) period to sample, clear of any jump
    ['sine', [0, 1]],
    ['triangle', [0, 1]],
    ['square', [0.05, 0.45, 0.55, 0.95]],
    ['sawtooth', [0, 0.45, 0.55, 1]],
  ];
  for (const [waveform, ranges] of cases) {
    const input = WAVE(waveform, { amp: 1.2, offset: 0.3, shift: 45 });
    const s = series(input, 2000);
    for (let r = 0; r < ranges.length; r += 2) {
      for (let p = ranges[r]; p <= ranges[r + 1] + 1e-9; p += 0.01) {
        const t = (p + 45 / 360) * 1e-3;
        close(partialSum(s, 2000, t), ideal(input, t), 0.02, `${waveform} p=${p.toFixed(2)}`);
      }
    }
  }
});

test('an unknown waveform is an error', () => {
  assert.throws(() => series(WAVE('pulse')), /unknown waveform/);
});
