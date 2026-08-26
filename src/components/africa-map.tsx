"use client";

import { useMemo, useState } from "react";
import mapPaths from "@/data/map-paths.json";
import {
  catalog,
  countryName,
  countryStatByIso,
  type CountryStat,
} from "@/lib/catalog";
import type { MapLayer } from "@/lib/atlas-search";
import { cn } from "@/lib/utils";

type MapCountry = {
  iso2: string;
  name: string;
  path: string;
  labelX: number;
  labelY: number;
  small: boolean;
  interactive: boolean;
};

const mapData = mapPaths as {
  viewBox: string;
  countries: MapCountry[];
};

function countOf(stat: CountryStat | undefined, layer: MapLayer) {
  if (!stat) return 0;
  return layer === "software" ? stat.software : stat.companies;
}

function fillFor(count: number, max: number) {
  if (count <= 0) return "var(--color-map-empty)";
  const t = Math.max(0.18, Math.min(1, Math.sqrt(count / max)));
  if (t < 0.4) return "var(--color-map-low)";
  if (t < 0.72) return "var(--color-map-mid)";
  return "var(--color-map-high)";
}

export function AfricaMap({
  layer,
  selected,
  onSelect,
}: {
  layer: MapLayer;
  selected?: string;
  onSelect: (iso2: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = useMemo(() => {
    let m = 1;
    for (const s of catalog.countryStats) m = Math.max(m, countOf(s, layer));
    return m;
  }, [layer]);

  const hoverStat = hover ? countryStatByIso.get(hover) : undefined;
  const selectedStat = selected ? countryStatByIso.get(selected) : undefined;

  return (
    <div className="relative h-full min-h-[320px] w-full overflow-hidden">
      <svg
        viewBox={mapData.viewBox}
        role="img"
        aria-label="Map of African countries"
        className="h-full w-full"
      >
        <title>Africa</title>
        {mapData.countries.map((c) => {
          const stat = countryStatByIso.get(c.iso2);
          const count = countOf(stat, layer);
          const isSel = selected === c.iso2;
          const isHover = hover === c.iso2;
          const interactive = c.interactive !== false && c.iso2.length === 2;
          return (
            <g key={c.iso2}>
              <path
                d={c.path}
                fill={isSel ? "var(--color-ink)" : fillFor(count, max)}
                stroke={isSel ? "var(--color-bg)" : "var(--color-bg)"}
                strokeWidth={isSel ? 1.6 : 0.7}
                className={cn(
                  "transition-[fill,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  interactive && "cursor-pointer",
                  isHover && !isSel && "brightness-110",
                )}
                tabIndex={interactive ? 0 : undefined}
                role={interactive ? "button" : undefined}
                aria-label={
                  interactive
                    ? `${c.name}, ${count} ${layer === "software" ? "software records" : "companies"}`
                    : c.name
                }
                onMouseEnter={() => interactive && setHover(c.iso2)}
                onMouseLeave={() => setHover((h) => (h === c.iso2 ? null : h))}
                onFocus={() => interactive && setHover(c.iso2)}
                onBlur={() => setHover((h) => (h === c.iso2 ? null : h))}
                onClick={() => interactive && onSelect(c.iso2)}
                onKeyDown={(e) => {
                  if (!interactive) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(c.iso2);
                  }
                }}
              />
              {c.small && interactive ? (
                <circle
                  cx={c.labelX}
                  cy={c.labelY}
                  r={isSel || isHover ? 7 : 5.5}
                  fill={isSel ? "var(--color-ink)" : fillFor(Math.max(count, 1), max)}
                  stroke="var(--color-bg)"
                  strokeWidth="1.4"
                  className="cursor-pointer"
                  onMouseEnter={() => setHover(c.iso2)}
                  onMouseLeave={() => setHover((h) => (h === c.iso2 ? null : h))}
                  onClick={() => onSelect(c.iso2)}
                />
              ) : null}
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-2 sm:left-4 sm:top-4">
        <div className="pointer-events-auto rounded-lg bg-surface/90 px-3 py-2 shadow-soft backdrop-blur-md">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-faint">
            {layer === "software" ? "Named software locations" : "Company presence"}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-ink">
            {hover
              ? countryName(hover)
              : selected
                ? countryName(selected)
                : "Select a country"}
          </p>
          <p className="text-xs text-muted tabular">
            {(() => {
              const s = hoverStat ?? selectedStat;
              if (!s) return "Click any state to open its records.";
              return `${s.software} software · ${s.companies} companies`;
            })()}
          </p>
        </div>
      </div>

      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1.5 text-[0.65rem] font-semibold text-muted shadow-soft backdrop-blur-md sm:bottom-4 sm:left-4">
        <span className="size-2.5 rounded-sm bg-map-empty" /> 0
        <span className="size-2.5 rounded-sm bg-map-low" />
        <span className="size-2.5 rounded-sm bg-map-mid" />
        <span className="size-2.5 rounded-sm bg-map-high" /> More
      </div>
    </div>
  );
}
