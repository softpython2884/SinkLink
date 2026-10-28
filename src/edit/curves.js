// Tone curves: monotone cubic interpolation (Fritsch–Carlson) so that the curve
// never overshoots between control points, which keeps gradients clean.

export const CURVE_CHANNELS = ['rgb', 'red', 'green', 'blue'];

export function isIdentity(points) {
  return (
    points.length === 2 &&
    points[0][0] === 0 && points[0][1] === 0 &&
    points[1][0] === 1 && points[1][1] === 1
  );
}

function prepare(points) {
  const sorted = points
    .map(([x, y]) => [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))])
    .sort((a, b) => a[0] - b[0]);
  const unique = [];
  for (const point of sorted) {
    const last = unique[unique.length - 1];
    if (last && point[0] - last[0] < 1e-6) last[1] = point[1];
    else unique.push(point);
  }
  return unique;
}

function tangents(xs, ys) {
  const n = xs.length;
  const delta = [];
  for (let i = 0; i < n - 1; i++) delta.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));

  const m = new Array(n);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = delta[i - 1] * delta[i] <= 0 ? 0 : (delta[i - 1] + delta[i]) / 2;
  }

  for (let i = 0; i < n - 1; i++) {
    if (delta[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / delta[i];
    const b = m[i + 1] / delta[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * delta[i];
      m[i + 1] = t * b * delta[i];
    }
  }
  return m;
}

// Returns a function x → y valid on [0, 1].
export function curveFunction(points) {
  const pts = prepare(points);
  if (pts.length === 0) return (x) => x;
  if (pts.length === 1) return () => pts[0][1];

  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const m = tangents(xs, ys);
  const last = xs.length - 1;

  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[last]) return ys[last];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const y =
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1];
    return Math.min(1, Math.max(0, y));
  };
}

export function sampleCurve(points, size = 256) {
  const fn = curveFunction(points);
  const out = new Float32Array(size);
  for (let i = 0; i < size; i++) out[i] = fn(i / (size - 1));
  return out;
}

// Packs the four curves into a 256×1 RGBA lookup table. Each colour channel
// goes through the master curve first, then through its own curve.
export function buildCurveLut(curves, size = 256) {
  const master = curveFunction(curves.rgb);
  const channels = [curves.red, curves.green, curves.blue].map(curveFunction);
  const lut = new Uint8Array(size * 4);
  for (let i = 0; i < size; i++) {
    const v = master(i / (size - 1));
    for (let c = 0; c < 3; c++) lut[i * 4 + c] = Math.round(channels[c](v) * 255);
    lut[i * 4 + 3] = 255;
  }
  return lut;
}

export function curvesAreIdentity(curves) {
  return CURVE_CHANNELS.every((key) => isIdentity(curves[key]));
}

export const CURVE_PRESETS = [
  { id: 'linear', label: 'Linéaire', points: [[0, 0], [1, 1]] },
  { id: 'soft', label: 'Contraste doux', points: [[0, 0], [0.25, 0.21], [0.75, 0.8], [1, 1]] },
  { id: 'strong', label: 'Contraste fort', points: [[0, 0], [0.25, 0.16], [0.75, 0.86], [1, 1]] },
  { id: 'matte', label: 'Mat', points: [[0, 0.1], [0.25, 0.24], [0.75, 0.78], [1, 0.95]] },
  { id: 'brighten', label: 'Éclaircir', points: [[0, 0], [0.45, 0.58], [1, 1]] },
  { id: 'darken', label: 'Assombrir', points: [[0, 0], [0.55, 0.42], [1, 1]] },
];
