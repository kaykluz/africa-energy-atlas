/**
 * Evidence rules for enrichment. Pure functions, no imports — shared by the
 * CI crawler (`scripts/enrich.mjs` re-implements nothing, it imports this via
 * --experimental-strip-types) and the site's server layer.
 *
 * The one law here, from the dataset repository's docs/04: source volume can
 * never substitute for source quality. A hundred tier-7 links leave a claim
 * exactly where one tier-7 link left it.
 */

/** docs/04 source hierarchy, abbreviated. Lower is stronger. */
export const TIER_LABEL: Record<number, string> = {
  1: "Customer, utility, regulator or government document",
  2: "DFI, funder or official programme document",
  3: "Named implementation partner or transaction document",
  4: "Academic or recognised industry research",
  5: "Reputable reporting with original investigation",
  6: "Provider documentation and case studies",
  7: "Aggregators and directories",
  8: "Community or anonymous submission",
};

export type EvidenceStatus =
  | "provider_claim_only"
  | "public_source"
  | "independently_evidenced";

export type SupportingObservation = {
  sourceTier: number;
  /** True when the observation is the subject's own website or publication. */
  selfPublished: boolean;
  relation: "supports" | "contradicts" | "context";
};

/**
 * Derive an assertion's evidence status from its supports.
 *
 * - Any tier 1–3 support that is not self-published → independently_evidenced.
 * - Any non-self-published support at all → public_source. Tiers 4–8 can reach
 *   here and NO FURTHER, regardless of how many there are.
 * - Only the subject's own material → provider_claim_only.
 *
 * `context` rows never move status; `contradicts` rows never move it UP.
 */
export function deriveEvidenceStatus(
  supports: readonly SupportingObservation[],
): EvidenceStatus {
  let independent = false;
  let publicSource = false;
  for (const s of supports) {
    if (s.relation !== "supports") continue;
    if (s.selfPublished) continue;
    publicSource = true;
    if (s.sourceTier >= 1 && s.sourceTier <= 3) independent = true;
  }
  if (independent) return "independently_evidenced";
  if (publicSource) return "public_source";
  return "provider_claim_only";
}

/**
 * Canonicalise a URL for deduplication.
 *
 * Kills the aggregator echo: the same article syndicated with five different
 * tracking query strings is one observation. Path and meaningful query survive;
 * scheme case, default ports, fragments and tracking parameters do not.
 */
export function canonicalUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL((raw || "").trim());
  } catch {
    return "";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }
  const TRACKING = /^(utm_|fbclid|gclid|mc_cid|mc_eid|ref|source|igshid)/;
  const keep = [...url.searchParams.entries()].filter(([k]) => !TRACKING.test(k));
  url.search = "";
  for (const [k, v] of keep.sort(([a], [b]) => a.localeCompare(b))) url.searchParams.append(k, v);
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}

/** Registrable-ish host for self-published checks. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Is `observationUrl` published by the subject itself?
 * Subdomains count: blog.acme.com is still Acme talking about Acme.
 */
export function isSelfPublished(observationUrl: string, subjectWebsite: string): boolean {
  const obs = hostOf(observationUrl);
  const own = hostOf(subjectWebsite);
  if (!obs || !own) return false;
  return obs === own || obs.endsWith(`.${own}`);
}

/**
 * Minimal robots.txt evaluation for one path.
 *
 * Deliberately conservative: we honour the union of rules for `*` and our own
 * agent, longest-match wins, and an unparseable file means DO NOT fetch. The
 * atlas crawls the same regulators and associations it depends on for
 * credibility — being turned away politely is part of the design, and a
 * blocked source is routed to a human, never worked around.
 */
export function robotsAllows(
  robotsTxt: string,
  path: string,
  agent = "AfricaEnergyAtlasBot",
): boolean {
  if (typeof robotsTxt !== "string") return false;
  if (!robotsTxt.trim()) return true; // empty file = no rules
  type Group = { agents: string[]; rules: Array<{ allow: boolean; prefix: string }> };
  const groups: Group[] = [];
  let current: Group | null = null;
  let sawAgentLine = false;
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === "user-agent") {
      if (!current || !sawAgentLine) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      sawAgentLine = true;
    } else if (field === "disallow" || field === "allow") {
      if (!current) continue;
      sawAgentLine = false;
      current.rules.push({ allow: field === "allow", prefix: value });
    } else {
      sawAgentLine = false;
    }
  }
  const ourAgent = agent.toLowerCase();
  const applicable =
    groups.find((g) => g.agents.some((a) => a !== "*" && ourAgent.includes(a))) ??
    groups.find((g) => g.agents.includes("*"));
  if (!applicable) return true;
  let best: { allow: boolean; length: number } | null = null;
  for (const rule of applicable.rules) {
    if (rule.prefix === "") {
      // "Disallow:" (empty) means allow everything for this group.
      if (!rule.allow && (!best || best.length < 0)) best = { allow: true, length: -1 };
      continue;
    }
    if (path.startsWith(rule.prefix) && (!best || rule.prefix.length > best.length)) {
      best = { allow: rule.allow, length: rule.prefix.length };
    }
  }
  return best ? best.allow : true;
}

/** Default tier for an observation kind, before a human refines it. */
export function defaultTier(kind: string): number {
  switch (kind) {
    case "regulator_filing":
    case "registry":
    case "tender":
      return 1;
    case "report":
      return 4;
    case "news":
      return 5;
    case "company_site":
    case "press_release":
      return 6;
    case "directory":
    case "social":
      return 7;
    default:
      return 7;
  }
}
