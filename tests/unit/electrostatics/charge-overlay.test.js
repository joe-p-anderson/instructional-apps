import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChargeOverlay } from '../../../tools/electrostatics/conductor.js';

const inside = (pts) => pts.x.every((x, i) => Math.hypot(x, pts.y[i]) < 5);

test('the overlay shows fixed protons and mobile electrons inside the conductor only', () => {
  const o = createChargeOverlay();
  const f = o.frame({ Q: 0, E0x: 0, E0y: 0, theta: 0 });
  assert.ok(f.protons.x.length > 0 && inside(f.protons));
  assert.ok(f.electrons.x.length > 0 && inside(f.electrons));
});

test('with an applied field and no induced charges, electrons drift against E₀', () => {
  const o = createChargeOverlay();
  const params = { E0x: 1000, E0y: 0, induce: false };
  const before = o.frame(params).electrons.x[0];
  o.step(1, params);
  const after = o.frame(params).electrons.x[0];
  assert.ok(after < before, `${after} should be left of ${before}`);
});

test('in equilibrium (induced charges on) the electrons stay put', () => {
  const o = createChargeOverlay();
  const params = { E0x: 1000, E0y: 500, induce: true };
  const before = o.frame(params).electrons;
  for (let i = 0; i < 20; i++) o.step(1, params);
  assert.deepEqual(o.frame(params).electrons, before);
});

test('surface charges show only when θ ≠ 0 and orbit clockwise when θ·Q ≠ 0', () => {
  const o = createChargeOverlay();
  assert.equal(o.frame({ Q: 2, theta: 0 }).surface.x.length, 0);
  const params = { Q: 2, theta: 1 };
  const a0 = Math.atan2(o.frame(params).surface.y[1], o.frame(params).surface.x[1]);
  o.step(1, params);
  const a1 = Math.atan2(o.frame(params).surface.y[1], o.frame(params).surface.x[1]);
  assert.ok(a1 < a0, 'angle decreases: clockwise');
});

test('two overlays are independent', () => {
  const a = createChargeOverlay();
  const b = createChargeOverlay();
  const params = { E0x: 0, E0y: 1000 };
  const bBefore = b.frame(params).electrons;
  for (let i = 0; i < 10; i++) a.step(1, params);
  assert.deepEqual(b.frame(params).electrons, bBefore);
  assert.notDeepEqual(a.frame(params).electrons, bBefore);
});
