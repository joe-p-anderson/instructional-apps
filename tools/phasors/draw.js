// Phasors Tool: canvas drawing shared by the Modes' Displays (the complex planes, the time plot).
// Everything is drawn in CSS px on a canvas scaled for the device pixel ratio, so text sizes are
// what they say (13 px and up, the plot-theme font size).
//
//   prepCanvas(cv, colors) -> { ctx, W, H, laidOut }  sizes the canvas to its box and clears it
//   plotFrame(ctx, rect, xr, yr, opts) -> frame       draws grid, ticks, zero axes and titles;
//       frame = { X(v), Y(v), ix(px), iy(px), rect } maps plot units ↔ canvas px.
//       opts: { colors, xTitle, yTitle, xFormat, yFormat, equal }  (equal: same px per unit on
//       both axes, the plot box shrunk and centred to fit the ranges, for a complex plane)
//   arrow(ctx, from, to, color, { width, dashed })   an arrow between canvas points
//   dot(ctx, at, color, r)                            a filled marker
//   curve(ctx, frame, x0, x1, fn, color, width)       y = fn(x) across [x0, x1]
//   label(ctx, text, at, color, colors, align)        text at a canvas point
//   sideLabel(ctx, text, a, b, away, color, colors)   text beside segment a → b, away from `away`
//   niceStep(span, ticks)                             a 1-2-5 tick step
//   line(ctx, from, to, color, { width, dashed })     a plain line between canvas points
//   angleArc(ctx, at, r, a0, a1, color, width)        an arc marking the angle a0 → a1 (degrees)

const PAD = { l: 54, r: 12, t: 12, b: 44 };

export function niceStep(span, ticks = 5) {
  const raw = span / Math.max(1, ticks);
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

const tickText = (v, step) => {
  const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const s = (Math.abs(v) < step * 1e-6 ? 0 : v).toFixed(d);
  return s.replace('-', '−');
};

export function prepCanvas(cv, colors) {
  const r = cv.getBoundingClientRect();
  const dpr = globalThis.devicePixelRatio || 1;
  const W = r.width || 480; const H = r.height || 360; // a fallback size while hidden, for snapshots
  const w = Math.round(W * dpr); const hgt = Math.round(H * dpr);
  if (cv.width !== w || cv.height !== hgt) { cv.width = w; cv.height = hgt; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, W, H);
  return { ctx, W, H, laidOut: r.width > 0 };
}

const fontOf = (colors) => `${colors.font.size}px ${colors.font.family}`;

export function plotFrame(ctx, rect, xr, yr, opts) {
  const { colors, xTitle, yTitle, xFormat, yFormat, equal = false } = opts;
  let L = rect.x + PAD.l; let R = rect.x + rect.w - PAD.r;
  let T = rect.y + PAD.t; let B = rect.y + rect.h - PAD.b;
  const [x0, x1] = xr; const [y0, y1] = yr;
  if (equal) { // same scale on both axes: shrink the plot box to the ranges' aspect, centred
    const k = Math.max((x1 - x0) / (R - L), (y1 - y0) / (B - T));
    const w = (x1 - x0) / k; const hgt = (y1 - y0) / k;
    L += (R - L - w) / 2; R = L + w;
    T += (B - T - hgt) / 2; B = T + hgt;
  }
  const X = (v) => L + ((v - x0) / (x1 - x0)) * (R - L);
  const Y = (v) => B - ((v - y0) / (y1 - y0)) * (B - T);
  const ix = (px) => x0 + ((px - L) / (R - L)) * (x1 - x0);
  const iy = (py) => y0 + ((B - py) / (B - T)) * (y1 - y0);

  const xs = niceStep(x1 - x0, Math.max(2, (R - L) / 80));
  const ys = niceStep(y1 - y0, Math.max(2, (B - T) / 50));
  ctx.lineWidth = 1;
  ctx.font = fontOf(colors);
  ctx.fillStyle = colors.text;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let v = Math.ceil(x0 / xs) * xs; v <= x1 + xs * 1e-9; v += xs) {
    ctx.strokeStyle = colors.grid; ctx.beginPath(); ctx.moveTo(X(v), T); ctx.lineTo(X(v), B); ctx.stroke();
    ctx.fillText(xFormat ? xFormat(v, xs) : tickText(v, xs), X(v), B + 5);
  }
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let v = Math.ceil(y0 / ys) * ys; v <= y1 + ys * 1e-9; v += ys) {
    ctx.strokeStyle = colors.grid; ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(R, Y(v)); ctx.stroke();
    ctx.fillText(yFormat ? yFormat(v, ys) : tickText(v, ys), L - 5, Y(v));
  }
  ctx.strokeStyle = colors.axis;
  if (x0 < 0 && x1 > 0) { ctx.beginPath(); ctx.moveTo(X(0), T); ctx.lineTo(X(0), B); ctx.stroke(); }
  if (y0 < 0 && y1 > 0) { ctx.beginPath(); ctx.moveTo(L, Y(0)); ctx.lineTo(R, Y(0)); ctx.stroke(); }
  ctx.strokeRect(L, T, R - L, B - T);

  ctx.fillStyle = colors.text;
  if (xTitle) { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(xTitle, (L + R) / 2, B + PAD.b - 2); }
  if (yTitle) {
    ctx.save();
    ctx.translate(L - PAD.l + 2, (T + B) / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(yTitle, 0, 0);
    ctx.restore();
  }
  return { X, Y, ix, iy, rect: { L, R, T, B } };
}

export function arrow(ctx, from, to, color, { width = 2.5, dashed = false, head = 11 } = {}) {
  const dx = to.x - from.x; const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;
  const ux = dx / len; const uy = dy / len;
  const h = Math.min(head, len * 0.6);
  const base = { x: to.x - ux * h, y: to.y - uy * h };
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  if (dashed) ctx.setLineDash([7, 5]);
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(base.x, base.y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(base.x - uy * h * 0.45, base.y + ux * h * 0.45);
  ctx.lineTo(base.x + uy * h * 0.45, base.y - ux * h * 0.45);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** A straight line between canvas points, solid or dashed. */
export function line(ctx, from, to, color, { width = 1.5, dashed = false } = {}) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  if (dashed) ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.restore();
}

/**
 * An arc of radius r (px) about canvas point `at`, from angle a0 to a1 (degrees, counter-clockwise
 * as on a complex plane), the shorter way round: it marks the angle between two phasors.
 */
export function angleArc(ctx, at, r, a0, a1, color, width = 1.5) {
  const d = ((((a1 - a0) % 360) + 540) % 360) - 180; // signed, in [−180, 180)
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(at.x, at.y, r, (-a0 * Math.PI) / 180, (-(a0 + d) * Math.PI) / 180, d > 0);
  ctx.stroke();
  ctx.restore();
}

export function dot(ctx, at, color, r = 5) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(at.x, at.y, r, 0, 2 * Math.PI); ctx.fill();
  ctx.restore();
}

export function curve(ctx, frame, x0, x1, fn, color, width = 2.5) {
  const { L, R, T, B } = frame.rect;
  const n = Math.max(2, Math.ceil(R - L));
  ctx.save();
  ctx.beginPath(); ctx.rect(L, T, R - L, B - T); ctx.clip();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= n; i += 1) {
    const x = x0 + ((x1 - x0) * i) / n;
    const px = frame.X(x); const py = frame.Y(fn(x));
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

export function label(ctx, text, at, color, colors, align = 'left') {
  ctx.save();
  ctx.font = `bold ${fontOf(colors)}`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(text, at.x, at.y);
  ctx.restore();
}

/**
 * Label the segment a → b (canvas points) beside its midpoint, on the side away from the
 * canvas point `away` (e.g. a triangle's third corner, so the label sits outside the triangle).
 */
export function sideLabel(ctx, text, a, b, away, color, colors, gap = 14) {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len; let ny = dx / len;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (away && (away.x - mid.x) * nx + (away.y - mid.y) * ny > 0) { nx = -nx; ny = -ny; }
  ctx.save();
  ctx.font = `bold ${fontOf(colors)}`;
  const half = ctx.measureText(text).width / 2;
  ctx.restore();
  // push further along the normal by the text's half-extent in that direction
  const reach = gap + Math.abs(nx) * half;
  label(ctx, text, { x: mid.x + nx * reach, y: mid.y + ny * reach }, color, colors, 'center');
}
