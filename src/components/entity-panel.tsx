"use client";

import { Link } from "@tanstack/react-router";
import { ArrowUpRight, X } from "lucide-react";
import type { ReactNode } from "react";
import {
  ROLE_LABEL,
  companiesInCountry,
  companyById,
  companyBySlug,
  countryName,
  countryStatByIso,
  relationshipName,
  softwareById,
  softwareBySlug,
  softwareDeployments,
  softwareInCountry,
  stageName,
  type Company,
  type Software,
} from "@/lib/catalog";
import { initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  companyPresence,
  presenceDetail,
  presenceShortLabel,
  productLogo,
  softwarePresence,
} from "@/lib/presence";
import { Button } from "@/components/ui/button";
import { useAcceptedCatalog, mergeBySlug } from "@/components/accepted-catalog";

export function EntityPanel({
  softwareSlug,
  companySlug,
  countryIso,
  onClose,
  onOpenSoftware,
  onOpenCompany,
}: {
  softwareSlug?: string;
  companySlug?: string;
  countryIso?: string;
  onClose: () => void;
  onOpenSoftware: (slug: string) => void;
  onOpenCompany: (slug: string) => void;
}) {
  const { software: extraSoftware, companies: extraCompanies } = useAcceptedCatalog();
  const sw = softwareSlug
    ? (softwareBySlug.get(softwareSlug) ?? extraSoftware.find((item) => item.slug === softwareSlug))
    : undefined;
  const co = companySlug
    ? (companyBySlug.get(companySlug) ?? extraCompanies.find((item) => item.slug === companySlug))
    : undefined;
  if (sw) return <SoftwarePreview item={sw} onClose={onClose} />;
  if (co) {
    return <CompanyPreview item={co} onClose={onClose} onOpenSoftware={onOpenSoftware} />;
  }
  if (countryIso) {
    return (
      <CountryPreview
        iso={countryIso}
        onClose={onClose}
        onOpenSoftware={onOpenSoftware}
        onOpenCompany={onOpenCompany}
      />
    );
  }
  return null;
}

function PanelShell({
  title,
  kicker,
  onClose,
  children,
  footer,
}: {
  title: string;
  kicker?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-t border-line bg-surface md:border-l md:border-t-0">
      <header className="flex items-start justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          {kicker ? (
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faint">{kicker}</p>
          ) : null}
          <h2 className="font-display text-2xl font-medium leading-tight">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-11 shrink-0 place-items-center rounded-md hover:bg-sunken"
          aria-label="Close panel"
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      {footer ? <div className="border-t border-line p-4">{footer}</div> : null}
    </aside>
  );
}

function SoftwarePreview({ item, onClose }: { item: Software; onClose: () => void }) {
  const deps = softwareDeployments(item.id);
  const owner = item.companyId ? companyById.get(item.companyId) : undefined;
  return (
    <PanelShell
      kicker={
        item.kind === "community_accepted"
          ? "Editor-accepted product"
          : item.reviewed
            ? "Reviewed product"
            : "Directory listing"
      }
      title={item.name}
      onClose={onClose}
      footer={
        <Button asChild className="w-full">
          <Link to="/software/$slug" params={{ slug: item.slug }}>
            Full record <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      }
    >
      <div className="flex items-center gap-3">
        {productLogo(item, owner?.logo) ? (
          <img
            src={productLogo(item, owner?.logo)}
            alt=""
            title={item.logo ? `${item.name} identity` : `${owner?.name ?? "Owner"} identity, inherited`}
            className="size-12 rounded-md bg-sunken object-contain p-1"
          />
        ) : (
          <span className="mark-disc size-12 text-sm" title="Logo not yet added">
            {initials(item.name)}
          </span>
        )}
        {owner ? (
          <Link
            to="/companies/$slug"
            params={{ slug: owner.slug }}
            className="text-sm font-semibold hover:text-primary"
          >
            {owner.name}
          </Link>
        ) : item.companyName ? (
          <p className="text-sm font-semibold">{item.companyName}</p>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink/85">{item.summary || "No summary yet."}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.kind === "community_accepted" ? (
          <Badge tone="ok">Editor accepted</Badge>
        ) : item.reviewed ? (
          <Badge tone="reviewed">Reviewed</Badge>
        ) : (
          <Badge tone="quiet" title="Listed from a named source; not reviewed in depth">
            Directory listing
          </Badge>
        )}
        {item.relationship ? <Badge tone="quiet">{relationshipName(item.relationship)}</Badge> : null}
        {item.stageIds.slice(0, 2).map((id) => (
          <Badge key={id} tone="quiet">
            {stageName(id)}
          </Badge>
        ))}
      </div>
      {item.countries.length ? (
        <CountryRow isos={item.countries} />
      ) : item.africaWide ? (
        <p className="mt-4 text-sm text-muted">Tagged Africa-wide — no named country yet.</p>
      ) : null}
      {deps.length ? (
        <ul className="mt-4 space-y-2">
          {deps.map((d) => (
            <li key={d.id} className="rounded-md bg-sunken px-3 py-2 text-sm">
              <span className="font-semibold">{countryName(d.country)}</span>
              {d.customer ? <span className="text-muted"> · {d.customer}</span> : null}
              {d.year ? <span className="text-muted"> · {d.year}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </PanelShell>
  );
}

function CompanyPreview({
  item,
  onClose,
  onOpenSoftware,
}: {
  item: Company;
  onClose: () => void;
  onOpenSoftware: (slug: string) => void;
}) {
  const products = item.productIds.map((id) => softwareById.get(id)).filter(Boolean) as Software[];
  return (
    <PanelShell
      kicker={item.origin === "community" ? "Editor-accepted organisation" : ROLE_LABEL[item.role] || item.role}
      title={item.name}
      onClose={onClose}
      footer={
        <Button asChild className="w-full">
          <Link to="/companies/$slug" params={{ slug: item.slug }}>
            Full record <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      }
    >
      <p className="text-sm leading-relaxed text-ink/85">{item.summary || "Energy-sector organisation."}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.hq ? <Badge>{countryName(item.hq) || item.hq}</Badge> : null}
        {item.origin === "community" ? <Badge tone="ok">Editor accepted</Badge> : null}
        {item.africaBuilt ? <Badge tone="quiet">Africa-headquartered</Badge> : null}
        {products.length ? <Badge tone="quiet">{products.length} products</Badge> : null}
      </div>
      {item.countries.length ? <CountryRow isos={item.countries} /> : null}
      {products.length ? (
        <ul className="mt-4 space-y-1">
          {products.slice(0, 8).map((sw) => (
            <li key={sw.id}>
              <button
                type="button"
                onClick={() => onOpenSoftware(sw.slug)}
                className="w-full rounded-md px-2 py-2 text-left text-sm font-semibold hover:bg-sunken"
              >
                {sw.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </PanelShell>
  );
}

function CountryPreview({
  iso,
  onClose,
  onOpenSoftware,
  onOpenCompany,
}: {
  iso: string;
  onClose: () => void;
  onOpenSoftware: (slug: string) => void;
  onOpenCompany: (slug: string) => void;
}) {
  const { software: extraSoftware, companies: extraCompanies } = useAcceptedCatalog();
  const stat = countryStatByIso.get(iso);
  const sw = mergeBySlug(
    softwareInCountry(iso),
    extraSoftware.filter((item) => item.countries.includes(iso)),
  ).sort((a, b) => Number(b.reviewed) - Number(a.reviewed) || a.name.localeCompare(b.name));
  const cos = mergeBySlug(
    companiesInCountry(iso),
    extraCompanies.filter((item) => item.countries.includes(iso) || item.hq === iso),
  ).sort((a, b) => (b.productIds.length || 0) - (a.productIds.length || 0) || a.name.localeCompare(b.name));
  return (
    <PanelShell
      kicker="Country"
      title={countryName(iso)}
      onClose={onClose}
      footer={
        <Button asChild variant="secondary" className="w-full">
          <Link to="/countries/$iso2" params={{ iso2: iso.toLowerCase() }}>
            Country page <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      }
    >
      <p className="text-sm tabular text-muted">
        {stat?.software ?? 0} software with a named location · {stat?.companies ?? 0} companies
        {stat?.deployments ? ` · ${stat.deployments} evidenced deployments` : ""}
      </p>
      {sw.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          No named software locations here yet. Most products are tagged Africa-wide until a country is sourced.
        </p>
      ) : (
        <section className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Software</h3>
          <ul className="space-y-1">
            {sw.slice(0, 8).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpenSoftware(item.slug)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-sunken"
                >
                  {item.reviewed ? <i className="reviewed-dot" /> : null}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.name}</span>
                  <span
                    className="shrink-0 text-[0.7rem] text-faint"
                    title={presenceDetail(softwarePresence(item, iso))}
                  >
                    {presenceShortLabel(softwarePresence(item, iso))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {cos.length ? (
        <section className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Companies</h3>
          <ul className="space-y-1">
            {cos.slice(0, 10).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpenCompany(item.slug)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-sunken"
                >
                  <span className="min-w-0 truncate text-sm font-semibold">{item.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-[0.7rem]">
                    <span
                      className="text-faint"
                      title={presenceDetail(companyPresence(item, iso))}
                    >
                      {presenceShortLabel(companyPresence(item, iso))}
                    </span>
                    <span className="text-muted">{ROLE_LABEL[item.role]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PanelShell>
  );
}

function CountryRow({ isos }: { isos: string[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {isos.slice(0, 12).map((iso) => (
        <Link
          key={iso}
          to="/countries/$iso2"
          params={{ iso2: iso.toLowerCase() }}
          className="chip chip-quiet"
        >
          {countryName(iso)}
        </Link>
      ))}
    </div>
  );
}
