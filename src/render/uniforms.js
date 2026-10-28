// Converts edit values (UI units) into shader uniforms. Kept free of any WebGL
// call so the mapping can be unit tested.
import { BW_FILTERS, HSL_COLORS } from '../state/defaults.js';
import { curvesAreIdentity } from '../edit/curves.js';

const unit = (v) => v / 100;
const clamp = (v, min = -1, max = 1) => Math.min(max, Math.max(min, v));

export function whiteBalanceGains(temperature, tint) {
  const r = 1 + 0.3 * temperature;
  const g = 1 - 0.2 * tint;
  const b = 1 - 0.3 * temperature;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [r / luma, g / luma, b / luma];
}

export function hueToRgb(hue) {
  const h = (((hue % 360) + 360) % 360) / 60;
  const x = 1 - Math.abs((h % 2) - 1);
  const table = [[1, x, 0], [x, 1, 0], [0, 1, x], [0, x, 1], [x, 0, 1], [1, 0, x]];
  return table[Math.floor(h) % 6];
}

// Colour offset with zero luminance, so toning shifts hue without brightening.
export function toneOffset(hue) {
  const [r, g, b] = hueToRgb(hue);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [r - luma, g - luma, b - luma];
}

export function developUniforms(edit) {
  const { tune, details, hdr, effects, split, bw } = edit;
  const ambiance = unit(tune.ambiance);
  const hdrStrength = unit(hdr.strength);

  const blacks = unit(tune.blacks);
  const whites = unit(tune.whites);
  const levelsIn = [Math.max(0, -blacks) * 0.12, 1 - Math.max(0, whites) * 0.2];
  const levelsOut = [Math.max(0, blacks) * 0.2, 1 + Math.min(0, whites) * 0.15];

  const hsl = new Float32Array(HSL_COLORS.length * 3);
  let hslOn = false;
  HSL_COLORS.forEach(({ id }, i) => {
    const { hue, saturation, luminance } = edit.hsl[id];
    hsl.set([unit(hue), unit(saturation), unit(luminance)], i * 3);
    hslOn ||= hue !== 0 || saturation !== 0 || luminance !== 0;
  });

  const filter = BW_FILTERS.find((f) => f.id === bw.filter) ?? BW_FILTERS[0];

  return {
    uWb: whiteBalanceGains(unit(tune.temperature), unit(tune.tint)),
    uExposure: 2 ** (unit(tune.exposure) * 2),
    uGamma: 2 ** (-unit(tune.brightness) * 0.8),
    uContrast: unit(tune.contrast),
    uHighlights: clamp(unit(tune.highlights) - 0.35 * ambiance),
    uShadows: clamp(unit(tune.shadows) + 0.45 * ambiance),
    uLevelsIn: levelsIn,
    uLevelsOut: levelsOut,
    uSaturation: clamp(unit(tune.saturation) + 0.25 * unit(hdr.saturation) * hdrStrength, -1, 1.5),
    uVibrance: clamp(unit(tune.vibrance) + 0.3 * ambiance),
    uStructure: clamp(unit(details.structure) + 0.1 * Math.max(0, ambiance)),
    uHdr: [hdrStrength, unit(hdr.detail), unit(hdr.spread), 0],
    uGlow: unit(effects.glow),
    uHslOn: hslOn,
    uHsl: hsl,
    uSplitShadow: [...toneOffset(split.shadowHue), unit(split.shadowAmount) * 0.35],
    uSplitHighlight: [...toneOffset(split.highlightHue), unit(split.highlightAmount) * 0.35],
    uSplitBalance: unit(split.balance),
    uBw: unit(bw.amount),
    uBwMix: filter.weights,
    uCurveOn: !curvesAreIdentity(edit.curves),
  };
}

export const ZONE_TYPES = { brush: 0, point: 1, gradient: 2 };

export function zoneIsNeutral(zone) {
  return !zone.exposure && !zone.contrast && !zone.saturation && !zone.warmth && !zone.structure;
}

export function localUniforms(zone, aspect, showMask = false) {
  const warmth = unit(zone.warmth);
  const gains = whiteBalanceGains(warmth, 0);
  return {
    uType: ZONE_TYPES[zone.type],
    uAspect: aspect,
    uP0: zone.type === 'gradient' ? [zone.x0, zone.y0] : [zone.x ?? 0, zone.y ?? 0],
    uP1: zone.type === 'gradient' ? [zone.x1, zone.y1] : [0, 0],
    uRadius: Math.max(zone.radius ?? 0.1, 1e-3),
    uSelectivity: unit(zone.selectivity ?? 0),
    uInvert: !!zone.invert,
    uExposure: 2 ** (unit(zone.exposure) * 1.5),
    uContrast: unit(zone.contrast),
    uSaturation: unit(zone.saturation),
    uWarmth: gains,
    uStructure: unit(zone.structure),
    uShowMask: showMask,
  };
}

export const MAX_HEAL_SPOTS = 16;

export function healUniforms(spots, aspect, longSide) {
  const targets = new Float32Array(MAX_HEAL_SPOTS * 3);
  const sources = new Float32Array(MAX_HEAL_SPOTS * 2);
  spots.slice(0, MAX_HEAL_SPOTS).forEach((spot, i) => {
    targets.set([spot.x, spot.y, spot.r], i * 3);
    sources.set([spot.sx, spot.sy], i * 2);
  });
  return {
    uCount: Math.min(spots.length, MAX_HEAL_SPOTS),
    uSpots: targets,
    uSources: sources,
    uAspect: aspect,
    uLong: longSide,
  };
}

export function outputUniforms(edit, options) {
  const { effects, details } = edit;
  const { flipY, original, width, height, texel, toSource } = options;
  const vignette = unit(effects.vignette);
  return {
    uMatrix: toSource,
    uFlipY: flipY,
    uOriginal: original,
    uTexel: texel,
    uSharpen: unit(details.sharpen) * 2.2,
    uVignette: [
      vignette < 0 ? vignette * 0.85 : vignette * 0.7,
      0.45 + unit(effects.vignetteSize) * 0.9,
      0.15 + unit(effects.vignetteFeather) * 0.85,
      0,
    ],
    uVignetteCenter: [effects.vignetteX, effects.vignetteY],
    uGrain: [unit(effects.grain), 1600 - unit(effects.grainSize) * 1250],
    uOutSize: [width, height],
  };
}
