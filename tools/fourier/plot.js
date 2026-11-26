// Shared Plotly pieces for the Fourier Tool's Displays: the themed layout, the config, and the
// fit-to-box behaviour for a plot that may be mounted into a hidden Mode tab.

import { loadPlotly } from '../../framework/v1/vendor.js';

export const Plotly = await loadPlotly();

export const PLOT_CONFIG = { displayModeBar: false, scrollZoom: false, responsive: true };

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
