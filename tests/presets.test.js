import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOOKS, applyLook } from '../src/edit/presets.js';
import { DEFAULT_EDIT } from '../src/state/defaults.js';
import { getIn } from '../src/state/path.js';

function leafPaths(obj, prefix = []) {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? leafPaths(value, [...prefix, key])
      : [[...prefix, key].join('.')],
  );
}

test('every look only uses existing settings', () => {
  for (const look of LOOKS) {
    for (const path of leafPaths(look.values)) {
      assert.notEqual(getIn(DEFAULT_EDIT, path), undefined, `${look.id}: ${path}`);
    }
  }
});

test('a look at zero strength resets the global settings', () => {
  const edited = { ...DEFAULT_EDIT, tune: { ...DEFAULT_EDIT.tune, contrast: 40 } };
  const look = LOOKS.find((l) => l.id === 'film');
  const next = applyLook(edited, look.values, 0);
  assert.deepEqual(next.tune, DEFAULT_EDIT.tune);
  assert.deepEqual(next.split, { ...DEFAULT_EDIT.split, shadowHue: 190, highlightHue: 45 });
});

test('a look keeps crop and local edits', () => {
  const edited = { ...DEFAULT_EDIT, crop: { ...DEFAULT_EDIT.crop, w: 0.5 }, zones: [{ id: 'z' }] };
  const next = applyLook(edited, LOOKS[1].values, 1);
  assert.equal(next.crop, edited.crop);
  assert.equal(next.zones, edited.zones);
});

test('look strength scales numeric values', () => {
  const look = LOOKS.find((l) => l.id === 'bw');
  const half = applyLook(DEFAULT_EDIT, look.values, 0.5);
  assert.equal(half.bw.amount, 50);
  assert.equal(half.bw.filter, 'neutral');
});
