import {
  EFFECT_INDEX,
  type EffectType,
  type FieldParams,
  type ShaderRecord,
} from "./types.ts";

/** Empty-field mix floor. Was 0.18; raised so immersive heroes keep chroma. */
export const GLOW_FLOOR = 0.42;

export const VERTEX_SRC = `#version 300 es
precision highp float;
const vec2 V[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main() {
  gl_Position = vec4(V[gl_VertexID], 0.0, 1.0);
}
`;

const HELPERS = `
vec3 hsl2rgb(float h, float s, float l) {
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

vec2 warp(vec2 p, float t) {
  p.x += sin(p.y * WARP_FREQ_Y + t) * WARP_AMP_X * 4.2;
  p.y += cos(p.x * WARP_FREQ_X - t * 0.73) * WARP_AMP_Y * 4.2;
  p.x += sin(p.y * WARP_FREQ_Y * 0.46 - t * 0.31) * WARP_AMP_X * 2.1;
  p.y += cos(p.x * WARP_FREQ_X * 0.37 + t * 0.19) * WARP_AMP_Y * 2.4;
  return p;
}
`;

const BAYER = `
float bayer4(vec2 p) {
  vec2 i = mod(floor(p), 4.0);
  float idx = i.x + i.y * 4.0;
  float m[16];
  m[0]=0.0;m[1]=8.0;m[2]=2.0;m[3]=10.0;
  m[4]=12.0;m[5]=4.0;m[6]=14.0;m[7]=6.0;
  m[8]=3.0;m[9]=11.0;m[10]=1.0;m[11]=9.0;
  m[12]=15.0;m[13]=7.0;m[14]=13.0;m[15]=5.0;
  int ii = int(clamp(idx, 0.0, 15.0));
  return (m[ii] + 0.5) / 16.0;
}
`;

function fieldColorSrc(effect: number): string {
  const liquid =
    effect === 6
      ? `  p += 0.22 * vec2(sin(p.y * 3.1 + t * 0.6), cos(p.x * 2.4 - t * 0.5));
`
      : "";
  const mosaic =
    effect === 7
      ? `  float cell = mix(8.0, 28.0, 0.55) * pixelRatio;
  frag = floor(frag / cell) * cell + cell * 0.5;
  p = (frag - 0.5 * resolution) / max(resolution.y, 1.0);
  p.x *= ASPECT_X;
  p.y *= ASPECT_Y;
  p *= mix(0.55, 1.85, clamp(SHRINK, 0.2, 1.4));
  p *= rot(THETA);
`
      : "";
  return `
vec3 fieldColor(vec2 frag, float t) {
  vec2 p = (frag - 0.5 * resolution) / max(resolution.y, 1.0);
  p.x *= ASPECT_X;
  p.y *= ASPECT_Y;
  p *= mix(0.55, 1.85, clamp(SHRINK, 0.2, 1.4));
  p.x += p.y * (SHEAR * 2.0 - 1.0);
  p *= rot(THETA);
${liquid}${mosaic}  p = warp(p, t);
  float band = sin(p.x * 1.35 + p.y * 0.32 + t * HUE_TRAVEL);
  float glow = exp(-band * band * (5.4 + LAYERS * 0.07));
  float glow2 = exp(-pow(sin(p.y * 0.92 - p.x * 0.38 + t * 0.55), 2.0) * 9.5) * 0.5;
  float g = clamp(glow + glow2, 0.0, 1.0);
  float h = fract(HUE + g * HUE_SPREAD + t * COLOUR_CYCLE * 0.12);
  float s = mix(0.28, 0.92, clamp(CHROMA * 3.4, 0.0, 1.0));
  float l = mix(0.10, mix(0.52, 0.62, LIGHTNESS), g);
  if (lightMode > 0.5) {
    l = mix(0.78, mix(0.55, 0.48, LIGHTNESS), g);
    s *= 0.72;
  }
  vec3 col = hsl2rgb(h, s, l);
  vec3 bg = mix(darkBackground, lightBackground, lightMode);
  col = mix(bg, col, mix(${GLOW_FLOOR.toFixed(2)}, 1.0, g));
  return col;
}
`;
}

function applyEffectSrc(effect: number): string {
  if (effect === 1) {
    return `
vec3 applyEffect(vec3 col, vec2 frag, float t) {
  float n = hash21(frag + floor(t * 24.0));
  return col + (n - 0.5) * 0.12;
}
`;
  }
  if (effect === 2) {
    return `
vec3 applyEffect(vec3 col, vec2 frag, float t) {
  vec3 bg = mix(darkBackground, lightBackground, lightMode);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec2 cell = vec2(7.0, 11.0) * max(pixelRatio, 1.0);
  vec2 gv = fract(frag / cell);
  vec2 id = floor(frag / cell);
  float v = hash21(id) * 0.15 + lum;
  float glyph = 0.0;
  if (v > 0.15) glyph = step(abs(gv.x - 0.5), 0.08);
  if (v > 0.32) glyph = max(glyph, step(abs(gv.y - 0.5), 0.07));
  if (v > 0.48) glyph = max(glyph, step(min(abs(gv.x - gv.y), abs(gv.x - (1.0 - gv.y))), 0.06));
  if (v > 0.64) glyph = max(glyph, step(length(gv - 0.5), 0.28) * (1.0 - step(length(gv - 0.5), 0.14)));
  if (v > 0.8) glyph = max(glyph, 1.0 - step(0.18, min(min(gv.x, gv.y), min(1.0 - gv.x, 1.0 - gv.y))));
  vec3 ink = mix(bg, col, 0.35 + lum);
  return mix(bg, ink, glyph);
}
`;
  }
  if (effect === 3) {
    return `
vec3 applyEffect(vec3 col, vec2 frag, float t) {
  vec3 bg = mix(darkBackground, lightBackground, lightMode);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float levels = 5.0;
  float d = bayer4(frag / max(pixelRatio, 1.0));
  float q = floor(lum * levels + d) / levels;
  return mix(bg, col, clamp(q + 0.12, 0.0, 1.0));
}
`;
  }
  if (effect === 4) {
    return `
vec3 applyEffect(vec3 col, vec2 frag, float t) {
  vec3 bg = mix(darkBackground, lightBackground, lightMode);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec2 p = rot(0.4) * frag / (10.0 * max(pixelRatio, 1.0));
  vec2 gv = fract(p) - 0.5;
  float r = mix(0.08, 0.46, lum);
  float dotv = smoothstep(r, r - 0.04, length(gv));
  return mix(bg, col, dotv);
}
`;
  }
  if (effect === 5) {
    return `
vec3 applyEffect(vec3 col, vec2 frag, float t) {
  vec2 id = floor(frag / (6.0 * max(pixelRatio, 1.0)));
  float sp = hash21(id + floor(t * 3.0));
  float tw = smoothstep(0.984, 1.0, sp);
  return col + vec3(tw) * (0.6 + 0.4 * hash21(id + 9.0));
}
`;
  }
  if (effect === 8) {
    return `
vec3 applyEffect(vec3 col, vec2 frag, float t) {
  vec2 off = vec2(3.2, 0.0) * max(pixelRatio, 1.0);
  vec3 r = fieldColor(frag + off, t);
  vec3 b = fieldColor(frag - off, t);
  return vec3(r.r, col.g, b.b);
}
`;
  }
  return `
vec3 applyEffect(vec3 col, vec2 frag, float t) {
  return col;
}
`;
}

const MAIN = `
void main() {
  vec2 frag = gl_FragCoord.xy;
  float t = time * (0.07 + COLOUR_CYCLE * 0.35);
  vec3 col = fieldColor(frag, t);
  col = applyEffect(col, frag, t);
  fragColor = vec4(col, 1.0);
}
`;

export function fragmentBody(effectIndex: number): string {
  const bayer = effectIndex === 3 ? BAYER : "";
  return HELPERS + bayer + fieldColorSrc(effectIndex) + applyEffectSrc(effectIndex) + MAIN;
}

export const UNIFORM_HEADER = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 resolution;
uniform float time;
uniform float lightMode;
uniform vec3 darkBackground;
uniform vec3 lightBackground;
uniform float pixelRatio;
uniform float HUE;
uniform float HUE_SPREAD;
uniform float HUE_TRAVEL;
uniform float CHROMA;
uniform float LIGHTNESS;
uniform float COLOUR_CYCLE;
uniform float THETA;
uniform float SHEAR;
uniform float SHRINK;
uniform float LAYERS;
uniform float WARP_FREQ_X;
uniform float WARP_FREQ_Y;
uniform float WARP_AMP_X;
uniform float WARP_AMP_Y;
uniform float ASPECT_X;
uniform float ASPECT_Y;
`;

const srcCache = new Map<EffectType, string>();

export function fragmentSource(type: EffectType): string {
  const hit = srcCache.get(type);
  if (hit) return hit;
  const n = EFFECT_INDEX[type];
  const src = UNIFORM_HEADER + `const float EFFECT = ${n}.0;\n` + fragmentBody(n);
  srcCache.set(type, src);
  return src;
}

function num(n: number): string {
  return n.toFixed(9).replace(/0+$/, "0").replace(/\.$/, ".0");
}

export function inlinedFragment(record: ShaderRecord): string {
  const p = record.params;
  const n = EFFECT_INDEX[record.type];
  const header = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 resolution;
uniform float time;
uniform float lightMode;
uniform vec3 darkBackground;
uniform vec3 lightBackground;
uniform float pixelRatio;
const float HUE = ${num(p.hue)};
const float HUE_SPREAD = ${num(p.hueSpread)};
const float HUE_TRAVEL = ${num(p.hueTravel)};
const float CHROMA = ${num(p.chroma)};
const float LIGHTNESS = ${num(p.lightness)};
const float COLOUR_CYCLE = ${num(p.colourCycle)};
const float THETA = ${num(p.theta)};
const float SHEAR = ${num(p.shear)};
const float SHRINK = ${num(p.shrink)};
const float LAYERS = ${num(p.layers)};
const float WARP_FREQ_X = ${num(p.warpFreqX)};
const float WARP_FREQ_Y = ${num(p.warpFreqY)};
const float WARP_AMP_X = ${num(p.warpAmpX)};
const float WARP_AMP_Y = ${num(p.warpAmpY)};
const float ASPECT_X = ${num(p.aspectX)};
const float ASPECT_Y = ${num(p.aspectY)};
const float EFFECT = ${num(n)};
`;
  return header + fragmentBody(n);
}

export function paramList(p: FieldParams): string {
  return `const HUE = ${num(p.hue)};
const HUE_SPREAD = ${num(p.hueSpread)};
const HUE_TRAVEL = ${num(p.hueTravel)};
const CHROMA = ${num(p.chroma)};
const LIGHTNESS = ${num(p.lightness)};
const COLOUR_CYCLE = ${num(p.colourCycle)};
const THETA = ${num(p.theta)};
const SHEAR = ${num(p.shear)};
const SHRINK = ${num(p.shrink)};
const LAYERS = ${num(p.layers)};
const WARP_FREQ_X = ${num(p.warpFreqX)};
const WARP_FREQ_Y = ${num(p.warpFreqY)};
const WARP_AMP_X = ${num(p.warpAmpX)};
const WARP_AMP_Y = ${num(p.warpAmpY)};
const ASPECT_X = ${num(p.aspectX)};
const ASPECT_Y = ${num(p.aspectY)};`;
}

export function hueLiteral(p: FieldParams): string {
  return num(p.hue);
}
