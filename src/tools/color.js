import { AdjustTool } from './adjust.js';
import { h } from '../ui/dom.js';
import { HSL_COLORS } from '../state/defaults.js';

const degrees = (v) => `${Math.round(v)}°`;

// Per-hue adjustments (like Lightroom's HSL panel) and split toning.
export class ColorTool extends AdjustTool {
  constructor(app) {
    let tool;
    const hslPath = (key) => () => `hsl.${tool.color}.${key}`;
    super(app, {
      id: 'color',
      label: 'Couleur',
      icon: 'color',
      sections: [
        {
          controls: [
            { path: hslPath('hue'), label: 'Teinte' },
            { path: hslPath('saturation'), label: 'Saturation' },
            { path: hslPath('luminance'), label: 'Luminance' },
          ],
        },
        {
          title: 'Virage partiel',
          controls: [
            { path: 'split.shadowHue', label: 'Ombres · teinte', min: 0, max: 360, track: 'hue', format: degrees },
            { path: 'split.shadowAmount', label: 'Ombres · intensité', min: 0, max: 100 },
            { path: 'split.highlightHue', label: 'Hautes lumières · teinte', min: 0, max: 360, track: 'hue', format: degrees },
            { path: 'split.highlightAmount', label: 'Hautes lumières · intensité', min: 0, max: 100 },
            { path: 'split.balance', label: 'Équilibre' },
          ],
        },
      ],
    });
    tool = this;
    this.color = 'red';
  }

  header() {
    this.swatches = HSL_COLORS.map(({ id, label, hue }) =>
      h('button', {
        class: 'swatch',
        type: 'button',
        title: label,
        'aria-label': label,
        style: { '--swatch': `hsl(${hue} 80% 55%)` },
        onClick: () => {
          this.color = id;
          this.sync(this.app.edit);
        },
      }),
    );
    this.colorLabel = h('span', { class: 'section__meta' });
    return h('section', { class: 'section' },
      h('h3', { class: 'section__title' }, 'Couleur ciblée', this.colorLabel),
      h('div', { class: 'swatches' }, this.swatches),
    );
  }

  sync(edit) {
    super.sync(edit);
    if (!this.swatches) return;
    HSL_COLORS.forEach(({ id, label }, i) => {
      const { hue, saturation, luminance } = edit.hsl[id];
      this.swatches[i].classList.toggle('is-active', id === this.color);
      this.swatches[i].classList.toggle('is-changed', !!(hue || saturation || luminance));
      if (id === this.color) this.colorLabel.textContent = label;
    });
  }
}
