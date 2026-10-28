import { AdjustTool } from './adjust.js';
import { ColorTool } from './color.js';
import { CropTool } from './crop.js';
import { CurvesTool } from './curves.js';
import { EffectsTool } from './effects.js';
import { HealTool } from './heal.js';
import { LocalTool } from './local.js';
import { LooksTool } from './looks.js';
import { BW_FILTERS } from '../state/defaults.js';
import { setIn } from '../state/path.js';

const TUNE = {
  id: 'tune',
  label: 'Réglages',
  icon: 'tune',
  actions: [{ label: 'Correction auto', icon: 'auto', run: (app) => app.autoTune() }],
  sections: [
    {
      title: 'Lumière',
      controls: [
        { path: 'tune.exposure', label: 'Exposition' },
        { path: 'tune.brightness', label: 'Luminosité' },
        { path: 'tune.contrast', label: 'Contraste' },
        { path: 'tune.highlights', label: 'Hautes lumières' },
        { path: 'tune.shadows', label: 'Ombres' },
        { path: 'tune.whites', label: 'Blancs' },
        { path: 'tune.blacks', label: 'Noirs' },
      ],
    },
    {
      title: 'Couleur',
      controls: [
        { path: 'tune.ambiance', label: 'Ambiance' },
        { path: 'tune.saturation', label: 'Saturation' },
        { path: 'tune.vibrance', label: 'Vibrance' },
        { path: 'tune.temperature', label: 'Température', track: 'temperature' },
        { path: 'tune.tint', label: 'Teinte', track: 'tint' },
      ],
    },
  ],
};

const DETAILS = {
  id: 'details',
  label: 'Détails',
  icon: 'details',
  sections: [
    {
      controls: [
        { path: 'details.structure', label: 'Structure' },
        { path: 'details.sharpen', label: 'Netteté', min: 0, max: 100 },
      ],
    },
  ],
};

const HDR = {
  id: 'hdr',
  label: 'HDR',
  icon: 'hdr',
  sections: [
    {
      controls: [
        {
          type: 'presets',
          section: 'hdr',
          label: 'Style',
          options: [
            { label: 'Naturel', values: { strength: 45, detail: 40, spread: 65, saturation: 10 } },
            { label: 'Portrait', values: { strength: 30, detail: 25, spread: 80, saturation: 0 } },
            { label: 'Fin', values: { strength: 50, detail: 85, spread: 15, saturation: 10 } },
            { label: 'Fort', values: { strength: 85, detail: 75, spread: 35, saturation: 30 } },
          ],
        },
        { path: 'hdr.strength', label: 'Intensité', min: 0, max: 100 },
        { path: 'hdr.detail', label: 'Détails', min: 0, max: 100 },
        { path: 'hdr.spread', label: 'Étendue', min: 0, max: 100 },
        { path: 'hdr.saturation', label: 'Saturation' },
      ],
    },
  ],
};

const BW = {
  id: 'bw',
  label: 'N&B',
  icon: 'bw',
  sections: [
    {
      controls: [
        {
          type: 'choice',
          path: 'bw.filter',
          label: 'Filtre couleur',
          options: BW_FILTERS.map(({ id, label }) => ({ value: id, label })),
          // Picking a filter also switches to black and white.
          apply: (edit, value) => {
            const next = setIn(edit, 'bw.filter', value);
            return edit.bw.amount ? next : setIn(next, 'bw.amount', 100);
          },
        },
        { path: 'bw.amount', label: 'Noir et blanc', min: 0, max: 100 },
      ],
    },
  ],
};

export function createTools(app) {
  return [
    new LooksTool(app),
    new AdjustTool(app, TUNE),
    new AdjustTool(app, DETAILS),
    new CurvesTool(app),
    new ColorTool(app),
    new AdjustTool(app, HDR),
    new EffectsTool(app),
    new AdjustTool(app, BW),
    new CropTool(app),
    new LocalTool(app),
    new HealTool(app),
  ];
}
