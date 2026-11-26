// Plot mapping for Plotly Displays: the one place that reads Plotly's laid-out axes
// (`_fullLayout`, which Plotly does not document) to map between data coordinates and client
// pixels, so a Tool's handles, probes and markers follow the plot. Single x/y axis pair.

/**
 * plotlyMapping(plotDiv) -> { toScreen(x, y), fromScreen(cx, cy) }
 *   toScreen: client pixel { x, y } of the data point, or null until the plot is laid out, while
 *     it is hidden, or while its layout is stale (its box resized and not yet redrawn).
 *   fromScreen: data point { x, y } under the client pixel, or null until the plot is laid out.
 */
export function plotlyMapping(plotDiv) {
  function toScreen(x, y) {
    const fl = plotDiv._fullLayout;
    if (!fl || !plotDiv.offsetParent || Math.abs(fl.width - plotDiv.clientWidth) >= 2) return null;
    const rect = plotDiv.getBoundingClientRect();
    return { x: rect.left + fl.xaxis._offset + fl.xaxis.d2p(x), y: rect.top + fl.yaxis._offset + fl.yaxis.d2p(y) };
  }
  function fromScreen(cx, cy) {
    const fl = plotDiv._fullLayout;
    if (!fl) return null;
    const rect = plotDiv.getBoundingClientRect();
    return { x: fl.xaxis.p2d(cx - rect.left - fl.xaxis._offset), y: fl.yaxis.p2d(cy - rect.top - fl.yaxis._offset) };
  }
  return { toScreen, fromScreen };
}
