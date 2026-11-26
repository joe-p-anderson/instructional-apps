import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner } from '../../../framework/v1/runner/index.js';
import { decodeActivity, decodeKey, isEncodedKey } from '../../../framework/v1/runner/keys.js';
import activity from '../../../tools/electrostatics/activities/conductor-properties.js';
import { stubTool } from '../runner/stub-tool.js';

// Stub electrostatics Mode instances: the real State names and Control ids, with the
// old app's default Setup as the starting State.
const MODES = {
  'electric-field': {
    state: { Q: 0, E0x: 0, E0y: 0, E0mag: 0, E0angle: 0, theta: 0, induce: false, showCharges: true, Emax: 0 },
    controls: ['Q', 'theta', 'E0', 'induce', 'showCharges'],
  },
  potential: {
    state: {
      Q: 1, x1: -6, y1: -6, x2: 7, y2: 7, r1: Math.hypot(6, 6), r2: Math.hypot(7, 7),
      V1: 0, V2: 0, dV: 0, lockToSurface: false, measureAtInfinity: false,
    },
    controls: ['Q', 'P1', 'P2', 'lockToSurface', 'measureAtInfinity'],
  },
  gauss: {
    state: { lambda: 1, E0x: 0, E0y: 0, xc: 8, yc: 0, r: 2, dist: 8, outer: 10, inner: 6, Qenc: 0 },
    controls: ['lambda', 'E0', 'center', 'radius'],
  },
};

// Labels and units as the Modes describe them, where a test reads miss feedback.
const DESCRIBE = { E0mag: { label: '|E₀|', unit: 'V/m' } };

function stubMode(modeId) {
  const { state, controls } = MODES[modeId];
  const defs = Object.fromEntries(Object.entries(state).map(([k, value]) => [k, { value, ...DESCRIBE[k] }]));
  return stubTool({ state: defs, controls });
}

function start() {
  const tools = Object.fromEntries(activity.parts.map((p) => [p.id, stubMode(p.mode)]));
  const runner = createRunner(activity, { tools });
  runner.start('Ada');
  return { runner, tools };
}

const byMode = (mode) => activity.parts.find((p) => p.mode === mode);
const ANSWERS = (task) => Object.fromEntries((task.questions ?? []).map((q) => [q.id, 'Modus tollens.']));

// Each Task, a State patch that passes it, and patches that must still miss.
const CASES = [
  { mode: 'electric-field', task: 0, pass: { E0x: 300, E0mag: 300 }, misses: [] },
  { mode: 'electric-field', task: 1, pass: { Q: 1, theta: 0.4 }, misses: [{ Q: 1 }, { theta: 0.4 }, { Q: -1, theta: 0.4 }] },
  {
    mode: 'potential', task: 0, pass: { r1: 2, r2: 3 },
    misses: [{ r1: 2 }, { r2: 3 }, { r1: 2, r2: 6, measureAtInfinity: false }],
  },
  { mode: 'potential', task: 0, pass: { r1: 2, r2: 20, measureAtInfinity: true }, misses: [{ measureAtInfinity: true }] },
  { mode: 'potential', task: 1, pass: { lockToSurface: true }, misses: [] },
  { mode: 'gauss', task: 0, pass: { dist: 1, outer: 4, inner: 2 }, misses: [{ outer: 6, inner: 2 }] },
  { mode: 'gauss', task: 1, pass: { dist: 5, outer: 7, inner: 3 }, misses: [{ outer: 4, inner: 0 }, { outer: 12, inner: 8 }] },
];

// Pass the Tasks before `index` in a Part, so the Task under test is open.
function openTask(runner, tools, part, index) {
  const earlierTasks = CASES.filter((c, i) => c.mode === part.mode && c.task < index
    && CASES.findIndex((d) => d.mode === c.mode && d.task === c.task) === i);
  for (const earlier of earlierTasks) {
    tools[part.id].setState(earlier.pass);
    runner.submit(part.id, part.tasks[earlier.task].id, ANSWERS(part.tasks[earlier.task]));
  }
  tools[part.id].setState(MODES[part.mode].state);
}

test('the Activity is "Conductor Properties" for PHY 4300, one Part per electrostatics Mode', () => {
  assert.equal(activity.id, 'conductor-properties');
  assert.equal(activity.course, 'PHY 4300');
  assert.equal(activity.title, 'Conductor Properties');
  assert.equal(activity.tool, 'electrostatics');
  assert.deepEqual(activity.parts.map((p) => p.mode), ['electric-field', 'potential', 'gauss']);
  assert.deepEqual(activity.parts.map((p) => p.tasks.length), [2, 2, 2]);
});

test('each Part starts from the old default Setup', () => {
  assert.deepEqual(byMode('electric-field').setup, { Q: 0, E0x: 0, E0y: 0, theta: 0, induce: false, showCharges: true });
  assert.deepEqual(byMode('potential').setup, { Q: 1, x1: -6, y1: -6, x2: 7, y2: 7, lockToSurface: false, measureAtInfinity: false });
  assert.deepEqual(byMode('gauss').setup, { lambda: 1, E0x: 0, E0y: 0, xc: 8, yc: 0, r: 2 });
});

test('every Control of every Mode stays shown and unlocked', () => {
  const { tools } = start();
  for (const part of activity.parts) {
    for (const id of MODES[part.mode].controls) {
      const c = tools[part.id].controls.get(id);
      assert.equal(c.isLocked, false, `${part.id}/${id} locked`);
      assert.equal(c.isVisible, true, `${part.id}/${id} hidden`);
    }
  }
});

test('the prompts and free-text Questions are the old ones, word for word', () => {
  const asked = activity.parts.flatMap((p) => p.tasks.map((t) => [t.prompt, t.questions.map((q) => [q.kind, q.prompt])]));
  assert.deepEqual(asked.map(([prompt]) => prompt.split('\n')[0]), [
    'Apply a bulk field.',
    'Change the surface field.',
    'Try measuring the potential inside the conductor.',
    'Try measuring the potential difference of surface paths.',
    'Explore the charge in the bulk.',
    'Explore the charge at the surface.',
  ]);
  assert.deepEqual(asked.map(([, qs]) => qs), [
    [['text', 'What must be true of the electric field in the bulk of a conductor in electrostatic equilibrium and why?']],
    [['text', 'What must be true of the electric field at the surface of a conductor in electrostatic equilibrium and why?']],
    [['text', 'What must be true about the potential field inside a conductor? Why?']],
    [['text', 'How is the potential field at the surface of a conductor related to the value inside? Why?']],
    [['text', 'What must be true of the charge density in the bulk and why?']],
    [['text', 'What must be true of the charge at the surface of a conductor and why?']],
  ]);
});

for (const c of CASES) {
  const part = byMode(c.mode);
  const task = part.tasks[c.task];
  test(`${task.id} misses at the default Setup, misses off target and passes at ${JSON.stringify(c.pass)}`, () => {
    const { runner, tools } = start();
    openTask(runner, tools, part, c.task);
    assert.equal(runner.submit(part.id, task.id, ANSWERS(task)).passed, false, 'passed at the default Setup');
    for (const miss of c.misses) {
      tools[part.id].setState(MODES[part.mode].state);
      tools[part.id].setState(miss);
      assert.equal(runner.submit(part.id, task.id, ANSWERS(task)).passed, false, `passed at ${JSON.stringify(miss)}`);
    }
    tools[part.id].setState(MODES[part.mode].state);
    tools[part.id].setState(c.pass);
    assert.equal(runner.submit(part.id, task.id, ANSWERS(task)).passed, true);
  });
}

test('values merely passed through are not evaluated: only the State at Submit counts', () => {
  const { runner, tools } = start();
  const part = byMode('electric-field');
  const t = tools[part.id];
  t.setState({ E0x: 500, E0mag: 500 });
  t.setState({ E0x: 0, E0mag: 0 });
  assert.equal(runner.submit(part.id, part.tasks[0].id).passed, false);
  assert.equal(runner.task(part.id, part.tasks[0].id).status, 'open');
});

test('a miss on |E₀| says what it is and what is needed', () => {
  const { runner } = start();
  const part = byMode('electric-field');
  const miss = runner.submit(part.id, part.tasks[0].id);
  assert.match(miss.results[0].feedback, /\|E₀\| = 0 V\/m; need > 0/);
});

test('each Task shows its Hint from the spec after 3 misses', () => {
  const HINTS = [
    'Drag the E₀ joystick away from its centre, or type a nonzero E₀x or E₀y.',
    'Give the conductor a positive charge Q, then move the θ picker off zero.',
    'Drag P1 inside the conductor. Then put P2 inside too, or turn on measure at infinity.',
    'Turn on lock to surface.',
    'Shrink or move the Gaussian surface until all of it lies inside the conductor.',
    'Make the Gaussian surface straddle the conductor’s edge, partly inside and partly outside.',
  ];
  const seen = [];
  for (const part of activity.parts) {
    for (const [i, task] of part.tasks.entries()) {
      const { runner, tools } = start();
      openTask(runner, tools, part, i);
      // Each miss is a different try (an identical repeat would be refused).
      for (let n = 0; n < 2; n++) runner.submit(part.id, task.id, { try: n });
      assert.equal(runner.task(part.id, task.id).hint, null, `${task.id} Hint before 3 misses`);
      runner.submit(part.id, task.id, { try: 2 });
      seen.push(runner.task(part.id, task.id).hint);
    }
  }
  assert.deepEqual(seen, HINTS);
});

test('each Task earns 1 point and each free-text Question 1, for 12 in total', () => {
  const tasks = activity.parts.flatMap((p) => p.tasks);
  assert.ok(tasks.every((t) => t.points === 1));
  assert.ok(tasks.every((t) => t.questions.length === 1 && t.questions[0].points === 1));
  const { runner } = start();
  assert.equal(runner.score().possible, 12);
});

test('Conditions and Hints are encoded, and every encoded key decodes', () => {
  const tasks = activity.parts.flatMap((p) => p.tasks);
  for (const t of tasks) {
    assert.ok(isEncodedKey(t.condition), `${t.id} Condition is encoded`);
    assert.ok(isEncodedKey(t.hint.text), `${t.id} Hint is encoded`);
    assert.equal(t.hint.after, 3);
  }
  const decoded = decodeActivity(activity).parts.flatMap((p) => p.tasks);
  for (const t of decoded) {
    assert.ok(t.condition && typeof t.condition === 'object', `${t.id} Condition decodes`);
    assert.equal(typeof decodeKey(t.hint.text), 'string');
  }
});
