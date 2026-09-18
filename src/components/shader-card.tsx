import { Link } from "@tanstack/react-router";
import { formatId, type ShaderRecord } from "@/lib/shaders";
import { CopyMenu } from "./copy-menu";
import { ShaderCanvas } from "./shader-canvas";

export function ShaderCard({
  record,
  search,
}: {
  record: ShaderRecord;
  search: { view: "grid" | "immersive"; rarity: string; id: number | undefined; q: string };
}) {
  return (
    <article className="group relative aspect-[16/10] overflow-hidden rounded-[var(--radius-xl)] bg-bg-subtle">
      <Link
        to="/"
        search={{ ...search, id: record.id }}
        className="absolute inset-0 block"
        aria-label={`Open @${record.handle}`}
      >
        <ShaderCanvas record={record} mode="card" />
      </Link>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-3 pt-10">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium tracking-tight text-white">
              @{record.handle}
            </p>
            <span className="font-mono text-xs tabular-nums text-white/70">
              {formatId(record.id)}
            </span>
          </div>
          <div className="pointer-events-auto shrink-0">
            <CopyMenu record={record} />
          </div>
        </div>
      </div>
    </article>
  );
}
