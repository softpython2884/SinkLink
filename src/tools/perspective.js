import { createSlider } from '../ui/slider.js';
import { clamp, h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { project, squareToQuad } from '../render/geometry.js';

const DEFAULT_QUAD = [0.2, 0.2, 0.8, 0.2, 0.8, 0.8, 0.2, 0.8];
const AXES = [
  { value: 'x', label: 'Membre vertical' },
  { value: 'y', label: 'Membre horizontal' },
];

function inside(points, x, y) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// Four-corner perspective, shared by the crop and stencil tools. While editing,
// the photo is shown without any geometry so the corners land on the original;
// once done, the quad is flattened to a rectangle. The curvature slider then
// unrolls a cylindrical surface such as an arm.
export class PerspectiveEditor {
  constructor(app, { startLabel = 'Corriger la perspective', onChange } = {}) {
    this.app = app;
    this.startLabel = startLabel;
    this.onChange = onChange;
    this.active = false;
    this.drag = null;
  }

  get crop() {
    return this.app.edit.crop;
  }

  #setCrop(patch) {
    this.app.replace({ ...this.app.edit, crop: { ...this.crop, ...patch } });
  }

  // The crop rectangle is relative to the flattened surface: start it over.
  #setQuad(quad) {
    this.#setCrop({ quad, x: 0, y: 0, w: 1, h: 1, aspect: null });
  }

  start() {
    this.active = true;
    if (!this.crop.quad) {
      this.#setQuad(DEFAULT_QUAD);
      this.app.commit();
    }
    this.#changed();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.app.commit();
    this.#changed();
  }

  clear() {
    this.active = false;
    this.#setCrop({ quad: null, bend: 0, x: 0, y: 0, w: 1, h: 1, aspect: null });
    this.app.commit();
    this.#changed();
  }

  #changed() {
    this.app.view.el.style.cursor = '';
    this.app.invalidate();
    this.app.refreshOverlay();
    this.sync();
    this.onChange?.();
  }

  panel() {
    this.toggle = h('button', { class: 'btn btn--soft', type: 'button', onClick: () => (this.active ? this.stop() : this.start()) });
    this.reset = h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => this.clear() },
      h('span', { html: icon('reset') }), 'Retirer');
    this.bend = createSlider({
      label: 'Courbure',
      min: 0,
      max: 100,
      value: this.crop.bend,
      defaultValue: 0,
      onInput: (v) => this.#setCrop({ bend: v }),
      onChange: () => this.app.commit(),
    });
    this.axes = AXES.map(({ value, label }) =>
      h('button', {
        class: 'chip',
        type: 'button',
        onClick: () => {
          this.#setCrop({ bendAxis: value });
          this.app.commit();
        },
      }, label),
    );
    this.sync();
    return [
      h('div', { class: 'button-row' }, this.toggle, this.reset),
      this.bend.el,
      h('div', { class: 'chips' }, this.axes),
      h('p', { class: 'hint' },
        'Placez les quatre coins autour de la zone à aplatir (tatouage, feuille, écran, façade…). ',
        'La courbure déroule une surface arrondie comme un bras ou une jambe.'),
    ];
  }

  sync() {
    if (!this.toggle) return;
    const { quad, bend, bendAxis } = this.crop;
    this.toggle.replaceChildren(
      h('span', { html: icon(this.active ? 'check' : 'perspective') }),
      this.active ? 'Valider les coins' : quad ? 'Modifier les coins' : this.startLabel,
    );
    this.toggle.className = `btn ${this.active ? 'btn--primary' : 'btn--soft'}`;
    this.reset.disabled = !quad && !bend;
    this.bend.set(bend);
    this.axes.forEach((chip, i) => chip.classList.toggle('is-active', AXES[i].value === bendAxis));
  }

  overlay(view) {
    if (!this.active || !this.crop.quad) return '';
    const q = this.crop.quad;
    const screen = ([u, v]) => view.toScreen(u, v);
    const corners = [0, 1, 2, 3].map((i) => screen([q[i * 2], q[i * 2 + 1]]));
    const m = squareToQuad(q);
    let grid = '';
    for (const t of [1 / 3, 2 / 3]) {
      const lines = [[[t, 0], [t, 1]], [[0, t], [1, t]]];
      for (const [a, b] of lines) {
        const [ax, ay] = screen(project(m, ...a));
        const [bx, by] = screen(project(m, ...b));
        grid += `M${ax},${ay}L${bx},${by}`;
      }
    }
    const outline = `M${corners.map(([x, y]) => `${x},${y}`).join('L')}Z`;
    const handles = corners
      .map(([x, y], i) => `<g class="handle${this.drag?.index === i ? ' is-active' : ''}"><circle cx="${x}" cy="${y}" r="9"/></g>`)
      .join('');
    return `
      <path class="crop__shade" fill-rule="evenodd" d="M0,0H${view.w}V${view.h}H0Z ${outline}"/>
      <path class="crop__grid" d="${grid}"/>
      <path class="crop__frame" d="${outline}"/>
      ${handles}`;
  }

  pointerDown(p, e) {
    if (!this.active || e.button !== 0) return false;
    const { displayWidth: w, displayHeight: h } = this.app.view;
    const q = this.crop.quad;
    const corners = [0, 1, 2, 3].map((i) => [q[i * 2] * w, q[i * 2 + 1] * h]);
    const index = corners.findIndex(([x, y]) => Math.hypot(p.x * w - x, p.y * h - y) < 26);
    if (index >= 0) {
      this.drag = { index };
    } else if (inside(corners, p.x * w, p.y * h)) {
      this.drag = { index: -1, start: p, quad: q };
    } else {
      return false;
    }
    return true;
  }

  pointerMove(p) {
    const { drag } = this;
    if (!drag) return;
    if (drag.index >= 0) {
      const quad = [...this.crop.quad];
      quad[drag.index * 2] = clamp(p.x, 0, 1);
      quad[drag.index * 2 + 1] = clamp(p.y, 0, 1);
      this.#setQuad(quad);
      return;
    }
    const xs = drag.quad.filter((_, i) => i % 2 === 0);
    const ys = drag.quad.filter((_, i) => i % 2 === 1);
    const dx = clamp(p.x - drag.start.x, -Math.min(...xs), 1 - Math.max(...xs));
    const dy = clamp(p.y - drag.start.y, -Math.min(...ys), 1 - Math.max(...ys));
    this.#setQuad(drag.quad.map((v, i) => v + (i % 2 ? dy : dx)));
  }

  pointerUp() {
    if (!this.drag) return;
    this.drag = null;
    this.app.commit();
    this.app.refreshOverlay();
  }

  hover(p) {
    if (!this.active || !p) return;
    const { displayWidth: w, displayHeight: h } = this.app.view;
    const q = this.crop.quad;
    const near = [0, 1, 2, 3].some((i) => Math.hypot(p.x * w - q[i * 2] * w, p.y * h - q[i * 2 + 1] * h) < 26);
    this.app.view.el.style.cursor = near ? 'grab' : '';
  }
}
