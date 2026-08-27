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

/** An accepted organisation candidate, shaped as a public company record. */
type AcceptedOrgRow = {
  id: string; name: string; website: string; countries: string;
  role_ids: string; evidence_note: string; source_url: string;
  slug: string; reviewed_at: unknown;
};

/** Map the atlas role vocabulary onto the coarse `role` the map colours by. */
function roleFor(roleIds: string[]): string {
  if (roleIds.some((r) => r.startsWith("org_role_epc") || r.includes("installer") || r.includes("system_integrator"))) return "epc";
  if (roleIds.some((r) => r.includes("developer_ipp") || r.includes("asset_portfolio"))) return "developer";
  if (roleIds.some((r) => r.includes("om_asset_manager") || r.includes("energy_service"))) return "operator";
  if (roleIds.some((r) => r.includes("equipment_supplier") || r.includes("distributor"))) return "oem";
  return "enabler";
}

export function acceptedOrgToCompany(row: AcceptedOrgRow): Company {
  const countries = (row.countries || "")
    .split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  const roleIds = (row.role_ids || "").split(",").map((r) => r.trim()).filter(Boolean);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    summary: row.evidence_note,
    website: row.website ?? "",
    role: roleFor(roleIds),
    roles: [roleFor(roleIds)],
    hq: countries[0] ?? "",
    countries,
    africaWide: false,
    origin: "community",
    africaBuilt: false,
    // Editor-accepted from a research sweep. Never `reviewed`: an editor
    // confirmed the source names the company, not that the profile is verified.
    tier: "catalogue",
    lifecycle: "active",
    sourceUrl: row.source_url ?? "",
    productIds: [],
  };
}

async function loadAcceptedOrganisations(): Promise<Company[]> {
  const sql = await getSql();
  const rows = await sql<AcceptedOrgRow>`
    select id, name, website, countries, role_ids, evidence_note, source_url, slug, reviewed_at
    from organisation_candidates
    where status = ${"accepted"} and slug <> ${""}
    order by reviewed_at desc
    limit 5000
  `;
  return rows.map(acceptedOrgToCompany);
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
  // Organisations accepted in the review queue are public companies too. Both
  // sources are deduplicated against the built catalogue by slug, so a record
  // already shipped in catalog.json is never counted or listed twice.
  const seen = new Set(companies.map((c) => c.slug));
  for (const org of await loadAcceptedOrganisations()) {
    if (!seen.has(org.slug) && !getCompany(org.slug)) {
      companies.push(org);
      seen.add(org.slug);
    }
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
