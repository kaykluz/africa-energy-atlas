import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { editorMiddleware } from "@/lib/editor-gate";
import { getCompany } from "@/lib/catalog";

/**
 * The organisation review queue.
 *
 * Rows arrive from the dataset repository's candidate batches, compiled into a
 * migration by `scripts/build-org-intake-migration.mjs`. They are research
 * leads, not records: each cites a page an agent opened, and nothing reaches
 * the public map until an editor accepts it here.
 *
 * This is deliberately separate from `contributions`, which carries public form
 * submissions. Those have no role or segment, and conflating the two would lose
 * exactly the attribute — EPC, installer, mini-grid developer — that these rows
 * exist to record.
 */

const DECISIONS = ["accept", "reject", "needs_evidence", "duplicate", "clear"] as const;
const STATUSES = ["received", "accepted", "needs_evidence", "rejected", "duplicate"] as const;

export type OrganisationStatus = (typeof STATUSES)[number];
export type OrganisationDecision = (typeof DECISIONS)[number];

export type OrganisationCandidate = {
  id: string;
  batchId: string;
  sourceKind: string;
  name: string;
  website: string;
  countries: string[];
  roleIds: string[];
  segmentIds: string[];
  evidenceNote: string;
  sourceUrl: string;
  flaggedPersonal: boolean;
  status: OrganisationStatus;
  note: string;
  slug: string;
  version: number;
  reviewedAt: string;
  reviewedByEmail: string;
};

export type OrganisationQueue = {
  items: OrganisationCandidate[];
  counts: Record<OrganisationStatus | "all" | "flagged", number>;
};

type Row = {
  id: string; batch_id: string; source_kind: string; name: string; website: string;
  countries: string; role_ids: string; segment_ids: string; evidence_note: string;
  source_url: string; flagged_personal: number; status: string; note: string;
  slug: string; version: number; reviewed_at: unknown; reviewed_by_email: string;
};

const list = (value: string) =>
  (value || "").split(",").map((item) => item.trim()).filter(Boolean);

function mapRow(row: Row): OrganisationCandidate {
  const status = STATUSES.includes(row.status as OrganisationStatus)
    ? (row.status as OrganisationStatus)
    : "received";
  return {
    id: row.id,
    batchId: row.batch_id ?? "",
    sourceKind: row.source_kind ?? "",
    name: row.name,
    website: row.website ?? "",
    countries: list(row.countries),
    roleIds: list(row.role_ids),
    segmentIds: list(row.segment_ids),
    evidenceNote: row.evidence_note ?? "",
    sourceUrl: row.source_url ?? "",
    flaggedPersonal: Number(row.flagged_personal) === 1,
    status,
    note: row.note ?? "",
    slug: row.slug ?? "",
    version: Number(row.version) || 1,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : "",
    reviewedByEmail: row.reviewed_by_email ?? "",
  };
}

const SELECT = `
  select id, batch_id, source_kind, name, website, countries, role_ids, segment_ids,
         evidence_note, source_url, flagged_personal, status, note, slug, version,
         reviewed_at, reviewed_by_email
  from organisation_candidates
`;

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "organisation";
}

/**
 * A slug nothing else already answers on.
 *
 * Arabic-script and other non-Latin names slugify to nothing useful, so they
 * fall back to the candidate id rather than colliding with each other on
 * `organisation`.
 */
async function uniqueSlug(
  sql: Awaited<ReturnType<typeof getSql>>,
  name: string,
  id: string,
): Promise<string> {
  const base = slugify(name);
  const usable = base !== "organisation" && !getCompany(base);
  if (usable) {
    const clash = await sql<{ id: string }>`
      select id from organisation_candidates where slug = ${base} and id <> ${id} limit 1
    `;
    if (clash.length === 0) return base;
  }
  return `${base}-${id.slice(-6)}`;
}

const filterSchema = z.object({
  status: z.enum(["all", ...STATUSES]).default("received"),
  query: z.string().trim().max(120).default(""),
  flaggedOnly: z.boolean().default(false),
  limit: z.number().int().min(1).max(300).default(150),
});

export const listOrganisationQueue = createServerFn({ method: "GET" })
  .middleware([editorMiddleware])
  .validator((data: unknown) => filterSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<OrganisationQueue> => {
    const sql = await getSql();
    const like = `%${data.query.toLowerCase()}%`;
    // `.query()` rather than the tagged template: the SELECT is trusted SQL and
    // must be inlined, whereas the template form would bind it as a parameter.
    // Every value below is still parameterised.
    const rows = await sql.query<Row>(
      `${SELECT}
       where ($1 = 'all' or status = $1)
         and ($2 = '' or lower(name) like $3 or lower(countries) like $3)
         and ($4 = 0 or flagged_personal = 1)
       order by flagged_personal desc, name
       limit $5`,
      [data.status, data.query, like, data.flaggedOnly ? 1 : 0, data.limit],
    );
    const totals = await sql<{ status: string; n: number }>`
      select status, count(*) as n from organisation_candidates group by status
    `;
    const flagged = await sql<{ n: number }>`
      select count(*) as n from organisation_candidates where flagged_personal = 1
    `;
    const counts = {
      all: 0, received: 0, accepted: 0, needs_evidence: 0, rejected: 0, duplicate: 0,
      flagged: Number(flagged[0]?.n ?? 0),
    } as OrganisationQueue["counts"];
    for (const row of totals) {
      const key = row.status as OrganisationStatus;
      if (key in counts) counts[key] = Number(row.n);
      counts.all += Number(row.n);
    }
    return { items: rows.map(mapRow), counts };
  });

const decideSchema = z.object({
  id: z.string().trim().min(3).max(120),
  version: z.number().int().positive().max(1_000_000),
  decision: z.enum(DECISIONS),
  note: z.string().trim().max(2000).default(""),
  sourceOpened: z.boolean().default(false),
});

function nextStatus(decision: OrganisationDecision): OrganisationStatus {
  if (decision === "accept") return "accepted";
  if (decision === "reject") return "rejected";
  if (decision === "needs_evidence") return "needs_evidence";
  if (decision === "duplicate") return "duplicate";
  return "received";
}

export const decideOrganisation = createServerFn({ method: "POST" })
  .middleware([editorMiddleware])
  .validator((data: unknown) => decideSchema.parse(data))
  .handler(async ({ context, data }): Promise<OrganisationCandidate> => {
    const note = data.note.trim();
    if (data.decision === "accept" && !data.sourceOpened) {
      throw new Error("Open the source and confirm it before accepting.");
    }
    if (data.decision !== "accept" && data.decision !== "clear" && note.length < 8) {
      throw new Error("Add a short note so the decision can be audited.");
    }

    const sql = await getSql();
    const current = await sql.query<Row>(`${SELECT} where id = $1 limit 1`, [data.id]);
    const row = current[0];
    if (!row) throw new Error("That candidate is no longer in the queue.");
    if (Number(row.version) !== data.version) {
      throw new Error("This record was updated in another session. Refresh and try again.");
    }

    const from = mapRow(row).status;
    const to = nextStatus(data.decision);
    const slug = to === "accepted" ? await uniqueSlug(sql, row.name, row.id) : "";
    const now = new Date().toISOString();

    await sql`
      update organisation_candidates
      set status = ${to}, note = ${note}, slug = ${slug},
          version = ${Number(row.version) + 1},
          reviewed_by_user_id = ${context.userId},
          reviewed_by_email = ${context.email},
          reviewed_at = ${now}
      where id = ${data.id} and version = ${data.version}
    `;

    const auditId = `oa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await sql`
      insert into contribution_audit
        (id, contribution_id, actor_user_id, actor_email, action, from_status, to_status, note)
      values (${auditId}, ${data.id}, ${context.userId}, ${context.email},
              ${data.decision}, ${from}, ${to}, ${note})
    `;

    const updated = await sql.query<Row>(`${SELECT} where id = $1 limit 1`, [data.id]);
    return mapRow(updated[0]!);
  });
