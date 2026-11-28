// Tolerances in the editor (spec, "Tolerances"). No DOM.
//
// The tolerance field is one number with a unit / % switch: the unit side writes tol, the % side
// writes relTol as the percentage / 100, and each side clears the other key. The file keeps the
// plain fraction. toleranceText reads a { tol, relTol } owner (a numeric Question or a target
// Condition) into the field; toleranceValues turns what is typed back into { tol, relTol }, for
// an edit that sets both keys (undefined removes one).
//
// TOLERANCE_PRESETS live in the editor only. Applying one stamps plain tol, relTol and modulus
// values onto a Question (undefined removes the key); nothing names the preset in the file.

// A number with float noise (0.07 * 100 = 7.000000000000001) rounded away.
const clean = (x) => Number(x.toPrecision(12));

export const SIDES = ['unit', 'percent'];

// { side, text } for an owner's tolerance; the % side when it has relTol.
export function toleranceText(owner) {
  if (typeof owner?.relTol === 'number') return { side: 'percent', text: String(clean(owner.relTol * 100)) };
  if (typeof owner?.relTol === 'string') return { side: 'percent', text: owner.relTol };
  return { side: 'unit', text: owner?.tol === undefined ? '' : String(owner.tol) };
}

// What text typed on side writes: { tol, relTol }, the other key cleared. Anything but a number
// clears both, so the runner's validation lists the missing tolerance.
export function toleranceValues(side, text) {
  const s = String(text ?? '').trim();
  const n = s === '' ? NaN : Number(s);
  if (!Number.isFinite(n)) return { tol: undefined, relTol: undefined };
  return side === 'percent' ? { tol: undefined, relTol: clean(n / 100) } : { tol: n, relTol: undefined };
}

export const TOLERANCE_PRESETS = [
  { name: 'Amplitude 2%', sub: 'relTol 0.02', values: { tol: undefined, relTol: 0.02, modulus: undefined } },
  { name: 'Amplitude 5%', sub: 'relTol 0.05', values: { tol: undefined, relTol: 0.05, modulus: undefined } },
  { name: 'Phase ±2° mod 360', sub: 'tol 2, modulus 360', values: { tol: 2, relTol: undefined, modulus: 360 } },
  { name: 'Phase ±0.05 rad mod 2π', sub: 'tol 0.05, modulus 2π', values: { tol: 0.05, relTol: undefined, modulus: 2 * Math.PI } },
  { name: 'Exact to ±0.5', sub: 'tol 0.5', values: { tol: 0.5, relTol: undefined, modulus: undefined } },
  { name: 'Exact to ±0.1', sub: 'tol 0.1', values: { tol: 0.1, relTol: undefined, modulus: undefined } },
  { name: 'Exact to ±0.01', sub: 'tol 0.01', values: { tol: 0.01, relTol: undefined, modulus: undefined } },
];

// The preset a Question's tolerance matches exactly, or null ("Custom").
export function presetOf(q) {
  return TOLERANCE_PRESETS.find((preset) => Object.entries(preset.values).every(([k, v]) => q?.[k] === v)) ?? null;
}
