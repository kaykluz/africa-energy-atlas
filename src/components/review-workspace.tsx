"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useRouterState } from "@tanstack/react-router";
import { MAGIC_LINK_MINUTES, SOCIAL_PROVIDERS, sendMagicLink, signIn, signOut } from "@/lib/auth/client";
import { getSignInMethods, type SignInMethods } from "@/lib/sign-in-methods";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  decideContribution,
  getEditorSession,
  listContributionQueue,
  type ContributionDecision,
  type ContributionStatus,
  type EditorSession,
  type QueueItem,
  type QueueSnapshot,
} from "@/lib/contributions";
import { countryName, stageName } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const FILTERS: { id: "all" | ContributionStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "received", label: "Inbox" },
  { id: "needs_evidence", label: "Held" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
  { id: "duplicate", label: "Duplicate" },
];

export function EditorAccess() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const [session, setSession] = useState<EditorSession | null>(null);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setSession({ signedIn: false, isEditor: false, email: null, previewOpenGate: false });
      return;
    }
    let cancelled = false;
    void getEditorSession()
      .then((next) => {
        if (!cancelled) setSession(next);
      })
      .catch(() => {
        if (!cancelled) {
          setSession({ signedIn: true, isEditor: false, email: user.primaryEmail, previewOpenGate: false });
          setSessionError("Could not read the editor session.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isPending, user?.id, user?.primaryEmail]);

  if (user) {
    if (isPending || !session) {
      return (
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-lg flex-1 px-4 py-16">
          <div className="h-40 animate-pulse rounded-xl bg-sunken" />
        </main>
      );
    }
    if (!session.isEditor) {
      return <EditorDenied email={session.email} />;
    }
    if (pathname === "/login") {
      return <Navigate to="/review" />;
    }
    return <ReviewWorkspace session={session} />;
  }

  return <EditorSignIn error={sessionError} />;
}

function EditorSignIn({ error }: { error: string }) {
  const [methods, setMethods] = useState<SignInMethods | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getSignInMethods()
      .then((next) => {
        if (!cancelled) setMethods(next);
      })
      .catch(() => {
        // Fall back to showing nothing rather than a button that cannot work.
        if (!cancelled) setMethods({ google: false, magicLink: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const nothingConfigured = methods !== null && !methods.google && !methods.magicLink;

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faint">Private</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-[-0.03em]">Editor sign-in</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        This door is for allowlisted editors. The public map never links here. Sign in with an account on the hosting
        allowlist — a cloned copy of the source cannot open the live workspace.
      </p>

      <div className="mt-8 space-y-3">
        {methods === null ? (
          <div className="h-10 animate-pulse rounded-lg bg-sunken" />
        ) : null}

        {methods?.google
          ? SOCIAL_PROVIDERS.map((provider) => (
              <Button
                key={provider.providerId}
                type="button"
                variant="primary"
                className="w-full"
                disabled={Boolean(busy)}
                onClick={() => {
                  setBusy(provider.providerId);
                  setLocalError("");
                  void signIn(provider.providerId, {
                    callbackURL: "/review",
                    errorCallbackURL: "/login",
                  }).catch((err: unknown) => {
                    setLocalError(err instanceof Error ? err.message : "Sign-in failed.");
                    setBusy(null);
                  });
                }}
              >
                {busy === provider.providerId ? "Opening…" : `Continue with ${provider.label}`}
              </Button>
            ))
          : null}

        {methods?.google && methods?.magicLink ? (
          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-line" />
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-faint">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        ) : null}

        {methods?.magicLink ? (
          linkSent ? (
            <div className="rounded-xl border border-line bg-sunken p-4">
              <p className="text-sm font-semibold">Check your inbox</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                If {email.trim() || "that address"} is on the editor allowlist, a sign-in link is on its way. It works
                once and expires in {MAGIC_LINK_MINUTES} minutes.
              </p>
              <button
                type="button"
                className="mt-3 cursor-pointer text-sm font-semibold text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setLinkSent(false);
                  setBusy(null);
                }}
              >
                Use a different address
              </button>
            </div>
          ) : (
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                const address = email.trim();
                if (!address) return;
                setBusy("magic-link");
                setLocalError("");
                void sendMagicLink(address, { callbackURL: "/review" })
                  .then(() => {
                    setLinkSent(true);
                    setBusy(null);
                  })
                  .catch((err: unknown) => {
                    setLocalError(
                      err instanceof Error ? err.message : "Could not send the sign-in link.",
                    );
                    setBusy(null);
                  });
              }}
            >
              <label htmlFor="editor-email" className="block text-sm font-medium">
                Email a sign-in link
              </label>
              <Input
                id="editor-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.org"
                value={email}
                disabled={Boolean(busy)}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Button type="submit" variant="secondary" className="w-full" disabled={Boolean(busy)}>
                {busy === "magic-link" ? "Sending…" : "Send the link"}
              </Button>
            </form>
          )
        ) : null}

        {nothingConfigured ? (
          <p className="text-sm text-muted">
            Sign-in is not configured on this deployment. Set the Google OAuth or Resend secrets in the hosting
            environment to open the workspace.
          </p>
        ) : null}
      </div>

      {localError || error ? <p className="mt-4 text-sm text-danger">{localError || error}</p> : null}
      <Link to="/" className="mt-8 text-sm font-semibold text-primary">
        Return to the map
      </Link>
    </main>
  );
}

function EditorDenied({ email }: { email: string | null }) {
  const [signingOut, setSigningOut] = useState(false);
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faint">Closed</p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-[-0.03em]">Reviewer access required</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {email ?? "This account"} is signed in but is not on the editor allowlist for this site. The list lives in the
        hosting environment, not in the repository.
      </p>
      <div className="mt-8 flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/">Return to the map</Link>
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            void signOut().catch(() => setSigningOut(false));
          }}
        >
          {signingOut ? "Signing out…" : "Change account"}
        </Button>
      </div>
    </main>
  );
}

function ReviewWorkspace({ session }: { session: EditorSession }) {
  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<"all" | ContributionStatus>("received");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function refresh() {
    const next = await listContributionQueue();
    setSnapshot(next);
    setLoadError("");
    return next;
  }

  useEffect(() => {
    void refresh().catch(() => setLoadError("Could not load the queue."));
  }, []);

  const items = useMemo(() => {
    if (!snapshot) return [];
    const q = query.trim().toLowerCase();
    return snapshot.items.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false;
      if (!q) return true;
      return `${item.name} ${item.summary} ${item.website} ${item.sourceUrl}`.toLowerCase().includes(q);
    });
  }, [snapshot, filter, query]);

  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-3 py-6 sm:px-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faint">Editors only</p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-[-0.03em] sm:text-4xl">Contribution review</h1>
          <p className="mt-2 max-w-[52ch] text-sm text-muted">
            Public submissions wait here. Accepting a product or company publishes it on the atlas. Corrections stay as
            an editorial record.
          </p>
        </div>
        <p className="text-sm text-muted">
          Signed in as <span className="font-semibold text-ink">{session.email}</span>
        </p>
      </header>

      {session.previewOpenGate ? (
        <p className="mt-4 rounded-lg bg-sunken px-4 py-3 text-sm text-ink">
          This preview has no <span className="font-mono text-xs">REVIEWER_EMAILS</span> list, so any signed-in account
          can moderate the throwaway database. On the live site the allowlist is set in hosting env and fails closed.
        </p>
      ) : null}

      {snapshot ? (
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat n={snapshot.counts.received} label="Inbox" />
          <Stat n={snapshot.counts.needs_evidence} label="Held" />
          <Stat n={snapshot.counts.accepted} label="Accepted" />
          <Stat n={snapshot.counts.rejected} label="Rejected" />
          <Stat n={snapshot.counts.all} label="Total" />
        </dl>
      ) : (
        <div className="mt-6 h-20 animate-pulse rounded-xl bg-sunken" />
      )}

      {loadError ? <p className="mt-4 text-sm text-danger">{loadError}</p> : null}

      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <section className="flex min-h-0 flex-1 flex-col rounded-xl bg-surface shadow-soft lg:max-w-[420px]">
          <div className="border-b border-line p-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the queue"
              aria-label="Search the queue"
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
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "w-full rounded-lg px-3 py-3 text-left",
                    selected?.id === item.id ? "bg-sunken" : "hover:bg-bg",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{item.name}</span>
                    <StatusBadge status={item.status} />
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted">
                    {item.kind} · {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </button>
              </li>
            ))}
            {snapshot && items.length === 0 ? (
              <li className="px-3 py-8 text-sm text-muted">Nothing in this filter.</li>
            ) : null}
          </ul>
        </section>

        <section className="min-h-0 flex-1 rounded-xl bg-surface p-4 shadow-soft sm:p-6">
          {selected ? (
            <ReviewDetail
              key={selected.id + selected.version}
              item={selected}
              onChanged={async (next) => {
                const snap = await refresh();
                setSelectedId(next.id);
                const still = snap.items.find((row) => row.id === next.id);
                if (still) setSelectedId(still.id);
              }}
            />
          ) : (
            <p className="text-sm text-muted">The queue is empty. Public submissions land here for a human decision.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function ReviewDetail({
  item,
  onChanged,
}: {
  item: QueueItem;
  onChanged: (item: QueueItem) => Promise<void>;
}) {
  const [note, setNote] = useState(item.note);
  const [sourceOpened, setSourceOpened] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function act(decision: ContributionDecision) {
    setBusy(decision);
    setError("");
    try {
      const next = await decideContribution({
        data: {
          id: item.id,
          version: item.version,
          decision,
          note,
          sourceOpened,
        },
      });
      await onChanged(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that decision.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-faint">{item.kind}</p>
      <h2 className="mt-1 font-display text-3xl font-medium tracking-[-0.03em]">{item.name}</h2>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <StatusBadge status={item.status} />
        {item.countryIso2 ? <Badge tone="quiet">{countryName(item.countryIso2)}</Badge> : null}
        {item.stageId ? <Badge tone="quiet">{stageName(item.stageId)}</Badge> : null}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-ink/85">{item.summary}</p>
      <dl className="mt-5 space-y-2 text-sm">
        {item.website ? (
          <Row label="Website">
            <a href={item.website} target="_blank" rel="noreferrer" className="font-semibold text-primary break-all">
              {item.website}
            </a>
          </Row>
        ) : null}
        {item.sourceUrl ? (
          <Row label="Source">
            <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary break-all">
              {item.sourceUrl}
            </a>
          </Row>
        ) : (
          <Row label="Source">None supplied</Row>
        )}
        {item.slug ? (
          <Row label="Public slug">
            {item.kind === "company" ? (
              <Link to="/companies/$slug" params={{ slug: item.slug }} className="font-semibold text-primary">
                /companies/{item.slug}
              </Link>
            ) : (
              <Link to="/software/$slug" params={{ slug: item.slug }} className="font-semibold text-primary">
                /software/{item.slug}
              </Link>
            )}
          </Row>
        ) : null}
        {item.reviewedByEmail ? <Row label="Last editor">{item.reviewedByEmail}</Row> : null}
      </dl>

      <label className="mt-6 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={sourceOpened}
          onChange={(e) => setSourceOpened(e.target.checked)}
          className="mt-1 size-4"
        />
        <span>I opened the source and the claim is safe to publish (required to accept).</span>
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold">Editorial note</span>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this decision, in one or two sentences." />
      </label>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" disabled={Boolean(busy)} onClick={() => void act("accept")}>
          {busy === "accept" ? "Saving…" : "Accept"}
        </Button>
        <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => void act("needs_evidence")}>
          Hold for evidence
        </Button>
        <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => void act("duplicate")}>
          Duplicate
        </Button>
        <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => void act("reject")}>
          Reject
        </Button>
        {item.status !== "received" ? (
          <Button type="button" variant="ghost" disabled={Boolean(busy)} onClick={() => void act("clear")}>
            Return to inbox
          </Button>
        ) : null}
      </div>
      <p className="mt-4 text-xs text-faint">
        Accepting software or a company puts it on the public atlas immediately, labelled as editor-accepted rather than
        reviewed-in-depth. Decisions are audited. This page cannot rewrite hosting secrets or the allowlist.
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7rem_1fr]">
      <dt className="text-faint">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-3 shadow-soft">
      <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-faint">{label}</dt>
      <dd className="mt-1 font-display text-2xl tabular">{n}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: ContributionStatus }) {
  if (status === "accepted") return <Badge tone="ok">Accepted</Badge>;
  if (status === "received") return <Badge tone="primary">Inbox</Badge>;
  if (status === "needs_evidence") return <Badge tone="quiet">Held</Badge>;
  if (status === "duplicate") return <Badge tone="quiet">Duplicate</Badge>;
  return <Badge tone="default">Rejected</Badge>;
}
