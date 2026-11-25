// Plot tokens: the --fw-plot-* custom properties in theme.css, read at runtime so a Tool's
// plots follow the theme instead of hard-coding a palette or font. No DOM needed at import;
// call plotTheme() once theme.css has loaded (module scripts run after the page's stylesheets).

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
  fontFamily: '--fw-plot-font',
  fontSize: '--fw-plot-font-size',
};

/**
 * The theme's plot palette and font:
 * { background, grid, axis, text, ink, muted, traces: [c1, c2, c3], font: { family, size } }
 * (size in px). `source` is an element (default: the root element) or a computed style.
 * Throws, naming the token, if theme.css isn't loaded.
 */
export function plotTheme(source = globalThis.document?.documentElement) {
  const style = typeof source?.getPropertyValue === 'function' ? source : getComputedStyle(source);
  const v = {};
  for (const [key, name] of Object.entries(TOKENS)) {
    v[key] = style.getPropertyValue(name).trim();
    if (!v[key]) throw new Error(`Plot token ${name} is not set: is framework/v1/theme.css loaded?`);
  }
  return {
    background: v.background,
    grid: v.grid,
    axis: v.axis,
    text: v.text,
    ink: v.ink,
    muted: v.muted,
    traces: [v.trace1, v.trace2, v.trace3],
    font: { family: v.fontFamily, size: parseFloat(v.fontSize) },
  };
}
