import { Tool } from './tool.js';
import { createSlider } from '../ui/slider.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { uid } from '../state/defaults.js';
import { findHealSource } from '../edit/heal.js';
import { fromSize, toSize } from './local.js';

const SPOT_SIZE = { min: 0.004, max: 0.12 };

// Spot healing: tap a blemish, a matching patch is picked automatically.
// Both circles can then be moved by hand.
export class HealTool extends Tool {
  constructor(app) {
    super(app, { id: 'heal', label: 'Correcteur', icon: 'heal' });
    this.size = 35;
    this.selectedId = null;
    this.cursor = null;
  }

  get spots() {
    return this.app.edit.heal;
  }

  get selected() {
    return this.spots.find((s) => s.id === this.selectedId) ?? null;
  }

  mount(el) {
    this.slider = createSlider({
      label: 'Taille',
      min: 1,
      max: 100,
      value: this.size,
      defaultValue: 35,
      onInput: (v) => {
        this.size = v;
        if (this.selected) this.#patch({ r: toSize(SPOT_SIZE, v) });
        this.app.refreshOverlay();
      },
      onChange: () => this.app.commit(),
    });
    this.count = h('span', { class: 'section__meta' });
    this.removeButton = h('button', { class: 'btn btn--soft', type: 'button', onClick: () => this.#remove() },
      h('span', { html: icon('trash') }), 'Supprimer');
    el.append(
      h('section', { class: 'section' },
        h('h3', { class: 'section__title' }, 'Correcteur', this.count),
        this.slider.el,
        h('div', { class: 'button-row' },
          this.removeButton,
          h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => this.#clear() },
            h('span', { html: icon('reset') }), 'Tout effacer'),
        ),
        h('p', { class: 'hint' }, 'Touchez une imperfection (poussière, bouton, fil…) pour la faire disparaître. Le cercle en pointillés indique la zone copiée, vous pouvez le déplacer.'),
      ),
    );
    this.sync();
  }

  unmount() {
    this.cursor = null;
  }

  sync() {
    if (!this.count) return;
    if (this.selectedId && !this.selected) this.selectedId = null;
    const n = this.spots.length;
    this.count.textContent = n ? `${n} correction${n > 1 ? 's' : ''}` : '';
    this.removeButton.disabled = !this.selected;
  }

  #patch(patch) {
    const edit = this.app.edit;
    this.app.replace({ ...edit, heal: edit.heal.map((s) => (s.id === this.selectedId ? { ...s, ...patch } : s)) });
  }

  #remove() {
    if (!this.selected) return;
    const edit = this.app.edit;
    this.app.replace({ ...edit, heal: edit.heal.filter((s) => s.id !== this.selectedId) });
    this.app.commit();
    this.selectedId = null;
    this.sync();
  }

  #clear() {
    this.app.replace({ ...this.app.edit, heal: [] });
    this.app.commit();
    this.selectedId = null;
    this.sync();
  }

  overlay(view) {
    const parts = this.spots.map((spot) => {
      const [x, y] = view.toScreen(spot.x, spot.y);
      const r = spot.r * view.unit;
      if (spot.id !== this.selectedId) return `<circle class="spot" cx="${x}" cy="${y}" r="${r}"/>`;
      const [sx, sy] = view.toScreen(spot.sx, spot.sy);
      return `<path class="spot__link" d="M${x},${y}L${sx},${sy}"/>
        <circle class="spot spot--source" cx="${sx}" cy="${sy}" r="${r}"/>
        <circle class="spot is-active" cx="${x}" cy="${y}" r="${r}"/>`;
    });
    if (this.cursor && !this.drag) {
      const r = toSize(SPOT_SIZE, this.size) * view.unit;
      parts.push(`<circle class="brush-cursor" cx="${this.cursor.x * view.w}" cy="${this.cursor.y * view.h}" r="${r}"/>`);
    }
    return parts.join('');
  }

  pointerDown(p, e) {
    if (e.button !== 0) return false;
    const view = this.app.viewContext();
    const px = p.x * view.w;
    const py = p.y * view.h;
    const inside = (u, v, r) => {
      const [x, y] = view.toScreen(u, v);
      return Math.hypot(px - x, py - y) < Math.max(10, r * view.unit);
    };

    const selected = this.selected;
    if (selected && inside(selected.sx, selected.sy, selected.r)) {
      this.drag = { kind: 'source', view };
      return true;
    }
    const hit = [...this.spots].reverse().find((s) => inside(s.x, s.y, s.r));
    if (hit) {
      this.selectedId = hit.id;
      this.size = fromSize(SPOT_SIZE, hit.r);
      this.slider.set(this.size);
      this.drag = { kind: 'target', view };
      this.sync();
      this.app.refreshOverlay();
      return true;
    }

    const [x, y] = view.toSource(p);
    if (x < 0 || y < 0 || x > 1 || y > 1) return false;
    const r = toSize(SPOT_SIZE, this.size);
    const { sx, sy } = findHealSource(this.app.image.analysis, x, y, r);
    const spot = { id: uid('h'), x, y, r, sx, sy };
    this.app.replace({ ...this.app.edit, heal: [...this.spots, spot] });
    this.app.commit();
    this.selectedId = spot.id;
    this.sync();
    return true;
  }

  pointerMove(p) {
    if (!this.drag) return;
    const [u, v] = this.drag.view.toSource(p);
    this.#patch(this.drag.kind === 'source' ? { sx: u, sy: v } : { x: u, y: v });
  }

  pointerUp() {
    this.drag = null;
    this.app.commit();
  }

  hover(p) {
    this.cursor = p;
    this.app.refreshOverlay();
  }

  keyDown(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) {
      this.#remove();
      return true;
    }
    return false;
  }
}
