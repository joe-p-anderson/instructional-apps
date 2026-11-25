import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner, encodeKey } from '../../../framework/v1/runner/index.js';
import { stubTool } from './stub-tool.js';

const STATE = {
  phi: { value: 0, label: 'φ', unit: 'rad' },
  T: { value: 0, label: 'T', unit: 's' },
  coupled: { value: false, label: 'Coupled' },
  mode: { value: 'DC', label: 'Coupling' },
  E0: { value: 0, label: '|E₀|', unit: 'V/m' },
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
  const within = (c, state) => ({ pass: state[c.state] >= c.min && state[c.state] <= c.max });
  const fromActivity = withCondition({ type: 'within', state: 'T', min: 2, max: 4 },
    { activity: { conditionTypes: { within } } });
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
  assert.deepEqual(attempts[0].state, { phi: 0, T: 2, coupled: false, mode: 'DC', E0: 0 });
  assert.deepEqual(attempts[1].state.T, 3);
  assert.deepEqual(attempts.map((a) => a.passed), [false, true]);
  assert.equal(attempts[0].results[0].pass, false);
  assert.equal(attempts[0].results[0].kind, 'condition');
});

test('range passes only when the State value is strictly above its bound', () => {
  const { submit } = withCondition({ type: 'range', state: 'E0', above: 0 });
  const miss = submit({ E0: 0 });
  assert.equal(miss.passed, false);
  assert.equal(miss.results[0].feedback, '|E₀| = 0 V/m; need > 0');
  assert.equal(submit({ E0: 250 }).passed, true);
});

test('range with both bounds passes strictly between them and names the bound it missed', () => {
  const { submit } = withCondition({ type: 'range', state: 'T', above: 2, below: 4 });
  assert.equal(submit({ T: 2 }).results[0].feedback, 'T = 2 s; need > 2');
  assert.equal(submit({ T: 4 }).results[0].feedback, 'T = 4 s; need < 4');
  assert.equal(submit({ T: 0.05 }).results[0].feedback, 'T = 0.05 s; need > 2');
  assert.equal(submit({ T: 3 }).passed, true);

  const below = withCondition({ type: 'range', state: 'T', below: 0.05 });
  assert.equal(below.submit({ T: 0.06 }).results[0].feedback, 'T = 0.06 s; need < 0.05');
  assert.equal(below.submit({ T: 0.049 }).passed, true);
});

test('anyOf passes when any component passes; a miss lists each component\'s feedback', () => {
  const condition = { type: 'anyOf', conditions: [
    { state: 'coupled', equals: true },
    { type: 'range', state: 'T', below: 1 },
  ] };
  const miss = withCondition(condition).submit({ coupled: false, T: 2 });
  assert.equal(miss.passed, false);
  assert.equal(miss.results.length, 1);
  assert.equal(miss.results[0].feedback, 'Any one of: Coupled = false; need true — or — T = 2 s; need < 1');
  assert.equal(withCondition(condition).submit({ coupled: false, T: 0.5 }).passed, true);
  assert.equal(withCondition(condition).submit({ coupled: true, T: 2 }).passed, true);
});

test('anyOf components may be registered types, functions or lists, and anyOf can sit in a Condition list', () => {
  const positive = (c, state) => ({ pass: state[c.state] > 0, feedback: `${c.state} must be positive` });
  const condition = [
    { type: 'range', state: 'E0', above: 0 },
    { type: 'anyOf', conditions: [
      { type: 'positive', state: 'phi' },
      (s) => ({ pass: s.mode === 'AC', feedback: 'switch to AC' }),
      [{ state: 'coupled', equals: true }, { type: 'range', state: 'T', above: 5 }],
    ] },
  ];
  const submit = (patch) => withCondition(condition, { activity: { conditionTypes: { positive } } }).submit(patch);
  const base = { E0: 10, phi: 0, mode: 'DC', coupled: true, T: 1 };

  const miss = submit(base);
  assert.deepEqual(miss.results.map((r) => r.pass), [true, false]);
  assert.equal(miss.results[1].feedback, 'Any one of: phi must be positive — or — switch to AC — or — T = 1 s; need > 5');
  assert.equal(submit({ ...base, T: 6 }).passed, true);
  assert.equal(submit({ ...base, phi: 1 }).passed, true);
  assert.equal(submit({ ...base, mode: 'AC' }).passed, true);
  assert.equal(submit({ ...base, mode: 'AC', E0: 0 }).passed, false);
});

test('range and anyOf work when the whole Condition is an encoded key', () => {
  const plain = [
    { type: 'range', state: 'T', below: 0.05 },
    { type: 'anyOf', conditions: [{ state: 'coupled', equals: true }, { type: 'range', state: 'E0', above: 0 }] },
  ];
  const condition = encodeKey(plain);
  const miss = withCondition(condition).submit({ T: 0.04, coupled: false, E0: 0 });
  assert.deepEqual(miss.results.map((r) => r.pass), [true, false]);
  assert.equal(miss.results[1].feedback, 'Any one of: Coupled = false; need true — or — |E₀| = 0 V/m; need > 0');
  assert.deepEqual(miss.results, withCondition(plain).submit({ T: 0.04, coupled: false, E0: 0 }).results);
  assert.equal(withCondition(condition).submit({ T: 0.04, coupled: false, E0: 3 }).passed, true);
});
