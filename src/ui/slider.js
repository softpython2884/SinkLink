import { formatSigned, h } from './dom.js';

// Labelled range input. The fill starts from the default value, so a bipolar
// slider shows at a glance in which direction it has been pushed.
// Double-click resets to the default.
export function createSlider(options) {
  const {
    label,
    min = -100,
    max = 100,
    step = 1,
    value = 0,
    defaultValue = 0,
    format,
    track,
    onInput,
    onChange,
    onFocus,
  } = options;

  const input = h('input', { type: 'range', min, max, step, value, 'aria-label': label });
  const output = h('output', { class: 'slider__value' });
  const el = h(
    'div',
    { class: `slider${track ? ` slider--${track}` : ''}` },
    h('div', { class: 'slider__head' }, h('span', { class: 'slider__label' }, label), output),
    input,
  );

  const display = format ?? ((v) => (min < 0 ? formatSigned(v) : String(Math.round(v))));
  const origin = (Math.min(max, Math.max(min, defaultValue)) - min) / (max - min);

  const paint = (v) => {
    output.textContent = display(v);
    const pos = (v - min) / (max - min);
    el.style.setProperty('--from', `${Math.min(pos, origin) * 100}%`);
    el.style.setProperty('--to', `${Math.max(pos, origin) * 100}%`);
    el.classList.toggle('is-changed', v !== defaultValue);
  };

  input.addEventListener('input', () => {
    const v = Number(input.value);
    paint(v);
    onInput?.(v);
  });
  input.addEventListener('change', () => onChange?.(Number(input.value)));
  input.addEventListener('focus', () => onFocus?.());
  el.addEventListener('dblclick', () => {
    input.value = defaultValue;
    paint(defaultValue);
    onInput?.(defaultValue);
    onChange?.(defaultValue);
  });

  paint(value);

  return {
    el,
    input,
    set(v) {
      if (Number(input.value) !== v) input.value = v;
      paint(v);
    },
    setActive(active) {
      el.classList.toggle('is-active', active);
    },
  };
}
