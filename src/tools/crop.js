import { Tool } from './tool.js';
import { createSlider } from '../ui/slider.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { fitAspect, mirrorCrop, moveCrop, resizeCrop, rotateCrop } from '../render/geometry.js';
import { DEFAULT_EDIT } from '../state/defaults.js';
import { PerspectiveEditor } from './perspective.js';

const RATIOS = [
  { id: 'free', label: 'Libre', ratio: null },
  { id: 'original', label: 'Original', ratio: 'original' },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '5:4', label: '5:4', ratio: 5 / 4 },
];
const CORNERS = ['nw', 'ne', 'sw', 'se'];
const EDGES = ['n', 's', 'e', 'w'];
const CURSORS = {
  nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', move: 'move',
};

const sameRatio = (a, b) => a && b && Math.abs(a / b - 1) < 1e-3;

export class CropTool extends Tool {
  constructor(app) {
    super(app, { id: 'crop', label: 'Recadrer', icon: 'crop' });
    this.drag = null;
    this.straightening = false;
    this.perspective = new PerspectiveEditor(app, { onChange: () => this.sync(this.app.edit) });
  }

  renderOptions() {
    return this.perspective.active ? { raw: true } : { frame: true };
  }

  get crop() {
    return this.app.edit.crop;
  }

  #frame() {
    return this.app.renderer.geometry(this.app.edit, { frame: true });
  }

  #setCrop(crop, commit = false) {
    this.app.replace({ ...this.app.edit, crop });
    if (commit) this.app.commit();
  }

  #ratioValue(option) {
    const { frameWidth, frameHeight } = this.#frame();
    if (option.ratio === 'original') return frameWidth / frameHeight;
    if (!option.ratio) return null;
    // Keep the orientation of the current crop.
    const portrait = this.crop.w * frameWidth < this.crop.h * frameHeight;
    return portrait ? 1 / option.ratio : option.ratio;
  }

  #applyRatio(ratio) {
    const { frameWidth, frameHeight } = this.#frame();
    this.#setCrop(fitAspect(this.crop, ratio, frameWidth, frameHeight), true);
  }

  mount(el) {
    this.ratioButtons = RATIOS.map((option) =>
      h('button', { class: 'chip', type: 'button', onClick: () => this.#applyRatio(this.#ratioValue(option)) }, option.label),
    );
    const swap = h('button', {
      class: 'chip chip--icon',
      type: 'button',
      title: 'Inverser l’orientation',
      'aria-label': 'Inverser l’orientation',
      html: icon('swap'),
      onClick: () => this.crop.aspect && this.#applyRatio(1 / this.crop.aspect),
    });

    this.angle = createSlider({
      label: 'Redresser',
      min: -45,
      max: 45,
      step: 0.1,
      value: this.crop.angle,
      defaultValue: 0,
      format: (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}°`,
      onInput: (v) => {
        this.straightening = true;
        this.#setCrop({ ...this.crop, angle: v });
      },
      onChange: () => {
        this.straightening = false;
        this.app.commit();
        this.app.refreshOverlay();
      },
    });

    const action = (name, label, run) =>
      h('button', { class: 'btn btn--soft', type: 'button', title: label, onClick: run },
        h('span', { html: icon(name) }), label);

    el.append(
      h('section', { class: 'section' },
        h('h3', { class: 'section__title' }, 'Format'),
        h('div', { class: 'chips' }, this.ratioButtons, swap),
      ),
      h('section', { class: 'section' },
        h('h3', { class: 'section__title' }, 'Rotation'),
        h('div', { class: 'button-row' },
          action('rotateLeft', '90° gauche', () => this.#setCrop(rotateCrop(this.crop, -1), true)),
          action('rotateRight', '90° droite', () => this.#setCrop(rotateCrop(this.crop, 1), true)),
          action('mirror', 'Miroir', () => this.#setCrop(mirrorCrop(this.crop), true)),
        ),
        this.angle.el,
      ),
      h('section', { class: 'section' },
        h('h3', { class: 'section__title' }, 'Perspective'),
        this.perspective.panel(),
      ),
      h('section', { class: 'section' },
        h('div', { class: 'panel__actions' },
          h('button', {
            class: 'btn btn--ghost',
            type: 'button',
            onClick: () => this.#setCrop(DEFAULT_EDIT.crop, true),
          }, h('span', { html: icon('reset') }), 'Réinitialiser le cadrage'),
        ),
        h('p', { class: 'hint' }, 'Faites glisser les coins pour recadrer, l’intérieur pour déplacer le cadre.'),
      ),
    );
    this.sync(this.app.edit);
  }

  sync(edit) {
    if (!this.angle) return;
    this.angle.set(edit.crop.angle);
    this.perspective.sync();
    RATIOS.forEach((option, i) => {
      const value = option.ratio === null ? null : this.#ratioValue(option);
      const active = option.ratio === null
        ? edit.crop.aspect === null
        : sameRatio(edit.crop.aspect, value) || sameRatio(edit.crop.aspect, 1 / value);
      this.ratioButtons[i].classList.toggle('is-active', !!active);
    });
  }

  overlay(view) {
    if (this.perspective.active) return this.perspective.overlay(view);
    const { w, h } = view;
    const { x, y, w: cw, h: ch, aspect } = this.crop;
    const rx = x * w;
    const ry = y * h;
    const rw = cw * w;
    const rh = ch * h;
    const lines = this.straightening ? 9 : 3;
    let grid = '';
    for (let i = 1; i < lines; i++) {
      const gx = rx + (rw * i) / lines;
      const gy = ry + (rh * i) / lines;
      grid += `M${gx},${ry}V${ry + rh}M${rx},${gy}H${rx + rw}`;
    }
    const len = Math.min(22, rw / 3, rh / 3);
    const corner = (cx, cy, sx, sy) => `M${cx + sx * len},${cy}H${cx}V${cy + sy * len}`;
    const corners = [
      corner(rx, ry, 1, 1), corner(rx + rw, ry, -1, 1),
      corner(rx, ry + rh, 1, -1), corner(rx + rw, ry + rh, -1, -1),
    ].join('');
    const bar = Math.min(18, rw / 4, rh / 4);
    const edges = aspect ? '' : [
      `M${rx + rw / 2 - bar},${ry}h${bar * 2}`, `M${rx + rw / 2 - bar},${ry + rh}h${bar * 2}`,
      `M${rx},${ry + rh / 2 - bar}v${bar * 2}`, `M${rx + rw},${ry + rh / 2 - bar}v${bar * 2}`,
    ].join('');

    return `
      <path class="crop__shade" fill-rule="evenodd" d="M0,0H${w}V${h}H0Z M${rx},${ry}h${rw}v${rh}h${-rw}Z"/>
      <path class="crop__grid" d="${grid}"/>
      <rect class="crop__frame" x="${rx}" y="${ry}" width="${rw}" height="${rh}"/>
      <path class="crop__handles" d="${corners}${edges}"/>`;
  }

  #hit(p) {
    const { displayWidth: W, displayHeight: H } = this.app.view;
    const { x, y, w, h, aspect } = this.crop;
    const px = p.x * W;
    const py = p.y * H;
    const left = x * W;
    const top = y * H;
    const right = (x + w) * W;
    const bottom = (y + h) * H;
    const near = (a, b, tolerance) => Math.abs(a - b) < tolerance;

    for (const handle of CORNERS) {
      const hx = handle.includes('w') ? left : right;
      const hy = handle.includes('n') ? top : bottom;
      if (Math.hypot(px - hx, py - hy) < 24) return handle;
    }
    if (!aspect) {
      const inX = px > left && px < right;
      const inY = py > top && py < bottom;
      for (const handle of EDGES) {
        if (handle === 'n' && inX && near(py, top, 14)) return handle;
        if (handle === 's' && inX && near(py, bottom, 14)) return handle;
        if (handle === 'w' && inY && near(px, left, 14)) return handle;
        if (handle === 'e' && inY && near(px, right, 14)) return handle;
      }
    }
    if (px > left && px < right && py > top && py < bottom) return 'move';
    return null;
  }

  pointerDown(p, e) {
    if (this.perspective.active) return this.perspective.pointerDown(p, e);
    if (e.button !== 0) return false;
    const handle = this.#hit(p);
    if (!handle) return false;
    const { x, y, w, h } = this.crop;
    this.drag = { handle, start: p, rect: { x, y, w, h } };
    return true;
  }

  pointerMove(p) {
    if (this.perspective.active) return this.perspective.pointerMove(p);
    if (!this.drag) return;
    const { handle, start, rect } = this.drag;
    const { frameWidth, frameHeight } = this.#frame();
    const next = handle === 'move'
      ? moveCrop(rect, p.x - start.x, p.y - start.y)
      : resizeCrop(rect, handle, p.x, p.y, { ratio: this.crop.aspect, frameWidth, frameHeight });
    this.#setCrop({ ...this.crop, x: next.x, y: next.y, w: next.w, h: next.h });
  }

  pointerUp() {
    if (this.perspective.active) return this.perspective.pointerUp();
    if (!this.drag) return;
    this.drag = null;
    this.app.commit();
  }

  hover(p) {
    if (this.perspective.active) return this.perspective.hover(p);
    this.app.view.el.style.cursor = p ? CURSORS[this.#hit(p)] ?? '' : '';
  }

  unmount() {
    this.perspective.stop();
    this.app.view.el.style.cursor = '';
  }
}
