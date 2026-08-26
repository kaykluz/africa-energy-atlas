import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getCompany, getSoftware, type Company, type Software } from "@/lib/catalog";

type AcceptedRow = {
  id: string;
  kind: string;
  name: string;
  website: string;
  country_iso2: string;
  stage_id: string;
  summary: string;
  source_url: string;
  slug: string;
  reviewed_at: unknown;
};

function asDay(value: unknown): string {
  if (!value) return "";
  const raw = value instanceof Date ? value.toISOString() : String(value);
  return raw.slice(0, 10);
}

export function mergeBySlug<T extends { slug: string }>(base: T[], extra: T[]): T[] {
  if (!extra.length) return base;
  const seen = new Set(base.map((item) => item.slug));
  const more = extra.filter((item) => !seen.has(item.slug));
  return more.length ? [...more, ...base] : base;
}

export function acceptedToSoftware(row: AcceptedRow): Software {
  const iso = (row.country_iso2 ?? "").trim().toUpperCase();
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    companyId: "",
    companyName: "",
    website: row.website ?? "",
    categoryId: "",
    categoryIds: [],
    functionIds: [],
    sectorIds: [],
    stageIds: row.stage_id ? [row.stage_id] : [],
    relationship: "",
    countries: iso ? [iso] : [],
    africaWide: false,
    reviewed: false,
    origin: "community",
    africaBuilt: false,
    access: "",
    lifecycle: "active",
    openSourceUrl: "",
    capabilities: [],
    evidence: row.source_url ? [row.source_url] : [],
    kind: "community_accepted",
    lastChecked: asDay(row.reviewed_at),
    logo: "",
    sourceUrl: row.source_url ?? "",
  };
}

export function acceptedToCompany(row: AcceptedRow): Company {
  const iso = (row.country_iso2 ?? "").trim().toUpperCase();
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    summary: row.summary,
    website: row.website ?? "",
    role: "software",
    roles: ["software"],
    hq: iso,
    countries: iso ? [iso] : [],
    africaWide: false,
    origin: "community",
    africaBuilt: false,
    tier: "catalogue",
    lifecycle: "active",
    sourceUrl: row.source_url ?? "",
    productIds: [],
  };
}

async function loadAccepted(): Promise<AcceptedRow[]> {
  const sql = await getSql();
  return sql<AcceptedRow>`
    select id, kind, name, website, country_iso2, stage_id, summary, source_url, slug, reviewed_at
    from contributions
    where status = ${"accepted"}
      and slug <> ${""}
      and (kind = ${"software"} or kind = ${"company"})
    order by reviewed_at desc nulls last
    limit 200
  `;
}

export const listAcceptedRecords = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await loadAccepted();
  const software: Software[] = [];
  const companies: Company[] = [];
  for (const row of rows) {
    if (!row.slug) continue;
    if (row.kind === "software" && !getSoftware(row.slug)) software.push(acceptedToSoftware(row));
    if (row.kind === "company" && !getCompany(row.slug)) companies.push(acceptedToCompany(row));
  }
  return { software, companies };
});

export const resolvePublicSoftware = createServerFn({ method: "GET" })
  .validator((slug: unknown) => z.string().trim().min(1).max(160).parse(slug))
  .handler(async ({ data: slug }): Promise<Software | null> => {
    const fromCatalog = getSoftware(slug);
    if (fromCatalog) return fromCatalog;
    const sql = await getSql();
    const rows = await sql<AcceptedRow>`
      select id, kind, name, website, country_iso2, stage_id, summary, source_url, slug, reviewed_at
      from contributions
      where status = ${"accepted"} and kind = ${"software"} and slug = ${slug}
      limit 1
    `;
    const row = rows[0];
    return row ? acceptedToSoftware(row) : null;
  });

export const resolvePublicCompany = createServerFn({ method: "GET" })
  .validator((slug: unknown) => z.string().trim().min(1).max(160).parse(slug))
  .handler(async ({ data: slug }): Promise<Company | null> => {
    const fromCatalog = getCompany(slug);
    if (fromCatalog) return fromCatalog;
    const sql = await getSql();
    const rows = await sql<AcceptedRow>`
      select id, kind, name, website, country_iso2, stage_id, summary, source_url, slug, reviewed_at
      from contributions
      where status = ${"accepted"} and kind = ${"company"} and slug = ${slug}
      limit 1
    `;
    const row = rows[0];
    return row ? acceptedToCompany(row) : null;
  });
