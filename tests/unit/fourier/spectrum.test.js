import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WAVEFORMS, filterResponse, spectrum } from '../../../tools/fourier/engine.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const wrap = (d) => { const w = ((d % 360) + 360) % 360; return w > 180 ? w - 360 : w; };
const closeDeg = (a, b, tol, msg) => close(wrap(a - b), 0, tol, msg);

// The first-order RC responses written out from the circuit, x = f/f_c:
//   low-pass  |H| = 1/√(1 + x²),  ∠H = −atan x
//   high-pass |H| = x/√(1 + x²),  ∠H = 90° − atan x
const deg = (r) => (r * 180) / Math.PI;
const RC = {
  lowpass: (x) => ({ gain: 1 / Math.sqrt(1 + x * x), phase: -deg(Math.atan(x)) }),
  highpass: (x) => ({ gain: x / Math.sqrt(1 + x * x), phase: 90 - deg(Math.atan(x)) }),
};

const INPUTS = WAVEFORMS.flatMap((waveform) => [
  { waveform, amp: 1, f0: 1000, offset: 0, shift: 0 },
  { waveform, amp: 2, f0: 250, offset: 0.5, shift: 30 },
]);

test('the spectrum has one entry for each n from 0 to 10, the DC term at n = 0', () => {
  const sq = { waveform: 'square', amp: 1, f0: 1000, offset: -0.5, shift: 0 };
  const s = spectrum(sq, { type: 'off' }, 'input');
  assert.deepEqual(s.map((e) => e.n), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  // A negative DC term is a positive amplitude at 180°.
  close(s[0].amp, 0.5, 1e-12);
  closeDeg(s[0].phase, 180, 1e-9);
  close(s[1].amp, 4 / Math.PI, 1e-12);
  closeDeg(s[1].phase, -90, 1e-9);
  assert.equal(s[2].amp, 0);
  close(s[3].amp, 4 / (3 * Math.PI), 1e-12);
});

test('the filter response is the RC gain and phase shift, with |H| = 1/√2 and ∓45° at f_c', () => {
  close(filterResponse({ type: 'lowpass', fc: 2000 }, 2000).gain, Math.SQRT1_2, 1e-12);
  close(filterResponse({ type: 'lowpass', fc: 2000 }, 2000).phase, -45, 1e-9);
  close(filterResponse({ type: 'highpass', fc: 2000 }, 2000).gain, Math.SQRT1_2, 1e-12);
  close(filterResponse({ type: 'highpass', fc: 2000 }, 2000).phase, 45, 1e-9);
  for (const type of ['lowpass', 'highpass']) {
    for (const f of [10, 300, 5000, 80000]) {
      const r = filterResponse({ type, fc: 1500 }, f);
      const want = RC[type](f / 1500);
      close(r.gain, want.gain, 1e-12, `${type} ${f} gain`);
      close(r.phase, want.phase, 1e-9, `${type} ${f} phase`);
    }
  }
  assert.equal(filterResponse({ type: 'off', fc: 1500 }, 1000), null);
});

test('the input spectrum ignores the filter', () => {
  const sq = INPUTS[2];
  const filter = { type: 'lowpass', fc: 800, gain: true, phase: true };
  assert.deepEqual(spectrum(sq, filter, 'input'), spectrum(sq, { type: 'off' }, 'input'));
});

test('at each harmonic the output spectrum is the input scaled by |H| and shifted by ∠H, as the toggles say', () => {
  for (const input of INPUTS) {
    for (const type of ['lowpass', 'highpass']) {
      for (const [gain, phase] of [[true, true], [true, false], [false, true], [false, false]]) {
        const filter = { type, fc: 1200, gain, phase };
        const inS = spectrum(input, filter, 'input');
        const outS = spectrum(input, filter, 'output');
        const where = `${input.waveform} f0 ${input.f0} ${type} gain ${gain} phase ${phase}`;
        for (let n = 1; n <= 10; n += 1) {
          const H = RC[type]((n * input.f0) / 1200);
          if (inS[n].amp === 0) { assert.equal(outS[n].amp, 0, `${where} n=${n}`); continue; }
          close(outS[n].amp, gain ? inS[n].amp * H.gain : inS[n].amp, 1e-12, `${where} n=${n} amp`);
          closeDeg(outS[n].phase, phase ? inS[n].phase + H.phase : inS[n].phase, 1e-9, `${where} n=${n} phase`);
        }
        // DC: the low-pass passes it (H(0) = 1), the high-pass blocks it (H(0) = 0), when gain applies.
        const dc = gain ? (type === 'lowpass' ? inS[0].amp : 0) : inS[0].amp;
        close(outS[0].amp, dc, 1e-12, `${where} DC`);
      }
    }
  }
});

test('with the filter off the output spectrum is the input spectrum', () => {
  for (const input of INPUTS) {
    assert.deepEqual(spectrum(input, { type: 'off', fc: 1000, gain: true, phase: true }, 'output'),
      spectrum(input, { type: 'off' }, 'input'));
  }
});
