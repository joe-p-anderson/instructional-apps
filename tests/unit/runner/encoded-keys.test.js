import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner, scoreActivity, encodeKey, decodeKey } from '../../../framework/v1/runner/index.js';
import { stubTool } from './stub-tool.js';

const plainCondition = { state: 'x', target: Math.PI / 2, tol: 0.05, targetLabel: 'π/2 ≈ 1.571' };
const plainQuestions = [
  { id: 'T', kind: 'numeric', prompt: '', answer: 3, tol: 0.05, points: 2 },
  { id: 'c', kind: 'choice', prompt: '', correct: 'b', points: 1,
    choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] },
];

function activityWith(condition, questions) {
  return {
    id: 'e', version: 1, title: 'E', course: 'X', tool: 'stub',
    parts: [{ id: 'p1', title: 'P', mode: 'main', setup: {}, tasks: [
      { id: 'set', title: 'Set', prompt: '', points: 1, condition },
      { id: 'ask', title: 'Ask', prompt: '', points: 1, questions },
    ] }],
  };
}

const plain = activityWith(plainCondition, plainQuestions);
const encoded = activityWith(encodeKey(plainCondition), [
  { ...plainQuestions[0], answer: encodeKey(3), tol: encodeKey(0.05) },
  { ...plainQuestions[1], correct: encodeKey('b') },
]);

// Replay the same Submits against a runner; return what the student sees and the score.
function replay(activity) {
  const tool = stubTool({ state: { x: { value: 0 } } });
  const r = createRunner(activity, { tools: { p1: tool } });
  r.start('Ada');
  const seen = [];
  for (const x of [1.4, 1.6]) {
    tool.setState({ x });
    const { results, passed } = r.submit('p1', 'set');
    seen.push({ results, passed });
  }
  for (const answers of [{ T: '3.2', c: 'a' }, { T: '2.96', c: 'b' }]) {
    const { results, passed } = r.submit('p1', 'ask', answers);
    seen.push({ results, passed });
  }
  return { seen, score: r.score(), attempts: ['set', 'ask'].map((t) => r.task('p1', t).attempts) };
}

test('an encoded key decodes to exactly the value that was encoded', () => {
  for (const value of [Math.PI / 4, 0.05, 'b', plainCondition, [plainCondition, { state: 'y', equals: true }]]) {
    assert.deepEqual(decodeKey(encodeKey(value)), value);
  }
});

test('an encoded key does not show its value in plain text', () => {
  const key = encodeKey(plainCondition);
  assert.equal(typeof key, 'string');
  for (const leak of ['1.57', 'target', 'π/2', 'tol']) assert.ok(!key.includes(leak), `${key} contains ${leak}`);
});

test('encoded Conditions and Questions evaluate the same as their plain forms', () => {
  const a = replay(plain);
  const b = replay(encoded);
  assert.deepEqual(b.seen.map((s) => s.passed), [false, true, false, true]);
  assert.match(b.seen[0].results[0].feedback, /need π\/2 ≈ 1\.571/);
  assert.deepEqual(b.seen, a.seen);
  assert.deepEqual(b.score, a.score);
});

test('scoring an encoded Activity from recorded Attempts matches the plain Activity', () => {
  const { attempts } = replay(plain);
  const recorded = { p1: { set: attempts[0], ask: attempts[1] } };
  assert.deepEqual(scoreActivity(encoded, recorded), scoreActivity(plain, recorded));
  assert.equal(scoreActivity(encoded, recorded).earned, 5);
});

test('a malformed encoded key is reported as invalid', () => {
  assert.throws(() => decodeKey('enc1:not-really'), /encoded key/i);
});
