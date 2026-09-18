import { inlinedFragment, paramList } from "./glsl.ts";
import {
  EFFECT_INDEX,
  MAX_DIMENSION,
  MAX_PIXEL_RATIO,
  THEME_FADE_MS,
  type CopyFormat,
  type ShaderRecord,
} from "./types.ts";
import { wgslSource } from "./wgsl.ts";

const RUNTIME_WEBGL = `
const MAX_PIXEL_RATIO = ${MAX_PIXEL_RATIO};
const MAX_DIMENSION = ${MAX_DIMENSION};
const THEME_FADE_MS = ${THEME_FADE_MS};

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || "compile failed");
  }
  return sh;
}

function parseHex(hex, fallback) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export async function createShader(canvas, options = {}) {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false });
  if (!gl) throw new Error("WebGL2 is required");
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FIELD_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "link failed");
  }
  const loc = (name) => gl.getUniformLocation(program, name);
  let theme = options.theme === "light" ? "light" : "dark";
  let lightMode = theme === "light" ? 1 : 0;
  let disposed = false;
  let frame = 0;
  let start = performance.now();
  let last = start;
  let inView = true;
  const background = {
    dark: (options.background && options.background.dark) || "#0a0a0b",
    light: (options.background && options.background.light) || "#f5f5f7",
  };

  function pageHidden() {
    return typeof document !== "undefined" && document.hidden;
  }

  function pixelRatioChanged() {
    refresh();
  }

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const rect = canvas.getBoundingClientRect();
    let w = Math.max(1, rect.width * dpr);
    let h = Math.max(1, rect.height * dpr);
    const edge = Math.max(w, h);
    if (edge > MAX_DIMENSION) {
      const s = MAX_DIMENSION / edge;
      w *= s;
      h *= s;
    }
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    gl.viewport(0, 0, canvas.width, canvas.height);
    return dpr;
  }

  function render(now) {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const target = theme === "light" ? 1 : 0;
    const step = dt / (THEME_FADE_MS / 1000);
    const d = target - lightMode;
    lightMode = Math.abs(d) <= step ? target : lightMode + Math.sign(d) * step;
    const dpr = size();
    gl.useProgram(program);
    gl.uniform2f(loc("resolution"), canvas.width, canvas.height);
    gl.uniform1f(loc("time"), (now - start) / 1000);
    gl.uniform1f(loc("lightMode"), lightMode);
    const dark = parseHex(background.dark, [0.039, 0.039, 0.043]);
    const light = parseHex(background.light, [0.961, 0.961, 0.969]);
    gl.uniform3f(loc("darkBackground"), dark[0], dark[1], dark[2]);
    gl.uniform3f(loc("lightBackground"), light[0], light[1], light[2]);
    gl.uniform1f(loc("pixelRatio"), dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function wantLoop() {
    return !disposed && inView && !pageHidden();
  }

  function refresh() {
    if (disposed) return;
    render(performance.now());
  }

  function tick(now) {
    if (!wantLoop()) {
      frame = 0;
      return;
    }
    render(now);
    frame = requestAnimationFrame(tick);
  }

  function kick() {
    if (!wantLoop() || frame) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function onVis() {
    if (pageHidden()) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      return;
    }
    kick();
  }

  const observer = new ResizeObserver(() => refresh());
  observer.observe(canvas);
  const intersection = new IntersectionObserver((entries) => {
    inView = !!entries[0]?.isIntersecting;
    if (inView) kick();
    else if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  });
  intersection.observe(canvas);
  window.addEventListener("resize", pixelRatioChanged);
  document.addEventListener("visibilitychange", onVis);

  kick();

  return {
    setTheme(next) {
      theme = next === "light" ? "light" : "dark";
      kick();
    },
    setBackground(next = {}) {
      if (next.dark) background.dark = next.dark;
      if (next.light) background.light = next.light;
      refresh();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      window.removeEventListener("resize", pixelRatioChanged);
      document.removeEventListener("visibilitychange", onVis);
      gl.deleteProgram(program);
    },
  };
}
`;

const RUNTIME_WEBGPU = `
const MAX_PIXEL_RATIO = ${MAX_PIXEL_RATIO};
const MAX_DIMENSION = ${MAX_DIMENSION};
const THEME_FADE_MS = ${THEME_FADE_MS};

function parseHex(hex, fallback) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export async function createShader(canvas, options = {}) {
  if (!navigator.gpu) throw new Error("WebGPU is required");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No GPU adapter");
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("webgpu context missing");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  const shader = device.createShaderModule({ code: FIELD_SHADER });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: shader, entryPoint: "vs" },
    fragment: { module: shader, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });
  const uniforms = device.createBuffer({
    size: 256,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const bind = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniforms } }],
  });

  let theme = options.theme === "light" ? "light" : "dark";
  let lightMode = theme === "light" ? 1 : 0;
  let disposed = false;
  let frame = 0;
  let start = performance.now();
  let last = start;
  let inView = true;
  const background = {
    dark: (options.background && options.background.dark) || "#0a0a0b",
    light: (options.background && options.background.light) || "#f5f5f7",
  };

  function pageHidden() {
    return typeof document !== "undefined" && document.hidden;
  }

  function pixelRatioChanged() {
    refresh();
  }

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const rect = canvas.getBoundingClientRect();
    let w = Math.max(1, rect.width * dpr);
    let h = Math.max(1, rect.height * dpr);
    const edge = Math.max(w, h);
    if (edge > MAX_DIMENSION) {
      const s = MAX_DIMENSION / edge;
      w *= s;
      h *= s;
    }
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    return dpr;
  }

  function render(now) {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const target = theme === "light" ? 1 : 0;
    const step = dt / (THEME_FADE_MS / 1000);
    const d = target - lightMode;
    lightMode = Math.abs(d) <= step ? target : lightMode + Math.sign(d) * step;
    const dpr = size();
    const dark = parseHex(background.dark, [0.039, 0.039, 0.043]);
    const light = parseHex(background.light, [0.961, 0.961, 0.969]);
    const data = new Float32Array(16);
    data[0] = canvas.width;
    data[1] = canvas.height;
    data[2] = (now - start) / 1000;
    data[3] = lightMode;
    data[4] = dark[0]; data[5] = dark[1]; data[6] = dark[2];
    data[8] = light[0]; data[9] = light[1]; data[10] = light[2];
    data[12] = dpr;
    device.queue.writeBuffer(uniforms, 0, data);
    const encoder = device.createCommandEncoder();
    const view = context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view, loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bind);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  function wantLoop() {
    return !disposed && inView && !pageHidden();
  }

  function refresh() {
    render(performance.now());
  }

  function tick(now) {
    if (!wantLoop()) {
      frame = 0;
      return;
    }
    render(now);
    frame = requestAnimationFrame(tick);
  }

  function kick() {
    if (!wantLoop() || frame) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function onVis() {
    if (pageHidden()) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      return;
    }
    kick();
  }

  const observer = new ResizeObserver(() => refresh());
  observer.observe(canvas);
  const intersection = new IntersectionObserver((entries) => {
    inView = !!entries[0]?.isIntersecting;
    if (inView) kick();
    else if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  });
  intersection.observe(canvas);
  window.addEventListener("resize", pixelRatioChanged);
  document.addEventListener("visibilitychange", onVis);
  kick();

  return {
    setTheme(next) {
      theme = next === "light" ? "light" : "dark";
      kick();
    },
    setBackground(next = {}) {
      if (next.dark) background.dark = next.dark;
      if (next.light) background.light = next.light;
      refresh();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      window.removeEventListener("resize", pixelRatioChanged);
      document.removeEventListener("visibilitychange", onVis);
    },
  };
}
`;

function reactWrapper(importName: string, handle: string) {
  return `import { useEffect, useRef } from "react";
import { createShader } from "./${importName}";

export function ShaderBackground({ theme = "dark", className, background }) {
  const ref = useRef(null);
  const dark = background && background.dark;
  const light = background && background.light;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let api;
    let cancelled = false;
    createShader(canvas, {
      theme: "dark",
      background: { dark, light },
    }).then((shader) => {
      if (cancelled) {
        shader.destroy();
        return;
      }
      api = shader;
      shader.setTheme(theme);
    });
    return () => {
      cancelled = true;
      api?.destroy();
    };
  }, [theme, dark, light]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}

export default ShaderBackground;
`;
}

export function generateCopyText(record: ShaderRecord, format: CopyFormat): string {
  const handle = record.handle;
  const fileWebgl = `${handle}-shader.webgl.js`;
  const fileWebgpu = `${handle}-shader.webgpu.js`;
  const header = (kind: string, extra = "") => `/*
 * @${handle} · Fieldkit
 * https://github.com/Simon66-workshop/UI-shader-background
 * ${kind}${extra}
 *
 * import { createShader } from "./${kind.includes("WebGPU") ? fileWebgpu : fileWebgl}";
 * const shader = await createShader(document.querySelector("canvas"), {
 *   theme: "dark",
 *   background: { dark: "#0a0a0b", light: "#f5f5f7" },
 * });
 * shader.setTheme("light");
 * shader.setBackground({ dark: "#111111", light: "#fafafa" });
 * shader.destroy();
 *
 * Size the canvas with CSS. background.dark / background.light are #rrggbb.
 */

`;

  if (format === "webgl") {
    const vertex = VERTEX_COPY;
    return (
      header("WebGL · JavaScript module", ` · ${record.type}`) +
      paramList(record.params) +
      `\nconst EFFECT = ${EFFECT_INDEX[record.type]}.0;\n\n` +
      `const VERTEX = \`${vertex}\`;\n\n` +
      `const FIELD_SHADER = \`${inlinedFragment(record)}\`;\n` +
      RUNTIME_WEBGL
    );
  }

  if (format === "webgpu") {
    return (
      header("WebGPU · JavaScript module", ` · ${record.type}`) +
      paramList(record.params) +
      `\nconst EFFECT = ${EFFECT_INDEX[record.type]}.0;\n\n` +
      `const FIELD_SHADER = \`${wgslSource(record)}\`;\n` +
      RUNTIME_WEBGPU
    );
  }

  if (format === "react-webgl") {
    return (
      `/*\n * @${handle} · Fieldkit · React · WebGL\n * Pass background={{ dark, light }} or call setBackground on the module API.\n */\n` +
      reactWrapper(fileWebgl, handle)
    );
  }

  return (
    `/*\n * @${handle} · Fieldkit · React · WebGPU\n * Pass background={{ dark, light }} or call setBackground on the module API.\n */\n` +
    reactWrapper(fileWebgpu, handle)
  );
}

const VERTEX_COPY = `#version 300 es
precision highp float;
const vec2 V[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main() {
  gl_Position = vec4(V[gl_VertexID], 0.0, 1.0);
}
`;
