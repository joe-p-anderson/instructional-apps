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
