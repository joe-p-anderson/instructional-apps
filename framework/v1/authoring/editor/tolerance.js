// The tolerance field's mapping (spec, "Tolerances"): one number with a unit / % switch, for a
// target Condition (condition builder) and a numeric Question (ticket 12). No DOM; the field
// itself is tolerance-field.js.
//
//   toleranceOf(owner)          -> { side: 'unit' | 'percent', text }: what the field shows for an
//                                  object holding tol or relTol (relTol 0.02 shows as 2 %)
//   toleranceFields(side, text) -> { tol, relTol }: the fields to write. The unit side writes tol,
//                                  the % side writes relTol = percentage / 100; the other key is
//                                  always undefined, so writing clears it. Empty text writes
//                                  neither; text that isn't a number is kept as typed, so the
//                                  runner's validation lists it.

const clean = (x) => Number(x.toPrecision(12));

export function toleranceOf(owner) {
  if (owner?.relTol !== undefined) return { side: 'percent', text: typeof owner.relTol === 'number' ? String(clean(owner.relTol * 100)) : String(owner.relTol) };
  return { side: 'unit', text: owner?.tol === undefined ? '' : String(owner.tol) };
}

export function toleranceFields(side, text) {
  const s = String(text ?? '').trim();
  let value;
  if (s !== '') value = Number.isFinite(Number(s)) ? Number(s) : s;
  if (side === 'percent') return { tol: undefined, relTol: typeof value === 'number' ? clean(value / 100) : value };
  return { tol: value, relTol: undefined };
}

// Tolerance presets for numeric Questions (spec, "Editor page"). They live in the editor only:
// applying one stamps its plain tol, relTol and modulus values onto the Question (undefined
// removes the key), and nothing names the preset in the file.
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
