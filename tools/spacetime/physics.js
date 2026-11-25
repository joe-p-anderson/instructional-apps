// Spacetime maths (framework v1 spacetime Tool). No DOM, so it can be imported from Node.
// Units have c = 1. Frame ids: 'K' (the rest frame) and 'Kp' (K′, moving at v along +x).
// A point is [x, t]. Coordinates are kept in K unless a function says otherwise.

/** Lorentz factor γ = 1/√(1 − v²). */
export const gamma = (v) => 1 / Math.sqrt(1 - v * v);

/** K coordinates p → coordinates in frame F. */
export function toFrame(F, p, v) {
  if (F === 'K') return [p[0], p[1]];
  const g = gamma(v);
  return [g * (p[0] - v * p[1]), g * (p[1] - v * p[0])];
}

/** Coordinates p in frame F → K coordinates. */
export function fromFrame(F, p, v) {
  if (F === 'K') return [p[0], p[1]];
  const g = gamma(v);
  return [g * (p[0] + v * p[1]), g * (p[1] + v * p[0])];
}

/** Coordinates p in frame G → coordinates in frame P. */
export function convert(G, P, p, v) {
  return G === P ? [p[0], p[1]] : toFrame(P, fromFrame(G, p, v), v);
}

export const PALETTE = ['#D55E00', '#0072B2', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#7B3294', '#333333'];
export const VMAX = 0.999;
export const DEFAULT_VIEW = { cx: 4, ct: 4, span: 12.5 };

// ── Diagram objects ──
// A diagram D is { v, names, grid, showKp, objs, nextId, colorIdx, view } (see blankDiagram).
// Objects in D.objs, each with a numeric id:
//   event     { kind: 'event', home: 'K'|'Kp', x, t, label, color, showCoords, cone }
//             (x, t) are coordinates in its home frame, the frame it stays fixed in when v changes
//   worldline { kind: 'wl', mode: 'param', frame, u, x0, ... }   x = u t + x0 in `frame`, |u| ≤ 1
//             { kind: 'wl', mode: 'chain', ids: [eventId...], extend, ... }   joined events
//   rod       { kind: 'rod', frame, T, ends: [{ x, wl }, { x, wl }], ... }  along t = T in `frame`;
//             an end with wl set sits where that worldline crosses t = T
//   interval  { kind: 'interval', a, b }       measurement between two events
//   ptime     { kind: 'ptime', wl, frame, t1, t2 }   proper time on a worldline between two times

export const byId = (D, id) => D.objs.find((o) => o.id === id);
export const eventsOf = (D) => D.objs.filter((o) => o.kind === 'event');
export const worldlinesOf = (D) => D.objs.filter((o) => o.kind === 'wl');

/** An event's K coordinates. */
export const eventK = (e, v) => fromFrame(e.home, [e.x, e.t], v);

/**
 * A worldline as straight segments in K: [{ p, d, s0, s1, a?, b? }], the points p + s d for
 * s in [s0, s1]. A parametric worldline is one infinite segment; a chain has one per pair of
 * consecutive events (a, b), and a single extended segment is infinite too.
 */
export function worldlineSegments(w, D) {
  if (w.mode === 'param') {
    return [{ p: fromFrame(w.frame, [w.x0, 0], D.v), d: fromFrame(w.frame, [w.u, 1], D.v), s0: -Infinity, s1: Infinity }];
  }
  const evs = w.ids.map((id) => byId(D, id)).filter(Boolean);
  const segs = [];
  for (let i = 0; i + 1 < evs.length; i++) {
    const a = eventK(evs[i], D.v), b = eventK(evs[i + 1], D.v);
    const d = [b[0] - a[0], b[1] - a[1]];
    if (Math.abs(d[0]) < 1e-12 && Math.abs(d[1]) < 1e-12) continue;
    segs.push({ p: a, d, s0: 0, s1: 1, a: evs[i], b: evs[i + 1] });
  }
  if (w.extend && segs.length === 1) { segs[0].s0 = -Infinity; segs[0].s1 = Infinity; }
  return segs;
}

/** A direction [dx, dt] faster than light. */
export const isSpacelike = (d) => Math.abs(d[0]) > Math.abs(d[1]) + 1e-9;

/** Proper time along a K displacement d (0 if it is not timelike). */
export function segmentProperTime(d) {
  const s2 = d[1] * d[1] - d[0] * d[0];
  return s2 > 0 ? Math.sqrt(s2) : 0;
}

/** Velocity dx/dt in frame F of the K direction d (Infinity for a line of simultaneity). */
export function velocityIn(F, d, v) {
  const e = toFrame(F, d, v);
  return Math.abs(e[1]) < 1e-12 ? Infinity : e[0] / e[1];
}

function segmentCut(sg, F, T, v) {
  const q = toFrame(F, sg.p, v), e = toFrame(F, sg.d, v);
  if (Math.abs(e[1]) < 1e-12) return null;
  const s = (T - q[1]) / e[1];
  if (s < sg.s0 - 1e-9 || s > sg.s1 + 1e-9) return null;
  return { pt: [sg.p[0] + s * sg.d[0], sg.p[1] + s * sg.d[1]], d: sg.d };
}

/** Where worldline w crosses t = T in frame F: { pt (K), d (K direction) }, or null. */
export function worldlineCut(w, D, F, T) {
  for (const sg of worldlineSegments(w, D)) {
    const c = segmentCut(sg, F, T, D.v);
    if (c) return c;
  }
  return null;
}

/** End i of rod r: { pt (K), d?, wl, ok }. ok is false when its worldline misses t = T. */
export function rodEnd(r, i, D) {
  const end = r.ends[i];
  if (end.wl != null) {
    const w = byId(D, end.wl);
    if (w) {
      const c = worldlineCut(w, D, r.frame, r.T);
      if (c) return { pt: c.pt, d: c.d, wl: w, ok: true };
      return { pt: fromFrame(r.frame, [end.x, r.T], D.v), wl: w, ok: false };
    }
  }
  return { pt: fromFrame(r.frame, [end.x, r.T], D.v), wl: null, ok: true };
}

/**
 * Rod r measured: { A, B, LF } with LF its length in its own frame; plus, when both ends ride
 * worldlines, parallel: { L0, u: { K, Kp }, L: { K, Kp } } (proper and measured lengths) if the
 * worldlines move together, or nonparallel: true.
 */
export function rodInfo(r, D) {
  const v = D.v;
  const A = rodEnd(r, 0, D), B = rodEnd(r, 1, D);
  const LF = Math.abs(toFrame(r.frame, A.pt, v)[0] - toFrame(r.frame, B.pt, v)[0]);
  const info = { A, B, LF };
  if (A.wl && B.wl && A.ok && B.ok && A.d && B.d) {
    const ua = A.d[0] / A.d[1], ub = B.d[0] / B.d[1];
    if (Math.abs(A.d[1]) > 1e-12 && Math.abs(B.d[1]) > 1e-12 && Math.abs(ua - ub) < 1e-6 && Math.abs(ua) < 1 - 1e-9) {
      const g = gamma(ua), xR = (p) => g * (p[0] - ua * p[1]);
      const L0 = Math.abs(xR(A.pt) - xR(B.pt));
      const uKp = velocityIn('Kp', A.d, v);
      info.parallel = { L0, u: { K: ua, Kp: uKp }, L: { K: L0 * Math.sqrt(1 - ua * ua), Kp: L0 * Math.sqrt(1 - uKp * uKp) } };
    } else info.nonparallel = true;
  }
  return info;
}

/**
 * Proper time along worldline w between times t1 and t2 of frame F: { tau, partial, spacelike }.
 * partial: the worldline covers only part of the time range (tau counts that part).
 * spacelike: part of it is spacelike, which adds no proper time.
 */
export function properTime(w, D, F, t1, t2) {
  const lo = Math.min(t1, t2), hi = Math.max(t1, t2);
  let tau = 0, covered = 0, spacelike = false;
  for (const sg of worldlineSegments(w, D)) {
    const q = toFrame(F, sg.p, D.v), e = toFrame(F, sg.d, D.v);
    if (Math.abs(e[1]) < 1e-12) continue;
    let sa = (lo - q[1]) / e[1], sb = (hi - q[1]) / e[1];
    if (sa > sb) [sa, sb] = [sb, sa];
    sa = Math.max(sa, sg.s0);
    sb = Math.min(sb, sg.s1);
    if (sb <= sa) continue;
    if (isSpacelike(e)) spacelike = true;
    tau += (sb - sa) * segmentProperTime(e);
    covered += (sb - sa) * Math.abs(e[1]);
  }
  return { tau, partial: covered < hi - lo - 1e-6, spacelike };
}

/**
 * The interval between K points A and B: { dK, dKp, s2, kind, tau?, distance? }.
 * s² = Δt² − Δx² (the same in both frames). kind is 'timelike' (with proper time tau),
 * 'spacelike' (with proper distance) or 'lightlike' (s² zero to within rounding).
 */
export function interval(A, B, v) {
  const dK = [B[0] - A[0], B[1] - A[1]];
  const dKp = toFrame('Kp', dK, v);
  const s2 = dK[1] * dK[1] - dK[0] * dK[0];
  const tol = 1e-6 * Math.max(1, dK[0] * dK[0] + dK[1] * dK[1]);
  if (Math.abs(s2) < tol) return { dK, dKp, s2, kind: 'lightlike' };
  if (s2 > 0) return { dK, dKp, s2, kind: 'timelike', tau: Math.sqrt(s2) };
  return { dK, dKp, s2, kind: 'spacelike', distance: Math.sqrt(-s2) };
}

// ── Saved diagrams ──

/** An empty diagram: Earth (K) and Ship (K′) at rest, both grids and both panels shown. */
export function blankDiagram() {
  return { v: 0, names: { K: 'Earth', Kp: 'Ship' }, grid: { K: true, Kp: true }, showKp: true,
    objs: [], nextId: 1, colorIdx: 0, view: { ...DEFAULT_VIEW } };
}

/**
 * Any saved diagram (JSON export, autosave, share link, Setup) → a valid diagram. Anything
 * unusable is replaced by its default; objects with a bad or repeated id or an unknown kind are
 * dropped, and so is anything that depends on a dropped object (a chain left with fewer than two
 * events, an interval or proper time whose event or worldline is gone). A rod end whose
 * worldline is gone becomes free. Idempotent.
 */
export function normalize(o) {
  const N = blankDiagram();
  if (!o || typeof o !== 'object' || Array.isArray(o)) return N;
  const num = (x, d) => (Number.isFinite(+x) && x !== null && x !== '' ? +x : d);
  const col = (c) => (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : PALETTE[0]);
  const fr = (f) => (f === 'Kp' ? 'Kp' : 'K');
  const str = (s, d) => (typeof s === 'string' ? s.slice(0, 40) : d);
  N.v = Math.max(-VMAX, Math.min(VMAX, num(o.v, 0)));
  if (o.names) { N.names.K = str(o.names.K, 'Earth') || 'Earth'; N.names.Kp = str(o.names.Kp, 'Ship') || 'Ship'; }
  if (o.grid) { N.grid.K = o.grid.K !== false; N.grid.Kp = o.grid.Kp !== false; }
  N.showKp = o.showKp !== false;
  if (o.view) {
    N.view.cx = num(o.view.cx, DEFAULT_VIEW.cx);
    N.view.ct = num(o.view.ct, DEFAULT_VIEW.ct);
    N.view.span = Math.max(0.5, Math.min(400, num(o.view.span, DEFAULT_VIEW.span)));
  }
  N.colorIdx = Math.max(0, Math.floor(num(o.colorIdx, 0)));
  const objs = Array.isArray(o.objs) ? o.objs : [];
  const out = [];
  const seen = new Set();
  for (const a of objs) {
    if (!a || typeof a !== 'object') continue;
    const id = Math.floor(num(a.id, NaN));
    if (!Number.isFinite(id) || seen.has(id)) continue;
    const base = { id, color: col(a.color), label: str(a.label, '') };
    if (a.kind === 'event') out.push({ ...base, kind: 'event', home: fr(a.home), x: num(a.x, 0), t: num(a.t, 0), showCoords: !!a.showCoords, cone: !!a.cone });
    else if (a.kind === 'wl' && a.mode === 'param') out.push({ ...base, kind: 'wl', mode: 'param', frame: fr(a.frame), u: Math.max(-1, Math.min(1, num(a.u, 0))), x0: num(a.x0, 0), showEq: !!a.showEq });
    else if (a.kind === 'wl' && a.mode === 'chain' && Array.isArray(a.ids)) out.push({ ...base, kind: 'wl', mode: 'chain', ids: a.ids.map(Number).filter(Number.isFinite), extend: !!a.extend, showEq: !!a.showEq });
    else if (a.kind === 'rod' && Array.isArray(a.ends) && a.ends.length === 2) out.push({ ...base, kind: 'rod', frame: fr(a.frame), T: num(a.T, 0), ends: a.ends.map((e) => ({ x: num(e && e.x, 0), wl: e && e.wl != null && Number.isFinite(+e.wl) ? +e.wl : null })), showEq: !!a.showEq });
    else if (a.kind === 'interval') out.push({ id, kind: 'interval', a: +a.a, b: +a.b });
    else if (a.kind === 'ptime') out.push({ id, kind: 'ptime', wl: +a.wl, frame: fr(a.frame), t1: num(a.t1, 0), t2: num(a.t2, 1) });
    else continue;
    seen.add(id);
  }
  // Drop chains left with too few events first, then whatever depended on a dropped object.
  const has = (list, id, kind) => list.some((x) => x.id === id && x.kind === kind);
  const chainsOk = out.filter((x) => {
    if (x.kind === 'wl' && x.mode === 'chain') { x.ids = x.ids.filter((i) => has(out, i, 'event')); return x.ids.length >= 2; }
    return true;
  });
  N.objs = chainsOk.filter((x) => {
    if (x.kind === 'interval') return has(chainsOk, x.a, 'event') && has(chainsOk, x.b, 'event');
    if (x.kind === 'ptime') return has(chainsOk, x.wl, 'wl');
    if (x.kind === 'rod') x.ends.forEach((e) => { if (e.wl != null && !has(chainsOk, e.wl, 'wl')) e.wl = null; });
    return true;
  });
  N.nextId = Math.max(num(o.nextId, 1), ...N.objs.map((x) => x.id + 1), 1);
  return N;
}

/** The JSON export format: the diagram tagged with app and version. */
export function exportDiagram(D) {
  return { app: 'spacetime-diagram', version: 1, ...JSON.parse(JSON.stringify(D)) };
}
