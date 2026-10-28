// Looks: ready-made global settings. Applying one resets the global sections to
// their defaults and blends the look in with the requested strength; geometry,
// local retouching and the stencil are left alone.
import { DEFAULT_EDIT, GLOBAL_SECTIONS } from '../state/defaults.js';

export const LOOK_GROUPS = [
  { id: 'essentials', label: 'Essentiels' },
  // Tuned on game captures as much as on photos: haze removal, lens defects,
  // depth of field and grain are what a real camera adds.
  { id: 'photo', label: 'Photo réaliste' },
  { id: 'bw', label: 'Noir et blanc' },
];

export const LOOKS = [
  { id: 'original', group: 'essentials', label: 'Original', values: {} },
  {
    id: 'portrait',
    group: 'essentials',
    label: 'Portrait',
    values: {
      tune: { brightness: 8, shadows: 20, highlights: -12, temperature: 8, vibrance: 15, saturation: -5 },
      details: { structure: -18 },
      effects: { glow: 12, vignette: -15 },
    },
  },
  {
    id: 'landscape',
    group: 'essentials',
    label: 'Paysage',
    values: {
      tune: { contrast: 15, highlights: -30, shadows: 25, vibrance: 35 },
      details: { structure: 30, sharpen: 25 },
      hdr: { strength: 20, detail: 40, spread: 70 },
    },
  },
  {
    id: 'bright',
    group: 'essentials',
    label: 'Lumineux',
    values: {
      tune: { brightness: 25, contrast: -10, highlights: -25, shadows: 30, temperature: 6, vibrance: 15 },
    },
  },
  {
    id: 'hdr-natural',
    group: 'essentials',
    label: 'HDR naturel',
    values: {
      tune: { highlights: -20, shadows: 15 },
      hdr: { strength: 45, detail: 40, spread: 65, saturation: 10 },
    },
  },
  {
    id: 'hdr-strong',
    group: 'essentials',
    label: 'HDR intense',
    values: {
      details: { structure: 25 },
      hdr: { strength: 85, detail: 80, spread: 35, saturation: 30 },
    },
  },
  {
    id: 'drama',
    group: 'essentials',
    label: 'Drame',
    values: {
      tune: { contrast: 20, saturation: -35 },
      hdr: { strength: 60, detail: 90, spread: 20 },
      effects: { vignette: -35 },
    },
  },
  {
    id: 'matte',
    group: 'essentials',
    label: 'Mat',
    values: {
      tune: { contrast: -15, blacks: 35, saturation: -15 },
      split: { shadowHue: 220, shadowAmount: 18, highlightHue: 40, highlightAmount: 12 },
    },
  },
  {
    id: 'film',
    group: 'essentials',
    label: 'Film',
    values: {
      tune: { contrast: 12, highlights: -20, blacks: 15, saturation: -10, temperature: 5 },
      split: { shadowHue: 190, shadowAmount: 12, highlightHue: 45, highlightAmount: 10 },
      effects: { grain: 25, grainSize: 35 },
    },
  },
  {
    id: 'vintage',
    group: 'essentials',
    label: 'Vintage',
    values: {
      tune: { contrast: -10, blacks: 25, saturation: -25, temperature: 25 },
      split: { shadowHue: 200, shadowAmount: 20, highlightHue: 45, highlightAmount: 25 },
      effects: { vignette: -35, grain: 30 },
    },
  },
  {
    id: 'teal-orange',
    group: 'essentials',
    label: 'Teal & orange',
    values: {
      tune: { contrast: 15, vibrance: 15, highlights: -15 },
      split: { shadowHue: 195, shadowAmount: 45, highlightHue: 30, highlightAmount: 40, balance: 10 },
    },
  },
  {
    id: 'cold',
    group: 'essentials',
    label: 'Froid',
    values: {
      tune: { contrast: 10, highlights: -10, temperature: -25, tint: 5, saturation: -10 },
    },
  },
  {
    id: 'realistic',
    group: 'photo',
    label: 'Réaliste',
    values: {
      tune: { contrast: 12, highlights: -20, shadows: 10, vibrance: 15, saturation: -5, temperature: 3 },
      details: { structure: 12, sharpen: 25, dehaze: 35 },
      effects: { glow: 6, vignette: -20, grain: 12, grainSize: 25 },
      lens: { aberration: 25 },
    },
  },
  {
    id: 'golden-hour',
    group: 'photo',
    label: 'Heure dorée',
    values: {
      tune: { contrast: 12, highlights: -20, shadows: 12, vibrance: 12, temperature: 30, tint: 6 },
      details: { dehaze: 20 },
      split: { shadowHue: 220, shadowAmount: 10, highlightHue: 35, highlightAmount: 30 },
      effects: { glow: 22, vignette: -22 },
      lens: { aberration: 15 },
    },
  },
  {
    id: 'telephoto',
    group: 'photo',
    label: 'Téléobjectif',
    values: {
      tune: { contrast: 15, highlights: -20, vibrance: 18 },
      details: { structure: 15, sharpen: 30, dehaze: 40 },
      effects: { vignette: -15, grain: 8 },
      lens: { blur: 30, size: 40, transition: 50, bokeh: 40, aberration: 15 },
    },
  },
  {
    id: 'cinema',
    group: 'photo',
    label: 'Cinéma',
    values: {
      tune: { contrast: 20, highlights: -25, shadows: 8, saturation: -12, vibrance: 10 },
      details: { dehaze: 25 },
      split: { shadowHue: 195, shadowAmount: 35, highlightHue: 32, highlightAmount: 30 },
      effects: { glow: 10, vignette: -30, grain: 15 },
      lens: { aberration: 20 },
    },
  },
  {
    id: 'reportage',
    group: 'photo',
    label: 'Reportage',
    values: {
      tune: { contrast: 22, highlights: -15, blacks: -10, saturation: -20 },
      details: { structure: 22, sharpen: 20, dehaze: 25 },
      effects: { vignette: -25, grain: 30 },
      lens: { aberration: 20 },
    },
  },
  {
    id: 'analog',
    group: 'photo',
    label: 'Argentique',
    values: {
      tune: { contrast: 8, highlights: -25, blacks: 18, saturation: -12, temperature: 6 },
      details: { dehaze: 10 },
      split: { shadowHue: 185, shadowAmount: 15, highlightHue: 40, highlightAmount: 15 },
      effects: { glow: 10, vignette: -15, grain: 35, grainSize: 45 },
      lens: { aberration: 10 },
    },
  },
  {
    id: 'bw',
    group: 'bw',
    label: 'N&B',
    values: {
      tune: { contrast: 20 },
      bw: { amount: 100, filter: 'neutral' },
    },
  },
  {
    id: 'bw-contrast',
    group: 'bw',
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
    group: 'bw',
    label: 'Noir',
    values: {
      tune: { contrast: 30 },
      bw: { amount: 100, filter: 'yellow' },
      effects: { glow: 25, vignette: -50, grain: 40 },
    },
  },
  {
    id: 'sepia',
    group: 'bw',
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
