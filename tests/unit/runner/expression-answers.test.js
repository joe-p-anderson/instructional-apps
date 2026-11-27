import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner, encodeKey, scoreActivity } from '../../../framework/v1/runner/index.js';
import { verifyReport } from '../../../framework/v1/report.js';
import { stubTool } from './stub-tool.js';

function activityWith(questions) {
  return {
    id: 'x', version: 1, title: 'X', course: 'X', tool: 'stub',
    parts: [{ id: 'p1', title: 'P', mode: 'main', setup: {}, tasks: [
      { id: 't', title: 'T', prompt: '', points: 1, questions },
    ] }],
  };
}

function setup(questions, state = { I: { value: 0.004 } }) {
  const activity = activityWith(questions);
  const tool = stubTool({ state });
  const r = createRunner(activity, { tools: { p1: tool } });
  r.start('Ada');
  return { r, tool, activity };
}

const current = { id: 'I', kind: 'numeric', prompt: 'Current in mA?', answer: { expr: 'I * 1000' }, tol: 0.05 };

test('an expression answer is judged against the live State at Submit', () => {
  const { r, tool } = setup([current]);
  assert.equal(r.submit('p1', 't', { I: 4.5 }).passed, false);
  tool.setState({ I: 0.005 });
  assert.equal(r.submit('p1', 't', { I: 4.02 }).passed, false); // the key moved with the State
  assert.equal(r.submit('p1', 't', { I: '5.03' }).passed, true);
});

test('an expression answer takes a relative tolerance and a modulus', () => {
  const judge = (given) => setup([{ id: 'phi', kind: 'numeric', prompt: '', answer: { expr: 'deg(atan2(-y, 0))' }, relTol: 0.02, modulus: 360 }],
    { y: { value: 1 } }).r.submit('p1', 't', { phi: given }).passed; // key -90, ±1.8
  assert.equal(judge(271.5), true);
  assert.equal(judge(272), false);
});

test('an encoded expression answer is decoded by the runner and judged the same', () => {
  const { r } = setup([{ ...current, answer: encodeKey({ expr: 'I * 1000' }) }]);
  assert.equal(r.submit('p1', 't', { I: 4.5 }).passed, false);
  assert.equal(r.submit('p1', 't', { I: 4 }).passed, true);
});

test('an Activity whose expression answer does not parse is rejected', () => {
  assert.throws(() => setup([{ ...current, answer: { expr: 'I * (1000' } }]), /Invalid Activity: Question "I".*expression/);
  assert.throws(() => setup([{ ...current, answer: encodeKey({ expr: 'I $ 2' }) }]), /Invalid Activity: Question "I".*expression/);
  assert.throws(() => setup([{ ...current, answer: { expr: 3 } }]), /numeric answer/);
});

test('an expression naming unknown State is a miss whose feedback names it', () => {
  const { r } = setup([{ ...current, answer: { expr: 'I * R' } }]);
  const attempt = r.submit('p1', 't', { I: 4 });
  assert.equal(attempt.passed, false);
  assert.match(attempt.results[0].feedback, /unknown State "R"/);
  assert.equal('expected' in attempt.results[0], false);
});

test('an expression that works out to a non-finite value is a miss whose feedback says so', () => {
  const { r } = setup([{ ...current, answer: { expr: '1 / (I - I)' } }]);
  const attempt = r.submit('p1', 't', { I: 4 });
  assert.equal(attempt.passed, false);
  assert.match(attempt.results[0].feedback, /Infinity/);
  assert.equal('expected' in attempt.results[0], false);
});

test('each judged numeric result records the expected value it was judged against', () => {
  const { r, tool } = setup([
    current,
    { id: 'T', kind: 'numeric', prompt: '', answer: 3, tol: 0.05 },
    { id: 'c', kind: 'choice', prompt: '', correct: 'b', choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] },
    { id: 'why', kind: 'text', prompt: '' },
  ]);
  tool.setState({ I: 0.0042 });
  const { results } = r.submit('p1', 't', { I: 1, T: 1, c: 'a', why: '' });
  assert.equal(results[0].expected, 4.2);
  assert.equal(results[1].expected, 3);
  assert.equal('expected' in results[2], false);
  assert.equal('expected' in results[3], false);
});

test('scores recompute expression answers from each Attempt\'s recorded State', () => {
  const activity = activityWith([current]);
  const score = (state, given) => scoreActivity(activity, { p1: { t: [{ state, answers: { I: given } }] } }).earned;
  assert.equal(score({ I: 0.004 }, 4), 1);
  assert.equal(score({ I: 0.005 }, 4), 0);
  assert.equal(score({}, 4), 0); // unknown State on replay is a miss
});

test('a Report records expected values, stays at format version 1, and is written by framework 1.1.0', async () => {
  const { r, tool } = setup([current]);
  tool.setState({ I: 0.003 });
  r.submit('p1', 't', { I: 4 });
  const report = await r.report();
  assert.equal(report.formatVersion, 1);
  assert.equal(report.frameworkVersion, '1.1.0');
  assert.equal(report.parts[0].tasks[0].attempts[0].results[0].expected, 3);
  assert.equal(verifyReport(report), true);
});