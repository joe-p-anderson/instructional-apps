// Oscilloscope Tool (framework v1): a dual-trace scope showing
//   blue  Va·cos(2π f t)
//   red   Va·cos(2π f (t + Δt))
// Ported from Finished/oscilloscope_lab.html.
//
// Setup: { Va, f, Dt } (any subset; defaults below).
// State (state.snapshot()): Va (V), f (Hz), Dt (s), phi (rad), T (s), pkpk (V), ratio (Δt/T).
// Controls: sliders 'Va', 'f', 'Dt'; draggable plot markers 'Va-marker', 'f-marker', 'Dt-marker'.
// Displays: 'scope' (with toScreen(t, V): the client position of a plot point).

import { controlRegistry, createControl } from '../../framework/v1/control.js';
import { createEmitter, defineTool } from '../../framework/v1/tool.js';
import { h, metric, section, slider } from '../../framework/v1/ui-kit.js';
import { plotTheme } from '../../framework/v1/plot-theme.js';
import { loadPlotly } from '../../framework/v1/vendor.js';
import { cosWave, linspace, metrics } from './signal.js';

const Plotly = await loadPlotly();

const WINDOW = 10; // seconds of time axis shown
const DEFAULTS = { Va: 2, f: 0.5, Dt: 0.25 };
const RANGES = { Va: [0, 3], f: [0.1, 1], Dt: [-WINDOW, WINDOW] };
const TS = linspace(-0.1, WINDOW + 0.1, 300);
const GRAB_RADIUS = 18; // px

const STATE_INFO = {
  Va: { label: 'Amplitude Va', unit: 'V' },
  f: { label: 'Frequency f', unit: 'Hz' },
  Dt: { label: 'Time shift Δt', unit: 's' },
  phi: { label: 'Phase shift φ', unit: 'rad' },
  T: { label: 'Period T', unit: 's' },
  pkpk: { label: 'Peak-to-peak', unit: 'V' },
  ratio: { label: 'Δt / T', unit: '' },
};

// The plot palette, from the theme's plot tokens (read per mount, so it follows the page's theme).
function palette() {
  const t = plotTheme();
  return { blue: t.traces[0], red: t.traces[1], orange: t.traces[2], ink: t.ink, paper: t.background,
    dim: t.text, grid: t.grid, axis: t.axis, muted: t.muted, font: t.font };
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function layout(C) {
  const axis = { gridcolor: C.grid, zerolinecolor: C.axis, zerolinewidth: 1.5, color: C.dim, fixedrange: true };
  return {
    paper_bgcolor: C.paper,
    plot_bgcolor: C.paper,
    font: { family: C.font.family, size: C.font.size, color: C.dim },
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
  const C = palette();
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
  const root = h('div', { class: 'fw-tool', 'data-tool': 'oscilloscope' },
    h('aside', { class: 'fw-controls' },
      section('Parameters', sliders.Va.el, sliders.f.el, sliders.Dt.el,
        h('div', { class: 'fw-hint' }, '◯ Drag the dots on the plot to adjust Va, Δt and f.')),
      section('Live Metrics', ...Object.values(readouts).map((r) => r.el)),
      section('Legend',
        legendRow(C.blue, 'V<sub>a</sub> cos(2π f t)'),
        legendRow(C.red, 'V<sub>a</sub> cos(2π f (t + Δt))'))),
    h('div', { class: 'fw-displays' }, h('div', { class: 'fw-display' }, plotDiv)));
  container.append(root);

  // ── Draggable markers: Controls that live inside the Display ──
  const markerSpecs = {
    'Va-marker': { key: 'Va', label: 'Va marker', fill: C.blue,
      at: (s) => [0, s.Va], drag: (x, y) => ({ Va: clamp(y, ...RANGES.Va) }) },
    'Dt-marker': { key: 'Dt', label: 'Δt marker', fill: C.orange,
      at: (s) => [1 / s.f - s.Dt, s.Va], drag: (x) => ({ Dt: clamp(1 / signal.f - x, ...RANGES.Dt) }) },
    'f-marker': { key: 'f', label: 'f marker', fill: C.blue,
      at: (s) => [1 / s.f, 0], drag: (x) => ({ f: Math.round((1 / clamp(x, 1, WINDOW)) * 10) / 10 }) },
  };
  const markerIds = Object.keys(markerSpecs);
  const markers = {};
  for (const id of markerIds) {
    const spec = markerSpecs[id];
    markers[id] = createControl({
      id,
      label: spec.label,
      get: () => signal[spec.key],
      set: (v) => sliders[spec.key].set(v),
      onLock: redrawMarkers,
      onHide: redrawMarkers,
    });
  }

  const controls = { ...sliders, ...markers };

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
      marker: { color: locked ? C.muted : spec.fill, size: 11, line: { color: locked ? C.axis : C.ink, width: 2 } },
      hovertemplate: locked ? `${spec.label} (locked)<extra></extra>` : `Drag: ${spec.label}<extra></extra>`,
    };
  }

  function traces() {
    return [
      { x: TS, y: cosWave(TS, signal.Va, signal.f, 0), mode: 'lines', line: { color: C.blue, width: 2.5 }, hoverinfo: 'skip' },
      { x: TS, y: cosWave(TS, signal.Va, signal.f, signal.Dt), mode: 'lines', line: { color: C.red, width: 2.5 }, hoverinfo: 'skip' },
      ...markerIds.map(markerTrace),
    ];
  }

  function redraw() {
    if (!ready) return;
    Plotly.react(plotDiv, traces(), layout(C), { displayModeBar: false, scrollZoom: false, responsive: true });
  }
  function redrawMarkers() { redraw(); }

  function update() {
    const s = getState();
    for (const [k, r] of Object.entries(readouts)) r.update(s[k]);
    redraw();
    changes.emit(s);
  }

  Plotly.newPlot(plotDiv, traces(), layout(C), { displayModeBar: false, scrollZoom: false, responsive: true });
  ready = true;

  // Keep the plot sized to its box: it may be mounted into a hidden tab and shown later.
  const fit = () => { if (plotDiv.offsetParent) Plotly.Plots.resize(plotDiv); };
  const resizeObserver = new ResizeObserver(fit);
  resizeObserver.observe(plotDiv);

  // Dragging: grab the nearest operable marker, follow the pointer until release.
  function toData(evt) {
    const fl = plotDiv._fullLayout;
    const rect = plotDiv.getBoundingClientRect();
    return {
      px: evt.clientX - rect.left - fl._size.l,
      py: evt.clientY - rect.top - fl._size.t,
      xa: fl.xaxis,
      ya: fl.yaxis,
    };
  }
  // Display contract: client pixel position of the data point (x s, y V), once laid out.
  function toScreen(x, y) {
    const fl = plotDiv._fullLayout;
    if (!fl || Math.abs(fl.width - plotDiv.clientWidth) >= 2) return null;
    const rect = plotDiv.getBoundingClientRect();
    return { x: rect.left + fl._size.l + fl.xaxis.d2p(x), y: rect.top + fl._size.t + fl.yaxis.d2p(y) };
  }
  let dragging = null;
  function onPointerDown(evt) {
    if (!plotDiv._fullLayout) return;
    const { px, py, xa, ya } = toData(evt);
    dragging = markerIds.find((id) => {
      const c = markers[id];
      if (c.isLocked() || c.isHidden()) return false;
      const [x, y] = markerSpecs[id].at(signal);
      return Math.hypot(px - xa.d2p(x), py - ya.d2p(y)) < GRAB_RADIUS;
    }) || null;
    if (!dragging) return;
    evt.preventDefault();
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  }
  function onPointerMove(evt) {
    const c = dragging && markers[dragging];
    if (!c || c.isLocked()) return;
    evt.preventDefault();
    const { px, py, xa, ya } = toData(evt);
    const next = markerSpecs[dragging].drag(xa.p2d(px), ya.p2d(py));
    for (const [k, v] of Object.entries(next)) sliders[k].set(v);
  }
  function onPointerUp() {
    dragging = null;
    window.removeEventListener('pointermove', onPointerMove);
  }
  plotDiv.addEventListener('pointerdown', onPointerDown);

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
      onPointerUp();
      plotDiv.removeEventListener('pointerdown', onPointerDown);
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
  mount,
});
