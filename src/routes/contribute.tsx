import { createFileRoute } from "@tanstack/react-router";
import { ContributeForm } from "@/components/contribute-form";

type Kind = "software" | "company" | "correction";

export const Route = createFileRoute("/contribute")({
  validateSearch: (s: Record<string, unknown>) => ({
    kind: s.kind === "company" || s.kind === "correction" || s.kind === "software" ? (s.kind as Kind) : undefined,
    about: typeof s.about === "string" ? s.about : undefined,
  }),
  component: ContributePage,
});

function ContributePage() {
  const search = Route.useSearch();
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:py-14">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faint">Open contribution</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-[-0.03em]">Add what the map is missing.</h1>
      <p className="mt-3 text-muted">
        Anyone can submit. Editors review before a record is published. A public source URL helps more than a long essay.
      </p>
      <ContributeForm initialKind={search.kind} about={search.about} />
    </main>
  );
}
