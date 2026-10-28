const PROPERTIES = new Set(['value', 'checked', 'disabled', 'title', 'type']);

// Small hyperscript helper: h('button', { class: 'btn', onClick }, 'Label').
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') {
      el.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      for (const [prop, v] of Object.entries(value)) el.style.setProperty(prop, v);
    } else if (key === 'html') {
      el.innerHTML = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (PROPERTIES.has(key)) {
      el[key] = value;
    } else {
      el.setAttribute(key, value === true ? '' : value);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else el.append(child instanceof Node ? child : String(child));
  }
}

export function clear(el) {
  el.replaceChildren();
  return el;
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function formatSigned(value, digits = 0) {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return '0';
  return rounded > 0 ? `+${rounded.toFixed(digits)}` : `−${Math.abs(rounded).toFixed(digits)}`;
}

export function isTyping(event) {
  const el = event.target;
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
    && !(el instanceof HTMLInputElement && el.type === 'range');
}
