import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findHealSource } from '../src/edit/heal.js';

test('the healing source avoids a second blemish and stays on clean skin', () => {
  const width = 200;
  const height = 200;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Skin-like left half, dark right half.
      const skin = x < 130;
      let v = skin ? [220, 180, 160] : [40, 40, 40];
      const spot = Math.hypot(x - 80, y - 100) < 6 || Math.hypot(x - 80, y - 70) < 8;
      if (spot) v = [120, 60, 50];
      data.set([...v, 255], (y * width + x) * 4);
    }
  }
  const r = 8 / 200;
  const { sx, sy } = findHealSource({ data, width, height }, 80 / 200, 100 / 200, r);
  const px = sx * width;
  const py = sy * height;
  assert.ok(px + 8 * 1.6 < 130, `source should stay on the skin side, got x=${px}`);
  assert.ok(Math.hypot(px - 80, py - 70) > 16, 'source should not be the other blemish');
});
