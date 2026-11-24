import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner } from '../../../framework/v1/runner/index.js';
import activity from '../../../tools/oscilloscope/activities/phase-period-amplitude.js';
import { metrics } from '../../../tools/oscilloscope/signal.js';
import { stubTool } from '../runner/stub-tool.js';

const CONTROLS = ['Va', 'f', 'Dt', 'Va-marker', 'f-marker', 'Dt-marker'];

// A stub oscilloscope: settable signal parameters with the real derived metrics.
function scope() {
  const tool = stubTool({
    state: {
      Va: { value: 2, unit: 'V' }, f: { value: 0.5, unit: 'Hz' }, Dt: { value: 0.25, unit: 's' },
      phi: { value: 0, label: 'Phase shift φ', unit: 'rad' },
      T: { value: 0, label: 'Period T', unit: 's' },
      pkpk: { value: 0, label: 'Peak-to-peak', unit: 'V' },
    },
    controls: CONTROLS,
  });
  const params = { Va: 2, f: 0.5, Dt: 0.25 };
  tool.setSignal = (patch) => {
    Object.assign(params, patch);
    tool.setState({ ...params, ...metrics(params) });
  };
  tool.setSignal({});
  return tool;
}

function start() {
  const tools = Object.fromEntries(activity.parts.map((p) => [p.id, scope()]));
  const runner = createRunner(activity, { tools });
  runner.start('Ada');
  return { runner, tools };
}

const [part1, part2] = activity.parts;

test('the Activity names the oscilloscope Tool, with two Parts on the same Mode and different Setups', () => {
  assert.equal(activity.tool, 'oscilloscope');
  assert.equal(activity.parts.length, 2);
  assert.equal(part1.mode, part2.mode);
  assert.notDeepEqual(part1.setup, part2.setup);
});

test('Task 1.1 passes at φ = π/2 within 0.05 and gives specific miss feedback', () => {
  const { runner, tools } = start();
  const t11 = part1.tasks[0].id;
  tools[part1.id].setSignal({ f: 0.5, Dt: 0.47 }); // φ ≈ 1.477
  const miss = runner.submit(part1.id, t11);
  assert.equal(miss.passed, false);
  assert.match(miss.results[0].feedback, /φ = 1\.48 rad; need π\/2/);
  tools[part1.id].setSignal({ Dt: 0.5 }); // φ = π/2
  assert.equal(runner.submit(part1.id, t11).passed, true);
});

test('Δt (slider and marker) is locked once Task 1.1 passes', () => {
  const { runner, tools } = start();
  const t = tools[part1.id];
  assert.equal(t.controls.get('Dt').isLocked, false);
  t.setSignal({ Dt: 0.5 });
  runner.submit(part1.id, part1.tasks[0].id);
  assert.equal(t.controls.get('Dt').isLocked, true);
  assert.equal(t.controls.get('Dt-marker').isLocked, true);
});

test('Task 1.2 targets φ = π/4 and is followed by the free-text Question', () => {
  const { runner, tools } = start();
  const t = tools[part1.id];
  t.setSignal({ Dt: 0.5 });
  runner.submit(part1.id, part1.tasks[0].id);
  t.setSignal({ f: 0.3 }); // φ ≈ 0.942
  assert.equal(runner.submit(part1.id, part1.tasks[1].id).passed, false);
  t.setSignal({ f: 0.25 }); // φ = π/4
  assert.equal(runner.submit(part1.id, part1.tasks[1].id).passed, true);

  const question = part1.tasks[2];
  assert.deepEqual(question.questions.map((q) => q.kind), ['text']);
  assert.match(question.questions[0].prompt, /difficult to measure/);
  assert.equal(runner.task(part1.id, question.id).status, 'open');
});

test('Part 2 targets T = 3 ± 0.05 s, then pk-pk = 4 ± 0.05 V', () => {
  const { runner, tools } = start();
  const t = tools[part2.id];
  const [t21, t22] = part2.tasks.map((x) => x.id);
  t.setSignal({ f: 0.3 }); // T ≈ 3.33
  assert.equal(runner.submit(part2.id, t21).passed, false);
  t.setSignal({ f: 0.335 }); // T ≈ 2.985
  assert.equal(runner.submit(part2.id, t21).passed, true);
  t.setSignal({ Va: 1.9 }); // pk-pk 3.8
  assert.equal(runner.submit(part2.id, t22).passed, false);
  t.setSignal({ Va: 2.01 }); // pk-pk 4.02
  assert.equal(runner.submit(part2.id, t22).passed, true);
});

test('the Activity source keeps its Condition targets encoded, not in plain text', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../../../tools/oscilloscope/activities/phase-period-amplitude.js', import.meta.url), 'utf8');
  for (const leak of ['target', 'Math.PI', 'π/2', 'π/4', '3.00 s', '4.00 V', 'tol']) {
    assert.ok(!source.includes(leak), `source contains "${leak}"`);
  }
  for (const task of activity.parts.flatMap((p) => p.tasks).filter((t) => t.condition)) {
    assert.match(task.condition, /^enc1:/, `Task "${task.id}" Condition is encoded`);
  }
});

test('Part 2 starts with Δt hidden and Va locked, then unlocks Va and locks f for Task 2.2', () => {
  const { runner, tools } = start();
  const c = (id) => tools[part2.id].controls.get(id);
  assert.equal(c('Dt').isVisible, false);
  assert.equal(c('Dt-marker').isVisible, false);
  assert.equal(c('Va').isLocked, true);
  assert.equal(c('f').isLocked, false);
  tools[part2.id].setSignal({ f: 1 / 3 });
  runner.submit(part2.id, part2.tasks[0].id);
  assert.equal(c('Va').isLocked, false);
  assert.equal(c('Va-marker').isLocked, false);
  assert.equal(c('f').isLocked, true);
  assert.equal(c('f-marker').isLocked, true);
});
