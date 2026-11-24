import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner } from '../../../framework/v1/runner/index.js';
import { stubTool } from './stub-tool.js';

function setup(tasks) {
  const activity = {
    id: 'q', version: 1, title: 'Q', course: 'X', tool: 'stub',
    parts: [{ id: 'p1', title: 'P', mode: 'main', setup: {}, tasks }],
  };
  const tool = stubTool({ state: { x: { value: 0 } } });
  const r = createRunner(activity, { tools: { p1: tool } });
  r.start('Ada');
  return { r, tool };
}

test('a numeric Question passes within an absolute tolerance', () => {
  const { r } = setup([{ id: 't', title: 'T', prompt: '', points: 1, questions: [
    { id: 'T', kind: 'numeric', prompt: 'Period?', answer: 3, tol: 0.05 },
  ] }]);
  assert.equal(r.submit('p1', 't', { T: 3.1 }).passed, false);
  assert.equal(r.submit('p1', 't', { T: 3.04 }).passed, true);
});

test('a numeric Question passes within a relative tolerance', () => {
  const { r } = setup([{ id: 't', title: 'T', prompt: '', points: 1, questions: [
    { id: 'R', kind: 'numeric', prompt: 'Resistance?', answer: 200, relTol: 0.02 },
  ] }]);
  assert.equal(r.submit('p1', 't', { R: 205 }).passed, false);
  assert.equal(r.submit('p1', 't', { R: '196.5' }).passed, true);
});

test('a multiple-choice Question passes only on the correct choice', () => {
  const { r } = setup([{ id: 't', title: 'T', prompt: '', points: 1, questions: [
    { id: 'c', kind: 'choice', prompt: 'Which leads?', correct: 'b',
      choices: [{ id: 'a', text: 'Voltage' }, { id: 'b', text: 'Current' }] },
  ] }]);
  assert.equal(r.submit('p1', 't', {}).passed, false);
  assert.equal(r.submit('p1', 't', { c: 'a' }).passed, false);
  assert.equal(r.submit('p1', 't', { c: 'b' }).passed, true);
});

test('a free-text Question is recorded on the Attempt but never judged', () => {
  const { r } = setup([{ id: 't', title: 'T', prompt: '', points: 1, questions: [
    { id: 'why', kind: 'text', prompt: 'Explain.' },
  ] }]);
  const attempt = r.submit('p1', 't', {});
  assert.equal(attempt.passed, true);
  assert.deepEqual(attempt.answers, {});
  assert.deepEqual(attempt.results, [{ kind: 'question', id: 'why', graded: false, pass: null, feedback: null }]);
});

test('answers are recorded on each Attempt, with feedback on a missed Question', () => {
  const { r } = setup([{ id: 't', title: 'T', prompt: '', points: 1, questions: [
    { id: 'T', kind: 'numeric', prompt: 'Period?', answer: 3, tol: 0.05 },
    { id: 'why', kind: 'text', prompt: 'Explain.' },
  ] }]);
  const answers = { T: 2, why: 'Peaks are 3 ms apart' };
  r.submit('p1', 't', answers);
  answers.T = 99; // later edits by the caller don't rewrite history
  const [attempt] = r.task('p1', 't').attempts;
  assert.deepEqual(attempt.answers, { T: 2, why: 'Peaks are 3 ms apart' });
  assert.equal(attempt.results[0].pass, false);
  assert.match(attempt.results[0].feedback, /\S/);
});

test('a Task passes only when its Condition and all graded Questions pass', () => {
  const { r, tool } = setup([{ id: 't', title: 'T', prompt: '', points: 1,
    condition: { state: 'x', target: 1, tol: 0.1 },
    questions: [
      { id: 'T', kind: 'numeric', prompt: 'Period?', answer: 3, tol: 0.05 },
      { id: 'why', kind: 'text', prompt: 'Explain.' },
    ] }]);
  assert.equal(r.submit('p1', 't', { T: 3 }).passed, false); // Condition misses
  tool.setState({ x: 1 });
  assert.equal(r.submit('p1', 't', { T: 4 }).passed, false); // Question misses
  const pass = r.submit('p1', 't', { T: 3 });
  assert.equal(pass.passed, true);
  assert.deepEqual(pass.results.map((x) => x.kind), ['condition', 'question', 'question']);
});

test('an Activity with a malformed Question is rejected', () => {
  const bad = (q) => () => setup([{ id: 't', title: 'T', prompt: '', points: 1, questions: [q] }]);
  assert.throws(bad({ id: 'a', kind: 'essay' }), /kind/);
  assert.throws(bad({ id: 'a', kind: 'numeric', answer: 3 }), /tol/);
  assert.throws(bad({ id: 'a', kind: 'choice', choices: [{ id: 'x' }, { id: 'z' }], correct: 'y' }), /correct/);
  assert.throws(bad({ kind: 'text' }), /id/);
});
