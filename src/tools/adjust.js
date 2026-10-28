import { Tool } from './tool.js';
import { createSlider } from '../ui/slider.js';
import { clamp, formatSigned, h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { getIn, setIn } from '../state/path.js';
import { DEFAULT_EDIT } from '../state/defaults.js';

// A panel of sliders described by a spec:
//
//   { id, label, icon, actions?, sections: [{ title, controls: [...] }] }
//
// Controls are sliders by default ({ path, label, min, max, step, track }),
// or { type: 'choice' } chips, or { type: 'presets' } that set several values.
// `path` may be a function when the target depends on the panel state.
//
// Like in Snapseed, dragging horizontally on the photo changes the focused
// slider and dragging vertically picks another one.
export class AdjustTool extends Tool {
  constructor(app, spec) {
    super(app, spec);
    this.spec = spec;
    this.sliders = [];
    this.chips = [];
    this.focus = 0;
    this.drag = null;
  }

  pathOf(control) {
    return typeof control.path === 'function' ? control.path() : control.path;
  }

  mount(el) {
    const { spec } = this;
    this.sliders = [];
    this.chips = [];
    if (spec.actions?.length) {
      el.append(
        h('div', { class: 'panel__actions' },
          spec.actions.map((action) =>
            h('button', { class: 'btn btn--soft', type: 'button', onClick: () => action.run(this.app) },
              h('span', { html: icon(action.icon) }), action.label),
          ),
        ),
      );
    }
    const header = this.header?.();
    if (header) el.append(header);
    for (const section of spec.sections) {
      el.append(
        h('section', { class: 'section' },
          section.title && h('h3', { class: 'section__title' }, section.title),
          h('div', { class: 'section__body' }, section.controls.map((c) => this.#control(c))),
        ),
      );
    }
    if (this.sliders.length) {
      el.append(h('p', { class: 'hint' },
        'Astuce : glissez horizontalement sur la photo pour régler le curseur actif, verticalement pour en choisir un autre.'));
    }
    if (this.focus >= this.sliders.length) this.focus = 0;
    this.#highlight();
    this.sync(this.app.edit);
  }

  #control(control) {
    if (control.type === 'choice') return this.#choice(control);
    if (control.type === 'presets') return this.#presets(control);

    const index = this.sliders.length;
    const { min = -100, max = 100, step = 1 } = control;
    const path = this.pathOf(control);
    const slider = createSlider({
      label: control.label,
      min,
      max,
      step,
      track: control.track,
      format: control.format,
      value: getIn(this.app.edit, path),
      defaultValue: getIn(DEFAULT_EDIT, path),
      onInput: (v) => {
        this.focus = index;
        this.#highlight();
        this.app.set(this.pathOf(control), v);
      },
      onChange: () => this.app.commit(),
      onFocus: () => {
        this.focus = index;
        this.#highlight();
      },
    });
    this.sliders.push({ control, slider });
    return slider.el;
  }

  #choice(control) {
    const buttons = control.options.map((option) =>
      h('button', {
        class: 'chip',
        type: 'button',
        onClick: () => {
          const edit = this.app.edit;
          const next = control.apply
            ? control.apply(edit, option.value)
            : setIn(edit, this.pathOf(control), option.value);
          this.app.replace(next);
          this.app.commit();
        },
      }, option.label),
    );
    this.chips.push({
      update: (edit) => {
        const current = getIn(edit, this.pathOf(control));
        buttons.forEach((b, i) => b.classList.toggle('is-active', control.options[i].value === current));
      },
    });
    return h('div', { class: 'field' },
      control.label && h('span', { class: 'field__label' }, control.label),
      h('div', { class: 'chips' }, buttons));
  }

  #presets(control) {
    const buttons = control.options.map((option) =>
      h('button', {
        class: 'chip',
        type: 'button',
        onClick: () => {
          const edit = this.app.edit;
          this.app.replace({ ...edit, [control.section]: { ...edit[control.section], ...option.values } });
          this.app.commit();
        },
      }, option.label),
    );
    this.chips.push({
      update: (edit) => {
        const section = edit[control.section];
        buttons.forEach((b, i) => {
          const values = control.options[i].values;
          b.classList.toggle('is-active', Object.entries(values).every(([k, v]) => section[k] === v));
        });
      },
    });
    return h('div', { class: 'field' },
      control.label && h('span', { class: 'field__label' }, control.label),
      h('div', { class: 'chips' }, buttons));
  }

  sync(edit) {
    for (const { control, slider } of this.sliders) slider.set(getIn(edit, this.pathOf(control)));
    for (const chip of this.chips) chip.update(edit);
  }

  #highlight() {
    this.sliders.forEach(({ slider }, i) => slider.setActive(i === this.focus));
  }

  #format(control, value) {
    if (control.format) return control.format(value);
    return (control.min ?? -100) < 0 ? formatSigned(value) : String(Math.round(value));
  }

  pointerDown(p, e) {
    if (!this.sliders.length || e.button !== 0) return false;
    const { control } = this.sliders[this.focus];
    this.drag = {
      x: e.clientX,
      y: e.clientY,
      axis: null,
      focus: this.focus,
      start: getIn(this.app.edit, this.pathOf(control)),
    };
    return true;
  }

  pointerMove(p, e) {
    const drag = this.drag;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.axis) {
      if (Math.hypot(dx, dy) < 6) return;
      drag.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    }

    if (drag.axis === 'x') {
      const { control } = this.sliders[this.focus];
      const { min = -100, max = 100, step = 1 } = control;
      const width = Math.min(this.app.view.el.clientWidth, 900);
      const raw = drag.start + (dx / width) * (max - min) * 0.9;
      const value = clamp(Math.round(raw / step) * step, min, max);
      this.app.set(this.pathOf(control), value);
      this.app.hud.show(control.label, this.#format(control, value));
    } else {
      this.focus = clamp(drag.focus + Math.round(dy / 30), 0, this.sliders.length - 1);
      this.#highlight();
      const edit = this.app.edit;
      this.app.hud.list(
        this.sliders.map(({ control }) => ({
          label: control.label,
          value: this.#format(control, getIn(edit, this.pathOf(control))),
        })),
        this.focus,
      );
    }
  }

  pointerUp() {
    if (this.drag?.axis === 'x') this.app.commit();
    if (this.drag?.axis === 'y') this.sliders[this.focus]?.slider.el.scrollIntoView({ block: 'nearest' });
    this.drag = null;
    this.app.hud.hide();
  }
}
