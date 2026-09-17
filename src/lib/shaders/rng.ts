export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

export function capPixelRatio(dpr: number, cap: number): number {
  if (!Number.isFinite(dpr) || dpr <= 0) return 1;
  return Math.min(dpr, cap);
}

export function capDimension(width: number, height: number, maxEdge: number) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const edge = Math.max(w, h);
  if (edge <= maxEdge) return { width: Math.round(w), height: Math.round(h) };
  const scale = maxEdge / edge;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

export function formatId(id: number): string {
  return `#${id.toLocaleString("en-US")}`;
}
