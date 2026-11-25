import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareHash, readShareHash } from '../../../framework/v1/persistence.js';

test('a share hash round-trips a State, including non-ASCII text', () => {
  const state = { mode: 'dual-trace', state: { Va: 1.5, f: 0.25, note: 'φ = π/4' } };
  const hash = shareHash(state);
  assert.match(hash, /^#s=[A-Za-z0-9_-]+$/);
  assert.deepEqual(readShareHash(hash), state);
});

test('a hash that is not a share link reads as null', () => {
  assert.equal(readShareHash(''), null);
  assert.equal(readShareHash('#top'), null);
  assert.equal(readShareHash('#s=not*valid*base64'), null);
  assert.equal(readShareHash('#s=' + Buffer.from('not json').toString('base64url')), null);
});
