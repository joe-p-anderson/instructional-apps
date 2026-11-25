// Activity: "Spacetime Diagrams" (PHY 1200), on the spacetime Tool. Follows Lab 10
// (spacetime/Lab10_spacetime.tex, its content and answer key) at v = 0.6c. Students count the
// tilted grid lines drawn over the Earth diagram instead of reading rocket coordinates: the
// K′ panel, the x′/t′ readouts and the measurements panel stay hidden.
//
// Pure data (no DOM): the runner core and Node tests import it directly. The page beside it
// (lab10.html) passes the spacetime Tool's Condition types to the runner. Prompts and Questions
// may use \( \) math.
//
// Conditions, numeric and choice keys, and Hints that give an answer away are encoded answer
// keys (framework/v1/authoring/encode-keys.html, or encodeKey() from framework/v1/runner/keys.js);
// decode one with decodeKey(). Tolerances: positions ±0.1, velocities ±0.01, numeric answers ±0.1.
// Points: 1 per Task with a Condition, none for a Task without one, 1 per Question.
//
// Every Part starts from the same Setup and the same staged Controls (STAGE, applied by each
// Part's first Task, and kept by the Tasks after it); a Part only adds which drawing tools it shows.

const SETUP = {
  v: 0.6,
  names: { K: 'Earth', Kp: 'Rocket' },
  grid: { K: true, Kp: true },
  showKp: false,
  objs: [],
};

const STAGE = {
  lock: ['v', 'gamma', 'flip'],
  hide: ['kp-panel', 'primed', 'measurements'],
};

/** A Part's first Task: STAGE plus the drawing tools the Part shows and hides. */
const staged = (task, { show = [], hide = [] }) =>
  ({ ...task, show, lock: STAGE.lock, hide: [...STAGE.hide, ...hide] });

const NUMERIC_TOL = 0.1;

const building = {
  id: 'building',
  title: 'Part 1: Building the diagram',
  mode: 'diagram',
  setup: SETUP,
  tasks: [
    staged({
      id: 'lamp',
      title: 'A lamp at rest',
      prompt: 'Here \\(c = 1\\): distances are in light-years (ly) and times in years (yr), so a light ray '
        + 'is a line at 45°. The square grid is Earth\'s \\((x, t)\\). The tilted grid is a rocket moving at '
        + '\\(0.6c\\), with coordinates \\((x\', t\')\\).<br>'
        + 'With the <b>Worldline</b> tool, draw the worldline of a lamp sitting still at \\(x = 2\\) ly.',
      condition: 'enc1:HVVZD0FFQVtRBhVBWgsXGAEeGwsLVgxJEFsBEF9HEHQuKHAaAB4AAEpVVVQLEk9DB1dbXAFGERsJUEhVQEVd',
      points: 1,
      hint: { after: 3, text: 'A lamp at rest stays at the same \\(x\\), so its worldline is vertical.' },
    }, { show: ['tool-select', 'tool-event', 'tool-worldline'], hide: ['tool-rod', 'tool-join'] }),
    {
      id: 'rocket',
      title: 'A rocket at \\(0.6c\\)',
      prompt: 'A rocket leaves \\(x = 0\\) at \\(t = 0\\) moving at \\(0.6c\\). Draw its worldline.',
      condition: 'enc1:HVVZD0FFQVtRBhVBWgsXGAEeGwsLVgxJEFsBEF1TSQI0ED1MEgoAH1ZGAVRJAllRX1cVThdUSVYRHR5HVEQOWhg',
      questions: [{
        id: 'x-at-5',
        kind: 'numeric',
        prompt: 'Where is the rocket at \\(t = 5\\) yr? \\(x =\\) (ly)',
        answer: 'enc1:VQ',
        tol: NUMERIC_TOL,
        points: 1,
      }],
      points: 1,
      hint: { after: 3, text: 'enc1:RDZZVm18S1FdQwIwcU1FAA0XUhcBF0sOEVlYTwUAF1NhdHwWEFxJEQMWTh4RWQYAAVtBLUQJRR0RUhQXARkAHw0cG08BDAJJL2QmSEJfRVYOV3EqGQhQTVNASDBxTUtW' },
    },
    {
      id: 'flash',
      title: 'A flash of light',
      prompt: 'A flash of light is sent both ways from \\(x = 0\\) at \\(t = 0\\). Draw both light rays.',
      condition: 'enc1:PQwPAkhQBkNJVxIYABMKBgkWHgwAEQJHRwwZGkJJR1UVKz4CCgAeAVdbDw4TGlNNUQFDVh1IRwAKHlBfXloRFkkCGVQKFQACe2YhVB1HX0MKE0EfX0VBTVEAQ1YAVUlWECYdCUxOEEVVSBcCC0dfEG1mJgIKABwTEhhBVAsQTVAOKA',
      points: 1,
      hint: { after: 3, text: 'enc1:RDtEEVlUQwIcAwQeXkRUVAkLUhULBgASF0MbTx0ARRR0huIAXFleVEYSTBVZABQAClUHHkIJRQANF1IKHB1HAgtXGQ' },
    },
    {
      id: 'light-limit',
      title: 'No tilt past 45°',
      prompt: 'Answer in a sentence or two.',
      questions: [{
        id: 'why',
        kind: 'text',
        prompt: 'Explain why no object\'s worldline can tilt farther from vertical than 45°.',
        points: 1,
      }],
      points: 0,
    },
    {
      id: 'rocket-axis',
      title: 'The rocket\'s worldline and the tilted grid',
      prompt: 'Your rocket\'s worldline lies on top of one of the tilted grid lines.',
      questions: [
        {
          id: 'which',
          kind: 'choice',
          prompt: 'Which tilted line is the rocket\'s worldline on?',
          choices: [
            { id: 'tp-axis', text: 'The \\(t\'\\) axis' },
            { id: 'xp-axis', text: 'The \\(x\'\\) axis' },
            { id: 'light', text: 'A light ray' },
            { id: 'none', text: 'None of them' },
          ],
          correct: 'enc1:RANdW1BYChJR',
          points: 1,
        },
        {
          id: 'why',
          kind: 'text',
          prompt: 'Explain why a rocket\'s own time axis has to be its own worldline.',
          points: 1,
        },
      ],
      points: 0,
    },
    {
      id: 'events-ef',
      title: 'Events \\(E\\) and \\(F\\)',
      prompt: 'Use the <b>Event</b> tool to mark the event \\(E\\) at \\((x, t) = (3, 5)\\) and the event '
        + '\\(F\\) at \\((x, t) = (5, 5)\\). Then count tilted lines to find each event\'s rocket coordinates '
        + '\\((x\', t\')\\). Count, don\'t measure: each step of the tilted grid is 1 ly or 1 yr in the rocket '
        + 'frame, even though it looks longer on the page.',
      condition: 'enc1:PQwPAkhQBkNJVxIYAAETEQsGUElMDAJRVlUZVFFfUAxjMD1MEgoAH1cKAQ0TVBoRFldbTl4QSBETFxwRTFgCE0dDDgxREUcadGhwVF9cEgtWWRwLbA',
      questions: [
        { id: 'xp-E', kind: 'numeric', prompt: '\\(x\'_E =\\) (ly)', answer: 'enc1:Vg', tol: NUMERIC_TOL, points: 1 },
        { id: 'tp-E', kind: 'numeric', prompt: '\\(t\'_E =\\) (yr)', answer: 'enc1:Ug', tol: NUMERIC_TOL, points: 1 },
        { id: 'xp-F', kind: 'numeric', prompt: '\\(x\'_F =\\) (ly)', answer: 'enc1:VFkY', tol: NUMERIC_TOL, points: 1 },
        { id: 'tp-F', kind: 'numeric', prompt: '\\(t\'_F =\\) (yr)', answer: 'enc1:VFkY', tol: NUMERIC_TOL, points: 1 },
      ],
      points: 1,
      hint: { after: 3, text: 'For \\(x\'\\) count the tilted lines parallel to the \\(t\'\\) axis; for \\(t\'\\) count those parallel to the \\(x\'\\) axis.' },
    },
    {
      id: 'light-speed',
      title: '\\(F\\) and the speed of light',
      prompt: '\\(F\\) lies on your light ray.',
      questions: [{
        id: 'says',
        kind: 'text',
        prompt: 'What do the rocket\'s coordinates of \\(F\\) say about the speed of light in the rocket frame?',
        points: 1,
      }],
      points: 0,
    },
  ],
};

export default {
  id: 'spacetime-lab10',
  version: 1,
  title: 'Spacetime Diagrams',
  course: 'PHY 1200',
  tool: 'spacetime',
  parts: [building],
};
