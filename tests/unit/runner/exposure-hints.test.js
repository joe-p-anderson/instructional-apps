import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner } from '../../../framework/v1/runner/index.js';
import { stubTool } from './stub-tool.js';

const activity = {
  id: 'scope', version: 1, title: 'Scope', course: 'X', tool: 'stub',
  parts: [{ id: 'p1', title: 'Phase', mode: 'scope', setup: {}, tasks: [
    { id: 't1', title: 'Phase', prompt: '', points: 1,
      show: ['dt'], hide: ['freq', 'amp'],
      condition: { state: 'phi', target: 1.57, tol: 0.05 },
      hint: { after: 2, text: 'Drag the Δt marker.' } },
    { id: 't2', title: 'Period', prompt: '', points: 1,
      show: ['freq'], lock: ['dt'],
      condition: { state: 'T', target: 3, tol: 0.05 } },
    { id: 't3', title: 'Free', prompt: '', points: 1,
      show: ['dt', 'amp'] },
  ] }],
};

function setup() {
  const tool = stubTool({
    state: { phi: { value: 0 }, T: { value: 0 } },
    controls: ['dt', 'freq', 'amp'],
  });
  const r = createRunner(activity, { tools: { p1: tool } });
  return { r, tool };
}

const exposure = (tool) => Object.fromEntries(tool.controls.ids().map((id) => {
  const c = tool.controls.get(id);
  return [id, !c.isVisible ? 'hidden' : c.isLocked ? 'locked' : 'shown'];
}));

test("the first Task's Control exposure is applied when the Run starts", () => {
  const { r, tool } = setup();
  r.start('Ada');
  assert.deepEqual(exposure(tool), { dt: 'shown', freq: 'hidden', amp: 'hidden' });
});

test("a pass applies the next Task's exposure; unmentioned Controls keep their exposure", () => {
  const { r, tool } = setup();
  r.start('Ada');
  tool.setState({ phi: 1.57 });
  r.submit('p1', 't1');
  assert.deepEqual(exposure(tool), { dt: 'locked', freq: 'shown', amp: 'hidden' });
});

test('a miss leaves the exposure unchanged', () => {
  const { r, tool } = setup();
  r.start('Ada');
  r.submit('p1', 't1');
  assert.deepEqual(exposure(tool), { dt: 'shown', freq: 'hidden', amp: 'hidden' });
});

test('a later Task can unlock a Control an earlier Task locked', () => {
  const { r, tool } = setup();
  r.start('Ada');
  tool.setState({ phi: 1.57 });
  r.submit('p1', 't1');
  tool.setState({ T: 3 });
  r.submit('p1', 't2');
  assert.deepEqual(exposure(tool), { dt: 'shown', freq: 'shown', amp: 'shown' });
});

test('a Hint becomes available once the miss count reaches its threshold', () => {
  const { r, tool } = setup();
  r.start('Ada');
  assert.equal(r.task('p1', 't1').hint, null);
  r.submit('p1', 't1');
  assert.equal(r.task('p1', 't1').misses, 1);
  assert.equal(r.task('p1', 't1').hint, null);
  const second = r.submit('p1', 't1');
  assert.equal(second.hint, 'Drag the Δt marker.');
  assert.equal(r.task('p1', 't1').hint, 'Drag the Δt marker.');
  tool.setState({ phi: 1.57 });
  r.submit('p1', 't1');
  assert.equal(r.task('p1', 't1').hint, 'Drag the Δt marker.');
  assert.equal(r.task('p1', 't2').hint, null);
});
