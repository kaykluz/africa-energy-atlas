import { envString } from "@/lib/env.server";
import { sqliteBackend } from "@/lib/sqlite.server";

/**
 * Editor allowlist — **server-only**.
 *
 * Production reads `REVIEWER_EMAILS` from the Worker environment (a Cloudflare
 * secret, comma-separated). That value is never in git, never prefixed `VITE_`,
 * and never sent to the browser. Cloning or editing this open-source repo
 * cannot grant access to the live site.
 *
 * Fail closed: an empty or missing allowlist admits nobody once the app is
 * running on the real D1 database. The local `vite dev` database is a throwaway
 * file, so a signed-in identity may use THAT instance only — which is how an
 * editor tries the workspace without writing secrets into the repo.
 */

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function parseReviewerEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function reviewerEmails(): Promise<string[]> {
  return parseReviewerEmails(await envString("REVIEWER_EMAILS"));
}

export async function isAllowlistConfigured(): Promise<boolean> {
  return (await reviewerEmails()).length > 0;
}

/**
 * True when this process is the throwaway local dev database rather than the
 * deployed D1 one. Never true on a Worker with a `DB` binding.
 */
export async function isEphemeralPreview(): Promise<boolean> {
  return (await sqliteBackend()) === "node";
}

export async function isAllowedEditor(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
  const normalised = email.trim().toLowerCase();
  if (!normalised) return false;
  const list = await reviewerEmails();
  if (list.length > 0) return list.includes(normalised);
  // Local dev only. Never open the gate on the deployed database.
  return isEphemeralPreview();
}
