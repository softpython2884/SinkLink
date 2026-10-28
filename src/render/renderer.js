// Rendering pipeline.
//
//   source ─ heal ─┬──────────── develop ── local × N ── [stencil] ─┬────── output ─ canvas / pixels
//                  └ blur S/M/L ─┘                                 └ [lens blur] ┘
//
// The source and its blurred copies only change with the image or the healing
// spots. Moving a slider re-runs everything from develop on.
import {
  Program,
  createImageTexture,
  createTarget,
  createTexture,
  disposeTarget,
  generateMipmaps,
} from './gl.js';
import * as glsl from './shaders.js';
import {
  MAX_HEAL_SPOTS,
  developUniforms,
  healUniforms,
  lensIsActive,
  localUniforms,
  outputUniforms,
  stencilUniforms,
  zoneIsNeutral,
} from './uniforms.js';
import { outputGeometry } from './geometry.js';
import { buildCurveLut } from '../edit/curves.js';
import { MaskCache } from './masks.js';

// Blur radius as a fraction of the long side, and the radius in pixels at which
// each level is computed (the working copy is downscaled to match).
const BLUR_LEVELS = [
  { name: 'uBlurS', sigma: 0.0025, pixels: 4 },
  { name: 'uBlurM', sigma: 0.012, pixels: 8 },
  { name: 'uBlurL', sigma: 0.05, pixels: 8 },
];

// Lens blur: a light and a strong level, mixed according to the focus mask.
const LENS_LEVELS = [
  { name: 'uLensNear', sigma: 0.004, pixels: 4 },
  { name: 'uLensFar', sigma: 0.014, pixels: 6 },
];

export class Renderer {
  constructor(canvas, { highPrecision = true, maskSize = 1536 } = {}) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 n’est pas disponible sur ce navigateur.');

    this.gl = gl;
    this.canvas = canvas;
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.precision = highPrecision && this.#supportsHalfFloat() ? 'half' : 'byte';

    this.vao = gl.createVertexArray();
    this.programs = {
      copy: new Program(gl, glsl.VERTEX, glsl.COPY),
      blur: new Program(gl, glsl.VERTEX, glsl.BLUR),
      heal: new Program(gl, glsl.VERTEX, glsl.HEAL),
      develop: new Program(gl, glsl.VERTEX, glsl.DEVELOP),
      local: new Program(gl, glsl.VERTEX, glsl.LOCAL),
      output: new Program(gl, glsl.VERTEX, glsl.OUTPUT),
      bokeh: new Program(gl, glsl.VERTEX, glsl.BOKEH),
      maxPool: new Program(gl, glsl.VERTEX, glsl.MAX_POOL),
      stencil: new Program(gl, glsl.VERTEX, glsl.STENCIL),
    };
    this.curve = { key: null, texture: createTexture(gl, { width: 256, height: 1 }) };
    this.emptyMask = createTexture(gl, { width: 1, height: 1, data: new Uint8Array(4) });
    this.masks = new MaskCache(gl, maskSize);
    this.targets = new Map();
    this.scratch = new Map();
    this.source = null;
    this.prepared = null;
  }

  #supportsHalfFloat() {
    const { gl } = this;
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) {
      return false;
    }
    const probe = createTarget(gl, 4, 4, 'half');
    disposeTarget(gl, probe);
    return probe !== null;
  }

  setSource(image) {
    this.#releasePrepared();
    if (this.source) this.gl.deleteTexture(this.source.texture);
    this.masks.clear();
    this.source = {
      texture: createImageTexture(this.gl, image, { mipmaps: true }),
      width: image.width,
      height: image.height,
    };
  }

  geometry(edit, { frame = false, raw = false } = {}) {
    return outputGeometry(edit.crop, this.source.width, this.source.height, { frame, raw });
  }

  // Draws to the canvas, resizing it to the output size when needed.
  render(edit, options = {}) {
    const geometry = this.geometry(edit, options);
    const width = Math.max(1, Math.round(geometry.width));
    const height = Math.max(1, Math.round(geometry.height));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.#draw(edit, geometry, null, width, height, 1, options);
    return { width, height };
  }

  // Renders into memory, rows top-first. `maxSize` caps the long side.
  renderPixels(edit, { maxSize = Infinity, ...options } = {}) {
    const { gl } = this;
    const geometry = this.geometry(edit, options);
    const scale = Math.min(1, maxSize / Math.max(geometry.width, geometry.height));
    const width = Math.max(1, Math.round(geometry.width * scale));
    const height = Math.max(1, Math.round(geometry.height * scale));
    const target = this.#target(width, height, 'byte');
    try {
      this.#draw(edit, geometry, target, width, height, scale, options);
      const data = new Uint8ClampedArray(width * height * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { width, height, data };
    } finally {
      disposeTarget(gl, target);
    }
  }

  #draw(edit, geometry, target, width, height, scale, { original = false, raw = false, maskZone = null }) {
    const { source } = this;
    const prepared = this.#prepare(edit.heal);
    let result = null;
    let processWidth = source.width;
    let processHeight = source.height;

    if (!original) {
      processWidth = Math.max(1, Math.round(source.width * scale));
      processHeight = Math.max(1, Math.round(source.height * scale));
      const [a, b] = this.#processTargets(processWidth, processHeight);
      this.#updateCurve(edit.curves);
      this.#pass(this.programs.develop, a, developUniforms(edit), {
        uSrc: prepared.base,
        ...prepared.blurs,
        uCurve: this.curve.texture,
      });

      const aspect = this.#aspect();
      let current = a;
      let spare = b;
      this.masks.prune(new Set(edit.zones.map((z) => z.id)));
      for (const zone of edit.zones) {
        const showMask = zone.id === maskZone;
        if (zoneIsNeutral(zone) && !showMask) continue;
        const mask = zone.type === 'brush'
          ? this.masks.texture(zone, source.width, source.height)
          : this.emptyMask;
        this.#pass(this.programs.local, spare, localUniforms(zone, aspect, showMask), {
          uImage: current.texture,
          uSrc: prepared.base,
          uBlurS: prepared.blurs.uBlurS,
          uBlurM: prepared.blurs.uBlurM,
          uMask: mask,
        });
        [current, spare] = [spare, current];
      }
      if (edit.stencil.enabled && !raw) {
        [current, spare] = [this.#stencil(edit.stencil, current, spare), current];
      }
      result = current.texture;
    }

    const lens = !original && lensIsActive(edit)
      ? this.#lensBlur(result, edit.lens, processWidth, processHeight)
      : { uLensNear: this.emptyMask, uLensFar: this.emptyMask };

    // Sharpening radius follows the image size so the preview matches the export.
    const radius = Math.max(1, Math.max(processWidth, processHeight) / 2048);
    this.#pass(this.programs.output, target, outputUniforms(edit, {
      flipY: !target,
      original,
      width,
      height,
      texel: [radius / processWidth, radius / processHeight],
      geometry,
    }), {
      uImage: result ?? source.texture,
      uSrc: source.texture,
      ...lens,
    }, width, height);
  }

  // Line art: smooth, estimate the skin brightness with a max-pool pyramid, then
  // threshold the luminance relative to it.
  #stencil(settings, current, spare) {
    const { width, height } = current;
    const long = Math.max(width, height);
    let image = current;
    const sigma = (settings.smoothing / 100) * 0.0025 * long;
    if (sigma >= 0.5) {
      const smooth = this.#scratchTarget('stencil-smooth', width, height);
      this.#blur(current, spare, smooth, sigma);
      image = smooth;
    }

    let input = image;
    let local = null;
    let level = 0;
    while (Math.max(input.width, input.height) > 1) {
      const w = Math.max(1, Math.ceil(input.width / 4));
      const h = Math.max(1, Math.ceil(input.height / 4));
      const pooled = this.#scratchTarget(`stencil-pool-${level++}`, w, h);
      this.#pass(this.programs.maxPool, pooled, { uTexel: [1 / input.width, 1 / input.height] }, { uTex: input.texture });
      if (!local && Math.max(w, h) <= 32) local = pooled;
      input = pooled;
    }
    local ??= input;
    const smoothLocal = this.#scratchTarget('stencil-local', local.width, local.height);
    const temp = this.#scratchTarget('stencil-local-temp', local.width, local.height);
    this.#blur(local, temp, smoothLocal, 1.2);

    this.#pass(this.programs.stencil, spare, stencilUniforms(settings, [1 / width, 1 / height]), {
      uImage: image.texture,
      uLocal: smoothLocal.texture,
      uGlobal: input.texture,
    });
    return spare;
  }

  #lensBlur(texture, lens, processWidth, processHeight) {
    const long = Math.max(processWidth, processHeight);
    const textures = {};
    for (const level of LENS_LEVELS) {
      const workLong = Math.min(long, Math.round(level.pixels / level.sigma));
      const w = Math.max(1, Math.round((processWidth * workLong) / long));
      const h = Math.max(1, Math.round((processHeight * workLong) / long));
      const a = this.#scratchTarget(`${level.name}-a`, w, h);
      const b = this.#scratchTarget(`${level.name}-b`, w, h);
      this.#pass(this.programs.bokeh, a, { uBoost: lens.bokeh / 100 }, { uTex: texture });
      this.#blur(a, b, a, Math.max(0.5, level.sigma * workLong));
      textures[level.name] = a.texture;
    }
    return textures;
  }

  // Separable gaussian: source → temp (horizontal) → destination (vertical).
  #blur(source, temp, destination, sigma) {
    this.#pass(this.programs.blur, temp, { uStep: [1 / temp.width, 0], uSigma: sigma }, { uTex: source.texture });
    this.#pass(this.programs.blur, destination, { uStep: [0, 1 / destination.height], uSigma: sigma }, { uTex: temp.texture });
  }

  // Intermediate buffers reused from one frame to the next.
  #scratchTarget(name, width, height) {
    const key = `${name}:${width}x${height}`;
    let target = this.scratch.get(key);
    if (!target) {
      target = this.#target(width, height);
      this.scratch.set(key, target);
      while (this.scratch.size > 48) {
        const [oldest, stale] = this.scratch.entries().next().value;
        disposeTarget(this.gl, stale);
        this.scratch.delete(oldest);
      }
    }
    return target;
  }

  #aspect() {
    const { width, height } = this.source;
    const long = Math.max(width, height);
    return [width / long, height / long];
  }

  #pass(program, target, uniforms, textures, width, height) {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);
    gl.viewport(0, 0, target ? target.width : width, target ? target.height : height);
    program.use(uniforms, textures);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Half float when possible, 8 bits when the driver refuses (large exports).
  #target(width, height, format = this.precision) {
    const target = createTarget(this.gl, width, height, format)
      ?? (format === 'byte' ? null : createTarget(this.gl, width, height, 'byte'));
    if (!target) throw new Error(`Impossible d’allouer une image de ${width} × ${height} px.`);
    return target;
  }

  #processTargets(width, height) {
    const key = `${width}x${height}`;
    let pair = this.targets.get(key);
    if (!pair) {
      pair = [0, 1].map(() => this.#target(width, height));
      this.targets.set(key, pair);
      // Keep the preview size and one or two transient sizes (thumbnails, histogram).
      while (this.targets.size > 3) {
        const [oldest] = this.targets.keys();
        this.targets.get(oldest).forEach((t) => disposeTarget(this.gl, t));
        this.targets.delete(oldest);
      }
    }
    return pair;
  }

  #updateCurve(curves) {
    if (this.curve.key === curves) return;
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, this.curve.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, buildCurveLut(curves));
    this.curve.key = curves;
  }

  // Healing and blurs, cached for as long as the spots do not change.
  #prepare(heal) {
    if (this.prepared?.heal === heal) return this.prepared;
    this.#releasePrepared();
    const { gl, source } = this;
    const owned = [];
    let base = source.texture;

    if (heal.length) {
      let input = source.texture;
      for (let i = 0; i < heal.length; i += MAX_HEAL_SPOTS) {
        const target = this.#target(source.width, source.height, 'byte');
        this.#pass(
          this.programs.heal,
          target,
          healUniforms(heal.slice(i, i + MAX_HEAL_SPOTS), this.#aspect(), Math.max(source.width, source.height)),
          { uTex: input },
        );
        generateMipmaps(gl, target.texture);
        owned.push(target);
        input = target.texture;
      }
      base = input;
    }

    const long = Math.max(source.width, source.height);
    const blurs = {};
    for (const level of BLUR_LEVELS) {
      const workLong = Math.min(long, Math.round(level.pixels / level.sigma));
      const w = Math.max(1, Math.round((source.width * workLong) / long));
      const h = Math.max(1, Math.round((source.height * workLong) / long));
      const sigma = Math.max(0.5, level.sigma * workLong);
      const a = this.#target(w, h);
      const b = this.#target(w, h);
      this.#pass(this.programs.copy, a, {}, { uTex: base });
      this.#blur(a, b, a, sigma);
      disposeTarget(gl, b);
      owned.push(a);
      blurs[level.name] = a.texture;
    }

    this.prepared = { heal, base, blurs, owned };
    return this.prepared;
  }

  #releasePrepared() {
    this.prepared?.owned.forEach((t) => disposeTarget(this.gl, t));
    this.prepared = null;
  }

  dispose() {
    const { gl } = this;
    this.#releasePrepared();
    this.masks.clear();
    for (const pair of this.targets.values()) pair.forEach((t) => disposeTarget(gl, t));
    this.targets.clear();
    for (const target of this.scratch.values()) disposeTarget(gl, target);
    this.scratch.clear();
    Object.values(this.programs).forEach((p) => p.dispose());
    if (this.source) gl.deleteTexture(this.source.texture);
    gl.deleteTexture(this.curve.texture);
    gl.deleteTexture(this.emptyMask);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
