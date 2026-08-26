"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Search, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { catalog } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SearchPalette } from "@/components/search-palette";

const NAV = [
  { to: "/", label: "Map", search: { view: "map" as const } },
  { to: "/", label: "Chain", search: { view: "chain" as const } },
  { to: "/", label: "Software", search: { view: "software" as const } },
  { to: "/", label: "Companies", search: { view: "companies" as const } },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const view = new URLSearchParams(searchStr.startsWith("?") ? searchStr.slice(1) : searchStr).get("view") ?? "map";

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-[1480px] items-center justify-between gap-3 px-3 sm:px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="mark-disc size-9 text-[0.7rem]">Ae</span>
            <span className="leading-tight">
              <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted">
                Africa energy
              </span>
              <span className="block font-display text-[1.05rem] font-medium tracking-[-0.03em]">
                Software Map
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV.map((item) => {
              const active = pathname === "/" && view === item.search.view;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  search={item.search}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                    active ? "bg-ink text-surface" : "text-muted hover:bg-sunken hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted hover:bg-sunken hover:text-ink"
            >
              <Search className="size-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden rounded bg-sunken px-1.5 py-0.5 font-mono text-[0.65rem] text-faint lg:inline">
                /
              </kbd>
            </button>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/contribute" search={{ kind: undefined, about: undefined }}>Contribute</Link>
            </Button>
            <button
              type="button"
              className="grid size-11 place-items-center rounded-md hover:bg-sunken md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <div className="border-t border-line px-3 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  search={item.search}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-3 py-3 font-semibold hover:bg-sunken"
                >
                  {item.label}
                </Link>
              ))}
              <Link to="/about" onClick={() => setMenuOpen(false)} className="rounded-md px-3 py-3 font-semibold hover:bg-sunken">
                About
              </Link>
              <Link
                to="/contribute"
                search={{ kind: undefined, about: undefined }}
                onClick={() => setMenuOpen(false)}
                className="rounded-md bg-ink px-3 py-3 font-semibold text-surface"
              >
                Contribute
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      <footer className="border-t border-line bg-bg">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-muted sm:px-5">
          <p>
            Open atlas · {catalog.counts.software} software · {catalog.counts.companies} companies · release{" "}
            {catalog.version}
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/about" className="hover:text-ink">
              About
            </Link>
            <Link to="/contribute" search={{ kind: undefined, about: undefined }} className="hover:text-ink">
              Contribute
            </Link>
            <a href="https://kaykluz.com" className="hover:text-ink">
              kaykluz.com
            </a>
            <a href="https://github.com/kaykluz/africa-energy-software-map" className="hover:text-ink">
              Source data
            </a>
          </p>
        </div>
      </footer>
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
