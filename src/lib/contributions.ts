import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";

const submitSchema = z.object({
  kind: z.enum(["software", "company", "correction"]),
  name: z.string().trim().min(2).max(160),
  website: z.string().trim().max(400).optional().or(z.literal("")),
  countryIso2: z.string().trim().max(4).optional().or(z.literal("")),
  stageId: z.string().trim().max(80).optional().or(z.literal("")),
  summary: z.string().trim().min(12).max(1200),
  sourceUrl: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ContributionInput = z.infer<typeof submitSchema>;

export const submitContribution = createServerFn({ method: "POST" })
  .validator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await sql`
      insert into contributions (id, kind, name, website, country_iso2, stage_id, summary, source_url)
      values (
        ${id},
        ${data.kind},
        ${data.name},
        ${data.website ?? ""},
        ${data.countryIso2 ?? ""},
        ${data.stageId ?? ""},
        ${data.summary},
        ${data.sourceUrl ?? ""}
      )
    `;
    return { id };
  });

export const countContributions = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`select count(*)::int as n from contributions`;
  return { count: rows[0]?.n ?? 0 };
});
