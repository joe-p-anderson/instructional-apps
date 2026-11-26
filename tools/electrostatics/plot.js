// Plotly helpers shared by the electrostatics Modes: the square ±WINDOW conductor plot, the
// |E| heatmap, quiver arrows and the conductor boundary. Colours and font come from the theme
// (read from the element the plot lives in): the plot ground, grid, axes, text and font from
// the --fw-plot-* tokens, the marks from the named theme colours.

import { themeVars } from '../../framework/v1/ui-kit.js';
import { loadPlotly } from '../../framework/v1/vendor.js';
import { RADIUS, WINDOW, linspace } from './conductor.js';

export const Plotly = await loadPlotly();

/** The Tool's stylesheet, linked inside each instance's root so any page that mounts it is styled. */
export function toolStyles() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./electrostatics.css', import.meta.url).href;
  return link;
}

export const PLOT_CONFIG = { displayModeBar: false, scrollZoom: false, responsive: true };

const VARS = {
  blue: '--fw-blue', red: '--fw-red', yellow: '--fw-yellow', text: '--fw-text', muted: '--fw-text-muted',
  bg: '--fw-bg', border: '--fw-border',
  // From the plot tokens:
  surface: '--fw-plot-bg', grid: '--fw-plot-grid', borderDk: '--fw-plot-axis', dim: '--fw-plot-text',
  font: '--fw-plot-font', fontSize: '--fw-plot-font-size',
};

/** The plot's theme colours as seen from `el` (the v1 palette before it is in the page). */
export const plotColors = (el) => themeVars(el, VARS);

/** The square conductor plot with an |E| colour bar. */
export function conductorLayout(C, { cmax = 1e4, colorTitle = '|E| (V/m)' } = {}) {
  const axis = {
    range: [-WINDOW, WINDOW], gridcolor: C.grid, zerolinecolor: C.borderDk, zerolinewidth: 1.5,
    color: C.dim, fixedrange: true, autorange: false, dtick: 2, constrain: 'domain',
  };
  return {
    paper_bgcolor: C.surface,
    plot_bgcolor: C.surface,
    font: { family: C.font, size: parseFloat(C.fontSize), color: C.dim },
    xaxis: { ...axis, title: { text: 'x (cm)', standoff: 5, font: { size: 14 } }, scaleanchor: 'y', scaleratio: 1 },
    yaxis: { ...axis, title: { text: 'y (cm)', standoff: 5, font: { size: 14 } } },
    margin: { l: 50, r: 62, t: 12, b: 44 },
    showlegend: false,
    dragmode: false,
    coloraxis: {
      colorscale: [[0, '#FFFFFF'], [1, C.blue]], showscale: true, cmin: 0, cmax,
      colorbar: { title: { text: colorTitle, font: { size: parseFloat(C.fontSize) } }, thickness: 10, len: 0.75, x: 1.01 },
    },
  };
}

/** |E| heatmap from conductor.fieldGrid(). */
export function heatmapTrace(grid, zmax = 1e4) {
  return { type: 'heatmap', x: grid.xs, y: grid.xs, z: grid.z, coloraxis: 'coloraxis', hoverinfo: 'skip',
    zsmooth: 'fast', zmin: 0, zmax };
}

/** Quiver arrows from conductor.fieldGrid(). */
export function quiverTrace(grid, C) {
  return { x: grid.quiver.x, y: grid.quiver.y, mode: 'lines', line: { color: C.blue, width: 0.9 }, hoverinfo: 'skip' };
}

/** σ ring from conductor.sigmaRing(): red where σ is least, blue where it is most. */
export function sigmaTrace(ring, C) {
  return { x: ring.x, y: ring.y, mode: 'markers',
    marker: { color: ring.color, colorscale: [[0, C.red], [0.5, C.surface], [1, C.blue]], size: 7,
      line: { width: 0 }, cmin: -1, cmax: 1, showscale: false },
    hovertemplate: 'σ: %{marker.color:.3f}<extra></extra>' };
}

/** The conductor's edge as a dotted circle. */
export function boundaryTrace({ color = 'rgba(26,16,8,0.25)', dash = 'dot', width = 1 } = {}) {
  const t = linspace(0, 2 * Math.PI, 120);
  return { x: t.map((a) => RADIUS * Math.cos(a)), y: t.map((a) => RADIUS * Math.sin(a)), mode: 'lines',
    line: { color, width, dash }, hoverinfo: 'skip' };
}

/**
 * Wire a plot div up as a Display: keeps it sized to its box (it may be mounted into a hidden
 * tab), and gives toScreen(x, y) in cm and a PNG snapshot. Returns { display, fit, stop }.
 */
export function plotDisplay(plotDiv, { id, label }) {
  const fit = () => { if (plotDiv.offsetParent && plotDiv._fullLayout) Plotly.Plots.resize(plotDiv); };
  const observer = new ResizeObserver(fit);
  observer.observe(plotDiv);
  function toScreen(x, y) {
    const fl = plotDiv._fullLayout;
    if (!fl || !plotDiv.offsetParent || Math.abs(fl.width - plotDiv.clientWidth) >= 2) return null;
    const rect = plotDiv.getBoundingClientRect();
    return { x: rect.left + fl.xaxis._offset + fl.xaxis.d2p(x), y: rect.top + fl.yaxis._offset + fl.yaxis.d2p(y) };
  }
  const snapshot = () => {
    const size = Math.round(Math.min(plotDiv.clientWidth, plotDiv.clientHeight)) || 560;
    return Plotly.toImage(plotDiv, { format: 'png', width: size, height: size });
  };
  return { display: { id, label, snapshot, toScreen }, fit, stop: () => observer.disconnect() };
}
