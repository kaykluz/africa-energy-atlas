"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ROLE_LABEL,
  ROLE_ORDER,
  catalog,
  companies as allCompanies,
  countryName,
  software as allSoftware,
  stageName,
  type Company,
  type Software,
} from "@/lib/catalog";
import { cn, initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useMergedCompanies, useMergedSoftware } from "@/components/accepted-catalog";

function hay(s: string) {
  return s.toLowerCase();
}

export function SoftwareGrid({
  query,
  stageId,
  relationship,
  reviewedOnly,
  onQuery,
  onStage,
  onRelationship,
  onReviewed,
  onOpen,
}: {
  query?: string;
  stageId?: string;
  relationship?: string;
  reviewedOnly?: boolean;
  onQuery: (q: string) => void;
  onStage: (id: string | undefined) => void;
  onRelationship: (id: string | undefined) => void;
  onReviewed: (v: boolean) => void;
  onOpen: (slug: string) => void;
}) {
  const [limit, setLimit] = useState(36);
  const mergedSoftware = useMergedSoftware(allSoftware);
  const filtered = useMemo(() => {
    const q = hay(query ?? "");
    return mergedSoftware
      .filter((s) => (reviewedOnly ? s.reviewed : true))
      .filter((s) => (stageId ? s.stageIds.includes(stageId) : true))
      .filter((s) => (relationship ? s.relationship === relationship : true))
      .filter((s) =>
        q
          ? hay(`${s.name} ${s.companyName} ${s.summary} ${s.capabilities.join(" ")}`).includes(q)
          : true,
      )
      .sort((a, b) => Number(b.reviewed) - Number(a.reviewed) || a.name.localeCompare(b.name));
  }, [query, stageId, relationship, reviewedOnly, mergedSoftware]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-3 border-b border-line px-3 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faint">Software</p>
            <h2 className="font-display text-3xl font-medium">Products & tools</h2>
          </div>
          <p className="text-sm tabular text-muted">{filtered.length} shown</p>
        </div>
        <Input
          value={query ?? ""}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Filter by name, company or capability"
          aria-label="Filter software"
        />
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={!stageId} onClick={() => onStage(undefined)}>
            All stages
          </FilterChip>
          {catalog.stages
            .filter((s) => s.id !== "stage_cross_cutting")
            .map((s) => (
              <FilterChip key={s.id} active={stageId === s.id} onClick={() => onStage(s.id)}>
                {s.name}
              </FilterChip>
            ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={!relationship} onClick={() => onRelationship(undefined)}>
            Any relationship
          </FilterChip>
          {catalog.relationships.map((r) => (
            <FilterChip key={r.id} active={relationship === r.id} onClick={() => onRelationship(r.id)}>
              {r.name}
            </FilterChip>
          ))}
          <FilterChip active={Boolean(reviewedOnly)} onClick={() => onReviewed(!reviewedOnly)}>
            Reviewed only
          </FilterChip>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.slice(0, limit).map((s) => (
            <SoftwareCard key={s.id} item={s} onOpen={onOpen} />
          ))}
        </div>
        {filtered.length > limit ? (
          <button
            type="button"
            className="mt-5 text-sm font-semibold text-primary"
            onClick={() => setLimit((n) => n + 36)}
          >
            Show more · {filtered.length - limit} remaining
          </button>
        ) : null}
        {filtered.length === 0 ? (
          <p className="text-muted">No software matches those filters.</p>
        ) : null}
      </div>
    </div>
  );
}

function SoftwareCard({ item, onOpen }: { item: Software; onOpen: (slug: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.slug)}
      className="flex flex-col rounded-xl bg-surface p-4 text-left shadow-soft transition-transform duration-150 hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-3">
        <span className="mark-disc size-10 shrink-0 text-sm">{initials(item.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {item.reviewed ? <i className="reviewed-dot" /> : null}
            <h3 className="truncate font-semibold leading-tight">{item.name}</h3>
          </div>
          <p className="truncate text-sm text-muted">
            {item.kind === "community_accepted"
              ? "Editor accepted"
              : item.companyName || (item.reviewed ? "Reviewed" : "Catalogue")}
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-ink/80">{item.summary || "No summary yet."}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.stageIds.slice(0, 1).map((id) => (
          <Badge key={id} tone="quiet">
            {stageName(id)}
          </Badge>
        ))}
        {item.countries.slice(0, 3).map((iso) => (
          <Badge key={iso} tone="quiet">
            {iso}
          </Badge>
        ))}
        {item.africaWide && item.countries.length === 0 ? (
          <Badge tone="quiet">Africa-wide</Badge>
        ) : null}
      </div>
    </button>
  );
}

export function CompanyGrid({
  query,
  role,
  onQuery,
  onRole,
  onOpen,
}: {
  query?: string;
  role?: string;
  onQuery: (q: string) => void;
  onRole: (id: string | undefined) => void;
  onOpen: (slug: string) => void;
}) {
  const [limit, setLimit] = useState(36);
  const mergedCompanies = useMergedCompanies(allCompanies);
  const filtered = useMemo(() => {
    const q = hay(query ?? "");
    const roleId = role ?? "software";
    return mergedCompanies
      .filter((c) => (roleId === "all" ? true : c.role === roleId || c.roles.includes(roleId)))
      .filter((c) => (q ? hay(`${c.name} ${c.summary} ${c.role}`).includes(q) : true))
      .sort(
        (a, b) =>
          (b.productIds?.length ?? 0) - (a.productIds?.length ?? 0) ||
          (b.tier === "reviewed" ? 1 : 0) - (a.tier === "reviewed" ? 1 : 0) ||
          a.name.localeCompare(b.name),
      );
  }, [query, role, mergedCompanies]);

  const activeRole = role ?? "software";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-3 border-b border-line px-3 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faint">Companies</p>
            <h2 className="font-display text-3xl font-medium">Who plays in the sector</h2>
          </div>
          <p className="text-sm tabular text-muted">{filtered.length} shown</p>
        </div>
        <Input
          value={query ?? ""}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Filter by name or role"
          aria-label="Filter companies"
        />
        <div className="flex flex-wrap gap-1.5">
          {ROLE_ORDER.map((id) => (
            <FilterChip key={id} active={activeRole === id} onClick={() => onRole(id)}>
              {ROLE_LABEL[id]}
            </FilterChip>
          ))}
          <FilterChip active={activeRole === "all"} onClick={() => onRole("all")}>
            All roles
          </FilterChip>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.slice(0, limit).map((c) => (
            <CompanyCard key={c.id} item={c} onOpen={onOpen} />
          ))}
        </div>
        {filtered.length > limit ? (
          <button
            type="button"
            className="mt-5 text-sm font-semibold text-primary"
            onClick={() => setLimit((n) => n + 36)}
          >
            Show more · {filtered.length - limit} remaining
          </button>
        ) : null}
        {filtered.length === 0 ? <p className="text-muted">No companies match those filters.</p> : null}
      </div>
    </div>
  );
}

function CompanyCard({ item, onOpen }: { item: Company; onOpen: (slug: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.slug)}
      className="flex flex-col rounded-xl bg-surface p-4 text-left shadow-soft transition-transform duration-150 hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-3">
        {item.logo ? (
          <img
            src={item.logo}
            alt=""
            title={`${item.name} identity`}
            className="size-10 rounded-md bg-sunken object-contain p-1"
          />
        ) : (
          <span className="mark-disc size-10 shrink-0 text-sm" title="Logo not yet added">
            {initials(item.name)}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate font-semibold leading-tight">{item.name}</h3>
          <p className="truncate text-sm text-muted">
            {item.origin === "community"
              ? "Editor accepted"
              : ROLE_LABEL[item.role] || item.role}
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-ink/80">{item.summary || "Energy-sector organisation."}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.origin === "community" ? <Badge tone="ok">Editor accepted</Badge> : null}
        {item.hq ? <Badge tone="quiet">{countryName(item.hq) || item.hq}</Badge> : null}
        {item.productIds.length ? (
          <Badge tone="quiet">
            {item.productIds.length} product{item.productIds.length === 1 ? "" : "s"}
          </Badge>
        ) : null}
        {item.countries.length ? (
          <Badge tone="quiet">{item.countries.length} countries</Badge>
        ) : null}
      </div>
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("chip", active ? "chip-primary" : "chip-quiet")}
    >
      {children}
    </button>
  );
}
