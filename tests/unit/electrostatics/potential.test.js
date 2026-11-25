import { test } from 'node:test';
import assert from 'node:assert/strict';
import { potentialAt, potentialProbe } from '../../../tools/electrostatics/conductor.js';

const near = (actual, expected, tol = 1e-9, msg = '') =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg} ${actual} ≠ ${expected}`);

test('outside, a 1 nC conductor is at 90 V at 10 cm and falls off as 1/r', () => {
  near(potentialAt(10, 0, 1), 90);
  near(potentialAt(6, 8, 1), 90);
  near(potentialAt(0, 7.5, -2), -240);
});

test('the potential inside the conductor is constant and equal to the surface value', () => {
  const surface = potentialAt(5, 0, 1);
  near(surface, 180);
  for (const [x, y] of [[0, 0], [1, 2], [-3, 3.9], [0, -4.99], [3, 4]]) {
    near(potentialAt(x, y, 1), surface, 1e-9, `(${x}, ${y})`);
  }
  near(potentialAt(0, 0, -3), -540);
});

test('with no toggle on, the probes are where they were put', () => {
  const s = potentialProbe({ x: -6, y: -6 }, { x: 7, y: 7 }, { Q: 1 });
  assert.deepEqual([s.x1, s.y1, s.x2, s.y2], [-6, -6, 7, 7]);
  near(s.r1, 8.48528137423857);
  near(s.r2, 9.899494936611665);
  near(s.V1, 106.06601717798213);
  near(s.V2, 90.91372900969896);
  near(s.dV, 15.152288168283171);
});

test('two probes inside the conductor measure no potential difference', () => {
  const s = potentialProbe({ x: 1, y: -2 }, { x: -3, y: 1 }, { Q: 2.5 });
  near(s.V1, 450);
  near(s.V2, 450);
  near(s.dV, 0);
});

test('lock to surface puts both probes on the edge along their own directions', () => {
  const s = potentialProbe({ x: -6, y: -8 }, { x: 0, y: 2 }, { Q: 1, lockToSurface: true });
  near(s.x1, -3); near(s.y1, -4);
  near(s.x2, 0); near(s.y2, 5);
  near(s.r1, 5); near(s.r2, 5);
  near(s.V1, 180); near(s.V2, 180); near(s.dV, 0);
});

test('lock to surface moves a probe at the centre onto the edge', () => {
  const s = potentialProbe({ x: 0, y: 0 }, { x: 7, y: 7 }, { Q: 1, lockToSurface: true });
  near(s.r1, 5);
});

test('measure at infinity sends P2 off the plot along P1 and takes V2 = 0', () => {
  const s = potentialProbe({ x: 6, y: 8 }, { x: -1, y: -1 }, { Q: 1, measureAtInfinity: true });
  assert.deepEqual([s.x1, s.y1], [6, 8]);
  near(s.x2, 12); near(s.y2, 16);
  near(s.r2, 20);
  near(s.V1, 90);
  assert.equal(s.V2, 0);
  near(s.dV, 90);
});
