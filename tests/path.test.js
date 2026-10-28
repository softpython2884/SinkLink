import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getIn, setIn } from '../src/state/path.js';

test('getIn reads nested values and array indexes', () => {
  const obj = { a: { b: [{ c: 3 }] } };
  assert.equal(getIn(obj, 'a.b.0.c'), 3);
  assert.equal(getIn(obj, 'a.x.y'), undefined);
});

test('setIn copies the changed branch only', () => {
  const obj = { a: { b: 1 }, other: { x: 1 } };
  const next = setIn(obj, 'a.b', 2);
  assert.equal(next.a.b, 2);
  assert.equal(obj.a.b, 1);
  assert.equal(next.other, obj.other);
});

test('setIn returns the same object when nothing changes', () => {
  const obj = { a: { b: 1 } };
  assert.equal(setIn(obj, 'a.b', 1), obj);
});

test('setIn keeps arrays as arrays', () => {
  const obj = { list: [{ v: 1 }, { v: 2 }] };
  const next = setIn(obj, 'list.1.v', 5);
  assert.ok(Array.isArray(next.list));
  assert.deepEqual(next.list, [{ v: 1 }, { v: 5 }]);
  assert.equal(next.list[0], obj.list[0]);
});
