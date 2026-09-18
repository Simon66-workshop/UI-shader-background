import { useEffect, useId, useRef, useState } from "react";
import { COPY_FORMATS, generateCopyText, type CopyFormat, type ShaderRecord } from "@/lib/shaders";
import { cn } from "@/lib/utils";

export function CopyMenu({
  record,
  align = "end",
  tone = "default",
}: {
  record: ShaderRecord;
  align?: "start" | "end";
  tone?: "default" | "on-field";
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<CopyFormat | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copy(format: CopyFormat) {
    const text = generateCopyText(record, format);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(format);
    window.setTimeout(() => {
      setCopied(null);
      setOpen(false);
    }, 1200);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium backdrop-blur-sm",
          "transition-[opacity,transform,background-color] duration-150 ease-out active:scale-[0.96]",
          tone === "on-field"
            ? "border-white/25 bg-black/40 text-white hover:bg-black/55"
            : "border-border bg-bg/55 text-fg hover:bg-bg/80",
        )}
      >
        <span aria-hidden className={tone === "on-field" ? "text-white/70" : "text-fg-muted"}>
          {"</>"}
        </span>
        Copy code
      </button>
      {open ? (
        <ul
          id={menuId}
          role="menu"
          className={cn(
            "absolute z-30 mt-2 min-w-[11.5rem] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-bg-elevated p-1 shadow-[0_12px_40px_rgba(0,0,0,0.35)]",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {COPY_FORMATS.map((f) => (
            <li key={f.id} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  void copy(f.id);
                }}
                className="flex h-9 w-full items-center justify-between rounded-[var(--radius-sm)] px-3 text-left text-sm text-fg transition-[background-color] duration-150 hover:bg-fg/8"
              >
                <span>{f.label}</span>
                {copied === f.id ? (
                  <span className="text-xs text-fg-muted">Copied</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
