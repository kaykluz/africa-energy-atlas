import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { TIER_LABEL } from "@/lib/evidence";

/**
 * Public read side of the observation store.
 *
 * Observations are the atlas's evidence trail and are public by design — a
 * reader judging a record deserves to see what supports it and how fresh it
 * is. Nothing here mutates; writes come from the CI crawler and, later, the
 * assertion extraction step behind the editor gate.
 */

export type PublicSource = {
  url: string;
  kind: string;
  tier: number;
  tierLabel: string;
  publisher: string;
  title: string;
  excerpt: string;
  state: string;
  publishedAt: string;
  lastFetched: string;
};

type Row = {
  canonical_url: string; url: string; kind: string; source_tier: number;
  publisher: string; title: string; excerpt: string; state: string;
  published_at: string; last_fetched: string;
};

export const listSubjectSources = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    z.object({ subjectId: z.string().trim().min(1).max(160) }).parse(data),
  )
  .handler(async ({ data }): Promise<PublicSource[]> => {
    const sql = await getSql();
    const rows = await sql<Row>`
      select canonical_url, url, kind, source_tier, publisher, title, excerpt,
             state, published_at, last_fetched
      from observations
      where subject_type = ${"organisation"} and subject_id = ${data.subjectId}
      order by source_tier asc, last_fetched desc
      limit 50
    `;
    return rows.map((row) => ({
      url: row.canonical_url || row.url,
      kind: row.kind,
      tier: Number(row.source_tier),
      tierLabel: TIER_LABEL[Number(row.source_tier)] ?? "Unclassified",
      publisher: row.publisher ?? "",
      title: row.title ?? "",
      excerpt: row.excerpt ?? "",
      state: row.state ?? "live",
      publishedAt: row.published_at ?? "",
      lastFetched: (row.last_fetched ?? "").slice(0, 10),
    }));
  });
