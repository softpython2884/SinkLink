// Looks: ready-made global settings. Applying one resets the global sections to
// their defaults and blends the look in with the requested strength; geometry
// and local retouching are left alone.
import { DEFAULT_EDIT, GLOBAL_SECTIONS } from '../state/defaults.js';

export const LOOKS = [
  { id: 'original', label: 'Original', values: {} },
  {
    id: 'portrait',
    label: 'Portrait',
    values: {
      tune: { brightness: 8, shadows: 20, highlights: -12, temperature: 8, vibrance: 15, saturation: -5 },
      details: { structure: -18 },
      effects: { glow: 12, vignette: -15 },
    },
  },
  {
    id: 'landscape',
    label: 'Paysage',
    values: {
      tune: { contrast: 15, highlights: -30, shadows: 25, vibrance: 35 },
      details: { structure: 30, sharpen: 25 },
      hdr: { strength: 20, detail: 40, spread: 70 },
    },
  },
  {
    id: 'bright',
    label: 'Lumineux',
    values: {
      tune: { brightness: 25, contrast: -10, highlights: -25, shadows: 30, temperature: 6, vibrance: 15 },
    },
  },
  {
    id: 'hdr-natural',
    label: 'HDR naturel',
    values: {
      tune: { highlights: -20, shadows: 15 },
      hdr: { strength: 45, detail: 40, spread: 65, saturation: 10 },
    },
  },
  {
    id: 'hdr-strong',
    label: 'HDR intense',
    values: {
      details: { structure: 25 },
      hdr: { strength: 85, detail: 80, spread: 35, saturation: 30 },
    },
  },
  {
    id: 'drama',
    label: 'Drame',
    values: {
      tune: { contrast: 20, saturation: -35 },
      hdr: { strength: 60, detail: 90, spread: 20 },
      effects: { vignette: -35 },
    },
  },
  {
    id: 'matte',
    label: 'Mat',
    values: {
      tune: { contrast: -15, blacks: 35, saturation: -15 },
      split: { shadowHue: 220, shadowAmount: 18, highlightHue: 40, highlightAmount: 12 },
    },
  },
  {
    id: 'film',
    label: 'Film',
    values: {
      tune: { contrast: 12, highlights: -20, blacks: 15, saturation: -10, temperature: 5 },
      split: { shadowHue: 190, shadowAmount: 12, highlightHue: 45, highlightAmount: 10 },
      effects: { grain: 25, grainSize: 35 },
    },
  },
  {
    id: 'vintage',
    label: 'Vintage',
    values: {
      tune: { contrast: -10, blacks: 25, saturation: -25, temperature: 25 },
      split: { shadowHue: 200, shadowAmount: 20, highlightHue: 45, highlightAmount: 25 },
      effects: { vignette: -35, grain: 30 },
    },
  },
  {
    id: 'teal-orange',
    label: 'Ciné',
    values: {
      tune: { contrast: 15, vibrance: 15, highlights: -15 },
      split: { shadowHue: 195, shadowAmount: 45, highlightHue: 30, highlightAmount: 40, balance: 10 },
    },
  },
  {
    id: 'cold',
    label: 'Froid',
    values: {
      tune: { contrast: 10, highlights: -10, temperature: -25, tint: 5, saturation: -10 },
    },
  },
  {
    id: 'bw',
    label: 'N&B',
    values: {
      tune: { contrast: 20 },
      bw: { amount: 100, filter: 'neutral' },
    },
  },
  {
    id: 'bw-contrast',
    label: 'N&B contrasté',
    values: {
      tune: { contrast: 45, blacks: -20 },
      details: { structure: 25 },
      bw: { amount: 100, filter: 'red' },
      effects: { vignette: -20, grain: 15 },
    },
  },
  {
    id: 'noir',
    label: 'Noir',
    values: {
      tune: { contrast: 30 },
      bw: { amount: 100, filter: 'yellow' },
      effects: { glow: 25, vignette: -50, grain: 40 },
    },
  },
  {
    id: 'sepia',
    label: 'Sépia',
    values: {
      tune: { contrast: 10 },
      bw: { amount: 100, filter: 'orange' },
      split: { shadowHue: 30, shadowAmount: 40, highlightHue: 45, highlightAmount: 30 },
    },
  },
];

// Hues and enumerations are taken as is; numbers are blended from the default.
function blend(defaults, values, amount) {
  const out = { ...defaults };
  for (const [key, value] of Object.entries(values)) {
    const base = defaults[key];
    if (typeof value === 'number' && typeof base === 'number' && !/Hue$/.test(key)) {
      out[key] = Math.round(base + (value - base) * amount);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = blend(base ?? {}, value, amount);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function applyLook(edit, values, amount = 1) {
  const next = { ...edit };
  for (const section of GLOBAL_SECTIONS) {
    next[section] = values[section]
      ? blend(DEFAULT_EDIT[section], values[section], amount)
      : DEFAULT_EDIT[section];
  }
  return next;
}
