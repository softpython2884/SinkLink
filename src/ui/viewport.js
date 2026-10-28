import { clamp } from './dom.js';

// Displays the canvas fitted in the work area, handles zoom and pan, and routes
// pointer input to the active tool. Tools receive positions normalised to the
// displayed image (0…1, may fall outside while dragging).
export class Viewport {
  constructor(el, { getTool, onLayout }) {
    this.el = el;
    this.stage = el.querySelector('.stage');
    this.canvas = this.stage.querySelector('canvas');
    this.overlay = this.stage.querySelector('svg');
    this.getTool = getTool;
    this.onLayout = onLayout;

    this.width = 0;
    this.height = 0;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.fit = 1;
    this.scale = 1;
    this.displayWidth = 0;
    this.displayHeight = 0;
    this.spaceHeld = false;
    this.pointers = new Map();
    this.mode = null;

    new ResizeObserver(() => this.layout()).observe(el);
    el.addEventListener('pointerdown', (e) => this.#down(e));
    el.addEventListener('pointermove', (e) => this.#move(e));
    el.addEventListener('pointerup', (e) => this.#up(e));
    el.addEventListener('pointercancel', (e) => this.#up(e));
    el.addEventListener('pointerleave', (e) => {
      if (!this.pointers.size) this.getTool()?.hover?.(null, e);
    });
    el.addEventListener('wheel', (e) => this.#wheel(e), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get maxZoom() {
    return Math.max(2, 6 / this.fit);
  }

  setImageSize(width, height) {
    if (width === this.width && height === this.height) return;
    const reshaped = !this.width || Math.abs(width / height - this.width / this.height) > 1e-3;
    this.width = width;
    this.height = height;
    if (reshaped) this.reset();
    else this.layout();
  }

  reset() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.layout();
  }

  layout() {
    if (!this.width) return;
    const cw = this.el.clientWidth;
    const ch = this.el.clientHeight;
    const pad = Math.min(cw, ch) < 500 ? 12 : 32;
    this.fit = Math.max(1e-3, Math.min((cw - pad * 2) / this.width, (ch - pad * 2) / this.height));
    this.scale = this.fit * this.zoom;
    const w = this.width * this.scale;
    const h = this.height * this.scale;
    const limitX = Math.max(0, (w - cw) / 2 + pad);
    const limitY = Math.max(0, (h - ch) / 2 + pad);
    this.panX = clamp(this.panX, -limitX, limitX);
    this.panY = clamp(this.panY, -limitY, limitY);

    this.displayWidth = w;
    this.displayHeight = h;
    this.stage.style.width = `${w}px`;
    this.stage.style.height = `${h}px`;
    this.stage.style.transform = `translate3d(${(cw - w) / 2 + this.panX}px, ${(ch - h) / 2 + this.panY}px, 0)`;
    this.overlay.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.el.classList.toggle('is-zoomed', this.zoom > 1.001);
    this.onLayout?.();
  }

  zoomTo(zoom, clientX, clientY) {
    const rect = this.el.getBoundingClientRect();
    const cx = (clientX ?? rect.left + rect.width / 2) - rect.left - rect.width / 2;
    const cy = (clientY ?? rect.top + rect.height / 2) - rect.top - rect.height / 2;
    const next = clamp(zoom, 0.5, this.maxZoom);
    const k = next / this.zoom;
    this.panX = cx - (cx - this.panX) * k;
    this.panY = cy - (cy - this.panY) * k;
    this.zoom = next;
    this.layout();
  }

  zoomBy(factor) {
    this.zoomTo(this.zoom * factor);
  }

  // Zoom so that one image pixel covers one CSS pixel.
  actualPixels() {
    this.zoomTo(1 / this.fit);
  }

  toImage(clientX, clientY) {
    const rect = this.stage.getBoundingClientRect();
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  }

  #down(e) {
    if (!this.width) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.el.setPointerCapture(e.pointerId);

    if (this.pointers.size === 2) {
      if (this.mode === 'tool') this.getTool()?.pointerUp?.(this.toImage(e.clientX, e.clientY), e);
      const [a, b] = [...this.pointers.values()];
      this.mode = 'pinch';
      this.pinch = {
        distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        zoom: this.zoom,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      return;
    }
    if (this.pointers.size > 2) return;

    const tool = this.getTool();
    const wantsPan = e.button === 1 || e.button === 2 || this.spaceHeld;
    if (!wantsPan && tool?.pointerDown?.(this.toImage(e.clientX, e.clientY), e)) {
      this.mode = 'tool';
    } else {
      this.mode = 'pan';
      this.last = { x: e.clientX, y: e.clientY };
      this.el.classList.add('is-panning');
    }
  }

  #move(e) {
    const pointer = this.pointers.get(e.pointerId);
    if (!pointer) {
      if (this.width) this.getTool()?.hover?.(this.toImage(e.clientX, e.clientY), e);
      return;
    }
    pointer.x = e.clientX;
    pointer.y = e.clientY;

    if (this.mode === 'pinch') {
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.panX += mid.x - this.pinch.mid.x;
      this.panY += mid.y - this.pinch.mid.y;
      this.pinch.mid = mid;
      this.zoomTo((this.pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / this.pinch.distance, mid.x, mid.y);
    } else if (this.mode === 'pan') {
      this.panX += e.clientX - this.last.x;
      this.panY += e.clientY - this.last.y;
      this.last = { x: e.clientX, y: e.clientY };
      this.layout();
    } else if (this.mode === 'tool') {
      const tool = this.getTool();
      const events = e.getCoalescedEvents?.() ?? [];
      for (const ev of events.length ? events : [e]) {
        tool?.pointerMove?.(this.toImage(ev.clientX, ev.clientY), ev);
      }
    }
  }

  #up(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.mode === 'tool') this.getTool()?.pointerUp?.(this.toImage(e.clientX, e.clientY), e);
    if (this.mode === 'pinch' && this.pointers.size === 1) {
      const [rest] = this.pointers.values();
      this.mode = 'pan';
      this.last = { x: rest.x, y: rest.y };
      return;
    }
    if (!this.pointers.size) {
      this.mode = null;
      this.el.classList.remove('is-panning');
    }
  }

  #wheel(e) {
    if (!this.width) return;
    e.preventDefault();
    const speed = e.ctrlKey ? 0.01 : e.deltaMode === 1 ? 0.05 : 0.0015;
    this.zoomTo(this.zoom * Math.exp(-e.deltaY * speed), e.clientX, e.clientY);
  }
}
