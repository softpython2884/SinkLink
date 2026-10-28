import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  apply,
  fitAspect,
  mirrorCrop,
  outputGeometry,
  resizeCrop,
  rotateCrop,
  straightenScale,
} from '../src/render/geometry.js';
import { DEFAULT_EDIT } from '../src/state/defaults.js';

const crop = DEFAULT_EDIT.crop;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≉ ${b}`);
const nearPoint = (p, q) => { near(p[0], q[0]); near(p[1], q[1]); };

test('default crop maps output to source unchanged', () => {
  const g = outputGeometry(crop, 400, 300);
  assert.equal(g.width, 400);
  assert.equal(g.height, 300);
  nearPoint(apply(g.toSource, 0, 0), [0, 0]);
  nearPoint(apply(g.toSource, 0.25, 0.75), [0.25, 0.75]);
});

test('a quarter turn clockwise swaps the frame and rotates corners', () => {
  const g = outputGeometry(rotateCrop(crop, 1), 400, 300);
  assert.equal(g.width, 300);
  assert.equal(g.height, 400);
  // The top-left of the source ends up top-right of the output.
  nearPoint(apply(g.fromSource, 0, 0), [1, 0]);
  nearPoint(apply(g.fromSource, 0, 1), [0, 0]);
});

test('four quarter turns give back the original crop', () => {
  let c = { ...crop, x: 0.1, y: 0.2, w: 0.5, h: 0.3, aspect: 1.5 };
  for (let i = 0; i < 4; i++) c = rotateCrop(c, 1);
  near(c.x, 0.1); near(c.y, 0.2); near(c.w, 0.5); near(c.h, 0.3);
  assert.equal(c.rotate, 0);
  near(c.aspect, 1.5);
  const back = rotateCrop(rotateCrop(c, 1), -1);
  near(back.x, 0.1); near(back.y, 0.2);
});

test('mirror flips the displayed image horizontally whatever the rotation', () => {
  for (const rotate of [0, 1, 2, 3]) {
    const c = { ...crop, rotate, angle: 7 };
    const before = outputGeometry(c, 400, 300);
    const after = outputGeometry(mirrorCrop(c), 400, 300);
    for (const [u, v] of [[0.3, 0.4], [0.5, 0.5], [0.8, 0.1]]) {
      const p = apply(before.fromSource, u, v);
      const q = apply(after.fromSource, u, v);
      near(q[0], 1 - p[0]);
      near(q[1], p[1]);
    }
  }
});

test('straightening zooms just enough to cover the frame', () => {
  near(straightenScale(400, 300, 0), 1);
  const angle = 0.2;
  const g = outputGeometry({ ...crop, angle: (angle * 180) / Math.PI }, 400, 300);
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const [u, v] = apply(g.toSource, x, y);
    assert.ok(u >= -1e-9 && u <= 1 + 1e-9 && v >= -1e-9 && v <= 1 + 1e-9, `${u},${v}`);
  }
});

test('crop rectangle selects the right part of the source', () => {
  const g = outputGeometry({ ...crop, x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, 400, 300);
  assert.equal(g.width, 200);
  nearPoint(apply(g.toSource, 0, 0), [0.5, 0.5]);
  nearPoint(apply(g.toSource, 1, 1), [1, 1]);
});

test('fitAspect gives the largest centred rectangle of that ratio', () => {
  const c = fitAspect(crop, 1, 400, 300);
  near(c.w * 400, c.h * 300);
  near(c.h, 1);
  near(c.x, (1 - c.w) / 2);
});

test('resizeCrop keeps the ratio and the opposite corner', () => {
  const start = fitAspect(crop, 1, 400, 300);
  const next = resizeCrop(start, 'se', 0.6, 0.5, { ratio: 1, frameWidth: 400, frameHeight: 300 });
  near(next.w * 400, next.h * 300);
  near(next.x, start.x);
  near(next.y, start.y);
});

test('resizeCrop without ratio clamps to the frame', () => {
  const next = resizeCrop({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 'nw', -0.5, 0.1);
  near(next.x, 0);
  near(next.y, 0.1);
  near(next.w, 0.7);
});
