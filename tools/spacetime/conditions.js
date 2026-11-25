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
// Every type also takes targetLabel, which replaces the "need ..." text of its feedback.
// All fields but targetLabel are required. Distances are Euclidean in the (x, t) plane of K.
// Miss feedback names the closest match, e.g. "nearest event is at (2.9, 4.6); need (3, 5) ± 0.1".
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

function stEvent(c, state) {
  const D = diagramOf(state);
  const target = [c.x, c.t];
  const need = c.targetLabel ?? `${pt(target, c.tol)} ± ${c.tol}`;
  let best = null;
  for (const e of eventsOf(D)) {
    const k = eventK(e, D.v);
    const d = dist(k, target);
    if (!best || d < best.d) best = { k, d };
  }
  if (!best) return { pass: false, feedback: `no event found; need ${need}` };
  return { pass: best.d <= c.tol, feedback: `nearest event is at ${pt(best.k, c.tol)}; need ${need}` };
}

/** Distance from point q to the K segment p + s d, s in [s0, s1] (either end may be infinite). */
function segmentDistance(sg, q) {
  const dd = sg.d[0] * sg.d[0] + sg.d[1] * sg.d[1];
  const s = ((q[0] - sg.p[0]) * sg.d[0] + (q[1] - sg.p[1]) * sg.d[1]) / dd;
  const c = Math.max(sg.s0, Math.min(sg.s1, s));
  return dist([sg.p[0] + c * sg.d[0], sg.p[1] + c * sg.d[1]], q);
}

function stWorldline(c, state) {
  const D = diagramOf(state);
  const target = [c.x, c.t];
  const uText = `u = ${c.u.toFixed(Math.max(2, Math.ceil(-Math.log10(c.uTol))))}`;
  let best = Infinity;
  for (const w of worldlinesOf(D)) {
    for (const sg of worldlineSegments(w, D)) {
      if (Math.abs(sg.d[1]) < 1e-12 || Math.abs(sg.d[0] / sg.d[1] - c.u) > c.uTol) continue;
      best = Math.min(best, segmentDistance(sg, target));
    }
  }
  if (best === Infinity) return { pass: false, feedback: `no worldline with ${uText} found` };
  const need = c.targetLabel ?? `within ${c.tol}`;
  return { pass: best <= c.tol,
    feedback: `nearest worldline with ${uText} passes ${num(best, c.tol)} from ${pt(target, c.tol)}; need ${need}` };
}

function stRod(c, state) {
  const D = diagramOf(state);
  const [a, b] = c.ends;
  const need = c.targetLabel ?? `${pt(a, c.tol)} and ${pt(b, c.tol)} ± ${c.tol}`;
  let best = null;
  for (const r of D.objs.filter((o) => o.kind === 'rod')) {
    const A = rodEnd(r, 0, D).pt, B = rodEnd(r, 1, D).pt;
    // Pair the rod's ends with the given points in whichever order fits better.
    for (const [p, q] of [[A, B], [B, A]]) {
      const miss = Math.max(dist(p, a), dist(q, b));
      if (!best || miss < best.miss) best = { p, q, miss };
    }
  }
  if (!best) return { pass: false, feedback: `no rod found; need ${need}` };
  return { pass: best.miss <= c.tol,
    feedback: `nearest rod has ends at ${pt(best.p, c.tol)} and ${pt(best.q, c.tol)}; need ${need}` };
}

export const conditionTypes = Object.freeze({
  'st-rod': stRod,
  'st-event': stEvent,
  'st-worldline': stWorldline,
});
