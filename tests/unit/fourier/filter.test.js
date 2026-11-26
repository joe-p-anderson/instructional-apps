import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMIT_N, filterSeries, ideal, limitCurve, partialSum, series } from '../../../tools/fourier/engine.js';

const WAVE = (waveform, extra = {}) => ({ waveform, amp: 1, f0: 1000, offset: 0, shift: 0, ...extra });
const RC = (type, extra = {}) => ({ type, fc: 1000, gain: true, phase: true, ...extra });
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('a low-pass at f_c = f₀ scales the fundamental by 1/√2 and delays it by 45°', () => {
  const s = filterSeries(series(WAVE('square')), RC('lowpass'));
  close(s.terms[0].amp, 4 / Math.PI / Math.SQRT2, 1e-12, 'A1');
  close(s.terms[0].phase, -135, 1e-9, 'φ1');
  // The 3rd harmonic: |H| = 1/√10, ∠H = −arctan 3.
  close(s.terms[2].amp, 4 / (3 * Math.PI) / Math.sqrt(10), 1e-12, 'A3');
  close(s.terms[2].phase, -90 - (Math.atan(3) * 180) / Math.PI, 1e-9, 'φ3');
});

test('gain only changes the amplitudes and phase only changes the phases, for either filter', () => {
  for (const type of ['lowpass', 'highpass']) {
    for (const waveform of ['square', 'sawtooth']) {
      const input = series(WAVE(waveform, { offset: 0.5, shift: 20 }));
      const both = filterSeries(input, RC(type, { fc: 2500 }));
      const gainOnly = filterSeries(input, RC(type, { fc: 2500, phase: false }));
      const phaseOnly = filterSeries(input, RC(type, { fc: 2500, gain: false }));
      close(gainOnly.dc, both.dc, 1e-12, `${type} gain-only DC`);
      assert.equal(phaseOnly.dc, input.dc, `${type} phase-only DC`);
      for (let n = 1; n <= 30; n += 1) {
        const [i, b, g, p] = [input, both, gainOnly, phaseOnly].map((s) => s.terms[n - 1]);
        if (i.amp === 0) continue;
        assert.notEqual(g.amp, i.amp, `${type} ${waveform} gain-only A${n} changes`);
        close(g.amp, b.amp, 1e-12, `${type} ${waveform} gain-only A${n}`);
        assert.equal(g.phase, i.phase, `${type} ${waveform} gain-only φ${n}`);
        assert.equal(p.amp, i.amp, `${type} ${waveform} phase-only A${n}`);
        assert.notEqual(p.phase, i.phase, `${type} ${waveform} phase-only φ${n} changes`);
        close(p.phase, b.phase, 1e-9, `${type} ${waveform} phase-only φ${n}`);
      }
    }
  }
});

test('the DC term is scaled by H(0): a low-pass passes it and a high-pass blocks it', () => {
  const input = series(WAVE('square', { offset: 0.5 }));
  assert.equal(filterSeries(input, RC('lowpass')).dc, 0.5);
  assert.equal(filterSeries(input, RC('highpass')).dc, 0);
});

// ── The N = ∞ curve ──

const T = 1e-3; // f0 = 1 kHz
const JUMPS = { sine: [], square: [0, 0.5], triangle: [], sawtooth: [0.5] }; // in periods, at shift 0
/** Sample times over one period, at least `gap` periods from any jump of the input. */
function awayFromJumps(waveform, gap = 0.05, count = 80) {
  const ts = [];
  for (let k = 0; k < count; k += 1) {
    const p = (k + 0.5) / count;
    if (JUMPS[waveform].every((j) => Math.min(Math.abs(p - j), 1 - Math.abs(p - j)) >= gap)) ts.push(p * T);
  }
  return ts;
}

test('the low-pass square N = ∞ curve is the RC charging curve: it peaks at amp·tanh(T/4τ) at T/2', () => {
  const fc = 3000;
  const tau = 1 / (2 * Math.PI * fc);
  const v = limitCurve(WAVE('square', { amp: 2 }), RC('lowpass', { fc }));
  close(v(T / 2), 2 * Math.tanh(T / (4 * tau)), 1e-12, 'peak');
  close(v(0), -2 * Math.tanh(T / (4 * tau)), 1e-12, 'trough');
  // It charges toward +amp during the first half: v(t) = amp − (amp + peak)·e^(−t/τ).
  const peak = 2 * Math.tanh(T / (4 * tau));
  close(v(T / 8), 2 - (2 + peak) * Math.exp(-T / 8 / tau), 1e-12, 'charging');
});

test('the high-pass square N = ∞ curve is the decaying spikes: it jumps by 2·amp and decays as e^(−t/τ)', () => {
  const fc = 3000;
  const tau = 1 / (2 * Math.PI * fc);
  const v = limitCurve(WAVE('square'), RC('highpass', { fc }));
  const start = 1 + Math.tanh(T / (4 * tau)); // just after the rising jump
  close(v(T / 8), start * Math.exp(-T / 8 / tau), 1e-12, 'decay');
  close(v(T / 2 + T / 8), -start * Math.exp(-T / 8 / tau), 1e-12, 'negative spike');
});

test('key test: with gain and phase on, the filtered partial sum converges to the analytic N = ∞ curve away from the jumps', () => {
  const N = 4000;
  for (const type of ['lowpass', 'highpass']) {
    for (const waveform of ['sine', 'square', 'triangle', 'sawtooth']) {
      for (const fc of [300, 3000]) {
        const input = WAVE(waveform, { amp: 1.5, offset: 0.25 });
        const filter = RC(type, { fc });
        const s = filterSeries(series(input, N), filter);
        const v = limitCurve(input, filter);
        for (const t of awayFromJumps(waveform)) close(partialSum(s, N, t), v(t), 0.01, `${type} ${waveform} fc=${fc} t=${t}`);
      }
    }
  }
});

test('the analytic N = ∞ curve follows a shift as a delay of the whole response', () => {
  const filter = RC('lowpass', { fc: 3000 });
  const v0 = limitCurve(WAVE('sawtooth'), filter);
  const v = limitCurve(WAVE('sawtooth', { shift: 90 }), filter);
  for (const t of awayFromJumps('sawtooth')) close(v(t + T / 4), v0(t), 1e-12, `t=${t}`);
});

test('low-pass output plus high-pass output is the input (V_C + V_R = v_in), in the series and at N = ∞', () => {
  for (const waveform of ['sine', 'square', 'triangle', 'sawtooth']) {
    const input = WAVE(waveform, { offset: 0.5, shift: 30 });
    const s = series(input);
    const lp = filterSeries(s, RC('lowpass', { fc: 2000 }));
    const hp = filterSeries(s, RC('highpass', { fc: 2000 }));
    const vLp = limitCurve(input, RC('lowpass', { fc: 2000 }));
    const vHp = limitCurve(input, RC('highpass', { fc: 2000 }));
    for (let k = 0; k < 50; k += 1) {
      const t = (k / 50) * 2 * T;
      close(partialSum(lp, 100, t) + partialSum(hp, 100, t), partialSum(s, 100, t), 1e-9, `${waveform} sum t=${t}`);
      close(vLp(t) + vHp(t), ideal(input, t), 1e-12, `${waveform} N = ∞ t=${t}`);
    }
  }
});

test('with one toggle on, the N = ∞ curve is the high-order sum, unlike both the input and the RC response', () => {
  const input = WAVE('square');
  for (const toggles of [{ phase: false }, { gain: false }]) {
    const filter = RC('lowpass', { fc: 3000, ...toggles });
    const v = limitCurve(input, filter);
    const s = filterSeries(series(input, LIMIT_N), filter);
    const rc = limitCurve(input, RC('lowpass', { fc: 3000 }));
    let fromInput = 0; let fromRc = 0;
    for (const t of awayFromJumps('square')) {
      close(v(t), partialSum(s, LIMIT_N, t), 1e-12, `t=${t}`);
      fromInput = Math.max(fromInput, Math.abs(v(t) - ideal(input, t)));
      fromRc = Math.max(fromRc, Math.abs(v(t) - rc(t)));
    }
    assert.ok(fromInput > 0.1 && fromRc > 0.1, `${JSON.stringify(toggles)}: ${fromInput}, ${fromRc}`);
  }
});

test('with no filter the N = ∞ curve is the ideal waveform', () => {
  const input = WAVE('triangle', { offset: 0.5 });
  for (const filter of [RC('off'), RC('highpass', { gain: false, phase: false }), undefined]) {
    const v = limitCurve(input, filter);
    for (let k = 0; k < 20; k += 1) assert.equal(v(k * 1e-4), ideal(input, k * 1e-4));
  }
});

test('a filter that is off, or with both toggles off, leaves the series alone', () => {
  const input = series(WAVE('triangle', { offset: 0.5 }));
  assert.deepEqual(filterSeries(input, RC('off')), input);
  assert.deepEqual(filterSeries(input, RC('lowpass', { gain: false, phase: false })), input);
});
