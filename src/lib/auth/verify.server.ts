import { getRequest } from "@tanstack/react-start/server";
import { authConfigured, getAuth } from "./server";

/**
 * Server-side session resolution — **server-only**.
 *
 * This app runs its OWN Better Auth at same-origin `/api/auth/*`, so the session
 * cookie is sent with every request to it — server functions and SSR loaders
 * included. The user is resolved straight from those cookies via
 * `auth.api.getSession`. Never trust a client-supplied user id; only the result
 * of this verification.
 */

export { authConfigured };

/**
 * Thrown when the caller has no valid session. Carries `status: 401`; the
 * message is a stable contract — match `err.message === "Unauthorized"`
 * client-side to send the visitor to sign-in.
 */
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export type VerifiedUser = { id: string; email: string | null };

/**
 * Resolve the signed-in user from the current request, or `null` when nobody is
 * signed in (or no sign-in method is configured). Safe to call from server
 * functions and SSR loaders.
 */
export async function getSessionUser(): Promise<VerifiedUser | null> {
  if (!(await authConfigured())) return null;
  const request = getRequest();
  if (!request) return null;
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email ?? null };
}

/**
 * Resolve the current user id, or throw `UnauthorizedError`. Prefer the
 * middlewares in `@/lib/editor-gate`, which call this for you.
 */
export async function requireUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user.id;
}
