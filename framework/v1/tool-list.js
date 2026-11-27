// Every Tool on the site: its id (the folder tools/<id>/, holding the Tool module <id>.js and
// its Standalone page index.html) and its title (that page's title). No DOM. The Activity
// editor offers these when a new Activity is made, and the cross-Tool e2e checks run over them.
// tests/unit/framework/tool-list.test.js keeps it in step with the tools folder.

export const TOOLS = Object.freeze([
  { id: 'bench-scope', title: 'Bench Oscilloscope' },
  { id: 'electrostatics', title: 'Electrostatics' },
  { id: 'fourier', title: 'Fourier Series' },
  { id: 'least-squares', title: 'Least Squares Fitting' },
  { id: 'oscilloscope', title: 'Oscilloscope' },
  { id: 'phasors', title: 'Phasors and Impedance' },
  { id: 'spacetime', title: 'Spacetime Diagrams' },
  { id: 'vernier', title: 'Vernier Caliper' },
].map((t) => Object.freeze(t)));
