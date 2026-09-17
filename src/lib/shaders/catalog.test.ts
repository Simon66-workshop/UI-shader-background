import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATALOG, getCatalog, rarityCounts } from "./catalog.ts";
import { generateCopyText } from "./copy-code.ts";
import { fragmentSource, GLOW_FLOOR } from "./glsl.ts";
import { capPixelRatio } from "./rng.ts";
import {
  CATALOG_SIZE,
  COPY_FORMATS,
  EFFECT_META,
  EFFECT_TYPES,
  MAX_CONTEXTS,
  MAX_DIMENSION,
  MAX_PIXEL_RATIO,
  type EffectType,
} from "./types.ts";
import { CARD_MAX_DPR, HERO_MAX_DPR } from "./types.ts";
import { wgslSource } from "./wgsl.ts";

function ofType(type: EffectType) {
  const hit = CATALOG.find((s) => s.type === type);
  assert.ok(hit, type);
  return hit!;
}

describe("catalog", () => {
  it("AC-CAT-01 length is 2240", () => {
    assert.equal(getCatalog().length, CATALOG_SIZE);
    assert.equal(CATALOG.length, 2240);
  });

  it("AC-CAT-02 handles are unique", () => {
    const handles = CATALOG.map((s) => s.handle);
    assert.equal(new Set(handles).size, 2240);
  });

  it("AC-CAT-03 all nine types present", () => {
    const types = new Set(CATALOG.map((s) => s.type));
    for (const t of EFFECT_TYPES) assert.equal(types.has(t), true);
  });

  it("AC-CAT-04 quotas match the tech plan", () => {
    const counts = rarityCounts();
    for (const t of EFFECT_TYPES) {
      assert.equal(counts[t], EFFECT_META[t].quota, t);
    }
    const sum = EFFECT_TYPES.reduce((a, t) => a + EFFECT_META[t].quota, 0);
    assert.equal(sum, 2240);
  });

  it("AC-CAT-05 percentage error <= 1.0 point", () => {
    const counts = rarityCounts();
    for (const t of EFFECT_TYPES) {
      const pct = counts[t] / 2240;
      assert.ok(Math.abs(pct - EFFECT_META[t].weight) <= 0.01, t);
    }
  });
});

describe("copy text", () => {
  const sample = CATALOG[0]!;

  it("AC-COPY-01 four formats exist", () => {
    assert.deepEqual(
      COPY_FORMATS.map((f) => f.label),
      ["WebGL", "WebGPU", "React · WebGL", "React · WebGPU"],
    );
  });

  it("AC-COPY-02 WebGL contains API", () => {
    const text = generateCopyText(sample, "webgl");
    assert.match(text, /createShader/);
    assert.match(text, /setTheme/);
    assert.match(text, /destroy/);
  });

  it("AC-COPY-03 WebGPU contains WGSL and createShader", () => {
    const text = generateCopyText(sample, "webgpu");
    assert.match(text, /@fragment/);
    assert.match(text, /createShader/);
  });

  it("AC-COPY-04 React contains useEffect", () => {
    const text = generateCopyText(sample, "react-webgl");
    assert.match(text, /useEffect/);
    assert.match(text, /createShader/);
    const gpu = generateCopyText(sample, "react-webgpu");
    assert.match(gpu, /useEffect/);
    assert.match(gpu, /createShader/);
  });

  it("AC-COPY-05 HUE constant is inlined", () => {
    const text = generateCopyText(sample, "webgl");
    assert.match(text, /HUE/);
    const hue = sample.params.hue.toFixed(5);
    assert.ok(text.includes(hue.slice(0, 6)));
  });

  it("AC-COPY-07 pixel cap is present", () => {
    const text = generateCopyText(sample, "webgl");
    assert.match(text, /pixelRatio/);
    assert.match(text, new RegExp(String(MAX_DIMENSION)));
    assert.match(text, /background\.dark/);
    assert.match(text, /background\.light/);
    assert.match(text, /setTheme\("light"\)/);
  });
});

describe("hidpi caps", () => {
  it("AC-HIDPI-01 card dpr cap is 1.5", () => {
    assert.equal(capPixelRatio(3, CARD_MAX_DPR), 1.5);
  });
  it("AC-HIDPI-02 hero dpr cap is 2", () => {
    assert.equal(capPixelRatio(3, HERO_MAX_DPR), 2);
    assert.equal(MAX_PIXEL_RATIO, 2);
  });
  it("AC-GL-02 context pool is 10", () => {
    assert.equal(MAX_CONTEXTS, 10);
  });
});

describe("shader variants", () => {
  it("glow floor is 0.42 in both languages", () => {
    assert.equal(GLOW_FLOOR, 0.42);
    const glsl = fragmentSource("pure");
    const wgsl = wgslSource(ofType("pure"));
    assert.match(glsl, /mix\(0\.42, 1\.0, g\)/);
    assert.match(wgsl, /mix\(0\.42, 1\.0, g\)/);
  });

  it("pure program omits Bayer / ASCII / mosaic", () => {
    const src = fragmentSource("pure");
    assert.doesNotMatch(src, /bayer4/);
    assert.doesNotMatch(src, /glyph/);
    assert.doesNotMatch(src, /float cell/);
  });

  it("nine programs specialize post-process", () => {
    assert.match(fragmentSource("grain"), /hash21\(frag \+ floor\(t \* 24\.0\)\)/);
    assert.match(fragmentSource("ascii"), /glyph/);
    assert.match(fragmentSource("dither"), /bayer4/);
    assert.match(fragmentSource("halftone"), /smoothstep\(r, r - 0\.04/);
    assert.match(fragmentSource("sparkle"), /0\.984/);
    assert.match(fragmentSource("liquid"), /0\.22 \* vec2/);
    assert.match(fragmentSource("mosaic"), /float cell/);
    assert.match(fragmentSource("chroma"), /vec3\(r\.r, col\.g, b\.b\)/);
    assert.doesNotMatch(fragmentSource("liquid"), /bayer4/);
    assert.doesNotMatch(fragmentSource("dither"), /glyph/);
  });

  it("WGSL copy matches GLSL post-process for mosaic / ASCII / Bayer", () => {
    const ascii = wgslSource(ofType("ascii"));
    const dither = wgslSource(ofType("dither"));
    const mosaic = wgslSource(ofType("mosaic"));
    const grain = wgslSource(ofType("grain"));
    const sparkle = wgslSource(ofType("sparkle"));
    const chroma = wgslSource(ofType("chroma"));
    const liquid = wgslSource(ofType("liquid"));
    const halftone = wgslSource(ofType("halftone"));

    assert.match(ascii, /glyph/);
    assert.match(ascii, /vec2<f32>\(7\.0, 11\.0\)/);
    assert.match(dither, /fn bayer4/);
    assert.match(dither, /levels = 5\.0/);
    assert.match(mosaic, /let cell = mix\(8\.0, 28\.0, 0\.55\)/);
    assert.match(grain, /0\.12/);
    assert.match(sparkle, /6\.0 \* max\(u\.pixelRatio, 1\.0\)/);
    assert.match(chroma, /3\.2, 0\.0/);
    assert.match(liquid, /0\.22 \* vec2/);
    assert.match(halftone, /rotMul\(0\.4/);
    assert.match(ascii, /WARP_FREQ_X \* 0\.37/);
    assert.match(dither, /applyEffect/);
  });

  it("copied WebGPU modules are specialized per type", () => {
    const gpu = (t: EffectType) => generateCopyText(ofType(t), "webgpu");
    assert.match(gpu("ascii"), /glyph/);
    assert.doesNotMatch(gpu("ascii"), /fn bayer4/);
    assert.match(gpu("dither"), /fn bayer4/);
    assert.doesNotMatch(gpu("dither"), /glyph/);
    assert.match(gpu("mosaic"), /let cell = mix\(8\.0, 28\.0, 0\.55\)/);
    assert.match(gpu("pure"), /@fragment/);
    assert.doesNotMatch(gpu("pure"), /fn bayer4/);
  });
});
