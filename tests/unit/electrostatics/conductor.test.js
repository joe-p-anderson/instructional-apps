import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RADIUS, WINDOW, fieldAt } from '../../../tools/electrostatics/conductor.js';

const close = (actual, expected, tol = 1e-6, msg) => {
  assert.equal(actual.length, expected.length, msg);
  actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) <= tol, `${msg ?? ''} [${i}] ${v} ≠ ${expected[i]}`));
};

test('the conductor has radius 5 cm in a ±10 cm window', () => {
  assert.equal(RADIUS, 5);
  assert.equal(WINDOW, 10);
});

test('outside, a 1 nC conductor gives 900 V/m radially at 10 cm', () => {
  close(fieldAt(10, 0, { Q: 1 }), [900, 0]);
  close(fieldAt(0, -10, { Q: 1 }), [0, -900]);
  close(fieldAt(6, 8, { Q: -1 }), [-540, -720]);
});

test('the applied field superposes on the charge field outside the conductor, induced or not', () => {
  for (const induce of [false, true]) {
    close(fieldAt(10, 0, { Q: 1, E0x: 0, E0y: 500, induce }), [900, 500], 1e-6, `induce=${induce}`);
  }
});

test('without induced charges the applied field passes straight through the bulk', () => {
  close(fieldAt(2, 1, { Q: 2, E0x: 300, E0y: -400, induce: false }), [300, -400]);
});

test('in equilibrium (induced charges on) the field in the bulk is zero', () => {
  const setups = [
    { Q: 0, E0x: 2000, E0y: 0 },
    { Q: 3, E0x: -1200, E0y: 900, theta: 1.2 },
    { Q: -2.5, E0x: 50, E0y: -1999, theta: Math.PI / 2 },
  ];
  for (const s of setups) {
    for (const [x, y] of [[0, 0], [4.9, 0], [-3, 3], [1, -4.5]]) {
      close(fieldAt(x, y, { ...s, induce: true }), [0, 0], 0, `${JSON.stringify(s)} at (${x}, ${y})`);
    }
  }
});

test('θ tilts the charge field off the surface normal: θ = π/2 turns it tangential', () => {
  close(fieldAt(10, 0, { Q: 1, theta: Math.PI / 2 }), [0, 900], 1e-9);
  close(fieldAt(10, 0, { Q: 1, theta: Math.PI / 4 }), [900 / Math.SQRT2, 900 / Math.SQRT2], 1e-9);
});

test('σ is uniform, Q / (2πR), with no applied field', async () => {
  const { surfaceCharge } = await import('../../../tools/electrostatics/conductor.js');
  // 1 nC on a 5 cm ring: 1e-9 / (2π · 5) per cm of circumference
  const expected = 1e-9 / (2 * Math.PI * 5);
  for (const phi of [0, 1, 2.5, 4]) {
    assert.ok(Math.abs(surfaceCharge(phi, { Q: 1, E0x: 800, E0y: 0, induce: false }) - expected) < 1e-20);
  }
});

test('induced σ adds ε₀ E₀·n̂: most positive where E₀ leaves the surface, most negative where it enters', async () => {
  const { surfaceCharge, EPS0 } = await import('../../../tools/electrostatics/conductor.js');
  const at = (phi) => surfaceCharge(phi, { Q: 0, E0x: 0, E0y: 1000, induce: true });
  assert.ok(Math.abs(at(Math.PI / 2) - EPS0 * 1000) < 1e-20);
  assert.ok(Math.abs(at(-Math.PI / 2) + EPS0 * 1000) < 1e-20);
  assert.ok(Math.abs(at(0)) < 1e-20);
});

test('the field grid reports |E|max: a uniform 300, 400 V/m field gives 500 V/m', async () => {
  const { fieldGrid } = await import('../../../tools/electrostatics/conductor.js');
  const g = fieldGrid({ Q: 0, E0x: 300, E0y: 400 });
  assert.ok(Math.abs(g.maxE - 500) < 1e-9);
  assert.equal(g.xs[0], -10);
  assert.equal(g.xs.at(-1), 10);
  assert.equal(g.z.length, g.xs.length);
});

test('the field grid has no arrows and zero |E| in the bulk in equilibrium', async () => {
  const { fieldGrid } = await import('../../../tools/electrostatics/conductor.js');
  const g = fieldGrid({ Q: 0, E0x: 1000, E0y: 0, induce: true });
  const mid = (g.xs.length - 1) / 2;
  assert.equal(g.z[mid][mid], 0);
  // Arrows are segments [x0, x1, null]; none starts strictly inside the conductor.
  for (let i = 0; i < g.quiver.x.length; i += 3) {
    assert.ok(Math.hypot(g.quiver.x[i], g.quiver.y[i]) >= 5);
  }
});

test('E₀ is kept within |E₀| ≤ 2000 V/m, and its polar form is magnitude and angle in degrees', async () => {
  const { limitE0, polarE0 } = await import('../../../tools/electrostatics/conductor.js');
  assert.deepEqual(limitE0(3000, 0), [2000, 0]);
  const [x, y] = limitE0(2000, 2000);
  assert.ok(Math.abs(Math.hypot(x, y) - 2000) < 1e-9);
  assert.ok(Math.abs(x - y) < 1e-9);
  assert.deepEqual(limitE0(300, -400), [300, -400]);
  const p = polarE0(0, -1500);
  assert.ok(Math.abs(p.mag - 1500) < 1e-9);
  assert.ok(Math.abs(p.angle + 90) < 1e-9);
});
