import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/state/store.js';

test('transient changes become one undo step on commit', () => {
  const store = new Store({ v: 0 });
  store.set({ v: 1 });
  store.set({ v: 2 });
  store.commit();
  assert.equal(store.past.length, 1);
  store.undo();
  assert.deepEqual(store.state, { v: 0 });
  store.redo();
  assert.deepEqual(store.state, { v: 2 });
});

test('undo commits pending changes first', () => {
  const store = new Store({ v: 0 });
  store.set({ v: 1 });
  store.commit();
  store.set({ v: 2 });
  store.undo();
  assert.deepEqual(store.state, { v: 1 });
  store.redo();
  assert.deepEqual(store.state, { v: 2 });
});

test('a new change clears the redo stack', () => {
  const store = new Store({ v: 0 });
  store.set({ v: 1 });
  store.commit();
  store.undo();
  store.set({ v: 3 });
  store.commit();
  assert.equal(store.canRedo, false);
});

test('history is bounded', () => {
  const store = new Store({ v: 0 }, { limit: 3 });
  for (let i = 1; i <= 10; i++) {
    store.set({ v: i });
    store.commit();
  }
  assert.equal(store.past.length, 3);
});

test('listeners are notified and can unsubscribe', () => {
  const store = new Store({ v: 0 });
  let calls = 0;
  const off = store.subscribe(() => calls++);
  store.set({ v: 1 });
  off();
  store.set({ v: 2 });
  assert.equal(calls, 1);
});
