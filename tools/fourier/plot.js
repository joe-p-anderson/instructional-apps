// Shared Plotly pieces for the Fourier Tool's Displays: the themed layout, the config, the
// trace and colour helpers, the fit-to-box behaviour for a plot that may be mounted into a
// hidden Mode tab, and the Tool's stylesheet link.

import { h } from '../../framework/v1/ui-kit.js';
import { loadPlotly } from '../../framework/v1/vendor.js';

export const Plotly = await loadPlotly();

export const PLOT_CONFIG = { displayModeBar: false, scrollZoom: false, responsive: true };

/** The Tool's stylesheet, linked inside each Mode's root so any page that mounts it is styled. */
export function toolStyles() {
  return h('link', { rel: 'stylesheet', href: new URL('./fourier.css', import.meta.url).href });
}

/** A line trace with no hover; `extra` adds or overrides trace fields. */
export const line = (name, x, y, style, extra = {}) => ({ name, x, y, mode: 'lines', line: style, hoverinfo: 'skip', ...extra });

/** A theme colour (#rgb, #rrggbb or rgb()) at the given opacity, as Plotly's fills need it. */
export function translucent(color, alpha) {
  const c = String(color).trim();
  let rgb = c.match(/^rgba?\(([^)]+)\)$/)?.[1].split(',').slice(0, 3).map(Number);
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((d) => d + d).join('') : hex;
    rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  }
  return rgb ? `rgba(${rgb.join(',')},${alpha})` : c;
}

/** A Plotly layout from the theme's plot tokens (plotTheme()), with titled axes. */
export function themedLayout(theme, { xTitle, yTitle, xRange, yRange, dtick }) {
  const axis = { gridcolor: theme.grid, zerolinecolor: theme.axis, zerolinewidth: 1.5, color: theme.text, fixedrange: true };
  return {
    paper_bgcolor: theme.background,
    plot_bgcolor: theme.background,
    font: { family: theme.font.family, size: theme.font.size, color: theme.text },
    xaxis: { ...axis, title: { text: xTitle, standoff: 8 }, range: xRange, dtick },
    yaxis: { ...axis, title: { text: yTitle, standoff: 8 }, range: yRange },
    margin: { l: 56, r: 12, t: 14, b: 48 },
    showlegend: false,
    dragmode: false,
  };
}

/**
 * Keep a plot sized to its box. Returns { fit, disconnect }: call fit() from the instance's
 * resize() (the host calls it when the Mode tab is shown) and disconnect() on destroy.
 */
export function fitToBox(plotDiv) {
  const fit = () => { if (plotDiv.offsetParent) Plotly.Plots.resize(plotDiv); };
  const observer = new ResizeObserver(fit);
  observer.observe(plotDiv);
  return { fit, disconnect: () => observer.disconnect() };
}
