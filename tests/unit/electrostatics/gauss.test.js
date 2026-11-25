import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gaussFlux, gaussField, fieldAt, fieldGrid } from '../../../tools/electrostatics/conductor.js';

// The old app used ε₀ = 8.86e-12 with k = 9e9, so 4πkε₀ ≈ 1.002: a surface around the whole
// conductor reads λ to within that factor, not exactly λ.
const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} ${actual} ≉ ${expected} (±${tol})`);

test('a Gaussian surface entirely in the bulk encloses no charge, whatever λ and E₀', () => {
  for (const [xc, yc, r] of [[0, 0, 2], [1.5, -1, 2.5], [-3, 0, 1.5]]) {
    const { Qenc } = gaussFlux({ lambda: 1, E0x: 1200, E0y: -800, xc, yc, r });
    near(Qenc, 0, 1e-12, `centre (${xc}, ${yc}) r ${r}`);
  }
});

test('a surface around the whole conductor encloses λ', () => {
  near(gaussFlux({ lambda: 1, xc: 0, yc: 0, r: 8 }).Qenc, 1, 0.01);
  near(gaussFlux({ lambda: -0.5, E0y: 1500, xc: 1, yc: 0.5, r: 8 }).Qenc, -0.5, 0.01);
});

test('an applied field in any direction adds no net enclosed charge round the whole conductor', () => {
  for (const [E0x, E0y] of [[1500, 0], [-1500, 0], [0, 1500], [1000, -1000]]) {
    near(gaussFlux({ lambda: -0.5, E0x, E0y, xc: 0, yc: 0, r: 8 }).Qenc, -0.5, 0.01, `E₀ (${E0x}, ${E0y})`);
  }
});

test('the plotted field is the line-charge field whose flux gives Q_enc: 2kλ/r outside', () => {
  // λ = 1 nC/m at r = 6 cm: 2 · 9e9 · 1e-9 / 0.06 = 300 V/m, radially outward.
  const [ex, ey] = fieldAt(6, 0, gaussField({ lambda: 1 }));
  near(ex, 300, 1e-9);
  near(ey, 0, 1e-12);
  // The strongest |E| on the plot is at the conductor's edge, 2kλ/R = 360 V/m.
  near(fieldGrid(gaussField({ lambda: 1 })).maxE, 360, 5);
});

test('a surface straddling the edge encloses the surface charge on the arc inside it', () => {
  // Circle centre (5, 0) radius 2 cuts the edge (radius 5) at x = 4.6, y = ±1.96: the enclosed
  // arc spans 2·atan2(1.96, 4.6) of the edge's 2π, so it holds that fraction of λ = 1 nC/m.
  const arc = 2 * Math.atan2(Math.sqrt(25 - 4.6 ** 2), 4.6);
  near(gaussFlux({ lambda: 1, xc: 5, yc: 0, r: 2 }).Qenc, arc / (2 * Math.PI), 0.005);

  // The same cut at the top, with E₀ = (0, 1000): the induced charge ε₀E₀·n̂ adds
  // ε₀·E₀·R·∫sin φ dφ = ε₀·1000·0.05·2 sin(arc/2) (C/m) over the arc, positive on the side E₀
  // points to and negative opposite.
  const induced = 8.86e-12 * 1000 * 0.05 * 2 * Math.sin(arc / 2) * 1e9;
  near(gaussFlux({ lambda: 1, E0y: 1000, xc: 0, yc: 5, r: 2 }).Qenc, arc / (2 * Math.PI) + induced, 0.005);
  near(gaussFlux({ lambda: 0, E0y: 1000, xc: 0, yc: -5, r: 2 }).Qenc, -induced, 0.005);
});

test('the flux is sampled at 100 distinct points round the surface, E·n̂ in V/m', () => {
  const { t, flux } = gaussFlux({ lambda: 0, E0x: 500, xc: 8, yc: 0, r: 1 });
  assert.equal(t.length, 100);
  assert.equal(flux.length, 100);
  assert.ok(t.at(-1) < 2 * Math.PI, 'the last sample is not t = 2π again');
  near(flux[0], 500, 1e-9, 'outward along +x');
  near(flux[50], -500, 1e-6, 'inward along −x');
});
