import { deepFreeze } from './path.js';

// Slider values are stored in UI units (mostly -100…100) so that a saved edit
// stays readable; conversion to shader units happens in render/uniforms.js.

export const HSL_COLORS = [
  { id: 'red', label: 'Rouges', hue: 0 },
  { id: 'orange', label: 'Oranges', hue: 30 },
  { id: 'yellow', label: 'Jaunes', hue: 60 },
  { id: 'green', label: 'Verts', hue: 120 },
  { id: 'aqua', label: 'Turquoises', hue: 180 },
  { id: 'blue', label: 'Bleus', hue: 220 },
  { id: 'purple', label: 'Violets', hue: 270 },
  { id: 'magenta', label: 'Magentas', hue: 310 },
];

export const BW_FILTERS = [
  { id: 'neutral', label: 'Neutre', weights: [0.3, 0.59, 0.11] },
  { id: 'red', label: 'Rouge', weights: [0.8, 0.25, -0.05] },
  { id: 'orange', label: 'Orange', weights: [0.6, 0.4, 0] },
  { id: 'yellow', label: 'Jaune', weights: [0.45, 0.55, 0] },
  { id: 'green', label: 'Vert', weights: [0.15, 0.8, 0.05] },
  { id: 'blue', label: 'Bleu', weights: [0.1, 0.25, 0.65] },
];

export const IDENTITY_CURVE = [[0, 0], [1, 1]];

// Sections that describe the global look of the photo, as opposed to geometry
// and local retouching. Looks replace these and nothing else.
export const GLOBAL_SECTIONS = ['tune', 'details', 'hdr', 'effects', 'hsl', 'split', 'bw', 'curves'];

export const DEFAULT_EDIT = deepFreeze({
  tune: {
    exposure: 0,
    brightness: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    ambiance: 0,
    saturation: 0,
    vibrance: 0,
    temperature: 0,
    tint: 0,
  },
  details: {
    structure: 0,
    sharpen: 0,
  },
  hdr: {
    strength: 0,
    detail: 50,
    spread: 50,
    saturation: 0,
  },
  effects: {
    glow: 0,
    vignette: 0,
    vignetteSize: 50,
    vignetteFeather: 50,
    vignetteX: 0.5,
    vignetteY: 0.5,
    grain: 0,
    grainSize: 30,
  },
  hsl: Object.fromEntries(
    HSL_COLORS.map(({ id }) => [id, { hue: 0, saturation: 0, luminance: 0 }]),
  ),
  split: {
    shadowHue: 210,
    shadowAmount: 0,
    highlightHue: 40,
    highlightAmount: 0,
    balance: 0,
  },
  bw: {
    amount: 0,
    filter: 'neutral',
  },
  curves: {
    rgb: IDENTITY_CURVE,
    red: IDENTITY_CURVE,
    green: IDENTITY_CURVE,
    blue: IDENTITY_CURVE,
  },
  crop: {
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    angle: 0,
    rotate: 0,
    flip: false,
    aspect: null,
  },
  zones: [],
  heal: [],
});

export const ZONE_DEFAULTS = deepFreeze({
  exposure: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  structure: 0,
  invert: false,
});

let counter = 0;
export const uid = (prefix) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;
