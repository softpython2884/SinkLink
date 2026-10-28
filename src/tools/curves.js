import { Tool } from './tool.js';
import { clamp, h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { CURVE_PRESETS, curveFunction, isIdentity } from '../edit/curves.js';
import { IDENTITY_CURVE } from '../state/defaults.js';

const CHANNELS = [
  { id: 'rgb', label: 'RVB', color: '#e8eaed' },
  { id: 'red', label: 'Rouge', color: '#ff5a5f' },
  { id: 'green', label: 'Vert', color: '#3ddc84' },
  { id: 'blue', label: 'Bleu', color: '#4d8dff' },
];
const SIZE = 256;
const HIT = 16;

export class CurvesTool extends Tool {
  constructor(app) {
    super(app, {
      id: 'curves',
      label: 'Courbes',
      icon: 'curves',
      hint: 'Cliquez pour ajouter un point, faites-le glisser hors du cadre ou double-cliquez pour le retirer.',
    });
    this.channel = 'rgb';
    this.drag = null;
  }

  get points() {
    return this.app.edit.curves[this.channel];
  }

  mount(el) {
    this.tabs = CHANNELS.map((c) =>
      h('button', {
        class: 'segmented__item',
        type: 'button',
        style: { '--channel': c.color },
        onClick: () => {
          this.channel = c.id;
          this.sync(this.app.edit);
        },
      }, c.label),
    );
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
    this.svg.classList.add('curve-editor');
    this.svg.addEventListener('pointerdown', (e) => this.#down(e));
    this.svg.addEventListener('pointermove', (e) => this.#move(e));
    this.svg.addEventListener('pointerup', (e) => this.#up(e));
    this.svg.addEventListener('pointercancel', (e) => this.#up(e));
    this.svg.addEventListener('dblclick', (e) => this.#remove(e));

    this.presets = CURVE_PRESETS.map((preset) =>
      h('button', { class: 'chip', type: 'button', onClick: () => this.#setPoints(preset.points, true) }, preset.label),
    );

    el.append(
      h('section', { class: 'section' },
        h('div', { class: 'segmented' }, this.tabs),
        h('div', { class: 'curve-box' }, this.svg),
        h('p', { class: 'hint' }, this.hint),
      ),
      h('section', { class: 'section' },
        h('h3', { class: 'section__title' }, 'Préréglages'),
        h('div', { class: 'chips' }, this.presets),
        h('div', { class: 'panel__actions' },
          h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => this.#setPoints(IDENTITY_CURVE, true) },
            h('span', { html: icon('reset') }), 'Réinitialiser la courbe'),
        ),
      ),
    );
    this.sync(this.app.edit);
  }

  sync(edit) {
    if (!this.svg) return;
    this.tabs.forEach((tab, i) => {
      const id = CHANNELS[i].id;
      tab.classList.toggle('is-active', id === this.channel);
      tab.classList.toggle('is-changed', !isIdentity(edit.curves[id]));
    });
    this.#draw(edit.curves[this.channel]);
  }

  #draw(points) {
    const color = CHANNELS.find((c) => c.id === this.channel).color;
    const fn = curveFunction(points);
    let path = '';
    for (let i = 0; i <= 128; i++) {
      const x = i / 128;
      path += `${i ? 'L' : 'M'}${(x * SIZE).toFixed(1)},${((1 - fn(x)) * SIZE).toFixed(1)}`;
    }

    let histogram = '';
    const bins = this.app.histogram.bins?.l;
    if (bins) {
      const peak = Math.max(1, ...bins.slice(2, 254));
      histogram = `<path class="curve-editor__histogram" d="M0,${SIZE}${[...bins]
        .map((v, i) => `L${i},${(SIZE - Math.min(1, Math.sqrt(v / peak)) * SIZE * 0.9).toFixed(1)}`)
        .join('')}L${SIZE},${SIZE}Z"/>`;
    }

    const grid = [64, 128, 192]
      .map((v) => `<path class="curve-editor__grid" d="M${v},0V${SIZE}M0,${v}H${SIZE}"/>`)
      .join('');
    const handles = points
      .map(([x, y], i) =>
        `<circle class="curve-editor__point${this.drag?.index === i ? ' is-active' : ''}" cx="${x * SIZE}" cy="${(1 - y) * SIZE}" r="5.5"/>`)
      .join('');

    this.svg.style.setProperty('--curve', color);
    this.svg.innerHTML = `${histogram}${grid}
      <path class="curve-editor__diagonal" d="M0,${SIZE}L${SIZE},0"/>
      <path class="curve-editor__curve" d="${path}"/>${handles}`;
  }

  #position(e) {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: 1 - (e.clientY - rect.top) / rect.height,
      scale: rect.width,
    };
  }

  #setPoints(points, commit = false) {
    this.app.set(`curves.${this.channel}`, points);
    if (commit) this.app.commit();
  }

  #down(e) {
    const p = this.#position(e);
    const points = this.points.map((pt) => [...pt]);
    let index = points.findIndex(([x, y]) => Math.hypot(x - p.x, y - p.y) * p.scale < HIT);
    if (index < 0) {
      const point = [clamp(p.x, 0, 1), clamp(p.y, 0, 1)];
      points.push(point);
      points.sort((a, b) => a[0] - b[0]);
      index = points.indexOf(point);
      this.#setPoints(points);
    }
    this.svg.setPointerCapture(e.pointerId);
    this.drag = { index, points, removed: false };
    this.sync(this.app.edit);
  }

  #move(e) {
    if (!this.drag) return;
    const p = this.#position(e);
    const { index, points } = this.drag;
    const last = points.length - 1;
    const min = index === 0 ? 0 : points[index - 1][0] + 0.01;
    const max = index === last ? 1 : points[index + 1][0] - 0.01;
    const outside = p.y < -0.1 || p.y > 1.1 || p.x < -0.1 || p.x > 1.1;
    this.drag.removed = outside && index !== 0 && index !== last && points.length > 2;

    const next = points.map((pt) => [...pt]);
    next[index] = [clamp(p.x, min, max), clamp(p.y, 0, 1)];
    this.drag.points = next;
    this.#setPoints(this.drag.removed ? next.filter((_, i) => i !== index) : next);
  }

  #up() {
    if (!this.drag) return;
    this.drag = null;
    this.app.commit();
    this.sync(this.app.edit);
  }

  #remove(e) {
    const p = this.#position(e);
    const points = this.points;
    const index = points.findIndex(([x, y]) => Math.hypot(x - p.x, y - p.y) * p.scale < HIT);
    if (index > 0 && index < points.length - 1) {
      this.#setPoints(points.filter((_, i) => i !== index), true);
    }
  }
}
