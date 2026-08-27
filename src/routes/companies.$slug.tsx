import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { ROLE_LABEL, companyProducts, countryName } from "@/lib/catalog";
import { resolvePublicCompany } from "@/lib/accepted-records";
import { listSubjectSources, type PublicSource } from "@/lib/enrichment";
import { initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/companies/$slug")({
  loader: async ({ params }) => {
    const item = await resolvePublicCompany({ data: params.slug });
    if (!item) throw notFound();
    // The evidence trail is additive: a database hiccup must degrade to an
    // empty Sources section, never take the profile down with it.
    let sources: PublicSource[] = [];
    try {
      sources = await listSubjectSources({ data: { subjectId: item.id } });
    } catch {
      sources = [];
    }
    return { item, sources };
  },
  component: CompanyPage,
});

function CompanyPage() {
  const { item, sources } = Route.useLoaderData();
  const products = companyProducts(item);
  const community = item.origin === "community";

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-6 text-sm text-muted">
        <Link to="/" search={{ view: "companies" }} className="hover:text-ink">
          Companies
        </Link>
        <span className="px-2">/</span>
        <span className="text-ink">{item.name}</span>
      </nav>

      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {item.logo ? (
          <img src={item.logo} alt="" className="size-16 rounded-lg bg-surface object-contain p-2 shadow-soft" />
        ) : (
          <span className="mark-disc size-16 text-lg">{initials(item.name)}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faint">
            {community ? "Editor-accepted organisation" : ROLE_LABEL[item.role] || item.role}
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-[-0.03em] sm:text-5xl">{item.name}</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink/85">
            {item.summary || "Energy-sector organisation."}
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {item.hq ? <Badge>{countryName(item.hq) || item.hq}</Badge> : null}
            {item.africaBuilt ? <Badge tone="quiet">Africa-headquartered</Badge> : null}
            {community ? (
              <Badge tone="ok">Editor accepted</Badge>
            ) : item.tier === "reviewed" ? (
              <Badge tone="reviewed">Reviewed</Badge>
            ) : (
              <Badge tone="quiet">Catalogue</Badge>
            )}
            {item.roles.filter((r) => r !== item.role).map((r) => (
              <Badge key={r} tone="quiet">
                {ROLE_LABEL[r] || r}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {item.website ? (
            <Button asChild variant="secondary">
              <a href={item.website} target="_blank" rel="noreferrer">
                Website <ExternalLink className="size-3.5" />
              </a>
            </Button>
          ) : null}
          <Button asChild variant="secondary">
            <Link to="/contribute" search={{ kind: "correction", about: item.name }}>
              Improve
            </Link>
          </Button>
        </div>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section>
          <h2 className="mb-4 font-display text-2xl font-medium">Software</h2>
          {products.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {products.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/software/$slug"
                    params={{ slug: p.slug }}
                    className="block rounded-xl bg-surface p-4 shadow-soft hover:-translate-y-0.5"
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      {p.reviewed ? <i className="reviewed-dot" /> : null}
                      {p.name}
                    </span>
                    <span className="mt-1 block line-clamp-2 text-sm text-muted">{p.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              {community
                ? "Accepted from a public submission — no software records linked yet."
                : "No software records linked yet."}
            </p>
          )}
          <h2 className="mb-4 mt-10 font-display text-2xl font-medium">Sources</h2>
          {sources.length ? (
            <ul className="space-y-2">
              {sources.map((source) => (
                <li key={source.url} className="rounded-xl bg-surface p-4 shadow-soft">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="min-w-0 truncate font-semibold underline-offset-4 hover:underline"
                    >
                      {source.title || source.publisher || source.url}
                    </a>
                    <span
                      className="font-mono text-[0.62rem] uppercase tracking-wide text-faint"
                      title={source.tierLabel}
                    >
                      Tier {source.tier}
                      {source.state !== "live" ? ` · ${source.state}` : ""}
                      {source.lastFetched ? ` · checked ${source.lastFetched}` : ""}
                    </span>
                  </div>
                  {source.excerpt ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{source.excerpt}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              No fetched sources yet. The enrichment crawler visits each recorded website on a
              rotating schedule; tiers follow the project&rsquo;s evidence policy, where volume
              never substitutes for source quality.
            </p>
          )}
        </section>
        <aside className="space-y-6">
          <div className="rounded-xl bg-surface p-5 shadow-soft">
            <h2 className="font-display text-xl font-medium">Countries</h2>
            {item.countries.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.countries.map((iso) => (
                  <Link key={iso} to="/countries/$iso2" params={{ iso2: iso.toLowerCase() }} className="chip">
                    {countryName(iso)}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">No African countries listed yet.</p>
            )}
          </div>
          {item.segments?.length ? (
            <div className="rounded-xl bg-surface p-5 shadow-soft">
              <h2 className="font-display text-xl font-medium">Segments</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.segments.map((s) => (
                  <span key={s} className="chip chip-quiet">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
