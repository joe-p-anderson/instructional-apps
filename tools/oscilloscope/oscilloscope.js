// Oscilloscope Tool (framework v1): a dual-trace scope showing
//   blue  Va·cos(2π f t)
//   red   Va·cos(2π f (t + Δt))
// Ported from Finished/oscilloscope_lab.html.
//
// Setup: { Va, f, Dt } (any subset; defaults below).
// State (state.snapshot()): Va (V), f (Hz), Dt (s), phi (rad), T (s), pkpk (V), ratio (Δt/T).
// Controls: sliders 'Va', 'f', 'Dt'; plot markers 'Va-marker', 'f-marker', 'Dt-marker' (kit handles:
//   dragged, or focused and moved with the arrow keys; Right/Left move the Δt and f markers right/left
//   on the plot, so they decrease/increase Δt and f); 'phi-readout' and 'ratio-readout', the Live
//   Metrics lines that print φ (read-only: they exist to be hidden, so a Task can ask for φ without
//   printing it).
// Displays: 'scope' (with toScreen(t, V): the client position of a plot point).

import { controlRegistry, createControl } from '../../framework/v1/control.js';
import { createEmitter, defineTool } from '../../framework/v1/tool.js';
import { h, handle, metric, section, slider } from '../../framework/v1/ui-kit.js';
import { plotTheme } from '../../framework/v1/plot-theme.js';
import { loadPlotly } from '../../framework/v1/vendor.js';
import { cosWave, linspace, metrics } from './signal.js';

const Plotly = await loadPlotly();

const WINDOW = 10; // seconds of time axis shown
const DEFAULTS = { Va: 2, f: 0.5, Dt: 0.25 };
const RANGES = { Va: [0, 3], f: [0.1, 1], Dt: [-WINDOW, WINDOW] };
const TS = linspace(-0.1, WINDOW + 0.1, 300);

const STATE_INFO = {
  Va: { label: 'Amplitude Va', unit: 'V' },
  f: { label: 'Frequency f', unit: 'Hz' },
  Dt: { label: 'Time shift Δt', unit: 's' },
  phi: { label: 'Phase shift φ', unit: 'rad' },
  T: { label: 'Period T', unit: 's' },
  pkpk: { label: 'Peak-to-peak', unit: 'V' },
  ratio: { label: 'Δt / T', unit: '' },
};

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

// Plotly layout from the theme's plot tokens (plotTheme()).
function layout(theme) {
  const axis = { gridcolor: theme.grid, zerolinecolor: theme.axis, zerolinewidth: 1.5, color: theme.text, fixedrange: true };
  return {
    paper_bgcolor: theme.background,
    plot_bgcolor: theme.background,
    font: { family: theme.font.family, size: theme.font.size, color: theme.text },
    xaxis: { ...axis, title: { text: 'Time (s)', standoff: 8 }, range: [0, WINDOW], dtick: 1 },
    yaxis: { ...axis, title: { text: 'Voltage (V)', standoff: 8 }, range: [-4, 4] },
    margin: { l: 56, r: 12, t: 14, b: 48 },
    showlegend: false,
    dragmode: false,
  };
}

function mount(container, modeId = 'dual-trace', setup = {}) {
  const start = { ...DEFAULTS, ...(setup || {}) };
  const signal = { Va: start.Va, f: start.f, Dt: start.Dt };
  const changes = createEmitter();
  const theme = plotTheme(); // read per mount, so the plot follows the page's theme
  let ready = false;

  // ── State ──
  function getState() {
    const m = metrics(signal);
    return { ...signal, phi: m.phi, T: m.T, pkpk: m.pkpk, ratio: signal.Dt / m.T };
  }

  // ── Controls column ──
  const onSignal = (key) => (v) => { signal[key] = v; update(); };
  const sliders = {
    Va: slider({ id: 'Va', name: 'Va', label: 'V<sub>a</sub>', unit: 'V', min: 0, max: 3, step: 0.01,
      value: signal.Va, onChange: onSignal('Va') }),
    f: slider({ id: 'f', name: 'f', label: 'f', unit: 'Hz', min: 0.1, max: 1, step: 0.01,
      value: signal.f, onChange: onSignal('f') }),
    Dt: slider({ id: 'Dt', name: 'Δt', label: 'Δt', unit: 's', min: -WINDOW, max: WINDOW, step: 0.01,
      value: signal.Dt, onChange: onSignal('Dt') }),
  };
  const fmt = (d, unit) => (v) => `${v.toFixed(d)}${unit ? ` ${unit}` : ''}`;
  const readouts = {
    phi: metric({ name: 'φ', label: 'φ', format: (v) => `${v.toFixed(4)} rad (${(v * 180 / Math.PI).toFixed(1)}°)` }),
    T: metric({ name: 'T', label: 'T', format: fmt(3, 's') }),
    pkpk: metric({ name: 'Pk-pk', label: 'Pk-to-Pk', format: fmt(2, 'V') }),
    ratio: metric({ name: 'Δt / T', label: 'Δt / T', format: fmt(4, '') }),
  };
  const legendRow = (color, html) => h('div', { class: 'fw-legend-row' },
    h('span', { class: 'fw-legend-line', style: `background:${color}` }), h('span', { html }));

  const plotDiv = h('div', { style: 'width:100%;height:100%' });
  const handleLayer = h('div', { class: 'fw-handle-layer' });
  const root = h('div', { class: 'fw-tool', 'data-tool': 'oscilloscope' },
    h('aside', { class: 'fw-controls' },
      section('Parameters', sliders.Va.el, sliders.f.el, sliders.Dt.el,
        h('div', { class: 'fw-hint' }, '◯ Drag the dots on the plot, or focus one and use the arrow keys, to adjust Va, Δt and f.')),
      section('Live Metrics', ...Object.values(readouts).map((r) => r.el)),
      section('Legend',
        legendRow(theme.traces[0], 'V<sub>a</sub> cos(2π f t)'),
        legendRow(theme.traces[1], 'V<sub>a</sub> cos(2π f (t + Δt))'))),
    h('div', { class: 'fw-displays' }, h('div', { class: 'fw-display', style: 'position:relative' }, plotDiv, handleLayer)));
  container.append(root);

  // ── Plot markers: kit handles over the Display (the plot draws the dots beneath them) ──
  const at = (x, y) => toScreen(x, y);
  const pointer = (cx, cy) => {
    const fl = plotDiv._fullLayout;
    const rect = plotDiv.getBoundingClientRect();
    return { x: fl.xaxis.p2d(cx - rect.left - fl._size.l), y: fl.yaxis.p2d(cy - rect.top - fl._size.t) };
  };
  const markerSpecs = {
    'Va-marker': { key: 'Va', label: 'Va marker', fill: theme.traces[0], unit: 'V', reversed: false,
      at: (s) => [0, s.Va], toScreen: (v) => at(0, v), fromScreen: (cx, cy) => pointer(cx, cy).y },
    'Dt-marker': { key: 'Dt', label: 'Δt marker', fill: theme.traces[2], unit: 's', reversed: true,
      at: (s) => [1 / s.f - s.Dt, s.Va], toScreen: (v) => at(1 / signal.f - v, signal.Va),
      fromScreen: (cx, cy) => 1 / signal.f - pointer(cx, cy).x },
    'f-marker': { key: 'f', label: 'f marker', fill: theme.traces[0], unit: 'Hz', reversed: true,
      at: (s) => [1 / s.f, 0], toScreen: (v) => at(1 / v, 0),
      fromScreen: (cx, cy) => Math.round((1 / clamp(pointer(cx, cy).x, 1, WINDOW)) * 10) / 10 },
  };
  const markerIds = Object.keys(markerSpecs);
  const markers = {};
  for (const id of markerIds) {
    const spec = markerSpecs[id];
    const [min, max] = RANGES[spec.key];
    markers[id] = handle({
      id, name: spec.label, unit: spec.unit, min, max, step: 0.01, coarse: 0.1, decimals: 2,
      reversed: spec.reversed, value: signal[spec.key],
      toScreen: spec.toScreen, fromScreen: spec.fromScreen,
      onChange: (v) => sliders[spec.key].set(v),
      onLock: redrawMarkers,
      onHide: redrawMarkers,
    });
    handleLayer.append(markers[id].el);
  }

  // The readouts that print φ (φ itself, and Δt / T = φ / 2π) are registered as Controls too,
  // only so an Activity can hide them while a Task asks the student to set φ.
  const phiReadouts = {
    'phi-readout': createControl({ id: 'phi-readout', label: 'φ readout', el: readouts.phi.el, get: () => getState().phi }),
    'ratio-readout': createControl({ id: 'ratio-readout', label: 'Δt / T readout', el: readouts.ratio.el, get: () => getState().ratio }),
  };

  const controls = { ...sliders, ...markers, ...phiReadouts };

  // ── Plot ──
  function markerTrace(id) {
    const spec = markerSpecs[id];
    const c = markers[id];
    const [x, y] = spec.at(signal);
    const locked = c.isLocked();
    return {
      x: c.isHidden() ? [] : [x],
      y: c.isHidden() ? [] : [y],
      mode: 'markers',
      marker: { color: locked ? theme.muted : spec.fill, size: 11, line: { color: locked ? theme.axis : theme.ink, width: 2 } },
      hoverinfo: 'skip',
    };
  }

  function traces() {
    return [
      { x: TS, y: cosWave(TS, signal.Va, signal.f, 0), mode: 'lines', line: { color: theme.traces[0], width: 2.5 }, hoverinfo: 'skip' },
      { x: TS, y: cosWave(TS, signal.Va, signal.f, signal.Dt), mode: 'lines', line: { color: theme.traces[1], width: 2.5 }, hoverinfo: 'skip' },
      ...markerIds.map(markerTrace),
    ];
  }

  function redraw() {
    if (!ready) return;
    Plotly.react(plotDiv, traces(), layout(theme), { displayModeBar: false, scrollZoom: false, responsive: true })
      .then(placeMarkers);
    placeMarkers();
  }
  function placeMarkers() { for (const id of markerIds) markers[id].place(); }
  function redrawMarkers() { redraw(); }

  function update() {
    const s = getState();
    for (const [k, r] of Object.entries(readouts)) r.update(s[k]);
    for (const id of markerIds) markers[id].update(signal[markerSpecs[id].key]);
    redraw();
    changes.emit(s);
  }

  Plotly.newPlot(plotDiv, traces(), layout(theme), { displayModeBar: false, scrollZoom: false, responsive: true })
    .then(placeMarkers);
  ready = true;

  // Keep the plot sized to its box: it may be mounted into a hidden tab and shown later.
  const fit = () => { if (plotDiv.offsetParent) Plotly.Plots.resize(plotDiv).then(placeMarkers); };
  const resizeObserver = new ResizeObserver(fit);
  resizeObserver.observe(plotDiv);

  // Display contract: client pixel position of the data point (x s, y V), once laid out.
  function toScreen(x, y) {
    const fl = plotDiv._fullLayout;
    if (!fl || Math.abs(fl.width - plotDiv.clientWidth) >= 2) return null;
    const rect = plotDiv.getBoundingClientRect();
    return { x: rect.left + fl._size.l + fl.xaxis.d2p(x), y: rect.top + fl._size.t + fl.yaxis.d2p(y) };
  }
  update();

  return {
    state: {
      snapshot: getState,
      describe: () => structuredClone(STATE_INFO),
      onChange: (fn) => changes.on(fn),
    },
    controls: controlRegistry(controls),
    displays: [{
      id: 'scope',
      label: 'Oscilloscope',
      snapshot: () => Plotly.toImage(plotDiv, { format: 'png', width: 620, height: 300 }),
      toScreen,
    }],
    serialize: () => ({ Va: signal.Va, f: signal.f, Dt: signal.Dt }),
    restore(saved = {}) {
      for (const k of ['Va', 'f', 'Dt']) if (Number.isFinite(saved[k])) sliders[k].set(saved[k]);
    },
    resize: fit,
    destroy() {
      resizeObserver.disconnect();
      for (const id of markerIds) markers[id].destroy();
      changes.clear();
      Plotly.purge(plotDiv);
      root.remove();
    },
  };
}

export default defineTool({
  id: 'oscilloscope',
  title: 'Oscilloscope',
  modes: [{ id: 'dual-trace', title: 'Dual-trace scope' }],
  layout: 'side',
  mount,
});
