import { Tool } from './tool.js';
import { createSlider } from '../ui/slider.js';
import { h } from '../ui/dom.js';
import { LOOKS, LOOK_GROUPS, applyLook } from '../edit/presets.js';
import { autoTune } from '../edit/auto.js';

const AUTO = { id: 'auto', label: 'Auto', auto: true };
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

export class LooksTool extends Tool {
  constructor(app) {
    super(app, {
      id: 'looks',
      label: 'Styles',
      icon: 'looks',
      hint: 'Un style remplace les réglages globaux. Le recadrage et les retouches locales sont conservés.',
    });
    this.selected = null;
    this.amount = 100;
  }

  mount(el) {
    this.cards = new Map();
    const card = (look) => {
      const canvas = h('canvas', { class: 'look__thumb', width: 1, height: 1 });
      const button = h('button', { class: 'look', type: 'button', onClick: () => this.#select(look) },
        canvas, h('span', { class: 'look__label' }, look.label));
      this.cards.set(look.id, { card: button, canvas, look });
      return button;
    };
    const groups = LOOK_GROUPS.map(({ id, label }) => {
      const looks = LOOKS.filter((look) => look.group === id);
      if (id === 'essentials') looks.unshift(AUTO);
      return h('section', { class: 'section' },
        h('h3', { class: 'section__title' }, label),
        h('div', { class: 'looks' }, looks.map(card)));
    });
    this.slider = createSlider({
      label: 'Intensité',
      min: 0,
      max: 100,
      value: this.amount,
      defaultValue: 100,
      onInput: (v) => {
        this.amount = v;
        this.#apply();
      },
      onChange: () => this.app.commit(),
    });
    el.append(
      h('section', { class: 'section' }, this.slider.el, h('p', { class: 'hint' }, this.hint)),
      ...groups,
    );
    this.#refresh();
    this.#renderThumbnails();
  }

  unmount() {
    this.token = null;
  }

  #values(look) {
    return look.auto ? { tune: autoTune(this.app.stats) } : look.values;
  }

  #select(look) {
    this.selected = look;
    this.amount = 100;
    this.slider.set(100);
    this.#apply();
    this.app.commit();
    this.#refresh();
  }

  #apply() {
    if (!this.selected) return;
    this.app.replace(applyLook(this.app.edit, this.#values(this.selected), this.amount / 100));
  }

  #refresh() {
    for (const { card, look } of this.cards.values()) {
      card.classList.toggle('is-active', look === this.selected);
    }
    this.slider.input.disabled = !this.selected;
    this.slider.el.classList.toggle('is-disabled', !this.selected);
  }

  async #renderThumbnails() {
    const token = (this.token = {});
    const base = this.app.edit;
    for (const { canvas, look } of this.cards.values()) {
      await nextFrame();
      if (this.token !== token) return;
      const pixels = this.app.renderer.renderPixels(applyLook(base, this.#values(look), 1), { maxSize: 176 });
      canvas.width = pixels.width;
      canvas.height = pixels.height;
      canvas.getContext('2d').putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);
    }
  }
}
