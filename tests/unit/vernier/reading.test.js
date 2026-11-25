import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breakdown, drawReading, judge } from '../../../tools/vernier/reading.js';

test('the same seed and draw counter give the same reading', () => {
  const a = drawReading({ type: 'random', seed: 12345, draw: 7 });
  const b = drawReading({ type: 'random', seed: 12345, draw: 7 });
  assert.deepEqual(a, b);
});

test('readings stay in range for each measurement type, in 0.05 mm steps', () => {
  const ranges = { od: [1, 140], id: [10, 140], depth: [1, 100] }; // as in the old trainer
  for (const [type, [lo, hi]] of Object.entries(ranges)) {
    for (let draw = 0; draw < 2000; draw += 1) {
      const r = drawReading({ type, seed: 99, draw });
      assert.equal(r.pick, type);
      assert.ok(Number.isInteger(r.twentieths));
      assert.ok(r.mm >= lo && r.mm <= hi, `${type} draw ${draw}: ${r.mm} mm`);
      assert.equal(r.mm, r.twentieths / 20);
    }
  }
});

test('random measurements pick each of outside, inside and depth', () => {
  const picks = new Set();
  for (let draw = 0; draw < 200; draw += 1) picks.add(drawReading({ type: 'random', seed: 5, draw }).pick);
  assert.deepEqual([...picks].sort(), ['depth', 'id', 'od']);
});

test('advancing the draw counter or changing the seed gives new readings', () => {
  const byDraw = new Set();
  const bySeed = new Set();
  for (let i = 0; i < 50; i += 1) {
    byDraw.add(drawReading({ type: 'od', seed: 1, draw: i }).twentieths);
    bySeed.add(drawReading({ type: 'od', seed: i, draw: 0 }).twentieths);
  }
  assert.ok(byDraw.size > 40, `only ${byDraw.size} distinct readings over 50 draws`);
  assert.ok(bySeed.size > 40, `only ${bySeed.size} distinct readings over 50 seeds`);
});

test('breakdown of 23.45 mm: main mark 23, vernier line 9 on the 41 mm mark', () => {
  // 23.45 mm = 469 twentieths. Vernier line 9 sits 9 × 1.95 = 17.55 mm past the vernier 0,
  // at 23.45 + 17.55 = 41 mm on the main scale.
  assert.deepEqual(breakdown(469), { main: 23, line: 9, match: 41 });
});

test('breakdown of a whole millimetre: vernier line 0 on the main mark itself', () => {
  assert.deepEqual(breakdown(20 * 57), { main: 57, line: 0, match: 57 });
});

test('a drawn reading carries its breakdown', () => {
  const r = drawReading({ type: 'id', seed: 3, draw: 4 });
  assert.ok(Math.abs(r.main + r.line * 0.05 - r.mm) < 1e-9);
  assert.equal(r.match, r.main + 2 * r.line);
});

const NOT_A_NUMBER = 'Enter a number in millimetres, e.g. 23.45.';
const NOT_A_STEP = 'This caliper reads in steps of 0.05 mm, so the last digit should be 0 or 5.';

test('judging: the exact reading is correct', () => {
  assert.deepEqual(judge('23.45', 469), { status: 'correct', value: 23.45 });
});

test('judging: a comma is accepted as the decimal separator', () => {
  assert.deepEqual(judge('23,45', 469), { status: 'correct', value: 23.45 });
});

test('judging: surrounding spaces and trailing zeros are fine', () => {
  assert.equal(judge('  23.450 ', 469).status, 'correct');
  assert.equal(judge('57', 1140).status, 'correct');
});

test('judging: another multiple of 0.05 mm is wrong', () => {
  assert.deepEqual(judge('23.5', 469), { status: 'wrong', value: 23.5 });
});

test('judging: an empty answer or a non-number is rejected with the format message', () => {
  for (const raw of ['', '   ', 'abc', '23.4.5', '12mm']) {
    assert.deepEqual(judge(raw, 469), { status: 'invalid', message: NOT_A_NUMBER }, JSON.stringify(raw));
  }
});

test('judging: a value that is not a multiple of 0.05 mm is rejected with the step message', () => {
  for (const raw of ['23.43', '23.451', '0.01']) {
    assert.deepEqual(judge(raw, 469), { status: 'invalid', message: NOT_A_STEP }, raw);
  }
});

test('judging: floating-point noise in a valid step still rounds to the right twentieths', () => {
  // 0.15 * 20 is 2.9999999999999996 in floating point.
  assert.equal(judge('0.15', 3).status, 'correct');
  assert.equal(judge('139.95', 2799).status, 'correct');
});
