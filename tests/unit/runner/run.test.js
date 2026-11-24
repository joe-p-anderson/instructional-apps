import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner } from '../../../framework/v1/runner/index.js';
import { stubTool } from './stub-tool.js';

const activity = {
  id: 'demo', version: 1, title: 'Demo', course: 'PHY 0000', tool: 'stub',
  parts: [{ id: 'p1', title: 'Part 1', mode: 'main', setup: {}, tasks: [
    { id: 't1', title: 'T1', prompt: 'Do it', points: 1,
      condition: { state: 'x', target: 1, tol: 0.1 } },
  ] }],
};

function newRunner() {
  return createRunner(activity, { tools: { p1: stubTool({ state: { x: { value: 0 } } }) } });
}

test('a Run does not start until a name is given', () => {
  const r = newRunner();
  assert.equal(r.run, null);
  assert.throws(() => r.submit('p1', 't1'), /name/i);
  assert.throws(() => r.start('   '), /name/i);
  assert.equal(r.run, null);
});

test('starting a Run records the name, a random fingerprint and a start time', () => {
  const a = newRunner();
  const b = newRunner();
  const run = a.start('  Ada Lovelace ');
  b.start('Ada Lovelace');
  assert.equal(run.name, 'Ada Lovelace');
  assert.match(run.fingerprint, /^[0-9a-f]{32}$/);
  assert.notEqual(a.run.fingerprint, b.run.fingerprint);
  assert.ok(!Number.isNaN(Date.parse(run.startedAt)));
});

test('the name and fingerprint cannot change within the Run', () => {
  const r = newRunner();
  const { fingerprint } = r.start('Ada');
  assert.throws(() => r.start('Grace'), /already/i);
  assert.throws(() => { 'use strict'; r.run.name = 'Grace'; });
  assert.equal(r.run.name, 'Ada');
  assert.equal(r.run.fingerprint, fingerprint);
});
