// Plot tokens: the --fw-plot-* custom properties in theme.css, as a plot-shaped palette and
// font so a Tool's plots follow the theme instead of hard-coding them. It reads them through
// themeVars (ui-kit.js), the one reader of theme variables for drawing, so it shares its
// fallback: the v1 palette for a token the page doesn't set, or while `el` is not in a page.

import { themeVars } from './ui-kit.js';

const TOKENS = {
  background: '--fw-plot-bg',
  grid: '--fw-plot-grid',
  axis: '--fw-plot-axis',      // zero lines, outlines of locked marks
  text: '--fw-plot-text',      // tick labels and axis titles
  ink: '--fw-plot-ink',        // outlines of operable marks
  muted: '--fw-plot-muted',    // fill of locked marks
  trace1: '--fw-plot-trace-1',
  trace2: '--fw-plot-trace-2',
  trace3: '--fw-plot-trace-3',
  family: '--fw-plot-font',
  size: '--fw-plot-font-size',
};

/**
 * The theme's plot palette and font as computed at `el` (default: the root element):
 * { background, grid, axis, text, ink, muted, traces: [c1, c2, c3], font: { family, size } }
 * (size in px).
 */
export function plotTheme(el = globalThis.document?.documentElement) {
  const { trace1, trace2, trace3, family, size, ...colors } = themeVars(el, TOKENS);
  return { ...colors, traces: [trace1, trace2, trace3], font: { family, size: parseFloat(size) } };
}
