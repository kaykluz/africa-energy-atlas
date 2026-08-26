"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { catalog, coreStages, countries } from "@/lib/catalog";
import { submitContribution } from "@/lib/contributions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Kind = "software" | "company" | "correction";

export function ContributeForm({
  initialKind,
  about,
}: {
  initialKind?: Kind;
  about?: string;
}) {
  const [kind, setKind] = useState<Kind>(initialKind ?? "software");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    setStatus("saving");
    setMessage("");
    try {
      await submitContribution({
        data: {
          kind,
          name: String(fd.get("name") ?? ""),
          website: String(fd.get("website") ?? ""),
          countryIso2: String(fd.get("countryIso2") ?? ""),
          stageId: String(fd.get("stageId") ?? ""),
          summary: String(fd.get("summary") ?? ""),
          sourceUrl: String(fd.get("sourceUrl") ?? ""),
        },
      });
      form.reset();
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Could not save. Check the fields and try again.");
    }
  }

  return (
    <>
      <div className="mt-6 flex gap-1 rounded-full bg-sunken p-1">
        {(
          [
            ["software", "Software"],
            ["company", "Company"],
            ["correction", "Correction"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setKind(id)}
            className={cn(
              "flex-1 rounded-full py-2 text-sm font-semibold",
              kind === id ? "bg-ink text-surface" : "text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {status === "done" ? (
        <div className="mt-8 rounded-xl bg-surface p-6 shadow-soft">
          <h2 className="font-display text-2xl font-medium">Received.</h2>
          <p className="mt-2 text-sm text-muted">
            It sits in the review queue and will not appear on the public map until an editor accepts it.
          </p>
          <Button className="mt-5" type="button" onClick={() => setStatus("idle")}>
            Submit another
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field label={kind === "correction" ? "Record to correct" : "Name"} htmlFor="name">
            <Input
              id="name"
              name="name"
              required
              minLength={2}
              defaultValue={about ?? ""}
              placeholder={kind === "company" ? "Organisation name" : "Product name"}
            />
          </Field>
          <Field label="Website" htmlFor="website">
            <Input id="website" name="website" placeholder="https://" />
          </Field>
          {kind !== "correction" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Country" htmlFor="countryIso2">
                <select
                  id="countryIso2"
                  name="countryIso2"
                  className="h-11 w-full rounded-md bg-surface px-3 text-sm shadow-[inset_0_0_0_1px_var(--color-line)]"
                >
                  <option value="">Not sure</option>
                  {countries.map((c) => (
                    <option key={c.iso2} value={c.iso2}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              {kind === "software" ? (
                <Field label="Value-chain stage" htmlFor="stageId">
                  <select
                    id="stageId"
                    name="stageId"
                    className="h-11 w-full rounded-md bg-surface px-3 text-sm shadow-[inset_0_0_0_1px_var(--color-line)]"
                  >
                    <option value="">Not sure</option>
                    {coreStages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
            </div>
          ) : null}
          <Field
            label={kind === "correction" ? "What should change, and the source" : "One-line what it does"}
            htmlFor="summary"
          >
            <Textarea
              id="summary"
              name="summary"
              required
              minLength={12}
              placeholder={
                kind === "software"
                  ? "PAYGo operations platform used by mini-grid developers."
                  : "Sourced fact and why it belongs on the map."
              }
            />
          </Field>
          <Field label="Source URL" htmlFor="sourceUrl">
            <Input id="sourceUrl" name="sourceUrl" placeholder="https:// — product page, news, report" />
          </Field>
          {message ? <p className="text-sm text-danger">{message}</p> : null}
          <Button type="submit" disabled={status === "saving"} className="w-full">
            {status === "saving" ? "Sending…" : "Submit for review"}
          </Button>
          <p className="text-xs text-faint">
            {catalog.counts.software} software already on the map. Do not send personal data or precise infrastructure
            coordinates.
          </p>
        </form>
      )}
    </>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
