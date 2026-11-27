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
