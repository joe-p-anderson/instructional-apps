import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finite } from '../../../tools/phasors/numbers.js';

test('finite accepts numbers and numeric strings', () => {
  for (const v of [0, -3.5, 1e6, '2', ' 4.5 ', '-1e3']) assert.equal(finite(v), true, JSON.stringify(v));
});

test('finite refuses what restore() must ignore, booleans included', () => {
  for (const v of [true, false, null, undefined, '', '  ', 'nope', NaN, Infinity, [], [2], {}]) {
    assert.equal(finite(v), false, String(v));
  }
});
