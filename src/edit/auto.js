// Automatic correction from image statistics: levels, midtone brightness,
// shadow/highlight balance and white balance. The result is deliberately
// moderate, it is a starting point rather than a final grade.
import { fractionBetween, percentile } from './analysis.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const ui = (v) => Math.round(v * 100);

// Inverse of whiteBalanceGains() in render/uniforms.js for a measured grey.
export function whiteBalanceFor([r, g, b]) {
  const q = b / r;
  const temperature = ((q - 1) / (q + 1)) / 0.3;
  const target = (1 / g) / ((1 / r + 1 / b) / 2);
  const tint = (1 - target) / 0.2;
  return { temperature, tint };
}

export function autoTune(stats) {
  const { histogram, count } = stats;
  const low = percentile(histogram, count, 0.005);
  const high = percentile(histogram, count, 0.995);
  const median = percentile(histogram, count, 0.5);

  // Stretch levels, leaving some room at both ends: low-key and high-key
  // photos should keep their character.
  const blacks = -clamp((low * 0.8) / 0.12, 0, 0.6);
  const whites = clamp(((1 - high) * 0.7) / 0.2, 0, 0.6);
  const black = -blacks * 0.12;
  const white = 1 - whites * 0.2;
  const stretched = clamp((median - black) / (white - black), 0.02, 0.98);

  // Move the median part of the way to mid grey (brightness maps to a
  // midtone gamma of 2^(-b·0.8)). Bright scenes are often bright on purpose,
  // so darkening is limited more than brightening.
  const gamma = Math.log(0.5) / Math.log(stretched);
  const brightness = clamp((-Math.log2(gamma) / 0.8) * 0.5, -0.3, 0.35);

  const deepShadows = fractionBetween(histogram, count, 0, 0.1);
  const clipped = fractionBetween(histogram, count, 0.95, 1);
  const shadows = clamp((deepShadows - 0.08) * 2.5, 0, 0.45);
  const highlights = -clamp((clipped - 0.03) * 4, 0, 0.5);

  const spread = high - low;
  const contrast = spread < 0.7 ? clamp((0.7 - spread) * 0.6, 0, 0.25) : 0;
  const vibrance = stats.meanChroma < 0.18 ? 0.2 : 0.1;

  let temperature = 0;
  let tint = 0;
  if (stats.neutral) {
    const wb = whiteBalanceFor(stats.neutral);
    // Only correct part of the cast, the ambient mood is often wanted.
    temperature = clamp(wb.temperature * 0.6, -0.3, 0.3);
    tint = clamp(wb.tint * 0.6, -0.2, 0.2);
  }

  return {
    brightness: ui(brightness),
    contrast: ui(contrast),
    highlights: ui(highlights),
    shadows: ui(shadows),
    whites: ui(whites),
    blacks: ui(blacks),
    vibrance: ui(vibrance),
    temperature: ui(temperature),
    tint: ui(tint),
  };
}
