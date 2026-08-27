/**
 * Finding likely duplicate organisations.
 *
 * The queue arrives from many sources, and the same company appears under
 * different spellings and legal forms: `Eauxwel Nigeria Limited` from a NERC
 * permit table and `Eauxwell Nig. Ltd` from an REA press release are one firm.
 * Exact-name dedupe at intake cannot see that.
 *
 * WHY THIS SUGGESTS RATHER THAN MERGES SILENTLY
 *
 * Every automatic rule tested against the real 1,292 rows produced false
 * merges, and a merge is far harder to undo than a click:
 *
 *   - Stripping descriptive words collapsed `Solar Africa (Pty) Ltd` and
 *     `Solar Corporation` to the same key. Different companies.
 *   - Matching on shared website domain scored two right and one wrong:
 *     `Luken Solar` and `U Can Solar (Pty) Ltd.` both carry
 *     `lukensolar.co.za`, which is a sourcing error or a rebrand, not proof
 *     of one company.
 *   - An edit distance of two produced 21 pairs, nearly all wrong —
 *     `EZ Solar` ~ `JC Solar`, `GX Energy` ~ `HT Energy`.
 *
 * The rules below found exactly one pair in 1,292 rows: the true one. That is
 * the trade this module makes — high precision, deliberately low recall, with
 * an editor confirming. Silently merging two real companies loses a record and
 * nobody ever learns it happened.
 */

/** Legal forms only. Safe to ignore when comparing: they are never the name. */
const LEGAL =
  /\b(ltd|ltda|limited|plc|inc|llc|gmbh|sarl|sarlu|sas|srl|bv|nv|ag|pty|proprietary|cc|corp|corporation|company|incorporated)\b/g;

/**
 * Geography and generic descriptors. Stripping these finds `Nig.` vs
 * `Nigeria`, but it also collapses `Solar Africa` into `Solar`, so the result
 * is only ever used to SUGGEST, never to merge on its own.
 */
const DESCRIPTIVE =
  /\b(nig|nigeria|nigerian|kenya|kenyan|ghana|ghanaian|tanzania|uganda|zambia|zimbabwe|mozambique|senegal|egypt|morocco|tunisia|ethiopia|rwanda|malawi|africa|afrique|international|intl|group|holding|holdings|enterprise|enterprises|ent|ventures)\b/g;

function base(value: string): string {
  return (value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[‘’“”'`]/g, "")
    .replace(/\bt\/a\b/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ");
}

/** Name without legal form. Conservative: `Solar Africa` stays distinct. */
export function strictName(value: string): string {
  let text = base(value);
  for (let i = 0; i < 3; i += 1) text = text.replace(LEGAL, " ");
  return text.split(/\s+/).filter(Boolean).join(" ");
}

/** Name without legal form OR geography. Suggestion use only. */
export function looseName(value: string): string {
  let text = strictName(value);
  for (let i = 0; i < 3; i += 1) text = text.replace(DESCRIPTIVE, " ");
  return text.split(/\s+/).filter(Boolean).join(" ");
}

/** Registrable-ish host, for comparing websites. */
export function domainOf(url: string): string {
  const match = /^https?:\/\/([^/?#]+)/i.exec((url ?? "").trim());
  return match ? match[1].toLowerCase().replace(/^www\./, "") : "";
}

/** Levenshtein, bailing out early — only near-identical names interest us. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row.push(Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * Short names are where loose matching goes wrong, and it goes wrong in BOTH
 * directions — not only fuzzily.
 *
 * `Solar Africa (Pty) Ltd` and `Solar Corporation` both reduce to `solar` once
 * geography and legal forms are stripped, so they are *exactly* equal under the
 * loose rule while being different companies. A guard applied only to the fuzzy
 * branch would have let that through as a confident match. It applies to loose
 * equality too: below this length, a loose name has been stripped down to
 * something too generic to identify anyone.
 *
 * Strict equality is exempt — that compares real names with only the legal form
 * removed, so a short match there is a genuine one.
 */
const MIN_LOOSE_LENGTH = 6;

export type DuplicateReason = "same_name" | "near_name" | "same_website";

export type DuplicateCandidate = {
  id: string;
  name: string;
  countries: string[];
  website: string;
};

export type DuplicateMatch = {
  otherId: string;
  reason: DuplicateReason;
  detail: string;
};

/** Do these two share a country? Duplicates across countries are not assumed. */
function shareCountry(a: DuplicateCandidate, b: DuplicateCandidate): boolean {
  return a.countries.some((iso) => b.countries.includes(iso));
}

/**
 * Suggest duplicates for `item` among `others`.
 *
 * Never returns a match across countries: the same name in two markets is
 * routinely two firms, and the sweep records the operating country.
 */
export function findDuplicates(
  item: DuplicateCandidate,
  others: readonly DuplicateCandidate[],
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  const itemLoose = looseName(item.name);
  const itemStrict = strictName(item.name);
  const itemDomain = domainOf(item.website);

  for (const other of others) {
    if (other.id === item.id) continue;
    if (!shareCountry(item, other)) continue;

    const otherDomain = domainOf(other.website);
    if (itemDomain && otherDomain && itemDomain === otherDomain) {
      matches.push({
        otherId: other.id,
        reason: "same_website",
        detail: `Both give ${itemDomain} as their website`,
      });
      continue;
    }

    if (itemStrict && itemStrict === strictName(other.name)) {
      matches.push({
        otherId: other.id,
        reason: "same_name",
        detail: "Identical once the legal form is set aside",
      });
      continue;
    }

    const otherLoose = looseName(other.name);
    if (!itemLoose || !otherLoose) continue;
    if (Math.min(itemLoose.length, otherLoose.length) < MIN_LOOSE_LENGTH) continue;
    if (itemLoose === otherLoose) {
      matches.push({
        otherId: other.id,
        reason: "same_name",
        detail: "Identical once legal form and country words are set aside",
      });
      continue;
    }
    if (
      editDistance(itemLoose, otherLoose) === 1
    ) {
      matches.push({
        otherId: other.id,
        reason: "near_name",
        detail: `One character apart: “${itemLoose}” and “${otherLoose}”`,
      });
    }
  }
  return matches;
}
