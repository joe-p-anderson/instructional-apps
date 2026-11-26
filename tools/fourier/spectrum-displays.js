// The Analysis Mode's spectrum and filter-curve Displays (ticket 06), each a Plotly plot in its
// own .fw-display box.
//
// Each builder takes the plot theme and returns
//   { el, control, display, update(input, filter, source), fit, destroy }:
//   el        the .fw-display box, to place in the Mode's .fw-displays column
//   control   a Control with the Display's id, whose only job is hide()/show(): an Activity's
//             show and hide lists name Control ids, so this is how a Task hides the Display
//   display   the v1 Display { id, label, snapshot, toScreen } (snapshot works while hidden)
//   update    redraws for the input, the filter (engine form { type, fc, gain, phase }) and the
//             spectrum source ('input' | 'output'; the filter curves ignore it)
//
// Display ids (= Control ids): 'spectrum', 'filter-curves'.
//
// spectrum       Aₙ bars (left axis, V) and φₙ stems (right axis, degrees) for n = 0 … 10, of the
//                input or of the filtered output. The stems sit just right of their bars; a zero
//                term has no phase, so it has no stem.
// filter-curves  gain |H| (left axis) and phase shift ∠H (right axis, degrees) against f on a log
//                axis, with f_c marked and a dot at each harmonic n f₀ (n = 1 … 10) on both curves.
//                With the filter off it says so instead of drawing flat lines.

import { createControl } from '../../framework/v1/control.js';
import { h } from '../../framework/v1/ui-kit.js';
import { plotlyMapping } from '../../framework/v1/plot-map.js';
import { SPECTRUM_N, filterResponse, spectrum } from './engine.js';
import { PLOT_CONFIG, Plotly, fitToBox, themedLayout } from './plot.js';

const STEM_DX = 0.18; // how far right of its bar each φₙ stem sits (in n)
const CURVE_SAMPLES = 241;
const TYPE_LABELS = { lowpass: 'RC low-pass', highpass: 'RC high-pass' };

/** One Display box with a plot, its hide-only Control and its v1 Display. */
function plotBox(id, label, theme) {
  const plotDiv = h('div', { style: 'width:100%;height:100%' });
  const el = h('div', { class: 'fw-display', 'data-display': id, style: 'position:relative' }, plotDiv);
  const control = createControl({ id, label, el, get: () => !control.isHidden() });
  const { toScreen } = plotlyMapping(plotDiv);
  const display = {
    id,
    label,
    snapshot: () => Plotly.toImage(plotDiv, { format: 'png', width: 720, height: 300 }),
    toScreen,
  };
  let box = null;
  let drawn = false;
  const draw = (data, layout) => {
    if (drawn) Plotly.react(plotDiv, data, layout, PLOT_CONFIG);
    else { Plotly.newPlot(plotDiv, data, layout, PLOT_CONFIG); drawn = true; box = fitToBox(plotDiv); }
  };
  return {
    plotDiv, el, control, display, draw,
    fit: () => box?.fit(),
    destroy() { box?.disconnect(); Plotly.purge(plotDiv); },
  };
}

/** The layout with a second y axis on the right, each axis title in its trace's colour. */
function twinLayout(theme, { xTitle, xRange, xType, dtick, y1, y2, note }) {
  const base = themedLayout(theme, { xTitle, yTitle: y1.title, xRange, yRange: y1.range, dtick });
  const axis2 = { ...base.yaxis, title: { text: y2.title, standoff: 8, font: { color: y2.color } },
    range: y2.range, dtick: y2.dtick, overlaying: 'y', side: 'right', showgrid: false, zeroline: false };
  return {
    ...base,
    xaxis: { ...base.xaxis, type: xType, zeroline: false },
    yaxis: { ...base.yaxis, title: { ...base.yaxis.title, font: { color: y1.color } }, dtick: y1.dtick },
    yaxis2: axis2,
    margin: { ...base.margin, r: 60, t: note ? 24 : 14 },
    annotations: note ? [{ xref: 'paper', yref: 'paper', x: 0, y: 1, xanchor: 'left', yanchor: 'bottom',
      text: note, showarrow: false, font: { color: theme.text } }] : [],
  };
}

export function spectrumDisplay(theme) {
  const box = plotBox('spectrum', 'Spectrum', theme);
  const STYLE = { bar: theme.traces[0], stem: theme.traces[1] };

  function update(input, filter, source) {
    const entries = spectrum(input, filter, source);
    const ns = entries.map((e) => e.n);
    const amps = entries.map((e) => e.amp);
    const phased = entries.filter((e) => e.amp > 1e-12);
    const stemX = phased.map((e) => e.n + STEM_DX);
    const stemY = phased.map((e) => e.phase);
    const top = Math.max(...amps, 1e-9) * 1.15;
    const data = [
      { name: 'Aₙ', type: 'bar', x: ns, y: amps, width: 0.32, offset: -0.3, marker: { color: STYLE.bar },
        hoverinfo: 'skip' },
      { name: 'φₙ stem lines', x: phased.flatMap((e) => [e.n + STEM_DX, e.n + STEM_DX, null]),
        y: phased.flatMap((e) => [0, e.phase, null]), yaxis: 'y2', mode: 'lines',
        line: { color: STYLE.stem, width: 2 }, hoverinfo: 'skip' },
      { name: 'φₙ', x: stemX, y: stemY, yaxis: 'y2', mode: 'markers', marker: { color: STYLE.stem, size: 7 },
        hoverinfo: 'skip' },
    ];
    const note = source !== 'output' ? 'Input'
      : `Filtered output (${TYPE_LABELS[filter?.type] ?? 'the filter is off'})`;
    box.draw(data, twinLayout(theme, {
      xTitle: 'Harmonic n', xRange: [-0.6, SPECTRUM_N + 0.6], dtick: 1, note,
      y1: { title: 'Aₙ (V)', range: [0, top], color: STYLE.bar },
      y2: { title: 'φₙ (°)', range: [-200, 200], dtick: 90, color: STYLE.stem },
    }));
  }

  return { el: box.el, control: box.control, display: box.display, update, fit: box.fit, destroy: box.destroy };
}

export function filterCurveDisplay(theme) {
  const box = plotBox('filter-curves', 'Filter curves', theme);
  const STYLE = { gain: theme.traces[0], phase: theme.traces[1], fc: theme.traces[2] };
  const offNote = h('div', {
    class: 'fw-hint',
    style: 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px;text-align:center;padding:12px',
  }, 'The filter is off: choose RC low-pass or RC high-pass to see its gain and phase curves.');
  box.el.append(offNote);

  function update(input, filter) {
    const on = filterResponse(filter, 1) !== null;
    offNote.style.display = on ? 'none' : 'flex';
    box.plotDiv.style.visibility = on ? 'visible' : 'hidden';
    if (!on) { box.draw([], themedLayout(theme, { xTitle: 'Frequency f (Hz)', yTitle: '' })); return; }

    const harmonics = Array.from({ length: SPECTRUM_N }, (_, i) => (i + 1) * input.f0);
    const lo = Math.log10(Math.min(filter.fc, input.f0) / 3);
    const hi = Math.log10(Math.max(filter.fc, harmonics.at(-1)) * 3);
    const fs = Array.from({ length: CURVE_SAMPLES }, (_, i) => 10 ** (lo + ((hi - lo) * i) / (CURVE_SAMPLES - 1)));
    const curve = fs.map((f) => filterResponse(filter, f));
    const atH = harmonics.map((f) => filterResponse(filter, f));
    const line = (name, x, y, style, extra = {}) => ({ name, x, y, mode: 'lines', line: style, hoverinfo: 'skip', ...extra });
    const dots = (name, y, color, extra = {}) => ({ name, x: harmonics, y, mode: 'markers', hoverinfo: 'skip',
      marker: { color, size: 7, line: { color: theme.background, width: 1 } }, ...extra });
    const data = [
      line('f_c', [filter.fc, filter.fc], [0, 1.1], { color: STYLE.fc, width: 1.5, dash: 'dash' },
        { mode: 'lines+text', text: ['', 'f<sub>c</sub>'], textposition: 'bottom right', textfont: { color: STYLE.fc } }),
      line('Gain |H|', fs, curve.map((r) => r.gain), { color: STYLE.gain, width: 2 }),
      line('Phase ∠H', fs, curve.map((r) => r.phase), { color: STYLE.phase, width: 2 }, { yaxis: 'y2' }),
      dots('Harmonics on the gain', atH.map((r) => r.gain), STYLE.gain),
      dots('Harmonics on the phase', atH.map((r) => r.phase), STYLE.phase, { yaxis: 'y2' }),
    ];
    const applied = [filter.gain && 'gain', filter.phase && 'phase'].filter(Boolean);
    const note = `${TYPE_LABELS[filter.type]}; dots at n f<sub>0</sub>${applied.length === 2 ? '' : applied.length
      ? ` (only the ${applied[0]} is applied)` : ' (neither is applied)'}`;
    box.draw(data, twinLayout(theme, {
      xTitle: 'Frequency f (Hz)', xType: 'log', xRange: [lo, hi], note,
      y1: { title: 'Gain |H|', range: [0, 1.1], dtick: 0.5, color: STYLE.gain },
      y2: { title: 'Phase ∠H (°)', range: [-100, 100], dtick: 45, color: STYLE.phase },
    }));
  }

  return { el: box.el, control: box.control, display: box.display, update, fit: box.fit, destroy: box.destroy };
}
