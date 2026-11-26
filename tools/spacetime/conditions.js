// Spacetime Condition types (framework v1, Spec 0003 ticket 07). No DOM, so it runs in Node.
//
// They judge the State's `diagram` (diagramState below) with K′ at the State's `v`. Every
// coordinate and tolerance is absolute, in K.
//   { type: 'st-event', x, t, tol }             some event within tol of (x, t)
//   { type: 'st-worldline', u, uTol, x, t, tol } some worldline segment with velocity dx/dt
//       within uTol of u that passes within tol of (x, t). Parametric worldlines and joined
//       chains both count; for a chain the matching segment itself must reach the point (an
//       extended single segment is infinite, as drawn).
//   { type: 'st-rod', ends: [[x1, t1], [x2, t2]], tol }
//       some rod (in either frame, ends on worldlines included) with its two ends within tol of
//       the two points, in either order
// Every type also takes targetLabel, which names what is missing in its feedback ("No <targetLabel> yet").
// All fields but targetLabel are required. Distances are Euclidean in the (x, t) plane of K.
// Miss feedback says what is missing in the Task's terms, with no internal symbols such as u, and
// names the closest match: "No vertical worldline at x = 2 yet (the nearest one is at x = 3)",
// "No light ray going left through (0, 0) yet", "No event at (3, 5) yet (the nearest one is at (2.9, 4.6))".
// Register them with createRunner/mountActivity({ conditionTypes }) or the Activity's own
// conditionTypes; spacetime.js re-exports them.

import { eventK, eventsOf, normalize, rodEnd, worldlineSegments, worldlinesOf } from './physics.js';

/** The State's `diagram`: the canonical (normalized) object list as one JSON string. */
export const diagramState = (D) => JSON.stringify(normalize(D).objs);

/** The diagram a State snapshot carries, rebuilt and normalized. */
function diagramOf(state) {
  if (typeof state.diagram !== 'string') throw new Error('A spacetime Condition needs the State "diagram".');
  return normalize({ v: state.v, objs: JSON.parse(state.diagram) });
}

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

// A number rounded to one decimal more than the tolerance shows, without trailing zeros.
function num(value, tol) {
  const digits = tol > 0 ? Math.max(0, Math.ceil(-Math.log10(tol))) + 1 : 3;
  return String(Number(value.toFixed(digits)) + 0);
}
const pt = (p, tol) => `(${num(p[0], tol)}, ${num(p[1], tol)})`;

// "No <what> yet", plus what is closest when there is something to point at.
const missing = (what, nearest) => `No ${what} yet${nearest ? ` (${nearest})` : ''}`;

function stEvent(c, state) {
  const D = diagramOf(state);
  const target = [c.x, c.t];
  const what = c.targetLabel ?? `event at ${pt(target, c.tol)}`;
  let best = null;
  for (const e of eventsOf(D)) {
    const k = eventK(e, D.v);
    const d = dist(k, target);
    if (!best || d < best.d) best = { k, d };
  }
  if (!best) return { pass: false, feedback: missing(what) };
  return { pass: best.d <= c.tol, feedback: missing(what, `the nearest one is at ${pt(best.k, c.tol)}`) };
}

/** Closest point to q on the K segment p + s d, s in [s0, s1] (either end may be infinite). */
function closestOn(sg, q) {
  const dd = sg.d[0] * sg.d[0] + sg.d[1] * sg.d[1];
  const s = ((q[0] - sg.p[0]) * sg.d[0] + (q[1] - sg.p[1]) * sg.d[1]) / dd;
  const c = Math.max(sg.s0, Math.min(sg.s1, s));
  return [sg.p[0] + c * sg.d[0], sg.p[1] + c * sg.d[1]];
}

/** A worldline of velocity u and where it must be, as a Task would put it. */
function describeWorldline(c) {
  const at = [c.x, c.t];
  if (Math.abs(c.u) <= 1e-9) return `vertical worldline at x = ${num(c.x, c.tol)}`;
  const dir = c.u > 0 ? 'right' : 'left';
  const through = `through ${pt(at, c.tol)}`;
  if (Math.abs(Math.abs(c.u) - 1) <= 1e-9) return `light ray going ${dir} ${through}`;
  return `worldline moving ${dir} at ${num(Math.abs(c.u), c.uTol)}c ${through}`;
}

function stWorldline(c, state) {
  const D = diagramOf(state);
  const target = [c.x, c.t];
  const what = c.targetLabel ?? describeWorldline(c);
  let best = null, passesThere = false;
  for (const w of worldlinesOf(D)) {
    for (const sg of worldlineSegments(w, D)) {
      const q = closestOn(sg, target);
      const d = dist(q, target);
      const matches = Math.abs(sg.d[1]) >= 1e-12 && Math.abs(sg.d[0] / sg.d[1] - c.u) <= c.uTol;
      if (!matches) { passesThere ||= d <= c.tol; continue; }
      if (!best || d < best.d) best = { q, d };
    }
  }
  if (!best) return { pass: false, feedback: missing(what, passesThere ? 'one passes there, tilted differently' : '') };
  // A vertical worldline level with the point is named by its x; anything else by its distance.
  const nearest = Math.abs(c.u) <= 1e-9 && Math.abs(best.q[1] - c.t) <= 1e-9
    ? `the nearest one is at x = ${num(best.q[0], c.tol)}`
    : `the nearest one passes ${num(best.d, c.tol)} from it`;
  return { pass: best.d <= c.tol, feedback: missing(what, nearest) };
}

function stRod(c, state) {
  const D = diagramOf(state);
  const [a, b] = c.ends;
  const what = c.targetLabel ?? `rod from ${pt(a, c.tol)} to ${pt(b, c.tol)}`;
  let best = null;
  for (const r of D.objs.filter((o) => o.kind === 'rod')) {
    const A = rodEnd(r, 0, D).pt, B = rodEnd(r, 1, D).pt;
    // Pair the rod's ends with the given points in whichever order fits better.
    for (const [p, q] of [[A, B], [B, A]]) {
      const miss = Math.max(dist(p, a), dist(q, b));
      if (!best || miss < best.miss) best = { p, q, miss };
    }
  }
  if (!best) return { pass: false, feedback: missing(what) };
  return { pass: best.miss <= c.tol,
    feedback: missing(what, `the nearest one has ends at ${pt(best.p, c.tol)} and ${pt(best.q, c.tol)}`) };
}

export const conditionTypes = Object.freeze({
  'st-rod': stRod,
  'st-event': stEvent,
  'st-worldline': stWorldline,
});
