// gauss Mode of the electrostatics Tool: the old "Gauss' Law" tab of conductor_properties.
// A conductor carrying λ per unit length, with induced charges, in an applied field E₀. The
// student drags a circular Gaussian surface (its centre, and a handle on its edge that sets the
// radius) and reads the enclosed charge Q_enc = ε₀ ∮ E·n̂ dl as it moves through the bulk,
// across the edge and outside. The surface's ring is coloured by E·n̂.
//
// Setup: { lambda, E0x, E0y, xc, yc, r, handleAngle } (any subset; defaults below).
// State: lambda (nC/m), E0x, E0y (V/m), xc, yc, r, dist, outer, inner (cm), Qenc (nC/m).
// Controls: 'lambda' (slider), 'E0' (joystick, value { x, y }),
//           'center' (kit 2-D handle over the plot, value { x, y } cm, kept in the ±10 cm window),
//           'radius' (kit 1-D handle on the surface's edge, value r cm, 0.3 to 10).
//           Both are dragged, or focused and moved with the arrow keys (0.1 cm a step, 1 with Shift).
// Displays: 'gauss' (toScreen(x, y) in cm).

import { controlRegistry } from '../../../framework/v1/control.js';
import { createEmitter } from '../../../framework/v1/tool.js';
import { h, handle, metric, section, slider } from '../../../framework/v1/ui-kit.js';
import { WINDOW, clamp, fieldGrid, gaussField, gaussFlux, sigmaRing } from '../conductor.js';
import { plotlyMapping } from '../../../framework/v1/plot-map.js';
import { e0Joystick } from '../controls.js';
import { PLOT_CONFIG, Plotly, boundaryTrace, conductorLayout, heatmapTrace, plotDisplay, quiverTrace, sigmaTrace, plotColors, toolStyles } from '../plot.js';

export const id = 'gauss';
export const title = 'Gauss’s law';
// handleAngle is a Setup value but not State, so it is not a Setup key.
export const setupKeys = ['lambda', 'E0x', 'E0y', 'xc', 'yc', 'r'];

const DEFAULTS = { lambda: 1, E0x: 0, E0y: 0, xc: 0, yc: 0, r: 2, handleAngle: 0 };
const R_MIN = 0.3;  // smallest surface radius (cm)

const STATE_INFO = {
  lambda: { label: 'Linear charge density λ', unit: 'nC/m' },
  E0x: { label: 'Applied field E₀x', unit: 'V/m' },
  E0y: { label: 'Applied field E₀y', unit: 'V/m' },
  xc: { label: 'Surface centre x', unit: 'cm' },
  yc: { label: 'Surface centre y', unit: 'cm' },
  r: { label: 'Surface radius r', unit: 'cm' },
  dist: { label: 'Centre’s distance from the conductor’s centre', unit: 'cm' },
  outer: { label: 'Outer extent (distance + r)', unit: 'cm' },
  inner: { label: 'Inner extent (distance − r)', unit: 'cm' },
  Qenc: { label: 'Enclosed charge Q_enc', unit: 'nC/m' },
};

export function mount(container, setup = {}) {
  const p = { ...DEFAULTS, ...(setup || {}) };
  p.xc = clamp(Number(p.xc) || 0, -WINDOW, WINDOW);
  p.yc = clamp(Number(p.yc) || 0, -WINDOW, WINDOW);
  p.r = clamp(Number(p.r) || DEFAULTS.r, R_MIN, WINDOW);
  const changes = createEmitter();
  let gauss = null;
  let ready = false;

  const getState = () => {
    const dist = Math.hypot(p.xc, p.yc);
    return { lambda: p.lambda, E0x: p.E0x, E0y: p.E0y, xc: p.xc, yc: p.yc, r: p.r,
      dist, outer: dist + p.r, inner: dist - p.r, Qenc: gauss.Qenc + 0 };
  };

  // ── Controls ──
  // The surface handles' mapping to the plot (client pixels), once the plot is drawn.
  const plotDiv = h('div', { style: 'width:100%;height:100%;touch-action:none' });
  const { toScreen, fromScreen: toData } = plotlyMapping(plotDiv);
  const handleXY = () => [p.r * Math.cos(p.handleAngle) + p.xc, p.r * Math.sin(p.handleAngle) + p.yc];
  const cmAxis = (min, name) => ({ name, unit: 'cm', min, max: WINDOW, step: 0.1, coarse: 1, decimals: 1 });

  const controls = {
    lambda: slider({ id: 'lambda', name: 'λ', unit: 'nC/m', min: -1, max: 1, step: 0.05, value: p.lambda, reset: 1,
      decimals: 2, onChange: (v) => { p.lambda = v; update(); } }),
    E0: e0Joystick({ id: 'E0', name: 'E₀', value: { x: p.E0x, y: p.E0y },
      onChange: ({ x, y }) => { p.E0x = x; p.E0y = y; update(); } }),
    center: handle({ id: 'center', name: 'Gaussian surface centre', x: cmAxis(-WINDOW, 'x'), y: cmAxis(-WINDOW, 'y'),
      value: { x: p.xc, y: p.yc }, toScreen: ({ x, y }) => toScreen(x, y), fromScreen: toData,
      onChange: ({ x, y }) => { p.xc = x; p.yc = y; update(); },
      onLock: () => redraw(), onHide: () => redraw() }),
    // Dragging the edge handle also turns it to the pointer's side of the centre (handleAngle).
    radius: handle({ ...cmAxis(R_MIN), id: 'radius', name: 'Gaussian surface radius', value: p.r,
      toScreen: () => toScreen(...handleXY()),
      fromScreen: (cx, cy) => {
        const d = toData(cx, cy);
        if (!d) return NaN;
        p.handleAngle = Math.atan2(d.y - p.yc, d.x - p.xc);
        return Math.hypot(d.x - p.xc, d.y - p.yc);
      },
      onChange: (r) => { p.r = r; update(); },
      onLock: () => redraw(), onHide: () => redraw() }),
  };
  ({ x: p.E0x, y: p.E0y } = controls.E0.get()); // the joystick may have limited the Setup's E₀
  p.lambda = controls.lambda.get();

  const cm = (v) => `${v.toFixed(2)} cm`;
  const readouts = {
    Qenc: metric({ name: 'Q_enc', label: '<i>Q</i><sub>enc</sub>', format: (v) => `${v.toFixed(3)} nC/m` }),
    centre: metric({ name: 'Surface centre', label: 'Surface centre', format: ([x, y]) => `(${x.toFixed(1)}, ${y.toFixed(1)}) cm` }),
    r: metric({ name: 'Radius', label: 'Radius <i>r</i><sub>gs</sub>', format: cm }),
    dist: metric({ name: 'Distance', label: 'Centre distance <i>d</i>', format: cm }),
    outer: metric({ name: 'Outer extent', label: '<i>d</i> + <i>r</i>', format: cm }),
    inner: metric({ name: 'Inner extent', label: '<i>d</i> − <i>r</i>', format: cm }),
  };

  const swatch = (bg, border, extra = '') => h('span', { class: 'es-swatch', style: `background:${bg};border-color:${border};${extra}` });
  const root = h('div', { class: 'fw-tool es-tool', 'data-tool': 'electrostatics', 'data-mode': id },
    toolStyles(),
    h('aside', { class: 'fw-controls' },
      section('Parameters', controls.lambda.el),
      section('Applied field E₀', controls.E0.el),
      section('Enclosed charge', ...Object.values(readouts).map((r) => r.el)),
      section('Legend',
        h('div', { class: 'fw-legend-row' }, swatch('var(--fw-blue)', 'var(--fw-blue)'), h('span', { html: '<i>E</i> field arrows' })),
        h('div', { class: 'fw-legend-row' }, swatch('var(--fw-surface)', 'var(--fw-text)', 'border-radius:0'),
          h('span', {}, 'Gaussian surface (drag)')),
        h('div', { class: 'fw-hint', html: 'Fill: |<i>E</i>|  ·  Surface: <i>E</i>·n̂ (dark red inward, blue outward), limits ±|<i>E</i>|<sub>max</sub>' }),
        h('div', { class: 'fw-hint' }, 'Drag the centre ○ or the radius handle ○, or focus one and use the arrow keys'))),
    // The centre's handle comes last, so it is on top when a tiny surface puts the two together.
    h('div', { class: 'fw-displays' }, h('div', { class: 'fw-display es-square', style: 'position:relative' }, plotDiv,
      h('div', { class: 'fw-handle-layer' }, controls.radius.el, controls.center.el))));
  container.append(root);
  controls.E0.redraw();

  // ── Plot ──
  function traces() {
    const C = plotColors(root);
    gauss = gaussFlux({ lambda: p.lambda, E0x: p.E0x, E0y: p.E0y, xc: p.xc, yc: p.yc, r: p.r });
    const grid = fieldGrid(gaussField({ lambda: p.lambda, E0x: p.E0x, E0y: p.E0y }));
    const Emax = Math.max(grid.maxE, 1);
    const marker = (show, [x, y], ring, hovertemplate, locked) => ({
      x: show ? [x] : [], y: show ? [y] : [], mode: 'markers', hovertemplate,
      marker: { size: 10, color: C.surface, line: { color: locked ? C.border : ring, width: 2 } } });
    return [
      heatmapTrace(grid),
      quiverTrace(grid, C),
      boundaryTrace(),
      sigmaTrace(sigmaRing({ Q: p.lambda, E0x: p.E0x, E0y: p.E0y, induce: true }), C),
      { x: gauss.t.map((t) => p.r * Math.cos(t) + p.xc), y: gauss.t.map((t) => p.r * Math.sin(t) + p.yc),
        mode: 'markers', hovertemplate: 'E·n̂: %{marker.color:.1f} V/m<extra></extra>',
        marker: { color: gauss.flux, colorscale: [[0, '#8B1A1A'], [0.5, C.surface], [1, C.blue]], size: 8,
          line: { width: 0 }, cmin: -Emax, cmax: Emax, showscale: false } },
      marker(!controls.center.isHidden(), [p.xc, p.yc], C.text, 'Centre (%{x:.1f}, %{y:.1f})<extra></extra>',
        controls.center.isLocked()),
      marker(!controls.radius.isHidden(), handleXY(), C.yellow, 'Radius handle<extra></extra>',
        controls.radius.isLocked()),
    ];
  }

  function redraw() {
    const t = traces();
    if (ready) Plotly.react(plotDiv, t, conductorLayout(plotColors(root)), PLOT_CONFIG);
  }

  function update() {
    redraw();
    const s = getState();
    for (const [k, r] of Object.entries(readouts)) r.update(k === 'centre' ? [s.xc, s.yc] : s[k]);
    if (ready) placeHandles();
    changes.emit(s);
  }

  // The edge handle moves with the centre, so both are re-placed on every change and redraw.
  function placeHandles() { controls.center.place(); controls.radius.place(); }

  Plotly.newPlot(plotDiv, traces(), conductorLayout(plotColors(root)), PLOT_CONFIG);
  ready = true;
  const plot = plotDisplay(plotDiv, { id: 'gauss', label: 'Gauss’s law' });
  plotDiv.on('plotly_afterplot', placeHandles);

  update();

  return {
    state: {
      snapshot: getState,
      describe: () => structuredClone(STATE_INFO),
      onChange: (fn) => changes.on(fn),
    },
    controls: controlRegistry(controls),
    displays: [plot.display],
    serialize: () => ({ lambda: p.lambda, E0x: p.E0x, E0y: p.E0y, xc: p.xc, yc: p.yc, r: p.r, handleAngle: p.handleAngle }),
    restore(saved = {}) {
      if (Number.isFinite(saved.handleAngle)) p.handleAngle = saved.handleAngle;
      if (Number.isFinite(saved.lambda)) controls.lambda.set(saved.lambda);
      if (Number.isFinite(saved.E0x) || Number.isFinite(saved.E0y)) {
        controls.E0.set({ x: Number.isFinite(saved.E0x) ? saved.E0x : p.E0x, y: Number.isFinite(saved.E0y) ? saved.E0y : p.E0y });
      }
      if (Number.isFinite(saved.xc) || Number.isFinite(saved.yc)) {
        controls.center.set({ x: Number.isFinite(saved.xc) ? saved.xc : p.xc, y: Number.isFinite(saved.yc) ? saved.yc : p.yc });
      }
      if (Number.isFinite(saved.r)) controls.radius.set(saved.r);
      redraw();
      placeHandles();
    },
    resize: plot.fit,
    destroy() {
      controls.center.destroy();
      controls.radius.destroy();
      plot.stop();
      changes.clear();
      Plotly.purge(plotDiv);
      root.remove();
    },
  };
}
