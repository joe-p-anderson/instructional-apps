import { test } from 'node:test';
import assert from 'node:assert/strict';
import { add, div, evaluate, fromPolar, mul, sum, toPolar, wrapDeg } from '../../../tools/phasors/engine.js';

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

test('angles wrap into (−180, 180]', () => {
  assert.equal(wrapDeg(270), -90);
  assert.equal(wrapDeg(180), 180);
  assert.equal(wrapDeg(-180), 180);
  assert.equal(wrapDeg(-450), -90);
  assert.equal(wrapDeg(45), 45);
});
