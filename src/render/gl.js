// Thin helpers over WebGL2: programs with reflected uniforms, textures and
// render targets.

export class Program {
  constructor(gl, vertexSource, fragmentSource) {
    this.gl = gl;
    const program = gl.createProgram();
    const shaders = [
      compile(gl, gl.VERTEX_SHADER, vertexSource),
      compile(gl, gl.FRAGMENT_SHADER, fragmentSource),
    ];
    for (const shader of shaders) gl.attachShader(program, shader);
    gl.linkProgram(program);
    for (const shader of shaders) gl.deleteShader(shader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;
    this.uniforms = new Map();
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      this.uniforms.set(info.name.replace(/\[0\]$/, ''), {
        location: gl.getUniformLocation(program, info.name),
        type: info.type,
      });
    }
  }

  use(values = {}, textures = {}) {
    const { gl } = this;
    gl.useProgram(this.program);
    let unit = 0;
    for (const [name, texture] of Object.entries(textures)) {
      const uniform = this.uniforms.get(name);
      if (!uniform) continue;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uniform.location, unit++);
    }
    for (const [name, value] of Object.entries(values)) {
      const uniform = this.uniforms.get(name);
      if (uniform) setUniform(gl, uniform, value);
    }
  }

  dispose() {
    this.gl.deleteProgram(this.program);
  }
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed: ${log}`);
  }
  return shader;
}

function setUniform(gl, { location, type }, value) {
  switch (type) {
    case gl.FLOAT:
      if (typeof value === 'number') gl.uniform1f(location, value);
      else gl.uniform1fv(location, value);
      break;
    case gl.FLOAT_VEC2:
      gl.uniform2fv(location, value);
      break;
    case gl.FLOAT_VEC3:
      gl.uniform3fv(location, value);
      break;
    case gl.FLOAT_VEC4:
      gl.uniform4fv(location, value);
      break;
    case gl.INT:
    case gl.BOOL:
      gl.uniform1i(location, Number(value));
      break;
    case gl.FLOAT_MAT3:
      gl.uniformMatrix3fv(location, false, value);
      break;
    default:
      throw new Error(`Unsupported uniform type 0x${type.toString(16)}`);
  }
}

const FORMATS = {
  byte: (gl) => [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE],
  half: (gl) => [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT],
};

export function createTexture(gl, { width, height, format = 'byte', data = null, filter = gl.LINEAR }) {
  const texture = gl.createTexture();
  const [internal, fmt, type] = FORMATS[format](gl);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, fmt, type, data);
  setSampling(gl, filter);
  return texture;
}

export function createImageTexture(gl, image, { mipmaps = false } = {}) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, image);
  setSampling(gl, gl.LINEAR);
  if (mipmaps) generateMipmaps(gl, texture);
  return texture;
}

export function updateImageTexture(gl, texture, image) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, image);
}

export function generateMipmaps(gl, texture) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
}

function setSampling(gl, filter) {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

export function createTarget(gl, width, height, format = 'byte') {
  const texture = createTexture(gl, { width, height, format });
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const target = { texture, framebuffer, width, height, format };
  if (!complete) {
    disposeTarget(gl, target);
    return null;
  }
  return target;
}

export function disposeTarget(gl, target) {
  if (!target) return;
  gl.deleteFramebuffer(target.framebuffer);
  gl.deleteTexture(target.texture);
}
