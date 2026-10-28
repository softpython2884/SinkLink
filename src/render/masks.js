// Brush masks are kept as vector strokes in normalised source coordinates and
// rasterised on demand, so they hold up at any output resolution. While the
// user paints, only the new part of the stroke is drawn.
import { createTexture, updateImageTexture } from './gl.js';

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function sameBrush(a, b) {
  return a.size === b.size && a.hardness === b.hardness && a.flow === b.flow && a.erase === b.erase;
}

// True when `strokes` only extends what has already been painted: same strokes,
// the last one possibly longer, possibly new strokes after it.
function extendsPainted(drawn, strokes) {
  if (strokes.length < drawn.length) return false;
  return drawn.every(({ stroke, count }, i) => {
    const next = strokes[i];
    if (next === stroke) return true;
    return i === drawn.length - 1 && sameBrush(next, stroke) && next.points.length >= count;
  });
}

function brushSprite(radius, hardness, value, erase) {
  const size = Math.ceil(radius * 2) + 2;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const level = Math.round((erase ? 1 - value : value) * 255);
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, radius);
  const color = (alpha) => `rgba(${level}, ${level}, ${level}, ${alpha})`;
  gradient.addColorStop(0, color(1));
  gradient.addColorStop(Math.min(0.98, hardness), color(1));
  gradient.addColorStop(Math.min(0.99, hardness + (1 - hardness) * 0.5), color(0.5));
  gradient.addColorStop(1, color(0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function paintStroke(ctx, stroke, fromPoint, width, height) {
  const { points } = stroke;
  const count = points.length / 2;
  if (fromPoint >= count) return;
  const radius = Math.max(0.75, stroke.size * Math.max(width, height));
  const sprite = brushSprite(radius, stroke.hardness, stroke.flow, stroke.erase);
  const half = sprite.width / 2;
  const spacing = Math.max(0.75, radius * 0.15);
  const dab = (x, y) => ctx.drawImage(sprite, x - half, y - half);

  ctx.globalCompositeOperation = stroke.erase ? 'darken' : 'lighten';
  for (let i = fromPoint; i < count; i++) {
    const x = points[i * 2] * width;
    const y = points[i * 2 + 1] * height;
    if (i === 0) {
      dab(x, y);
      continue;
    }
    const px = points[i * 2 - 2] * width;
    const py = points[i * 2 - 1] * height;
    const steps = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / spacing));
    for (let s = 1; s <= steps; s++) {
      dab(px + ((x - px) * s) / steps, py + ((y - py) * s) / steps);
    }
  }
}

export class MaskCache {
  constructor(gl, maxSize) {
    this.gl = gl;
    this.maxSize = maxSize;
    this.entries = new Map();
  }

  texture(zone, sourceWidth, sourceHeight) {
    const scale = Math.min(1, this.maxSize / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    let entry = this.entries.get(zone.id);
    if (!entry || entry.width !== width || entry.height !== height) {
      if (entry) this.gl.deleteTexture(entry.texture);
      const canvas = createCanvas(width, height);
      entry = {
        width,
        height,
        canvas,
        ctx: canvas.getContext('2d', { willReadFrequently: false }),
        texture: createTexture(this.gl, { width, height }),
        strokes: null,
        drawn: [],
      };
      this.entries.set(zone.id, entry);
    }

    if (entry.strokes !== zone.strokes) {
      this.#paint(entry, zone.strokes);
      updateImageTexture(this.gl, entry.texture, entry.canvas);
      entry.strokes = zone.strokes;
    }
    return entry.texture;
  }

  #paint(entry, strokes) {
    const { ctx, width, height } = entry;
    if (!extendsPainted(entry.drawn, strokes)) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      entry.drawn = [];
    }
    strokes.forEach((stroke, i) => {
      const done = entry.drawn[i]?.count ?? 0;
      paintStroke(ctx, stroke, done / 2, width, height);
      entry.drawn[i] = { stroke, count: stroke.points.length };
    });
  }

  prune(ids) {
    for (const [id, entry] of this.entries) {
      if (ids.has(id)) continue;
      this.gl.deleteTexture(entry.texture);
      this.entries.delete(id);
    }
  }

  clear() {
    this.prune(new Set());
  }
}
