// Least-squares maths for the least-squares Tool (no DOM, safe to import from Node).
// Ported from the old least-squares/index.html.
//
//   generate(datasetId, seed)            seeded data { x, y, sy }[] (the whole class sees seed 0)
//   transformPoints(raw, xT, yT)          plotted points { X, Y, sY } after the axis transforms
//   stats(pts)                            OLS and through-origin fits, SST, SSE(m, b), bowl shape
//   fitMeasures(S, pts, m, b)             SSE, SST, SSE/SST, R² (pinned to 0 when worse than flat), hits
//   interpret(datasetId, xT, yT, m, b)    null when the axes don't linearize the model, else the
//                                         meaning of slope and intercept and the implied quantities

export const PI = Math.PI;

/* ── seeded noise ── */
export function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function gauss(rng) { let u = 0; while (!u) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * PI * rng()); }
const seq = (lo, hi, step) => Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => +(lo + i * step).toFixed(6));

/* ── datasets ──
   power model:      y = C·x^p           (any (x^a, y^c) with a = p·c is linear, as is ln–ln)
   powerConst model: y = A·x^p + B       (only (x^p, y) is linear)                           */
export const DATASETS = {
  pendulum: {
    name: 'Pendulum: period vs length',
    x: { sym: 'L', unit: { m: 1 } }, y: { sym: 'T', unit: { s: 1 } },
    xs: seq(0.20, 1.20, 0.10), sy: () => 0.06,
    truth: (L) => 2 * PI * Math.sqrt(L / 9.81),
    story: String.raw`A pendulum of length \(L\) swings with period \[T = 2\pi\sqrt{L/g}.\] Choose axes that make this a straight line, then use the slope to find \(g\).`,
    checkLabel: 'Check your g',
    model: { kind: 'power', p: 0.5, Cexpr: '2π/√g',
      quantities: (C) => [['g', 4 * PI * PI / (C * C), 'm/s²']], truth: [['g', 9.81, 'm/s²']] },
  },
  freefall: {
    name: 'Free fall: drop time vs height',
    x: { sym: 'd', unit: { m: 1 } }, y: { sym: 't', unit: { s: 1 } },
    xs: seq(0.20, 2.00, 0.20), sy: () => 0.02,
    truth: (d) => Math.sqrt(2 * d / 9.81),
    story: String.raw`A ball dropped from rest falls a height \(d\) in time \(t\), where \[d = \tfrac12 g t^2.\] Choose axes that make this a straight line, then find \(g\).`,
    checkLabel: 'Check your g',
    model: { kind: 'power', p: 0.5, Cexpr: '√(2/g)',
      quantities: (C) => [['g', 2 / (C * C), 'm/s²']], truth: [['g', 9.81, 'm/s²']] },
  },
  light: {
    name: 'Light: intensity vs distance',
    x: { sym: 'r', unit: { m: 1 } }, y: { sym: 'I', unit: { lx: 1 } },
    xs: seq(0.10, 0.60, 0.05), sy: (I) => 0.08 * I + 4,
    truth: (r) => 4.0 / (r * r) + 25,
    story: String.raw`A light meter a distance \(r\) from a small bulb reads \[I = \frac{A}{r^2} + B,\] where \(B\) is background light in the room. Choose axes that make this a straight line, then find \(A\) and \(B\).`,
    checkLabel: 'Check A and B',
    model: { kind: 'powerConst', p: -2, Aname: 'A', Bname: 'B (background)',
      truth: [['A', 4.0, 'lx·m²'], ['B', 25, 'lx']] },
  },
  ohm: {
    name: "Ohm's law: current vs voltage",
    x: { sym: 'V', unit: { V: 1 } }, y: { sym: 'I', unit: { mA: 1 } },
    xs: seq(1, 10, 1), sy: () => 1.5,
    truth: (V) => 1000 * V / 220,
    story: String.raw`The current through a resistor is \[I = \frac{V}{R}.\] Plot the data, fit a line, and find \(R\). (1 mA/V = 1/kΩ.)`,
    checkLabel: 'Check your R',
    model: { kind: 'power', p: 1, Cexpr: '1/R',
      quantities: (C) => [['R', 1000 / C, 'Ω']], truth: [['R', 220, 'Ω']] },
  },
};
export const DATASET_IDS = Object.keys(DATASETS);

/** Seeded data: the same dataset and seed always give the same points. */
export function generate(datasetId, seed) {
  const d = DATASETS[datasetId];
  const rng = mulberry32(1013 * (DATASET_IDS.indexOf(datasetId) + 1) + 7919 * seed);
  // Error bars are generous (as in most intro labs): the scatter is about half a bar and never
  // leaves it, so with the right axes some lines always pass through every bar.
  return d.xs.map((x) => {
    const yt = d.truth(x), sy = d.sy(yt);
    return { x, y: yt + sy * Math.max(-0.85, Math.min(0.85, 0.45 * gauss(rng))), sy };
  });
}

/* ── axis transforms ── */
export const TF = {
  id:   { k: 1,  f: (u) => u,             inv: (v) => v },
  sq:   { k: 2,  f: (u) => u * u,         inv: (v) => Math.sqrt(Math.max(v, 0)) },
  sqrt: { k: 0.5, f: (u) => Math.sqrt(u), inv: (v) => v * v },
  inv:  { k: -1, f: (u) => 1 / u,         inv: (v) => 1 / v },
  inv2: { k: -2, f: (u) => 1 / (u * u),   inv: (v) => 1 / Math.sqrt(v) },
  ln:   { k: 0,  f: (u) => Math.log(u),   inv: (v) => Math.exp(v) },
};
export const TF_ORDER = ['id', 'sq', 'sqrt', 'inv', 'inv2', 'ln'];
export const tfSym = (key, s) => ({ id: s, sq: `${s}²`, sqrt: `√${s}`, inv: `1/${s}`, inv2: `1/${s}²`, ln: `ln ${s}` })[key];
const tfSigma = (key, u, s) => (key === 'ln' ? s / u : Math.abs(TF[key].k * u ** (TF[key].k - 1)) * s);

/** Plotted points after the axis transforms, with the y error bar carried through. */
export function transformPoints(raw, xT, yT) {
  return raw.map((p) => ({ X: TF[xT].f(p.x), Y: TF[yT].f(p.y), sY: tfSigma(yT, p.y, p.sy) }));
}

/* ── fits ── */
export const hits = (p, m, b) => Math.abs(p.Y - m * p.X - b) <= p.sY;

/** OLS (mS, bS) and through-origin (m0) fits, SST, SSE(m, b), and the principal axes of the SSE bowl. */
export function stats(pts) {
  const n = pts.length;
  let Sx = 0, Sy = 0, Sxx = 0, Sxy = 0;
  for (const p of pts) { Sx += p.X; Sy += p.Y; Sxx += p.X * p.X; Sxy += p.X * p.Y; }
  const xbar = Sx / n, ybar = Sy / n;
  let SST = 0; for (const p of pts) SST += (p.Y - ybar) ** 2;
  const det = n * Sxx - Sx * Sx;
  const mS = (n * Sxy - Sx * Sy) / det, bS = ybar - mS * xbar, m0 = Sxy / Sxx;
  const SSE = (m, b) => pts.reduce((s, p) => s + (p.Y - m * p.X - b) ** 2, 0);
  // principal axes of the quadratic bowl SSE = SSEmin + [dm db] H [dm db]ᵀ, H = [[Sxx, Sx], [Sx, n]]
  const th = 0.5 * Math.atan2(2 * Sx, Sxx - n), cs = Math.cos(th), sn = Math.sin(th);
  const l1 = Sxx * cs * cs + 2 * Sx * cs * sn + n * sn * sn, l2 = det / l1;
  return { n, Sx, Sxx, det, xbar, ybar, SST, mS, bS, m0, SSE, SSEmin: SSE(mS, bS), cs, sn, l1, l2 };
}

/** How good the line y = m x + b is: SSE, SST, SSE/SST, R² (0 when worse than flat), bars hit. */
export function fitMeasures(S, pts, m, b) {
  const SSE = S.SSE(m, b), ratio = SSE / S.SST;
  return { SSE, SST: S.SST, ratio, R2: ratio > 1 ? 0 : 1 - ratio,
    hits: pts.filter((p) => hits(p, m, b)).length, n: pts.length };
}

/* ── units and number formatting (plain text) ── */
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };
const supInt = (n) => String(n).split('').map((c) => SUP[c]).join('');
const minus = (s) => s.replace(/-/g, '−');

export function fmt(v, sig = 3) {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e-3 && a < 1e5) return minus(String(Number(v.toPrecision(sig))));
  const e = Math.floor(Math.log10(a));
  return minus(`${Number((v / 10 ** e).toPrecision(sig))}×10`) + supInt(e);
}
export function niceStep(span, n) {
  const raw = span / n, mag = 10 ** Math.floor(Math.log10(raw)), r = raw / mag;
  return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
}
export function fmtTick(v, step) {
  if (Math.abs(v) < step * 1e-6) return '0';
  if (step >= 1e-3 && step < 1e5) return minus(v.toFixed(Math.max(0, -Math.floor(Math.log10(step) + 1e-9))));
  return fmt(v, 2);
}

export function powUnit(u, k) { const o = {}; for (const b in u) o[b] = u[b] * k; return o; }
export function mulUnit(a, b) {
  const o = { ...a };
  for (const k in b) o[k] = (o[k] || 0) + b[k];
  for (const k in o) if (Math.abs(o[k]) < 1e-9) delete o[k];
  return o;
}
function supExp(e) {
  const s = e < 0 ? '⁻' : '', a = Math.abs(e);
  if (Number.isInteger(a)) return a === 1 ? (s ? '⁻¹' : '') : s + supInt(a);
  return `${s + supInt(Math.round(a * 2))}ᐟ²`;
}
export function fmtUnit(u) {
  const pos = [], neg = [];
  for (const b in u) (u[b] > 0 ? pos : neg).push([b, u[b]]);
  if (!pos.length && !neg.length) return '';
  if (!pos.length) return neg.map(([b, e]) => b + supExp(e)).join('·');
  const num = pos.map(([b, e]) => b + supExp(e)).join('·');
  if (!neg.length) return num;
  const den = neg.map(([b, e]) => b + supExp(-e)).join('·');
  return `${num}/${neg.length > 1 ? `(${den})` : den}`;
}
export const tfUnit = (key, unit) => (key === 'ln' ? {} : powUnit(unit, TF[key].k));
export function axisLabel(key, v) {
  if (key === 'ln') return `ln(${v.sym} / ${fmtUnit(v.unit)})`;
  const u = fmtUnit(tfUnit(key, v.unit));
  return u ? `${tfSym(key, v.sym)} (${u})` : tfSym(key, v.sym);
}
/** Units of the slope, the intercept and y for the current axes, as plain text. */
export function lineUnits(datasetId, xT, yT) {
  const d = DATASETS[datasetId], yu = tfUnit(yT, d.y.unit);
  return { m: fmtUnit(mulUnit(yu, powUnit(tfUnit(xT, d.x.unit), -1))), b: fmtUnit(yu),
    sse: fmtUnit(powUnit(yu, 2)) };
}
const fracStr = (p) => ({ 0.5: '½', '-0.5': '−½', 1: '1', 2: '2', '-1': '−1', '-2': '−2' })[p] ?? fmt(p);

/* ── linearization ── */

/**
 * What slope m and intercept b mean on these axes, or null when the axes don't make the model a
 * straight line. { slope, intercept, values: [[name, value, unit]], truth: [[name, value, unit]] }
 */
export function interpret(datasetId, xT, yT, m, b) {
  const md = DATASETS[datasetId].model;
  const out = (r) => ({ ...r, truth: md.truth });
  if (md.kind === 'powerConst') {
    if (yT !== 'id' || xT === 'ln' || TF[xT].k !== md.p) return null;
    return out({ slope: md.Aname, intercept: md.Bname,
      values: [['A', m, md.truth[0][2]], ['B', b, md.truth[1][2]]] });
  }
  if (xT === 'ln' && yT === 'ln') {
    return out({ slope: `${fracStr(md.p)} (the power)`, intercept: `ln(${md.Cexpr})`, values: md.quantities(Math.exp(b)) });
  }
  if (xT === 'ln' || yT === 'ln') return null;
  const a = TF[xT].k, c = TF[yT].k;
  if (Math.abs(a - md.p * c) > 1e-9) return null;
  return out({ slope: c === 1 ? md.Cexpr : `(${md.Cexpr})${supExp(c)}`, intercept: '0',
    values: m > 0 ? md.quantities(m ** (1 / c)) : md.quantities(NaN) });
}

/** The least-squares line: the OLS fit, or the best line through the origin when locked. */
export const bestLine = (S, locked) => (locked ? { m: S.m0, b: 0 } : { m: S.mS, b: S.bS });

/* ── the (m, b) parameter plane ── */

/** Point on the SSE contour SSEmin + dL, at angle t around the bowl. */
export function ellPoint(S, dL, t) {
  const r1 = Math.sqrt(dL / S.l1) * Math.cos(t), r2 = Math.sqrt(dL / Math.max(S.l2, 1e-300)) * Math.sin(t);
  return [S.mS + r1 * S.cs - r2 * S.sn, S.bS + r1 * S.sn + r2 * S.cs];
}

/** Coarse window: the R² = 0 contour (through m = 0, b = ȳ) fills the frame; origin and m0 in view. */
export function coarseRange(S) {
  const dL = Math.max(S.SST - S.SSEmin, S.SST * 1e-6);
  const hm = 1.3 * Math.sqrt(dL * S.n / S.det), hb = 1.3 * Math.sqrt(dL * S.Sxx / S.det);
  let m0 = S.mS - hm, m1 = S.mS + hm, b0 = S.bS - hb, b1 = S.bS + hb;
  const pad = 0.06 * (b1 - b0);
  b0 = Math.min(b0, -pad); b1 = Math.max(b1, pad);
  const mp = 0.06 * (m1 - m0);
  m0 = Math.min(m0, S.m0 - mp); m1 = Math.max(m1, S.m0 + mp);
  return { m0, m1, b0, b1 };
}

function clipHalf(poly, a, c, d) { // keep a·m + c·b ≤ d
  const out = [], f = (q) => a * q[0] + c * q[1] - d;
  poly.forEach((P, i) => {
    const Q = poly[(i + 1) % poly.length], fp = f(P), fq = f(Q);
    if (fp <= 0) out.push(P);
    if ((fp <= 0) !== (fq <= 0)) { const t = fp / (fp - fq); out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]); }
  });
  return out;
}
/** Polygon of lines (m, b) through every error bar (|Y − mX − b| ≤ σ for all points), within an
 *  area three times the coarse window. Empty when no line passes through them all. */
export function feasible(pts, R) {
  const wm = R.m1 - R.m0, wb = R.b1 - R.b0;
  let poly = [[R.m0 - wm, R.b0 - wb], [R.m1 + wm, R.b0 - wb], [R.m1 + wm, R.b1 + wb], [R.m0 - wm, R.b1 + wb]];
  for (const p of pts) {
    poly = clipHalf(poly, p.X, 1, p.Y + p.sY);
    poly = clipHalf(poly, -p.X, -1, p.sY - p.Y);
    if (!poly.length) break;
  }
  return poly;
}
/** The same along b = 0: the slope interval [lo, hi], or null. */
export function feasibleM0(pts) {
  let lo = -Infinity, hi = Infinity;
  for (const p of pts) {
    if (p.X === 0) { if (Math.abs(p.Y) > p.sY) return null; continue; }
    const u = (p.Y - p.sY) / p.X, v = (p.Y + p.sY) / p.X;
    lo = Math.max(lo, Math.min(u, v)); hi = Math.min(hi, Math.max(u, v));
  }
  return lo <= hi ? [lo, hi] : null;
}

/** Fine window: zoomed onto the patch of lines through every error bar. Also returns the fine
 *  contour scale { D, base }. */
export function fineRange(S, pts, locked, coarse) {
  const D = pts.reduce((s, p) => s + p.sY * p.sY, 0); // SSE scale set by the error bars
  let cm = S.mS, cb = S.bS, hm = 1.5 * Math.sqrt(D * S.n / S.det), hb = 1.5 * Math.sqrt(D * S.Sxx / S.det);
  if (locked) {
    cm = S.m0; cb = 0;
    const iv = feasibleM0(pts);
    hm = iv ? 1.4 * Math.max(Math.abs(iv[0] - cm), Math.abs(iv[1] - cm)) : 1.5 * Math.sqrt(D / S.Sxx);
  } else {
    const poly = feasible(pts, coarse);
    if (poly.length) {
      hm = 1.6 * Math.max(...poly.map((q) => Math.abs(q[0] - cm)));
      hb = 1.6 * Math.max(...poly.map((q) => Math.abs(q[1] - cb)));
    }
  }
  return { m0: cm - hm, m1: cm + hm, b0: cb - hb, b1: cb + hb, D, base: S.SSE(cm, cb) - S.SSEmin };
}

/** The handle's random starting line, drawn from the dataset, seed and axes so a restore repeats it. */
export function startLine(datasetId, seed, xT, yT, locked, S, R) {
  const rng = mulberry32(1013 * (DATASET_IDS.indexOf(datasetId) + 1) + 7919 * seed
    + 97 * (TF_ORDER.indexOf(xT) * 6 + TF_ORDER.indexOf(yT)) + 31337);
  if (locked) return { m: R.m0 + (R.m1 - R.m0) * (0.1 + 0.8 * rng()), b: 0 };
  const dL = Math.max(S.SST - S.SSEmin, S.SST * 1e-6) * (0.35 + 0.5 * rng());
  const [m, b] = ellPoint(S, dL, 2 * PI * rng());
  return { m, b };
}

/** The raw data as CSV, for a spreadsheet. */
export function toCsv(datasetId, raw) {
  const d = DATASETS[datasetId], xu = fmtUnit(d.x.unit), yu = fmtUnit(d.y.unit);
  const sig = (v) => Number(v.toPrecision(4));
  return [`${d.x.sym} (${xu}),${d.y.sym} (${yu}),σ_${d.y.sym} (${yu})`,
    ...raw.map((p) => [p.x, sig(p.y), sig(p.sy)].join(','))].join('\n');
}

/** { name: value } implied by the least-squares fit of raw data on these axes, or null if not linear. */
export function impliedFromData(datasetId, raw, xT, yT, locked) {
  const { m, b } = bestLine(stats(transformPoints(raw, xT, yT)), locked);
  const r = interpret(datasetId, xT, yT, m, b);
  return r && Object.fromEntries(r.values.map(([name, v]) => [name, v]));
}
