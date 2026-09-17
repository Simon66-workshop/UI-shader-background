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
  search: { view: "grid" | "immersive"; rarity: string; id: number | undefined };
}) {
  const share = `https://x.com/intent/tweet?text=${encodeURIComponent(
    `A Fieldkit field from @${record.handle}`,
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex justify-center px-3 pt-3 sm:px-4 sm:pt-4">
        <Link
          to="/"
          search={{ view: search.view, rarity: search.rarity, id: undefined }}
          className="rounded-full border border-border bg-bg-elevated px-4 py-2 text-sm text-fg-muted transition-[color] duration-150 hover:text-fg"
        >
          Close
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="relative aspect-[16/10] w-full max-w-5xl overflow-hidden rounded-[calc(var(--radius-xl)+8px)] bg-bg-subtle">
          <ShaderCanvas record={record} mode="hero" eager />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-3xl font-medium tracking-tight text-fg drop-shadow-[0_2px_16px_rgba(0,0,0,0.28)] sm:text-5xl">
              @{record.handle}
            </p>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4">
            <a
              href={share}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-bg/55 px-3 text-xs font-medium text-fg backdrop-blur-sm"
            >
              <Share2 className="size-3.5" />
              Share on X
            </a>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs tabular-nums text-fg/70">
                {formatId(record.id)}
              </span>
              <CopyMenu record={record} />
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
