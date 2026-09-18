import { fragmentSource, VERTEX_SRC } from "./glsl.ts";
import { capDimension, capPixelRatio } from "./rng.ts";
import {
  CARD_MAX_DIMENSION,
  CARD_MAX_DPR,
  EFFECT_TYPES,
  HERO_MAX_DIMENSION,
  HERO_MAX_DPR,
  MAX_CONTEXTS,
  THEME_FADE_MS,
  type EffectType,
  type ShaderRecord,
} from "./types.ts";

export type ThemeName = "dark" | "light";

type LocMap = Record<string, WebGLUniformLocation | null>;

type ProgramSlot = {
  program: WebGLProgram;
  loc: LocMap;
};

type Gpu = {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
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
  frame: number;
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

let gpu: Gpu | null = null;
let visHooked = false;

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
  const programs = new Map<EffectType, ProgramSlot>();
  for (const type of EFFECT_TYPES) {
    const program = link(gl, fragmentSource(type));
    const loc: LocMap = {};
    for (const k of UNIFORM_KEYS) loc[k] = gl.getUniformLocation(program, k);
    programs.set(type, { program, loc });
  }
  const next: Gpu = { canvas, gl, programs, lost: false };
  canvas.addEventListener(
    "webglcontextlost",
    (e) => {
      e.preventDefault();
      next.lost = true;
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

function cssRgb(varName: string, fallback: [number, number, number]): [number, number, number] {
  if (typeof getComputedStyle === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const hex = raw.startsWith("#") ? raw : "";
  if (/^#([0-9a-f]{6})$/i.test(hex)) {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  return fallback;
}

function approach(current: number, target: number, step: number) {
  const d = target - current;
  if (Math.abs(d) <= step) return target;
  return current + Math.sign(d) * step;
}

function draw(live: Live, now: number) {
  if (live.disposed || !live.visible) return;
  if (typeof document !== "undefined" && document.hidden) return;
  const gpuNow = bootGpu();
  const gl = gpuNow.gl;
  const slot = gpuNow.programs.get(live.record.type);
  if (!slot) return;

  const dt = Math.min(0.05, (now - live.lastTime) / 1000);
  live.lastTime = now;
  if (!live.reduced) live.elapsed += dt;
  const target = live.theme === "light" ? 1 : 0;
  live.lightMode = live.reduced ? target : approach(live.lightMode, target, dt / THEME_FADE_SEC);

  const rect = live.canvas.getBoundingClientRect();
  const cap = live.mode === "hero" ? HERO_MAX_DPR : CARD_MAX_DPR;
  const maxEdge = live.mode === "hero" ? HERO_MAX_DIMENSION : CARD_MAX_DIMENSION;
  const dpr = capPixelRatio(window.devicePixelRatio || 1, cap);
  const dim = capDimension(rect.width * dpr, rect.height * dpr, maxEdge);
  live.width = dim.width;
  live.height = dim.height;
  live.dpr = dpr;

  if (gpuNow.canvas.width !== dim.width || gpuNow.canvas.height !== dim.height) {
    gpuNow.canvas.width = dim.width;
    gpuNow.canvas.height = dim.height;
  }
  gl.viewport(0, 0, dim.width, dim.height);
  gl.useProgram(slot.program);
  const p = live.record.params;
  const dark = cssRgb("--shader-bg-dark", [10 / 255, 10 / 255, 11 / 255]);
  const light = cssRgb("--shader-bg-light", [245 / 255, 245 / 255, 247 / 255]);
  const set2 = (k: string, x: number, y: number) => {
    const loc = slot.loc[k];
    if (loc) gl.uniform2f(loc, x, y);
  };
  const set1 = (k: string, x: number) => {
    const loc = slot.loc[k];
    if (loc) gl.uniform1f(loc, x);
  };
  const set3 = (k: string, v: [number, number, number]) => {
    const loc = slot.loc[k];
    if (loc) gl.uniform3f(loc, v[0], v[1], v[2]);
  };
  set2("resolution", dim.width, dim.height);
  set1("time", live.elapsed);
  set1("lightMode", live.lightMode);
  set3("darkBackground", dark);
  set3("lightBackground", light);
  set1("pixelRatio", dpr);
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

  if (live.canvas.width !== dim.width || live.canvas.height !== dim.height) {
    live.canvas.width = dim.width;
    live.canvas.height = dim.height;
  }
  live.ctx.imageSmoothingEnabled = false;
  live.ctx.drawImage(gpuNow.canvas, 0, 0);
}

const pool: Live[] = [];

function pageHidden() {
  return typeof document !== "undefined" && document.hidden;
}

function tick(now: number) {
  if (pageHidden()) {
    for (const live of pool) live.frame = 0;
    return;
  }
  let any = false;
  for (const live of pool) {
    if (live.disposed || !live.visible) continue;
    draw(live, now);
    any = true;
    live.frame = 0;
  }
  if (any) {
    const id = requestAnimationFrame(tick);
    for (const live of pool) {
      if (!live.disposed) live.frame = id;
    }
  }
}

function ensureLoop() {
  if (pageHidden()) return;
  if (pool.some((l) => !l.disposed && l.visible && l.frame)) return;
  const id = requestAnimationFrame(tick);
  for (const live of pool) {
    if (!live.disposed) live.frame = id;
  }
}

function hookVisibility() {
  if (visHooked || typeof document === "undefined") return;
  visHooked = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      for (const live of pool) live.frame = 0;
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
}

function evictIfNeeded(keep?: Live): boolean {
  while (pool.length >= MAX_CONTEXTS) {
    const idle = pool.find((l) => l !== keep && !l.visible);
    if (idle) {
      destroyLive(idle);
      continue;
    }
    const card = pool.find((l) => l !== keep && l.mode === "card");
    if (card) {
      destroyLive(card);
      continue;
    }
    const other = pool.find((l) => l !== keep);
    if (!other) return false;
    destroyLive(other);
  }
  return true;
}

export function mountShader(
  canvas: HTMLCanvasElement,
  record: ShaderRecord,
  options: { theme: ThemeName; mode: "card" | "hero" },
): { setTheme: (t: ThemeName) => void; destroy: () => void } {
  hookVisibility();
  bootGpu();
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("2d context unavailable");
  if (!evictIfNeeded()) {
    throw new Error("webgl pool full");
  }

  const live: Live = {
    canvas,
    ctx,
    record,
    theme: options.theme,
    lightMode: options.theme === "light" ? 1 : 0,
    mode: options.mode,
    disposed: false,
    frame: 0,
    width: 0,
    height: 0,
    dpr: 1,
    lastTime: performance.now(),
    elapsed: 0,
    visible: true,
    reduced: false,
    resize: new ResizeObserver(() => {
      if (!live.disposed && live.visible) draw(live, performance.now());
    }),
    io: new IntersectionObserver((entries) => {
      const entry = entries[0];
      live.visible = !!entry?.isIntersecting;
      if (live.visible) {
        live.lastTime = performance.now();
        ensureLoop();
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
  draw(live, performance.now());
  ensureLoop();

  return {
    setTheme(theme) {
      live.theme = theme;
      if (live.reduced) {
        live.lightMode = theme === "light" ? 1 : 0;
        if (live.visible) draw(live, performance.now());
        return;
      }
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
