// Fourier Tool, Analysis Mode: see where each coefficient comes from, as the net area under the
// signal times a test function over one period.
//
// Setup: { waveform, amp, f0, offset, shift, testFunction, n } (any subset; defaults in
//   ../inputs.js and below).
// State (state.snapshot()): mode ('analysis'), waveform, amp (V), f0 (Hz), offset (V),
//   shift (°, of the fundamental), testFunction ('cos' | 'sin'), n (the test harmonic).
// Controls: the shared input Controls 'waveform', 'amp', 'f0', 'offset', 'shift' (../inputs.js);
//   select 'testFunction' (cos or sin); slider 'n' (integer 0 to MAX_TEST_N). n = 0 is the DC
//   test: cos 0 = 1, sin 0 = 0.
// Displays: 'product' (over exactly one period of f₀: the input and the test function for
//   reference, and their product with its positive and negative area shaded in different
//   colours; time in ms). The plot's y axis is unitless: the input is in V, the test function
//   has no unit, so the product is in V too.
// serialize() is { waveform, amp, f0, offset, shift, testFunction, n }; restore() validates and
//   clamps each.
//
// No readout shows the integral, an, bn, An or φn: students compute them by hand.
// The Displays sit in a column (.fw-displays), so further Displays (the spectrum and the filter
// curves, ticket 06) are added beside 'product' in that column.

import { controlRegistry } from '../../../framework/v1/control.js';
import { createEmitter } from '../../../framework/v1/tool.js';
import { h, section, select, slider } from '../../../framework/v1/ui-kit.js';
import { plotTheme } from '../../../framework/v1/plot-theme.js';
import { plotlyMapping } from '../../../framework/v1/plot-map.js';
import { TEST_FUNCTIONS, ideal, testFunction } from '../engine.js';
import { INPUT_DEFAULTS, INPUT_STATE_INFO, inputControls } from '../inputs.js';
import { PLOT_CONFIG, Plotly, fitToBox, themedLayout } from '../plot.js';

export const id = 'analysis';
export const title = 'Analysis';

export const MAX_TEST_N = 10;
const SAMPLES = 1201; // time samples across one period (about 120 per cycle of the 10th harmonic)

const DEFAULTS = { ...INPUT_DEFAULTS, testFunction: 'sin', n: 1 };

const STATE_INFO = {
  mode: { label: 'Mode', unit: '' },
  ...INPUT_STATE_INFO,
  testFunction: { label: 'Test function (cos or sin)', unit: '' },
  n: { label: 'Test harmonic n', unit: '' },
};

const TEST_LABELS = { cos: 'cos(2πnf₀t)', sin: 'sin(2πnf₀t)' };

const SHADE_ALPHA = 0.4; // the shaded areas' opacity, so the curves read through them

/** A theme colour (#rgb, #rrggbb or rgb()) at the given opacity, as Plotly's fills need it. */
function translucent(color, alpha) {
  const c = String(color).trim();
  let rgb = c.match(/^rgba?\(([^)]+)\)$/)?.[1].split(',').slice(0, 3).map(Number);
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((d) => d + d).join('') : hex;
    rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  }
  return rgb ? `rgba(${rgb.join(',')},${alpha})` : c;
}

const toN = (v) => Math.min(MAX_TEST_N, Math.max(0, Math.round(Number(v))));
const validN = (v) => Number.isFinite(Number(v));

export function mount(container, setup = {}) {
  const start = { ...DEFAULTS, ...setup };
  const inputs = inputControls(start, () => update());
  let input = inputs.value();
  let fn = TEST_FUNCTIONS.includes(start.testFunction) ? start.testFunction : DEFAULTS.testFunction;
  let n = validN(start.n) ? toN(start.n) : DEFAULTS.n;
  const changes = createEmitter();
  const theme = plotTheme(); // read per mount, so the plot follows the page's theme

  const getState = () => ({ mode: id, ...input, testFunction: fn, n });

  // ── Controls ──
  const fnSelect = select({ id: 'testFunction', name: 'Test function', label: 'Test function',
    options: TEST_FUNCTIONS.map((f) => ({ value: f, label: TEST_LABELS[f] })), value: fn,
    onChange: (v) => { fn = v; update(); } });
  const nSlider = slider({ id: 'n', name: 'n', label: 'n (test harmonic)', min: 0, max: MAX_TEST_N, step: 1,
    decimals: 0, value: n, reset: DEFAULTS.n, onChange: (v) => { n = toN(v); update(); } });
  const controls = { ...inputs.controls, testFunction: fnSelect, n: nSlider };

  // ── Layout ──
  const STYLE = {
    input: { color: theme.muted, width: 4 },
    test: { color: theme.traces[2], width: 1.5, dash: 'dash' },
    product: { color: theme.ink, width: 2 },
    positive: translucent(theme.traces[0], SHADE_ALPHA),
    negative: translucent(theme.traces[1], SHADE_ALPHA),
  };
  const legendRow = (color, html, extra = '') => h('div', { class: 'fw-legend-row' },
    h('span', { class: 'fw-legend-line', style: `background:${color};${extra}` }), h('span', { html }));
  const swatch = 'height:12px';

  const plotDiv = h('div', { style: 'width:100%;height:100%' });
  const root = h('div', { class: 'fw-tool', 'data-tool': 'fourier', 'data-mode': id },
    h('aside', { class: 'fw-controls' },
      inputs.el,
      section('Test function', fnSelect.el, nSlider.el,
        h('div', { class: 'fw-hint' }, 'n = 0 is the DC test: cos 0 = 1 and sin 0 = 0.')),
      section('Legend',
        legendRow(STYLE.input.color, 'Input'),
        legendRow(STYLE.test.color, 'Test function'),
        legendRow(STYLE.product.color, 'Product: input × test function'),
        legendRow(STYLE.positive, 'Positive area', swatch),
        legendRow(STYLE.negative, 'Negative area', swatch))),
    h('div', { class: 'fw-displays' }, h('div', { class: 'fw-display', 'data-display': 'product' }, plotDiv)));
  container.append(root);

  // ── Plot ──
  const line = (name, x, y, style, extra = {}) => ({ name, x, y, mode: 'lines', line: style, hoverinfo: 'skip', ...extra });
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
    const data = traces();
    Plotly.react(plotDiv, data, layout(), PLOT_CONFIG);
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
      onChange: (f) => changes.on(f),
    },
    controls: controlRegistry(controls),
    displays: [{
      id: 'product',
      label: 'Product plot',
      snapshot: () => Plotly.toImage(plotDiv, { format: 'png', width: 720, height: 360 }),
      toScreen,
    }],
    serialize: () => ({ ...input, testFunction: fn, n }),
    restore(saved = {}) {
      inputs.restore(saved); // redraws once with the old test settings
      fnSelect.set(saved.testFunction); // ignored unless cos or sin
      nSlider.set(validN(saved.n) ? toN(saved.n) : n);
    },
    resize: box.fit,
    destroy() {
      box.disconnect();
      changes.clear();
      Plotly.purge(plotDiv);
      root.remove();
    },
  };
}
