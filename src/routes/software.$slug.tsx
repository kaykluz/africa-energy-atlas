import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import {
  companyById,
  countryName,
  evidenceLabel,
  functionName,
  getSoftware,
  relatedSoftware,
  relationshipName,
  softwareDeployments,
  softwareSources,
  stageName,
} from "@/lib/catalog";
import { initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/software/$slug")({
  component: SoftwarePage,
});

function SoftwarePage() {
  const { slug } = Route.useParams();
  const item = getSoftware(slug);
  if (!item) throw notFound();
  const owner = item.companyId ? companyById.get(item.companyId) : undefined;
  const deps = softwareDeployments(item.id);
  const srcs = softwareSources(item);
  const related = relatedSoftware(item);

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-6 text-sm text-muted">
        <Link to="/" search={{ view: "software" }} className="hover:text-ink">
          Software
        </Link>
        <span className="px-2">/</span>
        <span className="text-ink">{item.name}</span>
      </nav>

      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span className="mark-disc size-16 text-lg">{initials(item.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faint">
            {item.reviewed ? "Reviewed product" : "Catalogue product"}
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-[-0.03em] sm:text-5xl">{item.name}</h1>
          {owner ? (
            <Link
              to="/companies/$slug"
              params={{ slug: owner.slug }}
              className="mt-2 inline-block font-semibold hover:text-primary"
            >
              {owner.name}
            </Link>
          ) : item.companyName ? (
            <p className="mt-2 font-semibold">{item.companyName}</p>
          ) : null}
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink/85">
            {item.summary || "No summary yet."}
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {item.reviewed ? <Badge tone="reviewed">Reviewed</Badge> : <Badge tone="quiet">Catalogue</Badge>}
            {item.africaBuilt ? <Badge>Africa-built</Badge> : null}
            {item.relationship ? <Badge tone="quiet">{relationshipName(item.relationship)}</Badge> : null}
            {item.stageIds.map((id) => (
              <Link key={id} to="/" search={{ view: "chain", stage: id }} className="chip chip-quiet">
                {stageName(id)}
              </Link>
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
        <div className="space-y-8">
          {item.capabilities.length ? (
            <section>
              <h2 className="mb-3 font-display text-2xl font-medium">What it does</h2>
              <ul className="flex flex-wrap gap-2">
                {item.capabilities.map((c) => (
                  <li key={c} className="chip">
                    {c}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {item.functionIds.length ? (
            <section>
              <h2 className="mb-3 font-display text-2xl font-medium">Functions</h2>
              <ul className="flex flex-wrap gap-2">
                {item.functionIds.map((id) => (
                  <li key={id}>
                    <Link to="/" search={{ view: "chain", fn: id }} className="chip chip-quiet">
                      {functionName(id)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="mb-3 font-display text-2xl font-medium">Where it shows up</h2>
            {deps.length ? (
              <ul className="space-y-2">
                {deps.map((d) => (
                  <li key={d.id} className="rounded-lg bg-surface p-4 shadow-soft">
                    <Link
                      to="/countries/$iso2"
                      params={{ iso2: d.country.toLowerCase() }}
                      className="font-semibold hover:text-primary"
                    >
                      {countryName(d.country)}
                    </Link>
                    <p className="mt-1 text-sm text-muted">
                      {[d.area, d.customer, d.year, evidenceLabel(d.evidence)].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : item.countries.length ? (
              <div className="flex flex-wrap gap-2">
                {item.countries.map((iso) => (
                  <Link key={iso} to="/countries/$iso2" params={{ iso2: iso.toLowerCase() }} className="chip">
                    {countryName(iso)}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">
                {item.africaWide
                  ? "Catalogue coverage is Africa-wide. A named country has not been sourced yet."
                  : "No country recorded yet."}
              </p>
            )}
          </section>

          {srcs.length ? (
            <section>
              <h2 className="mb-3 font-display text-2xl font-medium">Sources</h2>
              <ul className="space-y-2">
                {srcs.map((s) => (
                  <li key={s.id}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-start justify-between gap-3 rounded-lg bg-surface p-3 shadow-soft"
                    >
                      <span>
                        <span className="block font-semibold group-hover:text-primary">{s.title}</span>
                        <span className="text-sm text-muted">{s.publisher}</span>
                      </span>
                      <ArrowUpRight className="mt-1 size-4 shrink-0 text-faint" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : item.sourceUrl ? (
            <section>
              <h2 className="mb-3 font-display text-2xl font-medium">Source</h2>
              <a href={item.sourceUrl} className="font-semibold text-primary" target="_blank" rel="noreferrer">
                {item.sourceUrl.replace(/^https?:\/\//, "")}
              </a>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl bg-surface p-5 shadow-soft">
            <h2 className="font-display text-xl font-medium">Record</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row k="Lifecycle" v={item.lifecycle || "—"} />
              <Row k="Access" v={item.access?.replace(/_/g, " ") || "—"} />
              <Row k="Last checked" v={item.lastChecked || "—"} />
            </dl>
          </div>
          {related.length ? (
            <div className="rounded-xl bg-surface p-5 shadow-soft">
              <h2 className="font-display text-xl font-medium">Related software</h2>
              <ul className="mt-3 space-y-1">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link
                      to="/software/$slug"
                      params={{ slug: r.slug }}
                      className="block rounded-md px-1 py-1.5 font-semibold hover:text-primary"
                    >
                      {r.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium capitalize">{v}</dd>
    </div>
  );
}
