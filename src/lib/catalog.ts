import raw from "@/data/catalog.json";

export type Stage = {
  id: string;
  name: string;
  order: number;
  categories: { id: string; name: string }[];
};

export type Fn = { id: string; name: string; stageIds: string[] };
export type Sector = { id: string; name: string };
export type Relationship = { id: string; name: string };
export type Country = { iso2: string; name: string };
export type CountryStat = {
  iso2: string;
  name: string;
  software: number;
  companies: number;
  deployments: number;
};

export type Software = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  companyId: string;
  companyName: string;
  website: string;
  categoryId: string;
  categoryIds: string[];
  functionIds: string[];
  sectorIds: string[];
  stageIds: string[];
  relationship: string;
  countries: string[];
  africaWide: boolean;
  reviewed: boolean;
  origin: string;
  africaBuilt: boolean;
  access: string;
  lifecycle: string;
  openSourceUrl: string;
  capabilities: string[];
  evidence: string[];
  kind: string;
  lastChecked: string;
  logo: string;
  sourceUrl?: string;
  sourceIds?: string[];
  landscapeId?: string;
};

export type Company = {
  id: string;
  name: string;
  slug: string;
  summary: string;
  website: string;
  role: string;
  roles: string[];
  hq: string;
  hqCity?: string;
  origin?: string;
  africaBuilt?: boolean;
  countries: string[];
  africaWide: boolean;
  tier: "reviewed" | "landscape" | "catalogue";
  lifecycle: string;
  logo?: string;
  sourceUrl?: string;
  segments?: string[];
  relationship?: string;
  productIds: string[];
};

export type Deployment = {
  id: string;
  softwareId: string;
  country: string;
  area: string;
  customer: string;
  status: string;
  year: string;
  evidence: string;
  sourceId: string;
};

export type Source = {
  id: string;
  url: string;
  title: string;
  publisher: string;
  independence: string;
  retrieved: string;
};

export type Catalog = {
  version: string;
  asOf: string;
  releaseLabel: string;
  counts: {
    software: number;
    reviewedSoftware: number;
    companies: number;
    deployments: number;
    sources: number;
    countriesWithSoftware: number;
    countriesWithCompanies: number;
    africaWideSoftware: number;
  };
  stages: Stage[];
  functions: Fn[];
  sectors: Sector[];
  relationships: Relationship[];
  countries: Country[];
  countryStats: CountryStat[];
  software: Software[];
  companies: Company[];
  deployments: Deployment[];
  sources: Source[];
};

export const catalog = raw as Catalog;

const CROSS = "stage_cross_cutting";

function normStage(id: string) {
  if (id === "cross_cutting" || id === "cross-cutting") return CROSS;
  return id;
}

for (const sw of catalog.software) {

  sw.stageIds = Array.from(new Set((sw.stageIds || []).map(normStage)));
  sw.countries = sw.countries ?? [];
  sw.functionIds = sw.functionIds ?? [];
  sw.capabilities = sw.capabilities ?? [];
  sw.categoryIds = sw.categoryIds ?? [];
}
for (const co of catalog.companies) {
  co.productIds = co.productIds ?? [];
  co.countries = co.countries ?? [];
  co.roles = co.roles ?? [];
}

export const stages = [...catalog.stages].sort((a, b) => a.order - b.order);
export const coreStages = stages.filter((s) => s.id !== CROSS);
export const functions = catalog.functions;
export const countries = catalog.countries;
export const countryStats = catalog.countryStats;

export const software = catalog.software;
export const companies = catalog.companies;
export const deployments = catalog.deployments;
export const sources = catalog.sources;

export const softwareById = new Map(software.map((s) => [s.id, s]));
export const softwareBySlug = new Map(software.map((s) => [s.slug, s]));
export const companyById = new Map(companies.map((c) => [c.id, c]));
export const companyBySlug = new Map(companies.map((c) => [c.slug, c]));
export const countryByIso = new Map(countries.map((c) => [c.iso2, c]));
export const countryStatByIso = new Map(countryStats.map((c) => [c.iso2, c]));
export const stageById = new Map(stages.map((s) => [s.id, s]));
export const functionById = new Map(functions.map((f) => [f.id, f]));
export const relationshipById = new Map(catalog.relationships.map((r) => [r.id, r]));
export const sourceById = new Map(sources.map((s) => [s.id, s]));
export const categoryNameById = new Map(
  stages.flatMap((s) => s.categories.map((c) => [c.id, c.name] as const)),
);

const deploymentsBySoftware = new Map<string, Deployment[]>();
for (const d of deployments) {
  const list = deploymentsBySoftware.get(d.softwareId) ?? [];
  list.push(d);
  deploymentsBySoftware.set(d.softwareId, list);
}

const softwareByCountry = new Map<string, Software[]>();
const companiesByCountry = new Map<string, Company[]>();
const softwareByStage = new Map<string, Software[]>();
const softwareByFunction = new Map<string, Software[]>();

function push<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

for (const sw of software) {
  for (const iso of sw.countries) push(softwareByCountry, iso, sw);
  for (const sid of sw.stageIds.length ? sw.stageIds : ["unclassified"]) {
    push(softwareByStage, sid, sw);
  }
  for (const fid of sw.functionIds) push(softwareByFunction, fid, sw);
}

for (const co of companies) {
  const seen = new Set<string>();
  for (const iso of co.countries) {
    if (seen.has(iso)) continue;
    seen.add(iso);
    push(companiesByCountry, iso, co);
  }
  if (co.hq && !seen.has(co.hq)) push(companiesByCountry, co.hq, co);
}

export const ROLE_LABEL: Record<string, string> = {
  software: "Software & data",
  operator: "Operator",
  developer: "Developer",
  oem: "OEM",
  epc: "EPC",
  financier: "Financier",
  enabler: "Enabler",
  public: "Public institution",
  other: "Other",
};

export const ROLE_ORDER = [
  "software",
  "operator",
  "developer",
  "oem",
  "epc",
  "financier",
  "enabler",
  "public",
] as const;

export function countryName(iso2: string) {
  return countryByIso.get(iso2)?.name ?? iso2;
}

export function stageName(id: string) {
  return stageById.get(normStage(id))?.name ?? id;
}

export function functionName(id: string) {
  return functionById.get(id)?.name ?? id;
}

export function relationshipName(id: string) {
  return relationshipById.get(id)?.name ?? id;
}

export function getSoftware(idOrSlug: string) {
  return softwareById.get(idOrSlug) ?? softwareBySlug.get(idOrSlug);
}

export function getCompany(idOrSlug: string) {
  return companyById.get(idOrSlug) ?? companyBySlug.get(idOrSlug);
}

export function softwareDeployments(id: string) {
  return deploymentsBySoftware.get(id) ?? [];
}

export function softwareInCountry(iso2: string) {
  return softwareByCountry.get(iso2) ?? [];
}

export function companiesInCountry(iso2: string) {
  return companiesByCountry.get(iso2) ?? [];
}

export function softwareInStage(stageId: string) {
  return softwareByStage.get(normStage(stageId)) ?? [];
}

export function softwareInFunction(fnId: string) {
  return softwareByFunction.get(fnId) ?? [];
}

export function companyProducts(company: Company) {
  return company.productIds.map((id) => softwareById.get(id)).filter(Boolean) as Software[];
}

export function softwareSources(sw: Software) {
  return (sw.sourceIds ?? []).map((id) => sourceById.get(id)).filter(Boolean) as Source[];
}

export function relatedSoftware(sw: Software, limit = 8) {
  const pool = new Map<string, Software>();
  for (const fid of sw.functionIds) {
    for (const other of softwareInFunction(fid)) {
      if (other.id !== sw.id) pool.set(other.id, other);
    }
  }
  if (pool.size < limit) {
    for (const sid of sw.stageIds) {
      for (const other of softwareInStage(sid)) {
        if (other.id !== sw.id) pool.set(other.id, other);
      }
    }
  }
  return [...pool.values()]
    .sort((a, b) => Number(b.reviewed) - Number(a.reviewed) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function functionsForStage(stageId: string) {
  const sid = normStage(stageId);
  return functions.filter((f) => f.stageIds.includes(sid) || (sid === CROSS && f.stageIds.length === 0));
}

function hay(parts: Array<string | undefined>) {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export type SearchHit = {
  type: "software" | "company" | "country";
  id: string;
  slug: string;
  name: string;
  context: string;
  href: string;
  reviewed?: boolean;
};

export function searchCatalog(query: string, limit = 24): SearchHit[] {
  const q = hay([query]).trim();
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];

  for (const c of countries) {
    if (hay([c.name, c.iso2]).includes(q)) {
      const stat = countryStatByIso.get(c.iso2);
      hits.push({
        type: "country",
        id: c.iso2,
        slug: c.iso2.toLowerCase(),
        name: c.name,
        context: `${stat?.software ?? 0} software · ${stat?.companies ?? 0} companies`,
        href: `/countries/${c.iso2.toLowerCase()}`,
      });
    }
  }

  for (const sw of software) {
    if (
      hay([
        sw.name,
        sw.companyName,
        sw.summary,
        ...sw.capabilities,
        ...sw.functionIds.map(functionName),
      ]).includes(q)
    ) {
      hits.push({
        type: "software",
        id: sw.id,
        slug: sw.slug,
        name: sw.name,
        context: sw.companyName || relationshipName(sw.relationship),
        href: `/software/${sw.slug}`,
        reviewed: sw.reviewed,
      });
    }
  }

  for (const co of companies) {
    if (hay([co.name, co.summary, ROLE_LABEL[co.role], co.hq]).includes(q)) {
      hits.push({
        type: "company",
        id: co.id,
        slug: co.slug,
        name: co.name,
        context: ROLE_LABEL[co.role] || co.role,
        href: `/companies/${co.slug}`,
        reviewed: co.tier === "reviewed",
      });
    }
  }

  hits.sort((a, b) => {
    const rank = { software: 0, country: 1, company: 2 };
    const aExact = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bExact = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    return (
      aExact - bExact ||
      Number(Boolean(b.reviewed)) - Number(Boolean(a.reviewed)) ||
      rank[a.type] - rank[b.type] ||
      a.name.localeCompare(b.name)
    );
  });

  return hits.slice(0, limit);
}

export function evidenceLabel(status: string) {
  if (status === "independently_evidenced") return "Independent evidence";
  if (status === "customer_confirmed") return "Customer confirmed";
  if (status === "provider_claim_only") return "Provider claim";
  if (status === "public_source") return "Public source";
  return status.replace(/_/g, " ");
}

export function accessLabel(value: string) {
  if (!value) return "";
  if (value === "commercial_proprietary") return "Commercial";
  if (value.includes("open")) return "Open source";
  return value.replace(/_/g, " ");
}

export const MAP_LAYER = {
  companies: "companies",
  software: "software",
} as const;
