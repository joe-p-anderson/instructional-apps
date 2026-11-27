// Phasors Tool: the Display plumbing both Modes share (DOM; the canvas drawing itself is
// ./draw.js). A Mode keeps its plot frames in a `frames` object, { [displayKey]: frame | null },
// null until that canvas is laid out.
//
//   screenMapper(cv, frames, key) -> toScreen(x, y)   the Display contract's toScreen: the client
//       position of plot point (x, y) on canvas cv, or null until it is laid out at its size
//   snapshotOf(cv, draw) -> async () => PNG data URL  redraws, then captures cv
//   paintSwatches(root, colors)       colours each .ph-swatch[data-color=key] in root with colors[key]
//   redrawOnResize(root, draw) -> disconnect()        redraws whenever root changes size
//   timeAxis(T) -> { xTitle, xFormat }                the time plot's t axis, in s, ms or µs by T
//   drawTimeCursor(ctx, f, t, colors, dots, r)        the time cursor at t: a line down the plot,
//       a marker on its top edge, and a dot for each { v, color } (each curve's value at t)
//   attachTimeCursor(time, cv, frames)                hooks ./time-controls.js' cursor handle to
//       the time plot (frames.time on canvas cv): it rides the plot's top edge at t

import { dot, line, niceStep } from './draw.js';
import { num, timeUnit } from './format.js';

export const screenMapper = (cv, frames, key) => (x, y) => {
  const f = frames[key];
  if (!f) return null;
  const r = cv.getBoundingClientRect();
  if (Math.abs(r.width - cv.width / (globalThis.devicePixelRatio || 1)) > 1) return null;
  return { x: r.left + f.X(x), y: r.top + f.Y(y) };
};

export const snapshotOf = (cv, draw) => async () => { draw(); return cv.toDataURL('image/png'); };

export function paintSwatches(root, colors) {
  for (const el of root.querySelectorAll('.ph-swatch')) el.style.background = colors[el.dataset.color];
}

export function redrawOnResize(root, draw) {
  const observer = new ResizeObserver(() => draw());
  observer.observe(root);
  return () => observer.disconnect();
}

export function timeAxis(T) {
  const { unit, scale: k } = timeUnit(T);
  const decimals = Math.max(0, -Math.floor(Math.log10(niceStep(2 * T * k, 4))));
  return { xTitle: `t (${unit})`, xFormat: (v) => num(v * k, decimals) };
}

export function drawTimeCursor(ctx, f, t, colors, dots = [], r = 5) {
  line(ctx, { x: f.X(t), y: f.rect.T }, { x: f.X(t), y: f.rect.B }, colors.ink, { width: 1.5 });
  dot(ctx, { x: f.X(t), y: f.rect.T }, colors.ink, 6);
  for (const d of dots) dot(ctx, { x: f.X(t), y: f.Y(d.v) }, d.color, r);
}

export function attachTimeCursor(time, cv, frames) {
  const toScreen = screenMapper(cv, frames, 'time');
  time.attachCursor(
    (t) => { const p = toScreen(t, 0); return p && { x: p.x, y: cv.getBoundingClientRect().top + frames.time.rect.T }; },
    (cx) => (frames.time ? frames.time.ix(cx - cv.getBoundingClientRect().left) : time.t()),
  );
}
