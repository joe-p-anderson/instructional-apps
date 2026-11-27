// Phasors Tool: readout text for complex numbers and phasors, in EE notation (j, and a true
// minus sign). Pure, no DOM.
//
//   num(v, decimals)        a number with a true minus sign, and no "−0.00"
//   rectText(z, unit)       'a + jb unit', e.g. '3.00 − j2.00 V'
//   polarText(p, unit)      'A∠φ° unit', e.g. '3.61∠33.7° V'
//   prefix(v)               the SI prefix to show a magnitude v in: { prefix, scale }, v × scale
//                           in [1, 1000) where it can ('M', 'k', '', 'm', 'µ', 'n')
//   siRectText(z, unit)     rectText with an SI prefix for |z|, e.g. '1.20 − j4.50 kΩ'
//   siPolarText(p, unit)    polarText with an SI prefix for A, e.g. '10.85∠77.5° mA'

export function num(v, decimals = 2) {
  const s = v.toFixed(decimals);
  if (Number(s) === 0) return (0).toFixed(decimals);
  return s.replace('-', '−');
}

const withUnit = (s, unit) => (unit ? `${s} ${unit}` : s);

export function rectText(z, unit = '') {
  const im = num(z.im);
  const sign = im.startsWith('−') ? '−' : '+';
  return withUnit(`${num(z.re)} ${sign} j${im.replace('−', '')}`, unit);
}

export const polarText = (p, unit = '') => withUnit(`${num(p.A)}∠${num(p.phi, 1)}°`, unit);

/** The time unit to show a period T (s) in: { unit, scale } with t × scale in that unit. */
export function timeUnit(T) {
  if (T >= 1) return { unit: 's', scale: 1 };
  if (T >= 1e-3) return { unit: 'ms', scale: 1e3 };
  return { unit: 'µs', scale: 1e6 };
}

const PREFIXES = [[1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n']];

export function prefix(v) {
  const m = Math.abs(v);
  if (m === 0) return { prefix: '', scale: 1 };
  // round first, so 999.999 shows as 1.00 k rather than 1000.00
  const [size, p] = PREFIXES.find(([k]) => Number((m / k).toPrecision(3)) >= 1) ?? PREFIXES[PREFIXES.length - 1];
  return { prefix: p, scale: 1 / size };
}

export function siRectText(z, unit = '') {
  const { prefix: p, scale } = prefix(Math.hypot(z.re, z.im));
  return rectText({ re: z.re * scale, im: z.im * scale }, p + unit);
}

export function siPolarText(ph, unit = '') {
  const { prefix: p, scale } = prefix(ph.A);
  return polarText({ A: ph.A * scale, phi: ph.phi }, p + unit);
}
