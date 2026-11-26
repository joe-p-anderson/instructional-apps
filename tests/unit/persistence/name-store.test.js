import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameStore, runStore } from '../../../framework/v1/persistence.js';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

test('a stored name is shared by every Activity on the site', () => {
  const storage = memoryStorage();
  nameStore(storage).save('Ada Lovelace');
  assert.equal(nameStore(storage).load(), 'Ada Lovelace');
});

test('with nothing stored, the name loads as null', () => {
  assert.equal(nameStore(memoryStorage()).load(), null);
});

test("forgetting the name leaves every Activity's saved Run in place", () => {
  const storage = memoryStorage();
  nameStore(storage).save('Ada Lovelace');
  runStore('lab-a', storage).save({ run: 'a' });
  nameStore(storage).clear();
  assert.equal(nameStore(storage).load(), null);
  assert.deepEqual(runStore('lab-a', storage).load(), { run: 'a' });
});

test('a stored value that is not a usable name loads as null', () => {
  const storage = memoryStorage();
  for (const bad of [42, { name: 'x' }, '', '   ']) {
    nameStore(storage).save(bad);
    assert.equal(nameStore(storage).load(), null, JSON.stringify(bad));
  }
});
