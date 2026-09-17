import { useEffect, useRef, useState } from "react";
import { mountShader, type ShaderRecord } from "@/lib/shaders";
import { useTheme } from "./theme-provider";
import { cn } from "@/lib/utils";

export function ShaderCanvas({
  record,
  mode,
  eager = false,
  className,
}: {
  record: ShaderRecord;
  mode: "card" | "hero";
  eager?: boolean;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<{ setTheme: (t: "dark" | "light") => void; destroy: () => void } | null>(
    null,
  );
  const { theme } = useTheme();
  const [on, setOn] = useState(eager);

  useEffect(() => {
    if (eager) {
      setOn(true);
      return;
    }
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        setOn(!!entries[0]?.isIntersecting);
      },
      { rootMargin: "160px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager]);

  useEffect(() => {
    if (!on) {
      apiRef.current?.destroy();
      apiRef.current = null;
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      apiRef.current = mountShader(canvas, record, { theme, mode });
    } catch {
      apiRef.current = null;
    }
    return () => {
      apiRef.current?.destroy();
      apiRef.current = null;
    };
  }, [on, record, mode]);

  useEffect(() => {
    apiRef.current?.setTheme(theme);
  }, [theme]);

  return (
    <div ref={wrapRef} className={cn("absolute inset-0", className)}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full"
        aria-hidden="true"
      />
    </div>
  );
}
