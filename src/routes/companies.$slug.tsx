import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import {
  ROLE_LABEL,
  companyProducts,
  countryName,
  getCompany,
} from "@/lib/catalog";
import { initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/companies/$slug")({
  component: CompanyPage,
});

function CompanyPage() {
  const { slug } = Route.useParams();
  const item = getCompany(slug);
  if (!item) throw notFound();
  const products = companyProducts(item);

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
            {ROLE_LABEL[item.role] || item.role}
          </p>
          <h1 className="mt-1 font-display text-4xl font-medium tracking-[-0.03em] sm:text-5xl">{item.name}</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink/85">
            {item.summary || "Energy-sector organisation."}
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {item.hq ? <Badge>{countryName(item.hq) || item.hq}</Badge> : null}
            {item.africaBuilt ? <Badge tone="quiet">Africa-headquartered</Badge> : null}
            {item.tier === "reviewed" ? <Badge tone="reviewed">Reviewed</Badge> : <Badge tone="quiet">Catalogue</Badge>}
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
            <p className="text-sm text-muted">No software records linked yet.</p>
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
