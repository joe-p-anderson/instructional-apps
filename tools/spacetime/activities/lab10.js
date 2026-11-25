// Activity: "Spacetime Diagrams" (PHY 1200), on the spacetime Tool. Follows Lab 10's first two
// sections (Part 1: Building the diagram; Part 2: Relativity of simultaneity), from the handout
// source beside the Tool (../Lab10_spacetime.tex, its content and answer key) at v = 0.6c. Students count the
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

const simultaneity = {
  id: 'simultaneity',
  title: 'Part 2: Relativity of simultaneity',
  mode: 'diagram',
  setup: SETUP,
  tasks: [
    staged({
      id: 'ends-flash',
      title: 'The rocket\'s ends and the flash',
      prompt: 'A rocket 4 ly long (in its own frame) moves at \\(0.6c\\). A lamp at its exact middle flashes '
        + 'at \\(t = t\' = 0\\), at the origin. Detectors at the back (\\(x\' = -2\\)) and the front '
        + '(\\(x\' = +2\\)) record when the light reaches them.<br>'
        + 'With the <b>Worldline</b> tool, trace the worldlines of the back and the front of the rocket along '
        + 'the tilted grid. Then draw the flash going each way.',
      condition: 'enc1:PQwPAkhQBkNJVxIYABMKBgkWHgwAEQJHRwwZGkNLUwxjMQZPXBIKAUhHHFoTWEFbXkRPWgFGEVZfQl5HGhtMSV9JFREOSR4CNT0iRRIKEkISWloZQ0wHDRobBE4BRhBWX0JcU0JWVT8KFRkaQ0tVEW1mKgIKAR4HSlVZVAsQT0MHGg1OF1RLRRheCUcaDVAOR0MZUwdIEk8zKDZMWV5VE0pVWFQLEU9DBiEOAA9eVVpVQ15HFlYaW0lbTwJJVUkCNSs-AgoAHgAbW1ZURVkTBFFPQx9ZSRIbFx4WCQcaRUlJW04CSUhUDGMxBk9cEgoBSEccWhNYQVtDWUMYD15VWEcGHQlMThBFVARm',
      points: 1,
      hint: { after: 3, text: 'enc1:RDJMFVkABg8XVRIYTB0WVAQGUgROF08FFg1aTgdFOXxpPHV8bBkQGTorBVsDfD9IUxQPCA04OVxOQC45R10MSxYWG0kHRRdVLzdyUFFCUV0KEkFWRU9DFRsQQTBxTBFTOS5bRQ8MSRhLWXpUUzk5CDVkbwAAbGwYRgNFGUJFQw0aGwQfDQcXGxYBUjkyXFhLWFlnfB4VRRFvcg58GR4QZQ4SQ1ZQRAdBERoVBA0IDBMNBlIXDw1TRUc' },
    }, { show: ['tool-select', 'tool-event', 'tool-worldline'], hide: ['tool-rod', 'tool-join'] }),
    {
      id: 'marks-bf',
      title: 'Mark \\(B\\) and \\(F\\)',
      prompt: 'Use the <b>Event</b> tool to mark \\(B\\), where the light reaches the back, and \\(F\\), where it '
        + 'reaches the front. Then count tilted lines to find the rocket time \\(t\'\\) of each.',
      condition: 'enc1:PQwPAkhQBkNJVxIYAAETEQsGUElMDAJRSEgXAgdHXxFtZiZPXBIKAUhGUFpKAhcYAxBDVg8XEVkABBcLGlYMSR1bARRfRxECe3B-AkRfXBNcRwNHTH0',
      questions: [
        { id: 'tp-B', kind: 'numeric', prompt: '\\(t\'_B =\\) (yr)', answer: 'enc1:VA', tol: NUMERIC_TOL, points: 1 },
        { id: 'tp-F', kind: 'numeric', prompt: '\\(t\'_F =\\) (yr)', answer: 'enc1:VA', tol: NUMERIC_TOL, points: 1 },
      ],
      points: 1,
      hint: { after: 3, text: '\\(B\\) is where the leftward ray meets the back\'s worldline; \\(F\\) is where the rightward ray meets the front\'s.' },
    },
    {
      id: 'earth-times',
      title: 'Earth times',
      prompt: 'Now read the Earth time \\(t\\) of each event off the square grid.',
      questions: [
        { id: 't-B', kind: 'numeric', prompt: '\\(t_B =\\) (yr)', answer: 'enc1:Vw', tol: NUMERIC_TOL, points: 1 },
        { id: 't-F', kind: 'numeric', prompt: '\\(t_F =\\) (yr)', answer: 'enc1:Ug', tol: NUMERIC_TOL, points: 1 },
        {
          id: 'first',
          kind: 'choice',
          prompt: 'Which arrival happens first in the Earth frame?',
          choices: [
            { id: 'B', text: 'The light reaches the back (\\(B\\)) first' },
            { id: 'F', text: 'The light reaches the front (\\(F\\)) first' },
            { id: 'both', text: 'Both at once' },
          ],
          correct: 'enc1:RDUP',
          points: 1,
        },
      ],
      points: 0,
    },
    {
      id: 'back-first',
      title: 'Why the back is reached first',
      prompt: 'Answer in a sentence or two.',
      questions: [{
        id: 'why',
        kind: 'text',
        prompt: 'Explain, from the point of view of someone on Earth, why the back is reached first.',
        points: 1,
      }],
      points: 0,
    },
    {
      id: 'rod-bf',
      title: 'Connect \\(B\\) and \\(F\\)',
      prompt: 'Use the <b>Rod</b> tool to lay a rod with one end at \\(B\\) and the other at \\(F\\). '
        + 'A rod lies along a line of simultaneity in its frame: choose the frame it is simultaneous in.',
      condition: 'enc1:HVVZD0FFQVtRBhVBXwsBVklQFwsKBwJRPiIWEV9UOAwacH4UbW0cExIYQVQLEE1QDg',
      questions: [
        {
          id: 'parallel',
          kind: 'choice',
          prompt: 'Which grid lines is the line from \\(B\\) to \\(F\\) parallel to?',
          choices: [
            { id: 't-axis', text: 'The \\(t\\) axis' },
            { id: 'x-axis', text: 'The \\(x\\) axis' },
            { id: 'tp-axis', text: 'The \\(t\'\\) axis' },
            { id: 'xp-axis', text: 'The \\(x\'\\) axis' },
            { id: 'light', text: 'A light ray' },
          ],
          correct: 'enc1:RA9dW1BYChJR',
          points: 1,
        },
        {
          id: 'says',
          kind: 'text',
          prompt: 'In one sentence, what does that say about the word "simultaneous"?',
          points: 1,
        },
      ],
      points: 1,
      show: ['tool-rod'],
      hint: { after: 3, text: 'Use the <b>Rod</b> tool, set the rod\'s frame to the rocket\'s, and drag its ends onto \\(B\\) and \\(F\\).' },
    },
  ],
};

export default {
  id: 'spacetime-lab10',
  version: 1,
  title: 'Spacetime Diagrams',
  course: 'PHY 1200',
  tool: 'spacetime',
  parts: [building, simultaneity],
};
