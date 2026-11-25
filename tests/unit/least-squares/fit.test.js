import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DATASET_IDS, coarseRange, fitMeasures, generate, impliedFromData, interpret, startLine, stats, toCsv,
  transformPoints,
} from '../../../tools/least-squares/fit.js';

test('the four datasets are pendulum, free fall, light and Ohm\'s law', () => {
  assert.deepEqual(DATASET_IDS, ['pendulum', 'freefall', 'light', 'ohm']);
});

test('the same dataset and seed give the same data; another seed gives other data', () => {
  for (const ds of DATASET_IDS) {
    assert.deepEqual(generate(ds, 0), generate(ds, 0));
    assert.notDeepEqual(generate(ds, 0).map((p) => p.y), generate(ds, 1).map((p) => p.y));
  }
});

test('the generator keeps the old app\'s seeded scheme (pendulum seed 0)', () => {
  // Known-good values from the old least-squares page: L = 0.2 m, 1.2 m.
  const pts = generate('pendulum', 0);
  assert.equal(pts.length, 11);
  assert.equal(pts[0].x, 0.2);
  assert.equal(pts[10].x, 1.2);
  assert.equal(pts[0].sy, 0.06);
});

test('every generated point lies inside its error bar around the true model', () => {
  const truth = {
    pendulum: (L) => 2 * Math.PI * Math.sqrt(L / 9.81),
    freefall: (d) => Math.sqrt(2 * d / 9.81),
    light: (r) => 4 / (r * r) + 25,
    ohm: (V) => 1000 * V / 220,
  };
  for (const ds of DATASET_IDS) {
    for (let seed = 0; seed < 20; seed++) {
      for (const p of generate(ds, seed)) {
        assert.ok(p.sy > 0);
        assert.ok(Math.abs(p.y - truth[ds](p.x)) <= p.sy, `${ds} seed ${seed} x=${p.x}`);
      }
    }
  }
});

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const P = (X, Y, sY = 0.5) => ({ X, Y, sY });

test('axis transforms map each point and propagate its error bar', () => {
  const raw = [{ x: 2, y: 4, sy: 0.4 }];
  const [sq] = transformPoints(raw, 'inv2', 'sq');
  close(sq.X, 0.25); close(sq.Y, 16); close(sq.sY, 3.2);
  const [ln] = transformPoints(raw, 'ln', 'ln');
  close(ln.X, Math.log(2)); close(ln.Y, Math.log(4)); close(ln.sY, 0.1);
  const [inv] = transformPoints(raw, 'sqrt', 'inv');
  close(inv.X, Math.SQRT2); close(inv.Y, 0.25); close(inv.sY, 0.025);
});

test('OLS fit of exact data on y = 2x + 1 recovers m = 2, b = 1; through-origin slope 13/5', () => {
  const S = stats([P(0, 1), P(1, 3), P(2, 5)]);
  close(S.mS, 2); close(S.bS, 1); close(S.m0, 2.6); close(S.SST, 8); close(S.SSEmin, 0);
});

test('OLS fit of (1,1), (2,2), (3,2): m = 1/2, b = 2/3; through-origin slope 11/14', () => {
  const S = stats([P(1, 1), P(2, 2), P(3, 2)]);
  close(S.mS, 0.5); close(S.bS, 2 / 3); close(S.m0, 11 / 14);
});

test('R² = 1 − SSE/SST, pinned to 0 when the line is worse than a flat line at ȳ', () => {
  const pts = [P(0, 1), P(1, 3), P(2, 5)];
  const S = stats(pts);
  close(fitMeasures(S, pts, 2, 1).R2, 1);
  const half = fitMeasures(S, pts, 2, 2);
  close(half.SSE, 3); close(half.SST, 8); close(half.ratio, 3 / 8); close(half.R2, 0.625);
  close(fitMeasures(S, pts, 0, 3).R2, 0);
  const worse = fitMeasures(S, pts, 0, 10);
  close(worse.SSE, 155); assert.ok(worse.ratio > 1); assert.equal(worse.R2, 0);
});

test('the hit count is how many error bars the line passes through, edges included', () => {
  const pts = [P(0, 1), P(1, 3), P(2, 5)];
  const S = stats(pts);
  assert.equal(fitMeasures(S, pts, 2, 1.4).hits, 3);
  assert.equal(fitMeasures(S, pts, 2, 1.5).hits, 3);
  assert.equal(fitMeasures(S, pts, 2, 1.6).hits, 0);
  assert.equal(fitMeasures(S, [P(0, 1), P(1, 3), P(2, 6)], 2, 1).hits, 2);
  assert.equal(fitMeasures(S, pts, 2, 1).n, 3);
});

test('the handle\'s random starting line is drawn from the seed, inside the coarse window', () => {
  const pts = transformPoints(generate('pendulum', 3), 'id', 'sq');
  const S = stats(pts), R = coarseRange(S);
  const a = startLine('pendulum', 3, 'id', 'sq', false, S, R);
  assert.deepEqual(startLine('pendulum', 3, 'id', 'sq', false, S, R), a);
  assert.notDeepEqual(startLine('pendulum', 4, 'id', 'sq', false, S, R), a);
  assert.ok(a.m > R.m0 && a.m < R.m1 && a.b > R.b0 && a.b < R.b1);
  // Never on the least-squares line itself, and through the origin when locked.
  assert.ok(fitMeasures(S, pts, a.m, a.b).R2 < 0.7);
  assert.equal(startLine('pendulum', 3, 'id', 'sq', true, S, R).b, 0);
});

test('Copy CSV gives a header with units and one row per point, 4 significant figures', () => {
  const csv = toCsv('ohm', [{ x: 1, y: 4.5678912, sy: 1.5 }, { x: 2, y: 9.1, sy: 1.5 }]);
  assert.equal(csv, 'V (V),I (mA),σ_I (mA)\n1,4.568,1.5\n2,9.1,1.5');
});

const valuesOf = (r) => Object.fromEntries(r.values.map(([name, v]) => [name, v]));

test('linearization: only axes that make the model a straight line are recognised', () => {
  // [dataset, xT, yT, linear?]
  const cases = [
    ['pendulum', 'id', 'id', false], ['pendulum', 'id', 'sq', true], ['pendulum', 'sqrt', 'id', true],
    ['pendulum', 'ln', 'ln', true], ['pendulum', 'sq', 'id', false], ['pendulum', 'ln', 'id', false],
    ['freefall', 'sqrt', 'id', true], ['freefall', 'id', 'sq', true], ['freefall', 'id', 'id', false],
    ['light', 'inv2', 'id', true], ['light', 'inv', 'id', false], ['light', 'ln', 'ln', false],
    ['light', 'id', 'inv', false],
    ['ohm', 'id', 'id', true], ['ohm', 'ln', 'ln', true], ['ohm', 'sq', 'sq', true], ['ohm', 'inv', 'id', false],
  ];
  for (const [ds, xT, yT, linear] of cases) {
    assert.equal(interpret(ds, xT, yT, 1, 0) !== null, linear, `${ds} ${xT}/${yT}`);
  }
});

test('implied g from a pendulum slope or ln–ln intercept', () => {
  close(valuesOf(interpret('pendulum', 'id', 'sq', 4 * Math.PI ** 2 / 9.81, 0)).g, 9.81);
  close(valuesOf(interpret('pendulum', 'sqrt', 'id', 2 * Math.PI / Math.sqrt(9.81), 0)).g, 9.81);
  close(valuesOf(interpret('pendulum', 'ln', 'ln', 0.5, Math.log(2 * Math.PI / Math.sqrt(9.81)))).g, 9.81);
  assert.equal(interpret('pendulum', 'id', 'sq', 4, 0).values[0][2], 'm/s²');
});

test('implied g from free fall', () => {
  close(valuesOf(interpret('freefall', 'sqrt', 'id', Math.sqrt(2 / 9.81), 0)).g, 9.81);
  close(valuesOf(interpret('freefall', 'id', 'sq', 2 / 9.81, 0)).g, 9.81);
});

test('implied A and B for light are the slope and intercept of I against 1/r²', () => {
  assert.deepEqual(valuesOf(interpret('light', 'inv2', 'id', 4, 25)), { A: 4, B: 25 });
});

test('implied R from Ohm\'s law: slope 1000/220 mA/V gives 220 Ω', () => {
  close(valuesOf(interpret('ohm', 'id', 'id', 1000 / 220, 0)).R, 220);
  close(valuesOf(interpret('ohm', 'ln', 'ln', 1, Math.log(1000 / 220))).R, 220);
});

test('the least-squares fit of seed-0 data implies values close to the ones the data were made with', () => {
  const near = (a, b, rel) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} vs ${b}`);
  near(impliedFromData('pendulum', generate('pendulum', 0), 'id', 'sq', false).g, 9.81, 0.05);
  near(impliedFromData('freefall', generate('freefall', 0), 'id', 'sq', true).g, 9.81, 0.05);
  const light = impliedFromData('light', generate('light', 0), 'inv2', 'id', false);
  near(light.A, 4, 0.1); near(light.B, 25, 0.1);
  near(impliedFromData('ohm', generate('ohm', 0), 'id', 'id', true).R, 220, 0.05);
  assert.equal(impliedFromData('pendulum', generate('pendulum', 0), 'id', 'id', false), null);
});
