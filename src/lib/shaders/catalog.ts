import { mulberry32, range } from "./rng.ts";
import {
  CATALOG_SIZE,
  EFFECT_META,
  EFFECT_TYPES,
  type EffectType,
  type FieldParams,
  type ShaderRecord,
} from "./types.ts";

const FEATURED = [
  "kestrel",
  "iodine",
  "mirador",
  "northlane",
  "vellum",
  "lowtide",
  "amberlit",
  "sorae",
  "nock",
  "brine",
  "lumenor",
  "quartzite",
  "foldline",
  "cinderow",
  "paleorbit",
  "driftglass",
  "seiche",
  "umbrel",
  "halide",
  "nocturne",
  "rivulet",
  "ashveil",
  "copperfine",
  "silthe",
  "marlowe",
  "tinderbox",
  "opaline",
  "redshift",
  "gossamer",
  "keel",
  "larkspur",
  "minnow",
  "parhelion",
  "winnow",
  "caldera",
  "silt",
  "aureole",
  "nimbuslow",
  "paperkite",
  "solstice",
  "thimble",
  "vesper",
  "yarrow",
  "zinc",
  "boreal",
  "cairn",
  "dewpoint",
  "emberlit",
  "fathom",
  "glint",
  "harbor",
  "isobar",
  "juniper",
  "kith",
  "ledger",
  "meadow",
  "nacre",
  "oxbow",
  "plover",
  "quarry",
  "riprap",
  "shoal",
  "torii",
  "understory",
  "virga",
  "willow",
  "xylem",
  "yarn",
  "zephyr",
  "anvil",
  "basalt",
  "cobalt",
  "dunlin",
];

const A = [
  "ka",
  "lu",
  "ve",
  "no",
  "ri",
  "sa",
  "to",
  "mi",
  "ae",
  "or",
  "el",
  "ix",
  "yo",
  "ha",
  "zu",
  "qi",
  "ra",
  "ne",
  "do",
  "fi",
  "ju",
  "pe",
  "sy",
  "wa",
];
const B = [
  "lin",
  "dor",
  "vek",
  "run",
  "sol",
  "mir",
  "tan",
  "lox",
  "neth",
  "quell",
  "shade",
  "field",
  "row",
  "well",
  "spire",
  "mere",
  "glen",
  "vale",
  "rift",
  "fold",
];

function handleFromSeed(id: number, used: Set<string>): string {
  const featured = FEATURED[CATALOG_SIZE - id];
  if (featured && !used.has(featured)) return featured;
  const rng = mulberry32(id * 2654435761 + 97);
  for (let i = 0; i < 40; i++) {
    const a = A[Math.floor(rng() * A.length)]!;
    const b = B[Math.floor(rng() * B.length)]!;
    const n = rng() > 0.72 ? String(Math.floor(rng() * 90) + 10) : "";
    const h = `${a}${b}${n}`;
    if (!used.has(h) && h.length >= 4) return h;
  }
  return `field${id}`;
}

function paramsFromId(id: number): FieldParams {
  const rng = mulberry32(id * 1597334677 + 13);
  return {
    hue: range(rng, 0.0, 1.0),
    hueSpread: range(rng, 0.18, 0.55),
    hueTravel: range(rng, 0.7, 2.2),
    chroma: range(rng, 0.07, 0.22),
    lightness: range(rng, 0.42, 0.68),
    colourCycle: range(rng, 0.06, 0.28),
    theta: range(rng, 0.2, 5.9),
    shear: range(rng, 0.72, 0.99),
    shrink: range(rng, 0.86, 1.04),
    layers: Math.round(range(rng, 42, 88)),
    warpFreqX: range(rng, 0.22, 0.72),
    warpFreqY: range(rng, 1.4, 2.9),
    warpAmpX: range(rng, 0.08, 0.2),
    warpAmpY: range(rng, 0.02, 0.075),
    aspectX: range(rng, 0.85, 2.05),
    aspectY: range(rng, 0.12, 0.58),
  };
}

function typeBag(): EffectType[] {
  const bag: EffectType[] = [];
  for (const type of EFFECT_TYPES) {
    const n = EFFECT_META[type].quota;
    for (let i = 0; i < n; i++) bag.push(type);
  }
  const rng = mulberry32(20260917);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = bag[i]!;
    bag[i] = bag[j]!;
    bag[j] = tmp;
  }
  return bag;
}

function buildCatalog(): ShaderRecord[] {
  const types = typeBag();
  if (types.length !== CATALOG_SIZE) {
    throw new Error(`catalog quota sum ${types.length} != ${CATALOG_SIZE}`);
  }
  const used = new Set<string>();
  const records: ShaderRecord[] = [];
  for (let i = 0; i < CATALOG_SIZE; i++) {
    const id = CATALOG_SIZE - i;
    const handle = handleFromSeed(id, used);
    used.add(handle);
    records.push({
      id,
      handle,
      type: types[i]!,
      params: paramsFromId(id),
    });
  }
  return records;
}

export const CATALOG: ShaderRecord[] = buildCatalog();

export function getCatalog(): ShaderRecord[] {
  return CATALOG;
}

export function filterCatalog(rarity: "all" | EffectType): ShaderRecord[] {
  if (rarity === "all") return CATALOG;
  return CATALOG.filter((s) => s.type === rarity);
}

export function findShader(id: number): ShaderRecord | undefined {
  return CATALOG.find((s) => s.id === id);
}

export function rarityCounts(): Record<EffectType, number> {
  const counts = Object.fromEntries(EFFECT_TYPES.map((t) => [t, 0])) as Record<
    EffectType,
    number
  >;
  for (const s of CATALOG) counts[s.type] += 1;
  return counts;
}
