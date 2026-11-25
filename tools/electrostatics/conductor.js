// Conductor maths for the electrostatics Tool. Pure JS, no DOM: safe to import from Node.
// Ported from Finished/conductor_properties.html (itself from the matplotlib reference
// scripts' commonFunctions.py). A circular conductor of radius RADIUS sits at the origin of a
// ±WINDOW plot. Lengths are in cm, charges in nC, fields in V/m.

export const RADIUS = 5;      // conductor radius (cm)
export const WINDOW = 10;     // half-width of the plot window (cm)
export const EPS0 = 8.86e-12; // permittivity of free space (F/m), as in the old app
export const E0_MAX = 2000;   // largest applied field the joystick allows (V/m)

const K = 9e9;                // Coulomb constant (N m²/C²)

export function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

export function linspace(a, b, n) {
  return Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
}

/**
 * Electric field (V/m) at (x, y) cm.
 *   Q        conductor charge (nC)
 *   E0x/E0y  applied field (V/m)
 *   theta    angle (rad) by which the charge's field is tilted off the surface normal
 *            (0: normal to the surface, π/2: tangential), the old app's "parperp"
 *   induce   induced charges on: the conductor is in equilibrium, so the applied field is
 *            cancelled in the bulk; off: the applied field passes straight through
 *   cyl      1/r (line charge) instead of 1/r² scaling, for the Gauss's-law Mode
 * Outside the conductor the field is the superposition of the charge's field and E₀.
 */
export function fieldAt(x, y, { Q = 0, E0x = 0, E0y = 0, theta = 0, induce = false, cyl = false } = {}) {
  const r2 = x * x + y * y;
  const inside = r2 < RADIUS * RADIUS;
  const q = Q * 1e-9;
  let E = 0;
  if (!inside) E = (cyl ? K * q / (0.5 * Math.sqrt(r2) * 1e2) : K * q / r2) * 1e4; // cm → m
  const r = Math.sqrt(r2);
  const [rx, ry] = r > 0 ? [x / r, y / r] : [0, 0];
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  let ex = E * (c * rx - s * ry);
  let ey = E * (c * ry + s * rx);
  if (!(induce && inside)) { ex += E0x; ey += E0y; }
  return [ex + 0, ey + 0]; // + 0 turns -0 into 0
}

/**
 * Surface charge density at polar angle phi on the conductor's edge (charge per cm of
 * circumference, Q spread uniformly), plus ε₀ E₀·n̂ for the induced charges when they are on.
 */
export function surfaceCharge(phi, { Q = 0, E0x = 0, E0y = 0, induce = false } = {}) {
  let s = Q * 1e-9 / (2 * Math.PI * RADIUS);
  if (induce) s += EPS0 * (E0x * Math.cos(phi) + E0y * Math.sin(phi));
  return s;
}

/**
 * The σ ring drawn on the conductor's edge, as in the old app: n points with a colour value
 * in [-1, 1] (negative: least σ, positive: most). The induced part uses E₀'s direction only,
 * so the ring shows where charge gathers rather than how much.
 */
export function sigmaRing({ Q = 0, E0x = 0, E0y = 0, induce = false } = {}, n = 180) {
  const phis = linspace(0, 2 * Math.PI, n);
  const m = Math.hypot(E0x, E0y);
  const [ux, uy] = m > 0 ? [E0x / m, E0y / m] : [1, 0];
  const sig = phis.map((t) => {
    let s = Q * 1e-9 / (2 * Math.PI * RADIUS);
    if (induce && m > 0) s += (ux * Math.cos(t) + uy * Math.sin(t)) * 8.85e-12;
    return s;
  });
  const lo = Math.min(...sig);
  const hi = Math.max(...sig);
  const span = Math.max(hi - lo, 1e-30);
  return {
    x: phis.map((t) => RADIUS * Math.cos(t)),
    y: phis.map((t) => RADIUS * Math.sin(t)),
    color: sig.map((s) => ((s - (lo + hi) / 2) / span) * 2),
  };
}

const FINE = 61;    // heatmap samples per side
const ARROWS = 21;  // quiver arrows per side

/**
 * |E| on a FINE × FINE grid over the window (z[row j][col i] at (xs[i], xs[j])), its maximum,
 * and quiver arrows of fixed length on an ARROWS × ARROWS grid as Plotly line segments
 * ({ x: [x0, x1, null, ...], y }). Points with zero field get no arrow.
 */
export function fieldGrid(params, { fine = FINE, arrows = ARROWS } = {}) {
  const xs = linspace(-WINDOW, WINDOW, fine);
  let maxE = 0;
  const z = xs.map((y) => xs.map((x) => {
    const m = Math.hypot(...fieldAt(x, y, params));
    if (m > maxE) maxE = m;
    return m;
  }));
  const qs = linspace(-WINDOW, WINDOW, arrows);
  const len = (2 * WINDOW / (arrows - 1)) * 0.52;
  const qx = [];
  const qy = [];
  for (const y of qs) {
    for (const x of qs) {
      const [ex, ey] = fieldAt(x, y, params);
      const m = Math.hypot(ex, ey);
      if (m === 0) continue;
      qx.push(x, x + ex * len / m, null);
      qy.push(y, y + ey * len / m, null);
    }
  }
  return { xs, z, maxE, quiver: { x: qx, y: qy } };
}

/** Scale (E0x, E0y) back onto the |E₀| = E0_MAX circle if it lies outside it. */
export function limitE0(E0x, E0y) {
  const m = Math.hypot(E0x, E0y);
  return m > E0_MAX ? [E0x * E0_MAX / m, E0y * E0_MAX / m] : [E0x, E0y];
}

/** |E₀| (V/m) and its angle from +x (degrees, −180 to 180). */
export function polarE0(E0x, E0y) {
  return { mag: Math.hypot(E0x, E0y), angle: Math.atan2(E0y, E0x) * 180 / Math.PI };
}

// ── Charge overlay: fixed protons and mobile electrons in the bulk, electrons on the surface ──
const CELL = 2;             // lattice spacing (cm)
const DRIFT = 0.030;        // electron drift per frame (cm)
const ORBIT = 0.015;        // surface-charge orbit speed factor (rad per frame per rad·nC)
const SURFACE_COUNT = 16;
const SURFACE_R = RADIUS + 0.4;

function wrap(v, lo, hi) {
  const span = hi - lo;
  while (v > hi) v -= span;
  while (v < lo) v += span;
  return v;
}

/**
 * The animated e⁻/p⁺ overlay of the old app, as plain per-instance data (no timers).
 *   step(frames, params)  advance by `frames` 60 Hz frames (fractional ok): with E₀ on and no
 *                         induced charges the electrons drift against E₀ (wrapping in the window),
 *                         and with θ·Q ≠ 0 the surface electrons orbit clockwise
 *   frame(params)         { protons, electrons, surface }, each { x: [], y: [] }: what to draw now.
 *                         Protons and electrons are those inside the conductor; surface charges
 *                         show only when θ ≠ 0.
 */
export function createChargeOverlay() {
  const lattice = [];
  for (let x = -WINDOW + CELL / 2; x <= WINDOW - CELL / 2 + 1e-9; x += CELL) {
    for (let y = -WINDOW + CELL / 2; y <= WINDOW - CELL / 2 + 1e-9; y += CELL) lattice.push([x, y]);
  }
  const inBulk = ([x, y]) => Math.hypot(x, y) < RADIUS;
  const protons = lattice.filter(inBulk);
  const protonXY = { x: protons.map((p) => p[0]), y: protons.map((p) => p[1]) };
  const electrons = lattice.map(([x, y]) => [x + CELL * 0.3, y + CELL * 0.3]);
  const surface = Array.from({ length: SURFACE_COUNT }, (_, i) => 2 * Math.PI * i / SURFACE_COUNT);

  return {
    step(frames, { Q = 0, E0x = 0, E0y = 0, theta = 0, induce = false } = {}) {
      const m = Math.hypot(E0x, E0y);
      if (m > 0 && !induce) {
        const dx = -E0x / m * DRIFT * frames;
        const dy = -E0y / m * DRIFT * frames;
        for (const e of electrons) {
          e[0] = wrap(e[0] + dx, -WINDOW, WINDOW);
          e[1] = wrap(e[1] + dy, -WINDOW, WINDOW);
        }
      }
      const orbit = theta * Math.abs(Q) * ORBIT * frames;
      if (orbit > 0) for (let i = 0; i < surface.length; i++) surface[i] -= orbit;
    },
    frame({ theta = 0 } = {}) {
      const bulk = electrons.filter(inBulk);
      const shown = Math.abs(theta) > 0.001 ? surface : [];
      return {
        protons: { x: [...protonXY.x], y: [...protonXY.y] },
        electrons: { x: bulk.map((e) => e[0]), y: bulk.map((e) => e[1]) },
        surface: { x: shown.map((a) => SURFACE_R * Math.cos(a)), y: shown.map((a) => SURFACE_R * Math.sin(a)) },
      };
    },
  };
}
