// Geometry of the output frame: perspective, quarter turns, mirror, straighten
// angle and crop.
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

// Row-major 3×3 → column-major Float32Array.
export function toGlMat3(m) {
  return new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
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

// ---- perspective -----------------------------------------------------------
//
// A quad (top-left, top-right, bottom-right, bottom-left, in source
// coordinates) is flattened to a rectangle with a homography. On top of it a
// cylinder correction undoes the curvature of a limb or a bottle: seen from the
// front, a point at angle θ on the surface appears at sin θ.

export const IDENTITY3 = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const MAX_BEND = (Math.PI / 2) * 0.92;

// Unit square → quad, as a row-major 3×3 matrix (Heckbert).
export function squareToQuad([x0, y0, x1, y1, x2, y2, x3, y3]) {
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  let g = 0;
  let h = 0;
  if (Math.abs(dx3) > 1e-12 || Math.abs(dy3) > 1e-12) {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    h = (dx1 * dy3 - dx3 * dy1) / det;
  }
  return [
    x1 - x0 + g * x1, x3 - x0 + h * x3, x0,
    y1 - y0 + g * y1, y3 - y0 + h * y3, y0,
    g, h, 1,
  ];
}

export function project(m, x, y) {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

export function invert3([a, b, c, d, e, f, g, h, i]) {
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    A / det, (c * h - b * i) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, (c * d - a * f) / det,
    C / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ];
}

export function bendAngle(bend = 0) {
  return (Math.min(100, Math.max(0, bend)) / 100) * MAX_BEND;
}

// Position on the flattened surface (0…1) → position in the photo (0…1).
export function flatToCurved(t, theta) {
  if (!theta) return t;
  return (Math.sin((2 * t - 1) * theta) / Math.sin(theta) + 1) / 2;
}

export function curvedToFlat(s, theta) {
  if (!theta) return s;
  const x = Math.min(1, Math.max(-1, (2 * s - 1) * Math.sin(theta)));
  return (Math.asin(x) / theta + 1) / 2;
}

// Size in source pixels of the flattened surface.
export function rectifiedSize(crop, width, height) {
  let w = width;
  let h = height;
  const { quad } = crop;
  if (quad) {
    const dist = (i, j) => Math.hypot((quad[i * 2] - quad[j * 2]) * width, (quad[i * 2 + 1] - quad[j * 2 + 1]) * height);
    w = (dist(0, 1) + dist(3, 2)) / 2;
    h = (dist(0, 3) + dist(1, 2)) / 2;
  }
  const theta = bendAngle(crop.bend);
  if (theta) {
    const stretch = theta / Math.sin(theta);
    if (crop.bendAxis === 'y') h *= stretch;
    else w *= stretch;
  }
  return [Math.max(1, w), Math.max(1, h)];
}

const RAW = Object.freeze({ x: 0, y: 0, w: 1, h: 1, angle: 0, rotate: 0, flip: false, quad: null, bend: 0 });

// Maps the output image to the source. `frame` ignores the crop rectangle (crop
// tool), `raw` ignores every geometric setting (perspective editing).
export function outputGeometry(crop, width, height, { frame = false, raw = false } = {}) {
  if (raw) crop = RAW;
  const [rectWidth, rectHeight] = rectifiedSize(crop, width, height);
  const [frameWidth, frameHeight] = frameSize(rectWidth, rectHeight, crop.rotate);
  const radians = (crop.angle * Math.PI) / 180;
  const scale = straightenScale(frameWidth, frameHeight, radians);
  const rect = frame ? { x: 0, y: 0, w: 1, h: 1 } : crop;

  const steps = [
    [1 / rectWidth, 0, 0, 1 / rectHeight, 0.5, 0.5],
    multiply(crop.flip ? MIRROR : IDENTITY, QUARTER_TURNS[(4 - crop.rotate) % 4]),
    multiply([1 / scale, 0, 0, 1 / scale, 0, 0], rotation(-radians)),
    [frameWidth, 0, 0, frameHeight, -frameWidth / 2, -frameHeight / 2],
    [rect.w, 0, 0, rect.h, rect.x, rect.y],
  ];
  // Output → flattened surface (affine), then surface → source.
  const matrix = steps.reduce(multiply);
  const inverse = invert(matrix);
  const homography = crop.quad ? squareToQuad(crop.quad) : IDENTITY3;
  const homographyInverse = invert3(homography);
  const theta = bendAngle(crop.bend);
  const vertical = crop.bendAxis === 'y';

  return {
    width: rect.w * frameWidth,
    height: rect.h * frameHeight,
    frameWidth,
    frameHeight,
    scale,
    matrix,
    homography,
    bend: [theta, vertical ? 1 : 0],
    toSource(x, y) {
      let [u, v] = apply(matrix, x, y);
      if (vertical) v = flatToCurved(v, theta);
      else u = flatToCurved(u, theta);
      return project(homography, u, v);
    },
    fromSource(x, y) {
      let [u, v] = project(homographyInverse, x, y);
      if (vertical) v = curvedToFlat(v, theta);
      else u = curvedToFlat(u, theta);
      return apply(inverse, u, v);
    },
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
