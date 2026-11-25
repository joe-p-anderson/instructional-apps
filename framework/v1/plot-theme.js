// Plot tokens: the --fw-plot-* custom properties in theme.css, read at runtime so a Tool's
// plots follow the theme instead of hard-coding a palette or font. No DOM needed at import;
// call plotTheme() once theme.css has loaded (module scripts run after the page's stylesheets).

// The shape plotTheme() returns, with each value's token in its place.
const TOKENS = {
  background: '--fw-plot-bg',
  grid: '--fw-plot-grid',
  axis: '--fw-plot-axis',      // zero lines, outlines of locked marks
  text: '--fw-plot-text',      // tick labels and axis titles
  ink: '--fw-plot-ink',        // outlines of operable marks
  muted: '--fw-plot-muted',    // fill of locked marks
  traces: ['--fw-plot-trace-1', '--fw-plot-trace-2', '--fw-plot-trace-3'],
  font: { family: '--fw-plot-font', size: '--fw-plot-font-size' },
};

/**
 * The theme's plot palette and font:
 * { background, grid, axis, text, ink, muted, traces: [c1, c2, c3], font: { family, size } }
 * (size in px). `source` is an element (default: the root element) or a computed style.
 * Throws, naming the token, if theme.css isn't loaded.
 */
export function plotTheme(source = globalThis.document?.documentElement) {
  const style = typeof source?.getPropertyValue === 'function' ? source : getComputedStyle(source);
  const read = (token) => {
    if (Array.isArray(token)) return token.map(read);
    if (typeof token === 'object') return Object.fromEntries(Object.entries(token).map(([k, t]) => [k, read(t)]));
    const value = style.getPropertyValue(token).trim();
    if (!value) throw new Error(`Plot token ${token} is not set: is framework/v1/theme.css loaded?`);
    return value;
  };
  const theme = read(TOKENS);
  theme.font.size = parseFloat(theme.font.size);
  return theme;
}
