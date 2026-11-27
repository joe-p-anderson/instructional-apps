// electric-field Mode of the electrostatics Tool: the old "Electric Fields" tab of
// conductor_properties. A charged conductor in an applied field E₀, with the |E| heatmap,
// quiver arrows, the σ ring and the animated e⁻/p⁺ overlay.
//
// Setup: { Q, E0x, E0y, theta, induce, showCharges } (any subset; defaults below).
// State: Q (nC), E0x, E0y, E0mag (V/m), E0angle (°), theta (rad), induce, showCharges, Emax (V/m).
// Controls: 'Q' (slider), 'theta' (arc picker), 'E0' (joystick, value { x, y }),
//           'induce', 'showCharges' (toggles).
// Displays: 'field' (toScreen(x, y) in cm).

import { controlRegistry } from '../../../framework/v1/control.js';
import { createEmitter } from '../../../framework/v1/tool.js';
import { h, metric, section, slider, toggle } from '../../../framework/v1/ui-kit.js';
import { createChargeOverlay, fieldGrid, polarE0, sigmaRing } from '../conductor.js';
import { arcPicker, e0Joystick } from '../controls.js';
import { PLOT_CONFIG, Plotly, conductorLayout, heatmapTrace, plotDisplay, quiverTrace, sigmaTrace, plotColors, toolStyles } from '../plot.js';

export const id = 'electric-field';
export const title = 'Electric field';
export const setupKeys = ['Q', 'E0x', 'E0y', 'theta', 'induce', 'showCharges'];

const DEFAULTS = { Q: 0, E0x: 0, E0y: 0, theta: 0, induce: false, showCharges: true };

const STATE_INFO = {
  Q: { label: 'Charge Q', unit: 'nC' },
  E0x: { label: 'Applied field E₀x', unit: 'V/m' },
  E0y: { label: 'Applied field E₀y', unit: 'V/m' },
  E0mag: { label: 'Applied field |E₀|', unit: 'V/m' },
  E0angle: { label: 'Angle of E₀', unit: '°' },
  theta: { label: 'Surface-field angle θ', unit: 'rad' },
  induce: { label: 'Induced charges', unit: '' },
  showCharges: { label: 'Charge overlay', unit: '' },
  Emax: { label: 'Largest field |E|max', unit: 'V/m' },
};

export function mount(container, setup = {}) {
  const p = { ...DEFAULTS, ...(setup || {}) };
  const changes = createEmitter();
  const overlay = createChargeOverlay();
  let Emax = 0;
  let ready = false;

  const getState = () => {
    const { mag, angle } = polarE0(p.E0x, p.E0y);
    return { Q: p.Q, E0x: p.E0x, E0y: p.E0y, E0mag: mag, E0angle: angle + 0, theta: p.theta,
      induce: p.induce, showCharges: p.showCharges, Emax };
  };

  // ── Controls ──
  const controls = {
    Q: slider({ id: 'Q', name: 'Q', unit: 'nC', min: -3, max: 3, step: 0.1, value: p.Q, reset: 0, decimals: 1,
      onChange: (v) => { p.Q = v; update(); } }),
    theta: arcPicker({ id: 'theta', name: 'θ', value: p.theta, onChange: (v) => { p.theta = v; update(); } }),
    induce: toggle({ id: 'induce', name: 'Induced charges', value: p.induce,
      onChange: (v) => { p.induce = v; update(); } }),
    showCharges: toggle({ id: 'showCharges', name: 'Charge overlay', label: 'Charge overlay (e<sup>−</sup>/p<sup>+</sup>)',
      value: p.showCharges, onChange: (v) => { p.showCharges = v; update(); } }),
    E0: e0Joystick({ id: 'E0', name: 'E₀', value: { x: p.E0x, y: p.E0y },
      onChange: ({ x, y }) => { p.E0x = x; p.E0y = y; update(); } }),
  };
  // The joystick may have limited the Setup's E₀ to |E₀| ≤ 2000.
  ({ x: p.E0x, y: p.E0y } = controls.E0.get());
  p.theta = controls.theta.get();

  const readouts = {
    E0mag: metric({ name: '|E₀|', label: '|<i>E</i><sub>0</sub>|', format: (v) => `${v.toFixed(0)} V/m` }),
    E0angle: metric({ name: '∠E₀', label: '∠<i>E</i><sub>0</sub>', format: (v) => `${v.toFixed(1)}°` }),
    Emax: metric({ name: '|E|max', label: '|<i>E</i>|<sub>max</sub>', format: (v) => `${v.toFixed(0)} V/m` }),
    Q: metric({ name: 'Q value', label: '<i>Q</i>', format: (v) => `${v.toFixed(1)} nC` }),
    theta: metric({ name: 'θ value', label: 'θ', format: (v) => `${v.toFixed(2)} rad` }),
  };

  const plotDiv = h('div', { style: 'width:100%;height:100%' });
  const swatch = (bg, border) => h('span', { class: 'es-swatch', style: `background:${bg};border-color:${border}` });
  const root = h('div', { class: 'fw-tool es-tool', 'data-tool': 'electrostatics', 'data-mode': id },
    toolStyles(),
    h('aside', { class: 'fw-controls' },
      section('Parameters', controls.Q.el, controls.theta.el, controls.induce.el, controls.showCharges.el),
      section('Applied field E₀', controls.E0.el),
      section('Live Metrics', ...Object.values(readouts).map((r) => r.el)),
      section('Legend',
        h('div', { class: 'fw-legend-row' }, swatch('var(--fw-blue)', 'var(--fw-blue)'), h('span', { html: '<i>E</i> field arrows' })),
        h('div', { class: 'fw-legend-row' }, swatch('var(--fw-red)', 'var(--fw-red)'), h('span', { html: 'Fixed p<sup>+</sup>' })),
        h('div', { class: 'fw-legend-row' }, swatch('var(--fw-text)', 'var(--fw-text-muted)'), h('span', { html: 'Mobile e<sup>−</sup>' })),
        h('div', { class: 'fw-legend-row' }, swatch('var(--fw-blue)', 'var(--fw-text)'),
          h('span', { html: 'Surface e<sup>−</sup> (orbit cw, θ·<i>Q</i> ≠ 0)' })),
        h('div', { class: 'fw-hint' }, 'Fill: |E|  ·  Ring: σ (red −, blue +)'))),
    h('div', { class: 'fw-displays' }, h('div', { class: 'fw-display es-square' }, plotDiv)));
  container.append(root);
  controls.E0.redraw();
  controls.theta.redraw();

  // ── Plot ──
  function chargeTraces(C) {
    const f = p.showCharges ? overlay.frame(p) : null;
    const pts = (k) => (f ? f[k] : { x: [], y: [] });
    return [
      { ...pts('protons'), mode: 'markers', hoverinfo: 'skip',
        marker: { symbol: 'circle', size: 9, color: C.red, line: { color: C.surface, width: 1.2 } } },
      { ...pts('electrons'), mode: 'markers', hoverinfo: 'skip',
        marker: { symbol: 'circle', size: 7, color: C.text, line: { color: C.border, width: 0.8 } } },
      { ...pts('surface'), mode: 'markers', hoverinfo: 'skip',
        marker: { symbol: 'circle', size: 8, color: C.blue, line: { color: C.surface, width: 0.8 } } },
    ];
  }

  function traces() {
    const C = plotColors(root);
    const grid = fieldGrid(p);
    Emax = grid.maxE;
    const out = [heatmapTrace(grid), quiverTrace(grid, C), sigmaTrace(sigmaRing(p), C)];
    const m = Math.hypot(p.E0x, p.E0y);
    if (p.induce && m > 0) {
      const ex = p.E0x / m;
      const ey = p.E0y / m;
      const arrow = (x, y, color) => ({ x: [x], y: [y], mode: 'markers', hoverinfo: 'skip',
        marker: { symbol: 'arrow', size: 14, color, angleref: 'previous', line: { color, width: 2 } } });
      out.push(arrow(-ey / 2, ex / 2, C.blue), arrow(ey / 2, -ex / 2, C.yellow));
    }
    return [...out, ...chargeTraces(C)];
  }

  function redraw() {
    const t = traces();
    if (ready) Plotly.react(plotDiv, t, conductorLayout(plotColors(root)), PLOT_CONFIG);
  }

  function update() {
    redraw();
    const s = getState();
    for (const [k, r] of Object.entries(readouts)) r.update(s[k]);
    changes.emit(s);
  }

  Plotly.newPlot(plotDiv, traces(), conductorLayout(plotColors(root)), PLOT_CONFIG);
  ready = true;
  const plot = plotDisplay(plotDiv, { id: 'field', label: 'Electric field' });

  // ── Charge animation: only while this instance's plot is on screen, never after destroy ──
  let frame = null;
  let last = null;
  let visible = false;
  function tick(ts) {
    frame = requestAnimationFrame(tick);
    const frames = last == null ? 1 : Math.min((ts - last) / 16.67, 3);
    last = ts;
    if (!p.showCharges || !plotDiv.data) return;
    overlay.step(frames, p);
    const f = overlay.frame(p);
    const n = plotDiv.data.length;
    Plotly.restyle(plotDiv, { x: [f.protons.x, f.electrons.x, f.surface.x], y: [f.protons.y, f.electrons.y, f.surface.y] },
      [n - 3, n - 2, n - 1]);
  }
  const startAnimation = () => { if (frame == null) { last = null; frame = requestAnimationFrame(tick); } };
  const stopAnimation = () => { if (frame != null) cancelAnimationFrame(frame); frame = null; };
  const io = new IntersectionObserver((entries) => {
    visible = entries.at(-1).isIntersecting;
    if (visible) startAnimation(); else stopAnimation();
  });
  io.observe(plotDiv);

  update();

  return {
    state: {
      snapshot: getState,
      describe: () => structuredClone(STATE_INFO),
      onChange: (fn) => changes.on(fn),
    },
    controls: controlRegistry(controls),
    displays: [plot.display],
    serialize: () => ({ Q: p.Q, E0x: p.E0x, E0y: p.E0y, theta: p.theta, induce: p.induce, showCharges: p.showCharges }),
    restore(saved = {}) {
      if (Number.isFinite(saved.Q)) controls.Q.set(saved.Q);
      if (Number.isFinite(saved.theta)) controls.theta.set(saved.theta);
      if (Number.isFinite(saved.E0x) || Number.isFinite(saved.E0y)) {
        controls.E0.set({ x: Number.isFinite(saved.E0x) ? saved.E0x : p.E0x, y: Number.isFinite(saved.E0y) ? saved.E0y : p.E0y });
      }
      if (typeof saved.induce === 'boolean') controls.induce.set(saved.induce);
      if (typeof saved.showCharges === 'boolean') controls.showCharges.set(saved.showCharges);
    },
    resize: plot.fit,
    destroy() {
      stopAnimation();
      io.disconnect();
      plot.stop();
      changes.clear();
      Plotly.purge(plotDiv);
      root.remove();
    },
  };
}
