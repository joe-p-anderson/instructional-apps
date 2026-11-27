import { test } from 'node:test';
import assert from 'node:assert/strict';
import { add, crest, div, evaluate, fromCrest, fromPolar, impedances, mul, omega0, omegaC, rotate, solve, sum, toPolar, wrapDeg } from '../../../tools/phasors/engine.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180; // into [−180, 180)
const closeDeg = (a, b, tol, msg) => close(wrap(a - b), 0, tol, msg);

test('complex add, multiply and divide match worked examples', () => {
  assert.deepEqual(add({ re: 1, im: 2 }, { re: 3, im: -5 }), { re: 4, im: -3 });
  assert.deepEqual(mul({ re: 1, im: 2 }, { re: 3, im: 4 }), { re: -5, im: 10 }); // (1+2j)(3+4j)
  const q = div({ re: -5, im: 10 }, { re: 3, im: 4 });
  close(q.re, 1, 1e-12, 're'); close(q.im, 2, 1e-12, 'im');
  const j = div({ re: 1, im: 0 }, { re: 0, im: 1 }); // 1/j = −j
  close(j.re, 0, 1e-12); close(j.im, -1, 1e-12);
});

test('rectangular to polar uses degrees: 3 + 4j is 5∠53.13°, −j is 1∠−90°, −1 is 1∠180°', () => {
  const p = toPolar({ re: 3, im: 4 });
  close(p.A, 5, 1e-12, 'A'); close(p.phi, 53.130102354, 1e-8, 'φ');
  const q = toPolar({ re: 0, im: -1 });
  close(q.A, 1, 1e-12); close(q.phi, -90, 1e-12);
  close(toPolar({ re: -1, im: 0 }).phi, 180, 1e-12);
  const z = fromPolar(2, 30);
  close(z.re, Math.sqrt(3), 1e-12, 're'); close(z.im, 1, 1e-12, 'im');
});

test('rectangular ↔ polar round-trips', () => {
  for (const [re, im] of [[1, 0], [0, 2], [-3, 4], [-2.5, -0.5], [7, -7], [1e-3, 5e3]]) {
    const p = toPolar({ re, im });
    const z = fromPolar(p.A, p.phi);
    close(z.re, re, 1e-9 * Math.hypot(re, im), `re of ${re}+j${im}`);
    close(z.im, im, 1e-9 * Math.hypot(re, im), `im of ${re}+j${im}`);
  }
  for (const [A, phi] of [[1, 0], [2, 90], [3, -150], [0.5, 179], [4, 45]]) {
    const p = toPolar(fromPolar(A, phi));
    close(p.A, A, 1e-12, `A of ${A}∠${phi}`); closeDeg(p.phi, phi, 1e-9, `φ of ${A}∠${phi}`);
  }
});

const PAIRS = [
  [{ A: 3, phi: 0 }, { A: 4, phi: 90 }],
  [{ A: 5, phi: 30 }, { A: 2, phi: 150 }],
  [{ A: 1.5, phi: -60 }, { A: 2.5, phi: 75 }],
  [{ A: 4, phi: 200 }, { A: 1, phi: -10 }],
];

test('the sum matches the law of cosines for amplitude and atan2 of the components for phase', () => {
  for (const [p1, p2] of PAIRS) {
    const s = sum(p1, p2);
    const d = ((p2.phi - p1.phi) * Math.PI) / 180;
    const lawOfCosines = Math.sqrt(p1.A ** 2 + p2.A ** 2 + 2 * p1.A * p2.A * Math.cos(d));
    close(s.A, lawOfCosines, 1e-12, `A for ${p1.phi}, ${p2.phi}`);
    const rad = (deg) => (deg * Math.PI) / 180;
    const x = p1.A * Math.cos(rad(p1.phi)) + p2.A * Math.cos(rad(p2.phi));
    const y = p1.A * Math.sin(rad(p1.phi)) + p2.A * Math.sin(rad(p2.phi));
    closeDeg(s.phi, (Math.atan2(y, x) * 180) / Math.PI, 1e-9, `φ for ${p1.phi}, ${p2.phi}`);
  }
  const s = sum({ A: 3, phi: 0 }, { A: 4, phi: 90 }); // the 3-4-5 triangle
  close(s.A, 5, 1e-12); close(s.phi, 53.130102354, 1e-8);
});

test('in phase the sum is A₁ + A₂; 180° apart it is |A₁ − A₂| at the larger one’s phase', () => {
  const inPhase = sum({ A: 3, phi: 40 }, { A: 2, phi: 40 });
  close(inPhase.A, 5, 1e-12); closeDeg(inPhase.phi, 40, 1e-9);
  const opposed = sum({ A: 3, phi: 40 }, { A: 5, phi: 220 });
  close(opposed.A, 2, 1e-12); closeDeg(opposed.phi, 220, 1e-9);
});

test('a phasor evaluates as A cos(ωt + φ)', () => {
  close(evaluate({ A: 2, phi: 0 }, 1000, 0), 2, 1e-12);
  close(evaluate({ A: 2, phi: 90 }, 1000, 0), 0, 1e-12);
  close(evaluate({ A: 2, phi: -90 }, 1000, Math.PI / 2000), 2, 1e-12); // a quarter period in
  close(evaluate({ A: 3, phi: 60 }, 500, 0), 1.5, 1e-12);
});

test('the time-domain sum equals v₁(t) + v₂(t) at many t', () => {
  const omega = 2 * Math.PI * 50;
  for (const [p1, p2] of PAIRS) {
    const s = sum(p1, p2);
    for (let i = 0; i <= 100; i += 1) {
      const t = (i / 100) * 0.04;
      close(evaluate(s, omega, t), evaluate(p1, omega, t) + evaluate(p2, omega, t), 1e-9, `t = ${t}`);
    }
  }
});

test('a rotated phasor A∠(ωt + φ) has real part A cos(ωt + φ) and keeps its amplitude, at many t', () => {
  const omega = 2 * Math.PI * 60;
  for (const p of [{ A: 2, phi: 0 }, { A: 3, phi: 60 }, { A: 1.5, phi: -135 }, { A: 4, phi: 180 }]) {
    for (let i = 0; i <= 100; i += 1) {
      const t = (i / 100) * (2 / 60);
      const z = rotate(p, omega, t);
      close(z.re, p.A * Math.cos(omega * t + (p.phi * Math.PI) / 180), 1e-12, `re at t = ${t}`);
      close(Math.hypot(z.re, z.im), p.A, 1e-12, 'amplitude');
    }
  }
  const q = rotate({ A: 2, phi: 30 }, 1000, Math.PI / 2000); // a quarter period on: 2∠120°
  close(q.re, -1, 1e-12, 're'); close(q.im, Math.sqrt(3), 1e-12, 'im');
});

test('rotation keeps the angle between two phasors fixed', () => {
  const p1 = { A: 3, phi: 10 }; const p2 = { A: 2, phi: 85 };
  for (const t of [0, 1e-4, 7e-4, 3e-3]) {
    const a = toPolar(rotate(p1, 1000, t)); const b = toPolar(rotate(p2, 1000, t));
    closeDeg(b.phi - a.phi, 75, 1e-9, `at t = ${t}`);
  }
});

test('angles wrap into (−180, 180]', () => {
  assert.equal(wrapDeg(270), -90);
  assert.equal(wrapDeg(180), 180);
  assert.equal(wrapDeg(-180), 180);
  assert.equal(wrapDeg(-450), -90);
  assert.equal(wrapDeg(45), 45);
});

test('a crest sits at t = −φ/ω, height A: 2∠90° at ω = 1000 peaks at t = −π/2000 s', () => {
  const c = crest({ A: 2, phi: 90 }, 1000);
  close(c.t, -Math.PI / 2000, 1e-15, 't'); close(c.A, 2, 1e-12, 'A');
  close(evaluate({ A: 2, phi: 90 }, 1000, c.t), 2, 1e-12, 'the curve peaks there');
  close(crest({ A: 1, phi: 0 }, 50).t, 0, 1e-15, 'φ = 0 peaks at t = 0');
  close(crest({ A: 1, phi: -45 }, 100).t, Math.PI / 400, 1e-15, 'a lagging phasor peaks later');
});

test('the crest is the one nearest t = 0, within half a period', () => {
  const omega = 2 * Math.PI * 60;
  const T = 1 / 60;
  for (const phi of [-179, -90, 0, 90, 180, 270, -450]) {
    const c = crest({ A: 1, phi }, omega);
    assert.ok(Math.abs(c.t) <= T / 2 + 1e-15, `φ = ${phi}: t = ${c.t}`);
    close(evaluate({ A: 1, phi }, omega, c.t), 1, 1e-12, `φ = ${phi} peaks at its crest`);
  }
});

test('the crest mapping round-trips (A, φ) → (t, A) → (A, φ) across φ in (−180°, 180°]', () => {
  for (const omega of [100, 1000, 2 * Math.PI * 50, 1e6]) {
    for (let phi = -179.5; phi <= 180; phi += 0.5) {
      for (const A of [0.25, 3, 10]) {
        const p = fromCrest(crest({ A, phi }, omega), omega);
        close(p.A, A, 1e-12, `A at ${A}∠${phi}, ω = ${omega}`);
        close(p.phi, phi, 1e-9, `φ at ${A}∠${phi}, ω = ${omega}`);
        assert.ok(p.phi > -180 && p.phi <= 180, `φ in range: ${p.phi}`);
      }
    }
  }
});

test('a crest dragged past half a period becomes the next crest: φ wraps into (−180, 180]', () => {
  const omega = 1000;
  const quarter = Math.PI / 2 / omega;
  const p = fromCrest({ t: -3 * quarter, A: 2 }, omega); // ωt = −270°: φ = 270° ≡ −90°
  close(p.phi, -90, 1e-9); close(p.A, 2, 1e-12);
});

// ── Series circuits ──
// Values in SI: R in Ω, L in H, C in F, ω in rad/s. A subset of { R, L, C } is the included elements.

const SUBSETS = [['R'], ['L'], ['C'], ['R', 'L'], ['R', 'C'], ['L', 'C'], ['R', 'L', 'C']];
const PARTS = { R: 100, L: 0.05, C: 2e-6 }; // 100 Ω, 50 mH, 2 µF
const closeZ = (z, re, im, tol, msg) => { close(z.re, re, tol, `${msg} re`); close(z.im, im, tol, `${msg} im`); };

test('Z for every R/L/C subset is R + jωL + 1/(jωC) over the included elements; excluded ones give none', () => {
  for (const omega of [100, 1000, 3162, 1e5]) {
    for (const on of SUBSETS) {
      const z = impedances({ ...PARTS, include: on, omega });
      // independent: ωL up, 1/(ωC) down, summed by hand
      const re = on.includes('R') ? 100 : 0;
      const im = (on.includes('L') ? omega * 0.05 : 0) - (on.includes('C') ? 1 / (omega * 2e-6) : 0);
      closeZ(z.total, re, im, 1e-9 * Math.max(1, Math.abs(im)), `${on} at ${omega}`);
      for (const k of ['R', 'L', 'C']) assert.equal(z[k] === null, !on.includes(k), `${k} in ${on}`);
      if (on.includes('R')) closeZ(z.R, 100, 0, 1e-12, 'Z_R');
      if (on.includes('L')) closeZ(z.L, 0, omega * 0.05, 1e-9, 'Z_L');
      if (on.includes('C')) closeZ(z.C, 0, -1 / (omega * 2e-6), 1e-6, 'Z_C');
    }
  }
  // a worked example: 100 Ω, 50 mH, 2 µF at 1000 rad/s is 100 + j50 − j500 = 100 − j450 Ω
  closeZ(impedances({ ...PARTS, include: ['R', 'L', 'C'], omega: 1000 }).total, 100, -450, 1e-9, 'RLC');
});

test('I = V/Z: 10 V across 100 − j450 Ω (RLC at 1000 rad/s) is 0.0217∠77.47° A', () => {
  const c = solve({ V0: 10, ...PARTS, include: ['R', 'L', 'C'], omega: 1000 });
  const I = toPolar(c.I);
  close(I.A, 0.021693045781865616, 1e-12, '|I|'); // 10 / √(100² + 450²)
  close(I.phi, 77.47119229084849, 1e-9, '∠I'); // atan(450/100)
  closeZ(c.Vin, 10, 0, 1e-12, 'V_in is the phase reference');
  closeZ(c.Z.total, 100, -450, 1e-9, 'the impedances come back too');
});

test('V_R ∥ I, ∠V_L − ∠I = +90° and ∠V_C − ∠I = −90°, for every subset and many ω', () => {
  for (const omega of [100, 700, 5000, 2e5]) {
    for (const on of SUBSETS) {
      const c = solve({ V0: 5, ...PARTS, include: on, omega });
      const aI = toPolar(c.I).phi;
      for (const k of ['R', 'L', 'C']) assert.equal(c.V[k] === null, !on.includes(k), `V_${k} in ${on}`);
      if (c.V.R) closeDeg(toPolar(c.V.R).phi - aI, 0, 1e-9, `V_R in ${on}`);
      if (c.V.L) closeDeg(toPolar(c.V.L).phi - aI, 90, 1e-9, `V_L in ${on}`);
      if (c.V.C) closeDeg(toPolar(c.V.C).phi - aI, -90, 1e-9, `V_C in ${on}`);
      if (c.V.R) close(toPolar(c.V.R).A, toPolar(c.I).A * 100, 1e-9, '|V_R| = |I| R');
    }
  }
});

test('KVL: the device voltages sum to V_in for every subset and many ω', () => {
  for (const omega of [100, 1000, 3162, 1e6]) {
    for (const on of SUBSETS) {
      const c = solve({ V0: 7, ...PARTS, include: on, omega });
      const total = ['R', 'L', 'C'].reduce((acc, k) => (c.V[k] ? add(acc, c.V[k]) : acc), { re: 0, im: 0 });
      closeZ(total, 7, 0, 1e-9, `${on} at ${omega}`);
    }
  }
});

test('ω₀ = 1/√(LC) and ω_c = 1/(RC): 50 mH and 2 µF resonate at 3162 rad/s; 100 Ω and 2 µF cut off at 5000', () => {
  close(omega0(0.05, 2e-6), 3162.2776601683795, 1e-9, 'ω₀');
  close(omegaC(100, 2e-6), 5000, 1e-9, 'ω_c');
});

test('at ω₀, ∠Z = 0 and V_L = −V_C (with R in the loop)', () => {
  const w0 = omega0(PARTS.L, PARTS.C);
  const c = solve({ V0: 10, ...PARTS, include: ['R', 'L', 'C'], omega: w0 });
  close(toPolar(c.Z.total).phi, 0, 1e-9, '∠Z');
  closeZ(c.V.L, -c.V.C.re, -c.V.C.im, 1e-9, 'V_L = −V_C');
  closeZ(c.V.R, 10, 0, 1e-9, 'all of V_in across R');
  assert.ok(toPolar(c.V.L).A > 10, 'V_L exceeds V₀ here (Q > 1)');
});

test('L and C alone exactly at ω₀ have Z = 0 and no finite current', () => {
  const c = solve({ V0: 1, R: 100, L: 1, C: 1e-6, include: ['L', 'C'], omega: 1000 });
  closeZ(c.Z.total, 0, 0, 1e-12, 'Z');
  assert.equal(c.I, null);
  assert.deepEqual(c.V, { R: null, L: null, C: null });
});

test('for series RC, V_C/V_in = 1/(1 + jωRC) at many ω', () => {
  const R = 1000; const C = 0.1e-6;
  for (let i = 0; i <= 40; i += 1) {
    const omega = 100 * 10 ** (i / 10);
    const c = solve({ V0: 3, R, C, L: 0.01, include: ['R', 'C'], omega });
    const H = div(c.V.C, c.Vin);
    const x = omega * R * C; // 1/(1 + jx) = (1 − jx)/(1 + x²)
    closeZ(H, 1 / (1 + x * x), -x / (1 + x * x), 1e-12, `ω = ${omega}`);
  }
});
