// Fourier Series Tool (framework v1): synthesis and analysis of periodic signals.
//
// Each Mode is its own module in ./modes/ exporting { id, title, mount(container, setup) },
// which returns a v1 ToolInstance. To add a Mode, write its module and list it in MODES.
// Shared pieces: engine.js (the pure Fourier maths, no DOM), plot.js (Plotly layout and fit).
// See each Mode module's header for its Setup, State, Controls and Displays.

import { defineTool } from '../../framework/v1/tool.js';
import * as synthesis from './modes/synthesis.js';
import * as analysis from './modes/analysis.js';

const MODES = [synthesis, analysis];

function mount(container, modeId = MODES[0].id, setup = {}) {
  const mode = MODES.find((m) => m.id === modeId);
  if (!mode) throw new Error(`fourier: unknown Mode '${modeId}'`);
  return mode.mount(container, setup || {});
}

export default defineTool({
  id: 'fourier',
  title: 'Fourier Series',
  modes: MODES.map(({ id, title, setupKeys }) => ({ id, title, setupKeys })),
  layout: 'side',
  mount,
});
