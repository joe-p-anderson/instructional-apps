// Phasors Tool (framework v1): adding sinusoids as phasors, impedance, and series RLC circuits.
//
// Each Mode is its own module in ./modes/ exporting { id, title, mount(container, setup) },
// which returns a v1 ToolInstance. To add a Mode, write its module and list it in MODES.
// Shared pieces: engine.js (the pure phasor maths, no DOM), format.js (readout text),
// draw.js (canvas planes and plots), number-input.js (a number-box Control), styles.js.
// See each Mode module's header for its Setup, State, Controls and Displays.

import { defineTool } from '../../framework/v1/tool.js';
import * as circuit from './modes/circuit.js';
import * as sum from './modes/sum.js';

const MODES = [sum, circuit];

function mount(container, modeId = MODES[0].id, setup = {}) {
  const mode = MODES.find((m) => m.id === modeId);
  if (!mode) throw new Error(`phasors: unknown Mode '${modeId}'`);
  return mode.mount(container, setup || {});
}

export default defineTool({
  id: 'phasors',
  title: 'Phasors and Impedance',
  modes: MODES.map(({ id, title }) => ({ id, title })),
  layout: 'side',
  mount,
});
