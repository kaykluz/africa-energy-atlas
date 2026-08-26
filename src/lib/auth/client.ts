import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { MAGIC_LINK_MINUTES, SOCIAL_PROVIDERS } from "./providers";

/**
 * Better Auth client for the browser.
 *
 * Talks to this app's OWN Better Auth at same-origin `/api/auth/*`, so the
 * session is an ordinary first-party cookie. No bearer tokens, no popup, no
 * cross-origin broker: sign-in is a normal top-level redirect to Google, or a
 * link delivered by email.
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});

export { MAGIC_LINK_MINUTES, SOCIAL_PROVIDERS };

/** Pull a human-readable message out of a Better Auth error envelope. */
function messageFrom(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

/**
 * Start Google sign-in as a full-page redirect.
 *
 * Resolves only if the redirect does not happen — on success the browser has
 * already left the page.
 */
export async function signIn(
  providerId: (typeof SOCIAL_PROVIDERS)[number]["providerId"],
  opts: { callbackURL?: string; errorCallbackURL?: string } = {},
): Promise<void> {
  const { error } = await authClient.signIn.social({
    provider: providerId,
    callbackURL: opts.callbackURL ?? "/review",
    errorCallbackURL: opts.errorCallbackURL ?? "/login",
  });
  if (error) throw new Error(messageFrom(error, "Sign-in failed."));
}

/**
 * Email a single-use sign-in link.
 *
 * Always reports success to the caller, even for an address the server declines
 * to mail. The server only sends to allowlisted editors, and saying so here
 * would turn this form into a way to test whether an address is one.
 */
export async function sendMagicLink(
  email: string,
  opts: { callbackURL?: string } = {},
): Promise<void> {
  const { error } = await authClient.signIn.magicLink({
    email,
    callbackURL: opts.callbackURL ?? "/review",
  });
  if (error) throw new Error(messageFrom(error, "Could not send the sign-in link."));
}

/** End the session and return to the public map. */
export async function signOut(): Promise<void> {
  try {
    await authClient.signOut();
  } finally {
    if (typeof window !== "undefined") window.location.assign("/");
  }
}
