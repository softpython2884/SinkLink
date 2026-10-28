import { AdjustTool } from './adjust.js';
import { clamp, h } from '../ui/dom.js';

const degrees = (v) => `${Math.round(v)}°`;

// Depth of field and lens defects: what makes a game capture or a phone photo
// look like it came out of a real camera.
export class LensTool extends AdjustTool {
  constructor(app) {
    super(app, {
      id: 'lens',
      label: 'Objectif',
      icon: 'lens',
      sections: [
        {
          title: 'Profondeur de champ',
          controls: [
            {
              type: 'choice',
              path: 'lens.shape',
              options: [
                { value: 'radial', label: 'Rond' },
                { value: 'linear', label: 'Bande' },
              ],
            },
            { path: 'lens.blur', label: 'Flou', min: 0, max: 100 },
            { path: 'lens.size', label: 'Zone nette', min: 0, max: 100 },
            { path: 'lens.transition', label: 'Transition', min: 0, max: 100 },
            { path: 'lens.angle', label: 'Angle de la bande', min: -90, max: 90, format: degrees },
            { path: 'lens.bokeh', label: 'Bokeh', min: 0, max: 100 },
          ],
        },
        {
          title: 'Optique',
          controls: [{ path: 'lens.aberration', label: 'Aberration chromatique', min: 0, max: 100 }],
        },
      ],
    });
  }

  mount(el) {
    super.mount(el);
    el.prepend(h('p', { class: 'hint hint--lead' },
      'Floutez l’arrière-plan comme un vrai objectif. Faites glisser le point central sur le sujet.'));
  }

  overlay(view) {
    const { blur, shape, x, y, size, transition, angle } = this.app.edit.lens;
    if (!blur) return '';
    const { w, h } = view;
    const cx = x * w;
    const cy = y * h;
    // Same units as the shader: distances are relative to the output height.
    const inner = (0.02 + (size / 100) * 0.6) * h;
    const outer = inner + (0.03 + (transition / 100) * 0.8) * h;
    const handle = `<g class="handle${this.moving ? ' is-active' : ''}"><circle cx="${cx}" cy="${cy}" r="9"/>` +
      `<circle cx="${cx}" cy="${cy}" r="2.5" class="handle__dot"/></g>`;
    if (shape === 'radial') {
      return `<circle class="zone__ring" cx="${cx}" cy="${cy}" r="${inner}"/>
        <circle class="zone__guide zone__guide--end" fill="none" cx="${cx}" cy="${cy}" r="${outer}"/>${handle}`;
    }
    const a = (angle * Math.PI) / 180;
    const reach = Math.max(w, h) * 2;
    const [dx, dy] = [Math.cos(a) * reach, Math.sin(a) * reach];
    const [nx, ny] = [-Math.sin(a), Math.cos(a)];
    const line = (d, cls) => `<path class="${cls}" d="M${cx + nx * d - dx},${cy + ny * d - dy}L${cx + nx * d + dx},${cy + ny * d + dy}"/>`;
    return [
      line(inner, 'zone__guide'), line(-inner, 'zone__guide'),
      line(outer, 'zone__guide zone__guide--end'), line(-outer, 'zone__guide zone__guide--end'),
      handle,
    ].join('');
  }

  pointerDown(p, e) {
    const { blur, x, y } = this.app.edit.lens;
    const { displayWidth, displayHeight } = this.app.view;
    if (blur && e.button === 0 && Math.hypot((p.x - x) * displayWidth, (p.y - y) * displayHeight) < 20) {
      this.moving = true;
      return true;
    }
    return super.pointerDown(p, e);
  }

  pointerMove(p, e) {
    if (!this.moving) return super.pointerMove(p, e);
    const edit = this.app.edit;
    this.app.replace({ ...edit, lens: { ...edit.lens, x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) } });
  }

  pointerUp(p, e) {
    if (!this.moving) return super.pointerUp(p, e);
    this.moving = false;
    this.app.commit();
    this.app.refreshOverlay();
  }
}
