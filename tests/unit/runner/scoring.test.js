import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner, scoreActivity } from '../../../framework/v1/runner/index.js';
import { stubTool } from './stub-tool.js';

const activity = {
  id: 's', version: 1, title: 'S', course: 'X', tool: 'stub',
  parts: [{ id: 'p1', title: 'P', mode: 'main', setup: {}, tasks: [
    { id: 'set', title: 'Set', prompt: '', points: 2, condition: { state: 'x', target: 1, tol: 0.1 } },
    { id: 'ask', title: 'Ask', prompt: '', points: 1, questions: [
      { id: 'T', kind: 'numeric', prompt: '', answer: 3, tol: 0.05, points: 2 },
      { id: 'c', kind: 'choice', prompt: '', correct: 'b', points: 1,
        choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] },
      { id: 'why', kind: 'text', prompt: '', points: 1 },
    ] },
  ] }],
};

function setup() {
  const tool = stubTool({ state: { x: { value: 0 } } });
  const r = createRunner(activity, { tools: { p1: tool } });
  r.start('Ada');
  return { r, tool };
}

const taskScores = (score) => Object.fromEntries(score.parts[0].tasks.map((t) => [t.id, [t.earned, t.possible]]));

test('nothing is earned before any Submit; possible counts Task and Question points', () => {
  const { r } = setup();
  const score = r.score();
  assert.deepEqual(taskScores(score), { set: [0, 2], ask: [0, 5] });
  assert.deepEqual([score.earned, score.possible], [0, 7]);
});

test("a Task's points are awarded once it passes, and misses cost nothing", () => {
  const { r, tool } = setup();
  r.submit('p1', 'set');
  r.submit('p1', 'set');
  tool.setState({ x: 1 });
  r.submit('p1', 'set');
  assert.deepEqual(taskScores(r.score()).set, [2, 2]);
});

test('each Question earns its share once answered correctly in any Attempt; free text when non-empty', () => {
  const { r, tool } = setup();
  tool.setState({ x: 1 });
  r.submit('p1', 'set');
  r.submit('p1', 'ask', { T: 3, c: 'a', why: '   ' }); // T right, c wrong, why blank
  assert.deepEqual(taskScores(r.score()).ask, [2, 5]);
  r.submit('p1', 'ask', { T: 9, c: 'b', why: 'because' }); // T wrong now, c and why earn
  assert.deepEqual(taskScores(r.score()).ask, [4, 5]);
  r.submit('p1', 'ask', { T: 3, c: 'b', why: 'because' }); // the Task passes
  assert.deepEqual(taskScores(r.score()).ask, [5, 5]);
  assert.deepEqual([r.score().earned, r.score().possible], [7, 7]);
});

test('scores are recomputed from the Attempts alone, ignoring stored results', () => {
  const tampered = { p1: {
    set: [{ state: { x: 0 }, answers: {}, results: [{ kind: 'condition', pass: true }], passed: true }],
    ask: [{ state: { x: 0 }, answers: { T: '3.02', c: 'b', why: '' }, results: [], passed: false }],
  } };
  const score = scoreActivity(activity, tampered);
  assert.deepEqual(taskScores(score), { set: [0, 2], ask: [4, 5] });
  assert.equal(score.parts[0].tasks[1].passed, true);
  assert.deepEqual([score.earned, score.possible], [4, 7]);
});

test('Attempts for unknown Parts or Tasks are ignored when scoring', () => {
  const score = scoreActivity(activity, { p1: { gone: [{ state: {}, answers: {} }] }, p9: {} });
  assert.deepEqual([score.earned, score.possible], [0, 7]);
});
