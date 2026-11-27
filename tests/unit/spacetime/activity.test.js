// Seam 2 (Spec 0003): the "Spacetime Diagrams" Activity (Lab 10) driven through the runner core.
// The stub Tool's `diagram` State is built from real diagram objects, and the spacetime Tool's
// Condition types are passed to the runner, as the Activity page does.
//
// Each Part is one entry in PARTS below: the handout's answer diagram, the answers that pass
// each Task, and the Part's point total. Adding a Part means adding an entry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRunner, decodeKey, isEncodedKey } from '../../../framework/v1/runner/index.js';
import { readFileSync } from 'node:fs';
import { conditionTypes, diagramState } from '../../../tools/spacetime/conditions.js';
import { stubTool } from '../runner/stub-tool.js';

const ACTIVITY_FILE = new URL('../../../tools/spacetime/activities/lab10.json', import.meta.url);
const activity = JSON.parse(readFileSync(ACTIVITY_FILE, 'utf8'));

// Every Control the spacetime Tool registers (see tools/spacetime/spacetime.js).
const CONTROLS = [
  'tool-select', 'tool-event', 'tool-worldline', 'tool-rod', 'tool-join',
  'v', 'gamma', 'flip', 'grid-K', 'grid-Kp', 'kp-panel', 'primed', 'measurements',
  'undo', 'redo', 'export-json', 'import-json', 'new', 'reset-view', 'save-png',
];

// Diagram objects in the saved format (as in tests/unit/spacetime/conditions.test.js).
const ev = (id, x, t, home = 'K') => ({ id, kind: 'event', home, x, t, label: '', color: '#D55E00' });
const param = (id, u, x0, frame = 'K') => ({ id, kind: 'wl', mode: 'param', frame, u, x0, label: '', color: '#0072B2' });
const rod = (id, frame, T, x1, x2, wl1 = null, wl2 = null) =>
  ({ id, kind: 'rod', frame, T, ends: [{ x: x1, wl: wl1 }, { x: x2, wl: wl2 }], label: '', color: '#009E73' });

const V = 0.6;

const PARTS = {
  // Lab 10 Section 1, from the handout's answer key.
  building: {
    answer: [
      param(1, 0, 2), // lamp at x = 2
      param(2, 0.6, 0), // rocket from the origin
      param(3, 1, 0), param(4, -1, 0), // the flash, both ways
      ev(5, 3, 5), ev(6, 5, 5), // E and F
    ],
    answers: {
      rocket: { 'x-at-5': '3' },
      'light-limit': { why: 'A tilt past 45° covers more than 1 ly per yr: faster than light.' },
      'rocket-axis': { which: 'tp-axis', why: 'The rocket sits at x′ = 0, which is the t′ axis.' },
      'events-ef': { 'xp-E': '0', 'tp-E': '4', 'xp-F': '2.5', 'tp-F': '2.5' },
      'light-speed': { says: 'x′ = t′, so light covers 1 ly per yr in the rocket frame too.' },
    },
    points: 13,
  },
  // Lab 10 Section 2: a 4 ly rocket (ends at x′ = ∓2) with a lamp at its middle flashing at the origin.
  simultaneity: {
    answer: [
      param(1, 0.6, -1.6), param(2, 0.6, 1.6), // the back and the front
      param(3, 1, 0), param(4, -1, 0), // the flash, both ways
      ev(5, -1, 1), ev(6, 4, 4), // B and F
      rod(7, 'Kp', 2, -2, 2), // the rocket-frame rod from B to F
    ],
    answers: {
      'marks-bf': { 'tp-B': '2', 'tp-F': '2' },
      'earth-times': { 't-B': '1', 't-F': '4', first: 'B' },
      'back-first': { why: 'The back moves toward the flash and the front runs away from it.' },
      'rod-bf': { parallel: 'xp-axis', says: 'Simultaneous depends on the frame.' },
    },
    points: 11,
  },
};

/** A stub spacetime Tool whose `diagram` State is built from real objects. */
function spacetime() {
  const tool = stubTool({
    state: {
      v: { value: V, label: 'v', unit: 'c' },
      diagram: { value: diagramState({ v: V, objs: [] }), label: 'Diagram' },
    },
    controls: CONTROLS,
  });
  tool.draw = (objs) => tool.setState({ diagram: diagramState({ v: V, objs }) });
  return tool;
}

function start() {
  const tools = Object.fromEntries(activity.parts.map((p) => [p.id, spacetime()]));
  const runner = createRunner(activity, { tools, conditionTypes });
  runner.start('Ada');
  return { runner, tools };
}

/** Pass every Task of a Part before `stopAt`, in order, at the answer diagram. */
function passUpTo(runner, tools, part, stopAt) {
  tools[part.id].draw(PARTS[part.id].answer);
  for (const task of part.tasks) {
    if (task.id === stopAt) return;
    const attempt = runner.submit(part.id, task.id, PARTS[part.id].answers[task.id]);
    assert.equal(attempt.passed, true, `Task "${task.id}" passes at the answer: ${JSON.stringify(attempt.results)}`);
  }
}

const exposure = (tool) => Object.fromEntries(CONTROLS.map((id) => {
  const c = tool.controls.get(id);
  return [id, !c.isVisible ? 'hidden' : c.isLocked ? 'locked' : 'open'];
}));

const part1 = activity.parts.find((p) => p.id === 'building');
const part2 = activity.parts.find((p) => p.id === 'simultaneity');

test('the Activity is "Spacetime Diagrams" for PHY 1200, on the spacetime Tool', () => {
  assert.equal(activity.id, 'spacetime-lab10');
  assert.equal(activity.course, 'PHY 1200');
  assert.equal(activity.title, 'Spacetime Diagrams');
  assert.equal(activity.tool, 'spacetime');
  assert.deepEqual(activity.parts.map((p) => p.id), Object.keys(PARTS));
});

test('every Part starts at v = 0.6 with the K′ grid drawn over an empty Earth diagram and the K′ panel off', () => {
  for (const part of activity.parts) {
    assert.equal(part.mode, 'diagram');
    assert.equal(part.setup.v, 0.6);
    assert.equal(part.setup.grid.Kp, true);
    assert.equal(part.setup.showKp, false);
    assert.deepEqual(part.setup.objs, []);
  }
});

test('Part 1 is Lab 10 Section 1: Tasks 1.1–1.7', () => {
  assert.deepEqual(part1.tasks.map((t) => t.id),
    ['lamp', 'rocket', 'flash', 'light-limit', 'rocket-axis', 'events-ef', 'light-speed']);
});

test('Part 2 is Lab 10 Section 2: Tasks 2.1–2.5', () => {
  assert.equal(part2.title, 'Part 2: Relativity of simultaneity');
  assert.deepEqual(part2.tasks.map((t) => t.id),
    ['ends-flash', 'marks-bf', 'earth-times', 'back-first', 'rod-bf']);
});

for (const part of activity.parts) {
  for (const task of part.tasks.filter((t) => t.condition)) {
    test(`Part "${part.id}", Task "${task.id}": the Condition fails on an empty diagram and passes on the handout's answer`, () => {
      const { runner, tools } = start();
      passUpTo(runner, tools, part, task.id);
      tools[part.id].draw([]);
      const miss = runner.submit(part.id, task.id, PARTS[part.id].answers[task.id]);
      assert.equal(miss.passed, false);
      assert.ok(miss.results.some((r) => r.kind !== 'question' && r.pass === false));
      tools[part.id].draw(PARTS[part.id].answer);
      assert.equal(runner.submit(part.id, task.id, PARTS[part.id].answers[task.id]).passed, true);
    });
  }
}

test('a Part 1 drawing just outside the tolerances misses', () => {
  const { runner, tools } = start();
  const t = tools.building;
  t.draw([param(1, 0, 2.15)]); // lamp 0.15 ly off
  assert.equal(runner.submit('building', 'lamp').passed, false);
  t.draw([param(1, 0, 2.05)]);
  assert.equal(runner.submit('building', 'lamp').passed, true);

  t.draw([param(2, 0.62, 0)]); // rocket 0.02c too fast
  assert.equal(runner.submit('building', 'rocket', { 'x-at-5': '3' }).passed, false);
  t.draw([param(2, 0.605, 0)]);
  assert.equal(runner.submit('building', 'rocket', { 'x-at-5': '3.2' }).passed, false); // answer outside ±0.1
  assert.equal(runner.submit('building', 'rocket', { 'x-at-5': '3.05' }).passed, true);

  t.draw([param(3, 1, 0)]); // only one light ray
  const one = runner.submit('building', 'flash');
  assert.equal(one.passed, false);
  assert.match(one.results.find((r) => r.pass === false).feedback, /No light ray going left/);
});

test('Task 1.6 needs both events and all four rocket coordinates', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part1, 'events-ef');
  const answers = PARTS.building.answers['events-ef'];
  tools.building.draw([...PARTS.building.answer.slice(0, 4), ev(5, 3, 5)]); // F missing
  assert.equal(runner.submit('building', 'events-ef', answers).passed, false);
  tools.building.draw(PARTS.building.answer);
  assert.equal(runner.submit('building', 'events-ef', { ...answers, 'tp-E': '5' }).passed, false); // t, not t′
  assert.equal(runner.submit('building', 'events-ef', { ...answers, 'xp-F': '2.45' }).passed, true);
});

test('Task 1.5 takes the t′ axis as the rocket\'s grid line', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part1, 'rocket-axis');
  const { why } = PARTS.building.answers['rocket-axis'];
  for (const wrong of ['xp-axis', 'light', 'none']) {
    assert.equal(runner.submit('building', 'rocket-axis', { which: wrong, why }).passed, false);
  }
  assert.equal(runner.submit('building', 'rocket-axis', { which: 'tp-axis', why }).passed, true);
});

test('Part 1 exposure: v, γ and flip locked; K′ panel, primed and measurements hidden; rod and join hidden', () => {
  const { runner, tools } = start();
  const expected = {
    'tool-select': 'open', 'tool-event': 'open', 'tool-worldline': 'open', 'tool-rod': 'hidden', 'tool-join': 'hidden',
    v: 'locked', gamma: 'locked', flip: 'locked',
    'kp-panel': 'hidden', primed: 'hidden', measurements: 'hidden',
  };
  assert.deepEqual(exposure(tools.building), { ...exposure(tools.building), ...expected });
  // It holds for every Task of the Part.
  tools.building.draw(PARTS.building.answer);
  for (const task of part1.tasks) {
    assert.deepEqual(exposure(tools.building), { ...exposure(tools.building), ...expected }, `at Task "${task.id}"`);
    assert.equal(runner.submit('building', task.id, PARTS.building.answers[task.id]).passed, true);
  }
});

test('Part 2 exposure: staged like Part 1, with the rod tool hidden until Task 2.5 and shown from then on', () => {
  const { runner, tools } = start();
  const staged = {
    'tool-select': 'open', 'tool-event': 'open', 'tool-worldline': 'open', 'tool-join': 'hidden',
    v: 'locked', gamma: 'locked', flip: 'locked',
    'kp-panel': 'hidden', primed: 'hidden', measurements: 'hidden',
  };
  const t = tools.simultaneity;
  t.draw(PARTS.simultaneity.answer);
  for (const task of part2.tasks) {
    const rodTool = task.id === 'rod-bf' ? 'open' : 'hidden';
    assert.deepEqual(exposure(t), { ...exposure(t), ...staged, 'tool-rod': rodTool }, `at Task "${task.id}"`);
    assert.equal(runner.submit('simultaneity', task.id, PARTS.simultaneity.answers[task.id]).passed, true);
  }
  // Once every Task has passed, the rod tool stays shown.
  assert.equal(exposure(t)['tool-rod'], 'open');
});

test('Task 2.5 passes only for a rod with its ends at B and F', () => {
  const lines = PARTS.simultaneity.answer.slice(0, 6);
  const answers = PARTS.simultaneity.answers['rod-bf'];
  const judged = (r) => {
    const { runner, tools } = start();
    passUpTo(runner, tools, part2, 'rod-bf');
    tools.simultaneity.draw([...lines, r]);
    return runner.submit('simultaneity', 'rod-bf', answers).passed;
  };
  assert.equal(judged(rod(7, 'K', 1, -1, 4)), false, 'an Earth-frame rod from B can\'t reach F');
  assert.equal(judged(rod(7, 'K', 4, -1, 4)), false, 'nor one through F reach B');
  assert.equal(judged(rod(7, 'Kp', 2, -2, 1.8)), false, 'a rocket rod short of F');
  assert.equal(judged(rod(7, 'Kp', 2.2, -2, 2)), false, 'a rocket rod on a later "now" line');
  assert.equal(judged(rod(7, 'Kp', 2, 2, -2)), true, 'its ends in either order');
  assert.equal(judged(rod(7, 'Kp', 2, 0, 0, 1, 2)), true, 'its ends riding the back and front worldlines');
  assert.equal(judged(rod(7, 'Kp', 2, -2.05, 2.05)), true, 'within the tolerance');
});

test('Task 2.3: B is reached first in the Earth frame', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part2, 'earth-times');
  const answers = PARTS.simultaneity.answers['earth-times'];
  for (const wrong of ['F', 'both']) {
    assert.equal(runner.submit('simultaneity', 'earth-times', { ...answers, first: wrong }).passed, false);
  }
  assert.equal(runner.submit('simultaneity', 'earth-times', { ...answers, 't-F': '2' }).passed, false); // t′, not t
  assert.equal(runner.submit('simultaneity', 'earth-times', answers).passed, true);
});

test('Task 2.5 takes the x′ axis as the line through B and F', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part2, 'rod-bf');
  const { says } = PARTS.simultaneity.answers['rod-bf'];
  for (const wrong of ['t-axis', 'x-axis', 'tp-axis', 'light']) {
    assert.equal(runner.submit('simultaneity', 'rod-bf', { parallel: wrong, says }).passed, false);
  }
  assert.equal(runner.submit('simultaneity', 'rod-bf', { parallel: 'xp-axis', says }).passed, true);
});

test('Hints appear after 3 misses, decoded', () => {
  for (const part of activity.parts) {
    for (const task of part.tasks.filter((t) => t.hint)) {
      const { runner, tools } = start();
      passUpTo(runner, tools, part, task.id);
      tools[part.id].draw([]);
      // Each miss is a different try (an identical repeat would be refused).
      assert.equal(runner.submit(part.id, task.id, { try: 0 }).hint, null);
      assert.equal(runner.submit(part.id, task.id, { try: 1 }).hint, null);
      const hint = runner.submit(part.id, task.id, { try: 2 }).hint;
      assert.equal(typeof hint, 'string', `Task "${task.id}" Hint after 3 misses`);
      assert.ok(hint.length > 20 && !isEncodedKey(hint), `Task "${task.id}" Hint is readable: ${hint}`);
    }
  }
});

test('Task 1.2\'s Hint gives the aim point (3, 5)', () => {
  const { runner, tools } = start();
  passUpTo(runner, tools, part1, 'rocket');
  for (let i = 0; i < 3; i++) runner.submit('building', 'rocket', { try: i });
  assert.match(runner.task('building', 'rocket').hint, /\(3, 5\)/);
});

test('points: 1 per Condition-bearing Task, none for a Task without one, 1 per Question; Part 1 totals 13, Part 2 11, the Activity 24', () => {
  const { runner, tools } = start();
  for (const part of activity.parts) {
    for (const task of part.tasks) {
      assert.equal(task.points, task.condition ? 1 : 0, `Task "${task.id}" points`);
      for (const q of task.questions ?? []) assert.equal(q.points, 1, `Question "${q.id}" points`);
    }
  }
  const before = runner.score();
  for (const [p, part] of activity.parts.entries()) {
    assert.equal(before.parts[p].possible, PARTS[part.id].points, `Part "${part.id}" possible`);
    assert.equal(before.parts[p].earned, 0, 'a blank start earns nothing');
  }
  assert.equal(before.parts[0].possible, 13);
  assert.equal(before.parts[1].possible, 11);
  assert.equal(before.possible, 24);

  // A blank Submit of every Task earns nothing either.
  for (const part of activity.parts) {
    for (const task of part.tasks) {
      try { runner.submit(part.id, task.id); } catch { /* locked until the previous Task passes */ }
    }
  }
  assert.equal(runner.score().earned, 0);

  for (const part of activity.parts) passUpTo(runner, tools, part, null);
  const after = runner.score();
  assert.equal(after.parts[0].earned, 13);
  assert.equal(after.parts[1].earned, 11);
  assert.equal(after.earned, after.possible);
});

test('every encoded key decodes, and Conditions, keys and answer-revealing Hints are encoded', async () => {
  const keys = [];
  (function walk(v) {
    if (isEncodedKey(v)) keys.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  })(activity);
  assert.ok(keys.length > 0);
  for (const key of keys) assert.doesNotThrow(() => decodeKey(key), key);

  for (const part of activity.parts) {
    for (const task of part.tasks) {
      if (task.condition) assert.ok(isEncodedKey(task.condition), `Task "${task.id}" Condition is encoded`);
      for (const q of task.questions ?? []) {
        if (q.kind === 'numeric') assert.ok(isEncodedKey(q.answer), `Question "${q.id}" answer is encoded`);
        if (q.kind === 'choice') assert.ok(isEncodedKey(q.correct), `Question "${q.id}" correct is encoded`);
      }
    }
  }
  const hintOf = (part, id) => part.tasks.find((t) => t.id === id).hint.text;
  assert.ok(isEncodedKey(hintOf(part1, 'rocket')), 'Task 1.2 Hint gives the answer away, so it is encoded');
  assert.ok(isEncodedKey(hintOf(part1, 'flash')), 'Task 1.3 Hint gives the answer away, so it is encoded');
  assert.ok(isEncodedKey(hintOf(part2, 'ends-flash')), 'Task 2.1 Hint gives the answer away, so it is encoded');

  const source = await readFile(ACTIVITY_FILE, 'utf8');
  for (const leak of ['st-worldline', 'st-event', 'st-rod', "correct: 't", "correct: 'x", "correct: 'B", '1.6', '2.5']) {
    assert.ok(!source.includes(leak), `source contains "${leak}"`);
  }
});
