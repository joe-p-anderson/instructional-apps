// Number and equation formatting for the spacetime Tool. No DOM.

import { toFrame } from './physics.js';

/** Coordinate symbols and tags per frame. */
export const SYM = { K: { x: 'x', t: 't', tag: 'K' }, Kp: { x: 'x′', t: 't′', tag: 'K′' } };
export const FRAMES = ['K', 'Kp'];
export const other = (F) => (F === 'K' ? 'Kp' : 'K');

/** A readout: up to dp decimals, trailing zeros dropped, a real minus sign; '—' if not finite. */
export function fmt(n, dp = 2) {
  if (!Number.isFinite(n)) return '—';
  let s = n.toFixed(dp);
  if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  if (s === '-0') s = '0';
  return s.replace('-', '−');
}

/** A value for an input box (plain ASCII, up to 4 decimals). */
export function fmtIn(n) {
  if (!Number.isFinite(n)) return '';
  let s = String(+n.toFixed(4));
  if (s === '-0') s = '0';
  return s;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** A typed number: '0.6', '-2', '−2', '3/5', '1e-3'. NaN if it is not one. */
export function parseNum(str) {
  if (typeof str !== 'string') return NaN;
  const s = str.trim().replace(/−/g, '-');
  if (!s) return NaN;
  const m = s.match(/^(-?\d*\.?\d+)\s*\/\s*(-?\d*\.?\d+)$/);
  if (m) return (+m[1]) / (+m[2]);
  return /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(s) ? +s : NaN;
}

/** 'lhs = m v + b', tidied. */
function linear(lhs, m, v, b) {
  let term = '';
  if (Math.abs(m) >= 0.005) term = Math.abs(m - 1) < 0.005 ? v : Math.abs(m + 1) < 0.005 ? '−' + v : fmt(m) + v;
  if (!term) return `${lhs} = ${fmt(b)}`;
  if (Math.abs(b) < 0.005) return `${lhs} = ${term}`;
  return `${lhs} = ${term} ${b > 0 ? '+' : '−'} ${fmt(Math.abs(b))}`;
}

/** Equation in frame P of the line through K point p with K direction d. */
export function eqLine(P, p, d, v) {
  const q = toFrame(P, p, v), e = toFrame(P, d, v);
  if (Math.abs(e[1]) < 1e-12) return `${SYM[P].t} = ${fmt(q[1])}`;
  const u = e[0] / e[1];
  return linear(SYM[P].x, u, SYM[P].t, q[0] - u * q[1]);
}

/** Equation in frame P of rod r (info from rodInfo). */
export function eqRod(P, r, info, v) {
  if (P === r.frame) return `${SYM[P].t} = ${fmt(r.T)}`;
  const a = toFrame(P, info.A.pt, v), b = toFrame(P, info.B.pt, v);
  if (Math.abs(b[0] - a[0]) < 1e-9) return `${SYM[P].t} = ${fmt(a[1])}`;
  const m = (b[1] - a[1]) / (b[0] - a[0]);
  return linear(SYM[P].t, m, SYM[P].x, a[1] - m * a[0]);
}
