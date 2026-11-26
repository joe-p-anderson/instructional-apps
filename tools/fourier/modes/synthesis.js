// Fourier Tool, Synthesis Mode: build a waveform from its harmonics.
//
// Setup: { waveform, amp, f0, offset, shift, N } (any subset; defaults in ../inputs.js and below).
// State (state.snapshot()): mode ('synthesis'), waveform, amp (V), f0 (Hz), offset (V),
//   shift (°, of the fundamental), N (the highest harmonic number in the partial sum).
// Controls: the shared input Controls 'waveform', 'amp', 'f0', 'offset', 'shift' (../inputs.js);
//   slider 'N' (integer 0 to 100); 'play' (play/pause button: get() is whether it is
//   playing, set(true|false) plays or pauses). Play steps N up by one every PLAY_MS and stops
//   at 100; pressing it at 100 starts over from 0. Lock, restore and destroy all stop it.
// Displays: 'time' (the time plot over two periods of f₀: the input, the N = ∞ curve, the
//   highest included harmonic drawn faintly, and the partial sum through N; time in ms, voltage
//   in V).
// serialize() is { waveform, amp, f0, offset, shift, N }; restore() validates and clamps each.
//
// No readout shows an, bn, An or φn.

import { controlRegistry, createControl } from '../../../framework/v1/control.js';
import { createEmitter } from '../../../framework/v1/tool.js';
import { h, section, slider } from '../../../framework/v1/ui-kit.js';
import { plotTheme } from '../../../framework/v1/plot-theme.js';
import { plotlyMapping } from '../../../framework/v1/plot-map.js';
import { MAX_N, harmonic, limit, partialSum, series } from '../engine.js';
import { INPUT_DEFAULTS, INPUT_STATE_INFO, inputControls } from '../inputs.js';
import { PLOT_CONFIG, Plotly, fitToBox, themedLayout } from '../plot.js';

export const id = 'synthesis';
export const title = 'Synthesis';

export const PLAY_MS = 250; // how often play steps N up
const PERIODS = 2; // periods of f0 shown on the time axis
const SAMPLES = 2401; // time samples across the plot (about 12 per cycle of the 100th harmonic)

const DEFAULTS = { ...INPUT_DEFAULTS, N: 1 };

const STATE_INFO = {
  mode: { label: 'Mode', unit: '' },
  ...INPUT_STATE_INFO,
  N: { label: 'Highest harmonic N', unit: '' },
};

const toN = (v) => Math.min(MAX_N, Math.max(0, Math.round(Number(v))));

export function mount(container, setup = {}) {
  const start = { ...DEFAULTS, ...setup };
  const inputs = inputControls(start, () => { redraw(); update(); });
  let input = inputs.value();
  const changes = createEmitter();
  const theme = plotTheme(); // read per mount, so the plot follows the page's theme
  let N = Number.isFinite(Number(start.N)) ? toN(start.N) : DEFAULTS.N;
  let timer = null; // play's interval id, per instance
  let destroyed = false;

  const getState = () => ({ mode: id, ...input, N });

  // ── Time axis (ms on the plot, s in the engine) and the curves that do not depend on N ──
  // redraw() recomputes them from the input; update() redraws the plot for N.
  let coeffs; let T; let ts; let tMs; let inputY; let limitY; let span;
  function redraw() {
    input = inputs.value();
    coeffs = series(input); // the input's exact table through MAX_N
    T = 1 / input.f0;
    ts = Array.from({ length: SAMPLES }, (_, i) => (i / (SAMPLES - 1)) * PERIODS * T);
    tMs = ts.map((t) => t * 1e3);
    inputY = ts.map((t) => limit(input, t)); // no filter yet: the input is its own N = ∞
    limitY = inputY;
    span = Math.abs(input.amp) * 1.4 || 1;
  }
  redraw();

  // ── Controls ──
  const nSlider = slider({ id: 'N', name: 'N', label: 'N (highest harmonic)', min: 0, max: MAX_N, step: 1,
    decimals: 0, value: N, reset: DEFAULTS.N, onChange: (v) => { N = toN(v); update(); } });

  const playBtn = h('button', { type: 'button', class: 'fw-button', 'aria-label': 'Play', 'aria-pressed': 'false' });
  const playing = () => timer !== null;
  function renderPlay() {
    playBtn.setAttribute('aria-pressed', String(playing()));
    playBtn.textContent = playing() ? '❚❚ Pause' : '▶ Play';
  }
  function stop() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    renderPlay();
  }
  function play() {
    if (destroyed || playing() || playCtl.isLocked()) return;
    if (N >= MAX_N) nSlider.set(0);
    timer = setInterval(() => {
      nSlider.set(N + 1);
      if (N >= MAX_N) stop();
    }, PLAY_MS);
    renderPlay();
  }
  const setPlaying = (on) => (on ? play() : stop());
  playBtn.addEventListener('click', () => setPlaying(!playing()));
  const playCtl = createControl({ id: 'play', label: 'Play', el: playBtn, get: playing, set: setPlaying,
    onLock: (locked) => { if (locked) stop(); } });
  renderPlay();

  const controls = { ...inputs.controls, N: nSlider, play: playCtl };

  // ── Layout ──
  const TRACE_STYLE = {
    input: { color: theme.muted, width: 5 },
    limit: { color: theme.traces[2], width: 2, dash: 'dash' },
    top: { color: theme.traces[1], width: 1.5 },
    sum: { color: theme.traces[0], width: 2 },
  };
  const legendRow = (style, html) => h('div', { class: 'fw-legend-row' },
    h('span', { class: 'fw-legend-line', style: `background:${style.color}` }), h('span', { html }));
  const topLabel = h('span');
  const topRow = h('div', { class: 'fw-legend-row', style: 'opacity:0.7' },
    h('span', { class: 'fw-legend-line', style: `background:${TRACE_STYLE.top.color}` }), topLabel);

  const plotDiv = h('div', { style: 'width:100%;height:100%' });
  const root = h('div', { class: 'fw-tool', 'data-tool': 'fourier', 'data-mode': id },
    h('aside', { class: 'fw-controls' },
      inputs.el,
      section('Partial sum', nSlider.el, playBtn,
        h('div', { class: 'fw-hint' }, 'N counts harmonic numbers, so an even N of a square or triangle wave adds a zero term.')),
      section('Legend',
        legendRow(TRACE_STYLE.input, 'Input'),
        legendRow(TRACE_STYLE.limit, 'N = ∞ (the infinite series)'),
        topRow,
        legendRow(TRACE_STYLE.sum, 'Partial sum through N'))),
    h('div', { class: 'fw-displays' }, h('div', { class: 'fw-display', 'data-display': 'time' }, plotDiv)));
  container.append(root);

  // ── Plot ──
  const line = (name, x, y, style, extra = {}) => ({ name, x, y, mode: 'lines', line: style, hoverinfo: 'skip', ...extra });
  function traces() {
    return [
      line('Input', tMs, inputY, TRACE_STYLE.input),
      line('N = ∞ (infinite series)', tMs, limitY, TRACE_STYLE.limit),
      line('Highest harmonic', tMs, ts.map((t) => harmonic(coeffs, N, t)), TRACE_STYLE.top, { opacity: 0.55 }),
      line('Partial sum', tMs, ts.map((t) => partialSum(coeffs, N, t)), TRACE_STYLE.sum),
    ];
  }
  const layout = () => themedLayout(theme, {
    xTitle: 'Time (ms)', yTitle: 'Voltage (V)',
    xRange: [0, PERIODS * T * 1e3], yRange: [input.offset - span, input.offset + span],
  });

  function update() {
    topLabel.textContent = N === 0 ? 'Highest harmonic: the DC term (n = 0)' : `Highest harmonic (n = ${N})`;
    Plotly.react(plotDiv, traces(), layout(), PLOT_CONFIG);
    changes.emit(getState());
  }

  Plotly.newPlot(plotDiv, traces(), layout(), PLOT_CONFIG);
  const box = fitToBox(plotDiv);
  const { toScreen } = plotlyMapping(plotDiv);
  update();

  return {
    state: {
      snapshot: getState,
      describe: () => structuredClone(STATE_INFO),
      onChange: (fn) => changes.on(fn),
    },
    controls: controlRegistry(controls),
    displays: [{
      id: 'time',
      label: 'Time plot',
      snapshot: () => Plotly.toImage(plotDiv, { format: 'png', width: 720, height: 360 }),
      toScreen,
    }],
    serialize: () => ({ ...input, N }),
    restore(saved = {}) {
      stop();
      inputs.restore(saved);
      nSlider.set(Number.isFinite(Number(saved.N)) ? toN(saved.N) : N);
    },
    resize: box.fit,
    destroy() {
      destroyed = true;
      stop();
      box.disconnect();
      changes.clear();
      Plotly.purge(plotDiv);
      root.remove();
    },
  };
}
