"use client";

import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { catalog } from "@/lib/catalog";
import { type AtlasSearch, type AtlasView, type MapLayer } from "@/lib/atlas-search";
import { AfricaMap } from "@/components/africa-map";
import { ValueChain } from "@/components/value-chain";
import { CompanyGrid, SoftwareGrid } from "@/components/browse";
import { EntityPanel } from "@/components/entity-panel";
import { useMergedCounts } from "@/components/accepted-catalog";
import { cn } from "@/lib/utils";

export function AtlasPage() {
  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const view: AtlasView = search.view ?? "map";
  const layer: MapLayer = search.layer ?? "companies";
  const panelOpen = Boolean(search.sw || search.co || search.country);

  function patch(next: Partial<AtlasSearch>) {
    void navigate({
      search: (prev) => {
        const merged: AtlasSearch = { ...prev, ...next };
        const clean: AtlasSearch = {};
        for (const [k, v] of Object.entries(merged) as [keyof AtlasSearch, AtlasSearch[keyof AtlasSearch]][]) {
          if (v === undefined || v === "" || v === false) continue;
          (clean as Record<string, unknown>)[k] = v;
        }
        return clean;
      },
    });
  }

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
      {view === "map" ? (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <section className="relative min-h-[52vh] min-w-0 flex-1 overflow-hidden bg-sunken/40 md:min-h-0">
            <div className="absolute right-3 top-3 z-10 flex gap-1 rounded-full bg-surface p-1 shadow-soft sm:right-4 sm:top-4">
              <LayerBtn active={layer === "companies"} onClick={() => patch({ layer: "companies" })}>
                Companies
              </LayerBtn>
              <LayerBtn active={layer === "software"} onClick={() => patch({ layer: "software" })}>
                Software
              </LayerBtn>
            </div>
            <AfricaMap
              layer={layer}
              selected={search.country}
              onSelect={(iso) => patch({ country: iso, sw: undefined, co: undefined })}
            />
            <div className="pointer-events-none absolute bottom-3 right-3 hidden max-w-[220px] rounded-lg bg-surface/90 p-3 text-xs text-muted shadow-soft backdrop-blur-md sm:block">
              <p className="font-semibold text-ink">{catalog.counts.africaWideSoftware} Africa-wide</p>
              <p className="mt-1 leading-relaxed">
                Continent-tagged products stay off the map until a country is sourced.
              </p>
            </div>
          </section>
          <div
            className={cn(
              "z-20 bg-surface md:w-[380px] md:shrink-0",
              panelOpen ? "h-[46vh] md:h-auto" : "h-auto md:w-[380px]",
            )}
          >
            {panelOpen ? (
              <EntityPanel
                softwareSlug={search.sw}
                companySlug={search.co}
                countryIso={search.country}
                onClose={() => patch({ sw: undefined, co: undefined, country: undefined })}
                onOpenSoftware={(slug) => patch({ sw: slug, co: undefined })}
                onOpenCompany={(slug) => patch({ co: slug, sw: undefined })}
              />
            ) : (
              <MapIdle layer={layer} />
            )}
          </div>
        </div>
      ) : null}

      {view === "chain" ? (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="min-h-0 min-w-0 flex-1">
            <ValueChain
              stageId={search.stage}
              functionId={search.fn}
              onStage={(id) => patch({ view: "chain", stage: id, fn: undefined })}
              onFunction={(id) => patch({ fn: id })}
              onOpenSoftware={(slug) => patch({ sw: slug, co: undefined })}
            />
          </div>
          {search.sw || search.co ? (
            <div className="h-[46vh] md:h-auto md:w-[360px] md:shrink-0">
              <EntityPanel
                softwareSlug={search.sw}
                companySlug={search.co}
                onClose={() => patch({ sw: undefined, co: undefined })}
                onOpenSoftware={(slug) => patch({ sw: slug, co: undefined })}
                onOpenCompany={(slug) => patch({ co: slug, sw: undefined })}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {view === "software" ? (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="min-h-0 min-w-0 flex-1">
            <SoftwareGrid
              query={search.q}
              stageId={search.stage}
              relationship={search.rel}
              reviewedOnly={search.reviewed}
              onQuery={(q) => patch({ q: q || undefined })}
              onStage={(id) => patch({ stage: id })}
              onRelationship={(id) => patch({ rel: id })}
              onReviewed={(v) => patch({ reviewed: v || undefined })}
              onOpen={(slug) => patch({ sw: slug, co: undefined })}
            />
          </div>
          {search.sw ? (
            <div className="h-[46vh] md:h-auto md:w-[360px] md:shrink-0">
              <EntityPanel
                softwareSlug={search.sw}
                onClose={() => patch({ sw: undefined })}
                onOpenSoftware={(slug) => patch({ sw: slug })}
                onOpenCompany={(slug) => patch({ co: slug, sw: undefined })}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {view === "companies" ? (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="min-h-0 min-w-0 flex-1">
            <CompanyGrid
              query={search.q}
              role={search.role}
              onQuery={(q) => patch({ q: q || undefined })}
              onRole={(id) => patch({ role: id })}
              onOpen={(slug) => patch({ co: slug, sw: undefined })}
            />
          </div>
          {search.co ? (
            <div className="h-[46vh] md:h-auto md:w-[360px] md:shrink-0">
              <EntityPanel
                companySlug={search.co}
                onClose={() => patch({ co: undefined })}
                onOpenSoftware={(slug) => patch({ sw: slug, co: undefined })}
                onOpenCompany={(slug) => patch({ co: slug })}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

function LayerBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold",
        active ? "bg-ink text-surface" : "text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function MapIdle({ layer }: { layer: MapLayer }) {
  // Derived from the merged catalogue, so records accepted in /review are
  // counted the moment they are accepted rather than at the next rebuild.
  const counts = useMergedCounts(catalog.counts, catalog.software, catalog.companies);
  return (
    <div className="flex h-full flex-col justify-between p-5 md:p-6">
      <div>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faint">Open atlas</p>
        <h1 className="mt-2 font-display text-[2rem] font-medium leading-[1.08] tracking-[-0.03em] sm:text-[2.35rem]">
          Software across Africa’s energy value chain.
        </h1>
        <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-muted">
          Click a country. Follow a product to its company, stage and sources. Add what is missing.
        </p>
      </div>
      <dl className="mt-8 grid grid-cols-2 gap-x-4 gap-y-4">
        <Stat n={counts.software} label="Software records" />
        <Stat n={counts.companies} label="Companies" />
        <Stat n={counts.reviewedSoftware} label="Reviewed in depth" />
        <Stat
          n={layer === "software" ? counts.countriesWithSoftware : counts.countriesWithCompanies}
          label={layer === "software" ? "Countries with software" : "Countries with companies"}
        />
      </dl>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <dt className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">{label}</dt>
      <dd className="font-display text-3xl font-medium tabular">{n.toLocaleString()}</dd>
    </div>
  );
}
