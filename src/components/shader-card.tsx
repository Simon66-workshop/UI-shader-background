import { Link } from "@tanstack/react-router";
import { formatId, type ShaderRecord } from "@/lib/shaders";
import { CopyMenu } from "./copy-menu";
import { ShaderCanvas } from "./shader-canvas";

export function ShaderCard({
  record,
  search,
}: {
  record: ShaderRecord;
  search: { view: "grid" | "immersive"; rarity: string; id: number | undefined };
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
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-xl font-medium tracking-tight text-fg drop-shadow-[0_1px_8px_rgba(0,0,0,0.28)] sm:text-2xl">
            @{record.handle}
          </p>
        </div>
      </Link>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
        <span className="font-mono text-xs tabular-nums text-fg/70">
          {formatId(record.id)}
        </span>
        <div className="pointer-events-auto">
          <CopyMenu record={record} />
        </div>
      </div>
    </article>
  );
}
