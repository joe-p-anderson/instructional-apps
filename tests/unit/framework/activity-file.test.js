import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeActivity, activityPage } from '../../../framework/v1/activity-file.js';

test('an Activity is saved with a fixed key order and a two-space indent, whatever order it was written in', () => {
  const activity = {
    parts: [{
      tasks: [{
        hint: { text: 'enc1:abc', after: 3 },
        notes: 'why',
        points: 1,
        condition: 'enc1:xyz',
        prompt: 'Do it',
        hide: ['b'],
        show: ['a'],
        title: 'T1',
        id: 't1',
        questions: [{ points: 1, tol: 0.1, answer: 'enc1:k', prompt: 'How much?', kind: 'numeric', id: 'q1' }],
      }],
      setup: { f: 0.5, Va: 2 },
      mode: 'main',
      title: 'Part 1',
      id: 'p1',
    }],
    tool: 'stub',
    notes: 'design',
    course: 'PHY 0000',
    title: 'Demo',
    version: 1,
    id: 'demo',
  };
  assert.equal(serializeActivity(activity), `{
  "id": "demo",
  "version": 1,
  "title": "Demo",
  "course": "PHY 0000",
  "tool": "stub",
  "notes": "design",
  "parts": [
    {
      "id": "p1",
      "title": "Part 1",
      "mode": "main",
      "setup": {
        "f": 0.5,
        "Va": 2
      },
      "tasks": [
        {
          "id": "t1",
          "title": "T1",
          "prompt": "Do it",
          "show": [
            "a"
          ],
          "hide": [
            "b"
          ],
          "condition": "enc1:xyz",
          "questions": [
            {
              "id": "q1",
              "kind": "numeric",
              "prompt": "How much?",
              "answer": "enc1:k",
              "tol": 0.1,
              "points": 1
            }
          ],
          "points": 1,
          "hint": {
            "after": 3,
            "text": "enc1:abc"
          },
          "notes": "why"
        }
      ]
    }
  ]
}
`);
});

test('a plain Condition and a choice Question are saved in their fixed order too', () => {
  const activity = {
    id: 'a', version: 1, title: 'A', course: 'C', tool: 't',
    parts: [{ id: 'p', title: 'P', mode: 'm', setup: {}, tasks: [{
      id: 't', title: 'T', prompt: 'x', points: 0,
      condition: { type: 'anyOf', conditions: [{ tol: 0.05, target: 3, state: 'T' }, { below: 1, type: 'range', state: 'T' }] },
      questions: [{ correct: 'b', choices: [{ text: 'B', id: 'b' }], prompt: 'Pick', kind: 'choice', id: 'q' }],
    }] }],
  };
  const saved = JSON.parse(serializeActivity(activity)).parts[0].tasks[0];
  assert.deepEqual(Object.keys(saved.condition), ['type', 'conditions']);
  assert.deepEqual(Object.keys(saved.condition.conditions[0]), ['state', 'target', 'tol']);
  assert.deepEqual(Object.keys(saved.condition.conditions[1]), ['type', 'state', 'below']);
  assert.deepEqual(Object.keys(saved.questions[0]), ['id', 'kind', 'prompt', 'choices', 'correct']);
  assert.deepEqual(Object.keys(saved.questions[0].choices[0]), ['id', 'text']);
});

test('keys the format does not name are kept, after the known ones, in their own order', () => {
  const activity = { zeta: 1, id: 'a', alpha: 2, version: 1, title: 'A', tool: 't', parts: [] };
  assert.deepEqual(Object.keys(JSON.parse(serializeActivity(activity))), ['id', 'version', 'title', 'tool', 'parts', 'zeta', 'alpha']);
});

test('saving a saved Activity again gives the same text', () => {
  const text = serializeActivity({ id: 'a', version: 2, title: 'A', course: 'C', tool: 't', parts: [
    { id: 'p', title: 'P', mode: 'm', setup: { x: [1, 2] }, tasks: [{ id: 't', title: 'T', prompt: 'π', points: 1 }] },
  ] });
  assert.equal(serializeActivity(JSON.parse(text)), text);
});

test('an Activity that is not plain data cannot be saved', () => {
  const base = () => ({ id: 'a', version: 1, title: 'A', tool: 't', parts: [
    { id: 'p', title: 'P', mode: 'm', setup: {}, tasks: [{ id: 't', title: 'T', prompt: 'x', points: 1 }] },
  ] });
  const withFunction = base();
  withFunction.parts[0].tasks[0].condition = (state) => state.x > 0;
  assert.throws(() => serializeActivity(withFunction), /plain data.*parts\[0\]\.tasks\[0\]\.condition/);
  const withTypes = base();
  withTypes.conditionTypes = { near: () => ({ pass: true }) };
  assert.throws(() => serializeActivity(withTypes), /plain data.*conditionTypes/);
  const withNaN = base();
  withNaN.parts[0].setup.x = NaN;
  assert.throws(() => serializeActivity(withNaN), /plain data.*setup\.x/);
});

test('the Activity page imports its Tool, fetches the JSON beside it and mounts the runner', () => {
  const page = activityPage({ title: 'Waves & <Signals>', tool: 'oscilloscope', file: 'phase-period-amplitude.json' });
  assert.match(page, /^<!DOCTYPE html>/);
  assert.match(page, /<title>Waves &amp; &lt;Signals&gt;<\/title>/);
  assert.match(page, /href="\.\.\/\.\.\/\.\.\/framework\/v1\/theme\.css"/);
  assert.match(page, /import \* as tool from '\.\.\/oscilloscope\.js';/);
  assert.match(page, /fetch\('\.\/phase-period-amplitude\.json'\)/);
  assert.match(page, /mountActivity\(tool\.default, activity, app, \{ conditionTypes: tool\.conditionTypes \}\)/);
  assert.match(page, /window\.activityHost = /);
});
