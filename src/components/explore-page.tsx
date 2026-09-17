import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  EFFECT_META,
  EFFECT_TYPES,
  filterCatalog,
  findShader,
  formatId,
  type EffectType,
} from "@/lib/shaders";
import { CopyMenu } from "./copy-menu";
import { ExploreToolbar } from "./explore-toolbar";
import { ShaderCard } from "./shader-card";
import { ShaderCanvas } from "./shader-canvas";
import { ShaderDetail } from "./shader-detail";
import { SiteHeader } from "./site-header";

const GRID_PAGE = 18;
const IMMERSIVE_PAGE = 6;

function isEffect(v: string): v is EffectType {
  return (EFFECT_TYPES as readonly string[]).includes(v);
}

export function ExplorePage({
  view,
  rarity,
  id,
}: {
  view: "grid" | "immersive";
  rarity: string;
  id?: number;
}) {
  const rarityKey: "all" | EffectType = isEffect(rarity) ? rarity : "all";
  const navigate = useNavigate({ from: "/" });
  const list = useMemo(() => filterCatalog(rarityKey), [rarityKey]);
  const page = view === "immersive" ? IMMERSIVE_PAGE : GRID_PAGE;
  const [shown, setShown] = useState(page);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShown(page);
  }, [rarityKey, view, page]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setShown((n) => Math.min(list.length, n + page));
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [list.length, page, rarityKey, view]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || shown >= list.length) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < (window.innerHeight || 0) + 80) {
      setShown((n) => Math.min(list.length, n + page));
    }
  }, [shown, list.length, page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && id) {
        void navigate({ search: { view, rarity: rarityKey, id: undefined } });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, navigate, rarityKey, view]);

  const visible = list.slice(0, shown);
  const selected = id ? findShader(id) : undefined;
  const countLabel =
    rarityKey === "all"
      ? `${list.length.toLocaleString("en-US")} fields`
      : `${list.length.toLocaleString("en-US")} fields`;
  const sub =
    rarityKey === "all"
      ? "Every shader. Newest first."
      : `${EFFECT_META[rarityKey].label} shaders. Newest first.`;

  const search = { view, rarity: rarityKey, id: undefined as number | undefined };

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteHeader active="explore" />
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pt-8 pb-16 sm:pt-10">
        <ExploreToolbar
          view={view}
          rarity={rarityKey}
          onView={(next) => {
            void navigate({ search: { view: next, rarity: rarityKey, id: undefined } });
          }}
          onRarity={(next) => {
            void navigate({ search: { view, rarity: next, id: undefined } });
          }}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="max-w-xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            Pick a field. Paste it in.
          </h1>
          <p className="text-right text-sm text-fg-muted">
            <span className="block tabular-nums text-fg">{countLabel}</span>
            <span className="text-fg-subtle">{sub}</span>
          </p>
        </div>

        {view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((record) => (
              <ShaderCard key={record.id} record={record} search={search} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {visible.map((record) => (
              <article
                key={record.id}
                className="relative mx-auto aspect-[16/10] w-full max-w-4xl overflow-hidden rounded-[calc(var(--radius-xl)+4px)] bg-bg-subtle"
              >
                <Link
                  to="/"
                  search={{ ...search, id: record.id }}
                  className="absolute inset-0 block"
                  aria-label={`Open @${record.handle}`}
                >
                  <ShaderCanvas record={record} mode="hero" />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <p className="text-3xl font-medium tracking-tight text-fg drop-shadow-[0_2px_12px_rgba(0,0,0,0.28)] sm:text-5xl">
                      @{record.handle}
                    </p>
                  </div>
                </Link>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
                  <span className="font-mono text-xs tabular-nums text-fg/70">
                    {formatId(record.id)}
                  </span>
                  <CopyMenu record={record} />
                </div>
              </article>
            ))}
          </div>
        )}

        {shown < list.length ? (
          <div
            ref={sentinel}
            className="py-8 text-center text-sm text-fg-subtle"
          >
            Loading shaders…
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-fg-subtle">
            End of catalog.
          </p>
        )}
      </div>

      {selected ? <ShaderDetail record={selected} search={search} /> : null}

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-fg-subtle">
        <span>© 2026 Fieldkit</span>
        <span className="mx-2">·</span>
        <Link to="/about" className="hover:text-fg">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
