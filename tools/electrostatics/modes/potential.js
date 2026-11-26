// potential Mode of the electrostatics Tool: the old "Potential Field" tab of
// conductor_properties. A charged conductor with two probe points P1 and P2 dragged on the plot;
// the student reads V1, V2 and ΔV. "Lock to surface" moves both probes onto the edge;
// "measure at infinity" takes V2 = 0. The two toggles are never on together.
//
// Setup: { Q, x1, y1, x2, y2, lockToSurface, measureAtInfinity } (any subset; defaults below).
//        x1..y2 are where the probes were put, before the toggles act on them.
// State: Q (nC); x1, y1, x2, y2 (cm), the probes after the toggles; r1, r2 (cm) from the centre;
//        V1, V2, dV (V), dV = V1 − V2 (V1 − V(∞)); lockToSurface, measureAtInfinity.
//        With measure at infinity on, P2 sits 2 × WINDOW out along P1's direction (off the plot).
// Controls: 'Q' (slider), 'P1', 'P2' (kit 2-D handles over the plot, named P₁ and P₂: dragged or
//           moved with the arrow keys, value { x, y } cm, within the window),
//           'lockToSurface', 'measureAtInfinity' (toggles).
// Displays: 'potential' (toScreen(x, y) in cm).

import { controlRegistry } from '../../../framework/v1/control.js';
import { createEmitter } from '../../../framework/v1/tool.js';
import { h, handle, metric, section, slider, toggle } from '../../../framework/v1/ui-kit.js';
import { RADIUS, WINDOW, fieldGrid, linspace, potentialProbe } from '../conductor.js';
import { PLOT_CONFIG, Plotly, boundaryTrace, conductorLayout, heatmapTrace, plotDisplay, quiverTrace, plotColors, toolStyles } from '../plot.js';

export const id = 'potential';
export const title = 'Potential';

const DEFAULTS = { Q: 1, x1: -6, y1: -6, x2: 7, y2: 7, lockToSurface: false, measureAtInfinity: false };

const STATE_INFO = {
  Q: { label: 'Charge Q', unit: 'nC' },
  x1: { label: 'P1 x', unit: 'cm' },
  y1: { label: 'P1 y', unit: 'cm' },
  x2: { label: 'P2 x', unit: 'cm' },
  y2: { label: 'P2 y', unit: 'cm' },
  r1: { label: 'Distance of P1 from the centre r1', unit: 'cm' },
  r2: { label: 'Distance of P2 from the centre r2', unit: 'cm' },
  V1: { label: 'Potential at P1 V1', unit: 'V' },
  V2: { label: 'Potential at P2 V2', unit: 'V' },
  dV: { label: 'Potential difference ΔV', unit: 'V' },
  lockToSurface: { label: 'Lock to surface', unit: '' },
  measureAtInfinity: { label: 'Measure at infinity', unit: '' },
};

/**
 * A probe point on the plot: the kit's 2-D handle, in a layer over the Display, placed over the
 * point where the probe is drawn (after the toggles). get() -> { x, y } cm; set({ x, y }) clamps
 * to the window. The arrow keys move it 0.1 cm (1 cm with Shift). Lock: it can't be moved.
 * Hide: it isn't drawn and can't be moved. A probe with no point on the plot (P2 measured at
 * infinity) is not shown, so it can't be focused or dragged.
 */
function probe({ id, name, value, at, fromScreen, onChange, onLookChange }) {
  const axis = (n) => ({ name: n, unit: 'cm', min: -WINDOW, max: WINDOW, step: 0.1, coarse: 1, decimals: 1 });
  return handle({ id, name, x: axis('x'), y: axis('y'), value, toScreen: at, fromScreen, onChange,
    onLock: onLookChange, onHide: onLookChange });
}

/**
 * Make two toggle Controls mutually exclusive, as the old app did: while one is on the other's
 * box is disabled (whatever lock and unlock say). A set() that turns one on turns the other off,
 * unless the other is locked, in which case the set is refused.
 */
function exclusive(a, b) {
  const input = (t) => t.el.querySelector('input');
  const sync = () => {
    input(a).disabled = a.isLocked() || b.get();
    input(b).disabled = b.isLocked() || a.get();
  };
  for (const t of [a, b]) {
    const { lock, unlock } = t;
    t.lock = () => { lock(); sync(); };
    t.unlock = () => { unlock(); sync(); };
  }
  /** Call from each toggle's onChange before using its value; returns the value to keep. */
  function settle(self, on) {
    const other = self === a ? b : a;
    if (on && other.get()) {
      if (other.isLocked()) { input(self).checked = false; on = false; } else input(other).checked = false;
    }
    sync();
    return on;
  }
  return { settle, sync };
}

export function mount(container, setup = {}) {
  const p = { ...DEFAULTS, ...(setup || {}) };
  if (p.lockToSurface && p.measureAtInfinity) p.measureAtInfinity = false;
  const changes = createEmitter();
  let ready = false;

  const probes = () => potentialProbe({ x: p.x1, y: p.y1 }, { x: p.x2, y: p.y2 }, p);
  const getState = () => ({ Q: p.Q, ...probes(), lockToSurface: p.lockToSurface, measureAtInfinity: p.measureAtInfinity });

  // ── Controls ──
  // The probes' mapping to the plot (in client pixels), once the plot is drawn.
  const plotDiv = h('div', { style: 'width:100%;height:100%;touch-action:none' });
  let toScreen = () => null;
  function fromScreen(cx, cy) {
    const fl = plotDiv._fullLayout;
    if (!fl) return null;
    const rect = plotDiv.getBoundingClientRect();
    return { x: fl.xaxis.p2d(cx - rect.left - fl.xaxis._offset), y: fl.yaxis.p2d(cy - rect.top - fl.yaxis._offset) };
  }
  const drawnAt = (k) => { const s = probes(); return toScreen(s[`x${k}`], s[`y${k}`]); };

  let pair = null;
  const controls = {
    Q: slider({ id: 'Q', name: 'Q', unit: 'nC', min: -3, max: 3, step: 0.1, value: p.Q, reset: 1, decimals: 1,
      onChange: (v) => { p.Q = v; update(); } }),
    P1: probe({ id: 'P1', name: 'P₁', value: { x: p.x1, y: p.y1 }, at: () => drawnAt(1), fromScreen,
      onChange: ({ x, y }) => { p.x1 = x; p.y1 = y; update(); }, onLookChange: () => redraw() }),
    P2: probe({ id: 'P2', name: 'P₂', value: { x: p.x2, y: p.y2 },
      at: () => (p.measureAtInfinity ? null : drawnAt(2)), fromScreen,
      onChange: ({ x, y }) => { p.x2 = x; p.y2 = y; update(); }, onLookChange: () => redraw() }),
    lockToSurface: toggle({ id: 'lockToSurface', name: 'Lock to surface', value: p.lockToSurface,
      onChange: (v) => { p.lockToSurface = pair.settle(controls.lockToSurface, v); p.measureAtInfinity = controls.measureAtInfinity.get(); update(); } }),
    measureAtInfinity: toggle({ id: 'measureAtInfinity', name: 'Measure at infinity', label: 'Measure at ∞',
      value: p.measureAtInfinity,
      onChange: (v) => { p.measureAtInfinity = pair.settle(controls.measureAtInfinity, v); p.lockToSurface = controls.lockToSurface.get(); update(); } }),
  };
  ({ x: p.x1, y: p.y1 } = controls.P1.get());
  ({ x: p.x2, y: p.y2 } = controls.P2.get());
  pair = exclusive(controls.lockToSurface, controls.measureAtInfinity);
  pair.sync();

  const at = (x, y) => `(${x.toFixed(1)}, ${y.toFixed(1)}) cm`;
  const volts = (v) => `${v.toFixed(1)} V`;
  const readouts = {
    dV: metric({ name: 'ΔV', label: 'Δ<i>V</i> = <i>V</i><sub>1</sub> − <i>V</i><sub>2</sub>', format: volts }),
    P1: metric({ name: 'P1 position', label: '<i>P</i><sub>1</sub>', format: (s) => at(s.x1, s.y1) }),
    V1: metric({ name: 'V1', label: '<i>V</i><sub>1</sub>', format: volts }),
    P2: metric({ name: 'P2 position', label: '<i>P</i><sub>2</sub>',
      format: (s) => (s.measureAtInfinity ? '∞' : at(s.x2, s.y2)) }),
    V2: metric({ name: 'V2', label: '<i>V</i><sub>2</sub>', format: (v) => (p.measureAtInfinity ? '0 V' : volts(v)) }),
  };
  const dVLabel = readouts.dV.el.firstChild;

  const swatch = (bg, border, extra = '') => h('span', { class: 'es-swatch', style: `background:${bg};border-color:${border};${extra}` });
  const root = h('div', { class: 'fw-tool es-tool', 'data-tool': 'electrostatics', 'data-mode': id },
    toolStyles(),
    h('aside', { class: 'fw-controls' },
      section('Parameters', controls.Q.el, controls.lockToSurface.el, controls.measureAtInfinity.el),
      section('Potential Difference', readouts.dV.el),
      section('Point Positions', readouts.P1.el, readouts.V1.el, readouts.P2.el, readouts.V2.el),
      section('Legend',
        h('div', { class: 'fw-legend-row' }, swatch('var(--fw-blue)', 'var(--fw-blue)'), h('span', { html: '<i>E</i> field arrows' })),
        h('div', { class: 'fw-legend-row' }, swatch('var(--fw-yellow)', 'var(--fw-text)'), h('span', { html: 'Point <i>P</i><sub>1</sub> (drag)' })),
        h('div', { class: 'fw-legend-row' }, swatch('var(--fw-text)', 'var(--fw-text-muted)'), h('span', { html: 'Point <i>P</i><sub>2</sub> (drag)' })),
        h('div', { class: 'fw-legend-row' }, swatch('var(--fw-surface)', 'var(--fw-text)', 'border-radius:0;width:11px;height:11px'),
          h('span', { html: 'Path <i>P</i><sub>1</sub> → <i>P</i><sub>2</sub>' })),
        h('div', { class: 'fw-hint' }, 'Fill: |E|  ·  Blue ring: conductor  ·  Drag the points on the plot, or focus one and use the arrow keys'))),
    h('div', { class: 'fw-displays' }, h('div', { class: 'fw-display es-square', style: 'position:relative' }, plotDiv,
      h('div', { class: 'fw-handle-layer' }, controls.P1.el, controls.P2.el))));
  container.append(root);

  // ── Plot ──
  function traces() {
    const C = plotColors(root);
    const grid = fieldGrid({ Q: p.Q, induce: true });
    const s = probes();
    let path;
    if (p.lockToSurface) {
      const t1 = Math.atan2(s.y1, s.x1);
      const t2 = Math.atan2(s.y2, s.x2);
      const ts = linspace(Math.min(t1, t2), Math.max(t1, t2), 60);
      path = { x: ts.map((t) => RADIUS * Math.cos(t)), y: ts.map((t) => RADIUS * Math.sin(t)) };
    } else {
      path = { x: [s.x1, s.x2], y: [s.y1, s.y2] };
    }
    const point = (c, x, y, color, edge, name) => ({
      x: c.isHidden() ? [] : [x], y: c.isHidden() ? [] : [y], mode: 'markers',
      marker: { size: 12, color: c.isLocked() ? C.border : color, line: { color: edge, width: 1.5 } },
      hovertemplate: `${name} (%{x:.1f}, %{y:.1f})<extra></extra>` });
    return [
      heatmapTrace(grid),
      quiverTrace(grid, C),
      boundaryTrace({ color: C.blue, dash: 'solid', width: 3 }),
      { ...path, mode: 'lines', line: { color: C.surface, width: 2, dash: 'dot' }, hoverinfo: 'skip' },
      point(controls.P1, s.x1, s.y1, C.yellow, C.text, 'P₁'),
      point(controls.P2, s.x2, s.y2, p.measureAtInfinity ? C.muted : C.text, C.surface, 'P₂'),
    ];
  }

  function redraw() {
    if (ready) Plotly.react(plotDiv, traces(), conductorLayout(plotColors(root)), PLOT_CONFIG);
  }

  function placeProbes() { controls.P1.place(); controls.P2.place(); }

  function update() {
    redraw();
    const s = getState();
    readouts.dV.update(s.dV);
    dVLabel.innerHTML = p.measureAtInfinity
      ? 'Δ<i>V</i> = <i>V</i><sub>1</sub> − <i>V</i>(∞)'
      : 'Δ<i>V</i> = <i>V</i><sub>1</sub> − <i>V</i><sub>2</sub>';
    readouts.P1.update(s);
    readouts.V1.update(s.V1);
    readouts.P2.update(s);
    readouts.V2.update(s.V2);
    if (ready) placeProbes();
    changes.emit(s);
  }

  Plotly.newPlot(plotDiv, traces(), conductorLayout(plotColors(root)), PLOT_CONFIG);
  ready = true;
  const plot = plotDisplay(plotDiv, { id: 'potential', label: 'Potential' });

  // ── The probe handles sit over the drawn points; re-place them whenever the plot is redrawn ──
  toScreen = plot.display.toScreen;
  plotDiv.on('plotly_afterplot', placeProbes);

  update();

  return {
    state: {
      snapshot: getState,
      describe: () => structuredClone(STATE_INFO),
      onChange: (fn) => changes.on(fn),
    },
    controls: controlRegistry(controls),
    displays: [plot.display],
    serialize: () => ({ Q: p.Q, x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2,
      lockToSurface: p.lockToSurface, measureAtInfinity: p.measureAtInfinity }),
    restore(saved = {}) {
      if (Number.isFinite(saved.Q)) controls.Q.set(saved.Q);
      if (Number.isFinite(saved.x1) && Number.isFinite(saved.y1)) controls.P1.set({ x: saved.x1, y: saved.y1 });
      if (Number.isFinite(saved.x2) && Number.isFinite(saved.y2)) controls.P2.set({ x: saved.x2, y: saved.y2 });
      // Toggles going off first, so the one going on is never refused by the other.
      const flags = ['lockToSurface', 'measureAtInfinity'].filter((k) => typeof saved[k] === 'boolean')
        .sort((a, b) => saved[a] - saved[b]);
      for (const k of flags) controls[k].set(saved[k]);
    },
    resize: plot.fit,
    destroy() {
      controls.P1.destroy();
      controls.P2.destroy();
      plot.stop();
      changes.clear();
      Plotly.purge(plotDiv);
      root.remove();
    },
  };
}
