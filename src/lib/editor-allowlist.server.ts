/**
 * Editor allowlist — server-only.
 *
 * Production reads REVIEWER_EMAILS from the hosting environment (Vercel / deploy
 * dashboard). That value is never in git, never prefixed VITE_, and never sent
 * to the browser. Cloning or editing this open-source repo cannot grant access
 * to the live site.
 *
 * Fail closed: an empty or missing allowlist admits nobody once a real database
 * is configured. The throwaway preview database (no DATABASE_URL) lets a
 * signed-in identity use THIS instance only, so editors can try the workspace
 * without writing secrets into the repo.
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

export function reviewerEmails(): string[] {
  return parseReviewerEmails(process.env.REVIEWER_EMAILS);
}

export function isAllowlistConfigured(): boolean {
  return reviewerEmails().length > 0;
}

/** True when this process is the in-memory preview DB, not deployed Neon. */
export function isEphemeralPreview(): boolean {
  return !process.env.DATABASE_URL?.trim();
}

export function isAllowedEditor(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalised = email.trim().toLowerCase();
  if (!normalised) return false;
  const list = reviewerEmails();
  if (list.length > 0) return list.includes(normalised);
  // Preview PGLite only. Never open the gate on a real database.
  return isEphemeralPreview();
}
