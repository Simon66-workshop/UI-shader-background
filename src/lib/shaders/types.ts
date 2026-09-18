export const EFFECT_TYPES = [
  "pure",
  "grain",
  "ascii",
  "dither",
  "halftone",
  "sparkle",
  "liquid",
  "mosaic",
  "chroma",
] as const;

export type EffectType = (typeof EFFECT_TYPES)[number];

export const EFFECT_META: Record<
  EffectType,
  { label: string; weight: number; quota: number }
> = {
  pure: { label: "Pure field", weight: 0.39, quota: 874 },
  grain: { label: "Grain", weight: 0.13, quota: 291 },
  ascii: { label: "ASCII", weight: 0.12, quota: 269 },
  dither: { label: "Dither", weight: 0.1, quota: 224 },
  halftone: { label: "Halftone", weight: 0.09, quota: 202 },
  sparkle: { label: "Sparkle", weight: 0.07, quota: 157 },
  liquid: { label: "Liquid", weight: 0.05, quota: 112 },
  mosaic: { label: "Mosaic", weight: 0.04, quota: 90 },
  chroma: { label: "Chroma", weight: 0.01, quota: 21 },
};

export const CATALOG_SIZE = 2240;

export const EFFECT_INDEX: Record<EffectType, number> = {
  pure: 0,
  grain: 1,
  ascii: 2,
  dither: 3,
  halftone: 4,
  sparkle: 5,
  liquid: 6,
  mosaic: 7,
  chroma: 8,
};

export type CopyFormat = "webgl" | "webgpu" | "react-webgl" | "react-webgpu";

export const COPY_FORMATS: { id: CopyFormat; label: string }[] = [
  { id: "webgl", label: "WebGL" },
  { id: "webgpu", label: "WebGPU" },
  { id: "react-webgl", label: "React · WebGL" },
  { id: "react-webgpu", label: "React · WebGPU" },
];

export type FieldParams = {
  hue: number;
  hueSpread: number;
  hueTravel: number;
  chroma: number;
  lightness: number;
  colourCycle: number;
  theta: number;
  shear: number;
  shrink: number;
  layers: number;
  warpFreqX: number;
  warpFreqY: number;
  warpAmpX: number;
  warpAmpY: number;
  aspectX: number;
  aspectY: number;
};

export type ShaderRecord = {
  id: number;
  handle: string;
  type: EffectType;
  params: FieldParams;
};

export const MAX_CONTEXTS = 10;
export const CARD_MAX_DPR = 1.5;
export const HERO_MAX_DPR = 2;
export const CARD_MAX_DIMENSION = 720;
export const HERO_MAX_DIMENSION = 1920;
export const MAX_DIMENSION = 1920;
export const MAX_PIXEL_RATIO = 2;
export const THEME_FADE_MS = 100;
