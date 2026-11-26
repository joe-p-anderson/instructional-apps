import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner } from '../../../framework/v1/runner/index.js';
import { stubTool } from './stub-tool.js';

const activity = {
  id: 'refuse', version: 1, title: 'Refuse', course: 'X', tool: 'stub',
  parts: [{ id: 'p1', title: 'Part', mode: 'main', setup: {}, tasks: [
    { id: 't1', title: 'Set x and say why', prompt: '', points: 2,
      condition: { state: 'x', target: 1, tol: 0.1 },
      questions: [{ id: 'n', kind: 'numeric', prompt: 'n?', answer: 5, tol: 0.1, points: 1 }],
      hint: { after: 2, text: 'Try x = 1.' } },
  ] }],
};

function setup() {
  const tool = stubTool({ state: { x: { value: 0 }, y: { value: 0 } } });
  const r = createRunner(activity, { tools: { p1: tool } });
  r.start('Ada');
  return { r, tool };
}

test('a Submit identical to the last failed Attempt is refused and records nothing', () => {
  const { r } = setup();
  r.submit('p1', 't1', { n: 3 });
  const result = r.submit('p1', 't1', { n: 3 });
  assert.equal(result.refused, true);
  assert.equal(result.reason, 'unchanged');
  assert.equal(result.feedback, 'Nothing changed since your last try');
  assert.equal(r.task('p1', 't1').attempts.length, 1);
  assert.equal(r.task('p1', 't1').misses, 1);
});

test('a refusal does not bring the Hint closer', () => {
  const { r } = setup();
  r.submit('p1', 't1', { n: 3 });
  assert.equal(r.submit('p1', 't1', { n: 3 }).hint, null);
  r.submit('p1', 't1', { n: 3 });
  assert.equal(r.task('p1', 't1').hint, null);
  r.submit('p1', 't1', { n: 4 });
  assert.equal(r.task('p1', 't1').hint, 'Try x = 1.');
});

test('a refusal keeps the unsubmitted draft', () => {
  const { r } = setup();
  r.submit('p1', 't1', { n: 3 });
  r.draft('p1', 't1', { n: 3 });
  r.submit('p1', 't1', { n: 3 });
  assert.deepEqual(r.save().parts.p1.drafts, { t1: { n: 3 } });
});

test('key order does not matter when comparing with the last Attempt', () => {
  const { r, tool } = setup();
  r.submit('p1', 't1', { n: 3, extra: 'a' });
  const snapshot = tool.state.snapshot;
  tool.state.snapshot = () => { const s = snapshot(); return { y: s.y, x: s.x }; };
  assert.equal(r.submit('p1', 't1', { extra: 'a', n: 3 }).refused, true);
  assert.equal(r.task('p1', 't1').attempts.length, 1);
});

test('a changed State alone is recorded', () => {
  const { r, tool } = setup();
  r.submit('p1', 't1', { n: 3 });
  tool.setState({ y: 2 });
  const result = r.submit('p1', 't1', { n: 3 });
  assert.equal(result.refused, undefined);
  assert.equal(r.task('p1', 't1').attempts.length, 2);
});

test('changed answers alone are recorded', () => {
  const { r } = setup();
  r.submit('p1', 't1', { n: 3 });
  r.submit('p1', 't1', { n: 4 });
  assert.equal(r.task('p1', 't1').attempts.length, 2);
});

test('A, B, A records three Attempts', () => {
  const { r } = setup();
  r.submit('p1', 't1', { n: 3 });
  r.submit('p1', 't1', { n: 4 });
  r.submit('p1', 't1', { n: 3 });
  assert.deepEqual(r.task('p1', 't1').attempts.map((a) => a.answers.n), [3, 4, 3]);
});

test('a Submit after a pass is still an error, not a refusal', () => {
  const { r, tool } = setup();
  tool.setState({ x: 1 });
  r.submit('p1', 't1', { n: 5 });
  assert.throws(() => r.submit('p1', 't1', { n: 5 }), /already passed/);
});

test('the Report after refusals equals the Report without them', async () => {
  const clock = () => new Date('2026-11-25T10:00:00.000Z');
  const play = async (refusals) => {
    const tool = stubTool({ state: { x: { value: 0 }, y: { value: 0 } } });
    const r = createRunner(activity, { tools: { p1: tool }, clock });
    r.restore({ activity: { id: 'refuse' }, run: { name: 'Ada', fingerprint: 'f00d', startedAt: '2026-11-25T09:00:00.000Z' } });
    r.submit('p1', 't1', { n: 3 });
    for (let i = 0; i < refusals; i++) r.submit('p1', 't1', { n: 3 });
    tool.setState({ x: 1 });
    r.submit('p1', 't1', { n: 5 });
    return r.report();
  };
  assert.deepEqual(await play(3), await play(0));
});
