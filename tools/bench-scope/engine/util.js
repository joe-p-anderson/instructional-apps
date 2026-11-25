// Small pure helpers shared by the engine's feature modules.

export function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

/** A finite number from `v` clamped to [lo, hi], or `fallback` if `v` is not a finite number. */
export function clampNumber(v, lo, hi, fallback) {
  return typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
}

/** `v` if it is one of `options`, else `fallback`. */
export function oneOf(v, options, fallback) { return options.includes(v) ? v : fallback; }

const PREFIXES = [[1e-9, 'n'], [1e-6, 'µ'], [1e-3, 'm'], [1, ''], [1e3, 'k'], [1e6, 'M']];

/**
 * Engineering format with three significant digits, Tek style: 0.5 → '500m', 1 → '1.00',
 * 2.5e-4 → '250µ'. Append the unit yourself: `${si(v)}V`.
 */
export function si(value) {
  if (value === 0) return '0.00';
  const a = Math.abs(value);
  let [scale, prefix] = PREFIXES[0];
  for (const [s, p] of PREFIXES) if (a >= s * 0.9995) [scale, prefix] = [s, p];
  const n = value / scale;
  const digits = Math.abs(n) >= 99.95 ? 0 : Math.abs(n) >= 9.995 ? 1 : 2;
  return `${n.toFixed(digits)}${prefix}`;
}
