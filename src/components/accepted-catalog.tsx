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
