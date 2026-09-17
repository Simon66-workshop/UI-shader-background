import { EFFECT_INDEX, type ShaderRecord } from "./types.ts";
import { GLOW_FLOOR } from "./glsl.ts";

function num(n: number): string {
  return n.toFixed(9).replace(/0+$/, "0").replace(/\.$/, ".0");
}

function helpers(effect: number): string {
  const bayer =
    effect === 3
      ? `
fn bayer4(p: vec2<f32>) -> f32 {
  let i = floor(p) % 4.0;
  let idx = i32(clamp(i.x + i.y * 4.0, 0.0, 15.0));
  var m = array<f32, 16>(
    0.0, 8.0, 2.0, 10.0,
    12.0, 4.0, 14.0, 6.0,
    3.0, 11.0, 1.0, 9.0,
    15.0, 7.0, 13.0, 5.0
  );
  return (m[idx] + 0.5) / 16.0;
}
`
      : "";
  return `
fn hsl2rgb(h: f32, s: f32, l: f32) -> vec3<f32> {
  let rgb = clamp(abs((h * 6.0 + vec3<f32>(0.0, 4.0, 2.0)) % 6.0 - 3.0) - 1.0, vec3<f32>(0.0), vec3<f32>(1.0));
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

fn hash21(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.x, p.y, p.x) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn warp(p_in: vec2<f32>, t: f32) -> vec2<f32> {
  var p = p_in;
  p.x += sin(p.y * WARP_FREQ_Y + t) * WARP_AMP_X * 4.2;
  p.y += cos(p.x * WARP_FREQ_X - t * 0.73) * WARP_AMP_Y * 4.2;
  p.x += sin(p.y * WARP_FREQ_Y * 0.46 - t * 0.31) * WARP_AMP_X * 2.1;
  p.y += cos(p.x * WARP_FREQ_X * 0.37 + t * 0.19) * WARP_AMP_Y * 2.4;
  return p;
}

fn rotRow(a: f32, v: vec2<f32>) -> vec2<f32> {
  let c = cos(a);
  let s = sin(a);
  return vec2<f32>(c * v.x - s * v.y, s * v.x + c * v.y);
}

fn rotMul(a: f32, v: vec2<f32>) -> vec2<f32> {
  let c = cos(a);
  let s = sin(a);
  return vec2<f32>(c * v.x + s * v.y, -s * v.x + c * v.y);
}
${bayer}`;
}

function fieldColorSrc(effect: number): string {
  const liquid =
    effect === 6
      ? `  p += 0.22 * vec2<f32>(sin(p.y * 3.1 + t * 0.6), cos(p.x * 2.4 - t * 0.5));
`
      : "";
  const mosaic =
    effect === 7
      ? `  let cell = mix(8.0, 28.0, 0.55) * u.pixelRatio;
  frag = floor(frag / cell) * cell + cell * 0.5;
  p = (frag - 0.5 * u.resolution) / max(u.resolution.y, 1.0);
  p.x *= ASPECT_X;
  p.y *= ASPECT_Y;
  p *= mix(0.55, 1.85, clamp(SHRINK, 0.2, 1.4));
  p = rotRow(THETA, p);
`
      : "";
  return `
fn fieldColor(frag_in: vec2<f32>, t: f32) -> vec3<f32> {
  var frag = frag_in;
  var p = (frag - 0.5 * u.resolution) / max(u.resolution.y, 1.0);
  p.x *= ASPECT_X;
  p.y *= ASPECT_Y;
  p *= mix(0.55, 1.85, clamp(SHRINK, 0.2, 1.4));
  p.x += p.y * (SHEAR * 2.0 - 1.0);
  p = rotRow(THETA, p);
${liquid}${mosaic}  p = warp(p, t);
  let band = sin(p.x * 1.35 + p.y * 0.32 + t * HUE_TRAVEL);
  let glow = exp(-band * band * (5.4 + LAYERS * 0.07));
  let glow2 = exp(-pow(sin(p.y * 0.92 - p.x * 0.38 + t * 0.55), 2.0) * 9.5) * 0.5;
  let g = clamp(glow + glow2, 0.0, 1.0);
  var h = HUE + g * HUE_SPREAD + t * COLOUR_CYCLE * 0.12;
  h = h - floor(h);
  var s = mix(0.28, 0.92, clamp(CHROMA * 3.4, 0.0, 1.0));
  var l = mix(0.10, mix(0.52, 0.62, LIGHTNESS), g);
  if (u.lightMode > 0.5) {
    l = mix(0.78, mix(0.55, 0.48, LIGHTNESS), g);
    s = s * 0.72;
  }
  var col = hsl2rgb(h, s, l);
  let bg = mix(u.darkBackground.xyz, u.lightBackground.xyz, u.lightMode);
  col = mix(bg, col, mix(${GLOW_FLOOR.toFixed(2)}, 1.0, g));
  return col;
}
`;
}

function applyEffectSrc(effect: number): string {
  if (effect === 1) {
    return `
fn applyEffect(col: vec3<f32>, frag: vec2<f32>, t: f32) -> vec3<f32> {
  let n = hash21(frag + floor(t * 24.0));
  return col + (n - 0.5) * 0.12;
}
`;
  }
  if (effect === 2) {
    return `
fn applyEffect(col: vec3<f32>, frag: vec2<f32>, t: f32) -> vec3<f32> {
  let bg = mix(u.darkBackground.xyz, u.lightBackground.xyz, u.lightMode);
  let lum = dot(col, vec3<f32>(0.299, 0.587, 0.114));
  let cell = vec2<f32>(7.0, 11.0) * max(u.pixelRatio, 1.0);
  let gv = fract(frag / cell);
  let id = floor(frag / cell);
  let v = hash21(id) * 0.15 + lum;
  var glyph = 0.0;
  if (v > 0.15) { glyph = step(abs(gv.x - 0.5), 0.08); }
  if (v > 0.32) { glyph = max(glyph, step(abs(gv.y - 0.5), 0.07)); }
  if (v > 0.48) { glyph = max(glyph, step(min(abs(gv.x - gv.y), abs(gv.x - (1.0 - gv.y))), 0.06)); }
  if (v > 0.64) { glyph = max(glyph, step(length(gv - vec2<f32>(0.5)), 0.28) * (1.0 - step(length(gv - vec2<f32>(0.5)), 0.14))); }
  if (v > 0.8) { glyph = max(glyph, 1.0 - step(0.18, min(min(gv.x, gv.y), min(1.0 - gv.x, 1.0 - gv.y)))); }
  let ink = mix(bg, col, 0.35 + lum);
  return mix(bg, ink, glyph);
}
`;
  }
  if (effect === 3) {
    return `
fn applyEffect(col: vec3<f32>, frag: vec2<f32>, t: f32) -> vec3<f32> {
  let bg = mix(u.darkBackground.xyz, u.lightBackground.xyz, u.lightMode);
  let lum = dot(col, vec3<f32>(0.299, 0.587, 0.114));
  let levels = 5.0;
  let d = bayer4(frag / max(u.pixelRatio, 1.0));
  let q = floor(lum * levels + d) / levels;
  return mix(bg, col, clamp(q + 0.12, 0.0, 1.0));
}
`;
  }
  if (effect === 4) {
    return `
fn applyEffect(col: vec3<f32>, frag: vec2<f32>, t: f32) -> vec3<f32> {
  let bg = mix(u.darkBackground.xyz, u.lightBackground.xyz, u.lightMode);
  let lum = dot(col, vec3<f32>(0.299, 0.587, 0.114));
  let p = rotMul(0.4, frag) / (10.0 * max(u.pixelRatio, 1.0));
  let gv = fract(p) - 0.5;
  let r = mix(0.08, 0.46, lum);
  let dotv = smoothstep(r, r - 0.04, length(gv));
  return mix(bg, col, dotv);
}
`;
  }
  if (effect === 5) {
    return `
fn applyEffect(col: vec3<f32>, frag: vec2<f32>, t: f32) -> vec3<f32> {
  let id = floor(frag / (6.0 * max(u.pixelRatio, 1.0)));
  let sp = hash21(id + floor(t * 3.0));
  let tw = smoothstep(0.984, 1.0, sp);
  return col + vec3<f32>(tw) * (0.6 + 0.4 * hash21(id + 9.0));
}
`;
  }
  if (effect === 8) {
    return `
fn applyEffect(col: vec3<f32>, frag: vec2<f32>, t: f32) -> vec3<f32> {
  let off = vec2<f32>(3.2, 0.0) * max(u.pixelRatio, 1.0);
  let r = fieldColor(frag + off, t);
  let b = fieldColor(frag - off, t);
  return vec3<f32>(r.r, col.g, b.b);
}
`;
  }
  return `
fn applyEffect(col: vec3<f32>, frag: vec2<f32>, t: f32) -> vec3<f32> {
  return col;
}
`;
}

export function wgslSource(record: ShaderRecord): string {
  const p = record.params;
  const effect = EFFECT_INDEX[record.type];
  return `struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  lightMode: f32,
  darkBackground: vec4<f32>,
  lightBackground: vec4<f32>,
  pixelRatio: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

const HUE: f32 = ${num(p.hue)};
const HUE_SPREAD: f32 = ${num(p.hueSpread)};
const HUE_TRAVEL: f32 = ${num(p.hueTravel)};
const CHROMA: f32 = ${num(p.chroma)};
const LIGHTNESS: f32 = ${num(p.lightness)};
const COLOUR_CYCLE: f32 = ${num(p.colourCycle)};
const THETA: f32 = ${num(p.theta)};
const SHEAR: f32 = ${num(p.shear)};
const SHRINK: f32 = ${num(p.shrink)};
const LAYERS: f32 = ${num(p.layers)};
const WARP_FREQ_X: f32 = ${num(p.warpFreqX)};
const WARP_FREQ_Y: f32 = ${num(p.warpFreqY)};
const WARP_AMP_X: f32 = ${num(p.warpAmpX)};
const WARP_AMP_Y: f32 = ${num(p.warpAmpY)};
const ASPECT_X: f32 = ${num(p.aspectX)};
const ASPECT_Y: f32 = ${num(p.aspectY)};
const EFFECT: f32 = ${num(effect)};
${helpers(effect)}${fieldColorSrc(effect)}${applyEffectSrc(effect)}
@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
  var p = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  return vec4<f32>(p[i], 0.0, 1.0);
}

@fragment
fn fs(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let frag = pos.xy;
  let t = u.time * (0.07 + COLOUR_CYCLE * 0.35);
  var col = fieldColor(frag, t);
  col = applyEffect(col, frag, t);
  return vec4<f32>(col, 1.0);
}
`;
}
