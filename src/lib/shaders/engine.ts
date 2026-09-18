import { fragmentSource, VERTEX_SRC } from "./glsl.ts";
import { capDimension, capPixelRatio } from "./rng.ts";
import {
  CARD_MAX_DIMENSION,
  CARD_MAX_DPR,
  HERO_MAX_DIMENSION,
  HERO_MAX_DPR,
  MAX_CONTEXTS,
  THEME_FADE_MS,
  type EffectType,
  type ShaderRecord,
} from "./types.ts";

export type ThemeName = "dark" | "light";

type LocMap = Record<string, WebGLUniformLocation | null>;
type Rgb = [number, number, number];

type ProgramSlot = {
  program: WebGLProgram;
  loc: LocMap;
};

type Gpu = {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  vao: WebGLVertexArrayObject;
  programs: Map<EffectType, ProgramSlot>;
  lost: boolean;
};

type Live = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  record: ShaderRecord;
  theme: ThemeName;
  lightMode: number;
  mode: "card" | "hero";
  disposed: boolean;
  width: number;
  height: number;
  dpr: number;
  lastTime: number;
  elapsed: number;
  visible: boolean;
  reduced: boolean;
  resize: ResizeObserver;
  io: IntersectionObserver;
  mq?: MediaQueryList;
  onMq?: () => void;
};

const UNIFORM_KEYS = [
  "resolution",
  "time",
  "lightMode",
  "darkBackground",
  "lightBackground",
  "pixelRatio",
  "HUE",
  "HUE_SPREAD",
  "HUE_TRAVEL",
  "CHROMA",
  "LIGHTNESS",
  "COLOUR_CYCLE",
  "THETA",
  "SHEAR",
  "SHRINK",
  "LAYERS",
  "WARP_FREQ_X",
  "WARP_FREQ_Y",
  "WARP_AMP_X",
  "WARP_AMP_Y",
  "ASPECT_X",
  "ASPECT_Y",
] as const;

const THEME_FADE_SEC = THEME_FADE_MS / 1000;
const FALLBACK_DARK: Rgb = [10 / 255, 10 / 255, 11 / 255];
const FALLBACK_LIGHT: Rgb = [245 / 255, 245 / 255, 247 / 255];

let gpu: Gpu | null = null;
let visHooked = false;
let loopId = 0;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("shader alloc failed");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? "compile failed";
    gl.deleteShader(sh);
    throw new Error(log);
  }
  return sh;
}

function link(gl: WebGL2RenderingContext, fragmentSrc: string) {
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SRC);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  const prog = gl.createProgram();
  if (!prog) throw new Error("program alloc failed");
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) ?? "link failed";
    gl.deleteProgram(prog);
    throw new Error(log);
  }
  return prog;
}

function bootGpu(): Gpu {
  if (gpu && !gpu.lost && !gpu.gl.isContextLost()) return gpu;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "low-power",
  });
  if (!gl) throw new Error("WebGL2 unavailable");
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("vao alloc failed");
  gl.bindVertexArray(vao);
  const next: Gpu = { canvas, gl, vao, programs: new Map(), lost: false };
  canvas.addEventListener(
    "webglcontextlost",
    (e) => {
      e.preventDefault();
      next.lost = true;
      stopLoop();
    },
    false,
  );
  canvas.addEventListener(
    "webglcontextrestored",
    () => {
      gpu = null;
      ensureLoop();
    },
    false,
  );
  gpu = next;
  return next;
}

function programFor(type: EffectType): ProgramSlot {
  const g = bootGpu();
  const hit = g.programs.get(type);
  if (hit) return hit;
  const program = link(g.gl, fragmentSource(type));
  const loc: LocMap = {};
  for (const k of UNIFORM_KEYS) loc[k] = g.gl.getUniformLocation(program, k);
  const slot = { program, loc };
  g.programs.set(type, slot);
  return slot;
}

function cssRgb(varName: string, fallback: Rgb): Rgb {
  if (typeof getComputedStyle === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const hex = raw.startsWith("#") ? raw : "";
  if (/^#([0-9a-f]{6})$/i.test(hex)) {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  return fallback;
}

function themeColors(): { dark: Rgb; light: Rgb } {
  return {
    dark: cssRgb("--shader-bg-dark", FALLBACK_DARK),
    light: cssRgb("--shader-bg-light", FALLBACK_LIGHT),
  };
}

function approach(current: number, target: number, step: number) {
  const d = target - current;
  if (Math.abs(d) <= step) return target;
  return current + Math.sign(d) * step;
}

function measure(live: Live) {
  const rect = live.canvas.getBoundingClientRect();
  const cap = live.mode === "hero" ? HERO_MAX_DPR : CARD_MAX_DPR;
  const maxEdge = live.mode === "hero" ? HERO_MAX_DIMENSION : CARD_MAX_DIMENSION;
  const dpr = capPixelRatio(window.devicePixelRatio || 1, cap);
  const dim = capDimension(rect.width * dpr, rect.height * dpr, maxEdge);
  live.width = dim.width;
  live.height = dim.height;
  live.dpr = dpr;
}

function blit(
  live: Live,
  gpuNow: Gpu,
  slot: ProgramSlot,
  now: number,
  dark: Rgb,
  light: Rgb,
) {
  const gl = gpuNow.gl;
  const dt = Math.min(0.05, (now - live.lastTime) / 1000);
  live.lastTime = now;
  if (!live.reduced) live.elapsed += dt;
  const target = live.theme === "light" ? 1 : 0;
  live.lightMode = live.reduced ? target : approach(live.lightMode, target, dt / THEME_FADE_SEC);

  gl.bindVertexArray(gpuNow.vao);
  gl.viewport(0, 0, live.width, live.height);
  gl.useProgram(slot.program);
  const p = live.record.params;
  const set2 = (k: string, x: number, y: number) => {
    const loc = slot.loc[k];
    if (loc) gl.uniform2f(loc, x, y);
  };
  const set1 = (k: string, x: number) => {
    const loc = slot.loc[k];
    if (loc) gl.uniform1f(loc, x);
  };
  const set3 = (k: string, v: Rgb) => {
    const loc = slot.loc[k];
    if (loc) gl.uniform3f(loc, v[0], v[1], v[2]);
  };
  set2("resolution", live.width, live.height);
  set1("time", live.elapsed);
  set1("lightMode", live.lightMode);
  set3("darkBackground", dark);
  set3("lightBackground", light);
  set1("pixelRatio", live.dpr);
  set1("HUE", p.hue);
  set1("HUE_SPREAD", p.hueSpread);
  set1("HUE_TRAVEL", p.hueTravel);
  set1("CHROMA", p.chroma);
  set1("LIGHTNESS", p.lightness);
  set1("COLOUR_CYCLE", p.colourCycle);
  set1("THETA", p.theta);
  set1("SHEAR", p.shear);
  set1("SHRINK", p.shrink);
  set1("LAYERS", p.layers);
  set1("WARP_FREQ_X", p.warpFreqX);
  set1("WARP_FREQ_Y", p.warpFreqY);
  set1("WARP_AMP_X", p.warpAmpX);
  set1("WARP_AMP_Y", p.warpAmpY);
  set1("ASPECT_X", p.aspectX);
  set1("ASPECT_Y", p.aspectY);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  if (live.canvas.width !== live.width || live.canvas.height !== live.height) {
    live.canvas.width = live.width;
    live.canvas.height = live.height;
  }
  live.ctx.imageSmoothingEnabled = false;
  // Viewport (0,0,w,h) is bottom-left in the drawing buffer; the canvas
  // image source is top-left, so that rectangle sits at y = gh - h.
  const srcY = gpuNow.canvas.height - live.height;
  live.ctx.drawImage(
    gpuNow.canvas,
    0,
    srcY,
    live.width,
    live.height,
    0,
    0,
    live.width,
    live.height,
  );
}

function drawOne(live: Live, now: number) {
  if (live.disposed || !live.visible) return;
  if (pageHidden()) return;
  measure(live);
  const gpuNow = bootGpu();
  if (gpuNow.lost || gpuNow.gl.isContextLost()) return;
  if (gpuNow.canvas.width < live.width) gpuNow.canvas.width = live.width;
  if (gpuNow.canvas.height < live.height) gpuNow.canvas.height = live.height;
  const colors = themeColors();
  blit(live, gpuNow, programFor(live.record.type), now, colors.dark, colors.light);
}

const pool: Live[] = [];

function pageHidden() {
  return typeof document !== "undefined" && document.hidden;
}

function stopLoop() {
  if (!loopId) return;
  cancelAnimationFrame(loopId);
  loopId = 0;
}

function tick(now: number) {
  loopId = 0;
  if (pageHidden()) return;
  const vis = pool.filter((l) => !l.disposed && l.visible);
  if (vis.length === 0) return;

  for (const live of vis) measure(live);
  let maxW = 1;
  let maxH = 1;
  for (const live of vis) {
    if (live.width > maxW) maxW = live.width;
    if (live.height > maxH) maxH = live.height;
  }
  const gpuNow = bootGpu();
  if (gpuNow.lost || gpuNow.gl.isContextLost()) return;
  if (gpuNow.canvas.width !== maxW || gpuNow.canvas.height !== maxH) {
    gpuNow.canvas.width = maxW;
    gpuNow.canvas.height = maxH;
  }
  const colors = themeColors();
  for (const live of vis) {
    blit(live, gpuNow, programFor(live.record.type), now, colors.dark, colors.light);
  }
  loopId = requestAnimationFrame(tick);
}

function ensureLoop() {
  if (loopId) return;
  if (pageHidden()) return;
  if (!pool.some((l) => !l.disposed && l.visible)) return;
  loopId = requestAnimationFrame(tick);
}

function hookVisibility() {
  if (visHooked || typeof document === "undefined") return;
  visHooked = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopLoop();
      return;
    }
    const now = performance.now();
    for (const live of pool) live.lastTime = now;
    ensureLoop();
  });
}

function destroyLive(live: Live) {
  if (live.disposed) return;
  live.disposed = true;
  live.visible = false;
  live.resize.disconnect();
  live.io.disconnect();
  if (live.mq && live.onMq) live.mq.removeEventListener("change", live.onMq);
  const i = pool.indexOf(live);
  if (i >= 0) pool.splice(i, 1);
  if (!pool.some((l) => !l.disposed && l.visible)) stopLoop();
}

export function mountShader(
  canvas: HTMLCanvasElement,
  record: ShaderRecord,
  options: { theme: ThemeName; mode: "card" | "hero" },
): { setTheme: (t: ThemeName) => void; destroy: () => void } {
  hookVisibility();
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("2d context unavailable");

  const live: Live = {
    canvas,
    ctx,
    record,
    theme: options.theme,
    lightMode: options.theme === "light" ? 1 : 0,
    mode: options.mode,
    disposed: false,
    width: 0,
    height: 0,
    dpr: 1,
    lastTime: performance.now(),
    elapsed: 0,
    visible: true,
    reduced: false,
    resize: new ResizeObserver(() => {
      if (live.disposed || !live.visible) return;
      if (loopId) return;
      drawOne(live, performance.now());
    }),
    io: new IntersectionObserver((entries) => {
      const entry = entries[0];
      live.visible = !!entry?.isIntersecting;
      if (live.visible) {
        live.lastTime = performance.now();
        ensureLoop();
      } else if (!pool.some((l) => !l.disposed && l.visible)) {
        stopLoop();
      }
    }),
  };

  live.resize.observe(canvas);
  live.io.observe(canvas);
  if (typeof matchMedia === "function") {
    live.mq = matchMedia("(prefers-reduced-motion: reduce)");
    live.reduced = live.mq.matches;
    live.onMq = () => {
      if (live.mq) live.reduced = live.mq.matches;
    };
    live.mq.addEventListener("change", live.onMq);
  }

  pool.push(live);
  drawOne(live, performance.now());
  ensureLoop();

  return {
    setTheme(theme) {
      live.theme = theme;
      if (live.reduced) live.lightMode = theme === "light" ? 1 : 0;
      ensureLoop();
    },
    destroy() {
      destroyLive(live);
    },
  };
}

export const ENGINE_LIMITS = {
  MAX_CONTEXTS,
  CARD_MAX_DPR,
  HERO_MAX_DPR,
};
