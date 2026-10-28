// GLSL ES 3.00 sources. Every pass draws a single full-screen triangle.
//
// Texture rows are stored top-first everywhere, so `vUv` is an image coordinate
// with y pointing down. Only the final pass to the canvas has to flip.

const HEADER = `#version 300 es
precision highp float;
precision highp int;
`;

const COMMON = `
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float luma(vec3 c) { return dot(c, LUMA); }

vec3 toLinear(vec3 c) {
  c = max(c, 0.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 toGamma(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

// Brightening rolls off towards white instead of clipping.
vec3 expose(vec3 lin, float gain) {
  if (gain <= 1.0) return lin * gain;
  return gain * lin / (1.0 + (gain - 1.0) * lin);
}

// Moves a colour to a new luminance. Chroma follows the change, but only by
// the square root of the ratio: scaling it fully over-saturates lifted shadows.
vec3 setLuma(vec3 c, float from, float to) {
  float k = sqrt(clamp((to + 0.05) / (from + 0.05), 0.0, 4.0));
  return (c - from) * k + to;
}

vec3 sCurve(vec3 c, float amount) {
  c = clamp(c, 0.0, 1.0);
  return c + amount * (c * c * (3.0 - 2.0 * c) - c);
}

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

export const VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const COPY = `${HEADER}
uniform sampler2D uTex;
in vec2 vUv;
out vec4 outColor;
void main() {
  outColor = texture(uTex, vUv);
}
`;

export const BLUR = `${HEADER}
uniform sampler2D uTex;
uniform vec2 uStep;
uniform float uSigma;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 sum = texture(uTex, vUv);
  float total = 1.0;
  int radius = int(ceil(uSigma * 2.5));
  float k = -0.5 / (uSigma * uSigma);
  for (int i = 1; i <= 64; i++) {
    if (i > radius) break;
    float w = exp(float(i * i) * k);
    vec2 o = uStep * float(i);
    sum += w * (texture(uTex, vUv + o) + texture(uTex, vUv - o));
    total += 2.0 * w;
  }
  outColor = sum / total;
}
`;

// Spot healing: copies a patch from another place and matches its average
// colour with the ring around the blemish.
export const HEAL = `${HEADER}
#define MAX_SPOTS 16
uniform sampler2D uTex;
uniform int uCount;
uniform vec3 uSpots[MAX_SPOTS];
uniform vec2 uSources[MAX_SPOTS];
uniform vec2 uAspect;
uniform float uLong;
in vec2 vUv;
out vec4 outColor;

vec3 ringMean(vec2 center, float radius, float lod) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5235988;
    vec2 o = vec2(cos(a), sin(a)) * radius * 1.3 / uAspect;
    sum += textureLod(uTex, center + o, lod).rgb;
  }
  return sum / 12.0;
}

void main() {
  vec3 color = texture(uTex, vUv).rgb;
  for (int i = 0; i < MAX_SPOTS; i++) {
    if (i >= uCount) break;
    vec3 spot = uSpots[i];
    float d = length((vUv - spot.xy) * uAspect) / spot.z;
    if (d >= 1.0) continue;
    vec2 offset = uSources[i] - spot.xy;
    float lod = max(0.0, log2(spot.z * uLong * 0.3));
    vec3 shift = ringMean(spot.xy, spot.z, lod) - ringMean(uSources[i], spot.z, lod);
    vec3 copied = textureLod(uTex, vUv + offset, 0.0).rgb + shift;
    color = mix(color, copied, 1.0 - smoothstep(0.55, 1.0, d));
  }
  outColor = vec4(color, 1.0);
}
`;

// Global adjustments. The blurred copies of the source give the local average
// used by structure, HDR tone mapping, shadow/highlight masks and glow.
export const DEVELOP = `${HEADER}
${COMMON}
uniform sampler2D uSrc;
uniform sampler2D uBlurS;
uniform sampler2D uBlurM;
uniform sampler2D uBlurL;
uniform sampler2D uCurve;

uniform vec3 uWb;
uniform float uExposure;
uniform float uGamma;
uniform float uContrast;
uniform float uHighlights;
uniform float uShadows;
uniform vec2 uLevelsIn;
uniform vec2 uLevelsOut;
uniform float uSaturation;
uniform float uVibrance;
uniform float uStructure;
uniform vec4 uHdr;
uniform float uGlow;
uniform bool uHslOn;
uniform vec3 uHsl[8];
uniform vec4 uSplitShadow;
uniform vec4 uSplitHighlight;
uniform float uSplitBalance;
uniform float uBw;
uniform vec3 uBwMix;
uniform bool uCurveOn;

in vec2 vUv;
out vec4 outColor;

const float HUES[8] = float[8](0.0, 30.0, 60.0, 120.0, 180.0, 220.0, 270.0, 310.0);

vec3 develop(vec3 c) {
  return toGamma(expose(toLinear(c) * uWb, uExposure));
}

vec3 hslAdjust(vec3 c) {
  vec3 hsv = rgb2hsv(clamp(c, 0.0, 1.0));
  float weight = smoothstep(0.02, 0.2, hsv.y * hsv.z);
  float hue = hsv.x * 360.0;
  vec3 adj = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = HUES[i];
    float b = i == 7 ? 360.0 : HUES[min(i + 1, 7)];
    if (hue >= a && hue < b) {
      float t = smoothstep(0.0, 1.0, (hue - a) / (b - a));
      adj = mix(uHsl[i], uHsl[(i + 1) % 8], t);
    }
  }
  adj *= weight;
  hsv.x = fract(hsv.x + adj.x * (30.0 / 360.0));
  hsv.y = clamp(hsv.y * (1.0 + adj.y), 0.0, 1.0);
  return hsv2rgb(hsv) * (1.0 + adj.z * 0.6);
}

void main() {
  vec3 c = develop(texture(uSrc, vUv).rgb);
  vec3 bs = develop(texture(uBlurS, vUv).rgb);
  vec3 bm = develop(texture(uBlurM, vUv).rgb);
  vec3 bl = develop(texture(uBlurL, vUv).rgb);
  float L0 = luma(c);
  float Ls = luma(bs);
  float Lm = luma(bm);
  float Ll = luma(bl);
  float L = L0;

  // HDR: pull the large-scale base towards mid grey and amplify what sits on
  // top of it. The extra detail is soft-limited to keep halos in check.
  if (uHdr.x > 0.0) {
    float base = mix(Lm, Ll, uHdr.z);
    float target = base + (0.5 - base) * 0.7 * uHdr.x;
    float detail = L - base;
    float extra = detail * 2.5 * uHdr.y * uHdr.x;
    L = target + detail + extra / (1.0 + abs(extra) * 4.0);
  }

  if (uStructure > 0.0) {
    float detail = (L0 - Ls) * 0.7 + (Ls - Lm);
    float extra = detail * uStructure * 2.0;
    float protect = smoothstep(0.0, 0.15, L) * (1.0 - smoothstep(0.85, 1.0, L));
    L += extra / (1.0 + abs(extra) * 3.0) * protect;
  } else if (uStructure < 0.0) {
    L += (Ls - L0) * -uStructure;
  }

  L = pow(clamp(L, 0.0, 1.5), uGamma);

  float mask = clamp(mix(L, Lm, 0.6), 0.0, 1.0);
  if (uShadows != 0.0) {
    float k = uShadows > 0.0 ? 1.0 / (1.0 + 1.3 * uShadows) : 1.0 - 1.3 * uShadows;
    L = mix(L, pow(clamp(L, 0.0, 1.0), k), 1.0 - smoothstep(0.0, 0.6, mask));
  }
  if (uHighlights != 0.0) {
    float k = uHighlights < 0.0 ? 1.0 / (1.0 - 1.1 * uHighlights) : 1.0 + 1.3 * uHighlights;
    L = mix(L, 1.0 - pow(clamp(1.0 - L, 0.0, 1.0), k), smoothstep(0.35, 1.0, mask));
  }

  L = (L - uLevelsIn.x) / (uLevelsIn.y - uLevelsIn.x);
  L = mix(uLevelsOut.x, uLevelsOut.y, L);

  c = setLuma(c, L0, max(L, 0.0));
  c = sCurve(c, uContrast);

  float l = luma(c);
  c = max(mix(vec3(l), c, 1.0 + uSaturation), 0.0);
  if (uVibrance != 0.0) {
    float chroma = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    float amount = uVibrance * (1.0 - smoothstep(0.0, 0.6, chroma));
    l = luma(c);
    c = max(mix(vec3(l), c, 1.0 + amount * 1.2), 0.0);
  }

  if (uHslOn) c = hslAdjust(c);

  if (uGlow > 0.0) {
    vec3 glow = clamp(bm * bm * 1.2, 0.0, 1.0);
    c = 1.0 - (1.0 - clamp(c, 0.0, 1.0)) * (1.0 - glow * uGlow * 0.75);
  }

  if (uBw > 0.0) {
    c = mix(c, vec3(clamp(dot(c, uBwMix), 0.0, 1.0)), uBw);
  }

  if (uSplitShadow.w > 0.0 || uSplitHighlight.w > 0.0) {
    l = luma(c);
    float pivot = 0.5 - 0.3 * uSplitBalance;
    float wh = smoothstep(pivot - 0.3, pivot + 0.3, l);
    float ws = (1.0 - wh) * mix(0.4, 1.0, smoothstep(0.0, 0.2, l));
    wh *= 1.0 - 0.6 * smoothstep(0.9, 1.0, l);
    c += uSplitShadow.rgb * uSplitShadow.w * ws + uSplitHighlight.rgb * uSplitHighlight.w * wh;
  }

  if (uCurveOn) {
    vec3 x = clamp(c, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0;
    c = vec3(
      texture(uCurve, vec2(x.r, 0.5)).r,
      texture(uCurve, vec2(x.g, 0.5)).g,
      texture(uCurve, vec2(x.b, 0.5)).b
    );
  }

  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

// One pass per local adjustment: brush mask, control point (with colour
// selectivity, the way U-Point works) or linear gradient.
export const LOCAL = `${HEADER}
${COMMON}
uniform sampler2D uImage;
uniform sampler2D uSrc;
uniform sampler2D uBlurS;
uniform sampler2D uBlurM;
uniform sampler2D uMask;
uniform int uType;
uniform vec2 uAspect;
uniform vec2 uP0;
uniform vec2 uP1;
uniform float uRadius;
uniform float uSelectivity;
uniform bool uInvert;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform vec3 uWarmth;
uniform float uStructure;
uniform bool uShowMask;

in vec2 vUv;
out vec4 outColor;

float zoneMask() {
  if (uType == 0) return texture(uMask, vUv).r;
  if (uType == 1) {
    float d = length((vUv - uP0) * uAspect) / uRadius;
    float m = 1.0 - smoothstep(0.0, 1.0, d);
    if (uSelectivity > 0.0) {
      vec3 ref = texture(uBlurS, uP0).rgb;
      vec3 px = mix(texture(uSrc, vUv).rgb, texture(uBlurS, vUv).rgb, 0.5);
      float dl = luma(px) - luma(ref);
      vec3 dc = (px - luma(px)) - (ref - luma(ref));
      float dist2 = dl * dl * 0.6 + dot(dc, dc) * 2.0;
      float sigma = mix(0.6, 0.06, uSelectivity);
      m *= exp(-dist2 / (2.0 * sigma * sigma));
    }
    return m;
  }
  vec2 a = uP0 * uAspect;
  vec2 ab = uP1 * uAspect - a;
  float t = dot(vUv * uAspect - a, ab) / max(dot(ab, ab), 1e-6);
  return 1.0 - smoothstep(0.0, 1.0, t);
}

void main() {
  vec3 c = texture(uImage, vUv).rgb;
  float m = clamp(zoneMask(), 0.0, 1.0);
  if (uInvert) m = 1.0 - m;

  vec3 a = c;
  if (uExposure != 1.0 || uWarmth != vec3(1.0)) {
    a = toGamma(expose(toLinear(a) * uWarmth, uExposure));
  }
  if (uStructure != 0.0) {
    float Ls = luma(texture(uSrc, vUv).rgb);
    float Lbs = luma(texture(uBlurS, vUv).rgb);
    float Lbm = luma(texture(uBlurM, vUv).rgb);
    if (uStructure > 0.0) {
      float extra = ((Ls - Lbs) * 0.7 + (Lbs - Lbm)) * uStructure * 2.0;
      a += extra / (1.0 + abs(extra) * 3.0);
    } else {
      a += (Lbs - Ls) * -uStructure;
    }
  }
  if (uContrast != 0.0) a = sCurve(a, uContrast);
  if (uSaturation != 0.0) a = mix(vec3(luma(a)), a, 1.0 + uSaturation);

  c = mix(c, clamp(a, 0.0, 1.0), m);
  if (uShowMask) c = mix(c, vec3(1.0, 0.18, 0.22), m * 0.6);
  outColor = vec4(c, 1.0);
}
`;

// Geometry, sharpening, vignette and grain, in output space.
export const OUTPUT = `${HEADER}
${COMMON}
uniform sampler2D uImage;
uniform sampler2D uSrc;
uniform mat3 uMatrix;
uniform bool uFlipY;
uniform bool uOriginal;
uniform vec2 uTexel;
uniform float uSharpen;
uniform vec4 uVignette;
uniform vec2 uVignetteCenter;
uniform vec2 uGrain;
uniform vec2 uOutSize;

in vec2 vUv;
out vec4 outColor;

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec2 o = vec2(vUv.x, uFlipY ? 1.0 - vUv.y : vUv.y);
  vec2 uv = (uMatrix * vec3(o, 1.0)).xy;

  if (uOriginal) {
    outColor = vec4(texture(uSrc, uv).rgb, 1.0);
    return;
  }

  vec3 c = texture(uImage, uv).rgb;

  if (uSharpen > 0.0) {
    vec3 n = texture(uImage, uv + vec2(uTexel.x, 0.0)).rgb
      + texture(uImage, uv - vec2(uTexel.x, 0.0)).rgb
      + texture(uImage, uv + vec2(0.0, uTexel.y)).rgb
      + texture(uImage, uv - vec2(0.0, uTexel.y)).rgb;
    float d = luma(c) - luma(n) * 0.25;
    c += d / (1.0 + abs(d) * 4.0) * uSharpen;
  }

  if (uVignette.x != 0.0) {
    float d = length(o - uVignetteCenter) * 1.41421;
    float m = smoothstep(uVignette.y * (1.0 - uVignette.z), uVignette.y, d);
    if (uVignette.x < 0.0) c *= 1.0 + uVignette.x * m;
    else c += (1.0 - c) * uVignette.x * m;
  }

  if (uGrain.x > 0.0) {
    vec2 p = o * uOutSize / max(uOutSize.x, uOutSize.y) * uGrain.y;
    float n = valueNoise(p) + 0.5 * valueNoise(p * 2.13 + 17.0) - 0.75;
    float l = luma(clamp(c, 0.0, 1.0));
    c += n * uGrain.x * 0.24 * (0.35 + 2.6 * l * (1.0 - l));
  }

  c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;
