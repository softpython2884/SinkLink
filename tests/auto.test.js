import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageStats } from '../src/edit/analysis.js';
import { autoTune, whiteBalanceFor } from '../src/edit/auto.js';
import { whiteBalanceGains } from '../src/render/uniforms.js';

function image(width, height, fn) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fn(x / (width - 1), y / (height - 1));
      data.set([r * 255, g * 255, b * 255, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

test('a dark, flat image gets brightened and stretched', () => {
  const stats = imageStats(image(64, 64, (x) => [0.1 + x * 0.3, 0.1 + x * 0.3, 0.1 + x * 0.3]));
  const tune = autoTune(stats);
  assert.ok(tune.brightness > 0);
  assert.ok(tune.blacks < 0);
  assert.ok(tune.whites > 0);
});

test('a bright image gets darker midtones', () => {
  const stats = imageStats(image(64, 64, (x) => [0.7 + x * 0.25, 0.7 + x * 0.25, 0.7 + x * 0.25]));
  assert.ok(autoTune(stats).brightness < 0);
});

test('a warm cast is cooled down', () => {
  const stats = imageStats(image(64, 64, (x) => [0.6 + x * 0.2, 0.5 + x * 0.2, 0.38 + x * 0.2]));
  const tune = autoTune(stats);
  assert.ok(tune.temperature < 0, `temperature ${tune.temperature}`);
});

test('white balance inversion neutralises the measured grey', () => {
  const grey = [0.5, 0.42, 0.3];
  const { temperature, tint } = whiteBalanceFor(grey);
  const gains = whiteBalanceGains(temperature, tint);
  const corrected = grey.map((v, i) => v * gains[i]);
  assert.ok(Math.abs(corrected[0] - corrected[1]) < 1e-9);
  assert.ok(Math.abs(corrected[1] - corrected[2]) < 1e-9);
});
