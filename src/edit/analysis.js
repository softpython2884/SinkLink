// Image statistics computed on a small copy of the photo (any RGBA buffer).

const srgbToLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

export function imageStats({ data, width, height }, { maxSamples = 250_000 } = {}) {
  const pixels = width * height;
  const step = Math.max(1, Math.floor(pixels / maxSamples));
  const histogram = new Uint32Array(256);
  const neutral = [0, 0, 0];
  let neutralCount = 0;
  let chromaSum = 0;
  let count = 0;

  for (let p = 0; p < pixels; p += step) {
    const i = p * 4;
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    histogram[Math.min(255, Math.round(luma * 255))]++;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    chromaSum += max - min;
    count++;
    // Pixels that are probably grey in reality drive the white balance.
    if (luma > 0.12 && max < 0.97 && (max - min) / max < 0.35) {
      neutral[0] += srgbToLinear(r);
      neutral[1] += srgbToLinear(g);
      neutral[2] += srgbToLinear(b);
      neutralCount++;
    }
  }

  return {
    histogram,
    count,
    meanChroma: count ? chromaSum / count : 0,
    neutral: neutralCount / count > 0.02 ? neutral.map((v) => v / neutralCount) : null,
  };
}

export function percentile(histogram, count, fraction) {
  const goal = count * fraction;
  let acc = 0;
  for (let i = 0; i < histogram.length; i++) {
    acc += histogram[i];
    if (acc >= goal) return i / 255;
  }
  return 1;
}

export function fractionBetween(histogram, count, from, to) {
  let acc = 0;
  for (let i = Math.round(from * 255); i <= Math.round(to * 255); i++) acc += histogram[i];
  return count ? acc / count : 0;
}
