import { Link } from "@tanstack/react-router";
import { Share2 } from "lucide-react";
import { formatId, type ShaderRecord } from "@/lib/shaders";
import { CopyMenu } from "./copy-menu";
import { ShaderCanvas } from "./shader-canvas";
import { Button } from "./ui/button";

export function ShaderDetail({
  record,
  search,
}: {
  record: ShaderRecord;
  search: { view: "grid" | "immersive"; rarity: string; id: number | undefined; q: string | undefined };
}) {
  const share = `https://x.com/intent/tweet?text=${encodeURIComponent(
    `A Fieldkit field from @${record.handle}`,
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex justify-center px-3 pt-3 sm:px-4 sm:pt-4">
        <Link
          to="/"
          search={{ view: search.view, rarity: search.rarity, id: undefined, q: search.q }}
          className="rounded-full border border-border bg-bg-elevated px-4 py-2 text-sm text-fg-muted transition-[color] duration-150 hover:text-fg"
        >
          Close
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="relative aspect-[16/10] w-full max-w-5xl overflow-hidden rounded-[calc(var(--radius-xl)+8px)] bg-bg-subtle">
          <ShaderCanvas record={record} mode="hero" eager />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-4 pt-12">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-medium tracking-tight text-white sm:text-2xl">
                  @{record.handle}
                </p>
                <span className="font-mono text-xs tabular-nums text-white/70">
                  {formatId(record.id)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={share}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-white/25 bg-black/40 px-3 text-xs font-medium text-white backdrop-blur-sm transition-[background-color] duration-150 hover:bg-black/55"
                >
                  <Share2 className="size-3.5" />
                  Share on X
                </a>
                <CopyMenu record={record} tone="on-field" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DetailKeyClose({ onClose }: { onClose: () => void }) {
  return (
    <Button className="sr-only" onClick={onClose}>
      Close
    </Button>
  );
}
