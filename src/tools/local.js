import { Tool } from './tool.js';
import { createSlider } from '../ui/slider.js';
import { clamp, h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { ZONE_DEFAULTS, uid } from '../state/defaults.js';

const TYPES = {
  point: { label: 'Point', icon: 'point' },
  brush: { label: 'Pinceau', icon: 'brush' },
  gradient: { label: 'Dégradé', icon: 'gradient' },
};

const ADJUSTMENTS = [
  ['exposure', 'Luminosité'],
  ['contrast', 'Contraste'],
  ['saturation', 'Saturation'],
  ['warmth', 'Chaleur'],
  ['structure', 'Structure'],
];

// Sizes are fractions of the long side; sliders map onto them logarithmically.
export const POINT_RADIUS = { min: 0.02, max: 0.6 };
export const BRUSH_SIZE = { min: 0.003, max: 0.2 };
export const toSize = ({ min, max }, v) => min * (max / min) ** (v / 100);
export const fromSize = ({ min, max }, size) => Math.round((Math.log(size / min) / Math.log(max / min)) * 100);

// Local adjustments: control points with colour selectivity, brush and linear
// gradient. Positions are stored in source coordinates so that cropping or
// rotating afterwards keeps them in place.
export class LocalTool extends Tool {
  constructor(app) {
    super(app, { id: 'local', label: 'Local', icon: 'local' });
    this.selectedId = null;
    this.placing = false;
    this.showMask = false;
    this.flash = false;
    this.cursor = null;
    this.brush = { size: 45, hardness: 40, flow: 100, erase: false };
  }

  get zones() {
    return this.app.edit.zones;
  }

  get selected() {
    return this.zones.find((z) => z.id === this.selectedId) ?? null;
  }

  renderOptions() {
    const visible = this.selectedId && (this.showMask || this.flash);
    return { maskZone: visible ? this.selectedId : null };
  }

  mount(el) {
    this.el = el;
    this.render();
  }

  unmount() {
    this.el = null;
    this.placing = false;
    this.cursor = null;
    this.app.view.el.style.cursor = '';
  }

  #name(zone) {
    const index = this.zones.filter((z) => z.type === zone.type).indexOf(zone);
    return `${TYPES[zone.type].label} ${index + 1}`;
  }

  #layoutKey() {
    return `${this.selectedId}|${this.placing}|${this.zones.map((z) => z.id).join(',')}`;
  }

  render() {
    const { el } = this;
    if (!el) return;
    this.renderedKey = this.#layoutKey();
    this.sliders = {};
    el.replaceChildren();

    const add = (type) =>
      h('button', { class: 'btn btn--soft', type: 'button', onClick: () => this.#add(type) },
        h('span', { html: icon(TYPES[type].icon) }), TYPES[type].label);
    el.append(section('Ajouter', h('div', { class: 'button-row' }, add('point'), add('brush'), add('gradient'))));

    if (this.zones.length) {
      el.append(section('Zones', h('div', { class: 'chips' }, this.zones.map((zone) =>
        h('button', {
          class: `chip${zone.id === this.selectedId ? ' is-active' : ''}`,
          type: 'button',
          onClick: () => this.select(zone.id),
        }, h('span', { html: icon(TYPES[zone.type].icon, 'icon icon--sm') }), this.#name(zone)),
      ))));
    }

    const zone = this.selected;
    if (!zone) {
      el.append(h('p', { class: 'hint' }, this.placing
        ? 'Touchez la photo à l’endroit à retoucher.'
        : 'Un point agit sur une zone ronde et sur les couleurs proches de son centre, le pinceau là où vous peignez, le dégradé sur une moitié de l’image (un ciel, par exemple).'));
      return;
    }

    el.append(section('Réglages', ADJUSTMENTS.map(([key, label]) => {
      this.sliders[key] = createSlider({
        label,
        value: zone[key],
        onInput: (v) => this.#patch({ [key]: v }),
        onChange: () => this.app.commit(),
      });
      return this.sliders[key].el;
    })));

    if (zone.type === 'point') {
      this.sliders.radius = this.#flashSlider('Rayon', fromSize(POINT_RADIUS, zone.radius), 1, 100,
        (v) => this.#patch({ radius: toSize(POINT_RADIUS, v) }));
      this.sliders.selectivity = this.#flashSlider('Sélectivité couleur', zone.selectivity, 0, 100,
        (v) => this.#patch({ selectivity: v }));
      el.append(section('Point', [this.sliders.radius.el, this.sliders.selectivity.el]));
    }

    if (zone.type === 'brush') {
      const brushSlider = (key, label) => createSlider({
        label,
        min: 1,
        max: 100,
        value: this.brush[key],
        defaultValue: this.brush[key],
        onInput: (v) => {
          this.brush[key] = v;
          this.app.refreshOverlay();
        },
      });
      const eraser = h('button', {
        class: `chip${this.brush.erase ? ' is-active' : ''}`,
        type: 'button',
        onClick: () => {
          this.brush.erase = !this.brush.erase;
          eraser.classList.toggle('is-active', this.brush.erase);
        },
      }, h('span', { html: icon('eraser', 'icon icon--sm') }), 'Gomme');
      el.append(section('Pinceau', [
        brushSlider('size', 'Taille'),
        brushSlider('hardness', 'Dureté'),
        brushSlider('flow', 'Opacité'),
        h('div', { class: 'chips' }, eraser),
        h('p', { class: 'hint' }, 'Peignez sur la photo. Maintenez Alt pour gommer, [ et ] pour changer la taille.'),
      ]));
    }

    const invert = h('button', {
      class: `chip${zone.invert ? ' is-active' : ''}`,
      type: 'button',
      onClick: () => {
        this.#patch({ invert: !this.selected.invert });
        this.app.commit();
        invert.classList.toggle('is-active', this.selected.invert);
      },
    }, h('span', { html: icon('invert', 'icon icon--sm') }), 'Inverser');
    const mask = h('button', {
      class: `chip${this.showMask ? ' is-active' : ''}`,
      type: 'button',
      onClick: () => {
        this.showMask = !this.showMask;
        mask.classList.toggle('is-active', this.showMask);
        this.app.invalidate();
      },
    }, h('span', { html: icon('eye', 'icon icon--sm') }), 'Masque');
    el.append(
      section(null, [
        h('div', { class: 'chips' }, invert, mask),
        h('div', { class: 'panel__actions' },
          h('button', { class: 'btn btn--danger', type: 'button', onClick: () => this.#remove() },
            h('span', { html: icon('trash') }), 'Supprimer la zone')),
      ]),
    );
  }

  // Slider that shows the mask while it is being dragged.
  #flashSlider(label, value, min, max, apply) {
    return createSlider({
      label,
      min,
      max,
      value,
      defaultValue: value,
      onInput: (v) => {
        this.flash = true;
        apply(v);
      },
      onChange: () => {
        this.flash = false;
        this.app.commit();
        this.app.invalidate();
      },
    });
  }

  sync() {
    if (!this.el) return;
    if (this.selectedId && !this.selected) this.selectedId = null;
    if (this.renderedKey !== this.#layoutKey()) {
      this.render();
      return;
    }
    const zone = this.selected;
    if (!zone) return;
    for (const [key] of ADJUSTMENTS) this.sliders[key]?.set(zone[key]);
    if (zone.type === 'point') {
      this.sliders.radius?.set(fromSize(POINT_RADIUS, zone.radius));
      this.sliders.selectivity?.set(zone.selectivity);
    }
  }

  select(id) {
    this.selectedId = id;
    this.placing = false;
    this.app.view.el.style.cursor = '';
    this.render();
    this.app.invalidate();
  }

  #add(type) {
    if (type === 'point') {
      this.selectedId = null;
      this.placing = true;
      this.app.view.el.style.cursor = 'crosshair';
      this.render();
      this.app.invalidate();
      return;
    }
    const view = this.app.viewContext();
    let zone;
    if (type === 'gradient') {
      const [x0, y0] = view.toSource({ x: 0.5, y: 0.1 });
      const [x1, y1] = view.toSource({ x: 0.5, y: 0.5 });
      zone = { id: uid('z'), type, x0, y0, x1, y1, ...ZONE_DEFAULTS, exposure: -30 };
    } else {
      zone = { id: uid('z'), type, strokes: [], ...ZONE_DEFAULTS, exposure: 30 };
    }
    this.#insert(zone);
  }

  #insert(zone) {
    const edit = this.app.edit;
    this.app.replace({ ...edit, zones: [...edit.zones, zone] });
    this.app.commit();
    this.select(zone.id);
  }

  #patch(patch) {
    const edit = this.app.edit;
    this.app.replace({
      ...edit,
      zones: edit.zones.map((z) => (z.id === this.selectedId ? { ...z, ...patch } : z)),
    });
  }

  #remove() {
    const edit = this.app.edit;
    this.app.replace({ ...edit, zones: edit.zones.filter((z) => z.id !== this.selectedId) });
    this.app.commit();
    this.selectedId = null;
    this.render();
  }

  overlay(view) {
    const parts = [];
    this.zones.forEach((zone, index) => {
      const active = zone.id === this.selectedId;
      const pin = ([x, y]) =>
        `<g class="pin${active ? ' is-active' : ''}"><circle cx="${x}" cy="${y}" r="11"/>` +
        `<text x="${x}" y="${y}" dy="0.35em">${index + 1}</text></g>`;

      if (zone.type === 'point') {
        const c = view.toScreen(zone.x, zone.y);
        if (active) {
          const r = zone.radius * view.unit;
          parts.push(
            `<circle class="zone__ring" cx="${c[0]}" cy="${c[1]}" r="${r}"/>`,
            `<g class="handle"><circle cx="${c[0] + r}" cy="${c[1]}" r="6"/></g>`,
          );
        }
        parts.push(pin(c));
      } else if (zone.type === 'gradient') {
        const a = view.toScreen(zone.x0, zone.y0);
        const b = view.toScreen(zone.x1, zone.y1);
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (active) {
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const reach = Math.max(view.w, view.h) * 2;
          const nx = (-(b[1] - a[1]) / len) * reach;
          const ny = ((b[0] - a[0]) / len) * reach;
          parts.push(
            `<path class="zone__guide" d="M${a[0] - nx},${a[1] - ny}L${a[0] + nx},${a[1] + ny}"/>`,
            `<path class="zone__guide zone__guide--end" d="M${b[0] - nx},${b[1] - ny}L${b[0] + nx},${b[1] + ny}"/>`,
            `<path class="zone__line" d="M${a[0]},${a[1]}L${b[0]},${b[1]}"/>`,
            `<g class="handle"><circle cx="${a[0]}" cy="${a[1]}" r="7"/></g>`,
            `<g class="handle handle--hollow"><circle cx="${b[0]}" cy="${b[1]}" r="7"/></g>`,
          );
        }
        parts.push(pin(mid));
      } else if (zone.type === 'brush' && zone.strokes.length) {
        const [u, v] = zone.strokes[0].points;
        parts.push(pin(view.toScreen(u, v)));
      }
    });

    if (this.cursor) {
      const x = this.cursor.x * view.w;
      const y = this.cursor.y * view.h;
      if (this.selected?.type === 'brush' && !this.drag?.kind?.match(/center|move/)) {
        const r = toSize(BRUSH_SIZE, this.brush.size) * view.unit;
        parts.push(`<circle class="brush-cursor${this.brush.erase ? ' is-erasing' : ''}" cx="${x}" cy="${y}" r="${r}"/>`);
      } else if (this.placing) {
        parts.push(`<circle class="zone__ring" cx="${x}" cy="${y}" r="${0.12 * view.unit}"/>`);
      }
    }
    return parts.join('');
  }

  #hit(p, view) {
    const px = p.x * view.w;
    const py = p.y * view.h;
    const near = ([x, y], tolerance = 15) => Math.hypot(px - x, py - y) < tolerance;
    const zone = this.selected;

    if (zone?.type === 'point') {
      const c = view.toScreen(zone.x, zone.y);
      if (near([c[0] + zone.radius * view.unit, c[1]], 12)) return { id: zone.id, kind: 'radius' };
      if (near(c)) return { id: zone.id, kind: 'center' };
    }
    if (zone?.type === 'gradient') {
      const a = view.toScreen(zone.x0, zone.y0);
      const b = view.toScreen(zone.x1, zone.y1);
      if (near(a)) return { id: zone.id, kind: 'start' };
      if (near(b)) return { id: zone.id, kind: 'end' };
      if (near([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])) return { id: zone.id, kind: 'move' };
    }
    for (const other of this.zones) {
      if (other === zone) continue;
      if (other.type === 'point' && near(view.toScreen(other.x, other.y))) {
        return { id: other.id, kind: 'center' };
      }
      if (other.type === 'gradient') {
        const a = view.toScreen(other.x0, other.y0);
        const b = view.toScreen(other.x1, other.y1);
        if (near([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])) return { id: other.id, kind: 'move' };
      }
      if (other.type === 'brush' && other.strokes.length) {
        const [u, v] = other.strokes[0].points;
        if (near(view.toScreen(u, v))) return { id: other.id, kind: 'select' };
      }
    }
    return null;
  }

  pointerDown(p, e) {
    if (e.button !== 0) return false;
    const view = this.app.viewContext();

    if (this.placing) {
      const [x, y] = view.toSource(p);
      this.#insert({ id: uid('z'), type: 'point', x, y, radius: 0.12, selectivity: 50, ...ZONE_DEFAULTS, exposure: 20 });
      this.drag = { kind: 'center', view };
      return true;
    }

    const hit = this.#hit(p, view);
    if (hit) {
      if (hit.id !== this.selectedId) this.select(hit.id);
      this.drag = { ...hit, view, origin: view.toSource(p), zone: this.selected };
      if (['radius', 'start', 'end'].includes(hit.kind)) {
        this.flash = true;
        this.app.invalidate();
      }
      return true;
    }

    if (this.selected?.type === 'brush') {
      this.#beginStroke(view.toSource(p), e.altKey);
      this.drag = { kind: 'paint', view };
      return true;
    }
    return false;
  }

  pointerMove(p) {
    const { drag } = this;
    if (!drag) return;
    this.cursor = p;
    const { view } = drag;
    const [u, v] = view.toSource(p);
    const zone = this.selected;
    switch (drag.kind) {
      case 'center':
        this.#patch({ x: u, y: v });
        break;
      case 'radius': {
        const [cx, cy] = view.toScreen(zone.x, zone.y);
        const r = Math.hypot(p.x * view.w - cx, p.y * view.h - cy) / view.unit;
        this.#patch({ radius: clamp(r, POINT_RADIUS.min, POINT_RADIUS.max) });
        break;
      }
      case 'start':
        this.#patch({ x0: u, y0: v });
        break;
      case 'end':
        this.#patch({ x1: u, y1: v });
        break;
      case 'move': {
        const du = u - drag.origin[0];
        const dv = v - drag.origin[1];
        const z = drag.zone;
        this.#patch({ x0: z.x0 + du, y0: z.y0 + dv, x1: z.x1 + du, y1: z.y1 + dv });
        break;
      }
      case 'paint':
        this.#extendStroke(u, v);
        break;
      default:
    }
  }

  pointerUp() {
    if (!this.drag) return;
    this.drag = null;
    if (this.flash) {
      this.flash = false;
      this.app.invalidate();
    }
    this.app.commit();
  }

  hover(p) {
    this.cursor = p;
    if (this.placing || this.selected?.type === 'brush') this.app.refreshOverlay();
  }

  #beginStroke([u, v], erase) {
    const stroke = {
      size: toSize(BRUSH_SIZE, this.brush.size),
      hardness: this.brush.hardness / 100,
      flow: this.brush.flow / 100,
      erase: this.brush.erase || erase,
      points: [u, v],
    };
    this.#patch({ strokes: [...this.selected.strokes, stroke] });
  }

  #extendStroke(u, v) {
    const { strokes } = this.selected;
    const last = strokes[strokes.length - 1];
    const n = last.points.length;
    const { width, height } = this.app.renderer.source;
    const long = Math.max(width, height);
    const dist = Math.hypot((u - last.points[n - 2]) * width, (v - last.points[n - 1]) * height) / long;
    if (dist < last.size * 0.2) return;
    this.#patch({ strokes: [...strokes.slice(0, -1), { ...last, points: [...last.points, u, v] }] });
  }

  keyDown(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) {
      this.#remove();
      return true;
    }
    if (e.key === 'Escape' && (this.placing || this.selectedId)) {
      this.placing = false;
      this.select(null);
      return true;
    }
    if (e.key.toLowerCase() === 'm' && this.selected) {
      this.showMask = !this.showMask;
      this.render();
      this.app.invalidate();
      return true;
    }
    if ((e.key === '[' || e.key === ']') && this.selected?.type === 'brush') {
      this.brush.size = clamp(this.brush.size + (e.key === ']' ? 5 : -5), 1, 100);
      this.render();
      this.app.refreshOverlay();
      return true;
    }
    return false;
  }
}

function section(title, content) {
  return h('section', { class: 'section' },
    title && h('h3', { class: 'section__title' }, title),
    h('div', { class: 'section__body' }, content));
}
