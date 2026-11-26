// Fourier Tool, Analysis Mode: see where each coefficient comes from, as the net area under the
// signal times a test function over one period.
//
// Setup: { waveform, amp, f0, offset, shift, filter, fc, applyGain, applyPhase, testFunction, n,
//   spectrumSource } (any subset; defaults in ../inputs.js, ../filter.js and below).
// State (state.snapshot()): mode ('analysis'), waveform, amp (V), f0 (Hz), offset (V),
//   shift (°, of the fundamental), filter, fc (Hz), applyGain, applyPhase, fcRatio (f_c/f₀),
//   tau (ms), testFunction ('cos' | 'sin'), n (the test harmonic), spectrumSource
//   ('input' | 'output').
// Controls: the shared input Controls 'waveform', 'amp', 'f0', 'offset', 'shift' (../inputs.js);
//   the shared filter Controls 'filter', 'fc', 'applyGain', 'applyPhase' (../filter.js);
//   select 'testFunction' (cos or sin); slider 'n' (integer 0 to MAX_TEST_N), where n = 0 is the
//   DC test (cos 0 = 1, sin 0 = 0); select 'spectrumSource' (the input or the filtered output);
//   and 'spectrum' and 'filter-curves', which only hide and show the Displays of the same ids,
//   so an Activity's show and hide lists can reveal them.
// Displays (in a column):
//   'product' (over exactly one period of f₀: the input and the test function for reference,
//     and their product with its positive and negative area shaded in different colours; time in
//     ms). The plot's y axis is unitless: the input is in V, the test function has no unit, so
//     the product is in V too. It always shows the unfiltered input.
//   'spectrum' (Aₙ bars and φₙ stems for n = 0 … 10, of the chosen source) and 'filter-curves'
//     (gain and phase against f with f_c and each harmonic marked): see ../spectrum-displays.js.
//   The displays list leaves out a Display while it is hidden, so the snapshots the runner takes
//   at Submit never include a spectrum the Task hid.
// serialize() is { waveform, amp, f0, offset, shift, filter, fc, applyGain, applyPhase,
//   testFunction, n, spectrumSource }; restore() validates and clamps each.
//
// No readout shows the integral, an, bn, An or φn: students compute them by hand. The spectrum
// does show An and φn, which is why an Activity hides it until the matching Task is submitted.

import { controlRegistry } from '../../../framework/v1/control.js';
import { createEmitter } from '../../../framework/v1/tool.js';
import { h, section, select, slider } from '../../../framework/v1/ui-kit.js';
import { plotTheme } from '../../../framework/v1/plot-theme.js';
import { plotlyMapping } from '../../../framework/v1/plot-map.js';
import { SPECTRUM_SOURCES, TEST_FUNCTIONS, ideal, testFunction } from '../engine.js';
import { FILTER_DEFAULTS, FILTER_STATE_INFO, filterControls } from '../filter.js';
import { INPUT_DEFAULTS, INPUT_STATE_INFO, inputControls } from '../inputs.js';
import { PLOT_CONFIG, Plotly, fitToBox, line, themedLayout, toolStyles, translucent } from '../plot.js';
import { signalState, toCount } from '../signal.js';
import { filterCurveDisplay, spectrumDisplay } from '../spectrum-displays.js';

export const id = 'analysis';
export const title = 'Analysis';

export const MAX_TEST_N = 10;
const SAMPLES = 1201; // time samples across one period (about 120 per cycle of the 10th harmonic)

const DEFAULTS = { ...INPUT_DEFAULTS, ...FILTER_DEFAULTS, testFunction: 'sin', n: 1, spectrumSource: 'input' };

const STATE_INFO = {
  mode: { label: 'Mode', unit: '' },
  ...INPUT_STATE_INFO,
  ...FILTER_STATE_INFO,
  testFunction: { label: 'Test function (cos or sin)', unit: '' },
  n: { label: 'Test harmonic n', unit: '' },
  spectrumSource: { label: 'Spectrum of (input or filtered output)', unit: '' },
};

const TEST_LABELS = { cos: 'cos(2πnf₀t)', sin: 'sin(2πnf₀t)' };
const SOURCE_LABELS = { input: 'Input', output: 'Filtered output' };

const SHADE_ALPHA = 0.4; // the shaded areas' opacity, so the curves read through them

const toN = (v) => toCount(v, MAX_TEST_N);
const validN = (v) => Number.isFinite(Number(v));

export function mount(container, setup = {}) {
  const start = { ...DEFAULTS, ...setup };
  const inputs = inputControls(start, () => update());
  const filters = filterControls(start, () => update());
  let input = inputs.value();
  let source = SPECTRUM_SOURCES.includes(start.spectrumSource) ? start.spectrumSource : DEFAULTS.spectrumSource;
  let fn = TEST_FUNCTIONS.includes(start.testFunction) ? start.testFunction : DEFAULTS.testFunction;
  let n = validN(start.n) ? toN(start.n) : DEFAULTS.n;
  const changes = createEmitter();
  const theme = plotTheme(); // read per mount, so the plot follows the page's theme

  const signal = signalState(inputs, filters);
  const getState = () => ({ mode: id, ...signal.state(), testFunction: fn, n, spectrumSource: source });

  // ── Controls ──
  const fnSelect = select({ id: 'testFunction', name: 'Test function', label: 'Test function',
    options: TEST_FUNCTIONS.map((f) => ({ value: f, label: TEST_LABELS[f] })), value: fn,
    onChange: (v) => { fn = v; update(); } });
  const nSlider = slider({ id: 'n', name: 'n', label: 'n (test harmonic)', min: 0, max: MAX_TEST_N, step: 1,
    decimals: 0, value: n, reset: DEFAULTS.n, onChange: (v) => { n = toN(v); update(); } });
  const sourceSelect = select({ id: 'spectrumSource', name: 'Spectrum of', label: 'Spectrum of',
    options: SPECTRUM_SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] })), value: source,
    onChange: (v) => { source = v; update(); } });
  const spectrumView = spectrumDisplay(theme);
  const curvesView = filterCurveDisplay(theme);
  const controls = { ...inputs.controls, ...filters.controls, testFunction: fnSelect, n: nSlider,
    spectrumSource: sourceSelect, spectrum: spectrumView.control, 'filter-curves': curvesView.control };

  // ── Layout ──
  const STYLE = {
    input: { color: theme.muted, width: 4 },
    test: { color: theme.traces[2], width: 1.5, dash: 'dash' },
    product: { color: theme.ink, width: 2 },
    positive: translucent(theme.traces[0], SHADE_ALPHA),
    negative: translucent(theme.traces[1], SHADE_ALPHA),
  };
  const legendRow = (color, html, swatch = '') => h('div', { class: 'fw-legend-row' },
    h('span', { class: `fw-legend-line ${swatch}`.trim(), style: `background:${color}` }), h('span', { html }));
  const swatch = 'fo-legend-swatch';

  const plotDiv = h('div', { class: 'fo-plot' });
  const root = h('div', { class: 'fw-tool fo-tool', 'data-tool': 'fourier', 'data-mode': id },
    toolStyles(),
    h('aside', { class: 'fw-controls' },
      inputs.el,
      filters.el,
      section('Test function', fnSelect.el, nSlider.el,
        h('div', { class: 'fw-hint' }, 'n = 0 is the DC test: cos 0 = 1 and sin 0 = 0.')),
      section('Legend',
        legendRow(STYLE.input.color, 'Input'),
        legendRow(STYLE.test.color, 'Test function'),
        legendRow(STYLE.product.color, 'Product: input × test function'),
        legendRow(STYLE.positive, 'Positive area', swatch),
        legendRow(STYLE.negative, 'Negative area', swatch)),
      section('Spectrum', sourceSelect.el,
        h('div', { class: 'fw-hint' }, 'Bars are the amplitudes, stems the phases in degrees. The product plot always uses the unfiltered input.'))),
    h('div', { class: 'fw-displays fo-displays-stack' },
      h('div', { class: 'fw-display fo-display-product', 'data-display': 'product' }, plotDiv),
      spectrumView.el,
      curvesView.el));
  container.append(root);

  // ── Plot ──
  const area = (name, x, y, color) => line(name, x, y, { width: 0, color }, { fill: 'tozeroy', fillcolor: color });
  let T = 1 / input.f0;
  function traces() {
    T = 1 / input.f0;
    const ts = Array.from({ length: SAMPLES }, (_, i) => (i / (SAMPLES - 1)) * T);
    const tMs = ts.map((t) => t * 1e3);
    const inputY = ts.map((t) => ideal(input, t));
    const testY = ts.map((t) => testFunction(fn, input.f0, n, t));
    const productY = inputY.map((v, i) => v * testY[i]);
    return [
      area('Positive area', tMs, productY.map((v) => Math.max(v, 0)), STYLE.positive),
      area('Negative area', tMs, productY.map((v) => Math.min(v, 0)), STYLE.negative),
      line('Input', tMs, inputY, STYLE.input),
      line('Test function', tMs, testY, STYLE.test),
      line('Product', tMs, productY, STYLE.product),
    ];
  }
  const layout = () => {
    const span = (Math.abs(input.offset) + Math.abs(input.amp)) * 1.15 || 1;
    const y = Math.max(span, 1.15);
    return themedLayout(theme, { xTitle: 'Time (ms)', yTitle: 'Value', xRange: [0, T * 1e3], yRange: [-y, y] });
  };

  function update() {
    input = inputs.value();
    const filter = filters.value();
    filters.update(input.f0);
    const data = traces();
    Plotly.react(plotDiv, data, layout(), PLOT_CONFIG);
    spectrumView.update(input, filter, source);
    curvesView.update(input, filter);
    changes.emit(getState());
  }

  Plotly.newPlot(plotDiv, traces(), layout(), PLOT_CONFIG);
  const box = fitToBox(plotDiv);
  const productDisplay = {
    id: 'product',
    label: 'Product plot',
    snapshot: () => Plotly.toImage(plotDiv, { format: 'png', width: 720, height: 360 }),
    toScreen: plotlyMapping(plotDiv).toScreen,
  };
  update();

  return {
    state: {
      snapshot: getState,
      describe: () => structuredClone(STATE_INFO),
      onChange: (f) => changes.on(f),
    },
    controls: controlRegistry(controls),
    get displays() {
      return [productDisplay, ...[spectrumView, curvesView].filter((v) => !v.control.isHidden()).map((v) => v.display)];
    },
    serialize: () => ({ ...signal.settings(), testFunction: fn, n, spectrumSource: source }),
    restore(saved = {}) {
      inputs.restore(saved); // each redraws once with the settings not yet restored
      filters.restore(saved);
      sourceSelect.set(saved.spectrumSource); // ignored unless input or output
      fnSelect.set(saved.testFunction); // ignored unless cos or sin
      nSlider.set(validN(saved.n) ? toN(saved.n) : n);
    },
    resize() { box.fit(); spectrumView.fit(); curvesView.fit(); },
    destroy() {
      box.disconnect();
      spectrumView.destroy();
      curvesView.destroy();
      changes.clear();
      Plotly.purge(plotDiv);
      root.remove();
    },
  };
}
