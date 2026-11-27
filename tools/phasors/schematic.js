// Phasors Tool, Circuit Mode: the schematic Display's drawing, the series loop with the source
// down the left side, R and L along the top and C down the right side.
//
//   drawSchematic(cv, { colors, include, values })  draws the loop on canvas cv (via prepCanvas)
//       and sets its accessible name; include lists the elements in the loop (e.g. ['R', 'C']),
//       values is { V0 (V), R (Ω), L (H), C (F) } in SI units. colors: the Mode's colour map
//       (ink, text, font, vin, R, L, C).
//   schematicName(include)  the accessible name, e.g. 'Series loop: the source, R and C'

import { prepCanvas } from './draw.js';
import { prefix } from './format.js';

const ELEMENTS = ['R', 'L', 'C'];

const valueText = (v, unit) => {
  const { prefix: p, scale } = prefix(v);
  return `${Number((v * scale).toPrecision(3))} ${p}${unit}`;
};

export function schematicName(include) {
  const els = ELEMENTS.filter((k) => include.includes(k));
  const list = els.length === 1 ? els[0] : `${els.slice(0, -1).join(', ')} and ${els[els.length - 1]}`;
  return `Series loop: the source, ${list}`;
}

const seg = (ctx, p, q) => { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); };

/** Element k's symbol on the wire from canvas point a to b, in k's colour. */
function drawSymbol(ctx, colors, k, a, b) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / len; const uy = (b.y - a.y) / len; // along the wire
  const nx = uy; const ny = -ux;                              // across it, outward from the loop
  const pt = (s, n) => ({ x: a.x + ux * s + nx * n, y: a.y + uy * s + ny * n });
  const body = Math.min(48, len - 12); const s0 = (len - body) / 2; const s1 = s0 + body;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 2;
  ctx.strokeStyle = colors.ink;
  if (k === 'C') { seg(ctx, a, pt(len / 2 - 4, 0)); seg(ctx, pt(len / 2 + 4, 0), b); } else { seg(ctx, a, pt(s0, 0)); seg(ctx, pt(s1, 0), b); }
  ctx.strokeStyle = colors[k]; ctx.lineWidth = 2.5;
  if (k === 'R') {
    ctx.beginPath(); ctx.moveTo(pt(s0, 0).x, pt(s0, 0).y);
    for (let i = 0; i < 6; i += 1) { const q = pt(s0 + (body * (i + 0.5)) / 6, i % 2 ? -7 : 7); ctx.lineTo(q.x, q.y); }
    ctx.lineTo(pt(s1, 0).x, pt(s1, 0).y); ctx.stroke();
  } else if (k === 'L') {
    const n = 4; const r = body / (2 * n);
    ctx.beginPath(); ctx.moveTo(pt(s0, 0).x, pt(s0, 0).y);
    for (let i = 0; i < n; i += 1) {
      for (let j = 1; j <= 12; j += 1) { // a half circle bulging outward
        const th = Math.PI - (Math.PI * j) / 12;
        const q = pt(s0 + r * (2 * i + 1) + r * Math.cos(th), r * Math.sin(th));
        ctx.lineTo(q.x, q.y);
      }
    }
    ctx.stroke();
  } else {
    ctx.lineWidth = 3;
    seg(ctx, pt(len / 2 - 4, -13), pt(len / 2 - 4, 13)); seg(ctx, pt(len / 2 + 4, -13), pt(len / 2 + 4, 13));
  }
  ctx.restore();
}

/** Lines of text centred on canvas point `at` vertically, aligned `align`. */
function textLines(ctx, colors, lines, at, align) {
  ctx.save();
  ctx.font = `${colors.font.size}px ${colors.font.family}`;
  ctx.fillStyle = colors.text; ctx.textAlign = align; ctx.textBaseline = 'middle';
  lines.forEach((t, i) => ctx.fillText(t, at.x, at.y + (i - (lines.length - 1) / 2) * 18));
  ctx.restore();
}

export function drawSchematic(cv, { colors, include, values }) {
  const { ctx, W, H } = prepCanvas(cv, colors);
  const has = (k) => include.includes(k);
  cv.setAttribute('aria-label', schematicName(include));
  const w = Math.min(W - 48, 360); const hgt = Math.max(60, Math.min(H - 76, 200));
  const L = (W - w) / 2; const R = L + w; const T = (H - hgt) / 2 + 16; const B = T + hgt;
  const cy = (T + B) / 2; const r = 16;
  const slots = { R: [{ x: L, y: T }, { x: L + w / 2, y: T }], L: [{ x: L + w / 2, y: T }, { x: R, y: T }],
    C: [{ x: R, y: T }, { x: R, y: B }] };
  ctx.save();
  ctx.strokeStyle = colors.ink; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (const k of ELEMENTS) { if (has(k)) drawSymbol(ctx, colors, k, ...slots[k]); else seg(ctx, ...slots[k]); }
  ctx.strokeStyle = colors.ink; ctx.lineWidth = 2;
  seg(ctx, { x: R, y: B }, { x: L, y: B });
  seg(ctx, { x: L, y: B }, { x: L, y: cy + r }); seg(ctx, { x: L, y: cy - r }, { x: L, y: T });
  // the source: a circle round a sine wave
  ctx.strokeStyle = colors.vin;
  ctx.beginPath(); ctx.arc(L, cy, r, 0, 2 * Math.PI); ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i <= 20; i += 1) {
    const x = L - 9 + (18 * i) / 20; const y = cy - 6 * Math.sin((2 * Math.PI * i) / 20);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
  textLines(ctx, colors, ['V₀', valueText(values.V0, 'V')], { x: L + r + 8, y: cy }, 'left');
  if (has('R')) textLines(ctx, colors, [`R = ${valueText(values.R, 'Ω')}`], { x: L + w / 4, y: T - 24 }, 'center');
  if (has('L')) textLines(ctx, colors, [`L = ${valueText(values.L, 'H')}`], { x: L + (3 * w) / 4, y: T - 24 }, 'center');
  if (has('C')) textLines(ctx, colors, ['C', valueText(values.C, 'F')], { x: R - 20, y: cy }, 'right');
}
