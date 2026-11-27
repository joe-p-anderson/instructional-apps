import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner } from '../../../framework/v1/runner/index.js';
import { stubTool } from './stub-tool.js';

const valid = () => ({
  id: 'demo', version: 1, title: 'Demo', course: 'PHY 0000', tool: 'stub',
  parts: [{ id: 'p1', title: 'Part 1', mode: 'main', setup: {}, tasks: [
    { id: 't1', title: 'T1', prompt: 'Do it', points: 1 },
  ] }],
});
const tools = () => ({ p1: stubTool() });

test('a well-formed Activity definition is accepted', () => {
  assert.doesNotThrow(() => createRunner(valid(), { tools: tools() }));
});

test('malformed Activity definitions are rejected with a clear message', () => {
  const cases = [
    [(a) => { delete a.id; }, /id/],
    [(a) => { delete a.tool; }, /tool/i],
    [(a) => { a.parts = []; }, /part/i],
    [(a) => { a.parts.push({ ...a.parts[0] }); }, /duplicate part/i],
    [(a) => { delete a.parts[0].mode; }, /mode/i],
    [(a) => { a.parts[0].tasks.push({ ...a.parts[0].tasks[0] }); }, /duplicate task/i],
    [(a) => { a.parts[0].tasks[0].points = 'one'; }, /points/i],
    [(a) => { a.parts[0].tasks[0].hint = { text: 'x' }; }, /hint/i],
  ];
  for (const [mutate, message] of cases) {
    const a = valid();
    mutate(a);
    assert.throws(() => createRunner(a, { tools: tools() }), message);
  }
});

test('every Part needs a Tool instance', () => {
  assert.throws(() => createRunner(valid(), { tools: {} }), /tool instance/i);
});

test('notes on the Activity, its Parts and its Tasks are accepted, and must be text', () => {
  const a = valid();
  a.notes = 'Design: why this Activity exists.';
  a.parts[0].notes = 'Part design.';
  a.parts[0].tasks[0].notes = 'Task design.';
  assert.doesNotThrow(() => createRunner(a, { tools: tools() }));
  for (const where of [(x) => x, (x) => x.parts[0], (x) => x.parts[0].tasks[0]]) {
    const b = valid();
    where(b).notes = 42;
    assert.throws(() => createRunner(b, { tools: tools() }), /notes/);
  }
});

test('notes never reach the Report', async () => {
  const a = valid();
  a.notes = 'SECRET-ACTIVITY-NOTE';
  a.parts[0].notes = 'SECRET-PART-NOTE';
  a.parts[0].tasks[0].notes = 'SECRET-TASK-NOTE';
  const runner = createRunner(a, { tools: tools() });
  runner.start('Ada');
  runner.submit('p1', 't1');
  const report = JSON.stringify(await runner.report());
  assert.doesNotMatch(report, /SECRET|notes/);
});
