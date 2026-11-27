// Phasors Tool: readout text for complex numbers and phasors, in EE notation (j, and a true
// minus sign). Pure, no DOM.
//
//   num(v, decimals)        a number with a true minus sign, and no "−0.00"
//   rectText(z, unit)       'a + jb unit', e.g. '3.00 − j2.00 V'
//   polarText(p, unit)      'A∠φ° unit', e.g. '3.61∠33.7° V'

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
