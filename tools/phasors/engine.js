// Phasors Tool: the phasor engine. Pure maths, no DOM, so Node tests can import it; it is the
// Tool's only source of phasor and circuit maths.
//
// A complex number is { re, im }. A phasor is { A, phi }: amplitude A and phase φ in degrees,
// standing for the sinusoid A cos(ωt + φ). Angles are always degrees, in (−180, 180].
//
//   add(a, b), mul(a, b), div(a, b)   complex arithmetic
//   toPolar(z) -> { A, phi }          rectangular to polar
//   fromPolar(A, phi) -> { re, im }   polar to rectangular
//   sum(p1, p2) -> { A, phi }         the resultant of two same-frequency phasors
//   evaluate(p, omega, t)             A cos(ωt + φ) at time t (s), ω in rad/s
//   rotate(p, omega, t) -> { re, im } the rotating phasor A∠(ωt + φ) at time t
//   wrapDeg(deg)                      an angle wrapped into (−180, 180]
//   crest(p, omega) -> { t, A }       the crest of A cos(ωt + φ) nearest t = 0: t = −φ/ω (s),
//                                     within half a period of 0, at height A
//   fromCrest({ t, A }, omega)        the phasor { A, phi } whose crest is at (t, A); a crest
//                                     more than half a period from 0 gives φ wrapped as usual
//
// Series circuits, in SI units (R in Ω, L in H, C in F, ω in rad/s); `include` lists the elements
// in the loop, e.g. ['R', 'C']. An excluded element gives null, never a zero phasor.
//   impedances({ R, L, C, include, omega }) -> { R, L, C, total }   Z_R = R, Z_L = jωL,
//                                     Z_C = 1/(jωC) (complex Ω), and their series sum Z_total
//   solve({ V0, R, L, C, include, omega }) -> { Vin, Z, I, V: { R, L, C } }   the source V₀∠0
//                                     (the phase reference), the impedances above, the current
//                                     I = V_in/Z_total (A) and each device voltage V_k = I·Z_k (V).
//                                     Z_total = 0 (L and C alone, exactly at ω₀) has no finite
//                                     current: I and every V_k are then null.
//   omega0(L, C)                      ω₀ = 1/√(LC), rad/s
//   omegaC(R, C)                      ω_c = 1/(RC), rad/s

const RAD = Math.PI / 180;

export const add = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });

export const mul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });

export function div(a, b) {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}

export function toPolar(z) {
  const phi = Math.atan2(z.im, z.re) / RAD;
  return { A: Math.hypot(z.re, z.im), phi: phi === -180 ? 180 : phi };
}

export function fromPolar(A, phi) {
  return { re: A * Math.cos(phi * RAD), im: A * Math.sin(phi * RAD) };
}

const rect = (p) => fromPolar(p.A, p.phi);

export const sum = (p1, p2) => toPolar(add(rect(p1), rect(p2)));

export const evaluate = (p, omega, t) => p.A * Math.cos(omega * t + p.phi * RAD);

/** The phasor rotated to time t: the complex value A∠(ωt + φ), whose real part is evaluate(). */
export const rotate = (p, omega, t) => fromPolar(p.A, p.phi + (omega * t) / RAD);

/** An angle in degrees wrapped into (−180, 180]. */
export const wrapDeg = (deg) => 180 - ((((180 - deg) % 360) + 360) % 360);

export const crest = (p, omega) => ({ t: (-wrapDeg(p.phi) * RAD) / omega, A: p.A });

// 12 significant digits drop the float noise of ω·t, so φ = 180° does not come back as −180°.
export const fromCrest = (c, omega) => ({ A: c.A, phi: wrapDeg(Number(((-omega * c.t) / RAD).toPrecision(12))) });

// ── Series circuits ──

const has = (include, k) => include.includes(k);

export function impedances({ R, L, C, include, omega }) {
  const z = {
    R: has(include, 'R') ? { re: R, im: 0 } : null,
    L: has(include, 'L') ? { re: 0, im: omega * L } : null,
    C: has(include, 'C') ? div({ re: 1, im: 0 }, { re: 0, im: omega * C }) : null,
  };
  z.total = [z.R, z.L, z.C].reduce((acc, zk) => (zk ? add(acc, zk) : acc), { re: 0, im: 0 });
  return z;
}

export function solve({ V0, R, L, C, include, omega }) {
  const Z = impedances({ R, L, C, include, omega });
  const Vin = { re: V0, im: 0 };
  // L and C alone exactly at ω₀ (to float round-off): no finite current
  const scale = [Z.R, Z.L, Z.C].reduce((s, zk) => (zk ? s + Math.hypot(zk.re, zk.im) : s), 0);
  const open = Math.hypot(Z.total.re, Z.total.im) <= 1e-12 * scale;
  const I = open ? null : div(Vin, Z.total);
  const V = {};
  for (const k of ['R', 'L', 'C']) V[k] = Z[k] && I ? mul(I, Z[k]) : null;
  return { Vin, Z, I, V };
}

/** The series LC resonance ω₀ = 1/√(LC), rad/s (L in H, C in F). */
export const omega0 = (L, C) => 1 / Math.sqrt(L * C);

/** The RC corner ω_c = 1/(RC), rad/s (R in Ω, C in F). */
export const omegaC = (R, C) => 1 / (R * C);
