// Picks the patch used to repair a spot: the candidate whose surroundings look
// the most like the surroundings of the blemish, without reaching outside the
// image. Works on a small RGBA copy of the photo.

const RING_SAMPLES = 24;

function sampler({ data, width, height }) {
  return (x, y) => {
    const px = Math.min(width - 1, Math.max(0, Math.round(x)));
    const py = Math.min(height - 1, Math.max(0, Math.round(y)));
    const i = (py * width + px) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
}

// x, y and the returned position are normalised; r is relative to the long side.
export function findHealSource(image, x, y, r) {
  const { width, height } = image;
  const long = Math.max(width, height);
  const radius = Math.max(1, r * long);
  const cx = x * width;
  const cy = y * height;
  const at = sampler(image);

  const offsets = [];
  for (let ring = 0; ring < 2; ring++) {
    const dist = radius * (ring ? 1.6 : 1.15);
    for (let i = 0; i < RING_SAMPLES; i++) {
      const a = (i / RING_SAMPLES) * Math.PI * 2 + ring * 0.13;
      offsets.push([Math.cos(a) * dist, Math.sin(a) * dist]);
    }
  }
  const inner = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    inner.push([Math.cos(a) * radius * 0.5, Math.sin(a) * radius * 0.5]);
  }
  inner.push([0, 0]);

  const reference = offsets.map(([ox, oy]) => at(cx + ox, cy + oy));
  const mean = reference.reduce((acc, c) => acc.map((v, k) => v + c[k] / reference.length), [0, 0, 0]);

  let best = null;
  for (const factor of [2.2, 3, 4]) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const sx = cx + Math.cos(a) * radius * factor;
      const sy = cy + Math.sin(a) * radius * factor;
      const margin = radius * 1.7;
      if (sx < margin || sy < margin || sx > width - margin || sy > height - margin) continue;

      let score = 0;
      offsets.forEach(([ox, oy], k) => {
        const c = at(sx + ox, sy + oy);
        const ref = reference[k];
        score += (c[0] - ref[0]) ** 2 + (c[1] - ref[1]) ** 2 + (c[2] - ref[2]) ** 2;
      });
      // The patch itself should look like the clean skin/sky around the spot.
      for (const [ox, oy] of inner) {
        const c = at(sx + ox, sy + oy);
        score += 2 * ((c[0] - mean[0]) ** 2 + (c[1] - mean[1]) ** 2 + (c[2] - mean[2]) ** 2);
      }
      score *= 1 + (factor - 2.2) * 0.15;
      if (!best || score < best.score) best = { score, sx, sy };
    }
  }

  if (!best) {
    // Spot too close to the borders: fall back to the side with the most room.
    const sx = cx < width / 2 ? cx + radius * 2.5 : cx - radius * 2.5;
    best = { sx, sy: cy };
  }
  return { sx: best.sx / width, sy: best.sy / height };
}
