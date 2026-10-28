// Geometry of the output frame: quarter turns, mirror, straighten angle and crop.
//
// Affine transforms are stored as [a, b, c, d, e, f]:
//   x' = a·x + c·y + e
//   y' = b·x + d·y + f
//
// The pipeline works in source space; the final pass maps every output pixel
// back to the source with `toSource`. Normalised coordinates have their origin
// at the top-left corner, y pointing down.

export const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);
const MIRROR = Object.freeze([-1, 0, 0, 1, 0, 0]);
const QUARTER_TURNS = [
  [1, 0, 0, 1, 0, 0],
  [0, 1, -1, 0, 0, 0],
  [-1, 0, 0, -1, 0, 0],
  [0, -1, 1, 0, 0, 0],
];

export function multiply(m, n) {
  const [a1, b1, c1, d1, e1, f1] = m;
  const [a2, b2, c2, d2, e2, f2] = n;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export function invert([a, b, c, d, e, f]) {
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

export function apply([a, b, c, d, e, f], x, y) {
  return [a * x + c * y + e, b * x + d * y + f];
}

export function rotation(radians) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [cos, sin, -sin, cos, 0, 0];
}

export function toMat3([a, b, c, d, e, f]) {
  return new Float32Array([a, b, 0, c, d, 0, e, f, 1]);
}

export function frameSize(width, height, rotate) {
  return rotate % 2 ? [height, width] : [width, height];
}

// Zoom needed so that the straightened image still covers the whole frame.
export function straightenScale(frameWidth, frameHeight, radians) {
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return Math.max(cos + (frameHeight / frameWidth) * sin, (frameWidth / frameHeight) * sin + cos);
}

export function outputGeometry(crop, width, height, { frame = false } = {}) {
  const [frameWidth, frameHeight] = frameSize(width, height, crop.rotate);
  const radians = (crop.angle * Math.PI) / 180;
  const scale = straightenScale(frameWidth, frameHeight, radians);
  const rect = frame ? { x: 0, y: 0, w: 1, h: 1 } : crop;

  const steps = [
    [1 / width, 0, 0, 1 / height, 0.5, 0.5],
    multiply(crop.flip ? MIRROR : IDENTITY, QUARTER_TURNS[(4 - crop.rotate) % 4]),
    multiply([1 / scale, 0, 0, 1 / scale, 0, 0], rotation(-radians)),
    [frameWidth, 0, 0, frameHeight, -frameWidth / 2, -frameHeight / 2],
    [rect.w, 0, 0, rect.h, rect.x, rect.y],
  ];
  const toSource = steps.reduce(multiply);

  return {
    width: rect.w * frameWidth,
    height: rect.h * frameHeight,
    frameWidth,
    frameHeight,
    scale,
    toSource,
    fromSource: invert(toSource),
  };
}

export function rotateCrop(crop, direction) {
  const { x, y, w, h } = crop;
  const rect = direction > 0
    ? { x: 1 - y - h, y: x, w: h, h: w }
    : { x: y, y: 1 - x - w, w: h, h: w };
  return {
    ...crop,
    ...rect,
    rotate: (crop.rotate + (direction > 0 ? 1 : 3)) % 4,
    aspect: crop.aspect ? 1 / crop.aspect : null,
  };
}

export function mirrorCrop(crop) {
  return {
    ...crop,
    x: 1 - crop.x - crop.w,
    rotate: (4 - crop.rotate) % 4,
    flip: !crop.flip,
    angle: crop.angle ? -crop.angle : 0,
  };
}

// Largest centred rectangle with the given pixel aspect ratio.
export function fitAspect(crop, ratio, frameWidth, frameHeight) {
  if (!ratio) return { ...crop, aspect: null };
  let w = 1;
  let h = 1;
  if (frameWidth / frameHeight > ratio) w = (ratio * frameHeight) / frameWidth;
  else h = frameWidth / (ratio * frameHeight);
  return { ...crop, x: (1 - w) / 2, y: (1 - h) / 2, w, h, aspect: ratio };
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function moveCrop(rect, dx, dy) {
  return {
    ...rect,
    x: clamp(rect.x + dx, 0, 1 - rect.w),
    y: clamp(rect.y + dy, 0, 1 - rect.h),
  };
}

// `handle` combines the letters n, s, e and w ("nw", "e"…). With a ratio the
// opposite corner stays anchored and the pointer is projected on the diagonal.
export function resizeCrop(rect, handle, px, py, options = {}) {
  const { ratio = null, frameWidth = 1, frameHeight = 1, min = 0.04 } = options;
  let x0 = rect.x;
  let y0 = rect.y;
  let x1 = rect.x + rect.w;
  let y1 = rect.y + rect.h;

  if (!ratio) {
    if (handle.includes('w')) x0 = clamp(px, 0, x1 - min);
    if (handle.includes('e')) x1 = clamp(px, x0 + min, 1);
    if (handle.includes('n')) y0 = clamp(py, 0, y1 - min);
    if (handle.includes('s')) y1 = clamp(py, y0 + min, 1);
    return { ...rect, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  const r = (ratio * frameHeight) / frameWidth;
  const west = handle.includes('w');
  const north = handle.includes('n');
  const anchorX = west ? x1 : x0;
  const anchorY = north ? y1 : y0;
  const w = Math.abs(px - anchorX);
  const h = Math.abs(py - anchorY);
  let t = (w * r + h) / (r * r + 1);
  const maxW = west ? anchorX : 1 - anchorX;
  const maxH = north ? anchorY : 1 - anchorY;
  t = clamp(t, min, Math.min(maxH, maxW / r));
  const nw = t * r;
  const nh = t;
  return {
    ...rect,
    x: west ? anchorX - nw : anchorX,
    y: north ? anchorY - nh : anchorY,
    w: nw,
    h: nh,
  };
}
