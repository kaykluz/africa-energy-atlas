import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { editorMiddleware, optionalSessionMiddleware } from "@/lib/editor-gate";
import { getCompany, getSoftware } from "@/lib/catalog";

const KINDS = ["software", "company", "correction"] as const;
const DECISIONS = ["accept", "reject", "needs_evidence", "duplicate", "clear"] as const;
const QUEUE_STATUSES = ["received", "accepted", "needs_evidence", "rejected", "duplicate"] as const;

const submitSchema = z.object({
  kind: z.enum(KINDS),
  name: z.string().trim().min(2).max(160),
  website: z.string().trim().max(400).optional().or(z.literal("")),
  countryIso2: z.string().trim().max(4).optional().or(z.literal("")),
  stageId: z.string().trim().max(80).optional().or(z.literal("")),
  summary: z.string().trim().min(12).max(1200),
  sourceUrl: z.string().trim().max(500).optional().or(z.literal("")),
  faxNumber: z.string().max(200).optional().or(z.literal("")),
});

const decideSchema = z.object({
  id: z.string().trim().min(3).max(80),
  version: z.number().int().positive().max(1_000_000),
  decision: z.enum(DECISIONS),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
  sourceOpened: z.boolean().optional(),
});

export type ContributionInput = z.infer<typeof submitSchema>;
export type ContributionDecision = (typeof DECISIONS)[number];
export type ContributionStatus = (typeof QUEUE_STATUSES)[number];
export type EditorSession = {
  signedIn: boolean;
  isEditor: boolean;
  email: string | null;
  previewOpenGate: boolean;
};
export type QueueItem = {
  id: string;
  kind: (typeof KINDS)[number];
  name: string;
  website: string;
  countryIso2: string;
  stageId: string;
  summary: string;
  sourceUrl: string;
  status: ContributionStatus;
  note: string;
  slug: string;
  version: number;
  createdAt: string;
  reviewedAt: string;
  reviewedByEmail: string;
};
export type QueueSnapshot = {
  items: QueueItem[];
  counts: Record<ContributionStatus | "all", number>;
};

type ContributionRow = {
  id: string;
  kind: string;
  name: string;
  website: string;
  country_iso2: string;
  stage_id: string;
  summary: string;
  source_url: string;
  status: string;
  note: string;
  slug: string;
  version: number;
  created_at: unknown;
  reviewed_at: unknown;
  reviewed_by_email: string;
};

function asIso(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapItem(row: ContributionRow): QueueItem {
  const kind = KINDS.includes(row.kind as QueueItem["kind"]) ? (row.kind as QueueItem["kind"]) : "software";
  const status = QUEUE_STATUSES.includes(row.status as ContributionStatus)
    ? (row.status as ContributionStatus)
    : "received";
  return {
    id: row.id,
    kind,
    name: row.name,
    website: row.website ?? "",
    countryIso2: row.country_iso2 ?? "",
    stageId: row.stage_id ?? "",
    summary: row.summary,
    sourceUrl: row.source_url ?? "",
    status,
    note: row.note ?? "",
    slug: row.slug ?? "",
    version: Number(row.version) || 1,
    createdAt: asIso(row.created_at),
    reviewedAt: asIso(row.reviewed_at),
    reviewedByEmail: row.reviewed_by_email ?? "",
  };
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "record";
}

async function uniqueSlug(
  sql: Awaited<ReturnType<typeof getSql>>,
  name: string,
  id: string,
): Promise<string> {
  const base = slugify(name);
  const taken = Boolean(getSoftware(base) || getCompany(base));
  if (!taken) {
    const rows = await sql<{ id: string }>`
      select id from contributions where slug = ${base} and id <> ${id} limit 1
    `;
    if (rows.length === 0) return base;
  }
  return `${base}-${id.replace(/^c_/, "").slice(-6)}`;
}

function nextStatus(decision: (typeof DECISIONS)[number]): ContributionStatus {
  if (decision === "accept") return "accepted";
  if (decision === "reject") return "rejected";
  if (decision === "needs_evidence") return "needs_evidence";
  if (decision === "duplicate") return "duplicate";
  return "received";
}

export const submitContribution = createServerFn({ method: "POST" })
  .validator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
    const { enforceContributeRateLimit, isHoneypot, isSafePublicHttpUrl } =
      await import("@/lib/contribute-guard.server");
    assertSameSiteRequest();
    await enforceContributeRateLimit();
    if (isHoneypot(data.faxNumber)) return { id: "c_received" };
    if (!isSafePublicHttpUrl(data.website ?? "") || !isSafePublicHttpUrl(data.sourceUrl ?? "")) {
      throw new Error("Use a public http(s) URL, not a local or private address.");
    }
    const sql = await getSql();
    const id = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await sql`
      insert into contributions (
        id, kind, name, website, country_iso2, stage_id, summary, source_url, status, version
      )
      values (
        ${id},
        ${data.kind},
        ${data.name},
        ${data.website ?? ""},
        ${data.countryIso2 ?? ""},
        ${data.stageId ?? ""},
        ${data.summary},
        ${data.sourceUrl ?? ""},
        ${"received"},
        ${1}
      )
    `;
    return { id };
  });

export const getEditorSession = createServerFn({ method: "GET" })
  .middleware([optionalSessionMiddleware])
  .handler(async ({ context }): Promise<EditorSession> => {
    const { isAllowedEditor, isAllowlistConfigured, isEphemeralPreview } =
      await import("@/lib/editor-allowlist.server");
    const email = context.email;
    const signedIn = Boolean(context.userId);
    const isEditor = signedIn && isAllowedEditor(email);
    return {
      signedIn,
      isEditor,
      email: isEditor ? email : signedIn ? email : null,
      previewOpenGate: isEditor && isEphemeralPreview() && !isAllowlistConfigured(),
    };
  });

export const listContributionQueue = createServerFn({ method: "GET" })
  .middleware([editorMiddleware])
  .handler(async (): Promise<QueueSnapshot> => {
    const sql = await getSql();
    const rows = await sql<ContributionRow>`
      select
        id, kind, name, website, country_iso2, stage_id, summary, source_url,
        status, note, slug, version, created_at, reviewed_at, reviewed_by_email
      from contributions
      order by created_at desc
      limit 400
    `;
    const items = rows.map(mapItem);
    const counts: QueueSnapshot["counts"] = {
      all: items.length,
      received: 0,
      accepted: 0,
      needs_evidence: 0,
      rejected: 0,
      duplicate: 0,
    };
    for (const item of items) counts[item.status] += 1;
    return { items, counts };
  });

export const decideContribution = createServerFn({ method: "POST" })
  .middleware([editorMiddleware])
  .validator((data: unknown) => decideSchema.parse(data))
  .handler(async ({ context, data }) => {
    const note = (data.note ?? "").trim();
    if (data.decision === "accept" && data.sourceOpened !== true) {
      throw new Error("Open the source and confirm it before accepting.");
    }
    if (
      (data.decision === "reject" ||
        data.decision === "needs_evidence" ||
        data.decision === "duplicate") &&
      note.length < 8
    ) {
      throw new Error("Add a short note so the decision can be audited.");
    }

    const sql = await getSql();
    const current = await sql<ContributionRow>`
      select
        id, kind, name, website, country_iso2, stage_id, summary, source_url,
        status, note, slug, version, created_at, reviewed_at, reviewed_by_email
      from contributions
      where id = ${data.id}
      limit 1
    `;
    const row = current[0];
    if (!row) throw new Error("That submission is no longer in the queue.");
    if (Number(row.version) !== data.version) {
      throw new Error("This record was updated in another session. Refresh and try again.");
    }

    const fromStatus = mapItem(row).status;
    const toStatus = nextStatus(data.decision);
    const slug =
      toStatus === "accepted" && (row.kind === "software" || row.kind === "company")
        ? await uniqueSlug(sql, row.name, row.id)
        : "";
    const nextVersion = Number(row.version) + 1;
    const actorEmail = context.email;
    const now = new Date().toISOString();

    await sql`
      update contributions
      set
        status = ${toStatus},
        note = ${note},
        slug = ${slug},
        version = ${nextVersion},
        reviewed_by_user_id = ${context.userId},
        reviewed_by_email = ${actorEmail},
        reviewed_at = ${now}::timestamptz
      where id = ${data.id} and version = ${data.version}
    `;

    const auditId = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await sql`
      insert into contribution_audit (
        id, contribution_id, actor_user_id, actor_email, action, from_status, to_status, note
      )
      values (
        ${auditId},
        ${data.id},
        ${context.userId},
        ${actorEmail},
        ${data.decision},
        ${fromStatus},
        ${toStatus},
        ${note}
      )
    `;

    const updated = await sql<ContributionRow>`
      select
        id, kind, name, website, country_iso2, stage_id, summary, source_url,
        status, note, slug, version, created_at, reviewed_at, reviewed_by_email
      from contributions
      where id = ${data.id}
      limit 1
    `;
    return mapItem(updated[0]!);
  });
