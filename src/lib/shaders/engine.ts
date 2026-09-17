import { fragmentSource, VERTEX_SRC } from "./glsl.ts";
import { capDimension, capPixelRatio } from "./rng.ts";
import {
  CARD_MAX_DIMENSION,
  CARD_MAX_DPR,
  HERO_MAX_DIMENSION,
  HERO_MAX_DPR,
  MAX_CONTEXTS,
  type ShaderRecord,
} from "./types.ts";

export type ThemeName = "dark" | "light";

type Live = {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  loc: Record<string, WebGLUniformLocation | null>;
  record: ShaderRecord;
  theme: ThemeName;
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

function draw(live: Live, now: number) {
  if (live.disposed || !live.visible) return;
  const gl = live.gl;
  const dt = Math.min(0.05, (now - live.lastTime) / 1000);
  live.lastTime = now;
  if (!live.reduced) live.elapsed += dt;

  const rect = live.canvas.getBoundingClientRect();
  const cap = live.mode === "hero" ? HERO_MAX_DPR : CARD_MAX_DPR;
  const maxEdge = live.mode === "hero" ? HERO_MAX_DIMENSION : CARD_MAX_DIMENSION;
  const dpr = capPixelRatio(window.devicePixelRatio || 1, cap);
  const dim = capDimension(rect.width * dpr, rect.height * dpr, maxEdge);
  if (dim.width !== live.width || dim.height !== live.height || dpr !== live.dpr) {
    live.width = dim.width;
    live.height = dim.height;
    live.dpr = dpr;
    live.canvas.width = dim.width;
    live.canvas.height = dim.height;
    gl.viewport(0, 0, dim.width, dim.height);
  }

  gl.useProgram(live.program);
  const p = live.record.params;
  const dark = cssRgb("--shader-bg-dark", [10 / 255, 10 / 255, 11 / 255]);
  const light = cssRgb("--shader-bg-light", [245 / 255, 245 / 255, 247 / 255]);
  const set2 = (k: string, x: number, y: number) => {
    const loc = live.loc[k];
    if (loc) gl.uniform2f(loc, x, y);
  };
  const set1 = (k: string, x: number) => {
    const loc = live.loc[k];
    if (loc) gl.uniform1f(loc, x);
  };
  const set3 = (k: string, v: [number, number, number]) => {
    const loc = live.loc[k];
    if (loc) gl.uniform3f(loc, v[0], v[1], v[2]);
  };
  set2("resolution", live.width, live.height);
  set1("time", live.elapsed);
  set1("lightMode", live.theme === "light" ? 1 : 0);
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
}

const pool: Live[] = [];

function tick(now: number) {
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
  if (pool.some((l) => !l.disposed && l.visible && l.frame)) return;
  const id = requestAnimationFrame(tick);
  for (const live of pool) {
    if (!live.disposed) live.frame = id;
  }
}

function destroyLive(live: Live) {
  if (live.disposed) return;
  live.disposed = true;
  live.visible = false;
  live.resize.disconnect();
  live.io.disconnect();
  if (live.mq && live.onMq) live.mq.removeEventListener("change", live.onMq);
  const gl = live.gl;
  gl.deleteProgram(live.program);
  const ext = gl.getExtension("WEBGL_lose_context");
  ext?.loseContext();
  const i = pool.indexOf(live);
  if (i >= 0) pool.splice(i, 1);
}

function evictIfNeeded(): boolean {
  while (pool.length >= MAX_CONTEXTS) {
    const idle = pool.find((l) => !l.visible);
    if (!idle) return false;
    destroyLive(idle);
  }
  return true;
}

export function mountShader(
  canvas: HTMLCanvasElement,
  record: ShaderRecord,
  options: { theme: ThemeName; mode: "card" | "hero" },
): { setTheme: (t: ThemeName) => void; destroy: () => void } {
  if (!evictIfNeeded()) {
    throw new Error("webgl pool full");
  }
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: "low-power",
  });
  if (!gl) throw new Error("WebGL2 unavailable");
  const program = link(gl, fragmentSource(record.type));
  const loc: Record<string, WebGLUniformLocation | null> = {};
  for (const k of UNIFORM_KEYS) loc[k] = gl.getUniformLocation(program, k);

  const live: Live = {
    canvas,
    gl,
    program,
    loc,
    record,
    theme: options.theme,
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
      if (live.visible) draw(live, performance.now());
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
