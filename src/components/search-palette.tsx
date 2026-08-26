"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { searchCatalog, type SearchHit } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { useAcceptedCatalog } from "@/components/accepted-catalog";

export function SearchPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { software: extraSoftware, companies: extraCompanies } = useAcceptedCatalog();
  const hits = useMemo(() => {
    const base = searchCatalog(query, 18);
    const q = query.trim().toLowerCase();
    if (q.length < 2) return base;
    const extra: SearchHit[] = [];
    for (const sw of extraSoftware) {
      if (`${sw.name} ${sw.summary}`.toLowerCase().includes(q)) {
        extra.push({
          type: "software",
          id: sw.id,
          slug: sw.slug,
          name: sw.name,
          context: "Editor accepted",
          href: `/software/${sw.slug}`,
        });
      }
    }
    for (const co of extraCompanies) {
      if (`${co.name} ${co.summary}`.toLowerCase().includes(q)) {
        extra.push({
          type: "company",
          id: co.id,
          slug: co.slug,
          name: co.name,
          context: "Editor accepted",
          href: `/companies/${co.slug}`,
        });
      }
    }
    if (!extra.length) return base;
    const seen = new Set(base.map((hit) => `${hit.type}:${hit.slug}`));
    return [...extra.filter((hit) => !seen.has(`${hit.type}:${hit.slug}`)), ...base].slice(0, 18);
  }, [query, extraSoftware, extraCompanies]);

  useEffect(() => {
    if (open) {
      setQuery("");
      const t = window.setTimeout(() => inputRef.current?.focus(), 20);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function go(hit: SearchHit) {
    onClose();
    void navigate({ to: hit.href });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-3 pt-[12vh] sm:p-6 sm:pt-[14vh]">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close search" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Search"
        className="relative w-full max-w-xl overflow-hidden rounded-xl bg-surface shadow-soft"
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="size-4 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Software, company or country"
            className="h-14 w-full bg-transparent text-base outline-none placeholder:text-faint"
          />
          <button type="button" onClick={onClose} className="grid size-11 place-items-center" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <p className="px-3 py-4 text-sm text-muted">Try PaygOps, Kenya, Beacon, or metering.</p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">
              No matches. Absence here is not evidence that a product does not exist.
            </p>
          ) : (
            <ul>
              {hits.map((hit) => (
                <li key={`${hit.type}-${hit.id}`}>
                  <button
                    type="button"
                    onClick={() => go(hit)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left hover:bg-sunken"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{hit.name}</span>
                      <span className="block truncate text-xs text-muted">{hit.context}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-[0.62rem] uppercase tracking-wider text-faint",
                      )}
                    >
                      {hit.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
