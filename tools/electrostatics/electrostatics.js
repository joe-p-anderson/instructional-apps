// Electrostatics Tool (framework v1): a circular conductor (radius 5 cm, ±10 cm window).
// Ported from Finished/conductor_properties.html.
//
// Each Mode is its own module in ./modes/ exporting { id, title, mount(container, setup) },
// which returns a v1 ToolInstance. To add a Mode, write its module and list it in MODES.
// Shared pieces: conductor.js (DOM-free maths), controls.js (the E₀ joystick and θ arc picker
// Controls), plot.js (Plotly layout and traces, theme colours, the Display wrapper).
// See each Mode module's header for its Setup, State, Controls and Displays.

import { defineTool } from '../../framework/v1/tool.js';
import * as electricField from './modes/electric-field.js';
import * as potential from './modes/potential.js';
import * as gauss from './modes/gauss.js';

const MODES = [electricField, potential, gauss];

function mount(container, modeId = MODES[0].id, setup = {}) {
  const mode = MODES.find((m) => m.id === modeId);
  if (!mode) throw new Error(`electrostatics: unknown Mode '${modeId}'`);
  return mode.mount(container, setup || {});
}

export default defineTool({
  id: 'electrostatics',
  title: 'Electrostatics',
  modes: MODES.map(({ id, title, setupKeys }) => ({ id, title, setupKeys })),
  // The plot is square: on a wider Display the colour bar drifts far from it at the right edge.
  maxDisplayWidth: 1200,
  mount,
});
