"use client";

import { useEffect, useMemo, useState } from "react";
import {
  decideOrganisation,
  listOrganisationQueue,
  type OrganisationCandidate,
  type OrganisationQueue as Queue,
  type OrganisationStatus,
} from "@/lib/organisations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The organisation review queue.
 *
 * Rows are research leads swept from regulator registers and association
 * directories. Accepting one publishes it to the public map labelled
 * "Editor accepted" — an editor confirmed the cited source names the company,
 * not that the profile has been verified in depth.
 */

const FILTERS: Array<{ id: OrganisationStatus | "all"; label: string }> = [
  { id: "received", label: "Inbox" },
  { id: "needs_evidence", label: "Held" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
  { id: "duplicate", label: "Duplicate" },
  { id: "all", label: "All" },
];

const ROLE_LABEL: Record<string, string> = {
  org_role_epc: "EPC",
  org_role_installer: "Installer",
  org_role_system_integrator: "Integrator",
  org_role_developer_ipp: "Developer / IPP",
  org_role_om_asset_manager: "O&M",
  org_role_equipment_supplier: "Supplier",
  org_role_distributor: "Distributor",
  org_role_energy_service_company: "ESCO",
  org_role_to_classify: "Unclassified",
};

export function OrganisationQueue() {
  const [snapshot, setSnapshot] = useState<Queue | null>(null);
  const [filter, setFilter] = useState<OrganisationStatus | "all">("received");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sourceOpened, setSourceOpened] = useState(false);
  const [note, setNote] = useState("");

  async function refresh() {
    const next = await listOrganisationQueue({
      data: { status: filter, query, flaggedOnly, limit: 150 },
    });
    setSnapshot(next);
    setError("");
    return next;
  }

  useEffect(() => {
    let cancelled = false;
    void listOrganisationQueue({ data: { status: filter, query, flaggedOnly, limit: 150 } })
      .then((next) => {
        if (!cancelled) {
          setSnapshot(next);
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the organisation queue.");
      });
    return () => {
      cancelled = true;
    };
  }, [filter, query, flaggedOnly]);

  const items = snapshot?.items ?? [];
  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  useEffect(() => {
    setSourceOpened(false);
    setNote("");
  }, [selectedId]);

  async function decide(decision: "accept" | "reject" | "needs_evidence" | "duplicate") {
    if (!selected) return;
    setBusy(true);
    try {
      await decideOrganisation({
        data: {
          id: selected.id,
          version: selected.version,
          decision,
          note,
          sourceOpened,
        },
      });
      await refresh();
      setSelectedId(null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That decision could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {snapshot ? (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat n={snapshot.counts.received} label="Inbox" />
          <Stat n={snapshot.counts.accepted} label="Accepted" />
          <Stat n={snapshot.counts.needs_evidence} label="Held" />
          <Stat n={snapshot.counts.flagged} label="Name flagged" />
          <Stat n={snapshot.counts.all} label="Total" />
        </dl>
      ) : (
        <div className="h-20 animate-pulse rounded-xl bg-sunken" />
      )}

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <section className="flex min-h-0 flex-1 flex-col rounded-xl bg-surface shadow-soft lg:max-w-[420px]">
          <div className="border-b border-line p-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or country"
              aria-label="Search the organisation queue"
              className="h-11 w-full rounded-md bg-bg px-3 text-sm outline-none shadow-[inset_0_0_0_1px_var(--color-line)] focus:shadow-[inset_0_0_0_1.5px_var(--color-primary)]"
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold",
                    filter === item.id ? "bg-ink text-surface" : "bg-sunken text-muted hover:text-ink",
                  )}
                >
                  {item.label}
                  {snapshot ? (
                    <span className="ml-1 tabular opacity-70">
                      {item.id === "all" ? snapshot.counts.all : snapshot.counts[item.id]}
                    </span>
                  ) : null}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFlaggedOnly((value) => !value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold",
                  flaggedOnly ? "bg-danger text-surface" : "bg-sunken text-muted hover:text-ink",
                )}
                title="Names the personal-name detector was unsure about"
              >
                Name flagged
              </button>
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2.5 text-left",
                    selectedId === item.id ? "bg-sunken" : "hover:bg-sunken/60",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <strong className="text-sm font-semibold">{item.name}</strong>
                    <span className="font-mono text-[0.6rem] uppercase tracking-wide text-faint">
                      {item.countries.join(" · ")}
                    </span>
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {item.roleIds.map((role) => (
                      <span key={role} className="rounded bg-bg px-1.5 py-0.5 text-[0.6rem] font-semibold text-muted">
                        {ROLE_LABEL[role] ?? role}
                      </span>
                    ))}
                    {item.flaggedPersonal ? (
                      <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[0.6rem] font-semibold text-danger">
                        name may be a person
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
            {!items.length && snapshot ? (
              <li className="p-4 text-sm text-muted">Nothing in this view.</li>
            ) : null}
          </ul>
        </section>

        <section className="flex min-h-0 flex-1 flex-col rounded-xl bg-surface p-5 shadow-soft">
          {selected ? (
            <>
              <h2 className="font-display text-2xl font-medium tracking-[-0.02em]">{selected.name}</h2>
              <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faint">
                {selected.status} · {selected.batchId} · {selected.sourceKind}
              </p>

              {selected.flaggedPersonal ? (
                <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                  This name may belong to a person rather than a business. Check the source before
                  accepting — the registry records organisations, not individuals.
                </p>
              ) : null}

              <dl className="mt-4 grid gap-2 text-sm">
                <Row label="Countries" value={selected.countries.join(", ") || "—"} />
                <Row label="Roles" value={selected.roleIds.map((r) => ROLE_LABEL[r] ?? r).join(", ") || "—"} />
                <Row label="Website" value={selected.website || "none given"} />
              </dl>

              <p className="mt-4 text-sm leading-relaxed text-muted">{selected.evidenceNote || "No note."}</p>

              {selected.sourceUrl ? (
                <a
                  href={selected.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={() => setSourceOpened(true)}
                  className="mt-4 inline-block break-all text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Open the source →
                </a>
              ) : null}

              <label className="mt-4 block text-sm font-medium">
                Note
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md bg-bg px-3 py-2 text-sm outline-none shadow-[inset_0_0_0_1px_var(--color-line)]"
                  placeholder="Required when holding, rejecting or marking duplicate"
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" disabled={busy || !sourceOpened} onClick={() => decide("accept")}>
                  {sourceOpened ? "Accept" : "Open the source first"}
                </Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => decide("needs_evidence")}>
                  Hold for evidence
                </Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => decide("duplicate")}>
                  Duplicate
                </Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => decide("reject")}>
                  Reject
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted">
                Accepting publishes this to the public map as <strong>Editor accepted</strong> — the source names
                the company; the profile is not reviewed in depth.
              </p>
            </>
          ) : (
            <p className="m-auto text-sm text-muted">Select a candidate to review it.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-xl bg-surface p-3 shadow-soft">
      <dt className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">{label}</dt>
      <dd className="font-display text-2xl font-medium tabular">{n.toLocaleString()}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-[0.7rem] font-semibold uppercase tracking-wider text-faint">{label}</dt>
      <dd className="break-all">{value}</dd>
    </div>
  );
}
