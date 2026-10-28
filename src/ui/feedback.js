import { h } from './dom.js';

// Value read-out shown over the photo while adjusting with a drag gesture.
export class Hud {
  constructor(el) {
    this.el = el;
  }

  show(label, value) {
    this.el.className = 'hud is-visible';
    this.el.replaceChildren(
      h('span', { class: 'hud__label' }, label),
      h('span', { class: 'hud__value' }, value),
    );
  }

  list(items, active) {
    this.el.className = 'hud hud--list is-visible';
    this.el.replaceChildren(
      ...items.map(({ label, value }, i) =>
        h('div', { class: `hud__row${i === active ? ' is-active' : ''}` },
          h('span', { class: 'hud__label' }, label),
          h('span', { class: `hud__value${value === '0' ? ' is-zero' : ''}` }, value),
        ),
      ),
    );
  }

  hide() {
    this.el.classList.remove('is-visible');
  }
}

let region;

export function toast(message, { tone = 'info', timeout = 3200 } = {}) {
  region ??= document.body.appendChild(h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }));
  const el = h('div', { class: `toast toast--${tone}` }, message);
  region.append(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 300);
  }, timeout);
}
