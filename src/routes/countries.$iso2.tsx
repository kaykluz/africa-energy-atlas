import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import {
  ROLE_LABEL,
  companiesInCountry,
  countryByIso,
  countryStatByIso,
  softwareInCountry,
} from "@/lib/catalog";
import { listAcceptedRecords, mergeBySlug } from "@/lib/accepted-records";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/countries/$iso2")({
  loader: async ({ params }) => {
    const iso = params.iso2.toUpperCase();
    const country = countryByIso.get(iso);
    if (!country) throw notFound();
    const extra = await listAcceptedRecords();
    return {
      extraSoftware: extra.software.filter((item) => item.countries.includes(iso)),
      extraCompanies: extra.companies.filter((item) => item.countries.includes(iso) || item.hq === iso),
    };
  },
  component: CountryPage,
});

function CountryPage() {
  const { iso2 } = Route.useParams();
  const { extraSoftware, extraCompanies } = Route.useLoaderData();
  const iso = iso2.toUpperCase();
  const country = countryByIso.get(iso);
  if (!country) throw notFound();
  const stat = countryStatByIso.get(iso);
  const software = mergeBySlug(softwareInCountry(iso), extraSoftware).sort(
    (a, b) => Number(b.reviewed) - Number(a.reviewed) || a.name.localeCompare(b.name),
  );
  const companies = mergeBySlug(companiesInCountry(iso), extraCompanies).sort(
    (a, b) => (b.productIds.length || 0) - (a.productIds.length || 0) || a.name.localeCompare(b.name),
  );

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-6 text-sm text-muted">
        <Link to="/" search={{ view: "map", country: iso }} className="hover:text-ink">
          Map
        </Link>
        <span className="px-2">/</span>
        <span className="text-ink">{country.name}</span>
      </nav>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faint">{iso}</p>
      <h1 className="mt-1 font-display text-4xl font-medium tracking-[-0.03em] sm:text-5xl">{country.name}</h1>
      <p className="mt-3 text-muted">
        {software.length} named software locations · {companies.length} companies
        {stat?.deployments ? ` · ${stat.deployments} evidenced deployments` : ""}
      </p>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-2xl font-medium">Software</h2>
        {software.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {software.map((s) => (
              <li key={s.id}>
                <Link
                  to="/software/$slug"
                  params={{ slug: s.slug }}
                  className="block rounded-xl bg-surface p-4 shadow-soft"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    {s.reviewed ? <i className="reviewed-dot" /> : null}
                    {s.name}
                  </span>
                  <span className="mt-1 block text-sm text-muted">
                    {s.kind === "community_accepted" ? "Editor accepted" : s.companyName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            No named software locations yet.{" "}
            <Link to="/contribute" search={{ kind: undefined, about: undefined }} className="font-semibold text-primary">
              Add one
            </Link>
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-2xl font-medium">Companies</h2>
        {companies.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {companies.slice(0, 40).map((c) => (
              <li key={c.id}>
                <Link
                  to="/companies/$slug"
                  params={{ slug: c.slug }}
                  className="flex items-center justify-between gap-3 rounded-xl bg-surface p-4 shadow-soft"
                >
                  <span>
                    <span className="block font-semibold">{c.name}</span>
                    <span className="text-sm text-muted">
                      {c.origin === "community" ? "Editor accepted" : ROLE_LABEL[c.role]}
                    </span>
                  </span>
                  {c.productIds.length ? <Badge tone="quiet">{c.productIds.length}</Badge> : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No companies listed for this country yet.</p>
        )}
      </section>
    </main>
  );
}
