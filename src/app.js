import { Store } from './state/store.js';
import { DEFAULT_EDIT } from './state/defaults.js';
import { setIn } from './state/path.js';
import { Renderer } from './render/renderer.js';
import { apply, outputGeometry } from './render/geometry.js';
import { Viewport } from './ui/viewport.js';
import { Hud, toast } from './ui/feedback.js';
import { Histogram } from './ui/histogram.js';
import { h, isTyping } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { createTools } from './tools/index.js';
import { PREVIEW_SIZE, isImageFile, loadImage } from './image/loader.js';
import { EXPORT_FORMATS, download, exportImage } from './image/exporter.js';
import { imageStats } from './edit/analysis.js';
import { autoTune } from './edit/auto.js';

export class App {
  constructor(root) {
    this.root = root;
    this.store = new Store(DEFAULT_EDIT);
    this.image = null;
    this.stats = null;
    this.comparing = false;
    this.frame = 0;

    this.renderer = new Renderer(root.querySelector('.stage canvas'));
    this.view = new Viewport(root.querySelector('.viewport'), {
      getTool: () => (this.image ? this.tool : null),
      onLayout: () => {
        this.refreshOverlay();
        this.#updateZoomLabel();
      },
    });
    this.hud = new Hud(root.querySelector('.hud'));
    this.histogram = new Histogram(root.querySelector('.histogram'));
    this.tools = createTools(this);
    this.tool = null;

    this.#buildNav();
    this.#bindToolbar();
    this.#bindFiles();
    this.#bindKeyboard();
    this.#bindExport();

    this.store.subscribe(() => {
      this.invalidate();
      this.tool?.sync(this.edit);
      this.#updateHistoryButtons();
    });
    window.addEventListener('beforeunload', (e) => {
      if (this.image && this.store.dirty) e.preventDefault();
    });
    root.querySelector('.stage canvas').addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      toast('Le contexte graphique a été perdu, rechargez la page.', { tone: 'error', timeout: 8000 });
    });

    this.setTool('looks');
    this.#updateHistoryButtons();
  }

  get edit() {
    return this.store.state;
  }

  set(path, value) {
    this.store.set(setIn(this.edit, path, value));
  }

  replace(edit) {
    this.store.set(edit);
  }

  commit() {
    this.store.commit();
  }

  // ---- tools ---------------------------------------------------------------

  #buildNav() {
    const nav = this.root.querySelector('.tools');
    this.navButtons = new Map();
    for (const tool of this.tools) {
      const button = h('button', {
        class: 'tool',
        type: 'button',
        title: tool.label,
        onClick: () => this.setTool(tool.id),
      }, h('span', { html: icon(tool.icon) }), h('span', { class: 'tool__label' }, tool.label));
      this.navButtons.set(tool.id, button);
      nav.append(button);
    }
  }

  setTool(id) {
    const tool = this.tools.find((t) => t.id === id);
    if (!tool || (tool === this.tool && this.mountedFor === this.image)) return;
    this.store.commit();
    this.tool?.unmount();
    this.hud.hide();
    this.tool = tool;
    for (const [toolId, button] of this.navButtons) {
      button.classList.toggle('is-active', toolId === id);
      button.setAttribute('aria-pressed', String(toolId === id));
    }
    this.root.querySelector('.panel__title').textContent = tool.label;
    const body = this.root.querySelector('.panel__body');
    body.replaceChildren();
    this.root.querySelector('.panel').scrollTop = 0;
    this.mountedFor = this.image;
    if (this.image) tool.mount(body);
    else body.append(h('p', { class: 'hint' }, 'Ouvrez une photo pour commencer.'));
    this.invalidate();
    this.refreshOverlay();
  }

  autoTune() {
    if (!this.stats) return;
    this.replace({ ...this.edit, tune: { ...this.edit.tune, ...autoTune(this.stats) } });
    this.commit();
    toast('Correction automatique appliquée.');
  }

  // ---- rendering -----------------------------------------------------------

  invalidate() {
    if (!this.image || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.#draw();
    });
  }

  #draw() {
    const options = { ...this.tool.renderOptions(), original: this.comparing };
    const { width, height } = this.renderer.render(this.edit, options);
    this.view.setImageSize(width, height);
    this.refreshOverlay();
    this.#scheduleHistogram();
  }

  // Mapping helpers handed to tools for drawing handles and reading positions.
  viewContext() {
    const geometry = this.renderer.geometry(this.edit, this.tool.renderOptions());
    const { displayWidth: w, displayHeight: h, scale } = this.view;
    const { width, height } = this.renderer.source;
    return {
      w,
      h,
      geometry,
      unit: Math.max(width, height) * geometry.scale * scale,
      toSource: (p) => apply(geometry.toSource, p.x, p.y),
      toScreen: (u, v) => {
        const [x, y] = apply(geometry.fromSource, u, v);
        return [x * w, y * h];
      },
    };
  }

  refreshOverlay() {
    if (!this.image || !this.view.displayWidth) return;
    this.view.overlay.innerHTML = this.comparing ? '' : this.tool.overlay(this.viewContext());
  }

  #scheduleHistogram() {
    clearTimeout(this.histogramTimer);
    this.histogramTimer = setTimeout(() => {
      if (!this.image) return;
      this.histogram.update(this.renderer.renderPixels(this.edit, { maxSize: 320 }));
      if (this.tool.id === 'curves') this.tool.sync(this.edit);
    }, 150);
  }

  setComparing(on) {
    if (this.comparing === on || !this.image) return;
    this.comparing = on;
    this.root.classList.toggle('is-comparing', on);
    this.invalidate();
  }

  // ---- files ---------------------------------------------------------------

  async open(file) {
    if (!isImageFile(file)) {
      toast('Ce fichier n’est pas une image prise en charge (JPEG, PNG, WebP, AVIF…).', { tone: 'error' });
      return;
    }
    if (this.image && this.store.dirty && !window.confirm('Abandonner les retouches en cours ?')) return;

    this.root.classList.add('is-loading');
    try {
      const previewSize = Math.min(PREVIEW_SIZE, this.renderer.maxTextureSize);
      const image = await loadImage(file, { previewSize });
      this.image?.bitmap.close?.();
      this.image = image;
      this.stats = imageStats(image.analysis);
      this.renderer.setSource(image.preview);
      this.store.reset(DEFAULT_EDIT);
      this.root.classList.add('has-image');
      this.root.querySelector('.file-name').textContent = `${file.name} · ${image.width} × ${image.height}`;
      this.view.width = 0;
      this.setTool(this.tool.id);
      this.invalidate();
    } catch (error) {
      console.error(error);
      toast('Impossible d’ouvrir cette image.', { tone: 'error' });
    } finally {
      this.root.classList.remove('is-loading');
    }
  }

  #bindFiles() {
    this.fileInput = this.root.querySelector('input[type="file"]');
    this.fileInput.addEventListener('change', () => {
      const [file] = this.fileInput.files;
      if (file) this.open(file);
      this.fileInput.value = '';
    });

    let depth = 0;
    window.addEventListener('dragenter', (e) => {
      if (![...e.dataTransfer.types].includes('Files')) return;
      depth++;
      this.root.classList.add('is-dragging');
    });
    window.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (!depth) this.root.classList.remove('is-dragging');
    });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      depth = 0;
      this.root.classList.remove('is-dragging');
      const file = [...e.dataTransfer.files].find(isImageFile) ?? e.dataTransfer.files[0];
      if (file) this.open(file);
    });
    window.addEventListener('paste', (e) => {
      const file = [...(e.clipboardData?.files ?? [])].find(isImageFile);
      if (file) this.open(file);
    });
  }

  // ---- chrome --------------------------------------------------------------

  #bindToolbar() {
    const on = (action, handler) =>
      this.root.querySelectorAll(`[data-action="${action}"]`).forEach((el) => el.addEventListener('click', handler));
    on('open', () => this.fileInput.click());
    on('undo', () => this.store.undo());
    on('redo', () => this.store.redo());
    on('export', () => this.openExport());
    on('zoom-in', () => this.view.zoomBy(1.25));
    on('zoom-out', () => this.view.zoomBy(0.8));
    on('zoom-fit', () => this.view.reset());

    const compare = this.root.querySelector('[data-action="compare"]');
    compare.addEventListener('pointerdown', (e) => {
      compare.setPointerCapture(e.pointerId);
      this.setComparing(true);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      compare.addEventListener(type, () => this.setComparing(false));
    }
  }

  #updateHistoryButtons() {
    this.root.querySelector('[data-action="undo"]').disabled = !this.store.canUndo;
    this.root.querySelector('[data-action="redo"]').disabled = !this.store.canRedo;
  }

  #updateZoomLabel() {
    if (!this.image) return;
    const ratio = this.renderer.source ? this.image.width / this.renderer.source.width : 1;
    const percent = Math.round((this.view.scale / ratio) * 100);
    this.root.querySelector('[data-action="zoom-fit"]').textContent = `${percent} %`;
  }

  #bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (isTyping(e) || this.exportDialog.open) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'o') {
        e.preventDefault();
        this.fileInput.click();
        return;
      }
      if (!this.image) return;
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.store.redo();
        else this.store.undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        this.store.redo();
      } else if (mod && (key === 's' || key === 'e')) {
        e.preventDefault();
        this.openExport();
      } else if (mod || e.altKey) {
        // Leave other shortcuts to the browser.
      } else if (this.tool.keyDown(e)) {
        e.preventDefault();
      } else if (e.key === ' ') {
        e.preventDefault();
        this.view.spaceHeld = true;
        this.root.classList.add('is-space');
      } else if (key === 'c') {
        this.setComparing(true);
      } else if (key === '0' || key === 'f') {
        this.view.reset();
      } else if (key === '1') {
        this.view.actualPixels();
      } else if (key === '+' || key === '=') {
        this.view.zoomBy(1.25);
      } else if (key === '-') {
        this.view.zoomBy(0.8);
      }
    });
    const release = () => {
      this.view.spaceHeld = false;
      this.root.classList.remove('is-space');
    };
    window.addEventListener('keyup', (e) => {
      if (e.key === ' ') release();
      if (e.key.toLowerCase() === 'c') this.setComparing(false);
    });
    window.addEventListener('blur', () => {
      release();
      this.setComparing(false);
    });
  }

  // ---- export --------------------------------------------------------------

  #bindExport() {
    const dialog = document.querySelector('.export-dialog');
    const form = dialog.querySelector('form');
    const quality = form.elements.quality;
    const qualityValue = dialog.querySelector('.export__quality-value');
    this.exportDialog = dialog;

    const refresh = () => {
      const lossy = EXPORT_FORMATS[form.elements.format.value].lossy;
      dialog.querySelector('.export__quality').hidden = !lossy;
      qualityValue.textContent = `${quality.value} %`;
      const { width, height } = this.#exportSize(form.elements.size.value);
      dialog.querySelector('.export__dimensions').textContent = `${width} × ${height} px`;
    };
    form.addEventListener('input', refresh);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (e.submitter?.value === 'cancel') {
        dialog.close();
        return;
      }
      const button = form.querySelector('button[value="export"]');
      button.disabled = true;
      dialog.classList.add('is-busy');
      try {
        await new Promise((resolve) => setTimeout(resolve, 30));
        const size = form.elements.size.value;
        const result = await exportImage(this.image, this.edit, {
          format: form.elements.format.value,
          quality: Number(quality.value) / 100,
          maxSize: size === 'full' ? Infinity : Number(size),
        });
        download(result.blob, result.filename);
        dialog.close();
        toast(`Photo exportée (${result.width} × ${result.height}).`);
      } catch (error) {
        console.error(error);
        toast('L’export a échoué. Essayez une taille plus petite.', { tone: 'error' });
      } finally {
        button.disabled = false;
        dialog.classList.remove('is-busy');
      }
    });
    this.refreshExport = refresh;
  }

  #exportSize(size) {
    const { width, height } = outputGeometry(this.edit.crop, this.image.width, this.image.height);
    const limit = size === 'full' ? Infinity : Number(size);
    const scale = Math.min(1, limit / Math.max(width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
  }

  openExport() {
    if (!this.image) return;
    this.commit();
    this.refreshExport();
    this.exportDialog.showModal();
  }
}
