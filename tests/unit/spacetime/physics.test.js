// Seam 1 (Spec 0003): the spacetime Tool's DOM-free maths module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gamma, toFrame, fromFrame, interval, properTime, normalize } from '../../../tools/spacetime/physics.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} is not ${b}`);
const closePt = (p, q, tol = 1e-9) => { close(p[0], q[0], tol); close(p[1], q[1], tol); };

test('γ is 1 at rest and 1.25 at v = 0.6c, whatever the direction', () => {
  assert.equal(gamma(0), 1);
  close(gamma(0.6), 1.25);
  close(gamma(-0.6), 1.25);
});

test('at v = 0.6c the Earth event (3, 5) is at (0, 4) in the ship frame, and (5, 5) at (2.5, 2.5)', () => {
  closePt(toFrame('Kp', [3, 5], 0.6), [0, 4]);
  closePt(toFrame('Kp', [5, 5], 0.6), [2.5, 2.5]);
});

test('K coordinates pass through unchanged, and fromFrame undoes toFrame', () => {
  closePt(toFrame('K', [3, 5], 0.6), [3, 5]);
  closePt(fromFrame('Kp', [0, 4], 0.6), [3, 5]);
  closePt(fromFrame('Kp', toFrame('Kp', [-1.7, 2.3], -0.8), -0.8), [-1.7, 2.3]);
});

test('the interval from the origin to (3, 5) is timelike with proper time 4, the same in both frames', () => {
  const i = interval([0, 0], [3, 5], 0.6);
  assert.equal(i.kind, 'timelike');
  close(i.s2, 16);
  close(i.tau, 4);
  closePt(i.dK, [3, 5]);
  closePt(i.dKp, [0, 4]);
  close(i.dKp[1] ** 2 - i.dKp[0] ** 2, 16);
});

test('an interval with Δx = −5, Δt = 3 is spacelike with proper distance 4', () => {
  const i = interval([1, 1], [-4, 4], 0.3);
  assert.equal(i.kind, 'spacelike');
  close(i.s2, -16);
  close(i.distance, 4);
  assert.equal(i.tau, undefined);
});

test('an interval along a light ray is lightlike, even with rounding in the coordinates', () => {
  assert.equal(interval([0, 0], [4, 4], 0.6).kind, 'lightlike');
  assert.equal(interval([0.1, 0.2], [-2.9 + 1e-9, 3.2], 0).kind, 'lightlike');
});

// A diagram as the Tool keeps it: v plus a list of objects (events, worldlines, rods, ...).
const ev = (id, x, t, home = 'K') => ({ id, kind: 'event', home, x, t, label: '', color: '#D55E00' });
const chain = (id, ids) => ({ id, kind: 'wl', mode: 'chain', ids, extend: false, label: '', color: '#0072B2' });
const param = (id, u, x0, frame = 'K') => ({ id, kind: 'wl', mode: 'param', frame, u, x0, label: '', color: '#0072B2' });

test('proper time along the twin\'s out-and-back chain is 4 + 4 = 8 over Earth times 0 to 10', () => {
  const D = { v: 0.6, objs: [ev(1, 0, 0), ev(2, 3, 5), ev(3, 0, 10), chain(4, [1, 2, 3])] };
  const w = D.objs[3];
  const r = properTime(w, D, 'K', 0, 10);
  close(r.tau, 8);
  assert.equal(r.partial, false);
  assert.equal(r.spacelike, false);
  close(properTime(w, D, 'K', 5, 0).tau, 4);
});

test('a time range reaching past the chain counts only the covered part and is flagged partial', () => {
  const D = { v: 0, objs: [ev(1, 0, 0), ev(2, 3, 5), ev(3, 0, 10), chain(4, [1, 2, 3])] };
  const r = properTime(D.objs[3], D, 'K', -2, 12);
  close(r.tau, 8);
  assert.equal(r.partial, true);
});

test('a spacelike segment adds no proper time and is flagged', () => {
  const D = { v: 0, objs: [ev(1, 0, 0), ev(2, 0, 2), ev(3, 5, 3), chain(4, [1, 2, 3])] };
  const r = properTime(D.objs[3], D, 'K', 0, 3);
  close(r.tau, 2);
  assert.equal(r.spacelike, true);
});

test('proper time is measured between times of the chosen frame: the ship at rest in K′ ages Δt′', () => {
  const D = { v: 0.6, objs: [param(1, 0.6, 0)] };
  close(properTime(D.objs[0], D, 'K', 0, 5).tau, 4);
  close(properTime(D.objs[0], D, 'Kp', 0, 4).tau, 4);
  assert.equal(properTime(D.objs[0], D, 'Kp', 0, 4).partial, false);
});

test('normalizing nothing usable gives an empty Earth/Ship diagram at rest', () => {
  for (const junk of [null, undefined, 'x', 42, []]) {
    const N = normalize(junk);
    assert.deepEqual(
      { v: N.v, names: N.names, grid: N.grid, showKp: N.showKp, objs: N.objs, nextId: N.nextId },
      { v: 0, names: { K: 'Earth', Kp: 'Ship' }, grid: { K: true, Kp: true }, showKp: true, objs: [], nextId: 1 },
    );
  }
});

test('normalizing caps v below light speed and tidies frame names and flags', () => {
  const N = normalize({ v: 1.5, names: { K: '', Kp: 'R'.repeat(60) }, grid: { K: false }, showKp: false });
  assert.equal(N.v, 0.999);
  assert.equal(normalize({ v: -3 }).v, -0.999);
  assert.equal(normalize({ v: 'fast' }).v, 0);
  assert.deepEqual(N.names, { K: 'Earth', Kp: 'R'.repeat(40) });
  assert.deepEqual(N.grid, { K: false, Kp: true });
  assert.equal(N.showKp, false);
});

test('normalizing a saved diagram keeps its objects and drops what is broken', () => {
  const N = normalize({
    app: 'spacetime-diagram', version: 1, v: 0.6,
    objs: [
      { id: 1, kind: 'event', home: 'Kp', x: '2', t: 3, color: 'red', label: 'A' },
      { id: 2, kind: 'event', home: 'K', x: 0, t: 1, color: '#123456', label: 'B' },
      { id: 2, kind: 'event', home: 'K', x: 9, t: 9 },                       // duplicate id
      { id: 3, kind: 'wl', mode: 'param', frame: 'K', u: 4, x0: 1 },         // u capped at 1
      { id: 4, kind: 'wl', mode: 'chain', ids: [1, 99, 2] },                 // 99 is gone
      { id: 5, kind: 'wl', mode: 'chain', ids: [1, 99] },                    // too few events left
      { id: 6, kind: 'rod', frame: 'Kp', T: 2, ends: [{ x: 0, wl: 3 }, { x: 1, wl: 5 }] },
      { id: 7, kind: 'interval', a: 1, b: 2 },
      { id: 8, kind: 'interval', a: 1, b: 99 },
      { id: 9, kind: 'ptime', wl: 4, frame: 'K', t1: 0, t2: 2 },
      { id: 10, kind: 'ptime', wl: 5, frame: 'K', t1: 0, t2: 2 },
      { id: 11, kind: 'spaceship' },
      { kind: 'event', x: 0, t: 0 },                                         // no id
    ],
  });
  assert.deepEqual(N.objs.map((o) => o.id), [1, 2, 3, 4, 6, 7, 9]);
  const [a, b, w, c, rod] = N.objs;
  assert.deepEqual(a, { id: 1, kind: 'event', home: 'Kp', x: 2, t: 3, color: '#D55E00', label: 'A', showCoords: false, cone: false });
  assert.equal(b.color, '#123456');
  assert.equal(w.u, 1);
  assert.deepEqual(c.ids, [1, 2]);
  assert.deepEqual(rod.ends, [{ x: 0, wl: 3 }, { x: 1, wl: null }]);
  assert.equal(N.nextId, 10, 'new ids never reuse a kept one');
});

test('normalizing is idempotent, so a saved diagram restores exactly', () => {
  const once = normalize({ v: 0.6, objs: [ev(1, 3, 5), ev(2, 5, 5, 'Kp'), chain(3, [1, 2]), param(4, -0.5, 2, 'Kp')], nextId: 7 });
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(once))), once);
  assert.equal(once.nextId, 7);
});
