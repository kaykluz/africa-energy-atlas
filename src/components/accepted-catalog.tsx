"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { listAcceptedRecords, mergeBySlug } from "@/lib/accepted-records";
import type { Company, Software } from "@/lib/catalog";

type AcceptedCatalog = {
  software: Software[];
  companies: Company[];
};

const EMPTY: AcceptedCatalog = { software: [], companies: [] };

const AcceptedCatalogContext = createContext<AcceptedCatalog>(EMPTY);

export function AcceptedCatalogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AcceptedCatalog>(EMPTY);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let cancelled = false;
    void listAcceptedRecords()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setState(EMPTY);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return <AcceptedCatalogContext.Provider value={state}>{children}</AcceptedCatalogContext.Provider>;
}

export function useAcceptedCatalog(): AcceptedCatalog {
  return useContext(AcceptedCatalogContext);
}

export { mergeBySlug };

export function useMergedSoftware(base: Software[]): Software[] {
  const { software } = useAcceptedCatalog();
  return useMemo(() => mergeBySlug(base, software), [base, software]);
}

export function useMergedCompanies(base: Company[]): Company[] {
  const { companies } = useAcceptedCatalog();
  return useMemo(() => mergeBySlug(base, companies), [base, companies]);
}

/**
 * Live counts for the public headline figures.
 *
 * `catalog.json` carries a `counts` block frozen at build time. Accepted
 * records were already merged into the LISTS but not into those numbers, so the
 * map could show a company the headline did not count — the figure only moved
 * when someone regenerated the catalogue. These are derived from the merged
 * data instead, so an acceptance in `/review` is reflected immediately and the
 * two can no longer disagree.
 */
export function useMergedCounts(base: {
  software: number;
  companies: number;
  reviewedSoftware: number;
  countriesWithSoftware: number;
  countriesWithCompanies: number;
}, baseSoftware: Software[], baseCompanies: Company[]) {
  const { software, companies } = useAcceptedCatalog();
  return useMemo(() => {
    const mergedSoftware = mergeBySlug(baseSoftware, software);
    const mergedCompanies = mergeBySlug(baseCompanies, companies);
    const softwareCountries = new Set<string>();
    for (const item of mergedSoftware) for (const c of item.countries ?? []) softwareCountries.add(c);
    const companyCountries = new Set<string>();
    for (const item of mergedCompanies) for (const c of item.countries ?? []) companyCountries.add(c);
    return {
      software: mergedSoftware.length,
      companies: mergedCompanies.length,
      reviewedSoftware: mergedSoftware.filter((item) => item.reviewed).length,
      // Fall back to the built figure when nothing has been accepted yet, so an
      // empty merge cannot make a country total read lower than the catalogue's.
      countriesWithSoftware: Math.max(softwareCountries.size, base.countriesWithSoftware),
      countriesWithCompanies: Math.max(companyCountries.size, base.countriesWithCompanies),
    };
  }, [base, baseSoftware, baseCompanies, software, companies]);
}
