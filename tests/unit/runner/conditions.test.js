import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner } from '../../../framework/v1/runner/index.js';
import { stubTool } from './stub-tool.js';

const STATE = {
  phi: { value: 0, label: 'φ', unit: 'rad' },
  T: { value: 0, label: 'T', unit: 's' },
  coupled: { value: false, label: 'Coupled' },
  mode: { value: 'DC', label: 'Coupling' },
};

// One-Task Activity around the given Condition; returns a submit(statePatch) helper.
function withCondition(condition, options = {}) {
  const tool = stubTool({ state: STATE });
  const activity = {
    id: 'c', version: 1, title: 'C', course: 'X', tool: 'stub', ...options.activity,
    parts: [{ id: 'p', title: 'P', mode: 'm', setup: {}, tasks: [
      { id: 't', title: 't', prompt: '', points: 1, condition },
    ] }],
  };
  const r = createRunner(activity, { tools: { p: tool }, ...options.runner });
  r.start('Ada');
  return {
    tool,
    r,
    submit(patch = {}) { tool.setState(patch); return r.submit('p', 't'); },
  };
}

test('value within tolerance passes, outside misses with generated feedback', () => {
  const { submit } = withCondition({ state: 'phi', target: Math.PI / 2, tol: 0.05, targetLabel: 'π/2' });
  const miss = submit({ phi: 1.48 });
  assert.equal(miss.passed, false);
  assert.equal(miss.results[0].feedback, 'φ = 1.48 rad; need π/2');
  const hit = submit({ phi: 1.6 });
  assert.equal(hit.passed, true);
  assert.equal(hit.results[0].feedback, null);
});

test('feedback states target and tolerance when no target label is given', () => {
  const { submit } = withCondition({ state: 'T', target: 3, tol: 0.05 });
  assert.equal(submit({ T: 2.5 }).results[0].feedback, 'T = 2.50 s; need 3.00 ± 0.05 s');
});

test('exact and boolean matches', () => {
  const bool = withCondition({ state: 'coupled', equals: true });
  assert.equal(bool.submit({ coupled: false }).results[0].feedback, 'Coupled = false; need true');
  assert.equal(bool.submit({ coupled: true }).passed, true);

  const exact = withCondition({ state: 'mode', equals: 'AC' });
  assert.equal(exact.submit({ mode: 'DC' }).results[0].feedback, 'Coupling = DC; need AC');
  assert.equal(exact.submit({ mode: 'AC' }).passed, true);
});

test('a list of Conditions records a result per component and passes only if all pass', () => {
  const { submit } = withCondition([
    { state: 'phi', target: 1, tol: 0.1 },
    { state: 'T', target: 3, tol: 0.1 },
  ]);
  const attempt = submit({ phi: 1, T: 5 });
  assert.equal(attempt.passed, false);
  assert.deepEqual(attempt.results.map((r) => r.pass), [true, false]);
  assert.equal(submit({ T: 3 }).passed, true);
});

test('custom Condition types can be registered by the Activity or the host', () => {
  const range = (c, state) => ({ pass: state[c.state] >= c.min && state[c.state] <= c.max });
  const fromActivity = withCondition({ type: 'range', state: 'T', min: 2, max: 4 },
    { activity: { conditionTypes: { range } } });
  assert.equal(fromActivity.submit({ T: 5 }).passed, false);
  assert.equal(fromActivity.submit({ T: 3 }).passed, true);

  const ratio = (c, state) => {
    const pass = Math.abs(state[c.a] / state[c.b] - c.ratio) < 0.01;
    return { pass, feedback: pass ? null : `${c.a}/${c.b} should be ${c.ratio}` };
  };
  const fromHost = withCondition({ type: 'ratio', a: 'phi', b: 'T', ratio: 2 },
    { runner: { conditionTypes: { ratio } } });
  assert.equal(fromHost.submit({ phi: 1, T: 1 }).results[0].feedback, 'phi/T should be 2');
  assert.equal(fromHost.submit({ phi: 2 }).passed, true);
});

test('an unregistered Condition type is an error', () => {
  const { submit } = withCondition({ type: 'nope', state: 'T' });
  assert.throws(() => submit(), /unknown condition type/i);
});

test('a plain function over the State is an escape hatch', () => {
  const { submit } = withCondition((s) => s.phi > s.T);
  assert.equal(submit({ phi: 1, T: 2 }).passed, false);
  assert.equal(submit({ phi: 3 }).passed, true);

  const withFeedback = withCondition((s) => ({ pass: s.T > 0, feedback: 'T must be positive' }));
  assert.equal(withFeedback.submit({ T: -1 }).results[0].feedback, 'T must be positive');
});

test('values passed through between Submits are never evaluated', () => {
  const seen = [];
  const { tool, r } = withCondition((s) => { seen.push(s.T); return s.T === 3; });
  tool.setState({ T: 1 });
  tool.setState({ T: 3 }); // passes through the target while dragging
  tool.setState({ T: 4 });
  const attempt = r.submit('p', 't');
  assert.equal(attempt.passed, false);
  assert.deepEqual(seen, [4]);
});

test('each Attempt records a timestamp, the full State, per-component results and pass/fail', () => {
  let t = Date.UTC(2026, 0, 1);
  const tool = stubTool({ state: STATE });
  const activity = { id: 'c', version: 1, title: 'C', course: 'X', tool: 'stub', parts: [
    { id: 'p', title: 'P', mode: 'm', setup: {}, tasks: [
      { id: 't', title: 't', prompt: '', points: 1, condition: { state: 'T', target: 3, tol: 0.05 } },
    ] },
  ] };
  const r = createRunner(activity, { tools: { p: tool }, clock: () => new Date((t += 1000)) });
  r.start('Ada');
  tool.setState({ T: 2 });
  r.submit('p', 't');
  tool.setState({ T: 3 });
  r.submit('p', 't');
  tool.setState({ T: 9 }); // later changes must not rewrite recorded Attempts

  const { attempts } = r.task('p', 't');
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].at, '2026-01-01T00:00:02.000Z');
  assert.deepEqual(attempts[0].state, { phi: 0, T: 2, coupled: false, mode: 'DC' });
  assert.deepEqual(attempts[1].state.T, 3);
  assert.deepEqual(attempts.map((a) => a.passed), [false, true]);
  assert.equal(attempts[0].results[0].pass, false);
  assert.equal(attempts[0].results[0].kind, 'condition');
});
