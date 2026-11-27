import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner, encodeKey } from '../../../framework/v1/runner/index.js';
import { stubTool } from './stub-tool.js';

const STATE = {
  w: { value: 0, label: 'ω', unit: 'rad/s' },
  L: { value: 0.01, label: 'L', unit: 'H' },
  C: { value: 0.0001, label: 'C', unit: 'F' },
  V_L: { value: 0, label: 'V_L', unit: 'V' },
  V_C: { value: 0, label: 'V_C', unit: 'V' },
  I: { value: 0, label: '|I|', unit: 'mA' },
  n: { value: 2, label: 'n' },
};

function activityWith(condition) {
  return {
    id: 'c', version: 1, title: 'C', course: 'X', tool: 'stub',
    parts: [{ id: 'p', title: 'P', mode: 'm', setup: {}, tasks: [
      { id: 't', title: 't', prompt: '', points: 1, condition },
    ] }],
  };
}

// One-Task Activity around the given Condition; returns a submit(statePatch) helper.
function withCondition(condition) {
  const tool = stubTool({ state: STATE });
  const r = createRunner(activityWith(condition), { tools: { p: tool } });
  r.start('Ada');
  return (patch = {}) => { tool.setState(patch); return r.submit('p', 't'); };
}

test('a target may be an expression, worked out against the State at Submit', () => {
  const submit = withCondition({ state: 'w', target: { expr: '1/sqrt(L*C)' }, tol: 0.5 });
  const miss = submit({ w: 990 });
  assert.equal(miss.passed, false);
  assert.equal(miss.results[0].feedback, 'ω = 990.0 rad/s; need 1000.0 ± 0.5 rad/s');
  assert.equal(submit({ w: 1000.2 }).passed, true);

  const moved = withCondition({ state: 'w', target: { expr: '1/sqrt(L*C)' }, tol: 0.5 });
  assert.equal(moved({ w: 1000, L: 0.04 }).passed, false); // the target moved to 500
  assert.equal(moved({ w: 500 }).passed, true);
});

test('the State tested may be an expression; the feedback names it and its value', () => {
  const submit = withCondition({ type: 'range', state: { expr: 'abs(V_L - V_C)' }, below: 0.01 });
  const miss = submit({ V_L: 3, V_C: 2.5 });
  assert.equal(miss.passed, false);
  assert.equal(miss.results[0].feedback, 'abs(V_L - V_C) = 0.5; need < 0.01');
  assert.equal(submit({ V_C: 2.995 }).passed, true);
});

test('range bounds may be expressions', () => {
  const submit = withCondition({ type: 'range', state: 'w', above: { expr: '0.5/sqrt(L*C)' }, below: { expr: '2/sqrt(L*C)' } });
  assert.equal(submit({ w: 400 }).results[0].feedback, 'ω = 400 rad/s; need > 500');
  assert.equal(submit({ w: 2500 }).results[0].feedback, 'ω = 2500 rad/s; need < 2000');
  assert.equal(submit({ w: 1500 }).passed, true);
});

test('equals may compare an expression with an expression', () => {
  const submit = withCondition({ state: { expr: 'n^2' }, equals: { expr: 'n + 2' } });
  assert.equal(submit({ n: 3 }).results[0].feedback, 'n^2 = 9; need 5');
  assert.equal(submit({ n: 2 }).passed, true);
});

test('targetLabel still replaces the generated text for an expression target', () => {
  const submit = withCondition({ state: 'w', target: { expr: '1/sqrt(L*C)' }, tol: 0.5, targetLabel: 'ω₀' });
  assert.equal(submit({ w: 990 }).results[0].feedback, 'ω = 990.0 rad/s; need ω₀');
});

test('an expression naming unknown State is a miss whose feedback names it', () => {
  const target = withCondition({ state: 'w', target: { expr: '1/sqrt(L*R)' }, tol: 0.5 })();
  assert.equal(target.passed, false);
  assert.equal(target.results[0].feedback, 'Can\'t judge this Condition: "1/sqrt(L*R)" has unknown State "R".');
  const tested = withCondition({ type: 'range', state: { expr: 'R * I' }, below: 1 })();
  assert.equal(tested.results[0].feedback, 'Can\'t judge this Condition: "R * I" has unknown State "R".');
  const named = withCondition({ state: 'R', target: 1, tol: 0.5 })();
  assert.equal(named.results[0].feedback, 'Can\'t judge this Condition: unknown State "R".');
});

test('a non-finite value is a miss whose feedback names it', () => {
  const target = withCondition({ state: 'w', target: { expr: '1/sqrt(L*C)' }, tol: 0.5 })({ C: 0 });
  assert.equal(target.passed, false);
  assert.equal(target.results[0].feedback, 'Can\'t judge this Condition: "1/sqrt(L*C)" works out to Infinity.');
  const tested = withCondition({ type: 'range', state: { expr: 'sqrt(V_L - 1)' }, below: 1 })({ V_L: 0 });
  assert.equal(tested.passed, false);
  assert.equal(tested.results[0].feedback, 'sqrt(V_L - 1) = NaN; need < 1');
});

test('expressions work inside any-of groups, lists and nested groups', () => {
  const submit = withCondition([
    { type: 'anyOf', conditions: [
      { state: 'w', target: { expr: '1/sqrt(L*C)' }, tol: 0.5 },
      [{ type: 'range', state: { expr: 'abs(V_L - V_C)' }, below: 0.01 }, { state: { expr: 'n' }, equals: { expr: '2' } }],
    ] },
    { type: 'range', state: { expr: 'I * 1000' }, above: { expr: 'n' } },
  ]);
  const miss = submit({ w: 0, V_L: 1, V_C: 0, I: 0.001 });
  assert.deepEqual(miss.results.map((r) => r.pass), [false, false]);
  assert.equal(miss.results[0].feedback,
    'Any one of: ω = 0.0 rad/s; need 1000.0 ± 0.5 rad/s — or — abs(V_L - V_C) = 1; need < 0.01');
  assert.equal(submit({ V_C: 1, I: 0.003 }).passed, true);
});

test('a target Condition with relTol passes within relTol × |target| and shows the percentage', () => {
  const submit = withCondition({ state: 'I', target: 5, relTol: 0.02 });
  assert.equal(submit({ I: 4.1 }).results[0].feedback, '|I| = 4.1 mA; need 5.00 mA ± 2%');
  assert.equal(submit({ I: 4.89 }).passed, false);
  assert.equal(submit({ I: 4.91 }).passed, true);
});

test('relTol applies to an expression target as worked out at Submit', () => {
  const submit = withCondition({ state: 'w', target: { expr: '-1/sqrt(L*C)' }, relTol: 0.01 });
  assert.equal(submit({ w: -1011 }).results[0].feedback, 'ω = -1011 rad/s; need -1000 rad/s ± 1%');
  assert.equal(submit({ w: -991 }).passed, true);
});

test('validation rejects a Condition expression that does not parse, wherever it sits', () => {
  const bad = { expr: '1/sqrt(L*C' };
  assert.throws(() => withCondition({ state: 'w', target: bad, tol: 1 }), /Invalid Activity: Task "t" Condition target expression "1\/sqrt\(L\*C" doesn't parse/);
  assert.throws(() => withCondition({ state: bad, equals: 1 }), /Invalid Activity: Task "t" Condition state expression/);
  assert.throws(() => withCondition([{ type: 'anyOf', conditions: [[{ type: 'range', state: 'w', below: bad }]] }]),
    /Invalid Activity: Task "t" Condition below expression/);
  assert.throws(() => withCondition(encodeKey({ type: 'range', state: 'w', above: { expr: 'w $ 2' } })), /Condition above expression/);
});

test('validation needs exactly one of tol and relTol on a target Condition', () => {
  assert.throws(() => withCondition({ state: 'w', target: 1, tol: 1, relTol: 0.1 }), /Invalid Activity: Task "t" Condition .*exactly one of tol and relTol/);
  assert.throws(() => withCondition([{ type: 'anyOf', conditions: [{ state: 'w', target: 1 }] }]), /exactly one of tol and relTol/);
  assert.throws(() => withCondition({ state: 'w', target: 1, relTol: '2%' }), /exactly one of tol and relTol/);
});

test('an encoded Condition containing expressions is decoded and judged', () => {
  const whole = withCondition(encodeKey({ type: 'range', state: { expr: 'abs(V_L - V_C)' }, below: { expr: 'n / 100' } }));
  assert.equal(whole({ V_L: 1 }).results[0].feedback, 'abs(V_L - V_C) = 1; need < 0.02');
  assert.equal(whole({ V_L: 0.01 }).passed, true);
  const slot = withCondition({ state: 'w', target: encodeKey({ expr: '1/sqrt(L*C)' }), tol: 0.5 });
  assert.equal(slot({ w: 1000 }).passed, true);
});
