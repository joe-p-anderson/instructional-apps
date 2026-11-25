// Vernier caliper readings (DOM-free): the seeded generator, the reading breakdown and
// answer judging for a 0.05 mm caliper. Ported from vernier-trainer/vernier-trainer.html.
//
// A reading is kept as a whole number of twentieths of a millimetre (0.05 mm steps).

/** Measurement types a reading can be of, with their ranges in mm. */
export const RANGES = { od: [1, 140], id: [10, 140], depth: [1, 100] };
const PICKS = ['od', 'id', 'depth'];

// 32-bit integer hash of (seed, draw), the starting state of the draw's own generator.
function mix(seed, draw) {
  let h = (Math.trunc(seed) ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = (h + Math.imul(Math.trunc(draw) + 1, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// mulberry32: small, fast, good enough for picking practice problems.
function generator(state) {
  let a = state >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The reading for draw number `draw` of `seed`. type: 'od' | 'id' | 'depth' | 'random'.
 * Returns { pick, twentieths, mm, main, line, match }, where pick is the measurement type
 * actually drawn (the random type picks one of the three).
 */
export function drawReading({ type, seed, draw }) {
  const rand = generator(mix(seed, draw));
  const pick = type === 'random' ? PICKS[Math.floor(rand() * PICKS.length)] : type;
  const [lo, hi] = RANGES[pick];
  const twentieths = lo * 20 + Math.floor(rand() * ((hi - lo) * 20 + 1));
  return { pick, twentieths, mm: twentieths / 20, ...breakdown(twentieths) };
}

/**
 * How a reading of `twentieths` (of a mm) is read off the scales:
 *   main   the last main-scale mark (mm) at or before the vernier 0
 *   line   the vernier line that lines up with a main-scale mark
 *   match  the main-scale mark (mm) that vernier line lines up with
 */
export function breakdown(twentieths) {
  const main = Math.floor(twentieths / 20);
  const line = twentieths % 20;
  return { main, line, match: main + 2 * line }; // vernier lines are 1.95 mm apart
}

export const MESSAGES = {
  notANumber: 'Enter a number in millimetres, e.g. 23.45.',
  notAStep: 'This caliper reads in steps of 0.05 mm, so the last digit should be 0 or 5.',
};

/**
 * Judge a typed answer (text, mm; a comma may be the decimal separator) against a reading of
 * `twentieths`. Returns { status: 'correct' | 'wrong', value } or { status: 'invalid', message }.
 */
export function judge(raw, twentieths) {
  const text = String(raw ?? '').trim().replace(',', '.');
  const value = Number(text);
  if (text === '' || !Number.isFinite(value)) return { status: 'invalid', message: MESSAGES.notANumber };
  const scaled = value * 20;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-6) return { status: 'invalid', message: MESSAGES.notAStep };
  return { status: Math.round(scaled) === twentieths ? 'correct' : 'wrong', value };
}
