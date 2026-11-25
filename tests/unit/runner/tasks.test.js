import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner } from '../../../framework/v1/runner/index.js';
import { stubTool } from './stub-tool.js';

const activity = {
  id: 'demo', version: 1, title: 'Demo', course: 'PHY 0000', tool: 'stub',
  parts: [
    { id: 'p1', title: 'Part 1', mode: 'main', setup: {}, tasks: [
      { id: 'a', title: 'A', prompt: 'Set x to 1', points: 1, condition: { state: 'x', target: 1, tol: 0.1 } },
      { id: 'b', title: 'B', prompt: 'Set x to 2', points: 1, condition: { state: 'x', target: 2, tol: 0.1 } },
    ] },
    { id: 'p2', title: 'Part 2', mode: 'main', setup: {}, tasks: [
      { id: 'c', title: 'C', prompt: 'Set y to 5', points: 1, condition: { state: 'y', target: 5, tol: 0.1 } },
      { id: 'd', title: 'D', prompt: 'Look around', points: 1 },
    ] },
  ],
};

function setup() {
  const tools = {
    p1: stubTool({ state: { x: { value: 0 } } }),
    p2: stubTool({ state: { y: { value: 0 } } }),
  };
  const r = createRunner(activity, { tools });
  r.start('Ada');
  return { r, tools };
}

const statuses = (r) => r.parts().map((p) => p.tasks.map((t) => `${t.id}:${t.status}`).join(' '));

test('every Part is open from the start and Tasks unlock in order within a Part', () => {
  const { r } = setup();
  assert.deepEqual(statuses(r), ['a:open b:locked', 'c:open d:locked']);
  assert.throws(() => r.submit('p1', 'b'), /locked/i);
});

test('a passing Submit freezes the Task and unlocks the next one', () => {
  const { r, tools } = setup();
  tools.p1.setState({ x: 1.05 });
  const attempt = r.submit('p1', 'a');
  assert.equal(attempt.passed, true);
  assert.deepEqual(statuses(r), ['a:passed b:open', 'c:open d:locked']);
  assert.throws(() => r.submit('p1', 'a'), /already passed/i);
});

test('a missed Submit leaves the Task open and the next one locked', () => {
  const { r, tools } = setup();
  tools.p2.setState({ y: 4 });
  const attempt = r.submit('p2', 'c');
  assert.equal(attempt.passed, false);
  assert.deepEqual(statuses(r), ['a:open b:locked', 'c:open d:locked']);
});

test('a Task with no Condition passes on Submit', () => {
  const { r, tools } = setup();
  tools.p2.setState({ y: 5 });
  r.submit('p2', 'c');
  assert.equal(r.submit('p2', 'd').passed, true);
  assert.deepEqual(statuses(r), ['a:open b:locked', 'c:passed d:passed']);
});

test('each Part is judged on its own Tool instance', () => {
  const { r, tools } = setup();
  tools.p2.setState({ y: 1 });
  tools.p1.setState({ x: 1 });
  assert.equal(r.submit('p2', 'c').passed, false);
  assert.equal(r.submit('p1', 'a').passed, true);
});

test('unknown Parts or Tasks are rejected', () => {
  const { r } = setup();
  assert.throws(() => r.submit('nope', 'a'), /unknown/i);
  assert.throws(() => r.submit('p1', 'nope'), /unknown/i);
});
