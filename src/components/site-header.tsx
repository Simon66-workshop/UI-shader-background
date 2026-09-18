import { Link } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "./theme-provider";
import { cn } from "@/lib/utils";

function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4.5 15.5c3.2-3.8 6.4-3.8 9.6 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M2.8 12.2c4.4-5.2 8.8-5.2 13.2 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M1.2 8.8c5.6-6.6 11.2-6.6 16.8 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SiteHeader({ active }: { active: "explore" | "about" }) {
  const { theme, toggle } = useTheme();
  const exploreClass = cn(
    "rounded-full px-3 py-2 text-sm transition-[color,background-color] duration-150",
    active === "explore" ? "text-fg" : "text-fg-muted hover:bg-fg/6 hover:text-fg",
  );
  const aboutClass = cn(
    "rounded-full px-3 py-2 text-sm transition-[color,background-color] duration-150",
    active === "about" ? "text-fg" : "text-fg-muted hover:bg-fg/6 hover:text-fg",
  );

  return (
    <header className="sticky top-0 z-40 flex justify-center px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="flex w-full max-w-6xl items-center justify-between gap-3 rounded-full border border-border bg-bg/80 px-2 py-1.5 backdrop-blur-md">
        <Link
          to="/"
          search={{ view: "grid", rarity: "all", id: undefined, q: "" }}
          className="flex items-center gap-2 rounded-full py-1 pr-3 pl-2 text-fg transition-[opacity] duration-150 hover:opacity-80"
        >
          <Mark className="size-6" />
          <span className="text-sm font-medium tracking-tight">Fieldkit</span>
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Primary">
          <a
            href="https://github.com/Simon66-workshop/UI-shader-background"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full px-3 py-2 text-sm text-fg-muted transition-[color,background-color] duration-150 hover:bg-fg/6 hover:text-fg"
          >
            GitHub
          </a>
          <Link to="/about" className={aboutClass}>
            About
            {active === "about" ? (
              <span className="mx-auto mt-1 block size-1 rounded-full bg-fg" />
            ) : null}
          </Link>
          <Link
            to="/"
            search={{ view: "grid", rarity: "all", id: undefined, q: "" }}
            className={exploreClass}
          >
            Explore
            {active === "explore" ? (
              <span className="mx-auto mt-1 block size-1 rounded-full bg-fg" />
            ) : null}
          </Link>
        </nav>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
