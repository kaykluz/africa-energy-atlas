import type { Company, Software } from "@/lib/catalog";

/**
 * Why a record appears in the country a reader has selected.
 *
 * The map used to answer this with a single repeated "Catalogue" badge, which
 * says only "not reviewed in depth" — nothing about whether the organisation
 * works there, is headquartered there, was founded there, or merely claims
 * continent-wide coverage. Those are very different facts and a reader
 * comparing two rows deserves to see which one they are looking at.
 *
 * Ported from kaykluz/africa-energy-software-map#87, which fixed the same
 * defect in the retired Next.js app.
 *
 * Deliberately narrower than that PR. It labelled presence as evidenced,
 * company-stated, software-linked, offices or availability, which the reviewed
 * dataset carries per country as `locationTypes`. `catalog.json` does not emit
 * those, so inventing them here would be a label the data cannot justify.
 * These four are the reasons this catalogue can actually support.
 */
export type PresenceReason = "named" | "headquarters" | "africa_wide" | "origin";

const LABEL: Record<PresenceReason, string> = {
  named: "Named activity",
  headquarters: "HQ",
  africa_wide: "Africa-wide",
  origin: "Origin",
};

const DETAIL: Record<PresenceReason, string> = {
  named: "A source names activity in this country",
  headquarters: "Headquartered in this country",
  africa_wide: "Recorded as Africa-wide, not named for this country",
  origin: "Country of origin",
};

/** Every reason this company is shown under `iso`, strongest first. */
export function companyPresence(item: Company, iso: string): PresenceReason[] {
  const reasons: PresenceReason[] = [];
  if (item.countries?.includes(iso)) reasons.push("named");
  if (item.hq === iso) reasons.push("headquarters");
  if (item.origin === iso) reasons.push("origin");
  // Africa-wide is listed last and only on its own: it is the weakest claim,
  // and showing it beside a named country would overstate a general one.
  if (!reasons.length && item.africaWide) reasons.push("africa_wide");
  return reasons;
}

/** Every reason this product is shown under `iso`, strongest first. */
export function softwarePresence(item: Software, iso: string): PresenceReason[] {
  const reasons: PresenceReason[] = [];
  if (item.countries?.includes(iso)) reasons.push("named");
  if (!reasons.length && item.africaWide) reasons.push("africa_wide");
  return reasons;
}

/** Short label for a row. Two at most, then a count, so a row stays readable. */
export function presenceShortLabel(reasons: PresenceReason[]): string {
  if (!reasons.length) return "Listed";
  const labels = reasons.map((reason) => LABEL[reason]);
  if (labels.length > 2) return `${labels[0]} +${labels.length - 1}`;
  return labels.join(" · ");
}

/** The full reason, for a `title` attribute. Never truncated. */
export function presenceDetail(reasons: PresenceReason[]): string {
  if (!reasons.length) return "Listed in the directory for this country";
  return reasons.map((reason) => DETAIL[reason]).join("; ");
}

/**
 * The logo to show for a product.
 *
 * A product without its own mark inherits its owner's, rather than falling
 * straight to initials — the owner's identity is the more useful signal, and
 * the atlas ships only a small number of approved organisation logos.
 */
export function productLogo(item: Software, ownerLogo?: string): string {
  return item.logo || ownerLogo || "";
}
