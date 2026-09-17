import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteHeader active="about" />
      <main className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-sm text-fg-subtle">Fieldkit · phase 1</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight text-balance">
          A terminal tool for shader backgrounds.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-pretty text-fg-muted">
          Browse 2,240 generated fields, filter by effect type, copy WebGL,
          WebGPU, or React modules, and paste them into a site. No account. No
          claim flow. Theme colors live in <code className="font-mono text-fg">background.dark</code> and{" "}
          <code className="font-mono text-fg">background.light</code>. Pixel ratio is capped so
          high-DPI screens stay sharp without melting a laptop.
        </p>
        <p className="mt-4 text-base leading-relaxed text-pretty text-fg-muted">
          Username claiming, encryption, and risk controls are deferred to phase
          2. This page is a one-screen note, not a marketing site.
        </p>
        <p className="mt-4 text-sm text-fg-subtle">
          Theme preference is stored in localStorage. Nothing else is collected.
        </p>
        <Link
          to="/"
          search={{ view: "grid", rarity: "all", id: undefined }}
          className="mt-8 inline-flex h-10 items-center rounded-full bg-fg px-4 text-sm font-medium text-bg transition-[opacity] duration-150 hover:opacity-90"
        >
          Back to Explore
        </Link>
      </main>
    </div>
  );
}
