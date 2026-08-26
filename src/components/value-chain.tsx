"use client";

import { Link } from "@tanstack/react-router";
import {
  coreStages,
  functionName,
  functionsForStage,
  softwareInFunction,
  softwareInStage,
  stageById,
  type Software,
} from "@/lib/catalog";
import { cn, initials } from "@/lib/utils";
import { useAcceptedCatalog } from "@/components/accepted-catalog";
import { mergeBySlug } from "@/lib/accepted-records";

function SoftwareChip({
  item,
  onOpen,
}: {
  item: Software;
  onOpen: (slug: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.slug)}
      className="group flex min-h-11 items-center gap-2 rounded-md bg-surface px-2.5 py-1.5 text-left shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors duration-150 hover:shadow-[inset_0_0_0_1px_var(--color-ink)]"
    >
      <span className="mark-disc size-7 shrink-0 text-[0.62rem]">
        {initials(item.name)}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          {item.reviewed ? <i className="reviewed-dot" title="Reviewed" /> : null}
          <span className="truncate text-[0.82rem] font-semibold leading-tight">{item.name}</span>
        </span>
        {item.companyName ? (
          <span className="block truncate text-[0.68rem] text-muted">{item.companyName}</span>
        ) : item.kind === "community_accepted" ? (
          <span className="block truncate text-[0.68rem] text-muted">Editor accepted</span>
        ) : null}
      </span>
    </button>
  );
}

export function ValueChain({
  stageId,
  functionId,
  onStage,
  onFunction,
  onOpenSoftware,
}: {
  stageId?: string;
  functionId?: string;
  onStage: (id: string) => void;
  onFunction: (id: string | undefined) => void;
  onOpenSoftware: (slug: string) => void;
}) {
  const { software: extraSoftware } = useAcceptedCatalog();
  const acceptedInStage = (id: string) => extraSoftware.filter((item) => item.stageIds.includes(id));
  const active = stageId && stageById.has(stageId) ? stageId : coreStages[0]?.id;
  const stage = stageById.get(active ?? "") ?? coreStages[0];
  const items = mergeBySlug(softwareInStage(stage.id), acceptedInStage(stage.id));
  const fns = functionsForStage(stage.id)
    .map((fn) => ({
      ...fn,
      items: softwareInFunction(fn.id).filter(
        (s) => s.stageIds.includes(stage.id) || fn.stageIds.length === 0,
      ),
    }))
    .filter((fn) => fn.items.length > 0);

  const ungrouped = items.filter((s) => !s.functionIds.some((id) => fns.some((f) => f.id === id)));
  const shownFns = functionId ? fns.filter((f) => f.id === functionId) : fns;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 overflow-x-auto border-b border-line px-3 py-3 sm:px-5">
        <div className="flex min-w-max gap-1.5">
          {coreStages.map((st, i) => {
            const count = mergeBySlug(softwareInStage(st.id), acceptedInStage(st.id)).length;
            const isOn = st.id === stage.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => onStage(st.id)}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors duration-150 md:min-h-0 md:min-w-[148px] md:flex-col md:items-stretch md:py-2.5",
                  isOn ? "bg-ink text-surface" : "bg-surface text-ink hover:bg-sunken",
                )}
              >
                <span className={cn("font-mono text-[0.62rem] tracking-[0.14em]", isOn ? "text-map-low" : "text-faint")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="whitespace-nowrap font-display text-[0.95rem] font-medium leading-tight md:mt-1 md:whitespace-normal">
                  {st.name}
                </span>
                <span className={cn("text-xs tabular md:mt-1", isOn ? "text-surface/70" : "text-muted")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faint">Value chain</p>
            <h2 className="font-display text-3xl font-medium tracking-[-0.03em] text-ink sm:text-4xl">
              {stage.name}
            </h2>
          </div>
          <p className="text-sm text-muted">
            {items.length} products
            {functionId ? ` · ${functionName(functionId)}` : ""}
          </p>
        </div>

        {functionId ? (
          <button
            type="button"
            className="mb-4 text-sm font-semibold text-primary"
            onClick={() => onFunction(undefined)}
          >
            All functions in this stage
          </button>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          {shownFns.map((fn) => (
            <section key={fn.id} className="rounded-xl bg-surface p-4 shadow-soft">
              <header className="mb-3 flex items-baseline justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onFunction(fn.id === functionId ? undefined : fn.id)}
                  className="text-left font-semibold leading-snug hover:text-primary"
                >
                  {fn.name}
                </button>
                <span className="font-mono text-xs tabular text-faint">{fn.items.length}</span>
              </header>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {fn.items
                  .sort((a, b) => Number(b.reviewed) - Number(a.reviewed) || a.name.localeCompare(b.name))
                  .slice(0, functionId ? 60 : 8)
                  .map((item) => (
                    <SoftwareChip key={item.id} item={item} onOpen={onOpenSoftware} />
                  ))}
              </div>
              {!functionId && fn.items.length > 8 ? (
                <button
                  type="button"
                  onClick={() => onFunction(fn.id)}
                  className="mt-3 text-xs font-semibold text-muted hover:text-ink"
                >
                  +{fn.items.length - 8} more
                </button>
              ) : null}
            </section>
          ))}

          {ungrouped.length && !functionId ? (
            <section className="rounded-xl bg-surface p-4 shadow-soft">
              <header className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="font-semibold">Other in this stage</h3>
                <span className="font-mono text-xs tabular text-faint">{ungrouped.length}</span>
              </header>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ungrouped.slice(0, 8).map((item) => (
                  <SoftwareChip key={item.id} item={item} onOpen={onOpenSoftware} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="text-muted">
            Nothing filed here yet.{" "}
            <Link to="/contribute" search={{ kind: undefined, about: undefined }} className="font-semibold text-primary">
              Add a product
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
