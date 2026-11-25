import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, standaloneStore, runStore } from '../../../framework/v1/persistence.js';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

test('a saved value loads back from the same storage', () => {
  const storage = memoryStorage();
  standaloneStore('oscilloscope', 'dual-trace', storage).save({ Va: 1, f: 0.25 });
  assert.deepEqual(standaloneStore('oscilloscope', 'dual-trace', storage).load(), { Va: 1, f: 0.25 });
});

test('Standalone State is kept separately for each Tool and Mode', () => {
  const storage = memoryStorage();
  standaloneStore('oscilloscope', 'dual-trace', storage).save({ Va: 1 });
  standaloneStore('oscilloscope', 'xy', storage).save({ Va: 3 });
  assert.deepEqual(standaloneStore('oscilloscope', 'dual-trace', storage).load(), { Va: 1 });
  assert.deepEqual(standaloneStore('oscilloscope', 'xy', storage).load(), { Va: 3 });
  assert.equal(standaloneStore('other-tool', 'dual-trace', storage).load(), null);
});

test("each Activity's Run is kept separately, and apart from Standalone State", () => {
  const storage = memoryStorage();
  runStore('lab-a', storage).save({ run: 'a' });
  runStore('lab-b', storage).save({ run: 'b' });
  standaloneStore('lab-a', 'lab-a', storage).save({ Va: 1 });
  assert.deepEqual(runStore('lab-a', storage).load(), { run: 'a' });
  assert.deepEqual(runStore('lab-b', storage).load(), { run: 'b' });
  runStore('lab-a', storage).clear();
  assert.equal(runStore('lab-a', storage).load(), null);
  assert.deepEqual(standaloneStore('lab-a', 'lab-a', storage).load(), { Va: 1 });
});

test('nothing saved, a corrupt entry, or a cleared store loads as null', () => {
  const storage = memoryStorage();
  const store = createStore('k', storage);
  assert.equal(store.load(), null);
  storage.setItem('k', '{not json');
  assert.equal(store.load(), null);
  store.save({ a: 1 });
  store.clear();
  assert.equal(store.load(), null);
});

test('unavailable or throwing storage never throws', () => {
  const throwing = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('quota'); },
    removeItem() { throw new Error('denied'); },
  };
  for (const storage of [throwing, null, undefined]) {
    const store = createStore('k', storage);
    assert.doesNotThrow(() => store.save({ a: 1 }));
    assert.equal(store.load(), null);
    assert.doesNotThrow(() => store.clear());
  }
});
