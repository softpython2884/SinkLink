import { test } from 'node:test';
import assert from 'node:assert/strict';
import { developUniforms, localUniforms, toneOffset, whiteBalanceGains } from '../src/render/uniforms.js';
import { DEFAULT_EDIT } from '../src/state/defaults.js';

test('default edit gives neutral develop uniforms', () => {
  const u = developUniforms(DEFAULT_EDIT);
  assert.deepEqual(u.uWb.map((v) => +v.toFixed(9)), [1, 1, 1]);
  assert.equal(u.uExposure, 1);
  assert.equal(u.uGamma, 1);
  assert.deepEqual(u.uLevelsIn, [0, 1]);
  assert.deepEqual(u.uLevelsOut, [0, 1]);
  assert.equal(u.uHslOn, false);
  assert.equal(u.uCurveOn, false);
  assert.equal(u.uHdr[0], 0);
});

test('white balance keeps luminance constant', () => {
  for (const [t, tint] of [[1, 0], [-1, 0], [0.4, -0.7]]) {
    const [r, g, b] = whiteBalanceGains(t, tint);
    assert.ok(Math.abs(0.2126 * r + 0.7152 * g + 0.0722 * b - 1) < 1e-9);
  }
});

test('tone offsets carry no luminance', () => {
  for (const hue of [0, 45, 200, 330]) {
    const [r, g, b] = toneOffset(hue);
    assert.ok(Math.abs(0.2126 * r + 0.7152 * g + 0.0722 * b) < 1e-9);
  }
});

test('local uniforms read the right geometry per zone type', () => {
  const point = localUniforms({ type: 'point', x: 0.2, y: 0.3, radius: 0.1, exposure: 50 }, [1, 0.75]);
  assert.deepEqual(point.uP0, [0.2, 0.3]);
  assert.equal(point.uType, 1);
  const gradient = localUniforms({ type: 'gradient', x0: 0, y0: 0.1, x1: 0, y1: 0.6 }, [1, 0.75]);
  assert.deepEqual(gradient.uP1, [0, 0.6]);
  assert.equal(gradient.uType, 2);
});
