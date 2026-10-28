import { AdjustTool } from './adjust.js';
import { clamp } from '../ui/dom.js';

// Glow, vignette and grain. The vignette centre can be dragged on the photo.
export class EffectsTool extends AdjustTool {
  constructor(app) {
    super(app, {
      id: 'effects',
      label: 'Effets',
      icon: 'effects',
      sections: [
        {
          title: 'Lueur',
          controls: [{ path: 'effects.glow', label: 'Lueur', min: 0, max: 100 }],
        },
        {
          title: 'Vignette',
          controls: [
            { path: 'effects.vignette', label: 'Vignette' },
            { path: 'effects.vignetteSize', label: 'Taille', min: 0, max: 100 },
            { path: 'effects.vignetteFeather', label: 'Adoucissement', min: 0, max: 100 },
          ],
        },
        {
          title: 'Grain',
          controls: [
            { path: 'effects.grain', label: 'Grain', min: 0, max: 100 },
            { path: 'effects.grainSize', label: 'Taille du grain', min: 0, max: 100 },
          ],
        },
      ],
    });
  }

  overlay({ w, h }) {
    const { vignette, vignetteX, vignetteY } = this.app.edit.effects;
    if (!vignette) return '';
    return `<g class="handle${this.moving ? ' is-active' : ''}">
      <circle cx="${vignetteX * w}" cy="${vignetteY * h}" r="9"/>
      <circle cx="${vignetteX * w}" cy="${vignetteY * h}" r="2.5" class="handle__dot"/>
    </g>`;
  }

  pointerDown(p, e) {
    const { vignette, vignetteX, vignetteY } = this.app.edit.effects;
    const { displayWidth, displayHeight } = this.app.view;
    const near = Math.hypot((p.x - vignetteX) * displayWidth, (p.y - vignetteY) * displayHeight) < 18;
    if (vignette && near) {
      this.moving = true;
      return true;
    }
    return super.pointerDown(p, e);
  }

  pointerMove(p, e) {
    if (!this.moving) return super.pointerMove(p, e);
    const { effects } = this.app.edit;
    this.app.replace({
      ...this.app.edit,
      effects: { ...effects, vignetteX: clamp(p.x, 0, 1), vignetteY: clamp(p.y, 0, 1) },
    });
  }

  pointerUp(p, e) {
    if (!this.moving) return super.pointerUp(p, e);
    this.moving = false;
    this.app.commit();
    this.app.refreshOverlay();
  }
}
