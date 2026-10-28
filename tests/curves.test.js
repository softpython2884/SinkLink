import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCurveLut, curveFunction, isIdentity, sampleCurve } from '../src/edit/curves.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('identity curve maps x to x', () => {
  const f = curveFunction([[0, 0], [1, 1]]);
  for (const x of [0, 0.1, 0.5, 0.93, 1]) close(f(x), x);
  assert.ok(isIdentity([[0, 0], [1, 1]]));
});

test('curve goes through its control points', () => {
  const points = [[0, 0], [0.3, 0.2], [0.7, 0.85], [1, 1]];
  const f = curveFunction(points);
  for (const [x, y] of points) close(f(x), y);
});

test('curve is monotone when control points are', () => {
  const samples = sampleCurve([[0, 0], [0.2, 0.05], [0.25, 0.6], [0.9, 0.62], [1, 1]], 512);
  for (let i = 1; i < samples.length; i++) assert.ok(samples[i] >= samples[i - 1] - 1e-6);
});

test('curve is flat outside the outer points', () => {
  const f = curveFunction([[0.2, 0.1], [0.8, 0.9]]);
  close(f(0), 0.1);
  close(f(1), 0.9);
});

test('lut applies the master curve before the channel curves', () => {
  const lut = buildCurveLut({
    rgb: [[0, 0.5], [1, 0.5]],
    red: [[0, 0], [1, 1]],
    green: [[0, 1], [1, 0]],
    blue: [[0, 0], [1, 1]],
  });
  assert.equal(lut[0], 128);
  assert.equal(lut[1], 128);
  assert.equal(lut[3], 255);
});
