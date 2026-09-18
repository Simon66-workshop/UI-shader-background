import { createFileRoute } from "@tanstack/react-router";
import { ExplorePage } from "@/components/explore-page";
import { EFFECT_TYPES } from "@/lib/shaders";

function parseView(v: unknown): "grid" | "immersive" {
  return v === "immersive" ? "immersive" : "grid";
}

function parseRarity(v: unknown): string {
  if (typeof v === "string" && (v === "all" || (EFFECT_TYPES as readonly string[]).includes(v))) {
    return v;
  }
  return "all";
}

function parseId(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replaceAll('"', ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function parseQ(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return undefined;
  const s = v.trim().replaceAll('"', "");
  return s ? s : undefined;
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: parseView(search.view),
    rarity: parseRarity(search.rarity),
    id: parseId(search.id),
    q: parseQ(search.q),
  }),
  component: ExploreRoute,
});

function ExploreRoute() {
  const { view, rarity, id, q } = Route.useSearch();
  return <ExplorePage view={view} rarity={rarity} id={id} q={q ?? ""} />;
}
