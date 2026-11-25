// One spacetime diagram panel as SVG markup. No DOM: drawPanel returns a string.

import { byId, convert, eventK, eventsOf, isSpacelike, rodInfo, toFrame, worldlinesOf, worldlineSegments } from './physics.js';
import { SYM, eqLine, eqRod, esc, fmt, other } from './format.js';

// v1 theme colours (theme.css): ink for K, blue for K′, orange for selection.
export const COLORS = { K: '#5C4F38', Kp: '#1B4F8A', paper: '#FAF8F2', sel: '#E8720C', bad: '#B81C1C' };
const FONT = "Georgia, 'Times New Roman', serif";

/** Clip the line q + s e, s in [s0, s1], to rectangle R. Returns [sa, sb] or null. */
function clip(q, e, s0, s1, R) {
  let a = s0, b = s1;
  for (const [p, d, lo, hi] of [[q[0], e[0], R.xmin, R.xmax], [q[1], e[1], R.tmin, R.tmax]]) {
    if (Math.abs(d) < 1e-12) { if (p < lo || p > hi) return null; continue; }
    let u1 = (lo - p) / d, u2 = (hi - p) / d;
    if (u1 > u2) [u1, u2] = [u2, u1];
    if (u1 > a) a = u1;
    if (u2 < b) b = u2;
    if (a > b) return null;
  }
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return [a, b];
}

function niceStep(s) {
  for (const x of [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500]) if (x * s >= 26) return x;
  return 1000;
}

/** Pixel scale and visible coordinate rectangle of a w × h panel showing view V. */
export function panelGeometry(V, w, h) {
  const s = Math.min(w, h) / V.span;
  return { w, h, s, R: { xmin: V.cx - w / 2 / s, xmax: V.cx + w / 2 / s, tmin: V.ct - h / 2 / s, tmax: V.ct + h / 2 / s } };
}

/**
 * SVG content (no outer <svg>) for frame P's panel of diagram D at w × h pixels.
 * ui: { sel, connectIds, tool, preview, primed } (selection, Join picks, active tool, drawing preview;
 * primed false leaves the K′ tick numbers off the K panel, keeping its K′ axes and their names).
 */
export function drawPanel(P, D, w, h, ui = {}) {
  const { sel = null, connectIds = [], tool = 'select', preview = null, primed = true } = ui;
  const v = D.v;
  const V = D.view;
  const { s, R } = panelGeometry(V, w, h);
  const X = (x) => w / 2 + (x - V.cx) * s, Y = (t) => h / 2 - (t - V.ct) * s, f = (n) => n.toFixed(1);
  const conv = (G, Q, p) => convert(G, Q, p, v);
  const inView = (px, py, m = 0) => px >= m && px <= w - m && py >= m && py <= h - m;
  const out = [];
  const seg = (q, e, s0, s1, attrs) => {
    const c = clip(q, e, s0, s1, R);
    if (!c) return null;
    const a = [q[0] + c[0] * e[0], q[1] + c[0] * e[1]], b = [q[0] + c[1] * e[0], q[1] + c[1] * e[1]];
    out.push(`<line x1="${f(X(a[0]))}" y1="${f(Y(a[1]))}" x2="${f(X(b[0]))}" y2="${f(Y(b[1]))}" ${attrs}/>`);
    return [a, b];
  };
  // Valid XML too (the PNG snapshot loads this as an SVG image): no attribute twice.
  const text = (x, y, str, attrs = '') => out.push(`<text x="${f(x)}" y="${f(y)}" font-family="${FONT}"${attrs.includes('font-size=') ? '' : ' font-size="13"'} paint-order="stroke" stroke="${COLORS.paper}" stroke-width="3" stroke-linejoin="round" ${attrs}>${esc(str)}</text>`);
  out.push(`<rect width="${w}" height="${h}" fill="${COLORS.paper}"/>`);
  out.push('<g pointer-events="none">');
  const step = niceStep(s), ls = step * s < 40 ? step * 2 : step;
  const order = [other(P), P];
  // Grid lines
  for (const G of order) {
    if (!D.grid[G]) continue;
    const cs = [[R.xmin, R.tmin], [R.xmax, R.tmin], [R.xmin, R.tmax], [R.xmax, R.tmax]].map((c) => conv(P, G, c));
    const ex = conv(G, P, [1, 0]), et = conv(G, P, [0, 1]);
    const attr = `stroke="${COLORS[G]}" stroke-opacity="${G === P ? 0.22 : 0.3}" stroke-width="1"`;
    let lo = Math.ceil(Math.min(...cs.map((c) => c[0])) / step), hi = Math.floor(Math.max(...cs.map((c) => c[0])) / step);
    if (hi - lo < 900) for (let n = lo; n <= hi; n++) if (n) seg(conv(G, P, [n * step, 0]), et, -Infinity, Infinity, attr);
    lo = Math.ceil(Math.min(...cs.map((c) => c[1])) / step); hi = Math.floor(Math.max(...cs.map((c) => c[1])) / step);
    if (hi - lo < 900) for (let n = lo; n <= hi; n++) if (n) seg(conv(G, P, [0, n * step]), ex, -Infinity, Infinity, attr);
  }
  // Axes, tick numbers and axis names (K′ tick numbers on the K panel only with primed readouts)
  for (const G of order) {
    if (G !== P && Math.abs(v) < 1e-9) continue; // frames coincide: one set of axes
    const col = COLORS[G], o = conv(G, P, [0, 0]);
    for (const [dir, name, isX] of [[conv(G, P, [1, 0]), SYM[G].x, true], [conv(G, P, [0, 1]), SYM[G].t, false]]) {
      const c = clip(o, dir, -Infinity, Infinity, R);
      if (!c) continue;
      seg(o, dir, -Infinity, Infinity, `stroke="${col}" stroke-width="${G === P ? 1.8 : 1.5}"`);
      const n0 = Math.ceil(c[0] / ls), n1 = Math.floor(c[1] / ls);
      if (n1 - n0 < 300 && (primed || G === P || G !== 'Kp')) {
        for (let n = n0; n <= n1; n++) {
          if (!n) continue;
          const p = [o[0] + n * ls * dir[0], o[1] + n * ls * dir[1]];
          const px = X(p[0]), py = Y(p[1]);
          if (!inView(px, py, 10)) continue;
          if (isX) text(px, py + 14, fmt(n * ls), `text-anchor="middle" fill="${col}" font-size="11"`);
          else text(px - 5, py + 4, fmt(n * ls), `text-anchor="end" fill="${col}" font-size="11"`);
        }
      }
      const end = [o[0] + c[1] * dir[0], o[1] + c[1] * dir[1]];
      let px = X(end[0]), py = Y(end[1]);
      const dx = dir[0] * s, dy = -dir[1] * s, len = Math.hypot(dx, dy);
      px -= dx / len * 16; py -= dy / len * 16;
      text(isX ? px : px + 9, isX ? py - 7 : py, name, `fill="${col}" font-size="17" font-style="italic" font-weight="600" text-anchor="${isX ? 'middle' : 'start'}"`);
    }
  }
  out.push('</g>');
  // Light cones
  for (const e of eventsOf(D)) {
    if (!e.cone) continue;
    const p = toFrame(P, eventK(e, v), v), L = V.span * 4;
    out.push(`<polygon points="${f(X(p[0]))},${f(Y(p[1]))} ${f(X(p[0] + L))},${f(Y(p[1] + L))} ${f(X(p[0] - L))},${f(Y(p[1] + L))}" fill="${e.color}" fill-opacity="0.07" pointer-events="none"/>`);
    out.push(`<polygon points="${f(X(p[0]))},${f(Y(p[1]))} ${f(X(p[0] + L))},${f(Y(p[1] - L))} ${f(X(p[0] - L))},${f(Y(p[1] - L))}" fill="${e.color}" fill-opacity="0.04" pointer-events="none"/>`);
    for (const d of [[1, 1], [-1, 1]]) seg(p, d, -Infinity, Infinity, `stroke="${e.color}" stroke-opacity="0.7" stroke-width="1.3" pointer-events="none"`);
  }
  const labels = [];
  // Rods
  for (const r of D.objs) {
    if (r.kind !== 'rod') continue;
    const info = rodInfo(r, D);
    const a = toFrame(P, info.A.pt, v), b = toFrame(P, info.B.pt, v);
    const ax = X(a[0]), ay = Y(a[1]), bx = X(b[0]), by = Y(b[1]);
    const L = `x1="${f(ax)}" y1="${f(ay)}" x2="${f(bx)}" y2="${f(by)}"`;
    if (r.id === sel) out.push(`<line ${L} stroke="${COLORS.sel}" stroke-opacity="0.35" stroke-width="10" stroke-linecap="round" pointer-events="none"/>`);
    out.push(`<line ${L} stroke="${r.color}" stroke-width="3" stroke-dasharray="0.1 6" stroke-linecap="round" pointer-events="none"/>`);
    out.push(`<line ${L} stroke="#000" stroke-opacity="0" stroke-width="14" pointer-events="stroke" data-id="${r.id}" data-role="rod"/>`);
    [[ax, ay], [bx, by]].forEach(([x, y], i) => out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="5" fill="${COLORS.paper}" stroke="${r.color}" stroke-width="2" data-id="${r.id}" data-role="rodend" data-i="${i}"/>`));
    let t = r.label;
    if (r.showEq) t += (t ? ': ' : '') + eqRod(P, r, info, v) + (P === r.frame ? `, L = ${fmt(info.LF)}` : '');
    if (t) labels.push([(ax + bx) / 2, (ay + by) / 2 - 10, t, r.color, 'middle']);
  }
  // Worldlines
  for (const w0 of worldlinesOf(D)) {
    const segs = worldlineSegments(w0, D);
    let top = null;
    segs.forEach((sg) => {
      const q = toFrame(P, sg.p, v), e = toFrame(P, sg.d, v);
      const c = clip(q, e, sg.s0, sg.s1, R);
      if (!c) return;
      const a = [q[0] + c[0] * e[0], q[1] + c[0] * e[1]], b = [q[0] + c[1] * e[0], q[1] + c[1] * e[1]];
      const L = `x1="${f(X(a[0]))}" y1="${f(Y(a[1]))}" x2="${f(X(b[0]))}" y2="${f(Y(b[1]))}"`;
      const bad = isSpacelike(e);
      if (w0.id === sel) out.push(`<line ${L} stroke="${COLORS.sel}" stroke-opacity="0.35" stroke-width="9" stroke-linecap="round" pointer-events="none"/>`);
      out.push(`<line ${L} stroke="${bad ? COLORS.bad : w0.color}" stroke-width="2.5" ${bad ? 'stroke-dasharray="6 4"' : ''} stroke-linecap="round" pointer-events="none"/>`);
      out.push(`<line ${L} stroke="#000" stroke-opacity="0" stroke-width="14" pointer-events="stroke" data-id="${w0.id}" data-role="wl"/>`);
      const up = e[1] >= 0 ? b : a, dn = e[1] >= 0 ? a : b;
      const lp = [dn[0] + 0.85 * (up[0] - dn[0]), dn[1] + 0.85 * (up[1] - dn[1])];
      if (!top || lp[1] > top[1]) top = lp;
      if (w0.showEq && w0.mode === 'chain' && segs.length > 1) {
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        labels.push([X(m[0]) + 8, Y(m[1]), eqLine(P, sg.p, sg.d, v), w0.color, 'start']);
      }
    });
    if (top) {
      let t = w0.label;
      if (w0.showEq && !(w0.mode === 'chain' && segs.length > 1) && segs.length) t += (t ? ': ' : '') + eqLine(P, segs[0].p, segs[0].d, v);
      if (t) labels.push([X(top[0]) + 8, Y(top[1]), t, w0.color, 'start']);
    }
  }
  // Events
  for (const e of eventsOf(D)) {
    const p = toFrame(P, eventK(e, v), v), px = X(p[0]), py = Y(p[1]);
    if (e.id === sel) out.push(`<circle cx="${f(px)}" cy="${f(py)}" r="11" fill="${COLORS.sel}" fill-opacity="0.35" pointer-events="none"/>`);
    if (connectIds.includes(e.id)) out.push(`<circle cx="${f(px)}" cy="${f(py)}" r="10" fill="none" stroke="${COLORS.sel}" stroke-width="2.5" pointer-events="none"/>`);
    out.push(`<circle cx="${f(px)}" cy="${f(py)}" r="6.5" fill="${e.color}" stroke="${COLORS.paper}" stroke-width="1.5" data-id="${e.id}" data-role="event"/>`);
    let t = e.label;
    if (e.showCoords) t += ` (${fmt(p[0])}, ${fmt(p[1])})`;
    if (t.trim()) labels.push([px + 9, py - 9, t.trim(), e.color, 'start']);
  }
  // Join-tool polyline
  if (tool === 'connect' && connectIds.length > 1) {
    const pts = connectIds.map((id) => byId(D, id)).filter(Boolean)
      .map((e) => { const p = toFrame(P, eventK(e, v), v); return `${f(X(p[0]))},${f(Y(p[1]))}`; }).join(' ');
    out.push(`<polyline points="${pts}" fill="none" stroke="${COLORS.sel}" stroke-width="2" stroke-dasharray="5 4" pointer-events="none"/>`);
  }
  // Drawing preview
  if (preview) {
    const a = conv(preview.P, P, preview.a), b = conv(preview.P, P, preview.b);
    if (preview.type === 'wl') {
      const d = [b[0] - a[0], b[1] - a[1]];
      if (Math.hypot(...d) > 1e-9) seg(a, d, -Infinity, Infinity, `stroke="${COLORS.sel}" stroke-width="2" stroke-dasharray="6 4" pointer-events="none"`);
    } else {
      out.push(`<line x1="${f(X(a[0]))}" y1="${f(Y(a[1]))}" x2="${f(X(b[0]))}" y2="${f(Y(b[1]))}" stroke="${COLORS.sel}" stroke-width="3" stroke-dasharray="0.1 6" stroke-linecap="round" pointer-events="none"/>`);
    }
  }
  for (const [x, y, t, c, anchor] of labels) {
    const cx = Math.max(4, Math.min(w - 4, x)), cy = Math.max(14, Math.min(h - 6, y));
    text(cx, cy, t, `fill="${c}" font-weight="600" text-anchor="${anchor === 'start' && cx > w - 60 ? 'end' : anchor}" pointer-events="none"`);
  }
  return out.join('');
}
