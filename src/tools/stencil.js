import { AdjustTool } from './adjust.js';
import { PerspectiveEditor } from './perspective.js';
import { h } from '../ui/dom.js';

// Turns the photo of a tattoo into flat black and white line art, ready to be
// traced or printed: perspective and arm curvature first, then the stencil.
export class StencilTool extends AdjustTool {
  constructor(app) {
    super(app, {
      id: 'stencil',
      label: 'Pochoir',
      icon: 'stencil',
      sections: [
        {
          title: '2 · Pochoir',
          controls: [
            {
              type: 'choice',
              path: 'stencil.enabled',
              options: [
                { value: false, label: 'Photo' },
                { value: true, label: 'Noir et blanc' },
              ],
            },
            { path: 'stencil.threshold', label: 'Seuil', min: 0, max: 100 },
            { path: 'stencil.smoothing', label: 'Lissage', min: 0, max: 100 },
            { path: 'stencil.thickness', label: 'Épaisseur du trait' },
            {
              type: 'choice',
              path: 'stencil.transparent',
              label: 'Fond',
              options: [
                { value: false, label: 'Blanc' },
                { value: true, label: 'Transparent' },
              ],
            },
          ],
        },
      ],
    });
    this.perspective = new PerspectiveEditor(app, { startLabel: 'Délimiter le tatouage' });
  }

  header() {
    return h('section', { class: 'section' },
      h('p', { class: 'hint hint--lead' },
        'Transforme la photo d’un tatouage en dessin à plat, noir sur blanc, prêt à décalquer.'),
      h('h3', { class: 'section__title' }, '1 · Aplatir'),
      this.perspective.panel(),
    );
  }

  mount(el) {
    super.mount(el);
    el.append(h('p', { class: 'hint' },
      'Le seuil règle la quantité d’encre gardée, le lissage efface le grain de la peau. ',
      'Recadrez ensuite au plus près du dessin, et exportez en PNG pour garder la transparence.'));
  }

  unmount() {
    this.perspective.stop();
  }

  sync(edit) {
    super.sync(edit);
    this.perspective.sync();
  }

  renderOptions() {
    return this.perspective.active ? { raw: true } : {};
  }

  overlay(view) {
    return this.perspective.overlay(view);
  }

  pointerDown(p, e) {
    if (this.perspective.active) return this.perspective.pointerDown(p, e);
    return super.pointerDown(p, e);
  }

  pointerMove(p, e) {
    if (this.perspective.active) return this.perspective.pointerMove(p);
    return super.pointerMove(p, e);
  }

  pointerUp(p, e) {
    if (this.perspective.active) return this.perspective.pointerUp();
    return super.pointerUp(p, e);
  }

  hover(p) {
    this.perspective.hover(p);
  }
}
