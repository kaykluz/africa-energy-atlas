import { Link, createFileRoute } from "@tanstack/react-router";
import { catalog, coreStages } from "@/lib/catalog";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-14">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faint">About</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-[-0.03em]">
        A public map of the software running African energy.
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink/85">
        The atlas shows products across the energy value chain, the companies behind them, and the countries they are
        tied to. It is open to view and open to improve.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-medium">How to read it</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink/85">
          <li>
            <strong>Map</strong> — company presence by country, or software with a named location. Africa-wide tags are
            not painted onto every state.
          </li>
          <li>
            <strong>Chain</strong> — the six stages from plan to trade, plus the functions inside each.
          </li>
          <li>
            <strong>Blue dot</strong> — a reviewed record with sourced deployments. Everything else is catalogue coverage
            still being checked.
          </li>
          <li>
            <strong>Editor accepted</strong> — a public submission an editor published so it can be found. That is not
            the same as a reviewed record.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-medium">The chain</h2>
        <ol className="mt-4 space-y-2">
          {coreStages.map((s, i) => (
            <li key={s.id} className="flex gap-3 text-sm">
              <span className="font-mono text-faint">{String(i + 1).padStart(2, "0")}</span>
              <Link to="/" search={{ view: "chain", stage: s.id }} className="font-semibold hover:text-primary">
                {s.name}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-medium">Now</h2>
        <p className="mt-3 text-sm text-muted">
          {catalog.counts.software} software records · {catalog.counts.reviewedSoftware} reviewed ·{" "}
          {catalog.counts.companies} companies · {catalog.counts.deployments} evidenced deployments · release{" "}
          {catalog.version} ({catalog.asOf}).
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-medium">Contribute</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink/85">
          Anyone may submit a product, company or correction. Editors decide what is published. Provider claims stay
          distinct from independent evidence. No paid ranking or paid inclusion.
        </p>
        <Link to="/contribute" search={{ kind: undefined, about: undefined }} className="mt-4 inline-flex font-semibold text-primary">
          Open the form
        </Link>
      </section>

      <section className="mt-10 text-sm text-muted">
        <p>
          Project by{" "}
          <a href="https://kaykluz.com" className="font-semibold text-ink">
            kaykluz
          </a>
          . Dataset and original documentation{" "}
          <a href="https://github.com/kaykluz/africa-energy-software-map" className="font-semibold text-ink">
            CC BY 4.0
          </a>
          . Code MIT.
        </p>
      </section>
    </main>
  );
}
