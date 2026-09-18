import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Grid2x2, PanelsTopLeft } from "lucide-react";
import { EFFECT_META, EFFECT_TYPES, type EffectType } from "@/lib/shaders";
import { cn } from "@/lib/utils";

export function ExploreToolbar({
  view,
  rarity,
  query,
  onView,
  onRarity,
  onQuery,
}: {
  view: "grid" | "immersive";
  rarity: "all" | EffectType;
  query: string;
  onView: (v: "grid" | "immersive") => void;
  onRarity: (r: "all" | EffectType) => void;
  onQuery: (q: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(query);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (draft !== query) onQuery(draft);
    }, 120);
    return () => window.clearTimeout(t);
  }, [draft, query, onQuery]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label =
    rarity === "all" ? "All rarities" : EFFECT_META[rarity].label;

  return (
    <div className="flex flex-col items-center gap-3 px-4">
      <div className="flex items-center gap-1 rounded-full border border-border bg-bg-elevated p-1">
        <button
          type="button"
          onClick={() => onView("immersive")}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm transition-[background-color,color] duration-150",
            view === "immersive"
              ? "bg-fg text-bg"
              : "text-fg-muted hover:text-fg",
          )}
        >
          <PanelsTopLeft className="size-4" />
          Immersive
        </button>
        <button
          type="button"
          onClick={() => onView("grid")}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm transition-[background-color,color] duration-150",
            view === "grid" ? "bg-fg text-bg" : "text-fg-muted hover:text-fg",
          )}
        >
          <Grid2x2 className="size-4" />
          Grid
        </button>
        <div ref={ref} className="relative ml-1">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm text-fg-muted transition-[color,background-color] duration-150 hover:text-fg"
          >
            {label}
            <ChevronDown className="size-3.5 text-fg-subtle" />
          </button>
          {open ? (
            <ul
              role="listbox"
              className="absolute top-11 right-0 z-30 w-48 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-bg-elevated p-1 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
            >
              <RarityRow
                selected={rarity === "all"}
                label="All rarities"
                onSelect={() => {
                  onRarity("all");
                  setOpen(false);
                }}
              />
              {EFFECT_TYPES.map((t) => (
                <RarityRow
                  key={t}
                  selected={rarity === t}
                  label={EFFECT_META[t].label}
                  hint={`${Math.round(EFFECT_META[t].weight * 100)}%`}
                  onSelect={() => {
                    onRarity(t);
                    setOpen(false);
                  }}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <label className="relative w-full max-w-sm">
        <span className="sr-only">Search handle or id</span>
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search @kestrel or #2240"
          className="h-10 w-full rounded-full border border-border bg-bg-elevated px-4 text-sm text-fg outline-none placeholder:text-fg-subtle focus-visible:ring-2 focus-visible:ring-ring/60"
        />
      </label>
    </div>
  );
}

function RarityRow({
  selected,
  label,
  hint,
  onSelect,
}: {
  selected: boolean;
  label: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className="flex h-9 w-full items-center justify-between rounded-[var(--radius-sm)] px-3 text-sm text-fg transition-[background-color] duration-150 hover:bg-fg/8"
      >
        <span className="flex items-center gap-2">
          {label}
          {selected ? <Check className="size-3.5 text-fg-muted" /> : null}
        </span>
        {hint ? <span className="text-fg-subtle">{hint}</span> : null}
      </button>
    </li>
  );
}
